'use strict';
// Phase 128.1 Plan 01 (Wave 0) -- RED unit-test scaffold for session-binding.cjs.
//
// This file is RED BY DESIGN until Plan 02 ships lib/core/session-binding.cjs.
// The `require('./session-binding.cjs')` below throws MODULE_NOT_FOUND; the
// banner printed on that throw lets the executor and the run-all aggregator
// tell a scaffold-RED (expected) from a real test failure.
//
// It encodes the resolver/migration contract from the plan's <interfaces>
// block as EXECUTABLE test bodies so Plan 02's session-binding.cjs has a fixed
// target. Covers SESSION-ISO-128.1-01, -02, -03, -07.
//
// Style: node:test + node:assert/strict (matches the lib/ *.test.cjs idiom).
// Run: node lib/core/session-binding.test.cjs  -- exits NON-ZERO until Plan 02.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SCAFFOLD_BANNER =
  '\n========================================================================\n' +
  ' SCAFFOLD-RED (EXPECTED): lib/core/session-binding.cjs does not exist yet.\n' +
  ' Phase 128.1 Plan 01 ships this test RED on purpose. Plan 02 ships the\n' +
  ' module and turns it GREEN. A non-zero exit here is the de-risking signal,\n' +
  ' not a regression.\n' +
  '========================================================================\n';

const V2_FIXTURE = path.join(
  __dirname, '..', '..', 'tests', 'fixtures', 'session-isolation', 'registry-v2-legacy.json'
);

// Load the module under test. Until Plan 02 ships it, this throws -- print the
// banner, then re-throw so the process exits non-zero (RED).
let sessionBinding;
try {
  sessionBinding = require('./session-binding.cjs');
} catch (err) {
  process.stderr.write(SCAFFOLD_BANNER);
  process.stderr.write('  require error: ' + err.message + '\n\n');
  throw err;
}

// Deep clone helper so a test never mutates the shared fixture object.
function loadV2Fixture() {
  return JSON.parse(fs.readFileSync(V2_FIXTURE, 'utf8'));
}

// ---------------------------------------------------------------------------
// SESSION-ISO-128.1-02 -- the one canonical session-id resolver (D-05, D-06)
// ---------------------------------------------------------------------------

test('resolveSessionId: CLAUDE_SESSION_ID and lowercase session_id resolve identically', () => {
  const original = { upper: process.env.CLAUDE_SESSION_ID, lower: process.env.session_id };
  try {
    delete process.env.session_id;
    process.env.CLAUDE_SESSION_ID = 'sess-fixture-upper';
    const fromUpper = sessionBinding.resolveSessionId();
    assert.equal(typeof fromUpper, 'string');
    assert.ok(fromUpper.length > 0, 'resolveSessionId returns a non-empty string');
    assert.equal(fromUpper, 'sess-fixture-upper');

    delete process.env.CLAUDE_SESSION_ID;
    process.env.session_id = 'sess-fixture-lower';
    const fromLower = sessionBinding.resolveSessionId();
    assert.equal(fromLower, 'sess-fixture-lower',
      'lowercase session_id (statusline env) is also honored (Pitfall 3)');
  } finally {
    if (original.upper === undefined) delete process.env.CLAUDE_SESSION_ID;
    else process.env.CLAUDE_SESSION_ID = original.upper;
    if (original.lower === undefined) delete process.env.session_id;
    else process.env.session_id = original.lower;
  }
});

test('resolveSessionId: cold-start fallback is stable across calls in one process (Pitfall 4)', () => {
  const original = { upper: process.env.CLAUDE_SESSION_ID, lower: process.env.session_id };
  try {
    delete process.env.CLAUDE_SESSION_ID;
    delete process.env.session_id;
    const first = sessionBinding.resolveSessionId();
    const second = sessionBinding.resolveSessionId();
    assert.equal(typeof first, 'string');
    assert.ok(first.length > 0, 'cold-start id is a non-empty string, never null');
    assert.ok(first.startsWith('sess-'), 'cold-start id uses the sess- prefix (D-06 precedent)');
    assert.equal(first, second,
      'the SAME cold-start id is returned on a second call in the same process');
  } finally {
    if (original.upper === undefined) delete process.env.CLAUDE_SESSION_ID;
    else process.env.CLAUDE_SESSION_ID = original.upper;
    if (original.lower === undefined) delete process.env.session_id;
    else process.env.session_id = original.lower;
  }
});

// ---------------------------------------------------------------------------
// SESSION-ISO-128.1-03 -- v2 -> v3 migration (D-04)
// ---------------------------------------------------------------------------

test('migrateRegistryIfNeeded: v2 fixture migrates to v3 additively', () => {
  const v2 = loadV2Fixture();
  const roomsBefore = JSON.stringify(v2.rooms);

  const result = sessionBinding.migrateRegistryIfNeeded(v2);
  assert.ok(result, 'migrateRegistryIfNeeded returns a result object');
  assert.equal(result.migrated, true, 'a v2 registry reports migrated: true');

  const reg = result.reg;
  assert.equal(reg.version, 3, 'version is bumped to 3');
  assert.ok(reg.sessions && typeof reg.sessions === 'object',
    'an empty sessions map is added');
  assert.equal(Object.keys(reg.sessions).length, 0,
    'the new sessions map starts empty');
  assert.equal(reg.last_active, 'room-a',
    'last_active is seeded from the old active string');
  assert.equal(reg.active, 'room-a',
    'active is left unchanged as the legacy mirror (D-04)');
  assert.equal(JSON.stringify(reg.rooms), roomsBefore,
    'the rooms map is byte-identical after migration');
});

test('migrateRegistryIfNeeded: a version-4 registry is NOT mutated (future-version guard)', () => {
  const future = { version: 4, root: '~/MindrianRooms', active: 'room-a', sessions: {}, rooms: {} };
  const snapshot = JSON.stringify(future);

  const result = sessionBinding.migrateRegistryIfNeeded(future);
  assert.ok(result, 'migrateRegistryIfNeeded returns a result object');
  assert.equal(result.migrated, false,
    'a future-version registry reports migrated: false');
  assert.equal(JSON.stringify(result.reg), snapshot,
    'a version-4 registry is never downgraded or mutated');
});

// ---------------------------------------------------------------------------
// SESSION-ISO-128.1-01 / -07 -- session-scoped resolution + tripwire signal
// ---------------------------------------------------------------------------

test('resolveActiveRoom: a fresh session with no sessions entry falls back to last_active/active', () => {
  // resolveActiveRoom lazy-migrates the v2 fixture, sees no sessions[id] entry
  // for a brand-new session, and falls back to last_active (then active).
  const result = sessionBinding.resolveActiveRoom('sess-brand-new', { reg: loadV2Fixture() });
  assert.ok(result, 'resolveActiveRoom returns a result object');
  assert.equal(result.room, 'room-a',
    'a fresh session resolves the fallback room (room-a) via last_active/active');
  assert.ok(typeof result.path === 'string' && result.path.length > 0,
    'resolveActiveRoom returns a path string');
  assert.ok(result.path.endsWith('room-a'),
    'the resolved path ends with the room-a slug');
  assert.ok(result.tripwire && typeof result.tripwire === 'object',
    'resolveActiveRoom returns a tripwire signal object');
  assert.equal(result.tripwire.fired, false,
    'a first resolution with no prior expectation does not fire the tripwire');
});

// ---------------------------------------------------------------------------
// Phase 128.1 Plan 02 extension -- the lockfile + tripwire + bindSessionRoom
// cases. Plan 01 shipped everything above this banner as RED scaffold; Plan 02
// adds the cases below FIRST (RED extension), then ships session-binding.cjs
// to turn the WHOLE file GREEN.
// ---------------------------------------------------------------------------

const os = require('node:os');
const { execFileSync } = require('node:child_process');

const HOME_DIR = require('node:os').homedir();

// Hermetic-rooms-home helper: mkdtemp a tmp rooms home, copy the v2 fixture
// into <home>/.rooms/registry.json, override MINDRIAN_ROOMS_HOME, and ALSO
// isolate the per-process side-file root via MINDRIAN_HOME so the cold-start
// id + tripwire side files never collide with the real ~/.mindrian. Returns
// { home, restore } -- call restore() in a finally.
function withHermeticRooms(fn) {
  const original = {
    rooms: process.env.MINDRIAN_ROOMS_HOME,
    home: process.env.MINDRIAN_HOME,
    upper: process.env.CLAUDE_SESSION_ID,
    lower: process.env.session_id,
  };
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-test-'));
  const roomsHome = path.join(tmpRoot, 'MindrianRooms');
  const dotMindrian = path.join(tmpRoot, '.mindrian');
  fs.mkdirSync(path.join(roomsHome, '.rooms'), { recursive: true });
  fs.mkdirSync(dotMindrian, { recursive: true });
  // Materialize the two rooms so dir-exists checks pass.
  fs.mkdirSync(path.join(roomsHome, 'room-a'), { recursive: true });
  fs.mkdirSync(path.join(roomsHome, 'room-b'), { recursive: true });
  fs.copyFileSync(V2_FIXTURE, path.join(roomsHome, '.rooms', 'registry.json'));
  process.env.MINDRIAN_ROOMS_HOME = roomsHome;
  process.env.MINDRIAN_HOME = dotMindrian;
  function restore() {
    if (original.rooms === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = original.rooms;
    if (original.home === undefined) delete process.env.MINDRIAN_HOME;
    else process.env.MINDRIAN_HOME = original.home;
    if (original.upper === undefined) delete process.env.CLAUDE_SESSION_ID;
    else process.env.CLAUDE_SESSION_ID = original.upper;
    if (original.lower === undefined) delete process.env.session_id;
    else process.env.session_id = original.lower;
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
  }
  return { home: roomsHome, dotMindrian, restore };
}

function readRegistry(roomsHome) {
  return JSON.parse(
    fs.readFileSync(path.join(roomsHome, '.rooms', 'registry.json'), 'utf8')
  );
}

// --- resolveSessionId: stdin-payload + priority order (SESSION-ISO-128.1-02) --

test('resolveSessionId: a stdin-payload session_id is honored', () => {
  const original = { upper: process.env.CLAUDE_SESSION_ID, lower: process.env.session_id };
  try {
    delete process.env.CLAUDE_SESSION_ID;
    delete process.env.session_id;
    const fromPayload = sessionBinding.resolveSessionId({ session_id: 'sess-from-stdin' });
    assert.equal(fromPayload, 'sess-from-stdin',
      'a { session_id } payload arg is resolved');
  } finally {
    if (original.upper === undefined) delete process.env.CLAUDE_SESSION_ID;
    else process.env.CLAUDE_SESSION_ID = original.upper;
    if (original.lower === undefined) delete process.env.session_id;
    else process.env.session_id = original.lower;
  }
});

test('resolveSessionId: priority is stdin-payload > CLAUDE_SESSION_ID > session_id env', () => {
  const original = { upper: process.env.CLAUDE_SESSION_ID, lower: process.env.session_id };
  try {
    process.env.CLAUDE_SESSION_ID = 'sess-env-upper';
    process.env.session_id = 'sess-env-lower';
    assert.equal(
      sessionBinding.resolveSessionId({ session_id: 'sess-payload' }),
      'sess-payload', 'stdin-payload wins over both env vars');
    assert.equal(
      sessionBinding.resolveSessionId(),
      'sess-env-upper', 'CLAUDE_SESSION_ID wins over lowercase session_id');
  } finally {
    if (original.upper === undefined) delete process.env.CLAUDE_SESSION_ID;
    else process.env.CLAUDE_SESSION_ID = original.upper;
    if (original.lower === undefined) delete process.env.session_id;
    else process.env.session_id = original.lower;
  }
});

test('resolveSessionId: never returns null and never throws', () => {
  const original = { upper: process.env.CLAUDE_SESSION_ID, lower: process.env.session_id };
  try {
    delete process.env.CLAUDE_SESSION_ID;
    delete process.env.session_id;
    let value;
    assert.doesNotThrow(() => { value = sessionBinding.resolveSessionId(); });
    assert.ok(value != null && typeof value === 'string' && value.length > 0,
      'resolveSessionId always yields a non-empty string');
  } finally {
    if (original.upper === undefined) delete process.env.CLAUDE_SESSION_ID;
    else process.env.CLAUDE_SESSION_ID = original.upper;
    if (original.lower === undefined) delete process.env.session_id;
    else process.env.session_id = original.lower;
  }
});

// --- migrateRegistryIfNeeded: v3 no-op + missing-version (SESSION-ISO-128.1-03) -

test('migrateRegistryIfNeeded: a version-3 registry is a no-op (idempotent)', () => {
  const v3 = {
    version: 3, root: '~/MindrianRooms', active: 'room-a', last_active: 'room-a',
    sessions: { 'sess-x': { room: 'room-a' } }, rooms: { 'room-a': { path: 'room-a' } },
  };
  const snapshot = JSON.stringify(v3);
  const result = sessionBinding.migrateRegistryIfNeeded(v3);
  assert.equal(result.migrated, false, 'a v3 registry reports migrated: false');
  assert.equal(JSON.stringify(result.reg), snapshot,
    'a v3 registry is returned byte-identical');
});

test('migrateRegistryIfNeeded: a registry with no version key migrates as v1', () => {
  const noVersion = { root: '~/MindrianRooms', active: 'room-a', rooms: {} };
  const result = sessionBinding.migrateRegistryIfNeeded(noVersion);
  assert.equal(result.migrated, true,
    'a version-less registry reports migrated: true');
  assert.equal(result.reg.version, 3, 'it is migrated to version 3');
  assert.ok(result.reg.sessions && typeof result.reg.sessions === 'object',
    'a sessions map is added');
  assert.equal(result.reg.last_active, 'room-a',
    'last_active is seeded from active');
});

// --- resolveActiveRoom: existing entry + v2-on-disk + abs path (SESSION-ISO-128.1-01) -

test('resolveActiveRoom: a session with an existing sessions[id].room resolves that room', () => {
  const ctx = withHermeticRooms();
  try {
    // First resolution writes sessions[id]; a deliberate bind pins room-b.
    sessionBinding.bindSessionRoom('sess-pinned', 'room-b');
    const result = sessionBinding.resolveActiveRoom('sess-pinned');
    assert.equal(result.room, 'room-b',
      'a session bound to room-b resolves room-b, not the global active');
    assert.ok(path.isAbsolute(result.path),
      'resolveActiveRoom returns an absolute directory path');
    assert.ok(result.path.endsWith('room-b'),
      'the resolved path points at the room-b directory');
  } finally {
    ctx.restore();
  }
});

test('resolveActiveRoom: a v2 registry on disk is lazy-migrated to v3 in place', () => {
  const ctx = withHermeticRooms();
  try {
    assert.equal(readRegistry(ctx.home).version, 2,
      'the on-disk fixture starts at version 2');
    const result = sessionBinding.resolveActiveRoom('sess-lazy-migrate');
    assert.ok(result && result.room, 'resolveActiveRoom returns a room');
    const after = readRegistry(ctx.home);
    assert.equal(after.version, 3,
      'the on-disk registry is migrated to version 3 by the read path');
    assert.ok(after.sessions && typeof after.sessions === 'object',
      'a sessions map is now on disk');
  } finally {
    ctx.restore();
  }
});

// --- bindSessionRoom: write shape + legacy mirror (SESSION-ISO-128.1-06) -------

test('bindSessionRoom: writes sessions[id] + last_active + the legacy active mirror', () => {
  const ctx = withHermeticRooms();
  try {
    sessionBinding.bindSessionRoom('sess-binder', 'room-b');
    const reg = readRegistry(ctx.home);
    assert.equal(reg.version, 3, 'the registry is at version 3 after a bind');
    assert.ok(reg.sessions['sess-binder'],
      'a sessions entry was written for the binding session');
    assert.equal(reg.sessions['sess-binder'].room, 'room-b',
      'the sessions entry records the bound room');
    assert.ok(reg.sessions['sess-binder'].bound_at,
      'the sessions entry carries a bound_at timestamp');
    assert.ok(reg.sessions['sess-binder'].last_seen_at,
      'the sessions entry carries a last_seen_at timestamp');
    assert.equal(reg.last_active, 'room-b', 'last_active is updated to the bound room');
    assert.equal(reg.active, 'room-b',
      'the legacy active mirror is also updated (D-04 backward compat)');
  } finally {
    ctx.restore();
  }
});

// --- LOST-WRITE: two concurrent forked writers both keep their entry ----------

test('bindSessionRoom: two concurrent forked writers both retain their sessions entry (3x)', () => {
  const worker = path.join(
    __dirname, '..', '..', 'tests', 'fixtures', 'session-isolation', 'bind-worker.cjs'
  );
  for (let run = 0; run < 3; run++) {
    const ctx = withHermeticRooms();
    try {
      const idA = 'sess-fork-a-' + run;
      const idB = 'sess-fork-b-' + run;
      // Launch both writers as detached children that race the same file.
      const procA = require('node:child_process').fork(worker, [idA, 'room-a'], {
        env: Object.assign({}, process.env,
          { MINDRIAN_ROOMS_HOME: ctx.home, MINDRIAN_HOME: ctx.dotMindrian }),
        stdio: 'ignore',
      });
      const procB = require('node:child_process').fork(worker, [idB, 'room-b'], {
        env: Object.assign({}, process.env,
          { MINDRIAN_ROOMS_HOME: ctx.home, MINDRIAN_HOME: ctx.dotMindrian }),
        stdio: 'ignore',
      });
      // Busy-wait for both children to exit (node:test has no top-level await
      // in this CJS idiom; the children are short-lived).
      const deadline = Date.now() + 10000;
      let aDone = false; let bDone = false;
      procA.on('exit', () => { aDone = true; });
      procB.on('exit', () => { bDone = true; });
      while ((!aDone || !bDone) && Date.now() < deadline) {
        execFileSync(process.execPath, ['-e', 'setTimeout(()=>{},20)']);
      }
      assert.ok(aDone && bDone, 'both forked writers exited within the deadline');
      const reg = readRegistry(ctx.home);
      assert.ok(reg.sessions[idA],
        'run ' + run + ': writer A sessions entry survived the concurrent write');
      assert.ok(reg.sessions[idB],
        'run ' + run + ': writer B sessions entry survived the concurrent write');
      assert.equal(reg.sessions[idA].room, 'room-a',
        'run ' + run + ': writer A bound room-a');
      assert.equal(reg.sessions[idB].room, 'room-b',
        'run ' + run + ': writer B bound room-b');
    } finally {
      ctx.restore();
    }
  }
});

// --- tripwire: fire / self-switch no-fire / warn-once (SESSION-ISO-128.1-07) ---

test('tripwire: an external rebind under a session fires the tripwire on next resolve', () => {
  const ctx = withHermeticRooms();
  try {
    // Session A resolves room-a (first resolution -- writes sessions[A], side file).
    const first = sessionBinding.resolveActiveRoom('sess-A');
    assert.equal(first.tripwire.fired, false, 'first resolution does not fire');
    const firstRoom = first.room;
    // An EXTERNAL actor (another session) rebinds sessions[A].room directly.
    const reg = readRegistry(ctx.home);
    const otherRoom = firstRoom === 'room-a' ? 'room-b' : 'room-a';
    reg.sessions['sess-A'].room = otherRoom;
    fs.writeFileSync(
      path.join(ctx.home, '.rooms', 'registry.json'),
      JSON.stringify(reg, null, 2) + '\n'
    );
    // Session A resolves again -- the binding moved underneath it.
    const second = sessionBinding.resolveActiveRoom('sess-A');
    assert.equal(second.tripwire.fired, true,
      'the tripwire fires when the binding changed underneath the session');
    assert.equal(second.tripwire.expected, firstRoom,
      'tripwire.expected is the room this session last resolved');
    assert.equal(second.tripwire.actual, otherRoom,
      'tripwire.actual is the room the binding was moved to');
  } finally {
    ctx.restore();
  }
});

test('tripwire: a deliberate self-switch via bindSessionRoom does NOT fire (Pitfall 5)', () => {
  const ctx = withHermeticRooms();
  try {
    sessionBinding.resolveActiveRoom('sess-self');       // first resolution
    sessionBinding.bindSessionRoom('sess-self', 'room-b'); // deliberate switch
    const after = sessionBinding.resolveActiveRoom('sess-self');
    assert.equal(after.tripwire.fired, false,
      'a self-initiated switch updates the expected-binding record, no false fire');
    assert.equal(after.room, 'room-b',
      'the resolve still lands on the deliberately-chosen room');
  } finally {
    ctx.restore();
  }
});

test('tripwire: after firing once for a session it does NOT re-fire (warn-once)', () => {
  const ctx = withHermeticRooms();
  try {
    const first = sessionBinding.resolveActiveRoom('sess-warnonce');
    const firstRoom = first.room;
    const otherRoom = firstRoom === 'room-a' ? 'room-b' : 'room-a';
    // External rebind.
    const reg = readRegistry(ctx.home);
    reg.sessions['sess-warnonce'].room = otherRoom;
    fs.writeFileSync(
      path.join(ctx.home, '.rooms', 'registry.json'),
      JSON.stringify(reg, null, 2) + '\n'
    );
    const fireResolve = sessionBinding.resolveActiveRoom('sess-warnonce');
    assert.equal(fireResolve.tripwire.fired, true, 'the tripwire fires the first time');
    const reResolve = sessionBinding.resolveActiveRoom('sess-warnonce');
    assert.equal(reResolve.tripwire.fired, false,
      'a subsequent resolve does NOT re-fire the tripwire (warn-once)');
  } finally {
    ctx.restore();
  }
});

// Touch HOME_DIR so the lint-unused guard stays quiet; it documents that the
// real (non-hermetic) side-file root is the user home -- the hermetic helper
// overrides MINDRIAN_HOME so tests never write there.
void HOME_DIR;
