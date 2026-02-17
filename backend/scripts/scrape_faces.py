#!/usr/bin/env python3
"""
Scrape images from a URL and process them for face detection.

Usage:
    python scrape_faces.py https://example.com/photos
    python scrape_faces.py https://example.com/photos --start 0 --end 50
    python scrape_faces.py https://example.com/photos --workers 4
"""

import argparse
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
from urllib.parse import urlparse

from backend.models import ProcessImageRequest

import services

# Thread-safe counters
_print_lock = Lock()


def _process_single_image(args: tuple) -> tuple[str, str, int | None, int]:
    """Process a single image. Returns (filename, status, face_count, index).

    status is one of: "processed", "skipped", "failed"
    """
    index, image = args
    parsed = urlparse(image["src"])
    filename = os.path.basename(parsed.path) or f"image_{index}.jpg"

    try:
        result = services.detect_and_save_face(
            ProcessImageRequest(
                filename=filename,
                source_url=image["src"],
            )
        )
        return (filename, "processed", len(result.faces), index)

    except services.ImageExistsError:
        return (filename, "skipped", None, index)

    except Exception:
        return (filename, "failed", None, index)


def scrape_and_process(
    url: str, start: int = 0, end: int | None = None, workers: int = 1
):
    """Scrape images from URL and process them for face detection.

    Args:
        url: URL to scrape images from
        start: Start index (inclusive)
        end: End index (exclusive), or None for all remaining
        workers: Number of parallel workers (default: 1)
    """
    print(f"Scraping images from: {url}")
    images = services.scrape_images(url)
    print(f"Found {len(images)} total images")

    # Apply slice
    selected = images[start:end]
    print(f"Processing images [{start}:{end}] ({len(selected)} images)")
    print(f"Using {workers} worker(s)\n")

    processed = 0
    skipped = 0
    failed = 0

    # Prepare work items with global indices
    work_items = [(start + i, img) for i, img in enumerate(selected)]

    if workers == 1:
        # Sequential processing (original behavior)
        for item in work_items:
            filename, status, face_count, index = _process_single_image(item)
            if status == "processed":
                print(f"  [{index}] {filename}: {face_count} face(s)")
                processed += 1
            elif status == "skipped":
                print(f"  [{index}] {filename}: already exists, skipping")
                skipped += 1
            else:
                print(f"  [{index}] {filename}: {status}")
                failed += 1
    else:
        # Parallel processing
        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {
                executor.submit(_process_single_image, item): item
                for item in work_items
            }

            for future in as_completed(futures):
                filename, status, face_count, index = future.result()

                with _print_lock:
                    if status == "processed":
                        print(f"  [{index}] {filename}: {face_count} face(s)")
                        processed += 1
                    elif status == "skipped":
                        print(f"  [{index}] {filename}: already exists, skipping")
                        skipped += 1
                    else:
                        print(f"  [{index}] {filename}: {status}")
                        failed += 1

    print(f"\nDone: {processed} processed, {skipped} skipped, {failed} failed")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Scrape images from a URL and process them for face detection"
    )
    parser.add_argument("url", help="URL to scrape images from")
    parser.add_argument("--start", type=int, default=0, help="Start index (default: 0)")
    parser.add_argument(
        "--end", type=int, default=None, help="End index (default: all)"
    )
    parser.add_argument(
        "--workers",
        "-w",
        type=int,
        default=1,
        help="Number of parallel workers (default: 1)",
    )

    args = parser.parse_args()
    scrape_and_process(args.url, args.start, args.end, args.workers)
