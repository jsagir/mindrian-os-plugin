'use strict';
// Composition entry point for room.db. Phase 109 chains two idempotent migrations
// after the existing schema init: nodes-provenance (Plan 109-01) then session_focus
// (Plan 109-02).
//
// Phase 109-02 contract change (parallel-worktree merge surface):
// openRoomDb is now SYNCHRONOUS and returns the bare node:sqlite DatabaseSync
// handle (not the legacy { db, conn } async tuple). Pre-Phase-109 callers that
// did `const handle = await openRoomDb(roomDir); handle.db.prepare(...)` need to
// either:
//   (a) drop the await and use the returned db directly, or
//   (b) call the openGraph low-level API directly.
// The async tuple shape was a leak from lazygraph-ops.cjs openGraph(); the
// navigation API (Plan 109-04) and all 109-* helpers consume the bare db.
// Plan 109-01's nodes-provenance migration was authored against the same
// sync contract; the orchestrator merges both 109-01 and 109-02 worktrees
// onto the same single-line migration chain shown below.
//
// Phase 109-06 addition: runtime soft-defense audit log per RESEARCH section 3.3.
// When openRoomDb is called from outside the navigation/* allow-list, we append
// one JSONL line to ~/.mindrian/telemetry/navigation-bypass.jsonl. Defensive
// (never throws). LOCAL only (Canon Part 8). sha256-hashed room slug. Mirrors
// Phase 88.1-16 query-efficiency telemetry pattern. Opt-out via env var
// MINDRIAN_DISABLE_BYPASS_AUDIT=1.

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const lazygraph = require('./lazygraph-ops.cjs');
const memory = require('./memory-ops.cjs');
const { runMigration: runPhase109SessionFocus } = require('./migrations/phase-109-session-focus.cjs');
const { runMigration: runPhase160NodesBitemporal } = require('./migrations/phase-160-nodes-bitemporal.cjs');
const { runMigration: runPhase222RankerWeights } = require('./migrations/phase-222-ranker-weights.cjs');
const { runMigration: runPhase224EdgeReviewStatus } = require('./migrations/phase-224-edge-review-status.cjs');

// Plan 109-01 migration is loaded best-effort. In a parallel worktree where
// 109-01 has not yet shipped, the require will throw MODULE_NOT_FOUND and we
// fall back to the 109-02 migration's defensive ensureProvenanceColumns()
// backfill (which is a strict subset of the 109-01 schema work). Once 109-01
// merges, this loader resolves and the canonical migration runs first.
let runPhase109NodesProvenance = null;
try {
  runPhase109NodesProvenance = require('./migrations/phase-109-nodes-provenance.cjs').runMigration;
} catch (_e) {
  // 109-01 not present in this worktree; 109-02 migration handles its own
  // FK target schema needs additively.
}

// Phase 109-06 runtime soft-defense. Inspect Error().stack to find the first
// frame outside this file. If that frame is NOT inside the navigation allow-list,
// append one JSONL line to ~/.mindrian/telemetry/navigation-bypass.jsonl with
// scalar fields only (timestamp, caller path, sha256 room hash). Defensive at
// every step: try/catch swallow, stack-parse failures default to 'unknown'.
function auditBypassIfNeeded(roomDir) {
  if (process.env.MINDRIAN_DISABLE_BYPASS_AUDIT === '1') return;
  let callerFile = 'unknown';
  try {
    const stack = (new Error()).stack.split('\n');
    // Walk frames after the Error constructor. Skip any frame whose file is
    // room-db.cjs itself (this function + openRoomDb wrapper).
    for (let i = 1; i < Math.min(stack.length, 12); i++) {
      const frame = stack[i];
      // Match either '(path:line:col)' or 'at path:line:col' shapes.
      const m = frame.match(/\(([^)]+):\d+:\d+\)/) || frame.match(/at\s+(.+):\d+:\d+/);
      if (m && m[1] && !/room-db\.cjs$/.test(m[1])) {
        callerFile = m[1];
        break;
      }
    }
  } catch (_) { /* swallow */ }
  const normalized = callerFile.replace(/\\/g, '/');
  // Allow-list mirrors the pre-commit hook list. No JSONL write for legitimate
  // navigation/* + tests + migration scripts callers.
  if (
    normalized.includes('/lib/core/navigation/') ||
    normalized.endsWith('/lib/core/navigation.cjs') ||
    /[\\/]tests[\\/]/.test(callerFile) ||
    /[\\/]scripts[\\/]migrate-/.test(callerFile) ||
    /[\\/]lib[\\/]core[\\/]migrations[\\/]/.test(callerFile)
  ) {
    return;
  }
  try {
    const dir = path.join(os.homedir(), '.mindrian', 'telemetry');
    fs.mkdirSync(dir, { recursive: true });
    const sha = crypto.createHash('sha256').update(String(roomDir || '')).digest('hex').slice(0, 16);
    const line = JSON.stringify({ ts: Date.now(), caller: callerFile, room_hash: sha }) + '\n';
    fs.appendFileSync(path.join(dir, 'navigation-bypass.jsonl'), line);
  } catch (_) { /* never throw */ }
}

// Phase 211-02 additive contract: openRoomDb gains an OPTIONAL second param.
// When `opts.allowExtension === true`, the handle is constructed so a caller can
// db.loadExtension(...) the vetted sqlite-vec native leg (tri-modal-index.cjs
// primary path). Every existing zero-arg caller is untouched: opts defaults to
// undefined and the DatabaseSync options object is only passed when explicitly
// opted in, so the default construction is byte-for-byte as before.
function openRoomDb(roomDir, opts) {
  // Soft-defense MUST be first so the caller is detected even when downstream
  // schema init throws. Defensive (never throws) per Canon Part 8.
  auditBypassIfNeeded(roomDir);
  const resolved = path.resolve(roomDir);
  const dbDir = path.join(resolved, '.mindrian');
  const dbPath = path.join(dbDir, 'room.db');
  fs.mkdirSync(dbDir, { recursive: true });
  // Phase 218-02 (D-05) write-safety: fold `timeout: 5000` into the DatabaseSync
  // options object on BOTH construction branches (RESEARCH Pitfall 2). The
  // extraction pipeline introduces a NEW concurrency scenario -- an extraction
  // worker and a live conversation can both hold write intent on the same WAL
  // file. Without a busy timeout, node:sqlite fails a contended write in 0ms with
  // SQLITE_BUSY; timeout:5000 turns that into a ~5s busy-wait window. This is a
  // GLOBAL change to every openRoomDb caller and is strictly more forgiving (a
  // longer wait, never a new failure mode; WAL readers never block writers).
  const db = (opts && opts.allowExtension === true)
    ? new DatabaseSync(dbPath, { allowExtension: true, timeout: 5000 })
    : new DatabaseSync(dbPath, { timeout: 5000 });
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  // synchronous = NORMAL is the WAL-recommended durability/throughput balance and
  // has no DatabaseSync constructor equivalent, so it stays a db.exec call.
  db.exec('PRAGMA synchronous = NORMAL');
  // Init lazygraph schema (nodes + edges + indices) sync via the same call
  // the async wrapper makes internally.
  lazygraph.initSchema(db);
  // Init memory schema (identity / facts / sessions / fragments / assumptions / etc).
  memory.initMemorySchema(db);
  // Phase 109 migrations in order: nodes provenance first (109-01), then
  // session_focus (109-02). Both are idempotent via identity sentinels.
  if (runPhase109NodesProvenance) {
    runPhase109NodesProvenance(db);
  }
  runPhase109SessionFocus(db);
  // Phase 160-04 bitemporal node columns (R7). Idempotent via its own sentinel.
  // Runs AFTER phase-109 provenance so the tightened nodes table (with created_at)
  // exists; backfills valid_from = created_at additively. Mirrors the phase-109
  // additive-idempotent-backfill contract.
  runPhase160NodesBitemporal(db);
  // Phase 222-01 ranker_weights table (D-02). Standalone table, no FK dependency,
  // so it appends last in the chain. Idempotent via its own identity sentinel.
  runPhase222RankerWeights(db);
  // Phase 224-01 (D-05) phase-224-edge-review-status: the edges.review_status
  // column. Additive ALTER TABLE guarded by a defensive PRAGMA column probe;
  // idempotent via its own identity sentinel. Runs after phase-222 so it appends
  // last on the shared migration chain.
  runPhase224EdgeReviewStatus(db);
  return db;
}

function closeRoomDb(handle) {
  // Tolerant: accept either bare DatabaseSync (current contract) or the legacy
  // { db, conn } shape during the merge cycle.
  const db = handle && handle.db ? handle.db : handle;
  try {
    db.close();
  } catch (_e) {
    // already closed; ignore
  }
}

module.exports = { openRoomDb, closeRoomDb };
