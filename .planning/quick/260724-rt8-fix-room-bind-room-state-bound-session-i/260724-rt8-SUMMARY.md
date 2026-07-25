---
phase: quick-260724-rt8
plan: 01
subsystem: mcp-session-binding
tags: [session-binding, stdio-transport, false-success-fix, reuse-before-build]
requires:
  - lib/core/session-binding.cjs (readSessionBinding/writeSessionBinding contract)
  - lib/mcp/tool-router.cjs room_bind's proven 3-tier fallback (extraction source)
provides:
  - resolveEffectiveSessionId(explicitSessionId, extra) shared helper
  - stdio-consistent session-id resolution across all 21 MCP tool call sites
affects:
  - every lib/mcp tool that resolves a per-session write target on the stdio transport
tech-stack:
  added: []
  patterns:
    - single-source precedence helper (Canon Part 7 reuse-before-build)
    - fail-closed null return matching room_bind's no_session_id contract
key-files:
  created:
    - tests/test-resolve-effective-session-id.cjs
  modified:
    - lib/core/session-binding.cjs
    - lib/mcp/tool-router.cjs
    - lib/mcp/tools/room.cjs
    - lib/mcp/tools/gate.cjs
    - lib/mcp/tools/sensors.cjs
    - lib/mcp/tools/chain.cjs
    - lib/mcp/tools/stop-gate.cjs
    - lib/mcp/tools/status.cjs
    - lib/mcp/tools/views.cjs
    - lib/mcp/tools/graph.cjs
decisions:
  - Named the helper resolveEffectiveSessionId (not resolveSessionId) to stay distinct from the 3 pre-existing hook/CLI resolvers (SEED-034, the four-guessers lesson)
  - Helper returns null (not undefined) when nothing resolves; verified equally-falsy at every downstream resolveWriteTargetDir/resolveWriteRoom call site (widening, never narrowing)
metrics:
  duration: ~15m
  completed: 2026-07-25
  tasks: 3
  files: 11
---

# Phase quick-260724-rt8 Plan 01: Fix room_bind/room_state_bound stdio session-id false-success Summary

Extracted room_bind's proven 3-tier session-id fallback (explicit param > `extra.sessionId` > `process.env.CLAUDE_CODE_SESSION_ID` > null) into a single shared `resolveEffectiveSessionId` helper and wired it into all 20 sibling MCP tool call sites that still carried the broken bare `(extra && extra.sessionId) || undefined` pattern, so every tool in a single stdio session now resolves the SAME session id room_bind writes to.

## What Changed

### The shared helper (final signature)

`lib/core/session-binding.cjs`:

```js
function resolveEffectiveSessionId(explicitSessionId, extra) {
  return explicitSessionId || (extra && extra.sessionId) || process.env.CLAUDE_CODE_SESSION_ID || null;
}
```

Exported alongside `readSessionBinding, writeSessionBinding, isSafeSlug, isRoomInWriteScope`. A header comment documents the precedence, the stdio RCA, and the SEED-034 naming rationale.

### The 21 call sites updated (file:line before -> after)

| # | File | Site | Before | After |
|---|------|------|--------|-------|
| 1 | lib/mcp/tool-router.cjs | room_bind (~1478) | `sessionId \|\| (extra && extra.sessionId) \|\| process.env.CLAUDE_CODE_SESSION_ID \|\| null` (4-line inline) | `resolveEffectiveSessionId(sessionId, extra)` |
| 2 | lib/mcp/tool-router.cjs | room_state (610) | `(extra && extra.sessionId) \|\| undefined` | `resolveEffectiveSessionId(undefined, extra)` |
| 3 | lib/mcp/tool-router.cjs | room_content (664) | `(extra && extra.sessionId) \|\| undefined` | `resolveEffectiveSessionId(undefined, extra)` |
| 4 | lib/mcp/tool-router.cjs | eureka-compute (1150) | `(extra && extra.sessionId) \|\| undefined` | `resolveEffectiveSessionId(undefined, extra)` |
| 5 | lib/mcp/tools/room.cjs | 243 | `(extra && extra.sessionId) \|\| undefined` | `resolveEffectiveSessionId(undefined, extra)` |
| 6 | lib/mcp/tools/room.cjs | 269 | `(extra && extra.sessionId) \|\| undefined` | `resolveEffectiveSessionId(undefined, extra)` |
| 7 | lib/mcp/tools/gate.cjs | 139 | `(extra && extra.sessionId) \|\| undefined` | `resolveEffectiveSessionId(undefined, extra)` |
| 8 | lib/mcp/tools/gate.cjs | 193 | `(extra && extra.sessionId) \|\| undefined` | `resolveEffectiveSessionId(undefined, extra)` |
| 9 | lib/mcp/tools/sensors.cjs | 158 | `(extra && extra.sessionId) \|\| undefined` | `resolveEffectiveSessionId(undefined, extra)` |
| 10 | lib/mcp/tools/sensors.cjs | 182 | `(extra && extra.sessionId) \|\| undefined` | `resolveEffectiveSessionId(undefined, extra)` |
| 11 | lib/mcp/tools/sensors.cjs | 198 | `(extra && extra.sessionId) \|\| undefined` | `resolveEffectiveSessionId(undefined, extra)` |
| 12 | lib/mcp/tools/sensors.cjs | 231 | `(extra && extra.sessionId) \|\| undefined` | `resolveEffectiveSessionId(undefined, extra)` |
| 13 | lib/mcp/tools/sensors.cjs | 265 | `(extra && extra.sessionId) \|\| undefined` | `resolveEffectiveSessionId(undefined, extra)` |
| 14 | lib/mcp/tools/chain.cjs | 430 | `(extra && extra.sessionId) \|\| undefined` | `resolveEffectiveSessionId(undefined, extra)` |
| 15 | lib/mcp/tools/stop-gate.cjs | 64 | `(input && input.session_id) \|\| (extra && extra.sessionId) \|\| undefined` | `resolveEffectiveSessionId(input && input.session_id, extra)` |
| 16 | lib/mcp/tools/status.cjs | 129 | `(extra && extra.sessionId) \|\| undefined` | `resolveEffectiveSessionId(undefined, extra)` |
| 17 | lib/mcp/tools/views.cjs | 193 | `(extra && extra.sessionId) \|\| undefined` | `resolveEffectiveSessionId(undefined, extra)` |
| 18 | lib/mcp/tools/views.cjs | 217 | `(extra && extra.sessionId) \|\| undefined` | `resolveEffectiveSessionId(undefined, extra)` |
| 19 | lib/mcp/tools/graph.cjs | 146 | `(extra && extra.sessionId) \|\| undefined` | `resolveEffectiveSessionId(undefined, extra)` |
| 20 | lib/mcp/tools/graph.cjs | 179 | `(extra && extra.sessionId) \|\| undefined` | `resolveEffectiveSessionId(undefined, extra)` |
| 21 | lib/mcp/tools/graph.cjs | 212 | `(extra && extra.sessionId) \|\| undefined` | `resolveEffectiveSessionId(undefined, extra)` |

Each of the 9 files also gained one `require('.../session-binding.cjs')` import for the helper. Line numbers are pre-edit; the require insert shifts each site down by one line post-edit.

## Verification

- `node tests/test-resolve-effective-session-id.cjs` -> ALL PASS (5 precedence legs, including the exact stdio bug scenario in Leg 3).
- `node tests/test-room-bind-stdio-session-fallback.cjs` -> ALL PASS, file unmodified (proves the extraction preserved room_bind's exact observable behavior byte-for-byte).
- `bash tests/run-all-198.sh` -> Passed: 12, Failed: 0, Skipped: 0 (no regression across the MCP-first tool surface).
- Repo-wide sweep: zero bare `(extra && extra.sessionId) || undefined` and zero stop-gate 2-tier `(input && input.session_id) || (extra && extra.sessionId) || undefined` remain anywhere in `lib/mcp/`.
- All 9 touched `.cjs` files load without a syntax/require error (`node -e "require(...)"`).
- No em-dashes introduced in any modified or new file (repo hard rule).

## The 3 unrelated named resolvers were left untouched

Confirmed intact and unmodified (git did not touch these files):

- `scripts/write-scope-check.cjs` (`function resolveSessionId` x1)
- `scripts/intent-classifier.cjs` (`function resolveSessionId` x1)
- `scripts/explain-decision-command.cjs` (`function resolveSessionId` x1)

The new helper uses the distinct name `resolveEffectiveSessionId` precisely so it never collides with or gets confused for these three hook-payload/CLI-script resolvers (SEED-034, the four-guessers lesson).

## Root Cause (for the record)

On the stdio transport (local Claude Code CLI), the MCP SDK never populates `extra.sessionId`. room_bind already carried a proven 3-tier fallback that reached `process.env.CLAUDE_CODE_SESSION_ID`, but its 20 sibling call sites still did the bare `(extra && extra.sessionId) || undefined`, so they silently failed to resolve a session id on stdio and fell through to the wrong machine-wide path. room_bind wrote `session.primary` under the env-derived key while room_state_bound read an unrelated stale room -> the false-success bug. Widening every sibling to the same fallback closes the gap: same session, same resolved id, same per-session binding file.

## Deviations from Plan

None - plan executed exactly as written. All line numbers were grep-confirmed before each edit and matched the plan's grep-confirmed locations.

## Self-Check: PASSED

- Created file exists: tests/test-resolve-effective-session-id.cjs FOUND
- Commit 9a2a6f9c (test/RED) FOUND
- Commit c84e6e75 (feat/helper+tool-router) FOUND
- Commit a7642cfc (feat/room+gate+sensors+chain) FOUND
- Commit ed638312 (feat/stop-gate+status+views+graph) FOUND
