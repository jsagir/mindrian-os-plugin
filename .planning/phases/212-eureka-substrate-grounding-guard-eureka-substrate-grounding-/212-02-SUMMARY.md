---
phase: 212-eureka-substrate-grounding-guard
plan: 02
subsystem: eureka
tags: [eureka, critic, rubric, llm-judge, verdict-by-code, calibration, part8, cjs]

# Dependency graph
requires:
  - phase: 212-01
    provides: "eureka-critic.cjs Stage A gates + assembleCriticPayload wire choke point + data/eureka-critic-tags.json closed enums; the module Stage B appends to"
  - phase: 211-eureka-generator-mvp
    provides: "embedding-spine encoderProvenance() consumed by the calibration-validity guard"
provides:
  - "lib/core/eureka-critic.cjs Stage B: RUBRIC_ITEMS (6 binary a-f), runRubric (two-pass, exactly 2 calls), verdictFromRubric (pure Pattern-2 mapping), classifyCandidate (composed Stage A -> Stage B -> confidence pipeline)"
  - "criticRule: the pure payload-only calibration ruling the Phase-03 MCP tool wraps (D4 thin-wrapper contract); closed-key discipline, coarse confidence, unknown routing"
  - "evals/eureka/212-critic-baseline.json: calibration bucket store in baseline_deferred state, stamped embedding_model MongoDB/mdbr-leaf-ir (Q4 lock)"
  - "The D6 negative corpus as an automated acceptance test (the minimum shipping bar)"
affects: [212-03 mcp-tool, 212-04 gold-cards, 212-05 calibration, SEED-014 brain-lift]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rubric-not-Likert: the LLM answers 6 binary items; CODE computes the verdict (verdictFromRubric total function, bias-to-reject default)"
    - "Two-pass judge protocol: EXACTLY 2 judgeFn calls (neutral + adversarial); any per-item disagreement routes general_shallow/rubric_disagreement with 'x'-marked pattern"
    - "Prompt hygiene (D2 item 5): prompts built from mechanism + mapping ONLY; never the differential score, band, or provenance (sycophancy channel closed)"
    - "Calibration-derived coarse confidence: bands from measured gold buckets (>=0.9 high / >=0.7 medium / else low); unseen pattern -> unknown -> human review; never a float, never model self-report"
    - "Calibration-validity guard (Pitfall 8): classifyCandidate compares live encoderProvenance().model against the baseline's stamped embedding_model before trusting any bucket; deferred baseline -> unknown"
    - "Injected-seam testing continued: stub judgeFn + stub encodeFn exercise every Stage B path with zero model load and zero network"

key-files:
  created:
    - "evals/eureka/212-critic-baseline.json"
    - "tests/test-212-critic-rubric.cjs"
    - "tests/test-212-negative-corpus.cjs"
  modified:
    - "lib/core/eureka-critic.cjs"

key-decisions:
  - "verdictFromRubric is the exact Pattern-2 mapping (!f||!c -> pseudoscience; !e -> restatement; !d -> general_shallow; a&&b&&c -> transferable; else general_shallow), accepting 1/0 or true/false via truthiness"
  - "The 'xxxxxx' all-x sentinel means Stage A short-circuited (rubric never ran); criticRule certifies confidence 'high' (programmatic gates are code-certain) but returns the conservative reject since the specific gate verdict lives in the local classifyCandidate result, not the 8-key wire payload"
  - "surprise_type closed enum (structural_transfer | semantic_implementation) lives in eureka-critic.cjs, not the tags file, because it is a D1 wire-contract enum not a reasoning tag"
  - "The baseline ships in status baseline_deferred with empty buckets (211 honest-deferral precedent); while deferred every pattern is unseen -> criticRule returns confidence 'unknown', and classifyCandidate's guard yields 'unknown' regardless of embedder match"

patterns-established:
  - "Pattern 3: reasoningTagFromItems mirrors verdictFromRubric's priority order so a closed-enum one-line WHY accompanies every verdict with zero free text crossing a boundary"
  - "Pattern 4: the crafted noun-stripping stub encoder (drops length>=4 tokens before hashing) makes the domain-swap-invariant failure mechanical in tests, so 'tahini x blockchain' collapses to shift 0 deterministically"

requirements-completed: [212-D2, 212-D3, 212-D6]

# Metrics
duration: 8min
completed: 2026-07-10
---

# Phase 212 Plan 02: Eureka Grounding Guard Stage B Rubric + Calibration Ruling + D6 Acceptance Summary

**The complete local two-stage critic: a 6-item binary rubric judged in exactly two passes (neutral + adversarial) with the verdict computed BY CODE, a composed Stage A -> Stage B -> confidence pipeline, a pure payload-only `criticRule` the Phase-03 MCP tool will wrap unmodified, and the D6 negative corpus pinned as an automated shipping bar so the three recorded junk outputs (tahini x blockchain, wind turbines living weather, Molecular Casino $2-5B) can never be blessed.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-10T06:13:13Z
- **Completed:** 2026-07-10T06:21:00Z
- **Tasks:** 3 (Tasks 1-2 TDD: RED + GREEN each; Task 3 acceptance test)
- **Files:** 3 created, 1 modified

## Accomplishments
- Appended Stage B to the SAME portable module `lib/core/eureka-critic.cjs` (no Stage A duplication): `RUBRIC_ITEMS`, `runRubric`, `verdictFromRubric`, `classifyCandidate`, `criticRule`.
- `RUBRIC_ITEMS` are 6 expert-grounded binary items (a-f), frozen, each wording traceable to a SEED-050 documented failure mode (noun-swap filler, structure-mapping orphans, falsifiability, novelty-over-graph-edge, restatement, unsourced quantities) - not model-invented.
- `verdictFromRubric` is the pure Pattern-2 total function; the LLM never picks the class. `runRubric` runs EXACTLY two judge passes and routes ANY per-item disagreement to general_shallow / rubric_disagreement with an 'x'-marked pattern (D2 item 3). Prompts carry mechanism + mapping only - Test 5 asserts the differential digits, band, and provenance are absent (D2 item 5).
- `classifyCandidate` composes the pipeline with a Stage-A short-circuit ('xxxxxx' sentinel, judge never reached) and a Pitfall-8 calibration-validity guard that compares the live embedder against the baseline's stamped model before trusting any bucket.
- `criticRule` is the pure, payload-only ruling (D4): closed-key discipline (TypeError on unknown keys or off-enum strings), coarse confidence banded from measured gold buckets (never a float, D3b item 3), unseen pattern -> unknown/calibration_unknown (human review, D2 item 4), schema_version mismatch -> unknown (Canon Part 9).
- `evals/eureka/212-critic-baseline.json` minted in the honest `baseline_deferred` state, stamped `embedding_model: MongoDB/mdbr-leaf-ir` per the Q4 lock so a future embedder swap invalidates the calibration cleanly.
- The D6 negative corpus is an automated acceptance test: all three recorded junk outputs route into {pseudoscience, general_shallow}, exit non-zero on any transferable/restatement blessing.

## Task Commits

Each task committed atomically (TDD test -> feat for Tasks 1-2):

1. **Task 1 (RED): failing Stage B rubric suite (Tests 1-6)** - `2b8438d9` (test)
2. **Task 1 (GREEN): RUBRIC_ITEMS + runRubric + verdictFromRubric + classifyCandidate** - `3e333db0` (feat)
3. **Task 2 (RED): failing criticRule suite (Tests 7-10) + deferred baseline** - `260b62eb` (test)
4. **Task 2 (GREEN): criticRule calibration ruling + calibration-validity guard** - `ce66260e` (feat)
5. **Task 3: D6 negative-corpus acceptance suite** - `98f62c7b` (test)

_No refactor commits needed (both TDD implementations were clean on first green)._

## Files Created/Modified
- `lib/core/eureka-critic.cjs` (modified) - Stage B appended: rubric items, two-pass runRubric, verdict-by-code, composed classifyCandidate, pure criticRule; module.exports extended.
- `evals/eureka/212-critic-baseline.json` (created) - calibration bucket store, baseline_deferred, mdbr-leaf-ir stamped.
- `tests/test-212-critic-rubric.cjs` (created) - 10 offline behaviors (stub judgeFn + stub encodeFn, no model, no network).
- `tests/test-212-negative-corpus.cjs` (created) - the D6 shipping bar: 3 named junk candidates rejected.

## Decisions Made
- The all-'x' `xxxxxx` sentinel (Stage A short-circuit) returns confidence 'high' by construction in criticRule (a programmatic gate is code-certain, not judge-estimated). The specific gate verdict/reasoning_tag is authoritative in the local `classifyCandidate` result (`a.route` / `a.tag`); it is deliberately NOT recoverable from the abstracted 8-key wire payload, so criticRule returns the conservative `general_shallow` there.
- `surprise_type`'s closed enum lives in the critic module (a D1 wire-contract enum), keeping the tags file focused on reasoning tags and domain tags.
- The baseline stays `baseline_deferred` with empty buckets until Plan 212-05's human checkpoint hand-labels the 6 gold cards; while deferred, every confidence is 'unknown' (honest deferral, never fabricated accuracy).

## Deviations from Plan

None - plan executed exactly as written. One acceptance grep (`grep -c "roomDir"` = 0, the D5 portability check) initially tripped because a new criticRule header comment used the literal token `roomDir`; the comment was reworded to "room-directory closure" (the same block-comment-not-grep-aware correction plan 01 recorded), a wording change inside the same task, not a code-behavior change. Not a deviation-rule invocation.

## Issues Encountered
- The Test 9 static portability grep is not block-comment-aware, so a documentation comment naming the very token it forbids (`roomDir`) tripped it. Reworded to describe the constraint without spelling the literal token; the grep now returns 0.

## User Setup Required
None - no external service configuration. Zero new packages (Part 7 reuse only; the 212-RESEARCH audit table stands).

## Next Phase Readiness
- The local two-stage critic is complete: Stage A gates (212-01) + Stage B rubric + verdict-by-code + calibration confidence. `criticRule` is the single pure, payload-only function Plan 212-03 wraps as a thin MCP tool WITHOUT modification (D4 lift boundary held; no MCP-framework imports, no room-directory coupling - both grep-asserted).
- The baseline is a real file in its deferred state, ready for Plan 212-05 to populate buckets at the navigator >=0.85 human-verify checkpoint.
- No files under `lib/core/eureka/` or `lib/mcp/` were touched; `vector-store.cjs` and `tool-router.cjs` untouched (boundary held).

## Self-Check: PASSED

- All 3 created files + the 1 modified file exist on disk.
- All 5 task commits (`2b8438d9`, `3e333db0`, `260b62eb`, `ce66260e`, `98f62c7b`) exist in git history.
- `node tests/test-212-critic-rubric.cjs` = 10 passed; `node tests/test-212-negative-corpus.cjs` = 3 passed; `node tests/test-212-critic-stage-a.cjs` = 7 passed (no Stage A regression); `bash tests/run-all-211.sh` = PASS=10 FAIL=0 SKIP=0 (no regression).

---
*Phase: 212-eureka-substrate-grounding-guard*
*Completed: 2026-07-10*
