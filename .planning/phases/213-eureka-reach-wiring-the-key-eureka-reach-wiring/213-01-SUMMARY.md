---
phase: 213-eureka-reach-wiring
plan: 01
subsystem: eureka
tags: [eureka, compression, graders, critic, verdict-by-code, seed-050]

# Dependency graph
requires:
  - phase: 211-eureka-eval-gold-set
    provides: the 6 SEED-050 gold case cards (evals/eureka/cases/*.md) + the frozen README formula/rubric (the calibration baseline)
  - phase: 212-eureka-substrate-grounding-guard
    provides: the closed critic verdict enum (data/eureka-critic-tags.json), the verdict-by-code idiom, and the human-approved calibration baseline (212-critic-baseline.json, calibrated 0.83)
provides:
  - "lib/core/eureka/compression-meter.cjs: the deterministic COMPRESSION meter (Score = CompressionDelta x GuardGate x StatusQuoGate), runtime-side"
  - "lab/eureka-graders/arrival-grader.cjs: verdict-by-code Arrival grader (Full/Partial/Missed/Lured; Lured feeds the meter's negative leg)"
  - "lab/eureka-graders/status-quo-judge.cjs: mode-conditioned status-quo label judge (status_quo_stuck vs redirect_ok)"
  - "two regression tests reproducing the hand-scoring rubric arithmetic"
affects: [213-02, 213-03, 213-04, 213-05, eureka-reach-wiring, apo-reward-signal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "verdict-by-code: closed enum computed by CODE from judged booleans/scalars; the LLM produces the per-item inputs but never picks the class (mirrored from 212 D2, not imported)"
    - "runtime-side meter / eval-side graders split (RESEARCH Open Question 1 recommendation, flagged for the navigator)"
    - "pure sync zero-I/O CJS modules, defensive (never throw), zero network/Brain/MCP (Canon Part 8)"

key-files:
  created:
    - lib/core/eureka/compression-meter.cjs
    - lab/eureka-graders/arrival-grader.cjs
    - lab/eureka-graders/status-quo-judge.cjs
    - tests/test-213-compression-meter.cjs
    - tests/test-213-graders.cjs
  modified:
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "Meter home is runtime-side (lib/core/eureka/), graders home is eval-side (lab/eureka-graders/) - implemented as the flagged Decision-Gate recommendation, NOT self-relocated"
  - "Lured leg = LURED_PENALTY (-1) x max(compressionDelta, MIN_LURED_MAGNITUDE 0.25): a Lured run is strictly negative and never a soft zero, and a high-would-be-compression run is penalized MORE"
  - "Gate labels are NAMED, not re-minted: GUARD_ZERO_LABEL='pseudoscience' (a 212 critic verdict), STATUS_QUO_ZERO_LABEL='status_quo_stuck' (the status-quo judge label)"

patterns-established:
  - "Compression-not-arrival scoring: CompressionDelta = (humanBaseline - observed)/humanBaseline clamped [0,1]; arrival-without-compression (nichefoods-null shape) scores ~0"
  - "Mode-conditioned status-quo judge: stuck ONLY when intent signalled AND status quo rejected AND the turn re-defends it"

requirements-completed: [EUREKA-04, EUREKA-05]

# Metrics
duration: ~20min
completed: 2026-07-10
---

# Phase 213 Plan 01: Eureka Critic Legs (COMPRESSION meter + Arrival grader + status-quo judge) Summary

**The three Phase-212-deferred critic legs, all deterministic CODE: a COMPRESSION meter (Score = CompressionDelta x GuardGate x StatusQuoGate) where a Lured arrival scores strictly negative and arrival-without-compression scores ~0, plus verdict-by-code Arrival and status-quo graders with frozen closed enums.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-10
- **Tasks:** 2 (both TDD)
- **Files created:** 5 (3 source modules + 2 test files)

## Accomplishments
- The deterministic COMPRESSION meter (SEED-050 THE METRIC): no LLM anywhere in the formula path; the composite is pure arithmetic over already-judged scalars/enums.
- Lured-negative enforced in code: a Lured arrival returns `LURED_PENALTY x max(compressionDelta, MIN_LURED_MAGNITUDE)`, strictly < 0, and no open gate can rescue it (falling for a seeded distractor dominates).
- The nichefoods-null anchor holds: arrival Full with CompressionDelta 0 scores 0 (arrival without compression = null result), so the metric can never conflate confirmation with compression.
- Arrival grader (Full/Partial/Missed/Lured, credit = sub-claims reached/total) and status-quo judge (mode-conditioned status_quo_stuck vs redirect_ok), both verdict-by-code with frozen closed enums.
- The flagged home decision implemented as recommended: meter runtime-side (lib/core/eureka/), graders eval-side (lab/eureka-graders/); MCP-servable judge packaging explicitly deferred to the consolidation arc.

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1: compression-meter.cjs** - `47baaf1f` (test, RED) then `53d88c04` (feat, GREEN)
2. **Task 2: arrival-grader.cjs + status-quo-judge.cjs** - `bda273ca` (test, RED) then `e8371b99` (feat, GREEN)

**Plan metadata:** committed with this SUMMARY (docs: complete plan).

## Files Created/Modified
- `lib/core/eureka/compression-meter.cjs` - the deterministic meter: computeCompressionDelta, guardGate, statusQuoGate, compressionScore, LURED_PENALTY, MIN_LURED_MAGNITUDE, GUARD_ZERO_LABEL, STATUS_QUO_ZERO_LABEL
- `lab/eureka-graders/arrival-grader.cjs` - ARRIVAL_VERDICTS (frozen), gradeArrival
- `lab/eureka-graders/status-quo-judge.cjs` - STATUS_QUO_LABELS (frozen), judgeStatusQuo
- `tests/test-213-compression-meter.cjs` - 7 behaviors, exit 0
- `tests/test-213-graders.cjs` - 7 behaviors + a local-only scan, exit 0

## TDD Gate Compliance
Both tasks followed RED then GREEN with separate commits. RED commits (`47baaf1f`, `bda273ca`) each failed with MODULE_NOT_FOUND before the implementation existed; GREEN commits (`53d88c04`, `e8371b99`) made them pass. No test passed unexpectedly during RED.

## Acceptance Criteria (all objective gates hold)
- `node tests/test-213-compression-meter.cjs` -> exit 0 (PASS=7)
- `node tests/test-213-graders.cjs` -> exit 0 (PASS=8, includes the local-only bonus scan)
- `grep -c "CompressionDelta x GuardGate x StatusQuoGate" lib/core/eureka/compression-meter.cjs` -> 2 (>= 1, formula verbatim)
- network/MCP scan across all three modules -> exit 1 (zero hits: no modelcontextprotocol, server.tool, fetch(, http(s))
- em-dash scan -> 0 per file (all three modules)

## Decisions Made
- Reconciled the one internal tension in the plan text: behavior Test 4 read `score === LURED_PENALTY` while the `<action>` specified the richer formula `-(max(compressionDelta, MIN_LURED_MAGNITUDE))`. The frontmatter must_have truth ("a Lured arrival scores NEGATIVE, not zero") and the action are authoritative, so LURED_PENALTY is defined as the negative multiplier constant (-1) and the Lured score is `LURED_PENALTY x max(compressionDelta, MIN_LURED_MAGNITUDE)`. The test asserts this exact value AND strictly < 0. This honors both the action's "e.g. -1 x compressionDelta floor'd" wording and the binding must_have.

## Deviations from Plan
None - plan executed exactly as written (both tasks, TDD, all acceptance gates). The Lured-leg reconciliation above is an interpretation of ambiguous plan text, not a deviation from intent.

## NAVIGATOR PRECONDITION OVERRIDE (explicit, human-granted)

The plan carried a hard EXECUTION PRECONDITIONS block (213-01-PLAN.md lines ~60-63) that would otherwise STOP execution. A prior dispatch correctly halted on it. Both preconditions were EXPLICITLY OVERRIDDEN by the navigator (Jonathan) via a direct decision-gate confirmation ("Override both, proceed now"), which is the plan's own sanctioned escape hatch ("If you want to override either precondition for this run, say so explicitly and I will proceed"). This was human-granted, never self-granted.

- **Precondition (a) - curing-sequence debug track:** `.planning/debug/beta13-curing-sequence-persona-and-commands-bisect.md` frontmatter still reads `status: gathering` (unresolved). **Override rationale:** the curing-sequence track is orthogonal to Eureka wiring and does not touch the same code surface (this plan only adds lib/core/eureka/ + lab/eureka-graders/ + tests/). Confirmed at execution start.

- **Precondition (b) - Phase 212 plan-05 calibration gate:** the bar was ">=0.85 gold-card accuracy, OR honestly deferred WITH navigator approval." Actual: `evals/eureka/212-critic-baseline.json` reads `status: "calibrated"`, `approved_at: 2026-07-10T08:45:27Z`, `gold_accuracy: 0.83` (not literally "deferred", and 0.83 < 0.85 numerically). **Override rationale:** 0.83 was human-reviewed and navigator-APPROVED end to end (STATE.md records the ruling; the lean-checkable objective anchor archimedes-sterling routed transferable = correct). The mismatch is a numeric-bar / deferred-vs-calibrated text discrepancy on an ALREADY-approved checkpoint, not an unreviewed result. The navigator confirmed 0.83-approved satisfies the spirit of (b).

Both gaps were shown to the navigator explicitly before the override was given.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. All three modules are pure, local, zero-dependency CJS.

## Next Phase Readiness
- The critic half's local arithmetic is in place. Plans 02-05 now have an honest thing to gate and tune against: 213-05 (APO reward SIGNAL) consumes compressionScore; the Arrival grader's Lured verdict feeds the meter's negative leg.
- No blockers introduced. The MCP-servable judge packaging (SEED-050:102-105) remains deferred to the consolidation arc's critic-MCP step, as flagged.

---
*Phase: 213-eureka-reach-wiring*
*Completed: 2026-07-10*
