---
phase: 270-memory-and-context-operator-mcp-consolidate-scattered-local-
plan: 03
subsystem: testing
tags: [icm-forest, part7, schema-driven, red-pin]

requires: []
provides:
  - "tests/test-270-no-second-walker.cjs: Canon Part 7 delegation census, greened by plan 270-07"
  - "tests/test-270-baseline-schema-driven.cjs: 4.1a schema-driven tripwire, greened by plan 270-07"
  - "tests/test-270-tree-classification.cjs: four-class contract + subset tolerance, greened by plan 270-07"
  - "tests/test-270-dynamic-tree.cjs: live discovery + debounce contract, greened by plan 270-08"
affects: [270-07, 270-08]

tech-stack:
  added: []
  patterns:
    - "readStripped(rel) helper: hard-fail on the operator core file specifically, soft-skip on any other not-yet-created operator file"
    - "extractFunctionBodies(src): brace-matched function-body extraction for a structural (not regex-only) self-recursion census"
    - "Schema-driven forbidden-literal lists derived at runtime from frozen exports, never restated in the test"

key-files:
  created:
    - tests/test-270-no-second-walker.cjs
    - tests/test-270-baseline-schema-driven.cjs
    - tests/test-270-tree-classification.cjs
    - tests/test-270-dynamic-tree.cjs
  modified: []

key-decisions:
  - "team's IDENTITY_DIRECTORIES/STRUCTURAL_DIRS double-membership is pinned to resolve to structural_directory (STRUCTURAL_DIRS wins), stated as an explicit precedence-rule comment in the test rather than left for plan 270-07 to invent its own tie-break."
  - "tests/test-270-dynamic-tree.cjs's makeFixtureForest() is a deliberately trimmed local copy of Task 2's fixture (two bare room slugs, not full section scaffolding) since this file's assertions only need room-slug presence and a mid-test-created sub-directory, not classification."

requirements-completed: [MEMOP-03, MEMOP-04, MEMOP-05, MEMOP-06]

duration: 70min
completed: 2026-08-27
---

# Phase 270 Plan 03: Discovery-Half Wave-0 Pins Summary

**Four RED test files pin Canon Part 7 delegation, the 4.1a schema-driven baseline constraint, the four-class directory contract (with the team double-membership precedence rule), and live discovery-with-no-registration-step -- all failing today for `lib/core/icm-forest.cjs` and `lib/mcp/tree-watcher.cjs` not existing yet, exactly as designed.**

## Performance

- **Duration:** 70 min
- **Tasks:** 3
- **Files modified:** 4 (all new)

## Accomplishments

- `tests/test-270-no-second-walker.cjs`: a structural (brace-matched, not regex-only) self-recursion census over a declared `OPERATOR_FILES` list, plus source tripwires for a second `DEPTH_CAP` and any promotion-primitive call (`healRoom`/`approvedBy`/`birthRoom`/`confirmNode`) leaking into discovery code.
- `tests/test-270-baseline-schema-driven.cjs`: imports `SECTION_NAMES`/`IDENTITY_DIRECTORIES` from `room-skeleton-scaffold.cjs` at runtime and builds its own forbidden-literal list from them -- verified to restate zero canonical names itself.
- `tests/test-270-tree-classification.cjs`: a two-room fixture (`alpha` full, `beta` subset) pins the `DIRECTORY_CLASSES` frozen four-class contract, the `team` double-membership precedence rule, the blueprint-subset-is-not-an-error rule, and a structure-only payload allow-list (with a 512-char string-length proxy against a file-body leak).
- `tests/test-270-dynamic-tree.cjs`: pins `mos://tree` as a Resource (never a Tool), the no-re-registration dynamic-discovery contract, and the tree-watcher debounce behavior. Terminates cleanly under a 60s timeout (no hung chokidar handle).
- `bash tests/run-all-270.sh` (with `TEST_270_ALLOW_MISSING=1`) now reports `PASS=2 FAIL=6`, matching this plan's own `<verification>` exactly (the two 270-02 pins plus these four).

## Task Commits

1. **Task 1: tests/test-270-no-second-walker.cjs** - `adad859f` (test)
2. **Task 1: tests/test-270-baseline-schema-driven.cjs** - `cb6e4169` (test)
3. **Task 2: tests/test-270-tree-classification.cjs** - `9352807b` (test)
4. **Task 3: tests/test-270-dynamic-tree.cjs** - `98638e76` (test)

## Files Created/Modified

- `tests/test-270-no-second-walker.cjs` - Part 7 delegation census
- `tests/test-270-baseline-schema-driven.cjs` - 4.1a schema-driven tripwire
- `tests/test-270-tree-classification.cjs` - four-class + subset RED pin
- `tests/test-270-dynamic-tree.cjs` - live discovery + debounce RED pin

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

None - plan executed as written. All four files' RED failures were verified to fail for the stated reason (the missing `lib/core/icm-forest.cjs` / `lib/mcp/tree-watcher.cjs`, never a bare `Cannot find module` or a harness artifact), matching every literal acceptance criterion.

## Issues Encountered

None specific to this plan. The pre-existing `bash tests/run-all-266.sh` `FAIL=1` condition documented in plan 270-02's SUMMARY.md (a concurrent Phase 265 session's uncommitted `commands/file-meeting.md`/`skills/file-meeting/SKILL.md` edits staling `data/connector-coverage-ledger.json`) is unrelated to this plan and was not re-investigated here.

## Next Phase Readiness

- Wave 1's three autonomous plans (270-02, 270-03, 270-04) are complete. `bash tests/run-all-270.sh` (with `TEST_270_ALLOW_MISSING=1`) is the single command reporting phase status.
- Plan 270-07 (Wave 2) greens the first three files here. Plan 270-08 (Wave 4) greens `test-270-dynamic-tree.cjs`.
- **Blocked separately, not by this plan:** Wave 1's plan 270-01 (the OQ-1/OQ-2 navigator decision gate) has not been answered. This plan has no dependency on 270-01 and is unaffected, but plans 270-07 and 270-08 (which this plan's tests feed) both transitively depend on it.

---
*Phase: 270-memory-and-context-operator-mcp-consolidate-scattered-local-*
*Completed: 2026-08-27*
