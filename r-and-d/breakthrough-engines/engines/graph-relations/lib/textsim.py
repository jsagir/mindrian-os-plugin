"""Text signals: TF-IDF cosine semantic gaps and a bidirectional topic match (BTM-lite).
Semantic gap = high text similarity with no structural link (the dual-signal reverse salient idea).
Topic match = cluster each corpus on its own, then ask which documents of A are outliers to B's topics.
Pure Python. If the snapshot carries embeddings (attrs['embedding']) swap them in through `vectors=`."""
from __future__ import annotations

import math
import random
import re
from collections import Counter

STOP = set("""a an and are as at be but by for from has have in into is it its of on or that the their this
to was were will with can not no than then they which who what when where how if each other such more most
use used using also may per via over under between within across about after before""".split())


def tokens(s):
    return [t for t in re.findall(r"[a-z][a-z0-9\-]{2,}", s.lower()) if t not in STOP]


def tfidf(docs):
    df = Counter()
    toks = [tokens(d) for d in docs]
    for t in toks:
        df.update(set(t))
    n = len(docs)
    vecs = []
    for t in toks:
        c = Counter(t)
        v = {w: (1 + math.log(f)) * math.log((1 + n) / (1 + df[w])) for w, f in c.items()}
        nrm = math.sqrt(sum(x * x for x in v.values())) or 1.0
        vecs.append({w: x / nrm for w, x in v.items()})
    return vecs


def cos(a, b):
    if len(a) > len(b):
        a, b = b, a
    return sum(x * b.get(w, 0.0) for w, x in a.items())


def semantic_gaps(g, node_ids, vectors=None, min_sim=0.25, top=200):
    ids = list(node_ids)
    vecs = vectors or tfidf([(g.name(n) + " " + g.nodes[n].get("text", "")) for n in ids])
    out = []
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            u, v = ids[i], ids[j]
            if g.has_edge(u, v):
                continue
            s = cos(vecs[i], vecs[j])
            if s >= min_sim:
                out.append({"u": u, "v": v, "sim": s, "common": len(g.adj[u] & g.adj[v])})
    out.sort(key=lambda r: (-r["sim"], r["u"], r["v"]))
    return out[:top]


def _centroid(vs):
    c = Counter()
    for v in vs:
        for w, x in v.items():
            c[w] += x
    nrm = math.sqrt(sum(x * x for x in c.values())) or 1.0
    return {w: x / nrm for w, x in c.items()}


def kmeans(vecs, k, seed, iters=15):
    r = random.Random(seed)
    k = max(1, min(k, len(vecs)))
    cents = [vecs[i] for i in r.sample(range(len(vecs)), k)]
    assign = [0] * len(vecs)
    for _ in range(iters):
        new = [max(range(k), key=lambda c: cos(v, cents[c])) for v in vecs]
        if new == assign:
            break
        assign = new
        for c in range(k):
            mem = [vecs[i] for i in range(len(vecs)) if assign[i] == c]
            if mem:
                cents[c] = _centroid(mem)
    return cents, assign


def top_terms(vs, n=6):
    c = _centroid(vs) if vs else {}
    return [w for w, _ in sorted(c.items(), key=lambda x: -x[1])[:n]]


def btm_unique(texts_a, texts_b, k=6, tau=0.18, seeds=(1, 2, 3)):
    """Documents of A that are outliers to B's topic model in a majority of seeds, grouped by A's topics.
    uniqueness of an A-topic = share of its docs that are outliers to B. Unique topic if >= 0.5."""
    allv = tfidf(list(texts_a) + list(texts_b))
    va, vb = allv[: len(texts_a)], allv[len(texts_a):]
    votes = Counter()
    topics = []
    for sd in seeds:
        cb, _ = kmeans(vb, k, sd)
        ca, asg = kmeans(va, k, sd)
        out = [max(cos(v, c) for c in cb) < tau for v in va]
        for i, o in enumerate(out):
            votes[i] += 1 if o else 0
        for c in range(len(ca)):
            mem = [i for i in range(len(va)) if asg[i] == c]
            if mem:
                topics.append({"seed": sd, "uniqueness": sum(out[i] for i in mem) / len(mem),
                               "docs": mem, "terms": top_terms([va[i] for i in mem])})
    need = len(seeds) // 2 + 1
    unique_docs = sorted(i for i, v in votes.items() if v >= need)
    return unique_docs, [t for t in topics if t["uniqueness"] >= 0.5]
