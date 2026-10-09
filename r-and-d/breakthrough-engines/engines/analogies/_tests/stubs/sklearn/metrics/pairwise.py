import numpy as np
def cosine_similarity(a, b):
    a = np.atleast_2d(a).astype(float); b = np.atleast_2d(b).astype(float)
    na = np.linalg.norm(a, axis=1, keepdims=True); nb = np.linalg.norm(b, axis=1, keepdims=True)
    na[na == 0] = 1; nb[nb == 0] = 1
    return (a / na) @ (b / nb).T
