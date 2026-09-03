#!/usr/bin/env python3
"""
rs_cache.py -- Per-Room Local Signal Corpus Cache (Phase 296 Plan 04)
=======================================================================

Fetch-once, embed-once, read-forever cache for the RS external/hybrid
signal corpus. Documents come from `lib.core.rs_corpus.fetch_corpus`
(OpenAlex, arXiv, Tavily -- untouched by this module). Embedding goes
through `scripts/rs-vector-bridge.cjs`, which wraps the single shipped
local encoder (`lib/core/eureka/embedding-spine.cjs::embedTexts`). This
module never instantiates a second encoder and never talks to a remote
vector service.

Retirement note: this file previously carried a remote-index integration
(create/describe/upsert/search against a hosted vector service, gated on
a hosted-service API key). Phase 272's own `lib/core/pinecone-inference.cjs`
header explicitly deferred that surface's retirement to a follow-up phase.
Phase 296 plan 04 is that follow-up phase. The removed symbols were the
client-handle constructor, the index-ensure/create routine, the
namespace-vector-count helper, the raw text-query routine, and their
supporting batch-size and ready-poll constants. None of them survive; see
the storage-layout section below for what replaced them.

Storage layout (the planner_decision in 296-04-PLAN.md):

    <room>/research/<topic-slug>/.rs-signal-cache/vectors.jsonl
    <room>/research/<topic-slug>/.rs-signal-cache/manifest.json

`vectors.jsonl` holds one JSON object per line: `{"id", "values", "metadata"}`,
the same shape the prior remote path returned, so `_records_to_artifacts`
in `scripts/rs-engine.py` keeps working unchanged. `manifest.json` records
`schema_version`, `namespace`, `topic`, `topic_slug`, `embedding_model`,
`embedding_dim`, `fetched_at` and `count`. Both files are written to a
`.tmp` sibling and moved into place with `os.replace`, so a reader never
observes a half-written file and a failed embed never overwrites a prior
good cache.

Freshness and invalidation: `TTL_DAYS` unchanged at 30. A manifest whose
`embedding_model` no longer matches the encoder the bridge currently
reports reads as stale and triggers a cold refetch -- the same
self-healing shape `.rs-engine-cache.json` already uses elsewhere in this
subsystem, just keyed on model identity instead of a text hash. This is
what keeps a cache written by one encoder from ever being mixed into a
cosine computed by a different one.

Room scope and its asymmetry: every read function resolves a room via
`_resolve_room` (explicit argument, then the `MINDRIAN_RS_ROOM` env var,
then `MINDRIAN_ROOM`, then no scope at all) and, on no scope, prints one
stderr line and returns an empty result rather than raising.
`upsert_corpus` takes the opposite position: with no room scope it raises
`ValueError`, because writing a cache into a guessed room is worse than
failing loudly. That asymmetry is deliberate, not an oversight.

Per-room by construction (closes SEED-029 finding F8): the previous
remote path kept one namespace per topic, with no room dimension in the
key at all -- which is exactly how it was once observed serving a prior
project's corpus into an unrelated room. A path rooted at `<room>/` cannot
express a cross-room key. The same topic cached in two different rooms is
two independent caches, by design, not a shared warm path.

Canon Part 8 (Graph Boundary): after this change, this module makes ZERO
network calls. There is no egress class left here, so no outbound-audit
pairing applies to this file. The one surviving network egress on this
whole path is `lib.core.rs_corpus.fetch_corpus` (OpenAlex, arXiv, Tavily),
which this module does not touch and which keeps its own guards.

Canon Part 9 (Write Boundary): the sidecar this module writes is NOT
room.db. It creates no graph node, no typed edge and no memory-event row,
so the room.db chokepoint that gates those writes is not involved here at
all. It is a rebuildable derived projection of a fetch that can always be
re-run -- delete the sidecar and the next call re-fetches and re-embeds.

Three-surface coverage (CLAUDE.md tri-polar rule):
  CLI     Consumed by scripts/rs-engine.py --mode external / --mode hybrid.
  Desktop ReverseSalientAgent invokes rs-engine.py as a child process.
  Cowork  The cache is scoped to a single room's filesystem. Two team
          members running the same topic in two different rooms get two
          independent caches; nothing here makes them share a warm path.

Known temporary state after this plan lands: `scripts/rs-engine.py` and
`lib.core.rs_hybrid` still call the read/write functions below without a
`room_dir` argument. Every function here defaults `room_dir` to `None` and
falls back to the `MINDRIAN_RS_ROOM` / `MINDRIAN_ROOM` environment
variables, so those callers degrade to an empty external corpus rather
than crashing. Threading the room argument through those call sites is
plan 296-05's job, not this one's.

Public API:
  namespace_slug(topic)                                -> "external:{topic-slug}"
  cache_dir(room_dir, topic)                            -> sidecar Path
  get_namespace_freshness(namespace, room_dir=None)     -> age in days, or None
  upsert_corpus(topic, documents, room_dir=None)        -> namespace name
  fetch_all_from_namespace(namespace, limit, room_dir=None) -> list of {id, values, metadata}
  is_fresh(age_days, ttl_days=TTL_DAYS)                 -> bool

License: BSL-1.1 (see LICENSE at repo root).
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

# Defensive two-form import so this module resolves whether the caller has
# put `lib/core` on sys.path directly (bare `rs_corpus`) or the repo root
# (`lib.core.rs_corpus`) -- the same shim `lib/core/rs_hybrid.py` already
# uses for its sibling `rs_corpus_exclude` import.
try:  # pragma: no cover -- import-context shim
    from rs_corpus import topic_slug
except ImportError:  # pragma: no cover
    from lib.core.rs_corpus import topic_slug


# --- Constants ---------------------------------------------------------------

# The cache-family name. It keeps namespace_slug's "external:" prefix
# meaningful (a stable label for this corpus family) -- it no longer names
# a remote index of any kind.
INDEX_NAME = "rs-external"

TTL_DAYS = 30
MAX_NAMESPACE_VECTORS = 10_000

CACHE_DIRNAME = ".rs-signal-cache"
VECTORS_FILENAME = "vectors.jsonl"
MANIFEST_FILENAME = "manifest.json"
SCHEMA_VERSION = 1

# Per-batch subprocess timeout for the embed bridge call.
BRIDGE_TIMEOUT_SEC = 120
# Texts per bridge subprocess call.
EMBED_BATCH = 64

# REPO_ROOT is derived from this file's own location, never from the
# current working directory, so the bridge resolves correctly regardless
# of where the caller was invoked from.
_THIS_FILE = Path(__file__).resolve()
_REPO_ROOT = _THIS_FILE.parent.parent.parent
_DEFAULT_BRIDGE_PATH = _REPO_ROOT / "scripts" / "rs-vector-bridge.cjs"

# Module-level provenance cache, populated once per process by
# _bridge_provenance(). Sentinel key distinguishes "not yet probed" from
# "probed and the bridge is unavailable" (value None).
_PROVENANCE_CACHE: Dict[str, Optional[Dict[str, Any]]] = {}


# --- Slug ------------------------------------------------------------------


def namespace_slug(topic: str) -> str:
    """Return the canonical namespace name for a topic.

    The slug lowercases, replaces non-alphanumeric runs with a single hyphen,
    strips leading/trailing hyphens, and prefixes with "external:" so
    namespaces written by this module cannot collide with any Mode A
    room-local namespace pattern.

    Plan verify block 2 asserts:
        namespace_slug('Quantum Biology & Sensing!') == 'external:quantum-biology-sensing'
    """
    import re

    s = (topic or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return f"external:{s}"


def _slug_from_namespace(namespace: str) -> str:
    """Recover the bare topic slug from a namespace_slug() output.

    namespace_slug and rs_corpus.topic_slug apply the same normalization,
    so the slug half of "external:{slug}" is exactly what topic_slug(topic)
    would have produced -- this lets the read functions locate the sidecar
    from a namespace string alone, with no topic string in hand.
    """
    return namespace.split(":", 1)[1] if ":" in namespace else namespace


# --- Room resolution ---------------------------------------------------------


def _resolve_room(room_dir: Optional[Any] = None) -> Optional[Path]:
    """Resolve the active room directory.

    Precedence: the explicit argument, then MINDRIAN_RS_ROOM, then
    MINDRIAN_ROOM, then None. Returns a pathlib.Path or None.

    Read functions treat None as "no scope" and return empty with one
    stderr line. upsert_corpus raises ValueError on None instead, because
    writing a cache into a guessed room is worse than failing loudly.
    """
    if room_dir:
        return Path(room_dir)
    env_room = os.environ.get("MINDRIAN_RS_ROOM")
    if env_room:
        return Path(env_room)
    env_room = os.environ.get("MINDRIAN_ROOM")
    if env_room:
        return Path(env_room)
    return None


def cache_dir(room_dir: Any, topic: str) -> Path:
    """Return the sidecar directory for a topic in a given room.

    <room>/research/<topic-slug>/.rs-signal-cache/
    """
    return Path(room_dir) / "research" / topic_slug(topic) / CACHE_DIRNAME


# --- Embed bridge ------------------------------------------------------------


def _bridge_command() -> Tuple[str, str]:
    node_bin = os.environ.get("MINDRIAN_NODE", "node")
    bridge_path = os.environ.get("MINDRIAN_RS_BRIDGE", str(_DEFAULT_BRIDGE_PATH))
    return node_bin, bridge_path


def _run_bridge(op: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Run one op against scripts/rs-vector-bridge.cjs and return the parsed
    success envelope, or None on any failure. Never raises.
    """
    node_bin, bridge_path = _bridge_command()
    try:
        proc = subprocess.run(
            [node_bin, bridge_path, op],
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            timeout=BRIDGE_TIMEOUT_SEC,
        )
    except FileNotFoundError as e:
        print(f"rs_cache: bridge node binary not found ({e})", file=sys.stderr)
        return None
    except subprocess.TimeoutExpired:
        print(
            f"rs_cache: bridge op {op!r} timed out after {BRIDGE_TIMEOUT_SEC}s",
            file=sys.stderr,
        )
        return None
    except Exception as e:  # pragma: no cover -- defensive, never raise upward
        print(f"rs_cache: bridge op {op!r} failed to launch ({e})", file=sys.stderr)
        return None

    if proc.returncode != 0:
        print(
            f"rs_cache: bridge op {op!r} exited {proc.returncode}",
            file=sys.stderr,
        )
        return None

    try:
        parsed = json.loads(proc.stdout)
    except (ValueError, TypeError):
        print(f"rs_cache: bridge op {op!r} returned unparseable output", file=sys.stderr)
        return None

    if not isinstance(parsed, dict) or parsed.get("success") is not True:
        tag = parsed.get("error") if isinstance(parsed, dict) else "malformed_response"
        print(f"rs_cache: bridge op {op!r} failed ({tag})", file=sys.stderr)
        return None

    return parsed


def _bridge_provenance() -> Optional[Dict[str, Any]]:
    """Return {model, dtype, dim} for the current encoder, cached once per
    process. On any failure, caches and returns None so a caller never pays
    a repeated model-load cost chasing an unavailable bridge.
    """
    if "value" in _PROVENANCE_CACHE:
        return _PROVENANCE_CACHE["value"]

    result = _run_bridge("embed", {"texts": ["rs_cache provenance probe"]})
    provenance: Optional[Dict[str, Any]] = None
    if result is not None:
        prov = result.get("provenance")
        dim = result.get("dim")
        if isinstance(prov, dict):
            provenance = {
                "model": prov.get("model"),
                "dtype": prov.get("dtype"),
                "dim": dim if dim is not None else prov.get("dim"),
            }

    _PROVENANCE_CACHE["value"] = provenance
    return provenance


def _embed_via_bridge(
    texts: Sequence[str],
) -> Tuple[List[List[float]], Optional[Dict[str, Any]]]:
    """Embed every text through the bridge, batched at EMBED_BATCH. Returns
    (vectors, provenance) in input order, or ([], None) on any failure --
    including a shape mismatch, which is treated as a failure rather than a
    partially embedded corpus (Pitfall 4's silent-degrade class).
    """
    if not texts:
        return [], None

    all_vectors: List[List[float]] = []
    provenance: Optional[Dict[str, Any]] = None
    expected_len: Optional[int] = None

    for i in range(0, len(texts), EMBED_BATCH):
        batch = list(texts[i : i + EMBED_BATCH])
        result = _run_bridge("embed", {"texts": batch})
        if result is None:
            return [], None

        vectors = result.get("vectors")
        if not isinstance(vectors, list) or len(vectors) != len(batch):
            print(
                "rs_cache: embed batch returned a vector count that does not "
                "match the input batch",
                file=sys.stderr,
            )
            return [], None

        for v in vectors:
            if not isinstance(v, list):
                print("rs_cache: embed batch returned a non-list vector", file=sys.stderr)
                return [], None
            if expected_len is None:
                expected_len = len(v)
            elif len(v) != expected_len:
                print(
                    "rs_cache: embed batch returned vectors of mismatched length",
                    file=sys.stderr,
                )
                return [], None

        all_vectors.extend(vectors)

        prov = result.get("provenance")
        dim = result.get("dim")
        if isinstance(prov, dict):
            provenance = {
                "model": prov.get("model"),
                "dtype": prov.get("dtype"),
                "dim": dim if dim is not None else prov.get("dim"),
            }

    if provenance is None:
        return [], None

    return all_vectors, provenance


# --- Freshness -------------------------------------------------------------


def _parse_fetched_at(raw: Any) -> Optional[datetime]:
    """Parse an ISO-8601 fetched_at string. Tolerates trailing 'Z'."""
    if not raw:
        return None
    if isinstance(raw, datetime):
        return raw
    if not isinstance(raw, str):
        return None
    s = raw.strip()
    if not s:
        return None
    # Python's fromisoformat accepts offsets but not trailing 'Z' until 3.11.
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _load_manifest(sidecar_dir: Path) -> Optional[Dict[str, Any]]:
    manifest_path = sidecar_dir / MANIFEST_FILENAME
    if not manifest_path.exists():
        return None
    try:
        with manifest_path.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def get_namespace_freshness(namespace: str, room_dir: Optional[Any] = None) -> Optional[float]:
    """Return age-in-days of the cached namespace's fetched_at stamp.

    Returns None when: the room cannot be resolved, the manifest is missing
    or unparseable, count is 0, fetched_at is unparseable, or the
    manifest's embedding_model differs from the encoder the bridge
    currently reports (the model-change invalidation).

    The namespace argument is retained for signature compatibility with
    every existing caller; the room plus the topic slug recovered from the
    namespace is what actually locates the cache on disk.
    """
    room = _resolve_room(room_dir)
    if room is None:
        print("rs_cache: freshness check skipped, no room scope", file=sys.stderr)
        return None

    slug = _slug_from_namespace(namespace)
    sidecar_dir = Path(room) / "research" / slug / CACHE_DIRNAME
    manifest = _load_manifest(sidecar_dir)
    if manifest is None:
        return None

    count = manifest.get("count")
    if not count:
        return None

    fetched_at = _parse_fetched_at(manifest.get("fetched_at"))
    if fetched_at is None:
        return None

    provenance = _bridge_provenance()
    current_model = provenance.get("model") if provenance else None
    if current_model is not None and manifest.get("embedding_model") != current_model:
        return None

    now = datetime.now(timezone.utc)
    delta = now - fetched_at
    return max(0.0, delta.total_seconds() / 86400.0)


# --- Upsert ------------------------------------------------------------------


def _build_records(documents: Sequence[Dict[str, Any]], stamp: str) -> List[Dict[str, Any]]:
    records: List[Dict[str, Any]] = []
    for d in documents:
        external_id = (d.get("external_id") or "").strip()
        if not external_id:
            # Skip records without a stable id -- they cannot be retrieved
            # deterministically and would pollute the namespace.
            continue
        abstract = (d.get("abstract") or "").strip()
        if not abstract:
            continue
        rec: Dict[str, Any] = {
            "_id": external_id,
            "abstract": abstract,
            "source": (d.get("source") or "unknown")[:64],
            "doi": (d.get("doi") or "")[:256],
            "title": (d.get("title") or "")[:500],
            "year": int(d.get("year") or 0),
            "fetched_at": stamp,
        }
        records.append(rec)
    return records


def _atomic_write_text(path: Path, content: str) -> None:
    tmp_path = path.parent / (path.name + ".tmp")
    with tmp_path.open("w", encoding="utf-8") as f:
        f.write(content)
    os.replace(tmp_path, path)


def upsert_corpus(
    topic: str,
    documents: Sequence[Dict[str, Any]],
    room_dir: Optional[Any] = None,
) -> str:
    """Embed and cache fetched docs into the topic's per-room sidecar.
    Returns the namespace.

    Guardrail: raises ValueError when the corpus exceeds
    MAX_NAMESPACE_VECTORS so a single topic cannot silently balloon into an
    oversized cache. Also raises ValueError when no room can be resolved --
    writing into a guessed room is worse than failing loudly.

    fetched_at is stamped once per call. All records in the batch share the
    same timestamp, which lets get_namespace_freshness read one manifest
    field and infer the whole cache's TTL position.

    If embedding fails for any reason, no partial cache is written: any
    prior cache is left untouched, one stderr line is printed, and the
    namespace is returned so the caller treats this run as a miss.
    """
    if len(documents) > MAX_NAMESPACE_VECTORS:
        raise ValueError(
            f"rs_cache: topic {topic!r} has {len(documents)} docs > "
            f"{MAX_NAMESPACE_VECTORS}. Shard by year or tighten the topic."
        )

    room = _resolve_room(room_dir)
    if room is None:
        raise ValueError(
            "rs_cache: cannot upsert with no room scope. Pass room_dir, or "
            "set MINDRIAN_RS_ROOM / MINDRIAN_ROOM. Writing a cache into a "
            "guessed room is worse than failing loudly."
        )

    ns = namespace_slug(topic)
    stamp = datetime.now(timezone.utc).isoformat()
    records = _build_records(documents, stamp)

    if not records:
        # Nothing usable; keep behavior predictable and do not touch the
        # cache. Upstream will treat this as a miss next run.
        return ns

    abstracts = [r["abstract"] for r in records]
    vectors, provenance = _embed_via_bridge(abstracts)

    if not vectors or provenance is None or len(vectors) != len(records):
        print(
            f"rs_cache: embedding unavailable for topic {topic!r}; leaving "
            f"any prior cache untouched",
            file=sys.stderr,
        )
        return ns

    sidecar_dir = cache_dir(room, topic)
    sidecar_dir.mkdir(parents=True, exist_ok=True)

    lines: List[str] = []
    for rec, vec in zip(records, vectors):
        metadata = {k: v for k, v in rec.items() if k != "_id"}
        lines.append(json.dumps({"id": rec["_id"], "values": vec, "metadata": metadata}))
    _atomic_write_text(sidecar_dir / VECTORS_FILENAME, "\n".join(lines) + "\n")

    manifest = {
        "schema_version": SCHEMA_VERSION,
        "namespace": ns,
        "topic": topic,
        "topic_slug": topic_slug(topic),
        "embedding_model": provenance.get("model"),
        "embedding_dim": provenance.get("dim"),
        "fetched_at": stamp,
        "count": len(records),
    }
    _atomic_write_text(sidecar_dir / MANIFEST_FILENAME, json.dumps(manifest))

    return ns


# --- Read ----------------------------------------------------------------


def fetch_all_from_namespace(
    namespace: str,
    limit: int = MAX_NAMESPACE_VECTORS,
    room_dir: Optional[Any] = None,
) -> List[Dict[str, Any]]:
    """Retrieve cached records (id + values + metadata) for a namespace.

    Returns [] when limit <= 0, the room cannot be resolved, or no sidecar
    exists yet. Streams vectors.jsonl line by line; a malformed line is
    skipped with one stderr line rather than aborting the whole read.
    Never raises.
    """
    if limit <= 0:
        return []

    room = _resolve_room(room_dir)
    if room is None:
        print("rs_cache: fetch skipped, no room scope", file=sys.stderr)
        return []

    slug = _slug_from_namespace(namespace)
    vectors_path = Path(room) / "research" / slug / CACHE_DIRNAME / VECTORS_FILENAME
    if not vectors_path.exists():
        return []

    out: List[Dict[str, Any]] = []
    try:
        with vectors_path.open("r", encoding="utf-8") as f:
            for line_no, raw_line in enumerate(f, start=1):
                line = raw_line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                except ValueError:
                    print(
                        f"rs_cache: skipping malformed line {line_no} in {vectors_path}",
                        file=sys.stderr,
                    )
                    continue
                if not isinstance(rec, dict):
                    print(
                        f"rs_cache: skipping non-object line {line_no} in {vectors_path}",
                        file=sys.stderr,
                    )
                    continue
                values = rec.get("values")
                metadata = rec.get("metadata")
                out.append(
                    {
                        "id": rec.get("id"),
                        "values": list(values) if isinstance(values, list) else [],
                        "metadata": dict(metadata) if isinstance(metadata, dict) else {},
                    }
                )
                if len(out) >= limit:
                    break
    except OSError as e:
        print(f"rs_cache: could not read {vectors_path} ({e})", file=sys.stderr)
        return []

    return out


# --- TTL helpers (public for callers that want policy control) ------------


def is_fresh(age_days: Optional[float], ttl_days: int = TTL_DAYS) -> bool:
    """True when the namespace age is known and under the TTL."""
    if age_days is None:
        return False
    return age_days <= ttl_days


__all__ = [
    "INDEX_NAME",
    "TTL_DAYS",
    "MAX_NAMESPACE_VECTORS",
    "namespace_slug",
    "cache_dir",
    "get_namespace_freshness",
    "upsert_corpus",
    "fetch_all_from_namespace",
    "is_fresh",
]
