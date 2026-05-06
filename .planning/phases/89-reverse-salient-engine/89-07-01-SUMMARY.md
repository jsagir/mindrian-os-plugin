---
phase: 89-reverse-salient-engine
plan: "89-07-01"
subsystem: agentic-surfacing
tags: [reverse-salient, agentic, graph-native, canon-part-2-engine-1, canon-part-4, canon-part-8, wave-1-substrate, cascade-edge-mapping]

# Dependency graph
requires:
  - phase: 89-07-00
    provides: Wave-0 stubs for agent module + 5 test stubs + EVENT_TYPES extension (size 21)
  - phase: 90-brain-derivation-layer
    provides: BRAIN.md per-folder quadruple + readQuadruple chokepoint
  - phase: 109-sql-context-memory-navigation-spine
    provides: lib/core/navigation.cjs read chokepoint (5 functions consumed by agent)
  - phase: 87-security-hardening-cascade-refactor
    provides: typed-edge primitives + EDGE_TYPES list (5 cascade types)
provides:
  - Real ~352 LOC ReverseSalientAgent Wave-1 substrate replacing the Wave-0 not_implemented_yet stub
  - 7 named function exports (gatherFocusContext, gatherBrainContext, composeFinding, emitFindingEdge, mapDirectionToCascadeEdge, runRsEngine, detectAndSurface)
  - Generic upsertEdge(conn, {type, source, target, properties}) primitive added to lib/core/lazygraph-ops.cjs as the typed-edge chokepoint reusable across Phase 116/117/118/120 sibling agents
  - 23 substrate tests (test-reverse-salient-agent.cjs) covering 7-export contract + cascade mapping + composeFinding determinism + schema-tolerant rs-engine reader + emitFindingEdge call shape + 5 anti-pattern grep guards (room-db, brain-client, rs-math reimpl, navigation chokepoint adherence, readQuadruple integration, rs-engine shell-out, all 5 cascade types present)
  - 14 cascade-emit tests (test-reverse-salient-cascade-emit.cjs) covering all 5 cascade types per RESEARCH SCOPE B Section 2 mapping table + REJECT/DEFER skip-paths + GRAPH-NATIVE INVARIANT 1 (every APPROVE produces 1 cascade-edge call)
  - Direction-to-cascade-edge mapping table in code: structural_transfer + |sd|<=0.7 -> INFORMS; structural_transfer + |sd|>0.7 -> ENABLES; semantic_implementation + |sd|<=0.7 -> CONVERGES; semantic_implementation + |sd|>0.7 -> INVALIDATES; whitespace/blindspot -> CONTRADICTS; unknown -> INFORMS (Pitfall 1 default)
affects: [89-07-02, 89-07-03, 116-unresolved-tension-hook, 117-auto-explore-domains-on-first-material, 118-30-second-mva-reward-before-investment, 120-breakthrough-scan-category-g]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy require pattern for mockable dependency injection (emitFindingEdge requires lazygraph-ops inside the function body, not at module load, so tests can substitute the require.cache slot before the agent's first emit call)"
    - "Schema-tolerant pair reader (readPairField + normalizePair accepts canonical + alternate field names; signed_diff/signed_delta + direction/innovation_type) for forward-compat with Plans 89-04/89-05 output schemas (Pitfall 7)"
    - "Deterministic finding.id from sha256(source|target|direction).slice(0,32) for Pitfall 6 idempotency (external referents stable across runs; UPSERT semantics in writer handle DB-side dedup)"
    - "Generic upsertEdge(conn, {type, source, target, properties}) chokepoint primitive in lazygraph-ops.cjs validates type against EDGE_TYPES and runs the same INSERT...ON CONFLICT pattern used elsewhere in the module (Canon Part 7 reuse-before-build)"

key-files:
  created:
    - tests/test-reverse-salient-cascade-emit.cjs (cascade-emission test suite, 14 tests)
  modified:
    - lib/agents/reverse-salient-agent.cjs (Wave-0 stub overwritten with ~352 LOC real substrate)
    - tests/test-reverse-salient-agent.cjs (Wave-0 placeholder overwritten with 23 real assertions)
    - lib/core/lazygraph-ops.cjs (added upsertEdge primitive + export)

key-decisions:
  - "Mapping basis is rs-engine OUTPUT direction field, not invocation MODE: per RESEARCH SCOPE B Section 2 + plan graph_native_invariant_check, the 5-way cascade-edge mapping reads from pair.direction (structural_transfer / semantic_implementation / whitespace / blindspot) NOT from runRsEngine({mode}). Mode is a call parameter; direction is the finding-kind signal."
  - "Generic upsertEdge primitive added to lazygraph-ops.cjs rather than inlining SQL in the agent: the agent must NEVER import room-db.cjs or run raw SQL itself (Phase 109 D-06 chokepoint). Adding a single typed-edge writer to the existing edge-primitives module preserves chokepoint adherence + opens the same primitive to Wave 2 / Phase 116/117/118/120 sibling agents (Canon Part 7 reuse)."
  - "Lazy require pattern for emitFindingEdge: lazygraph-ops is required INSIDE the function body, not at module load, so the cascade-emit test can substitute the require.cache slot before the first emit call without forcing the agent module to be re-required first. Pattern reusable for any agent that needs mockable typed-edge writes."
  - "REJECT/DEFER paths in emitFindingEdge return { skipped: true, reason } rather than writing REJECTED_BECAUSE / DEFERRED edges: per plan, the F.0 dispatcher (Wave 2) owns those edge writes; this Wave-1 helper does NOT duplicate. The reason strings ('rejected_handled_by_f0_dispatcher' / 'deferred_handled_by_f0_dispatcher') document the contract for the Wave 2 wiring."
  - "Schema-tolerant fallback uses Object.prototype.hasOwnProperty.call rather than `in` operator: prevents prototype-pollution false positives on adversarial pair input (defense-in-depth even though rs-engine output is trusted local JSON)."

requirements-completed: [RS-89-07-AGENT, RS-89-07-CASCADE]

# Metrics
duration: 36min
completed: 2026-05-06
---

# Phase 89 Plan 89-07-01: ReverseSalientAgent Wave-1 Substrate Summary

**Replaces Wave-0 stub at lib/agents/reverse-salient-agent.cjs with a real ~352 LOC substrate that proves graph-native HARD RULE invariants 1, 2, 3 in code: navigation.cjs chokepoint adherence + Phase 90 BRAIN.md quadruple LOCAL read + 5-way typed cascade edge emission via lazygraph-ops.upsertEdge + rs-engine.py shell-out (no rs-math reimplementation in Node).**

## Performance

- **Duration:** ~36 minutes
- **Started:** 2026-05-06T08:02:47Z
- **Completed:** 2026-05-06T08:39:03Z
- **Tasks:** 2 (TDD: RED then GREEN for Task 1; GREEN-only for Task 2)
- **Files modified:** 3 (1 created, 3 modified including the Task 1 modification of lazygraph-ops.cjs)

## Accomplishments

- Wave-0 stub at `lib/agents/reverse-salient-agent.cjs` replaced with real ~352 LOC Wave-1 substrate; 7 named function exports (gatherFocusContext, gatherBrainContext, composeFinding, emitFindingEdge, mapDirectionToCascadeEdge, runRsEngine, detectAndSurface) all working
- `gatherFocusContext` composes 5 navigation.cjs functions (getActiveFocus, getNeighborhood, findContradictions, findUnsupportedClaims, findStaleDecisions, findRecentChanges) per Phase 109 chokepoint contract
- `gatherBrainContext` reads Phase 90 BRAIN.md via folder-memory.readQuadruple + isQuadrupleFresh; returns 3 graceful-degradation shapes (`fresh`, `stale_or_offline`, `no_quadruple`); never throws; LOCAL only per Canon Part 8
- `runRsEngine` shells out to `scripts/rs-engine.py` via `child_process.execFileSync`; reads `.rs-engine-results.json`; returns 4 distinct error reasons for graceful Wave-2 telemetry (`invalid_room_dir`, `rs_engine_invocation_failed`, `rs_engine_results_missing`, `rs_engine_results_parse_failed`); HARD RULE 6 enforced (no rs-math reimplementation in Node)
- `normalizePair` schema-tolerant: accepts canonical + alternate field names per Pitfall 7 (`signed_diff` / `signed_delta`, `direction` / `innovation_type`); forward-compatible with Plans 89-04 / 89-05 output schemas without re-edits
- `composeFinding` produces deterministic `finding.id` = sha256(source|target|direction).slice(0,32) per Pitfall 6 idempotency; folds `brain.framework_chain_predictions` (top 3, ` -> ` separator) into `brain_chain_text` when fresh
- `mapDirectionToCascadeEdge` implements the RESEARCH SCOPE B Section 2 mapping table in code with Pitfall 1 default fallback (`unknown` -> `INFORMS`)
- `emitFindingEdge` invokes `lazygraph-ops.upsertEdge` on APPROVE with edgeType from the mapping table + properties.{source: 'rs-engine', agent: 'reverse-salient', signed_diff, abs_diff, finding_id}; REJECT/DEFER paths return `{ skipped: true, reason: '..._handled_by_f0_dispatcher' }` (Wave 2 F.0 dispatcher owns those edge writes)
- Generic `upsertEdge(conn, {type, source, target, properties})` primitive added to `lib/core/lazygraph-ops.cjs` as the typed-edge chokepoint reusable across Phase 116/117/118/120 sibling agents (Canon Part 7 reuse-before-build); validates type against EDGE_TYPES; uses the same `INSERT INTO edges ... ON CONFLICT(source, target, type) DO UPDATE` pattern as the rest of the module
- Anti-pattern source-level grep guards verified: 0 hits for `require.*room-db`, 0 hits for `brain-client`, 0 hits for `TfidfVectorizer|TruncatedSVD|cosine_similarity` in the agent file
- Positive grep: navigation.cjs referenced 4 times, readQuadruple referenced 2 times, rs-engine.py referenced 6 times, all 5 cascade-edge type names appear 14 times across the agent source
- Tests: 23/23 pass in `test-reverse-salient-agent.cjs` + 14/14 pass in `test-reverse-salient-cascade-emit.cjs` = **37/37 Wave-1 substrate tests green**
- Phase 91 Feynman runner: 181/187 passed, 6 failed (improvement of +1 vs Wave-0 baseline of 180/187, 7 failed); zero new failures referencing 89-07; the +1 improvement comes from the substrate tests now exercising real assertions instead of `if`-style checks
- R1 byte-equal invariant preserved on `lib/hmi/shape-f6-renderer.cjs` (sha256 `1792535860abc791222bf0ecf59599d66e49ad9cc1606b3d8679fca2922150cf`)

## Function Inventory

| Export | Inputs | Output | Purpose |
|--------|--------|--------|---------|
| `gatherFocusContext(db, sessionId)` | sqlite db + session id | `{ focus, neighborhood, contradictions, unsupported, stale, recentChanges }` or `null` | Compose 5 navigation.cjs reads (Phase 109 chokepoint) |
| `gatherBrainContext(sectionPath)` | section path string | `{ brain, graceful_degradation }` | Read Phase 90 BRAIN.md LOCAL (Canon Part 8) |
| `runRsEngine({roomDir, mode, topk, no_thesis})` | room dir + mode | `{ ok, pairs, reason? }` | Shell out to scripts/rs-engine.py |
| `composeFinding({pair, focusContext, brainContext})` | normalized pair + contexts | `{ id, source_artifact_id, target_artifact_id, direction, signed_diff, abs_diff, body_text, brain_chain_text }` | Build deterministic finding from rs-engine pair |
| `mapDirectionToCascadeEdge(direction, signed_diff)` | direction string + signed magnitude | one of `INFORMS / CONTRADICTS / CONVERGES / INVALIDATES / ENABLES` | RESEARCH SCOPE B Section 2 mapping |
| `emitFindingEdge(db, finding, userResponse)` | db + finding + APPROVE/REJECT/DEFER | `{ ok, edgeType, result }` or `{ skipped, reason }` | Emit typed cascade edge on APPROVE |
| `detectAndSurface({roomDir, mode, db, sessionId, sectionPath, topk})` | call args | `{ ok, findings, focusContext, brainContext }` | High-level pipeline (Wave 2 wraps with surfaceFinding) |

## Cascade-Edge Mapping Table (RESEARCH SCOPE B Section 2)

| rs-engine `direction` | `abs(signed_diff)` band | Cascade edge type | Test |
|-----------------------|--------------------------|--------------------|------|
| `structural_transfer` | <= 0.7 | `INFORMS` | substrate Test 7 + cascade-emit Test 1 |
| `structural_transfer` | > 0.7 | `ENABLES` | substrate Test 8 + cascade-emit Test 2 |
| `semantic_implementation` | <= 0.7 | `CONVERGES` | substrate Test 9 + cascade-emit Test 3 |
| `semantic_implementation` | > 0.7 | `INVALIDATES` | substrate Test 10 + cascade-emit Test 4 |
| `whitespace` | any | `CONTRADICTS` | substrate Test 11 + cascade-emit Test 5 |
| `blindspot` | any | `CONTRADICTS` | cascade-emit Test 6 |
| any other (Pitfall 1) | any | `INFORMS` | substrate Test 12 + cascade-emit Test 7 |

## Test Pass Counts

| Test file | Tests | Pass | Fail |
|-----------|-------|------|------|
| tests/test-reverse-salient-agent.cjs (Wave-1 substrate) | 23 | 23 | 0 |
| tests/test-reverse-salient-cascade-emit.cjs | 14 | 14 | 0 |
| **Total Wave-1 substrate** | **37** | **37** | **0** |
| Phase 91 Feynman runner full suite | 187 | 181 | 6 (baseline 180/187 7 failed; **+1 pass, no new 89-07 failures**) |

## Anti-Pattern Guard Verification

```
$ grep -F "require.*room-db" lib/agents/reverse-salient-agent.cjs
(0 hits) -- OK Phase 109 D-06 chokepoint preserved at substrate level

$ grep -F "brain-client" lib/agents/reverse-salient-agent.cjs
(0 hits) -- OK Canon Part 8 substrate-level: zero Brain queries from agent

$ grep -E "TfidfVectorizer|TruncatedSVD|cosine_similarity" lib/agents/reverse-salient-agent.cjs
(0 hits) -- OK HARD RULE 6: no rs-math reimplementation in Node
```

Plus positive grep gates:

```
$ grep -c "navigation.cjs" lib/agents/reverse-salient-agent.cjs
4

$ grep -c "readQuadruple" lib/agents/reverse-salient-agent.cjs
2

$ grep -c "rs-engine.py" lib/agents/reverse-salient-agent.cjs
6

$ grep -cE "INFORMS|CONTRADICTS|CONVERGES|INVALIDATES|ENABLES" lib/agents/reverse-salient-agent.cjs
14
```

## Task Commits

Each task was committed atomically with `--no-verify` (parallel executor mode):

1. **Task 1 RED: failing tests for Wave-1 substrate** -- `fb32235` (test) -- 23 tests; 17 fail against Wave-0 stub, 6 pass on grep-only checks
2. **Task 1 GREEN: real ~352 LOC Wave-1 substrate + upsertEdge primitive** -- `401397f` (feat) -- 23/23 pass after substrate replacement
3. **Task 2: cascade-edge emission tests** -- `7a6f9d9` (test) -- 14/14 pass; all 5 cascade types covered

**Plan metadata commit:** Pending (created with this SUMMARY).

## Files Created/Modified

### Created (1)
- `tests/test-reverse-salient-cascade-emit.cjs` -- 14 cascade-emission tests via lazygraph-ops require.cache mock; covers all 5 cascade types + REJECT/DEFER skip-paths + GRAPH-NATIVE INVARIANT 1.

### Modified (3)
- `lib/agents/reverse-salient-agent.cjs` -- Wave-0 33-line stub replaced with 352-line real Wave-1 substrate. 7 function exports; 0 anti-pattern matches; lazy-require pattern for mockable typed-edge writes; schema-tolerant pair reader; deterministic finding.id; rs-engine.py shell-out; all 5 cascade types in mapping.
- `tests/test-reverse-salient-agent.cjs` -- Wave-0 placeholder overwritten with 23 real assertions covering exports + cascade mapping + composeFinding determinism + gatherFocusContext shape + gatherBrainContext degradation modes + runRsEngine schema tolerance + emitFindingEdge call shape (APPROVE/REJECT/DEFER) + 6 anti-pattern grep guards + module-graph audit + 0 em-dashes.
- `lib/core/lazygraph-ops.cjs` -- Added 50-line `upsertEdge(conn, {type, source, target, properties})` primitive + exported it. Validates type against EDGE_TYPES; runs INSERT...ON CONFLICT pattern matching the rest of the module; returns `{ ok, type, source, target }` or `{ ok: false, reason, detail? }`. Reusable across Phase 89-07 Wave 2/3 + Phase 116/117/118/120 sibling agents (Canon Part 7).

## Decisions Made

- **Mapping basis is rs-engine OUTPUT direction, not invocation MODE.** RESEARCH SCOPE B Section 2 + plan graph_native_invariant_check are explicit: the 5-way cascade-edge mapping reads from `pair.direction`, NOT from `runRsEngine({mode})`. Mode is a call parameter (`internal` / `cross-room` / `external` / `hybrid`); direction is the finding-kind signal that survives across modes.
- **Generic upsertEdge primitive in lazygraph-ops.cjs (not inline SQL in the agent).** The agent must NEVER import room-db or run raw SQL itself (Phase 109 D-06 chokepoint). Adding a single typed-edge writer to the existing edge-primitives module preserves chokepoint adherence + opens the same primitive to Wave 2 / Phase 116/117/118/120 sibling agents (Canon Part 7 reuse-before-build).
- **Lazy require pattern for emitFindingEdge.** lazygraph-ops is required INSIDE the function body, not at module load, so the cascade-emit test can substitute the require.cache slot before the first emit call without forcing the agent module to be re-required. Pattern reusable for any agent that needs mockable typed-edge writes.
- **REJECT/DEFER return skip-shapes (not REJECTED_BECAUSE/DEFERRED edges).** Per plan, the F.0 dispatcher (Wave 2) owns those edge writes; this Wave-1 helper does NOT duplicate. The reason strings (`rejected_handled_by_f0_dispatcher` / `deferred_handled_by_f0_dispatcher`) document the contract for the Wave 2 wiring.
- **Schema-tolerant fallback uses Object.prototype.hasOwnProperty.call rather than `in` operator.** Prevents prototype-pollution false positives on adversarial pair input (defense-in-depth even though rs-engine output is trusted local JSON).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Anti-pattern grep guards triggered by inline documentation**
- **Found during:** Task 1 GREEN verification
- **Issue:** Initial agent module body had three documentation comments referencing the literal forbidden strings (`TfidfVectorizer`, `brain-client`, `room-db`) inside the JSDoc-style header that explains the HARD RULE. The Wave-1 substrate test uses tightly-scoped regex (only `require\(...['"]...['"]\)` patterns), but the plan's acceptance criterion uses `grep -F` (any string match), which caught the documentation references as false positives.
- **Fix:** Rewrote the three comment lines to use semantic descriptions instead of the forbidden literals: `direct DB module imports`, `direct Brain client imports`, `rs-math vectorization symbols`. Functional intent preserved (the HARD RULE is still documented); zero behavior change.
- **Files modified:** `lib/agents/reverse-salient-agent.cjs` (4 comment lines)
- **Verification:** All 3 anti-pattern grep guards exit with code 1 (no match) post-fix; all 23 substrate tests still pass.
- **Committed in:** `401397f` (Task 1 GREEN commit; fix landed inline before commit)

**2. [Rule 2 - Missing critical functionality] No typed-edge chokepoint primitive existed for the agent to call**
- **Found during:** Task 1 GREEN preparation
- **Issue:** Plan note in Task 1 acknowledged: "if `lazygraph-ops.cjs` does not export `upsertEdge`, the executor must use the actually-exposed primitive ... The intent is a single typed-edge writer call per APPROVE; the exact API name is whichever the codebase exposes today." Inspection showed lazygraph-ops exposes domain-specific writers (createAnalogyEdge, createIsomorphismEdge, createCascadesToEdge, etc.) but NO generic typed-edge primitive that accepts an arbitrary type from EDGE_TYPES. Without one, the agent would have to either inline SQL (chokepoint violation) or pick one of the domain-specific writers (semantic mismatch -- e.g. createCascadesToEdge writes CASCADES_TO, not the 5 cascade types we need).
- **Fix:** Added a 50-line generic `upsertEdge(conn, {type, source, target, properties})` primitive to lazygraph-ops.cjs + exported it. Validates type against EDGE_TYPES (the existing public list), runs the same INSERT...ON CONFLICT pattern used by the other 7 typed-edge writers in the module, returns `{ ok, type, source, target }` on success or `{ ok: false, reason, detail? }` on validation/SQL failure.
- **Files modified:** `lib/core/lazygraph-ops.cjs` (added function + export entry)
- **Verification:** Smoke test `node -e "...upsertEdge({}, {type: 'INFORMS', ...})"` returns `{ok:false, reason:'edge_write_failed', detail:'conn.prepare is not a function'}` (graceful failure on bad connection); cascade-emit test mocks the function and asserts call shape.
- **Committed in:** `401397f` (Task 1 GREEN commit)
- **Rationale:** This is Rule 2 (missing critical functionality), not Rule 4 (architectural). The primitive is additive; no schema change; no migration; no breaking change to existing edge writers. Reusable across Phase 116/117/118/120 sibling agents per Canon Part 7.

**Total deviations:** 2 auto-fixed (1 Rule 1 documentation bug, 1 Rule 2 missing primitive)
**Impact on plan:** Both fixes landed inline within Task 1 before the GREEN commit. Functional intent of every gate satisfied. No scope creep -- the upsertEdge primitive directly serves Task 1's "single typed-edge writer call per APPROVE" requirement and the plan note explicitly authorized this adjustment.

## Issues Encountered

None blocking. The 2 deviations above were both caught by the verification gates and resolved inline within Task 1's GREEN phase. R1 byte-equal invariant preserved throughout.

## Wave-2 Handoff

**surfaceFinding signature reserved.** Wave 2 (89-07-02) will add a `surfaceFinding({finding, focusContext, brainContext, db, sessionId, personaContext})` export that wraps `detectAndSurface` output with:

1. **F.0 dispatcher integration.** Calls `lib/hmi/shape-f0-renderer.cjs:renderShapeF0` + AskUserQuestion to surface the 3-verb (Approve / Reject / Defer) gate. The F.0 dispatch's accept/reject/defer wires through to `emitFindingEdge` (this Wave's helper) for APPROVE; the dispatcher's own REJECTED_BECAUSE/DEFERRED edge writes happen on REJECT/DEFER (which is why this Wave's `emitFindingEdge` returns skip-shapes for those responses).

2. **Persona-aware framing.** Reads `USER.md` `role_blend` via Phase 115's helper; selects the matching `persona_variants` entry from `agents/reverse-salient-agent.md` frontmatter (10 keys: default + founder + researcher + investor + operator + mentor + domain_expert + student + researcher_ind + founder_grant); appends to `finding.body_text`.

3. **Telemetry mirror.** Calls `lib/core/navigation/memory-events.cjs:logEvent` with `reverse_salient_detected` (on surface) and `reverse_salient_acted_on` (on F.0 response); both EVENT_TYPES were extended in Wave 0 commit `fb297cc`. The `selector_presentation` / `selector_response` Phase 88.2 mirror also fires per the Wave 0 RESEARCH plan.

**Helper functions exposed for Wave 2:**
- `gatherFocusContext`, `gatherBrainContext`, `composeFinding`, `mapDirectionToCascadeEdge`, `runRsEngine`, `emitFindingEdge` (all stable; Wave 2 composes, does not modify)
- `_internal.normalizePair`, `_internal.readPairField` (test surface only; Wave 2 does not need these)

## R1 Invariant Confirmation

```
$ sha256sum lib/hmi/shape-f6-renderer.cjs
1792535860abc791222bf0ecf59599d66e49ad9cc1606b3d8679fca2922150cf  lib/hmi/shape-f6-renderer.cjs
```

Phase 101-01 R1 byte-equal preserved across this plan.

## User Setup Required

None -- no external service configuration required at Wave 1.

## Next Phase Readiness

- **Wave 2 (89-07-02) READY.** F.0 dispatcher wiring + persona-aware framing + recordSelectorMirror telemetry mirror all sit on top of this Wave-1 substrate. Wave 2 only needs to compose `surfaceFinding` from already-working helpers + add the persona-suffix selector + add the dual-surface telemetry call. No Wave-1 substrate change required by Wave 2.
- **Wave 3 (89-07-03) READY.** Pattern doc `docs/AGENTIC-SURFACING-PATTERN.md` + Cypher patch apply + v1.13.0-beta.4 release plumbing. The `upsertEdge` primitive added in Wave 1 will be referenced as the canonical typed-edge chokepoint in the pattern doc.
- **Pattern reuse.** The Wave-1 substrate-then-fill pattern is now templated for Phase 116 (unresolved-tension-hook), 117 (auto-explore-domains), 118 (30-second-mva), 120 (breakthrough-scan) sibling agents. The lazy-require pattern + the `upsertEdge` primitive + the schema-tolerant pair reader are all reusable across those phases without modification.

## Self-Check: PASSED

**Created/modified files (4) verified on disk:**
- FOUND: lib/agents/reverse-salient-agent.cjs (modified, 352 LOC)
- FOUND: tests/test-reverse-salient-agent.cjs (modified, 23 real tests)
- FOUND: tests/test-reverse-salient-cascade-emit.cjs (created, 14 tests)
- FOUND: lib/core/lazygraph-ops.cjs (modified, +upsertEdge primitive)

**Commits verified in git log:**
- FOUND: fb32235 (Task 1 RED: failing tests)
- FOUND: 401397f (Task 1 GREEN: Wave-1 substrate + upsertEdge)
- FOUND: 7a6f9d9 (Task 2: cascade-emit tests)

**End-to-end Wave-1 gate:**
- node --test tests/test-reverse-salient-agent.cjs tests/test-reverse-salient-cascade-emit.cjs -> 37/37 PASS
- 0 anti-pattern matches in agent source (room-db / brain-client / rs-math reimplementation)
- All 5 cascade types present in mapping
- R1 byte-equal preserved (1792535860abc...)
- Phase 91 non-regression: 181/187 (Wave-0 baseline 180/187, +1 improvement, no new 89-07 failures)

---
*Phase: 89-reverse-salient-engine*
*Completed: 2026-05-06*
