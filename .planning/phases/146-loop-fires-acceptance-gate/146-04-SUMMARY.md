---
phase: 146-loop-fires-acceptance-gate
plan: 04
subsystem: acceptance-gate
tags: [dogfood, acceptance-gate, loop-fires, milestone-gate, larry-reaches, doctor, aggregator, canon-part-6, canon-part-8]
canon_parts: [Part 3, Part 6, Part 8]
requirements: [ACPT-01, ACPT-02, ACPT-03, ACPT-04, ACPT-05]

# Dependency graph
dependency_graph:
  requires:
    - phase: 146-01
      provides: tests/test-acpt-01-engine-fires.cjs + test-acpt-02-websearch-hat-scoped.cjs (the ACPT-01/02 hermetic drivers)
    - phase: 146-02
      provides: tests/test-acpt-03-first-material-explore.cjs + test-acpt-04-filing-cascade-surfaces.cjs (the ACPT-03/04 drivers)
    - phase: 146-03
      provides: tests/test-acpt-05-brain-derive-tier-rise.cjs (the ACPT-05 driver; live mode_a self-skips, hermetic mode_b carries the gate)
    - phase: 123
      provides: scripts/doctor.cjs runAcceptance + buildAcceptanceChecklist child-process-point pattern (the model for runDogfoodAcceptance)
    - phase: 144
      provides: tests/run-all-144.sh (the runner skeleton cloned) + the engine-flip gate re-run
    - phase: 144.1
      provides: tests/run-all-1441.sh (exhaustive 114-surface coverage gate re-run)
    - phase: 145
      provides: tests/run-all-145.sh (cadence + Phase-140 hardening gate re-run)
  provides:
    - "doctor --dogfood-acceptance: the loop-fires gate class (own exit-code contract, spawns the 5 ACPT drivers)"
    - "tests/run-all-146.sh: the Phase 146 aggregator (5 ACPT + re-run of run-all-144/1441/145 for full-surface certification)"
    - "explain-decision.md doc note naming the gate host (loop-fires assertion surface)"
    - "the milestone gate: exit 0 = ships as Larry Reaches; non-zero = renamed"
  affects: [larry-reaches-milestone, canon-phase-map, roadmap-146-box]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gate host with OWN exit-code contract (not a class flag): dispatched BEFORE the class-flag exit-0 path so the own-contract exit wins -- mirrors the Phase 123 --acceptance contract"
    - "Aggregator composes child drivers (CJS_SUITES) PLUS sibling run-all-*.sh aggregators (SHELL_SUITES) -- full-surface certification not a sample"
    - "Honest exit-code contract: hermetic legs carry the CI gate; the live ACPT-05 mode_a arm self-skips, never required (T-146-14)"

key-files:
  created:
    - tests/run-all-146.sh
  modified:
    - scripts/doctor.cjs
    - commands/explain-decision.md

decisions:
  - "doctor --dogfood-acceptance is a NEW gate flag with its OWN exit-code contract, NOT a class flag -- the class-flag-always-exit-0 invariant does not apply (matches the --acceptance precedent)"
  - "run-all-146.sh re-runs run-all-1441.sh (the exhaustive 114-surface gate) so 146 certifies the FULL connector surface, not the 5-criteria sample (T-146-15 mitigation)"
  - "The gate requires the hermetic mode_b arm, never the live mode_a arm; a down Brain can never make the gate fake mode_a (T-146-14)"

metrics:
  duration_min: 10
  completed: 2026-06-07
  tasks_completed: 3
  files_created: 1
  files_modified: 2
  commits: 3
---

# Phase 146 Plan 04: Loop-Fires Acceptance Gate Host + Aggregator Summary

The Phase 146 milestone gate, in two composable surfaces: `doctor --dogfood-acceptance`
(spawns the 5 ACPT dogfood drivers with its own exit-code contract) and
`tests/run-all-146.sh` (the 5 ACPT drivers plus a re-run of run-all-144/1441/145 for
full-surface certification). Exit 0 means the milestone ships as "Larry Reaches";
non-zero means it is renamed. The closing plan of the 146 milestone.

## What Was Built

### Task 1: doctor --dogfood-acceptance gate class (scripts/doctor.cjs + commands/explain-decision.md)

- Registered `--dogfood-acceptance` in parseArgs (`flags.dogfoodAcceptance`) with a
  documenting comment block: own exit-code contract (0 = all ACPT hermetic legs
  passed; non-zero = a leg failed), explicitly NOT a class flag.
- Added a new "Loop-fires gate (Phase 146 -- the milestone gate)" block to usageText
  documenting the milestone-ships-as-Larry-Reaches contract and that the gate never
  requires Brain/web/Vercel.
- Implemented `runDogfoodAcceptance(opts)` modeled on `runAcceptance`: builds the 5
  ACPT points (ACPT-01..05), each spawning `node <driver>` via
  `child_process.spawnSync` with a 120000ms timeout, `ok = (status === 0)`. Collects
  per-point pass/fail plus a summary `{ total, passed, failed }` and `failed_points`.
  Honors `--json`.
- Wired the dispatch in `main()` BEFORE the class-flag exit-0 path so the own-contract
  exit wins; `process.exit(result.summary.failed > 0 ? 1 : 0)`.
- Added a doc note to `commands/explain-decision.md`: explain-decision is the
  loop-fires assertion surface (routing_source + fired reach_id + posture); the Phase
  146 loop-fires gate is hosted at `doctor --dogfood-acceptance` and
  `tests/run-all-146.sh`. Behavior unchanged (doc note only).

### Task 2: tests/run-all-146.sh aggregator (5 ACPT + upstream re-runs)

- Cloned the run-all-144.sh skeleton exactly (`set -uo pipefail`, SCRIPT_DIR, per-suite
  PASS/FAIL loop that runs to completion even on failure, final tally + exit 1 if any
  failed).
- Group (a): CJS_SUITES = the 5 ACPT drivers (each drives a REAL shipped unit).
- Group (b): SHELL_SUITES = run-all-144.sh + run-all-1441.sh + run-all-145.sh re-run as
  shell suites (full-surface certification, mirroring how run-all-1441.sh composes
  sibling aggregators).
- Header documents what it PROVES and the plan-ownership of each ACPT driver plus the
  three upstream gates. Executable bit set; bash only; zero em-dashes.

### Task 3: Full loop-fires gate run end-to-end (checkpoint:human-verify, auto-verified)

Ran both gate surfaces to completion. All checks green; see Verification below.

## Verification

| Check | Result |
| --- | --- |
| `node --check scripts/doctor.cjs` | PASS |
| `node scripts/doctor.cjs --help` shows `--dogfood-acceptance` block | PASS |
| `bash -n tests/run-all-146.sh` | PASS (SYNTAX_OK) |
| run-all-146.sh lists 5 ACPT + re-runs run-all-144/1441/145 | PASS (COMPOSES_OK) |
| `bash tests/run-all-146.sh` exit code | 0 (8/8 constituents green: 5 ACPT + 3 upstream; ~101s) |
| `node scripts/doctor.cjs --dogfood-acceptance` exit code | 0 (5/5 ACPT points passed) |
| Negative sanity: break ACPT-01 -> both surfaces exit non-zero + name ACPT-01 | PASS (doctor exit=1, "failed: ACPT-01"; driver exit=7); reverted byte-exact |
| Gate needs NO live Brain/web/Vercel | PASS (hermetic legs carry the gate; ACPT-05 live mode_a self-skips) |
| Zero em-dashes in the diff (doctor.cjs + run-all-146.sh + explain-decision.md added lines) | PASS (0) |
| runDogfoodAcceptance path zero network surface (Part 8) | PASS (0 net tokens in the function body) |

The ACPT-05 live mode_a leg skipped honestly (Brain unreachable in this run) and the
hermetic mode_b arm proved the tier rise -- expected behavior, not a failure (T-146-14).

## Deviations from Plan

None - plan executed exactly as written.

## Threat Model Status

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-146-13 (false-green) | mitigate | MET -- negative sanity (Task 3 step 3) broke ACPT-01 and both surfaces exited non-zero naming the failing point |
| T-146-14 (false-green via skip) | mitigate | MET -- the gate requires the hermetic mode_b arm; ACPT-05 live mode_a self-skipped and the gate still proved the tier rise via mode_b |
| T-146-15 (sampling not full surface) | mitigate | MET -- run-all-146.sh re-runs run-all-1441.sh (exhaustive 114-surface gate) + run-all-144/145 |
| T-146-16 (info disclosure) | accept | doctor spawns LOCAL drivers only; zero net tokens in runDogfoodAcceptance |
| T-146-SC (package installs) | accept | no new package installs (node built-ins + bash + existing project files only) |

## Canon Compliance

- Part 6 (Product-as-Venture / dog-fooding): the plugin's own loop-fires gate proves the
  loop FIRES across the plugin's own surface -- the dog-fooding mandate enforced at the
  aggregate.
- Part 8 (Graph Boundary): `--dogfood-acceptance` adds zero network surface in doctor
  itself; the spawned drivers are LOCAL/hermetic; the gate never requires a reachable
  Brain.
- Part 3 (Tri-Context Decision Gate): explain-decision named as the loop-fires assertion
  surface (routing_source + fired reach_id + posture).
- No em-dashes (CLAUDE.md / feedback_no_emdashes hard rule): zero in the diff.

## Self-Check: PASSED

- FOUND: tests/run-all-146.sh
- FOUND: scripts/doctor.cjs (modified, --dogfood-acceptance present)
- FOUND: commands/explain-decision.md (modified, gate-host doc note present)
- FOUND commit: 5bfebc67 (Task 1: doctor gate class)
- FOUND commit: 240dcdc1 (Task 2: run-all-146.sh aggregator)
