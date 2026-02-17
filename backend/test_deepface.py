"""
DeepFace Model Benchmark Script

Tests different DeepFace recognition models against reference images,
including both positive matches and negative (non-match) samples.

Usage:
    python test_deepface.py --person mia --test-image test_images/test/mia_test1.jpg
    python test_deepface.py --person mia --test-image test_images/test/mia_test1.jpg --negatives test_images/others

Folder structure:
    test_images/
    ├── jane/               # Reference photos of Jane (positives)
    │   ├── ref1.jpg
    │   └── ref2.jpg
    ├── others/            # Photos of NOT Jane (negatives)
    │   ├── john1.jpg
    │   └── jane1.jpg
    └── test/
        └── jane_test1.jpg
"""

import argparse
import time
from pathlib import Path

from deepface import DeepFace

# Available recognition models in DeepFace
MODELS = [
    "VGG-Face",
    "Facenet",
    "Facenet512",
    "OpenFace",
    "DeepID",
    "ArcFace",
    "SFace",
    "GhostFaceNet",
]

# Using RetinaFace as the detector (best accuracy)
DETECTOR = "retinaface"

# Supported image extensions
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def get_images_from_dir(directory: Path) -> list[Path]:
    """Get all image files from a directory."""
    images = []
    for ext in IMAGE_EXTENSIONS:
        images.extend(directory.glob(f"*{ext}"))
        images.extend(directory.glob(f"*{ext.upper()}"))
    return sorted(images)


def verify_image(
    model_name: str,
    test_image: Path,
    reference_images: list[Path],
) -> dict:
    """
    Verify a single test image against all reference images.

    Returns dict with:
        - verified: True if ANY reference matched
        - min_distance: lowest distance across all references
        - distances: all distances
        - time: total time taken
        - errors: any errors encountered
    """
    results = {
        "verified": False,
        "min_distance": float("inf"),
        "distances": [],
        "threshold": None,
        "time": 0,
        "errors": [],
    }

    start = time.time()
    for ref_image in reference_images:
        try:
            result = DeepFace.verify(
                img1_path=str(test_image),
                img2_path=str(ref_image),
                model_name=model_name,
                detector_backend=DETECTOR,
                enforce_detection=True,
            )

            results["distances"].append(result["distance"])
            results["threshold"] = result["threshold"]

            if result["distance"] < results["min_distance"]:
                results["min_distance"] = result["distance"]

            if result["verified"]:
                results["verified"] = True

        except Exception as e:
            results["errors"].append(f"{ref_image.name}: {str(e)}")

    results["time"] = time.time() - start
    return results


def test_model(
    model_name: str,
    positive_image: Path,
    negative_images: list[Path],
    reference_images: list[Path],
) -> dict:
    """
    Test a single model with positive and negative samples.

    Returns metrics including TP, FP, TN, FN, precision, recall, F1.
    """
    results = {
        "model": model_name,
        "threshold": None,
        # Positive test (should match)
        "positive_verified": False,
        "positive_distance": None,
        "positive_time": 0,
        # Negative tests (should NOT match)
        "true_negatives": 0,  # correctly rejected
        "false_positives": 0,  # incorrectly matched
        "negative_distances": [],
        "negative_times": [],
        # Errors
        "errors": [],
    }

    # Test positive sample
    print("    Testing positive sample...")
    pos_result = verify_image(model_name, positive_image, reference_images)
    results["positive_verified"] = pos_result["verified"]
    results["positive_distance"] = pos_result["min_distance"]
    results["positive_time"] = pos_result["time"]
    results["threshold"] = pos_result["threshold"]
    results["errors"].extend(pos_result["errors"])

    # Test negative samples
    if negative_images:
        print(f"    Testing {len(negative_images)} negative sample(s)...")
        for neg_image in negative_images:
            neg_result = verify_image(model_name, neg_image, reference_images)
            results["negative_times"].append(neg_result["time"])
            results["errors"].extend(neg_result["errors"])

            if neg_result["min_distance"] != float("inf"):
                results["negative_distances"].append(neg_result["min_distance"])

            if neg_result["verified"]:
                results["false_positives"] += 1
            else:
                results["true_negatives"] += 1

    return results


def calculate_metrics(results: dict) -> dict:
    """Calculate precision, recall, F1 from test results."""
    # TP = positive correctly verified
    # FN = positive incorrectly rejected
    # FP = negative incorrectly verified
    # TN = negative correctly rejected

    tp = 1 if results["positive_verified"] else 0
    fn = 0 if results["positive_verified"] else 1
    fp = results["false_positives"]
    tn = results["true_negatives"]

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = (
        2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
    )

    return {
        "tp": tp,
        "fn": fn,
        "fp": fp,
        "tn": tn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }


def print_results(
    all_results: list[dict],
    test_image: str,
    person: str,
    has_negatives: bool,
):
    """Print results as a formatted table."""
    print("\n" + "=" * 100)
    print("DeepFace Model Benchmark Results")
    print(f"Test image (positive): {test_image}")
    print(f"Person: {person}")
    print("=" * 100)

    if has_negatives:
        # Full table with metrics
        header = (
            f"{'Model':<15} | {'Pos Match':<10} | {'Pos Dist':<10} | "
            f"{'FP':<4} | {'TN':<4} | {'Precision':<10} | {'Recall':<10} | {'F1':<10}"
        )
    else:
        # Simple table without negative metrics
        header = (
            f"{'Model':<15} | {'Matched':<10} | {'Distance':<10} | "
            f"{'Threshold':<10} | {'Time':<10}"
        )

    print(header)
    print("-" * 100)

    # Sort by F1 score (if negatives) or by positive match + distance
    if has_negatives:
        sorted_results = sorted(
            all_results,
            key=lambda x: -calculate_metrics(x)["f1"],
        )
    else:
        sorted_results = sorted(
            all_results,
            key=lambda x: (
                -int(x["positive_verified"]),
                x["positive_distance"] if x["positive_distance"] else 999,
            ),
        )

    for r in sorted_results:
        pos_match = "YES" if r["positive_verified"] else "NO"
        pos_dist = (
            f"{r['positive_distance']:.4f}"
            if r["positive_distance"] and r["positive_distance"] != float("inf")
            else "N/A"
        )
        threshold = f"{r['threshold']:.4f}" if r["threshold"] else "N/A"

        if has_negatives:
            metrics = calculate_metrics(r)
            print(
                f"{r['model']:<15} | {pos_match:<10} | {pos_dist:<10} | "
                f"{metrics['fp']:<4} | {metrics['tn']:<4} | "
                f"{metrics['precision']:<10.2%} | {metrics['recall']:<10.2%} | {metrics['f1']:<10.2%}"
            )
        else:
            time_str = f"{r['positive_time']:.2f}s"
            print(
                f"{r['model']:<15} | {pos_match:<10} | {pos_dist:<10} | "
                f"{threshold:<10} | {time_str:<10}"
            )

        # Print errors if any
        for error in r["errors"][:3]:  # Limit to first 3 errors
            print(f"  └─ Error: {error}")
        if len(r["errors"]) > 3:
            print(f"  └─ ... and {len(r['errors']) - 3} more errors")

    print("=" * 100)

    # Summary
    if has_negatives:
        best = sorted_results[0] if sorted_results else None
        if best:
            metrics = calculate_metrics(best)
            print(f"\nBest performing model: {best['model']}")
            print(f"  - F1 Score: {metrics['f1']:.2%}")
            print(f"  - Precision: {metrics['precision']:.2%} (FP={metrics['fp']})")
            print(f"  - Recall: {metrics['recall']:.2%}")
            if best["positive_distance"] and best["positive_distance"] != float("inf"):
                print(f"  - Positive distance: {best['positive_distance']:.4f}")
            if best["negative_distances"]:
                print(
                    f"  - Min negative distance: {min(best['negative_distances']):.4f}"
                )
    else:
        best = sorted_results[0] if sorted_results else None
        if best and best["positive_verified"]:
            print(f"\nBest performing model: {best['model']}")
            if best["positive_distance"] and best["positive_distance"] != float("inf"):
                print(f"  - Distance: {best['positive_distance']:.4f}")
            print(f"  - Threshold: {best['threshold']:.4f}")


def main():
    parser = argparse.ArgumentParser(
        description="Benchmark DeepFace recognition models"
    )
    parser.add_argument(
        "--person",
        required=True,
        help="Name of the person (matches folder name in test_images/)",
    )
    parser.add_argument(
        "--test-image",
        required=True,
        help="Path to the test image to verify (positive sample)",
    )
    parser.add_argument(
        "--negatives",
        help="Directory containing negative samples (images of OTHER people)",
    )
    parser.add_argument(
        "--images-dir",
        default="test_images",
        help="Base directory for reference images (default: test_images)",
    )
    parser.add_argument(
        "--models",
        nargs="+",
        default=MODELS,
        help=f"Models to test (default: all). Available: {', '.join(MODELS)}",
    )

    args = parser.parse_args()

    # Validate paths
    test_image = Path(args.test_image)
    if not test_image.exists():
        print(f"Error: Test image not found: {test_image}")
        return 1

    person_dir = Path(args.images_dir) / args.person
    if not person_dir.exists():
        print(f"Error: Person directory not found: {person_dir}")
        return 1

    reference_images = get_images_from_dir(person_dir)
    if not reference_images:
        print(f"Error: No reference images found in {person_dir}")
        return 1

    # Load negative samples if provided
    negative_images = []
    if args.negatives:
        negatives_dir = Path(args.negatives)
        if not negatives_dir.exists():
            print(f"Error: Negatives directory not found: {negatives_dir}")
            return 1
        negative_images = get_images_from_dir(negatives_dir)
        if not negative_images:
            print(f"Warning: No negative images found in {negatives_dir}")

    print(f"Reference images for '{args.person}': {len(reference_images)}")
    for img in reference_images:
        print(f"  + {img.name}")

    if negative_images:
        print(f"\nNegative samples (should NOT match): {len(negative_images)}")
        for img in negative_images[:5]:
            print(f"  - {img.name}")
        if len(negative_images) > 5:
            print(f"  ... and {len(negative_images) - 5} more")

    print(f"\nPositive test image: {test_image.name}")

    # Test each model
    all_results = []
    for model in args.models:
        print(f"\nTesting model: {model}...")
        try:
            result = test_model(model, test_image, negative_images, reference_images)
            all_results.append(result)

            status = "MATCH" if result["positive_verified"] else "NO MATCH"
            dist = (
                f"{result['positive_distance']:.4f}"
                if result["positive_distance"]
                and result["positive_distance"] != float("inf")
                else "N/A"
            )
            print(f"  Positive: {status} (dist={dist})")
            if negative_images:
                print(
                    f"  Negatives: TN={result['true_negatives']}, FP={result['false_positives']}"
                )

        except Exception as e:
            print(f"  Error loading model: {e}")
            all_results.append(
                {
                    "model": model,
                    "threshold": None,
                    "positive_verified": False,
                    "positive_distance": None,
                    "positive_time": 0,
                    "true_negatives": 0,
                    "false_positives": 0,
                    "negative_distances": [],
                    "negative_times": [],
                    "errors": [str(e)],
                }
            )

    # Print summary table
    print_results(all_results, str(test_image), args.person, bool(negative_images))

    return 0


if __name__ == "__main__":
    exit(main())
