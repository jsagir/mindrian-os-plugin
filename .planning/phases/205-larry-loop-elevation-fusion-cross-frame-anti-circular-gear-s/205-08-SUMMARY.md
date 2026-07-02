---
phase: 205-larry-loop-elevation
plan: 08
subsystem: api
tags: [grill, red-team, part8-egress, bias-consult, brain_consult, deep_research, frozen-six, anti-circular]

# Dependency graph
requires:
  - phase: 205-03
    provides: "SENS-10 circularity sensor - the assertion_unvalidated cause whose exit gear is GRILL"
  - phase: 196-03
    provides: "part8-egress-guard classify() - the shipped Part-8 default-deny egress fence GRILL reuses"
  - phase: 143-01
    provides: "sensor-types makeReach + the frozen REACH_IDS six (brain_consult, deep_research)"
provides:
  - "lib/core/grill-engine.cjs: runGrill, armA (live), armB (scaffolded/gated)"
  - "Arm A logical red-team through the frozen brain_consult reach, Part-8 fenced (bias SHAPE egresses, never claim content)"
  - "Arm B external-validation scaffold through the frozen deep_research reach, MCP-stack-ask gated, single BLOCKED-UNTIL-200 seam, clean degradation"
affects: [205-fusion, phase-200-wiring, grill-arm-b-live]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reuse-before-build: the Part-8 fence is the shipped part8-egress-guard classify(), not a reimplemented fence"
    - "Single-seam gating: one named guard constant + one predicate = a one-point flip, not a rewrite"
    - "Clean degradation: a gated arm returns a marked not-available verdict, writes no evidence, fabricates nothing, never throws"

key-files:
  created:
    - lib/core/grill-engine.cjs
    - tests/test-205-grill-engine.cjs
  modified: []

key-decisions:
  - "Option A: Arm A live, Arm B scaffolded with clean degradation (navigator deferred live-200 wiring to a separate gated plan)"
  - "The Arm B 200-gate is a SINGLE legible seam: BLOCKED_UNTIL_200 constant + is200FanVerifyLive(ctx) predicate; every external step keys on the one predicate"
  - "GRILL mints no new reach_id: Arm A routes brain_consult, Arm B routes deep_research; no other reach id appears in the engine"
  - "The claim SHAPE (a closed enum) egresses; the claim prose never crosses the wire (Part 8), proven by a content-absence assertion on the egress payload"

patterns-established:
  - "Two-mandatory-arm engine: runGrill composes Arm A then Arm B; the overall verdict is Arm B's (null until the teeth touch ground post-200)"
  - "MCP-stack-ask gate is the FIRST trace step in the external arm, structurally preceding any primitive (project HARD rule)"

requirements-completed: [SCOPE-3]

# Metrics
duration: ~35min
completed: 2026-07-02
---

# Phase 205 Plan 08: GRILL Engine Summary

**GRILL ships as two mandatory arms on a load-bearing claim: Arm A is a LIVE brain_consult bias red-team (Part-8 fenced, claim content stripped from egress), and Arm B is a deep_research external-validation scaffold that degrades cleanly behind a single one-point BLOCKED-UNTIL-200 seam.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 (both TDD, RED -> GREEN)
- **Files created:** 2

## Accomplishments
- Arm A (LIVE): challenge-assumptions plus the five Beautiful-Questions bias techniques (Consider-the-Opposite, Base-Rate-Check, Red-Team-Steelman, Premortem, Reference-Class-Forecasting) reached as the frozen `brain_consult` reach. The egress is built by `buildArmAEgress`, cleared through the shipped `part8-egress-guard` classifier, and asserted to contain zero claim prose - only bias-technique names, generic methodology vocabulary, and a closed claim-SHAPE enum.
- Arm B (SCAFFOLDED, gated): the external-validation arm routes the frozen `deep_research` reach. The MCP-stack-ask gate resolves FIRST (trace step 0), then a single `is200FanVerifyLive` predicate decides. While gated it returns `status: 'not_available'`, `verdict: null`, `evidence_node: null`, invokes no external primitive, and never throws.
- `runGrill` composes both mandatory arms and reports `reaches_used: ['brain_consult', 'deep_research']` - GRILL mints no new reach_id, keeping the frozen-six invariant (item 7) intact.
- Part-8 fence intact and now actually executing in this worktree (`part8-egress-guard.test.cjs` runs its full PB8-01/03/05/09 assertion set, not the inert SKIP path).

## Task Commits

Each task was committed atomically (TDD):

1. **Task 1+2 RED: failing test for GRILL two-arm engine** - `f1f17c4b` (test)
2. **Task 1+2 GREEN: implement GRILL two-arm engine** - `18475540` (feat)

_Note: both tasks share the single test file and single engine module, so the plan ran as one RED -> GREEN cycle covering both arms._

## Files Created/Modified
- `lib/core/grill-engine.cjs` - the GRILL engine: `runGrill`, `armA`, `armB`, the `buildArmAEgress` / `buildArmBEgress` Part-8 fenced egress builders, `classifyClaimShape`, and the `BLOCKED_UNTIL_200` / `is200FanVerifyLive` seam.
- `tests/test-205-grill-engine.cjs` - 12 checks: exports, Arm A reach + five findings + Part-8 content-strip, Arm B reach + clean degradation + MCP-gate-before-external + Part-8 content-strip, seam legibility, and the frozen-six no-new-reach assertion.

## The Arm B 200-Gating Seam (for the fable reconciliation)

The reconciliation pass reviews exactly this seam. It is a SINGLE, well-named, one-point flip:

- **Guard constant:** `BLOCKED_UNTIL_200 = true` at `lib/core/grill-engine.cjs:210`
- **The single predicate:** `is200FanVerifyLive(ctx)` at `lib/core/grill-engine.cjs:225`, whose one-point flip is `if (BLOCKED_UNTIL_200) return false;` at `lib/core/grill-engine.cjs:226`
- **How Arm B keys on it:** `armB` calls `if (!is200FanVerifyLive(ctx)) { return <degraded verdict>; }` - the sole liveness decision. Below that line sits the guarded `runLiveExternalPass` scaffold (fails closed).

To wire Arm B to live Phase 200: flip `BLOCKED_UNTIL_200` to `false`. The predicate then probes the injected `ctx.runCellFanout` + `ctx.adversarialVerify` handles and returns true only when both are present, and `runLiveExternalPass` gets completed. No other code path decides Arm B liveness - one flip, not a rewrite.

## Verification

- `node tests/test-205-grill-engine.cjs` - PASS (12 checks).
- `node lib/core/part8-egress-guard.test.cjs` - PASS (PB8-01/03/05/09, fully executing).
- `bash tests/run-all-205.sh` - PASS (ALL 205 TESTS PASS); the new engine breaks none of the existing 205 legs.
- Grep: `grill-engine.cjs` reach_id literals are exactly `brain_consult` + `deep_research`; no `context_block` / `contradiction` / `cross_room` / `hats` reference; no em-dashes / en-dashes; no network primitive; requires only `sensor-types` (pure) and `part8-egress-guard` (pure LOCAL).

## Deviations from Plan

**1. [Rule 3 - Blocking issue] Missing worktree node_modules (environment gap, not a package install)**
- **Found during:** first GREEN test run.
- **Issue:** the isolated worktree was created without a `node_modules` directory. `part8-egress-guard.cjs` transitively requires `brain-client.cjs` -> `ajv/dist/2020`, which was absent, so requiring the guard threw `MODULE_NOT_FOUND`. The guard's own test masked this by catching the require and printing an inert SKIP.
- **Root cause:** git worktrees do not copy the (gitignored, per-checkout) `node_modules`; the deps are already vendored in the sibling main checkout.
- **Fix:** symlinked the worktree `node_modules` to the already-vendored `/home/jsagi/dev/MindrianOS-Plugin/node_modules` (read-only reuse of existing deps; installs nothing new; touches nothing tracked in main). This is NOT a package-manager install - no new or substitute package was fetched.
- **Files modified:** none tracked. The symlink is untracked and was never staged (explicit-path staging only).

**2. [Deferred - out of scope] tests/run-all-205.sh leg not added**
- The verification asks the new test be picked up by `tests/run-all-205.sh`. The aggregator is a static enumerated list, so a new leg would require editing and staging `run-all-205.sh` - outside this plan's exclusive-file staging contract (commits contain ONLY grill-engine.cjs, the test, and this SUMMARY). Adding the one-line leg is deferred to the central/orchestrator pass to avoid breaching the isolation invariant. The existing aggregator remains green; the new test passes standalone.

## Self-Check: PASSED
- `lib/core/grill-engine.cjs` - FOUND
- `tests/test-205-grill-engine.cjs` - FOUND
- Commit `f1f17c4b` (RED) - FOUND
- Commit `18475540` (GREEN) - FOUND
