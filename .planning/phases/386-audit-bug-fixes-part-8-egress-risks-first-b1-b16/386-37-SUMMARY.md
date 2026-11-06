---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "37"
subsystem: egress-guard
tags: [part8, shape, sprout, body, e-shape]
requires: ["386-01"]
provides:
  - lib/core/part8-sprout-shape.cjs classifyShape(value) (sprout, edge or body from shape only)
  - measured thresholds and the class of each negative, for plan 386-32
affects: [386-25, 386-27, 386-32, 386-33]
tech-stack:
  added: []
  patterns: [shape test instead of word list; thresholds from measurement]
key-files:
  created:
    - lib/core/part8-sprout-shape.cjs
    - tests/test-386-sprout-body-shape.cjs
    - .planning/debug/part8-no-shape-test-for-sprouts-and-bodies.md
  modified: []
key-decisions:
  - "Thresholds unchanged by measurement: sprout at most 12 words, body at 40 words, 3 sentences, 2 newlines or a quoted span."
requirements-completed: [E-SHAPE]
duration: 40min
completed: 2026-11-06
---

# Phase 386 Plan 37: Sprout, edge and body shape helper Summary

A pure shape helper now exists. It changes no verdict: no guard code calls it.

## Measured values (PROVEN, from the RCA)

- sprout_max_words: 12
- body_min_words: 40
- body_min_sentences: 3
- corpus_body_count: 0 (of 561 questions: 26 positives and 535 extended)
- negatives_sprout_count: 6
- negatives_sprout_ids: X3,X4,X6,X7,X8,X10
- Classes of the 10 negatives: X1 edge, X2 edge, X3 sprout, X4 sprout, X5 edge, X6 sprout, X7 sprout, X8 sprout, X9 edge, X10 sprout.
- Leak probes GAP1 and GAP2 are sprouts by shape. Must-refuse probes: 9 sprout, 1 edge, 0 body.
- The 26 positives reach 12 words at the maximum. The extended maximum is 27 words and 2 sentences.

For plan 386-32: X7 (confidentiality marker) and X10 (my customers and my pricing) are private-context negatives that pass the shape test as sprouts. X3, X4, X6 and X8 are caught by credential, identifier or money rules, not by shape.

## Task Commits

1. Task 1, RCA and measurement: 17ab325a7 (RCA resolution fill: 1a3375db0)
2. Task 2, failing test (RED, SH1 to SH6 all FAIL): e62c99d82
3. Task 3, module (GREEN): f16751402

## Verification

- node tests/test-386-sprout-body-shape.cjs: SH1 to SH6 pass. A 1 MB string classifies in 74 ms.
- bash tests/run-all-196.sh: 7 passed, 0 failed (baseline before my change: 6 passed, 1 failed, the 260917-dgf hook ambiguous disposition arm, a peer plan's in-progress work; it passed on the second run).
- node tests/test-3692-guard-survey-gate.cjs: GATE PASS. MEASURED_SHA256 1b2fc844...dd00 before and after (no verdict change).
- bash tests/run-all-386.sh: all listed tests PASSED, including test-386-sprout-body-shape.cjs.

## Deviations from Plan

None. The pre-commit rule for a worktree-agent branch did not apply: the caller named branch main in this release worktree.

## Known Stubs

None.

## Threat Flags

None. The helper has no caller and no network.

## Self-Check: PASSED
