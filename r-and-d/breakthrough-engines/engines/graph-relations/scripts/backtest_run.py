#!/usr/bin/env python3
"""Temporal backtest. Usage: backtest.py SNAPSHOT.json [--cutoff ISO] [--frac 0.7] [--seed 7]
Prints hits and lift over chance for each method. Run this BEFORE trusting any method on the live graph."""
import argparse, json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import backtest
from common import load_snapshot


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("snapshot"); ap.add_argument("--cutoff"); ap.add_argument("--frac", type=float, default=0.7)
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args(argv)
    g = load_snapshot(a.snapshot)
    cutoff = a.cutoff or backtest.choose_cutoff(g, a.frac)
    print(json.dumps(backtest.evaluate(g, cutoff, seed=a.seed), indent=2, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
