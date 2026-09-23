---
phase: 354-system-integrity-and-theo-integration-independent-research-a
plan: 05
subsystem: mcp-boundary
tags: [path-containment, symlink, boundary-integrity, tier-2, canon-part-8-adjacent]

# Dependency graph
requires:
  - phase: 354-02
    provides: "gate subject promotion (unrelated file surface, sequencing only)"
  - phase: 354-03
    provides: "chain resume identity (unrelated file surface, sequencing only)"
  - phase: 354-04
    provides: "lib/core/write-lock.cjs owner-token lock (SYS-02) -- this plan's Task 3 patched docs/reviews/phase-354-probes/persistence.cjs to tolerate that fix's new throw"
provides:
  - "lib/core/room-path-containment.cjs: realRoomRoot, isRealpathContained, assertRealpathContained, writeFileContained -- one realpath-containment helper for every room read/write site"
  - "lib/core/reasoning-ops.cjs::_containedReasoningPath(roomDir, section, fileName) -- module-private containment gate for every reasoning read/write site"
  - "tests/test-354-room-symlink-containment.cjs: regression through fileArtifact, the real SDK resource client, and reasoning-ops (10 cases R1-R5, O1-O2, W1-W3)"
  - "Error code ROOM_PATH_ESCAPE; fileArtifact return reasons path_escape, section_traversal"
affects: [354-16, 354-18]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One realpath-containment helper (lib/core/room-path-containment.cjs), reused by tool-router.cjs's safeResolveSection (every existing caller inherits it with no per-caller edit: views.cjs fileArtifact, room.cjs searchRoom, tool-router.cjs's own chain-state fallback), by resources.cjs's room-section handler directly, and by reasoning-ops.cjs's own _containedReasoningPath wrapper (a different caller-supplied section shape that never passes through SECTION_RE)"
    - "isRealpathContained/realRoomRoot walk up to the deepest existing ancestor and rejoin the non-existing remainder, so a not-yet-created destination path -- or even a not-yet-created roomDir itself (the existing lib/memory/mcp-input-validation.test.cjs fixture uses one) -- resolves deterministically instead of throwing ENOENT"
    - "writeFileContained: 'wx'-created temp file in the contained parent, then fs.renameSync -- replaces a symlink leaf (the directory entry) rather than writing through it, mirroring lib/core/recovery/case-file.cjs's existing atomicWrite idiom with the added realpath leg that idiom does not need"

key-files:
  created:
    - lib/core/room-path-containment.cjs
    - tests/test-354-room-symlink-containment.cjs
  modified:
    - lib/mcp/tool-router.cjs
    - lib/mcp/tools/views.cjs
    - lib/mcp/resources.cjs
    - lib/core/reasoning-ops.cjs
    - docs/reviews/phase-354-probes/persistence.cjs

key-decisions:
  - "Symlink policy (locked in 354-05-PLAN.md, executed as written): a directory symlink inside a room is followed only when its realpath stays inside the room's realpath; any section, destination or existing parent whose realpath leaves the room is refused; the final file write never follows a symlink leaf (atomic temp-file plus rename replaces the directory entry)"
  - "Routed reasoning-ops.cjs's verifyReasoning through _containedReasoningPath even though the plan's task text named only getReasoning/listReasoning/getReasoningFrontmatter as the read sites to route -- the plan's own objective states 'every reasoning-ops read and write path refuse a section whose realpath leaves the room', and verifyReasoning has the identical shape and risk as the three named sites; the acceptance criterion's 'at least 7' _containedReasoningPath grep count is still satisfied at 11"
  - "createRun's runs-directory write asserts its parent's containment directly (assertRealpathContained) rather than through _containedReasoningPath, per the plan's own instruction -- that path is built from a generated run id, not a caller-supplied section, so the helper's <section> assumption does not fit"
  - "Percent-encoded traversal (CTX-CORRECTED) confirmed still bounded, not reopened: pinned as a passing regression floor (case R4), no fix code targets it"

requirements-completed: [SYS-01]

# Metrics
duration: ~30min
completed: 2026-09-23
---

# Phase 354 Plan 05: Room-Symlink Containment Summary

**Closed the P1 room-boundary seam where an existing symlink inside a room (e.g. room/research pointing outside) passed tool-router.cjs's lexical containment check but escaped through the resolved filesystem path at the actual write (views.cjs), the SDK resource read (resources.cjs room://section/{name} and reasoning://section/{name}), and reasoning-ops.cjs's own unchecked section path -- one realpath-containment helper now enforces a single symlink policy (follow only realpath-contained directory symlinks; never write through a symlink leaf, replace it atomically instead) at every one of those sites.**

## Performance

- **Duration:** approx. 30 min (commit-to-commit span for the three task commits was under 10 minutes; total session time including research reading was longer)
- **Completed:** 2026-09-23
- **Tasks:** 3
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- Wrote `tests/test-354-room-symlink-containment.cjs` (RED-first, commit
  `66c0e762c`): 10 cases across three groups against one shared scratch
  fixture (room/research -> outside dir symlink, .reasoning/linked -> outside
  dir symlink, notes/victim.md -> outside/victim.md file symlink, alias ->
  room/normal inside-pointing dir symlink, a sibling-prefix `<room>-evil`
  directory). Read-side cases (R1-R5) drive a real
  `@modelcontextprotocol/sdk` Client over `InMemoryTransport.createLinkedPair`
  against the real `registerResources`; reasoning-ops cases (O1-O2) call
  `getReasoning`/`setReasoningFrontmatter` directly; write-side cases (W1-W3)
  call `views.cjs`'s `_internal.fileArtifact`. Run against unfixed code:
  exit 1, with W1 (write escape refused), R2 (SDK section-read escape), R3
  (SDK reasoning-read escape), O1 (reasoning-ops read escape) and O2
  (reasoning-ops write escape) failing exactly as the plan's acceptance
  criteria named, plus R5 (section-listing leaked a symlinked file's
  content) and W2 (the write-leaf-replacement half) also failing pre-fix.
  R1, R4 (the percent-encoded/sibling-prefix floor) and W3 (the legitimate
  inside-pointing symlink) already held.
- Created `lib/core/room-path-containment.cjs` (GREEN, commit `51ec7fca6`):
  `realRoomRoot`, `isRealpathContained`, `assertRealpathContained`,
  `writeFileContained`. `isRealpathContained`/`realRoomRoot` share a
  `resolveExistingRealpath` walk-up (deepest existing ancestor, rejoin the
  non-existing remainder) so a not-yet-created path -- including a
  not-yet-created `roomDir` itself, the shape the pre-existing
  `lib/memory/mcp-input-validation.test.cjs` fixture already used -- resolves
  deterministically instead of throwing `ENOENT` (this surfaced as one
  failing pre-existing test during the verify pass and was fixed in the
  same commit, before it could regress a required verify gate).
- Wired the helper into `lib/mcp/tool-router.cjs`'s `safeResolveSection`
  (lexical check, then `assertRealpathContained`, rethrown unchanged under
  code `ROOM_PATH_ESCAPE`) -- every existing caller (`views.cjs` `fileArtifact`,
  `room.cjs` `searchRoom`, this file's own chain-state fallback at the old
  :1257) inherited the fix with no per-caller edit.
- Rewired `lib/mcp/tools/views.cjs`'s `fileArtifact`: wraps `safeResolveSection`
  in try/catch (`path_escape` for the realpath escape, `section_traversal`
  for the lexical one) before any byte, `memory_event` or node writes;
  re-asserts containment after `fs.mkdirSync` (TOCTOU); writes through the
  new `writeFileContained` (atomic replace, never through a symlink leaf).
  Updated the `artifact_file` tool description to name the realpath
  containment and symlink policy in one sentence; `build-connector-registry.cjs
  --check` showed no drift from the description edit.
- Contained `lib/mcp/resources.cjs`'s `room-section` handler (lexical check
  first, since a discovered section name legitimately falls outside
  `SECTION_RE`'s charset here, then `isRealpathContained`; refused sections
  return `Section "<name>" is outside this Data Room and was not read.`;
  each listed `.md` file is additionally filtered by its own realpath
  containment, so a file symlink inside an otherwise-legit section is
  omitted, never read).
- Added `lib/core/reasoning-ops.cjs::_containedReasoningPath(roomDir,
  section, fileName)` and routed `getReasoning`, `listReasoning`'s
  per-section read, `verifyReasoning` (added beyond the plan's named list,
  see Decisions), `getReasoningFrontmatter`, `generateReasoning`'s write
  (with a TOCTOU re-assert after `mkdirSync`, sibling sections in a
  generate-all call keep working past one refused section), `setReasoningFrontmatter`
  and `mergeReasoningFrontmatter` through it. `createRun`'s runs-directory
  write asserts its parent directly (built from a generated run id, not a
  caller section, per the plan's own instruction).
- Re-ran both research probes: `docs/reviews/phase-354-probes/resources.cjs`
  now shows `room://section/linked` -> `outside:false, outsideReasoning:false`
  (previously both `true`) while `room://section/normal` still shows
  `inside:true`; `docs/reviews/phase-354-probes/persistence.cjs`'s
  `artifact-symlink-containment` line shows `writtenOutsideRoom:false`.
- All required verify commands green: `tests/test-354-room-symlink-containment.cjs`
  (10/10), `lib/memory/mcp-input-validation.test.cjs` (35/35, was 34/35
  before the walk-up fix above), `scripts/build-connector-registry.cjs --check`,
  `scripts/check-substrate.cjs --diff`, `scripts/check-render-coverage.cjs`,
  `bash tests/run-all-354.sh` (`PASSED=5 FAILED=0 SKIPPED=13`).

## Task Commits

1. **Task 1: Failing regression - symlink escape through the write tool, the SDK resource path and reasoning-ops** - `66c0e762c` (test)
2. **Task 2: One realpath-containment helper wired into safeResolveSection and fileArtifact** - `51ec7fca6` (feat)
3. **Task 3: Contain the resource read paths and every reasoning-ops read/write** - `27f1bd02e` (feat)

**Plan metadata:** pending (this commit, docs: complete plan)

## Files Created/Modified

- `lib/core/room-path-containment.cjs` - the one realpath-containment helper
  (`realRoomRoot`, `isRealpathContained`, `assertRealpathContained`,
  `writeFileContained`)
- `tests/test-354-room-symlink-containment.cjs` - 10-case regression through
  the write tool, the real SDK resource client, and reasoning-ops
- `lib/mcp/tool-router.cjs` - `safeResolveSection` now also asserts realpath
  containment
- `lib/mcp/tools/views.cjs` - `fileArtifact` refuses a symlinked section
  before any write, re-asserts after `mkdirSync`, writes through
  `writeFileContained`; `artifact_file` tool description updated
- `lib/mcp/resources.cjs` - `room-section` handler refuses a symlinked
  section and filters symlinked files out of a section's listing
- `lib/core/reasoning-ops.cjs` - new `_containedReasoningPath`, routed
  through every read and write site
- `docs/reviews/phase-354-probes/persistence.cjs` - `locks()` call wrapped
  in try/catch (see Deviations)

## Decisions Made

- Followed the plan's exact symlink policy (realpath-contained directory
  symlinks followed; escaping ones refused; leaf writes replace, never
  write through) rather than inventing an alternative.
- Extended `_containedReasoningPath` routing to `verifyReasoning` beyond the
  plan's explicitly named read sites (`getReasoning`, `listReasoning`,
  `getReasoningFrontmatter`) -- the plan's own truth statement covers "every
  reasoning-ops read and write path," and `verifyReasoning` shares the exact
  same section-to-path shape and risk. The acceptance criterion's "at least
  7" `_containedReasoningPath` grep count is satisfied at 11 (1 definition +
  10 call sites), so this addition does not conflict with the plan's stated
  floor.
- Kept `createRun`'s runs-directory write on a direct `assertRealpathContained`
  call rather than forcing it through `_containedReasoningPath`, exactly as
  the plan specified (that helper's `<section>` parameter does not fit a
  path built from a generated run id).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `isRealpathContained`/`realRoomRoot` needed
to tolerate a not-yet-existing `roomDir`, not only a not-yet-existing
destination path**
- **Found during:** Task 2 verification (`node lib/memory/mcp-input-validation.test.cjs`).
- **Issue:** The initial `realRoomRoot` implementation called
  `fs.realpathSync(roomDir)` directly. The pre-existing test
  `safeResolveSection returns roomDir/section for valid input` uses
  `roomDir = path.resolve('/tmp/room-test-87-05')`, a directory the test
  never creates on disk -- `fs.realpathSync` threw `ENOENT`, which
  `assertRealpathContained` (correctly) turned into a thrown
  `ROOM_PATH_ESCAPE`, breaking a previously-passing assertion that the plan's
  own required verify command (`node lib/memory/mcp-input-validation.test.cjs`
  exits 0, existing traversal tests unchanged) named explicitly.
- **Fix:** Extracted the existing `isRealpathContained` walk-up logic (find
  the deepest existing ancestor, resolve its realpath, rejoin the
  non-existing remainder) into a shared `resolveExistingRealpath` helper and
  used it for `roomDir` itself, not only for the target path being checked.
  A not-yet-created `roomDir` now resolves deterministically against its
  nearest existing filesystem ancestor instead of throwing.
- **Files modified:** `lib/core/room-path-containment.cjs`.
- **Verification:** re-ran the full symlink-escape sanity check (a real
  `room/research -> outside` fixture) after the fix to confirm the escape
  detection itself was unaffected by the more permissive existing-ancestor
  walk; `lib/memory/mcp-input-validation.test.cjs` went from 34/35 to 35/35.
- **Commit:** `51ec7fca6` (same commit as Task 2 -- caught and fixed before
  any commit landed with the bug present).

**2. [Rule 3 - Blocking issue] `docs/reviews/phase-354-probes/persistence.cjs`'s
`locks()` probe now throws synchronously post-354-04, aborting the two
probes after it in the same IIFE, including this plan's own required
`artifact-symlink-containment` observation**
- **Found during:** Task 3 verification (attempting to observe the
  persistence probe's `artifact-symlink-containment` line per the plan's
  acceptance criteria).
- **Issue:** 354-04 (SYS-02, landed earlier in this phase) made
  `acquireLock()` correctly refuse a takeover from a still-live owner. This
  probe's `locks()` function seeds a lock file with `foreignPid =
  process.ppid` (this process's own alive parent) specifically to exercise
  the OLD live-takeover bug; post-354-04 that same setup now makes
  `acquireLock()` throw (the fix working as intended -- 354-04-SUMMARY.md
  already documented this exact throw as "direct evidence the finding no
  longer reproduces"). The throw is synchronous and uncaught inside the
  probe's own `(async () => { ...; locks(); artifact(); gateSession(); })()`
  IIFE, so `artifact()` and `gateSession()` never ran -- blocking this
  plan's own required verification step, not a bug in `write-lock.cjs` or
  `locks()`'s own logic.
- **Fix:** Wrapped the `locks()` call in try/catch inside the probe's IIFE,
  emitting a `live-lock-takeover` observation line documenting the refusal
  instead of letting the exception propagate. `artifact()` and
  `gateSession()` now run every time the probe is invoked.
- **Scope note:** This file is not in the plan's `files_modified` list (it
  is a shared cross-plan research artifact under `docs/reviews/`, not
  production source, and not owned by any single 354 plan). The edit is
  narrowly scoped to the one throwing call site; no probe logic, assertion,
  or other probe function was touched.
- **Files modified:** `docs/reviews/phase-354-probes/persistence.cjs`.
- **Verification:** re-ran the full probe; `artifact-symlink-containment`
  now prints `writtenOutsideRoom:false` as required, and `gateSession`'s
  `wrong-session-gate-consumption` line (previously unreachable) also now
  prints. Probe exits 0.
- **Commit:** `27f1bd02e` (Task 3).

## Issues Encountered

None beyond the two auto-fixed items above (both caught and resolved before
their respective task's commit landed, so no separate fix-up commit was
needed).

## Known Stubs

None -- this plan touches only path-containment logic, resource/tool
handlers and test files; no UI or data-rendering surface.

## Threat Flags

None -- all three mitigations named in the plan's threat model are
implemented exactly as scoped:
- T-354-09 (Tampering / Information disclosure, `fileArtifact`,
  `room-section`, `reasoning-ops`): realpath containment via one helper at
  every read and write site; regression covers write, SDK read, reasoning
  read and reasoning write.
- T-354-10 (Tampering / TOCTOU, check-then-write window): re-asserted after
  `mkdirSync` in both `fileArtifact` and `generateReasoning`; writes go to a
  `'wx'` temp file in the contained parent then `rename` (no leaf follow).
  The plan's own accepted residual (a concurrent local attacker with write
  access to the room) holds unchanged.
- T-354-10b (Denial of service, legitimate inside-pointing symlinks): the
  policy follows directory symlinks whose realpath stays inside the room
  (case W3, `alias -> room/normal`, verified passing both pre- and
  post-fix).

No new network endpoint, auth path, or schema change was introduced.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- SYS-01 fully closed: this is its sole owning plan per REQUIREMENTS.md's
  SYS-01 row (confirmed before running `requirements mark-complete SYS-01`).
- Wave 3's independent-of-Wave-2 boundary held: this plan's file surface
  (`lib/core/room-path-containment.cjs`, `lib/mcp/tool-router.cjs`,
  `lib/mcp/tools/views.cjs`, `lib/mcp/resources.cjs`,
  `lib/core/reasoning-ops.cjs`, `tests/test-354-room-symlink-containment.cjs`)
  does not overlap any file touched by 354-02, 354-03 or 354-04; the only
  cross-plan interaction was the probe-script fix in Deviations item 2,
  which touches shared research tooling, not any of those plans' own
  production files.
- No new deferred items logged this plan -- every verify command that ran
  passed cleanly (after the two auto-fixes above), and no pre-existing,
  out-of-scope failing test was newly observed during this plan's
  execution.

---
*Phase: 354-system-integrity-and-theo-integration-independent-research-a*
*Completed: 2026-09-23*

## Self-Check: PASSED

All created/modified files verified present on disk
(lib/core/room-path-containment.cjs, tests/test-354-room-symlink-containment.cjs,
lib/mcp/tool-router.cjs, lib/mcp/tools/views.cjs, lib/mcp/resources.cjs,
lib/core/reasoning-ops.cjs, docs/reviews/phase-354-probes/persistence.cjs,
this SUMMARY.md). All three task commits (`66c0e762c`, `51ec7fca6`,
`27f1bd02e`) verified present in `git log --oneline --all`.
