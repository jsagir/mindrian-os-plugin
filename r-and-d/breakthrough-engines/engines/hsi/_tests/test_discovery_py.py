import importlib.util, json, os, subprocess, sys, tempfile, unittest, io, contextlib, hashlib
from pathlib import Path
os.environ["HSI_NO_AUTO_INSTALL"] = "1"
import numpy as np
SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"

def load(name, fname):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / fname)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m

class FakeModel:
    DIM = 24
    def encode(self, texts, show_progress_bar=False):
        out = np.zeros((len(texts), self.DIM))
        for i, t in enumerate(texts):
            for w in str(t).lower().split():
                out[i, int(hashlib.md5(w.encode()).hexdigest(), 16) % self.DIM] += 1
        return out

def room(tmp, n=10, dim=24, seed=3):
    rng = np.random.default_rng(seed)
    m = Path(tmp) / ".mindrian"; m.mkdir(parents=True, exist_ok=True)
    secs = ["alpha", "beta", "gamma", "delta", "eps"]
    vecs = rng.normal(size=(n, dim)); vecs[:, :3] += 3
    items = [{"id": "a%d" % i, "section": secs[i % 5], "title": "Art %d" % i, "path": "x/%d.md" % i,
              "vector": vecs[i].tolist()} for i in range(n)]
    brain = rng.normal(size=(8, dim)); brain[:4, :3] += 3
    (m / "whitespace-embeddings.json").write_text(json.dumps({"metadata": {"model_name": "t"}, "embeddings": items}))
    (m / "brain-baseline.json").write_text(json.dumps({"metadata": {"model_name": "t"},
        "baselines": [{"name": "F%d" % i, "vector": brain[i].tolist()} for i in range(8)]}))
    return items

class HsiWs(unittest.TestCase):
    def setUp(self):
        self.mod = load("dh", "discover-hsi-whitespace.py")
        self.tmp = tempfile.mkdtemp(); room(self.tmp)

    def write_hsi(self, pairs, ranking=None):
        md = {"ranking": ranking} if ranking else {}
        (Path(self.tmp) / ".hsi-results.json").write_text(json.dumps({"metadata": md, "hsi_pairs": pairs}))

    def test_room_density_excludes_seed_pair(self):
        # make two identical seeds: with the seeds included the room density would be ~1.0
        p = Path(self.tmp) / ".mindrian" / "whitespace-embeddings.json"
        d = json.loads(p.read_text()); d["embeddings"][1]["vector"] = d["embeddings"][0]["vector"]; p.write_text(json.dumps(d))
        self.write_hsi([{"left_id": "a0", "right_id": "a1", "hsi_score": 0.9}])
        r = self.mod.detect_hsi_whitespace(self.tmp, threshold=0.4)
        self.assertEqual(len(r["zones"]), 1)
        self.assertNotIn("a0", r["zones"][0]["nearest_room_artifacts"])
        self.assertNotIn("a1", r["zones"][0]["nearest_room_artifacts"])
        self.assertLess(r["zones"][0]["room_density"], 0.99)

    def test_threshold_none_uses_ranked_file(self):
        self.write_hsi([{"left_id": "a0", "right_id": "a2", "hsi_score": 0.25, "hsi_percentile": 0.99}],
                       ranking={"method": "percentile"})
        r = self.mod.detect_hsi_whitespace(self.tmp)
        self.assertEqual(r["metadata"]["zones_found"], 1)
        self.assertEqual(r["zones"][0]["seed_pair"]["hsi_percentile"], 0.99)

    def test_legacy_file_uses_0_4(self):
        self.write_hsi([{"left_id": "a0", "right_id": "a2", "hsi_score": 0.25}])
        r = self.mod.detect_hsi_whitespace(self.tmp)
        self.assertEqual(r["metadata"]["zones_found"], 0)

    def test_percentile_signal_and_fields(self):
        self.write_hsi([{"left_id": "a0", "right_id": "a2", "hsi_score": 0.9, "lexical_sim": 0.1}])
        r = self.mod.detect_hsi_whitespace(self.tmp, threshold=0.4)
        z = r["zones"][0]
        self.assertEqual(z["signal_method"], "percentile_vs_room_artifacts")
        self.assertIn(z["gap_signal"], ("strong", "moderate", "weak"))
        for k in ("source_trail", "second_signal", "novelty_check", "brain_density_percentile"):
            self.assertIn(k, z)
        r2 = self.mod.detect_hsi_whitespace(self.tmp, threshold=0.4, signal_method="fixed")
        self.assertEqual(r2["zones"][0]["signal_method"], "fixed_cutoffs")

    def test_dimension_mismatch(self):
        p = Path(self.tmp) / ".mindrian" / "brain-baseline.json"
        d = json.loads(p.read_text())
        for b in d["baselines"]: b["vector"] = b["vector"][:5]
        p.write_text(json.dumps(d))
        self.write_hsi([{"left_id": "a0", "right_id": "a2", "hsi_score": 0.9}])
        with contextlib.redirect_stderr(io.StringIO()):
            r = self.mod.detect_hsi_whitespace(self.tmp, threshold=0.1)
        self.assertIn("Dimension", r["metadata"]["note"])

    def test_cli(self):
        self.write_hsi([{"left_id": "a0", "right_id": "a2", "hsi_score": 0.9}])
        with contextlib.redirect_stderr(io.StringIO()):
            self.mod.main([self.tmp, "--threshold", "0.4"])
        self.assertTrue((Path(self.tmp) / ".mindrian" / "discovery-hsi-whitespace.json").exists())

class RsWs(unittest.TestCase):
    def setUp(self):
        self.mod = load("dr", "discover-rs-whitespace.py")
        self.tmp = tempfile.mkdtemp(); room(self.tmp)
        (Path(self.tmp) / ".hsi-results.json").write_text(json.dumps({"reverse_salients": [
            {"opportunity_id": "o1", "source_section": "alpha", "target_section": "beta", "differential_score": 0.7},
            {"opportunity_id": "o2", "source_section": "beta", "target_section": "beta"},
            {"opportunity_id": "o3", "source_section": "beta", "target_section": "nosuch"}]}))

    def test_zones_dedup_and_fields(self):
        r = self.mod.detect_rs_whitespace(self.tmp)
        self.assertEqual(len(r["zones"]), 1)
        z = r["zones"][0]
        self.assertEqual(z["signal_method"], "percentile_among_sections")
        self.assertEqual(z["bottleneck_score"], 0.7)
        self.assertTrue(z["source_trail"])
        self.assertIn(z["gap_signal"], ("strong", "moderate", "weak"))

    def test_fixed_method(self):
        r = self.mod.detect_rs_whitespace(self.tmp, signal_method="fixed")
        self.assertEqual(r["zones"][0]["signal_method"], "fixed_cutoffs")

    def test_cli_output(self):
        with contextlib.redirect_stderr(io.StringIO()):
            self.mod.main([self.tmp])
        d = json.loads((Path(self.tmp) / ".mindrian" / "discovery-rs-whitespace.json").read_text())
        self.assertEqual(d["metadata"]["schema_version"], "2.0")

class ExternalWs(unittest.TestCase):
    def setUp(self):
        self.mod = load("ex", "compute-external-whitespace.py")
        self.tmp = tempfile.mkdtemp(); self.items = room(self.tmp, dim=FakeModel.DIM)
        topics = ["quantum", "membrane", "pricing", "genome", "battery", "tariff", "clinic", "satellite"]
        papers = [{"paperId": "p%d" % i, "title": "Paper %s" % t, "year": 2020 + i % 5,
                   "abstract": ("%s study of %s systems and their design with careful analysis. " % (t, t)) * 3,
                   "fieldsOfStudy": ["Physics"] if i % 2 else ["Biology"]} for i, t in enumerate(topics)]
        papers.append({"title": "No id", "abstract": "noid paper about something " * 5})
        papers.append({"paperId": "short", "abstract": "tiny"})
        (Path(self.tmp) / ".mindrian" / "external-papers.json").write_text(
            json.dumps({"retrieved_at": "2026-01-01T00:00:00Z", "query": "q", "papers": papers}))
        gaps = [{"brain_framework": "F1", "zone_id": "ws-f1-x", "nearest_room_artifacts": [
            {"artifact_id": "a0", "title": "Art 0"}, {"artifact_id": "a1", "title": "Art 1"}]},
            {"brain_framework": "F2", "nearest_room_artifacts": [3, 4]}]
        (Path(self.tmp) / ".mindrian" / "whitespace-results.json").write_text(json.dumps({"gaps": gaps}))
        self.mod.load_embedding_model = lambda t=None: (FakeModel(), "t", FakeModel.DIM)

    def run_main(self, *extra):
        with contextlib.redirect_stderr(io.StringIO()):
            self.mod.main([self.tmp, *extra])
        return json.loads((Path(self.tmp) / ".mindrian" / "external-whitespace-results.json").read_text())

    def test_gap_filling_now_works_with_dict_artifacts(self):
        d = self.run_main()
        self.assertTrue(d["gap_filling_suggestions"])
        ids = {s["brain_framework"] for s in d["gap_filling_suggestions"]}
        self.assertIn("F1", ids)  # dict-form nearest artifacts resolved
        self.assertIn("F2", ids)  # int form still works
        sp = d["gap_filling_suggestions"][0]["suggested_papers"][0]
        self.assertIn("source_trail", sp)

    def test_aliases_trail_and_no_keyerror(self):
        d = self.run_main()
        self.assertEqual(d["zones"], d["cross_domain_zones"])
        self.assertEqual(d["papers"], d["cross_domain_papers"])
        self.assertEqual(d["external_papers_embedded"], 9)  # short abstract filtered, id-less paper kept
        z = d["cross_domain_zones"][0]
        t = z["source_trail"][0]
        self.assertEqual(t["retrieved_at"], "2026-01-01T00:00:00Z")
        self.assertTrue(t["extracted_sentence"])
        self.assertTrue(z["relevant_papers"][0]["paperId"])

    def test_percentile_selection_is_relative(self):
        d = self.run_main("--zone-percentile", "0.9")
        d2 = self.run_main("--zone-percentile", "0.1")
        self.assertLess(len(d["cross_domain_zones"]), len(d2["cross_domain_zones"]))

    def test_legacy_selection(self):
        d = self.run_main("--selection", "legacy")
        for z in d["cross_domain_zones"]:
            self.assertEqual(z["selection_method"], "legacy_fixed_0.6")

class DepsScript(unittest.TestCase):
    def test_stdout_contract(self):
        p = subprocess.run([str(SCRIPTS / "check-hsi-deps")], capture_output=True, text=True)
        self.assertRegex(p.stdout.strip(), r"^tier:[012]$")
        self.assertIn("detail:", p.stderr)
        self.assertIn(p.returncode, (0, 1, 2))
    def test_strict_sklearn_mode(self):
        p = subprocess.run([str(SCRIPTS / "check-hsi-deps")], capture_output=True, text=True,
                           env=dict(os.environ, HSI_REQUIRE_SKLEARN="1"))
        try:
            import sklearn  # noqa
            self.assertEqual(p.returncode, 0)
        except ImportError:
            self.assertEqual((p.stdout.strip(), p.returncode), ("tier:0", 2))

if __name__ == "__main__":
    unittest.main()
