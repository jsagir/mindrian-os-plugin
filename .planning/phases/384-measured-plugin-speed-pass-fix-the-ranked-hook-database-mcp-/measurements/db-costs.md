# Phase 384 plan 07: the room database open (finding S3)

Written 2026-11-05 by plan 384-07. Tree: a pinned export of BASE_SHA_384 (db2ea3b05bb70b55741bdeb40b545801b0c37cbe), not the live tree. Room: the fixture room (64 files, room.db of 266,240 bytes at the start of the timing runs). Each timing and counting child ran with a sandbox HOME and the sandbox rooms home. Cap: taskset -c 0-3. Lock held for every run. load1 at the start of every result file is below 2 (verify-results exits 0). Median is the middle sample; p95 is the sample at index floor(0.95 x (n - 1)). Spread is |m1 - m2| / mean x 100 between two sets of the same tree. DIRECT means a number the bench measured. DERIVED means a number computed from measured numbers. NOT MEASURED has a reason. The bench is bench/db-open-bench.cjs; it changes no product file and it calls openRoomDb on the scratch room only.

Result files: s3-open-vs-bare.json (set 1, n 7), s3-open-vs-bare-set2.json (set 2, n 7), s3-open-vs-bare-rerun15.json (n 15, run once because several targets of the two sets had a spread above 10 percent), s3-session-opens.json (counts, 3 repeats). The sources of the per-tool opens are s3-tool-opens.json and s3-tool-opens-write-on.json of plan 384-06.

## How the open was timed

A is openRoomDb plus closeRoomDb. B is a bare DatabaseSync on the same room.db with the same timeout option (5000) plus close. A third target (A0) is A with the environment variable MINDRIAN_DISABLE_BYPASS_AUDIT set to 1, which switches off the caller audit that openRoomDb runs first (stack read, folder create, hash, append to a log file under the home folder). No product file was edited to do this.

Each sample is one fresh node process. The clock (process.hrtime.bigint) runs around the open calls only; the requires come first, and both kinds of process load room-db.cjs before the clock starts, so module load time is NOT in these numbers. Cold: one open in a fresh process (the first open of that process). Warm: a loop of 100 opens in one process; the sample is the mean per open. A round runs A, B, A0 or A0, B, A, so A and B alternate in the order A B, B A, A B, B A, A B, B A, A B (stored in the file as `interleave`). The room.db exists and is migrated before the first timed sample (untimed warm-up opens), so an open here is the open of an existing database. The harness rounds a statistic to 0.1 ms; a bare open takes 0.03 to 0.3 ms, so every target also carries `wall_ms_fine` (3 decimals) and the tables below use that value.

## S3: the open against a bare open (DIRECT, fixture room, ms)

| Target | set 1 median (p95), n 7 | set 2 median (p95), n 7 | spread | rerun median (p95), n 15 |
|--------|-------------------------|-------------------------|--------|--------------------------|
| cold open (A) | 6.157 (8.498) | 6.228 (8.586) | 1.1 percent | 5.965 (9.605) |
| cold bare open (B) | 0.259 (0.308) | 0.296 (0.321) | 13.3 percent | 0.236 (0.377) |
| warm open (A), mean per open of 100 | 1.043 (1.202) | 1.021 (1.903) | 2.1 percent | 1.157 (2.038) |
| warm bare open (B), mean per open of 100 | 0.046 (0.053) | 0.032 (0.033) | 35.9 percent | 0.035 (0.080) |
| cold, A minus B per round (DERIVED) | 5.923 | 6.008 | 1.4 percent | 5.728 |
| warm, A minus B per round (DERIVED) | 1.012 | 0.984 | 2.8 percent | 1.126 |

Reading: the open of the product costs about 6.0 ms cold and about 1.1 ms warm. A bare open costs about 0.24 ms cold and about 0.035 ms warm. So the open is about 25 times a bare open cold and about 33 times warm (DERIVED from the n 15 medians). The spread of the open itself is small (1.1 and 2.1 percent). The spread of the bare open is above 10 percent in absolute terms of 0.01 to 0.04 ms, which is the resolution limit of this host; the n 15 rerun gives 0.236 and 0.035, inside the range of the two sets. The p95 of the warm open in set 2 (1.903) is high against its median; the n 15 p95 is 2.038, so the tail of a warm open is about twice its median.

Caller audit (A against A0). NOT RESOLVED. The per-round difference A minus A0 has a median of 0.093 ms cold and -0.152 ms warm at n 15, with a range of -7.3 to +6.5 ms cold and -1.1 to +1.2 ms warm; the two n 7 sets gave +1.9 and +2.8 ms cold and +0.16 and -0.03 ms warm. The sign changes between sets, so the audit cost cannot be told apart from run noise on this host. The audit runs for every caller outside lib/core/navigation, the tests and the migration scripts (room-db.cjs lines 57 to 93, PROVEN by reading); the bench caller is not on that list, so A includes the audit and A0 does not.

## S3: what one open runs (DIRECT counts, probe preload, separate counting runs)

Counts are per process. Three repeats each; all repeats agree.

| Open | constructed | exec calls | prepare calls |
|------|-------------|------------|---------------|
| bare DatabaseSync (B) | 1 | 0 | 0 |
| openRoomDb on an existing database | 1 | 20 | 15 |
| openRoomDb on a new, empty room folder | 1 | 84 | 32 |
| five openRoomDb calls in one process | 5 | 100 (20 per open) | 75 (15 per open) |

A second counting child tallied the same open by the leading keyword of each statement text (only the keyword is kept; no SQL text is written).

| Open | exec calls by keyword | prepare calls by keyword |
|------|-----------------------|--------------------------|
| existing database | PRAGMA 3, CREATE 14, BEGIN 1, INSERT 1, COMMIT 1 | SELECT 15 |
| new database | PRAGMA 5, CREATE 28, BEGIN 6, ALTER 22, UPDATE 13, DROP 2, INSERT 2, COMMIT 6 | SELECT 17, PRAGMA 6, INSERT 9 |

Reading: an open of an existing database runs 20 exec calls and 15 prepare calls every time, with no handle reuse (five opens in one process run the chain five times). 14 of the 20 exec calls start with CREATE (tables, indexes and triggers, all IF NOT EXISTS). One exec call can hold more than one statement, so 14 is a lower bound of the DDL statements. The chain itself is 7 to 8 calls after the three PRAGMA calls (lazygraph.initSchema, memory.initMemorySchema, the optional phase 109 provenance step, phase 109 session focus, phase 160, phase 222, phase 224, installChangeLog; room-db.cjs lines 296 to 322, PROVEN by reading). The first open of a new room is a larger job (84 exec calls) and is NOT timed here.

Number of call sites (DIRECT grep, an upper bound, not a call graph): 141 lines that contain `openRoomDb(`, outside comment-only lines and outside the definition, in 76 files under lib and scripts (56 in lib, 20 in scripts, none in hooks or bin). The count can include a mention in a string or a trailing comment.

## S3: opens per SessionStart (DIRECT counts, fixture room, 3 counting runs, startup)

Counted with the probe preload on every node process of the event (44 node processes per run). The three runs agree: 12 opens, 83 exec calls, 269 prepare calls in each. The room.db was 266,240 bytes before the warm-up and 462,848 bytes after the runs.

| Hook script (label of the process) | node processes | opens (constructed) | exec calls | prepare calls |
|------------------------------------|----------------|---------------------|------------|---------------|
| agentshield-sessionstart-scan.cjs | 1 | 1 | 20 | 16 |
| check-pending-ambiguous.cjs | 1 | 1 | 20 | 16 |
| check-pending-breakthrough.cjs | 1 | 1 | 20 | 24 |
| memory-lifecycle.cjs | 1 | 1 | 20 | 18 |
| sessionstart-coordinator.cjs | 1 | 1 | 0 | 2 |
| feynman-minto-guardian.cjs | 2 | 1 | 0 | 4 |
| sync-rooms-graph | 1 | 1 | 3 | 6 |
| eval (node -e children) | 24 | 5 | 0 | 183 |
| 11 other hook scripts | 12 | 0 | 0 | 0 |
| total | 44 | 12 | 83 | 269 |

Four processes run exactly 20 exec calls, the signature of a full openRoomDb chain on an existing database (measured above). Those four are 80 of the 83 exec calls. The other 8 opens run 0 or 3 exec calls, so they do not run the chain; they open the file and read (INFERRED from the exec counts; the call path of each script was not traced). So of the 12 opens of a SessionStart, 4 run the setup chain and 8 do not.

Two limits of this count. (1) The key `SessionStart:startup:unchanged` never reaches the unchanged path in the fixture room (plan 384-04 found the same: the state step takes the compute path because the rooms registry file is newer than STATE.md at every start); in this file `changed_path_taken_runs` is 3 of 3, so these are the opens of the compute path. The opens on the reuse path are NOT MEASURED. (2) The network-capable npm reconcile hook is not run (plan 384-04), so the count is a lower bound for a real install.

## S3: opens per MCP tool call (source: plan 384-06, DIRECT counts)

From s3-tool-opens.json (write path off, default) and s3-tool-opens-write-on.json (write path on, room bound). First call and second call of the same tool in one server process; 3 repeats; all repeats gave the same open counts. The second call opens as many handles as the first, so no handle is reused between calls.

| Tool | opens, first and second call | exec calls | chain opens (exec / 20, INFERRED) | modules added by the first call |
|------|------------------------------|------------|-----------------------------------|---------------------------------|
| room_state status | 2 and 2 | 0 | 0 | 3 |
| suggest_next | 1 and 1 | 0 | 0 | 0 |
| stop_gate_check | 1 and 1 in the server, plus 1 child node process | 0 | 0 | 7 |
| room_startup (write path on) | 4 and 2 | 42 and 22 | 2 and 1 | 2 |
| artifact_file (write path on) | 2 and 2 | 20 | 1 and 1 | 1 |
| memory_event (write path on) | 2 and 2 | 20 | 1 and 1 | 0 |
| room_graph graph-rebuild (write path on) | 2 and 1 | 4 and 3 | 0 and 0 | 3 |
| room_list, room_search | 0 and 0 | 0 | 0 | 0 |

Plan 384-06 wrote "10 exec statements per open". That is the average over the opens of a call. This plan shows that an openRoomDb chain open runs 20 exec calls and that a call such as artifact_file opens twice and runs 20 exec calls in total, so one of its two opens runs the chain and the other does not. The figure of 10 per open should be read as 20 per chain open.

## S3 cost basis (DERIVED)

Inputs: cold open (A) median 5.965 ms and warm open 1.157 ms (n 15, DIRECT above); cold bare open 0.236 ms and warm bare open 0.035 ms (n 15, DIRECT above). The upper bound treats every open as a full chain open. The lower bound treats only the chain opens (exec calls divided by 20) as full opens and every other open as a bare open. The first call of a tool uses the cold values; the second call uses the warm values. A hook process always makes its first open in a fresh process, so the cold values apply to SessionStart.

Per SessionStart (12 opens, 4 of them chain opens):

| Basis | Parts | ms |
|-------|-------|----|
| upper bound, every open a chain open, cold | 12 x 5.965 | 71.6 |
| lower bound, 4 chain opens plus 8 bare opens, cold | 4 x 5.965 + 8 x 0.236 | 25.7 |

The hook processes run side by side, so these sums are serial costs, not a wait. For scale, plan 384-04 measured the blocking wall of `event:SessionStart:changed` at 4,421.5 ms (set 1) and 2,720.3 ms (set 2) on the fixture room, n 7 each (different runs, large spread, so the share is only an order of magnitude): the chain opens alone are under 1 percent of that wall (DERIVED, cross-file). The module load time of room-db.cjs and its dependencies in each of those processes is NOT MEASURED here.

Per tool call (opens from plan 384-06; the reply column is the `tool_ms_median` field of the plan 384-06 files, which for some rows differs from the reply times written in mcp-costs.md, so the denominator is not settled and the absolute milliseconds are the number to use):

| Tool | first call: upper, lower (ms) | second call: upper, lower (ms) | reply, first and second (ms) |
|------|-------------------------------|--------------------------------|------------------------------|
| room_state status | 11.9, 0.5 | 2.3, 0.07 | 21.0, 8.7 |
| suggest_next | 6.0, 0.2 | 1.2, 0.04 | 20.1, 6.9 |
| stop_gate_check (server open only) | 6.0, 0.2 | 1.2, 0.04 | 933.6, 877.9 |
| room_startup (write path on) | 23.9, 12.4 | 2.3, 1.2 | 179.7, 75.7 |
| artifact_file (write path on) | 11.9, 6.2 | 2.3, 1.2 | 87.5, 96.1 |
| memory_event (write path on) | 11.9, 6.2 | 2.3, 1.2 | 82.9, 91.9 |
| room_graph graph-rebuild (write path on) | 11.9, 0.5 | 1.2, 0.04 | 128.8, 137.6 |

Reading: for a write tool the open is a few percent to about 14 percent of the first call (upper bound) and about 1 to 7 percent (lower bound); on the second call in a warm server it is 1 to 3 percent. For a read tool the open is small. For stop_gate_check (about 0.9 s per call) the open is under 1 percent; its cost is elsewhere (plan 384-06). The child node process that stop_gate_check starts opens the database once more; that open is not in the table.

## Against the PRD claims

The decision to mark a finding confirmed, refuted or not measurable is made in plan 384-09. The fixture room.db is small (266,240 bytes at the start), so the open time on a real room.db and the opens of a real-room SessionStart follow in plan 384-08 with the same bench.

| Finding | PRD claim in one phrase | Measured number | Words |
|---------|-------------------------|-----------------|-------|
| S3 | a 7-step setup chain and about 14 DDL statements on every open | 20 exec calls and 15 prepare calls per open of an existing database, every time; 14 of the exec calls start with CREATE; the chain is 7 to 8 calls after 3 PRAGMA calls | matches |
| S3 | no handle reuse | 5 opens in one process run the chain 5 times; the second MCP call of a tool opens as many handles as the first | matches |
| S3 | about 50 call sites | 141 lines with `openRoomDb(` in 76 files under lib and scripts (grep, upper bound) | differs by about 90 lines (grep upper bound; exact call sites NOT MEASURED) |
| S3 | the open is a cost worth fixing (cost per open, cold and warm) | cold 5.965 ms (p95 9.605, n 15) against 0.236 ms bare; warm 1.157 ms (p95 2.038, n 15) against 0.035 ms bare; spread of the open 1.1 and 2.1 percent; the caller audit share NOT RESOLVED | measured (about 25 times a bare open cold, about 33 times warm) |
| S3 | opens per session and per tool call | 12 opens per SessionStart of which 4 run the chain (3 runs agree); 0 to 4 opens per tool call, 0 to 2 chain opens | measured; the cost per SessionStart is 25.7 to 71.6 ms of serial work, under 1 percent of the blocking wall (DERIVED) |
