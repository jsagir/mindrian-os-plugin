"""Run: PYTHONDONTWRITEBYTECODE=1 python3 analogies/_tests/test_whitespace.py   (from package-2026)
Uses a minimal sklearn STUB (_tests/stubs) because scikit-learn is not installed here; numpy is real."""
import importlib.util, json, os, subprocess, sys, tempfile, unittest
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
PKG = HERE.parent
ORIG = PKG.parent / "_baseline" / "orig" / "analogies" / "scripts" / "discover-analogy-whitespace.py"
NEW = PKG / "scripts" / "discover-analogy-whitespace.py"
sys.path.insert(0, str(HERE / "stubs"))

def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m

N = load(NEW, "ws_new"); O = load(ORIG, "ws_orig")

def make_room(root, n=14, dim=8, edges=6, seed=7, edge_file=True, brain=6):
    rng = np.random.default_rng(seed)
    (Path(root) / ".mindrian").mkdir(parents=True, exist_ok=True)
    embs = [{"id": f"a{i}", "section": f"s{i%3}", "title": f"T{i}", "vector": rng.normal(size=dim).tolist()} for i in range(n)]
    (Path(root) / ".mindrian" / "whitespace-embeddings.json").write_text(json.dumps({"embeddings": embs}))
    bl = [{"name": f"fw{i}", "vector": rng.normal(size=dim).tolist()} for i in range(brain)]
    (Path(root) / ".mindrian" / "brain-baseline.json").write_text(json.dumps({"baselines": bl}))
    if edge_file:
        es = [{"source_id": f"a{i}", "target_id": f"a{(i*3+5)%n}", "analogy_distance": ["near", "far", "cross-domain"][i % 3], "structural_fitness": 0.5} for i in range(edges)]
        (Path(root) / ".mindrian" / "analogy-edges.json").write_text(json.dumps({"edges": es}))
    return Path(root)

class T(unittest.TestCase):
    def test_stats(self):
        self.assertEqual(N._percentile_of([1, 2, 3, 4], 3), 0.625)
        self.assertEqual(N._percentile_of([], 3), 0.0)
        self.assertEqual(N._zscore([4, 4, 4], 4), 0.0)
        self.assertEqual(N._zscore([1], 1), 0.0)
        self.assertEqual(N._quantile([1, 2, 3, 4, 5], 0.75), 4)
        self.assertIsNone(N._quantile([], 0.5))

    def test_fixed_mode_matches_original(self):
        with tempfile.TemporaryDirectory() as d:
            room = make_room(d, edges=6)
            a = O.detect_analogy_whitespace(room); b = N.detect_analogy_whitespace(room, mode="fixed")
            self.assertEqual(len(a["zones"]), len(b["zones"]))
            for za, zb in zip(a["zones"], b["zones"]):
                for k, v in za.items():
                    self.assertEqual(v, zb[k], k)
            self.assertEqual(a["metadata"]["analogies_checked"], b["metadata"]["analogies_checked"])

    def test_additive_keys_and_provenance(self):
        with tempfile.TemporaryDirectory() as d:
            room = make_room(d, edges=10)
            r = N.detect_analogy_whitespace(room)
            m = r["metadata"]
            for k in ("timestamp", "analogies_checked", "zones_found", "source", "schema_version", "mode", "parameters", "libraries"):
                self.assertIn(k, m)
            self.assertEqual(m["mode"], "percentile")
            z = r["zones"][0]
            for k in ("zone_id", "source_artifact", "target_artifact", "articulation_gap", "gap_signal", "hypothesis", "articulation_gap_percentile", "nearest_other_artifact", "verification"):
                self.assertIn(k, z)
            self.assertTrue(set(x["gap_signal"] for x in r["zones"]) <= {"strong", "moderate", "weak"})
            self.assertTrue(any(x["gap_signal"] in ("strong", "moderate") for x in r["zones"]))
            self.assertTrue(all(0 <= x["articulation_gap_percentile"] <= 1 for x in r["zones"]))

    def test_deterministic(self):
        with tempfile.TemporaryDirectory() as d:
            room = make_room(d, edges=10)
            a = N.detect_analogy_whitespace(room); b = N.detect_analogy_whitespace(room)
            a["metadata"].pop("timestamp"); b["metadata"].pop("timestamp")
            self.assertEqual(json.dumps(a, sort_keys=True), json.dumps(b, sort_keys=True))

    def test_small_corpus_falls_back(self):
        with tempfile.TemporaryDirectory() as d:
            room = make_room(d, edges=2)
            r = N.detect_analogy_whitespace(room)
            self.assertEqual(r["metadata"]["mode"], "fixed")
            self.assertIn("fewer than min_corpus", r["metadata"]["note_fallback"])

    def test_endpoint_exclusion_raises_gap(self):
        # source and target orthogonal; centroid cos to each = 0.707, so the 2025 gap is 0.29 even though
        # no OTHER artifact is anywhere near the centroid.
        with tempfile.TemporaryDirectory() as d:
            room = Path(d); (room / ".mindrian").mkdir()
            vecs = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1], [0, 0, -1, 0]]
            embs = [{"id": f"x{i}", "section": "s", "title": f"X{i}", "vector": v} for i, v in enumerate(vecs)]
            (room / ".mindrian" / "whitespace-embeddings.json").write_text(json.dumps({"embeddings": embs}))
            (room / ".mindrian" / "brain-baseline.json").write_text(json.dumps({"baselines": [{"name": "f", "vector": [1, 1, 0, 0]}]}))
            (room / ".mindrian" / "analogy-edges.json").write_text(json.dumps({"edges": [{"source_id": "x0", "target_id": "x1"}]}))
            old = N.detect_analogy_whitespace(room, mode="fixed")["zones"][0]["articulation_gap"]
            new = N.detect_analogy_whitespace(room, mode="percentile")["zones"][0]["articulation_gap"]
            self.assertAlmostEqual(old, 1 - 0.7071, places=3)
            self.assertAlmostEqual(new, 1.0, places=3)

    def test_dim_mismatch_and_missing(self):
        with tempfile.TemporaryDirectory() as d:
            room = make_room(d)
            bl = json.loads((room / ".mindrian" / "brain-baseline.json").read_text())
            bl["baselines"][0]["vector"] = bl["baselines"][0]["vector"][:3]  # ragged
            (room / ".mindrian" / "brain-baseline.json").write_text(json.dumps(bl))
            r = N.detect_analogy_whitespace(room)
            self.assertEqual(r["zones"], [])
        with tempfile.TemporaryDirectory() as d:
            r = N.detect_analogy_whitespace(Path(d))
            self.assertEqual(r["metadata"]["zones_found"], 0)
        with tempfile.TemporaryDirectory() as d:
            room = make_room(d, dim=8)
            (room / ".mindrian" / "brain-baseline.json").write_text(json.dumps({"baselines": [{"name": "f", "vector": [1, 2, 3]}]}))
            r = N.detect_analogy_whitespace(room)
            self.assertIn("dimension mismatch", r["metadata"]["note"])

    def test_self_and_duplicate_edges(self):
        with tempfile.TemporaryDirectory() as d:
            room = make_room(d, edges=0)
            es = [{"source_id": "a1", "target_id": "a1"}, {"source_id": "a1", "target_id": "a2"}, {"source_id": "a2", "target_id": "a1"}, {"source_id": "zz", "target_id": "a1"}]
            (room / ".mindrian" / "analogy-edges.json").write_text(json.dumps({"edges": es}))
            r = N.detect_analogy_whitespace(room)
            self.assertEqual(len(r["zones"]), 1)
            sk = r["metadata"]["pairs_skipped"]
            self.assertEqual((sk["self_edge"], sk["duplicate"], sk["missing_embedding"]), (1, 1, 1))

    def _hsi(self, room, n_pairs):
        arts = [{"id": f"h{i}", "section": f"s{i%2}"} for i in range(2 * n_pairs)]
        pairs = []
        for i in range(n_pairs):
            pairs.append({"left_id": f"h{2*i}", "right_id": f"h{2*i+1}", "semantic_sim": 0.30 + 0.01 * i, "lsa_sim": 0.60 - 0.01 * i})
        (Path(room) / ".hsi-results.json").write_text(json.dumps({"artifacts": arts, "hsi_pairs": pairs}))

    def test_hsi_percentile_vs_fixed(self):
        with tempfile.TemporaryDirectory() as d:
            self._hsi(d, 20)
            fixed = N.extract_hsi_analogy_candidates(d, mode="fixed")
            info = {}
            pct = N.extract_hsi_analogy_candidates(d, mode="percentile", info=info)
            self.assertEqual(fixed, [])                     # absolute 0.6/0.3 cut-offs find nothing in a low-similarity room
            self.assertEqual(info["hsi_mode"], "percentile")
            self.assertGreater(len(pct), 0)                 # the room's own top-quartile semantic / bottom-quartile lsa pairs
            self.assertLess(len(pct), 20)
        with tempfile.TemporaryDirectory() as d:
            self._hsi(d, 3)
            info = {}
            N.extract_hsi_analogy_candidates(d, mode="percentile", info=info)
            self.assertEqual(info["hsi_mode"], "fixed")     # too few pairs
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(N.extract_hsi_analogy_candidates(d), [])
            Path(d, ".hsi-results.json").write_text("not json")
            self.assertEqual(N.extract_hsi_analogy_candidates(d), [])
            Path(d, ".hsi-results.json").write_text(json.dumps({"artifacts": [{"nope": 1}], "hsi_pairs": [{"left_id": "a", "right_id": "b", "semantic_sim": None}]}))
            self.assertEqual(N.extract_hsi_analogy_candidates(d), [])   # original raised KeyError on the artifact row

    def test_original_crashes_on_malformed_artifact(self):
        with tempfile.TemporaryDirectory() as d:
            Path(d, ".hsi-results.json").write_text(json.dumps({"artifacts": [{"nope": 1}], "hsi_pairs": []}))
            with self.assertRaises(KeyError):
                O.extract_hsi_analogy_candidates(d)

    def test_cli(self):
        env = dict(os.environ, PYTHONPATH=str(HERE / "stubs"), PYTHONDONTWRITEBYTECODE="1")
        with tempfile.TemporaryDirectory() as d:
            room = make_room(d, edges=10)
            out = Path(d) / "o" / "x.json"
            p = subprocess.run([sys.executable, str(NEW), str(room), "--output", str(out)], capture_output=True, text=True, env=env)
            self.assertEqual(p.returncode, 0, p.stderr)
            self.assertTrue(out.exists())
            self.assertIn("Analogy Whitespace:", p.stderr)
            p2 = subprocess.run([sys.executable, str(NEW), str(room), "--mode", "fixed", "--output", str(out)], capture_output=True, text=True, env=env)
            self.assertEqual(p2.returncode, 0)
            self.assertEqual(json.loads(out.read_text())["metadata"]["mode"], "fixed")
            p3 = subprocess.run([sys.executable, str(NEW), str(Path(d) / "nope")], capture_output=True, text=True, env=env)
            self.assertEqual(p3.returncode, 1)
            p4 = subprocess.run([sys.executable, str(NEW), str(room), "--mode", "bogus"], capture_output=True, text=True, env=env)
            self.assertNotEqual(p4.returncode, 0)

    def test_no_dash_chars(self):
        self.assertNotIn("—", NEW.read_text(encoding="utf-8"))
        self.assertNotIn("–", NEW.read_text(encoding="utf-8"))

if __name__ == "__main__":
    unittest.main(verbosity=2)
