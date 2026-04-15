#!/usr/bin/env python3
"""
fetch-brain-baseline.py -- Brain Baseline Embedding Pipeline
=============================================================
Reads pre-fetched Brain framework descriptions (JSON from
fetch-brain-baseline.cjs), embeds them with the same model used
for room artifacts, and caches as brain-baseline.json.

The Brain baseline is the "semantic universe" against which room
artifacts are compared. Without it, there is no novelty scoring
or whitespace detection -- you need a baseline to measure distance FROM.

Usage:
    python3 scripts/fetch-brain-baseline.py --input brain-data.json --room /path/to/room [--model auto] [--output path]

Input JSON format (from fetch-brain-baseline.cjs / Brain MCP query):
{
  "frameworks": [
    {"name": "Design Thinking", "description": "A human-centered...", "category": "Design"},
    ...
  ]
}

Output:
    {room_dir}/.mindrian/brain-baseline.json

Per D-06: Cache at room/.mindrian/brain-baseline.json
Per D-07: Refresh when Brain version changes (hash of input JSON)
Per D-11: Include model version and timestamp
"""

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# Auto-install Python ML deps if missing (v1.10.9, plan 85-10, LAWRENCE-001)
sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
from ensure_ml_deps import ensure
ensure(["numpy", "scikit-learn", "sentence-transformers"])

# --- Guarded imports ---

try:
    import numpy as np  # noqa: F401
except ImportError:
    print(
        "Brain baseline requires numpy. Run: pip install -r requirements-whitespace.txt",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    from sklearn.metrics.pairwise import cosine_similarity  # noqa: F401
except ImportError:
    print(
        "Brain baseline requires scikit-learn. Run: pip install -r requirements-whitespace.txt",
        file=sys.stderr,
    )
    sys.exit(1)


# --- Model configuration (same as compute-whitespace-embeddings.py) ---

PRIMARY_MODEL = "BAAI/llm-embedder"
FALLBACK_MODEL = "all-MiniLM-L6-v2"

# Minimum description length to include (per D-05: filter to methodology-relevant)
MIN_DESCRIPTION_LENGTH = 20


def load_brain_data(input_path):
    """Load Brain framework descriptions from input JSON file.

    Args:
        input_path: Path to JSON file with {"frameworks": [...]} structure.

    Returns:
        List of framework dicts with name, description, category.
    """
    input_file = Path(input_path)
    if not input_file.exists():
        print(f"Error: Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    try:
        data = json.loads(input_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in {input_path}: {e}", file=sys.stderr)
        sys.exit(1)

    frameworks = data.get("frameworks", [])

    # Filter to methodology-relevant subset (per D-05)
    filtered = [
        f
        for f in frameworks
        if f.get("description", "")
        and len(f["description"].strip()) > MIN_DESCRIPTION_LENGTH
    ]

    print(
        f"Brain baseline: {len(filtered)} frameworks "
        f"(filtered from {len(frameworks)}, min {MIN_DESCRIPTION_LENGTH} chars)",
        file=sys.stderr,
    )

    return filtered


def compute_brain_hash(input_path):
    """Compute hash of input JSON for cache invalidation (per D-07).

    Uses MD5 of file content to detect when Brain data has changed.
    """
    content = Path(input_path).read_bytes()
    return hashlib.md5(content).hexdigest()[:16]


def check_baseline_cache(output_path, framework_count, model_name, brain_version):
    """Check if brain-baseline.json cache is still valid.

    Cache is valid when:
    - Output file exists
    - Framework count matches
    - Model name matches
    - Brain version hash matches (per D-07)
    """
    out = Path(output_path)
    if not out.exists():
        return False
    try:
        cached = json.loads(out.read_text(encoding="utf-8"))
        metadata = cached.get("metadata", {})

        if metadata.get("model_name") != model_name:
            return False
        if metadata.get("framework_count") != framework_count:
            return False
        if metadata.get("brain_version") != brain_version:
            return False

        return True
    except (json.JSONDecodeError, OSError):
        return False


def load_embedding_model(model_override=None, room_dir=None):
    """Load embedding model, ensuring consistency with room artifact embeddings.

    Critical: model_name and model_dim MUST match what
    compute-whitespace-embeddings.py uses. If room artifacts were embedded
    with llm-embedder (768d), Brain baseline must also use llm-embedder (768d).

    If room_dir is provided and whitespace-embeddings.json exists, reads the
    model_name from there to ensure consistency.

    Args:
        model_override: Force a specific model name. If None, auto-detect.
        room_dir: Path to room directory (for model consistency check).

    Returns:
        (model, model_name, model_dim) tuple.
    """
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        print(
            "Brain baseline requires sentence-transformers. "
            "Run: pip install -r requirements-whitespace.txt",
            file=sys.stderr,
        )
        sys.exit(1)

    # If no override, check what model room artifacts used
    if not model_override and room_dir:
        ws_path = Path(room_dir) / ".mindrian" / "whitespace-embeddings.json"
        if ws_path.exists():
            try:
                ws_data = json.loads(ws_path.read_text(encoding="utf-8"))
                room_model = ws_data.get("metadata", {}).get("model_name")
                if room_model and room_model != "none":
                    print(
                        f"Brain baseline: matching room model: {room_model}",
                        file=sys.stderr,
                    )
                    model_override = room_model
            except (json.JSONDecodeError, OSError):
                pass

    if model_override:
        print(f"Loading model: {model_override}...", file=sys.stderr)
        model = SentenceTransformer(model_override)
        dim = model.get_sentence_embedding_dimension()
        return model, model_override, dim

    # Auto-detect: try llm-embedder first, fall back to MiniLM
    try:
        cache_dir = Path.home() / ".cache" / "huggingface" / "hub"
        model_cache = cache_dir / "models--BAAI--llm-embedder"
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


def embed_baselines(model, frameworks):
    """Embed framework descriptions, return list of vectors as Python lists.

    Args:
        model: SentenceTransformer model instance.
        frameworks: List of framework dicts with 'description' field.

    Returns:
        List of vectors (Python lists) for JSON serialization.
    """
    texts = [f["description"] for f in frameworks]
    embeddings = model.encode(texts, show_progress_bar=False)
    return [emb.tolist() for emb in embeddings]


def main():
    parser = argparse.ArgumentParser(
        description="Embed Brain framework descriptions for whitespace baseline"
    )
    parser.add_argument(
        "--input",
        required=True,
        help="Path to Brain JSON file (from fetch-brain-baseline.cjs or MCP query)",
    )
    parser.add_argument(
        "--room",
        required=True,
        help="Path to room directory (for output and model consistency)",
    )
    parser.add_argument(
        "--model",
        default=None,
        help="Override embedding model (default: match room artifacts or auto-detect)",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Output JSON path (default: {room}/.mindrian/brain-baseline.json)",
    )

    args = parser.parse_args()
    room_dir = Path(args.room).resolve()

    if not room_dir.is_dir():
        print(f"Error: {room_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    # Determine output path (per D-10)
    if args.output:
        output_path = Path(args.output).resolve()
    else:
        output_path = room_dir / ".mindrian" / "brain-baseline.json"

    # Step 1: Load Brain data from input JSON
    frameworks = load_brain_data(args.input)

    if len(frameworks) == 0:
        result = {
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "model_name": "none",
                "model_dim": 0,
                "framework_count": 0,
                "source": "brain-mcp",
                "brain_version": "empty",
            },
            "baselines": [],
        }
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(
            "Brain baseline: 0 frameworks found, wrote empty baseline",
            file=sys.stderr,
        )
        sys.exit(0)

    # Step 2: Compute brain version hash (per D-07)
    brain_version = compute_brain_hash(args.input)

    # Step 3: Determine model for cache check
    model_name_for_cache = args.model or PRIMARY_MODEL

    # Step 4: Check cache
    if check_baseline_cache(
        output_path, len(frameworks), model_name_for_cache, brain_version
    ):
        print(
            "Brain baseline: cache valid (same frameworks, model, brain version), skipping",
            file=sys.stderr,
        )
        sys.exit(0)

    # Step 5: Load embedding model (match room artifacts per D-03)
    model, model_name, model_dim = load_embedding_model(args.model, room_dir)

    # Step 6: Embed all framework descriptions
    print(
        f"Brain baseline: embedding {len(frameworks)} frameworks with {model_name}...",
        file=sys.stderr,
    )
    vectors = embed_baselines(model, frameworks)

    # Step 7: Build output
    result = {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "model_name": model_name,
            "model_dim": model_dim,
            "framework_count": len(frameworks),
            "source": "brain-mcp",
            "brain_version": brain_version,
        },
        "baselines": [
            {
                "name": fw["name"],
                "description": fw["description"],
                "category": fw.get("category", ""),
                "vector": vec,
            }
            for fw, vec in zip(frameworks, vectors)
        ],
    }

    # Create .mindrian/ directory if needed
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2), encoding="utf-8")

    print(
        f"Brain baseline: embedded {len(frameworks)} frameworks "
        f"({model_name}, {model_dim}-dim) -> {output_path}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
