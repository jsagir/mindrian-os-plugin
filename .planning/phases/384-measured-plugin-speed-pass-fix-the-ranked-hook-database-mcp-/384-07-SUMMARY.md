---
phase: 384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-
plan: 07
subsystem: testing
tags: [perf, sqlite, room-db, openRoomDb, session-start, S3]
requires:
  - phase: 384-05
    provides: probe-preload (sqlite constructed, exec and prepare counts)
  - phase: 384-06
    provides: s3-tool-opens.json (opens per MCP tool call)
provides:
  - bench/db-open-bench.cjs (run, session-opens)
  - measurements for S3 on the fixture room with db-costs.md
affects: [384-08, 384-09]
tech-stack:
  added: []
  patterns: [interleaved A B, B A rounds with a third audit-off target, 3-decimal statistic next to the harness 0.1 ms one, leading-keyword statement tally]
key-files:
  created:
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/bench/db-open-bench.cjs
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/bench/test-db-open-bench.cjs
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/db-costs.md
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/s3-open-vs-bare.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/s3-open-vs-bare-set2.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/s3-open-vs-bare-rerun15.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/s3-session-opens.json
  modified: []
key-decisions:
  - "Measured a pinned export of BASE_SHA_384, not the live tree."
  - "Added a third target (open with the bypass audit off, by its own environment variable) to split the audit cost; result: NOT RESOLVED on this host."
  - "Added wall_ms_fine (3 decimals) because the harness rounds to 0.1 ms and a bare open takes 0.03 to 0.3 ms."
  - "Counts of the open are embedded in the timing file (open_counts); no extra file outside the plan list."
requirements-completed: []
completed: 2026-11-05
---

# Phase 384 Plan 07: database open bench, S3 Summary

One openRoomDb costs about 6.0 ms cold and 1.16 ms warm against 0.24 ms and 0.035 ms for a bare DatabaseSync (fixture room, n 15), runs 20 exec and 15 prepare calls every time with no handle reuse, and a SessionStart makes 12 database opens of which 4 run that chain.

## Commits

| Sha | Subject |
|-----|---------|
| 447197cb7 | test(384-07): database open bench, proven on a temporary room folder |
| 388b676ce | test(384-07): bench writes a 3-decimal statistic and a statement tally per open |
| f33750aa3 | docs(384-07): S3 database open versus bare and opens per SessionStart on the fixture room |
| (this docs commit) | docs(384-07): plan summary |

## TDD record

RED: `db-open-bench: 1 FAILED` (D0, the bench file did not exist). GREEN: `db-open-bench: ALL PASS`, run again after the second commit. Check groups: D1 interleave order (AB, BA, AB...), the timed child on a temporary room folder made by openRoomDb, a full run on the fixture room (targets, n of 7 or more, counting run, statement tally, 3-decimal statistic); D2 usage exit 2, --skip-gates refused without MOS_PERF_SELFTEST, session-opens with 3 repeats; D3 both schemas accepted by verify-results; D4 copy mode on a synthetic source folder, no path in any output.

## Key numbers (fixture room, pinned tree; median, p95 in brackets; DIRECT unless marked)

| Item | n | Value |
|------|---|-------|
| cold open, set 1 and set 2 | 7 and 7 | 6.157 (8.498) and 6.228 (8.586) ms, spread 1.1 percent |
| cold open, rerun | 15 | 5.965 (9.605) ms |
| cold bare open, rerun | 15 | 0.236 (0.377) ms (sets: 0.259 and 0.296, spread 13.3 percent) |
| warm open, set 1 and set 2 | 7 and 7 | 1.043 (1.202) and 1.021 (1.903) ms, spread 2.1 percent |
| warm open, rerun | 15 | 1.157 (2.038) ms |
| warm bare open, rerun | 15 | 0.035 (0.080) ms (sets: 0.046 and 0.032, spread 35.9 percent, resolution limit) |
| open minus bare per round, cold and warm (DERIVED) | 15 | 5.728 and 1.126 ms |
| exec and prepare calls per open, existing database | 3 repeats | 20 and 15 (14 of the exec calls start with CREATE) |
| exec and prepare calls, new database | 3 repeats | 84 and 32 |
| opens per SessionStart | 3 runs, agree | 12 (4 run the chain: 80 of 83 exec calls) |
| cost per SessionStart (DERIVED) | | 25.7 to 71.6 ms serial, under 1 percent of the plan 384-04 blocking wall |

Spread: every target above 10 percent was run again once at n = 15. The caller-audit share (open against open with MINDRIAN_DISABLE_BYPASS_AUDIT=1) is NOT RESOLVED: the sign of the difference changes between sets (-7.3 to +6.5 ms cold at n 15).

## Deviations from Plan

**1. [Rule 2 - Missing critical measurement] Resolution of the harness statistic.**
- **Found during:** Task 2 (first run)
- **Issue:** the harness rounds a statistic to 0.1 ms; the warm bare open (0.03 ms) showed as 0 ms.
- **Fix:** bench writes `wall_ms_fine` (3 decimals, same median and p95 rules) next to `wall_ms`; the tables use it. The first run was discarded and redone after the change (commit 388b676ce).
- **Files modified:** bench/db-open-bench.cjs, bench/test-db-open-bench.cjs

**2. [Rule 2 - Missing critical measurement] Statement kinds and the audit split.**
- **Found during:** Task 2 (an investigation run showed 20 exec calls per open, not the 10 per open that plan 384-06 wrote)
- **Fix:** added a keyword tally child (leading keyword only, no SQL text) and the third target with the audit switched off. The plan 384-06 figure of 10 is the average of one chain open and one non-chain open per call; stated in db-costs.md.

**3. Two extra result files.** s3-open-vs-bare-set2.json (set 2) and s3-open-vs-bare-rerun15.json (the n 15 rerun) are not in the plan file list; the plan requires two sets and a rerun, and plan 384-06 used the same file naming.

## Notes

- Fixture room only. The open on a real room.db and the opens of a real-room SessionStart are plan 384-08. Q1 (shm sidecar rule) stays open; the isolation check is strict.
- `SessionStart:startup:unchanged` never takes the unchanged path in the fixture room (same as plan 384-04); the opens on the reuse path are NOT MEASURED.
- verify-results exits 0 on the measurements folder in this run (plan 384-04 subagent-files.json did not fail it here).
- C10: the start and end lists of dirty product paths were both empty (0 entries); no peer-dirty product file touched.
- The scratch folders (pinned export and room builds, and the C10 notes) were deleted. phase-guard: OK.
- The module load time of room-db.cjs and its dependencies is NOT MEASURED (the clock starts after the requires).

## Known Stubs

None.

## Threat Flags

None. The bench opens only scratch rooms; result files hold counts, timings and script base names.

## Self-Check: PASSED

Files found: bench/db-open-bench.cjs, bench/test-db-open-bench.cjs, measurements/db-costs.md, s3-open-vs-bare.json, s3-open-vs-bare-set2.json, s3-open-vs-bare-rerun15.json, s3-session-opens.json. Commits found: 447197cb7, 388b676ce, f33750aa3.
