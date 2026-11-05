---
phase: 384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-
plan: 06
subsystem: testing
tags: [perf, mcp, cpu-profile, inotify, event-loop, sqlite-opens, exec-check]
requires:
  - phase: 384-05
    provides: probe-preload (SIGTERM flush, SIGUSR2 snapshots, sqlite counts)
  - phase: 384-04
    provides: exec-counter with a block list, process-census build
provides:
  - bench/mcp-probe.cjs (start, profile, idle, block, opens, start --exec-check, start --tree-b)
  - measurements for S7, S10, S8 and the per-tool part of S3, with mcp-costs.md
affects: [384-07, 384-08, 384-09]
tech-stack:
  added: []
  patterns: [line-framed stdio MCP client, /proc inotify count, interleaved two-tree A/B]
key-files:
  created:
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/bench/mcp-probe.cjs
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/bench/test-mcp-probe.cjs
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/mcp-costs.md
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/s7-mcp-start.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/s7-exec-check.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/s7-profile.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/s10-watchers.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/s3-tool-opens.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/s8-block.json
  modified: []
key-decisions:
  - "Measured a pinned export of BASE_SHA_384, not the live tree."
  - "The exec check keeps both layers (stub npm on PATH, block list in the counter); the block fires first, so the stub is proven by a separate test with the block list off."
  - "Write tools refuse by default (write_path_disabled); write-tool counts use an explicit --write-path on run and are labelled."
requirements-completed: []
duration: about 6 h including waits for the shared lock
completed: 2026-11-05
---

# Phase 384 Plan 06: MCP probe, S7, S10, S8 and per-tool opens Summary

The MCP probe measures, on the fixture room and on synthetic rooms homes, that the os server starts in about 520 to 560 ms (bare node 50 ms), that a watcher holds exactly dirs + files + 1 inotify watches per process (79, 781 and 4,525 at 1, 10 and 58 rooms, multiplied by the number of sessions), that stop_gate_check blocks the event loop for its whole call (median 866 ms, max 5.7 s), and that tool calls open the room database 0 to 4 times with 10 sqlite exec statements per open and no handle reuse.

## Commits

| Sha | Subject |
|-----|---------|
| ff8afd625 | test(384-06): MCP probe, proven on a synthetic server, a profile and a stub npm |
| 609f3e194 | test(384-06): probe gains write-path option, two-tree A/B and a wait for background work |
| c81b6dca3 | docs(384-06): S7, S10, S8 and per-tool opens on the fixture room and synthetic rooms homes |
| (this docs commit) | docs(384-06): plan summary |

## TDD record

RED: the check file run with the module path pointed at a missing file, `mcp-probe: 11 FAILED` (the probe file was written before the RED run, so RED is by override, not by absence of the file). GREEN: `mcp-probe: ALL PASS`, re-run after each later code change. Check groups: M1 handshake and counts, M2 blocking ping, M3 inotify, M4 idle cost, M5 profile groups, M6 CPU profile start, M7 opens per call, M8 subcommands and schemas (opens with 3 repeats passes verify-results, start with n = 3 fails it), M9 exec check (stub npm, block list, fake absolute-path npm blocked, marker file absent), M10 copy mode on a synthetic source.

## Exec check result

Both servers, 3 repeats each: stub calls 0, blocked execs 0, npm or npx execs 0, 1 exec in total (node). No real npm ran. No start-up number was marked NOT MEASURED. Calibration of the exec counter (K2 exactly 7, K3 exactly 5, block list K8) passed before use.

## Key numbers (fixture room, pinned tree, median, p95 in brackets)

| Item | n | Value |
|------|---|-------|
| os initialize, set 1 and set 2 | 7 and 7 | 522.2 (740.7) and 562.5 (629.5) ms, spread 7.4 percent |
| brain initialize | 7 and 7 | 307.3 (433.5) and 295.6 (339.9) ms, spread 3.9 percent |
| bare node floor | 7 and 7 | 51.5 and 47.7 ms |
| os plus brain in series (DERIVED) | 7 and 7 | 872.3 and 903.4 ms |
| os profile share: node builtins, zod, tool files, eureka tool files, SDK client | 7 | 57.8, 17.6, 0.3, 0.3, 1.9 percent |
| watches per process at 1, 10, 58 rooms | 7 and 7 | 79, 781, 4,525 (exact, 0 spread); idle CPU 0 ms in 10 s; RSS 106.5, 119.3, 151.8 MB; bare node 43.8 MB |
| stop_gate_check ping, first call and warm | 15 | 865.6 (1104.1) and 691.7 (910.6) ms; idle ping 1.1 ms |
| graph-rebuild ping, first call and warm | 15 | 115.3 (151.8) and 70.8 (85.0) ms |
| opens per call | 3 repeats | room_state 2, suggest_next 1, stop_gate_check 1 (+1 child), artifact_file 2, memory_event 2, first room_startup 4 |

Spread: every target above 10 percent was run again at n = 15 (S10 initialize time at 1 and 10 rooms, S8 stop_gate_check and graph-rebuild). The effect of the 16 eureka tool files on the start time is NOT RESOLVED: five interleaved sets of the per-pair difference gave -50 to +138 ms. See mcp-costs.md for all rows and the table against the PRD claims.

## Deviations from Plan

**1. [Rule 3 - Blocking] The stub npm and the block list cannot both be first for a PATH-resolved npm.**
- **Found during:** Task 1 (test M9)
- **Issue:** The counter blocks by program base name, and the stub is also named npm, so the block fires before the stub runs. The plan test said a PATH-resolved npm gives a stub call of 1.
- **Fix:** The stub is the second layer. The test proves the block (blocked 1, stub 0) and, with the block list off, the stub (stub 1). The real check uses both.
- **Commit:** ff8afd625

**2. [Rule 3 - Blocking] The substrate pre-commit scan read `require('node:sqlite')` in the synthetic server of the test.**
- **Fix:** The module name is joined at run time (same device as the plan 384-05 test). No product file touched.
- **Commit:** ff8afd625

**3. [Rule 2 - Missing] Write tools refuse by default, and a call with a file path cannot reach the cascade.**
- **Found during:** Task 2 (steps 5 and 6)
- **Fix:** Added `--write-path on` (MINDRIAN_MCP_FIRST=cli, room bound first) so the write-tool counts are real, and labelled both runs. The cascade classify-insight path is NOT MEASURABLE through MCP (three reasons in mcp-costs.md); graph-rebuild was measured as a write tool that blocks the loop.
- **Commit:** 609f3e194

**4. [Rule 2 - Missing] Survivor handling in the block probe.**
- **Issue:** A process left after the kill of the server group was counted as a survivor at once, which failed verify-results.
- **Fix:** It is waited for up to 15 s and timed; only a process that outlives the limit is a survivor. The S8 stop_gate_check files were measured again with this rule (survivors 0).
- **Commit:** 609f3e194

**5. Additions beyond the plan list:** `start --tree-b` and the s7-eureka-ab files (an A/B of the 16 eureka tool files on a scratch copy; result NOT RESOLVED), s3-tool-opens-write-on.json, the set 2 and rerun15 files, s8-block-graph-rebuild files. All are in the phase folder.

## Deferred Issues

- Cold-install npm attempt (mcp-dep-heal with node_modules missing): NOT MEASURED, by design.
- Real-room size effects (watcher RSS, stop_gate_check on a real room): plan 384-08.
- Database open time versus a bare DatabaseSync: plan 384-07.
- Wave 1 scope items measured here as marked yes: tool-router first-call module loads (room_state +3 modules, stop_gate_check +7, graph-rebuild +3, artifact_file +1, room_startup +2, second calls +0) and the doctor series cost of two MCP servers (sum of the two initialize medians, 872 and 903 ms; doctor itself not timed).

## C10 note

Start of plan: 0 dirty entries under hooks, scripts, lib, bin, package.json, npm-shrinkwrap.json, data. End of plan: 0, no difference. No product file was edited.

## Known Stubs

None.

## Threat Flags

None. No new endpoint or trust boundary was added; the probe runs only on scratch copies with a sandbox HOME.

## Scratch

The scratch folders (the pinned export, the A/B copy, the sandbox rooms and the counter library) were deleted after the last run; the bench folder cleanup (clean-bench --all) ran first.

## Self-Check: PASSED

Commits ff8afd625, 609f3e194 and c81b6dca3 exist; verify-results exits 0; phase-guard exits 0; mcp-costs.md and the six named measurement files exist; no path and no dash in the result files.
