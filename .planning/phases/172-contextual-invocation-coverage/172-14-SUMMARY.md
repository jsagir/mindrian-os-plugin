---
phase: 172-contextual-invocation-coverage
plan: 14
subsystem: invocation-spine
tags: [cirs, canon-part-11, inv-15, adversarial-verify, structured-verdict, harness-as-code, red-team, phase-close]

# Dependency graph
requires:
  - phase: 172-13
    provides: the born-wired hard gate (both --check generators exit non-zero on a dark surface) + the four-class coverageReport class enum + canon v1.15 - the gate this red-team attacks
  - phase: 172-16
    provides: the corrected 88 wired / 36 excluded / 0 gap connector baseline the positive contract asserts
  - phase: 172-08
    provides: the act-command loadRealDecide() / no second selection brain + act.md connector-wiring the red-team Attack 2 checks
  - phase: 172-05
    provides: the navigation-engine reachIdToSkillFamily hats case the positive contract asserts
  - phase: 172-15
    provides: the chain-transform composition test the aggregator carries
provides:
  - "tests/test-cirs-adversarial-verify.cjs: the harness-as-code Phase V red-team - synthesizes a dark surface (trips BOTH hard gates non-zero) + checks the second selection brain is closed (no ungoverned ()=>null decideFn + act.md wired); asserts the positive coverage contract (rs-* context_block, hats engine case, gap=0 BOTH ledgers, frozen invariants); emits a structured {pass, assertions[]} verdict and exits non-zero on any FAIL (19/19)"
  - "tests/run-all-172.sh: registers the adversarial verify + adds the orchestration-projection --check gate alongside the connector --check gate (20/20 green)"
  - "172-VERDICT.md: the structured pass/fail verdict over R1..R14 + INV-01..23 with PASS/FAIL/DEFERRED-ENFORCEMENT; R6 + R11 + R13 + R14 recorded DEFERRED-ENFORCEMENT each with a one-line reason; final counts 88 wired / 36 excluded / 0 gap recorded"
affects: [172 phase close (the navigator-gated verdict), all upcoming CIRS-touching phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "comment-stripped source grep: the second-brain check strips block + line comments from act-command.cjs before the ()=>null regex so the documentary comment that RECORDS the removed brain does not false-positive"
    - "dual-gate dark probe: the red-team copies the dark fixture into commands/ under a temp name, spawns BOTH --check generators, asserts both exit non-zero, and removes the probe in finally (zero tracked-file mutation) - the connector gate walks commands/, the projection gate reads the derived command ledger, so one bare dark command trips both"
    - "structured verdict accumulator: each check appends {id, name, status} to one array; verdict.pass is the AND of every row; the JSON {pass, summary} is printed and module.exports.runVerdict() returns it; a final assert backstops a swallowed exitCode"
    - "aggregator dual-tripwire: run-all-172.sh runs BOTH generators' --check as direct invocations (both hard gap gates) before the CJS suites"

key-files:
  created:
    - tests/test-cirs-adversarial-verify.cjs
    - .planning/phases/172-contextual-invocation-coverage/172-VERDICT.md
    - .planning/phases/172-contextual-invocation-coverage/172-14-SUMMARY.md
  modified:
    - tests/run-all-172.sh

key-decisions:
  - "Attack 2 (second selection brain) uses a comment-stripped grep: act-command.cjs legitimately carries the removed ()=>null form ONLY inside a documentary comment ('decideFn: () => null was that second brain; it is gone'); stripping block + line comments before the regex avoids a false RED on the cure's own documentation while still catching a re-introduced live assignment (verified the regex fires on the live ungoverned form via a synthetic sample)"
  - "The dark-surface attack reuses the existing tests/fixtures/coverage-gate-dark/DARK-FIXTURE.md (172-13) rather than minting a new fixture - the fixture lives outside the generator's walked dirs (commands/ + skills/ + agents/) so it never trips the live gate, and the probe round-trip copies it in and removes it in finally"
  - "The red-team asserts the dark surface trips BOTH the connector gate AND the projection gate (a command counterpart that is neither ranked nor excluded), proving the full-flip 172-13 closed the gap on both ledgers - not just the connector one"
  - "run-all-172.sh gains the projection --check as a SECOND direct-invocation tripwire (was connector-only) so the phase aggregator runs both hard gap gates"
  - "R13 (surface retirement) + R14 (trigger-overlap) recorded as DEFERRED-ENFORCEMENT alongside the SPEC's R6 + R11: 172 ships no surface retirement (no owning plan) and the overlap detector is substrate-gated, so both are declared-law-now / enforce-later, mirroring the R6/R11 precedent - documented, not silently missing"

requirements-completed: [INV-15]

# Metrics
duration: ~30min
completed: 2026-06-23
---

# Phase 172 Plan 14: Adversarial Verify + Structured Verdict (INV-15) Summary

Ships the harness-as-code Phase V (CIRS property 6): an ADVERSARIAL red-team that TRIES to ship a dark surface AND a second selection brain, with the born-wired hard gate catching BOTH, plus a STRUCTURED pass/fail verdict over the whole coverage contract. tests/test-cirs-adversarial-verify.cjs synthesizes the dark surface (trips BOTH hard gates non-zero), checks the second selection brain is closed (no ungoverned ()=>null decideFn in act-command + act.md connector-wired), and asserts the positive contract (rs-* fires context_block, navigation-engine has the hats case, gap=0 on BOTH ledgers, frozen invariants REACH_IDS=6/POSTURE_IDS=3/DIAL_REACH_K=6/MAX_K=3) - emitting a {pass, assertions[]} verdict, 19/19 green. run-all-172.sh registers it and adds the projection --check gate (20/20). 172-VERDICT.md records the structured verdict over R1..R14 + INV-01..23 with R6 + R11 + R13 + R14 DEFERRED-ENFORCEMENT and the final 88/36/0 counts.

## Performance

- **Duration:** ~30 min
- **Started:** 2026-06-23
- **Completed:** 2026-06-23
- **Tasks:** 2 of 2
- **Files modified:** 1 modified (run-all-172.sh), 3 created (the test, the verdict, this summary)

## Accomplishments

- **Task 1 (commit af37e0c5, TDD):** The adversarial red-team verify.
  - `tests/test-cirs-adversarial-verify.cjs` (19 assertions across the 6 mandated behaviors).
  - **Attack 1 (dark surface):** the dark fixture classifies `gap`; PRESENT in commands/ it trips BOTH the connector AND the projection hard gates non-zero; the connector FAIL names the surface; the probe is removed in finally (zero tracked-file mutation).
  - **Attack 2 (second selection brain):** act-command.cjs feeds the REAL decide() (loadRealDecide present, navigation-engine required); carries NO ungoverned `()=>null` decideFn (comment-stripped grep); act.md is connector-wired.
  - **Positive contract:** rs-* family fires `context_block` on its sensor; navigation-engine `reachIdToSkillFamily` has the `hats` case; connector gap=0 with zero excluded-without-reason errors; projection command gap=0; frozen REACH_IDS=6 / POSTURE_IDS=3 / DIAL_REACH_K=6 / MAX_K=3; clean live repo passes BOTH gates exit 0 (no false-positive).
  - **Structured verdict:** prints `{ pass, summary }` JSON, returns it via `module.exports.runVerdict()`, exits non-zero on any FAIL, with a backstop `assert`.
- **Task 2 (commit 7d4e5623):** The phase aggregator + the structured verdict file.
  - `tests/run-all-172.sh`: registered `test-cirs-adversarial-verify.cjs`; added the `orchestration-projection --check` gate as a second direct-invocation tripwire beside the `connector-registry --check` gate. 20/20 green.
  - `172-VERDICT.md`: the structured pass/fail verdict - the headline counts table (both ledgers gap=0), the adversarial-verify result table, the CIRS R1..R14 verdict table (R6/R11/R13/R14 DEFERRED-ENFORCEMENT each with a one-line reason), the INV-01..23 requirement table (all PASS), the frozen-invariant table, residual risk, and the final VERDICT: PASS.

## Task Commits

1. **Task 1: adversarial red-team verify + structured verdict** - `af37e0c5` (test)
2. **Task 2: run-all-172 aggregator + projection gate + 172-VERDICT.md** - `7d4e5623` (feat)

## TDD Gate Compliance

Task 1 carries `tdd="true"`. The test is a fence over already-shipped behavior (the hard gate landed 172-13; the second-brain closure landed 172-08; the rs-*/hats/gap/frozen contract landed across 172-04..16), so it passes GREEN as a committed source/registry/ledger fence on first run. Per the tdd_execution fail-fast note, the initial run surfaced ONE legitimate RED (ADV-02b matched the documentary comment that records the removed brain, not a live assignment) - investigated and fixed by comment-stripping the source before the grep, confirming the assertion tests what it claims (the regex fires on a synthetic live ungoverned form). There was no missing-feature false-pass.

## The structured verdict result

VERDICT: PASS.

- Adversarial verify: 19/19 assertions, exit 0.
- Aggregator: 20/20 green.
- Both ledgers gap=0 (connector 88 wired / 36 excluded / 0 gap; projection 76 ranked / 25 excluded / 0 gap).
- Frozen invariants intact (REACH_IDS=6, POSTURE_IDS=3, DIAL_REACH_K=6, MAX_K=3).
- DEFERRED-ENFORCEMENT (4): R6 (earned chains - learned-weight substrate not present), R11 (fractal rollup - production-depth exercise pending), R13 (surface retirement - no owning plan in 172), R14 (trigger-overlap - fingerprint comparator substrate-gated). Each is declared-law-now / enforce-later.

## Deviations from Plan

None of substance. One in-test RED was investigated and fixed during Task 1 (the second-brain grep initially matched the documentary comment in act-command.cjs; resolved by stripping comments before the regex - a fix to the NEW test, not to any shipped surface). No shipped file was modified beyond the aggregator. No deviation to deferred-items.md.

## Frozen-Invariant Compliance

- No 7th reach, no 4th posture, no new edge type, no new node type, no new Brain wire minted - this plan ships a test + an aggregator edit + a verdict doc only.
- MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the F.1 keyboard contract: untouched (the verdict asserts them, never edits them).
- Zero live Brain: the red-team reads LOCAL sources + runs the gates in memory; ADV-07 + the carried Part-8 fences confirm no egress.

## Issues Encountered

The adversarial test's second-brain assertion (ADV-02b) initially went RED because act-command.cjs carries the removed `decideFn: () => null` form inside a documentary comment ("...was that second brain; it is gone"). Stripping block + line comments before the regex cleared the false-positive while preserving the catch on a live re-introduction (verified on a synthetic sample). No shipped surface was at fault.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The structured verdict is recorded; the navigator-gated phase-close review can lean on it.
- All 23 INV requirements PASS; CIRS R1-R14 are bound (4 at DEFERRED-ENFORCEMENT with documented reasons).
- run-all-172.sh is 20/20 green; the born-wired hard gate is enforced at every merge.
- No blockers.

## Known Stubs

None. The adversarial test, the aggregator, and the verdict are all live and self-checking. The 4 DEFERRED-ENFORCEMENT rulings are honest, documented, substrate-gated future enforcement - not stubs.

## Threat Flags

None. This plan adds no new network endpoint, auth path, file-access pattern, or trust-boundary schema change. T-172-31 (a dark surface slips past the gate) MITIGATED: the red-team synthesizes the exact attack and asserts BOTH gates catch it (ADV-01b/d). T-172-32 (a second selection brain reappears) MITIGATED: ADV-02a/b assert the cure holds. T-172-33 (a frozen invariant drifts) MITIGATED: ADV-06a..d. T-172-SC (package installs) N/A: pure-Node test + bash aggregator + verdict doc, zero installs.

## Self-Check: PASSED

- FOUND: tests/test-cirs-adversarial-verify.cjs (19/19, exit 0)
- FOUND: tests/run-all-172.sh (20/20)
- FOUND: 172-VERDICT.md (VERDICT + DEFERRED-ENFORCEMENT present; R6/R11/R13/R14 deferred rows = 4; counts 88/36/0)
- FOUND commit af37e0c5 (Task 1)
- FOUND commit 7d4e5623 (Task 2)
- em-dash count across changed files: 0

---
*Phase: 172-contextual-invocation-coverage*
*Completed: 2026-06-23*
