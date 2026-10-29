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

(381-08 fills this section with the same three blocks on the same method.)

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
