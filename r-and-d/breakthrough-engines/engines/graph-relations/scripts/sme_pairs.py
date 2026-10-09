#!/usr/bin/env python3
"""Structure-map two neighbourhoods and print proposed edges. Needs engines/sme-agent (or SME_LIB).
Usage: sme_pairs.py SNAPSHOT.json BASE_NAME TARGET_NAME [--hops 2] [--rules AN]"""
import argparse, json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import sme_bridge
from common import load_snapshot


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("snapshot"); ap.add_argument("base"); ap.add_argument("target")
    ap.add_argument("--hops", type=int, default=2); ap.add_argument("--rules", default="AN")
    a = ap.parse_args(argv)
    g = load_snapshot(a.snapshot)
    by = {}
    for n in g.nodes:
        by.setdefault(g.name(n).lower(), n)
    for nm in (a.base, a.target):
        if nm.lower() not in by:
            print("node not found:", nm); return 2
    res = sme_bridge.map_neighbourhoods(g, by[a.base.lower()], by[a.target.lower()], a.hops, a.rules)
    for r in res:
        for p in r["proposals"]:
            if p["kind"] == "edge":
                p["s_name"], p["t_name"] = g.name(p["s"]), g.name(p["t"])
    print(json.dumps(res, indent=2, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
