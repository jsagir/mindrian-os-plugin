# Phase 131 - Re-baseline Review (4.7 -> 4.8) + forward-prep for 134 / 136

**Reviewed:** 2026-06-01
**Method:** 6-lens re-examination (intent / 4.7-to-4.8 / couple-134 / couple-136 / canon-reuse / scope-risk). The parallel agent fan-out was rate-limited server-side; this synthesis was completed directly with Tavily validation of the load-bearing technical claims.
**Phase under review:** 131 - Research as a Graph-Aware Workflow Step (source-lens pilot), scoped 2026-05-16 under Claude 4.7.

---

## 1. Verdict

**refine-then-plan.** The intent is sound and still correct: turn `/mos:research` from a prose command into the canonical, context-aware, graph-writing workflow step, proven as the source-lens pilot. Two refinements are load-bearing before plan-phase: (a) resolve the shared corpus/cache/embedding surface it collides with Phase 134, and (b) lock the EvidenceClaim + cascade-edge + F.1-selector contracts so Phase 136 renders them without rework.

---

## 2. The 4.7 -> 4.8 re-baseline

- **Open decision 1 (auto-dispatch threshold) was 4.7-conservative.** The CONTEXT recommends "always ask the user via F.1 before running research." Under 4.8 + the GUIDED-default canon, the better shape is not "always ask" but "ask with a confident, pre-computed single recommendation" - 4.8 can judge the evidence gap and pre-fill the F.1 selector (still human-confirm per Part 9, but not a generic prompt). Keep the human gate; raise the quality of what is offered.
- **Stages 2 + 3 can collapse.** The Stage-2 context summary and Stage-3 lens-set computation were split because a 4.7 pass reasoned about them separately. 4.8 can produce the context summary AND the weighted lens set in one reasoning pass. Recommend merging into a single "pre-flight + plan" stage (8 stages -> 7).
- **Stage 1's 8 discrete pre-flight reads should be ONE batched navigation.cjs neighborhood call,** not 8 sequential reads. 4.8 holds the whole neighborhood in context; the chokepoint should expose a single `getResearchPreflight(roomDir, focus)` that returns all 8 inputs in one round-trip. (Also a performance + Part 9 win.)
- **Dedup (Stage 1 input 7 + Pinecone) can be more aggressive.** 4.8 can reason over a larger candidate set, so raise the dedup recall rather than the 4.7-era "top-k prior claims" cap.

---

## 3. Forward-prep for Phase 134 (the highest-leverage coupling)

**This is the most important finding in the review.** 131 and 134 touch the SAME surface and will build it twice unless coordinated.

- **The corpus/fetcher collision.** 131 proposes `lib/core/research-cache.cjs` + source-lens fetchers over OpenAlex / arXiv / Tavily, and explicitly aims to close the rs-discovery-engine duplicate-fetcher drift. Phase 134 then ports `lib/core/rs_corpus.py` (the OpenAlex/arXiv fetcher) to CJS. If 131 builds CJS fetchers + cache now and 134 re-ports the Python corpus later, the fetcher is built twice and the dedup goal is missed again. **Fix: 131 builds the shared fetcher + cache as the CJS-native module, and 134 REUSES it (deletes the Python corpus) rather than re-porting.** Equivalently: extract a tiny shared "corpus-cache" unit that 131, 134, and rs-discovery-engine all consume (see the coherence note in 132-REVIEW-4.8 section 6).
- **The HSI-scoring dependency.** Stage 4 says "each finding HSI-scored." Today HSI is Python (`scripts/hsi-*.py`) - the exact install-fragility class 134 exists to kill (Aryeh's Windows `ModuleNotFoundError`, 2026-05-23). **131 must NOT add a new Python-dependent code path on the user machine.** Either (a) gate 131 behind the 134 CJS HSI port, or (b) make 131's finding-scoring use a CJS-native scorer / defer HSI-scoring of findings to the v1.14.0 fan-out. Do not ship 131 with a Python hard-dependency.
- **Package-name correction (validated).** Any embedding/transformers reference must use **`@huggingface/transformers`** (Transformers.js v3+, official Hugging Face npm org), NOT `@xenova/transformers` (v1/v2, now effectively deprecated). Source: huggingface.co/blog/transformersjs-v3 ("published under the official Hugging Face organization on NPM as `@huggingface/transformers` instead of `@xenova/transformers`"); deprecation thread github.com/huggingface/transformers.js/issues/1484. Node.js CJS + ESM are supported, so the no-build CJS rule holds. The ONNX runtime is a ~200MB optional dependency and model weights download on first use (cold-start ~10-15s) - if 131 ever loads an in-process embedder, it inherits this UX cost; prefer to let 134 own the embedding surface.

---

## 4. Forward-prep for Phase 136 (render spine, soft-dep)

Alignment is strong; the job is to LOCK the contracts now so 136 renders them clean.

- **EvidenceClaim node shape.** 131 writes `EvidenceClaim` nodes with `review_status: proposed` + provenance (URL, timestamp, evidence_tier). 136's detail pane (the dual-render surface) and the `getConfirmedFacts` contract render exactly these fields. Lock the node property schema in 131 so 136 maps it without a migration.
- **Cascade-edge predicates.** 131 writes INFORMS / CONTRADICTS / SUPERSEDES / REJECTED_BECAUSE. 136 renders CONTRADICTS as BOTH a graph edge and a natural-language sentence (D-06 dual render) and surfaces cross-wall edges in the LazyGraph slot. Confirm 131's edge types are the same allow-listed `ALLOWED_EDGE_TYPES` members 136 reads (INFORMS + REJECTED_BECAUSE already shipped via 130-01; CONTRADICTS/SUPERSEDES must be present or added additively, not invented per-phase).
- **The F.1 filing selector IS the gate-as-write-node.** 131's Stage-6 F.1 selector and 136's D-13 gate widget are the same Part 3 primitive. 131 must mirror `lib/hmi/selector-dispatcher.cjs` (do not build a bespoke research selector), so 136's richer multi-select widget is a strict superset of 131's inline gate. This makes 131's "file finding" and 136's "commit decision" the same write path.

---

## 5. Canon + reuse corrections (Part 7 / 8 / 9; on shipped 130)

- **Reuse of 130 is correct.** 131's `source-lens-driver.cjs` activating the lens-engine's reserved `source` family slot is the intended extension (130 reserved source/domain/framework/trend for v1.14.0). Confirm the driver uses the shipped `rotate()` signature and the caller-owned db-handle idiom.
- **Part 9 chokepoint.** `findings-wirer.cjs` and `research-context-extractor.cjs` must route every room.db touch through navigation.cjs (they are not substrate-allow-listed). Verify with `check-substrate.cjs` at plan-time.
- **Part 8 pre-egress audit.** The Stage-4 "no user content in query strings" audit is the correct boundary control; make it a hard gate, not advisory.
- **depends_on accuracy.** The CONTEXT lists Phase 127/128/129/130 as deps - all now shipped. Accurate. (Phase 130 COMPLETE per STATE.md 2026-05-31.)

---

## 6. Scope / reverse-salient / sequencing

- **Reverse salient:** the shared-cache dedup against `rs-discovery-engine` - it is both the riskiest integration and the exact 134 collision point. De-risk it by making the cache a shared module (section 3) rather than a 131-private one.
- **Scope:** 8-stage pipeline (collapsible to 7) + 3 core libs + CI guard + 5 E2E in 5-7 days is achievable IF the corpus/HSI coupling is resolved up front. If not, the Python-dependency risk balloons execution.
- **Sequencing:** 131 should consume Phase 132's `correlation_id` so its INFORMS/CONTRADICTS edges land on canonical targets, not cross-label duplicates. This argues for pulling 132-01 (correlation_id contract) EARLIER - see coherence note. If correlation_id is not available at 131 ship-time, 131's edges fork across the duplicates 132 later has to clean up.

---

## 7. Proposed CONTEXT.md changes

| Target | Change | Priority |
|--------|--------|----------|
| Concrete deliverable 1 (research-cache) | Re-scope `research-cache.cjs` + the source-lens fetchers as the CJS-native shared corpus module that Phase 134 REUSES (and that retires rs_corpus.py + the rs-discovery-engine duplicate). Add an explicit "134 reuses this, does not re-port" note. | must |
| Stage 4 (HSI-scoring) | Add a constraint: 131 introduces NO new Python hard-dependency on the user machine. Gate finding-HSI behind the 134 CJS port OR use a CJS scorer OR defer. | must |
| New "Forward contracts" section | Lock the EvidenceClaim node property schema + the cascade-edge predicate set + the F.1-selector-equals-gate-widget contract, marked "consumed by Phase 136". | must |
| Stages 2+3 | Merge into one pre-flight+plan stage (8 -> 7); note 4.8 reasons about context summary + lens set together. | should |
| Stage 1 | Replace the 8 sequential reads with one batched `getResearchPreflight` navigation.cjs call. | should |
| Open decision 1 | Re-resolve: not "always ask" but "ask with a pre-computed confident recommendation in the F.1 selector" (4.8 + GUIDED canon). | should |
| Any embedding ref | Use `@huggingface/transformers`, never `@xenova/transformers`. | nice |

---

## 8. Decisions that need Jonathan

1. **Corpus-cache ownership:** extract a tiny shared pre-phase (e.g. "133.5 corpus-cache") that 131 / 132 / 134 all consume, OR have 131 build it and 134 reuse? (Recommend: extract, so 134 has no re-port and the dedup lands once.)
2. **HSI-scoring in 131:** gate behind the 134 CJS port, use a CJS scorer now, or defer finding-scoring to the v1.14.0 fan-out?
3. **Sequencing:** accept pulling 132-01 (correlation_id) to before/with 131 so 131's edges land canonical?

---

## 9. Sources (Tavily-validated)

- Transformers.js v3 rename to `@huggingface/transformers`: https://huggingface.co/blog/transformersjs-v3
- `@xenova/transformers` deprecation question: https://github.com/huggingface/transformers.js/issues/1484
- Node.js (CJS+ESM) support + ~200MB ONNX optional dep + first-use model download + cold-start: https://www.promptfoo.dev/docs/providers/transformers , https://www.sitepoint.com/optimizing-transformers-js-production
- multilingual-e5-large ONNX (1024-dim): https://huggingface.co/Qdrant/multilingual-e5-large-onnx
- ModelRegistry API for pre-checking download size / cache status (relevant to 134 UX): https://github.com/xenova/transformers.js/releases
