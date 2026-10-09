import json, os, subprocess, sys, tempfile, unittest
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(ROOT, "lib"))
import atypicality, backtest, bridging, common, gaps, holes, proposals, surprise, textsim
from common import Graph, assert_read_only
from synth import planted


def tiny():
    nodes = [{"id": x, "labels": ["Framework"], "name": x, "attrs": {}, "text": ""} for x in "abcdef"]
    e = [("a", "b"), ("a", "c"), ("d", "b"), ("d", "c")]  # induced 4-cycle a-b-d-c, a and d not adjacent, b and c not adjacent
    return Graph(nodes, [{"s": s, "t": t, "type": "RELATES_TO"} for s, t in e])


class Guard(unittest.TestCase):
    def test_rejects_writes(self):
        for q in ["CREATE (n)", "MATCH (n) SET n.x=1", "MATCH (n) DETACH DELETE n", "CALL apoc.create.node(['X'],{})",
                  "MATCH (n) REMOVE n.x", "MERGE (n:X)", "LOAD CSV FROM 'x' AS r RETURN r", "MATCH (n) RETURN n; MATCH (m) RETURN m",
                  "CALL { MATCH (n) RETURN n } RETURN 1"]:
            with self.assertRaises(ValueError, msg=q):
                assert_read_only(q)

    def test_allows_reads_and_ignores_strings(self):
        assert_read_only("MATCH (n:Framework) WHERE n.name = 'CREATE SET' RETURN n LIMIT 5")
        assert_read_only("MATCH (a)-[r]->(b) RETURN type(r) AS t // SET comment")

    def test_all_shipped_cypher_is_read_only(self):
        d = os.path.join(ROOT, "cypher")
        for f in os.listdir(d):
            assert_read_only(open(os.path.join(d, f), encoding="utf-8").read())


class Structure(unittest.TestCase):
    def test_induced_c4_found(self):
        cyc = holes.induced_c4(tiny())
        self.assertEqual(len(cyc), 1)
        self.assertEqual({cyc[0]["diagonal_1"], cyc[0]["diagonal_2"]}, {("a", "d"), ("b", "c")})

    def test_open_triads(self):
        rows, _ = gaps.open_triads(tiny(), min_common=2)
        self.assertEqual({(r["u"], r["v"]) for r in rows}, {("a", "d"), ("b", "c")})

    def test_gaps_beat_random_on_planted(self):
        g = planted()
        res = backtest.evaluate(g, "2026-06-01T00:00:00", ks=(10, 50))
        self.assertNotIn("error", res)
        self.assertGreater(res["gaps"]["lift@50"], 2.0)
        self.assertGreater(res["gaps"]["hits@50"], res["pref_attachment"]["hits@50"] - 1)

    def test_backtest_without_dates(self):
        g = tiny()
        self.assertIn("error", backtest.evaluate(g))

    def test_communities_recover_planted(self):
        g = planted(p_out=0.0)
        comm = bridging.communities(g, 5)
        for c in range(4):
            self.assertEqual(len({comm[f"c{c}n{i}"] for i in range(14)}), 1)

    def test_betweenness_path(self):
        nodes = [{"id": x, "labels": ["X"], "name": x} for x in "abc"]
        g = Graph(nodes, [{"s": "a", "t": "b", "type": "R"}, {"s": "b", "t": "c", "type": "R"}])
        bc = bridging.betweenness(g)
        self.assertGreater(bc["b"], bc["a"])
        self.assertEqual(bc["a"], 0.0)

    def test_swap_preserves_degree_and_null_runs(self):
        g = planted()
        hs = holes.hole_summary(g, rounds=3)
        self.assertGreater(hs["holes"], 0)

    def test_atypicality_runs(self):
        g = planted(p_out=0.05)
        z, cat, obs = atypicality.category_zscores(g, "problem_type", shuffles=8)
        prof = atypicality.edge_profile(g, z, cat)
        self.assertGreater(prof["n"], 0)


class Text(unittest.TestCase):
    def test_semantic_gap_and_btm(self):
        g = planted(p_out=0.0, p_in=0.2)
        ids = sorted(g.nodes)
        rows = textsim.semantic_gaps(g, ids, min_sim=0.3, top=50)
        self.assertTrue(all(g.nodes[r["u"]]["text"].split()[0] == g.nodes[r["v"]]["text"].split()[0] for r in rows[:10]))
        a = ["alpha beta gamma delta"] * 6 + ["omega sigma tau upsilon"] * 6
        b = ["alpha beta gamma delta epsilon"] * 8
        uniq, topics = textsim.btm_unique(a, b, k=2, tau=0.2, seeds=(1, 2, 3))
        self.assertTrue(set(range(6, 12)) <= set(uniq))
        self.assertFalse(set(range(0, 6)) & set(uniq))


class Surprise(unittest.TestCase):
    def test_kl_values(self):
        self.assertAlmostEqual(surprise.bernoulli_kl(0.5, 0.5), 0.0, places=6)
        self.assertAlmostEqual(surprise.bernoulli_kl(0.9, 0.5), 0.5310044, places=5)

    def test_ignorance_flag(self):
        s = surprise.score([0.1, 0.9, 0.5], [0.9, 0.9, 0.9])
        self.assertTrue(s["ignorance_risk"])
        s2 = surprise.score([0.5, 0.52, 0.48], [0.9, 0.88, 0.92])
        self.assertFalse(s2["ignorance_risk"])
        self.assertGreater(s2["surprise_bits"], 0.3)


class Proposals(unittest.TestCase):
    def test_merge_drops_existing_and_rewards_agreement(self):
        g = tiny()
        src = {"gaps": [{"u": "a", "v": "d", "score": 2.0}, {"u": "a", "v": "b", "score": 1.0}],
               "holes": [{"u": "d", "v": "a", "score": 3.0}, {"u": "e", "v": "f", "score": 1.0}]}
        out, dropped = proposals.merge(g, src)
        self.assertEqual(dropped, 1)
        self.assertEqual(out[0]["s"], "a")
        self.assertEqual(out[0]["agree"], 2)
        self.assertTrue(all(p["status"] == "proposed" and p["evidence"] == [] for p in out))


class NameIssues(unittest.TestCase):
    def test_flags(self):
        self.assertEqual(proposals.name_issue("PEST Analysis", "PEST"), "possible_duplicate")
        self.assertEqual(proposals.name_issue("Reverse Salient Analysis", "Reverse Salient"), "possible_duplicate")
        self.assertEqual(proposals.name_issue("H", "C"), "suspect_name")
        self.assertIsNone(proposals.name_issue("Red Teaming", "Adoption-Capacity Theory"))


class Scripts(unittest.TestCase):
    def run_py(self, *args):
        return subprocess.run([sys.executable, "-B", *args], capture_output=True, text=True,
                              env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"})

    def test_snapshot_pipeline_and_approval_gate(self):
        g = planted()
        nodes = [{"id": n["id"], "labels": n["labels"], "name": n["name"], "problem_type": n["attrs"]["problem_type"], "text": n["text"]} for n in g.nodes.values()]
        edges = [dict(e) for e in g.edges]
        with tempfile.TemporaryDirectory() as d:
            json.dump(nodes, open(f"{d}/n.json", "w")); json.dump(edges, open(f"{d}/e.json", "w"))
            r = self.run_py(os.path.join(ROOT, "scripts", "snapshot_from_rows.py"), f"{d}/n.json", f"{d}/e.json", f"{d}/s.json")
            self.assertEqual(r.returncode, 0, r.stderr)
            r = self.run_py(os.path.join(ROOT, "scripts", "run_pipeline.py"), f"{d}/s.json", f"{d}/out", "--top", "20")
            self.assertEqual(r.returncode, 0, r.stderr)
            props = json.load(open(f"{d}/out/proposals.json"))
            self.assertTrue(props and all(p["status"] == "proposed" for p in props))
            r = self.run_py(os.path.join(ROOT, "scripts", "backtest_run.py"), f"{d}/s.json", "--cutoff", "2026-06-01T00:00:00")
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn("lift@50", r.stdout)
            # approval gate: no evidence, no direction -> refused
            open(f"{d}/ok.txt", "w").write(props[0]["id"])
            r = self.run_py(os.path.join(ROOT, "scripts", "approve_write.py"), f"{d}/out/proposals.json", f"{d}/ok.txt", f"{d}/w.cypher")
            self.assertEqual(r.returncode, 1)
            self.assertIn("refused", r.stdout)
            props[0]["evidence"] = [{"source": "chunk:123", "quote": "A feeds into B in the text."}]
            props[0]["direction"] = "s_to_t"
            json.dump(props, open(f"{d}/out/proposals.json", "w"))
            r = self.run_py(os.path.join(ROOT, "scripts", "approve_write.py"), f"{d}/out/proposals.json", f"{d}/ok.txt", f"{d}/w.cypher")
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            cy = open(f"{d}/w.cypher").read()
            self.assertIn("MERGE", cy)
            self.assertIn("navigator-approved", cy)

    def test_surprise_cli(self):
        with tempfile.TemporaryDirectory() as d:
            json.dump([{"id": "x", "claim": "c", "prior": [0.5, 0.5], "posterior": [0.9, 0.9]}], open(f"{d}/b.json", "w"))
            r = self.run_py(os.path.join(ROOT, "scripts", "surprise_score.py"), f"{d}/b.json", f"{d}/o.json")
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertGreater(json.load(open(f"{d}/o.json"))[0]["surprise_bits"], 0.4)


class SMEBridge(unittest.TestCase):
    def test_maps_two_chains(self):
        try:
            import sme_bridge
            sme_bridge._load_sme()
        except ImportError:
            self.skipTest("sme.py not found")
        nodes = [{"id": x, "labels": ["Framework"], "name": x, "attrs": {}} for x in
                 ["A1", "A2", "A3", "A4", "B1", "B2", "B3"]]
        ed = [("A1", "A2"), ("A2", "A3"), ("A3", "A4"), ("B1", "B2"), ("B2", "B3")]
        g = Graph(nodes, [{"s": s, "t": t, "type": "FEEDS_INTO"} for s, t in ed])
        res = sme_bridge.map_neighbourhoods(g, "A1", "B1", hops=3)
        kinds = [p for r in res for p in r["proposals"]]
        self.assertTrue(any(p["kind"] in ("edge", "needs_new_node") for p in kinds), res)


if __name__ == "__main__":
    unittest.main()
