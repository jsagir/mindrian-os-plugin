---
phase: 405
kind: six-hats lens (De Bono), read-only analysis of the 405 evidence
date: 2026-11-27
note: "/mos:hat-briefing on rethinking-mindrianos returned no saved hat states (session_count 0 for all six); this fresh pass replaces it. No code was read by this pass; repo claims come from the docs."
---

# Phase 405 six-hats pass

## The 3 questions the design must answer
1. On the merged chat, where does the room server process run, and how does each write prove that it reached room.db on the user's disk?
2. With no hooks in chat, what triggers the graph write: the tool call itself, a detached runner, or both? How does that retarget 367 plan 11 without a second runner?
3. What does a cloud surface with no room (a Projects thread, a cloud Code session, the chat with Desktop closed) do so that it is first-class and honest, within two install copies?

## Convergence (2+ hats)
- Black, Yellow, Blue: the spike 012 detached runner is the right target for 367 plan 11; coordinate with jsagi-42.
- Black, Green, Blue: every room write on a non-CLI surface needs a read-back receipt.
- Red, Black, Green: the hand edit of claude_desktop_config.json and the 11-26 s cold self-install (369.1:54) are the main install friction; a .mcpb desktop extension is the strongest candidate.
- White, Black, Blue: radar UNVERIFIED items 2 (where a plugin stdio server runs in a cloud task) and 4 (quit mid-tool-call) must be spiked before the design.
- Red, Black: surface naming is out of date (367-CONTEXT:35 says "Desktop and Cowork (MCP only, no hooks)", but the local Code tab has hooks).

## Key tensions
- Invisible capture vs unconfirmed writes (Part 9).
- Bridge proven on 1 Windows machine only; tool prefix has no primary source; Desktop install has no log proof (369.1:59).
- OR-2 "first-class" vs cloud threads that can never see the room: first-class there = typed "no room here" plus a one-step route back.
- CLAUDE.md "without surface-specific code" vs the need for a chat-facing package shape.

## Blue: order of work
1. S1: where a plugin-bundled stdio server runs in a merged-chat cloud task; quit mid-tool-call; which column (Chat or Cowork) the merged chat follows.
2. S2: a bridged room write with read-back, incl. a forced failure.
3. S3 with the Phase 402 owner: alwaysLoad on cloud sessions; typed "no room on this surface".
4. Coordinate with jsagi-42: retarget 367 plan 11 to the detached runner; fix the 367 surface line.
5. Package shape: .mcpb or config entry, plus MCP-only capture; keep two install copies; fix per-session room binding (SEED-039).
6. Website hand-off after the release cut.

## Green alternatives
.mcpb room server; MCP-only capture inside each governed tool call with a read-back receipt; detached runner daemon from the bridged server (fix 369.1 WR-13, WR-15 first); Remote Control as the bridge; remote connector (ranked last; needs an owner ruling, Part 9 risk).

## Red: friction
Installed but no room tools in chat (369.1:59); 11-26 s "installing" at first contact; TTO manager sees no room in cloud threads and must keep the app open; no background capture in chat; old three-name surface wording.
