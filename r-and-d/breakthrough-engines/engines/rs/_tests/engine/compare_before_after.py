"""Before/after on one synthetic corpus. Writes results/ with raw JSON and a
text summary. Run: python3 -I compare_before_after.py"""
import json, os, subprocess, sys, tempfile
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
PKG = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, HERE)
import make_tree, synth

def run(tree_engine, mode, args, env):
    cmd = [sys.executable, "-I", os.path.join(HERE, "drive_engine.py"), tree_engine, mode] + args
    r = subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=170)
    return r.returncode, r.stderr

def main():
    tmp = tempfile.mkdtemp(prefix="rs-engine-cmp-")
    room = os.path.join(tmp, "room")
    truth = synth.make_corpus(room)
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
    before_e, real_math = make_tree.build(os.path.join(tmp, "before"), os.path.join(PKG, "_baseline", "orig", "rs", "shared", "scripts", "rs-engine.py"), PKG)
    after_e, _ = make_tree.build(os.path.join(tmp, "after"), os.path.join(PKG, "rs", "shared", "scripts", "rs-engine.py"), PKG)
    env["RS_REAL_MATH"] = real_math
    out = {}
    for name, eng, extra in (("before_legacy", before_e, []),
                             ("after_legacy", after_e, ["--scoring", "legacy", "--no-verify"]),
                             ("after_hybrid", after_e, [])):
        outp = os.path.join(tmp, name + ".json")
        rc, err = run(eng, "stub", ["--mode", "internal", "--room", room, "--topk", "10", "--output", outp] + extra, env)
        out[name] = (rc, err.strip().splitlines()[-1] if err.strip() else "", json.load(open(outp)) if rc == 0 else None)
    planted = {}
    for d, prs in truth.items():
        for a, b in prs:
            planted[frozenset((a, b))] = d
    lines = ["Synthetic room: 5 sections x 8 notes + 4 planted notes (2 planted pairs).",
             "Planted: " + json.dumps({k: v for k, v in truth.items()}),
             "Dense encoder: STUB concept-collapsing embedder (not a real model).", ""]
    summary = {}
    for name, (rc, last, data) in out.items():
        lines.append(f"== {name} (exit {rc}) :: {last}")
        pairs = data["pairs"]
        ranks = {}
        for r, p in enumerate(pairs, 1):
            k = frozenset((p["source_artifact_id"], p["target_artifact_id"]))
            if k in planted:
                ranks[tuple(sorted(k))] = (r, p["direction"], planted[k])
        for p in pairs:
            tag = "PLANTED" if frozenset((p["source_artifact_id"], p["target_artifact_id"])) in planted else ""
            lines.append(f"  {p['source_artifact_id']:26s} {p['target_artifact_id']:26s} {p['direction'][:10]:10s} lsa={p['lsa_score']:.3f} sem={p['semantic_score']:.3f} abs={p['abs_diff']:.3f} {tag}")
        found = len(ranks)
        dir_ok = sum(1 for (r, d, t) in ranks.values() if d == t)
        lines.append(f"  planted recovered in top-10: {found}/2; direction correct: {dir_ok}/{found}; ranks: {ranks}")
        lines.append("")
        summary[name] = {"recovered": found, "direction_ok": dir_ok, "n_pairs": len(pairs)}
    # backward-compat: legacy path must reproduce the original pairs exactly
    b = out["before_legacy"][2]["pairs"]; a = out["after_legacy"][2]["pairs"]
    same = [(p["source_artifact_id"], p["target_artifact_id"], p["lsa_score"], p["semantic_score"], p["abs_diff"], p["direction"]) for p in b] == \
           [(p["source_artifact_id"], p["target_artifact_id"], p["lsa_score"], p["semantic_score"], p["abs_diff"], p["direction"]) for p in a]
    lines.append(f"legacy path reproduces original pairs exactly: {same}")
    summary["legacy_identical"] = same
    ok_keys = all(set(pb) <= set(pa) for pb, pa in zip(b, out["after_hybrid"][2]["pairs"])) if out["after_hybrid"][2]["pairs"] else False
    lines.append(f"hybrid pair keys are a superset of original pair keys: {ok_keys}")
    summary["hybrid_keys_superset"] = ok_keys
    res = os.path.join(HERE, "results"); os.makedirs(res, exist_ok=True)
    for name, (rc, last, data) in out.items():
        json.dump(data, open(os.path.join(res, name + ".json"), "w"), indent=2)
    open(os.path.join(res, "before_after.txt"), "w").write("\n".join(lines) + "\n")
    print("\n".join(lines)); print(json.dumps(summary))
main()
