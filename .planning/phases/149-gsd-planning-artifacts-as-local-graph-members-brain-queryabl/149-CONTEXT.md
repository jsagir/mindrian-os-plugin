# Phase 149: GSD Planning Artifacts as Local-Graph Members - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Bridge GSD's flat `.planning/` markdown into the active room's `room.db` as typed, edged, Brain-safe graph nodes: file-level + requirement-level `planning_artifact` nodes connected by typed lineage edges (FEEDS_INTO / VALIDATES / requirement links), written ONLY via `navigation.cjs`, navigable via `/mos:graph`, reachable from the Decision Gate, and Brain-queryable via the Part 9 typed-packet contract only. Built before Phase 148 executes so 148's own artifacts land in the graph as produced.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**7 requirements are locked.** See `149-SPEC.md` for full requirements, boundaries, and acceptance criteria. Downstream agents MUST read `149-SPEC.md` before planning or implementing.

**In scope (from SPEC.md):** `planning_artifact` + per-requirement nodes via navigation.cjs; typed lineage edges (FEEDS_INTO / VALIDATES / requirement links) reusing the shipped taxonomy; a writer hook on the GSD doc lifecycle; idempotent backfill; Brain-queryability via typed-packet only with check-brain-boundary enforcement; /mos:graph + Decision-Gate reachability.

**Out of scope (from SPEC.md):** a new graph viewer (reuse /mos:graph); write-back from graph to markdown; cross-room aggregation; changes to GSD's markdown format; promoting artifact nodes to confirmed truth-claims (they are system-bookkeeping nodes); executing Phase 148.

</spec_lock>

<decisions>
## Implementation Decisions

### Writer-hook trigger
- **D-01:** Hybrid trigger. A **PostToolUse hook** on `.planning/*.md` writes upserts immediately on CLI; an **idempotent session-start reconcile** is the universal safety net that catches anything the hook missed AND covers Desktop/Cowork (which have no PostToolUse hooks). Because the reconcile is idempotent, the hook + reconcile never duplicate. This is the belt-and-suspenders model.

### Backfill + reconcile timing
- **D-02:** Session-start reconcile is the ONE mechanism for both backfill and ongoing sync. First run backfills every existing `.planning/` artifact; every session-start diffs `.planning/` against the graph and upserts changes. Backfill and sync are the same code path (idempotent), so there is no separate one-time backfill to maintain.

### Claude's Discretion
- **Tri-polar (CLI/Desktop/Cowork):** resolved by D-01/D-02. CLI gets immediate landing via the hook; Desktop/Cowork land via the session-start reconcile (works identically everywhere). If a Desktop/Cowork surface needs mid-session landing, an MCP tool can call the SAME reconcile function - no new code path. CLI-first immediacy, universal eventual-consistency.
- **Lifecycle / prune:** default to create + update + **prune-on-archive** - the reconcile diff can detect artifacts/phases removed from `.planning/` and prune their nodes (keeps the graph honest). The planner MAY simplify to create+update-only if reliable delete-detection proves costly; note the orphan risk if so.
- **Reconcile host:** reuse the shipped `scripts/session-start` cascade (the same host Phase 124's FEYNMAN timeline runner rides) rather than a new hook surface.
- **Requirement-link edge type:** reuse an existing taxonomy edge (INFORMS / FEEDS_INTO) for PLAN->requirement; add one additive edge type only if none fits the semantics. Final pick is the planner's within the taxonomy.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/phases/149-gsd-planning-artifacts-as-local-graph-members-brain-queryabl/149-SPEC.md` - locked requirements GAM-01..07. MUST read before planning.

### Substrate (reuse - Canon Part 7)
- `lib/core/navigation.cjs` - the Phase 109 write chokepoint; all node/edge writes route here. Read its upsert + edge functions + the ALLOWED_EDGE_TYPES idiom.
- `lib/core/navigation/` - the edge taxonomy (FEEDS_INTO / VALIDATES / INFORMS / SUPPORTS / EVIDENCES confirmed present) + node types + the audit-node carve-out (`focus.cjs` pattern: `created_by=system review_status=confirmed`).
- `scripts/session-start` - the reconcile host (the cascade that already runs Phase 124's timeline runner; the analog for the idempotent regenerate pattern).
- `lib/core/feynman/timeline-runner.cjs` + `timeline-renderer.cjs` (Phase 124) - the closest analog: a pure renderer reading ONLY via navigation.cjs + an atomic-write runner on the session-start cascade, idempotent. Mirror this shape.
- hooks.json / the PostToolUse hook mechanism - the CLI immediate-landing surface.
- the Brain typed-packet contract (Phase 110) + `check-brain-boundary` (Phase 117-04) - the Part 8/9 egress gate for any Brain query path.

### Canon
- `docs/MINDRIAN-CANON.md` Part 6 (dog-fooding), Part 8 (the boundary - LOCAL->BRAIN NO for raw content), Part 9 (memory locality - SQL is the local mind; the audit-node carve-out that makes `planning_artifact` a legal system-bookkeeping node, exempt from human-confirm).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `navigation.cjs`: the only write door (Part 9). Artifact nodes + edges go through it; never open room.db directly.
- The edge taxonomy already carries FEEDS_INTO + VALIDATES (the two load-bearing lineage edges) - no new edge type needed for the SPEC->CONTEXT->PLAN lineage or VERIFICATION->requirement.
- `scripts/session-start`: the reconcile cron-host; add the artifact reconcile to the existing cascade (like the Phase 124 timeline runner) rather than a new hook.
- Phase 124 (FEYNMAN timeline) is the canonical pattern: session-start cascade + idempotent regenerate + reads only via navigation.cjs + an adversarial Part-9 invariant test. Clone its shape and its test pattern.

### Established Patterns
- Audit-node carve-out (Part 9): `planning_artifact` + requirement nodes are system-bookkeeping (`created_by=system`), so they are canon-legal without human confirmation - mirror `focus.cjs`.
- Idempotent upsert (no duplicate on re-run) is the core invariant - the reconcile diff is the mechanism.
- check-brain-boundary scan gates any Brain-query path; the typed packet carries generic handles only.

### Integration Points
- PostToolUse hook (CLI) -> navigation.cjs upsert (immediate).
- session-start reconcile -> diff `.planning/` vs graph -> navigation.cjs upsert (universal + backfill).
- An MCP tool wrapping the same reconcile for Desktop/Cowork mid-session (optional, discretion).

</code_context>

<specifics>
## Specific Ideas

- The reconcile is the spine: ONE idempotent function does backfill, ongoing sync, tri-polar coverage, and (optionally) prune. The hook is just an immediacy optimization on top of it.
- Mirror Phase 124 (FEYNMAN timeline) end-to-end - it already solved "session-start cascade + idempotent regenerate + navigation.cjs-only + Part-9 invariant test" for a sibling problem.

</specifics>

<deferred>
## Deferred Ideas

- **Lifecycle prune as a hard requirement** - shipped as discretion (create+update+prune-on-archive); if delete-detection is costly the planner may defer prune to a follow-up.
- **Per-command INTAKE design (deck / Feynman / generative commands)** - navigator raised 2026-06-08: generative commands (feynman-engine, MOSDeckEngine, /mos:present, /mos:dashboard) need their OWN per-command intake interaction (what is the deck about, who is it for, add SVG / CSS / animation, PDF download, visual Feynman-per-slide), not just an archetype tag. This is the per-command visual ROLLOUT layer, finer than the 7-archetype mapping. Belongs in **Phase 152** (per-command visual system), NOT Phase 149. Captured so it is not lost.

</deferred>

---

*Phase: 149-gsd-planning-artifacts-as-local-graph-members*
*Context gathered: 2026-06-08*
