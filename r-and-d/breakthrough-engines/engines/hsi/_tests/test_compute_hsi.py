"""Tests for package-2026/hsi/scripts/compute-hsi.py (numpy only; no sklearn, no network).

Run:  PYTHONDONTWRITEBYTECODE=1 HSI_NO_AUTO_INSTALL=1 python3 -I -m unittest discover -s package-2026/hsi/_tests -p 'test_compute_hsi.py' -v
(from the research directory; the file locates the script relative to itself)
"""
import importlib.util
import json
import math
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

os.environ["HSI_NO_AUTO_INSTALL"] = "1"
SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "compute-hsi.py"

spec = importlib.util.spec_from_file_location("compute_hsi", str(SCRIPT))
hsi = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hsi)
np = hsi.np

CONCEPTS = {
    # two vocabularies for the same concepts: the stub encoder maps both to one axis
    "payment": 0, "invoice": 0, "billing": 0, "settlement": 0,
    "vaccine": 1, "immunization": 1, "inoculation": 1, "antigen": 1,
    "route": 2, "logistics": 2, "delivery": 2, "shipping": 2,
    "bottleneck": 3, "congestion": 3, "backlog": 3, "queue": 3,
    "algorithm": 4, "scheduler": 4, "optimizer": 4, "heuristic": 4,
}


def stub_encoder(items):
    """Deterministic concept-bag encoder: synonyms land on the same axis."""
    out = np.zeros((len(items), 6))
    for r, text in enumerate(items):
        for tok in hsi.tokenize(text, drop_stop=False):
            if tok in CONCEPTS:
                out[r, CONCEPTS[tok]] += 1.0
        out[r, 5] = 0.01  # avoid all-zero rows
    return out


BODY = {
    "finance/billing-flow": (
        "The payment settlement process suffers from a queue bottleneck at month end. "
        "Invoice backlog grows because billing approvals cannot keep pace. "
        "We propose a scheduler algorithm to drain the invoice queue using priority heuristics. "
        "Billing teams cross-check every payment before settlement. "
        "This is a hard problem for the finance team."),
    "ops/delivery-routing": (
        "Delivery logistics face congestion at the regional hub, a classic bottleneck. "
        "Shipping backlog builds when the route plan cannot absorb peak demand. "
        "Our approach applies an optimizer heuristic to balance each route and clear the queue. "
        "Logistics planners connect depot data with delivery windows. "
        "The challenge is the same everywhere."),
    "health/vaccine-rollout": (
        "Vaccine inoculation campaigns need cold storage and trained staff in every district. "
        "Immunization coverage depends on antigen supply reaching clinics on time. "
        "Nurses record each vaccine dose in the registry for later audits. "
        "Public health teams review antigen stock weekly across regions."),
    "health/antigen-research": (
        "Antigen research studies how immunization produces lasting protection in patients. "
        "The vaccine trial measured antibody response across several age groups carefully. "
        "Researchers compare inoculation schedules and report the evidence in detail."),
}


def make_room(root, extra=None):
    docs = dict(BODY)
    if extra:
        docs.update(extra)
    for rel, text in docs.items():
        p = Path(root) / (rel + ".md")
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text("# " + p.stem.replace("-", " ").title() + "\n\n" + text + "\n", encoding="utf-8")
    return Path(root)


def run_cli(*args):
    env = dict(os.environ, HSI_NO_AUTO_INSTALL="1", PYTHONDONTWRITEBYTECODE="1")
    return subprocess.run([sys.executable, "-I", str(SCRIPT)] + list(args), capture_output=True, text=True, env=env)


class Helpers(unittest.TestCase):
    def test_percentile_ties_and_edges(self):
        self.assertEqual(hsi.empirical_percentile([]).size, 0)
        self.assertEqual(hsi.empirical_percentile([5.0]).tolist(), [1.0])
        p = hsi.empirical_percentile([1, 2, 2, 3])
        self.assertAlmostEqual(p[0], 0.0)
        self.assertAlmostEqual(p[3], 1.0)
        self.assertAlmostEqual(p[1], p[2])
        self.assertAlmostEqual(p[1], 0.5)

    def test_zscore_zero_spread(self):
        self.assertTrue(np.all(hsi.zscores([0.3, 0.3, 0.3]) == 0))
        z = hsi.zscores([1, 2, 3])
        self.assertAlmostEqual(float(z.mean()), 0.0, places=9)

    def test_cosine_zero_rows_safe(self):
        m = hsi.cosine_matrix([[0, 0], [1, 0]])
        self.assertFalse(np.isnan(m).any())


class Lexical(unittest.TestCase):
    TEXTS = [BODY[k] for k in sorted(BODY)]

    def test_lsa_symmetric_unit_diag_deterministic(self):
        a = hsi.compute_lsa_similarity(self.TEXTS, backend="numpy")
        b = hsi.compute_lsa_similarity(self.TEXTS, backend="numpy")
        self.assertTrue(np.allclose(a, a.T))
        self.assertTrue(np.allclose(np.diag(a), 1.0))
        self.assertTrue(np.array_equal(a, b))
        self.assertTrue(((a >= 0) & (a <= 1)).all())
        self.assertEqual(hsi.LAST_LSA_BACKEND["name"], "numpy.linalg.svd")

    def test_lsa_degenerate_inputs(self):
        self.assertTrue(np.array_equal(hsi.compute_lsa_similarity(["the of and", "a an"], backend="numpy"), np.eye(2)))
        self.assertTrue(np.array_equal(hsi.compute_lsa_similarity(["only one document here"], backend="numpy"), np.eye(1)))

    def test_bm25_properties(self):
        s = hsi.compute_bm25_similarity(self.TEXTS)
        self.assertTrue(np.allclose(s, s.T))
        self.assertTrue(np.allclose(np.diag(s), 1.0))
        names = sorted(BODY)
        i_v, i_a = names.index("health/vaccine-rollout"), names.index("health/antigen-research")
        i_f = names.index("finance/billing-flow")
        self.assertGreater(s[i_v, i_a], s[i_v, i_f])  # same topic scores above unrelated
        self.assertTrue(((s >= 0) & (s <= 1)).all())

    def test_bm25_degenerate(self):
        self.assertTrue(np.array_equal(hsi.compute_bm25_similarity(["the and"]), np.eye(1)))
        self.assertTrue(np.array_equal(hsi.compute_bm25_similarity(["the of", "and or"]), np.eye(2)))


class Dense(unittest.TestCase):
    def test_chunking_pools_all_windows(self):
        calls = []

        def enc(items):
            calls.append(list(items))
            return stub_encoder(items)
        long_text = ("payment " * 450) + ("vaccine " * 450)
        e = hsi.embed_documents([long_text], enc, chunk_words=200, max_chunks=12)
        self.assertGreater(len(calls[0]), 1)
        self.assertGreater(e[0, 0], 0)   # first half seen
        self.assertGreater(e[0, 1], 0)   # second half seen (truncation would hide it)

    def test_no_chunking_single_call(self):
        calls = []
        hsi.embed_documents(["a b c", "d e f"], lambda items: (calls.append(items), stub_encoder(items))[1], chunk_words=0)
        self.assertEqual(len(calls), 1)

    def test_tier1_returns_none_without_encoder_package(self):
        # sentence-transformers is not installed in this environment
        try:
            import sentence_transformers  # noqa: F401
            self.skipTest("sentence-transformers present")
        except ImportError:
            self.assertIsNone(hsi.compute_semantic_similarity_tier1(["a", "b"]))

    def test_load_dense_vectors_validation(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "v.json"
            p.write_text(json.dumps({"a": [1, 0], "b": [0, 1]}))
            m = hsi.load_dense_vectors(str(p), ["a", "b"])
            self.assertEqual(m.shape, (2, 2))
            with self.assertRaises(ValueError):
                hsi.load_dense_vectors(str(p), ["a", "zzz"])
            p.write_text(json.dumps({"a": [1, 0], "b": [0, 1, 2]}))
            with self.assertRaises(ValueError):
                hsi.load_dense_vectors(str(p), ["a", "b"])


class Claims(unittest.TestCase):
    def test_extract_claims_split(self):
        probs, meths = hsi.extract_claims(BODY["finance/billing-flow"])
        self.assertTrue(any("bottleneck" in s or "backlog" in s for s in probs))
        self.assertTrue(any("propose" in s for s in meths))

    def test_claim_level_finds_problem_method_cross_pair(self):
        arts = [{"id": k, "text": v} for k, v in sorted(BODY.items())]
        names = [a["id"] for a in arts]
        i, j = names.index("finance/billing-flow"), names.index("ops/delivery-routing")
        res = hsi.claim_level_scores(arts, [(min(i, j), max(i, j))], stub_encoder)
        hit = res[(min(i, j), max(i, j))]
        k = names.index("health/vaccine-rollout")
        other = hsi.claim_level_scores(arts, [(min(i, k), max(i, k))], stub_encoder)
        # same-concept problem/method sentences must outscore an unrelated pair (or the unrelated pair has no claims)
        self.assertGreater(hit["claim_sim"], other.get((min(i, k), max(i, k)), {"claim_sim": 0.0})["claim_sim"])
        self.assertIn(hit["problem_artifact"], names)
        self.assertNotEqual(hit["problem_artifact"], hit["method_artifact"])

    def test_claim_level_omits_pairs_without_claims(self):
        arts = [{"id": "x", "text": "short"}, {"id": "y", "text": "tiny"}]
        self.assertEqual(hsi.claim_level_scores(arts, [(0, 1)], stub_encoder), {})


def reference_pairs(artifacts, lsa, sem, threshold):
    """The ORIGINAL double loop (compute-hsi.py v1.6.0 lines 748-777), as the oracle."""
    texts = [a["text"] for a in artifacts]
    prof = [hsi.compute_artifact_spectral_profile(t) for t in texts]
    om = [p["omhmm_score"] for p in prof]
    out = []
    n = len(artifacts)
    for i in range(n):
        for j in range(i + 1, n):
            l, s = float(lsa[i, j]), float(sem[i, j])
            d = 0.6 * abs(s - l) + 0.4 * math.sqrt(om[i] * om[j]) / 100.0
            if d < threshold:
                continue
            out.append((artifacts[i]["id"], artifacts[j]["id"], round(l, 4), round(s, 4), round(d, 4),
                        "structural_transfer" if l > s else "semantic_implementation",
                        round(0.7 * d + 0.3 * min(l, s), 4)))
    out.sort(key=lambda t: t[4], reverse=True)
    return out[:20]


class Matrix(unittest.TestCase):
    def setUp(self):
        rng = np.random.default_rng(7)
        self.n = 9
        self.arts = [{"id": "s/a%d" % i, "section": "s", "title": "A%d" % i, "path": "s/a%d.md" % i,
                      "text": (BODY[sorted(BODY)[i % 4]] + " variant %d" % i)} for i in range(self.n)]
        def sym():
            m = rng.random((self.n, self.n)); m = (m + m.T) / 2; np.fill_diagonal(m, 1); return m
        self.lsa, self.sem, self.bm = sym(), sym(), sym()

    def test_legacy_matches_original_loop(self):
        pairs, _ = hsi.compute_hsi_matrix(self.arts, self.lsa, self.sem, threshold=0.30)
        ref = reference_pairs(self.arts, self.lsa, self.sem, 0.30)
        got = [(p["left_id"], p["right_id"], p["lsa_sim"], p["semantic_sim"], p["hsi_score"], p["surprise_type"],
                p["breakthrough_potential"]) for p in pairs]
        self.assertEqual(got, ref)
        self.assertGreater(len(got), 0)

    def test_legacy_old_keys_present_and_unchanged_names(self):
        pairs, _ = hsi.compute_hsi_matrix(self.arts, self.lsa, self.sem)
        for k in ("left_id", "right_id", "lsa_sim", "semantic_sim", "hsi_score", "surprise_type",
                  "breakthrough_potential", "spectral_gap_avg", "left_dominant_mode", "right_dominant_mode"):
            self.assertIn(k, pairs[0])

    def test_percentile_mode_has_no_fixed_cutoff(self):
        # shrink every score far below 0.30: legacy returns nothing, percentile still ranks
        lsa = np.full((self.n, self.n), 0.0) + 0.0
        sem = lsa.copy()
        legacy, _ = hsi.compute_hsi_matrix(self.arts, lsa, sem, threshold=5.0)
        self.assertEqual(legacy, [])
        pct, _ = hsi.compute_hsi_matrix(self.arts, self.lsa * 0.01, self.sem * 0.01, threshold=None,
                                        ranking="percentile", top_k=5)
        self.assertEqual(len(pct), 5)
        scores = [p["hsi_score"] for p in pct]
        self.assertEqual(scores, sorted(scores, reverse=True))
        self.assertGreaterEqual(pct[0]["hsi_percentile"], pct[-1]["hsi_percentile"])
        self.assertEqual(pct[0]["rank"], 1)

    def test_min_percentile_filters(self):
        pairs, _ = hsi.compute_hsi_matrix(self.arts, self.lsa, self.sem, threshold=None, ranking="percentile",
                                          min_percentile=0.9, top_k=100)
        total = self.n * (self.n - 1) // 2
        self.assertLessEqual(len(pairs), math.ceil(total * 0.1) + 2)
        self.assertTrue(all(p["hsi_percentile"] >= 0.9 for p in pairs))

    def test_deterministic_and_tie_order(self):
        flat = np.full((self.n, self.n), 0.5)
        a, _ = hsi.compute_hsi_matrix(self.arts, flat, flat, threshold=None, ranking="percentile", top_k=0)
        b, _ = hsi.compute_hsi_matrix(self.arts, flat, flat, threshold=None, ranking="percentile", top_k=0)
        self.assertEqual([(p["left_id"], p["right_id"]) for p in a], [(p["left_id"], p["right_id"]) for p in b])
        self.assertEqual(len(a), self.n * (self.n - 1) // 2)

    def test_second_signal_trail_and_novelty(self):
        pairs, _ = hsi.compute_hsi_matrix(self.arts, self.lsa, self.sem, threshold=None, ranking="percentile",
                                          bm25_matrix=self.bm, top_k=3)
        p = pairs[0]
        self.assertEqual(p["second_signal"]["method"], "bm25_vs_dense_surprise")
        self.assertIsInstance(p["second_signal"]["confirmed"], bool)
        self.assertEqual(len(p["source_trail"]), 2)
        self.assertTrue(p["source_trail"][0]["extracted_sentence"])
        self.assertIn("retrieved_at", p["source_trail"][0])
        self.assertEqual(p["novelty_check"]["external_literature"], "not_run")

    def test_cross_reference_detection(self):
        a = {"id": "s/one", "title": "Alpha Plan", "text": "this mentions the alpha plan explicitly"}
        b = {"id": "s/two", "title": "Alpha Plan", "text": "unrelated"}
        self.assertTrue(hsi._cross_referenced(a, b))
        self.assertFalse(hsi._cross_referenced(b, a))

    def test_two_artifacts_and_one(self):
        pairs, prof = hsi.compute_hsi_matrix(self.arts[:2], np.eye(2), np.ones((2, 2)), threshold=0.0)
        self.assertEqual(len(pairs), 1)
        pairs1, _ = hsi.compute_hsi_matrix(self.arts[:1], np.eye(1), np.eye(1), threshold=0.0)
        self.assertEqual(pairs1, [])


class Spectral(unittest.TestCase):
    def test_legacy_creative_feature_now_matches(self):
        # the original pattern had a doubled backslash and could never match "innovative"
        self.assertGreater(hsi._compute_omhmm_legacy("An innovative idea. Short."), 0.0)

    def test_profile_shapes(self):
        p = hsi.compute_artifact_spectral_profile(BODY["finance/billing-flow"] * 2)
        self.assertIn(p["spectral_method"], ("markov", "legacy"))


class Cache(unittest.TestCase):
    def test_cache_requires_params_and_output(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "out.json"
            hashes = {"a": "1"}
            hsi.write_cache(d, hashes, params_hash="P1")
            self.assertFalse(hsi.check_cache(d, hashes, params_hash="P1", output_path=out))  # output missing
            out.write_text("{}")
            self.assertTrue(hsi.check_cache(d, hashes, params_hash="P1", output_path=out))
            self.assertFalse(hsi.check_cache(d, hashes, params_hash="P2", output_path=out))   # params changed
            self.assertTrue(hsi.check_cache(d, hashes))                                      # old call signature still works
            self.assertFalse(hsi.check_cache(d, {"a": "2"}, params_hash="P1", output_path=out))


class CLI(unittest.TestCase):
    OLD_KEYS_META = {"timestamp", "room_dir", "tier", "artifact_count", "pair_count", "spectral_version",
                     "spectral_summary"}

    def _vectors(self, room):
        arts = hsi.discover_artifacts(room)
        vec = stub_encoder([a["text"] for a in arts])
        p = Path(room).parent / ("vec-%d.json" % abs(hash(str(room))))
        p.write_text(json.dumps({a["id"]: v.tolist() for a, v in zip(arts, vec)}))
        return p

    def test_end_to_end_schema_and_cache(self):
        with tempfile.TemporaryDirectory() as d:
            room = make_room(Path(d) / "room", extra={"x/generated": "WHITESPACE placeholder " * 10})
            (room / "finance" / "WHITESPACE.md").write_text("# Whitespace\n\n" + "gap detected here " * 20)
            vecs = self._vectors(room)
            r = run_cli(str(room), "--dense-vectors", str(vecs))
            self.assertEqual(r.returncode, 0, r.stderr)
            data = json.loads((room / ".hsi-results.json").read_text())
            self.assertTrue(self.OLD_KEYS_META <= set(data["metadata"]))
            self.assertEqual(data["metadata"]["schema_version"], "2.0")
            self.assertEqual(set(data) & {"metadata", "artifacts", "hsi_pairs", "reverse_salients"},
                             {"metadata", "artifacts", "hsi_pairs", "reverse_salients"})
            ids = {a["id"] for a in data["artifacts"]}
            self.assertNotIn("finance/WHITESPACE", ids)         # generated file is not scored
            prov = data["metadata"]["provenance"]
            self.assertEqual(prov["semantic_leg"], "precomputed-vectors")
            self.assertIn("numpy", prov["lsa_backend"])
            self.assertEqual(data["metadata"]["ranking"]["method"], "percentile")
            self.assertGreater(len(data["hsi_pairs"]), 0)
            self.assertIn("source_trail", data["hsi_pairs"][0])
            # second identical run: cache hit
            r2 = run_cli(str(room), "--dense-vectors", str(vecs))
            self.assertIn("cache hit", r2.stderr)
            # parameter change must NOT hit the cache
            r3 = run_cli(str(room), "--dense-vectors", str(vecs), "--top-k", "2")
            self.assertNotIn("cache hit", r3.stderr)
            self.assertEqual(len(json.loads((room / ".hsi-results.json").read_text())["hsi_pairs"]), 2)
            # deleted output must NOT hit the cache
            (room / ".hsi-results.json").unlink()
            r4 = run_cli(str(room), "--dense-vectors", str(vecs), "--top-k", "2")
            self.assertNotIn("cache hit", r4.stderr)
            self.assertTrue((room / ".hsi-results.json").exists())

    def test_lsa_option_and_legacy_ranking(self):
        with tempfile.TemporaryDirectory() as d:
            room = make_room(Path(d) / "room")
            vecs = self._vectors(room)
            r = run_cli(str(room), "--dense-vectors", str(vecs), "--lexical", "lsa", "--ranking", "legacy")
            self.assertEqual(r.returncode, 0, r.stderr)
            data = json.loads((room / ".hsi-results.json").read_text())
            self.assertEqual(data["metadata"]["ranking"]["fixed_threshold"], 0.30)
            for p in data["hsi_pairs"]:
                self.assertGreaterEqual(p["hsi_score"], 0.30)
                self.assertEqual(p["lexical_sim"], p["lsa_sim"])

    def test_same_output_twice_is_identical(self):
        with tempfile.TemporaryDirectory() as d:
            room = make_room(Path(d) / "room")
            vecs = self._vectors(room)
            run_cli(str(room), "--dense-vectors", str(vecs), "--output", str(Path(d) / "o1.json"))
            run_cli(str(room), "--dense-vectors", str(vecs), "--output", str(Path(d) / "o2.json"))
            a = json.loads((Path(d) / "o1.json").read_text()); b = json.loads((Path(d) / "o2.json").read_text())
            def strip(pairs):
                for pr in pairs:
                    for t in pr["source_trail"]:
                        t.pop("retrieved_at")   # run timestamp is provenance, not a result
                return pairs
            self.assertEqual(strip(a["hsi_pairs"]), strip(b["hsi_pairs"]))

    def test_no_dense_leg_fails_without_flag_and_degrades_with_it(self):
        try:
            import sentence_transformers  # noqa: F401
            self.skipTest("sentence-transformers present")
        except ImportError:
            pass
        with tempfile.TemporaryDirectory() as d:
            room = make_room(Path(d) / "room")
            r = run_cli(str(room))
            self.assertEqual(r.returncode, 1)
            r = run_cli(str(room), "--allow-lexical-only")
            self.assertEqual(r.returncode, 0, r.stderr)
            data = json.loads((room / ".hsi-results.json").read_text())
            self.assertEqual(data["metadata"]["provenance"]["semantic_leg"], "lexical-bm25-proxy")
            self.assertTrue(any("no_dense_leg" in w for w in data["metadata"]["provenance"]["warnings"]))

    def test_claim_level_skipped_without_encoder(self):
        with tempfile.TemporaryDirectory() as d:
            room = make_room(Path(d) / "room")
            vecs = self._vectors(room)
            r = run_cli(str(room), "--dense-vectors", str(vecs), "--claim-level")
            self.assertEqual(r.returncode, 0, r.stderr)
            data = json.loads((room / ".hsi-results.json").read_text())
            self.assertEqual(data["metadata"]["provenance"]["claim_level"], "skipped_no_encoder")

    def test_bad_inputs(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(run_cli(str(Path(d) / "missing")).returncode, 1)
            room = make_room(Path(d) / "room")
            bad = Path(d) / "bad.json"; bad.write_text("{not json")
            self.assertEqual(run_cli(str(room), "--dense-vectors", str(bad)).returncode, 1)
            self.assertEqual(run_cli(str(room), "--min-percentile", "2").returncode, 1)

    def test_fewer_than_two_artifacts_writes_empty(self):
        with tempfile.TemporaryDirectory() as d:
            room = Path(d) / "room"; (room / "s").mkdir(parents=True)
            (room / "s" / "one.md").write_text("# One\n\n" + "content text here " * 10)
            r = run_cli(str(room))
            self.assertEqual(r.returncode, 0)
            data = json.loads((room / ".hsi-results.json").read_text())
            self.assertEqual(data["hsi_pairs"], [])
            self.assertEqual(data["metadata"]["pair_count"], 0)


if __name__ == "__main__":
    unittest.main()
