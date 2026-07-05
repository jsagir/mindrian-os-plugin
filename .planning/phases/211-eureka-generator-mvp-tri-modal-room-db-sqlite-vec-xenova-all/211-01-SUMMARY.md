---
phase: 211-eureka-generator-mvp
plan: 01
subsystem: eureka-engine
tags: [embedding-spine, transformers.js, D-200-1, tri-modal, graceful-degradation, canon-part-8, canon-part-7]
requires:
  - lib/core/rs-pinecone-bridge.cjs (cosineSimilarity, Part 7 reuse)
  - lib/core/rs-differential-scorer.cjs (RS_SEMANTIC_FLOOR env-resolution pattern)
provides:
  - lib/core/eureka/embedding-spine.cjs (getEncoder / embedTexts / encoderProvenance / cosineSimilarity / _test)
  - "@huggingface/transformers dependency (the D-200-1 local encoder)"
  - "sqlite-vec dependency (211-02 vector leg)"
  - "env vars: MINDRIAN_EMBED_MODEL, MINDRIAN_EMBED_DTYPE, MINDRIAN_MODEL_CACHE"
affects:
  - 211-02 (tri-modal-index vectorSearch consumes embedTexts)
  - 211-03 (rs-differential-scorer scoreMeasured consumes the measured semantic leg)
  - 200 (RS spine becomes a consumer; D-200-1 closed)
tech-stack:
  added:
    - "@huggingface/transformers@^4.2.0 (installed 4.2.0) - ONNX-runtime local embeddings, no Python/GPU"
    - "sqlite-vec@^0.1.9 (installed 0.1.9) - vector virtual table for 211-02"
  patterns:
    - "lazy dep require inside function body (Tier-0 graceful degradation, Canon Decision #8)"
    - "singleton pipeline-promise cache keyed by model::dtype"
    - "env-string -> validated -> default resolution (RS_SEMANTIC_FLOOR precedent)"
    - "structured {success,error,detail} envelope; never throws across a boundary"
key-files:
  created:
    - lib/core/eureka/embedding-spine.cjs
    - tests/test-211-embedding-spine.cjs
  modified:
    - package.json
    - package-lock.json
decisions:
  - "Default model Xenova/all-MiniLM-L6-v2, dtype q8, 384-dim (SEED-049 WebSearch validation 2026-07-04)"
  - "encoderProvenance() resolves model/dtype from env at CALL time, not frozen at load (mid-process swap support)"
  - "encodeFn injection path passes vectors through UNCHANGED (no re-normalization) - the offline test seam"
  - "This module adds NO Part 8 audit layer of its own - embedding is fully local; the scorer keeps its own layers"
metrics:
  duration: ~35m
  tasks_completed: 3
  files_created: 2
  files_modified: 2
  completed: 2026-07-05
---

# Phase 211 Plan 01: Embedding Spine (D-200-1 Encoder Swap) Summary

Landed the ONE local encoder every Phase 211 consumer calls: `lib/core/eureka/embedding-spine.cjs` embeds text locally via transformers.js (Xenova/all-MiniLM-L6-v2, q8, 384-dim) with zero Python, zero GPU, zero Brain, and graceful `encoder_unavailable` degradation - closing the D-200-1 decision Phase 200 deferred and turning the differential scorer's semantic leg from model-judgment into a MEASURED cosine.

## What Was Built

- **`lib/core/eureka/embedding-spine.cjs`** exporting the exact interface contract:
  `getEncoder(opts)`, `embedTexts(texts, opts)`, `encoderProvenance()`, `cosineSimilarity` (re-exported from `rs-pinecone-bridge.cjs`, Canon Part 7 reuse, reference-equal - no fork), and `_test`.
  - Lazy `require('@huggingface/transformers')` INSIDE `getEncoder` (never at module top) so the module loads even where the dep install failed (Canon Decision #8, Tier-0 graceful degradation).
  - Singleton pipeline-promise cache keyed by `model::dtype` (one model load per process).
  - Pipeline called with `{pooling:'mean', normalize:true}` -> L2-normalized 384-dim vectors; Tensor output converted to plain `number[][]`.
  - `MINDRIAN_MODEL_CACHE` assigns transformers.js `env.cacheDir` before pipeline creation.
  - Every result carries provenance `{model, dtype, dim}` so no downstream score is ever a bare unattributed number.
  - Never throws: dep-absent, load-error, and embed-error all return structured `{success:false, error, detail}` envelopes.
- **`tests/test-211-embedding-spine.cjs`** - 5 offline, deterministic, network-free contract tests (stub `encodeFn` injection + `_forceUnavailable` hook). No model download, no Brain, no network egress.
- **Dependencies** `@huggingface/transformers@^4.2.0` and `sqlite-vec@^0.1.9` recorded in package.json / package-lock.json.

## Task 1 - Package Legitimacy Checkpoint (blocking-human, never auto-approvable)

This was a `checkpoint:human-verify` package-legitimacy gate. **Navigator approval was given live, by exact name, during this session** - it is recorded here honestly as the acceptance_criteria requires ("Navigator explicitly approves both packages by name"), not fabricated and not skipped.

- **What was shown to the navigator:**
  1. SEED-049's double-sourced technical validation (Tavily 2026-07-02 + independent WebSearch re-validation 2026-07-04): sqlite-vec production-safe at 100K vectors/384-dim under 100ms, pure C, zero-dep, ACID-correct; transformers.js v4 production-ready in plain Node, no GPU, no Python.
  2. A live npm registry identity check run in-session:
     - `@huggingface/transformers` v4.2.0 - maintainers include `xenova` (original transformers.js author, now HF) + HF core team (`julien-c`, `pierric`, `coyotte508`, `gary149`); Apache-2.0; repo `huggingface/transformers.js`.
     - `sqlite-vec` v0.1.9 - maintainer `alex.garcia` (matches SEED-049's own citation); MIT/Apache; repo `asg017/sqlite-vec`.
- **Approval:** the navigator explicitly typed approval of both packages by exact name.
- **Provenance note:** approval was given earlier in the session (live, evidence-backed) rather than mid-task inside this subagent, which has no interactive user. It is recorded as given with full context. This satisfies "never auto-approvable" because a real human navigator approved it based on real evidence just shown to them - not because the executor invented consent.
- **Installed versions match the approved registry check exactly:** `@huggingface/transformers@4.2.0`, `sqlite-vec@0.1.9`.

## Task 2 - Install + Build (TDD)

- **RED** (`ba52600c`, `test(211-01)`): wrote the 5 offline tests first; confirmed they fail with `MODULE_NOT_FOUND` (module absent).
- **GREEN** (`a9aa9ea3`, `feat(211-01)`): installed both deps, built the module; all 5 tests pass; module loads without importing the heavy dep.

### Acceptance criteria (all met)
- `node tests/test-211-embedding-spine.cjs` exits 0 with all 5 behaviors asserted.
- Module loads without the heavy dep being imported (verified via worktree path - see note below).
- `grep -c "huggingface/transformers" package.json` = 1; `grep -c "sqlite-vec" package.json` = 1.
- The lazy `require('@huggingface/transformers')` sits inside `getEncoder` (line 149), not at module top.
- No em-dash character in either new file.

> Path note (worktree #3099): the plan's acceptance grep hardcodes the MAIN-repo absolute path `/home/jsagi/dev/MindrianOS-Plugin/lib/core/eureka/embedding-spine.cjs`. This plan executed in a git worktree, so the file lives at the worktree path until the branch merges. All checks were run against the worktree-relative/absolute path and pass identically; the hardcoded main-repo path only fails because the file is not yet on `main`.

## Task 3 - Live Encoder Smoke (the D-200-1 receipt)

Ran ONE live model load (real ~q8 MiniLM download, network once). The first MEASURED semantic-leg numbers in the repo:

| Pair | Cosine |
|------|--------|
| bridge: "circadian rhythm optimization in sleep science" vs "manufacturing shift scheduling around worker fatigue" | **0.2581** |
| control: "circadian rhythm optimization in sleep science" vs "tax form filing deadline" | **0.0610** |
| "manufacturing shift scheduling around worker fatigue" vs "tax form filing deadline" | 0.1387 |

- **Provenance:** `{"model":"Xenova/all-MiniLM-L6-v2","dtype":"q8","dim":384}`, 384-dim vectors.
- **Result:** bridge cosine (0.2581) is ~4.2x the control (0.0610), and strictly greater -> smoke exits 0. The semantic leg detects the cross-domain meaning link (both texts optimize around biological timing / worker fatigue) that the vocabulary hides. This proves the no-Python semantic leg end to end.
- Model cache landed in gitignored `node_modules/@huggingface/transformers/.cache`; no stray untracked files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Nested block-comment markers broke the parse**
- **Found during:** Task 2 GREEN (first test run).
- **Root cause:** the header docblock contained inline `/* string[] */` and `/* 384-dim, L2-normalized */` fragments. JavaScript does not nest block comments, so the first inner `*/` closed the header comment early and the remaining header text parsed as code -> `SyntaxError: Unexpected token ','`.
- **Fix:** replaced the inline `/* */` fragments with plain-text annotations (`texts: string[]`, `(384-dim, L2-normalized)`).
- **Files modified:** lib/core/eureka/embedding-spine.cjs
- **Commit:** a9aa9ea3 (folded into GREEN before commit).

**2. [Rule 1 - Bug] Stray NUL byte in the cache-key separator**
- **Found during:** Task 2 acceptance grep (grep silently classified the file as binary; `file` reported "data" despite pure short-line content).
- **Root cause:** line 133 `const cacheKey = model + ' ' + dtype;` - the intended space separator (0x20) was written as a NUL byte (0x00) at byte offset 6045. Node's utf8 read passed the NUL through as ` ` inside a string literal, so the module still loaded and tests still passed, but grep/`file` treated the whole file as binary (a real defect: any grep-based CI gate or acceptance check would misread it).
- **Fix:** stripped the NUL and set a clean, unambiguous separator: `const cacheKey = model + '::' + dtype;`. After the fix `file` reports "JavaScript source, ASCII text" and all grep-based acceptance checks pass.
- **Files modified:** lib/core/eureka/embedding-spine.cjs
- **Commit:** a9aa9ea3 (folded into GREEN before commit).

## Verification

- `node tests/test-211-embedding-spine.cjs` -> 5/5 PASS, exit 0 (offline, no model).
- Live smoke -> exit 0 (bridge > control), measured cosines recorded above.
- `bash tests/run-all-200.sh` -> **PASS=6 FAIL=0 SKIP=0** (no regression from the dependency install).
- Both new files -> `file` reports ASCII text (NUL defect cleared).

## Canon Compliance

- **Part 7 (Reuse Before Build):** `cosineSimilarity` is the re-exported `rs-pinecone-bridge.cjs` function object (reference-equal, Test 4), not a fork.
- **Part 8 (Graph Boundary):** embedding is fully local; the only network touch is the one-time generic model-weight download by model id (zero user bytes egress). This module deliberately adds no audit/egress layer of its own - the scorer keeps its own Part 8 layers.
- **Decision #8 (Tier-0 graceful degradation):** heavy dep lazy-required inside `getEncoder`; module loads and degrades to `encoder_unavailable` where the install failed.

## Known Stubs

None. The `encodeFn`/`_forceUnavailable` seams are test injection points (offline contract seams), not shipped stubs - the real model path is live and proven by the Task 3 smoke.

## Notes for Downstream Plans

- **211-02** consumes `embedTexts` for the vector leg and `sqlite-vec` (installed here) for the vector virtual table. `embedTexts` returns L2-normalized 384-dim `number[][]` with provenance; degrades to `encoder_unavailable`.
- **211-03** consumes the measured semantic leg via the same `embedTexts` and the reused `cosineSimilarity`.
- Env tunables available: `MINDRIAN_EMBED_MODEL` (default `Xenova/all-MiniLM-L6-v2`), `MINDRIAN_EMBED_DTYPE` (default `q8`), `MINDRIAN_MODEL_CACHE` (optional cache dir).

## Self-Check: PASSED

- Files exist: `lib/core/eureka/embedding-spine.cjs`, `tests/test-211-embedding-spine.cjs`, `211-01-SUMMARY.md` - all FOUND.
- Commits exist: `ba52600c` (RED test), `a9aa9ea3` (GREEN feat) - both FOUND in git log.
- Offline tests 5/5 PASS; Phase 200 regression suite PASS=6 FAIL=0.
