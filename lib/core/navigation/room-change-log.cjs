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
 * @returns {{ created: boolean, epochReminted: boolean, epoch: string|null, missingBefore: string[] }}
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
    if (owns) db.exec('COMMIT');
    return { created: !logExisted, epochReminted, epoch, missingBefore };
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

module.exports = {
  installChangeLog,
  withRoomTx,
  readChangeLogMeta,
  CHANGE_LOG_TRIGGERS,
  CHANGE_LOG_TABLES,
};
