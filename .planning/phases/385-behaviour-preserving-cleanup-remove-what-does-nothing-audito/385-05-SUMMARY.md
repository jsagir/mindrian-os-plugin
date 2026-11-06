---
phase: 385
plan: 05
subsystem: dead-code
tags: [cleanup, dead-module]
requirements-completed: [CLEAN385-01]
key-files:
  created: [tests/test-385-platform-gates-removed.cjs]
  modified: [docs/BACKEND-MAP.md]
  deleted: [lib/core/platform-gates.cjs]
completed: 2026-11-06
---

# Phase 385 Plan 05: Remove the dead module lib/core/platform-gates.cjs Summary

The 120-line platform-gate monitor that nothing loaded is gone, with its one documentation row. skills/context-engine/SKILL.md still tells the model to read `tengu_kairos` by itself and is untouched.

## Commit

- 633e41708 chore(385-05): remove dead module lib/core/platform-gates.cjs (3 paths).
- Revert note: `git revert 633e41708` restores the module and the row. No other file depends on it.

## Caller proof re-run (HEAD 4d45853a4)

Same as the planner's result, one difference: the docs/BACKEND-MAP.md row is at line 208 (earlier plans removed rows above it).
- 1 mention outside the module, .planning and CHANGELOG: the docs/BACKEND-MAP.md row (removed). 0 hits for isGateActive or getGateSummary elsewhere.
- skills/context-engine/SKILL.md lines 111 and 118 hold the `tengu_kairos` instruction.
- No loader walks lib/core (only lib/core/sensors and research-planner/perspectives are read by tests).
- READY-04 appears in no tracked file outside .planning.

Judgement call for the owner: the module was forward-looking (auto-activate a feature when a platform gate goes live). It was never wired. It was removed because the PRD authorises removal of a module with no caller, and a revert restores it in one step.

## RED evidence

```
FAIL lib/core/platform-gates.cjs is not tracked: lib/core/platform-gates.cjs is still tracked
FAIL no tracked file outside .planning and CHANGELOG.md names platform-gates, isGateActive or getGateSummary: platform-gates named in: docs/BACKEND-MAP.md, lib/core/platform-gates.cjs
ok   skills/context-engine/SKILL.md stays tracked and keeps tengu_kairos
exit 1
```

## Verify after the change

- New test: 3/3 ok.
- connector-registry, orchestration-projection, harness-manifest checks: OK.
- `git grep -c platform-gates -- docs/BACKEND-MAP.md`: 0 matches. HEAD holds exactly the 3 expected paths. Never-touch guard: 0.
- doctor: deferred to one run at the end of the remaining plans (long suites run once).

## Deviations

None.
