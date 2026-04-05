# Deferred: Living Knowledge Wiki (v3.0 Milestone Vision)

**Captured:** 2026-03-23
**Source:** User vision during Phase 7 discuss-phase
**Status:** Deferred to v3.0 milestone

## The Vision

Three systems fused:
1. **Knowledge graph** — Neo4j as persistent data layer (entities, concepts, facts as nodes/edges)
2. **Document renderer** — Wikipedia-style HTML views generated from graph per-entity
3. **Collaborative editor** — Block-level real-time editing that writes BACK to the graph

Data flow: AI Generation → Graph DB ↔ Document Renderer ↔ Block Editor → Graph DB

## Block Architecture

Each document block maps to a graph concept:
- Paragraph → Node: Claim/Fact
- Hyperlink → Edge: REFERENCES → another Node
- Table → Edge: COMPARES (Node A, Node B)
- Citation → Edge: CITED_BY → Source Node
- Infobox → Node properties as key-value

## Auto-Hyperlinking Engine (Critical)

Links emerge from graph automatically, not hand-authored:
1. Entity extraction (LLM reads reports → named entities → Nodes)
2. Relationship detection (shared entities across reports → SHARED_CONCEPT edges)
3. Link injection (renderer traverses edges → injects `<a>` at render time)
4. Backlink registry ("What links here" section)

## Living Document Layer

- (:Block)-[:PREV_VERSION]->(:Block) — full version chain
- (:Block)-[:EDITED_BY]->(:User)
- (:Block)-[:REFERENCES]->(:Entity) — auto-extracted link targets
- (:Report)-[:SUPERSEDES]->(:Report) — temporal chaining

## Cross-Report Knowledge Accumulation

Entity pages auto-render as mini Wikipedia articles — aggregating every mention, context, and insight across all reports. Emergent knowledge, not authored.

## Idea Bank

Drag-to-bank = subgraph extraction UI:
- (:Insight) EXTRACTED_FROM → (:Block)
- SIMILAR_TO → (other :Insight nodes) via embedding similarity
- Visual knowledge graph explorer embedded in document interface

## Recommended Stack

- Frontend: Next.js + TipTap editor + Liveblocks
- Graph DB: Neo4j (already have Brain MCP)
- AI: Claude for generation + entity extraction
- Embeddings: stored on Neo4j nodes (already have Pinecone)
- Rendering: Cypher → template → Wikipedia HTML

## How v2.0 Builds the Foundation

Every Phase 6-9 deliverable feeds directly into this:
- Meeting filing → populates the graph with claims, entities, relationships
- Team profiles → person nodes with contribution edges
- Cross-relationship discovery → the edge types (INFORMS, CONTRADICTS, etc.)
- Meeting archive → temporal document chain
- TEAM-STATE.md → computed views of graph subsets

## Moat Potential

This architecture means the RAG system IS the wiki itself — each new document queries the existing graph, making it progressively smarter. Combined with the Brain (21K teaching nodes), this is a knowledge compounding engine that cannot be replicated by copying prompts.
