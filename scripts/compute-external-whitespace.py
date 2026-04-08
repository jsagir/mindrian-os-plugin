#!/usr/bin/env python3
"""
compute-external-whitespace.py -- External Corpus Whitespace Detection
=======================================================================
Embeds external paper abstracts (from Semantic Scholar) in the same
768-dim space as room artifacts, then detects cross-domain whitespace
between room content and published literature.

Loads external-papers.json (from query-semantic-scholar.cjs), embeds
abstracts using the same model as compute-whitespace-embeddings.py
(BAAI/llm-embedder primary, MiniLM fallback), and identifies:

1. External whitespace: papers covering territory the room hasn't explored
2. Gap-filling suggestions: papers that could fill known room whitespace zones
3. Cross-domain zones: papers from different fieldsOfStudy near room content

Usage:
    python3 scripts/compute-external-whitespace.py ROOM_DIR [--output PATH]

Input:
    {room_dir}/.mindrian/external-papers.json (from query-semantic-scholar.cjs)
    {room_dir}/.mindrian/whitespace-embeddings.json (room artifacts, Phase 60)
    {room_dir}/.mindrian/whitespace-results.json (room whitespace zones, Phase 61)

Output:
    {room_dir}/.mindrian/external-whitespace-results.json
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# --- Guarded imports ---

try:
    import numpy as np
except ImportError:
    print(
        "External whitespace requires numpy. Run: pip install -r requirements-whitespace.txt",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    from sklearn.metrics.pairwise import cosine_similarity, cosine_distances
except ImportError:
    print(
        "External whitespace requires scikit-learn. Run: pip install -r requirements-whitespace.txt",
        file=sys.stderr,
    )
    sys.exit(1)


# --- Constants (same as compute-whitespace-embeddings.py) ---

PRIMARY_MODEL = "BAAI/llm-embedder"
FALLBACK_MODEL = "all-MiniLM-L6-v2"

# Thresholds for cross-domain detection
EXTERNAL_WHITESPACE_THRESHOLD = 0.6  # cosine distance > this = unexplored
GAP_FILLING_SIMILARITY_THRESHOLD = 0.5  # cosine similarity > this = relevant to gap
MIN_ABSTRACT_LENGTH = 50  # skip short abstracts


# --- Model loading (mirrors compute-whitespace-embeddings.py) ---


def load_embedding_model(target_model=None):
    """Load embedding model with llm-embedder primary, MiniLM fallback.

    Args:
        target_model: Specific model to load. If None, auto-detect.

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

    # Auto-detect: try primary first, fall back
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


# --- Input loading ---


def load_external_papers(room_dir):
    """Load external-papers.json from query-semantic-scholar.cjs output.

    Returns:
        List of paper dicts or None if missing.
    """
    papers_path = Path(room_dir) / ".mindrian" / "external-papers.json"
    if not papers_path.exists():
        return None

    try:
        data = json.loads(papers_path.read_text(encoding="utf-8"))
        return data.get("papers", [])
    except (json.JSONDecodeError, OSError):
        return None


def load_room_embeddings(room_dir):
    """Load whitespace-embeddings.json (Phase 60 room artifact embeddings).

    Returns:
        Tuple of (data dict, embedding_matrix np.ndarray) or (None, None).
    """
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
    """Load whitespace-results.json (Phase 61 gap detection results).

    Returns:
        Data dict or None if missing.
    """
    ws_path = Path(room_dir) / ".mindrian" / "whitespace-results.json"
    if not ws_path.exists():
        return None

    try:
        return json.loads(ws_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


# --- Core analysis ---


def embed_abstracts(model, papers):
    """Embed paper abstracts using the same model as room artifacts.

    Args:
        model: SentenceTransformer model
        papers: List of paper dicts with 'abstract' field

    Returns:
        Tuple of (filtered_papers, embedding_matrix np.ndarray)
        Papers with short abstracts are filtered out.
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

    embeddings = model.encode(texts, show_progress_bar=False)
    return filtered, np.array(embeddings)


def detect_external_whitespace(room_embeddings, room_data, ext_embeddings, ext_papers):
    """Detect external papers that cover territory the room hasn't explored.

    For each external paper, compute min cosine distance to nearest room artifact.
    Papers with high distance (> threshold) from ALL room artifacts = external whitespace.

    Args:
        room_embeddings: np.ndarray (N, dim) room artifact vectors
        room_data: dict with embeddings list for metadata
        ext_embeddings: np.ndarray (M, dim) external paper vectors
        ext_papers: list of paper dicts

    Returns:
        List of cross-domain zone dicts
    """
    if len(room_embeddings) == 0 or len(ext_embeddings) == 0:
        return []

    # Cosine distances: (M, N) matrix
    dist_matrix = cosine_distances(ext_embeddings, room_embeddings)

    # For each external paper, find min distance to nearest room artifact
    min_dists = np.min(dist_matrix, axis=1)
    nearest_room_idx = np.argmin(dist_matrix, axis=1)

    room_emb_list = room_data.get("embeddings", [])
    zones = []
    zone_counter = 1

    for i, (paper, dist) in enumerate(zip(ext_papers, min_dists)):
        if dist > EXTERNAL_WHITESPACE_THRESHOLD:
            nearest_idx = int(nearest_room_idx[i])
            nearest_artifact = (
                room_emb_list[nearest_idx]
                if nearest_idx < len(room_emb_list)
                else {"id": "unknown", "title": "unknown"}
            )

            # Determine if this is cross-domain (different field of study)
            paper_fields = set(paper.get("fieldsOfStudy") or [])

            zones.append({
                "zone_id": f"xd_{zone_counter:03d}",
                "type": "external_literature_gap",
                "description": (
                    f"Papers in {', '.join(paper_fields) if paper_fields else 'unclassified fields'} "
                    f"cover territory room hasn't explored"
                ),
                "relevant_papers": [{
                    "paperId": paper["paperId"],
                    "title": paper.get("title", ""),
                    "year": paper.get("year"),
                    "distance": float(dist),
                }],
                "nearest_room_zone": None,  # updated below if whitespace zones exist
                "nearest_room_artifacts": [nearest_artifact.get("id", "unknown")],
            })
            zone_counter += 1

    # Sort by distance (highest = most novel territory first)
    zones.sort(key=lambda z: z["relevant_papers"][0]["distance"], reverse=True)

    return zones


def find_gap_filling_suggestions(room_ws_results, ext_embeddings, ext_papers, room_embeddings):
    """Find external papers that could fill known room whitespace zones.

    For each room whitespace zone with a centroid, find external papers
    semantically close to that zone.

    Args:
        room_ws_results: dict from whitespace-results.json
        ext_embeddings: np.ndarray (M, dim) external paper vectors
        ext_papers: list of paper dicts
        room_embeddings: np.ndarray (N, dim) room artifact vectors

    Returns:
        List of gap-filling suggestion dicts
    """
    if room_ws_results is None or len(ext_embeddings) == 0:
        return []

    gaps = room_ws_results.get("gaps", [])
    if not gaps:
        return []

    suggestions = []

    for gap in gaps:
        # Use nearest room artifacts to approximate zone center
        # (gaps don't always have centroids, but they have nearest artifacts)
        nearest_indices = []
        nearest_arts = gap.get("nearest_room_artifacts", [])
        for art in nearest_arts:
            if isinstance(art, dict) and "artifact_id" in art:
                # Find index by matching
                pass  # Skip complex matching, use brain framework position
            elif isinstance(art, int):
                nearest_indices.append(art)

        # If we have nearest artifact indices, compute centroid from their embeddings
        if nearest_indices and len(room_embeddings) > 0:
            valid_indices = [idx for idx in nearest_indices if idx < len(room_embeddings)]
            if valid_indices:
                zone_center = np.mean(room_embeddings[valid_indices], axis=0).reshape(1, -1)
            else:
                continue
        else:
            continue

        # Compute similarity between zone center and all external papers
        sim = cosine_similarity(zone_center, ext_embeddings)[0]

        # Find papers above similarity threshold
        matching_indices = np.where(sim > GAP_FILLING_SIMILARITY_THRESHOLD)[0]

        if len(matching_indices) == 0:
            continue

        # Sort by relevance (highest similarity first)
        sorted_matches = sorted(matching_indices, key=lambda idx: sim[idx], reverse=True)

        suggested_papers = []
        for idx in sorted_matches[:5]:  # top 5 suggestions per gap
            paper = ext_papers[idx]
            abstract = (paper.get("abstract") or "")[:200]
            suggested_papers.append({
                "paperId": paper["paperId"],
                "title": paper.get("title", ""),
                "abstract_preview": abstract,
                "relevance_score": float(sim[idx]),
            })

        brain_fw = gap.get("brain_framework", "unknown")
        suggestions.append({
            "room_zone_id": f"gap_{brain_fw}",
            "brain_framework": brain_fw,
            "suggested_papers": suggested_papers,
        })

    return suggestions


def detect_cross_domain_papers(ext_papers, ext_embeddings, room_embeddings, room_data):
    """Find papers from different fields that are semantically close to room content.

    Cross-domain = paper's fieldsOfStudy does NOT match room's primary domain
    but the paper is semantically close to room artifacts.

    Args:
        ext_papers: list of paper dicts
        ext_embeddings: np.ndarray (M, dim)
        room_embeddings: np.ndarray (N, dim)
        room_data: dict with room metadata

    Returns:
        List of cross-domain paper dicts
    """
    if len(ext_embeddings) == 0 or len(room_embeddings) == 0:
        return []

    # Determine room's primary domain from section names
    room_sections = set()
    for emb in room_data.get("embeddings", []):
        if emb.get("section"):
            room_sections.add(emb["section"].lower().replace("-", " "))

    # Compute similarity between each external paper and room centroid
    room_centroid = np.mean(room_embeddings, axis=0).reshape(1, -1)
    sims = cosine_similarity(room_centroid, ext_embeddings)[0]

    cross_domain = []
    for i, (paper, sim) in enumerate(zip(ext_papers, sims)):
        paper_fields = set(f.lower() for f in (paper.get("fieldsOfStudy") or []))

        # Skip if no field info
        if not paper_fields:
            continue

        # Check if paper fields are "different" from room sections
        overlap = paper_fields & room_sections
        if len(overlap) == 0 and sim > 0.4:  # different field but semantically close
            cross_domain.append({
                "paperId": paper["paperId"],
                "title": paper.get("title", ""),
                "fieldsOfStudy": list(paper.get("fieldsOfStudy") or []),
                "similarity_to_room": float(sim),
                "year": paper.get("year"),
            })

    # Sort by similarity (closest cross-domain papers first)
    cross_domain.sort(key=lambda p: p["similarity_to_room"], reverse=True)

    return cross_domain[:20]  # cap at 20


# --- Main ---


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Embed external paper abstracts and detect cross-domain whitespace "
            "between room artifacts and published literature"
        )
    )
    parser.add_argument("room_dir", nargs="?", help="Path to room directory")
    parser.add_argument(
        "--output",
        default=None,
        help="Output JSON path (default: {room_dir}/.mindrian/external-whitespace-results.json)",
    )

    args = parser.parse_args()

    if not args.room_dir:
        parser.print_help()
        sys.exit(0)

    room_dir = Path(args.room_dir).resolve()

    if not room_dir.is_dir():
        print(f"Error: {room_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    # Determine output path
    if args.output:
        output_path = Path(args.output).resolve()
    else:
        output_path = room_dir / ".mindrian" / "external-whitespace-results.json"

    # Step 1: Load inputs
    papers = load_external_papers(room_dir)
    if papers is None or len(papers) == 0:
        print(
            "Error: No external papers found. Run query-semantic-scholar.cjs first.",
            file=sys.stderr,
        )
        # Write empty result
        empty_result = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "model": "none",
            "external_papers_embedded": 0,
            "cross_domain_zones": [],
            "gap_filling_suggestions": [],
            "cross_domain_papers": [],
            "note": "No external papers available",
        }
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(empty_result, indent=2), encoding="utf-8")
        sys.exit(1)

    room_data, room_embeddings = load_room_embeddings(room_dir)
    if room_data is None or room_embeddings is None or len(room_embeddings) == 0:
        print(
            "Error: No room embeddings found. Run compute-whitespace-embeddings.py first.",
            file=sys.stderr,
        )
        sys.exit(1)

    room_ws_results = load_whitespace_results(room_dir)

    # Detect model used for room embeddings (must match)
    room_model = room_data.get("metadata", {}).get("model_name", PRIMARY_MODEL)

    print(f"External whitespace: {len(papers)} papers to embed", file=sys.stderr)
    print(f"  Room artifacts: {len(room_embeddings)}", file=sys.stderr)
    print(
        f"  Room whitespace zones: {len(room_ws_results.get('gaps', [])) if room_ws_results else 0}",
        file=sys.stderr,
    )

    # Step 2: Embed external abstracts with SAME model as room
    model, model_name, model_dim = load_embedding_model(room_model)

    filtered_papers, ext_embeddings = embed_abstracts(model, papers)

    if len(filtered_papers) == 0:
        print("No papers with sufficient abstracts to embed.", file=sys.stderr)
        empty_result = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "model": model_name,
            "external_papers_embedded": 0,
            "cross_domain_zones": [],
            "gap_filling_suggestions": [],
            "cross_domain_papers": [],
            "note": "No papers had abstracts long enough to embed",
        }
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(empty_result, indent=2), encoding="utf-8")
        sys.exit(0)

    print(
        f"  Embedded {len(filtered_papers)} papers ({model_name}, {model_dim}-dim)",
        file=sys.stderr,
    )

    # Step 3: Detect cross-domain whitespace
    cross_domain_zones = detect_external_whitespace(
        room_embeddings, room_data, ext_embeddings, filtered_papers
    )

    gap_filling = find_gap_filling_suggestions(
        room_ws_results, ext_embeddings, filtered_papers, room_embeddings
    )

    cross_domain_papers = detect_cross_domain_papers(
        filtered_papers, ext_embeddings, room_embeddings, room_data
    )

    # Step 4: Write results
    result = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "model": model_name,
        "external_papers_embedded": len(filtered_papers),
        "cross_domain_zones": cross_domain_zones,
        "gap_filling_suggestions": gap_filling,
        "cross_domain_papers": cross_domain_papers,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2), encoding="utf-8")

    # Print summary
    print(
        f"\nExternal Whitespace Analysis:",
        file=sys.stderr,
    )
    print(
        f"  {len(filtered_papers)} external papers embedded",
        file=sys.stderr,
    )
    print(
        f"  {len(cross_domain_zones)} cross-domain zones detected",
        file=sys.stderr,
    )
    print(
        f"  {len(gap_filling)} gap-filling suggestions",
        file=sys.stderr,
    )
    print(
        f"  {len(cross_domain_papers)} cross-domain papers identified",
        file=sys.stderr,
    )
    print(f"  Output: {output_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
