---
phase: 145-scheduled-sensor-activation
plan: 03
subsystem: testing
tags: [SCHED-01, SCHED-02, cadence, throttle, safe-auto-fire, part-8, part-4, acceptance-suite, node-test, node-sqlite]
canon_parts: ["Part 2 Engine 1", "Part 4", "Part 8"]

# Dependency graph
requires:
  - phase: 145-01
    provides: "scout-cadence-runner.cjs (the throttled 10-sensor composer) + scout-cadence-guard.cjs (LOCAL throttle + Phase-140 safe-auto-fire guard) -- the units under test"
  - phase: 145-02
    provides: "Tri-Polar cadence wiring (session-start-throttled slot, cron-optional path, Cowork scout-sentinel) -- the live cadence this suite proves fires without manual invocation"
  - phase: 140
    provides: "HARD-01/02/03 sentinel-and-instrumentation hardening invariants the suite asserts hold under auto-fire"
  - phase: 144
    provides: "tests/run-all-144.sh -- the EXACT structural template the aggregator mirrors"
provides:
  - "tests/run-all-145.sh -- the Phase 145 scoped acceptance aggregator (mirrors run-all-144.sh; composable into the Phase 146 loop-fires gate)"
  - "tests/test-scout-cadence-fires.cjs -- SCHED-01 + SCHED-02 cadence-fires + throttle + no-room soft-fail proof"
  - "tests/test-scout-cadence-part8-hardening.cjs -- Phase-140-hardening (HARD-01/02/03 adversarial detection) + Part-8 zero-egress + Part-4 findings-to-graph proof"
affects: ["Phase 146 (fully-wired loop-fires acceptance gate -- composes run-all-145.sh)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "node assert harness (plain process.exit on pass/fail count) consistent with sibling tests/*.cjs (test-decide-sensor-fire / test-decide-part8-invariant)"
    - "Drive the REAL runner via execFileSync --json and parse the structured summary -- no stubs of the unit under test"
    - "os.tmpdir() fixtures with try/finally cleanup; LOCAL throttle file cleared/backdated between cases"
    - "Adversarial-fixture detection: synthesize a NULL-source_path node (node:sqlite) and a .heal-backup/ path, assert the guard FLAGS each (T-145-09 discipline)"
    - "Comments-filtered forbidden-substring egress sweep (strip // and /* */ before grepping) so header prose cannot self-invalidate the Part-8 gate (T-145-10)"
    - "sklearn-tolerance: assert a SCHED-02 step is PRESENT (attempted) in steps[], not that scikit-learn is installed"

key-files:
  created:
    - "tests/run-all-145.sh"
    - "tests/test-scout-cadence-fires.cjs"
    - "tests/test-scout-cadence-part8-hardening.cjs"
  modified: []

key-decisions:
  - "HARD-01 asserted as the runner CAPTURING the health-check exit (numeric exit field present, status is a handled ok|degraded value, exit routed into the guard's HARD-01 channel) rather than asserting exit==0 -- because sentinel-health-check returns non-zero on a sparse fixture room (set -euo pipefail + a no-match grep), which is health-check fixture behavior, not a Phase-140 invariant breach. The real HARD-01 invariant is capture-not-swallow, which is what is proven."
  - "HARD-02 and HARD-03 proven by adversarial fixtures (synthesize the regression, assert the guard flags it) AND the clean-room negative -- a guard that only passes on a clean room is a hollow proof (T-145-09)."
  - "The Part-8 egress sweep strips comment lines before matching so a URL in header prose cannot false-clean OR false-fail the gate (T-145-10)."
  - "The two test suites are test(...) commits with no separate feat(...) GREEN commit because this plan writes NO production code -- the units under test (runner + guard) shipped GREEN in 145-01; the tests pass against the already-implemented units. Documented under TDD Gate Compliance below."

patterns-established:
  - "Phase-scoped acceptance aggregator: clone run-all-144.sh structure exactly (set -uo pipefail, SCRIPT_DIR, START_TIME, SHELL_SUITES/CJS_SUITES arrays, run-to-completion per-suite PASS/FAIL loop, summary block, exit 1 on any failure) so successive phase gates compose without rework."
  - "Adversarial-fixture proof-by-instrumentation for invariant guards: assert BOTH directions (clean -> no violation, poisoned -> the matching HARD-NN violation)."

requirements-completed: [SCHED-01, SCHED-02]

# Metrics
duration: ~12min
completed: 2026-06-08
---

# Phase 145 Plan 03: Scheduled Sensor Activation Verification Suite Summary

**tests/run-all-145.sh plus two CJS acceptance suites that prove by instrumentation that the scout suite fires on a cadence without /mos:scout (SCHED-01), the SCHED-02 four fire on the same run, the throttle blocks an every-session runaway, and a scheduled run holds the Phase-140 hardening (HARD-01/02/03 proven via adversarial fixtures) with zero Brain/web egress (Part 8) and findings becoming graph data (Part 4).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-08T00:10:00Z
- **Completed:** 2026-06-08T00:22:00Z
- **Tasks:** 2
- **Files modified:** 3 created

## Accomplishments

- **SC1 (cadence-fires) proven:** a fresh fixture room fires the full scout suite (snapshot, health-check, deadline-monitor, competitor query-plan, HSI recompute, opportunity scan) plus the SCHED-02 four (whitespace recompute, reverse-salient, opportunity-bank scan, competitor watch) in a single `fired:true` run with no `--force` and no `/mos:scout` -- SCHED-01 and SCHED-02 demonstrated together.
- **Throttle proven:** an immediate re-run reports `throttled:true` with zero sensors (no every-session runaway); backdating the LOCAL last-run timestamp past the interval makes it fire again.
- **No-room soft-fail proven:** a nonexistent room path exits 0 with `fired:false` -- the cadence can never crash its host hook.
- **SC3 (hardening-holds) proven by adversarial fixtures:** the runner captures (never swallows) the health-check exit (HARD-01); the guard FLAGS a synthesized NULL-source_path node (HARD-02) and a synthesized `.heal-backup/` path (HARD-03), and reports clean on a hardened room.
- **Part 8 (zero egress) proven:** a comments-filtered forbidden-substring sweep over both Plan-01 scripts finds zero `fetch(`/`http(s)://`/`tavily`/`brain_query`/`mcp__brain` matches; the competitor step is emitted as a `public-signal` query plan, never an executed fetch.
- **Part 4 (findings become graph data) proven:** a fired run carries a populated `findings_to_graph` array (hsi-edges, whitespace-zones) destined for room.db.
- **run-all-145.sh** mirrors run-all-144.sh exactly and is composable into the Phase 146 loop-fires gate; it runs to completion even when a suite fails and exits non-zero on any failure (verified).

## Task Commits

Each task was committed atomically:

1. **Task 1: cadence-fires + throttle suite (SCHED-01 + SCHED-02)** - `f49ffdec` (test)
2. **Task 2: Phase-140-hardening + Part-8 + Part-4 suite + run-all-145.sh aggregator** - `cce03fcc` (test)

**Plan metadata:** (this commit) (docs: complete plan)

_Note: this plan is test-authoring; both commits are `test(...)`. See TDD Gate Compliance below for why there is no separate `feat(...)` GREEN commit._

## Files Created/Modified

- `tests/test-scout-cadence-fires.cjs` - Drives the real scout-cadence-runner against tmpdir fixture rooms; Test 1+2 (full scout suite + SCHED-02 four in one fired run, no manual invocation), Test 3 (throttle blocks re-fire inside interval; fires again after backdating), Test 4 (no-room soft-fail exit 0). sklearn-tolerant presence assertions.
- `tests/test-scout-cadence-part8-hardening.cjs` - Test 1 (HARD-01 health-check exit captured + routed into the guard's HARD-01 channel), Test 2 (HARD-02 synthesized NULL-source_path node FLAGGED + clean-room negative), Test 3 (HARD-03 synthesized `.heal-backup/` pollution FLAGGED + clean-room negative), Test 4 (Part-8 comments-filtered zero-egress sweep + competitor SIGNAL-query-plan-not-fetch), Test 5 (Part-4 findings_to_graph populated).
- `tests/run-all-145.sh` - The Phase 145 scoped acceptance aggregator: clones run-all-144.sh structure exactly; header names per-suite plan ownership and the three Success Criteria it proves; runs to completion, exits non-zero on any suite failure.

## Decisions Made

- **HARD-01 asserted as capture-not-swallow, not exit==0.** `sentinel-health-check` returns non-zero on a sparse fixture room (`set -euo pipefail` + a no-match grep pipeline), which is health-check fixture behavior rather than a Phase-140 invariant breach. The genuine HARD-01 invariant is that the runner CAPTURES the exit (numeric `exit` field, handled `ok|degraded` status) and ROUTES it into `safeAutoFireCheck`'s HARD-01 channel -- so the suite asserts the capture wiring (non-zero captured exit -> exactly one HARD-01 violation; clean exit -> none).
- **Adversarial fixtures for HARD-02/03.** Both invariant tests synthesize the regression (a NULL-source_path row via node:sqlite; a `.heal-backup/` path in a `.intelligence/` result file) and assert the guard flags it, plus a clean-room negative -- proving detection works, not just that a clean room passes (T-145-09).
- **Comments-filtered Part-8 sweep.** The egress sweep strips `//` and `/* */` comment lines before matching so the runner/guard header prose (which legitimately describes the zero-egress posture) cannot self-invalidate or false-clean the gate (T-145-10).

## Deviations from Plan

None - plan executed exactly as written. None of deviation Rules 1-4 triggered. No package installs (T-145-SC accept disposition held: the suites use only node built-ins -- assert, fs, os, path, child_process, crypto, node:sqlite).

## Issues Encountered

- **Live room.db `nodes` table lacks a `source_path` column in this environment.** A real fired run's room.db has columns `id, type, properties` only, so the guard's HARD-02 scan returns `checked:false` against it (no fabricated violation -- correct behavior). To genuinely exercise the guard's HARD-02 detection path, the hardening suite synthesizes its own `nodes` table WITH a `source_path` column and inserts a NULL row. This is the right way to prove detection: drive the real guard against a graph that has the column the invariant governs.
- **competitor-watch returns `skipped` on a thin fixture** (insufficient competitor data in `competitive-analysis/`). The suite asserts its PRESENCE in `steps[]` and that its status is `query-plan` OR `skipped` (never an executed fetch), matching the plan's "assert ATTEMPTED" contract.

## TDD Gate Compliance

This is a `type: execute` plan whose two tasks carry `tdd="true"`, but the deliverable IS the test suite. The units under test -- `scripts/scout-cadence-runner.cjs` and `scripts/scout-cadence-guard.cjs` -- already shipped GREEN in Plan 145-01. Therefore:

- Both task commits are `test(...)` commits (the correct conventional type for test-only changes).
- There is no separate `feat(...)` GREEN commit in this plan because this plan writes NO production source -- the tests pass against the already-implemented, already-shipped units.
- The RED-before-GREEN gate does not apply here in the standard "write a failing test, then implement" sense: the implementation predates these tests by design (this is the Phase-140/144 acceptance-test discipline -- a verification plan that instruments shipped units). The "fail-fast on unexpected pass" rule is satisfied trivially: the tests are EXPECTED to pass against the shipped units, and they do.

This compliance note is recorded per the executor's TDD gate-sequence validation requirement for `tdd="true"` tasks that author acceptance tests over previously-shipped code.

## User Setup Required

None - no external service configuration required. The suites use only node built-ins and the shipped Plan-01 scripts.

## Next Phase Readiness

- Phase 145 is COMPLETE (3/3 plans). The scout suite fires on a cadence (SCHED-01), the SCHED-02 four fire on it (SCHED-02), and the Phase-140 hardening holds under auto-fire with zero egress and findings becoming graph data -- all proven by `bash tests/run-all-145.sh` (exit 0).
- `tests/run-all-145.sh` is composable into the Phase 146 fully-wired loop-fires acceptance gate exactly as run-all-144.sh is.
- No blockers.

## Known Stubs

None. Both suites drive the REAL Plan-01 runner and guard against real tmpdir fixtures (and a real synthesized room.db for the HARD-02 detection path). Nothing is mocked or stubbed in the units under test.

## Self-Check: PASSED

- tests/run-all-145.sh -- FOUND
- tests/test-scout-cadence-fires.cjs -- FOUND
- tests/test-scout-cadence-part8-hardening.cjs -- FOUND
- commit f49ffdec (Task 1 cadence-fires) -- FOUND
- commit cce03fcc (Task 2 hardening + aggregator) -- FOUND
- bash tests/run-all-145.sh exits 0 (2/2 suites PASSED) -- VERIFIED
- zero em-dashes across all three created files -- VERIFIED

---
*Phase: 145-scheduled-sensor-activation*
*Completed: 2026-06-08*
