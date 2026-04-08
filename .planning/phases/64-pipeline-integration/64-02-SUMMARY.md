---
phase: 64-pipeline-integration
plan: 02
subsystem: pipeline
tags: [discovery-cycle, whitespace, orchestrator, kuzudb, child_process]

requires:
  - phase: 64-01
    provides: Three seeded whitespace discovery scripts (HSI, RS, Analogy)
provides:
  - Discovery Cycle orchestrator chaining all whitespace detection steps
  - DISCOVERY_CYCLE_SOURCE edge type in KuzuDB
  - Aggregated discovery-cycle-results.json output format
  - runDiscoveryCycle programmatic API for Phase 66
affects: [66-whitespace-command, lazygraph-ops, intelligence-pipeline]

tech-stack:
  added: []
  patterns: [execSync child_process chaining, partial-execution graceful skip, pre-flight validation]

key-files:
  created: [scripts/discovery-cycle.cjs]
  modified: [lib/core/lazygraph-ops.cjs]

key-decisions:
  - "All discovery steps wrapped in try/catch for partial execution -- individual failure never breaks the cycle"
  - "KuzuDB edge export before analogy step feeds pre-exported data; analogy script falls back to HSI if unavailable"
  - "runDiscoveryCycle exported as function for Phase 66 /mos:whitespace discover command"

patterns-established:
  - "Discovery Cycle orchestrator: pre-flight -> edge export -> HSI -> RS -> Analogy -> aggregate -> interpret"
  - "Dry-run validation: check all prerequisites without executing Python scripts"

requirements-completed: [PIPE-04]

duration: 5min
completed: 2026-04-08
---

# Phase 64 Plan 02: Discovery Cycle Pipeline Orchestrator Summary

**CJS orchestrator chains HSI, RS, and Analogy whitespace detection into a single sequenced command with partial execution, dry-run validation, and aggregated results output**

## What Was Built

### scripts/discovery-cycle.cjs
Single-command orchestrator that chains the three whitespace discovery scripts from Plan 01 into a full Discovery Cycle:

1. **Pre-flight** -- checks which pipeline outputs exist (HSI results, embeddings, brain baseline)
2. **Edge export** -- queries KuzuDB for ANALOGOUS_TO edges, writes to .mindrian/analogy-edges.json
3. **HSI whitespace** -- runs discover-hsi-whitespace.py (centroid probe between surprising pairs)
4. **RS whitespace** -- runs discover-rs-whitespace.py (downstream of bottleneck sections)
5. **Analogy whitespace** -- runs discover-analogy-whitespace.py (unarticulated transfer mechanisms)
6. **Aggregation** -- merges all outputs into discovery-cycle-results.json with flattened all_zones array sorted by gap signal strength
7. **Interpretation** -- optionally runs interpret-whitespace.cjs for Brain-powered classification

### CLI Interface
```
node scripts/discovery-cycle.cjs /path/to/room [--steps all|hsi|rs|analogy] [--verbose] [--dry-run]
```

### KuzuDB Edge Type
Added `DISCOVERY_CYCLE_SOURCE` edge (WhitespaceZone -> Artifact) with `discovery_method` and `cycle_timestamp` properties. Connects whitespace zones to the artifacts that seeded their discovery.

## Key Design Decisions

1. **On-demand only** -- NOT a post-write hook (per D-11 pitfalls research)
2. **Partial execution** -- each step wrapped in try/catch; missing Python or missing data skips gracefully
3. **Dry-run mode** -- validates prerequisites, checks Python parsing, reports what would run
4. **Module export** -- `runDiscoveryCycle(roomDir, options)` for programmatic use by Phase 66

## Deviations from Plan

### Task Consolidation

Tasks 1 and 2 were implemented as a single cohesive file. The plan specified Task 2 as adding --dry-run and the module export separately, but these were naturally part of the orchestrator's initial implementation. Both tasks share commit e127424.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1-2 | e127424 | Discovery Cycle orchestrator + DISCOVERY_CYCLE_SOURCE edge type |

## Verification Results

- `node scripts/discovery-cycle.cjs --help` -- shows usage with --steps, --dry-run, --verbose flags
- `require('./scripts/discovery-cycle.cjs').runDiscoveryCycle` -- confirms function export
- Dry-run validates chain without needing real room data
- DISCOVERY_CYCLE_SOURCE edge type added to EDGE_TYPES and initSchema

## Known Stubs

None -- all functionality is wired to real pipeline scripts and KuzuDB operations.
