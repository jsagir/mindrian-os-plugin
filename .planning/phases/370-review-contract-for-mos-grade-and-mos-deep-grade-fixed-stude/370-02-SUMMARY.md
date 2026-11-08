---
phase: 370-review-contract-for-mos-grade-and-mos-deep-grade-fixed-stude
plan: 02
subsystem: review-contract
tags: [review-contract, denylist-from-disk, grade, deep-grade, tdd-green]
requires: [370-01]
provides:
  - data/review-contract.json (the contract as data)
  - lib/core/review-contract.cjs (loadContract, buildDenylist, splitArtifact, isReviewArtifact, checkReview, collectSourceText, CONTRACT_VERSION, NEVER_SAY_TERMS re-export)
affects: [370-03, 370-04, 370-05, 370-06, 370-07, 370-08, 370-09, 370-10, 370-11]
key-files:
  created:
    - data/review-contract.json
    - lib/core/review-contract.cjs
  modified: []
key-decisions:
  - "Entries of internal_terms with class path_or_id (the four room file names) get tier H4, not E1, because arm R1 expects tier H4 for REASONING.md."
  - "Revision points count top-level list items only (indent up to 3 spaces); a nested sub-bullet is detail."
  - "cross_domain_under (not enabled today) treats the optional last note as allowed, so D-01 stays satisfiable when the owner sets it."
  - "Non-denylist violations use tier '-' and a short class (shape, count, limit, dash, a section id, or a forbidden id). The class never holds text from the review."
requirements-completed: [REV370-01, REV370-02, REV370-03, REV370-04]
completed: 2026-11-08
---

# Phase 370 Plan 02: Contract data and check module Summary

One pure module and one data file now decide pass or fail for a grade or deep-grade review body. The four plan 370-01 tests moved from RED to GREEN. Nothing is wired to a command, hook or door yet.

## Commits

| Commit | Files |
|--------|-------|
| e98c1a292 | data/review-contract.json, lib/core/review-contract.cjs |

The plan asked for one commit per task (data plus loader first, then checkReview). Both tasks were written in one pass, so they are one commit. No push, tag, release or dist change.

## What was built

- `data/review-contract.json`: six ordered sections, optional tail "For advanced students", seven forbidden heading patterns (each with a why), empty forbidden_body_patterns, counts (3 to 5 revision points, at most 2 cross-domain), `limits: {}` (no number invented, owner item O2 pending), 16 internal_terms each with a why, soft_terms policy `strict` with terms database and graph (owner item O3 pending). It holds no agent name, command or tool id.
- `lib/core/review-contract.cjs`: local files only, no network, no Brain require. The denylist is built from `agents/*.md`, `data/command-registry.json` and `data/mcp-tool-connectors.json` at every call, with a `repoRoot` parameter. The hand-kept generic regexes (the Agent suffix class, command prefix, mcp__ and brain_ prefixes, plugin paths, .cjs names) each carry a comment. Findings come from `findIdLeak` for run id, lane letter and verdict code only.
- ReDoS guard: every run regex has a start guard. The adversarial arm R13 (200000 characters with a 60000-letter run) takes about 23 ms. A 5000-line body takes about 19 ms.

## Verification (GREEN output, PROVEN)

```
test-370-check-rules.cjs      PASS: 17 FAIL: 0
test-370-contract-schema.cjs  PASS: 9  FAIL: 0
test-370-denylist-from-disk   PASS: 8  FAIL: 0
test-370-fixtures.cjs         PASS: 5  FAIL: 0
skill mirrors drift --check: PASSED
370 no-dash fence: PASSED   (scripts/check-review-contract.cjs MISSING and hook OPTIONAL: later plans)
Phase 370: PASS=6 FAIL=0 SKIP=0   (bash tests/run-all-370.sh, exit 0)
tests/test-3696-reply-checks.cjs      PASS: 143 FAIL: 0
tests/test-265-deep-grade-rubric.cjs  8 passed, 0 failed
```

Pre-fix fixture: ok false, 13 violations, no planted string in the result. Post-fix fixture: ok true, with and without source text. Non-comment lines holding `brain-client`: 0. Non-ASCII bytes in both files: 0 (checked with grep -P).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dash and zero-width escapes became raw characters.** The Write tool turned the `\u` escapes of INVISIBLE_RE, EM_DASH and EN_DASH into raw characters (the no-dash fence caught it). Rewritten with real `\u` escapes and re-checked: 0 non-ASCII bytes.

**2. [Rule 3 - Blocking] S7 needed a covering entry for "graph engine".** The NEVER_SAY_TERMS entry `graph engine` had no internal_terms entry. Added one (with a why) to the contract data. Not a test edit.

**3. Tier for room file names.** See key-decisions (tier H4 for class path_or_id).

**4. One commit instead of two.** See Commits.

Pre-commit worktree branch guard: this tree is a linked worktree on `main` by design (as in plan 370-01). Commit used `git commit --only` on exact paths.

## Notes for later plans

- `checkReview` returns `{ ok, violations, contract_version }`; keys of a violation are exactly rule, tier, class, line.
- `collectSourceText` skips dot-folders and `node_modules` as well, reads section folders only (not files at the room root), and reads at most 262144 bytes of one file as a per-file safety bound.
- `loadContract` throws `REVIEW_CONTRACT_INVALID` for a missing or null required key, for sections not equal to six items, and for a non-array internal_terms, optional_tail, forbidden_headings or forbidden_body_patterns.
- Soft terms: `strict` flags always; `exempt_if_in_source` skips a term the source text holds as a whole word; `compound_only` skips them (compounds are E1 entries); option `softTerms: 'skip'` skips them for any policy.
- The module exports `NEVER_SAY_TERMS` (re-exported from larry-reply-checks) as a drift reference.

## Known Stubs

None.

## Threat Flags

None. No network, no Brain call. File reads stay under the given repoRoot and roomDir. Symlinks are skipped in collectSourceText.

## Self-Check: PASSED

Files exist: data/review-contract.json, lib/core/review-contract.cjs. Commit exists: e98c1a292.
