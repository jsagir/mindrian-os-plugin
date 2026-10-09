#!/usr/bin/env python3
"""
rs_hybrid.py -- Room x External Unified Corpus (Phase 89 Plan 89-05)
=====================================================================

Mode C builder: unifies a user room's artifacts with an external research
corpus into a single indexable corpus, plus a cross-corpus post-filter
that keeps only pairs where one side is a room artifact and the other is
an external document.

Architecture (Plan 89-05, external cache repointed by Plan 296-05):
  - Room side: walk the room filesystem (skip lazygraph, obsidian, etc.),
    reuse the discover_artifacts pattern from scripts/rs-engine.py so Mode
    A and Mode C see the same artifact shape.
  - External side: reuse the per-room local signal cache (lib.core.rs_cache,
    Plan 296-05; was the Pinecone rs-external cache in Plan 89-03). Cold
    path fetches via lib.core.rs_corpus and upserts to the room's own
    sidecar; warm path reads the cached local-encoder vectors directly.
  - Unified corpus: flat list of dicts with `origin` in {room, external}
    and `global_id` that is globally unique across both sides.
  - origin_mask: numpy bool array, True=room, False=external. Enables O(1)
    cross-corpus pair filtering in rs-engine.

Public API:
  build_unified_corpus(room_path, topic, external_target=2000)
      -> (corpus, origin_mask, metadata)
  filter_cross_corpus_pairs(pairs, origin_mask, topk)
      -> list[dict]  pairs where origin_mask[i] != origin_mask[j]

Part 8 Graph Boundary (Canon, mandatory):
  Zero user-content egress. Room artifacts are read locally and used as
  LSA / semantic inputs in-process only. Nothing is stored in a remote
  service on this path any more (Plan 296-05): external abstracts and
  public metadata (via rs_cache.upsert_corpus) are cached in the room's own
  local sidecar and never leave the machine after the OpenAlex/arXiv/Tavily
  fetch. Room content never touches that sidecar either -- the two sides
  stay in separate dict shapes (origin=room vs origin=external) all the way
  through this module.

Three-surface coverage (CLAUDE.md tri-polar rule):
  CLI     Consumed by scripts/rs-engine.py --mode hybrid.
  Desktop ReverseSalientAgent invokes rs-engine.py as a child process
          (Plan 89-07 wires the conversational trigger).
  Cowork  When COWORK=1, the hybrid results symlink into 00_Context/
          at the rs-engine CLI layer (unchanged from Mode A/B).

License: BSL-1.1 (see LICENSE at repo root).
  Licensed under the Business Source License 1.1. Change Date 2029-04-24.
  Change License Apache 2.0.
"""

from __future__ import annotations

import math
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

try:
    import numpy as np
except ImportError:
    print(
        "rs_hybrid requires numpy. Run: pip install -r requirements-hsi.txt",
        file=sys.stderr,
    )
    raise


# --- Shared constants mirrored from scripts/rs-engine.py --------------------

# SKIP_FILES / SKIP_DIRS / MIN_BODY_CHARS come from the ONE shared source
# (Phase 200-01, SEED-018). Do not redefine them here -- the drift between three
# local copies was the literal 706-inflation bug. Defensive import so this module
# works both as bare `rs_hybrid` (lib/core on path) and as `lib.core.rs_hybrid`
# (repo root on path).
try:  # pragma: no cover -- import-context shim
    from rs_corpus_exclude import SKIP_DIRS, SKIP_FILES, MIN_BODY_CHARS
except ImportError:  # pragma: no cover
    from lib.core.rs_corpus_exclude import SKIP_DIRS, SKIP_FILES, MIN_BODY_CHARS

# 2026: bounds so one pathological file cannot exhaust memory in the LSA fit.
MAX_ARTIFACT_BYTES = 5_000_000
MAX_BODY_CHARS = 200_000

# Maximum external docs we will fold into the unified corpus. Plan 89-05
# canonical value is 2000 (aligns with the local signal cache's namespace
# cap MAX_NAMESPACE_VECTORS = 10_000 / 5, leaving room for multiple topics).
DEFAULT_EXTERNAL_TARGET = 2000

# External target is bounded so a misconfigured caller cannot balloon the
# corpus into a 50k-vector LSA fit that blows memory.
MAX_EXTERNAL_TARGET = 5000


# --- Frontmatter + body helpers (mirror scripts/rs-engine.py) ---------------

def _parse_frontmatter_skip(content: str) -> str:
    """Strip a YAML frontmatter block if present; return the rest.

    2026: accepts CRLF line endings and a leading BOM (the \\n-only pattern left
    the whole frontmatter in the text of any file saved on Windows)."""
    fm_match = re.match(r"^\ufeff?---\r?\n[\s\S]*?\r?\n---\r?\n?", content)
    if fm_match:
        return content[fm_match.end():]
    return content


def _extract_title(content: str, filepath: Path) -> str:
    match = re.search(r"^# (.+)$", content, re.MULTILINE)
    if match:
        return match.group(1).strip()
    return filepath.stem.replace("-", " ").title()


# --- Room artifact loader ---------------------------------------------------

def _load_room_artifacts(room_path: Path) -> List[Dict[str, Any]]:
    """Walk room_path for .md artifacts. Returns room-origin dicts.

    Each artifact carries:
      - global_id: f"room::{room_id}::{artifact_id}"  (unique across corpus)
      - origin:    "room"
      - room_id:   basename of the room directory
      - artifact_id: relative path stem (section/name)
      - section:   first path segment under the room
      - title:     first H1 or humanized filename
      - text:      post-frontmatter body (the LSA / semantic input)

    Pattern reuse: mirrors scripts/rs-engine.py:discover_artifacts byte-for-
    byte so single-room Mode A and hybrid Mode C file the same artifact the
    same way. Plan 89-01 Deviation #2 (no SQLite artifacts table) carries
    through -- we walk the filesystem.
    """
    artifacts: List[Dict[str, Any]] = []
    room_id = room_path.name

    for root, dirs, files in os.walk(room_path):
        # 2026: os.walk yields directories in filesystem order; sort so artifact
        # order (and every pair index built on it) is reproducible.
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
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
                if fpath.stat().st_size > MAX_ARTIFACT_BYTES:
                    print(f"[rs-hybrid] skipping oversized artifact {fpath}", file=sys.stderr)
                    continue
                content = fpath.read_text(encoding="utf-8-sig")
            except (OSError, UnicodeDecodeError):
                continue
            body = _parse_frontmatter_skip(content).strip()
            if len(body) < MIN_BODY_CHARS:
                continue
            if len(body) > MAX_BODY_CHARS:
                body = body[:MAX_BODY_CHARS]
            artifact_id = str(rel_root / Path(fname).stem).replace(os.sep, "/")
            title = _extract_title(content, fpath)
            artifacts.append({
                "global_id": f"room::{room_id}::{artifact_id}",
                "origin": "room",
                "room_id": room_id,
                "artifact_id": artifact_id,
                "section": section,
                "title": title,
                "path": str(fpath.relative_to(room_path)),
                "text": body,
            })
    return artifacts


# --- External loader (via rs_cache) -----------------------------------------

def _load_external_records(
    topic: str,
    external_target: int,
    room_dir: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Fetch (cold) or read (warm) the external corpus via the per-room local
    signal cache (Plan 296-05; was Plan 89-03's Pinecone cache).

    Returns (records, cache_meta).
      records:    list of {id, values, metadata} as returned by rs_cache.
      cache_meta: {cache_mode, cache_age_days, cache_namespace, cache_ttl_days,
                   corpus_size}.

    Routes:
      - If rs_cache fails to import, or room_dir does not resolve: returns
        ([], {"cache_mode": "bypass", ...}). Caller falls back to local
        MiniLM + rs_corpus fetch (Plan 89-02 path).
      - If cache is warm (age <= TTL): skip fetch, return cached records.
      - If cold: fetch via rs_corpus, upsert to the local signal cache,
        re-read so the vectors used downstream come from the cache's own
        round-trip (not a from-memory list).

    Consumes lib.core.rs_cache's public API verbatim, scoped to room_dir. No
    new network calls live here; this module is a composition layer.
    """
    try:
        from lib.core.rs_cache import (
            namespace_slug,
            get_namespace_freshness,
            upsert_corpus,
            fetch_all_from_namespace,
            is_fresh,
            TTL_DAYS,
        )
        from lib.core.rs_corpus import fetch_corpus
    except Exception as e:
        return [], {
            "cache_mode": "bypass",
            "cache_age_days": None,
            "cache_namespace": None,
            "cache_ttl_days": None,
            "corpus_size": 0,
            "skip_reason": f"rs_cache import failed: {e}",
        }

    # Bypass check: the room must resolve. The local signal cache is scoped
    # to a room by construction (lib.core.rs_cache, closes SEED-029 finding
    # F8) -- reading it against a guessed room is not an option this loader
    # takes.
    if not room_dir:
        return [], {
            "cache_mode": "bypass",
            "cache_age_days": None,
            "cache_namespace": None,
            "cache_ttl_days": None,
            "corpus_size": 0,
            "skip_reason": "no room scope for the signal cache",
        }

    ns = namespace_slug(topic)
    try:
        age_days = get_namespace_freshness(ns, room_dir=room_dir)
    except Exception as e:
        print(
            f"[rs-hybrid] freshness check failed ({e}); treating as cold.",
            file=sys.stderr,
        )
        age_days = None

    if is_fresh(age_days, ttl_days=TTL_DAYS):
        # WARM path.
        print(
            f"[rs-hybrid] Cache hit (age={age_days:.1f} days, ttl={TTL_DAYS}). "
            f"Using local signal cache {ns}.",
            file=sys.stderr,
        )
        try:
            records = fetch_all_from_namespace(ns, limit=external_target, room_dir=room_dir)
            return records, {
                "cache_mode": "warm",
                "cache_age_days": round(age_days, 2) if age_days is not None else None,
                "cache_namespace": ns,
                "cache_ttl_days": TTL_DAYS,
                "corpus_size": len(records),
            }
        except Exception as e:
            print(
                f"[rs-hybrid] warm-path fetch failed ({e}); dropping to cold.",
                file=sys.stderr,
            )

    # COLD path.
    age_label = "unset" if age_days is None else f"{age_days:.1f} days"
    print(
        f"[rs-hybrid] Cold path: fetching external corpus for {topic!r} "
        f"(cache age={age_label}).",
        file=sys.stderr,
    )
    try:
        # Overshoot fetch target so dedup + abstract-present filter still
        # yields near-external_target usable docs (same pattern as Mode B).
        fetch_target = max(external_target * 2, external_target + 200)
        docs = fetch_corpus(topic, target_n=fetch_target)
    except Exception as e:
        print(f"[rs-hybrid] corpus fetch failed ({e}).", file=sys.stderr)
        return [], {
            "cache_mode": "bypass",
            "cache_age_days": None,
            "cache_namespace": ns,
            "cache_ttl_days": TTL_DAYS,
            "corpus_size": 0,
            "skip_reason": f"fetch_corpus failed: {e}",
        }

    if len(docs) < 2:
        return [], {
            "cache_mode": "bypass",
            "cache_age_days": None,
            "cache_namespace": ns,
            "cache_ttl_days": TTL_DAYS,
            "corpus_size": len(docs),
            "skip_reason": "cold fetch returned < 2 usable docs",
        }

    try:
        upsert_corpus(topic, docs, room_dir=room_dir)
        records = fetch_all_from_namespace(ns, limit=external_target, room_dir=room_dir)
    except Exception as e:
        print(
            f"[rs-hybrid] upsert/fetch failed ({e}); dropping to bypass.",
            file=sys.stderr,
        )
        return [], {
            "cache_mode": "bypass",
            "cache_age_days": None,
            "cache_namespace": ns,
            "cache_ttl_days": TTL_DAYS,
            "corpus_size": 0,
            "skip_reason": f"upsert/fetch failed: {e}",
        }

    return records, {
        "cache_mode": "cold",
        "cache_age_days": 0.0,
        "cache_namespace": ns,
        "cache_ttl_days": TTL_DAYS,
        "corpus_size": len(records),
    }


def _external_records_to_dicts(records: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Shape rs_cache records into unified-corpus dicts (origin=external).

    Fields mirrored from Plan 89-02 / 89-03 Mode B output so downstream
    bridge-writer (Plan 89-06) can resolve both sides via the existing
    resolvePairIdentity() without per-mode branches.

    Attached _vector field carries the cached local-encoder embedding when
    present; rs-engine will prefer it over local MiniLM to keep warm/cold
    semantic consistency with Mode B.
    """
    out: List[Dict[str, Any]] = []
    for rec in records:
        rid = rec.get("id") or ""
        meta = rec.get("metadata", {}) or {}
        abstract = (meta.get("abstract") or "").strip()
        if not abstract:
            continue
        source = (meta.get("source") or "external").strip() or "external"
        title = (meta.get("title") or "").strip() or rid
        doi = (meta.get("doi") or "").strip() or None
        year = meta.get("year") or None
        # Build a stable artifact-style id that matches Mode B cold-path shape.
        eid_slug = re.sub(r"[^a-zA-Z0-9]+", "-", rid).strip("-")
        if not eid_slug:
            eid_slug = re.sub(r"[^a-zA-Z0-9]+", "-", title or "untitled").strip("-")
        external_id = f"{source}/{eid_slug}"
        values = rec.get("values") or []
        out.append({
            "global_id": f"external::{external_id}",
            "origin": "external",
            "external_id": external_id,
            "cache_id": rid,
            "source": source,
            "title": title,
            "doi": doi,
            "year": year,
            "path": f"https://doi.org/{doi}" if doi else rid,
            "text": abstract,
            "_vector": list(values) if values else [],
            # 2026 source trail: where the text came from and when it was
            # retrieved (the cache stamps fetched_at on every record).
            "retrieved_at": meta.get("fetched_at"),
            "source_trail": {
                "source": source,
                "source_id": rid,
                "url": f"https://doi.org/{doi}" if doi else None,
                "retrieved_at": meta.get("fetched_at"),
                "extracted_text": "abstract",
            },
        })
    return out


def _external_docs_to_dicts(docs: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Bypass-path shape: raw rs_corpus docs -> unified-corpus dicts.

    Used when the signal cache is unavailable and the caller cold-fetched
    via rs_corpus.fetch_corpus directly. Vectors are not attached (caller
    embeds locally via MiniLM).
    """
    out: List[Dict[str, Any]] = []
    for doc in docs:
        abstract = (doc.get("abstract") or "").strip()
        if not abstract:
            continue
        rid = doc.get("external_id") or ""
        source = (doc.get("source") or "external").strip() or "external"
        title = (doc.get("title") or "").strip() or rid
        doi = (doc.get("doi") or "").strip() or None
        year = doc.get("year")
        eid_slug = re.sub(r"[^a-zA-Z0-9]+", "-", rid).strip("-")
        if not eid_slug:
            eid_slug = re.sub(r"[^a-zA-Z0-9]+", "-", title or "untitled").strip("-")
        external_id = f"{source}/{eid_slug}"
        out.append({
            "global_id": f"external::{external_id}",
            "origin": "external",
            "external_id": external_id,
            "cache_id": rid,
            "source": source,
            "title": title,
            "doi": doi,
            "year": year,
            "path": doc.get("url") or rid,
            "text": abstract,
            "_vector": [],  # bypass path -- no cached vector.
            "retrieved_at": doc.get("retrieved_at"),
            "source_trail": {
                "source": source,
                "source_id": rid,
                "url": doc.get("url") or None,
                "retrieved_at": doc.get("retrieved_at"),
                "extracted_text": "abstract",
            },
        })
    return out


# --- Public builder ---------------------------------------------------------

def build_unified_corpus(
    room_path: str,
    topic: str,
    external_target: int = DEFAULT_EXTERNAL_TARGET,
) -> Tuple[List[Dict[str, Any]], "np.ndarray", Dict[str, Any]]:
    """Build a unified (room + external) corpus for Mode C.

    Returns:
      corpus:      flat list of dicts. Room artifacts first (preserved
                   discover order), then external docs (local signal-cache
                   namespace order or fetch order on bypass path).
      origin_mask: np.ndarray[bool], True=room, False=external. Same length
                   as corpus. Used by filter_cross_corpus_pairs.
      metadata:    {room_count, external_count, room_id, topic, topic_slug,
                    cache_mode, cache_age_days, cache_namespace,
                    cache_ttl_days, external_target, fetched_at}.

    Edge cases:
      - Empty room: returns ([], array([]), {...room_count=0...}). Caller
        should short-circuit (no cross-corpus pair is constructible).
      - Empty external: same pattern. Callers should emit a clear "no
        external corpus available" message rather than running the LSA.
      - Bypass path with rs_corpus importable: falls through to cold fetch
        via rs_corpus.fetch_corpus and shapes docs directly.
      - Bypass path with rs_corpus NOT importable: returns empty external
        side (caller decides what to do; typically short-circuits).

    external_target is clamped to MAX_EXTERNAL_TARGET so misconfigured
    callers cannot request 50k docs and blow memory.
    """
    # Clamp external_target defensively. 2026: a non-numeric value used to raise
    # a bare ValueError/TypeError from int(); fall back to the default instead.
    try:
        external_target = max(1, min(int(external_target), MAX_EXTERNAL_TARGET))
    except (TypeError, ValueError):
        external_target = DEFAULT_EXTERNAL_TARGET

    room_path_obj = Path(room_path).resolve()
    if not room_path_obj.is_dir():
        raise ValueError(f"rs_hybrid: room path is not a directory: {room_path_obj}")

    room_artifacts = _load_room_artifacts(room_path_obj)
    room_id = room_path_obj.name

    # External side. room_path_obj is already resolved and directory-checked
    # above; pass it straight through so the signal cache reads/writes are
    # scoped to this room (Plan 296-05, closes SEED-029 finding F8).
    records, cache_meta = _load_external_records(topic, external_target, room_dir=str(room_path_obj))
    if records:
        external_dicts = _external_records_to_dicts(records)
    else:
        # Attempt the Plan 89-02 bypass path: fetch via rs_corpus directly
        # if it is available. If rs_corpus import failed upstream, the
        # cache_meta carries skip_reason and we return an empty external
        # side -- caller decides whether to abort or continue with only
        # room artifacts (which cross-corpus filter will discard anyway).
        external_dicts = []
        try:
            from lib.core.rs_corpus import fetch_corpus
            print(
                "[rs-hybrid] Bypass path: fetching via rs_corpus (no signal cache).",
                file=sys.stderr,
            )
            fetch_target = max(external_target * 2, external_target + 200)
            docs = fetch_corpus(topic, target_n=fetch_target)
            external_dicts = _external_docs_to_dicts(docs[:external_target])
            # Update cache_meta corpus_size to reflect actual bypass-path
            # usable count.
            cache_meta["corpus_size"] = len(external_dicts)
        except Exception as e:
            print(
                f"[rs-hybrid] bypass-path fetch also failed ({e}); "
                f"proceeding with empty external corpus.",
                file=sys.stderr,
            )

    # Cap external side at external_target explicitly (defense-in-depth in
    # case cache returned more than requested).
    external_dicts = external_dicts[:external_target]

    corpus: List[Dict[str, Any]] = list(room_artifacts) + list(external_dicts)

    # Build origin_mask. True=room, False=external. Matches plan contract.
    origin_mask = np.array(
        [c["origin"] == "room" for c in corpus],
        dtype=bool,
    )

    # Resolve topic slug the same way Mode B does so the hybrid output
    # path aligns with research/{topic-slug}/ conventions.
    try:
        from lib.core.rs_corpus import topic_slug
        slug = topic_slug(topic)
    except Exception:
        slug = re.sub(r"[^a-z0-9]+", "-", (topic or "").lower()).strip("-")

    metadata: Dict[str, Any] = {
        "room_count": int(origin_mask.sum()),
        "external_count": int((~origin_mask).sum()),
        "room_id": room_id,
        "room_path": str(room_path_obj),
        "topic": topic,
        "topic_slug": slug,
        "external_target": external_target,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        # 2026 provenance: what produced this corpus.
        "schema_version": 2,
        "computed_by": "rs_hybrid.build_unified_corpus",
        "room_artifacts_skipped_oversized_limit_bytes": MAX_ARTIFACT_BYTES,
    }
    # Surface the 89-03 cache provenance so rs-engine can write it to
    # .rs-engine-results.json and downstream consumers see warm/cold mode.
    metadata.update({k: v for k, v in cache_meta.items() if k != "corpus_size"})

    return corpus, origin_mask, metadata


# --- Cross-corpus pair filter -----------------------------------------------

def filter_cross_corpus_pairs(
    pairs: Sequence[Any],
    origin_mask: "np.ndarray",
    topk: int,
    min_percentile: Optional[float] = None,
    reference_diffs: Optional[Sequence[float]] = None,
) -> List[Dict[str, Any]]:
    """Keep only pairs where one side is room and other is external.

    Accepts either:
      - abs_diff_topk tuple output: list of (i, j, signed, abs_diff) tuples.
      - Dict-shaped pairs already carrying i/j (future-proofing; not used by
        the current rs-engine call site but allows unit testing with mocks).

    Returns a list of dicts augmented with room_side and external_side
    (integer indices into the unified corpus). The bridge-writer (Plan
    89-06) consumes these through resolvePairIdentity.

    Stops as soon as `topk` cross-corpus pairs have been collected. The
    caller should request abs_diff_topk with an overshoot multiplier so
    intra-corpus pairs (room-room or external-external) can be discarded
    without starving the final result below topk.

    2026 (optional, default off = unchanged behaviour): `min_percentile`
    (0..1) additionally keeps only pairs whose abs_diff is at or above that
    quantile, and every returned dict gains `abs_diff_percentile`.
    `reference_diffs` is the population the percentile is measured against;
    pass the whole-corpus distribution (rs_math.abs_diff_distribution) so the
    cutoff is corpus-relative. Without it the population is the supplied
    candidate list, which is already a top-k slice and therefore biased high;
    the result then carries `percentile_basis: "candidates"` so a reader can
    tell. Hybrid retrieval over text lives in `hybrid_rank` below.
    """
    out: List[Dict[str, Any]] = []
    topk = max(1, int(topk))

    threshold = None
    ref_sorted: List[float] = []
    basis = None
    if min_percentile is not None:
        if not (0.0 <= float(min_percentile) <= 1.0):
            raise ValueError("min_percentile must be within [0, 1]")
        if reference_diffs is not None:
            ref_sorted = sorted(float(v) for v in reference_diffs if math.isfinite(float(v)))
            basis = "reference"
        else:
            vals = []
            for p in pairs:
                try:
                    v = float(p.get("abs_diff", p.get("abs"))) if isinstance(p, dict) else float(p[3])
                except (TypeError, ValueError, IndexError, KeyError):
                    continue
                if math.isfinite(v):
                    vals.append(v)
            ref_sorted = sorted(vals)
            basis = "candidates"
        threshold = _quantile(ref_sorted, float(min_percentile))

    for p in pairs:
        # Normalize input shape.
        if isinstance(p, dict):
            i = int(p.get("i", -1))
            j = int(p.get("j", -1))
            signed = p.get("signed_diff", p.get("signed"))
            absv = p.get("abs_diff", p.get("abs"))
        else:
            try:
                i, j, signed, absv = p
            except (ValueError, TypeError):
                continue
            i, j = int(i), int(j)

        if i < 0 or j < 0:
            continue
        if i >= len(origin_mask) or j >= len(origin_mask):
            continue
        if bool(origin_mask[i]) == bool(origin_mask[j]):
            # Same origin -- intra-corpus pair. Discard.
            continue
        if threshold is not None:
            try:
                av = float(absv)
            except (TypeError, ValueError):
                continue
            if not math.isfinite(av) or av < threshold:
                continue

        # Canonical orientation: room_side is the room index, external_side
        # is the external index. Matches plan Detailed Steps snippet.
        if bool(origin_mask[i]):
            room_side, external_side = i, j
        else:
            room_side, external_side = j, i

        row = {
            "i": i,
            "j": j,
            "signed_diff": float(signed) if signed is not None else 0.0,
            "abs_diff": float(absv) if absv is not None else 0.0,
            "room_side": room_side,
            "external_side": external_side,
        }
        if threshold is not None:
            row["abs_diff_percentile"] = _percentile_rank(ref_sorted, row["abs_diff"])
            row["percentile_basis"] = basis
        out.append(row)

        if len(out) >= topk:
            break

    return out


# --- 2026: percentile helpers (same definitions as rs_math.py) --------------

def _quantile(sorted_asc: Sequence[float], q: float) -> float:
    """Linear-interpolation quantile (numpy.percentile default)."""
    n = len(sorted_asc)
    if n == 0 or not math.isfinite(q):
        return float("nan")
    qq = min(1.0, max(0.0, float(q)))
    idx = (n - 1) * qq
    lo, hi = int(math.floor(idx)), int(math.ceil(idx))
    if lo == hi:
        return float(sorted_asc[lo])
    return float(sorted_asc[lo]) + (float(sorted_asc[hi]) - float(sorted_asc[lo])) * (idx - lo)


def _percentile_rank(sorted_asc: Sequence[float], x: float) -> float:
    """Mid-rank empirical percentile in [0, 1]."""
    import bisect

    n = len(sorted_asc)
    if n == 0 or not math.isfinite(x):
        return float("nan")
    left = bisect.bisect_left(sorted_asc, x)
    right = bisect.bisect_right(sorted_asc, x)
    return (left + 0.5 * (right - left)) / n


# --- 2026: hybrid retrieval (lexical BM25 + dense cosine, fused) -------------
#
# Fixed-threshold, single-signal ranking is replaced by two independent signals
# fused by rank: BM25 over the text (deterministic, no model) and cosine over
# the cached/local embedding. Fusion is reciprocal-rank (default, scale-free) or
# a weighted z-score. Everything here is pure, seeded by construction (no
# randomness) and tie-broken by corpus index, so output is reproducible. It never
# calls a model or the network; vectors come from the caller.

_BM25_STOP = frozenset(
    "a an and are as at be but by for from has have in into is it its of on or such that the their "
    "then there these they this to was were which will with not no than also can may we our us using "
    "use used based via".split()
)
_TOKEN_RE = re.compile(r"[a-z0-9]+(?:[-'][a-z0-9]+)*")


def _bm25_tokens(text: str) -> List[str]:
    return [t for t in _TOKEN_RE.findall((text or "").lower()) if t not in _BM25_STOP and len(t) > 1]


def bm25_scores(
    query: str,
    docs: Sequence[str],
    k1: float = 1.5,
    b: float = 0.75,
) -> "np.ndarray":
    """Okapi BM25 of `query` against each text in `docs` (idf = ln(1 + (N - df + .5)/(df + .5))).

    Returns a float64 array of len(docs). Empty corpus or empty query -> zeros.
    """
    n = len(docs)
    scores = np.zeros(n, dtype=np.float64)
    q_terms = sorted(set(_bm25_tokens(query)))
    if n == 0 or not q_terms:
        return scores
    toks = [_bm25_tokens(d) for d in docs]
    lengths = np.array([len(t) for t in toks], dtype=np.float64)
    avgdl = float(lengths.mean()) if n and lengths.sum() > 0 else 1.0
    tfs = []
    df: Dict[str, int] = {}
    for t in toks:
        counts: Dict[str, int] = {}
        for w in t:
            counts[w] = counts.get(w, 0) + 1
        tfs.append(counts)
        for w in counts:
            df[w] = df.get(w, 0) + 1
    for term in q_terms:
        d = df.get(term, 0)
        if d == 0:
            continue
        idf = math.log(1.0 + (n - d + 0.5) / (d + 0.5))
        for i in range(n):
            f = tfs[i].get(term, 0)
            if f == 0:
                continue
            denom = f + k1 * (1.0 - b + b * (lengths[i] / avgdl if avgdl > 0 else 0.0))
            scores[i] += idf * (f * (k1 + 1.0)) / denom
    return scores


def _dense_scores(query_vector: Sequence[float], vectors: Sequence[Sequence[float]]) -> "np.ndarray":
    out = np.zeros(len(vectors), dtype=np.float64)
    q = np.asarray(query_vector, dtype=np.float64)
    qn = float(np.linalg.norm(q))
    if q.ndim != 1 or q.size == 0 or qn == 0.0 or not np.isfinite(qn):
        return out
    for i, v in enumerate(vectors):
        if not v:
            continue
        a = np.asarray(v, dtype=np.float64)
        if a.shape != q.shape:
            continue  # mixed embedding spaces are never compared
        an = float(np.linalg.norm(a))
        if an == 0.0 or not np.isfinite(an):
            continue
        out[i] = float(np.dot(q, a) / (qn * an))
    return out


def _ranks_desc(scores: "np.ndarray") -> "np.ndarray":
    """1-based rank by descending score; ties by index (stable)."""
    order = np.lexsort((np.arange(len(scores)), -scores))
    ranks = np.empty(len(scores), dtype=np.int64)
    ranks[order] = np.arange(1, len(scores) + 1)
    return ranks


def hybrid_rank(
    query_text: str,
    corpus: Sequence[Dict[str, Any]],
    query_vector: Optional[Sequence[float]] = None,
    k: int = 50,
    fusion: str = "rrf",
    w_lexical: float = 0.5,
    rrf_k: int = 60,
) -> List[Dict[str, Any]]:
    """Rank unified-corpus items against `query_text` with BM25 + dense cosine.

    corpus items are the dicts from build_unified_corpus (text in "text", cached
    embedding in "_vector"). Dense scores are used only when `query_vector` is
    given; items without a same-dimension vector get dense 0. fusion:
      "rrf"    reciprocal rank fusion, score = sum(1 / (rrf_k + rank))
      "zscore" w_lexical * z(bm25) + (1 - w_lexical) * z(dense)
    Returns up to `k` dicts {index, global_id, bm25, dense, fused, rank, signals}
    where `signals` lists which signals contributed. Ranking is deterministic.
    """
    if fusion not in ("rrf", "zscore"):
        raise ValueError("fusion must be 'rrf' or 'zscore'")
    n = len(corpus)
    if n == 0 or k <= 0:
        return []
    texts = [str(c.get("text") or "") for c in corpus]
    bm25 = bm25_scores(query_text, texts)
    use_dense = query_vector is not None and len(query_vector) > 0
    dense = _dense_scores(query_vector, [c.get("_vector") or [] for c in corpus]) if use_dense else np.zeros(n)
    if use_dense and not np.any(dense != 0.0):
        use_dense = False  # nothing comparable; do not let an all-zero signal vote

    if fusion == "rrf":
        fused = 1.0 / (rrf_k + _ranks_desc(bm25))
        if use_dense:
            fused = fused + 1.0 / (rrf_k + _ranks_desc(dense))
    else:
        def z(a: "np.ndarray") -> "np.ndarray":
            sd = float(a.std())
            return (a - float(a.mean())) / sd if sd > 0 else np.zeros_like(a)
        w = min(1.0, max(0.0, float(w_lexical)))
        fused = (w * z(bm25) + (1.0 - w) * z(dense)) if use_dense else z(bm25)

    order = np.lexsort((np.arange(n), -fused))
    out: List[Dict[str, Any]] = []
    for rank, idx in enumerate(order[:k], start=1):
        i = int(idx)
        out.append({
            "index": i,
            "global_id": corpus[i].get("global_id"),
            "bm25": float(bm25[i]),
            "dense": float(dense[i]),
            "fused": float(fused[i]),
            "rank": rank,
            "signals": ["bm25"] + (["dense"] if use_dense else []),
        })
    return out


# --- 2026: claim-level units (problem sentence vs method sentence) ----------
#
# Comparing whole abstracts blurs "what is wrong" with "what was done". These
# helpers split a document into sentences and tag problem-like and method-like
# ones by fixed cue words (deterministic, no model) so the caller can embed and
# compare sentence to sentence. claim_level_similarity then takes the best
# problem-vs-method cosine across the two sides.

_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(\[])")
_PROBLEM_CUES = re.compile(
    r"\b(problem|challenge|limitation|limited|lack|lacks|fail|fails|failure|bottleneck|difficult|"
    r"difficulty|gap|unsolved|open question|remain|remains|cannot|unable|costly|inefficient|barrier)\b", re.I)
_METHOD_CUES = re.compile(
    r"\b(we propose|we present|we introduce|we develop|we show|this paper|method|approach|technique|"
    r"algorithm|framework|architecture|using|based on|by combining|novel|design|implement)\b", re.I)


def split_claims(text: str, max_sentences: int = 12) -> Dict[str, List[Dict[str, Any]]]:
    """Split `text` into sentences and tag them. Returns
    {"problem": [...], "method": [...], "other": [...]} where each entry is
    {"index": sentence_index, "text": sentence}. A sentence with both cues is
    tagged "method" only if it has a method cue and no problem cue, else
    "problem" (the problem statement is the scarcer, more valuable unit).
    """
    sents = [s.strip() for s in _SENT_SPLIT.split((text or "").strip()) if s.strip()]
    out: Dict[str, List[Dict[str, Any]]] = {"problem": [], "method": [], "other": []}
    for idx, s in enumerate(sents[: max(0, int(max_sentences))]):
        has_p = bool(_PROBLEM_CUES.search(s))
        has_m = bool(_METHOD_CUES.search(s))
        kind = "problem" if has_p else ("method" if has_m else "other")
        out[kind].append({"index": idx, "text": s})
    return out


def claim_level_similarity(
    problem_vectors: Sequence[Sequence[float]],
    method_vectors: Sequence[Sequence[float]],
) -> Dict[str, Any]:
    """Best cosine between any problem-sentence vector and any method-sentence
    vector. Returns {"score", "problem_index", "method_index", "pairs"}; score
    0.0 and indexes None when either side is empty or nothing is comparable."""
    best = {"score": 0.0, "problem_index": None, "method_index": None, "pairs": 0}
    for pi, pv in enumerate(problem_vectors):
        for mi, mv in enumerate(method_vectors):
            if not pv or not mv or len(pv) != len(mv):
                continue
            a = np.asarray(pv, dtype=np.float64)
            c = np.asarray(mv, dtype=np.float64)
            na, nc = float(np.linalg.norm(a)), float(np.linalg.norm(c))
            if na == 0.0 or nc == 0.0:
                continue
            best["pairs"] += 1
            s = float(np.dot(a, c) / (na * nc))
            if best["problem_index"] is None or s > best["score"]:
                best.update(score=s, problem_index=pi, method_index=mi)
    return best


__all__ = [
    "build_unified_corpus",
    "filter_cross_corpus_pairs",
    "hybrid_rank",
    "bm25_scores",
    "split_claims",
    "claim_level_similarity",
    "DEFAULT_EXTERNAL_TARGET",
    "MAX_EXTERNAL_TARGET",
    "SKIP_FILES",
    "SKIP_DIRS",
    "MIN_BODY_CHARS",
]
