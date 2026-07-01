---
phase: 195-fractal-cross-room-memory
plan: 04
type: execute
wave: 3
depends_on: ["195-01"]
autonomous: true
requirements: [FCM-11]
files_modified:
  - lib/core/navigation/edges.cjs
  - lib/core/cross-room-store.cjs
  - lib/core/room-discard-cascade.cjs
  - tests/test-195-umbilical-edge-floor.cjs
user_setup: []
must_haves:
  truths:
    - "UMBILICAL_TO is a member of ALLOWED_EDGE_TYPES beside NESTED_WITHIN; all prior members are preserved (FLOOR, never .size)."
    - "The registry-level cross-room store is the single write chokepoint for UMBILICAL_TO edges at `.rooms/` (not duplicated per room)."
    - "A cross-room UMBILICAL_TO edge round-trips (write then read back) with enum/scalar-only properties."
    - "When a room is deleted, every UMBILICAL_TO edge whose source OR target is that room is purged (no dangling edge)."
    - "A periodic reap sweeps edges pointing at slugs no longer in the registry."
  artifacts:
    - path: "lib/core/navigation/edges.cjs"
      provides: "UMBILICAL_TO minted in ALLOWED_EDGE_TYPES (additive, beside NESTED_WITHIN)"
      contains: "UMBILICAL_TO"
    - path: "lib/core/cross-room-store.cjs"
      provides: "registry-level cross-room store (single write chokepoint) at .rooms/"
      contains: "UMBILICAL_TO"
    - path: "lib/core/room-discard-cascade.cjs"
      provides: "room-deletion cross-room edge purge step"
      contains: "cross-room"
  key_links:
    - from: "lib/core/cross-room-store.cjs write path"
      to: ".rooms/ registry-level store"
      via: "single chokepoint mirroring navigation.cjs writeEdge discipline"
      pattern: "UMBILICAL_TO"
    - from: "room-discard-cascade.cjs::discardPlaceholderRoom"
      to: "cross-room-store purge"
      via: "ordered teardown purges edges whose source OR target room is the discarded slug"
      pattern: "cross-room"
---

<rules>
## RULES (restated every plan - non-negotiable)

- **CJS only. NO em-dashes anywhere (hyphens only).** HARD RULE.
- **Part 8 (LOCAL -> BRAIN: NO):** UMBILICAL_TO edges NEVER egress to the Brain. Properties are ENUM/scalar ONLY (`{relevance, signal, linked_at, session_id}`) - never prose, never a body.
- **Part 9:** all typed edges through the ONE chokepoint; the registry store MIRRORS that single-write-path discipline at `.rooms/` level.
- **Frozen scalars UNTOUCHED.**
- **ONE net-new frozen-set member: UMBILICAL_TO. Mint NO other edge type.** UMBILICAL_TO = PEER-to-peer HORIZONTAL cross-room link (source item_in_room_A, target item_in_room_B); NESTED_WITHIN = parent-child VERTICAL lineage (LOCAL to child room.db). Encode the contrast in the comment block.
- **edges.cjs 205-CONCURRENT CAUTION (CRITICAL):** a parallel Phase-205 session is concurrently adding SHARES_JOB / ELEVATES_TO to the SAME `ALLOWED_EDGE_TYPES` Set (already at edges.cjs:509-510). RE-READ edges.cjs IMMEDIATELY before editing and APPEND UMBILICAL_TO additively without clobbering 205's entries. The FLOOR test asserts MEMBERSHIP + all prior members preserved, NEVER an exact `.size`/count, so an additive change cannot regress the baseline.
- **Type before consumer:** this plan (edge + store) MUST land before Plan 05 (the F.8 fan-out consumer + triggers) - same discipline as entry-23's Wave-1 placement.
- **Resumable:** each task commits independently.
</rules>

<objective>
Wave 3 - Mint the UMBILICAL_TO edge type, build the REGISTRY-LEVEL cross-room store, and reconcile it against room deletion (FCM-11). This is the SEED-044 substrate the cross-room cord (Plan 05) consumes.

Purpose: D-03 locks the cross-room peer edge to a single source of truth at `.rooms/` (unlike NESTED_WITHIN, which lives in the child's LOCAL room.db). The type must exist before its consumers, and the store must reconcile against deletion so no dangling edges survive an orphaned room.
Output: UMBILICAL_TO in ALLOWED_EDGE_TYPES (additive floor); a `cross-room.db` store with a single writeEdge-analog chokepoint; a room-deletion purge + periodic reap.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/195-fractal-cross-room-memory/195-CONTEXT.md
@.planning/phases/195-fractal-cross-room-memory/195-RESEARCH.md
@.planning/phases/195-fractal-cross-room-memory/195-PATTERNS.md
@.planning/phases/195-fractal-cross-room-memory/195-VALIDATION.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Mint UMBILICAL_TO in ALLOWED_EDGE_TYPES (FCM-11a) + extend the edge FLOOR</name>
  <files>lib/core/navigation/edges.cjs, tests/test-195-umbilical-edge-floor.cjs</files>
  <read_first>
    - lib/core/navigation/edges.cjs (PATTERNS.md exact analog: ALLOWED_EDGE_TYPES declared line 32; NESTED_WITHIN:471; SHARES_JOB/ELEVATES_TO:509-510 the 205-additive block; writeEdge:493 validates `ALLOWED_EDGE_TYPES.has(...)`; Set closed ~516). RE-READ THIS FILE IMMEDIATELY BEFORE EDITING (205 concurrency).
    - tests/test-195-umbilical-edge-floor.cjs (Plan 01 authored the membership-only floor; extend it to assert UMBILICAL_TO).
  </read_first>
  <action>RE-READ edges.cjs first (Phase-205 may have appended SHARES_JOB/ELEVATES_TO or more since PATTERNS.md was written). Add `'UMBILICAL_TO'` to `ALLOWED_EDGE_TYPES` using the IDENTICAL additive idiom beside NESTED_WITHIN, appending without clobbering the 205 entries. Add a comment block encoding the semantic contrast: NESTED_WITHIN = parent-child room lineage (source room:&lt;child&gt;, target room:&lt;parent&gt;), a VERTICAL joint, LOCAL to the child's room.db; UMBILICAL_TO = PEER-to-peer sibling link (source item_in_room_A, target item_in_room_B), a HORIZONTAL cross-room connection, properties ENUM/scalar ONLY `{relevance, signal, linked_at, session_id}`, never prose/body. Extend tests/test-195-umbilical-edge-floor.cjs (from Plan 01) to assert UMBILICAL_TO membership AND all prior members (NESTED_WITHIN, SHARES_JOB, ELEVATES_TO, and every baseline type) still present - MEMBERSHIP test, NEVER `.size`. Flip its `run_if` leg to `run` in run-all-195.sh. NO em-dashes.</action>
  <verify>
    <automated>node tests/test-195-umbilical-edge-floor.cjs</automated>
  </verify>
  <acceptance_criteria>node tests/test-195-umbilical-edge-floor.cjs passes: UMBILICAL_TO present; all prior edge types preserved; assertion is membership-based, not a count; 205's SHARES_JOB/ELEVATES_TO intact.</acceptance_criteria>
  <done>The peer edge type is minted additively; the floor guards the baseline.</done>
</task>

<task type="auto">
  <name>Task 2: Registry-level cross-room store (FCM-11b) - single write chokepoint at .rooms/</name>
  <files>lib/core/cross-room-store.cjs, tests/test-195-umbilical-edge-floor.cjs</files>
  <read_first>
    - lib/core/navigation/edges.cjs::writeEdge (:493 - PATTERNS.md role-match: the chokepoint discipline to mirror - positional db + params object, `{ok:...}` return, never throws on caller input, validates against ALLOWED_EDGE_TYPES.has).
    - lib/core/session-presence.cjs (node:sqlite DatabaseSync opener idiom for a registry-level db at `.rooms/`).
    - RESEARCH Item 6c (D-03: registry-level single source of truth; Option A `cross-room.db` recommended over Option B JSON log - navigator discretion; either way WRITE is the ONLY path).
  </read_first>
  <action>Create lib/core/cross-room-store.cjs implementing the registry-level cross-room store at `.rooms/` (Option A recommended: a dedicated `.rooms/cross-room.db` node:sqlite DatabaseSync; Option B JSON edge log `.rooms/umbilical-edges.json` is acceptable per D-03 discretion). Expose a thin writer analogous to edges.cjs writeEdge (the SINGLE write chokepoint - mirror the navigation.cjs single-chokepoint rule at registry level): validate `edge_type === 'UMBILICAL_TO'` and that properties are enum/scalar-only `{relevance, signal, linked_at, session_id}`, return `{ok:...}`, never throw on caller input. Support bidirectional read-back (the seed's acceptance: edges are bidirectionally traversable - trivial SQL query in Option A). Add a read/query helper for a given room slug (edges where source OR target is that room). Extend tests/test-195-umbilical-edge-floor.cjs (or add store assertions there) for a write-then-read round-trip with enum/scalar-only props and bidirectional traversal. NO em-dashes.</action>
  <verify>
    <automated>node tests/test-195-umbilical-edge-floor.cjs</automated>
  </verify>
  <acceptance_criteria>An UMBILICAL_TO edge writes then reads back through the single store chokepoint; properties are enum/scalar-only; a non-UMBILICAL_TO type or a prose property is rejected without throwing; bidirectional traversal returns the edge from either room.</acceptance_criteria>
  <done>The registry-level store is the single source of truth for cross-room peer edges.</done>
</task>

<task type="auto">
  <name>Task 3: Room-deletion reconcile - purge + periodic reap (FCM-11c)</name>
  <files>lib/core/room-discard-cascade.cjs, lib/core/cross-room-store.cjs, tests/test-195-umbilical-edge-floor.cjs</files>
  <read_first>
    - lib/core/room-discard-cascade.cjs (PATTERNS.md exact analog: discardPlaceholderRoom:61 the ordered db->fs->registry teardown - ADD a cross-room-edge purge step).
    - lib/core/session-presence.cjs::reapStalePresence (:210 - PATTERNS.md idiom: the stale-reap pattern for a periodic sweep; STALE_MS at :30).
  </read_first>
  <action>Add a room-deletion reconcile in two layers (both clone shipped idioms): (1) In `discardPlaceholderRoom` (room-discard-cascade.cjs:61) add a step to the ordered teardown that calls cross-room-store to PURGE every UMBILICAL_TO edge whose source OR target room is the discarded slug (no dangling edge survives the cascade). (2) Add a periodic reap to cross-room-store.cjs cloning the `reapStalePresence` (session-presence.cjs:210) stale-reap pattern: sweep edges pointing at slugs no longer in `.rooms/registry.json` (defense-in-depth for rooms deleted outside the cascade). Extend tests/test-195-umbilical-edge-floor.cjs: deleting a room purges its cross-room edges; the reap removes edges to a slug removed from the registry out-of-band. NO em-dashes.</action>
  <verify>
    <automated>node tests/test-195-umbilical-edge-floor.cjs</automated>
  </verify>
  <acceptance_criteria>Deleting a room purges every UMBILICAL_TO edge touching it (via the cascade); the periodic reap removes edges pointing at slugs no longer registered; no dangling edge remains.</acceptance_criteria>
  <done>The cross-room store reconciles against room deletion (orphan-reap, D-03).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| caller -> cross-room-store write | Untrusted edge props could carry prose across a cross-room boundary (Part 8). |
| room deletion -> registry-level store | A deleted room leaves dangling edges if the store is not reconciled. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-195-10 | Information Disclosure | prose in a UMBILICAL_TO property | mitigate | store chokepoint validates enum/scalar-only props `{relevance, signal, linked_at, session_id}`; reject prose without throwing |
| T-195-11 | Integrity | dangling cross-room edge after room deletion | mitigate | discard-cascade purge step + periodic reap of edges to unregistered slugs |
| T-195-12 | Tampering | edge write bypasses the single chokepoint | mitigate | the store exposes ONE write path (mirror navigation.cjs) validating ALLOWED_EDGE_TYPES.has |
| T-195-13 | Tampering | clobbering Phase-205's SHARES_JOB/ELEVATES_TO in the shared Set | mitigate | RE-READ edges.cjs before editing; append additively; FLOOR asserts all prior members preserved |
| T-195-SC | Tampering | npm/pip/cargo installs | accept | ZERO external installs this phase; supply-chain N/A |
</threat_model>

<verification>
- node tests/test-195-umbilical-edge-floor.cjs green (membership + store round-trip + deletion reap).
- bash tests/run-all-195.sh: the umbilical-edge-floor leg flips SKIP -> PASS; 169 edge room-lineage floor still green (NESTED_WITHIN preserved).
- No em-dashes in the modified/created files.
</verification>

<success_criteria>
- UMBILICAL_TO minted additively; baseline edge types preserved.
- Registry-level store is the single write chokepoint; edges round-trip enum/scalar-only, bidirectionally traversable.
- Room deletion + periodic reap leave no dangling cross-room edges.
</success_criteria>

<artifacts_produced>
## Artifacts this phase produces (Plan 04)
- lib/core/navigation/edges.cjs (UMBILICAL_TO minted)
- lib/core/cross-room-store.cjs (registry-level store, single chokepoint)
- lib/core/room-discard-cascade.cjs (cross-room purge step)
- tests/test-195-umbilical-edge-floor.cjs (extended: membership + store + reap)
</artifacts_produced>

<output>
Create `.planning/phases/195-fractal-cross-room-memory/195-04-SUMMARY.md` when done
</output>
