"""Supabase database operations."""

import os

from dotenv import load_dotenv
from supabase import Client, ClientOptions, create_client

from models import (
    DetectedFace,
    DetectedFaceInsert,
    DetectedFaceRow,
    DetectedFaceUpdate,
    ImageInsert,
    ImageRow,
    ImageWithFaces,
    ImageWithPersonMatchRow,
    PersonDelete,
    PersonMatch,
    PersonRow,
)

load_dotenv()

_client: Client | None = None


def log(message: str) -> None:
    """Simple logging function. Replace with proper logging later."""
    print(f"[database] {message}")


def get_client() -> Client:
    """Get or create Supabase client."""
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env")
        log("Initializing Supabase client")
        _client = create_client(url, key, options=ClientOptions(schema="portfolio"))
        log("Supabase client initialized")
    return _client


def get_app_config(key: str) -> str:
    """Load a value from the app_config table."""
    client = get_client()
    result = (
        client.table("app_config").select("value").eq("key", key).single().execute()
    )
    if not result.data or not isinstance(result.data, dict):
        raise KeyError(f"Config key not found: {key}")
    return str(result.data["value"])


def save_image(req: ImageInsert) -> ImageRow:
    """Save an image record to the database.

    Returns the created image record with its ID.
    """
    log(f"Saving image: {req.filename}")
    client = get_client()
    result = client.table("image").insert(req.model_dump(mode="json")).execute()
    row = ImageRow.model_validate(result.data[0])
    log(f"Image saved with id: {row.id}")
    return row


def get_image_by_source_url(source_url: str) -> ImageRow | None:
    """Get an image by source URL, or None if not found."""
    log(f"Looking up image by URL: {source_url[:50]}...")
    client = get_client()
    result = client.table("image").select("*").eq("source_url", source_url).execute()
    if result.data:
        row = ImageRow.model_validate(result.data[0])
        log(f"Found image: {row.id}")
        return row
    log("Image not found")
    return None


def _build_image_records(rows: list[ImageWithPersonMatchRow]) -> list[ImageWithFaces]:
    """Build ImageRecord objects from denormalized RPC result rows.

    Groups rows by image_id, then by face_id within each image,
    collecting person matches per face.
    """
    images_by_id: dict[str, ImageWithFaces] = {}
    faces_by_image: dict[str, dict[str, DetectedFace]] = {}

    for row in rows:
        image_id = row.image_id

        if image_id not in images_by_id:
            images_by_id[image_id] = ImageWithFaces.model_validate(row.model_dump())
            images_by_id[image_id].detected_faces = []
            faces_by_image[image_id] = {}

        face_id = row.face_id
        if face_id is None:
            continue

        if face_id not in faces_by_image[image_id]:
            faces_by_image[image_id][face_id] = DetectedFace(
                id=face_id,
                matched_persons=[],
                person_id=row.assigned_person_id,
                **row.model_dump(),
            )

        if row.matched_person_id is not None:
            faces_by_image[image_id][face_id].matched_persons.append(
                PersonMatch.model_validate(row.model_dump())
            )

    for image_id, faces in faces_by_image.items():
        images_by_id[image_id].detected_faces = list(faces.values())

    return list(images_by_id.values())


def get_image_by_id(
    image_id: str,
    person_match_threshold: float = 0.5,
    person_match_top_n: int = 3,
) -> ImageWithFaces | None:
    """Get an image by ID with its detected faces and person matches.

    Args:
        image_id: UUID of the image
        person_match_threshold: Maximum cosine distance for person matching (default 0.5)
        person_match_top_n: Number of closest person matches to return per face (default 3)

    Returns:
        ImageRecord with detected faces including matched_persons, or None if not found
    """
    log(f"Looking up image by ID: {image_id}")
    client = get_client()

    result = client.rpc(
        "get_image_with_person_matches",
        {
            "p_image_id": image_id,
            "p_threshold": person_match_threshold,
            "p_top_n": person_match_top_n,
        },
    ).execute()

    if not result.data or type(result.data) is not list:
        log("Image not found")
        return None

    rows = [ImageWithPersonMatchRow.model_validate(r) for r in result.data]
    images = _build_image_records(rows)

    if not images:
        log("Image not found")
        return None

    image = images[0]
    log(f"Found image: {image.id} with {len(image.detected_faces)} faces")
    return image


def delete_image(image_id: str) -> bool:
    """Delete an image and its detected faces. Returns True if deleted."""
    log(f"Deleting image: {image_id}")
    client = get_client()
    result = client.table("image").delete().eq("id", image_id).execute()
    deleted = len(result.data) > 0
    if deleted:
        log(f"Image deleted: {image_id}")
    else:
        log(f"Image not found: {image_id}")
    return deleted


def get_all_images(
    person_match_threshold: float = 0.5,
    person_match_top_n: int = 3,
) -> list[ImageWithFaces]:
    """Get all images from the database with their detected faces and person matches.

    Args:
        person_match_threshold: Maximum cosine distance for person matching (default 0.5)
        person_match_top_n: Number of closest person matches to return per face (default 3)

    Returns:
        List of ImageRecords with detected faces including matched_persons
    """
    log("Fetching all images with detected faces and person matches")
    client = get_client()

    # Supabase has a 1000 row limit per request, so we need to paginate
    all_rows: list[ImageWithPersonMatchRow] = []
    page_size = 1000
    offset = 0

    while True:
        result = (
            client.rpc(
                "get_all_images_with_person_matches",
                {
                    "p_threshold": person_match_threshold,
                    "p_top_n": person_match_top_n,
                },
            )
            .range(offset, offset + page_size - 1)
            .execute()
        )

        if not isinstance(result.data, list):
            break
        rows = [ImageWithPersonMatchRow.model_validate(r) for r in result.data]
        all_rows.extend(rows)
        log(f"Fetched {len(rows)} rows (offset={offset}, total={len(all_rows)})")

        if len(rows) < page_size:
            break
        offset += page_size

    log(f"Got {len(all_rows)} total rows from RPC")

    images = _build_image_records(all_rows)
    log(f"Found {len(images)} images")
    return images


def save_detected_face(face: DetectedFaceInsert) -> DetectedFaceRow:
    """Save a detected face with its encoding.

    Args:
        image_id: UUID of the parent image
        encoding: 128-dimensional face encoding vector
        location: Dict with top, right, bottom, left keys

    Returns the created face record.
    """
    log(f"Saving face for image: {face.image_id}")
    client = get_client()
    result = client.table("detected_face").insert(face.model_dump()).execute()
    row = DetectedFaceRow.model_validate(result.data[0])
    log(f"Face saved with id: {row.id}")
    return row


def create_person(name: str) -> PersonRow:
    """Create a new person record."""
    log(f"Creating person: {name}")
    client = get_client()
    result = client.table("person").insert({"name": name}).execute()
    row = PersonRow.model_validate(result.data[0])
    log(f"Person created with id: {row.id}")
    return PersonRow(id=row.id, name=row.name)


def get_all_people() -> list[PersonRow]:
    """Get all people from the database."""
    log("Fetching all people")
    client = get_client()
    result = client.table("person").select("id, name").execute()
    log(f"Found {len(result.data)} people")

    people = []
    for data in result.data:
        row = PersonRow.model_validate(data)
        people.append(PersonRow(id=row.id, name=row.name))
    return people


def get_person(person_id: str) -> PersonRow | None:
    """Get a person by ID."""
    log(f"Fetching person: {person_id}")
    client = get_client()
    result = client.table("person").select("id, name").eq("id", person_id).execute()
    if not result.data:
        log("Person not found")
        return None

    return PersonRow.model_validate(result.data[0])


def delete_person(person: PersonDelete) -> bool:
    """Delete a person. Returns True if deleted."""
    log(f"Deleting person: {person.person_id}")
    client = get_client()
    result = client.table("person").delete().eq("id", person.person_id).execute()
    deleted = len(result.data) > 0
    if deleted:
        log(f"Person deleted: {person.person_id}")
    else:
        log(f"Person not found: {person.person_id}")
    return deleted


def update_detected_face_person(face: DetectedFaceUpdate) -> bool:
    """Update the assigned person for a detected face.

    Args:
        face_id: UUID of the detected face
        person_id: UUID of the person to assign, or None to unassign

    Returns:
        True if the face was found and updated, False otherwise
    """
    log(f"Updating detected face {face.face_id} with person_id={face.person_id}")
    client = get_client()
    result = (
        client.table("detected_face")
        .update({"person_id": face.person_id})
        .eq("id", face.face_id)
        .execute()
    )
    updated = len(result.data) > 0
    if updated:
        log(f"Face {face.face_id} updated with person_id={face.person_id}")
    else:
        log(f"Face not found: {face.face_id}")
    return updated
