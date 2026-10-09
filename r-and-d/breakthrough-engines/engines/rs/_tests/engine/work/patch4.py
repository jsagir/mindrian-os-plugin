import sys
p=sys.argv[1]; s=open(p,encoding="utf-8").read()
def rep(o,n,c=1):
    global s
    assert s.count(o)==c,(s.count(o),o[:70]); s=s.replace(o,n)
rep('''        if self.n < 2 or k <= 0:
            return []
        if self.scoring == SCORING_LEGACY:
            return abs_diff_topk(self.lsa, self.sem, k=k)
        iu_i, iu_j = np.triu_indices(self.n, k=1)''','''        if self.n < 2 or k <= 0:
            return []
        if self.scoring == SCORING_LEGACY:
            return abs_diff_topk(self.lsa, self.sem, k=k)
        iu_i, iu_j = np.triu_indices(self.n, k=1)
        n_eligible = int(iu_i.size if self.eligible is None else self.eligible[iu_i, iu_j].sum())
        if n_eligible < MIN_PAIRS_FOR_PERCENTILES:
            self.warnings.append(
                f"corpus too small for percentile gating ({n_eligible} eligible pairs < "
                f"{MIN_PAIRS_FOR_PERCENTILES}); no pairs returned. Use --scoring legacy for tiny corpora.")
            print("rs-engine: " + self.warnings[-1], file=sys.stderr)
            return []''')
rep('''HASH_DIM = 256''','''MIN_PAIRS_FOR_PERCENTILES = 10  # below this a corpus percentile is meaningless
HASH_DIM = 256''')
rep('''        self._verified = 0
        self.computed_at''','''        self._verified = 0
        self.warnings: List[str] = []
        self.computed_at''')
rep('''            "dense_degraded": self.dense_degraded,
            "provenance": {''','''            "dense_degraded": self.dense_degraded,
            "scoring_warnings": list(self.warnings),
            "provenance": {''')
open(p,"w",encoding="utf-8").write(s)
