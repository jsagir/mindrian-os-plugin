---
phase: 125-f-selector-ranker
plan: 01
subsystem: navigation
tags: [projections, f-selector, ranker, brain-priors, investment-gradient, jtbd, governing-thought, framework-chain, canon-part-9, canon-part-7]

# Dependency graph
requires:
  - phase: 122
    provides: data/command-registry.json (slug-to-framework mapping the _jtbdToFramework helper reads)
  - phase: 122-03
    provides: lib/brain/chain-recommender.cjs roomState shape canonical definition (RESEARCH G-03 + G-04)
  - phase: 109
    provides: lib/core/navigation/memory-events.cjs EVENT_TYPES Set + findRecentChanges (Plan 01 extends with framework_invoked)
provides:
  - resolveActiveFrameworks pure projection helper (4-signal precedence per D1)
  - resolveHopDepth pure projection helper (1|2|3 hop slice + rationale per D2)
  - computeInvestmentLevel pure projection helper (continuous 0..1 gradient per D3)
  - framework_invoked added to EVENT_TYPES Set (additive; mirrors 88.2-00 / 116-00 / 117-00 / 110-02 idiom)
  - Test seam _test for direct unit-testing of _extractFrameworkFromThought + _jtbdToFramework
affects: [125-02, 125-03, 125-04, 125-05, 125-06, 125-07, 125-08, 116, 117]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure projection helpers as a SEPARATE module under lib/core/navigation/ (Canon Part 7 extension; navigation.cjs's closed 14-fn surface untouched)"
    - "4-signal precedence Map<name, {name, weight, source}> with first-write-wins per framework"
    - "fs.readFileSync degradation pattern: returns null on any failure, never throws (mirrors chain-recommender.cjs::_jtbdToFramework)"
    - "Test seam _test export for private-helper unit testing without exposing them to public API"

key-files:
  created:
    - lib/core/navigation/projections.cjs
    - lib/memory/navigation-projections.test.cjs
  modified:
    - lib/core/navigation/memory-events.cjs

key-decisions:
  - "Locked function signatures from CONTEXT.md (no drift): resolveActiveFrameworks(roomState) -> Array<{name, weight, source}>; resolveHopDepth(roomState) -> {depth: 1|2|3, rationale: string}; computeInvestmentLevel(roomState) -> {level: number, label: string}"
  - "KNOWN_FRAMEWORK_HINTS scoped to 16 high-traffic frameworks (Beautiful Question, Mullins 7 Domains, SWOT, Porter Five Forces, JTBD, Jobs to be Done, Lean Canvas, Business Model Canvas, Six Thinking Hats, Cynefin, Root Cause Analysis, First Principles, Wardley Map, OKR, Scenario Planning, Design Thinking). Plan 05 may extend; Plan 01 ships the minimal set sufficient for D1 precedence tests."
  - "_jtbdToFramework reads jtbd-taxonomy.json + command-registry.json synchronously via fs.readFileSync; degrades to null on any failure rather than throwing. Mirrors chain-recommender.cjs::_jtbdToFramework contract for consistency."
  - "computeInvestmentLevel clamps negative inputs to 0 (Math.max(0.0, n/10)) to make the cold-start invariant robust against caller bugs"
  - "Test seam _test exports private helpers + KNOWN_FRAMEWORK_HINTS for unit-test direct access without exposing them as public API"

patterns-established:
  - "Pattern 1: Pure-projection helpers under lib/core/navigation/* are the canonical extension surface for Plan 05's f-selector-ranker; no Brain calls, no I/O writes, no db writes -- only fs.readFileSync on registry + taxonomy"
  - "Pattern 2: 4-signal precedence weight ordering (1.0 > 0.75 > 0.5 > 0.25) is the canonical D1 precedence shape; Plan 05 ranker.score formula multiplies these into the local-signal term"
  - "Pattern 3: framework_invoked event_type as the COUNTER SOURCE for any future continuous-gradient projection; downstream callers populate roomState.framework_invocations via findRecentChanges(db, sinceMs, {eventType: 'framework_invoked'}).length"

requirements-completed:
  - RANKER-125-01
  - RANKER-125-02

# Metrics
duration: 3m 32s
completed: 2026-05-13
---

# Phase 125 Plan 01: Projections (resolveActiveFrameworks + resolveHopDepth + computeInvestmentLevel) Summary

**Three pure projection helpers shipped under `lib/core/navigation/projections.cjs` plus the `framework_invoked` event_type extension to `memory-events.cjs` -- the locked input surface that Plan 05's `rankForSelector` will project roomState onto for D4's continuous-gradient scoring formula.**

## Performance

- **Duration:** 3m 32s
- **Started:** 2026-05-13T17:03:06Z
- **Completed:** 2026-05-13T17:06:38Z
- **Tasks:** 2/2 (Task 1 + Task 2)
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments

### Task 1: framework_invoked added to EVENT_TYPES Set

Extended `lib/core/navigation/memory-events.cjs` EVENT_TYPES frozen Set with a single new string `'framework_invoked'`, immediately after `'brain_legacy_path_used'` and preceded by a Phase 125-01 comment block explaining the role (counter source for D3 continuous investment gradient). Additive-only; mirrors the Phase 88.2-00 / 89-07-00 / 116-00 / 117-00 / 110-02 idiom. Existing `tests/test-navigation-memory-events.cjs` continues to pass (10/10) -- the floor-not-exact-count assertion is preserved.

Verification:
- `EVENT_TYPES.has('framework_invoked') === true`
- `grep -c "'framework_invoked'" lib/core/navigation/memory-events.cjs` returns 2 (one in Set, one in comment)
- `grep -c "Phase 125-01" lib/core/navigation/memory-events.cjs` returns 1
- `node --test tests/test-navigation-memory-events.cjs` 10/10 passes (no regression)

### Task 2: projections.cjs with three pure helpers + 20-test coverage

Created `lib/core/navigation/projections.cjs` (201 lines) with the locked signatures from `125-CONTEXT.md`:

**D1 -- `resolveActiveFrameworks(roomState)`**
4-signal precedence projection that returns ordered `Array<{name, weight, source}>` by weight desc:
1. `governing_thought` (CONTEXT signal) -- weight 1.0, source `'governing_thought'`; extracted from free-text via substring scan against 16 KNOWN_FRAMEWORK_HINTS
2. `activeJtbd` (INTENT signal) -- weight 0.75, source `'activeJtbd'`; resolved via jtbd-taxonomy.json methodology_hooks[0] -> command-registry.json -> frameworks[0]
3. `brainAnchors` (MEMORY signal) -- weight 0.5, source `'brain_md'`; iterated through array
4. `recentFrameworks` (TEMPORAL signal) -- weight 0.25, source `'memory_event'`; iterated through array

First-write-wins per framework name (a framework already claimed by a higher signal does NOT also appear at a lower one). Returns `[]` on empty/null/non-object roomState (drives Brain-priors-dominant scoring path in Plan 05).

**D2 -- `resolveHopDepth(roomState)`**
Returns `{depth: 1|2|3, rationale: string}`:
- depth 1: WDP + governing_thought (execution mode)
- depth 2: IDP (exploratory) or WDP w/o governing_thought (moderate)
- depth 3: wicked / undefined / null roomState (default WIDE on ambiguity per CONTEXT.md D2)

Rationale strings include the required keywords for downstream consumers (`well-defined` / `execution` / `ill-defined` / `evolving` / `exploratory` / `wicked` / `no anchor` / `default` / `ambiguity`).

**D3 -- `computeInvestmentLevel(roomState)`**
Returns `{level: number, label: string}`:
- `level = min(1.0, max(0.0, framework_invocations / 10))`
- 4 labels: `'fresh room, ranking with Brain priors'` (0) / `'warming up: Brain + early local signal'` (<0.5) / `'balanced: Brain + memory equal weight'` (<1.0) / `'full local scoring with Brain confidence'` (1.0)

Floors at 0 for missing or negative counter; caps at 1.0 for >= 10 invocations. Drives Plan 05's D4 scoring formula:
```
score = brain_confidence*0.40 + (1-recency_decay)*0.30*investment_level + problem_type_bind*0.30*investment_level
        (normalized to 0..1)
```

**Tests:** 20 `test()` blocks in `lib/memory/navigation-projections.test.cjs` (241 lines) covering the 8 CONTEXT.md Projections acceptance bullets plus null/undefined/negative-input edge guards. All 20 pass via `node --test`. Plan 00's regression test `lib/memory/navigation-write-edge.test.cjs` continues to pass (9/9) -- both 125-01 + 125-00 surfaces under `lib/core/navigation/` coexist cleanly.

## Commits

- `6a8d274` test(125-01): add framework_invoked to EVENT_TYPES Set
- `4b61a07` test(125-01): add failing test for navigation projections (RED) -- 20 tests, all failing as expected (module doesn't exist yet)
- `ad3d440` feat(125-01): implement projections.cjs with 3 pure helpers (GREEN) -- 20/20 passing

All three commits were made with `--no-verify` per parallel-execution wave-1 protocol; the orchestrator validates hooks once after the wave completes.

## Acceptance Criteria Verification

### From CONTEXT.md "Projections" section (8 bullets, all covered):

- [x] resolveActiveFrameworks returns empty on empty roomState (Test 1, 1b)
- [x] resolveActiveFrameworks respects precedence (governing_thought > JTBD > BRAIN.md > memory_event) (Tests 2, 3, 4, 5)
- [x] resolveHopDepth returns 1 for well-defined, 2 for ill-defined, 3 for wicked (Tests 6, 7, 8)
- [x] resolveHopDepth defaults to 3 on ambiguity (Tests 8, 9, 9b)
- [x] resolveHopDepth produces non-empty rationale string (Tests 6, 7, 8, 9)
- [x] computeInvestmentLevel returns 0 for 0 invocations (Test 10, 15, 15b)
- [x] computeInvestmentLevel caps at 1.0 for >= 10 invocations (Tests 13, 14)
- [x] computeInvestmentLevel returns linear interpolation 0.1 to 1.0 for 1-10 invocations (Tests 11, 12, 13)

### From PLAN.md `must_haves`:

- [x] resolveActiveFrameworks returns ordered framework list using 4-signal precedence (Test 5)
- [x] resolveActiveFrameworks returns empty array on empty roomState (Test 1)
- [x] resolveHopDepth returns {depth: 1|2|3, rationale: string}; defaults to 3 on ambiguity (Tests 6-9b)
- [x] computeInvestmentLevel returns {level: 0..1, label: string} with linear interpolation; 0 invocations -> 0.0; 10+ invocations -> 1.0 (Tests 10-14)
- [x] computeInvestmentLevel reads framework_invocations from memory_event log via 'framework_invoked' event_type (Task 1 + roomState.framework_invocations shape)

### From PLAN.md `must_haves.artifacts`:

- [x] `lib/core/navigation/projections.cjs` exists (201 lines >= 120 min)
- [x] `lib/core/navigation/memory-events.cjs` contains `'framework_invoked'`
- [x] `lib/memory/navigation-projections.test.cjs` exists (241 lines >= 150 min); covers all 8 CONTEXT.md acceptance bullets

### EVENT_TYPES Set count check:

Phase 110-02 baseline was 35 entries (per memory-events.cjs comment). Phase 125-01 adds 1 entry. New size 36, validated via:
```
node -e "console.log(require('/home/jsagi/MindrianOS-Plugin/lib/core/navigation/memory-events.cjs').EVENT_TYPES.size)"
# 36
```
The floor-not-exact-count assertion in `tests/test-navigation-memory-events.cjs` (10/10 still passing) confirms regression-safety.

## Deviations from Plan

None -- plan executed exactly as written.

The PLAN.md task action text (Task 2) was followed verbatim:
- Function signatures matched the LOCKED CONTEXT.md spec
- KNOWN_FRAMEWORK_HINTS list matched the PLAN.md action code block
- _jtbdToFramework synchronous fs.readFileSync pattern matched
- Test count: PLAN required >= 16 `test()` blocks; shipped 20 (added 4 edge guards for null/undefined/negative input robustness)

No Rule 1/2/3 auto-fixes were needed. No Rule 4 architectural decisions surfaced.

## Self-Check: PASSED

### Created files exist:
- FOUND: lib/core/navigation/projections.cjs (201 lines)
- FOUND: lib/memory/navigation-projections.test.cjs (241 lines)

### Modified files updated:
- FOUND: lib/core/navigation/memory-events.cjs (added 12 lines; framework_invoked now in EVENT_TYPES Set)

### Commits exist:
- FOUND: 6a8d274 feat(125-01): add framework_invoked to EVENT_TYPES Set
- FOUND: 4b61a07 test(125-01): add failing test for navigation projections (RED)
- FOUND: ad3d440 feat(125-01): implement projections.cjs with 3 pure helpers (GREEN)

### Test outcomes:
- PASS: node --test lib/memory/navigation-projections.test.cjs (20/20)
- PASS: node --test tests/test-navigation-memory-events.cjs (10/10 -- no regression)
- PASS: node --test lib/memory/navigation-write-edge.test.cjs (9/9 -- Plan 00 regression OK)
