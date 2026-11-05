---
phase: 383-beta-77-qa-fixes-windows-room-birth-skill-routing-gate-hones
plan: 04
subsystem: infra
tags: [windows, room-registry, spawn-chokepoint, preview-check, environment_not_ready, seed-117]

requires:
  - phase: 383-beta-77-qa-fixes-windows-room-birth-skill-routing-gate-hones
    provides: plan 03 resolveRoomRuntime, spawnRoomRegistry, formatTried and the three PLAIN_* texts
provides:
  - six room-registry spawn sites on spawnRoomRegistry (no bare 'bash' spawn at them)
  - environment_not_ready at prepareRoomCreation, resumeFn, birthRoom and autoCreatePlaceholderRoom
  - CLI pre-card check in /mos:new-project and its skill mirror
  - one CHANGELOG [Unreleased] Fixed entry for the Windows room creation fix
affects: [383-06, 383-09, 383-10, 383-11]

tech-stack:
  added: []
  patterns:
    - "A failed spawn becomes an Error with stderr and status, so the existing catch block in birthRoom runs unchanged"
    - "Check the machine before the card, again at approval (refresh), and again before the first write"

key-files:
  created: []
  modified:
    - lib/core/navigation/room-birth.cjs
    - lib/core/navigation/room-identity.cjs
    - lib/core/room-open.cjs
    - lib/core/room-auto-create.cjs
    - lib/core/graph-backfill.cjs
    - lib/mcp/startup-operations.cjs
    - commands/new-project.md
    - skills/new-project/SKILL.md
    - CHANGELOG.md

key-decisions:
  - "room-auto-create returns { ok:false, reason:'environment_not_ready' } with no stderr line and no write (D-01: gateless but guarded)."
  - "The resume path calls resolveRoomRuntime({ refresh: true }); the preview uses the cached default call."
  - "pythonVersion(env) uses the shared resolver and returns the version line of the interpreter it ran, or names every candidate it tried."

patterns-established:
  - "runRegistry keeps its { ok, out, stderr, status, python } shape and adds reason, plain and tried only when the runtime is not ready."

requirements-completed: [QA383-01, QA383-04, QA383-10]

duration: not timed (start not recorded)
completed: 2026-11-05
---

# Phase 383 Plan 04: Spawn chokepoint and preview environment check Summary

**All six room-registry spawn sites now run through spawnRoomRegistry, and room_create, the approve path, birthRoom, room-auto-create and /mos:new-project check that the machine can create a room before any card or write.**

## Accomplishments

- Spawn sites: room-birth STEP 4 (create and parent update), room-identity room_id update, room-open `runRegistry`, room-auto-create, graph-backfill. `grep -nE "(execFileSync|spawnSync)\(\s*'bash'"` over the five files prints nothing. The `execFileSync` import stays in room-birth.cjs (compute-state still uses it); it is gone from room-auto-create and room-open uses the platform module only.
- birthRoom guard: `resolveRoomRuntime()` runs after the path and slug checks and before the born-wired gate, `dirPreexisted` and the first `mkdirSync`. On failure it writes `[room-birth] environment not ready for <slug>: <formatTried>` to stderr and returns `{ ok:false, reason:'environment_not_ready', plain, tried, roomDir, slug }`.
- room-auto-create guard sits after Guard 1 (read-only) and before Guard 2 (the rooms home `mkdirSync`). Test P5 confirms a fresh rooms home does not exist after the skip.
- startup-operations: the check sits between `destination()` and the preview and `mintCard`. In `resumeFn` it runs with `{ refresh: true }` after `destination()` and before `navigation.birthRoom`. No gate is minted and nothing is written on failure (P1, P2, P3).
- /mos:new-project and the skill: one step before the B2 GATE marker runs `node "${CLAUDE_PLUGIN_ROOT}/lib/core/platform.cjs" room-runtime` and stops on a non-zero exit. Measured: exit 0 with JSON on stdout on this host; with an empty PATH it exits 1 and writes the three plain lines to stderr.
- CHANGELOG: one bullet under `## [Unreleased]` `### Fixed`; the beta.77 and older blocks are untouched; no en or em dash in the file head.

## Task Commits

1. Task 1: spawn sites, birthRoom and auto-create guards - `b51e36462`
2. Task 2: preview and resume check, CLI pre-card step - `08baf9090`
3. CHANGELOG entry (own commit, `git commit --only CHANGELOG.md`) - `a12006def`

## Test results (measured in this run)

| Check | Result |
|-------|--------|
| tests/test-383-spawn-chokepoint.cjs | exit 0, `PASS: 14 FAIL: 0 PENDING: 0` (S1 to S6) |
| tests/test-383-preview-env-check.cjs | exit 0, `PASS: 7 FAIL: 0 PENDING: 0` (P1 to P7) |
| tests/test-383-no-write-before-gate.cjs | exit 0, `PASS: 4 FAIL: 0 PENDING: 0` (W4 green) |
| `bash tests/run-all-383.sh` | `Phase 383: PASS=8 FAIL=6 SKIP=0` (was PASS=5 FAIL=9) |
| node scripts/build-connector-registry.cjs --check | exit 0 |
| node scripts/build-orchestration-projection.cjs --check | exit 0 |
| node scripts/check-render-coverage.cjs | exit 0 |
| node scripts/build-skill-mirrors.cjs --check | OK (112 mirrors match) |

Still RED in run-all-383 (later plans): card-fork, card-second-person, no-room-routing, plain-failure, sourced-number, voice-length.

Must-stay-green set, run after the last commit:

| Test | Result |
|------|--------|
| test-platform.cjs | exit 0, all tests passed |
| test-room-birth.cjs | exit 0, 35/35 PASS |
| test-l9o-rooms-python-floor.cjs | exit 0, 18 passed, 0 failed, 0 skipped |
| test-room-registry-windows-path / -python-interp / -atomic-replace | exit 0; 25/25, 29/29, 21/21 |
| test-room-registry-path-resolution.cjs | exit 0, 25/25 |
| tests/test-127.2-04-windows-path-and-update-activation.sh | exit 0 |
| test-353-subroom-birth.cjs | exit 0, 38/38 |
| test-rooms-open-actually-switches.cjs | exit 0, 10 passed |
| test-startup-flows.cjs | exit 0 |
| test-371-startup-ui.cjs | exit 0 (see Issues) |
| test-359-declared-arm.cjs | exit 0 |
| test-3696-reply-checks.cjs | exit 0, PASS: 143 FAIL: 0 |
| test-369-hook-require-graph.cjs | exit 0, 5 passed |
| test-session-start-banner.cjs | exit 0 |
| test-36925-rft-birth / -rft-binding | exit 0; 6 passed, 7 passed |
| test-room-auto-create-event-types / -fingerprint-integration | exit 0; 6 pass, 9 pass |
| test-224-backfill-idempotent.cjs, test-195-birth-gate.cjs | exit 0; 16/16, 10/10 |
| test-self-update-platform.cjs | exit 1, `19 passed, 5 failed` (same as before this plan; pre-existing, not touched) |

A wider run of the other test files that mention room-open, startup-operations, graph-backfill, room-identity or room_create: all exit 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Skill mirror is generated, not hand-copied**
- **Found during:** Task 2 commit (a pre-commit hook reported `skill-mirror drift`)
- **Issue:** The plan asked for the two mirrors to be identical. `scripts/build-skill-mirrors.cjs` generates skills/new-project/SKILL.md from commands/new-project.md and rewrites `${CLAUDE_PLUGIN_ROOT}` into the portable `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?...}}` form. A byte-identical hand copy therefore fails the hook.
- **Fix:** Ran the generator, committed its output. The skill carries the same step; the node line differs only by the documented plugin-root normalization. The `sed` diff in the acceptance list shows exactly that one line. P6 passes for both files.
- **Files modified:** skills/new-project/SKILL.md
- **Commit:** 08baf9090

## Issues Encountered

- test-371-startup-ui failed once at HEAD before any edit (`window.releaseRefresh is not a function`, a Playwright page evaluate) and passed on the next run and in every run after my edits. Not caused by this plan (PROVEN: failure at unmodified HEAD). Likely a timing flake; not investigated.
- The first `node scripts/build-skill-mirrors.cjs --help` call ran the build (the script takes no help flag). It changed only the one file named above.

## Deferred Issues

- tests/test-self-update-platform.cjs, 5 of 24 failing: pre-existing, unchanged.
- Other registry spawn sites (room-chooser.cjs 84, room-naming-selector.cjs 244, room-discard-cascade.cjs 139, scripts/heal-command.cjs 1201 and 1211) still spawn bare `bash`, as the plan directs; plan 09 lists them in the D-07 seed.

## Cost

The preview check adds the resolver probes (about 2 child processes) on the first preview in a process; later previews use the cached ok result. The resume path always refreshes, so the approve path pays the probes once per approval. Not timed.

## Known Stubs

None.

## Threat Flags

None. No network or Brain call added. T-383-01 to T-383-03 are mitigated as planned (resolved absolute bash through the helper, argv arrays with no shell key, runtime guard before the first write). T-383-04 accepted.

## UNVERIFIED

- Windows Desktop launch and Windows-native run of the preview check: only Linux ran the new tests. The Windows-side proof from plan 03 covers the helper, not these call sites.
- QA laptop leg waits for plan 383-11.
- Cowork host: same server code, not run there.
- The cached ok runtime is reused by spawnRoomRegistry after a PATH change inside one process (preview and resume refresh; other callers do not). No test changes PATH between ok calls; not exercised.

## Self-Check: PASSED

- FOUND: all nine files in key-files.modified
- FOUND commits: b51e36462, 08baf9090, a12006def
