import os, sys, unittest
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
import fixtures as f
import breakthrough as bt


class Breakthrough(unittest.TestCase):
    def test_far_domain_water_to_heat(self):
        r = bt.assess(f.water(), f.heat(), "LS")
        top = r[0]
        self.assertEqual(top["status"], "surmise")
        self.assertGreater(top["surface_distance"], 0.5)
        self.assertEqual([c["expression"] for c in top["candidate_inferences"]], ["(cause >temperature hflow)"])
        self.assertGreater(top["breakthrough"], r[1]["breakthrough"])

    def test_known_claim_is_not_novel(self):
        r = bt.assess(f.water(), f.heat(), "LS", known=["(cause >temperature hflow)"])
        self.assertEqual(r[0]["novelty"], 0.0)
        self.assertEqual(r[0]["breakthrough"], 0.0)

    def test_identical_domains_have_no_distance(self):
        self.assertEqual(bt.surface_distance(f.heat(), f.heat()), 0.0)


if __name__ == "__main__":
    unittest.main()
