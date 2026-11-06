---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "26"
subsystem: part8-egress
tags: [part8, ambiguous, census, owner-decision]
requires: [386-25, 386-28, 386-02, 386-37, 386-42]
provides:
  - RCA with the census lines and the Owner decision block (decision: option-e)
affects: [386-27, 386-32, 386-33]
key-files:
  modified:
    - .planning/debug/part8-ambiguous-verdict-is-sent-on-own-shim.md
decisions:
  - "decision: option-e (context-based decomposition, not a bare block), owner card of 2026-11-06"
metrics:
  completed: 2026-11-06
---

# Phase 386 Plan 26: Ambiguous-call census and the decision Summary

The census and the disposition matrix were already committed (8c1af79b1). This run added the two missing census lines and recorded the owner decision `decision: option-e` with the owner's words verbatim, the carrier_note copied from the plan 42 RCA, and the 5-line reading. No product file was edited.

## Results

- census_ambiguous_repo_paths: 2 (normalize_framework_name with a non-canonical raw term, command_neighborhood). census_ambiguous_body_paths: 0.
- census_split_route_callers: 0 and census_codepath_body_callers: 0. Both count ambiguous-verdict rows that carry an edge or body string (the only calls that plan 386-27 answers with sprouts_required). All ambiguous rows hold only 1 to 3 word sprouts. Source: the saved 54-row census of this plan (scratch file), PROVEN.
- Info for plan 386-33: 10 allow-verdict code rows carry body-shaped repo-built Cypher templates (brain_query, key cypher: enrichCausalEdges, suggestValidationSteps, hatAwareRecommend). A new body class must not apply to that key, or those code paths would be refused with no model to split them.
- Gates: census_codepath_body_callers is 0 and design_can_work is yes in the plan 42 RCA, so no NEEDS_HUMAN.

## Deviations from Plan

**1. [Rule 2 - missing data] Two census lines were absent**
- **Found during:** Task 2 gate check. The earlier Task 1 commit held only the census_ambiguous_* lines.
- **Fix:** Added census_split_route_callers and census_codepath_body_callers with their definition, from the saved census (no new probe was needed; the table and verdicts were already measured).
- **Files modified:** .planning/debug/part8-ambiguous-verdict-is-sent-on-own-shim.md

## Self-Check: PASSED

The RCA holds `decision: option-e`, `date: 2026-11-06`, the verbatim owner words, `carrier_note:` and `census_codepath_body_callers: 0`.
