#!/usr/bin/env python3
"""
compute-external-whitespace.py -- External Corpus Whitespace Detection
=======================================================================
Embeds external paper abstracts (from Semantic Scholar) in the same
space as room artifacts, then detects cross-domain whitespace between
room content and published literature.

Loads external-papers.json (from query-semantic-scholar.cjs), embeds
abstracts using the same model as compute-whitespace-embeddings.py
(BAAI/llm-embedder primary, MiniLM fallback), and identifies:

1. External whitespace: papers covering territory the room hasn't explored
2. Gap-filling suggestions: papers that could fill known room whitespace zones
3. Cross-domain zones: papers from different fieldsOfStudy near room content

Usage:
    python3 scripts/compute-external-whitespace.py ROOM_DIR [--output PATH]
        [--selection percentile|legacy] [--zone-percentile 0.75]
        [--gap-fill-percentile 0.9] [--cross-domain-percentile 0.5]

Input:
    {room_dir}/.mindrian/external-papers.json (from query-semantic-scholar.cjs)
    {room_dir}/.mindrian/whitespace-embeddings.json (room artifacts, Phase 60)
    {room_dir}/.mindrian/whitespace-results.json (room whitespace zones, Phase 61)

Output:
    {room_dir}/.mindrian/external-whitespace-results.json

2026 revision (existing output keys are kept; new keys are additive):
  - The fixed cutoffs (distance > 0.6, similarity > 0.5, similarity > 0.4) are replaced by
    percentiles over the papers actually retrieved (--selection percentile, default). A fixed
    cutoff means something different for every embedding model; --selection legacy restores them.
  - find_gap_filling_suggestions never worked in the original: compute-whitespace-gaps.py writes
    nearest_room_artifacts as dicts ({artifact_id, title, section}) and the original only
    understood integer indexes, so every gap was skipped. Dicts are now resolved by artifact id.
  - paper["paperId"] raised KeyError on records without it; a stable fallback id is used.
  - Every zone, suggestion and cross-domain paper carries a source trail (paper id, title, url,
    year, retrieval date, the abstract sentence closest to the room) so a claim can be traced.
  - Keys "zones" and "papers" are also written, because whitespace-command.cjs reads those names.
  - Room and paper vectors with different dimensions are reported, not crashed on; results are
    written atomically; scikit-learn is no longer required.
"""

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# Auto-install Python ML deps if missing (v1.10.9, plan 85-10, LAWRENCE-001).
sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
try:
    from ensure_ml_deps import ensure
except ImportError:
    def ensure(_packages):  # pragma: no cover
        return None
if os.environ.get("HSI_NO_AUTO_INSTALL") != "1":
    ensure(["numpy", "scikit-learn", "sentence-transformers"])

try:
    import numpy as np
except ImportError:
    print(
        "External whitespace requires numpy. Run: pip install -r requirements-whitespace.txt",
        file=sys.stderr,
    )
    sys.exit(1)

SCHEMA_VERSION = "2.0"

# --- Constants (same as compute-whitespace-embeddings.py) ---

PRIMARY_MODEL = "BAAI/llm-embedder"
FALLBACK_MODEL = "all-MiniLM-L6-v2"

# Legacy fixed thresholds (--selection legacy)
EXTERNAL_WHITESPACE_THRESHOLD = 0.6  # cosine distance > this = unexplored
GAP_FILLING_SIMILARITY_THRESHOLD = 0.5  # cosine similarity > this = relevant to gap
CROSS_DOMAIN_SIMILARITY_THRESHOLD = 0.4
MIN_ABSTRACT_LENGTH = 50  # skip short abstracts


# --- numpy replacements for sklearn.metrics.pairwise ---


def cosine_similarity(a, b):
    a = np.atleast_2d(np.asarray(a, dtype=float))
    b = np.atleast_2d(np.asarray(b, dtype=float))
    na = np.linalg.norm(a, axis=1, keepdims=True)
    nb = np.linalg.norm(b, axis=1, keepdims=True)
    na[na < 1e-12] = 1.0
    nb[nb < 1e-12] = 1.0
    return (a / na) @ (b / nb).T


def cosine_distances(a, b):
    return 1.0 - cosine_similarity(a, b)


def empirical_percentile(values):
    """Empirical percentile in [0, 1]; ties share their average rank."""
    v = np.asarray(values, dtype=float).ravel()
    n = v.size
    if n == 0:
        return v
    if n == 1:
        return np.ones(1)
    uniq, inv, counts = np.unique(v, return_inverse=True, return_counts=True)
    cum = np.cumsum(counts)
    return ((cum - counts + cum - 1) / 2.0)[inv] / (n - 1)


# --- Model loading (mirrors compute-whitespace-embeddings.py) ---


def load_embedding_model(target_model=None):
    """Load embedding model with llm-embedder primary, MiniLM fallback.

    Returns:
        (model, model_name, model_dim) tuple.
    """
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        print(
            "External whitespace requires sentence-transformers. "
            "Run: pip install -r requirements-whitespace.txt",
            file=sys.stderr,
        )
        sys.exit(1)

    if target_model:
        print(f"Loading model: {target_model}...", file=sys.stderr)
        model = SentenceTransformer(target_model)
        dim = model.get_sentence_embedding_dimension()
        return model, target_model, dim

    try:
        cache_dir = Path.home() / ".cache" / "huggingface" / "hub"
        model_cache = cache_dir / "models--BAAI--llm-embedder"
        if not model_cache.exists():
            print("Downloading embedding model (440MB, one-time)...", file=sys.stderr)
        model = SentenceTransformer(PRIMARY_MODEL)
        dim = model.get_sentence_embedding_dimension()
        print(f"Loaded {PRIMARY_MODEL} ({dim}-dim)", file=sys.stderr)
        return model, PRIMARY_MODEL, dim
    except Exception as e:
        print(f"llm-embedder unavailable ({e}), falling back to {FALLBACK_MODEL}", file=sys.stderr)
        model = SentenceTransformer(FALLBACK_MODEL)
        dim = model.get_sentence_embedding_dimension()
        print(f"Loaded {FALLBACK_MODEL} ({dim}-dim)", file=sys.stderr)
        return model, FALLBACK_MODEL, dim


# --- Input loading ---


def load_external_papers(room_dir):
    """Load external-papers.json from query-semantic-scholar.cjs output.

    Returns:
        (papers list or None if missing/unreadable, file metadata dict).
    """
    papers_path = Path(room_dir) / ".mindrian" / "external-papers.json"
    if not papers_path.exists():
        return None

    try:
        data = json.loads(papers_path.read_text(encoding="utf-8"))
        papers = data.get("papers", [])
        load_external_papers.last_meta = {k: data.get(k) for k in ("timestamp", "retrieved_at", "query", "source") if k in data}
        return papers
    except (json.JSONDecodeError, OSError, AttributeError):
        return None


load_external_papers.last_meta = {}


def load_room_embeddings(room_dir):
    """Load whitespace-embeddings.json (Phase 60 room artifact embeddings)."""
    ws_path = Path(room_dir) / ".mindrian" / "whitespace-embeddings.json"
    if not ws_path.exists():
        return None, None

    try:
        data = json.loads(ws_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None, None

    embeddings_list = data.get("embeddings", [])
    if not embeddings_list:
        return data, np.array([])

    vectors = np.array([e["vector"] for e in embeddings_list])
    return data, vectors


def load_whitespace_results(room_dir):
    """Load whitespace-results.json (Phase 61 gap detection results)."""
    ws_path = Path(room_dir) / ".mindrian" / "whitespace-results.json"
    if not ws_path.exists():
        return None

    try:
        return json.loads(ws_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


# --- Helpers ---


def paper_id(paper):
    """Semantic Scholar id, or a stable fallback derived from the title/abstract."""
    pid = paper.get("paperId") or paper.get("id")
    if pid:
        return str(pid)
    basis = (paper.get("title") or "") + "|" + (paper.get("abstract") or "")
    return "noid-" + hashlib.md5(basis.encode("utf-8")).hexdigest()[:10]


_WORD = re.compile(r"(?u)\b\w\w+\b")


def _words(text):
    return set(w for w in _WORD.findall(str(text or "").lower()))


def source_trail(paper, retrieved_at, nearest_text=None):
    """Where the claim comes from: paper identity, link, retrieval date and the abstract
    sentence sharing most words with `nearest_text` (the first sentence when none given)."""
    abstract = str(paper.get("abstract") or "").strip()
    sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+", abstract) if s.strip()]
    sentence = sents[0] if sents else ""
    if nearest_text and sents:
        ref = _words(nearest_text)
        sentence = max(sents, key=lambda s: (len(_words(s) & ref), -sents.index(s)))
    pid = paper_id(paper)
    return {
        "source": "semantic-scholar",
        "paper_id": pid,
        "title": paper.get("title", ""),
        "url": paper.get("url") or ("https://www.semanticscholar.org/paper/" + pid if not pid.startswith("noid-") else None),
        "year": paper.get("year"),
        "retrieved_at": retrieved_at,
        "extracted_sentence": sentence[:300],
    }


# --- Core analysis ---


def embed_abstracts(model, papers):
    """Embed paper abstracts using the same model as room artifacts.

    Returns:
        Tuple of (filtered_papers, embedding_matrix np.ndarray). Papers with
        short abstracts are filtered out.
    """
    filtered = []
    texts = []

    for paper in papers:
        abstract = (paper.get("abstract") or "").strip()
        if len(abstract) < MIN_ABSTRACT_LENGTH:
            continue
        filtered.append(paper)
        texts.append(abstract)

    if not texts:
        return [], np.array([])

    embeddings = np.asarray(model.encode(texts, show_progress_bar=False), dtype=float)
    if embeddings.shape[0] != len(texts) or not np.isfinite(embeddings).all():
        raise ValueError("encoder returned unusable vectors for %d abstracts" % len(texts))
    return filtered, embeddings


def detect_external_whitespace(room_embeddings, room_data, ext_embeddings, ext_papers,
                               selection="percentile", zone_percentile=0.75, retrieved_at=None):
    """Detect external papers that cover territory the room hasn't explored.

    For each external paper, compute min cosine distance to nearest room artifact.
    percentile selection: papers whose min distance is at or above `zone_percentile` of all
    retrieved papers. legacy selection: min distance > 0.6.

    Returns:
        List of cross-domain zone dicts
    """
    if len(room_embeddings) == 0 or len(ext_embeddings) == 0:
        return []

    dist_matrix = cosine_distances(ext_embeddings, room_embeddings)
    min_dists = np.min(dist_matrix, axis=1)
    nearest_room_idx = np.argmin(dist_matrix, axis=1)
    pct = empirical_percentile(min_dists)
    retrieved_at = retrieved_at or datetime.now(timezone.utc).isoformat()

    room_emb_list = room_data.get("embeddings", [])
    # lexical second signal: share of the abstract's words that appear in any room title/section
    room_vocab = set()
    for e in room_emb_list:
        room_vocab |= _words(e.get("title", "")) | _words(e.get("section", ""))
    zones = []
    zone_counter = 1

    for i, (paper, dist) in enumerate(zip(ext_papers, min_dists)):
        keep = (dist > EXTERNAL_WHITESPACE_THRESHOLD) if selection == "legacy" else (pct[i] >= zone_percentile)
        if not keep:
            continue
        nearest_idx = int(nearest_room_idx[i])
        nearest_artifact = (
            room_emb_list[nearest_idx]
            if nearest_idx < len(room_emb_list)
            else {"id": "unknown", "title": "unknown"}
        )
        paper_fields = set(paper.get("fieldsOfStudy") or [])
        abs_words = _words(paper.get("abstract"))
        overlap = len(abs_words & room_vocab) / max(len(abs_words), 1)

        zones.append({
            "zone_id": f"xd_{zone_counter:03d}",
            "type": "external_literature_gap",
            "description": (
                f"Papers in {', '.join(sorted(paper_fields)) if paper_fields else 'unclassified fields'} "
                f"cover territory room hasn't explored"
            ),
            "relevant_papers": [{
                "paperId": paper_id(paper),
                "title": paper.get("title", ""),
                "year": paper.get("year"),
                "distance": float(dist),
            }],
            "nearest_room_zone": None,
            "nearest_room_artifacts": [nearest_artifact.get("id", "unknown")],
            # additive 2026 keys
            "distance_percentile": round(float(pct[i]), 4),
            "selection_method": "legacy_fixed_0.6" if selection == "legacy" else "percentile",
            "second_signal": {
                "method": "abstract_vocabulary_overlap_with_room_titles",
                "overlap": round(float(overlap), 4),
                "confirmed": bool(overlap < 0.5),
            },
            "novelty_check": {"status": "in_room_check_only", "external_literature": "retrieved_set_only"},
            "source_trail": [source_trail(paper, retrieved_at, nearest_artifact.get("title"))],
        })
        zone_counter += 1

    zones.sort(key=lambda z: z["relevant_papers"][0]["distance"], reverse=True)
    return zones


def _resolve_artifact_indices(arts, room_data):
    """Indexes into the room embedding matrix for a gap's nearest_room_artifacts, which may be
    integer indexes (legacy) or dicts {artifact_id,...} / id strings (compute-whitespace-gaps.py)."""
    ids = [e.get("id") for e in (room_data or {}).get("embeddings", [])]
    out = []
    for art in arts or []:
        if isinstance(art, bool):
            continue
        if isinstance(art, int):
            out.append(art)
        elif isinstance(art, dict):
            key = art.get("artifact_id", art.get("id"))
            if key in ids:
                out.append(ids.index(key))
        elif isinstance(art, str) and art in ids:
            out.append(ids.index(art))
    return out


def find_gap_filling_suggestions(room_ws_results, ext_embeddings, ext_papers, room_embeddings,
                                 room_data=None, selection="percentile", gap_fill_percentile=0.9,
                                 retrieved_at=None, top_n=5):
    """Find external papers that could fill known room whitespace zones.

    The zone center is the mean of the gap's nearest room artifacts. percentile selection keeps
    papers in the top (1 - gap_fill_percentile) of the similarity distribution for that zone;
    legacy selection keeps similarity > 0.5.
    """
    if room_ws_results is None or len(ext_embeddings) == 0:
        return []

    gaps = room_ws_results.get("gaps", [])
    if not gaps:
        return []

    retrieved_at = retrieved_at or datetime.now(timezone.utc).isoformat()
    suggestions = []

    for gap in gaps:
        nearest_indices = _resolve_artifact_indices(gap.get("nearest_room_artifacts", []), room_data)
        if not (nearest_indices and len(room_embeddings) > 0):
            continue
        valid_indices = [idx for idx in nearest_indices if 0 <= idx < len(room_embeddings)]
        if not valid_indices:
            continue
        zone_center = np.mean(room_embeddings[valid_indices], axis=0).reshape(1, -1)

        sim = cosine_similarity(zone_center, ext_embeddings)[0]
        if selection == "legacy":
            matching = np.where(sim > GAP_FILLING_SIMILARITY_THRESHOLD)[0]
        else:
            pct = empirical_percentile(sim)
            matching = np.where(pct >= gap_fill_percentile)[0]
        if len(matching) == 0:
            continue

        sorted_matches = sorted(matching, key=lambda idx: (-sim[idx], idx))
        framework = gap.get("brain_framework", "unknown")
        suggested_papers = []
        for idx in sorted_matches[:top_n]:
            paper = ext_papers[idx]
            suggested_papers.append({
                "paperId": paper_id(paper),
                "title": paper.get("title", ""),
                "abstract_preview": (paper.get("abstract") or "")[:200],
                "relevance_score": float(sim[idx]),
                "similarity_percentile": round(float(empirical_percentile(sim)[idx]), 4),
                "source_trail": source_trail(paper, retrieved_at, framework),
            })

        suggestions.append({
            "room_zone_id": f"gap_{framework}",
            "brain_framework": framework,
            "suggested_papers": suggested_papers,
            "zone_id": gap.get("zone_id"),
            "selection_method": "legacy_fixed_0.5" if selection == "legacy" else "percentile",
        })

    return suggestions


def detect_cross_domain_papers(ext_papers, ext_embeddings, room_embeddings, room_data,
                               selection="percentile", cross_domain_percentile=0.5, retrieved_at=None):
    """Find papers from different fields that are semantically close to room content.

    Cross-domain = fieldsOfStudy does not overlap the room's section names, and the paper is close
    to the room centroid: similarity at or above the `cross_domain_percentile` of all retrieved
    papers (legacy: similarity > 0.4).
    """
    if len(ext_embeddings) == 0 or len(room_embeddings) == 0:
        return []

    room_sections = set()
    for emb in room_data.get("embeddings", []):
        if emb.get("section"):
            room_sections.add(emb["section"].lower().replace("-", " "))

    room_centroid = np.mean(room_embeddings, axis=0).reshape(1, -1)
    sims = cosine_similarity(room_centroid, ext_embeddings)[0]
    pct = empirical_percentile(sims)
    retrieved_at = retrieved_at or datetime.now(timezone.utc).isoformat()

    cross_domain = []
    for i, (paper, sim) in enumerate(zip(ext_papers, sims)):
        paper_fields = set(f.lower() for f in (paper.get("fieldsOfStudy") or []))
        if not paper_fields:
            continue
        overlap = paper_fields & room_sections
        close = (sim > CROSS_DOMAIN_SIMILARITY_THRESHOLD) if selection == "legacy" else (pct[i] >= cross_domain_percentile)
        if len(overlap) == 0 and close:
            cross_domain.append({
                "paperId": paper_id(paper),
                "title": paper.get("title", ""),
                "fieldsOfStudy": list(paper.get("fieldsOfStudy") or []),
                "similarity_to_room": float(sim),
                "year": paper.get("year"),
                "similarity_percentile": round(float(pct[i]), 4),
                "source_trail": source_trail(paper, retrieved_at),
            })

    cross_domain.sort(key=lambda p: (-p["similarity_to_room"], p["paperId"]))
    return cross_domain[:20]


def _write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp-%d" % os.getpid())
    tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    os.replace(str(tmp), str(path))


def _empty(model, note):
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "model": model,
        "external_papers_embedded": 0,
        "cross_domain_zones": [],
        "gap_filling_suggestions": [],
        "cross_domain_papers": [],
        "zones": [],
        "papers": [],
        "note": note,
        "schema_version": SCHEMA_VERSION,
    }


# --- Main ---


def main(argv=None):
    parser = argparse.ArgumentParser(
        description=(
            "Embed external paper abstracts and detect cross-domain whitespace "
            "between room artifacts and published literature"
        )
    )
    parser.add_argument("room_dir", nargs="?", help="Path to room directory")
    parser.add_argument("--output", default=None,
                        help="Output JSON path (default: {room_dir}/.mindrian/external-whitespace-results.json)")
    parser.add_argument("--selection", choices=["percentile", "legacy"], default="percentile",
                        help="percentile (default): cutoffs are percentiles of the retrieved papers; "
                             "legacy: fixed 0.6 / 0.5 / 0.4 cutoffs")
    parser.add_argument("--zone-percentile", type=float, default=0.75,
                        help="External-gap papers at or above this distance percentile (default 0.75)")
    parser.add_argument("--gap-fill-percentile", type=float, default=0.9,
                        help="Gap-filling papers at or above this similarity percentile per zone (default 0.9)")
    parser.add_argument("--cross-domain-percentile", type=float, default=0.5,
                        help="Cross-domain papers at or above this similarity percentile (default 0.5)")

    args = parser.parse_args(argv)

    if not args.room_dir:
        parser.print_help()
        sys.exit(0)

    room_dir = Path(args.room_dir).resolve()

    if not room_dir.is_dir():
        print(f"Error: {room_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    for name in ("zone_percentile", "gap_fill_percentile", "cross_domain_percentile"):
        if not (0.0 <= getattr(args, name) <= 1.0):
            print("Error: --%s must be within 0..1" % name.replace("_", "-"), file=sys.stderr)
            sys.exit(1)

    output_path = Path(args.output).resolve() if args.output else room_dir / ".mindrian" / "external-whitespace-results.json"

    papers = load_external_papers(room_dir)
    if papers is None or len(papers) == 0:
        print("Error: No external papers found. Run query-semantic-scholar.cjs first.", file=sys.stderr)
        _write_json(output_path, _empty("none", "No external papers available"))
        sys.exit(1)
    papers_meta = dict(load_external_papers.last_meta)
    retrieved_at = papers_meta.get("retrieved_at") or papers_meta.get("timestamp") or datetime.now(timezone.utc).isoformat()

    room_data, room_embeddings = load_room_embeddings(room_dir)
    if room_data is None or room_embeddings is None or len(room_embeddings) == 0:
        print("Error: No room embeddings found. Run compute-whitespace-embeddings.py first.", file=sys.stderr)
        sys.exit(1)

    room_ws_results = load_whitespace_results(room_dir)
    room_model = room_data.get("metadata", {}).get("model_name", PRIMARY_MODEL)

    print(f"External whitespace: {len(papers)} papers to embed", file=sys.stderr)
    print(f"  Room artifacts: {len(room_embeddings)}", file=sys.stderr)
    print(f"  Room whitespace zones: {len(room_ws_results.get('gaps', [])) if room_ws_results else 0}", file=sys.stderr)

    model, model_name, model_dim = load_embedding_model(room_model)

    try:
        filtered_papers, ext_embeddings = embed_abstracts(model, papers)
    except ValueError as exc:
        print(f"External whitespace: embedding failed ({exc}); nothing written", file=sys.stderr)
        sys.exit(1)

    if len(filtered_papers) == 0:
        print("No papers with sufficient abstracts to embed.", file=sys.stderr)
        _write_json(output_path, _empty(model_name, "No papers had abstracts long enough to embed"))
        sys.exit(0)

    if ext_embeddings.shape[1] != room_embeddings.shape[1]:
        print("External whitespace: paper vectors (%d-dim, %s) and room vectors (%d-dim, model %s) are not "
              "comparable; re-embed the room with the same model" % (
                  ext_embeddings.shape[1], model_name, room_embeddings.shape[1], room_model), file=sys.stderr)
        _write_json(output_path, _empty(model_name, "Dimension mismatch between papers and room embeddings"))
        sys.exit(1)

    print(f"  Embedded {len(filtered_papers)} papers ({model_name}, {model_dim}-dim)", file=sys.stderr)

    cross_domain_zones = detect_external_whitespace(
        room_embeddings, room_data, ext_embeddings, filtered_papers,
        selection=args.selection, zone_percentile=args.zone_percentile, retrieved_at=retrieved_at)
    gap_filling = find_gap_filling_suggestions(
        room_ws_results, ext_embeddings, filtered_papers, room_embeddings, room_data=room_data,
        selection=args.selection, gap_fill_percentile=args.gap_fill_percentile, retrieved_at=retrieved_at)
    cross_domain_papers = detect_cross_domain_papers(
        filtered_papers, ext_embeddings, room_embeddings, room_data,
        selection=args.selection, cross_domain_percentile=args.cross_domain_percentile, retrieved_at=retrieved_at)

    now = datetime.now(timezone.utc).isoformat()
    result = {
        "timestamp": now,
        "model": model_name,
        "external_papers_embedded": len(filtered_papers),
        "cross_domain_zones": cross_domain_zones,
        "gap_filling_suggestions": gap_filling,
        "cross_domain_papers": cross_domain_papers,
        # aliases read by whitespace-command.cjs
        "zones": cross_domain_zones,
        "papers": cross_domain_papers,
        "schema_version": SCHEMA_VERSION,
        "provenance": {
            "script": "compute-external-whitespace.py",
            "computed_at": now,
            "selection": args.selection,
            "zone_percentile": args.zone_percentile,
            "gap_fill_percentile": args.gap_fill_percentile,
            "cross_domain_percentile": args.cross_domain_percentile,
            "model_room": room_model,
            "model_papers": model_name,
            "papers_input": len(papers),
            "papers_embedded": len(filtered_papers),
            "papers_retrieved_at": retrieved_at,
            "papers_query": papers_meta.get("query"),
            "external_literature_note": "Only the retrieved paper set was compared; this is not an exhaustive literature search.",
        },
    }
    _write_json(output_path, result)

    print("\nExternal Whitespace Analysis:", file=sys.stderr)
    print(f"  {len(filtered_papers)} external papers embedded", file=sys.stderr)
    print(f"  {len(cross_domain_zones)} cross-domain zones detected", file=sys.stderr)
    print(f"  {len(gap_filling)} gap-filling suggestions", file=sys.stderr)
    print(f"  {len(cross_domain_papers)} cross-domain papers identified", file=sys.stderr)
    print(f"  Output: {output_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
