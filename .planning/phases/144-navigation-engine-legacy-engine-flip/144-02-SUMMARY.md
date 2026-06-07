---
phase: 144-navigation-engine-legacy-engine-flip
plan: 02
subsystem: testing
tags: [navigation-engine, routing, fixture-repair, resolve-active-room, canon-part-3, canon-part-9]

# Dependency graph
requires:
  - phase: 144-navigation-engine-legacy-engine-flip
    provides: "144-01 wired dispatchSensors into decide() so a fired reach maps to a canonical verb and flips routing_source legacy->engine at the router (navigation-engine.cjs only)"
  - phase: 127.3
    provides: "resolveActiveRoomDir routed through lib/core/resolve-active-room.cjs (the resolver whose {slug, abs_path} contract the fixture must satisfy)"
provides:
  - "makeRoomsFixture registry.json corrected to the {slug, abs_path} OBJECT shape so resolveActiveRoom returns non-null and the engine block at intent-classifier.cjs:1369 runs"
  - "Tests 16/17 GREEN through the EXISTING router with zero sensor/router/production code (proves the flip path end-to-end)"
  - "Test 18: the NAV-01 cold-room honest-negative (a resolvable+silent room degrades honestly to routing_source: legacy)"
affects: [144-03-acceptance-harness, 146-loop-fires-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Test-fixture registry mirrors the resolve-active-room.cjs production contract ({slug, abs_path} entry + on-disk dir for the fs.existsSync gate); no production code path changes"
    - "Cold-room honest-negative: a resolvable room with the engine genuinely silent asserts routing_source: legacy -- proving the flip is a consequence of a fired reach, never an unconditional engine label"

key-files:
  created: []
  modified:
    - lib/memory/skill-activation-router.test.cjs

key-decisions:
  - "Chose the Object form rooms:{ 'fixture-room': { slug, abs_path } } over the Array form; both satisfy the resolver, Object is the resolver's documented current shape (O(1) reg.rooms[slug])"
  - "abs_path points at the fixture's existing on-disk roomDir so the resolver's final fs.existsSync gate passes"
  - "Test 18 reuses the __NULL__ stub on a RESOLVABLE room (engine runs but silent) to assert the cold-room legacy negative, distinct from Test 17 which forces a null fire_skill"

patterns-established:
  - "Pattern 1: when a spine helper routes through a resolver, the test fixture must satisfy the resolver's entry contract, not a legacy shorthand"
  - "Pattern 2: the honest negative (legacy stays legacy on a resolvable+silent room) is a first-class assertion, not an absence of a test"

requirements-completed: [NAV-01]

# Metrics
duration: 9min
completed: 2026-06-07
---

# Phase 144 Plan 02: Navigation Engine Fixture Repair Summary

**makeRoomsFixture registry.json repaired to the {slug, abs_path} object shape so resolve-active-room.cjs resolves the fixture room -- Tests 16/17 flip RED->GREEN through the EXISTING router with zero sensor code, plus a new Test 18 NAV-01 cold-room honest-negative.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-06-07T10:48:00Z
- **Completed:** 2026-06-07T10:57:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Fixed the pre-existing FIXTURE REGRESSION called out in 144-01-SUMMARY and 144-FANOUT-CORRECTIONS: `makeRoomsFixture` wrote `.rooms/registry.json` as `rooms: ['fixture-room']` (array of bare STRINGS). Since Phase 127.3 routed `resolveActiveRoomDir` through `lib/core/resolve-active-room.cjs`, whose Array branch matches `r.slug === slug || r.name === slug`, a bare string had neither, so `resolveActiveRoom` returned null, the engine block at `intent-classifier.cjs:1369 (if (roomDir))` was skipped, stdout stayed empty, and Tests 16/17 failed (15/17 RED).
- Replaced the registry write with the `{slug, abs_path}` OBJECT shape (`rooms: { 'fixture-room': { slug: 'fixture-room', abs_path: roomDir } }`), pointing `abs_path` at the fixture's existing on-disk `roomDir` so the resolver's final `fs.existsSync` gate passes. `resolveActiveRoom` now returns `{ slug:'fixture-room', abs_path:<roomDir> }`, the engine block runs, and `routing_source` emits.
- Tests 16/17 flipped RED->GREEN through the EXISTING router with ZERO sensor/router/production code: Test 16 (`MOS_NAV_TEST_FIRE_SKILL='Run Methodology'`) asserts `activated_skills: [Run Methodology]` + `routing_source: engine`; Test 17 (`__NULL__`) asserts `routing_source: legacy`. This proves the 144-01 flip path (router contract) is sound end-to-end, independent of the sensor wiring.
- Added Test 18, the NAV-01 cold-room honest-negative: a RESOLVABLE room (so the engine block genuinely runs) with the engine SILENT asserts `routing_source: legacy`. A legacy trace here is CORRECT, not a failure -- it proves the flip is a pure consequence of a fired reach, never an unconditional engine label. Documented in a comment naming it the canonical NAV-01 cold-room case and distinguishing it from Test 17.
- Suite moved 15/17 -> 18/18.

## Task Commits

Each task was committed atomically (through the live pre-commit hooks, no --no-verify):

1. **Task 1: repair makeRoomsFixture registry to {slug, abs_path} object shape so Tests 16/17 go GREEN** - `ae2f3325` (fix)
2. **Task 2: add Test 18 NAV-01 cold-room honest-negative (legacy stays legacy)** - `89714024` (test)

**Plan metadata:** see final docs commit.

## Files Created/Modified
- `lib/memory/skill-activation-router.test.cjs` - `makeRoomsFixture` registry.json rewritten from `rooms:['fixture-room']` to `rooms:{ 'fixture-room': { slug, abs_path } }` with an explanatory comment block naming the resolver contract and the RED cause; new Test 18 cold-room honest-negative added inside the `classifierIntegrated()` gate with tmp-fixture cleanup in `finally` mirroring Tests 16/17; skip message updated from "Tests 16-17" to "Tests 16-18"

## Decisions Made
- Chose the Object form `rooms:{ 'fixture-room': { slug, abs_path } }` over the Array form. Both satisfy the resolver per the plan's acceptance criteria; the Object form is the resolver's documented "current" shape (O(1) `reg.rooms[slug]`) versus the "legacy" Array form, so the fixture now mirrors current production.
- Set `abs_path` to the fixture's existing on-disk `roomDir` (`path.join(root,'fixture-room')`, which the fixture already creates) so the resolver's final `fs.existsSync` gate passes -- no phantom path.
- Test 18 reuses the `__NULL__` stub on a RESOLVABLE room (the engine block runs but is silent) rather than inventing a new no-room path, so it isolates the "resolvable + silent -> legacy" honest negative distinctly from Test 17's "populated + forced-null" path.

## Deviations from Plan

None - plan executed exactly as written. Two tasks, one test-fixture file, atomic commits, all acceptance criteria met.

## Issues Encountered
None. The RED cause was exactly the registry-shape AssertionError documented in 144-01-SUMMARY; the one-line fixture shape change resolved it as the fan-out predicted.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The flip path is now proven end-to-end via the existing router (Tests 16/17 GREEN) plus the cold-room honest negative (Test 18). Plan 144-03 builds `tests/run-all-144.sh`, the acceptance harness composing ACPT-01 for the Phase 146 loop-fires gate; it can now rely on the router-contract proof this plan established.
- Scope was strictly test-fixture-only: `git diff --name-only ae2f3325~1 HEAD` shows ONLY `lib/memory/skill-activation-router.test.cjs`. The production-file guard (navigation-engine / skill-activation-router.cjs / intent-classifier / sensors / resolve-active-room) returned CLEAN -- no production, sensor, or router file touched, honoring threat-register T-144-06.

## Self-Check: PASSED

---
*Phase: 144-navigation-engine-legacy-engine-flip*
*Completed: 2026-06-07*
