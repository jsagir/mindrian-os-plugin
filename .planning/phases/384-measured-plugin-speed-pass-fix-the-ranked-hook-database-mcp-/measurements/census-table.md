# Phase 384 plan 04: process census, walls and SubagentStop scaling (fixture room)

Written by plan 384-04, 2026-11-05.
Tree: a pinned export of BASE_SHA_384 (db2ea3b05bb70b55741bdeb40b545801b0c37cbe), label `pinned-db2ea3b05`. The live checkout was not measured (owner instruction: a peer edits product files there).
Room: the fixture room (64 files, file system reported as ext2/ext3 by stat -f, 12 cores, CPU cap 0-3, Node v22.23.1, Linux arm64 under WSL2). No real room and no real-room copy was used. Real-room copy sections are added by plan 384-08.
Counter: `bench/exec-counter.c`, an LD_PRELOAD library, because strace is not installed. Calibration: exactly 7 on the known bash script and exactly 5 on the known node script (check file `bench/test-process-census.cjs`, 43 checks, ALL PASS before the runs and again after the last code change).
The network-capable npm reconcile hook of SessionStart is not run (skipped: 1), so every SessionStart number is a lower bound. The census counts the descendants of each hook shell. The processes that Claude Code itself starts are not counted.
Files: `census-fixture.json` (counts schema, 3 repeats), `census-walls-fixture-s1.json` and `-s2.json` (n = 7), `census-walls-fixture-s1-rerun.json` and `-s2-rerun.json` (n = 15, the targets whose first spread was above 10 percent), `census-spread.json`, `session-start-blocks.json`, `subagent-files.json`.

## Table 1: processes started per event (counted, exec calls)

Three repeats per event. Processes are the exec calls of the descendants of the hook shells, from the final census run. A first census run of the same command (not kept as a result file) gave the same repeats on 8 of the 14 keys; the keys that differ are named in notes 1 and 3.

| Event key | Hooks matched (blocking, async, skipped) | Processes started, median (min-max) | node starts | bash/sh starts | find walks | Survivor CPU ms (lower bound) | Tail after last hook ms (median) |
|-----------|------------------------------------------|-------------------------------------|-------------|----------------|------------|-------------------------------|----------------------------------|
| SessionStart:startup:unchanged (took the compute path, see note 2) | 8 (8, 0, 1) | 99 (99-99) | 44 | 8 | 3 | 150 | 14,870 |
| SessionStart:startup:changed | 8 (8, 0, 1) | 103 (103-103) | 45 | 9 | 3 | 150 | 14,872 |
| SessionStart:compact | 8 (8, 0, 1) | 99 (99-99) | 44 | 8 | 3 | 170 | 14,872 |
| UserPromptSubmit | 8 (8, 0, 0) | 19 (18-31) | 13 | 2 | 0 | 800 | 178 |
| Stop:unchanged:tx4m | 8 (7, 1, 0) | 101 (101-101) | 36 | 4 | 4 | 0 | 182 |
| Stop:changed:tx4m | 8 (7, 1, 0) | 110 (110-110) | 38 | 6 | 4 | 0 | 187 |
| PostToolUse:Write | 8 (8, 0, 0) | 36 (36-44) | 9 | 3 | 0 | 0 | 0 |
| PostToolUse:Read | 2 (2, 0, 0) | 2 (2-2) | 2 | 0 | 0 | 0 | 0 |
| TaskCompleted | 1 (1, 0, 0) | 77 (77-77) | 2 | 4 | 15 | 0 | 0 |
| PreCompact | 1 (1, 0, 0) | 27 (27-27) | 3 | 2 | 1 | 0 | 0 |
| PostCompact | 1 (1, 0, 0) | 93 (36-95) | 35 | 8 | 5 | 150 | 14,864 |
| SubagentStop:files1 (after other events) | 1 (1, 0, 0) | 5,502 (3,192-5,502) | 9 | 12 | 33 | 2,200 | 7,210 |
| SubagentStop:files5 (after other events) | 1 (1, 0, 0) | 22,159 (21,602-22,971) | 45 | 44 | 91 | 8,930 | 11,586 |
| SubagentStop:files20 (after other events) | 1 (1, 0, 0) | 21,226 (20,842-24,690) | 162 | 144 | 317 | 20,940 | 15,826 |

Notes on the counts:
1. The first repeat of an event is often larger than the later ones: UserPromptSubmit 31 then 18 and 19, PostCompact 36 then 93 and 95 (first run: 31, 15, 15 and 36, 96, 93); Stop:unchanged:tx4m had 110, 101, 101 in the first run and 101 in all three repeats in the final run. The median and the min-max are given for that reason. A count is exact for one run; it is not one fixed number for an event.
2. The key SessionStart:startup:unchanged never reached the unchanged path in the fixture room: the state step logged `mode=compute reason=registry` in 8 of 8 probe starts and in 3 of 3 counted repeats, because the rooms registry file is newer than STATE.md at every start. So its count (99) is the compute path with an analyze cache hit. The wall time of this target is NOT MEASURED (verify-results rejects an :unchanged target that takes the changed path).
3. SubagentStop in the full census (rows above) and in the scaling run (Table 4) differ. In the scaling run, after 7 rounds on the same room, the counts were stable: 2,604 (2,604-2,604) at 1 file and 12,703 (12,703-12,703) at 5 files. In the full census, run once after the other events, they were 3,192-5,502 and 21,602-22,971 (first census run: 3,188-5,498 and 11,852-12,753). The cascade runs compute-state and build-graph in the background and races with itself; the cause of the difference is not isolated (UNVERIFIED).
4. Survivor CPU is a lower bound: the CPU time of each process at its last poll (10 ms cadence), summed. A process that lives for less than 10 ms adds nothing to it.
5. The tail is the time from the last blocking hook exit to the last live process that carries the run marker.

### Where the SessionStart and PostCompact tail comes from

The survivors after SessionStart and PostCompact are `bash session-start` (the shell that holds the detached jobs) and `node brain-prewarm.cjs` (PROVEN: names from /proc, program and script base names only). The tail is 14.86 to 14.87 s in every repeat of those three events. `lib/core/brain-prewarm.cjs` has a default timeout of 15000 ms; this is the likely cause of the constant tail (UNVERIFIED: the census did not read the timer). In this run the Brain URL is an unreachable loopback, so the tail on a real install can differ.
After UserPromptSubmit the survivors are 5 `node brain-derivation-drain.cjs` processes (CPU lower bound 800 ms). After Stop, one `sleep`. After SubagentStop the survivors are mostly `bash build-graph` and its short children (grep, sed, head, tr).

## Table 2: wall time per event (fixture room, two sets)

Wall time is the time until the last blocking hook exits (separate runs without the counter; each child under taskset -c 0-3). Set 1 and set 2 are two runs of the same tree. A target whose first spread was above 10 percent shows the n = 15 re-run of both sets (marked `n=15`). The first-pass medians of those targets are in `census-spread.json`.

| Event key | Wall median ms, set 1 / set 2 | Wall p95 ms, set 1 / set 2 | n | Spread percent | Longest hook (median ms) | Summed hook CPU ms, set 1 / set 2 | Background after return ms (harness settle), set 1 / set 2 | load1 at start |
|-----------|-------------------------------|----------------------------|---|----------------|--------------------------|-----------------------------------|--------------------------------------------------------------|----------------|
| SessionStart:startup:unchanged | NOT MEASURED | NOT MEASURED | - | - | - | - | - | - |
| SessionStart:startup:changed | 2,764.3 / 2,733.5 | 3,647.7 / 3,663.8 | 15 (n=15) | 1.1 (first pass 47.6) | run-hook session-start (2,734) | 2,820 / 2,930 | 15,037 / 14,945 | 0.64-1.89 |
| SessionStart:compact | 2,685.1 / 2,635.7 | 3,585.8 / 3,419.4 | 15 (n=15) | 1.9 (first pass 52.9) | run-hook session-start (2,636) | 2,840 / 2,770 | 14,995 / 14,963 | 0.61-0.88 |
| UserPromptSubmit | 108.6 / 109.1 | 246.8 / 298.0 | 7 | 0.5 | brain-derivation-drain.cjs (109) | 250 / 240 | 5 / 4 | 1.13-1.98 |
| Stop:unchanged:tx4m | 1,244.1 / 1,224.1 | 1,273.6 / 1,273.8 | 7 | 1.6 | run-hook on-stop (1,224) | 1,520 / 1,510 | 411 / 416 | 1.30-1.33 |
| Stop:changed:tx4m | 1,241.5 / 1,344.2 | 1,246.7 / 1,391.4 | 7 | 7.9 | run-hook on-stop (1,344) | 1,530 / 1,640 | 412 / 214 | 1.51-1.57 |
| PostToolUse:Write | 200.0 / 210.0 | 447.6 / 443.9 | 15 (n=15) | 4.9 (first pass 76.7) | run-hook post-write (203) | 420 / 430 | 4 / 5 | 1.10-1.93 |
| PostToolUse:Read | 32.9 / 34.0 | 34.0 / 37.9 | 7 | 3.3 | query-efficiency-telemetry.cjs (34) | 40 / 40 | 3 / 3 | 1.23-1.79 |
| TaskCompleted | 205.8 / 197.7 | 207.2 / 203.7 | 7 | 4.0 | run-hook on-task-complete (198) | 250 / 240 | 3 / 3 | 1.23-1.79 |
| PreCompact | 220.9 / 214.8 | 227.9 / 216.7 | 7 | 2.8 | run-hook pre-compact (215) | 210 / 210 | 3 / 3 | 1.21-1.79 |
| PostCompact | 2,613.5 / 2,506.8 | 3,127.5 / 4,383.8 | 15 (n=15) | 4.2 (first pass 20.2) | run-hook post-compact (2,507) | 2,200 / 2,130 | 14,972 / 14,921 | 1.86-1.97 |

Other targets measured with the same sets: floor:node 21.6 / 21.2 ms (p95 23.6 / 22.3, spread 1.9, n 7); Stop:changed 1,227.1 / 1,205.7 ms (n=15, spread 1.8, first pass 10.5); Stop:unchanged 1,147.8 / 1,248.2 ms (n 7, spread 8.4); event:SubagentStop of the harness 254.9 / 269.3 ms (n 7, spread 5.5; the number of files in its 30 s window is not controlled there, Table 4 is the controlled one).
Maximum spread after the re-runs: 8.4 percent (Stop:unchanged). No target is unstable. The first-pass spread above 10 percent in five targets came from the first set being slower (four of five) with the same summed hook CPU, so the extra time was waiting; the cause is not isolated (UNVERIFIED).
The PostToolUse:Write first pass (898.5 and 400.5 ms at n = 7) was far above the n = 15 sets (200 and 210 ms). The first runs in a fresh room are slow (set 1 min 217 ms, max 1,776 ms), so the n = 7 median sat on the slow part. Treat the n = 15 value as the steady state and the first pass as the cost of the first writes.

## Table 3: SessionStart cost by block (diagnostic, one pass, not a baseline)

`session-start-blocks.json`: one `bash -x` pass of `scripts/session-start` on the fixture room (316 traced lines, total 2,449 ms under the trace; the state step took the compute path). The trace slows the script, so only the shares carry meaning, and the time of a line is the time to the next trace line, so background jobs and command substitutions blur the shares. No command text is stored. Line numbers are those of the pinned tree.

| Line range | Time ms | Share of traced total | Lines traced |
|------------|---------|-----------------------|--------------|
| 402-409 (node -e per JSON field) | 171.5 | 7.0 percent | 16 |
| 417 | 0 | 0 | 0 |
| 489-494 | 0 | 0 | 0 |
| 570-572 | 0 | 0 | 0 |
| 772-774 | 0 | 0 | 0 |
| 1562-1790 | 932.7 | 38.1 percent | 4 |

The ranges 417, 489-494, 570-572 and 772-774 were not reached on the fixture path (0 lines traced). Top 10 lines by time: session-start:1727 (350.0 ms), 1611 (259.5), 1562 (240.4), 1042 (159.6), 1262 (122.4), 437 (93.9), 130 (83.1), 1661 (82.8), 1947 (79.0), 1435 (76.9). Four lines inside 1562-1790 (1562, 1611, 1661, 1727) account for the whole range.

## Table 4: SubagentStop at 1, 5 and 20 modified files

`subagent-files.json`, fixture room, n = 7 timed rounds per size (the order of the sizes rotates each round: Latin square), one untimed warm-up per size, then a counting pass of 3 repeats per size. All eligible .md files are aged by one hour before each run, then exactly N files are touched, so the 30 s window of the hook holds N files (probe files are made in the working copy only when the room has fewer than N). Wall, CPU and background time are from runs without the counter. Process counts and survivor CPU are from the counting pass. The gate waited for load1 below 2 before every run (up to 900 s); no target is flagged noisy.

| Files | Wall median / p95 ms | Hook CPU median ms | Background time after return, median / p95 ms | Processes (min-max) | node starts | bash/sh starts | find walks | Survivor CPU ms (lower bound) |
|-------|----------------------|--------------------|-----------------------------------------------|---------------------|-------------|----------------|------------|-------------------------------|
| 1 | 177.1 / 187.0 | 200 | 3,482 / 3,684 | 2,604 (2,604-2,604) | 9 | 12 | 33 | 1,460 |
| 5 | 178.5 / 182.6 | 180 | 6,900 / 7,106 | 12,703 (12,703-12,703) | 46 | 44 | 161 | 6,570 |
| 20 | 301.8 / 347.7 | 190 | 18,159 / 18,344 | 17,232 (16,390-19,052) | 171 | 145 | 320 | 29,120 |

Spread of the wall median for the sizes: NOT MEASURED as two sets in the final run. An earlier run of the same command (not kept as a result: one of its sizes was flagged noisy because a load gate ran out at 300 s) gave 166.1, 187.7 and 355.6 ms, which is 6.4, 5.0 and 16.4 percent from the final medians (informational).
Per added file between the sizes (steady-state counts): node starts rise by 9.3 per file (1 to 5 files) and 8.3 per file (5 to 20); bash/sh starts by 8.0 and 6.7 per file. The total process count does not rise in a line (2,604, 12,703, 17,232) because the state recompute and the graph build, started in the background by the cascade, dominate. The hook returns in 0.2 to 0.3 s and the work continues for 3.5 to 18 s afterwards.

## Against the PRD claims

The rule that marks a claim confirmed, refuted or not measurable is applied by plan 384-09, not here. This section gives the PRD number, the counted number and the words `matches`, `differs by <n>` or `NOT MEASURED`.

| Finding | PRD claim | Counted | Words |
|---------|-----------|---------|-------|
| S1 | SessionStart starts about 50 node processes, one per JSON field | 44 node starts (startup unchanged), 45 (startup changed), 44 (compact); 99 to 103 processes in all; npm reconcile hook not run | differs by 5 to 6 node starts (the count is below 50); a lower bound, because the skipped npm reconcile hook starts at least one node process |
| S1 | four unconditional blocks loop all sections (lines 417, 489-494, 570-572, 772-774) | 0 lines traced in those four ranges on the fixture path; 1562-1790 is 38.1 percent of the traced pass | differs: the four ranges did not run in this room (fixture only; real rooms are measured by plan 384-08) |
| S2 | UserPromptSubmit 8 hooks | 8 hooks matched, 8 blocking; 19 processes (18-31), 13 node | matches (hooks) |
| S2 | Stop 8 hooks | 8 hooks matched (7 blocking, 1 async) | matches |
| S2 | Stop about 10 node | 36 node starts (unchanged), 38 (changed) | differs by 26 to 28 |
| S2 | Stop 4 find walks | 4 find calls | matches |
| S2 | tool calls 1 to 2 | PostToolUse:Read matches 2 hooks, 2 processes (2 node) | matches (Read shape only; other shapes were not run) |
| S2 | writes 7 | PostToolUse:Write matches 8 hooks; 36 processes (36-44), 9 node | differs by 1 hook |
| S4 | SubagentStop has no concurrency cap: 2 to 3 processes per modified file | node starts 9, 46, 171 and bash/sh starts 12, 44, 145 at 1, 5, 20 files; total processes 2,604, 12,703, 17,232; the script keeps only the 20 newest files | differs: about 8 to 9 node starts and 7 to 8 bash/sh starts per added file, far above 2 to 3; the count of files is capped at 20, the concurrency is not |

### S1 cost basis (DERIVED)

Counted node starts (44 to 45) times the measured floor:node median (21.4 ms, the mean of 21.6 and 21.2) is about 0.94 to 0.96 s of node start-up floor in the SessionStart event. This is DERIVED, not a measurement: the 8 hooks run at the same time on 4 cores, so the floor sum is not a wall time. Against it, the measured SessionStart wall median is 2.7 s and the node start floor of the 402-409 block alone is 171.5 ms of the traced pass.

## Other observations (diagnostic, fixture room only)

- The SessionStart state step cannot take the reuse path in the fixture room: `reason=registry` at every start (the registry file is newer than STATE.md). Whether the same holds in a real home is a question for plan 384-08.
- The 20-file SubagentStop cascade raised load1 to about 25 to 30 within 30 s (end values in the files). The gate in the next run then waited. When the measurements folder was checked while plan 384-05 was working, `verify-results` failed on one file of that plan only: `s9-transcript.json` shows `load1_start` 27.23, the same value as the `load1_end` of my set 1. That file is not part of this plan, and the files of this plan pass `verify-results` alone.
- Stop starts 15 `timeout` and 15 `basename` processes. TaskCompleted starts compute-state and 15 each of `find`, `tr` and `wc`. These are small programs started in loops.

## Real-room copy sections

Added by plan 384-08 (the runner works on a copy: `run --room copy --source-file <file>`; tested on a synthetic source).
