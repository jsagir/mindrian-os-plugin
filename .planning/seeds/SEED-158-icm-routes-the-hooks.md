---
id: SEED-158
title: The room's ICM structure routes the hooks (one prompt hook, the nest declares its checks)
status: promoted as re-scoped (Phase 400.5, 2026-11-26): transport slice only; per-nest routing RETIRED after EGM review (.planning/egm/seed-158/)
planted: 2026-11-26
planted_by: navigator idea in the Phase 400.4 session ("maybe the room's ICM structure can be a hook workflow orchestrator"; "a lot relies on the ICM anyway: the local graph, FeyMinto, the JTBD")
trigger: Phase 402 (hook consolidation) planning, after the mcp_tool UserPromptSubmit spike result (400.4 session, scratchpad mcp-hook-spike) is known
canon_parts: [7, 8, 9, 11]
related: Phase 400.4 QA-F11 part B (plans 12, 13), QA-F12 (plan 14), Phase 402, Key Decision 2 ("the folder structure IS the orchestration"), icm-architect walk test
---

# SEED-158: the room's ICM structure routes the hooks

## The idea
Today `hooks/hooks.json` hard-codes which checks run on every prompt, in every room, for every job (53 hook entries; six separate processes per prompt). Everything else in MindrianOS already routes through the room's ICM layers: the local graph indexes the folders, FeyMinto writes one BRIEF.md per nest, the goal job and the section-job canon key on sections. The hooks are the outlier.

Proposal: ONE UserPromptSubmit entry (ideally an `mcp_tool` hook into the already-running MindrianOS MCP server, if the spike proves the result reaches context; else the plan 13 dispatcher). It resolves the session's bound room and active nest, reads that nest's small routing declaration (ROOM.md frontmatter or BRIEF.md), and runs only the checks the nest declares for its job. A new check is a line in a nest file plus a registered check id, not a new process.

## Why now (evidence from the 2026-11-26 QA run)
Every defect found in the live run is a component that bypassed the room's ICM state and kept its own copy:
- the statusline cue in one global ~/.mindrian/next-move.json shared by all sessions;
- the NAVIGATION DECISION block built for the registry's active room, not the session's room;
- two notions of "job" (per-turn classified intent vs the ratified goal job) never compared;
- six hooks each re-reading the room in their own cold process, killed at 3 s under load.
Routing hooks through the nest makes the room the single source of what runs, where and why.

## Guardrails
- Hot path: per prompt, read one small routing file for the active nest; never walk the room (lesson of the 2.3M-char context pull, QA-F6).
- Routing files point to check ids and never carry payload (icm-architect: routing file without content payload).
- Part 11: check ids are plumbing behind the one hook, not new invocable surfaces; register them in one table with a test that every declared id exists.
- Part 8: local reads only.
- Default set: a nest with no declaration gets today's six checks, so nothing regresses.
- Tri-polar: hooks are CLI only; the same nest declaration can drive what suggest_next surfaces on Desktop and Cowork.

## Open questions
- Does an `mcp_tool` hook result reach the model as context, and does the server stay up across prompts? (spike)
- Where does the declaration live: ROOM.md frontmatter (identity) or BRIEF.md (generated)? icm-architect walk test should decide.
- How a nest declares checks for the Stop and PostToolUse events, or only UserPromptSubmit first.
