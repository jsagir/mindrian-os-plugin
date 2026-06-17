---
phase: 161
slug: embedding-layer-and-rs-reconciliation
milestone: v1.14.0
status: context-gathering
canon_parts: [2, 3, 7, 8, 9]
created: 2026-06-17
depends_on: [141]      # local-retrieval-spine (shipped) - getRoomContext substrate
absorbs: [134]          # cjs-port-of-python-analyzers (NEVER built) - this delivers it
parallel: [144.1]       # connector-retrofit-sweep - RS spine-wiring overlaps
seeds: [SEED-013, SEED-026, SEED-029, SEED-030]
research: .planning/research/local-embedding-vector-spine-phase-research.md
qa_ref: .planning/debug/aion-eureka-demo-build-qa-session.md (F7, F8, F-misc rerank)
source_of_truth: install-cache beta.30 ran the dogfood session; reconcile vs origin/main beta.31 before any code change
---

# Phase 161 - The Embedding Layer + RS spine/expert reconciliation

## Goal (goal-backward, one sentence)
Every embedding-dependent surface (HSI, whitespace, find-connections/analogies/bottlenecks,
reverse-salient) computes against a single first-class **Embedding Layer** over local vectors in
room.db - zero Pinecone, zero Python, no API key, per-room scoped - and the orphaned RS pipelines
are wired onto the Larry-reaches connector spine.

## Why now (motivating defects, from the QA sweep)
- F7 [ENV-GAP]: PINECONE_API_KEY unset -> rs-engine.py external mode dead.
- F8 [NEW-FAILURE]: rs-external held a prior project's corpus (nv-diamond-magnetometry); not room-scoped.
- F-misc: Pinecone cascading-search rerank caps (100 docs / 512 tokens) aborted queries.
- Wiring audit (2026-06-17): rs-fetch/explain/experts/thesis NOT-WIRED + ABSENT from connector-registry.

## The three LOCKED-pending decisions (resolve at discuss-phase; recommendations given)
- **D-model** - embedding backend. transformers.js WASM (`onnxruntime-web`, portable, fits the
  pure-JS vendored-node_modules rule) vs native (`onnxruntime-node`, faster, per-platform .node
  binaries that break single-tree vendoring). **RECOMMEND: WASM**, model all-MiniLM-L6-v2 int8 (~23MB).
- **R6** - vector moat. Drop the Brain methodology corpus entirely vs keep it as a remote Mode-A
  enrichment (local powers Mode-B/Tier-0). Navigator leaned "drop" on 2026-06-17; the moat tradeoff
  (loses cross-domain-to-teaching-graph match, part of the documented moat) was flagged.
  **RECOMMEND: keep Brain Mode-A** (preserves moat AND recall; local handles offline). RATIFY explicitly.
- **R-expert** - graph moat. rs-experts Aura/expert-network coupling: keep remote-Brain Mode-A vs
  descope. **RECOMMEND: keep remote** (people/teaching-graph data is genuinely Brain IP, Part 8).

## Requirements
| # | Requirement | Seed |
|---|-------------|------|
| R1 | First-class Embedding Layer `lib/core/embeddings.cjs`: one embedder + one model (transformers.js, D-model) | SEED-029 |
| R2 | Embedding storage in room.db (BLOB or sidecar table) written via the navigation.cjs chokepoint | SEED-029 |
| R3 | `getNeighborhoodByVector` - JS brute-force cosine over local vectors (exact; no ANN at room scale) | SEED-029 |
| R4 | Repoint HSI / whitespace / find-connections / find-analogies / find-bottlenecks / score-innovation at R1-R3 | SEED-029 |
| R5 | Signal corpus: fetch-on-demand (Tavily/web) + local embed + room.db cache; retire pre-built rs-external | SEED-029 |
| R6 | Methodology-corpus path wired per the R6 decision (drop vs Brain Mode-A) | SEED-029 |
| R7 | Retire scripts/rs-engine.py + lib/core/rs_*.py Python (closes SEED-013 / Phase 134) | SEED-013 |
| R-RS-1 | Repoint RS engine modes (internal/cross-room/external/hybrid) vectors at the Embedding Layer | SEED-030 |
| R-RS-2 | Wire rs-fetch/explain/experts/thesis onto the connector spine; regenerate registry; --check green | SEED-030 |
| R-RS-3 | rs-experts Aura/expert path wired per the R-expert decision; graceful offline degrade | SEED-030 |
| R8 | Tests: zero-network fresh-room find-connections; cross-room vector isolation; ranking parity; HSI threshold re-calibration; RS-in-registry; rs-experts offline-degrade | all |

## Quality bar (acceptance - parity-or-better, recall-tested)
- find-connections / whitespace / HSI / reverse-salient (room-internal): PARITY-OR-BETTER local.
  Brute-force cosine is exact (> Pinecone ANN); relative rankings are model-robust; one HSI threshold
  re-calibration pass against the local model. Insight quality is unchanged because embeddings are a
  RETRIEVAL substrate and the reasoning layer (Larry/agents) does the judging.
- find-analogies / cross-domain-to-methodology: recall-tested. The only model-size-sensitive surface;
  preserved by R6 (keep Brain Mode-A) or by stepping the local model tier (bge-base/e5-base, still JS).

## Scope
- IN: the Embedding Layer substrate (R1-R3); repoint of all wired intelligence surfaces (R4); signal
  on-demand (R5); Python retirement (R7); RS vector-repoint + spine-wiring (R-RS-1/2); the R6/R-expert
  wiring.
- OUT: SEED-026 graph-viz-from-room.db (about typed EDGES not vectors; ships NOW as the carved-out
  v1.13.x beta critical-path fix, independent of this phase); SEED-027/028 (separate QA fixes); Brain
  teaching prose (brain_ask/brain_search untouched - only the vector/expert layers move).

## Dependencies and relationships
- depends_on Phase 141 (local-retrieval-spine, shipped): reuses getRoomContext + navigation chokepoint.
- absorbs Phase 134 (cjs-port-of-python-analyzers, never built): R7 delivers the Python elimination.
- parallel Phase 144.1 (connector-retrofit-sweep): R-RS-2 is the RS slice of that sweep.

## Plan waves (for /gsd:plan-phase)
1. Embedding Layer substrate: R1-R3 (embedder + storage + cosine).
2. Repoint wired surfaces: R4 + HSI re-calibration.
3. Signal-on-demand + retire rs-external: R5.
4. RS reconciliation: R-RS-1 (vectors) + R-RS-2 (spine-wire) + R-RS-3 (expert decision).
5. Decisions wired (R6) + Python retirement (R7) + full test pass (R8) + Tri-Polar verify.

## Success criteria
- A fresh room runs find-connections + whitespace + HSI + reverse-salient with ZERO network and ZERO Python.
- A new room never matches a prior room's corpus (F8 closed).
- No API key needed for any room-local embedding surface (F7 closed).
- rs-fetch/explain/experts/thesis appear in data/connector-registry.json (orphan gap closed).
- D-model / R6 / R-expert ratified as LOCKED decisions with tradeoffs recorded.

## Next action
`/gsd:discuss-phase 161` to ratify D-model / R6 / R-expert, then `/gsd:plan-phase 161`.
Reconcile the beta.30-vs-beta.31 source delta before any code claim becomes load-bearing.
