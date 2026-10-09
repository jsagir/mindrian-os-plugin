"""Tests for jason/differential_analysis.py (v3.1).
Run: PYTHONDONTWRITEBYTECODE=1 python3 -B test_differential_analysis.py
No network, no model download. The dense path is exercised with a deterministic stub encoder.
"""
import sys
sys.dont_write_bytecode = True
import importlib.util
import json
import math
import os
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
PKG = os.path.dirname(HERE)                       # package-2026/algorithms
NEW = os.path.join(PKG, "jason", "differential_analysis.py")
ORIG = os.path.join(os.path.dirname(PKG), "_baseline", "orig", "algorithms", "jason", "differential_analysis.py")


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


new = load(NEW, "da_new")
old = load(ORIG, "da_old")


class StubModel:
    """Deterministic bag-of-hashed-words encoder, L2 normalised."""
    DIM = 64

    def encode(self, texts, normalize_embeddings=True):
        out = []
        for t in texts:
            v = [0.0] * self.DIM
            for w in new.tokens(t):
                v[sum(ord(c) for c in w) % self.DIM] += 1.0
            n = math.sqrt(sum(x * x for x in v)) or 1.0
            out.append([x / n for x in v])
        return out


PAIRS = [
    {"id": "restate", "a": "Customers cannot find parking near the stadium on match days.",
     "b": "Fans struggle to locate a place to leave their cars close to the arena when games happen."},
    {"id": "same", "a": "We sell organic coffee beans online.", "b": "We sell organic coffee beans online."},
    {"id": "different", "a": "A mobile app for dog walking.", "b": "Industrial welding robots for shipyards."},
    {"id": "partial", "a": "Hospitals lose money on missed appointments. Staff call patients manually.",
     "b": "Automated reminders reduce missed appointments. Revenue recovers."},
    {"id": "p5", "a": "Solar panels on rooftops.", "b": "Rooftop photovoltaic installation for homes."},
    {"id": "p6", "a": "Teaching kids to code.", "b": "Cooking classes for adults."},
]


class Legacy(unittest.TestCase):
    def setUp(self):
        new._MODEL, new._METHOD, new._MODEL_ERROR = None, new.FALLBACK_METHOD, "forced"
        old._MODEL, old._METHOD = None, old.FALLBACK_METHOD if hasattr(old, "FALLBACK_METHOD") else old._METHOD

    def test_legacy_keys_match_original_on_fallback(self):
        # original forced to fallback by setting _METHOD so _load_model returns early
        old._MODEL = None
        old._METHOD = "fallback_char_ngram_cosine (surface proxy, NOT semantic)"
        for p in PAIRS:
            a, b = new.analyze_pair(p), old.analyze_pair(p)
            # words of 2 chars (ai, ml, ip) are now kept; none of PAIRS contain them
            self.assertEqual(a, b, p["id"])

    def test_buzz_original_fields_present(self):
        r = new.buzz("A revolutionary, game-changing AI-powered ecosystem. Unlocking synergy.")
        self.assertIn("revolutionary", r["hits"])
        self.assertIn("unlock", r["hits"])
        self.assertEqual(r["count"], len(r["hits"]))
        self.assertGreaterEqual(r["occurrences"], r["count"])

    def test_buzz_word_boundary(self):
        self.assertEqual(new.buzz("We deleverage the balance sheet")["hits"], [])
        self.assertEqual(old.buzz("We deleverage the balance sheet")["hits"], ["leverage"])  # original false positive

    def test_short_domain_tokens_kept(self):
        self.assertIn("ai", new.tokens("The AI model"))
        self.assertNotIn("ai", old.tokens("The AI model"))


class Hybrid(unittest.TestCase):
    def setUp(self):
        new._MODEL, new._METHOD, new._MODEL_ERROR = None, new.FALLBACK_METHOD, "forced fallback"
        new._EMB_CACHE.clear()

    def run_corpus(self, pairs=PAIRS, **kw):
        data = {"pairs": pairs, "texts": [{"id": "t", "text": "A holistic cutting-edge platform."}]}
        return new.analyze_corpus(data, timestamp=False, input_bytes=json.dumps(data).encode(), **kw)

    def test_new_keys_and_percentiles(self):
        out = self.run_corpus()
        r = out["pairs"][0]
        for k in ("lexical_tfidf_cosine", "claim_level", "corpus_rank", "second_signal", "novelty_check", "source_trail"):
            self.assertIn(k, r)
        self.assertEqual(r["corpus_rank"]["status"], "ok")
        self.assertTrue(0 <= r["corpus_rank"]["gap_percentile"] <= 100)
        self.assertEqual(r["novelty_check"]["status"], "not_performed")
        self.assertEqual(r["second_signal"]["status"], "unavailable_no_dense_model")
        self.assertIsNone(out["provenance"]["generated_utc"])
        self.assertEqual(out["provenance"]["model_load_error"], "forced fallback")

    def test_insufficient_corpus_has_no_fixed_cutoff(self):
        out = self.run_corpus(PAIRS[:2])
        r = out["pairs"][0]
        self.assertEqual(r["corpus_rank"]["status"], "insufficient_corpus")
        self.assertIsNone(r["corpus_rank"]["gap_percentile"])
        self.assertIsNone(r["restatement_warning_percentile"])

    def test_empty_and_degenerate_inputs(self):
        out = new.analyze_corpus({"pairs": [], "texts": []}, timestamp=False)
        self.assertEqual(out["pairs"], [])
        out = new.analyze_corpus({"pairs": [{"id": "e", "a": "", "b": ""}] * 6}, timestamp=False)
        r = out["pairs"][0]
        self.assertEqual(r["lexical_jaccard"], 0.0)
        self.assertEqual(r["claim_level"]["status"], "no_sentences")
        self.assertIsNone(r["corpus_rank"]["gap_z"])      # zero variance guarded

    def test_validation_reports_errors_not_crash(self):
        out = new.analyze_corpus({"pairs": [{"id": "x", "a": "ok"}, "junk", {"id": "y", "a": "a b", "b": "c d"}],
                                  "texts": [{"id": "t"}]}, timestamp=False)
        self.assertEqual(len(out["pairs"]), 1)
        self.assertEqual(len(out["errors"]), 3)

    def test_deterministic(self):
        a = json.dumps(self.run_corpus(), sort_keys=True)
        b = json.dumps(self.run_corpus(), sort_keys=True)
        self.assertEqual(a, b)

    def test_ranking_stable_ties(self):
        same = [{"id": "p%d" % i, "a": "alpha beta gamma", "b": "alpha beta gamma"} for i in range(6)]
        out = self.run_corpus(same)
        self.assertEqual([r["id"] for r in out["ranking_by_gap"]], ["p%d" % i for i in range(6)])

    def test_claim_level_picks_matching_sentence(self):
        out = self.run_corpus()
        cl = [r for r in out["pairs"] if r["id"] == "partial"][0]["claim_level"]
        self.assertEqual(cl["status"], "ok")
        self.assertIn("appointments", cl["best_pair"]["a_sentence"].lower())
        self.assertIn("appointments", cl["best_pair"]["b_sentence"].lower())

    def test_dense_path_with_stub(self):
        new._MODEL, new._METHOD, new._MODEL_ERROR = StubModel(), "sentence-transformers/stub", None
        out = self.run_corpus()
        r = out["pairs"][1]
        self.assertAlmostEqual(r["semantic_cosine"], 1.0, places=3)
        self.assertIn(r["second_signal"]["status"], ("agrees", "disagrees"))
        self.assertEqual(out["provenance"]["model"], new.MODEL_NAME)

    def test_stats_helpers(self):
        self.assertEqual(new.percentile_rank([1, 2, 3, 4], 4), 87.5)
        self.assertIsNone(new.percentile_rank([], 1))
        self.assertIsNone(new.zscore([1.0], 1.0))
        self.assertIsNone(new.zscore([2.0, 2.0, 2.0], 2.0))

    def test_idf_nonnegative_and_unseen_rare(self):
        idf = new.Idf(["red apple pie", "red apple tart", "red cherry jam"])
        self.assertTrue(all(v >= 0 for v in idf.idf.values()))
        self.assertGreater(idf.default, max(idf.idf.values()))


class Cli(unittest.TestCase):
    def run_cli(self, payload, *flags):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "in.json")
            with open(p, "w", encoding="utf-8-sig") as f:       # BOM on purpose (Windows editors)
                f.write(payload)
            env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
            return subprocess.run([sys.executable, "-B", "-I", NEW, p, *flags], capture_output=True, text=True, env=env, cwd=d)

    def test_cli_ok_and_legacy_shape(self):
        data = json.dumps({"pairs": PAIRS, "texts": []})
        r = self.run_cli(data, "--no-timestamp")
        self.assertEqual(r.returncode, 0, r.stderr)
        out = json.loads(r.stdout)
        self.assertIn("provenance", out)
        r2 = self.run_cli(data, "--legacy")
        self.assertEqual(set(json.loads(r2.stdout)), {"pairs", "buzzword_heuristic", "label"})
        self.assertEqual(set(json.loads(r2.stdout)["pairs"][0]),
                         {"id", "lexical_jaccard", "semantic_cosine", "semantic_method", "gap", "restatement_warning", "note"})

    def test_cli_bad_input_exit_codes(self):
        self.assertEqual(self.run_cli("{not json").returncode, 1)
        self.assertEqual(self.run_cli(json.dumps({"pairs": [{"id": "x"}]})).returncode, 2)

    def test_cli_byte_identical_reruns(self):
        data = json.dumps({"pairs": PAIRS})
        self.assertEqual(self.run_cli(data, "--no-timestamp").stdout, self.run_cli(data, "--no-timestamp").stdout)


if __name__ == "__main__":
    unittest.main(verbosity=2)
