#!/usr/bin/env python3
"""
compute-bayesian-surprise.py -- Leave-One-Out Cosine Shift per Artifact
========================================================================
Computes Bayesian surprise by measuring how much the room centroid shifts
when each artifact is removed. High surprise = artifact pulls the centroid
significantly, indicating unique or divergent content.

Usage:
    python3 scripts/compute-bayesian-surprise.py /path/to/room [--output PATH]

Output:
    {room_dir}/.mindrian/surprise-scores.json

Requires: whitespace-embeddings.json (run compute-whitespace-embeddings.py first)
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# --- Guarded imports ---

try:
    import numpy as np
except ImportError:
    print(
        "Bayesian surprise requires numpy. Run: pip install numpy",
        file=sys.stderr,
    )
    sys.exit(1)


# --- Core functions ---


def cosine_similarity(a, b):
    """Cosine similarity between two vectors."""
    dot = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot / (norm_a * norm_b))


def main():
    parser = argparse.ArgumentParser(
        description="Leave-one-out cosine shift (Bayesian surprise) per artifact"
    )
    parser.add_argument("room_dir", help="Path to room directory")
    parser.add_argument(
        "--output",
        default=None,
        help="Output JSON path (default: {room_dir}/.mindrian/surprise-scores.json)",
    )

    args = parser.parse_args()
    room_dir = Path(args.room_dir).resolve()

    if not room_dir.is_dir():
        print(f"Error: {room_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    if args.output:
        output_path = Path(args.output).resolve()
    else:
        output_path = room_dir / ".mindrian" / "surprise-scores.json"

    # Load embeddings
    emb_path = room_dir / ".mindrian" / "whitespace-embeddings.json"
    if not emb_path.exists():
        print(f"Error: {emb_path} not found. Run compute-whitespace-embeddings.py first.", file=sys.stderr)
        sys.exit(1)

    try:
        data = json.loads(emb_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        print(f"Error reading embeddings: {e}", file=sys.stderr)
        sys.exit(1)

    embeddings = data.get("embeddings", [])
    if len(embeddings) < 2:
        result = {
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "artifact_count": len(embeddings),
                "note": "minimum 2 artifacts required",
            },
            "scores": [],
            "latest_filing": None,
        }
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(f"Surprise: {len(embeddings)} artifacts (minimum 2 required), wrote empty results", file=sys.stderr)
        sys.exit(0)

    # Build vector matrix
    vectors = np.array([entry["vector"] for entry in embeddings])
    n = len(vectors)

    # Full centroid
    full_centroid = vectors.mean(axis=0)

    # Leave-one-out surprise per artifact
    scores = []
    for i in range(n):
        loo_vectors = np.delete(vectors, i, axis=0)
        loo_centroid = loo_vectors.mean(axis=0)
        surprise = 1.0 - cosine_similarity(full_centroid, loo_centroid)
        scores.append({
            "artifact_id": embeddings[i]["id"],
            "section": embeddings[i].get("section", ""),
            "title": embeddings[i].get("title", ""),
            "surprise": round(float(surprise), 6),
        })

    # Sort by surprise descending
    scores.sort(key=lambda s: s["surprise"], reverse=True)

    # Latest filing surprise (most recently modified file)
    latest_filing = None
    latest_mtime = 0.0
    for entry in embeddings:
        fpath = room_dir / entry.get("path", "")
        if fpath.exists():
            mtime = fpath.stat().st_mtime
            if mtime > latest_mtime:
                latest_mtime = mtime
                latest_filing = entry["id"]

    latest_surprise = None
    if latest_filing:
        for s in scores:
            if s["artifact_id"] == latest_filing:
                latest_surprise = {
                    "artifact_id": latest_filing,
                    "surprise": s["surprise"],
                }
                break

    result = {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "artifact_count": n,
            "model_name": data.get("metadata", {}).get("model_name", "unknown"),
        },
        "scores": scores,
        "latest_filing": latest_surprise,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2), encoding="utf-8")

    top = scores[0] if scores else None
    print(
        f"Surprise: {n} artifacts scored, top={top['artifact_id']} ({top['surprise']:.6f})"
        if top else f"Surprise: no artifacts scored",
        file=sys.stderr,
    )
    if latest_surprise:
        print(f"  Latest filing: {latest_surprise['artifact_id']} (surprise={latest_surprise['surprise']:.6f})", file=sys.stderr)
    print(f"  Output: {output_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
