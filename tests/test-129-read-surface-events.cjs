'use strict';
// Phase 129-02 -- read-surface event emission behavior suite.
//
// Asserts that the three READ-surface spine scripts emit the right memory_event
// through the Plan 01 navigation helpers, with the right payload shape, on every
// render, while carrying ZERO direct room.db access (substrate guard clean).
//
//   scripts/mos-status.cjs        -> spine_read (surface='status')
//   scripts/memory-command.cjs    -> spine_read (surface='memory', layer=<sub>)
//   scripts/suggest-next-command.cjs -> suggestion_surfaced (commands + scores)
//
// Hermetic: each fixture builds a tmp room with .mindrian/room.db via the
// canonical openRoomDb chokepoint (allow-listed under tests/). The scripts are
// driven in-process (their exported render/dispatch/main functions) so the
// emitted events can be read straight back from the seeded room.db.
//
// Canon Part 8 / Part 9: all room.db access is through navigation surfaces.
// NO em-dashes in this file (CLAUDE.md HARD RULE).

const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const memoryEvents = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs'));
const checkSubstrate = require(path.join(REPO_ROOT, 'scripts', 'check-substrate.cjs'));

const mosStatus = require(path.join(REPO_ROOT, 'scripts', 'mos-status.cjs'));
const memoryCommand = require(path.join(REPO_ROOT, 'scripts', 'memory-command.cjs'));
const suggestNext = require(path.join(REPO_ROOT, 'scripts', 'suggest-next-command.cjs'));

// ---------------------------------------------------------------------------
// Fixture helpers.
// ---------------------------------------------------------------------------

// Build a tmp room directory with a real .mindrian/room.db. The room carries a
// single section with a MINTO governing thought so /mos:status renders a real
// row. Returns { roomDir, slug }.
function makeRoom(opts) {
  const o = opts || {};
  const slug = o.slug || 'fixture-room';
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-129-02-home-'));
  const roomDir = path.join(home, slug);
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '# ' + slug + '\n');
  fs.writeFileSync(path.join(roomDir, 'STATE.md'),
    'problem_type: ill-defined\nactive_jtbd: validate-market\n');
  if (o.withRoomDb !== false) {
    const db = openRoomDb(roomDir);
    closeRoomDb(db);
  }
  // One section with ROOM.md so resolveRoomRoot + enumerateSections find it.
  const sectionDir = path.join(roomDir, 'problem-definition');
  fs.mkdirSync(sectionDir, { recursive: true });
  fs.writeFileSync(path.join(sectionDir, 'ROOM.md'), '# problem-definition\n');
  return { home, roomDir, slug };
}

// Seed a rooms registry under MINDRIAN_ROOMS_HOME so memory-command resolves the
// active room dir to our tmp room. Returns the home dir.
function seedRegistry(home, slug, roomDir) {
  const regDir = path.join(home, '.rooms');
  fs.mkdirSync(regDir, { recursive: true });
  fs.writeFileSync(path.join(regDir, 'registry.json'), JSON.stringify({
    active_room: slug,
    rooms: [{ slug: slug, abs_path: roomDir }],
  }));
  return home;
}

function cleanup(home) {
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

// Read all events of a given type from the seeded room.db (test-side open is
// allow-listed under tests/).
function readEvents(roomDir, eventType) {
  const db = openRoomDb(roomDir);
  try {
    return memoryEvents.findRecentChanges(db, 0, { eventType: eventType, limit: 100 }) || [];
  } finally {
    try { closeRoomDb(db); } catch (_) { /* ignore */ }
  }
}

// Capture process.stdout.write for the duration of fn(). Returns the captured
// string. Restores the original writer in finally.
function captureStdout(fn) {
  const orig = process.stdout.write;
  let buf = '';
  process.stdout.write = function (chunk) { buf += String(chunk); return true; };
  try {
    fn();
  } finally {
    process.stdout.write = orig;
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Task 1 -- /mos:status emits spine_read (surface=status)
// ---------------------------------------------------------------------------

function test_status_emits_one_spine_read() {
  const { home, roomDir } = makeRoom();
  try {
    const out = mosStatus.renderStatus({ cwd: roomDir });
    ok(typeof out === 'string' && out.length > 0, 'renderStatus returns output');
    mosStatus.emitSpineRead(roomDir, { section: 'all' });
    const events = readEvents(roomDir, 'spine_read');
    equal(events.length, 1, 'exactly one spine_read after a single status render');
    const props = events[0].properties || {};
    equal(props.surface, 'status', 'surface=status');
    ok('section' in props, 'payload carries a section');
    ok('jtbd' in props, 'payload carries a jtbd snapshot');
    ok('operator' in props, 'payload carries an operator snapshot');
  } finally {
    cleanup(home);
  }
}

function test_status_dedupes_on_repeat() {
  const { home, roomDir } = makeRoom();
  try {
    mosStatus.emitSpineRead(roomDir, { section: 'all' });
    mosStatus.emitSpineRead(roomDir, { section: 'all' });
    const events = readEvents(roomDir, 'spine_read');
    equal(events.length, 1, 'two no-op status renders dedupe to one spine_read (60s TTL)');
  } finally {
    cleanup(home);
  }
}

function test_status_no_room_db_is_graceful() {
  const { home, roomDir } = makeRoom({ withRoomDb: false });
  try {
    // Render must still print; emission must be a no-op (no throw, no db).
    const out = mosStatus.renderStatus({ cwd: roomDir });
    ok(typeof out === 'string', 'render still works with no room.db');
    const res = mosStatus.emitSpineRead(roomDir, { section: 'all' });
    ok(res && res.ok === false && res.reason === 'no_room_db',
      'emitSpineRead returns no_room_db when room.db absent');
    ok(!fs.existsSync(path.join(roomDir, '.mindrian', 'room.db')),
      'no room.db was created by the emission');
  } finally {
    cleanup(home);
  }
}

// ---------------------------------------------------------------------------
// Task 1 -- /mos:memory emits spine_read (surface=memory, layer=<sub>)
// ---------------------------------------------------------------------------

function test_memory_overview_emits_spine_read() {
  const { home, roomDir, slug } = makeRoom({ slug: 'mem-room' });
  seedRegistry(home, slug, roomDir);
  const prevHome = process.env.MINDRIAN_ROOMS_HOME;
  process.env.MINDRIAN_ROOMS_HOME = home;
  try {
    captureStdout(function () {
      // dispatch is async; resolve synchronously via the returned promise.
      return memoryCommand.dispatch(['overview'], {});
    });
    // dispatch returns a promise; await it deterministically.
  } finally {
    process.env.MINDRIAN_ROOMS_HOME = prevHome;
  }
  // Re-run with an explicit await so the emission has flushed.
  return (async function () {
    process.env.MINDRIAN_ROOMS_HOME = home;
    try {
      const buf = [];
      const orig = process.stdout.write;
      process.stdout.write = function (c) { buf.push(String(c)); return true; };
      try {
        await memoryCommand.dispatch(['overview'], {});
      } finally {
        process.stdout.write = orig;
      }
      const events = readEvents(roomDir, 'spine_read');
      const memEvents = events.filter(function (e) {
        return e.properties && e.properties.surface === 'memory';
      });
      ok(memEvents.length >= 1, 'at least one spine_read with surface=memory');
      equal(memEvents[0].properties.layer, 'overview', 'layer names the subcommand');
    } finally {
      process.env.MINDRIAN_ROOMS_HOME = prevHome;
      cleanup(home);
    }
  })();
}

function test_memory_optout_emits_nothing() {
  const { home, roomDir, slug } = makeRoom({ slug: 'mem-optout-room' });
  seedRegistry(home, slug, roomDir);
  const prevHome = process.env.MINDRIAN_ROOMS_HOME;
  return (async function () {
    process.env.MINDRIAN_ROOMS_HOME = home;
    try {
      const orig = process.stdout.write;
      process.stdout.write = function () { return true; };
      try {
        await memoryCommand.dispatch(['--opt-out'], {});
      } finally {
        process.stdout.write = orig;
      }
      const events = readEvents(roomDir, 'spine_read');
      equal(events.length, 0, '--opt-out emits no spine_read (user opted out of memory)');
    } finally {
      process.env.MINDRIAN_ROOMS_HOME = prevHome;
      cleanup(home);
    }
  })();
}

// ---------------------------------------------------------------------------
// Task 2 -- /mos:suggest-next emits suggestion_surfaced (commands + scores)
// ---------------------------------------------------------------------------

function test_suggest_emits_suggestion_surfaced() {
  const { home, roomDir } = makeRoom({ slug: 'suggest-room' });
  try {
    const captured = captureStdout(function () {
      suggestNext.main(['node', 'suggest-next-command.cjs', '--room', roomDir]);
    });
    ok(typeof captured === 'string' && captured.length > 0, 'suggest-next printed output');
    const events = readEvents(roomDir, 'suggestion_surfaced');
    equal(events.length, 1, 'exactly one suggestion_surfaced');
    const props = events[0].properties || {};
    ok(Array.isArray(props.commands), 'commands is an array');
    // Every command entry is { command, score } when non-empty.
    for (const c of props.commands) {
      ok(typeof c.command === 'string', 'each command entry has a command string');
      ok(typeof c.score === 'number', 'each command entry has a numeric score');
    }
    if (props.commands.length > 0) {
      const maxScore = props.commands.reduce(function (m, c) {
        return c.score > m ? c.score : m;
      }, -Infinity);
      equal(props.top_score, maxScore, 'top_score is the max command score');
    }
  } finally {
    cleanup(home);
  }
}

// main() calls process.exit; verify it is suppressible so the in-process test
// works. We override process.exit during the render to keep the test alive.
function withSuppressedExit(fn) {
  const origExit = process.exit;
  process.exit = function () { /* swallow */ };
  try {
    return fn();
  } finally {
    process.exit = origExit;
  }
}

// ---------------------------------------------------------------------------
// Substrate guard -- the 3 scripts carry zero direct room.db access.
// ---------------------------------------------------------------------------

function test_substrate_clean() {
  const files = [
    'scripts/mos-status.cjs',
    'scripts/memory-command.cjs',
    'scripts/suggest-next-command.cjs',
  ];
  const violations = checkSubstrate.scanFiles(files, function (p) {
    return fs.readFileSync(path.join(REPO_ROOT, p), 'utf8');
  });
  equal(violations.length, 0,
    'zero substrate violations across the 3 read-surface scripts: ' + JSON.stringify(violations));
}

// ---------------------------------------------------------------------------
// Runner.
// ---------------------------------------------------------------------------

async function run() {
  const sync = [
    test_status_emits_one_spine_read,
    test_status_dedupes_on_repeat,
    test_status_no_room_db_is_graceful,
    test_suggest_emits_suggestion_surfaced,
    test_substrate_clean,
  ];
  const asyncTests = [
    test_memory_overview_emits_spine_read,
    test_memory_optout_emits_nothing,
  ];
  let passed = 0;
  for (const t of sync) {
    await withSuppressedExit(function () { return t(); });
    passed += 1;
    process.stderr.write('ok   ' + t.name + '\n');
  }
  for (const t of asyncTests) {
    await t();
    passed += 1;
    process.stderr.write('ok   ' + t.name + '\n');
  }
  process.stderr.write('\n' + passed + '/' + (sync.length + asyncTests.length) + ' read-surface tests passed\n');
}

run().then(function () {
  process.stdout.write('PASS test-129-read-surface-events\n');
}).catch(function (err) {
  process.stderr.write('FAIL: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
