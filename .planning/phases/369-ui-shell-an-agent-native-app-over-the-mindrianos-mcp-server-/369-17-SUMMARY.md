---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 17
subsystem: mcp-sse
tags: [sse, wake-up, watcher, cross-process, d-18]
requires: [369-04, 369-13]
provides:
  - "room.changed SSE kind {roomId, latestSeq}, appended to EVENT_KINDS"
  - "lib/mcp/room-watcher.cjs (ensureWatching, stopWatching, stopAll, _state)"
affects: [ui/shared feed relay (369-08) wake-up consumer]
tech-stack:
  patterns: ["fs.watch + PRAGMA data_version gate on one long-lived read-only handle + 500 ms poll net"]
key-files:
  created: [lib/mcp/room-watcher.cjs, tests/test-369-sse-room-changed.cjs]
  modified: [lib/mcp/sse-event-bus.cjs, lib/mcp/tools/feed.cjs]
key-decisions:
  - "Watcher publishes only when data_version moved AND latest change_seq advanced; a seq going backwards (log rebuilt) is tracked silently, the shell learns the new epoch through room_changes."
  - "roomId falls back to the room dir when the slug is null, so a watcher always has a key."
requirements-completed: [FEED369-03, FEED369-05]
metrics:
  tasks: 2
  files: 4
completed: 2026-10-03
---

# Phase 369 Plan 17: room.changed wake-up and daemon-side room watcher Summary

Any process that commits to a watched room now wakes every `/event` subscriber with a content-free `room.changed {roomId, latestSeq}` hint, in tens of milliseconds, via a daemon-side watcher started by the first `room_changes` call.

## What was built

- `lib/mcp/sse-event-bus.cjs`: `room.changed` appended as the fourth kind (first three unchanged, in order); one header line added. The pin test and the Part 8 token scan on the bus pass.
- `lib/mcp/room-watcher.cjs` (about 160 lines): one read-only handle per room via `navigation.openRoomDbReadOnlyForCaller`; `fs.watch(<room>/.mindrian, { persistent: false })` filtered to `room.db*`, debounced 25 ms; 500 ms unref'd `setInterval` poll net; `check()` reads `readDataVersion` on the same handle and, when it moved, `readLatestSeq`, publishing only if the seq advanced. Idle window default 10 minutes (the poll drops an idle watcher). Any error drops the watcher; nothing throws. Requires only node:fs, node:path, navigation.cjs, sse-event-bus.cjs.
- `lib/mcp/tools/feed.cjs`: `ensureWatching({ roomId, roomDir })` called after the room resolves and before the read, lazy require inside try/catch; the room_changes answer is unaffected.

## Verification

- `node tests/test-369-sse-room-changed.cjs`: 7/7 PASS, stable across 4 runs. Measured latency (child spawn + commit + wake-up): 63 ms cross-process, 64 ms over the live daemon `/event`; the wake-up frame arrived before the child process exited, so the 25 ms debounce is well inside the budget.
- `node tests/test-369-room-changes.cjs`: 11/11 PASS. `node tests/test-267-mcpv2-flag-on.cjs`: 6/6 PASS. `node tests/test-369-sse-vocab-pin.cjs`: 4/4 PASS.
- `node tests/test-276-tool-honesty-findings-closed.cjs`: 148/148. `node scripts/check-tool-honesty.cjs --check`: OK, 44 tools, 138 branches, 0 high-risk. `node scripts/build-connector-registry.cjs --check`: exit 0.
- Tool-honesty fixture `276-dispositions.json` NOT touched: the feed.cjs edit did not move the live branch count (138 before and after). No MCP tool description or inputSchema changed, so the wire snapshot is untouched.
- No em-dash or en-dash in any touched file.

## Deviations from Plan

None in code. One verification note:

**Pre-existing failure, out of scope:** `node tests/test-198-local-only.test.cjs` exits non-zero because `lib/mcp/tools/sensors.cjs` (committed, untouched by this plan, comments at lines 44, 239, 242) contains the literal `brain-client.cjs`, which the test's token scan forbids. The scan of the files this plan touches is clean (`sse-event-bus.cjs` is in its module list and passes via the pin test's own Part 8 arm). It is not caused by plan 17; Phase 364 sensors work or a later cleanup should fix the comment wording or the allow-list.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-369-17-01 asserted by arm 6 (key set is exactly roomId and latestSeq); T-369-17-03 by arm 5 and the non-persistent watch plus unref'd timer; T-369-17-04 by the static arm (no room-db or node:sqlite require).

## Commits

- 4ff615eef feat(369-17): room.changed SSE kind and daemon-side room watcher
- ea787ccf6 test(369-17): room.changed vocabulary, cross-process wake-up, idle stop, live /event

## Self-Check: PASSED

Files exist (room-watcher.cjs, test-369-sse-room-changed.cjs); both commits are on main.
