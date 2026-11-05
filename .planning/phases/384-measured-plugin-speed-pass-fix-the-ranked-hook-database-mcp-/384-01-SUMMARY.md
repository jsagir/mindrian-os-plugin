---
phase: 384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-
plan: 01
subsystem: testing
tags: [perf, harness, flock, phase-guard, verify-results]
requires:
  - phase: 381
    provides: fixture room builder and copy guard used by the harness
provides:
  - tools/perf harness on main (byte copy of 5850f067e, then reviewed and fixed)
  - phase-guard.cjs (history check for phase commits)
  - harness-review.md (BASE_SHA_384, hashes, unchanged-run exit codes, 15-row defect table)
affects: [384-02, 384-03, 384-04, 384-05, 384-06, 384-07, 384-08, 384-09]
tech-stack:
  added: []
  patterns: [per-target gate, lock check through /proc/locks, failed run kept out of the median]
key-files:
  created:
    - tools/perf/perf-harness.cjs
    - tools/perf/count-modules-preload.cjs
    - tools/perf/README.md
    - tools/perf/phase-guard.cjs
    - tests/test-384-perf-harness.cjs
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/harness-review.md
  modified: []
key-decisions:
  - "The isolation check stays strict; no sidecar exclusion (owner question Q1 open)."
  - "--allow-short also skips the gates, as in 382; --skip-gates skips only the gates. Both need MOS_PERF_SELFTEST=1."
  - "X13 (broad run-all match in the suite guard) is DROPPED: a false busy only delays a run."
requirements-completed: [PERF384-01]
duration: not recorded
completed: 2026-11-05
---

# Phase 384 Plan 01: Perf harness carry-over, review and gate fixes Summary

The 382 timing harness is on main as a byte copy of 5850f067e, reviewed by a second reader, and fixed so that gates, lock, names, failed runs and result schemas are correct, with phase-guard added.

## Commits

| Sha | Subject |
|-----|---------|
| e207f34a0 | chore(384-01): carry over the 382 perf harness unchanged from 5850f067e (provenance) |
| 40efc6aad | fix(384-01): harness gates per target, lock check, failed runs out of the median, schema rules, phase-guard |
| (this docs commit) | docs(384-01): harness review and plan summary |

BASE_SHA_384 = db2ea3b05bb70b55741bdeb40b545801b0c37cbe.

## Pristine runs on main (unchanged copy, under the 384 flock)

- pristine-selftest: exit 0 (ALL PASS).
- pristine-smoke: exit 0 (fixture room, 7 runs, floor:node 24 ms and event:SessionEnd 23.7 ms medians).
- A first smoke attempt exited 75 because a peer session ran a tests/run-all- suite. This was a host state. The recorded run is the one after the peer suite ended.
- The Task 1 verify step reproduced both exit codes (0 and 0) under the lock and passed.

## TDD record

- RED: the new self-test on the unchanged harness printed 6 FAILED (H6 and H7 from the unknown --base-sha flag, B1 schema constants, B1 base_sha twice, and a TypeError on H.defaultLockFile that stopped the later checks).
- GREEN: perf-harness: ALL PASS, 90 checks, under the lock.
- Test names that prove X1 to X5: X1 = the B1 checks (schema constants, no 382 name, --base-sha, default lock, lock override, bench folder); X2 = B2 (four gate cases) and B3 (per-target fields); X3 = B4 (classifyRun cases, exit 127 gives failed_runs 3 and n 0, exit 2 is legitimate); X4 = B6 (both flags exit 2 without MOS_PERF_SELFTEST, run minimum kept); X5 = B7 (seven requireLock unit cases, run without the lock exits 1, run under flock exits 0). B5 covers the verify-results schema rules, including a counts file with n = 3 passing and a timing file with n = 3 failing. B8 covers phase-guard (13 cases).

## Defect table result

15 rows in harness-review.md. X1 to X5, X12, X14, X15 are fixed here with tests. X6 to X11 are left to plan 384-02. X13 is DROPPED with evidence. Plan 384-02 copies the final statuses into the table.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Unknown mos.perf- schema now fails verify-results**
- **Found during:** Task 1 review (X12)
- **Issue:** After the schema rename, an old mos.perf-382/1 file would be skipped and verify-results would print OK.
- **Fix:** verify-results exits 1 for any mos.perf- schema that is not one of the four 384 schemas.
- **Files modified:** tools/perf/perf-harness.cjs; test B5 "old 382 schema".
- **Commit:** 40efc6aad

**2. [Rule 2 - Missing critical functionality] An MCP start that never replied counts as a failed run (X14)**
- **Issue:** The wall of a start with no reply would enter the median.
- **Fix:** run_class is failed when an MCP start exits without a reply.
- **Commit:** 40efc6aad

### Process notes

- The schema, spread and isolation names were all renamed to 384 (SPREAD_SCHEMA and ISOLATION_SCHEMA are new exports).
- Two small in-place edits of tools/perf/perf-harness.cjs and an append to harness-review.md were done with a node script and a shell append, not the Edit tool. No guard blocked any write. The content was reviewed through the test run and git diff.
- The first smoke attempt and a stray pkill that ended my own shell cost wait time only; no state was changed.

## C10 check (product dirty files)

- At the start: 0 dirty entries in hooks, scripts, lib, bin, package.json, npm-shrinkwrap.json, data.
- At the end: 3 dirty entries, all in lib (room-birth.cjs, room-open.cjs, startup-operations.cjs). diff against the start file is non-empty, so C10 says STATUS BLOCKED.
- Evidence that these are peer edits and not from this plan: the changes add plain-language failure text for room creation (a Phase 383 topic), the file times are 09:04:31 on 2026-11-05 while a peer was active, and this plan wrote only under tools/perf, tests/test-384-perf-harness.cjs and the phase folder (all commits touch only those paths; phase-guard exits 0). They are not staged and not touched.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema. tools/perf is not in package.json files, so it does not ship.

## Self-Check: PASSED

- Files exist: tools/perf/perf-harness.cjs, tools/perf/count-modules-preload.cjs, tools/perf/README.md (56 lines), tools/perf/phase-guard.cjs, tests/test-384-perf-harness.cjs, measurements/harness-review.md.
- Commits e207f34a0 and 40efc6aad exist in git log on main.
- phase-guard from BASE_SHA_384: OK.
