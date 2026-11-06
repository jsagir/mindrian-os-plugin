---
phase: 385
plan: 14
subsystem: hooks
tags: [unwire, posttooluse, userpromptsubmit, operator-update]
requirements-completed: [CLEAN385-04]
key-files:
  modified: [hooks/hooks.json, tests/test-385-hook-unwire.cjs, tests/test-261029-qef-hook-timeouts.cjs, tests/test-r1-posttooluse-interceptor-spike.cjs, docs/COMPONENT-INVENTORY.md, docs/LAYER-CONTRACT.md]
completed: 2026-11-06
---

# Phase 385 Plan 14: Unwire the operator-update PostToolUse and UserPromptSubmit hooks Summary

Both remaining operator-update entries are removed (owner ruling R2). `scripts/operator-update.cjs` is byte-unchanged (`git diff HEAD~1 HEAD -- scripts/operator-update.cjs` is empty). The feature stays off.

## Commit

- ead460715 chore(385-14): unwire the operator-update PostToolUse and UserPromptSubmit hooks (6 paths). Revert: `git revert ead460715`.

## Census (relative, static)

- BEFORE: total 43, PostToolUse 10, UserPromptSubmit 8, PostToolUse:Write 8, Read 1, Grep 2, Glob 2, Bash 1, AskUserQuestion 1.
- AFTER: total 41, PostToolUse 9, UserPromptSubmit 7, Write 7, Read 0, Grep 1, Glob 1, Bash 0, AskUserQuestion 0. Every other key equal. Checked by script: true.

## RED

Only the structural test failed before the edit (PostToolUse and UserPromptSubmit still ran operator-update.cjs). The three characterizations (constant envelope, no file written, real-shape registry) and the module contract passed before and after. The old 385-08 "keep one operator-update command" test was replaced by the structural test.

## Baselines and results

- Last commit of scripts/operator-update.cjs is a6ca075a5 (as the plan expects): no repair happened.
- run-all-179: 11 passed, 1 failed (179-08), before and after. run-all-198 18/0. run-all-178: 5 passed, 5 failed, same failing legs as baseline (compared by leg list).
- test-r1-posttooluse-interceptor-spike: PASS 9 assertions. test-operator-hooks 12/12. sessionstart-coordinator test rc 0. test-369-hook-require-graph 5/0. check-hook-schema-compatibility PASS. Generators OK. test-346: one FAIL (known).
- doctor --acceptance: not run. UNVERIFIED.

## Notes

- Spike FINDING 1 now reads the AskUserQuestion matcher from tests/fixtures/369/hook-cold-start-baseline.json (line 596 still holds it) and says so in its label.
- scripts/operator-update.cjs line 241 (about) holds a comment that says hooks.json still routes it at Stop, PostToolUse and UserPromptSubmit. The comment is stale. Not edited.
- data/arbitration-rule-catalogue.json lines 18-19 and data/first-touch-surfaces.json line 42 still describe operator-update.cjs and jtbd-update.cjs. They stay valid because both scripts stay. The operator-update note is now a record of a script that no hook starts. test-346 still shows its single known failure.
- A run-all-178 attempt with an open stdin socket hung in test-f7-dial-gap-zero-confirm (the intent-classifier waits on stdin). It was stopped and re-run with stdin from /dev/null. The hang is a harness issue, not caused by this plan.

## Deviations

None in scope.
