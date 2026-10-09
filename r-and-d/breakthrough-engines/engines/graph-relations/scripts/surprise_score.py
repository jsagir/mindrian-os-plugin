#!/usr/bin/env python3
"""Score Bayesian surprise from collected probabilities.
Usage: surprise_score.py BELIEFS.json OUT.json
BELIEFS.json: [{"id": "...", "claim": "...", "prior": [0.4, 0.5, 0.45], "posterior": [0.8, 0.7, 0.75]}, ...]
Each list holds one probability per model or persona (closed-book prior, evidence-grounded posterior).
Also: surprise_score.py --prompt CLAIM [--evidence "e1" "e2"]  prints the closed- or open-book prompt."""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import surprise


def main(a):
    if a and a[0] == "--prompt":
        claim = a[1]
        ev = a[a.index("--evidence") + 1:] if "--evidence" in a else None
        print(surprise.open_book_prompt(claim, ev) if ev else surprise.closed_book_prompt(claim))
        return 0
    if len(a) != 2:
        print(__doc__); return 2
    rows = json.load(open(a[0], encoding="utf-8"))
    out = []
    for r in rows:
        s = surprise.score(r["prior"], r["posterior"])
        s.update({"id": r["id"], "claim": r.get("claim", "")})
        out.append(s)
    out.sort(key=lambda x: (x["ignorance_risk"], -x["surprise_bits"], -x["test_priority"]))
    json.dump(out, open(a[1], "w", encoding="utf-8"), indent=2)
    print(f"{len(out)} scored -> {a[1]}; flagged ignorance_risk: {sum(1 for x in out if x['ignorance_risk'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
