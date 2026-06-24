---
phase: 177-larry-behavioral-channel
plan: 04
subsystem: insight-sensors
tags: [bch-s5, bch-s4a, turn-stage, saturation, dispatchSensors, deterministic-gate]
requires:
  - "177-01 (BCH-S1) runtime turn_count term in computeInvestmentLevel"
provides:
  - "isReachEligibleForTurn(reach_id, turn_count) turn-stage eligibility gate"
  - "isSaturated({turn_count, node_delta}) saturation predicate"
  - "'saturation' derived signal on the dispatch COPY"
affects:
  - "lib/core/insight-sensors.cjs dispatchSensors filtering + normalizeTurn enrichment"
tech-stack:
  added: []
  patterns:
    - "pure deterministic engine math inside the existing dispatchSensors chokepoint"
    - "additive-merge signal lane on the normalizeTurn COPY (no caller mutation)"
    - "defensive scalar reads (absent/non-number/negative -> no-op or false)"
key-files:
  created:
    - tests/test-bch-s5-turn-stage-eligibility.cjs
    - tests/test-bch-s4a-saturation.cjs
  modified:
    - lib/core/insight-sensors.cjs
    - tests/run-all-177.sh
decisions:
  - "Transition band: turn_count < 3 suppresses the two deep reaches; >= 3 unlocks (turns 3-4 eligible, turn 5 named unlock comfortably inside)."
  - "Saturation is a SIGNAL only (no reach, no dial, no model cue); BCH-S4b cue wiring deferred to Wave 4."
metrics:
  duration: "~25m"
  completed: 2026-06-24
---

# Phase 177 Plan 04: Turn-Stage Deterministic Seams Summary

Two deterministic engine-math seams over the runtime turn_count (BCH-S1 / 177-01), both inside the existing dispatchSensors chokepoint, no new hook: BCH-S5 turn-stage reach-eligibility (suppress brain_consult / deep_research in turns 1-2, unlock at turn 5) and BCH-S4a saturation by turn-count + node-delta ("turn 8+, no new nodes").

## What shipped

- **BCH-S5 `isReachEligibleForTurn(reach_id, turn_count)`** (insight-sensors.cjs): returns false for `brain_consult` and `deep_research` when `turn_count < 3` (turns 1-2), true at `turn_count >= 3` (so turn 5 is comfortably unlocked). All other reaches (context_block, contradiction, cross_room, hats) are always eligible. Absent / non-number turn_count is a no-op (eligible). Wired into `dispatchSensors`: a turn-stage-ineligible reach is filtered out of the result with `continue`; `trace.routing_source` is never touched (Phase 144 fence). turn_count is read off the normalized turn / ctx via `turnCountOf`.
- **BCH-S4a `isSaturated({turn_count, node_delta})`** (insight-sensors.cjs): true when `turn_count >= 8 AND node_delta === 0`; defensive (absent / non-number / negative -> false, never throws); opens no db read (node_delta is a passed-in scalar). Surfaced as a `'saturation'` signal kind on the `normalizeTurn` COPY via the additive-merge lane; the caller's turn object gains zero keys. Signal only: fires no reach, composes no dial, emits no model cue.

## Tests

- `tests/test-bch-s5-turn-stage-eligibility.cjs` -- 19 asserts (suppression turns 1-2, unlock turn 5, transition-band boundary at 3-4, other reaches always eligible, absent/non-number no-op, dispatchSensors filters early-turn deep reach without touching routing_source). GREEN.
- `tests/test-bch-s4a-saturation.cjs` -- 16 asserts (8+/0 saturates, new nodes do not, before-8 does not, defensive inputs, dispatch enriches the COPY with a saturation signal while the caller turn is unmutated, saturation fires no reach). GREEN.
- Both registered in `tests/run-all-177.sh` (additive).

## Verification

- `node tests/test-bch-s5-turn-stage-eligibility.cjs` exits 0 (19/19).
- `node tests/test-bch-s4a-saturation.cjs` exits 0 (16/16).
- Saturation-math probe: `isSaturated({turn_count:8,node_delta:0})===true`, `{8,3}===false`, `{}===false` -> "OK BCH-S4a saturation math".
- `bash tests/run-all-177.sh`: **7 pass / 7 fail (after 177-03) -> 9 pass / 7 fail**. The two new BCH-S suites are GREEN; the 7 remaining failures are the scaffold-stub BCH suites for later waves (bch-01/04/07/08/09/12/15/16/17/18 minus the green ones), unchanged by this plan.

## Regressions held (all GREEN)

test-sensor-spine-dispatch, test-sensors-routing-fence, test-sensors-part8-sweep, test-150-5-sensor-firability, test-150-5-render-atomicity, test-decide-sensor-fire, test-diffusion-adoption-sensor, test-show-share-sensor, test-navigation-acceptance (zero-fs invariant), and the frozen-set drift fences test-reach-ids-drift (6) + test-posture-ids-drift (3).

## Deviations from Plan

None - plan executed exactly as written. The two new suites were registered in run-all-177.sh (additive; not in files_modified but required by the execution rules to make the phase gate reflect the new green suites; the frozen-set fences and existing scaffold stubs are untouched).

## Canon / boundary notes

- Frozen sets untouched: no 7th reach minted, no 4th posture. The gate suppresses two existing REACH_IDS members in early turns (eligibility-gating, not removal).
- Part 8: turn_count + node_delta stay LOCAL. No Brain wire. No db read in the saturation predicate (scalar passed in). No model cue.
- No new hook: both seams ride the existing UserPromptSubmit dispatchSensors chokepoint.

## Self-Check: PASSED

- lib/core/insight-sensors.cjs FOUND (modified; isReachEligibleForTurn + isSaturated exported)
- tests/test-bch-s5-turn-stage-eligibility.cjs FOUND
- tests/test-bch-s4a-saturation.cjs FOUND
- commit c79640b3 (Task 1) FOUND
- commit 8e0ed6de (Task 2) FOUND
