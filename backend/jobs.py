"""Background job runner for scrape jobs."""

import os
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse

from pydantic import HttpUrl

import database
import services
from models import (
    ProcessImageRequest,
    ScrapeJobItemInsert,
    ScrapeJobItemUpdate,
    ScrapeJobUpdate,
)


def log(message: str) -> None:
    """Simple logging function."""
    print(f"[jobs] {message}")


# Only one scrape job runs at a time.
_job_lock = threading.Lock()


def _process_item(item_id: str, source_url: str, job_id: str) -> None:
    """Process a single image item: skip if existing, otherwise detect and save."""
    filename = os.path.basename(urlparse(source_url).path) or f"img_{item_id[:8]}.jpg"

    database.update_scrape_job_item(
        ScrapeJobItemUpdate(id=item_id, status="processing")
    )

    try:
        # Only skip if a prior scrape item for this URL completed successfully.
        # An image row may exist from a partial failure (saved before face detection
        # finished); in that case there will be no completed item and we re-process.
        completed = database.get_completed_scrape_item_by_url(source_url)
        if completed and completed.image_id:
            database.update_scrape_job_item(
                ScrapeJobItemUpdate(
                    id=item_id, status="skipped", image_id=completed.image_id
                )
            )
            database.increment_scrape_job(job_id, "skipped_count")
            log(f"Skipped (previously completed): {source_url[:70]}")
            return

        existing = database.get_image_by_source_url(source_url)
        if existing:
            # Image was partially saved (no completed item). Re-detect and link faces.
            result = services.detect_and_link_faces(existing, source_url, filename)
        else:
            result = services.detect_and_save_face(
                ProcessImageRequest(filename=filename, source_url=HttpUrl(source_url))
            )
        database.update_scrape_job_item(
            ScrapeJobItemUpdate(
                id=item_id, status="completed", image_id=result.image_id
            )
        )
        database.increment_scrape_job(job_id, "processed_count")
        if result.face_count:
            database.increment_scrape_job(job_id, "total_faces", result.face_count)
        log(f"Processed: {source_url[:70]} ({result.face_count} faces)")

    except Exception as e:
        database.update_scrape_job_item(
            ScrapeJobItemUpdate(id=item_id, status="failed", error=str(e)[:500])
        )
        database.increment_scrape_job(job_id, "failed_count")
        log(f"Failed: {source_url[:70]} — {e}")


def _execute_job(job_id: str, is_retry: bool) -> None:
    """Core job execution (called while _job_lock is held).

    When is_retry=True, existing queued items from the previous run are reused
    directly — no re-scrape and no new item rows are inserted.  This prevents
    duplicate rows and counter accumulation on subsequent retries.
    """
    try:
        job = database.get_scrape_job(job_id)
        if not job:
            log(f"Job not found: {job_id}")
            return

        log(f"{'Retrying' if is_retry else 'Starting'} job {job_id}: {job.url}")
        database.update_scrape_job(ScrapeJobUpdate(id=job_id, status="scraping"))

        if is_retry:
            # Reuse the items that retry_scrape_job already reset to queued.
            # Do not re-scrape the URL or insert new rows.
            items = database.get_queued_scrape_job_items(job_id)
            log(f"Retry path — reusing {len(items)} queued item(s)")
            database.update_scrape_job(ScrapeJobUpdate(id=job_id, status="processing"))
        else:
            images = services.scrape_images(job.url)
            log(f"Scraped {len(images)} image URLs")

            if not images:
                database.update_scrape_job(
                    ScrapeJobUpdate(id=job_id, status="completed", total_images=0)
                )
                return

            inserts = [
                ScrapeJobItemInsert(job_id=job_id, source_url=img.src) for img in images
            ]
            items = database.bulk_insert_scrape_job_items(inserts)
            database.update_scrape_job(
                ScrapeJobUpdate(
                    id=job_id,
                    status="processing",
                    total_images=len(items),
                    preview_url=images[0].src,
                )
            )

        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = {
                executor.submit(_process_item, item.id, item.source_url, job_id): item
                for item in items
            }
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as e:
                    log(f"Unexpected worker error: {e}")

        final = database.get_scrape_job(job_id)
        if final and final.processed_count == 0 and final.skipped_count == 0:
            database.update_scrape_job(
                ScrapeJobUpdate(
                    id=job_id,
                    status="failed",
                    error="All images failed to process",
                )
            )
        else:
            database.update_scrape_job(ScrapeJobUpdate(id=job_id, status="completed"))

        log(f"Job {job_id} complete")

    except Exception as e:
        log(f"Job {job_id} failed: {e}")
        database.update_scrape_job(
            ScrapeJobUpdate(id=job_id, status="failed", error=str(e)[:500])
        )


def run_scrape_job(job_id: str, is_retry: bool = False) -> None:
    """Try to run a scrape job.

    If another job is already running (lock held), this job remains pending
    and will be picked up automatically when the current job finishes.
    """
    acquired = _job_lock.acquire(blocking=False)
    if not acquired:
        log(f"Job {job_id} queued — another job is running")
        return

    try:
        _execute_job(job_id, is_retry=is_retry)
    finally:
        _job_lock.release()

    # After releasing, pick up the next pending or retry_pending job if one exists.
    next_job = database.get_next_pending_job()
    if next_job:
        is_retry = next_job.status == "retry_pending"
        log(f"Picking up next {'retry' if is_retry else 'pending'} job: {next_job.id}")
        threading.Thread(
            target=run_scrape_job, args=(next_job.id, is_retry), daemon=True
        ).start()
