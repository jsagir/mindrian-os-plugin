"""Tests + before/after for detect-reverse-salients.py on a synthetic
.hsi-results.json. Run (from package-2026/):
   PYTHONDONTWRITEBYTECODE=1 python3 -I rs/_tests/engine/test_detect.py"""
import json, os, random, shutil, subprocess, sys, tempfile, unittest
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__)); PKG = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
NEW = os.path.join(PKG, "rs", "shared", "scripts", "detect-reverse-salients.py")
OLD = os.path.join(PKG, "_baseline", "orig", "rs", "shared", "scripts", "detect-reverse-salients.py")


def jl(p):
    with open(p, encoding="utf-8") as fh:
        return json.load(fh)


def make_room(root, malformed=False):
    rng = random.Random(3)
    secs = ["market", "tech", "ops", "legal"]
    arts, pairs = [], []
    os.makedirs(root, exist_ok=True)
    for s in secs:
        os.makedirs(os.path.join(root, s), exist_ok=True)
        for k in range(3):
            aid = f"{s}/{s}-{k}"
            body = (f"The main problem is that {s} work cannot scale under load. " if k == 0 else
                    f"We propose a method using caching to speed up {s} work for every team. ")
            with open(os.path.join(root, s, f"{s}-{k}.md"), "w", encoding="utf-8") as fh:
                fh.write(body * 3)
            arts.append({"id": aid, "section": s, "title": aid, "path": f"{s}/{s}-{k}.md"})
    ids = [a["id"] for a in arts]
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            if ids[i].split("/")[0] == ids[j].split("/")[0]:
                continue
            lsa, sem = round(rng.uniform(0.0, 0.8), 3), round(rng.uniform(0.0, 0.8), 3)
            integ = rng.uniform(0.2, 0.8)
            pairs.append({"left_id": ids[i], "right_id": ids[j], "lsa_sim": lsa, "semantic_sim": sem,
                          "hsi_score": round(0.6 * abs(lsa - sem) + 0.4 * integ, 4), "spectral_gap_avg": round(rng.uniform(0, 0.5), 3)})
    # planted: low semantic (same words, different meaning) - old min_similarity floor kills it
    pairs.append({"left_id": "market/market-0", "right_id": "legal/legal-1", "lsa_sim": 0.70, "semantic_sim": 0.05, "hsi_score": 0.62, "spectral_gap_avg": 0.3})
    # planted: weak raw gap, qualifies on integrative factor alone
    pairs.append({"left_id": "tech/tech-2", "right_id": "ops/ops-2", "lsa_sim": 0.40, "semantic_sim": 0.42, "hsi_score": 0.95, "spectral_gap_avg": 0.1})
    if malformed:
        pairs += [{"left_id": "tech/tech-0"}, {"left_id": "a", "right_id": "b", "hsi_score": None, "lsa_sim": 0.1, "semantic_sim": 0.1}]
    with open(os.path.join(root, ".hsi-results.json"), "w", encoding="utf-8") as fh:
        json.dump({"artifacts": arts, "hsi_pairs": pairs}, fh)


def run(script, room, *args):
    r = subprocess.run([sys.executable, "-I", script, room] + list(args), capture_output=True, text=True,
                       env=dict(os.environ, PYTHONDONTWRITEBYTECODE="1"), timeout=60)
    return r.returncode, r.stderr


class T(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="rs-detect-")
        self.room = os.path.join(self.tmp, "room"); make_room(self.room)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _copy(self, name, malformed=False):
        d = os.path.join(self.tmp, name); make_room(d, malformed); return d

    def test_legacy_matches_original(self):
        a, b = self._copy("a"), self._copy("b")
        self.assertEqual(run(OLD, a)[0], 0); self.assertEqual(run(NEW, b, "--scoring", "legacy", "--no-verify")[0], 0)
        ra, rb = jl(os.path.join(a, ".hsi-results.json"))["reverse_salients"], jl(os.path.join(b, ".hsi-results.json"))["reverse_salients"]
        self.assertEqual(len(ra), len(rb))
        for x, y in zip(ra, rb):
            for k in x:
                self.assertEqual(x[k], y[k], k)

    def test_hybrid_keeps_low_semantic_pair_and_flags_weak_gap(self):
        a, b = self._copy("a"), self._copy("b")
        run(OLD, a); self.assertEqual(run(NEW, b)[0], 0)
        old_pairs = {(r["source_artifact"], r["target_artifact"]) for r in jl(os.path.join(a, ".hsi-results.json"))["reverse_salients"]}
        new = jl(os.path.join(b, ".hsi-results.json"))["reverse_salients"]
        lows = [r for r in new if {r["source_artifact"], r["target_artifact"]} == {"market/market-0", "legal/legal-1"}]
        self.assertTrue(lows, "same-words/different-meaning pair must survive in hybrid")
        self.assertFalse(any({s, t} == {"market/market-0", "legal/legal-1"} for s, t in old_pairs), "original dropped it via min_similarity")
        weak = [r for r in new if {r["source_artifact"], r["target_artifact"]} == {"tech/tech-2", "ops/ops-2"}]
        self.assertTrue(weak and weak[0]["verification"]["second_signal"]["status"] == "weak_gap_driven_by_integrative_factor")
        v = lows[0]["verification"]
        self.assertEqual(v["second_signal"]["status"], "confirmed")
        self.assertEqual(v["novelty"]["status"], "unchecked_external")
        self.assertTrue(v["claim_evidence"] and v["claim_evidence"]["problem_sentence"])

    def test_additive_keys_only(self):
        b = self._copy("b"); run(NEW, b)
        d = jl(os.path.join(b, ".hsi-results.json"))
        need = {"opportunity_id", "source_section", "target_section", "source_artifact", "target_artifact", "innovation_type",
                "differential_score", "breakthrough_potential", "spectral_gap_avg", "left_dominant_mode", "right_dominant_mode", "innovation_thesis"}
        self.assertTrue(all(need <= set(r) for r in d["reverse_salients"]))
        self.assertIn("artifacts", d); self.assertIn("hsi_pairs", d)

    def test_malformed_pairs_do_not_crash(self):
        d = self._copy("m", malformed=True)
        rc, err = run(NEW, d); self.assertEqual(rc, 0, err); self.assertIn("skipped 2", err)
        rc_old, err_old = run(OLD, self._copy("m2", malformed=True))
        self.assertNotEqual(rc_old, 0, "original crashes (KeyError) on malformed pairs")

    def test_top_n_negative_and_zero(self):
        self.assertEqual(run(NEW, self._copy("n1"), "--top-n", "-1")[0], 2)
        self.assertEqual(run(NEW, self._copy("n0"), "--top-n", "0")[0], 2)

    def test_direction_convention_A_flips(self):
        b, c = self._copy("b"), self._copy("c")
        run(NEW, b); run(NEW, c, "--direction-convention", "A")
        rb = {(r["opportunity_id"]): r for r in jl(os.path.join(b, ".hsi-results.json"))["reverse_salients"]}
        rc = jl(os.path.join(c, ".hsi-results.json"))["reverse_salients"]
        flipped = [r for r in rc if r["opportunity_id"] in rb and r["innovation_type"] != rb[r["opportunity_id"]]["innovation_type"]]
        self.assertTrue(flipped)

    def test_path_traversal_ignored(self):
        outside = os.path.join(self.tmp, "outside.md")
        with open(outside, "w", encoding="utf-8") as fh:
            fh.write("The SECRETMARKER problem is that nothing can be done here at all. " * 3)
        d = self._copy("t"); p = os.path.join(d, ".hsi-results.json"); data = jl(p)
        for a in data["artifacts"]:
            a["path"] = "../outside.md"
        with open(p, "w") as fh:
            json.dump(data, fh)
        self.assertEqual(run(NEW, d)[0], 0)
        self.assertNotIn("SECRETMARKER", json.dumps(jl(p)))

    def test_deterministic(self):
        a, b = self._copy("a"), self._copy("b"); run(NEW, a, "--no-verify"); run(NEW, b, "--no-verify")
        strip = lambda d: [r for r in jl(os.path.join(d, ".hsi-results.json"))["reverse_salients"]]
        self.assertEqual(strip(a), strip(b))

    def test_no_em_dash(self):
        with open(NEW, encoding="utf-8") as fh:
            self.assertNotIn("\u2014", fh.read())


if __name__ == "__main__":
    unittest.main(verbosity=2)
