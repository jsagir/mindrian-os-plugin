---
phase: 270-memory-and-context-operator-mcp-consolidate-scattered-local-
plan: 10
subsystem: core+mcp
tags: [graph-native, cross-room, recursive-cte, born-wired]

requires:
  - phase: 270-04
    provides: "the Part 8 cross-room fence RED pin (tests/test-270-cross-room-fence.cjs) legs 4-5 turn green here"
  - phase: 270-07
    provides: "lib/core/icm-forest.cjs, the module findNearestSubRoomDecisions is added to"
  - phase: 270-09
    provides: "the born-wired auto-discovery seam and connector-coverage test graph_reason must clear"
provides:
  - "findTransitiveSupport(db, nodeId, opts) + SUPPORT_EDGE_TYPES (insights.cjs)"
  - "findNearestSubRoomDecisions(parentRoomDir, opts) (icm-forest.cjs)"
  - "graph_reason MCP Tool"
affects: [270-12]

tech-stack:
  added: []
  patterns:
    - "Derived-and-validated edge-type subset: freeze a small array, then throw at require time if any member is not in the frozen ALLOWED_EDGE_TYPES Set -- makes a support-ish or decision-ish vocabulary a DERIVED list, not a second hand-typed taxonomy. Used twice this plan (SUPPORT_EDGE_TYPES, DECISION_EDGE_TYPES)."
    - "Asymmetric direct-vs-broad support check: directlySupported mirrors findUnsupportedClaims's narrow single-type NOT EXISTS exactly, while the recursive walk itself uses the broader support-ish type set -- the gap between the two checks is what makes the three-way distinction (direct / transitive-only / unsupported) real."

key-files:
  created:
    - lib/mcp/tools/graph-reason.cjs
  modified:
    - lib/core/navigation/insights.cjs
    - lib/core/navigation/explanation.cjs
    - lib/core/navigation.cjs
    - lib/core/icm-forest.cjs
    - tests/test-270-cross-room-fence.cjs
    - data/mcp-tool-connectors.json
    - data/connector-registry.json
    - data/connector-coverage-ledger.json
    - data/harness-manifest.json

key-decisions:
  - "SUPPORT_EDGE_TYPES = ['SUPPORTS', 'INSTANTIATES'], not ['SUPPORTS', 'EVIDENCES']. RESEARCH.md 3.3 floated 'EVIDENCES' as an example, but it is NOT a member of edges.cjs's ALLOWED_EDGE_TYPES -- it appears only as a future-facing scoring branch in neighborhood.cjs's edge-weight CASE statement, never added to the frozen Set. INSTANTIATES is: edges.cjs's own DIKW-04 comment names it verbatim as 'the example-EVIDENCES-abstraction edge'. The validation loop at require time means a future rename/retirement of either type fails loudly instead of silently returning empty results."
  - "directlySupported checks ONLY type='SUPPORTS' (mirroring findUnsupportedClaims's own narrow predicate exactly), while the recursive walk follows the full SUPPORT_EDGE_TYPES set. This asymmetry is what makes RESEARCH.md 3.3's exact phrase real: a claim supported ONLY via INSTANTIATES reports directlySupported:false with a depth-1 supporters entry -- 'supported only via a different edge type' -- and a claim reached through an intermediate node reports depth>1 entries -- 'supported transitively.' A single narrow-vs-broad check could not express both; the plan explicitly asked for the three-way distinction and this is what makes it non-vacuous. Verified against a live fixture (see Behavioural proof below)."
  - "findNearestSubRoomDecisions attributes a rolled-up cross-room edge to its originating direct-child room by literal room:<slug> co-occurrence within that same edge row, because rollupSubRooms's flat union carries no per-edge room-origin tag and neither internal helper that WOULD know (_directChildSlugs, _readChildEdgesViaAttach) is exported. This is an honest, real, documented scope limitation (see Finding below), not a silent gap."
  - "DECISION_EDGE_TYPES = ['FILED_AS_DECISION'] only, derived from and validated against ALLOWED_EDGE_TYPES the same way SUPPORT_EDGE_TYPES is. The generic 'decision' node TYPE cannot be checked at all from rollupSubRooms's edge-only union (no node.type is returned), so the id-prefix convention edges.cjs:67 documents ('decision:' + breakthroughId) is read alongside the edge-type check as the only other signal available without opening a second child db connection."
  - "point_in_time / queryAsOf is NOT a mode of graph_reason. Deliberately deferred, not silently omitted (the plan explicitly required recording this decision either way). queryAsOf(db, nodeKey, T_tx, T_v) is a single-node bitemporal point lookup, not a graph traversal, and needs its own (nodeKey, T_tx, T_v) parameter shape unrelated to node_id/max_depth/max_results. Bolting it onto this schema would (a) bloat it for a capability that is not multi-hop, the theme this tool exists to add, and (b) work against RESEARCH.md 2.3's own stated token-budget goal. It already has a navigation.cjs re-export with zero MCP surface and is better served by its own small tool in a later phase."

requirements-completed: [MEMOP-07, MEMOP-13]

duration: 150min
completed: 2026-08-27
---

# Phase 270 Plan 10: Graph-Native Reads (findTransitiveSupport, findNearestSubRoomDecisions, graph_reason) Summary

**Two reads a flat tree or a KV store structurally could not answer now exist: a transitive support closure that distinguishes directly-supported from transitively-supported from unsupported, and a structural-distance ranking of decision nodes ACROSS a room.db boundary. Both reuse shipped machinery (the findBlockingAssumptions recursive-CTE pattern; rollupSubRooms's one sanctioned cross-room ATTACH) rather than inventing new machinery, and both are proven read-only against a real fixture, not merely asserted. A real, pre-existing bug in the phase's own RED-pin test fixture (siblings vs. filesystem nesting) was found and fixed along the way -- it made legs 4-5 structurally unsatisfiable for ANY implementation, not just an incorrect one.**

## Performance

- **Duration:** 150 min
- **Tasks:** 3
- **Files modified:** 9 (1 new, 8 modified/regenerated)

## Accomplishments

### Task 1 -- findTransitiveSupport (lib/core/navigation/insights.cjs)

- `SUPPORT_EDGE_TYPES = Object.freeze(['SUPPORTS', 'INSTANTIATES'])`, validated at require time against `edges.cjs`'s frozen `ALLOWED_EDGE_TYPES` (throws naming the missing member if either is ever renamed/retired).
- `findTransitiveSupport(db, nodeId, opts)`: a `WITH RECURSIVE support(id, depth, via)` CTE modelled line for line on `findBlockingAssumptions`, with the join direction deliberately mirrored (`e.target = s.id`, walking INCOMING support edges upstream from the claim, vs. `findBlockingAssumptions`'s `e.source = c.id` walking outgoing edges downstream from a goal) -- commented explicitly so the mirror reads as intentional, not a typo. Bounded at the same depth (5) `findBlockingAssumptions` uses, inlined rather than imported from `coverage-rollup.cjs` (a different axis: forest-walk depth, not cascade depth).
- `directlySupported` is computed with the SAME narrow predicate `findUnsupportedClaims` already uses (`e.type = 'SUPPORTS'` only), deliberately narrower than the recursive walk's broader `SUPPORT_EDGE_TYPES`. **Behavioural proof, on a live fixture** (claim:X has an INSTANTIATES edge at depth 1 and a SUPPORTS edge at depth 2, no direct SUPPORTS edge):
  ```
  findTransitiveSupport(claim:X) => directlySupported: false, supporters: [
    { id: 'intermediate:m1', depth: 1, viaEdgeType: 'INSTANTIATES', ... },
    { id: 'evidence:e1',     depth: 2, viaEdgeType: 'SUPPORTS',     ... }
  ]
  findUnsupportedClaims(...) still reports claim:X as unsupported: true
  ```
  That three-way split (direct / transitive-only / unsupported) is the actual capability upgrade over the single-hop `NOT EXISTS` check.
- Added a `'transitive_support'` case to `explanation.cjs`'s `renderExplanation` switch (following its existing pattern), rather than letting the kind fall through to the generic `[explanation unavailable...]` default. Not in the plan's `files_modified` list, but the plan's own action text explicitly directs adding the case.
- `findUnsupportedClaims`, `findBlockingAssumptions`, `findContradictions`, `findStaleDecisions` byte-unchanged (`git diff | grep -c` on their names against removed lines returns 0). `edges.cjs` byte-unchanged. No new edge type minted. `tests/test-navigation-insights.cjs` (14/14) unaffected.

### Task 2 -- findNearestSubRoomDecisions (lib/core/icm-forest.cjs)

- `DECISION_EDGE_TYPES = Object.freeze(['FILED_AS_DECISION'])`, same validated-derivation idiom as Task 1's `SUPPORT_EDGE_TYPES`.
- `findNearestSubRoomDecisions(parentRoomDir, opts)`: delegates ENTIRELY to `rollupSubRooms(parentRoomDir)` for cross-room data (zero new `ATTACH DATABASE` anywhere in the file, `grep -c 'rollupSubRooms'` returns 15). Reads the parent's own `NESTED_WITHIN` edges via a plain local `SELECT` on the already-open parent handle (not a second ATTACH -- the same rows `graph-derivation.cjs::_directChildSlugs` reads internally, at the same trust boundary this function already crossed to open the parent db). Ranks by `structuralDistance` = local tree-hop distance from `opts.focusNodeId` to a sub-room's own `room:<slug>` boundary node (via `getNeighborhood` over the parent's OWN graph, the same reachable-set pattern `findContradictions` uses) plus one for crossing the room boundary. No `focusNodeId` -> falls back to a flat tree distance of 1, `_meta.rankedBy: 'tree_distance_only'`.
- `maxResults` hard-capped at **25** server-side regardless of caller input (proven: `{maxResults: 100000}` returns at most 25).
- Writes nothing: zero `INSERT INTO` / `UPDATE` / `DELETE FROM` / `writeEdge(` / `logMemoryEvent(` in the file. Opens the parent db via `navigation.openRoomDbForCaller`, closes in a `finally` (`grep -c 'closeRoomDbForCaller'` returns 1).
- **Structural fixture proof** (own verification fixture, a `FILED_AS_DECISION` edge from `room:child` to `decision:d1`, with `focusNodeId` set on a parent-side claim one hop from `room:child`):
  ```
  { ok: true, parentSlug: 'parent',
    results: [ { nodeId: 'decision:d1', type: 'decision', roomSlug: 'child',
                 roomRelPath: 'child', structuralDistance: 2, viaEdgeType: 'FILED_AS_DECISION' } ],
    counts: { totalCandidates: 1, returned: 1, roomsRead: 1 },
    _meta: { rankedBy: 'focus_and_tree_distance', roomsRead: ['child'], maxResults: 25 } }
  ```
  Every result key is a subset of `['nodeId','type','roomSlug','roomRelPath','structuralDistance','viaEdgeType']`; no string exceeds 512 chars.

- **Bug found and fixed: `tests/test-270-cross-room-fence.cjs`'s own fixture placed the child and `child's-lab` rooms as SIBLINGS of the parent directory under a shared temp home**, but `rollupSubRooms`'s child resolution (`graph-derivation.cjs::_childDirForSlug`) reads ONLY `fs.readdirSync(parentRoomDir)` -- an immediate-subdirectory scan of the parent room's own directory, never of a sibling. With the sibling layout, `_directChildSlugs` correctly read the parent's `NESTED_WITHIN` edges, but `_childDirForSlug` could never resolve either slug to a real directory (the parent directory has zero non-hidden subdirectories), so `_readChildEdgesViaAttach` was never reached and `rollupSubRooms` silently returned `{edges: []}` for this fixture -- **not** the Pitfall P6 splice failure the test exists to catch, just a fixture inconsistent with the function's real, already-shipped contract. Root-caused via 4 standalone diagnostic scripts (isolating `_childDirForSlug`, `_directChildSlugs`, and the raw `ATTACH` mechanics one at a time). Fixed by nesting the child/lab fixtures as real filesystem subdirectories of the parent, matching `icm-forest.cjs`'s own already-established sub-room convention (`icm-forest.cjs:316-323`, "a registered sub-room is a genuine filesystem child"). All five legs now pass, with REAL cross-room data flowing (not vacuously, as legs 1-3 had been doing before this fix, since `rollupSubRooms` always got empty input from the broken fixture too).

- **FINDING recorded for a future pass (not a blocker for this plan):** `rollupSubRooms`'s returned edges carry no per-edge room-origin tag, and neither internal helper that would know (`_directChildSlugs`, `_readChildEdgesViaAttach`) is exported. `findNearestSubRoomDecisions` attributes an edge to a direct-child room by literal `room:<slug>` co-occurrence within that same edge row -- correct for edges that touch a room's own identity node (the pattern the required test fixture and the structural-proof fixture above both use), but NOT a guaranteed-correct mapping for a decision node buried deeper in a child room's local graph with no edge to `room:<slug>`, or for attribution beyond direct children (a grandchild-or-deeper sub-room). A future phase teaching `rollupSubRooms` to carry a `roomSlug` field per returned edge would close this precisely. This is the plan's own anticipated escape hatch ("if rollupSubRooms's return shape does not carry what you need... record that as a finding") applied honestly rather than routed around with a second ATTACH or a direct child-db open (both explicitly forbidden).

### Task 3 -- graph_reason MCP Tool (lib/mcp/tools/graph-reason.cjs)

- ONE tool, `graph_reason`, `mode: z.enum(['transitive_support', 'nearest_sub_room_decisions'])`. Every mode `hitl_shape: 'none'` -- Pitfall P1 (the `tool-router.cjs` `z.enum` anti-pattern) is specifically an enum spanning a MIX of `none` and `F.*` operations, losing per-operation safety tracking; this enum carries no `F.*` operation, so it reuses the one-tool-many-modes shape without inheriting that gap (recorded explicitly, per the acceptance criterion).
- Dispatches to `navigation.findTransitiveSupport(db, node_id, {maxDepth})` (an already-open db handle, the ordinary Part 9 shape) or `icm-forest.cjs`'s `findNearestSubRoomDecisions(roomDir, {focusNodeId, maxResults})` (a room DIRECTORY, since it manages its own cross-room ATTACH lifecycle end to end) -- the asymmetry is commented in the handler.
- Mode-specific validation (`transitive_support` without `node_id`) returns `{ok: false, reason: 'missing_node_id', mode}` rather than throwing.
- Every numeric parameter bounded: `max_depth` 1-5, `max_results` 1-50.
- Does not re-expose `getNeighborhood`: zero calls to it anywhere in the file (the only two occurrences of the string are in header comments explaining why not).
- **The `point_in_time` decision is recorded above under key-decisions** (deferred, not silently omitted).
- Registries regenerated: `data/mcp-tool-connectors.json` (25 MCP-tool connectors, was 24), `data/connector-registry.json`, `data/connector-coverage-ledger.json`, `data/harness-manifest.json` (same drift-on-new-connector regeneration step plans 270-06/270-09 already hit). All three born-wired gates pass; a second `build-connector-registry.cjs` run produces no diff.
- `tests/test-234-tool-description-floor.cjs`: 38 tools (was 37), prose-shape coverage 38/38, `graph_reason`'s description clears the 120-char floor / 2048-byte cap / no-em-dash check on the first try.
- `tests/test-270-connector-coverage.cjs`: 6/6 legs green (38/38 wire tools checked against 25 declared connectors).
- Zero edit to `lib/mcp/register-core-tools.cjs`, `lib/mcp/tool-router.cjs`, or `bin/mindrian-mcp-server.cjs` -- the auto-discovery seam did its job.
- `node scripts/doctor.cjs --acceptance`: 17/18, only the pre-existing environmental `verify-release-clean-tree` failure (a shared-working-tree artifact of concurrent sessions, same baseline every plan this phase has recorded). No new failure.

## Task Commits

1. **Task 1: findTransitiveSupport** -- `068a97e4` (feat)
2. **Task 2: findNearestSubRoomDecisions + fixture fix** -- `18fb3699` (feat)
3. **Task 3: graph_reason MCP Tool** -- `229b760f` (feat)

## Files Created/Modified

- `lib/core/navigation/insights.cjs` -- `findTransitiveSupport`, `SUPPORT_EDGE_TYPES`
- `lib/core/navigation/explanation.cjs` -- `'transitive_support'` case
- `lib/core/navigation.cjs` -- `findTransitiveSupport` re-export
- `lib/core/icm-forest.cjs` -- `findNearestSubRoomDecisions`, `DECISION_EDGE_TYPES`
- `tests/test-270-cross-room-fence.cjs` -- fixture bug fix (sibling -> nested directory layout)
- `lib/mcp/tools/graph-reason.cjs` -- new, the `graph_reason` tool
- `data/mcp-tool-connectors.json`, `data/connector-registry.json`, `data/connector-coverage-ledger.json`, `data/harness-manifest.json` -- regenerated

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Bug fix] `tests/test-270-cross-room-fence.cjs` fixture layout bug (sibling vs. nested directories)**
- **Found during:** Task 2, diagnosing why leg 5 failed even after `findNearestSubRoomDecisions` was fully implemented and correct
- **Issue:** The fixture placed `child`/`child's-lab` as siblings of `parent` under a shared temp home; `rollupSubRooms`'s real, already-shipped child-resolution logic only ever scans immediate subdirectories of the parent room's own directory, so it could never discover either child regardless of what my new function did with the (always-empty) result
- **Fix:** Nested `child`/`child's-lab` as real filesystem subdirectories of `parent`, matching `icm-forest.cjs`'s own established sub-room convention
- **Committed in:** `18fb3699`

**2. [Rule 1 - Necessary, plan-directed] Added a `'transitive_support'` case to `lib/core/navigation/explanation.cjs`**
- **Found during:** Task 1, following the plan's own explicit instruction ("if renderExplanation does not support a new kind, add the kind following its existing pattern rather than bypassing it")
- **Issue:** `explanation.cjs` is not in the plan's `files_modified` frontmatter list, but the plan's action text explicitly requires this edit
- **Fix:** Added the case, following the switch's existing style exactly
- **Committed in:** `068a97e4`

**3. [Rule 1 - Necessary, plan-directed] `data/harness-manifest.json` needed regeneration**
- **Found during:** Task 3, the same drift-on-new-connector gate plans 270-06/270-09 already hit
- **Fix:** Ran `node scripts/build-harness-manifest.cjs`, committed alongside the connector registries
- **Committed in:** `229b760f`

**4. [Verify-command precision] Two of the plan's own `<verify>`/`<acceptance_criteria>` regex checks are whole-file naive scans that produce false positives against my OWN new comment prose (not against pre-existing code)**
- `grep -c 'coverage-rollup' lib/core/navigation/insights.cjs` -- my first draft comment explaining WHY `coverage-rollup.cjs` is not imported literally named the file, tripping the same substring the check forbids. Reworded to describe the module without naming its path.
- The unbounded-parameter check (`s.indexOf(p)` then scanning 200 chars for `.min(`/`.max(`) -- my header comment mentioned `max_depth`/`max_results` by name BEFORE the real schema definition, so `indexOf` found the comment first. Reworded the comment to avoid the literal parameter names.
- Both are cosmetic (the underlying real property -- no forest-depth import, both numerics genuinely bounded -- held throughout); documented so a future reader does not mistake either for a real gap.
- Separately (Task 1 only): the plan's whole-file `/e\.type IN \('/` splice check ALSO matches two PRE-EXISTING, untouched lines (`findBlockingAssumptions`'s `'DEPENDS_ON', 'ASSUMES'` at :97, `findOpenQuestions`'s `'SUPPORTS', 'EVIDENCES'` at :308) that predate this plan and are out of its scope to touch. Verified via `git diff -- lib/core/navigation/insights.cjs | grep '^+.*e\.type IN ('` returning no matches, i.e. confirming none of MY new lines carry the anti-pattern, rather than relying on the whole-file regex which would have already failed against the unmodified file.

---

**Total deviations:** 4 (1 real pre-existing test-fixture bug fixed at its root cause, 1 plan-directed file outside the declared list, 1 now-familiar regeneration step, 1 set of verify-script precision notes). **Impact:** None negative; the fixture fix is a strict improvement (legs 4-5 now exercise real cross-room data instead of passing vacuously on empty input).

## Issues Encountered

**`bash tests/run-all-270.sh`: PASS=8, FAIL=3 both before and after this plan's work, but the COMPOSITION of the 3 failures changed for the better.** Before this plan, `tests/test-270-cross-room-fence.cjs` itself was RED (an uncaught exception at leg 4, since `findNearestSubRoomDecisions` did not exist) -- now that test is fully GREEN (5/5). The 3 failures now are, each already-expected and out of THIS plan's scope:
1. `tests/test-270-identity-write.cjs` -- RED by design until plan 270-11 (Wave 6) ships `identity_write`.
2. `tests/test-270-tool-schema-budget.cjs` -- the SAME designed "drift alarm" plans 270-06 and 270-09 already recorded, now correctly firing again (38 live tools vs. recorded `BASELINE.toolCount = 36`, since this plan legitimately added `graph_reason`). Plan 270-12 owns the final AFTER measurement and baseline update, not this plan.
3. `270 no-em-dash fence` -- fails whenever ANY of its 6 tracked `PART8_TARGETS` files is missing (a single pass/fail leg, not per-file); `lib/mcp/tools/identity.cjs` (plan 270-11) is still the only missing one after this plan (down from two -- `graph-reason.cjs` now exists -- but the leg's own pass/fail verdict does not change until the LAST missing target lands).

The plan's own `<verification>` line ("fails one fewer test than at the end of wave 4") does not cleanly reconcile against my own necessarily-approximate reconstruction of the exact wave-4-end failure set (I did not capture a byte-for-byte snapshot at that exact moment). What is directly, freshly verified: this plan's own RED pin (`test-270-cross-room-fence.cjs`) is now fully green, and re-running the FULL suite before and after each of this plan's 3 commits showed no NEW failure introduced anywhere -- the two other failures both carry an explicit, independently-verifiable reason (a different plan's not-yet-shipped tool; a designed and previously-documented drift alarm), not a regression this plan caused.

## Next Phase Readiness

- Wave 5 (plan 270-10, this plan) is complete. 10 of 12 plans done.
- Plan 270-11 (Wave 6) depends on 270-01, 270-04, 270-10 (all complete) and is now unblocked: ships `identity_write`, built on `writeUserMdAtomic` unmodified, F.1 hitl_shape, MECHANISM half only (trigger deferred to Phase 267.2 per 270-DECISIONS.md's oq2-ship-caller ruling). Will turn `tests/test-270-identity-write.cjs` legs 3-4 green and close the `270 no-em-dash fence` leg (once `identity.cjs` exists, that leg's `EMDASH_MISSING` count drops to 0).
- Plan 270-12 (Wave 7) has three concrete, now-fully-specified inputs from this plan: (a) `tests/test-270-tool-schema-budget.cjs`'s `BASELINE.toolCount` needs updating from 36 to the phase's FINAL tool count (currently 38, but plan 270-11 will add at least one more); (b) the graph-native reads' one recorded scope-limitation FINDING (rollupSubRooms edge-to-room attribution) is available to fold into that plan's own findings ledger if it chooses; (c) the `point_in_time`/`queryAsOf` deferral decision is on record for that plan's OQ-6 gate and beyond.

---
*Phase: 270-memory-and-context-operator-mcp-consolidate-scattered-local-*
*Completed: 2026-08-27*
