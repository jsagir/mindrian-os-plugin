# Phase 381 Measurements

Plan 381-02. Real values only. Every number carries the host load and the HEAD sha it was taken on.

## Method

- Harness: the phase copy `bench/hook-bench-381.cjs` (diff against the read-only audit original in `bench/BENCH-DIFF.md`) and `bench/script-timing-381.cjs`.
- Median of 3 timed runs. Per-script runs add 1 untimed warm-up run first.
- Per-script timing: OLD tree = `git archive` of BASE_SHA, run on a `/mnt/c` COPY of the real room. No script ran on the real room directly.
- SessionStart and Stop: the bench starts the dev-tree hooks (worktree checkout) on the real room, with the room CHANGED by TOUCH on one artifact before each run (CONTEXT ruling 10). `SKIP=sessionstart-npm-reconcile` drops the only network-capable hook.
- Load gate: `/proc/loadavg` read before and after each block. The 1-minute load never exceeded 2.5 in any block, so no wait was needed and no block is flagged "host loaded".
- BASE_SHA: 65aaf329f9c514c71fff2f1a530cd366c0b87b66
- HEAD sha on which the numbers were taken: e696981a350aff07e73b33fef461ba2e53869225 (short e696981a3). The 381-02 bench commit is 0017dcf49. Commits after BASE_SHA add only new files (room-scan helpers and tests, bench files); `git diff --quiet BASE_SHA HEAD` over scripts/compute-state, compute-team, analyze-room, compute-meetings-intelligence, session-start-state, on-stop-state, lib/core/scaffold-predicate.cjs and lib/core/visual-ops.cjs exits 0, so the measured code equals the phase base.
- Date: 2026-10-29, window 21:19Z to 21:28Z (23:19 to 23:28 local).
- Host: aarch64, node v22.23.1, nproc 12, WSL2 (kernel 6.18), `/mnt/c` is 9p drvfs.
- Real room: `<ROOM>` (446 files, 135 MB).

## Before

### Block 1: per-script wall time on the /mnt/c copy (side=old, BASE_SHA tree)

| Metric | Median ms | Min ms | Max ms | Runs | load1 | Note |
|---|---|---|---|---|---|---|
| compute-team | 2535 | 2478 | 2587 | 3 | 0.77 | exit 0 |
| compute-state | 7977 | 7854 | 8078 | 3 | 0.86 | exit 0; calls compute-team as a sub-step |
| analyze-room | 22734 | 22690 | 22820 | 3 | 1.04 | exit 0 |
| compute-meetings-intelligence | 239 | 224 | 246 | 3 | 1.03 | exit 0 |

Load before the block: 0.79 1.06 1.18 (compute-team, compute-state at 21:20:58Z) and 0.80 1.01 1.16 (analyze-room, meetings at 21:21:53Z). Load after: 0.86 1.03 1.16 and 1.03 1.05 1.16.

Raw printed lines:

```
script=compute-team side=old runs=3 median_ms=2535 min_ms=2478 max_ms=2587 exit=0 load1=0.77 head=e696981a3 warmup_ms=2532 warmup_exit=0 runs_ms=[2587,2535,2478]
script=compute-state side=old runs=3 median_ms=7977 min_ms=7854 max_ms=8078 exit=0 load1=0.86 head=e696981a3 warmup_ms=7909 warmup_exit=0 runs_ms=[7977,8078,7854]
script=analyze-room side=old runs=3 median_ms=22734 min_ms=22690 max_ms=22820 exit=0 load1=1.04 head=e696981a3 warmup_ms=22379 warmup_exit=0 runs_ms=[22690,22820,22734]
script=compute-meetings-intelligence side=old runs=3 median_ms=239 min_ms=224 max_ms=246 exit=0 load1=1.03 head=e696981a3 warmup_ms=241 warmup_exit=0 runs_ms=[246,239,224]
```

### Block 2: SessionStart on the real room, room CHANGED

TOUCH target: `problem-definition/<meeting-file>.md` (see Notes, item 1, for why this file and not the newest `.md`). All 8 hooks start together; the event time is the slowest hook, `run-hook.cmd session-start` (analyze-room, then compute-state). Session-start-state.log shows `state mode=compute reason=newer:problem-definition/meeting-...` and `analyze mode=miss` in every one of the 3 runs, so every run was a true CHANGED run.

| Metric | Median ms | Min ms | Max ms | Runs | load1 before / after | Note |
|---|---|---|---|---|---|---|
| SessionStart CHANGED, 8 hooks | 26943 | 26596 | 26945 | 3 | 1.12 / 1.75 | run walls 26596, 26943, 26945 |

Raw printed lines (start 21:25:02Z, end 21:26:23Z; uptime load average at start 1.12 1.05 1.15, at end 1.75 1.26 1.21):

```
SessionStart     hooks=8 wall median=26943 ms  min=26596  max=26945  load1_before=1.12 load1_after=1.75  runs_ms=[26596,26943,26945]  slowest: "hooks/run-hook.cmd" session-start=26943ms, node "scripts/sessionstart-coordinator.cjs"=240ms
  hook "hooks/run-hook.cmd" session-start max=26943 ms
  hook node "scripts/sessionstart-coordinator.cjs" max=240 ms
  hook node "scripts/agentshield-sessionstart-scan. max=212 ms
  hook node "scripts/sessionstart-reference-now-see max=124 ms
  hook node "scripts/gsd-graph-derive-drain.cjs" max=111 ms
  hook node "scripts/sessionstart-post-update-prefl max=44 ms
  hook node "scripts/check-pending-breakthrough.cjs max=40 ms
  hook node "scripts/check-pending-ambiguous.cjs" max=38 ms
```

session-start-state.log lines in the window:

```
2026-10-29T21:25:03Z state mode=compute reason=newer:problem-definition/<meeting-file>.md
2026-10-29T21:25:23Z analyze mode=miss reason=newer:problem-definition/<meeting-file>.md rc=0 cached=yes
2026-10-29T21:25:29Z state mode=compute reason=newer:problem-definition/<meeting-file>.md
2026-10-29T21:25:51Z analyze mode=miss reason=newer:problem-definition/<meeting-file>.md rc=0 cached=yes
2026-10-29T21:25:56Z state mode=compute reason=newer:problem-definition/<meeting-file>.md
2026-10-29T21:26:17Z analyze mode=miss reason=state rc=0 cached=yes
```

### Block 3: Stop on the real room, room CHANGED

Same TOUCH target. Before the series, `scripts/on-stop` ran once with cwd = the room (result: `mode=skip reason=unchanged`, lock absent after 0 s). The Stop hook on a CHANGED room detaches compute-state, so the Stop event wall does not carry the cost. The real cost is the `on-stop-state-bg done elapsed_s=` line (ruling 10). `PAUSE_MS=1100` sleeps between runs so each TOUCH lands in a later clock second than the previous STATE.md write (see Notes, item 2).

| Metric | Median | Min | Max | Runs | load1 before / after | Note |
|---|---|---|---|---|---|---|
| Stop event wall, 8 hooks | 4688 ms | 4558 ms | 4702 ms | 3 | 0.82 / 1.00 | run walls 4558, 4688, 4702 ms; detached compute-state not included |
| on-stop-state-bg done elapsed_s | 5 s | 5 s | 6 s | 3 | 0.82 / 1.00 | integers as logged: 5, 5, 6 |

Raw printed lines (start 21:27:48Z, end 21:28:10Z; uptime load average at start 0.82 1.12 1.17, at end 1.00 1.15 1.18):

```
  waited 1513 ms for <ROOM>/.mindrian/state-recompute.lock
  waited 1510 ms for <ROOM>/.mindrian/state-recompute.lock
  waited 1517 ms for <ROOM>/.mindrian/state-recompute.lock
Stop             hooks=8 wall median=4688 ms  min=4558  max=4702  load1_before=0.82 load1_after=1.00  runs_ms=[4558,4688,4702]  slowest: "hooks/run-hook.cmd" on-stop=4702ms, node "scripts/hmi-compliance-poll.cjs" --hoo=204ms
  hook "hooks/run-hook.cmd" on-stop max=4702 ms
  hook node "scripts/hmi-compliance-poll.cjs" --hoo max=204 ms
  hook node "scripts/ambient-stop.cjs" --stop max=199 ms
  hook node "scripts/operator-update.cjs" max=91 ms
  hook node "scripts/jtbd-update.cjs" stop max=88 ms
  hook node "scripts/check-card-fire.cjs" max=84 ms
  hook node "scripts/gsd-graph-derive-sweep.cjs" max=82 ms
  hook node "scripts/check-voice-style.cjs" max=75 ms
```

Last 3 `on-stop-state-bg done elapsed_s=` lines of `.mindrian/session-close.log` after the series:

```
2026-10-29T21:27:54Z on-stop-state-bg done elapsed_s=5
2026-10-29T21:28:01Z on-stop-state-bg done elapsed_s=5
2026-10-29T21:28:09Z on-stop-state-bg done elapsed_s=6
```

Detach decisions in the series (session-close.log): `on-stop-state mode=detached reason=newer:problem-definition/<meeting-file>.md` at 21:27:49Z, 21:27:56Z and 21:28:03Z.

## After

Plan 381-08. Same method, same bench files, same TOUCH target, same env as the Before section. Real values only.

- HEAD sha: 17a964e18a46e6fa33d71af41e701aee3b29dd31 (short 17a964e18). The code is the code of 5affaf2b6 (plans 381-01 to 381-07): commit 17a964e18 adds only 381-PARITY.md. All three entry points run the node renderers; the legacy bash bodies stay behind `MINDRIAN_LEGACY_COMPUTE=1`.
- BASE_SHA (the OLD side): 65aaf329f9c514c71fff2f1a530cd366c0b87b66.
- Date: 2026-10-29, window 23:08:08Z to 23:13:05Z (2026-10-30 01:08 to 01:13 local). Quiet window arranged by the orchestrator: the other sessions were on hold.
- Host: aarch64, node v22.23.1, nproc 12, WSL2 (kernel 6.18), `/mnt/c` is 9p drvfs.
- Load gate: limit nproc / 2 = 6.0. No block waited (`gate waits=0` before Blocks 1, 2 and 3).
- Idle server process: pid 339036 (next-server, Next 16.2.10, not part of this work). At the start and at the end of each block `ps` showed %CPU 0.0 and `top` showed %CPU 0.0, RSS 105656 KB. Its cumulative CPU time (top TIME+) was 0:13.41 at 23:08:08Z and 0:13.42 at 23:13:05Z, so it used 0.01 s of CPU in the whole window.

### Block 1: per-script wall time on the /mnt/c copy (OLD then NEW, back to back)

The first call used `--refresh` and made a new copy of the real room. The copy held 450 files after the block: the 447 files of the room plus 3 transient files under `.mindrian/` (`room.db-shm`, `room.db-wal`, `write.lock`, all present in the room at copy time). The copy is complete: no file of the room was missing from it.

| Metric | Side | Median ms | Min ms | Max ms | Runs | load1 | Note |
|---|---|---|---|---|---|---|---|
| compute-team | old | 2603 | 2550 | 2638 | 3 | 1.09 | exit 0 |
| compute-team | new | 362 | 353 | 364 | 3 | 1.09 | exit 0 |
| compute-state | old | 7937 | 7905 | 8065 | 3 | 1.16 | exit 0; calls compute-team as a sub-step |
| compute-state | new | 1341 | 1315 | 1342 | 3 | 1.14 | exit 0 |
| analyze-room | old | 21993 | 21704 | 22129 | 3 | 1.42 | exit 0 |
| analyze-room | new | 1231 | 1204 | 1290 | 3 | 1.55 | exit 0 |
| compute-meetings-intelligence | old | 236 | 231 | 236 | 3 | 1.55 | exit 0 |
| compute-meetings-intelligence | new | 237 | 236 | 241 | 3 | 1.51 | exit 0; not ported (ruling 5) |

Load before the block (23:08:08Z): 1.16 0.94 1.19. Load after (23:10:54Z): 1.51 1.16 1.22.

Raw printed lines:

```
script=compute-team side=old runs=3 median_ms=2603 min_ms=2550 max_ms=2638 exit=0 load1=1.09 head=17a964e18 warmup_ms=2462 warmup_exit=0 runs_ms=[2603,2638,2550]
script=compute-team side=new runs=3 median_ms=362 min_ms=353 max_ms=364 exit=0 load1=1.09 head=17a964e18 warmup_ms=358 warmup_exit=0 runs_ms=[362,364,353]
script=compute-state side=old runs=3 median_ms=7937 min_ms=7905 max_ms=8065 exit=0 load1=1.16 head=17a964e18 warmup_ms=8100 warmup_exit=0 runs_ms=[8065,7937,7905]
script=compute-state side=new runs=3 median_ms=1341 min_ms=1315 max_ms=1342 exit=0 load1=1.14 head=17a964e18 warmup_ms=1339 warmup_exit=0 runs_ms=[1342,1315,1341]
script=analyze-room side=old runs=3 median_ms=21993 min_ms=21704 max_ms=22129 exit=0 load1=1.42 head=17a964e18 warmup_ms=22560 warmup_exit=0 runs_ms=[21704,21993,22129]
script=analyze-room side=new runs=3 median_ms=1231 min_ms=1204 max_ms=1290 exit=0 load1=1.55 head=17a964e18 warmup_ms=1318 warmup_exit=0 runs_ms=[1231,1290,1204]
script=compute-meetings-intelligence side=old runs=3 median_ms=236 min_ms=231 max_ms=236 exit=0 load1=1.55 head=17a964e18 warmup_ms=238 warmup_exit=0 runs_ms=[236,231,236]
script=compute-meetings-intelligence side=new runs=3 median_ms=237 min_ms=236 max_ms=241 exit=0 load1=1.51 head=17a964e18 warmup_ms=241 warmup_exit=0 runs_ms=[236,237,241]
```

### Block 2: SessionStart on the real room, room CHANGED

TOUCH target: the same `problem-definition/<meeting-file>.md` as Before (found by its content sha256 5132d5d22df0d8830d9d9db09a00e92640199413a3f982c1f498d4bffb9ae4c8). `SKIP=sessionstart-npm-reconcile`. session-start-state.log shows `state mode=compute reason=newer:problem-definition/<meeting-file>.md` and `analyze mode=miss` in each of the 3 runs, so every run was a true CHANGED run.

| Metric | Median ms | Min ms | Max ms | Runs | load1 before / after | Note |
|---|---|---|---|---|---|---|
| SessionStart CHANGED, 8 hooks | 7775 | 7678 | 7881 | 3 | 0.86 / 1.40 | run walls 7881, 7678, 7775 |

Raw printed lines (start 23:11:47Z, end 23:12:11Z; uptime load average at start 0.86 1.03 1.17, at end 1.40 1.14 1.21):

```
SessionStart     hooks=8 wall median=7775 ms  min=7678  max=7881  load1_before=0.86 load1_after=1.40  runs_ms=[7881,7678,7775]  slowest: "hooks/run-hook.cmd" session-start=7874ms, node "scripts/sessionstart-coordinator.cjs"=254ms
  hook "hooks/run-hook.cmd" session-start max=7874 ms
  hook node "scripts/sessionstart-coordinator.cjs" max=254 ms
  hook node "scripts/agentshield-sessionstart-scan. max=204 ms
  hook node "scripts/sessionstart-reference-now-see max=117 ms
  hook node "scripts/gsd-graph-derive-drain.cjs" max=112 ms
  hook node "scripts/sessionstart-post-update-prefl max=66 ms
  hook node "scripts/check-pending-ambiguous.cjs" max=55 ms
  hook node "scripts/check-pending-breakthrough.cjs max=55 ms
```

session-start-state.log lines in the window:

```
2026-10-29T23:11:48Z state mode=compute reason=newer:problem-definition/<meeting-file>.md
2026-10-29T23:11:50Z analyze mode=miss reason=script rc=0 cached=yes
2026-10-29T23:11:56Z state mode=compute reason=newer:problem-definition/<meeting-file>.md
2026-10-29T23:11:58Z analyze mode=miss reason=newer:problem-definition/<meeting-file>.md rc=0 cached=yes
2026-10-29T23:12:03Z state mode=compute reason=newer:problem-definition/<meeting-file>.md
2026-10-29T23:12:05Z analyze mode=miss reason=newer:problem-definition/<meeting-file>.md rc=0 cached=yes
```

### Block 3: Stop on the real room, room CHANGED

Same TOUCH target. Before the series, `scripts/on-stop` ran once with cwd = the room (result: `mode=detached`, `on-stop-state-bg done elapsed_s=1`, lock absent when the hook returned). Then the series ran with `WAIT_ABSENT=<ROOM>/.mindrian/state-recompute.lock` and `PAUSE_MS=1100`, as in Before. The Stop event wall does not carry the detached compute-state; the `on-stop-state-bg done elapsed_s=` lines carry it (ruling 10).

| Metric | Median | Min | Max | Runs | load1 before / after | Note |
|---|---|---|---|---|---|---|
| Stop event wall, 8 hooks | 4851 ms | 4816 ms | 4861 ms | 3 | 0.92 / 1.23 | run walls 4861, 4816, 4851 ms; detached compute-state not included |
| on-stop-state-bg done elapsed_s | 0 s | 0 s | 1 s | 3 | 0.92 / 1.23 | integers as logged: 1, 0, 0 |

Raw printed lines (start 23:12:47Z, end 23:13:05Z; uptime load average at start 0.91 1.04 1.17, at end 1.23 1.11 1.19):

```
  waited 2 ms for <ROOM>/.mindrian/state-recompute.lock
  waited 2 ms for <ROOM>/.mindrian/state-recompute.lock
  waited 2 ms for <ROOM>/.mindrian/state-recompute.lock
Stop             hooks=8 wall median=4851 ms  min=4816  max=4861  load1_before=0.92 load1_after=1.23  runs_ms=[4861,4816,4851]  slowest: "hooks/run-hook.cmd" on-stop=4861ms, node "scripts/hmi-compliance-poll.cjs" --hoo=181ms
  hook "hooks/run-hook.cmd" on-stop max=4861 ms
  hook node "scripts/hmi-compliance-poll.cjs" --hoo max=181 ms
  hook node "scripts/ambient-stop.cjs" --stop max=163 ms
  hook node "scripts/check-card-fire.cjs" max=60 ms
  hook node "scripts/gsd-graph-derive-sweep.cjs" max=57 ms
  hook node "scripts/operator-update.cjs" max=57 ms
  hook node "scripts/jtbd-update.cjs" stop max=54 ms
  hook node "scripts/check-voice-style.cjs" max=47 ms
```

Last 3 `on-stop-state-bg done elapsed_s=` lines of `.mindrian/session-close.log` after the series:

```
2026-10-29T23:12:49Z on-stop-state-bg done elapsed_s=1
2026-10-29T23:12:54Z on-stop-state-bg done elapsed_s=0
2026-10-29T23:13:00Z on-stop-state-bg done elapsed_s=0
```

Detach decisions in the series (session-close.log): `on-stop-state mode=detached reason=newer:problem-definition/<meeting-file>.md` at 23:12:48Z, 23:12:54Z and 23:13:00Z. The session-close.log lines from the pre-step to the series end are 16 lines: 4 lines for each of the 4 Stop runs (pre-step plus 3), and no line from another Stop.

### Before and After

Before = 381-02 (HEAD e696981a3, scripts equal to BASE_SHA). After = this section (HEAD 17a964e18). For the per-script rows After is the NEW side.

| Metric | Before median | After median | Change |
|---|---|---|---|
| compute-team on the /mnt/c copy | 2535 ms | 362 ms | -2173 ms |
| compute-state on the /mnt/c copy | 7977 ms | 1341 ms | -6636 ms |
| analyze-room on the /mnt/c copy | 22734 ms | 1231 ms | -21503 ms |
| compute-meetings-intelligence on the /mnt/c copy | 239 ms | 237 ms | -2 ms (script not changed, ruling 5) |
| SessionStart CHANGED, real room, 8 hooks | 26943 ms | 7775 ms | -19168 ms |
| Stop event wall CHANGED, real room, 8 hooks | 4688 ms | 4851 ms | +163 ms |
| on-stop-state-bg done elapsed_s, real room | 5 s | 0 s | -5 s |

Same-run check (OLD and NEW back to back in Block 1 of this section): compute-team 2603 ms to 362 ms, compute-state 7937 ms to 1341 ms, analyze-room 21993 ms to 1231 ms, compute-meetings-intelligence 236 ms to 237 ms. The OLD medians of this run are within 741 ms of the Before medians (analyze-room 21993 against 22734).

### mtime list (After)

Snapshots (`find <ROOM> -printf '%T@ %y %P'`, every entry of the room) were taken before Block 1 (23:08:08Z), before and after Block 2, and before and after Block 3. The raw lists are kept in the session scratchpad until this plan closes and are summarised here. Series windows (UTC): Block 1 23:08:15 to 23:10:54 (runs on the copy only); Block 2 23:11:47 to 23:12:11; Block 3 pre-step 23:12:41 to 23:12:46; Block 3 series 23:12:47 to 23:13:05.

Block 2 window (45 changed entries):

| Files | Written by | Inside the CHANGED determination? |
|---|---|---|
| `problem-definition/<meeting-file>.md` | the bench TOUCH (mtime only; content sha256 unchanged) | Yes, on purpose. Every `reason=newer:` line names this file. |
| `MEETINGS-INTELLIGENCE.md`, `action-items.md`, `team/TEAM-STATE.md` | compute-state and its sub-steps | No: named in the lx3 ignore list. |
| `<section>/FEYNMAN.md` (11 sections) | SessionStart generators | No: named in the lx3 ignore list. |
| `team/partners/<person-1..4>/PROFILE.md`, `team/founders/<person-5>/PROFILE.md` | compute-team (rewrites PROFILE.md on every run, CONTEXT ruling 6) | Not in the ignore list; written during the compute, before the analyze cache. No log line names a PROFILE.md as the `newer:` reason. |
| Under `.mindrian/`: `analyze-room.cache`, `graph-derive-queue.json`, `graph-derive-vectors.json`, `minto-queue.json`, `room.db`, `session-context.txt`, `session-start-state.log`, `statusline-cache.json` | hooks | No: hidden directory, pruned by the find. |
| The 11 section directories, `team/...` directories, `.mindrian` | directory mtime moved because files were rewritten in them | No: the find uses `-type f`. |

No decision trace was written in the Block 2 window.

Block 3 window (pre-step and series, 37 changed entries up to the post-Block-3 snapshot, taken after 23:13:22Z):

| Files | Written by | Inside the CHANGED determination? |
|---|---|---|
| `problem-definition/<meeting-file>.md` | the bench TOUCH | Yes, on purpose. Every `reason=newer:` line names this file. |
| `STATE.md`, `MEETINGS-INTELLIGENCE.md`, `action-items.md`, `team/TEAM-STATE.md` | compute-state and its sub-steps | No: named in the lx3 ignore list. The snapshot shows the last write only (STATE.md at 23:13:22Z, after the series; see Notes item 11). |
| `<section>/MINTO.md` (2 files) | Stop generators | No: named in the lx3 ignore list. |
| `team/partners/<person-1..4>/PROFILE.md`, `team/founders/<person-5>/PROFILE.md` | compute-team (the snapshot shows the last write only) | Not in the ignore list; no log line names one as the `newer:` reason. |
| `.context/last-session.md` and, under `.mindrian/`: `ambient-run-ledger.json`, `graph-derive-queue.json`, `invariant-report.json`, `last-cascade.json`, `last-hmi-poll.json`, `minto-queue.json`, `minto-stale.json`, `pending-tier1-regen.json`, `recompile-stamps.json`, `room.db`, `session-close.log`, `session-snapshot.json` | hooks | No: hidden entries are pruned by the find. |

Decision traces by a session id other than the bench: `5ecdb98a` wrote 2 files at 23:13:15Z, after the series end (23:13:05Z). In the Block 1 window `5ecdb98a` wrote 2 files at 23:09:35Z (see Notes item 10).

## mtime list

Snapshots (`stat -c '%y %n'` of every top-level entry of the room, and every file under `.mindrian/`): taken at 21:19:08Z (before Block 1), before Block 2, before Block 3, before the final Stop series, and at 21:29Z (after Block 3). The raw lists are kept in the session scratchpad and summarised here.

Series windows (UTC): Block 2 first attempt 21:23:34 to 21:24:09 (discarded, Notes item 1); Block 2 21:25:02 to 21:26:23; Block 3 pre-step 21:26:33 to 21:26:37; Block 3 first attempt 21:26:47 to 21:27:04 (discarded, Notes item 2); Block 3 final 21:27:48 to 21:28:10. Local time is UTC plus 2 hours.

Files whose mtime fell inside a series window, and the lx3 determination (the `room_newer` find in `scripts/session-start-state` ignores hidden entries, `STATE.md`, `STATE.md.tmp.*`, `FEYNMAN.md`, `MINTO.md`, `BRIEF.md`, `MEETINGS-INTELLIGENCE.md`, `action-items.md` and `team/TEAM-STATE.md`):

| Files | Written by | Inside the CHANGED determination? |
|---|---|---|
| `problem-definition/<meeting-file>.md` | the bench TOUCH (mtime only; content sha256 unchanged) | Yes, on purpose. Every `reason=newer:` line in the logs names this file. |
| `STATE.md`, `MEETINGS-INTELLIGENCE.md`, `action-items.md`, `team/TEAM-STATE.md` | compute-state and its sub-steps | No: named in the lx3 ignore list. |
| `<section>/FEYNMAN.md`, `<section>/MINTO.md`, `<section>/BRIEF.md` (all 12 sections, including `team` and `team-execution`) | SessionStart and Stop generators | No: named in the lx3 ignore list. This is why the first TOUCH target, `problem-definition/FEYNMAN.md`, did not make the room CHANGED. |
| `team/partners/<person-1..4>/PROFILE.md`, `team/founders/<person-5>/PROFILE.md` | compute-team (rewrites PROFILE.md on every run, CONTEXT ruling 6) | Not in the ignore list, but content equals the pre-bench copy, and these are written during the compute, before `STATE.md` and the analyze cache. No log line names a PROFILE.md as the `newer:` reason. |
| `.context/last-session.md`, `opportunity-bank/.mindrian/last-cascade.json`, `funding/.mindrian/last-cascade.json` | hooks | No: hidden entries are pruned by the find. |
| Under `.mindrian/`: `analyze-room.cache`, `ambient-run-ledger.json`, `graph-derive-queue.json`, `invariant-report.json`, `last-cascade.json`, `last-hmi-poll.json`, `minto-queue.json`, `minto-stale.json`, `pending-tier1-regen.json`, `recompile-stamps.json`, `room.db`, `session-close.log`, `session-context.txt`, `session-snapshot.json`, `session-start-state.log`, `statusline-cache.json`, `decision-traces/*.json` | hooks | No: hidden directory, pruned. |
| Top-level directories (the 12 section directories) | directory mtime moved because generated files were rewritten in them | No: the find uses `-type f`. |

Foreign writes: `.mindrian/decision-traces/` files for two session ids other than the bench (`5ecdb98a-...` at 21:25:48Z, `38933ce6-...` at 21:26:11Z) and one for `3085a95e-...` (21:25:01Z) changed inside the Block 2 window. All sit in `.mindrian/` (pruned by the find), so they cannot change the CHANGED determination. Their CPU cost was small (load stayed below 1.8).

Files inside the room whose content changed from the pre-bench copy: the generated files above (STATE.md, the section FEYNMAN.md / MINTO.md / BRIEF.md, TEAM-STATE.md, action-items.md, MEETINGS-INTELLIGENCE.md, `.context/last-session.md`, the two last-cascade.json files). This is the normal output of the shipped hooks. For `problem-definition/FEYNMAN.md` the whole difference is three render timestamps (`timeline_last_rendered`, `dial_memory_last_rendered`, `Last refreshed`).

## Notes

1. TOUCH target. The plan names the newest `.md` at depth 1 of `problem-definition`, which is `FEYNMAN.md`. The lx3 rule (quick 261029-lx3, `room_newer`) ignores `FEYNMAN.md`, so touching it does not change the room. A first SessionStart series on `FEYNMAN.md` confirmed it: `state mode=reuse reason=unchanged` three times, and the series ran faster after run 1. Discarded numbers: run walls 21474, 6683 and 6483 ms (median 6683 ms); load1 0.87 to 1.13; run 1 showed `analyze mode=miss reason=script` and runs 2 and 3 `analyze mode=hit reason=unchanged`. The final series uses the newest non-ignored `.md` at depth 1 of `problem-definition`: `<meeting-file>.md`.
2. Stop first attempt, discarded. With no pause between runs, the second TOUCH landed in the same clock second as the previous `STATE.md` write and the room read as unchanged (`on-stop-state mode=skip reason=unchanged`). The `/mnt/c` 9p mount keeps whole seconds only. Discarded numbers: run walls 4607, 4998 and 4633 ms (median 4633 ms), elapsed_s 6 and 6 for the two detached runs. Fix: `PAUSE_MS=1100` in the bench (recorded in `bench/BENCH-DIFF.md`). The final series shows 3 detached runs.
3. A first Block 1 attempt with `--refresh` failed partway: `cp -a` could not stat `.mindrian/write.lock`, a transient lock file in the live room. compute-team did not run, and compute-state ran on the partial copy (median 8033 ms, discarded). The copy was recreated whole (445 files) and the whole block was repeated; the numbers above come from the repeat.
4. Sub-second mtime restore is not possible on this mount (9p drvfs truncates utimensat to whole seconds). The two touched files were restored to the whole second. Originals: `problem-definition/FEYNMAN.md` 1793302843.220520600 restored to 1793302843; `problem-definition/<meeting-file>.md` 1793272733.039968600 restored to 1793272733. The meeting file's content sha256 (5132d5d22df0d8830d9d9db09a00e92640199413a3f982c1f498d4bffb9ae4c8) is unchanged.
5. `problem-definition/FEYNMAN.md` content changed (sha256 8a243607... before, 9f568557... after). The shipped SessionStart and Stop hooks regenerated its three render timestamps, as they do in every normal session. The bench did not write the file. Original bytes and the diff are kept in the session scratchpad. It was not overwritten, because the next normal session regenerates it again and the measurement rule forbids editing room content.
6. HEAD moved while this plan waited for the quiet window (plan 381-03 landed room-scan helpers). The measured scripts and hooks are identical to BASE_SHA, so the numbers still describe the phase base.
7. Evidence that the room was not fully quiet: decision-traces for two other session ids were written during Block 2 (see mtime list). Load stayed below 1.8 in all blocks.
8. The SessionStart CHANGED event wall (26943 ms) is not the sum of the copy timings of analyze-room and compute-state; no cause was investigated in this plan.
9. After series (381-08), load and the idle server. load1 stayed between 0.86 and 1.55 in all three blocks; no block waited at the gate. The next-server process pid 339036 showed %CPU 0.0 at the start and the end of each block and used 0.01 s of CPU in the whole window (TIME+ 0:13.41 to 0:13.42).
10. After series, foreign activity in the Block 1 window. From 23:09:35Z to 23:10:02Z a Stop cycle that the bench did not start ran on the real room: decision traces of session `5ecdb98a`, a STATE.md, PROFILE.md and TEAM-STATE.md rewrite, and `on-stop-brief` and `on-stop-phase88` lines at 23:10:01Z in session-close.log (more such lines at 23:07:50Z and 23:08:07Z, before Block 1). Block 1 runs only on the /mnt/c copy, so the room writes did not reach the measured files. The cycle overlapped the analyze-room OLD runs (23:09:18Z to 23:10:47Z); load1 went from 1.16 to 1.55, and the analyze-room OLD median (21993 ms) is lower than its Before value (22734 ms). Blocks 2 and 3 show no foreign line: 6 session-start-state lines for 3 SessionStart runs and 16 session-close lines for 4 Stop runs.
11. After series, writes after the window. From 23:13:05Z on, compute-state processes of the installed plugin (beta.75 cache, not the dev tree) ran on the real room; their parent is the Claude Code process that hosts this executor. They started after the series end (their pids are higher than the pid counter at the post-Block-3 probe). They wrote STATE.md at 23:13:22Z and later. They are not in any measured number.
12. After series, elapsed_s. `elapsed_s` is bash SECONDS, a count of whole-second boundaries, so 0 means the background rebuild started and ended inside one clock second. The Before series also showed the real room faster than the copy (elapsed_s 5, 5, 6 against 7977 ms on the copy); the After series shows the same direction (1, 0, 0 against 1341 ms).
13. After series, Stop event wall. The Stop event wall did not go down (4688 ms Before, 4851 ms After). It never carried the compute-state cost after quick kqv: compute-state runs detached. The slowest Stop hook is on-stop, whose other steps `on-stop-phase88` (2896 to 2936 ms in the series) and `on-stop-brief` (1222 to 1273 ms) are outside this phase.
14. After series, compute-meetings-intelligence NEW (237 ms) is not lower than its OLD median in the same run (236 ms). The script is not ported (ruling 5); both sides run the same bash.
15. After series, the Block 3 pre-step read the room as CHANGED (`mode=detached`), while the Before pre-step read it as unchanged. The SessionStart series does not write STATE.md (its STATE.md mtime stayed at 23:09:57Z through Block 2), so the TOUCH of the last SessionStart run was still newer than STATE.md. The pre-step rebuild ended in 1 s and the lock was absent before the series started.
16. After series, TOUCH restore. The meeting file mtime was 1793315579 after the series and was restored to 1793272733 (the value before Block 1, whole seconds on this mount). Its content sha256 is 5132d5d22df0d8830d9d9db09a00e92640199413a3f982c1f498d4bffb9ae4c8, unchanged. The /mnt/c copy was deleted after the series.
