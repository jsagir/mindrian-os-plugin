---
phase: 387-eureka-reachable-on-a-normal-install
plan: "06"
subsystem: eureka-part-8-proof
tags: [part-8, egress, fake-engine, uv-flags, tdd]
requires: ["387-03", "387-05", "387-09", "387-11"]
provides:
  - "tests/fixtures/eureka-fake-engine-387 (a fake uv that serves a minimal Eureka MCP, answers sync and the doctor entry, records what it receives)"
  - "tests/test-387-eureka-egress.cjs (arms P1, A1 to A10, U1, P3, P4 over the fake engine)"
  - "--no-sync --offline --locked --no-python-downloads in the uv arguments of all 4 spawning paths, through the one builder uvRunArgs"
affects: [387-10, 387-08]
key-files:
  created:
    - tests/fixtures/eureka-fake-engine-387/fake-uv.cjs
    - tests/fixtures/eureka-fake-engine-387/pyproject.toml
    - tests/test-387-eureka-fake-engine.cjs
    - tests/test-387-eureka-egress.cjs
  modified:
    - lib/mcp/tools/eureka-capability-run.cjs
    - lib/mcp/tools/eureka-graph-analyze.cjs
    - tests/test-341-eureka-no-brain-reach.cjs
    - tests/test-387-eureka-installed-layout.cjs
key-decisions:
  - "The runtime child allowlist gains UV_PROJECT_ENVIRONMENT only. UV_CACHE_DIR and UV_PYTHON_INSTALL_DIR stay out: a run with --no-sync and --offline writes no cache and installs no Python."
  - "Every engine start is offline by argument and by environment on all 4 paths; MINDRIAN_EUREKA_ALLOW_NETWORK=1 lifts --no-sync, --offline, --no-python-downloads and the three offline variables, keeps --locked, and is never copied to the child."
requirements-completed: [EUR387-05]
completed: 2026-11-06
---

# Phase 387 Plan 06: Part 8 proof with a fake engine Summary

The plugin side of Canon Part 8 for Eureka is proven with a fake engine: the engine child gets a projection snapshot only, a clean environment, the engine folder as its working folder, and uv arguments that forbid a sync, a download and the network on all 4 spawning paths. The real engine was not run; the proof against it is the owner-run test of Plan 387-10.

## What was done (TDD)

- Decision gate: the six record lines in 387-DECISION-RECORD.md matched option A.
- Fixture (45553f2b2): fake uv (mode 100755, checked with git ls-files -s) and its self-test, arms F1 to F6, all pass.
- RED (e09eb5077): egress test with 22 arms; 11 failed for one cause (the plain uv run and the missing environment key). Tripwire and installed-layout pin edited in the same commit.
- GREEN (f31a42d57): both product files; all 22 arms pass.

RED arms of the same cause: P1 (hand-built arrays in two tool modules), U1 (UV_PROJECT_ENVIRONMENT missing), A3 capability_run, capability_start, scout, scout (options), A9 for all 4 paths, A10. A3 analyze, A1, A2, A4 to A8, P3 and P4 passed before the fix, as planned.

## Verified (PROVEN, run in this tree)

- `node tests/test-387-eureka-egress.cjs`: 22 passed, 0 failed. `node tests/test-387-eureka-fake-engine.cjs`: 6 passed.
- offline-env, capability-run, graph-opportunity-scout, 387 installed-layout (9 of 9, arm I8 flipped), route-needs, engine-states, 341 no-brain-reach (22 passed): exit 0.
- `bash tests/run-all-196.sh`: Passed 7, Failed 0. `bash tests/run-all-387.sh` (before Plan 10 files): all Phase 387 tests pass.
- Part 11 before and after: command-registry, connector-registry, orchestration-projection, render-coverage, skill-mirrors all exit 0; nothing regenerated.
- A7 control: the network counter counted a loopback connect to the capture server, then the engine calls made 0 non-loopback attempts. A5 control: a request that carries the room folder and room.db is counted by the fake (so a zero is meaningful). A8: the Brain capture server saw 0 requests; brain-client.cjs was in require.cache (information only; some module in the room helper graph loads it, which was not traced; the capture server saw no call).

## Pre-existing reds (not caused by this plan)

`bash tests/run-all-341.sh` ends PASS=31 FAIL=4. The four fails are the release.sh step-block tripwires (run-all-310 leg 3, the 341 step-block tripwire, and the leg that wraps run-all-310) and the doctor registry count checks of test-341-retired-classes-a-h (check 2) and test-341-retired-topology-halves (check 3). All four fail identically in a clean detached worktree at 9e0a0e8d4 (the commit before this plan). The other 31 legs pass, including the Eureka no-Brain-reach tripwire.

## Deviations from Plan

**1. [Rule 1 - Plan inconsistency] Arm A1 split into A1 and U1.** The plan lists the UV_PROJECT_ENVIRONMENT clause in A1 and also says A1 must print ok before the fix. The allowlist gains that key only in Task 3, so the clause is now its own arm U1 (RED today, GREEN after). A1 keeps the subset and no-UV_CACHE_DIR clauses.

**2. [Rule 3 - Blocking] The fake needs the repo node_modules and a project name.** The fixture is copied to a temp folder, so `require` of the MCP server package fails there. The test writes repo-root.txt into the copy and the fake loads the packages through createRequire from that path. The sync command also checks the project name before it shows the grant card, so the P3 copy gets a synthetic pyproject (name mindrian-eureka, an eureka-mcp script entry) in its temp folder only. The committed fixture pyproject stays the 3 plan lines.

**3. [Rule 2 - Test strength] Two controls added.** A5 control (the watch list sees a planted room path) and the A7 loopback control. Without them a zero would not prove anything.

**4. [Rule 1 - Pin] Installed-layout arm I8 flipped.** The argv pin now holds the four flags on every spawning path and UV_OFFLINE is 1 on all 4; the pin allows UV_PROJECT_ENVIRONMENT as the only extra UV_ key. EXPECT comment names Plan 387-06.

**5. Commit location.** This directory is a git worktree on branch main by task order. The worktree-agent branch guard in the executor protocol was not applied because the task names branch main as the target.

## Known Stubs

None.

## UNVERIFIED (not run)

1. The live tests tests/test-eureka-live-*.cjs need the real engine and were not run. A live run now needs the engine folder prepared first (sync, and a model folder for the scout) or MINDRIAN_EUREKA_ALLOW_NETWORK=1.
2. The effect of --no-sync --offline --locked --no-python-downloads inside the real engine project. The flags parse together on uv 0.9.4 (shown in an empty folder in an earlier plan); no run in the real project was done.
3. The real engine's own network behavior. Plan 387-10 builds the owner-run test (strace, no-network run, planted marker, the engine's own no_network tests).

## Threat Flags

None. No new endpoint, auth path or schema. The sync child env (Plan 387-09) is unchanged and now covered by P3.

## Self-Check: PASSED

- Files exist: fake-uv.cjs, pyproject.toml, both test files, both product files.
- Commits exist: 45553f2b2, e09eb5077, f31a42d57.
