---
phase: 356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-
plan: 05
subsystem: infra
tags: [answer-key, labeling, d-04, d-05, d-16]

# Dependency graph
requires: []
provides:
  - "scripts/irreversibility-answer-key.cjs: --label-sheet, --review-sheet, --merge over pure, exported functions"
  - "tests/test-356-label-sheet.cjs: unit, round-trip and CLI legs for the answer-key tooling"
affects: [356-06, 356-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-04 hybrid picking: keyword | not_autonomous_safe | external_verb | claude_prelabel_true, OR'd per command, why[] names every rule that fired"
    - "render-safe row shape: renderBlindSheet/renderReviewSheet only ever receive { command, teaching, jtbd_summary }, never autonomous_safe or why, so leakage is structurally impossible, not just grep-avoided"
    - "seal-then-reveal: prelabels_sha256 is checked byte-for-byte at --review-sheet and --merge time; any drift in the sealed file refuses loudly"

key-files:
  created:
    - "scripts/irreversibility-answer-key.cjs"
    - "tests/test-356-label-sheet.cjs"
  modified: []

key-decisions:
  - "Sealing-rule override (deviation from the plan's Task 2 text): the 'shipped leg' that would recompute the picked subset against the real, committed 356-CLAUDE-PRELABELS.json is deferred to 356-06 rather than gated on the prelabels file's own existence. My execution instructions state tests in this plan may use synthetic pre-label fixtures only; gating on the prelabels file (which already exists, sealed since 356-04) would have made that leg execute now and open the sealed rows. Gating is instead on the navigator's own committed reveal artifacts (356-BLIND-LABEL-SHEET.md / 356-PRELABEL-REVIEW-SHEET.md), which don't yet exist, so the leg prints PENDING today and activates once 356-06 lands, after the reveal has legitimately happened."
  - "sha256 hashing of the sealed pre-label file's raw bytes is not treated as 'opening' it (hashing is the seal mechanism itself, one-way and non-disclosing); the two shipped legs that DO run today only hash-compare committed sheets, never parse or branch on the sealed file's JSON rows."
  - "renderBlindSheet/renderReviewSheet take pre-filtered row shapes ({command, teaching, jtbd_summary}) rather than full registry rows, so the D-16 leakage guarantee (no autonomous_safe, no why, no Claude label on the blind sheet) is enforced by the function signature, not just by omission inside the render body."
  - "parseTable's header/footer meta uses a closed key allow-list (registry_hash, prelabels_sha256, rubric, blind_sheet_sha256, filled_by, filled_at) rather than a generic colon scan, so the instructions paragraph (which contains a colon) can never be misread as a meta line."

patterns-established:
  - "Pure-function core + thin CLI dispatch: every script/*.cjs behavior lives in an exported, directly-testable function; main() only parses argv and calls them, matching build-section-command-ledger.cjs's shape."

requirements-completed: [R356-02]

# Metrics
duration: 55min
completed: 2026-09-23
---

# Phase 356 Plan 05: Zero-Network Answer-Key Tooling Summary

**`scripts/irreversibility-answer-key.cjs` (three CLI modes over ten pure, exported functions) plus `tests/test-356-label-sheet.cjs` (96 checks), implementing the D-04 hybrid blind/review split and the D-05 answer-key merge with zero network code anywhere in the file.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2
- **Files modified:** 2 (both new)

## Accomplishments

- `scripts/irreversibility-answer-key.cjs` (669 lines): `sha256Hex`, `readRegistryRows`, `pickBlindSubset`, `renderBlindSheet`, `parseTable`, `parseBlindSheet`, `renderReviewSheet`, `parseReviewSheet`, `mergeAnswerKey`, `R1_DEFINITION`, `LABEL_SOURCES` all exported and unit-tested directly; `--label-sheet`, `--review-sheet`, `--merge` CLI modes dispatch to thin wrappers around the same pure functions.
- `pickBlindSubset` reads `chain-executor.cjs`'s frozen `IRREVERSIBLE_HINTS` via a lazy `require` inside the picking path only (confirmed: no top-level `lib/` require in the file), OR's it with `!autonomous_safe`, an external-verb regex over `teaching`/`jtbd_summary`, and Claude's sealed pre-label boolean; `why[]` records every rule that fired.
- `renderBlindSheet` and `renderReviewSheet` only ever accept render-safe row shapes (`{command, teaching, jtbd_summary}` plus, for the review sheet, a separate pre-label lookup), so `autonomous_safe`, `why`, and any policy-boundary text are structurally absent from the rendered markdown, not merely grep-avoided.
- `mergeAnswerKey` refuses (naming the offending command(s)) on: unfilled blind rows, empty blind reasons, unresolved review rulings, blind/review command-set overlap, a command-set mismatch with the registry (missing and/or extra, both named), a pre-label seal mismatch, and a correction with no navigator reason. Every refusal throws an `Error` with `code === 'ANSWER_KEY_REFUSED'`.
- `tests/test-356-label-sheet.cjs` (575 lines, 96 checks, all passing): 8 in-file legs (picking, render hygiene, round-trip parse, review sheet, merge happy path, the plan's own 2-of-5/rate-0.4 disagreement worked example, all 8 refusal cases, and a full 3-mode CLI spawn against a synthetic registry with the 356 no-network child env) plus 3 shipped legs gated on files that do not exist yet, all printing `PENDING` and passing.
- Ran the full `bash tests/run-all-356.sh` aggregator: 20 passed, 0 failed, 5 skipped (files owned by sibling waves not yet landed); the new test ran (not skipped) and passed inside it, confirming the `run_if "356: label sheet (R356-02, D-04, D-16)"` guard 356-01 had already wired picks this file up correctly.
- Measured (real registry, real command count, NO sealed pre-label rows touched): 113 registry commands; the D-04 picker (keyword + not_autonomous_safe + external_verb only, `prelabelRows: []`) yields a 66-command lower-bound blind subset -- consistent with 356-RESEARCH.md's independently measured prediction (65 non-`autonomous_safe` commands plus one additional keyword/verb hit on a safe-tagged command). This count excludes any command Claude's sealed pre-label alone would add; the true blind-subset size (D-04's full OR, including `claude_prelabel_true`) is >= 66 and is computed for real only in 356-06, after the reveal.

## Task Commits

Each task was committed atomically:

1. **Task 1: `scripts/irreversibility-answer-key.cjs`** - `26186bade` (feat)
2. **Task 2: `tests/test-356-label-sheet.cjs`** - `4fc72fd2d` (test)

**Plan metadata:** this SUMMARY.md commit (docs, by explicit path)

## Files Created/Modified

- `scripts/irreversibility-answer-key.cjs` - new, 669 lines, zero network code, zero `fetch`/`https?:`/`typesafe`/`jev-devtime-client` references outside comments (verified by grep)
- `tests/test-356-label-sheet.cjs` - new, 575 lines, 96 checks, `NET_ATTEMPTS === 0` asserted as the last check

## Decisions Made

- Followed the explicit sealing-rule instruction over the plan's literal Task 2 text for one shipped leg: rather than gating the "real registry + committed prelabels" leg on `356-CLAUDE-PRELABELS.json`'s existence (which is already true today, since it was sealed in 356-04), that leg is deferred entirely and gated on the navigator's own reveal artifact (`356-BLIND-LABEL-SHEET.md`) instead. This keeps the letter of "tests may use synthetic pre-label fixtures only" intact today while leaving a documented path for 356-06 to complete it once the D-16 order has legitimately been honored.
- Hashing the sealed pre-label file's raw bytes (for seal-equality checks in the two shipped legs that do run today) is treated as within-bounds: sha256 is a one-way commitment designed to be compared without disclosure, which is different from `JSON.parse`-ing the file and branching on its `irreversible`/`reason` values.
- `renderBlindSheet`/`renderReviewSheet` take pre-filtered row objects rather than full registry rows plus a "what to hide" list, so the D-16 leakage guarantee is a type-shape guarantee, not a diligence guarantee.

## Deviations from Plan

### Auto-fixed Issues

None - no bugs or blocking issues were encountered; both tasks' verification and acceptance criteria passed on the first attempt.

### Sealing-rule-driven adjustment (not a Rule 1-4 fix; an explicit instruction override)

**1. Deferred one Task-2 "shipped leg" past this plan, per the 356-05 sealing rule**
- **Found during:** Task 2 (writing the shipped legs)
- **Issue:** The plan's Task 2 text describes a shipped leg that reads the real, already-sealed `356-CLAUDE-PRELABELS.json` and calls `pickBlindSubset` against its real rows once that file exists (it has, since 356-04). My execution instructions state explicitly that tests in this plan may use synthetic pre-label fixtures only, and that the sealed file's label contents must not be opened.
- **Fix:** Implemented that leg to always print `PENDING` with a comment explaining the deferral, rather than gating on the prelabels file's existence. The other two shipped legs (which only hash-compare committed sheets, never parse sealed rows) are implemented as the plan describes and are gated on the sheets' own existence.
- **Files modified:** `tests/test-356-label-sheet.cjs`
- **Commit:** `4fc72fd2d`

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. No network calls were made anywhere in this plan (`NET_ATTEMPTS === 0` asserted and confirmed).

## Next Phase Readiness

- 356-06 (the navigator's sitting) can call `node scripts/irreversibility-answer-key.cjs --label-sheet <out> --prelabels <sealed-file-path>` directly; the picker, renderer, parser and merger are all proven against synthetic fixtures and the CLI's exit-2 refusal paths.
- The deferred shipped leg (subset-coverage against the real sealed rows) is a clearly marked, single-function TODO in `tests/test-356-label-sheet.cjs` for 356-06 (or a later plan) to complete once the blind sheet is committed.
- STATE.md and ROADMAP.md were intentionally left untouched per this plan's objective (orchestrator owns those writes; other sessions are editing the tree concurrently).

## Self-Check: PASSED

- FOUND: `scripts/irreversibility-answer-key.cjs`
- FOUND: `tests/test-356-label-sheet.cjs`
- FOUND: commit `26186bade` (feat, Task 1)
- FOUND: commit `4fc72fd2d` (test, Task 2)

---
*Phase: 356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-*
*Completed: 2026-09-23*
