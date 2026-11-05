---
phase: 383-beta-77-qa-fixes-windows-room-birth-skill-routing-gate-hones
plan: 09
subsystem: doctor
tags: [doctor, windows, hooks, room-runtime, seed, canon-part-8]

requires:
  - phase: 383-beta-77-qa-fixes-windows-room-birth-skill-routing-gate-hones
    provides: resolveRoomRuntime and formatTried in lib/core/platform.cjs (plan 03)
provides:
  - resolveHookShell(opts) in lib/core/platform.cjs, a read-only mirror of the hooks/run-hook.cmd lookup order
  - the room-runtime doctor point (check-only, cadence always, LOCAL facts only)
  - SEED-144 for the hook-side fix and the remaining bare-bash registry spawn sites (D-07)
affects: [383-11]

tech-stack:
  added: []
  patterns:
    - "Doctor module = one entry in data/doctor-modules.json plus a check(ctx) runner with no fix export (graph-doctor analog)"

key-files:
  created:
    - lib/core/doctor/room-runtime-module.cjs
    - tests/test-383-room-runtime-doctor.cjs
    - .planning/seeds/SEED-144-windows-hooks-pick-the-wsl-launcher-or-no-shell.md
  modified:
    - lib/core/platform.cjs
    - data/doctor-modules.json
    - CHANGELOG.md

key-decisions:
  - "The room-runtime row warns on win32 when the hook kind is not git-bash (wsl-launcher, path-bash, none); on other platforms only a failed room runtime warns"
  - "resolveHookShell is doctor-only. detectPlatform does not call it, and git diff shows no changed line inside detectPlatform"
  - "The hook-side fix is filed as SEED-144, not built (D-07)"

requirements-completed: [QA383-01, QA383-03]

duration: 40min
completed: 2026-11-05
---

# Phase 383 Plan 09: room-runtime doctor point and the hook-shell seed Summary

**`/mos:doctor` now has a `room-runtime` row that names the bash, the Python, the Windows hook shell and every candidate tried, and SEED-144 files the hook-side fix with the evidence.**

## Performance

- **Duration:** about 40 minutes
- **Tasks:** 2 of 2
- **Files:** 6 (3 created, 3 modified)

## Accomplishments

- `resolveHookShell(opts)` mirrors hooks/run-hook.cmd: Program Files Git Bash, then Program Files (x86), then the first `where bash` hit (System32 or WindowsApps gives `wsl-launcher`, any other gives `path-bash`), then `none` with a note that names the silent exit. POSIX gives `posix`. It spawns only `where bash` and runs no hook (T-383-01).
- The module `lib/core/doctor/room-runtime-module.cjs` returns one detail line: `bash: <path> (<ostype>); python: <path> (<version>); hooks: <path> (<kind>); tried: <formatTried>`. It warns with `action_lines` when the runtime is not ok or, on win32, when the hook kind is not git-bash. It never throws and exports no `fix`.
- Registered in data/doctor-modules.json as `room-runtime` (cadence always, flag null, fix_supported false, introduced_version 2.0.0-beta.78).
- SEED-144 holds the evidence (E1, E2 PROVEN on the dev machine's Windows side, UNVERIFIED on the QA laptop), the 11 hooks by name, and the five remaining bare-bash registry spawn sites by file: lib/core/room-chooser.cjs, lib/core/room-naming-selector.cjs, lib/core/room-discard-cascade.cjs, scripts/heal-command.cjs (two sites).

## Task Commits

1. Task 1: resolveHookShell and the room-runtime doctor module - `1de5def56`
2. Task 2: SEED-144 - `1488a1d39`; CHANGELOG bullet (alone, `--only CHANGELOG.md`) - `2c1836a69`

## Verification (quoted)

- `node tests/test-383-room-runtime-doctor.cjs`: `PASS: 10 FAIL: 0 PENDING: 0`, exit 0.
- Row on this host (doctor run with HOME set to an empty temp dir and the running version raised to beta.78, see Notes): `room-runtime ✓ bash: bash (linux-gnu); python: python3 (Python 3.12.3); hooks: bash (posix); tried: bash: bash ok; python: python3 ok`.
- `node tests/test-doctor-module-contract-parity.cjs`: exit 0. `node tests/test-doctor-acceptance-self-coverage.cjs`: `6 passed, 0 failed`, exit 0.
- `node scripts/doctor.cjs --acceptance`: `Acceptance full: 24/25 points passed; failed: verify-release-clean-tree.` The one failure is the tracked-file drift of `tools/perf/README.md`, which belongs to the Phase 384 session (note, not fixed). The acceptance output has no module-registration line to quote; the registration is covered by the contract-parity and self-coverage tests above.
- Gates, all exit 0: build-command-registry --check, build-connector-registry --check, build-orchestration-projection --check, check-render-coverage, build-harness-manifest --check, build-skill-mirrors --check, `run-harness.cjs --check`.
- `bash tests/run-all-383.sh`: `Phase 383: PASS=15 FAIL=0 SKIP=0` (14 before this plan, plus the new test file).
- Must-stay-green set, each exit 0: test-platform, test-383-runtime-resolver, test-doctor-doc-parity, test-369-hook-require-graph, test-227-mode-select-checkpoint, test-room-birth, test-l9o-rooms-python-floor (18 passed), test-startup-flows, test-371-startup-ui, test-359-declared-arm, test-3696-reply-checks, test-3696-mod-voice, test-3696-rubric-eval, test-3696-voice-first-budget, test-3696-operation-doctrine, test-359-prose-budget, test-session-start-banner, test-209-session-start-exemplar, test-209-card-fire-gate, test-251-skeleton-split, test-3696-persona-drift, test-143.2-doctrine-presence, test-3696-one-next-move, test-383-no-room-routing, test-383-card-second-person, test-383-voice-length, test-383-plain-failure, test-383-card-fork.
- `git diff -U0 lib/core/platform.cjs` hunks sit after resolveRoomRuntime and in the export list; none sits inside detectPlatform.
- Dash fence: `grep -cP "[\x{2013}\x{2014}]"` prints 0 for the seed, the module and the test.

## Deviations from Plan

None in code. Three notes:

1. **Seed number:** 144 was the next free number (`ls .planning/seeds/ | sort -V | tail -3` showed SEED-143 last), so the file name matches the plan.
2. **Bare `node scripts/doctor.cjs --json` on this host lists `room-runtime` under `accumulative-engine.deferred`**, not as a check. Cause: the running version of record is the installed plugin in the user's cache (2.0.0-beta.75), and the engine defers any module introduced above it. This is the engine's existing registry/code-skew guard, the same for every new module, and it clears when a release carries beta.78. The row was shown by running the engine with `running: "2.0.0-beta.78"` and an empty HOME.
3. The plan's acceptance line "its output holds a `room-runtime` entry whose detail starts with `bash: `" therefore holds for the engine run with the running version raised, not for the bare CLI on this host today.

## Known Stubs

None.

## Threat Flags

None. The module reads local facts only, spawns `bash`, `python` and `where bash` for version probes, and calls no Brain or network (Canon Part 8).

## Issues Encountered

- tests/test-298-contract-parity.cjs clean-tree leg and doctor `verify-release-clean-tree` fail while `tools/perf/README.md` is modified by the Phase 384 session. Not fixed.
- tests/test-346-catalogue-schema.cjs leg 12 is the known pre-existing failure over scripts/ambient-stop.cjs and scripts/card-before-answer-hook.cjs. Not fixed.

## Self-Check: PASSED

- FOUND: lib/core/doctor/room-runtime-module.cjs, tests/test-383-room-runtime-doctor.cjs, .planning/seeds/SEED-144-windows-hooks-pick-the-wsl-launcher-or-no-shell.md
- FOUND commits: 1de5def56, 1488a1d39, 2c1836a69
