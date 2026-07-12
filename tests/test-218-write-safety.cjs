'use strict';
// Phase 218-02 Task 1 -- D-05 write-safety probe for openRoomDb.
//
// The extraction pipeline this phase introduces adds a NEW concurrency scenario:
// an extraction worker and a live conversation can both hold write intent on the
// same room.db WAL file. Without a busy timeout, node:sqlite's DatabaseSync fails
// a contended write in 0ms with SQLITE_BUSY. D-05 folds {timeout:5000} into BOTH
// DatabaseSync construction branches and adds PRAGMA synchronous=NORMAL, turning
// the 0ms hard-fail into a ~5s busy-wait window (strictly more forgiving; WAL
// readers never block writers, so this is writer-vs-writer only).
//
// This suite probes the three <behavior> legs:
//   (1) a freshly opened room.db reports busy_timeout = 5000
//   (2) a freshly opened room.db reports synchronous = 1 (NORMAL)
//   (3) an explicit BEGIN; insert-then-force-error; ROLLBACK leaves zero partial
//       rows (node:sqlite has NO .transaction() helper -- Pitfall 3 -- so the
//       rollback is driven by db.exec('BEGIN') / db.exec('ROLLBACK') directly).
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE). Plain-node assert, temp room dir,
// no network, no SKIP path.

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

let pass = 0;
let total = 0;
function check(label, fn) {
  total += 1;
  fn();
  pass += 1;
  console.log('  ok -', label);
}

function freshRoom() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-218-write-safety-'));
}

// Leg 1: busy_timeout = 5000 on a freshly opened room.db (both branches; the
// bare branch is what openRoomDb(roomDir) exercises here).
check('busy_timeout is 5000 after openRoomDb (bare branch)', () => {
  const roomDir = freshRoom();
  const db = openRoomDb(roomDir);
  try {
    const row = db.prepare('PRAGMA busy_timeout').get();
    const val = row.timeout !== undefined ? row.timeout : row.busy_timeout;
    assert.equal(val, 5000, 'busy_timeout should be 5000, got ' + JSON.stringify(row));
  } finally {
    closeRoomDb(db);
  }
});

// Leg 2: synchronous = 1 (NORMAL) after openRoomDb.
check('synchronous is 1 (NORMAL) after openRoomDb', () => {
  const roomDir = freshRoom();
  const db = openRoomDb(roomDir);
  try {
    const row = db.prepare('PRAGMA synchronous').get();
    const val = row.synchronous !== undefined ? row.synchronous : Object.values(row)[0];
    assert.equal(val, 1, 'synchronous should be 1 (NORMAL), got ' + JSON.stringify(row));
  } finally {
    closeRoomDb(db);
  }
});

// Leg 3: explicit BEGIN / insert / force-error / ROLLBACK leaves zero partial
// rows. node:sqlite DatabaseSync has NO .transaction() helper (Pitfall 3), so we
// drive the transaction with db.exec directly.
check('explicit BEGIN + ROLLBACK leaves zero partial rows (no .transaction helper)', () => {
  const roomDir = freshRoom();
  const db = openRoomDb(roomDir);
  try {
    db.exec('CREATE TABLE IF NOT EXISTS _t218_probe (id INTEGER PRIMARY KEY, v TEXT)');
    // Confirm node:sqlite genuinely lacks the better-sqlite3 helper (Pitfall 3).
    assert.equal(typeof db.transaction, 'undefined', 'DatabaseSync must NOT expose .transaction()');
    let threw = false;
    try {
      db.exec('BEGIN');
      db.prepare('INSERT INTO _t218_probe (v) VALUES (?)').run('partial-row');
      // Force an error mid-transaction (duplicate PK on a fixed id).
      db.prepare('INSERT INTO _t218_probe (id, v) VALUES (1, ?)').run('a');
      db.prepare('INSERT INTO _t218_probe (id, v) VALUES (1, ?)').run('b');
      db.exec('COMMIT');
    } catch (_e) {
      threw = true;
      db.exec('ROLLBACK');
    }
    assert.ok(threw, 'the forced duplicate-PK insert should have thrown');
    const count = db.prepare('SELECT COUNT(*) AS n FROM _t218_probe').get().n;
    assert.equal(count, 0, 'ROLLBACK should leave zero rows, found ' + count);
  } finally {
    closeRoomDb(db);
  }
});

console.log('\n' + pass + '/' + total + ' write-safety checks passed');
if (pass !== total) process.exit(1);
