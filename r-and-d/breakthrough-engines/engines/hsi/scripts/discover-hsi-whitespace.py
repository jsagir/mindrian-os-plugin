#!/usr/bin/env python3
"""
discover-hsi-whitespace.py -- HSI-Seeded Whitespace Detection
==============================================================
After HSI finds surprising pairs (high |semantic_sim - structural_sim|),
this script maps the embedding region BETWEEN them to find missing
connecting artifacts.

For each qualifying HSI pair:
  1. Compute centroid of the two artifacts' embeddings
  2. Measure Brain-framework density and room-artifact density near the centroid
  3. If Brain is dense there but the room is sparse, that's a whitespace zone
     -- the missing connecting insight

Per D-01, D-02, D-03 from Phase 64 CONTEXT.

Usage:
    python3 scripts/discover-hsi-whitespace.py /path/to/room [--threshold 0.4] [--output path]
        [--signal-method percentile|fixed]

Output:
    {room_dir}/.mindrian/discovery-hsi-whitespace.json

2026 revision (existing output keys are kept; new keys are additive):
  - Room density is measured WITHOUT the two seed artifacts. The original left them in, so the
    centroid sat next to its own seeds, room density was almost always high and the "strong"
    signal (room density < 0.3) practically never fired.
  - Qualifying pairs follow the ranking compute-hsi.py used. With no --threshold, a results file
    written with percentile ranking is used as ranked (its pairs are already the top of the
    corpus), and an older file falls back to hsi_score > 0.4. An explicit --threshold still means
    hsi_score > threshold.
  - Gap-signal strength is read against the room's own distribution (--signal-method percentile,
    default): the centroid's Brain and room density are compared with every room artifact's own
    Brain and room density. Rooms with fewer than 4 artifacts, or --signal-method fixed, use the
    original absolute cutoffs.
  - Each zone carries hsi_percentile, a second signal, a source trail and a novelty-check status.
  - scikit-learn is no longer required; results are written atomically; vectors of different
    dimension are reported instead of raising.
"""

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import numpy as np
except ImportError:
    print(
        "HSI whitespace discovery requires numpy. Run: pip install -r requirements-whitespace.txt",
        file=sys.stderr,
    )
    sys.exit(1)

SCHEMA_VERSION = "2.0"


# --- numpy cosine helpers (replace sklearn) ---


def _unit(m):
    m = np.atleast_2d(np.asarray(m, dtype=float))
    n = np.linalg.norm(m, axis=1, keepdims=True)
    n[n < 1e-12] = 1.0
    return m / n


def cosine_similarity(a, b):
    return _unit(a) @ _unit(b).T


def knn_cosine(train, query, k):
    """(cosine similarities, indices) of the k most similar train rows per query row."""
    k = max(1, min(k, train.shape[0]))
    sims = cosine_similarity(query, train)
    idx = np.argsort(-sims, axis=1, kind="stable")[:, :k]
    return np.take_along_axis(sims, idx, axis=1), idx


def mean_topk_similarity(train, query, k=3):
    return knn_cosine(train, query, k)[0].mean(axis=1)


# --- Embedding loading (reused from compute-whitespace-gaps.py) ---


def load_embeddings(room_dir):
    """Load Phase 60 whitespace-embeddings.json. Returns (data, matrix) or (None, None)."""
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


def load_baselines(room_dir):
    """Load Phase 60 brain-baseline.json. Returns (data, matrix) or (None, None)."""
    bl_path = Path(room_dir) / ".mindrian" / "brain-baseline.json"
    if not bl_path.exists():
        return None, None

    try:
        data = json.loads(bl_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None, None

    baselines_list = data.get("baselines", [])
    if not baselines_list:
        return data, np.array([])

    vectors = np.array([b["vector"] for b in baselines_list])
    return data, vectors


def load_hsi_results(room_dir):
    """Load .hsi-results.json from room directory. Returns dict or None."""
    hsi_path = Path(room_dir) / ".hsi-results.json"
    if not hsi_path.exists():
        return None

    try:
        return json.loads(hsi_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


# --- Core detection ---


def classify_gap_signal(brain_density, room_density):
    """Classify gap signal strength from absolute density contrast (legacy cutoffs).

    "strong" if brain_density > 0.5 and room_density < 0.3
    "moderate" if brain_density > 0.3 and room_density < 0.5
    "weak" otherwise
    """
    if brain_density > 0.5 and room_density < 0.3:
        return "strong"
    if brain_density > 0.3 and room_density < 0.5:
        return "moderate"
    return "weak"


def classify_gap_signal_percentile(brain_pct, room_pct):
    """Strength from percentiles against the room's own artifacts: Brain density high and room
    density low relative to where the room's artifacts sit."""
    if brain_pct >= 0.75 and room_pct <= 0.25:
        return "strong"
    if brain_pct >= 0.5 and room_pct <= 0.5:
        return "moderate"
    return "weak"


def select_qualifying_pairs(hsi_data, threshold):
    """(pairs, rule) per the module docstring."""
    pairs = hsi_data.get("hsi_pairs", []) or []
    if threshold is not None:
        return [p for p in pairs if p.get("hsi_score", 0) > threshold], "hsi_score > %s" % threshold
    ranking = (hsi_data.get("metadata", {}) or {}).get("ranking", {}) or {}
    if ranking.get("method") == "percentile" or any("hsi_percentile" in p for p in pairs):
        return list(pairs), "as ranked by compute-hsi (percentile)"
    return [p for p in pairs if p.get("hsi_score", 0) > 0.4], "hsi_score > 0.4 (legacy default)"


def detect_hsi_whitespace(room_dir, threshold=None, signal_method="percentile"):
    """Detect whitespace zones between surprising HSI pairs.

    Args:
        room_dir: path to room directory
        threshold: explicit minimum HSI score (None = follow the results file's own ranking)
        signal_method: 'percentile' (default) or 'fixed'

    Returns:
        Result dict with metadata and zones
    """
    room_path = Path(room_dir)
    now_iso = datetime.now(timezone.utc).isoformat()

    hsi_data = load_hsi_results(room_path)
    if hsi_data is None:
        print("No .hsi-results.json found. Run compute-hsi.py first.", file=sys.stderr)
        return _empty_result("No .hsi-results.json found")

    qualifying_pairs, rule = select_qualifying_pairs(hsi_data, threshold)
    if not qualifying_pairs:
        print("No qualifying HSI pairs found (%s)." % rule, file=sys.stderr)
        return _empty_result("No qualifying HSI pairs (%s)" % rule)

    ws_data, room_embs = load_embeddings(room_path)
    if ws_data is None or room_embs is None or len(room_embs) == 0:
        print("No whitespace embeddings found.", file=sys.stderr)
        return _empty_result("No whitespace embeddings found")

    bl_data, brain_embs = load_baselines(room_path)
    if bl_data is None or brain_embs is None or len(brain_embs) == 0:
        print("No Brain baseline embeddings found.", file=sys.stderr)
        return _empty_result("No Brain baseline embeddings found")

    if room_embs.ndim != 2 or brain_embs.ndim != 2 or room_embs.shape[1] != brain_embs.shape[1]:
        print("Room and Brain vectors are not comparable (shapes %s vs %s); re-embed with the same model"
              % (room_embs.shape, brain_embs.shape), file=sys.stderr)
        return _empty_result("Dimension mismatch between room and Brain embeddings")

    embeddings_list = ws_data.get("embeddings", [])
    emb_lookup = {entry["id"]: i for i, entry in enumerate(embeddings_list)}

    baselines_list = bl_data.get("baselines", [])
    brain_names = [b.get("name", f"brain-{i}") for i, b in enumerate(baselines_list)]

    n_room = len(room_embs)
    use_percentile = signal_method == "percentile" and n_room >= 4

    # Reference distributions: each room artifact's own Brain density and room density
    # (room density leaves the artifact itself out).
    ref_brain = ref_room = None
    if use_percentile:
        ref_brain = mean_topk_similarity(brain_embs, room_embs, 3)
        sims_rr = cosine_similarity(room_embs, room_embs)
        np.fill_diagonal(sims_rr, -np.inf)
        k = min(3, n_room - 1)
        ref_room = np.sort(sims_rr, axis=1)[:, ::-1][:, :k].mean(axis=1)

    zones = []
    zone_counter = 0
    skipped = 0

    for pair in qualifying_pairs:
        left_id = pair.get("left_id", "")
        right_id = pair.get("right_id", "")

        left_idx = emb_lookup.get(left_id)
        right_idx = emb_lookup.get(right_id)

        if left_idx is None or right_idx is None:
            skipped += 1
            continue  # artifact not in embeddings (skipped during embedding phase)

        centroid = ((room_embs[left_idx] + room_embs[right_idx]) / 2.0).reshape(1, -1)

        brain_sims_all, brain_indices = knn_cosine(brain_embs, centroid, 3)
        brain_density = float(brain_sims_all[0].mean())

        # Room density WITHOUT the two seed artifacts
        keep = [i for i in range(n_room) if i not in (left_idx, right_idx)]
        if keep:
            room_sims_all, room_rel = knn_cosine(room_embs[keep], centroid, 3)
            room_density = float(room_sims_all[0].mean())
            room_indices = [keep[int(j)] for j in room_rel[0]]
        else:
            room_density = 0.0
            room_indices = []

        if use_percentile:
            brain_pct = float((ref_brain <= brain_density).mean())
            room_pct = float((ref_room <= room_density).mean())
            gap_signal = classify_gap_signal_percentile(brain_pct, room_pct)
            signal_method_used = "percentile_vs_room_artifacts"
        else:
            brain_pct = room_pct = None
            gap_signal = classify_gap_signal(brain_density, room_density)
            signal_method_used = "fixed_cutoffs"

        nearest_brain = [brain_names[int(idx)] for idx in brain_indices[0]]
        nearest_room = [embeddings_list[i].get("id", f"artifact-{i}") for i in room_indices]

        left_title = embeddings_list[left_idx].get("title", left_id)
        right_title = embeddings_list[right_idx].get("title", right_id)

        # Second signal: do the two seeds' text lexically agree with the dense verdict? The pair's
        # own lexical_sim (when compute-hsi.py wrote it) is low for a real connection gap.
        lex = pair.get("lexical_sim")
        second = {
            "method": "pair_lexical_similarity",
            "lexical_sim": None if lex is None else round(float(lex), 4),
            "confirmed": None if lex is None else bool(float(lex) < 0.5),
        }

        zone_counter += 1
        zones.append({
            "zone_id": f"HSI-WS-{zone_counter:03d}",
            "seed_pair": {
                "left_id": left_id,
                "right_id": right_id,
                "hsi_score": pair.get("hsi_score", 0),
                "hsi_percentile": pair.get("hsi_percentile"),
            },
            "centroid_description": f"Region between [{left_title}] and [{right_title}]",
            "nearest_brain_frameworks": nearest_brain,
            "nearest_room_artifacts": nearest_room,
            "brain_density": round(brain_density, 4),
            "room_density": round(room_density, 4),
            "gap_signal": gap_signal,
            "hypothesis": (
                f"The connection between [{left_title}] and [{right_title}] "
                f"may involve {nearest_brain[0] if nearest_brain else 'unknown framework'} "
                f"-- this connecting insight hasn't been articulated yet"
            ),
            # additive 2026 keys
            "brain_density_percentile": None if brain_pct is None else round(brain_pct, 4),
            "room_density_percentile": None if room_pct is None else round(room_pct, 4),
            "signal_method": signal_method_used,
            "second_signal": second,
            "novelty_check": {"status": "in_room_check_only", "external_literature": "not_run"},
            "source_trail": [
                {"source": "hsi-results", "artifact_id": left_id,
                 "path": embeddings_list[left_idx].get("path"), "retrieved_at": now_iso},
                {"source": "hsi-results", "artifact_id": right_id,
                 "path": embeddings_list[right_idx].get("path"), "retrieved_at": now_iso},
            ] + [
                {"source": "brain-baseline.json", "source_id": nm,
                 "retrieved_at": (bl_data.get("metadata", {}) or {}).get("timestamp", now_iso)}
                for nm in nearest_brain[:1]
            ],
        })

    signal_order = {"strong": 0, "moderate": 1, "weak": 2}
    zones.sort(key=lambda z: (signal_order.get(z["gap_signal"], 3), -z["brain_density"], z["zone_id"]))

    return {
        "metadata": {
            "timestamp": now_iso,
            "hsi_pairs_checked": len(qualifying_pairs),
            "zones_found": len(zones),
            "threshold": threshold,
            "schema_version": SCHEMA_VERSION,
            "pair_selection": rule,
            "pairs_skipped_no_embedding": skipped,
            "provenance": {
                "script": "discover-hsi-whitespace.py",
                "computed_at": now_iso,
                "signal_method": "percentile" if use_percentile else "fixed",
                "room_density_excludes_seed_pair": True,
                "versions": {"python": sys.version.split()[0], "numpy": np.__version__},
            },
        },
        "zones": zones,
    }


def _empty_result(note=""):
    """Return empty result structure for edge cases."""
    return {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "hsi_pairs_checked": 0,
            "zones_found": 0,
            "note": note,
            "schema_version": SCHEMA_VERSION,
        },
        "zones": [],
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description="Detect whitespace zones between surprising HSI pairs")
    parser.add_argument("room_dir", help="Path to room directory")
    parser.add_argument(
        "--threshold",
        type=float,
        default=None,
        help="Minimum HSI score for qualifying pairs. Default: follow the ranking in .hsi-results.json "
             "(percentile files are used as ranked; older files use 0.4)",
    )
    parser.add_argument("--signal-method", choices=["percentile", "fixed"], default="percentile",
                        help="percentile (default): judge density against the room's own artifacts; "
                             "fixed: original absolute cutoffs")
    parser.add_argument(
        "--output",
        default=None,
        help="Output JSON path (default: {room_dir}/.mindrian/discovery-hsi-whitespace.json)",
    )

    args = parser.parse_args(argv)
    room_dir = Path(args.room_dir).resolve()

    if not room_dir.is_dir():
        print(f"Error: {room_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    result = detect_hsi_whitespace(room_dir, threshold=args.threshold, signal_method=args.signal_method)

    output_path = Path(args.output).resolve() if args.output else room_dir / ".mindrian" / "discovery-hsi-whitespace.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = output_path.with_name(output_path.name + ".tmp-%d" % os.getpid())
    tmp.write_text(json.dumps(result, indent=2), encoding="utf-8")
    os.replace(str(tmp), str(output_path))

    zones = result.get("zones", [])
    n_strong = sum(1 for z in zones if z["gap_signal"] == "strong")
    n_moderate = sum(1 for z in zones if z["gap_signal"] == "moderate")
    n_weak = sum(1 for z in zones if z["gap_signal"] == "weak")

    print(
        f"HSI Whitespace: {len(zones)} zones found "
        f"({n_strong} strong, {n_moderate} moderate, {n_weak} weak) "
        f"from {result['metadata']['hsi_pairs_checked']} qualifying pairs",
        file=sys.stderr,
    )
    print(f"  Output: {output_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
