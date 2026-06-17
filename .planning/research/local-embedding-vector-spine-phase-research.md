# Phase Research: Local-Embedding Vector Spine (retire Pinecone for room + signal)

> GSD phase-research artifact. Source: the AION Eureka demo-build dogfood session (2026-06-16/17)
> + a navigator-directed architectural rethink. Consumed when this phase is scaffolded.
> No em-dashes (project rule). Source-of-truth: install-cache beta.30 ran the session; reconcile
> against origin/main beta.31 before any code change.

## 1. The thesis

Every embedding-dependent surface in MindrianOS should compute against the LOCAL graph (room.db),
not a remote Pinecone index. The vector index becomes part of the local mind (Canon Part 9), not a
remote service dependency. This was directly motivated by three defects the demo build surfaced
(F7, F8, rerank caps) and is more canon-aligned than the status quo.

## 2. The embedding-dependent surfaces (what this touches)

Per Canon Part 2 Engine 1 (Act 1 intelligence) and the command map:
- HSI scoring (scripts/hsi-*, sentence-transformers + LSA, Python).
- Whitespace map (/mos:whitespace) over the room's artifact corpus.
- Reverse-salient + cross-domain match (/mos:find-bottlenecks, /mos:find-connections,
  /mos:find-analogies, /mos:score-innovation; scripts/rs-engine.py; Pinecone pws-brain + rs-external).
- /mos:diagnostics Wave-1 scalars (disruption / blindspot / novelty / bayesian-surprise).

## 3. Current-state defects that motivate the rethink (from the QA sweep)

- F7 [ENV-GAP]: PINECONE_API_KEY unset -> rs-engine.py external mode dead. The MCP path works, the
  env-keyed Python path does not; the two are not unified.
- F8 [NEW-FAILURE]: rs-external index held nv-diamond-magnetometry (a prior project) - not
  room-scoped, not invalidated. Cross-domain match silently used the wrong corpus.
- F-misc: Pinecone cascading-search rerank caps (100 docs / 512 tokens) forced query rework.
- (Adjacent) SEED-013 / Phase 134: the Python analyzers were to be ported to JS (xenova) and never were.

## 4. The 3-corpus split (the architecture decision)

| Corpus | Owner / Canon | Embedding location | Notes |
|--------|---------------|--------------------|-------|
| ROOM (claims, findings, opps) | navigator / Part 9 | LOCAL room.db | the local mind; never remote |
| SIGNAL (arXiv/OpenAlex/web) | public / transient | fetch-on-demand, cache in room.db | retire pre-built rs-external (kills F8) |
| METHODOLOGY (12,413 vectors) | moat / Part 8 | remote Brain (today) | NAVIGATOR DECISION below |

### Navigator decision (2026-06-17, to be ratified LOCKED)
Chosen direction: "fully local, drop the Brain corpus entirely" for the embedding/vector-match layer.
MOAT TRADEOFF (must be resolved in the phase plan, stated not buried): the methodology vector corpus
is part of the documented moat (Part 2 Engine 1 + the Moat Formula). Dropping it removes
cross-domain-to-teaching-graph match. The phase must either keep Brain methodology match as a remote
Mode-A enrichment (local powers Mode-B/Tier-0) OR accept the reduction with eyes open. The navigator
leaned (b); record it as a LOCKED decision with the tradeoff explicit. Brain teaching prose
(brain_ask/brain_search) is NOT affected; only the vector-match layer.

## 5. Technical shape (room-scale, cheap, no Python, no API)

- Embedder: transformers.js (xenova) all-MiniLM-L6-v2 (384-dim, ~25MB, pure JS, Node). SEED-013 direction.
- Storage: a `vector` BLOB on nodes in room.db (or sidecar `embeddings` table keyed by node id),
  written via the navigation.cjs chokepoint (Part 9).
- Search: brute-force cosine in JS. Room scale (tens to low-thousands) = microseconds; no ANN, no
  sqlite-vec until a room exceeds ~50k vectors.
- HSI / whitespace / find-* become vector queries over local embeddings, same shape as getNeighborhood.

## 6. Fix-mapping (what this phase kills)

- F7 -> no API key needed (local model).
- F8 -> per-room embeddings; cross-room isolation by construction.
- rerank caps -> JS cosine, no remote rerank service.
- SEED-013 / Phase 134 -> finally delivers the Python-elimination it scoped.

## 7. Canon alignment

- Part 9 (SQL is the local mind): local vectors written via navigation chokepoint = the index IS the graph.
- Part 8 (moat boundary): room + signal vectors are LOCAL (never egress); methodology corpus per the
  ratified decision. No new wire to the Brain for room/signal.
- Part 2 Engine 1: the whitespace + reverse-salient + cross-domain layers move from remote to local;
  the Act-1 intelligence keeps its shape, changes its substrate.
- Part 7 (reuse): extend navigation.cjs + reuse HSI math; net-new is the embedder wrapper + BLOB + cosine.

## 8. Proposed phase requirements (draft, for /gsd:new-milestone or /gsd:plan-phase)

- R1 local embedder (transformers.js MiniLM) wrapper in lib/core, no Python, no API.
- R2 embedding storage in room.db via navigation chokepoint (BLOB or sidecar table).
- R3 JS cosine neighborhood query (getNeighborhoodByVector) over local vectors.
- R4 repoint find-connections / find-analogies / whitespace / HSI at R3.
- R5 signal corpus: fetch-on-demand (Tavily/web) + local embed + room.db cache; retire rs-external.
- R6 methodology-corpus decision wired per the LOCKED moat decision (Mode-A remote vs dropped).
- R7 tests: zero-network fresh-room find-connections; cross-room isolation; ranking parity.
- R8 retire scripts/rs-engine.py Python path (SEED-013 closure).

## 9. Seeds attached to this phase

- SEED-029 local-embeddings-room-db-vector-spine (THIS rethink; the phase's spine).
- SEED-013 eliminate-python-from-user-machine-cjs-port (the prerequisite/overlap).
- SEED-026 graph-viz-from-roomdb-typed-edges (sibling: the EDGE viz; the critical-path fix below).
- SEED-027 export-present-active-room-misresolution (sibling QA NEW-FAILURE).
- SEED-028 workflow-synthesis-step-retry-and-fallback (sibling QA NEW-FAILURE).

## 10. The critical-path fix (carved out of the phase, ships on the 13.beta train now)

The phase above is a milestone-sized change. ONE fix is critical-path and shippable on the current
v1.13.x beta train independently, because it is user-visible, well-understood, and has a proving
implementation already built this session:

**SEED-026 - graph viz from room.db typed edges (not wikilinks).**
- Why critical-path: it is the defect the navigator saw directly ("orphan nodes no connections"); it
  undermines the "the room explains itself" thesis; and it is INDEPENDENT of the embedding phase (it
  is about typed EDGES already in room.db, not vectors), so it can ship now without waiting for R1-R8.
- Proving implementation exists: ~/MindrianRooms/aion-eureka-synergy/present/hub/graph.html
  (connected, colored by knowledge_type, edge-gloss on click) built from a room.db export.
- Scope: add getGraphExport(roomDir) to navigation.cjs; repoint generate-presentation.cjs graph
  builder + dashboard/index.html Cytoscape feed at it; color by knowledge_type; gloss edge types; no
  orphan-producing wikilink fallthrough. Tri-Polar: CLI + Desktop + Cowork all read the same export.
- Co-critical (data-integrity, slightly larger root cause): SEED-027 (export MCP resolves wrong room)
  - recommend it as the SECOND beta-train fix if the train has room.

Recommended execution: `/gsd:debug aion-eureka-demo-build-qa-session` (the QA case carries the RCA,
Required Code Changes, and Tests for SEED-026/027/028), or a `/gsd:quick` scoped to SEED-026.
