---
phase: 383-beta-77-qa-fixes-windows-room-birth-skill-routing-gate-hones
plan: 01
subsystem: testing
tags: [windows, room-registry, resolver, gate, hermetic-tests, red-first]

requires:
  - phase: 383-beta-77-qa-fixes-windows-room-birth-skill-routing-gate-hones
    provides: CONTEXT decisions D-01 to D-08, PATTERNS analog map, VALIDATION legs
provides:
  - tests/run-all-383.sh phase aggregator (glob discovery, empty-discovery guard, Part 8 sweep, dash fence)
  - tests/helpers/harness-383.cjs shared hermetic helper
  - six RED-first test files that pin D-03, QA383-04 and the absolute-RPATH half of QA383-10
affects: [383-03, 383-04, 383-06, 383-09, 383-10, 383-11]

tech-stack:
  added: []
  patterns:
    - "Injected platform, env, spawnSync and existsSync make Windows logic testable on Linux"
    - "PATH shim directory with symlinks to /usr/bin plus python stubs (real, store-stub, boom, version:X.Y.Z)"
    - "Static source-order legs (index of resolve before index of write) with comments stripped"

key-files:
  created:
    - tests/run-all-383.sh
    - tests/helpers/harness-383.cjs
    - tests/test-383-runtime-resolver.cjs
    - tests/test-383-registry-interpreter.cjs
    - tests/test-383-registry-abs-rpath.cjs
    - tests/test-383-spawn-chokepoint.cjs
    - tests/test-383-preview-env-check.cjs
    - tests/test-383-no-write-before-gate.cjs
  modified: []

key-decisions:
  - "The fake spawnSync in the resolver test compares the command with slashes normalized, so plan 03 may spawn either the raw or the slashed candidate path"
  - "Extra helper export applyEnv(env) added beyond the six named exports, so tests set process.env before any repo require"
  - "No dash-fence file had to be dropped: all listed files and the CHANGELOG top block were clean at HEAD"

patterns-established:
  - "Phase test legs print one PASS/FAIL/PENDING line each and a final PASS: n FAIL: n PENDING: n line"
  - "A whole-file skip prints a line that starts with SKIP and exits 0; nothing else prints SKIP"

requirements-completed: [QA383-01, QA383-04, QA383-10]

duration: not timed (start not recorded)
completed: 2026-11-05
---

# Phase 383 Plan 01: Wave 0 test scaffold for Windows room birth Summary

**Eight files: an aggregator, one hermetic helper and six RED-first tests that pin the D-03 room-runtime resolver, the single registry spawn helper, the Python interpreter probe in scripts/room-registry, the absolute-RPATH nesting defect, and the no-card-no-write preview check.**

## Accomplishments

- tests/run-all-383.sh discovers tests/test-383-*.cjs by glob and exits 1 with `!!! no Phase 383 test files discovered` when the glob is empty (proved with `TEST_383_PREFIX=tests/none-`, exit 1).
- tests/helpers/harness-383.cjs exports hermeticEnv, applyEnv, mkTmp, reporter, shimPath, snapshotTree, realPython3, realBash and Skip.
- Six test files state the target behavior before any code changes. Each fails at HEAD in the named RED legs for a behavior reason (function missing, wrong exit code, wrong tree), not for a syntax or path reason.
- The resolver test was checked for satisfiability against a throwaway reference implementation kept in the scratchpad only (not committed). 14 of 15 legs passed; the one failure (R4 `version_line`) was a bug in that throwaway reference (it kept `Python 3.13` instead of the full line `Python 3.13.6`), not in the test. This shows the contract in the test can be met.

## Task Commits

1. Task 1: aggregator, helper, resolver contract test - `de14e2dbd`
2. Task 2: registry interpreter, absolute RPATH, spawn chokepoint tests - `62e1dcac2`
3. Task 3: preview env check, no-write-before-gate tests - `ca8065256`

## HEAD result table (measured in this run, at HEAD before any implementation)

| File | Exit | Last line | RED legs (FAIL at HEAD) | GREEN guard legs (PASS at HEAD) |
|------|------|-----------|-------------------------|--------------------------------|
| test-383-runtime-resolver.cjs | 1 | `PASS: 1 FAIL: 14 PENDING: 0` | R0 to R9, R11 to R14 (all: `resolveRoomRuntime`, `spawnRoomRegistry` or `toBashPath` is not exported; R14: CLI exit 0, expected 1) | R10 (banner path does not call the resolver) |
| test-383-registry-interpreter.cjs | 1 | `PASS: 1 FAIL: 5 PENDING: 0` | I1 (exit 49 from the Store stub), I2 (exit 49, want 127), I3 (exit 127 with the old python3 message), I4 (exit 1 with python3 3.8.10 present), I6 (12 bare `python3 -c` lines) | I5 (child text `boom` reaches stderr) |
| test-383-registry-abs-rpath.cjs | 1 | `PASS: 1 FAIL: 4 PENDING: 0` | A1 (nested copy `<home>/tmp/...` exists), A2 (`tmp`, `tmp/.../rooms` under the home), A4 (`C:`, `C:/Users`, `C:/Users/x` under the home), A5 (`case "$RPATH" in` at 3197 after `mkdir -p` at 2426) | A3 (relative path) |
| test-383-spawn-chokepoint.cjs | 1 | `PASS: 0 FAIL: 14 PENDING: 0` | S1 x5 files, S2 x5 files, S3, S4, S5, S6 | none |
| test-383-preview-env-check.cjs | 1 | `PASS: 1 FAIL: 6 PENDING: 0` | P1 (preview returned a card), P2 (1 live gate), P3 (`registry_create_failed:spawnSync bash ENOENT`), P4 (same reason), P5 (same reason), P6 (new-project.md lacks `platform.cjs room-runtime`) | P7 |
| test-383-no-write-before-gate.cjs | 1 | `PASS: 2 FAIL: 2 PENDING: 0` | W3 (`tmp`, `tmp/mcp-wire-267-rooms-.../w383` nested under the home), W4 (room_create returned ok:true with a gate) | W1, W2 |
| bash tests/run-all-383.sh | 1 | `Phase 383: PASS=2 FAIL=6 SKIP=0` | six files FAILED as above | Part 8 sweep PASSED, dash fence PASSED; `discovered 6 test file(s)` |

No leg was GREEN at HEAD without being named a guard in the plan. No finding of that kind.

Acceptance checks run and met: `bash -n tests/run-all-383.sh` exit 0; `grep -c TEST_383_PREFIX` is 2 or more; the helper exports the six named functions; `grep -P "[\x{2013}\x{2014}]"` on all new files prints nothing; `git status --porcelain` after the runs shows only the new test files plus the pre-existing `.planning/STATE.md` change; the mtime of `~/MindrianRooms/.rooms` read 1793261512 before and after the runs (no test touched the real rooms home).

## Deviations from Plan

None - plan executed as written, with two small additions inside the plan's intent:

- `applyEnv(env)` and `realBash()` were added to the helper so that tests set `process.env` before any repo require and find an absolute bash for the PATH-shim runs.
- Two extra leg assertions: A4 also checks that no `C:` folder appears under the temp cwd; I6 counts `"$PY"` over non-comment lines only.

## Known Stubs

None. These are test files; they hold no placeholder data.

## Threat Flags

None. The tests write only inside mkdtemp directories, set HOME and the rooms variables to temp dirs before any repo require, and the stdio server uses the unreachable loopback Brain URL of tests/helpers/mcp-wire-267.cjs. Threat T-383-07 is mitigated as planned; the real rooms home was unchanged.

## UNVERIFIED

- Real Windows behavior. Every Windows leg uses injected platform values on Linux. The real check waits for plan 383-03 on this host and plan 383-11 on the QA laptop.
- Desktop launch PATH and Cowork. The stdio server is the one Desktop starts; the PATH of a Desktop launch was not observed.
- test-383-registry-interpreter.cjs legs I1 to I4 on macOS or with a different `/usr/bin` layout. The shim assumes `/usr/bin` or `/bin` holds bash.

## Self-Check: PASSED

- FOUND: tests/run-all-383.sh, tests/helpers/harness-383.cjs, tests/test-383-runtime-resolver.cjs, tests/test-383-registry-interpreter.cjs, tests/test-383-registry-abs-rpath.cjs, tests/test-383-spawn-chokepoint.cjs, tests/test-383-preview-env-check.cjs, tests/test-383-no-write-before-gate.cjs
- FOUND commits: de14e2dbd, 62e1dcac2, ca8065256
