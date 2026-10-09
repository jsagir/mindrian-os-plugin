#!/usr/bin/env python3
"""
detect-reverse-salients.py -- Cross-Section Reverse Salient Detection
=====================================================================
Ported from V2 detect_reverse_salients.py (287 lines).
Reads .hsi-results.json and identifies cross-section innovation opportunities
where a solution in one section addresses a problem in another.

v1.6.0 "Powerhouse" upgrade: Leverages spectral OM-HMM metadata from
compute-hsi.py. Pairs where both artifacts have high spectral gaps (fast
Markov mixing across thinking modes) receive a spectral bonus to their
breakthrough potential -- artifacts written with genuinely integrative
thinking are more likely to produce real cross-domain breakthroughs.

Usage:
    python3 scripts/detect-reverse-salients.py /path/to/room [--threshold 0.30] [--top-n 20]
        [--scoring hybrid|legacy] [--min-percentile 0.0] [--direction-convention B|A]

2026 changes (all additive; see rs/CHANGES-engine.md):
  - --scoring legacy reproduces the original selection exactly (fixed
    threshold 0.30 and min_similarity 0.20 on both similarities).
  - --scoring hybrid (default) drops the two fixed floors. The 0.20 floor on
    BOTH similarities rejected exactly the "same words, different meaning"
    pairs this tool exists to find (their semantic similarity is low by
    definition); feasibility is already priced into breakthrough_potential
    via min(lsa, semantic). Candidates are instead ranked by percentile and
    z-score of their differential within the supplied pair pool, and gated by
    --min-percentile (default 0.0, i.e. no gate).
  - Each opportunity carries a `verification` block: source trail, a
    second-signal check, and a novelty status.
  - LIMITATION: .hsi-results.json holds only the top 20 pairs that
    compute-hsi.py kept above its own threshold, so percentiles here are
    percentiles of that survivor pool, NOT of the room corpus. Use
    scripts/rs-engine.py for corpus-level percentile ranking.
  - Direction convention: the default ("B") is the original and matches
    compute-hsi.py (lsa > semantic = structural_transfer). rs-engine.py uses
    the opposite sign (semantic - lsa > 0 = structural_transfer, "A"). The two
    tools therefore label the same situation differently. Pass
    --direction-convention A to align this tool with rs-engine.py.

Pipeline: Load HSI results -> Group by section -> Cross-section analysis
          -> Classify -> Score (with spectral bonus) -> Generate thesis
          -> Verify -> Update JSON
"""

# Offline reference only since Phase 355 D-52; no live caller. It writes the
# retired Convention B direction; do not reintroduce it on a live path.
import argparse
import json
import math
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

SCHEMA_VERSION = "2026.1"
REQUIRED_PAIR_KEYS = ('left_id', 'right_id', 'hsi_score', 'lsa_sim', 'semantic_sim')
INTEGRATIVE_WARN_GAP = 0.15  # |lsa - semantic| below this is a weak raw gap

_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+|\n+")
_PROBLEM = re.compile(r"\b(problem|challenge|limitation|bottleneck|fails?|lack|cannot|unable|difficult|gap|barrier|constraint|risk|need)\b", re.I)
_METHOD = re.compile(r"\b(propose|approach|method|technique|algorithm|framework|model|using|design|protocol|solution|mechanism|process)\b", re.I)
_WORD = re.compile(r"[^\W_]{3,}", re.UNICODE)


def classify_opportunity(lsa_sim, semantic_sim, convention='B'):
    """Classify innovation type based on which similarity dominates.

    Ported from V2 classify_opportunity.
    Convention B (default, original, matches compute-hsi.py):
    - LSA > semantic = structural_transfer: same methods, different applications
    - semantic > LSA = semantic_implementation: same concepts, different tools
    Convention A (matches rs-engine.py) swaps the two labels.
    """
    structural = lsa_sim > semantic_sim
    if convention == 'A':
        structural = not structural and semantic_sim > lsa_sim
    if structural:
        return 'structural_transfer'
    return 'semantic_implementation'


def score_breakthrough_potential(differential, lsa_sim, semantic_sim, spectral_gap_avg=0.0):
    """Score breakthrough potential of a reverse salient.

    v1.6.0: Added spectral bonus. Pairs where both artifacts exhibit fast
    Markov chain mixing (high spectral gap) get up to 15% bonus. This
    rewards connections between artifacts written with genuinely diverse
    thinking modes, not just keyword-stuffed text.

    breakthrough = (novelty * 0.60) + (feasibility * 0.25) + (spectral * 0.15)
    Where novelty = differential, feasibility = min(lsa, semantic),
    spectral = average spectral gap of both artifacts (clamped to 0..1).
    """
    novelty = differential
    feasibility = min(lsa_sim, semantic_sim)
    spectral = min(1.0, max(0.0, spectral_gap_avg or 0.0))
    return (novelty * 0.60) + (feasibility * 0.25) + (spectral * 0.15)


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


# ---------------------------------------------------------------------------
# Validation and statistics helpers (2026)
# ---------------------------------------------------------------------------

def _num(value, default=None):
    """Finite float or default (rejects None, NaN, inf, non-numeric)."""
    try:
        f = float(value)
    except (TypeError, ValueError):
        return default
    return f if math.isfinite(f) else default


def _valid_pairs(hsi_pairs):
    """Yield (pair, skipped_reasons) for pairs with all required finite keys."""
    good, skipped = [], 0
    for pair in hsi_pairs:
        if not isinstance(pair, dict) or any(k not in pair for k in REQUIRED_PAIR_KEYS):
            skipped += 1
            continue
        if any(_num(pair[k]) is None for k in ('hsi_score', 'lsa_sim', 'semantic_sim')):
            skipped += 1
            continue
        good.append(pair)
    return good, skipped


def _percentile_ranks(values):
    """Empirical percentile (0..1, average rank for ties) for each value."""
    n = len(values)
    if n == 0:
        return []
    if n == 1:
        return [1.0]
    order = sorted(range(n), key=lambda i: values[i])
    ranks = [0.0] * n
    i = 0
    while i < n:
        j = i
        while j + 1 < n and values[order[j + 1]] == values[order[i]]:
            j += 1
        avg = (i + j) / 2.0
        for k in range(i, j + 1):
            ranks[order[k]] = avg / (n - 1)
        i = j + 1
    return ranks


def _zscores(values):
    n = len(values)
    if n < 2:
        return [0.0] * n
    mean = sum(values) / n
    var = sum((v - mean) ** 2 for v in values) / n
    sd = math.sqrt(var)
    if sd < 1e-12:
        return [0.0] * n
    return [(v - mean) / sd for v in values]


def _sentences(text, limit=40):
    out = []
    for raw in _SENT_SPLIT.split(text or ""):
        s = re.sub(r"^[#>\-\*\s\d\.\)]+", "", raw.strip())
        if 25 <= len(s) <= 400:
            out.append(s)
        if len(out) >= limit:
            break
    return out


def _read_artifact_text(room_dir, art):
    """Read artifact text for claim evidence. Path must resolve inside room_dir."""
    if not room_dir:
        return art.get('text') or ''
    if art.get('text'):
        return art['text']
    rel = art.get('path')
    if not rel:
        return ''
    try:
        base = Path(room_dir).resolve()
        full = (base / rel).resolve()
        full.relative_to(base)  # raises ValueError on traversal
        return full.read_text(encoding='utf-8-sig')[:20000]
    except (OSError, ValueError, UnicodeDecodeError):
        return ''


def _lexical_claim(text_a, text_b):
    """Best problem-vs-method sentence match by token-set Jaccard. Lexical only:
    this script has no embedder, and says so in the output."""
    sa, sb = _sentences(text_a), _sentences(text_b)
    if not sa or not sb:
        return None
    ta = [set(_WORD.findall(s.lower())) for s in sa]
    tb = [set(_WORD.findall(s.lower())) for s in sb]
    best = None
    for side, A, B, sA, sB, pa, mb in (
        ('source', ta, tb, sa, sb, _PROBLEM, _METHOD),
        ('target', tb, ta, sb, sa, _PROBLEM, _METHOD),
    ):
        for i, s1 in enumerate(sA):
            if not pa.search(s1):
                continue
            for j, s2 in enumerate(sB):
                if not mb.search(s2):
                    continue
                u = len(A[i] | B[j])
                score = (len(A[i] & B[j]) / u) if u else 0.0
                if best is None or score > best[0]:
                    best = (score, side, s1, s2)
    if best is None:
        return None
    score, side, prob, meth = best
    return {'level': 'claim-lexical', 'problem_side': side, 'problem_sentence': prob,
            'method_side': 'target' if side == 'source' else 'source',
            'method_sentence': meth, 'jaccard': round(score, 4),
            'note': 'lexical overlap only; no embedder available in this script'}


def _verification(best_pair, source_art, target_art, art_meta, hsi_meta, room_dir,
                  prior_keys, run_date):
    lsa = _num(best_pair['lsa_sim'], 0.0)
    sem = _num(best_pair['semantic_sim'], 0.0)
    gap = abs(lsa - sem)
    if gap >= INTEGRATIVE_WARN_GAP:
        status = 'confirmed'
        detail = 'raw |lsa - semantic| gap is material'
    else:
        status = 'weak_gap_driven_by_integrative_factor'
        detail = ('hsi_score = 0.6*|lsa - semantic| + 0.4*integrative_factor in compute-hsi.py; '
                  'the raw gap is small, so this pair may qualify through writing style (OM-HMM) alone')
    text_s = _read_artifact_text(room_dir, art_meta.get(source_art, {}))
    text_t = _read_artifact_text(room_dir, art_meta.get(target_art, {}))
    claim = _lexical_claim(text_s, text_t) if (text_s and text_t) else None

    def trail(aid, side):
        meta = art_meta.get(aid, {})
        stamp = meta.get('retrieved_at') or meta.get('mtime') or hsi_meta.get('generated_at')
        sent = None
        if claim:
            if claim['problem_side'] == side:
                sent = claim['problem_sentence']
            else:
                sent = claim['method_sentence']
        return {
            'side': side, 'source_id': aid,
            'url': meta.get('url') or meta.get('path') or '',
            'title': meta.get('title'),
            'retrieval_date': str(stamp)[:10] if stamp else run_date,
            'retrieval_date_source': 'recorded' if stamp else 'run_time',
            'extracted_sentence': sent,
        }

    key = '||'.join(sorted([str(source_art), str(target_art)]))
    if key in prior_keys:
        nov = ('previously_reported', 'pair already present in the reverse_salients of this file')
    else:
        nov = ('unchecked_external', 'web/literature novelty check not run (offline script)')
    return {
        'source_trail': [trail(source_art, 'source'), trail(target_art, 'target')],
        'claim_evidence': claim,
        'second_signal': {'status': status, 'raw_gap': round(gap, 4), 'detail': detail,
                          'min_gap': INTEGRATIVE_WARN_GAP},
        'novelty': {'status': nov[0], 'note': nov[1], 'checked_against': ['prior reverse_salients in this file']},
        'judge': 'none (deterministic code)',
    }


def detect_reverse_salients(hsi_data, threshold=0.30, min_similarity=0.20, top_n=20,
                            scoring='legacy', min_percentile=0.0, convention='B',
                            room_dir=None, verify=True, _stats=None):
    """Full cross-section reverse salient detection pipeline.

    Groups artifacts by section, finds highest HSI score between
    cross-section artifact pairs, classifies and scores each.

    Library default scoring='legacy' keeps the original behaviour for callers
    that import this function; the CLI default is 'hybrid'.
    """
    artifacts = hsi_data.get('artifacts', []) if isinstance(hsi_data, dict) else []
    raw_pairs = hsi_data.get('hsi_pairs', []) if isinstance(hsi_data, dict) else []
    top_n = int(top_n)

    if not artifacts or not raw_pairs or top_n <= 0:
        return []
    hsi_pairs, skipped = _valid_pairs(raw_pairs)
    if _stats is not None:
        _stats['skipped_pairs'] = skipped
        _stats['pool_size'] = len(hsi_pairs)
    if not hsi_pairs:
        return []

    # Build artifact section lookup (tolerate artifacts without id/section)
    artifact_sections = {}
    art_meta = {}
    for art in artifacts:
        if isinstance(art, dict) and 'id' in art and 'section' in art:
            artifact_sections[art['id']] = art['section']
            art_meta[art['id']] = art

    # Group artifacts by section
    sections = defaultdict(list)
    for aid, sec in artifact_sections.items():
        sections[sec].append(aid)

    # Build pair lookup for fast access
    pair_lookup = {}
    for pair in hsi_pairs:
        pair_lookup[(pair['left_id'], pair['right_id'])] = pair
        pair_lookup[(pair['right_id'], pair['left_id'])] = pair

    # Pool statistics over distinct cross-section pairs (hybrid annotation)
    pool = []
    seen = set()
    for pair in hsi_pairs:
        k = frozenset((pair['left_id'], pair['right_id']))
        if k in seen:
            continue
        seen.add(k)
        if artifact_sections.get(pair['left_id']) != artifact_sections.get(pair['right_id']):
            pool.append(pair)
    pool_scores = [_num(p['hsi_score'], 0.0) for p in pool]
    pool_pct = dict(zip((id(p) for p in pool), _percentile_ranks(pool_scores)))
    pool_z = dict(zip((id(p) for p in pool), _zscores(pool_scores)))
    small_pool = len(pool) < 10

    prior_keys = set()
    for prev in hsi_data.get('reverse_salients', []) or []:
        if isinstance(prev, dict) and prev.get('source_artifact') and prev.get('target_artifact'):
            prior_keys.add('||'.join(sorted([str(prev['source_artifact']), str(prev['target_artifact'])])))
    hsi_meta = {k: hsi_data.get(k) for k in ('generated_at',) if isinstance(hsi_data, dict)}
    run_date = datetime.now(timezone.utc).date().isoformat()

    # Find cross-section reverse salients
    section_names = sorted(sections.keys())
    candidates = []
    rs_counter = 0

    for si in range(len(section_names)):
        for sj in range(si + 1, len(section_names)):
            sec_a = section_names[si]
            sec_b = section_names[sj]

            # Find best HSI pair between sections (deterministic tie-break by ids)
            best_pair = None
            best_score = -1.0

            for aid_a in sections[sec_a]:
                for aid_b in sections[sec_b]:
                    pair = pair_lookup.get((aid_a, aid_b))
                    if not pair:
                        continue
                    score = _num(pair['hsi_score'], 0.0)
                    # '>' keeps the first of equal scores (input order), as before;
                    # a zero score is now eligible (was silently dropped by the 0.0 seed).
                    if score > best_score:
                        best_score = score
                        best_pair = pair

            if not best_pair:
                continue
            lsa_sim = _num(best_pair['lsa_sim'], 0.0)
            sem_sim = _num(best_pair['semantic_sim'], 0.0)
            pct = pool_pct.get(id(best_pair), 1.0)
            if scoring == 'legacy':
                if best_score < threshold:
                    continue
                if lsa_sim < min_similarity or sem_sim < min_similarity:
                    continue
            else:
                # hybrid: no fixed floors unless the caller passed an explicit
                # threshold; the percentile gate is the selection rule.
                if threshold and best_score < threshold:
                    continue
                if not small_pool and pct < min_percentile:
                    continue

            rs_counter += 1
            innovation_type = classify_opportunity(lsa_sim, sem_sim, convention)

            differential = best_score

            # v1.6.0: Use spectral gap from HSI pair metadata if available
            spectral_gap_avg = _num(best_pair.get('spectral_gap_avg'), 0.0)

            breakthrough = score_breakthrough_potential(
                differential, lsa_sim, sem_sim,
                spectral_gap_avg=spectral_gap_avg
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
                lsa_sim, sem_sim, differential
            )

            cand = {
                'opportunity_id': f'RS-{rs_counter:04d}',
                'source_section': source_sec,
                'target_section': target_sec,
                'source_artifact': source_art,
                'target_artifact': target_art,
                'innovation_type': innovation_type,
                'differential_score': round(differential, 4),
                'breakthrough_potential': round(breakthrough, 4),
                'spectral_gap_avg': round(spectral_gap_avg, 4),
                'left_dominant_mode': best_pair.get('left_dominant_mode', 'unknown'),
                'right_dominant_mode': best_pair.get('right_dominant_mode', 'unknown'),
                'innovation_thesis': thesis,
                # --- additive 2026 keys ---
                'scoring': scoring,
                'direction_convention': convention,
                'differential_percentile': round(pct, 4),
                'differential_z': round(pool_z.get(id(best_pair), 0.0), 4),
                'pool_size': len(pool),
                'pool_is_corpus': False,
            }
            if verify:
                cand['verification'] = _verification(
                    best_pair, source_art, target_art, art_meta, hsi_meta,
                    room_dir, prior_keys, run_date)
            candidates.append(cand)

    # Sort by breakthrough potential descending; ties broken by differential
    # then artifact ids so the order is deterministic across runs.
    candidates.sort(key=lambda x: (-x['breakthrough_potential'], -x['differential_score'],
                                   str(x['source_artifact']), str(x['target_artifact'])))
    if _stats is not None:
        _stats['small_pool'] = small_pool
    return candidates[:top_n]


def _write_json_atomic(path, payload):
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding='utf-8')
    os.replace(str(tmp), str(path))


def main():
    parser = argparse.ArgumentParser(
        description='Detect reverse salients from HSI results'
    )
    parser.add_argument('room_dir', help='Path to room directory')
    parser.add_argument('--threshold', type=float, default=None,
                        help='Minimum HSI score threshold. Legacy default 0.30; '
                             'hybrid applies it only if given explicitly')
    parser.add_argument('--top-n', type=int, default=20,
                        help='Number of top opportunities (default: 20)')
    parser.add_argument('--scoring', choices=['hybrid', 'legacy'], default='hybrid',
                        help='hybrid (default): percentile/z annotation, no fixed '
                             'similarity floors. legacy: original fixed thresholds')
    parser.add_argument('--min-percentile', type=float, default=0.0,
                        help='Hybrid only: drop candidates below this percentile of '
                             'the supplied pair pool (0-1 or 0-100, default 0 = off; '
                             'ignored when the pool has < 10 pairs)')
    parser.add_argument('--direction-convention', choices=['B', 'A'], default='B',
                        help='B (default, original): lsa > semantic = structural_transfer. '
                             'A: matches rs-engine.py (semantic > lsa = structural_transfer)')
    parser.add_argument('--no-verify', action='store_true',
                        help='Skip the per-opportunity verification block')

    args = parser.parse_args()
    room_dir = Path(args.room_dir).resolve()
    if args.top_n < 1:
        print('Error: --top-n must be >= 1', file=sys.stderr)
        sys.exit(2)
    min_pct = args.min_percentile / 100.0 if args.min_percentile > 1.0 else args.min_percentile
    if not 0.0 <= min_pct <= 1.0:
        print('Error: --min-percentile must be within 0-1 (or 0-100)', file=sys.stderr)
        sys.exit(2)

    results_path = room_dir / '.hsi-results.json'
    if not results_path.exists():
        print(f"Error: {results_path} not found. Run compute-hsi.py first.",
              file=sys.stderr)
        sys.exit(1)

    try:
        hsi_data = json.loads(results_path.read_text(encoding='utf-8-sig'))
    except (json.JSONDecodeError, OSError, UnicodeDecodeError) as e:
        print(f"Error reading .hsi-results.json: {e}", file=sys.stderr)
        sys.exit(1)
    if not isinstance(hsi_data, dict):
        print("Error: .hsi-results.json must contain a JSON object", file=sys.stderr)
        sys.exit(1)

    threshold = args.threshold
    if threshold is None:
        threshold = 0.30 if args.scoring == 'legacy' else 0.0

    stats = {}
    # Detect reverse salients
    reverse_salients = detect_reverse_salients(
        hsi_data,
        threshold=threshold,
        top_n=args.top_n,
        scoring=args.scoring,
        min_percentile=min_pct,
        convention=args.direction_convention,
        room_dir=room_dir,
        verify=not args.no_verify,
        _stats=stats,
    )

    # Update .hsi-results.json with reverse_salients (additive keys only)
    hsi_data['reverse_salients'] = reverse_salients
    hsi_data['reverse_salients_provenance'] = {
        'schema_version': SCHEMA_VERSION,
        'computed_at': datetime.now(timezone.utc).isoformat(),
        'script': 'detect-reverse-salients.py',
        'scoring': args.scoring,
        'threshold': threshold,
        'min_percentile': min_pct,
        'direction_convention': args.direction_convention,
        'pool_size': stats.get('pool_size', 0),
        'skipped_invalid_pairs': stats.get('skipped_pairs', 0),
        'pool_is_corpus': False,
        'pool_note': 'percentiles are over the supplied hsi_pairs (compute-hsi keeps its top 20), not the room corpus',
        'ranking': 'deterministic code; no LLM involved',
    }
    _write_json_atomic(results_path, hsi_data)

    if stats.get('skipped_pairs'):
        print(f"RS: skipped {stats['skipped_pairs']} malformed hsi_pairs entries", file=sys.stderr)
    if stats.get('small_pool') and args.scoring == 'hybrid' and min_pct > 0:
        print("RS: pair pool has < 10 pairs; percentile gate not applied", file=sys.stderr)

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
