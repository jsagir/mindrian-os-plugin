'use strict';
/*
 * Phase 260903-gdm (R17-01) -- node-insert-overrides: coverage for the three
 * new insertNode overrides (confidence, review_status, on_conflict) added on
 * top of the Phase 140-01 HARD-02 chokepoint.
 *
 * Harness idiom mirrors lib/core/hsi-to-graph.test.cjs: node:test + node:assert
 * + DatabaseSync over a tmpdir room.db, one suite against the migrated
 * (Phase-109) schema and one against the legacy 3-column schema.
 *
 * Canon Part 8: all data is scalar + local. Every fixture lives under
 * os.tmpdir, never under a real room.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const { openRoomDb, closeRoomDb } = require('./room-db.cjs');
const { insertNode } = require('./node-insert.cjs');

function makeTmpRoom() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'node-insert-overrides-test-'));
}

function rmTmpRoom(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_e) {
    /* best-effort cleanup */
  }
}

function makeUnmigratedDb(roomDir) {
  const dbDir = path.join(roomDir, '.mindrian');
  fs.mkdirSync(dbDir, { recursive: true });
  const dbPath = path.join(dbDir, 'room.db');
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      properties TEXT DEFAULT '{}'
    );
  `);
  return db;
}

// ---- Migrated schema suite ----

test('overrides A: opts.confidence is a number -> bound confidence column', () => {
  const roomDir = makeTmpRoom();
  let db;
  try {
    db = openRoomDb(roomDir);
    insertNode(db, 'n1', 'Section', '{}', { confidence: 0.85 });
    const row = db.prepare('SELECT confidence FROM nodes WHERE id = ?').get('n1');
    assert.strictEqual(row.confidence, 0.85);
  } finally {
    if (db) closeRoomDb(db);
    rmTmpRoom(roomDir);
  }
});

test('overrides B: opts.confidence absent -> confidence lands NULL', () => {
  const roomDir = makeTmpRoom();
  let db;
  try {
    db = openRoomDb(roomDir);
    insertNode(db, 'n2', 'Section', '{}');
    const row = db.prepare('SELECT confidence FROM nodes WHERE id = ?').get('n2');
    assert.strictEqual(row.confidence, null);
  } finally {
    if (db) closeRoomDb(db);
    rmTmpRoom(roomDir);
  }
});

test('overrides C: opts.review_status in enum -> bound review_status column', () => {
  const roomDir = makeTmpRoom();
  let db;
  try {
    db = openRoomDb(roomDir);
    insertNode(db, 'n3', 'HatState', '{}', { review_status: 'confirmed' });
    const row = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get('n3');
    assert.strictEqual(row.review_status, 'confirmed');
  } finally {
    if (db) closeRoomDb(db);
    rmTmpRoom(roomDir);
  }
});

test('overrides D: opts.review_status absent -> column DEFAULT proposed', () => {
  const roomDir = makeTmpRoom();
  let db;
  try {
    db = openRoomDb(roomDir);
    insertNode(db, 'n4', 'HatState', '{}');
    const row = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get('n4');
    assert.strictEqual(row.review_status, 'proposed');
  } finally {
    if (db) closeRoomDb(db);
    rmTmpRoom(roomDir);
  }
});

test('overrides E: opts.review_status out of enum THROWS before prepare()', () => {
  const roomDir = makeTmpRoom();
  let db;
  try {
    db = openRoomDb(roomDir);
    assert.throws(() => {
      insertNode(db, 'n5', 'HatState', '{}', { review_status: 'made-up-status' });
    }, /invalid review_status/);
    const row = db.prepare('SELECT id FROM nodes WHERE id = ?').get('n5');
    assert.strictEqual(row, undefined, 'a rejected review_status must not reach SQL at all');
  } finally {
    if (db) closeRoomDb(db);
    rmTmpRoom(roomDir);
  }
});

test('overrides F: opts.on_conflict nothing -> existing row left byte-identical', () => {
  const roomDir = makeTmpRoom();
  let db;
  try {
    db = openRoomDb(roomDir);
    insertNode(db, 'n6', 'Opportunity', '{"v":1}', { on_conflict: 'nothing' });
    insertNode(db, 'n6', 'Opportunity', '{"v":2}', { on_conflict: 'nothing' });
    const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get('n6');
    assert.strictEqual(row.properties, '{"v":1}');
  } finally {
    if (db) closeRoomDb(db);
    rmTmpRoom(roomDir);
  }
});

test('overrides G: opts.on_conflict absent or update -> existing DO UPDATE unchanged', () => {
  const roomDir = makeTmpRoom();
  let db;
  try {
    db = openRoomDb(roomDir);
    insertNode(db, 'n7', 'Opportunity', '{"v":1}');
    insertNode(db, 'n7', 'Opportunity', '{"v":2}', { on_conflict: 'update' });
    const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get('n7');
    assert.strictEqual(row.properties, '{"v":2}');
  } finally {
    if (db) closeRoomDb(db);
    rmTmpRoom(roomDir);
  }
});

test('overrides H: invalid on_conflict value THROWS', () => {
  const roomDir = makeTmpRoom();
  let db;
  try {
    db = openRoomDb(roomDir);
    assert.throws(() => {
      insertNode(db, 'n8', 'Opportunity', '{}', { on_conflict: 'delete-everything' });
    }, /invalid on_conflict/);
  } finally {
    if (db) closeRoomDb(db);
    rmTmpRoom(roomDir);
  }
});

test('overrides I: re-inserting an existing id preserves review_status and type (no-downgrade contract)', () => {
  const roomDir = makeTmpRoom();
  let db;
  try {
    db = openRoomDb(roomDir);
    insertNode(db, 'n9', 'decision', '{"v":1}', { review_status: 'confirmed', confidence: 1.0 });
    // A later system re-projection with no review_status override must NOT
    // downgrade the already-confirmed row.
    insertNode(db, 'n9', 'decision', '{"v":2}');
    const row = db.prepare('SELECT review_status, type, properties FROM nodes WHERE id = ?').get('n9');
    assert.strictEqual(row.review_status, 'confirmed', 'review_status must not be downgraded on conflict');
    assert.strictEqual(row.type, 'decision');
    assert.strictEqual(row.properties, '{"v":2}');
  } finally {
    if (db) closeRoomDb(db);
    rmTmpRoom(roomDir);
  }
});

// ---- Legacy 3-column schema suite ----

test('overrides legacy A: all three new overrides accepted and silently ignored', () => {
  const roomDir = makeTmpRoom();
  let db;
  try {
    db = makeUnmigratedDb(roomDir);
    assert.doesNotThrow(() => {
      insertNode(db, 'l1', 'Section', '{}', {
        confidence: 0.5,
        review_status: 'confirmed',
        on_conflict: 'update',
      });
    });
    const row = db.prepare('SELECT id, type, properties FROM nodes WHERE id = ?').get('l1');
    assert.ok(row);
    assert.strictEqual(row.type, 'Section');
  } finally {
    if (db) {
      try { db.close(); } catch (_e) { /* ignore */ }
    }
    rmTmpRoom(roomDir);
  }
});

test('overrides legacy B: invalid review_status still THROWS on legacy schema (fail closed everywhere)', () => {
  const roomDir = makeTmpRoom();
  let db;
  try {
    db = makeUnmigratedDb(roomDir);
    assert.throws(() => {
      insertNode(db, 'l2', 'Section', '{}', { review_status: 'nonsense' });
    }, /invalid review_status/);
  } finally {
    if (db) {
      try { db.close(); } catch (_e) { /* ignore */ }
    }
    rmTmpRoom(roomDir);
  }
});

test('overrides legacy C: on_conflict nothing honored on legacy schema', () => {
  const roomDir = makeTmpRoom();
  let db;
  try {
    db = makeUnmigratedDb(roomDir);
    insertNode(db, 'l3', 'Section', '{"v":1}', { on_conflict: 'nothing' });
    insertNode(db, 'l3', 'Section', '{"v":2}', { on_conflict: 'nothing' });
    const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get('l3');
    assert.strictEqual(row.properties, '{"v":1}');
  } finally {
    if (db) {
      try { db.close(); } catch (_e) { /* ignore */ }
    }
    rmTmpRoom(roomDir);
  }
});

test('overrides legacy D: legacy branch stays exactly as before for the plain call (no overrides)', () => {
  const roomDir = makeTmpRoom();
  let db;
  try {
    db = makeUnmigratedDb(roomDir);
    insertNode(db, 'l4', 'Section', JSON.stringify({ name: 'l4', label: 'OLD' }));
    insertNode(db, 'l4', 'Section', JSON.stringify({ name: 'l4', label: 'NEW' }));
    const rows = db.prepare('SELECT id, properties FROM nodes WHERE id = ?').all('l4');
    assert.strictEqual(rows.length, 1, 'upsert must not create a duplicate row');
    assert.match(rows[0].properties, /NEW/);
  } finally {
    if (db) {
      try { db.close(); } catch (_e) { /* ignore */ }
    }
    rmTmpRoom(roomDir);
  }
});
