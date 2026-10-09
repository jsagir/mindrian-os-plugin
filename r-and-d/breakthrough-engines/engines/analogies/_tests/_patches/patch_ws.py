p='scripts/discover-analogy-whitespace.py'
s=open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1,(old[:50],s.count(old))
    s=s.replace(old,new)

rep('''Per D-07, D-08, D-09 from Phase 64 CONTEXT.

Usage:
    python3 scripts/discover-analogy-whitespace.py /path/to/room [--output path]
''','''Per D-07, D-08, D-09 from Phase 64 CONTEXT.

2026 changes (all additive; --mode fixed reproduces the 2025 behaviour):
  - Gap strength and the HSI fallback are ranked by corpus percentile (this room's own
    pairs), not by absolute cut-offs (0.6/0.4/0.3, semantic 0.6, lsa 0.3). With fewer than
    --min-corpus pairs a percentile is meaningless, so the fixed cut-offs are used and the
    metadata says so.
  - The articulation gap no longer counts the two analogy endpoints as "articulating" the
    link. In 2025 the endpoints themselves were usually the nearest artifacts to their own
    centroid, so the gap was dominated by the endpoints' mutual distance, not by whether any
    OTHER artifact explains the transfer.
  - Vectors are unit-normalised before the centroid is taken.
  - Zones carry an evidence trail (nearest non-endpoint artifact, similarities) and the
    metadata carries provenance (mode, parameters, thresholds, input files, library versions).

Usage:
    python3 scripts/discover-analogy-whitespace.py /path/to/room [--output path]
        [--mode percentile|fixed] [--min-corpus N]
''')
rep('''import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
''','''import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

SCHEMA_VERSION = "2026.1"

# 2025 absolute cut-offs, kept behind --mode fixed and as the small-corpus fallback.
FIXED_HSI_SEMANTIC_MIN = 0.6
FIXED_HSI_LSA_MAX = 0.3
FIXED_GAP_STRONG = 0.6
FIXED_GAP_MODERATE = 0.4
FIXED_BRAIN_SUPPORT = 0.3

# Percentile-mode parameters (documented in metadata.parameters).
HSI_SEMANTIC_PERCENTILE = 0.75   # semantic_sim at or above this percentile of cross-section pairs
HSI_LSA_PERCENTILE = 0.25        # lsa_sim at or below this percentile of cross-section pairs
GAP_STRONG_PERCENTILE = 0.80
GAP_MODERATE_PERCENTILE = 0.50
BRAIN_SUPPORT_PERCENTILE = 0.50
DEFAULT_MIN_CORPUS = 5
HSI_MIN_CORPUS = 8
MAX_EDGES = 5000                 # bound loops and memory
''')

# loaders: guard bad vector shapes
rep('''    vectors = np.array([e["vector"] for e in embeddings_list])
    return data, vectors''','''    try:
        vectors = np.array([e["vector"] for e in embeddings_list], dtype=float)
    except (KeyError, TypeError, ValueError):
        print("whitespace-embeddings.json has entries without a numeric vector.", file=sys.stderr)
        return None, None
    if vectors.ndim != 2:
        print("whitespace-embeddings.json vectors have inconsistent lengths.", file=sys.stderr)
        return None, None
    return data, vectors''')
rep('''    vectors = np.array([b["vector"] for b in baselines_list])
    return data, vectors''','''    try:
        vectors = np.array([b["vector"] for b in baselines_list], dtype=float)
    except (KeyError, TypeError, ValueError):
        print("brain-baseline.json has entries without a numeric vector.", file=sys.stderr)
        return None, None
    if vectors.ndim != 2:
        print("brain-baseline.json vectors have inconsistent lengths.", file=sys.stderr)
        return None, None
    return data, vectors''')

# edges loader: tolerate list-shaped files
rep('''        data = json.loads(edge_path.read_text(encoding="utf-8"))
        return data.get("edges", [])
    except (json.JSONDecodeError, OSError):
        return None''','''        data = json.loads(edge_path.read_text(encoding="utf-8"))
        edges = data.get("edges", []) if isinstance(data, dict) else data
        return [e for e in edges if isinstance(e, dict)] if isinstance(edges, list) else None
    except (json.JSONDecodeError, OSError):
        return None''')

# HSI extraction
a=s.index("def extract_hsi_analogy_candidates(room_dir):")
b=s.index("# --- Core detection ---")
s=s[:a]+'''def _percentile_of(values, x):
    """Empirical percentile in [0, 1] with mid-rank ties; empty corpus -> 0.0."""
    vals = [v for v in values if isinstance(v, (int, float)) and v == v]
    if not vals or x is None or x != x:
        return 0.0
    less = sum(1 for v in vals if v < x)
    equal = sum(1 for v in vals if v == x)
    return (less + 0.5 * equal) / len(vals)


def _quantile(values, q):
    """Linear-interpolated quantile; empty corpus -> None."""
    vals = sorted(v for v in values if isinstance(v, (int, float)) and v == v)
    if not vals:
        return None
    pos = (len(vals) - 1) * min(1.0, max(0.0, q))
    lo, hi = int(pos), min(int(pos) + 1, len(vals) - 1)
    return vals[lo] + (vals[hi] - vals[lo]) * (pos - lo)


def _zscore(values, x):
    """Population z-score; zero variance or fewer than 2 values -> 0.0 (never NaN)."""
    vals = [v for v in values if isinstance(v, (int, float)) and v == v]
    if len(vals) < 2:
        return 0.0
    m = sum(vals) / len(vals)
    sd = (sum((v - m) ** 2 for v in vals) / len(vals)) ** 0.5
    return (x - m) / sd if sd > 0 else 0.0


def extract_hsi_analogy_candidates(room_dir, mode="percentile", info=None):
    """Extract analogy candidates from HSI results as fallback.

    Looks for pairs where both artifacts are in DIFFERENT sections with:
    - high semantic_sim (conceptually similar)
    - low lsa_sim (little shared wording)

    mode="fixed" uses the 2025 cut-offs (semantic_sim > 0.6, lsa_sim < 0.3).
    mode="percentile" (default) uses this room's own distribution: semantic_sim at or above
    the 75th percentile and lsa_sim at or below the 25th percentile of cross-section pairs;
    with fewer than HSI_MIN_CORPUS cross-section pairs it falls back to the fixed cut-offs.
    `info` (optional dict) is filled with the thresholds actually used.

    Returns:
        List of candidate dicts or empty list.
    """
    hsi_path = Path(room_dir) / ".hsi-results.json"
    if not hsi_path.exists():
        return []

    try:
        hsi_data = json.loads(hsi_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    if not isinstance(hsi_data, dict):
        return []

    hsi_pairs = hsi_data.get("hsi_pairs", [])
    artifacts = hsi_data.get("artifacts", [])

    # Build section lookup (skip malformed artifact rows instead of raising KeyError)
    artifact_sections = {
        a["id"]: a.get("section", "")
        for a in artifacts
        if isinstance(a, dict) and "id" in a
    }

    cross = []
    for pair in hsi_pairs:
        if not isinstance(pair, dict):
            continue
        left_id = pair.get("left_id", "")
        right_id = pair.get("right_id", "")
        lsa_sim = pair.get("lsa_sim", 1.0)
        semantic_sim = pair.get("semantic_sim", 0.0)
        if not isinstance(lsa_sim, (int, float)) or not isinstance(semantic_sim, (int, float)):
            continue
        if left_id == right_id:
            continue

        # Check cross-section + analogy pattern
        left_section = artifact_sections.get(left_id, "")
        right_section = artifact_sections.get(right_id, "")

        if left_section == right_section:
            continue  # same section, not cross-domain
        cross.append((left_id, right_id, left_section, right_section, semantic_sim, lsa_sim))

    use_percentile = mode == "percentile" and len(cross) >= HSI_MIN_CORPUS
    if use_percentile:
        sem_cut = _quantile([c[4] for c in cross], HSI_SEMANTIC_PERCENTILE)
        lsa_cut = _quantile([c[5] for c in cross], HSI_LSA_PERCENTILE)
    else:
        sem_cut, lsa_cut = FIXED_HSI_SEMANTIC_MIN, FIXED_HSI_LSA_MAX
    if info is not None:
        info.update({
            "hsi_mode": "percentile" if use_percentile else "fixed",
            "hsi_semantic_cut": sem_cut,
            "hsi_lsa_cut": lsa_cut,
            "hsi_cross_section_pairs": len(cross),
        })

    candidates = []
    for left_id, right_id, left_section, right_section, semantic_sim, lsa_sim in cross:
        if use_percentile:
            hit = semantic_sim >= sem_cut and lsa_sim <= lsa_cut
        else:
            hit = semantic_sim > sem_cut and lsa_sim < lsa_cut
        if hit:
            candidates.append({
                "source_id": left_id,
                "target_id": right_id,
                "source_section": left_section,
                "target_section": right_section,
                "analogy_distance": "cross-domain",
                "semantic_sim": semantic_sim,
                "lsa_sim": lsa_sim,
            })

    return candidates


'''+s[b:]

# detection
a=s.index("def detect_analogy_whitespace(room_dir):")
b=s.index("def _empty_result(note=\"\"):")
s=s[:a]+'''def _unit_rows(m):
    """L2-normalise rows; zero rows stay zero (no divide-by-zero)."""
    norms = np.linalg.norm(m, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return m / norms


def _lib_versions():
    out = {"numpy": getattr(np, "__version__", "unknown")}
    try:
        import sklearn
        out["scikit-learn"] = sklearn.__version__
    except Exception:  # version lookup only; never fatal
        out["scikit-learn"] = "unknown"
    return out


def detect_analogy_whitespace(room_dir, mode="percentile", min_corpus=DEFAULT_MIN_CORPUS):
    """Detect whitespace in unarticulated cross-domain transfer mechanisms.

    For each analogy pair (source -> target):
    1. Compute centroid between source and target embeddings
    2. Find Brain frameworks near centroid (potential transfer mechanism)
    3. Check articulation gap: how far is the nearest OTHER room artifact from centroid?
    4. High articulation gap + Brain frameworks present = unarticulated transfer

    Args:
        room_dir: path to room directory
        mode: "percentile" (default) ranks gaps against this room's own pairs and excludes the
              endpoints from the articulation check; "fixed" reproduces the 2025 behaviour.
        min_corpus: minimum number of scored pairs before percentile ranking is used.

    Returns:
        Result dict with metadata and zones
    """
    if mode not in ("percentile", "fixed"):
        raise ValueError("mode must be 'percentile' or 'fixed'")
    room_path = Path(room_dir)
    info = {}

    # Try KuzuDB-exported edges first, then HSI fallback
    analogy_edges = load_analogy_edges(room_path)
    data_source = "kuzu"

    if analogy_edges is None or len(analogy_edges) == 0:
        analogy_edges = extract_hsi_analogy_candidates(room_path, mode=mode, info=info)
        data_source = "hsi-fallback"

    if not analogy_edges:
        print(
            "No analogy data available (no .mindrian/analogy-edges.json and no "
            "qualifying HSI pairs with high semantic_sim / low lsa_sim).",
            file=sys.stderr,
        )
        return _empty_result("No analogy data available from either source")

    # Load embeddings
    ws_data, room_embs = load_embeddings(room_path)
    if ws_data is None or room_embs is None or len(room_embs) == 0:
        print("No whitespace embeddings found.", file=sys.stderr)
        return _empty_result("No whitespace embeddings found")

    bl_data, brain_embs = load_baselines(room_path)
    if bl_data is None or brain_embs is None or len(brain_embs) == 0:
        print("No Brain baseline embeddings found.", file=sys.stderr)
        return _empty_result("No Brain baseline embeddings found")

    if room_embs.shape[1] != brain_embs.shape[1]:
        msg = (
            f"Embedding dimension mismatch: room {room_embs.shape[1]} vs "
            f"Brain baseline {brain_embs.shape[1]}"
        )
        print(msg, file=sys.stderr)
        return _empty_result(msg)

    exclude_endpoints = mode == "percentile"
    if exclude_endpoints:
        room_embs = _unit_rows(room_embs)
        brain_embs = _unit_rows(brain_embs)

    # Build embedding lookup by artifact ID
    embeddings_list = ws_data.get("embeddings", [])
    emb_lookup = {}
    for i, entry in enumerate(embeddings_list):
        emb_lookup[entry["id"]] = i

    # Build section lookup
    section_lookup = {entry["id"]: entry.get("section", "") for entry in embeddings_list}

    # Brain framework names
    baselines_list = bl_data.get("baselines", [])
    brain_names = [b.get("name", f"brain-{i}") for i, b in enumerate(baselines_list)]

    # Fit k-NN on Brain embeddings
    brain_nn = NearestNeighbors(n_neighbors=min(3, len(brain_embs)), metric="cosine")
    brain_nn.fit(brain_embs)

    # Pass 1: measure every pair. Bounded, de-duplicated, self-edges skipped.
    records = []
    seen_pairs = set()
    skipped = {"missing_embedding": 0, "self_edge": 0, "duplicate": 0, "over_cap": 0}
    for edge in analogy_edges:
        if len(records) >= MAX_EDGES:
            skipped["over_cap"] += 1
            continue
        source_id = edge.get("source_id", "")
        target_id = edge.get("target_id", "")

        source_idx = emb_lookup.get(source_id)
        target_idx = emb_lookup.get(target_id)

        if source_idx is None or target_idx is None:
            skipped["missing_embedding"] += 1
            continue  # artifact not in embeddings
        if exclude_endpoints:
            if source_idx == target_idx:
                skipped["self_edge"] += 1
                continue
            key = tuple(sorted((source_idx, target_idx)))
            if key in seen_pairs:
                skipped["duplicate"] += 1
                continue
            seen_pairs.add(key)

        # Compute centroid between source and target
        source_emb = room_embs[source_idx]
        target_emb = room_embs[target_idx]
        centroid = (source_emb + target_emb) / 2.0
        centroid = centroid.reshape(1, -1)

        # Find nearest Brain frameworks to centroid
        brain_dists, brain_indices = brain_nn.kneighbors(centroid)
        brain_sims = 1.0 - brain_dists[0]
        nearest_brain = [brain_names[int(idx)] for idx in brain_indices[0]]

        # Compute articulation gap:
        # 1.0 - max(cosine_sim of any room artifact to the centroid)
        # Higher = less articulated. In percentile mode the two endpoints are excluded.
        all_sims = cosine_similarity(centroid, room_embs)[0]
        nearest_other = None
        if exclude_endpoints and len(all_sims) > 2:
            masked = all_sims.copy()
            masked[source_idx] = -np.inf
            masked[target_idx] = -np.inf
            best = int(np.argmax(masked))
            max_room_sim = float(masked[best])
            nearest_other = {
                "artifact": embeddings_list[best].get("id", ""),
                "title": embeddings_list[best].get("title", embeddings_list[best].get("id", "")),
                "similarity_to_centroid": round(max_room_sim, 4),
            }
        else:
            max_room_sim = float(np.max(all_sims))
        articulation_gap = 1.0 - max_room_sim

        records.append({
            "edge": edge,
            "source_id": source_id,
            "target_id": target_id,
            "source_idx": source_idx,
            "target_idx": target_idx,
            "nearest_brain": nearest_brain,
            "brain_sims": [float(x) for x in brain_sims],
            "brain_mean": float(np.mean(brain_sims)),
            "articulation_gap": articulation_gap,
            "nearest_other": nearest_other,
        })

    # Pass 2: classify. Percentile ranking needs a corpus; otherwise use the 2025 cut-offs.
    use_percentile = mode == "percentile" and len(records) >= max(2, int(min_corpus))
    gaps = [r["articulation_gap"] for r in records]
    brain_means = [r["brain_mean"] for r in records]

    zones = []
    zone_counter = 0
    for r in records:
        edge = r["edge"]
        source_id, target_id = r["source_id"], r["target_id"]
        source_idx, target_idx = r["source_idx"], r["target_idx"]
        articulation_gap = r["articulation_gap"]
        nearest_brain = r["nearest_brain"]

        # Determine transfer type
        if data_source == "kuzu":
            transfer_type = edge.get("analogy_distance", "cross-domain")
            # Map KuzuDB values to our categories
            if transfer_type == "near":
                transfer_type = "structural"
            elif transfer_type == "far":
                transfer_type = "semantic"
            else:
                transfer_type = "cross-domain"
        else:
            # HSI fallback: derive from similarity pattern
            semantic_sim = edge.get("semantic_sim", 0)
            lsa_sim = edge.get("lsa_sim", 0)
            gap = semantic_sim - lsa_sim
            if gap > 0.5:
                transfer_type = "cross-domain"
            elif gap > 0.3:
                transfer_type = "semantic"
            else:
                transfer_type = "structural"

        gap_pct = _percentile_of(gaps, articulation_gap)
        brain_pct = _percentile_of(brain_means, r["brain_mean"])
        if use_percentile:
            if gap_pct >= GAP_STRONG_PERCENTILE and brain_pct >= BRAIN_SUPPORT_PERCENTILE:
                gap_signal = "strong"
            elif gap_pct >= GAP_MODERATE_PERCENTILE:
                gap_signal = "moderate"
            else:
                gap_signal = "weak"
        else:
            # 2025 absolute cut-offs
            if articulation_gap > FIXED_GAP_STRONG and r["brain_mean"] > FIXED_BRAIN_SUPPORT:
                gap_signal = "strong"
            elif articulation_gap > FIXED_GAP_MODERATE:
                gap_signal = "moderate"
            else:
                gap_signal = "weak"

        # Get section info
        source_section = edge.get("source_section", section_lookup.get(source_id, ""))
        target_section = edge.get("target_section", section_lookup.get(target_id, ""))

        # Get titles
        source_title = embeddings_list[source_idx].get("title", source_id)
        target_title = embeddings_list[target_idx].get("title", target_id)

        zone_counter += 1
        zone = {
            "zone_id": f"ANA-WS-{zone_counter:03d}",
            "source_artifact": source_id,
            "target_artifact": target_id,
            "source_section": source_section,
            "target_section": target_section,
            "transfer_type": transfer_type,
            "nearest_brain_frameworks": nearest_brain,
            "articulation_gap": round(articulation_gap, 4),
            "gap_signal": gap_signal,
            "hypothesis": (
                f"The analogy between [{source_title}] and [{target_title}] "
                f"works through {nearest_brain[0] if nearest_brain else 'unknown'} "
                f"but the transfer mechanism hasn't been written down"
            ),
        }
        # 2026 additive evidence and ranking fields
        zone["articulation_gap_percentile"] = round(gap_pct, 4)
        zone["articulation_gap_z"] = round(_zscore(gaps, articulation_gap), 4)
        zone["brain_mean_similarity"] = round(r["brain_mean"], 4)
        zone["nearest_brain_similarities"] = [round(x, 4) for x in r["brain_sims"]]
        zone["endpoints_excluded_from_gap"] = exclude_endpoints and r["nearest_other"] is not None
        zone["nearest_other_artifact"] = r["nearest_other"]
        if "structural_fitness" in edge:
            zone["structural_fitness"] = edge.get("structural_fitness")
        # The hypothesis is a computed lead, not a verified finding: no novelty or second-source check ran.
        zone["verification"] = {"novelty_check": "not_checked", "second_signal": "brain_nearest_neighbour_only"}
        zones.append(zone)

    # Sort by gap signal strength then articulation gap descending (stable tie-break on ids)
    signal_order = {"strong": 0, "moderate": 1, "weak": 2}
    zones.sort(
        key=lambda z: (
            signal_order.get(z["gap_signal"], 3),
            -z["articulation_gap"],
            z["source_artifact"],
            z["target_artifact"],
        )
    )

    result = {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "analogies_checked": len(analogy_edges),
            "zones_found": len(zones),
            "source": data_source,
        },
        "zones": zones,
    }
    # 2026 provenance: what was computed, with which parameters, on which inputs.
    result["metadata"].update({
        "schema_version": SCHEMA_VERSION,
        "mode": "percentile" if use_percentile else "fixed",
        "requested_mode": mode,
        "pairs_scored": len(records),
        "pairs_skipped": skipped,
        "embedding_dim": int(room_embs.shape[1]),
        "room_artifacts_embedded": int(room_embs.shape[0]),
        "brain_baselines": int(brain_embs.shape[0]),
        "endpoints_excluded_from_gap": exclude_endpoints,
        "parameters": {
            "min_corpus": int(min_corpus),
            "gap_strong_percentile": GAP_STRONG_PERCENTILE,
            "gap_moderate_percentile": GAP_MODERATE_PERCENTILE,
            "brain_support_percentile": BRAIN_SUPPORT_PERCENTILE,
            "fixed_gap_strong": FIXED_GAP_STRONG,
            "fixed_gap_moderate": FIXED_GAP_MODERATE,
            "fixed_brain_support": FIXED_BRAIN_SUPPORT,
        },
        "hsi_thresholds": info or None,
        "libraries": _lib_versions(),
        "note_fallback": (
            "fewer than min_corpus pairs scored; fixed 2025 cut-offs used"
            if mode == "percentile" and not use_percentile else None
        ),
    })

    return result


'''+s[b:]

rep('''            "source": "none",
            "note": note,
        },''','''            "source": "none",
            "note": note,
            "schema_version": SCHEMA_VERSION,
        },''')
rep('''    args = parser.parse_args()
    room_dir = Path(args.room_dir).resolve()''','''    parser.add_argument(
        "--mode",
        choices=["percentile", "fixed"],
        default="percentile",
        help="percentile (default): rank against this room's own pairs; fixed: 2025 absolute cut-offs",
    )
    parser.add_argument(
        "--min-corpus",
        type=int,
        default=DEFAULT_MIN_CORPUS,
        help="minimum scored pairs before percentile ranking is used (default %(default)s)",
    )

    args = parser.parse_args()
    room_dir = Path(args.room_dir).resolve()''')
rep('''    result = detect_analogy_whitespace(room_dir)''','''    result = detect_analogy_whitespace(room_dir, mode=args.mode, min_corpus=args.min_corpus)''')
open(p,'w',encoding='utf-8').write(s)
print('ok')
