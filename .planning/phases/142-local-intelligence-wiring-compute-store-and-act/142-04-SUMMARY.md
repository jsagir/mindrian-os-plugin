---
phase: 142-local-intelligence-wiring-compute-store-and-act
plan: 04
subsystem: testing
tags: [nav-engine, brain-derivation, post-compact, fileval, part-8, part-9, loop-fires]

# Dependency graph
requires:
  - phase: 142-01
    provides: run-all-142.sh aggregator + 7 RED loop-fires suites + room-142 fixture
  - phase: 141-local-retrieval-spine
    provides: fileEvidenceWithReadback read-back substrate (FILEVAL-02)
  - phase: 95.5-post-compact-memory-pipeline-consumer
    provides: post-compact re-injection consumer (status passed, 5/5)
  - phase: 90-brain-derivation-layer
    provides: deriveSection + buildBrainQueryContext Part-8 chokepoint + atomic writer
  - phase: 91-navigation-engine
    provides: decide() + resolveTierMode brain_md_tier_mode consumption
provides:
  - "NAV-02 closed end-to-end: ensureSectionDerived auto-fire makes a section observably rise above tier_0 in a decision trace"
  - "NAV-04 closed by reference to Phase 95.5 + locked by a two-hop regression fence (hooks.json -> coordinator -> consumer)"
  - "FILEVAL-03 closed both halves: honesty (filing_did_not_land surfaced) + REMIND (ok:true carries non-empty human-readable round-trip readback)"
  - "navigation.surfaceFileEvidenceResult: the Larry-facing surfacing layer for the read-back result"
affects: [Phase 143, Phase 144, Phase 146, navigation-engine, fileval, brain-derivation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Auto-fire wire (ensureSectionDerived) sits ON TOP of the shipped deriveSection; local no-Brain-query path reuses the existing Part-8 chokepoint, never adding a second Brain-context builder"
    - "Two-hop regression fence: assert the coordinator-loads-consumer hop + the hooks.json-registers-coordinator-on-compact-matcher hop, never a naive direct grep that false-fails"
    - "Thin-wire surfacing: the already-computed round-trip readback is surfaced into the ok:true return (LOCAL recall, Part 8), not recomputed"

key-files:
  created:
    - .planning/phases/142-local-intelligence-wiring-compute-store-and-act/deferred-items.md
  modified:
    - lib/core/brain-derivation.cjs
    - lib/core/navigation/file-evidence-readback.cjs
    - lib/core/navigation.cjs
    - tests/test-post-compact-nav04-closure.cjs
    - tests/test-fileval-readback-surface.cjs

key-decisions:
  - "NAV-02 auto-fire is a thin wire (ensureSectionDerived), not a re-implementation: idempotent short-circuit, live-Brain delegation to deriveSection, local no-query path that composes a schema-valid fresh BRAIN.md from the LOCAL triple through the existing buildBrainQueryContext chokepoint"
  - "NAV-04 test rewritten to the plan-checker two-hop contract: a direct hooks.json grep for the consumer FALSE-FAILS, so the fence asserts the coordinator hop instead, plus an explicit anti-false-fail guard that the consumer is NOT named directly in hooks.json"
  - "FILEVAL-03 REMIND half thin-wired: the validated `landed` round-trip values (already computed in the read-back) are surfaced as result.readback on the ok:true return; surfaceFileEvidenceResult added as the honesty + recall surfacing entry point"

patterns-established:
  - "Pattern: a verify/close plan proves loop-fires acceptance by turning RED suites GREEN against shipped code, wiring only the one gap each test proves"
  - "Pattern: Part-8 cleanliness asserted by grep (buildBrainQueryContext is the sole Brain-context builder; brain_query_count:0 proves zero queries fired on the local path)"

requirements-completed: [NAV-02, NAV-04, FILEVAL-03]

# Metrics
duration: ~40min
completed: 2026-06-06
---

# Phase 142 Plan 04: Verify-and-Close NAV-02 + NAV-04 + FILEVAL-03 Summary

**Three loop-fires suites turned GREEN against shipped code: NAV-02 (ensureSectionDerived auto-fire lifts a section above tier_0 in a decision trace), NAV-04 (close-by-reference to Phase 95.5 + a two-hop regression fence), and FILEVAL-03 (read-back honesty surfaced + the REMIND positive path carrying non-empty human-readable round-trip readback).**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-06-05 (session)
- **Completed:** 2026-06-06
- **Tasks:** 3
- **Files modified:** 5 (3 production, 2 tests) + 1 deferred-items doc

## Accomplishments

- **NAV-02 closed end-to-end.** Added `ensureSectionDerived(roomPath, section, opts)` to `lib/core/brain-derivation.cjs` as the one-line auto-fire the consumption side was missing. It is idempotent (short-circuits on a fresh brain-authored BRAIN.md), delegates to the shipped `deriveSection` when the live Brain is reachable, and otherwise composes a minimal, schema-valid, fresh, brain-authored BRAIN.md from the LOCAL triple through the EXISTING Part-8 chokepoint `buildBrainQueryContext` (hash + enum + slug only). The local path fires ZERO Brain queries (`brain_query_count: 0`). `tests/test-brain-md-tier-rise.cjs` now proves `tier_0` with BRAIN.md absent rises above `tier_0` once the section BRAIN.md is written, observed in `decision_trace.brain_md_tier_mode`.
- **NAV-04 closed by reference + fenced.** Rewrote `tests/test-post-compact-nav04-closure.cjs` to the plan-checker two-hop contract: HOP 1 = `hooks/hooks.json` registers `sessionstart-coordinator.cjs` on a SessionStart entry whose matcher includes `compact`; HOP 2 = `sessionstart-coordinator.cjs` loads `restore-post-compact-context.cjs`. Plus an explicit anti-false-fail guard that the consumer is NOT named directly in hooks.json, the up-lane producer (`scripts/post-compact`) presence, and the `95.5-VERIFICATION.md status: passed` close-by-reference citation. No production change.
- **FILEVAL-03 closed both halves.** Thin-wired the already-computed `landed` round-trip values into the ok:true return of `fileEvidenceWithReadback` as `result.readback` (LOCAL recall, Part 8) and added `surfaceFileEvidenceResult(result)` as the Larry-facing surfacing layer (honesty signal for ok:false; human-readable recall for ok:true), re-exported through `navigation.cjs`. Rewrote `tests/test-fileval-readback-surface.cjs` to prove HONESTY (`filing_did_not_land` returned + surfaced) AND the plan-checker REMIND positive path (ok:true carries non-empty, human-readable round-trip readback fields).

## Task Commits

1. **Task 1: NAV-02 tier-rise auto-fire** - `ed440faf` (feat)
2. **Task 2: NAV-04 close-by-reference + two-hop fence** - `925ef7f4` (test)
3. **Task 3: FILEVAL-03 honesty + REMIND surfacing** - `3be2640b` (feat)

## Files Created/Modified

- `lib/core/brain-derivation.cjs` - Added `ensureSectionDerived` (NAV-02 auto-fire) + export. Reuses `buildBrainQueryContext` + `assembleBrainMd` + `atomicWriteBrainMd`; no new Brain query surface.
- `lib/core/navigation/file-evidence-readback.cjs` - ok:true return now carries `readback` (round-trip recall via new `buildReadback`); added `surfaceFileEvidenceResult` + export.
- `lib/core/navigation.cjs` - Re-export `surfaceFileEvidenceResult` on the navigation surface.
- `tests/test-post-compact-nav04-closure.cjs` - Rewritten to the two-hop fence (was a naive direct hooks.json grep that false-fails).
- `tests/test-fileval-readback-surface.cjs` - Rewritten to assert BOTH FILEVAL-03 halves (honesty + REMIND).
- `.planning/phases/142-.../deferred-items.md` - Logged DI-142-01 (out-of-scope flaky NAV-03 drain test).
- `tests/test-brain-md-tier-rise.cjs` - NOT modified; the RED suite went green purely via the production `ensureSectionDerived` wire.

## Decisions Made

- The NAV-02 gap the test proved was the AUTO-FIRE only (the consumption side was already shipped). Closed with a thin `ensureSectionDerived` wire rather than touching `deriveSection`. The local no-Brain-query path is what lets the tier rise in a test/offline session without a live Brain key, while staying Part-8-clean.
- The plan-checker NAV-04 revision was honored exactly: a direct hooks.json grep for the consumer false-fails because the consumer is loaded by the coordinator, not named in hooks.json. The fence asserts the two real hops.
- The plan-checker FILEVAL-03 REMIND revision was honored: the success path no longer computes-then-discards the recall. The `readback` field surfaces the validated round-trip provenance + topic/summary + artifact_path + proposed review_status, all human-readable, all from the local row (never egress).

## Deviations from Plan

None affecting scope. The plan authorized a disciplined thin-wire on each task IF the test proved a gap; all three thin-wires were proven necessary and are exactly the authorized ones (NAV-02 `ensureSectionDerived`; FILEVAL-03 `readback` surfacing + `surfaceFileEvidenceResult`). NAV-04 required no production change.

## Issues Encountered

- **DI-142-01 (out of scope, logged, not fixed):** `tests/test-derivation-drain-fires.cjs` (NAV-03, plan 142-03) is cold-start flaky: its drain-script `--dry-run` subtest intermittently fails on the FIRST invocation after an idle gap (empty stdout) and passes on re-run. Confirmed decoupled from 142-04: the failing test and its script import none of the three files this plan touched, and `ensureSectionDerived` touches neither the derivation queue nor `MINDRIAN_BRAIN_KEY`. Two back-to-back full `run-all-142.sh` runs both yielded 7/7 PASS. Left to the 142-03 owner per the SCOPE BOUNDARY rule; logged in `deferred-items.md`.

## Verification

- `node tests/test-brain-md-tier-rise.cjs` -> 3/3 PASS (NAV-02 tier rise in the trace).
- `node tests/test-post-compact-nav04-closure.cjs` -> 5/5 PASS (NAV-04 two-hop fence + 95.5 passed).
- `node tests/test-fileval-readback-surface.cjs` -> 4/4 PASS (FILEVAL-03 honesty + REMIND).
- `grep -c buildBrainQueryContext lib/core/brain-derivation.cjs` -> 9 (sole Brain-context builder; no second surface introduced).
- FILEVAL-02 contract (`test-fileval-readback.cjs`) stays PASS (the `readback` field is purely additive).
- `test-navigation-acceptance.cjs`, `test-decoy-tier.cjs`, `test-room-home-vs-brain-derivation-regression.cjs` -> PASS (zero regression).
- `bash tests/run-all-142.sh` -> 7/7 PASS (run twice consecutively).
- Em-dash sweep over all touched files -> clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- NAV-02, NAV-04, FILEVAL-03 are now loop-fires acceptance tests composable by the Phase 146 gate.
- Phase 144 (NAV-01 legacy->engine flip) depends on Phase 142's BRAIN.md derivation raising tier_mode; that derivation now auto-fires via `ensureSectionDerived` and is observable in the decision trace.
- Open item for the 142-03 owner: stabilize the cold-start flaky `test-derivation-drain-fires.cjs` (DI-142-01).

## Self-Check: PASSED

All 5 modified files + 2 created docs exist on disk. All 3 task commits (`ed440faf`, `925ef7f4`, `3be2640b`) present in git history.

---
*Phase: 142-local-intelligence-wiring-compute-store-and-act*
*Completed: 2026-06-06*
