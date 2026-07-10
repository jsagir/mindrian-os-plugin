---
phase: 212-eureka-substrate-grounding-guard
plan: 01
subsystem: eureka
tags: [eureka, critic, part8, mcp, grounding-guard, stage-a, cjs]

# Dependency graph
requires:
  - phase: 211-eureka-generator-mvp
    provides: "scoreMeasured per-pair record + embedding-spine (embedTexts, cosineSimilarity, batchSlices, encoderProvenance) the Stage A gates consume"
provides:
  - "data/eureka-critic-tags.json: closed versioned enum registry (schema_version 1, 4 verdicts, 10 reasoning_tags, generic domain_tags, rubric_pattern_len/version)"
  - "lib/core/eureka-critic.cjs: portable critic core (loadCriticTags, VERDICTS, quantize, assembleCriticPayload, stageA)"
  - "assembleCriticPayload: the single Part 8 wire-shaping choke point (quantized scalars + closed enums only, auditQueryString/auditQueryObject reuse)"
  - "stageA: four deterministic no-LLM gates (fabricated-quantity, domain-swap invariance, novelty delta, entity-specificity) with injected encodeFn/knnFn seams and degrade paths"
  - "Env tunables: EUREKA_SWAP_INVARIANCE_FLOOR, EUREKA_SWAP_K, EUREKA_NN_DELTA_FLOOR, EUREKA_ENTITY_MIN (read at call time)"
affects: [212-02 stage-b-rubric, 212-03 mcp-tool, 212-04 gold-cards, 212-05 calibration, SEED-014 brain-lift]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Portable pure-CJS module boundary: zero MCP-framework imports, zero room-directory coupling (D4/D5, SEED-014 lift boundary is one file)"
    - "Part 8 dual-layer egress at the payload assembly site: auditQueryString on the one passthrough string field + auditQueryObject on the assembled wire object (rs-differential-scorer scoreMeasured precedent, no second auditor)"
    - "Two-stage critic: deterministic gates before any LLM; first-failure-returns fixed gate order; encoder never invoked when gate 1 trips"
    - "Injected-seam testing: stub encodeFn + stub knnFn exercise every path with zero model load and zero network (211 embedding-spine test-seam precedent)"
    - "Call-time env tunables (RS_SEMANTIC_FLOOR precedent) so a gate retunes without a code change"

key-files:
  created:
    - "data/eureka-critic-tags.json"
    - "lib/core/eureka-critic.cjs"
    - "tests/test-212-critic-stage-a.cjs"
  modified: []

key-decisions:
  - "surprise_type is the only passthrough string field on the payload; it is scanned by auditQueryString and the whole payload by auditQueryObject, so a smuggled email/currency/content string throws ExternalEgressViolation"
  - "stageA embeds through spine.embedTexts (not raw encodeFn) so the same call serves both the injected-stub test path and the real batched-model production path, and carries encoder provenance into features (Q4 lock)"
  - "nounSwap always returns a string different from its input (appends a generic noun when nothing matched) so a content-ignoring embedder yields shift 0 deterministically"
  - "domain tag validation throws TypeError (not in closed enum); forbidden-pattern content throws ExternalEgressViolation; both keep content off the wire"

patterns-established:
  - "Pattern 1: assembleCriticPayload is the sole wire-shaping function; every float quantized to 2dp before it can leave the machine (D3b1, T-212-02 mitigation)"
  - "Pattern 2: Stage A degrades (records gate_skipped 'nn_unavailable' / returns calibration_unknown) instead of throwing when the kNN backend or the encoder is unavailable"

requirements-completed: [212-D1, 212-D2, 212-D3B]

# Metrics
duration: 18min
completed: 2026-07-10
---

# Phase 212 Plan 01: Eureka Grounding Guard Contract Layer + Stage A Gates Summary

**Portable pure-CJS critic core with a closed versioned enum registry, a Part 8 quantize-and-audit wire-shaping choke point, and four deterministic no-LLM Stage A gates that route the "$2-5B exit" and "tahini x blockchain" classes to pseudoscience/general_shallow before any model call.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-10T05:45:00Z
- **Completed:** 2026-07-10T06:03:00Z
- **Tasks:** 2 (Task 2 was TDD: RED + GREEN)
- **Files modified:** 3 created

## Accomplishments
- Minted `data/eureka-critic-tags.json`: schema_version 1, exactly four verdicts, a 10-member closed reasoning_tag enum, a generic (never-artifact) domain_tag enum, rubric_pattern_len/rubric_version.
- Built `lib/core/eureka-critic.cjs` as the SEED-014-liftable portable module: zero MCP-framework imports, zero room-directory coupling, both grep-asserted.
- `assembleCriticPayload` is the single choke point that shapes the MCP wire object: every scalar quantized to 2dp, domain tags validated against the closed enum, and the Part 8 egress auditors reused (not re-implemented) so any smuggled content string throws.
- `stageA` implements all four D2-item-1 gates in fixed order with first-failure-returns semantics, injected encodeFn/knnFn seams, and degrade-not-die paths for a missing kNN backend or an unavailable encoder.
- Offline suite `tests/test-212-critic-stage-a.cjs` proves each route (including the encoder-call-count-0 proof and the sourced-quantities escape hatch) with zero model load and zero network; 7/7 pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tags enum + critic contract skeleton** - `cd3db634` (feat)
2. **Task 2 (RED): failing Stage A offline suite** - `609c521b` (test)
3. **Task 2 (GREEN): Stage A deterministic gates** - `4a765c9d` (feat)

**Plan metadata:** (final docs commit)

_TDD task 2 produced test -> feat commits; no refactor commit was needed (implementation was clean on first green)._

## Files Created/Modified
- `data/eureka-critic-tags.json` - Closed versioned enum registry for verdicts, reasoning_tags, domain_tags (schema_version 1).
- `lib/core/eureka-critic.cjs` - Portable critic core: loadCriticTags, VERDICTS, quantize, assembleCriticPayload, stageA, env-tunable resolvers.
- `tests/test-212-critic-stage-a.cjs` - Offline Stage A unit suite (7 behaviors, stub encodeFn + stub knnFn, no model, no network).

## Decisions Made
- Embed through `spine.embedTexts` rather than calling the raw injected encodeFn, so one code path serves both the offline test seam (provenance.model 'stub') and the real batched-model production path, and encoder provenance rides into `features.embedder` (Q4 embedder-swap detectability).
- Keep `surprise_type` an enum passthrough but scan it with `auditQueryString` and the whole assembled payload with `auditQueryObject`; a smuggled email/currency/content string throws `ExternalEgressViolation` even though only whitelisted keys reach the payload by construction.
- `nounSwap` guarantees a string different from its input so a content-ignoring embedder deterministically yields shift 0 (the domain-swap-invariant signature), while a real embedder yields a large shift.

## Deviations from Plan

None - plan executed exactly as written. Two acceptance greps initially failed because explanatory block comments contained the literal forbidden tokens (`tool-router`, `server.tool`, `roomDir`); this was a wording correction inside the same task (comments reworded to "MCP-framework imports of any kind" / "room-directory"), not a code-behavior change, and was resolved before the Task 1 commit. Not a deviation rule invocation.

## Issues Encountered
- The Task 1 portability greps (`grep -c "modelcontextprotocol\|server\.tool\|tool-router"` and the non-comment `roomDir` scan) are not block-comment-aware, so documentation prose naming the very tokens it forbids tripped them. Reworded the header/loader comments to describe the constraint without spelling the literal tokens. Both greps now return 0.

## User Setup Required
None - no external service configuration required. Zero new packages (Part 7 reuse only, per the 212-RESEARCH Package Legitimacy Audit).

## Next Phase Readiness
- Stage A is the complete D2-item-1 gate set with injected seams and degrade paths; `assembleCriticPayload` is the single Part 8-audited wire-shaping function ready for the 212-03 MCP wrapper.
- 212-02 appends Stage B (RUBRIC_ITEMS, runRubric, verdictFromRubric, classifyCandidate, criticRule) and the D6 negative-corpus acceptance test to the same module.
- No files under `lib/core/eureka/` or `lib/mcp/` were touched (success criterion held). `vector-store.cjs` untouched; the kNN seam is injected-only and degrades when absent.

## Self-Check: PASSED

- All three created files exist on disk.
- All three task commits (`cd3db634`, `609c521b`, `4a765c9d`) exist in git history.
- `node tests/test-212-critic-stage-a.cjs` exits 0 (7 passed); `run-all-211.sh` PASS=10 FAIL=0 SKIP=0 (no regression).

---
*Phase: 212-eureka-substrate-grounding-guard*
*Completed: 2026-07-10*
