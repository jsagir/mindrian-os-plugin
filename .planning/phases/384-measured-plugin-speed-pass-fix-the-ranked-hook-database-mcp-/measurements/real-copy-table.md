# Phase 384 plan 08: room-dependent costs on quiet real-room copies

Written by plan 384-08, 2026-11-05. Counts and timings only (Canon Part 8): no room name, no room path, no room content in this file.
Tree: a pinned export of BASE_SHA_384 (db2ea3b05bb70b55741bdeb40b545801b0c37cbe). The live checkout was not measured. Harness and bench code ran from the live checkout.
Method: one copy per room class, in a scratch folder. The source room was read only. Git remotes were removed from the copy by the harness. Hooks ran with a sandbox HOME and a registry that lists only the copy. Every run held the shared lock, ran under taskset -c 0-3, started when load1 was below 2, and followed the isolation check, which stayed strict. Median and p95 as defined in tools/perf/README.md (p95 at n = 7 is the second-largest sample). Spread is |m1 - m2| / mean x 100 over two sets of the same tree. DIRECT means a measured number; DERIVED means a calculation from measured numbers.
Q1 state: `not needed` (measurements/q1-answer.md). The isolation check was not relaxed.

the room class changes the numbers: compare the sections

## Class: local disk (MEASURED)

Picker line: class=local, file_count=221, fs_type=ext2/ext3. Room bytes 13,728,700. room.db 6,057,984 to 6,184,960 bytes (the size differs between runs of the copy). Host: 12 cores, taskset 0-3, Node v22.23.1, Linux arm64 under WSL2.
Auto-explore finding files in the copy: 0. Section folders: 15 (14 with a ROOM.md).

### Table 1: processes started per event (census, 3 repeats, exec counter, DIRECT)

| Event key | Hooks (blocking, async, skipped) | Processes, median (min-max) | node starts | bash starts | find walks | Survivor CPU ms (lower bound) | Tail after last hook ms |
|-----------|----------------------------------|-----------------------------|-------------|-------------|------------|-------------------------------|-------------------------|
| SessionStart:startup:unchanged (took the changed path, see note 1) | 8 (8, 0, 1) | 92 (92-92) | 44 | 8 | 3 | 250 | 14,796 |
| SessionStart:startup:changed | 8 (8, 0, 1) | 94 (94-94) | 45 | 9 | 1 | 240 | 14,800 |
| SessionStart:compact | 8 (8, 0, 1) | 95 (94-95) | 45 | 9 | 1 | 260 | 14,804 |
| UserPromptSubmit | 8 (8, 0, 0) | 14 (14-17) | 8 | 2 | 0 | 0 | 0 |
| Stop:unchanged:tx4m | 8 (7, 1, 0) | 101 (101-101) | 35 | 4 | 4 | 0 | 0 |
| Stop:changed:tx4m | 8 (7, 1, 0) | 111 (111-111) | 38 | 7 | 2 | 0 | 0 |
| PostToolUse:Write | 8 (8, 0, 0) | 49 (49-49) | 12 | 8 | 0 | 280 | 176 |
| PostToolUse:Read | 2 (2, 0, 0) | 2 (2-2) | 2 | 0 | 0 | 0 | 0 |
| TaskCompleted | 1 (1, 0, 0) | 81 (81-81) | 2 | 4 | 16 | 0 | 0 |
| PreCompact | 1 (1, 0, 0) | 27 (27-27) | 3 | 2 | 1 | 0 | 0 |
| PostCompact | 1 (1, 0, 0) | 89 (37-89) | 37 | 10 | 1 | 250 | 14,822 |
| SubagentStop:files1 | 1 (1, 0, 0) | 3,378 (3,378-3,378) | 12 | 15 | 32 | 3,030 | 8,012 |
| SubagentStop:files5 | 1 (1, 0, 0) | 11,589 (11,331-12,546) | 58 | 59 | 86 | 13,530 | 13,180 |
| SubagentStop:files20 | 1 (1, 0, 0) | 15,737 (14,941-16,506) | 223 | 200 | 195 | 37,930 | 23,288 |

Notes:
1. SessionStart:startup:unchanged took the changed path in every run on the copy (the harness check, 7 of 7 runs in both wall sets; the session-opens probe also shows 3 of 3). Its count is a compute-path count. Its wall time is NOT MEASURED (verify-results refuses an :unchanged target that took the changed path). The first-pass wall medians of that target were 5,124.1 and 4,941.9 ms (n 7, spread 3.6 percent); those two files were discarded and the sets were taken again without the target.
2. The npm reconcile hook of SessionStart is not run, so every SessionStart number is a lower bound. Processes that Claude Code itself starts are not counted.
3. The tail of about 14.8 s after SessionStart, SessionStart:compact and PostCompact is the same on the fixture room (14.86 s). The survivors are the session-start shell and the Brain prewarm node process (names from /proc, plan 384-04).
4. SubagentStop in the census (rows above) and in the separate walls-subagent counts (Table 4) differ in process count; both are DIRECT counts from different sessions and different room states. The cause is not isolated (same observation as on the fixture room).
5. Fixture room, same keys (plan 384-04): SessionStart changed 103 processes and 45 node; UserPromptSubmit 19 and 13; Stop:unchanged:tx4m 101 and 36; SubagentStop 1 file 5,502 (full census) or 2,604 (scaling run).

### Table 2: wall time per event (two sets, DIRECT)

Sets s1 and s2 are two runs of the same tree on the same copy, n = 7. A target whose first spread was above 10 percent was run again once at n = 15 in both sets (marked R). The first s1 re-run was discarded and taken again (see the isolation section); the first s2 re-run was discarded and taken again because three targets ran on a busy host (verify-results rejects a noisy target).

| Event key | Wall median ms s1 / s2 | Wall p95 ms s1 / s2 | n | Spread percent (first pass) | Spread percent (R, n = 15) | Longest hook (median ms, s1) | Summed hook CPU ms s1 / s2 | Background after return ms s1 / s2 | load1 at start s1 / s2 |
|-----------|------------------------|---------------------|---|-----------------------------|----------------------------|-------------------------------|----------------------------|--------------------------------------|------------------------|
| SessionStart:startup:changed | 5,079.8 / 4,821.6 | 6,038.7 / 8,625.5 | 7 | 5.2 | - | run-hook session-start (5,024) | 5,340 / 4,680 | 14,887 / 14,806 | 0.14 / 0.77 |
| SessionStart:startup:unchanged | NOT MEASURED | - | - | - | - | - | - | - | - |
| SessionStart:compact | 5,107.8 / 5,355.5 | 5,295.4 / 5,611.9 | 7 | 4.7 | - | run-hook session-start (5,108) | 5,380 / 4,060 | 14,922 / 14,857 | 0.49 / 1.45 |
| UserPromptSubmit | 421.0 / 408.2 | 463.8 / 474.3 | 7 | 3.1 | - | run-hook intent-classifier (421) | 580 / 480 | 6 / 5 | 0.58 / 1.92 |
| Stop:changed | 1,698.8 / 1,869.4 (R) | 1,858.2 / 2,172.2 | 15 (R) | 17.7 | 9.6 | run-hook on-stop (1,877.6 in the n = 7 set) | 2,370 / 2,550 | 6 / 7 | 0.46 / 0.75 |
| Stop:unchanged | 1,640.3 / 1,688.2 (R) | 1,762.5 / 1,996.4 | 15 (R) | 20.2 | 2.9 | run-hook on-stop (1,920.8 in the n = 7 set) | 2,340 / 2,270 | 6 / 5 | 1.41 / 1.02 |
| Stop:changed:tx4m | 1,759.3 / 2,039.0 (R) | 1,991.0 / 2,338.6 | 15 (R) | 15.3 | 14.7 | run-hook on-stop (1,890.9 in the n = 7 set) | 2,490 / 2,980 | 5 / 7 | 1.93 / 1.23 |
| Stop:unchanged:tx4m | 1,692.2 / 1,646.0 (R) | 1,813.8 / 1,724.9 | 15 (R) | 25.3 | 2.8 | run-hook on-stop (2,030.1 in the n = 7 set) | 2,620 / 2,500 | 5 / 5 | 1.98 / 1.66 |
| PostToolUse:Write | 470.6 / 755.9 (R) | 902.0 / 832.2 | 15 (R) | 42.4 | 46.5 | memory-artifact-graph-hook (545.2 in the n = 7 set) | 930 / 900 | 5 / 5 | 1.97 / 1.87 |
| PostToolUse:Read | 68.7 / 61.9 (R) | 81.1 / 105.0 | 15 (R) | 48.2 | 10.4 | query-efficiency-telemetry (80.3 in the n = 7 set) | 80 / 90 | 7 / 6 | 1.92 / 1.81 |
| SubagentStop (harness target) | 274.7 / 295.0 (R) | 344.9 / 364.5 | 15 (R) | 47.7 | 7.1 | run-hook on-agent-complete (365.6 in the n = 7 set) | 310 / 340 | 6 / 7 | 1.92 / 1.81 |
| TaskCompleted | 402.9 / 457.5 (R) | 473.7 / 538.5 | 15 (R) | 38.7 | 12.7 | run-hook on-task-complete (529.6 in the n = 7 set) | 480 / 520 | 6 / 6 | 1.84 / 1.82 |
| PreCompact | 309.0 / 444.8 (R) | 331.6 / 509.6 | 15 (R) | 63.2 | 36.0 | run-hook pre-compact (573.9 in the n = 7 set) | 320 / 480 | 5 / 6 | 1.78 / 1.70 |
| PostCompact | 5,208.9 / 4,759.7 | 5,686.3 / 5,336.0 | 7 | 9.0 | - | run-hook post-compact (5,208.9) | 4,530 / 4,170 | 14,880 / 14,848 | 1.83 / 1.72 |
| floor:node | 33.8 / 46.7 (R) | 39.9 / 98.5 | 15 (R) | 61.7 | 32.0 | - | 20 / 30 | 5 / 7 | 1.79 / 1.64 |

Reading the spread:
- Stable (spread at or below 10 percent after the re-run): SessionStart changed (5.2), SessionStart compact (4.7), UserPromptSubmit (3.1), PostCompact (9.0), Stop:changed (9.6), Stop:unchanged (2.9), Stop:unchanged:tx4m (2.8), SubagentStop (7.1).
- Unstable (spread above 10 percent after the re-run, kept, not dropped): PostToolUse:Read (10.4), Stop:changed:tx4m (14.7), TaskCompleted (12.7), PreCompact (36.0), PostToolUse:Write (46.5), floor:node (32.0). The short targets (floor, Read, Write, PreCompact, TaskCompleted, SubagentStop) swing between sets by 10 to 25 ms of host speed; the bare node floor itself moved from 33.8 to 77.8 ms across four sets with load1 below 2, so a short target on this host carries a floor-speed error of that size. Treat those numbers as order of magnitude. The long targets (SessionStart, Stop, PostCompact) are stable enough to rank.
- Peers ran work on the host during these sets (load1 at start 1.0 to 1.98 in later targets). The harness gate waited for load1 below 2 before each target.
- Local class on the fixture room (plan 384-04): SessionStart changed 2,764.3 / 2,733.5 ms, UserPromptSubmit 108.6 / 109.1 ms, Stop:unchanged:tx4m 1,244.1 / 1,224.1 ms, floor:node 21.6 / 21.2 ms. The real copy is 1.8 times (SessionStart changed, n = 7 set 1 on both), 3.9 times (UserPromptSubmit, n = 7 set 1 on both) and 1.4 times (Stop:unchanged:tx4m, the n = 15 set 1 against the fixture n = 7 set 1) the fixture median (DERIVED).
- PRD sample: SessionStart 6.7 s local. This copy: 5.1 s (changed) and 5.1 s (compact), about 1.6 s below the PRD sample (DIRECT, n = 7).

### Table 3: SubagentStop at 1, 5 and 20 modified files (walls-subagent, n = 7 per size, Latin-square order, DIRECT)

| Files | Wall median ms (p95) | Background after return, median ms | Processes (min-max) | node starts | find walks | Survivor CPU ms (lower bound) |
|-------|----------------------|------------------------------------|---------------------|-------------|------------|-------------------------------|
| 1 | 301.6 (459.2) | 12,377 | 3,378 (3,378-4,171) | 12 | 32 | 4,370 |
| 5 | 337.4 (468.6) | 13,362 | 16,475 (16,274-16,508) | 58 | 143 | 12,790 |
| 20 | 487.6 (656.3) | 23,002 | 16,637 (16,341-21,015) | 223 | 206 | 32,230 |

load1 at start of each size 1.95 to 1.97; the 5 and 20 file rounds raised load1 to 23 by themselves (the gate waited for it to fall). Fixture room for comparison: wall 177.1, 178.5 and 301.8 ms, background 3,482, 6,900 and 18,159 ms. The spread of this table is NOT MEASURED (one set); the fixture spread of the harness SubagentStop target was 5.5 percent (spread from fixture).

## Against the PRD claims (S1, S2, S4 on the local copy)

Plan 384-09 applies the confirm or refute rule. This file marks none.

| ID | PRD claim in one phrase | Measured on the local copy | Word |
|----|-------------------------|----------------------------|------|
| S1 | about 50 node processes in SessionStart | 44 to 45 node starts, 92 to 95 processes in all (lower bound: the npm reconcile hook was not run) | differs by 5 to 6 (same as fixture) |
| S1 cost basis | node starts times the bare node start | 45 starts x 33.8 ms (n = 15 set 1 floor) = 1,521 ms to 45 x 77.8 ms (n = 7 set 1 floor) = 3,501 ms; the floor spread is 32.0 percent (unstable), so the range is wide; against a wall of 5,080 ms. DERIVED | DERIVED range 30 to 69 percent of the wall |
| S1 local time | SessionStart 6.7 s local | 5,079.8 and 4,821.6 ms (changed), spread 5.2 percent, n = 7 | differs by about 1.6 s below |
| S2 | UserPromptSubmit runs 8 hooks | 8 hooks, 8 blocking | matches |
| S2 | Stop runs 8 hooks | 8 hooks (7 blocking, 1 async) | matches |
| S2 | Stop starts 4 find walks | 4 (unchanged), 2 (changed) | matches (unchanged); differs by 2 (changed) |
| S2 | Stop starts about 10 node processes | 35 (unchanged), 38 (changed) | differs by 25 to 28 |
| S2 | one tool call runs 1 to 2 hooks | 2 hooks for a Read | matches |
| S2 | a write runs 7 hooks | 8 hooks | differs by 1 |
| S2 (no PRD number) | UserPromptSubmit wall | 421.0 and 408.2 ms on the copy against 108.6 and 109.1 ms on the fixture; the longest hook is the intent classifier hook at 421 ms (n = 7, spread 3.1 percent) | NOT A PRD CLAIM, number on file |
| S4 | 2 to 3 processes per modified file | 3,378 at 1 file, 16,475 at 5 files, 16,637 at 20 files; node starts 12, 58 and 223 (about 11 to 12 per file); the process count saturates near 16,000 to 17,000 from 5 files | differs by orders of magnitude (3,378 against 2 to 3 at 1 file) |

## Local copy: script costs, MCP and database (one set each, DIRECT unless marked)

Timings come from one set. Their spread is the spread of the two fixture sets of the same target (plans 384-05, 384-06, 384-07), labelled `spread from fixture`. Fixture room numbers are in brackets.

| ID | Number on the copy | n | Spread from fixture (percent) |
|----|--------------------|---|-------------------------------|
| S5 drain hook, empty queue | 33.6 ms (p95 69.7) [fixture 73.8 and 78.0] | 20 | 5.5 |
| S5 bare node floor in the drain pair | 25.1 ms (p95 41.1) | 20 | 0.4 |
| S5 bash-wrapped node floor | 26.8 ms (p95 48.0) | 20 | 10.2 |
| S5 hook minus bash-wrapped floor, per pair, DERIVED | 7.3 ms (p95 21.6) [fixture 50.3 and 53.3] | 20 | 5.8 |
| S5 module warm-up, three modules in script order | 53.7 ms (p95 89.8) [fixture 48.9 and 49.2] | 20 | 0.6 |
| S5 auto-explore drain, F = 0 | 67.2 ms (p95 84.1) [fixture 30.9 and 31.2] | 7 | 1.0 |
| S7 MCP start, os server, initialize | 568.8 ms (p95 588.5) [fixture 522.2 and 562.5] | 7 | 7.4 |
| S7 MCP start, os server, tools/list | 597.3 ms (p95 627.6) [fixture 546.1 and 592.0] | 7 | 8.1 |
| S7 bare node floor beside it | 38.8 ms (p95 47.4) [fixture 51.5 and 47.7] | 7 | 7.7 |
| S8 idle ping, baseline | 0.9 ms (p95 1.3) | 7 | 20.7 |
| S8 stop_gate_check, first call, event loop blocked (ping delayed 20 ms) | 837.4 ms (p95 931.4, max 1,098.4); tool 856.2 ms (p95 950.6, max 1,117.6) [fixture first call 865.6] | 7 | 33.2 (first pair of the fixture; 13.3 warm) |
| S8 stop_gate_check, warm call | ping 797.1 ms (p95 956.9, max 1,545.7); tool 805.7 ms (p95 976.1, max 1,565.0) [fixture warm 691.7] | 7 | 13.3 |
| S3 database open, cold (one open in a fresh process) | 4.78 ms (p95 5.40) against 0.227 ms bare [fixture 5.965 and 0.236] | 7 | 0 |
| S3 database open minus bare, cold, DERIVED | 4.50 ms (p95 5.16) | 7 | 1.7 |
| S3 database open, warm (mean of 100 opens per sample) | 1.126 ms (p95 1.498) against 0.030 ms bare [fixture 1.157 and 0.035] | 7 | 0 |
| S3 audit cost per cold open, DERIVED | 2.14 ms (p95 2.57) | 7 | 38.3 (unstable) |

Counts (DIRECT, repeats agree where stated):
- S5 auto-explore: the copy holds 0 finding files, so only F = 0 ran; the run read 0 finding files and loaded 5 modules (2 repeats agree). The cost of the re-read per finding file is NOT MEASURED on this copy (no finding files); the fixture has it at 1 read per file per prompt, about 5 ms at 100 files.
- S9 Stop (one stored repeat, transcript 4 MiB, section folders 15, with ROOM.md 14): 2 transcript reads per Stop in both variants (check-card-fire, check-voice-style; the repeats agree). Room file reads in the 13 to 15 scripts of one Stop: 496 (unchanged) and 530 (changed), with 384 and 410 stat calls and 47 and 76 directory reads; one `node -e` process makes 187 of the reads (13.4 per section folder with a ROOM.md; fixture 135, 9.6 per section), the room-references script makes 202 (unchanged) or 186 (changed), the guardian script 98. The room read counts differ between repeats (repeats_agree false); the transcript read counts agree. SQLite handles made per Stop: 26, prepare calls 145.
- S3 opens per SessionStart (startup, 3 repeats agree): 9 database opens, 23 exec calls, 266 to 268 prepare calls, 44 to 45 node processes. Both variants (unchanged took the changed path, see note 1). Fixture: 12 opens, 4 of them running the chain. Scripts with opens: agentshield scan, eval, guardian, coordinator, room-graph sync. Cost per SessionStart, DERIVED: 9 opens x 4.50 ms (cold open minus bare) = 40.5 ms, 0.8 percent of the 5,080 ms wall.
- S3 per tool (MCP, first and second call, 3 repeats agree): room_list 0 opens; room_state 2 opens on both calls (9.5 and 4.2 ms); suggest_next 1 open on both calls (6.0 and 3.6 ms); room_startup, artifact_file and memory_event returned an error in 3 of 3 repeats with the default arguments, so their opens on this copy are NOT MEASURED.
- S7 exec check (3 repeats): the os server started 1 process (node), no npm or npx call, no stub call, none blocked. npm_attempted false. So the start numbers above are valid for this class. Tools: 72, eureka-named: 24.

## Against the PRD claims (S3, S5, S7, S8, S9 on the local copy)

Plan 384-09 applies the confirm or refute rule. This file marks none.

| ID | PRD claim in one phrase | Measured on the local copy | Word |
|----|-------------------------|----------------------------|------|
| S3 | a 7-step setup chain, about 14 DDL statements on every open | cold open 4.78 ms against 0.227 ms bare; warm 1.126 ms against 0.030 ms bare (n = 7); the exec and prepare counts per open are not repeated here (same code as the fixture: 20 exec, 15 prepare) | matches (cost per open; counts from the fixture) |
| S3 | the open is a cost worth fixing | 9 opens per SessionStart, about 40.5 ms DERIVED, 0.8 percent of the wall; room.db is 6.1 MB, and the open is not slower than on the 0.27 MB fixture (cold 4.78 against 5.97 ms) | differs: the cost is under 1 percent of the wall on this copy |
| S5 | the Brain drain loads a 96 to 191 ms module on an empty queue | the hook as a whole takes 33.6 ms (p95 69.7); the module warm-up measured in its own process takes 53.7 ms (p95 89.8, includes a process start); the hook minus the bash-wrapped floor is 7.3 ms (DERIVED, n = 20) | differs by 42 ms below the 96 ms lower bound (module warm-up); the hook-minus-floor number on this copy is 43 ms lower than on the fixture, cause not isolated (UNVERIFIED) |
| S5 | auto-explore drain re-reads every finding file | 0 finding files in the copy, 0 reads | NOT MEASURED on this copy (no finding files); count matches on the fixture |
| S7 | MCP start cost of the os server | initialize 568.8 ms (p95 588.5), tools/list 597.3 ms, bare node 38.8 ms (n = 7); 72 tools, 24 eureka; no npm child | matches the fixture within its spread (7.4 percent); the start does not depend on the room copy |
| S8 | stop_gate_check blocks the loop for up to 7 s | first call 837.4 ms median (max 1,098.4), warm 797.1 ms (max 1,545.7), ping delayed by about the whole call; the idle ping is 0.9 ms | differs by about 6.2 s below the 7 s in the median; the maximum seen is 1.5 s. Runs above 1,000 ms exist (max 1,098.4 cold, 1,545.7 warm) |
| S9 | Stop reads the transcript tail twice | 2 transcript reads per Stop | matches |
| S9 | folder-memory reads per section each turn | 496 (unchanged) and 530 (changed) room file reads in one Stop over 15 section folders; 13.4 reads per section in the largest single process; also when nothing changed | matches (count; more per section than on the fixture, 13.4 against 9.6) |

## Class: Windows mount (NOT MEASURED)

Picker line: `picked none class=mount candidates=1 quiet=0` (exit 75). The one candidate room of the mount class was not quiet (a holder or a changed path inside the idle window of the picker). The isolation check stayed strict. No copy of this class was made. Every part of this plan is NOT MEASURED for the mount class: census, walls (S1, S2, S4), drain and Stop reads (S5, S9), MCP start, database open, event-loop block (S3, S7, S8). Q1 was not asked, because one class was quiet. The mount ranking question (PRD open question 4: SessionStart 6.7 s local against 69.8 s on the mount in one sample) is therefore open; the PRD sample is the only mount number on file, and it is not a measurement of this plan.

## Isolation

| File group | Exit code | Source paths changed | Copy paths changed | Intersect |
|------------|-----------|----------------------|--------------------|-----------|
| census | 0 | 0 | 223 | 0 |
| walls-subagent | 0 | 0 | 174 | 0 |
| walls s1 (n = 7, kept) | 0 | 0 | 70 | 0 |
| walls s2 (n = 7, kept) | 0 | 0 | 79 | 0 |
| walls s1 re-run, first take (n = 15, discarded) | 3 | 1 (class shm 1, wal 0, db 0, other 0) | 41 (shm 1, wal 1, db 1, other 38) | 1 (class shm 1) |
| walls s1 re-run, second take (kept) | 0 | 0 | 52 | 0 |
| walls s2 re-run, first take (n = 15, discarded, noisy host) | 0 | 0 | 52 | 0 |
| walls s2 re-run, second take (kept) | 0 | 0 | 45 | 0 |
| script costs, MCP and database files (11 files) | 0 | 0 | 1 to 223 | 0 |

The one breach: during the first take of the s1 re-run a change of the shared-memory sidecar of the source database was seen (class shm, 1 path), at the same relative path that the copy also changed. The check stayed strict. The file of that take (exit 3) was removed from the commit set and the run was taken again on the same copy; the second take exited 0 with 0 source paths changed. No other file of this plan had a source change. The cause of the one sidecar change is a reader outside this plan (UNVERIFIED; the plan never opened the source for write). The earlier files all have intersect 0, so they stay.

## Deviations on this file

- The SessionStart:startup:unchanged wall time is NOT MEASURED (see note 1).
- A first pair of walls sets, a first s1 re-run (breach) and a first s2 re-run (noisy) were replaced by later takes. The kept files are the later takes. The replaced files were not committed.
- walls-subagent counts are kept in `subagent-files-copy-local.json` (a timing file) because the plan lists no file for it; the three merged files hold the other counts and timings.
