'use strict';
// Phase 119-01 Task 2 tests for lib/core/room-discard-cascade.cjs.
// Validates the happy-path cascade, the guard for non-placeholder slugs,
// the partial-failure recovery via rooms-meta.db, and the Canon Part 8/9
// invariants (no Brain coupling; writes through navigation.cjs chokepoint).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { discardPlaceholderRoom } = require('./room-discard-cascade.cjs');
const { openRoomDb, closeRoomDb } = require('./room-db.cjs');

function _mkPlaceholderRoom(slug) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'discard-cascade-test-'));
  fs.mkdirSync(path.join(tmp, '.rooms'), { recursive: true });
  const roomDir = path.join(tmp, slug);
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  // Bootstrap a real room.db (the canonical opener auto-creates the file).
  const db = openRoomDb(roomDir);
  closeRoomDb(db);
  // Seed registry.
  const reg = {
    version: 1,
    active: slug,
    rooms: {
      [slug]: {
        path: roomDir,
        venture_name: 'untitled',
        venture_stage: 'Pre-Opportunity',
        status: 'active',
        last_opened: Date.now(),
      },
    },
  };
  fs.writeFileSync(path.join(tmp, '.rooms', 'registry.json'), JSON.stringify(reg, null, 2), 'utf8');
  return { roomsHome: tmp, roomDir, slug };
}

function _cleanup(roomsHome) {
  try { fs.rmSync(roomsHome, { recursive: true, force: true }); } catch (_e) {}
}

test('Test 10: discardPlaceholderRoom happy path -- transactional rollback flags all true', function () {
  const { roomsHome, roomDir, slug } = _mkPlaceholderRoom('untitled-2026-05-16-1845');
  try {
    const r = discardPlaceholderRoom(roomsHome, slug, { decided_by: 'jsagi' });
    assert.strictEqual(r.ok, true, 'cascade must succeed; got ' + JSON.stringify(r));
    assert.strictEqual(r.slug, slug);
    assert.strictEqual(r.rolled_back_fs, true);
    assert.strictEqual(r.rolled_back_registry, true);
    assert.strictEqual(r.rolled_back_db, true, 'memory_event must land inside transaction');
    // Filesystem assertion: directory no longer exists.
    assert.ok(!fs.existsSync(roomDir), 'roomDir must be removed');
    // Registry assertion: slug removed from rooms map.
    const reg = JSON.parse(fs.readFileSync(path.join(roomsHome, '.rooms', 'registry.json'), 'utf8'));
    assert.ok(!reg.rooms[slug], 'registry entry must be purged');
    assert.strictEqual(reg.active, '', 'active must be cleared when active room is discarded');
  } finally { _cleanup(roomsHome); }
});

test('Test 11: discardPlaceholderRoom on fs.rmSync failure -> partial-failure recovery via rooms-meta.db', function () {
  const { roomsHome, roomDir, slug } = _mkPlaceholderRoom('untitled-2026-05-16-1900');
  try {
    // Monkey-patch fs.rmSync to throw EACCES the FIRST time it's called on
    // roomDir (the discard cascade calls it on the target room). Other paths
    // (tmp files etc.) must still work.
    const origRmSync = fs.rmSync;
    let tripped = false;
    fs.rmSync = function (target, opts) {
      if (!tripped && typeof target === 'string' && target === roomDir) {
        tripped = true;
        const err = new Error('EACCES: permission denied');
        err.code = 'EACCES';
        throw err;
      }
      return origRmSync.call(fs, target, opts);
    };
    try {
      const r = discardPlaceholderRoom(roomsHome, slug, { decided_by: 'jsagi' });
      assert.strictEqual(r.ok, false, 'cascade must fail when fs.rmSync throws');
      assert.strictEqual(r.rolled_back_fs, false, 'fs MUST remain not-removed on EACCES');
      // Directory must still exist (the cascade bounded the failure).
      assert.ok(fs.existsSync(roomDir), 'roomDir must still exist after partial failure');
      // partial_failure_event_id should be populated.
      assert.ok(typeof r.partial_failure_event_id === 'string' && r.partial_failure_event_id.length > 0,
        'partial_failure_event_id must be set; got ' + JSON.stringify(r));
      // rooms-meta.db file must exist on disk.
      const metaDbPath = path.join(roomsHome, '.rooms', '_meta', '.mindrian', 'room.db');
      assert.ok(fs.existsSync(metaDbPath), 'rooms-meta.db must materialize for recovery');
    } finally {
      fs.rmSync = origRmSync;
    }
  } finally { _cleanup(roomsHome); }
});

test('Test 12: guard -- non-placeholder slug is refused (must go through /mos:rooms archive)', function () {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'discard-guard-test-'));
  try {
    const r = discardPlaceholderRoom(tmp, 'acme-robotics', {});
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, 'not_a_placeholder_slug');
    assert.strictEqual(r.rolled_back_db, false);
    assert.strictEqual(r.rolled_back_fs, false);
    assert.strictEqual(r.rolled_back_registry, false);
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) {} }
});

test('Test 13: Canon Part 9 chokepoint -- writes route through navigation.cjs::logMemoryEvent', function () {
  const src = fs.readFileSync(require.resolve('./room-discard-cascade.cjs'), 'utf8');
  // No direct SQL INSERT into nodes (the chokepoint owns INSERTs).
  assert.ok(!/db\.prepare\(\s*['\"]INSERT/.test(src),
    'direct SQL INSERT detected -- writes MUST go through navigation.cjs::logMemoryEvent');
  // Must call logMemoryEvent at least twice (room_discarded + room_discard_partial_failure).
  const matches = src.match(/logMemoryEvent\(/g) || [];
  assert.ok(matches.length >= 2, 'expected >= 2 logMemoryEvent calls; got ' + matches.length);
});

test('Test 14: Canon Part 8 -- no Brain coupling', function () {
  const src = fs.readFileSync(require.resolve('./room-discard-cascade.cjs'), 'utf8');
  assert.ok(src.indexOf('brain.mindrian') === -1, 'brain.mindrian substring present (Canon Part 8 breach)');
  assert.ok(!/require\([^)]*brain-client[^)]*\)/.test(src), 'brain-client require (Canon Part 8 breach)');
  assert.ok(!/fetch\([^)]*['\"][^'\"]*brain[^'\"]*['\"]/.test(src), 'fetch to brain.* host (Canon Part 8 breach)');
});

test('Test 15: em-dash invariant', function () {
  const EMDASH = String.fromCharCode(0x2014);
  const srcCascade = fs.readFileSync(require.resolve('./room-discard-cascade.cjs'), 'utf8');
  const srcValidator = fs.readFileSync(require.resolve('./room-name-validator.cjs'), 'utf8');
  assert.ok(srcCascade.indexOf(EMDASH) === -1, 'em-dash present in room-discard-cascade.cjs (HARD RULE)');
  assert.ok(srcValidator.indexOf(EMDASH) === -1, 'em-dash present in room-name-validator.cjs (HARD RULE)');
});
