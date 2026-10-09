#!/usr/bin/env python3
"""Rank structure maps by how likely they are to be a useful reframe (not merely a good analogy).

SME scores structural fit. A reframe is only interesting when the map is ALSO far in surface terms
(different vocabulary and objects) and proposes something the target does not already contain.
Gentner's access finding says retrieval favors surface matches, so far-domain bases must be sought
deliberately; this module scores what comes back.

  fit        = SES / SES(target mapped onto itself)           structural fit, 0..1
  distance   = 1 - Jaccard(base vocabulary, target vocabulary) surface distance, 0..1
  novelty    = share of candidate inferences not already in the target (and not in `known`)
  breakthrough = fit * distance * novelty   (0 if no candidate inference)

These are triage numbers for ordering, not evidence. Candidate inferences are surmises until tested.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import sme  # noqa: E402


def vocabulary(g):
    g.finalize()
    v = {f for f, _ in g.exprs.values()}
    v |= {e for e in g.entities if e not in g.constants}
    return v


def surface_distance(base, target):
    a, b = vocabulary(base), vocabulary(target)
    if not a and not b:
        return 0.0
    return 1.0 - len(a & b) / len(a | b)


def self_score(target, rules):
    r = sme.match(target, target, rules)
    return max((g["weight"] for g in r.gmaps), default=0.0)


def _norm_text(t):
    return " ".join(t.lower().split())


def assess(base, target, rules="AN", known=(), top=5):
    """Return ranked reframes. `known` is a list of already-established target claims in the same
    s-expression text form as candidate inferences, e.g. "(cause >temperature hflow)"."""
    res = sme.match(base, target, rules)
    denom = self_score(target, rules) or 1.0
    dist = surface_distance(base, target)
    kn = {_norm_text(k) for k in known}
    out = []
    for g in res.gmaps:
        cis = g["candidate_inferences"]
        fresh = [c for c in cis if _norm_text(c["expression"]) not in kn]
        novelty = (len(fresh) / len(cis)) if cis else 0.0
        fit = min(1.0, g["weight"] / denom)
        out.append({
            "rank_ses": g["rank"],
            "ses": round(g["weight"], 4),
            "fit": round(fit, 4),
            "surface_distance": round(dist, 4),
            "novelty": round(novelty, 4),
            "breakthrough": round(fit * dist * novelty, 4),
            "correspondences": [list(x) for x in g["emaps"]] + [list(x) for x in g["correspondences"]],
            "candidate_inferences": fresh,
            "already_known": [c for c in cis if c not in fresh],
            "skolem_entities": g.get("skolems", []),
            "status": "surmise",  # never "finding": must pass the agent's test step first
        })
    out.sort(key=lambda r: (-r["breakthrough"], -r["fit"]))
    return out[:top]
