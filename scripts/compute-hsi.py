#!/usr/bin/env python3
"""
compute-hsi.py -- HSI (Hybrid Similarity Index) Computation Pipeline
=====================================================================
Ported from V4 hsi_semantic_surprise.py and V2 compute_lsa.py.
Reads room/*.md artifacts, computes TF-IDF/SVD structural similarity
and embedding semantic similarity, outputs .hsi-results.json with scored pairs.

v1.6.0 "Powerhouse" upgrade: Spectral OM-HMM scoring based on Markov chain
theory (Seabrook & Wiskott 2022, arxiv 2207.02296). Replaces keyword-density
proxy with transition-matrix spectral analysis of thinking modes. The spectral
gap of the thinking-mode Markov chain measures genuine integrative thinking
quality -- fast mixing across modes = rich cross-domain thinking.

Usage:
    python3 scripts/compute-hsi.py /path/to/room [--tier 1|2] [--threshold 0.30] [--output path]

Tier system (per HSI-05):
    Tier 0: Handled by analyze-room bash script (keyword-only) -- NOT this script
    Tier 1: sklearn + MiniLM (default, CPU-only, ~80MB model)
    Tier 2: sklearn + Pinecone (uses existing embeddings if configured)
"""

import argparse
import hashlib
import json
import math
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# --- Guarded imports ---

try:
    import numpy as np
except ImportError:
    print("HSI requires numpy. Run: pip install -r requirements-hsi.txt", file=sys.stderr)
    sys.exit(1)

try:
    from sklearn.decomposition import TruncatedSVD
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    print("HSI requires scikit-learn. Run: pip install -r requirements-hsi.txt", file=sys.stderr)
    sys.exit(1)


# --- Spectral OM-HMM: Thinking Mode Classification & Markov Analysis ---
# Based on Seabrook & Wiskott (2022) "Tutorial on Spectral Theory of Markov Chains"
# arxiv 2207.02296 -- applied to venture artifact integrative thinking detection.
#
# Core insight: Texts that rapidly transition between thinking modes (analytical,
# integrative, descriptive, evaluative, creative) exhibit higher integrative
# thinking quality than texts stuck in a single mode. The spectral gap of the
# thinking-mode transition matrix quantifies this mixing rate.

_INTEGRATIVE_KEYWORDS = frozenset({
    "cross-domain", "synthesis", "combine", "bridge", "transfer",
    "connect", "integrate", "hybrid", "convergence", "interdisciplinary",
    "analogy", "metaphor", "parallel", "intersection", "fusion",
})

# Thinking mode classifiers (sentence-level)
# Each mode represents a hidden state in the Markov chain
_THINKING_MODES = {
    "analytical": re.compile(
        r"\b(because|therefore|consequently|evidence|data|measure|quantif|statistic|analyz|assess|evaluat|compar)\w*\b", re.I
    ),
    "integrative": re.compile(
        r"\b(connect|bridge|synthes|combin|integrat|cross|interdisciplin|convergence|fusion|hybrid|anolog|metaphor|transfer)\w*\b", re.I
    ),
    "descriptive": re.compile(
        r"\b(is|are|was|were|has|have|consist|compris|includ|contain|describ|defin|refer|represent)\w*\b", re.I
    ),
    "evaluative": re.compile(
        r"\b(should|must|better|worse|risk|opportunit|strength|weakness|advantage|disadvantage|critical|important|significant)\w*\b", re.I
    ),
    "creative": re.compile(
        r"\b(novel|innovati|reimagin|redefin|what.if|could|might|envision|transform|disrupt|pioneer|breakthrough|radical)\w*\b", re.I
    ),
}

# Legacy feature patterns (kept for backward compatibility in scoring)
_FEATURE_PATTERNS = [
    (r"\bsimple\b|\bstraightforward\b|\bbasic\b", "simple"),
    (r"\bcomplex\b|\bcomplicated\b|\bintricate\b", "complex"),
    (r"\blinear\b|\bsequential\b|\bstep.by.step\b", "linear"),
    (r"\bmulti\w*\b|\bparallel\b|\bsimultaneous\b", "multidirectional"),
    (r"\bpart\b|\bcomponent\b|\bpiece\b|\bfragment\b", "part"),
    (r"\bholistic\b|\bwhole\b|\bsystem\b|\bentire\b", "holistic"),
    (r"\btrade.?off\b|\bcompromise\b|\bbalance\b", "tradeoff"),
    (r"\bcreative\b|\bnovel\b|\binnovati\\w+\b|\boriginal\b", "creative"),
]

# Skip files/dirs
SKIP_FILES = {"STATE.md", "ROOM.md", "MINTO.md"}
SKIP_DIRS = {".lazygraph", ".git", "node_modules", ".hsi-cache.json"}


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
        # Filter out skip dirs
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

        rel_root = Path(root).relative_to(room_path)
        # Skip root-level files (no section)
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

            if len(body.strip()) < 50:
                continue  # skip near-empty artifacts

            artifacts.append({
                'id': artifact_id,
                'section': section,
                'title': title,
                'path': str(fpath.relative_to(room_path)),
                'text': body.strip(),
            })

    return artifacts


def compute_content_hashes(artifacts):
    """Compute MD5 hash of each artifact's text content."""
    hashes = {}
    for art in artifacts:
        h = hashlib.md5(art['text'].encode('utf-8')).hexdigest()[:12]
        hashes[art['id']] = h
    return hashes


def check_cache(room_dir, current_hashes):
    """Check if all artifact hashes match cached hashes. Return True if unchanged."""
    cache_path = Path(room_dir) / '.hsi-cache.json'
    if not cache_path.exists():
        return False
    try:
        cached = json.loads(cache_path.read_text(encoding='utf-8'))
        cached_hashes = cached.get('hashes', {})
        if set(cached_hashes.keys()) != set(current_hashes.keys()):
            return False
        return all(cached_hashes.get(k) == v for k, v in current_hashes.items())
    except (json.JSONDecodeError, OSError):
        return False


def write_cache(room_dir, hashes):
    """Write content hashes to cache file."""
    cache_path = Path(room_dir) / '.hsi-cache.json'
    cache_path.write_text(json.dumps({
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'hashes': hashes,
    }, indent=2), encoding='utf-8')


def compute_lsa_similarity(texts):
    """Compute LSA structural similarity matrix using TF-IDF + SVD.

    Ported from V4 compute_lsa_similarity and V2 compute_lsa.py.
    Uses 500 max_features (lighter than V2's 2000 -- room artifacts are smaller).
    """
    n = len(texts)
    vectorizer = TfidfVectorizer(stop_words='english', max_features=500)

    try:
        tfidf_matrix = vectorizer.fit_transform(texts)
    except ValueError:
        # Empty vocabulary
        return np.eye(n)

    n_components = min(80, n - 1, tfidf_matrix.shape[1])
    if n_components < 1:
        return np.eye(n)

    svd = TruncatedSVD(n_components=n_components)
    reduced = svd.fit_transform(tfidf_matrix)

    sim_matrix = cosine_similarity(reduced)
    return np.clip(sim_matrix, 0.0, 1.0)


def compute_semantic_similarity_tier1(texts):
    """Tier 1: Local MiniLM embeddings (CPU-only, ~80MB model)."""
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        return None

    model = SentenceTransformer('all-MiniLM-L6-v2')
    embeddings = model.encode(texts, show_progress_bar=False)
    sim_matrix = cosine_similarity(embeddings)
    return np.clip(sim_matrix, 0.0, 1.0)


def compute_semantic_similarity_tier2(artifact_ids, texts):
    """Tier 2: Pinecone embeddings from existing index.

    Falls back to Tier 1 if Pinecone not configured or query fails.
    """
    api_key = os.environ.get('PINECONE_API_KEY')
    index_name = os.environ.get('PINECONE_INDEX')

    if not api_key or not index_name:
        return None  # Fall back to Tier 1

    try:
        from pinecone import Pinecone
        pc = Pinecone(api_key=api_key)
        index = pc.Index(index_name)

        # Fetch existing embeddings for artifact IDs
        fetch_result = index.fetch(ids=artifact_ids)
        vectors = fetch_result.get('vectors', {})

        if len(vectors) < 2:
            return None  # Not enough vectors, fall back

        # Build embedding matrix in artifact order
        dim = None
        embeddings = []
        for aid in artifact_ids:
            if aid in vectors:
                vec = vectors[aid]['values']
                if dim is None:
                    dim = len(vec)
                embeddings.append(vec)
            else:
                return None  # Missing vector, fall back to Tier 1

        embedding_matrix = np.array(embeddings)
        sim_matrix = cosine_similarity(embedding_matrix)
        return np.clip(sim_matrix, 0.0, 1.0)

    except Exception:
        return None  # Any error, fall back to Tier 1


def classify_sentence_mode(sentence):
    """Classify a sentence into its dominant thinking mode.

    Returns the mode with the highest keyword match count.
    Ties broken by priority: integrative > creative > evaluative > analytical > descriptive.
    Falls back to 'descriptive' if no matches (most common baseline mode).
    """
    scores = {}
    for mode, pattern in _THINKING_MODES.items():
        scores[mode] = len(pattern.findall(sentence))

    max_score = max(scores.values())
    if max_score == 0:
        return "descriptive"

    priority = ["integrative", "creative", "evaluative", "analytical", "descriptive"]
    for mode in priority:
        if scores[mode] == max_score:
            return mode
    return "descriptive"


def build_transition_matrix(mode_sequence):
    """Build a Markov transition matrix from a sequence of thinking modes.

    Returns (matrix, mode_names) where matrix[i][j] = P(mode_j | mode_i).
    Based on Seabrook & Wiskott (2022) Section 2: transition matrices encode
    state-to-state probabilities in a Markov chain.
    """
    modes = list(_THINKING_MODES.keys())
    n = len(modes)
    mode_idx = {m: i for i, m in enumerate(modes)}

    # Count transitions
    counts = np.zeros((n, n), dtype=float)
    for k in range(len(mode_sequence) - 1):
        i = mode_idx[mode_sequence[k]]
        j = mode_idx[mode_sequence[k + 1]]
        counts[i][j] += 1.0

    # Normalize rows to get transition probabilities
    # Add Laplace smoothing (alpha=0.1) to avoid zero rows
    alpha = 0.1
    counts += alpha

    row_sums = counts.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1.0  # safety
    matrix = counts / row_sums

    return matrix, modes


def compute_spectral_gap(transition_matrix):
    """Compute spectral gap of a Markov chain transition matrix.

    Spectral gap = 1 - |lambda_2| where lambda_2 is the second-largest
    eigenvalue by magnitude. Larger gap = faster mixing = more diverse
    thinking mode transitions.

    From Seabrook & Wiskott (2022) Section 4: the spectral gap determines
    the rate of convergence to the stationary distribution. A chain that
    mixes quickly visits all states rapidly -- in our context, this means
    the text transitions through many thinking modes rather than getting
    stuck in one.
    """
    try:
        eigenvalues = np.linalg.eigvals(transition_matrix)
        # Sort by magnitude descending
        magnitudes = sorted(np.abs(eigenvalues), reverse=True)

        if len(magnitudes) < 2:
            return 0.0

        # lambda_1 should be ~1.0 (Perron-Frobenius)
        # Spectral gap = 1 - |lambda_2|
        spectral_gap = 1.0 - magnitudes[1]
        return max(0.0, min(1.0, spectral_gap))
    except (np.linalg.LinAlgError, ValueError):
        return 0.0


def compute_stationary_distribution(transition_matrix):
    """Compute stationary distribution of the Markov chain.

    The stationary distribution pi satisfies pi * P = pi.
    It reveals the long-run proportion of time spent in each thinking mode.
    From Seabrook & Wiskott (2022) Section 3: for ergodic chains, the
    stationary distribution is unique and equals the left eigenvector
    corresponding to eigenvalue 1.
    """
    try:
        # Left eigenvector: solve pi * P = pi, equivalently P^T * pi^T = pi^T
        eigenvalues, eigenvectors = np.linalg.eig(transition_matrix.T)

        # Find eigenvector for eigenvalue closest to 1
        idx = np.argmin(np.abs(eigenvalues - 1.0))
        stationary = np.real(eigenvectors[:, idx])

        # Normalize to probability distribution
        total = np.sum(np.abs(stationary))
        if total > 0:
            stationary = np.abs(stationary) / total
        else:
            stationary = np.ones(len(stationary)) / len(stationary)

        return stationary
    except (np.linalg.LinAlgError, ValueError):
        n = transition_matrix.shape[0]
        return np.ones(n) / n


def detect_absorbing_tendency(transition_matrix, modes):
    """Detect if the chain has absorbing tendencies (gets stuck in modes).

    A self-loop probability > 0.6 indicates the text tends to stay in
    that mode rather than transitioning -- a sign of shallow or
    single-mode analysis.

    Returns: absorbing_score (0-1) where 0 = no absorption, 1 = fully stuck.
    """
    diag = np.diag(transition_matrix)
    # Average self-loop probability above baseline (1/n would be uniform)
    n = len(modes)
    baseline = 1.0 / n
    excess = np.maximum(diag - baseline, 0)
    absorbing_score = float(np.mean(excess) / (1.0 - baseline)) if baseline < 1.0 else 0.0
    return max(0.0, min(1.0, absorbing_score))


def compute_omhmm_score(text):
    """Spectral OM-HMM integrative thinking score (0-100).

    v1.6.0 upgrade: Uses Markov chain spectral analysis instead of keyword
    density proxy. Based on Seabrook & Wiskott (2022) spectral theory of
    Markov chains applied to thinking-mode transition detection.

    Score components:
      - spectral_gap (40%): Fast mixing across thinking modes = rich thinking
      - integrative_weight (25%): Stationary distribution weight on integrative mode
      - mode_diversity (20%): Entropy of stationary distribution (Ashby's variety)
      - anti_absorption (15%): Penalty for getting stuck in single modes

    Falls back to legacy keyword scoring if text has < 5 sentences
    (insufficient data for meaningful transition matrix).
    """
    # Split into sentences for mode classification
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 10]

    # Fallback to legacy scoring for very short texts
    if len(sentences) < 5:
        return _compute_omhmm_legacy(text)

    # Step 1: Classify each sentence into a thinking mode
    mode_sequence = [classify_sentence_mode(s) for s in sentences]

    # Step 2: Build transition matrix (Seabrook & Wiskott Section 2)
    transition_matrix, modes = build_transition_matrix(mode_sequence)

    # Step 3: Compute spectral gap (Section 4)
    # Larger gap = faster mixing = more diverse thinking
    spectral_gap = compute_spectral_gap(transition_matrix)

    # Step 4: Compute stationary distribution (Section 3)
    stationary = compute_stationary_distribution(transition_matrix)

    # Step 5: Extract integrative mode weight from stationary distribution
    mode_idx = {m: i for i, m in enumerate(modes)}
    integrative_weight = float(stationary[mode_idx["integrative"]])

    # Step 6: Compute mode diversity via Shannon entropy
    # High entropy = visits many modes = Ashby's requisite variety
    entropy = 0.0
    for p in stationary:
        if p > 1e-10:
            entropy -= p * math.log2(p)
    max_entropy = math.log2(len(modes))  # Uniform distribution
    mode_diversity = entropy / max_entropy if max_entropy > 0 else 0.0

    # Step 7: Detect absorbing tendency (penalty for shallow thinking)
    absorbing = detect_absorbing_tendency(transition_matrix, modes)
    anti_absorption = 1.0 - absorbing

    # Composite score (0-100)
    score = (
        0.40 * spectral_gap * 100
        + 0.25 * integrative_weight * 100 * len(modes)  # Scale by mode count
        + 0.20 * mode_diversity * 100
        + 0.15 * anti_absorption * 100
    )

    return max(0.0, min(100.0, score))


def _compute_omhmm_legacy(text):
    """Legacy OM-HMM scoring for short texts (< 5 sentences).

    Original V4 keyword-density approach. Used as fallback when there
    is insufficient data to build a meaningful transition matrix.

    Score = 0.5 * likelihood_ratio * 100
          + 0.3 * (feature_diversity / 8) * 100
          + 0.2 * min(complexity_ratio * 50, 100)
    """
    text_lower = text.lower()
    words = text_lower.split()
    total_words = max(len(words), 1)

    # Feature diversity
    features_found = set()
    for pattern, label in _FEATURE_PATTERNS:
        if re.search(pattern, text_lower):
            features_found.add(label)
    feature_diversity = len(features_found)

    # Complexity ratio: sentence length variance / mean
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    if len(sentences) > 1:
        lengths = [len(s.split()) for s in sentences]
        mean_len = sum(lengths) / len(lengths)
        if mean_len > 0:
            variance = sum((ln - mean_len) ** 2 for ln in lengths) / len(lengths)
            complexity_ratio = (variance ** 0.5) / mean_len
        else:
            complexity_ratio = 0.0
    else:
        complexity_ratio = 0.0

    # Likelihood ratio: integrative keyword density
    integrative_count = sum(
        1 for w in words if w.strip('.,;:!?') in _INTEGRATIVE_KEYWORDS
    )
    likelihood_ratio = integrative_count / total_words

    score = (
        0.5 * likelihood_ratio * 100
        + 0.3 * (feature_diversity / 8) * 100
        + 0.2 * min(complexity_ratio * 50, 100)
    )

    return max(0.0, min(100.0, score))


def compute_artifact_spectral_profile(text):
    """Compute full spectral profile for an artifact.

    Returns dict with spectral metrics for downstream graph analysis:
    - omhmm_score: composite integrative thinking score (0-100)
    - spectral_gap: mixing rate of thinking-mode Markov chain (0-1)
    - dominant_mode: mode with highest stationary probability
    - mode_entropy: Shannon entropy of stationary distribution (0-1 normalized)
    - absorbing_score: tendency to get stuck in single mode (0-1)
    - mode_distribution: full stationary distribution dict
    """
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 10]

    if len(sentences) < 5:
        # Legacy fallback -- limited profile
        score = _compute_omhmm_legacy(text)
        return {
            'omhmm_score': score,
            'spectral_gap': 0.0,
            'dominant_mode': 'unknown',
            'mode_entropy': 0.0,
            'absorbing_score': 0.0,
            'mode_distribution': {},
            'spectral_method': 'legacy',
        }

    mode_sequence = [classify_sentence_mode(s) for s in sentences]
    transition_matrix, modes = build_transition_matrix(mode_sequence)
    spectral_gap = compute_spectral_gap(transition_matrix)
    stationary = compute_stationary_distribution(transition_matrix)

    mode_idx = {m: i for i, m in enumerate(modes)}
    dominant_idx = int(np.argmax(stationary))
    dominant_mode = modes[dominant_idx]

    entropy = 0.0
    for p in stationary:
        if p > 1e-10:
            entropy -= p * math.log2(p)
    max_entropy = math.log2(len(modes))
    mode_entropy = entropy / max_entropy if max_entropy > 0 else 0.0

    absorbing = detect_absorbing_tendency(transition_matrix, modes)

    mode_dist = {m: round(float(stationary[mode_idx[m]]), 4) for m in modes}

    return {
        'omhmm_score': compute_omhmm_score(text),
        'spectral_gap': round(spectral_gap, 4),
        'dominant_mode': dominant_mode,
        'mode_entropy': round(mode_entropy, 4),
        'absorbing_score': round(absorbing, 4),
        'mode_distribution': mode_dist,
        'spectral_method': 'markov',
    }


def compute_hsi_matrix(artifacts, lsa_matrix, semantic_matrix, threshold=0.30):
    """Compute HSI innovation differential matrix and extract top pairs.

    v1.6.0 upgrade: Uses spectral OM-HMM scores and includes spectral
    metadata (spectral_gap, dominant_mode) in pair output for downstream
    graph analysis and random walk innovation pathway discovery.

    Formula:
    - semantic_surprise = abs(semantic_sim - lsa_sim)
    - integrative_factor = sqrt(omhmm_i * omhmm_j) / 100
    - innovation_differential = 0.6 * semantic_surprise + 0.4 * integrative_factor
    - breakthrough_potential = 0.7 * differential + 0.3 * min(lsa, semantic)
    """
    n = len(artifacts)
    texts = [a['text'] for a in artifacts]

    # Compute spectral profiles for all artifacts
    print("HSI: computing spectral OM-HMM profiles...", file=sys.stderr)
    spectral_profiles = [compute_artifact_spectral_profile(t) for t in texts]
    omhmm_scores = [p['omhmm_score'] for p in spectral_profiles]

    # Count spectral vs legacy
    n_spectral = sum(1 for p in spectral_profiles if p['spectral_method'] == 'markov')
    n_legacy = n - n_spectral
    print(f"HSI: {n_spectral} spectral, {n_legacy} legacy (< 5 sentences)", file=sys.stderr)

    pairs = []
    for i in range(n):
        for j in range(i + 1, n):
            lsa_sim = float(lsa_matrix[i, j])
            sem_sim = float(semantic_matrix[i, j])

            semantic_surprise = abs(sem_sim - lsa_sim)
            integrative_factor = math.sqrt(omhmm_scores[i] * omhmm_scores[j]) / 100.0
            innovation_diff = 0.6 * semantic_surprise + 0.4 * integrative_factor

            if innovation_diff < threshold:
                continue

            # Classify
            if lsa_sim > sem_sim:
                surprise_type = 'structural_transfer'
            else:
                surprise_type = 'semantic_implementation'

            # Breakthrough potential (from V2)
            breakthrough = 0.7 * innovation_diff + 0.3 * min(lsa_sim, sem_sim)

            # Spectral metadata for pair (average of both artifacts)
            avg_spectral_gap = (
                spectral_profiles[i]['spectral_gap']
                + spectral_profiles[j]['spectral_gap']
            ) / 2.0

            pairs.append({
                'left_id': artifacts[i]['id'],
                'right_id': artifacts[j]['id'],
                'lsa_sim': round(lsa_sim, 4),
                'semantic_sim': round(sem_sim, 4),
                'hsi_score': round(innovation_diff, 4),
                'surprise_type': surprise_type,
                'breakthrough_potential': round(breakthrough, 4),
                'spectral_gap_avg': round(avg_spectral_gap, 4),
                'left_dominant_mode': spectral_profiles[i]['dominant_mode'],
                'right_dominant_mode': spectral_profiles[j]['dominant_mode'],
            })

    # Sort by hsi_score descending, take top 20
    pairs.sort(key=lambda p: p['hsi_score'], reverse=True)
    return pairs[:20], spectral_profiles


def main():
    parser = argparse.ArgumentParser(
        description='HSI computation pipeline for room artifacts'
    )
    parser.add_argument('room_dir', help='Path to room directory')
    parser.add_argument('--tier', type=int, choices=[1, 2], default=1,
                        help='Embedding tier: 1=MiniLM (default), 2=Pinecone')
    parser.add_argument('--threshold', type=float, default=0.30,
                        help='Minimum HSI score threshold (default: 0.30)')
    parser.add_argument('--output', default=None,
                        help='Output JSON path (default: {room_dir}/.hsi-results.json)')

    args = parser.parse_args()
    room_dir = Path(args.room_dir).resolve()

    if not room_dir.is_dir():
        print(f"Error: {room_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    output_path = args.output or str(room_dir / '.hsi-results.json')

    # Step 1: Discover artifacts
    artifacts = discover_artifacts(room_dir)

    if len(artifacts) < 2:
        # Write empty results and exit
        result = {
            'metadata': {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'room_dir': str(room_dir),
                'tier': args.tier,
                'artifact_count': len(artifacts),
                'pair_count': 0,
            },
            'artifacts': [],
            'hsi_pairs': [],
            'reverse_salients': [],
        }
        Path(output_path).write_text(json.dumps(result, indent=2), encoding='utf-8')
        print(f"HSI: {len(artifacts)} artifacts found (minimum 2 required), wrote empty results",
              file=sys.stderr)
        sys.exit(0)

    # Step 2: Check cache
    content_hashes = compute_content_hashes(artifacts)
    if check_cache(room_dir, content_hashes):
        print("HSI: all artifacts unchanged (cache hit), skipping computation",
              file=sys.stderr)
        sys.exit(0)

    # Step 3: Compute LSA structural similarity
    texts = [a['text'] for a in artifacts]
    print(f"HSI: computing LSA similarity for {len(artifacts)} artifacts...",
          file=sys.stderr)
    lsa_matrix = compute_lsa_similarity(texts)

    # Step 4: Compute semantic similarity
    tier_used = args.tier
    semantic_matrix = None

    if args.tier == 2:
        artifact_ids = [a['id'] for a in artifacts]
        semantic_matrix = compute_semantic_similarity_tier2(artifact_ids, texts)
        if semantic_matrix is not None:
            tier_used = 2
            print("HSI: using Tier 2 (Pinecone) embeddings", file=sys.stderr)

    if semantic_matrix is None:
        # Tier 1 fallback
        print("HSI: using Tier 1 (MiniLM) embeddings...", file=sys.stderr)
        semantic_matrix = compute_semantic_similarity_tier1(texts)
        tier_used = 1

        if semantic_matrix is None:
            print(
                "HSI: sentence-transformers not installed. "
                "Run: pip install -r requirements-hsi.txt",
                file=sys.stderr
            )
            sys.exit(1)

    # Step 5: Compute HSI matrix and extract top pairs (with spectral profiles)
    pairs, spectral_profiles = compute_hsi_matrix(
        artifacts, lsa_matrix, semantic_matrix, threshold=args.threshold
    )

    # Step 6: Build output with spectral metadata
    artifact_list = [
        {
            'id': a['id'],
            'section': a['section'],
            'title': a['title'],
            'path': a['path'],
            'spectral': {
                'omhmm_score': round(spectral_profiles[i]['omhmm_score'], 2),
                'spectral_gap': spectral_profiles[i]['spectral_gap'],
                'dominant_mode': spectral_profiles[i]['dominant_mode'],
                'mode_entropy': spectral_profiles[i]['mode_entropy'],
                'absorbing_score': spectral_profiles[i]['absorbing_score'],
                'mode_distribution': spectral_profiles[i]['mode_distribution'],
                'method': spectral_profiles[i]['spectral_method'],
            },
        }
        for i, a in enumerate(artifacts)
    ]

    # Compute room-level spectral summary
    spectral_scores = [p['omhmm_score'] for p in spectral_profiles]
    spectral_gaps = [p['spectral_gap'] for p in spectral_profiles if p['spectral_method'] == 'markov']
    mode_counts = {}
    for p in spectral_profiles:
        dm = p['dominant_mode']
        mode_counts[dm] = mode_counts.get(dm, 0) + 1

    result = {
        'metadata': {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'room_dir': str(room_dir),
            'tier': tier_used,
            'artifact_count': len(artifacts),
            'pair_count': len(pairs),
            'spectral_version': '1.6.0',
            'spectral_summary': {
                'mean_omhmm': round(sum(spectral_scores) / len(spectral_scores), 2) if spectral_scores else 0,
                'mean_spectral_gap': round(sum(spectral_gaps) / len(spectral_gaps), 4) if spectral_gaps else 0,
                'dominant_mode_distribution': mode_counts,
                'spectral_artifacts': len(spectral_gaps),
                'legacy_artifacts': len(spectral_scores) - len(spectral_gaps),
            },
        },
        'artifacts': artifact_list,
        'hsi_pairs': pairs,
        'reverse_salients': [],  # Populated by detect-reverse-salients.py
    }

    Path(output_path).write_text(json.dumps(result, indent=2), encoding='utf-8')

    # Update cache
    write_cache(room_dir, content_hashes)

    # Summary to stderr
    top_score = pairs[0]['hsi_score'] if pairs else 0.0
    print(
        f"HSI: {len(pairs)} pairs found (top score: {top_score:.3f}), "
        f"tier {tier_used}, {len(artifacts)} artifacts",
        file=sys.stderr
    )


if __name__ == '__main__':
    main()
