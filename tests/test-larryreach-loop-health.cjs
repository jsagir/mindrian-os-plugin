'use strict';
/*
 * Test: lib/core/metrics/larryreach-loop-health.cjs computeLoopHealth.
 * Hooked-model quick win 2 (.planning/research/2026-06-09-hooked-model-larryreach-loop-audit.md).
 *
 * Mirrors the plain-node runner style of tests/test-navigation-neighborhood.cjs:
 * fs.mkdtempSync + openRoomDb fixture (the SAME chokepoint the dial/navigation
 * tests use), seed via navigation.logMemoryEvent, assert + PASS/line-count
 * summary, exit non-zero on any failure.
 *
 * Part 8 / Part 9: the module under test reads LOCAL memory_event counts only,
 * routed through navigation.cjs. The test seeds through the same chokepoint.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const { ok, equal, deepEqual } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { computeLoopHealth } = require(path.join(REPO_ROOT, 'lib', 'core', 'metrics', 'larryreach-loop-health.cjs'));

function makeRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'larryreach-loop-health-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);
  return { tmp, db };
}

function cleanup(tmp) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

// Seed a dial event through the navigation chokepoint, exactly as the dial does:
// the event_type is the second arg, target_node_id rides in the payload (that is
// the field findRecentChanges surfaces as targetNodeId, and the field
// computeLoopHealth uses for the by_reach breakdown).
function seedEvent(db, eventType, targetNodeId) {
  const r = navigation.logMemoryEvent(db, eventType, { target_node_id: targetNodeId });
  ok(r && r.ok, 'logMemoryEvent ok for ' + eventType + '; got ' + JSON.stringify(r));
}

// ---------------------------------------------------------------------------
// Test 1 -- known mix: 3 sync, 2 pivot, 1 miss, across two distinct reaches.
// ---------------------------------------------------------------------------
function test1_knownMix() {
  const { tmp, db } = makeRoom();
  try {
    // Reach A: cmd:mos:beautiful-question -- 2 sync + 1 pivot (3 committed).
    seedEvent(db, 'f_selector_sync_confirmed', 'cmd:mos:beautiful-question');
    seedEvent(db, 'f_selector_sync_confirmed', 'cmd:mos:beautiful-question');
    seedEvent(db, 'f_selector_pivot', 'cmd:mos:beautiful-question');
    // Reach B: cmd:mos:swot -- 1 sync + 1 pivot (2 committed).
    seedEvent(db, 'f_selector_sync_confirmed', 'cmd:mos:swot');
    seedEvent(db, 'f_selector_pivot', 'cmd:mos:swot');
    // 1 miss (no committed reach target).
    seedEvent(db, 'f_selector_miss', 'cmd:mos:swot');

    const h = computeLoopHealth(db);

    equal(h.committed, 5, 'committed === 5 (3 sync + 2 pivot)');
    equal(h.sync, 3, 'sync === 3');
    equal(h.pivot, 2, 'pivot === 2');
    equal(h.miss, 1, 'miss === 1');
    equal(h.surfaced, 6, 'surfaced === 6 (5 committed + 1 miss)');

    equal(h.in_sync_rate, 0.6, 'in_sync_rate === 0.6 (3/5)');
    equal(h.pivot_rate, 0.4, 'pivot_rate === 0.4 (2/5)');
    equal(h.acceptance_rate, 0.8333, 'acceptance_rate ~= 0.8333 (5/6)');
    equal(h.miss_rate, 0.1667, 'miss_rate ~= 0.1667 (1/6)');

    // No NaN anywhere in the rates.
    for (const k of ['in_sync_rate', 'pivot_rate', 'acceptance_rate', 'miss_rate']) {
      ok(typeof h[k] === 'number' && isFinite(h[k]), k + ' is a finite number');
      ok(h[k] >= 0 && h[k] <= 1, k + ' is in [0,1]; got ' + h[k]);
    }

    // by_reach breakdown sums correctly.
    const bq = h.by_reach['cmd:mos:beautiful-question'];
    ok(bq, 'by_reach has cmd:mos:beautiful-question');
    deepEqual(bq, { sync: 2, pivot: 1, committed: 3 }, 'beautiful-question breakdown 2 sync / 1 pivot / 3 committed');
    const sw = h.by_reach['cmd:mos:swot'];
    ok(sw, 'by_reach has cmd:mos:swot');
    deepEqual(sw, { sync: 1, pivot: 1, committed: 2 }, 'swot breakdown 1 sync / 1 pivot / 2 committed');

    // by_reach committed totals reconcile with the top-level committed count.
    let sumCommitted = 0;
    let sumSync = 0;
    let sumPivot = 0;
    for (const target of Object.keys(h.by_reach)) {
      sumCommitted += h.by_reach[target].committed;
      sumSync += h.by_reach[target].sync;
      sumPivot += h.by_reach[target].pivot;
    }
    equal(sumCommitted, h.committed, 'by_reach committed sum === top-level committed');
    equal(sumSync, h.sync, 'by_reach sync sum === top-level sync');
    equal(sumPivot, h.pivot, 'by_reach pivot sum === top-level pivot');

    // A miss never contributes a by_reach entry on its own (only sync+pivot do).
    equal(Object.keys(h.by_reach).length, 2, 'by_reach has exactly the two committed reaches');

    db.close();
  } finally { cleanup(tmp); }
}

// ---------------------------------------------------------------------------
// Test 2 -- empty case: no events returns all zeros with NO NaN.
// ---------------------------------------------------------------------------
function test2_emptyCase() {
  const { tmp, db } = makeRoom();
  try {
    const h = computeLoopHealth(db);
    equal(h.committed, 0, 'committed === 0');
    equal(h.sync, 0, 'sync === 0');
    equal(h.pivot, 0, 'pivot === 0');
    equal(h.miss, 0, 'miss === 0');
    equal(h.surfaced, 0, 'surfaced === 0');
    equal(h.in_sync_rate, 0, 'in_sync_rate === 0 (no divide-by-zero NaN)');
    equal(h.pivot_rate, 0, 'pivot_rate === 0');
    equal(h.acceptance_rate, 0, 'acceptance_rate === 0');
    equal(h.miss_rate, 0, 'miss_rate === 0');
    for (const k of ['in_sync_rate', 'pivot_rate', 'acceptance_rate', 'miss_rate']) {
      ok(!Number.isNaN(h[k]), k + ' is not NaN on the empty case');
      ok(isFinite(h[k]), k + ' is finite on the empty case');
    }
    deepEqual(h.by_reach, {}, 'by_reach is empty object on the empty case');
    db.close();
  } finally { cleanup(tmp); }
}

// ---------------------------------------------------------------------------
// Test 3 -- sinceEpochMs windowing is honored (read-only filter sanity).
// ---------------------------------------------------------------------------
function test3_sinceWindow() {
  const { tmp, db } = makeRoom();
  try {
    seedEvent(db, 'f_selector_sync_confirmed', 'cmd:mos:swot');
    // A sinceEpochMs in the future excludes the just-written event.
    const future = Date.now() + 60000;
    const h = computeLoopHealth(db, { sinceEpochMs: future });
    equal(h.sync, 0, 'future sinceEpochMs excludes the event');
    equal(h.committed, 0, 'committed === 0 with future window');
    // sinceEpochMs = 0 (all-time) includes it.
    const all = computeLoopHealth(db, { sinceEpochMs: 0 });
    equal(all.sync, 1, 'all-time window includes the event');
    db.close();
  } finally { cleanup(tmp); }
}

function run() {
  const tests = [test1_knownMix, test2_emptyCase, test3_sinceWindow];
  let pass = 0;
  let fail = 0;
  for (const t of tests) {
    try {
      t();
      pass++;
      process.stdout.write('PASS ' + t.name + '\n');
    } catch (err) {
      fail++;
      process.stderr.write('FAIL ' + t.name + ': ' + err.message + '\n' + err.stack + '\n');
    }
  }
  process.stdout.write('test-larryreach-loop-health: ' + pass + '/' + tests.length + ' passed\n');
  process.exit(fail === 0 ? 0 : 1);
}

run();
