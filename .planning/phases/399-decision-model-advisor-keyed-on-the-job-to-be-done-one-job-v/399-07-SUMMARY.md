---
phase: 399-decision-model-advisor-keyed-on-the-job-to-be-done-one-job-v
plan: 07
subsystem: decision-advisor-selector
tags: [selector, advisor-key, tie-abstention, band-words, no-raw-number, kill-switch, suggest-next]
requires: [399-01, 399-06]
provides:
  - lib/core/decision-advisor/present.cjs (publicShortlist, shortlistSentence, hasRawNumber, isTopTie, topGroup)
  - composeNextMove advisor key and pool source; result.advisor; SELECTOR_ORDER 399-07; selectorMark advisor suffix
  - next_move.advisor in suggest_next (omitted when absent)
  - shortlist.cjs top_tie count (additive)
  - tests/test-399-selector-advisor.cjs (PR1-PR6, N0-N10b, G1-G5)
affects: [399-08, 399-09, 399-10]
tech-stack:
  added: []
  patterns: [one sort key in the single selector, abstain-on-tie, band words only across the trust boundary, kill switch beats test seam]
key-files:
  created:
    - lib/core/decision-advisor/present.cjs
    - tests/test-399-selector-advisor.cjs
  modified:
    - lib/core/decision-advisor/shortlist.cjs
    - lib/core/feyminto/next-move.cjs
    - lib/mcp/tools/sensors.cjs
    - evals/selection/score.cjs
    - tests/test-395-truth-and-cost.cjs
    - tests/test-395-truth-fixes.cjs
    - tests/test-395-job-statements.cjs
    - tests/test-36925-brief.cjs
    - tests/run-all-399.sh
decisions:
  - "Orchestrator guard applied. The advisor value of a command is the calibrated number of a STRONG option in the shortlist, else 0. The sort key (after servesJob and jobFit, before the source count) puts a command ahead of another only when that value is strictly greater, so equal values keep the order the other keys give. The order inside a tie is never used."
  - "A tie at the top of the table row (two or more eligible entries with the same top value) makes the advisor abstain: no sort key, no pool addition, no advisor source label. The selector output (primary, alternatives, why, outcomes_differ, state, job, job_offers, provenance) is then byte-identical to advisor-off. result.advisor reports state no_strong_pick and lists the tied group as an unordered set (no rank key, more_tied count), never as a rank."
  - "The tie is counted over the WHOLE row, not only the 3 listed options. shortlist.cjs gains an additive top_tie field (1 means a unique top). Without it, 3 of 5 tied options would look like a chosen group."
  - "Only options listed in the shortlist (at most 3, strong band) act. A strong entry deeper in the row does not, so what the host sees is what acts. The plan text named scoreFor for this; the shortlist options carry the same numbers and make the test seam (advisorShortlist) complete."
  - "The kill switch MINDRIAN_DECISION_ADVISOR=off wins over the test seam. With it, no advisor code path runs; the result has no advisor key. selectorMark ends with 'advisor table off' in that case, 'advisor table <version>' with a table, 'advisor table none' without one."
  - "No number crosses present.cjs: only band words, rank integers, counts and the no_strong_pick state. hasRawNumber rejects decimals, percents and number-valued keys named calibrated, p, probability, confidence or score."
  - "definition_level comes from problem-axes readRoomAxes in nextMoveForSection (try/catch, null on failure); lastCommand is null on this path. With the shipped v0 job-only table every lookup falls to the job|*|* row, so definition-level conditioning is built and tested with a fixture table (N8) but is not live with shipped data."
metrics:
  tasks: 3
  completed: 2026-11-24
---

# Phase 399 Plan 07: Advisor as one key in the single selector, shortlist to the host Summary

The calibrated shortlist now feeds composeNextMove as one sort key and one pool source, abstains on any tie at the top of a table row, and reaches the host model through suggest_next as band words with an explicit no-strong-pick state and no number.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 | Navigator-safe presentation of the shortlist (PR1-PR6) | 71f91ce08 |
| 2 | The advisor as one key inside composeNextMove, plus job-direct reach (N0-N9, G1-G5) | 365f7f8f2 |
| 3 | suggest_next carries the shortlist (N10, N10b); selection measure | be3f1a899 |

## What was built

- present.cjs: publicShortlist returns `{ state, job, options, no_strong_pick, summary, basis }`. Options are `{ command, band, rank }` in shortlist order. A top tie returns state no_strong_pick, `unordered: true`, options without rank, and `more_tied`. Sentences follow the plan wording for ok, no_strong_pick, no_row, no_table. Off and no_job return null.
- next-move.cjs: the advisor key sits after `servesJob` and `jobFit`, before the source count. A strong pick that serves the job in the registry enters the pool with the label "the decision advisor". A new why branch reads "Theo ranked A first, but the decision advisor has a strong pick for the job". The result gets `advisor` only with a job and an advisor result; the key is absent, not null, otherwise. `toTierCandidates`, MAX_ALTERNATIVES, the attempted-drop rule and the runnable-primary rule are unchanged.
- sensors.cjs: `next_move.advisor` through the existing jobFields helper, so both the no-primary and the primary branch carry it. No write, no Brain call.
- evals/selection/score.cjs: `rebuildPool` knows the advisor source (the 395 measure test says to add every new pool source there). Same public functions as the selector.

## Guard evidence

- G1: a fixture with a 3-way tie at the top (1, 1, 1): over 3 input shapes the selector output without the `advisor` field is byte-identical to advisor-off, and the text "the decision advisor" appears nowhere in the output.
- G3: a unique top above a tied pair (1, 0.9, 0.9): the top is promoted; the tied pair keeps the contract order, not alphabetical order and not rank.
- Random equivalence (scratch script, not committed): 600 random inputs with the old next-move.cjs from the base commit against the new one. Advisor off: 600 compared, 0 differences. Advisor on, no job or abstention: 363 compared, 0 differences.
- G5 and N6 and N10: no decimal or percent in `result.advisor`, in the sentence, or in any `why`.

## Measure: selection eval, before and after (internal, not for public quoting; Deferred, no bar applies)

Run with `node evals/selection/score.cjs`; before = next-move.cjs at 71f91ce08 in this tree, after = be3f1a899.

| Measure | Before | After |
|---|---|---|
| B1 primary right | 12 of 33 (36.4 percent) | 10 of 33 (30.3 percent) |
| B2 primary wrong | 10 of 38 | 9 of 38 |
| B3 right or acceptable | 22 of 33 (66.7 percent) | 22 of 33 (66.7 percent) |
| B4 none-of-these with a named primary outside acceptable | 5 of 5 | 5 of 5 |
| pool limit / order limit | 11 / 10 | 11 / 12 |

B1 to B4 failed before and still fail; no answer key was edited. The v0 calibration is circular (see 399-06), so a drop in B1 is not evidence against the advisor and a rise would not be evidence for it. Plan 10 must measure on independent data.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pinned selector tests fail once the real v0 table acts**
- **Found during:** Task 2 verification
- **Issue:** with the shipped table, find-problem has a unique top (causal, 1) and understand-market has one (intel-pipeline, 1). The advisor therefore changes the pinned primary in test-395-truth-fixes T4 (analyze-timing became intel-pipeline), test-395-job-statements F1 (root-cause became causal) and test-36925-brief NM1, NM2, NM5 (stub command Y became causal, because the stub capability treats any name as a known command). This is the intended D-01 reach, but those legs pin the 395 and 369.25 selector order.
- **Fix:** each test pins its selector with `MINDRIAN_DECISION_ADVISOR=off` (T4 only for its own body; the other two for the file). No expected value was changed. test-395-truth-and-cost line 298 was re-pinned to the new mark format as the plan says.
- **Files modified:** tests/test-395-truth-fixes.cjs, tests/test-395-job-statements.cjs, tests/test-36925-brief.cjs
- **Commit:** 365f7f8f2, be3f1a899

**2. [Rule 3 - Blocking] The eval scorer rebuilds the selector pool**
- **Found during:** Task 2 verification (test-395-measure C2 named the missing source)
- **Fix:** rebuildPool in evals/selection/score.cjs adds the same strong, job-serving, non-tie advisor picks.
- **Commit:** 365f7f8f2

**3. [Rule 2 - Critical, guard] shortlist.cjs top_tie**
- Additive field so a tie is counted over the whole row (see Decisions). Existing tests test-399-table and test-399-advisor-fence pass unchanged.
- **Commit:** 71f91ce08

### Plan text not followed

- The plan uses `scoreFor` for the per-candidate level and bands 2/1/0. The guard replaced it: the key is the calibrated value of a listed strong option, compared strictly. The plan test N2, N3, N5 intents hold.
- Plan acceptance "run-all-395.sh exits 0" cannot hold: it stops at the first failure, and test-395-job-shown fails at base (see Baseline). Each 395 test was run on its own instead.
- TDD: legs for Task 1 were written with the module; for Task 2 the code was written first and the legs after, then run. RED was not shown separately and is not claimed.

## Baseline and verification

Base (before any Task 2 edit) failing legs, all pre-existing and unchanged after:
- test-395-job-shown: B2, D2, E1-E5 (7 legs; the goal job is not honored in this tree, same legs before and after).
- test-395-job-orders: C3 (known).
- test-36925-next-move: X5.
- run-all-36925: 3 FAILED (next-move 369.25-21, vi3-icm-walk, triple-context-formatter), same 3 after. run-all-3696: PASSED=128 FAILED=6 KNOWN=17, same after.

After:
- `node tests/test-399-selector-advisor.cjs`: 23 passed, 0 failed (also with MINDRIAN_DECISION_ADVISOR=off in the shell).
- `bash tests/run-all-399.sh`: exit 0, 11 `>>> 399:` PASSED lines.
- Every other 395 test exits as at base (job-shown 1, job-orders 1, others 0), including offer-is-primary, truth-and-cost, truth-fixes, job-statements, measure.
- test-3696-one-next-move: exit 0 as at base. test-399-advisor-fence and test-399-table: pass.
- The first full run of run-all-36925 after the change showed a brief (369.25-18) failure; it was the 5 NM legs above and passes after the fix (19 passed).
- Dash guard: 0 em or en dashes in every file this plan touched.
- No SQL table, index or column was added; the schema guard needed no entry.

## Risks and open items

- With the shipped v0 table the advisor now changes real primaries where a row has a unique strong top (for example find-problem to causal, understand-market to intel-pipeline, file-meeting, audit-room). The values come from a circular calibration. The owner may prefer to ship with MINDRIAN_DECISION_ADVISOR off until plan 10 measures on independent data.
- Definition-level routing is not live: the shipped table has job-level rows only.
- Pre-existing failures listed above were not touched.
- providers/gemini.cjs was not touched.

## Known Stubs

None.

## Self-Check: PASSED

- Files found: lib/core/decision-advisor/present.cjs, tests/test-399-selector-advisor.cjs, and the modified files listed above.
- Commits found: 71f91ce08, 365f7f8f2, be3f1a899.
