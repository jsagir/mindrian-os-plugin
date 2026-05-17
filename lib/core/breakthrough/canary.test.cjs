'use strict';

/*
 * Phase 120-02 Wave 2 Task 1 -- D-19 per-detector dismissal-rate canary unit tests.
 *
 * Tests 15-23 cover:
 *   - D19 constants verbatim (D19_DISMISSAL_THRESHOLD=0.30 / D19_FIRE_WINDOW=100 /
 *     D19_MIN_SAMPLE=10)
 *   - computeDismissalRate empty / below-sample / happy-path
 *   - isThrottled per-kind isolation
 *   - emitThrottleEvent writes breakthrough_throttled via navigation.logMemoryEvent
 *   - Canon Part 8 source-grep + em-dash HARD RULE (Tests 22 + 23)
 */

const test = require('node:test');
const { strict: assert } = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const canary = require(path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'canary.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

function makeTmpDb(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const db = openRoomDb(dir);
  return { dir, db };
}

function seedSurfacedDismissedPair(db, kind, breakthroughId, dismissed) {
  const surfacedR = navigation.logMemoryEvent(db, 'breakthrough_surfaced', {
    breakthrough_id: breakthroughId,
    kind: kind,
    source_path: 'system:test',
    created_by: 'system',
  });
  assert.equal(surfacedR.ok, true);
  if (dismissed) {
    const dismR = navigation.logMemoryEvent(db, 'breakthrough_dismissed', {
      breakthrough_id: breakthroughId,
      kind: kind,
      source_path: 'system:test',
      created_by: 'system',
    });
    assert.equal(dismR.ok, true);
  }
}

test('120-02 Task 1 Test 15: D-19 constants verbatim', () => {
  assert.equal(canary.D19_DISMISSAL_THRESHOLD, 0.30);
  assert.equal(canary.D19_FIRE_WINDOW, 100);
  assert.equal(canary.D19_MIN_SAMPLE, 10);
});

test('120-02 Task 1 Test 16: computeDismissalRate on empty db -> rate=0 sample=0 throttled=false', () => {
  const { dir, db } = makeTmpDb('p120-02-t1-t16-');
  const r = canary.computeDismissalRate('convergence', db);
  assert.equal(r.rate, 0);
  assert.equal(r.sample_size, 0);
  assert.equal(r.throttled, false);
});

test('120-02 Task 1 Test 17: computeDismissalRate below D19_MIN_SAMPLE -> throttled stays false', () => {
  const { dir, db } = makeTmpDb('p120-02-t1-t17-');
  // 5 surfaced + 2 dismissed; 40% rate; but sample < D19_MIN_SAMPLE=10 -> not throttled.
  for (let i = 0; i < 3; i++) seedSurfacedDismissedPair(db, 'convergence', 'bk:' + i, false);
  for (let i = 3; i < 5; i++) seedSurfacedDismissedPair(db, 'convergence', 'bk:' + i, true);
  const r = canary.computeDismissalRate('convergence', db);
  assert.equal(r.sample_size, 5);
  // 2 out of 5 = 0.4 rate, but throttled gates on sample size.
  assert.ok(r.rate > 0);
  assert.equal(r.throttled, false);
});

test('120-02 Task 1 Test 18: computeDismissalRate with sample >= floor + rate above threshold -> throttled=true', () => {
  const { dir, db } = makeTmpDb('p120-02-t1-t18-');
  // 12 surfaced + 5 dismissed (5/12 ~= 0.42 > 0.30); sample 12 > 10 floor.
  for (let i = 0; i < 7; i++) seedSurfacedDismissedPair(db, 'convergence', 'bk:s' + i, false);
  for (let i = 0; i < 5; i++) seedSurfacedDismissedPair(db, 'convergence', 'bk:d' + i, true);
  const r = canary.computeDismissalRate('convergence', db);
  assert.equal(r.sample_size, 12);
  assert.ok(r.rate > 0.30, 'rate should exceed 0.30 threshold');
  assert.equal(r.throttled, true);
});

test('120-02 Task 1 Test 19: isThrottled returns true when computeDismissalRate.throttled is true', () => {
  const { dir, db } = makeTmpDb('p120-02-t1-t19-');
  for (let i = 0; i < 7; i++) seedSurfacedDismissedPair(db, 'convergence', 'bk:s' + i, false);
  for (let i = 0; i < 5; i++) seedSurfacedDismissedPair(db, 'convergence', 'bk:d' + i, true);
  assert.equal(canary.isThrottled('convergence', db), true);
});

test('120-02 Task 1 Test 20: isThrottled isolated per-kind -- throttled convergence does NOT throttle cross_domain_analogy', () => {
  const { dir, db } = makeTmpDb('p120-02-t1-t20-');
  // Throttle convergence.
  for (let i = 0; i < 7; i++) seedSurfacedDismissedPair(db, 'convergence', 'bk:cs' + i, false);
  for (let i = 0; i < 5; i++) seedSurfacedDismissedPair(db, 'convergence', 'bk:cd' + i, true);
  // cross_domain_analogy has no events.
  assert.equal(canary.isThrottled('convergence', db), true);
  assert.equal(canary.isThrottled('cross_domain_analogy', db), false);
});

test('120-02 Task 1 Test 21: emitThrottleEvent writes breakthrough_throttled memory_event', () => {
  const { dir, db } = makeTmpDb('p120-02-t1-t21-');
  const rate = { rate: 0.35, sample_size: 100, throttled: true };
  const r = canary.emitThrottleEvent('convergence', db, rate);
  assert.equal(r.ok, true);
  assert.match(r.eventId, /^memory_event:breakthrough_throttled:/);
  // Verify the event landed.
  const found = navigation.findRecentChanges(db, 0, { eventType: 'breakthrough_throttled', limit: 10 });
  assert.equal(found.length, 1);
  assert.equal(found[0].properties.kind, 'convergence');
  assert.equal(found[0].properties.rate, 0.35);
  assert.equal(found[0].properties.threshold, 0.30);
  assert.equal(found[0].properties.sample_size, 100);
  assert.ok(typeof found[0].properties.throttled_at === 'number');
});

test('120-02 Task 1 Test 22: Canon Part 8 source-grep -- zero Brain coupling in canary.cjs', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'canary.cjs'), 'utf8');
  assert.equal(/require\s*\(\s*['"][^'"]*brain-client[^'"]*['"]\s*\)/.test(src), false,
    'canary.cjs must not require brain-client');
  assert.equal(/fetch\s*\(\s*['"][^'"]*brain\.mindrian/.test(src), false,
    'canary.cjs must not fetch brain.mindrian.*');
});

test('120-02 Task 1 Test 23: em-dash HARD RULE -- zero U+2014 in canary.cjs', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'canary.cjs'), 'utf8');
  let count = 0;
  for (const ch of src) {
    if (ch.charCodeAt(0) === 0x2014) count++;
  }
  assert.equal(count, 0, 'canary.cjs must contain zero U+2014 em-dash characters');
});
