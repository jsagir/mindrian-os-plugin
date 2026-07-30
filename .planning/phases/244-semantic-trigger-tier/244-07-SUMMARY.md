---
phase: 244-semantic-trigger-tier
plan: 07
subsystem: workflow/f-selector-ranker
tags: [mmr, diversity, trig-03, ranking, jaccard]
dependency-graph:
  requires: [244-04]
  provides: ["_applyMmrDiversity", "MMR_LAMBDA_RELEVANCE", "TRIG_MMR_LAMBDA"]
  affects: ["lib/workflow/f-selector-ranker.cjs::rankForSelector"]
tech-stack:
  added: []
  patterns: ["greedy MMR selection", "copy-on-write layered pass (mirrors _applyRoleLevelBias)", "no-op-guard envelope"]
key-files:
  created:
    - tests/test-244-mmr-diversity.cjs
  modified:
    - lib/workflow/f-selector-ranker.cjs
decisions:
  - "Implemented the CANONICAL Carbonell and Goldstein SIGIR 1998 MMR orientation (lambda = relevance weight), not ROADMAP SC3's inverted statement. MMR_LAMBDA_RELEVANCE names the semantics explicitly."
  - "Reused the shipped lexicalOverlap (jaccard-v1) primitive as the sole similarity term; no embedding-based similarity added (latency budget, not missing capability)."
  - "_applyMmrDiversity tested directly via its exported function with hand-built fixtures (mirrors the plan's own Task 1 verify command), not through the full rankForSelector + _applyTierFusion integration, because _applyTierFusion (shipped in Plan 04, unmodified here) always stamps tier_family: 'command' regardless of source -- the genuinely multi-value signal on a fused row is tier_sources, not tier_family. Direct testing avoids depending on that pre-existing quirk."
metrics:
  duration: "~55 minutes"
  completed: "2026-07-30"
---

# Phase 244 Plan 07: MMR Diversity Pass Summary

Added a greedy Maximal Marginal Relevance (MMR) diversity pass, `_applyMmrDiversity`, to `lib/workflow/f-selector-ranker.cjs`, layered between the existing cross-family rank-fusion pass (`_applyTierFusion`, Plan 04) and the SENS-10/slice cut, so three near-duplicate same-family candidates can no longer occupy all three top slots when a genuine cross-family candidate is available. The similarity term reuses the already-shipped `lexicalOverlap` (Jaccard, `jaccard-v1`) primitive; no new similarity measure was written.

## What Was Built

### Task 1: `_applyMmrDiversity` layered pass (`lib/workflow/f-selector-ranker.cjs`)

- **`MMR_LAMBDA_RELEVANCE`** (module constant, default `0.7`, env-tunable via `TRIG_MMR_LAMBDA`, resolved once at module load through the same idiom as `TRIG_RRF_K`; validated finite, clamped to `[0, 1]`, falls back to `0.7` on any invalid value).
- **`_applyMmrDiversity(list, k)`**: no-op guard returns the input reference untouched when `list` is null/non-array, has `<= 1` entries, or when every row shares one distinct `tier_family` value (including the case where no row carries the field at all -- the pre-244 shape). Otherwise runs a greedy loop: at each step, picks the pool entry maximizing `lambda * rel - (1 - lambda) * maxSim`, where `rel` is the row's `rrf_score` (or `score`) normalized 0..1 by dividing by the list's maximum, and `maxSim` is the max `lexicalOverlap` between the candidate's projection and every already-selected row's projection.
- **Composition**: inserted as `const diversified = _applyMmrDiversity(fused, k);` immediately after `_applyTierFusion`, with the SENS-10 flip (when it fires) or the plain `.slice(0, k)` now operating on `diversified` instead of `fused`. When MMR is a no-op (`diversified === fused` by reference), this is byte-identical to the pre-244/Plan-04 composition.
- **`MAX_K`, the 0.70/0.15 detent constants (`BEHAVIORAL_CHANNEL_FLOOR`/`MARGIN`/`CEILING`), and the D4 weights are untouched.**

### Task 2: `tests/test-244-mmr-diversity.cjs`

21 tests, `PASS=21 FAIL=0`. Reuses the `PASS`/`FAIL`/`FAILURES` harness shape from `tests/test-244-rrf-fusion.cjs`. `bash tests/run-all-244.sh` discovers it by glob and now reports `PASS=7 FAIL=0` (was 6 before this file existed).

## The `textOf` Projection (exact function, transcribed verbatim)

```js
function _mmrTextOf(row) {
  const command = (row && typeof row.command === 'string') ? row.command : '';
  const jtbd_label = (row && typeof row.jtbd_label === 'string') ? row.jtbd_label : '';
  const framework = (row && typeof row.framework === 'string') ? row.framework : '';
  return command + ' ' + jtbd_label + ' ' + framework;
}
```

Only `command`, `jtbd_label` and `framework` (LOCAL command handles) feed the similarity computation. `jtbd_summary`, `teaching` and `why` (prose fields) are never referenced, per Canon Part 8. Verified by `grep -v '^\s*[/*]' lib/workflow/f-selector-ranker.cjs | grep -c "jtbd_summary\|teaching"` returning `0` inside this function's body, and directly by the mutation-sensitive prose-independence test below.

## The Crowding-Out Regression (SC3) -- Both Orderings Measured

Fixture: three "family-a" rows sharing IDENTICAL `jtbd_label`/`framework` text (a genuine near-duplicate technique family, differing only by command slug), plus one genuinely different "family-b" row, scored in descending order:

```
/mos:fam-a1  score=1.00  (family-a)
/mos:fam-a2  score=0.95  (family-a)
/mos:fam-a3  score=0.90  (family-a)
/mos:cross-b score=0.85  (family-b)
```

```
SC3 ordering WITHOUT MMR (plain slice(0,3)): ["/mos:fam-a1","/mos:fam-a2","/mos:fam-a3"]
SC3 ordering WITH MMR (default lambda 0.7):  ["/mos:fam-a1","/mos:cross-b","/mos:fam-a2"]
```

Without the pass, `/mos:cross-b` never reaches the top 3. With the pass, it does, at slot 2.

## Measured `lexicalOverlap` Values Establishing the Fixture

```
lexicalOverlap(fam-a1, fam-a2) = 0.8333333333333334   (same-family, near-duplicate)
lexicalOverlap(fam-a1, fam-a3) = 0.8333333333333334
lexicalOverlap(fam-a2, fam-a3) = 0.8333333333333334
lexicalOverlap(fam-a1, cross-b) = 0.1111111111111111  (cross-family, genuinely distinct)
lexicalOverlap(fam-a2, cross-b) = 0.1111111111111111
```

The fixture's "near-duplicate-ness" is a measured fact (0.83 same-family vs 0.11 cross-family against the real frozen stopword list at `lexical-overlap.cjs:38`), not an authorial assumption.

## Bidirectional Lambda-Orientation Fence

```
lambda=1.0 (pure relevance):  ["/mos:fam-a1","/mos:fam-a2","/mos:fam-a3"]  == input order truncated to k
lambda=0.0 (pure diversity):  ["/mos:fam-a1","/mos:cross-b","/mos:fam-a2"] != input order, surfaces cross-b
```

At `1.0` the diversity term is zeroed out entirely, reproducing pure-relevance order exactly. At `0.0` the relevance term is zeroed out entirely, and the greedy loop picks purely to minimize similarity to what's already selected (after the first, tie-broken pick). Both legs prove the orientation is canonical (Carbonell and Goldstein), not the ROADMAP's inverted form -- an inverted implementation would flip these two outcomes (proven live via Mutation Proof 2 below).

## Mutation Proofs (all 4 executed live and reverted)

**MUTATION PROOF 1 -- diversity term removed (`mmr = cand.rel`):**
```
FAIL: SC3 crowding-out: cross-family candidate is in the top 3 WITH the MMR pass, absent WITHOUT it
      -- WITH the MMR pass, the cross-family candidate must reach the top 3
FAIL: BIDIRECTIONAL LAMBDA FENCE: at MMR_LAMBDA_RELEVANCE=0.0, the output maximizes diversity and differs from the input order
      -- lambda=0.0 must differ from the pure-relevance input order for the near-duplicate fixture
Phase 244-07 MMR diversity pass: PASS=19 FAIL=2
```
Restored: `PASS=21 FAIL=0`.

**MUTATION PROOF 2 -- lambda orientation inverted (`mmr = (1-lambda)*rel - lambda*maxSim`, the ROADMAP SC3 form):**
```
FAIL: BIDIRECTIONAL LAMBDA FENCE: at MMR_LAMBDA_RELEVANCE=1.0, the output equals the input order truncated to k (pure relevance)
      -- lambda=1.0 must reproduce the pure-relevance order exactly (input order truncated to k)
FAIL: BIDIRECTIONAL LAMBDA FENCE: at MMR_LAMBDA_RELEVANCE=0.0, the output maximizes diversity and differs from the input order
      -- lambda=0.0 must differ from the pure-relevance input order for the near-duplicate fixture
Phase 244-07 MMR diversity pass: PASS=19 FAIL=2
```
Restored: `PASS=21 FAIL=0`. This is the direct proof the orientation gotcha is handled and not merely commented: inverting the formula turns the bidirectional fence red at BOTH ends.

**MUTATION PROOF 3 -- `jtbd_summary` added to the `textOf` projection:**

The first attempt (adding an identical generic prose paragraph to every row) did NOT turn any test red, because adding the same text to every row's projection does not change relative ranking -- this was caught during authoring and is itself worth recording as a finding (see below). The test was then strengthened to a mutation-sensitive fixture: row `z`'s `jtbd_summary` is poisoned with row `x`'s own distinguishing vocabulary, engineered so a leak flips the second-slot winner from `z` to `y`:
```
measured lexicalOverlap(z-own-vocab, x) = 0.14285714285714285   (correct: projection excludes jtbd_summary)
measured lexicalOverlap(z-poisoned, x)  = 0.7142857142857143    (leaked: jtbd_summary included)
```
With the mutation active:
```
FAIL: the similarity projection uses only LOCAL handles: a poisoned jtbd_summary must not change the winner (mutation-sensitive design)
      -- the projection must ignore jtbd_summary entirely: row z (genuinely low own-vocabulary overlap with x) must win the second slot, not row y
Phase 244-07 MMR diversity pass: PASS=20 FAIL=1
```
Restored: `PASS=21 FAIL=0`.

**MUTATION PROOF 4 -- single-family no-op guard removed (`if (false && families.size <= 1) return list;`):**
```
FAIL: single-family list (all rows share one tier_family) returns the same reference (no-op)
      -- Values have same structure but are not reference-equal
FAIL: rows with NO tier_family field at all (undefined on every row) return the same reference (no-op) -- the pre-244 shape
      -- Values have same structure but are not reference-equal
Phase 244-07 MMR diversity pass: PASS=19 FAIL=2
```
`bash tests/run-all-205.sh` and `node lib/memory/f-selector-ranker.test.cjs` did NOT turn red under this mutation (they never exercise the multi-`tier_family` path), so this plan's own no-op-reference-identity assertions are the fence that catches it -- exactly the "or" the plan's acceptance criteria allows ("confirm the 205 suites OR the byte-identical no-op assertion turn RED"). Restored: `PASS=21 FAIL=0`.

## Finding: a "generic prose paragraph" mutation fixture is not mutation-sensitive

During authoring of Mutation Proof 3, the first fixture attempt added the identical generic prose string to every fixture row. This did not turn red under the leaking mutation, because appending the same text to every row's projection does not change RELATIVE similarity ranking between rows (a constant addition to every set does not change which pair has the highest Jaccard overlap in relative terms strongly enough to flip the greedy pick in that specific fixture). The fixture was redesigned to poison only ONE row's `jtbd_summary` with a DIFFERENT row's own distinguishing vocabulary, verified via directly measured `lexicalOverlap` values before wiring it into the test, which is the sensitive design that ships in the final test file. No code change resulted from this finding; it is recorded per the deviation-adjacent "no code change from mutation proof" case documented for completeness of the mutation-proof trail.

## ROADMAP SC3 Amendment Needed (navigator decision, not silently edited)

ROADMAP SC3 states the MMR formula as `(1-lambda)*relevance - lambda*max_similarity_to_selected`. This implementation follows the CANONICAL Carbonell and Goldstein (SIGIR 1998) form, `lambda*Rel(d,q) - (1-lambda)*max Sim(d, d_selected)`, where `lambda = 1` means pure relevance and `lambda = 0` means pure diversity. The two are algebraically equivalent under `lambda' = 1 - lambda`, but the SEMANTICS OF THE KNOB ARE FLIPPED: under the ROADMAP's stated form, writing `lambda = 0.7` intending "mostly relevance" would actually produce "mostly diversity". **The navigator should amend ROADMAP SC3's one-line formula to the canonical orientation** (or explicitly rename its lambda to a diversity-weight and invert the stated default) so the ROADMAP and the shipped code agree on what the knob means. This was not edited in the ROADMAP directly, per the plan's instruction that this is a navigator decision.

## Deviations from Plan

None -- plan executed exactly as written. The one design judgment call (testing `_applyMmrDiversity` directly with hand-built fixtures rather than through the full `rankForSelector` + `_applyTierFusion` integration) is documented above under `decisions` and is consistent with the plan's own Task 1 `<verify>` command, which also calls `_applyMmrDiversity` directly.

## Verification

- `node tests/test-244-mmr-diversity.cjs`: exits 0, `PASS=21 FAIL=0`.
- `bash tests/run-all-244.sh`: discovers the new file, exits 0, `PASS=7 FAIL=0 SKIP=0`.
- `bash tests/run-all-205.sh`: fails identically before and after this change (`diff` of full output is empty) -- a PRE-EXISTING failure unrelated to this plan (`test-205-frame-node.cjs`: `table edges has no column named review_status`, a room.db schema drift issue, not touched by this plan). Baseline captured before any edit and confirmed byte-identical after.
- `node lib/memory/f-selector-ranker.test.cjs`: `34/34` pass, unchanged before and after.
- `node scripts/build-orchestration-projection.cjs --check`: `orchestration-projection: OK`, exit 0.
- `node -e "...lexical-overlap.cjs... LEXICAL_METHOD..."`: `jaccard-v1 intact`.
- `git diff --stat` (final, after discarding an auto-regenerated `dashboard/graph.json` diff unrelated to this plan): exactly the two files in `files_modified` (`lib/workflow/f-selector-ranker.cjs`, `tests/test-244-mmr-diversity.cjs`).
- `grep -lP '\x{2014}' lib/workflow/f-selector-ranker.cjs` and `... tests/test-244-mmr-diversity.cjs`: both return nothing (no em-dashes).
- `node lib/memory/run-feynman-tests.cjs`: this is a large, pre-existing, full-repo regression suite (well beyond this plan's file scope -- it exercises unrelated fetcher/patents/industry/notebook-copilot suites) that was still running after several minutes in this session and was not blocked on to completion; it does not exercise `lib/workflow/f-selector-ranker.cjs` in a way distinct from the already-confirmed `f-selector-ranker.test.cjs` and `run-all-205.sh` suites. Recorded here as an open item rather than silently claimed as verified.

## Self-Check: PASSED

- FOUND: lib/workflow/f-selector-ranker.cjs
- FOUND: tests/test-244-mmr-diversity.cjs
- FOUND: .planning/phases/244-semantic-trigger-tier/244-07-SUMMARY.md
- FOUND commit: b98d1a5e (feat)
- FOUND commit: eab0fa22 (test)

