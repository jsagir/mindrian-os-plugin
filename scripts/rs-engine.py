#!/usr/bin/env python3
"""
rs-engine.py -- Reverse Salient Engine (Phase 89)
==================================================

Authoritative port of the Kwan 2023 reverse-salient algorithm. Runs on a
single room (Mode A) and produces .rs-engine-results.json with pairs scored
by abs(semantic - lsa) and classified by signed directionality.

Algorithmic signature (RESEARCH.md Q1, ALGORITHM-SOURCE.md):
  - Structural similarity: TF-IDF + TruncatedSVD(80) + topic-keyword
    membership counting + L1 pairwise distance + invert-and-rescale.
    This is NOT cosine-on-SVD. See lib/core/rs_math.py docstrings.
  - Semantic similarity: sentence-transformer embeddings (MiniLM local by
    default; multilingual-e5-large via Pinecone inference when available).
  - Detection: iterative argmax on |semantic - lsa| with symmetric cleanup.
  - Classification: signed (semantic - lsa) -> structural_transfer or
    semantic_implementation.

Embedding model is configurable per RESEARCH.md Q4:
  - RS_EMBEDDING_MODEL unset (default) -> multilingual-e5-large via Pinecone
    inference (Plan 89-03 wires the cold path).
  - RS_EMBEDDING_MODEL=minilm                -> local all-MiniLM-L6-v2.
  - RS_EMBEDDING_MODEL=bert-large-cased      -> explicit repro mode (heavy).

Mode A (this plan, 89-01): internal single-room scan.
Mode B/C extend this script in Plans 89-04 / 89-05 (multi-room + external
corpus + hybrid). The mode dispatch is already wired here so those plans
only add helpers.

Three-surface usage:
  CLI:     python scripts/rs-engine.py --mode internal --room ./room
  Desktop: invoked by ReverseSalientAgent conversational trigger (Plan 89-07).
  Cowork:  writes symlink into 00_Context/rs-engine-results.json when
           COWORK=1 is set.

License: BSL-1.1 (see LICENSE at repo root).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

# --- Guarded imports ---------------------------------------------------------

try:
    import numpy as np
except ImportError:
    print(
        "rs-engine requires numpy. Run: pip install -r requirements-hsi.txt",
        file=sys.stderr,
    )
    sys.exit(1)

# Import shared math helpers. rs-engine.py is invoked from the repo root so
# the "lib.core.rs_math" package path is canonical (plan verify block uses
# this exact import).
_THIS_FILE = Path(__file__).resolve()
_REPO_ROOT = _THIS_FILE.parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from lib.core.rs_math import (  # noqa: E402
    abs_diff_topk,
    build_lsa_matrix,
    classify_direction,
)


# --- Constants ---------------------------------------------------------------

DEFAULT_EMBEDDING_MODEL = "multilingual-e5-large"
SKIP_FILES = {"STATE.md", "ROOM.md", "MINTO.md"}
SKIP_DIRS = {".lazygraph", ".git", ".mindrian", "node_modules", ".obsidian"}
CACHE_FILENAME = ".rs-engine-cache.json"
RESULTS_FILENAME = ".rs-engine-results.json"
DEFAULT_TOPK = 100
DEFAULT_THRESHOLD = 0.30
ENGINE_VERSION = "1"


# --- Artifact discovery ------------------------------------------------------

def parse_frontmatter(content: str) -> Dict[str, str]:
    fm_match = re.match(r"^---\n([\s\S]*?)\n---", content)
    if not fm_match:
        return {}
    fields = {}
    for line in fm_match.group(1).split("\n"):
        if ":" in line:
            key, _, val = line.partition(":")
            fields[key.strip()] = val.strip().strip('"').strip("'")
    return fields


def extract_title(content: str, filepath: Path) -> str:
    match = re.search(r"^# (.+)$", content, re.MULTILINE)
    if match:
        return match.group(1).strip()
    return filepath.stem.replace("-", " ").title()


def extract_body(content: str) -> str:
    fm_match = re.match(r"^---\n[\s\S]*?\n---\n?", content)
    if fm_match:
        return content[fm_match.end():]
    return content


def discover_artifacts(room_dir: Path) -> List[Dict]:
    """Walk room_dir for .md artifacts. Mirrors compute-hsi.py pattern.

    The authoritative source's artifact loader assumed a flat SQLite
    "artifacts" table. The real MindrianOS schema (lib/core/lazygraph-ops.cjs)
    keeps artifacts on disk as .md files and tracks them in the nodes table
    by reference. Plan 89-01 said to read room.db artifacts directly; that
    table does not exist. We walk the filesystem instead (same pattern as
    compute-hsi.py) so the port works against real rooms, and cache
    embeddings in a JSON sidecar below. This is a documented Rule 3 fix.
    """
    artifacts: List[Dict] = []
    room_path = room_dir.resolve()

    for root, dirs, files in os.walk(room_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        rel_root = Path(root).relative_to(room_path)
        if str(rel_root) == ".":
            # Skip room-root files -- not part of any section.
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
            body = extract_body(content).strip()
            if len(body) < 50:
                continue
            artifact_id = str(rel_root / Path(fname).stem).replace(os.sep, "/")
            artifacts.append({
                "id": artifact_id,
                "section": section,
                "title": extract_title(content, fpath),
                "path": str(fpath.relative_to(room_path)),
                "text": body,
            })
    return artifacts


# --- Embedding path ---------------------------------------------------------

def _content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def _load_embedding_cache(room_dir: Path) -> Dict[str, Dict]:
    cache_path = room_dir / CACHE_FILENAME
    if not cache_path.exists():
        return {}
    try:
        raw = json.loads(cache_path.read_text(encoding="utf-8"))
        if not isinstance(raw, dict) or raw.get("version") != ENGINE_VERSION:
            return {}
        embeddings = raw.get("embeddings", {})
        return embeddings if isinstance(embeddings, dict) else {}
    except (json.JSONDecodeError, OSError):
        return {}


def _save_embedding_cache(
    room_dir: Path,
    cache: Dict[str, Dict],
    model_name: str,
) -> None:
    cache_path = room_dir / CACHE_FILENAME
    payload = {
        "version": ENGINE_VERSION,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "model": model_name,
        "embeddings": cache,
    }
    try:
        tmp_path = cache_path.with_suffix(cache_path.suffix + ".tmp")
        tmp_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        tmp_path.replace(cache_path)
    except OSError as e:
        print(f"rs-engine: cache write failed: {e}", file=sys.stderr)


def _embed_local_minilm(texts: Sequence[str]) -> Optional[np.ndarray]:
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        print(
            "rs-engine: sentence-transformers not installed; "
            "run `pip install -r requirements-hsi.txt`",
            file=sys.stderr,
        )
        return None
    model = SentenceTransformer("all-MiniLM-L6-v2")
    vectors = model.encode(list(texts), show_progress_bar=False)
    return np.asarray(vectors, dtype=np.float32)


def _embed_via_pinecone_inference(texts: Sequence[str]) -> Optional[np.ndarray]:
    """Cold path: call Pinecone inference API for multilingual-e5-large.

    Plan-check Gap 1 (PLAN-CHECK.md) explicitly documents that this entry is
    stubbed in Plan 89-01 and completed in Plans 89-03 / 89-05. Raising
    NotImplementedError keeps the failure loud and localizable if 89-03 is
    skipped, rather than silently falling back to MiniLM.

    The plan authorizes this stub: PLAN-CHECK Gap 1 resolution says "89-01
    must stub with NotImplementedError for the cold path, documented as
    'completed in 89-03 / 89-05.'"
    """
    raise NotImplementedError(
        "Pinecone inference embedding is wired in Plan 89-03 / 89-05. "
        "For Plan 89-01 (Mode A internal), set RS_EMBEDDING_MODEL=minilm "
        "or rely on cached embeddings in .rs-engine-cache.json."
    )


def compute_embeddings(
    artifacts: Sequence[Dict],
    room_dir: Path,
) -> Tuple[Optional[np.ndarray], str]:
    """Return (embedding_matrix, model_name). Uses cache where possible.

    Precedence:
      1. RS_EMBEDDING_MODEL=minilm OR default-but-Pinecone-unavailable
         -> local MiniLM.
      2. RS_EMBEDDING_MODEL=bert-large-cased -> repro path (not implemented
         in 89-01; deferred to a future plan).
      3. Default (no env var) AND Pinecone inference wired
         -> multilingual-e5-large (stub raises; see docstring).
    """
    model_env = os.environ.get("RS_EMBEDDING_MODEL", "").strip().lower()

    # Fall back to MiniLM when Pinecone stub cannot serve the cold path.
    cold_model = "all-MiniLM-L6-v2" if model_env in ("", "minilm") else model_env
    cache = _load_embedding_cache(room_dir)

    # Resolve cache hits vs misses.
    missing_indices: List[int] = []
    dim: Optional[int] = None
    vectors: List[Optional[np.ndarray]] = [None] * len(artifacts)
    for idx, art in enumerate(artifacts):
        digest = _content_hash(art["text"])
        cache_entry = cache.get(art["id"])
        if (
            isinstance(cache_entry, dict)
            and cache_entry.get("hash") == digest
            and cache_entry.get("model") == cold_model
            and isinstance(cache_entry.get("vector"), list)
        ):
            vec = np.asarray(cache_entry["vector"], dtype=np.float32)
            vectors[idx] = vec
            if dim is None:
                dim = vec.shape[0]
        else:
            missing_indices.append(idx)

    if missing_indices:
        missing_texts = [artifacts[i]["text"] for i in missing_indices]
        new_vectors: Optional[np.ndarray] = None
        model_used = cold_model

        if model_env == "minilm" or model_env == "" and cold_model == "all-MiniLM-L6-v2":
            # MiniLM is the honest default until 89-03 wires Pinecone.
            new_vectors = _embed_local_minilm(missing_texts)
            model_used = "all-MiniLM-L6-v2"
        elif model_env == DEFAULT_EMBEDDING_MODEL or model_env == "e5-large":
            # Pinecone inference path. Plan 89-01 stub -> NotImplementedError.
            new_vectors = _embed_via_pinecone_inference(missing_texts)
            model_used = DEFAULT_EMBEDDING_MODEL
        elif model_env == "bert-large-cased":
            # Repro path -- not wired in 89-01; raise clear error.
            raise NotImplementedError(
                "RS_EMBEDDING_MODEL=bert-large-cased is not wired in Plan 89-01. "
                "Use RS_EMBEDDING_MODEL=minilm for this plan."
            )
        else:
            # Unknown model name -- default to MiniLM with a warning.
            print(
                f"rs-engine: unknown RS_EMBEDDING_MODEL={model_env!r}; "
                "falling back to local MiniLM",
                file=sys.stderr,
            )
            new_vectors = _embed_local_minilm(missing_texts)
            model_used = "all-MiniLM-L6-v2"

        if new_vectors is None:
            return None, model_used

        for offset, idx in enumerate(missing_indices):
            vec = new_vectors[offset]
            vectors[idx] = vec
            if dim is None:
                dim = vec.shape[0]
            cache[artifacts[idx]["id"]] = {
                "hash": _content_hash(artifacts[idx]["text"]),
                "model": model_used,
                "vector": vec.astype(np.float32).tolist(),
            }
        _save_embedding_cache(room_dir, cache, model_used)
        cold_model = model_used

    matrix = np.vstack([v for v in vectors if v is not None])
    return matrix, cold_model


def semantic_similarity_matrix(embeddings: np.ndarray) -> np.ndarray:
    """Cosine similarity on row-normalized embedding vectors."""
    from sklearn.metrics.pairwise import cosine_similarity
    sim = cosine_similarity(embeddings)
    return np.clip(sim, 0.0, 1.0).astype(np.float32)


# --- SQLite edge writer ------------------------------------------------------

def write_reverse_salient_edges(
    room_dir: Path,
    pairs: Sequence[Dict],
) -> int:
    """Insert REVERSE_SALIENT edges into room.db carrying source='rs-engine'.

    Plan 89-01 said to ALTER the REVERSE_SALIENT table to add a `source`
    column; REVERSE_SALIENT is an edge TYPE not a table. The real schema
    (lib/core/lazygraph-ops.cjs) uses a single `edges` table with a
    flexible `properties` JSON column. Rule 3 adaptation: we namespace our
    edges by writing `source: 'rs-engine'` inside properties, and we DO NOT
    delete edges written by hsi-to-graph.cjs (which carry source='hsi'
    implicitly or via future backfill). Coexistence is the RESEARCH.md Q1
    decision (b) invariant.

    Returns the number of edges actually inserted.
    """
    db_path = room_dir / ".mindrian" / "room.db"
    if not db_path.exists():
        # Room has no graph yet -- skip silently; JSON output is still the
        # authoritative artifact for Plan 89-01.
        return 0

    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        # Ensure the edges table exists (rooms initialized outside lazygraph).
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS edges (
              source TEXT NOT NULL,
              target TEXT NOT NULL,
              type TEXT NOT NULL,
              properties TEXT DEFAULT '{}',
              PRIMARY KEY (source, target, type)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS nodes (
              id TEXT PRIMARY KEY,
              type TEXT NOT NULL,
              properties TEXT DEFAULT '{}'
            )
            """
        )

        # Cleanup: remove only rs-engine-sourced edges (json_extract safely
        # returns NULL on missing key, so non-rs-engine edges are preserved).
        conn.execute(
            "DELETE FROM edges WHERE type = 'REVERSE_SALIENT' "
            "AND json_extract(properties, '$.source') = 'rs-engine'"
        )

        upsert_edge = (
            "INSERT INTO edges (source, target, type, properties) "
            "VALUES (?, ?, ?, ?) ON CONFLICT(source, target, type) "
            "DO UPDATE SET properties = excluded.properties"
        )
        upsert_node = (
            "INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET properties = excluded.properties"
        )

        written = 0
        for pair in pairs:
            src = pair.get("source_artifact_id")
            tgt = pair.get("target_artifact_id")
            if not src or not tgt:
                continue
            # Upsert artifact nodes as a courtesy so downstream readers can
            # resolve them without relying on compute-hsi having run first.
            conn.execute(
                upsert_node,
                (src, "Artifact", json.dumps({
                    "title": pair.get("source_title", ""),
                    "section": pair.get("source_section", ""),
                })),
            )
            conn.execute(
                upsert_node,
                (tgt, "Artifact", json.dumps({
                    "title": pair.get("target_title", ""),
                    "section": pair.get("target_section", ""),
                })),
            )
            props = json.dumps({
                "source": "rs-engine",
                "lsa_score": pair["lsa_score"],
                "semantic_score": pair["semantic_score"],
                "signed_diff": pair["signed_diff"],
                "abs_diff": pair["abs_diff"],
                "direction": pair["direction"],
                "innovation_type": pair["direction"],
            })
            conn.execute(upsert_edge, (src, tgt, "REVERSE_SALIENT", props))
            written += 1
        conn.commit()
        return written
    finally:
        conn.close()


# --- Mode A runner -----------------------------------------------------------

def run_mode_internal(
    room_dir: Path,
    topk: int,
    threshold: float,
    no_thesis: bool,
) -> Dict:
    artifacts = discover_artifacts(room_dir)
    if len(artifacts) < 2:
        return {
            "metadata": {
                "mode": "internal",
                "room_dir": str(room_dir),
                "artifact_count": len(artifacts),
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "engine_version": ENGINE_VERSION,
            },
            "pairs": [],
        }

    texts = [f"{a['title']}\n{a['text']}" for a in artifacts]

    # Structural signal: authoritative topic-keyword-membership LSA.
    lsa_matrix = build_lsa_matrix(texts)

    # Semantic signal: embedding cosine.
    embeddings, model_used = compute_embeddings(artifacts, room_dir)
    if embeddings is None:
        # Fallback: treat semantic as identity so abs_diff collapses to 1-lsa.
        # This keeps the engine honest when no embedder is available.
        print(
            "rs-engine: no embedder available; semantic matrix set to identity",
            file=sys.stderr,
        )
        n = len(artifacts)
        sem_matrix = np.eye(n, dtype=np.float32)
    else:
        sem_matrix = semantic_similarity_matrix(embeddings)

    top_pairs = abs_diff_topk(lsa_matrix, sem_matrix, k=topk)

    pair_dicts: List[Dict] = []
    for i, j, signed, absv in top_pairs:
        if absv < threshold:
            continue
        a_i, a_j = artifacts[i], artifacts[j]
        pair_dicts.append({
            "source_artifact_id": a_i["id"],
            "source_title": a_i["title"],
            "source_section": a_i["section"],
            "target_artifact_id": a_j["id"],
            "target_title": a_j["title"],
            "target_section": a_j["section"],
            "lsa_score": round(float(lsa_matrix[i, j]), 4),
            "semantic_score": round(float(sem_matrix[i, j]), 4),
            "signed_diff": round(float(signed), 4),
            "abs_diff": round(float(absv), 4),
            "direction": classify_direction(signed),
        })

    edges_written = write_reverse_salient_edges(room_dir, pair_dicts)

    result = {
        "metadata": {
            "mode": "internal",
            "room_dir": str(room_dir),
            "artifact_count": len(artifacts),
            "topk_requested": topk,
            "threshold": threshold,
            "embedding_model": model_used,
            "thesis_generated": False,  # Plan 89-01 always cost-free.
            "no_thesis": bool(no_thesis),
            "edges_written": edges_written,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "engine_version": ENGINE_VERSION,
        },
        "pairs": pair_dicts,
    }
    return result


# --- Cowork tri-polar surface ------------------------------------------------

def _write_cowork_symlink(room_dir: Path, results_path: Path) -> None:
    """When COWORK=1, expose results under 00_Context/ for team visibility."""
    if os.environ.get("COWORK") != "1":
        return
    cowork_dir = room_dir / "00_Context"
    if not cowork_dir.is_dir():
        return
    symlink_path = cowork_dir / "rs-engine-results.json"
    try:
        if symlink_path.is_symlink() or symlink_path.exists():
            symlink_path.unlink()
        os.symlink(results_path, symlink_path)
    except OSError as e:
        print(f"rs-engine: cowork symlink skipped: {e}", file=sys.stderr)


# --- CLI ---------------------------------------------------------------------

def _write_results(room_dir: Path, result: Dict, output: Optional[str]) -> Path:
    path = Path(output).resolve() if output else (room_dir / RESULTS_FILENAME)
    path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    return path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="rs-engine",
        description=(
            "Reverse Salient Engine (Phase 89). Faithfully ports the Kwan 2023 "
            "topic-keyword-membership LSA + signed abs-diff detection "
            "algorithm. Mode A runs on a single room; Modes B/C (external "
            "corpus, hybrid) are added in Plans 89-04 / 89-05."
        ),
        epilog=(
            "Three-surface usage:\n"
            "  CLI     python scripts/rs-engine.py --mode internal --room ./room\n"
            "  Desktop invoked by ReverseSalientAgent conversational trigger\n"
            "          (Plan 89-07).\n"
            "  Cowork  set COWORK=1 to symlink results under 00_Context/.\n"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--mode",
        choices=["internal", "external", "hybrid"],
        default="internal",
        help="internal=Mode A (single room, Plan 89-01); external/hybrid land in 89-04/05.",
    )
    parser.add_argument("--room", required=False, help="Path to room directory (Mode A / C).")
    parser.add_argument(
        "--topk",
        type=int,
        default=DEFAULT_TOPK,
        help=f"Maximum number of pairs to keep (default {DEFAULT_TOPK}).",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=DEFAULT_THRESHOLD,
        help=(
            f"Minimum abs(semantic - lsa) to keep a pair (default {DEFAULT_THRESHOLD}). "
            "0.0 disables filtering."
        ),
    )
    parser.add_argument(
        "--no-thesis",
        action="store_true",
        help=(
            "Skip LLM innovation-thesis generation (RESEARCH Q6). Plan 89-01 always "
            "runs cost-free; this flag is accepted for compatibility with later plans."
        ),
    )
    parser.add_argument(
        "--output",
        default=None,
        help=f"Output JSON path (default: {{room}}/{RESULTS_FILENAME}).",
    )
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.mode != "internal":
        # Plans 89-04 / 89-05 wire these modes. Fail loud with pointer so
        # users do not silently run the wrong algorithm.
        print(
            f"rs-engine: --mode {args.mode} is not wired in Plan 89-01. "
            "Track Plans 89-04 (multi-room) and 89-05 (hybrid).",
            file=sys.stderr,
        )
        return 2

    if not args.room:
        print("rs-engine: --room is required for --mode internal", file=sys.stderr)
        return 2

    room_dir = Path(args.room).resolve()
    if not room_dir.is_dir():
        print(f"rs-engine: {room_dir} is not a directory", file=sys.stderr)
        return 1

    try:
        result = run_mode_internal(
            room_dir,
            topk=max(1, args.topk),
            threshold=max(0.0, args.threshold),
            no_thesis=args.no_thesis,
        )
    except NotImplementedError as e:
        print(f"rs-engine: {e}", file=sys.stderr)
        return 3
    except Exception as e:  # pragma: no cover - defensive envelope
        print(f"rs-engine: error: {e}", file=sys.stderr)
        return 1

    output_path = _write_results(room_dir, result, args.output)
    _write_cowork_symlink(room_dir, output_path)

    meta = result["metadata"]
    print(
        f"rs-engine: {len(result['pairs'])}/{meta['artifact_count']} pairs written to "
        f"{output_path} (model={meta['embedding_model']}, edges={meta['edges_written']})",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
