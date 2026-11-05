# Performance harness (Phase 382)

One command measures the paths a person or an operator waits for. It uses node built-ins only and ships nothing: `tools/` is not in the npm tarball.

## What each target measures

- `event:<Event>[:shape]` - all hooks of one event start together; the time is the wait for the last blocking hook, as Claude Code runs them. `:changed` touches one artifact first (1,100 ms pause, then a touch). `:unchanged` runs one untimed warm-up first. Async hooks are reported apart and stay out of the wall. The network-capable npm reconcile hook is `not_measured`.
- `mcp:mindrian-os`, `mcp:mindrian-brain` - spawn to the JSON-RPC `initialize` reply. CPU and RSS are read from /proc at the reply.
- `doctor:all` - `scripts/doctor.cjs --all --json` (900 s limit per run).
- `scan:room-scan`, `scan:compute-state`, `scan:compute-team`, `scan:analyze-room` - the room scan and the three bash entry points.
- `ledger:section-check` - `build-section-command-ledger.cjs --check` (the exit code is recorded; a version drift exits 1 early).
- `floor:node` - `node -e 0`, the start-up floor.

`node tools/perf/perf-harness.cjs targets` lists the ids.

## Run a set

    flock -w 7200 "$HOME/.cache/mos-perf-382.lock" node tools/perf/perf-harness.cjs run \
      --tree <plugin tree> --room fixture|copy [--source <room dir>] --runs 7 --set s1 --label base --out s1.json
    node tools/perf/perf-harness.cjs run ... --count-pass --out counts.json   # untimed: modules and node starts
    node tools/perf/perf-harness.cjs run --tree A --tree-b B --out-b b.json ... # A/B, run order A B, B A, A B ...
    node tools/perf/perf-harness.cjs compare a.json b.json
    node tools/perf/perf-harness.cjs spread --fixture a b --copy c d --out spread.json
    node tools/perf/perf-harness.cjs verify-results <dir>

The `fixture` room is born from `tests/fixtures/release-room`. The `copy` room is a `cp -a` copy of `--source` (or `MOS_REAL_ROOM_382`): under `/mnt/` it goes to the Windows temp folder, to keep the 9p I/O class. Git remotes are removed from the copy. Each set restores the working copy from the first snapshot. `clean-bench` removes the snapshot.

## Rules

- R1 Wrap every run in `flock -w 7200 "$HOME/.cache/mos-perf-382.lock"`.
- R2 load1 must be below 2 at the start; the harness polls 15 s for up to 900 s, then exits 75.
- R3 The harness exits 75 while a `tests/run-all-` process exists.
- R4 At least 7 runs. Median is the middle sample (mean of the middle two when n is even). p95 is the sorted sample at index floor(0.95 x (n - 1)); at n = 7 that is the second-largest sample.
- R5 Every child runs under `taskset -c 0-(N-1)`, N = min(4, cores); `--cpus all` removes the cap.
- R6 Two trees run interleaved: A B, B A, A B, B A.
- R7 Each result holds the machine record (cores, node, platform, arch, kernel, cpu cap, room file system, HEAD, tree label, base sha, times, load1).
- R8 Results hold numbers, booleans, ids and the labels `fixture-room` and `real-copy`. A scan blocks any home, scratch, source or `MindrianRooms` path.

## Exit codes

0 ok, 1 rule breach, 2 usage, 3 isolation breach (a path changed in both the copy and the source), 75 host busy.

## Result schema `mos.perf-382/1`

`schema, machine, room{kind,file_count,byte_total,fs_type}, set, tree_label, cpus, runs, load1_start, load1_end, started_at, ended_at, isolation, targets[]`. A target holds `id, n, blocking, wall_ms, cpu_ms, rss_mb` (each `median, p95, min, max`), `exits, timed_out, not_measured, async_hooks, hook_count, background_ms, load1_start, load1_end`. The count file (`mos.perf-382-counts/1`) holds `node_starts, modules_total, modules_max_per_process` per target.

## Limits

- ES modules are not counted; only CommonJS `require.cache` is.
- CPU and RSS come from GNU time (10 ms steps); the event CPU is the sum over blocking hooks, the event RSS the largest hook.
- A 9p copy is not an ext4 room. Whole-second mtimes apply on 9p.
- The Brain is unreachable in every run, so Brain network time is not measured.
- Environment variables that look like keys or tokens are removed from every child.
- `--allow-short` and `--room synthetic` are for the self-test only (`tests/test-382-perf-harness.cjs`).
- `doctor:all` runs against a rooms home with one room; the cost of a sweep over many rooms is not measured here.
