---
phase: 27-filing-pipeline-kuzudb-engine
plan: "02"
title: "Complete Post-Write Cascade + Artifact IDs + KuzuDB Graph Builder"
subsystem: filing-pipeline
tags: [post-write, artifact-id, kuzudb, graph-builder, cascade]
dependency_graph:
  requires: [lazygraph-ops, classify-insight, compute-state, git-ops]
  provides: [artifact-id, build-graph-from-kuzu, full-filing-cascade]
  affects: [post-write, room-filing, graph-json]
tech_stack:
  added: []
  patterns: [sync-bg-split, idempotent-injection, graceful-degradation]
key_files:
  created:
    - lib/core/artifact-id.cjs
    - scripts/build-graph-from-kuzu.cjs
  modified:
    - scripts/post-write
key_decisions:
  - "KuzuDB index changed from background to sync so build-graph-from-kuzu sees fresh data"
  - "Artifact ID injection runs before KuzuDB index to include ID in indexed content"
  - "Room dir detection moved early in post-write for all downstream steps"
  - "String-based frontmatter manipulation (no gray-matter for writes) to avoid content reformatting"
metrics:
  duration: "3min"
  completed: "2026-03-30"
  tasks: 2
  files: 3
---

# Phase 27 Plan 02: Complete Post-Write Cascade + Artifact IDs + KuzuDB Graph Builder Summary

Full filing cascade wired: every room artifact write triggers classify, artifact-id injection, KuzuDB index (sync), then compute-state, build-graph-from-kuzu, and git-ops in background -- all within 3s hook timeout.

## What Was Built

### lib/core/artifact-id.cjs
- `computeArtifactId(roomDir, section, title, created)` - deterministic 12-char SHA256 hex hash
- `injectArtifactId(filePath, roomDir)` - idempotent frontmatter injection of artifact_id field
- `injectPipelineProvenance(filePath, pipeline, stage, requires, provides)` - idempotent pipeline metadata injection
- All operations are string-based (split/rejoin) to avoid reformatting content

### scripts/build-graph-from-kuzu.cjs
- Queries KuzuDB via lazygraph-ops.openGraph/queryGraph/closeGraph
- Produces Cytoscape JSON matching build-graph output structure
- Queries Artifact, Section, Meeting, Speaker, Assumption nodes (graceful skip if tables missing)
- Queries all edges with deduplication
- Uses same De Stijl section color palette as build-graph
- Graceful degradation: exits 0 on missing .lazygraph or any error

### scripts/post-write (extended)
Full 8-step cascade:
1. Active room guard (existing)
2. Track analytics (background, existing)
3. Inject artifact_id into frontmatter (sync, <50ms) -- NEW
4. classify-insight (sync, <100ms, existing)
5. KuzuDB graph index (sync, <500ms) -- CHANGED from bg to sync
6. compute-state (background, <2s) -- NEW
7. build-graph-from-kuzu (background, <5s) -- NEW
8. git-ops commit (background, existing)

## Decisions Made

1. **KuzuDB index sync, not bg** - Changed from background to synchronous so build-graph-from-kuzu sees the just-indexed data when it runs in background
2. **Room dir detection early** - Moved STATE.md walk-up detection before artifact_id injection step so all downstream steps share the same room_dir
3. **String-based frontmatter** - No gray-matter for writes to avoid content reformatting
4. **Sync budget: ~650ms** - Steps 3+4+5 run synchronously within 3000ms hook timeout

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. `bash -n scripts/post-write` - syntax OK
2. `computeArtifactId('/tmp/room', 'problem-definition', 'Test', '2026-03-15')` - outputs `24face6615dd` (12-char hex)
3. `build-graph-from-kuzu.cjs /tmp/nonexistent` - exits 0 (graceful degradation)
4. Background processes confirmed in post-write (17 `&` occurrences)
5. artifact-id reference confirmed in post-write
6. build-graph-from-kuzu reference confirmed in post-write

## Known Stubs

None - all functions are fully implemented.
