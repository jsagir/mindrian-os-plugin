#!/usr/bin/env python3
"""
compute-element-novelty.py -- Per-Artifact Novelty via Embedding Distance
==========================================================================
Computes novelty for each artifact as its cosine distance from the room
centroid. Optionally extracts top novel elements (TF-IDF terms) when
sentence-transformers is available and artifact count is manageable.

Usage:
    python3 scripts/compute-element-novelty.py /path/to/room [--output PATH]

Output:
    {room_dir}/.mindrian/element-novelty.json

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
        "Element novelty requires numpy. Run: pip install numpy",
        file=sys.stderr,
    )
    sys.exit(1)

# Optional: sklearn for TF-IDF element extraction
_sklearn_available = False
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    _sklearn_available = True
except ImportError:
    pass

# Optional: sentence-transformers for element-level embedding
_st_available = False
try:
    from sentence_transformers import SentenceTransformer
    _st_available = True
except ImportError:
    pass


# --- Constants ---

SKIP_FILES = {"STATE.md", "ROOM.md", "MINTO.md", "WHITESPACE.md"}
SKIP_DIRS = {".lazygraph", ".git", "node_modules", ".mindrian"}


# --- Core functions ---


def cosine_similarity(a, b):
    """Cosine similarity between two vectors."""
    dot = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot / (norm_a * norm_b))


def extract_top_tfidf_terms(texts, artifact_ids, top_n=5):
    """Extract top TF-IDF terms per artifact.

    Returns dict mapping artifact_id -> list of (term, tfidf_score) tuples.
    """
    if not _sklearn_available or not texts:
        return {}

    vectorizer = TfidfVectorizer(stop_words="english", max_features=1000)
    try:
        tfidf_matrix = vectorizer.fit_transform(texts)
    except ValueError:
        return {}

    feature_names = vectorizer.get_feature_names_out()
    result = {}
    for i, aid in enumerate(artifact_ids):
        row = tfidf_matrix[i].toarray().flatten()
        top_indices = row.argsort()[-top_n:][::-1]
        result[aid] = [
            (str(feature_names[idx]), round(float(row[idx]), 4))
            for idx in top_indices
            if row[idx] > 0
        ]

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Per-artifact novelty via embedding distance from room centroid"
    )
    parser.add_argument("room_dir", help="Path to room directory")
    parser.add_argument(
        "--output",
        default=None,
        help="Output JSON path (default: {room_dir}/.mindrian/element-novelty.json)",
    )

    args = parser.parse_args()
    room_dir = Path(args.room_dir).resolve()

    if not room_dir.is_dir():
        print(f"Error: {room_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    if args.output:
        output_path = Path(args.output).resolve()
    else:
        output_path = room_dir / ".mindrian" / "element-novelty.json"

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
            "artifacts": [],
        }
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(f"Novelty: {len(embeddings)} artifacts (minimum 2 required), wrote empty results", file=sys.stderr)
        sys.exit(0)

    # Build vector matrix and compute centroid
    vectors = np.array([entry["vector"] for entry in embeddings])
    centroid = vectors.mean(axis=0)
    n = len(vectors)

    # Per-artifact novelty = 1 - cosine_similarity(vector, centroid)
    artifact_results = []
    for i in range(n):
        novelty = 1.0 - cosine_similarity(vectors[i], centroid)
        artifact_results.append({
            "artifact_id": embeddings[i]["id"],
            "section": embeddings[i].get("section", ""),
            "title": embeddings[i].get("title", ""),
            "novelty": round(float(novelty), 6),
        })

    # Sort by novelty descending
    artifact_results.sort(key=lambda a: a["novelty"], reverse=True)

    # Optional: element-level novelty via TF-IDF + embedding
    element_novelty = {}
    if _st_available and _sklearn_available and n < 50:
        print("Novelty: computing element-level novelty (sentence-transformers available, <50 artifacts)...", file=sys.stderr)

        # Read artifact texts for TF-IDF
        artifact_texts = []
        artifact_ids = []
        for entry in embeddings:
            fpath = room_dir / entry.get("path", "")
            if fpath.exists():
                try:
                    content = fpath.read_text(encoding="utf-8")
                    # Strip frontmatter
                    fm_match = __import__("re").match(r"^---\n[\s\S]*?\n---\n?", content)
                    body = content[fm_match.end():] if fm_match else content
                    artifact_texts.append(body.strip())
                    artifact_ids.append(entry["id"])
                except (OSError, UnicodeDecodeError):
                    continue

        # Extract top TF-IDF terms per artifact
        tfidf_terms = extract_top_tfidf_terms(artifact_texts, artifact_ids)

        if tfidf_terms:
            # Embed terms and score against centroid
            model_name = data.get("metadata", {}).get("model_name", "all-MiniLM-L6-v2")
            try:
                model = SentenceTransformer(model_name)
                for aid, terms in tfidf_terms.items():
                    if not terms:
                        continue
                    term_texts = [t[0] for t in terms]
                    term_vectors = model.encode(term_texts, show_progress_bar=False)
                    novel_elements = []
                    for j, (term, tfidf_score) in enumerate(terms):
                        term_novelty = 1.0 - cosine_similarity(term_vectors[j], centroid)
                        novel_elements.append({
                            "term": term,
                            "tfidf_score": tfidf_score,
                            "novelty": round(float(term_novelty), 4),
                        })
                    novel_elements.sort(key=lambda e: e["novelty"], reverse=True)
                    element_novelty[aid] = novel_elements[:5]
            except Exception as e:
                print(f"Novelty: element-level embedding failed ({e}), skipping", file=sys.stderr)

    # Attach element novelty to results
    if element_novelty:
        for art in artifact_results:
            if art["artifact_id"] in element_novelty:
                art["top_novel_elements"] = element_novelty[art["artifact_id"]]

    # Room-level stats
    novelty_values = [a["novelty"] for a in artifact_results]

    result = {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "artifact_count": n,
            "model_name": data.get("metadata", {}).get("model_name", "unknown"),
            "element_level": bool(element_novelty),
            "mean_novelty": round(float(np.mean(novelty_values)), 4),
            "max_novelty": round(float(np.max(novelty_values)), 4),
            "min_novelty": round(float(np.min(novelty_values)), 4),
        },
        "artifacts": artifact_results,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2), encoding="utf-8")

    print(
        f"Novelty: {n} artifacts, mean={np.mean(novelty_values):.4f}, "
        f"max={np.max(novelty_values):.4f}, element_level={bool(element_novelty)} -> {output_path}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
