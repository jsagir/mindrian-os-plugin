# Phase 369: UI shell over the MindrianOS MCP server - Pattern Map

**Mapped:** 2026-10-02
**Files analyzed:** 27 (new + modified)
**Analogs found:** 24 / 27

House rules for every excerpt-derived file: hyphens only (never an em-dash), CJS for anything a hook or `lib/` caller requires (D-17 lifts TS only inside the walled-off packages and, later, shape-(a) `.ts` in lib/core), Canon Part 8 (zero Brain/network tokens in lib/mcp feed code), Canon Part 9 (all room.db access through `lib/core/navigation.cjs` exports; `lib/mcp/*` may never require `room-db.cjs` or `node:sqlite`).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/mcp/tools/feed.cjs` (NEW, `room_changes`) | MCP tool module | request-response (read) | `lib/mcp/tools/status.cjs` | exact |
| `lib/mcp/room-watcher.cjs` (NEW) | service (daemon-side watcher) | event-driven | `.planning/spikes/006-room-pull-checkpoint/stages/01_pull-server/server.cjs` 176-257 + `lib/mcp/sse-event-bus.cjs` | partial (spike) |
| `lib/mcp/sse-event-bus.cjs` (MOD, append `room.changed`) | utility (pub-sub) | pub-sub | itself, line 15 | exact |
| `lib/mcp/gate-ledger.cjs` (MOD, consume-after-checks, Phase 289) | service | request-response | itself, `consumeGate` 97-106 | exact |
| `lib/mcp/tools/gate.cjs` (MOD, human-only `gate_answer`, exposure policy) | MCP tool module | request-response | itself, 287-301, 344+ | exact |
| `lib/core/navigation/room-change-log.cjs` (NEW: DDL, triggers, epoch/floor, `withRoomTx`) | model / migration-like installer | CRUD (write door) | `lib/core/migrations/phase-224-edge-review-status.cjs` + `lib/core/frame-provenance.cjs:439-440` | role-match |
| `lib/core/navigation/room-projection.cjs` (NEW) | model (read projection) | CRUD read | `lib/core/navigation/spine-events.cjs:523-535` (`openRoomDbReadOnlyForCaller`) | role-match |
| `lib/core/room-db.cjs` (MOD, call installer after migrations) | config / bootstrap | CRUD | itself, 296-318 | exact |
| `lib/core/navigation/transitions.cjs:256`, `focus.cjs:50`, `file-evidence-readback.cjs:80`, `room-discard-cascade.cjs:99`, `ambient-run.cjs:573`, `lazygraph-ops.cjs:626,732`, `breakthrough/schema.cjs:117` (MOD, adopt `owns` idiom) | model | CRUD tx | `lib/core/frame-provenance.cjs:439-450` | exact |
| `lib/core/node-insert.cjs` (no code change expected; trigger covers N1; test only) | model | CRUD | - | n/a |
| `.planning/phases/108-graph-memory-schema-reconciliation/aliases.yml` (MOD, register `room_change_log`, `room_tx_context`) | config | - | itself | exact |
| `.planning/codebase/CONVENTIONS.md:5`, `.planning/research/STACK.md`, `.planning/spikes/CONVENTIONS.md:8`, `CLAUDE.md` (MOD, D-17 constitution) | config / docs | - | themselves | exact |
| `package.json` (MOD: `engines` 59-61, `files` 14-39) | config | - | itself (`!lib/wiki/editor-src` precedent at 26) | exact |
| `tests/test-236-engines-floor.cjs` (MOD: `EXPECTED_FLOOR`) | test | - | itself 42-46 | exact |
| `tools/ts-check/` (NEW: package.json, lockfile, tsconfig.core.json, gate script) | config / walled-off package | batch | `lib/wiki/editor-src/package.json` + `build.cjs` | role-match |
| `scripts/release.sh` (MOD: ts-check gate, UI dist freshness gate) | config / release | batch | itself, Step 2.4 at 481-532 | exact |
| `ui/shell/` (NEW walled-off package, winner) | component tree | request-response + streaming | `lib/wiki/editor-src` (walling) + `.planning/spikes/007-agent-native-wraps-mcp/stages/02_actions/overlay` | role-match |
| `ui/shared/` (feed client, RxDB schema, legacy MCP client, Claude adapter) | service (client) | streaming / pull | `.planning/spikes/006-room-pull-checkpoint/stages/02_browser-replica/src` + `tests/test-267-mcpv2-flag-on.cjs` client usage | partial |
| `ui/bakeoff/measure.cjs` + setup scripts | utility / harness | batch | `.planning/spikes/007-agent-native-wraps-mcp/stages/01_scaffold/setup.sh`, `03_click-test/run.cjs` | role-match |
| `lib/ui-shell/dist/` (NEW shipped assets) | build output | file-I/O | `lib/wiki/editor-dist/` | exact |
| `tests/run-all-369.sh` | test aggregator | batch | `tests/run-all-267.sh` | exact |
| `tests/helpers/mcp-daemon-369.cjs` | test helper | request-response | `tests/test-267-mcpv2-flag-on.cjs:100-148` + `tests/helpers/mcp-wire-267.cjs:59-80` | exact |
| `tests/fixtures/369/` (writer-inventory.json, fixture room builder) | test fixture | - | `tests/helpers/fixture-room-365.cjs` | exact |
| `tests/test-369-*.cjs` | test | various | `tests/test-236-engines-floor.cjs` harness (48-66) | exact |
| `tests/test-369-sse-vocab-pin.cjs` | test | - | none pins vocab today | role-match (harness only) |
| `tests/e2e-369/` (Playwright) | e2e test | request-response | spike 006 `stages/03_probe/*.cjs`, spike 007 `03_click-test/run.cjs` | partial |
| Baseline refresh: `tests/fixtures/267/wire-snapshot-zod4.json`, `tests/test-267-mcpv2-cirs-gates.cjs`, `data/mcp-tool-connectors.json`, `tests/test-270-tool-schema-budget.cjs` | test fixtures | - | regenerate (`node scripts/build-connector-registry.cjs`) | exact |

## Pattern Assignments

### `lib/mcp/tools/feed.cjs` (MCP tool module, read)

**Analog:** `lib/mcp/tools/status.cjs` (auto-discovered: `lib/mcp/register-core-tools.cjs:77-107` sorted readdir of `tools/*.cjs`, calls `mod.register(server, safeCtx)`; no router edit).

**Header + imports** (status.cjs 26-39): header comment states Canon Part 8 and Part 11 disjoint-file contract; then
```js
const { z } = require('zod');
const sseEventBus = require('../sse-event-bus.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { resolveSessionRoomDir, resolveMcpSessionRoom, describeRoomBinding } = require('../session-room.cjs');
```
Feed adds `require('../../core/navigation.cjs')` for `openRoomDbReadOnlyForCaller` / `closeRoomDbForCaller` and the new projection reader. Never require `room-db.cjs` or `node:sqlite`.

**Response helper** (status.cjs 57-61):
```js
function textResponse(payload, isError) {
  const result = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  if (isError) result.isError = true;
  return result;
}
```

**Room resolution + body** (status.cjs ~140-190): `resolveEffectiveSessionId(undefined, extra)` then `resolveMcpSessionRoom({sessionId, ctx})`, use `roomResolution.dir`. Lazy-require anything that would cycle with `register-core-tools.cjs` inside the handler (status.cjs 154-174 comment).

**Read door** (`lib/core/navigation/spine-events.cjs:523-535`): returns null when the db is absent; caller closes in `finally` via `closeRoomDbForCaller` (466-472). Absent `room_change_log` -> `{ok:false, reason:'change_log_absent', snapshot_required:true}` (RESEARCH Pattern 3).

**Connectors export** (status.cjs 192-210), copy shape:
```js
const connectors = [{
  tool: 'room_changes', surface: 'room_changes', connector: 'mcp-tool',
  hitl_shape: 'none', hitl_why: 'Pure read: ...',
  layer: '...', layer_why: '...',
}];
module.exports = { register, connectors, _internal: { /* pure helpers for tests */ } };
```
Then `node scripts/build-connector-registry.cjs` (never hand-edit `data/mcp-tool-connectors.json`), refresh the 267 wire snapshot (tool count 45 -> 46), the CIRS baseline, and record bytes in `tests/test-270-tool-schema-budget.cjs` 260-325. Do not touch server instructions (1984 / 2048 bytes).

---

### `lib/mcp/sse-event-bus.cjs` (MOD)

**Line 15 today:**
```js
const EVENT_KINDS = Object.freeze(['status-segment', 'gate-fired', 'reconcile-raised']);
```
Append `'room.changed'` last (header 7-11: additive-only, never rename/remove). `publish()` 76-79 silently drops unknown kinds, so the append is required before the watcher publishes. Exports at 98: `{ EVENT_KINDS, publish, subscribe }`. Publish site pattern: `sseEventBus.publish('status-segment', segments)` (status.cjs 179) -> `sseEventBus.publish('room.changed', { roomId, latestSeq })`.

---

### `lib/mcp/room-watcher.cjs` (NEW, event-driven)

**Analog:** spike 006 `stages/01_pull-server/server.cjs` 176-257 (fs.watch on `.mindrian/`, filter names starting `room.db`, `PRAGMA data_version` gate on ONE long-lived read-only connection, 500 ms poll net). Production pieces to reuse: open the long-lived handle with `navigation.openRoomDbReadOnlyForCaller` (never `node:sqlite` directly from lib/mcp), publish via `sse-event-bus.publish`. Never-throw style matches `sse-event-bus.cjs` (every branch try/catch, refusal not throw). Lazy start per room on first `room_changes` call; idle stop.

---

### `lib/mcp/gate-ledger.cjs` (MOD, Phase 289 consume-after-checks)

**Current** (97-106) deletes before checks:
```js
function consumeGate(gateId, sessionId) {
  const entry = _ledger.get(gateId);
  if (!entry) return null;
  _ledger.delete(gateId); // single-use: consumed whether or not the verdict below holds
  if (Date.now() - entry.mintedAt > LEDGER_TTL_MS) return null;
  if (entry.sessionKey !== ledgerSessionKey(sessionId)) {
    return { ok: false, reason: 'session_mismatch' };
  }
  return entry;
}
```
Change per D-16: move the `delete` after the TTL and session checks (a mismatched session must not cancel the gate). Keep `ledgerSessionKey` (47) and the exported names at ~136. Callers in `lib/mcp/tools/gate.cjs:287-301` are thin wrappers; human-only rule + render nonce land in the `gate_answer` handler (registered in `register` at 344+), alongside the existing human-attribution guard (comment at 190, `navigation.resolveByUser(roomDir)` at 213).

---

### `lib/core/navigation/room-change-log.cjs` (NEW: DDL + triggers + epoch + tx helper)

**Analog A, sentinel-idempotent installer:** `lib/core/migrations/phase-224-edge-review-status.cjs` 66-87:
```js
function runMigration(db) {
  if (sentinelPresent(db)) return { applied: false };
  db.exec('BEGIN');
  try {
    if (!reviewStatusColumnPresent(db)) { db.exec('ALTER TABLE ...'); }
    const nowIso = new Date().toISOString();
    db.prepare('INSERT OR REPLACE INTO identity (key, value, updated_at) VALUES (?, ?, ?)')
      .run(SENTINEL_KEY, nowIso, nowIso);
    db.exec('COMMIT');
  } catch (err) { db.exec('ROLLBACK'); throw err; }
  return { applied: true };
}
module.exports = { runMigration, SENTINEL_KEY };
```
Difference: the trigger install must run on EVERY write-door open (triggers drop with a table rebuild, Pitfall 6), so use `IF NOT EXISTS` DDL unconditionally and the sentinel only for minting `change_log_epoch` in `identity` (RESEARCH Code Example "Trigger install", lines 1002-1010). No JSON functions in triggers (Python writer). Describe DDL so the Phase 108 drift guard passes (register in aliases.yml, Pitfall 15).

**Analog B, the `owns` tx idiom** (`lib/core/frame-provenance.cjs:439-450`):
```js
const owns = db.isTransaction !== true;
if (owns) db.exec('BEGIN IMMEDIATE');
try {
  ...
  if (owns) db.exec('ROLLBACK'); // on early refusal
```
`withRoomTx(db, fn)`: same idiom, set `room_tx_context.tx`, run, clear, `COMMIT` if owns. Apply the same idiom to the unconditional-BEGIN writers listed in the classification table.

**Wiring site** (`lib/core/room-db.cjs:296-318`): migrations chain ends with `runPhase224EdgeReviewStatus(db);` at 318, inside the try that closes the handle on failure. Add the installer call immediately after, with a comment in the same style ("Phase 369 ... idempotent ... runs after all migrations so a rebuilt table regains its triggers"). Import at the top beside lines 33-36. File lives under `lib/core/navigation/` so check-substrate allow-lists it by path.

---

### `lib/core/navigation/room-projection.cjs` (NEW, read projection)

**Analog:** `spine-events.cjs` `openRoomDbReadOnlyForCaller` 523-535 (`file:...?mode=ro`, lazy `require('node:sqlite')`, never throws, returns null) and the read helpers `_openForRead` (361), `getCurrentJTBD` (373). Re-export through `lib/core/navigation.cjs` like spine-events exports (537+).

---

### `tests/run-all-369.sh` (aggregator)

**Analog:** `tests/run-all-267.sh`, copy verbatim structure:
- Header 1-21 ("WRITTEN ONCE ... NO LATER 369 PLAN EDITS THIS FILE'S LEG LIST"; exit 0/77/other).
- `set -uo pipefail`, ROOT/cd, counters 22-28.
- `run()` 30-43 and `run_if()` 45-52 exactly.
- Legs: `run_if "369: <name> (<REQ>)" tests/test-369-<x>.cjs node tests/test-369-<x>.cjs` (pattern 56-71).
- Regression legs section (e.g. `run_if "regression: release payload ceiling" scripts/check-release-payload-ceiling.cjs node scripts/check-release-payload-ceiling.cjs --check`).
- Em-dash guard block (tail): builds `EMDASH_FILES` from the script, `find tests -maxdepth 1 -name 'test-369-*.cjs'`, helpers (`tests/helpers/mcp-daemon-369.cjs`), greps `$(printf '\xe2\x80\x94')`. Extend the find to `tests/e2e-369`, `ui/shared`, `ui/bakeoff`, `lib/mcp/tools/feed.cjs`, `lib/mcp/room-watcher.cjs`.
- Final `exit $(( FAIL > 0 ? 1 : 0 ))`.

---

### `tests/helpers/mcp-daemon-369.cjs` (hermetic flag-ON daemon)

**Analog:** `tests/test-267-mcpv2-flag-on.cjs` `startDaemon()` 107-148 and `tests/helpers/mcp-wire-267.cjs` `hermeticEnv` 59-80 (exported at 374).
```js
const hermetic = hermeticEnv({ MINDRIAN_TRANSPORT: 'http', MINDRIAN_MCP_FIRST: 'cowork' });
// write <roomsHome>/.rooms/registry.json with {active, rooms:{slug:{slug, abs_path}}}
const child = cp.spawn('node', [LOCAL_SERVER], { cwd: REPO_ROOT, env: hermetic.env, stdio: ['ignore','pipe','pipe'] });
// resolve on stderr match /HTTP on 127\.0\.0\.1:(\d+)/, 30 s timeout, reject on early exit
```
hermeticEnv deletes `MINDRIAN_BRAIN_KEY`, `MINDRIAN_MCP_FIRST`, `MINDRIAN_MCP_DAEMON`, `CLAUDE_CODE_SESSION_ID`, sets throwaway HOME/rooms home and `MINDRIAN_BRAIN_URL=http://127.0.0.1:9` (Part 8). Pidfile at `<roomsHome>/.rooms/daemon/mcp-daemon.json`; teardown SIGKILLs only the spawned PID (flag-on arm 5). Legacy client: `const { Client, StreamableHTTPClientTransport } = require('@modelcontextprotocol/client')` (flag-on main), `versionNegotiation` absent = legacy sessionful (D-19). Export `{ startDaemon, stopDaemon, legacyClient }`; the 369 helper should seed a room.db via the fixture builder before spawn.

---

### `tests/fixtures/369/` + fixture room builder (`tests/helpers/fixture-room-369.cjs`)

**Analog:** `tests/helpers/fixture-room-365.cjs` 1-50, 181+: header lists every exported helper; wraps `fixture-room-354.cjs` (`makeScratchRoom`, `captureToolServer`, `SKIP_EXIT_CODE`); imports `navigation.cjs` and `room-db.cjs` `{ openRoomDb, closeRoomDb }`; "every write goes through lib/core/navigation.cjs exports; no raw INSERT" (exception allowed only where a test deliberately exercises a raw writer row from the inventory). Add three schema variants (pre-109, pre-224, current) per Wave 0 gap. `writer-inventory.json` = the RESEARCH writer table (N1-N5, U1-U9, E1-E6, D1-D4, P1, R1, M1) as data; inventory test uses the wider regex (catches `INSERT OR IGNORE`, unlike `scripts/check-substrate.cjs` `RE_RAW_WRITE`).

---

### `tests/test-369-*.cjs` (unit / integration)

**Harness analog:** `tests/test-236-engines-floor.cjs` 48-66:
```js
let passed = 0; let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) { failed += 1; process.stdout.write('  FAIL ' + name + '\n'); ... }
function scenario(name, fn) { try { fn(); ok(name); } catch (e) { fail(name, e); } }
```
plus `stripComments` (72-77) and `readRepoFile` (79+) for text-pin tests. Header block style: phase/plan id, what it pins, why, "No em-dashes. CJS." (flag-on 1-27). ENV gaps exit 77 (clean-machine Node 22.18.0 leg, Docker absent).

### `tests/test-236-engines-floor.cjs` (MOD)
Line 42-46: `EXPECTED_FLOOR = '>=22.16.0'`, `FLOOR_MINOR = 16`. Bump to the D-17 floor (22.18.0) and restate the reason in the header (type stripping default since 22.18.0), keeping the 22.16 timeout history. Moves together with `package.json` 59-61, `npm-shrinkwrap.json` root engines, CLAUDE.md stack block + Conventions (edit the GSD sources `.planning/research/STACK.md`, `.planning/codebase/CONVENTIONS.md:5` "CJS only, no TypeScript"), `.planning/spikes/CONVENTIONS.md:8` ("Node 22 CJS, zero npm deps"), CHANGELOG `[Unreleased]`.

---

### `tools/ts-check/` (walled-off package)

**Analog:** `lib/wiki/editor-src/package.json`:
```json
{ "name": "mos-wiki-editor", "private": true, "version": "0.1.0",
  "description": "Walled-off author-time ... never enter the plugin's root dependency tree (Phase 232 D-01/D-02).",
  "scripts": { "build": "node build.cjs" },
  "devDependencies": { "esbuild": "^0.25.0" } }
```
and `build.cjs` 1-45: CJS, plain-English header, exits nonzero on failure. ts-check: `devDependencies: { typescript: "7.0.2", "@types/node": "22" }`, own lockfile, `scripts.check` -> `node check.cjs` running `tsc -p tsconfig.core.json` over `lib/**/*.{ts,mts,cts}` (vacuous today) plus a forbidden-syntax fixture that must fail, plus greps for `paths` and `.tsx` under lib. Exclude from shipping: root `package.json` `files` already ships only listed dirs, so `tools/` is excluded by omission; `ui/` likewise; shipped dist goes under `lib/ui-shell/dist` (mirror `!lib/wiki/editor-src` at line 26 if any UI source ever sits under lib).

### `scripts/release.sh` (MOD)
**Analog:** Step 2.4 block 481-532:
```bash
if ! node "$PLUGIN_DIR/scripts/build-connector-registry.cjs" --check; then
  ... exit 1
fi
```
Add `ts-check` and UI dist freshness (`--check` committed dist against a source hash) as siblings; payload ceiling gate stays at 938. RULE 6: ship as beta first.

---

### `ui/shell/`, `ui/shared/`, `ui/bakeoff/measure.cjs`, `lib/ui-shell/dist/`

- Walling: copy `lib/wiki/editor-src` -> `editor-dist` split (own package.json + lockfile, author-time build, committed output, zero root deps).
- Bake-off setup + overlays: `.planning/spikes/007-agent-native-wraps-mcp/stages/01_scaffold/setup.sh`, `serve.sh`, `02_actions/overlay/`, `02_actions/discover-shim.cjs`; click measurement `03_click-test/run.cjs` + `assemble.cjs`; results to tracked `results.json` (spike 007/006 `results.json`).
- RxDB pull replica: `.planning/spikes/006-room-pull-checkpoint/stages/02_browser-replica/src` + `build.cjs`; probes `03_probe/run.cjs`, `burst-stress.cjs`, `epoch-reload.cjs` (feed checkpoint/epoch arms for e2e).
- Canon v3 tokens: `.planning/spikes/006-room-pull-checkpoint/_config/canon-v3-tokens.css` (UI-SPEC is the authority).
- Shell MCP client: legacy sessionful client exactly as in `test-267-mcpv2-flag-on.cjs` main (no `versionNegotiation`).

## Shared Patterns

### Tool-module contract (Part 11)
**Source:** `lib/mcp/tools/status.cjs` 26-30, 192-210. **Apply to:** feed.cjs, gate.cjs edits. `register(server, ctx)` + `connectors`, never require sibling tool modules or `tool-router.cjs` at load.

### Substrate chokepoint (Part 9)
**Source:** `spine-events.cjs` 454-535 comments. **Apply to:** all lib/mcp and scripts code: room.db only via navigation exports; read-only door for reads; caller closes in finally.

### Transaction ownership
**Source:** `frame-provenance.cjs:439-440`. **Apply to:** `withRoomTx` and every writer composed under it.

### Never-throw refusal shape
**Source:** `sse-event-bus.cjs` publish 76-95; tools return `{ok:false, reason}` (`gate-ledger` `session_mismatch`). **Apply to:** feed answers (`change_log_absent`, `checkpoint_expired`, `epoch_changed`), watcher.

### Test aggregation and hygiene
**Source:** `tests/run-all-267.sh`. **Apply to:** every 369 test: run_if legs, exit 77 = SKIPPED ENV GAP, em-dash guard.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `tests/test-369-sse-vocab-pin.cjs` | test | - | No test pins `EVENT_KINDS` today (only `test-198-local-only.test.cjs` lists the file); use the 236 harness + RESEARCH Pattern 4 |
| Hook require-graph static test (no `.ts` reachable from `hooks/hooks.json` entries) | test | - | No existing require-graph walker; RESEARCH Pattern 1 |
| Clean-machine install test (npm pack -> hermetic cache layout) | test | batch | Nearest is `scripts/collect-cold-install-evidence.cjs` start-line probe; layout per RESEARCH Pattern 1 |

## Metadata

**Analog search scope:** `lib/mcp`, `lib/mcp/tools`, `lib/core`, `lib/core/navigation`, `lib/core/migrations`, `lib/wiki`, `tests`, `tests/helpers`, `scripts/release.sh`, `package.json`, `.planning/spikes/006`, `.planning/spikes/007`, `.planning/codebase`
**Files scanned:** ~30
**Pattern extraction date:** 2026-10-02
