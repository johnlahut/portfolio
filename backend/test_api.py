import os
from pathlib import Path
from urllib.parse import urlparse

from pydantic import HttpUrl
from supabase import PostgrestAPIError

import services

# import face_recognition
from models import ProcessImageRequest

IMAGES_DIR = Path(__file__).parent / "test_images"


def test_scrape(url: str):
    print("\n--- Testing scrape_images ---")
    print(f"URL: {url}")

    images = services.scrape_images(url)

    print(f"Found {len(images)} images")
    for img in images[:5]:
        print(f"  - {img.src[:80]}...")

    return images


def test_detect_faces_from_url(url: str):
    print("\n--- Testing detect_faces ---")
    print(f"Image: {url}")

    faces = services.detect_faces_from_url(url)

    print(f"Found {len(faces)} faces")
    for face in faces:
        print(
            f"  - top={face.location_top}, right={face.location_right}, bottom={face.location_bottom}, left={face.location_left}"
        )

    return faces


def test_detect_faces_local(image_path: str):
    print("\n--- Testing detect_faces ---")
    print(f"Image: {image_path}")

    result = services.detect_and_tag_faces(image_path)

    print(f"Found {len(result['faces'])} faces")
    for face in result["faces"]:
        print(
            f"  - top={face['top']}, right={face['right']}, bottom={face['bottom']}, left={face['left']}"
        )

    return result


if __name__ == "__main__":
    images = services.scrape_images("https://threelittlebirdsjc.wordpress.com/2026/01/")
    for image in images[100:150]:
        parsed = urlparse(image.src)
        try:
            result = services.detect_and_save_face(
                ProcessImageRequest(
                    filename=os.path.basename(parsed.path),
                    source_url=HttpUrl(image.src),
                )
            )
        except PostgrestAPIError as e:
            if e.code == "23505":
                print(f"Image {image.src} already exists in database, skipping.")
                continue
