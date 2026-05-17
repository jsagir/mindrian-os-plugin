'use strict';
/*
 * Phase 120-03 Wave 2 Task 2 -- ethics-fence unit tests (Tests 1-10).
 *
 * Per CONTEXT.md D-18 LOCKED VERBATIM:
 *   HARD FLOOR     -- D-20 Cypher provenance enforced (no artifact_ids = refuse)
 *   HARD CEILING   -- confidence > 0.50 AND full provenance = auto-surface
 *   SOFT BAND      -- 0.35 <= confidence <= 0.50 = review queue (NOT surfaced)
 *   BELOW FLOOR    -- confidence < 0.35 = soft-fire buffer only
 *
 * The 4 frozen threshold constants:
 *   HARD_CEILING_CONFIDENCE  = 0.50
 *   SOFT_BAND_MIN_CONFIDENCE = 0.35
 *   SOFT_BAND_MAX_CONFIDENCE = 0.50
 *   BELOW_FLOOR_THRESHOLD    = 0.35
 */

const test = require('node:test');
const { strict: assert } = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const FENCE_PATH = path.resolve(__dirname, 'ethics-fence.cjs');
const ethicsFence = require('./ethics-fence.cjs');

const {
  classifyEthicsBand,
  queueForReview,
  ETHICS_BANDS,
  HARD_CEILING_CONFIDENCE,
  SOFT_BAND_MIN_CONFIDENCE,
  SOFT_BAND_MAX_CONFIDENCE,
  BELOW_FLOOR_THRESHOLD,
} = ethicsFence;

function makeTmpRoomsHome(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// --- T1: ETHICS_BANDS frozen array ---
test('T1: ETHICS_BANDS is the 4 bands frozen verbatim', () => {
  assert.deepEqual(ETHICS_BANDS, ['HARD_FLOOR', 'BELOW_FLOOR', 'SOFT_BAND', 'HARD_CEILING']);
  assert.equal(ETHICS_BANDS.length, 4);
  const before = ETHICS_BANDS.slice();
  try { ETHICS_BANDS.push('extra'); } catch (_e) { /* strict mode */ }
  assert.deepEqual(ETHICS_BANDS.slice(0, 4), before);
});

// --- T2: 4 threshold constants verbatim ---
test('T2: 4 threshold constants verbatim per D-18', () => {
  assert.equal(HARD_CEILING_CONFIDENCE, 0.50);
  assert.equal(SOFT_BAND_MIN_CONFIDENCE, 0.35);
  assert.equal(SOFT_BAND_MAX_CONFIDENCE, 0.50);
  assert.equal(BELOW_FLOOR_THRESHOLD, 0.35);
});

// --- T3: classifyEthicsBand -- HARD_FLOOR ---
test('T3: classifyEthicsBand returns HARD_FLOOR for provenance-less breakthrough', () => {
  // No artifact_ids -- HARD FLOOR overrides any confidence.
  assert.equal(classifyEthicsBand({ confidence: 0.80, artifact_ids: [] }), 'HARD_FLOOR');
  assert.equal(classifyEthicsBand({ confidence: 0.90 }), 'HARD_FLOOR');  // missing entirely
  // Edge: invalid input
  assert.equal(classifyEthicsBand(null), 'HARD_FLOOR');
  assert.equal(classifyEthicsBand(undefined), 'HARD_FLOOR');
});

// --- T4: classifyEthicsBand -- HARD_CEILING ---
test('T4: classifyEthicsBand returns HARD_CEILING for confidence > 0.50 with provenance', () => {
  assert.equal(classifyEthicsBand({ confidence: 0.62, artifact_ids: ['a1', 'a2'] }), 'HARD_CEILING');
  assert.equal(classifyEthicsBand({ confidence: 0.80, artifact_ids: ['a1'] }), 'HARD_CEILING');
});

// --- T5: classifyEthicsBand -- HARD_CEILING boundary ---
test('T5: classifyEthicsBand boundary -- confidence === 0.50 + tiny epsilon -> HARD_CEILING', () => {
  // > strict comparison: 0.501 is HARD_CEILING; 0.50 exact is SOFT_BAND.
  assert.equal(classifyEthicsBand({ confidence: 0.501, artifact_ids: ['a1'] }), 'HARD_CEILING');
  // Exact 0.50 -> SOFT_BAND (since > 0.50 is false)
  assert.equal(classifyEthicsBand({ confidence: 0.50, artifact_ids: ['a1'] }), 'SOFT_BAND');
});

// --- T6: classifyEthicsBand -- SOFT_BAND middle ---
test('T6: classifyEthicsBand returns SOFT_BAND for confidence 0.42', () => {
  assert.equal(classifyEthicsBand({ confidence: 0.42, artifact_ids: ['a1', 'a2'] }), 'SOFT_BAND');
});

// --- T7: classifyEthicsBand -- SOFT_BAND boundary ---
test('T7: classifyEthicsBand boundary -- confidence === 0.35 -> SOFT_BAND', () => {
  assert.equal(classifyEthicsBand({ confidence: 0.35, artifact_ids: ['a1'] }), 'SOFT_BAND');
});

// --- T8: classifyEthicsBand -- BELOW_FLOOR ---
test('T8: classifyEthicsBand returns BELOW_FLOOR for confidence < 0.35', () => {
  assert.equal(classifyEthicsBand({ confidence: 0.30, artifact_ids: ['a1'] }), 'BELOW_FLOOR');
  assert.equal(classifyEthicsBand({ confidence: 0.0, artifact_ids: ['a1'] }), 'BELOW_FLOOR');
  // Edge case: artifact_ids present, confidence missing -> BELOW_FLOOR
  assert.equal(classifyEthicsBand({ artifact_ids: ['a1'] }), 'BELOW_FLOOR');
});

// --- T9: queueForReview happy path ---
test('T9: queueForReview writes to .rooms/breakthrough-review-queue.db', () => {
  const tmpHome = makeTmpRoomsHome('p120-03-fence-t9-');
  try {
    const candidate = {
      id: 'bk:test:t9',
      kind: 'convergence',
      confidence: 0.42,
      theme: 'soft-band-test',
      artifact_ids: ['a1', 'a2'],
    };
    const result = queueForReview(candidate, tmpHome, null);
    assert.equal(result.ok, true,
      'expected queueForReview ok, got: ' + JSON.stringify(result));
    assert.ok(typeof result.queue_id === 'string' && result.queue_id.length > 0);
    assert.ok(typeof result.queued_at === 'number');
    // File should exist
    const dbPath = path.join(tmpHome, '.rooms', 'breakthrough-review-queue.db');
    assert.ok(fs.existsSync(dbPath), 'expected db file at ' + dbPath);
  } finally {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
});

// --- T10: queueForReview emits memory_event ---
test('T10: queueForReview emits breakthrough_in_review_queue memory_event when roomState.db provided', () => {
  const tmpHome = makeTmpRoomsHome('p120-03-fence-t10-');
  try {
    // Open a room.db for the memory_event mirror
    const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
    const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p120-03-fence-t10-roomdir-'));
    fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
    const db = openRoomDb(roomDir);

    const candidate = {
      id: 'bk:test:t10',
      kind: 'cross_domain_analogy',
      confidence: 0.38,
      theme: 'mirror-event',
      artifact_ids: ['x1', 'x2'],
    };
    const result = queueForReview(candidate, tmpHome, { db: db, roomSlug: 'test-room' });
    assert.equal(result.ok, true);

    // Find the memory event
    const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
    const events = navigation.findRecentChanges(db, 0, {
      eventType: 'breakthrough_in_review_queue',
      limit: 10,
    });
    assert.ok(events.length >= 1, 'expected breakthrough_in_review_queue event');
    assert.equal(events[0].properties.breakthrough_id, 'bk:test:t10');
    db.close();
    fs.rmSync(roomDir, { recursive: true, force: true });
  } finally {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
});

// --- Canon Part 8 source-grep ---
test('T11: Canon Part 8 source-grep -- ethics-fence.cjs has zero Brain coupling', () => {
  const src = fs.readFileSync(FENCE_PATH, 'utf8');
  assert.ok(!/require\(.+brain-client/.test(src));
  assert.ok(!/fetch.+brain\.mindrian/.test(src));
});

// --- em-dash invariant ---
test('T12: zero U+2014 em-dashes in ethics-fence.cjs', () => {
  const src = fs.readFileSync(FENCE_PATH, 'utf8');
  assert.equal(src.indexOf('—'), -1);
});

// --- D-18 reference count ---
test('T13: ethics-fence.cjs references D-18 at least twice (provenance comments)', () => {
  const src = fs.readFileSync(FENCE_PATH, 'utf8');
  const matches = src.match(/D-18/g) || [];
  assert.ok(matches.length >= 2, 'expected >= 2 D-18 references, got ' + matches.length);
});
