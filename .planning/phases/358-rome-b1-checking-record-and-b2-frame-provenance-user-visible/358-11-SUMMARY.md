---
phase: 358-rome-b1-checking-record-and-b2-frame-provenance-user-visible
plan: 11
subsystem: runbook
tags: [b2, go-no-go, runbook, theo, rome, checkpoint]
requires:
  - phase: 358-10
    provides: B2 on main, registries regenerated, command-registry sha256 2afa656e2ebc049072453ca55587bc8a7f6920f77ec864b4369ae29bc6f85d7e recorded for the Theo check
provides:
  - "docs/2026-10-06-ROME-B2-GO-NO-GO.md (422 lines, commit 8c142d768): operator runbook for B2-AT1..AT4 under navigator ruling 1 (quoted verbatim), covered / NOT COVERED answer-path table, release cut, Theo command_neighborhood check, client-name and relevance probes"
affects: []
key-files:
  created: [docs/2026-10-06-ROME-B2-GO-NO-GO.md]
  modified: []
key-decisions:
  - "Card shape RULED F.1 (navigator, 2026-09-24, on Larry's recommendation): refines / relocates / cancel are three equal answers, the account goes to a local artifact, never a graph edge (AT4). F.0 was rejected because its Reject reason is written into a REJECTED_BECAUSE edge."
  - "Navigator checkpoint (2026-09-24): APPROVED, live probes later. The Desktop / Cowork client-name probes and the relevance probe are PENDING and run after the release. The Theo check (runbook section 4) stays PENDING until release + theo-resync; pre-release Theo reads command-registry@2.0.0-beta.42 (hash 43d13474...), which is the expected honest mismatch."
requirements-completed: [B2-10]
---

# 358-11 Summary: B2 go/no-go runbook

## What was built
`docs/2026-10-06-ROME-B2-GO-NO-GO.md`: the 6 October checklist for slide A1 ("which direction", "can I turn around"). It quotes ruling 1 verbatim: "When the governing question changes, the room asks what the old question got wrong before it records the new question, and keeps both questions on the record." It walks AT1-AT4 on CLI, Desktop and Cowork, and includes an honest table of which answer paths are covered and which are not. Larry answering a new question in chat without recording it is marked NOT COVERED. The Phase 345 `goal.parent_question` reconciliation and the chain_run halt are logged there as not built.

## Checkpoint (Task 2)
- **Card shape:** F.1 ok. Larry was consulted and recommends F.1. Theo grounding was thin: the plugin's Part 8 egress guard blocked both generic methodology lookups before they reached Theo (`freeform_unmatched` / `unknown`). That is logged as a follow-up finding.
- **Runbook:** approved. Probes run later.
- **Observed client names:** Desktop pending, Cowork pending. **Relevance probe:** pending.
- **Theo check:** pending until release + resync. Theo's command layer sat at beta.42 (18 releases behind) before this phase.

## Verification
- Runbook commit 8c142d768 is an ancestor of HEAD. Ruling-1 sentence present (lines 22 and 381). 11 NOT COVERED markers.
- `bash tests/run-all-358.sh`: PASSED=39 FAILED=0 SKIPPED=0.

## Follow-ups (logged, not built here)
- Part 8 egress guard blocks ordinary generic methodology brain_* calls (Larry consult, 2026-09-24): a /gsd-debug candidate.
- A runtime per-turn router for question changes (today Larry reaches the door through tested surface descriptions only).
- Phase 345 `goal.parent_question` reconciliation, and the chain_run pending-change halt (stretch).
