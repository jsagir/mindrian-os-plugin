---
phase: 314-seed-055-broaden-sens-13-to-portfolio-movement-mos-eureka-portfolio-command
plan: 04
subsystem: eureka
tags: [eureka, portfolio, cli, run-store-diff, on-demand, seen-marker]

requires:
  - phase: 314-01
    provides: saveRun, readLatest, readPrevious, writeMovement, readMovement, clearMovement, markSeen, scopeId, diffRuns, buildMovementEnvelope, loadThresholds
  - phase: 314-02
    provides: runPortfolio (ok, degraded, error shapes; display.labelOf)
  - phase: 314-03
    provides: SENS-13 shape B (reads movement-<scope_id>.json, fails closed on a corrupt seen file)
provides:
  - "scripts/eureka-portfolio.cjs: run, show, seen, help over a process.argv switch-case router; main(argv, deps) and parseArgv exported"
  - "the chain run, store, diff, movement file, sensor, seen proven in one test"
affects: [314-05, 314-06, 314-07, 314-08]

tech-stack:
  added: []
  patterns:
    - "main(argv, deps) returns an exit code and prints through deps.out; the entry point sets process.exitCode and never calls process.exit"
    - "movement file written or cleared for the current scope id only; another scope's unseen movement is never touched"
    - "run never marks seen; show and the seen subcommand do"

key-files:
  created:
    - scripts/eureka-portfolio.cjs
    - tests/test-314-cli.cjs
    - tests/test-314-e2e.cjs
  modified: []

key-decisions:
  - "Exit codes: 0 done (a degrade is an honest answer), 1 run or store failure and a room path with no room.db, 2 a bad argument."
  - "A run whose diff is not comparable or has no events calls clearMovement for its own scope. A first run therefore also clears that scope's old movement file."
  - "The printed ranked rows carry both score (raw number) and fitness (a two-decimal string), so the command never computes a decimal."
  - "show builds the movement block from the stored files. reshuffle_active in show is thresholds.calibrated (same rule as the detector)."
  - "A failed writeMovement or clearMovement after a good saveRun does not fail the run. It prints store.movement as 'failed'."

requirements-completed: [PM314-01, PM314-02, PM314-05, PM314-06, PM314-10]

duration: ~35min (ASSUMED, start time not recorded)
completed: 2026-10-28
---

# Phase 314 Plan 04: Portfolio Command-Line Door Summary

**One thin script turns a successful run into a stored snapshot, a diff against the previous run and a per-scope movement file, and proves in an end-to-end test that SENS-13 fires on unseen live movement and stays silent in every other case.**

## Accomplishments

- `scripts/eureka-portfolio.cjs` (about 440 lines): subcommands `run --room DIR [--section SLUG] [--top N] [--offline]`, `show --room DIR [--section SLUG]`, `seen --room DIR --id MOVEMENT_ID`, `help`. Exports `main`, `parseArgv`, `PLAIN_REASONS`, `FALLBACK_LABEL`.
- Run order (PROVEN by the e2e and cli tests): runPortfolio, stop unless ok, readLatest (previous), saveRun, diffRuns with loadThresholds, buildMovementEnvelope, then writeMovement or clearMovement for this scope only.
- Degraded and error runs write nothing and leave every movement file alone (C5, C6, E6: directory listing before equals after).
- `run` output keys: `status, scope, section, ran_at, encoder_kind, provenance, ranked, tail, counts, movement, store`.
  - `movement`: `first_run, comparable, reason, reshuffle_active, movement_id, scope_id, counts, events, plain_note`.
  - `store`: `saved, rotated, movement` (written, cleared, failed).
  - Events carry plain labels: `a_label` and `b_label` for a band cross, `label` for a tail entrant. A handle with no label prints `a pair outside the top of the list`.
- `movement.reshuffle_active` is present in `run` and `show` output (plan 314-05 K16 and plan 314-07 depend on it). It is false today because the thresholds file ships `calibrated: false`.
- `show` prints the stored latest run (top 25 rows from stored pairs and labels), tail, and the stored movement of the current scope, then marks that movement seen. With no stored run it prints `{ status: 'none', plain_reason }` and exits 0.
- `seen` validates the id pattern and calls markSeen.
- Plain reasons are fixed sentences (no band, tail, quadrant, AHP, handle, sensor, percentile, envelope or SENS word; pinned by C11).
- `--offline` selects `stubEncode` from `scripts/eureka-room-report.cjs`; the run is stored with `encoder_kind: 'stub'` (E5, E8).

## Task Commits

| Task | Commit | Type |
|------|--------|------|
| 1 RED | 9042a8ef5 | test(314-04): failing test, Cannot find module |
| 1 GREEN | fbf751d24 | feat(314-04): the command-line door |
| 2 | c4582e61e | test(314-04): end-to-end chain (no RED, see deviations) |

## Verification (PROVEN: run with temp HOME, USERPROFILE and MINDRIAN_ROOMS_HOME, UV_OFFLINE=1, offline preload)

- RED run of `tests/test-314-cli.cjs` failed with MODULE_NOT_FOUND before the script existed.
- `tests/test-314-cli.cjs`: 12 passed, 0 failed (C1 to C12).
- `tests/test-314-e2e.cjs`: 9 passed, 0 failed (E1 to E9), including E8 with the real `runPortfolio` on a 36-thing fixture room: status ok, stored snapshot passes `validateSnapshot`, second identical run prints comparable true, zero events, no movement file.
- Still exit 0: `test-314-sensor-shape-b.cjs`, `test-314-snapshot.cjs`, `test-314-movement.cjs`, `test-314-run.cjs`, `test-366-runner-retired.cjs`.
- `node scripts/eureka-portfolio.cjs help` prints usage and exits 0; an unknown subcommand exits 2.
- Dash scan (`grep -cP '\x{2014}|\x{2013}'`) on the script and both tests: 0 hits.
- Source scan (C12): no `http`, no Brain client name, no child_process, timer or watcher.
- `node scripts/build-connector-registry.cjs --check` exited without an error line in the tail; `node scripts/check-render-coverage.cjs`: 17 covered, 0 gap.

## Deviations from Plan

**1. Task 2 has no RED commit**
- The e2e test exercises code from plans 01 to 03 and Task 1. All legs passed once two mistakes in my own test were fixed, so there is no failing-code commit. No production code changed in Task 2 and no contract drift between plans 01 to 04 was found.

**2. [Rule 1 - Bug, in my test] Three first-draft test errors, no production change**
- E3 used a low-to-moderate move for the third run. That is not a firing band crossing, so no new movement was made. Changed to low-to-high.
- E9 listed the section store folder `section-opportunity-bank` as a file-name leak. The opaque-name rule applies to `movement-*.json` only. The test now filters on `movement-`. Also corrected a wrong expected file count (2, not 3).

**3. Chokepoint hook**
- The new script did not trigger `scripts/check-substrate.cjs`, so no allow-list entry was added. The script has no `room-db` require and no graph write. (`portfolio-run.cjs`, which it calls, already has its entry from 314-02.) PROVEN: the commit passed the hooks.

## Known Stubs

None. `reshuffle_active` is false until plan 314-07 calibrates and flips the thresholds file; that is the accepted degrade from plan 01.

## Threat Flags

None new. T-314-16 (slug, absolute path and movement id checks before any path join: C2, C3, C10), T-314-18 (no background process, temp then rename from the store), T-314-19 (nothing written unless status ok; save failure leaves movement untouched: C5, C6, E6) are mitigated in code and tests. T-314-17 accepted: labels go to the local terminal only.

## Issues Encountered

- A shell export of HOME in one Bash call did not carry to the next call. Each test run sets HOME, USERPROFILE, MINDRIAN_ROOMS_HOME inline.
- The Write tool turned unicode escape text into dash characters in earlier plans. This plan typed no dash text and used `String.fromCharCode` in the tests.

## Next Phase Readiness

- Plan 314-05 (command text) calls `run --room DIR [--section NAME]`, then `seen --room DIR --id MOVEMENT_ID` after it shows the movement. It reads `movement.reshuffle_active` and `movement.movement_id` (null when nothing moved), `movement.plain_note`, `ranked[].fitness`, `provenance.encoder_model`, `plain_reason` on degrade and error.
- Plan 314-07 can use `--offline` only for tests. Its real calibration run is not started here.
- Plan 314-08 owns CHANGELOG.md and docs/CANON-PHASE-MAP.md. STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched.
- UNVERIFIED: a run against a real room with the live encoder (plan 314-07 owns it).

## Self-Check: PASSED

- Files exist: scripts/eureka-portfolio.cjs, tests/test-314-cli.cjs, tests/test-314-e2e.cjs (PROVEN by the test runs).
- Commits 9042a8ef5, fbf751d24, c4582e61e are in `git log` of feat/eureka-adapter-rebased.
