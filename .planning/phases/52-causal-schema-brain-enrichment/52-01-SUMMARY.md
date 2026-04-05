---
phase: 52-causal-schema-brain-enrichment
plan: "01"
subsystem: graph
tags: [kuzudb, causal-reasoning, brain-enrichment, lazygraph, edge-types]

requires:
  - phase: 51-snapshot-hub-export-polish
    provides: snapshot export with 12 thread types
provides:
  - CAUSES edge type (Artifact->Artifact) with mechanism, confidence, framework, direction
  - ROOT_CAUSE_OF edge type (Artifact->Artifact) with chain_length, intermediate_causes, confidence, discovery_source
  - enrichCausalEdges Brain client function for causal chain queries
  - Updated schema docs, fabric-chat schema, and snapshot THREAD_TYPES
affects: [constellation-graph, fabric-chat, snapshot-export, cascade-pipeline]

tech-stack:
  added: []
  patterns: [causal-edge-schema, brain-enrichment-pattern]

key-files:
  created: []
  modified:
    - lib/core/lazygraph-ops.cjs
    - lib/core/brain-client.cjs
    - lib/chat/fabric-chat.cjs
    - scripts/generate-snapshot.cjs
    - docs/lazygraph-schema.md

key-decisions:
  - "CAUSES uses forward/backward direction property for bidirectional tracing"
  - "ROOT_CAUSE_OF confidence decreases with chain length (1/(depth+1))"
  - "Brain enrichment queries CO_OCCURS and ADDRESSES_PROBLEM_TYPE relationships"

patterns-established:
  - "Causal edge pattern: CAUSES for direct effects, ROOT_CAUSE_OF for multi-hop chains"
  - "Brain enrichment function pattern: query remote Neo4j, return structured data for local KuzuDB"

metrics:
  duration: 3min
  completed: 2026-04-05
  tasks: 4
  files: 5
---

# Phase 52 Plan 01: Causal Schema + Brain Enrichment Summary

**CAUSES and ROOT_CAUSE_OF edges added to LazyGraph with Brain enrichment for causal framework chain queries**

## What Was Built

Extended the LazyGraph schema from 12 to 14 edge types by adding two causal relationship types that enable root cause analysis and causal chain tracing across room artifacts. Added a Brain enrichment function that queries the teaching graph's framework chains and returns structured causal data for local graph ingestion.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add causal edge types to LazyGraph schema | ad4d28d | lib/core/lazygraph-ops.cjs |
| 2 | Update fabric-chat GRAPH_SCHEMA and snapshot THREAD_TYPES | 69d7698 | lib/chat/fabric-chat.cjs, scripts/generate-snapshot.cjs |
| 3 | Create Brain causal enrichment function | 44253ff | lib/core/brain-client.cjs |
| 4 | Update lazygraph-schema.md docs | 18b8352 | docs/lazygraph-schema.md |

## Key Changes

### CAUSES Edge (Artifact -> Artifact)
- Properties: mechanism, confidence, framework, direction
- Detected via: explicit frontmatter, proximity causal terms, Brain enrichment
- Represents direct causal relationships between entries

### ROOT_CAUSE_OF Edge (Artifact -> Artifact)
- Properties: chain_length, intermediate_causes, confidence, discovery_source
- Detected via: Brain enrichment multi-hop chains, manual analysis
- Confidence decreases inversely with chain depth

### enrichCausalEdges Function
- Queries Brain Neo4j for ADDRESSES_PROBLEM_TYPE and CO_OCCURS relationships
- Configurable max chain depth (default 3) and minimum confidence (default 0.5)
- Returns { causes, rootCauses } arrays ready for KuzuDB ingestion
- Graceful degradation when Brain unavailable (returns null)

## Decisions Made

1. **Forward/backward direction on CAUSES**: Allows bidirectional causal tracing without separate edge types
2. **Inverse confidence on ROOT_CAUSE_OF**: Longer chains get lower confidence automatically (1/(depth+1))
3. **Brain queries use CO_OCCURS**: Maps framework co-occurrence to causal relationships since the teaching graph tracks which frameworks chain together

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- All 5 files exist and contain expected content
- All 4 commits verified in git log
- CAUSES appears in lazygraph-ops (2x), fabric-chat (2x), generate-snapshot (1x)
- ROOT_CAUSE_OF appears in lazygraph-ops (2x)
- enrichCausalEdges appears in brain-client (2x)
