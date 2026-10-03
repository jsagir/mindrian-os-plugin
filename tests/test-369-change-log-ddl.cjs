#!/usr/bin/env node
'use strict';

/**
 * Phase 369-05 (CHG369-01, CHG369-02, D-18) -- change log DDL, epoch, rebuild
 * and transaction tests, over three nodes schema variants (wide, mid, legacy).
 *
 * Nine scenarios, each on a fresh fixture room in a hermetic temp dir:
 *   1. install (per variant): both tables, the rcl_entity_seq index, six
 *      triggers, epoch and floor in identity, one room_tx_context row
 *   2. idempotence: re-opens leave the epoch and exactly six triggers
 *   3. capture: insertNode, writeEdge and a raw DELETE each log one row
 *   4. conflict semantics: DO UPDATE, ignored OR IGNORE, OR REPLACE
 *   5. rollback: a rolled back write leaves no node and no log row
 *   6. withRoomTx: shared transaction id, rollback on throw, nesting
 *   7. rebuild detection: a dropped trigger is restored, epoch re-minted,
 *      floor raised to previous max seq plus one
 *   8. monotonic seq: AUTOINCREMENT never goes backwards after a purge
 *   9. readChangeLogMeta on a read-only handle, and on a never-opened room
 *
 * Canon Part 9: this test reads and writes room.db through the write door, the
 * navigation exports and raw handles on throwaway fixtures only (tests/ is
 * allow-listed for raw SQL by the substrate guard). Canon Part 8: no network.
 * No em-dashes or en-dashes (escapes only). CJS.
 */

// Hermetic environment BEFORE anything else loads.
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const HERMETIC = fs.mkdtempSync(path.join(os.tmpdir(), 'test-369-chg-ddl-'));
process.env.HOME = HERMETIC;
process.env.USERPROFILE = HERMETIC;
process.env.MINDRIAN_ROOMS_HOME = path.join(HERMETIC, 'rooms');
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const { DatabaseSync } = require('node:sqlite');
const REPO = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const { insertNode } = require(path.join(REPO, 'lib', 'core', 'node-insert.cjs'));
const changeLog = require(path.join(REPO, 'lib', 'core', 'navigation', 'room-change-log.cjs'));
const { buildRoom369, SCHEMA_VARIANTS } = require('./helpers/fixture-room-369.cjs');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ISO_MS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SEP = String.fromCharCode(31);
const EXPECTED_TRIGGERS = ['rcl_edges_ad', 'rcl_edges_ai', 'rcl_edges_au', 'rcl_nodes_ad', 'rcl_nodes_ai', 'rcl_nodes_au'];

const PROV = { source_path: 'test:369', created_by: 'system', created_at: '2026-10-03T00:00:00.000Z' };

let passed = 0;
let failed = 0;
let roomCounter = 0;

function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}
function scenario(name, fn) {
  try { fn(); ok(name); } catch (e) { fail(name, e); }
}

function freshRoom(variant, migrate) {
  roomCounter += 1;
  const tmpDir = path.join(HERMETIC, 'rooms', 'r' + roomCounter);
  return buildRoom369({ tmpDir, slug: 'r' + roomCounter, variant: variant || 'wide', migrate: migrate !== false });
}

function withDb(room, fn) {
  const db = openRoomDb(room.roomDir);
  try { return fn(db); } finally { closeRoomDb(db); }
}

function withRaw(room, fn) {
  const db = new DatabaseSync(room.dbPath);
  try { return fn(db); } finally { db.close(); }
}

function names(db, type) {
  return db.prepare('SELECT name FROM sqlite_master WHERE type = ? ORDER BY name').all(type).map((r) => r.name);
}
function logRows(db) { return db.prepare('SELECT * FROM room_change_log ORDER BY change_seq').all(); }
function ident(db, key) {
  const r = db.prepare('SELECT value FROM identity WHERE key = ?').get(key);
  return r ? r.value : null;
}
function addNode(db, id) {
  insertNode(db, id, 'claim', JSON.stringify({ text: id }), { epistemic_type: 'observation' });
}
function nodeCount(db, id) {
  return db.prepare('SELECT COUNT(*) AS c FROM nodes WHERE id = ?').get(id).c;
}

// 1. install, once per variant ------------------------------------------------
for (const variant of SCHEMA_VARIANTS) {
  scenario('1. install over the ' + variant + ' schema (tables, index, six triggers, epoch, floor, tx row)', () => {
    const room = freshRoom(variant, true);
    withDb(room, (db) => {
      const tables = names(db, 'table');
      assert.ok(tables.includes('room_change_log'), 'room_change_log missing');
      assert.ok(tables.includes('room_tx_context'), 'room_tx_context missing');
      assert.ok(names(db, 'index').includes('rcl_entity_seq'), 'rcl_entity_seq missing');
      assert.deepEqual(names(db, 'trigger').filter((n) => n.startsWith('rcl_')), EXPECTED_TRIGGERS);
      assert.deepEqual([...changeLog.CHANGE_LOG_TRIGGERS].sort(), EXPECTED_TRIGGERS);
      assert.match(ident(db, 'change_log_epoch'), UUID_RE);
      assert.equal(ident(db, 'change_log_floor'), '0');
      const ctx = db.prepare('SELECT id, tx FROM room_tx_context').all();
      assert.equal(ctx.length, 1);
      assert.equal(ctx[0].id, 1);
      assert.equal(ctx[0].tx, null);
    });
  });
}

// 2. idempotence --------------------------------------------------------------
scenario('2. second and third open leave the epoch and exactly six triggers', () => {
  const room = freshRoom('wide', true);
  const epoch = withDb(room, (db) => ident(db, 'change_log_epoch'));
  for (let i = 0; i < 2; i += 1) {
    withDb(room, (db) => {
      assert.equal(ident(db, 'change_log_epoch'), epoch);
      assert.equal(names(db, 'trigger').filter((n) => n.startsWith('rcl_')).length, 6);
    });
  }
});

// 3. capture ------------------------------------------------------------------
scenario('3. insertNode, writeEdge and a raw DELETE each log one row', () => {
  const room = freshRoom('wide', true);
  withDb(room, (db) => {
    const before = logRows(db).length;
    addNode(db, 'claim:369-a');
    let rows = logRows(db).slice(before);
    assert.equal(rows.length, 1, 'insertNode must log exactly one row');
    assert.equal(rows[0].entity_type, 'node');
    assert.equal(rows[0].entity_id, 'claim:369-a');
    assert.equal(rows[0].operation, 'upsert');
    assert.equal(rows[0].entity_revision, rows[0].change_seq);
    assert.match(rows[0].changed_at, ISO_MS_RE);
    assert.equal(rows[0].transaction_id, null);

    const b2 = logRows(db).length;
    const res = navigation.writeEdge(db, {
      source_id: 'claim:369-a',
      target_id: 'section:test-subject',
      edge_type: 'DEFERRED',
      properties: { origin: 'test-369' },
    });
    assert.equal(res.ok, true, 'writeEdge failed: ' + JSON.stringify(res));
    rows = logRows(db).slice(b2);
    const edgeRows = rows.filter((r) => r.entity_type === 'edge');
    assert.equal(edgeRows.length, 1, 'writeEdge must log exactly one edge row');
    assert.equal(edgeRows[0].operation, 'upsert');
    const parts = edgeRows[0].entity_id.split(SEP);
    assert.equal(parts.length, 3);
    assert.equal(parts[0], 'claim:369-a');
    assert.equal(parts[1], 'DEFERRED');
    assert.equal(parts[2], 'section:test-subject');

    const b3 = logRows(db).length;
    db.prepare('DELETE FROM nodes WHERE id = ?').run('claim:369-a');
    rows = logRows(db).slice(b3);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].entity_type, 'node');
    assert.equal(rows[0].operation, 'delete');
    assert.equal(rows[0].entity_id, 'claim:369-a');
  });
});

// 4. conflict semantics -------------------------------------------------------
scenario('4. DO UPDATE logs one upsert, an ignored OR IGNORE none, OR REPLACE one upsert and no delete', () => {
  const room = freshRoom('wide', true);
  withDb(room, (db) => {
    addNode(db, 'claim:369-c');
    let mark = logRows(db).length;
    db.prepare(
      'INSERT INTO nodes (id, type, properties, source_path, created_by, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(id) DO UPDATE SET properties = excluded.properties'
    ).run('claim:369-c', 'claim', '{"v":2}', PROV.source_path, PROV.created_by, PROV.created_at, PROV.created_at);
    let rows = logRows(db).slice(mark);
    assert.equal(rows.length, 1, 'ON CONFLICT DO UPDATE must log one row');
    assert.equal(rows[0].operation, 'upsert');

    mark = logRows(db).length;
    db.prepare('INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('claim:369-c', 'claim', '{"v":3}', PROV.source_path, PROV.created_by, PROV.created_at, PROV.created_at);
    assert.equal(logRows(db).slice(mark).length, 0, 'an ignored insert must log nothing');

    mark = logRows(db).length;
    db.prepare('INSERT OR REPLACE INTO nodes (id, type, properties, source_path, created_by, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('claim:369-c', 'claim', '{"v":4}', PROV.source_path, PROV.created_by, PROV.created_at, PROV.created_at);
    rows = logRows(db).slice(mark);
    assert.equal(rows.length, 1, 'OR REPLACE must log one row');
    assert.equal(rows[0].operation, 'upsert');
    assert.equal(rows.filter((r) => r.operation === 'delete').length, 0, 'OR REPLACE must not log a delete');
  });
});

// 5. rollback -----------------------------------------------------------------
scenario('5. a rolled back write leaves no node row and no log row', () => {
  const room = freshRoom('wide', true);
  withDb(room, (db) => {
    const mark = logRows(db).length;
    db.exec('BEGIN IMMEDIATE');
    addNode(db, 'claim:369-rb');
    assert.equal(logRows(db).length, mark + 1, 'the log row exists inside the transaction');
    db.exec('ROLLBACK');
    assert.equal(nodeCount(db, 'claim:369-rb'), 0);
    assert.equal(logRows(db).length, mark);
  });
});

// 6. withRoomTx ---------------------------------------------------------------
scenario('6. withRoomTx stamps one id, rolls back on throw, nests without a second BEGIN', () => {
  const room = freshRoom('wide', true);
  withDb(room, (db) => {
    const mark = logRows(db).length;
    changeLog.withRoomTx(db, (d) => { addNode(d, 'claim:369-t1'); addNode(d, 'claim:369-t2'); });
    const rows = logRows(db).slice(mark);
    assert.equal(rows.length, 2);
    assert.ok(rows[0].transaction_id && rows[0].transaction_id.length > 0, 'transaction_id must be set');
    assert.equal(rows[0].transaction_id, rows[1].transaction_id);
    assert.equal(db.prepare('SELECT tx FROM room_tx_context WHERE id = 1').get().tx, null);

    const mark2 = logRows(db).length;
    assert.throws(() => {
      changeLog.withRoomTx(db, (d) => { addNode(d, 'claim:369-t3'); throw new Error('boom'); });
    }, /boom/);
    assert.equal(nodeCount(db, 'claim:369-t3'), 0);
    assert.equal(logRows(db).length, mark2);
    assert.equal(db.prepare('SELECT tx FROM room_tx_context WHERE id = 1').get().tx, null);

    const mark3 = logRows(db).length;
    db.exec('BEGIN IMMEDIATE');
    changeLog.withRoomTx(db, (d) => addNode(d, 'claim:369-t4'));
    db.exec('COMMIT');
    assert.equal(nodeCount(db, 'claim:369-t4'), 1);
    assert.equal(logRows(db).length, mark3 + 1);

    // opts.txId is honoured
    const mark4 = logRows(db).length;
    changeLog.withRoomTx(db, (d) => addNode(d, 'claim:369-t5'), { txId: 'tx-fixed-369' });
    assert.equal(logRows(db).slice(mark4)[0].transaction_id, 'tx-fixed-369');
  });
});

// 7. rebuild detection --------------------------------------------------------
scenario('7. a dropped trigger is restored, the epoch re-minted and the floor raised', () => {
  const room = freshRoom('wide', true);
  const prior = withDb(room, (db) => {
    addNode(db, 'claim:369-r1');
    addNode(db, 'claim:369-r2');
    return {
      epoch: ident(db, 'change_log_epoch'),
      maxSeq: db.prepare('SELECT MAX(change_seq) AS m FROM room_change_log').get().m,
    };
  });
  withRaw(room, (raw) => raw.exec('DROP TRIGGER rcl_nodes_ai'));
  withDb(room, (db) => {
    assert.ok(names(db, 'trigger').includes('rcl_nodes_ai'), 'rcl_nodes_ai must be back');
    const epoch = ident(db, 'change_log_epoch');
    assert.match(epoch, UUID_RE);
    assert.notEqual(epoch, prior.epoch, 'epoch must be re-minted');
    assert.equal(ident(db, 'change_log_floor'), String(prior.maxSeq + 1));
  });
});

// 8. monotonic seq ------------------------------------------------------------
scenario('8. the sequence never goes backwards after the log is emptied', () => {
  const room = freshRoom('wide', true);
  withDb(room, (db) => {
    addNode(db, 'claim:369-m1');
    addNode(db, 'claim:369-m2');
  });
  const seen = withRaw(room, (raw) => {
    const m = raw.prepare('SELECT MAX(change_seq) AS m FROM room_change_log').get().m;
    raw.exec('DELETE FROM room_change_log');
    return m;
  });
  withDb(room, (db) => {
    addNode(db, 'claim:369-m3');
    const rows = logRows(db);
    assert.equal(rows.length, 1);
    assert.ok(rows[0].change_seq > seen, 'seq ' + rows[0].change_seq + ' must exceed ' + seen);
    assert.equal(rows[0].entity_revision, rows[0].change_seq);
  });
});

// 9. readChangeLogMeta --------------------------------------------------------
scenario('9. readChangeLogMeta on a read-only handle, and on a never-opened room', () => {
  const room = freshRoom('wide', true);
  withDb(room, (db) => { addNode(db, 'claim:369-q1'); });
  const ro = navigation.openRoomDbReadOnlyForCaller(room.roomDir);
  assert.ok(ro, 'read-only handle must open');
  try {
    const meta = navigation.readChangeLogMeta(ro);
    assert.equal(meta.present, true);
    assert.match(meta.epoch, UUID_RE);
    assert.equal(meta.floor, 0);
    assert.ok(meta.latest_seq >= 1, 'latest_seq must count the insert');
  } finally {
    ro.close();
  }

  const never = freshRoom('wide', false);
  const ro2 = navigation.openRoomDbReadOnlyForCaller(never.roomDir);
  assert.ok(ro2, 'read-only handle must open on an unmigrated room.db');
  try {
    assert.deepEqual(navigation.readChangeLogMeta(ro2), { present: false });
  } finally {
    ro2.close();
  }
});

try { fs.rmSync(HERMETIC, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
process.stdout.write('\nPASS=' + passed + ' FAIL=' + failed + '\n');
process.exit(failed === 0 ? 0 : 1);
