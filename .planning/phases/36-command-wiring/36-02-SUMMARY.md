---
phase: 36-command-wiring
plan: 02
subsystem: commands
tags: [commands, speakers, reanalyze, graph, wiring]
dependency_graph:
  requires: [scripts/create-speaker-profile, scripts/compute-meetings-intelligence, lib/core/lazygraph-ops.cjs]
  provides: [/mos:speakers, /mos:reanalyze, /mos:graph]
  affects: [commands/]
tech_stack:
  added: []
  patterns: [command-markdown, body-shape-C, body-shape-E, 3-line-error, natural-language-first]
key_files:
  created:
    - commands/speakers.md
    - commands/reanalyze.md
    - commands/graph.md
  modified: []
decisions:
  - "Room Card (Body Shape C) for speakers and graph results; Action Report (Body Shape E) for reanalyze delta"
  - "Node -e inline scripts for lazygraph-ops.cjs access in graph command"
  - "Before/after delta capture for reanalyze intelligence comparison"
metrics:
  duration: 2min
  completed: 2026-03-31
  tasks: 3
  files: 3
---

# Phase 36 Plan 02: Speakers, Reanalyze, Graph Command Wiring Summary

Three markdown command files wiring /mos:speakers, /mos:reanalyze, and /mos:graph to existing meeting and graph infrastructure with natural-language-first presentation.

## What Was Done

### Task 1: /mos:speakers (WIRE-03)
- Created `commands/speakers.md` wiring to `room/team/` speaker profiles
- Body Shape C (Room Card) format for each speaker with role, expertise, meeting count
- Pre-flight check for `room/team/` existence with 3-line error
- Natural language framing by Larry with action footer
- **Commit:** 4fa4dd4

### Task 2: /mos:reanalyze (WIRE-04)
- Created `commands/reanalyze.md` wiring to `scripts/compute-meetings-intelligence`
- Body Shape E (Action Report) with before/after delta comparison
- Captures pre-run MEETINGS-INTELLIGENCE.md state for comparison
- Pre-flight check for `room/meetings/` with 3-line error
- **Commit:** f493f2b

### Task 3: /mos:graph (WIRE-05)
- Created `commands/graph.md` wiring to `lib/core/lazygraph-ops.cjs`
- Natural language query translation with Cypher query guide
- Graph stats on first invocation, Room Card results for queries
- Pre-flight check for `room/.lazygraph/` with 3-line error
- **Commit:** c8a4ad3

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all three commands wire to existing, functional infrastructure.

## Self-Check: PASSED
