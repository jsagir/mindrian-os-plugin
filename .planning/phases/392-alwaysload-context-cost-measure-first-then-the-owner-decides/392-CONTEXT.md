# Phase 392 context stub: alwaysLoad context cost

Status: roadmap entry only. Nothing is planned or executed. Opened 2026-11-08 at the owner's request, relayed through the second owner session.

## Rule for this phase
Measure first. No edit to .mcp.json, any tool description, any schema or any budget constant until the owner decides. The phase ends in one choice for the owner: split into a hot-loop server and a deferred long-tail server, or re-baseline the doctor mcp-surface budget to the measured figure.

## Facts handed over by the owner relay (to verify, not trust)
- .mcp.json sets alwaysLoad true on mindrian-os and mindrian-brain.
- Doctor row mcp-surface on this machine: 75 + 6 = 81 tools, about 21,853 tokens, budget 8000.
- The 8000 budget came from Phase 265 plan 23, when mindrian-os measured about 7,062 tokens (about 7,557 in total).
- data/capability-ledger.json (around line 220) calls alwaysLoad a documented trade paid for in Phase 114 and says not to drop it silently.

## The three open questions
1. Token saving of a split: hot-loop server (room_bind, room_list, suggest_next, gate_render, gate_answer, stop_gate_check, status_read, plus the 6 Brain tools) against a deferred long-tail server.
2. Does deferred loading behave the same on Claude Code, Desktop and Cowork (Tri-Polar rule)?
3. Cost of the split: tool-budget gates (test-270, the 384 golden, the 267 snapshots), hooks and commands that name tools, plugin-scoped tool names (Phase 391 card C1 uses mcp__plugin_mos_mindrian-brain__*), release lockstep, Theo's command layer.

## Known related work
Phase 265 plan 23 (the budget), Phase 270 (tool schema budget), Phase 384 S7 (MCP start and tools-list golden), Phase 391 (plugin-scoped tool names).
