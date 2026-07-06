---
created: 2026-07-06T01:00:00.000Z
title: room_content file-opportunity MCP command misroutes to wrong active room + rejects valid JSON payload
area: mcp-tools
version_found: v1.15.3-beta.10
files:
  - mcp server room_content tool implementation (file-opportunity subcommand)
  - lib/core/resolve-active-room.cjs (likely same active-room-source divergence as the birthRoom todo below)
---

## Problem

Found 2026-07-06 while the mos:reverse-salient-agent tried to file 6 real cross-domain
opportunity findings into jhtv-oliver-kuntz's opportunity-bank/ via the room_content MCP
tool's file-opportunity command:

1. The tool resolved "active room" to a DIFFERENT room (one with business-model /
   competitive-analysis / PDAC-investor content), not jhtv-oliver-kuntz -- the room this
   session had explicitly bound via room-registry set-active earlier in the same session.
2. Separately, file-opportunity rejected a JSON-shaped payload outright (schema mismatch,
   not investigated further).

The agent worked around both issues by writing markdown files directly into
~/MindrianRooms/jhtv-oliver-kuntz/opportunity-bank/opp-NNN-slug.md (matching the doe-genesis
room's existing convention) instead of going through the MCP tool.

## Likely related

See 2026-06-28-birthroom-active-room-reverts-next-turn.md -- same shape of bug (an
"active room" pointer diverging from what room-registry set-active / get-active reports).
Worth checking whether room_content reads active-room state from the same stale source that
todo already names, or a third, separate source.

## Impact

Any MCP-tool-mediated filing (not just file-opportunity) may silently write into the wrong
room if this is a systemic active-room-resolution bug, not a file-opportunity-specific one.

## Solution

TBD, not urgent. Candidate directions:
- Trace room_content's active-room resolution path and diff it against room-registry
  get-active / the write-scope-check hook's source.
- Confirm whether file-opportunity's payload schema is genuinely broken or just needs a
  different shape than a plain JSON object (investigate what it does accept).
- Add a regression test: bind an active room mid-session, call file-opportunity, assert the
  write lands in the bound room, not a stale default.
