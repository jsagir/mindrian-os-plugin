---
phase: 125-f-selector-ranker
plan: 03
subsystem: navigation
tags: [packet, framework-chain-hint, buildBrainPacket, async-migration, canon-part-8, canon-part-9, schema-validation]

# Dependency graph
requires:
  - phase: 125-01
    provides: lib/core/navigation/projections.cjs (resolveActiveFrameworks + resolveHopDepth)
  - phase: 125-02
    provides: lib/brain/framework-chain-slice.cjs (fetchFrameworkChainSlice async fetcher + graceful degradation envelope)
  - phase: 125-04
    provides: data/brain-packet-schema.json $defs.FrameworkChainHint + optional property on LocalGraphSummary
  - phase: 110-brain-context-packet-contract
    provides: buildBrainPacket Phase 110 invariant (packet_version 1.0 + origin + privacy_mode + 6 local_graph_summary fields + ajv2020 per-job validator)
provides:
  - buildBrainPacket async + framework_chain_hint stitch in local_graph_summary
  - _surfaceFrameworkChainHint private helper (test seam under module.exports._test)
  - Absent-when-empty invariant via Object.assign empty-object short-circuit
  - Present-but-degraded shape preservation when Brain unreachable (per RESEARCH G-08)
  - 14-test coverage suite (lib/memory/packet-chain-hint.test.cjs)
affects: [125-05 f-selector-ranker (reads packet.local_graph_summary.framework_chain_hint.edges for scoring), 116 tension hook, 117 auto-explore]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Object.assign empty-object short-circuit for OPTIONAL schema field absence (preserves Plan 04 invariant: framework_chain_hint NOT in LocalGraphSummary.required[])"
    - "Test seam under module.exports._test for direct helper unit testing without exposing private helpers as public API (mirrors 125-01 projections.cjs pattern)"
    - "Async-migration of a shipped chokepoint with mechanical cascade fix-up across 5 sibling test files (Rule 3 - Blocking auto-fix)"
    - "Defensive try/catch around fetcher even though Plan 02 contract guarantees no-throw (belt-and-suspenders for future mock replacements)"

key-files:
  created:
    - lib/memory/packet-chain-hint.test.cjs
  modified:
    - lib/core/navigation/packet.cjs
    - tests/test-navigation-packet-builder.cjs
    - tests/test-navigation-packet-part8-leak.cjs
    - tests/test-navigation-acceptance.cjs
    - tests/test-brain-packet-validation-per-job.cjs
    - tests/test-brain-packet-part8-invariant-per-job.cjs

key-decisions:
  - "buildBrainPacket signature change: function -> async function. Parameter list unchanged (db, job, focusNodeId, opts); return type changes from Packet to Promise<Packet>. This is the smallest viable transition to consume Plan 02's async fetcher inside the existing chokepoint without breaking the D-01 single-builder invariant."
  - "Object.assign empty-object short-circuit in local_graph_summary block: when frameworkChainHint is undefined, Object.assign with an empty object {} guarantees the framework_chain_hint key is ABSENT (not present with undefined value). This matches Plan 04 schema: optional property; absence is meaningful."
  - "Hint STILL ATTACHED when Brain unreachable (per Plan 02 degraded envelope contract). The presence/absence distinguishes 'active set empty' (no anchor) from 'active set non-empty but Brain failed' -- Plan 05 ranker needs this signal to choose between chain-recommender-only and degraded scoring."
  - "Mock-fetcher seam via opts._mocks.fetchFrameworkChainSlice. Mirrors the existing Phase 109 _mocks pattern (jtbd + operator). Plan 05 tests can supply a deterministic fetcher without spinning up a Brain client."
  - "Rule 3 auto-fix: 5 sibling test files (test-navigation-packet-builder + part8-leak + acceptance + brain-packet-validation-per-job + brain-packet-part8-invariant-per-job) updated to await async buildBrainPacket. Mechanical async migration; no behavior change; no schema/test-logic change."

patterns-established:
  - "Pattern P-04: Schema-optional field stitch via Object.assign empty-object short-circuit. The pattern is `Object.assign(baseObject, value === undefined ? {} : { key: value })`. Guarantees key ABSENCE when value is undefined, key PRESENCE with the value otherwise. Plan 116/117/118 can reuse this when adding optional packet fields."
  - "Pattern P-05: Async-chokepoint cascade fix-up. When promoting a sync function to async, walk all caller test files via `grep -rn '<fn>(' tests/`, then prefix each call site with `await` and wrap each enclosing function in `async`. Run each updated suite to verify the migration. Test logic does not need to change; only the call-site discipline does."

requirements-completed:
  - RANKER-125-05

# Metrics
duration: 8m 46s
completed: 2026-05-13
---

# Phase 125 Plan 03: framework_chain_hint Packet Stitch Summary

**Extended `lib/core/navigation/packet.cjs::buildBrainPacket` to populate `local_graph_summary.framework_chain_hint` per CONTEXT.md Scope IN section B item 5 -- the stitch point that joins Plan 01 projections (active frameworks + hop depth) with Plan 02 fetch (the 1-3 hop FEEDS_INTO Cypher slice) into the Phase 110 packet wire shape Plan 04 schema-locks; the F-selector ranker (Plan 05) now has a structured `local_graph_summary.framework_chain_hint.edges` array to score from.**

## Performance

- **Duration:** 8m 46s
- **Started:** 2026-05-13T17:13:25Z
- **Completed:** 2026-05-13T17:22:11Z
- **Tasks:** 1 (TDD: RED + GREEN; no REFACTOR needed)
- **Files modified:** 7 (1 created, 1 implementation modified, 5 test files updated for async migration)

## Accomplishments

### Task 1 RED: 14-test coverage suite for framework_chain_hint stitch

Created `lib/memory/packet-chain-hint.test.cjs` (407 lines) covering all 10 PLAN.md Task 1 behaviors plus 4 helper-seam and regression tests:

| # | Behavior | Test |
|---|----------|------|
| 1 | Active set non-empty -> hint present with all 5 fields | Test 1 |
| 2 | Active set empty -> hint ABSENT (hasOwnProperty false) | Test 2 |
| 3 | Existing 6 fields preserved in BOTH paths | Tests 3, 3b |
| 4 | slice_scope integer 1\|2\|3 matching resolveHopDepth | Test 4 |
| 5 | slice_rationale non-empty string | Test 5 |
| 6 | Brain unreachable -> hint still attached with degraded shape | Test 6 |
| 7 | No roomState -> hint ABSENT | Test 7 |
| 8 | Mocked fetcher invoked exactly once per buildBrainPacket call | Test 8 |
| 9 | packet_version remains '1.0' (Phase 110 invariant) | Test 9 |
| 10 | Helper test seam exposed + behaves per invariant | Tests 10, 10b, 10c |
| 11 | Regression -- nearest_claims + assumptions populated with hint present | Test 11 |

Hermetic fixture mirrors `tests/test-navigation-packet-builder.cjs`'s `makeRoom()` (fs.mkdtempSync + openRoomDb). Mock fetcher honors Plan 02's contract (graceful degraded shape on `degraded: true`). RED run: 8/14 failing (the active-frameworks-non-empty branches and the test-seam tests).

### Task 1 GREEN: Stitch implementation in packet.cjs

Modified `lib/core/navigation/packet.cjs` with the focused stitch per PLAN.md Step 1-5:

1. **Top-of-file requires** (Step 1): `const projections = require('./projections.cjs')` and `const chainSliceMod = require('../../brain/framework-chain-slice.cjs')`. Phase 125-01 + 125-02 module dependencies wired at module load (not lazy) so the hot path stays fast.

2. **Private helper** (Step 2): `async function _surfaceFrameworkChainHint(db, roomState, opts)`. Reads roomState via `projections.resolveActiveFrameworks(roomState)` + `projections.resolveHopDepth(roomState)`. Returns:
   - `undefined` when roomState is null/not-object (cold-start)
   - `undefined` when active frameworks resolve empty (no anchor)
   - The hint object (5 fields) when fetcher returns it (live or mocked)
   - `undefined` when fetcher contract is violated (defensive try/catch belt-and-suspenders)

3. **Async transition** (Step 3): `function buildBrainPacket(...)` -> `async function buildBrainPacket(...)`. Inside the body, after the 6 existing safe-projection mappers and before the return, added:
   ```js
   const roomState = (options && typeof options === 'object') ? options.roomState : null;
   const frameworkChainHint = await _surfaceFrameworkChainHint(db, roomState, options || {});
   ```

4. **local_graph_summary block** (Step 4): Changed from a plain object literal to an `Object.assign` with conditional short-circuit:
   ```js
   local_graph_summary: Object.assign(
     { nearest_claims, nearest_assumptions, contradictions, unsupported_claims, recent_changes, banked_opportunities },
     (frameworkChainHint === undefined) ? {} : { framework_chain_hint: frameworkChainHint }
   ),
   ```
   The empty-object short-circuit guarantees the `framework_chain_hint` key is ABSENT (not present with undefined value) when the active set is empty -- Plan 04 schema invariant preserved.

5. **Test seam exposed** (Step 5): Added `_test: { _surfaceFrameworkChainHint }` to module.exports so `lib/memory/packet-chain-hint.test.cjs` can call the helper directly (Tests 10/10b/10c).

GREEN run: 14/14 PASS via `node --test`.

## Verification

### Hint-present path

```
$ node -e "..."  # see commit body for the exact harness
framework_chain_hint present: true
edges count: 1
slice_scope: 1
validates against suggest_next_move.in schema: true
```

The hint-bearing packet validates against `$defs.suggest_next_move.in` -> `LocalGraphSummary` (with the Plan 04 optional `framework_chain_hint` property) via the same ajv2020 compile path `brain-client.cjs::_validatorFor` uses.

### Acceptance criteria (PLAN.md Task 1)

- [x] `grep -c "framework_chain_hint" lib/core/navigation/packet.cjs` => 8 (>= 3)
- [x] `grep -c "_surfaceFrameworkChainHint" lib/core/navigation/packet.cjs` => 3 (>= 2)
- [x] `grep -c "require.*projections" lib/core/navigation/packet.cjs` => 1 (>= 1)
- [x] `grep -c "require.*framework-chain-slice" lib/core/navigation/packet.cjs` => 1 (>= 1)
- [x] `lib/memory/packet-chain-hint.test.cjs` exists with 14 test() blocks (>= 10)
- [x] `node --test lib/memory/packet-chain-hint.test.cjs` exits 0 (14/14 PASS)
- [x] `node tests/test-navigation-packet-builder.cjs` exits 0 (16/16 PASS)
- [x] `Object.prototype.hasOwnProperty.call(packet.local_graph_summary, 'framework_chain_hint') === false` when active set empty (Test 2 + Test 7)

### Regression suites (zero regression)

```
bash tests/run-all-110.sh    => 4/4 PASS   (test-brain-packet-schema-check + validation-per-job + part8-invariant-per-job + precommit-hook)
node tests/test-navigation-packet-builder.cjs    => 16/16 PASS
node tests/test-navigation-packet-part8-leak.cjs => PASS (8 tripwires)
node tests/test-navigation-acceptance.cjs        => 1/1 PASS
```

### must_haves contract (PLAN.md frontmatter)

- [x] buildBrainPacket emits `local_graph_summary.framework_chain_hint` when active set non-empty (Test 1)
- [x] Shape matches CONTEXT.md scope IN B item 5: `{edges, slice_scope, slice_rationale, brain_snapshot_id, fetched_at}` (Test 1)
- [x] Field ABSENT (Object.prototype.hasOwnProperty.call false) when active set empty (Test 2, Test 7)
- [x] Existing 6 `local_graph_summary` fields still required and populated (Tests 3, 3b, 11)
- [x] buildBrainPacket parameter list unchanged (`db, job, focusNodeId, opts`); enrichment opt-in via `opts.roomState` (Plan 05) or `opts._mocks.fetchFrameworkChainSlice` (tests)

## Task Commits

Each TDD step was committed atomically with `--no-verify` per the Wave 2 protocol:

1. **Task 1 RED:** `cf5ed0b` (test) -- failing tests for framework_chain_hint stitch
2. **Task 1 GREEN:** `e7e7fba` (feat) -- _surfaceFrameworkChainHint helper + Object.assign stitch + async transition + 5 sibling-test async cascade fix

No REFACTOR commit needed -- the stitch is minimal and idiomatic; the code follows the exact action template in PLAN.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Async cascade across 5 sibling test files**

- **Found during:** Task 1 GREEN step (running the existing Phase 110 regression suite after the async transition).
- **Issue:** The plan's `<interfaces>` block declares `async function buildBrainPacket(db, job, focusNodeId, opts) // Returns Promise<Packet>`, and Step 3 explicitly uses `await _surfaceFrameworkChainHint(...)` inside the body. This is a real return-type change: callers that don't await now hold a Promise instead of a Packet. Five existing test files were calling `navigation.buildBrainPacket(...)` synchronously and reading properties off the result: `tests/test-navigation-packet-builder.cjs` (16 calls), `tests/test-navigation-packet-part8-leak.cjs` (1 call), `tests/test-navigation-acceptance.cjs` (1 call), `tests/test-brain-packet-validation-per-job.cjs` (3 calls), `tests/test-brain-packet-part8-invariant-per-job.cjs` (1 call). All 5 suites broke immediately after the GREEN edit.
- **Fix:** Prefix each `navigation.buildBrainPacket(...)` call with `await`. Promote each enclosing function/runner to `async`. Update the runner wrapper to `.catch()` the promise rejection where applicable. No test-logic change; pure mechanical async migration.
- **Files modified:** `tests/test-navigation-packet-builder.cjs` + `tests/test-navigation-packet-part8-leak.cjs` + `tests/test-navigation-acceptance.cjs` + `tests/test-brain-packet-validation-per-job.cjs` + `tests/test-brain-packet-part8-invariant-per-job.cjs`
- **Verification:** All 5 sibling suites PASS post-fix; `bash tests/run-all-110.sh` 4/4 GREEN (no regression in the Phase 110 contract).
- **Committed in:** `e7e7fba` (part of GREEN feat commit; scoped to the buildBrainPacket migration).

This was Rule 3 (Blocking) auto-fix per execute-plan workflow: the async change in `packet.cjs` literally prevents the existing tests from running their assertions (they'd read `.packet_version` etc. off a Promise object instead of the packet). The fix is the smallest mechanical change that preserves the existing Phase 110 invariants. Pattern P-05 documented in frontmatter for future async-chokepoint promotions.

---

**Total deviations:** 1 auto-fixed (1 Rule 3 - Blocking).

**Impact on plan:** Necessary for the plan's "Existing Phase 110 packet test still passes (no regression)" success criterion to remain TRUE after the async transition. No scope creep -- the test edits are mechanical-only.

## Wave 2 Solo-Execution Context

This plan is the SOLE plan in Wave 2 of Phase 125. The 4 Wave 1 plans (125-00 writeEdge, 125-01 projections, 125-02 Cypher slice, 125-04 schema) shipped successfully and their artifacts are on disk:

- `lib/core/navigation/projections.cjs` (Plan 01) -- consumed via `projections.resolveActiveFrameworks` + `projections.resolveHopDepth`
- `lib/brain/framework-chain-slice.cjs` (Plan 02) -- consumed via `chainSliceMod.fetchFrameworkChainSlice` (or mocked through `opts._mocks.fetchFrameworkChainSlice`)
- `data/brain-packet-schema.json $defs.FrameworkChainHint` (Plan 04) -- the optional property under `LocalGraphSummary.properties.framework_chain_hint` that Plan 03's hint emission validates against

Commits made with `--no-verify` per Wave 2 protocol; hook validation runs at end-of-phase.

## Plan 05 Dependency Satisfied

Plan 05 (f-selector-ranker.cjs) can now read `packet.local_graph_summary.framework_chain_hint.edges` for chain-weight scoring. The hint's presence/absence is the ranker's tier-aware switch:

- **Hint absent** -> active set empty -> brand-new room -> ranker defaults to chain-recommender-only path (Brain-priors dominant per CONTEXT.md D3 cold-start gradient)
- **Hint present, edges populated** -> Brain reachable + active anchor resolved -> ranker uses full 3-signal D4 formula
- **Hint present, edges empty + rationale carries `brain_unreachable`** -> degraded path -> ranker can fall through to local signal only without crashing

The packet wire shape Plan 05 expects is now structurally guaranteed by the Plan 04 schema + the Plan 03 stitch.

## Issues Encountered

None beyond the Rule 3 async cascade documented above. The implementation followed the PLAN.md action template verbatim. No assertion fences misfired. No mock contracts violated.

## Self-Check: PASSED

### Created files exist:
- FOUND: lib/memory/packet-chain-hint.test.cjs (407 lines)

### Modified files updated:
- FOUND: lib/core/navigation/packet.cjs (added _surfaceFrameworkChainHint + Object.assign stitch + async + test seam; total grew by ~70 lines)
- FOUND: tests/test-navigation-packet-builder.cjs (16 test fns -> async; runner -> async)
- FOUND: tests/test-navigation-packet-part8-leak.cjs (run() -> async)
- FOUND: tests/test-navigation-acceptance.cjs (runFlowAndCollect + test_zeroNonSqliteReads_andShapes + run -> async)
- FOUND: tests/test-brain-packet-validation-per-job.cjs (3 buildBrainPacket calls -> awaited)
- FOUND: tests/test-brain-packet-part8-invariant-per-job.cjs (1 buildBrainPacket call -> awaited; run() -> async; outer try/catch -> .catch())

### Commits exist:
- FOUND: cf5ed0b test(125-03): add failing tests for framework_chain_hint stitch (RED)
- FOUND: e7e7fba feat(125-03): stitch framework_chain_hint into buildBrainPacket (GREEN)

### Test outcomes:
- PASS: node --test lib/memory/packet-chain-hint.test.cjs (14/14)
- PASS: node tests/test-navigation-packet-builder.cjs (16/16)
- PASS: node tests/test-navigation-packet-part8-leak.cjs (8 tripwires)
- PASS: node tests/test-navigation-acceptance.cjs (1/1)
- PASS: bash tests/run-all-110.sh (4/4 -- 144 + assertions on per-job invariants)
- PASS: ajv2020 schema validation of a hint-bearing packet against `$defs.suggest_next_move.in`

---
*Phase: 125-f-selector-ranker*
*Plan: 03*
*Completed: 2026-05-13*
