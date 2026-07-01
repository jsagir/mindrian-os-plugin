---
phase: 195-fractal-cross-room-memory
plan: 01
subsystem: testing
tags: [write-scope-hook, room-root-walkup, registry-reverse-match, test-aggregator, floor-test, nested-room-fixture]

# Dependency graph
requires:
  - phase: 194-session-binding
    provides: "set-membership write-scope comparison (isRoomInWriteScope) that this fix now feeds a correctly-resolved slug"
  - phase: 169-room-root-consolidation
    provides: "lib/core/room-root.cjs the ONE .room-root walk-up idiom cloned into targetRoomUnderRoot"
  - phase: 188-shape-f-selector
    provides: "tests/run-all-188.sh run/run_if SKIP-safe aggregator + frozen-scalar membrane grep cloned into run-all-195.sh"
provides:
  - "SEED-004 CLOSED: nested-room writes ALLOW, cross-nested writes BLOCK (born-wired birth in Wave 2 no longer false-blocks its own seeding)"
  - "tests/run-all-195.sh SKIP-safe aggregator (green with SKIPs, exit 0/1)"
  - "tests/test-195-canon-7-kind-floor.cjs FCM-08 green-as-guard (six-kind now, one-line REQUIRE_DRIFT flip to seven)"
  - "tests/test-195-umbilical-edge-floor.cjs membership FLOOR (never .size), SKIP-safe until 195-04 mints UMBILICAL_TO"
  - "tests/fixtures/195-nested-room-tree/ shared depth-3 fractal fixture for Wave 1 recursion + idempotence tests"
affects: [195-02-recursive-reconciler, 195-03-born-wired-birth, 195-04-umbilical-edge-store, 195-05-crossroom-cord, 195-06-canon-amendment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Walk-up-to-deepest-.room-root + registry reverse-match for symmetric active/target slug resolution"
    - "Green-as-guard FLOOR test with a one-line flip switch (REQUIRE_DRIFT) for a gated future amendment"
    - "Membership-only edge FLOOR (never .size) that tolerates a concurrent parallel session adding to the same frozen Set"
    - "Self-SKIP-safe floor: asserts current members now, auto-activates the gated assertion the instant the type lands"

key-files:
  created:
    - tests/run-all-195.sh
    - tests/test-195-canon-7-kind-floor.cjs
    - tests/test-195-umbilical-edge-floor.cjs
    - tests/fixtures/195-nested-room-tree/ (28 files: 3 .room-root sentinels + 6 memory basenames x 4 levels + ROOM.md tree)
  modified:
    - scripts/write-scope-check.cjs
    - scripts/83-scope-injection.test.cjs

key-decisions:
  - "targetRoomUnderRoot fails OPEN toward the original flat first-segment split on any walk-up/registry miss (a false block is worse than a false allow for a safety hook)"
  - "The UMBILICAL_TO edge floor is authored green-as-guard now (asserts current membership) and self-skips only the UMBILICAL_TO assertion, rather than being an absent file, so the current-membership floor protects the baseline from Wave 0 onward"
  - "The 3 SEED-004 fixtures drive the hook end-to-end over stdin (spawn write-scope-check.cjs with a real Write payload) rather than unit-testing the private targetRoomUnderRoot, so the whole allow/block path is under test"

patterns-established:
  - "Registry reverse-match: path.relative(root, sentinelDir) normalized and matched against .rooms/registry.json entry path fields to recover the REGISTERED slug"
  - "SKIP-safe Wave-0 aggregator: two hard-green legs (membrane grep + canon 7-kind floor) + all module legs run_if"

requirements-completed: [SEED-004]

# Metrics
duration: 18min
completed: 2026-07-01
---

# Phase 195 Plan 01: SEED-004 Foundation Summary

**Fixed the fractal write-scope bug that gated born-wired birth: targetRoomUnderRoot now walks up to the deepest .room-root and reverse-matches the registry to resolve the REGISTERED nested slug, and the Wave-0 test spine (SKIP-safe aggregator + two green-as-guard FLOORs + a shared depth-3 fixture) is in place.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-01
- **Completed:** 2026-07-01
- **Tasks:** 2 of 2
- **Files modified:** 2 modified, 3 test files + 1 fixture tree (28 files) created

## Accomplishments
- SEED-004 CLOSED. The root cause was a FLAT first-segment split in `targetRoomUnderRoot`: for a nested write like `mindrian/mindrianOS/notes.md` it returned `"mindrian"` (the top segment), so 194's set-membership guard compared the wrong slug and false-blocked the write. The fix clones the shipped `room-root.cjs:79-89` walk-up to find the DEEPEST `.room-root` sentinel (the room the write actually lands in), then reverse-matches that dir against the registry `path` fields to recover the registered slug. Active-room resolution and target resolution now speak the same slug vocabulary.
- No over-correction to silent-allow: the cross-nested BLOCK fixture proves a write into a DIFFERENT nested room than the active one still resolves to that room's slug and BLOCKS (the 95.1 drift-class-C hazard). Fail-open is preserved (any resolution miss falls back to the flat split).
- The Wave-0 test spine is live: `tests/run-all-195.sh` (SKIP-safe clone of run-all-188.sh) exits 0 with the membrane grep + canon 7-kind floor GREEN and all 9 module legs SKIP; the UMBILICAL_TO edge floor is authored membership-only (never `.size`) and SKIP-safe until 195-04.
- The shared depth-3 fractal fixture (`root -> section -> sub-room -> sub-sub-room`, `.room-root` sentinels + 6 memory basenames per level) is on disk for the Wave-1 recursion + idempotence tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: SKIP-safe test spine + two Wave-0 FLOORs + shared depth-3 fixture** - `cc8789f9` (test)
2. **Task 2: SEED-004 residual fix - targetRoomUnderRoot walk-up + registry reverse-match** - `ed530b63` (fix)

_Plan metadata commit follows this SUMMARY._

## Files Created/Modified
- `scripts/write-scope-check.cjs` - Added `walkUpToRoomRoot`, `slugForRoomDir`, `normSegments` helpers and rewrote `targetRoomUnderRoot` to resolve the registered nested slug via walk-up + registry reverse-match; the 194 set-membership comparison layer is untouched.
- `scripts/83-scope-injection.test.cjs` - Added a `runWriteScopeCheck` stdin-driven hook harness + `mkNestedRoom` helper and 3 SEED-004 fixtures (2-seg ALLOW, 4-seg ALLOW, cross-nested BLOCK); 13/13 green.
- `tests/run-all-195.sh` - SKIP-safe aggregator cloned from run-all-188.sh; membrane grep + canon 7-kind floor hard-green, every module leg run_if.
- `tests/test-195-canon-7-kind-floor.cjs` - FCM-08 green-as-guard floor: asserts the current six-kind Part-9 complement + intact frozen-scalar membrane; `REQUIRE_DRIFT` flips it to seven in Wave 5.
- `tests/test-195-umbilical-edge-floor.cjs` - Membership FLOOR (never `.size`) over ALLOWED_EDGE_TYPES; asserts the current floor members (incl. NESTED_WITHIN / SHARES_JOB / ELEVATES_TO) and self-skips the UMBILICAL_TO assertion until it is minted.
- `tests/fixtures/195-nested-room-tree/` - Depth-3 fractal room tree fixture.

## Decisions Made
- Fail-OPEN preserved in `targetRoomUnderRoot`: on any walk-up or registry miss it falls back to the original flat first-segment split. A false block is worse than a false allow for a PreToolUse safety hook.
- The 3 fixtures exercise the hook end-to-end (spawn `write-scope-check.cjs` with a real Write payload over stdin, assert exit 0=allow / 2=block) instead of unit-testing the private function, so the whole allow/block decision path is covered.

## Deviations from Plan

None material - plan executed as written. One clarifying interpretation:

- **[Rule 3 - Clarification] UMBILICAL_TO edge floor authored green-as-guard rather than absent-file SKIP.** The plan text both said "Author test-195-umbilical-edge-floor.cjs" and "register it as run_if so it SKIPs until Wave 3." An authored file cannot file-SKIP under `run_if` (the file exists). Resolved by authoring the floor to assert the CURRENT membership floor (green now, protects the baseline from Wave 0) and to self-skip ONLY the UMBILICAL_TO-specific assertion until the type lands. This is strictly more protective than an absent file and auto-tightens with zero edits when 195-04 mints UMBILICAL_TO. `run-all-195.sh` still exits 0; the edge floor is SKIP-safe (never fails).

## Issues Encountered
None. Both suites green on first full run; no auto-fix attempts needed.

## Threat Model Compliance
- **T-195-01 (Tampering, write into wrong/sealed room):** mitigated. Registry reverse-match resolves the correct registered slug; the cross-nested BLOCK fixture guards against over-correction; GUARDRAIL sealed-room skip path is unchanged.
- **T-195-02 (Elevation, over-correction silent-allow):** mitigated. Fixture (c) asserts a BLOCK (exit 2) for a write into a different nested room than the bound one.
- **T-195-SC (supply-chain):** N/A. Zero external installs; 100% in-repo CJS on Node built-ins.

## Verification
- `bash tests/run-all-195.sh` -> exit 0 (Passed 4, Failed 0, Skipped 9); membrane grep + canon 7-kind floor GREEN; UMBILICAL_TO edge floor green-and-SKIP-safe.
- `node scripts/83-scope-injection.test.cjs` -> 13/13 passed (incl. the 3 SEED-004 fixtures).
- No em-dashes in any created/modified file (verified by grep).

## Self-Check: PASSED
- All 7 created/modified paths present on disk.
- Both task commits (cc8789f9, ed530b63) present in git history.
