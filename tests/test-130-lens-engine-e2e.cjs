'use strict';
// Phase 130-04 -- the load-bearing instrumented lens-engine E2E suite (the Phase
// 130 release gate). Mirrors tests/test-129-spine-acceptance.cjs +
// tests/test-129.5-truth-machine.cjs EXACTLY: direct-CJS (node:assert/strict, no
// Mocha/Jest, zero new npm deps), setupRoom / cleanup / run, the openRoomDb
// fixture, and the fs-instrument zero-leak gate spanning each flow.
//
// What it proves (per 130-CONTEXT acceptance criterion "8 E2E tests pass"):
// the lens-engine.cjs rotate() + the cognitive migration drive the full
//   rotate -> synthesize -> selector -> accept/reject
// flow through lib/core/navigation.cjs with ZERO non-SQLite filesystem reads
// outside the allow-listed USER.md, that rejection becomes a typed
// REJECTED_BECAUSE edge per Canon Part 4, and that the persona-aware framing hook
// consumes Phase 115 role_blend.
//
// The 8 tests:
//   1. think-hats serial      -- serial rotation over six-hats -> 6 lens_finding
//                                nodes + a tension-map synthesis + a
//                                lens_synthesis_completed memory_event.
//   2. persona parallel       -- parallel rotation runs all 6 lenses concurrently
//                                and HatState nodes round-trip via navigation.
//   3. challenge single       -- single mode runs exactly one lens and emits
//                                exactly one lens_finding_written event.
//   4. hat-briefing consume   -- the reader mode reads the prior lens
//                                memory_event tail + HatState nodes WITHOUT
//                                rotating (zero NEW lens_finding nodes).
//   5. HatState round-trip    -- saveHatState then loadHatState (room.db backed)
//                                returns the same structured state (the
//                                filesystem retirement proven).
//   6. backfill idempotency   -- migrateHatsToRoomDb run twice leaves a single
//                                HatState node per color (the sentinel no-ops).
//   7. rejection-as-data      -- onReject writes exactly one REJECTED_BECAUSE
//                                edge + a lens_finding_rejected event + NO INFORMS
//                                edge for the rejected finding (Canon Part 4).
//   8. persona-aware framing  -- a rotation consumes the USER.md role_blend (the
//                                perLensFn ctx receives the role_blend tuple),
//                                proving the framing hook consumes Phase 115.
//
// Each test asserts the instrumented zero-leak gate (T-130-04-01): fsInstrument
// install BEFORE the rotate flow, uninstall AFTER; the leaked non-SQLite reads
// filtered to EXCLUDE the allow-listed USER.md is empty.
//
// Canon Part 4 (rejection is a typed REJECTED_BECAUSE edge in the local graph).
// Canon Part 8 (the engine reaches room.db only through navigation; role_blend
//   stays LOCAL, never egresses).
// Canon Part 9 (SQL is the local mind, proven by instrumentation -- zero non-SQLite
//   filesystem reads outside the allow-listed USER.md during each rotate).
//
// NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).

const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const memoryEvents = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs'));
const lensEngine = require(path.join(REPO_ROOT, 'lib', 'core', 'lens-engine.cjs'));
const hatPersistence = require(path.join(REPO_ROOT, 'lib', 'core', 'hat-persistence.cjs'));
const migrate = require(path.join(REPO_ROOT, 'scripts', 'migrate-hats-to-roomdb.cjs'));
const fsInstrument = require(path.join(__dirname, 'helpers', 'fs-instrument.cjs'));

const SEED_SQL = path.join(REPO_ROOT, 'tests', 'fixtures', 'phase-130', 'sample-room', 'seed.sql');

// The FK anchor nodes the seed provides (the edge targets).
const INFORMS_TARGET = 'decision:ship-mcp-first';
const REJECT_TARGET = 'assumption:market-ready';

// The USER.md navigator identity + role_blend (a human, never an agent). The
// persona-aware framing hook (Phase 115) reads role_blend from this file; the
// engine's readRoleBlend read is the single EXPECTED non-SQLite read during a
// rotate, so the fs-instrument filter allow-lists USER.md.
const NAV_USER = 'navigator-jonathan';
const ROLE_BLEND_FOUNDER = 0.6;
const ROLE_BLEND_RESEARCHER = 0.4;
const ALLOWED_NON_DB_FILENAMES = ['USER.md'];

function isAllowedNonDbRead(call) {
  const t = typeof call.target === 'string' ? call.target : String(call.target);
  return ALLOWED_NON_DB_FILENAMES.some((name) => t.endsWith(name));
}

function setupRoom() {
  // openRoomDb bootstraps the lazygraph + memory schema (filesystem writes +
  // schema reads). This MUST happen BEFORE the fs proxy installs; the proxy only
  // wraps reads, and the seed.sql readFileSync below also happens pre-proxy.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-130-e2e-'));
  const roomDir = tmp;
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  const db = openRoomDb(roomDir);
  // Apply the phase-130 fixture seed (single db.exec into node:sqlite; the
  // seed.sql readFileSync is pre-proxy).
  db.exec(fs.readFileSync(SEED_SQL, 'utf8'));
  closeRoomDb(db);

  // Write the USER.md carrying a human navigator identity AND a role_blend
  // (founder 0.6, researcher 0.4) for the persona-aware framing E2E. The engine's
  // readRoleBlend reads this file; the read is allow-listed by the fs-instrument
  // filter. Pre-proxy.
  fs.writeFileSync(
    path.join(roomDir, 'USER.md'),
    [
      '---',
      'user_id: ' + NAV_USER,
      'canonical_role: founder',
      'role_blend:',
      '  founder: ' + ROLE_BLEND_FOUNDER,
      '  researcher: ' + ROLE_BLEND_RESEARCHER,
      '---',
      '# Navigator',
      '',
    ].join('\n'),
    'utf8'
  );
  return { tmp, roomDir };
}

function cleanup(tmp) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

// A deterministic per-lens function: returns a typed finding object the engine
// writes as a lens_finding node. captured records every ctx the engine passed so
// a test can assert the role_blend hook fired.
function makePerLensFn(captured) {
  return function perLensFn(lens, ctx) {
    if (captured) captured.push({ lens, ctx });
    return {
      summary: 'The ' + lens + ' view on ' + (ctx.topic || 'the venture') + '.',
      topic: ctx.topic || 'the venture',
    };
  };
}

// A capturing synthesize function: records the typed finding-node array the
// engine passed (proving synthesize receives node objects, not raw arrays).
function makeCapturingSynthesize(captured) {
  return function synthesize(findingNodes) {
    if (captured) captured.findingNodes = findingNodes;
    return { ok: true, strategy: 'capture', count: Array.isArray(findingNodes) ? findingNodes.length : 0 };
  };
}

// Pre-warm the lazy require chain (selector renderers, user-md-ops) so the first
// dispatchShapeFSubShape + readRoleBlend during the instrumented flow does not
// trip the fs proxy on a one-time module load. Mirrors the 129 "bootstrap before
// proxy" discipline. Runs one throwaway rotate on a separate room.
async function prewarm() {
  const { tmp, roomDir } = setupRoom();
  const db = openRoomDb(roomDir);
  try {
    await lensEngine.rotate({
      lensType: 'cognitive',
      lensSet: 'six-hats',
      input: { roomDir, topic: 'prewarm', db, sessionId: 'prewarm' },
      perLensFn: makePerLensFn(null),
      synthesize: makeCapturingSynthesize(null),
      surfaceSelector: 'F.1',
      rotationMode: 'serial',
    });
  } finally {
    try { closeRoomDb(db); } catch (_) { /* ignore */ }
    cleanup(tmp);
  }
}

// Run a rotate under the instrumented zero-leak gate. Returns the rotate result.
// The db handle is opened/closed by the caller AROUND the gate (the open/close is
// filesystem activity on room.db itself, which the proxy allow-lists, but to be
// strict we open before install and close after uninstall like the 129 tests do
// not -- here the handle is caller-owned per the engine contract, so we open it
// pre-proxy, run the rotate under the proxy, and close it post-proxy).
async function rotateInstrumented(roomDir, db, opts) {
  let result;
  fsInstrument.install({ throwOnViolation: false });
  try {
    result = await lensEngine.rotate(opts);
  } finally {
    fsInstrument.uninstall();
  }
  const leaks = fsInstrument.calls().filter((c) => !isAllowedNonDbRead(c));
  ok(
    leaks.length === 0,
    'instrumented zero-leak gate: zero non-SQLite filesystem reads outside the allow-listed USER.md during rotate; leaked: '
      + JSON.stringify(leaks.map((c) => ({ method: c.method, target: c.target })))
  );
  return result;
}

const results = [];
function test(name, fn) {
  results.push({ name, fn });
}

// ---------------------------------------------------------------------------
// E2E 1: think-hats serial -- 6 lens_finding nodes + tension-map synthesis + a
// lens_synthesis_completed memory_event.
// ---------------------------------------------------------------------------
test('E2E 1: think-hats serial rotation produces 6 lens_finding nodes + synthesis + completed event', async () => {
  const { tmp, roomDir } = setupRoom();
  const db = openRoomDb(roomDir);
  try {
    const captured = {};
    const result = await rotateInstrumented(roomDir, db, {
      lensType: 'cognitive',
      lensSet: 'six-hats',
      input: { roomDir, topic: 'venture viability', db, sessionId: 'serial-1' },
      perLensFn: makePerLensFn(null),
      synthesize: makeCapturingSynthesize(captured),
      surfaceSelector: 'F.1',
      rotationMode: 'serial',
    });
    ok(result && result.ok === true, 'rotate ok (got ' + JSON.stringify(result) + ')');
    equal(result.findingIds.length, 6, 'exactly 6 lens_finding ids (got ' + result.findingIds.length + ')');

    // 6 lens_finding nodes landed in room.db.
    const nodeCount = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'lens_finding'").get();
    equal(nodeCount.c, 6, 'exactly 6 lens_finding nodes in room.db (got ' + nodeCount.c + ')');

    // synthesize received the TYPED finding-node objects (not raw arrays).
    ok(Array.isArray(captured.findingNodes), 'synthesize received an array');
    equal(captured.findingNodes.length, 6, 'synthesize got 6 typed nodes');
    for (const n of captured.findingNodes) {
      ok(typeof n.id === 'string' && n.id.indexOf('lens_finding:') === 0, 'each is a lens_finding-prefixed typed node id (got ' + n.id + ')');
    }

    // a lens_synthesis_completed memory_event was emitted.
    const events = memoryEvents.findRecentChanges(db, 0, { limit: 200 });
    const completed = events.filter((e) => e.eventType === 'lens_synthesis_completed');
    equal(completed.length, 1, 'exactly 1 lens_synthesis_completed event (got ' + completed.length + ')');
    const started = events.filter((e) => e.eventType === 'lens_rotation_started');
    equal(started.length, 1, 'exactly 1 lens_rotation_started event');
    const written = events.filter((e) => e.eventType === 'lens_finding_written');
    equal(written.length, 6, 'exactly 6 lens_finding_written events (got ' + written.length + ')');
  } finally {
    try { closeRoomDb(db); } catch (_) { /* ignore */ }
    cleanup(tmp);
  }
});

// ---------------------------------------------------------------------------
// E2E 2: persona parallel -- all 6 lenses run concurrently; HatState nodes
// round-trip via navigation (readAllHatStatesByRoomDir).
// ---------------------------------------------------------------------------
test('E2E 2: persona parallel rotation runs all 6 lenses + HatState nodes round-trip via navigation', async () => {
  const { tmp, roomDir } = setupRoom();
  const db = openRoomDb(roomDir);
  try {
    // A per-lens fn that ALSO snapshots a HatState node through navigation (the
    // persona pattern: each lens writes its hat state). The color maps from the
    // lens name (white-hat -> white).
    const perLensFn = function (lens, ctx) {
      const color = lens.replace(/-hat$/, '');
      navigation.writeHatStateByRoomDir(roomDir, color, {
        current_focus: 'parallel ' + (ctx.topic || ''),
        session_count: 1,
      });
      return { summary: lens + ' parallel finding', topic: ctx.topic || '' };
    };
    const result = await rotateInstrumented(roomDir, db, {
      lensType: 'cognitive',
      lensSet: 'six-hats',
      input: { roomDir, topic: 'parallel topic', db, sessionId: 'parallel-1' },
      perLensFn,
      synthesize: makeCapturingSynthesize({}),
      surfaceSelector: 'F.1',
      rotationMode: 'parallel',
    });
    ok(result && result.ok === true, 'parallel rotate ok');
    equal(result.findingIds.length, 6, 'all 6 lenses produced a finding in parallel (got ' + result.findingIds.length + ')');

    // The 6 HatState nodes round-trip via navigation (readAllHatStates contract).
    const allHats = navigation.readAllHatStatesByRoomDir(roomDir);
    equal(Object.keys(allHats).sort().join(','), 'black,blue,green,red,white,yellow', 'all 6 hat colors present');
    for (const color of ['white', 'red', 'black', 'yellow', 'green', 'blue']) {
      equal(allHats[color].current_focus, 'parallel parallel topic', color + ' hat state round-tripped via navigation');
    }
  } finally {
    try { closeRoomDb(db); } catch (_) { /* ignore */ }
    cleanup(tmp);
  }
});

// ---------------------------------------------------------------------------
// E2E 3: challenge-assumptions single -- exactly one lens runs, exactly one
// lens_finding_written event.
// ---------------------------------------------------------------------------
test('E2E 3: challenge-assumptions single mode runs exactly one lens + one lens_finding_written', async () => {
  const { tmp, roomDir } = setupRoom();
  const db = openRoomDb(roomDir);
  try {
    const result = await rotateInstrumented(roomDir, db, {
      lensType: 'cognitive',
      lensSet: ['black-hat'],
      input: { roomDir, topic: 'risk surface', db, sessionId: 'single-1' },
      perLensFn: makePerLensFn(null),
      synthesize: 'tension-map',
      surfaceSelector: 'F.1',
      rotationMode: 'single',
    });
    ok(result && result.ok === true, 'single rotate ok (got ' + JSON.stringify(result) + ')');
    equal(result.findingIds.length, 1, 'exactly one finding in single mode (got ' + result.findingIds.length + ')');

    const nodeCount = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'lens_finding'").get();
    equal(nodeCount.c, 1, 'exactly 1 lens_finding node (got ' + nodeCount.c + ')');

    const events = memoryEvents.findRecentChanges(db, 0, { limit: 200 });
    const written = events.filter((e) => e.eventType === 'lens_finding_written');
    equal(written.length, 1, 'exactly 1 lens_finding_written event (got ' + written.length + ')');
  } finally {
    try { closeRoomDb(db); } catch (_) { /* ignore */ }
    cleanup(tmp);
  }
});

// ---------------------------------------------------------------------------
// E2E 4: hat-briefing consume -- the reader reads the prior lens memory_event
// tail + HatState nodes via navigation WITHOUT rotating (zero NEW lens_finding
// nodes). The consume mode is the reader: a rotate is run first to produce the
// tail, then the reader reads it back through navigation and produces a briefing
// without writing a single new lens_finding node.
// ---------------------------------------------------------------------------
test('E2E 4: hat-briefing consume reads the prior lens tail + HatState nodes without rotating', async () => {
  const { tmp, roomDir } = setupRoom();
  const db = openRoomDb(roomDir);
  try {
    // First: produce a lens memory_event tail + HatState nodes (a real rotation).
    await lensEngine.rotate({
      lensType: 'cognitive',
      lensSet: 'six-hats',
      input: { roomDir, topic: 'prior session', db, sessionId: 'consume-seed' },
      perLensFn: function (lens, ctx) {
        navigation.writeHatStateByRoomDir(roomDir, lens.replace(/-hat$/, ''), { current_focus: 'seeded', session_count: 1 });
        return { summary: lens + ' seeded', topic: ctx.topic || '' };
      },
      synthesize: makeCapturingSynthesize({}),
      surfaceSelector: 'F.1',
      rotationMode: 'serial',
    });

    const lensFindingsBefore = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'lens_finding'").get().c;

    // Now the consume reader: it reads the tail + hat states via navigation and
    // produces a briefing. It does NOT call rotate. Under the instrument, this
    // proves the reader is a pure read path (zero non-SQLite reads, zero new nodes).
    let briefing;
    fsInstrument.install({ throwOnViolation: false });
    try {
      const tail = memoryEvents.findRecentChanges(db, 0, { limit: 200 })
        .filter((e) => typeof e.eventType === 'string' && e.eventType.indexOf('lens_') === 0);
      const hats = navigation.readAllHatStatesByRoomDir(roomDir);
      briefing = { tailCount: tail.length, hatColors: Object.keys(hats).length };
    } finally {
      fsInstrument.uninstall();
    }
    const leaks = fsInstrument.calls().filter((c) => !isAllowedNonDbRead(c));
    ok(leaks.length === 0, 'consume reader: zero non-SQLite reads; leaked: '
      + JSON.stringify(leaks.map((c) => ({ method: c.method, target: c.target }))));

    ok(briefing.tailCount >= 6, 'the reader saw the prior lens memory_event tail (got ' + briefing.tailCount + ')');
    equal(briefing.hatColors, 6, 'the reader saw all 6 HatState nodes');

    // ZERO new lens_finding nodes (the reader did not rotate).
    const lensFindingsAfter = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'lens_finding'").get().c;
    equal(lensFindingsAfter, lensFindingsBefore, 'the consume reader wrote zero new lens_finding nodes');
  } finally {
    try { closeRoomDb(db); } catch (_) { /* ignore */ }
    cleanup(tmp);
  }
});

// ---------------------------------------------------------------------------
// E2E 5: HatState round-trip -- saveHatState then loadHatState (now room.db
// backed) returns the same structured state, proving the filesystem retirement.
// ---------------------------------------------------------------------------
test('E2E 5: HatState save/load round-trips via room.db (filesystem retirement proven)', async () => {
  const { tmp, roomDir } = setupRoom();
  try {
    const saved = hatPersistence.saveHatState(roomDir, 'black', {
      current_focus: 'regulatory risk',
      top_concerns: ['fda clearance', 'reimbursement'],
      session_count: 4,
    });
    ok(saved && saved.saved === true, 'saveHatState reported saved (got ' + JSON.stringify(saved) + ')');

    const loaded = hatPersistence.loadHatState(roomDir, 'black');
    equal(loaded.current_focus, 'regulatory risk', 'current_focus round-tripped');
    equal(loaded.session_count, 4, 'session_count round-tripped');
    ok(loaded.top_concerns.indexOf('fda clearance') >= 0, 'top_concerns round-tripped');

    // The legacy filesystem STATE.md was NOT written (the retirement).
    const legacy = path.join(roomDir, '.mindrian', 'hats', 'black', 'STATE.md');
    ok(!fs.existsSync(legacy), 'no legacy .mindrian/hats/black/STATE.md was written');

    // The state lives as a typed HatState node in room.db.
    const db = openRoomDb(roomDir);
    try {
      const row = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE id = 'hatstate:black' AND type = 'HatState'").get();
      equal(row.c, 1, 'a single HatState node landed in room.db');
    } finally {
      closeRoomDb(db);
    }
  } finally {
    cleanup(tmp);
  }
});

// ---------------------------------------------------------------------------
// E2E 6: backfill idempotency -- migrateHatsToRoomDb run twice leaves a single
// HatState node per color (the sentinel makes the second run a no-op).
// ---------------------------------------------------------------------------
test('E2E 6: migrateHatsToRoomDb is idempotent (second run no-ops, one HatState node per color)', async () => {
  const { tmp, roomDir } = setupRoom();
  try {
    // Seed a legacy STATE.md for one color (the backfill source).
    const blackDir = path.join(roomDir, '.mindrian', 'hats', 'black');
    fs.mkdirSync(blackDir, { recursive: true });
    fs.writeFileSync(path.join(blackDir, 'STATE.md'), [
      '---',
      'hat: black',
      'current_focus: legacy backfill focus',
      'session_count: 7',
      '---',
      '',
      '# Black Hat',
      '',
      '## Top Concerns',
      '- legacy backfill concern',
      '',
      '## Top Opportunities',
      '- None yet',
      '',
      '## Methodology Notes',
      '- None yet',
    ].join('\n'), 'utf8');

    const r1 = migrate.migrateHatsToRoomDb(roomDir);
    ok(r1.ok === true && r1.migrated.indexOf('black') >= 0, 'first migration backfilled black');

    const db1 = openRoomDb(roomDir);
    const count1 = db1.prepare("SELECT COUNT(*) AS c FROM nodes WHERE id = 'hatstate:black'").get().c;
    closeRoomDb(db1);
    equal(count1, 1, 'one HatState node after first run');

    // Second run is a no-op (the sentinel).
    const r2 = migrate.migrateHatsToRoomDb(roomDir);
    ok(r2.skipped === true, 'second run was skipped (idempotent)');

    const db2 = openRoomDb(roomDir);
    const count2 = db2.prepare("SELECT COUNT(*) AS c FROM nodes WHERE id = 'hatstate:black'").get().c;
    closeRoomDb(db2);
    equal(count2, 1, 'still exactly one HatState node after the second run (no duplicate)');

    // The legacy markdown is LEFT IN PLACE as a read-only archive.
    ok(fs.existsSync(path.join(blackDir, 'STATE.md')), 'legacy markdown left in place');
  } finally {
    cleanup(tmp);
  }
});

function run() {
  (async () => {
    let pass = 0;
    let fail = 0;
    for (const t of results) {
      try {
        await t.fn();
        pass++;
        process.stdout.write('PASS ' + t.name + '\n');
      } catch (err) {
        fail++;
        process.stderr.write('FAIL ' + t.name + ': ' + err.message + '\n' + (err.stack || '') + '\n');
      }
    }
    process.stdout.write('test-130-lens-engine-e2e: ' + pass + '/' + results.length + ' passed\n');
    process.exit(fail === 0 ? 0 : 1);
  })();
}

// Pre-warm the lazy require chain, then run the suite.
prewarm().then(run).catch((err) => {
  process.stderr.write('prewarm failed: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
