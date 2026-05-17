'use strict';
/*
 * Phase 120-03 Wave 2 Task 2 -- review-queue unit tests (Tests 11-14).
 *
 * Per CONTEXT.md "Claude's Discretion" item 3: a separate SQLite db at the
 * rooms-home level ($ROOMS_HOME/.rooms/breakthrough-review-queue.db). Mirrors
 * the Phase 119-01 rooms-meta.db precedent. Sibling pattern; does NOT pollute
 * per-room room.db with cross-room review backlog.
 */

const test = require('node:test');
const { strict: assert } = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const QUEUE_PATH = path.resolve(__dirname, 'review-queue.cjs');
const reviewQueue = require('./review-queue.cjs');

const {
  openReviewQueue,
  insertReviewCandidate,
  listPendingReviews,
  REVIEW_QUEUE_DB_PATH,
  TABLE_DDL,
} = reviewQueue;

function makeTmpRoomsHome(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// --- T11: openReviewQueue creates db + table ---
test('T11: openReviewQueue creates .rooms/breakthrough-review-queue.db with the review_candidates table', () => {
  const tmpHome = makeTmpRoomsHome('p120-03-rq-t11-');
  try {
    const result = openReviewQueue(tmpHome);
    assert.equal(result.fallback, false,
      'expected non-fallback open, got: ' + JSON.stringify(result));
    assert.ok(result.db);
    const dbPath = path.join(tmpHome, '.rooms', 'breakthrough-review-queue.db');
    assert.ok(fs.existsSync(dbPath), 'expected db file at ' + dbPath);
    // Verify the table schema
    const rows = result.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='review_candidates'").all();
    assert.equal(rows.length, 1);
    // Verify the 10 columns
    const cols = result.db.prepare("PRAGMA table_info(review_candidates)").all();
    const colNames = cols.map(c => c.name).sort();
    assert.deepEqual(colNames, [
      'artifact_ids_json', 'breakthrough_id', 'confidence', 'id',
      'kind', 'queued_at', 'review_status', 'reviewed_at', 'room_slug', 'theme',
    ]);
    result.db.close();
  } finally {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
});

// --- T12: insertReviewCandidate row contents ---
test('T12: insertReviewCandidate row populates all 10 columns + defaults', () => {
  const tmpHome = makeTmpRoomsHome('p120-03-rq-t12-');
  try {
    const result = openReviewQueue(tmpHome);
    const candidate = {
      id: 'bk:test:t12',
      kind: 'convergence',
      confidence: 0.42,
      theme: 'test-theme',
      artifact_ids: ['a1', 'a2', 'a3'],
    };
    const ins = insertReviewCandidate(result.db, candidate, 'test-room');
    assert.equal(ins.ok, true);
    const row = result.db.prepare("SELECT * FROM review_candidates WHERE id = ?").get(ins.queue_id);
    assert.ok(row);
    assert.equal(row.breakthrough_id, 'bk:test:t12');
    assert.equal(row.kind, 'convergence');
    assert.equal(row.confidence, 0.42);
    assert.equal(row.theme, 'test-theme');
    assert.equal(row.room_slug, 'test-room');
    assert.deepEqual(JSON.parse(row.artifact_ids_json), ['a1', 'a2', 'a3']);
    assert.ok(typeof row.queued_at === 'number');
    assert.equal(row.reviewed_at, null);
    assert.equal(row.review_status, 'pending');
    result.db.close();
  } finally {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
});

// --- T13: listPendingReviews returns only status='pending' ---
test('T13: listPendingReviews filters by review_status = pending', () => {
  const tmpHome = makeTmpRoomsHome('p120-03-rq-t13-');
  try {
    const result = openReviewQueue(tmpHome);
    const db = result.db;
    // Insert 3 candidates
    const c1 = insertReviewCandidate(db, { id: 'bk:1', kind: 'convergence', confidence: 0.40, theme: 't1', artifact_ids: ['a1'] }, 'r1');
    const c2 = insertReviewCandidate(db, { id: 'bk:2', kind: 'convergence', confidence: 0.41, theme: 't2', artifact_ids: ['a2'] }, 'r1');
    const c3 = insertReviewCandidate(db, { id: 'bk:3', kind: 'convergence', confidence: 0.42, theme: 't3', artifact_ids: ['a3'] }, 'r1');
    // Mark c2 as reviewed
    db.prepare("UPDATE review_candidates SET review_status = 'reviewed', reviewed_at = ? WHERE id = ?")
      .run(Date.now(), c2.queue_id);
    const pending = listPendingReviews(db, 100);
    assert.equal(pending.length, 2);
    const ids = pending.map(p => p.id).sort();
    assert.deepEqual(ids, [c1.queue_id, c3.queue_id].sort());
    db.close();
  } finally {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
});

// --- T14: graceful degradation -- non-writable rooms_home ---
test('T14: openReviewQueue falls back to in-memory db when rooms_home is not writable', () => {
  // Use a path that cannot exist as a directory (file path)
  const tmpFile = fs.mkdtempSync(path.join(os.tmpdir(), 'p120-03-rq-t14-'));
  const notADir = path.join(tmpFile, 'i-am-a-file.txt');
  fs.writeFileSync(notADir, 'blocking');
  try {
    // notADir is a FILE, not a dir; mkdirSync inside should fail
    const result = openReviewQueue(notADir);
    // Either fallback=true (in-memory) OR open failed -- both are graceful (no throw)
    assert.ok(typeof result === 'object');
    if (result.db) {
      // Falling back to in-memory db -- ensure inserts still work
      const ins = insertReviewCandidate(result.db, {
        id: 'bk:t14',
        kind: 'convergence',
        confidence: 0.40,
        theme: 't',
        artifact_ids: ['a'],
      }, 'fallback');
      assert.equal(ins.ok, true);
      result.db.close();
    } else {
      // ok if it returned a no-db handle gracefully
      assert.equal(result.fallback, true);
    }
  } finally {
    fs.rmSync(tmpFile, { recursive: true, force: true });
  }
});

// --- T15: REVIEW_QUEUE_DB_PATH constant ---
test('T15: REVIEW_QUEUE_DB_PATH constant exported verbatim', () => {
  assert.equal(REVIEW_QUEUE_DB_PATH, '.rooms/breakthrough-review-queue.db');
});

// --- T16: TABLE_DDL contains review_candidates ---
test('T16: TABLE_DDL exported + creates the review_candidates table', () => {
  assert.ok(typeof TABLE_DDL === 'string');
  assert.ok(TABLE_DDL.indexOf('review_candidates') >= 0);
});

// --- Canon Part 8 + em-dash invariants ---
test('T17: Canon Part 8 source-grep + em-dash invariant on review-queue.cjs', () => {
  const src = fs.readFileSync(QUEUE_PATH, 'utf8');
  assert.ok(!/require\(.+brain-client/.test(src));
  assert.ok(!/fetch.+brain\.mindrian/.test(src));
  assert.equal(src.indexOf('—'), -1);
});
