"""Temporal backtest: hide relationships created after a cutoff, run each method on the earlier graph, and see
how many of the hidden relationships the method ranks near the top. Compared against baselines.
Without this, a method has not earned a place in the agent."""
from __future__ import annotations

import random

from common import pair_key
from gaps import ranked_pairs
from bridging import communities, betweenness, participation, bridge_pairs
from holes import induced_c4


def dated_edges(g):
    return [e for e in g.edges if e.get("created_at")]


def choose_cutoff(g, frac=0.7):
    ds = sorted(e["created_at"] for e in dated_edges(g))
    return ds[int(len(ds) * frac)] if ds else None


def split(g, cutoff):
    train = g.before(cutoff)
    future = {pair_key(e["s"], e["t"]) for e in g.edges if e.get("created_at") and e["created_at"] >= cutoff}
    future = {p for p in future if not train.has_edge(*p)}
    return train, future


def methods(train, seed=7):
    def holes():
        rows = induced_c4(train)
        sc = {}
        for r in rows:
            for k in ("diagonal_1", "diagonal_2"):
                sc[r[k]] = sc.get(r[k], 0) + 1
        return [p for p, _ in sorted(sc.items(), key=lambda x: (-x[1], x[0]))]

    def bridge():
        comm = communities(train, seed)
        bc = betweenness(train)
        pc = participation(train, comm)
        return [pair_key(r["u"], r["v"]) for r in bridge_pairs(train, comm, bc, pc, per_node=50)]

    def pref():
        ids = sorted(train.nodes)
        cand = []
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                if not train.has_edge(ids[i], ids[j]):
                    cand.append(((train.deg(ids[i]) * train.deg(ids[j])), (ids[i], ids[j])))
        cand.sort(key=lambda x: (-x[0], x[1]))
        return [p for _, p in cand]

    return {"gaps": lambda: ranked_pairs(train, 1), "holes": holes, "bridge": bridge, "pref_attachment": pref}


def evaluate(g, cutoff=None, ks=(10, 50, 200), seed=7, only_pairs=None):
    cutoff = cutoff or choose_cutoff(g)
    if not cutoff:
        return {"error": "no dated relationships; cannot backtest"}
    train, future = split(g, cutoff)
    if only_pairs is not None:
        future = {p for p in future if p in only_pairs}
    if not future:
        return {"error": "no future relationships after cutoff", "cutoff": cutoff}
    ids = sorted(train.nodes)
    n_pairs = len(ids) * (len(ids) - 1) // 2 - len({pair_key(e["s"], e["t"]) for e in train.edges})
    res = {"cutoff": cutoff, "train_edges": len(train.edges), "future_edges": len(future), "candidate_pairs": n_pairs}
    for name, fn in methods(train, seed).items():
        ranked = fn()
        row = {"proposed": len(ranked)}
        for k in ks:
            hits = sum(1 for p in ranked[:k] if p in future)
            exp = k * len(future) / n_pairs if n_pairs else 0.0
            row["hits@%d" % k] = hits
            row["lift@%d" % k] = (hits / exp) if exp > 0 else None
        res[name] = row
    return res
