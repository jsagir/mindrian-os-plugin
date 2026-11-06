---
phase: 385
plan: 10
subsystem: hooks
tags: [cleanup, hooks, query-efficiency]
requirements-completed: [CLEAN385-04]
key-files:
  modified: [hooks/hooks.json, tests/test-385-hook-unwire.cjs, tests/test-261029-qef-hook-timeouts.cjs]
completed: 2026-11-06
---

# Phase 385 Plan 10: Run query-efficiency telemetry on Grep and Glob only Summary

The matcher of the query-efficiency PostToolUse group changed from `Read|Grep|Glob` to `Grep|Glob`. The command, the timeout 3 and the position are unchanged. scripts/query-efficiency-telemetry.cjs is byte-unchanged.

## Commit

- 3a0a40ce7 chore(385-10): run query-efficiency telemetry on Grep and Glob only (Read result is always empty) (3 paths; `git diff -U0` of hooks.json shows exactly one removed and one added line).
- Revert note: `git revert 3a0a40ce7` restores the matcher in one step. The script was never edited.

## Proof (re-run at HEAD f6490c9af)

- A real Read result keeps its text under `tool_response.file.content`. The script reads only `tool_response.content`, so a Read gives 0 tokens and exits at line 313 before it resolves a room (DD-9 comment at lines 307-312) (PROVEN by code).
- Characterization (new test): a real-shape Read payload gives exit 0, empty stdout and no file under HOME (PROVEN). Positive control: a Grep payload prints the advisory (`query efficiency`) and appends one row to `query-efficiency.jsonl` (PROVEN), so the Read test would notice a change.

## RED evidence

```
ok   query-efficiency on a real-shape Read result gives no stdout and writes no file
ok   control: query-efficiency on a Grep result still prints the advisory and appends one row
FAIL the query-efficiency PostToolUse group has matcher Grep|Glob, timeout 3 and one command: matcher Read|Grep|Glob
exit 1   (exactly one FAIL)
```

## Census (relative, static)

- BEFORE: total 44, PostToolUse 11, PostToolUse:Read 2, Grep 2, Glob 2. AFTER: total 44, PostToolUse 11, PostToolUse:Read 1, Grep 2, Glob 2. Every other key equal.

## Baselines and verify

- Baselines (re-run before the edit, rc 0 each): lib/memory/query-efficiency-telemetry.test.cjs, test-261029-s9x-token-estimate-cache, test-hook-envelope-shape, test-261029-qef-hook-timeouts, check-hook-schema-compatibility, test-198-adapter-budget, minto census. run-all-179 rc 1 (leg 179-08 only) and run-all-198 rc 0 (18 passed) from the plan 385-09 after-state (reused).
- After the change: the same rc 0 for all of the tests above plus test-hmi-poll-hook and test-jtbd-hook-integration. `bash tests/run-all-198.sh` rc 0, Passed 18. `bash tests/run-all-179.sh` rc 1, Passed 11 Failed 1, only leg 179-08, FAIL lines identical to the baseline.
- connector-registry, orchestration-projection, harness-manifest checks: OK. Never-touch guard: 0. HEAD holds exactly the 3 expected paths.
- tests/fixtures/369/hook-cold-start-baseline.json (a measured snapshot) not edited.
- Not run, by coordinator ruling: run-all-3696, doctor (one doctor run at the end of the remaining plans).

## Observation (not acted on)

Residual risk accepted by the plan: if a later Claude Code release puts a top-level `tool_response.content` on a Read result, the hook would have logged Read calls and this narrowing stops that. The telemetry is advisory and local.

## Deviations

None. P385.matcher entries use the shape `{event, sub, to}` and the A1 check in tests/test-261029-qef-hook-timeouts.cjs finds the group by command substring (plan 385-08 had left the matcher array empty with a placeholder shape).
