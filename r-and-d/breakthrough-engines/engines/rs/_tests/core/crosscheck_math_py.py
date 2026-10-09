"""Python half of the node/python cross-check. Reads a JSON case file, runs the
rs_math.py functions, prints JSON results. Run via crosscheck_math.cjs."""
import json, sys, os
core = sys.argv[2]
sys.path.insert(0, core)
import numpy as np
import rs_math as m

case = json.load(open(sys.argv[1]))
out = {}
counts = np.array(case["counts"], dtype=np.float64)
out["sim"] = m.normalize_and_l1_similarity(counts, dtype=np.float64).tolist()
out["membership"] = m.count_topic_membership(case["tokens"], case["topics"]).tolist()
lsa, sem = np.array(case["lsa"]), np.array(case["sem"])
out["topk"] = [list(t) for t in m.abs_diff_topk(lsa, sem, k=case["k"])]
out["topk_pct"] = [list(t) for t in m.abs_diff_topk(lsa, sem, k=case["k"], min_percentile=case["pct"])]
out["topk_diag"] = [list(t) for t in m.abs_diff_topk(lsa, sem, k=case["k"], skip_diagonal=False)]
out["ranked"] = m.rank_pairs_by_percentile(lsa, sem, k=case["k"], min_percentile=case["pct"])
vals = case["vals"]
out["quantiles"] = [m.percentile_threshold(vals, q) for q in case["qs"]]
out["np_quantiles"] = [float(np.percentile(np.array(vals), q * 100.0)) for q in case["qs"]]
sv = sorted(vals)
out["ranks"] = [m.percentile_rank(sv, x) for x in case["xs"]]
out["z"] = m.z_scores(vals)
out["direction"] = [m.classify_direction(x) for x in case["dirs"]]
print(json.dumps(out))
