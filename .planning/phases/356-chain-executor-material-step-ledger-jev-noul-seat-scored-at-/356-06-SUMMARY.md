---
phase: 356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-
plan: 06
subsystem: jev-policy-and-answer-key
tags: [human-checkpoint, blind-labels, policy-draft, d-16, d-20, d-21]

requires:
  - phase: 356-04
    provides: sealed Claude pre-labels (356-CLAUDE-PRELABELS.json) and their digest
  - phase: 356-05
    provides: scripts/irreversibility-answer-key.cjs (label-sheet / review-sheet / merge tooling)
provides:
  - The navigator's blind labels on the D-04 risk subset (66 rows), committed before any policy text existed (D-16)
  - A D-20 extension: the navigator's blind labels on the remaining 47 commands (D-20 second-blind-labeler amendment)
  - A full D-21 re-run: two independent 113-row blind sheets under the "always stop for the navigator" rubric, both committed before comparison
  - The command-irreversibility policy, drafted then rewritten to the D-21 rubric (v1 -> v2), later locked as v3 in 356-08
affects: [356-08, 356-09, 356-10]

tech-stack:
  added: []
  patterns:
    - "Blind-before-reveal ordering enforced by git ancestry (D-16): every blind sheet's fill commit precedes the policy file's first commit"
    - "Rubric re-run on definition change: when D-21 redefined the flagged predicate mid-phase, both blind labelers re-ran under the new wording rather than patching old labels"

key-files:
  created:
    - .planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/356-BLIND-LABEL-SHEET.md
    - .planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/356-BLIND-LABEL-SHEET-REMAINDER.md
    - .planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/356-D21-SHEET-A.md
    - .planning/phases/356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-/356-D21-SHEET-B.md
  modified:
    - data/jev-policies/command-irreversibility.json

key-decisions:
  - "D-20: a fresh second blind labeler plus navigator arbitration replaces a single navigator-labels-everything model; agreement is data (two-model-blind-agreement), disagreement escalates to the navigator (navigator-arbitrated)."
  - "D-21: the flagged predicate changed from 'outside the machine' to 'always stop for the navigator'; both blind labelers re-ran the full 113-row registry under the new rubric rather than patching the old 66+47 row labels."

requirements-completed: [R356-02, R356-01]

duration: unknown (multi-sitting; see commit timestamps below)
completed: 2026-09-23
---

# Phase 356 Plan 06: Blind Labels, D-20/D-21 Re-run, Policy Draft Summary

**Two full blind-labeling passes (a 66+47 row D-04 split, then a 113-row D-21 re-run under a redefined rubric) plus two policy drafts (v1, then v2 rewritten to the D-21 rubric), all landed before any navigator lock.**

## What Actually Happened (adapted from the original plan)

This plan's checkpoints (Checkpoint A: the navigator labels the risk subset blind) were carried out across several sittings and two rubric generations, driven by two navigator amendments that arrived mid-phase and are recorded in 356-CONTEXT.md:

- **D-20** (amends D-04/D-16): a second, fresh blind labeler runs the sheet independently of Claude's sealed pre-labels; agreement between the two becomes `label_source: two-model-blind-agreement`, disagreement is escalated to the navigator (`label_source: navigator-arbitrated`).
- **D-21** (amends SPEC R1 and D-02): found through the validation desk, the flagged predicate is redefined from "outside the machine" to "always stop for the navigator" (also covers plugin install/update/repair and branded outward-facing artifacts). Because this changes what "irreversible" means, both blind labelers re-ran the full registry (113 rows each) under the new rubric rather than patching old labels.

## Blind-Labeling Timeline (git order proves blind-before-reveal, D-16)

1. `d7b70183e` (2026-09-23T15:37:16+03:00) - blank blind sheet, D-04 risk subset (66 rows), seal in header.
2. `4842f6828` (2026-09-23T15:54:36+03:00) - navigator's filled blind labels on the 66-row subset, committed before any reveal.
3. `3f09e5d1c` (2026-09-23T15:56:31+03:00) - blank blind sheet for the remaining 47 commands (D-20 extension).
4. `fc3c89351` (2026-09-23T15:57:45+03:00) - navigator's filled remainder labels (47 rows), committed before any comparison.
5. `55b423709` (2026-09-23T16:00:12+03:00) - policy drafted v1 (pending navigator lock in 356-08), per D-01 amended / D-02 / D-03.
6. `afdfdbe2a` (2026-09-23T16:08:39+03:00) - blank D-21 blind sheets, 113 rows each, one per labeler (labeler A, labeler B), rubric text updated to "always stop for the navigator" (D-21).
7. `b1a2cfe8d` (2026-09-23T16:16:25+03:00) - both labelers' filled D-21 sheets (356-D21-SHEET-A.md, 356-D21-SHEET-B.md) committed together, before any A-vs-B comparison.
8. `91e5397c2` (2026-09-23T16:19:55+03:00) - policy rewritten to the D-21 rubric (v2): flagged predicate reworded, boundary cases rewritten to match the navigator's rulings so far (export, snapshot, present, publish, update, doctor flagged; admin, rs-fetch, wiki not flagged); `/mos:vault` deliberately left unmentioned because it was still under arbitration at that point.

Comparing the two filled D-21 sheets (356-08's Task 1 work) found exactly 7 disagreements: `/mos:heal`, `/mos:mva-brief`, `/mos:new-surface`, `/mos:scheduled-tasks`, `/mos:setup`, `/mos:show`, `/mos:vault`. All 7 were ruled by the navigator at the validation desk (356-NAVIGATOR-RULINGS.json, commit `3ccc1a1ff`), closing the deferred-items.md 356-09 entry that flagged the missing `/mos:vault` boundary case.

## Policy v1 -> v2 -> v3 (v3 lands in 356-08)

- **v1** (`55b423709`): first draft under D-01 amended / D-02 / D-03, plain `{true, false}` criteria object, boundary cases for `/mos:export`, `/mos:snapshot`, `/mos:present`, `/mos:publish`.
- **v2** (`91e5397c2`): rewritten to the D-21 rubric ("always stop for the navigator"), boundary cases expanded to `/mos:update`, `/mos:doctor`, `/mos:admin`, `/mos:rs-fetch`, `/mos:wiki`. Navigator approved this version at the validation desk (`policy-lock-v2` ruling, `3ccc1a1ff`: "i approve i stii want you to consould with jev and with theo").
- **v3** (356-08): locks the policy (`status: locked`), resolves the `/mos:admin` vs. remote-key-rotation contradiction as a named legacy exception, adds the `/mos:vault` boundary case, and (per navigator directive D-22, Theo-consult-grounded) reframes `instructions` and every `boundary_cases` entry as strategy-then-tactics.

## Navigator's Resume Signals (verbatim, as recorded in the phase artifacts)

- Checkpoint A (66-row subset) and its D-20 extension (47-row remainder): the navigator's per-row labels are transcribed into `356-BLIND-LABEL-SHEET.md` and `356-BLIND-LABEL-SHEET-REMAINDER.md` (`filled_by: navigator` footers on both).
- D-21 re-run: the navigator did not personally re-fill both 113-row sheets by hand; instead the D-20 protocol's "fresh agent, blind to everything else" labeler design was used for both sheet A and sheet B, with the navigator arbitrating only the resulting disagreements plus the boundary cases he chose to review directly at the validation desk. This is the model-built-and-human-arbitrated shape D-20 itself calls for ("the report must state plainly that the answer key is model-built and human-arbitrated, not fully human-labeled").
- Validation-desk rulings (`3ccc1a1ff`, exported 2026-09-23T13:43:32.213Z): 14 per-command rulings plus the `policy-lock-v2` approval, transcribed into 356-08's answer key without paraphrase.

## Deviations from Plan

**1. [Rule 2 - scope reconciliation] Two extra rounds of blind labeling not in the original 356-06 task list**

- **Found during:** execution, driven by navigator amendments D-20 and D-21 recorded in 356-CONTEXT.md mid-phase.
- **Issue:** the original plan assumed one blind-sheet pass (D-04 risk subset only) feeding straight into the policy draft and the 356-08 pre-label review. D-20 required a second independent labeler and arbitration; D-21 required re-running both labelers over the full registry because the definition of "irreversible" itself changed.
- **Fix:** completed the D-04 subset pass, then the D-20 remainder pass, then a full D-21 113-row re-run with two independent labelers, in that order, each committed before the next reveal (preserving D-16).
- **Files modified:** 356-BLIND-LABEL-SHEET.md, 356-BLIND-LABEL-SHEET-REMAINDER.md, 356-D21-SHEET-A.md, 356-D21-SHEET-B.md.
- **Commits:** see timeline above.

**2. [Rule 1 - bug] Policy v2 left `/mos:vault` unmentioned**

- **Found during:** 356-09's baseline run (documented in deferred-items.md), traced back to this plan's v2 rewrite.
- **Issue:** `/mos:vault` was still under arbitration when v2 was drafted, so it was deliberately left out of `boundary_cases`, but `tests/test-356-policy.cjs`'s shipped-policy leg already asserted it must be named.
- **Fix:** resolved in 356-08's v3 lock, once the navigator's `/mos:vault` ruling landed (d21-vault: not flagged, "Only if user has obsidian in their systme or asked for it").
- **Commit:** 356-08's policy-lock commits.

## Self-Check: PASSED

- `data/jev-policies/command-irreversibility.json` exists and is valid JSON (verified `node -e "JSON.parse(...)"`)
- All cited commits exist: `git log --oneline --all | grep` confirms d7b70183e, 4842f6828, 3f09e5d1c, fc3c89351, 55b423709, afdfdbe2a, b1a2cfe8d, 91e5397c2, 3ccc1a1ff
