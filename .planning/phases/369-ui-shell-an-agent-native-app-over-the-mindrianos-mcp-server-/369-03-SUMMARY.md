---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 03
subsystem: testing
tags: [typescript, installed-layout, hooks, cold-start, wave-0, node-type-stripping]
requires: []
provides:
  - "TS369-04: installed-layout test (pack, loader npm ci, server start, .ts strip on run path, node_modules refusal, symlink, hooks start) with an --exact-floor leg"
  - "TS369-05: static proof that no hook reaches TypeScript, plus a recorded hook cold-start baseline and the script to re-measure"
affects: [369 wave 0 TypeScript gate, any later plan moving a module to .ts, hook performance]
tech-stack:
  added: []
  patterns:
    - "hermetic hook spawning in a throwaway sandbox (HOME, rooms home, room, cwd, TMPDIR), Brain URL on an unreachable loopback"
    - "exit 77 = SKIPPED (ENV GAP), never PASSED without running"
key-files:
  created:
    - tests/test-369-installed-layout.cjs
    - tests/test-369-hook-require-graph.cjs
    - scripts/measure-hook-cold-start.cjs
    - tests/fixtures/369/hook-cold-start-baseline.json
    - .planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-HOOK-COLD-START.md
  modified: []
key-decisions:
  - "Hooks stay .cjs: nothing moves in this phase; a future move re-runs the measure script and must keep every p95 inside its timeout with the ~44 ms one-time stripper cost added"
  - "p95 rule is index floor(0.95*(n-1)); at n=10 that is the second-largest sample, recorded via n in the fixture"
  - "Hook time is wall time to process EXIT; stdout pipe close time is recorded separately (close_p95_ms, pipe_held_after_exit) because backgrounded children hold the pipe"
requirements-completed: [TS369-04, TS369-05]
duration: ~75 min
completed: 2026-10-02
---

# Phase 369 Plan 03: Installed layout and hook cold-start Summary

The plugin runs from the packed, loader-installed layout (server starts in 263 ms, hooks start), Node strips a .ts file on the installed run path and refuses it under any node_modules path (pinned, including via symlink), no hook reaches TypeScript (59 roots, 328 reachable files, 0 .ts), and a measured cold-start baseline is on file (UserPromptSubmit per-prompt sum of p50 253.6 ms, worst PreToolUse p95 90.2 ms against 2000 ms).

## Tasks and commits

| Task | Name | Commit | Files |
| --- | --- | --- | --- |
| 1 | Installed-layout test with an exact-floor mode | d90ffbfa3 | tests/test-369-installed-layout.cjs |
| 2 | Hook require-graph proof, cold-start script, baseline | c736a6f61 | tests/test-369-hook-require-graph.cjs, scripts/measure-hook-cold-start.cjs, tests/fixtures/369/hook-cold-start-baseline.json, 369-HOOK-COLD-START.md |

## Test results

- `node tests/test-369-installed-layout.cjs` (Node v22.23.1): exit 0, arms 1-7 PASS, 7 passed, 0 failed, 0 skipped (about 7 s). Arm 3 server started marker after 263 ms. Arms 5 and 6 report the expected refusal `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` (exit 1 from the probe driver).
- `node tests/test-369-installed-layout.cjs --exact-floor`: exit 77, "SKIPPED (ENV GAP): no Node 22.18.0 binary; Docker daemon not running. Looked at: ~/.nvm/versions/node/v22.18.0/bin/node (missing)". The installed nvm versions are 22.22.2 and 22.23.1. The exact-floor claim (unflagged type stripping at exactly 22.18.0) is therefore NOT proven by this run.
- `node tests/test-369-hook-require-graph.cjs`: exit 0, 5 passed (arm 1 real graph: 59 roots from 11 run-hook.cmd bash scripts and direct node commands, 25 bash files scanned, 328 reachable files, "0 TypeScript modules reachable from hooks"; mutation arms 2, 2b, 2c; arm 3 baseline p95 below timeout for 44 measured entries). Advisory: 173 non-literal require sites cannot be proven statically.
- `node scripts/measure-hook-cold-start.cjs --n 1 --json`: exit 0, prints JSON.
- The repo checkout git status was unchanged by the tests (before/after diff empty); the n=10 baseline run also reported `tree_unchanged: true`.

## Measured hook cold-start numbers (n=10, Node v22.23.1, WSL2)

- Empty `node -e 0`: p50 22.5 ms, p95 23.3 ms.
- UserPromptSubmit (8 hooks): per-prompt aggregate sum of p50 253.6 ms, sum of p95 272.9 ms; individual p95 from 21.9 ms (admin-command-gate) to 45.9 ms (intent-classifier), against budgets of 1500-3000 ms. Adding the one-time ~44 ms stripper to each would add about 352 ms per prompt.
- PreToolUse (budget 2000 ms): write-scope-check p50 35.0 / p95 36.4 / max 37.6 ms; part8-egress-guard-hook p50 88.2 / p95 90.2 / max 91.2 ms.
- Stop (8 hooks): sum of p50 383.4 ms, each p95 under 120 ms against 3000-5000 ms.
- PostToolUse (11 hooks): sum of p50 296.4 ms. SessionStart (8 measured hooks): sum of p50 1350.1 ms; the 120000 ms npm reconcile is listed `not_measured` (network-capable, `--include-heavy` measures it).
- Zero exit-time breaches of any declared timeout.

## Deviations from Plan

### Auto-fixed / design adjustments

**1. [Rule 3 - Blocking] Hook timing measured as process-exit time, with pipe-close time recorded separately**
- **Found during:** Task 2 (first n=1 run)
- **Issue:** `spawnSync` reported post-compact at 4003 ms (kill at timeout + 1000) although the hook exits in about 0.75 s; a backgrounded child (`lib/core/brain-prewarm.cjs`) keeps the stdout pipe open.
- **Fix:** `spawnHook` is now async, runs each hook in its own process group, records exit time (p50/p95/max) and pipe-close time (`close_p95_ms`, `close_max_ms`, `pipe_held_after_exit`), and reaps its own stragglers. `spawnHook` and `makeSandbox` are exported for the installed-layout test.
- **Files:** scripts/measure-hook-cold-start.cjs. **Commit:** c736a6f61

**2. [Rule 3 - Blocking] Sandbox HOME models a steady-state install; the first-session path is probed separately**
- **Found during:** Task 2
- **Issue:** With a bare HOME, `sessionstart-coordinator.cjs` hits its one-time first-session path (doctor self-heal) and ran to the 10 s limit, making the static arm (every p95 below its timeout) fail on a state that is not the per-session cold start.
- **Fix:** `makeSandbox` writes a statusLine block and the statusline onboarding touch-file by default (steady state: coordinator p50 224 ms). A single bare-HOME probe is recorded as `first_session_probe` in the fixture (exit 11023 ms, killed at limit). Not investigated further.
- **Files:** scripts/measure-hook-cold-start.cjs. **Commit:** c736a6f61

**3. [Rule 2 - Missing critical functionality] `--tree-check strict|report` flag**
- **Issue:** Five sessions share the checkout, so a raw `git status` difference can be a peer edit; status cannot tell a hook write from a peer write.
- **Fix:** default `strict` keeps the plan behaviour (any difference exits 1); `report` prints the difference without failing. The committed baseline was run with the default strict check and passed.

**4. Timeout unit handling.** hooks.json declares one entry (`ambient-stop.cjs`, async) with `timeout: 5`; values below 100 are read as seconds and the entry records `timeout_unit_note`.

**5. `payloadFor(event, sandbox, matcher)`** takes the sandbox and the matcher as optional extra arguments (a Brain-matcher PreToolUse/PostToolUse gets an `mcp__mindrian-brain__brain_query` payload carrying only a generic methodology query, Canon Part 8).

No plan-listed file was modified outside `files_modified`; nothing under lib/, hooks/ or bin/ was written.

## Findings for the orchestrator (pre-existing, out of scope, filed in 369-HOOK-COLD-START.md)

1. `session-start` and `post-compact` exit in about 0.76 s but leave `lib/core/brain-prewarm.cjs` holding stdout open until killed (11 s and 4 s). Probably the unreachable Brain the sandbox sets on purpose; not verified against a reachable Brain.
2. First-session coordinator self-heal (`doctor.cjs --statusline-visibility --fix --json`) did not finish inside its own 10 s ceiling in a bare HOME sandbox; the same doctor without `--fix` takes about 80 ms.
3. The hooks.json `timeout` unit is ambiguous (a single `5` among values of 1500 and up).

## Known Stubs

None.

## Threat Flags

None. All spawned processes used throwaway HOME, rooms home, room, cwd and TMPDIR, `MINDRIAN_BRAIN_URL=http://127.0.0.1:9`, and no Brain key (T-369-03-01, T-369-03-04). Mitigations T-369-03-02 and T-369-03-03 are the require-graph test and installed-layout arms 5 and 6.

## Self-Check: PASSED

- Files found: tests/test-369-installed-layout.cjs, tests/test-369-hook-require-graph.cjs, scripts/measure-hook-cold-start.cjs, tests/fixtures/369/hook-cold-start-baseline.json, 369-HOOK-COLD-START.md.
- Commits found in history: d90ffbfa3, c736a6f61.
