---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 04
subsystem: testing
tags: [test-scaffolding, aggregator, fixtures, wave-0, mcp-daemon, writer-inventory, playwright]

requires:
  - phase: 267-mcp-stateless-protocol-migration
    provides: the flag-ON Phase 267 server, hermeticEnv, the legacy and 2026-era client paths
provides:
  - tests/run-all-369.sh with all 42 Phase 369 legs pre-declared (written once)
  - hermetic flag-ON daemon helper (start, restart, stop, explicit legacy and auto clients)
  - fixture-room builder over wide, mid and legacy nodes schemas
  - the writer inventory as data (28 rows) reconciled against a live scan
  - the first SSE vocabulary pin
  - one shared Playwright entry for every e2e leg
affects: [369-05 through 369-32 (every later test file only adds files, never edits the leg list)]

tech-stack:
  added: []
  patterns:
    - "Aggregator written once, legs guarded by run_if on their own file (267/357 rule)"
    - "Inventory-as-data reconciled against a wide live scan; drift fails by naming the file"
    - "Explicit versionNegotiation legacy client so an SDK default change cannot move the shell onto the stateless leg"

key-files:
  created:
    - tests/run-all-369.sh
    - tests/e2e-369/lib/pw.cjs
    - tests/helpers/mcp-daemon-369.cjs
    - tests/helpers/fixture-room-369.cjs
    - tests/fixtures/369/writer-inventory.json
    - tests/test-369-sse-vocab-pin.cjs
    - tests/test-369-infra-helpers.cjs
  modified: []

key-decisions:
  - "The inventory scan counts only non-comment lines and skips test-*.cjs basenames, markdown and known non-write literals (graph-integrity-counts.cjs message string); the research regex itself is unchanged"
  - "The scan runs over whole file content, so a statement split across lines still counts"
  - "buildRoom369 puts the room at <tmpDir>/room (fixture-room-347 shape); the daemon helper passes <roomsHome>/<slug> as tmpDir and registers the resulting room path"

patterns-established:
  - "Later plans regenerate per_file_statement_counts with: node tests/test-369-infra-helpers.cjs --print-counts"
  - "Seeds in fixtures go through navigation.cjs exports only; the helper holds no raw INSERT/UPDATE/DELETE"

requirements-completed: [TS369-07]

duration: 35min
completed: 2026-10-02
---

# Phase 369 Plan 04: Verification Floor Summary

**Phase 369 aggregator written once (42 legs, 13 regression legs, long-dash guard), a hermetic flag-ON daemon harness with explicit legacy/auto clients, a three-variant fixture-room builder, and the writer inventory as 28 data rows reconciled against a live wide-regex scan.**

## Performance

- **Duration:** about 35 min
- **Tasks:** 3 of 3
- **Files created:** 7 (no existing file modified)

## Accomplishments

- `tests/run-all-369.sh`: every Phase 369 leg declared once in plan order, each `run_if` guarded on its own test file; exit 77 maps to SKIPPED (ENV GAP); 13 regression legs; a long-dash guard (U+2014 and U+2013) over all 369 tests, helpers, fixtures, e2e files and new source paths, skipping node_modules and build output.
- `tests/helpers/mcp-daemon-369.cjs`: `startDaemon` (hermeticEnv, seeded rooms, registry, port from stderr), `restartDaemon` (same hermetic env and rooms home, session binding files survive), `stopDaemon` (SIGKILL only the spawned child and a pidfile pid inside the hermetic home), `legacyClient` (`{ mode: 'legacy' }`), `autoClient` (`{ mode: 'auto' }`, negotiates 2026-07-28). Verified live: bind, restart (session file survives), auto client, clean stop.
- `tests/helpers/fixture-room-369.cjs`: `buildRoom369` over wide (16 columns), mid (12) and legacy (3) via `buildChainFixtureRoom`, optional migrate through the write door, optional seeds through navigation exports; `writeRegistry`.
- `tests/fixtures/369/writer-inventory.json`: rows N1-N5, U1-U9, E1-E6, D1-D4, P1, R1, M1, X1; per-file counts across 22 files; excluded non-graph tables with the stated reason; non-write literals; reconciliation notes.
- `tests/test-369-sse-vocab-pin.cjs`: original three kinds unchanged and in order, frozen, later kinds a prefix of `ADDITIVE_ALLOWED = ['room.changed']`, no Brain or network token in the bus code.
- `tests/e2e-369/lib/pw.cjs`: `resolvePlaywright` (spike 006 install then repo), `requirePlaywrightOrSkip` (exit 77), `launch`, `captureEgress`, `assertOnlyLoopback`.

## Task Commits

1. **Task 1: aggregator and Playwright entry** - `e41a673c0` (test)
2. **Task 2: daemon helper, fixture-room builder, SSE vocabulary pin** - `e4c4875c4` (test)
3. **Task 3: writer inventory and infra helpers smoke test** - `715fcc7ab` (test)

## Test Results

- `node tests/test-369-sse-vocab-pin.cjs`: PASS=4 FAIL=0
- `node tests/test-369-infra-helpers.cjs`: PASS=9 FAIL=0 (inventory parse, live-scan reconciliation, three variants raw and migrated, live daemon `room_bind` effective:true)
- `bash tests/run-all-369.sh`: PASS=19 FAIL=2 SKIP=35 at the time of the run. Both reds are outside this plan (see Findings).

## Findings (not caused by this plan)

1. **Regression leg `198 local only` is RED on the unchanged tree.** `tests/test-198-local-only.test.cjs` fails: `lib/mcp/tools/sensors.cjs: forbidden token 'brain-client.cjs'`. Neither file is touched by this plan or by any 369 file; `lib/mcp/sse-event-bus.cjs` itself passes the same floor (pinned in the vocab test). The leg is kept because the plan names it; it will show FAILED in the aggregator until that pre-existing red is fixed or the leg is retired by a plan that owns it (the aggregator leg list must not be edited, so a later fix lands in the test or in sensors.cjs).
2. **The long-dash guard FAILS on a peer's file.** `tests/test-369-canon-scope-docs.cjs` (peer plan, not this one) holds literal U+2014 and U+2013 characters on its lines 17-18 (`const EM = ...; const EN = ...`). The fix is the escaped form (the backslash-u escapes for U+2014 and U+2013), as that test needs the characters at run time. Reported to the caller; not edited here (shared-tree rule).

## Deviations from Plan

None in behavior. Three refinements recorded for transparency:

- **Scan refinement (Rule 3, needed to make reconciliation meaningful):** the plan's scan excludes `.test.cjs` files and `tests/`; the live scan also hit `lib/memory/test-rs-*.cjs` (test files with a `test-` basename), markdown (`lib/core/navigation/CONTEXT.md`) and about 20 comment-only lines. The inventory therefore also excludes `test-*` basenames, scans code extensions only, and does not count pure comment lines. The regex is the plan's, unchanged.
- **Unlisted writers: none.** Every code hit in the live scan maps to a RESEARCH Pattern 2 row, so no `unlisted-found-at-wave-0` row was needed. One non-writer hit (`graph-integrity-counts.cjs:145`, a string inside a message) is recorded under `non_write_hits` and subtracted by file plus text needle. One line drift: N2 `memory-events.cjs` is statement line 898 (research said 895).
- **Aggregator regression guards:** the leg count is 42 Phase 369 legs as the acceptance criterion states (the task's list enumerates the same 42).

## Known Stubs

None. (Pre-declared aggregator legs SKIP until their owning plan lands; that is by design.)

## Threat Flags

None. The daemon helper spawns on loopback only under hermeticEnv (Brain URL pointed at 127.0.0.1:9, no Brain key, no session id), rooms live under the OS temp dir, and only the spawned PID is ever killed (T-369-04-01 through -04 mitigated as planned).

## Self-Check: PASSED

- Files present: tests/run-all-369.sh, tests/e2e-369/lib/pw.cjs, tests/helpers/mcp-daemon-369.cjs, tests/helpers/fixture-room-369.cjs, tests/fixtures/369/writer-inventory.json, tests/test-369-sse-vocab-pin.cjs, tests/test-369-infra-helpers.cjs
- Commits present: e41a673c0, e4c4875c4, 715fcc7ab
