"""Legacy vs hybrid over several synthetic rooms (different background noise)."""
import json, os, subprocess, sys, tempfile
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__)); PKG = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, HERE)
import make_tree, synth
tmp = tempfile.mkdtemp(prefix="rs-multi-")
eng, real = make_tree.build(os.path.join(tmp, "after"), os.path.join(PKG, "rs", "shared", "scripts", "rs-engine.py"), PKG)
env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", RS_REAL_MATH=real)
planted = {frozenset(("alpha/planted-p", "delta/planted-q")): "structural_transfer",
           frozenset(("beta/planted-x", "epsilon/planted-y")): "semantic_implementation"}
TOPK = 5
ENC = sys.argv[1] if len(sys.argv) > 1 else "stub"
rows, tot = [], {"legacy": [0, 0], "hybrid": [0, 0]}
for seed in range(1, 9):
    room = os.path.join(tmp, f"r{seed}"); synth.make_corpus(room, seed=seed)
    line = f"seed {seed}:"
    for scoring in ("legacy", "hybrid"):
        out = os.path.join(tmp, f"{scoring}{seed}.json")
        subprocess.run([sys.executable, "-I", os.path.join(HERE, "drive_engine.py"), eng, ENC, "--mode", "internal", "--room", room,
                        "--topk", str(TOPK), "--scoring", scoring, "--no-verify", "--output", out], env=env, capture_output=True, text=True, check=True)
        pairs = json.load(open(out))["pairs"]
        if not pairs:
            line += f"  {scoring}: NO PAIRS RETURNED;"
        hit = [(frozenset((p["source_artifact_id"], p["target_artifact_id"])) in planted) for p in pairs]
        ok = sum(1 for p in pairs if planted.get(frozenset((p["source_artifact_id"], p["target_artifact_id"]))) == p["direction"])
        prec = sum(hit) / max(1, len(pairs))
        tot[scoring][0] += ok; tot[scoring][1] += prec
        line += f"  {scoring}: planted-with-correct-direction {ok}/2, precision@{TOPK} {prec:.2f};"
    rows.append(line)
rows.append(f"TOTAL legacy planted {tot['legacy'][0]}/16, mean precision@{TOPK} {tot['legacy'][1]/8:.3f}")
rows.append(f"TOTAL hybrid planted {tot['hybrid'][0]}/16, mean precision@{TOPK} {tot['hybrid'][1]/8:.3f}")
os.makedirs(os.path.join(HERE, "results"), exist_ok=True)
open(os.path.join(HERE, "results", f"multi_seed_{ENC}.txt"), "w").write("\n".join(rows) + "\n")
print("\n".join(rows))
