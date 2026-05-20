'use strict';
// Phase 128.1 Plan 01 (Wave 0) -- THE named concurrent-session race regression
// test. RED BY DESIGN until Plans 02-05 ship the session-scoped binding,
// the lockfile, and the tripwire.
//
// This is the canonical validation surface for SESSION-ISO-128.1-04, -05, -06,
// -08, -11 (RESEARCH.md "The named validation surface"). It reproduces the
// live 2026-05-20 failure family: a heal process relocated the active room
// mid-session and a downstream tool read a stale room path, confidently
// reporting 0 entries for a 263-entry room.
//
// It `require`s ../lib/core/session-binding.cjs, which does not exist until
// Plan 02 -- so the file errors RED. The SCAFFOLD-RED banner below lets the
// executor and the run-all aggregator tell scaffold-RED (expected) from a
// real failure.
//
// Patterns mirrored:
//  - tests/test-sqlite-concurrent.cjs -- child_process.fork multi-process.
//  - MINDRIAN_ROOMS_HOME env override -- hermetic-fixture isolation.
//
// Run: node tests/test-session-isolation-race.cjs  -- exits NON-ZERO until Plan 02.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { fork } = require('child_process');

const SCAFFOLD_BANNER =
  '\n========================================================================\n' +
  ' SCAFFOLD-RED (EXPECTED): lib/core/session-binding.cjs does not exist yet.\n' +
  ' tests/test-session-isolation-race.cjs is THE named concurrent-session race\n' +
  ' regression test. Phase 128.1 Plan 01 ships it RED on purpose. Plans 02-05\n' +
  ' ship the session-scoped binding + lockfile + tripwire and turn it GREEN.\n' +
  ' A non-zero exit here is the de-risking signal, not a regression.\n' +
  '========================================================================\n';

const REPO_ROOT = path.resolve(__dirname, '..');
const V2_FIXTURE = path.join(
  REPO_ROOT, 'tests', 'fixtures', 'session-isolation', 'registry-v2-legacy.json'
);

// Load the module under test. Until Plan 02 ships it, this throws -- print the
// banner, then re-throw so the process exits non-zero (RED).
let sessionBinding;
try {
  sessionBinding = require(path.join(REPO_ROOT, 'lib', 'core', 'session-binding.cjs'));
} catch (err) {
  process.stderr.write(SCAFFOLD_BANNER);
  process.stderr.write('  require error: ' + err.message + '\n\n');
  throw err;
}

// ---------------------------------------------------------------------------
// Hermetic-fixture helpers (MINDRIAN_ROOMS_HOME isolation)
// ---------------------------------------------------------------------------

// Build a tmp MINDRIAN_ROOMS_HOME from registry-v2-legacy.json. The real
// ~/MindrianRooms is never touched. room-a is seeded with 263 entry files so
// case 6 (compute-state family) can prove the resolved path points at the
// populated room, not 0 entries.
function buildHermeticRoomsHome() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'session-iso-race-'));
  const dotRooms = path.join(tmp, '.rooms');
  fs.mkdirSync(dotRooms, { recursive: true });
  fs.copyFileSync(V2_FIXTURE, path.join(dotRooms, 'registry.json'));

  // room-a: the canonical 263-entry room. room-b: the colliding room.
  const roomA = path.join(tmp, 'room-a', 'problem-definition');
  const roomB = path.join(tmp, 'room-b', 'problem-definition');
  fs.mkdirSync(roomA, { recursive: true });
  fs.mkdirSync(roomB, { recursive: true });
  for (let i = 0; i < 263; i++) {
    fs.writeFileSync(path.join(roomA, 'entry-' + i + '.md'), '# entry ' + i + '\n');
  }
  return { roomsHome: tmp, registryPath: path.join(dotRooms, 'registry.json') };
}

function cleanup(roomsHome) {
  try { fs.rmSync(roomsHome, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
}

function countEntries(roomPath) {
  try {
    return fs.readdirSync(path.join(roomPath, 'problem-definition'))
      .filter((f) => f.endsWith('.md')).length;
  } catch (_e) { return 0; }
}

// ---------------------------------------------------------------------------
// Case 1 -- the hermetic fixture builds and is the v2 legacy shape
// ---------------------------------------------------------------------------

test('case 1: hermetic fixture builds from registry-v2-legacy.json', () => {
  const { roomsHome, registryPath } = buildHermeticRoomsHome();
  try {
    const reg = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    assert.equal(reg.version, 2, 'fixture starts as legacy v2');
    assert.equal(reg.active, 'room-a', 'fixture active points at room-a');
    assert.ok(reg.rooms['room-a'] && reg.rooms['room-b'], 'fixture has both rooms');
    assert.equal(countEntries(path.join(roomsHome, 'room-a')), 263,
      'room-a is the seeded 263-entry canonical room');
  } finally {
    cleanup(roomsHome);
  }
});

// ---------------------------------------------------------------------------
// Case 2 -- concurrent rebind: session A keeps its room after B set-actives
// ---------------------------------------------------------------------------

test('case 2: concurrent rebind -- session A still resolves room-a after session B switches', () => {
  const { roomsHome } = buildHermeticRoomsHome();
  const prevHome = process.env.MINDRIAN_ROOMS_HOME;
  try {
    process.env.MINDRIAN_ROOMS_HOME = roomsHome;
    sessionBinding.bindSessionRoom('sess-A', 'room-a');
    // Session B moves the global active to room-b.
    sessionBinding.bindSessionRoom('sess-B', 'room-b');
    // Post-fix: session A's resolution is unaffected by session B's switch.
    const a = sessionBinding.resolveActiveRoom('sess-A');
    assert.equal(a.room, 'room-a',
      'session A still resolves room-a despite session B rebinding the global');
  } finally {
    if (prevHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = prevHome;
    cleanup(roomsHome);
  }
});

// ---------------------------------------------------------------------------
// Case 3 -- lost-write: two forked processes each bind; both entries survive
// ---------------------------------------------------------------------------

test('case 3: lost-write -- two concurrent forked binds both retain their sessions entry', async () => {
  const { roomsHome, registryPath } = buildHermeticRoomsHome();
  try {
    // A child that binds one session under the shared lockfile.
    const childScript = path.join(roomsHome, 'child-bind.cjs');
    fs.writeFileSync(childScript, [
      "'use strict';",
      "const path = require('node:path');",
      "const sb = require(" + JSON.stringify(path.join(REPO_ROOT, 'lib', 'core', 'session-binding.cjs')) + ");",
      "process.env.MINDRIAN_ROOMS_HOME = process.argv[2];",
      "const r = sb.bindSessionRoom(process.argv[3], process.argv[4]);",
      "process.send({ ok: !!(r && r.ok) });",
    ].join('\n'));

    const runChild = (sessionId, room) => new Promise((resolve, reject) => {
      const c = fork(childScript, [roomsHome, sessionId, room], { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
      c.on('message', resolve);
      c.on('error', reject);
      setTimeout(() => reject(new Error('child timeout')), 5000);
    });

    const [r1, r2] = await Promise.all([
      runChild('sess-fork-1', 'room-a'),
      runChild('sess-fork-2', 'room-b'),
    ]);
    assert.equal(r1.ok, true, 'fork 1 bind succeeded');
    assert.equal(r2.ok, true, 'fork 2 bind succeeded');

    const reg = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    assert.ok(reg.sessions['sess-fork-1'], 'fork 1 sessions entry survived (no lost write)');
    assert.ok(reg.sessions['sess-fork-2'], 'fork 2 sessions entry survived (no lost write)');
  } finally {
    cleanup(roomsHome);
  }
});

// ---------------------------------------------------------------------------
// Case 4 -- tripwire: external rebind fires once; self-switch does not fire
// ---------------------------------------------------------------------------

test('case 4: tripwire fires on external rebind, not on self-switch, and warns once', () => {
  const { roomsHome, registryPath } = buildHermeticRoomsHome();
  const prevHome = process.env.MINDRIAN_ROOMS_HOME;
  try {
    process.env.MINDRIAN_ROOMS_HOME = roomsHome;
    sessionBinding.bindSessionRoom('sess-A', 'room-a');
    const first = sessionBinding.resolveActiveRoom('sess-A');
    assert.equal(first.tripwire.fired, false, 'no fire on the first clean resolution');

    // An external actor rewrites session A's binding (legacy global write /
    // another tool writing the wrong slot). Simulate by mutating the registry
    // directly, the way an un-migrated writer would.
    const reg = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    reg.sessions['sess-A'].room = 'room-b';
    fs.writeFileSync(registryPath, JSON.stringify(reg, null, 2));

    const afterExternal = sessionBinding.resolveActiveRoom('sess-A');
    assert.equal(afterExternal.tripwire.fired, true,
      'the tripwire fires when session A binding changed underneath it');
    assert.equal(afterExternal.tripwire.expected, 'room-a',
      'the tripwire reports the expected room');

    const secondResolve = sessionBinding.resolveActiveRoom('sess-A');
    assert.equal(secondResolve.tripwire.fired, false,
      'the tripwire warns ONCE -- the second resolve does not re-fire (D-10 warn-once)');

    // A deliberate self-switch must NOT fire the tripwire (Pitfall 5).
    sessionBinding.bindSessionRoom('sess-A', 'room-b');
    const afterSelfSwitch = sessionBinding.resolveActiveRoom('sess-A');
    assert.equal(afterSelfSwitch.tripwire.fired, false,
      'a deliberate self-switch does not fire the tripwire');
  } finally {
    if (prevHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = prevHome;
    cleanup(roomsHome);
  }
});

// ---------------------------------------------------------------------------
// Case 5 -- migration: v2 registry becomes v3 with rooms byte-identical
// ---------------------------------------------------------------------------

test('case 5: a v2 registry lazy-migrates to v3 with rooms byte-identical', () => {
  const { roomsHome, registryPath } = buildHermeticRoomsHome();
  const prevHome = process.env.MINDRIAN_ROOMS_HOME;
  try {
    process.env.MINDRIAN_ROOMS_HOME = roomsHome;
    const roomsBefore = JSON.stringify(JSON.parse(fs.readFileSync(registryPath, 'utf8')).rooms);

    // Any resolution lazy-migrates the registry on first touch.
    sessionBinding.resolveActiveRoom('sess-migrate');

    const reg = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    assert.equal(reg.version, 3, 'registry is migrated to version 3 on disk');
    assert.equal(JSON.stringify(reg.rooms), roomsBefore,
      'the rooms map is byte-identical after lazy migration');
  } finally {
    if (prevHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = prevHome;
    cleanup(roomsHome);
  }
});

// ---------------------------------------------------------------------------
// Case 6 -- compute-state family: the resolved path points at the 263-entry room
// ---------------------------------------------------------------------------

test('case 6: the resolved path points at the 263-entry room, not 0 entries', () => {
  const { roomsHome } = buildHermeticRoomsHome();
  const prevHome = process.env.MINDRIAN_ROOMS_HOME;
  try {
    process.env.MINDRIAN_ROOMS_HOME = roomsHome;
    sessionBinding.bindSessionRoom('sess-A', 'room-a');
    // A concurrent session relocates the global active, the way the heal
    // process did on 2026-05-20.
    sessionBinding.bindSessionRoom('sess-heal', 'room-b');

    const resolved = sessionBinding.resolveActiveRoom('sess-A');
    const count = countEntries(resolved.path);
    assert.equal(count, 263,
      'session A resolves the 263-entry room-a -- the canonical silent-wrong-answer bug is closed');
  } finally {
    if (prevHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = prevHome;
    cleanup(roomsHome);
  }
});
