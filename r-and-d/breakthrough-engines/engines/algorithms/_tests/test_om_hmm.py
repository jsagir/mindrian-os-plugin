"""Checks of the OM-HMM specification's algebra. Pure Python, no packages.
Run: PYTHONDONTWRITEBYTECODE=1 python3 -B test_om_hmm.py

Scope: verifies the stated matrices and the standard HMM recursions (forward, Viterbi,
Baum-Welch) on ILLUSTRATIVE emission parameters. It does NOT validate the claim that the
model measures integrative thinking; that needs a labelled dataset that does not exist.
"""
import sys
sys.dont_write_bytecode = True
import itertools
import math
import unittest

A_INT = [[0.4, 0.3, 0.2, 0.1], [0.2, 0.3, 0.4, 0.1], [0.1, 0.2, 0.4, 0.3], [0.3, 0.2, 0.2, 0.3]]
A_CON = [[0.6, 0.3, 0.1, 0.0], [0.1, 0.6, 0.3, 0.0], [0.0, 0.1, 0.6, 0.3], [0.0, 0.0, 0.2, 0.8]]
PI = [0.4, 0.3, 0.2, 0.1]            # ILLUSTRATIVE (the spec gives none)
# four binary features per step; P(feature = 1 | state). ILLUSTRATIVE.
# features: complex, multidirectional, holistic, synthesis (the "1" side of each contrast)
P1_INT = [[0.7, 0.5, 0.5, 0.2], [0.8, 0.7, 0.5, 0.3], [0.8, 0.7, 0.8, 0.5], [0.8, 0.8, 0.8, 0.8]]
P1_CON = [[0.3, 0.2, 0.2, 0.1], [0.3, 0.2, 0.3, 0.1], [0.2, 0.2, 0.3, 0.2], [0.2, 0.1, 0.2, 0.3]]


def emit(P1, i, obs):
    p = 1.0
    for f, o in zip(P1[i], obs):
        p *= f if o else (1 - f)
    return p


def forward(A, P1, pi, seq, scaled=True):
    n = len(A)
    alpha = [pi[i] * emit(P1, i, seq[0]) for i in range(n)]
    loglik = 0.0
    if scaled:
        c = sum(alpha); loglik += math.log(c); alpha = [a / c for a in alpha]
    for obs in seq[1:]:
        alpha = [sum(alpha[j] * A[j][i] for j in range(n)) * emit(P1, i, obs) for i in range(n)]
        if scaled:
            c = sum(alpha); loglik += math.log(c); alpha = [a / c for a in alpha]
    return loglik if scaled else sum(alpha)


def brute(A, P1, pi, seq):
    n, tot = len(A), 0.0
    for path in itertools.product(range(n), repeat=len(seq)):
        p = pi[path[0]] * emit(P1, path[0], seq[0])
        for t in range(1, len(seq)):
            p *= A[path[t - 1]][path[t]] * emit(P1, path[t], seq[t])
        tot += p
    return tot


def viterbi(A, P1, pi, seq):
    n = len(A)
    d = [math.log(pi[i]) + math.log(emit(P1, i, seq[0])) if pi[i] > 0 else -math.inf for i in range(n)]
    back = []
    lg = lambda x: math.log(x) if x > 0 else -math.inf
    for obs in seq[1:]:
        nd, bp = [], []
        for j in range(n):
            best = max(range(n), key=lambda i: d[i] + lg(A[i][j]))
            nd.append(d[best] + lg(A[best][j]) + lg(emit(P1, j, obs))); bp.append(best)
        d = nd; back.append(bp)
    s = max(range(n), key=lambda i: d[i]); path = [s]
    for bp in reversed(back):
        s = bp[s]; path.append(s)
    return path[::-1], max(d)


def baum_welch_step(A, P1, pi, seqs, smooth=1e-3):
    """One EM step over several sequences with Bernoulli features. Returns new (A, P1, pi, loglik)."""
    n, F = len(A), len(P1[0])
    numA = [[smooth] * n for _ in range(n)]; numP = [[smooth] * F for _ in range(n)]; denP = [2 * smooth] * n
    numPi = [smooth] * n; ll = 0.0
    for seq in seqs:
        T = len(seq)
        al, cs = [], []
        a = [pi[i] * emit(P1, i, seq[0]) for i in range(n)]; c = sum(a); cs.append(c); al.append([x / c for x in a])
        for t in range(1, T):
            a = [sum(al[-1][j] * A[j][i] for j in range(n)) * emit(P1, i, seq[t]) for i in range(n)]
            c = sum(a); cs.append(c); al.append([x / c for x in a])
        ll += sum(math.log(c) for c in cs)
        be = [[1.0] * n for _ in range(T)]
        for t in range(T - 2, -1, -1):
            be[t] = [sum(A[i][j] * emit(P1, j, seq[t + 1]) * be[t + 1][j] for j in range(n)) / cs[t + 1] for i in range(n)]
        for t in range(T):
            g = [al[t][i] * be[t][i] for i in range(n)]; z = sum(g); g = [x / z for x in g]
            if t == 0:
                for i in range(n): numPi[i] += g[i]
            for i in range(n):
                denP[i] += g[i]
                for f in range(F): numP[i][f] += g[i] * seq[t][f]
            if t < T - 1:
                xi = [[al[t][i] * A[i][j] * emit(P1, j, seq[t + 1]) * be[t + 1][j] / cs[t + 1] for j in range(n)] for i in range(n)]
                z = sum(sum(r) for r in xi)
                for i in range(n):
                    for j in range(n): numA[i][j] += xi[i][j] / z
    A2 = [[x / sum(r) for x in r] for r in numA]
    P2 = [[numP[i][f] / denP[i] for f in range(F)] for i in range(n)]
    pi2 = [x / sum(numPi) for x in numPi]
    return A2, P2, pi2, ll


SEQ = [(1, 0, 0, 0), (1, 1, 0, 0), (1, 1, 1, 0), (1, 1, 1, 1), (0, 1, 1, 1)]


class T(unittest.TestCase):
    def test_rows_stochastic(self):
        for A in (A_INT, A_CON):
            for r in A:
                self.assertAlmostEqual(sum(r), 1.0, places=12)
                self.assertTrue(all(x >= 0 for x in r))

    def test_spec_dimension_counts(self):
        # B is stated as 4x8 (categorical). Four binary contrasts need only 4x4 Bernoulli parameters.
        self.assertEqual(4 * 8 - 4, 28)       # free parameters of a 4x8 categorical B
        self.assertEqual(4 * 4, 16)           # Bernoulli-per-feature B

    def test_forward_matches_brute_force(self):
        for A, P1 in ((A_INT, P1_INT), (A_CON, P1_CON)):
            self.assertAlmostEqual(forward(A, P1, PI, SEQ, scaled=False), brute(A, P1, PI, SEQ), places=14)
            self.assertAlmostEqual(math.exp(forward(A, P1, PI, SEQ)), brute(A, P1, PI, SEQ), places=14)

    def test_viterbi_is_best_path(self):
        path, logp = viterbi(A_INT, P1_INT, PI, SEQ)
        best = -math.inf
        for pth in itertools.product(range(4), repeat=len(SEQ)):
            p = PI[pth[0]] * emit(P1_INT, pth[0], SEQ[0])
            for t in range(1, len(SEQ)):
                p *= A_INT[pth[t - 1]][pth[t]] * emit(P1_INT, pth[t], SEQ[t])
            best = max(best, p)
        self.assertAlmostEqual(math.exp(logp), best, places=14)
        self.assertLessEqual(math.exp(logp), brute(A_INT, P1_INT, PI, SEQ))

    def test_scaled_forward_survives_long_sequences(self):
        long_seq = SEQ * 400                      # 2000 steps: unscaled product underflows to 0
        self.assertEqual(forward(A_INT, P1_INT, PI, long_seq, scaled=False), 0.0)
        self.assertTrue(math.isfinite(forward(A_INT, P1_INT, PI, long_seq)))

    def test_baum_welch_monotone(self):
        seqs = [SEQ, SEQ[::-1], SEQ + SEQ]
        A, P, pi = [r[:] for r in A_INT], [r[:] for r in P1_INT], PI[:]
        prev = -math.inf
        for _ in range(15):
            A, P, pi, ll = baum_welch_step(A, P, pi, seqs)
            self.assertGreaterEqual(ll, prev - 1e-9)
            prev = ll

    def test_zero_transition_is_structural_without_smoothing(self):
        # A_CON has zeros (e.g. S0->S3). Unsmoothed EM can never re-estimate them above zero.
        zeros = [(i, j) for i in range(4) for j in range(4) if A_CON[i][j] == 0]
        self.assertGreater(len(zeros), 0)
        A2, _, _, _ = baum_welch_step(A_CON, P1_CON, PI, [SEQ], smooth=0.0)
        for i, j in zeros:
            self.assertEqual(A2[i][j], 0.0)

    def test_claims_in_spec_text(self):
        # Spec says integrative thinkers "cycle back to earlier stages"; conventional "sequential, linear".
        back = lambda A: sum(A[i][j] for i in range(4) for j in range(i))
        self.assertAlmostEqual(back(A_INT), 0.2 + 0.1 + 0.2 + 0.3 + 0.2 + 0.2, places=12)   # 1.2 total backward mass
        self.assertAlmostEqual(back(A_CON), 0.1 + 0.1 + 0.2, places=12)                     # 0.4, not zero
        self.assertGreater(back(A_CON), 0.0)   # conventional is not strictly forward-only

    def test_stationary_distributions_are_reported(self):
        def stat(A):
            p = [0.25] * 4
            for _ in range(5000):
                p = [sum(p[i] * A[i][j] for i in range(4)) for j in range(4)]
            return p
        si, sc = stat(A_INT), stat(A_CON)
        self.assertAlmostEqual(sum(si), 1.0, places=9)
        print("\nstationary integrative:", [round(x, 3) for x in si], " conventional:", [round(x, 3) for x in sc])
        self.assertGreater(sc[3], 0.5)    # conventional chain concentrates in S3


if __name__ == "__main__":
    unittest.main(verbosity=2)
