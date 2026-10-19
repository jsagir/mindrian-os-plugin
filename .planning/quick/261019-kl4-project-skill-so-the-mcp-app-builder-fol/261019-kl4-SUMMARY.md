---
task: 261019-kl4
status: complete
date: 2026-10-19
---
# Project skill so the MCP app builder follows the MindrianOS app pattern

## What landed
- `.claude/skills/mindrian-mcp-app/SKILL.md` (new): the house pattern for every MCP App on the one MindrianOS server. Auto-loads during MCP app work and is named in its description as the file to read before `/mcp-apps:create-mcp-app`.
- `CLAUDE.md`: one row in the Project Skills table.

## Verification
- Every repo path named in the skill exists (shell loop over the path-shaped tokens; the only miss is the placeholder `tests/run-all-<phase>.sh`).
- The live inventory was read from the code: `gateApp.TOOL_META` on `gate_render`, `gate_answer`, `chain_run`; `roomApp.TOOL_META` on `room_list`, `room_create`, `room_startup`; dashboard, wiki and graph registered in `app-views.cjs`.
- No em-dash or en-dash in the two files.
- `connector.excluded: true` with a reason in the skill frontmatter (Part 11 R16: a reference skill with no Decision-Gate fork of its own).

## Not done
- The mcp-apps plugin cache was not edited; it is third-party and overwritten on update. The knowledge lives in this repo only.
