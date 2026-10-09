import sys
p=sys.argv[1]; s=open(p,encoding="utf-8").read()
def rep(o,n,c=1):
    global s
    assert s.count(o)==c,(s.count(o),o[:70]); s=s.replace(o,n)

rep('''def percentile_rank_matrix(matrix: np.ndarray) -> np.ndarray:
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
    count = vals.size''','''def percentile_rank_matrix(matrix: np.ndarray, eligible: Optional[np.ndarray] = None) -> np.ndarray:
    """Empirical percentile (0..1, average rank for ties) of every off-diagonal
    entry, computed over the upper-triangle distribution. Returns a symmetric
    matrix with a zero diagonal. Deterministic, scale free.

    `eligible` (optional bool n x n) restricts the reference distribution (and
    the non-zero output) to those pairs, e.g. cross-corpus pairs only."""
    m = np.nan_to_num(np.asarray(matrix, dtype=np.float64))
    n = m.shape[0]
    out = np.zeros((n, n), dtype=np.float64)
    if n < 2:
        return out
    iu = np.triu_indices(n, k=1)
    if eligible is not None:
        sel = np.asarray(eligible, dtype=bool)[iu]
        iu = (iu[0][sel], iu[1][sel])
    vals = m[iu]
    count = vals.size
    if count == 0:
        return out''')
rep('''        dense_degraded: bool,
        embed_fn=None,
    ) -> None:''','''        dense_degraded: bool,
        embed_fn=None,
        eligible: Optional[np.ndarray] = None,
    ) -> None:''')
rep('''        self.p_gap = percentile_rank_matrix(self.rank_abs)
        if self.n >= 2:
            tri = self.rank_abs[np.triu_indices(self.n, k=1)]''','''        self.eligible = None if eligible is None else np.asarray(eligible, dtype=bool)
        self.p_gap = percentile_rank_matrix(self.rank_abs, self.eligible)
        if self.n >= 2:
            tri_i = np.triu_indices(self.n, k=1)
            if self.eligible is not None:
                sel = self.eligible[tri_i]
                tri_i = (tri_i[0][sel], tri_i[1][sel])
            tri = self.rank_abs[tri_i] if tri_i[0].size else np.zeros(1)''')
rep('''        keep = self.p_gap[iu_i, iu_j] >= self.min_percentile
''','''        keep = self.p_gap[iu_i, iu_j] >= self.min_percentile
        if self.eligible is not None:
            keep &= self.eligible[iu_i, iu_j]
''')
rep('''def _make_scorer(texts, lsa, sem, model_used, degraded) -> PairScorer:
    return PairScorer(texts, lsa, sem, model_used, degraded, embed_fn=_embed_adhoc)''','''def _make_scorer(texts, lsa, sem, model_used, degraded, eligible=None) -> PairScorer:
    return PairScorer(texts, lsa, sem, model_used, degraded,
                      embed_fn=_embed_adhoc, eligible=eligible)''')
# cross-room eligible
rep('''    scorer = _make_scorer(texts, lsa_matrix, sem_matrix, model_used, degraded)
    # Overshoot so post-filter still yields topk when some pairs are intra-room.''','''    _rooms = np.array([a["room_id"] for a in corpus])
    scorer = _make_scorer(texts, lsa_matrix, sem_matrix, model_used, degraded,
                          eligible=(_rooms[:, None] != _rooms[None, :]))
    # Overshoot so post-filter still yields topk when some pairs are intra-room.''')
rep('''    scorer = _make_scorer(texts, lsa_matrix, sem_matrix, model_used, degraded)
    # Overshoot top-k, then post-filter to cross-corpus only.''','''    _om = np.asarray(origin_mask, dtype=bool)
    scorer = _make_scorer(texts, lsa_matrix, sem_matrix, model_used, degraded,
                          eligible=(_om[:, None] != _om[None, :]))
    # Overshoot top-k, then post-filter to cross-corpus only.''')
open(p,"w",encoding="utf-8").write(s)
