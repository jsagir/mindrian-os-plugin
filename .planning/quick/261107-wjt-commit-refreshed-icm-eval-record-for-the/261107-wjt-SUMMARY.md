---
quick: 261107-wjt
completed: 2026-11-07
---

# Quick 261107-wjt Summary

Committed the refreshed ICM ruling eval record (plugin 2.0.0-beta.80) so the release gate icm-ruling-eval-fresh finds a current record.

## Result

- plugin_version: 2.0.0-beta.80 (was beta.78)
- run_at: 2026-11-07T21:25:15.803Z
- code checks: 22/22
- jev checks: 2/8 pass (6 abstain below the 0.5 confidence floor, as in the earlier record)
- agreement: 1.0 (floor 0.8)
- jev model: jev-1.14.0
- Diff: evals/icm/last-run.json 38 lines changed, evals/icm/last-run.html 1 line changed. Only run values changed.

## Disclosure

The eval run was started by accident while checking for a --help flag. The script has no such flag, so it ran the full eval. It used the dev-time TypeSafe key. It sent structural fields from the fixture rooms (never a real room) to the paid vendor, as the documented eval does. The result is a normal valid output of the documented procedure. It is kept because the release gate icm-ruling-eval-fresh needs it.

## Verification

- `git status --short` showed only the two eval files modified among tracked files (before the STATE.md row).
- `node tests/test-353-grader-agreement.cjs`: PASS=41 FAIL=0, zero network calls.
- No em-dashes added in the diff of the eval files.
- The eval script was not run again.

## Deviations from Plan

None.
