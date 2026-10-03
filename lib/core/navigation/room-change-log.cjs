'use strict';

/**
 * room-change-log.cjs - the durable room change feed (Phase 369, D-18).
 *
 * Canon Part 9: room.db is the local mind. This module is a LEAF under
 * lib/core/navigation/ (Node built-ins only; it requires neither room-db.cjs
 * nor navigation.cjs, so there is no require cycle). room-db.cjs calls
 * installChangeLog(db) after the last migration on every write-door open;
 * navigation.cjs re-exports withRoomTx, readChangeLogMeta and
 * CHANGE_LOG_TRIGGERS.
 *
 * Phase 108 registration: room_change_log and room_tx_context are registered as
 * NEW in .planning/phases/108-graph-memory-schema-reconciliation/aliases.yml
 * (committed before this file existed, Pitfall 15). The log is a derived,
 * append-only feed, not graph state: it carries no typed edges.
 *
 * Why triggers: "same transaction as every canonical mutation" is only true for
 * every writer in every process and language (CLI hooks, scripts, the MCP
 * daemon, the Python engine) when capture lives at the table, not at the call
 * site. Six AFTER INSERT/UPDATE/DELETE triggers on nodes and edges write one
 * room_change_log row each. A rollback leaves neither the row nor its log row.
 *
 * No JSON function appears in any trigger body (only char(), strftime(),
 * COALESCE and plain subselects), so a writer on an older SQLite, such as the
 * Python engine, still fires them without a missing-function error.
 *
 * No em-dashes. CJS only.
 */

const crypto = require('node:crypto');

const CHANGE_LOG_TABLES = Object.freeze(['room_change_log', 'room_tx_context']);
const CHANGE_LOG_TRIGGERS = Object.freeze([
  'rcl_nodes_ai',
  'rcl_nodes_au',
  'rcl_nodes_ad',
  'rcl_edges_ai',
  'rcl_edges_au',
  'rcl_edges_ad',
]);

const EPOCH_KEY = 'change_log_epoch';
const FLOOR_KEY = 'change_log_floor';

// Retention (Phase 369-12, CHG369-06, CM369-01). The promise: a room survives at
// least 20 full graph rebuilds plus 10,000 ordinary writes before its first
// compaction. required_rows = rows_per_rebuild * 20 + (rows_per_2000_writes /
// 2000) * 10000, measured by tests/test-369-change-log-compaction.cjs on a
// fixture room with 200 artifact-indexed nodes and recorded (counts only,
// Phase 343 rule, SEED-074) in tests/fixtures/369/retention-measurement.json.
// Measured (Node v22, 200 artifacts in 10 sections, 210 nodes): 2,000 insertNode
// writes log 2,000 rows (one per write); one steady-state rebuildGraph logs
// 1,010 rows (a delete and an upsert per indexer node plus its edges); 10
// rebuilds from an empty graph log 9,691 rows. required_rows = 1,010 * 20 +
// (2,000 / 2,000) * 10,000 = 30,200, under the contract defaults, so the
// defaults stand: maxRows 100,000 and keepRows 50,000. Compacting 100,000 rows
// down to 50,000 took about 52 ms.
// The 2:1 maxRows:keepRows ratio means one compaction halves the log and the
// next is far away. The compaction duration at this ratio is also recorded and
// asserted under 2000 ms (spike 003 hook budget), because compaction runs
// inside installChangeLog on a write-door open that a hook can trigger.
const RETENTION = Object.freeze({ maxRows: 100000, keepRows: 50000 });

// entity_revision equals the new row's change_seq: with AUTOINCREMENT the next
// seq is the sqlite_sequence value plus one, and the VALUES subselect runs
// before the row is assigned (A7).
const REVISION_EXPR =
  "COALESCE((SELECT seq FROM sqlite_sequence WHERE name = 'room_change_log'), 0) + 1";
const TX_EXPR = '(SELECT tx FROM room_tx_context WHERE id = 1)';
const EDGE_KEY = (row) => row + '.source || char(31) || ' + row + '.type || char(31) || ' + row + '.target';

function triggerSql(name, event, table, operation, row) {
  const entityType = table === 'nodes' ? 'node' : 'edge';
  const entityId = table === 'nodes' ? row + '.id' : EDGE_KEY(row);
  return (
    'CREATE TRIGGER IF NOT EXISTS ' + name + ' AFTER ' + event + ' ON ' + table + ' BEGIN ' +
    'INSERT INTO room_change_log (entity_type, entity_id, operation, entity_revision, transaction_id) ' +
    "VALUES ('" + entityType + "', " + entityId + ", '" + operation + "', " + REVISION_EXPR + ', ' + TX_EXPR + '); ' +
    'END'
  );
}

function buildTriggerStatements() {
  return [
    triggerSql('rcl_nodes_ai', 'INSERT', 'nodes', 'upsert', 'NEW'),
    triggerSql('rcl_nodes_au', 'UPDATE', 'nodes', 'upsert', 'NEW'),
    triggerSql('rcl_nodes_ad', 'DELETE', 'nodes', 'delete', 'OLD'),
    triggerSql('rcl_edges_ai', 'INSERT', 'edges', 'upsert', 'NEW'),
    triggerSql('rcl_edges_au', 'UPDATE', 'edges', 'upsert', 'NEW'),
    triggerSql('rcl_edges_ad', 'DELETE', 'edges', 'delete', 'OLD'),
  ];
}

function existingNames(db, type) {
  const rows = db.prepare('SELECT name FROM sqlite_master WHERE type = ?').all(type);
  return new Set(rows.map((r) => r.name));
}

function setIdentity(db, key, value, nowIso) {
  db.prepare('INSERT OR REPLACE INTO identity (key, value, updated_at) VALUES (?, ?, ?)')
    .run(key, value, nowIso);
}

/**
 * Idempotent installer. Runs on every write-door open AFTER the last migration,
 * so a migration that rebuilt a table regains its triggers. Rethrows after its
 * own ROLLBACK so room-db's catch closes the handle.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @returns {{ created: boolean, epochReminted: boolean, epoch: string|null, missingBefore: string[], compacted: ({ removed: number, floor: number }|null) }}
 */
function installChangeLog(db) {
  const tablesBefore = existingNames(db, 'table');
  const triggersBefore = existingNames(db, 'trigger');
  const logExisted = tablesBefore.has('room_change_log');
  const missingBefore = CHANGE_LOG_TRIGGERS.filter((t) => !triggersBefore.has(t));

  const owns = db.isTransaction !== true;
  if (owns) db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(
      'CREATE TABLE IF NOT EXISTS room_change_log (' +
        'change_seq INTEGER PRIMARY KEY AUTOINCREMENT, ' +
        "entity_type TEXT NOT NULL CHECK (entity_type IN ('node', 'edge')), " +
        'entity_id TEXT NOT NULL, ' +
        "operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')), " +
        'entity_revision INTEGER, ' +
        'transaction_id TEXT, ' +
        "changed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))" +
        ')'
    );
    db.exec('CREATE INDEX IF NOT EXISTS rcl_entity_seq ON room_change_log (entity_type, entity_id, change_seq)');
    db.exec('CREATE TABLE IF NOT EXISTS room_tx_context (id INTEGER PRIMARY KEY CHECK (id = 1), tx TEXT)');
    db.exec('INSERT OR IGNORE INTO room_tx_context (id, tx) VALUES (1, NULL)');
    for (const sql of buildTriggerStatements()) db.exec(sql);

    const nowIso = new Date().toISOString();
    let epochReminted = false;
    let epoch = null;
    if (!logExisted) {
      epoch = crypto.randomUUID();
      setIdentity(db, EPOCH_KEY, epoch, nowIso);
      setIdentity(db, FLOOR_KEY, '0', nowIso);
      epochReminted = true;
    } else if (missingBefore.length > 0) {
      // A rebuild dropped a trigger (Pitfall 6): rows copied meanwhile carry no
      // log rows, so clients must reset. New epoch, floor above every old seq.
      const top = db.prepare('SELECT COALESCE(MAX(change_seq), 0) AS m FROM room_change_log').get();
      const seqRow = db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'room_change_log'").get();
      const maxSeq = Math.max(Number(top.m) || 0, seqRow ? Number(seqRow.seq) || 0 : 0);
      epoch = crypto.randomUUID();
      setIdentity(db, EPOCH_KEY, epoch, nowIso);
      setIdentity(db, FLOOR_KEY, String(maxSeq + 1), nowIso);
      epochReminted = true;
    }
    if (epoch === null) {
      const row = db.prepare('SELECT value FROM identity WHERE key = ?').get(EPOCH_KEY);
      epoch = row ? row.value : null;
    }
    // Compaction runs only above the measured ceiling, so the common write-door
    // open (every hook) pays one cheap meta read, not a compaction. It rides this
    // same transaction (compactChangeLog nests via the owns idiom).
    let compacted = null;
    const meta = readChangeLogMeta(db);
    if (meta.present && retainedRows(meta) > RETENTION.maxRows) {
      compacted = compactChangeLog(db, { keepRows: RETENTION.keepRows });
    }
    if (owns) db.exec('COMMIT');
    return { created: !logExisted, epochReminted, epoch, missingBefore, compacted };
  } catch (err) {
    if (owns) {
      try { db.exec('ROLLBACK'); } catch (_e) { /* already rolled back */ }
    }
    throw err;
  }
}

/**
 * Run fn inside one write transaction and stamp room_tx_context.tx so every
 * trigger-written log row of this transaction shares one transaction_id.
 * Nests inside an outer transaction without a second BEGIN (house owns idiom).
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {(db: import('node:sqlite').DatabaseSync) => any} fn
 * @param {{ txId?: string }} [opts]
 */
function withRoomTx(db, fn, opts) {
  const owns = db.isTransaction !== true;
  if (!owns) return fn(db);

  const txId = (opts && opts.txId) || crypto.randomUUID();
  db.exec('BEGIN IMMEDIATE');
  try {
    const hasCtx = existingNames(db, 'table').has('room_tx_context');
    if (hasCtx) db.prepare('UPDATE room_tx_context SET tx = ? WHERE id = 1').run(txId);
    const result = fn(db);
    if (hasCtx) db.prepare('UPDATE room_tx_context SET tx = NULL WHERE id = 1').run();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_e) { /* already rolled back */ }
    throw err;
  }
}

/**
 * Read the feed's epoch, floor and latest seq. Works on a read-only handle.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @returns {{ present: false } | { present: true, epoch: string|null, floor: number, latest_seq: number }}
 */
function readChangeLogMeta(db) {
  const has = db.prepare("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = 'room_change_log'").get();
  if (!has) return { present: false };
  const idv = (key) => {
    const r = db.prepare('SELECT value FROM identity WHERE key = ?').get(key);
    return r ? r.value : null;
  };
  const top = db.prepare('SELECT COALESCE(MAX(change_seq), 0) AS m FROM room_change_log').get();
  let seqVal = 0;
  try {
    const s = db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'room_change_log'").get();
    seqVal = s ? Number(s.seq) || 0 : 0;
  } catch (_e) { /* no sqlite_sequence yet */ }
  const floorRaw = idv(FLOOR_KEY);
  return {
    present: true,
    epoch: idv(EPOCH_KEY),
    floor: floorRaw === null ? 0 : Number(floorRaw),
    latest_seq: Math.max(Number(top.m) || 0, seqVal),
  };
}

// Retained row count from the meta alone (no COUNT scan): seqs run floor..latest
// (floor 0 means "since seq 1"), so latest - max(floor, 1) + 1.
function retainedRows(meta) {
  return Math.max(0, meta.latest_seq - Math.max(meta.floor, 1) + 1);
}

/**
 * Drop log rows below a cutoff and raise change_log_floor to it, so a client
 * behind the floor gets checkpoint_expired and re-snapshots (plan 13). Never
 * touches rows at or above the cutoff; change_seq never goes backwards
 * (AUTOINCREMENT keeps its high-water mark in sqlite_sequence even if every
 * row were gone). A no-op when there is nothing to remove.
 *
 * cutoff = latest_seq - keepRows + 1, so exactly keepRows rows survive. The
 * floor is the oldest retained seq; a client whose cursor is cutoff - 1 is
 * reported expired although every row it needs survives, which errs on the safe
 * side by one.
 *
 * We do NOT coalesce (collapse many rows of one entity into the last): snapshot
 * mode reads the current nodes and edges, not the log, so a client behind the
 * floor needs a snapshot either way and coalescing would buy nothing.
 *
 * Owns idiom: begins a transaction only when none is open, so it nests inside
 * installChangeLog's and inside withRoomTx.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ keepRows: number }} opts
 * @returns {{ removed: number, floor: number|null }}
 */
function compactChangeLog(db, opts) {
  const keepRows = opts && opts.keepRows;
  if (!Number.isInteger(keepRows) || keepRows < 1) {
    throw new TypeError('compactChangeLog: keepRows must be an integer >= 1');
  }
  const owns = db.isTransaction !== true;
  if (owns) db.exec('BEGIN IMMEDIATE');
  try {
    const meta = readChangeLogMeta(db);
    if (!meta.present) {
      if (owns) db.exec('COMMIT');
      return { removed: 0, floor: null };
    }
    const cutoff = meta.latest_seq - keepRows + 1;
    let removed = 0;
    let floor = meta.floor;
    if (cutoff > meta.floor) {
      const res = db.prepare('DELETE FROM room_change_log WHERE change_seq < ?').run(cutoff);
      removed = Number(res.changes) || 0;
      if (removed > 0) {
        floor = cutoff;
        setIdentity(db, FLOOR_KEY, String(cutoff), new Date().toISOString());
      }
    }
    if (owns) db.exec('COMMIT');
    return { removed, floor };
  } catch (err) {
    if (owns) {
      try { db.exec('ROLLBACK'); } catch (_e) { /* already rolled back */ }
    }
    throw err;
  }
}

module.exports = {
  installChangeLog,
  compactChangeLog,
  RETENTION,
  withRoomTx,
  readChangeLogMeta,
  CHANGE_LOG_TRIGGERS,
  CHANGE_LOG_TABLES,
};
