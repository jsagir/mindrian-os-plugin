---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 08
subsystem: ui-shared-core
tags: [ui, shared-core, mcp-client, rxdb, exposure-policy, typescript, wave-1]

requires:
  - phase: 369-01
    provides: erasable-only TypeScript rule, Node floor 22.18
  - phase: 369-04
    provides: hermetic flag-ON daemon helper, fixture rooms, aggregator leg
provides:
  - ui/shared walled ESM package (mos-ui-shared) with six modules, one generator
  - legacy-mode MCP session pool (D-19) and feed relay (D-18)
  - six-collection projection schema and pull-only replica (deliverable 4)
  - action registry with the D-15 exposure policy and the D-14 proposal contract
  - generated internal 1:1 MCP adapter with a drift gate
affects: [369-13, 369-14, 369-15, 369-16, 369-19, bake-off candidates]

tech-stack:
  added: ["@modelcontextprotocol/client 2.3.0", "rxdb 17.5.0", "rxjs 7.8.2", "dexie 4.4.6", "zod 4.6.5 (all in ui/shared only)"]
  patterns:
    - "Erasable TypeScript run directly by Node in tests; type-checked and bundled by the chassis"
    - "Replica takes an injectable storage so Node tests run the real RxDB pull path on memory storage"
    - "Generated adapter from the recorded wire snapshot, --check fails on drift"

key-files:
  created:
    - ui/shared/package.json
    - ui/shared/package-lock.json
    - ui/shared/README.md
    - ui/shared/src/mcp-session-pool.ts
    - ui/shared/src/feed-relay.ts
    - ui/shared/src/projection.ts
    - ui/shared/src/replica.ts
    - ui/shared/src/actions.ts
    - ui/shared/src/proposal.ts
    - ui/shared/scripts/gen-mcp-adapter.mjs
    - ui/shared/src/generated/mcp-adapter.ts
    - tests/test-369-shared-core.cjs
  modified: []

key-decisions:
  - "daemonUrl is a string or a function: the daemon's port changes on restart, so the pool re-reads it on every connect"
  - "room_changes takes a required collection (plan 13), so pageChanges passes collection through and the safety-net poll asks the nodes collection for latest_seq"
  - "Reset removes the database with db.close() then removeRxDatabase(name, storage); onReset fires only after removal"
  - "Hyphenated tool names that clash after camel-casing (room-graph vs room_graph) take a Hyphenated suffix; the reserved-word tool export becomes exportTool"

patterns-established:
  - "toDoc keeps only declared UI fields and normalizes object values to JSON strings, so the projection never mirrors room.db columns"

requirements-completed: [SHELL369-01, RXP369-01, HUM369-01]

duration: 40min
completed: 2026-10-03
---

# Phase 369 Plan 08: Shared shell core Summary

**One walled ESM package, ui/shared, holds the chassis-neutral core: a legacy-mode MCP session pool that survives a daemon restart by re-binding, a feed relay with an SSE hint and a poll net, a six-collection pull-only replica, an exposure-checked action registry, and a generated internal adapter over 45 MCP tools.**

## Accomplishments

- **Session pool (D-19).** `Client` with `versionNegotiation: { mode: 'legacy' }` set explicitly, one per browser session key. A dead session (400 No valid session ID, closed transport, refused connection) closes the client, reconnects, re-binds `boundRoom` and retries once with `reconnected: true`. `adapterSession()` lives under a reserved key that `get()` and `call()` refuse; the live arm proves a distinct mcp-session-id and no inherited binding. Idle sweep closes entries past `idleMs` (30 min contract default).
- **Feed relay (D-18).** `pageChanges` passes `collection, after, epoch, limit, mode, snapshot_cursor` to `room_changes` through the pool and returns `{ ok: false, reason: 'feed_unavailable' }` while the tool is not served (plan 13 not landed; the live arm exercises exactly that). `subscribeHints` reads `GET /event` with a fetch body stream, emits only `room.changed` for the right room, reconnects with 1 s doubling to 15 s backoff, and polls every 2 s as the net.
- **Projection and replica (deliverable 4).** Six collections, `SCHEMAS`, `dbName(roomKey, epoch)` = `mos-<room>-<epoch8>-p1`, `toDoc` (upsert or tombstone), `isResetReason`. `openReplica` runs RxDB on Dexie with leader election and a `room` local document for last visit, one pull replication per collection, `retryTime` 1000, `batchSize` 200, `stream$` emitting `'RESYNC'` on every hint, and no write-back key at all. A reset reason removes the database and calls `onReset`.
- **Actions and proposal (D-15, D-14).** `defineShellAction` refuses a missing or unknown exposure, an empty name, a non-zod input, `adapter: true` and an `mcp.` name; definitions are frozen and the registry accepts only those. `callableBy` returns exactly human-or-both and agent-or-both. `ProposalSchema` refines `recommended_id` to an option id; `fixedProposalSource` validates up front.
- **Generated adapter.** `gen-mcp-adapter.mjs` reads `tests/fixtures/267/wire-snapshot-zod4.json` `local.tools` (45 tools), emits sorted `MCP_TOOL_NAMES`, one args type and one wrapper per tool, no client and no schema. `--check` exits 1 with the first differing line on drift.

## Task Commits

1. Task 1, package, session pool, feed relay: `1f83eaa20`
2. Task 2, projection and replica (plus relay `collection` pass-through): `fb82a785d`
3. Task 3, actions, proposal, generator and output: `07e505846`

## Test Results

- `node tests/test-369-shared-core.cjs`: PASS=13 FAIL=0 (arms 1-9 plus 3b, 4b, 4c, 6b)
  - 6b runs the real RxDB pull path in Node on memory storage: initial pull, a tombstone, a hint-driven tail, last-visit local document, and a checkpoint_expired reset that removes the database and fires `onReset`.
  - 3b runs the relay against a fake event stream and a fake pool: wrong room ignored, partial frame carried, poll fallback fires, no hints after unsubscribe.
  - 4 is the live arm against the hermetic flag-ON daemon, including `restartDaemon`.
- `node ui/shared/scripts/gen-mcp-adapter.mjs --check`: exit 0
- `node tests/test-369-walled-manifest.cjs`: 7 passed, 0 failed (root manifest untouched)
- `node tests/test-369-ts-erasable-gate.cjs`: 8 passed, 0 failed
- Informational: a scratch `tsc --noEmit` (typescript 7.0.2 from tools/ts-check, `erasableSyntaxOnly`, `verbatimModuleSyntax`, strict, DOM lib) over all 7 ui/shared sources reported zero errors. The config lived in the scratchpad, nothing added to the repo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Generated wrapper named like a reserved word**
- **Found during:** Task 3 (arm 1 failed, Node's stripper: "Expected ident")
- **Issue:** the `export` tool produced `export function export(...)`.
- **Fix:** reserved-word set; such tools take a `Tool` suffix (`exportTool`).

**2. [Rule 3 - Blocking] Two tools camel-case to one identifier**
- **Found during:** Task 3 (`Identifier 'roomGraph' has already been declared`)
- **Issue:** `room-graph` (MCP App view) and `room_graph`.
- **Fix:** the hyphenated clash gets a `Hyphenated` suffix on both the function and its args type (`roomGraphHyphenated`).

**3. [Rule 1 - Bug] Relay omitted the collection argument**
- **Found during:** Task 2, reading plan 13 (room_changes requires `collection`)
- **Fix:** `pageChanges` forwards `collection`; the safety-net poll asks `nodes` for the room-wide `latest_seq`. Committed with Task 2.

### Notes (not deviations)

- `npm install --save-exact @modelcontextprotocol/client@^2.1.0` resolved to 2.3.0 (inside the audited range). The root tree stays on 2.1.0 and the daemon on the 2.1.0 server; the live arm passes cross-version. Plan 13 or 23 should keep that pairing in view.
- `369-SESSION-CONTRACT.md` was not on disk (plan 07); I followed RESEARCH Pattern 5 and D-19 as the plan allows.
- The `ChangeRow` shape follows plan 13's documented row (`seq, entity_type, entity_id, op, revision, doc?`); `toDoc` also accepts `operation` and `entity_revision`. If plan 13 lands different field names, `toDoc` is the one place to adjust.
- `room` collection: nothing in the feed serves it (plan 13 says the shell composes it); `openReplica` replicates all six uniformly through `fetchPage`, so the caller's `fetchPage('room', ...)` answers it.

## Known Stubs

None. `room_changes` is not served until plan 13; the relay's `feed_unavailable` answer is the specified behavior, not a stub.

## Threat Flags

None. Threat register T-369-08-01 through -05 and -SC mitigated as planned: explicit legacy mode with a static no-auto arm, reserved adapter key plus distinct-session live arm, exposure refusal arms, no write-back key, no dev plugin and 127.0.0.1-only URL literals (static arm), exact pins with `--ignore-scripts`.

## Self-Check: PASSED

- FOUND: all 12 files listed under key-files.created
- FOUND commits: 1f83eaa20, fb82a785d, 07e505846
