---
phase: 385
plan: 03
subsystem: dead-code
tags: [cleanup, dead-module]
requirements-completed: [CLEAN385-01]
key-files:
  created: [tests/test-385-asset-ops-removed.cjs]
  modified: [docs/BACKEND-MAP.md]
  deleted: [lib/core/asset-ops.cjs]
completed: 2026-11-06
---

# Phase 385 Plan 03: Remove the dead module lib/core/asset-ops.cjs Summary

The 151-line wrapper that nothing loaded is gone, with its one documentation row. The script it wrapped (scripts/file-asset) stays, and the cascade still calls it directly.

## Commit

- cd247d244 chore(385-03): remove dead module lib/core/asset-ops.cjs (3 paths).
- Revert note: `git revert cd247d244` restores the module and the row. No other file depends on it.

## Caller proof re-run (HEAD 28270c8fb)

Same as the planner's result, no difference:
- 1 mention outside .planning and CHANGELOG: docs/BACKEND-MAP.md:188 (removed).
- 0 other callers of getAssetsBySection, getAssetsByType, updateManifest.
- No loader walks lib/core (only lib/core/sensors and research-planner/perspectives are read by tests).
- lib/core/intelligence-cascade.cjs:682 runs scripts/file-asset directly.

## RED evidence

```
FAIL lib/core/asset-ops.cjs is not tracked: lib/core/asset-ops.cjs is still tracked
FAIL no tracked file outside .planning and CHANGELOG.md names asset-ops: asset-ops named in: docs/BACKEND-MAP.md
ok   scripts/file-asset stays tracked
exit 1
```

## Verify after the change

- New test: 3/3 ok.
- `orchestration-projection: OK`, `harness-manifest: OK`; connector-registry check exit 0 (chain continued).
- `git grep -c asset-ops -- docs/BACKEND-MAP.md`: 0. HEAD holds exactly the 3 expected paths. Never-touch guard: 0.
- doctor and run-all suites: deferred to one run at the end of Wave 1.

## Deviations

None.
