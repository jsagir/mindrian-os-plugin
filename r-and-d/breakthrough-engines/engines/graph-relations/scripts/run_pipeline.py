#!/usr/bin/env python3
"""Run all structural and text methods on a snapshot and write ranked, unevidenced proposals.
Usage: run_pipeline.py SNAPSHOT.json OUTDIR [--attr problem_type] [--top 100] [--seed 7] [--text-label Framework]
Outputs: OUTDIR/proposals.json, OUTDIR/report.md, OUTDIR/methods.json. Reads nothing but the snapshot."""
import argparse, json, os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import atypicality, bridging, gaps, holes, proposals, textsim
from common import load_snapshot, write_json


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("snapshot"); ap.add_argument("outdir")
    ap.add_argument("--attr", default="problem_type"); ap.add_argument("--top", type=int, default=100)
    ap.add_argument("--seed", type=int, default=7); ap.add_argument("--text-label", default=None)
    ap.add_argument("--min-common", type=int, default=2)
    a = ap.parse_args(argv)
    os.makedirs(a.outdir, exist_ok=True)
    g = load_snapshot(a.snapshot)
    t0 = time.time()
    src, info = {}, {"nodes": len(g.nodes), "edges": len(g.edges)}

    rows, skipped = gaps.open_triads(g, a.min_common)
    src["gaps"] = [{"u": r["u"], "v": r["v"], "score": r["adamic_adar"] + max(0.0, r["z"]) * 0.1, "common": r["common"],
                    "z": round(r["z"], 3), "via": [g.name(w) for w in r["via"][:4]]} for r in rows[: a.top * 3]]
    info["hub_nodes_skipped"] = len(skipped)

    hs = holes.hole_summary(g, rounds=8, seed=a.seed)
    info["holes"] = hs
    info["ripser"] = holes.ripser_summary(g)
    sc = {}
    for c in holes.induced_c4(g):
        for k in ("diagonal_1", "diagonal_2"):
            sc.setdefault(c[k], []).append([g.name(x) for x in c["cycle"]])
    src["holes"] = [{"u": p[0], "v": p[1], "score": float(len(cs)), "cycles": cs[:2]} for p, cs in
                    sorted(sc.items(), key=lambda x: (-len(x[1]), x[0]))[: a.top * 3]]

    comm, bc, pc, brows = bridging.bridge_report(g, a.seed)
    src["bridge"] = [{"u": r["u"], "v": r["v"], "score": r["score"], "via": g.name(r["via"])} for r in
                     bridging.bridge_pairs(g, comm, bc, pc)[: a.top * 3]]
    info["communities"] = len(set(comm.values()))
    info["top_bridges"] = [{"name": g.name(r["id"]), "betweenness": round(r["betweenness"], 5),
                            "participation": round(r["participation"], 3)} for r in brows[:10]]

    ids = [n for n in g.nodes if (a.text_label is None or a.text_label in g.nodes[n].get("labels", []))]
    if len(ids) <= 3000:
        src["semantic"] = [{"u": r["u"], "v": r["v"], "score": r["sim"], "common": r["common"]}
                           for r in textsim.semantic_gaps(g, ids, top=a.top * 3)]
    else:
        info["semantic"] = "skipped: more than 3000 text nodes; pass --text-label"

    z, cat, obs = atypicality.category_zscores(g, a.attr, shuffles=20, seed=a.seed)
    info["atypicality"] = atypicality.edge_profile(g, z, cat)
    ranked, dropped = proposals.merge(g, src)
    for r in ranked:
        aa = atypicality.annotate([{"u": r["s"], "v": r["t"]}], g, z, cat)[0]["atypicality_z"]
        r["atypicality_z"] = None if aa is None else round(aa, 3)
    ranked, issues = proposals.split_issues(ranked)
    ranked = ranked[: a.top]
    write_json(os.path.join(a.outdir, "name_issues.json"), issues[:100])
    info["name_issues"] = len(issues)
    info["dropped_existing"] = dropped
    info["seconds"] = round(time.time() - t0, 1)
    write_json(os.path.join(a.outdir, "proposals.json"), ranked)
    write_json(os.path.join(a.outdir, "methods.json"), info)
    lines = ["# Relationship proposals (status: proposed, unevidenced)", "",
             f"Graph: {info['nodes']} nodes, {info['edges']} edges. Seconds: {info['seconds']}", "",
             "| # | from | to | type | agree | methods | score |", "|---|---|---|---|---|---|---|"]
    for i, r in enumerate(ranked[:40], 1):
        lines.append(f"| {i} | {r['s_name']} | {r['t_name']} | {r['suggested_type']} | {r['agree']} | {','.join(r['methods'])} | {r['triage_score']} |")
    open(os.path.join(a.outdir, "report.md"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print(f"{len(ranked)} proposals -> {a.outdir}  ({info['seconds']}s)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
