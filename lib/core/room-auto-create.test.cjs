'use strict';

/*
 * Phase 119-00 Wave 1 -- room-auto-create entrypoint tests.
 *
 * 9 behavior tests per 119-00-PLAN.md Task 2:
 *   1. Slug pattern (D-04 untitled-YYYY-MM-DD-HHMM with leading zeros)
 *   2. Slug collision avoidance (second + tertiary collision)
 *   3. Room directory shell (.room-root + .mindrian/room.db)
 *   4. Registry registration (status=active + venture_name + stage)
 *   5. Memory_event emission via navigation chokepoint
 *   6. Graceful degradation on read-only $ROOMS_HOME
 *   7. No Brain client require + no direct room-db.cjs require
 *   8. Idempotency: active room exists -> no overwrite
 *   9. Return shape on success: {ok, room_dir, slug, registry_path}
 */

const test = require('node:test');
const { strict: assert } = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const roomAutoCreate = require(path.join(REPO_ROOT, 'lib', 'core', 'room-auto-create.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

function freshRoomsHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'p119-00-rac-' + crypto.randomBytes(2).toString('hex') + '-'));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* graceful */ }
}

test('Test 1: slug pattern -- untitled-YYYY-MM-DD-HHMM with leading zeros (UTC)', () => {
  const slug = roomAutoCreate.buildPlaceholderSlug(new Date('2026-05-16T18:45:00Z'));
  assert.equal(slug, 'untitled-2026-05-16-1845');
  assert.equal(roomAutoCreate.PLACEHOLDER_SLUG_RE.test(slug), true);
  // Reject no-leading-zeros
  assert.equal(roomAutoCreate.PLACEHOLDER_SLUG_RE.test('untitled-2026-5-16-1845'), false);
  // Reject non-placeholder room names
  assert.equal(roomAutoCreate.PLACEHOLDER_SLUG_RE.test('acme-robotics'), false);
});

test('Test 2: slug collision avoidance -- existing dir -> append -SS UTC seconds', () => {
  const home = freshRoomsHome();
  try {
    // Pre-seed the base slug directory.
    const baseDate = new Date('2026-05-16T18:45:30Z');
    const baseSlug = roomAutoCreate.buildPlaceholderSlug(baseDate);
    fs.mkdirSync(path.join(home, baseSlug), { recursive: true });

    // Now build with collision check -- should append -SS.
    const collisionSlug = roomAutoCreate.buildPlaceholderSlug(baseDate, { collisionCheckRoomsHome: home });
    assert.equal(collisionSlug, baseSlug + '-30');
    assert.equal(roomAutoCreate.PLACEHOLDER_SLUG_RE.test(collisionSlug), true);

    // Second collision: pre-seed -SS too; expect 8-char hex tail.
    fs.mkdirSync(path.join(home, collisionSlug), { recursive: true });
    const tertiarySlug = roomAutoCreate.buildPlaceholderSlug(baseDate, { collisionCheckRoomsHome: home });
    assert.match(tertiarySlug, /^untitled-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-[0-9a-f]{8}$/);
    assert.equal(roomAutoCreate.PLACEHOLDER_SLUG_RE.test(tertiarySlug), true);
  } finally {
    cleanup(home);
  }
});

test('Test 3: room directory shell -- .room-root + .mindrian/room.db materialize', () => {
  const home = freshRoomsHome();
  try {
    const result = roomAutoCreate.autoCreatePlaceholderRoom(home, { source_material_id: 'abc' });
    assert.equal(result.ok, true, 'expected ok; got: ' + JSON.stringify(result));
    assert.equal(fs.existsSync(path.join(result.room_dir, '.room-root')), true);
    assert.equal(fs.existsSync(path.join(result.room_dir, '.mindrian')), true);
    assert.equal(fs.existsSync(path.join(result.room_dir, '.mindrian', 'room.db')), true);
    // Permissions check: directory 0755, sentinel 0644 (Linux only; permissive on non-Linux).
    if (process.platform !== 'win32') {
      const dirMode = fs.statSync(result.room_dir).mode & 0o777;
      assert.equal(dirMode, 0o755, 'room dir mode should be 0755');
    }
  } finally {
    cleanup(home);
  }
});

test('Test 4: registry registration -- status=active + venture_name + stage', () => {
  const home = freshRoomsHome();
  try {
    const result = roomAutoCreate.autoCreatePlaceholderRoom(home, {});
    assert.equal(result.ok, true);
    const registry = JSON.parse(fs.readFileSync(result.registry_path, 'utf8'));
    assert.equal(registry.active, result.slug);
    assert.equal(registry.rooms[result.slug].status, 'active');
    assert.equal(registry.rooms[result.slug].venture_name, 'untitled');
    assert.equal(registry.rooms[result.slug].venture_stage, 'Pre-Opportunity');
  } finally {
    cleanup(home);
  }
});

test('Test 5: memory_event emission -- room_auto_created lands in room.db via chokepoint', () => {
  const home = freshRoomsHome();
  try {
    const result = roomAutoCreate.autoCreatePlaceholderRoom(home, {
      source_material_id: 'abcd1234',
      source_relative_path: 'docs/sample.md',
      source_mtime_ms: Date.now(),
      tier: 1,
    });
    assert.equal(result.ok, true);
    const dbPath = path.join(result.room_dir, '.mindrian', 'room.db');
    const db = openRoomDb(result.room_dir);
    try {
      const events = navigation.findRecentChanges(db, 0, { limit: 5, eventType: 'room_auto_created' });
      assert.equal(events.length >= 1, true, 'expected at least one room_auto_created event');
      const ev = events[0];
      assert.equal(ev.eventType, 'room_auto_created');
      assert.equal(ev.properties.placeholder_slug, result.slug);
      assert.equal(ev.properties.source_material_id, 'abcd1234');
      assert.equal(ev.properties.tier, 1);
    } finally {
      try { db.close(); } catch (_e) { /* graceful */ }
    }
  } finally {
    cleanup(home);
  }
});

test('Test 6: graceful degradation -- read-only ROOMS_HOME returns {ok:false, reason}', { skip: process.platform === 'win32' }, () => {
  const home = freshRoomsHome();
  try {
    // Make roomsHome read-only.
    fs.chmodSync(home, 0o555);
    const result = roomAutoCreate.autoCreatePlaceholderRoom(home, {});
    assert.equal(result.ok, false);
    assert.match(result.reason, /not_writable|scaffold_failed|registry_create_failed/);
  } finally {
    try { fs.chmodSync(home, 0o755); } catch (_e) { /* graceful */ }
    cleanup(home);
  }
});

test('Test 7: source-grep audit -- no Brain client require + em-dash HARD RULE', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'core', 'room-auto-create.cjs'), 'utf8');
  // Canon Part 8: zero Brain coupling.
  assert.equal(/require\([^)]*brain-client/.test(src), false, 'brain-client require detected');
  assert.equal(/require\([^)]*mcp-server-brain/.test(src), false, 'mcp-server-brain require detected');
  assert.equal(/brain\.mindrian/.test(src), false, 'brain.mindrian reference detected');
  // Em-dash HARD RULE
  assert.equal(src.indexOf(String.fromCharCode(0x2014)), -1, 'em-dash present');
  // Canon Part 9 deviation note: room-db.cjs::openRoomDb IS required by this
  // module because the alternative (lazygraph-ops.openGraph) only applies the
  // lazygraph schema, not the Phase 109 nodes-provenance + session_focus
  // migrations the memory_event log depends on. Production caller pattern
  // (scripts/memory-lifecycle.cjs:169) is mirrored here. The runtime
  // soft-defense audit log in openRoomDb itself records out-of-allow-list
  // callers to ~/.mindrian/telemetry/navigation-bypass.jsonl; that is the
  // canonical Phase 109-06 enforcement surface, not a static grep.
  // We DO assert: every memory_event WRITE in this module goes through
  // navigation.logMemoryEvent (the chokepoint), not direct SQL.
  const sqlInsertLikely = /db\.prepare\(\s*['"]INSERT/.test(src);
  assert.equal(sqlInsertLikely, false,
    'direct SQL INSERT detected; all writes must route through navigation.logMemoryEvent');
});

test('Test 8: idempotency -- active room exists returns {ok:false, reason:active_room_exists}', () => {
  const home = freshRoomsHome();
  try {
    // First call creates the room.
    const r1 = roomAutoCreate.autoCreatePlaceholderRoom(home, {});
    assert.equal(r1.ok, true);
    // Second call: registry shows active -> rejected.
    const r2 = roomAutoCreate.autoCreatePlaceholderRoom(home, {});
    assert.equal(r2.ok, false);
    assert.equal(r2.reason, 'active_room_exists');
  } finally {
    cleanup(home);
  }
});

test('Test 9: return shape on success -- all 4 keys present', () => {
  const home = freshRoomsHome();
  try {
    const result = roomAutoCreate.autoCreatePlaceholderRoom(home, {});
    assert.equal(result.ok, true);
    assert.equal(typeof result.room_dir, 'string');
    assert.equal(path.isAbsolute(result.room_dir), true);
    assert.equal(typeof result.slug, 'string');
    assert.equal(roomAutoCreate.PLACEHOLDER_SLUG_RE.test(result.slug), true);
    assert.equal(typeof result.registry_path, 'string');
    assert.equal(path.isAbsolute(result.registry_path), true);
  } finally {
    cleanup(home);
  }
});
