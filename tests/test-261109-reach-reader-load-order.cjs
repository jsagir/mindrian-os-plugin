'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261109 (RCA intent-classifier-hook-timeout, finding 2): the reach-reject
 * reader must read real counts in EVERY load order.
 * ============================================================================
 * navigation.cjs reaches the reader through its own load chain (Phase 345-03):
 *   navigation.cjs > navigation/calibration-log.cjs > workflow/f-selector-ranker.cjs
 *   > core/navigation-engine.cjs > core/strategy/strategy-throttle.cjs
 *   > workflow/reach-reject-reader.cjs > navigation.cjs (mid-load)
 * A top-level `const navigation = require('../core/navigation.cjs')` in the reader
 * ran while navigation.cjs was mid-load and captured the placeholder {} export
 * that navigation.cjs later replaces (module.exports = {...}). In any process that
 * required navigation.cjs FIRST (the MCP server does, in four modules) every
 * reader call threw inside its try/catch and returned 0 silently: no reach was
 * ever discounted or suppressed there, and 4 of the 11 Phase 158 suites plus
 * test-159-integration-2turn-suppress were red on HEAD for this reason.
 *
 * This suite requires navigation.cjs FIRST (the order that broke), then proves:
 *   Test 0: the cycle is real (the reader is already in require.cache after the
 *           navigation require), so the test is not vacuous.
 *   Test 1: presentationsCount and rejectCountInWindow read the seeded rows
 *           (RED on HEAD: both 0).
 *   Test 2: computeReachPenalties suppresses a reach with N real rejects.
 *
 * Fixture: a real temp room.db through the shipped opener; rows through
 * navigation.logMemoryEvent; no injection seam (the 159-03 anti-vacuous rule).
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only. NO RNG. NO Brain.
 *
 * License: BSL 1.1.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const READER_ABS = path.join(REPO_ROOT, 'lib', 'workflow', 'reach-reject-reader.cjs');

// THE ORDER UNDER TEST: navigation.cjs first.
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const readerLoadedByNavigationChain = Boolean(require.cache[READER_ABS]);
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const reader = require(READER_ABS);

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

function freshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'q261109-load-order-'));
  return openRoomDb(dir);
}

function presentReach(db, reach_id) {
  const r = navigation.logMemoryEvent(db, 'reach_presented', {
    reach_id: reach_id,
    source_path: 'dial:presented:' + reach_id,
    created_by: 'system',
  });
  assert.ok(r && r.ok, 'logMemoryEvent(reach_presented) ok; got reason=' + (r && r.reason));
}

function rejectReach(db, reach_id) {
  const r = navigation.logMemoryEvent(db, 'f_selector_decision', {
    reach_id: reach_id,
    decision: 'reject',
    edge_semantic: 'REJECTED',
    source_path: 'dial:decision:' + reach_id,
    created_by: 'system',
  });
  assert.ok(r && r.ok, 'logMemoryEvent(f_selector_decision) ok; got reason=' + (r && r.reason));
}

console.log('test-261109-reach-reader-load-order.cjs: the reader reads real counts when navigation.cjs loads first');

// ---------------------------------------------------------------------------
// Test 0: the cycle is real; this process exercised it.
// ---------------------------------------------------------------------------
check('requiring navigation.cjs first loads the reader inside its own chain (the cycle under test)', () => {
  assert.ok(readerLoadedByNavigationChain,
    'expected lib/workflow/reach-reject-reader.cjs in require.cache right after require(navigation.cjs); '
    + 'if the chain changed, this suite no longer exercises the load order it was written for');
});

// ---------------------------------------------------------------------------
// Test 1: real counts (RED on HEAD: 0 and 0).
// ---------------------------------------------------------------------------
const db = freshDb();
check('presentationsCount and rejectCountInWindow read the seeded rows in this load order', () => {
  presentReach(db, 'deep_research');
  presentReach(db, 'deep_research');
  presentReach(db, 'deep_research');
  presentReach(db, 'hats');
  rejectReach(db, 'deep_research');
  rejectReach(db, 'deep_research');
  rejectReach(db, 'deep_research');

  const pres = reader.presentationsCount(db, 'deep_research');
  assert.strictEqual(pres, 3, 'presentationsCount(deep_research) must be 3; got ' + pres
    + ' (0 means the reader holds the placeholder navigation export)');
  const hats = reader.presentationsCount(db, 'hats');
  assert.strictEqual(hats, 1, 'presentationsCount(hats) must be 1; got ' + hats);
  const rc = reader.rejectCountInWindow(db, 'deep_research', {}, { window: reader.REJECT_WINDOW });
  assert.strictEqual(rc, 3, 'rejectCountInWindow(deep_research) must be 3; got ' + rc);
});

// ---------------------------------------------------------------------------
// Test 2: the fold suppresses from REAL rows in this load order.
// ---------------------------------------------------------------------------
check('computeReachPenalties hard-suppresses deep_research from 3 real rejects after 3 presentations', () => {
  const N = reader.REJECT_SUPPRESS_THRESHOLD;
  const M = reader.MIN_PRESENTATIONS;
  const P = reader.PAROLE_PERIOD;
  assert.ok(3 >= M && 3 % P !== 0 && 3 >= N, 'fixture invariant: 3 presentations meet M and are not a parole turn; 3 rejects meet N');
  const roomState = { reachScores: { deep_research: 0.5, hats: 0.5 } };
  const pen = reader.computeReachPenalties(db, roomState);
  assert.deepEqual(pen.suppressedReachIds, ['deep_research'], 'deep_research suppressed, hats not; got ' + JSON.stringify(pen.suppressedReachIds));
  assert.strictEqual(pen.discountedScores.hats, 0.5, 'hats keeps its base score (1 presentation is under the M floor)');
  closeRoomDb(db);
});

console.log('');
console.log('PASS test-261109-reach-reader-load-order.cjs (' + passed + ' checks)');
process.exit(0);
