# Script costs: S5, S6 and S9 (plan 384-05)

Tree: pinned export of BASE_SHA_384 db2ea3b05bb70b55741bdeb40b545801b0c37cbe, label `pinned-db2ea3b05` (not the live checkout; a peer edits product files there). Room: the fixture room (a sandbox, 14 sections, no real room) and synthetic data. Host: 12 cores, 4-core cap (`taskset -c 0-3`), Node v22.23.1, Linux under WSL2, file system ext2/ext3 class (sandbox on the local disk). Every run was under the 384 lock. Load1 at the start of each block was below 2 (values on file in each result file). n is the number of runs that entered the statistic. Median and p95 (sorted sample at index floor(0.95 x (n - 1))) are in ms. Two sets per timing number (set 1 and set 2, taken one after the other when the host was quiet again). Spread is |m1 - m2| / mean x 100, in percent.

The room-dependent parts on real-room copies follow in plan 384-08 with the same runner (`script-costs.cjs --room copy`). Nothing here was measured on a real room. The real ledger folder was read for line counts only (numbers below).

Result files (all in this folder): `s5-drain.json` (set 1), `s5-drain-set2.json`, `s5-drain-rerun-set1.json`, `s5-drain-rerun-set2.json`, `s5-autoexplore.json`, `s5-autoexplore-set2.json`, `s5-autoexplore-reads.json`, `s5-autoexplore-reads-set2.json`, `s6-ledger.json`, `s6-ledger-set2.json`, `s9-transcript.json`, `s9-transcript-set2.json`, `s9-stop-reads.json`.

## S5: Brain drain on an empty queue (n = 20 per set)

The hook is the `brain-derivation-drain.cjs` command from `hooks/hooks.json`, run as `bash -c` with the UserPromptSubmit payload on stdin, in the fixture room whose queue file is absent (empty queue). Each round runs the hook, a bare `node -e 0` and a `bash -c` wrapped `node -e 0` in a rotated order.

| Target | Set 1 median (p95) | Set 2 median (p95) | Spread % |
|--------|--------------------|--------------------|----------|
| hook wall | 73.8 (77.8) | 78.0 (100.6) | 5.5 |
| floor: bare node start | 22.5 (25.7) | 22.4 (24.6) | 0.4 |
| floor: bash plus node start | 23.3 (25.7) | 25.8 (30.4) | 10.2 (2.5 ms apart) |
| hook minus bare node floor (DERIVED, per pair) | 51.5 (55.1) | 55.3 (79.3) | 7.1 |
| hook minus bash floor (DERIVED, per pair) | 50.3 (54.0) | 53.3 (72.7) | 5.8 |

The one spread above 10 percent is the bash floor. It was run again in both sets at n = 15 (the whole drain-empty block): rerun set 1 floor-bash-node 23.6 (27.6), hook 73.7 (78.2), hook minus bash floor 50.2 (53.0). Rerun set 1 is within 1.3 percent of set 1 for the bash floor (23.6 against 23.3) and within 0.2 percent for the hook (73.7 against 73.8). Rerun set 2 could not be taken at the speed of the earlier blocks: the host slowed down while load1 stayed below 2. Four attempts gave a bare node floor of 33.5, 34.2, 42.7 and 48.6 ms (22.4 ms in set 2 and in rerun set 1). The file kept is the third attempt (`s5-drain-rerun-set2.json`: hook 139.6 (p95 182.2), floor bash plus node 42.3, hook minus bash floor 94.8, n = 15, load1 1.66 at the start and 1.61 at the end). Those numbers are not comparable with set 1 and no rerun spread is claimed for set 2; the set 1 numbers above and rerun set 1 are the clean ones. The set 2 hook p95 of 100.6 is one slow stretch (load1 was 1.95 at the start of set 2); the median of the hook is within 5.5 percent of set 1.

Hook CPU median 70 ms (set 1) and 80 ms (set 2) (GNU time, 10 ms steps); peak RSS 59.6 MB against 41.9 MB for bare node.

Count run (apart from the timing runs, probe preload): the hook script loads 169 CommonJS modules in one node process and makes 123 file calls on the plugin library (module files); it constructs 0 databases. The queue file was absent in the fixture room.

Cold load time of the modules the script loads before it looks at the queue (each in a fresh node process, `process.hrtime.bigint` around the require, n = 20):

| Module | Set 1 median (p95) | Set 2 median (p95) |
|--------|--------------------|--------------------|
| `lib/core/folder-memory.cjs` (alone) | 47.6 (50.5) | 48.8 (50.6) |
| `lib/core/brain-client.cjs` (alone) | 7.1 (7.8) | 7.1 (7.7) |
| `lib/core/navigation.cjs` (alone) | 48.9 (50.2) | 49.6 (50.5) |
| the three in the order of the script | 48.9 (51.5) | 49.2 (51.0) |

In the script order the first module (folder-memory) costs 48.4 ms and the other two add about 0 ms, because they share the same dependencies (the SQLite module). The module warm-up is therefore about 49 ms of the 50 to 53 ms that the hook costs above the node floor.

## S5: auto-explore drain with F finding files (n = 7 per set)

Three variants per F, all in the fixture room (finding files removed first, so F is the whole count; the hook ran with a sandbox HOME and the explored-materials ledger reset before every run):

- open: a finding is pending; the script surfaces one (the whole path).
- held: the ambient ledger lists every finding; each file is read and skipped (the pure scan).
- done: the explored-materials ledger says every finding was answered; each file is read and parsed and the script emits nothing (the steady state when finding files stay on disk).

| Target | Set 1 median (p95) | Set 2 median (p95) | Spread % |
|--------|--------------------|--------------------|----------|
| F = 0 | 30.9 (32.1) | 31.2 (32.2) | 1.0 |
| F = 10 held | 31.8 (33.3) | 33.6 (34.0) | 5.5 |
| F = 10 done | 32.6 (34.3) | 33.8 (34.8) | 3.6 |
| F = 10 open | 104.6 (116.9) | 107.1 (109.3) | 2.4 |
| F = 100 held | 36.0 (36.2) | 37.2 (37.8) | 3.3 |
| F = 100 done | 36.3 (39.0) | 35.8 (36.7) | 1.4 |
| F = 100 open | 109.1 (119.2) | 107.9 (108.5) | 1.1 |

Counted file reads of the script per run (probe preload, `readFileSync` under the room `.mindrian` folder; two count runs per variant agreed, in both sets):

| F | open | held | done |
|---|------|------|------|
| 0 | 0 | 0 | 0 |
| 10 | 10 | 20 | 10 |
| 100 | 100 | 200 | 100 |

Reads per finding file per prompt: 1 (open, done) and 2 (held: one read of the finding file and one read of the ambient ledger by the held check). Modules loaded: 5 for F = 0, held and done; 182 for open (the surface path loads the agent library and constructs 2 databases). The open path writes one new finding file per run (the runner removed it before every run).

Reading: the scan itself costs about 5 ms more than F = 0 at 100 finding files (about 0.05 ms per file). A pending finding costs about 74 to 78 ms more than F = 0, once per finding.

## S6: explored-materials ledger read (n = 7 children per number per set)

Synthetic ledger rows in a sandbox HOME (`appendMaterial`, row shape of `validateEntryShape`, a section path per row). The timed child requires the store and reads an id that is absent. `find-first` is the first `findLatest` call in a fresh process; `find-warm` is the per-call mean of 100 further calls in the same process; `read-first` is the first `readMaterials` call.

| Rows (file bytes) | find-first set 1 / set 2 | find-warm set 1 / set 2 | read-first set 1 / set 2 |
|-------------------|--------------------------|-------------------------|--------------------------|
| 100 (37,390) | 0.4 / 0.4 | 0.1 / 0.1 | 0.4 / 0.4 |
| 1,000 (374,890) | 1.7 / 1.7 | 1.3 / 1.2 | 2.8 / 2.9 |
| 10,000 (3,758,890) | 17.6 / 17.3 | 13.2 / 13.0 | 22.5 / 24.6 |

p95 of the largest size: find-first 18.1 and 17.5, find-warm 13.3 and 13.4, read-first 23.5 and 27.9. Largest spread: find-warm at 1,000 rows 8.0 percent (0.1 ms apart) and read-first at 10,000 rows 8.9 percent (2.1 ms apart); all spreads are below 10 percent.

Slope from the three points (least squares, ms per 1,000 rows): find-first 1.75 and 1.72; find-warm 1.32 and 1.31; read-first 2.22 and 2.43 (set 1 and set 2).

Real ledger sizes on this host (line counts only, nothing else read): 228 ledger files; the largest has 539 rows; the median is 1 row. The cost at 539 rows was not measured; it lies between the measured points at 100 rows (0.4 ms) and 1,000 rows (1.7 ms).

## S9: transcript tail read by the Stop hooks

`readTurnText` (lib/hmi/turn-text.cjs) on a synthetic JSONL transcript made from filler words. Cold = a fresh node process (require plus first call). Warm = the mean of 50 calls in one process. Bare read = `fs` read of the same bytes (the whole file up to the 2 MiB cap, else the last 2 MiB) with the UTF-8 decode, no parse. n = 7 children per number per set; the transcripts are 0.5, 2 and 4 MiB (actual bytes on file).

| Size | cold first call set 1 / set 2 | cold with require set 1 / set 2 | warm per call set 1 / set 2 | bare read set 1 / set 2 |
|------|-------------------------------|---------------------------------|-----------------------------|-------------------------|
| 0.5 MiB | 6.3 / 5.8 | 6.6 / 6.2 | 2.8 / 2.9 | 0.8 / 0.8 |
| 2 MiB | 16.5 / 16.5 | 16.8 / 16.8 | 9.5 / 9.5 | 1.8 / 1.7 |
| 4 MiB | 16.0 / 15.5 | 16.3 / 15.8 | 9.6 / 9.5 | 1.8 / 1.8 |

The module load of turn-text itself is 0.3 ms. The 4 MiB file costs the same as the 2 MiB file because the reader takes only the last 2 MiB. The parse is the larger part: at 2 MiB about 14.7 ms of the 16.5 ms cold call is the line parse (cold call minus bare read). p95 of the cold call: 7.4 and 6.2 (0.5 MiB), 17.4 and 17.2 (2 MiB), 16.6 and 16.6 (4 MiB). Spread: all below 10 percent (largest 8.3 percent, the 0.5 MiB cold call, 0.5 ms apart).

Counted reads in one Stop event (the real hook set of `hooks.json`, the 4 MiB transcript, probe preload, 3 repeats per variant; the transcript is the one file named in the probe categories):

| Hook script | Processes | Transcript reads (open or read) | Transcript stats |
|-------------|-----------|---------------------------------|------------------|
| check-card-fire.cjs | 1 | 1 | 1 |
| check-voice-style.cjs | 1 | 1 | 1 |
| ambient-stop, hmi-compliance-poll, jtbd-update, operator-update, gsd-graph-derive-sweep, on-stop and its child processes | 1 each or more | 0 | 0 |

So the Stop event reads the transcript tail twice (two scripts, once each), in two separate processes that run at the same time. The three repeats agree on this for both variants (unchanged: no artifact changed since the last Stop; changed: one artifact touched before the run).

Room file reads in the same Stop events (counts of `readFileSync` and `readFile` under the room and its `.mindrian` folder). The fixture room has 14 sections, all with a ROOM.md.

| Process group | Processes | Room file reads (unchanged, repeat 1) | Room file reads (changed, repeat 1) |
|---------------|-----------|---------------------------------------|-------------------------------------|
| `node -e` processes (9) | 9 | 136 (one process: 135) | 136 (one process: 135) |
| feynman-minto-guardian.cjs | 1 | 68 | 68 |
| recompile-room-references.cjs | 14 | 153 | 139 |
| room-render.cjs | 1 | 0 | 22 |
| user-archetype.cjs, gsd-graph-derive-sweep.cjs, state-write.cjs | 1 each | 6 | 7 |

One `node -e` process reads 135 room files, which is 9.6 reads per section for 14 sections, in every Stop event also when nothing changed. That shape (a walk over every section) is the shape of the folder-memory block in `scripts/on-stop` (ASSUMED: the probe does not name the code line). The total for the event is about 360 to 370 room file reads, about 26 per section. The three repeats do not agree in every count of the background processes (repeats_agree is false in both variants), because background jobs finish at different times; the transcript counts do agree (transcript_reads_agree is true in both variants). The table shows repeat 1. The time of the folder-memory walk was NOT MEASURED in this plan (plan 384-04 times the Stop hooks one by one).

## Against the PRD claims

| ID | PRD claim | Measured | Word |
|----|-----------|----------|------|
| S5a | Brain drain loads a 96 to 191 ms module on an empty queue | the three modules the script loads cost 48.9 ms (p95 51.5, n = 20; set 2 49.2); the hook costs 50.3 to 53.3 ms above a bash plus node floor | differs by 47 ms below the 96 ms lower bound |
| S5b | auto-explore drain re-reads every finding file | counted: 1 read per finding file per prompt (2 in the held case): 10 reads at F = 10, 100 reads at F = 100 | matches |
| S5c (no PRD number) | cost of the re-read | 5.4 ms and 4.6 ms (done variant) more than F = 0 at 100 files (set 1 and set 2: 36.3 and 35.8 against 30.9 and 31.2) | NOT A PRD CLAIM, number on file |
| S6 | ledger is re-parsed on every edit, O(n) per edit; time at 100 and 10k rows | find-first 0.4 ms at 100 rows and 17.6 ms at 10,000 rows (n = 7, set 2: 0.4 and 17.3); the ratio is 44 for 100 times the rows; slope 1.75 ms per 1,000 rows | matches (linear); the real maximum on this host is 539 rows, cost there NOT MEASURED |
| S9a | Stop reads the 2 MiB transcript tail twice | counted: 2 transcript reads per Stop (check-card-fire, check-voice-style), 0 in the other hook scripts; `readTurnText` on a 2 MiB or 4 MiB transcript takes 16.0 to 16.5 ms cold (n = 7) | matches (the count); the two reads run in parallel processes |
| S9b | folder-memory reads per section each turn | counted: 135 room file reads in one `node -e` process for 14 sections (9.6 per section) in every Stop event, also when nothing changed; time NOT MEASURED here | matches (the count), attribution to the on-stop block ASSUMED |

Plan 384-09 applies the confirm or refute rule. This table does not mark any finding confirmed or refuted.

## Notes

- Host noise. Peers ran suites and other measurement runs during this plan. Every block waited for load1 below 2 before it started; the start values in the machine records are 1.21 to 1.95. Load1 at the end of each file was 1.17 to 1.90.
- The first autoexplore run showed that the open path writes a new finding file in the room on every run, so a group no longer held F files. The runner now removes those files before every run and reports the count of reads that proves it (F = 0 reads 0 files, 5 modules loaded). The first pair of autoexplore files, the first transcript set 1 file and the first drain set 2 file were taken again (the machine record then held the load from before the room build, 27 to 30, instead of the load at the first gate). The files in this folder are the later runs.
- The probe preload slows a process, so the count runs are separate from the timing runs. No timing number in this file comes from a count run.
- Everything above is the fixture room or synthetic data. Real-room copies are measured in plan 384-08.
