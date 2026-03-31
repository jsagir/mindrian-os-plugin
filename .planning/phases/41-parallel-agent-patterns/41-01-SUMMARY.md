---
phase: 41
plan: 01
subsystem: commands
tags: [parallel, agents, swarm, persona, grading, research, hsi]
dependency_graph:
  requires: [model-profiles.cjs, framework-runner.md, persona-analyst.md, grading.md, research.md]
  provides: [act-swarm, persona-parallel, grade-full, research-broad, para-05-cross-cascade]
  affects: [commands/act.md, commands/persona.md, commands/grade.md, commands/research.md]
tech_stack:
  patterns: [parallel-agent-dispatch, run_in_background, cross-agent-synthesis, hsi-recomputation]
key_files:
  modified:
    - commands/act.md
    - commands/persona.md
    - commands/grade.md
    - commands/research.md
decisions:
  - "Parallel agents use Agent tool with run_in_background parameter for true concurrency"
  - "Each agent resolves its own model via model-profiles.cjs resolveModel()"
  - "HSI recomputation runs after every parallel dispatch to satisfy PARA-05 cross-cascade"
  - "Persona --parallel gives independent (unbiased) perspectives vs sequential analyze"
metrics:
  completed: 2026-03-31
  tasks: 5
  files: 4
---

# Phase 41 Plan 01: Parallel Agent Patterns Summary

Parallel dispatch flags for 4 core commands enabling simultaneous multi-agent execution with per-agent model resolution and HSI cross-cascade discovery.

## What Was Built

### 1. `/mos:act --swarm` (PARA-01)
Added swarm mode that dispatches 3 framework-runner agents in parallel, each targeting a different high-gap room section. Includes:
- Section gap analysis to identify the 3 weakest sections
- Per-agent model resolution via `resolveModel('framework-runner', roomPath)`
- Thinking trace showing all 3 agent assignments before dispatch
- Cross-agent discovery scan after completion (emergent connections between findings)
- HSI recomputation triggered by parallel filings

### 2. `/mos:persona --parallel` (PARA-02)
Added parallel mode that dispatches 6 persona-analyst agents simultaneously (one per De Bono hat). Includes:
- Independent analysis prevents sequential bias (later hats not influenced by earlier)
- Tension Map synthesis with emergent parallel-only patterns
- Per-agent model resolution via `resolveModel('persona-analyst', roomPath)`
- HSI recomputation when cross-references discovered

### 3. `/mos:grade --full` (PARA-03)
Added full parallel grading mode dispatching up to 8 grading agents (one per room section). Includes:
- REASONING.md verification per section (valid/stale/missing status)
- Cross-section coherence scoring
- Weakest/strongest section identification
- Per-agent model resolution via `resolveModel('grading', roomPath)`
- HSI recomputation after parallel grading

### 4. `/mos:research --broad` (PARA-04)
Added broad parallel research mode dispatching 3 specialized research agents (academic, market, competitor). Includes:
- Cross-angle triangulation identifying validated claims and contradictions
- 3-source validation for high-confidence claims
- Per-agent model resolution via `resolveModel('research', roomPath)`
- User confirmation required before filing combined brief

### 5. Cross-Cascade Emergent Discovery (PARA-05)
All 4 parallel modes include HSI recomputation after parallel filings complete. When multiple agents file artifacts simultaneously, `compute-hsi.py` discovers cross-agent innovation connections (HSI_CONNECTION edges) that would not emerge from sequential single-agent execution.

## Deviations from Plan

### Auto-added (Rule 2): lib/core/model-profiles.cjs and scripts/on-agent-complete references

The plan referenced `lib/core/model-profiles.cjs` (Phase 39 output) and `scripts/on-agent-complete` (Phase 40 output) as existing files. Neither exists yet -- Phases 39 and 40 have not been executed. The command instructions reference `resolveModel()` as a forward dependency. When Phase 39 ships model-profiles.cjs, the parallel commands will resolve models automatically. Until then, agents will use the default model (inherit behavior).

## Tri-Polar Surface Analysis

| Surface | How Parallel Works |
|---------|-------------------|
| **CLI** | Full power -- flags trigger Agent tool dispatch with run_in_background. User sees dispatch status and synthesis report. |
| **Desktop** | Larry describes the parallel analysis in natural language. User says "grade everything" or "research broadly" and Larry runs --full or --broad. |
| **Cowork** | Parallel agents share room state via 00_Context/. Multiple team members can trigger parallel analysis. Results filed to shared room. |

## MWP Moat Deepening

Parallel dispatch deepens 3 of the 7 MWP layers:
- **Layer 3 (Cascade Pipeline):** HSI recomputation after parallel filings creates edges that sequential execution misses
- **Layer 5 (HSI Innovation Discovery):** Cross-agent innovation connections are emergent -- they only appear when multiple perspectives operate independently
- **Layer 6 (Proactive Intelligence Loop):** Parallel persona analysis gives unbiased independent perspectives, strengthening the proactive discovery loop

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 (PARA-01) | 3644f2c | --swarm parallel dispatch for /mos:act |
| 2 (PARA-02) | 9da6827 | --parallel flag for /mos:persona |
| 3 (PARA-03) | 46cd23e | --full parallel grading for /mos:grade |
| 4 (PARA-04) | 4c4e911 | --broad parallel research for /mos:research |

## Self-Check: PASSED

All 4 modified files exist and all 4 commits verified.
