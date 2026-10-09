import json, os, sys, tempfile, shutil
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import test_detect as t
tmp = tempfile.mkdtemp(prefix="rs-detect-cmp-")
lines = ["detect-reverse-salients.py before/after on one synthetic .hsi-results.json (4 sections x 3 artifacts, 54 cross-section pairs + 2 planted)"]
for name, script, args in (("before (original)", t.OLD, []), ("after --scoring legacy", t.NEW, ["--scoring", "legacy", "--no-verify"]), ("after --scoring hybrid (new default)", t.NEW, [])):
    room = os.path.join(tmp, name.split()[0] + str(len(args))); t.make_room(room)
    rc, err = t.run(script, room, *args)
    rs = t.jl(os.path.join(room, ".hsi-results.json"))["reverse_salients"]
    lines.append(f"== {name}: exit {rc}; {err.strip()}")
    for r in rs:
        flag = ""
        if {r["source_artifact"], r["target_artifact"]} == {"market/market-0", "legal/legal-1"}: flag = "  <- planted: same words, different meaning (sem 0.05)"
        if {r["source_artifact"], r["target_artifact"]} == {"tech/tech-2", "ops/ops-2"}: flag = "  <- planted: no real gap (lsa 0.40 vs sem 0.42)"
        v = r.get("verification", {}).get("second_signal", {}).get("status", "-")
        lines.append(f"  {r['opportunity_id']} {r['source_artifact']:16s}->{r['target_artifact']:16s} {r['innovation_type'][:10]:10s} diff={r['differential_score']:.3f} bt={r['breakthrough_potential']:.3f} second_signal={v}{flag}")
res = os.path.join(HERE, "results"); os.makedirs(res, exist_ok=True)
open(os.path.join(res, "detect_before_after.txt"), "w").write("\n".join(lines) + "\n")
print("\n".join(lines)); shutil.rmtree(tmp, ignore_errors=True)
