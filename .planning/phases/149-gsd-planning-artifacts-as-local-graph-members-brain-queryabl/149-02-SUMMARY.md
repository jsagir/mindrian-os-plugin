---
phase: 149-gsd-planning-artifacts-as-local-graph-members
plan: 02
subsystem: planning
tags: [planning-artifacts, reconcile, graph-bridge, canon-part-9, canon-part-8, session-start, gsd, idempotent-backfill]
requires:
  - lib/core/navigation.cjs (writePlanningArtifactNode + writeRequirementNode + writeLineageEdge + ARTIFACT_NODE_ID + REQUIREMENT_NODE_ID + getNeighborhood -- Plan 01 + Phase 109)
  - lib/core/navigation/planning-artifacts.cjs (the Plan 01 writers; called via the navigation.cjs surface)
  - scripts/session-start (the cascade host; the Phase 124 timeline + Phase 143.1 dial-memory slots are the clone template)
provides:
  - reconcilePlanningArtifacts(roomDir, opts) -- the ONE idempotent backfill = sync spine (discover + classify + upsert nodes + parse requirement ids + wire lineage)
  - classifyArtifactType / discoverPlanningArtifacts / parseRequirementIds helpers
  - the session-start best-effort reconcile slot (D-01 universal net, D-02 trigger, tri-polar coverage)
affects:
  - Plan 03 (PostToolUse writer hook) calls the SAME reconcile function for CLI immediacy
  - Phase 148 execution -- its own artifacts now land in the graph as produced
tech-stack:
  added: []
  patterns:
    - session-start best-effort cascade slot (verbatim clone of Phase 124 timeline + Phase 143.1 dial-memory)
    - caller-owned db-handle spine (mirrors timeline-runner.cjs)
    - source-of-meaning markdown read vs room-data read separation (Canon Part 9 role 1 vs role 2)
    - requirement-as-source INFORMS edges so which-artifacts-touch-<req> is a single outbound getNeighborhood traversal
    - idempotent upsert on stable node/edge ids -> backfill and sync are one code path (D-02)
key-files:
  created:
    - lib/core/planning/reconcile-runner.cjs
    - tests/test-149-requirement-nodes.cjs
    - tests/test-149-backfill.cjs
    - tests/test-149-navigable.cjs
    - tests/test-149-navigation-only-invariant.cjs
  modified:
    - scripts/session-start
decisions:
  - "Lineage orientation within the shipped LINEAGE subset {FEEDS_INTO, VALIDATES, INFORMS}: SPEC FEEDS_INTO CONTEXT FEEDS_INTO PLAN (file lineage); requirement INFORMS SPEC + requirement INFORMS PLAN (requirement-as-source); VERIFICATION VALIDATES requirement. NO new edge type added."
  - "Requirement-as-source INFORMS chosen so the which-artifacts-touch-<req> query is a single outbound getNeighborhood traversal (getNeighborhood is outbound-only: it follows e.source = focus)."
  - "Prune deferred to a follow-up (create + update only). CONTEXT D-02 explicitly permits this; orphan risk recorded below."
metrics:
  duration: ~1 session
  completed: 2026-06-08
  tasks: 3
  files: 6
---

# Phase 149 Plan 02: Reconcile Spine + Session-Start Cascade Slot Summary

One-liner: A single idempotent `reconcilePlanningArtifacts(roomDir, opts)` function walks the room's `.planning/` tree, classifies each artifact by filename suffix, upserts its `planning_artifact` node, parses requirement ids into `requirement` nodes, and writes the FEEDS_INTO / INFORMS / VALIDATES lineage via `navigation.cjs` only, wired into the session-start cascade as a best-effort slot so backfill and ongoing sync are the same code path across CLI / Desktop / Cowork.

## What Was Built

**Task 1 (commit 702bccfd)** -- Wave 0 RED-by-design suites:
- `tests/test-149-requirement-nodes.cjs` (GAM-02): a fixture `.planning/` tree (SPEC with a numbered IRW-01..IRW-08 bolded list + a PLAN whose frontmatter `requirements` field cites IRW-01 + IRW-06) is reconciled into an in-memory room.db; asserts a `requirement` node per id; asserts the which-artifacts-touch-IRW-06 query (a `navigation.getNeighborhood` traversal from the requirement node) returns the SPEC node AND the owning PLAN node.
- `tests/test-149-backfill.cjs` (GAM-07): a fixture with 6 artifacts across 2 phases + 3 requirements; asserts the expected node counts on the first run; runs reconcile AGAIN on the unchanged tree and asserts node AND edge counts are byte-identical (idempotent backfill = sync, D-02).
- `tests/test-149-navigable.cjs` (GAM-05): after a reconcile, asserts a `/mos:graph`-style read (`navigation.getNeighborhood` from the SPEC node, the same graph-ranking read path `/mos:graph` uses) returns the downstream `planning_artifact` nodes (CONTEXT + PLAN), proving reachability from the navigable surface in the active room's room.db.
- `tests/test-149-navigation-only-invariant.cjs` (Canon Part 9): clones the Phase 124 invariant sweep (forbidden brain-client / http / https / node:sqlite / room-db requires + forbidden fetch / http.* / openRoomDb / openGraph calls) over `reconcile-runner.cjs`; asserts the reconcile requires `navigation.cjs`; runs the reconcile under an fs instrument (a mirror of `tests/helpers/fs-instrument.cjs` with the allow-list EXTENDED to permit the fixture `.planning/` subtree) and asserts every fs read is allow-listed (the `.planning/` source-of-meaning markdown + the room.db family) with zero room-data bypass. The header documents the role-1-vs-role-2 distinction.

All four suites RED-by-design at Task 1 (reconcile-runner.cjs absent); the aggregator found them (no longer MISSING) and reported FAILED.

**Task 2 (commit 5b78e917)** -- the reconcile spine:
- `lib/core/planning/reconcile-runner.cjs`: `reconcilePlanningArtifacts(roomDir, opts)` -- the ONE function. `classifyArtifactType(filename)` maps a `.planning` filename to one of the 7 ARTIFACT_TYPES by exact suffix (`-SPEC.md` -> SPEC, etc.), null otherwise. `discoverPlanningArtifacts(planningDir)` walks `planningDir/phases/<phase>/*.md`, returning `[{phase, artifactType, path, status}]` (status from the frontmatter `status:` field, default `present`). `parseRequirementIds(text)` extracts ids via `/\b[A-Z]{2,}-\d{1,3}(\.\d+)?\b/g`, deduped + order-preserving; `parsePlanRequirements` scopes to the PLAN frontmatter `requirements:` bracketed list. The spine groups by phase, upserts every artifact node, parses SPEC + PLAN requirement ids into requirement nodes, and wires the lineage. Mirrors `timeline-runner.cjs`: caller-owned `opts.db` handle, requires ONLY `../navigation.cjs` + `node:fs` + `node:path`, best-effort per-item try/catch. Returns `{upserted, requirement_nodes, edges, pruned, unchanged}`. Idempotence is free: every write is an upsert on a stable id (Plan 01 contract) and edges are upsert on the `(source, target, type)` primary key, so a second pass changes no DB counts.

**Task 3 (commit db2b3680)** -- the session-start cascade slot:
- `scripts/session-start`: a new best-effort slot bounded by `# --- BEGIN gsd planning-artifact reconcile (Phase 149, best-effort) ---` / `# --- END ... ---`, immediately after the Phase 143.1 dial-memory slot. Cloned verbatim from the Phase 124 timeline + Phase 143.1 dial-memory slots: an `env PLUGIN_ROOT_FOR_GSD ACTIVE_ROOM_FOR_GSD node -e '...'` block that resolves the active room (prefer ROOM_DIR, else the MindrianRooms registry resolver -- the SAME resolver, no new one), opens room.db at `roomDir/.mindrian/room.db`, requires `reconcile-runner.cjs`, calls `reconcilePlanningArtifacts(roomDir, {db})`, closes db, writes a one-line stderr summary when `upserted>0`, and ends with `2>/dev/null || true` so a failure never blocks startup. Dog-foods the plugin's own `.planning` by setting `opts.planningDir = PLUGIN_ROOT/.planning` when the active room IS the plugin workspace (resolved-path compare; reuses the existing resolver). This is D-01 (universal safety net) + D-02 (session-start IS the reconcile trigger) + tri-polar (Desktop / Cowork land here -- no PostToolUse hook).

## Verification Results

- `node tests/test-149-requirement-nodes.cjs` -- 2/2 GREEN (requirement nodes + touch-query resolves SPEC + owning PLAN)
- `node tests/test-149-backfill.cjs` -- 2/2 GREEN (first run backfills 6 artifacts + 3 requirements; second run leaves node AND edge counts identical)
- `node tests/test-149-navigable.cjs` -- 2/2 GREEN (planning_artifact nodes in room.db; getNeighborhood read returns them)
- `node tests/test-149-navigation-only-invariant.cjs` -- 4/4 GREEN (no forbidden require / call; requires navigation.cjs; every fs read allow-listed)
- `bash tests/run-all-149.sh` -- 7 passed, 0 failed, 1 MISSING (`test-149-brain-egress.cjs`, owned by Plan 03 by design -- tolerated as MISSING by the aggregator)
- `bash -n scripts/session-start` -- parses; `grep -q reconcile-runner.cjs` matches; the slot has `|| true` (best-effort); zero em-dashes / en-dashes in the added block
- `node lib/memory/navigation-write-edge.test.cjs` -- 9 pass / 0 fail (no writeEdge regression)
- `node tests/test-edges-affiliated-with-floor.cjs` -- 4/4 (ALLOWED_EDGE_TYPES floor preserved; no new edge type added)

## Deviations from Plan

None of the deviation rules (1-4) fired. One within-discretion design decision the plan explicitly delegated:

**Lineage orientation for the requirement links (CONTEXT D / plan discretion within the taxonomy).** `getNeighborhood` traverses OUTBOUND only (`JOIN edges e ON e.source = nh.id`). The plan's which-artifacts-touch-<req> query asks for a traversal FROM the requirement node TO its artifacts. To make that a single navigation.cjs traversal without adding an inbound-neighborhood reader (which would be net-new navigation surface, against Part 7), the requirement-link edges are oriented requirement-as-source: `requirement INFORMS SPEC` and `requirement INFORMS PLAN`. The file lineage (`SPEC FEEDS_INTO CONTEXT FEEDS_INTO PLAN`) and `VERIFICATION VALIDATES requirement` keep the artifact-as-source orientation the SPEC names. All three edge types are members of the shipped LINEAGE subset {FEEDS_INTO, VALIDATES, INFORMS}; NO new taxonomy member was added (writeLineageEdge constrains to the subset; edges.cjs stays the single source of truth). This is exactly the planner-discretion-within-the-taxonomy the CONTEXT D-02 and the SPEC requirement 3 sanction.

## Lifecycle / Prune (deferred per CONTEXT D-02)

The reconcile ships create + update only. Prune-on-archive (deleting `planning_artifact` nodes whose path no longer exists on disk) is DEFERRED to a follow-up, as CONTEXT D-02 and threat T-149-07 explicitly permit. The report shape already carries a `pruned` field (always 0 in this plan) so a follow-up can wire prune without changing the contract.

**Orphan risk:** if a phase folder or artifact file is removed from `.planning/`, its `planning_artifact` node (and any requirement-link edges) remain in room.db as orphans until a prune pass lands. This is bounded: the nodes are system-bookkeeping (Part 9 carve-out), never truth-claims, so an orphan node is a stale navigation entry, not a correctness or security defect. The idempotent upsert keeps live artifacts accurate; only deletions are not yet reflected.

## Canon / Project-Rule Compliance

- Canon Part 9 (navigation chokepoint): the reconcile reads and writes room DATA ONLY via `navigation.cjs`; zero direct room.db opens (no node:sqlite require, no room-db require, no openRoomDb / openGraph -- asserted by the invariant test grep sweep). The `.planning/` markdown read is the source-of-meaning read (role 1), structurally separated from room-data reads (role 2) and proven by the fs-instrument allow-list.
- Canon Part 9 v1.5 (audit-node carve-out): `planning_artifact` + `requirement` nodes are system-bookkeeping (`created_by=system`, `review_status=confirmed` write-completed marker), never truth-claims requiring human confirmation. Inherited from the Plan 01 writers.
- Canon Part 8 (zero Brain egress): the reconcile has no network surface -- no brain-client, no node:http/https, no fetch (asserted by the invariant test). The artifact BODY never lands on a node or edge; node/edge properties carry only generic handles (phase id, artifact_type enum, path handle, status enum, requirement id).
- Canon Part 6 (dog-fooding): the session-start slot points `opts.planningDir` at the plugin's OWN `.planning` when the active room is the plugin workspace -- the plugin's planning artifacts land in its own room graph.
- Canon Part 7 (reuse before build): reuses `navigation.cjs` (writers + getNeighborhood), the shipped LINEAGE subset, the timeline-runner shape, and the session-start cascade host + slot pattern. The only net-new is the reconcile spine + the four suites.
- No em-dashes / en-dashes: confirmed across all created files + the session-start added block (codepoint sweep clean).
- check-sendpacket pre-commit hook: did NOT block any of the three commits (the documented `lib/core/mindrian-brain-shim.test.cjs` false-positive was not triggered; no flag on any new file).

## Known Stubs

None. The reconcile spine is fully wired and tested; the session-start slot is live. The one MISSING aggregator suite (`test-149-brain-egress.cjs`) is owned by Plan 03 by design and is tolerated as MISSING by the aggregator -- it is not a stub in this plan's surface. The `pruned` report field is always 0 (prune deferred per CONTEXT D-02); this is a documented deferral, not a stub.

## Self-Check: PASSED

Created files verified present:
- lib/core/planning/reconcile-runner.cjs FOUND
- tests/test-149-requirement-nodes.cjs FOUND
- tests/test-149-backfill.cjs FOUND
- tests/test-149-navigable.cjs FOUND
- tests/test-149-navigation-only-invariant.cjs FOUND

Modified file verified:
- scripts/session-start contains the reconcile slot (grep reconcile-runner.cjs matches)

Commits verified in git log:
- 702bccfd FOUND (Task 1)
- 5b78e917 FOUND (Task 2)
- db2b3680 FOUND (Task 3)
