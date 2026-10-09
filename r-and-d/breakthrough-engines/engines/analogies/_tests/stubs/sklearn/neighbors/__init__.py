import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
class NearestNeighbors:
    def __init__(self, n_neighbors=5, metric="cosine"):
        self.k = n_neighbors
    def fit(self, X):
        self.X = np.asarray(X, dtype=float); return self
    def kneighbors(self, Q):
        d = 1.0 - cosine_similarity(Q, self.X)
        idx = np.argsort(d, axis=1, kind="stable")[:, : self.k]
        return np.take_along_axis(d, idx, axis=1), idx
