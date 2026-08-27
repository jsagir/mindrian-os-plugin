---
phase: 270-memory-and-context-operator-mcp-consolidate-scattered-local-
plan: 02
subsystem: testing
tags: [mcp, resources, connectors, part11, red-pin]

requires: []
provides:
  - "tests/run-all-270.sh, the phase-wide test aggregator (glob discovery, Part 8 sweep, em-dash fence)"
  - "tests/test-270-resource-session-room.cjs: RED pin for the Resource boot-binding defect, greened by plan 270-05"
  - "tests/test-270-connector-coverage.cjs: RED pin for the OQ-5 born-wired gap, greened by plan 270-06"
affects: [270-05, 270-06, 270-07, 270-08, 270-09, 270-10, 270-11, 270-12]

tech-stack:
  added: []
  patterns:
    - "Phase aggregator glob discovery + found-eq-0 guard + Part 8 sweep + em-dash fence (ported from run-all-269.sh)"
    - "Stub MCP server (resources/templates/tools Maps) for driving Resource and Tool handlers without a real transport"
    - "stdio JSON-RPC spawn harness for tools/list, ported from test-234-tool-description-floor.cjs"

key-files:
  created:
    - tests/run-all-270.sh
    - tests/test-270-resource-session-room.cjs
    - tests/test-270-connector-coverage.cjs
  modified: []

key-decisions:
  - "data/mcp-tool-connectors.json entries carry surface: 'mcp:' + tool, never a bare tool field (confirmed against build-connector-registry.cjs's normalizeMcpToolEntry) -- test-270-connector-coverage.cjs derives tool names from that field instead of the plan text's literal c.tool, which would have silently broken the test's own correctness."
  - "makeRoom(label) in test-270-resource-session-room.cjs creates one real section subdirectory per room (not just STATE.md/ROOM.md) so discoverSections(roomDir) genuinely differs between rooms A and B -- without it, room-sections would read byte-identical for both rooms regardless of whether the boot-binding defect is fixed, making the leg-4 divergence assertion meaningless."

requirements-completed: [MEMOP-01, MEMOP-02, MEMOP-09]

duration: 55min
completed: 2026-08-27
---

# Phase 270 Plan 02: Wave-0 Test Aggregator and RED Pins Summary

**One phase test command (`tests/run-all-270.sh`) plus two RED pins proving the Resource boot-binding defect and the Part 11 R1 born-wired connector gap are real, with the second RED pin revealing a materially larger gap than RESEARCH.md's OQ-5 scoped.**

## Performance

- **Duration:** 55 min
- **Tasks:** 3
- **Files modified:** 3 (all new)

## Accomplishments

- `tests/run-all-270.sh`: glob discovery over `tests/test-270-*`, a hard `found -eq 0` exit guard (self-tested non-zero), a Part 8 source sweep over this phase's not-yet-created production files (asymmetric: missing targets do not fail this leg), and the em-dash fence ported from `tests/run-all-269.sh` (missing targets DO fail this leg unless `TEST_270_ALLOW_MISSING=1`).
- `tests/test-270-resource-session-room.cjs`: a stub MCP server drives `registerResources` through a ctx-mutation probe (mutate `ctx.fallbackRoomDir` without re-registering) to prove Resources are boot-bound today. Four assertions: source-grep, per-read re-resolution, the OQ-4 parity invariant between `room://state` and `room_state_bound`, and the same probe across the other six resources/templates.
- `tests/test-270-connector-coverage.cjs`: spawns the real server over stdio, drives a real `tools/list`, and cross-checks every wire tool against both connector sources (`data/mcp-tool-connectors.json` and `lib/mcp/tool-router.cjs`'s `MCP_TOOL_CONNECTORS`).
- `bash tests/run-all-270.sh` (with `TEST_270_ALLOW_MISSING=1`, matching the 269-01 precedent for a Wave-0 plan) runs to completion: `PASS=2 FAIL=2`, matching the plan's own `<verification>` expectation exactly.

## Task Commits

1. **Task 1: tests/run-all-270.sh** - `c9592750` (test)
2. **Task 2: tests/test-270-resource-session-room.cjs** - `d3f26cad` (test)
3. **Task 3: tests/test-270-connector-coverage.cjs** - `5ce8b95c` (test)

## Files Created/Modified

- `tests/run-all-270.sh` - Phase 270 aggregator
- `tests/test-270-resource-session-room.cjs` - RED pin, Resource boot-binding defect
- `tests/test-270-connector-coverage.cjs` - RED pin, OQ-5 born-wired gap

## Decisions Made

See `key-decisions` above (registry field-name correction; the section-subdirectory fixture addition). Both are necessary correctness fixes to make the test's own assertions meaningful, not scope changes to what the test proves.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan text's `declared = new Map(reg.connectors.map(c => [c.tool, c]))` does not match the real registry shape**
- **Found during:** Task 3 (tests/test-270-connector-coverage.cjs)
- **Issue:** `data/mcp-tool-connectors.json` entries carry `surface: "mcp:" + tool` (per `normalizeMcpToolEntry()` in `scripts/build-connector-registry.cjs`), never a bare `tool` field. Following the plan's literal instruction would have made `declared` a Map keyed entirely by `undefined`, making every wire tool read as "missing" instead of just the true gap.
- **Fix:** Derive tool names via `c.surface.replace(/^mcp:/, '')` for the JSON source; keep `c.tool` for the separate `tool-router.cjs` `MCP_TOOL_CONNECTORS` raw export (which does carry a bare `tool` field). Self-check asserts both sources independently declare `room_bind`.
- **Files modified:** tests/test-270-connector-coverage.cjs
- **Verification:** `node tests/test-270-connector-coverage.cjs` fails for the intended reason (a real `missing` list containing `detect_dual_path`/`extract_shallow`), not a vacuous all-tools-missing false reading.
- **Committed in:** `5ce8b95c` (Task 3 commit)

**2. [Rule 1 - Bug] makeRoom() fixture needed a real section subdirectory, not just STATE.md/ROOM.md**
- **Found during:** Task 2 (tests/test-270-resource-session-room.cjs), leg 4
- **Issue:** `discoverSections(roomDir)` reads the real filesystem. Two empty temp rooms both produce an empty section list, so `room-sections` would read byte-identical for room A and room B regardless of whether the boot-binding defect is fixed, making the required divergence assertion untestable.
- **Fix:** `makeRoom(label)` now also creates one `section-<label>/STATE.md` subdirectory per room, so `discoverSections` genuinely differs between rooms.
- **Files modified:** tests/test-270-resource-session-room.cjs
- **Verification:** Leg 1 (the earliest, most direct failure) fires first today; leg 4's design was manually traced against `lib/core/section-registry.cjs`'s `discoverSections` implementation to confirm it will differentiate once plan 270-05 lands.
- **Committed in:** `d3f26cad` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bugs in the plan's own assumptions that would have broken the RED pins' correctness). **Impact:** Both fixes are necessary for the tests to fail for the right reason rather than a vacuous or wrong reason. No scope creep -- neither touches production code.

## Issues Encountered

**A materially bigger finding than RESEARCH.md's OQ-5 scoped, flagged for the navigator, not silently absorbed into this plan's scope.** `tests/test-270-connector-coverage.cjs`'s live wire probe (36 tools, `data/mcp-tool-connectors.json` has 21 declared entries) shows the "missing connector" set today is NOT just `detect_dual_path`/`extract_shallow` -- it also includes `analysis`, `eureka_critic`, `export`, `intelligence`, `meeting`, `methodology`, `orchestration`, `room_content`, `room_graph`, `room_state`, `room-dashboard`, `room-graph`, and `room-wiki` (13 more tools), all registered inline inside `lib/mcp/tool-router.cjs`'s `registerRouterTools()` (or, for the three hyphenated room-* view tools, elsewhere) with no accompanying `connectors` export. One documented precedent exists in `tool-router.cjs` for `eureka_critic` specifically ("its governance dial is 'none', so it mints no connector descriptor ... registration on this one governed MCP path via registerRouterTools IS the Canon Part 11 wiring"), but that rationale is written for `eureka_critic` alone, not generalized to the rest of that tool family in source. This test does **not** hand-narrow an exclusion list to match RESEARCH.md's "exactly two" framing -- it asserts ground truth, and documents the full missing set in the failure detail, so a future reader sees the real scope rather than a comfortable subset. **This does not block plan 270-02's own acceptance criteria** (which only require `detect_dual_path` and `extract_shallow` to appear in the output, not that they are the *only* names present), but plan 270-06 (which is scoped to fix "the two undeclared tools") should read this note before claiming the connector-coverage test fully green, since 13 additional tools will still show up in `missing` after 270-06 lands unless the navigator decides those 13 are intentionally exempt (matching the `eureka_critic` precedent) or 270-06's scope grows to cover them.

**A pre-existing, out-of-scope, concurrent-session condition affecting `bash tests/run-all-266.sh`.** The plan's Task 3 `<acceptance_criteria>` requires `bash tests/run-all-266.sh` to still report `FAIL=0`. As of this plan's execution it reports `FAIL=1`: `node scripts/build-connector-registry.cjs --check` fails with `data/connector-coverage-ledger.json is STALE`. This is caused by the concurrently-running Phase 265 execution's own uncommitted working-tree changes to `commands/file-meeting.md` and `skills/file-meeting/SKILL.md` (present in `git status` before this plan touched anything), which shift the connector registry's source-of-truth scan out from under the committed generated ledger. This plan created zero files under `commands/`, `skills/`, `agents/`, or `lib/mcp/tools/*.cjs`'s `connectors` exports, so it cannot be the cause, and running `node scripts/build-connector-registry.cjs` to "fix" it would write into files a different, concurrently-running session is actively editing -- exactly the collision this repo's shared-working-tree convention says never to force. Left untouched; flagged here rather than silently claimed passing.

## Next Phase Readiness

- Wave 1's three autonomous plans (270-02, 270-03, 270-04) establish the phase's full Wave-0 RED baseline. `bash tests/run-all-270.sh` (with `TEST_270_ALLOW_MISSING=1` until this phase's own final gate plan) is now the one command that reports phase status.
- Plan 270-05 (Wave 2) greens `tests/test-270-resource-session-room.cjs`. Plan 270-06 (Wave 3) greens `tests/test-270-connector-coverage.cjs` -- but see the Issues Encountered note above; 270-06's scope as currently written will not fully green that test's `missing` check without a navigator ruling on the 13 additional tools.
- **Blocked separately, not by this plan:** Wave 1's plan 270-01 (the OQ-1/OQ-2 navigator decision gate) has not been answered. Plans 270-05 through 270-12 all transitively depend on it. This plan (270-02) has no dependency on 270-01 and is unaffected.

---
*Phase: 270-memory-and-context-operator-mcp-consolidate-scattered-local-*
*Completed: 2026-08-27*
