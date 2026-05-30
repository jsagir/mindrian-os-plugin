---
phase: 130-lens-engine-skeleton
plan: 04
subsystem: testing
tags: [e2e, lens-engine, instrumented-acceptance, fs-instrument, rejection-as-data, persona-framing, canon-part-4, canon-part-8, canon-part-9, release-gate, phase-130-complete]

# Dependency graph
requires:
  - phase: 130-01
    provides: "INFORMS + REJECTED_BECAUSE edge enum + lens-nodes.cjs writeLensFinding / writeHatStateByRoomDir / readAllHatStatesByRoomDir chokepoint"
  - phase: 130-02
    provides: "lens-engine.cjs rotate() (serial/parallel/single) + the 5 lens memory_event types + the persona-aware role_blend hook"
  - phase: 130-03
    provides: "hat-persistence room.db rewrite (saveHatState/loadHatState) + scripts/migrate-hats-to-roomdb.cjs idempotent backfill + the 4 thin command clients"
  - phase: 109-sql-context-memory-navigation-spine
    provides: "the fs-instrument zero-leak idiom (tests/helpers/fs-instrument.cjs) + the instrumented acceptance-test pattern"
  - phase: 129-spine-repair-memory-event
    provides: "the test-129-spine-acceptance.cjs structural template (setupRoom/cleanup/run + the allow-listed-read filter)"
  - phase: 115-owned-emotion-dual-path-first-touch
    provides: "USER.md role_blend (the persona-aware framing input the E2E asserts is consumed)"
provides:
  - "tests/test-130-lens-engine-e2e.cjs: the 8 instrumented E2E tests (the Phase 130 release gate)"
  - "tests/fixtures/phase-130/sample-room/seed.sql: the minimal room fixture with the INFORMS / REJECTED_BECAUSE FK anchor nodes"
  - "tests/run-all-130.sh complete (4 suites GREEN)"
  - "lib/memory/run-feynman-tests.cjs additive Phase 130 block (4 suites registered in CI)"
affects: [131 research-as-graph, v1.14.0 domain/source/framework/trend lens-family migrations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Instrumented E2E acceptance mirroring 129/129.5: direct-CJS node:assert/strict, fs-instrument install-before / uninstall-after each rotate flow, leaked non-SQLite reads filtered to exclude the single allow-listed USER.md asserted empty"
    - "FK anchor nodes seeded so the INFORMS / REJECTED_BECAUSE edge-write assertions do not fail on the edges-table FOREIGN KEY to nodes(id) with PRAGMA foreign_keys ON (the recurring 129 incident, pre-empted by construction)"
    - "prewarm() throwaway rotate caches the selector-renderer + user-md-ops lazy require chain BEFORE the instrumented assertions so module-load reads never trip the proxy"
    - "rejectAll:true plus a provided onAccept proves rejection is strictly the reject path (the REJECTED_BECAUSE edge lands; zero INFORMS for the rejected finding)"
    - "spy perLensFn captures every ctx so the role_blend tuple consumption (Phase 115) is asserted by instrumentation, not by promise"

key-files:
  created:
    - tests/test-130-lens-engine-e2e.cjs
    - tests/fixtures/phase-130/sample-room/seed.sql
    - .planning/phases/130-lens-engine-skeleton/deferred-items.md
  modified:
    - tests/run-all-130.sh
    - lib/memory/run-feynman-tests.cjs

key-decisions:
  - "The seed fixture adds two FK anchor nodes (decision:ship-mcp-first for INFORMS, assumption:market-ready for REJECTED_BECAUSE) because the edges table carries a FOREIGN KEY to nodes(id) and PRAGMA foreign_keys is ON; the lens_finding SOURCE nodes are written at runtime by the engine, only the edge TARGETS need seeding"
  - "USER.md role_blend lives in the test's setupRoom (USER.md frontmatter per Phase 115), NOT in seed.sql -- role_blend is LOCAL-only and never a graph node"
  - "USER.md is the single allow-listed non-SQLite read during a rotate (the engine's readRoleBlend reads it once); the fs-instrument filter excludes it exactly as the 129.5 truth-machine test does for resolveByUser"
  - "rejectAll:true is the cleanest way to prove the no-INFORMS-on-reject contract: it routes every finding through onReject ONLY, so a co-provided onAccept that would have written an INFORMS is proven suppressed"
  - "Two pre-existing em-dashes in the Feynman runner (Phase 103/105 comments) are OUT OF SCOPE and ledgered in deferred-items.md, NOT fixed (executor scope boundary)"

requirements-completed: [E2E-8-TESTS, E2E-COGNITIVE-6, E2E-CONTRACT-2, FEYNMAN-REGISTRATION, PHASE-130-AGGREGATOR]

# Metrics
duration: 14min
completed: 2026-05-31
---

# Phase 130 Plan 04: Lens-Engine E2E Tests Summary

**The 8 instrumented E2E tests that are the Phase 130 release gate: 6 cognitive-family (serial / parallel / single / consume + HatState round-trip + backfill idempotency) and 2 engine-contract (rejection-as-data writes a REJECTED_BECAUSE edge with no INFORMS; persona-aware framing consumes the Phase 115 role_blend), all driving room.db only through navigation.cjs under the fs-instrument zero-leak gate. This COMPLETES Phase 130 and the v1.13.1 memory cluster.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-05-31
- **Completed:** 2026-05-31
- **Tasks:** 3
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- Shipped `tests/test-130-lens-engine-e2e.cjs` -- 8 instrumented E2E tests mirroring `tests/test-129-spine-acceptance.cjs` + `tests/test-129.5-truth-machine.cjs` EXACTLY (direct-CJS `node:assert/strict`, `setupRoom / cleanup / run`, the fs-instrument proxy installed BEFORE each rotate flow and uninstalled AFTER, the leaked non-SQLite reads filtered to EXCLUDE the single allow-listed `USER.md` asserted empty).
- The 6 cognitive-family E2E tests drive `lib/core/lens-engine.cjs` rotate() through navigation.cjs:
  1. **think-hats serial** -- exactly 6 `lens_finding` nodes + a tension-map synthesis + exactly one `lens_synthesis_completed` memory_event; synthesize receives the TYPED `lens_finding:`-prefixed node objects (not raw perLensFn arrays); exactly one `lens_rotation_started` and 6 `lens_finding_written` events.
  2. **persona parallel** -- all 6 lenses run via Promise.all; each writes a HatState node through `navigation.writeHatStateByRoomDir` and they round-trip via `navigation.readAllHatStatesByRoomDir` (all 6 colors present, each carrying the expected focus).
  3. **challenge-assumptions single** -- exactly one lens runs, exactly one `lens_finding` node, exactly one `lens_finding_written` event.
  4. **hat-briefing consume** -- a reader reads the prior lens memory_event tail (`findRecentChanges`) + the HatState nodes WITHOUT rotating, producing a briefing while writing ZERO new `lens_finding` nodes (asserted before==after), under its own zero-leak gate.
  5. **HatState round-trip** -- `saveHatState` then `loadHatState` round-trips structured state via room.db with NO legacy `.mindrian/hats/black/STATE.md` written (the filesystem retirement) and a single `hatstate:black` HatState node landing in room.db.
  6. **backfill idempotency** -- `migrateHatsToRoomDb` run twice leaves exactly one HatState node per color (the `state_alias_migration` sentinel makes the second run `skipped:true`), with the legacy markdown left in place.
- The 2 engine-contract E2E tests:
  7. **rejection-as-data (Canon Part 4)** -- a single-mode rotation with `rejectAll:true` drives the finding through `onReject` with an enum reason scalar; the edges table carries EXACTLY ONE `REJECTED_BECAUSE` edge FROM the `lens_finding` node TO the `assumption:market-ready` FK anchor carrying the enum reason in properties; a `lens_finding_rejected` memory_event was emitted carrying that reason; and ZERO `INFORMS` edges were written for the rejected finding (a co-provided `onAccept` is proven suppressed by `rejectAll`, so rejection is strictly the reject path).
  8. **persona-aware framing (Phase 115)** -- with the `USER.md` role_blend fixture (founder 0.6 / researcher 0.4), a serial rotation is asserted to have passed the role_blend tuple into every one of the 6 perLensFn ctx objects (captured via a spy perLensFn), proving the framing hook consumes Phase 115; the instrumented gate confirms `USER.md` is the single allow-listed non-SQLite read.
- Shipped `tests/fixtures/phase-130/sample-room/seed.sql` -- the phase-129 trimmed seed (room + 2 sections + 2 artifacts + 1 decision) PLUS the two FK anchor nodes the INFORMS + REJECTED_BECAUSE edges reference, so the edge-write assertions do not fail on the edges-table FOREIGN KEY to nodes(id) with PRAGMA foreign_keys ON (the recurring 129 incident, pre-empted by construction).
- Finalized `tests/run-all-130.sh` (4 suites: lens-substrate, lens-engine, cognitive-migration, lens-engine-e2e -- 4/4 GREEN) and added an additive Phase 130 block to `lib/memory/run-feynman-tests.cjs` registering all 4 Phase 130 suites in CI, with every prior block (including 129 + 129.5) left byte-unchanged.
- Ran the full zero-regression gate GREEN: run-all-130 4/4, run-all-129 5/5, run-all-129.5 2/2, test-navigation-acceptance (Phase 109) 1/1.

## Task Commits

1. **Task 1: seed fixture + 6 cognitive-family E2E tests** - `26445bd5` (test)
2. **Task 2: the 2 engine-contract E2E tests** - `576340d1` (test)
3. **Task 3: register E2E suite in aggregator + Feynman runner + zero-regression gate** - `6d076e8c` (test)

## Files Created/Modified

- `tests/test-130-lens-engine-e2e.cjs` - the 8 instrumented E2E tests (the phase release gate); fs-instrument zero-leak gate per rotate flow
- `tests/fixtures/phase-130/sample-room/seed.sql` - the minimal room (7 nodes) with the INFORMS / REJECTED_BECAUSE FK anchor nodes
- `tests/run-all-130.sh` - registers test-130-lens-engine-e2e.cjs (4 suites GREEN)
- `lib/memory/run-feynman-tests.cjs` - additive Phase 130 block (4 suites in CI); prior blocks byte-unchanged
- `.planning/phases/130-lens-engine-skeleton/deferred-items.md` - DI-130-04-01 ledgers two pre-existing Feynman-runner em-dashes (out of scope)

## Decisions Made

- The seed fixture seeds only the edge TARGETS (decision + assumption); the lens_finding SOURCE nodes are written at runtime by the engine. This is the minimum that satisfies the edges-table FK with PRAGMA foreign_keys ON.
- The role_blend fixture lives in the test's `setupRoom` (USER.md frontmatter per Phase 115), not in seed.sql -- role_blend is LOCAL-only and never a graph node.
- `rejectAll:true` co-provided with an `onAccept` is the cleanest proof of the no-INFORMS-on-reject contract: the engine's rejectAll branch routes every finding through onReject ONLY, so the INFORMS the onAccept would have written is proven absent.
- A `prewarm()` throwaway rotate caches the selector-renderer + user-md-ops lazy require chain BEFORE the instrumented assertions so module-load reads never trip the proxy (the 129 "bootstrap before proxy" discipline applied to the engine's lazy requires).

## Deviations from Plan

One deviation, and it is a NON-fix (executor scope boundary):

**1. [Scope boundary - not auto-fixed] Two pre-existing em-dashes in lib/memory/run-feynman-tests.cjs**
- **Found during:** Task 3 (Feynman runner Phase 130 registration).
- **Issue:** Lines 1128 + 1134 carry a U+2014 em-dash in pre-existing Phase 103/105 registration comments (unrelated to this plan).
- **Action:** NOT fixed. Per the executor SCOPE BOUNDARY, pre-existing issues in unrelated lines are out of scope. The additive Phase 130 block + all plan files carry zero em-dashes. Logged to `.planning/phases/130-lens-engine-skeleton/deferred-items.md` (DI-130-04-01) for a future style sweep.
- **Files modified:** none (the deferred item is documentation only).

Otherwise the plan executed exactly as written: the 8 E2E tests pass; each asserts the instrumented zero-leak gate; Test 7 proves a REJECTED_BECAUSE edge lands on reject with no INFORMS; Test 8 proves role_blend is consumed; run-all-130.sh GREEN; the Feynman runner carries the additive Phase 130 block; Phase 129 + Phase 129.5 + Phase 109 still GREEN (zero regression); zero em-dashes in the plan's own files; every commit passed the live substrate guard with NO --no-verify.

## Issues Encountered

None. No m4-cypher false-positive rewording was needed (the tests carry no Cypher-keyword-token-adjacent-to-a-template-placeholder pattern). The FK-on-edge-write incident the 129 audit flagged was pre-empted by seeding the two edge-target anchor nodes.

## Known Stubs

None. All 8 tests perform real navigation.cjs writes against a real room.db: real lens_finding nodes, real INFORMS / REJECTED_BECAUSE edges, real HatState nodes, real memory_events, a real idempotent backfill, and a real role_blend read from a real USER.md fixture. The fs-instrument gate proves by instrumentation (not promise) that every rotate flow reaches room.db only through navigation.cjs with zero non-SQLite reads outside the single allow-listed USER.md.

## Threat Flags

None. No new network endpoints, auth paths, or trust-boundary surface beyond the plan's threat_model. T-130-04-01 (proof-by-instrumentation) mitigated -- the fs-instrument zero-leak gate fires on every E2E rotate flow (the gate IS the proof). T-130-04-02 (silent skip of the reject edge) mitigated -- Test 7 queries the edges table for the REJECTED_BECAUSE row + asserts no INFORMS for the rejected finding. T-130-04-03 (role_blend off-box) accepted per the threat_model -- role_blend stays LOCAL (a USER.md fixture); the engine never sends it to Brain; the assertion is local-only. T-130-04-SC mitigated -- zero new dependencies (Node built-ins + bash; no install tasks).

## Next Phase Readiness

- Phase 130 (Lens-Engine Skeleton + Cognitive-Family Migration) is COMPLETE; the v1.13.1 memory cluster (109 / 128 / 129 / 129.5 / 130) is closed.
- The lens-engine + cognitive room.db migration is proven end-to-end; Phase 131 (research-as-graph-aware-workflow-step, the source-lens pilot) and the v1.14.0 domain / source / framework / trend lens-family migrations can build on the instrumented E2E pattern (mirror test-130-lens-engine-e2e.cjs for each new family) and append their suites to run-all-130.sh + the Feynman runner.

## Self-Check: PASSED

---
*Phase: 130-lens-engine-skeleton*
*Completed: 2026-05-31*
