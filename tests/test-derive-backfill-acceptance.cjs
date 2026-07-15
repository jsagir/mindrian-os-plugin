'use strict';
// Phase 169-01 Wave 0 RED stub -- GDH-06 (backfill acceptance, HEAL-FIRST).
//
// IFACE (169-01 shared_iface_contract): the /mos:graph --derive backfill entry
//   (Plan 05, GDH-06; HEAL-FIRST). STEP 0 runs detectUnsentineledArtifactFolder +
//   healRoom (GDH-08/09) so a sentinel-less folder becomes a real child room
//   FIRST, then resolves by resolveRoomRoot, rebuilds (sub-room-recursive,
//   ROOT-FILES-aware), calls runDerivation once per room+sub-room, and reports
//   the typed-edge delta (0 -> N).
//
// RED-by-require until Plan 05 ships the backfill entry (lib/core/graph-backfill.cjs).
// Asserts the backfill FIRST self-heals a sentinel-less folder THEN takes the
// typed-edge count 0 -> N, with skip-if-absent on the real b2 fixture and a
// synthetic sentinel-less folder fallback. No em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
// RED until Plan 05 ships the backfill entry.
// Phase 224-03 (D-03 amended): the backfill DEFAULT deriver is now the async
// score-based producer, so runDeriveBackfill returns a Promise on the default
// path. This GDH-06 acceptance leg asserts the HEAL-FIRST 0 -> N contract
// deterministically (no real encoder in CI) by injecting the exported
// _localCueDeriveFn heuristic fallback, which keeps the run SYNCHRONOUS and
// returns the result object directly (the polymorphic-return contract).
const { runDeriveBackfill, _localCueDeriveFn } = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-backfill.cjs'));

let pass = 0;
function check(label, fn) { fn(); pass += 1; console.log('  ok -', label); }

console.log('test-derive-backfill-acceptance (GDH-06)');

// Build a parent room with a sentinel-less artifact-bearing child folder (the
// synthetic fallback for the live b2 fixture).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'backfill-169-'));
const parent = path.join(tmp, 'parent-room');
const sentinelLessChild = path.join(parent, 'b2-journey');
fs.mkdirSync(sentinelLessChild, { recursive: true });
fs.writeFileSync(path.join(parent, '.room-root'), JSON.stringify({ slug: 'parent-room' }));
// child folder has artifacts but NO .room-root sentinel.
fs.writeFileSync(path.join(sentinelLessChild, 'one.md'), '# one\nthe 2024 read contradicts the 2b TAM assumption.\n');
fs.writeFileSync(path.join(sentinelLessChild, 'two.md'), '# two\nthe TAM is 2b. the channel theme recurs in gtm and finance.\n');

check('backfill STEP 0 self-heals the sentinel-less folder into a real child room', () => {
  const res = runDeriveBackfill({ roomDir: parent, approvedBy: 'tester', deriveFn: _localCueDeriveFn });
  assert.ok(res && typeof res === 'object', 'runDeriveBackfill must return a result object');
  assert.ok(Array.isArray(res.healed), 'result must report healed folders');
  const healedB2 = res.healed.some(h => /b2-journey/.test(h.roomDir || h.folder || ''));
  assert.ok(healedB2, 'the sentinel-less b2 folder must be self-healed FIRST');
  // the heal must have written a .room-root into the child.
  assert.ok(fs.existsSync(path.join(sentinelLessChild, '.room-root')),
    'the healed child must gain its own .room-root sentinel');
});

check('typed-edge count goes 0 -> N after the backfill derives', () => {
  const res = runDeriveBackfill({ roomDir: parent, approvedBy: 'tester', deriveFn: _localCueDeriveFn });
  assert.equal(typeof res.typedEdgesBefore, 'number', 'must report the before count');
  assert.equal(typeof res.typedEdgesAfter, 'number', 'must report the after count');
  assert.ok(res.typedEdgesAfter > 0, 'the backfill must take the typed-edge count to N > 0');
});

check('real b2 fixture path is non-skippable when present (skip-if-absent otherwise)', () => {
  const b2 = process.env.MINDRIAN_B2_FIXTURE_ROOM;
  if (!b2 || !fs.existsSync(b2)) { console.log('  skip - real b2 room absent (CI uses the synthetic fallback)'); return; }
  const res = runDeriveBackfill({ roomDir: b2, approvedBy: 'tester', deriveFn: _localCueDeriveFn });
  assert.ok(res.typedEdgesAfter > 0, 'the real b2 backfill must produce N > 0 typed edges');
});

console.log(`\nPASS (${pass}/3)`);
