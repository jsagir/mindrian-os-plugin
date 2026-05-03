# Phase 108: Truth-State Taxonomy

**Status:** Closed-set specification for RECONCILE-108-04. Phase 108 ships the contract. Phase 109 implements the column, the transitions, and the auto-stale job.
**Authority:** This file defines the canonical 8 values of the `review_status` field declared in PROVENANCE.md (Plan 108-02). Any code that writes a value outside this set is a Canon Part 9 violation.
**Date:** 2026-05-03

## The Closed 8-State Taxonomy

Every node in `room.db` carries a `review_status` from this closed set. State transitions are EVENTS (logged in `memory_event` nodes per Canon Part 4), never silent UPDATEs.

| State | Meaning | Trigger to enter | Required evidence (per Canon Part 5) |
|---|---|---|---|
| `proposed` | Default for any agent-created node (Larry, Brain, sub-agents, hooks). | Node insertion via any `created_by` other than `'user'`. | None at insertion. |
| `confirmed` | Promoted by human; only state that counts as trusted memory. | User APPROVE at Decision Gate (Canon Part 3). | Stage-dependent: early exploration accepts Practitioner+; near-commit demands Academic or Operational. |
| `rejected` | Explicitly declined; reason captured as graph data. | User REJECT at Decision Gate. | Reason captured per Canon Part 4 (rejection-with-reason teaches the system). |
| `stale` | Has not been seen or cited in N sessions; auto-marked. | Auto-stale job fires (see "Auto-Stale Rule" below). | None (system-triggered). |
| `superseded` | Replaced by a newer node; `REPLACES` edge points to successor. | New node inserted with REPLACES edge to this node + successor is `confirmed`. | Successor node must be `confirmed` (cannot supersede with a proposed-only node). |
| `needs_evidence` | Claim has been confirmed in principle but lacks Academic/Operational support. | Larry detects "principle confirmed but evidence thin" (e.g., user said yes verbally but no artifact attached). | None at transition; flags for follow-up. |
| `validated` | Claim with Academic or Operational evidence attached via SUPPORTS edge. | Evidence node attached + SUPPORTS edge created. | Academic OR Operational tier required (Practitioner alone is insufficient). |
| `invalidated` | Claim with contradicting Academic or Operational evidence attached. | New evidence with CONTRADICTS edge attached + new evidence is Academic/Operational tier. | Contradicting evidence must be Academic or Operational. |

## Transition Table (per RESEARCH §4)

These are the allowed transitions. Any transition not in this table is a violation.

| From | To | Trigger | Required Evidence |
|---|---|---|---|
| proposed | confirmed | User APPROVE at Decision Gate | Stage-dependent (Practitioner+ early, Academic/Operational near-commit) |
| proposed | needs_evidence | Larry detects principle-confirmed-but-evidence-thin | None at transition |
| proposed | rejected | User REJECT at Decision Gate | Reason captured per Canon Part 4 |
| needs_evidence | validated | Evidence node attached + SUPPORTS edge created | Academic OR Operational tier required |
| confirmed | validated | Evidence node attached after confirmation | Same as needs_evidence -> validated |
| validated | invalidated | Contradicting Academic/Operational evidence attached + CONTRADICTS edge | New evidence at Academic or Operational tier |
| confirmed | superseded | REPLACES edge from successor (successor must be confirmed) | Successor node must be confirmed |
| confirmed | stale | Auto-marker job fires | None (system-triggered) |
| validated | stale | Auto-marker job fires | None (system-triggered) |

### Forbidden transitions (each one is a violation Phase 109 MUST refuse)

- rejected -> anything (rejected nodes are terminal; create a new node if reconsidering)
- stale -> confirmed (stale node must transition through proposed -> confirmed; auto-stale clears confidence so re-confirmation requires new evidence)
- needs_evidence -> invalidated (needs_evidence is a holding state; invalidation requires the evidence-attached pathway)
- any state -> proposed (proposed is the entry state only; cannot regress without explicit re-creation)

## Status Aliases: Reconciling Existing assumptions.validity Enum

The existing `assumptions` table at `lib/core/memory-ops.cjs:64-74` ships a 4-state validity enum:

```
validity TEXT NOT NULL DEFAULT 'untested' CHECK(validity IN ('untested','supported','contradicted','stale'))
```

Per RESEARCH §4 "Reconciliation with existing assumptions.validity enum", this PARTIALLY conflicts with the new 8-state taxonomy. The status_aliases mapping resolves the conflict:

| Existing `assumptions.validity` | New `review_status` | Notes |
|---|---|---|
| untested | proposed | Default state for any agent-created assumption. |
| supported | validated | The supported state implies evidence is attached; map to validated. |
| contradicted | invalidated | Same semantic; rename for vocabulary consistency. |
| stale | stale | Direct match. No rename. |

The other 4 states in the new taxonomy (`confirmed`, `rejected`, `superseded`, `needs_evidence`) have no equivalent in the old enum; they are net-new and only apply after Phase 109 migration.

Phase 109 MUST run a one-shot SQL migration that:
1. Reads the existing `assumptions.validity` value per row.
2. Looks up the new `review_status` via this status_aliases mapping.
3. Writes the new `review_status` to the migrated graph node.
4. Logs each migration as a `memory_event` row with `event_type: 'state_alias_migration'` per Canon Part 4.

The aliases.yml file (Plan 108-04) carries this mapping in machine-readable form.

## Auto-Stale Rule

Per RESEARCH §4 "Edge case: what triggers status_stale auto-marking?", a node is auto-marked `stale` when ALL of the following are true:

1. Current `review_status` is `confirmed` OR `validated` (not already stale; cannot stale a `proposed` node - those are stale by default semantically).
2. `last_seen_at` is older than 90 days (default; configurable per room via `room.db` settings).
3. No edges from this node have been touched in the same window (no INFORMS, CONTRADICTS, SUPPORTS, etc., touched in the last 90 days).
4. Node type is in the staleable set: `claim`, `assumption`, `decision`, `opportunity`.

Node types NOT staleable (because they are facts about the world, not about beliefs):
- `room`, `folder`, `artifact`, `meeting`, `evidence`, `entity`, `Stakeholder`.

The auto-marker job runs as a Phase 109 nightly job (NOT Phase 108). Phase 108 documents the rule. The job MUST log every stale-marking as a `memory_event` row per Canon Part 4.

## The transitionStatus Chokepoint Contract (Phase 109)

Per RESEARCH §4 "Edge case: silent state machine violations", the closed taxonomy can be violated by any code path that does `UPDATE nodes SET review_status = 'X'` directly. To prevent silent violations, Phase 109 MUST enforce all transitions through a single chokepoint function:

```
transitionStatus(nodeId, fromStatus, toStatus, actorId, reason)
```

Contract:

1. Verifies the `fromStatus` matches the current `review_status` of the node.
2. Verifies the `(fromStatus, toStatus)` tuple is in the allowed transition table above.
3. Writes a `memory_event` row capturing: `event_type='state_transition'`, `node_id=nodeId`, `from_status=fromStatus`, `to_status=toStatus`, `actor=actorId`, `reason=reason`, `timestamp=NOW()`.
4. Updates the node's `review_status` atomically in the same transaction.
5. If `toStatus = 'confirmed'`, verifies `actorId` corresponds to a user (Canon Part 9 invariant: only user can confirm).
6. Returns `{ok: true, event_id}` or throws `TruthStateViolation` with the offending detail.

Phase 109 plan-phase implements this. Phase 108 specifies the contract. Any direct `UPDATE nodes SET review_status` outside this chokepoint is a Phase 9 invariant violation that the pre-commit hook (Plan 108-05) MAY surface (the hook is a CREATE-TABLE-level guard; runtime violations need a different defense - likely a Phase 109 trigger or a wrapper around `db.prepare`).

## Cross-References

- Field declaration: see `PROVENANCE.md` (Plan 108-02) `review_status TEXT NOT NULL DEFAULT 'proposed'`.
- Machine-readable status_aliases: see `aliases.yml` (Plan 108-04) `status_aliases:` section.
- Canon Part 9 invariant SQL query (the canonical `confirmed AND confirmed_by != 'user'` check): see PROVENANCE.md.
- Existing 4-state enum source: `lib/core/memory-ops.cjs:64-74`.
- Evidence tier model: Canon Part 5 (Academic / Operational / Practitioner / None).

## Anti-Patterns Avoided

- No actual SQL migration code (Phase 109).
- No edit to `lib/core/memory-ops.cjs` (Phase 109).
- No edit to `docs/MINDRIAN-CANON.md` (Phase 109 release gate per RESEARCH Anti-Pattern #2).
- No new state added beyond the 8 in CONTEXT D-03 (the taxonomy is closed; additions require canon amendment).
