"""Backfill width/height for existing images in the database."""

import os
import sys
from io import BytesIO

import requests
from backend.models import ImageRow
from dotenv import load_dotenv
from PIL import Image
from supabase import Client, ClientOptions, create_client

load_dotenv()


def get_client() -> Client:
    """Get Supabase client."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env")
    return create_client(url, key, options=ClientOptions(schema="portfolio"))


def backfill_dimensions(dry_run: bool = False) -> None:
    """Fetch all images missing dimensions and update them."""
    client = get_client()

    # Get all images without dimensions
    result = (
        client.table("image")
        .select("id, source_url, width, height")
        .or_("width.is.null,height.is.null")
        .execute()
    )

    images = [ImageRow.model_validate(item) for item in result.data]
    print(f"Found {len(images)} images missing dimensions")

    if not images:
        print("Nothing to do!")
        return

    success_count = 0
    error_count = 0

    for i, image in enumerate(images):
        image_id = image.id
        source_url = image.source_url

        print(f"\n[{i + 1}/{len(images)}] Processing {image_id}")

        if not source_url:
            print("  Skipping - no source_url")
            continue

        try:
            # Download image
            print(f"  Downloading from {source_url[:60]}...")
            response = requests.get(source_url, timeout=30)
            response.raise_for_status()

            # Get dimensions
            pil_image = Image.open(BytesIO(response.content))
            width, height = pil_image.size
            print(f"  Dimensions: {width}x{height}")

            if dry_run:
                print(f"  [DRY RUN] Would update image {image_id}")
            else:
                # Update database
                client.table("image").update({"width": width, "height": height}).eq(
                    "id", image_id
                ).execute()
                print("  Updated!")

            success_count += 1

        except requests.RequestException as e:
            print(f"  Error downloading: {e}")
            error_count += 1
        except Exception as e:
            print(f"  Error: {e}")
            error_count += 1

    print(f"\n{'=' * 50}")
    print(f"Complete! Success: {success_count}, Errors: {error_count}")
    if dry_run:
        print("(This was a dry run - no changes were made)")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    if dry_run:
        print("Running in DRY RUN mode - no changes will be made\n")
    backfill_dimensions(dry_run=dry_run)
