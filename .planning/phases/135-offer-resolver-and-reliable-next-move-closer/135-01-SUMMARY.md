---
phase: 135-offer-resolver-and-reliable-next-move-closer
plan: 01
subsystem: navigation-engine / offer-resolution
tags: [offer-resolver, abstention, f-selector, wave-0-tests, context-wiring, canon-part-3, canon-part-9]
requires:
  - lib/core/navigation.cjs (Phase 109 chokepoint)
  - lib/core/navigation/spine-events.cjs (Phase 129)
  - lib/conversation/operator.cjs (Phase 99)
  - lib/workflow/selector-decisions.cjs + f-selector-ranker.cjs (Phase 125)
  - lib/core/room-db.cjs openRoomDb/closeRoomDb (Phase 109)
provides:
  - "navigation.openRoomDbForCaller / closeRoomDbForCaller: substrate-legal door for non-allow-listed hot-path callers to obtain a live room.db handle"
  - "scripts/intent-classifier.cjs context literal carrying ALL 5 resolver production inputs (operator, sectionPath, problemType, jtbd, roomState{db,roomDir,invocationsSinceDecision})"
  - "4 phase-135 test suites + run-all-135.sh aggregator (the Wave-0 verification harness)"
  - "tests/test-135-decide-wiring-e2e.cjs: the dark-loop / [[undefined]]-reason regression guard"
affects:
  - 135-02 (resolver body fills the stub; promotes the RED targets to GREEN)
  - 135-03 (F.1 closer; promotes the offer-closer RED targets to GREEN)
tech-stack:
  added: []  # zero new dependencies (Phase 87 invariant held)
  patterns:
    - "caller-owned room.db handle via a navigation.cjs *ForCaller re-export (mirrors the Phase 130-03 *ByRoomDir precedent)"
    - "lazy-require + try/catch + safe-default reads on the classifier hot path"
    - "runRed() tracked-RED test wrapper (Wave-0 RED scaffolds that 135-02/03 promote to run())"
key-files:
  created:
    - lib/memory/navigation-engine-offer.test.cjs
    - lib/memory/offer-closer.test.cjs
    - tests/test-135-resolver-no-leak.cjs
    - tests/test-135-decide-wiring-e2e.cjs
    - tests/run-all-135.sh
  modified:
    - scripts/intent-classifier.cjs
    - lib/core/navigation.cjs
    - lib/core/navigation/spine-events.cjs
decisions:
  - "Added navigation.openRoomDbForCaller/closeRoomDbForCaller (a substrate-legal door) because intent-classifier.cjs is NOT on the room-db.cjs allow-list, navigation.cjs exposes no handle-returning opener, and the F-selector contract requires the caller to populate roomState.db with a live handle"
  - "E2E drives decide() via the replicated Task-1 context build (sanctioned fallback) rather than module-requiring runNavigationEngine, because the classifier runs main() and reads stdin at module load (no require.main guard); the real chokepoint open + close-in-finally are still exercised"
  - "Wave-0 resolver/closer assertions ship RED via a runRed() wrapper so the suites land with Task 1 without blocking the wave; 135-02/03 delete the wrapper to promote them"
metrics:
  duration: ~40m
  completed: 2026-05-31
  tasks: 3
  files: 8
  commits: 3
---

# Phase 135 Plan 01: Offer Resolver Context-Wiring + Wave-0 Test Substrate Summary

Wired the COMPLETE resolver production input set into the single decide() call site and laid the Wave-0 verification harness (4 suites + aggregator), closing the [[undefined]] dark-loop at its source before the resolver body exists.

## What shipped

### Task 1 (commit 7e4fdc86) -- the load-bearing call-site wiring
`scripts/intent-classifier.cjs::runNavigationEngine` previously built the engine context as `{ quadruple, brainAvailable, userPersona, intentSignal }` -- NONE of the resolver's runtime inputs. The resolver (135-02) reads `context.operator`, `context.roomState` (db + roomDir + invocationsSinceDecision), `context.sectionPath`, `context.jtbd`, and `context.problemType`; with only those absent, `rankForSelector` would run on an empty roomState, the grounded reason would become `[[undefined]]`, and the loop would be dark in production while in-memory unit tests passed.

The context literal now carries ALL FIVE fields:
- `operator` -- `operator.getCurrent(roomDir).current`, default `'JUST_TALK'` (SC6 silence rule).
- `sectionPath` -- the line-1023 variable passed through (the [[wikilink]] target + scope).
- `problemType` -- `userPersona.problem_type` (null when unknown).
- `jtbd` -- `navigation.getCurrentJTBD(roomDir).jtbd` when `.ok !== false`, else null (SC4).
- `roomState` -- `{ db, roomDir, invocationsSinceDecision }` where `db` is a live room.db handle opened via the allow-listed navigation chokepoint and CLOSED in the promise finally AND the outer catch (no leak; Pitfall 5).

All new reads use the existing lazy-require + try/catch + safe-default pattern; decide() stays synchronous and local-only (A3 LOCKED -- no await introduced); when room.db is absent `roomState.db` is null and decide() still runs (graceful Tier-0 abstention).

### Task 2 (commit 25bf1e51) -- RED resolver + closer unit suites
- `lib/memory/navigation-engine-offer.test.cjs` pins the resolveOfferNextStep contract (SC1/SC3/SC6) via the public decide() entry. GREEN now: offer-or-null shape, JUST_TALK silence, no-throw across mode_a/mode_b/tier_0. Tracked RED until 135-02: the six-key offer at DECISION_GATE + the rejection-backoff gate.
- `lib/memory/offer-closer.test.cjs` pins the F.1 closer + edge-persistence contract (SC7) against a REAL temp room.db. GREEN now (substrate proof): recordSelectorDecision invalid_db gate + ok on a valid db, reject-then-shouldExclude backoff persistence, recordSelectorMiss memory_event-only, Free-Text as the 10th canonical verb. Tracked RED until 135-03: the offer-closer.cjs orchestration.

### Task 3 (commit 0da113cc) -- fs-leak + E2E wiring + aggregator
- `tests/test-135-resolver-no-leak.cjs` (SC2/SC9): zero non-SQLite reads on the resolver decide() path (USER.md allow-listed). GREEN.
- `tests/test-135-decide-wiring-e2e.cjs` (SC1/SC4/SC6): the dark-loop regression guard. REAL temp room.db seeded for a DECISION_GATE turn, real chokepoint open, replicated Task-1 context, real decide(). Asserts offer_next_step non-null with a real [[section]] reason (never [[undefined]]) + defined scope (RED until 135-02), plus a JUST_TALK null negative control (GREEN now -- abstention fires end-to-end).
- `tests/run-all-135.sh`: set -uo pipefail aggregator. All 4 suites; the two lib/memory suites referenced by repo-root path. Full runner: 4/4 PASSED.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] No reachable handle-returning room.db opener for the caller**
- **Found during:** Task 1.
- **Issue:** The plan said to reuse an existing reachable open helper and NOT add a new direct room-db.cjs require. But `scripts/intent-classifier.cjs` is NOT on the room-db.cjs substrate allow-list, `navigation.cjs` exposes no handle-returning opener (the spine-events log* helpers open+close internally and never return a handle), and the F-selector design contract requires the CALLER to populate `roomState.db` with a live handle. There was no substrate-legal way to satisfy the plan as literally written.
- **Fix:** Added `openRoomDbForCaller` / `closeRoomDbForCaller` to `lib/core/navigation/spine-events.cjs` (allow-listed) and re-exported them through `lib/core/navigation.cjs` -- the same thin additive-re-export pattern the navigation header sanctions (logMemoryEvent / writeEdge / the Phase 130-03 *ByRoomDir trio). The caller opens through the chokepoint, never requiring room-db.cjs directly. `check-substrate --diff` passes (zero new bypass).
- **Files modified:** lib/core/navigation/spine-events.cjs, lib/core/navigation.cjs.
- **Commit:** 7e4fdc86.

**2. [Rule 3 - Blocking] runNavigationEngine is not module-safe to require**
- **Found during:** Task 3.
- **Issue:** The plan preferred driving the real `runNavigationEngine` in the E2E test, but the function is not exported and the script runs `main()` + reads stdin (fd 0) at module load with no `require.main === module` guard. Requiring it from a test would execute the full CLI. Adding a CLI-entry guard to a hot-path script is out of scope and risky for a wiring/test plan.
- **Fix:** Used the plan's explicitly-sanctioned fallback -- replicate the exact Task-1 context build VERBATIM in the E2E test and call `navEngine.decide(turn, context)` directly, opening the real room.db via `navigation.openRoomDbForCaller` exactly as production does. The wiring (chokepoint open, full context shape, live handle, close-in-finally) is genuinely exercised.
- **Files modified:** tests/test-135-decide-wiring-e2e.cjs.
- **Commit:** 0da113cc.

**3. [Rule 1 - Bug] Closer-suite recordSelectorDecision failed with edge_write_failed**
- **Found during:** Task 2.
- **Issue:** The REJECTED cascade edge write has an FK (source, target) -> nodes(id); a bare seeded room.db has no cmd:/framework: anchor nodes, so the write failed.
- **Fix:** Added a `seedAnchorsFor` FK fixture mirroring `lib/memory/selector-decisions.test.cjs` verbatim, called before each recordSelectorDecision / shouldExclude test.
- **Files modified:** lib/memory/offer-closer.test.cjs.
- **Commit:** 25bf1e51.

**4. [Rule 1 - Bug] E2E openRoomDbForCaller returned null on a fresh room**
- **Found during:** Task 3.
- **Issue:** `openRoomDbForCaller` fs.existsSync-guards `<roomDir>/.mindrian/room.db` and returns null when absent (by design -> Tier 0). On a fresh temp room the file does not exist yet, so the fixture got null.
- **Fix:** The fixture CREATES room.db via room-db.cjs `openRoomDb` (tests are on the substrate allow-list) before the production-path open; the subsequent `openRoomDbForCaller` then succeeds.
- **Files modified:** tests/test-135-decide-wiring-e2e.cjs.
- **Commit:** 0da113cc.

## Authentication gates
None.

## Verification results
- `node -c scripts/intent-classifier.cjs` parses clean.
- Task 1 grep gate: ALL FIVE resolver inputs present in the context literal; getCurrentJTBD wired; no em-dash in the context region. PASS.
- `check-substrate.cjs --diff` on the full 3-commit diff: exit 0 (no new chokepoint bypass).
- `bash tests/run-all-135.sh`: 4/4 suites PASSED (resolver/closer-dependent assertions correctly tracked RED until 135-02/03; the E2E JUST_TALK negative control GREEN).
- Regression: `lib/memory/navigation-engine-core.test.cjs` 33/33 PASSED.
- Em-dash sweep across all 8 touched files: zero.
- Prohibited files (heal-command.cjs / doctor.cjs / session-start / RELEASE-COORDINATION.md): untouched.

## Known Stubs
None introduced. The intentional RED test targets (resolver six-key offer, backoff gate, closer orchestration) are documented Wave-0 scaffolds that 135-02 and 135-03 promote to GREEN -- not production stubs.

## Self-Check: PASSED
- Created files exist: lib/memory/navigation-engine-offer.test.cjs, lib/memory/offer-closer.test.cjs, tests/test-135-resolver-no-leak.cjs, tests/test-135-decide-wiring-e2e.cjs, tests/run-all-135.sh -- all present.
- Commits exist: 7e4fdc86, 25bf1e51, 0da113cc -- all in git log.
