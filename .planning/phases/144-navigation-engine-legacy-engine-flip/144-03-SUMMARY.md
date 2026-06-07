---
phase: 144-navigation-engine-legacy-engine-flip
plan: 03
subsystem: testing
tags: [navigation-engine, routing, acceptance-harness, nav-01, canon-part-8, canon-part-9, run-all]

# Dependency graph
requires:
  - phase: 144-navigation-engine-legacy-engine-flip
    provides: "144-01 wired dispatchSensors into decide() so a fired reach maps to a canonical verb and flips routing_source legacy->engine at the router; 144-02 repaired makeRoomsFixture to the {slug, abs_path} object shape so the router integration Tests 16/17/18 run end-to-end"
  - phase: 143-insight-sensors
    provides: "SENS-06 artifact-filed sensor reading the CASC-01 side-channel (<roomDir>/.mindrian/last-cascade.json); the dispatchSensors spine decide() consumes"
provides:
  - "tests/run-all-144.sh: the Phase 144 scoped acceptance aggregator mirroring run-all-143.sh -- NAV-01 positive (real fired sensor -> engine) + negative (cold -> legacy) + the two fences + the 18/18 router suite; exits 0"
  - "tests/test-nav01-populated-room-engine-fires.cjs: the NAV-01 acceptance suite proving a REAL fired SENS-06 sensor (no MOS_NAV_TEST_FIRE_SKILL stub) flips routing_source legacy->engine at the decide()->routeActivation boundary, and a cold room honestly stays legacy"
affects: [146-loop-fires-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stub-free positive acceptance: the flip is driven by a REAL sensor signal (turn.signals + the on-disk CASC-01 side-channel) through decide(), never by the MOS_NAV_TEST_FIRE_SKILL env override (T-144-08 repudiation guard)"
    - "decide()->routeActivation boundary as the faithful proof surface when the classifier hot path builds turn from a conversation seed (not explicit sensor signals); documented per the 144-FANOUT hot-path tuple-threading caveat"
    - "Phase 144 scoped aggregator mirrors run-all-143.sh skeleton exactly so Phase 146 ACPT-01 composes it without rework"

key-files:
  created:
    - tests/run-all-144.sh
    - tests/test-nav01-populated-room-engine-fires.cjs
  modified: []

key-decisions:
  - "Positive case fires the REAL SENS-06 CONTRADICT sensor (CASC-01 side-channel) through decide() -> Devil's Advocate canonical verb -> routeActivation source=engine, with the MOS_NAV_TEST_FIRE_SKILL stub explicitly deleted from the env and asserted unset (the GUARD test). Proves the SENSOR, not the stub."
  - "Chose the decide()->routeActivation boundary over the classifier hook hot path because the classifier builds the engine turn from a LOCAL conversation seed (deriveConversationSeed -> turn.userText, intent-classifier.cjs:1241-1245), not from explicit sensor signals threaded through stdin; the boundary exercises the EXACT production router call (intent-classifier.cjs:1385) with a real sensor signal. Plan 02's Tests 16/17 already cover the classifier-hook plumbing via the stub; this suite covers the real-sensor flip the stub cannot."
  - "Negative case is a cold room (resolvable populated-room context, NO sensor signal, tier_0 brain absent) -> fire_skill null -> routeActivation source=legacy. The honest negative -- the flip is a CONSEQUENCE of a fired reach, never an unconditional engine label."
  - "run-all-144.sh mirrors run-all-143.sh's skeleton byte-for-byte (structural diff confirms only the CJS_SUITES entries + the runner title + the summary label differ); CJS_SUITES uses the ../lib/... relative-path form for the router suite per the 143 runner's documented note"

patterns-established:
  - "Acceptance harness reads production behavior only -- zero production-code changes (tests + tracking only); the two fences run UNCHANGED inside the aggregator so any regression fails the gate"
  - "Stub-temptation defense: the positive case scrubs MOS_NAV_TEST_FIRE_SKILL/SUPPRESS from the env at suite load and asserts it unset, making a false-green via the stub structurally impossible"

requirements-completed: [NAV-01]

# Metrics
duration: 11min
completed: 2026-06-07
---

# Phase 144 Plan 03: Navigation Engine Acceptance Harness Summary

**tests/run-all-144.sh built mirroring run-all-143.sh -- aggregating a NAV-01 POSITIVE case where a REAL fired SENS-06 sensor (no stub) flips routing_source legacy->engine, a COLD-room NEGATIVE staying legacy, and reruns of the two fences plus the 18/18 router suite; exits 0.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-06-07T09:36:49Z
- **Completed:** 2026-06-07T09:47:00Z
- **Tasks:** 2
- **Files modified:** 0 (2 test files created)

## Accomplishments
- Built `tests/test-nav01-populated-room-engine-fires.cjs`, the NAV-01 acceptance suite. The POSITIVE case writes the shipped CASC-01 side-channel (`<roomDir>/.mindrian/last-cascade.json`) with a CONTRADICT newFinding, fires the REAL SENS-06 sensor through `decide()` via `turn.signals: ['artifact_filed']` (NO `MOS_NAV_TEST_FIRE_SKILL`), gets a canonical-verb `fire_skill` ("Devil's Advocate"), feeds it to the production `routeActivation` call, and asserts `source === 'engine'`. The flip is driven by the sensor's reach, not the stub.
- The NEGATIVE case builds a cold room (resolvable populated-room context, no sensor signal, tier_0 brain absent), runs `decide()` (fire_skill null), feeds it to `routeActivation`, and asserts `source === 'legacy'` -- the honest negative.
- Added a GUARD test asserting `MOS_NAV_TEST_FIRE_SKILL` is unset for the whole suite (T-144-08 repudiation guard); the suite deletes the stub env vars at load so a false-green via the stub is structurally impossible.
- Built `tests/run-all-144.sh` mirroring `run-all-143.sh` exactly: `set -uo pipefail`, `SCRIPT_DIR` resolution, `SHELL_SUITES`/`CJS_SUITES` arrays, the bash/node PASS-FAIL loop with MISSING handling, runs to completion on failure, the summary block, and non-zero exit on any failure. The header names per-suite plan ownership like the 143 header.
- `CJS_SUITES` aggregates the NAV-01 suite + the Plan-01 `test-decide-sensor-fire.cjs` + the two fences (`test-sensors-routing-fence.cjs`, `test-decide-part8-invariant.cjs`) + `../lib/memory/skill-activation-router.test.cjs` (Tests 1-18). `bash tests/run-all-144.sh` exits 0 with all 5 suites PASS.

## Task Commits

Each task committed atomically through the live pre-commit hooks (no --no-verify):

1. **Task 1: NAV-01 acceptance suite -- real fired sensor flips to engine, cold room stays legacy** - `ca6f6cef` (test)
2. **Task 2: run-all-144.sh -- the Phase 144 flip acceptance aggregator mirroring run-all-143.sh** - `c40cf695` (test)

## Files Created/Modified
- `tests/test-nav01-populated-room-engine-fires.cjs` - NAV-01 acceptance suite: POSITIVE (real SENS-06 CONTRADICT -> decide() canonical fire_skill -> routeActivation source=engine, no stub) + NEGATIVE (cold room -> legacy) + GUARD (stub env unset). Tmp fixtures cleaned in finally; single node-runnable file with a clear pass/fail exit code so Phase 146 ACPT-01 composes it as-is. File header documents the decide()->routeActivation boundary choice per the hot-path tuple-threading caveat.
- `tests/run-all-144.sh` - the Phase 144 scoped aggregator: header naming per-suite plan ownership; CJS_SUITES = NAV-01 + Plan-01 sensor-fire + both fences + the 18/18 router suite; mirrors run-all-143.sh skeleton.

## Decisions Made
- Used the decide()->routeActivation boundary (the plan's second acceptance bullet) rather than the classifier hook hot path. The classifier builds the engine `turn` from a LOCAL conversation seed (`deriveConversationSeed -> turn.userText`), not from explicit sensor signals threaded through stdin, so there is no hook-input parameter that injects `turn.signals: ['artifact_filed']` from the hook alone -- the only hook-path way to drive a fire_skill is the stub (forbidden) or a production rewrite (out of scope). The boundary exercises the EXACT production router call (`intent-classifier.cjs:1385`) with a real sensor signal. Plan 02's Tests 16/17 already cover the classifier-hook plumbing via the stub; this suite covers the real-sensor flip the stub cannot.
- The positive case scrubs `MOS_NAV_TEST_FIRE_SKILL`/`MOS_NAV_TEST_SUPPRESS_SKILLS` from the env at suite load and the GUARD test asserts they stay unset, making the T-144-08 false-green-via-stub threat structurally impossible.
- run-all-144.sh uses the `../lib/...` relative-path form for the router suite per the 143 runner's documented note (CJS_SUITES entries resolved relative to tests/).

## Deviations from Plan

None - plan executed exactly as written. Two tasks, two test files created, atomic commits, all acceptance criteria met. The plan explicitly anticipated the decide()->routeActivation boundary path (second acceptance bullet) and required documenting the choice; that documentation lives in the suite's file header and in Decisions Made above.

## Issues Encountered
None. The 144-01 engine wiring (canonical-verb fire_skill on a fired reach) and the 144-02 fixture repair were both merged and green, so the harness composed and passed first run.

## Verification
- `node tests/test-nav01-populated-room-engine-fires.cjs` -> 3/3 passed (POSITIVE engine via real sensor + NEGATIVE cold legacy + GUARD stub-unset)
- `bash tests/run-all-144.sh` -> exit 0; 5/5 suites PASS:
  - test-nav01-populated-room-engine-fires.cjs (3/3)
  - test-decide-sensor-fire.cjs (7/7)
  - test-sensors-routing-fence.cjs (2/2, fence GREEN)
  - test-decide-part8-invariant.cjs (2/2, Part-8 invariant GREEN)
  - ../lib/memory/skill-activation-router.test.cjs (18/18)
- Structural mirror confirmed: `diff` of run-all-143.sh vs run-all-144.sh (comments + blanks stripped) shows ONLY the CJS_SUITES entries + the runner title + the summary label differ; the skeleton is identical.
- Scope: `git diff --name-only ca6f6cef~1 HEAD` shows ONLY the two new test files; zero production-code changes (navigation-engine.cjs, sensors, router, intent-classifier all untouched).

## Threat Surface
All threat-register mitigations honored:
- T-144-08 (false-green positive): the positive case fires a REAL sensor (no MOS_NAV_TEST_FIRE_SKILL); the env override is scrubbed at load and the GUARD test asserts it unset.
- T-144-09 (fence reruns): run-all-144.sh reruns test-sensors-routing-fence + test-decide-part8-invariant + the 18/18 router suite UNCHANGED; any regression fails the aggregator.
- T-144-10 (acceptance fixtures): fixtures are LOCAL tmp dirs cleaned in finally; no Brain call; the SENS-06 side-channel is LOCAL JSON only.
- T-144-SC (package installs): none in this plan.

## Next Phase Readiness
- NAV-01 is PROVEN end-to-end: a populated-room turn driven by a real fired sensor produces routing_source: engine (no stub); a cold room honestly stays legacy; all three fences stay GREEN. The long-unmet Phase 94-03 criterion (SEED-008) is met.
- Phase 146 ACPT-01 can compose `tests/run-all-144.sh` and `tests/test-nav01-populated-room-engine-fires.cjs` as-is (single node-runnable file, clear pass/fail exit code, tmp fixtures cleaned in finally).
- Phase 144 is now 3/3 plans complete; the box closes.

## Self-Check: PASSED

---
*Phase: 144-navigation-engine-legacy-engine-flip*
*Completed: 2026-06-07*
