#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 202-01 -- lab-side telemetry consumer acceptance tests.
 *
 * Closes the Phase 121 open loop: the trajectory-telemetry stream has been
 * write-only since v1.13. This suite drives the SEED-002 consumer (lab-side,
 * LOCAL read, offline) per the frozen ingestion contract in
 * docs/TELEMETRY-SCHEMA.md Section 9.
 *
 * Hermetic: the committed fixture tests/fixtures/apo/telemetry-sample.jsonl
 * holds 12 canonical v1 rows. Each test stages them into a fresh tmp dir as
 * real ISO-week shards (events-YYYY-WNN.jsonl) plus decoy siblings, then points
 * readTelemetry at that tmp dir. The real ~/.mindrian/telemetry path is NEVER
 * read or written.
 *
 * Test map:
 *   Task 1 (stream reader + activation gate):
 *     1.  Exports: readTelemetry is a function; ACTIVATION_MIN === 100.
 *     2.  Anchored-regex shard filter: legacy siblings (mva.jsonl,
 *         selector.jsonl, telemetry-sample.jsonl) are excluded; eventCount stays 12.
 *     3.  Lexicographic shard order: W26 rows precede W27 rows regardless of
 *         filesystem creation order.
 *     4.  schema_version dispatch: a v2 row is skipped, not counted, not aborted.
 *     5.  Trailing partial line is tolerated (skipped), not fatal.
 *     6.  command_invocation is filtered OUT of the high-signal set (highSignal
 *         has 10 events, none command_invocation) while eventCount counts ALL 12.
 *     7.  Grouping by session_id over the high-signal set.
 *     8.  Grouping by room_slug_sha256 with the __no_room__ fallback bucket.
 *     9.  Activation gate: with 12 events activated === false, eventCount === 12.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO = path.resolve(__dirname, '..');
const CONSUMER_PATH = path.join(REPO, 'lab/apo/telemetry-consumer.cjs');
const REWARD_PATH = path.join(REPO, 'lab/apo/reward-table.cjs');
const FIXTURE = path.join(REPO, 'tests/fixtures/apo/telemetry-sample.jsonl');
const { ALLOWED_FIELDS } = require(path.join(REPO, 'lib/core/telemetry/schema.cjs'));

const ROOM_A = 'a'.repeat(64);
const ROOM_B = 'b'.repeat(64);

// ---------- Fixture staging (hermetic tmp dir) ----------

function readFixtureRows() {
  return fs.readFileSync(FIXTURE, 'utf8').split('\n').filter((l) => l.trim().length > 0);
}

function stageDir() {
  const rows = readFixtureRows();
  assert.equal(rows.length, 12, 'fixture must hold exactly 12 canonical rows');
  const w26 = rows.slice(0, 6);
  const w27 = rows.slice(6, 12);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apo-202-'));

  // Write W27 first, then W26, so filesystem creation order is reversed from
  // the desired chronological order. The reader's .sort() must reorder.
  const v2Row = JSON.stringify({
    event: 'selector_pick',
    schema_version: 2,
    timestamp: '2026-06-29T11:00:00.000Z',
    session_id: 'sess-2',
    some_v2_only_field: 1,
  });
  const partial = '{"event":"selector_pick","schema'; // trailing partial line, no newline
  fs.writeFileSync(
    path.join(dir, 'events-2026-W27.jsonl'),
    w27.join('\n') + '\n' + v2Row + '\n' + partial
  );
  fs.writeFileSync(path.join(dir, 'events-2026-W26.jsonl'), w26.join('\n') + '\n');

  // Decoy siblings the anchored regex must exclude.
  fs.writeFileSync(path.join(dir, 'mva.jsonl'), rows[0] + '\n');
  fs.writeFileSync(path.join(dir, 'selector.jsonl'), rows[1] + '\n');
  fs.writeFileSync(path.join(dir, 'telemetry-sample.jsonl'), rows[0] + '\n' + rows[1] + '\n');

  return dir;
}

function rmRf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

// ---------- Tiny test runner ----------

const RESULTS = [];
function test(name, fn) {
  try {
    fn();
    RESULTS.push({ name, ok: true });
    console.log('PASS  ' + name);
  } catch (err) {
    RESULTS.push({ name, ok: false, err });
    console.log('FAIL  ' + name);
    console.log('      ' + (err && err.message ? err.message : String(err)));
  }
}

// ---------- Load the unit under test ----------

let consumer;
try {
  delete require.cache[require.resolve(CONSUMER_PATH)];
} catch (_e) { /* not cached yet */ }
consumer = require(CONSUMER_PATH);
const { readTelemetry, ACTIVATION_MIN } = consumer;

let reward;
try {
  delete require.cache[require.resolve(REWARD_PATH)];
} catch (_e) { /* not cached yet */ }
reward = require(REWARD_PATH);
const { buildRewardTable, REWARD_FIELD, assertRewardFieldsPresent } = reward;

// Build the fixture's high-signal event set once for the reward tests.
function highSignalEvents() {
  const dir = stageDir();
  try {
    return readTelemetry(dir, { silent: true }).highSignal;
  } finally { rmRf(dir); }
}

// ================= Task 1 =================

test('1. exports readTelemetry + ACTIVATION_MIN(100)', () => {
  assert.equal(typeof readTelemetry, 'function');
  assert.equal(ACTIVATION_MIN, 100);
});

test('2. anchored-regex shard filter excludes legacy siblings', () => {
  const dir = stageDir();
  try {
    const r = readTelemetry(dir, { silent: true });
    assert.equal(r.eventCount, 12, 'decoy siblings must not inflate eventCount');
    assert.deepEqual(r.shards, ['events-2026-W26.jsonl', 'events-2026-W27.jsonl']);
  } finally { rmRf(dir); }
});

test('3. shards read in lexicographic (chronological) order', () => {
  const dir = stageDir();
  try {
    const r = readTelemetry(dir, { silent: true });
    assert.equal(r.events[0].event, 'selector_pick');
    assert.equal(r.events[0].ranker_confidence, 0.8, 'W26 row 1 must sort first');
    assert.equal(r.events[6].event, 'empathy_observation', 'W27 row 1 must follow all W26 rows');
  } finally { rmRf(dir); }
});

test('4. schema_version dispatch skips a v2 row (no abort)', () => {
  const dir = stageDir();
  try {
    const r = readTelemetry(dir, { silent: true });
    assert.equal(r.eventCount, 12, 'a schema_version:2 row must be skipped, not counted');
    assert.ok(r.events.every((e) => e.schema_version === 1));
  } finally { rmRf(dir); }
});

test('5. trailing partial line tolerated', () => {
  const dir = stageDir();
  try {
    const r = readTelemetry(dir, { silent: true });
    assert.equal(r.eventCount, 12, 'a trailing partial line must be skipped, not fatal');
  } finally { rmRf(dir); }
});

test('6. command_invocation filtered out of high-signal set; eventCount counts all', () => {
  const dir = stageDir();
  try {
    const r = readTelemetry(dir, { silent: true });
    assert.equal(r.eventCount, 12);
    assert.equal(r.highSignal.length, 10);
    assert.ok(r.highSignal.every((e) => e.event !== 'command_invocation'));
  } finally { rmRf(dir); }
});

test('7. grouping by session_id (high-signal set)', () => {
  const dir = stageDir();
  try {
    const r = readTelemetry(dir, { silent: true });
    assert.equal(r.sessions['sess-1'].length, 6);
    assert.equal(r.sessions['sess-2'].length, 4);
  } finally { rmRf(dir); }
});

test('8. grouping by room_slug_sha256 with __no_room__ fallback', () => {
  const dir = stageDir();
  try {
    const r = readTelemetry(dir, { silent: true });
    assert.equal(r.byRoom[ROOM_A].length, 5);
    assert.equal(r.byRoom[ROOM_B].length, 4);
    assert.equal(r.byRoom['__no_room__'].length, 1, 'empathy_observation lacks room_slug_sha256');
    assert.equal(r.byRoom['__no_room__'][0].event, 'empathy_observation');
  } finally { rmRf(dir); }
});

test('9. activation gate: 12 events -> activated false, eventCount 12', () => {
  const dir = stageDir();
  try {
    const r = readTelemetry(dir, { silent: true });
    assert.equal(r.activated, false);
    assert.equal(r.eventCount, 12);
  } finally { rmRf(dir); }
});

// ================= Task 2 (reward extraction) =================

test('10. buildRewardTable exports + is a function', () => {
  assert.equal(typeof buildRewardTable, 'function');
  assert.equal(typeof assertRewardFieldsPresent, 'function');
  assert.ok(REWARD_FIELD && typeof REWARD_FIELD === 'object');
});

test('11. per-key rewardMean: two selector_pick confidences 0.8, 0.6 -> mean 0.7, n 2', () => {
  const table = buildRewardTable(highSignalEvents());
  assert.ok(table.synthesize, 'expected a reward key for verb synthesize');
  assert.equal(table.synthesize.n, 2);
  assert.ok(Math.abs(table.synthesize.rewardMean - 0.7) < 1e-9, 'rewardMean ~= 0.7');
  assert.deepEqual(table.synthesize.signals.ranker_confidence, [0.8, 0.6]);
});

test('12. tension_engagement mapped resolve=1 / defer=0.5 / ignore=0', () => {
  const table = buildRewardTable(highSignalEvents());
  assert.equal(table.contradicts.rewardMean, 1, 'resolve -> 1');
  assert.equal(table.contradicts.n, 1);
  assert.equal(table.converges.rewardMean, 0.5, 'defer -> 0.5');
  assert.equal(table.invalidates.rewardMean, 0, 'ignore -> 0');
});

test('13. auto_explore_decision domain_match_score carried direct', () => {
  const table = buildRewardTable(highSignalEvents());
  assert.equal(table.whitespace.rewardMean, 0.9);
  assert.equal(table.reverse_salient.rewardMean, 0.5);
});

test('14. hooked_axis_score.score_value carried RAW in signals, EXCLUDED from rewardMean', () => {
  const table = buildRewardTable(highSignalEvents());
  assert.ok(table.reward, 'expected a reward key for axis reward');
  assert.deepEqual(table.reward.signals.score_value, [3.2], 'raw unbounded value carried');
  assert.equal(table.reward.n, 0, 'score_value must not count toward n');
  assert.equal(table.reward.rewardMean, 0, 'score_value excluded from rewardMean');
});

test('15. anti-drift: reward field names are asserted present in schema.cjs ALLOWED_FIELDS', () => {
  // Real schema: no throw.
  assert.doesNotThrow(() => assertRewardFieldsPresent(REWARD_FIELD, ALLOWED_FIELDS));
  // Simulate a schema rename (mutate the constant): drop ranker_confidence from
  // selector_pick. The presence-check MUST catch the drift and fail loud.
  const drifted = Object.assign({}, ALLOWED_FIELDS, {
    selector_pick: ALLOWED_FIELDS.selector_pick.filter((f) => f !== 'ranker_confidence'),
  });
  assert.throws(
    () => assertRewardFieldsPresent(REWARD_FIELD, drifted),
    (err) => err && err.code === 'REWARD_FIELD_DRIFT'
  );
});

// ---------- Summary ----------

const failed = RESULTS.filter((r) => !r.ok);
console.log('');
console.log(`${RESULTS.length - failed.length}/${RESULTS.length} passed`);
if (failed.length > 0) {
  process.exit(1);
}
console.log('ALL PASS');
