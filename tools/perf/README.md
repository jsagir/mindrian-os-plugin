# Performance harness (Phase 384)

One command measures the paths a person or an operator waits for. It uses node built-ins only and ships nothing: `tools/` is not in the npm tarball. Carried over from commit 5850f067e (Phase 382 branch) and reviewed in Phase 384 plan 01.

## What each target measures

- `event:<Event>[:shape]` - all hooks of one event start together; the time is the wait for the last blocking hook. `:changed` touches one artifact first (1,100 ms pause, then a touch). `:unchanged` runs one untimed warm-up first. Async hooks are reported apart. The network-capable npm reconcile hook is `not_measured`, so every SessionStart number is a lower bound.
- `mcp:mindrian-os`, `mcp:mindrian-brain` - spawn to the JSON-RPC `initialize` reply.
- `doctor:all` - `scripts/doctor.cjs --all --json` (900 s limit per run).
- `scan:room-scan`, `scan:compute-state`, `scan:compute-team`, `scan:analyze-room` - the room scan and the three bash entry points.
- `ledger:section-check` - `build-section-command-ledger.cjs --check`.
- `floor:node` - `node -e 0`, the start-up floor.

`node tools/perf/perf-harness.cjs targets` lists the ids.

## Run a set

    mkdir -p "$HOME/.cache" && flock -w 7200 "$HOME/.cache/mos-perf-384.lock" node tools/perf/perf-harness.cjs run \
      --tree <plugin tree> --room fixture|copy [--source <room dir>] --runs 7 --set s1 --label base --out s1.json
    node tools/perf/perf-harness.cjs run ... --count-pass --out counts.json   # untimed: modules and node starts
    node tools/perf/perf-harness.cjs run --tree A --tree-b B --out-b b.json ... # A/B, run order A B, B A, A B ...
    node tools/perf/perf-harness.cjs compare a.json b.json
    node tools/perf/perf-harness.cjs spread --fixture a b --copy c d --out spread.json
    node tools/perf/perf-harness.cjs verify-results <dir>
    node tools/perf/phase-guard.cjs <BASE_SHA>   # phase commits stay inside tools/perf, tests/test-384-*, the phase folder

`--base-sha <40 hex>` records the base commit; without it the harness records `git rev-parse HEAD` of the tree, or `unknown`. The `copy` room is a `cp -a` copy of `--source` (or `MOS_REAL_ROOM_384`); under `/mnt/` it goes to the Windows temp folder. Git remotes are removed from the copy. `clean-bench` removes the snapshot (folder `mos-384-bench`).

## Rules

- R1 The harness refuses a real run unless the 384 flock is held by itself or an ancestor (`lock not held`, exit 1). Override the file with `MOS_PERF_LOCK_FILE`.
- R2 Gates: load1 below 2 at the start (poll 15 s up to 900 s, then exit 75) and again before each target (poll 5 s up to 300 s). A target whose gate timed out runs anyway, is marked `noisy`, and `verify-results` rejects the file.
- R3 The harness exits 75 while a `tests/run-all-` process exists; the per-target gate also waits for it.
- R4 At least 7 runs. Median is the middle sample. p95 is the sorted sample at index floor(0.95 x (n - 1)); at n = 7 that is the second-largest sample.
- R5 Every child runs under `taskset -c 0-(N-1)`, N = min(4, cores); `--cpus all` removes the cap.
- R6 Two trees run interleaved: A B, B A, A B, B A.
- R7 Each result holds the machine record (cores, node, platform, arch, kernel, cpu cap, room file system, HEAD, tree label, base sha, times, load1).
- R8 Results hold numbers, booleans, ids and the labels `fixture-room` and `real-copy`. A scan blocks any home, scratch, source or `MindrianRooms` path.
- R9 A run that exits 126 or 127, dies by a signal the harness did not send, or times out never enters a statistic. It counts in `failed_runs` or `timed_out`, and `verify-results` exits 1 for the file.

## Exit codes

0 ok, 1 rule breach (also: lock not held), 2 usage, 3 isolation breach (a path changed in both the copy and the source), 75 host busy.

## Result schemas

`mos.perf-384/1` (timing): `schema, machine, room{kind,file_count,byte_total,fs_type}, set, tree_label, cpus, runs, load1_start, load1_end, started_at, ended_at, isolation, targets[]`. A target holds `id, n, blocking, wall_ms, cpu_ms, rss_mb` (each `median, p95, min, max`), `exits, timed_out, failed_runs, not_measured, async_hooks, hook_count, background_ms, load1_start, load1_end, gate_waited_ms, noisy`. `verify-results` needs `n` of 7 or more only for this schema. `mos.perf-384-counts/1` (counts, no timing) holds `node_starts, modules_total, modules_max_per_process`; it passes with a complete machine record whatever `n` is. A file with another `mos.perf-` schema (for example the old 382 one) fails.

## Limits

- ES modules are not counted; only CommonJS `require.cache` is.
- CPU and RSS come from GNU time (10 ms steps).
- A 9p copy is not an ext4 room. Whole-second mtimes apply on 9p.
- The Brain is unreachable in every run, so Brain network time is not measured.
- The isolation check is strict: a sidecar change (`room.db-shm`) in both the copy and the source is a breach until the owner rules otherwise.
- `--allow-short`, `--skip-gates` and `--room synthetic` are for the self-test only and need `MOS_PERF_SELFTEST=1` (`tests/test-384-perf-harness.cjs`).
