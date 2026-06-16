'use strict';
// Phase 160-04 Task 2 test: non-lossy supersession through the chokepoint (R8).
//
// Builds two confirmed claim nodes A (old) and B (new), calls supersede(A, B),
// and asserts:
//   - A row is STILL PRESENT (never deleted) with invalidated_at set to the
//     reference now and valid_to == B.valid_from,
//   - A.review_status == 'superseded',
//   - a SUPERSEDES edge B->A exists,
//   - the supersession logged a status_superseded memory_event (Part 9 chokepoint),
//   - no DELETE happened (row count unchanged for A).
//
// The point-in-time as-of query assertion is Plan 05; this task asserts the
// row state + the SUPERSEDES edge + the audit event, all through navigation.cjs.
//
// House rule: hyphens only, no em-dashes.

const { test } = require('node:test');
const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const { supersede } = require(path.join(REPO_ROOT, 'lib', 'core', 'temporal', 'supersession.cjs'));

// Build a real room.db via the production openRoomDb composition (runs phase-109
// + phase-160 migrations, so valid_from is a real column). Insert two confirmed
// claim nodes. B.valid_from is set to a fixed value so valid_to assertions are
// deterministic.
function setupRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-160-supersede-'));
  const db = openRoomDb(tmp);
  const aCreated = 1700000000000;
  const bCreated = 1740000000000;
  const insert = db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at, valid_from) " +
    "VALUES (?, 'claim', '{}', ?, 'system', 'confirmed', ?, ?, ?)"
  );
  insert.run('claim:A', 'unknown:claim:A', aCreated, aCreated, aCreated);
  insert.run('claim:B', 'unknown:claim:B', bCreated, bCreated, bCreated);
  return { tmp, db, aCreated, bCreated };
}

function cleanup(tmp, db) {
  try { closeRoomDb(db); } catch (_) { /* ignore */ }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

test('R8: supersede closes A non-lossily (row present, invalidated_at set, valid_to == B.valid_from)', () => {
  const { tmp, db, bCreated } = setupRoom();
  try {
    const fixedNow = 1750000000000;
    const res = supersede(db, 'claim:A', 'claim:B', { now: () => fixedNow });
    equal(res.ok, true, 'supersede ok: ' + JSON.stringify(res));

    const a = db.prepare(
      'SELECT id, review_status, invalidated_at, valid_to FROM nodes WHERE id = ?'
    ).get('claim:A');
    ok(a, 'A row STILL PRESENT after supersession (never deleted)');
    equal(a.review_status, 'superseded', 'A.review_status superseded');
    equal(a.invalidated_at, fixedNow, 'A.invalidated_at = reference now');
    equal(a.valid_to, bCreated, 'A.valid_to == B.valid_from');
  } finally { cleanup(tmp, db); }
});

test('R8: a SUPERSEDES edge B->A exists', () => {
  const { tmp, db } = setupRoom();
  try {
    supersede(db, 'claim:A', 'claim:B', { now: () => 1750000000000 });
    const edge = db.prepare(
      "SELECT source, target, type FROM edges WHERE type = 'SUPERSEDES' AND source = ? AND target = ?"
    ).get('claim:B', 'claim:A');
    ok(edge, 'SUPERSEDES edge B->A present');
    equal(edge.source, 'claim:B', 'edge source is B (new)');
    equal(edge.target, 'claim:A', 'edge target is A (old)');
  } finally { cleanup(tmp, db); }
});

test('R8: the supersession is logged via the Part 9 chokepoint (status_superseded memory_event)', () => {
  const { tmp, db } = setupRoom();
  try {
    supersede(db, 'claim:A', 'claim:B', { now: () => 1750000000000 });
    const ev = db.prepare(
      "SELECT id FROM nodes WHERE type = 'memory_event' " +
      "AND json_extract(properties, '$.event_type') = 'status_superseded' " +
      "AND json_extract(properties, '$.target_node_id') = ?"
    ).get('claim:A');
    ok(ev, 'a status_superseded memory_event targeting A was logged through the chokepoint');
  } finally { cleanup(tmp, db); }
});

test('R8: A row count is unchanged - NO DELETE happened', () => {
  const { tmp, db } = setupRoom();
  try {
    const before = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE id = 'claim:A'").get().n;
    supersede(db, 'claim:A', 'claim:B', { now: () => 1750000000000 });
    const after = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE id = 'claim:A'").get().n;
    equal(before, 1, 'A present before');
    equal(after, 1, 'A still present after - supersession never deletes');
  } finally { cleanup(tmp, db); }
});
