'use strict';
// Phase 265 (Plan 11) -- proves lib/core/lens-engine.cjs's weighted-by-context
// mode actually fetches its lenses concurrently. The markdown has long
// claimed "Research subquestions fan out independently" while the runtime
// dispatched one lens after another; this pins the two together so a future
// regression that puts weighted-by-context back on the sequential branch
// fails loudly instead of silently.
//
// No network access, no database: rotate() is driven directly with an
// instrumented stub perLensFn. Hermetic. Standalone node script, exit 0/1.
// NO em-dashes anywhere (CLAUDE.md HARD RULE). Uses hyphens.

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const lensEngine = require(path.join(REPO_ROOT, 'lib', 'core', 'lens-engine.cjs'));

let pass = 0;
let total = 0;
const failures = [];

function record(label, fn) {
  total += 1;
  try {
    fn();
    pass += 1;
    console.log('  ok -', label);
  } catch (e) {
    failures.push(label + ': ' + (e && e.message));
    console.log('  FAIL -', label, '::', e && e.message);
  }
}

// The 'source' lens family (client_count 1) is the only activated multi-lens
// family; 'domain' also has client_count 1 but 'source' is the family the
// weighted-by-context mode was actually built for. Three lenses in the order
// the caller (a weighted-by-context caller) would supply them: descending
// Plan-02 weight order.
const LENS_SET = ['scholarly', 'industry', 'patent'];
// Distinct delays so overlap is unambiguous: the fastest lens is LAST in the
// input order, so the order arm proves it does not jump the queue.
const DELAY_MS = { scholarly: 120, industry: 80, patent: 40 };
const SERIAL_FLOOR_MS = DELAY_MS.scholarly + DELAY_MS.industry + DELAY_MS.patent; // 240
const CONCURRENT_BUDGET_MS = 200; // 240 - 40ms margin
const SESSION_ID = 'test-265-lens-parallel-fixed-session';

function makeStub(intervals) {
  return async function perLensFn(lens, ctx) {
    const startedAt = Date.now();
    if (Array.isArray(intervals)) intervals.push({ lens, startedAt, endedAt: null });
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS[lens] || 0));
    const endedAt = Date.now();
    if (Array.isArray(intervals)) {
      const rec = intervals.find((r) => r.lens === lens && r.endedAt === null);
      if (rec) rec.endedAt = endedAt;
    }
    return { topic: ctx.topic, summary: lens + ' stub finding', item_count: 1 };
  };
}

function baseInput(extra) {
  return Object.assign({ roomDir: '', topic: 'lens-parallel-test', db: null, sessionId: SESSION_ID }, extra || {});
}

function runRotate(rotationMode, intervals) {
  return lensEngine.rotate({
    lensType: 'source',
    lensSet: LENS_SET,
    rotationMode,
    input: baseInput(),
    perLensFn: makeStub(intervals),
    synthesize: 'source-comparison',
    surfaceSelector: 'F.1',
  });
}

// Two intervals overlap when one starts before the other ends.
function countOverlaps(intervals) {
  let overlaps = 0;
  for (let i = 0; i < intervals.length; i += 1) {
    for (let j = i + 1; j < intervals.length; j += 1) {
      const a = intervals[i];
      const b = intervals[j];
      if (a.startedAt < b.endedAt && b.startedAt < a.endedAt) overlaps += 1;
    }
  }
  return overlaps;
}

async function main() {
  // --- Arm 1: CONCURRENCY -----------------------------------------------
  const serialIntervals = [];
  const t0 = Date.now();
  const serialResult = await runRotate('serial', serialIntervals);
  const serialMs = Date.now() - t0;

  const weightedIntervals = [];
  const t1 = Date.now();
  const weightedResult = await runRotate('weighted-by-context', weightedIntervals);
  const weightedMs = Date.now() - t1;

  const overlapCount = countOverlaps(weightedIntervals);

  console.log('  measured: serial=' + serialMs + 'ms concurrent=' + weightedMs + 'ms overlap=' + overlapCount);

  await record('concurrency arm: weighted-by-context wall clock is below the serial floor', () => {
    assert.ok(
      weightedMs < CONCURRENT_BUDGET_MS,
      'expected concurrent run < ' + CONCURRENT_BUDGET_MS + 'ms (serial floor ' + SERIAL_FLOOR_MS + 'ms), got ' + weightedMs + 'ms'
    );
  });
  record('concurrency arm: at least two fetch intervals overlap', () => {
    assert.ok(overlapCount >= 2, 'expected at least 2 overlapping [startedAt,endedAt] intervals, got ' + overlapCount);
  });

  // --- Arm 2: ORDER -------------------------------------------------------
  record('order arm: weighted-by-context findingIds match the input lens-set order', () => {
    assert.ok(weightedResult && weightedResult.ok, 'weighted-by-context rotation did not return ok:true');
    const expectedSuffixes = LENS_SET.map((lens) => ':' + lens);
    const actualSuffixes = weightedResult.findingIds.map((id) => ':' + id.split(':').pop());
    assert.deepEqual(actualSuffixes, expectedSuffixes, 'weighted findingIds are not in lens-set input order');
  });
  record('order arm: weighted-by-context findingIds are identical to the serial run (same fixed sessionId)', () => {
    assert.ok(serialResult && serialResult.ok, 'serial rotation did not return ok:true');
    assert.deepEqual(
      weightedResult.findingIds,
      serialResult.findingIds,
      'the fastest lens jumped the queue: weighted output order diverged from serial output order'
    );
  });

  // --- Arm 3: PARITY --------------------------------------------------------
  record('parity arm: both runs return ok:true with a synthesis object and a selector object', () => {
    for (const [label, result] of [['serial', serialResult], ['weighted-by-context', weightedResult]]) {
      assert.equal(result.ok, true, label + ' run did not return ok:true');
      assert.ok(result.synthesis && typeof result.synthesis === 'object', label + ' run missing a synthesis object');
      assert.ok(result.selector && typeof result.selector === 'object', label + ' run missing a selector object');
    }
  });

  const parallelIntervals = [];
  const parallelResult = await runRotate('parallel', parallelIntervals);
  record('parity arm: rotationMode parallel still works (the pre-existing persona path is untouched)', () => {
    assert.equal(parallelResult.ok, true, 'rotationMode parallel did not return ok:true');
    assert.equal(parallelResult.findingIds.length, LENS_SET.length, 'rotationMode parallel did not fetch every lens');
  });

  console.log('');
  console.log('test-265-lens-parallel: ' + pass + '/' + total + ' passed');
  if (failures.length > 0) {
    console.log('FAILURES:');
    for (const f of failures) console.log('  - ' + f);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('UNCAUGHT ERROR:', e && e.stack ? e.stack : e);
  process.exit(1);
});
