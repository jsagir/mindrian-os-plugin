---
phase: 381-room-scan-once-render-three-times-node-renderers-behind-comp
plan: 06
subsystem: infra
tags: [analyze-room, node-renderer, byte-parity, bash-assoc, spawn-budget, sessionstart-cache, legacy-switch]
requires:
  - phase: 381-05
    provides: lib/core/room-render-analyze.cjs part 1 (Gaps, Convergence, Contradictions, Cross-References, wikilink sweep) and the analyze router mode
  - phase: 381-04
    provides: the compute-team exec header pattern, test-381-known-divergence.cjs and test-381-spawn-budget.cjs team legs
  - phase: 381-03
    provides: lib/core/room-scan.cjs (BashAssoc, xargsEcho, sortLines, readSplit, dateDToEpoch, dateYmdLocal, globDirs, globFiles)
provides:
  - lib/core/room-render-analyze.cjs complete (meetingCoverageBlock, valueOf, opportunityBlock with funding, capabilityBlock, End line)
  - scripts/analyze-room Phase 381 exec header behind MINDRIAN_LEGACY_COMPUTE
  - scripts/session-start-state analyze cache miss with reason=renderer (PERF381-06)
  - lx3 A3 renderer cases; analyze legs of the divergence and spawn-budget tests (EDGE_ANALYZE_SPAWNS = 5)
affects: [381-07, 381-08, 381-09]
tech-stack:
  added: []
  patterns: [valueOf = grep -m1 | sed | tr -d | xargs || true emulation, re-read files the wikilink sweep rewrote before later blocks, printf-line split before sort and read]
key-files:
  created: []
  modified:
    - lib/core/room-render-analyze.cjs
    - lib/core/room-render.cjs
    - scripts/analyze-room
    - scripts/session-start-state
    - tests/test-261029-lx3-sessionstart-skip.cjs
    - tests/test-381-known-divergence.cjs
    - tests/test-381-spawn-budget.cjs
key-decisions:
  - "Section files that the wikilink sweep rewrote are re-read before Meeting Coverage, so block 4 sees the bytes that bash grep sees after the sweep. Opportunity and funding files are read at block time."
  - "The relevance and deadline lines are joined and split on LF before sort (printf '%s\\n' rule), so a file name with an LF splits into two sort lines as in bash."
  - "Real-room parity runs on a cp -a snapshot in the session scratchpad: a live session rewrote .context/last-session.md in the real room during a run, which made the OLD and NEW copies differ."
  - "EDGE_ANALYZE_SPAWNS = 5: 2 grep (market.analysis INFORMS and CONTRADICTS), 1 xargs (status -n), 2 date -d (distinct funding last_updated values); read from the recorded spawns."
requirements-completed: [PERF381-01, PERF381-02, PERF381-05, PERF381-06, PERF381-08]
duration: ~15min
completed: 2026-10-30
---

# Phase 381 Plan 06: analyze-room node renderer complete, wrapper and cache key Summary

scripts/analyze-room now runs as one node process (lib/core/room-render.cjs analyze) with the same stdout, exit code and post-run tree as the BASE_SHA oracle on all 22 gate rooms and on a snapshot copy of the real room. On the /mnt/c copy the median goes from 22307 ms (OLD) to 1191 ms (NEW). The SessionStart analyze cache now misses with reason=renderer when a renderer module is newer than the cache.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `0314c661c` | feat(381-06): complete the analyze-room node renderer (meetings, opportunity bank, capabilities) |
| 2 | `4ddbaacd4` | perf(381-06): run analyze-room through the node renderer; renderer modules invalidate the analyze cache |
| 3 | `e2d223e93` | test(381-06): pin the analyze divergences and the analyze spawn budget |

Gate re-check (Task 1 Step 0, PROVEN):
- BASE_SHA `65aaf329f`, sc6 `4f470032b` and the hotfix `5a2dcfd4d` are ancestors of HEAD.
- Both quick SUMMARYs (261029-s9x, 261029-sc6) exist.
- `grep -nF "strptime('$datestr'"` on analyze-room and compute-team printed nothing.
- `git log BASE_SHA..HEAD` over the oracle inputs lists only `2b75159b8` (381-04, the compute-team wrapper). There is no foreign commit.

## Parity results (PROVEN; host aarch64, 12 CPUs, node v22.23.1; LC_ALL=C.UTF-8, TZ=UTC)

| Run | Command | Last line | Exit |
|-----|---------|-----------|------|
| T1 direct | `node tests/test-381-parity.cjs --direct --only analyze-room` (stdout and tree) | `parity: 0 diffs in 22 pairs` | 0 |
| T1 direct, real room | the same plus `--room <snapshot of ROOM>` | `parity: 0 diffs in 23 pairs` | 0 |
| T2 entry point | `node tests/test-381-parity.cjs` (all three scripts) | `parity: 0 diffs in 68 pairs` | 0 |
| T2 legacy switch | `node tests/test-381-parity.cjs --legacy-switch --only analyze-room` | `parity: 0 diffs in 22 pairs` | 0 |
| T2 real room | `node tests/test-381-parity.cjs --only analyze-room --room <snapshot of ROOM>` | `parity: 0 diffs in 23 pairs` | 0 |

- Entry-point run (OLD ms, NEW ms): `analyze-room edge-room OK 2783 82`, `hostile-room OK 703 75`, `bad-stage-room OK 10 37`.
- Real-room snapshot: `PARITY analyze-room room-copy:room-snap OK 7512 106` (entry point), `OK 7608 109` (direct).
- Legacy switch: `analyze-room edge-room OK 2857 2789` (both sides run the bash body).
- The hostile room is a gate room in the default run. The u8x folder-name payloads and the u8x funding date payload gave equal bytes, and no marker appeared in a run cwd.
- The NOTE lines for the real-room copy name only `.mindrian/` files and one PDF in a section (ruling 2 shapes that analyze-room does not read as markdown).
- On the real room, the new blocks print 1 MEETING_COUNT line, 3 MEETING_SOURCED lines, GAP:MEETING_COVERAGE lines, 2 OPP_STATUS lines and 4 CAPABILITY lines, so the new code paths ran on real data.

## Timing on the /mnt/c copy (bench/script-timing-381.cjs, median of 3, warm-up excluded, `--refresh` per side)

Load at the start: `0.97 0.87 1.02` (12 CPUs, below the nproc/2 gate). Load at the end: `1.84 1.15 1.09`.

```
script=analyze-room side=old runs=3 median_ms=22307 min_ms=21735 max_ms=22751 exit=0 load1=1.42 head=0314c661c warmup_ms=22330 warmup_exit=0 runs_ms=[22751,21735,22307]
script=analyze-room side=new runs=3 median_ms=1191 min_ms=1180 max_ms=1197 exit=0 load1=1.84 head=0314c661c warmup_ms=1095 warmup_exit=0 runs_ms=[1197,1180,1191]
```

- analyze-room: 22307 ms to 1191 ms. The Before value of 381-02 is 22734 ms.
- The head field reads 0314c661c because the wrapper commit landed after the runs. The NEW tree already carried the uncommitted wrapper header, with the same bytes as `4ddbaacd4`.
- The bench copy was deleted after the runs.

## Spawn budget (tests/test-381-spawn-budget.cjs, PROVEN)

| Leg | Spawns | Detail |
|-----|--------|--------|
| analyze edge | 5 = EDGE_ANALYZE_SPAWNS | `grep -lZE -- <market.analysis pattern> files...`, `grep -liZE -- <pattern2> files...`, `xargs []` (status `-n`), `date -d 2020-01-01 +%s`, `date -d <yesterday> +%s` |
| analyze edge plus 50 artifacts | 5 | 50 files with `##` headers, bold runs and `[[market-analysis]]` in problem-definition |
| analyze hostile | 9 | 6 grep (the backslash name and the 2 payload names, 2 each), 1 xargs, `date -d` and `date -j -f` for the u8x funding payload (not shape-valid, so no python3); no node spawn; empty run cwd; no marker in the room |
| team legs (unchanged) | 9 / 9 / 5 | as in 381-04 |
| net guard | log empty | |

Every spawn with `-c` or `-e` carries a constant program. Analyze FALLBACK_PROGRAMS is empty.

## Cache key (PERF381-06, PROVEN)

- `node tests/test-261029-lx3-sessionstart-skip.cjs`: exit 0, `sessionstart-skip: ALL PASS`. The new lines are `ok A3 miss: a renderer module newer than the cache (Phase 381, PERF381-06) runs analyze-room (DD-4)` and `ok A3 reason: a renderer module newer than the cache logs reason=renderer (Phase 381, PERF381-06)`.
- Negative control: with the HEAD~ version of scripts/session-start-state the two new cases FAIL (`sessionstart-skip: 2 FAILED`). The file was restored after the check.
- A1 (fixture without `../lib`) still hits.

## Acceptance results (PROVEN)

Task 1:
- `--direct --only analyze-room`: exit 0, `parity: 0 diffs in 22 pairs` (bad-stage room included). With `--room`: exit 0, `parity: 0 diffs in 23 pairs`.
- `grep -c "sep: ':'"` gives 2. `grep -c "xargsEcho("` gives 2.
- The non-comment grep for `python3|'date'|node -e` gives 0.

Task 2:
- `grep -cF` of the exec line gives 1. The exec line is line 12, and the first BASH_VERSINFO line is line 17. `grep -c -- '--disable-warning'` gives 0.
- `git ls-files -s scripts/analyze-room` gives mode 100755. `git diff BASE_SHA -- scripts/analyze-room` shows 0 removed lines.
- `grep -c 'reason="renderer"' scripts/session-start-state` gives 3. `grep -c room-render-analyze.cjs` gives 2.
- `git diff --quiet HEAD -- scripts/session-start` passes.
- The pinning tests each exit 0:
  - test-369-hook-require-graph (5 passed)
  - test-261029-kqv-stop-skip-recompute (ALL PASS)
  - test-261029-lx3-sessionstart-skip (ALL PASS)
  - test-363.1-compute-state (all legs passed)
  - run-all-2401.sh (PASS=8 FAIL=0 SKIP=0)
  - run-all-363.1.sh (PASS=12 FAIL=0 SKIP=1)
  - test-365-falsify-missing-five
  - test-365-falsify-contradiction
  - test-analyze-room-edge-argv (ALL PASS)
- `git status --porcelain tests/fixtures` was empty before and after test-phase-13.sh (32 passed) and test-phase-27-room-structure.sh (8 passed).
- NEW median 1191 ms is less than OLD median 22307 ms.

Task 3:
- `node tests/test-381-known-divergence.cjs`: exit 0 with 7 `ok - ` lines. The 3 team legs are invalid-utf8 (team), room-path-sed (team) and macos-python-path (compute-team). The 4 analyze legs are sigpipe-large-file (analyze), invalid-utf8 (analyze), nul-byte (analyze) and macos-python-path (analyze-room).
- Observed OLD behaviour:
  - sigpipe-large-file: OLD runs 1 and 2 both exit 0 with no div-big CONTRADICT line.
  - invalid-utf8: OLD prints `No convergence signals detected yet.`. NEW termsOf gives `["header"]` (the `[^\n]` rule cuts at the letter n).
  - nul-byte: OLD prints no CONTRADICT line.
- The non-comment grep for `python-date-injection|node-e-section-name` gives 0.
- `node tests/test-381-spawn-budget.cjs`: exit 0. `grep -c EDGE_ANALYZE_SPAWNS` gives 7.
- `bash tests/run-all-381.sh`: exit 0, `Phase 381: PASS=9 FAIL=0 SKIP=0`, 52.7 s. Load1 was 3.29 at the start and 2.56 at the end. The Part 8 sweep lists room-render-analyze.cjs as clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Files rewritten by the wikilink sweep**
- **Found during:** Task 1, while reading the 381-05 renderer.
- **Issue:** The 381-05 renderer reads every section file once, before the sweep. Bash runs `grep -q '^source: transcript'` in block 4 after the sweep has rewritten xref source files.
- **Fix:** refreshWritten re-reads the files that the sweep wrote. The opportunity and funding files are read when their block runs.
- **Files modified:** lib/core/room-render-analyze.cjs
- **Commit:** 0314c661c

**2. [Rule 3 - Blocking] Real-room parity used a snapshot**
- **Found during:** Task 1, on the first `--room` run.
- **Issue:** The first `--room <real room>` run reported `tree: content differs: ".context/last-session.md"`. The stat of the real room showed the file was rewritten at 00:11:15, during the run. A live session uses that room, so the OLD copy and the NEW copy had different sources.
- **Fix:** All real-room parity runs use one `cp -a` snapshot in the session scratchpad, so OLD and NEW copy the same bytes. The snapshot was deleted afterwards. No script ran in the real room.

**3. [Rule 2 - Clarification] Router comment and the module-name comment**
- room-render.cjs: the mode comment said that the bash entry point keeps its bash body until 381-06. That text is now false, so the line was removed. The change is a comment only, and it is in commit 4ddbaacd4. The file is not in the plan files list.
- scripts/session-start-state: the comment line names the three modules. With that line, `grep -c room-render-analyze.cjs` gives 2, as the acceptance criterion requires. The arm for that module is on one line.

### Notes

- valueOf returns '' without an xargs spawn when no line matches. In bash, xargs on empty input also gives ''.

## Authentication gates

None.

## Known Stubs

None.

## Threat Flags

None. There is no new network path and no new write target. The only new spawns are `xargs` (argv [], value on stdin) and the room-scan date chain (argv arrays, constant python program for shape-valid values only). The cache arms only compare file mtimes.

## Issues Encountered

- STATE.md, ROADMAP.md and REQUIREMENTS.md were not written, as the orchestrator instructed.
- `/tmp/test-381-room-scan-kXIDJU` exists on the host from an earlier plan. It was left in place.

## Self-Check: PASSED

- lib/core/room-render-analyze.cjs holds `## End`. scripts/analyze-room holds `room-render.cjs" analyze`. scripts/session-start-state holds `reason="renderer"`. The lx3 test holds `renderer`.
- Commits 0314c661c, 4ddbaacd4 and e2d223e93 are ancestors of HEAD.
