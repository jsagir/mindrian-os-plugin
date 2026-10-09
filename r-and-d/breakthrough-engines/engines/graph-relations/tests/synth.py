"""Synthetic graphs with planted structure, for tests."""
import os, random, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
from common import Graph


def planted(n_comm=4, size=14, p_in=0.5, p_out=0.01, seed=3, hidden_frac=0.25):
    r = random.Random(seed)
    nodes, edges, hidden = [], [], []
    ids = []
    for c in range(n_comm):
        for i in range(size):
            nid = f"c{c}n{i}"
            ids.append((nid, c))
            nodes.append({"id": nid, "labels": ["Framework"], "name": nid,
                          "attrs": {"problem_type": "T%d" % (c % 2)},
                          "text": f"topic{c} concept{c} method{c} word{i % 5} shared{c}"})
    k = 0
    for i, (a, ca) in enumerate(ids):
        for b, cb in ids[i + 1:]:
            p = p_in if ca == cb else p_out
            if r.random() < p:
                k += 1
                new = r.random() < hidden_frac
                e = {"s": a, "t": b, "type": "RELATES_TO",
                     "created_at": ("2026-09-01T00:00:00" if new else "2026-01-01T00:00:00")}
                edges.append(e)
    return Graph(nodes, edges)
