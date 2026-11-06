---
phase: 385
plan: 08
subsystem: hooks
tags: [cleanup, hooks, operator-update]
requirements-completed: [CLEAN385-04]
key-files:
  created: [tests/test-385-hook-unwire.cjs]
  modified: [hooks/hooks.json, tests/test-261029-qef-hook-timeouts.cjs, tests/test-hmi-poll-hook.cjs, docs/COMPONENT-INVENTORY.md]
completed: 2026-11-06
---

# Phase 385 Plan 08: Unwire the operator-update Stop hook Summary

The Stop entry that ran scripts/operator-update.cjs is gone from hooks/hooks.json. That entry always returned the constant envelope `{"continue":true,"suppressOutput":true}` and wrote nothing. The script and the PostToolUse and UserPromptSubmit entries are untouched (owner ruling R2 in 385-PROOF.md).

## Commit

- 361463852 chore(385-08): unwire the operator-update Stop hook (always a no-op) (5 paths).
- Revert note: `git revert 361463852` restores the entry and the old test shape in one step. The script was never edited (verified: `git diff HEAD~1 HEAD -- scripts/operator-update.cjs` is empty).

## Census (static, from hooks/hooks.json)

- BEFORE: total 46, Stop 8, PostToolUse 11, UserPromptSubmit 8, SessionStart 9. PostToolUse by tool: Write 8, Read 2, Grep 2, Glob 2, Bash 1, SlashCommand 1, AskUserQuestion 1.
- AFTER: total 45, Stop 7. Every other count equal (PostToolUse 11, UserPromptSubmit 8, SessionStart 9, per-tool counts equal).
- The harness (perf-harness.cjs) was not run: Phase 384 holds the measurement lock.

## RED evidence

```
ok   Stop event gives the constant no-op envelope and writes nothing (real registry shape)
ok   Stop event gives the constant no-op envelope and writes nothing (legacy registry shape)
FAIL no command in the Stop array runs operator-update.cjs: 1 Stop command(s) still run operator-update.cjs
ok   PostToolUse and UserPromptSubmit each keep exactly one operator-update.cjs command
exit 1
```

## Baselines (before the edit)

- test-hmi-poll-hook 9/9; test-261029-qef-hook-timeouts ALL PASS; test-operator-hooks rc 0; test-369-hook-require-graph rc 0; test-r1-posttooluse-interceptor-spike rc 0; check-hook-schema-compatibility rc 0; test-198-adapter-budget rc 0; minto-debounce-consumer-census rc 0.
- test-346-catalogue-schema rc 1 (FAIL 12, known). run-all-179 rc 1 (11 passed, 1 failed, leg 179-08 ga4-card-fire-e2e). run-all-198 rc 0 (18 passed). run-all-3696 rc 1 (70 FAIL-lines, mostly expected-red legs). run-all-346 PASS=11 FAIL=1.

## Verify after the change

- test-385-hook-unwire 4/4 ok. All 8 pinned tests above: same rc as baseline (0). check-hook-schema-compatibility rc 0. test-346-catalogue-schema: exactly 1 `^FAIL` line (the known leg 12).
- run-all-179: same single failing leg (179-08), identical FAIL lines to baseline. run-all-198: rc 0, 18 passed. run-all-346: PASS=11 FAIL=1, identical FAIL lines.
- run-all-3696: rc 1 as at baseline. FAIL-line diff against the baseline shows three new FAIL lines, none caused by this plan (peer changes in the shared tree):
  - `test-359-prose-budget` B5 "session-start outside the doctrine line is byte-untouched": scripts/session-start was changed by peer commit 5551afcec (386-09). This plan touched no session-start file.
  - `test-3696-isolation` B5b: the evidence line scripts/check-pending-ambiguous.cjs:79 no longer holds. Peer commit 83dfc010b (386-11) changed that file.
  - `test-3696-isolation` B5f "no repo file newer than the marker": repo files were written during the run by peer sessions and by my own .planning writes (for example .planning/.mindrian/last-cascade.json, scripts/restore-post-compact-context.cjs, a .planning/debug file). The same leg (B4d) failed at baseline on a file that was newer than the marker.
- connector-registry, orchestration-projection, harness-manifest checks: OK. Never-touch guard on HEAD: 0. HEAD holds exactly the 5 expected paths.
- data/arbitration-rule-catalogue.json lines 18-19 and data/first-touch-surfaces.json line 42 still describe operator-update.cjs and jtbd-update.cjs. They stay valid because both scripts stay, and `node tests/test-346-catalogue-schema.cjs` still shows its single known failure (`FAIL 12`, ambient-stop.cjs and card-before-answer-hook.cjs).
- test-hmi-compliance-e2e leg 11 stays a known failure, not edited.

## Deviations

None to the plan. The comment in tests/test-261029-qef-hook-timeouts.cjs header still says "46 command hooks" in the DD-1 history text; the code uses EXPECTED (45) and P385 records the change.
