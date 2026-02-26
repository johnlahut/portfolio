"""Supabase database operations."""

import json
import os
from datetime import datetime, timedelta, timezone

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
    ScrapeJobDetail,
    ScrapeJobItemInsert,
    ScrapeJobItemRow,
    ScrapeJobItemUpdate,
    ScrapeJobRow,
    ScrapeJobUpdate,
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
    limit: int = 40,
    cursor: str | None = None,
    sort_person_id: str | None = None,
    search: str | None = None,
    person_match_threshold: float = 0.5,
    person_match_top_n: int = 3,
) -> tuple[list[ImageWithFaces], str | None]:
    """Fetch a page of images with cursor-based pagination.

    Args:
        limit: Maximum number of images to return per page (default 40)
        cursor: Opaque JSON cursor string from a previous response (default None = first page)
        sort_person_id: UUID of a person to sort by (tagged first, then by match distance)
        search: Filter images by source_url or filename (case-insensitive substring match)
        person_match_threshold: Maximum cosine distance for person matching (default 0.5)
        person_match_top_n: Number of closest person matches to return per face (default 3)

    Returns:
        Tuple of (images, next_cursor). next_cursor is None when there are no more pages.
    """
    log(f"Fetching images page (limit={limit}, cursor={'set' if cursor else 'none'})")
    client = get_client()

    # Parse cursor JSON into individual RPC params
    try:
        cursor_data: dict = json.loads(cursor) if cursor else {}
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid cursor: {e}") from e
    p_cursor_created_at: str | None = cursor_data.get("created_at")
    p_cursor_id: str | None = cursor_data.get("id")
    p_cursor_is_tagged: int | None = cursor_data.get("is_tagged")
    p_cursor_min_distance: float | None = cursor_data.get("min_distance")

    result = client.rpc(
        "get_all_images_with_person_matches",
        {
            "p_threshold": person_match_threshold,
            "p_top_n": person_match_top_n,
            "p_limit": limit,
            "p_cursor_created_at": p_cursor_created_at,
            "p_cursor_id": p_cursor_id,
            "p_sort_person_id": sort_person_id,
            "p_cursor_is_tagged": p_cursor_is_tagged,
            "p_cursor_min_distance": p_cursor_min_distance,
            "p_search": search if search else None,
        },
    ).execute()

    if not isinstance(result.data, list):
        log("No data returned from RPC")
        return [], None

    rows = [ImageWithPersonMatchRow.model_validate(r) for r in result.data]
    log(f"Got {len(rows)} rows from RPC")

    # Track sort fields per image (first occurrence) for cursor building
    sort_fields_by_image: dict[str, dict] = {}
    for row in rows:
        if row.image_id not in sort_fields_by_image:
            sort_fields_by_image[row.image_id] = {
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "is_tagged": row.sort_is_tagged,
                "min_distance": row.sort_min_distance,
            }

    images = _build_image_records(rows)
    log(f"Built {len(images)} image records")

    # Determine next_cursor from the extra row (RPC fetches limit + 1 internally)
    next_cursor: str | None = None
    if len(images) > limit:
        extra = images[limit]
        extra_sort = sort_fields_by_image[extra.id]
        if sort_person_id:
            cursor_obj = {
                "id": extra.id,
                "is_tagged": extra_sort["is_tagged"],
                "min_distance": extra_sort["min_distance"],
            }
        else:
            cursor_obj = {
                "id": extra.id,
                "created_at": extra_sort["created_at"],
            }
        next_cursor = json.dumps(cursor_obj)
        images = images[:limit]

    log(
        f"Returning {len(images)} images, next_cursor={'set' if next_cursor else 'none'}"
    )
    return images, next_cursor


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


# ── Scrape job CRUD ──────────────────────────────────────────────────────────


def create_scrape_job(url: str) -> ScrapeJobRow:
    """Insert a new scrape_job row in pending status."""
    log(f"Creating scrape job for: {url[:80]}")
    client = get_client()
    result = client.table("scrape_job").insert({"url": url}).execute()
    row = ScrapeJobRow.model_validate(result.data[0])
    log(f"Scrape job created: {row.id}")
    return row


def get_scrape_jobs() -> list[ScrapeJobRow]:
    """Return all scrape jobs ordered by created_at descending."""
    log("Fetching all scrape jobs")
    client = get_client()
    result = (
        client.table("scrape_job").select("*").order("created_at", desc=True).execute()
    )
    return [ScrapeJobRow.model_validate(r) for r in result.data]


def get_scrape_job(job_id: str) -> ScrapeJobRow | None:
    """Return a single scrape_job row, or None if not found."""
    client = get_client()
    result = client.table("scrape_job").select("*").eq("id", job_id).execute()
    if not result.data:
        return None
    return ScrapeJobRow.model_validate(result.data[0])


def get_scrape_job_detail(job_id: str) -> ScrapeJobDetail | None:
    """Return a scrape job with its item rows."""
    job = get_scrape_job(job_id)
    if not job:
        return None
    client = get_client()
    items_result = (
        client.table("scrape_job_item")
        .select("*")
        .eq("job_id", job_id)
        .order("created_at")
        .execute()
    )
    items = [ScrapeJobItemRow.model_validate(r) for r in items_result.data]
    return ScrapeJobDetail(**job.model_dump(), items=items)


def update_scrape_job(update: ScrapeJobUpdate) -> None:
    """Update fields on a scrape_job row (always bumps updated_at)."""
    fields = update.model_dump(exclude_unset=True, exclude={"id"})
    fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    client = get_client()
    client.table("scrape_job").update(fields).eq("id", update.id).execute()


_ALLOWED_INCREMENT_COLUMNS = frozenset(
    {"processed_count", "skipped_count", "failed_count", "total_faces"}
)


def increment_scrape_job(job_id: str, column: str, amount: int = 1) -> None:
    """Atomically increment a counter column via the SQL RPC function."""
    if column not in _ALLOWED_INCREMENT_COLUMNS:
        raise ValueError(f"Invalid column: {column!r}")
    client = get_client()
    client.rpc(
        "increment_scrape_job",
        {"p_job_id": job_id, "p_column": column, "p_amount": amount},
    ).execute()


def bulk_insert_scrape_job_items(
    items: list[ScrapeJobItemInsert],
) -> list[ScrapeJobItemRow]:
    """Insert scrape_job_item rows and return the created rows."""
    if not items:
        return []
    client = get_client()
    rows = [item.model_dump() for item in items]
    result = client.table("scrape_job_item").insert(rows).execute()
    return [ScrapeJobItemRow.model_validate(r) for r in result.data]


def update_scrape_job_item(update: ScrapeJobItemUpdate) -> None:
    """Update fields on a scrape_job_item row."""
    fields = update.model_dump(exclude_unset=True, exclude={"id"})
    client = get_client()
    client.table("scrape_job_item").update(fields).eq("id", update.id).execute()


def get_completed_scrape_item_by_url(source_url: str) -> ScrapeJobItemRow | None:
    """Return any completed scrape_job_item for this source URL, or None.

    Used to determine if an image was previously processed to completion so
    retries can skip it rather than re-processing.
    """
    client = get_client()
    result = (
        client.table("scrape_job_item")
        .select("*")
        .eq("source_url", source_url)
        .eq("status", "completed")
        .limit(1)
        .execute()
    )
    if not result.data:
        return None
    return ScrapeJobItemRow.model_validate(result.data[0])


def get_queued_scrape_job_items(job_id: str) -> list[ScrapeJobItemRow]:
    """Return all queued items for a job, ordered by creation time."""
    client = get_client()
    result = (
        client.table("scrape_job_item")
        .select("*")
        .eq("job_id", job_id)
        .eq("status", "queued")
        .order("created_at")
        .execute()
    )
    return [ScrapeJobItemRow.model_validate(r) for r in result.data]


def reset_failed_job_items(job_id: str) -> int:
    """Reset all failed items to queued. Returns the count reset."""
    client = get_client()
    result = (
        client.table("scrape_job_item")
        .update({"status": "queued", "error": None})
        .eq("job_id", job_id)
        .eq("status", "failed")
        .execute()
    )
    return len(result.data)


def get_next_pending_job() -> ScrapeJobRow | None:
    """Return the oldest pending or retry_pending job, or None if none exist."""
    client = get_client()
    result = (
        client.table("scrape_job")
        .select("*")
        .in_("status", ["pending", "retry_pending"])
        .order("created_at")
        .limit(1)
        .execute()
    )
    if not result.data:
        return None
    return ScrapeJobRow.model_validate(result.data[0])


def delete_scrape_job(job_id: str) -> bool:
    """Delete a scrape job (cascades to items). Returns True if deleted."""
    client = get_client()
    result = client.table("scrape_job").delete().eq("id", job_id).execute()
    return len(result.data) > 0


def cleanup_stale_jobs() -> None:
    """Mark jobs stuck in scraping/processing as failed (e.g. after restart)."""
    log("Cleaning up stale scrape jobs")
    now = datetime.now(timezone.utc).isoformat()
    client = get_client()
    for status in ("scraping", "processing"):
        client.table("scrape_job").update(
            {
                "status": "failed",
                "error": "Server restarted — use Retry to resume",
                "updated_at": now,
            }
        ).eq("status", status).execute()


def cleanup_old_jobs() -> None:
    """Delete terminal jobs older than 7 days."""
    log("Cleaning up old scrape jobs (>7 days)")
    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    client = get_client()
    for status in ("completed", "failed"):
        client.table("scrape_job").delete().eq("status", status).lt(
            "created_at", cutoff
        ).execute()
