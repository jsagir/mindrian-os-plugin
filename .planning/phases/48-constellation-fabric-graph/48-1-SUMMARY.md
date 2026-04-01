---
phase: 48
plan: 1
subsystem: graph/constellation
tags: [cytoscape, de-stijl, fabric, threads, spectral, particles]
dependency_graph:
  requires: [lazygraph-ops, build-graph-from-kuzu, canvas-graph]
  provides: [constellation-config, constellation-template, enriched-graph-json]
  affects: [generate-snapshot, presentation-views]
tech_stack:
  added: [cytoscape.js@3.28.1]
  patterns: [thread-color-mapping, spectral-color-scale, particle-animation, edge-property-enrichment]
key_files:
  created:
    - lib/graph/constellation-config.cjs
    - templates/constellation.html
  modified:
    - scripts/build-graph-from-kuzu.cjs
decisions:
  - Cytoscape.js via CDN (unpkg) with inline fallback placeholder for offline mode
  - Spectral color scale interpolates from muted gray-blue to vivid gold (warm = high innovation)
  - Particle animation runs on Canvas overlay above Cytoscape for HSI and Bottleneck edges
  - All 12 edge types queryable separately from KuzuDB with type-specific property extraction
metrics:
  duration: ~15min
  completed: 2026-03-31
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 1
requirements: [FABRIC-01, FABRIC-02, FABRIC-03, FABRIC-04, FABRIC-05, FABRIC-06, VIEW-06]
---

# Phase 48 Plan 1: Constellation + Fabric Graph Summary

Full 12-Thread Cytoscape Constellation with De Stijl colors, spectral OM-HMM node coloring, animated Surprise particles, Bottleneck tooltips, and cross-domain Analogy bridges.

## Tasks Completed

### Task 1: Constellation Configuration Module
**Commit:** 796f506
**File:** `lib/graph/constellation-config.cjs`

Created the De Stijl thread color and style configuration module:
- THREAD_COLORS: 12 types mapped to distinct colors (blue, red, amber, green, gray, purple, gold, bright red, cyan, violet, emerald)
- THREAD_STYLES: line style (solid/dashed/dotted), width, arrow, animation flag per type
- EDGE_TYPE_LABELS: human-readable names for sidebar toggles
- spectralColorScale(): maps 0-1 spectral_gap to interpolated color (cool muted to vivid warm)
- generateCytoscapeStylesheet(): full Cytoscape stylesheet array ready for programmatic use

### Task 2: Constellation HTML Template
**Commit:** 1a1d484
**File:** `templates/constellation.html`

Created the SIGNATURE view template (1272 lines):
- Full-page Cytoscape.js graph with CDN loading from unpkg
- Sidebar with all 12 Thread type toggles (checkboxes, colored indicators, edge counts)
- 4 layout options: Force-Directed (cose), Concentric, Hierarchy, Circle
- Node click opens detail panel: section, methodology, spectral gap, dominant mode, connected threads
- Edge click shows type-specific properties (HSI score, innovation thesis, analogy distance, TRIZ principle)
- HSI_CONNECTION edges: animated gold particles on Canvas overlay for high-breakthrough connections (FABRIC-04)
- REVERSE_SALIENT edges: red pulsing particles + hover tooltip showing innovation_thesis (FABRIC-05)
- ANALOGOUS_TO edges: dashed cyan lines crossing between Section clusters (FABRIC-06)
- Spectral coloring: node background-color computed from spectral_gap_avg (FABRIC-03)
- De Stijl dark theme with Mondrian signature footer
- Responsive: sidebar hidden on mobile, full-width detail panel
- Deep links: claude-cli:// open links on every node

### Task 3: Enriched Graph JSON Export
**Commit:** f2e4961
**File:** `scripts/build-graph-from-kuzu.cjs`

Updated the KuzuDB graph exporter to include full typed edge properties:
- Loads .hsi-results.json for spectral OM-HMM profiles per artifact node
- Node data enriched with spectral_gap, spectral_gap_avg, dominant_mode, mode_entropy
- HSI_CONNECTION edges: hsi_score, breakthrough_potential, surprise_type, tier
- REVERSE_SALIENT edges: innovation_thesis, differential_score, innovation_type
- ANALOGOUS_TO edges: analogy_distance, structural_fitness, source_domain
- STRUCTURALLY_ISOMORPHIC edges: isomorphism_score, mapped_elements
- RESOLVES_VIA edges: resolution_type, triz_principle, confidence

## Deviations from Plan

None - plan executed exactly as written.

## Requirements Coverage

| Requirement | Status | How |
|-------------|--------|-----|
| FABRIC-01 | Complete | All 12 Thread types rendered with distinct Cytoscape edge styles |
| FABRIC-02 | Complete | De Stijl color per type + toggle filter sidebar with counts |
| FABRIC-03 | Complete | spectralColorScale() maps spectral_gap to node color intensity |
| FABRIC-04 | Complete | Canvas particle overlay animates gold particles on high-breakthrough HSI edges |
| FABRIC-05 | Complete | Hover tooltip on REVERSE_SALIENT edges shows innovation_thesis |
| FABRIC-06 | Complete | Dashed cyan lines for ANALOGOUS_TO cross-domain bridges |
| VIEW-06 | Complete | Full interactive Cytoscape graph as constellation.html template |

## Self-Check: PASSED
