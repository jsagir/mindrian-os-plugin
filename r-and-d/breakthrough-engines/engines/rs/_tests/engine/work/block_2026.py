# --- 2026 hybrid scoring -----------------------------------------------------
#
# Why this exists (see rs/CHANGES-engine.md): the legacy detector ranks pairs by
# abs(semantic - lsa) on RAW values. The two matrices live on different scales
# (the LSA matrix is rescaled to be centred at 0.5, embedding cosines are not),
# so the raw gap mostly measures the scale mismatch, and a fixed cutoff such as
# 0.30 means different things on every corpus. The hybrid scorer instead:
#   1. builds a structural signal from two lexical views (the legacy topic
#      membership LSA and a BM25-weighted cosine),
#   2. builds a dense signal from embeddings,
#   3. converts each to an empirical percentile over the corpus pair
#      distribution (scale free, deterministic) and takes the rank gap,
#   4. keeps pairs whose gap is in the top (1 - min_percentile) of the corpus.
# The legacy path stays selectable with --scoring legacy.
# Ranking is pure code and deterministic; no LLM is involved in ranking.

SCORING_HYBRID = "hybrid"
SCORING_LEGACY = "legacy"
SCHEMA_2026 = "2026.1"
DEFAULT_SCORING = SCORING_HYBRID
DEFAULT_MIN_PERCENTILE = 0.90
DEFAULT_LEX_WEIGHT = 0.5
SEED = 256
VERIFY_MAX_PAIRS = 200          # bound claim-level work per run
CLAIM_MAX_SENTENCES = 30        # per document
HASH_DIM = 256
HASH_MODEL_NAME = "hashing-ngram-256"


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        print(f"rs-engine: ignoring non-integer {name}={raw!r}", file=sys.stderr)
        return default
    return value if value > 0 else default


MAX_ARTIFACTS = _env_int("RS_MAX_ARTIFACTS", 3000)

# Mutable run configuration; main() overwrites it from the CLI. Library callers
# that import run_mode_* directly get the documented defaults.
SCORING_CFG: Dict[str, Any] = {
    "scoring": DEFAULT_SCORING,
    "min_percentile": DEFAULT_MIN_PERCENTILE,
    "lex_weight": DEFAULT_LEX_WEIGHT,
    "verify": True,
}

# Pairs reported by a previous run at the same output path (novelty check).
_PRIOR_PAIR_KEYS: set = set()

_STOPWORDS = frozenset(
    "a about above after again all also am an and any are as at be because been "
    "before being below between both but by can could did do does doing down "
    "during each few for from further had has have having he her here hers him "
    "his how i if in into is it its just may me more most my no nor not of off "
    "on once only or other our out over own same she should so some such than "
    "that the their them then there these they this those through to too under "
    "until up very was we were what when where which while who whom why will "
    "with would you your".split()
)
_TOKEN_RE = re.compile(r"[^\W_]{2,}", re.UNICODE)
_SENT_SPLIT_RE = re.compile(r"(?<=[.!?])\s+|\n+")
_PROBLEM_CUE_RE = re.compile(
    r"\b(problem|challenge|limitation|limited|bottleneck|fails?|failure|lack|"
    r"lacks|cannot|can't|unable|difficult|difficulty|gap|barrier|obstacle|"
    r"unsolved|struggle|struggles|constraint|risk|need|needs|pain)\b",
    re.IGNORECASE,
)
_METHOD_CUE_RE = re.compile(
    r"\b(we propose|propose|approach|method|technique|algorithm|framework|"
    r"model|using|uses|use|design|protocol|architecture|solution|solve|solves|"
    r"mechanism|process|procedure|apply|applies|implement|implements|built)\b",
    re.IGNORECASE,
)


def tokenize(text: str) -> List[str]:
    """Unicode-aware lowercase tokenizer (works for Hebrew and English)."""
    return [t for t in _TOKEN_RE.findall((text or "").lower()) if t not in _STOPWORDS]


def bm25_similarity_matrix(
    texts: Sequence[str],
    k1: float = 1.5,
    b: float = 0.75,
    max_features: int = 5000,
) -> np.ndarray:
    """BM25-weighted, L2-normalised document vectors -> cosine matrix in [0, 1].

    Deterministic: vocabulary is ordered by (document frequency desc, term asc).
    Memory is bounded by n_docs * max_features float32 values.
    """
    n = len(texts)
    if n == 0:
        return np.zeros((0, 0), dtype=np.float32)
    docs = [tokenize(t) for t in texts]
    df: Dict[str, int] = {}
    for toks in docs:
        for w in set(toks):
            df[w] = df.get(w, 0) + 1
    ranked = sorted(df.items(), key=lambda kv: (-kv[1], kv[0]))[:max_features]
    index = {w: i for i, (w, _) in enumerate(ranked)}
    v = len(index)
    if v == 0:
        return np.eye(n, dtype=np.float32)
    idf = np.array(
        [np.log(1.0 + (n - c + 0.5) / (c + 0.5)) for _, c in ranked], dtype=np.float64
    )
    dl = np.array([len(d) for d in docs], dtype=np.float64)
    avgdl = float(dl.mean()) or 1.0
    w_mat = np.zeros((n, v), dtype=np.float32)
    for i, toks in enumerate(docs):
        counts: Dict[int, int] = {}
        for w in toks:
            j = index.get(w)
            if j is not None:
                counts[j] = counts.get(j, 0) + 1
        for j, tf in counts.items():
            denom = tf + k1 * (1.0 - b + b * dl[i] / avgdl)
            w_mat[i, j] = idf[j] * tf * (k1 + 1.0) / denom
    norms = np.linalg.norm(w_mat, axis=1)
    norms[norms == 0.0] = 1.0
    w_mat /= norms[:, None]
    sim = w_mat @ w_mat.T
    return np.clip(sim, 0.0, 1.0).astype(np.float32)


def cosine_matrix(embeddings: np.ndarray, clip: bool = False) -> np.ndarray:
    """Cosine similarity with a zero-norm guard (numpy only, no sklearn)."""
    e = np.asarray(embeddings, dtype=np.float64)
    if e.ndim != 2 or e.shape[0] == 0:
        return np.zeros((0, 0), dtype=np.float32)
    norms = np.linalg.norm(e, axis=1)
    norms = np.where(norms == 0.0, 1.0, norms)
    e = e / norms[:, None]
    sim = e @ e.T
    if clip:
        sim = np.clip(sim, 0.0, 1.0)
    return sim.astype(np.float32)


def _embed_hashing(texts: Sequence[str], dim: int = HASH_DIM) -> np.ndarray:
    """Dependency-free, deterministic feature-hashing embedder.

    This is a LEXICAL surrogate (word + char-trigram hashing). It is NOT a
    semantic model. It exists so the engine can run offline and so tests are
    reproducible. Anything it produces is flagged dense_degraded in the output.
    """
    out = np.zeros((len(texts), dim), dtype=np.float32)
    for r, text in enumerate(texts):
        toks = tokenize(text)
        feats: List[str] = list(toks)
        for t in toks:
            padded = f"#{t}#"
            feats.extend(padded[k:k + 3] for k in range(max(1, len(padded) - 2)))
        for f in feats:
            h = int(hashlib.md5(f.encode("utf-8")).hexdigest()[:8], 16)
            out[r, h % dim] += 1.0 if (h >> 31) & 1 else -1.0
    return out


def percentile_rank_matrix(matrix: np.ndarray) -> np.ndarray:
    """Empirical percentile (0..1, average rank for ties) of every off-diagonal
    entry, computed over the upper-triangle distribution. Returns a symmetric
    matrix with a zero diagonal. Deterministic, scale free."""
    m = np.nan_to_num(np.asarray(matrix, dtype=np.float64))
    n = m.shape[0]
    out = np.zeros((n, n), dtype=np.float64)
    if n < 2:
        return out
    iu = np.triu_indices(n, k=1)
    vals = m[iu]
    count = vals.size
    if count == 1:
        out[iu] = 1.0
        return out + out.T
    order = np.argsort(vals, kind="mergesort")
    sorted_vals = vals[order]
    _uniq, inverse, counts = np.unique(sorted_vals, return_inverse=True, return_counts=True)
    cum = np.cumsum(counts)
    avg_rank = (cum - counts + cum - 1) / 2.0
    ranks = np.empty(count, dtype=np.float64)
    ranks[order] = avg_rank[inverse]
    out[iu] = ranks / (count - 1)
    return out + out.T


def _split_sentences(text: str) -> List[str]:
    sents: List[str] = []
    for raw in _SENT_SPLIT_RE.split(text or ""):
        s = re.sub(r"^[#>\-\*\s\d\.\)]+", "", raw.strip())
        if 25 <= len(s) <= 400:
            sents.append(s)
        if len(sents) >= CLAIM_MAX_SENTENCES:
            break
    return sents


def _shingle_jaccard(a: str, b: str, size: int = 3, limit: int = 2000) -> float:
    ta, tb = tokenize(a[:limit]), tokenize(b[:limit])
    sa = {tuple(ta[i:i + size]) for i in range(max(0, len(ta) - size + 1))}
    sb = {tuple(tb[i:i + size]) for i in range(max(0, len(tb) - size + 1))}
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / float(len(sa | sb))


def _art_key(art: Dict) -> str:
    return str(art.get("global_id") or art.get("id") or "")


def _pair_key(a: Dict, b: Dict) -> str:
    return "||".join(sorted([_art_key(a), _art_key(b)]))


def _load_prior_pairs(path: Optional[Path]) -> set:
    """Read pair keys from a previous results file at the output path."""
    keys: set = set()
    if not path:
        return keys
    try:
        if not path.exists():
            return keys
        prior = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(f"rs-engine: prior results unreadable, novelty history skipped: {e}", file=sys.stderr)
        return keys
    for p in prior.get("pairs", []) if isinstance(prior, dict) else []:
        a, b = p.get("source_artifact_id"), p.get("target_artifact_id")
        if a and b:
            keys.add("||".join(sorted([str(a), str(b)])))
    return keys


class PairScorer:
    """Scores artifact pairs from the three matrices and builds the
    verification block. One instance per run."""

    def __init__(
        self,
        texts: Sequence[str],
        lsa: np.ndarray,
        sem: np.ndarray,
        model_used: str,
        dense_degraded: bool,
        embed_fn=None,
    ) -> None:
        self.scoring = SCORING_CFG.get("scoring", DEFAULT_SCORING)
        self.min_percentile = float(SCORING_CFG.get("min_percentile", DEFAULT_MIN_PERCENTILE))
        self.lex_weight = float(SCORING_CFG.get("lex_weight", DEFAULT_LEX_WEIGHT))
        self.verify = bool(SCORING_CFG.get("verify", True))
        self.model_used = model_used
        self.dense_degraded = bool(dense_degraded)
        self.embed_fn = embed_fn
        self.lsa = np.asarray(lsa, dtype=np.float64)
        self.sem = np.asarray(sem, dtype=np.float64)
        self.n = self.lsa.shape[0]
        self.lex = bm25_similarity_matrix(texts).astype(np.float64)
        self.p_lsa = percentile_rank_matrix(self.lsa)
        self.p_lex = percentile_rank_matrix(self.lex)
        self.p_sem = percentile_rank_matrix(self.sem)
        self.p_struct = (1.0 - self.lex_weight) * self.p_lsa + self.lex_weight * self.p_lex
        self.rank_signed = self.p_sem - self.p_struct
        self.rank_abs = np.abs(self.rank_signed)
        self.p_gap = percentile_rank_matrix(self.rank_abs)
        if self.n >= 2:
            tri = self.rank_abs[np.triu_indices(self.n, k=1)]
            self._gap_mean = float(tri.mean())
            self._gap_std = float(tri.std())
        else:
            self._gap_mean, self._gap_std = 0.0, 0.0
        self._sent_cache: Dict[str, Tuple[List[str], Optional[np.ndarray]]] = {}
        self._verified = 0
        self.computed_at = datetime.now(timezone.utc).isoformat()

    # -- selection ----------------------------------------------------------
    def topk(self, k: int) -> List[Tuple[int, int, float, float]]:
        """Return (i, j, signed, abs) tuples, strongest first, upper triangle
        only. Same tuple shape as rs_math.abs_diff_topk so rs_hybrid's filter
        keeps working."""
        if self.n < 2 or k <= 0:
            return []
        if self.scoring == SCORING_LEGACY:
            return abs_diff_topk(self.lsa, self.sem, k=k)
        iu_i, iu_j = np.triu_indices(self.n, k=1)
        gap = self.rank_abs[iu_i, iu_j]
        keep = self.p_gap[iu_i, iu_j] >= self.min_percentile
        idx = np.nonzero(keep)[0]
        if idx.size == 0:
            return []
        # Stable total order: gap desc, then i, then j.
        order = np.lexsort((iu_j[idx], iu_i[idx], -gap[idx]))[: int(k)]
        out = []
        for o in idx[order]:
            i, j = int(iu_i[o]), int(iu_j[o])
            out.append((i, j, float(self.rank_signed[i, j]), float(self.rank_abs[i, j])))
        return out

    # -- provenance ---------------------------------------------------------
    def metadata(self) -> Dict[str, Any]:
        return {
            "schema": SCHEMA_2026,
            "scoring": self.scoring,
            "min_percentile": self.min_percentile if self.scoring == SCORING_HYBRID else None,
            "lex_weight": self.lex_weight,
            "dense_degraded": self.dense_degraded,
            "provenance": {
                "computed_at": self.computed_at,
                "seed": SEED,
                "signals": {
                    "structural_lsa": "tfidf+svd topic-membership L1 (lib.core.rs_math.build_lsa_matrix)",
                    "lexical": "bm25 k1=1.5 b=0.75 cosine (rs-engine.bm25_similarity_matrix)",
                    "dense": self.model_used,
                },
                "rank_normalisation": "empirical percentile over upper-triangle pair distribution, average rank for ties",
                "ranking": "deterministic code; no LLM involved",
                "numpy": np.__version__,
                "python": sys.version.split()[0],
            },
        }

    # -- per-pair annotation ------------------------------------------------
    def annotate(self, i: int, j: int, art_i: Dict, art_j: Dict) -> Dict[str, Any]:
        """Additive keys for one pair (never overwrites legacy keys)."""
        raw_signed = float(self.sem[i, j] - self.lsa[i, j])
        extra: Dict[str, Any] = {
            "scoring": self.scoring,
            "raw_signed_diff": round(raw_signed, 4),
            "raw_abs_diff": round(abs(raw_signed), 4),
            "lexical_score": round(float(self.lex[i, j]), 4),
            "structural_percentile": round(float(self.p_struct[i, j]), 4),
            "dense_percentile": round(float(self.p_sem[i, j]), 4),
            "rank_signed_diff": round(float(self.rank_signed[i, j]), 4),
            "rank_gap_percentile": round(float(self.p_gap[i, j]), 4),
            "rank_gap_z": round(
                (float(self.rank_abs[i, j]) - self._gap_mean) / self._gap_std
                if self._gap_std > 1e-12 else 0.0, 3),
        }
        if self.verify:
            if self._verified < VERIFY_MAX_PAIRS:
                extra["verification"] = self._verification(i, j, art_i, art_j)
                self._verified += 1
            else:
                extra["verification"] = {"status": "skipped", "reason": f"verify cap {VERIFY_MAX_PAIRS} reached"}
        return extra

    def _sentences(self, art: Dict) -> Tuple[List[str], Optional[np.ndarray]]:
        key = _art_key(art)
        hit = self._sent_cache.get(key)
        if hit is not None:
            return hit
        sents = _split_sentences(art.get("text", ""))
        emb = None
        if sents:
            fn = self.embed_fn or _embed_hashing
            try:
                emb = np.asarray(fn(sents), dtype=np.float64)
            except Exception as e:  # report, do not swallow
                print(f"rs-engine: claim embedding failed for {key}: {e}", file=sys.stderr)
                emb = np.asarray(_embed_hashing(sents), dtype=np.float64)
        self._sent_cache[key] = (sents, emb)
        return self._sent_cache[key]

    def _claim_evidence(self, art_i: Dict, art_j: Dict) -> Optional[Dict[str, Any]]:
        """Best problem-sentence vs method-sentence match across the two docs."""
        si, ei = self._sentences(art_i)
        sj, ej = self._sentences(art_j)
        if not si or not sj or ei is None or ej is None or ei.shape[1] != ej.shape[1]:
            return None
        sim = cosine_matrix(np.vstack([ei, ej]))
        cross = sim[: len(si), len(si):]
        prob_i = np.array([bool(_PROBLEM_CUE_RE.search(s)) for s in si])
        meth_i = np.array([bool(_METHOD_CUE_RE.search(s)) for s in si])
        prob_j = np.array([bool(_PROBLEM_CUE_RE.search(s)) for s in sj])
        meth_j = np.array([bool(_METHOD_CUE_RE.search(s)) for s in sj])
        best = None  # (score, a_idx, b_idx, problem_side)
        for mask_a, mask_b, side in ((prob_i, meth_j, "source"), (meth_i, prob_j, "target")):
            if mask_a.any() and mask_b.any():
                sub = np.where(mask_a[:, None] & mask_b[None, :], cross, -2.0)
                a, b = np.unravel_index(int(np.argmax(sub)), sub.shape)
                if best is None or sub[a, b] > best[0]:
                    best = (float(sub[a, b]), int(a), int(b), side)
        labelled = best is not None
        if best is None:
            a, b = np.unravel_index(int(np.argmax(cross)), cross.shape)
            best = (float(cross[a, b]), int(a), int(b), "unlabelled")
        score, a, b, side = best
        if side == "target":      # problem sentence lives in the target doc
            prob_sent, meth_sent, prob_side, meth_side = sj[b], si[a], "target", "source"
        elif side == "source":
            prob_sent, meth_sent, prob_side, meth_side = si[a], sj[b], "source", "target"
        else:
            prob_sent, meth_sent, prob_side, meth_side = si[a], sj[b], "source", "target"
        return {
            "level": "claim",
            "roles_labelled": labelled,
            "problem_side": prob_side,
            "problem_sentence": prob_sent,
            "method_side": meth_side,
            "method_sentence": meth_sent,
            "claim_similarity": round(score, 4),
            "embedder": "dense" if not self.dense_degraded else "degraded (hashing surrogate)",
        }

    def _verification(self, i: int, j: int, art_i: Dict, art_j: Dict) -> Dict[str, Any]:
        today = datetime.now(timezone.utc).date().isoformat()
        claim = self._claim_evidence(art_i, art_j)

        def trail(art: Dict, side: str) -> Dict[str, Any]:
            sent = None
            if claim:
                if claim["problem_side"] == side:
                    sent = claim["problem_sentence"]
                elif claim["method_side"] == side:
                    sent = claim["method_sentence"]
            stamp = art.get("retrieved_at")
            return {
                "side": side,
                "source_id": _art_key(art),
                "url": art.get("url") or art.get("path") or "",
                "doi": art.get("doi"),
                "retrieval_date": (stamp or today)[:10],
                "retrieval_date_source": "recorded" if stamp else "run_time",
                "extracted_sentence": sent,
            }

        d_lsa = float(self.p_sem[i, j] - self.p_lsa[i, j])
        d_lex = float(self.p_sem[i, j] - self.p_lex[i, j])
        eps = 0.10
        if self.dense_degraded:
            status = "degraded_no_dense_model"
        elif d_lsa * d_lex > 0 and abs(d_lsa) >= eps and abs(d_lex) >= eps:
            status = "confirmed"
        elif d_lsa * d_lex < 0 and abs(d_lsa) >= eps and abs(d_lex) >= eps:
            status = "contradicted"
        else:
            status = "weak"
        second = {
            "status": status,
            "method": "dense percentile vs two independent lexical percentiles (LSA topic-membership, BM25); direction must agree",
            "dense_minus_lsa": round(d_lsa, 4),
            "dense_minus_bm25": round(d_lex, 4),
            "min_margin": eps,
        }

        key = _pair_key(art_i, art_j)
        dup = _shingle_jaccard(art_i.get("text", ""), art_j.get("text", ""))
        if dup >= 0.8:
            nov, note = "near_duplicate_text", f"3-word shingle jaccard {dup:.2f}"
        elif key in _PRIOR_PAIR_KEYS:
            nov, note = "previously_reported", "pair present in prior results at the same output path"
        else:
            nov, note = "unchecked_external", "no prior report and not a duplicate; web/literature novelty check NOT run (offline)"
        return {
            "source_trail": [trail(art_i, "source"), trail(art_j, "target")],
            "claim_evidence": claim,
            "second_signal": second,
            "novelty": {
                "status": nov,
                "note": note,
                "checked_against": ["in-pair duplicate", "prior results file"],
            },
            "judge": "none (ranking and checks are deterministic code)",
        }


def _resolve_semantic(
    embeddings: Optional[np.ndarray],
    texts: Sequence[str],
    model_used: str,
    label: str = "rs-engine",
) -> Tuple[np.ndarray, str, bool]:
    """Return (sem_matrix, model_label, dense_degraded).

    legacy scoring keeps the original identity fallback (so old behaviour is
    reproducible); hybrid scoring falls back to the hashing surrogate and
    flags the run as degraded instead of silently ranking on 1 - lsa."""
    n = len(texts)
    if embeddings is not None:
        return (semantic_similarity_matrix(embeddings), model_used,
                str(model_used).startswith("hashing"))
    if SCORING_CFG.get("scoring") == SCORING_LEGACY:
        print(f"{label}: no embedder available; semantic matrix set to identity", file=sys.stderr)
        return np.eye(n, dtype=np.float32), model_used, True
    print(f"{label}: no embedder available; using hashing surrogate (dense_degraded=true)", file=sys.stderr)
    return (semantic_similarity_matrix(_embed_hashing(texts)),
            HASH_MODEL_NAME + " (fallback)", True)


def _make_scorer(texts, lsa, sem, model_used, degraded) -> PairScorer:
    return PairScorer(texts, lsa, sem, model_used, degraded, embed_fn=_embed_adhoc)


def _embed_adhoc(texts: Sequence[str]) -> np.ndarray:
    """Embed short texts (claim sentences) with the same model family as the
    document embeddings, no on-disk cache. Falls back to hashing."""
    model_env = os.environ.get("RS_EMBEDDING_MODEL", "").strip().lower()
    if model_env in ("hashing", "hash", HASH_MODEL_NAME):
        return _embed_hashing(texts)
    vec = _embed_local_minilm(texts)
    if vec is None:
        return _embed_hashing(texts)
    return vec


