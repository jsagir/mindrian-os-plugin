---
phase: 158-bounded-rejection-penalty-seed-009-minimal
verified: 2026-06-15T00:00:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
human_verification: []
---

# Phase 158: Bounded rejection-penalty (SEED-009-minimal) Verification Report

**Phase Goal:** A chronically-rejected next-move dial reach is discounted then HARD-suppressed from the returned top-K once its rejection signal crosses a named threshold N, closing the open feedback circuit where REJECTED outcome edges file but no production ranker reads them back. A room with zero rejection edges produces byte-identical ranked output to before the phase.
**Verified:** 2026-06-15
**Status:** passed
**Re-verification:** No - initial verification

## Surface-correction note (load-bearing for verdicts)

The 158-SPEC text names the `_applyDecay` command rail (`f-selector-ranker.cjs`). The 158-CONTEXT block SC-01..SC-07 (navigator-LOCKED 2026-06-15, after plan-check) SUPERSEDES that: the penalty + hard-suppression target the 6-reach DIAL surface (`lib/hmi/dial-reach-orchestrator.cjs` `buildReachList` + the upstream fold in `scripts/intent-classifier.cjs`), NOT `rankForSelector`. Verdicts below are rendered against the corrected (dial) surface, which IS what the user sees, while honoring every SPEC constraint that survives the correction (no 0.40/0.30/0.30 edit, no ranker_weights table, Part 8/9, frozen-148). This is a legitimate in-phase decision recorded in CONTEXT, not drift.

## Goal Achievement

### Observable Truths (the 8 acceptance criteria)

| # | Criterion (RJP) | Status | Evidence |
|---|-----------------|--------|----------|
| 1 | RJP-01 - reject-bearing reach ranks strictly below identical zero-reject reach via reach-surface penalty; 0.40/0.30/0.30 ensemble untouched | VERIFIED | `countPenalty` is the SOLE multiplier `score*(1-cp)` (reach-reject-reader.cjs:269-276). `test-158-reach-discount.cjs` check 5 asserts below-N reach is strictly lower than its zero-reject self. The 0.40/0.30/0.30 literals live ONLY in `f-selector-ranker.cjs:287-290`; git log shows that file last touched by phase 121.5/125, NOT 158. The dial penalty never edits the ensemble. |
| 2 | RJP-02 - zero-reject room byte-identical to pre-phase baseline; existing suites green | VERIFIED | `countPenalty` returns EXACTLY 0 at zero rejects (:271); empty `suppressedReachIds` -> `buildReachList` survivors == full set (orchestrator:265). `test-158-reach-byte-stable.cjs` (3 checks) captures an in-process baseline and proves the full fold path renders byte-identical at zero rejects; load-bearing proof: injecting a real reject makes the render DIFFER. run-all-148.sh 18/18 green inside the gate. |
| 3 | RJP-03 - below N, discounted but PRESENT, discount <= CAP=0.6 | VERIFIED | `countPenalty = min(CAP, n/(N+1))`, CAP=0.6 (:274-275). `test-158-reach-discount.cjs` checks 1-2-5 assert penalty in (0, CAP], bounded at high count, present + strictly lower below N. `test-158-reach-fences.cjs` re-asserts CAP bound at n=99. |
| 4 | RJP-04 - at signal >= N (N=3) reach ABSENT from top-K; at N-1 PRESENT | VERIFIED | `isHardSuppressed` returns `n >= REJECT_SUPPRESS_THRESHOLD(3)` after fences (:299-305); `computeReachPenalties` collects suppressed ids; `buildReachList` DROPS them before sort + frozen gate (orchestrator:265-271). `test-158-reach-hard-suppress.cjs` (3 checks): at >= N the reach is in suppressedReachIds AND absent from buildReachList (total_count 6->5); at N-1 present + discounted. RED/GREEN: forcing the N gate to `return false` turns the suite RED. |
| 5 | RJP-05 - N + cap NAMED constants with low-data rationale; no magic literal gates suppression | VERIFIED | Six NAMED consts with a documented ~4-user/<100-edge rationale block grounded against DECAY_WINDOW=5 + PIVOT_PENALTY_FLOOR=0.2 (reach-reject-reader.cjs:50-110): REJECT_SUPPRESS_THRESHOLD=3, MIN_PRESENTATIONS=2, REJECT_WINDOW=8, PAROLE_PERIOD=5, COUNT_PENALTY_CAP=0.6, COMBINED_SUPPRESS_FLOOR=0.05. The suppression check (:304) uses the named N, not a literal. All exported. |
| 6 | RJP-06 - Part 8: zero reads of rejection reason strings in new code; SECRETREASON123 tripwire holds | VERIFIED | Reader reads `decision`/`edge_semantic`/`reach_id` enums only (`_isRejectRow` :115-118); never `properties.reason`. `test-158-reach-part8-no-reason.cjs` SEEDS `reason:'SECRETREASON123'` in real storage, confirms it IS stored, then asserts it appears in NONE of countPenalty/rejectCountInWindow/computeReachPenalties output AND the count is still correct (reason-blind). run-all-158.sh Part 8 sweep (comment-stripped) PASSED; load-bearing proof appends an executable `props.reason` read and TRIPS the gate. |
| 7 | RJP-07 - Part 9: penalty path reads outcome edges only through navigation.cjs; orchestrator pure (no db) | VERIFIED | Reader's ONLY require is `../core/navigation.cjs`; reads via `findRecentChanges` only (:36, :149, :200, :230). No better-sqlite3, no node:sqlite, no fs read. `test-158-reach-part9-chokepoint.cjs` (3 checks) + `test-158-reach-orchestrator-pure.cjs` (3 checks: orchestrator has zero db/fs/Brain/await tokens, ONLY require is f-selector-ranker.cjs). db is folded UPSTREAM on the live arm (intent-classifier.cjs:1572-1599); `buildReachList` receives only `{tierMode, reachScores, suppressedReachIds}` - db never threaded into the orchestrator (SC-07). |
| 8 | RJP-08 - no ranker_weights table; frozen-148 invariant green | VERIFIED | `grep -rn ranker_weights lib/ scripts/ tests/` returns NOTHING. `test-158-reach-frozen-148-guard.cjs` (8 checks) asserts MAX_K=3, RECOMMEND_FLOOR=0.70, MARGIN_THRESHOLD=0.15, DIAL_REACH_K=6, REACH_IDS length 6 hold AFTER a discount + a drop. run-all-148.sh 18/18 (REACH_IDS=6, DIAL_REACH_K=6, MAX_K=3, 0.70/0.15 gate, 3 postures all green) as a carried passthrough inside run-all-158.sh. |

**Score:** 8/8 truths verified

### The four bias fences (independently confirmed in code, not just claimed)

| Fence | Spec value | Implemented at | Evidence |
|-------|-----------|----------------|----------|
| M - min-presentations floor | M=2 | `isHardSuppressed` :301 `if (pres < MIN_PRESENTATIONS) return false`; `countPenalty` :273 zeroes below M | `test-158-reach-fences.cjs` check 1: pres < M with n >= N -> NOT suppressed |
| W - recency-aging window | W=8 presentation-units | window-floor derivation in `rejectCountInWindow` :196-247 (W-th newest reach_presented createdAt; open-ended below W); single-sourced to REJECT_WINDOW | `test-158-reach-fences.cjs` check 2 (aged-out vs in-window); the REAL db window derivation is exercised against actual stored timestamps in `test-158-reach-reject-only.cjs` via openRoomDb (no injection on the db path) |
| Deterministic parole every P | P=5 | `isHardSuppressed` :302 `if (pres > 0 && pres % PAROLE_PERIOD === 0) return false`; NO Math.random | `test-158-reach-fences.cjs` check 3: parole at P and 2P, repeatable 5x (deterministic). T-158-03-03 greps Math.random absence |
| Per-room scope | room-local | readers read ONLY the passed db / roomState; never cross-room aggregation | `test-158-reach-fences.cjs` check 5: two independent roomStates do not bleed (A suppresses, B does not). Reads only active room.db (Part 8) |

All four fences are genuinely implemented in `lib/workflow/reach-reject-reader.cjs` and each has a dedicated, non-vacuous deterministic assertion.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/workflow/reach-reject-reader.cjs` | readers + penalty + fences + fold + named constants | VERIFIED | 372 lines; substantive; the penalty/suppression/fold core; chokepoint-only reads |
| `lib/hmi/dial-reach-orchestrator.cjs` | pure drop of suppressedReachIds before sort/gate | VERIFIED | drop at :265, before sort :268 + `_applyFrozenGate` :271; frozen bank byte-unchanged; pure (only require f-selector-ranker) |
| `scripts/intent-classifier.cjs` | live-arm reach_presented emit + upstream fold + render-seam merge | VERIFIED | emit :1521-1558 (db open), fold :1572-1599, render-seam merge :898-916; best-effort try/catch; db never threaded into orchestrator |
| `lib/workflow/selector-decisions.cjs` | optional enum-gated reach_id on recordSelectorDecision | VERIFIED | REACH_IDS frozen 6-set :73; enum-gate :223-225; merged via existing Object.assign :255; off-set/absent adds nothing (byte-stable) |
| `lib/workflow/dial-close-reach.cjs` | reject branch forwards reach.reach_id | VERIFIED | :251 forwards `reach.reach_id` from a real dial reach object |
| `lib/core/navigation/memory-events.cjs` | additive reach_presented EVENT_TYPE | VERIFIED | `'reach_presented'` IS inside the frozen Set (:445, before `]))` :446); floor-not-size contract preserved |
| `tests/run-all-158.sh` | one-command phase gate | VERIFIED | 14/14, exit 0; 11 CJS suites + Part 8 sweep + Part 9 sweep + frozen-148 passthrough |

### Key Link Verification (Level 3 wiring)

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| closeReach reject branch | recordSelectorDecision | `reach_id: reach.reach_id` | WIRED | dial-close-reach.cjs:251 |
| recordSelectorDecision | f_selector_decision row | enum-gated reach_id merge | WIRED | selector-decisions.cjs:223-255 |
| live engine arm | reach_presented memory_event | navigation.logMemoryEvent | WIRED | intent-classifier.cjs:1547 (db open) |
| reach-reject-reader | f_selector_decision / reach_presented | navigation.findRecentChanges (eventType filter) | WIRED | findRecentChanges genuinely filters by eventType + parses properties JSON |
| live engine arm | render seam | reach_penalties on resolved object | WIRED | intent-classifier.cjs:1604 -> :898-916 Object.assign + suppressedReachIds into buildReachList |
| computeReachPenalties | buildReachList drop | suppressedReachIds set | WIRED | orchestrator:265 filters survivors before sort + gate |

### Data-Flow Trace (Level 4)

The penalty reads REAL data: `findRecentChanges` runs `SELECT ... FROM nodes WHERE type='memory_event' AND created_at > ? AND json_extract(properties,'$.event_type')=?` and parses `properties` JSON, so `row.properties.reach_id` and the reject enums flow from actual stored rows. The reject-only db-backed suite seeds real rows via `openRoomDb` + `recordSelectorDecision` and reads them back through the chokepoint - the window-floor derivation is exercised against real createdAt timestamps, not only the injection seam. FLOWING.

### Behavioral Spot-Checks / Probe Execution

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full phase gate | `bash tests/run-all-158.sh` | exit 0; 14/14 (incl. frozen-148 18/18) | PASS |
| Byte-stable standalone | `node tests/test-158-reach-byte-stable.cjs` | PASS (3) | PASS |
| Discount standalone | `node tests/test-158-reach-discount.cjs` | PASS (5) | PASS |
| Hard-suppress standalone | `node tests/test-158-reach-hard-suppress.cjs` | PASS (3) | PASS |
| no ranker_weights | `grep -rn ranker_weights lib/ scripts/ tests/` | empty | PASS |
| 0.40/0.30/0.30 untouched | git log f-selector-ranker.cjs | last by 121.5/125, not 158 | PASS |

### Requirements Coverage

RJP-01..08 all SATISFIED (see Observable Truths table). No orphaned requirements.

### Anti-Patterns Found

None blocking. No TBD/FIXME/XXX in the 158 code. The known intentional `return 0` / `return false` early-exits in the reader are defensive guards (cold path / fence logic), each driven by real downstream code paths, not stubs - confirmed by the db-backed suites populating the same variables with real data.

### Human Verification Required

None. All phase behaviors have deterministic automated verification (the injection seam + counter-keyed parole remove every non-determinism source). 158-VALIDATION.md declares zero manual-only verifications.

### Gaps Summary

No gaps block the phase goal. One honest, pre-disclosed observation (NOT a 158 gap):

- The Plan 01 SUMMARY candidly notes `closeReach`/`closeOffer` have no LIVE production caller yet (the consumer-surface route that reads `f1_closer_payload.reachIds` and routes a pick into closeReach is unwired). This is a pre-existing Phase 143.1-surface gap, explicitly OUT of 158 scope. It does NOT block the phase goal: the production penalty path (`computeReachPenalties` on the live engine arm) reads `f_selector_decision` rows by reach_id and fires whenever rejection edges exist in room.db, and the keying that feeds it (`recordSelectorDecision` reach_id enum) is reachable via closeReach's reject branch. The SPEC contract - "the ranker reads rejection signals back, discounts then hard-suppresses, byte-stable at zero" - is fully delivered and verified at the dial surface. The dormant `_applyDecayWeight` command rail (BLOCKER 2) is likewise correctly OUT of scope (SC-04) and recorded as a separate latent follow-up.

---

_Verified: 2026-06-15_
_Verifier: Claude (gsd-verifier)_
