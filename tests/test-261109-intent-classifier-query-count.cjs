'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261109 (RCA intent-classifier-hook-timeout): the reach-reject penalty
 * fold must not re-scan room.db once per reader call.
 * ============================================================================
 * On 2026-11-09 the UserPromptSubmit hook timed out at 5 s. The RCA found that
 * computeReachPenalties (lib/workflow/reach-reject-reader.cjs) called
 * navigation.findRecentChanges 29 to 48 times per prompt with only 6 distinct
 * parameter sets; each call is a full scan of the memory_event rows (json_extract
 * has no index), and with room.db on a 9p mount (/mnt/c under WSL2) the 29 scans
 * took 11.3 s of a 12.5 s run. The calls are synchronous, so the 1,200 ms
 * NAV_HARD_TIMEOUT_MS race cannot stop them.
 *
 * Test 1 (RED on HEAD before the fix): computeReachPenalties issues at most 2
 *         chokepoint reads (one reach_presented, one f_selector_decision).
 * Test 2: the precomputed counts equal the per-reach public readers (parity), so
 *         the 158 semantics (M floor, P parole, N within W, reject-only) hold.
 * Test 3: shouldSkipReachPenalties(elapsedMs) is false below NAV_HARD_TIMEOUT_MS
 *         and true at or above it (the graceful-degradation guard).
 * Test 4: the fold site in scripts/intent-classifier.cjs consults the guard.
 *
 * Fixture: a real temp room.db opened through the shipped opener, rows written
 * through navigation.logMemoryEvent (the same write the live engine arm does).
 * The roomState passed to computeReachPenalties carries NO injected counters, so
 * the reads are provably from the db (the 159-03 anti-vacuous rule).
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
// LOAD ORDER IS LOAD-BEARING. The hook requires the reader before navigation.cjs
// is in the cache (navigation-engine > strategy-throttle > reach-reject-reader >
// navigation). When a process requires navigation.cjs FIRST, the chain
// navigation > calibration-log > f-selector-ranker > navigation-engine >
// strategy-throttle > reach-reject-reader > navigation hands the reader the
// placeholder {} export (the Phase 345-03 cycle), and every reader call returns 0
// silently. This test mirrors the hook's order so it measures the live behavior;
// Test 0 proves the reader is alive before any count is trusted.
const reader = require(path.join(REPO_ROOT, 'lib', 'workflow', 'reach-reject-reader.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const CLASSIFIER_ABS = path.join(REPO_ROOT, 'scripts', 'intent-classifier.cjs');

const MAX_READS_PER_FOLD = 2;

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

function freshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'q261109-query-count-'));
  return { dir, db: openRoomDb(dir) };
}

function presentReach(db, reach_id) {
  const r = navigation.logMemoryEvent(db, 'reach_presented', {
    reach_id: reach_id,
    source_path: 'dial:presented:' + reach_id,
    created_by: 'system',
  });
  assert.ok(r && r.ok, 'logMemoryEvent(reach_presented) ok; got reason=' + (r && r.reason));
}

function recordDecision(db, reach_id, decision) {
  const r = navigation.logMemoryEvent(db, 'f_selector_decision', {
    reach_id: reach_id,
    decision: decision,
    edge_semantic: decision === 'reject' ? 'REJECTED' : 'DEFERRED',
    source_path: 'dial:decision:' + reach_id,
    created_by: 'system',
  });
  assert.ok(r && r.ok, 'logMemoryEvent(f_selector_decision) ok; got reason=' + (r && r.reason));
}

// A room where every fence has something to read: presentations for all six
// reaches (counts that meet M=2 and avoid the P=5 parole boundary), rejects on
// two reaches (one at N=3, one below N), a DEFER that must not count.
function seedRoom(db) {
  const presentations = { context_block: 3, contradiction: 2, cross_room: 4, brain_consult: 3, deep_research: 6, hats: 1 };
  for (const id of reader.REACH_IDS) {
    for (let i = 0; i < presentations[id]; i += 1) presentReach(db, id);
  }
  recordDecision(db, 'deep_research', 'reject');
  recordDecision(db, 'deep_research', 'reject');
  recordDecision(db, 'deep_research', 'reject');
  recordDecision(db, 'cross_room', 'reject');
  recordDecision(db, 'cross_room', 'defer');
  recordDecision(db, 'hats', 'reject');
}

function sixPriors() {
  const scores = {};
  for (const id of reader.REACH_IDS) scores[id] = 0.5;
  return scores;
}

// Count navigation.findRecentChanges calls for the duration of fn. The reader
// reads through the SAME module object (require cache), so wrapping the export
// observes every chokepoint read it makes.
function countReads(fn) {
  const orig = navigation.findRecentChanges;
  const calls = [];
  navigation.findRecentChanges = function (db, since, opts) {
    calls.push({ since: since, eventType: opts && opts.eventType, limit: opts && opts.limit });
    return orig.apply(this, arguments);
  };
  try {
    const out = fn();
    return { out, calls };
  } finally {
    navigation.findRecentChanges = orig;
  }
}

console.log('test-261109-intent-classifier-query-count.cjs: the penalty fold reads room.db at most ' + MAX_READS_PER_FOLD + ' times');

// ---------------------------------------------------------------------------
// Test 0: anti-vacuous guard. The reader must read the seeded rows from the db.
// ---------------------------------------------------------------------------
let seeded = null;
check('the reader is alive in this load order (presentationsCount reads the seeded rows)', () => {
  seeded = freshDb();
  seedRoom(seeded.db);
  const dr = reader.presentationsCount(seeded.db, 'deep_research');
  assert.strictEqual(dr, 6, 'presentationsCount(deep_research) must read 6 seeded rows; got ' + dr
    + ' (0 means the reader holds the placeholder navigation export: load order regression)');
  const rc = reader.rejectCountInWindow(seeded.db, 'deep_research', {}, { window: reader.REJECT_WINDOW });
  assert.strictEqual(rc, 3, 'rejectCountInWindow(deep_research) must read 3 seeded rejects; got ' + rc);
});

// ---------------------------------------------------------------------------
// Test 1: the read-count pin (RED on HEAD).
// ---------------------------------------------------------------------------
check('computeReachPenalties issues at most ' + MAX_READS_PER_FOLD + ' chokepoint reads for 6 reach ids', () => {
  const roomState = { reachScores: sixPriors() };
  assert.ok(!('presentationsCount' in roomState) && !('rejectCountInWindow' in roomState),
    'fixture rule: no injected counters, the reads must come from the db');
  const { out, calls } = countReads(() => reader.computeReachPenalties(seeded.db, roomState));
  assert.ok(out && typeof out === 'object', 'computeReachPenalties returned an object');
  const distinct = new Set(calls.map((c) => c.eventType + '|' + c.since + '|' + c.limit)).size;
  assert.ok(calls.length <= MAX_READS_PER_FOLD,
    'expected at most ' + MAX_READS_PER_FOLD + ' findRecentChanges calls per fold, got ' + calls.length
    + ' (' + distinct + ' distinct parameter sets); each call is a full scan of the memory_event rows');
  // the caller's roomState is not mutated into an injection seam
  assert.ok(!('presentationsCount' in roomState) && !('rejectCountInWindow' in roomState),
    'the caller roomState must not be mutated');
});

// ---------------------------------------------------------------------------
// Test 2: parity with the per-reach public readers (the 158 semantics hold).
// ---------------------------------------------------------------------------
check('the fold result equals the per-reach readers computed one by one', () => {
  const db = seeded.db;
  const scores = sixPriors();
  const got = reader.computeReachPenalties(db, { reachScores: scores });
  const expected = { discountedScores: {}, suppressedReachIds: [] };
  for (const id of reader.REACH_IDS) {
    if (reader.isHardSuppressed(db, id, {})) expected.suppressedReachIds.push(id);
    const cp = reader.countPenalty(db, id, {});
    let discounted = scores[id] * (1 - cp);
    if (!reader.isHardSuppressed(db, id, {})) {
      const floorVal = scores[id] * reader.COMBINED_SUPPRESS_FLOOR;
      if (discounted < floorVal) discounted = floorVal;
    }
    expected.discountedScores[id] = discounted;
  }
  assert.deepEqual(got.suppressedReachIds, expected.suppressedReachIds, 'suppressed set parity');
  assert.deepEqual(got.discountedScores, expected.discountedScores, 'discounted scores parity');
  // the fixture is not vacuous: deep_research (3 rejects, 6 presentations, not a parole turn) is suppressed,
  // cross_room (1 reject, 1 defer) is discounted but present, hats (1 presentation) is fenced by M
  assert.ok(got.suppressedReachIds.indexOf('deep_research') !== -1, 'deep_research is hard-suppressed (N=3 within W)');
  assert.ok(got.suppressedReachIds.indexOf('cross_room') === -1, 'cross_room is not suppressed (1 reject)');
  assert.ok(got.discountedScores.cross_room < 0.5, 'cross_room is discounted');
  assert.strictEqual(got.discountedScores.hats, 0.5, 'hats is fenced by the M floor (1 presentation)');
  closeRoomDb(db);
});

// ---------------------------------------------------------------------------
// Test 3: the graceful-degradation guard.
// ---------------------------------------------------------------------------
check('shouldSkipReachPenalties is false under the engine envelope and true at or above it', () => {
  delete require.cache[CLASSIFIER_ABS];
  const classifier = require(CLASSIFIER_ABS);
  assert.strictEqual(typeof classifier.shouldSkipReachPenalties, 'function', 'the guard is exported');
  assert.strictEqual(typeof classifier.NAV_HARD_TIMEOUT_MS, 'number', 'NAV_HARD_TIMEOUT_MS is exported');
  const T = classifier.NAV_HARD_TIMEOUT_MS;
  assert.strictEqual(classifier.shouldSkipReachPenalties(0), false);
  assert.strictEqual(classifier.shouldSkipReachPenalties(T - 1), false);
  assert.strictEqual(classifier.shouldSkipReachPenalties(T), true);
  assert.strictEqual(classifier.shouldSkipReachPenalties(T * 4), true);
  assert.strictEqual(classifier.shouldSkipReachPenalties(undefined), false, 'a missing clock never skips');
  assert.strictEqual(classifier.shouldSkipReachPenalties(NaN), false, 'NaN never skips');
});

// ---------------------------------------------------------------------------
// Test 4: the fold site consults the guard.
// ---------------------------------------------------------------------------
check('the penalty fold in scripts/intent-classifier.cjs is gated by shouldSkipReachPenalties(elapsedMs)', () => {
  const src = fs.readFileSync(CLASSIFIER_ABS, 'utf8');
  const foldAt = src.indexOf('reachReader.computeReachPenalties(');
  assert.ok(foldAt > 0, 'the fold site exists');
  const windowSrc = src.slice(Math.max(0, foldAt - 1200), foldAt);
  assert.ok(/!shouldSkipReachPenalties\(\s*[A-Za-z_$][\w$]*\s*\)/.test(windowSrc),
    'the condition that guards the fold must call !shouldSkipReachPenalties(<elapsed clock>)');
  assert.ok(/Date\.now\(\)\s*-\s*startedAt/.test(windowSrc),
    'the guard must read a fresh clock against the engine start (startedAt)');
});

console.log('');
console.log('PASS test-261109-intent-classifier-query-count.cjs (' + passed + ' checks)');
process.exit(0);
