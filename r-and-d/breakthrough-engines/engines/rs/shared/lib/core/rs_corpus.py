#!/usr/bin/env python3
"""
rs-corpus.py -- External corpus fetcher for the Reverse Salient Engine
======================================================================

Tiered external corpus fetcher. Plan 89-02 Mode B entry point. Follows the
RESEARCH Q2 decision (OpenAlex primary, arXiv secondary, Tavily fallback).
Skips Scopus, Semantic Scholar, USPTO direct, PubMed per Phase 89 locked
scope.

Tiering rationale (RESEARCH.md Q2):
  - OpenAlex: free, 240M+ works, includes patents, stable JSON schema,
    polite pool at 100k/day (email in User-Agent). Single API covers papers,
    patents, dissertations.
  - arXiv: free Atom XML, deep-tech (physics/CS/math/bio) supplement. Soft
    rate limit ~3 req/s; no hard block.
  - Tavily: fallback for domains neither of the above cover. Already
    configured in the plugin via TAVILY_API_KEY. Snippet-only, not full
    abstract.

Abstract normalization:
  - OpenAlex returns `abstract_inverted_index` (dict of word -> [positions]).
    invert_abstract() reconstructs plain text.
  - arXiv <summary> is plain text in Atom feed, stripped of whitespace.
  - Tavily `content` is snippet text as-is.

Rate limit posture:
  - OpenAlex polite pool: email in User-Agent + sleep(0.1) between pages.
  - arXiv: sleep(0.35) between pages (~3 req/s).
  - Tavily: single POST per topic, no pagination in v1.

Dedup:
  - DOI if present, else normalized lowercase title.

Env vars:
  - OPENALEX_EMAIL: polite pool contact. Defaults to noreply@mindrian-os.com.
  - TAVILY_API_KEY: gates Tier 3 (fallback). Missing = graceful empty list.

Three-surface usage:
  - CLI:     python scripts/rs-engine.py --mode external --topic "..."
  - Desktop: invoked through ReverseSalientAgent (Plan 89-07).
  - Cowork:  external fetch is symmetric across surfaces; results live under
             {room}/research/{topic-slug}/ and copy through 00_Context/.

License: BSL-1.1 (see LICENSE at repo root).
"""

from __future__ import annotations

import json
import math
import os
import re
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Dict, List, Optional
from urllib.parse import quote

try:
    import requests
except ImportError:
    print(
        "rs-corpus requires requests. Run: pip install -r requirements-hsi.txt",
        file=sys.stderr,
    )
    raise


OPENALEX_EMAIL = os.environ.get("OPENALEX_EMAIL", "noreply@mindrian-os.com")
USER_AGENT = f"MindrianOS-RS-Engine/1.9.8.1 (mailto:{OPENALEX_EMAIL})"

# Network budgets kept generous; callers set target_n.
OPENALEX_URL = "https://api.openalex.org/works"
# 2026: https (arXiv serves the API over TLS); the plain-http URL sent the
# user's topic in clear text.
ARXIV_URL = "https://export.arxiv.org/api/query"
TAVILY_URL = "https://api.tavily.com/search"
ARXIV_NS = {"atom": "http://www.w3.org/2005/Atom"}

# Hard upper bound so a misconfigured topk cannot balloon external API usage.
MAX_TARGET_N = 20000
# 2026: also bound the number of HTTP pages per tier so a server that keeps
# returning short or empty cursors cannot loop for ever.
MAX_PAGES = 200
# Bounded retries for transient failures (429 / 5xx) with fixed back-off.
MAX_RETRIES = 2
RETRY_SLEEP_SEC = 1.0


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_with_retry(url: str, **kwargs):
    """requests.get with bounded retry on 429/5xx. Returns the last response, or
    raises requests.RequestException after the final attempt."""
    last = None
    for attempt in range(MAX_RETRIES + 1):
        last = requests.get(url, **kwargs)
        if last.status_code not in (429, 500, 502, 503, 504):
            return last
        if attempt < MAX_RETRIES:
            time.sleep(RETRY_SLEEP_SEC * (attempt + 1))
    return last


# --- Abstract reconstruction ------------------------------------------------

def invert_abstract(inverted_index: Optional[Dict[str, List[int]]]) -> str:
    """OpenAlex abstract_inverted_index -> plain text.

    Per RESEARCH.md Pitfall 3: if you feed the raw inverted-index dict to an
    embedder, you get garbage. Reconstruction sorts (position, word) pairs by
    position and joins with spaces. Empty / None index returns empty string
    so the caller can filter before counting toward target_n.
    """
    if not inverted_index:
        return ""
    if not isinstance(inverted_index, dict):
        return ""
    pairs = []
    for word, positions in inverted_index.items():
        if not isinstance(positions, list):
            continue
        for pos in positions:
            try:
                ipos = int(pos)
            except (TypeError, ValueError):
                continue
            if ipos < 0:
                continue  # 2026: malformed negative position
            pairs.append((ipos, str(word)))
    # 2026: tie-break on the word so two words claiming one position always
    # reconstruct in the same order (dict order is not a contract).
    pairs.sort(key=lambda x: (x[0], x[1]))
    return " ".join(word for _, word in pairs)


# --- Tier 1: OpenAlex --------------------------------------------------------

def fetch_openalex(topic: str, target_n: int = 2000, per_page: int = 200) -> List[Dict]:
    """Fetch up to target_n works from OpenAlex matching `topic`.

    Uses cursor pagination (next_cursor) which is the documented path for
    deep paging. per_page capped at 200 per the OpenAlex polite pool guide.
    Filters out works with empty or missing abstract_inverted_index so the
    count reflects usable corpus, not raw hits.
    """
    if target_n <= 0 or not topic:
        return []
    target_n = min(target_n, MAX_TARGET_N)
    per_page = max(1, min(per_page, 200))

    results: List[Dict] = []
    cursor = "*"
    headers = {"User-Agent": USER_AGENT}
    retrieved_at = _now_iso()
    pages = 0

    while len(results) < target_n and pages < MAX_PAGES:
        pages += 1
        params = {
            "search": topic,
            "per-page": min(per_page, target_n - len(results)),
            "cursor": cursor,
            "select": (
                "id,title,abstract_inverted_index,publication_year,"
                "authorships,doi"
            ),
        }
        # OPENALEX_API_KEY (optional, read from the environment, never stored):
        # sent when set. Unverified against the live service in this review.
        if os.environ.get("OPENALEX_API_KEY"):
            params["api_key"] = os.environ["OPENALEX_API_KEY"]
        try:
            r = _get_with_retry(OPENALEX_URL, params=params, headers=headers, timeout=30)
        except requests.RequestException as e:
            print(f"rs-corpus: OpenAlex request failed: {e}", file=sys.stderr)
            break
        if r.status_code != 200:
            print(
                f"rs-corpus: OpenAlex returned {r.status_code}; stopping tier 1",
                file=sys.stderr,
            )
            break
        try:
            data = r.json()
        except ValueError:
            print("rs-corpus: OpenAlex returned non-JSON; stopping tier 1",
                  file=sys.stderr)
            break

        hits = data.get("results", [])
        if not hits:
            break

        for work in hits:
            abstract = invert_abstract(work.get("abstract_inverted_index"))
            if not abstract:
                continue
            authors = []
            for authorship in (work.get("authorships") or [])[:5]:
                if not isinstance(authorship, dict):
                    continue
                author = authorship.get("author") or {}
                name = author.get("display_name")
                if name:
                    authors.append(name)
            results.append({
                "source": "openalex",
                "external_id": work.get("id") or "",
                "title": work.get("title") or "",
                "abstract": abstract,
                "year": work.get("publication_year"),
                "authors": authors,
                "url": work.get("id") or "",
                "doi": work.get("doi"),
                "retrieved_at": retrieved_at,
            })
            if len(results) >= target_n:
                break

        cursor = (data.get("meta") or {}).get("next_cursor")
        if not cursor:
            break
        # Polite pool: 10 req/s ceiling. 0.1s spacing is well under the limit
        # and keeps the engine nice on shared infra.
        time.sleep(0.1)

    return results[:target_n]


# --- Tier 2: arXiv -----------------------------------------------------------

def _arxiv_query(topic: str) -> str:
    """URL-encoded arXiv search_query for a free-text topic.

    2026: the original sent `all:<whole topic>`; arXiv's query grammar applies the
    `all:` prefix only to the first word of an unquoted multi-word string, the
    rest are matched in the default field, so multi-word topics returned loosely
    related papers. Each word now gets its own `all:` clause joined with AND."""
    words = [w for w in re.split(r"\s+", (topic or "").strip()) if w]
    if not words:
        return "all:"
    return "+AND+".join("all:" + quote(w) for w in words)


def fetch_arxiv(topic: str, target_n: int = 2000) -> List[Dict]:
    """Fetch up to target_n papers from arXiv Atom feed.

    Soft rate limit ~3 req/s per RESEARCH.md Pitfall 4. Uses 0.35s spacing
    and max_results <= 200 per call to minimize call count.
    """
    if target_n <= 0 or not topic:
        return []
    target_n = min(target_n, MAX_TARGET_N)

    results: List[Dict] = []
    start = 0
    headers = {"User-Agent": USER_AGENT}
    retrieved_at = _now_iso()
    pages = 0
    query = _arxiv_query(topic)

    while len(results) < target_n and pages < MAX_PAGES:
        pages += 1
        batch = min(200, target_n - len(results))
        url = (
            f"{ARXIV_URL}?search_query={query}"
            f"&start={start}&max_results={batch}"
        )
        try:
            r = _get_with_retry(url, headers=headers, timeout=30)
        except requests.RequestException as e:
            print(f"rs-corpus: arXiv request failed: {e}", file=sys.stderr)
            break
        if r.status_code != 200:
            print(
                f"rs-corpus: arXiv returned {r.status_code}; stopping tier 2",
                file=sys.stderr,
            )
            break

        try:
            root = ET.fromstring(r.content)
        except ET.ParseError as e:
            print(f"rs-corpus: arXiv XML parse failed: {e}", file=sys.stderr)
            break

        entries = root.findall("atom:entry", ARXIV_NS)
        if not entries:
            break

        for entry in entries:
            id_el = entry.find("atom:id", ARXIV_NS)
            title_el = entry.find("atom:title", ARXIV_NS)
            summary_el = entry.find("atom:summary", ARXIV_NS)
            published_el = entry.find("atom:published", ARXIV_NS)

            external_id = (id_el.text or "").strip() if id_el is not None else ""
            title = (title_el.text or "").strip() if title_el is not None else ""
            abstract = (summary_el.text or "").strip() if summary_el is not None else ""
            if not abstract:
                continue

            year = None
            if published_el is not None and published_el.text:
                year_match = re.match(r"(\d{4})", published_el.text.strip())
                if year_match:
                    try:
                        year = int(year_match.group(1))
                    except ValueError:
                        year = None

            authors: List[str] = []
            for author_el in entry.findall("atom:author", ARXIV_NS)[:5]:
                name_el = author_el.find("atom:name", ARXIV_NS)
                if name_el is not None and name_el.text:
                    authors.append(name_el.text.strip())

            results.append({
                "source": "arxiv",
                "external_id": external_id,
                "title": title,
                "abstract": abstract,
                "year": year,
                "authors": authors,
                "url": external_id,
                "doi": None,
                "retrieved_at": retrieved_at,
            })
            if len(results) >= target_n:
                break

        start += batch
        # RESEARCH.md Pitfall 4: arXiv soft-blocks above ~3 req/s. 0.35s is
        # the conservative slot the existing PROJECT stack already uses.
        time.sleep(0.35)

    return results[:target_n]


# --- Tier 3: Tavily (fallback) ----------------------------------------------

def fetch_tavily(topic: str, target_n: int = 100) -> List[Dict]:
    """Fallback web search via Tavily. Gated by TAVILY_API_KEY.

    Snippet-only (content field, not full abstract). Caller decides whether
    snippet-grade evidence is acceptable; Mode B default accepts it because
    any corpus is better than none when OpenAlex+arXiv run dry for a niche
    topic.
    """
    if target_n <= 0 or not topic:
        return []
    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        return []

    payload = {
        "api_key": api_key,
        "query": topic,
        "max_results": min(target_n, 20),  # Tavily caps at 20 per call
        "search_depth": "advanced",
    }
    try:
        r = requests.post(TAVILY_URL, json=payload, timeout=30)
    except requests.RequestException as e:
        print(f"rs-corpus: Tavily request failed: {e}", file=sys.stderr)
        return []
    if r.status_code != 200:
        print(
            f"rs-corpus: Tavily returned {r.status_code}; returning empty",
            file=sys.stderr,
        )
        return []

    try:
        data = r.json()
    except ValueError:
        return []

    results: List[Dict] = []
    for item in data.get("results", []):
        url = item.get("url") or ""
        if not url:
            continue
        content = (item.get("content") or "").strip()
        if not content:
            continue
        results.append({
            "source": "tavily",
            "external_id": url,
            "title": item.get("title") or "",
            "abstract": content,
            "year": None,
            "authors": [],
            "url": url,
            "doi": None,
            "retrieved_at": _now_iso(),
        })
    return results[:target_n]


# --- Dedup helpers -----------------------------------------------------------

def _normalize_title(title: str) -> str:
    """Collapse whitespace, strip punctuation, lowercase. Keeps dedup robust
    against "Title." vs "title" vs "Title  "."""
    if not title:
        return ""
    t = title.lower()
    t = re.sub(r"[^a-z0-9\s]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _dedup_key(doc: Dict) -> str:
    doi = doc.get("doi")
    if isinstance(doi, str) and doi.strip():
        # OpenAlex hands us https://doi.org/10.xxx; strip for a stable key.
        norm = doi.strip().lower()
        norm = norm.replace("https://doi.org/", "").replace("http://doi.org/", "")
        return f"doi:{norm}"
    title_norm = _normalize_title(doc.get("title") or "")
    if title_norm:
        return f"title:{title_norm}"
    # Last resort: external_id. Avoids O(n^2) collapse on degenerate inputs.
    return f"id:{doc.get('external_id') or ''}"


def dedupe(docs: List[Dict]) -> List[Dict]:
    """Dedup by DOI (preferred) or normalized title. Preserves first-seen
    order so Tier 1 wins ties over Tier 2 and Tier 3."""
    seen: set = set()
    out: List[Dict] = []
    for doc in docs:
        key = _dedup_key(doc)
        if key in seen:
            continue
        seen.add(key)
        out.append(doc)
    return out


# --- Semantic-floor gate (SEED-018 H2) --------------------------------------
#
# The external fetch is keyword-matched (OpenAlex `search`, arXiv `all:`), so an
# atmospheric-remote-sensing paper can score high on a "multi-user team
# collaboration" topic purely on shared keywords. Left ungated, that noise enters
# the unified differential matrix and swamps the signal (the SEED-018 H2 symptom).
# The gate drops any candidate whose semantic similarity to the topic embedding is
# below SEMANTIC_FLOOR, BEFORE the matrix. Default 0.15, tunable via
# RS_SEMANTIC_FLOOR. Canon Part 8: the embedding is computed by the caller's
# encode_fn (the embedding spine in production, a deterministic offline stub in
# tests); this module never calls a model, the Brain, or the network for the gate.


def _get_semantic_floor() -> float:
    raw = os.environ.get("RS_SEMANTIC_FLOOR")
    if raw:
        try:
            v = float(raw)
            if 0.0 <= v <= 1.0:
                return v
        except ValueError:
            pass
    return 0.15


SEMANTIC_FLOOR = _get_semantic_floor()


def _cosine(a: List[float], b: List[float]) -> float:
    """Pure cosine similarity on equal-length numeric vectors. Returns 0.0 on
    shape mismatch or a degenerate (zero-norm) vector, so an off-topic candidate
    with no overlap lands below any positive floor and is dropped."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = 0.0
    norm_a = 0.0
    norm_b = 0.0
    for x, y in zip(a, b):
        dot += x * y
        norm_a += x * x
        norm_b += y * y
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / ((norm_a ** 0.5) * (norm_b ** 0.5))


def semantic_gate(
    topic_vec: List[float],
    candidates: List[Dict],
    encode_fn,
    floor: Optional[float] = None,
) -> List[Dict]:
    """Drop candidates whose cosine similarity to `topic_vec` is below `floor`.

    encode_fn maps a candidate dict to its embedding vector. When encode_fn is not
    callable or topic_vec is empty, the gate is a no-op pass-through (backward
    compatible). Never mutates the input list.
    """
    if floor is None:
        floor = SEMANTIC_FLOOR
    if not callable(encode_fn) or not topic_vec:
        return list(candidates)
    kept: List[Dict] = []
    for cand in candidates:
        vec = encode_fn(cand)
        if _cosine(topic_vec, vec) >= floor:
            kept.append(cand)
    return kept


def semantic_gate_percentile(
    topic_vec: List[float],
    candidates: List[Dict],
    encode_fn,
    min_percentile: float = 0.1,
) -> List[Dict]:
    """Corpus-relative alternative to the fixed SEMANTIC_FLOOR: drop the lowest
    `min_percentile` fraction of candidates by cosine to the topic (default: the
    bottom 10%). With fewer than 10 candidates a quantile is not meaningful, so
    nothing is dropped. Same no-op rules as semantic_gate for a missing encoder
    or topic vector. Never mutates the input; order of survivors is preserved."""
    if not callable(encode_fn) or not topic_vec:
        return list(candidates)
    if not (0.0 <= float(min_percentile) <= 1.0):
        raise ValueError("min_percentile must be within [0, 1]")
    if len(candidates) < 10:
        return list(candidates)
    sims = [_cosine(topic_vec, encode_fn(c)) for c in candidates]
    ordered = sorted(sims)
    idx = (len(ordered) - 1) * float(min_percentile)
    lo, hi = int(math.floor(idx)), int(math.ceil(idx))
    cut = ordered[lo] if lo == hi else ordered[lo] + (ordered[hi] - ordered[lo]) * (idx - lo)
    return [c for c, s in zip(candidates, sims) if s >= cut]


# --- Orchestrator -----------------------------------------------------------

def fetch_corpus(topic: str, target_n: int = 2000) -> List[Dict]:
    """Tiered fetch: OpenAlex -> arXiv -> Tavily, deduped, truncated.

    Contract: up to target_n documents where each carries
      source, external_id, title, abstract, year, authors, url
    plus optional doi. Empty abstracts are filtered at each tier before
    counting toward target_n, so a return list of len(target_n) is fully
    usable downstream (no abstract filtering required by caller).

    Provenance is implicit in the `source` field on each doc. Plan 89-03
    will key the Pinecone cache on (source, external_id).
    """
    if target_n <= 0 or not topic:
        return []
    target_n = min(target_n, MAX_TARGET_N)

    results: List[Dict] = []

    # Tier 1: OpenAlex primary.
    results.extend(fetch_openalex(topic, target_n))
    results = dedupe(results)
    if len(results) >= target_n:
        return results[:target_n]

    # Tier 2: arXiv secondary.
    remaining = target_n - len(results)
    if remaining > 0:
        results.extend(fetch_arxiv(topic, remaining))
        results = dedupe(results)
        if len(results) >= target_n:
            return results[:target_n]

    # Tier 3: Tavily fallback.
    remaining = target_n - len(results)
    if remaining > 0:
        results.extend(fetch_tavily(topic, remaining))
        results = dedupe(results)

    return results[:target_n]


def fetch_external(
    topic: str,
    target_n: int = 2000,
    topic_vec: Optional[List[float]] = None,
    encode_fn=None,
    floor: Optional[float] = None,
) -> List[Dict]:
    """Gated external fetch (SEED-018 H2). Wraps fetch_corpus, then applies the
    semantic-floor gate so off-topic keyword matches are dropped BEFORE they reach
    the unified differential matrix.

    When topic_vec / encode_fn are omitted this returns exactly what fetch_corpus
    returns (backward compatible). When supplied, candidates whose semantic
    similarity to the topic is below `floor` (default SEMANTIC_FLOOR) are removed.
    """
    results = fetch_corpus(topic, target_n)
    if topic_vec and callable(encode_fn):
        results = semantic_gate(topic_vec, results, encode_fn, floor)
    return results


# --- Topic slug (shared with downstream writers) ----------------------------

def topic_slug(topic: str) -> str:
    """Normalize a topic to a filesystem-safe slug (RESEARCH.md Pitfall 7).

    Caller uses this for both on-disk paths and future Pinecone namespace
    keys so the name is stable across case/whitespace variations.
    """
    if not topic:
        return ""
    slug = re.sub(r"[^a-z0-9]+", "-", topic.lower())
    return slug.strip("-")


__all__ = [
    "fetch_corpus",
    "fetch_external",
    "fetch_openalex",
    "fetch_arxiv",
    "fetch_tavily",
    "invert_abstract",
    "dedupe",
    "topic_slug",
    "semantic_gate",
    "semantic_gate_percentile",
    "SEMANTIC_FLOOR",
]


# --- Self-invert smoke (when run directly) ----------------------------------

if __name__ == "__main__":
    # Minimal self-check. Real usage goes through scripts/rs-engine.py.
    sample_index = {"Hello": [0], "world": [1], "from": [2], "test": [3]}
    reconstructed = invert_abstract(sample_index)
    assert reconstructed == "Hello world from test", reconstructed
    print(json.dumps({
        "module": "rs_corpus",
        "invert_ok": True,
        "user_agent": USER_AGENT,
        "tavily_configured": bool(os.environ.get("TAVILY_API_KEY")),
    }, indent=2))
