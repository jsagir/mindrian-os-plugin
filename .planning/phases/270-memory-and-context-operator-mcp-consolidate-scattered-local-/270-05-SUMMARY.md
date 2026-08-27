---
phase: 270-memory-and-context-operator-mcp-consolidate-scattered-local-
plan: 05
subsystem: mcp
tags: [resources, session-room, part8, bugfix]

requires:
  - phase: 270-02
    provides: "tests/test-270-resource-session-room.cjs, the RED pin this plan greens"
provides:
  - "registerResources(server, ctx) with per-read session-room resolution for all seven Resources"
  - "the Resource/Tool room-resolution parity fix (RESEARCH.md 3.4d)"
affects: [270-06, 270-08, 270-09, 270-10, 270-11, 270-12]

tech-stack:
  added: []
  patterns:
    - "resolveRoom(extra) module-local helper: the ONE per-read resolution point in a tool/resource module, reusing resolveSessionRoomDir + resolveEffectiveSessionId exactly as Tools do"

key-files:
  created: []
  modified:
    - lib/mcp/resources.cjs
    - bin/mindrian-mcp-server.cjs
    - tests/test-270-resource-session-room.cjs

key-decisions:
  - "registerResources accepts both a bare string (back-compat, one release) and the ctx object shape, normalized at the top of the function."
  - "registerPrompts, registerCapabilities, and the roomDir definition itself remain boot-bound -- a real, remaining inconsistency, recorded as a named out-of-scope follow-up per the plan's own instruction, not silently fixed here."

requirements-completed: [MEMOP-02]

duration: 50min
completed: 2026-08-27
---

# Phase 270 Plan 05: Resource Boot-Binding Fix Summary

**`lib/mcp/resources.cjs` now resolves the room per read through the same MCP resolver every Tool already uses, closing the live defect where `room://state` and `room_state_bound` disagreed about which room a session was in after `room_bind`. A real, unrelated test-isolation bug (leaking the developer machine's actual active room into the fixture) was found and fixed along the way.**

## Performance

- **Duration:** 50 min
- **Tasks:** 2
- **Files modified:** 3 (2 production, 1 test fix)

## Accomplishments

- `lib/mcp/resources.cjs`: signature changed to `registerResources(server, ctx)`, all seven registrations (`room-state`, `room-sections`, `room-section` static+list, `room-meetings`, `room-intelligence`, `reasoning-state`, `reasoning-section`) now call a single `resolveRoom(extra)` helper as the first line of their handler body. `tests/test-248-resolver-census.cjs` confirms no second resolver was minted.
- `bin/mindrian-mcp-server.cjs`: the `registerResources(s, roomDir)` call site now passes the exact ctx shape `lib/mcp/tool-router.cjs:1863` builds for Tools (`{ fallbackRoomDir, pluginRoot, surface }`), key-for-key. Diff is surgical: 3 insertions, 2 deletions.
- `tests/test-270-resource-session-room.cjs` (plan 270-02) now passes all 4 legs, closing the phase's first RED pin.
- **Found and fixed a real bug while verifying**: the test was leaking the developer machine's actual actively-bound room (a real room registered under `~/MindrianRooms`) into the fixture, because `resolveSessionRoom`'s `reg.active` leg outranks `ctx.fallbackRoomDir` and the test never isolated `MINDRIAN_ROOMS_HOME`. Fixed with a temp-dir override, restored in the existing `finally` block.

## Task Commits

1. **Task 1: lib/mcp/resources.cjs per-read seam** - `1f498af1` (fix)
2. **Task 2: bin/mindrian-mcp-server.cjs ctx-shaped call site** - `63782dd1` (fix)

**Ancillary fix (discovered during Task 2 verification, committed separately for clean history):** `dc783a0f` (fix) - MINDRIAN_ROOMS_HOME isolation in the plan 270-02 test file.

## Files Created/Modified

- `lib/mcp/resources.cjs` - per-read session-room resolution
- `bin/mindrian-mcp-server.cjs` - ctx-shaped registerResources call site
- `tests/test-270-resource-session-room.cjs` - isolation fix (not this plan's own file, but required to actually verify this plan's fix)

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, found during verification] test-270-resource-session-room.cjs leaked the real machine's active room registration**
- **Found during:** Task 2, running the plan's own `<verify>` command
- **Issue:** `resolveSessionRoom`'s floor order is `session.primary -> reg.active -> ctx.fallbackRoomDir -> process.cwd()`. The test seeded no `session.primary` and never isolated `MINDRIAN_ROOMS_HOME`, so leg B (`reg.active`) found this developer machine's REAL actively-bound room (`launchpad-02`) and returned its STATE.md instead of the fixture's. This was a silent false-fail (leg 2 failed with unexpected content) that would have equally been a silent FALSE PASS on a machine with no active room, or on CI -- either way not testing what it claimed to test.
- **Fix:** Override `process.env.MINDRIAN_ROOMS_HOME` to an empty `fs.mkdtempSync` directory for the duration of the fixture, restored in the existing `finally` block.
- **Files modified:** tests/test-270-resource-session-room.cjs
- **Verification:** All 4 legs pass deterministically regardless of the developer machine's real room state.
- **Committed in:** `dc783a0f` (separate commit, since it corrects plan 270-02's own artifact, not this plan's)

**2. [Rule 1 - Correction] Comment above the ctx-shaped call site trimmed to stay within the diff-size acceptance criterion**
- **Found during:** Task 2, checking `git diff --stat`
- **Issue:** An initial 4-line comment (vs. the plan's specified "two-line comment") pushed the diff to 6 insertions, exceeding the plan's own "at most 5 insertions" acceptance criterion.
- **Fix:** Condensed to a genuinely 2-line comment carrying the same substance (plan number, RESEARCH.md citation, the `ctx.fallbackRoomDir` framing).
- **Files modified:** bin/mindrian-mcp-server.cjs
- **Verification:** `git diff --stat bin/mindrian-mcp-server.cjs` now shows 3 insertions, 2 deletions.
- **Committed in:** `63782dd1`

---

**Total deviations:** 2 auto-fixed (1 real test-isolation bug found during verification, 1 diff-size correction). **Impact:** Both necessary; neither changes what the plan set out to prove or fix. No scope creep.

## Issues Encountered

None beyond the two deviations above.

## Next Phase Readiness

- Wave 2's second plan (270-07, `discoverIcmForest`) can proceed independently (depends on 270-01 and 270-03, both already complete).
- Plan 270-06 (Wave 3) depends on this plan and 270-02, and is now unblocked.
- `bash tests/run-all-270.sh` reports `FAIL=7` (down from 8 at the end of Wave 1), matching the plan's own `<verification>` prediction exactly.

---
*Phase: 270-memory-and-context-operator-mcp-consolidate-scattered-local-*
*Completed: 2026-08-27*
