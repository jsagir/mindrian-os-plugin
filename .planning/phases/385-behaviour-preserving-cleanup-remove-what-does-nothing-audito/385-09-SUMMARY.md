---
phase: 385
plan: 09
subsystem: hooks
tags: [cleanup, hooks, jtbd-update]
requirements-completed: [CLEAN385-04]
key-files:
  modified: [hooks/hooks.json, tests/test-385-hook-unwire.cjs, tests/test-261029-qef-hook-timeouts.cjs, tests/test-hmi-poll-hook.cjs, tests/test-jtbd-hook-integration.cjs, docs/COMPONENT-INVENTORY.md]
completed: 2026-11-06
---

# Phase 385 Plan 09: Unwire the jtbd-update Stop hook Summary

The Stop entry that ran `scripts/jtbd-update.cjs stop` is gone from hooks/hooks.json. The script and the `jtbd-update.cjs userprompt` UserPromptSubmit entry are untouched.

## Commit

- 484cbfc56 chore(385-09): unwire the jtbd-update Stop hook (live Stop payload carries no reply text) (6 paths).
- Revert note: `git revert 484cbfc56` restores the entry and the old test shape in one step. The script was never edited (`git diff HEAD~1 HEAD -- scripts/jtbd-update.cjs` is empty).

## Proof (re-run at HEAD 0073dd54a)

- The Stop leg reads the reply text from CLAUDE_LAST_RESPONSE or the stdin fields `response` or `transcript` (scripts/jtbd-update.cjs lines 102 and 146-152). Without a `/mos:` command in that text it returns before it classifies or writes (PROVEN by code).
- `git grep CLAUDE_LAST_RESPONSE` finds only the script and two test files (PROVEN).
- Characterization (new test): with the live Stop payload shape (the `/mos:` text sits in `last_assistant_message`) and CLAUDE_LAST_RESPONSE removed, the script exits 0 with empty stdout and writes no file. A control run on the same room, with the reply text delivered through CLAUDE_LAST_RESPONSE, does write state, so the no-op is due to the missing field and not to a room that fails to resolve (PROVEN).
- Official docs Stop field list: UNVERIFIED. WebFetch was not available to this agent. The repo record stands (scripts/check-card-fire.cjs lines 26-33 and scripts/measure-hook-cold-start.cjs line 183 show the live Stop payload carries `last_assistant_message`, `transcript_path`, `stop_hook_active`, `session_id`). No contrary quote was found.

## RED evidence

```
ok   jtbd-update stop with the live Stop payload gives no stdout and writes no file
ok   control: the same room does write state when the reply text reaches the script
FAIL no command in the Stop array runs jtbd-update.cjs: 1 Stop command(s) still run jtbd-update.cjs
ok   UserPromptSubmit keeps exactly one jtbd-update.cjs userprompt command
exit 1   (exactly one FAIL)
```

(Two earlier drafts of the control failed because the fixture lacked the second decision line and the operator state that the existing Class 2 test seeds; fixed in the test, not in the product.)

## Census (relative, static)

- BEFORE: total 45, Stop 7 (after plan 385-08). AFTER: total 44, Stop 6. SessionStart 9, UserPromptSubmit 8, PostToolUse 11 and every PostToolUse per-tool count unchanged.

## Baselines and verify

- Baselines (reused from the plan 385-08 after-state, and re-run for the quick tests before the edit): test-jtbd-hook-integration, test-memory-hook-integration, test-240-jtbd-continuous-promotion, test-hmi-poll-hook, test-261029-qef-hook-timeouts, test-198-adapter-budget, minto census, check-hook-schema-compatibility all rc 0. test-connector-tier-d-hooks rc 1 (known). run-all-179 rc 1 (leg 179-08 only), run-all-198 rc 0 (18 passed).
- After the change: the same rc for every test above (including test-connector-tier-d-hooks rc 1 as at baseline). test-346-catalogue-schema: exactly 1 `^FAIL` line (the known leg 12).
- `bash tests/run-all-198.sh`: rc 0, Passed 18 Failed 0. `bash tests/run-all-179.sh`: rc 1, Passed 11 Failed 1, the only failing leg is 179-08 ga4-card-fire-e2e, FAIL lines identical to the baseline.
- connector-registry, orchestration-projection, harness-manifest checks: OK. Never-touch guard: 0. HEAD holds exactly the 6 expected paths.
- Not run, by coordinator ruling (no extra long suites): run-all-240, run-all-346, run-all-3696, doctor (one doctor run at the end of the remaining plans).
- data/arbitration-rule-catalogue.json lines 18-19 and data/first-touch-surfaces.json line 42 still describe operator-update.cjs and jtbd-update.cjs. They stay valid because both scripts stay, and `node tests/test-346-catalogue-schema.cjs` still shows its single known failure (`FAIL 12`, ambient-stop.cjs and card-before-answer-hook.cjs).

## Deviations

None to the product plan. Class 9 of tests/test-jtbd-hook-integration.cjs was rewritten to assert the new truth (userprompt registered, stop not registered), as the plan said.
