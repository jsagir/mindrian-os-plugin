# Phase 369: Hook cold-start baseline (plan 369-03, TS369-05)

Measured 2026-10-02 on WSL2 (`6.18.33.2-microsoft-standard-WSL2`), Node v22.23.1, n=10 per hook, before any hook moves (D-17).
The raw numbers live in `tests/fixtures/369/hook-cold-start-baseline.json`; this file is the human reading of them.

## The rule

No hook moves to TypeScript in this phase. A future move re-runs `scripts/measure-hook-cold-start.cjs` and must keep every
p95 inside its declared timeout with the about 44 ms one-time type-stripper cost added (RESEARCH Pattern 1: the first .ts
file a process loads measured p50 66.5 ms against 22.0 ms; the cost is paid once per process, and every hook is its own
process). `tests/test-369-hook-require-graph.cjs` proves today that no module reachable from any hooks.json entry is .ts,
.mts or .cts (59 node script roots, 328 reachable files, 0 TypeScript).

## How to read the numbers

- One row per hooks.json command. Each was spawned n=10 times for real (the actual command string, `${CLAUDE_PLUGIN_ROOT}`
  expanded to the checkout) inside a throwaway sandbox: throwaway HOME, rooms home, fixture room and cwd; Brain URL
  pointed at an unreachable loopback port; no session id; no Brain key. The sandbox HOME looks like a steady-state install
  (statusLine block, onboarding touch-file), because a per-session cold start is what the budgets govern.
- p50, p95 and max are wall time to process exit, in ms. Percentile rule: ascending samples, index floor(q * (n - 1)); at
  n=10 the p95 is the second-largest sample.
- Budget is the hooks.json `timeout`, read as milliseconds (the unit spike 003's 2000 ms PreToolUse budget uses). One entry,
  `ambient-stop.cjs` (async), declares `5`; values below 100 are read as seconds, so 5000 ms.
- An empty `node -e 0` process on this machine costs p50 22.5 ms, p95 23.3 ms. That is the floor under every hook row.
- The git status of the checkout was identical before and after the run (no hook wrote into the shared tree).

## UserPromptSubmit per-prompt aggregate

UserPromptSubmit per-prompt aggregate: 8 hooks, sum of p50 253.6 ms, sum of p95 272.9 ms (sequential ceiling; Claude Code
may run the hooks of one event concurrently). If all eight loaded one .ts file, the one-time stripper cost would add about
8 x 44 = 352 ms to that sum on every prompt, which is why no hook moves in this phase.

Other per-event sums of p50 (sequential): SessionStart 1350.1 ms across the 8 measured hooks, Stop 383.4 ms across 8,
PostToolUse 296.4 ms across 11, PreToolUse 123.2 ms across 2, PostCompact 772 ms, PreCompact 13.8 ms, SessionEnd 21.6 ms,
FileChanged 9.2 ms, CwdChanged 16.0 ms, SubagentStop 12.3 ms, TaskCompleted 12.5 ms.

PreToolUse (the tightest budget, 2000 ms from spike 003): worst p95 is 90.2 ms (`part8-egress-guard-hook.cjs`), 4.5 percent
of its budget; adding 44 ms keeps it near 134 ms.

## SessionStart

| Entry | Budget (ms) | p50 | p95 | max | Breaches |
| --- | --- | --- | --- | --- | --- |
| scripts/sessionstart-npm-reconcile.cjs | 120000 | not measured (budget over 30 s, network-capable; use `--include-heavy`) | | | |
| scripts/sessionstart-post-update-preflight.cjs | 12000 | 28.1 | 29.6 | 31.3 | 0 |
| run-hook.cmd session-start | 10000 | 762.3 | 771.9 | 784.6 | 0 (pipe held 10x, see observations) |
| scripts/sessionstart-coordinator.cjs | 10000 | 224.3 | 227.4 | 227.4 | 0 |
| scripts/sessionstart-reference-now-seed.cjs | 5000 | 88.2 | 91.9 | 256.2 | 0 |
| scripts/check-pending-breakthrough.cjs | 2000 | 27.8 | 29.6 | 30.3 | 0 |
| scripts/check-pending-ambiguous.cjs | 2000 | 27.1 | 29.4 | 29.4 | 0 |
| scripts/gsd-graph-derive-drain.cjs | 5000 | 90.4 | 92.7 | 92.9 | 0 |
| scripts/agentshield-sessionstart-scan.cjs | 8000 | 101.9 | 102.3 | 104.5 | 0 |

## PreCompact, PostCompact, SessionEnd, FileChanged, CwdChanged, SubagentStop, TaskCompleted

| Event | Entry | Budget (ms) | p50 | p95 | max | Breaches |
| --- | --- | --- | --- | --- | --- | --- |
| PreCompact | run-hook.cmd pre-compact | 2000 | 13.8 | 15.2 | 15.3 | 0 |
| PostCompact | run-hook.cmd post-compact | 3000 | 772.0 | 781.1 | 794.0 | 0 (pipe held 10x, see observations) |
| SessionEnd | scripts/session-end-presence.cjs | 3000 | 21.6 | 22.7 | 23.3 | 0 |
| FileChanged | run-hook.cmd on-file-changed | 3000 | 9.2 | 10.6 | 10.7 | 0 |
| CwdChanged | run-hook.cmd on-cwd-changed | 2000 | 16.0 | 16.5 | 17.3 | 0 |
| SubagentStop | run-hook.cmd on-agent-complete | 3000 | 12.3 | 13.3 | 13.7 | 0 |
| TaskCompleted | run-hook.cmd on-task-complete | 3000 | 12.5 | 13.0 | 13.3 | 0 |

## Stop

| Entry | Budget (ms) | p50 | p95 | max | Breaches |
| --- | --- | --- | --- | --- | --- |
| run-hook.cmd on-stop | 3000 | 115.5 | 119.1 | 121.5 | 0 |
| scripts/operator-update.cjs | 3000 | 30.6 | 33.7 | 34.7 | 0 |
| scripts/jtbd-update.cjs stop | 3000 | 30.3 | 31.6 | 32.5 | 0 |
| scripts/hmi-compliance-poll.cjs --hook | 3000 | 33.4 | 36.5 | 38.1 | 0 |
| scripts/gsd-graph-derive-sweep.cjs | 3000 | 21.4 | 22.8 | 26.8 | 0 |
| scripts/check-card-fire.cjs | 3000 | 36.2 | 38.2 | 38.3 | 0 |
| scripts/check-voice-style.cjs | 3000 | 27.3 | 28.5 | 28.8 | 0 |
| scripts/ambient-stop.cjs --stop (async, declared 5 = 5 s) | 5000 | 88.7 | 91.4 | 97.5 | 0 |

## PreToolUse

| Entry | Budget (ms) | p50 | p95 | max | Breaches |
| --- | --- | --- | --- | --- | --- |
| run-hook.cmd write-scope-check | 2000 | 35.0 | 36.4 | 37.6 | 0 |
| scripts/part8-egress-guard-hook.cjs | 2000 | 88.2 | 90.2 | 91.2 | 0 |

## PostToolUse

| Entry | Budget (ms) | p50 | p95 | max | Breaches |
| --- | --- | --- | --- | --- | --- |
| run-hook.cmd post-write | 3000 | 30.3 | 33.2 | 33.7 | 0 |
| scripts/frontmatter-schema-validator.cjs | 2000 | 21.0 | 21.1 | 21.4 | 0 |
| scripts/async-artifact-auto-commit.cjs | 3000 | 27.6 | 31.1 | 32.9 | 0 |
| scripts/memory-completion-detector.cjs | 3000 | 20.6 | 24.8 | 24.9 | 0 |
| scripts/auto-explore-fingerprint.cjs | 3000 | 32.5 | 34.0 | 34.4 | 0 |
| scripts/gsd-artifact-graph-hook.cjs | 3000 | 22.1 | 23.5 | 24.4 | 0 |
| scripts/memory-artifact-graph-hook.cjs | 3000 | 22.2 | 23.5 | 24.0 | 0 |
| scripts/query-efficiency-telemetry.cjs | 1500 | 28.0 | 29.2 | 29.3 | 0 |
| scripts/operator-update.cjs | 3000 | 31.8 | 33.3 | 39.0 | 0 |
| scripts/brain-response-sanitize-hook.cjs | 3000 | 31.7 | 33.5 | 34.5 | 0 |
| scripts/telemetry-command-invocation.cjs | 5000 | 28.6 | 30.7 | 31.7 | 0 |

## UserPromptSubmit

| Entry | Budget (ms) | p50 | p95 | max | Breaches |
| --- | --- | --- | --- | --- | --- |
| scripts/admin-command-gate.cjs | 2000 | 20.6 | 21.9 | 23.0 | 0 |
| run-hook.cmd intent-classifier | 2000 | 44.3 | 45.9 | 49.7 | 0 |
| scripts/mva-detect.cjs | 1500 | 32.4 | 33.7 | 36.3 | 0 |
| scripts/first-install-router.cjs | 1500 | 32.8 | 40.8 | 73.3 | 0 |
| scripts/brain-derivation-drain.cjs | 2000 | 28.1 | 29.0 | 29.5 | 0 |
| scripts/operator-update.cjs | 3000 | 32.4 | 33.6 | 38.3 | 0 |
| scripts/jtbd-update.cjs userprompt | 3000 | 30.7 | 33.2 | 34.5 | 0 |
| scripts/auto-explore-drain.cjs | 3000 | 32.3 | 34.8 | 35.3 | 0 |

## Observations (pre-existing behaviour, not touched by this phase)

1. **Pipe held after exit (session-start, post-compact).** Both bash hooks exit in about 0.76 s but a backgrounded child,
   `lib/core/brain-prewarm.cjs`, keeps their stdout pipe open until the harness kills it at its limit (11 s and 4 s here).
   It is probably waiting on the unreachable Brain URL the sandbox deliberately sets (Canon Part 8); with a reachable Brain
   it likely finishes fast. If Claude Code waits for pipe close (not verified), an offline user would pay the full timeout
   on those two hooks. The fixture records this as `pipe_held_after_exit` and `close_max_ms`. Worth a look in a later
   phase; nothing here depends on it.
2. **First-session coordinator self-heal (bare HOME).** With no statusLine block and no onboarding touch-file (the one-time
   first-session state), `sessionstart-coordinator.cjs` runs `doctor.cjs --statusline-visibility --fix --json`, which did
   not finish inside the coordinator's own 10 s self-heal ceiling in the sandbox (probe: exit 11023 ms, killed at limit;
   `first_session_probe` in the fixture, n=1). The same doctor without `--fix` returns in about 80 ms, so the stall is in the
   fix path. The steady-state coordinator is 224 ms. This is a once-per-install path and was not investigated further here.
3. **Unit ambiguity.** hooks.json mixes `timeout` values of 1500..120000 with a single `5` (ambient-stop). Claude Code's
   hook documentation may read `timeout` as seconds (not verified here); this repo's budgets (spike 003) treat the large values as milliseconds.
   The script follows the repo's reading; if the seconds reading is the real one, every budget here is 1000 times more generous.

## Reproduce

```bash
export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH
node scripts/measure-hook-cold-start.cjs --n 10 --json --out tests/fixtures/369/hook-cold-start-baseline.json
node scripts/measure-hook-cold-start.cjs --n 3            # human table
node scripts/measure-hook-cold-start.cjs --include-heavy  # also the SessionStart npm reconcile (network-capable)
node scripts/measure-hook-cold-start.cjs --tree-check report  # when other sessions are editing the checkout
node tests/test-369-hook-require-graph.cjs                # require-graph proof + baseline p95 vs timeout
```
