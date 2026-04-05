# Phase 15: User Knowledge Graph - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning
**Source:** Discussion with Jonathan (captured from conversation)

<domain>
## Phase Boundary

Phase 15 adds a per-project queryable knowledge graph that captures inter-room relationships as they evolve. This is the LazyGraph — .md files per folder manage intra-section context, the graph manages relationships BETWEEN sections.

Key architectural insight: Brain (Neo4j, remote) = methodology intelligence (Jonathan's IP). Room Graph (KuzuDB, local) = venture intelligence (user's data). Together they're far more powerful than either alone.

</domain>

<decisions>
## Implementation Decisions

### KuzuDB as the Embedded Graph Engine
- KuzuDB chosen over Neo4j Aura for user graph
- Embedded (like SQLite for graphs) — zero server, zero setup, runs in-process
- Apache 2.0 license — free forever
- Cypher compatible — same query language as Brain's Neo4j
- LangChain native integration
- Sub-millisecond local latency vs network round-trips
- Graph stored in `room/.lazygraph/` directory (per-project, embedded)

### Two-Graph Architecture
- Brain (Neo4j Aura, remote) = Jonathan's teaching graph. 21K nodes. IP. Served via MCP.
- Room Graph (KuzuDB, local) = User's inter-room relationships. Embedded in their project.
- .md files per folder = intra-section context (what's inside each section)
- LazyGraph = inter-room relationships (connections BETWEEN sections as they evolve)
- This is Simon's near-decomposable hierarchy made queryable

### Tiered Capability
- Tier 0: In-memory graph from analyze-room output (no deps, queryable but not persistent)
- Tier 1: KuzuDB embedded graph (persistent, Cypher-queryable, zero setup) — THIS PHASE
- Tier 2: KuzuDB + Pinecone semantic layer (graph + embeddings for HSI discovery) — GRAPH-04

### Five Edge Types (from existing CLAUDE.md architecture)
- INFORMS — this artifact references another section ([[cross-ref]])
- CONTRADICTS — this artifact conflicts with an existing claim
- CONVERGES — this artifact's themes appear in 3+ other sections
- INVALIDATES — this artifact makes an existing assumption stale
- ENABLES — this artifact unblocks something in another section

### Natural Language Queries
- User queries with natural language: "What contradicts my pricing assumption?"
- Larry translates to Cypher (KuzuDB is Cypher-compatible)
- Results formatted as Larry-style insights, not raw graph data

### Hook-Driven Updates
- Graph auto-updates when new artifacts are filed
- post-write hook triggers graph indexing for the changed artifact
- No manual rebuild needed — the graph grows with the venture

### Dual Delivery
- All operations as CLI commands (/mos:query, /mos:graph) and MCP tools
- Graph visualization reuses existing dashboard (build-graph already exists)

### Claude's Discretion
- KuzuDB Node.js binding API specifics
- Graph schema design (node types, property names)
- Pinecone embedding strategy for Tier 2
- How to handle graph migration when room structure changes
- Performance optimization for large rooms

</decisions>

<specifics>
## Specific Ideas

- build-graph already generates graph.json for the dashboard — KuzuDB can replace or complement this
- The 5 edge types are already detected by analyze-room and cross-reference scanning
- HSI tools in references/hsi/ can feed the Pinecone semantic layer
- Community KuzuDB MCP server exists — could be referenced
- Graph should be browsable in the existing De Stijl dashboard

</specifics>

<deferred>
## Deferred Ideas

- Full HSI reverse salient detection via graph (v4.0)
- Graph-powered assumption validity tracking
- Cross-user anonymized graph patterns
- Graph export for investor presentations
- Real-time graph updates during conversation (vs post-write hook)

</deferred>

---

*Phase: 15-user-knowledge-graph*
*Context gathered: 2026-03-25 via conversation capture*
