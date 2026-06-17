---
phase: 162
slug: graph-spine-single-authority-viz
status: in-progress        # W1 passed; W2-W7 pending. NOT phase-complete (closed-phase gate must not fire).
verified: 2026-06-17
branch: fix/seed-026-graph-export-spine
---

# Phase 162 Verification

Per-wave verification. The phase is NOT complete until all waves pass; this record tracks progress.

## Wave status

| Wave | Plan | Status | Milestone |
|------|------|--------|-----------|
| W1 | 162-01 | PASSED (as-built, evidence below) | v1.13.x beta |
| W2 | 162-02 | pending | v1.13.x beta |
| W3 | 162-03 | pending (blocking-human release checkpoint) | v1.13.x beta |
| W4 | 162-04 | pending | v1.14.0 |
| W5 | 162-05 | pending | v1.14.0 |
| W6 | 162-06 | pending | v1.14.0 |
| W7 | 162-07 | pending | v1.14.0 |

## W1 (162-01) - PASSED

Goal: every graph the presentation surface draws is sourced through the navigation spine over room.db
in ONE node-identity space, so dangling/phantom orphans are structurally impossible.

### must_haves (goal-backward)
- [x] `lib/core/navigation/graph-export.cjs` exists; `getGraphExport(roomDir)` exported through `lib/core/navigation.cjs`.
- [x] Sources BOTH nodes and edges from room.db in one identity space; an edge ships only when both endpoints are in the included node set (no-orphan invariant, graph-export.cjs).
- [x] Bookkeeping types (memory_event/focus/audit + cortex) excluded and COUNTED, never silently dropped.
- [x] knowledge_type drives node color; degree derived from edge incidence; cold-start emits section anchors.
- [x] Canon Part 8 whitelist payload (no raw properties blob, no source_path, no correlation_id).
- [x] `generate-presentation.cjs` repointed off the two-authority collectGraph+collectGraphData path onto getGraphExport.
- [x] Surface-growth canon note present on the navigation.cjs re-export (Part 6 dog-fooding).

### Evidence (live, 2026-06-17)
- `node tests/test-graph-export.cjs` -> **5 passed, 0 failed** (no-orphan invariant, cold-start, unknown-type loud-but-graceful, Part 8 whitelist, real-room integration).
- `generate-presentation.cjs` on `~/MindrianRooms/aion-eureka-synergy` -> **"Graph: 93 nodes, 81 edges"**, graphData `excluded:450, orphans:11, unmapped_types:[]`, zero dangling (the 11 orphans are genuine degree-0 knowledge nodes, not phantom id-mismatch orphans).
- Intelligence smoke (getRoomContext + insight queries + getGraphExport coexist): **6 ok / 0 fail**.
- `tests/test-navigation-acceptance.cjs`: **1/1** (zero non-SQLite reads preserved).
- `tests/test-navigation-chokepoint-hook.cjs`: **7/7**.
- `scripts/check-substrate.cjs`: no new direct-room.db violation introduced by graph-export.cjs (reads via lazygraph-ops only).
- Em-dash gate: clean on all W1 files.

### Gates cleared (W1)
- Canon Part 8: whitelist payload; adversarial leak test deferred to W3 (R5) per plan.
- Canon Part 9: viz reads THROUGH the navigation chokepoint; no direct room.db open in graph-export.cjs.
- Tri-Polar: CLI presentation surface (canvas-graph) verified; Desktop/Cowork dashboard is W2.
- Reuse-before-build: extends the spine + reuses lazygraph-ops read primitives; net-new is the one submodule + test.

### Independent review
gsd-plan-checker (2026-06-17) re-ran the W1 suite live and confirmed 162-01 is a faithful AS-BUILT
reconcile (5/5, 93/81, unmapped=[]); overall Phase 162 plan-check verdict PASS, no blockers.
