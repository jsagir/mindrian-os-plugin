---
phase: 72-opportunity-graph-brain-enrichment
plan: 01
subsystem: graph
tags: [kuzudb, lazygraph, opportunity-bank, graph-ops, cypher]

# Dependency graph
requires:
  - phase: 71-opportunity-extraction-engine
    provides: opportunity-extractor.cjs with schema fields + opportunityHash, bankOpportunity in opportunity-ops.cjs
provides:
  - Opportunity node table in KuzuDB schema with ADDRESSES and IN_DOMAIN edges
  - indexOpportunity() in graph-ops.cjs for graph indexing via enqueueWrite
  - filterOpportunities() in opportunity-ops.cjs for domain/knight/confidence filtering
  - Filter flags documented on /mos:opportunities list command
affects: [72-02 brain-enrichment, opportunity-bank queries, graph stats, room dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [Opportunity node as first-class KuzuDB entity, non-blocking graph indexing after file persistence]

key-files:
  created: []
  modified:
    - lib/core/lazygraph-ops.cjs
    - lib/core/graph-ops.cjs
    - lib/core/opportunity-ops.cjs
    - commands/opportunities.md

key-decisions:
  - "Non-blocking graph indexing: bankOpportunity writes file first, then fires indexOpportunity as catch-swallowed promise -- Tier 0 principle"
  - "ADDRESSES edges link Opportunity to up to 5 Artifacts in the domain section, IN_DOMAIN links to the Section node"
  - "graphStats updated to count Opportunity nodes and route ADDRESSES/IN_DOMAIN edge queries"

patterns-established:
  - "Opportunity-to-graph pattern: file persistence first, graph indexing second, graph failure never blocks banking"
  - "Edge routing in graphStats: OPPORTUNITY_EDGE_ROUTES map for Opportunity->Artifact and Opportunity->Section queries"

requirements-completed: [OPP-04]

# Metrics
duration: 4min
completed: 2026-04-09
---

# Phase 72 Plan 01: Opportunity Graph + Brain Enrichment Summary

**Opportunity nodes as first-class KuzuDB entities with ADDRESSES/IN_DOMAIN edges, non-blocking graph indexing from bankOpportunity, and domain/knight/confidence filter flags on /mos:opportunities**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-09T17:48:21Z
- **Completed:** 2026-04-09T17:52:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Opportunity node table with 9 fields (problem_hash PK) added to KuzuDB initSchema
- ADDRESSES (Opportunity->Artifact) and IN_DOMAIN (Opportunity->Section) edge tables for graph-powered discovery
- indexOpportunity() in graph-ops using enqueueWrite pattern for serialized KuzuDB access
- bankOpportunity() calls indexOpportunity non-blocking after file persistence (Tier 0 safe)
- filterOpportunities() enables filtering by domain, knight position, and minimum confidence
- /mos:opportunities list command documented with --domain, --knight, --min-confidence flags

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Opportunity node table + edges to KuzuDB schema and create indexOpportunity** - `f56a241` (feat)
2. **Task 2: Wire indexOpportunity into bankOpportunity and add filter flags** - `b15f408` (feat)

## Files Created/Modified
- `lib/core/lazygraph-ops.cjs` - Opportunity node table, ADDRESSES/IN_DOMAIN rel tables, createOpportunityNode/createAddressesEdge/createInDomainEdge functions, graphStats Opportunity counting + edge routing
- `lib/core/graph-ops.cjs` - indexOpportunity() using enqueueWrite + open-use-close pattern
- `lib/core/opportunity-ops.cjs` - graphOps require, non-blocking indexOpportunity call in bankOpportunity, filterOpportunities function
- `commands/opportunities.md` - Filter flags documentation for list subcommand (--domain, --knight, --min-confidence)

## Decisions Made
- Non-blocking graph indexing: file persistence is the source of truth, graph is enrichment layer that degrades gracefully
- ADDRESSES edges limited to 5 artifacts per domain section to avoid excessive edge creation
- graphStats updated with OPPORTUNITY_EDGE_ROUTES for correct Opportunity->Artifact and Opportunity->Section query routing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Opportunity nodes are in KuzuDB, ready for Brain enrichment cross-referencing (OPP-05)
- filterOpportunities ready for CLI integration in mindrian-tools.cjs
- Graph stats correctly count Opportunity nodes and edges

---
*Phase: 72-opportunity-graph-brain-enrichment*
*Completed: 2026-04-09*
