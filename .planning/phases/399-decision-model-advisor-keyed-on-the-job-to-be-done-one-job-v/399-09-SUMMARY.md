---
phase: 399-decision-model-advisor-keyed-on-the-job-to-be-done-one-job-v
plan: 09
subsystem: decision-advisor-logging
tags: [selection-log, calibration, ground-truth-label, overrule, gate_answer, closeOffer, part8]
requires: [399-06, 399-07, 399-08]
provides:
  - calibration_observations.ground_truth_label (nullable INTEGER, additive migration)
  - selection_observations table and initSelectionSchema
  - recordSelectionOutcome (lib/core/navigation/selection-log.cjs) and recordGroundTruth, both re-exported by navigation.cjs
  - best-effort logging in closeOffer (CLI) and gate_answer (MCP)
  - tests/test-399-selection-log.cjs (G1-G8, K1-K7)
affects: [399-10]
tech-stack:
  added: []
  patterns: [single SQL chokepoint, best-effort post-commit write, kill switch, hashed gate id, partial unique index dedupe]
key-files:
  created:
    - lib/core/navigation/selection-log.cjs
    - tests/test-399-selection-log.cjs
  modified:
    - lib/core/memory-ops.cjs
    - lib/core/navigation/calibration-log.cjs
    - lib/core/navigation.cjs
    - lib/workflow/offer-closer.cjs
    - lib/mcp/tools/gate.cjs
    - tests/run-all-399.sh
decisions:
  - "Writer home: lib/core/navigation/selection-log.cjs, already on the O1 allow-list. No fence change was needed."
  - "Advisor off still logs. calibrated_p, band, advisor_top, advisor_rank and table_version are null; overrule_by is 'none'; no calibration row is written (no probability to label)."
  - "The advisor makes a top pick only when shortlist state is ok AND top_tie is 1 or less. A tie at the top (399-07 guard) or state no_strong_pick gives advisor_top null and overrule_by 'none', so no overrule is recorded against a pick the advisor never made."
  - "Overrule: host = first shown command is not the advisor top; navigator = reject, defer, or accept of a command other than the first shown (chosen defaults to the first shown); both = host_and_navigator."
  - "gate_id is stored as 'g:' plus 24 hex of sha256, never as given (Part 8: a gate id could carry content). Dedupe: pre-check on (surface, gate_id) plus a partial unique index on (surface, gate_id, COALESCE(shown_command, '')) where gate_id is not null."
  - "Writes use a SAVEPOINT so the rows of one decision land together, inside or outside a caller transaction."
  - "closeOffer was split: closeOffer now calls _closeOfferRoute (the old body, unchanged) then _logSelection. The returned object is the old body's return value, untouched."
  - "gate_answer logs through a fresh openRoomDbForCaller handle after the commit and release, closed in finally; the answer-transaction handle is already closed by then."
  - "MINDRIAN_SELECTION_LOG=off is honoured in the writer itself and checked in closeOffer and gate_answer."
metrics:
  tasks: 2
  completed: 2026-11-24
---

# Phase 399 Plan 09: Selection log and ground-truth label Summary

Every selector decision on the CLI path (accept, defer, reject) and every answered MCP gate over registry commands now leaves labelled local rows in room.db: the calibrated probability of each shown option, the decision-time features, the decision and the overrule state. The behavioural channel stays off and nothing reaches the Brain.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 | Ground-truth column, selection_observations table, writer (G1-G8) | 71e71c4aa |
| 2 | Wire closeOffer and gate_answer; K1-K7; run-all-399 entry | ef6b2b36d |

Note on commit split: the test file holds G and K legs together. It was committed with task 2, so commit 71e71c4aa has no test of its own; the writer was exercised by the G legs before that commit.

## What was built

- memory-ops.cjs: `initCalibrationSchema` creates the table with `ground_truth_label INTEGER` and adds the column to a 9-column table once (PRAGMA table_info check, ALTER TABLE ADD COLUMN). `initSelectionSchema` creates `selection_observations` (the 24 plan columns plus `gate_id`) with indexes on created_at and decision_id and the partial unique index for gate dedupe.
- calibration-log.cjs: a label of exactly 0 or 1 uses a 10-column INSERT; anything else keeps the exact base 9-column INSERT text, so an old-schema table still works. `recordGroundTruth(db, id, label)` updates by id (0, 1, else null).
- selection-log.cjs: `recordSelectionOutcome(db, args)` never throws. Validation by membership: shown commands must be registry commands (commandRow), job ids must be in data/job-vocabulary.json (else null), decision must be accept, defer or reject (else `{ ok: false, reason: 'invalid_decision' }`). One row per shown option; one decision-only row when no shown command is valid. Features come from args, else from `resolveSelectionJob` and `readRoomAxes` on `roomDir`. Labels: accept gives 1 for the chosen and 0 for the other shown; reject gives 0 for the first shown and null for the rest; defer gives null. Each row with a probability also writes one labelled `advisor_option` calibration row (cue_disposition 'shown', confidence = calibrated_p, no audit marker).
- navigation.cjs: lazy thin re-exports `recordSelectionOutcome` and `recordGroundTruth` (lazy, so the shortlist and job-state modules load only when a decision is logged, and so a require order that starts at calibration-log does not hit the existing navigation cycle).
- offer-closer.cjs: `_logSelection` after the route runs. shown_commands: `args.shown_commands` when an array of strings, else `[offer.command]` when it starts with `/mos:`, else `[roomState.offer.command]` likewise, else empty (decision-only row). Free-Text is not logged.
- gate.cjs: `_logGateSelection` after `_releaseLiveGate`. Requires every card option id or label to be a `/mos:` command (then the writer checks the registry). approve gives accept, reject gives reject, defer gives defer. The replay path (`_answerWithoutLiveGate`) never reaches it.

## Verification

- `node tests/test-399-selection-log.cjs`: 25 passed, 0 failed (G1-G8, K1-K7). Written first; the K legs and the G legs were red before the writer and wiring existed (first run listed failures; after the writer, K1-K3 and K5 stayed red until the wiring).
- K5 harness: the fake MCP server handler-capture seam of tests/test-238-chosen-validation.cjs, driving the registered gate_render and gate_answer handlers against a scratch room under os.tmpdir. K5 compares the response with MINDRIAN_SELECTION_LOG=off after normalising ids. K6: a replayed gate_answer returns replayed true and writes 0 rows; the writer called twice with one gate_id writes once. K7: `navigation.recordSelectionOutcome` replaced by a thrower; the response equals the log-off response, 0 rows, and a second gate_answer returns replayed true (answer committed, gate released).
- `bash tests/run-all-399.sh`: exit 0, 14 PASSED lines.
- Base exit codes recorded BEFORE editing for 170 test files (every tests/*.cjs naming gate_answer or gate.cjs, plus bch-04, bch-14, writer-inventory, offer-closer.test, selector-decisions.test). A parallel re-run after the edits differed on 7 files (all flaky under parallel load: lock contention, port and timing). Run one at a time: test-369-gate-mirror-shell 0, test-267-mcpv2-dual-era 0, test-289-cli-card-dual-era 0, test-369-289-precondition 0, test-369-gate-recovery 0, test-369-sessionful-acceptance 0; test-354-concurrency-surfaces 1 (K2 lock contention on 5 parallel writers, base also 1 in the first run, 0 in the second: flaky, unrelated). Files that fail at base kept code 1 after: test-237-approve-executes, test-345-gate-ratify, test-3551-tri-polar, test-369-shared-core, test-mux-card-before-answer, test-365-floor-gate, test-369-writer-inventory, test-bch-07-seam3-insertion. Their failing legs name unrelated causes (pinned text drift, hooks.json, brain_ask description diff).
- test-bch-04-shadow-log 0, test-bch-14-part8-egress 0, lib/memory/offer-closer.test.cjs 0, lib/memory/selector-decisions.test.cjs 0, test-aliases-yaml-schema 0.
- `bash tests/run-all-36925.sh`: PASSED=54 FAILED=3, the same as base.
- `grep -c "BEHAVIORAL_CHANNEL_ARMED = false" lib/core/navigation/calibration-gate.cjs` prints 1.
- 0 en or em dashes in the touched files.

## Deviations from Plan

### Plan text not followed

**1. [Plan G5 and orchestrator guard] Advisor tie and no_strong_pick give overrule 'none'**
- The plan says 'none' when the shortlist state is not ok. 399-07 adds an abstain-on-tie guard, so a top tie is also treated as no advisor pick. Recorded as a decision above.

**2. [Plan key_links] Shown shortlist is recomputed with the room features, not read from suggest_next**
- As the plan design note says (suggest_next is write-free). A decision logged with a different last_command than the one suggest_next used can differ; `lastCommand` is passed only when the caller knows it, otherwise null (job-level row, which is the only live row depth in the v0 table).

**3. [Plan K6] Dedupe by pre-check plus partial unique index**
- A single UNIQUE index on (surface, gate_id) would reject the second shown-option row of the same decision, so the unique key includes shown_command and the pre-check carries the decision-level dedupe.

### Auto-fixed Issues

**1. [Rule 1 - Bug] navigation.cjs re-export of recordGroundTruth hit the existing require cycle**
- **Found during:** Task 1 test run (warning "non-existent property 'recordGroundTruth' ... circular dependency", function undefined).
- **Issue:** calibration-log.cjs requires f-selector-ranker, which requires navigation; when the test required calibration-log first, the eager re-export read an unfinished module.
- **Fix:** the re-export is a lazy wrapper. The existing eager `logCalibrationObservation` re-export was left as it was.
- **Commit:** 71e71c4aa

## Known Stubs

None.

## Threat Flags

None. The new table sits in room.db only; no new endpoint or auth path. T-399-30 to T-399-33 are covered by G7, G8 (80-character cap, only memory-ops and selection-log name the table, packet.cjs does not), K5-K7 and K4.

## Self-Check: PASSED

- FOUND: lib/core/navigation/selection-log.cjs, tests/test-399-selection-log.cjs
- FOUND commits: 71e71c4aa, ef6b2b36d
