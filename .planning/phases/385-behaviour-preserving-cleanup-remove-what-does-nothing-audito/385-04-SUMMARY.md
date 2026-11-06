---
phase: 385
plan: 04
subsystem: dead-code
tags: [cleanup, dead-module]
requirements-completed: [CLEAN385-01]
key-files:
  created: [tests/test-385-deep-links-removed.cjs]
  modified: [docs/BACKEND-MAP.md]
  deleted: [lib/core/deep-links.cjs]
completed: 2026-11-06
---

# Phase 385 Plan 04: Remove the dead module lib/core/deep-links.cjs Summary

The 82-line URL helper module that nothing loaded is gone, with its one documentation row. templates/constellation.html builds its own claude-cli:// links and is untouched.

## Commit

- aea41ed9f chore(385-04): remove dead module lib/core/deep-links.cjs (3 paths).
- Revert note: `git revert aea41ed9f` restores the module and the row. No other file depends on it.

## Caller proof re-run (HEAD 75c88cb2e)

Same as the planner's result, one difference: the docs/BACKEND-MAP.md row is at line 190 (plan 385-03 removed an earlier row).
- 1 mention outside the module, .planning and CHANGELOG: the docs/BACKEND-MAP.md row (removed).
- `claude-cli://` appears only in the module and templates/constellation.html.
- No loader walks lib/core (only lib/core/sensors and research-planner/perspectives are read by tests).

## RED evidence

```
FAIL lib/core/deep-links.cjs is not tracked: lib/core/deep-links.cjs is still tracked
FAIL no tracked file outside .planning and CHANGELOG.md names deep-links or generateDeepLink: deep-links named in: docs/BACKEND-MAP.md, lib/core/deep-links.cjs
ok   templates/constellation.html stays tracked and keeps its own claude-cli:// links
exit 1
```

## Verify after the change

- New test: 3/3 ok.
- connector-registry, orchestration-projection, harness-manifest checks: OK.
- `git grep -c deep-links -- docs/BACKEND-MAP.md`: 0 matches. HEAD holds exactly the 3 expected paths. Never-touch guard: 0.
- doctor: deferred to one run at the end of the remaining plans (long suites run once).

## Deviations

None.
