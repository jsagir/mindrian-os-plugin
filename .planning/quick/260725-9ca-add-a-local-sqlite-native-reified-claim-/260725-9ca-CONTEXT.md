# Quick Task 260725-9ca: Add a local, SQLite-native reified-claim event pattern (starting with ContradictionEvent) to room.db, mirroring the shape of Phase 132's Brain-side lib/brain/hypergraph-event-schema.cjs, scoped strictly LOCAL per Canon Part 8 - Context

**Gathered:** 2026-07-25
**Status:** Ready for planning

<domain>
## Task Boundary

Add a local, SQLite-native reified-claim event pattern (starting with `ContradictionEvent`) to
room.db. This mirrors the SHAPE of Phase 132's Brain-side `lib/brain/hypergraph-event-schema.cjs`
(a reified event node wired by typed edges to its participants, carrying scalar/enum properties)
but is a NEW, separate, LOCAL-only module. It does not touch, extend, or reuse
`hypergraph-event-schema.cjs` itself, that module is Brain-side (remote Neo4j teaching graph,
generic PWS content) and Canon Part 8 forbids routing local room/repo-specific data through it.

Trigger case (the reason this exists): `.planning/debug/recurring-reach-card-defeats-relevance-gate-and-hsi-clamp-garbage.md`
now documents a claim ("Finding 2 CONFIRMED and FIXED", commit `62b09ee8`) directly contradicted by
later evidence (2026-07-23 and 2026-07-25 recurrences). That is structurally a `ContradictionEvent`:
`claim` + `rivalClaim` + `evidence` + `status(open/resolved)`. Today this can only be expressed as
prose in a markdown file; the goal is to make it expressible as a first-class local graph node.

</domain>

<decisions>
## Implementation Decisions

### Edge vocabulary
Reuse the EXISTING `CONTRADICTS` edge type (already in `lib/core/navigation/edges.cjs`'s
`ALLOWED_EDGE_TYPES`) for the event-to-rivalClaim link, do NOT mint a new `CONTRADICTED_BY` type,
it would be a near-duplicate of an edge type that already means exactly this. Only `CONCERNS` is
genuinely new (no existing edge type means "this event is about that claim") and needs to be added
to `ALLOWED_EDGE_TYPES` via the same additive-comment idiom the file already uses ~20 times.

### Scope: primitive only, no wired caller
Ship the reusable node/edge-writing primitive plus tests only, mirroring
`hypergraph-event-schema.cjs`'s own scope exactly (it too ships with zero automatic callers, Phase
132's own header says "Plan 02 reifies against it"). Do NOT wire a script, hook, or any automatic
caller in this quick task. A caller (manual or automated) is explicitly out of scope, future
follow-up.

### Legal participant node types
Restrict `claim` and `rivalClaim` participants to nodes of type `typed_claim` only for this first
cut. Do not build a generic type-agnostic validator. Extending to more participant types later is
additive (a role-table entry), not a redesign, so this restriction is cheap to lift later and not
worth generalizing prematurely.

### Claude's Discretion
- Exact module file path and function/export names (recommend `lib/core/navigation/reified-claim.cjs`,
  mirroring the existing `lib/core/navigation/*.cjs` submodule convention, registered on the
  navigation.cjs closed surface the same additive-re-export way `writeEdge`/`logMemoryEvent` were).
- Whether `status` transitions (open -> resolved) are handled by this task or left as a documented
  future follow-up (default to: this task only supports create-with-initial-status, no update/resolve
  verb, since that is a second, separable feature).
- Exact deterministic-id hashing details (mirror `deterministicEventId` from
  `hypergraph-event-schema.cjs` as closely as sensible for a SQLite `INSERT ... ON CONFLICT` target
  instead of a Cypher `MERGE`).

</decisions>

<specifics>
## Specific Ideas

Worked acceptance-test example, use it as the concrete test case: reify the recurring-reach-card
RCA contradiction itself, `claim` = a `typed_claim` node representing "Finding 2 fixed (commit
62b09ee8)", `rivalClaim` = a `typed_claim` node representing "recurs anyway (2026-07-23,
2026-07-25 evidence)", `evidence` = a short handle/id (never full prose), `status` = `'open'`.

</specifics>

<canonical_refs>
## Canonical References

- `lib/brain/hypergraph-event-schema.cjs` (Phase 132) -- the shape being mirrored: `EVENT_NODE_TYPES`
  role table (`role`/`node`/`edge`/`kind: participant|scalar`), `deterministicEventId`,
  `buildReifyCypher`. Do NOT reuse or import this file, it is Brain-side.
- `lib/core/navigation/edges.cjs` -- `ALLOWED_EDGE_TYPES` (closed Set, additive-extension-only
  idiom) and `writeEdge(db, params)` (the chokepoint primitive this new module must write edges
  through, never a raw INSERT).
- `lib/core/lazygraph-ops.cjs` -- `insertNode` and the `nodes` table schema (`{id, type,
  properties}`, already generic, no migration needed for a new node `type` value).
- `lib/core/navigation/neighborhood.cjs` -- `getNeighborhood`'s recursive CTE, already type-agnostic,
  confirm (do not need to modify) that a new node type is walkable for free.
- `lib/core/navigation.cjs` -- the closed 13-function chokepoint surface; any new re-export follows
  the same thin additive-re-export idiom as `writeEdge`/`logMemoryEvent`/`firstCapturedLastTouchedBySection`.
- Canon Part 7 (reuse before build), Part 8 (LOCAL -> BRAIN: NO, scalar/enum-only edge properties,
  never prose bodies), Part 9 (navigation.cjs is the single SQL chokepoint).

</canonical_refs>
