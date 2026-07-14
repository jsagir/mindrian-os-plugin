---
quick: 260714-hzx
subsystem: eureka-entity-extraction
tags: [tier-2, what-why-classifier, framework-terms, live-verification, ranking-regression, honest-degrade]
provides:
  - lib/core/eureka/entity-classifier.cjs (tier-2b WHAT/WHY/NOISE LLM classifier, escalation-only after k44)
  - frameworkTerms bucket in entity-extractor.cjs (WHY-signal split from NOISE_TERMS)
  - tier-2 second pass wired into scripts/entity-extract.cjs runExtraction
  - live re-verification of the two-tier pipeline against aion-eureka-synergy
key-files:
  created:
    - lib/core/eureka/entity-classifier.cjs
    - tests/test-218-what-why-classifier.cjs
  modified:
    - lib/core/eureka/entity-extractor.cjs
    - scripts/entity-extract.cjs
    - tests/run-all-218.sh
    - .planning/phases/218-entity-extraction-pipeline-eureka-entity-extraction-extract-/218-VERIFICATION.md
commits:
  - 85709ba6 feat(quick-260714-hzx): tier-1 frameworkTerms bucket + tier-2 WHAT/WHY classifier module
  - 3922bc53 feat(quick-260714-hzx): wire tier-2 as the dispatcher second pass + suite integration
decisions:
  - "The three residual-noise terms (Larry, Governing Thought, Pyramid Logic) resolve WHY via the free embedding tier at zero API spend -- the original 'assert classifier_source=model' acceptance is superseded by the k44 two-tier redesign"
  - "Tier-2 causes the 912139c9 0.0% structural-share result to regress to 72.0% by starving the entity cohort; escalated to navigator as a ranking-layer decision, NOT auto-patched"
completed: 2026-07-15
---

# Quick 260714-hzx: Tier-2 WHAT-vs-WHY classifier + live verification Summary

Tier-2 semantic classification over the Phase 218 tier-1 survivors: methodology vocabulary (WHY) is captured as `framework_terms` on its source artifact instead of being minted as false company/market entity nodes, closing the `Larry` / `Governing Thought` / `Pyramid Logic` residual noise logged in 218-VERIFICATION.md. Tasks 1-2 shipped the classifier and dispatcher wiring; Task 3 live-verified the two-tier pipeline (redesigned by quick 260714-k44) against the real `aion-eureka-synergy` room under the k44-corrected acceptance criteria.

## What shipped (Tasks 1-2, previously committed)

- **`lib/core/eureka/entity-classifier.cjs`** (commit 85709ba6): tier-2 WHAT/WHY/NOISE classifier with a documented LOCAL-Anthropic-transport model boundary, strict-JSON parse, degrade-to-passthrough fallback (never throws), and a `_test.setFetch` seam. After the k44 redesign this module is the escalation-only tier-2b path.
- **`entity-extractor.cjs`** frameworkTerms bucket (commit 85709ba6): `NOISE_TERMS` split into `FRAMEWORK_TERMS` (methodology vocabulary, emitted additively as `frameworkTerms`) vs true common-word `NOISE_TERMS` (still silently dropped). Tier-1 stays zero-egress, grep-gated.
- **`scripts/entity-extract.cjs` runExtraction** tier-2 second pass (commit 3922bc53): model calls complete before the D-05 transaction opens; WHAT flows through the unchanged typed-entity write path; WHY merges as two scalar props (`framework_terms` + `framework_term_count`) inside the transaction; `status.json` gains the tier-2 counts.
- **Tests + suite** (commit 3922bc53): `tests/test-218-what-why-classifier.cjs` wired into `run-all-218.sh`; full suite green offline.

## Task 3: live re-verification (2026-07-15, corrected criteria)

Verified against the k44-corrected criteria, not the original single-LLM criteria (which assumed `classifier_source: model` and a funded key). Full record: 218-VERIFICATION.md tier-2 appendix. Run discipline: two backups taken (`room.db.bak-hzx-task3-001024` pre-wipe, `room.db.tier2-verified` post-run); 285 prior `entity:entity-extract:*` nodes + 553 edges wiped in a transaction on the backed-up db; typed `governing_thought`/`memory_artifact` nodes left untouched; `entity-extract run` re-executed live.

**status.json:** `artifacts 65, entities 35, terms_why 688, classifier_source embedding, framework_applied 35, tier2_embedding 399, tier2_escalated 206, tier2_model 0, tier2_low_confidence 206`.

### (a) Three residual terms reroute WHY for free -- PASS, zero API spend

`Larry` / `Governing Thought` / `Pyramid Logic`: **0 entity nodes** (was 3 `company` nodes), all three in `framework_terms` (each across 9 artifacts), `classifier_source: embedding`, `tier2_model: 0`. Resolved entirely by the free local embedding tier-2a -- as reference-set members they score cosine 1.0 against themselves and clear any margin, so no funded key is needed. `company` nodes fell 309 -> 46; 688 WHY terms captured as framework signal, never minted as entities and never silently discarded; `AION Labs` survives as a real entity.

### (b) framework_terms capture PASS; 0.0% structural share REGRESSED to 72.0%

- **framework_terms capture: PASS** (35 artifacts, `framework_applied: 35`, `framework_skipped: 0`, `review_status` untouched).
- **Top-25 structural share: 0.0% -> 72.0% (18/25 memory_artifact-vs-memory_artifact).** The 912139c9 ranking-fix result does NOT hold on the tier-2 substrate.

Isolation test (same room, same code, substrate-only difference):

| Substrate | company nodes | entity edges | framework_terms | Top-25 structural share |
|-----------|--------------|-------------|-----------------|-------------------------|
| Pre-wipe backup | 309 | 553 | 0 | **0.0% (0/25)** |
| Post tier-2 | 46 | 35 | 688 / 35 artifacts | **72.0% (18/25)** |

**Root cause (traced):** top-25 tier-2 pairs show `strategic_fit` flat at 0.25 and `validated_demand` at 0.97-0.99 -- the edge-count dimension is the discriminator. Tier-2 correctly removes 688 methodology terms from the entity population, collapsing the entity cohort from ~285 dense nodes / 553 edges to 46 sparse nodes / 35 edges, while the 39-node `memory_artifact` CONVERGES clique stays dense. The cohort-stratification fix equalizes the validated_demand ceiling between families but cannot suppress the denser family; with the entity family starved, scaffold pairs refill the top-25. This is edge-starvation of the entity cohort, NOT embedding contamination from the framework_terms merge (that would move `strategic_fit`, which stays flat).

### (c) Tier-2b escalation -- honest zero-credit degrade confirmed (non-blocking)

The key resolves but the account is at zero credits (direct probe: `HTTP 400 "Your credit balance is too low"`). The degrade contract held observably: `tier2_escalated: 206` attempted, all failed the `source === 'model'` gate, all fell to embedding best-guess as `tier2_low_confidence: 206` (= escalated), `tier2_model: 0`, `classifier_source` stayed `embedding` (never faked). Counts reconcile honestly with the path that ran. A funded-key model-path exercise remains open; per the corrected criteria it is NOT a blocker.

## Deviations from Plan

**1. [Corrected scope] Task 3 acceptance re-scoped per quick 260714-k44**
- The original Task 3 asserted `classifier_source: 'model'` (a single LLM over every artifact, funded key required). Quick 260714-k44 redesigned tier-2 into a two-tier flow (free embedding tier-2a + escalation-only LLM tier-2b), which makes the core reroute key-less. Verified against k44's corrected (a)/(b)/(c) criteria instead of the original literal text, as directed.

**2. [STOP-and-report finding] The 912139c9 0.0% structural share does not survive tier-2**
- **Found during:** Task 3 step (3), the eureka structural-share re-check.
- **Issue:** top-25 structural share regressed 0.0% -> 72.0% on the tier-2 substrate; isolation test proves tier-2 is the cause, not room drift or verification procedure.
- **Root cause:** WHY-term removal starves the entity cohort; the scaffold clique refills the top-25 via the `validated_demand` dimension (see above).
- **Action:** NOT auto-patched. This is a ranking-layer architectural question (should eureka exclude or down-weight `memory_artifact`-vs-`memory_artifact` pairs, which are substrate and never real opportunities, so the top-25 reflects real entity pairs regardless of entity-cohort density?). Escalated to the navigator per the task's STOP-and-report constraint. No shipped code changed during Task 3.

## Recommendation (for the navigator)

The clean fix is at the ranking layer, not extraction: exclude (or heavily down-weight) `memory_artifact`-vs-`memory_artifact` pairs from the eureka ranked-pair candidate set. Scaffold pairs are substrate, never real cross-domain opportunities, so the structural-share metric would return to ~0% by construction regardless of how sparse the real-entity cohort is. That is a one-place change in the pair-candidate filter in `scripts/eureka-portfolio-report.cjs` / `room-native-substrate.cjs`, isolatable from the tier-2 extraction work, and worth a small dedicated quick task with its own live re-verification. The alternative reading -- that aion-eureka-synergy simply has a thin real-entity substrate (it narrates MindrianOS's own process) -- is also true, but the ranking-layer filter fixes the metric either way.

## Verification

- `bash tests/run-all-218.sh`: Phase 218 PASS=15 FAIL=0, Phase 211 PASS=10 FAIL=0, offline.
- 218-VERIFICATION.md tier-2 appendix written with this run's real numbers; contains `tier-2` and `rethinking-mindrianos` (Task 3 automated verify gate).
- rethinking-mindrianos research entry updated with the live numbers and the regression finding; byte-identical mirror synced to `~/MindrianOS/research/` (cmp: IDENTICAL). Both cross-reference this plan and the 218-VERIFICATION.md appendix.
- Room restored to the verified tier-2 state (`room.db.tier2-verified`); portfolio report regenerated to match (72.0% reproduced).

## Self-Check: PASSED

- `lib/core/eureka/entity-classifier.cjs`: FOUND
- `tests/test-218-what-why-classifier.cjs`: FOUND
- 218-VERIFICATION.md tier-2 appendix: FOUND
- Commit `85709ba6`: FOUND
- Commit `3922bc53`: FOUND
- rethinking-mindrianos research addendum (both homes, byte-identical): FOUND
