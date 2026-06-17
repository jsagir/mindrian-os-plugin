---
kind: seed
status: open
created: 2026-06-17
canon_parts: [2, 8, 9]
severity: high
surfaces: [cli, desktop, cowork]
proving_case: ~/MindrianRooms/aion-eureka-synergy (AION Eureka demo build; F7/F8/D15)
qa_ref: .planning/debug/aion-eureka-demo-build-qa-session.md (F7, F8, F-misc rerank)
related: SEED-013 (eliminate-python), Phase 134 (cjs-port-of-python-analyzers, NOT built), Phase 157 (brain-orchestration-projection)
phase_research: .planning/research/local-embedding-vector-spine-phase-research.md
source: dogfood (AION C08 demo build) + navigator architectural rethink
---

# SEED: Local-embedding vector spine in room.db (retire Pinecone for room + signal)

## The rethink (navigator-directed)
Move every embedding-dependent surface (HSI, whitespace, find-analogies / find-connections /
find-bottlenecks / score-innovation, reverse-salient cross-domain match) OFF the remote
Pinecone vector service and ONTO the local graph (room.db). The vector index becomes the
local mind, not a remote dependency.

## Why (the session proved it)
- F7: `PINECONE_API_KEY` unset -> `scripts/rs-engine.py` external/cross-domain mode dead.
- F8: `rs-external` Pinecone index held a PRIOR project's corpus (nv-diamond-magnetometry);
  not room-scoped, not invalidated. Cross-domain RS silently matched the wrong corpus.
- F-misc: Pinecone `cascading-search` rerank caps (100 docs / 512 tokens) aborted queries.
- All three are the same root: leaning on a remote vector service for work that is local by
  constitution (Part 9: SQL is the local mind) and for a public corpus that should be
  fetched-on-demand, not pre-built remotely.

## The 3-corpus split (the architecture)
Embeddings are NOT one decision. They are three corpora with three owners:
1. ROOM corpus (claims, findings, opportunities) -> Part 9 LOCAL. Embed locally, store in
   room.db, never remote. (Today: partially Python-local for HSI; the cross-match leaked to Pinecone.)
2. SIGNAL corpus (arXiv / OpenAlex / web) -> public. Fetch-and-embed ON DEMAND, cache in
   room.db. Retire the pre-built `rs-external` Pinecone index (kills F8).
3. METHODOLOGY corpus (12,413 vectors) -> the MOAT (Part 8). NAVIGATOR DECISION (2026-06-17):
   go "fully local, drop the Brain corpus entirely" for the embedding/vector-match layer.
   >> MOAT FLAG (must be resolved in the phase, not buried): dropping the methodology vector
   corpus removes cross-domain-to-teaching-graph match, which is part of the documented moat
   (Canon Part 2 Engine 1 + the Moat Formula). The phase MUST decide explicitly: (a) keep
   Brain methodology match as a remote Mode-A enrichment while local powers Mode-B/Tier-0, OR
   (b) accept the moat reduction and rely on local room+signal vectors only. The navigator
   chose (b) directionally; ratify it as a LOCKED decision with the tradeoff stated.

## Technical shape (room-scale, cheap)
- Model: `transformers.js` (xenova) `all-MiniLM-L6-v2` (384-dim, ~25MB, pure JS in Node).
  NO API key, NO Python. This is the SEED-013 / Phase-134 direction, finally load-bearing.
- Storage: a `vector` BLOB column on nodes in room.db (or a sidecar `embeddings` table keyed
  by node id), written through the navigation.cjs chokepoint (Part 9).
- Search: brute-force cosine in JS. At room scale (tens-to-low-thousands of vectors) no ANN
  index / no `sqlite-vec` needed; this is microseconds. Add `sqlite-vec` ONLY if a room grows
  past ~50k vectors.
- Surfaces repointed: HSI scoring, whitespace map, find-connections/find-analogies (room-internal),
  reverse-salient (room + on-demand signal). All become a `getNeighborhood`-style vector query.

## Acceptance
1. find-connections / whitespace / HSI run with ZERO Pinecone and ZERO Python on a fresh room.
2. Embeddings are per-room (in room.db); a new room never matches a prior room's corpus (F8 gone).
3. No API key required for any room-local embedding surface (F7 gone).
4. Brain methodology match either (a) stays remote Mode-A or (b) is formally dropped per the LOCKED moat decision.
5. Part 8 preserved: no room bytes egress; Part 9 preserved: vectors written via navigation chokepoint.

## Tests
- Fresh-room test: bank 5 claims, embed locally, find-connections returns ranked neighbors with
  zero network calls (assert no fetch/Pinecone).
- Cross-room isolation: room A vectors never appear in room B find-connections.
- Parity: local cosine ranking on a fixed fixture matches the expected neighbor order.

## Reuse-before-build (Part 7)
Extend the navigation.cjs chokepoint (writeEmbedding/getNeighborhoodByVector), reuse the HSI
scoring math, retire the Python rs-engine path per SEED-013. Net-new is the local embedder
(transformers.js wrapper) + the BLOB column + the JS cosine query. Do NOT add a new DB.
