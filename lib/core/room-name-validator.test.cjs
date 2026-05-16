'use strict';
// Phase 119-01 Task 2 tests for lib/core/room-name-validator.cjs.
// Validates FS_SAFE_SLUG_RE shape + 4 rejection classes + Windows-reserved
// defense-in-depth + normalization + multi-rejection compounding.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { validateRoomName, FS_SAFE_SLUG_RE, RESERVED_PREFIXES, WINDOWS_RESERVED } = require('./room-name-validator.cjs');

function _mkTmpRoomsHome() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'room-validator-test-'));
  fs.mkdirSync(path.join(tmp, '.rooms'), { recursive: true });
  return tmp;
}

function _seedRegistry(roomsHome, rooms) {
  const reg = { version: 1, active: '', rooms: rooms || {} };
  fs.writeFileSync(path.join(roomsHome, '.rooms', 'registry.json'), JSON.stringify(reg, null, 2), 'utf8');
}

test('Test 1: FS_SAFE_SLUG_RE accepts canonical slugs', function () {
  assert.ok(FS_SAFE_SLUG_RE.test('acme-robotics'));
  assert.ok(FS_SAFE_SLUG_RE.test('biotech-imaging-v2'));
  assert.ok(FS_SAFE_SLUG_RE.test('a-b'));
  assert.ok(FS_SAFE_SLUG_RE.test('abc'));
});

test('Test 2: FS_SAFE_SLUG_RE rejects unsafe chars', function () {
  assert.ok(!FS_SAFE_SLUG_RE.test('acme/robotics'));
  assert.ok(!FS_SAFE_SLUG_RE.test('acme robotics'));
  assert.ok(!FS_SAFE_SLUG_RE.test('acme.robotics'));
  assert.ok(!FS_SAFE_SLUG_RE.test('../etc'));
  assert.ok(!FS_SAFE_SLUG_RE.test('.hidden'));
  // Single char and leading-hyphen
  assert.ok(!FS_SAFE_SLUG_RE.test('a'));
  assert.ok(!FS_SAFE_SLUG_RE.test('-ab'));
  assert.ok(!FS_SAFE_SLUG_RE.test('ab-'));
});

test('Test 3: collision rejection -- registry has an entry with the same slug', function () {
  const roomsHome = _mkTmpRoomsHome();
  try {
    _seedRegistry(roomsHome, { 'acme-robotics': { path: '/tmp/acme', venture_name: 'acme', status: 'active' } });
    const r = validateRoomName('acme-robotics', { roomsHome });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.normalized_slug, 'acme-robotics');
    assert.ok(r.reasons.indexOf('collision') !== -1, 'expected collision reason; got ' + JSON.stringify(r.reasons));
  } finally {
    try { fs.rmSync(roomsHome, { recursive: true, force: true }); } catch (_e) {}
  }
});

test('Test 4: fs-unsafe rejection', function () {
  const roomsHome = _mkTmpRoomsHome();
  try {
    _seedRegistry(roomsHome, {});
    const r = validateRoomName('acme/robotics', { roomsHome });
    assert.strictEqual(r.ok, false);
    assert.ok(r.reasons.indexOf('fs_unsafe_chars') !== -1, 'expected fs_unsafe_chars; got ' + JSON.stringify(r.reasons));
  } finally {
    try { fs.rmSync(roomsHome, { recursive: true, force: true }); } catch (_e) {}
  }
});

test('Test 5: reserved-prefix rejection (untitled-* AND bare untitled)', function () {
  const roomsHome = _mkTmpRoomsHome();
  try {
    _seedRegistry(roomsHome, {});
    const r1 = validateRoomName('untitled-mything', { roomsHome });
    assert.strictEqual(r1.ok, false);
    assert.ok(r1.reasons.indexOf('reserved_prefix:untitled-') !== -1, 'expected reserved_prefix; got ' + JSON.stringify(r1.reasons));

    const r2 = validateRoomName('untitled', { roomsHome });
    assert.strictEqual(r2.ok, false);
    assert.ok(r2.reasons.indexOf('reserved_prefix:untitled-') !== -1, 'expected reserved_prefix on bare untitled; got ' + JSON.stringify(r2.reasons));
  } finally {
    try { fs.rmSync(roomsHome, { recursive: true, force: true }); } catch (_e) {}
  }
});

test('Test 6: empty / whitespace-only rejection', function () {
  const r1 = validateRoomName('', {});
  assert.strictEqual(r1.ok, false);
  assert.deepStrictEqual(r1.reasons, ['empty']);

  const r2 = validateRoomName('   ', {});
  assert.strictEqual(r2.ok, false);
  assert.deepStrictEqual(r2.reasons, ['empty']);

  const r3 = validateRoomName('\t\n', {});
  assert.strictEqual(r3.ok, false);
  assert.deepStrictEqual(r3.reasons, ['empty']);

  const r4 = validateRoomName(null, {});
  assert.strictEqual(r4.ok, false);
  assert.deepStrictEqual(r4.reasons, ['empty']);
});

test('Test 7: multi-rejection compounding (fs_unsafe + reserved_prefix)', function () {
  const roomsHome = _mkTmpRoomsHome();
  try {
    _seedRegistry(roomsHome, {});
    const r = validateRoomName('untitled/with-slash', { roomsHome });
    assert.strictEqual(r.ok, false);
    assert.ok(r.reasons.indexOf('fs_unsafe_chars') !== -1, 'expected fs_unsafe_chars in reasons');
    assert.ok(r.reasons.indexOf('reserved_prefix:untitled-') !== -1, 'expected reserved_prefix in reasons');
  } finally {
    try { fs.rmSync(roomsHome, { recursive: true, force: true }); } catch (_e) {}
  }
});

test('Test 8: happy path -- valid slug + empty registry', function () {
  const roomsHome = _mkTmpRoomsHome();
  try {
    _seedRegistry(roomsHome, {});
    const r = validateRoomName('acme-robotics', { roomsHome });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.normalized_slug, 'acme-robotics');
    assert.deepStrictEqual(r.reasons, []);
  } finally {
    try { fs.rmSync(roomsHome, { recursive: true, force: true }); } catch (_e) {}
  }
});

test('Test 9: normalization -- trim + lowercase', function () {
  const roomsHome = _mkTmpRoomsHome();
  try {
    _seedRegistry(roomsHome, {});
    const r = validateRoomName('  Acme-Robotics  ', { roomsHome });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.normalized_slug, 'acme-robotics');
    assert.deepStrictEqual(r.reasons, []);
  } finally {
    try { fs.rmSync(roomsHome, { recursive: true, force: true }); } catch (_e) {}
  }
});

test('Test 10: Windows-reserved defense-in-depth (CON / PRN / LPT1)', function () {
  for (const name of ['con', 'CON', 'prn', 'lpt1', 'aux']) {
    const r = validateRoomName(name, {});
    assert.strictEqual(r.ok, false, 'expected ok=false for ' + name);
    assert.ok(r.reasons.indexOf('windows_reserved') !== -1, 'expected windows_reserved for ' + name + '; got ' + JSON.stringify(r.reasons));
  }
});

test('Test 11: source-grep -- no Brain coupling + no em-dash', function () {
  const src = fs.readFileSync(require.resolve('./room-name-validator.cjs'), 'utf8');
  assert.ok(src.indexOf('brain.mindrian') === -1, 'brain.mindrian substring present (Canon Part 8 breach)');
  assert.ok(!/require\([^)]*brain-client[^)]*\)/.test(src), 'brain-client require (Canon Part 8 breach)');
  const EMDASH = String.fromCharCode(0x2014);
  assert.ok(src.indexOf(EMDASH) === -1, 'em-dash present (HARD RULE)');
});
