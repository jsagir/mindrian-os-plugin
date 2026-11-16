---
phase: 395-selection-by-job
plan: 12
subsystem: mcp-router
tags: [room-isolation, session-binding, mcp]
requires: [395-10, 395-11]
provides: [resolveToolRoomDir per-call room for 8 router tools]
affects: [lib/mcp/tool-router.cjs, tests/run-all-395.sh]
key-files:
  created: [tests/test-395-room-isolation.cjs]
  modified: [lib/mcp/tool-router.cjs, tests/run-all-395.sh]
decisions:
  - "A bound session (session.primary) gets its bound room in the 8 router tools; an unbound session keeps the boot-time room (no reg.active fallback, assumption A3)."
metrics:
  completed: 2026-11-16
  tasks: 1
  files: 3
---

# 395-12 Summary: the router tools read the session's bound room

Date: 2026-11-16. Base `723bbe9f8` (contains `74fda0093`). Code commit `4c40d11f9`.

## What changed

* `lib/mcp/tool-router.cjs`: new helper `resolveToolRoomDir(extra, bootRoomDir, surface)`. It calls the same resolver as `room_state` (`sessionRoom.resolveMcpSessionRoom`). A `session.primary` hit returns the bound room; any other result returns the boot-time room. `registerRouterTools` keeps the boot-time value as `bootRoomDir`. The 8 handlers `room_content`, `room_graph`, `methodology`, `analysis`, `intelligence`, `meeting`, `export`, `orchestration` declare a per-call `const roomDir` as their first line. `room_graph`, `methodology`, `analysis` and `export` now take `extra` as the second parameter.
* `tests/test-395-room-isolation.cjs` (new, 12 arms I1 to I12) and its name in `tests/run-all-395.sh`.
* No change to reply text. No new egress (local binding file and registry only).

All 11 changes applied by script from the plan text; each Find text matched exactly 1 time. The per-call line sits in the correct handler for each of the 8 tools (PROVEN by registration line lookup).

## The test file left by the dead session

`tests/test-395-room-isolation.cjs` (untracked, written 04:47) is byte-identical to the "New file 1 of 1" text of the plan (PROVEN by `diff` against the extracted fence). Kept without change. Preconditions P4 and P6 reported only this file; all other preconditions passed.

## What ran

Each command ran alone, in a fresh `mktemp -d` HOME under the scratchpad, Brain URL on a closed port, no key, `< /dev/null`.

* `node tests/test-395-room-isolation.cjs`: 12 passed, 0 failed, exit 0.
* `bash tests/run-all-395.sh`: exit 0; last line `tests/test-395-room-isolation.cjs: PASSED`.
* Exit 0: test-tool-router-active-room-misroute, test-tool-router-grouped-reference, test-room-state-active-room-misroute, test-36925-rft-binding (7/7), test-36925-rid-binding (40/40), test-248-resolver-census (4/4), test-248-room-bind-session-authoritative (6/6), test-198-concurrency-mcp, test-198-flag-off-parity, test-276-room-content-honesty (26), test-276-meeting-gate-wiring (14), test-276-orchestration-scout-honesty (12), test-kwl-meeting-mcp-honesty (37), test-intelligence-research-pipeline, test-314-mcp (53), test-366-router-redirects (29), test-234-tool-description-floor (316), test-270-tool-schema-budget (5), check-tool-honesty --check, build-connector-registry --check, build-orchestration-projection --check, check-render-coverage (195 wired, 0 unwired), run-harness --check (12 pass, 0 fail in the git tree).
* Exit 1, baseline: `tests/test-347-visualize-real-chain.cjs` (arm "Task 2 Test 7: safeResolveSection ..."), listed in the baseline file and in plan section 7.2.
* No em dash or en dash in the 3 files (grep prints nothing).

## Deviations from Plan

### Environment finding (no code change)

**1. [Rule 3 - test environment] Host session id leaks into a router test**
- **Found during:** verification, first run.
- **Issue:** `tests/test-tool-router-active-room-misroute.cjs` arm "file-opportunity writes to the mid-session active room (B)" failed (exit 1) both after the change AND on an untouched `git archive HEAD` copy. Root cause (PROVEN): the executor shell inherits `CLAUDE_CODE_SESSION_ID` from the host Claude Code session. The test does not clear it, so the write ladder takes that unbound session id and the registry `active` leg does not decide the write.
- **Fix:** the verification runner unsets `CLAUDE_CODE_SESSION_ID`, `MINDRIAN_ACTIVE_SESSION_ID`, `CLAUDE_ACTIVE_ROOM` and `MINDRIAN_ROOM`. With that, the test passes on HEAD and after this plan. No repository file changed for this.
- **Follow-up:** the test can `delete process.env.CLAUDE_CODE_SESSION_ID` at start (as `test-395-room-isolation.cjs` does). Not done here (plan rule: do not edit an existing test).

### Instruction override

* The plan says "Do not commit". The caller instructed per-file commits with `git commit --only`; the caller instruction was followed.

## Known limits (from the plan, unchanged)

* L1: an unbound session still reads the boot-time room in the 8 tools, with no note in the reply.
* L2: MCP prompts (`lib/mcp/prompts.cjs`) still read the boot-time room.
* L3: `orchestration` `act` and `act-chain` now write the pipeline chain into the bound room (intended).
* L4: the `.room-root` cwd leg is not a source of `resolveToolRoomDir`.
* Reports 2 (`references` has no section job) and 3 (stale `room_state status` after `artifact_file`) are recorded in the plan for later plans; no change here.

## Not run

* The end-to-end stdio server run of plan section 14 (the plan rule forbids starting an MCP server outside `$T`; the in-process test covers the same handlers).
* Windows and macOS.

## Self-Check: PASSED

* FOUND: tests/test-395-room-isolation.cjs, lib/mcp/tool-router.cjs (helper at line 139), tests/run-all-395.sh (new name in the `for` list).
* FOUND: commit 4c40d11f9 on `work/395-selection-by-job`.
