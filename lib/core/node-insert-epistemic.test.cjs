'use strict';
/*
 * Phase 260903-gdm (R17-02) -- node-insert-epistemic: fail-closed coverage for
 * the epistemic_type enum at the single node-write chokepoint
 * (lib/core/node-insert.cjs::insertNode).
 *
 * Harness idiom mirrors lib/core/hsi-to-graph.test.cjs and
 * lib/core/node-insert-overrides.test.cjs: node:test + node:assert +
 * DatabaseSync over a tmpdir room.db.
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
const { insertNode, ALLOWED_EPISTEMIC_TYPES } = require('./node-insert.cjs');

function makeTmpRoom() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'node-insert-epistemic-test-'));
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

test('epistemic A: a member of the closed enum is written and the insert succeeds', () => {
  const roomDir = makeTmpRoom();
  let db;
  try {
    db = openRoomDb(roomDir);
    insertNode(db, 'e1', 'claim', '{}', { epistemic_type: 'extracted_fact' });
    const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get('e1');
    assert.ok(row);
    const props = JSON.parse(row.properties);
    assert.strictEqual(props.epistemic_type, 'extracted_fact');
  } finally {
    if (db) closeRoomDb(db);
    rmTmpRoom(roomDir);
  }
});

test('epistemic B: every member of ALLOWED_EPISTEMIC_TYPES is individually accepted', () => {
  const roomDir = makeTmpRoom();
  let db;
  try {
    db = openRoomDb(roomDir);
    let i = 0;
    for (const et of ALLOWED_EPISTEMIC_TYPES) {
      const id = 'e-enum-' + (i++);
      assert.doesNotThrow(() => {
        insertNode(db, id, 'claim', '{}', { epistemic_type: et });
      });
      const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(id);
      assert.strictEqual(JSON.parse(row.properties).epistemic_type, et);
    }
    assert.strictEqual(ALLOWED_EPISTEMIC_TYPES.size, 10, 'the closed enum has exactly 10 members');
  } finally {
    if (db) closeRoomDb(db);
    rmTmpRoom(roomDir);
  }
});

test('epistemic C: absent epistemic_type THROWS before prepare() (required, no default)', () => {
  const roomDir = makeTmpRoom();
  let db;
  try {
    db = openRoomDb(roomDir);
    assert.throws(() => {
      insertNode(db, 'e2', 'claim', '{}', { review_status: 'proposed' });
    }, /invalid epistemic_type/);
    const row = db.prepare('SELECT id FROM nodes WHERE id = ?').get('e2');
    assert.strictEqual(row, undefined, 'a missing epistemic_type must not reach SQL at all');
  } finally {
    if (db) closeRoomDb(db);
    rmTmpRoom(roomDir);
  }
});

test('epistemic D: out-of-enum string THROWS with the rejected value named, truncated to 40 chars', () => {
  const roomDir = makeTmpRoom();
  let db;
  try {
    db = openRoomDb(roomDir);
    const longBogus = 'x'.repeat(100);
    let caught = null;
    try {
      insertNode(db, 'e3', 'claim', '{}', { epistemic_type: longBogus });
    } catch (e) {
      caught = e;
    }
    assert.ok(caught, 'must throw');
    assert.match(caught.message, /invalid epistemic_type/);
    // The rejected value in the message must be truncated to <= 40 chars of
    // the original bogus value (mirrors writeEdge's detail.slice(0, 40)).
    assert.ok(caught.message.indexOf(longBogus) === -1, 'the full 100-char value must not appear verbatim');
    assert.ok(caught.message.indexOf('x'.repeat(40)) !== -1, 'a 40-char-truncated slice of the value must appear');
    const row = db.prepare('SELECT id FROM nodes WHERE id = ?').get('e3');
    assert.strictEqual(row, undefined);
  } finally {
    if (db) closeRoomDb(db);
    rmTmpRoom(roomDir);
  }
});

test('epistemic E: a non-string epistemic_type THROWS', () => {
  const roomDir = makeTmpRoom();
  let db;
  try {
    db = openRoomDb(roomDir);
    assert.throws(() => {
      insertNode(db, 'e4', 'claim', '{}', { epistemic_type: 42 });
    }, /invalid epistemic_type/);
    assert.throws(() => {
      insertNode(db, 'e4b', 'claim', '{}', { epistemic_type: { nested: true } });
    }, /invalid epistemic_type/);
    assert.throws(() => {
      insertNode(db, 'e4c', 'claim', '{}', { epistemic_type: null });
    }, /invalid epistemic_type/);
  } finally {
    if (db) closeRoomDb(db);
    rmTmpRoom(roomDir);
  }
});

test('epistemic F: the throw happens before any SQL is prepared or run (transaction ROLLBACK leaves zero rows)', () => {
  const roomDir = makeTmpRoom();
  let db;
  try {
    db = openRoomDb(roomDir);
    const before = db.prepare('SELECT COUNT(*) AS n FROM nodes').get().n;
    db.exec('BEGIN');
    try {
      insertNode(db, 'e5', 'claim', '{}', {}); // no epistemic_type -> throws
      db.exec('COMMIT');
      assert.fail('should have thrown before reaching COMMIT');
    } catch (_e) {
      db.exec('ROLLBACK');
    }
    const after = db.prepare('SELECT COUNT(*) AS n FROM nodes').get().n;
    assert.strictEqual(after, before, 'a rejected epistemic_type inside a transaction must leave the graph untouched after ROLLBACK');
    const row = db.prepare('SELECT id FROM nodes WHERE id = ?').get('e5');
    assert.strictEqual(row, undefined);
  } finally {
    if (db) closeRoomDb(db);
    rmTmpRoom(roomDir);
  }
});

test('epistemic G: a caller-supplied properties.epistemic_type is overridden, never shadows the validated value', () => {
  const roomDir = makeTmpRoom();
  let db;
  try {
    db = openRoomDb(roomDir);
    const propsWithSpoof = JSON.stringify({ text: 'hello', epistemic_type: 'decision' });
    insertNode(db, 'e6', 'claim', propsWithSpoof, { epistemic_type: 'extracted_fact' });
    const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get('e6');
    const props = JSON.parse(row.properties);
    assert.strictEqual(props.epistemic_type, 'extracted_fact', 'the validated override wins, not the caller-supplied properties key');
    assert.strictEqual(props.text, 'hello', 'the rest of the properties bag is preserved');
  } finally {
    if (db) closeRoomDb(db);
    rmTmpRoom(roomDir);
  }
});

test('epistemic H: applies uniformly on the legacy un-migrated 3-column schema too', () => {
  const roomDir = makeTmpRoom();
  let db;
  try {
    db = makeUnmigratedDb(roomDir);
    insertNode(db, 'e7', 'Section', '{}', { epistemic_type: 'observation' });
    const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get('e7');
    assert.strictEqual(JSON.parse(row.properties).epistemic_type, 'observation');

    assert.throws(() => {
      insertNode(db, 'e8', 'Section', '{}', {});
    }, /invalid epistemic_type/);
  } finally {
    if (db) {
      try { db.close(); } catch (_e) { /* ignore */ }
    }
    rmTmpRoom(roomDir);
  }
});
