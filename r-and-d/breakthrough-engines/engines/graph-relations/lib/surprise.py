"""Bayesian surprise as a triage number, computed from probabilities the agent collects.
For each proposed relationship the agent asks an ensemble of model personas, closed-book, how likely the
relationship is to hold (prior), then again after reading retrieved evidence (posterior). Surprise is the
KL divergence of the posterior from the prior (bits, Bernoulli). It orders the test list. It is not evidence.
Model ignorance guard: if the closed-book ensemble disagrees a lot, surprise may only mean the models did not
know, so the row is flagged `ignorance_risk`."""
from __future__ import annotations

import math

EPS = 1e-6


def clip(p):
    return min(1 - EPS, max(EPS, float(p)))


def bernoulli_kl(post, prior):
    p, q = clip(post), clip(prior)
    return p * math.log2(p / q) + (1 - p) * math.log2((1 - p) / (1 - q))


def entropy(p):
    p = clip(p)
    return -(p * math.log2(p) + (1 - p) * math.log2(1 - p))


def mean_sd(xs):
    m = sum(xs) / len(xs)
    sd = (sum((x - m) ** 2 for x in xs) / max(1, len(xs) - 1)) ** 0.5 if len(xs) > 1 else 0.0
    return m, sd


def score(prior_list, post_list, ignorance_sd=0.2):
    if not prior_list or not post_list:
        raise ValueError("need at least one prior and one posterior probability")
    pm, psd = mean_sd([clip(x) for x in prior_list])
    qm, qsd = mean_sd([clip(x) for x in post_list])
    return {
        "prior": pm, "prior_sd": psd, "posterior": qm, "posterior_sd": qsd,
        "surprise_bits": bernoulli_kl(qm, pm),
        "shift": qm - pm,
        "test_priority": entropy(qm),  # still uncertain after evidence: worth a real test
        "ignorance_risk": psd >= ignorance_sd,
        "n_models": min(len(prior_list), len(post_list)),
    }


def closed_book_prompt(claim):
    return ("Without looking anything up, give the probability (0 to 1) that this claim holds. "
            "Answer with a single number.\nClaim: " + claim)


def open_book_prompt(claim, evidence):
    return ("Read the evidence, then give the probability (0 to 1) that the claim holds. Use only the "
            "evidence plus common knowledge. Answer with a single number.\nClaim: " + claim +
            "\nEvidence:\n" + "\n".join("- " + e for e in evidence))
