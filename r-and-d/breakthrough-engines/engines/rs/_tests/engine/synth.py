"""Synthetic corpus + stub encoders for the rs-engine tests.

The dense encoder here is a STUB: a concept-collapsing bag (synonyms map to one
concept id; ambiguous surface words map to a concept chosen by the document's
domain marker). It stands in for a sentence-transformer so the planted
structure can be tested offline. It says nothing about real model quality.
"""
import hashlib, os, random
import numpy as np

SYLL = ["ba","ko","ri","tu","men","sol","dar","vex","lin","po","gar","fi","nus","tel","or","qua","zem","hal","bri","cu"]

def _word(seed_int):
    r = random.Random(seed_int)
    return "".join(r.choice(SYLL) for _ in range(3)) + r.choice(["ic","um","ar","on","ex"])

def build_lexicon(n_concepts=60, n_forms=3):
    words, seen = {}, set()
    k = 0
    for c in range(n_concepts):
        for f in range(n_forms):
            w = _word(1000 + k); k += 1
            while w in seen:
                w = _word(1000 + k); k += 1
            seen.add(w); words[(c, f)] = w
    return words

LEX = build_lexicon()
WORD2CONCEPT = {w: c for (c, f), w in LEX.items()}
AMBIG = [("serrix", "clinic"), ("vandor", "factory")]
PLANT_S = ["kelmor", "tavrin", "osquil", "brenta", "dulvex", "marqin", "yostal", "fennor"]

FILLER = ("system process data team model signal result review stage output input record "
          "measure cycle report plan step value group level source basis").split()

def make_corpus(root, seed=7):
    rng = random.Random(seed)
    sections = ["alpha", "beta", "gamma", "delta", "epsilon"]
    truth = {}
    os.makedirs(root, exist_ok=True)
    pools = {s: list(range(i * 10, i * 10 + 10)) for i, s in enumerate(sections)}  # concept pool per section
    dialect = {"alpha": 0, "beta": 0, "gamma": 1, "delta": 2, "epsilon": 1}
    docs = []
    for si, sec in enumerate(sections):
        for d in range(8):
            sents = []
            for _ in range(6):
                ws = [LEX[(rng.choice(pools[sec]), dialect[sec])] for _ in range(6)]
                ws += [rng.choice(FILLER) for _ in range(6)]
                rng.shuffle(ws)
                sents.append(" ".join(ws).capitalize() + ".")
            docs.append([sec, f"{sec}-note-{d:02d}", f"{sec} note {d}", sents])
    # Planted type 1 (structural_transfer): same rare concepts, different dialects.
    rare = [50, 51, 52, 53, 54, 55, 56, 57]
    def planted(dialect_idx, opener):
        out = []
        for k in range(5):
            cs = rng.sample(rare, 5)
            out.append(opener[k % len(opener)] + " " + " ".join(LEX[(c, dialect_idx)] for c in cs) + " in the system.")
        return out
    docs[0][3] = planted(0, ["The main problem is that", "This limitation affects", "The challenge is that we cannot handle"]); docs[0][1] = "planted-p"
    docs[3 * 8][3] = planted(2, ["We propose a method using", "The approach applies", "Our protocol uses"]); docs[3 * 8][1] = "planted-q"
    truth["structural_transfer"] = [("alpha/planted-p", "delta/planted-q")]
    # Planted type 2 (semantic_implementation): same surface words, different domains.
    def amb(domain, marker):
        out = []
        for k in range(5):
            ws = rng.sample(PLANT_S, 6)
            out.append(f"The {domain} uses " + " ".join(ws) + f" {marker} for every record in the review.")
        return out
    docs[8][3] = amb("clinic", "serrix"); docs[8][1] = "planted-x"
    docs[4 * 8][3] = amb("factory", "vandor"); docs[4 * 8][1] = "planted-y"
    truth["semantic_implementation"] = [("beta/planted-x", "epsilon/planted-y")]
    for sec, name, title, sents in docs:
        os.makedirs(os.path.join(root, sec), exist_ok=True)
        with open(os.path.join(root, sec, name + ".md"), "w", encoding="utf-8", newline="") as fh:
            fh.write(f"---\r\ntitle: {title}\r\n---\r\n# {title}\r\n\r\n" + "\r\n".join(sents) + "\r\n")
    return truth


def stub_dense_embed(texts, dim=128):
    """Concept-collapsing embedder (stub for a sentence-transformer)."""
    concept_ids = {}
    out = np.zeros((len(texts), dim), dtype=np.float32)
    def cid(key):
        if key not in concept_ids:
            h = int(hashlib.md5(repr(key).encode()).hexdigest()[:8], 16)
            concept_ids[key] = h % dim
        return concept_ids[key]
    for r, t in enumerate(texts):
        toks = [w.strip(".,").lower() for w in t.split()]
        domain = "clinic" if "clinic" in toks else ("factory" if "factory" in toks else "none")
        for w in toks:
            if w in WORD2CONCEPT:
                out[r, cid(("c", WORD2CONCEPT[w]))] += 1.0
            elif w in PLANT_S:
                out[r, cid(("amb", w, domain))] += 1.0
            elif w in ("serrix", "vandor"):
                out[r, cid(("m", w))] += 1.0
            else:
                out[r, cid(("f", w))] += 0.15
    return out


def fake_external_docs(seed=11):
    """12 offline 'fetched' docs (no network). Doc 0 re-expresses the planted
    rare concepts in dialect 1, so it should bridge to alpha/planted-p."""
    rng = random.Random(seed)
    rare = [50, 51, 52, 53, 54, 55, 56, 57]
    docs = []
    for k in range(12):
        if k == 0:
            ab = " ".join("We propose a method using " + " ".join(LEX[(c, 1)] for c in rng.sample(rare, 5)) + " in the system." for _ in range(5))
        else:
            pool = list(range(20 + 2 * k, 30 + 2 * k))
            ab = " ".join(" ".join([LEX[(rng.choice(pool), 1)] for _ in range(6)] + [rng.choice(FILLER) for _ in range(6)]).capitalize() + "." for _ in range(5))
        docs.append({"source": "openalex" if k % 2 else "arxiv", "external_id": f"W{1000+k}", "title": f"External paper {k}",
                     "abstract": ab, "year": 2024, "authors": ["A"], "url": f"https://example.org/p/{k}", "doi": f"10.0/{k}"})
    return docs


def fake_hybrid_build(room_dir, topic, external_target=2000):
    import numpy as _np
    from pathlib import Path as _P
    import importlib.util as _u
    # reuse the engine's own discovery through a late import in the driver
    raise RuntimeError("replaced by drive_engine")
