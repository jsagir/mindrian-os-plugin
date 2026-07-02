---
phase: 209-shape-f-native-fire
plan: 04
subsystem: eval
tags: [plurai, eval-gate, card-fire, frozen-invariants, baseline-deferred]

requires:
  - phase: 201 (harness-as-code-manifest)
    provides: "lib/core/ralph-loop-gate.cjs - the exact structural analog: Object.freeze invariant array, classifier accepts-but-ignores a second opts arg, baseline_deferred degrade path"
provides:
  - "lib/core/card-fire-gate.cjs - classifyCardFireTrace(trace, _optsIgnored) + frozen HARD_VIOLATIONS (rendered_prose_instead_of_card, ascii_box_at_gate, no_card_at_declared_gate, trailer_present_card_absent)"
  - "evals/plurai/13-native-fire.csv - 20 hand-labeled synthetic rows (10 pass, 10 violation)"
  - "evals/plurai/209-baseline.json - baseline_deferred:true CI baseline, 100% local-gate parity"
  - "tests/test-209-card-fire-gate.cjs - 7-assertion parity proof with a full-file quote-aware CSV parser"
  - "tests/run-all-209.sh - phase aggregator, 9 legs pre-declared with run_if SKIP guards"
affects: [209-03, 209-05, 209-06, 209-07]

tech-stack:
  added: []
  patterns:
    - "Full-file quote-aware CSV parser (char-by-char state machine, not line-split): needed because option-list output_text fixtures embed real newlines inside quoted CSV fields, which the 201-style line-split parser cannot handle"
    - "Frozen HARD_VIOLATIONS + ignored-opts-arg classifier (lib/core/ralph-loop-gate.cjs pattern, Canon Part 7 reuse)"

key-files:
  created:
    - lib/core/card-fire-gate.cjs
    - evals/plurai/13-native-fire.csv
    - evals/plurai/209-baseline.json
    - tests/test-209-card-fire-gate.cjs
    - tests/run-all-209.sh

key-decisions:
  - "All four invariants gate on card_fired !== true, so a trace with card_fired:true is a pass regardless of output_text shape (satisfies the plan's Test 3 behavior: a fired card is a pass even with bracket-shaped recap text)"
  - "ascii_box_at_gate deliberately excludes a bare U+25A0 alone (sanctioned UI vocabulary per selector-dispatcher.cjs:256 / ui-system SKILL.md:131 / dial-presenter.cjs:134), matching what plan 209-07's H1 will also encode in the live backstop regex"
  - "CSV uses flat columns (id, four trace fields, Label, note) rather than the 08-csv's single-JSON-cell dialect, since the four trace fields are independently useful for readability; this required a proper multi-line-aware parser rather than 201's line-split one"

patterns-established:
  - "The eval-gate pattern (Phase 196/201) now has a third instance: card-fire-gate.cjs, following the same frozen-invariant / baseline_deferred / parity-test / run-all-aggregator shape exactly"

requirements-completed: [EVAL-GATE]

duration: ~35min
completed: 2026-07-02
---

# Phase 209 Plan 04: Card-Fire Eval Gate (Plurai + Local Parity) Summary

**The phase's core claim ("a declared gate fires the AskUserQuestion card; prose or an ASCII frame at a gate is a violation") is now a deterministic, offline, CI-enforced classifier with 100% parity against a 20-row hand-labeled synthetic CSV, wired into a phase aggregator that every subsequent 209 plan's tests slot into without runner edits.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 completed
- **Files modified:** 5 (all new)

## Accomplishments

- `lib/core/card-fire-gate.cjs`: frozen `HARD_VIOLATIONS` array (4 named invariants) + `classifyCardFireTrace`, structurally identical to `lib/core/ralph-loop-gate.cjs` (Object.freeze, second arg accepted-but-ignored).
- `evals/plurai/13-native-fire.csv`: 20 synthetic rows (10 pass / 10 violation) covering card-fired-clean, card-fired-despite-bracket-recap, bare-U+25A0-non-gate (x2), no-gate-plain-prose (x2), numbered-prose-list-at-gate (x2), same-line and multiline ASCII box at gate, the forbidden "Type 1, 2, or 3" exemplar, trailer-present-card-absent with no menu shape at all (x2), and edge cases (gate-with-no-trailer, box-without-declared-gate, card-fired-with-no-gate-declared, card-fired-despite-menu-shaped-text).
- `evals/plurai/209-baseline.json`: `baseline_deferred: true` on the sanctioned 196/201 degrade path, precision/recall/accuracy/f1 all 1 (local gate reproduces every hand label).
- `tests/test-209-card-fire-gate.cjs`: 7 assertions, including a full-file quote-aware CSV parser required because several `output_text` fixtures embed real newlines inside quoted CSV cells (a plain line-split parser, as used in the 201 analog, cannot handle this).
- `tests/run-all-209.sh`: pre-declares all 9 phase legs; run showed 3 PASS (209-01, 209-02, 209-04) + 6 SKIP (not yet landed) + 0 FAIL.

## Task Commits

1. **Task 1: card-fire-gate.cjs frozen invariants + 13-native-fire.csv**
   - `c15aee83` feat(209-04): card-fire-gate frozen invariants + 13-native-fire.csv (EVAL-GATE T1)
2. **Task 2: baseline_deferred baseline + parity test + run-all-209.sh aggregator**
   - `a0b72efc` feat(209-04): baseline_deferred baseline + parity test + run-all-209 aggregator (EVAL-GATE T2)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `lib/core/card-fire-gate.cjs` - classifier + frozen invariants (107 lines)
- `evals/plurai/13-native-fire.csv` - 20-row synthetic fixture (26 physical lines due to embedded newlines in quoted cells)
- `evals/plurai/209-baseline.json` - CI baseline
- `tests/test-209-card-fire-gate.cjs` - parity test (146 lines, 7 assertions)
- `tests/run-all-209.sh` - phase aggregator (65 lines, 9 pre-declared `run_if` legs)

## Decisions Made

See key-decisions in frontmatter. The most consequential: the CSV dialect choice (flat columns vs single-JSON-cell) required writing a proper multi-line-aware CSV parser rather than reusing the 201 test's line-split one verbatim - this is a deliberate, documented departure from "copy verbatim" for a good reason (readability of the fixture file), not a shortcut.

## Deviations from Plan

None in substance. The plan's Task 2 action item 2 said to "reuse the 201 test's CSV parsing idiom incl. its quoted-cell handling" - the *quoted-cell handling* (escaped `""`) is reused; the line-split outer loop was replaced with a full-file state machine because this plan's CSV cells contain embedded newlines that the 08/201 CSV's single-line JSON cells never needed to handle. This is a necessary extension of the idiom, not a deviation from its intent.

## Issues Encountered

None - self-contained new file set with zero shared files with any other 209 plan, executed directly (this plan rode Wave 1 with no dependencies, so no coordination was needed with the other Wave 1 plans).

## Verification Results

- `node tests/test-209-card-fire-gate.cjs` - exits 0, 7/7 assertions, 100% CSV parity (20/20 rows)
- `bash tests/run-all-209.sh` - exits 0, PASS=3 FAIL=0 SKIP=6 (209-01/02/04 landed and green; 03/05/06 x2/07 x2 correctly SKIP as not-yet-landed)
- `grep -c "baseline_deferred" evals/plurai/209-baseline.json` = 1 (true)
- `grep -c "run_if" tests/run-all-209.sh` = 11 (>= 8 required; 9 legs, 2 of which have 2-word labels each contributing once)
- `grep -rP '\x{2014}'` across all 5 new files - no em-dashes
- `grep -rn "require(.*http\|require(.*net\|brain" lib/core/card-fire-gate.cjs` - empty (Part 8 proof)
- HARD_VIOLATIONS frozen; passing `{disable:true}` as the second classifier arg changes nothing (asserted in test)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The phase now has a deterministic offline judge for its core claim. Every subsequent 209 plan's test file slots into `tests/run-all-209.sh` by filename alone; no plan needs to edit this runner again. Plans 209-03, 209-05, 209-06, and 209-07 can proceed independently.

---
*Phase: 209-shape-f-native-fire*
*Completed: 2026-07-02*
