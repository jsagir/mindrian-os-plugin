# Performance harness (Phase 384)

Measures the paths a person or an operator waits for. Node built-ins only. Ships nothing: `tools/` is not in the npm tarball. Carried over from 5850f067e (Phase 382 branch), reviewed in plan 384-01, extended in 384-02 and 384-03.

## Targets (`node tools/perf/perf-harness.cjs targets` lists the ids)

- `event:<Event>[:shape][:changed|:unchanged][:tx4m]` - all hooks of one event start together; the time is the wait for the last blocking hook. `:changed` touches one artifact first. `:unchanged` runs one untimed warm-up. `:tx4m` gives Stop a 4 MiB transcript. `event:SessionStart:compact` sends source compact. Async hooks are reported apart. `per_hook` holds wall and CPU medians per hook.
- `mcp:mindrian-os`, `mcp:mindrian-brain` - spawn to the `initialize` reply.
- `doctor:all` - `scripts/doctor.cjs --all --json` (900 s limit per run).
- `scan:room-scan`, `scan:compute-state`, `scan:compute-team`, `scan:analyze-room`.
- `ledger:section-check` and `floor:node` (`node -e 0`, the start-up floor).

## Subcommands and flags

- `run --tree <dir> --room fixture|copy --runs N --set <s> --label <name> --out <file>` plus: `--targets all|id,id`, `--scratch <dir>`, `--cpus N|all`, `--count-pass` (untimed: modules and node starts), `--base-sha <40 hex>`, `--restore per-target|per-set` (default per-target), `--tree-b <dir> --out-b <file> --label-b <name>` (A B, B A, A B, B A).
- Source room for `--room copy`, in this order: env `MOS_REAL_ROOM_384`, `--source <dir>`, `--source-file <file>` (first line is the path), `--pick local|mount [--idle-ms N]`. No form prints a path.
- `quiet-room --source <dir> [--idle-ms N]` prints `holders=H changed_paths=C`; exit 0 quiet, 75 not.
- `pick-room --class local|mount [--idle-ms N] [--save <file>]` prints one line (class, file count, file system); `--save` writes the path with mode 0600, outside the repo. Registry: `MOS_PERF_REGISTRY` or the registry file of the rooms home.
- `merge <a.json> <b.json> ... --out <file>` - timing files (unique target ids, equal room kind) or counts files (one section per file).
- `compare a b [--out f]`, `spread`, `verify-results <dir>`, `summarize-isolation <dir> --out f`.
- `clean-bench --source <dir> | --all [--scratch <dir>]` - bench folder `mos-384-bench/<key of source>`.
- Self-test only (need `MOS_PERF_SELFTEST=1`): `--allow-short`, `--skip-gates`, `--settle-ms`, `--room synthetic`.
- `node tools/perf/phase-guard.cjs <BASE_SHA>` - phase commits stay inside tools/perf, tests/test-384-*, the phase folder.

## Run under the lock

    mkdir -p "$HOME/.cache" && flock -w 7200 "$HOME/.cache/mos-perf-384.lock" \
      node tools/perf/perf-harness.cjs run --tree . --room fixture --runs 7 \
      --set s1 --label main --out s1.json

A pinned tree: export a commit with `git archive`, link `node_modules`, and pass `--tree <export> --base-sha <sha>`.

## Rules (C2)

- R1 No lock, no run (`lock not held`, exit 1). Override the file with `MOS_PERF_LOCK_FILE`.
- R2 Gate: load1 below 2 at the start (up to 900 s) and before each target (up to 300 s). A timed-out gate marks the target `noisy`; `verify-results` fails the file.
- R3 Exit 75 while a `tests/run-all-` process exists.
- R4 At least 7 runs. Median is the middle sample. p95 is the sample at index floor(0.95 x (n - 1)); at n = 7 the second largest. Spread is |m1 - m2| / mean x 100.
- R5 Every child runs under `taskset -c 0-3` (`--cpus all` removes the cap).
- R6 A run that exits 126 or 127, dies by an unsent signal, or times out is not a sample (`failed_runs`, `timed_out`). Hidden background work is followed by a run marker; survivors are killed and fail the run.
- R7 A `:changed` target must take the changed path in every run (proved from the room state log).
- R8 Results hold numbers, ids and the labels `fixture-room`, `real-copy`. A scan blocks any home, scratch, source or `MindrianRooms` path.

## Exit codes

0 ok, 1 rule breach (also lock not held, Part 8 hit), 2 usage, 3 isolation breach (a path changed in both copy and source), 75 host or source room busy.

## Result schemas

`mos.perf-384/1` (timings; `verify-results` needs n of 7 or more): machine record, room, `targets[]` with `n`, `wall_ms`, `cpu_ms`, `rss_mb` (median, p95, min, max), `exits`, `failed_runs`, `timed_out`, `per_hook`, `background_ms`, `escaped_max`, `survivors_left`, `changed_taken_runs`, load1 and `noisy`. `mos.perf-384-counts/1` (counts): machine record and Part 8 scan only. A file with another `mos.perf-` schema fails.

## Limits

- Only CommonJS modules are counted in the count pass.
- CPU and RSS come from GNU time and cover waited-for children only.
- The Brain is unreachable, so Brain network time is not measured.
- The network-capable npm reconcile hook is not measured: every SessionStart number is a lower bound.
- Exec counts made by the census cover the descendants of the hook shell by design. The process starts of Claude Code itself are not counted.
- Linux only: native Windows process-start cost is not measured. A 9p copy is not an ext4 room.
- Owner question Q1 is open: the isolation check is strict, so a `room.db-shm` change in both copy and source is a breach.
