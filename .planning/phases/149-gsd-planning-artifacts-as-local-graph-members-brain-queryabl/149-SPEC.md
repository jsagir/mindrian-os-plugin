# Phase 149: GSD Planning Artifacts as Local-Graph Members (Brain-queryable via typed packets) — Specification

**Created:** 2026-06-08
**Ambiguity score:** 0.13 (gate: <= 0.20)
**Requirements:** 7 locked

## Goal

Every GSD planning artifact becomes a first-class typed node in the active room's LOCAL graph (room.db), with file-level AND requirement-level nodes connected by typed lineage edges, so the planning surface is navigable (`/mos:graph`), reachable from the Decision Gate, and part of the local mind. The remote Brain can query it ONLY through the Part 9 typed-packet contract (generic handles, never artifact prose).

## Background

GSD writes planning artifacts (SPEC / CONTEXT / RESEARCH / VALIDATION / PLAN / VERIFICATION / DISCUSSION-LOG) as flat markdown into `.planning/` - a directory tree that is entirely OUTSIDE `room.db`. There is no GSD-to-graph bridge today: these files cannot be navigated via `/mos:graph`, cannot be reached from the Decision Gate / suggest surface, and are invisible to the local mind. This contradicts Canon Part 9 ("Files preserve meaning. SQL remembers and navigates.") - the artifacts preserve meaning but are not navigable memory.

The substrate to fix it is shipped: `lib/core/navigation.cjs` (Phase 109, the 13-function write chokepoint) is the single door for typed nodes/edges; the Brain typed-packet contract (Phase 110) is the Part 8/9-safe wire; `check-brain-boundary` (Phase 117-04) gates egress. The edge taxonomy already carries `FEEDS_INTO`, `VALIDATES`, `INFORMS`, `SUPPORTS`, `EVIDENCES` (verified in `lib/core/navigation/`). The net-new is a `planning_artifact` node type, a writer hook on the GSD doc lifecycle, and an idempotent backfill.

Origin: navigator note during Phase 148 plan-phase (2026-06-08) - "VALIDATION.md (and all planning artifacts) must be a member of the local graph and queryable by the remote one." Sequenced BEFORE Phase 148 execution so 148's own artifacts land in the graph as they are produced.

## Requirements

1. **Artifact file nodes**: Each GSD planning artifact file is a typed `planning_artifact` node in the active room's room.db.
   - Current: artifacts are flat markdown in `.planning/`, with zero presence in room.db
   - Target: every SPEC / CONTEXT / RESEARCH / VALIDATION / PLAN / VERIFICATION / DISCUSSION-LOG file is a `planning_artifact` node carrying `{phase, artifact_type, path, status}`, written ONLY via `navigation.cjs` (no direct room.db opens)
   - Acceptance: a test asserts that after a GSD doc is written, querying room.db via `navigation.cjs` returns a `planning_artifact` node with the correct `artifact_type` and `path`; a grep-audit asserts no direct `room.db` open in the writer

2. **Requirement nodes**: Each requirement id is a node; granularity is file AND requirement.
   - Current: requirement ids (IRW-06, GAM-02) live only as text inside markdown
   - Target: each requirement id parsed from a SPEC/ROADMAP is a node; artifacts reference the requirements they touch
   - Acceptance: a test asserts that for Phase 148, querying room.db returns nodes for IRW-01..IRW-08, and the query "which artifacts touch IRW-06" returns the SPEC + the owning plan

3. **Typed lineage edges**: Artifact nodes are connected by typed edges, reusing the shipped taxonomy.
   - Current: no edges (artifacts are not in the graph at all)
   - Target: `SPEC FEEDS_INTO CONTEXT FEEDS_INTO PLAN` lineage; `VERIFICATION VALIDATES <requirement>`; `PLAN`->requirement via an existing edge (`INFORMS`/`FEEDS_INTO`) or one additive type if none fits; all edge types resolve from the existing taxonomy or are added additively per the `ALLOWED_EDGE_TYPES` idiom
   - Acceptance: a test asserts the lineage edges exist and a requirement can be traced end-to-end (SPEC -> CONTEXT -> PLAN -> VERIFICATION) via `navigation.cjs` traversal; no bespoke edge type bypasses the taxonomy

4. **Writer hook, idempotent**: Node + edge upsert fires on GSD doc creation/update without duplication.
   - Current: no hook; GSD doc writes have no graph side-effect
   - Target: a hook on the GSD doc-write lifecycle upserts the artifact node + edges; re-running over an existing artifact updates in place, never duplicates
   - Acceptance: a test writes the same artifact twice and asserts exactly one node (and one edge set) exists after the second write (idempotence)

5. **Navigable + Decision-Gate reachable**: The nodes are usable by the existing surfaces.
   - Current: artifacts are unreachable from `/mos:graph` and the Decision Gate
   - Target: `planning_artifact` nodes appear in `/mos:graph` queries and are reachable from the Decision Gate / suggest surface in the active room
   - Acceptance: a test asserts a `/mos:graph`-style query (via the same read path) returns `planning_artifact` nodes; the nodes are in the active room's room.db (dog-fooding: the plugin's `.planning` lands in the mindrianOS room)

6. **Brain boundary (typed-packet only)**: The remote Brain never sees artifact prose.
   - Current: N/A (no bridge exists)
   - Target: any Brain query about planning artifacts carries the Part 9 typed packet only (generic handles: phase id, requirement ids, test names, framework names, status enums) - never the artifact body, filenames-as-content, or any user prose
   - Acceptance: `check-brain-boundary` passes for the new code; an adversarial test asserts that no artifact prose string reaches a Brain packet from the artifact-query path; a grep-audit finds zero raw-egress sites

7. **Backfill, idempotent**: Existing `.planning/` artifacts are ingested on first run.
   - Current: pre-existing artifacts (148-SPEC, all prior phases) are absent from the graph
   - Target: a first-run backfill walks `.planning/` and upserts every existing artifact + its edges; re-running the backfill is idempotent
   - Acceptance: a test runs the backfill on a fixture `.planning/` tree, asserts the expected node/edge count, runs it again, and asserts the count is unchanged

## Boundaries

**In scope:**
- A `planning_artifact` node type + per-requirement nodes in the active room's room.db, written via `navigation.cjs`
- Typed lineage edges (FEEDS_INTO / VALIDATES / requirement links) reusing the shipped taxonomy
- A writer hook on the GSD doc lifecycle (create/update), idempotent
- Idempotent backfill of existing `.planning/` artifacts
- Brain-queryability via the typed-packet contract only; `check-brain-boundary` enforcement
- `/mos:graph` + Decision-Gate reachability of the artifact nodes

**Out of scope:**
- Rendering/visualizing the planning graph in a dashboard - reuse existing `/mos:graph`; no new viewer
- Editing artifacts FROM the graph (write-back to markdown) - the markdown stays source-of-meaning; the graph is the navigable mirror
- Cross-room planning aggregation - one room's `.planning` -> that room's room.db only
- Any change to GSD's markdown format or the artifact templates themselves
- Promoting artifact nodes to `confirmed` truth-claims - planning_artifact is a system-bookkeeping node (Canon Part 9 audit-node carve-out), not a truth-claim requiring human confirmation
- Executing Phase 148 (parked until this lands)

## Constraints

- All graph writes route through `lib/core/navigation.cjs` (Phase 109 chokepoint); zero direct room.db opens (Canon Part 9)
- Zero raw egress to Brain (Canon Part 8 absolute); Brain sees typed packets only (Phase 110 contract); `check-brain-boundary` gates it
- `planning_artifact` + per-requirement nodes are system-bookkeeping nodes (Part 9 audit-node carve-out) - `created_by=system`, exempt from the human-confirm rule, never mislabeled as truth-claims
- Reuse before build (Part 7): navigation.cjs, the existing edge taxonomy (FEEDS_INTO/VALIDATES/INFORMS), the Phase 110 packet, check-brain-boundary; the only net-new is the node type + writer hook + backfill
- No em-dashes in output; tri-polar (CLI / Desktop / Cowork) considered
- `.planning/` is gitignored in this repo - the writer must not assume tracked status

## Acceptance Criteria

- [ ] Every GSD artifact type writes a `planning_artifact` node via `navigation.cjs` (grep-audit: no direct room.db open in the writer)
- [ ] Requirement ids (e.g. IRW-01..08) exist as nodes; "which artifacts touch IRW-06" returns the SPEC + owning plan
- [ ] Lineage edges exist; a requirement traces SPEC -> CONTEXT -> PLAN -> VERIFICATION via `navigation.cjs`
- [ ] Writing the same artifact twice yields exactly one node + one edge set (idempotent)
- [ ] `planning_artifact` nodes are returned by a `/mos:graph` read and live in the active room's room.db
- [ ] `check-brain-boundary` passes; adversarial test: zero artifact prose reaches any Brain packet
- [ ] Backfill ingests a fixture `.planning/` tree; second run leaves node/edge count unchanged
- [ ] No em-dashes anywhere in shipped output

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                              |
|--------------------|-------|------|--------|----------------------------------------------------|
| Goal Clarity       | 0.88  | 0.75 | ✓      | file+requirement nodes, typed-edge lineage, active room |
| Boundary Clarity   | 0.90  | 0.70 | ✓      | explicit out-of-scope (no viewer, no write-back, no cross-room) |
| Constraint Clarity | 0.85  | 0.65 | ✓      | navigation.cjs only; typed-packet only; audit-node carve-out |
| Acceptance Criteria| 0.85  | 0.70 | ✓      | 8 falsifiable checks incl. idempotence + egress    |
| **Ambiguity**      | 0.13  | <=0.20| ✓     |                                                    |

Status: ✓ = met minimum

## Interview Log

| Round | Perspective     | Question summary                          | Decision locked                                          |
|-------|-----------------|-------------------------------------------|----------------------------------------------------------|
| 1     | Boundary Keeper | Node granularity?                         | File-level AND requirement-level nodes                   |
| 1     | Boundary Keeper | Edges or standalone nodes?                | Typed lineage edges (FEEDS_INTO / VALIDATES / requirement links) |
| 1     | Researcher      | Which graph do artifacts join?            | The active room's room.db (dog-fooding into mindrianOS)  |

---

*Phase: 149-gsd-planning-artifacts-as-local-graph-members*
*Spec created: 2026-06-08*
*Next step: /gsd-discuss-phase 149 — implementation decisions (writer-hook trigger, node schema, edge-type mapping)*
