"""Communities and bridging (the BisoNet idea computed on the graph itself).
Label propagation (deterministic), exact betweenness (Brandes), participation coefficient.
Bridge candidates: pairs in different communities that sit on either side of a bridging node."""
from __future__ import annotations

import random
from collections import Counter, defaultdict, deque

from common import pair_key


def communities(g, seed=7, rounds=30):
    r = random.Random(seed)
    lab = {n: n for n in g.nodes}
    order = sorted(g.nodes)
    for _ in range(rounds):
        r.shuffle(order)
        changed = False
        for n in order:
            if not g.adj[n]:
                continue
            c = Counter(lab[m] for m in g.adj[n])
            top = max(c.values())
            best = min(k for k, v in c.items() if v == top)
            if lab[n] != best and c[lab[n]] < top:
                lab[n] = best
                changed = True
        if not changed:
            break
    ids = {}
    for n in sorted(g.nodes):
        ids.setdefault(lab[n], len(ids))
    return {n: ids[lab[n]] for n in g.nodes}


def betweenness(g):
    bc = dict.fromkeys(g.nodes, 0.0)
    for s in g.nodes:
        stack, pred = [], defaultdict(list)
        sigma = dict.fromkeys(g.nodes, 0.0); sigma[s] = 1.0
        dist = dict.fromkeys(g.nodes, -1); dist[s] = 0
        q = deque([s])
        while q:
            v = q.popleft(); stack.append(v)
            for w in g.adj[v]:
                if dist[w] < 0:
                    dist[w] = dist[v] + 1; q.append(w)
                if dist[w] == dist[v] + 1:
                    sigma[w] += sigma[v]; pred[w].append(v)
        delta = dict.fromkeys(g.nodes, 0.0)
        while stack:
            w = stack.pop()
            for v in pred[w]:
                delta[v] += sigma[v] / sigma[w] * (1 + delta[w])
            if w != s:
                bc[w] += delta[w]
    n = len(g.nodes)
    scale = 1.0 / ((n - 1) * (n - 2)) if n > 2 else 1.0
    return {k: v * scale for k, v in bc.items()}  # undirected pairs counted twice, scale makes it 0..1-ish


def participation(g, comm):
    out = {}
    for n in g.nodes:
        k = g.deg(n)
        if k == 0:
            out[n] = 0.0
            continue
        c = Counter(comm[m] for m in g.adj[n])
        out[n] = 1.0 - sum((v / k) ** 2 for v in c.values())
    return out


def bridge_report(g, seed=7, top=30):
    comm = communities(g, seed)
    bc = betweenness(g)
    pc = participation(g, comm)
    nodes = sorted(g.nodes, key=lambda n: (-(bc[n] * (0.5 + pc[n])), n))
    rows = [{"id": n, "betweenness": bc[n], "participation": pc[n], "community": comm[n]} for n in nodes[:top]]
    return comm, bc, pc, rows


def bridge_pairs(g, comm, bc, pc, per_node=20, min_bc=0.0):
    seen, out = set(), []
    for b in sorted(g.nodes, key=lambda n: -bc[n]):
        if bc[b] <= min_bc or pc[b] <= 0:
            continue
        by = defaultdict(list)
        for m in g.adj[b]:
            by[comm[m]].append(m)
        cs = sorted(by)
        cnt = 0
        for i in range(len(cs)):
            for j in range(i + 1, len(cs)):
                for u in by[cs[i]]:
                    for v in by[cs[j]]:
                        k = pair_key(u, v)
                        if k in seen or g.has_edge(u, v):
                            continue
                        seen.add(k)
                        out.append({"u": k[0], "v": k[1], "via": b, "score": bc[b] * pc[b]})
                        cnt += 1
                        if cnt >= per_node:
                            break
                    if cnt >= per_node:
                        break
                if cnt >= per_node:
                    break
    out.sort(key=lambda r: (-r["score"], r["u"], r["v"]))
    return out
