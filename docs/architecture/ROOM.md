# docs/architecture - ROOM.md (ICM Layer 0 Identity)

**Purpose:** This directory holds the architectural decision records (ADRs) for the
MindrianOS plugin. An ADR is a dated, binding statement of an architectural choice
that downstream phases reference and that CI guards enforce.

**Contents:**
- `SUBSTRATE-CONTRACT.md` - the four-substrate contract (Local SQLite via the
  navigation.cjs chokepoint, Aura Neo4j, Brain MCP, Pinecone), the M1-M4 + M11
  mandates, the navigation.cjs export allow-list, and the reuse-vs-build decision
  on the substrate guard.

**Owning canon parts:** Part 6 (Product-as-Venture dog-fooding), Part 7 (Reuse
Before Build), Part 8 (The Graph Boundary), Part 9 (Memory Locality). See
`docs/MINDRIAN-CANON.md`.

**Contract:** Every directory in this repo carries a ROOM.md per CLAUDE.md decision
15 (ICM Layer 0 everywhere). This file is the identity contract between this folder
and every agent that touches it. ADRs live here; implementation does not.
