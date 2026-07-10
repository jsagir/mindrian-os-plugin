---
phase: 212-eureka-substrate-grounding-guard
plan: 04
subsystem: eureka
tags: [eureka, critic, gold-set, plurai, gate, part8, acceptance]

# Dependency graph
requires:
  - phase: 212-02
    provides: "lib/core/eureka-critic.cjs classifyCandidate (Stage A -> Stage B -> confidence pipeline) + criticRule; the routing this suite scores against gold verdicts"
  - phase: 212-01
    provides: "stageA deterministic gates + assembleCriticPayload; the fabricated-quantity short-circuit this suite asserts BEFORE any judge call"
  - phase: 211-eureka-generator-mvp
    provides: "the 6 SEED-050 gold cards under evals/eureka/cases/ (gold_label.salient ground truth) + lab/eval/report-from-transcript.cjs callJudge/JUDGES (Part 7 reuse for the Plurai leg)"
provides:
  - "evals/eureka/opportunity-drafts/pair-1-arrhythmias.md + pair-2-cerebral-aneurysm.md: the critic's first two real-world acceptance fixtures (name-stripped JHU Opportunity Statements, pending_human_review, quantities_sourced)"
  - "tests/test-212-gold-cards.cjs: D7 leg (a) fixture suite - 6 cards routed vs expected verdicts, sterling anchored first"
  - "tests/test-212-plurai-leg.cjs: the OPTIONAL deployed-classifier leg with SKIP + baseline_deferred degrade (navigator Q3 lock)"
  - "tests/run-all-212.sh: the D7 phase gate aggregator composing legs a-d plus Stage A/B supporting suites, run_if file-guarded"
  - "evals/plurai/212-baseline.json: the deferred Plurai baseline (endpoint 404s today)"
affects: [212-05 calibration, 213 eureka-reach, SEED-014 brain-lift]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Verdict-by-code ROUTING test isolated from gate CALIBRATION: relax the two content-shaped Stage A floors (swap-invariance, entity) to stub thresholds so every gold card reaches the two-pass rubric; gate calibration stays owned by test-212-critic-stage-a.cjs"
    - "Gold-derived judge stubs: the judgeFn answers the 6 binary rubric items derived from each card's human gold_label; CODE (verdictFromRubric) computes the class, never the stub"
    - "Aggregator SKIP semantics inherited line-for-line from run-all-211.sh: run/run_if, PASS/FAIL/SKIP, the eureka-offline-preload zero-network guard, no em-dashes"
    - "Optional deployed-judge leg degrades to SKIP + baseline_deferred on missing key OR endpoint error (test-211-judge-gate.cjs precedent); it can never red-fail the phase gate"
    - "Read-only lab-side fixtures: the room research entry is READ, repo fixtures are WRITTEN; nothing crosses back to any room, and personal surnames never enter the tracked repo"

key-files:
  created:
    - "evals/eureka/opportunity-drafts/pair-1-arrhythmias.md"
    - "evals/eureka/opportunity-drafts/pair-2-cerebral-aneurysm.md"
    - "tests/test-212-gold-cards.cjs"
    - "tests/test-212-plurai-leg.cjs"
    - "tests/run-all-212.sh"
    - "evals/plurai/212-baseline.json"
  modified: []

key-decisions:
  - "The gold-card suite relaxes EUREKA_SWAP_INVARIANCE_FLOOR and EUREKA_ENTITY_MIN to 0 because the stub encoder over the real card destinations sits below the mdbr-leaf-ir-calibrated thresholds; this suite's SUT is verdict-by-code ROUTING, and Stage A gate calibration is proven separately with crafted stubs in test-212-critic-stage-a.cjs. Stage A ORDERING (fabricated-quantity kills before the judge) is asserted directly with the REAL default gate and a judge-call counter."
  - "In-enum seeded distractors (general_shallow / restatement / pseudoscience) are asserted NON-transferable under an honest-generic judge; general_shallow distractors specifically must route general_shallow or pseudoscience. Out-of-enum distractor labels (knowledge_gap_question, status_quo_stuck, seductive_wrong_formalization, false_compression - Phase 213 question-type and other scopes) are explicitly SKIPPED with a printed note, never silently dropped."
  - "The two JHU fixtures ship with expected_verdict pending_human_review: no gold label is invented here (these are exactly the unverified Eurekas the phase exists to rule on; plan 05's human checkpoint produces the ruling). quantities_sourced: true so the unsourced-quantity Stage A gate would not auto-kill a catalog-sourced figure when the critic later reads them."
  - "The Plurai leg reason is plurai_endpoint_unreachable (a key resolved from ~/.config/evals/credentials.json but the cross-topic-connection route 404s); the leg SKIPs and writes the deferred baseline, exit 0. Upload/Optimize is a data dependency (the pending 211 human-labeled corpus), not a build gap."

patterns-established:
  - "Pattern 7: a ROUTING acceptance suite relaxes the deterministic pre-gates to stub thresholds so the code-under-test (verdict-by-code) is exercised in isolation, while the relaxed gates' own calibration is proven in a sibling suite - the two never test the same thing twice."
  - "Pattern 8: the phase gate aggregator is HALF the gate; run-all-212 green is the automated half, the plan-05 human >=0.85 calibration checkpoint is the other half (Q2 lock, restated in the aggregator header) - accuracy is never an automated assertion."

requirements-completed: [212-D3, 212-D6, 212-D7]

# Metrics
duration: 20min
completed: 2026-07-10
---

# Phase 212 Plan 04: Eureka Grounding Guard Acceptance Substrate + D7 Phase Gate Summary

**The phase's acceptance substrate: two name-stripped JHU Opportunity Statement fixtures pinned as the critic's first real-world workload (pending_human_review, no invented gold label), a D7(a) gold-card fixture suite that routes all 6 SEED-050 cards through classifyCandidate's verdict-by-code against their expected verdicts with the lean-checkable archimedes-sterling anchored FIRST, an OPTIONAL Plurai deployed-classifier leg that degrades to SKIP + baseline_deferred when the endpoint 404s (navigator Q3 lock), and the run-all-212.sh gate aggregator composing D7 legs a-d plus the Stage A/B supporting suites with run_if SKIP semantics so a partially-landed phase never red-fails.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-10
- **Tasks:** 3 (all type=auto)
- **Files:** 6 created (2 fixtures + 3 test surfaces + 1 generated deferred baseline)

## Accomplishments

- Pinned the critic's first real acceptance workload as two read-only lab fixtures under `evals/eureka/opportunity-drafts/`: `pair-1-arrhythmias` (C16796 x C03552) and `pair-2-cerebral-aneurysm` (C16742 x C05004), copied from the room entry section 4 with all personal inventor surnames stripped to role descriptors, quantities marked catalog-sourced, and honest `pending_human_review` status (no gold label invented). These replace the room entry's "treat both as unverified Eurekas, not yet bankable" flag with a tracked, name-safe fixture the critic can read.
- Shipped `tests/test-212-gold-cards.cjs` (D7 leg a): all 6 SEED-050 cards routed through `classifyCandidate` with gold-derived judge stubs. `archimedes-sterling` is asserted FIRST as the lean-checkable objective anchor (D3: validate the routing on the objectively-settleable case before the human-judged ones). Each remaining card's routed verdict equals its `gold_label.salient`; seeded distractors are asserted non-transferable; out-of-enum distractor labels are explicitly SKIPPED with a printed note. Disagreement handling and Stage A ordering (fabricated-quantity kills before the judge, 0 judge calls) are asserted directly. 16 passed, 0 failed, 4 skip.
- Shipped `tests/test-212-plurai-leg.cjs` (optional, navigator Q3 lock): reuses `callJudge`/`JUDGES` from `lab/eval/report-from-transcript.cjs` (Part 7, no hand-rolled REST client) on synthetic gold-card text only (Part 8 egress rule). On this machine the endpoint 404s, so it SKIPs and writes `evals/plurai/212-baseline.json` with `baseline_deferred`, exit 0 - never a red CI failure.
- Shipped `tests/run-all-212.sh`, modeled line-for-line on `run-all-211.sh`: composes D7 legs (a) gold cards, (b) D6 negative corpus, (c+d) Part 8/D5 boundary scan, plus the Stage A and Stage B supporting suites and the optional Plurai leg. Every leg is `run_if` file-guarded (7 guards), the `eureka-offline-preload` zero-network guard is inherited, and the footer exits non-zero only when FAIL > 0. Green: PASS=6 FAIL=0 SKIP=0.

## Task Commits

Each task committed atomically:

1. **Task 1: two JHU Opportunity Statement acceptance fixtures** - `10715dd9` (feat)
2. **Task 2: D7 leg (a) gold-card fixture suite** - `1467cd69` (test)
3. **Task 3: optional Plurai leg + run-all-212 gate aggregator** - `89185c31` (test)

## Files Created/Modified

- `evals/eureka/opportunity-drafts/pair-1-arrhythmias.md` (created) - first acceptance fixture, name-stripped, pending_human_review.
- `evals/eureka/opportunity-drafts/pair-2-cerebral-aneurysm.md` (created) - second acceptance fixture, same schema.
- `tests/test-212-gold-cards.cjs` (created) - D7 leg (a): 6-card verdict-by-code routing suite, sterling anchored first.
- `tests/test-212-plurai-leg.cjs` (created) - optional deployed-classifier leg, SKIP + baseline_deferred degrade.
- `tests/run-all-212.sh` (created) - the D7 phase gate aggregator (legs a-d + supporting suites).
- `evals/plurai/212-baseline.json` (created, generated) - the deferred Plurai baseline (endpoint 404s today).

## Decisions Made

- **Routing isolated from calibration.** The gold-card suite relaxes the two content-shaped Stage A floors (swap-invariance, entity) to stub thresholds so every gold card reaches the two-pass rubric and the CODE computes the verdict from the judge's answers. The relaxed gates' own calibration is proven in the sibling `test-212-critic-stage-a.cjs` with crafted stubs; the two suites never test the same thing twice. Stage A ORDERING (a `$5B`/`10B` candidate short-circuits to pseudoscience with 0 judge calls) is asserted with the REAL default gate.
- **No invented gold label for the real drafts.** Both JHU fixtures ship `expected_verdict: pending_human_review` - they are staged for plan 05's human ruling, and `quantities_sourced: true` so a future critic read does not auto-kill their catalog-sourced figures.
- **Plurai can never block.** The deployed leg is separately gated; a resolved key with a 404 endpoint (its state today) SKIPs and defers, honoring the Q3 lock. Upload/Optimize is deferred as a data dependency (the pending 211 human-labeled corpus), not a build gap.

## Deviations from Plan

None - plan executed exactly as written. The one judgment call (relaxing the two Stage A floors in the gold-card ROUTING suite) is documented at the top of `test-212-gold-cards.cjs` and above: it isolates verdict-by-code from gate calibration, which is the plan's stated intent for leg (a) ("the suite verifies the PIPELINE ROUTING ... while plan 05 verifies real-judge accuracy"). Not a deviation-rule invocation.

## Issues Encountered

- The `run-all-211.sh` no-regression run refreshed `evals/plurai/211-baseline.json`'s date field (2026-07-05 -> 2026-07-10) as a side effect of the 211 judge-gate leg. This is an incidental generated-artifact refresh out of this plan's scope; it was reverted so the Task 3 commit stays focused on the 212 artifacts. `run-all-211.sh` remains green (PASS=10 FAIL=0 SKIP=0).

## Threat Model Coverage (from PLAN.md threat_model)

- **T-212-14 (info disclosure - real names in fixtures):** mitigated - all inventor surnames stripped to role descriptors at authoring; a surname grep across `evals/eureka/opportunity-drafts/` returns 0, and `test-211-case-cards.cjs` (the hash deny-list) stays green.
- **T-212-15 (info disclosure - Plurai leg payload):** mitigated - the leg scores synthetic gold-card text only; the EGRESS RULE header is restated in both the leg and the aggregator (run-all-211 precedent).
- **T-212-16 (DoS / CI fragility - deployed-judge dependency):** mitigated - SKIP + baseline_deferred degrade; the endpoint 404 SKIPs and cannot fail the gate.
- **T-212-SC (npm/pip/cargo installs):** accepted - zero new packages this phase; no install task ran.

## User Setup Required

None - no external service configuration required. Zero new packages (Part 7 reuse only; the 212-RESEARCH Package Legitimacy Audit stands). The optional Plurai baseline can be replaced with a live record by setting `PLURAI_API_KEY` once the `cross-topic-connection` route is deployed.

## Next Phase Readiness

- The D7 phase gate is composed: `bash tests/run-all-212.sh` is green and is the automated half of the gate. The other half is plan 05's human >=0.85 calibration checkpoint (Q2 lock, restated in the aggregator header).
- The two JHU drafts are staged for plan 05's human ruling with no invented gold label.
- Phase 213 (eureka-reach) inherits the fixtures and the aggregator; the SEED-014 Brain-lift inherits a critic whose acceptance substrate is fully offline and portable.
- Scope note (navigator Q1 lock): this is the critic-only slice; the substrate/whitespace half of the ROADMAP goal moves to Phase 212.5.

## Self-Check: PASSED

- All 6 created files exist on disk (2 fixtures, 3 test surfaces, 1 generated baseline).
- All 3 task commits (`10715dd9`, `1467cd69`, `89185c31`) exist in git history.
- `bash tests/run-all-212.sh` exit 0 (PASS=6 FAIL=0 SKIP=0); `node tests/test-212-gold-cards.cjs` exit 0 (sterling asserted first); `node tests/test-212-plurai-leg.cjs` exit 0 (SKIP + baseline_deferred); `node tests/test-211-case-cards.cjs` exit 0; `bash tests/run-all-211.sh` PASS=10 FAIL=0 SKIP=0 (no regression).

---
*Phase: 212-eureka-substrate-grounding-guard*
*Completed: 2026-07-10*
