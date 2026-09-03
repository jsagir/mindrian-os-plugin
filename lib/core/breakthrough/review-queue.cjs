'use strict';
// Phase 120-03 Wave 2 Task 2 -- SOFT_BAND breakthrough review queue.
//
// Per CONTEXT.md "Claude's Discretion" item 3: a separate
// `.rooms/breakthrough-review-queue.db` SQLite database at the rooms-home level.
// Mirrors the Phase 119-01 rooms-meta.db precedent (lib/core/room-discard-cascade.cjs::
// _emitPartialFailure pattern). Sibling pattern; does NOT pollute per-room room.db
// with cross-room review backlog.
//
// Per CONTEXT.md D-18 SOFT_BAND semantics:
//   Confidence 0.35 <= conf <= 0.50 candidates queue here (NOT surfaced).
//   Sample 20% manually each week to check for drift. These become retraining data.
//
// Canon Part 4: every choice is graph data. The review queue is the typed-row
//   surface for SOFT_BAND breakthrough candidates; rows carry kind + confidence +
//   theme + provenance ids (artifact_ids_json) for review.
// Canon Part 8: queue stays LOCAL to the user's machine; no Brain coupling.
// Canon Part 9: schema is queryable via standard SQLite; the sample-20% weekly
//   audit is a manual SQL query against this db.
//
// Em-dash HARD RULE (CLAUDE.md feedback_no_emdashes): zero U+2014 in source.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Use Node's built-in node:sqlite DatabaseSync (Phase 109 SQL navigation spine
// contract, mirrored from lib/core/room-db.cjs). Fall back to a no-op surface
// only on require failure (env without sqlite, e.g. older Node versions; node:sqlite
// is GA from Node 22.5+).
let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch (_e) {
  DatabaseSync = null;
}

// The 10-column DDL for the review_candidates table. Matches the test contract
// in review-queue.test.cjs T11 (PRAGMA table_info returns these 10 column names).
const TABLE_DDL = "CREATE TABLE IF NOT EXISTS review_candidates ( " +
  "id TEXT PRIMARY KEY, " +
  "room_slug TEXT, " +
  "breakthrough_id TEXT NOT NULL, " +
  "kind TEXT NOT NULL, " +
  "confidence REAL NOT NULL, " +
  "theme TEXT, " +
  "artifact_ids_json TEXT, " +
  "queued_at INTEGER NOT NULL, " +
  "reviewed_at INTEGER, " +
  "review_status TEXT NOT NULL DEFAULT 'pending'" +
  ")";

const REVIEW_QUEUE_DB_PATH = '.rooms/breakthrough-review-queue.db';

// openReviewQueue(roomsHome) -> {db, dbPath?, fallback, reason?}
//
// Opens (creates if needed) the .rooms/breakthrough-review-queue.db at the given
// rooms-home. Returns a handle with the db object, the resolved dbPath, and a
// fallback flag. On EACCES / mkdir failure, falls back to an in-memory db so the
// scanner can still insert (just not persistent across sessions).
//
// Graceful failure modes:
//   - node:sqlite not available -> {db: null, fallback: true, reason: 'node_sqlite_not_available'}
//   - mkdir fails -> in-memory db opened, fallback:true, reason: 'rooms_home_not_writable:<msg>'
//   - in-memory open ALSO fails -> {db: null, fallback: true, reason: 'open_failed:<msg>'}
function openReviewQueue(roomsHome) {
  if (!DatabaseSync) {
    return { db: null, fallback: true, reason: 'node_sqlite_not_available' };
  }
  try {
    const metaDir = path.join(roomsHome, '.rooms');
    fs.mkdirSync(metaDir, { recursive: true, mode: 0o755 });
    const dbPath = path.join(metaDir, 'breakthrough-review-queue.db');
    // Phase 276 (C4) write-safety: fold the busy-timeout constructor option into
    // the DatabaseSync options object. Without it, node:sqlite fails a contended
    // write in 0ms with SQLITE_BUSY; the option turns that into a roughly 5s
    // busy-wait window. Strictly more forgiving - a longer wait, never a new
    // failure mode - because WAL readers never block writers. Option-only, per
    // D-276-4: openRoomDb is structurally WRONG here, not merely unused. It
    // takes a roomDir and builds <roomDir>/.mindrian/room.db, so it cannot open
    // <roomsHome>/.rooms/breakthrough-review-queue.db at all, and it would run
    // 13 CREATE TABLEs plus five room migrations against a store that has none
    // of them.
    const db = new DatabaseSync(dbPath, { timeout: 5000 });
    db.exec(TABLE_DDL);
    return { db: db, dbPath: dbPath, fallback: false };
  } catch (err) {
    // Graceful fallback: in-memory db so the scanner can still insert; not persistent.
    try {
      // No timeout option here: an in-memory :memory: database has exactly one
      // connection and cannot contend, so the option would be a no-op that
      // makes a grep look complete (Phase 276 C4 exclusion, same reasoning as
      // room-db.cjs:251's read-only exclusion).
      const db = new DatabaseSync(':memory:');
      db.exec(TABLE_DDL);
      const errMsg = (err && err.message) ? err.message.slice(0, 80) : 'unknown';
      return { db: db, fallback: true, reason: 'rooms_home_not_writable:' + errMsg };
    } catch (err2) {
      const errMsg2 = (err2 && err2.message) ? err2.message.slice(0, 80) : 'unknown';
      return { db: null, fallback: true, reason: 'open_failed:' + errMsg2 };
    }
  }
}

// insertReviewCandidate(db, breakthrough, roomSlug) -> {ok, queue_id, queued_at} | {ok:false, reason}
//
// Inserts a SOFT_BAND candidate into the review queue. Generates a fresh queue_id
// of the form "review:<8 hex bytes>" so callers do not need to coordinate IDs.
// queued_at is Date.now() at insert time.
//
// review_status defaults to 'pending' per the DDL DEFAULT clause. reviewed_at
// stays NULL until a manual reviewer updates it (manual SQL or future
// /mos:doctor --review-queue-sweep command, deferred to v1.14.0).
//
// Theme is sliced to 200 chars to match the Phase 90-06 sanitizeDetailScalar
// precedent (Canon Part 8 boundary -- bounded payload size).
function insertReviewCandidate(db, breakthrough, roomSlug) {
  if (!db || typeof db.prepare !== 'function') {
    return { ok: false, reason: 'no_db' };
  }
  const bk = breakthrough || {};
  const queueId = 'review:' + crypto.randomBytes(8).toString('hex');
  const queued_at = Date.now();
  try {
    db.prepare(
      "INSERT INTO review_candidates (id, room_slug, breakthrough_id, kind, confidence, theme, artifact_ids_json, queued_at, review_status) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')"
    ).run(
      queueId,
      (typeof roomSlug === 'string' ? roomSlug : null),
      bk.id || null,
      (typeof bk.kind === 'string' ? bk.kind : 'unknown'),
      (typeof bk.confidence === 'number' && Number.isFinite(bk.confidence) ? bk.confidence : 0),
      (typeof bk.theme === 'string' ? bk.theme.slice(0, 200) : null),
      JSON.stringify(Array.isArray(bk.artifact_ids) ? bk.artifact_ids : []),
      queued_at
    );
    return { ok: true, queue_id: queueId, queued_at: queued_at };
  } catch (err) {
    return { ok: false, reason: (err && err.message) ? err.message : 'insert_failed' };
  }
}

// listPendingReviews(db, limit) -> [{id, room_slug, breakthrough_id, kind, confidence, theme, queued_at}, ...]
//
// Returns rows where review_status = 'pending', ordered by queued_at DESC. Limit
// defaults to 100; non-positive / non-integer limits use the default.
function listPendingReviews(db, limit) {
  if (!db || typeof db.prepare !== 'function') return [];
  const lim = (Number.isInteger(limit) && limit > 0) ? limit : 100;
  try {
    return db.prepare(
      "SELECT id, room_slug, breakthrough_id, kind, confidence, theme, queued_at " +
      "FROM review_candidates WHERE review_status = 'pending' " +
      "ORDER BY queued_at DESC LIMIT ?"
    ).all(lim);
  } catch (_e) {
    return [];
  }
}

module.exports = {
  openReviewQueue,
  insertReviewCandidate,
  listPendingReviews,
  REVIEW_QUEUE_DB_PATH,
  TABLE_DDL,
};
