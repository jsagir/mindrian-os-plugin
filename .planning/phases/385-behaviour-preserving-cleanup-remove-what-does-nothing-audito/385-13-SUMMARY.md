---
phase: 385
plan: 13
subsystem: hooks
tags: [unwire, stop-hook, hmi-compliance-poll]
requirements-completed: [CLEAN385-04]
key-files:
  modified: [hooks/hooks.json, tests/test-385-hook-unwire.cjs, tests/test-261029-qef-hook-timeouts.cjs, tests/test-hmi-poll-hook.cjs, docs/COMPONENT-INVENTORY.md]
completed: 2026-11-06
---

# Phase 385 Plan 13: Unwire the hmi-compliance-poll Stop hook Summary

The Stop entry that ran `scripts/hmi-compliance-poll.cjs --hook` is removed (owner ruling R1). The script is byte-unchanged.

## Commit

- f7052db65 chore(385-13): unwire the per-turn doctor poll Stop hook (5 paths). Revert: `git revert f7052db65`.

## Census (relative, static)

- BEFORE (re-taken at HEAD with the 386-36 entry): total 44, Stop 6, PostToolUse 10, UserPromptSubmit 8.
- AFTER: total 43, Stop 5, every other key equal. Task 1 census and Task 2 census were equal (no peer change between them).
- `--census` now takes an optional hooks.json path.

## RED

Only the structural test failed before the edit: "no command in the Stop array runs hmi-compliance-poll.cjs and the run-hook.cmd on-stop entry stays" (1 Stop command still ran it). The characterization (constant envelope, only `last-hmi-poll.json` written) and the reader scan (only the poll script and hmi-status-command.cjs read the file) passed before and after.

## Baselines and results (same legs before and after)

- run-all-179: Passed 11, Failed 1 (179-08 ga4-card-fire-e2e), before and after.
- run-all-198 18/0; test-198-adapter-budget 15/15; minto census 5/5; check-hook-schema-compatibility PASS; test-369-hook-require-graph 5/0; test-261029 ALL PASS; test-hmi-poll-hook 9/0; test-hmi-poll-primitive 12/12; three generators --check OK; test-346 one FAIL (leg 12, known).
- run-all-3696: the baseline run hit the 280 s timeout (rc 124), so it has no usable baseline. UNVERIFIED after.
- doctor --acceptance: not run (about 3 min, tree shared with peers). UNVERIFIED.

## Notes

- Catalogue row `hmi-compliance-poll` in data/arbitration-rule-catalogue.json is not edited. Its `hook_event: "Stop"` field is now stale. test-346 still shows its single known failure.
- The hooks.json group removal was done with a short python replace (exact block, count 1), not the Edit tool. The result was checked as valid JSON.

## Deviations

None in scope. The pinned items were edited as the plan lists (test_08 renamed, P385 item plus TABLE row removed, doc line).
