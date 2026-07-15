---
phase: 225-per-session-room-binding-and-multi-session-reconciliation-se
plan: 01
subsystem: infra
tags: [intent-classifier, session-binding, f8-gate, shape-f8-renderer, hooks, canon-83-07, canon-part-11]

# Dependency graph
requires:
  - phase: 194-per-session-room-binding
    provides: "session-binding.cjs (readSessionBinding), emitBindingGate + consumePriorBindingAnswer, shape-f8-renderer, the binding_gate_payload trace contract"
provides:
  - "emitNoMatchGate: a distinct zero-score F.8 Decision Gate (continue-in-primary / new-project / no-room) that never reuses the arbitrary corpus[0] best.name"
  - "zeroScoreGateAlreadyOffered: PD-1 once-per-session-per-room trace suppression"
  - "ZERO_SCORE_GATE_MIN_TOKENS: PD-3 anti-overfire substantiality floor (env-overridable)"
  - "zero-score branch replacing the blanket intent-classifier line-509 return 0"
  - "tests/test-225-zero-score-gate.cjs, tests/test-225-gate-degrade.cjs"
affects: [225-02, 225-03, intent-classifier, session-binding, run-all-225]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zero-score case is semantically distinct from off-scope: the gate offers session.primary + new-project + no-room, NEVER best.name (corpus[0])"
    - "Fail-open no-match gate: every branch path terminates in return 0; render/binding/trace faults degrade to exit-0 silence (Canon 83-07)"
    - "Reuse the shipped consumer via the binding_gate_payload key with a distinct kind for trace disambiguation (zero consumer changes)"

key-files:
  created:
    - tests/test-225-zero-score-gate.cjs
    - tests/test-225-gate-degrade.cjs
  modified:
    - scripts/intent-classifier.cjs

key-decisions:
  - "PD-1: the zero-score gate fires once per session per room even under sticky; continue-in-primary pre-checked at 0.71"
  - "PD-3: a substantiality floor (>= 8 tokens, env-tunable) plus once-per-session trace suppression prevents the Phase-210 over-enforcement mistake"
  - "PD-5: persist under the SAME binding_gate_payload key the shipped consumePriorBindingAnswer scans (keys on e.binding_gate_payload, not e.kind), reusing the consumer unchanged"

patterns-established:
  - "Never reuse best.name on a zero score (Pitfall 1): it is corpus[0], semantically meaningless"
  - "New gate composition clones emitBindingGate step-for-step (renderer, trailer, side-channel, trace, envelope), each cross-module require in its own fail-open try/catch"

requirements-completed: [REQ-1, REQ-2, REQ-3, REQ-5]

# Metrics
duration: ~20min
completed: 2026-07-15
---

# Phase 225 Plan 01: Zero-score no-match binding gate Summary

**A conversational reframe that matches NO room now fires a distinct F.8 "no room matched" Decision Gate (continue-in-primary / new-project / no-room) instead of silently landing the write in the old bound primary; the gate never reuses the arbitrary corpus[0] best.name and fails open to exit-0 silence on any fault.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-15T13:17:00Z (approx)
- **Completed:** 2026-07-15T13:37:31Z
- **Tasks:** 2
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments

- Closed the SEED-039 proving_case_2 gap: the blanket `if (!best || best.score === 0) return 0;` at intent-classifier line 509 (the Gaurav student-reframe incident, 2026-07-14) is replaced with a zero-score branch that fires a no-match gate when the session has a real bound primary and the message is substantive.
- Added `emitNoMatchGate` cloning the shipped `emitBindingGate` composition (renderer, AskUserQuestion trailer, card-fire side-channel, decision-trace, envelope), presenting three options that NEVER include a scored room (REQ-2).
- Added `zeroScoreGateAlreadyOffered` (PD-1 once-per-session-per-room suppression) and `ZERO_SCORE_GATE_MIN_TOKENS` (PD-3 anti-overfire floor, env-overridable).
- Reused the shipped `consumePriorBindingAnswer` with zero changes via the `binding_gate_payload` key (PD-5), proven by the trace assertion in the integration test.
- Two self-running test files: a five-leg integration proof (FIRE + four silence contracts + a consumer-compatibility trace proof) and a two-leg fail-open degrade proof.

## Task Commits

1. **Task 1: emitNoMatchGate + the zero-score gate branch** - `8532e799` (feat)
2. **Task 2: proving_case_2 integration test + fail-open degrade test** - `e97e214b` (test)

_Note: the parallel Phase 224 session interleaved three commits (`58e901d0`, `0262de57`, `b8bece52`) between these two; that is expected on the shared sequential tree and is not this plan's work._

## Files Created/Modified

- `scripts/intent-classifier.cjs` - Added `ZERO_SCORE_GATE_MIN_TOKENS`, `zeroScoreGateAlreadyOffered`, `emitNoMatchGate`, and the zero-score branch replacing the line-509 blanket return.
- `tests/test-225-zero-score-gate.cjs` - Five-leg integration test (spawns the classifier against a temp fixture) + a trace/payload consumer-compatibility proof.
- `tests/test-225-gate-degrade.cjs` - Fail-open degrade proof: poisoned binding -> exit-0 silence; corrupt trace -> exit-0 no-crash.

## Decisions Made

- Fixture design (plan-checker Warning 1 fix): `copper-ledger` is registered FIRST (so it is corpus[0], the arbitrary `best.name` on a zero score) and is NOT the bound primary; `quantum-bakery` is registered SECOND and is the bound primary. This makes the FIRE leg's "stdout excludes copper-ledger" a real negative test for a best.name-reuse leak.
- Test env sets BOTH `MINDRIAN_ROOMS_ROOT` and `MINDRIAN_ROOMS_HOME` to the fixture home: `main()`'s `root` resolves via `resolveMindrianRoomsRoot()` (reads `MINDRIAN_ROOMS_ROOT`), while the active-room chokepoint reads `MINDRIAN_ROOMS_HOME`. Setting both to the same fixture path keeps every resolver on the fixture and satisfies the plan's stated `MINDRIAN_ROOMS_HOME` requirement.
- Silence is asserted on the zero-score gate's OWN distinctive markers (`no room matched` / `continue in quantum-bakery`), never on an empty stdout, because the classifier's always-on Phase-91 navigation engine block also writes to stdout.

## Deviations from Plan

None - plan executed exactly as written. (The plan's Task 2 explicitly delegated the exact silence-assertion mechanism and the `resolveActiveRoomDir` field-name confirmation to execution; both were resolved by reading the live resolver and the engine-block output rather than by changing plan scope.)

## Issues Encountered

- The classifier's navigation engine block emits its own F.1 card to stdout on every run, so "silence" could not be asserted as empty output. Resolved by asserting absence of the zero-score gate's distinctive header/option strings, which the engine block never produces.

## Verification

- `node --check scripts/intent-classifier.cjs` - passes
- `node tests/test-225-zero-score-gate.cjs` - PASS (6 checks: FIRE + trace proof + 4 silence legs)
- `node tests/test-225-gate-degrade.cjs` - PASS (2 checks)
- `bash tests/run-all-194.sh` - 14 passed, 0 failed, 0 skipped (no regression on the shipped Phase-194 substrate)
- `grep -c "zero_score_gate"` = 4 (>= 2 required); no `best.name` in the `emitNoMatchGate` body (REQ-2)
- `node scripts/check-render-coverage.cjs` - 0 gap; `node scripts/check-shape-declaration.cjs --check` - exit 0 (advisory; all WARNs are pre-existing `skills/*.md` declarations, none attributable to this change - no new invocable surface, REQ-5 Part 11 born-wired)
- Part 8 egress grep on `scripts/intent-classifier.cjs` - no new `mindrian-brain` / `onrender` token

## Next Phase Readiness

- Plan 225-02 (doctor WAL advisory) and 225-03 remain; this plan is disjoint from them.
- The `tests/run-all-225.sh` aggregator + `lib/memory/run-feynman-tests.cjs` registration are Wave-0 items owned by a later plan (RESEARCH.md Wave 0 Gaps); the two test files created here already run standalone via `node`.

---
*Phase: 225-per-session-room-binding-and-multi-session-reconciliation-se*
*Completed: 2026-07-15*

## Self-Check: PASSED

- FOUND: scripts/intent-classifier.cjs
- FOUND: tests/test-225-zero-score-gate.cjs
- FOUND: tests/test-225-gate-degrade.cjs
- FOUND: .planning/phases/225-.../225-01-SUMMARY.md
- FOUND commit: 8532e799 (Task 1 feat)
- FOUND commit: e97e214b (Task 2 test)
