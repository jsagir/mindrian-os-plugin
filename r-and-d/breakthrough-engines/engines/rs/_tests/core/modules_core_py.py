"""Run from package-2026:  PYTHONDONTWRITEBYTECODE=1 python3 -I rs/_tests/core/modules_core_py.py"""
import os, sys, tempfile, importlib.util, math
HERE = os.path.dirname(os.path.abspath(__file__))
CORE = os.path.join(HERE, "..", "..", "shared", "lib", "core")
sys.dont_write_bytecode = True
sys.path.insert(0, CORE)
import rs_hybrid, rs_corpus, rs_cache, rs_rooms
passed = failed = 0
def t(name, fn):
    global passed, failed
    try:
        fn(); passed += 1; print("ok   " + name)
    except Exception as e:
        failed += 1; print("FAIL %s: %r" % (name, e))

def a(c, m=""):
    assert c, m

t("hybrid split_claims", lambda: a(rs_hybrid.split_claims("Cars are slow. We propose a new engine using plasma.")))
def bm():
    s = rs_hybrid.bm25_scores("plasma engine", ["plasma engine design", "cooking pasta", "engine"])
    a(s[0] > s[1] and s[2] > s[1], s)
t("hybrid bm25 ranks relevant first", bm)
def hr():
    corpus = [{"text": "plasma engine design", "_vector": [1.0, 0.0]},
              {"text": "cooking pasta", "_vector": [0.0, 1.0]},
              {"text": "plasma", "_vector": [0.9, 0.1]}]
    for fusion in ("rrf", "zscore"):
        r1 = rs_hybrid.hybrid_rank("plasma engine", corpus, [1.0, 0.0], k=3, fusion=fusion)
        r2 = rs_hybrid.hybrid_rank("plasma engine", corpus, [1.0, 0.0], k=3, fusion=fusion)
        a(r1 == r2 and len(r1) == 3, fusion)
        a("cooking" not in str(r1[0]), fusion)
t("hybrid_rank deterministic", hr)
t("corpus _arxiv_query", lambda: a(rs_corpus._arxiv_query("quantum  biology") == "all:quantum+AND+all:biology"))
t("corpus invert_abstract skips negatives", lambda: a(rs_corpus.invert_abstract({"a": [0, 2], "b": [1], "z": [-1]}) == "a b a"))
def slug():
    d = tempfile.mkdtemp()
    for bad in ("external:../../x", "external:", "external:A/B"):
        a(rs_cache.fetch_all_from_namespace(bad, room_dir=d) == [], bad)
        a(rs_cache.get_namespace_freshness(bad, room_dir=d) is None, bad)
    a(not rs_cache._is_safe_slug("../x") and rs_cache._is_safe_slug("a-b-1"))
t("cache slug traversal refused", slug)
t("cache safe year", lambda: a(rs_cache._safe_year("2020-01") == 2020 and rs_cache._safe_year("n.d.") == 0 and rs_cache._safe_year(None) == 0))
t("rooms module imports", lambda: a(hasattr(rs_rooms, "_extract_body")))
def fm():
    b = rs_rooms._extract_body("﻿---\r\ntitle: x\r\n---\r\nBody here\r\n")
    a("Body here" in b and "title" not in b, repr(b))
t("rooms CRLF/BOM frontmatter", fm)
print("\n%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
