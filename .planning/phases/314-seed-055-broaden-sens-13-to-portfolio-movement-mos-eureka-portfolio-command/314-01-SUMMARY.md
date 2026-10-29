---
phase: 314-seed-055-broaden-sens-13-to-portfolio-movement-mos-eureka-portfolio-command
plan: 01
subsystem: eureka
tags: [eureka, portfolio, snapshot, movement, closed-schema, part8, local-store]

requires:
  - phase: 213-eureka-reach-wiring
    provides: FIRING_BANDS, the closed-schema side-channel idiom (atomicWriteJson, sortedKeysEqual), classify() Part 8 test pattern
provides:
  - "lib/core/eureka/portfolio-snapshot.cjs: closed-schema snapshot store with per-scope movement files and a capped seen set"
  - "lib/core/eureka/portfolio-movement.cjs: diffRuns, topNMetrics, buildMovementEnvelope, validateEnvelope, loadThresholds"
  - "data/eureka-portfolio-thresholds.json: calibrated false until plan 314-07 records a real run"
affects: [314-02, 314-03, 314-04, 314-06, 314-07]

tech-stack:
  added: []
  patterns:
    - "one movement file per scope id (movement-<scope_id>.json), so a run in one scope never clears another scope's unseen movement"
    - "scope id of a named subset is s_ + 8 hex of sha256(slug): the readable section name never reaches a file name or the envelope"
    - "lazy require of the envelope validator inside writeMovement to avoid a require cycle"
    - "seen list is a set capped at 64 newest; a corrupt seen file reads as seen for every id (fail closed)"

key-files:
  created:
    - lib/core/eureka/portfolio-snapshot.cjs
    - lib/core/eureka/portfolio-movement.cjs
    - data/eureka-portfolio-thresholds.json
    - tests/test-314-snapshot.cjs
    - tests/test-314-movement.cjs
    - tests/test-314-part8-envelope.cjs
  modified: []

key-decisions:
  - "Top-N reshuffle detection ships OFF (calibrated false). Band crossing and tail entry work now. This is the accepted degrade recorded in the plan; 314-07 measures and flips it (D-04)."
  - "saveRun writes the new run to a temp file first, then rotates latest into previous, then renames the temp file over latest. The window where latest is missing is one rename."
  - "saveRun refuses a snapshot whose scope_id does not equal scopeId(scope argument) (reason scope_mismatch)."
  - "markSeen on a corrupt seen file rewrites it with the new id, so a damaged file cannot silence the nudge forever. isSeen on a corrupt file stays fail-closed (true)."
  - "validateEnvelope requires 1 to 3 events. An envelope with no events is never built."

requirements-completed: [PM314-05, PM314-06, PM314-08]

duration: ~25min (ASSUMED, start time not recorded)
completed: 2026-10-28
---

# Phase 314 Plan 01: Portfolio Snapshot Store and Movement Detector Summary

**Closed-schema local snapshot store (latest/previous rotation, per-scope movement files, capped seen set) plus a pure movement detector (band cross, tail entrant, gated top-N reshuffle) with a label-free Part 8 envelope.**

## Accomplishments

- `portfolio-snapshot.cjs`: `scopeId`, `scopeDir`, `validateSnapshot`, `saveRun`, `readLatest`, `readPrevious`, `writeMovement`, `readMovement`, `listMovements`, `clearMovement`, `markSeen`, `isSeen`. Exports `SCOPE_ID_RE`, `MOVEMENT_PREFIX` ('movement-'), `MOVEMENT_SUFFIX` ('.json'), `SEEN_FILE` ('movement-seen.json'), `MAX_SEEN` (64), `MAX_MOVEMENT_FILES` (8), `SLUG_RE`, `HANDLE_RE`, `BANDS`, `STORE_DIRNAME`. This matches the API that plans 314-03, 04 and 06 call. PROVEN by test legs S1 to S10.
- `portfolio-movement.cjs`: `diffRuns`, `topNMetrics`, `buildMovementEnvelope`, `validateEnvelope`, `loadThresholds`, `BAND_ORDER`, `MAX_EVENTS` (3). `FIRING_BANDS` is required from `sensor-eureka.cjs`, not copied.
- Envelope keys: `schema_version, kind, movement_id, detected_at, scope, scope_id, encoder_kind, counts{band_cross,tail_enter,top_n_reshuffle}, events`. Event shapes are closed per kind.
- `data/eureka-portfolio-thresholds.json` ships `calibrated: false` with null numbers.

## Task Commits

| Task | Commit | Type |
|------|--------|------|
| 1 RED | 77d26af5f | test(314-01): failing snapshot store test |
| 1 GREEN | 1c05458e4 | feat(314-01): snapshot store |
| 2 RED | 35983888d | test(314-01): failing movement detector test |
| 2 GREEN | 1493e7e2a | feat(314-01): detector, thresholds file (also removes the S7 guard and fixes MV6 in the test files) |
| 3 | 39428d677 | test(314-01): Part 8 fence (no RED phase, see deviations) |

## Verification (all PROVEN, run with temp HOME, USERPROFILE and MINDRIAN_ROOMS_HOME, UV_OFFLINE=1)

- `node tests/test-314-snapshot.cjs`: 10 passed, 0 failed.
- `node tests/test-314-movement.cjs`: 11 passed, 0 failed.
- `node tests/test-314-part8-envelope.cjs`: 6 passed, 0 failed.
- Both RED tests failed with "Cannot find module" before the modules existed.
- Dash scan on the two modules, the data file and the three tests: 0 em-dash or en-dash hits.
- `git diff --name-only 7699ebdb4 HEAD -- lib/core/insight-sensors.cjs lib/core/navigation-engine.cjs`: prints nothing.
- `node scripts/build-connector-registry.cjs --check`: OK. `node scripts/check-render-coverage.cjs`: 0 gaps.
- No new `require` of a network module in either new module (S9, MV11 scan the source).

## Deviations from Plan

**1. [Rule 3 - Blocking] Task 1 S7 depended on a Task 2 module**
- **Issue:** S7 (`writeMovement`, `readMovement`) needs `validateEnvelope`, which Task 2 builds. The plan forbids a require cycle, so `writeMovement` requires it lazily.
- **Fix:** In the Task 1 commit the S7 body ran behind a visible guard that skipped it when `portfolio-movement.cjs` was absent, and printed a skip note. The Task 2 commit removed the guard, so S7 now runs in full. Commit 1c05458e4 therefore had S7 skipped; commit 1493e7e2a has it passing.

**2. [Rule 1 - Bug, in the test] MV6 case d4 contradicted the rule**
- **Issue:** My first draft expected "1 entered + 1 left" to stay below `reshuffle_min_moved: 2`. The rule is `entered + left >= min_moved`, so it fires.
- **Fix:** d4 became a same-member case with max shift 2 (no event); a new d5 pins that one swapped member fires. Detector code was correct. Commit 1493e7e2a.

**3. Task 3 has no RED commit**
- The plan says production code changes only if a leg fails. All six EV legs passed on first run against the Task 1 and 2 modules, so there is no failing-test commit. This is a fence test over existing code, not new behavior. PROVEN that it passed on first run; UNVERIFIED that each leg would fail on a deliberate leak (no mutation run was done).

## Known Stubs

None. `data/eureka-portfolio-thresholds.json` is calibrated false by design (D-04); plan 314-07 owns the real numbers.

## Threat Flags

None beyond the plan register. T-314-01 to T-314-05a are mitigated in code and tests (closed schema on every read, slug allow-list, caps, per-scope files, seen set).

## Issues Encountered

- The Write tool turned the unicode escape text I typed for the dash characters in two test regexes into literal dash characters. I replaced them with `String.fromCharCode` so the test files carry no dash characters. No effect on behavior.

## Next Phase Readiness

- Plan 314-02 can build `runPortfolio` against `validateSnapshot` and `scopeId`.
- Plan 314-03 can replicate the store constants (a drift pin B9 compares them with the exports here).
- Plan 314-04 can call `readLatest`, `saveRun`, `diffRuns`, `loadThresholds`, `buildMovementEnvelope`, `writeMovement`, `clearMovement`.
- Plan 314-07 must call `topNMetrics` and `diffRuns` and then flip `calibrated` with a `calibration` object and three positive integers (`top_n` at least 2).
- Shared files (CHANGELOG.md, docs/CANON-PHASE-MAP.md) were not touched. Plan 314-08 owns them. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched.

## Self-Check: PASSED

- Files exist: portfolio-snapshot.cjs, portfolio-movement.cjs, eureka-portfolio-thresholds.json, three test files (PROVEN by the test runs above).
- Commits 77d26af5f, 1c05458e4, 35983888d, 1493e7e2a, 39428d677 are in `git log` of branch feat/eureka-adapter-rebased.
