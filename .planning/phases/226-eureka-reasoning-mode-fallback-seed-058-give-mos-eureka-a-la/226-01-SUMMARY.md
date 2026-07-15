---
phase: 226-eureka-reasoning-mode-fallback-seed-058-give-mos-eureka-a-la
plan: 01
subsystem: eureka
tags: [reasoning-mode, eureka-critic, jaccard, structure-mapping, fallback, calibration, cjs]

# Dependency graph
requires:
  - phase: 212-eureka-grounding-guard
    provides: "runRubric / verdictFromRubric / buildNeutralPrompt / buildAdversarialPrompt / parseRubricResponse + Gate 1 fabricated-quantity regexes (the encoder-free Stage B critic reasoning-mode reuses at parity)"
  - phase: 211-eureka-generator
    provides: "lexicalOverlap (jaccard-v1) - the one numeric leg that survives with no encoder"
  - phase: 215-opportunity-statement
    provides: "buildOpportunityStatement - the canonical statement assembler and banked-false fail-closed precedent"
provides:
  - "lib/core/eureka/reasoning-mode.cjs: the encoder-free reasoning-mode scoring core (readRoomMarkdown, proposeCandidatePairs, validateMappings, emitReasoningPrompts, scoreReasoningPairs, buildReasoningStatement, assertReasoningInvariants, reasoningMaxPairs, REASONING_FORMULA_VERSION)"
  - "eureka-critic.cjs additive reuse exports (buildNeutralPrompt, buildAdversarialPrompt, parseRubricResponse, _gate1)"
  - "tri-modal-index.cjs _forceUnavailable forwarding seam (plan 02's degrade-test hook)"
  - "The >= 12 pair reasoning-mode reference dataset (tests/fixtures/226-reasoning-pairs.cjs)"
  - "The D1 null-legs regression guard + the D3 critic-bar-parity guard"
affects: [226-02, 226-03, 226-04, eureka-portfolio-report, mos-eureka]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Encoder-free scoring: Jaccard as the ONLY numeric anchor, differential_score/semantic_similarity structurally null, asserted by code not judged"
    - "Byte-parity prompt reuse: the fallback path calls the exported critic prompt builders directly instead of forking a third prompt copy"
    - "Deterministic refuse-to-emit guard: assertReasoningInvariants (node:assert on null legs + banked:false) as the writer's pre-write gate"

key-files:
  created:
    - lib/core/eureka/reasoning-mode.cjs
    - tests/test-226-null-legs.cjs
    - tests/test-226-rubric-parity.cjs
    - tests/fixtures/226-reasoning-pairs.cjs
  modified:
    - lib/core/eureka-critic.cjs
    - lib/core/eureka/tri-modal-index.cjs

key-decisions:
  - "Gate 1 runs inside both emitReasoningPrompts and scoreReasoningPairs (idempotent, shared critic._gate1 regexes) so the scorer is self-contained and testable without a prior emit step"
  - "answers[id] accepts either { neutral, adversarial } (session/fixture shape) or { judgeFn } (caller-supplied judge, e.g. the parity test's call-counter); both drive runRubric's exactly-two-pass protocol unchanged"
  - "buildReasoningStatement supplies a deterministic shared_problems placeholder because opportunity-statement.cjs validateCandidate rejects an empty array (the plan's literal shared_problems:[] would throw)"
  - "No AHP composite is computed on the reasoning path: a blended quality score would fuse trust-in-evidence with plausibility (D2's explicit Bad case)"

patterns-established:
  - "Zero-new-dep CJS module shape (frozen versioned constant, pure/never-throw helpers, _test block) extended to the reasoning-mode core"
  - "Cross-section Jaccard pre-filter capped by MINDRIAN_EUREKA_REASONING_MAX_PAIRS (default 25) as the bounded-fan-out cost control"

requirements-completed: [REQ-1, REQ-2, REQ-7]

# Metrics
duration: ~35min
completed: 2026-07-15
---

# Phase 226 Plan 01: Reasoning-Mode Core Module Summary

**The encoder-free /mos:eureka fallback core: reads raw room markdown, Jaccard-pre-filters candidate pairs, runs the SAME two-pass Grounding Guard rubric at full rigor, and emits statements that structurally CANNOT carry a fabricated encoder number (differential_score/semantic_similarity hard-null, banked hard-false, guarded by a deterministic code assertion).**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 of 3
- **Files created:** 4
- **Files modified:** 2

## Accomplishments

- **Task 1 (D1 test-first, RED):** Authored `tests/test-226-null-legs.cjs` and the >= 12 pair fixture reference set BEFORE any implementation, proved it RED (require of the not-yet-written module fails), and committed the failing state. This is the phase's single highest-stakes correctness property (REQ-1/D1/G-1, the fabricated-number prohibition).
- **Task 2 (core module + seams, GREEN for D1):** Built `lib/core/eureka/reasoning-mode.cjs` (467 lines) with the full emit/score/assemble/assert surface, plus two small additive seams: the critic prompt/Gate-1 reuse exports and the tri-modal `_forceUnavailable` forwarding. The D1 test turned green; the shipped critic and embedded-index suites stayed byte-behaviour-identical.
- **Task 3 (D3 + D8 parity, GREEN):** Added `tests/test-226-rubric-parity.cjs` with 8 legs proving the analogy bar was not relaxed encoder-free: judge call-count === 2, verdict === `verdictFromRubric` output, prompt files byte-equal to the exported builders, mechanism+mapping-only prompt discipline, rejection set stays rejected, Gate 1 routes a $-figure to pseudoscience with zero prompt files, the Jaccard cap bounds fan-out, and a missing judge answer never routes transferable.

## Verification

| Check | Result |
|-------|--------|
| `node tests/test-226-null-legs.cjs` (D1) | exit 0 |
| `node tests/test-226-rubric-parity.cjs` (D3 + D8 unit cap) | exit 0 |
| `bash tests/run-all-212.sh` (critic behaviour untouched) | PASS=6 FAIL=0 |
| `bash tests/run-all-215.sh` (embedded path untouched, SEED req 7) | PASS=8 FAIL=0 |
| `grep -nE "fetch\(|https?://" reasoning-mode.cjs` (Canon Part 8) | nothing (zero egress) |
| `grep -c "require(" reasoning-mode.cjs` | 6 (3 node built-ins + 3 in-repo, zero new deps) |
| em-dashes across all touched files | 0 |
| TDD RED->GREEN both states verified | yes (RED committed `ba50649e`, GREEN `f8bce032`/`ecf0be7f`) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shared_problems placeholder in buildReasoningStatement**
- **Found during:** Task 2
- **Issue:** The plan's literal candidate shape passes `shared_problems: []` to `oppmod.buildOpportunityStatement`, but `validateCandidate` in `opportunity-statement.cjs` throws on an empty `shared_problems` array (`shared_problems[0]` must be a non-empty string). The literal value would have made every reasoning statement build throw.
- **Fix:** Supply a deterministic placeholder `['cross-domain structural transfer']` so the canonical assembler runs. The honesty-bearing fields (banked:false, null legs, mode:reasoning) are overridden unconditionally afterward, so the placeholder never weakens the D1/D5 contract.
- **Files modified:** lib/core/eureka/reasoning-mode.cjs
- **Commit:** f8bce032

## Notes for Downstream Plans

- **Plan 02 (writer + degrade branch):** call `assertReasoningInvariants(result)` immediately before `fs.writeFileSync`; it is the deterministic refuse-to-emit guard. Use the tri-modal `_forceUnavailable` seam to force `idx.embedded !== true` in degrade tests even on a machine with the model cached.
- **Plan 04 (provenance/field parity):** the end-to-end `provenance.run_mode === 'reasoning'` and cap-provenance assertions land there; this plan asserts the cap only at the unit level.
- **weak_dimensions shape:** `buildReasoningStatement` currently passes through `buildOpportunityStatement`'s `{ a, b }` weak_dimensions object. The AI-SPEC `ReasoningStatement` zod names `weak_dimensions` as an array; if plan 04's field-parity test pins the array shape, reconcile it there against the embedded emitter's actual statements[] output (not asserted in plan 01).

## Known Stubs

None. `differential_score: null` and `semantic_similarity: null` are the intended, contract-required values (the encoder is structurally absent on this path), not unwired stubs. `readRoomMarkdown` returning `[]` on a missing dir is the documented never-throw degrade, not a placeholder.

## Self-Check: PASSED

- Files: reasoning-mode.cjs, test-226-null-legs.cjs, test-226-rubric-parity.cjs, 226-reasoning-pairs.cjs all FOUND on disk.
- Commits: ba50649e (RED), f8bce032 (feat/GREEN), ecf0be7f (parity) all FOUND in git log.
