"""Overlay for lib/core/rs_math.py used ONLY in tests: sklearn is not installed
here, so build_tfidf_svd is replaced with a numpy TF-IDF + SVD. The pure
functions (topic membership, L1 similarity, abs_diff_topk, classify_direction)
come from the real file, executed unchanged."""
import importlib.util, os, re
import numpy as np

_real_path = os.environ["RS_REAL_MATH"]
_spec = importlib.util.spec_from_file_location("_rs_math_real", _real_path)
_real = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(_real)

_STOP = set("a an and are as at be by for from has in is it of on or that the to was with we this these those".split())

class _Vec:
    def __init__(self, terms): self._t = terms
    def get_feature_names_out(self): return self._t

class _Svd:
    def __init__(self, comps): self.components_ = comps

def build_tfidf_svd(texts, n_components=80, max_features=2000, max_df=0.5, random_state=256):
    docs = [[w for w in re.findall(r"(?u)\b\w\w+\b", t.lower()) if w not in _STOP] for t in texts]
    n = len(docs); df = {}
    for d in docs:
        for w in set(d): df[w] = df.get(w, 0) + 1
    terms = sorted([w for w, c in df.items() if c / n <= max_df], key=lambda w: (-df[w], w))[:max_features]
    terms = sorted(terms)
    idx = {w: i for i, w in enumerate(terms)}
    X = np.zeros((n, len(terms)))
    for i, d in enumerate(docs):
        for w in d:
            if w in idx: X[i, idx[w]] += 1
    idf = np.log((1 + n) / (1 + np.array([df[w] for w in terms]))) + 1
    X = X * idf
    nr = np.linalg.norm(X, axis=1); nr[nr == 0] = 1; X = X / nr[:, None]
    k = max(1, min(n_components, n - 1, len(terms) - 1))
    _u, _s, vt = np.linalg.svd(X, full_matrices=False)
    comps = vt[:k]
    for r in range(comps.shape[0]):
        if comps[r][np.argmax(np.abs(comps[r]))] < 0: comps[r] = -comps[r]
    return _Vec(np.array(terms)), _Svd(comps), X

extract_topic_keywords = _real.extract_topic_keywords
count_topic_membership = _real.count_topic_membership
normalize_and_l1_similarity = _real.normalize_and_l1_similarity
abs_diff_topk = _real.abs_diff_topk
classify_direction = _real.classify_direction

def build_lsa_matrix(texts, n_components=80, top_k=7):
    tokenized = [t.split() for t in texts]
    vec, svd, _X = build_tfidf_svd(texts, n_components=n_components)
    topics = extract_topic_keywords(svd, vec.get_feature_names_out(), top_k=top_k)
    return normalize_and_l1_similarity(count_topic_membership(tokenized, topics))
