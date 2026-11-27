---
id: SEED-173
status: planted
planted: 2026-11-27
planted_during: quick 261127-hdl (Claude surface model doctrine; owner card answer 2026-11-27 "Map now, fixes later")
trigger_when: the next phase that touches plugin packaging for claude.ai or Desktop, the Phase 367 Desktop path (plan 11), an MCP room-write tool, .mcp.json, or the surface enum; or the recheck date in docs/CLAUDE-SURFACE-MODEL.md
scope: large
canon_parts: [9, 11]
related: docs/CLAUDE-SURFACE-MODEL.md, .planning/quick/261127-hdl-surface-model-cowork-merged-into-chat/claude-surface-radar.md, ~/MindrianRooms/rethinking-mindrianos/research/2026-11-27-claude-surface-radar/claude-surface-radar.md, .planning/phases/367-newborn-room-graph-connected-no-repair/367-11-PLAN.md, .mcp.json, .claude-plugin/plugin.json, lib/core/memory-ops.cjs, lib/core/research-planner/sr-entry.cjs
---

# SEED-173: fit MindrianOS to the merged cloud chat (product fixes from the surface radar)

## Problem

The plugin was built for three surfaces on the user's own computer: the CLI, Desktop and Cowork. That picture is gone. Chat and Cowork are now one Claude that runs in Anthropic's cloud. Only local Claude Code runs the full plugin. Every other surface has no room, or reaches the room only through the open Desktop app. The doctrine is written in docs/CLAUDE-SURFACE-MODEL.md (quick 261127-hdl). This seed holds the product fixes that quick did not do. No item below is done.

Marks: PROVEN means read in the repo or in the radar. UNVERIFIED means the radar says so.

## Items

### (a) The top-level bin/ blocks a plugin install in chat

- Fact (PROVEN): the platform-support table says a top-level bin/ "Can't be installed" in Chat and Cowork (radar line 77). bin/ holds cli.js, mindrian-mcp-server.cjs, mindrian-brain-mcp-client.cjs, mindrian-mcp-shim.cjs, mindrian-tools.cjs, local-chain-recommender.cjs. UNVERIFIED: no install test on claude.ai was run (radar UNVERIFIED 11).
- Proposed direction: a claude.ai-facing package needs a separate shape (skills plus a remote or bridged MCP server, radar rule 3). Check the mos-desktop marketplace copy against the same table.
- Needs owner ruling: yes (package shape).

### (b) Hooks, agents and local MCP servers are ignored in chat; re-check the Phase 367 Desktop path

- Fact (PROVEN): the Chat column says Ignored for agents, hooks and local MCP servers (radar line 77). A Desktop-config stdio server reached the merged chat as mcp__remote-devices__s1-probe__s1_spawn (spike 012, radar lines 166-168, one machine, one run). UNVERIFIED: which side runs a plugin-bundled stdio server in a merged-chat cloud task (radar UNVERIFIED 2).
- Proposed direction: re-check 367-11-PLAN.md against the device-bridge model before plan 11 runs. The files to check are lib/mcp/graph-catchup-spawn.cjs (the MCP spawn wrapper), lib/mcp/session-room.cjs, and tests/test-367-governed-census.cjs, whose census lists tools "once per surface (CLI, Desktop, Cowork HTTP)".
- Needs owner ruling: no for the re-check; yes if plan 11 changes.

### (c) A room write from a cloud session can report success and not arrive

- Fact (PROVEN, radar line 56): Claude Code 2.1.300 (2026-10-14) fixed Write, Edit and NotebookEdit in Cowork cloud sessions that reported success for a path on the user's computer where the file never arrived.
- Proposed direction: every MCP room write that a bridged session can call confirms with a read-back of the same row or file before it reports ok (radar rule 4; Canon Part 9).
- Needs owner ruling: no for the read-back contract.

### (d) alwaysLoad: true on both servers makes a cloud first turn wait

- Fact (PROVEN): .mcp.json lines 6 and 11 set "alwaysLoad": true on mindrian-os and mindrian-brain. Claude Code 2.1.304 (2026-10-19) lets a cloud first turn skip synced stdio servers unless a server sets alwaysLoad: true (radar line 58). A stdio server in the cloud VM sees the VM disk, not the room.
- Proposed direction: measure the first-turn cost in a cloud session, then decide per server.
- Needs owner ruling: yes (local first-turn tool availability against cloud first-turn wait).

### (e) The 'cowork' label stays as a legacy label for now

- Fact (PROVEN): `git grep -il cowork -- . ':!.planning' ':!CHANGELOG.md' ':!docs/autopsies' | wc -l` printed 819 on 2026-11-27, before docs/CLAUDE-SURFACE-MODEL.md was added. The surface enum 'cli' | 'desktop' | 'cowork' is at lib/core/memory-ops.cjs:572. The frozen list ['cli', 'cowork', 'desktop'] is at lib/core/research-planner/sr-entry.cjs:60.
- Proposed direction: keep 'cowork' as a legacy label (it now means the Desktop chat surface). A rename is a separate, test-backed change with a stored-value migration plan for rows that already hold 'cowork'.
- Needs owner ruling: yes (rename or keep).

### (f) New Projects threads skip repo hooks and .mcp.json

- Fact (PROVEN, radar lines 107-112): a Projects cloud thread loads the repo CLAUDE.md but not the repo .mcp.json servers or the .claude/settings.json hooks. Plugins come from Project settings > Plugins. MCP comes from claude.ai connectors. A local thread through Remote Control (Claude Code 2.1.280 or later) uses local hooks and MCP servers.
- Proposed direction: treat a Projects cloud thread as "no room". Document the Remote Control route for room work.
- Needs owner ruling: no.

### (g) Other doctrine text still names the old three surfaces

- Fact (PROVEN): these lines are out of the scope of quick 261127-hdl and still carry the old model.
  - CLAUDE.md lines 3, 25 and 90 ("Claude Code + Cowork plugin").
  - The CLAUDE.md conventions line "every feature works on all three surfaces". It is generated from .planning/codebase/CONVENTIONS.md line 17 and pinned line for line by tests/test-369-constitution.cjs scenario 3. Change both files together.
  - .planning/PROJECT.md line 409, the generator source of the CLAUDE.md Three surfaces line. A regeneration of the GSD:project block reverts the correction of quick 261127-hdl until this line changes.
  - .planning/PROJECT.md line 5.
  - docs/IDEA-DOCUMENT.md lines 28, 107 and 130.
  - docs/BUSINESS-MODEL-AND-MOAT.md line 70.
- Proposed direction: one doc sweep that points each line to docs/CLAUDE-SURFACE-MODEL.md.
- Needs owner ruling: no.

## Out of scope of this seed

No item here is done by quick 261127-hdl. That quick changed only docs/CLAUDE-SURFACE-MODEL.md, CLAUDE.md, .claude/includes/decisions.md and this seed.
