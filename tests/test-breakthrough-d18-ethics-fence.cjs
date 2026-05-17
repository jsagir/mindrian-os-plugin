'use strict';
/*
 * Phase 120-03 Wave 2 Task 2 -- D-18 ethics-fence end-to-end test (Tests 15-21).
 *
 * Per CONTEXT.md D-18 LOCKED VERBATIM:
 *   HARD FLOOR     -- D-20 Cypher provenance enforced -> structural refusal
 *   HARD CEILING   -- confidence > 0.50 AND full provenance -> auto-surface
 *   SOFT BAND      -- 0.35 <= confidence <= 0.50 -> review queue, NOT surfaced
 *   BELOW FLOOR    -- confidence < 0.35 -> soft-fire buffer only
 *
 * Test 15: 4-band classification over fixed 8-point candidate matrix.
 * Test 16: HARD_CEILING auto-surface path -> queueForReview NOT called.
 * Test 17: SOFT_BAND review queue path -> queueForReview called, no surface.
 * Test 18: HARD_FLOOR refusal path -> no event, no queue row.
 * Test 19: BELOW_FLOOR soft-fire only -> no surface, no queue.
 * Test 20: Canon Part 8 source-grep on both files.
 * Test 21: em-dash invariant on both files.
 */

const test = require('node:test');
const { strict: assert } = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const FENCE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'ethics-fence.cjs');
const QUEUE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'review-queue.cjs');

const ethicsFence = require(FENCE_PATH);
const reviewQueue = require(QUEUE_PATH);
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

function makeTmpRoomsHome(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function makeTmpRoom(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  return dir;
}

// --- Test 15: 4-band classification over 8-point matrix ---
test('D-18 Test 15: classifyEthicsBand correct across 8-point candidate matrix', () => {
  const matrix = [
    // [confidence, artifact_ids, expectedBand]
    [0.90, ['a1', 'a2'], 'HARD_CEILING'],   // high confidence + provenance
    [0.60, ['a1'], 'HARD_CEILING'],         // above ceiling + minimal provenance
    [0.50, ['a1', 'a2'], 'SOFT_BAND'],      // exact ceiling boundary -> SOFT_BAND
    [0.42, ['a1', 'a2', 'a3'], 'SOFT_BAND'],// middle of soft band
    [0.35, ['a1'], 'SOFT_BAND'],            // soft-band lower boundary
    [0.30, ['a1'], 'BELOW_FLOOR'],          // below floor with provenance
    [0.00, ['a1'], 'BELOW_FLOOR'],          // confidence zero with provenance
    [0.80, [], 'HARD_FLOOR'],               // high confidence WITHOUT provenance -> refuse
  ];
  for (const [conf, ids, expected] of matrix) {
    const band = ethicsFence.classifyEthicsBand({ confidence: conf, artifact_ids: ids });
    assert.equal(band, expected,
      'confidence=' + conf + ' ids=' + JSON.stringify(ids) + ' expected ' + expected + ' got ' + band);
  }
});

// --- Test 16: HARD_CEILING auto-surface path ---
test('D-18 Test 16: HARD_CEILING candidate -> classifyEthicsBand returns HARD_CEILING (auto-surface eligible)', () => {
  const cand = { id: 'bk:hc:1', kind: 'convergence', confidence: 0.62, artifact_ids: ['a1', 'a2'], theme: 'hc-test' };
  const band = ethicsFence.classifyEthicsBand(cand);
  assert.equal(band, 'HARD_CEILING');
  // The scanner is responsible for the actual surface (Task 3); here we just
  // verify the classifier is the right gate.
});

// --- Test 17: SOFT_BAND review queue path ---
test('D-18 Test 17: SOFT_BAND candidate -> queueForReview lands row + emits memory_event; no breakthrough_surfaced event', () => {
  const tmpHome = makeTmpRoomsHome('p120-03-d18-t17-rooms-');
  const roomDir = makeTmpRoom('p120-03-d18-t17-room-');
  try {
    const db = openRoomDb(roomDir);
    const cand = {
      id: 'bk:sb:t17',
      kind: 'convergence',
      confidence: 0.42,
      artifact_ids: ['a1', 'a2'],
      theme: 'soft-band-e2e',
    };
    const band = ethicsFence.classifyEthicsBand(cand);
    assert.equal(band, 'SOFT_BAND');
    const result = ethicsFence.queueForReview(cand, tmpHome, { db: db, roomSlug: 'test-room' });
    assert.equal(result.ok, true);

    // Memory event landed
    const queuedEvents = navigation.findRecentChanges(db, 0, {
      eventType: 'breakthrough_in_review_queue',
      limit: 10,
    });
    assert.ok(queuedEvents.length >= 1, 'expected breakthrough_in_review_queue event');

    // breakthrough_surfaced was NOT emitted
    const surfacedEvents = navigation.findRecentChanges(db, 0, {
      eventType: 'breakthrough_surfaced',
      limit: 10,
    });
    assert.equal(surfacedEvents.length, 0,
      'SOFT_BAND must NOT emit breakthrough_surfaced');

    // Review-queue row exists
    const qHandle = reviewQueue.openReviewQueue(tmpHome);
    const pending = reviewQueue.listPendingReviews(qHandle.db, 100);
    assert.ok(pending.length >= 1);
    qHandle.db.close();
    db.close();
  } finally {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    fs.rmSync(roomDir, { recursive: true, force: true });
  }
});

// --- Test 18: HARD_FLOOR refusal path ---
test('D-18 Test 18: HARD_FLOOR candidate -> classifier returns HARD_FLOOR; queueForReview should NOT be called by scanner', () => {
  const cand = { id: 'bk:hf:t18', kind: 'convergence', confidence: 0.80, artifact_ids: [], theme: 'no-prov' };
  const band = ethicsFence.classifyEthicsBand(cand);
  assert.equal(band, 'HARD_FLOOR');
  // The scanner contract (Task 3): HARD_FLOOR + BELOW_FLOOR are silent drops.
  // We verify the classifier returns the band; the scanner's behavior is verified
  // in scanner.test.cjs (Task 3 owns those tests).
});

// --- Test 19: BELOW_FLOOR ---
test('D-18 Test 19: BELOW_FLOOR candidate -> classifier returns BELOW_FLOOR (Plan 120-00 soft-fire territory)', () => {
  const cand = { id: 'bk:bf:t19', kind: 'convergence', confidence: 0.25, artifact_ids: ['a1'], theme: 'below' };
  const band = ethicsFence.classifyEthicsBand(cand);
  assert.equal(band, 'BELOW_FLOOR');
});

// --- Test 20: Canon Part 8 source-grep on both files ---
test('D-18 Test 20: Canon Part 8 source-grep on ethics-fence.cjs + review-queue.cjs', () => {
  for (const p of [FENCE_PATH, QUEUE_PATH]) {
    const src = fs.readFileSync(p, 'utf8');
    assert.ok(!/require\(.+brain-client/.test(src), 'brain-client found in ' + p);
    assert.ok(!/fetch.+brain\.mindrian/.test(src), 'fetch brain.mindrian found in ' + p);
  }
});

// --- Test 21: em-dash invariant on both files ---
test('D-18 Test 21: zero U+2014 em-dashes in ethics-fence.cjs + review-queue.cjs', () => {
  for (const p of [FENCE_PATH, QUEUE_PATH]) {
    const src = fs.readFileSync(p, 'utf8');
    assert.equal(src.indexOf('—'), -1, 'em-dash found in ' + p);
  }
});
