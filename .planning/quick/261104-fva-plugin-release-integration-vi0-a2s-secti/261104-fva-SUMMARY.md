# Quick 261104-fva Summary

Start SHA: a3a293c93d6b22bef1ecd24eb6566fe33007753f
Final tip of integration/release-next at the time of the last executor commit: 3824dedb6ab2934702b009ae82c09ee3e9340503 (the commit of this SUMMARY update comes after it)

## Commits (first-parent order)

| Commit | SHA | Tree | Parents |
|--------|-----|------|---------|
| Merge 1 vi0 | 86275459b12c714a4cdeeaa4de0dde9c8e17c0d1 | d444acbe3ba9e9a0f4b69d04903b02fefdd2c8b7 | a3a293c93, 11ad37af7 |
| Merge 2 a2s | 428b969b0b2c88075aa3079c9968ab0893d2cdf8 | 42d056f382773fae3493c61bf4db91c0992f6e36 | 86275459b, 233361b79 |
| Merge 3 section | 4c75a0d598bcc1f89ae71f6648d07d9bcac4f864 | c6d02fb2dc0cf4363bc373c36e2a0636714aeac7 | 428b969b0, 88aa00e04 |
| Test fix 353 | 4e108c65d4a5b05c1602b02eae775ffe47bd6cbf | not recorded | 4c75a0d59 |
| PLAN and SUMMARY | 822646d5c7f35e9dbf2fd29f06573b9ffd9d5033 | not recorded | 4e108c65d |
| Merge 4 phase 369.6 | bf915cfd3226b771e659fc6295731f539b67722c | 2fc2b4fb6d2a469bf225c299c4d92cc93d0fd87c | 822646d5c, dd2d89996 |
| Test fix a2s parity | 3824dedb6ab2934702b009ae82c09ee3e9340503 | not recorded | bf915cfd3 |

Merges 1 to 3 match the predicted trees of the plan. Merge 4 tree differs from the predicted 83eee2aa60859bd24df5f131c64dd6d103f4c02b by exactly one line, see "Manifest regeneration".

## Conflict notes

Merge 3:
- CHANGELOG.md: kept the integration side. Blob c2b1672275872f39f9cddbe9676b78c5493f873a. All 5 branch bullets are present exactly once. No entry lost, none added.
- .planning/STATE.md: kept both sides. The 261028-gmg row stands before the six 261029 rows. Blob c4e7e42be810b4f82ec030ed68a4d02b00e0277e. 1 line added, 0 deleted.
- Only these 2 paths conflicted.

Merge 4 (phase 369.6, tip dd2d89996, 87 commits over the integration tip): no conflict.

## Manifest regeneration (merge 4)

The pre-commit hook refused merge 4: data/harness-manifest.json was stale. Merge 3 changed lib/core/navigation-engine.cjs after the 369.6 branch had generated the manifest. With main session approval, the executor ran `node scripts/build-harness-manifest.cjs`. Only one line changed: the digest of the decide_engine surface, from b8541649c79cf32501d5373fe84a3a08004072d1fb0b8dd4c2a3ac7dd40371d1 to 1b3a9f596507a237c4c7d981a21ae0c82ac9b34fed2a7e2bc60a3cfa19b08431. No surface entry was added or removed. `--check` then reported OK. The merge 4 tree is 2fc2b4fb6d2a469bf225c299c4d92cc93d0fd87c (the plan predicted 83eee2aa60859bd24df5f131c64dd6d103f4c02b before the regeneration). The hook passed without --no-verify.

## Root causes of test failures

1. test-353-doctor-section-ruling (merge 3): main retired the doctor module install-incomplete in commit 85b5072f7 (341-09). The section branch test expected 30 modules. The merged registry holds 29, which is correct. Fix in 4e108c65d: line 222 now expects 29. data/doctor-modules.json untouched.
2. test-261030-a2s-classifier-parity (merge 4): commit cd1106dd3 (369.6-12) adds a voice reminder line to the classifier output on purpose. 14 of 16 cases differed. Fix in 3824dedb6: the parity env of both sides sets MINDRIAN_VOICE_REMINDER=0 (the off switch in lib/hmi/larry-identity.cjs line 102). No other change. test-3696-voice-reminder still passes (34), so the line stays on by default.

## Census test fix (after merge 4)

Commit 6f6a8a35c35f78cb11e39d854c316341629a53cc changes lib/memory/minto-debounce-consumer-census.test.cjs Test 1 only. Quick 261030-a2s moved the drain code from the bash wrapper scripts/intent-classifier into scripts/minto-drain-on-prompt.cjs, so the old structural assertion was stale. Test 1 now asserts that scripts/post-write (extensionless) is discovered, that the census classifies scripts/minto-drain-on-prompt.cjs as drain-and-act, and that scripts/intent-classifier.cjs requires it. Results: census 5/5, minto-debouncer 12/12, minto-migration-v88 6/0, minto-schema-v88 7/0, a2s parity 16 cases 0 diffs, a2s compile-cache 11/0. Product files untouched.

## CHANGELOG entries (after the census fix)

Commit dca7a87d7d3fa0815860f9d27eec6e64f77a6cba adds 8 lines to CHANGELOG.md [Unreleased]: a Changed bullet for quick 261030-a2s, a Fixed bullet for quick 261103-vi0, and a "Known issues" section with the three older test failures (userpromptsubmit-integration Test 8, session-start-triple-injection Test 6, test-346 catalogue schema leg) and the counts 126 passed, 0 failed, 25 known. The a2s quick has no SUMMARY file in this tree, so its numbers come from the a2s commit messages: 2 node starts to 1 (parity --node-starts) and loaded modules 307 to 219 on case C02. Saved time is stated as not measured. No em or en dash added. Tests that read CHANGELOG: test-359-prose-budget 18/0, test-250-doctrine-fence 6 pass, test-btm 6/0, test-341-retired-classes 16/0, test-341-update-collapsed 8/0, test-341-install-sh-retired 7/0, test-369.1-review-fixes 73/0, test-236-engines-floor 6/0, test-l9o 18/0, test-380-gate-wiring 37/0, test-capability-dial-committed exit 0. Three tests that mention CHANGELOG fail with and without this edit (checked on a clean archive of 301bbcb78): test-mux-card-before-answer S3 (PASS=18 FAIL=1), test-statusline-glyph-isolation, test-l8g-theo-bare A4 (6 passed, 1 failed). They are older than this cut and are not in the CHANGELOG list; add them to the follow-up quick list if they are not among the 25 known.

## Pre-existing failure (needs its own quick)

lib/memory/userpromptsubmit-integration.test.cjs Test 8 ("tier_0 fallback leaves Phase 83 intent classifier path intact", assertion "Phase 83 warning header present", line 533) fails on 822646d5c, before the 369.6 merge, so the 369.6 merge did not cause it. Test 3 of the same file is load sensitive (failed in some runs, passed in others).

## Test results

| Stage | Test | PASSED | FAILED | SKIPPED | Exit |
|-------|------|--------|--------|---------|------|
| Merge 1 | test-380-gate-wiring | 37 | 0 | 1 | 0 |
| Merge 2 | test-261030-a2s-classifier-parity | 16 | 0 | 0 | 0 |
| Merge 2 | test-261030-a2s-compile-cache | 11 | 0 | 0 | 0 |
| Merge 3 | test-353-room-section-jobs | 77 | 0 | 0 | 0 |
| Merge 3 | test-353-doctor-section-ruling | 48 | 1 | 0 | 1 (stale count, fixed) |
| Merge 3 | test-doctor-mcp-write-path | 27 | 0 | 0 | 0 |
| Merge 3 | test-261030-a2s-classifier-parity | 16 | 0 | 0 | 0 |
| Merge 3 | test-261030-a2s-compile-cache | 11 | 0 | 0 | 0 |
| Merge 3 | test-380-gate-wiring | 37 | 0 | 1 | 0 |
| After fix 353 | test-353-doctor-section-ruling | 49 | 0 | 0 | 0 |
| Merge 4 | test-3696-isolation | 70 | 0 | 0 | 0 |
| Merge 4 | test-3696-isolation-cache-skip | 9 | 0 | 0 | 0 |
| Merge 4 | test-3696-doctrine-presence | 23 | 0 | 0 | 0 |
| Merge 4 | test-3696-holds-by | 16 | 0 | 0 | 0 |
| Merge 4 | test-3696-identity-parity | 28 | 0 | 0 | 0 |
| Merge 4 | test-3696-voice-reminder | 34 | 0 | 0 | 0 |
| Merge 4 | test-261030-a2s-compile-cache | 11 | 0 | 0 | 0 |
| Merge 4 | test-380-gate-wiring | 37 | 0 | 1 | 0 |
| Merge 4 | test-353-doctor-section-ruling | 49 | 0 | 0 | 0 |
| Merge 4 | test-359-prose-budget | 18 | 0 | 0 | 0 |
| Merge 4 | test-261030-a2s-classifier-parity | 2 | 14 | 0 | 1 (voice line, fixed) |
| Merge 4 | userpromptsubmit-integration | 14 | 1 | 0 | 1 (Test 8, pre-existing) |
| After fix a2s | test-261030-a2s-classifier-parity | 16 | 0 | 0 | 0 |
| After fix a2s | test-3696-voice-reminder | 34 | 0 | 0 | 0 |

## Final tree checks (at 3824dedb6)

- Tracked tree clean.
- Files changed a3a293c93..3824dedb6: 214.
- CHANGELOG.md: 0 conflict markers; 0 added lines with an em or en dash across a3a293c93..HEAD.
- Message files msg3 to msg6 and the log were removed from the task directory.

## Notes

- No brand rule applies; no design decision made.
- Nothing was pushed, tagged or released. No stash, no reset, no --no-verify.

STATUS: DONE
CHANGED: 7 commits listed above; the two test edits were approved by the main session.
VERIFIED: all targeted tests pass except userpromptsubmit-integration Test 8 (pre-existing).
UNVERIFIED: no full suite run (not allowed in this plan).
RISKS: userpromptsubmit-integration Test 8 fails on the tip; the hook-time warnings about HITL shape declarations (skills/vault, skills/visualize) are advisory and came from the 369.6 side.
NEXT: The main session reviews the commits ahead of origin, then runs the heavy suite on the tip.
