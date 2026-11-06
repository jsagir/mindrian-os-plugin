---
phase: 385
plan: 07
subsystem: dead-code
tags: [cleanup, release-scripts]
requirements-completed: [CLEAN385-01]
key-files:
  created: [tests/test-385-release-beta-preflight-removed.cjs]
  deleted: [scripts/release-beta-preflight.sh]
completed: 2026-11-06
---

# Phase 385 Plan 07: Remove the unused scripts/release-beta-preflight.sh Summary

The 69-line Phase 89.6 pre-tag tripwire that no release path calls is gone. scripts/release.sh and scripts/verify-release are untouched.

## Commit

- f3038bf74 chore(385-07): remove unused scripts/release-beta-preflight.sh (2 paths).
- Revert note: `git revert f3038bf74` restores the script with its executable mode. No other file depends on it.

## Caller proof re-run (HEAD 744fc7498)

- Only hit outside .planning and CHANGELOG: the script's own header (line 3).
- 0 hits in scripts/release.sh, scripts/verify-release, .github, package.json.
- One difference from the planner's item 3: the grep found `tests/test-379.1.1-ledger-release-step.cjs:297`, an `endsWith('.sh')` walk. It reads `scripts/release-lib` (line 296), not `scripts/`, so it never lists this script. Not a caller.

## Judgement call (for the owner)

The script is a safety tripwire that was never wired (refuse a tag when plugin.json is not `-beta.N` or differs from package.json). It was removed because the PRD authorises removal of a script with no caller and a revert restores it in one step.

## RED evidence

```
FAIL scripts/release-beta-preflight.sh is not tracked: scripts/release-beta-preflight.sh is still tracked
FAIL no tracked file outside .planning and CHANGELOG.md names release-beta-preflight: release-beta-preflight named in: scripts/release-beta-preflight.sh
ok   scripts/release.sh and scripts/verify-release stay tracked
exit 1
```

## Verify after the change

- New test: 3/3 ok.
- connector-registry, orchestration-projection, harness-manifest checks: OK.
- HEAD holds exactly the 2 expected paths. Never-touch guard: 0.
- doctor and run-all suites: deferred to one run at the end of Wave 1.

## Deviations

None.
