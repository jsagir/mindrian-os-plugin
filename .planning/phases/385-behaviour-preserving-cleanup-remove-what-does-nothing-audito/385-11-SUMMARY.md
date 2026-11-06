---
phase: 385
plan: 11
subsystem: hooks
tags: [cleanup, hooks, telemetry]
requirements-completed: [CLEAN385-04]
key-files:
  modified: [hooks/hooks.json, tests/test-385-hook-unwire.cjs, tests/test-261029-qef-hook-timeouts.cjs, tests/test-121-03-scaffold.sh, docs/TELEMETRY-SCHEMA.md, docs/COMPONENT-INVENTORY.md]
completed: 2026-11-06
---

# Phase 385 Plan 11: Unwire the SlashCommand command-invocation telemetry hook Summary

The PostToolUse group with the matcher `SlashCommand` is gone from hooks/hooks.json. scripts/telemetry-command-invocation.cjs and the `command_invocation` event type in lib/core/telemetry/schema.cjs are byte-unchanged. The owner decided not to rebuild telemetry on UserPromptExpansion; docs/TELEMETRY-SCHEMA.md now says so as an open option.

## Commit

- 33c004d2a chore(385-11): unwire the SlashCommand command-invocation telemetry hook (host sets no CLAUDE_TOOL_COMMAND) (6 paths).
- Revert note: `git revert 33c004d2a` restores the entry and the old test shape in one step. The script and the schema were never edited (`git diff HEAD~1 HEAD` on both is empty).

## Proof (re-run at HEAD 7f9a0c313)

- The script reads only `CLAUDE_TOOL_COMMAND` (line 52) and skips unless it starts with `/mos:` (PROVEN by code). `git grep CLAUDE_TOOL_COMMAND` finds the script, docs/TELEMETRY-SCHEMA.md line 222 and the script test; no production file sets it (PROVEN).
- The RCA .planning/debug/telemetry-command-invocation-env-var-never-set.md (plan 386-17, status resolved-handed-off) hands this change and the TELEMETRY-SCHEMA line edit to 385-11 and records that the official hooks docs list no SlashCommand tool and no CLAUDE_TOOL_COMMAND variable (PROVEN, file read). My own docs fetch: UNVERIFIED (WebFetch not available to this agent).
- Counts only (Canon Part 8): `cat ~/.mindrian/telemetry/v1.13/*.jsonl | grep -c command_invocation` prints 0 out of 22,697 events (the planner saw 22,555; the file set grew) (PROVEN).
- Characterization (new test): the live payload with no CLAUDE_TOOL_COMMAND gives exit 0, empty stdout and no file under HOME. Positive control: with CLAUDE_TOOL_COMMAND=/mos:scout the script still writes a file under `.mindrian/telemetry` (PROVEN).

## RED evidence

```
ok   telemetry-command-invocation with the live payload and no CLAUDE_TOOL_COMMAND gives no stdout and writes no file
ok   control: telemetry-command-invocation with CLAUDE_TOOL_COMMAND=/mos:scout still writes a telemetry file
FAIL no PostToolUse command runs telemetry-command-invocation.cjs and no PostToolUse group has the matcher SlashCommand: 1 PostToolUse command(s) still run telemetry-command-invocation.cjs
exit 1   (exactly one FAIL)
```

## Census (relative, static)

- BEFORE: total 44, PostToolUse 11, PostToolUse:SlashCommand 1. AFTER: total 43, PostToolUse 10, PostToolUse:SlashCommand 0. Equal for every other key (Read 1, Write 8, Stop 6, SessionStart 9, UserPromptSubmit 8).

## Baselines and verify

- Baselines before the edit: test-121-03-command-invocation-hook rc 0, test-121-04-canon-part-8-audit rc 0, test-261029-qef-hook-timeouts rc 0, check-hook-schema-compatibility rc 0, test-198-adapter-budget rc 0, minto census rc 0. run-all-121 rc 1 (known: scaffold tests 01, 03, 04; Gate 5 mva-option-router and SessionStart 4-vs-9 failures). run-all-179 rc 1 (leg 179-08 only) and run-all-198 rc 0 (18 passed) reused from plan 385-10.
- After the change: all rc 0 as above (plus test-hmi-poll-hook, test-jtbd-hook-integration, query-efficiency test). `bash tests/run-all-198.sh` rc 0, Passed 18. `bash tests/run-all-179.sh` rc 1, Passed 11 Failed 1, only leg 179-08, FAIL lines identical. `bash tests/run-all-121.sh` rc 1 with FAIL lines identical to the baseline (the scaffold-03 failure moved off the telemetry check; it still stops at the stale SessionStart count line, as the plan expected).
- connector-registry, orchestration-projection, harness-manifest checks: OK. Never-touch guard: 0. HEAD holds exactly the 6 expected paths.
- Not run, by coordinator ruling: run-all-3696, doctor per plan (one doctor run at the end).

## Deviations

None. scripts/telemetry-command-invocation.cjs now has no caller except tests; it joins the test-only list for the owner (385-PROOF.md R10 item e). Not deleted.
