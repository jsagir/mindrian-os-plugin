import importlib.util, json, os, sys, tempfile, unittest, io, contextlib, hashlib
from pathlib import Path
os.environ["HSI_NO_AUTO_INSTALL"] = "1"
import numpy as np
SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"

def load(name, fname):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / fname)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m

class FakeModel:
    DIM = 32
    def encode(self, texts, show_progress_bar=False):
        out = np.zeros((len(texts), self.DIM))
        for i, t in enumerate(texts):
            for w in str(t).lower().split():
                out[i, int(hashlib.md5(w.encode()).hexdigest(), 16) % self.DIM] += 1
        return out

BODY_A = ("Water treatment is a major problem for rural clinics and the bottleneck is power supply. " * 6)
BODY_B = ("A solar membrane approach applies filtration design to remove contaminants from groundwater. " * 6)

def make_room(root):
    for sec, name, body in [("problem-definition", "a.md", BODY_A), ("solution-design", "b.md", BODY_B),
                            ("market-analysis", "c.md", "Market size for clinics in rural regions is large and growing. " * 8)]:
        d = Path(root) / sec; d.mkdir(parents=True, exist_ok=True)
        (d / name).write_text("# " + name + "\n\n" + body, encoding="utf-8")
    (Path(root) / "WHITESPACE.md").write_text("# generated\n" + "zzz " * 50, encoding="utf-8")

class EmbeddingsTests(unittest.TestCase):
    def setUp(self):
        self.mod = load("emb", "compute-whitespace-embeddings.py")
        self.tmp = tempfile.mkdtemp(); make_room(self.tmp)
        self.mod.load_embedding_model = lambda m=None: (FakeModel(), self.mod.FALLBACK_MODEL, FakeModel.DIM)

    def run_main(self, *extra):
        old = sys.argv; sys.argv = ["x", self.tmp, *extra]
        err = io.StringIO()
        try:
            with contextlib.redirect_stderr(err):
                try: self.mod.main()
                except SystemExit as e: return e.code, err.getvalue()
        finally: sys.argv = old
        return None, err.getvalue()

    def out(self):
        return json.loads((Path(self.tmp) / ".mindrian" / "whitespace-embeddings.json").read_text())

    def test_skips_generated_file_and_writes_schema(self):
        self.run_main()
        d = self.out()
        self.assertEqual(len(d["embeddings"]), 3)
        self.assertEqual(d["metadata"]["schema_version"], "2.0")
        self.assertFalse(any("WHITESPACE" in e["path"] for e in d["embeddings"]))

    def test_cache_hits_with_fallback_model(self):
        self.run_main()
        calls = []
        self.mod.load_embedding_model = lambda m=None: calls.append(1) or (FakeModel(), self.mod.FALLBACK_MODEL, 32)
        code, err = self.run_main()
        self.assertEqual(code, 0); self.assertIn("cache hit", err); self.assertEqual(calls, [])

    def test_settings_change_invalidates_cache(self):
        self.run_main()
        code, err = self.run_main("--no-chunking")
        self.assertNotIn("cache hit", err)
        self.assertEqual(self.out()["metadata"]["settings"]["chunk_words"], 0)

    def test_claims_option(self):
        self.run_main("--claims")
        cv = [c for e in self.out()["embeddings"] for c in e["claim_vectors"]]
        self.assertTrue(cv)
        self.assertEqual(len(cv[0]["vector"]), 32)
        self.assertEqual({c["kind"] for c in cv}, {"problem", "method"})

    def test_chunking_changes_long_doc_vector(self):
        arts = [{"id": "x", "text": "alpha " * 300 + "omega " * 300}]
        v0 = self.mod.embed_artifacts(FakeModel(), arts, 0)[0]
        v1 = self.mod.embed_artifacts(FakeModel(), arts, 100)[0]
        self.assertNotEqual(v0, v1)
        self.assertAlmostEqual(float(np.linalg.norm(v1)), 1.0, places=6)

    def test_bad_encoder_raises(self):
        class Bad:
            def encode(self, t, show_progress_bar=False): return np.full((len(t), 4), np.nan)
        with self.assertRaises(ValueError):
            self.mod.embed_artifacts(Bad(), [{"id": "a", "text": "x"}], 0)

class GapsTests(unittest.TestCase):
    def setUp(self):
        self.mod = load("gaps", "compute-whitespace-gaps.py")
        self.tmp = tempfile.mkdtemp(); make_room(self.tmp)
        rng = np.random.default_rng(1)
        m = Path(self.tmp) / ".mindrian"; m.mkdir()
        room = rng.normal(size=(8, 24)); room[:, :4] += 4  # clustered room
        self.items = []
        for i in range(8):
            self.items.append({"id": "art-%d" % i, "section": "s%d" % (i % 2), "title": "Artifact %d" % i,
                               "path": "problem-definition/a.md", "vector": room[i].tolist()})
        brain = rng.normal(size=(12, 24)); brain[:6, :4] += 4   # 6 near room, 6 far
        names = ["Near %d" % i for i in range(6)] + ["Far %d" % i for i in range(6)]
        (m / "whitespace-embeddings.json").write_text(json.dumps({"metadata": {"model_name": "t"}, "embeddings": self.items}))
        (m / "brain-baseline.json").write_text(json.dumps({"metadata": {"model_name": "t"},
            "baselines": [{"name": n, "vector": v.tolist(), "description": n + " framework"} for n, v in zip(names, brain)]}))

    def test_hybrid_prefers_far_frameworks(self):
        r = self.mod.run_whitespace_analysis(self.tmp, gap_percentile=0.5)
        names = [g["brain_framework"] for g in r["gaps"]]
        self.assertTrue(names)
        far = sum(n.startswith("Far") for n in names)
        self.assertGreater(far, len(names) / 2)
        g = r["gaps"][0]
        for k in ("zone_id", "gap_id", "nearest_frameworks", "source_trail", "second_signal", "gap_percentile", "novelty_check"):
            self.assertIn(k, g)
        self.assertTrue(g["zone_id"].startswith("ws-"))
        self.assertIsInstance(g["nearest_room_artifacts"][0], dict)

    def test_schema_and_aliases(self):
        r = self.mod.run_whitespace_analysis(self.tmp)
        self.assertEqual(r["metadata"]["schema_version"], "2.0")
        n = r["novelty_scores"][0]
        self.assertEqual(n["artifact"], n["artifact_id"]); self.assertEqual(n["nearest_concept"], n["nearest_brain_framework"])
        self.assertIn(n["novelty_band"], ("novel", "moderate", "covered"))
        ra = r["umap_2d"]["room_artifacts"]
        self.assertEqual(len(ra), 8); self.assertIn("x", ra[0])
        self.assertEqual(r["metadata"]["provenance"]["reducer"], "pca")
        self.assertIn("umap unavailable", r["metadata"]["provenance"]["reducer_note"])

    def test_legacy_method_still_works(self):
        r = self.mod.run_whitespace_analysis(self.tmp, gap_method="legacy")
        for g in r["gaps"]: self.assertEqual(g["selection_method"], "legacy_room_density_p10")

    def test_deterministic(self):
        a = self.mod.run_whitespace_analysis(self.tmp); b = self.mod.run_whitespace_analysis(self.tmp)
        self.assertEqual([g["brain_framework"] for g in a["gaps"]], [g["brain_framework"] for g in b["gaps"]])

    def test_rs_boost_top_level_and_wrapped(self):
        gaps = [{"brain_framework": "Water Treatment"}, {"brain_framework": "Other"}]
        out = self.mod.rank_by_strategic_importance([dict(g) for g in gaps],
                {"reverse_salients": [{"section": "water", "differential_score": 1.0}]})
        self.assertIn("rs_boost", out[0])
        out2 = self.mod.rank_by_strategic_importance([dict(g) for g in gaps],
                {"data": {"reverse_salients": [{"section": "water", "differential_score": 1.0}]}})
        self.assertIn("rs_boost", out2[0])

    def test_dimension_mismatch_reports(self):
        p = Path(self.tmp) / ".mindrian" / "brain-baseline.json"
        d = json.loads(p.read_text())
        for b in d["baselines"]: b["vector"] = b["vector"][:10]
        p.write_text(json.dumps(d))
        with contextlib.redirect_stderr(io.StringIO()):
            r = self.mod.run_whitespace_analysis(self.tmp)
        self.assertIn("Dimension mismatch", r["metadata"]["note"])

    def test_kde_matches_closed_form(self):
        x = np.array([[0.0], [1.0]])
        got = self.mod.gaussian_kde_logdensity(x, np.array([[0.0]]), 1.0)[0]
        want = np.log((np.exp(0) + np.exp(-0.5)) / 2 / np.sqrt(2 * np.pi))
        self.assertAlmostEqual(got, want, places=9)

    def test_cli_writes_atomically(self):
        old = sys.argv
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            self.mod.main([self.tmp])
        self.assertTrue((Path(self.tmp) / ".mindrian" / "whitespace-results.json").exists())
        self.assertEqual([p for p in (Path(self.tmp) / ".mindrian").iterdir() if ".tmp-" in p.name], [])

if __name__ == "__main__":
    unittest.main()
