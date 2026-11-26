---
quick_id: 261126-ter
type: quick
completed: 2026-11-26
branch: fix/400.4-release-gate-tests
commits: [75df94618, d8d9586f1]
files_modified: [tests/test-400.4-card-descriptions.cjs, tests/test-374-engine-busy.cjs]
---

# Quick 261126-ter: Phase 400.4 release-gate test fixes

Two test-only edits remove the two run-all-366 failures that Phase 400.4 caused on main.

## Task 1: dash characters in the card-descriptions test (75df94618)

- Root cause: line 70 of `tests/test-400.4-card-descriptions.cjs` held literal U+2013 and U+2014 characters inside the regex. Test 6 of `tests/test-389-renames.cjs` bans those characters in every file.
- Fix: the regex is now `/[0-9–—]/`. The assertion matches the same characters. The file holds no dash character.
- Proof: `grep -cP "[\x{2013}\x{2014}]"` prints 0. The card test prints PASSED=5 FAILED=0. Test 389 prints 43 passed, 0 failed, including Test 6.

## Task 2: test-270 budget line in test-374 B9 (d8d9586f1)

- Root cause: Phase 400.4 plans 03 (context_assemble cortex_k parameter and description sentence), 05 (whitespace_scan description sentence) and 06 (eureka_graph_project description sentence) grew the tool descriptions. The pinned budget line was stale.
- The job-tool fingerprint assert in B9 passed before the change, so only the budget line differed. The five job tools are unchanged.
- Old line: 37764 desc bytes, 47835 schema bytes, 85599 total, about 21400 tokens.
- New line: `budget: 76 tools, 38236 desc bytes, 48014 schema bytes, 86250 total, ~21563 approx tokens (router 9 / atomic 67)`.
- A comment in the test names plans 03, 05, 06 and the three tools.
- Proof: `node tests/test-374-engine-busy.cjs` exits 0 and B9 prints ok.

## Run-all-366

See the final report for the result of `bash tests/run-all-366.sh` (recorded in the report that accompanies this file).

## Deviations from Plan

None. `npm ci --ignore-scripts` was run first because node_modules was missing.

## Known Stubs

None.
