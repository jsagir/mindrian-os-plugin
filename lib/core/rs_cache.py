#!/usr/bin/env python3
"""
rs_cache.py -- Pinecone rs-external Index + 30-day Lazy TTL Cache (Phase 89)
============================================================================

Velma-pattern cache for external research corpora: fetch once, embed once,
query forever (within 30 days). Wraps the Pinecone integrated-embedding API
so scripts/rs-engine.py --mode external can skip re-fetching and
re-embedding on repeat runs of the same topic.

Architecture (RESEARCH Q3):
  - Dedicated index 'rs-external' (separate from pws-brain Brain IP index).
  - Per-topic namespace 'external:{topic-slug}' holds the embedded corpus.
  - Records carry metadata: source, doi, title, year, fetched_at, abstract.
  - Text field is 'abstract' per Pinecone fieldMap convention (Pinecone MCP
    rule: consistent schema per index; changing field_map requires a new
    index name).
  - Integrated embedding via multilingual-e5-large (1024-dim), matching the
    pws-brain Brain index so embeddings are semantically compatible.

Freshness policy:
  - TTL 30 days. On query, if max(fetched_at) across the namespace is within
    TTL, skip fetch+upsert and use the cached namespace directly (warm path).
  - Outside TTL or empty namespace, cold path: fetcher runs, upserts, then
    proceeds. Lazy invalidation on query -- no cron job (CLAUDE.md decision:
    plugin runs entirely in Claude's environment, no background daemons).

Public API:
  namespace_slug(topic)                       -> "external:{topic-slug}"
  ensure_index()                              -> pinecone Index handle
  get_namespace_freshness(namespace)          -> age in days, or None if empty
  upsert_corpus(topic, documents)             -> namespace name
  query_namespace(namespace, query, top_k)    -> search results
  fetch_all_from_namespace(namespace, limit)  -> list of {id, values, metadata}

Three-surface coverage (CLAUDE.md tri-polar rule):
  CLI     Consumed by scripts/rs-engine.py --mode external.
  Desktop ReverseSalientAgent invokes rs-engine.py as a child process
          (Plan 89-07).
  Cowork  Cache is per-namespace, not per-room, so team members running
          the same topic share the warm path transparently.

Canon alignment:
  Part 8 Graph Boundary: rs-external is SIGNAL egress only. User-specific
  room content is NEVER written here. What ships to Pinecone is the
  abstract text of public papers (already public via OpenAlex/arXiv) plus
  their public metadata (DOI, title, year). No user artifacts, no user
  decisions, no user meetings.

License: BSL-1.1 (see LICENSE at repo root).
"""

from __future__ import annotations

import os
import re
import sys
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Sequence

# --- Guarded imports ---------------------------------------------------------

try:
    from pinecone import Pinecone  # type: ignore
except ImportError:
    print(
        "rs_cache: pinecone SDK not installed. "
        "Run: pip install -r requirements-hsi.txt",
        file=sys.stderr,
    )
    raise


# --- Constants ---------------------------------------------------------------

INDEX_NAME = "rs-external"
DEFAULT_EMBED_MODEL = "multilingual-e5-large"
EMBED_MODEL = os.environ.get("RS_EMBEDDING_MODEL", DEFAULT_EMBED_MODEL)
# multilingual-e5-large renders to MiniLM-style local fallback elsewhere;
# Pinecone only supports the integrated model name for create_index_for_model.
# When RS_EMBEDDING_MODEL is 'minilm' the rs-external path is a no-op and
# rs-engine.py should route through its local compute_embeddings path.
PINECONE_EMBED_MODEL = DEFAULT_EMBED_MODEL

TTL_DAYS = 30
MAX_NAMESPACE_VECTORS = 10_000
# Pinecone inference batch size for integrated embedding.
UPSERT_BATCH_SIZE = 96
# Pinecone list() page size cap.
LIST_BATCH_SIZE = 96
# Ready poll timeout for index creation.
INDEX_READY_TIMEOUT_SEC = 300


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
    s = (topic or "").strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return f"external:{s}"


# --- Pinecone client + index lifecycle ---------------------------------------


def _pc() -> Pinecone:
    api_key = os.environ.get("PINECONE_API_KEY")
    if not api_key:
        raise RuntimeError(
            "PINECONE_API_KEY not set. rs-external cache requires a Pinecone "
            "API key. Set PINECONE_API_KEY in your environment or run "
            "rs-engine.py with RS_EMBEDDING_MODEL=minilm to skip the Pinecone "
            "path (Mode A / local fallback only)."
        )
    return Pinecone(api_key=api_key)


def ensure_index() -> Any:
    """Create the rs-external index if missing, then return an Index handle.

    fieldMap convention (Pinecone MCP rule): the text field is "abstract".
    Once the index exists with a given field_map, changing it would require
    a new index name -- this function NEVER recreates. Plan 89-03 Risk 2.
    """
    pc = _pc()
    try:
        exists = pc.has_index(INDEX_NAME)
    except Exception:
        # Fallback for SDK versions that do not expose has_index directly.
        names = [getattr(i, "name", None) for i in pc.list_indexes()]
        exists = INDEX_NAME in names

    if not exists:
        pc.create_index_for_model(
            name=INDEX_NAME,
            cloud="aws",
            region="us-east-1",
            embed={
                "model": PINECONE_EMBED_MODEL,
                "field_map": {"text": "abstract"},
            },
        )
        # Poll until ready. The describe_index response exposes `.status` as
        # an object with `.ready` attribute (see scripts/consolidate-pinecone.py
        # line 147 for the pattern in use). Plan 89-03 wrote this as a dict
        # lookup which would raise AttributeError on the real SDK -- Rule 1.
        deadline = time.time() + INDEX_READY_TIMEOUT_SEC
        while True:
            desc = pc.describe_index(INDEX_NAME)
            ready = False
            try:
                ready = bool(desc.status.ready)  # type: ignore[attr-defined]
            except AttributeError:
                status = getattr(desc, "status", {}) or {}
                if isinstance(status, dict):
                    ready = bool(status.get("ready"))
            if ready:
                break
            if time.time() > deadline:
                raise RuntimeError(
                    f"rs_cache: index {INDEX_NAME!r} did not become ready "
                    f"within {INDEX_READY_TIMEOUT_SEC}s"
                )
            time.sleep(2)

    return pc.Index(INDEX_NAME)


# --- Freshness -------------------------------------------------------------


def _namespace_vector_count(idx: Any, namespace: str) -> int:
    """Return the vector_count for the namespace, or 0 if absent.

    describe_index_stats returns a DescribeIndexStatsResponse; both attribute
    access (.namespaces) and .to_dict() shapes are supported across SDK
    versions. This function tolerates both.
    """
    try:
        stats = idx.describe_index_stats()
    except Exception:
        return 0

    ns_map: Dict[str, Any] = {}
    # Attribute form.
    namespaces_attr = getattr(stats, "namespaces", None)
    if isinstance(namespaces_attr, dict):
        ns_map = namespaces_attr
    else:
        try:
            d = stats.to_dict()
            ns_map = d.get("namespaces", {}) or {}
        except Exception:
            ns_map = {}

    entry = ns_map.get(namespace)
    if not entry:
        return 0
    if isinstance(entry, dict):
        return int(entry.get("vector_count", 0) or 0)
    return int(getattr(entry, "vector_count", 0) or 0)


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


def get_namespace_freshness(namespace: str) -> Optional[float]:
    """Return age-in-days of the namespace's max fetched_at.

    Returns None if:
      - The namespace does not exist or is empty.
      - No fetched_at metadata is present on any sampled record.
      - Any error occurs reaching Pinecone (treated as "unknown -> refetch").

    Sampling strategy: the integrated-embedding index does not accept raw
    vectors to .query() (that API is for inference-disabled indexes). We
    sample one record via list() + fetch() and read its fetched_at
    metadata. All records in a namespace share a common upsert timestamp
    (upsert_corpus stamps them with a single `now`), so one sample is
    sufficient for warm-vs-cold decisions under the 30-day TTL.

    Plan 89-03 proposed a raw-vector query for this purpose -- that would
    raise on an integrated-embedding index. Rule 1 bug fix: sample via
    list+fetch instead. The behavioral contract (age or None) is preserved.
    """
    try:
        idx = ensure_index()
    except Exception as e:
        print(f"rs_cache: freshness check skipped ({e})", file=sys.stderr)
        return None

    if _namespace_vector_count(idx, namespace) == 0:
        return None

    sample_id: Optional[str] = None
    try:
        for ids_batch in idx.list(namespace=namespace, limit=1):
            if ids_batch:
                sample_id = ids_batch[0]
                break
    except Exception:
        return None

    if not sample_id:
        return None

    try:
        fetched = idx.fetch(ids=[sample_id], namespace=namespace)
    except Exception:
        return None

    vectors_map: Dict[str, Any] = {}
    vectors_attr = getattr(fetched, "vectors", None)
    if isinstance(vectors_attr, dict):
        vectors_map = vectors_attr
    else:
        try:
            vectors_map = fetched.to_dict().get("vectors", {}) or {}
        except Exception:
            vectors_map = {}

    rec = vectors_map.get(sample_id)
    if rec is None:
        return None

    metadata: Dict[str, Any] = {}
    if isinstance(rec, dict):
        metadata = rec.get("metadata", {}) or {}
    else:
        metadata = getattr(rec, "metadata", {}) or {}

    fetched_at = _parse_fetched_at(metadata.get("fetched_at"))
    if fetched_at is None:
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


def upsert_corpus(topic: str, documents: Sequence[Dict[str, Any]]) -> str:
    """Upsert fetched docs into the topic's namespace. Returns the namespace.

    Guardrail: raises ValueError when the corpus exceeds MAX_NAMESPACE_VECTORS
    so a single topic cannot silently balloon into a 100k-vector namespace.
    Plan 89-03 Risk 3 mitigation -- the caller should shard by year or
    scope the topic tighter before re-running.

    fetched_at is stamped once per call. All records in the batch share the
    same timestamp, which lets get_namespace_freshness sample any one record
    and infer the whole namespace's TTL position.
    """
    if len(documents) > MAX_NAMESPACE_VECTORS:
        raise ValueError(
            f"rs_cache: topic {topic!r} has {len(documents)} docs > "
            f"{MAX_NAMESPACE_VECTORS}. Shard by year or tighten the topic."
        )

    idx = ensure_index()
    ns = namespace_slug(topic)
    stamp = datetime.now(timezone.utc).isoformat()
    records = _build_records(documents, stamp)

    if not records:
        # Nothing usable; keep behavior predictable and do not touch the
        # namespace. Upstream will treat this as a miss next run.
        return ns

    for i in range(0, len(records), UPSERT_BATCH_SIZE):
        batch = records[i:i + UPSERT_BATCH_SIZE]
        idx.upsert_records(namespace=ns, records=batch)

    return ns


# --- Query ------------------------------------------------------------------


def query_namespace(
    namespace: str,
    query_text: str,
    top_k: int = 100,
) -> Any:
    """Run a text query against the namespace. Integrated embedding at search
    time -- Pinecone embeds the query with the same multilingual-e5-large
    model used at upsert.

    Returns the raw SearchRecordsResponse. Callers walk `.result.hits` (or
    equivalent) to extract ids and scores.
    """
    idx = ensure_index()
    return idx.search(
        namespace=namespace,
        query={"inputs": {"text": query_text}, "top_k": max(1, int(top_k))},
    )


def fetch_all_from_namespace(
    namespace: str,
    limit: int = MAX_NAMESPACE_VECTORS,
) -> List[Dict[str, Any]]:
    """Retrieve records (id + values + metadata) from a namespace.

    Used by scripts/rs-engine.py --mode external warm path to build the
    semantic similarity matrix from cached vectors instead of re-embedding
    on every run.

    Pinecone `fetch` returns records with `.values` (1024-dim embedding) and
    `.metadata` (abstract, title, doi, year, source, fetched_at). On an
    integrated-embedding index, values are populated at upsert time.

    `limit` caps results; the function returns up to `limit` records in
    list() order (Pinecone does not guarantee ordering). Use
    MAX_NAMESPACE_VECTORS when the caller wants everything.
    """
    if limit <= 0:
        return []

    idx = ensure_index()
    out: List[Dict[str, Any]] = []

    for ids_batch in idx.list(namespace=namespace, limit=LIST_BATCH_SIZE):
        if not ids_batch:
            continue
        try:
            fetched = idx.fetch(ids=ids_batch, namespace=namespace)
        except Exception as e:
            print(f"rs_cache: fetch batch failed ({e})", file=sys.stderr)
            continue

        vectors_map: Dict[str, Any] = {}
        vectors_attr = getattr(fetched, "vectors", None)
        if isinstance(vectors_attr, dict):
            vectors_map = vectors_attr
        else:
            try:
                vectors_map = fetched.to_dict().get("vectors", {}) or {}
            except Exception:
                vectors_map = {}

        for rid, rec in vectors_map.items():
            if isinstance(rec, dict):
                values = rec.get("values") or []
                metadata = rec.get("metadata", {}) or {}
            else:
                values = list(getattr(rec, "values", []) or [])
                metadata = getattr(rec, "metadata", {}) or {}
            out.append({
                "id": rid,
                "values": list(values) if values is not None else [],
                "metadata": dict(metadata) if isinstance(metadata, dict) else {},
            })
            if len(out) >= limit:
                return out

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
    "ensure_index",
    "get_namespace_freshness",
    "upsert_corpus",
    "query_namespace",
    "fetch_all_from_namespace",
    "is_fresh",
]
