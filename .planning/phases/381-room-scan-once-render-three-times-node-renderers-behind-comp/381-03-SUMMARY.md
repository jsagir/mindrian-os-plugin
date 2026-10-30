---
phase: 381-room-scan-once-render-three-times-node-renderers-behind-comp
plan: 03
subsystem: infra
tags: [room-scan, bash-compat, byte-parity, fs-promises, bounded-pool, node]
requires:
  - phase: 381-01
    provides: BASE_SHA oracle (tests/helpers/oracle-381.cjs), edge room and large-room builders, run-all-381.sh
provides:
  - lib/core/room-scan.cjs with the bounded async room snapshot and every bash-semantics helper the renderers need
  - Unit tests that prove each helper against the live bash, sort, xargs, date, python3, grep and find on this host
affects: [381-04, 381-05, 381-06, 381-07, 381-08, 381-09]
tech-stack:
  added: []
  patterns: [expected values from live tools, constant bash program plus argv or file, bounded pool per stage, wrap fs.promises before require]
key-files:
  created:
    - lib/core/room-scan.cjs
    - tests/test-381-bash-assoc.cjs
    - tests/test-381-bash-dialect.cjs
    - tests/test-381-date-tz-matrix.cjs
    - tests/test-381-room-scan.cjs
    - tests/helpers/live-381.cjs
  modified: []
key-decisions:
  - "globDirs sorts by the printed path (name plus trailing slash), because live bash does; sorting by bare name was wrong."
  - "isGrepWordChar uses Alphabetic plus Nd plus underscore, not L plus N plus underscore."
  - "The full TZ matrix of dateDToEpoch lives in its own test file so the dialect quick run stays near 3.5 s."
requirements-completed: [PERF381-03, PERF381-04, PERF381-08]
duration: ~40min
completed: 2026-10-29
---

# Phase 381 Plan 03: room-scan.cjs with proven bash-semantics helpers Summary

One bounded async room snapshot (fan-out 32, byte-ordered, no symlink recursion) plus BashAssoc hash order, the sed/grep frontmatter dialect, read, sort, xargs, date, test and grep word-char emulation, each compared with the live tool; 198 test legs pass.

## Commits

| Step | Commit | Message |
|------|--------|---------|
| Task 1 RED | `8b4f6b209` | test(381-03): add failing tests for the room-scan bash-semantics helpers |
| Task 1 GREEN | `9a1794496` | feat(381-03): add room-scan bash-semantics helpers proven against live bash |
| Task 2 RED | `a5ad3a51c` | test(381-03): add failing tests for the bounded async room scan |
| Task 2 GREEN | `f6d1f6550` | feat(381-03): add the bounded async room scan with byte-ordered results |

Gate re-check (Task 1 Step 0): BASE_SHA `65aaf329f9c514c71fff2f1a530cd366c0b87b66` is an ancestor of HEAD; `5a2dcfd4d` is an ancestor of BASE_SHA; `grep -nF "strptime('$datestr'"` on both scripts printed nothing. PROVEN.

## Accomplishments

- `lib/core/room-scan.cjs` exports all 27 names of the plan plus `BASH_SIGNED_CHAR`. It is `.cjs`, requires only `node:fs`, `node:util` and `node:child_process`, holds no network module and no gray-matter or js-yaml. The header carries the Part 7 reuse justification, Part 8, Part 11 and rulings 1, 2, 3, 7.
- `BashAssoc` order equals live bash for 100, 2047, 2048, 2049, 5000, 8191, 8192, 8193 and 9000 keys, UTF-8 keys, keys with separators and an update case. Assumption A1 is checked by deriving the host char signedness from live bash.
- The frontmatter dialect (`bashFmLines`, `bashField`) equals the `sed | head -50 | grep | head -1 | sed` pipeline on 20 generated files x 12 keys (CRLF, body rule, frontmatter after line 1, head -50 cut, lookalike fences, nested keys).
- `dateDToEpoch` runs the exact post-u8x chain (`date -d`, `date -j -f`, `python3 -c DATE_PY_PROGRAM value` for shape-valid values only), memoized per (value, TZ). It equals the BASE_SHA bash function for 26 values x 7 TZ values, including the DST-gap dates and years 0001 to 0099; the u8x payloads give 0 and leave no marker file on either side.
- `scanRoom` reads with at most 32 concurrent `fs.promises` operations (observed maximum 32 on 200 section files) and returns byte-ordered results under random 0-5 ms delays.

## Measured results (this host: arm64, bash 5.2.21, GNU sort 9.4, xargs 4.9.0, grep 3.11, node v22.23.1)

| Command (all run with `nice -n 19 ionice -c3`) | Wall | Result |
|---|---|---|
| `node tests/test-381-bash-assoc.cjs` | 0.49 s | 14 ok, 0 not ok; first line `arch=arm64 BASH_SIGNED_CHAR=false` |
| `node tests/test-381-bash-dialect.cjs` (quick run) | 3.51 s | 162 ok, 0 not ok |
| `node tests/test-381-room-scan.cjs` | 0.70 s | 15 ok, 0 not ok; observed max in-flight 32 |
| `node tests/test-381-date-tz-matrix.cjs` (full TZ matrix) | 4.32 s | 7 ok, 0 not ok |
| `node tests/test-369-hook-require-graph.cjs` | under 1 s | 5 passed, 0 failed |
| `bash tests/run-all-381.sh` (all 5 test files, Part 8 sweep, dash fence) | 59.6 s, of which test-381-parity is about 45 s | PASS=7 FAIL=0 SKIP=0, exit 0 |

Live bash on this host hashes with an unsigned char (arm64). The x86 signed-char branch is unverified here; the assoc test must run on the release machine before the cut (ruling 7, assumption A1).

Mutation checks (each change to the module made at least one leg fail): read split rule, head -50 limit, growth threshold, sort last resort, char sign, word-char class, fan-out 64, hidden-directory skip, dotfile read, depth-0 find candidate, and symlink recursion in the team walk.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] globDirs sort order**
- **Found during:** Task 2 GREEN, first run of the glob legs against live bash.
- **Issue:** The interface says sort by bare name. Live bash sorts the matches of `"$dir"/*/` with the trailing slash, so `a-b/` and `a b/` come before `a/` (and `team-execution/` before `team/`). The renderers would have emitted sections in the wrong order.
- **Fix:** `globDirs` sorts by the printed path. The rule is recorded in the code comment. `globFiles` was already right.
- **Files modified:** lib/core/room-scan.cjs, tests/test-381-room-scan.cjs
- **Commit:** f6d1f6550

**2. [Rule 1 - Bug] isGrepWordChar base class**
- **Found during:** Task 1, bulk probe of every code point against live `grep -E '\bB2B\b'`.
- **Issue:** The suggested start `/[\p{L}\p{N}_]/u` misses combining marks and circled letters that glibc counts as word characters (871 Mn, 424 Mc, 130 So code points) and wrongly counts No characters.
- **Fix:** `/[\p{Alphabetic}\p{Nd}_]/u`. The remaining 9,124 differences are all code points that are newer than the host glibc Unicode version (glibc 2.39 against node Unicode 17.0), always in the direction "module says word, grep says not". The test fails on any gap in the other direction.
- **Commit:** 9a1794496

**3. [Rule 1 - Clarification] readSplit trailing delimiter rule**
- **Found during:** Task 1, live fuzz (3 IFS values x 1 to 4 vars x 286 cases).
- **Issue:** The interface text "a single trailing delimiter is dropped when the rest would end in it" contradicts its own Pitfall 11 row (`d|s|t|f|g|` with 4 vars keeps `f|g|`).
- **Fix:** The live rule is implemented: the last variable loses the delimiter only when the first delimiter of the rest is also its last character. The module comment records it.
- **Commit:** 9a1794496

### Additions beyond the file list

- `tests/helpers/live-381.cjs` (shared live-tool helpers) and `tests/test-381-date-tz-matrix.cjs` (the full TZ matrix) were added. The orchestrator gate rule asked for the TZ matrix to be split out so the dialect quick run stays under about 10 s. `run-all-381.sh` discovers the matrix file by glob, so the full matrix runs in the standard suite.
- Each task has a separate RED commit and GREEN commit (TDD), where the plan named one commit per task.
- `sortLines` also accepts `unique` (tested against `sort -u`); `BashAssoc` and `bashHash` accept a `signed` option so the assoc test can derive the host truth; `xargsEcho` returns an extra `err` field and also sends values with a double quote, or longer than 16,384 bytes, to the real xargs.
- `bashTestInt` accepts leading `\n \v \f \r` (live `[` does, via strtoimax) and only blanks or tabs after the digits; all 36 operand cases match live bash.
- `scanRoom` entry shape: `files` entries carry `section`, `name`, `path` (single slashes), `kind`, `targetKind` (`file|dir|other|broken`), `lmtimeNs` (bigint), `mtimeMs`, and `buf`/`text` when read. lstat and mtimes are taken only for names that match `/\.md$/i`. `profiles` entries carry `name`, `path`, `kind` and `buf`/`text` for regular files. `funding` entries carry `status` (`{buf, text}` or null).

## Authentication gates

None.

## Known Stubs

None.

## Threat Flags

None. The module spawns only `xargs` (value on stdin, argv empty), `date` and `python3` (value as argv, constant program). T-381-01, T-381-02, T-381-04 are covered by tests: the u8x payload legs, the loop and root-symlink leg, and the Part 8 sweep.

## Issues Encountered

- A mutation run that made the team walk follow symlinks looped through `team/loop` and grew one node process to about 4.4 GB for roughly two minutes before it aborted. It ran niced. The module restored from a saved copy and was byte-compared to the committed version afterwards.

## Self-Check: PASSED

- lib/core/room-scan.cjs, tests/test-381-bash-assoc.cjs, tests/test-381-bash-dialect.cjs, tests/test-381-date-tz-matrix.cjs, tests/test-381-room-scan.cjs and tests/helpers/live-381.cjs exist.
- Commits 8b4f6b209, 9a1794496, a5ad3a51c and f6d1f6550 are ancestors of HEAD.
- Acceptance greps: gray-matter or js-yaml require count 0; non-comment egress tokens 0; non-comment `python3` appears only on the dateDToEpoch step-3 spawn; "Part 7" count 1; `pool(` count 10; non-comment `followSymlinks|realpath` count 0; no U+2013 or U+2014 in any new file.
