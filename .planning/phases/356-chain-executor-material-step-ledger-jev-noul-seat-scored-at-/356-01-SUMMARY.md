---
phase: 356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-
plan: 01
subsystem: testing
tags: [jev, tripwire, test-scaffolding, larry-contract, part8, chain-executor]

# Dependency graph
requires: []
provides:
  - "tests/fixtures/356-no-network-preload.cjs (shared no-network preload for every spawned 356 child)"
  - "tests/run-all-356.sh (Phase 356 aggregator, written once)"
  - "HOOKS_BANNED_LEDGER_SCRIPTS named list constant in tests/test-353-tripwires.cjs leg 2 (D-19, append-only, shared with 357/354-17)"
  - "tests/test-356-tripwires.cjs (lib/+hooks/ vendor-token scan with negative control)"
  - "tests/test-356-larry-contract.cjs (D-12 doc scan of larry-extended Post-Gate Handoff)"
affects: [356-02, 356-03, 357, 354-17]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Test hygiene contract: every 356 test scrubs TYPESAFE_API_KEY and replaces globalThis.fetch with a counting thrower before any repo require, asserts NET_ATTEMPTS === 0 last"
    - "Named append-only list constant instead of hand-edited regex for hooks/ ban lists (D-19)"
    - "PENDING-but-passing legs for not-yet-landed artifacts (irreversibility-ledger.cjs, the policy file, the shipped ledger) so scaffolding is green before later 356 plans land"

key-files:
  created:
    - tests/fixtures/356-no-network-preload.cjs
    - tests/run-all-356.sh
    - tests/test-356-tripwires.cjs
    - tests/test-356-larry-contract.cjs
  modified:
    - tests/test-353-tripwires.cjs

key-decisions:
  - "356 was first to reach the test-353-tripwires.cjs leg-2 conversion (357 had not yet touched it): declared HOOKS_BANNED_LEDGER_SCRIPTS as the named list constant per D-19; 357 and 354-17 append to it"
  - "Legs 1 and 3 of tests/test-353-tripwires.cjs left byte-identical (verified by git diff after edit)"

patterns-established:
  - "Pattern: PENDING leg counts as passing when its target artifact has not landed yet, with an explicit console.log naming what is pending"

requirements-completed: [R356-05, R356-07]

# Metrics
duration: 35min
completed: 2026-09-23
---

# Phase 356 Plan 01: Test scaffolding, tripwires, and Larry contract check Summary

**Five test files: a shared no-network preload + run-all-356.sh aggregator, the D-19 HOOKS_BANNED_LEDGER_SCRIPTS conversion of test-353-tripwires.cjs leg 2, a lib/+hooks/ vendor-token tripwire with a working negative control, and a D-12 Larry post-gate contract check that reads agents/larry-extended.md without editing it.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-23 (session start)
- **Completed:** 2026-09-23
- **Tasks:** 3/3
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- `tests/fixtures/356-no-network-preload.cjs` refuses any fetch loudly (prints `NETWORK_ATTEMPT_356` to stderr, throws) and deletes `TYPESAFE_API_KEY` before any other module loads in a spawned child.
- `tests/run-all-356.sh` aggregator (written once, per phase convention): 10 `run_if` legs for unlanded 356 test files, 8 existing-suite legs (264 frozen pins, 353 tripwires, larry handoff seam, 5 chain-executor suites), 6 ledger-absent legs (`MINDRIAN_IRREVERSIBILITY_LEDGER=/nonexistent`), and an em-dash guard. Currently exits 0 with 15-17 PASSED and 8-10 SKIPPED (unlanded 356 test files).
- `tests/test-353-tripwires.cjs` leg 2 converted from a hand-edited regex to the named, append-only `HOOKS_BANNED_LEDGER_SCRIPTS` constant (D-19), pre-seeded with all 3 dev-time ledger scripts named across 356/357/354-17 (`jev-devtime-client`, `build-command-irreversibility-ledger`, `irreversibility-answer-key`) alongside the original 2 (`eval-icm-writers`, `build-section-command-ledger`). Legs 1 and 3 untouched (confirmed by diff).
- `tests/test-356-tripwires.cjs`: leg A scans `lib/` + `hooks/` (10,077 files) for 5 banned vendor tokens; leg B plants and removes a negative-control scratch file proving the scan actually catches a hit; leg C sweeps `lib/core/irreversibility-ledger.cjs` (PENDING, not landed yet); leg D sweeps `lib/core/chain-executor.cjs` for jev/typesafe tokens (clean).
- `tests/test-356-larry-contract.cjs`: extracts the "## Post-Gate Handoff" section from `agents/larry-extended.md`, asserts it still says runChain halts at the first material step; scans both `agents/larry-extended.md` and `skills/larry-personality/SKILL.md` for any redefinition of material as irreversible (none found); confirms `chain-executor.cjs` carries `'forced_material'` at least twice; runs `test-larry-handoff-seam.cjs` twice (default env, and with a missing-ledger env var) via spawned children using the shared no-network preload and a fresh temp HOME, both green; confirms no commit on `agents/larry-extended.md` names phase 356.

## Task Commits

Each task was committed atomically:

1. **Task 1: No-network preload and the run-all-356.sh aggregator** - `27adda235` (test)
2. **Task 2: HOOKS_BANNED_LEDGER_SCRIPTS list constant (D-19) and test-356-tripwires.cjs** - `10c69091d` (test)
3. **Task 3: D-12 Larry contract test (tests/test-356-larry-contract.cjs)** - `ee0023441` (test)

**Plan metadata:** (this commit, following SUMMARY.md creation)

## Files Created/Modified
- `tests/fixtures/356-no-network-preload.cjs` - shared `NODE_OPTIONS=--require` preload for every spawned 356 child
- `tests/run-all-356.sh` - Phase 356 verification aggregator, written once
- `tests/test-353-tripwires.cjs` - leg 2 converted to the `HOOKS_BANNED_LEDGER_SCRIPTS` named list constant (D-19)
- `tests/test-356-tripwires.cjs` - lib/+hooks/ vendor-token scan with a negative control, plus runtime-module raw-fetch sweeps
- `tests/test-356-larry-contract.cjs` - D-12 doc scan of larry-extended's Post-Gate Handoff plus the handoff-seam suite run with and without a ledger

## Decisions Made
- 356 reached the `test-353-tripwires.cjs` leg-2 conversion first (357 had not yet introduced a named list constant, confirmed by reading the file before editing): declared `HOOKS_BANNED_LEDGER_SCRIPTS` fresh, per D-19's "whoever reaches it first" rule.
- Preflight recorded before editing `tests/test-353-tripwires.cjs`: `git status --short` was clean (no uncommitted diff from another session), `git log -3` showed `1592c2cd2` / `acd5faf87` as the last two touching commits, and `node tests/test-353-tripwires.cjs` printed `PASS=5 FAIL=0` both before and after the edit.
- `agents/larry-extended.md` git log (Task 3 read_first): last 5 commits are `b9398b6a0` (344-04), `41dea758c` (298-05), `829e26df3` (quick-260907-qta), `4a149a4df` (260907-m2j), `70c15d04a` (quick-260907-i8j). None reference 357's gate-prose shrink yet, so no cross-check was needed against a landed 357 change. `test-356-larry-contract.cjs` leg 6 confirms this file's HEAD (`b9398b6a0` for this path) carries no 356 commit.

## Deviations from Plan

None - plan executed exactly as written. All artifacts, legs, and acceptance criteria match the plan's `must_haves` and per-task `acceptance_criteria` blocks.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None. All five files are complete, runnable test/aggregator code with no placeholder logic. Legs that reference not-yet-landed 356 artifacts (`lib/core/irreversibility-ledger.cjs`, `data/jev-policies/command-irreversibility.json`, `data/command-irreversibility-ledger.json`) print an explicit `PENDING: ...` line and count as passing by design (the plan's own must_haves specify this degrade-gracefully shape for Wave-1 scaffolding); this is not a stub, it is the documented behavior for legs whose target artifact ships in a later 356 plan.

## Next Phase Readiness
- The aggregator, the shared preload, the append-only hooks/ ban list, the vendor tripwire, and the D-12 contract check are all in place for 356-02 (353 builder/client extraction) and 356-03 (chain-executor integration) to build against.
- `tests/run-all-356.sh` will automatically pick up `tests/test-356-jev-client.cjs`, `tests/test-356-egress.cjs`, `tests/test-356-runtime.cjs`, `tests/test-356-label-sheet.cjs`, `tests/test-356-policy.cjs`, `tests/test-356-ledger-build.cjs`, `tests/test-356-check.cjs`, and `tests/test-356-answer-key.cjs` the moment each lands, with no further edits to the aggregator itself.
- `tests/test-356-tripwires.cjs` leg C and `tests/test-356-larry-contract.cjs` leg 4 / the "handoff seam with shipped ledger" line will flip from PENDING to a real assertion once `lib/core/irreversibility-ledger.cjs` and `data/jev-policies/command-irreversibility.json` / `data/command-irreversibility-ledger.json` land.
- No blockers for Wave 1 siblings (356-02, 356-03).

---
*Phase: 356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-*
*Completed: 2026-09-23*
