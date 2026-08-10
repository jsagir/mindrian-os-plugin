#!/usr/bin/env node
'use strict';

/**
 * Phase 249 Plan 01, Task 1 (ENRICH-01) -- lib/core/enrichment-queue.cjs
 * ==========================================================================
 * Clone of the shipped lib/core/brain-derivation-queue.cjs pattern (Canon
 * Part 7) with the ENRICH-01 typed entry shape (research "The typed queue
 * entry"). Proves:
 *
 *   1. enqueue() idempotency keyed on canonical framework name: a re-miss
 *      increments hit_count and refreshes last_seen + missing_dimensions
 *      without growing the queue; a different framework appends.
 *   2. Entry allowlist shape -- exactly the ENRICH-01 keys, nothing else.
 *   3. source is the frozen vocabulary live_reach|refusal|census_seed; any
 *      other value rejects the entry.
 *   4. context_class members validate against CLOSED enums (REACH_IDS,
 *      TRIGGER_TIERS, dispatch-framework-map.json keys, the frozen
 *      problem_type enum); an invalid member is DROPPED, never stored.
 *   5. Part-8 audit (Test-12 pattern): the queue file written by the module
 *      carries NO forbidden substrings, and every entry matches the
 *      allowlist shape.
 *   6. Self-healing reader: corrupt JSON / wrong version / invalid shape
 *      resets to empty with a stderr warn, never throws.
 *   7. Atomic write: tmp+fsync+rename, no leftover tmp files.
 *   8. SOFT_CAP 500 warning / HARD_CAP 1000 rejection.
 *   9. enqueue and captureReadinessMiss NEVER throw into the caller.
 *  10. CLI: append mode + --from-census mode, both via a real subprocess.
 *
 * node --test, CJS, node:assert/strict + node:fs/os/path + node:child_process
 * only. No new deps. No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');

const MODULE_PATH = path.resolve(__dirname, '..', 'lib', 'core', 'enrichment-queue.cjs');
const CLI_PATH = path.resolve(__dirname, '..', 'scripts', 'enrichment-queue-append.cjs');
const QUEUE_RELATIVE = path.join('.mindrian', 'enrichment-queue.json');

function freshRoom() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'test-249-enrichment-queue-'));
}

function readQueueFileRaw(roomDir) {
  const p = path.join(roomDir, QUEUE_RELATIVE);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// ---------------------------------------------------------------------------
// Test 1: enqueue idempotency + hit_count + missing_dimensions refresh.
// ---------------------------------------------------------------------------
test('Test 1: same framework re-enqueued increments hit_count, refreshes last_seen + missing_dimensions, queue size unchanged', () => {
  const eq = require(MODULE_PATH);
  const roomDir = freshRoom();

  const r1 = eq.enqueue(roomDir, {
    framework: 'Six Thinking Hats',
    readiness_score: 1,
    missing_dimensions: ['structure', 'techniques'],
    source: 'live_reach',
    probe_provenance: 'orchestration_readiness@2026-08-10T09:00:00Z',
  });
  assert.equal(r1.queued, true);
  assert.equal(r1.queue_size, 1);

  const q1 = eq.readQueue(roomDir);
  assert.equal(q1.entries[0].hit_count, 0);
  const firstSeen = q1.entries[0].first_seen;
  const firstLastSeen = q1.entries[0].last_seen;

  const r2 = eq.enqueue(roomDir, {
    framework: 'Six Thinking Hats',
    readiness_score: 1,
    missing_dimensions: ['flow'],
    source: 'live_reach',
    probe_provenance: 'orchestration_readiness@2026-08-10T09:05:00Z',
  });
  assert.equal(r2.queued, true);
  assert.equal(r2.queue_size, 1, 'a re-miss must NOT grow the queue');

  const q2 = eq.readQueue(roomDir);
  assert.equal(q2.entries.length, 1);
  assert.equal(q2.entries[0].hit_count, 1, 'hit_count must increment on re-miss');
  assert.equal(q2.entries[0].first_seen, firstSeen, 'first_seen must never change');
  assert.deepEqual(q2.entries[0].missing_dimensions, ['flow'], 'missing_dimensions must refresh to the latest miss');

  // A different framework appends.
  const r3 = eq.enqueue(roomDir, {
    framework: 'Reverse Salient Analysis',
    readiness_score: 0,
    missing_dimensions: ['pattern_type', 'structure', 'techniques', 'flow'],
    source: 'live_reach',
    probe_provenance: 'orchestration_readiness@2026-08-10T09:06:00Z',
  });
  assert.equal(r3.queued, true);
  assert.equal(r3.queue_size, 2, 'a different framework must append, not collapse');
});

// ---------------------------------------------------------------------------
// Test 2: entry allowlist keys exactly.
// ---------------------------------------------------------------------------
test('Test 2: written entries carry exactly the ENRICH-01 allowlist keys', () => {
  const eq = require(MODULE_PATH);
  const roomDir = freshRoom();

  eq.enqueue(roomDir, {
    framework: 'Jobs to Be Done (JTBD)',
    readiness_score: 2,
    missing_dimensions: ['flow'],
    context_class: { reach_id: 'brain_consult', dispatch: 'adoption-capacity' },
    source: 'live_reach',
    probe_provenance: 'orchestration_readiness@2026-08-10T09:10:00Z',
  });

  const q = eq.readQueue(roomDir);
  assert.equal(q.entries.length, 1);
  const keys = Object.keys(q.entries[0]).sort();
  const allowed = eq.ALLOWED_ENTRY_KEYS.slice().sort();
  for (const k of keys) {
    assert.ok(allowed.includes(k), 'unexpected key on stored entry: ' + k);
  }
  // Required keys must all be present (dimensions_inferred is optional).
  for (const req of ['framework', 'normalized', 'readiness_score', 'missing_dimensions',
    'context_class', 'source', 'hit_count', 'first_seen', 'last_seen', 'probe_provenance']) {
    assert.ok(keys.includes(req), 'missing required key: ' + req);
  }
});

// ---------------------------------------------------------------------------
// Test 3: source frozen vocabulary; an invalid value rejects the entry.
// ---------------------------------------------------------------------------
test('Test 3: source must be one of live_reach|refusal|census_seed; anything else rejects the entry', () => {
  const eq = require(MODULE_PATH);
  const roomDir = freshRoom();

  for (const src of ['live_reach', 'refusal', 'census_seed']) {
    const rd = freshRoom();
    const r = eq.enqueue(rd, { framework: 'Test Framework ' + src, readiness_score: 1, source: src, probe_provenance: 'x@y' });
    assert.equal(r.queued, true, src + ' must be accepted');
  }

  const bad = eq.enqueue(roomDir, {
    framework: 'Bad Source Framework',
    readiness_score: 1,
    source: 'user_typed_this',
    probe_provenance: 'x@y',
  });
  assert.equal(bad.queued, false);
  assert.equal(bad.error, 'invalid_source');
  const q = eq.readQueue(roomDir);
  assert.equal(q.entries.length, 0, 'a rejected entry must never be written');
});

// ---------------------------------------------------------------------------
// Test 4: context_class closed-enum members; invalid members dropped.
// ---------------------------------------------------------------------------
test('Test 4: context_class members validate against closed enums; an invalid member is DROPPED, not stored', () => {
  const eq = require(MODULE_PATH);
  const roomDir = freshRoom();

  eq.enqueue(roomDir, {
    framework: 'Adoption-Capacity Theory',
    readiness_score: 2,
    source: 'live_reach',
    probe_provenance: 'x@y',
    context_class: {
      reach_id: 'brain_consult',           // valid REACH_IDS member
      dispatch: 'adoption-capacity',       // valid dispatch-framework-map.json key
      problem_type: 'not-a-real-enum',     // INVALID -- must be dropped
      trigger_tier: 'not-a-real-tier',     // INVALID -- must be dropped
      smuggled_user_prose: 'the user said they are worried about runway',
    },
  });

  const q = eq.readQueue(roomDir);
  const cc = q.entries[0].context_class;
  assert.equal(cc.reach_id, 'brain_consult');
  assert.equal(cc.dispatch, 'adoption-capacity');
  assert.equal('problem_type' in cc, false, 'invalid problem_type must be dropped');
  assert.equal('trigger_tier' in cc, false, 'invalid trigger_tier must be dropped');
  assert.equal('smuggled_user_prose' in cc, false, 'an unknown key must never survive into the stored entry');
});

// ---------------------------------------------------------------------------
// Test 5: Part-8 audit -- forbidden substrings + allowlist shape (Test-12 pattern).
// ---------------------------------------------------------------------------
test('Test 5 (Part-8 audit, Test-12 pattern): the queue file carries NO forbidden substrings and every entry matches the allowlist shape', () => {
  const eq = require(MODULE_PATH);
  const roomDir = freshRoom();

  // Attempted prose smuggling via every field a hostile/careless caller could try.
  eq.enqueue(roomDir, {
    framework: 'Six Thinking Hats',
    readiness_score: 1,
    missing_dimensions: ['structure'],
    source: 'live_reach',
    probe_provenance: 'orchestration_readiness@2026-08-10T09:00:00Z',
    context_class: { reach_id: 'brain_consult' },
  });
  eq.captureReadinessMiss(roomDir, 'Jobs to Be Done (JTBD)', { readiness_score: 2 }, { reach_id: 'brain_consult', dispatch: 'adoption-capacity' });
  eq.captureReadinessMiss(roomDir, 'PEST Analysis', { grounded: false }, {});

  const raw = fs.readFileSync(path.join(roomDir, QUEUE_RELATIVE), 'utf8');

  // Forbidden substring list seeded from the derivation queue's own Test-12
  // audit list: user prose markers, artifact-body markers, person names,
  // meeting fragments.
  const FORBIDDEN = [
    'the user said', 'meeting notes', 'summary:', 'John Smith', 'Jane Doe',
    'runway', 'investor', '@gmail.com', 'transcript', 'artifact body',
    'q1 revenue', 'burn rate', 'quarterly',
  ];
  for (const f of FORBIDDEN) {
    assert.equal(raw.toLowerCase().includes(f.toLowerCase()), false, 'forbidden substring leaked into queue file: ' + f);
  }

  const q = eq.readQueue(roomDir);
  assert.ok(q.entries.length >= 2);
  for (const e of q.entries) {
    const keys = Object.keys(e);
    for (const k of keys) {
      assert.ok(eq.ALLOWED_ENTRY_KEYS.includes(k), 'entry carries a non-allowlisted key: ' + k);
    }
  }
});

// ---------------------------------------------------------------------------
// Test 6: self-healing reader.
// ---------------------------------------------------------------------------
test('Test 6: self-healing reader resets to empty on corrupt JSON, wrong version, or invalid shape (never throws)', () => {
  const eq = require(MODULE_PATH);

  const rd1 = freshRoom();
  fs.mkdirSync(path.join(rd1, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(rd1, QUEUE_RELATIVE), '{ this is not valid json ][', 'utf8');
  assert.doesNotThrow(() => {
    const q = eq.readQueue(rd1);
    assert.deepEqual(q.entries, []);
  });

  const rd2 = freshRoom();
  fs.mkdirSync(path.join(rd2, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(rd2, QUEUE_RELATIVE), JSON.stringify({ version: 999, entries: [] }), 'utf8');
  const q2 = eq.readQueue(rd2);
  assert.deepEqual(q2.entries, []);

  const rd3 = freshRoom();
  fs.mkdirSync(path.join(rd3, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(rd3, QUEUE_RELATIVE), JSON.stringify({ not: 'a queue shape' }), 'utf8');
  const q3 = eq.readQueue(rd3);
  assert.deepEqual(q3.entries, []);

  // A corrupt entry inside an otherwise-valid queue is dropped, not fatal.
  const rd4 = freshRoom();
  fs.mkdirSync(path.join(rd4, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(rd4, QUEUE_RELATIVE), JSON.stringify({
    version: eq.SCHEMA_VERSION,
    entries: [
      { framework: '', source: 'live_reach' }, // invalid: empty framework
      { framework: 'Valid Framework', source: 'not_a_real_source' }, // invalid source
      {
        framework: 'Good Framework', normalized: true, readiness_score: 2,
        missing_dimensions: [], context_class: {}, source: 'live_reach',
        hit_count: 0, first_seen: '2026-08-10T00:00:00Z', last_seen: '2026-08-10T00:00:00Z',
        probe_provenance: 'x@y',
      },
    ],
  }), 'utf8');
  const q4 = eq.readQueue(rd4);
  assert.equal(q4.entries.length, 1);
  assert.equal(q4.entries[0].framework, 'Good Framework');
});

// ---------------------------------------------------------------------------
// Test 7: atomic write -- no leftover tmp files.
// ---------------------------------------------------------------------------
test('Test 7: writeQueueAtomic leaves no leftover tmp files', () => {
  const eq = require(MODULE_PATH);
  const roomDir = freshRoom();
  eq.enqueue(roomDir, { framework: 'Atomic Write Framework', readiness_score: 1, source: 'live_reach', probe_provenance: 'x@y' });
  const dirEntries = fs.readdirSync(path.join(roomDir, '.mindrian'));
  const tmpFiles = dirEntries.filter((f) => f.includes('.tmp.'));
  assert.deepEqual(tmpFiles, [], 'no .tmp. files should survive a successful write');
  assert.ok(dirEntries.includes('enrichment-queue.json'));
});

// ---------------------------------------------------------------------------
// Test 8: SOFT_CAP / HARD_CAP.
// ---------------------------------------------------------------------------
test('Test 8: SOFT_CAP 500 warning / HARD_CAP 1000 rejection', () => {
  const eq = require(MODULE_PATH);
  assert.equal(eq.SOFT_CAP, 500);
  assert.equal(eq.HARD_CAP, 1000);

  const roomDir = freshRoom();
  // Seed a queue file directly AT SOFT_CAP to avoid a slow 500-call loop.
  // enqueue() warns once the count goes STRICTLY ABOVE SOFT_CAP (donor
  // semantics, brain-derivation-queue.cjs: `if (nextEntries.length > SOFT_CAP)`).
  const entries = [];
  for (let i = 0; i < eq.SOFT_CAP; i++) {
    entries.push({
      framework: 'Bulk Framework ' + i, normalized: true, readiness_score: 1,
      missing_dimensions: [], context_class: {}, source: 'live_reach',
      hit_count: 0, first_seen: 'x', last_seen: 'x', probe_provenance: 'x@y',
    });
  }
  eq.writeQueueAtomic(roomDir, { version: eq.SCHEMA_VERSION, entries });

  const r1 = eq.enqueue(roomDir, { framework: 'Soft Cap Trigger', readiness_score: 1, source: 'live_reach', probe_provenance: 'x@y' });
  assert.equal(r1.queued, true);
  assert.equal(r1.queue_size, eq.SOFT_CAP + 1);
  assert.equal(r1.warning, 'queue_soft_cap');

  // Seed directly at HARD_CAP to prove the reject path without a slow loop.
  const roomDir2 = freshRoom();
  const entries2 = [];
  for (let i = 0; i < eq.HARD_CAP; i++) {
    entries2.push({
      framework: 'Hard Framework ' + i, normalized: true, readiness_score: 1,
      missing_dimensions: [], context_class: {}, source: 'live_reach',
      hit_count: 0, first_seen: 'x', last_seen: 'x', probe_provenance: 'x@y',
    });
  }
  eq.writeQueueAtomic(roomDir2, { version: eq.SCHEMA_VERSION, entries: entries2 });
  const r2 = eq.enqueue(roomDir2, { framework: 'Over The Hard Cap', readiness_score: 1, source: 'live_reach', probe_provenance: 'x@y' });
  assert.equal(r2.queued, false);
  assert.equal(r2.error, 'queue_hard_cap');
});

// ---------------------------------------------------------------------------
// Test 9: enqueue + captureReadinessMiss never throw into the caller.
// ---------------------------------------------------------------------------
test('Test 9: enqueue and captureReadinessMiss never throw, even on hostile input', () => {
  const eq = require(MODULE_PATH);

  assert.doesNotThrow(() => eq.enqueue(null, null));
  assert.doesNotThrow(() => eq.enqueue(undefined, undefined));
  assert.doesNotThrow(() => eq.enqueue(123, { framework: 'x' }));
  assert.doesNotThrow(() => eq.enqueue('/nonexistent/unwritable/path/deep', { framework: 'x', source: 'live_reach', probe_provenance: 'x@y' }));
  assert.doesNotThrow(() => eq.enqueue('/root/definitely-unwritable-249', { framework: 'x', source: 'live_reach', probe_provenance: 'x@y' }));

  assert.doesNotThrow(() => eq.captureReadinessMiss(null, null, null, null));
  assert.doesNotThrow(() => eq.captureReadinessMiss(freshRoom(), 'X', undefined, undefined));
  assert.doesNotThrow(() => eq.captureReadinessMiss(freshRoom(), 'X', { readiness_score: 'not-a-number' }, {}));
  assert.doesNotThrow(() => eq.captureReadinessMiss('/root/definitely-unwritable-249', 'X', { readiness_score: 1 }, {}));

  const r = eq.enqueue('/root/definitely-unwritable-249-2', { framework: 'x', source: 'live_reach', probe_provenance: 'x@y' });
  assert.equal(typeof r, 'object');
  assert.equal(r.queued, false);
});

// ---------------------------------------------------------------------------
// Test 10: captureReadinessMiss builds the right entry from each probe kind.
// ---------------------------------------------------------------------------
test('Test 10: captureReadinessMiss derives missing_dimensions from probeResult.dimensions when present, else infers with dimensions_inferred:true', () => {
  const eq = require(MODULE_PATH);

  const rd1 = freshRoom();
  const r1 = eq.captureReadinessMiss(rd1, 'Six Thinking Hats', {
    readiness_score: 1,
    dimensions: { pattern_type: 1, structure: 0, techniques: 0, flow: 0 },
  }, { reach_id: 'brain_consult' });
  assert.equal(r1.queued, true);
  const q1 = eq.readQueue(rd1);
  assert.deepEqual(q1.entries[0].missing_dimensions.slice().sort(), ['flow', 'structure', 'techniques']);
  assert.equal('dimensions_inferred' in q1.entries[0], false, 'a precise server dimensions vector must NOT be marked inferred');

  const rd2 = freshRoom();
  const r2 = eq.captureReadinessMiss(rd2, 'Reverse Salient Analysis', { readiness_score: 0 }, {});
  assert.equal(r2.queued, true);
  const q2 = eq.readQueue(rd2);
  assert.equal(q2.entries[0].dimensions_inferred, true, 'lossy inference must be marked dimensions_inferred:true');
  assert.equal(q2.entries[0].readiness_score, 0);

  const rd3 = freshRoom();
  const r3 = eq.captureReadinessMiss(rd3, 'PEST Analysis', { grounded: false }, {});
  assert.equal(r3.queued, true);
  const q3 = eq.readQueue(rd3);
  assert.equal(q3.entries[0].readiness_score, null);
  assert.deepEqual(q3.entries[0].missing_dimensions, ['structure']);
  assert.equal(q3.entries[0].dimensions_inferred, true);

  // A non-miss (grounded:true, or readiness_score > 2) must NOT be captured.
  const rd4 = freshRoom();
  const r4 = eq.captureReadinessMiss(rd4, 'Beautiful Question', { readiness_score: 4 }, {});
  assert.equal(r4.captured, false);
  assert.equal(fs.existsSync(path.join(rd4, QUEUE_RELATIVE)), false);

  const rd5 = freshRoom();
  const r5 = eq.captureReadinessMiss(rd5, 'Well Grounded Framework', { grounded: true }, {});
  assert.equal(r5.captured, false);
});

// ---------------------------------------------------------------------------
// Test 11: CLI append mode.
// ---------------------------------------------------------------------------
test('Test 11: CLI append mode writes one entry from flags', () => {
  const roomDir = freshRoom();
  const out = execFileSync('node', [
    CLI_PATH,
    '--room', roomDir,
    '--framework', 'Six Thinking Hats',
    '--score', '1',
    '--missing', 'structure,flow',
    '--source', 'live_reach',
    '--reach-id', 'brain_consult',
    '--dispatch', 'think-hats',
  ], { encoding: 'utf8' });

  const parsed = JSON.parse(out.trim().split('\n').pop());
  assert.equal(parsed.queued, true);

  const q = readQueueFileRaw(roomDir);
  assert.equal(q.entries.length, 1);
  assert.equal(q.entries[0].framework, 'Six Thinking Hats');
  assert.equal(q.entries[0].source, 'live_reach');
  assert.deepEqual(q.entries[0].missing_dimensions.slice().sort(), ['flow', 'structure']);
  assert.equal(q.entries[0].context_class.reach_id, 'brain_consult');
  assert.equal(q.entries[0].context_class.dispatch, 'think-hats');
});

// ---------------------------------------------------------------------------
// Test 12: CLI --from-census mode seeds the full gap-table backlog.
// ---------------------------------------------------------------------------
test('Test 12: CLI --from-census mode enqueues one census_seed entry per gap-table framework', () => {
  const roomDir = freshRoom();
  const censusPath = path.resolve(__dirname, '..', 'data', 'brain-census.generated.json');
  const census = JSON.parse(fs.readFileSync(censusPath, 'utf8'));
  const expectedCount = Array.isArray(census.gap_table) ? census.gap_table.length : 0;
  assert.ok(expectedCount > 0, 'the fixture census must have a non-empty gap_table to prove this against');

  const out = execFileSync('node', [CLI_PATH, '--from-census', censusPath, '--room', roomDir], { encoding: 'utf8' });
  const parsed = JSON.parse(out.trim().split('\n').pop());
  assert.equal(parsed.ok, true);
  assert.equal(parsed.seeded, expectedCount);

  const q = readQueueFileRaw(roomDir);
  assert.equal(q.entries.length, expectedCount);
  for (const e of q.entries) {
    assert.equal(e.source, 'census_seed');
    assert.equal(e.hit_count, 0);
  }
});

// ---------------------------------------------------------------------------
// Test 13: CLI exits non-zero on failure with an error result.
// ---------------------------------------------------------------------------
test('Test 13: CLI exits 1 with an error result on invalid input', () => {
  let threw = false;
  let stdout = '';
  try {
    stdout = execFileSync('node', [CLI_PATH, '--room', freshRoom(), '--framework', 'X', '--source', 'not-a-real-source'], { encoding: 'utf8' });
  } catch (e) {
    threw = true;
    stdout = (e.stdout || '') + '';
    assert.equal(e.status, 1);
  }
  assert.equal(threw, true, 'CLI must exit non-zero on a rejected entry');
  const parsed = JSON.parse(stdout.trim().split('\n').pop());
  assert.equal(parsed.queued, false);
  assert.ok(parsed.error);
});
