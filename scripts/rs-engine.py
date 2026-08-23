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
from lib.core.rs_corpus import (  # noqa: E402
    fetch_corpus,
    topic_slug,
    semantic_gate,
    SEMANTIC_FLOOR,
)
from lib.core.rs_rooms import (  # noqa: E402
    load_multi_room_corpus,
    summarize_corpus,
)
# Plan 89-05 wires Mode C (hybrid) via rs_hybrid. Import is optional at the
# top so Mode A / Mode B remain importable when rs_hybrid is missing; the
# hybrid dispatch in main() raises a clear error if the import failed.
try:
    from lib.core.rs_hybrid import (  # noqa: E402
        build_unified_corpus as _rs_hybrid_build,
        filter_cross_corpus_pairs as _rs_hybrid_filter,
    )
    _RS_HYBRID_AVAILABLE = True
except Exception as _rs_hybrid_import_err:  # pragma: no cover -- defensive
    _RS_HYBRID_AVAILABLE = False
    _rs_hybrid_import_err_msg = str(_rs_hybrid_import_err)
# Plan 89-03 wires the Pinecone rs-external cache for Mode B. The import is
# optional so Mode A (internal) remains usable without Pinecone installed --
# rs_cache has a guarded import of the pinecone SDK.
try:
    from lib.core.rs_cache import (  # noqa: E402
        namespace_slug as _rs_cache_namespace_slug,
        get_namespace_freshness as _rs_cache_freshness,
        upsert_corpus as _rs_cache_upsert,
        fetch_all_from_namespace as _rs_cache_fetch_all,
        is_fresh as _rs_cache_is_fresh,
        TTL_DAYS as _RS_CACHE_TTL_DAYS,
    )
    _RS_CACHE_AVAILABLE = True
except Exception as _rs_cache_import_err:  # pragma: no cover -- defensive
    _RS_CACHE_AVAILABLE = False
    _rs_cache_import_err_msg = str(_rs_cache_import_err)


# --- Constants ---------------------------------------------------------------

DEFAULT_EMBEDDING_MODEL = "multilingual-e5-large"
# SKIP_FILES / SKIP_DIRS from the ONE shared source (Phase 200-01, SEED-018).
# Was a local copy that the other walkers drifted from; now single-sourced.
from lib.core.rs_corpus_exclude import SKIP_DIRS, SKIP_FILES  # noqa: E402
CACHE_FILENAME = ".rs-engine-cache.json"
RESULTS_FILENAME = ".rs-engine-results.json"
DEFAULT_TOPK = 100
DEFAULT_THRESHOLD = 0.30
ENGINE_VERSION = "1"

# Mode C (hybrid) post-filter overshoot. After abs-diff top-k over the
# unified corpus, we discard any intra-corpus pair (room-room or
# external-external) and keep only cross-corpus pairs. An overshoot of
# 10x the requested topk gives enough headroom to reach topk on realistic
# corpora where room artifacts (O(100)) are dwarfed by external docs
# (O(2000)) and most of the strongest abs-diff pairs would be
# external-external by volume alone. Smaller overshoots silently shrink
# delivered pair count below topk; larger overshoots waste O(k log k)
# sort work. Plan 89-05 Detailed Steps specify 10x.
HYBRID_OVERSHOOT = 10


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

# System provenance defaults for rs-engine's own node writes. Mirrors
# lib/core/node-insert.cjs's SYSTEM_SOURCE_PATH / SYSTEM_CREATED_BY, using a
# distinct source_path handle ('system:rs-engine' vs the JS module's
# 'system:hsi-to-graph') so RS-written nodes stay distinguishable from
# HSI-written ones per the RCA's Change 1 requirement.
RS_ENGINE_SOURCE_PATH = "system:rs-engine"
RS_ENGINE_CREATED_BY = "system"


def _now_ms() -> int:
    """Epoch milliseconds, matching the INTEGER created_at/last_seen_at
    columns the Phase-109 migration writes (see phase-109-nodes-provenance.cjs,
    which stores JS Date.now()-shaped epoch-ms integers)."""
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def _nodes_table_is_migrated(conn: sqlite3.Connection) -> bool:
    """Detect the Phase-109 provenance schema on the nodes table.

    Mirrors lib/core/node-insert.cjs's isMigratedSchema: PRAGMA table_info(nodes)
    and check for the source_path column. Defensive: any PRAGMA failure falls
    back to the legacy 3-column shape (the wide insert would throw on a real
    legacy db, so defaulting to legacy is the safe choice -- same rationale as
    the JS helper).
    """
    try:
        cols = conn.execute("PRAGMA table_info(nodes)").fetchall()
        # PRAGMA table_info row shape: (cid, name, type, notnull, dflt_value, pk)
        return any(row[1] == "source_path" for row in cols)
    except sqlite3.Error:
        return False


def _upsert_node(
    conn: sqlite3.Connection,
    migrated: bool,
    node_id: str,
    node_type: str,
    properties_json: str,
) -> None:
    """NOT-NULL-safe node upsert (RCA rs-engine-python-insert-not-null-and-detail-drop-regression).

    Mirrors lib/core/node-insert.cjs's insertNode contract in Python. The bare
    3-column insert this replaces crashed with
    `NOT NULL constraint failed: nodes.source_path` on any room.db carrying
    the Phase-109 wide nodes schema, since node-insert.cjs's Phase 140-01 fix
    only covers its 4 JS call sites and this script is Python.

    On the migrated (wide) schema, supplies the four NOT NULL provenance
    columns with rs-engine's own system-write defaults. On the legacy
    3-column schema, keeps the original bare insert unchanged.
    """
    if migrated:
        now_ms = _now_ms()
        conn.execute(
            "INSERT INTO nodes "
            "(id, type, properties, source_path, created_by, created_at, last_seen_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET "
            "properties = excluded.properties, last_seen_at = excluded.last_seen_at",
            (
                node_id,
                node_type,
                properties_json,
                RS_ENGINE_SOURCE_PATH,
                RS_ENGINE_CREATED_BY,
                now_ms,
                now_ms,
            ),
        )
        return
    conn.execute(
        "INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET properties = excluded.properties",
        (node_id, node_type, properties_json),
    )


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
        # Detect schema ONCE per invocation (D-02a both-schema safety, mirrors
        # node-insert.cjs's per-call PRAGMA check): a migrated db requires the
        # wide insert, a legacy 3-col db (created by the CREATE TABLE IF NOT
        # EXISTS above, on a room with no prior migration) rejects it.
        migrated = _nodes_table_is_migrated(conn)

        written = 0
        for pair in pairs:
            src = pair.get("source_artifact_id")
            tgt = pair.get("target_artifact_id")
            if not src or not tgt:
                continue
            # Upsert artifact nodes as a courtesy so downstream readers can
            # resolve them without relying on compute-hsi having run first.
            _upsert_node(
                conn,
                migrated,
                src,
                "Artifact",
                json.dumps({
                    "title": pair.get("source_title", ""),
                    "section": pair.get("source_section", ""),
                }),
            )
            _upsert_node(
                conn,
                migrated,
                tgt,
                "Artifact",
                json.dumps({
                    "title": pair.get("target_title", ""),
                    "section": pair.get("target_section", ""),
                }),
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


# --- Cross-room (Mode A multi-room) runner -----------------------------------

# Overshoot multiplier for cross-room filtering. After abs-diff top-k, we
# discard any pair whose two artifacts live in the same room. A modest 3x
# overshoot keeps the post-filter yield close to the requested topk even when
# a few of the strongest pairs happen to be intra-room. Larger overshoots
# pay an O(k log k) cost but are wasted if yield is already >= topk.
CROSS_ROOM_OVERSHOOT = 3
CROSS_ROOM_WARN_SHARE = 0.05  # warn when any room contributes < 5% of corpus


def run_mode_cross_room(
    room_paths: Sequence[str],
    topk: int,
    threshold: float,
    no_thesis: bool,
) -> Dict:
    """Mode A multi-room: scan N rooms and keep only cross-room pairs.

    Output contract (per plan):
      - metadata.mode == "cross-room"
      - metadata.rooms == [room_id, ...] in input order
      - every pair has source_room != target_room
      - pairs carry source_room / target_room / source_artifact / target_artifact

    The cross-room summary table is printed to stderr by the caller; this
    function only computes the payload.
    """
    corpus = load_multi_room_corpus(room_paths)
    room_ids = []
    seen = set()
    for art in corpus:
        rid = art["room_id"]
        if rid not in seen:
            room_ids.append(rid)
            seen.add(rid)

    if len(corpus) < 10:
        # The authoritative algorithm's LSA fit needs enough documents to
        # produce stable topic keywords. Below 10, cross-room signal is
        # unreliable. Plan's canonical threshold.
        print(
            f"[rs-engine] Only {len(corpus)} artifacts across "
            f"{len(room_paths)} rooms. Need >= 10 for cross-room mode.",
            file=sys.stderr,
        )
        return {
            "metadata": {
                "mode": "cross-room",
                "rooms": room_ids,
                "room_paths": [str(Path(rp).resolve()) for rp in room_paths],
                "artifact_count": len(corpus),
                "room_counts": summarize_corpus(corpus),
                "topk_requested": topk,
                "threshold": threshold,
                "no_thesis": bool(no_thesis),
                "thesis_generated": False,
                "pair_matrix": {},
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "engine_version": ENGINE_VERSION,
            },
            "pairs": [],
        }

    if len({a["room_id"] for a in corpus}) < 2:
        # All usable artifacts came from a single room; no cross-room pair
        # is possible by construction. Emit an empty-pairs result with a
        # clear message rather than silently running the algorithm.
        print(
            "[rs-engine] All artifacts come from a single room; "
            "cross-room filter yields zero pairs by construction.",
            file=sys.stderr,
        )
        return {
            "metadata": {
                "mode": "cross-room",
                "rooms": room_ids,
                "room_paths": [str(Path(rp).resolve()) for rp in room_paths],
                "artifact_count": len(corpus),
                "room_counts": summarize_corpus(corpus),
                "topk_requested": topk,
                "threshold": threshold,
                "no_thesis": bool(no_thesis),
                "thesis_generated": False,
                "pair_matrix": {},
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "engine_version": ENGINE_VERSION,
            },
            "pairs": [],
        }

    # Share-skew warning (plan Risk 1). Any room contributing < 5% of the
    # corpus can skew LSA toward the dominant rooms' vocabulary.
    room_counts = summarize_corpus(corpus)
    total = len(corpus)
    for rid, count in room_counts.items():
        share = count / total if total else 0.0
        if share < CROSS_ROOM_WARN_SHARE:
            print(
                f"[rs-engine] Warning: room {rid!r} contributes "
                f"{count}/{total} artifacts ({share:.1%}); LSA may skew "
                f"away from it.",
                file=sys.stderr,
            )

    # Build the multi-room corpus as if it were one flat artifact list. The
    # engine's LSA fit + abs-diff top-k run byte-identical to Mode A; only
    # the post-filter step is new.
    texts = [f"{a['title']}\n{a['text']}" for a in corpus]

    lsa_matrix = build_lsa_matrix(texts)

    # Semantic signal: use the same path as Mode A single-room. We embed
    # into a transient cache in the FIRST room's .mindrian-less root. The
    # cache lives alongside the cross-room results file so multi-room
    # embeddings cannot collide with a single-room Mode A cache on the same
    # first-room path (different artifact-id shapes).
    first_room_dir = Path(room_paths[0]).resolve()
    cache_dir = first_room_dir / ".rs-engine-cross-room-cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    # Remap to the compute_embeddings contract (it expects artifact["id"]).
    # Use global_id so cache keys stay unique across rooms.
    cache_artifacts = [
        {"id": a["global_id"], "text": a["text"]}
        for a in corpus
    ]
    embeddings, model_used = compute_embeddings(cache_artifacts, cache_dir)
    if embeddings is None:
        print(
            "rs-engine: no embedder available; semantic matrix set to identity",
            file=sys.stderr,
        )
        n = len(corpus)
        sem_matrix = np.eye(n, dtype=np.float32)
    else:
        sem_matrix = semantic_similarity_matrix(embeddings)

    # Overshoot so post-filter still yields topk when some pairs are intra-room.
    overshoot_k = max(topk * CROSS_ROOM_OVERSHOOT, topk + 10)
    top_pairs = abs_diff_topk(lsa_matrix, sem_matrix, k=overshoot_k)

    # Cross-room filter + pair matrix accumulator.
    pair_dicts: List[Dict] = []
    pair_matrix: Dict[str, int] = {}
    for i, j, signed, absv in top_pairs:
        if absv < threshold:
            continue
        a_i, a_j = corpus[i], corpus[j]
        if a_i["room_id"] == a_j["room_id"]:
            continue  # intra-room pair -- discard.
        src_room = a_i["room_id"]
        tgt_room = a_j["room_id"]
        # Canonical pair-matrix key: sort room_ids so (A, B) == (B, A) counts.
        pm_key = " x ".join(sorted([src_room, tgt_room]))
        pair_matrix[pm_key] = pair_matrix.get(pm_key, 0) + 1
        pair_dicts.append({
            "source_artifact_id": a_i["global_id"],
            "source_artifact": a_i["artifact_id"],
            "source_room": src_room,
            "source_title": a_i["title"],
            "source_section": a_i["section"],
            "source_path": a_i["path"],
            "target_artifact_id": a_j["global_id"],
            "target_artifact": a_j["artifact_id"],
            "target_room": tgt_room,
            "target_title": a_j["title"],
            "target_section": a_j["section"],
            "target_path": a_j["path"],
            "lsa_score": round(float(lsa_matrix[i, j]), 4),
            "semantic_score": round(float(sem_matrix[i, j]), 4),
            "signed_diff": round(float(signed), 4),
            "abs_diff": round(float(absv), 4),
            "direction": classify_direction(signed),
        })
        if len(pair_dicts) >= topk:
            break

    result = {
        "metadata": {
            "mode": "cross-room",
            "rooms": room_ids,
            "room_paths": [str(Path(rp).resolve()) for rp in room_paths],
            "artifact_count": len(corpus),
            "room_counts": room_counts,
            "topk_requested": topk,
            "threshold": threshold,
            "embedding_model": model_used,
            "thesis_generated": False,
            "no_thesis": bool(no_thesis),
            "edges_written": 0,  # Mode A multi-room does NOT write room.db edges.
            "pair_matrix": pair_matrix,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "engine_version": ENGINE_VERSION,
        },
        "pairs": pair_dicts,
    }
    return result


def _print_cross_room_summary(result: Dict) -> None:
    """Print the plan-canonical Room-A x Room-B | Bridges table to stderr."""
    matrix = result.get("metadata", {}).get("pair_matrix") or {}
    if not matrix:
        print("[rs-engine] No cross-room bridges found.", file=sys.stderr)
        return
    # Sort pair keys by bridge count desc, then alphabetically for stability.
    rows = sorted(matrix.items(), key=lambda kv: (-kv[1], kv[0]))
    max_key_len = max(len(k) for k, _ in rows)
    header_key = "Room pair".ljust(max_key_len)
    print(f"\n{header_key} | Bridges", file=sys.stderr)
    print(f"{'-' * max_key_len}-+--------", file=sys.stderr)
    for key, count in rows:
        print(f"{key.ljust(max_key_len)} | {count}", file=sys.stderr)
    print("", file=sys.stderr)


# --- Mode B runner -----------------------------------------------------------

def _write_corpus_jsonl(corpus_dir: Path, docs: Sequence[Dict]) -> Path:
    """Persist the raw fetched corpus for provenance.

    One JSON document per line keeps the file streaming-friendly and easy to
    diff. Plan 89-03 will key the Pinecone upsert on (source, external_id)
    read directly from this file.
    """
    corpus_dir.mkdir(parents=True, exist_ok=True)
    path = corpus_dir / "_corpus.jsonl"
    with path.open("w", encoding="utf-8") as fh:
        for doc in docs:
            fh.write(json.dumps(doc, ensure_ascii=False) + "\n")
    return path


def _corpus_docs_to_artifacts(docs: Sequence[Dict]) -> List[Dict]:
    """Shape fetched docs into the artifact dict the rest of the engine
    expects (id, section, title, path, text)."""
    artifacts: List[Dict] = []
    for doc in docs:
        external_id = doc.get("external_id") or ""
        source = doc.get("source") or "external"
        # Build an artifact id that is stable across runs and unique within
        # the corpus. External ids can contain URL characters; stripping to
        # an id-friendly slug keeps downstream SQLite/Pinecone keys predictable.
        eid_slug = re.sub(r"[^a-zA-Z0-9]+", "-", external_id).strip("-")
        if not eid_slug:
            eid_slug = re.sub(r"[^a-zA-Z0-9]+", "-", doc.get("title") or "untitled").strip("-")
        artifact_id = f"{source}/{eid_slug}"
        text = (doc.get("abstract") or "").strip()
        if not text:
            continue
        artifacts.append({
            "id": artifact_id,
            "section": source,
            "title": (doc.get("title") or "").strip() or external_id,
            "path": doc.get("url") or external_id,
            "text": text,
            "year": doc.get("year"),
            "authors": doc.get("authors", []),
            "doi": doc.get("doi"),
        })
    return artifacts


def _records_to_artifacts(records: Sequence[Dict]) -> List[Dict]:
    """Shape rs_cache records (id + values + metadata) into artifact dicts.

    Plan 89-03 warm path: records come straight from Pinecone and carry the
    abstract in metadata['abstract'], the public DOI in metadata['doi'],
    and the human title in metadata['title']. Integrated-embedding values
    live in record['values']; we attach them so the caller can build the
    semantic matrix directly without re-embedding.
    """
    artifacts: List[Dict] = []
    for rec in records:
        rid = rec.get("id") or ""
        meta = rec.get("metadata", {}) or {}
        abstract = (meta.get("abstract") or "").strip()
        if not abstract:
            # A namespace record without a usable abstract cannot feed LSA;
            # silently drop, matching the 89-02 empty-abstract filter.
            continue
        source = (meta.get("source") or "external").strip() or "external"
        title = (meta.get("title") or "").strip() or rid
        # Reconstruct a stable artifact id matching Mode B's cold path shape
        # (source/slug). This keeps pair ids comparable between warm and
        # cold runs over the same topic.
        eid_slug = re.sub(r"[^a-zA-Z0-9]+", "-", rid).strip("-")
        if not eid_slug:
            eid_slug = re.sub(r"[^a-zA-Z0-9]+", "-", title or "untitled").strip("-")
        artifact_id = f"{source}/{eid_slug}"
        artifacts.append({
            "id": artifact_id,
            "section": source,
            "title": title,
            "path": f"https://doi.org/{meta['doi']}" if meta.get("doi") else rid,
            "text": abstract,
            "year": meta.get("year") or None,
            "authors": [],
            "doi": meta.get("doi") or None,
            "_pinecone_values": rec.get("values") or [],
        })
    return artifacts


def _pinecone_path_available() -> Tuple[bool, str]:
    """Return (ok, reason). Reason is empty on success, explanatory on skip."""
    if not _RS_CACHE_AVAILABLE:
        return False, f"rs_cache import failed: {globals().get('_rs_cache_import_err_msg', 'unknown')}"
    if not os.environ.get("PINECONE_API_KEY"):
        return False, "PINECONE_API_KEY not set"
    model_env = os.environ.get("RS_EMBEDDING_MODEL", "").strip().lower()
    if model_env == "minilm":
        return False, "RS_EMBEDDING_MODEL=minilm (user opted out of Pinecone path)"
    return True, ""


def _build_sem_matrix_from_records(artifacts: Sequence[Dict]) -> Optional[np.ndarray]:
    """Build the pairwise cosine similarity matrix from cached embeddings.

    Returns None if any artifact is missing a vector (triggers fallback to
    local embedding path). All vectors must share dimensionality.
    """
    vectors: List[List[float]] = []
    for a in artifacts:
        v = a.get("_pinecone_values") or []
        if not v:
            return None
        vectors.append(list(v))
    if not vectors:
        return None
    dim = len(vectors[0])
    if any(len(v) != dim for v in vectors):
        return None
    matrix = np.asarray(vectors, dtype=np.float32)
    return semantic_similarity_matrix(matrix)


# --- SEED-018 H2 semantic-floor gate: LIVE production wiring ----------------
#
# The gate itself lives in lib/core/rs_corpus.semantic_gate (implemented + unit
# tested in Plan 200-01). Until this wiring it had NO production caller -- it was
# dormant. The helpers below call it on the two live Mode B corpus paths:
#
#   1. Pinecone (warm/cold) path: gate the raw `records` (each carrying its
#      server-side e5 vector in record['values']) against a topic vector from the
#      SAME Pinecone inference, BEFORE _records_to_artifacts.
#   2. Local fallback path (Plan 89-02): gate the fetched `docs` using the reused
#      local MiniLM encoder (_embed_local_minilm), batched so the model loads once.
#
# Safe-by-default (this is the core scoring input):
#   - No-op when the topic vector cannot be obtained (encode / inference absent).
#   - Reuses SEMANTIC_FLOOR (default 0.15, tunable via RS_SEMANTIC_FLOOR).
#   - STARVATION GUARD: never drops the usable count below the differential
#     minimum (the engine early-outs under 2 artifacts). Worst case a no-op,
#     never a regression.
#   - Reuses the EXISTING encoders only (Pinecone inference + MiniLM). No new
#     encoder, no new npm/pip package, no new egress class.

# The engine early-outs when fewer than this many artifacts survive (see the
# `len(artifacts) < 2` guard in run_mode_external). The gate must never push the
# corpus below it.
_DIFFERENTIAL_MIN_ARTIFACTS = 2


def _semantic_cosine(a: Sequence[float], b: Sequence[float]) -> float:
    """Minimal cosine similarity for the starvation-guard ranking. Returns 0.0
    on shape mismatch or a zero-norm vector."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = 0.0
    na = 0.0
    nb = 0.0
    for x, y in zip(a, b):
        dot += x * y
        na += x * x
        nb += y * y
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / ((na ** 0.5) * (nb ** 0.5))


def _gate_with_starvation_guard(
    topic_vec: Optional[Sequence[float]],
    candidates: List[Dict],
    encode_fn,
    floor: Optional[float] = None,
    min_keep: int = _DIFFERENTIAL_MIN_ARTIFACTS,
    label: str = "corpus",
) -> List[Dict]:
    """Apply the H2 semantic-floor gate with a mandatory starvation guard.

    Delegates the actual floor filtering to rs_corpus.semantic_gate (the single
    gate implementation) so both live paths share one tested code path. When the
    floor would push the survivor count below the differential minimum on an
    otherwise-sufficient corpus, keep the top-N candidates by similarity instead
    of starving score(), and log the skip to stderr.
    """
    if not topic_vec or not callable(encode_fn):
        # No usable topic vector / encoder -> safe no-op pass-through.
        return list(candidates)

    original_n = len(candidates)
    # Production caller of the SEED-018 H2 gate (rs_corpus.semantic_gate).
    kept = semantic_gate(topic_vec, candidates, encode_fn, floor)

    if len(kept) >= min_keep or original_n < min_keep:
        return kept

    # Starvation guard: the floor would collapse the corpus below the
    # differential minimum. Preserve the top-N most-similar candidates so the
    # differential still runs. Worst case the gate is a no-op, never a
    # regression that starves the scorer.
    ranked = sorted(
        candidates,
        key=lambda c: _semantic_cosine(topic_vec, encode_fn(c)),
        reverse=True,
    )
    keep_n = max(min_keep, len(kept))
    guarded = ranked[:keep_n]
    print(
        f"[rs-engine] semantic gate skipped: would starve corpus "
        f"(kept {len(guarded)})",
        file=sys.stderr,
    )
    return guarded


def _embed_topic_via_pinecone(topic: str) -> Optional[List[float]]:
    """Embed `topic` into the rs-external e5 space via Pinecone inference.

    Reuses the SAME multilingual-e5-large model the cold path upserts with, so
    the topic vector is directly comparable to the record vectors already stored
    in record['values']. `input_type=query` matches how Pinecone embeds a query
    against passage-embedded records (e5 is asymmetric).

    Returns a plain float list, or None on ANY failure (no key, SDK missing,
    network error, unexpected shape) so the caller degrades to a safe no-op.
    Adds no new encoder and no new egress class -- Pinecone inference is the
    existing cold-path encoder.
    """
    if not _RS_CACHE_AVAILABLE:
        return None
    api_key = os.environ.get("PINECONE_API_KEY")
    if not api_key:
        return None
    try:
        from pinecone import Pinecone  # type: ignore
        pc = Pinecone(api_key=api_key)
        resp = pc.inference.embed(
            model="multilingual-e5-large",
            inputs=[topic],
            parameters={"input_type": "query", "truncate": "END"},
        )
        item = resp[0]
        # Dense embedding items expose `values` (attr) or ['values'] (dict-like).
        if isinstance(item, dict):
            values = item.get("values")
        else:
            values = getattr(item, "values", None)
        if not values:
            return None
        return [float(x) for x in values]
    except Exception as e:  # pragma: no cover -- live-only path
        print(
            f"[rs-engine] semantic gate: topic embed unavailable ({e}); "
            f"gate no-op for this run.",
            file=sys.stderr,
        )
        return None


def _gate_records_pinecone(topic: str, records: List[Dict]) -> List[Dict]:
    """Gate Pinecone `records` by the semantic floor before _records_to_artifacts.

    Each record carries its e5 vector in record['values']; the topic vector comes
    from the same Pinecone inference. No-op (returns records unchanged) when the
    topic vector is unavailable.
    """
    if not records:
        return records
    topic_vec = _embed_topic_via_pinecone(topic)
    if not topic_vec:
        return records
    return _gate_with_starvation_guard(
        topic_vec,
        records,
        lambda rec: rec.get("values") or [],
        label="pinecone-records",
    )


def _gate_docs_local(topic: str, docs: List[Dict]) -> List[Dict]:
    """Gate local-fallback `docs` by the semantic floor using the reused local
    MiniLM encoder. Batched so SentenceTransformer loads once. Clean no-op when
    sentence-transformers is absent (encode returns None)."""
    if not docs:
        return docs
    topic_arr = _embed_local_minilm([topic])
    if topic_arr is None:
        # sentence-transformers not installed -> safe no-op (Tri-Polar degrade).
        return docs
    texts = [
        f"{d.get('title', '')}\n{d.get('abstract', '')}".strip() for d in docs
    ]
    cand_arr = _embed_local_minilm(texts)
    if cand_arr is None or len(cand_arr) != len(docs):
        return docs
    topic_vec = [float(x) for x in topic_arr[0]]
    vec_by_id = {id(d): [float(x) for x in cand_arr[i]] for i, d in enumerate(docs)}
    return _gate_with_starvation_guard(
        topic_vec,
        docs,
        lambda d: vec_by_id.get(id(d), []),
        label="local-fallback",
    )


def run_mode_external(
    room_dir: Path,
    topic: str,
    topk: int,
    threshold: float,
    no_thesis: bool,
) -> Tuple[Dict, Path]:
    """Mode B: fetch external corpus (cached via Pinecone), run LSA + abs_diff.

    Plan 89-03 wiring: the Pinecone rs-external index caches embedded
    corpora per topic. On each call:
      1. Compute namespace for topic (rs_cache.namespace_slug).
      2. Check freshness. If < 30 days, skip fetch and use the cached
         vectors directly (warm path).
      3. Else, fetch_corpus -> upsert_corpus -> fetch_all_from_namespace
         (cold path; Pinecone embeds server-side via multilingual-e5-large).
      4. Fall back to the Plan 89-02 local path (fetch_corpus + local
         MiniLM embedding) when Pinecone is unavailable or the user opts
         out via RS_EMBEDDING_MODEL=minilm.

    Returns (result dict, corpus_dir) -- CLI writes results JSON inside
    corpus_dir at {room}/research/{topic-slug}/.rs-engine-results.json.
    """
    slug = topic_slug(topic)
    if not slug:
        raise ValueError("topic slug resolved to empty string")
    corpus_dir = room_dir / "research" / slug
    corpus_dir.mkdir(parents=True, exist_ok=True)

    # Overshoot target_n so dedup + threshold filtering can still hit topk.
    target_n = max(topk * 20, topk * 2)

    # Freshness + cache decision.
    pinecone_ok, pinecone_skip_reason = _pinecone_path_available()
    cache_mode = "bypass"
    cache_age_days: Optional[float] = None
    cache_namespace: Optional[str] = None
    records: List[Dict] = []
    docs: List[Dict] = []

    if pinecone_ok:
        ns = _rs_cache_namespace_slug(topic)
        cache_namespace = ns
        try:
            cache_age_days = _rs_cache_freshness(ns)
        except Exception as e:
            print(f"rs-engine: Pinecone freshness check failed ({e})", file=sys.stderr)
            cache_age_days = None

        if _rs_cache_is_fresh(cache_age_days, ttl_days=_RS_CACHE_TTL_DAYS):
            # WARM path: namespace is within TTL. Skip fetch.
            cache_mode = "warm"
            print(
                f"[rs-engine] Cache hit (age={cache_age_days:.1f} days, "
                f"ttl={_RS_CACHE_TTL_DAYS}). Using Pinecone namespace {ns}.",
                file=sys.stderr,
            )
            try:
                records = _rs_cache_fetch_all(ns, limit=target_n)
            except Exception as e:
                print(
                    f"rs-engine: warm-path fetch failed ({e}); "
                    f"falling back to cold path.",
                    file=sys.stderr,
                )
                records = []
                cache_mode = "bypass"

        if cache_mode != "warm":
            # COLD path: fetch from external APIs, upsert to Pinecone,
            # then re-fetch so the vectors come from Pinecone's server-side
            # embedding (not a local re-compute).
            age_label = "unset" if cache_age_days is None else f"{cache_age_days:.1f} days"
            print(
                f"[rs-engine] Cache miss (age={age_label}). "
                f"Fetching corpus for topic {topic!r}...",
                file=sys.stderr,
            )
            docs = fetch_corpus(topic, target_n=target_n)
            if len(docs) >= 2:
                try:
                    _rs_cache_upsert(topic, docs)
                    cache_mode = "cold"
                    # Re-read from Pinecone so semantic matrix uses the
                    # server-side multilingual-e5-large vectors.
                    records = _rs_cache_fetch_all(ns, limit=target_n)
                except Exception as e:
                    print(
                        f"rs-engine: Pinecone upsert/fetch failed ({e}); "
                        f"falling back to local embedding path.",
                        file=sys.stderr,
                    )
                    records = []
                    cache_mode = "bypass"
    else:
        # Pinecone path not available -- preserve Plan 89-02 behavior.
        print(
            f"[rs-engine] Pinecone cache skipped ({pinecone_skip_reason}); "
            f"using Plan 89-02 local embedding path.",
            file=sys.stderr,
        )

    # Provenance sidecar: keep _corpus.jsonl in both paths.
    # Warm path has no fresh fetch; docs stays empty but we still want the
    # sidecar to exist (stale from prior cold run). If absent, skip quietly
    # so the warm path does not accidentally wipe prior provenance.
    if docs:
        corpus_path = _write_corpus_jsonl(corpus_dir, docs)
    else:
        corpus_path = corpus_dir / "_corpus.jsonl"
        if not corpus_path.exists():
            # Warm path with no prior sidecar (first time the namespace is
            # warm on this machine). Create an empty file so downstream
            # readers do not trip on a missing path.
            corpus_path.write_text("", encoding="utf-8")

    # Build artifacts + texts depending on path taken.
    if records:
        # SEED-018 H2 LIVE-WIRE (Pinecone path): drop off-topic records using the
        # e5 vectors they already carry vs a topic vector from the same Pinecone
        # inference, BEFORE they become artifacts and reach the differential.
        # Starvation-guarded + no-op when the topic vector is unavailable.
        records = _gate_records_pinecone(topic, records)
        artifacts = _records_to_artifacts(records)
    else:
        # Fallback to Plan 89-02 behavior.
        if not docs:
            docs = fetch_corpus(topic, target_n=target_n)
            corpus_path = _write_corpus_jsonl(corpus_dir, docs)
        # SEED-018 H2 LIVE-WIRE (local fallback): gate off-topic docs with the
        # reused local MiniLM encoder before they reach the differential.
        docs = _gate_docs_local(topic, docs)
        artifacts = _corpus_docs_to_artifacts(docs)

    # Early out if the usable-artifact count collapses.
    if len(artifacts) < 2:
        return (
            {
                "metadata": {
                    "mode": "external",
                    "topic": topic,
                    "topic_slug": slug,
                    "room_dir": str(room_dir),
                    "corpus_dir": str(corpus_dir),
                    "corpus_path": str(corpus_path),
                    "corpus_size": len(docs) if docs else len(records),
                    "artifact_count": len(artifacts),
                    "tier_counts": _count_by_source(docs) if docs else {},
                    "cache_mode": cache_mode,
                    "cache_age_days": round(cache_age_days, 2) if cache_age_days is not None else None,
                    "cache_namespace": cache_namespace,
                    "cache_ttl_days": _RS_CACHE_TTL_DAYS if pinecone_ok else None,
                    "topk_requested": topk,
                    "threshold": threshold,
                    "no_thesis": bool(no_thesis),
                    "thesis_generated": False,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "engine_version": ENGINE_VERSION,
                },
                "pairs": [],
            },
            corpus_dir,
        )

    texts = [f"{a['title']}\n{a['text']}" for a in artifacts]

    # Structural signal (authoritative topic-keyword-membership LSA).
    lsa_matrix = build_lsa_matrix(texts)

    # Semantic signal. Warm/cold path: vectors come straight from Pinecone.
    # Bypass path: fall back to Plan 89-02's local embedder.
    sem_matrix: Optional[np.ndarray] = None
    model_used: str
    if cache_mode in ("warm", "cold") and records:
        sem_matrix = _build_sem_matrix_from_records(artifacts)
        if sem_matrix is not None:
            model_used = "multilingual-e5-large"
        else:
            # Vectors missing -- rare but defensible. Drop to local path.
            print(
                "rs-engine: Pinecone records missing values; "
                "falling back to local embedding for semantic matrix.",
                file=sys.stderr,
            )
            embeddings, model_used = compute_embeddings(artifacts, corpus_dir)
            sem_matrix = (
                semantic_similarity_matrix(embeddings)
                if embeddings is not None
                else np.eye(len(artifacts), dtype=np.float32)
            )
    else:
        embeddings, model_used = compute_embeddings(artifacts, corpus_dir)
        if embeddings is None:
            print(
                "rs-engine: no embedder available for Mode B; "
                "semantic matrix set to identity.",
                file=sys.stderr,
            )
            sem_matrix = np.eye(len(artifacts), dtype=np.float32)
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
            "source_url": a_i.get("path", ""),
            "source_doi": a_i.get("doi"),
            "target_artifact_id": a_j["id"],
            "target_title": a_j["title"],
            "target_section": a_j["section"],
            "target_url": a_j.get("path", ""),
            "target_doi": a_j.get("doi"),
            "lsa_score": round(float(lsa_matrix[i, j]), 4),
            "semantic_score": round(float(sem_matrix[i, j]), 4),
            "signed_diff": round(float(signed), 4),
            "abs_diff": round(float(absv), 4),
            "direction": classify_direction(signed),
        })

    result = {
        "metadata": {
            "mode": "external",
            "topic": topic,
            "topic_slug": slug,
            "room_dir": str(room_dir),
            "corpus_dir": str(corpus_dir),
            "corpus_path": str(corpus_path),
            "corpus_size": len(docs) if docs else len(records),
            "artifact_count": len(artifacts),
            "tier_counts": _count_by_source(docs) if docs else {},
            "cache_mode": cache_mode,
            "cache_age_days": round(cache_age_days, 2) if cache_age_days is not None else None,
            "cache_namespace": cache_namespace,
            "cache_ttl_days": _RS_CACHE_TTL_DAYS if pinecone_ok else None,
            "topk_requested": topk,
            "threshold": threshold,
            "embedding_model": model_used,
            "thesis_generated": False,
            "no_thesis": bool(no_thesis),
            "edges_written": 0,  # Mode B does NOT write room.db edges.
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "engine_version": ENGINE_VERSION,
        },
        "pairs": pair_dicts,
    }
    return result, corpus_dir


def _count_by_source(docs: Sequence[Dict]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for d in docs:
        src = d.get("source") or "unknown"
        counts[src] = counts.get(src, 0) + 1
    return counts


# --- Mode C (hybrid) runner --------------------------------------------------

# Design note on semantic similarity for the unified corpus (Plan 89-05):
#   The external side carries cached 1024-dim multilingual-e5-large vectors
#   when the Pinecone path is available. The room side carries no vectors
#   on first run. Mixing 1024-dim (external) with 384-dim local MiniLM
#   (room) would be a dimensional bug (plan Risk 1). The safe path is to
#   embed the entire unified corpus in a single model space -- local
#   MiniLM via compute_embeddings() -- so both sides share 384-dim and the
#   pairwise cosine is well-defined. The cached e5-large vectors are
#   retained on the external-doc side metadata for future callers
#   (Plan 89-07 may surface them for downstream reranking) but do not
#   drive the hybrid abs-diff pass.


def run_mode_hybrid(
    room_dir: Path,
    topic: str,
    topk: int,
    threshold: float,
    no_thesis: bool,
    external_target: int = 2000,
) -> Tuple[Dict, Path]:
    """Mode C: unified room + external corpus with cross-corpus filter.

    The killer feature of Phase 89: rediscovers external-domain concepts
    that have a structural match in the user's room but never entered the
    room's vocabulary, and vice versa. Consumed downstream by the Plan
    89-06 bridge-writer for Obsidian rendering.

    Returns (result dict, corpus_dir) -- CLI writes results JSON inside
    corpus_dir at {room}/research/{topic-slug}/.rs-engine-results.json.

    Cross-corpus contract:
      - metadata.mode == "hybrid"
      - metadata.hybrid == True (explicit flag per plan must_haves[2])
      - every pair has origin mismatch: one room side, one external side
      - pair_dicts carry both room_artifact_id and external_doc fields
      - direction is the standard Mode A / Mode B signed classification

    Edge cases:
      - rs_hybrid import failed: raise NotImplementedError early so the
        CLI surfaces a clear "cannot run Mode C" message.
      - Empty room corpus: return empty pairs with metadata preserved so
        downstream readers do not trip on missing keys.
      - Empty external corpus (rare -- cold fetch returned nothing):
        same empty-pairs result. Caller sees metadata.external_count=0.
      - Unified corpus < 10 artifacts: skip LSA (same threshold the
        cross-room path uses). LSA topic keywords are unstable below
        this size.
    """
    if not _RS_HYBRID_AVAILABLE:
        raise NotImplementedError(
            "rs-engine: --mode hybrid requires lib.core.rs_hybrid. "
            f"Import failed: {globals().get('_rs_hybrid_import_err_msg', 'unknown')}"
        )

    # Build the unified corpus + origin mask via rs_hybrid.
    corpus, origin_mask, hybrid_meta = _rs_hybrid_build(
        str(room_dir),
        topic,
        external_target=external_target,
    )
    slug = hybrid_meta.get("topic_slug") or topic_slug(topic)
    if not slug:
        raise ValueError("topic slug resolved to empty string")
    corpus_dir = room_dir / "research" / slug
    corpus_dir.mkdir(parents=True, exist_ok=True)

    room_count = int(hybrid_meta.get("room_count", 0))
    external_count = int(hybrid_meta.get("external_count", 0))

    def _empty_result(reason: str) -> Tuple[Dict, Path]:
        print(f"[rs-engine hybrid] {reason}", file=sys.stderr)
        return (
            {
                "metadata": {
                    "mode": "hybrid",
                    "hybrid": True,
                    "topic": topic,
                    "topic_slug": slug,
                    "room_dir": str(room_dir),
                    "corpus_dir": str(corpus_dir),
                    "room_id": hybrid_meta.get("room_id"),
                    "room_count": room_count,
                    "external_count": external_count,
                    "artifact_count": room_count + external_count,
                    "cache_mode": hybrid_meta.get("cache_mode"),
                    "cache_age_days": hybrid_meta.get("cache_age_days"),
                    "cache_namespace": hybrid_meta.get("cache_namespace"),
                    "cache_ttl_days": hybrid_meta.get("cache_ttl_days"),
                    "topk_requested": topk,
                    "threshold": threshold,
                    "no_thesis": bool(no_thesis),
                    "thesis_generated": False,
                    "edges_written": 0,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "engine_version": ENGINE_VERSION,
                    "skip_reason": reason,
                },
                "pairs": [],
            },
            corpus_dir,
        )

    # Edge: no room artifacts -- cross-corpus filter yields zero pairs by
    # construction; save the LSA compute.
    if room_count == 0:
        return _empty_result(
            "Room has no indexable .md artifacts; cross-corpus filter "
            "yields zero pairs by construction."
        )
    # Edge: no external corpus.
    if external_count == 0:
        return _empty_result(
            f"External corpus for topic {topic!r} is empty (cache_mode="
            f"{hybrid_meta.get('cache_mode')}); cross-corpus filter "
            f"yields zero pairs by construction."
        )
    # Edge: combined corpus too small for stable LSA topic-keyword fit.
    if len(corpus) < 10:
        return _empty_result(
            f"Unified corpus has only {len(corpus)} artifacts; need >= 10 "
            f"for stable LSA fit."
        )

    # Structural signal over the unified vocabulary.
    texts = [f"{a.get('title','')}\n{a['text']}" for a in corpus]
    lsa_matrix = build_lsa_matrix(texts)

    # Semantic signal: embed the full unified corpus in one model space so
    # the sem_matrix is dimensionally homogeneous. Room and external share
    # the SAME model by construction (Plan Risk 1 mitigation). We reuse
    # compute_embeddings (MiniLM-or-cache) and scope the cache to the
    # research/{slug}/ directory to avoid polluting Mode A's room-root
    # .rs-engine-cache.json -- different corpus shape, different keys.
    cache_artifacts = [
        {"id": c["global_id"], "text": t}
        for c, t in zip(corpus, texts)
    ]
    embeddings, model_used = compute_embeddings(cache_artifacts, corpus_dir)
    if embeddings is None:
        print(
            "rs-engine hybrid: no embedder available; "
            "semantic matrix set to identity.",
            file=sys.stderr,
        )
        n = len(corpus)
        sem_matrix = np.eye(n, dtype=np.float32)
    else:
        sem_matrix = semantic_similarity_matrix(embeddings)

    # Overshoot top-k, then post-filter to cross-corpus only.
    overshoot_k = max(topk * HYBRID_OVERSHOOT, topk + 10)
    raw_pairs = abs_diff_topk(lsa_matrix, sem_matrix, k=overshoot_k)

    cross_pairs = _rs_hybrid_filter(raw_pairs, origin_mask, topk)

    # Apply threshold + build full pair dicts with room_artifact / external_doc.
    pair_dicts: List[Dict] = []
    for cp in cross_pairs:
        absv = cp["abs_diff"]
        if absv < threshold:
            continue
        i, j = cp["i"], cp["j"]
        room_idx = cp["room_side"]
        ext_idx = cp["external_side"]
        room_art = corpus[room_idx]
        ext_doc = corpus[ext_idx]
        signed = cp["signed_diff"]

        # Preserve the standard Mode A / Mode B fields (source_*/target_*)
        # so the bridge-writer resolvePairIdentity picks them up without
        # per-mode branches. Canonical orientation: source = room side,
        # target = external side. This maps the signed-direction
        # interpretation from plan must_haves[3]:
        #   structural_transfer (signed > 0):
        #       "your work has the vocabulary, world has the concept"
        #   semantic_implementation (signed < 0):
        #       "your concept exists in the world's vocabulary"
        pair_dicts.append({
            "source_artifact_id": room_art["global_id"],
            "source_artifact": room_art.get("artifact_id") or room_art["global_id"],
            "source_room": room_art.get("room_id"),
            "source_section": room_art.get("section"),
            "source_title": room_art.get("title", ""),
            "source_path": room_art.get("path", ""),
            "target_artifact_id": ext_doc["global_id"],
            "target_external_id": ext_doc.get("external_id") or ext_doc["global_id"],
            "target_doi": ext_doc.get("doi"),
            "target_source": ext_doc.get("source"),
            "target_title": ext_doc.get("title", ""),
            "target_url": ext_doc.get("path", ""),
            "target_year": ext_doc.get("year"),
            # Rich cross-corpus annotations consumed by Plan 89-06 bridge
            # writer and Plan 89-07 release dashboard.
            "room_artifact": {
                "global_id": room_art["global_id"],
                "artifact_id": room_art.get("artifact_id"),
                "room_id": room_art.get("room_id"),
                "section": room_art.get("section"),
                "title": room_art.get("title", ""),
                "path": room_art.get("path", ""),
            },
            "external_doc": {
                "global_id": ext_doc["global_id"],
                "external_id": ext_doc.get("external_id"),
                "source": ext_doc.get("source"),
                "title": ext_doc.get("title", ""),
                "doi": ext_doc.get("doi"),
                "year": ext_doc.get("year"),
                "url": ext_doc.get("path", ""),
            },
            "lsa_score": round(float(lsa_matrix[i, j]), 4),
            "semantic_score": round(float(sem_matrix[i, j]), 4),
            "signed_diff": round(float(signed), 4),
            "abs_diff": round(float(absv), 4),
            "direction": classify_direction(signed),
        })

    result = {
        "metadata": {
            "mode": "hybrid",
            "hybrid": True,
            "topic": topic,
            "topic_slug": slug,
            "room_dir": str(room_dir),
            "corpus_dir": str(corpus_dir),
            "room_id": hybrid_meta.get("room_id"),
            "room_count": room_count,
            "external_count": external_count,
            "artifact_count": len(corpus),
            "cache_mode": hybrid_meta.get("cache_mode"),
            "cache_age_days": hybrid_meta.get("cache_age_days"),
            "cache_namespace": hybrid_meta.get("cache_namespace"),
            "cache_ttl_days": hybrid_meta.get("cache_ttl_days"),
            "topk_requested": topk,
            "threshold": threshold,
            "embedding_model": model_used,
            "no_thesis": bool(no_thesis),
            "thesis_generated": False,
            # Mode C does NOT write REVERSE_SALIENT edges into room.db.
            # Plan 89-06 bridge-writer produces the user-visible artifact
            # surface; Plan 89-07 wires the optional room.db edge with
            # properties.source='rs-engine-hybrid' alongside the agent.
            "edges_written": 0,
            "hybrid_overshoot": HYBRID_OVERSHOOT,
            "external_target": external_target,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "engine_version": ENGINE_VERSION,
        },
        "pairs": pair_dicts,
    }
    return result, corpus_dir


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
            "algorithm. Mode A runs on a single room; Mode B fetches an "
            "external research corpus (OpenAlex, arXiv, Tavily); Mode C "
            "(hybrid) unifies the room with an external corpus and keeps only "
            "cross-corpus pairs -- the killer feature of Phase 89."
        ),
        epilog=(
            "Three-surface usage:\n"
            "  CLI     python scripts/rs-engine.py --mode internal --room ./room\n"
            "          python scripts/rs-engine.py --rooms ~/rooms/a ~/rooms/b ~/rooms/c --topk 50\n"
            "          python scripts/rs-engine.py --mode external --topic 'quantum biology' --room ./room\n"
            "          python scripts/rs-engine.py --mode hybrid --topic 'quantum biology' --room ./room --topk 30\n"
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
        help=(
            "internal=Mode A (single room, Plan 89-01); "
            "external=Mode B (research corpus, Plan 89-02); "
            "hybrid=Mode C (room x external unified matrix, Plan 89-05)."
        ),
    )
    parser.add_argument("--room", required=False, help="Path to room directory (Mode A / B / C).")
    parser.add_argument(
        "--rooms",
        nargs="+",
        required=False,
        help=(
            "Two or more room paths for cross-room Mode A (Plan 89-04). "
            "Rediscovers bridges between user projects. Mutually exclusive "
            "with --room. Results land in the FIRST room's .rs-engine-results.json "
            "with metadata.mode='cross-room'."
        ),
    )
    parser.add_argument(
        "--topic",
        required=False,
        help=(
            "Free-text research topic (required for --mode external). "
            "Normalized to a kebab-case slug via lib.core.rs_corpus.topic_slug "
            "for consistent {room}/research/{topic-slug}/ paths."
        ),
    )
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
        "--external-target",
        type=int,
        default=2000,
        help=(
            "Max external docs to include in --mode hybrid's unified corpus "
            "(default 2000; clamped to rs_hybrid.MAX_EXTERNAL_TARGET). "
            "Ignored for Mode A / Mode B."
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

    # Cross-room Mode A multi-room (Plan 89-04). --rooms is mutually
    # exclusive with --room. When --rooms is set, --mode is ignored
    # (cross-room is implicitly "internal multi-room").
    if args.rooms:
        if args.room:
            print(
                "rs-engine: --rooms and --room are mutually exclusive. "
                "Pick one.",
                file=sys.stderr,
            )
            return 2
        if len(args.rooms) < 2:
            print(
                "rs-engine: --rooms requires at least two room paths for "
                "cross-room mode.",
                file=sys.stderr,
            )
            return 2
        if args.mode == "external":
            print(
                "rs-engine: --mode external is incompatible with --rooms. "
                "Use --room for external mode.",
                file=sys.stderr,
            )
            return 2
        if args.mode == "hybrid":
            print(
                "rs-engine: --mode hybrid is incompatible with --rooms. "
                "Hybrid unifies ONE room with an external corpus; use --room "
                "for hybrid mode.",
                file=sys.stderr,
            )
            return 2

        topk = max(1, args.topk)
        threshold = max(0.0, args.threshold)

        try:
            result = run_mode_cross_room(
                args.rooms,
                topk=topk,
                threshold=threshold,
                no_thesis=args.no_thesis,
            )
        except NotImplementedError as e:
            print(f"rs-engine: {e}", file=sys.stderr)
            return 3
        except ValueError as e:
            print(f"rs-engine: {e}", file=sys.stderr)
            return 2
        except Exception as e:  # pragma: no cover -- defensive envelope
            print(f"rs-engine: error: {e}", file=sys.stderr)
            return 1

        # Output lands in the FIRST room's .rs-engine-results.json by
        # default (per plan). --output overrides if supplied.
        first_room_dir = Path(args.rooms[0]).resolve()
        if not first_room_dir.is_dir():
            print(
                f"rs-engine: first room {first_room_dir} is not a directory; "
                f"cannot write results.",
                file=sys.stderr,
            )
            return 1
        output_path = _write_results(first_room_dir, result, args.output)

        _write_cowork_symlink(first_room_dir, output_path)
        _print_cross_room_summary(result)

        meta = result["metadata"]
        print(
            f"rs-engine: {len(result['pairs'])} cross-room pairs from "
            f"{meta['artifact_count']} artifacts across "
            f"{len(meta['rooms'])} rooms written to {output_path} "
            f"(model={meta.get('embedding_model', 'n/a')})",
            file=sys.stderr,
        )
        return 0

    if not args.room:
        print(
            f"rs-engine: --room is required for --mode {args.mode} "
            f"(or pass --rooms for cross-room mode)",
            file=sys.stderr,
        )
        return 2

    room_dir = Path(args.room).resolve()
    # Allow the room directory to be auto-created for Mode B when it does
    # not exist yet. Mode A still requires an existing room. This matches
    # the plan's end-to-end smoke which targets /tmp/test-room. Hybrid
    # Mode C requires an existing room (its whole point is room x external).
    if args.mode == "external" and not room_dir.exists():
        try:
            room_dir.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            print(f"rs-engine: could not create {room_dir}: {e}", file=sys.stderr)
            return 1
    if not room_dir.is_dir():
        print(f"rs-engine: {room_dir} is not a directory", file=sys.stderr)
        return 1

    topk = max(1, args.topk)
    threshold = max(0.0, args.threshold)

    try:
        if args.mode == "internal":
            result = run_mode_internal(
                room_dir,
                topk=topk,
                threshold=threshold,
                no_thesis=args.no_thesis,
            )
            output_path = _write_results(room_dir, result, args.output)
        elif args.mode == "hybrid":
            if not args.topic:
                print(
                    "rs-engine: --topic is required for --mode hybrid",
                    file=sys.stderr,
                )
                return 2
            result, corpus_dir = run_mode_hybrid(
                room_dir,
                topic=args.topic,
                topk=topk,
                threshold=threshold,
                no_thesis=args.no_thesis,
                external_target=args.external_target,
            )
            default_path = corpus_dir / RESULTS_FILENAME
            if args.output:
                output_path = Path(args.output).resolve()
                output_path.parent.mkdir(parents=True, exist_ok=True)
                output_path.write_text(
                    json.dumps(result, indent=2), encoding="utf-8",
                )
            else:
                default_path.parent.mkdir(parents=True, exist_ok=True)
                default_path.write_text(
                    json.dumps(result, indent=2), encoding="utf-8",
                )
                output_path = default_path
        else:  # args.mode == "external"
            if not args.topic:
                print(
                    "rs-engine: --topic is required for --mode external",
                    file=sys.stderr,
                )
                return 2
            result, corpus_dir = run_mode_external(
                room_dir,
                topic=args.topic,
                topk=topk,
                threshold=threshold,
                no_thesis=args.no_thesis,
            )
            # Default external output: {room}/research/{topic-slug}/.rs-engine-results.json
            default_path = corpus_dir / RESULTS_FILENAME
            if args.output:
                output_path = Path(args.output).resolve()
                output_path.parent.mkdir(parents=True, exist_ok=True)
                output_path.write_text(
                    json.dumps(result, indent=2), encoding="utf-8",
                )
            else:
                default_path.parent.mkdir(parents=True, exist_ok=True)
                default_path.write_text(
                    json.dumps(result, indent=2), encoding="utf-8",
                )
                output_path = default_path
    except NotImplementedError as e:
        print(f"rs-engine: {e}", file=sys.stderr)
        return 3
    except ValueError as e:
        print(f"rs-engine: {e}", file=sys.stderr)
        return 2
    except Exception as e:  # pragma: no cover - defensive envelope
        print(f"rs-engine: error: {e}", file=sys.stderr)
        return 1

    _write_cowork_symlink(room_dir, output_path)

    meta = result["metadata"]
    if args.mode == "internal":
        print(
            f"rs-engine: {len(result['pairs'])}/{meta['artifact_count']} pairs written to "
            f"{output_path} (model={meta['embedding_model']}, edges={meta['edges_written']})",
            file=sys.stderr,
        )
    elif args.mode == "hybrid":
        print(
            f"rs-engine: {len(result['pairs'])} cross-corpus pairs from "
            f"{meta.get('room_count', 0)} room + {meta.get('external_count', 0)} "
            f"external = {meta.get('artifact_count', 0)} artifacts "
            f"(cache={meta.get('cache_mode', 'n/a')}) written to {output_path} "
            f"(model={meta.get('embedding_model', 'n/a')})",
            file=sys.stderr,
        )
    else:
        tiers = meta.get("tier_counts", {})
        tier_str = ", ".join(f"{k}={v}" for k, v in tiers.items()) or "empty"
        print(
            f"rs-engine: {len(result['pairs'])} pairs from "
            f"{meta.get('artifact_count', 0)} artifacts (corpus={meta.get('corpus_size', 0)}, "
            f"{tier_str}) written to {output_path} "
            f"(model={meta.get('embedding_model', 'n/a')})",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
