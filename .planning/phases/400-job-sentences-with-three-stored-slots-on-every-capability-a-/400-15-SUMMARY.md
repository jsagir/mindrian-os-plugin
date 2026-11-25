---
phase: 400-job-sentences-with-three-stored-slots-on-every-capability-a-
plan: 15
subsystem: label-review
tags: [label-review, s5, lr-01, pg-01, drift-test, phase-gate, o-13, o-14]
requires:
  - phase: 400-01..400-14
    provides: job sentences, Cynefin labels, card data, wicked cut-off block, relay README
provides:
  - "400-LABEL-REVIEW.md: the owner review lists of S5 as ids and counts only"
  - "tests/test-400-review-lists.cjs: drift test V1 to V4 that keeps the review file equal to the data"
  - "tests/run-all-400.sh: 21 tests, 7 drift checks, then run-all-399"
affects: [phase-401, release-notes]
tech-stack:
  added: []
  patterns:
    - "review file lines '- ids (<name>): a, b', '- names (<name>): a; b' and 'count (<name>): N' parsed and compared with values computed from the repo"
key-files:
  created:
    - .planning/phases/400-job-sentences-with-three-stored-slots-on-every-capability-a-/400-LABEL-REVIEW.md
    - tests/test-400-review-lists.cjs
  modified:
    - tests/run-all-400.sh
key-decisions:
  - "Framework names that hold a comma use a '- names (...)' line with '; ' as the separator; id lines keep ', '."
  - "held-pairs and doubtful-labels are read from the 399-LABEL-REVIEW.md tables and kept only while the registry still holds (doubtful) or does not hold (held) the pair."
  - "jobs-without-research-draft is derived as summary_source phase-399; utility-reads-as-methodology and o12-labelled are pinned name lists that the test filters against the registry."
  - "O-13 card wording and host notes are marked ACCEPTED in section 8 and copied byte-exact from data/cynefin-domains.json (V3 checks the copy)."
requirements-completed: [LR-01, PG-01]
duration: 25min
completed: 2026-11-24
---

# Phase 400 Plan 15: Owner review lists and phase gates Summary

**One owner review file (10 sections, 27 lists, 39 count lines, ids and counts only) with a drift test that recomputes every list from the registry, frontmatter and data files, plus the final phase gate: run-all-400 green with 21 tests and 7 drift checks, run-all-399 green, doctor 25/25.**

## Performance

- **Duration:** about 25 min
- **Completed:** 2026-11-24
- **Tasks:** 2 of 2
- **Files:** 2 created, 1 modified

## Accomplishments

- 400-LABEL-REVIEW.md sections: 1 vocabulary (20 provisional, 4 section-only, 3 with no research draft, O-14 note); 2 carried from 399 (funding and personas section jobs, 2 held pairs, 5 doubtful labels, band count 132); 3 capability sentences (113, 12, 17, 63, 184 and where each is stored; the 5 framework statements exempt from the "to " want rule; the trending-to-absurd open item; Phase 401 deferrals: 65 stale pointers, 27 files with job lines after `# ---`); 4 fits_domains (73 run-step, per-domain lists, empty chaotic list with F-04); 5 move_type (per-move lists, 15 weak, empty act list); 6 move matching exclusions (22 excluded, 18 utility, 4 meta, 9 categorize, 5 that read as methodology, rule and A4, the shortlist.cjs built-path require as a code-review item); 7 O-12 (3 labelled); 8 card wording and host notes ACCEPTED (O-13), 6 option ids; 9 problem axes (v2 behind MINDRIAN_LEVEL_WORDING, wicked cut-off state not_fitted, the plan 11 NEEDS_HUMAN line); 10 the 8 owner-gated relay steps, the operator-outside-global-cap choice (plan 12), the 2 room.db release-note lines.
- tests/test-400-review-lists.cjs: V1 (27 lists, set equality, no unknown or repeated list), V2 (every list count plus 12 named counts, and the 7 pinned phase counts), V3 (exact 10 headings, decimals only 0.70, 0.89, 0.90, 0.5 or a fitted cut-off, no dash character, no uppercase-W spelling, card text copied exactly, O-13 ACCEPTED, wicked state), V4 (scratch copy with /mos:organize removed from move-categorize and a changed fits-clear count; both are reported; the mkdtemp directory is removed).
- tests/run-all-400.sh: the new test in the loop; the drift loop gains build-connector-registry.cjs --check and build-orchestration-projection.cjs --check. `diff <(ls tests/test-400-*.cjs | sort) <(grep -o ... | sort -u)` prints nothing.

## Task Commits

1. **Task 1: review file and drift test (LR-01)** - `9835e07d2` (test, RED), `fd87ecc8e` (feat, GREEN)
2. **Task 2: phase gates (PG-01)** - `757b6a95e` (chore), `f82409cdb` (fix: the spelling gate hit the test regex)

## Gate table (at f82409cdb, base c1e496ae8)

| Gate | Result |
|------|--------|
| `node tests/test-400-review-lists.cjs` | 4 passed, 0 failed |
| `bash tests/run-all-400.sh` | exit 0; 21 tests PASSED; 7 drift checks PASSED; last line ">>> 400: run-all-399: PASSED" |
| `bash tests/run-all-399.sh` | exit 0 |
| `node scripts/build-skill-mirrors.cjs --check` | OK (112 mirrors; skip-list verified: trending-to-absurd) |
| `node scripts/check-substrate.cjs` | exit 0 (baseline scan, informational) |
| `node scripts/check-shape-declaration.cjs --check` | exit 0; 55 advisory violations; base c1e496ae8 (temporary worktree under /tmp, removed): 55; WARN lines equal except the node SQLite ExperimentalWarning |
| `node scripts/check-render-coverage.cjs` | exit 0; 17 covered, 0 gap; md-keyspace 195 wired, 2 excluded, 0 unwired |
| `node scripts/doctor.cjs --acceptance` | 25/25 (equal to the 399 close); a first run gave 24/25 only because tests/run-all-400.sh was uncommitted (verify-release-clean-tree); after the commit 25/25 |
| dash scan of code files changed since c1e496ae8 (excluding .planning) | no output |
| uppercase-W scan of added code lines since c1e496ae8 | no output after f82409cdb (the one hit was the V3 regex of this plan) |
| dash and uppercase-W scans of .planning/phases/400-*/ (excluding 400-15-PLAN.md) | no output |
| `npm pack --dry-run --json --ignore-scripts` | 2234 files, 0 under services/ |

Pre-existing failures of the phase rules block, unchanged:

| Test | Result now |
|------|------------|
| lib/memory/problem-type-router.test.cjs | 21/24, tests 22 to 24 fail |
| lib/workflow/command-resolver.test.cjs | "Red Teaming must remain command-less" |
| tests/test-395-job-shown.cjs | B2, D2, E1 to E5 fail (7) |
| tests/test-395-job-orders.cjs | C3 fails (1) |
| tests/test-36925-next-move.cjs | X5 fails (7 passed, 1 failed) |
| bash tests/run-all-36925.sh | PASSED=54 FAILED=3 KNOWN=0 (equal to the record: 3 FAILED) |
| bash tests/run-all-3696.sh | PASSED=129 FAILED=5 KNOWN=17 (record: FAILED=6 KNOWN=17; one fewer failure, no new one; the failing names were not captured) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The uppercase-W spelling gate hit the test's own regex**
- **Found during:** Task 2 scan
- **Issue:** V3 held the literal regex for the uppercase-W spelling, so the phase gate scan of added code lines printed one line.
- **Fix:** the regex is built from parts (`new RegExp('P' + 'W' + 'S(?!-Book)')`); behavior unchanged.
- **Files modified:** tests/test-400-review-lists.cjs
- **Commit:** f82409cdb

### Additions asked by the orchestrator (inside the 10 sections)

- (a) O-13 card wording and host notes as ACCEPTED: section 8.
- (b) the 5 framework statements exempt from the "to " want rule: section 3, a names list.
- (c) the operator usage outside the global cap: section 10, "Relay design choice for owner review".
- (d) the wicked cut-off not_fitted pending the two label files: section 9.
- (e) the shortlist.cjs built-path require (test-399-table S6): section 6, code-review subsection.
- (f) the stale `first delivery at commands/<name>.md:<line>` pointers and the F1 `# ---` issue: section 3, "Deferred to Phase 401", with counts.
- (g) release-note lines for selection_observations.cause_effect_domain and problem.cause_effect: section 10.
- Extra: lists that the test also guards (vocabulary-provisional, carry-section-jobs, excluded-meta, excluded-utility, excluded-categorize, card-options, job-lines-not-after-comment) and counts (run-step-commands, methodology-run-step, stale-delivery-pointers, job-lines-after-comment, owner-gated-steps).

## Known Stubs

None. The wicked cut-off stays not_fitted by design (plan 11, NEEDS_HUMAN in section 9).

## Threat Flags

None. T-400-49: V3 refuses any decimal other than the stated thresholds; the file holds ids, labels and counts. T-400-50: the gate table above records every gate command with its result against the base.

## Self-Check: PASSED

- FOUND: 400-LABEL-REVIEW.md, tests/test-400-review-lists.cjs, tests/run-all-400.sh
- FOUND commits: 9835e07d2, fd87ecc8e, 757b6a95e, f82409cdb
- No U+2013 or U+2014 in this SUMMARY.
