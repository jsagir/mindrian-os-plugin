"""Reproduce the published results of Falkenhainer, Forbus and Gentner (1989).

Run:  PYTHONDONTWRITEBYTECODE=1 python3 -B -m unittest discover -s tests -v   (from sme-agent/)
"""
import os, sys, unittest
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
import fixtures as f
import sme


class WaterHeat(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.r = sme.match(f.water(), f.heat(), "LS")

    def test_14_match_hypotheses(self):
        self.assertEqual(len(self.r.mhs), 14)

    def test_three_gmaps_and_weights(self):
        w = [g["weight"] for g in self.r.gmaps]
        self.assertEqual(len(w), 3)
        for got, want in zip(w, (5.99, 3.94, 2.44)):
            self.assertAlmostEqual(got, want, delta=0.006)

    def test_local_scores(self):
        got = {(m.b, m.t): m.belief[0] for m in self.r.mhs.values()}
        self.assertAlmostEqual(got[(">pressure", ">temperature")], 0.65, places=3)
        self.assertAlmostEqual(got[("pressure-beaker", "temp-coffee")], 0.712, places=3)
        self.assertAlmostEqual(got[("beaker", "coffee")], 0.9318, places=3)
        self.assertAlmostEqual(got[("water", "heat")], 0.632, places=3)

    def test_candidate_inference_is_cause(self):
        cis = [c["expression"] for c in self.r.gmaps[0]["candidate_inferences"]]
        self.assertEqual(cis, ["(cause >temperature hflow)"])

    def test_best_gmap_maps_flow_not_surface(self):
        corr = dict(self.r.gmaps[0]["emaps"])
        self.assertEqual(corr["water"], "heat")
        self.assertEqual(corr["beaker"], "coffee")


class Rutherford(unittest.TestCase):
    def test_analogy(self):
        r = sme.match(f.solar(), f.rutherford(), "AN")
        self.assertEqual(len(r.mhs), 16)
        w = [g["weight"] for g in r.gmaps]
        self.assertEqual(len(w), 3)
        for got, want in zip(w, (6.03, 4.04, 1.87)):
            self.assertAlmostEqual(got, want, delta=0.01)
        self.assertEqual(dict(r.gmaps[0]["emaps"])["sun"], "nucleus")


class Karla(unittest.TestCase):
    def check(self, t, rs, n_mh, weight):
        r = sme.match(f.karla(), t(), rs)
        self.assertEqual(len(r.mhs), n_mh)
        self.assertAlmostEqual(r.gmaps[0]["weight"], weight, places=4)

    def test_an_ta5(self): self.check(f.ta5, "AN", 54, 22.362718)
    def test_an_ma5(self): self.check(f.ma5, "AN", 47, 16.816530)
    def test_ma_ta5(self): self.check(f.ta5, "MA", 12, 6.411572)
    def test_ma_ma5(self): self.check(f.ma5, "MA", 14, 7.703568)

    def test_systematicity_beats_surface(self):
        """Paper's headline: analogy rules prefer the relational story (TA5), appearance rules prefer MA5."""
        an = [sme.match(f.karla(), t(), "AN").gmaps[0]["weight"] for t in (f.ta5, f.ma5)]
        ma = [sme.match(f.karla(), t(), "MA").gmaps[0]["weight"] for t in (f.ta5, f.ma5)]
        self.assertGreater(an[0], an[1])
        self.assertGreater(ma[1], ma[0])


class Invariants(unittest.TestCase):
    def test_one_to_one(self):
        for b, t, rs in ((f.water, f.heat, "LS"), (f.solar, f.rutherford, "AN"), (f.karla, f.ta5, "AN")):
            for g in sme.match(b(), t(), rs).gmaps:
                pairs = list(g["emaps"]) + list(g["correspondences"])
                bs = [p[0] for p in pairs]; ts = [p[1] for p in pairs]
                self.assertEqual(len(bs), len(set(bs)))
                self.assertEqual(len(ts), len(set(ts)))

    def test_deterministic(self):
        a = sme.summarize(sme.match(f.karla(), f.ta5(), "AN"))
        b = sme.summarize(sme.match(f.karla(), f.ta5(), "AN"))
        self.assertEqual(a, b)

    def test_dempster(self):
        s, n = sme.dempster((0.5, 0.0), (0.4, 0.0))
        self.assertAlmostEqual(s, 0.7, places=6)
        s, n = sme.dempster((0.5, 0.0), (0.0, 0.8))
        self.assertAlmostEqual(s, 1 / 6, places=6)

    def test_bad_ruleset(self):
        with self.assertRaises(ValueError):
            sme.SME("XX")


if __name__ == "__main__":
    unittest.main()
