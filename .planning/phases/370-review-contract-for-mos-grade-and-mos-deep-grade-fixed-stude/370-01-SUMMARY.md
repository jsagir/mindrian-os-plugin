---
phase: 370-review-contract-for-mos-grade-and-mos-deep-grade-fixed-stude
plan: 01
subsystem: testing
tags: [review-contract, tdd-red, fixtures, denylist-from-disk, grade, deep-grade]
requires: []
provides:
  - tests/run-all-370.sh (glob aggregator, found-equals-0 guard, no-dash fence)
  - tests/helpers/review-contract-370.cjs (shared helper, review builders, reporter)
  - tests/fixtures/370/ (pre-fix, post-fix, source-student; pseudonym only)
  - four RED test files that fix the behavior of lib/core/review-contract.cjs
affects: [370-02, 370-03, 370-04, 370-05, 370-06, 370-07, 370-08, 370-09, 370-10, 370-11]
tech-stack:
  added: []
  patterns: [plain node scripts with counters, bash glob runner, contractWith clone for limit/pattern/policy arms]
key-files:
  created:
    - tests/run-all-370.sh
    - tests/helpers/review-contract-370.cjs
    - tests/fixtures/370/pre-fix.md
    - tests/fixtures/370/post-fix.md
    - tests/fixtures/370/source-student.md
    - tests/test-370-contract-schema.cjs
    - tests/test-370-denylist-from-disk.cjs
    - tests/test-370-check-rules.cjs
    - tests/test-370-fixtures.cjs
  modified: []
key-decisions:
  - "Tests use contractWith (a deep clone) for every limit, pattern and policy arm; nothing writes to data/review-contract.json."
  - "S7 classifies every NEVER_SAY_TERMS entry as covered, generated or chat-only with a reason; a new entry fails the arm until classified."
  - "R13 timing arm uses a 60000-letter run and a 200000-character body; it catches a quadratic path regex (found in the scratch reference)."
requirements-completed: [REV370-01, REV370-02, REV370-03, REV370-04]
duration: about 1 hour
completed: 2026-11-08
---

# Phase 370 Plan 01: Tests RED first Summary

Four RED test files, a glob runner with a proven found-equals-0 guard, a shared helper and three pseudonym fixtures now fix the behavior of the review contract module before it exists.

## Tasks and commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Runner, helper, three fixtures | 9d82bb1bd | tests/run-all-370.sh, tests/helpers/review-contract-370.cjs, tests/fixtures/370/{pre-fix,post-fix,source-student}.md |
| 2 | Schema and denylist-from-disk tests (RED) | b33e5139d | tests/test-370-contract-schema.cjs, tests/test-370-denylist-from-disk.cjs |
| 3 | Check-rules and fixtures tests (RED) | 65e7de637 | tests/test-370-check-rules.cjs, tests/test-370-fixtures.cjs |

All three commits list only tests/ paths. No product file changed. No push, tag or release.

## What each file fixes

- Schema test (S1 to S9): contract keys, six exact section headings, counts, forbidden heading and pattern shape, internal_terms and soft_terms shape, limits guard (numeric limit needs `limits_source` starting "370-DECISION.md O2"), NEVER_SAY_TERMS drift, no dash characters, and S9: no hand-kept internal_terms term equals a live agent name, command or tool id. S9 holds two self-check clones (an agent name, an upper-case command with a slash) that must trip the detector. The test source holds no count of hand-kept terms.
- Denylist test (D1 to D7): temp repos make the list grow and shrink; counts match disk on the real repo; single-word agent names add only the Title form; the module source holds no quoted agent name, no count literal, and no brain require.
- Rules test (R0 to R16): tier hits with line numbers, frontmatter handles allowed, fenced terms flagged, normalization, false-positive guards, shape rules, counts, limits, forbidden patterns, soft-term policies, dash rule, no-echo, timing, classification, split, collectSourceText.
- Fixtures test (F1 to F5): pre-fix fails with the expected rule pairs, post-fix passes with and without source text, pseudonym guard.

## RED output (right reason: the module and data file do not exist)

```
FAIL test-370-check-rules: cannot load lib/core/review-contract.cjs (review-contract module missing; plan 370-02 creates it): Cannot find module '.../lib/core/review-contract.cjs'
>>> test-370-check-rules.cjs: FAILED
FAIL test-370-contract-schema: cannot read data/review-contract.json (review-contract data file): data/review-contract.json does not exist yet ...
>>> test-370-contract-schema.cjs: FAILED
FAIL test-370-denylist-from-disk: cannot load lib/core/review-contract.cjs (review-contract module missing; ...)
>>> test-370-denylist-from-disk.cjs: FAILED
FAIL test-370-fixtures: cannot load lib/core/review-contract.cjs (review-contract module missing; ...)
>>> test-370-fixtures.cjs: FAILED
discovered 4 test file(s) under tests/test-370-*
>>> skill mirrors drift --check: PASSED
>>> 370 no-dash fence: PASSED   (missing targets listed as MISSING, skipped without TEST_370_REQUIRE_ALL=1)
Phase 370: PASS=2 FAIL=4 SKIP=0     (exit 1)
```

No SyntaxError. Four FAILED lines.

## Found-equals-0 guard (proved)

`TEST_370_PREFIX=tests/test-370-nonexistent- bash tests/run-all-370.sh` printed `!!! no tests/test-370-nonexistent-* files discovered` and exited 1.

## Proof that the tests can turn GREEN

The tests have a scratch reference module and contract file outside the repo (in the session scratchpad, not committed). Against it: schema 9 of 9, denylist 8 of 8, rules 17 of 17, fixtures 5 of 5. This proof found two findings that now stand in the record:

1. A path regex of the form `[\w-]+\.cjs\b` takes 5.5 s on the R13 input (quadratic). A start guard `(?<![\w-])` makes it linear. Plan 370-02 must avoid unguarded run regexes.
2. The first draft of arm R15 expected the title on the first body line. The first body line is the blank line after the closing fence. The arm was fixed before commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] R15 title expectation** found while proving the tests against the scratch reference. Fixed in the same task before commit (commit 65e7de637 holds the fixed file).

**2. [Rule 3 - Blocking] Pre-commit worktree branch guard.** This directory is a linked worktree (`.git` is a file) whose branch is `main` by design (the release worktree named in the task). The generic worktree-agent branch rule does not fit it, and the caller ordered commits on main in this tree. Commits went to `main` with `git commit --only` on exact paths. No protected ref was rewritten.

Other additions beyond the plan text (in scope of the tests): arm R0 (CONTRACT_VERSION, loadContract throws `REVIEW_CONTRACT_INVALID`, a valid review passes), a 3-bullets-under-the-advanced-note case in R7, fence and sub-heading cases in R6, a second self-check in S9.

## Known Stubs

None. The tests are intentionally RED until plan 370-02.

## Threat Flags

None. No network, no Brain call, no new file access outside temp directories.

## Notes for plan 370-02

- The tests assume `soft_terms.terms` is an array of strings and `internal_terms` entries have `term`, `pattern`, `flags`, `why`.
- `collectSourceText` is assumed to return a string.
- Violation keys must be exactly `rule, tier, class, line` (R12). Soft-term violations use `rule internal_name`, `tier S`, `class soft_term`.
- Section ids assumed by the reference (not asserted by the tests except `executive_summary` under `counts.revision_points.under` and `strategic_challenge` for `cross_domain_under`).
- The runner fence skips missing targets until plan 370-11 sets `TEST_370_REQUIRE_ALL=1`.

## Self-Check: PASSED

Files exist: the nine files above. Commits exist: 9d82bb1bd, b33e5139d, 65e7de637.
