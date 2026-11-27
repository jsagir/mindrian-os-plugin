---
phase: 402
title: "Efficiency B: lighter runtime"
canon_parts: [3, 8, 9, 11, 12]
status: CONTEXT (EGM elephant step; RESEARCH and DESIGN are beside this file; Goldfish round next, then /gsd-plan-phase)
date: 2026-11-27
method: GSD frame with EGM design step (project CLAUDE.md, owner ruling 2026-11-25)
base_read: worktree /home/jsagi/dev/MindrianOS-Plugin-405, branch work/405-desktop at 142dec60a
rule: this file copies rulings. It makes none. A reviewer may say that the design fails a ruling, never that a ruling is wrong.
---

# Phase 402 CONTEXT

## Scope (ROADMAP.md:4456-4460)

Per-tool alwaysLoad for the hot tools with the rest deferred, with a declared Claude Code floor, checked on the Desktop Code tab and the merged Desktop chat. One JSON object per hook output (K3). Card-fire fix without `continue:false` (K4). Hard cap on session-start output below 10,000 characters (F2). Eureka tools on enable. Hook process consolidation. Opt-in process skills.

Removed from scope by a proven fact: the "preloaded-skill trim". The main-thread Larry agent does not preload its 4 skills, so the trim saves 0 (400.1-RESEARCH.md K1, lines 81-93).

## Owner rulings that bind Phase 402 (LOCKED, copied with source)

### From Phase 400.1 (400.1-CONTEXT.md, "Owner rulings already given")

- R3: "Per-tool alwaysLoad: the 18 hot tools load up front, the rest defer to tool search, after Desktop and Cowork deferral is checked."
- "Brain = Theo (theo-mcp.onrender.com). mindrian-brain.onrender.com and pws-brain-mcp are retired."
- R4 (delete mcp-server-brain/) belongs to Phase 401. Phase 402 does not touch it.

### From Phase 405 (405-CONTEXT.md)

- OR-2 (line 22): MindrianOS must work in three places: the CLI, the Desktop Code tab, the Desktop merged chat. "Optimize" means first-class there.
- OR-6 (line 58) and OR-12 (line 66): the `.mcpb` desktop extension is a third install artifact and a checked release artifact. Consequence for 402: the chat has no `.mcp.json`; a load rule that lives only in `.mcp.json` does not reach the chat.
- OR-9 (line 62): order is 405 foundation, then the overlapping parts of 401 and 402, then 404, then the 405 end slice.
- OR-11 (line 65): "registered rooms only" for writes, everywhere. Consequence for 402: every new 402 test that writes to a room uses the register helper once 405 slice 2 is on main (program C18).
- OR-14 (line 71): the 401 F1 frontmatter fix runs right after the beta.95 cut, before the 405 build.
- OR-15 (line 72): "400.5 owns prompt hooks and runs after 367-11 and 367-12; 402 owns the card-fire false-block fix (K4) and the session-start cap (F2), and those two start now as small plans; 400.3-09 folds into 402."
- OR-16 (line 73): "drop the separate Cowork test L-CW1; add a tool-deferral leg (do tools load on demand in the merged chat) to the 405 Desktop spike session."
- OR-21 (line 78): the Shape F family is the one interaction contract. Consequence for 402: the card-fire fix reads the shape entries of the side file first; the text backstop is the second signal (program 2f, row 402).
- PA-1 (line 49): one wrapper, lib/mcp/graph-catchup-spawn.cjs (367-11). No build on its files before 367-11 and 367-12 are on origin/main. tests/test-367-governed-census.cjs and tests/test-367-catchup-mcp.cjs stay green unchanged.
- PA-2 (line 50): "the GOVERNED 69 / PURE_READ 7 pins move only by the count the 405 plan states, with the reason."
- Standing (line 24): Part 8, Part 9, Part 11, Part 7, the 367 owner rulings.

### From Phase 400.5 (worktree /home/jsagi/dev/MindrianOS-Plugin-4005, 400.5-CONTEXT.md)

- 5e (lines 153-161): Path H is the ruled path. UserPromptSubmit gets one command dispatcher that prints one JSON envelope. The server-tier path (one `mcp_tool` hook, one new MCP tool) is parked and returns only if the load leg fails.
- 5f (line 174): plans 02 to 05 of 400.5 are deferred to the next beta.
- Section 6 (out of scope of 400.5): "Phase 402 keeps hook consolidation for SessionStart, PreCompact, PostCompact, Stop, SessionEnd, PreToolUse, PostToolUse, FileChanged, CwdChanged, SubagentStop and TaskCompleted."

### From Phase 400.3 (400.3-CONTEXT.md)

- D-10 (line 34): no hook and no index call creates or recreates room.db.
- OR-4 (line 54): the arm "busy is reported within 750 ms" stays green.
- 400.3-PROPOSAL.md:96: plan 400.3-09 (the Stop gate wait fits its budget) lands with the Phase 402 card-fire fix.

### Contracts that Phase 405 states for Phase 402 (405-DESIGN.md 3.13, line 248; program 2d)

1. The served instructions (1,999 bytes after 405 slice 7) and the BOUNDARIES paragraph do not change.
2. The tools that the instructions name, the 6 receipt writers and the 3 component tools stay loaded up front (program C3).
3. The tool list of a marked extension process is the same on every machine (program C4).
4. The Part 8 guard hook rows (hooks/hooks.json matcher lines 208 and 332) stay in place and in order.
5. The `.mcp.json` theo-context entry (no alwaysLoad) and the mos-desktop copy of the file are not changed by 402.
6. The 367 runner spawn points in scripts/session-start:135 and scripts/on-stop:56 stay.

### Project rules that bind every slice

- Canon Part 8: no room content to any Brain or Theo server. Phase 402 makes no Brain call.
- Canon Part 11: every invocable surface is born WIRED or EXCLUDED. Phase 402 adds no tool, no command and no agent.
- Canon Part 12: a card-fire block must not put ceremony on screen.
- Three surfaces: each slice states its result on the CLI, the Desktop Code tab and the Desktop chat.
- "A main commit is not live until released." No version bump by hand; `scripts/release.sh` only.
- Hooks and the MCP server stay `.cjs`. No em-dashes. Reuse before build (Part 7).
- Evals run through Jev.

## What the owner has NOT ruled (see 402-DESIGN.md section 12)

1. R3 says 18 hot tools. The 405 contract needs 5 more.
2. The ROADMAP says "Eureka tools on enable". The count pins need a constant tool list.
3. What a host below the Claude Code floor sees.
4. How wide "opt-in process skills" is.

## Evidence to read

- 402-RESEARCH.md (this folder): measured facts with file and line.
- .planning/phases/400.1-efficiency-research-verify-the-2026-11-24-efficiency-finding/400.1-RESEARCH.md: K1 to K9, F1, F2, pitfalls 1 to 6.
- .planning/phases/405-claude-desktop-chat-and-code/401-405-PROGRAM.md: C1, C3, C4, C16, C17, C22, C29; sections 2a, 2b, 2d, 2h.
- .planning/phases/405-claude-desktop-chat-and-code/405-DESIGN.md: 3.0 (places), 3.7 (the `.mcpb`), 3.8, 3.12, 3.13, section 6 (spikes, SP9).
- docs/CLAUDE-SURFACE-MODEL.md.
- .planning/research/2026-11-24-plugin-efficiency/03-mos-runtime-cost.md (the study; numbers are CITED, not re-run, unless 402-RESEARCH says so).
