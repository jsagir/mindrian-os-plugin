---
quick_id: 261109-mg2
date: 2026-11-09
status: done
merge_commit: 688cfb7c5
dates_commit: 1fc1701c1
---

# Quick 261109-mg2 Summary

Local main and origin/main c466d7080 are joined by merge commit 688cfb7c5 (parents 99a9c6414 and c466d7080). A second commit, 1fc1701c1, dates the Phase 389 retirement to beta.85. Nothing was pushed, tagged, bumped by hand or released.

## Origin delta (corrected)

git diff dfcf8d39d origin/main (merge base dfcf8d39d) holds 4 files: .claude-plugin/plugin.json, package.json, npm-shrinkwrap.json and CHANGELOG.md. The two commits are e956fc432 (release beta.83) and c466d7080 (bump to beta.84 placeholder). The release did not regenerate the data files or evals. The range 426f473f1..origin/main is not valid for this check, because 426f473f1 is a merge commit and the range reverses Phase 389.

## Merge resolution

| File | Resolution |
|------|------------|
| plugin.json, package.json, npm-shrinkwrap.json | Origin, exact (2.0.0-beta.84). Git diff against origin/main is empty for all three. |
| CHANGELOG.md | No textual conflict, but git placed the Phase 389 lines inside origin's [2.0.0-beta.83] section (the old merge base had them under the old Unreleased header). That was wrong. Fixed by hand: origin's [2.0.0-beta.83] section is back byte for byte; the Phase 389 Added, Changed and Removed lines are under [Unreleased] -- v2.0.0-beta.84 (in progress), in place of origin's empty bullet. No header was invented. |
| STATE.md, ROADMAP.md | Not in the origin delta. No edit needed. |

The CHANGELOG fix was staged and folded into the merge commit with an amend (local only, not pushed).

## Release-number dates (commit 1fc1701c1)

- data/command-deprecations.json: /mos:mva-option retired_in 2.0.0-beta.83 changed to 2.0.0-beta.85.
- commands/mva-brief.md, commands/mva-report.md, skills/mva-brief/SKILL.md, skills/mva-report/SKILL.md: deprecated_removal and the removal text changed from v2.0.0-beta.84 to v2.0.0-beta.86.
- tests/test-389-retire-option.cjs: Test 3 pin changed to 2.0.0-beta.85. It failed first (red, got 2.0.0-beta.83), then passed.
- Regenerated: data/command-registry.json (teaching text echoes the date), data/harness-manifest.json (digests the stub files), and the workspace-mod asset copies with ui/mindrian-workspace-mod/scripts/sync-assets.cjs. The sync also copied pre-existing drift in assets/framework-names.json and the doctor and eureka-portfolio rows in assets/command-registry.json. Before the sync, tests/test-369.26-registry-sync.cjs was red at HEAD for that reason. It is green now (8 passed).
- No deprecation entry was added for /mos:mva-brief and /mos:mva-report. Both commands are still in the registry as stubs. The drift check fails an entry for a command that is back in the registry ("STALE deprecation entry"). The entries are due in the release that removes the stubs (CLOSEOUT section 5, item 8: retired_in then will be the removal release, 2.0.0-beta.86).
- Not changed on purpose: tests/fixtures/341-registry-drift-baseline.json (snapshot of the previous release, still true until the stubs leave), the four stub rows in tests/fixtures/267/shape-violations-baseline.txt, and the synthetic stub strings with v2.0.0-beta.84 inside tests/test-389-retire-brief.cjs and tests/test-389-session-report.cjs (no test pins them to the real stubs; the stub checks only match a version pattern).
- The pre-commit hook ran and passed. No --no-verify.

## Verification (env -u MINDRIAN_EUREKA_ROOT, scratch HOME, MINDRIAN_BRAIN_URL=http://127.0.0.1:9)

| Check | Result |
|-------|--------|
| run-all-389 | PASS=16 FAIL=0 (the run in quick mrg had 2 reds; quick t89 fixed them) |
| run-all-374 | PASS=20 FAIL=0 SKIPPED=1 |
| run-all-370 | PASS=14 FAIL=0 |
| run-all-391 | PASS=10 FAIL=0 |
| run-all-265 | PASS=26 FAIL=0 |
| run-all-267 | PASS=31 FAIL=2 SKIP=1 (known: CIRS gates check c, expected 35 descriptors got 63; 354 concurrency) |
| tests named in the origin CHANGELOG (intent-classifier query count, reach-reader load order, mos-status-renderer, ekl status-active-room, run-all-261108-ekl) | PASS 5, 3, 12, 13, and ekl PASSED=5 FAILED=0 |
| skill mirrors, connector registry, orchestration projection, render coverage, command registry, harness manifest --check | OK (the last two after regeneration) |
| registry drift --check | exit 0; mva-option retired_in 2.0.0-beta.85; session-report added |
| sync-assets --check | all equal |
| irreversibility ledger --check | WARN 24, exit 0 (same as before; warnings: REMOVED /mos:query and ANSWER_KEY_DRIFT) |
| doctor capability-ledger module | ok (installed 2.1.321 within 0 patch versions of ledger_covers.to 2.1.321) |
| face-commands --check | 3 WHY drift warnings, 0 problems (same as before) |
| research-shape ledger, floor ledger --check | OK |
| non-ASCII on added lines outside .planning | 0 |

## Known red caused by the merge

- data/section-command-ledger.json: `build-section-command-ledger.cjs --check` now says FAILED (plugin_version drift: ledger=2.0.0-beta.82, repo=2.0.0-beta.84). Cause: the version files now read beta.84, and the origin release did not rebuild the ledger. It is a Jev-scored file, rebuilt at a cut. It was OK before this merge. The rebuild was not run here. Rule from quick mrg for the rebuild: take the origin rebuild, then remove the /mos:mva-option row and re-run --check.

## Not run

run-all-366 (the main session runs it). The Jev rescore of the irreversibility ledger. dist --check-stale.

## Next

The cut that carries this work should rebuild data/section-command-ledger.json. The cut should then ship as v2.0.0-beta.85 if releases keep stepping by 2 (the in-repo number is 84 now).
