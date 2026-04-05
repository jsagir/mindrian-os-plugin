---
phase: 59
plan: 01
subsystem: core/persona-intelligence
tags: [de-bono, hat-persistence, brain-routing, persona-ops]
dependency_graph:
  requires: [persona-ops.cjs, brain-client.cjs]
  provides: [hat-persistence.cjs, hat-briefing command, hat-aware-recommend]
  affects: [persona-ops.cjs, brain-client.cjs]
tech_stack:
  added: []
  patterns: [filesystem-persistence, lazy-require, sequential-subagent]
key_files:
  created:
    - lib/core/hat-persistence.cjs
    - commands/hat-briefing.md
  modified:
    - lib/core/persona-ops.cjs
    - lib/core/brain-client.cjs
decisions:
  - Hat state persists in room/.mindrian/hats/{color}/ as STATE.md + session-log/ daily files
  - Sequential hat loading (ONE subagent) instead of 6 concurrent agents to respect context budget
  - Blue Hat methodology notes filter ineffective frameworks via regex pattern matching on note text
  - brain-client.cjs (not separate brain-router.cjs) hosts hatAwareRecommend since routing is already there
metrics:
  duration: ~10 minutes
  completed: 2026-04-05
  tasks: 4/4
  files_created: 2
  files_modified: 2
---

# Phase 59 Plan 01: De Bono Persistent Hats Summary

Six perspective personas maintain cross-session memory via room/.mindrian/hats/ filesystem and feed accumulated findings into Brain routing for hat-influenced framework recommendations.

## What Was Built

### 1. hat-persistence.cjs (lib/core/)
Filesystem-backed persistence layer for De Bono hat states. Each hat color gets a directory under `room/.mindrian/hats/{color}/` containing:
- `STATE.md` with frontmatter (current_focus, last_analysis, session_count) and sections (Top Concerns, Top Opportunities, Methodology Notes)
- `session-log/YYYY-MM-DD.md` daily append-only log files with timestamped session entries

API: `loadHatState`, `saveHatState`, `logSession`, `loadAllHatStates`, `getRecentLogs`

### 2. persona-ops.cjs Enhancements
- `invokePersona` now loads persistent hat state and includes it in the return object as `hatState`
- `analyzeAllPerspectives` loads hats sequentially (ONE subagent pattern) and returns `hat_states` map alongside perspectives
- New `persistPersonaFindings` function saves findings to both hat state and session log, rolling top 5 concerns/opportunities

### 3. brain-client.cjs Hat-Aware Routing
New `hatAwareRecommend(roomDir, problemType, options)` function:
- Reads all 6 hat states before querying Brain
- Black Hat concerns boost risk-related framework scores (+10 to Risk Matrix, SWOT, Failure Mode frameworks)
- Yellow Hat opportunities boost HSI/innovation framework scores
- Blue Hat methodology notes filter out frameworks flagged as "ineffective", "didn't work", "not useful"
- Returns frameworks with hat_score, plus hat_influence metadata showing what was boosted/avoided

### 4. /mos:hat-briefing Command
New command that generates a consolidated 6-hat perspective report:
- 6-panel dashboard grid (Body Shape C) with per-hat state summaries
- Synthesis strip identifying key tensions (risk-reward, evidence-intuition, creativity-structure)
- Convergence signals where 2+ hats agree from different angles
- Brain enhancement section using hatAwareRecommend for hat-influenced framework suggestions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] brain-router.cjs does not exist, wired into brain-client.cjs instead**
- **Found during:** Task 3
- **Issue:** Plan referenced `lib/mcp/brain-router.cjs` but no such file exists. Brain routing logic lives in `lib/core/brain-client.cjs`.
- **Fix:** Added `hatAwareRecommend` to brain-client.cjs where Brain query functions already reside.
- **Files modified:** lib/core/brain-client.cjs
- **Commit:** e2b0474

## Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Create hat-persistence.cjs | e1f6f16 |
| 2 | Enhance persona-ops.cjs with hat integration | bebc1ae |
| 3 | Wire hat state into brain-client.cjs | e2b0474 |
| 4 | Create /mos:hat-briefing command | 91939f3 |

## Known Stubs

None. All functions are fully wired with real filesystem I/O and Brain query integration. Hat states start empty and accumulate data organically through persona invocations.

## Self-Check: PASSED

All 4 files verified on disk. All 4 commit hashes verified in git log.
