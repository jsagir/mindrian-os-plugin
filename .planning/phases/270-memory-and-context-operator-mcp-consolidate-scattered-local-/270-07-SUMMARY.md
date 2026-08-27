---
phase: 270-memory-and-context-operator-mcp-consolidate-scattered-local-
plan: 07
subsystem: core
tags: [icm-forest, composition, part7, schema-driven]

requires:
  - phase: 270-01
    provides: "270-DECISIONS.md OQ-1 answer (oq1-a), determining this plan's DEPTH_CAP handling"
  - phase: 270-03
    provides: "the three discovery-half RED pins this plan greens"
provides:
  - "lib/core/icm-forest.cjs: DIRECTORY_CLASSES, classifyDirectory, sectionVocabulary, listRoomRoots, discoverIcmForest"
affects: [270-08, 270-09, 270-10, 270-12]

tech-stack:
  added: []
  patterns:
    - "enumerateChildBasenames: union of four already-shipped single-level readers, deduplicated by basename, classified by NAME LOOKUP into frozen tables regardless of which reader found it"
    - "safeJoin(): a local, dependency-free copy of tool-router.cjs's safeResolveSection containment check, since that helper lives behind a _test-only export not meant for cross-layer production import"

key-files:
  created:
    - lib/core/icm-forest.cjs
  modified: []

key-decisions:
  - "Top-level room nodes classify as 'discovered' (classifyDirectory's fallback arm) since the four-class taxonomy names sub-directory classes, not the room-root entry itself; `registered` (not `class`) is the field that actually distinguishes a legitimate room from a stray top-level folder."
  - "listRoomRoots() duplicates lib/mcp/tools/room.cjs's listRooms() single-level enumeration logic rather than editing room.cjs, which is plan 270-12's file in a later wave -- recorded as a named follow-up (see Deviations) rather than silently introduced."
  - "safeJoin() is a local copy of tool-router.cjs's safeResolveSection pattern rather than an import, since that helper is exported only via a `_test` surface not meant for production cross-module use, and lib/core/* must not depend on lib/mcp/*."

requirements-completed: [MEMOP-04, MEMOP-05, MEMOP-06]

duration: 80min
completed: 2026-08-27
---

# Phase 270 Plan 07: ICM Forest Root Summary

**`lib/core/icm-forest.cjs` composes the two already-shipped walkers (filesystem Walker A, graph-native Walker B) plus the unregistered-folder detector into the forest-root entry point that was genuinely missing -- zero hand-rolled recursive descent, zero second DEPTH_CAP, zero promotion path. All three of this plan's Wave-0 RED pins pass fully green on the first implementation pass, and a live run against this developer's real `~/MindrianRooms` (37 rooms, 581 nodes) returns a structure-only payload with zero warnings.**

## Performance

- **Duration:** 80 min
- **Tasks:** 2
- **Files modified:** 1 (new)

## Accomplishments

- `DIRECTORY_CLASSES` (frozen four-class array) and `classifyDirectory(name)` implement the `team` double-membership precedence rule (`STRUCTURAL_DIRS` wins) and derive every other membership from the frozen `SECTION_NAMES`/`IDENTITY_DIRECTORIES` tables at runtime -- zero inlined literals, zero `=== 8`/`=== 5` assertions, verified independently of the test suite.
- `discoverIcmForest(opts)`: enumerates top-level rooms via `listRoomRoots`, then for each room builds one level of classified children via `enumerateChildBasenames` (a union of `discoverSections`, direct existence checks for the three dot-prefixed identity directories and the two structural directories -- both invisible to `discoverSections` by design -- and `detectUnsentineledArtifactFolder`), recursing only across a genuine registered-room boundary. `rollupSubRooms` and `discoverMemoryFiles` are called informationally per room (read-only, never re-derived from).
- Every node's key set is allow-listed and every string is truncated to 512 characters -- a structural, not just tested, guarantee against a file-body leak.
- A per-room `try/catch` records failures as scalar strings in `warnings` and continues; `discoverIcmForest({})` never throws, confirmed against both the test fixture and the real `~/MindrianRooms`.
- All three Wave-0 pins from plan 270-03 (`test-270-no-second-walker.cjs`, `test-270-baseline-schema-driven.cjs`, `test-270-tree-classification.cjs`) pass fully green, first attempt.
- Zero regression: `test-248-resolver-census.cjs` 4/4, `bash tests/run-all-266.sh` `FAIL=0`, `node scripts/build-connector-registry.cjs --check` `OK`. `bash tests/run-all-270.sh` down to `FAIL=4` (three fewer than before this plan, exactly as the plan's own `<verification>` predicts).

## Task Commits

1. **Task 1 + Task 2 (one file, one commit): lib/core/icm-forest.cjs** - `0c1184dc` (feat)

## Files Created/Modified

- `lib/core/icm-forest.cjs` - the ICM forest root

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

**1. [Named follow-up, not a deviation from correctness] `listRoomRoots()` duplicates `room.cjs`'s `listRooms()` logic**
- As instructed by the plan's own read_first note (Task 2): lifting the single-level enumeration logic into `lib/core/icm-forest.cjs` as `listRoomRoots(home)` WITHOUT editing `lib/mcp/tools/room.cjs` (which plan 270-12 owns in a later wave) avoids a cross-plan file conflict now.
- **Follow-up for plan 270-12:** collapse `room.cjs`'s `listRooms()` to delegate to `icm-forest.cjs`'s `listRoomRoots()` instead of carrying its own copy of the same ~5-line logic, closing the temporary duplication.

**2. [Rule 1 - Necessary correction] `safeResolveSection`/`SECTION_RE` reused as a pattern, not an import**
- **Found during:** Task 2 design
- **Issue:** The plan's action text says "reuse `safeResolveSection` / `SECTION_RE` from `lib/mcp/tool-router.cjs`", but that pair is exported only via `module.exports._test = {...}` -- explicitly "kept out of the registerRouterTools surface area" per that file's own comment, i.e. a test-only surface, not meant for another production module's import. Importing it into `lib/core/icm-forest.cjs` would also invert the intended layer dependency (`lib/core/*` must not depend on `lib/mcp/*`).
- **Fix:** `safeJoin()` in `icm-forest.cjs` is a local, dependency-free copy of the exact same containment-check idiom (`path.resolve` plus a `startsWith` guard), cited back to the original by comment.
- **Files modified:** lib/core/icm-forest.cjs
- **Verification:** Path-traversal protection is structurally present (every path join in the module routes through `safeJoin`); no cross-layer or test-only-surface dependency was introduced.
- **Committed in:** `0c1184dc`

---

**Total deviations:** 1 necessary correction (the `safeJoin` local copy) plus 1 explicitly plan-directed follow-up (the `listRoomRoots` duplication, which the plan itself anticipated and asked to be recorded, not silently resolved). **Impact:** None on correctness; both are documented so a later reader (specifically plan 270-12) does not have to re-derive either finding.

## Issues Encountered

None. Both Task 1 and Task 2's automated verify blocks and every literal acceptance criterion passed on the first implementation attempt.

## Next Phase Readiness

- Plan 270-08 (Wave 4, `mos://tree` Resource + tree-watcher) and plan 270-09 (Wave 4, `context_assemble`) both depend on this plan and are now unblocked, alongside their other dependencies.
- Plan 270-10 (Wave 5) will add `findNearestSubRoomDecisions` to this SAME file (`lib/core/icm-forest.cjs`) -- this plan deliberately left that function unstubbed, per its own scope boundary.
- Plan 270-12 (Wave 7) has a concrete, recorded follow-up: collapse `room.cjs`'s `listRooms()` duplication into a delegate call to `icm-forest.cjs`'s `listRoomRoots()`.

---
*Phase: 270-memory-and-context-operator-mcp-consolidate-scattered-local-*
*Completed: 2026-08-27*
