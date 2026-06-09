---
phase: 150-memory-cortex-as-graph-members
plan: 04
subsystem: navigation
tags: [cortex, getRoomContext, legD, sensors, brainAnchors, dead-code, sqlite, part8, part9]

# Dependency graph
requires:
  - phase: 150-01
    provides: "the memory-artifacts writers (memory_artifact / governing_thought / navigator_persona / decision node types) legD SELECTs over"
  - phase: 150-03
    provides: "reconcileMemoryArtifacts -- the cortex projector the tests call to seed the fixture cortex"
  - phase: 141
    provides: "getRoomContext (the 3-leg fusion legD extends) + the capability dial reach posture"
  - phase: 143
    provides: "dispatchSensors + sensor-lagging-component + sensor-gate-approach (the starved consumers)"
  - phase: 144
    provides: "decide() (navigation-engine.cjs) -- the engine-side sensor consumer that reads ctx.stage / ctx.lowFillSections / ctx.roomDir"
provides:
  - "getRoomContext legD: a new cortexNodes field surfacing the projected cortex RAW-LOCAL (MEM-03)"
  - "the decide() ctx producer now threads lowFillSections + stage + roomDir so the 2 dead sensors FIRE (MEM-07 link L3)"
  - "deriveBrainAnchors producer in projections.cjs closing the orphaned weight-0.5 brain_md consumer (MEM-07)"
  - "SECTION_WEIGHTS dead-code fully removed from both engine files (MEM-07)"
affects: [150-05, 150-06, 150-07, 150-08, "Wave-3 render/selector plan (intent-classifier overlap)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "legD: a 4th caller-owned-db in-room SELECT leg over the cortex node types, RAW-local, additive to the getRoomContext return"
    - "co-located producer+consumer: deriveBrainAnchors lives in projections.cjs next to resolveActiveFrameworks"
    - "reuse the SAME getRoomContext result for two consumers (neighborhood + lowFillSections) with no second room.db read"

key-files:
  created:
    - tests/test-150-cortex-local-query.cjs
    - tests/test-150-orphans.cjs
  modified:
    - lib/core/navigation/room-context.cjs
    - scripts/intent-classifier.cjs
    - lib/core/navigation/projections.cjs
    - lib/core/navigation-engine.cjs
    - lib/core/navigation-engine-shared.cjs
    - lib/memory/navigation-engine-core.test.cjs
    - tests/run-all-150.sh

key-decisions:
  - "brainAnchors producer site = projections.cjs (co-located with resolveActiveFrameworks), NOT the getRoomContext->roomState adapter; resolveActiveFrameworks stays the pure consumer"
  - "SECTION_WEIGHTS resolved to DELETE (implement-or-delete per 150-CONTEXT D-03); composition stays rule-based; no weighted scorer revived"
  - "lowFillSections + venture_stage derive from the SAME getRoomContext call at intent-classifier:1275 (cortexNodes legD); no second room.db read"
  - "lowFillSections defined as: sections with a STATE memory_artifact but no governing_thought STATES them (an unfilled MINTO) -- LOCAL section slugs only"

patterns-established:
  - "legD RAW-local cortex surfacing: SELECT type IN (cortex types), parse properties best-effort, return id/type/properties/review_status verbatim"
  - "D-03a LOCAL-lane fence extended: the new sensor inputs ride context ONLY, never the turn object or any buildBrainPacket path"

requirements-completed: [MEM-03, MEM-07]

# Metrics
duration: 11min
completed: 2026-06-09
---

# Phase 150 Plan 04: Make the Projected Cortex LOCAL-Queryable + Close the 4 Orphans Summary

**getRoomContext now surfaces the 150-01 projected cortex as a RAW-LOCAL cortexNodes field (MEM-03), the two starved decide() sensors fire on real lowFillSections + stage threaded from that same projection, the orphaned weight-0.5 brain_md signal has a producer, and the dead SECTION_WEIGHTS scorer is gone (MEM-07).**

## Performance

- **Duration:** 11 min
- **Started:** 2026-06-09T11:27:12Z
- **Completed:** 2026-06-09T11:37:50Z
- **Tasks:** 4 of 4
- **Files modified:** 7 (2 created, 5 modified) + 2 test-support files updated (run-all-150.sh, navigation-engine-core.test.cjs)

## Accomplishments

### Task 1 (RED suites) -- commit d12825c6
- `tests/test-150-cortex-local-query.cjs`: getRoomContext must return a `cortexNodes` field (non-empty RAW-local when projected, `[]` on empty room, purely additive, with a legD `_meta.legTimingsMs` entry).
- `tests/test-150-orphans.cjs`: 4 arms -- (a) the 2 sensors fire/abstain, (b) brainAnchors at weight-0.5 brain_md + the deriveBrainAnchors producer flow, (c) SECTION_WEIGHTS gone from both engine files (comment-filtered grep), (d) intent-classifier threads lowFillSections + stage + a decide() smoke.
- Registered both suites in `tests/run-all-150.sh`, replacing the aggregator's `test-150-cortex-context.cjs` placeholder name with the actual `test-150-cortex-local-query.cjs` the plan creates.

### Task 2 (legD, MEM-03) -- commit 5d31ad3a
- Added `legD(db, roomId)` to `room-context.cjs`: a single caller-owned-db, in-room `SELECT ... WHERE type IN (memory_artifact, governing_thought, navigator_persona, decision)`, returning RAW-LOCAL node fields (id / type / properties / review_status / sourceSection). Opens no room.db, imports no egress helper.
- Threaded after `relevantNodes`; added `cortexNodes` to the return + a `legD` timing entry. The return stays additive (existing fields byte-stable).

### Task 3 (decide() ctx threading, MEM-07 link L3) -- commit 2425937a
- Extended the `context` object (intent-classifier.cjs ~:1217) to carry `stage` (from `userPersona.venture_stage`), `roomDir`, and `lowFillSections`.
- `deriveLowFillSections(roomContext)` derives the low-fill section slugs from the SAME getRoomContext `cortexNodes` result already computed at :1275 (a section is low-fill when it has a STATE memory_artifact but no governing_thought STATES it). No second room.db read.

### Task 4 (brainAnchors producer + SECTION_WEIGHTS deletion, MEM-07) -- commit efa4f097
- `deriveBrainAnchors(cortexNodes)` in projections.cjs reads the projected BRAIN-kind memory_artifact node's `properties.anchors` and returns generic framework-name handles only (Part 8). Closes the orphaned consumer at `resolveActiveFrameworks:108`; the consumer is unchanged.
- Deleted the dead `SECTION_WEIGHTS` import (navigation-engine.cjs), the frozen def + export + doc-comment (navigation-engine-shared.cjs). `REQUIRED_SECTION_KEYS` / `OPTIONAL_SECTION_KEYS` retained (separate contract). `navigation-engine-core.test.cjs` Test 3 rewritten to assert the deletion (33/33 green).

## Output notes (per plan <output>)

- **(a) the exact 150-01 node types legD SELECTs over:** `memory_artifact`, `governing_thought`, `navigator_persona`, `decision` (the four 150-01 writer node types).
- **(b) chosen brainAnchors producer site:** `lib/core/navigation/projections.cjs` (co-located with `resolveActiveFrameworks`), NOT the getRoomContext->roomState adapter. Rationale: producer and consumer of the brain_md signal live in one auditable module; resolveActiveFrameworks stays the pure consumer.
- **(c) confirmation:** `lowFillSections` + `venture_stage` (as `stage`) derive from the SAME getRoomContext call at intent-classifier:1275 (the legD cortexNodes), via `deriveLowFillSections` inside `attachRoomContextAndDecide`. No second room.db open.
- **(d) THE OVERLAP FLAG:** This plan edits `scripts/intent-classifier.cjs` in the decide() ctx producer region. The exact line region touched is the `context = { ... }` object literal (the added `stage` / `roomDir` / `lowFillSections` fields) plus `attachRoomContextAndDecide` (the `context.lowFillSections = deriveLowFillSections(context.roomContext)` line) plus the module-level `deriveLowFillSections` helper added just before `deriveConversationSeed`. The Wave-3 render/selector plan ALSO touches intent-classifier.cjs (the buildReachList -> dial-presenter render wire). The Wave-3 executor MUST rebase on this plan's ctx-producer edit and MUST NOT clobber the threaded `stage` / `roomDir` / `lowFillSections` context fields or the `deriveLowFillSections` helper.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] room-context Part-8 source sweep tripped on the legD comment**
- **Found during:** Task 2
- **Issue:** `tests/test-room-context-part8-invariant.cjs` forbids the literal token `sha256` anywhere in room-context.cjs (greppable-clean invariant). My legD comment wrote "NO sha256 hashing".
- **Fix:** reworded the comment to "NO content-digest hashing". The Part-8 sweep is green.
- **Files modified:** lib/core/navigation/room-context.cjs
- **Commit:** 5d31ad3a

**2. [Rule 3 - Blocking] deleting SECTION_WEIGHTS broke a live test consumer**
- **Found during:** Task 4
- **Issue:** `lib/memory/navigation-engine-core.test.cjs` Test 3 required `SECTION_WEIGHTS` and asserted the weight sum. Deleting the export crashes that test.
- **Fix:** rewrote Test 3 to assert `shared.SECTION_WEIGHTS === undefined` (the deletion contract) while confirming `REQUIRED_SECTION_KEYS` / `OPTIONAL_SECTION_KEYS` are retained. 33/33 green.
- **Files modified:** lib/memory/navigation-engine-core.test.cjs
- **Commit:** efa4f097

**3. [Rule 3 - Blocking] the plan's bare `! grep SECTION_WEIGHTS` verify matched my removal comments**
- **Found during:** Task 4
- **Issue:** the plan's automated verify is a bare `! grep -n "SECTION_WEIGHTS"`; my removal-marker comments contained the literal token, which would trip the gate.
- **Fix:** reworded both removal-marker comments to avoid the literal token ("the dead weighted-section-score import/map was removed"). Bare grep now returns nothing in both engine files.
- **Files modified:** lib/core/navigation-engine.cjs, lib/core/navigation-engine-shared.cjs
- **Commit:** efa4f097

### Naming reconciliation (non-deviation, flagged for 150-01 aggregator owner)
- `tests/run-all-150.sh` (owned by Plan 150-01) listed the Plan-04 suite as `test-150-cortex-context.cjs`. The PLAN names the suite `test-150-cortex-local-query.cjs`. I registered the actual file the plan creates and updated the owning-plan header line. The aggregator's `test-150-trigger.cjs` row remains MISSING (no such suite file was created by Plan 03 -- the Plan-03 trigger shipped as a hook, not a CJS suite); that is outside Plan 04 scope and is flagged here for the Plan 03/05 owner.

## Canon Gates

- **Part 8 (zero egress):** legD returns RAW-local node fields and imports no egress helper; the room-context Part-8 source sweep is green; the navigation-packet Part-8 leak test (9 tripwires) and the sensors Part-8 sweep (5 tripwires) are green. brainAnchors carry only generic framework-name handles. The threaded sensor inputs ride context ONLY (D-03a LOCAL-lane fence), never the turn object or buildBrainPacket.
- **Part 9 (memory locality):** cortex read flows through getRoomContext (the navigation surface); no new confirmed truth-claim node minted. decision nodes stay proposed (untouched by this plan).
- **No em-dashes / en-dashes:** dash scan clean across all created + modified files.
- **No frozen 148 contract touched:** MAX_K=3, the 0.70/0.15 recommend gate, DIAL_REACH_K=6 all unchanged.

## Verification

- `node tests/test-150-cortex-local-query.cjs` -- PASS (5 checks)
- `node tests/test-150-orphans.cjs` -- PASS (8 checks across 4 arms)
- `bash tests/run-all-150.sh` -- 7 passed / 0 failed (6 MISSING are downstream suites owned by Plans 05-08; RED-by-design per the aggregator header)
- Regression green: test-decide-part8-invariant, test-room-context-part8-invariant, test-spine-navigates-decide, test-get-room-context, test-room-context-latency, run-all-144 (5/5), run-all-1433 (9/9), navigation-engine-core (33/33), navigation-projections, test-navigation-packet-part8-leak (9 tripwires), test-sensors-part8-sweep (5 tripwires)

## Known Stubs

None. The `properties.anchors` field deriveBrainAnchors reads is populated by the Phase 90 BRAIN-derivation layer when present; when absent, deriveBrainAnchors returns `[]` gracefully (no stub, the signal degrades to inactive exactly like the other resolveActiveFrameworks signals on empty input).

## Self-Check: PASSED

- Files created/modified verified on disk: tests/test-150-cortex-local-query.cjs, tests/test-150-orphans.cjs, lib/core/navigation/room-context.cjs, scripts/intent-classifier.cjs, lib/core/navigation/projections.cjs (all FOUND).
- Commits verified in git log: d12825c6 (RED), 5d31ad3a (legD), 2425937a (ctx threading), efa4f097 (brainAnchors + SECTION_WEIGHTS) (all FOUND).
- Dash scan clean across created + modified files and the SUMMARY.
