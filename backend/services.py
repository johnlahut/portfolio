"""Business logic - can be called directly without HTTP."""

import ipaddress
import os
import socket
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from urllib.parse import urljoin, urlparse

import bcrypt
import jwt
import numpy as np
import requests
from bs4 import BeautifulSoup
from deepface import DeepFace
from PIL import Image, ImageDraw
from pydantic import HttpUrl

import database
from exceptions import AuthError, ImageExistsError, SSRFError
from models import (
    CreatePersonResponse,
    DetectedFaceInfo,
    DetectedFaceInsert,
    DetectedFaceUpdate,
    FaceLocation,
    GetImagesResponse,
    GetScrapeJobsResponse,
    ImageInfo,
    ImageInsert,
    ImageRow,
    ImageWithFaces,
    PersonDelete,
    PersonRow,
    ProcessedFace,
    ProcessImageRequest,
    ProcessImageResponse,
    ScrapeJobDetail,
    ScrapeJobRow,
    ScrapeJobUpdate,
)

Image.MAX_IMAGE_PIXELS = 25_000_000  # ~25 megapixels, prevents decompression bombs

JWT_SECRET = os.getenv("JWT_SECRET", "")
if not JWT_SECRET or len(JWT_SECRET) < 32:
    raise RuntimeError(
        "JWT_SECRET environment variable must be set and at least 32 characters"
    )
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 1

# DeepFace configuration
DEEPFACE_MODEL = "Facenet512"  # 512-dimensional embeddings
DEEPFACE_DETECTOR = "retinaface"  # Best accuracy for detection


def log(message: str) -> None:
    """Simple logging function. Replace with proper logging later."""
    print(f"[services] {message}")


def validate_url(url: str | HttpUrl) -> str:
    """Validate a URL is safe to fetch (not targeting private/internal addresses).

    Raises SSRFError if the URL resolves to a blocked address.
    Returns the URL as a string.
    """
    parsed = urlparse(str(url))

    if parsed.scheme not in ("http", "https"):
        raise SSRFError(f"Blocked scheme: {parsed.scheme}")

    hostname = parsed.hostname
    if not hostname:
        raise SSRFError("Missing hostname")

    try:
        addr_infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        raise SSRFError(f"Cannot resolve hostname: {hostname}")

    for addr_info in addr_infos:
        ip = ipaddress.ip_address(addr_info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            raise SSRFError(f"Blocked address: {ip}")

    return str(url)


def _facial_area_to_location(facial_area: dict) -> FaceLocation:
    """Convert DeepFace facial_area (x, y, w, h) to location format."""
    x, y, w, h = facial_area["x"], facial_area["y"], facial_area["w"], facial_area["h"]
    return FaceLocation(
        location_top=y,
        location_right=x + w,
        location_bottom=y + h,
        location_left=x,
    )


def _detect_and_encode_faces(image_path_or_array) -> list[ProcessedFace]:
    """Detect faces and extract embeddings using DeepFace.

    Args:
        image_path_or_array: File path, URL, or numpy array

    Returns:
        List of dicts with 'location' and 'encoding' keys.
        Encoding is a 512-dimensional vector (Facenet512).
    """
    log(f"Detecting and encoding faces using {DEEPFACE_MODEL} + {DEEPFACE_DETECTOR}")
    try:
        results = DeepFace.represent(
            img_path=image_path_or_array,
            model_name=DEEPFACE_MODEL,
            detector_backend=DEEPFACE_DETECTOR,
            enforce_detection=True,
        )
    except ValueError as e:
        # DeepFace raises ValueError when no face is detected
        if "Face could not be detected" in str(e):
            log("No faces detected")
            return []
        raise

    log(f"Detected {len(results)} face(s)")
    faces = []
    for result in results:
        if isinstance(result, dict):
            faces.append(
                ProcessedFace(
                    embedding=result["embedding"],
                    location=_facial_area_to_location(result["facial_area"]),
                )
            )
    return faces


def _detect_faces(image_path_or_array) -> list[FaceLocation]:
    """Detect faces and return locations only (for backwards compatibility).

    Args:
        image_path_or_array: File path, URL, or numpy array

    Returns:
        List of face location dicts with top, right, bottom, left keys.
    """
    faces = _detect_and_encode_faces(image_path_or_array)
    return [face.location for face in faces]


def get_images(
    limit: int = 40,
    cursor: str | None = None,
    sort_person_id: str | None = None,
    search: str | None = None,
) -> GetImagesResponse:
    """Get a page of images from the database."""
    log(
        f"Fetching images page (limit={limit}, sort_person_id={sort_person_id}, search={search})"
    )
    images, next_cursor = database.get_all_images(
        limit=limit,
        cursor=cursor,
        sort_person_id=sort_person_id,
        search=search,
    )
    return GetImagesResponse(images=images, next_cursor=next_cursor)


def scrape_images(url: str | HttpUrl) -> list[ImageInfo]:
    """Fetch a URL and extract all image sources."""
    safe_url = validate_url(url)
    log(f"Scraping images from: {safe_url}")
    response = requests.get(safe_url, timeout=10)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    images: list[ImageInfo] = []

    for img in soup.find_all("img"):
        src = img.get("src")
        if not src:
            continue
        absolute_src = urljoin(safe_url, src)
        images.append(ImageInfo(src=absolute_src, alt=img.get("alt")))

    log(f"Found {len(images)} images")
    return images


def load_image_from_url(url: str) -> str:
    """Download an image from URL and return the URL (DeepFace can load URLs directly)."""
    log(f"Downloading image from: {url}")
    # Verify URL is accessible
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    log(f"Downloaded {len(response.content)} bytes")
    return url


def load_image_from_file(filepath: str) -> str:
    """Return filepath for DeepFace to load."""
    log(f"Loading image from file: {filepath}")
    return filepath


def load_image_from_bytes(data: bytes) -> np.ndarray:
    """Load an image from bytes and return as numpy array for DeepFace."""
    log(f"Loading image from {len(data)} bytes")
    img = Image.open(BytesIO(data))
    # Convert to RGB if needed (DeepFace expects RGB)
    if img.mode != "RGB":
        img = img.convert("RGB")
    return np.array(img)


def detect_faces_from_url(url: str) -> list[FaceLocation]:
    """Download an image from URL and detect face locations."""
    log(f"Detecting faces from URL: {url}")
    image = load_image_from_url(url)
    return _detect_faces(image)


def detect_faces_from_file(filepath: str) -> list[FaceLocation]:
    """Load a local image file and detect face locations."""
    log(f"Detecting faces from file: {filepath}")
    image = load_image_from_file(filepath)
    return _detect_faces(image)


def detect_and_tag_faces(filepath: str, output_path: str | None = None) -> dict:
    """Detect faces and save annotated image with boxes drawn around faces."""
    log(f"Detecting and tagging faces in: {filepath}")
    path = Path(filepath)

    if output_path is None:
        output_path = str(path.parent / f"{path.stem}_tagged{path.suffix}")

    # Load image for drawing
    pil_image = Image.open(filepath)
    if pil_image.mode != "RGB":
        pil_image = pil_image.convert("RGB")

    # Detect faces
    faces = _detect_faces(filepath)

    draw = ImageDraw.Draw(pil_image)

    for face in faces:
        draw.rectangle(
            [
                face.location_left,
                face.location_top,
                face.location_right,
                face.location_bottom,
            ],
            outline="red",
            width=3,
        )

    pil_image.save(output_path)
    log(f"Saved tagged image to: {output_path}")

    return {"faces": faces, "output_path": output_path}


def _download_image(url: str) -> tuple[np.ndarray, int, int]:
    """Download an image from URL and return (rgb_array, width, height)."""
    log(f"Downloading image from: {url}")
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    pil_image = Image.open(BytesIO(response.content))
    width, height = pil_image.size
    log(f"Image dimensions: {width}x{height}")
    if pil_image.mode != "RGB":
        pil_image = pil_image.convert("RGB")
    return np.array(pil_image), width, height


def _save_faces(image_id: str, faces: list[ProcessedFace]) -> list[DetectedFaceInfo]:
    """Persist detected faces for an image. Returns DetectedFaceInfo list."""
    saved: list[DetectedFaceInfo] = []
    for i, face in enumerate(faces):
        log(f"Saving face {i + 1}/{len(faces)} for image {image_id}")
        face_record = database.save_detected_face(
            face=DetectedFaceInsert(
                image_id=image_id,
                encoding=face.embedding,
                **face.location.model_dump(),
            )
        )
        saved.append(DetectedFaceInfo(id=face_record.id, **face.location.model_dump()))
    return saved


def detect_and_save_face(req: ProcessImageRequest) -> ProcessImageResponse:
    """Detect faces in an image and save to database."""
    log(f"Processing image: {req.source_url}")

    source_url = validate_url(req.source_url) if req.source_url else None

    if source_url:
        existing = database.get_image_by_source_url(source_url)
        if existing:
            raise ImageExistsError(f"Image already exists: {existing.id}")

    width: int | None = None
    height: int | None = None
    image_for_detection = source_url

    if source_url:
        image_for_detection, width, height = _download_image(source_url)

    faces = _detect_and_encode_faces(image_for_detection)

    log("Saving image record to database")
    image_record = database.save_image(
        ImageInsert(
            filename=req.filename,
            source_url=req.source_url,
            width=width,
            height=height,
        )
    )
    log(f"Image saved with id: {image_record.id}")

    saved_faces = _save_faces(image_record.id, faces)
    log(f"Processing complete: {len(saved_faces)} face(s) saved")
    return ProcessImageResponse(
        image_id=image_record.id,
        filename=req.filename,
        faces=saved_faces,
        face_count=len(saved_faces),
    )


def create_person(name: str) -> CreatePersonResponse:
    """Create a new person with just a name."""
    log(f"Creating person '{name}'")
    person = database.create_person(name)
    return CreatePersonResponse(person=person)


def get_image(image_id: str) -> ImageWithFaces | None:
    """Get a single image with its faces."""
    log(f"Fetching image: {image_id}")
    return database.get_image_by_id(image_id)


def delete_image(image_id: str) -> bool:
    """Delete an image. Returns True if deleted."""
    log(f"Deleting image: {image_id}")
    return database.delete_image(image_id)


def get_people() -> list[PersonRow]:
    """Get all people."""
    log("Fetching all people")
    return database.get_all_people()


def delete_person(person_id: str) -> bool:
    """Delete a person. Returns True if deleted."""
    log(f"Deleting person: {person_id}")
    return database.delete_person(PersonDelete(person_id=person_id))


def update_face_person(
    face_id: str, person_id: str | None
) -> DetectedFaceUpdate | None:
    """Assign or unassign a person to a detected face. Returns None if face not found."""
    log(f"Updating face {face_id} with person_id={person_id}")
    update = DetectedFaceUpdate(face_id=face_id, person_id=person_id)
    updated = database.update_detected_face_person(update)
    return update if updated else None


def verify_password(password: str) -> str:
    """Verify password against stored bcrypt hash and return a signed JWT.

    Raises AuthError on invalid password.
    """
    log("Verifying password")
    stored_hash = database.get_app_config("chirp_password_hash")
    if not bcrypt.checkpw(password.encode(), stored_hash.encode()):
        log("Password verification failed")
        raise AuthError("Invalid password")

    log("Password verified, issuing token")
    version = database.get_app_config("chirp_password_version")
    return jwt.encode(
        {
            "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS),
            "ver": version,
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def detect_and_link_faces(
    image: ImageRow, source_url: str, filename: str
) -> ProcessImageResponse:
    """Detect faces for an existing image record and save them.

    Used when the image row was already saved (e.g. a prior partial failure)
    but face detection did not complete.
    """
    log(f"Re-detecting faces for existing image {image.id}: {source_url}")
    image_array, _, _ = _download_image(source_url)
    faces = _detect_and_encode_faces(image_array)
    saved_faces = _save_faces(image.id, faces)
    log(f"Re-linked {len(saved_faces)} face(s) to image {image.id}")
    return ProcessImageResponse(
        image_id=image.id,
        filename=filename,
        faces=saved_faces,
        face_count=len(saved_faces),
    )


def create_scrape_job(url: str) -> ScrapeJobRow:
    """Create a new scrape job record."""
    log(f"Creating scrape job for: {url[:80]}")
    return database.create_scrape_job(url)


def get_scrape_jobs() -> GetScrapeJobsResponse:
    """Return all scrape jobs."""
    log("Fetching scrape jobs")
    jobs = database.get_scrape_jobs()
    return GetScrapeJobsResponse(jobs=jobs)


def get_scrape_job_detail(job_id: str) -> ScrapeJobDetail | None:
    """Return a scrape job with its items, or None if not found."""
    log(f"Fetching scrape job detail: {job_id}")
    return database.get_scrape_job_detail(job_id)


def retry_scrape_job(job_id: str) -> ScrapeJobRow | None:
    """Reset failed items and re-queue the job. Returns None if not retryable."""
    log(f"Retrying scrape job: {job_id}")
    job = database.get_scrape_job(job_id)
    if not job or job.status not in ("failed", "completed"):
        return None
    count = database.reset_failed_job_items(job_id)
    if count == 0:
        return None
    database.update_scrape_job(
        ScrapeJobUpdate(id=job_id, status="pending", failed_count=0)
    )
    return database.get_scrape_job(job_id)


def delete_scrape_job(job_id: str) -> bool:
    """Delete a scrape job. Returns True if deleted."""
    log(f"Deleting scrape job: {job_id}")
    return database.delete_scrape_job(job_id)


def check_auth(token: str) -> bool:
    """Validate a JWT and confirm its password version is current."""
    log("Checking auth token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        log("Token invalid or expired")
        return False

    current_version = database.get_app_config("chirp_password_version")
    authenticated = payload.get("ver") == current_version
    log(f"Token {'valid' if authenticated else 'version mismatch'}")
    return authenticated
