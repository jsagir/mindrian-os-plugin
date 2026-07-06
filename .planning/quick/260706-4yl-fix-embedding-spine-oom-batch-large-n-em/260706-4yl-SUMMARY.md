---
phase: quick-260706-4yl
plan: 01
subsystem: eureka / embedding-spine
tags: [oom, embedding, batching, canon-part-8, tier-0]
requires: [lib/core/eureka/embedding-spine.cjs]
provides:
  - "batched embedTexts real-model path (bounded per-pass memory for large-N rooms)"
  - "resolveBatchSize() env resolver (MINDRIAN_EMBED_BATCH, default 32)"
  - "batchSlices(list, size) pure helper (order-preserving, testable seam)"
affects:
  - "any embedTexts consumer (tri-modal-index.cjs) - transparent, no call-site change"
tech-stack:
  added: []
  patterns:
    - "env resolver mirrors resolveDim positive-int validation shape"
    - "whole-call never-throws envelope preserved across the batch loop"
key-files:
  created:
    - tests/test-211-embed-batching.cjs
  modified:
    - lib/core/eureka/embedding-spine.cjs
    - tests/run-all-211.sh
decisions:
  - "Batch INSIDE embedTexts real-model path only; encodeFn seam stays unbatched passthrough"
  - "DEFAULT_BATCH = 32 bounds the padded activation per forward pass"
  - "Any per-batch failure fails the WHOLE call (no partial vectors)"
metrics:
  duration: ~20m
  completed: 2026-07-06
  tasks: 2
  files: 3
---

# Phase quick-260706-4yl Plan 01: Embedding-Spine OOM Batching Summary

Batched the real-model path of `embedTexts()` so large-N rooms (thousands of claim nodes) embed in bounded memory, closing the single-forward-pass OOM that padded 2117 texts to `[2128, 512]` and triggered a ~26.7GB ONNX Expand allocation.

## What Was Built

**Root cause (verified):** `embedding-spine.cjs` `embedTexts()` handed the ENTIRE `texts` array to `enc.encoder(list, {...})` in ONE forward pass. On the real jhtv-oliver-kuntz room (2117 claim nodes) the tokenizer padded to `[2128, 512]` input_ids and the ONNX runtime attempted a ~26.7GB allocation in a single Expand node - an out-of-memory crash.

**Fix (Task 1, `embedding-spine.cjs`):**
- `DEFAULT_BATCH = 32` constant, commented with the OOM root cause it bounds.
- `resolveBatchSize()` env resolver reading `MINDRIAN_EMBED_BATCH` at call time, validated positive int, default 32 (mirrors the `resolveDim` validation shape exactly).
- `batchSlices(list, size)` pure helper: consecutive order-preserving `list.slice(i, i+size)` chunks; empty list returns `[]`.
- `embedTexts` real-model path now loops `enc.encoder` over `batchSlices(list, resolveBatchSize())`, converting each batch with `toVectors(output, slice.length)` and concatenating in order. The whole loop stays INSIDE the existing try/catch, so the never-throws whole-call envelope holds: any per-batch conversion-null or thrown error fails the WHOLE call with one `embed_failed` envelope (no partial vectors). An empty input list yields zero encoder calls and `{success:true, vectors:[]}`.
- `_test` exports: `resolveBatchSize`, `batchSlices`, `DEFAULT_BATCH`.
- Header interface contract + Env tunables block document the batching and `MINDRIAN_EMBED_BATCH`.
- UNTOUCHED: the `opts.encodeFn` injection seam (still an unbatched single-call passthrough), `_forceUnavailable`, `getEncoder`.

**Test (Task 2):**
- `tests/test-211-embed-batching.cjs` (offline, never requires @huggingface/transformers): batchSlices order/edge cases (`[32,32,6]` for 70@32, empty -> `[]`, short -> one slice), resolveBatchSize env fallback (unset -> 32 === DEFAULT_BATCH, `'8'` -> 8, `'0'`/`'-5'`/`'abc'`/`''` -> 32), and the encodeFn seam proven UNBATCHED (with `MINDRIAN_EMBED_BATCH='4'` set, 70 texts reach the stub in exactly ONE call).
- `tests/run-all-211.sh`: appended leg (9) after leg (8); existing legs unreordered (9 leg invocations total).

## Verification

- `node tests/test-211-embedding-spine.cjs` -> `5 passed`, exit 0 (existing 211-01 contract byte-identical: encodeFn passthrough, provenance, _forceUnavailable degrade, cosine reuse, no re-normalization).
- `node tests/test-211-embed-batching.cjs` -> `3 passed`, exit 0.
- Task 1 verify one-liner prints `batching helpers OK`; all 8 done-gate greps pass (resolveBatchSize/batchSlices present, `enc.encoder(list` GONE, `MINDRIAN_EMBED_BATCH` count >= 2, `_test` export present, no em-dashes).
- `git diff` touches EXACTLY the three planned files.

## Deviations from Plan

None. Plan executed exactly as written. Locked decisions honored: batch inside embedTexts real-model path only, DEFAULT_BATCH = 32, encodeFn seam unbatched passthrough, envelope + provenance shapes unchanged, pure batchSlices extracted for offline testability.

## Deferred Issues (out of scope, NOT fixed)

`bash tests/run-all-211.sh` reports `PASS=8 FAIL=1` on this dev machine. The single FAIL is leg (2) `test-211-tri-modal.cjs` Test 8 (`rerank_unavailable`), which is **pre-existing and unrelated to this fix**:

- Proven pre-existing: reverting `embedding-spine.cjs` to HEAD~1 (before this task) reproduces the identical FAIL.
- Root cause: this environment has `@huggingface/transformers` installed WITH a cached reranker model, so the real-model rerank path in `hybrid-retrieve.cjs` loads and scores successfully instead of degrading to `rerank_unavailable`. The test hard-codes the "dep absent" assumption; in a clean offline CI machine (transformers not installed) it passes.
- Not fixable here: this task touched only `embedding-spine.cjs`; the rerank path calls `loadReranker`, never `embedTexts`. The plan explicitly forbids touching `hybrid-retrieve.cjs` / `tri-modal-index.cjs`.

All legs attributable to this task pass: leg (1) `211-01 embedding spine` PASSED and the new leg (9) `260706-4yl embed batching (OOM guard)` PASSED. Full detail logged to `deferred-items.md` in this phase directory. Recommended follow-up: a separate task to make the tri-modal rerank Test 8 environment-robust (force the unavailable path via a hook, mirroring embedding-spine's `_forceUnavailable` seam).

## Threat Surface

Per the plan's threat register: T-4yl-01 (DoS via single forward pass) is the mitigation THIS fix delivers - bounded per-pass memory via `resolveBatchSize()` slicing closes the ~26.7GB Expand allocation. T-4yl-02 (env tampering) mitigated by positive-int validation with safe default. No new network touch, no new dependency, no new input surface. Canon Part 8 boundary unchanged (zero user-byte egress, local CPU only).

## Self-Check: PASSED

- FOUND: lib/core/eureka/embedding-spine.cjs (modified, committed c222ff7d)
- FOUND: tests/test-211-embed-batching.cjs (created, committed 7ec75b5e)
- FOUND: tests/run-all-211.sh (modified, committed 7ec75b5e)
- FOUND commit c222ff7d (fix: batch embedTexts real-model path)
- FOUND commit 7ec75b5e (test: offline embed-batching guard + leg 9)
