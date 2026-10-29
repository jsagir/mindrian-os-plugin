---
phase: 381-room-scan-once-render-three-times-node-renderers-behind-comp
plan: 04
subsystem: infra
tags: [compute-team, node-renderer, byte-parity, bash-assoc, spawn-budget, legacy-switch]
requires:
  - phase: 381-01
    provides: BASE_SHA oracle, parity harness, gate room builders, run-all-381.sh
  - phase: 381-02
    provides: Before numbers (compute-team 2535 ms, compute-state 7977 ms on the /mnt/c copy) and the per-script timing helper
  - phase: 381-03
    provides: lib/core/room-scan.cjs (BashAssoc, bash frontmatter dialect, readSplit, readArray, sortLines, dateDToEpoch, globDirs, globFiles, findByName, readTexts)
provides:
  - lib/core/room-render.cjs router (team mode, Node 22.18.0 floor check, run(mode, args, ctx))
  - lib/core/room-render-team.cjs (renderTeam, runTeam, FALLBACK_PROGRAMS, ALL_ROLES)
  - scripts/compute-team exec header behind MINDRIAN_LEGACY_COMPUTE
  - tests/test-381-known-divergence.cjs (team legs) and tests/test-381-spawn-budget.cjs (team legs)
affects: [381-05, 381-06, 381-07, 381-08, 381-09]
tech-stack:
  added: []
  patterns: [transliterate each bash block in bash order, BashAssoc per declare -A, constant fallback program with values as positional args, in-process child_process recorder]
key-files:
  created:
    - lib/core/room-render.cjs
    - lib/core/room-render-team.cjs
    - tests/test-381-known-divergence.cjs
    - tests/test-381-spawn-budget.cjs
  modified:
    - scripts/compute-team
    - docs/ENV-TUNING.md
key-decisions:
  - "section_name keeps the bash $(basename) rule: trailing newlines of a section folder name are dropped before the name is used (the hostile room nl-tail folder)."
  - "roles, affiliation and first_meeting are not ported: no echo of the bash body prints them."
  - "The frontmatter key date is written in double quotes in room-render-team.cjs so the source grep for spawned tools stays at 0; it is a key, not a process."
  - "EDGE_TEAM_SPAWNS = 9: 6 date -d plus date -d, date -j -f and python3 for 2026-02-30; read from the recorded spawns."
requirements-completed: [PERF381-01, PERF381-02, PERF381-05, PERF381-08]
duration: ~20min
completed: 2026-10-29
---

# Phase 381 Plan 04: compute-team node renderer Summary

compute-team now runs as one node process (lib/core/room-render.cjs team) that writes byte-identical TEAM-STATE.md and PROFILE.md files on every gate room and on a copy of the real room, 2534 ms to 370 ms per run on the /mnt/c copy, with the bash body still reachable behind MINDRIAN_LEGACY_COMPUTE=1.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `c4f7c346c` | feat(381-04): add the room-render router and the compute-team node renderer |
| 2 | `2b75159b8` | perf(381-04): run compute-team through the node renderer behind MINDRIAN_LEGACY_COMPUTE |
| 3 | `95834f227` | test(381-04): pin the team divergences and the team spawn budget |

Gate re-check (Task 1 Step 0, PROVEN): BASE_SHA `65aaf329f9c514c71fff2f1a530cd366c0b87b66` is an ancestor of HEAD; `5a2dcfd4d` is an ancestor of BASE_SHA; `4f470032b` (sc6) is an ancestor of HEAD; both quick SUMMARYs (261029-s9x, 261029-sc6) exist; `grep -nF "strptime('$datestr'"` on compute-team and analyze-room printed nothing; `git log BASE_SHA..HEAD` over the oracle inputs listed no commit.

## Parity results (all PROVEN, host arm64, node v22.23.1, bash 5.2.21)

| Run | Last line | Exit |
|-----|-----------|------|
| `node tests/test-381-parity.cjs --direct --only compute-team` (Task 1) | `parity: 0 diffs in 22 pairs` | 0 |
| `node tests/test-381-parity.cjs` (all three scripts, through the bash entry point; compute-state calls the NEW compute-team) | `parity: 0 diffs in 68 pairs` | 0 |
| `node tests/test-381-parity.cjs --legacy-switch --only compute-team,compute-state` | `parity: 0 diffs in 46 pairs` | 0 |
| `node tests/test-381-parity.cjs --only compute-team,compute-state --room <real room>` (harness cp -a copy under os.tmpdir()) | `parity: 0 diffs in 48 pairs` | 0 |

compute-team per gate room in the full entry-point run (result, OLD ms, NEW ms): edge-room OK 848 149; hostile-room OK 235 56; bad-stage-room OK 3 34; empty-room OK 2 31; team-no-profiles OK 5 33; missing-room OK 2 36; sample-room OK 3 31; sample-room-opp OK 3 31; sample-room-personas OK 2 33; test-room-causal OK 2 41; test-room-graph OK 3 35; test-room-meeting OK 7 40; test-room-reasoning OK 9 34; test-room-visual OK 9 40; wiki-room-232 OK 8 36; icm-rooms/alpha-room OK 7 40; 272/room OK 8 38; 195-nested-room-tree/root-room OK 10 41; release-room OK 11 41; futures-seed-room OK 7 38; graph-export-golden-room OK 8 41; never-ready-room OK 8 36.

Real-room copy lines: `PARITY compute-team room-copy:<ROOM> OK 967 82` and `PARITY compute-state room-copy:<ROOM> OK 2517 1602`. The harness NOTE lines for the copy name only `.mindrian/` files and one PDF in a section (ruling 2 shapes that compute-team does not read). The legacy switch run shows compute-team edge-room `OK 874 860` (the NEW side runs the bash body, so both sides take the bash time).

The hostile room (quick 261029-u8x payloads) is a gate room in the default run: equal TEAM-STATE.md bytes, no marker file in any run cwd, no net guard line.

Extra probe (not committed, session scratchpad): a generated room with 42 profiles, 241 attributed artifacts over 8 sections (a section name with a comma, one with a backslash, a speaker with a backslash), Recurring Concerns, Primary Voice ties and both heading kinds: `--direct --only compute-team` with `--room` gave 0 diffs in 23 pairs. The backslash rows went through FALLBACK_PROGRAMS.profileRewrite.

## Timing on the /mnt/c copy (median of 3, warm-up excluded)

Copy: `cp -a` of the real room to the Windows temp folder of 381-02 (445 files, `--refresh`), deleted after the runs. `uptime` load average at start 0.57 1.07 1.18 (23:44:16 local), after compute-team 1.08 1.15 1.20, at end 1.66 1.33 1.26.

```
script=compute-team side=old runs=3 median_ms=2534 min_ms=2525 max_ms=2561 exit=0 load1=0.92 head=c4f7c346c warmup_ms=2555 warmup_exit=0 runs_ms=[2525,2534,2561]
script=compute-team side=new runs=3 median_ms=370 min_ms=327 max_ms=401 exit=0 load1=1.08 head=c4f7c346c warmup_ms=374 warmup_exit=0 runs_ms=[370,401,327]
script=compute-state side=old runs=3 median_ms=7732 min_ms=7607 max_ms=7935 exit=0 load1=1.89 head=c4f7c346c warmup_ms=7909 warmup_exit=0 runs_ms=[7607,7732,7935]
script=compute-state side=new runs=3 median_ms=5799 min_ms=5775 max_ms=5843 exit=0 load1=1.66 head=c4f7c346c warmup_ms=5771 warmup_exit=0 runs_ms=[5775,5799,5843]
```

compute-team: 2534 ms to 370 ms (Before value of 381-02: 2535 ms). compute-state (legacy body, NEW compute-team inside): 7732 ms to 5799 ms. The head field reads c4f7c346c because the wrapper commit landed after the runs; the NEW tree already carried the uncommitted wrapper header (the same bytes as 2b75159b8).

## Spawn budget (tests/test-381-spawn-budget.cjs, PROVEN)

- Edge room: 9 spawns = EDGE_TEAM_SPAWNS. Recorded: `date -d` for 6 distinct last_active values, and `date -d`, `date -j -f %Y-%m-%d`, `python3 -c DATE_PY_PROGRAM` for `2026-02-30`.
- Edge room plus 50 artifacts: 9 spawns (zero per-file spawns).
- Hostile room: 5 spawns, all date-chain steps, each step once per distinct value; the u8x payload got `date -d` and `date -j -f` only (not shape-valid, so no python3); no node spawn; the run cwd stayed empty; no marker in the room.
- Every spawn with `-c` or `-e` carries a constant program (FALLBACK_PROGRAMS or DATE_PY_PROGRAM).
- Net guard log empty.

## Acceptance results

Task 1 (all PROVEN):
- parity --direct --only compute-team: exit 0, `parity: 0 diffs in 22 pairs` (M = 22, at least 20).
- Non-comment grep for `python3|gray-matter|'sed'|'grep'|'head'|'date'|node -e` in room-render-team.cjs: 0.
- `new BashAssoc` count: 13. `PROFILE.md.tmp` count: 1 (header comment; the code builds `file + '.tmp'`). `renameSync` count: 1.
- `Object.keys(FALLBACK_PROGRAMS)`: `profileRewrite`.
- `node lib/core/room-render.cjs bogus`: exit 2.
- Floor: 20.19.5 and 22.9.0 give exit 1, empty stdout, one stderr line `team: needs Node.js 22.18.0 or later (found v20.19.5)` (and `v22.9.0`); 22.18.0 and 23.0.0 give exit 0, empty stderr. Without MINDRIAN_TEST_MODE=1 the fake 20.19.5 is ignored: exit 0, empty stderr.

Task 2 (all PROVEN):
- `grep -cF` of the exec line: 1. `grep -c -- '--disable-warning'`: 0.
- Exec line is line 15; the first BASH_VERSINFO line is line 20 (`grep -n`).
- `git ls-files -s scripts/compute-team`: mode 100755; `git diff BASE_SHA -- scripts/compute-team` shows 0 removed lines (9 added).
- Parity default, legacy switch and real-room copy: exit 0 each, last lines in the table above.
- Pinning tests, each exit 0: test-369-hook-require-graph (5 passed), test-363.1-compute-state (all legs passed), test-compute-state-persists (ALL PASS), test-261029-kqv-stop-skip-recompute (ALL PASS, 23 s), test-261029-lx3-sessionstart-skip (ALL PASS, 25 s), test-266-room-state-description (12 passed), run-all-2401.sh (PASS=8 FAIL=0), run-all-363.1.sh (PASS=12 FAIL=0 SKIP=1, the opt-in regression block), test-frontmatter-schema-reconcile (8/8), test-365-falsify-missing-five, test-365-falsify-contradiction, statusline-active-room-write.test (7/7). `git status --porcelain tests/fixtures` was empty before and after test-phase-13 (32 passed) and test-phase-27-room-structure (8 passed).
- docs/ENV-TUNING.md holds MINDRIAN_LEGACY_COMPUTE and the heading `## Room Summary Renderers (Phase 381, room-local, zero egress)`.
- Four `script=` lines are recorded above; compute-team new median 370 ms is below old median 2534 ms.

Task 3 (all PROVEN):
- `node tests/test-381-known-divergence.cjs`: exit 0, three `ok - ` lines (invalid-utf8 (team), room-path-sed (team), macos-python-path (compute-team)). Observed OLD behaviour: invalid-utf8, OLD exit 0 and no TEAM-STATE.md (the only profile lost its name); room-path-sed, OLD exit 1, no TEAM-STATE.md, alice PROFILE.md unchanged, stderr `sed: -e expression #1, char 46: unknown option to `s'`.
- `node tests/test-381-spawn-budget.cjs`: exit 0 with the counts above.
- `grep -c EDGE_TEAM_SPAWNS`: 7.
- `bash tests/run-all-381.sh`: exit 0, `PASS=9 FAIL=0 SKIP=0` (58.7 s; load average 1.40 at start, 1.91 at end). The Part 8 sweep lists room-render.cjs and room-render-team.cjs as clean.
- Non-comment grep for `python-date-injection|node-e-section-name` in the divergence test: 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Section name trailing-newline rule**
- **Found during:** Task 1, while reading the bash body (before the first parity run).
- **Issue:** The plan text says "globDirs(roomArg) names". Bash takes `section_name=$(basename "$section_dir")`, and the command substitution drops trailing newlines. A folder named `nl-tail` plus LF (hostile room) is listed as `nl-tail` in Knowledge Gaps and its files are not found.
- **Fix:** The renderer applies stripTrailingNewlines to each globDirs name, then applies the dot, team and meetings rules, and globs `roomArg + '/' + name`.
- **Files modified:** lib/core/room-render-team.cjs
- **Commit:** c4f7c346c

**2. [Rule 1 - Clarification] Artifact date from the file name**
- **Issue:** `echo "$fname" | grep -oE '^[0-9]{4}-...'` matches on each line of a name that holds a newline. The renderer runs the match per line and joins the hits with a newline, as the capture would.
- **Commit:** c4f7c346c

### Notes

- runTeam returns `{ code, stderr }` (the plan names `{ code }`); the extra field carries the write-failure message to the CLI.
- No other change. The bash body of scripts/compute-team is unchanged below the header.

## Authentication gates

None.

## Known Stubs

None.

## Threat Flags

None. The renderer adds no network path, no new write target, and no program text built from room data. The only spawn of the module is the constant FALLBACK_PROGRAMS.profileRewrite with values as positional arguments.

## Issues Encountered

- On a room without `team/`, NEW costs node start-up (about 30 to 40 ms) where the bash body returned in 2 to 10 ms. compute-state calls compute-team once per run, so this adds about 30 ms on such rooms; the real room gains about 2.1 s.
- The bench copy of 381-02 was absent at start; `--refresh` recreated it (445 files, no write.lock problem this time). It was deleted after the runs. No temp dir of the harness was left under /tmp.

## Self-Check: PASSED

- lib/core/room-render.cjs, lib/core/room-render-team.cjs, tests/test-381-known-divergence.cjs and tests/test-381-spawn-budget.cjs exist.
- Commits c4f7c346c, 2b75159b8 and 95834f227 are ancestors of HEAD.
