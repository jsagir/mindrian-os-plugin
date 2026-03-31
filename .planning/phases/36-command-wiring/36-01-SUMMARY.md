---
phase: 36-command-wiring
plan: 01
subsystem: commands
tags: [command-wiring, presentation, dashboard, graph]
dependency_graph:
  requires: [scripts/generate-presentation.cjs, scripts/serve-presentation]
  provides: [commands/present.md, commands/dashboard.md]
  affects: [user-facing-commands]
tech_stack:
  added: []
  patterns: [4-zone-ui-anatomy, 3-line-error-pattern, natural-language-first]
key_files:
  created:
    - commands/present.md
    - commands/dashboard.md
  modified: []
decisions:
  - "Both commands follow splash.md/onboard.md pattern with YAML frontmatter"
  - "dashboard.md checks both graph.html and .lazygraph/ for pre-flight validation"
  - "present.md wires two scripts sequentially: generate then serve"
metrics:
  duration: 2min
  completed: 2026-03-31
---

# Phase 36 Plan 01: Present and Dashboard Command Wiring Summary

Two slash commands wiring /mos:present and /mos:dashboard to existing presentation infrastructure with 4-zone UI anatomy and natural-language-first framing.

## What Was Done

### Task 1: /mos:present command (WIRE-01)
**Commit:** 9cf62d7

Created commands/present.md that:
- Runs pre-flight check for room/ existence
- Calls generate-presentation.cjs to build all 6 HTML views
- Calls serve-presentation to open in browser
- Reports results as value (what user gets, not technical output)
- 3-line error patterns for missing room, generation failure, and server failure
- Action footer suggesting /mos:dashboard and natural language alternatives

### Task 2: /mos:dashboard command (WIRE-02)
**Commit:** f036fd0

Created commands/dashboard.md that:
- Checks for graph.html or .lazygraph/ directory existence
- Calls serve-presentation to open graph view
- Natural language framing of the knowledge graph visualization
- 3-line error patterns for missing graph data and missing presentation
- Action footer suggesting /mos:present and /mos:graph

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - both commands wire to existing, functional scripts.

## Self-Check: PASSED
