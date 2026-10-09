#!/usr/bin/env python3
"""
differential_analysis.py  (Jason v3.1)

Computes DESCRIPTIVE diagnostics for pairs of texts. It does NOT score innovation.

Legacy metrics (unchanged keys, unchanged meaning)
  lexical_jaccard  : Jaccard overlap of content-word sets
  semantic_cosine  : cosine of sentence embeddings (all-MiniLM-L6-v2) when
                     sentence-transformers is installed; otherwise a char n-gram
                     cosine, which is a surface-similarity proxy and is labeled so
  gap              : semantic - lexical. HIGH gap = "same meaning, different words",
                     the signature of a paraphrase. A restatement warning, never an
                     innovation signal.
  restatement_warning : legacy fixed rule (semantic >= 0.6 and lexical <= 0.2)
  buzzword_heuristic  : hype-lexicon hits. Heuristic only.

Added in v3.1 (hybrid mode, default)
  lexical_tfidf_cosine : TF-IDF cosine over content words, IDF fitted on the corpus
                         of all texts in the input file (BM25-style smoothing)
  claim_level          : best-matching sentence pair (sentence of a vs sentence of b)
                         and the mean best-match score, so one sentence is compared
                         with one sentence, not whole abstracts
  corpus_rank          : empirical percentile and z-score of gap, semantic and lexical
                         against the pairs in the same input file. Reported as null
                         with a reason when fewer than MIN_PAIRS_FOR_PERCENTILE pairs
                         exist; no fixed cutoff is applied in this block
  restatement_warning_percentile : gap percentile >= 90 and lexical percentile <= 25
  second_signal        : whether an independent signal agrees with the flag
  novelty_check        : always "not_performed" (needs an external corpus search)
  source_trail         : id, source, url, retrieved and the two extracted sentences
  provenance           : tool version, model, method, parameters, input hash, time

Usage
  python3 differential_analysis.py input.json [--legacy] [--no-timestamp]
  input.json = {"pairs": [{"id": "p1", "a": "text A", "b": "text B",
                           "source": "optional id", "url": "optional",
                           "retrieved": "optional YYYY-MM-DD"}],
                "texts": [{"id": "t1", "text": "free text to lexicon-check"}]}
  --legacy        emit only the v3 keys (no v3.1 additions)
  --no-timestamp  omit the wall-clock time from provenance (byte-identical reruns)
Output: JSON on stdout. Invalid items are listed under "errors" and exit code is 2.
Deterministic: no randomness; ties are broken by input order.
"""
import hashlib
import json
import math
import re
import sys
from collections import Counter
from datetime import datetime, timezone

VERSION = "3.1.0"
MIN_PAIRS_FOR_PERCENTILE = 5
MAX_PAIRS = 5000
MAX_TEXT_CHARS = 200000
MAX_SENTENCES = 40          # per side, bounds the claim-level pair matrix
BM25_K1 = 1.2
BM25_B = 0.75
PCT_GAP_HIGH = 90.0
PCT_LEX_LOW = 25.0

STOP = set("""a an the and or but if then of to in on for with by at from as is are was were be been being
this that these those it its we you they he she i our your their not no can could should would will may might
have has had do does did so than too very just also into over under about more most such other""".split())

# two-letter terms that carry meaning in this domain and must not be dropped by len > 2
KEEP_SHORT = {"ai", "ml", "ip"}

BUZZ = ["quantum", "holistic", "synergy", "paradigm", "disruptive", "revolutionary", "blockchain",
        "energy field", "detox", "vibration", "frequency healing", "ai-powered", "game-changing",
        "next-generation", "cutting-edge", "seamless", "ecosystem", "leverage", "unlock"]
_BUZZ_RE = [(w, re.compile(r"(?<![a-z0-9])" + re.escape(w))) for w in BUZZ]


def tokens(text):
    words = re.findall(r"[a-z0-9]+", (text or "").lower())
    return [w for w in words if w not in STOP and (len(w) > 2 or w in KEEP_SHORT)]


def jaccard(a, b):
    sa, sb = set(tokens(a)), set(tokens(b))
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def _ngrams(text, n=3):
    t = re.sub(r"\s+", " ", (text or "").lower())
    return Counter(t[i:i + n] for i in range(max(len(t) - n + 1, 0)))


def _cos_counter(x, y):
    dot = sum(x[k] * y.get(k, 0) for k in x)
    nx = math.sqrt(sum(v * v for v in x.values()))
    ny = math.sqrt(sum(v * v for v in y.values()))
    return dot / (nx * ny) if nx and ny else 0.0


# ---------------------------------------------------------------- sentences
_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(\[])|\n+")


def sentences(text, limit=MAX_SENTENCES):
    """Split into sentences; drop fragments with no content word; bounded."""
    parts = [s.strip() for s in _SENT_SPLIT.split(text or "") if s and s.strip()]
    parts = [s for s in parts if tokens(s)]
    return parts[:limit]


# ---------------------------------------------------------------- embeddings
_MODEL = None
_METHOD = None
_MODEL_ERROR = None
_EMB_CACHE = {}
MODEL_NAME = "all-MiniLM-L6-v2"
FALLBACK_METHOD = "fallback_char_ngram_cosine (surface proxy, NOT semantic)"


def _load_model():
    """Load the dense model once. The failure reason is kept, not swallowed."""
    global _MODEL, _METHOD, _MODEL_ERROR
    if _METHOD is not None:
        return
    try:
        from sentence_transformers import SentenceTransformer
        _MODEL = SentenceTransformer(MODEL_NAME)
        _METHOD = "sentence-transformers/" + MODEL_NAME
        _MODEL_ERROR = None
    except Exception as exc:  # reported in provenance.model_load_error
        _MODEL = None
        _METHOD = FALLBACK_METHOD
        _MODEL_ERROR = "%s: %s" % (type(exc).__name__, str(exc)[:200])


def dense_available():
    _load_model()
    return _MODEL is not None


def _dense_vectors(texts):
    """Return normalized vectors as plain lists; cached by text."""
    missing = [t for t in dict.fromkeys(texts) if t not in _EMB_CACHE]
    if missing:
        arr = _MODEL.encode(missing, normalize_embeddings=True)
        for t, v in zip(missing, arr):
            _EMB_CACHE[t] = [float(x) for x in v]
    return [_EMB_CACHE[t] for t in texts]


def _dot(u, v):
    return sum(x * y for x, y in zip(u, v))


def semantic(a, b):
    _load_model()
    if _MODEL is not None:
        ea, eb = _dense_vectors([a, b])
        return float(_dot(ea, eb)), _METHOD
    return _cos_counter(_ngrams(a), _ngrams(b)), _METHOD


def sim_matrix(list_a, list_b):
    """Sentence-level similarity matrix using the active semantic method."""
    _load_model()
    if _MODEL is not None:
        va, vb = _dense_vectors(list_a), _dense_vectors(list_b)
        return [[_dot(x, y) for y in vb] for x in va]
    na = [_ngrams(s) for s in list_a]
    nb = [_ngrams(s) for s in list_b]
    return [[_cos_counter(x, y) for y in nb] for x in na]


# ---------------------------------------------------------------- tf-idf / bm25-style
class Idf:
    """Smoothed IDF fitted on a document list (BM25 form, never negative)."""

    def __init__(self, docs):
        self.n = len(docs)
        df = Counter()
        for d in docs:
            df.update(set(tokens(d)))
        self.idf = {t: math.log(1.0 + (self.n - c + 0.5) / (c + 0.5)) for t, c in df.items()}
        self.default = math.log(1.0 + (self.n + 0.5) / 0.5)   # unseen term: rarest

    def vec(self, text):
        tf = Counter(tokens(text))
        if not tf:
            return {}
        return {t: ((c * (BM25_K1 + 1)) / (c + BM25_K1)) * self.idf.get(t, self.default)
                for t, c in tf.items()}


def tfidf_cosine(idf, a, b):
    return _cos_counter(idf.vec(a), idf.vec(b))


# ---------------------------------------------------------------- buzzwords
def buzz(text):
    t = (text or "").lower()
    hits, occ = [], 0
    for w, rx in _BUZZ_RE:
        n = len(rx.findall(t))
        if n:
            hits.append(w)
            occ += n
    return {"count": len(hits), "hits": hits, "occurrences": occ}


# ---------------------------------------------------------------- statistics
def percentile_rank(values, x):
    """Empirical percentile in [0,100]: (less + 0.5*equal) / n."""
    n = len(values)
    if n == 0:
        return None
    less = sum(1 for v in values if v < x)
    eq = sum(1 for v in values if v == x)
    return 100.0 * (less + 0.5 * eq) / n


def zscore(values, x):
    n = len(values)
    if n < 2:
        return None
    mean = sum(values) / n
    var = sum((v - mean) ** 2 for v in values) / (n - 1)
    sd = math.sqrt(var)
    return None if sd < 1e-12 else (x - mean) / sd


def _r(x, nd=3):
    return None if x is None else round(float(x), nd)


# ---------------------------------------------------------------- pair analysis
def _legacy_pair(p):
    lex = jaccard(p["a"], p["b"])
    sem, method = semantic(p["a"], p["b"])
    return lex, sem, method


def analyze_pair(p):
    """Legacy v3 result. Signature and keys unchanged."""
    lex, sem, method = _legacy_pair(p)
    gap = sem - lex
    return {
        "id": p.get("id"),
        "lexical_jaccard": round(lex, 3),
        "semantic_cosine": round(sem, 3),
        "semantic_method": method,
        "gap": round(gap, 3),
        "restatement_warning": bool(sem >= 0.6 and lex <= 0.2),
        "note": "gap is a paraphrase detector, not an innovation score",
    }


def claim_level(idf, a, b):
    sa, sb = sentences(a), sentences(b)
    if not sa or not sb:
        return {"status": "no_sentences", "sentences_a": len(sa), "sentences_b": len(sb)}
    sm = sim_matrix(sa, sb)
    best_i = best_j = 0
    best = -2.0
    for i, row in enumerate(sm):
        for j, v in enumerate(row):
            if v > best:           # strict > keeps the earliest pair on ties
                best, best_i, best_j = v, i, j
    mean_best = sum(max(row) for row in sm) / len(sm)
    return {
        "status": "ok",
        "sentences_a": len(sa), "sentences_b": len(sb),
        "best_pair": {
            "a_sentence": sa[best_i], "b_sentence": sb[best_j],
            "semantic": _r(best),
            "lexical_tfidf_cosine": _r(tfidf_cosine(idf, sa[best_i], sb[best_j])),
            "lexical_jaccard": _r(jaccard(sa[best_i], sb[best_j])),
        },
        "mean_best_match_semantic": _r(mean_best),
    }


def _validate_pair(p, idx):
    if not isinstance(p, dict):
        return "pairs[%d] is not an object" % idx
    for k in ("a", "b"):
        if not isinstance(p.get(k), str):
            return "pairs[%d] (%s) key '%s' missing or not a string" % (idx, p.get("id"), k)
    return None


def _clip(s, warnings, label):
    if len(s) > MAX_TEXT_CHARS:
        warnings.append("%s truncated from %d to %d chars" % (label, len(s), MAX_TEXT_CHARS))
        return s[:MAX_TEXT_CHARS]
    return s


def analyze_corpus(data, legacy=False, timestamp=True, input_bytes=b""):
    errors, warnings = [], []
    raw_pairs = data.get("pairs", []) if isinstance(data, dict) else []
    raw_texts = data.get("texts", []) if isinstance(data, dict) else []
    if not isinstance(data, dict):
        errors.append("top-level JSON must be an object")
    if not isinstance(raw_pairs, list):
        errors.append("'pairs' must be a list")
        raw_pairs = []
    if not isinstance(raw_texts, list):
        errors.append("'texts' must be a list")
        raw_texts = []
    if len(raw_pairs) > MAX_PAIRS:
        warnings.append("pairs truncated from %d to %d" % (len(raw_pairs), MAX_PAIRS))
        raw_pairs = raw_pairs[:MAX_PAIRS]

    pairs = []
    for i, p in enumerate(raw_pairs):
        err = _validate_pair(p, i)
        if err:
            errors.append(err)
            continue
        q = dict(p)
        q["a"] = _clip(p["a"], warnings, "pairs[%d].a" % i)
        q["b"] = _clip(p["b"], warnings, "pairs[%d].b" % i)
        pairs.append(q)

    texts = []
    for i, t in enumerate(raw_texts):
        if not isinstance(t, dict) or not isinstance(t.get("text"), str):
            errors.append("texts[%d] must be an object with a string 'text'" % i)
            continue
        texts.append({"id": t.get("id"), "text": _clip(t["text"], warnings, "texts[%d]" % i)})

    legacy_rows = [analyze_pair(p) for p in pairs]
    buzz_rows = [{"id": t["id"], **buzz(t["text"])} for t in texts]
    out = {
        "pairs": legacy_rows,
        "buzzword_heuristic": buzz_rows,
        "label": "Descriptive diagnostics only. Heuristic fields are heuristics.",
    }

    if not legacy:
        corpus_docs = [p["a"] for p in pairs] + [p["b"] for p in pairs] + [t["text"] for t in texts]
        idf = Idf(corpus_docs) if corpus_docs else Idf([""])
        gaps = [r["gap"] for r in legacy_rows]
        sems = [r["semantic_cosine"] for r in legacy_rows]
        lexs = [r["lexical_jaccard"] for r in legacy_rows]
        n = len(legacy_rows)
        enough = n >= MIN_PAIRS_FOR_PERCENTILE
        dense = dense_available()
        for p, row in zip(pairs, legacy_rows):
            row["lexical_tfidf_cosine"] = _r(tfidf_cosine(idf, p["a"], p["b"]))
            row["claim_level"] = claim_level(idf, p["a"], p["b"])
            if enough:
                gp = percentile_rank(gaps, row["gap"])
                lp = percentile_rank(lexs, row["lexical_jaccard"])
                row["corpus_rank"] = {
                    "status": "ok", "n_pairs": n,
                    "gap_percentile": _r(gp, 1), "gap_z": _r(zscore(gaps, row["gap"])),
                    "semantic_percentile": _r(percentile_rank(sems, row["semantic_cosine"]), 1),
                    "lexical_percentile": _r(lp, 1),
                }
                flag = bool(gp >= PCT_GAP_HIGH and lp <= PCT_LEX_LOW)
                row["restatement_warning_percentile"] = flag
            else:
                row["corpus_rank"] = {
                    "status": "insufficient_corpus", "n_pairs": n,
                    "reason": "need at least %d pairs for an empirical percentile; no fixed cutoff substituted"
                              % MIN_PAIRS_FOR_PERCENTILE,
                    "gap_percentile": None, "gap_z": None,
                    "semantic_percentile": None, "lexical_percentile": None,
                }
                row["restatement_warning_percentile"] = None
            row["second_signal"] = _second_signal(row, dense)
            row["novelty_check"] = {
                "status": "not_performed",
                "reason": "needs a search of an external corpus; this script is descriptive only",
            }
            row["source_trail"] = {
                "id": p.get("id"), "source": p.get("source"), "url": p.get("url"),
                "retrieved": p.get("retrieved"),
                "a_sentence": (row["claim_level"].get("best_pair") or {}).get("a_sentence"),
                "b_sentence": (row["claim_level"].get("best_pair") or {}).get("b_sentence"),
            }
        # deterministic ranking by gap percentile proxy (gap), ties by input order
        order = sorted(range(n), key=lambda i: (-legacy_rows[i]["gap"], i))
        out["ranking_by_gap"] = [
            {"rank": r + 1, "id": legacy_rows[i]["id"], "gap": legacy_rows[i]["gap"]}
            for r, i in enumerate(order)
        ]
        out["provenance"] = _provenance(timestamp, input_bytes, n, len(texts))

    out["errors"] = errors
    out["warnings"] = warnings
    return out


def _second_signal(row, dense):
    """An independent check on the restatement flag.

    Dense cosine vs TF-IDF cosine are different representations. A restatement
    needs high meaning overlap AND low weighted-word overlap. Without a dense
    model the 'semantic' value is itself a character-level proxy, so no second
    signal can be claimed.
    """
    if not dense:
        return {"status": "unavailable_no_dense_model",
                "detail": "semantic_cosine is a char n-gram proxy, not independent of lexical overlap"}
    flagged = row["restatement_warning"]
    tf = row["lexical_tfidf_cosine"]
    best = (row.get("claim_level") or {}).get("best_pair")
    claim_sem = best["semantic"] if best else None
    agrees = (tf is not None and tf <= 0.35) and (claim_sem is not None and claim_sem >= 0.6)
    return {"status": "agrees" if agrees == flagged else "disagrees",
            "detail": "tfidf_cosine=%s, best_claim_semantic=%s, flag=%s" % (tf, claim_sem, flagged)}


def _provenance(timestamp, input_bytes, n_pairs, n_texts):
    _load_model()
    return {
        "tool": "differential_analysis.py",
        "version": VERSION,
        "semantic_method": _METHOD,
        "model": MODEL_NAME if _MODEL is not None else None,
        "model_load_error": _MODEL_ERROR,
        "lexical": "jaccard over content words; tf-idf cosine with BM25-style saturation (k1=%s) and smoothed idf"
                   % BM25_K1,
        "parameters": {
            "min_pairs_for_percentile": MIN_PAIRS_FOR_PERCENTILE,
            "percentile_flag": {"gap_pct_at_least": PCT_GAP_HIGH, "lexical_pct_at_most": PCT_LEX_LOW},
            "legacy_fixed_rule": {"semantic_at_least": 0.6, "lexical_at_most": 0.2},
            "max_sentences_per_side": MAX_SENTENCES, "max_text_chars": MAX_TEXT_CHARS,
        },
        "deterministic": True,
        "input_sha256": hashlib.sha256(input_bytes).hexdigest() if input_bytes else None,
        "n_pairs": n_pairs, "n_texts": n_texts,
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if timestamp else None,
    }


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    flags = {a for a in argv if a.startswith("--")}
    args = [a for a in argv if not a.startswith("--")]
    unknown = flags - {"--legacy", "--no-timestamp"}
    if not args or unknown:
        if unknown:
            sys.stderr.write("unknown option(s): %s\n" % ", ".join(sorted(unknown)))
        print(__doc__)
        return 1
    try:
        with open(args[0], "rb") as f:
            raw = f.read()
        data = json.loads(raw.decode("utf-8-sig"))
    except (OSError, ValueError) as exc:
        sys.stderr.write("cannot read input %s: %s\n" % (args[0], exc))
        return 1
    out = analyze_corpus(data, legacy="--legacy" in flags, timestamp="--no-timestamp" not in flags,
                         input_bytes=raw)
    if "--legacy" in flags:
        # keep the v3 shape exactly; errors still surface on stderr
        errs = out.pop("errors")
        out.pop("warnings", None)
        for e in errs:
            sys.stderr.write("error: %s\n" % e)
        print(json.dumps(out, indent=2))
        return 2 if errs else 0
    for e in out["errors"]:
        sys.stderr.write("error: %s\n" % e)
    print(json.dumps(out, indent=2))
    return 2 if out["errors"] else 0


if __name__ == "__main__":
    sys.exit(main())
