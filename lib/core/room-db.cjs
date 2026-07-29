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

// Phase 236 (GRAPHDB-02): typed open-failure classification.
// ==========================================================
// Before this phase openRoomDb either returned a working handle or threw
// whatever raw error node:sqlite (or one of the seven chained migrations)
// happened to produce. Callers could not tell "this room is locked right now"
// from "this room is broken" from "this room does not exist yet", so
// graph-derivation.cjs:254-257 collapsed all three into `db = null` and
// cold-started as if the room had no history.
//
// The discriminators below are NOT copied from a result-code table. They were
// OBSERVED on this repo's runtime by the Task 1 behavioral probe and recorded
// verbatim in tests/test-236-open-busy-detected.cjs's header. What that probe
// settled, and why the code is shaped this way:
//   - The thrown object is a plain `Error`. `constructor.name` and `name` are
//     both "Error" for every failure case, so neither can discriminate.
//   - `err.code` is the constant string ERR_SQLITE_ERROR for busy, mid-migration
//     and corrupt alike. It cannot discriminate either.
//   - `err.errcode` is the ONLY stable discriminator: busy=5, mid-migration=1
//     (generic SQL logic error), garbage bytes=26, truncated file=11.
//   - The throw SITES are not where they were assumed to be. A busy open throws
//     from INSIDE the migration chain (an already-migrated room.db needs no
//     write lock, so busy only surfaces once a migration actually needs to
//     write), and a corrupt file throws from the `PRAGMA journal_mode = WAL`
//     exec, NOT from the DatabaseSync construction, which succeeds on garbage
//     bytes. Wrapping only the construction would therefore catch NOTHING.
//     Both the construction-plus-PRAGMA block AND the migration chain are
//     wrapped, and the migration wrapper checks busy BEFORE defaulting to
//     broken because both throw from the same site.
//   - "Genuinely absent" is NOT an open-failure mode here. `fs.mkdirSync` at
//     the top of openRoomDb runs first, so SQLite creates the file and the
//     migrations run clean. An absent room.db opens SUCCESSFULLY. That is why
//     there is no third class: absence returns a handle, it does not throw.
//
// Canon Part 8 binds `meta` and `message` on both classes: path and
// classification scalars only, never row content, query results, or node
// properties. An error that escapes into a log must not leak the room.

// node:sqlite surfaces the SQLite result code on `err.errcode` and can surface
// EXTENDED result codes (for example 1299 = SQLITE_CONSTRAINT_NOTNULL), whose
// low byte is the primary code. The mask is mandatory, not defensive garnish.
const SQLITE_RESULT_CODE_MASK = 0xff;
const SQLITE_BUSY = 5;        // observed: "database is locked"
const SQLITE_CORRUPT = 11;    // observed: "database disk image is malformed"
const SQLITE_NOTADB = 26;     // observed: "file is not a database"

// Which wrapper caught the failure. Recorded on meta so a reader knows whether
// the file failed to open or failed to migrate, without re-deriving it from a
// stack trace.
const STAGE_OPEN = 'open';
const STAGE_MIGRATE = 'migrate';

const CLASSIFICATION_BUSY = 'busy';
const CLASSIFICATION_BROKEN = 'broken';

// ---------- RoomDbBusyError ----------
//
// The room exists and is intact, but another connection holds the write lock
// right now. A caller catches this and RETRIES, backs off, or tells the user to
// close the other session. It is deliberately distinct from RoomDbBrokenError
// (nothing is damaged; waiting fixes it) and deliberately distinct from "no
// room db" / cold start (the room HAS history, it is just unreachable this
// instant). Treating a busy room as a cold start is exactly the data-loss path
// GRAPHDB-02 exists to close.

class RoomDbBusyError extends Error {
  constructor(message, meta) {
    super(message);
    // Explicit so err.name still discriminates across a module-instance
    // boundary, where instanceof can fail on a duplicated require.
    this.name = 'RoomDbBusyError';
    this.meta = meta || {};
  }
}

// ---------- RoomDbBrokenError ----------
//
// The file was reachable but the room is not usable: corrupt pages, garbage
// bytes, a torn file, or a migration that could not be reconciled. A caller
// catches this and SURFACES it (or routes to repair); retrying will not help,
// which is precisely what separates it from RoomDbBusyError. Also distinct from
// "no room db" / cold start: a broken room has history that must not be
// silently overwritten by a fresh start.

class RoomDbBrokenError extends Error {
  constructor(message, meta) {
    super(message);
    this.name = 'RoomDbBrokenError';
    this.meta = meta || {};
  }
}

// Primary SQLite result code, or null when the error is not a node:sqlite error.
function sqliteResultCode(err) {
  if (!err || typeof err.errcode !== 'number') return null;
  return err.errcode & SQLITE_RESULT_CODE_MASK;
}

// Canon Part 8 reduction: the original failure is preserved as its NAME and
// MESSAGE only. The raw error object is never attached, so nothing a future
// edit hangs off it can ride along into a log.
function buildFailureMeta(err, ctx, classification) {
  return {
    roomDir: ctx.roomDir,
    dbPath: ctx.dbPath,
    classification: classification,
    stage: ctx.stage,
    // A SQLite result code is a classification scalar, not room content. It is
    // carried so the recorded-observation probe can still read the underlying
    // discriminator after the typed wrapper is in place.
    errcode: sqliteResultCode(err),
    causeName: err && err.name ? String(err.name) : 'Error',
    causeMessage: err && err.message ? String(err.message) : String(err),
  };
}

// Returns a typed error, or NULL when the observed shape matches nothing this
// classifier was built against. It never throws and never coerces a stranger
// into a bucket; the CALLER decides what to do with an unclassifiable error.
function classifyOpenFailure(err, ctx) {
  const rc = sqliteResultCode(err);
  if (rc === SQLITE_BUSY) {
    return new RoomDbBusyError(
      'room.db is busy: another connection holds the write lock on ' + ctx.dbPath,
      buildFailureMeta(err, ctx, CLASSIFICATION_BUSY)
    );
  }
  if (rc === SQLITE_NOTADB || rc === SQLITE_CORRUPT) {
    return new RoomDbBrokenError(
      'room.db is not readable as a database: ' + ctx.dbPath,
      buildFailureMeta(err, ctx, CLASSIFICATION_BROKEN)
    );
  }
  return null;
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
  // Phase 236 (GRAPHDB-02): the construction and the three PRAGMA execs are
  // wrapped TOGETHER because the probe observed that constructing a
  // garbage-bytes file SUCCEEDS and the corruption only surfaces at the
  // `PRAGMA journal_mode = WAL` exec. Wrapping the construction alone would
  // catch nothing.
  let db = null;
  try {
    db = (opts && opts.allowExtension === true)
      ? new DatabaseSync(dbPath, { allowExtension: true, timeout: 5000 })
      : new DatabaseSync(dbPath, { timeout: 5000 });
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    // synchronous = NORMAL is the WAL-recommended durability/throughput balance and
    // has no DatabaseSync constructor equivalent, so it stays a db.exec call.
    db.exec('PRAGMA synchronous = NORMAL');
  } catch (err) {
    // Close before throwing so a failed open never leaks a DatabaseSync handle,
    // which would hold a lock and make the NEXT open spuriously busy (T-236-10).
    if (db) closeRoomDb(db);
    const typed = classifyOpenFailure(err, { roomDir: resolved, dbPath: dbPath, stage: STAGE_OPEN });
    if (typed) throw typed;
    // Unrecognized shape: surface it as ITSELF. Never bucketed, never swallowed.
    throw err;
  }
  // Phase 236 (GRAPHDB-02): the migration chain is wrapped SEPARATELY. The probe
  // observed that a busy open and a mid-migration failure throw from the same
  // site inside this chain and are separable only by errcode, so busy is checked
  // FIRST and broken is the default for everything else here.
  try {
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
  } catch (err) {
    // Close first (T-236-10): a half-migrated handle left open would hold the
    // lock and cascade one broken room into a jammed one.
    closeRoomDb(db);
    const ctx = { roomDir: resolved, dbPath: dbPath, stage: STAGE_MIGRATE };
    const typed = classifyOpenFailure(err, ctx);
    if (typed) throw typed;
    // Not a guess about the errcode: reaching here means the file opened and a
    // migration then failed, so the room is definitionally not usable. That IS
    // the broken case, and the original failure is preserved on meta.cause*.
    throw new RoomDbBrokenError(
      'room.db opened but a schema migration failed, so the room is not usable: ' + dbPath,
      buildFailureMeta(err, ctx, CLASSIFICATION_BROKEN)
    );
  }
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

module.exports = { openRoomDb, closeRoomDb, RoomDbBusyError, RoomDbBrokenError };
