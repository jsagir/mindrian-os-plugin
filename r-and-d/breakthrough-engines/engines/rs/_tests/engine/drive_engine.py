"""Run an rs-engine.py (original or 2026) with the stub dense encoder patched
in. Usage: drive_engine.py <engine.py> <stub|none> <engine args...>"""
import importlib.util, os, sys
sys.dont_write_bytecode = True
here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
engine, mode, argv = sys.argv[1], sys.argv[2], sys.argv[3:]
spec = importlib.util.spec_from_file_location("rs_engine_under_test", engine)
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
if mode == "stub":
    import synth
    mod._embed_local_minilm = lambda texts: synth.stub_dense_embed(list(texts))
elif mode == "aniso":
    # Anisotropic encoder: a large shared component makes every cosine high
    # (as real e5-style models do). Same structure, shifted scale.
    import synth, numpy as _np
    def _aniso(texts):
        e = synth.stub_dense_embed(list(texts)); e[:, 0] += 6.0
        return e
    mod._embed_local_minilm = _aniso
elif mode == "none":
    mod._embed_local_minilm = lambda texts: None
if os.environ.get("RS_TEST_OFFLINE_EXTERNAL") == "1":
    import synth
    mod.fetch_corpus = lambda topic, target_n=2000: synth.fake_external_docs()
    mod._RS_CACHE_AVAILABLE = False          # force the local (non-cache) path
    mod._gate_docs_local = lambda topic, docs: docs   # topic gate needs a real encoder; bypassed for the offline test
    if hasattr(mod, "_RS_HYBRID_AVAILABLE"):
        def _build(room_dir, topic, external_target=2000):
            import numpy as np
            from pathlib import Path
            arts = mod.discover_artifacts(Path(room_dir))
            corpus = [{"global_id": "room::" + a["id"], "artifact_id": a["id"], "room_id": "room", "section": a["section"],
                       "title": a["title"], "path": a["path"], "text": a["text"]} for a in arts]
            ext = synth.fake_external_docs()
            for d in ext:
                corpus.append({"global_id": "ext::" + d["external_id"], "external_id": d["external_id"], "source": d["source"],
                               "title": d["title"], "path": d["url"], "text": d["abstract"], "doi": d["doi"], "year": d["year"],
                               "section": d["source"]})
            mask = np.array([True] * len(arts) + [False] * len(ext))
            meta = {"topic_slug": "synthetic-topic", "room_id": "room", "room_count": len(arts), "external_count": len(ext),
                    "cache_mode": "offline-test"}
            return corpus, mask, meta
        mod._rs_hybrid_build = _build
sys.exit(mod.main(argv))
