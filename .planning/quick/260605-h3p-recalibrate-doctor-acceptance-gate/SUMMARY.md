---
task: 260605-h3p-recalibrate-doctor-acceptance-gate
kind: quick
status: complete
date: 2026-06-05
subsystem: release-infra / doctor acceptance gate
commit: e518a321
files-modified:
  - scripts/doctor.cjs
  - tests/test-doctor-acceptance.cjs
files-unchanged-by-design:
  - scripts/verify-release
---

# Quick Task 260605-h3p: Recalibrate the Doctor Acceptance Gate Summary

Tier-moved the `verify-release` acceptance check from `['pre-tag', 'full']` to `['pre-tag']` so release.sh Step 9.8 (the post-publish full `--acceptance` run) stops false-failing on the expected dev-ahead working tree.

## What Was Wrong

release.sh Step 9.8 runs the full acceptance set AFTER Step 7.5 (Commit B) bumps the working tree to the next dev pre-release (beta.N+1), while the marketplace correctly stays at the published beta.N. The `verify-release` module shells out to `scripts/verify-release`, whose Check 3 is a STRICT `plugin == marketplace` equality. Post-Commit-B that compared `plugin=beta.N+1` vs `marketplace=beta.N`, so Step 9.8 aborted with the scary R.4-yank path even though npm + tag + marketplace were all correct. Confirmed live on the beta.8 cut: `verify-release` was the ONLY failing acceptance point (`plugin=1.13.1-beta.9 marketplace=1.13.1-beta.8`); the other 12 passed. The post-publish version state is already owned by the `version-of-record-published` module (git tag + marketplace `source.ref` + npm view, keyed off the last shipped tag, not the dev placeholder).

## What Changed

1. scripts/doctor.cjs -- `verify-release` module `applies_to` changed `['pre-tag', 'full']` -> `['pre-tag']`. Added a concise comment explaining why `full` is excluded (dev-ahead working tree post-Commit-B; post-publish version state owned by `version-of-record-published`) and referencing the precedent (the `verify-release-clean-tree` sibling tier-move, `tests/test-doctor-acceptance-preflight-checks.cjs:233`).
2. scripts/verify-release -- UNCHANGED. It remains the strict pre-release gate (release.sh Step 2 standalone + the `--pre-tag` acceptance tier). Verified via `git diff scripts/verify-release` (empty).
3. tests/test-doctor-acceptance.cjs acc.2 -- reconciled and kept meaningful. Now pins BOTH halves: (a) under `--pre-tag` the verify-release shim is spawned exactly once AND present in `points[]`; (b) under the post-publish FULL set verify-release is FILTERED OUT of `points[]` AND the shim is never spawned (counter stays empty), while `version-of-record-published` IS present (it owns post-publish version state). The full run stays hermetic: the sandbox HOME has no `~/mindrian-marketplace`, so `version-of-record-published` returns early before any `npm view`, and `npx-roundtrip` is short-circuited via `DOCTOR_TEST_FAIL_POINT`. Docstring header (acc.2) updated to match.

No full-set point-count assertion existed elsewhere in `tests/` to reconcile. The `fullOnlyIds` list in `test-doctor-acceptance-preflight-checks.cjs` (`version-of-record-published`, `npx-roundtrip`) is unaffected -- `verify-release` is pre-tag-only, not full-only. The preflight + self-coverage suites only run `--pre-tag`, where `verify-release` still applies, so their existing references stay correct.

## Verification

All three named suites exit 0:

    node tests/test-doctor-acceptance.cjs                  -> 6 passed, 0 failed (EXIT 0)
    node tests/test-doctor-acceptance-preflight-checks.cjs -> 8 passed, 0 failed (EXIT 0)
    node tests/test-doctor-acceptance-self-coverage.cjs    -> 6 passed, 0 failed (EXIT 0)

Grep confirmations:
- `verify-release` module `applies_to` is now `['pre-tag']` only.
- `version-of-record-published` still `applies_to: ['full']`.
- `git diff scripts/verify-release` is empty (file unchanged).
- No em-dashes in any added/changed line.

## Deviations from Plan

None -- executed exactly as specified in the RCA fix.

## Release Discipline

Code fix only. No version bump, no `release.sh` run, no push. Ships in the next beta cut.

## Self-Check: PASSED

- Commit `e518a321` exists on `main`.
- `scripts/doctor.cjs` and `tests/test-doctor-acceptance.cjs` modified and committed.
- `scripts/verify-release` confirmed unchanged.
- All three test suites green.
