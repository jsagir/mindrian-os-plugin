---
phase: 47
plan: 01
subsystem: room-type-detection, intelligence-extraction
tags: [room-type, adaptive-ui, parallel-extraction, signals, health-score]
dependency_graph:
  requires: [model-profiles, section-registry, state-ops]
  provides: [room-type-detector, extract-room-intelligence, adaptive-snapshot]
  affects: [generate-snapshot, hub-page, constellation]
tech_stack:
  added: []
  patterns: [pure-function-detection, tiered-extraction, strong-indicator-scoring]
key_files:
  created:
    - lib/core/room-type-detector.cjs
    - scripts/extract-room-intelligence.cjs
  modified:
    - scripts/generate-snapshot.cjs
decisions:
  - Strong indicator scoring (10 points) for domain-unique Sections prevents generic venture sections from drowning research/website signals
  - Health score formula: sectionCompleteness(40%) + edgeDensity(30%) + reasoningCoverage(30%)
  - Signal priority: CONTRADICTS > REVERSE_SALIENT > HSI_CONNECTION > CONVERGES > ANALOGOUS_TO > INFORMS
  - Narrative generation is type-dispatched with venture/website/research/general story builders
metrics:
  duration: ~10min
  completed: 2026-04-01
requirements: [ROOM-01, ROOM-02, ROOM-03, ROOM-04, EXTRACT-01, EXTRACT-02, EXTRACT-03]
---

# Phase 47 Plan 01: Adaptive Room Detection + Parallel Extraction Summary

Room type detector classifies any Room as venture/website/research/general using a 3-tier cascade (explicit frontmatter > strong-indicator Section scoring > content keyword sampling), then adapts stats bar, Section labels, and hub title via ROOM_TYPE_CONFIG presets. Intelligence extractor runs tiered extraction (haiku scan per Section, sonnet synthesis for Signals + health, opus narrative adapted to type).

## What Was Built

### 1. Room Type Detector (lib/core/room-type-detector.cjs)
Pure function module with zero side effects. Detection cascade:
1. Explicit `room_type`/`project_type` in State frontmatter (instant)
2. Strong indicator scoring: domain-unique Sections get 10-point bonus (e.g., `clinical-pathway` = research, `financial-model` = venture)
3. Standard Section name keyword matching (3 points per hit)
4. Entry content keyword sampling (1 point per hit, first 3 entries per Section)
5. Fallback to `general` if no type scores above threshold (3 points)

ROOM_TYPE_CONFIG provides per-type presets:
- `statsBar[]`: adaptive metric keys + labels for the stats bar
- `hubTitle`: display title for the hub page
- `sectionLabels{}`: Section id -> display name overrides
- `insightTypes[]`: prioritized Signal types
- `graphLabel`: Constellation view label

### 2. generate-snapshot.cjs Updates
- Imports room-type-detector at top
- Calls `detectRoomType()` during `scanRoom()` with State content + Section metadata
- Stats bar HTML now renders from `roomTypeConfig.statsBar` (adaptive per Room type)
- Section card labels resolved via `getSectionLabel()` (type-specific overrides)
- Hub title from `roomTypeConfig.hubTitle` shown in header
- Console output shows Room type and type-specific metrics

### 3. Room Intelligence Extractor (scripts/extract-room-intelligence.cjs)
Three extraction tiers mapped to model-profiles routing:

**EXTRACT-01 (Haiku-tier):** `scanSection()` per Section
- Entry count, word count, methodology coverage
- Thesis from MINTO.md/REASONING.md governing thought
- Claims from frontmatter validity status
- Spectral profiles from .hsi-results.json

**EXTRACT-02 (Sonnet-tier):** `synthesizeIntelligence()`
- Top 5 Signals (priority: CONTRADICTS > REVERSE_SALIENT > CONVERGES > Blind Spots > stale reasoning)
- Room health score (0-100): sectionCompleteness x edgeDensity x reasoningCoverage
- Innovation map (Sections with high spectral gap)
- Sentinel digest from .intelligence/ directory

**EXTRACT-03 (Opus-tier):** `generateNarrative()`
- Type-dispatched story builders (venture/website/research/general)
- Hub hero text adapted to Room type
- Key stats extracted per type
- Governing thoughts collected from populated Sections

## Verification

- demo-cancer-room (clinical-pathway + literature): correctly detects as "research", stats bar shows Papers/Citations/Findings/Gaps
- default room (financial-model + competitive-analysis): correctly detects as "venture", stats bar shows Entries/Threads/Blind Spots/Grants
- generate-snapshot.cjs syntax check passes
- extract-room-intelligence.cjs produces complete JSON with all three extraction tiers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Research detection drowned by venture sections**
- Found during: Task 2 verification
- Issue: demo-cancer-room has both venture-standard sections (market-analysis, competitive-analysis) and research-specific sections (clinical-pathway, literature). Standard keyword matching scored venture higher.
- Fix: Added STRONG_INDICATORS with 10-point bonus for domain-unique sections. Removed market-analysis from venture keywords (too generic).
- Files modified: lib/core/room-type-detector.cjs
- Commit: 45cde05

## Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Room type detector with ROOM_TYPE_CONFIG | 0697cba |
| 2 | generate-snapshot.cjs adaptive integration | 6a1747f |
| 3 | Room intelligence extractor (3-tier pipeline) | 26f8fdb |
| Fix | Strong indicator scoring for research detection | 45cde05 |

## Known Stubs

None. All functions are fully wired and produce real output from Room filesystem data.

## Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| ROOM-01 | Complete | detectRoomType reads State + Section names + Entry content |
| ROOM-02 | Complete | ROOM_TYPE_CONFIG maps each type to all 5 config properties |
| ROOM-03 | Complete | Stats bar renders from roomTypeConfig.statsBar (verified on demo-cancer-room) |
| ROOM-04 | Complete | Section cards use getSectionLabel() (Research Question, Literature Review, etc.) |
| EXTRACT-01 | Complete | scanSection() extracts per-Section: entries, words, Thesis, Claims, spectral |
| EXTRACT-02 | Complete | synthesizeIntelligence() produces Signals, health score, innovation map |
| EXTRACT-03 | Complete | generateNarrative() produces type-adapted Room story + hero text |
