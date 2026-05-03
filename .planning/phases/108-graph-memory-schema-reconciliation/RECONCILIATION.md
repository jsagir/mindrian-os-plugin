# Phase 108: Graph Memory Schema Reconciliation

**Status:** Authoritative reconciliation table for RECONCILE-108-01 (nodes) + RECONCILE-108-02 (edges).
**Authority:** This file is the human-readable canonical artifact. The machine-readable companion is `aliases.yml` (Plan 108-04).
**Date:** 2026-05-03
**Source documents:** 108-CONTEXT.md (D-01), 108-RESEARCH.md (section 2 deep-dive + section 2.4 corrections), .planning/research/2026-05-03-codex-graph-memory-proposal.md (provenance), lib/core/lazygraph-ops.cjs:25 (EDGE_TYPES ground truth), lib/core/memory-ops.cjs:23-148 (memory tables ground truth), lib/core/opportunity-ops.cjs (filesystem Opportunity Bank ground truth).

## Resolution Categories (per CONTEXT D-01)

| Resolution | Meaning |
|---|---|
| EXISTS | Already shipped; reuse as-is. No new code or schema in Phase 109. |
| EXTEND | Existing concept; Phase 109 adds fields/properties to existing node/edge type. Additive migration only. |
| NEW | Genuinely new; Phase 109 ships net-new node or edge type. Justified per Canon Part 7 (reuse before build). |
| RESERVED | Name locked in `aliases.yml` to prevent future contributors inventing parallel terms. Schema migration + behavior deferred to a downstream phase that proves the use case. No column, table, or constraint ships in Phase 108 OR Phase 109 for RESERVED entries. |

## RESEARCH.md section 2.4 Corrections Applied

This reconciliation deliberately diverges from CONTEXT.md D-01 in four places, all per RESEARCH section 2.4 code audit:

1. The `EDGE_TYPES` array at `lib/core/lazygraph-ops.cjs:25` ships **23** edges, not the 6 named in CONTEXT D-01. The other 17 are added below as EXISTS rows so the pre-commit hook (Plan 108-05) does not false-positive on legitimate code.
2. `opportunity` is split into two rows: filesystem feature (EXISTS) + graph node (NEW). Phase 88.6 did NOT wire opportunity as a graph node.
3. The three opportunity edges (BANKED_BY, RANKS_OPPORTUNITY, ANSWERS_OPPORTUNITY) are marked NEW, not EXISTS. `grep -rn` across `lib/` and `scripts/` returned zero matches 2026-05-03.
4. `assumption` is marked EXTEND, not NEW. The `assumptions` table at `memory-ops.cjs:64-74` already exists with a partial validity enum.

Plus one addition: `Stakeholder` (existing node type at `lazygraph-ops.cjs:53-65` per Phase 84-05) is added as EXISTS for completeness, although Codex did not propose it.

## Edge Reconciliation

### Codex-proposed edges (14 distinct + 4 already-existing + 3 opportunity = 17 entries here, opportunity edges in their own subsection)

| Codex term | Resolution | Canonical name | Source / Phase | Canon Parts | Justification |
|---|---|---|---|---|---|
| INFORMS | EXISTS | INFORMS | lazygraph-ops.cjs:25 / Phase 87 | Part 4 | Phase 87 cascade refactor edge. In production. |
| CONTRADICTS | EXISTS | CONTRADICTS | lazygraph-ops.cjs:25, 354 / Phase 87 | Part 4 | Phase 87 cascade refactor edge with `confidence` property at line 354. In production. |
| CONVERGES | EXISTS | CONVERGES | lazygraph-ops.cjs:25 / Phase 87 | Part 4 | Phase 87 cascade refactor edge. In production. |
| INVALIDATES | EXISTS | INVALIDATES | lazygraph-ops.cjs:25 / Phase 87 | Part 4 | Phase 87 cascade refactor edge. In production. |
| ENABLES | EXISTS | ENABLES | lazygraph-ops.cjs:25 / Phase 87 | Part 4 | Phase 87 cascade refactor edge. In production. Distinct semantics from SUPPORTS (unblock vs evidence). |
| SUPPORTS | NEW | SUPPORTS | (Phase 109 ships) | Part 4, Part 5, Part 9 (proposed) | Distinct from ENABLES. ENABLES means "X unblocks Y" (cascade). SUPPORTS means "evidence E supports claim C" (Canon Part 5). Aliasing collapses meaning; recommend distinct edge to enable `find_unsupported_claims()` query in Phase 109 as a single edge-type filter. Per RESEARCH section 2.1 + Open Question #1. |
| DEPENDS_ON | NEW | DEPENDS_ON | (Phase 109 ships) | Part 4, Part 9 (proposed) | Phase 87 INFORMS is informational, not load-bearing. Decision/assumption dependency tracking requires explicit DEPENDS_ON. CONTEXT D-01 is correct. |
| EVIDENCES | EXTEND | SUPPORTS | (Phase 109 ships SUPPORTS; EVIDENCES aliased) | Part 4, Part 5, Part 9 (proposed) | Reverse direction of SUPPORTS. Aliases.yml resolution: `EVIDENCES -> SUPPORTS` with `direction: 'reverse'` property convention. Avoids two-edge-types-for-one-relation drift. |
| ASSUMES | NEW | ASSUMES | (Phase 109 ships) | Part 4, Part 9 (proposed) | Decision -> assumption edge. Distinct from DEPENDS_ON (structural) and SUPPORTS (evidential). |
| DECIDES | NEW | DECIDES | (Phase 109 ships) | Part 4, Part 9 (proposed) | Session/event -> decision edge. Captures who/when. Existing `decisions_index` table (memory-ops.cjs:113) tracks decisions with `id, decision, rationale, reversibility, witnesses, date, pressure_context`; the DECIDES edge attaches that table to graph nodes. |
| RAISES_QUESTION | NEW | RAISES_QUESTION | (Phase 109 ships) | Part 4, Part 9 (proposed) | Artifact -> open_question edge. Distinct from CONTRADICTS (between claims). |
| REPLACES | NEW | REPLACES | (Phase 109 ships) | Part 4, Part 9 (proposed) | Decision -> decision edge for supersession. Distinct from INVALIDATES (claim-level). |
| CONTAINS | RESERVED | CONTAINS | (deferred to Phase 112) | Part 4, Part 9 (proposed) | Folder hierarchy is implicit in filesystem (ICM Layer 4). Adding CONTAINS as edge creates duplication unless cross-room traversal needs it. CONTEXT D-01 said "explicit only if needed for cross-room traversal" which is exactly the RESERVED pattern. Name locked; ratification deferred to Phase 112 Room Budding which proves the cross-room traversal use case. Per RESEARCH section 2.1 recommendation. |
| STATES | EXTEND | EXTRACTED_FROM | (existing edge, reverse direction) | Part 4 | `lib/core/lazygraph-ops.cjs:692-701` already ships `EXTRACTED_FROM` edge linking CausalClaim -> Artifact. STATES is the reverse direction (Artifact -> Claim). Aliases.yml resolution: `STATES -> EXTRACTED_FROM` with `direction: 'reverse'`, same pattern as EVIDENCES/SUPPORTS. |
| MENTIONS_ENTITY | NEW | MENTIONS_ENTITY | (Phase 109 ships) | Part 4, Part 9 (proposed) | No existing weak-reference edge. Required for cross-claim entity tracking. |
| BUDDED_FROM | RESERVED | BUDDED_FROM | (deferred to Phase 112) | Part 9 (proposed) | Room -> room edge. Name locked in 108; behavior + ratification deferred to Phase 112 Room Budding. Per CONTEXT D-01 RESERVED row + RESEARCH section 2.1. |
| SHARES_ASSUMPTION_WITH | RESERVED | SHARES_ASSUMPTION_WITH | (deferred to Phase 112) | Part 9 (proposed) | Room -> room edge via shared assumption node. Name locked in 108. Same RESERVED pattern as BUDDED_FROM. |
| REVERSE_SALIENT | EXISTS | REVERSE_SALIENT | lazygraph-ops.cjs:25 / Phase 89 | Part 4 | Phase 89 reverse-salient-engine edge. In production with `source='rs-engine'` property convention per Canon-Phase Map. |

### Opportunity Bank edges (RESEARCH section 2.4 correction: NEW not EXISTS)

| Codex term | Resolution | Canonical name | Source / Phase | Canon Parts | Justification |
|---|---|---|---|---|---|
| BANKED_BY | NEW | BANKED_BY | (Phase 109 ships) | Part 2 Engine 1, Part 4, Part 9 (proposed) | Artifact/decision/whitespace-scan -> opportunity edge. CONTEXT D-01 claimed EXISTS via Phase 88.6 wiring; RESEARCH section 2.4 verified by `grep -rn "BANKED_BY" lib/ scripts/` returns ZERO matches 2026-05-03. The filesystem Opportunity Bank exists (lib/core/opportunity-ops.cjs writes Markdown to room/opportunity-bank/); the graph edge does NOT. |
| RANKS_OPPORTUNITY | NEW | RANKS_OPPORTUNITY | (Phase 109 ships) | Part 2 Engine 1, Part 4, Part 9 (proposed) | HSI score -> opportunity edge. Same correction as BANKED_BY. Zero code references. |
| ANSWERS_OPPORTUNITY | NEW | ANSWERS_OPPORTUNITY | (Phase 109 ships) | Part 2 Engine 1, Part 4, Part 9 (proposed) | Decision/claim -> opportunity edge. Captures opportunity resolution. Zero code references. |

### EXISTS edges NOT named in Codex proposal (RESEARCH section 2.4 correction: 17 unacknowledged edges)

These are the production EDGE_TYPES at `lib/core/lazygraph-ops.cjs:25` that CONTEXT D-01 omitted. Each is added as EXISTS so the pre-commit hook (Plan 108-05) recognizes them as legitimate.

| Canonical name | Source / Phase | Canon Parts | Purpose |
|---|---|---|---|
| BELONGS_TO | lazygraph-ops.cjs:25 | Part 4 | Section/folder membership edge. |
| REASONING_INFORMS | lazygraph-ops.cjs:25 / Phase 88 | Part 4 | Phase 88 Feynman-MINTO reasoning edge. |
| HSI_CONNECTION | lazygraph-ops.cjs:25 / Phase 88.6 | Part 2 Engine 1, Part 4 | HSI scoring substrate edge. |
| ANALOGOUS_TO | lazygraph-ops.cjs:25 | Part 2 Engine 1, Part 4 | Cross-domain analogy edge (Engine 1). |
| STRUCTURALLY_ISOMORPHIC | lazygraph-ops.cjs:25 | Part 2 Engine 1, Part 4 | Cross-domain isomorphism edge. |
| RESOLVES_VIA | lazygraph-ops.cjs:25, 632 | Part 4 | TRIZ-style resolution edge with `resolution_type` property. |
| CAUSES | lazygraph-ops.cjs:25 | Part 4 | CausalClaim chain edge. |
| ROOT_CAUSE_OF | lazygraph-ops.cjs:25 | Part 4 | Root-cause analysis edge. |
| CASCADES_TO | lazygraph-ops.cjs:25, 721 / Phase 87 | Part 4 | Phase 87 cascade edge with `cascade_type` property. |
| EXTRACTED_FROM | lazygraph-ops.cjs:25, 701 | Part 4 | CausalClaim -> Artifact provenance edge. STATES (Codex) aliases to this with reverse direction. |
| WHITESPACE_DETECTED | lazygraph-ops.cjs:25 / Phase 88.6 | Part 2 Engine 1, Part 4 | Engine 1 Wave-1 algorithm output edge. |
| WHITESPACE_NEAR | lazygraph-ops.cjs:25 / Phase 88.6 | Part 2 Engine 1, Part 4 | Engine 1 proximity edge. |
| DISCOVERY_CYCLE_SOURCE | lazygraph-ops.cjs:25 | Part 4 | Discovery pipeline provenance edge. |
| DISCOVERED | lazygraph-ops.cjs:25 | Part 2 Engine 1, Part 4 | Discovery cycle output edge. |
| DERIVED_FROM | lazygraph-ops.cjs:25 / Phase 90 | Part 4, Part 9 (proposed) | General derivation provenance edge (precursor to Part 9 proposed/confirmed pattern). |
| AUTHORED_BY | lazygraph-ops.cjs:25 / Phase 84-05 | Part 2, Part 4 | Stakeholder -> artifact edge. |
| AFFILIATED_WITH | lazygraph-ops.cjs:25 / Phase 84-05 | Part 2, Part 4 | Stakeholder -> stakeholder/org edge. |

## Node Reconciliation

### Codex-proposed nodes (14 entries)

| Codex term | Resolution | Canonical name | Source / Phase | Canon Parts | Justification |
|---|---|---|---|---|---|
| room | EXISTS | room | ~/MindrianRooms/.rooms/registry.json / Phase 83 | Part 1, Part 4 | Existing room registry. |
| folder | EXISTS | folder | Filesystem + ICM Layer 0 ROOM.md (Decision #15) | Part 4 | Filesystem-implicit; ROOM.md identity files. |
| artifact | EXISTS | Artifact | lazygraph-ops.cjs:315-321 / Phase 84 | Part 4 | Markdown file with frontmatter; tracked as `Artifact` node type. |
| claim | NEW | claim | (Phase 109 ships; subsumes CausalClaim per Open Question #2) | Part 4, Part 5, Part 9 (proposed) | `CausalClaim` exists (lazygraph-ops.cjs:670) but is narrowly scoped. A general `claim` node type IS new. Phase 109 decides whether to subsume CausalClaim via `claim_type: 'causal'\|'general'` property (recommended) or coexist. RESEARCH section 2.2 + Open Question #2. |
| assumption | EXTEND | assumption | memory-ops.cjs:64-74 (existing assumptions table; Phase 109 promotes to graph node) | Part 4, Part 9 (proposed) | RESEARCH section 2.4 correction: CONTEXT D-01 said NEW; the table EXISTS with closed validity enum (`untested\|supported\|contradicted\|stale`). Phase 109 EXTEND: promote table rows to graph nodes; map validity enum to review_status via aliases.yml status_aliases section. |
| evidence | NEW | evidence | (Phase 109 ships) | Part 4, Part 5, Part 9 (proposed) | No existing `evidence` table or node type. Currently embedded in artifact body or `evidence/` folder Markdown. |
| decision | EXTEND | decision | memory-ops.cjs:113 (existing decisions_index table; Phase 109 promotes to graph node via DECIDES edge) | Part 3, Part 4, Part 9 (proposed) | `decisions_index` table exists with full schema (id, decision, rationale, reversibility, witnesses, date, pressure_context, status, artifact_path). Phase 109 promotes rows to first-class graph nodes. |
| open_question | NEW | open_question | (Phase 109 ships) | Part 4, Part 9 (proposed) | `sessions.open_questions` is a JSON array property (memory-ops.cjs:50); not a first-class entity. |
| entity | NEW | entity | (Phase 109 ships) | Part 4, Part 9 (proposed) | No existing entity-resolution layer. Required for MENTIONS_ENTITY edge. |
| meeting | EXTEND | meeting | (existing Artifact nodes with `methodology: meeting-intelligence` property; Phase 109 promotes to first-class) | Part 4 | Phase 6 ships meeting artifacts as `Artifact` nodes. EXTEND to first-class with structured properties (date, attendees, transcript_path). |
| opportunity (filesystem) | EXISTS | opportunity (filesystem feature) | lib/core/opportunity-ops.cjs + lib/core/opportunity-extractor.cjs | Part 2 Engine 1 | Filesystem Opportunity Bank exists. HSI-scored, domain-tagged, REACT/REFLECT/ADD interactions, always-ambient, LOCAL-only per Canon Part 8. |
| opportunity (graph node) | NEW | opportunity | (Phase 109 ships) | Part 2 Engine 1, Part 4, Part 9 (proposed) | RESEARCH section 2.4 correction: CONTEXT D-01 marked EXISTS via Phase 88.6; verified by grep that the graph node type does NOT exist. Phase 109 promotes filesystem entries to graph nodes with BANKED_BY / RANKS_OPPORTUNITY / ANSWERS_OPPORTUNITY edges. |
| brain_insight | NEW | brain_insight | (Phase 110 wires the packet contract) | Part 4, Part 8, Part 9 (proposed) | Brain-returned advisory items; always `review_status: 'proposed'` per Canon Part 9 contract. |
| memory_event | NEW | memory_event | (Phase 109 ships) | Part 4, Part 9 (proposed) | The `facts` table (memory-ops.cjs:31) is conceptually similar but is a fact log, not an event log of state transitions. A dedicated `memory_event` table with `event_type: 'state_change'\|'confirmation'\|'rejection'\|...` is genuinely new. |
| human_review | NEW | human_review | (Phase 109 ships) | Part 4, Part 9 (proposed) | Captures the human decision that promoted a `proposed` node to `confirmed` (or rejected). Provenance for Canon Part 9 invariant SQL query. |

### EXISTS nodes NOT named in Codex proposal (RESEARCH section 2.3 addition)

| Canonical name | Source / Phase | Canon Parts | Purpose |
|---|---|---|---|
| Section | lazygraph-ops.cjs:317, 326 | Part 4 | Folder section node type. |
| CausalClaim | lazygraph-ops.cjs:670-680, 747 | Part 4, Part 5 | First-class node with `cause/mechanism/effect/confidence/evidence/source_artifact` properties. Phase 109 may subsume into general `claim` (Open Question #2). |
| Stakeholder | lazygraph-ops.cjs:53-65, 95-117 / Phase 84-05 | Part 2, Part 4 | Person/org/coalition/role with type validation (closed enum at line 71). |

## Open Questions Forwarded to Phase 109

1. **SUPPORTS vs ENABLES distinction.** This reconciliation marks SUPPORTS as NEW (distinct edge). Phase 109 implements; if a unified-edge-with-discriminator-property approach proves cleaner during Phase 109 plan-phase, that decision is allowed (the reconciliation is a contract on what edge names exist, not on their internal representation).
2. **CausalClaim -> claim subsumption.** Phase 109 decides: subsume via `claim_type` property (recommended) or coexist. Either is consistent with this reconciliation.
3. **Pre-commit hook scope (which directories scan for SQL DDL).** Plan 108-05 (Wave 3) decides; default is `lib/core/*-ops.cjs`.

## Anti-Patterns Avoided

- No net-new edge invented beyond Codex proposal AND existing codebase (RESEARCH Pitfall 5).
- No edit to `docs/MINDRIAN-CANON.md` (Phase 109 release gate; RESEARCH Anti-Pattern #2).
- No SQL migration code in this file (Phase 109).
- No row asserts EXISTS without a verified code reference (RESEARCH section 2.4 corrections applied for opportunity).
