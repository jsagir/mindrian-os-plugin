#!/usr/bin/env python3
"""
compute-hsi.py -- HSI (Hybrid Similarity Index) Computation Pipeline
=====================================================================
Ported from V4 hsi_semantic_surprise.py and V2 compute_lsa.py.
Reads room/*.md artifacts, computes a lexical/structural similarity leg and a
dense embedding semantic leg, and writes .hsi-results.json with scored pairs.

v1.6.0 "Powerhouse": Spectral OM-HMM scoring (Seabrook & Wiskott 2022,
arxiv 2207.02296): the spectral gap of the thinking-mode Markov chain measures
integrative thinking quality.

2026 revision (schema_version 2.0, every pre-existing output key is kept):
  - Lexical leg is a hybrid by default: mean of LSA (TF-IDF + seeded SVD) and
    BM25. The LSA path stays available and bit-identical in intent via
    --lexical lsa. LSA no longer needs scikit-learn (numpy fallback).
  - Pairs are ranked by corpus percentile (empirical percentile and z-score of
    hsi_score over ALL pairs) instead of a fixed 0.30 cutoff. The fixed cutoff
    is still available via --ranking legacy or an explicit --threshold.
  - Optional claim-level check (--claim-level): a problem sentence of one
    artifact against a method sentence of the other, with the sentences kept in
    a source trail.
  - Every reported pair carries a source trail, a second-signal check and a
    novelty-check status. Nothing here is LLM based; ranking is deterministic.
  - The output records what was computed, with which model and parameters.

Usage:
    python3 scripts/compute-hsi.py /path/to/room [--tier 1|2] [--threshold X] [--output path]
                                                 [--scope-to-nodes]
                                                 [--lexical hybrid|lsa|bm25] [--ranking percentile|legacy]
                                                 [--top-k 20] [--min-percentile 0.0]
                                                 [--claim-level] [--dense-vectors file.json]
                                                 [--model NAME] [--seed 42] [--allow-lexical-only]
                                                 [--max-artifacts 3000] [--no-chunking]

Tier system (per HSI-05):
    Tier 0: Handled by analyze-room bash script (keyword-only) -- NOT this script
    Tier 1: MiniLM (default, CPU-only, ~80MB model) or --dense-vectors
    Tier 2: Pinecone (uses existing embeddings if configured)
"""

# Reference implementation, the MINDRIAN_RS_BACKEND=python fallback and
# scout's HSI step 1. Its surprise_type strings use the retired Convention B;
# since Phase 355 D-07 no reader trusts them: hsi-to-graph re-derives from
# lsa_sim / semantic_sim through lib/core/direction-convention.cjs.
import argparse
import hashlib
import json
import math
import os
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

SCHEMA_VERSION = "2.0"
DEFAULT_SEED = 42
DEFAULT_DENSE_MODEL = "all-MiniLM-L6-v2"

# Auto-install of Python ML deps (v1.10.9, plan 85-10, LAWRENCE-001) is kept
# when scripts/lib/ensure_ml_deps.py exists, but it can now be switched off
# (HSI_NO_AUTO_INSTALL=1) and its absence is no longer an ImportError crash.
sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
try:
    from ensure_ml_deps import ensure
except ImportError:
    def ensure(_packages):  # pragma: no cover - only when the helper is absent
        return None
if os.environ.get("HSI_NO_AUTO_INSTALL") != "1":
    ensure(["numpy", "scikit-learn", "sentence-transformers"])

# --- Guarded imports ---

try:
    import numpy as np
except ImportError:
    print("HSI requires numpy. Run: pip install -r requirements-hsi.txt", file=sys.stderr)
    sys.exit(1)

try:
    from sklearn.decomposition import TruncatedSVD
    from sklearn.feature_extraction.text import TfidfVectorizer, ENGLISH_STOP_WORDS
    _HAVE_SKLEARN = True
except ImportError:
    # scikit-learn is optional since 2026: the numpy fallbacks below produce
    # the same kind of matrices. The LSA leg records which backend ran.
    TruncatedSVD = None
    TfidfVectorizer = None
    ENGLISH_STOP_WORDS = frozenset()
    _HAVE_SKLEARN = False



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
    (r"\bcreative\b|\bnovel\b|\binnovati\w+\b|\boriginal\b", "creative"),  # 2026: was \\w+ (matched a literal backslash)
]

# --- Shared corpus exclude-list (Phase 200-01 / SEED-018, extended 233-03) ---
#
# SKIP_DIRS / SKIP_FILES / MIN_BODY_CHARS come from the ONE canonical source,
# lib/core/rs_corpus_exclude.py (every room-artifact walker imports those three
# names from that module and keeps no local literal). compute-hsi.py drifted
# from it once (Phase 233-03, RCA Section 9 Defect #4), so the local fallback
# below is used ONLY when that module cannot be imported, and says so on stderr.
_THIS_FILE = Path(__file__).resolve()
_LIB_CORE = _THIS_FILE.parent.parent / 'lib' / 'core'
if str(_LIB_CORE) not in sys.path:
    sys.path.insert(0, str(_LIB_CORE))

try:
    from rs_corpus_exclude import SKIP_DIRS, SKIP_FILES, MIN_BODY_CHARS  # noqa: E402
except ImportError:
    print("HSI: warning: lib/core/rs_corpus_exclude.py not importable, using the "
          "built-in fallback exclude-list", file=sys.stderr)
    SKIP_DIRS = frozenset({'.lazygraph', '.git', 'node_modules', '.mindrian', '.snapshots'})
    SKIP_FILES = frozenset({'STATE.md', 'ROOM.md', 'MINTO.md'})
    MIN_BODY_CHARS = 50

# WHITESPACE.md is generated INTO every section folder by
# write-whitespace-sections.cjs from this pipeline's own outputs. Scoring it
# would feed the pipeline its own findings, so it is always excluded here.
SKIP_FILES = frozenset(set(SKIP_FILES) | {'WHITESPACE.md'})



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

            if len(body.strip()) < MIN_BODY_CHARS:
                continue  # skip near-empty artifacts

            artifacts.append({
                'id': artifact_id,
                'section': section,
                'title': title,
                'path': str(fpath.relative_to(room_path)),
                'text': body.strip(),
            })

    return artifacts


def _file_uri_path(p):
    """Percent-encode the URI-significant bytes of a path for a SQLite file: URI.

    SQLite's URI parser treats ? as the query separator, # as the fragment start,
    and % as the escape byte. A room path containing any of them, spliced raw into
    'file:%s?mode=ro', silently breaks the open: the parser swallows part of the
    path as a query string, and the mode=ro that follows is then never recognized
    as the read-only mode flag. That is a broken read-only GUARANTEE (T-233-09
    claims read-only is enforced mechanically at the SQLite layer, not by
    convention), not merely a broken path.

    This is byte-for-byte the rule lib/core/graph-derivation.cjs::_fileUriPath
    already applies to the SAME room.db path for its sub-room ATTACH: the same
    three bytes, encoded in the same order (% first, so it cannot double-encode
    the escapes it just introduced). Kept identical on purpose. Everything else
    (spaces, quotes, unicode) passes through untouched, because SQLite decodes
    %XX and takes the rest literally. Two encoders that disagree about what a
    room path means would be a worse bug than either one alone.
    """
    return str(p).replace('%', '%25').replace('?', '%3F').replace('#', '%23')


def load_graph_artifact_ids(room_dir):
    """Return the set of Artifact node ids in <room>/.mindrian/room.db, or None.

    Phase 233-03 (RCA Section 9 Defect #4/#5). hsi-to-graph.cjs already refuses to
    write an edge whose endpoint is not an Artifact NODE (its findArtifact guard,
    correct behavior). Without this intersection, compute-hsi.py spends a full
    LSA + embedding pass on artifacts that could never become an edge, and the
    top-20 cut is then consumed by pairs that get silently discarded downstream.
    Scoping to the node set is both cheaper AND more correct.

    READ-ONLY by construction (T-233-09): the connection is opened through the
    `file:...?mode=ro` URI, so a write attempt fails at the SQLite layer rather
    than by convention. This script must never mutate the room's authoritative db.
    The path is run through _file_uri_path first, so a room directory containing
    ?, # or % cannot break the URI parse and take the mode=ro flag down with it.

    Returns None (never raises, never returns an empty set on error) when the db
    is missing, unreadable, or has no `nodes` table yet -- the Tier 0 /
    pre-structural-index case. The caller then scores everything, exactly like
    today. Degrading to "no filter" is right; degrading to "zero artifacts" would
    turn an immature room into a silent no-op, which is the false-success class
    this whole phase exists to close.
    """
    db_path = Path(room_dir) / '.mindrian' / 'room.db'
    if not db_path.exists():
        print(
            "HSI: --scope-to-nodes: no room.db at %s, scoring every discovered "
            "artifact" % db_path,
            file=sys.stderr,
        )
        return None

    conn = None
    try:
        conn = sqlite3.connect('file:%s?mode=ro' % _file_uri_path(db_path), uri=True)
        rows = conn.execute(
            "SELECT id FROM nodes WHERE type = 'Artifact'"
        ).fetchall()
    except sqlite3.Error as exc:
        print(
            "HSI: --scope-to-nodes: room.db unreadable (%s), scoring every "
            "discovered artifact" % exc,
            file=sys.stderr,
        )
        return None
    finally:
        if conn is not None:
            try:
                conn.close()
            except sqlite3.Error:
                pass

    return {r[0] for r in rows}


def compute_content_hashes(artifacts):
    """Compute MD5 hash of each artifact's text content."""
    hashes = {}
    for art in artifacts:
        h = hashlib.md5(art['text'].encode('utf-8')).hexdigest()[:12]
        hashes[art['id']] = h
    return hashes


def params_fingerprint(params):
    """Stable hash of every setting that changes the numbers in the output."""
    blob = json.dumps(params, sort_keys=True, default=str)
    return hashlib.sha256(blob.encode('utf-8')).hexdigest()[:16]


def check_cache(room_dir, current_hashes, params_hash=None, output_path=None):
    """Return True only when a recompute would reproduce the existing output.

    Original bug: the cache keyed on artifact content alone, so changing
    --threshold, --tier or the output path (or deleting .hsi-results.json)
    still reported a cache hit and left a stale or missing result. Now the
    parameter fingerprint must match and the output file must exist. A cache
    written by the old version has no fingerprint and counts as a miss.
    """
    cache_path = Path(room_dir) / '.hsi-cache.json'
    if not cache_path.exists():
        return False
    if output_path is not None and not Path(output_path).exists():
        return False
    try:
        cached = json.loads(cache_path.read_text(encoding='utf-8'))
        if params_hash is not None and cached.get('params_hash') != params_hash:
            return False
        cached_hashes = cached.get('hashes', {})
        if set(cached_hashes.keys()) != set(current_hashes.keys()):
            return False
        return all(cached_hashes.get(k) == v for k, v in current_hashes.items())
    except (json.JSONDecodeError, OSError, AttributeError):
        return False


def _atomic_write_text(path, text):
    """Write text to path via a temp file in the same directory, then rename."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + '.tmp-%d' % os.getpid())
    tmp.write_text(text, encoding='utf-8')
    os.replace(str(tmp), str(path))


def write_cache(room_dir, hashes, params_hash=None):
    """Write content hashes (and the parameter fingerprint) to the cache file."""
    cache_path = Path(room_dir) / '.hsi-cache.json'
    payload = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'hashes': hashes,
    }
    if params_hash is not None:
        payload['params_hash'] = params_hash
    _atomic_write_text(cache_path, json.dumps(payload, indent=2))


# ---------------------------------------------------------------------------
# Percentile / z-score helpers (corpus-relative ranking, no fixed cutoffs)
# ---------------------------------------------------------------------------

def empirical_percentile(values):
    """Empirical percentile in [0, 1] of each value within `values` (ties share
    their average rank). One value maps to 1.0; empty input to an empty array."""
    v = np.asarray(values, dtype=float).ravel()
    n = v.size
    if n == 0:
        return v
    if n == 1:
        return np.ones(1)
    uniq, inv, counts = np.unique(v, return_inverse=True, return_counts=True)
    cum = np.cumsum(counts)
    avg_rank = (cum - counts + cum - 1) / 2.0
    return avg_rank[inv] / (n - 1)


def zscores(values):
    """z-score of each value; all zeros when the spread is zero."""
    v = np.asarray(values, dtype=float).ravel()
    if v.size == 0:
        return v
    sd = float(v.std())
    if not np.isfinite(sd) or sd < 1e-12:
        return np.zeros_like(v)
    return (v - float(v.mean())) / sd


# ---------------------------------------------------------------------------
# Lexical leg: LSA (kept) and BM25 (new)
# ---------------------------------------------------------------------------

_TOKEN_RE = re.compile(r"(?u)\b\w\w+\b")

# Used only when scikit-learn is absent (its list has 318 entries).
_FALLBACK_STOPWORDS = frozenset("""
a about above after again all also am an and any are as at be because been before being below between both but by
can could did do does doing down during each few for from further had has have having he her here hers herself him
himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other
our ours ourselves out over own same she should so some such than that the their theirs them themselves then there
these they this those through to too under until up very was we were what when where which while who whom why will
with would you your yours yourself yourselves
""".split())


def _stopwords():
    return ENGLISH_STOP_WORDS if _HAVE_SKLEARN and ENGLISH_STOP_WORDS else _FALLBACK_STOPWORDS


def tokenize(text, drop_stop=True):
    toks = _TOKEN_RE.findall(str(text or '').lower())
    if drop_stop:
        stop = _stopwords()
        toks = [t for t in toks if t not in stop]
    return toks


def _term_count_matrix(texts, max_features=500):
    """Documents x vocabulary raw counts, vocabulary capped to the max_features
    most frequent terms (ties broken alphabetically so the result is stable)."""
    docs = [tokenize(t) for t in texts]
    total = {}
    for d in docs:
        for t in d:
            total[t] = total.get(t, 0) + 1
    if not total:
        return np.zeros((len(texts), 0)), []
    vocab = sorted(total, key=lambda t: (-total[t], t))[:max_features]
    vocab = sorted(vocab)
    idx = {t: i for i, t in enumerate(vocab)}
    tf = np.zeros((len(texts), len(vocab)))
    for i, d in enumerate(docs):
        for t in d:
            j = idx.get(t)
            if j is not None:
                tf[i, j] += 1.0
    return tf, vocab


def _l2_normalize_rows(m):
    norms = np.linalg.norm(m, axis=1, keepdims=True)
    norms[norms < 1e-12] = 1.0
    return m / norms


def cosine_matrix(vectors):
    """Pairwise cosine similarity of the rows of `vectors` (numpy only)."""
    m = np.asarray(vectors, dtype=float)
    if m.ndim != 2 or m.shape[0] == 0:
        return np.zeros((0, 0))
    unit = _l2_normalize_rows(m)
    return unit @ unit.T


def _lsa_numpy(texts, n_components_max=80, max_features=500):
    tf, vocab = _term_count_matrix(texts, max_features=max_features)
    n = len(texts)
    if tf.shape[1] == 0:
        return None
    df = (tf > 0).sum(axis=0)
    idf = np.log((1.0 + n) / (1.0 + df)) + 1.0          # sklearn smooth idf
    x = _l2_normalize_rows(tf * idf)
    k = min(n_components_max, n - 1, x.shape[1])
    if k < 1:
        return None
    u, s, vt = np.linalg.svd(x, full_matrices=False)
    u, s, vt = u[:, :k], s[:k], vt[:k]
    signs = np.sign(vt[np.arange(k), np.argmax(np.abs(vt), axis=1)])
    signs[signs == 0] = 1.0
    return (u * signs) * s


LAST_LSA_BACKEND = {'name': 'unset'}


def compute_lsa_similarity(texts, seed=DEFAULT_SEED, backend='auto'):
    """Compute LSA structural similarity matrix using TF-IDF + SVD.

    Ported from V4 compute_lsa_similarity and V2 compute_lsa.py.
    Uses 500 max_features (lighter than V2's 2000 -- room artifacts are smaller).

    2026: the SVD is seeded (the original TruncatedSVD was unseeded, so tied
    pair order changed between runs) and works without scikit-learn through a
    numpy path. backend: 'auto' (sklearn when installed), 'sklearn', 'numpy'.
    LAST_LSA_BACKEND records what actually ran for the provenance block.
    """
    n = len(texts)
    use_sklearn = _HAVE_SKLEARN and backend in ('auto', 'sklearn')
    if use_sklearn:
        vectorizer = TfidfVectorizer(stop_words='english', max_features=500)
        try:
            tfidf_matrix = vectorizer.fit_transform(texts)
        except ValueError:
            # Empty vocabulary
            LAST_LSA_BACKEND['name'] = 'sklearn:empty-vocabulary'
            return np.eye(n)
        n_components = min(80, n - 1, tfidf_matrix.shape[1])
        if n_components < 1:
            LAST_LSA_BACKEND['name'] = 'sklearn:degenerate'
            return np.eye(n)
        svd = TruncatedSVD(n_components=n_components, random_state=seed)
        reduced = svd.fit_transform(tfidf_matrix)
        LAST_LSA_BACKEND['name'] = 'sklearn.TruncatedSVD(random_state=%s)' % seed
    else:
        reduced = _lsa_numpy(texts)
        if reduced is None:
            LAST_LSA_BACKEND['name'] = 'numpy:degenerate'
            return np.eye(n)
        LAST_LSA_BACKEND['name'] = 'numpy.linalg.svd'
    return np.clip(cosine_matrix(reduced), 0.0, 1.0)


def compute_bm25_similarity(texts, k1=1.5, b=0.75):
    """Symmetric BM25 similarity matrix in [0, 1].

    S[i, j] is the BM25 score of document i used as the query against document
    j; it is divided by the self-score S[i, i] so a document matches itself at
    1.0, then averaged with its transpose. Empty vocabulary or a single
    document returns the identity matrix.
    """
    n = len(texts)
    tf, vocab = _term_count_matrix(texts, max_features=100000)
    if n < 2 or tf.shape[1] == 0:
        return np.eye(n)
    df = (tf > 0).sum(axis=0)
    idf = np.log(1.0 + (n - df + 0.5) / (df + 0.5))
    dl = tf.sum(axis=1)
    avgdl = float(dl.mean()) if dl.mean() > 0 else 1.0
    norm = (1.0 - b) + b * (dl / avgdl)
    w = idf * (tf * (k1 + 1.0)) / (tf + k1 * norm[:, None] + 1e-12)
    q = (tf > 0).astype(float)
    s = q @ w.T                                        # s[i, j]: query i vs doc j
    self_scores = np.diag(s).copy()
    self_scores[self_scores < 1e-12] = 1.0
    rel = s / self_scores[:, None]
    sym = 0.5 * (rel + rel.T)
    sym = np.clip(sym, 0.0, 1.0)
    np.fill_diagonal(sym, 1.0)
    return sym


# ---------------------------------------------------------------------------
# Dense leg
# ---------------------------------------------------------------------------

def make_sentence_transformer_encoder(model_name=DEFAULT_DENSE_MODEL):
    """Return encode(list[str]) -> ndarray using sentence-transformers, or None
    when the package is not installed."""
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        return None
    model = SentenceTransformer(model_name)
    return lambda items: np.asarray(model.encode(list(items), show_progress_bar=False))


def _chunk_words(text, chunk_words, max_chunks):
    words = str(text or '').split()
    if len(words) <= chunk_words:
        return [str(text or '')]
    chunks = [' '.join(words[i:i + chunk_words]) for i in range(0, len(words), chunk_words)]
    if len(chunks) > max_chunks:
        # keep an even spread across the document rather than only its head
        pick = np.linspace(0, len(chunks) - 1, max_chunks).round().astype(int)
        chunks = [chunks[i] for i in sorted(set(pick.tolist()))]
    return chunks


def embed_documents(texts, encoder, chunk_words=200, max_chunks=12):
    """Embed whole documents. MiniLM truncates at about 256 word pieces, so a
    long artifact was previously represented by its first paragraphs only.
    With chunk_words > 0 each document is split into windows, every window is
    embedded and the unit-normalised vectors are mean-pooled. chunk_words=0
    restores the original one-call-per-document behaviour."""
    if not chunk_words or chunk_words <= 0:
        return np.asarray(encoder(list(texts)), dtype=float)
    flat, owner = [], []
    for i, t in enumerate(texts):
        for c in _chunk_words(t, chunk_words, max_chunks):
            flat.append(c)
            owner.append(i)
    vecs = _l2_normalize_rows(np.asarray(encoder(flat), dtype=float))
    out = np.zeros((len(texts), vecs.shape[1]))
    for row, i in zip(vecs, owner):
        out[i] += row
    return out


def compute_semantic_similarity_tier1(texts, encoder=None, model_name=DEFAULT_DENSE_MODEL,
                                      chunk_words=200):
    """Tier 1: Local MiniLM embeddings (CPU-only, ~80MB model).

    `encoder` may be injected (tests, other models); otherwise sentence-
    transformers is used. Returns None when no encoder is available, as before.
    """
    if encoder is None:
        encoder = make_sentence_transformer_encoder(model_name)
        if encoder is None:
            return None
    embeddings = embed_documents(texts, encoder, chunk_words=chunk_words)
    return np.clip(cosine_matrix(embeddings), 0.0, 1.0)


def load_dense_vectors(path, artifact_ids):
    """Load precomputed vectors {artifact_id: [floats]} (or {"vectors": {...}}).
    Raises ValueError listing missing ids and on ragged dimensions."""
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    if isinstance(data, dict) and isinstance(data.get('vectors'), dict):
        data = data['vectors']
    if not isinstance(data, dict):
        raise ValueError("dense vectors file must be a JSON object keyed by artifact id")
    missing = [a for a in artifact_ids if a not in data]
    if missing:
        raise ValueError("dense vectors missing for %d artifact(s), first: %s" % (len(missing), missing[0]))
    rows = [np.asarray(data[a], dtype=float) for a in artifact_ids]
    dims = {r.shape for r in rows}
    if len(dims) != 1 or len(next(iter(dims))) != 1:
        raise ValueError("dense vectors have inconsistent dimensions")
    return np.vstack(rows)


def compute_semantic_similarity_tier2(artifact_ids, texts):
    """Tier 2: Pinecone embeddings from existing index.

    Falls back to Tier 1 if Pinecone not configured or query fails. The reason
    for a fallback is now printed instead of being swallowed.
    """
    api_key = os.environ.get('PINECONE_API_KEY')
    index_name = os.environ.get('PINECONE_INDEX')

    if not api_key or not index_name:
        return None  # Fall back to Tier 1

    try:
        from pinecone import Pinecone
        pc = Pinecone(api_key=api_key)
        index = pc.Index(index_name)

        vectors = {}
        for start in range(0, len(artifact_ids), 100):      # fetch() caps ids per call
            batch = artifact_ids[start:start + 100]
            fetch_result = index.fetch(ids=batch)
            got = fetch_result.get('vectors', {}) if isinstance(fetch_result, dict) \
                else getattr(fetch_result, 'vectors', {}) or {}
            vectors.update(got)

        if len(vectors) < 2:
            return None  # Not enough vectors, fall back

        embeddings = []
        for aid in artifact_ids:
            if aid not in vectors:
                print("HSI: Tier 2: no Pinecone vector for %s, falling back to Tier 1" % aid,
                      file=sys.stderr)
                return None
            v = vectors[aid]
            embeddings.append(v['values'] if isinstance(v, dict) else v.values)

        return np.clip(cosine_matrix(np.array(embeddings, dtype=float)), 0.0, 1.0)

    except Exception as exc:  # noqa: BLE001 - any client failure means fall back
        print("HSI: Tier 2 failed (%s: %s), falling back to Tier 1" % (type(exc).__name__, exc),
              file=sys.stderr)
        return None


# ---------------------------------------------------------------------------
# Claim-level evidence: problem sentence of one artifact vs method sentence of
# the other (instead of whole-document vectors)
# ---------------------------------------------------------------------------

_PROBLEM_CUES = re.compile(
    r"\b(problem|challeng|bottleneck|gap|limitation|fail|cannot|can't|unable|barrier|pain|unmet|"
    r"obstacle|constraint|risk|issue|struggl|lack|insufficient|difficult|bleed|friction)\w*", re.I)
_METHOD_CUES = re.compile(
    r"\b(approach|method|technique|algorithm|framework|solution|solv|design|architecture|propos|"
    r"apply|applies|applied|implement|mechanism|protocol|process|pipeline|strateg|using|leverag)\w*", re.I)
_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+|\n+")


def split_sentences(text, min_chars=25, max_chars=400):
    out = []
    for s in _SENT_SPLIT.split(str(text or '')):
        s = re.sub(r"^[\s>#*\-•]+", "", s).strip()
        if min_chars <= len(s) <= max_chars:
            out.append(s)
    return out


def extract_claims(text, per_kind=5):
    """Return (problem_sentences, method_sentences), at most per_kind each,
    ordered by cue count then document order. A sentence with both cues goes to
    the kind with more matches (problem on a tie)."""
    problems, methods = [], []
    for pos, s in enumerate(split_sentences(text)):
        p = len(_PROBLEM_CUES.findall(s))
        m = len(_METHOD_CUES.findall(s))
        if p == 0 and m == 0:
            continue
        if p >= m:
            problems.append((-p, pos, s))
        else:
            methods.append((-m, pos, s))
    problems.sort()
    methods.sort()
    return [s for _, _, s in problems[:per_kind]], [s for _, _, s in methods[:per_kind]]


def claim_level_scores(artifacts, pair_indices, encoder, per_kind=5):
    """For each (i, j) in pair_indices find the best cross problem/method pair.

    Returns {(i, j): {'claim_sim', 'left_sentence', 'right_sentence',
    'direction'}} where direction says which artifact supplies the problem.
    Pairs where either side has no usable claim are omitted. One batched
    encode call covers every sentence involved.
    """
    needed = sorted({k for pair in pair_indices for k in pair})
    claims = {k: extract_claims(artifacts[k]['text'], per_kind) for k in needed}
    sentences = []
    for k in needed:
        sentences.extend(claims[k][0])
        sentences.extend(claims[k][1])
    uniq = sorted(set(sentences))
    if not uniq:
        return {}
    vecs = _l2_normalize_rows(np.asarray(encoder(uniq), dtype=float))
    vec_of = {s: vecs[i] for i, s in enumerate(uniq)}
    result = {}
    for i, j in pair_indices:
        best = None
        for a, b, label in ((i, j, 'left_problem_right_method'), (j, i, 'right_problem_left_method')):
            for ps in claims[a][0]:
                for ms in claims[b][1]:
                    sim = float(vec_of[ps] @ vec_of[ms])
                    if best is None or sim > best['claim_sim'] + 1e-12:
                        best = {'claim_sim': sim, 'problem_sentence': ps, 'method_sentence': ms,
                                'problem_artifact': artifacts[a]['id'],
                                'method_artifact': artifacts[b]['id'], 'direction': label}
        if best is not None:
            best['claim_sim'] = round(max(-1.0, min(1.0, best['claim_sim'])), 4)
            result[(i, j)] = best
    return result


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


def _best_sentence(text):
    """First substantive sentence, preferring one with an integrative cue.
    Used as the extracted-sentence entry of a source trail."""
    sents = split_sentences(text, min_chars=30, max_chars=300)
    if not sents:
        return str(text or '').strip()[:200]
    for s in sents:
        if any(k in s.lower() for k in _INTEGRATIVE_KEYWORDS):
            return s
    return sents[0]


def _cross_referenced(a, b):
    """True when artifact a's text mentions b's id (path form) or title."""
    text = a['text'].lower()
    if b['id'].lower() in text:
        return True
    title = str(b.get('title', '')).strip().lower()
    return len(title) >= 4 and title in text


def compute_hsi_matrix(artifacts, lsa_matrix, semantic_matrix, threshold=0.30,
                       lexical_matrix=None, bm25_matrix=None, ranking='legacy',
                       top_k=20, min_percentile=0.0, confirm_percentile=0.75,
                       computed_at=None):
    """Compute HSI innovation differential matrix and extract top pairs.

    v1.6.0 upgrade: Uses spectral OM-HMM scores and includes spectral
    metadata (spectral_gap, dominant_mode) in pair output for downstream
    graph analysis and random walk innovation pathway discovery.

    Formula (unchanged):
    - semantic_surprise = abs(semantic_sim - lexical_sim)   (lexical_sim = lsa_sim unless a
      hybrid lexical_matrix is passed)
    - integrative_factor = sqrt(omhmm_i * omhmm_j) / 100
    - innovation_differential = 0.6 * semantic_surprise + 0.4 * integrative_factor
    - breakthrough_potential = 0.7 * differential + 0.3 * min(lexical, semantic)

    2026 selection: ranking='legacy' keeps the fixed `threshold` cut (default
    behaviour of this function, so existing callers are unchanged).
    ranking='percentile' ranks every pair by hsi_score, keeps those whose
    empirical corpus percentile is >= min_percentile, applies `threshold` only
    when it is not None, and returns the top_k. Every pair, in both modes,
    gets hsi_percentile and hsi_z computed over ALL pairs, a second-signal
    check (BM25-vs-dense surprise percentile, only when bm25_matrix is given),
    a novelty-check status and a source trail. Ties are broken by artifact
    order so the output is deterministic.
    """
    n = len(artifacts)
    texts = [a['text'] for a in artifacts]
    lex_matrix = lexical_matrix if lexical_matrix is not None else lsa_matrix
    computed_at = computed_at or datetime.now(timezone.utc).isoformat()

    # Compute spectral profiles for all artifacts
    print("HSI: computing spectral OM-HMM profiles...", file=sys.stderr)
    spectral_profiles = [compute_artifact_spectral_profile(t) for t in texts]
    omhmm_scores = np.array([p['omhmm_score'] for p in spectral_profiles], dtype=float)

    # Count spectral vs legacy
    n_spectral = sum(1 for p in spectral_profiles if p['spectral_method'] == 'markov')
    n_legacy = n - n_spectral
    print(f"HSI: {n_spectral} spectral, {n_legacy} legacy (< 5 sentences)", file=sys.stderr)

    if n < 2:
        return [], spectral_profiles

    iu, ju = np.triu_indices(n, k=1)
    lsa = np.asarray(lsa_matrix, dtype=float)[iu, ju]
    lex = np.asarray(lex_matrix, dtype=float)[iu, ju]
    sem = np.asarray(semantic_matrix, dtype=float)[iu, ju]
    surprise = np.abs(sem - lex)
    integ = np.sqrt(np.maximum(omhmm_scores[iu] * omhmm_scores[ju], 0.0)) / 100.0
    diff = 0.6 * surprise + 0.4 * integ
    breakthrough = 0.7 * diff + 0.3 * np.minimum(lex, sem)

    pct = empirical_percentile(diff)
    z = zscores(diff)

    bm25 = None
    second_pct = None
    if bm25_matrix is not None:
        bm25 = np.asarray(bm25_matrix, dtype=float)[iu, ju]
        second_surprise = np.abs(sem - bm25)
        second_pct = empirical_percentile(second_surprise)

    keep = np.ones(diff.shape, dtype=bool)
    if ranking == 'legacy':
        keep &= diff >= (0.30 if threshold is None else threshold)
    else:
        keep &= pct >= float(min_percentile)
        if threshold is not None:
            keep &= diff >= threshold
    cand = np.nonzero(keep)[0]
    # descending by the rounded score (as the original sort key), ties by pair order
    rounded = np.round(diff[cand], 4)
    order = cand[np.argsort(-rounded, kind='stable')]
    limit = top_k if top_k and top_k > 0 else len(order)
    order = order[:limit]

    pairs = []
    for rank, k in enumerate(order, start=1):
        i, j = int(iu[k]), int(ju[k])
        lsa_sim = float(lsa[k])
        sem_sim = float(sem[k])

        # Classify (retired Convention B string, kept for old readers)
        surprise_type = 'structural_transfer' if lsa_sim > sem_sim else 'semantic_implementation'

        avg_spectral_gap = (
            spectral_profiles[i]['spectral_gap'] + spectral_profiles[j]['spectral_gap']
        ) / 2.0

        pair = {
            'left_id': artifacts[i]['id'],
            'right_id': artifacts[j]['id'],
            'lsa_sim': round(lsa_sim, 4),
            'semantic_sim': round(sem_sim, 4),
            'hsi_score': round(float(diff[k]), 4),
            'surprise_type': surprise_type,
            'breakthrough_potential': round(float(breakthrough[k]), 4),
            'spectral_gap_avg': round(avg_spectral_gap, 4),
            'left_dominant_mode': spectral_profiles[i]['dominant_mode'],
            'right_dominant_mode': spectral_profiles[j]['dominant_mode'],
            # --- additive 2026 keys ---
            'rank': rank,
            'lexical_sim': round(float(lex[k]), 4),
            'hsi_percentile': round(float(pct[k]), 4),
            'hsi_z': round(float(z[k]), 4),
            'novelty_check': {
                'status': 'in_room_check_only',
                'known_in_room': bool(_cross_referenced(artifacts[i], artifacts[j])
                                      or _cross_referenced(artifacts[j], artifacts[i])),
                'external_literature': 'not_run',
            },
            'source_trail': [
                {
                    'artifact_id': artifacts[x]['id'],
                    'path': artifacts[x]['path'],
                    'content_hash': artifacts[x].get('content_hash', ''),
                    'retrieved_at': computed_at,
                    'extracted_sentence': _best_sentence(artifacts[x]['text']),
                }
                for x in (i, j)
            ],
        }
        if bm25 is not None:
            pair['bm25_sim'] = round(float(bm25[k]), 4)
            pair['second_signal'] = {
                'method': 'bm25_vs_dense_surprise',
                'surprise': round(float(abs(sem[k] - bm25[k])), 4),
                'percentile': round(float(second_pct[k]), 4),
                'confirmed': bool(second_pct[k] >= confirm_percentile),
            }
        pairs.append(pair)

    return pairs, spectral_profiles


def _pkg_version(name):
    try:
        from importlib import metadata
        return metadata.version(name)
    except Exception:  # noqa: BLE001 - version lookup is best effort
        return None


def build_arg_parser():
    parser = argparse.ArgumentParser(
        description='HSI computation pipeline for room artifacts'
    )
    parser.add_argument('room_dir', help='Path to room directory')
    parser.add_argument('--tier', type=int, choices=[1, 2], default=1,
                        help='Embedding tier: 1=MiniLM (default), 2=Pinecone')
    parser.add_argument('--threshold', type=float, default=None,
                        help='Fixed minimum HSI score. Default: 0.30 with --ranking legacy, '
                             'none with --ranking percentile (explicit value is applied in both)')
    parser.add_argument('--output', default=None,
                        help='Output JSON path (default: {room_dir}/.hsi-results.json)')
    parser.add_argument('--scope-to-nodes', action='store_true',
                        help='Score only artifacts that already exist as Artifact '
                             'nodes in <room>/.mindrian/room.db (read-only). '
                             'Degrades to scoring everything if the db is absent.')
    parser.add_argument('--lexical', choices=['hybrid', 'lsa', 'bm25'], default='hybrid',
                        help='Lexical leg: hybrid = mean(LSA, BM25) (default), lsa = the original '
                             'LSA-only behaviour, bm25 = BM25 only')
    parser.add_argument('--ranking', choices=['percentile', 'legacy'], default='percentile',
                        help='percentile (default): corpus-percentile ranking, no fixed cutoff. '
                             'legacy: fixed --threshold cut (0.30)')
    parser.add_argument('--top-k', type=int, default=20,
                        help='Number of pairs to report (default 20)')
    parser.add_argument('--min-percentile', type=float, default=0.0,
                        help='With --ranking percentile: only pairs at or above this empirical '
                             'percentile of hsi_score (0..1, default 0)')
    parser.add_argument('--confirm-percentile', type=float, default=0.75,
                        help='Percentile at which the BM25-vs-dense second signal counts as '
                             'confirming (default 0.75)')
    parser.add_argument('--claim-level', action='store_true',
                        help='Add problem-sentence vs method-sentence evidence to reported pairs '
                             '(needs a local encoder)')
    parser.add_argument('--dense-vectors', default=None,
                        help='JSON file {artifact_id: [floats]} used as the dense leg instead of an encoder')
    parser.add_argument('--model', default=DEFAULT_DENSE_MODEL,
                        help='sentence-transformers model for Tier 1 (default %s)' % DEFAULT_DENSE_MODEL)
    parser.add_argument('--seed', type=int, default=DEFAULT_SEED,
                        help='Seed for the LSA SVD (default %d)' % DEFAULT_SEED)
    parser.add_argument('--no-chunking', action='store_true',
                        help='Embed each artifact in one call (truncates long artifacts, original behaviour)')
    parser.add_argument('--allow-lexical-only', action='store_true',
                        help='If no dense leg is available, use BM25 as the comparison leg instead of '
                             'exiting with an error (recorded in metadata.semantic_leg)')
    parser.add_argument('--max-artifacts', type=int, default=3000,
                        help='Upper bound on scored artifacts (pairwise memory is quadratic); '
                             'extra artifacts are dropped deterministically and recorded')
    return parser


def _empty_result(room_dir, tier, count, now_iso, note=None):
    meta = {
        'timestamp': now_iso,
        'room_dir': str(room_dir),
        'tier': tier,
        'artifact_count': count,
        'pair_count': 0,
        'schema_version': SCHEMA_VERSION,
    }
    if note:
        meta['note'] = note
    return {'metadata': meta, 'artifacts': [], 'hsi_pairs': [], 'reverse_salients': []}


def main(argv=None):
    parser = build_arg_parser()
    args = parser.parse_args(argv)
    room_dir = Path(args.room_dir).resolve()

    if not room_dir.is_dir():
        print(f"Error: {room_dir} is not a directory", file=sys.stderr)
        sys.exit(1)
    if args.top_k < 0 or not (0.0 <= args.min_percentile <= 1.0) or not (0.0 <= args.confirm_percentile <= 1.0):
        print("Error: --top-k must be >= 0 and percentiles must be within 0..1", file=sys.stderr)
        sys.exit(1)

    output_path = args.output or str(room_dir / '.hsi-results.json')
    now_iso = datetime.now(timezone.utc).isoformat()

    # Step 1: Discover artifacts
    artifacts = discover_artifacts(room_dir)

    # Step 1b: optional intersection with the graph's own Artifact node set, so
    # scoring covers exactly the pairs hsi-to-graph.cjs can actually write.
    if args.scope_to_nodes:
        node_ids = load_graph_artifact_ids(room_dir)
        if node_ids is not None:
            discovered = len(artifacts)
            artifacts = [a for a in artifacts if a['id'] in node_ids]
            print(
                "HSI: --scope-to-nodes: %d/%d discovered artifacts exist as "
                "Artifact nodes" % (len(artifacts), discovered),
                file=sys.stderr,
            )

    warnings = []
    dropped = 0
    if args.max_artifacts and len(artifacts) > args.max_artifacts:
        dropped = len(artifacts) - args.max_artifacts
        artifacts = sorted(artifacts, key=lambda a: a['id'])[:args.max_artifacts]
        warnings.append('truncated_artifacts: %d dropped (--max-artifacts %d)' % (dropped, args.max_artifacts))
        print("HSI: warning: %s" % warnings[-1], file=sys.stderr)

    if len(artifacts) < 2:
        # Write empty results and exit
        result = _empty_result(room_dir, args.tier, len(artifacts), now_iso)
        _atomic_write_text(output_path, json.dumps(result, indent=2))
        print(f"HSI: {len(artifacts)} artifacts found (minimum 2 required), wrote empty results",
              file=sys.stderr)
        sys.exit(0)

    ranking = args.ranking
    threshold = args.threshold
    if ranking == 'legacy' and threshold is None:
        threshold = 0.30

    # Step 2: Check cache (content AND parameters AND output present)
    content_hashes = compute_content_hashes(artifacts)
    for a in artifacts:
        a['content_hash'] = content_hashes[a['id']]
    dense_sig = None
    if args.dense_vectors:
        try:
            st = os.stat(args.dense_vectors)
            dense_sig = [str(Path(args.dense_vectors).resolve()), st.st_size, int(st.st_mtime)]
        except OSError:
            dense_sig = [args.dense_vectors, None, None]
    params = {
        'tier': args.tier, 'threshold': threshold, 'ranking': ranking, 'lexical': args.lexical,
        'top_k': args.top_k, 'min_percentile': args.min_percentile,
        'confirm_percentile': args.confirm_percentile, 'claim_level': args.claim_level,
        'dense_vectors': dense_sig, 'model': args.model, 'seed': args.seed,
        'chunking': not args.no_chunking, 'allow_lexical_only': args.allow_lexical_only,
        'schema_version': SCHEMA_VERSION,
        'pinecone': bool(os.environ.get('PINECONE_INDEX')) if args.tier == 2 else False,
    }
    params_hash = params_fingerprint(params)
    if check_cache(room_dir, content_hashes, params_hash=params_hash, output_path=output_path):
        print("HSI: all artifacts unchanged and parameters identical (cache hit), skipping computation",
              file=sys.stderr)
        sys.exit(0)

    # Step 3: lexical legs (LSA is always computed: it fills lsa_sim)
    texts = [a['text'] for a in artifacts]
    print(f"HSI: computing lexical similarity (LSA + BM25) for {len(artifacts)} artifacts...",
          file=sys.stderr)
    lsa_matrix = compute_lsa_similarity(texts, seed=args.seed)
    bm25_matrix = compute_bm25_similarity(texts)
    if args.lexical == 'lsa':
        lexical_matrix = lsa_matrix
    elif args.lexical == 'bm25':
        lexical_matrix = bm25_matrix
    else:
        lexical_matrix = 0.5 * (lsa_matrix + bm25_matrix)

    # Step 4: dense (semantic) leg
    tier_used = args.tier
    semantic_matrix = None
    encoder = None
    semantic_leg = None
    dense_model = None

    if args.dense_vectors:
        try:
            dense = load_dense_vectors(args.dense_vectors, [a['id'] for a in artifacts])
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            print(f"HSI: cannot use --dense-vectors: {exc}", file=sys.stderr)
            sys.exit(1)
        semantic_matrix = np.clip(cosine_matrix(dense), 0.0, 1.0)
        semantic_leg, dense_model = 'precomputed-vectors', 'precomputed (%s)' % Path(args.dense_vectors).name
    elif args.tier == 2:
        artifact_ids = [a['id'] for a in artifacts]
        semantic_matrix = compute_semantic_similarity_tier2(artifact_ids, texts)
        if semantic_matrix is not None:
            tier_used = 2
            semantic_leg, dense_model = 'pinecone', 'pinecone index %s' % os.environ.get('PINECONE_INDEX')
            print("HSI: using Tier 2 (Pinecone) embeddings", file=sys.stderr)

    if semantic_matrix is None:
        # Tier 1 fallback
        print("HSI: using Tier 1 (%s) embeddings..." % args.model, file=sys.stderr)
        tier_used = 1
        encoder = make_sentence_transformer_encoder(args.model)
        if encoder is not None:
            semantic_matrix = compute_semantic_similarity_tier1(
                texts, encoder=encoder, chunk_words=0 if args.no_chunking else 200)
            semantic_leg, dense_model = 'sentence-transformers', args.model

    if semantic_matrix is None:
        if not args.allow_lexical_only:
            print(
                "HSI: sentence-transformers not installed. "
                "Run: pip install -r requirements-hsi.txt "
                "(or pass --dense-vectors / --allow-lexical-only)",
                file=sys.stderr
            )
            sys.exit(1)
        # Honest degraded mode: compare LSA against BM25; both are lexical.
        warnings.append('no_dense_leg: semantic_sim is BM25, lexical-only comparison (LSA vs BM25)')
        print("HSI: warning: %s" % warnings[-1], file=sys.stderr)
        semantic_matrix = bm25_matrix
        lexical_matrix = lsa_matrix
        semantic_leg, dense_model = 'lexical-bm25-proxy', None
        bm25_for_signal = None
    else:
        bm25_for_signal = bm25_matrix

    # Step 5: Compute HSI matrix and extract top pairs (with spectral profiles)
    pairs, spectral_profiles = compute_hsi_matrix(
        artifacts, lsa_matrix, semantic_matrix, threshold=threshold,
        lexical_matrix=lexical_matrix, bm25_matrix=bm25_for_signal, ranking=ranking,
        top_k=args.top_k, min_percentile=args.min_percentile,
        confirm_percentile=args.confirm_percentile, computed_at=now_iso,
    )

    # Step 5b: claim-level evidence on the reported pairs only
    claim_status = 'not_requested'
    if args.claim_level:
        if encoder is None:
            claim_status = 'skipped_no_encoder'
            warnings.append('claim_level skipped: needs a local sentence encoder (not --dense-vectors / Tier 2)')
            print("HSI: warning: %s" % warnings[-1], file=sys.stderr)
        else:
            idx_of = {a['id']: i for i, a in enumerate(artifacts)}
            wanted = [(idx_of[p['left_id']], idx_of[p['right_id']]) for p in pairs]
            scored = claim_level_scores(artifacts, wanted, encoder)
            iu, ju = np.triu_indices(len(artifacts), k=1)
            sem_all = np.asarray(semantic_matrix)[iu, ju]
            support_cut = float(np.percentile(sem_all, 75)) if sem_all.size else 1.0
            for p, key in zip(pairs, wanted):
                hit = scored.get(key)
                if hit is None:
                    p['claim_level'] = {'status': 'no_problem_method_sentences'}
                    continue
                p['claim_level'] = {
                    'status': 'ok',
                    'claim_sim': hit['claim_sim'],
                    'direction': hit['direction'],
                    'problem_artifact': hit['problem_artifact'],
                    'method_artifact': hit['method_artifact'],
                    'problem_sentence': hit['problem_sentence'],
                    'method_sentence': hit['method_sentence'],
                    'supported': bool(hit['claim_sim'] >= support_cut),
                    'support_cut': round(support_cut, 4),
                    'support_cut_basis': 'corpus 75th percentile of semantic_sim',
                }
                for trail in p['source_trail']:
                    if trail['artifact_id'] == hit['problem_artifact']:
                        trail['extracted_sentence'], trail['role'] = hit['problem_sentence'], 'problem'
                    elif trail['artifact_id'] == hit['method_artifact']:
                        trail['extracted_sentence'], trail['role'] = hit['method_sentence'], 'method'
            claim_status = 'ok'

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
            'timestamp': now_iso,
            'room_dir': str(room_dir),
            'tier': tier_used,
            'artifact_count': len(artifacts),
            'pair_count': len(pairs),
            'spectral_version': '1.6.0',
            'schema_version': SCHEMA_VERSION,
            'spectral_summary': {
                'mean_omhmm': round(sum(spectral_scores) / len(spectral_scores), 2) if spectral_scores else 0,
                'mean_spectral_gap': round(sum(spectral_gaps) / len(spectral_gaps), 4) if spectral_gaps else 0,
                'dominant_mode_distribution': mode_counts,
                'spectral_artifacts': len(spectral_gaps),
                'legacy_artifacts': len(spectral_scores) - len(spectral_gaps),
            },
            'ranking': {
                'method': ranking,
                'fixed_threshold': threshold,
                'min_percentile': args.min_percentile,
                'top_k': args.top_k,
                'pairs_scored': len(artifacts) * (len(artifacts) - 1) // 2,
                'basis': ('empirical percentile and z-score of hsi_score over all scored pairs'
                          if ranking == 'percentile' else 'fixed hsi_score threshold'),
            },
            'provenance': {
                'computed_at': now_iso,
                'script': 'compute-hsi.py',
                'lexical_leg': args.lexical if semantic_leg != 'lexical-bm25-proxy' else 'lsa',
                'lsa_backend': LAST_LSA_BACKEND['name'],
                'lsa_params': {'max_features': 500, 'max_components': 80, 'stop_words': 'english', 'seed': args.seed},
                'bm25_params': {'k1': 1.5, 'b': 0.75},
                'semantic_leg': semantic_leg,
                'dense_model': dense_model,
                'dense_chunking': (not args.no_chunking) if semantic_leg == 'sentence-transformers' else None,
                'claim_level': claim_status,
                'cache_params_hash': params_hash,
                'versions': {'python': sys.version.split()[0], 'numpy': np.__version__,
                             'scikit-learn': _pkg_version('scikit-learn'),
                             'sentence-transformers': _pkg_version('sentence-transformers')},
                'warnings': warnings,
            },
        },
        'artifacts': artifact_list,
        'hsi_pairs': pairs,
        'reverse_salients': [],  # Populated by detect-reverse-salients.py
    }

    _atomic_write_text(output_path, json.dumps(result, indent=2))

    # Update cache
    write_cache(room_dir, content_hashes, params_hash=params_hash)

    # Summary to stderr
    top_score = pairs[0]['hsi_score'] if pairs else 0.0
    print(
        f"HSI: {len(pairs)} pairs found (top score: {top_score:.3f}), "
        f"tier {tier_used}, {len(artifacts)} artifacts",
        file=sys.stderr
    )


if __name__ == '__main__':
    main()
