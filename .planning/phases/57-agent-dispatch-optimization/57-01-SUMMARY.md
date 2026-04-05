---
phase: 57
plan: 1
subsystem: agent-dispatch
tags: [optimization, budget, swarm, chain, coordinator]
dependency_graph:
  requires: [model-profiles.cjs, act.md, framework-runner.md]
  provides: [dispatch-optimizer.cjs, budget-aware-swarm, chain-checkpoints, coordinator-schema]
  affects: [commands/act.md, agents/framework-runner.md]
tech_stack:
  added: []
  patterns: [budget-aware-dispatch, dynamic-swarm-sizing, model-downgrade-chain, coordinator-ready-output]
key_files:
  created:
    - lib/core/dispatch-optimizer.cjs
  modified:
    - commands/act.md
    - agents/framework-runner.md
decisions:
  - "Dynamic swarm: N = min(weak_sections, budget / agent_cost), not hardcoded 3"
  - "Model downgrade chain: opus -> sonnet -> haiku at 60% budget threshold"
  - "Chain checkpoints: yes/skip/stop between every step"
  - "Coordinator output is documentation-only JSON schema until feature ships"
  - "Token cost constants are estimates per typical methodology session, not API pricing"
metrics:
  duration: 7 minutes
  completed: "2026-04-05"
  tasks: 3
  files: 3
requirements: [AGENT-01, AGENT-02, AGENT-03, AGENT-04, AGENT-05]
---

# Phase 57 Plan 1: Agent Dispatch Optimization Summary

Budget-aware dispatch optimizer with dynamic swarm sizing, cost estimation before every multi-agent operation, chain checkpoints between pipeline steps, and Coordinator-compatible JSON output schema for framework-runner.

## What Was Built

### Task 1: dispatch-optimizer.cjs (AGENT-01, AGENT-02, AGENT-04)

New core module at `lib/core/dispatch-optimizer.cjs` providing:

- **estimateTokenCost(agentCount, model)** -- calculates total token cost before dispatch with per-model breakdowns (opus: 50K/agent, sonnet: 25K/agent, haiku: 8K/agent)
- **formatCostEstimate(estimate, count)** -- human-readable string like "This will use ~150K tokens (3 agents x Opus)"
- **findWeakSections(roomDir)** -- parses STATE.md for sections with <5 entries, sorted by weakness
- **scaleSwarm(weakSections, contextBudget, agentCost)** -- returns optimal agent count: min(weak_sections, floor(budget * 0.85 / cost))
- **selectModel(agentCount, preferredModel, remainingContext)** -- downgrades opus -> sonnet -> haiku when total cost > 60% of remaining context
- **planDispatch(roomDir, options)** -- full dispatch plan combining all signals, accepts --budget override
- **chainCheckpoint(step, total, completed, next, stats)** -- generates pause prompt between chain steps

CLI interface: `node dispatch-optimizer.cjs <estimate|plan|weak-sections|select-model> [args]`

**Commit:** 96dd183

### Task 2: Enhanced /mos:act Command (AGENT-01, AGENT-02, AGENT-03, AGENT-04)

Updated `commands/act.md` with:

- **--budget flag** -- user-specified max token budget constraining all dispatch decisions
- **Step 4c: Cost Estimation** -- mandatory cost display before any multi-agent dispatch, using dispatch-optimizer.cjs
- **Chain checkpointing** -- between every step, user sees "Continue to step N? (yes / skip / stop)" instead of auto-running the full chain
- **Dynamic swarm sizing** -- replaced hardcoded 3-agent swarm with optimizer-driven N agents based on weak sections and budget
- **Model downgrade display** -- when budget forces a downgrade, the thinking trace shows the reason

**Commit:** dcc5fad

### Task 3: Coordinator-Compatible Output (AGENT-05)

Updated `agents/framework-runner.md` with:

- **JSON schema** for future CLAUDE_CODE_COORDINATOR_MODE worker output
- **Field mapping**: worker_id, worker_type, status, result (maps 1:1 to existing FRAMEWORK_RUNNER_RESULT), chain_output, metrics, coordinator_metadata
- **Parallelization hints**: can_parallelize=true, idempotent=false, side_effects=["filesystem_write"]
- **Migration path**: add --coordinator-output flag when Coordinator ships; text format remains canonical until then

**Commit:** 9598dee

## Decisions Made

1. **Dynamic swarm formula:** N = min(weak_sections, floor(contextBudget * 0.85 / agentCost)). The 0.85 safety margin prevents consuming the entire context window.
2. **Downgrade threshold at 60%:** If total dispatch cost exceeds 60% of remaining context, auto-downgrade. This leaves room for synthesis, user interaction, and post-execution intelligence.
3. **Token cost estimates are approximate:** Based on typical methodology session depth (30K input + 20K output for Opus). Actual usage varies by framework complexity and room context size.
4. **Coordinator schema is documentation-only:** No runtime JSON serialization added. When the feature ships, one flag switches output format. Zero wasted code until then.
5. **Chain checkpoints are mandatory:** No way to skip them in chain mode. Users always control pacing. This prevents runaway token consumption.

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None. All functions are fully implemented with real logic, CLI interface, and tested output.

## Verification

- dispatch-optimizer.cjs loads without errors and all exports are accessible
- estimateTokenCost(3, 'opus') returns "This will use ~150K tokens (3 agents x Opus)" -- matches AGENT-02 requirement
- selectModel correctly downgrades opus -> haiku when budget is tight (100K context)
- scaleSwarm correctly limits to 1 agent when budget only fits 1 (85K usable / 50K per agent)
- chainCheckpoint generates correct pause prompt with yes/skip/stop options

## Self-Check: PASSED

- FOUND: lib/core/dispatch-optimizer.cjs
- FOUND: commands/act.md
- FOUND: agents/framework-runner.md
- FOUND: .planning/phases/57-agent-dispatch-optimization/57-01-SUMMARY.md
- FOUND: commit 96dd183 (dispatch-optimizer.cjs)
- FOUND: commit dcc5fad (act.md enhancements)
- FOUND: commit 9598dee (Coordinator output)
