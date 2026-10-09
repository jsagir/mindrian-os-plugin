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
                                                     [--chunk-words N] [--no-chunking] [--claims]
                                                     [--retry-primary] [--verify-baseline]

Models:
    BAAI/llm-embedder  -- Primary (768-dim, SemNovel-validated, ~440MB download)
    all-MiniLM-L6-v2   -- Fallback (384-dim, lightweight, ~80MB)

Output:
    {room_dir}/.mindrian/whitespace-embeddings.json

Per D-03: This script re-embeds room artifacts with llm-embedder.
It does NOT reuse MiniLM embeddings from HSI. The whitespace pipeline
has its own cache.

2026 revision (output keys unchanged, metadata additive):
  - Long artifacts are embedded in word windows and mean-pooled (the models
    truncate at 256-512 word pieces, so an artifact used to be represented by
    its opening paragraphs only). --no-chunking restores one call per artifact.
  - --claims additionally stores problem and method sentence vectors per
    artifact (claim-level comparison instead of whole-document vectors).
  - The cache now works when the MiniLM fallback was the model that ran (it
    used to miss on every run) and also keys on the chunking parameters.
  - Generated WHITESPACE.md files are no longer embedded as artifacts.
  - metadata records schema_version, library versions, chunking and claim settings.
  - scikit-learn is no longer required; writes are atomic.
"""

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# Auto-install Python ML deps if missing (v1.10.9, plan 85-10, LAWRENCE-001)
sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
try:
    from ensure_ml_deps import ensure
except ImportError:
    def ensure(_packages):  # pragma: no cover - helper absent
        return None
if os.environ.get("HSI_NO_AUTO_INSTALL") != "1":
    ensure(["numpy", "scikit-learn", "sentence-transformers"])

# --- Guarded imports ---

try:
    import numpy as np
except ImportError:
    print(
        "Whitespace embeddings require numpy. Run: pip install -r requirements-whitespace.txt",
        file=sys.stderr,
    )
    sys.exit(1)



def cosine_similarity(a, b):
    """Row-wise cosine similarity matrix (numpy only; scikit-learn not needed)."""
    a = np.atleast_2d(np.asarray(a, dtype=float))
    b = np.atleast_2d(np.asarray(b, dtype=float))
    na = np.linalg.norm(a, axis=1, keepdims=True)
    nb = np.linalg.norm(b, axis=1, keepdims=True)
    na[na < 1e-12] = 1.0
    nb[nb < 1e-12] = 1.0
    return (a / na) @ (b / nb).T


# --- Constants (same as compute-hsi.py) ---

# The canonical exclude-list lives in lib/core/rs_corpus_exclude.py (compute-hsi.py
# imports it). This script kept a private copy that had drifted (no .snapshots, and
# it embedded the generated WHITESPACE.md files). Use the shared list when it is
# importable; otherwise the local fallback below.
_LIB_CORE = Path(__file__).resolve().parent.parent / "lib" / "core"
if str(_LIB_CORE) not in sys.path:
    sys.path.insert(0, str(_LIB_CORE))
try:
    from rs_corpus_exclude import SKIP_DIRS, SKIP_FILES, MIN_BODY_CHARS  # noqa: E402
except ImportError:
    SKIP_FILES = {"STATE.md", "ROOM.md", "MINTO.md"}
    SKIP_DIRS = {".lazygraph", ".git", "node_modules", ".mindrian", ".snapshots"}
    MIN_BODY_CHARS = 50
SKIP_FILES = set(SKIP_FILES) | {"WHITESPACE.md"}
SKIP_DIRS = set(SKIP_DIRS)

SCHEMA_VERSION = "2.0"
DEFAULT_CHUNK_WORDS = 200
MAX_CHUNKS = 12

# Model configuration
PRIMARY_MODEL = "BAAI/llm-embedder"
FALLBACK_MODEL = "all-MiniLM-L6-v2"
PRIMARY_DIM = 768
FALLBACK_DIM = 384


# --- Helper functions (mirroring compute-hsi.py) ---


def _pkg_version(name):
    try:
        from importlib import metadata
        return metadata.version(name)
    except Exception:  # noqa: BLE001 - best effort
        return None


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

            if len(body.strip()) < MIN_BODY_CHARS:
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


def check_embedding_cache(output_path, current_hashes, model_name, settings=None):
    """Check if output JSON exists AND hashes match AND model matches.

    Returns True if all conditions met (cache hit), False otherwise.
    Cache is invalidated if:
    - Output file doesn't exist
    - Content hashes differ (artifacts changed)
    - Model name differs (model switched between runs); model_name may be a
      collection of acceptable names (see main(): the MiniLM fallback counts)
    - settings (chunking / claims) differ from what the file was written with
    """
    out = Path(output_path)
    if not out.exists():
        return False
    try:
        cached = json.loads(out.read_text(encoding="utf-8"))
        metadata = cached.get("metadata", {})

        # Check model match (per D-11)
        accepted = {model_name} if isinstance(model_name, str) else set(model_name)
        if metadata.get("model_name") not in accepted:
            return False

        if settings is not None and metadata.get("settings") != settings:
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


def _chunk_words(text, chunk_words, max_chunks=MAX_CHUNKS):
    words = str(text or "").split()
    if not chunk_words or chunk_words <= 0 or len(words) <= chunk_words:
        return [str(text or "")]
    chunks = [" ".join(words[i:i + chunk_words]) for i in range(0, len(words), chunk_words)]
    if len(chunks) > max_chunks:
        pick = sorted(set(np.linspace(0, len(chunks) - 1, max_chunks).round().astype(int).tolist()))
        chunks = [chunks[i] for i in pick]
    return chunks


def embed_artifacts(model, artifacts, chunk_words=0):
    """Encode all artifact texts, return list of vectors as Python lists.

    Returns vectors as plain Python lists (not numpy arrays) for JSON
    serialization. With chunk_words > 0 each artifact is split into word
    windows, every window is embedded and the unit-normalised window vectors
    are averaged (then re-normalised), so text past the model's truncation
    point still contributes. chunk_words=0 is the original one-call behaviour.
    Raises ValueError when the model returns the wrong number of rows or
    non-finite values, instead of writing a corrupt cache.
    """
    texts = [a["text"] for a in artifacts]
    if not chunk_words or chunk_words <= 0:
        embeddings = np.asarray(model.encode(texts, show_progress_bar=False), dtype=float)
    else:
        flat, owner = [], []
        for i, t in enumerate(texts):
            for c in _chunk_words(t, chunk_words):
                flat.append(c)
                owner.append(i)
        raw = np.asarray(model.encode(flat, show_progress_bar=False), dtype=float)
        if raw.shape[0] != len(flat):
            raise ValueError("encoder returned %d rows for %d inputs" % (raw.shape[0], len(flat)))
        norms = np.linalg.norm(raw, axis=1, keepdims=True)
        norms[norms < 1e-12] = 1.0
        raw = raw / norms
        embeddings = np.zeros((len(texts), raw.shape[1]))
        for row, i in zip(raw, owner):
            embeddings[i] += row
        n2 = np.linalg.norm(embeddings, axis=1, keepdims=True)
        n2[n2 < 1e-12] = 1.0
        embeddings = embeddings / n2
    if embeddings.shape[0] != len(texts):
        raise ValueError("encoder returned %d rows for %d artifacts" % (embeddings.shape[0], len(texts)))
    if not np.isfinite(embeddings).all():
        raise ValueError("encoder produced non-finite values")
    return [emb.tolist() for emb in embeddings]


_PROBLEM_CUES = re.compile(
    r"\b(problem|challeng|bottleneck|gap|limitation|fail|cannot|can't|unable|barrier|pain|unmet|"
    r"obstacle|constraint|risk|issue|struggl|lack|insufficient|difficult|bleed|friction)\w*", re.I)
_METHOD_CUES = re.compile(
    r"\b(approach|method|technique|algorithm|framework|solution|solv|design|architecture|propos|"
    r"apply|applies|applied|implement|mechanism|protocol|process|pipeline|strateg|using|leverag)\w*", re.I)


def extract_claim_sentences(text, per_kind=5):
    """(problem_sentences, method_sentences): at most per_kind each, ordered by
    cue count then document order. Same rule as compute-hsi.py."""
    problems, methods = [], []
    for pos, sent in enumerate(re.split(r"(?<=[.!?])\s+|\n+", str(text or ""))):
        sent = re.sub(r"^[\s>#*\-\u2022]+", "", sent).strip()
        if not (25 <= len(sent) <= 400):
            continue
        p, m = len(_PROBLEM_CUES.findall(sent)), len(_METHOD_CUES.findall(sent))
        if p == 0 and m == 0:
            continue
        (problems if p >= m else methods).append((-(p if p >= m else m), pos, sent))
    problems.sort()
    methods.sort()
    return [x[2] for x in problems[:per_kind]], [x[2] for x in methods[:per_kind]]


def embed_claims(model, artifacts, per_kind=5):
    """One batched encode of every problem/method sentence. Returns a list
    aligned with artifacts: [{kind, sentence, vector}, ...]."""
    items = []
    for a in artifacts:
        probs, meths = extract_claim_sentences(a["text"], per_kind)
        items.append([("problem", s) for s in probs] + [("method", s) for s in meths])
    flat = sorted({s for row in items for _, s in row})
    if not flat:
        return [[] for _ in artifacts]
    vecs = np.asarray(model.encode(flat, show_progress_bar=False), dtype=float)
    if vecs.shape[0] != len(flat) or not np.isfinite(vecs).all():
        raise ValueError("encoder returned unusable claim vectors")
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    norms[norms < 1e-12] = 1.0
    vec_of = {s: (vecs[i] / norms[i]).tolist() for i, s in enumerate(flat)}
    return [[{"kind": k, "sentence": s, "vector": vec_of[s]} for k, s in row] for row in items]


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

    # Every vector must have the declared dimension and be finite (the original
    # checked only the metadata and the first vector of each file).
    bad = []
    for label, items in (("room", ws_embeddings), ("brain", bl_baselines)):
        for k, item in enumerate(items):
            vec = np.asarray(item.get("vector", []), dtype=float)
            if vec.ndim != 1 or vec.shape[0] != ws_dim or not np.isfinite(vec).all() or np.linalg.norm(vec) < 1e-12:
                bad.append("%s[%d]" % (label, k))
    if bad:
        print(f"\nFAIL: {len(bad)} unusable vector(s) (wrong dimension, non-finite or zero), first: {bad[0]}",
              file=sys.stderr)
        sys.exit(1)

    # Compute sample cosine similarity (first pair, as before) plus the spread
    # over up to 50 x 50 pairs so a degenerate space is visible.
    sample_artifact = np.array(ws_embeddings[0]["vector"]).reshape(1, -1)
    sample_baseline = np.array(bl_baselines[0]["vector"]).reshape(1, -1)

    similarity = cosine_similarity(sample_artifact, sample_baseline)[0][0]

    print(f"\nSample cosine similarity: {similarity:.4f}")
    print(f"  Room artifact: '{ws_embeddings[0].get('title', ws_embeddings[0].get('id', 'unknown'))}'")
    print(f"  Brain baseline: '{bl_baselines[0].get('name', 'unknown')}'")
    block = cosine_similarity(
        np.array([e["vector"] for e in ws_embeddings[:50]]),
        np.array([b["vector"] for b in bl_baselines[:50]]),
    )
    print(f"  Spread over {block.shape[0]}x{block.shape[1]} pairs: "
          f"min={block.min():.4f} mean={block.mean():.4f} max={block.max():.4f}")
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
        "--chunk-words",
        type=int,
        default=DEFAULT_CHUNK_WORDS,
        help="Embed artifacts in windows of N words and mean-pool (default %d; models truncate long text)"
        % DEFAULT_CHUNK_WORDS,
    )
    parser.add_argument(
        "--no-chunking",
        action="store_true",
        default=False,
        help="One encode call per artifact, truncating long artifacts (original behaviour)",
    )
    parser.add_argument(
        "--claims",
        action="store_true",
        default=False,
        help="Also store problem/method sentence vectors per artifact (claim-level comparison)",
    )
    parser.add_argument(
        "--retry-primary",
        action="store_true",
        default=False,
        help="Re-embed even if a MiniLM-fallback cache exists, to retry the primary model",
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

    # Step 3: Determine which model(s) satisfy the cache.
    # Original bug: only PRIMARY_MODEL (or --model) was accepted, so after a run
    # that fell back to MiniLM the cache never hit again and every run
    # re-embedded everything. A fallback-written cache now counts unless the
    # caller asks to retry the primary model.
    chunk_words = 0 if args.no_chunking else max(0, args.chunk_words)
    settings = {"chunk_words": chunk_words, "max_chunks": MAX_CHUNKS, "claims": bool(args.claims),
                "schema_version": SCHEMA_VERSION}
    if args.model:
        accepted_models = {args.model}
    elif args.retry_primary:
        accepted_models = {PRIMARY_MODEL}
    else:
        accepted_models = {PRIMARY_MODEL, FALLBACK_MODEL}

    # Step 4: Check cache
    if check_embedding_cache(output_path, content_hashes, accepted_models, settings):
        print("Whitespace: all artifacts unchanged (cache hit), skipping computation", file=sys.stderr)
        sys.exit(0)

    # Step 5: Load embedding model
    model, model_name, model_dim = load_embedding_model(args.model)

    # Step 6: Embed all artifacts
    print(f"Whitespace: embedding {len(artifacts)} artifacts with {model_name}...", file=sys.stderr)
    try:
        vectors = embed_artifacts(model, artifacts, chunk_words=chunk_words)
        claim_vectors = embed_claims(model, artifacts) if args.claims else None
    except ValueError as exc:
        print(f"Whitespace: embedding failed ({exc}); nothing written", file=sys.stderr)
        sys.exit(1)

    # Step 7: Build output (per plan output format)
    result = {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "model_name": model_name,
            "model_dim": model_dim,
            "artifact_count": len(artifacts),
            "content_hashes": content_hashes,
            "schema_version": SCHEMA_VERSION,
            "settings": settings,
            "provenance": {
                "script": "compute-whitespace-embeddings.py",
                "computed_at": datetime.now(timezone.utc).isoformat(),
                "model_requested": args.model or "auto (%s, fallback %s)" % (PRIMARY_MODEL, FALLBACK_MODEL),
                "model_used": model_name,
                "versions": {"python": sys.version.split()[0], "numpy": np.__version__,
                             "sentence-transformers": _pkg_version("sentence-transformers")},
            },
        },
        "embeddings": [
            dict(
                {
                    "id": art["id"],
                    "section": art["section"],
                    "title": art["title"],
                    "path": art["path"],
                    "vector": vec,
                },
                **({"claim_vectors": claim_vectors[k]} if claim_vectors is not None else {}),
            )
            for k, (art, vec) in enumerate(zip(artifacts, vectors))
        ],
    }

    # Create .mindrian/ directory if it doesn't exist; write atomically so a
    # crash cannot leave a truncated cache file that later runs trust.
    output_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = output_path.with_name(output_path.name + ".tmp-%d" % os.getpid())
    tmp_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    os.replace(str(tmp_path), str(output_path))

    print(
        f"Whitespace: embedded {len(artifacts)} artifacts ({model_name}, {model_dim}-dim) -> {output_path}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
