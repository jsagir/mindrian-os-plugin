---
phase: 134
slug: cjs-port-of-python-analyzers-via-xenova-transformers-elimina
milestone: v1.14.0
beta_target: 1.14.0-beta.1
priority: P1
canon_parts: [6, 7, 8]
status: scaffold
type: architectural
created: 2026-05-23
created_by: phase-127.2 Plan 03 (Task 6 -- F6 architectural scaffolding)
provenance:
  - .planning/debug/resolved/windows-tester-find-bottlenecks-silent-failure-qa-sweep.md
  - .planning/phases/127.2-brain-warmup-ping-hide-mcp-cold-start-latency-inside-larry-s/127.2-03-PLAN.md
title: CJS port of Python analyzers via @huggingface/transformers (eliminate Windows install-fragility class)
note_on_phase_number: |
  Plan 127.2-03 originally scoped this as "Phase 130." Slot 130 was already
  taken by `130-lens-engine-skeleton`; SDK assigned 134 as the next free
  numbered slot. The work scope is identical to the original 130 spec.
---

# Phase 134 -- CJS Port of Python Analyzers (Architectural Stub for v1.14.0)

## Status

**Scaffold only.** No PLAN.md. No code work in v1.13.0. This CONTEXT.md captures the design vision so the v1.14.0 planning cycle has a starting point that is not lost in a debug doc.

## Re-baseline corrections (2026-06-01, from the 131/132 4.7-to-4.8 review)

- **Package name corrected (Tavily-validated):** the library is `@huggingface/transformers` (Transformers.js v3+, official Hugging Face npm org), NOT `@xenova/transformers` (v1/v2, now effectively deprecated). Source: https://huggingface.co/blog/transformersjs-v3 ; deprecation thread https://github.com/huggingface/transformers.js/issues/1484 . Node CJS + ESM supported (no-build CJS rule holds); ONNX runtime is a ~200MB optional dep; model weights download on first use (~10-15s cold start); there is now a `ModelRegistry` API to pre-check download size / cache status / progress (directly answers Open Question 1). The `Xenova/multilingual-e5-large` MODEL id stays as-is (the HF model namespace is unchanged; only the PACKAGE was renamed).
- **Reuse the Phase 130.5 fetcher, do NOT re-port it.** The OpenAlex/arXiv corpus fetcher is built once in Phase 130.5 (`lib/core/research-corpus.cjs` + `research-cache.cjs`, native `fetch`, Python-free). Phase 134 DELETES `lib/core/rs_corpus.py` and REUSES that module; 134's only net-new is the in-process embedding/HSI layer.
- **134 owns the CJS HSI that Phase 131 deferred.** 131 (v1.13.1) ships before 134 (v1.14.0) and therefore ships with NO Python HSI; finding-level HSI-scoring waits for this phase's `@huggingface/transformers` CJS HSI. The v1.14.0 source-lens fan-out then turns it on.
- **Open Question 2 (re-vectorize Pinecone?) is de-risked by Phase 130.7.** `correlation_id` is name-based (hash of canonical_name + primary_label), so it is embedding-INDEPENDENT: a 134 embedding swap or a 127.1 Pinecone -> Neo4j HNSW move does NOT invalidate the dual-graph correlation. Re-vectorization (if embeddings drift) remains scoped under the parked Phase 127.1 disposition, not a 134 blocker.

## Provenance

This phase is the architectural answer to F6 from `.planning/debug/resolved/windows-tester-find-bottlenecks-silent-failure-qa-sweep.md` (Windows tester 2026-05-23 silent-failure RCA). The HOTFIX path (F1 + F2 + F7) shipped as v1.13.0-beta.30 via Plan 127.2-03; this phase is the STRUCTURAL path that eliminates the entire install-fragility class.

The dog-fooding loop: Aryeh's Windows machine (2026-05-23) hit `ModuleNotFoundError: requests` on `/mos:find-bottlenecks` because Python deps weren't installed. The hotfix surfaces the failure honestly (pre-flight + actionable fix line); the structural fix removes the Python-on-user-machine dependency surface entirely. Per Canon Part 6 dog-fooding mandate, the hotfix RCA explicitly scaffolds this phase rather than letting the architectural debt fade into a debug doc.

## Objective

Replace `scripts/rs-engine.py` + `lib/core/rs_*.py` + `scripts/hsi-*.py` with CJS equivalents using `@huggingface/transformers` (ONNX `Xenova/multilingual-e5-large` model) in-process. Eliminate Python from the user-machine surface entirely. Maintain byte-compatibility with the Pinecone 1024-dim index (current substrate; see Canon Phase Map Part 2 Engine 1).

## Why This Matters (Canon mapping)

- **Canon Part 6 (Product-as-Venture / dog-fooding):** the v1.13.0 hotfix surfaces install-fragility honestly; v1.14.0 removes the fragility. The same room (the plugin's own .planning/) tracks both the symptom and the structural fix.
- **Canon Part 7 (Reuse Before Build):** net-zero on capability count (same 5 commands: `/mos:find-bottlenecks`, `/mos:whitespace`, `/mos:find-connections`, `/mos:find-analogies`, `/mos:score-innovation`). Net-MINUS on dependency surface (Python + 4 pip packages removed; ONNX runtime + 1 npm package added).
- **Canon Part 8 (Graph Boundary):** unchanged. `@huggingface/transformers` runs LOCALLY in-process; the Brain wire schema (Phase 110) is the only boundary that interacts with the embedding layer, and that contract is upheld regardless of which substrate produces the embeddings.

## Design Vision

### Replace surface

| Current (Python) | Future (CJS / Node) |
|------------------|---------------------|
| `scripts/rs-engine.py` (Python CLI; spawned via child_process) | `lib/core/rs-engine.cjs` (in-process Node module; called directly) |
| `lib/core/rs_math.py` (cosine sim, LSA approximation) | `lib/core/rs-math.cjs` (pure JS math; can target stdlib + small math helpers) |
| `lib/core/rs_corpus.py` (uses `requests` for OpenAlex / arXiv; the silent-failure root cause) | DELETE -- REUSE Phase 130.5 `lib/core/research-corpus.cjs` + `research-cache.cjs` (the shared CJS fetcher; native `fetch`; zero new deps). Do NOT re-port (revised 2026-06-01: 130.5 builds it once, 131 + 134 + rs-discovery-engine all consume it). |
| `lib/core/rs_rooms.py`, `rs_cache.py`, `rs_hybrid.py` | CJS equivalents |
| `scripts/hsi-*.py` (sentence-transformers + LSA HSI computation) | `lib/core/hsi-*.cjs` (Xenova multilingual-e5-large in ONNX runtime; in-process) |
| `requirements-hsi.txt` (4 pip packages) | `package.json` adds `@huggingface/transformers` (~1 npm dep + bundled ONNX runtime) |

### Stack additions

| Library | Purpose | Why recommended |
|---------|---------|-----------------|
| `@huggingface/transformers` | ONNX runtime for `Xenova/multilingual-e5-large` (the SAME model as the current Pinecone index dim=1024) in-process Node | Battle-tested, MIT, widely-adopted. Bundles WASM ONNX runtime. No native binaries (Canon Part 7 vendoring rule preserved). |

### Math layer port

- **Cosine similarity:** trivial pure-JS port from `rs_math.py`.
- **LSA approximation:** the harder port. Current Python uses scipy.sparse.linalg.svds. Node equivalent needs a thin SVD implementation (consider `numeric.js` or a hand-rolled truncated SVD; ~200 lines).
- **HSI scoring:** pure arithmetic; trivial port.
- **Reverse-salient bridge detection:** algorithmic, no heavy math; trivial port.

## Open Questions (for v1.14.0 planning cycle)

1. **ONNX runtime size on user machines.** `@huggingface/transformers` ships a WASM ONNX runtime; first-use downloads model weights (~600MB for multilingual-e5-large) into the user's cache. UX: how do we communicate this on first run? Bundle pre-quantized weights with the plugin? Lazy-download with progress UI?
2. **Multilingual-e5-large weight verification.** The Xenova distribution is a re-host of the Microsoft model; we need to verify embedding output is byte-identical (or close enough that cosine similarity preserves) to the current Pinecone-indexed vectors. If not byte-identical, do we re-vectorize the entire `pws-brain` index (12,401 vectors at $0.10/M tokens) or accept the small drift?
3. **Math-layer port plan.** Pure-JS LSA via SVD is the only non-trivial port. Options: (a) hand-roll truncated SVD (~200 lines); (b) use `numeric.js` (5+ years stale; risky); (c) call out to an in-process WASM math library; (d) approximate via random projection + power iteration. Pick before plan-phase.
4. **HSI compute on user machines.** Current `scripts/hsi-*.py` runs on-room-write. CJS port runs in-process during the same Node lifecycle. Performance budget: must complete within the existing hook timeout (~30s for cold model load + warm computation). Validate on Aryeh's Windows machine class before promoting.
5. **Test-suite parity.** Every Python test for `rs_*.py` needs a CJS equivalent. Estimate ~20 new CJS test files mirroring the existing Python test surface.
6. **Migration path.** Plugin ships BOTH paths for one beta (Python OR CJS, env-flag selectable); v1.14.0-beta.1 default-on the CJS path, beta.2 deprecates Python, beta.3 removes Python entirely. Lockstep with Phase 130 (lens-engine) and Phase 131 (research-as-graph-aware-workflow) so dependencies migrate together if they share surface.

## Estimate

~3 weeks of work (per the tester transcript's rough scope). Sub-divides:
- Week 1: rs_math.cjs + rs_corpus.cjs (the easy ports, no model surface)
- Week 2: rs-engine.cjs orchestrator + integration with existing reverse-salient-agent.cjs (replace child_process spawn with in-process require)
- Week 3: HSI port (the hard one) + test-suite parity + migration env-flag

## Acceptance criteria (sketch -- formalize in plan-phase)

- [ ] `/mos:find-bottlenecks` produces SAME ranked findings on a fixture room across Python + CJS substrates (byte-identical OR documented small drift with justification).
- [ ] Zero Python in `package.json` dev or runtime deps; zero `pip install` step in any onboarding doc.
- [ ] `--check-rs-engine` (the Plan 127.2-03 pre-flight) is REPLACED with a no-op message OR removed entirely (the failure class it gated against no longer exists).
- [ ] All 5 Engine 1 Act 1 commands (`/mos:find-bottlenecks`, `/mos:whitespace`, `/mos:find-connections`, `/mos:find-analogies`, `/mos:score-innovation`) ship CJS-backed in v1.14.0-beta.1.
- [ ] Windows tester replay (Aryeh's machine class) confirms zero Python errors across full Engine 1 Act 1 workflow.

## Out of scope

- The Brain server side (`mindrian-brain.onrender.com`) stays as-is. This phase ports the LOCAL surfaces only; the remote Brain remains a Python service per Canon Part 8 boundary (LOCAL <-> BRAIN, with the BRAIN side opaque to the plugin).
- Re-vectorization of `pws-brain` index. If embeddings drift, scope re-vectorization as a separate Phase under Phase 127.1 disposition (which itself parks on a 7-day soak for the Pinecone -> Neo4j HNSW substrate swap question -- see F3 in the source RCA).

## Cross-phase awareness

- **Phase 127.1** (BRAIN-GRAPHRAG-COLLAPSE) parks the Pinecone -> Neo4j HNSW question. If 127.1 closes BEFORE 134 starts, the embedding-surface side of this port may simplify (write CJS-side vectors directly to Neo4j HNSW; skip Pinecone byte-compat question entirely).
- **Phase 110** (Brain Context Packet Contract) defines the Brain wire schema. Whatever runs in-process here must respect that contract verbatim; no schema drift.
- **Phase 130** (lens-engine-skeleton) is unrelated despite the slot collision in the original Plan 127.2-03 spec. Slot 134 was assigned because 130 was taken.

## Decision parked

User (Jonathan) to pick the disposition before v1.14.0 plan-phase opens this phase. Options: (a) plan-phase immediately and ship in v1.14.0-beta.1; (b) defer to v1.14.0-beta.2 alongside Phase 130/131/132; (c) re-scope to bridge-only (rs-engine port first; HSI port slipped to v1.14.0-beta.3+).
