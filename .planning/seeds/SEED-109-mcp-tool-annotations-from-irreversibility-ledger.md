---
id: SEED-109
status: dormant
priority: MEDIUM
planted: 2026-10-02
planted_during: Phase 267 close-out (plan 267-18)
trigger_when: the next time the MCP tool surface is touched for a host that shows confirmation prompts, or when a host asks for readOnlyHint to skip prompts
scope: small to medium (11 router tools derived mechanically, 31 direct tools read by hand)
related: data/command-irreversibility-ledger.json (Phase 356), lib/mcp/tool-router.cjs, 267-CONTEXT.md Deferred Ideas
---

# SEED-109: Derive MCP tool annotations (destructiveHint, readOnlyHint) from the irreversibility ledger

## What this is

MCP lets a server describe each tool with annotations such as `destructiveHint` and `readOnlyHint`.
Hosts use them to decide how loudly to ask before running a tool. The migrated server publishes none.
Phase 356 already built the hard part for commands: `data/command-irreversibility-ledger.json`
records which commands cannot be undone.

## Why Phase 267 deferred it (so a later session does not re-litigate)

A tool with no annotations keeps the host's defaults, which are the most cautious ones (treated as
possibly destructive, not read-only). So leaving annotations off can never loosen a safety check.
A WRONG `readOnlyHint` can: a host may skip a confirmation for a tool that actually writes. The
migration was already large and one wrong hint would have been a quiet regression, so it was left out
on purpose.

## The shape of the work

1. **Eleven router tools** (`room_state`, `room_content`, `room_graph`, `methodology`, `analysis`,
   `intelligence`, `meeting`, `export`, `orchestration`, `room_bind`, `eureka_critic`): each takes a
   command enum. Derive `destructiveHint` as the OR of the ledger's irreversible flags over every
   command that tool can run. Mechanical, testable against the ledger.
2. **Thirty-one direct tools** (everything else that is not one of the three MCP Apps views): read
   each handler's code. Assert `readOnlyHint: true` only from a code reading that shows no write path,
   never from the tool's name or description.
3. **Three MCP Apps views** render data and do not write; confirm by reading, then annotate.
4. A test that fails when a tool gains a write path but keeps `readOnlyHint: true`.

## Guard rails

- Annotations are hints, not enforcement. Part 8 and the write-path gate (`write_path_enabled`) stay
  the real controls.
- Tool titles were already added in Phase 267; this seed is only the two hints.
- Tri-Polar: check how Claude Code, Desktop and Cowork each react to a changed hint before shipping.
