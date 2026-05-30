---
phase: 130-lens-engine-skeleton
plan: 02
subsystem: core-library
tags: [lens-engine, rotate, synthesizers, tension-map, comparison-matrix, convergence-map, memory-event, navigation, canon-part-4, canon-part-9, substrate-clean]

# Dependency graph
requires:
  - phase: 130-01
    provides: "INFORMS + REJECTED_BECAUSE on ALLOWED_EDGE_TYPES + lens-nodes.cjs (writeLensFinding / writeHatState) chokepoint via navigation.cjs"
  - phase: 109-sql-context-memory-navigation-spine
    provides: "navigation.cjs chokepoint (writeEdge / writeLensFinding / logMemoryEvent / confirmNode / resolveByUser)"
  - phase: 88.2-uiux-selector-block
    provides: "lib/hmi/selector-dispatcher.cjs dispatchShapeFSubShape (the F.0/F.1/F.4 surfaceSelector dispatch)"
  - phase: 115-owned-emotion-dual-path-first-touch
    provides: "user-md-ops.readUserMd -> role_blend (the persona-aware framing hook input)"
provides:
  - "lib/core/lens-engine.cjs: rotate() engine + LENS_REGISTRY (5 families, only cognitive populated) + ROTATION_MODES (serial/parallel/single)"
  - "lib/core/synthesizers/tension-map.cjs: synthesizeTensionMap (the ONE tension-map, collapses 4 duplicated implementations)"
  - "lib/core/synthesizers/comparison-matrix.cjs: synthesizeComparisonMatrix (Body Shape D table)"
  - "lib/core/synthesizers/convergence-map.cjs: synthesizeConvergenceMap (themes across 3+ lenses)"
  - "5 net-new lens memory_event types on EVENT_TYPES (lens_rotation_started / lens_finding_written / lens_synthesis_completed / lens_finding_accepted / lens_finding_rejected)"
affects: [130-03 cognitive-family-migration, 131 research-as-graph, v1.14.0 domain/source/framework/trend family migrations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single architectural rotate() for-loop with mode dispatch (serial sequential / parallel Promise.all / single one-named-lens) replacing 3+ duplicated rotation loops"
    - "Engine reaches room.db ONLY through navigation.cjs with a CALLER-OWNED db handle (input.db) -- zero direct room-db/sqlite require, substrate-guard clean, NOT allow-listed"
    - "Synthesizers are PURE functions over typed lens-finding node objects (the 130-CONTEXT pre-resolved decision); zero db/fs/sqlite; defensive on empty input"
    - "Mandatory memory_event emission per rotate (Canon Part 9): best-effort via navigation.logMemoryEvent, never aborts the write path"

key-files:
  created:
    - lib/core/lens-engine.cjs
    - lib/core/synthesizers/tension-map.cjs
    - lib/core/synthesizers/comparison-matrix.cjs
    - lib/core/synthesizers/convergence-map.cjs
    - tests/test-130-lens-engine.cjs
  modified:
    - lib/core/navigation/memory-events.cjs
    - tests/run-all-130.sh

key-decisions:
  - "The engine takes a caller-owned db handle via input.db (the lens-nodes / writeEdge convention), NOT a roomDir it opens itself -- this keeps the engine substrate-clean (zero direct room-db require) while still batching a lens_finding node write and its INFORMS/REJECTED_BECAUSE edge on one handle"
  - "synthesize receives the TYPED finding-node objects (the written lens_finding node IDs + parsed properties), NOT the raw perLensFn return arrays -- forces graph-native composition per 130-CONTEXT"
  - "ROTATION_MODES is exactly serial/parallel/single; the source-family weighted-by-context 4th mode is a documented Phase 131 TODO, NOT a member (the source registry slot stays client_count 0)"
  - "Synthesizers use scalar keyword/token scans (no NLP library, no network) so they stay pure and dependency-free per Canon Part 8"

requirements-completed: [LENS-ENGINE-CORE, LENS-ROTATE-INTERFACE, ROTATION-MODES, SYNTHESIZERS-3, LENS-REGISTRY-5, LENS-MEMORY-EVENT]

# Metrics
duration: 5min
completed: 2026-05-31
---

# Phase 130 Plan 02: Lens-Engine + Synthesizers + Lens Event Types Summary

**The single architectural rotate() engine (serial / parallel / single modes over a 5-family registry) plus the 3 consolidated synthesizers and the 5 lens lifecycle memory_event types, all reaching room.db only through navigation.cjs with zero direct substrate access.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-31T01:06Z (RED commit)
- **Completed:** 2026-05-31
- **Tasks:** 3
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments
- Shipped `lib/core/lens-engine.cjs`: the `rotate({lensType, lensSet, input, perLensFn, synthesize, surfaceSelector, persistence, onAccept, onReject, rotationMode})` engine. It is the single for-loop that replaces the rotation logic duplicated at persona-ops.cjs:514, the hat-persistence rotation, and find-analogies Step 4. Plan 03 will point the 4 cognitive-family commands at it as thin clients.
- Three rotation modes over a lens set: `serial` (sequential await), `parallel` (Promise.all over all lenses), `single` (exactly one named lens). A named set ('six-hats') resolves to the 6 hat colors; a dynamic array (['black-hat']) is accepted directly.
- Mandatory memory_event emission per Canon Part 9: `lens_rotation_started` at the start of every rotate, `lens_finding_written` per lens that produced a finding, `lens_synthesis_completed` at the end. The accept/reject paths emit `lens_finding_accepted` / `lens_finding_rejected`.
- `onAccept(lens, finding)` routes to `navigation.writeEdge` with edge_type INFORMS (the lens finding INFORMS a target node); `onReject(lens, finding)` routes to `navigation.writeEdge` with REJECTED_BECAUSE carrying a single enum reason scalar (rejection-as-data per Canon Part 4). When persistence is `memory_event+cascade-edge` and the accept decision sets `promote:true`, the engine routes a human-attributed promotion through `navigation.confirmNode` with `resolveByUser(roomDir)` (a non-agent byUser per Canon Part 9 v1.5).
- `synthesize` receives the TYPED finding-node objects (the written `lens_finding` node IDs + parsed properties), NOT the raw perLensFn return arrays -- the 130-CONTEXT pre-resolved decision that forces graph-native composition. A caller may pass a named strategy ('tension-map' / 'comparison-matrix' / 'convergence-map') or a pure function.
- The persona-aware framing hook reads `role_blend` via `user-md-ops.readUserMd` once per rotate and passes it into every perLensFn ctx (consumes Phase 115).
- `LENS_REGISTRY` has 5 family slots: cognitive populated (client_count 4, lens_sets ['six-hats','black-hat'], synthesizers all 3); domain / source / framework / trend each reserved with client_count 0 and reserved_for 'v1.14.0'. `ROTATION_MODES` is frozen serial/parallel/single (the weighted mode is a Phase 131 TODO).
- Shipped the 3 synthesizers as PURE functions over typed lens-finding node objects: `tension-map.cjs::synthesizeTensionMap` (collapses the 4 duplicated tension-map implementations into ONE -- pairs opposing-stance lenses on the same topic), `comparison-matrix.cjs::synthesizeComparisonMatrix` (Body Shape D table, rows=lenses, columns=dimensions), `convergence-map.cjs::synthesizeConvergenceMap` (clusters themes spanning 3+ lenses per Canon decision 9). Each is defensive (empty input -> empty result, never throws) and carries zero db/fs/sqlite require.
- Added the 5 net-new lens memory_event types to EVENT_TYPES as an additive block mirroring the Phase 129-01 idiom; the test asserts a delta of exactly 5, never an absolute size.
- The substrate guard `scanFiles` returns ZERO violations for the engine + 3 synthesizers -- they reach room.db only through navigation.cjs and are correctly NOT in the allow-list.

## Task Commits

Each task committed atomically (TDD: RED then GREEN):

1. **RED engine + synthesizer suite** - `da8e5d54` (test) - 18 behavior tests, failing because lens-engine.cjs + the 3 synthesizers are absent and the 5 event types are not yet in the Set
2. **Task 1: 5 lens memory_event types + the 3 pure synthesizers** - `ce9819b7` (feat)
3. **Task 2: lens-engine.cjs rotate() + 5-family registry + serial/parallel/single modes** - `99b7e1ac` (feat)
4. **Task 3: register engine suite in run-all-130.sh + substrate-clean + zero-regression gate** - `ce627990` (test)

_TDD note: the RED suite covers both Task 1 and Task 2 behaviors (they share one test file); GREEN was reached in two feat commits, then Task 3 registered the suite + ran the gate._

## Files Created/Modified
- `lib/core/lens-engine.cjs` - the rotate() engine + LENS_REGISTRY + ROTATION_MODES; routes every room.db write through navigation.cjs (writeLensFinding / writeEdge / logMemoryEvent / confirmNode / resolveByUser); zero direct room-db/sqlite require
- `lib/core/synthesizers/tension-map.cjs` - synthesizeTensionMap (the ONE tension-map; 4 duplicates collapse here)
- `lib/core/synthesizers/comparison-matrix.cjs` - synthesizeComparisonMatrix (Body Shape D table generator)
- `lib/core/synthesizers/convergence-map.cjs` - synthesizeConvergenceMap (3+-lens theme clusters)
- `lib/core/navigation/memory-events.cjs` - EVENT_TYPES gains the 5 lens lifecycle types with a Phase 130-02 additive comment block
- `tests/test-130-lens-engine.cjs` - 18 behavior tests (5 EVENT_TYPES + 3 synthesizer + 10 engine), RED then GREEN
- `tests/run-all-130.sh` - registers test-130-lens-engine.cjs after the substrate suite

## Decisions Made
- The engine takes a caller-owned db handle via `input.db` (the lens-nodes / writeEdge convention), deliberately NOT a roomDir it opens itself. Rationale: this is the only signature that keeps the engine substrate-clean (zero `require('room-db.cjs')`, so the guard returns clean on a NON-allow-listed file) while still letting onAccept batch a lens_finding node write AND its INFORMS edge on the same handle. Plan 03 thin clients and the test fixtures open the handle through openRoomDb.
- synthesize receives typed finding-node objects, NOT raw perLensFn arrays (130-CONTEXT pre-resolved decision). The test injects a capturing synthesize function and asserts every element is a `lens_finding:`-prefixed typed node id.
- ROTATION_MODES is exactly serial/parallel/single; the source-family weighted-by-context mode is a documented Phase 131 TODO and is NOT a member, so a caller requesting it gets a clean ok:false until Phase 131 lands it.
- Synthesizers use scalar keyword/token scans (no NLP library, no network, no fs) so they stay pure and dependency-free per Canon Part 8; the convergence-map tokenizes summaries into significant words + bigrams to catch multi-word themes.

## Deviations from Plan

None - plan executed exactly as written. The engine exports rotate / LENS_REGISTRY / ROTATION_MODES per the CONTEXT contract; the 3 synthesizers are pure and tested independently; the 5 lens memory_event types landed additively; onAccept writes INFORMS and onReject writes REJECTED_BECAUSE through navigation.writeEdge; synthesize receives typed node IDs; the persona-aware hook consumes role_blend; the substrate guard returns clean on the engine + synthesizers; zero em-dashes; every commit passed the live substrate guard with NO --no-verify.

## Issues Encountered
None. The m4-cypher substrate-guard false-positive (a literal Cypher keyword token adjacent to a template placeholder) was avoided by construction -- the engine and synthesizers carry no such pattern, and the guard scanFiles confirmed clean before each commit.

## Known Stubs
None. The engine performs real navigation.cjs writes (lens_finding nodes, INFORMS/REJECTED_BECAUSE edges, memory_events) against a real room.db handle; the synthesizers return real structured output over real typed node objects. The 18-test suite exercises serial/parallel/single modes, the mandatory events, the accept/reject edge writes, the typed-findingIds-into-synthesize invariant, the role_blend hook, and the substrate-clean source grep against live fixtures.

## Threat Flags
None. No new network endpoints, auth paths, or trust-boundary surface beyond the plan's threat_model. The engine's only room.db access is through the navigation.cjs chokepoint (T-130-02-01 mitigated, substrate-guard asserted clean); every rotate emits the mandatory memory_events (T-130-02-02 mitigated); synthesizers are pure over typed node IDs (T-130-02-03 mitigated); promotion to confirmed routes through navigation.confirmNode with resolveByUser (T-130-02-04 mitigated); zero new dependencies (T-130-02-SC mitigated).

## Next Phase Readiness
- Plan 03 (cognitive-family migration) can now point think-hats / persona / hat-briefing / challenge-assumptions at `lens-engine.rotate()` as thin clients (the lens set, per-lens prompt, and synthesis strategy declared in command frontmatter), delete the 4 duplicated tension-map implementations, and rewrite hat-persistence.cjs to read/write HatState nodes via navigation.cjs (writeHatState / readHatState / readAllHatStates from Plan 01).
- The 4 reserved registry families (domain / source / framework / trend) are ready for their v1.14.0 migrations.
- run-all-130.sh carries both 130-01 + 130-02 suites; Plans 03/04 append theirs.

## Self-Check: PASSED

---
*Phase: 130-lens-engine-skeleton*
*Completed: 2026-05-31*
