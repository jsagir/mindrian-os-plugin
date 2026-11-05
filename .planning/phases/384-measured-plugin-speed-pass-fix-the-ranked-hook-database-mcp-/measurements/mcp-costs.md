# Phase 384 plan 06: MCP start, watcher, event-loop blocking and per-tool opens

Written 2026-11-05 by plan 384-06. Tree: a pinned export of BASE_SHA_384 (db2ea3b05bb70b55741bdeb40b545801b0c37cbe), not the live tree. Room: the fixture room (64 files) and synthetic rooms homes built from it. Every server ran with a sandbox HOME, a sandbox rooms home and the unreachable loopback as Brain URL. Cap: taskset -c 0-3. Lock held for every run. Every number below is a median over n runs (p95 is the sample at index floor(0.95 x (n - 1))); load1 at the start of every result file is below 2 (verify-results exits 0). Spread is |m1 - m2| / mean x 100 between two sets of the same tree. Numbers marked DERIVED come from other measured numbers; numbers marked NOT MEASURED have a reason.

Result files: s7-mcp-start.json (set 1), s7-mcp-start-set2.json, s7-exec-check.json, s7-profile.json, s7-eureka-ab-*.json, s10-watchers.json (set 1), s10-watchers-set2.json, s10-watchers-rerun15.json, s3-tool-opens.json, s3-tool-opens-write-on.json, s8-block.json (set 1), s8-block-set2.json, s8-block-rerun15.json, s8-block-graph-rebuild*.json.

## No real npm ran (exec check, T-384-27)

The exec counter (calibration checks K2 and K3 of the census tests passed, exactly 7 and exactly 5) started each server with a stub npm and a stub npx first on PATH and with a block list of npm and npx. Result, 3 repeats per server: stub calls 0, blocked execs 0, npm or npx execs counted 0, for both the mindrian-os server and the mindrian-brain shim. Total execs per start: 1 (the node process itself, started by taskset). So in this measurement the pinned tree (node_modules present) did not attempt an npm child, and no start-up number was marked NOT MEASURED for that reason. The cold-install case of lib/core/mcp-dep-heal.cjs (node_modules missing) is not covered: NOT MEASURED, by design (the file is not touched and a cold install is not run).

## S7: MCP start

Counts (count run with the probe preload, unconfigured start on the fixture room):

| Server | tools registered | eureka-named tools | files in lib/mcp/tools | modules in require.cache at the end |
|--------|------------------|--------------------|------------------------|-------------------------------------|
| mindrian-os | 72 | 24 | 37 | 735 |
| mindrian-brain shim | 6 | 0 | not applicable | 290 |

Start time (spawn to the reply, ms; n = 7 per set, two sets; p95 in brackets):

| Target | set 1 | set 2 | spread |
|--------|-------|-------|--------|
| mindrian-os initialize | 522.2 (740.7) | 562.5 (629.5) | 7.4 percent |
| mindrian-os tools/list | 546.1 (770.7) | 592.0 (655.2) | 8.1 percent |
| mindrian-brain initialize | 307.3 (433.5) | 295.6 (339.9) | 3.9 percent |
| mindrian-brain tools/list | 313.1 (448.7) | 304.0 (348.3) | 2.9 percent |
| floor:node (node -e 0) | 51.5 (59.6) | 47.7 (69.2) | 7.7 percent |
| os plus brain in series, initialize (DERIVED: per-round sum) | 872.3 (1037.0) | 903.4 (934.3) | 3.5 percent |
| os plus brain in series, tools/list (DERIVED) | 910.3 (1073.1) | 942.6 (970.0) | 3.5 percent |

CPU time (user plus system, ms, tick resolution 10 ms) at the tools/list reply: os 670 and 730, brain 360 and 350; peak RSS os 111 MB, brain 89 MB, bare node 42 MB. The tools/list call itself adds 24 to 30 ms to the os start. The series row is the doctor-only cost of two MCP servers started one after the other (wave 1 scope item). Doctor itself was not timed here.

CPU profile through initialize and tools/list (n = 7 per server; the profiler and the preload slow the run, so only shares are used). Median share of the active time, os server: node builtins 57.8 percent (the CommonJS loader alone is 212 ms of 623 ms, about 34 percent), zod 17.6, runtime (program and garbage collector) 8.2, SDK server and core packages 5.3, other packages and scripts 4.7, SDK client 1.9 (12 ms), lib/core 1.8, other lib/mcp 1.1, chokidar 0.5, tool files 0.3 (1.7 ms), eureka tool files 0.3 (1.9 ms). Brain shim: node builtins 62.4, zod 14.0, runtime 11.5, SDK server and core 7.2, lib/core 2.1, other 1.9, no tool files, no SDK client, no chokidar. The own code of the 37 tool files is under 1 percent of the self time; the cost of reading and compiling them is inside the loader row and cannot be split out of a self-time profile.

Eureka tool files, with and without (an A/B on a scratch copy of the pinned tree with the 16 eureka-* tool files removed; 49 tools instead of 72; no product file changed): the median of the per-pair difference of the os initialize time (all files minus no eureka files) in five interleaved sets was +137.7 ms (n 15), -49.9 ms (n 15), -1.9 ms (n 41), +94.4 ms (n 41), +118.8 ms (n 41). The sign changes between sets and single runs range from 450 to 1030 ms on this host, so the effect of the 16 files is NOT RESOLVED. DERIVED central value: the median of the five set medians is +94 ms; treat it as "between 0 and about 140 ms of a start of about 650 ms", not as a result. A first attempt that alternated whole sets (A B B A) is on file and shows the same noise (tree B twice: 644.9 and 439.8 ms).

## S10: the tree watcher (idle MCP processes)

Synthetic rooms homes made from the fixture room (R copies). One server per process, window 10 s, n = 7 per set, two sets. Watches are inotify watches of the process (lines of `inotify wd:` in /proc fdinfo).

| Rooms | Directories and files in the watch depth | Watches per process | Watches, 3 processes | Idle RSS per process (MB), set 1 and set 2 | Idle RSS, 3 processes (MB) | Idle CPU in 10 s (ms) |
|-------|-----------------------------------------|---------------------|----------------------|--------------------------------------------|----------------------------|-----------------------|
| 1 | 20 and 58 | 79 | 237 | 106.5 and 106.6 | 318 | 0 |
| 10 | 200 and 580 | 781 | 2,343 | 119.3 and 119.6 | 358 | 0 |
| 58 | 1,160 and 3,364 | 4,525 | 13,575 | 151.8 and 150.2 | 457 | 0 |
| bare node control | not applicable | 0 | not applicable | 43.8 and 43.8 | not applicable | 0 to 10 |

Watch counts were identical in all runs of both sets (p95 equals the median). The relation watches = directories + files + 1 holds exactly at the three sizes (79, 781, 4,525). The initialize reply time does not depend on the number of rooms (median 617 to 692 at 1 room, 577 to 691 at 10, 627 to 635 at 58; the watcher starts after the transport is up). The idle CPU of an idle server is 0 ms in the window at the 10 ms tick resolution at all sizes, so no idle CPU cost is shown.

S10 cost basis, one process with the watcher minus the bare node control (DERIVED, per-round differences): at 1 room, RSS +62.7 MB (set 2 +62.8), watches +79, idle CPU 0 ms; at 58 rooms, RSS +108.0 MB (set 2 +106.4), watches +4,525, idle CPU 0 ms (-10 ms, tick noise). The part of this RSS that belongs to the watcher is not separated: the 1-room figure is the cost of the whole server, and the growth from 1 to 58 rooms is +45 MB per process (+18 KB per watch from 1 to 10 rooms, +9 KB per watch from 10 to 58 rooms, so the growth is not linear).

Spread: the initialize times at 1 room (11.3 percent) and 10 rooms (17.9 percent) were above 10 percent, so they were run again at n = 15 (s10-watchers-rerun15.json): 1 room 672.5 ms (p95 964.1), 10 rooms 757.7 ms (p95 923.8), control 90.9 ms. The initialize time stays noisy on this host (min 490, max 1021 at 1 room). RSS spread is 0.1 to 1.5 percent in every row; the watch counts have 0 spread.

Real rooms home (counts only, read-only, no names): 1,810 directories to depth 4 (not hidden, no node_modules) and 6,794 files to depth 5, in 40 top-level room folders. DERIVED with the exact relation above: about 8,604 watches per MCP process (1,809 + 6,794 + 1), about 25,800 for 3 processes. The host limit fs.inotify.max_user_watches is 524,288, so one process would use about 1.6 percent of it. The RSS and CPU of a real-size home are NOT MEASURED here (plan 384-08 measures real-room copies).

## S8: blocking of the event loop

A ping is sent 20 ms after the tool call; the ping time is the time from the ping send to its reply. A fresh server per sample, 1.5 s settle. "First call" is the first call of the server, "warm" is the call after one untimed call. Idle ping baseline: 1.1 to 1.6 ms (n = 7 and n = 15).

| Call | ping ms, set 1 (p95) | ping ms, set 2 (p95) | spread | ping ms, rerun n = 15 (p95, max) | tool reply ms, rerun n = 15 |
|------|----------------------|----------------------|--------|----------------------------------|-----------------------------|
| stop_gate_check, first call | 911.3 (1052.3) | 652.1 (907.7) | 33.2 percent | 865.6 (1104.1, 5659.5) | 884.1 |
| stop_gate_check, warm | 664.9 (880.7) | 759.5 (854.9) | 13.3 percent | 691.7 (910.6, 1068.3) | 705.3 |
| room_graph graph-rebuild, first call (write path on) | 110.0 (139.1) | 139.9 (147.2) | 23.9 percent | 115.3 (151.8, 154.4) | 132.0 |
| room_graph graph-rebuild, warm (write path on) | 55.4 (81.5) | 77.0 (81.0) | 32.6 percent | 70.8 (85.0, 86.9) | 90.1 |

The spread of both stop_gate_check rows and both graph-rebuild rows was above 10 percent, so each was run again at n = 15 (last column group; use the rerun as the number). The ping waits for about the whole tool call (98 percent of the reply time), so the event loop is blocked for the length of the call. stop_gate_check starts 3 child node processes in one call (counted by the preload; the bash compute-state child is not a node process and is not in that count; the code runs them with execFileSync and ceilings of 2, 2 and 3 s). Detached work that outlives the call was waited for (up to 15 s) and the median wait was 0 ms with 0 survivors.

Cascade write path (intelligence-cascade classify-insight per artifact): NOT MEASURABLE through MCP in this tree. Reasons, each seen in a call: (1) the write path is off by default on the CLI (the write tools answer write_path_disabled unless MINDRIAN_MCP_FIRST=cli is set and a room is bound); (2) the only commands that pass a file path to the cascade (file-opportunity and the other commands that take JSON in the `section` field) are refused by the input schema, which accepts only [a-z0-9-]+ in `section`; (3) every command that does pass the schema hands the cascade no file path, and the cascade returns "no filePath provided" before it starts any process. graph-rebuild is shown because it is a write tool that does block the loop for 71 to 115 ms.

## S3: room database opens per tool call (fixture room, 3 repeats, first call and second call of the same tool)

Opens are node:sqlite DatabaseSync constructions counted by the probe preload in the server process, plus opens in child node processes. exec and prepare are the sqlite statement counts of the preload. All 3 repeats gave the same open counts, except the child opens of the second stop_gate_check call (4, 1, 1).

| Tool (call) | opens, first and second call | sqlite exec calls | sqlite prepare calls | modules added by the first call | tool reply ms (first, second) |
|-------------|------------------------------|-------------------|----------------------|---------------------------------|-------------------------------|
| room_list | 0 and 0 | 0 | 0 | 0 | 12.9, 5.6 |
| room_state status | 2 and 2 | 0 | 6 | 3 | 21.0, 8.7 |
| suggest_next | 1 and 1 | 0 | 1 | 0 | 20.1, 6.9 |
| room_search | 0 and 0 (58 room file reads) | 0 | 0 | 0 | 43.5, 34.1 |
| stop_gate_check | 1 and 1 in the server, plus 1 in a child node process | 0 | 4 | 7 | 933.6, 877.9 |
| room_startup (write path on, room bound) | 4 and 2 | 42 and 22 | 63 to 70 and 45 to 52 | 2 | 179.7, 75.7 |
| artifact_file (write path on) | 2 and 2 | 20 | 27 | 1 | 104.3, 58.9 |
| memory_event (write path on) | 2 and 2 | 20 | 21 | 0 | 88.7, 84.5 |
| room_graph graph-rebuild (write path on) | 2 and 1 | 4 and 3 | 160 to 180 | 3 | 134.2, 124.9 |
| room_content file-opportunity (write path on) | NOT MEASURED | NOT MEASURED | NOT MEASURED | NOT MEASURED | the call returns an input validation error (section must match [a-z0-9-]+) |

Each open of a write tool runs 10 sqlite exec statements (20 for 2 opens). The second call opens as many handles as the first: no handle is reused between calls. The prepare count of graph-rebuild grows by 10 per repeat because the room grows by the written files. The first call of a tool loads more modules than the second (room_state +3, stop_gate_check +7, graph-rebuild +3, artifact_file +1, room_startup +2; every second call +0): this is the wave 1 item "tool-router first-call module loads". room_startup without a bound room returned an error in the default run (write path off), so its default-run row is NOT MEASURED; the bound run above is the number.

## Against the PRD claims

The decision to mark a finding confirmed, refuted or not measurable is made in plan 384-09. The fixture room is small, so the room-size-dependent parts follow on real-room copies in plan 384-08; the database open time itself follows in plan 384-07.

| Finding | PRD claim in one phrase | Measured number | Words |
|---------|-------------------------|-----------------|-------|
| S7 | MCP start loads 37 tool files eagerly | 37 files in lib/mcp/tools; 735 modules loaded by the os server, 290 by the brain shim | matches |
| S7 | registers 24 eureka tools when unconfigured | 24 of 72 tools are eureka-named | matches |
| S7 | requires the SDK client at the top | SDK client package present in the os profile, 12 ms self time, 1.9 percent; absent in the brain shim | matches (the cost is small) |
| S7 | start cost (confirm by --cpu-prof) | os initialize 522.2 and 562.5 ms (n 7, spread 7.4 percent) against 51.5 and 47.7 ms for bare node; tool files 0.6 percent of self time, node loader 57.8 percent, zod 17.6 percent; effect of the 16 eureka files NOT RESOLVED (five sets from -50 to +138 ms) | cost of tool files NOT MEASURED apart from the loader |
| S10 | a watcher starts in every MCP process; N sessions = N watchers | 79, 781 and 4,525 watches per process at 1, 10 and 58 rooms; 3 processes hold 3 times that; idle CPU 0 ms in 10 s; RSS +62.7 MB (1 room) and +108 MB (58 rooms) over bare node | matches (count); CPU cost not shown; RSS cost not separated from the server |
| S8 | stop_gate_check blocks the loop for up to 7 s | median 865.6 ms first call (p95 1104.1, max 5659.5, n 15), 691.7 ms warm; ping blocked for about the whole call | differs by 6.1 s in the median (the 7 s is the sum of the ceilings; the maximum seen was 5.7 s) |
| S8 | cascade classify-insight blocks per artifact | not reachable through MCP in this tree (write path off by default; schema refuses the file-path inputs; no file path reaches the cascade) | NOT MEASURED (NOT MEASURABLE, reasons above) |
| S3 | no handle reuse, a 7-step open on every open | 2 opens per call for room_state, artifact_file, memory_event; 4 opens for the first room_startup call; 10 exec statements per open; the second call opens again | matches (counts); open time NOT MEASURED here (plan 384-07) |
