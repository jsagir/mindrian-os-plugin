---
phase: 381-room-scan-once-render-three-times-node-renderers-behind-comp
plan: 01
subsystem: testing
tags: [parity-gate, oracle, git-archive, fixtures, bash-compat]
requires:
  - phase: 381-context
    provides: rulings 2, 3, 9 (divergences, locale contract, oracle at BASE_SHA)
provides:
  - BASE_SHA constant and OLD oracle (git archive) for every later 381 plan
  - Parity CLI tests/test-381-parity.cjs with proven determinism and a proven ability to fail
  - Edge, hostile, bad-stage, small and divergence room builders
  - Net guard preload and the phase runner tests/run-all-381.sh
affects: [381-02, 381-03, 381-04, 381-05, 381-06, 381-07, 381-08, 381-09]
tech-stack:
  added: []
  patterns: [OLD tree from git archive, fresh cp -a copy per run, clean env with net guard preload]
key-files:
  created:
    - tests/fixtures/room-381/build-fixture.cjs
    - tests/helpers/oracle-381.cjs
    - tests/helpers/net-guard-381.cjs
    - tests/test-381-parity.cjs
    - tests/run-all-381.sh
  modified: []
key-decisions:
  - "Both sides of a pair run on the same absolute room path (copy, run, digest, delete, then the other side), so a path in stdout cannot cause a false diff."
  - "Extra compute-state pairs on the edge room: mtime equal and no registry file."
patterns-established:
  - "comparePair: stdout, exit code, post-run tree digest, empty-cwd marker check, net-guard log"
requirements-completed: [PERF381-01, PERF381-05]
duration: ~1h
completed: 2026-10-29
---

# Phase 381 Plan 01: Parity gate before any renderer exists Summary

OLD vs NEW parity harness built on `git archive` of BASE_SHA; OLD is deterministic and the HEAD scripts equal OLD on all 68 gate pairs, and the harness is proven able to fail.

## Gate (Task 1, Step 0)

- Quick SUMMARYs present: `261029-s9x` and `261029-sc6`. PROVEN.
- sc6 sha `4f470032b` is an ancestor of HEAD. PROVEN (exit 0).
- `5a2dcfd4d` (u8x hotfix docs commit) is an ancestor of HEAD. PROVEN (exit 0).
- `grep -nF "strptime('$datestr'" scripts/compute-team scripts/analyze-room` printed nothing. PROVEN.
- **BASE_SHA = 65aaf329f9c514c71fff2f1a530cd366c0b87b66** (HEAD after "docs(381): mark Phase 381 execution started"). Written in `tests/helpers/oracle-381.cjs`.

## Commits

- `c50a44fa5` test(381-01): room builders and BASE_SHA
- `59cf68000` test(381-01): OLD oracle, net guard, parity harness, runner

## What was built

- `tests/fixtures/room-381/build-fixture.cjs`: `buildEdgeRoom`, `buildHostileRoom` (the u8x payloads copied from the two hotfix tests, markers listed), `buildBadStageRoom`, `buildSmallRooms`, `buildDivergenceRoom` (cases: sigpipe-large-file, invalid-utf8, nul-byte, macos-python-path), `assertSafeTarget` (refuses forbiddenRoots and any MindrianRooms path segment). CLI arm for each mode.
- `tests/helpers/oracle-381.cjs`: `BASE_SHA`, `buildOldTree`, `cleanEnv` (LC_ALL=C.UTF-8, pinned TZ, net guard in NODE_OPTIONS), `copyRoom`, `pinMtimes`, `writeRegistry`, `runScript`, `normalizeText`, `treeDigest`, `comparePair`, `gatePrecondition`. Read-only git use only (`git archive`).
- `tests/helpers/net-guard-381.cjs`: blocks and logs net, tls, http, https, dns and fetch.
- `tests/test-381-parity.cjs`: all flags of the plan (`--self-check`, `--prove-fail`, `--new-tree`, `--determinism`, `--only`, `--room`, `--fixtures-only`, `--direct`, `--until`, `--no-tree`, `--legacy-switch`, `--tz`, `--mtime`, `--report`, `--keep`).
- `tests/run-all-381.sh`: glob discovery with found-eq-0 guard, Part 8 sweep, dash sweep.

## Self-check (saved at the scratchpad, run once, not rerun)

- `node tests/test-381-parity.cjs --self-check` exit 0, wall time 1m50s.
- `determinism (OLD vs OLD): 0 diffs in 68 pairs`
- `OLD vs HEAD scripts: 0 diffs in 68 pairs`
- `PROVE-FAIL OK (expected DIFF: stdout differs at line 92 (OLD 93 lines, NEW 93 lines))` (one byte changed in `echo "## End"` of an OLD copy, analyze-room on the edge room)
- Last line: `parity: 0 diffs in 136 pairs`
- Pair set: 6 generated rooms (edge, hostile, bad-stage, empty, team-no-profiles, missing) plus 16 repository fixtures = 22 rooms x 3 scripts = 66, plus 2 extra edge compute-state pairs (mtime equal, no registry) = 68 per suite.
- NOTE lines: `NOTE graph-export-golden-room carries invalid UTF-8 or NUL: .mindrian/room.db (ruling 2 divergence)` (binary room.db inside a hidden dir; the pair still gates and diffs to zero).
- Fixtures dropped for OLD nondeterminism: none. No fixture was missing.

## Acceptance results

- `--direct` prints `SKIP direct: lib/core/room-render.cjs absent`, exit 0.
- `bash tests/run-all-381.sh` exit 0: `Phase 381: PASS=3 FAIL=0 SKIP=0`; prints `SKIP lib/core/room-scan.cjs (not built yet)` and the other four lib modules.
- oracle-381.cjs: `'archive'` count 1; no `'add'|'commit'|'checkout'|'reset'|'worktree'|'stash'|'push'` string; `LC_ALL` count 2; `net-guard-381.cjs` count 2.
- Dash check (U+2014, U+2013): 0 in all five new files.
- Net guard check prints `blocked` and logs `http.get`.
- Builders: all five modes exit 0; assertSafeTarget refused `/mnt/c/Users/x/MindrianRooms/r` and `$HOME/MindrianRooms/r`, accepted `/tmp/x`.
- Builder greps: both payload source files named (1 each); `import os; os.system` count 0; `Math.random` count 0 in code lines.
- Marker check: no run left a file in its cwd, including the hostile room (OLD and NEW).

## Deviations from Plan

None that change behavior. Additions inside the plan's intent:

1. The builder silences the node:sqlite ExperimentalWarning while it loads room-birth (stderr noise only).
2. `comparePair` removes its temp dirs unless `--keep`; `oracle.setKeep` and `mkTmp` and `cleanupTmp` are extra exports.

## Known Stubs

None.

## Threat Flags

None. All runs use copies under os.tmpdir(); no source room is written.

## Self-Check: PASSED

- Files found: build-fixture.cjs, oracle-381.cjs, net-guard-381.cjs, test-381-parity.cjs, run-all-381.sh.
- Commits found: c50a44fa5, 59cf68000.
