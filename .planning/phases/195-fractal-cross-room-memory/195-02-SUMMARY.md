---
phase: 195-fractal-cross-room-memory
plan: 02
subsystem: database
tags: [reconciler, memory-cortex, fractal, drift, room-db, cjs, node-sqlite]

# Dependency graph
requires:
  - phase: 195-01
    provides: depth-3 nested-room fixture + Wave-0 SKIP-safe aggregator + SEED-004 write-scope fix
provides:
  - Recursive fractal memory reconciler (discoverMemoryFiles walks ROOM.md-bearing sub-rooms to DEPTH_CAP=3, idempotent, depth-qualified node ids)
  - DRIFT registered as the 7th memory kind in CODE (BASENAME_TO_KIND + writer accept-set + projection branch), canon amendment still gated
  - readSextuple (sync + async) additive read-family extension (+drift field)
affects: [195-04-umbilical, 195-05-canon-amendment, FCM-08, fractal-memory, cross-room]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Depth-bounded fractal walk reusing coverage-rollup DEPTH_CAP (no second depth constant)"
    - "Depth-qualified section keys (relative-path) make MEMORY_ARTIFACT_NODE_ID collision-proof across sub-rooms"
    - "Additive read-family climb (readQuintuple -> readSextuple): spread prior fields byte-unchanged, add one key"
    - "Born-wired kind registration: a BASENAME_TO_KIND entry MUST have a matching writer accept-set member"

key-files:
  created:
    - tests/test-195-recursive-reconcile.cjs
    - tests/test-195-drift-kind.cjs
  modified:
    - lib/core/memory/reconcile-memory-runner.cjs
    - lib/core/navigation/memory-artifacts.cjs
    - lib/core/folder-memory.cjs
    - lib/core/folder-memory-async.cjs
    - tests/test-150-memory-nodes.cjs

key-decisions:
  - "Reused coverage-rollup DEPTH_CAP (frozen at 3) rather than minting a second depth constant (Part 7 / Part 11 R11)"
  - "Unconditional descent over discoverSections-qualified children bounded by DEPTH_CAP (robust, backward-compatible, cannot miss a nested sub-room under a well-formed Decision-#15 tree)"
  - "DRIFT projects as a plain memory_artifact node like ROOM/STATE; richer drift-ledger node deferred (RESEARCH A5)"
  - "Path A read-family extension (readSextuple +drift); the pre-existing USER read-back gap left as a named out-of-scope follow-on"

patterns-established:
  - "Fractal reconcile: identity-begets-memory, depth-bounded, idempotent, entry-23 clean (never reads a child room.db edge row)"
  - "Dot-directory guard keeps the memory-kind DRIFT.md strictly separate from the .planning/DRIFT.md audit baseline (Pitfall 5)"

requirements-completed: [FCM-01, FCM-02, FCM-07]

# Metrics
duration: 8min
completed: 2026-07-01
---

# Phase 195 Plan 02: Recursive Reconciler + DRIFT Code Registration Summary

**Grew the shipped 1-level memory walk into a depth-3 fractal reconciler over ROOM.md-bearing sub-rooms (idempotent, depth-qualified, entry-23 clean) and registered DRIFT as the 7th memory kind in code (born-wired projection + readSextuple), with zero canon bytes.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-01T13:28:45Z
- **Completed:** 2026-07-01T13:37:01Z
- **Tasks:** 2
- **Files modified:** 5 (2 created)

## Accomplishments
- `discoverMemoryFiles` now recurses ROOM.md-bearing sub-rooms via a new `walkFractalMemory` helper, bounded by coverage-rollup's frozen `DEPTH_CAP=3` (root=depth 0, children walked to 3 inclusive, depth-4 discovered but never projected). Reuses `sectionRegistry.discoverSections` per level - no hand-rolled walker, no second depth constant.
- Depth-qualified section keys (relative sub-room path, e.g. `section-alpha/sub-room/sub-sub-room`) keep `MEMORY_ARTIFACT_NODE_ID` unique across depths, so two sub-rooms sharing a bare slug never collide (Pitfall 2).
- Idempotence is free: the walk only feeds a deeper flat file list into the existing upsert loop, so pass-2 returns `{upserted:0}` with byte-identical node/edge counts.
- DRIFT is the 7th memory kind in code: registered in `BASENAME_TO_KIND`, accepted by the `writeMemoryArtifactNode` chokepoint (added to `MEMORY_KINDS`), and given a documented projection branch. A `DRIFT.md` now projects a real `memory_artifact` node.
- `readSextuple` (sync + async twin) extends the read family additively (+`drift`), preserving the five prior `readQuintuple` fields byte-for-byte and sync/async key-set parity.

## Task Commits

Each task was committed atomically:

1. **Task 1: Recursive discoverMemoryFiles to depth 3 (FCM-01/02) with depth-qualified node ids** - `11dab59f` (feat)
2. **Task 2: Register DRIFT as the 7th memory kind in code (FCM-07)** - `9d6d8e1f` (feat)

_Note: Task 1's commit also carries the DRIFT `BASENAME_TO_KIND` entry and projection branch because they co-locate in the same runner file; the writer accept-set + read family land in Task 2._

## Files Created/Modified
- `lib/core/memory/reconcile-memory-runner.cjs` - recursive `walkFractalMemory` walk to DEPTH_CAP; DRIFT `BASENAME_TO_KIND` entry + projection branch; dot-directory guard (never `.planning/`)
- `lib/core/navigation/memory-artifacts.cjs` - `MEMORY_KINDS` grows 6 -> 7 (+DRIFT) so a discovered DRIFT.md projects born-wired through the chokepoint
- `lib/core/folder-memory.cjs` - `readSextuple` (+drift) + `extractDriftBody`
- `lib/core/folder-memory-async.cjs` - async `readSextuple` twin (parity, AsyncFunction)
- `tests/test-150-memory-nodes.cjs` - updated to expect 7 accepted kinds (born-wired consequence)
- `tests/test-195-recursive-reconcile.cjs` - depth-3 project / depth-4 not / idempotent / no-collision (new)
- `tests/test-195-drift-kind.cjs` - DRIFT classify + project + readSextuple parity + no `.planning` source + no canon byte (new)

## Decisions Made
- Reused the ONE frozen `DEPTH_CAP` from coverage-rollup (Part 7 / Part 11 R11) rather than minting a second constant.
- Descent is unconditional over `discoverSections`-qualified children (each already requires `.md` identity; Decision #15 guarantees ROOM.md), bounded by DEPTH_CAP. Simpler and more robust than a ROOM.md-gated descent, and cannot miss a nested sub-room under a non-identity intermediate.
- DRIFT projects as a plain `memory_artifact` node (like ROOM/STATE); the richer intent-vs-actual drift-ledger node is a deferred follow-on (RESEARCH A5).
- Path A read-family extension (readSextuple, +drift); the pre-existing USER read-back gap (readQuintuple stops at feynman) is left as a named out-of-scope follow-on.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Expanded the code `MEMORY_KINDS` accept-set to include DRIFT**
- **Found during:** Task 2 (DRIFT registration)
- **Issue:** The plan/RESEARCH premise stated "the generic writeMemoryArtifactNode path already handles any kind." It does not - `writeMemoryArtifactNode` validates `kind` against the frozen `MEMORY_KIND_SET` (6 kinds). Registering `DRIFT.md` in `BASENAME_TO_KIND` alone would make a DRIFT.md discovered-but-unprojectable: the per-file write returns `invalid_kind` and the node is silently dropped - a broken wire (Part 11 R1/R2 born-wired). The plan's `files_modified` list omitted `memory-artifacts.cjs`.
- **Fix:** Added `'DRIFT'` to `MEMORY_KINDS` in `lib/core/navigation/memory-artifacts.cjs` so the chokepoint accepts DRIFT. This is CODE, not a canon byte; `docs/MINDRIAN-CANON.md` is untouched (the FCM-08 6->7 amendment stays gated, Wave 5).
- **Files modified:** lib/core/navigation/memory-artifacts.cjs
- **Verification:** test-195-drift-kind.cjs asserts a DRIFT memory_artifact node projects; test-195-canon-7-kind-floor stays green (docs still assert 6); no canon byte written.
- **Committed in:** 9d6d8e1f (Task 2 commit)

**2. [Rule 3 - Blocking] Updated test-150-memory-nodes.cjs from 6 to 7 kinds**
- **Found during:** Task 2 (DRIFT registration)
- **Issue:** `test-150-memory-nodes.cjs` asserted `MEMORY_KINDS.length === 6` and `rows.length === 6`. The born-wired DRIFT accept-set (deviation 1) makes these 7. Leaving the test unchanged would be a red regression.
- **Fix:** Updated the two count assertions (6 -> 7) and their comments to reflect the DRIFT addition.
- **Files modified:** tests/test-150-memory-nodes.cjs
- **Verification:** node tests/test-150-memory-nodes.cjs -> all assertions passed.
- **Committed in:** 9d6d8e1f (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking).
**Impact on plan:** Both were required to realize the stated goal ("register DRIFT as the 7th memory kind in code" / born-wired projection). The RESEARCH premise that the writer accepts any kind was factually wrong; correcting it kept scope tight (one const member + one test count) and wrote NO canon bytes. No scope creep beyond the memory-cortex reconcile path.

## Issues Encountered
None beyond the deviations above. The two Wave-0 SKIP legs (`test-195-recursive-reconcile`, `test-195-drift-kind`) flipped from SKIP to PASS in `run-all-195.sh`; the FCM-08 canon 7-kind FLOOR stayed green asserting 6 (unchanged this wave); the full Phase-150 memory-cortex suite and the folder-memory sync/async parity suite (17/17) show no regressions.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The depth-3 fractal invariant is now enforced and idempotent; downstream cross-room work (Wave 2+) can rely on sub-room memory being projected.
- DRIFT is fully wired in code; the Wave-5 FCM-08 canon amendment will only need to ratify an already-registered basename and flip `REQUIRE_DRIFT=true` in the canon floor test.
- Not touched (correctly out of scope / other sessions): `edges.cjs`, `docs/MINDRIAN-CANON.md`, and the parallel Phase-205 framework-chain files.

## Self-Check: PASSED

- FOUND: tests/test-195-recursive-reconcile.cjs
- FOUND: tests/test-195-drift-kind.cjs
- FOUND: .planning/phases/195-fractal-cross-room-memory/195-02-SUMMARY.md
- FOUND commit: 11dab59f (Task 1)
- FOUND commit: 9d6d8e1f (Task 2)

---
*Phase: 195-fractal-cross-room-memory*
*Completed: 2026-07-01*
