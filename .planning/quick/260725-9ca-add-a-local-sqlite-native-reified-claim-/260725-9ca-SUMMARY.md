---
phase: 260725-9ca-add-a-local-sqlite-native-reified-claim-
plan: 01
subsystem: navigation
tags: [reified-claim, contradiction-event, local-graph, canon-part-8, edge-vocabulary]
requires:
  - lib/core/navigation/edges.cjs writeEdge + ALLOWED_EDGE_TYPES
  - lib/core/node-insert.cjs insertNode
  - lib/core/navigation/typed-claim.cjs writeClaimNode (participant seeding)
provides:
  - navigation.writeContradictionEvent (local reified ContradictionEvent writer)
  - navigation.REIFIED_CLAIM_EVENT_ID (deterministic id-minter)
  - navigation.REIFIED_EVENT_TYPES / PARTICIPANT_NODE_TYPE / REIFIED_STATUS_VALUES
  - CONCERNS edge type (net-new, additive)
affects:
  - lib/core/navigation.cjs (closed chokepoint surface, one additive re-export block)
  - lib/core/navigation/edges.cjs (ALLOWED_EDGE_TYPES, one additive member)
tech-stack:
  added: []
  patterns:
    - reified event node mirrored from Brain-side shape as a LOCAL-only module (no Brain require)
    - additive-comment edge-vocabulary extension idiom (CONCERNS)
    - deterministic sha256 id-minter as SQLite ON CONFLICT target (replaces Cypher MERGE)
    - fail-closed never-throw validation contract
key-files:
  created:
    - lib/core/navigation/reified-claim.cjs
    - tests/test-reified-claim-contradiction-event.cjs
  modified:
    - lib/core/navigation/edges.cjs
    - lib/core/navigation.cjs
decisions:
  - Reuse CONTRADICTS verbatim for the event-to-rivalClaim link; mint no CONTRADICTED_BY
  - Restrict claim/rivalClaim participants to type='claim' typed_claim nodes only
  - Ship create-with-initial-status only; a status change mints a different node (no resolve verb)
  - review_status left to the column DEFAULT 'proposed' (never auto-confirmed, Canon Part 9)
metrics:
  duration: ~12m
  completed: 2026-07-25
  tasks: 2
  files: 4
---

# Quick Task 260725-9ca: Local SQLite-native reified-claim ContradictionEvent Summary

A local, LOCAL-only reified-claim event primitive (`writeContradictionEvent`) that turns a claim-vs-rivalClaim contradiction into a first-class `ContradictionEvent` graph node in room.db, mirroring the shape of the Brain-side `hypergraph-event-schema.cjs` without ever requiring it (Canon Part 8 LOCAL -> BRAIN: NO).

## What Was Built

**Task 1 (primitive):** `lib/core/navigation/reified-claim.cjs` ships `writeContradictionEvent(db, {claim, rivalClaim, evidence, status})`, the `REIFIED_CLAIM_EVENT_ID` deterministic sha256 id-minter (namespaced `event:contradictionevent:<hash>`), the frozen `REIFIED_EVENT_TYPES` role table, `PARTICIPANT_NODE_TYPE = 'claim'`, and the `REIFIED_STATUS_VALUES = {open, resolved}` Set. The writer mints the event node through the shared `insertNode` NOT-NULL-safe chokepoint (review_status left to the DEFAULT `'proposed'`, never auto-confirmed) and lands exactly two edges through `navigation.writeEdge`: a net-new `CONCERNS` edge to the claim participant and the reused `CONTRADICTS` edge to the rivalClaim. `CONCERNS` was added additively to `edges.cjs` `ALLOWED_EDGE_TYPES`; `navigation.cjs` re-exports the five surface members. The module requires only `node:crypto`, `../node-insert.cjs`, and `./edges.cjs`.

**Task 2 (test):** `tests/test-reified-claim-contradiction-event.cjs`, a hermetic 12-check driver (in-memory `:memory:` db via the shared `applySchema` fixture, node:sqlite SKIP-77 guard). It proves mint shape, edge wiring (queried directly from the edges table), the participant-type gate (both sides), self-contradiction rejection, the status enum gate + default, non-object/empty-field rejection, idempotency (COUNT stays 1), re-export identity, and CONCERNS/CONTRADICTS membership with no CONTRADICTED_BY. Its final check reifies the concrete recurring-reach-card RCA contradiction (Finding-2-fixed-commit-62b09ee8 vs recurs-anyway-2026-07-23/2026-07-25) as the acceptance case.

## Validation Approach

- Task 1 `node -e` smoke check: PASS (re-export identity, CONCERNS registered, CONTRADICTS intact, constant shapes correct).
- Task 2 `node tests/test-reified-claim-contradiction-event.cjs`: 12 checks passed, exit 0.
- Boundary checks: zero em-dashes in all four files; zero `require` of `hypergraph-event-schema.cjs` or `node:sqlite` in the new module; no `CONTRADICTED_BY` string literal anywhere except the test asserting its absence.
- Scope check: `writeContradictionEvent` is referenced only by the module, its navigation.cjs re-export, the edges.cjs comment, and the test file. No caller/hook/script wires it (Scope decision honored).

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

This plan's frontmatter type is `execute` (not `tdd`), and Task 2 is a single-file test task against the primitive shipped in Task 1 (which is intentionally the first task). The commit sequence is `feat(...)` (Task 1 primitive) then `test(...)` (Task 2 acceptance test). Because the primitive is a deliberate Task-1 deliverable that precedes the test, no RED-before-GREEN inversion applies; the test was written against shipped code and passed on first run (all 12 checks green).

## Known Stubs

None. The primitive is fully wired to the shared write chokepoints; no placeholder data or unwired surface. Per the locked Scope decision, no automatic caller exists (that is explicit future follow-up, not a stub).

## Self-Check: PASSED

- FOUND: lib/core/navigation/reified-claim.cjs
- FOUND: tests/test-reified-claim-contradiction-event.cjs
- FOUND: lib/core/navigation/edges.cjs (CONCERNS added)
- FOUND: lib/core/navigation.cjs (re-export added)
- FOUND commit 709aa3f2 (Task 1 feat)
- FOUND commit 4b9030d8 (Task 2 test)
