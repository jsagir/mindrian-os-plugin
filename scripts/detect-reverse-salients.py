#!/usr/bin/env python3
"""
detect-reverse-salients.py -- Cross-Section Reverse Salient Detection
=====================================================================
Ported from V2 detect_reverse_salients.py (287 lines).
Reads .hsi-results.json and identifies cross-section innovation opportunities
where a solution in one section addresses a problem in another.

Usage:
    python3 scripts/detect-reverse-salients.py /path/to/room [--threshold 0.30] [--top-n 20]

Pipeline: Load HSI results -> Group by section -> Cross-section analysis
          -> Classify -> Score -> Generate thesis -> Update JSON
"""

import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


def classify_opportunity(lsa_sim, semantic_sim):
    """Classify innovation type based on which similarity dominates.

    Ported from V2 classify_opportunity.
    - LSA > semantic = structural_transfer: same methods, different applications
    - semantic > LSA = semantic_implementation: same concepts, different tools
    """
    if lsa_sim > semantic_sim:
        return 'structural_transfer'
    return 'semantic_implementation'


def score_breakthrough_potential(differential, lsa_sim, semantic_sim):
    """Score breakthrough potential of a reverse salient.

    Ported from V2 score_breakthrough_potential.
    breakthrough = (novelty * 0.7) + (feasibility * 0.3)
    Where novelty = differential, feasibility = min(lsa, semantic)
    """
    novelty = differential
    feasibility = min(lsa_sim, semantic_sim)
    return (novelty * 0.7) + (feasibility * 0.3)


def generate_innovation_thesis(innovation_type, source_artifact, target_artifact,
                                lsa_sim, semantic_sim, differential):
    """Generate innovation thesis string from V2 template."""
    if innovation_type == 'structural_transfer':
        return (
            f"Methods shared between '{source_artifact}' and '{target_artifact}' "
            f"(structural sim: {lsa_sim:.2f}) could transfer to new applications "
            f"(semantic gap: {differential:.2f}). These sections use similar "
            f"techniques for different purposes."
        )
    return (
        f"Concepts shared between '{source_artifact}' and '{target_artifact}' "
        f"(semantic sim: {semantic_sim:.2f}) need new implementation approaches "
        f"(structural gap: {differential:.2f}). These sections think about "
        f"similar problems with different tools."
    )


def detect_reverse_salients(hsi_data, threshold=0.30, min_similarity=0.20, top_n=20):
    """Full cross-section reverse salient detection pipeline.

    Groups artifacts by section, finds highest HSI score between
    cross-section artifact pairs, classifies and scores each.
    """
    artifacts = hsi_data.get('artifacts', [])
    hsi_pairs = hsi_data.get('hsi_pairs', [])

    if not artifacts or not hsi_pairs:
        return []

    # Build artifact section lookup
    artifact_sections = {}
    for art in artifacts:
        artifact_sections[art['id']] = art['section']

    # Group artifacts by section
    sections = defaultdict(list)
    for art in artifacts:
        sections[art['section']].append(art['id'])

    # Build pair lookup for fast access
    pair_lookup = {}
    for pair in hsi_pairs:
        key = (pair['left_id'], pair['right_id'])
        pair_lookup[key] = pair
        pair_lookup[(pair['right_id'], pair['left_id'])] = pair

    # Find cross-section reverse salients
    section_names = sorted(sections.keys())
    candidates = []
    rs_counter = 0

    for si in range(len(section_names)):
        for sj in range(si + 1, len(section_names)):
            sec_a = section_names[si]
            sec_b = section_names[sj]

            # Find best HSI pair between sections
            best_pair = None
            best_score = 0.0

            for aid_a in sections[sec_a]:
                for aid_b in sections[sec_b]:
                    key = (aid_a, aid_b)
                    pair = pair_lookup.get(key)
                    if not pair:
                        continue
                    if pair['hsi_score'] > best_score:
                        best_score = pair['hsi_score']
                        best_pair = pair

            if not best_pair:
                continue
            if best_score < threshold:
                continue
            if best_pair['lsa_sim'] < min_similarity or best_pair['semantic_sim'] < min_similarity:
                continue

            rs_counter += 1
            innovation_type = classify_opportunity(
                best_pair['lsa_sim'], best_pair['semantic_sim']
            )
            differential = best_pair['hsi_score']
            breakthrough = score_breakthrough_potential(
                differential, best_pair['lsa_sim'], best_pair['semantic_sim']
            )

            # Determine source/target based on type
            if innovation_type == 'structural_transfer':
                source_art = best_pair['left_id']
                target_art = best_pair['right_id']
                source_sec = artifact_sections.get(source_art, sec_a)
                target_sec = artifact_sections.get(target_art, sec_b)
            else:
                source_art = best_pair['right_id']
                target_art = best_pair['left_id']
                source_sec = artifact_sections.get(source_art, sec_b)
                target_sec = artifact_sections.get(target_art, sec_a)

            thesis = generate_innovation_thesis(
                innovation_type, source_art, target_art,
                best_pair['lsa_sim'], best_pair['semantic_sim'], differential
            )

            candidates.append({
                'opportunity_id': f'RS-{rs_counter:04d}',
                'source_section': source_sec,
                'target_section': target_sec,
                'source_artifact': source_art,
                'target_artifact': target_art,
                'innovation_type': innovation_type,
                'differential_score': round(differential, 4),
                'breakthrough_potential': round(breakthrough, 4),
                'innovation_thesis': thesis,
            })

    # Sort by breakthrough potential descending
    candidates.sort(key=lambda x: x['breakthrough_potential'], reverse=True)
    return candidates[:top_n]


def main():
    parser = argparse.ArgumentParser(
        description='Detect reverse salients from HSI results'
    )
    parser.add_argument('room_dir', help='Path to room directory')
    parser.add_argument('--threshold', type=float, default=0.30,
                        help='Minimum HSI score threshold (default: 0.30)')
    parser.add_argument('--top-n', type=int, default=20,
                        help='Number of top opportunities (default: 20)')

    args = parser.parse_args()
    room_dir = Path(args.room_dir).resolve()

    results_path = room_dir / '.hsi-results.json'
    if not results_path.exists():
        print(f"Error: {results_path} not found. Run compute-hsi.py first.",
              file=sys.stderr)
        sys.exit(1)

    try:
        hsi_data = json.loads(results_path.read_text(encoding='utf-8'))
    except (json.JSONDecodeError, OSError) as e:
        print(f"Error reading .hsi-results.json: {e}", file=sys.stderr)
        sys.exit(1)

    # Detect reverse salients
    reverse_salients = detect_reverse_salients(
        hsi_data,
        threshold=args.threshold,
        top_n=args.top_n,
    )

    # Update .hsi-results.json with reverse_salients
    hsi_data['reverse_salients'] = reverse_salients
    results_path.write_text(
        json.dumps(hsi_data, indent=2, ensure_ascii=False),
        encoding='utf-8'
    )

    # Summary to stderr
    n_structural = sum(1 for r in reverse_salients if r['innovation_type'] == 'structural_transfer')
    n_semantic = sum(1 for r in reverse_salients if r['innovation_type'] == 'semantic_implementation')
    top_bp = reverse_salients[0]['breakthrough_potential'] if reverse_salients else 0.0

    print(
        f"RS: {len(reverse_salients)} reverse salients found "
        f"({n_structural} structural, {n_semantic} semantic), "
        f"top breakthrough: {top_bp:.3f}",
        file=sys.stderr
    )


if __name__ == '__main__':
    main()
