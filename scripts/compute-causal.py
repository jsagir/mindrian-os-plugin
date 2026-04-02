#!/usr/bin/env python3
"""
compute-causal.py -- Causal Claim Extraction Pipeline
=====================================================
Reads room/*.md artifacts, extracts cause-effect claims using heuristic
pattern detection + causalgraph modeling, outputs .causal-results.json
with scored causal chains and cascade predictions.

v1.7.0: Initial causal reasoning layer. Sits alongside HSI pipeline.
Brain provides DIRECTIVES (how to reason causally). KuzuDB stores EDGES
(actual causal claims from this user's room).

Architecture:
    - Heuristic extraction: regex patterns for causal language
    - causalgraph (optional): NetworkX-based causal graph modeling
    - Cascade detection: if assumption X fails, what else breaks?
    - Novelty scoring: how far from consensus is this causal claim?

Usage:
    python3 scripts/compute-causal.py /path/to/room [--threshold 0.3] [--output path]

Dependencies:
    Required: numpy (already in requirements-hsi.txt)
    Optional: causalgraph (pip install causalgraph) -- enhances graph modeling
    Optional: networkx (pip install networkx) -- fallback if no causalgraph

Output: {room_dir}/.causal-results.json
"""

import argparse
import hashlib
import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


# --- Causal Signal Detection Patterns ---
# These detect causal language in room artifacts.
# Inspired by GoPeaks text2causalgraph trigger patterns,
# adapted for venture/innovation domain language.

CAUSAL_TRIGGERS = {
    # Direct causation
    'causes': re.compile(
        r'\b(causes?|caused by|leads? to|results? in|produces?|generates?|creates?|triggers?|drives?)\b',
        re.I
    ),
    # Enablement
    'enables': re.compile(
        r'\b(enables?|allows?|permits?|makes? possible|unlocks?|unblocks?|facilitates?)\b',
        re.I
    ),
    # Prevention / blocking
    'prevents': re.compile(
        r'\b(prevents?|blocks?|inhibits?|stops?|hinders?|constrains?|limits?|bottleneck)\b',
        re.I
    ),
    # Conditional causation
    'conditional': re.compile(
        r'\b(if\b.+then\b|when\b.+then\b|assuming\b.+then\b|provided\b.+then\b|unless\b)',
        re.I
    ),
    # Consequence / implication
    'consequence': re.compile(
        r'\b(therefore|consequently|as a result|hence|thus|implies?|means? that|so that)\b',
        re.I
    ),
    # Failure mode language (materials / engineering)
    'failure': re.compile(
        r'\b(fails?|failure|breaks?|degrades?|corrodes?|fractures?|delaminat|spall|crack|fatigue|creep|oxidiz)\w*\b',
        re.I
    ),
    # Economic causation
    'economic': re.compile(
        r'\b(increases? cost|reduces? revenue|drives? margin|affects? pricing|impacts? unit economics|switching cost|downtime cost)\b',
        re.I
    ),
    # Assumption language (key for cascade detection)
    'assumption': re.compile(
        r'\b(assum|hypothes|belie|expect|predict|estimat|project|forecast)\w*\b',
        re.I
    ),
    # Mechanism language (the HOW)
    'mechanism': re.compile(
        r'\b(because|due to|owing to|through|via|by means of|mechanism|process|pathway)\b',
        re.I
    ),
}

# Skip files/dirs (same as HSI pipeline)
SKIP_FILES = {"STATE.md", "ROOM.md", "MINTO.md", "REASONING.md"}
SKIP_DIRS = {".lazygraph", ".git", "node_modules", ".hsi-cache.json", ".reasoning"}


def parse_frontmatter(content):
    """Extract frontmatter fields using regex (no PyYAML dependency)."""
    fm_match = re.match(r'^---\n([\s\S]*?)\n---', content)
    if not fm_match:
        return {}
    fm_text = fm_match.group(1)
    fields = {}
    for line in fm_text.split('\n'):
        if ':' in line:
            key, _, val = line.partition(':')
            fields[key.strip()] = val.strip().strip('"').strip("'")
    return fields


def extract_title(content, filepath):
    """Extract title from first # heading."""
    match = re.search(r'^# (.+)$', content, re.MULTILINE)
    if match:
        return match.group(1).strip()
    return Path(filepath).stem.replace('-', ' ').title()


def extract_body(content):
    """Extract body text after frontmatter --- block."""
    fm_match = re.match(r'^---\n[\s\S]*?\n---\n?', content)
    if fm_match:
        return content[fm_match.end():]
    return content


def discover_artifacts(room_dir):
    """Walk room_dir for .md files, build artifact list."""
    artifacts = []
    room_path = Path(room_dir).resolve()

    for root, dirs, files in os.walk(room_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

        rel_root = Path(root).relative_to(room_path)
        if str(rel_root) == '.':
            continue

        section = str(rel_root).split(os.sep)[0]

        for fname in sorted(files):
            if not fname.endswith('.md'):
                continue
            if fname in SKIP_FILES:
                continue

            fpath = Path(root) / fname
            try:
                content = fpath.read_text(encoding='utf-8')
            except (OSError, UnicodeDecodeError):
                continue

            artifact_id = str(Path(rel_root) / Path(fname).stem).replace(os.sep, '/')
            title = extract_title(content, fpath)
            body = extract_body(content)
            frontmatter = parse_frontmatter(content)

            if len(body.strip()) < 50:
                continue

            artifacts.append({
                'id': artifact_id,
                'section': section,
                'title': title,
                'path': str(fpath.relative_to(room_path)),
                'text': body.strip(),
                'frontmatter': frontmatter,
            })

    return artifacts


def split_sentences(text):
    """Split text into sentences, filtering short fragments."""
    sentences = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sentences if len(s.strip()) > 20]


def detect_causal_signals(sentence):
    """
    Score a sentence for causal content across signal types.
    Returns dict of {signal_type: match_count} and total causal_score.
    """
    signals = {}
    total = 0
    for signal_type, pattern in CAUSAL_TRIGGERS.items():
        matches = pattern.findall(sentence)
        if matches:
            signals[signal_type] = len(matches)
            total += len(matches)
    return signals, total


def extract_cause_effect_pairs(sentence):
    """
    Attempt to extract (cause, effect) from a sentence using heuristic patterns.
    Returns list of (cause_phrase, effect_phrase, connector) tuples.
    """
    pairs = []

    # Pattern 1: "X leads to Y" / "X causes Y" / "X results in Y"
    p1 = re.search(
        r'(.{10,80}?)\s+(leads? to|causes?|results? in|produces?|creates?|triggers?|drives?)\s+(.{10,80})',
        sentence, re.I
    )
    if p1:
        pairs.append((p1.group(1).strip(), p1.group(3).strip(), p1.group(2).strip()))

    # Pattern 2: "Because X, Y" / "Due to X, Y"
    p2 = re.search(
        r'(because|due to|owing to)\s+(.{10,80}?),\s*(.{10,80})',
        sentence, re.I
    )
    if p2:
        pairs.append((p2.group(2).strip(), p2.group(3).strip(), p2.group(1).strip()))

    # Pattern 3: "If X, then Y" / "When X, then Y"
    p3 = re.search(
        r'(if|when|assuming|provided)\s+(.{10,80}?),?\s*then\s+(.{10,80})',
        sentence, re.I
    )
    if p3:
        pairs.append((p3.group(2).strip(), p3.group(3).strip(), f'{p3.group(1)} ... then'))

    # Pattern 4: "X therefore Y" / "X consequently Y"
    p4 = re.search(
        r'(.{10,80}?)\s+(therefore|consequently|hence|thus|so)\s+(.{10,80})',
        sentence, re.I
    )
    if p4:
        pairs.append((p4.group(1).strip(), p4.group(3).strip(), p4.group(2).strip()))

    # Pattern 5: "X enables Y" / "X prevents Y"
    p5 = re.search(
        r'(.{10,80}?)\s+(enables?|allows?|prevents?|blocks?|inhibits?)\s+(.{10,80})',
        sentence, re.I
    )
    if p5:
        pairs.append((p5.group(1).strip(), p5.group(3).strip(), p5.group(2).strip()))

    return pairs


def extract_mechanism(sentence, cause, effect):
    """
    Try to extract the mechanism (the HOW) from a sentence.
    Looks for 'because', 'through', 'via', 'by means of' between or near cause/effect.
    """
    mech_patterns = [
        re.compile(r'(?:because|due to|through|via|by means of|by)\s+(.{10,120})', re.I),
        re.compile(r'mechanism[:\s]+(.{10,120})', re.I),
        re.compile(r'(?:this works because|the reason is)\s+(.{10,120})', re.I),
    ]
    for p in mech_patterns:
        m = p.search(sentence)
        if m:
            return m.group(1).strip().rstrip('.,;')
    return ''


def classify_causal_domain(artifact, cause_text, effect_text):
    """Classify the domain of a causal claim based on language cues."""
    combined = f"{cause_text} {effect_text} {artifact.get('section', '')}".lower()

    if any(w in combined for w in ['material', 'thermal', 'ceramic', 'metal', 'corrosion',
                                     'failure', 'fracture', 'stress', 'temperature', 'alloy']):
        return 'materials'
    if any(w in combined for w in ['market', 'customer', 'revenue', 'pricing', 'demand',
                                     'adoption', 'growth', 'tam', 'segment']):
        return 'business'
    if any(w in combined for w in ['competitor', 'moat', 'advantage', 'positioning',
                                     'switching', 'lock-in', 'barrier']):
        return 'competitive'
    if any(w in combined for w in ['team', 'hire', 'culture', 'leadership', 'talent']):
        return 'team'
    if any(w in combined for w in ['patent', 'ip', 'regulatory', 'legal', 'compliance']):
        return 'legal'
    if any(w in combined for w in ['cost', 'margin', 'burn', 'runway', 'funding', 'unit economics']):
        return 'financial'
    return 'general'


def score_novelty(claim, all_claims):
    """
    Basic novelty score: how different is this claim from others?
    Uses Jaccard distance on cause/effect word sets.
    """
    if not all_claims:
        return 0.5

    claim_words = set(f"{claim['cause']} {claim['effect']}".lower().split())
    similarities = []
    for other in all_claims:
        if other['id'] == claim['id']:
            continue
        other_words = set(f"{other['cause']} {other['effect']}".lower().split())
        if not claim_words or not other_words:
            continue
        intersection = len(claim_words & other_words)
        union = len(claim_words | other_words)
        if union > 0:
            similarities.append(intersection / union)

    if not similarities:
        return 0.5

    avg_similarity = sum(similarities) / len(similarities)
    return max(0.0, min(1.0, 1.0 - avg_similarity))


def detect_cascades(claims):
    """
    Detect assumption cascade chains: if claim A fails, what else breaks?
    Uses shared entity overlap between cause/effect phrases.
    """
    cascades = []

    for i, source in enumerate(claims):
        effect_words = set(source['effect'].lower().split())
        # Strip common words
        effect_words -= {'the', 'a', 'an', 'is', 'are', 'was', 'were', 'will', 'be',
                         'to', 'of', 'in', 'for', 'and', 'or', 'that', 'this', 'with'}

        for j, target in enumerate(claims):
            if i == j:
                continue
            if source['source_artifact'] == target['source_artifact']:
                continue  # Same artifact — skip trivial self-cascades

            cause_words = set(target['cause'].lower().split())
            cause_words -= {'the', 'a', 'an', 'is', 'are', 'was', 'were', 'will', 'be',
                           'to', 'of', 'in', 'for', 'and', 'or', 'that', 'this', 'with'}

            # Overlap: source's effect mentions same entities as target's cause
            overlap = effect_words & cause_words
            if len(overlap) >= 2:  # At least 2 substantive shared words
                severity = 'high' if len(overlap) >= 4 else 'medium' if len(overlap) >= 3 else 'low'
                cascades.append({
                    'source_claim': source['id'],
                    'target_claim': target['id'],
                    'shared_entities': list(overlap),
                    'cascade_type': 'invalidation',
                    'severity': severity,
                    'path_length': 1,
                })

    return cascades


def build_causal_chains(claims, cascades):
    """
    Build multi-hop causal chains from individual claims + cascades.
    Returns chains as ordered lists of claim IDs.
    """
    # Build adjacency from cascades
    adj = defaultdict(list)
    for cascade in cascades:
        adj[cascade['source_claim']].append(cascade['target_claim'])

    chains = []
    visited_starts = set()

    for claim in claims:
        if claim['id'] in visited_starts:
            continue

        # BFS to find chain from this claim
        chain = [claim['id']]
        current = claim['id']
        seen = {current}
        while current in adj:
            nexts = [n for n in adj[current] if n not in seen]
            if not nexts:
                break
            # Follow strongest cascade (first one found)
            current = nexts[0]
            seen.add(current)
            chain.append(current)

        if len(chain) >= 2:
            chains.append(chain)
            visited_starts.update(chain)

    # Sort chains by length (longest first — deepest causal reasoning)
    chains.sort(key=len, reverse=True)
    return chains[:20]


def main():
    parser = argparse.ArgumentParser(
        description='Causal claim extraction pipeline for room artifacts'
    )
    parser.add_argument('room_dir', help='Path to room directory')
    parser.add_argument('--threshold', type=float, default=0.3,
                        help='Minimum causal signal score (default: 0.3)')
    parser.add_argument('--output', default=None,
                        help='Output JSON path (default: {room_dir}/.causal-results.json)')

    args = parser.parse_args()
    room_dir = Path(args.room_dir).resolve()

    if not room_dir.is_dir():
        print(f"Error: {room_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    output_path = args.output or str(room_dir / '.causal-results.json')

    # Step 1: Discover artifacts
    artifacts = discover_artifacts(room_dir)
    print(f"Causal: found {len(artifacts)} artifacts", file=sys.stderr)

    if len(artifacts) < 1:
        result = {
            'metadata': {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'room_dir': str(room_dir),
                'artifact_count': 0,
                'claim_count': 0,
                'cascade_count': 0,
                'chain_count': 0,
            },
            'claims': [],
            'cascades': [],
            'chains': [],
        }
        Path(output_path).write_text(json.dumps(result, indent=2), encoding='utf-8')
        sys.exit(0)

    # Step 2: Extract causal claims from each artifact
    all_claims = []
    claim_counter = 0

    for artifact in artifacts:
        sentences = split_sentences(artifact['text'])

        for sentence in sentences:
            signals, score = detect_causal_signals(sentence)
            if score < 2:  # Need at least 2 causal signal hits
                continue

            # Extract cause-effect pairs
            pairs = extract_cause_effect_pairs(sentence)
            if not pairs:
                continue

            for cause, effect, connector in pairs:
                claim_counter += 1
                mechanism = extract_mechanism(sentence, cause, effect)
                domain = classify_causal_domain(artifact, cause, effect)

                # Confidence based on signal strength and mechanism presence
                confidence = min(1.0, 0.3 + (score * 0.1) + (0.2 if mechanism else 0.0))

                claim = {
                    'id': f'causal-{claim_counter:04d}',
                    'cause': cause[:200],  # Truncate long phrases
                    'effect': effect[:200],
                    'mechanism': mechanism[:300] if mechanism else '',
                    'confidence': round(confidence, 3),
                    'evidence': [artifact['id']],
                    'source_artifact': artifact['id'],
                    'source_sentence': sentence[:500],
                    'connector': connector,
                    'domain': domain,
                    'section': artifact['section'],
                    'causal_signals': signals,
                    'signal_score': score,
                    'falsifiable_prediction': '',  # Populated by LLM layer later
                    'novelty_score': 0.0,  # Computed after all claims extracted
                    'created': datetime.now(timezone.utc).strftime('%Y-%m-%d'),
                }
                all_claims.append(claim)

    print(f"Causal: extracted {len(all_claims)} claims from {len(artifacts)} artifacts", file=sys.stderr)

    # Step 3: Score novelty for each claim
    for claim in all_claims:
        claim['novelty_score'] = round(score_novelty(claim, all_claims), 4)

    # Step 4: Detect cascades (assumption failure propagation)
    cascades = detect_cascades(all_claims)
    print(f"Causal: detected {len(cascades)} cascades", file=sys.stderr)

    # Step 5: Build causal chains (multi-hop paths)
    chains = build_causal_chains(all_claims, cascades)
    print(f"Causal: built {len(chains)} chains (longest: {max(len(c) for c in chains) if chains else 0} hops)",
          file=sys.stderr)

    # Step 6: Domain summary
    domain_counts = defaultdict(int)
    for claim in all_claims:
        domain_counts[claim['domain']] += 1

    # Step 7: Build output
    result = {
        'metadata': {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'room_dir': str(room_dir),
            'artifact_count': len(artifacts),
            'claim_count': len(all_claims),
            'cascade_count': len(cascades),
            'chain_count': len(chains),
            'domain_distribution': dict(domain_counts),
            'causal_version': '1.7.0',
        },
        'claims': all_claims,
        'cascades': cascades,
        'chains': chains,
    }

    Path(output_path).write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding='utf-8')

    # Summary to stderr
    top_domains = sorted(domain_counts.items(), key=lambda x: x[1], reverse=True)[:3]
    domain_str = ', '.join(f'{d}:{c}' for d, c in top_domains)
    print(
        f"Causal: {len(all_claims)} claims, {len(cascades)} cascades, "
        f"{len(chains)} chains. Domains: {domain_str}",
        file=sys.stderr
    )


if __name__ == '__main__':
    main()
