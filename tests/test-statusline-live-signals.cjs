'use strict';
// Quick task 20260702-statusline-live-signals.
//
// Proves the two 192-04 NAMED DEBTS are closed:
//   (1) deriveNextMove reflects a CHANGED routed next step (the live wire), and
//       clears back to the jtbd proxy when the router abstains.
//   (2) the room-health signal CHANGES when ~/.mindrian/room-health.json changes.
//   (3) byte-stable degrade: with BOTH sources absent the statusline shows the
//       safe defaults (next_move honest "--" per Ruling 3c, health 'sound') -- no
//       crash, no regression.
//
// LOCAL only (Part 8): every read/write is a HOME/.mindrian file; the test isolates
// HOME to a temp dir. No em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const signals = require(path.join(REPO, 'lib', 'statusline', 'cockpit-signals.cjs'));
const nextMoveCache = require(path.join(REPO, 'lib', 'statusline', 'next-move-cache.cjs'));
const roomHealthCache = require(path.join(REPO, 'lib', 'statusline', 'room-health-cache.cjs'));

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-statusline-live-signals');

const savedHome = process.env.HOME;
const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-live-signals-'));
process.env.HOME = tmpHome;

try {
  // ---- (3) byte-stable degrade: both sources absent ----
  ok('byte-stable default: no cache -> next_move honest "--" + health sound', function () {
    const st = signals.collectSignals({ roomName: 'demo', ctxPct: 30 });
    assert.equal(st.next_move, '--', 'next_move defaults to the honest "--" placeholder when nothing is routed and no jtbd (Ruling 3c)');
    assert.equal(st.health, 'sound', 'health defaults to sound when no doctor cache exists');
    assert.equal(signals.readRoutedNextMove(), null, 'no routed cache -> null');
    assert.equal(signals.readHealthStatus(), null, 'no health cache -> null');
  });

  ok('jtbd proxy still wins over the continue default when no routed step exists', function () {
    const st = signals.collectSignals({ roomName: 'demo', ctxPct: 30, jtbd: 'validate' });
    assert.equal(st.next_move, 'validate', 'falls back to the jtbd proxy');
  });

  // ---- (1) LIVE next-move: reflects a CHANGED routed step ----
  ok('deriveNextMove reflects the routed step over the jtbd proxy', function () {
    assert.equal(nextMoveCache.persistNextMove({ command: '/mos:map-unknowns' }), true);
    // routed step now leads, even with a competing jtbd.
    assert.equal(signals.deriveNextMove({ jtbd: 'validate' }), 'map unknowns', 'routed step wins');
    const st = signals.collectSignals({ roomName: 'demo', ctxPct: 30, jtbd: 'validate' });
    assert.equal(st.next_move, 'map unknowns', 'collectSignals surfaces the routed step');
  });

  ok('the rendered Next cue CHANGES as the routed step changes', function () {
    nextMoveCache.persistNextMove({ command: '/mos:mullins' });
    assert.equal(signals.deriveNextMove({ jtbd: 'validate' }), 'mullins', 'cue tracks the new routed step');
    nextMoveCache.persistNextMove({ command: '/mos:structure-argument' });
    assert.equal(signals.deriveNextMove({ jtbd: 'validate' }), 'structure argument', 'cue tracks again');
  });

  ok('router abstention (null offer) CLEARS the cache -> back to the jtbd proxy', function () {
    nextMoveCache.persistNextMove(null);
    assert.equal(signals.readRoutedNextMove(), null, 'cache cleared on abstention');
    assert.equal(signals.deriveNextMove({ jtbd: 'validate' }), 'validate', 'falls back to jtbd');
    assert.equal(signals.deriveNextMove({}), '--', 'falls back to the honest "--" placeholder (Ruling 3c)');
  });

  // ---- (2) LIVE health: CHANGES when room-health.json changes ----
  ok('the health signal changes when room-health.json changes', function () {
    assert.equal(roomHealthCache.persistRoomHealth('drift'), true);
    assert.equal(signals.readHealthStatus(), 'drift', 'reader picks up drift');
    assert.equal(signals.collectSignals({ roomName: 'demo', ctxPct: 30 }).health, 'drift', 'signal is drift');

    roomHealthCache.persistRoomHealth('broken');
    assert.equal(signals.readHealthStatus(), 'broken', 'reader picks up broken');
    assert.equal(signals.collectSignals({ roomName: 'demo', ctxPct: 30 }).health, 'broken', 'signal is broken');

    roomHealthCache.persistRoomHealth('sound');
    assert.equal(signals.collectSignals({ roomName: 'demo', ctxPct: 30 }).health, 'sound', 'signal is sound');
  });

  ok('statusFromBindReport maps the doctor bind-check report to the health enum', function () {
    assert.equal(roomHealthCache.statusFromBindReport({ healthy: true, findings: [] }), 'sound');
    assert.equal(roomHealthCache.statusFromBindReport({ healthy: false, findings: ['off-scope'] }), 'drift');
    assert.equal(roomHealthCache.statusFromBindReport({ healthy: false, findings: ['bind-check-error'] }), 'broken');
    assert.equal(roomHealthCache.statusFromBindReport(null), 'broken', 'an unreadable report is not a healthy room');
  });

  ok('persist helpers reject junk and never throw', function () {
    assert.equal(roomHealthCache.persistRoomHealth('nonsense'), false, 'invalid status rejected');
    // malformed cache file -> reader degrades to null, signal to sound.
    fs.writeFileSync(path.join(tmpHome, '.mindrian', 'room-health.json'), 'not json {{', 'utf8');
    assert.equal(signals.readHealthStatus(), null, 'malformed health cache -> null');
    fs.writeFileSync(path.join(tmpHome, '.mindrian', 'next-move.json'), 'not json {{', 'utf8');
    assert.equal(signals.readRoutedNextMove(), null, 'malformed next-move cache -> null');
  });

  ok('formatCommandCue strips the /mos: prefix and dashes', function () {
    assert.equal(nextMoveCache.formatCommandCue('/mos:map-unknowns'), 'map unknowns');
    assert.equal(nextMoveCache.formatCommandCue('mullins'), 'mullins');
    assert.equal(nextMoveCache.formatCommandCue(''), '');
    assert.equal(nextMoveCache.formatCommandCue(null), '');
  });

  ok('this test file is em-dash-free', function () {
    const self = fs.readFileSync(__filename, 'utf8');
    const emDash = String.fromCharCode(0x2014);
    assert.equal(self.indexOf(emDash), -1, 'no em-dash in the test file');
  });
} finally {
  if (savedHome === undefined) delete process.env.HOME; else process.env.HOME = savedHome;
  fs.rmSync(tmpHome, { recursive: true, force: true });
}

console.log('  ' + n + ' checks passed');
