---
phase: "56"
plan: "01"
subsystem: mcp-pipeline
tags: [pipeline, chaining, brain-routing, methodology, room-artifacts]
dependency_graph:
  requires: [lib/mcp/tool-router.cjs, lib/mcp/brain-router.cjs]
  provides: [lib/mcp/pipeline-state.cjs, pipeline-context-headers]
  affects: [methodology-tools, analysis-tools, orchestration-tools]
tech_stack:
  added: []
  patterns: [room-artifact-state, advisory-chain-ordering, pipeline-context-headers]
key_files:
  created:
    - lib/mcp/pipeline-state.cjs
  modified:
    - lib/mcp/tool-router.cjs
    - lib/mcp/brain-router.cjs
decisions:
  - "Pipeline state stored in room/.mindrian/pipeline-state.json (ICM-native, room IS orchestration)"
  - "Chain ordering is advisory: out-of-order tool execution still records but does not advance position"
  - "FEEDS_INTO relationships prioritized over CO_OCCURS for Brain chain ordering"
metrics:
  duration: "6 minutes"
  completed: "2026-04-05"
  tasks: 3
  files: 3
requirements: [PIPE-01, PIPE-02, PIPE-03]
---

# Phase 56 Plan 01: Pipeline Chaining Summary

Room-file-based pipeline state enables LLM-orchestrated methodology sequences via MCP, with Brain-driven chain ordering from FEEDS_INTO and CO_OCCURS graph relationships.

## What Was Built

### Task 1: Pipeline State Manager (lib/mcp/pipeline-state.cjs)
- **Commit:** 16d5f65
- New module managing pipeline lifecycle: initChain, recordStep, checkPosition, clear
- State stored in `room/.mindrian/pipeline-state.json` (ICM principle: folder IS orchestration)
- Tracks: last_tool, output_path, chain_position, suggested_next, full chain, history
- Advisory chain ordering: records out-of-order steps but only advances position on match
- `formatPipelineContext()` generates structured `## Pipeline Context` markdown header

### Task 2: Standardized Tool Output Format
- **Commit:** 43f1419
- Methodology handler (14 commands) records pipeline step and adds `## Pipeline Context` section
- Analysis handler (13 commands) records pipeline step with pipeline-aware suggested next
- Pipeline chain ordering takes priority over hardcoded causal chaining patterns
- Every methodology/analysis response now includes: output path, chain position, next step

### Task 3: Brain Chain Ordering Wired to Pipeline
- **Commit:** 21f2964
- Brain Cypher query updated to include FEEDS_INTO + CO_OCCURS relationships
- FEEDS_INTO prioritized for sequential chains (e.g., scenario-plan -> root-cause)
- CO_OCCURS used as fallback for complementary frameworks
- `suggest-next`, `act`, and `act-chain` all call `pipelineState.initChain()`
- chain_type field added to recommendation response (feeds_into vs co_occurs)

## Pipeline Flow (End-to-End)

```
1. User asks "what should I do?" -> suggest-next / act / act-chain
2. Brain recommends chain: [scenario-plan, root-cause, causal-trace, causal-predict]
3. pipelineState.initChain() stores chain in room/.mindrian/pipeline-state.json
4. User runs methodology(scenario-plan) -> records step, output filed, position advances
5. Response includes ## Pipeline Context with next step: root-cause
6. User runs analysis(root-cause) -> reads previous output path, advances chain
7. Each step's output is discoverable via pipeline-state.json for the next tool
```

## Decisions Made

1. **Room-native state**: Pipeline state in `room/.mindrian/pipeline-state.json` not `/tmp/` or global config. Follows ICM principle that room IS orchestration.
2. **Advisory ordering**: Chain position tracking is advisory. Users can run tools out of order and the system still records progress. This matches Larry's teaching style (guide, don't force).
3. **FEEDS_INTO priority**: When Brain has both FEEDS_INTO and CO_OCCURS edges for a framework, sequential (FEEDS_INTO) chains are preferred over complementary (CO_OCCURS) groupings.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. All pipeline state operations are fully wired. Output paths use convention-based naming (`{section}/{command}-output.md`) which will be populated by actual methodology execution.

## Self-Check: PASSED

- lib/mcp/pipeline-state.cjs: FOUND
- lib/mcp/tool-router.cjs: FOUND
- lib/mcp/brain-router.cjs: FOUND
- Commit 16d5f65: FOUND
- Commit 43f1419: FOUND
- Commit 21f2964: FOUND
- All modules load without errors (node -e require verified)
