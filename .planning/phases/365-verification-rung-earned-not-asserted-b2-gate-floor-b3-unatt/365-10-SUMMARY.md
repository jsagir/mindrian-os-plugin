---
phase: 365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt
plan: 10
subsystem: research-planner-ambient
tags: [b3, ambient, research-planner, zero-egress, never-do]
requires: [365-07]
provides:
  - halted_constraint outcome and pending card kind in lib/core/research-planner/ambient.cjs
  - never_do_proposal on every ambient plan-only card and on the halt card
affects: [365-13, 365-14, 365-16]
tech-stack:
  added: []
  patterns: [check by position before any egress, gate-shaped card queued as a pending card because the gate ledger is per-process]
key-files:
  created:
    - tests/test-365-never-do-ambient.cjs
  modified:
    - lib/core/research-planner/ambient.cjs
key-decisions:
  - "The check sits after buildPlan and before coverFor, grants.recordRun and runQuick, so zero egress and no ledger run are structural"
  - "Providers are read from plan.leaves (the built plan carries corpus openalex on the searchable leaves; the question set carries it only on the room leaf)"
  - "A deduped halt (an unsurfaced halted_constraint card already pending) still appends a trip line, with the pending card's run_id"
requirements-completed: [V365-12, V365-13]
duration: ~30 min
completed: 2026-10-01
---

# Phase 365 Plan 10: Ambient never-do halt Summary

The room-started research runner now stops before any request when the room's never-do list names what it was about to do (or the list is unreadable), and leaves a card for the next research touchpoint.

PLAN_BASE: 98b2e3f6735fdf8bb6f64e79e55f6c214d54d29a

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | 0386db7d2 | check, halted_constraint outcome, card.json, pending card, trip line + test A1..A8 |
| 2 | 25556df01 | never_do_proposal on plan-only cards (both call sites) and the halt card + A9..A11 |

Both verified as ancestors of HEAD.

## What changed (lib/core/research-planner/ambient.cjs)

- `AMBIENT_OUTCOMES` gains `halted_constraint` at the end; every earlier outcome and path unchanged.
- New step 3b in `maybeQuickInner`, after the `built.status !== 'ready'` block and before `quickMod.coverFor`: `declaredFieldsOfAmbientPlan({command: qs.command, leaves: plan.leaves}, plan, picked.zone.term, standing)` then `checkStep(roomDir, fields)`.
- `hasPendingPlanOnly` generalized to `hasPendingKind(roomDir, kind)` (the old name stays as a wrapper).
- `recordPlanOnly(roomDir, planner, plan, cover, nowMs, fields)` adds `payload.never_do_proposal` (proposalFromFields, surface `ambient`) when not null. Other payload keys and proposal.json unchanged.

## Pending kind and card.json shape (365-13 and 365-14 consume these)

Pending kind name: `halted_constraint` (queued with `planner.queuePendingCard(roomDir, {run_id, kind: 'halted_constraint', now})`; `planner.pendingCards` returns `{run_id, kind: 'halted_constraint', queued_at, card}`).

`.mindrian/research-runs/<run_id>/card.json` (plan.json stays beside it):

```
{
  header: "<text>",              // <= 400 chars, floor sentence always whole
  kind: "general",
  select_mode: "single",
  options: [
    {id: "approve", label: "Run it now, attended"},
    {id: "reject",  label: "Leave it stopped"},
    {id: "defer",   label: "Decide later"}
  ],
  subject_node_id: null,
  evidence_node_ids: [],
  notice: "<same text as header>",
  payload: {
    ambient: true, halted_constraint: true, run_id,
    constraint: {kind, value},   // both null for a malformed list
    never_do_proposal: {kind, value, why, alternatives}   // from proposalFromFields; present when fields yield one
  }
}
```

Header text, named entry: `A room-started research run stopped before any request. This room's never-do list names <kind> <value>. Why: <why> Nothing ran and nothing left this machine. ` + FLOOR_SENTENCE (the why is trimmed with `...` first, then the value, to stay at 400).
Header text, malformed list: `A room-started research run stopped before any request, because this room's never-do list could not be read (.mindrian/never-do.json). Nothing ran and nothing left this machine. ` + FLOOR_SENTENCE.

Outcome shapes: `{outcome:'halted_constraint', reason:'constraint_named'|'constraints_malformed', run_id}`; a second pass while the card is unsurfaced returns the same with `deduped:true` and the pending run_id (the new plan's run directory is dropped; no second card).

Trip line (recordTrip): `surface:'ambient', reason, kind, value, step_command:'/mos:whitespace', run_id`, no `why`. kind and value are null for a malformed list.

## Hand-offs

- 365-13 (approval door, CLI path): the card header carries the whole why; options map approve -> run attended, reject -> leave stopped (then offer `payload.never_do_proposal`), defer -> keep pending. The door mints the decision node first, then `writeNeverDoEntry` (it dedupes an entry already on the list, which matters for a halt card whose Reject offers the follow-up).
- 365-14 (research.md and touchpoint text): render pending kind `halted_constraint` through gate_render (server-side render may use `notice`); mark it surfaced via `planner.markSurfaced`. The research.md text for this kind lands there.
- 365-16 (Theo sync): no field, requiredness or description on gate_render, gate_answer, chain_run, graph_write or room_bind changed.

## Verification

- `node tests/test-365-never-do-ambient.cjs`: PASS 18 FAIL 0 (A1..A11 plus A5a..A5d, source-order, dash guard, net guard). Every halt leg asserts a fetchEnvelopeFn spy count of 0, the net guard at 0, and an unchanged run ledger.
- `node tests/test-363-ambient.cjs` PASS 18/0; `node tests/test-363-mcp-tool.cjs` PASS 15/0.
- `bash tests/run-all-365.sh` at HEAD 25556df01953ba1e8440b0458fe33c8c46d43f7a (Task 2 commit): PASSED=53 FAILED=0 SKIPPED=1 KNOWN=8 (was 52/0/1/8 at PLAN_BASE; the new leg is the +1). Also 53/0/1/8 at 0386db7d2 after Task 1.
- Acceptance: `git diff PLAN_BASE -- lib/core/research-planner/ambient.cjs` places `checkStep` before `quickMod.coverFor`, `grants.recordRun` and `quickMod.runQuick` (also asserted in the test as an order leg). No dash characters in either file (`grep -nP` clean).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Provider field source**
- **Found during:** Task 1 (A3 design)
- **Issue:** `declaredFieldsOfAmbientPlan(qs, ...)` reads `qs.leaves[].corpus`, but the ambient question set only sets `corpus` on the room leaf (L3). Passing it the question set would have declared provider `room` only and a `provider openalex` entry would never match.
- **Fix:** call it with `{command: qs.command, leaves: plan.leaves}` (the built plan's leaves carry `corpus: 'openalex'`). room-constraints.cjs untouched. A3 covers the provider case.
- **Files modified:** lib/core/research-planner/ambient.cjs
- **Commit:** 0386db7d2

**2. [Scope note] Trip line on a deduped halt**
- The plan text says "one trip line per halt"; a deduped halt is still a halt, so it appends a trip line (run_id of the pending card). A7 asserts two lines after two passes.

**3. [Scope note] TDD order**
- Implementation was written before the test file, so there was no separate observed RED run; A2 includes a control room with the same grant and no list that does fetch, which proves the halt legs are not vacuously zero.

## Known Stubs

None.

## Threat Flags

None. No new endpoint or room.db access; T-365-07, T-365-04, T-365-20, T-365-06 and T-365-11 mitigations are implemented and tested as planned. quick.cjs and the peer-edited 363 tests were not touched.

## Self-Check: PASSED

Files exist (ambient.cjs, the new test); commits 0386db7d2 and 25556df01 are ancestors of HEAD; STATE.md and ROADMAP.md untouched; the peer's 353-FLEET-REPORT.json and Phase 366 hunks left alone.
