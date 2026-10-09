#!/usr/bin/env python3
"""
discover-rs-whitespace.py -- RS-Seeded Whitespace Detection
============================================================
After Reverse Salient detection finds bottleneck sections, this script
maps the embedding region DOWNSTREAM of each bottleneck to find what's
missing beyond it.

For each RS bottleneck:
  1. Identify target_section -- the section the bottleneck INFORMS/ENABLES
  2. Collect all room artifact embeddings from that target section
  3. Compute centroid of target section artifacts
  4. Check if Brain frameworks exist near centroid but NOT near actual
     target artifacts -- that's downstream whitespace

"The bottleneck prevents seeing what's beyond it."

Per D-04, D-05, D-06 from Phase 64 CONTEXT.

Usage:
    python3 scripts/discover-rs-whitespace.py /path/to/room [--output path]
        [--signal-method percentile|fixed]

Output:
    {room_dir}/.mindrian/discovery-rs-whitespace.json

2026 revision (existing output keys are kept; new keys are additive):
  - The fixed coverage cutoffs (< 0.3 strong, < 0.5 moderate) depend on the embedding model. By
    default coverage is now judged as a percentile among all sections of the room that have
    artifacts (lowest quartile strong, lowest half moderate); rooms with fewer than 4 such
    sections, or --signal-method fixed, use the original cutoffs.
  - Each zone carries coverage_percentile, a second signal (how much of the section's own text
    uses the nearest framework's vocabulary), a source trail and a novelty-check status.
  - The bottleneck's differential_score / rank is carried through when present.
  - scikit-learn is no longer required; results are written atomically; room/Brain vectors of
    different dimension are reported instead of raising.
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import numpy as np
except ImportError:
    print(
        "RS whitespace discovery requires numpy. Run: pip install -r requirements-whitespace.txt",
        file=sys.stderr,
    )
    sys.exit(1)

SCHEMA_VERSION = "2.0"


def _unit(m):
    m = np.atleast_2d(np.asarray(m, dtype=float))
    n = np.linalg.norm(m, axis=1, keepdims=True)
    n[n < 1e-12] = 1.0
    return m / n


def cosine_similarity(a, b):
    return _unit(a) @ _unit(b).T


def knn_cosine(train, query, k):
    k = max(1, min(k, train.shape[0]))
    sims = cosine_similarity(query, train)
    idx = np.argsort(-sims, axis=1, kind="stable")[:, :k]
    return np.take_along_axis(sims, idx, axis=1), idx


# --- Embedding loading (reused from compute-whitespace-gaps.py) ---


def load_embeddings(room_dir):
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
    return data, np.array([e["vector"] for e in embeddings_list])


def load_baselines(room_dir):
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
    return data, np.array([b["vector"] for b in baselines_list])


def load_hsi_results(room_dir):
    hsi_path = Path(room_dir) / ".hsi-results.json"
    if not hsi_path.exists():
        return None
    try:
        return json.loads(hsi_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


# --- Core detection ---


def section_coverage_for(section_embs, brain_embs, k=3):
    """Mean over the k Brain frameworks nearest the section centroid of the best cosine any
    section artifact reaches for that framework. Returns (coverage, brain_idx, brain_sims)."""
    centroid = np.mean(section_embs, axis=0).reshape(1, -1)
    sims, idx = knn_cosine(brain_embs, centroid, k)
    section_brain_sims = cosine_similarity(section_embs, brain_embs[idx[0]])
    return float(np.mean(np.max(section_brain_sims, axis=0))), idx[0], sims[0]


def classify_fixed(coverage):
    if coverage < 0.3:
        return "strong"
    if coverage < 0.5:
        return "moderate"
    return "weak"


def classify_percentile(cov_pct):
    if cov_pct <= 0.25:
        return "strong"
    if cov_pct <= 0.5:
        return "moderate"
    return "weak"


_WORD = re.compile(r"(?u)\b\w\w+\b")


def _vocab_overlap(section_text, framework_text):
    f = set(_WORD.findall(framework_text.lower()))
    if not f:
        return None
    s = set(_WORD.findall(section_text.lower()))
    return len(f & s) / len(f)


def detect_rs_whitespace(room_dir, signal_method="percentile"):
    """Detect whitespace zones downstream of RS bottleneck sections.

    Args:
        room_dir: path to room directory
        signal_method: 'percentile' (default) or 'fixed'

    Returns:
        Result dict with metadata and zones
    """
    room_path = Path(room_dir)
    now_iso = datetime.now(timezone.utc).isoformat()

    hsi_data = load_hsi_results(room_path)
    if hsi_data is None:
        print("No .hsi-results.json found. Run compute-hsi.py and detect-reverse-salients.py first.",
              file=sys.stderr)
        return _empty_result("No .hsi-results.json found")

    reverse_salients = hsi_data.get("reverse_salients", [])
    if not reverse_salients:
        print("No reverse salients found in .hsi-results.json.", file=sys.stderr)
        return _empty_result("No reverse salients in .hsi-results.json")

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
    section_indices = {}
    for i, entry in enumerate(embeddings_list):
        section_indices.setdefault(entry.get("section", ""), []).append(i)

    baselines_list = bl_data.get("baselines", [])
    brain_names = [b.get("name", f"brain-{i}") for i, b in enumerate(baselines_list)]

    # Reference distribution: coverage of EVERY section that has artifacts
    ref_cov = {}
    for sec, idxs in section_indices.items():
        ref_cov[sec] = section_coverage_for(room_embs[idxs], brain_embs)[0]
    use_percentile = signal_method == "percentile" and len(ref_cov) >= 4
    ref_vals = np.array(sorted(ref_cov.values()))

    zones = []
    zone_counter = 0
    seen_sections = set()

    for rs in reverse_salients:
        target_section = rs.get("target_section", "")
        source_section = rs.get("source_section", "")
        if not target_section or target_section in seen_sections:
            continue
        seen_sections.add(target_section)

        target_indices = section_indices.get(target_section, [])
        if not target_indices:
            continue

        section_embs = room_embs[target_indices]
        section_coverage, brain_idx, brain_sims = section_coverage_for(section_embs, brain_embs)
        nearest_brain = [brain_names[int(i)] for i in brain_idx]

        if use_percentile:
            cov_pct = float((ref_vals <= section_coverage).mean())
            gap_signal = classify_percentile(cov_pct)
        else:
            cov_pct = None
            gap_signal = classify_fixed(section_coverage)

        # second signal: does the section's own text use the nearest framework's words?
        texts = []
        for i in target_indices:
            e = embeddings_list[i]
            body = ""
            if e.get("path"):
                try:
                    body = (room_path / e["path"]).read_text(encoding="utf-8")
                except (OSError, UnicodeDecodeError):
                    body = ""
            texts.append(str(e.get("title", "")) + " " + body)
        overlap = _vocab_overlap(" ".join(texts), " ".join(nearest_brain[:1]))
        second = {
            "method": "framework_vocabulary_in_section_text",
            "overlap": None if overlap is None else round(float(overlap), 4),
            "confirmed": None if overlap is None else bool(overlap < 0.5),
        }

        zone_counter += 1
        zones.append({
            "zone_id": f"RS-WS-{zone_counter:03d}",
            "bottleneck": {
                "opportunity_id": rs.get("opportunity_id", ""),
                "source_section": source_section,
                "target_section": target_section,
            },
            "downstream_section": target_section,
            "nearest_brain_frameworks": nearest_brain,
            "section_coverage": round(section_coverage, 4),
            "gap_signal": gap_signal,
            "hypothesis": (
                f"Bottleneck in [{source_section}] blocks insight into "
                f"{nearest_brain[0] if nearest_brain else 'unknown'} "
                f"for [{target_section}]"
            ),
            # additive 2026 keys
            "coverage_percentile": None if cov_pct is None else round(cov_pct, 4),
            "signal_method": "percentile_among_sections" if use_percentile else "fixed_cutoffs",
            "bottleneck_score": rs.get("differential_score", rs.get("score")),
            "second_signal": second,
            "novelty_check": {"status": "in_room_check_only", "external_literature": "not_run"},
            "source_trail": [
                {"source": "hsi-results.reverse_salients", "source_id": rs.get("opportunity_id", ""),
                 "retrieved_at": now_iso},
            ] + [
                {"source": "whitespace-embeddings.json", "artifact_id": embeddings_list[i].get("id"),
                 "path": embeddings_list[i].get("path"), "retrieved_at": now_iso}
                for i in target_indices[:3]
            ] + [
                {"source": "brain-baseline.json", "source_id": nm,
                 "retrieved_at": (bl_data.get("metadata", {}) or {}).get("timestamp", now_iso)}
                for nm in nearest_brain[:1]
            ],
        })

    signal_order = {"strong": 0, "moderate": 1, "weak": 2}
    zones.sort(key=lambda z: (signal_order.get(z["gap_signal"], 3), z["section_coverage"], z["zone_id"]))

    return {
        "metadata": {
            "timestamp": now_iso,
            "bottlenecks_checked": len(reverse_salients),
            "zones_found": len(zones),
            "schema_version": SCHEMA_VERSION,
            "provenance": {
                "script": "discover-rs-whitespace.py",
                "computed_at": now_iso,
                "signal_method": "percentile" if use_percentile else "fixed",
                "sections_in_reference": len(ref_cov),
                "versions": {"python": sys.version.split()[0], "numpy": np.__version__},
            },
        },
        "zones": zones,
    }


def _empty_result(note=""):
    return {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "bottlenecks_checked": 0,
            "zones_found": 0,
            "note": note,
            "schema_version": SCHEMA_VERSION,
        },
        "zones": [],
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description="Detect whitespace zones downstream of RS bottleneck sections")
    parser.add_argument("room_dir", help="Path to room directory")
    parser.add_argument(
        "--output",
        default=None,
        help="Output JSON path (default: {room_dir}/.mindrian/discovery-rs-whitespace.json)",
    )
    parser.add_argument("--signal-method", choices=["percentile", "fixed"], default="percentile",
                        help="percentile (default): coverage judged among the room's sections; "
                             "fixed: original 0.3 / 0.5 cutoffs")

    args = parser.parse_args(argv)
    room_dir = Path(args.room_dir).resolve()

    if not room_dir.is_dir():
        print(f"Error: {room_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    result = detect_rs_whitespace(room_dir, signal_method=args.signal_method)

    output_path = Path(args.output).resolve() if args.output else room_dir / ".mindrian" / "discovery-rs-whitespace.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = output_path.with_name(output_path.name + ".tmp-%d" % os.getpid())
    tmp.write_text(json.dumps(result, indent=2), encoding="utf-8")
    os.replace(str(tmp), str(output_path))

    zones = result.get("zones", [])
    n_strong = sum(1 for z in zones if z["gap_signal"] == "strong")
    n_moderate = sum(1 for z in zones if z["gap_signal"] == "moderate")

    print(
        f"RS Whitespace: {len(zones)} zones found "
        f"({n_strong} strong, {n_moderate} moderate) "
        f"from {result['metadata']['bottlenecks_checked']} bottlenecks",
        file=sys.stderr,
    )
    print(f"  Output: {output_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
