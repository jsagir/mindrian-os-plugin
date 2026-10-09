"""Tests for the 2026 rs-engine.py. Run:
   PYTHONDONTWRITEBYTECODE=1 python3 -I rs/_tests/engine/test_rs_engine.py
(from package-2026/). Everything is offline; the dense encoder and sklearn are
stubs (see synth.py / stub_rs_math.py / make_tree.py)."""
import importlib.util, json, os, shutil, subprocess, sys, tempfile, unittest
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
PKG = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, HERE)
import make_tree, synth
import numpy as np

ENGINE_SRC = os.path.join(PKG, "rs", "shared", "scripts", "rs-engine.py")
ORIG_SRC = os.path.join(PKG, "_baseline", "orig", "rs", "shared", "scripts", "rs-engine.py")


def jl(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def rd(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def load(path):
    sys.path.insert(0, os.path.join(os.path.dirname(path), "lib"))
    spec = importlib.util.spec_from_file_location("rs_engine_" + str(abs(hash(path))), path)
    m = importlib.util.module_from_spec(spec)
    parent = os.path.dirname(os.path.dirname(path))
    sys.path.insert(0, parent)
    spec.loader.exec_module(m)
    return m


class Base(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="rs-engine-test-")
        cls.after_engine, cls.real_math = make_tree.build(os.path.join(cls.tmp, "after"), ENGINE_SRC, PKG)
        cls.before_engine, _ = make_tree.build(os.path.join(cls.tmp, "before"), ORIG_SRC, PKG)
        os.environ["RS_REAL_MATH"] = cls.real_math
        cls.room = os.path.join(cls.tmp, "room")
        cls.truth = synth.make_corpus(cls.room)
        cls.mod = load(cls.after_engine)
        cls.mod._embed_local_minilm = lambda t: synth.stub_dense_embed(list(t))

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def run_cli(self, engine, args, mode="stub", env=None):
        e = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", **(env or {}))
        r = subprocess.run([sys.executable, "-I", os.path.join(HERE, "drive_engine.py"), engine, mode] + args,
                           capture_output=True, text=True, env=e, timeout=170)
        return r.returncode, r.stderr


class TestPureFunctions(Base):
    def test_percentile_ties_and_range(self):
        m = np.array([[0, 1, 1, 3], [1, 0, 2, 4], [1, 2, 0, 5], [3, 4, 5, 0]], float)
        p = self.mod.percentile_rank_matrix(m)
        self.assertTrue(np.allclose(p, p.T))
        self.assertAlmostEqual(p[0, 1], p[0, 2])          # tie -> same percentile
        self.assertEqual(p[2, 3], 1.0)
        self.assertGreaterEqual(p[np.triu_indices(4, 1)].min(), 0.0)

    def test_percentile_degenerate(self):
        self.assertEqual(self.mod.percentile_rank_matrix(np.zeros((1, 1))).shape, (1, 1))
        self.assertEqual(self.mod.percentile_rank_matrix(np.zeros((0, 0))).shape, (0, 0))
        two = self.mod.percentile_rank_matrix(np.array([[0, .5], [.5, 0]]))
        self.assertEqual(two[0, 1], 1.0)

    def test_zscore_zero_variance(self):
        z = self.mod.zscore_matrix(np.ones((5, 5)))
        self.assertTrue((z == 0).all())

    def test_bm25(self):
        texts = ["alpha beta gamma delta", "alpha beta gamma delta", "zeta eta theta iota", ""]
        s = self.mod.bm25_similarity_matrix(texts)
        self.assertAlmostEqual(float(s[0, 1]), 1.0, places=5)
        self.assertAlmostEqual(float(s[0, 2]), 0.0, places=5)
        self.assertEqual(float(s[3, 3]), 0.0)               # empty doc: no NaN
        self.assertFalse(np.isnan(s).any())
        self.assertEqual(self.mod.bm25_similarity_matrix([]).shape, (0, 0))
        self.assertTrue((self.mod.bm25_similarity_matrix(["the of and"] * 3) == np.eye(3)).all())

    def test_cosine_zero_norm(self):
        c = self.mod.cosine_matrix(np.array([[0, 0], [1, 0], [1, 0]], float))
        self.assertFalse(np.isnan(c).any())
        self.assertAlmostEqual(float(c[1, 2]), 1.0, places=5)

    def test_hashing_embedder_deterministic(self):
        a = self.mod._embed_hashing(["hello world of rooms"])
        b = self.mod._embed_hashing(["hello world of rooms"])
        self.assertTrue((a == b).all())

    def test_frontmatter_crlf(self):
        c = "---\r\ntitle: x\r\n---\r\nBody text here"
        self.assertEqual(self.mod.parse_frontmatter(c).get("title"), "x")
        self.assertEqual(self.mod.extract_body(c).strip(), "Body text here")

    def test_embedding_unknown_model_cache_key(self):
        os.environ["RS_EMBEDDING_MODEL"] = "no-such-model"
        try:
            d = tempfile.mkdtemp(dir=self.tmp)
            arts = [{"id": "a", "text": "x" * 60}, {"id": "b", "text": "y" * 60}]
            calls = []
            old = self.mod._embed_local_minilm
            self.mod._embed_local_minilm = lambda t: (calls.append(1), synth.stub_dense_embed(list(t)))[1]
            self.mod.compute_embeddings(arts, self.mod.Path(d))
            self.mod.compute_embeddings(arts, self.mod.Path(d))
            self.assertEqual(len(calls), 1, "second call must hit the cache (original re-embedded forever)")
            self.mod._embed_local_minilm = old
        finally:
            os.environ.pop("RS_EMBEDDING_MODEL", None)

    def test_e5_stub_falls_back_not_crash(self):
        os.environ["RS_EMBEDDING_MODEL"] = "multilingual-e5-large"
        try:
            d = tempfile.mkdtemp(dir=self.tmp)
            arts = [{"id": "a", "text": "x" * 60}, {"id": "b", "text": "y" * 60}]
            self.mod._EMBED_FALLBACKS.clear()
            m, name = self.mod.compute_embeddings(arts, self.mod.Path(d))
            self.assertEqual(name, "all-MiniLM-L6-v2")
            self.assertTrue(self.mod._EMBED_FALLBACKS)
        finally:
            os.environ.pop("RS_EMBEDDING_MODEL", None)
            self.mod._EMBED_FALLBACKS.clear()


class TestScorerAndModes(Base):
    def test_internal_hybrid_recovers_planted_and_has_verification(self):
        out = os.path.join(self.tmp, "o1.json")
        rc, err = self.run_cli(self.after_engine, ["--mode", "internal", "--room", self.room, "--topk", "10", "--output", out])
        self.assertEqual(rc, 0, err)
        d = jl(out)
        keys = {frozenset((p["source_artifact_id"], p["target_artifact_id"])): p for p in d["pairs"]}
        for pr in (("alpha/planted-p", "delta/planted-q"), ("beta/planted-x", "epsilon/planted-y")):
            self.assertIn(frozenset(pr), keys)
        p = keys[frozenset(("alpha/planted-p", "delta/planted-q"))]
        self.assertEqual(p["direction"], "structural_transfer")
        v = p["verification"]
        self.assertEqual(v["second_signal"]["status"], "confirmed")
        self.assertEqual(v["novelty"]["status"], "unchecked_external")
        self.assertTrue(all(t["source_id"] and t["retrieval_date"] for t in v["source_trail"]))
        self.assertTrue(v["claim_evidence"]["problem_sentence"] and v["claim_evidence"]["method_sentence"])
        self.assertEqual(d["metadata"]["scoring"], "hybrid")
        self.assertIn("provenance", d["metadata"])

    def test_legacy_identical_to_original(self):
        a, b = os.path.join(self.tmp, "a.json"), os.path.join(self.tmp, "b.json")
        self.assertEqual(self.run_cli(self.before_engine, ["--mode", "internal", "--room", self.room, "--topk", "15", "--output", a])[0], 0)
        self.assertEqual(self.run_cli(self.after_engine, ["--mode", "internal", "--room", self.room, "--topk", "15", "--scoring", "legacy", "--output", b])[0], 0)
        pa, pb = jl(a)["pairs"], jl(b)["pairs"]
        self.assertEqual(len(pa), len(pb))
        for x, y in zip(pa, pb):
            for k in x:
                self.assertEqual(x[k], y[k], k)               # every original key identical
            self.assertTrue(set(y) > set(x))                  # additive keys only

    def test_backward_compat_keys_superset(self):
        a, b = os.path.join(self.tmp, "a2.json"), os.path.join(self.tmp, "b2.json")
        self.run_cli(self.before_engine, ["--mode", "internal", "--room", self.room, "--output", a])
        self.run_cli(self.after_engine, ["--mode", "internal", "--room", self.room, "--output", b])
        da, db = jl(a), jl(b)
        self.assertTrue(set(da["metadata"]) <= set(db["metadata"]))
        self.assertTrue(set(da["pairs"][0]) <= set(db["pairs"][0]))

    def test_deterministic(self):
        a, b = os.path.join(self.tmp, "d1.json"), os.path.join(self.tmp, "d2.json")
        for o in (a, b):
            self.run_cli(self.after_engine, ["--mode", "internal", "--room", self.room, "--output", o, "--no-verify"])
        strip = lambda d: [{k: v for k, v in p.items()} for p in d["pairs"]]
        self.assertEqual(strip(jl(a)), strip(jl(b)))

    def test_output_parent_dir_created(self):
        out = os.path.join(self.tmp, "deep", "er", "o.json")
        rc, err = self.run_cli(self.after_engine, ["--mode", "internal", "--room", self.room, "--output", out])
        self.assertEqual(rc, 0, err)
        self.assertTrue(os.path.exists(out))

    def test_previously_reported_novelty(self):
        out = os.path.join(self.tmp, "nov.json")
        self.run_cli(self.after_engine, ["--mode", "internal", "--room", self.room, "--output", out])
        self.run_cli(self.after_engine, ["--mode", "internal", "--room", self.room, "--output", out])
        d = jl(out)
        self.assertEqual(d["pairs"][0]["verification"]["novelty"]["status"], "previously_reported")

    def test_near_duplicate_flag(self):
        room = os.path.join(self.tmp, "duproom"); synth.make_corpus(room)
        txt = rd(os.path.join(room, "alpha", "planted-p.md"))
        for sec in ("delta",):
            with open(os.path.join(room, sec, "planted-q.md"), "w", encoding="utf-8", newline="") as fh:
                fh.write(txt)
        out = os.path.join(self.tmp, "dup.json")
        rc, err = self.run_cli(self.after_engine, ["--mode", "internal", "--room", room, "--output", out, "--min-percentile", "0", "--topk", "800"])
        self.assertEqual(rc, 0, err)
        st = [p["verification"]["novelty"]["status"] for p in jl(out)["pairs"] if "verification" in p and "status" in p["verification"].get("novelty", {})]
        self.assertIn("near_duplicate_text", st)

    def test_hashing_fallback_flags_degraded(self):
        out = os.path.join(self.tmp, "deg.json")
        fresh = os.path.join(self.tmp, "degroom"); synth.make_corpus(fresh)   # no embedding cache
        rc, err = self.run_cli(self.after_engine, ["--mode", "internal", "--room", fresh, "--output", out], mode="none")
        self.assertEqual(rc, 0, err)
        d = jl(out)
        self.assertTrue(d["metadata"]["dense_degraded"])
        self.assertTrue(all(p["verification"]["second_signal"]["status"] == "degraded_no_dense_model" for p in d["pairs"] if "second_signal" in p["verification"]))

    def test_tiny_room_and_empty(self):
        room = os.path.join(self.tmp, "tiny"); os.makedirs(os.path.join(room, "s"))
        with open(os.path.join(room, "s", "a.md"), "w") as fh:
            fh.write("x" * 80)
        out = os.path.join(self.tmp, "t.json")
        rc, err = self.run_cli(self.after_engine, ["--mode", "internal", "--room", room, "--output", out])
        self.assertEqual(rc, 0, err); self.assertEqual(jl(out)["pairs"], [])
        empty = os.path.join(self.tmp, "empty"); os.makedirs(empty)
        rc, err = self.run_cli(self.after_engine, ["--mode", "internal", "--room", empty, "--output", out])
        self.assertEqual(rc, 0, err)

    def test_bad_cli_values(self):
        self.assertEqual(self.run_cli(self.after_engine, ["--mode", "internal", "--room", self.room, "--min-percentile", "250"])[0], 2)
        self.assertEqual(self.run_cli(self.after_engine, ["--mode", "internal", "--room", self.room, "--lex-weight", "2"])[0], 2)

    def test_min_percentile_accepts_0_100(self):
        o1, o2 = os.path.join(self.tmp, "p1.json"), os.path.join(self.tmp, "p2.json")
        self.run_cli(self.after_engine, ["--mode", "internal", "--room", self.room, "--min-percentile", "95", "--output", o1, "--no-verify", "--topk", "500"])
        self.run_cli(self.after_engine, ["--mode", "internal", "--room", self.room, "--min-percentile", "0.95", "--output", o2, "--no-verify", "--topk", "500"])
        self.assertEqual(len(jl(o1)["pairs"]), len(jl(o2)["pairs"]))

    def test_cross_room(self):
        room2 = os.path.join(self.tmp, "room2"); synth.make_corpus(room2, seed=21)
        out = os.path.join(self.tmp, "cr.json")
        rc, err = self.run_cli(self.after_engine, ["--rooms", self.room, room2, "--topk", "5", "--output", out])
        self.assertEqual(rc, 0, err)
        d = jl(out)
        self.assertTrue(d["pairs"])
        self.assertTrue(all(p["source_room"] != p["target_room"] for p in d["pairs"]))
        self.assertTrue(all("verification" in p for p in d["pairs"]))

    def test_hybrid_mode_offline(self):
        out = os.path.join(self.tmp, "hy.json")
        rc, err = self.run_cli(self.after_engine, ["--mode", "hybrid", "--room", self.room, "--topic", "synthetic topic", "--topk", "5", "--output", out],
                               env={"RS_TEST_OFFLINE_EXTERNAL": "1"})
        self.assertEqual(rc, 0, err)
        d = jl(out)
        self.assertTrue(d["pairs"])
        top = d["pairs"][0]
        self.assertEqual((top["source_artifact"], top["target_external_id"]), ("alpha/planted-p", "W1000"))
        self.assertTrue(all(p["source_room"] == "room" and p["target_external_id"] for p in d["pairs"]))

    def test_external_mode_offline(self):
        out = os.path.join(self.tmp, "ex.json")
        rc, err = self.run_cli(self.after_engine, ["--mode", "external", "--room", self.room, "--topic", "synthetic topic", "--topk", "5", "--output", out],
                               env={"RS_TEST_OFFLINE_EXTERNAL": "1"})
        self.assertEqual(rc, 0, err)
        d = jl(out)
        self.assertEqual(d["metadata"]["mode"], "external")
        self.assertTrue(d["pairs"] and d["pairs"][0]["source_url"].startswith("https://"))

    def test_no_em_dash_or_emoji_in_engine(self):
        txt = rd(ENGINE_SRC)
        self.assertNotIn("\u2014", txt)
        self.assertFalse(any(ord(c) > 0x2FFF for c in txt))


if __name__ == "__main__":
    unittest.main(verbosity=2)
