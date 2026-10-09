"""Static checks for the fixtures and the agent .md. Run (from package-2026/):
   PYTHONDONTWRITEBYTECODE=1 python3 -I rs/_tests/engine/test_static_files.py"""
import json, os, re, sys, unittest
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__)); PKG = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
NEW = os.path.join(PKG, "rs", "shared"); OLD = os.path.join(PKG, "_baseline", "orig", "rs", "shared")
FIX = ["rs-convergence", "rs-family", "rs-reverse-salient"]

def rd(p):
    with open(p, encoding="utf-8") as fh:
        return fh.read()

class T(unittest.TestCase):
    def test_fixtures(self):
        for n in FIX:
            new = json.loads(rd(f"{NEW}/data/hitl-stages-fixtures/{n}.json")); old = json.loads(rd(f"{OLD}/data/hitl-stages-fixtures/{n}.json"))
            self.assertTrue(set(old) <= set(new), n)
            self.assertEqual(new["schema_version"], "2026.1")
            for k in old:
                self.assertEqual(old[k], new[k], f"{n}.{k} must be unchanged")
            self.assertEqual(new["surface"], n)
            for st in new["hitl_stages"]:
                self.assertIn(st["mode"], {"ordered", "parallel", "gate"})
                self.assertTrue(all(re.fullmatch(r"F\.\d+", s) for s in st["shapes"]))
                self.assertTrue(st["stage"].strip())

    def test_agent_md_frontmatter_identical_and_body_present(self):
        new, old = rd(f"{NEW}/agents/reverse-salient-agent.md"), rd(f"{OLD}/agents/reverse-salient-agent.md")
        fm = lambda s: s.split("\n---\n", 1)[0]
        self.assertEqual(fm(new), fm(old), "frontmatter must be key-compatible (byte identical here)")
        self.assertNotIn("Wave-0 stub", new)
        for h in ("## Inputs", "## Output", "## Failure behaviour", "## Stop"):
            self.assertIn(h, new)

    def test_agent_md_mentions_only_real_reason_codes(self):
        new = rd(f"{NEW}/agents/reverse-salient-agent.md"); cjs = rd(f"{NEW}/lib/agents/reverse-salient-agent.cjs")
        for code in re.findall(r"`((?:invalid_room_dir|rs_engine_[a-z_]+))`", new):
            self.assertIn(code, cjs, code)

    def test_no_em_dash_in_shipped_and_test_files(self):
        roots = [os.path.join(NEW, "scripts"), os.path.join(NEW, "agents"), os.path.join(NEW, "data"),
                 os.path.join(NEW, "lib", "agents"), os.path.join(NEW, "lib", "memory"), HERE]
        for root in roots:
            for dp, _d, files in os.walk(root):
                if os.sep + "results" in dp or os.sep + "work" in dp:
                    continue
                for f in files:
                    if f.endswith((".py", ".cjs", ".md", ".json", ".txt")):
                        self.assertNotIn(chr(0x2014), rd(os.path.join(dp, f)), os.path.join(dp, f))


if __name__ == "__main__":
    unittest.main(verbosity=2)
