---
phase: 381-room-scan-once-render-three-times-node-renderers-behind-comp
plan: 07
subsystem: infra
tags: [compute-state, node-renderer, byte-parity, two-phase-read, spawn-budget, persistState, legacy-switch]
requires:
  - phase: 381-06
    provides: the complete analyze renderer, the wrapper header pattern, the divergence and spawn-budget test files
  - phase: 381-04
    provides: room-render.cjs router, runTeam (in-process team step), EDGE_TEAM_SPAWNS
  - phase: 381-03
    provides: room-scan.cjs (globDirs, globFiles, findDepth1, findByName, readTexts, sortLines, pool, consoleLogText, bashTestInt, computedStamp, dateYmdLocal)
provides:
  - lib/core/room-render-state.cjs (renderState, readCurrentRoomSlug, realLoose)
  - lib/core/room-render.cjs state mode
  - scripts/compute-state Phase 381 exec header behind MINDRIAN_LEGACY_COMPUTE
  - lib/mcp/stop-gate-handler.cjs _closeOutStateMd writes through persistState (ruling 4)
  - tests/test-381-stop-gate-persist.cjs; the state legs of the divergence and spawn-budget tests (EDGE_STATE_SPAWNS = 11)
affects: [381-08, 381-09]
tech-stack:
  added: []
  patterns: [two-phase read around the team and meetings writes, python non-strict realpath port, lstat through the bounded pool for Last Updated]
key-files:
  created:
    - lib/core/room-render-state.cjs
    - tests/test-381-stop-gate-persist.cjs
  modified:
    - lib/core/room-render.cjs
    - scripts/compute-state
    - lib/mcp/stop-gate-handler.cjs
    - tests/test-381-known-divergence.cjs
    - tests/test-381-spawn-budget.cjs
key-decisions:
  - "realLoose ports python 3.12 posixpath.realpath (strict=False) component by component, not path.resolve plus realpathSync: '..' after a symlink then resolves the way python does."
  - "The registry is decoded with TextDecoder fatal and ignoreBOM: python json rejects invalid UTF-8 and a UTF-8 BOM, so the port gives '' there too."
  - "The --list-content output is split on LF as the bash read loop does, so a content path with an LF contributes no cross-reference (bash greps two non-existent paths)."
  - "Last Updated stats its candidates through the room-scan pool and the sections run under Promise.all; nothing writes between the counts and the dates, so the bash read order is kept."
  - "EDGE_STATE_SPAWNS = 11: 1 bash compute-meetings-intelligence, 1 grep -lZE for market.analysis, 9 date-chain steps of the in-process team step; read from the recorded spawns."
requirements-completed: [PERF381-01, PERF381-02, PERF381-05, PERF381-08]
duration: ~23min
completed: 2026-10-30
---

# Phase 381 Plan 07: compute-state node renderer, wrapper and stop-gate persistState Summary

scripts/compute-state now runs as one node process (lib/core/room-render.cjs state). It reads the room in the two bash phases, runs the team step in process and spawns the meetings script once. Its stdout and post-run tree equal the BASE_SHA oracle on all gate rooms and on a real-room snapshot. On the /mnt/c copy the median goes from 7862 ms (OLD) to 1355 ms (NEW); the Before value of 381-02 is 7977 ms. The stop-gate close-out now writes STATE.md through persistState.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `f556fc28a` | feat(381-07): add the compute-state node renderer (two-phase read, in-process team and predicate) |
| 2 (perf) | `bf1e06ff6` | perf(381-07): pool the compute-state Last Updated lstat calls and run the sections in parallel |
| 2 | `80a3559b7` | perf(381-07): run compute-state through the node renderer; stop-gate close-out writes STATE.md through persistState |
| 3 | `667b12183` | test(381-07): pin the compute-state divergences and spawn budget |

Gate re-check (Task 1 Step 0, PROVEN):
- BASE_SHA `65aaf329f`, sc6 `4f470032b` and the hotfix `5a2dcfd4d` are ancestors of HEAD. `5a2dcfd4d` is an ancestor of BASE_SHA.
- Both quick SUMMARYs (261029-s9x, 261029-sc6) exist.
- `grep -nF "strptime('$datestr'"` on compute-team, analyze-room and compute-state printed nothing.
- `git log BASE_SHA..HEAD` over the oracle inputs lists only `2b75159b8` (381-04) and `4ddbaacd4` (381-06). There is no foreign commit.

## Parity results (PROVEN; host aarch64, 12 CPUs, node v22.23.1; LC_ALL=C.UTF-8)

| Run | Command | Last line | Exit |
|-----|---------|-----------|------|
| T1 direct | `node tests/test-381-parity.cjs --direct --only compute-state` | `parity: 0 diffs in 24 pairs` | 0 |
| T2 entry point | `node tests/test-381-parity.cjs` (all three scripts) | `parity: 0 diffs in 68 pairs` | 0 |
| T2 legacy switch | `node tests/test-381-parity.cjs --legacy-switch --only compute-state,compute-team` | `parity: 0 diffs in 46 pairs` | 0 |
| T2 host TZ | `node tests/test-381-parity.cjs --only compute-state --tz host` (Asia/Hebron) | `parity: 0 diffs in 24 pairs` | 0 |
| T2 real room | `node tests/test-381-parity.cjs --only compute-state --room <snapshot of ROOM>` | `parity: 0 diffs in 25 pairs` | 0 |
| T2 real room, direct | the same with `--direct` | `parity: 0 diffs in 25 pairs` | 0 |

- All rows above were run again after the perf commit `bf1e06ff6`, with the same results.
- Entry-point lines (OLD ms, NEW ms): `compute-state edge-room OK 2375 252`, `edge-room[mtime-equal] OK 2255 250`, `edge-room[no-registry] OK 2443 254`, `hostile-room OK 964 149`.
- Real-room snapshot: `PARITY compute-state room-copy:room-snap OK 2476 267` (entry point) and `OK 2507 273` (direct). The snapshot was one `cp -a` copy in the session scratchpad. It was deleted after the runs. No script ran in the real room.
- The NOTE lines for the snapshot name only `.mindrian/` files and one PDF in a section (ruling 2 shapes).
- On the real data, NEW prints `## Meetings`, `## Cross-Meeting Intelligence` (the open action items line), `## Team` (Roles, Active, Knowledge gaps), 3 cross-reference lines and 18 table rows. There is no `## Room Map`, because one section name holds backslashes (the JSON.parse rule). The new code paths therefore ran on real data.
- The hostile room is a gate room in the default run. The u8x payloads and the payload folder names (as sections and as cross-reference targets) gave equal bytes, and no marker appeared in a run cwd.

Extra probes (not committed, session scratchpad):
- Registry port: 27 registry shapes, compared with the python heredoc of BASE_SHA. The shapes cover abs_path, relative and absolute path, absent rooms, a symlinked room, `..` after a symlink, a symlink loop, missing components, non-string and falsy values of active, abs_path and path, trailing newlines in active, a non-object entry, a list registry, NaN, a BOM, invalid JSON and a relative room argument. The first run had 1 mismatch (the BOM; fixed before the commit). The final run had 27 of 27 equal.
- Predicate-unavailable degrade path: OLD and NEW trees with a scaffold-predicate.cjs that throws. comparePair gave OK on edge, hostile, sample-room and test-room-meeting, direct and entry point. NEW stderr is exactly the degrade line.

## Timing on the /mnt/c copy (bench/script-timing-381.cjs, median of 3, warm-up excluded, `--refresh` per side)

Load at the start: `1.82 2.08 1.74` (12 CPUs, below the nproc/2 gate). Load at the end: `1.54 1.96 1.73`.

```
script=compute-state side=old runs=3 median_ms=7862 min_ms=7628 max_ms=7878 exit=0 load1=1.90 head=f556fc28a warmup_ms=7737 warmup_exit=0 runs_ms=[7862,7878,7628]
script=compute-state side=new runs=3 median_ms=1355 min_ms=1344 max_ms=1399 exit=0 load1=1.75 head=f556fc28a warmup_ms=1321 warmup_exit=0 runs_ms=[1344,1399,1355]
script=compute-meetings-intelligence side=new runs=3 median_ms=256 min_ms=235 max_ms=258 exit=0 load1=1.54 head=f556fc28a warmup_ms=242 warmup_exit=0 runs_ms=[235,258,256]
```

- compute-state: 7862 ms to 1355 ms. The Before value is 7977 ms; the plan-04 interim (legacy body with the NEW compute-team) was 5799 ms.
- compute-meetings-intelligence: 256 ms, about 19 percent of the NEW compute-state run (ruling 5).
- The head field reads f556fc28a because the commits landed after the runs. The NEW tree already carried the uncommitted header and the pool change, with the same bytes as `80a3559b7` and `bf1e06ff6`.
- An earlier run before the pool change gave `side=old median_ms=7871` and `side=new median_ms=1862`. A stage profile on the /mnt/c copy showed that phase A took about 840 ms: Last Updated ran section by section with sync lstat calls. After the change, phase A takes about 320 ms. The other stages are the team step (about 320 ms), the meetings spawn (about 240 ms) and phase B (about 390 ms: the second content list, the reads and the backslash-name grep).
- The bench copy was deleted after the runs.

## Spawn budget (tests/test-381-spawn-budget.cjs, PROVEN)

| Leg | Spawns | Detail |
|-----|--------|--------|
| state edge | 11 = EDGE_STATE_SPAWNS | 9 date-chain steps of the team step (6 `date -d`; `date -d`, `date -j -f` and `python3 -c DATE_PY_PROGRAM` for 2026-02-30), `bash scripts/compute-meetings-intelligence <room>`, `grep -lZE -- \[\[market.analysis\]\]\|room/market.analysis files...` |
| state edge plus 50 artifacts | 11 | 50 files in problem-definition (zero per-file spawns) |
| state hostile | 8 | 5 date-chain steps (the u8x team payload got `date -d` and `date -j -f` only, so no python3), 3 grep -lZE (the backslash name and the 2 payload folder names); no node; empty run cwd; no marker in the room |
| team and analyze legs (unchanged) | 9 / 9 / 5, 5 / 5 / 9 | as in 381-04 and 381-06 |
| net guard | log empty | |

Every spawn with `-c` or `-e` carries a constant program. The scaffold predicate, visual-ops and the registry read spawn nothing.

## Stop-gate persistState (ruling 4, PROVEN)

- `node tests/test-381-stop-gate-persist.cjs`: exit 0, `ok - A source pin ...`, `ok - B behaviour: closeOutRoom keeps gsd_state_version and status`, `stop-gate-persist: ALL PASS`. Leg B did not need the SKIP path.
- Negative control: with the HEAD version of the handler (the bare writeFileSync), both legs FAIL (`gsd_state_version: 1.0 is lost`). The file was restored after the check.
- `node tests/test-198-stop-gate-retry-ceiling.test.cjs`: `PASS (15 assertions)`.

## Acceptance results (PROVEN)

Task 1:
- `--direct --only compute-state`: exit 0, `parity: 0 diffs in 24 pairs`.
- The degrade string count is 1. The `runTeam(` count is 1. The `compute-meetings-intelligence` count is 4 (at least 1).
- The non-comment grep for `python3|node -e|'-e'|predicate CLI spawn|--count-content|--list-content` gives 0.
- `typeof readCurrentRoomSlug` gives `function`.

Task 2:
- GNU `grep -c` of the exec line gives 1. The exec line is line 11, and `set -euo pipefail` is line 15. `grep -c -- '--disable-warning'` gives 0. The shell grep of this host is ugrep, where `$` in a pattern is an anchor, so the check used `command grep` and `grep -cF`.
- `git ls-files -s scripts/compute-state` gives mode 100755. `git diff --numstat BASE_SHA -- scripts/compute-state` gives `9 0` (9 added lines, 0 removed).
- `grep -c "persistState(roomDir"` gives 1. `grep -c "writeFileSync(path.join(roomDir, 'STATE.md')"` gives 0.
- The parity runs: see the table above.
- The pinning tests each exit 0:
  - test-369-hook-require-graph (5 passed)
  - test-369-installed-layout (7 passed)
  - test-363.1-compute-state (all legs passed; leg D still reads the legacy text)
  - test-compute-state-persists (ALL PASS)
  - test-261029-kqv-stop-skip-recompute (ALL PASS, 23 s)
  - test-261029-lx3-sessionstart-skip (ALL PASS, 23 s)
  - test-266-room-state-description (12 passed)
  - run-all-2401.sh (PASS=8 FAIL=0 SKIP=0)
  - run-all-363.1.sh (PASS=12 FAIL=0 SKIP=1)
  - test-frontmatter-schema-reconcile (8/8)
  - test-365-falsify-missing-five
  - test-365-falsify-contradiction
  - statusline-active-room-write.test (7/7)
  - test-198-stop-gate-retry-ceiling (15 assertions)
  - test-381-stop-gate-persist (ALL PASS)
- After the pool change, test-363.1, compute-state-persists, stop-gate-persist, test-266 and test-369-hook-require-graph were run again. Each exits 0.
- `git status --porcelain tests/fixtures` was empty before and after test-phase-13.sh (32 passed) and test-phase-27-room-structure.sh (8 passed).
- NEW median 1355 ms is less than OLD median 7862 ms. The compute-meetings-intelligence line is recorded.

Task 3:
- `node tests/test-381-known-divergence.cjs`: exit 0 with 9 `ok - ` lines. These are the 3 team legs, the 4 analyze legs, `macos-python-path (compute-state)` and `no-experimental-warning (compute-state)`.
- The python-path leg runs both entry points with a PATH that has no python3. OLD exits 0 with no current_room line. NEW exits 0 and prints the line.
- The warning leg is not empty: without NODE_NO_WARNINGS, `node lib/core/room-render.cjs state` prints the node:sqlite ExperimentalWarning. Through the wrapper, stderr is 0 bytes.
- `node tests/test-381-spawn-budget.cjs`: exit 0. Both state edge legs print 11. `grep -c EDGE_STATE_SPAWNS` gives 7.
- `bash tests/run-all-381.sh`: exit 0, `Phase 381: PASS=10 FAIL=0 SKIP=0`, 43 s. Load1 was 1.45 at the start and 1.14 at the end. The Part 8 sweep lists all five lib modules as clean, room-render-state.cjs included.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] UTF-8 BOM in the registry**
- **Found during:** Task 1, registry probe against the python heredoc.
- **Issue:** TextDecoder drops a leading BOM by default, so NEW printed current_room where python json raises "Unexpected UTF-8 BOM" and OLD prints none.
- **Fix:** `new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })`; JSON.parse then rejects the BOM as python does.
- **Files modified:** lib/core/room-render-state.cjs
- **Commit:** f556fc28a

**2. [Rule 2 - Performance] Last Updated on slow file systems**
- **Found during:** Task 2 Step 6, the first timing run (NEW 1862 ms on the /mnt/c copy).
- **Issue:** A stage profile showed phase A at about 840 ms. lastUpdated ran section by section with a sync lstat per candidate, and each lstat is a round trip on /mnt/c.
- **Fix:** The candidates are stat'd through the room-scan bounded pool, and the sections run under Promise.all. The output bytes do not change: nothing writes between the counts and the dates.
- **Files modified:** lib/core/room-render-state.cjs
- **Commit:** bf1e06ff6 (a separate commit, so the Task 2 commit keeps its 3 planned paths)

**3. [Rule 1 - Clarification] Plan text versus bash for realpath and the content list**
- realLoose follows python's `_joinrealpath` (component walk, non-strict, loop guard). The plan's "longest existing prefix" wording is lexical. That wording differs from python for `..` after a symlink, a case the probe covers (equal results).
- The content list keeps the bash read-loop rule: paths are joined and split on LF. The section of a scan entry is the basename of its directory part, not the newline-stripped section name. Paths with an LF therefore give no reference, as in bash.

### Notes

- The acceptance greps that hold `$` were run with GNU grep (`command grep`). The shell `grep` of this host is ugrep, where `$` in a pattern is an anchor.
- The stop-gate handler requires persistState lazily inside `_closeOutStateMd`, so the module load of the MCP server does not change.

## Authentication gates

None.

## Known Stubs

None.

## Threat Flags

None. There is no new network path and no new write target: compute-state itself writes nothing, and the stop-gate write now goes through the existing persistState. The new spawns are the meetings script (fixed path, room as argv) and grep (pattern as one argv element after `--`). No program text is built from room data. The registry is parsed as JSON data, with no python and no eval.

## Issues Encountered

- STATE.md, ROADMAP.md and REQUIREMENTS.md were not written, as the orchestrator instructed.
- `/tmp/test-381-room-scan-kXIDJU` from an earlier plan is still on the host. It was left in place.
- A latent OLD behaviour, not reproduced and not hit by any gate room: bash `find | sort -rn | head -1` under pipefail can exit on SIGPIPE when one section holds more than about 600 `.md` files. NEW gives the correct date there. This is the Pitfall 6 class.

## Self-Check: PASSED

- lib/core/room-render-state.cjs, tests/test-381-stop-gate-persist.cjs exist; scripts/compute-state holds `room-render.cjs" state`; lib/mcp/stop-gate-handler.cjs holds `persistState(roomDir`.
- Commits f556fc28a, bf1e06ff6, 80a3559b7 and 667b12183 are ancestors of HEAD.
