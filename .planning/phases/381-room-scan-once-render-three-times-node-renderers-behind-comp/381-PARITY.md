# Phase 381 Parity Record

Plan 381-08, Task 1. Real values only. Every row was produced by the command named in it.

This is the recorded zero-diff run that plan 381-09 reads before it removes the legacy bodies.

## Run facts

- Date: 2026-10-29, window 22:54:15Z to 23:02:07Z (2026-10-30 00:54 to 01:02 local, Asia/Hebron).
- HEAD sha: 5affaf2b61700ee313067c71de3e38272f1a07ba (short 5affaf2b6), branch workspace/phase-381. No uncommitted change in lib/core or in the three scripts (`git status --porcelain` printed nothing for them).
- BASE_SHA: 65aaf329f9c514c71fff2f1a530cd366c0b87b66 (tests/helpers/oracle-381.cjs). It is an ancestor of HEAD. The sc6 sha 4f470032b and the hotfix 5a2dcfd4d are ancestors of HEAD.
- The three wrappers scripts/compute-team, scripts/analyze-room and scripts/compute-state carry the Phase 381 header (the node exec line; `MINDRIAN_LEGACY_COMPUTE=1` runs the bash body).
- `command grep -nF "strptime('$datestr'"` on the three scripts printed nothing (exit 1).
- Host: aarch64, node v22.23.1, GNU bash 5.2.21(1)-release (aarch64-unknown-linux-gnu), LANG=C.UTF-8, nproc 12, WSL2 kernel 6.18. Host time zone Asia/Hebron.

## Method

1. OLD is `git archive` of BASE_SHA (tests/helpers/oracle-381.cjs). NEW is the scripts of this tree.
2. Each pair runs on fresh `cp -a` copies of the source room. The real room was read once into a snapshot copy in the session scratchpad; the harness copied that snapshot per pair. No script ran in the real room. The snapshot (446 files, 137M) was deleted after runs (d) and (e).
3. Every child runs with LC_ALL=C.UTF-8, a pinned TZ (UTC, or the host zone in run b), a clean HOME and the net guard preloaded.
4. Only the `computed:` timestamp lines and the FUND_STALE day digits are normalized.
5. Stdout bytes, exit code and the full post-run tree content are compared. A file created in the run cwd (a marker) fails the pair.

## Runs

| Run | Command | Pairs | Last line | Exit | Start (UTC) | load1 start / end |
|---|---|---|---|---|---|---|
| (a) default, TZ=UTC | `node tests/test-381-parity.cjs --report <tmp>/a.md` | 68 | `parity: 0 diffs in 68 pairs` | 0 | 22:54:15Z | 0.64 / 2.56 |
| (b) host time zone | `node tests/test-381-parity.cjs --tz host --report <tmp>/b.md` | 68 | `parity: 0 diffs in 68 pairs` | 0 | 22:54:54Z | 2.36 / 1.97 |
| (c) legacy switch | `node tests/test-381-parity.cjs --legacy-switch --report <tmp>/c.md` | 68 | `parity: 0 diffs in 68 pairs` | 0 | 22:55:31Z | 1.81 / 1.90 |
| (d) real-room copy | `node tests/test-381-parity.cjs --room <snapshot of ROOM> --report <tmp>/d.md` | 71 | `parity: 0 diffs in 71 pairs` | 0 | 22:56:45Z | 1.89 / 1.54 |
| (e) OLD determinism, real-room copy | `node tests/test-381-parity.cjs --determinism --room <snapshot of ROOM> --report <tmp>/e.md` | 71 | `parity: 0 diffs in 71 pairs` | 0 | 22:57:35Z | 1.41 / 1.55 |

Last lines as printed:

```
(a) OLD vs NEW: 0 diffs in 68 pairs
(a) parity: 0 diffs in 68 pairs
(b) OLD vs NEW: 0 diffs in 68 pairs
(b) parity: 0 diffs in 68 pairs
(c) OLD vs NEW: 0 diffs in 68 pairs
(c) parity: 0 diffs in 68 pairs
(d) OLD vs NEW: 0 diffs in 71 pairs
(d) parity: 0 diffs in 71 pairs
(e) determinism (OLD vs OLD): 0 diffs in 71 pairs
(e) parity: 0 diffs in 71 pairs
```

Gate rooms (24 labels, every one in runs a to e): edge-room, edge-room[mtime-equal], edge-room[no-registry], hostile-room, bad-stage-room, empty-room, team-no-profiles, missing-room, and the repository fixture rooms 195-nested-room-tree/root-room, 272/room, futures-seed-room, graph-export-golden-room, icm-rooms/alpha-room, never-ready-room, release-room, sample-room, sample-room-opp, sample-room-personas, test-room-causal, test-room-graph, test-room-meeting, test-room-reasoning, test-room-visual, wiki-room-232. Runs (d) and (e) add `room-copy:room-snap`, the snapshot of the real room `<ROOM>`.

## Real-room copy, all three scripts

| Run | Script | Room | Result | OLD ms | NEW ms |
|---|---|---|---|---|---|
| (d) OLD vs NEW | compute-team | room-copy:room-snap | OK | 925 | 71 |
| (d) OLD vs NEW | compute-state | room-copy:room-snap | OK | 2484 | 255 |
| (d) OLD vs NEW | analyze-room | room-copy:room-snap | OK | 7516 | 104 |
| (e) OLD vs OLD | compute-team | room-copy:room-snap | OK | 922 | 918 |
| (e) OLD vs OLD | compute-state | room-copy:room-snap | OK | 2456 | 2498 |
| (e) OLD vs OLD | analyze-room | room-copy:room-snap | OK | 7434 | 7614 |

These times are parity-harness times on an ext4 copy under a loaded harness. They are not the measurement of record (see 381-MEASUREMENTS.md).

NOTE lines for the real-room copy (ruling 2 shapes; the file names are replaced by placeholders):

```
NOTE room-copy:room-snap carries file over 64 KiB: .mindrian/graph-derive-vectors.json (862899 bytes) (ruling 2 divergence)
NOTE room-copy:room-snap carries invalid UTF-8 or NUL: .mindrian/room.db (ruling 2 divergence)
NOTE room-copy:room-snap carries file over 64 KiB: .mindrian/room.db (5128192 bytes) (ruling 2 divergence)
NOTE room-copy:room-snap carries invalid UTF-8 or NUL: <section>/<section-file>.pdf (ruling 2 divergence)
NOTE room-copy:room-snap carries file over 64 KiB: <section>/<section-file>.pdf (254017 bytes) (ruling 2 divergence)
```

No script reads these files as text in a way that reaches stdout or the written tree, so the pairs still compare equal (the result column says OK on all three scripts). The fixture room graph-export-golden-room carries the same `.mindrian/room.db` shape.

## Hostile room (the quick 261029-u8x payloads as parity cases)

Ruling 2 as amended 2026-10-29: the python date fallback and the `node -e` section-name cases are no longer divergences, because the OLD oracle is safe. NEW must equal OLD (epoch 0, same stdout bytes, no marker file). The harness fails a pair when a file appears in the run cwd.

| Run | Script | Result | OLD ms | NEW ms |
|---|---|---|---|---|
| (a) TZ=UTC | compute-team | OK | 234 | 60 |
| (a) TZ=UTC | compute-state | OK | 1058 | 137 |
| (a) TZ=UTC | analyze-room | OK | 708 | 80 |
| (b) host zone | compute-team | OK | 218 | 58 |
| (b) host zone | compute-state | OK | 926 | 130 |
| (b) host zone | analyze-room | OK | 700 | 72 |
| (c) legacy switch | compute-team | OK | 226 | 226 |
| (c) legacy switch | compute-state | OK | 921 | 937 |
| (c) legacy switch | analyze-room | OK | 683 | 704 |
| (d) OLD vs NEW | compute-team | OK | 245 | 55 |
| (d) OLD vs NEW | compute-state | OK | 946 | 127 |
| (d) OLD vs NEW | analyze-room | OK | 698 | 84 |

Every row is OK, so on both sides the payloads gave equal bytes and no marker file.

## Named divergences (ruling 2 as amended 2026-10-29) and the test legs that pin them

These shapes are not in any gate room and not in the real room. Each is pinned in `tests/test-381-known-divergence.cjs` (run at 23:02Z on HEAD 5affaf2b6: `test-381-known-divergence: all legs passed`).

| Divergence | Pinning leg |
|---|---|
| SIGPIPE false negatives (`echo "$content" \| grep -q` under pipefail) | `ok - sigpipe-large-file (analyze): NEW pairs the large-file section with the consumer section` |
| Invalid UTF-8 (U+FFFD) | `ok - invalid-utf8 (team): NEW keeps the U+FFFD name row, OLD has no row for it`; `ok - invalid-utf8 (analyze): termsOf keeps terms for the U+FFFD header and NEW exits 0` |
| NUL byte | `ok - nul-byte (analyze): NEW names the NUL-byte section as the B2C side of a CONTRADICT line` |
| room-path-sed (a room path with a pipe) | `ok - room-path-sed (team): NEW rewrites the Contributions table under a room path with a pipe` |
| macOS python-path output | `ok - macos-python-path (compute-team): ...`; `ok - macos-python-path (analyze-room): ...`; `ok - macos-python-path (compute-state): ... NEW needs no python3 for current_room` |
| (extra leg) compute-state stderr | `ok - no-experimental-warning (compute-state): NEW stderr is empty on a fresh edge-room copy` |

## Test run on HEAD 5affaf2b6

All commands ran from the worktree root, one at a time, stdin from /dev/null. `git status --porcelain tests/fixtures` printed nothing before and after (0 lines).

| Command | Exit | Counts / last result line |
|---|---|---|
| `bash tests/run-all-381.sh` | 0 | `Phase 381: PASS=10 FAIL=0 SKIP=0` (8 test files, Part 8 sweep, dash fence) |
| `node tests/test-363.1-compute-state.cjs` | 0 | `all legs passed` (15 ok lines) |
| `node tests/test-compute-state-persists.cjs` | 0 | `compute-state-persists: ALL PASS` |
| `node tests/test-261029-kqv-stop-skip-recompute.cjs` | 0 | `stop-skip-recompute: ALL PASS` |
| `node tests/test-261029-lx3-sessionstart-skip.cjs` | 0 | `sessionstart-skip: ALL PASS` |
| `node tests/test-266-room-state-description.cjs` | 0 | `12 passed, 0 failed` |
| `bash tests/run-all-2401.sh` | 0 | `Phase 240.1: PASS=8 FAIL=0 SKIP=0` |
| `bash tests/run-all-363.1.sh` | 0 | `Phase 363.1: PASS=12 FAIL=0 SKIP=1` (the skip is the regression block, opt-in by RUN_363_1_REGRESSIONS=1) |
| `node tests/test-frontmatter-schema-reconcile.cjs` | 0 | `test-frontmatter-schema-reconcile: 8/8 passed` |
| `node tests/test-369-hook-require-graph.cjs` | 0 | `test-369-hook-require-graph: 5 passed, 0 failed` |
| `node tests/test-369-installed-layout.cjs` | 0 | `test-369-installed-layout: 7 passed, 0 failed, 0 skipped` |
| `node tests/test-365-falsify-missing-five.cjs` | 0 | `FALSIFIED (as predicted)` |
| `node tests/test-365-falsify-contradiction.cjs` | 0 | `FALSIFIED (as predicted)` |
| `node lib/memory/statusline-active-room-write.test.cjs` | 0 | `statusline-active-room-write: 7/7 tests passed` |
| `node tests/test-198-stop-gate-retry-ceiling.test.cjs` | 0 | `PASS test-198-stop-gate-retry-ceiling (15 assertions)` |
| `bash tests/test-phase-13.sh` | 0 | `Results: 32 passed, 0 failed` |
| `bash tests/test-phase-27-room-structure.sh` | 0 | `=== Results: 8 passed, 0 failed ===` |
| `node scripts/build-connector-registry.cjs --check` | 0 | `connector-registry: OK` |
| `node scripts/build-orchestration-projection.cjs --check` | 0 | `orchestration-projection: OK` |

Part 11: the connector registry and the orchestration projection checks report OK, so the phase adds no new invocable surface.

## Report tables of runs (a) to (e)

The five `--report` files follow unchanged. The snapshot label is `room-copy:room-snap`.

### Run (a) report

BASE_SHA: 65aaf329f9c514c71fff2f1a530cd366c0b87b66

parity: 0 diffs in 68 pairs

| suite | script | room | result | OLD ms | NEW ms | first diff |
|---|---|---|---|---|---|---|
| OLD vs NEW | compute-team | edge-room | OK | 851 | 144 |  |
| OLD vs NEW | compute-state | edge-room | OK | 2451 | 264 |  |
| OLD vs NEW | analyze-room | edge-room | OK | 2968 | 84 |  |
| OLD vs NEW | compute-state | edge-room[mtime-equal] | OK | 2399 | 272 |  |
| OLD vs NEW | compute-state | edge-room[no-registry] | OK | 2438 | 280 |  |
| OLD vs NEW | compute-team | hostile-room | OK | 234 | 60 |  |
| OLD vs NEW | compute-state | hostile-room | OK | 1058 | 137 |  |
| OLD vs NEW | analyze-room | hostile-room | OK | 708 | 80 |  |
| OLD vs NEW | compute-team | bad-stage-room | OK | 2 | 30 |  |
| OLD vs NEW | compute-state | bad-stage-room | OK | 303 | 102 |  |
| OLD vs NEW | analyze-room | bad-stage-room | OK | 10 | 38 |  |
| OLD vs NEW | compute-team | empty-room | OK | 3 | 33 |  |
| OLD vs NEW | compute-state | empty-room | OK | 89 | 122 |  |
| OLD vs NEW | analyze-room | empty-room | OK | 13 | 58 |  |
| OLD vs NEW | compute-team | team-no-profiles | OK | 6 | 39 |  |
| OLD vs NEW | compute-state | team-no-profiles | OK | 334 | 97 |  |
| OLD vs NEW | analyze-room | team-no-profiles | OK | 61 | 40 |  |
| OLD vs NEW | compute-team | missing-room | OK | 3 | 30 |  |
| OLD vs NEW | compute-state | missing-room | OK | 2 | 35 |  |
| OLD vs NEW | analyze-room | missing-room | OK | 5 | 35 |  |
| OLD vs NEW | compute-team | sample-room | OK | 2 | 32 |  |
| OLD vs NEW | compute-state | sample-room | OK | 413 | 98 |  |
| OLD vs NEW | analyze-room | sample-room | OK | 247 | 43 |  |
| OLD vs NEW | compute-team | sample-room-opp | OK | 3 | 31 |  |
| OLD vs NEW | compute-state | sample-room-opp | OK | 354 | 98 |  |
| OLD vs NEW | analyze-room | sample-room-opp | OK | 171 | 46 |  |
| OLD vs NEW | compute-team | sample-room-personas | OK | 3 | 32 |  |
| OLD vs NEW | compute-state | sample-room-personas | OK | 413 | 95 |  |
| OLD vs NEW | analyze-room | sample-room-personas | OK | 448 | 47 |  |
| OLD vs NEW | compute-team | test-room-causal | OK | 3 | 31 |  |
| OLD vs NEW | compute-state | test-room-causal | OK | 275 | 96 |  |
| OLD vs NEW | analyze-room | test-room-causal | OK | 54 | 43 |  |
| OLD vs NEW | compute-team | test-room-graph | OK | 2 | 49 |  |
| OLD vs NEW | compute-state | test-room-graph | OK | 374 | 103 |  |
| OLD vs NEW | analyze-room | test-room-graph | OK | 535 | 54 |  |
| OLD vs NEW | compute-team | test-room-meeting | OK | 9 | 39 |  |
| OLD vs NEW | compute-state | test-room-meeting | OK | 402 | 120 |  |
| OLD vs NEW | analyze-room | test-room-meeting | OK | 173 | 60 |  |
| OLD vs NEW | compute-team | test-room-reasoning | OK | 8 | 37 |  |
| OLD vs NEW | compute-state | test-room-reasoning | OK | 336 | 105 |  |
| OLD vs NEW | analyze-room | test-room-reasoning | OK | 98 | 45 |  |
| OLD vs NEW | compute-team | test-room-visual | OK | 10 | 39 |  |
| OLD vs NEW | compute-state | test-room-visual | OK | 98 | 99 |  |
| OLD vs NEW | analyze-room | test-room-visual | OK | 21 | 44 |  |
| OLD vs NEW | compute-team | wiki-room-232 | OK | 8 | 41 |  |
| OLD vs NEW | compute-state | wiki-room-232 | OK | 349 | 101 |  |
| OLD vs NEW | analyze-room | wiki-room-232 | OK | 100 | 46 |  |
| OLD vs NEW | compute-team | icm-rooms/alpha-room | OK | 8 | 44 |  |
| OLD vs NEW | compute-state | icm-rooms/alpha-room | OK | 437 | 102 |  |
| OLD vs NEW | analyze-room | icm-rooms/alpha-room | OK | 156 | 48 |  |
| OLD vs NEW | compute-team | 272/room | OK | 8 | 39 |  |
| OLD vs NEW | compute-state | 272/room | OK | 753 | 122 |  |
| OLD vs NEW | analyze-room | 272/room | OK | 3991 | 73 |  |
| OLD vs NEW | compute-team | 195-nested-room-tree/root-room | OK | 9 | 44 |  |
| OLD vs NEW | compute-state | 195-nested-room-tree/root-room | OK | 325 | 108 |  |
| OLD vs NEW | analyze-room | 195-nested-room-tree/root-room | OK | 171 | 53 |  |
| OLD vs NEW | compute-team | release-room | OK | 10 | 40 |  |
| OLD vs NEW | compute-state | release-room | OK | 293 | 98 |  |
| OLD vs NEW | analyze-room | release-room | OK | 24 | 44 |  |
| OLD vs NEW | compute-team | futures-seed-room | OK | 9 | 39 |  |
| OLD vs NEW | compute-state | futures-seed-room | OK | 86 | 104 |  |
| OLD vs NEW | analyze-room | futures-seed-room | OK | 17 | 46 |  |
| OLD vs NEW | compute-team | graph-export-golden-room | OK | 9 | 42 |  |
| OLD vs NEW | compute-state | graph-export-golden-room | OK | 93 | 100 |  |
| OLD vs NEW | analyze-room | graph-export-golden-room | OK | 18 | 49 |  |
| OLD vs NEW | compute-team | never-ready-room | OK | 10 | 38 |  |
| OLD vs NEW | compute-state | never-ready-room | OK | 87 | 95 |  |
| OLD vs NEW | analyze-room | never-ready-room | OK | 17 | 45 |  |

### Run (b) report

BASE_SHA: 65aaf329f9c514c71fff2f1a530cd366c0b87b66

parity: 0 diffs in 68 pairs

| suite | script | room | result | OLD ms | NEW ms | first diff |
|---|---|---|---|---|---|---|
| OLD vs NEW | compute-team | edge-room | OK | 787 | 148 |  |
| OLD vs NEW | compute-state | edge-room | OK | 2290 | 259 |  |
| OLD vs NEW | analyze-room | edge-room | OK | 2926 | 86 |  |
| OLD vs NEW | compute-state | edge-room[mtime-equal] | OK | 2349 | 268 |  |
| OLD vs NEW | compute-state | edge-room[no-registry] | OK | 2262 | 256 |  |
| OLD vs NEW | compute-team | hostile-room | OK | 218 | 58 |  |
| OLD vs NEW | compute-state | hostile-room | OK | 926 | 130 |  |
| OLD vs NEW | analyze-room | hostile-room | OK | 700 | 72 |  |
| OLD vs NEW | compute-team | bad-stage-room | OK | 2 | 34 |  |
| OLD vs NEW | compute-state | bad-stage-room | OK | 278 | 96 |  |
| OLD vs NEW | analyze-room | bad-stage-room | OK | 10 | 40 |  |
| OLD vs NEW | compute-team | empty-room | OK | 2 | 32 |  |
| OLD vs NEW | compute-state | empty-room | OK | 77 | 89 |  |
| OLD vs NEW | analyze-room | empty-room | OK | 12 | 38 |  |
| OLD vs NEW | compute-team | team-no-profiles | OK | 5 | 33 |  |
| OLD vs NEW | compute-state | team-no-profiles | OK | 322 | 95 |  |
| OLD vs NEW | analyze-room | team-no-profiles | OK | 50 | 41 |  |
| OLD vs NEW | compute-team | missing-room | OK | 2 | 32 |  |
| OLD vs NEW | compute-state | missing-room | OK | 3 | 35 |  |
| OLD vs NEW | analyze-room | missing-room | OK | 4 | 31 |  |
| OLD vs NEW | compute-team | sample-room | OK | 2 | 33 |  |
| OLD vs NEW | compute-state | sample-room | OK | 399 | 106 |  |
| OLD vs NEW | analyze-room | sample-room | OK | 222 | 43 |  |
| OLD vs NEW | compute-team | sample-room-opp | OK | 2 | 32 |  |
| OLD vs NEW | compute-state | sample-room-opp | OK | 366 | 95 |  |
| OLD vs NEW | analyze-room | sample-room-opp | OK | 160 | 48 |  |
| OLD vs NEW | compute-team | sample-room-personas | OK | 3 | 35 |  |
| OLD vs NEW | compute-state | sample-room-personas | OK | 417 | 95 |  |
| OLD vs NEW | analyze-room | sample-room-personas | OK | 461 | 47 |  |
| OLD vs NEW | compute-team | test-room-causal | OK | 3 | 34 |  |
| OLD vs NEW | compute-state | test-room-causal | OK | 287 | 91 |  |
| OLD vs NEW | analyze-room | test-room-causal | OK | 49 | 44 |  |
| OLD vs NEW | compute-team | test-room-graph | OK | 3 | 36 |  |
| OLD vs NEW | compute-state | test-room-graph | OK | 366 | 99 |  |
| OLD vs NEW | analyze-room | test-room-graph | OK | 519 | 50 |  |
| OLD vs NEW | compute-team | test-room-meeting | OK | 10 | 39 |  |
| OLD vs NEW | compute-state | test-room-meeting | OK | 384 | 118 |  |
| OLD vs NEW | analyze-room | test-room-meeting | OK | 163 | 52 |  |
| OLD vs NEW | compute-team | test-room-reasoning | OK | 10 | 37 |  |
| OLD vs NEW | compute-state | test-room-reasoning | OK | 316 | 101 |  |
| OLD vs NEW | analyze-room | test-room-reasoning | OK | 104 | 48 |  |
| OLD vs NEW | compute-team | test-room-visual | OK | 9 | 39 |  |
| OLD vs NEW | compute-state | test-room-visual | OK | 88 | 99 |  |
| OLD vs NEW | analyze-room | test-room-visual | OK | 22 | 46 |  |
| OLD vs NEW | compute-team | wiki-room-232 | OK | 10 | 39 |  |
| OLD vs NEW | compute-state | wiki-room-232 | OK | 309 | 96 |  |
| OLD vs NEW | analyze-room | wiki-room-232 | OK | 115 | 47 |  |
| OLD vs NEW | compute-team | icm-rooms/alpha-room | OK | 9 | 39 |  |
| OLD vs NEW | compute-state | icm-rooms/alpha-room | OK | 420 | 101 |  |
| OLD vs NEW | analyze-room | icm-rooms/alpha-room | OK | 151 | 51 |  |
| OLD vs NEW | compute-team | 272/room | OK | 9 | 39 |  |
| OLD vs NEW | compute-state | 272/room | OK | 689 | 125 |  |
| OLD vs NEW | analyze-room | 272/room | OK | 3686 | 69 |  |
| OLD vs NEW | compute-team | 195-nested-room-tree/root-room | OK | 8 | 40 |  |
| OLD vs NEW | compute-state | 195-nested-room-tree/root-room | OK | 284 | 101 |  |
| OLD vs NEW | analyze-room | 195-nested-room-tree/root-room | OK | 163 | 48 |  |
| OLD vs NEW | compute-team | release-room | OK | 9 | 45 |  |
| OLD vs NEW | compute-state | release-room | OK | 282 | 98 |  |
| OLD vs NEW | analyze-room | release-room | OK | 21 | 41 |  |
| OLD vs NEW | compute-team | futures-seed-room | OK | 8 | 37 |  |
| OLD vs NEW | compute-state | futures-seed-room | OK | 87 | 98 |  |
| OLD vs NEW | analyze-room | futures-seed-room | OK | 17 | 42 |  |
| OLD vs NEW | compute-team | graph-export-golden-room | OK | 10 | 39 |  |
| OLD vs NEW | compute-state | graph-export-golden-room | OK | 85 | 98 |  |
| OLD vs NEW | analyze-room | graph-export-golden-room | OK | 16 | 39 |  |
| OLD vs NEW | compute-team | never-ready-room | OK | 9 | 38 |  |
| OLD vs NEW | compute-state | never-ready-room | OK | 92 | 100 |  |
| OLD vs NEW | analyze-room | never-ready-room | OK | 17 | 42 |  |

### Run (c) report

BASE_SHA: 65aaf329f9c514c71fff2f1a530cd366c0b87b66

parity: 0 diffs in 68 pairs

| suite | script | room | result | OLD ms | NEW ms | first diff |
|---|---|---|---|---|---|---|
| OLD vs NEW | compute-team | edge-room | OK | 846 | 814 |  |
| OLD vs NEW | compute-state | edge-room | OK | 2185 | 2184 |  |
| OLD vs NEW | analyze-room | edge-room | OK | 2707 | 2779 |  |
| OLD vs NEW | compute-state | edge-room[mtime-equal] | OK | 2252 | 2261 |  |
| OLD vs NEW | compute-state | edge-room[no-registry] | OK | 2226 | 2216 |  |
| OLD vs NEW | compute-team | hostile-room | OK | 226 | 226 |  |
| OLD vs NEW | compute-state | hostile-room | OK | 921 | 937 |  |
| OLD vs NEW | analyze-room | hostile-room | OK | 683 | 704 |  |
| OLD vs NEW | compute-team | bad-stage-room | OK | 3 | 2 |  |
| OLD vs NEW | compute-state | bad-stage-room | OK | 280 | 287 |  |
| OLD vs NEW | analyze-room | bad-stage-room | OK | 10 | 9 |  |
| OLD vs NEW | compute-team | empty-room | OK | 3 | 3 |  |
| OLD vs NEW | compute-state | empty-room | OK | 82 | 82 |  |
| OLD vs NEW | analyze-room | empty-room | OK | 11 | 10 |  |
| OLD vs NEW | compute-team | team-no-profiles | OK | 5 | 6 |  |
| OLD vs NEW | compute-state | team-no-profiles | OK | 325 | 322 |  |
| OLD vs NEW | analyze-room | team-no-profiles | OK | 50 | 51 |  |
| OLD vs NEW | compute-team | missing-room | OK | 3 | 2 |  |
| OLD vs NEW | compute-state | missing-room | OK | 2 | 3 |  |
| OLD vs NEW | analyze-room | missing-room | OK | 4 | 4 |  |
| OLD vs NEW | compute-team | sample-room | OK | 3 | 3 |  |
| OLD vs NEW | compute-state | sample-room | OK | 399 | 402 |  |
| OLD vs NEW | analyze-room | sample-room | OK | 230 | 231 |  |
| OLD vs NEW | compute-team | sample-room-opp | OK | 2 | 2 |  |
| OLD vs NEW | compute-state | sample-room-opp | OK | 356 | 369 |  |
| OLD vs NEW | analyze-room | sample-room-opp | OK | 177 | 165 |  |
| OLD vs NEW | compute-team | sample-room-personas | OK | 2 | 2 |  |
| OLD vs NEW | compute-state | sample-room-personas | OK | 430 | 418 |  |
| OLD vs NEW | analyze-room | sample-room-personas | OK | 468 | 457 |  |
| OLD vs NEW | compute-team | test-room-causal | OK | 2 | 2 |  |
| OLD vs NEW | compute-state | test-room-causal | OK | 275 | 292 |  |
| OLD vs NEW | analyze-room | test-room-causal | OK | 52 | 51 |  |
| OLD vs NEW | compute-team | test-room-graph | OK | 2 | 6 |  |
| OLD vs NEW | compute-state | test-room-graph | OK | 369 | 396 |  |
| OLD vs NEW | analyze-room | test-room-graph | OK | 526 | 513 |  |
| OLD vs NEW | compute-team | test-room-meeting | OK | 10 | 9 |  |
| OLD vs NEW | compute-state | test-room-meeting | OK | 384 | 393 |  |
| OLD vs NEW | analyze-room | test-room-meeting | OK | 164 | 183 |  |
| OLD vs NEW | compute-team | test-room-reasoning | OK | 7 | 9 |  |
| OLD vs NEW | compute-state | test-room-reasoning | OK | 324 | 328 |  |
| OLD vs NEW | analyze-room | test-room-reasoning | OK | 97 | 98 |  |
| OLD vs NEW | compute-team | test-room-visual | OK | 8 | 8 |  |
| OLD vs NEW | compute-state | test-room-visual | OK | 85 | 83 |  |
| OLD vs NEW | analyze-room | test-room-visual | OK | 24 | 23 |  |
| OLD vs NEW | compute-team | wiki-room-232 | OK | 9 | 9 |  |
| OLD vs NEW | compute-state | wiki-room-232 | OK | 324 | 319 |  |
| OLD vs NEW | analyze-room | wiki-room-232 | OK | 100 | 99 |  |
| OLD vs NEW | compute-team | icm-rooms/alpha-room | OK | 9 | 9 |  |
| OLD vs NEW | compute-state | icm-rooms/alpha-room | OK | 417 | 427 |  |
| OLD vs NEW | analyze-room | icm-rooms/alpha-room | OK | 159 | 150 |  |
| OLD vs NEW | compute-team | 272/room | OK | 7 | 8 |  |
| OLD vs NEW | compute-state | 272/room | OK | 704 | 701 |  |
| OLD vs NEW | analyze-room | 272/room | OK | 3729 | 3853 |  |
| OLD vs NEW | compute-team | 195-nested-room-tree/root-room | OK | 10 | 9 |  |
| OLD vs NEW | compute-state | 195-nested-room-tree/root-room | OK | 283 | 285 |  |
| OLD vs NEW | analyze-room | 195-nested-room-tree/root-room | OK | 160 | 159 |  |
| OLD vs NEW | compute-team | release-room | OK | 13 | 8 |  |
| OLD vs NEW | compute-state | release-room | OK | 282 | 282 |  |
| OLD vs NEW | analyze-room | release-room | OK | 19 | 20 |  |
| OLD vs NEW | compute-team | futures-seed-room | OK | 8 | 10 |  |
| OLD vs NEW | compute-state | futures-seed-room | OK | 88 | 85 |  |
| OLD vs NEW | analyze-room | futures-seed-room | OK | 18 | 17 |  |
| OLD vs NEW | compute-team | graph-export-golden-room | OK | 8 | 11 |  |
| OLD vs NEW | compute-state | graph-export-golden-room | OK | 91 | 85 |  |
| OLD vs NEW | analyze-room | graph-export-golden-room | OK | 17 | 18 |  |
| OLD vs NEW | compute-team | never-ready-room | OK | 10 | 8 |  |
| OLD vs NEW | compute-state | never-ready-room | OK | 86 | 90 |  |
| OLD vs NEW | analyze-room | never-ready-room | OK | 19 | 17 |  |

### Run (d) report

BASE_SHA: 65aaf329f9c514c71fff2f1a530cd366c0b87b66

parity: 0 diffs in 71 pairs

| suite | script | room | result | OLD ms | NEW ms | first diff |
|---|---|---|---|---|---|---|
| OLD vs NEW | compute-team | edge-room | OK | 856 | 160 |  |
| OLD vs NEW | compute-state | edge-room | OK | 2216 | 248 |  |
| OLD vs NEW | analyze-room | edge-room | OK | 2817 | 83 |  |
| OLD vs NEW | compute-state | edge-room[mtime-equal] | OK | 2252 | 246 |  |
| OLD vs NEW | compute-state | edge-room[no-registry] | OK | 2249 | 252 |  |
| OLD vs NEW | compute-team | hostile-room | OK | 245 | 55 |  |
| OLD vs NEW | compute-state | hostile-room | OK | 946 | 127 |  |
| OLD vs NEW | analyze-room | hostile-room | OK | 698 | 84 |  |
| OLD vs NEW | compute-team | bad-stage-room | OK | 2 | 35 |  |
| OLD vs NEW | compute-state | bad-stage-room | OK | 286 | 96 |  |
| OLD vs NEW | analyze-room | bad-stage-room | OK | 11 | 36 |  |
| OLD vs NEW | compute-team | empty-room | OK | 2 | 33 |  |
| OLD vs NEW | compute-state | empty-room | OK | 80 | 89 |  |
| OLD vs NEW | analyze-room | empty-room | OK | 12 | 38 |  |
| OLD vs NEW | compute-team | team-no-profiles | OK | 5 | 36 |  |
| OLD vs NEW | compute-state | team-no-profiles | OK | 313 | 95 |  |
| OLD vs NEW | analyze-room | team-no-profiles | OK | 50 | 42 |  |
| OLD vs NEW | compute-team | missing-room | OK | 5 | 31 |  |
| OLD vs NEW | compute-state | missing-room | OK | 3 | 32 |  |
| OLD vs NEW | analyze-room | missing-room | OK | 5 | 32 |  |
| OLD vs NEW | compute-team | sample-room | OK | 2 | 31 |  |
| OLD vs NEW | compute-state | sample-room | OK | 392 | 93 |  |
| OLD vs NEW | analyze-room | sample-room | OK | 248 | 41 |  |
| OLD vs NEW | compute-team | sample-room-opp | OK | 2 | 34 |  |
| OLD vs NEW | compute-state | sample-room-opp | OK | 357 | 93 |  |
| OLD vs NEW | analyze-room | sample-room-opp | OK | 171 | 47 |  |
| OLD vs NEW | compute-team | sample-room-personas | OK | 2 | 32 |  |
| OLD vs NEW | compute-state | sample-room-personas | OK | 418 | 101 |  |
| OLD vs NEW | analyze-room | sample-room-personas | OK | 443 | 45 |  |
| OLD vs NEW | compute-team | test-room-causal | OK | 3 | 31 |  |
| OLD vs NEW | compute-state | test-room-causal | OK | 280 | 97 |  |
| OLD vs NEW | analyze-room | test-room-causal | OK | 49 | 40 |  |
| OLD vs NEW | compute-team | test-room-graph | OK | 3 | 34 |  |
| OLD vs NEW | compute-state | test-room-graph | OK | 369 | 101 |  |
| OLD vs NEW | analyze-room | test-room-graph | OK | 509 | 50 |  |
| OLD vs NEW | compute-team | test-room-meeting | OK | 6 | 35 |  |
| OLD vs NEW | compute-state | test-room-meeting | OK | 378 | 114 |  |
| OLD vs NEW | analyze-room | test-room-meeting | OK | 164 | 45 |  |
| OLD vs NEW | compute-team | test-room-reasoning | OK | 6 | 33 |  |
| OLD vs NEW | compute-state | test-room-reasoning | OK | 317 | 96 |  |
| OLD vs NEW | analyze-room | test-room-reasoning | OK | 92 | 47 |  |
| OLD vs NEW | compute-team | test-room-visual | OK | 5 | 35 |  |
| OLD vs NEW | compute-state | test-room-visual | OK | 87 | 96 |  |
| OLD vs NEW | analyze-room | test-room-visual | OK | 18 | 40 |  |
| OLD vs NEW | compute-team | wiki-room-232 | OK | 6 | 34 |  |
| OLD vs NEW | compute-state | wiki-room-232 | OK | 323 | 95 |  |
| OLD vs NEW | analyze-room | wiki-room-232 | OK | 95 | 44 |  |
| OLD vs NEW | compute-team | icm-rooms/alpha-room | OK | 6 | 33 |  |
| OLD vs NEW | compute-state | icm-rooms/alpha-room | OK | 412 | 97 |  |
| OLD vs NEW | analyze-room | icm-rooms/alpha-room | OK | 153 | 47 |  |
| OLD vs NEW | compute-team | 272/room | OK | 5 | 34 |  |
| OLD vs NEW | compute-state | 272/room | OK | 711 | 119 |  |
| OLD vs NEW | analyze-room | 272/room | OK | 3782 | 74 |  |
| OLD vs NEW | compute-team | 195-nested-room-tree/root-room | OK | 6 | 36 |  |
| OLD vs NEW | compute-state | 195-nested-room-tree/root-room | OK | 292 | 98 |  |
| OLD vs NEW | analyze-room | 195-nested-room-tree/root-room | OK | 160 | 43 |  |
| OLD vs NEW | compute-team | release-room | OK | 5 | 38 |  |
| OLD vs NEW | compute-state | release-room | OK | 278 | 98 |  |
| OLD vs NEW | analyze-room | release-room | OK | 18 | 40 |  |
| OLD vs NEW | compute-team | futures-seed-room | OK | 5 | 35 |  |
| OLD vs NEW | compute-state | futures-seed-room | OK | 81 | 97 |  |
| OLD vs NEW | analyze-room | futures-seed-room | OK | 17 | 44 |  |
| OLD vs NEW | compute-team | graph-export-golden-room | OK | 5 | 36 |  |
| OLD vs NEW | compute-state | graph-export-golden-room | OK | 81 | 92 |  |
| OLD vs NEW | analyze-room | graph-export-golden-room | OK | 14 | 39 |  |
| OLD vs NEW | compute-team | never-ready-room | OK | 5 | 36 |  |
| OLD vs NEW | compute-state | never-ready-room | OK | 83 | 96 |  |
| OLD vs NEW | analyze-room | never-ready-room | OK | 15 | 39 |  |
| OLD vs NEW | compute-team | room-copy:room-snap | OK | 925 | 71 |  |
| OLD vs NEW | compute-state | room-copy:room-snap | OK | 2484 | 255 |  |
| OLD vs NEW | analyze-room | room-copy:room-snap | OK | 7516 | 104 |  |

### Run (e) report

BASE_SHA: 65aaf329f9c514c71fff2f1a530cd366c0b87b66

parity: 0 diffs in 71 pairs

| suite | script | room | result | OLD ms | NEW ms | first diff |
|---|---|---|---|---|---|---|
| determinism (OLD vs OLD) | compute-team | edge-room | OK | 814 | 802 |  |
| determinism (OLD vs OLD) | compute-state | edge-room | OK | 2242 | 2267 |  |
| determinism (OLD vs OLD) | analyze-room | edge-room | OK | 2830 | 2827 |  |
| determinism (OLD vs OLD) | compute-state | edge-room[mtime-equal] | OK | 2219 | 2269 |  |
| determinism (OLD vs OLD) | compute-state | edge-room[no-registry] | OK | 2240 | 2215 |  |
| determinism (OLD vs OLD) | compute-team | hostile-room | OK | 225 | 231 |  |
| determinism (OLD vs OLD) | compute-state | hostile-room | OK | 926 | 906 |  |
| determinism (OLD vs OLD) | analyze-room | hostile-room | OK | 702 | 692 |  |
| determinism (OLD vs OLD) | compute-team | bad-stage-room | OK | 2 | 2 |  |
| determinism (OLD vs OLD) | compute-state | bad-stage-room | OK | 283 | 276 |  |
| determinism (OLD vs OLD) | analyze-room | bad-stage-room | OK | 10 | 10 |  |
| determinism (OLD vs OLD) | compute-team | empty-room | OK | 2 | 3 |  |
| determinism (OLD vs OLD) | compute-state | empty-room | OK | 78 | 79 |  |
| determinism (OLD vs OLD) | analyze-room | empty-room | OK | 11 | 13 |  |
| determinism (OLD vs OLD) | compute-team | team-no-profiles | OK | 5 | 5 |  |
| determinism (OLD vs OLD) | compute-state | team-no-profiles | OK | 335 | 316 |  |
| determinism (OLD vs OLD) | analyze-room | team-no-profiles | OK | 50 | 53 |  |
| determinism (OLD vs OLD) | compute-team | missing-room | OK | 3 | 3 |  |
| determinism (OLD vs OLD) | compute-state | missing-room | OK | 2 | 3 |  |
| determinism (OLD vs OLD) | analyze-room | missing-room | OK | 5 | 5 |  |
| determinism (OLD vs OLD) | compute-team | sample-room | OK | 2 | 2 |  |
| determinism (OLD vs OLD) | compute-state | sample-room | OK | 415 | 400 |  |
| determinism (OLD vs OLD) | analyze-room | sample-room | OK | 230 | 235 |  |
| determinism (OLD vs OLD) | compute-team | sample-room-opp | OK | 2 | 2 |  |
| determinism (OLD vs OLD) | compute-state | sample-room-opp | OK | 358 | 364 |  |
| determinism (OLD vs OLD) | analyze-room | sample-room-opp | OK | 176 | 170 |  |
| determinism (OLD vs OLD) | compute-team | sample-room-personas | OK | 2 | 3 |  |
| determinism (OLD vs OLD) | compute-state | sample-room-personas | OK | 415 | 410 |  |
| determinism (OLD vs OLD) | analyze-room | sample-room-personas | OK | 472 | 450 |  |
| determinism (OLD vs OLD) | compute-team | test-room-causal | OK | 2 | 3 |  |
| determinism (OLD vs OLD) | compute-state | test-room-causal | OK | 278 | 275 |  |
| determinism (OLD vs OLD) | analyze-room | test-room-causal | OK | 52 | 49 |  |
| determinism (OLD vs OLD) | compute-team | test-room-graph | OK | 2 | 5 |  |
| determinism (OLD vs OLD) | compute-state | test-room-graph | OK | 358 | 361 |  |
| determinism (OLD vs OLD) | analyze-room | test-room-graph | OK | 534 | 530 |  |
| determinism (OLD vs OLD) | compute-team | test-room-meeting | OK | 6 | 5 |  |
| determinism (OLD vs OLD) | compute-state | test-room-meeting | OK | 374 | 380 |  |
| determinism (OLD vs OLD) | analyze-room | test-room-meeting | OK | 157 | 158 |  |
| determinism (OLD vs OLD) | compute-team | test-room-reasoning | OK | 6 | 6 |  |
| determinism (OLD vs OLD) | compute-state | test-room-reasoning | OK | 312 | 332 |  |
| determinism (OLD vs OLD) | analyze-room | test-room-reasoning | OK | 94 | 96 |  |
| determinism (OLD vs OLD) | compute-team | test-room-visual | OK | 6 | 5 |  |
| determinism (OLD vs OLD) | compute-state | test-room-visual | OK | 83 | 97 |  |
| determinism (OLD vs OLD) | analyze-room | test-room-visual | OK | 22 | 19 |  |
| determinism (OLD vs OLD) | compute-team | wiki-room-232 | OK | 6 | 5 |  |
| determinism (OLD vs OLD) | compute-state | wiki-room-232 | OK | 323 | 315 |  |
| determinism (OLD vs OLD) | analyze-room | wiki-room-232 | OK | 95 | 100 |  |
| determinism (OLD vs OLD) | compute-team | icm-rooms/alpha-room | OK | 7 | 5 |  |
| determinism (OLD vs OLD) | compute-state | icm-rooms/alpha-room | OK | 426 | 422 |  |
| determinism (OLD vs OLD) | analyze-room | icm-rooms/alpha-room | OK | 155 | 150 |  |
| determinism (OLD vs OLD) | compute-team | 272/room | OK | 6 | 6 |  |
| determinism (OLD vs OLD) | compute-state | 272/room | OK | 689 | 681 |  |
| determinism (OLD vs OLD) | analyze-room | 272/room | OK | 3700 | 3836 |  |
| determinism (OLD vs OLD) | compute-team | 195-nested-room-tree/root-room | OK | 6 | 6 |  |
| determinism (OLD vs OLD) | compute-state | 195-nested-room-tree/root-room | OK | 280 | 289 |  |
| determinism (OLD vs OLD) | analyze-room | 195-nested-room-tree/root-room | OK | 158 | 159 |  |
| determinism (OLD vs OLD) | compute-team | release-room | OK | 5 | 7 |  |
| determinism (OLD vs OLD) | compute-state | release-room | OK | 285 | 282 |  |
| determinism (OLD vs OLD) | analyze-room | release-room | OK | 17 | 16 |  |
| determinism (OLD vs OLD) | compute-team | futures-seed-room | OK | 5 | 6 |  |
| determinism (OLD vs OLD) | compute-state | futures-seed-room | OK | 83 | 83 |  |
| determinism (OLD vs OLD) | analyze-room | futures-seed-room | OK | 15 | 14 |  |
| determinism (OLD vs OLD) | compute-team | graph-export-golden-room | OK | 6 | 7 |  |
| determinism (OLD vs OLD) | compute-state | graph-export-golden-room | OK | 80 | 82 |  |
| determinism (OLD vs OLD) | analyze-room | graph-export-golden-room | OK | 15 | 14 |  |
| determinism (OLD vs OLD) | compute-team | never-ready-room | OK | 7 | 5 |  |
| determinism (OLD vs OLD) | compute-state | never-ready-room | OK | 81 | 84 |  |
| determinism (OLD vs OLD) | analyze-room | never-ready-room | OK | 13 | 13 |  |
| determinism (OLD vs OLD) | compute-team | room-copy:room-snap | OK | 922 | 918 |  |
| determinism (OLD vs OLD) | compute-state | room-copy:room-snap | OK | 2456 | 2498 |  |
| determinism (OLD vs OLD) | analyze-room | room-copy:room-snap | OK | 7434 | 7614 |  |
