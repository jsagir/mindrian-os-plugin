---
phase: quick-260916-ef1
plan: 01
subsystem: docs
tags: [readme, version-badge, brain-corpus-figures, fact-correction]
dependency-graph:
  requires: []
  provides: ["README.md badge and Brain corpus figures reconciled with shipped v2.0.0-beta.41"]
  affects: ["README.md"]
tech-stack:
  added: []
  patterns: ["fact-correction-only diff discipline (numerals-only, no reword)"]
key-files:
  created: []
  modified: ["README.md"]
decisions:
  - "Badge intentionally tracks the SHIPPED release (2.0.0-beta.41), not the in-progress working tree (2.0.0-beta.42), because the badge links to CHANGELOG.md and beta.42 has no released CHANGELOG entry yet."
  - "Did not add the relationship count (39,737) or the problem-type-coverage nuance (86 frameworks) to README.md; neither figure exists in the file today and adding either would be a rewrite, not a fact correction."
  - "Never wrote 'Theo' in README copy; kept 'the Brain' throughout, per repo doctrine."
metrics:
  duration: "~10 minutes"
  completed: "2026-09-16"
---

# Quick Task 260916-ef1: Reconcile README.md version badge + Brain corpus figures Summary

Corrected four stale numerals in README.md: the version badge (beta.1 -> beta.41) and three occurrences of the Brain's node/framework counts (28,325/181 -> 27,951/452), with zero collateral rewording.

## What Was Built

Four numeral-only edits to `README.md`, one per site named in the plan:

1. **Line 13 (version badge).** `version-2.0.0--beta.1-1E3A6E` -> `version-2.0.0--beta.41-1E3A6E`, preserving the shields.io double-hyphen escaping, the CHANGELOG.md link, and the `1E3A6E` color token.
2. **Line 35 ("The loop, in 30 seconds", step 2).** `28,325 nodes and 181 frameworks` -> `27,951 nodes and 452 frameworks`.
3. **Line 79 ("What talking to Larry feels like").** `knows 181 frameworks` -> `knows 452 frameworks`. This was the third occurrence, not named in the original task description; the plan flagged it and it is now corrected.
4. **Line 98 ("The three layers" table, Brain row).** `28,325 nodes, 181 frameworks` -> `27,951 nodes, 452 frameworks`.

No section was added, removed, reordered, or reworded. `git diff --numstat README.md` reports exactly 4 changed lines, matching the plan's success criteria precisely.

## Sweep Findings (Task 2)

- **Residual stale figures:** Zero hits for `28,325`, `181`, and the old `version-2.0.0--beta.1-` badge string after the four edits.
- **Other version/semver strings sweep (Step 2):** Grepped the whole file for `beta\.[0-9]+|[0-9]+\.[0-9]+\.[0-9]+`. Exactly one site surfaced: line 13, the badge itself (already corrected in Task 1). No second, previously-unnoticed version reference exists anywhere else in README.md, so no additional evaluation of "shipped release vs. Node floor/dependency range/URL" was needed.
- **Forbidden term (Theo):** `grep -ci theo README.md` returns 0. The word "Theo" does not appear in the file; the public copy continues to say "the Brain" exclusively.
- **Style gate (em-dash):** `grep -c '—' README.md` returns 0, unchanged from before this edit.
- **Diff discipline:** Read `git diff README.md` in full. All four hunks are numeral swaps inside otherwise byte-identical sentences/table cells. No trailing whitespace changes, no reflowed paragraphs, no moved rows.

## Decisions Recorded

- The badge is one release behind the working tree by design: it tracks `2.0.0-beta.41` (the shipped, tagged, CHANGELOG-documented release) rather than `2.0.0-beta.42` (the in-progress working-tree version with no released CHANGELOG entry). This is not a bug to "helpfully" fix forward.
- The live graph also holds 39,737 relationships and 86 frameworks with problem-type coverage, per planning research, but neither figure was added to README.md. Introducing new figures not already present in the file would be a rewrite of the document's scope, not a fact correction of existing sentences. The existing "honest refusal" section already carries the readiness nuance (4/4 vs 2/4); it does not need a duplicate home.

## Verification

All automated gates from the plan passed:

```
grep -c 'version-2\.0\.0--beta\.41-1E3A6E' README.md   -> 1
grep -c '27,951 nodes' README.md                        -> 2
grep -c '452 framework' README.md                       -> 3
grep -c '28,325' README.md                              -> 0
grep -c '181' README.md                                 -> 0
grep -c 'version-2\.0\.0--beta\.1-' README.md            -> 0
grep -ci theo README.md                                 -> 0
grep -c '—' README.md                                   -> 0
git diff --numstat README.md                            -> 4 4 README.md
```

## Deviations from Plan

None - plan executed exactly as written. The line 79 third occurrence was already flagged in the plan's own context section (not a deviation discovered mid-execution), and was corrected as instructed.

## Known Stubs

None.

## Threat Flags

None. This plan touches only existing prose numerals in a public README; no new network endpoint, auth path, file-access pattern, or schema change was introduced. The plan's own threat register (T-ef1-01 Theo-name disclosure, T-ef1-02 diff-scope tampering) was gated by the automated verifications above, both of which passed.

## Self-Check: PASSED

- FOUND: README.md (exists, 4 lines changed per `git diff --numstat`)
- FOUND: line 13 reads `version-2.0.0--beta.41-1E3A6E`
- FOUND: `27,951 nodes` at lines 35 and 98 (count = 2)
- FOUND: `452 framework` at lines 35, 79, 98 (count = 3)
- FOUND: zero residual `28,325`, `181` (frameworks-count sense), old badge string, `theo` (case-insensitive), em-dash
