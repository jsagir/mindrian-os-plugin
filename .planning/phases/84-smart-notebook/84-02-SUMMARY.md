---
phase: "84"
plan: "02"
subsystem: memory-composition
tags: [smart-notebook, sqlite, composition, additive]
requires: [84-01]
provides: [openRoomDb, closeRoomDb, lib/core/room-db.cjs]
affects: []
tech-stack:
  added: []
  patterns: [composition-module-over-modification, shared-db-handle]
key-files:
  created:
    - lib/core/room-db.cjs
    - .planning/phases/84-smart-notebook/84-02-SUMMARY.md
  modified: []
decisions:
  - "New file lib/core/room-db.cjs rather than modifying lazygraph-ops.cjs, keeping Phase 81/82/83 surface byte-identical and making rollback a single-file delete"
  - "closeRoomDb accepts either {db,conn} handle or bare db for forward compatibility"
metrics:
  duration: ~4min
  completed: 2026-04-14
---

# Phase 84 Plan 02: Wire memory-ops into openGraph via room-db.cjs Summary

New composition module `lib/core/room-db.cjs` (57 lines) exports `openRoomDb(roomDir)` which calls `lazygraph.openGraph()` and then `memory.initMemorySchema()` on the same better-sqlite3 handle. Result: a single call yields a db with all 9 memory tables plus the lazygraph nodes/edges tables ready to use. `lazygraph-ops.cjs` and `memory-ops.cjs` are byte-identical, so the 14 existing openGraph consumers are unaffected.

## What Changed

- Created `lib/core/room-db.cjs` with `openRoomDb(roomDir)` and `closeRoomDb(handle)` exports.
- `openRoomDb` awaits `lazygraph.openGraph(roomDir)` (which returns `{db, conn}` where db === conn), then calls `memory.initMemorySchema(handle.db)`, then returns the same handle. Both schema initializers use CREATE IF NOT EXISTS so repeat calls are safe.
- `closeRoomDb` unwraps either a `{db}` handle or a bare db and delegates to `lazygraph.closeGraph`.

## What Was NOT Touched

- `lib/core/lazygraph-ops.cjs` byte-identical (verified via `git diff HEAD~1 HEAD -- lib/core/lazygraph-ops.cjs` returning empty).
- `lib/core/memory-ops.cjs` byte-identical (84-01 shipped it; no changes in this plan).
- All existing openGraph consumers (session-start hook, analyze-room, discovery scripts, etc.) - migration is deferred to 84-03 and later plans.
- No edits to any scaffold-loader, voice-retrieval, hooks, or commands.

## Verification Results

| Check | Expected | Actual |
|---|---|---|
| `lib/core/room-db.cjs` exists | yes | yes (57 lines) |
| `typeof openRoomDb / closeRoomDb` | function function | function function |
| `git diff HEAD~1 HEAD -- lib/core/lazygraph-ops.cjs` | empty | empty |
| `git diff HEAD~1 HEAD -- lib/core/memory-ops.cjs` | empty | empty |
| Smoke test table list (fresh dir) | 9 memory tables + nodes + edges | assumptions, decisions_index, edges, facts, fragments, held_contradictions, identity, nodes, scaffold_log, sessions, sqlite_sequence, voice_log |
| Idempotent (call twice) | no error | OK |
| Em-dashes in new file | 0 | 0 |

Smoke test command used:
```
node -e "(async () => { const {openRoomDb, closeRoomDb} = require('./lib/core/room-db.cjs'); const h = await openRoomDb('/tmp/test-room-84-02'); const tables = h.db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name\").all(); console.log('TABLES:', tables.map(t=>t.name).join(',')); const h2 = await openRoomDb('/tmp/test-room-84-02'); console.log('idempotent OK'); await closeRoomDb(h2); })()"
```

## Deviations from Plan

None. Plan executed exactly as written. The pre-commit hook auto-updated `.planning/STATE.md`, `.planning/ROADMAP.md`, and `.planning/REQUIREMENTS.md` (timestamp/progress recompute) which is expected hook behavior.

## Decisions Made

- **Composition over modification.** Ships as a new file per the plan's D-02 rationale: preserves rollback safety (`rm lib/core/room-db.cjs` is the full undo) and keeps phase-81/82/83 callers byte-identical.
- **closeRoomDb accepts handle or bare db.** Future consumers may pass either shape; the unwrap is trivial and prevents a second breaking change when 84-03+ migrate callers.

## Known Stubs

None introduced by this plan. Stubs from 84-01 (voice_log schema, held_contradictions write path) remain as documented there.

## Self-Check: PASSED

- FOUND: /home/jsagi/MindrianOS-Plugin/lib/core/room-db.cjs
- FOUND: /home/jsagi/MindrianOS-Plugin/.planning/phases/84-smart-notebook/84-02-SUMMARY.md
- FOUND: commit 8011d9a (feat(84-02): add room-db.cjs composition module for lazygraph + memory)
- VERIFIED byte-identical: lib/core/lazygraph-ops.cjs (git diff empty)
- VERIFIED byte-identical: lib/core/memory-ops.cjs (git diff empty)
