---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "17"
subsystem: telemetry
tags: [rca, hook-contract, telemetry, b15]
requires: []
provides:
  - Host-contract RCA for B15 with the anchored line verdict: NO SIGNAL
affects: [385-11]
tech-stack:
  added: []
  patterns: [host contract checked against the official docs before any change]
key-files:
  created: []
  modified:
    - .planning/debug/telemetry-command-invocation-env-var-never-set.md
key-decisions:
  - "Verdict NO SIGNAL: the hook is dead; handed to Phase 385 plan 385-11 (unwire). No product change."
requirements-completed: [B15]
duration: 15min
completed: 2026-11-06
---

# Phase 386 Plan 17: B15 Command-Invocation Telemetry Summary

The host-contract check shows the SlashCommand telemetry hook has no signal. The RCA holds `verdict: NO SIGNAL` and hands the hook to Phase 385 plan 385-11. No product file changed.

## Accomplishments

- Read the official hooks and tools references (code.claude.com, fetched 2026-11-06). PROVEN: no SlashCommand tool is listed, no CLAUDE_TOOL_COMMAND, CLAUDE_TOOL_OUTCOME or CLAUDE_TOOL_DURATION_MS variable is documented, and PostToolUse input arrives on stdin (tool_name, tool_input, tool_response, duration_ms).
- PROVEN: a typed slash command fires the UserPromptExpansion event (command_name) and a model call uses the Skill tool. The hook uses neither.
- PROVEN by run (synthetic HOME in the scratchpad): stdin with /mos:example and no variable gives 0 files and `skipped`. The variable set by hand gives 1 file.
- Setters in the product: 0 (only the test file sets them for a child process).
- Phase 385 state at run time: hooks/hooks.json still holds the SlashCommand entry and plan 385-11 has no SUMMARY yet. The target was not removed, so the skip rule for removal did not apply. The NO SIGNAL path of this plan applies.

## Task Commits

1. Task 1, host-contract RCA and verdict: 717ae8343
2. Task 2 (failing test): skipped, verdict NO SIGNAL. No test file created.
3. Task 3 (fix): skipped, verdict NO SIGNAL. Hand-off to Phase 385 item 4 recorded here and in the RCA.

## Deviations from Plan

None.

## Notes for the owner

- A repair would need a new wiring (UserPromptExpansion for typed commands, a Skill matcher for model calls). That is new behaviour and reverses Phase 385 item 4. Recorded in the RCA as an option, not planned. UNVERIFIED on a live host.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED
