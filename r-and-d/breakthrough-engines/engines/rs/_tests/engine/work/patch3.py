import sys
p=sys.argv[1]; s=open(p,encoding="utf-8").read()
def rep(o,n,c=1):
    global s
    assert s.count(o)==c,(s.count(o),o[:70]); s=s.replace(o,n)

rep('''#   3. converts each to an empirical percentile over the corpus pair
#      distribution (scale free, deterministic) and takes the rank gap,
#   4. keeps pairs whose gap is in the top (1 - min_percentile) of the corpus.''','''#   3. standardises each signal to a z-score over the corpus pair distribution
#      (scale free, deterministic, keeps the tails that ranks would flatten)
#      and takes gap = z(dense) - z(structural),
#   4. keeps pairs whose |gap| is at or above the corpus percentile
#      --min-percentile (default 0.90) instead of a fixed cutoff.
# Empirical percentiles of each signal are also reported and drive the
# second-signal check.''')
rep('''def _split_sentences''','''def zscore_matrix(matrix: np.ndarray) -> np.ndarray:
    """Standardise a symmetric matrix by the mean/std of its upper triangle.
    Zero-variance or <2-doc input yields zeros (no divide-by-zero)."""
    m = np.nan_to_num(np.asarray(matrix, dtype=np.float64))
    n = m.shape[0]
    if n < 2:
        return np.zeros_like(m)
    tri = m[np.triu_indices(n, k=1)]
    mu, sd = float(tri.mean()), float(tri.std())
    if sd < 1e-12:
        return np.zeros_like(m)
    return (m - mu) / sd


def _split_sentences''')
rep('''        self.p_struct = (1.0 - self.lex_weight) * self.p_lsa + self.lex_weight * self.p_lex
        self.rank_signed = self.p_sem - self.p_struct
        self.rank_abs = np.abs(self.rank_signed)''','''        self.p_struct = (1.0 - self.lex_weight) * self.p_lsa + self.lex_weight * self.p_lex
        self.z_sem = zscore_matrix(self.sem)
        self.z_struct = ((1.0 - self.lex_weight) * zscore_matrix(self.lsa)
                         + self.lex_weight * zscore_matrix(self.lex))
        self.rank_signed = self.z_sem - self.z_struct      # hybrid signed gap (z units)
        self.rank_abs = np.abs(self.rank_signed)''')
rep('''            "structural_percentile": round(float(self.p_struct[i, j]), 4),
            "dense_percentile": round(float(self.p_sem[i, j]), 4),
            "rank_signed_diff": round(float(self.rank_signed[i, j]), 4),
            "rank_gap_percentile": round(float(self.p_gap[i, j]), 4),
            "rank_gap_z": round(''','''            "structural_percentile": round(float(self.p_struct[i, j]), 4),
            "dense_percentile": round(float(self.p_sem[i, j]), 4),
            "structural_z": round(float(self.z_struct[i, j]), 4),
            "dense_z": round(float(self.z_sem[i, j]), 4),
            "hybrid_signed_gap": round(float(self.rank_signed[i, j]), 4),
            "gap_percentile": round(float(self.p_gap[i, j]), 4),
            "gap_z": round(''')
rep('''"rank_normalisation": "empirical percentile over upper-triangle pair distribution, average rank for ties",''','''"normalisation": "z-score of each signal over the upper-triangle pair distribution; gap gated by empirical percentile of |gap| (average rank for ties)",''')
rep('''    flags the run as degraded instead of silently ranking on 1 - lsa."""''','''    flags the run as degraded instead of silently ranking on 1 - lsa."""''')
open(p,"w",encoding="utf-8").write(s)
