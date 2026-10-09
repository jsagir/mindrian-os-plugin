"""Collect, merge and rank proposed relationships. Everything here is status `proposed`."""
from __future__ import annotations

from common import pair_key, rank_norm, stable_id


def merge(g, sources, prior=None):
    """sources: {name: [rows with u, v, score, ...]}. Returns proposals ranked by Borda score over the
    methods that suggested the pair, with a bonus for agreement. Existing edges are dropped."""
    prior = prior or g.type_prior()
    by_pair, dropped_existing = {}, 0
    for name, rows in sources.items():
        if not rows:
            continue
        norms = rank_norm([r["score"] for r in rows])
        for r, nz in zip(rows, norms):
            u, v = pair_key(r["u"], r["v"])
            if g.has_edge(u, v):
                dropped_existing += 1
                continue
            p = by_pair.setdefault((u, v), {"u": u, "v": v, "methods": {}, "detail": {}})
            p["methods"][name] = nz
            p["detail"][name] = {k: val for k, val in r.items() if k not in ("u", "v")}
    out = []
    for (u, v), p in by_pair.items():
        k = len(p["methods"])
        score = sum(p["methods"].values()) / max(1, len(sources)) + 0.25 * (k - 1)
        out.append({
            "id": stable_id(u, v), "s": u, "t": v, "s_name": g.name(u), "t_name": g.name(v),
            "s_label": g.label(u), "t_label": g.label(v),
            "suggested_type": p["detail"].get("sme", {}).get("type") or g.suggest_type(u, v, prior),
            "direction": "undetermined",
            "triage_score": round(score, 6), "agree": k, "methods": sorted(p["methods"]),
            "detail": p["detail"], "evidence": [], "status": "proposed",
        })
    out.sort(key=lambda r: (-r["triage_score"], -r["agree"], r["s"], r["t"]))
    return out, dropped_existing


def _norm(name):
    import re
    return re.sub(r"[^a-z0-9 ]+", " ", str(name).lower()).split()


def name_issue(a, b):
    """Return 'suspect_name' for very short names, 'possible_duplicate' when one name contains the other
    or the two are near-identical. Those are entity-resolution findings, not new relationships."""
    import difflib
    ta, tb = _norm(a), _norm(b)
    if min(len(" ".join(ta)), len(" ".join(tb))) < 3:
        return "suspect_name"
    if ta and tb and (set(ta) <= set(tb) or set(tb) <= set(ta)):
        return "possible_duplicate"
    if difflib.SequenceMatcher(None, " ".join(ta), " ".join(tb)).ratio() >= 0.85:
        return "possible_duplicate"
    return None


def split_issues(rows):
    keep, issues = [], []
    for r in rows:
        why = name_issue(r["s_name"], r["t_name"])
        if why:
            r = dict(r, issue=why)
            issues.append(r)
        else:
            keep.append(r)
    return keep, issues
