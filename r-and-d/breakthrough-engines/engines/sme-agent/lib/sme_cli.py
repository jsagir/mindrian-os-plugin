#!/usr/bin/env python3
"""CLI: python3 sme_cli.py BASE TARGET [--rules AN|LS|MA] [--known FILE] [--assess]
BASE/TARGET: .sme (Lisp-style defDescription) or .json (see sme.dgroup_from_dict).
--functions a,b,c   predicates to treat as functions (quantities), for .sme files."""
import argparse, json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import sme, breakthrough


def load(path, functions):
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    if path.endswith(".json"):
        return sme.dgroup_from_dict(json.loads(text))
    return sme.dgroup_from_text(text, functions=functions)


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("base"); ap.add_argument("target")
    ap.add_argument("--rules", default="AN", choices=sme.RULESETS)
    ap.add_argument("--functions", default="")
    ap.add_argument("--known", help="file with one known target claim per line")
    ap.add_argument("--assess", action="store_true", help="rank by breakthrough score")
    a = ap.parse_args(argv)
    fns = [x for x in a.functions.split(",") if x]
    b, t = load(a.base, fns), load(a.target, fns)
    if a.assess:
        known = open(a.known, encoding="utf-8").read().splitlines() if a.known else []
        out = breakthrough.assess(b, t, a.rules, known)
    else:
        out = sme.summarize(sme.match(b, t, a.rules))
    print(json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
