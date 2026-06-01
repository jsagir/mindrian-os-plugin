# Phase 134 Multi-Source Coverage Audit

All four source types audited. Every item is COVERED by a plan. No unplanned items.

## GOAL (ROADMAP Phase 134 goal)

| Goal fragment | Covered by |
|---|---|
| Replace scripts/rs-engine.py with in-process CJS | Plan 04 (rs-engine.cjs) + Plan 06 (cutover) |
| Replace lib/core/rs_*.py | Plan 02 (rs_math), Plan 04 (rs_rooms/rs_cache/rs_hybrid + DELETE rs_corpus) |
| Replace scripts/hsi-*.py | Plan 05 (hsi-compute.cjs + hsi-whitespace.cjs) |
| via @huggingface/transformers (ONNX Xenova/multilingual-e5-large) | Plan 01 (dep + audit), Plan 03 (rs-embed.cjs) |
| remove Python from the user-machine surface entirely | Plan 06 (env-flag cjs default + Windows-replay; beta.3 removal is a follow-on) |

## REQ (phase requirement IDs)

The ROADMAP 134 entry carried `Requirements: TBD (sketch in 134-CONTEXT.md)`. Formalized here from the CONTEXT acceptance sketch + quality gate, distributed across plans:

| REQ ID | Meaning | Plan |
|---|---|---|
| CJS-134-VENDOR | pure-JS vendoring re-audit passes for the new dep | 01 |
| CJS-134-SVD | SVD/LSA port strategy chosen + correctness bar | 01, 02 |
| CJS-134-BYTECOMPAT | model-weight byte-compat measured + disposition | 01, 03 |
| CJS-134-MODELUX | first-run model-download UX + hook-timeout budget | 01, 03 |
| CJS-134-MATH | rs_math.py ported (cosine + LSA) | 02 |
| CJS-134-EMBED | in-process e5-large embedder | 03 |
| CJS-134-ENGINE | rs-engine.cjs 3-mode orchestrator | 04 |
| CJS-134-REUSE-130.5 | reuse 130.5 fetcher (no re-port) | 04 |
| CJS-134-DELETE-CORPUS | rs_corpus.py deleted | 04 |
| CJS-134-HSI | CJS HSI layer (131-deferred) | 05 |
| CJS-134-HSI-PARITY | CJS HSI == Python HSI on fixture | 05 |
| CJS-134-MIGRATE | callers rewired in-process (no spawn) | 06 |
| CJS-134-ENVFLAG | MINDRIAN_RS_ENGINE both-paths-one-beta | 06 |
| CJS-134-WINREPLAY | Windows-tester-replay zero-Python acceptance | 06 |
| CJS-134-RETIRE-PREFLIGHT | --check-rs-engine retired | 06 |

## RESEARCH (CONTEXT re-baseline + Tavily validation)

| Item | Covered by |
|---|---|
| Package is @huggingface/transformers (NOT @xenova) | 01, 03 (model id Xenova/multilingual-e5-large retained) |
| CJS+ESM support (await import fallback if ESM-only) | 01 (load mechanism), 03 (mirrors Phase 136 ink lazy-import) |
| ONNX runtime ships WASM, ~200MB optional dep | 01 (vendoring audit measures it) |
| ModelRegistry API (uncertain in public docs) | 01 (spike confirms existence), 03 (uses it or fallback) |
| LSA via TruncatedSVD = the only hard port | 01 (spike picks strategy), 02 (implements) |
| Re-vectorization OUT OF SCOPE (-> Phase 127.1) | 03 (byte-compat disposition references 127.1; not done here) |

## CONTEXT (D-XX decisions / re-baseline directives)

| Directive | Covered by |
|---|---|
| 1. Package @huggingface/transformers | 01, 03 |
| 2. REUSE 130.5, do NOT re-port fetcher; DELETE rs_corpus.py | 04 |
| 3. 134 owns the CJS HSI 131 deferred | 05 |
| 4. Vendoring re-audit HARD GATE + checkpoint before commit | 01 (Task 1 + blocking-human checkpoint) |
| Open Q: SVD port (pick one, correctness bar) | 01 spike + 02 |
| Open Q: byte-compat (drift decision) | 01 spike + 03 |
| Open Q: model-download UX | 01 spike + 03 |
| Open Q: migration env-flag (both paths one beta) | 01 (env-flag name) + 06 (wiring) |
| Replace surface: 5 Engine-1 commands CJS-backed | 06 (find-bottlenecks/whitespace + the 3 others via shared engine) |
| reverse-salient-agent.cjs in-process (no spawn) | 06 |

## Exclusions (not gaps)

- Brain server side stays Python (Canon Part 8 boundary) — CONTEXT out-of-scope.
- Re-vectorization of pws-brain index — CONTEXT out-of-scope (Phase 127.1).
- beta.3 removal of scripts/rs-engine.py + rs_*.py siblings + requirements-hsi.txt — follow-on after the both-paths beta soak (this phase ships beta.1 both-paths; Plan 06 notes the beta.3 removal as a follow-on, consistent with the migration directive).

## Dependency note (surfaced, not a gap)

Phase 130.5 (`research-corpus.cjs` + `research-cache.cjs`) is `depends_on` for Plan 04 and is currently **planned, not executed**. 130.5 ships in v1.13.1 BEFORE 134 (v1.14.0), so the ordering holds. If 130.5 is not yet executed when 134 Plan 04 runs, the executor must surface a blocker and NOT re-port rs_corpus.py (that would violate the reuse mandate).
