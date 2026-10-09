"""Structure-map two neighbourhoods of the graph with the SME engine (engines/sme-agent/lib/sme.py).
A neighbourhood becomes a description group: nodes are entities, relationship types are predicates, 2-step
directed paths become second-order `then` relations (so systematicity has something to prefer), and node
categories become attributes. Candidate inferences that name two mapped target nodes become proposed edges;
those that need a node the target lacks are reported as `needs_new_node`."""
from __future__ import annotations

import os
import re
import sys

from common import SEMANTIC_TYPES


def _load_sme():
    here = os.path.dirname(os.path.abspath(__file__))
    cands = [os.environ.get("SME_LIB", ""), os.path.join(here, "..", "..", "sme-agent", "lib"),
             os.path.join(here, "..", "..", "..", "package-2026", "sme-agent", "lib")]
    for c in cands:
        if c and os.path.exists(os.path.join(c, "sme.py")):
            sys.path.insert(0, c)
            import sme
            return sme
    raise ImportError("sme.py not found; set SME_LIB to the folder holding sme.py")


_REL = re.compile(r"\(([a-z_]+) (n\d+|\(:skolem [^)]+\)) (n\d+|\(:skolem [^)]+\))\)")


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-")[:30] or "x"


def neighbourhood(g, center, hops=2, cap=60):
    seen, frontier = {center}, [center]
    for _ in range(hops):
        nxt = []
        for n in frontier:
            for m in sorted(g.adj[n], key=lambda x: -g.deg(x)):
                if m not in seen and len(seen) < cap:
                    seen.add(m); nxt.append(m)
        frontier = nxt
    return seen


def to_dgroup(sme, g, nodes, name, attr="problem_type", max_paths=200):
    d = sme.Dgroup(name)
    ent = {}
    for n in sorted(nodes):
        ent[n] = "n%d" % (len(ent) + 1)
        d.add_entity(ent[n])
    rel = {}
    for e in g.edges:
        if e["s"] in ent and e["t"] in ent and e["type"] in SEMANTIC_TYPES:
            k = (e["s"], e["t"], e["type"])
            if k not in rel:
                rel[k] = d.add_expr(e["type"].lower(), [ent[e["s"]], ent[e["t"]]], "r%d" % (len(rel) + 1))
    count = 0
    by_src = {}
    for (s, t, ty), nm in rel.items():
        by_src.setdefault(s, []).append((t, ty, nm))
    for (s, t, ty), nm in rel.items():
        for (t2, ty2, nm2) in by_src.get(t, []):
            if t2 != s and count < max_paths:
                d.add_expr("then", [nm, nm2])
                count += 1
    for n in sorted(nodes):
        v = g.attr(n, attr)
        if v:
            d.add_expr("is-" + slug(v), [ent[n]])
    d.finalize()
    return d, ent


def map_neighbourhoods(g, base_node, target_node, hops=2, rules="AN", attr="problem_type"):
    sme = _load_sme()
    bn, tn = neighbourhood(g, base_node, hops), neighbourhood(g, target_node, hops)
    bn = bn - {target_node}
    tn = tn - {base_node}
    B, be = to_dgroup(sme, g, bn, "base", attr)
    T, te = to_dgroup(sme, g, tn, "target", attr)
    inv_t = {v: k for k, v in te.items()}
    res = sme.match(B, T, rules)
    out = []
    for gm in res.gmaps[:3]:
        props = []
        seen = set()
        for ci in gm["candidate_inferences"]:
            for f, x, y in _REL.findall(ci["expression"]):
                ty = f.upper().replace("-", "_")
                if ty not in SEMANTIC_TYPES or (ty, x, y) in seen:
                    continue
                seen.add((ty, x, y))
                if x in inv_t and y in inv_t:
                    props.append({"kind": "edge", "type": ty, "s": inv_t[x], "t": inv_t[y], "expression": ci["expression"]})
                else:
                    props.append({"kind": "needs_new_node", "type": ty, "from": inv_t.get(x, x), "to": inv_t.get(y, y),
                                  "expression": ci["expression"]})
        out.append({"ses": gm["weight"], "n_mappings": len(gm["emaps"]),
                    "mapping": [(g.name({v: k for k, v in be.items()}[a]), g.name(inv_t[b])) for a, b in gm["emaps"]
                                if a in {v: k for k, v in be.items()} and b in inv_t],
                    "proposals": props})
    return out
