#!/usr/bin/env python3
"""
compute-whitespace-embeddings.py -- Room Artifact Embedding Pipeline
=====================================================================
Embeds all room artifacts using BAAI/llm-embedder (768-dim) with
all-MiniLM-L6-v2 (384-dim) as Tier 0 fallback. Produces cached
embedding vectors for downstream whitespace detection, novelty scoring,
and TopicForest gap analysis.

This is the foundation all downstream whitespace phases depend on --
room artifacts must exist as comparable vectors before gap detection,
novelty scoring, or TopicForest can run.

Usage:
    python3 scripts/compute-whitespace-embeddings.py /path/to/room [--model MODEL] [--output PATH]

Models:
    BAAI/llm-embedder  -- Primary (768-dim, SemNovel-validated, ~440MB download)
    all-MiniLM-L6-v2   -- Fallback (384-dim, lightweight, ~80MB)

Output:
    {room_dir}/.mindrian/whitespace-embeddings.json

Per D-03: This script re-embeds room artifacts with llm-embedder.
It does NOT reuse MiniLM embeddings from HSI. The whitespace pipeline
has its own cache.
"""

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# --- Guarded imports ---

try:
    import numpy as np
except ImportError:
    print(
        "Whitespace embeddings require numpy. Run: pip install -r requirements-whitespace.txt",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    from sklearn.metrics.pairwise import cosine_similarity  # noqa: F401 -- available for downstream
except ImportError:
    print(
        "Whitespace embeddings require scikit-learn. Run: pip install -r requirements-whitespace.txt",
        file=sys.stderr,
    )
    sys.exit(1)


# --- Constants (same as compute-hsi.py) ---

SKIP_FILES = {"STATE.md", "ROOM.md", "MINTO.md"}
SKIP_DIRS = {".lazygraph", ".git", "node_modules", ".mindrian"}

# Model configuration
PRIMARY_MODEL = "BAAI/llm-embedder"
FALLBACK_MODEL = "all-MiniLM-L6-v2"
PRIMARY_DIM = 768
FALLBACK_DIM = 384


# --- Helper functions (mirroring compute-hsi.py) ---


def extract_title(content, filepath):
    """Extract title from first # heading."""
    match = re.search(r"^# (.+)$", content, re.MULTILINE)
    if match:
        return match.group(1).strip()
    return Path(filepath).stem.replace("-", " ").title()


def extract_body(content):
    """Extract body text after frontmatter --- block."""
    fm_match = re.match(r"^---\n[\s\S]*?\n---\n?", content)
    if fm_match:
        return content[fm_match.end() :]
    return content


def discover_artifacts(room_dir):
    """Walk room_dir for .md files, build artifact list.

    Mirrors compute-hsi.py logic exactly:
    - Skips STATE.md, ROOM.md, MINTO.md
    - Skips .lazygraph, .git, node_modules, .mindrian directories
    - Skips root-level files (no section)
    - Skips artifacts with body < 50 chars
    """
    artifacts = []
    room_path = Path(room_dir).resolve()

    for root, dirs, files in os.walk(room_path):
        # Filter out skip dirs
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

        rel_root = Path(root).relative_to(room_path)
        # Skip root-level files (no section)
        if str(rel_root) == ".":
            continue

        section = str(rel_root).split(os.sep)[0]

        for fname in sorted(files):
            if not fname.endswith(".md"):
                continue
            if fname in SKIP_FILES:
                continue

            fpath = Path(root) / fname
            try:
                content = fpath.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue

            artifact_id = str(Path(rel_root) / Path(fname).stem).replace(os.sep, "/")
            title = extract_title(content, fpath)
            body = extract_body(content)

            if len(body.strip()) < 50:
                continue  # skip near-empty artifacts

            artifacts.append(
                {
                    "id": artifact_id,
                    "section": section,
                    "title": title,
                    "path": str(fpath.relative_to(room_path)),
                    "text": body.strip(),
                }
            )

    return artifacts


def compute_content_hashes(artifacts):
    """Compute MD5 hash (first 12 chars) of each artifact's text content."""
    hashes = {}
    for art in artifacts:
        h = hashlib.md5(art["text"].encode("utf-8")).hexdigest()[:12]
        hashes[art["id"]] = h
    return hashes


def check_embedding_cache(output_path, current_hashes, model_name):
    """Check if output JSON exists AND hashes match AND model matches.

    Returns True if all conditions met (cache hit), False otherwise.
    Cache is invalidated if:
    - Output file doesn't exist
    - Content hashes differ (artifacts changed)
    - Model name differs (model switched between runs)
    """
    out = Path(output_path)
    if not out.exists():
        return False
    try:
        cached = json.loads(out.read_text(encoding="utf-8"))
        metadata = cached.get("metadata", {})

        # Check model match (per D-11)
        if metadata.get("model_name") != model_name:
            return False

        # Check content hashes
        cached_hashes = metadata.get("content_hashes", {})
        if set(cached_hashes.keys()) != set(current_hashes.keys()):
            return False
        return all(cached_hashes.get(k) == v for k, v in current_hashes.items())
    except (json.JSONDecodeError, OSError):
        return False


def load_embedding_model(model_override=None):
    """Load embedding model with llm-embedder primary, MiniLM fallback.

    Per D-01: BAAI/llm-embedder is primary (768-dim, SemNovel-validated).
    Per D-02: all-MiniLM-L6-v2 is fallback for Tier 0.
    Per D-04: Print download warning on first llm-embedder load (~440MB).

    Args:
        model_override: Force a specific model name. If None, auto-detect.

    Returns:
        (model, model_name, model_dim) tuple.
    """
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        print(
            "Whitespace embeddings require sentence-transformers. "
            "Run: pip install -r requirements-whitespace.txt",
            file=sys.stderr,
        )
        sys.exit(1)

    if model_override:
        # User explicitly chose a model
        print(f"Loading model: {model_override}...", file=sys.stderr)
        model = SentenceTransformer(model_override)
        dim = model.get_sentence_embedding_dimension()
        return model, model_override, dim

    # Auto-detect: try llm-embedder first, fall back to MiniLM
    try:
        # Check if model is already cached (avoid download warning for cached models)
        cache_dir = Path.home() / ".cache" / "huggingface" / "hub"
        model_cache = cache_dir / f"models--BAAI--llm-embedder"
        if not model_cache.exists():
            print(
                "Downloading embedding model (440MB, one-time)...",
                file=sys.stderr,
            )

        model = SentenceTransformer(PRIMARY_MODEL)
        dim = model.get_sentence_embedding_dimension()
        print(f"Loaded {PRIMARY_MODEL} ({dim}-dim)", file=sys.stderr)
        return model, PRIMARY_MODEL, dim

    except Exception as e:
        print(
            f"llm-embedder unavailable ({e}), falling back to {FALLBACK_MODEL}",
            file=sys.stderr,
        )
        model = SentenceTransformer(FALLBACK_MODEL)
        dim = model.get_sentence_embedding_dimension()
        print(f"Loaded {FALLBACK_MODEL} ({dim}-dim)", file=sys.stderr)
        return model, FALLBACK_MODEL, dim


def embed_artifacts(model, artifacts):
    """Encode all artifact texts, return list of vectors as Python lists.

    Returns vectors as plain Python lists (not numpy arrays) for JSON
    serialization.
    """
    texts = [a["text"] for a in artifacts]
    embeddings = model.encode(texts, show_progress_bar=False)
    # Convert numpy arrays to Python lists for JSON serialization
    return [emb.tolist() for emb in embeddings]


def verify_baseline_compatibility(room_dir):
    """Verify room artifact embeddings are cosine-comparable with Brain baseline.

    Loads both whitespace-embeddings.json and brain-baseline.json, checks
    dimensional compatibility, and computes a sample cosine similarity to
    confirm vectors are in the same semantic space.

    Exits 0 on success, 1 on failure.
    """
    ws_path = room_dir / ".mindrian" / "whitespace-embeddings.json"
    bl_path = room_dir / ".mindrian" / "brain-baseline.json"

    # Check files exist
    if not ws_path.exists():
        print(f"FAIL: Room embeddings not found: {ws_path}", file=sys.stderr)
        sys.exit(1)

    if not bl_path.exists():
        print(f"FAIL: Brain baseline not found: {bl_path}", file=sys.stderr)
        sys.exit(1)

    # Load both files
    try:
        ws_data = json.loads(ws_path.read_text(encoding="utf-8"))
        bl_data = json.loads(bl_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        print(f"FAIL: Could not read embedding files: {e}", file=sys.stderr)
        sys.exit(1)

    ws_meta = ws_data.get("metadata", {})
    bl_meta = bl_data.get("metadata", {})

    ws_dim = ws_meta.get("model_dim", 0)
    bl_dim = bl_meta.get("model_dim", 0)
    ws_model = ws_meta.get("model_name", "unknown")
    bl_model = bl_meta.get("model_name", "unknown")

    ws_embeddings = ws_data.get("embeddings", [])
    bl_baselines = bl_data.get("baselines", [])

    n_artifacts = len(ws_embeddings)
    n_baselines = len(bl_baselines)

    print(f"Room artifacts:  {n_artifacts} embeddings ({ws_model}, {ws_dim}-dim)")
    print(f"Brain baselines: {n_baselines} embeddings ({bl_model}, {bl_dim}-dim)")

    # Check dimensionality match
    if ws_dim != bl_dim:
        print(
            f"\nFAIL: Dimension mismatch! Room={ws_dim}d, Brain={bl_dim}d. "
            f"Re-embed with matching model.",
            file=sys.stderr,
        )
        sys.exit(1)

    # Check model match (warning only -- MiniLM fallback is valid)
    if ws_model != bl_model:
        print(
            f"\nWARNING: Model mismatch (room={ws_model}, brain={bl_model}). "
            f"Vectors may still be comparable if dimensions match.",
            file=sys.stderr,
        )

    # Verify we have vectors to compare
    if n_artifacts == 0 or n_baselines == 0:
        print(
            f"\nWARNING: Cannot compute cosine similarity -- "
            f"{'no room artifacts' if n_artifacts == 0 else 'no brain baselines'}.",
            file=sys.stderr,
        )
        print(f"\nVerified: {n_artifacts} room artifacts + {n_baselines} Brain baselines "
              f"({ws_dim}d) = dimensionally compatible (no vectors to compare)")
        return

    # Compute sample cosine similarity
    sample_artifact = np.array(ws_embeddings[0]["vector"]).reshape(1, -1)
    sample_baseline = np.array(bl_baselines[0]["vector"]).reshape(1, -1)

    similarity = cosine_similarity(sample_artifact, sample_baseline)[0][0]

    print(f"\nSample cosine similarity: {similarity:.4f}")
    print(f"  Room artifact: '{ws_embeddings[0].get('title', ws_embeddings[0].get('id', 'unknown'))}'")
    print(f"  Brain baseline: '{bl_baselines[0].get('name', 'unknown')}'")
    print(f"\nVerified: {n_artifacts} room artifacts ({ws_dim}d) + "
          f"{n_baselines} Brain baselines ({bl_dim}d) = cosine-comparable")


def main():
    parser = argparse.ArgumentParser(
        description="Embed room artifacts for whitespace detection pipeline"
    )
    parser.add_argument("room_dir", help="Path to room directory")
    parser.add_argument(
        "--model",
        default=None,
        help="Override embedding model (default: auto-detect llm-embedder, fallback MiniLM)",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Output JSON path (default: {room_dir}/.mindrian/whitespace-embeddings.json)",
    )
    parser.add_argument(
        "--verify-baseline",
        action="store_true",
        default=False,
        help="Verify room artifact embeddings are cosine-comparable with Brain baseline embeddings",
    )

    args = parser.parse_args()
    room_dir = Path(args.room_dir).resolve()

    if not room_dir.is_dir():
        print(f"Error: {room_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    # --- Verify baseline mode ---
    if args.verify_baseline:
        verify_baseline_compatibility(room_dir)
        sys.exit(0)

    # Determine output path (per D-09: room/.mindrian/whitespace-embeddings.json)
    if args.output:
        output_path = Path(args.output).resolve()
    else:
        output_path = room_dir / ".mindrian" / "whitespace-embeddings.json"

    # Step 1: Discover artifacts
    artifacts = discover_artifacts(room_dir)

    if len(artifacts) < 2:
        # Same minimum as compute-hsi.py
        result = {
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "model_name": "none",
                "model_dim": 0,
                "artifact_count": len(artifacts),
                "content_hashes": {},
            },
            "embeddings": [],
        }
        # Create .mindrian/ dir if needed
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(
            f"Whitespace: {len(artifacts)} artifacts found (minimum 2 required), wrote empty results",
            file=sys.stderr,
        )
        sys.exit(0)

    # Step 2: Compute content hashes
    content_hashes = compute_content_hashes(artifacts)

    # Step 3: Determine which model will be used (for cache check)
    # We need to know the model name before checking cache
    model_name_for_cache = args.model or PRIMARY_MODEL

    # Step 4: Check cache
    if check_embedding_cache(output_path, content_hashes, model_name_for_cache):
        print("Whitespace: all artifacts unchanged (cache hit), skipping computation", file=sys.stderr)
        sys.exit(0)

    # Also check fallback model cache if primary was specified
    if not args.model and check_embedding_cache(output_path, content_hashes, FALLBACK_MODEL):
        # If fallback cache exists but we might upgrade to primary, re-embed
        print("Whitespace: model upgrade available, re-embedding...", file=sys.stderr)

    # Step 5: Load embedding model
    model, model_name, model_dim = load_embedding_model(args.model)

    # Step 6: Embed all artifacts
    print(f"Whitespace: embedding {len(artifacts)} artifacts with {model_name}...", file=sys.stderr)
    vectors = embed_artifacts(model, artifacts)

    # Step 7: Build output (per plan output format)
    result = {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "model_name": model_name,
            "model_dim": model_dim,
            "artifact_count": len(artifacts),
            "content_hashes": content_hashes,
        },
        "embeddings": [
            {
                "id": art["id"],
                "section": art["section"],
                "title": art["title"],
                "path": art["path"],
                "vector": vec,
            }
            for art, vec in zip(artifacts, vectors)
        ],
    }

    # Create .mindrian/ directory if it doesn't exist
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2), encoding="utf-8")

    print(
        f"Whitespace: embedded {len(artifacts)} artifacts ({model_name}, {model_dim}-dim) -> {output_path}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
