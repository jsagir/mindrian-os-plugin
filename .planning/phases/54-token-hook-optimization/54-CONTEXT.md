# Phase 54: Token + Hook Optimization - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase, discuss skipped)

<domain>
## Phase Boundary

Halve per-turn token cost via native-first skill compression and progressive loading. Make intelligence cascade efficient with debouncing, caching, and batching.

Requirements: TOKEN-01 through TOKEN-06, HOOK-01 through HOOK-05

</domain>

<decisions>
## Implementation Decisions

### Skill Compression (TOKEN-01, TOKEN-02)
- Native-first: remove tool usage instructions from skills (Claude already knows Read, Write, WebSearch, Agent)
- Compress ui-system SKILL.md from ~28K to ~8K bytes: keep rules, remove examples and edge-case descriptions
- larry-personality: trim examples, keep voice rules and mode engine (~500 token savings)
- pws-methodology: remove MCP tool references, keep routing table
- context-engine: remove threshold tables Claude already manages

### Progressive Loading (TOKEN-03, TOKEN-04, TOKEN-05)
- Defer room-proactive + room-passive until room/ directory exists in settings.json conditional activation
- Defer brain-connector until Brain key detected (MINDRIAN_BRAIN_KEY env or .mcp.json)
- Layer 0 (always, ~9K tokens): Larry personality + UI rules (compressed) + methodology routing
- Layer 1 (on-demand): full skill content loaded via Skill tool invocation
- Layer 2 (Brain power-up): brain-connector loaded when Brain detected

### Hook Optimization (HOOK-01 through HOOK-05)
- HSI debounce: skip recompute if same file written within 30s (timestamp check in intelligence-cascade.cjs)
- Analyze-room cache: hash STATE.md content, skip if hash unchanged within 5-min TTL
- Write batching: queue writes in intelligence-cascade.cjs, single HSI compute per batch (use 500ms debounce window)
- Bridge file per-room: move from /tmp/mindrian-* to ~/.mindrian/bridge/{room-hash}.json
- Framework recommendation cache: Map keyed by (room_path + STATE.md hash), 10-min TTL, in brain-router.cjs

### Claude's Discretion
All implementation details at Claude's discretion.

</decisions>

<code_context>
## Existing Code Insights

### Files to Modify
- skills/ui-system/SKILL.md (~28K bytes -> ~8K target)
- skills/larry-personality/SKILL.md (trim examples)
- skills/room-proactive/SKILL.md (add conditional gate)
- skills/room-passive/SKILL.md (add conditional gate)
- skills/brain-connector/SKILL.md (add conditional gate)
- skills/pws-methodology/SKILL.md (remove MCP refs)
- skills/context-engine/SKILL.md (remove threshold tables)
- settings.json (conditional skill activation)
- lib/core/intelligence-cascade.cjs (add debounce, batch, cache)
- lib/mcp/brain-router.cjs (add framework cache)
- hooks/scripts/session-start (bridge file path)

### Canonical References
- references/research/RESEARCH_15_V1.8_OPTIMIZATION_JTBD.md -- full optimization analysis
- references/research/RESEARCH_16_NATIVE_FIRST_PLUGIN_ARCHITECTURE.md -- native-first architecture

</code_context>

<specifics>
## Specific Ideas

Per RESEARCH_15: Target ~10K tokens per turn for fresh install (down from ~20.5K).
Per RESEARCH_16: Skills should teach only what Claude can't already do.

</specifics>

<deferred>
## Deferred Ideas

- MCP session profiles (learn/think/build/research/present/full) -- Phase 55 Context Intelligence
- User archetype detection -- Phase 55
- Autocompact tuning per user type -- Phase 55

</deferred>
