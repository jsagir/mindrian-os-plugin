'use strict';
// Phase 160-05 Task 2 test: generalized stale detection beyond decisions (R10).
//
// findStaleClaims(db, roomId, opts) generalizes findStaleDecisions to the node
// types {claim, assumption, opportunity, decision} with a configurable window
// (opts.windowDays, default 30), flagging confirmed/validated nodes whose
// last_modified_at (the Phase 160-04 write-time stamp -- NOT last_seen_at which
// conflates read/write) is older than the window measured against the injected
// reference now (opts.now seam, like supersession.cjs).
//
// Assertions:
//   - a 31-day-old confirmed claim is FLAGGED stale; a 29-day-old one is NOT
//     (SPEC R10 acceptance);
//   - coverage across claim / assumption / opportunity types;
//   - the window is configurable (a custom windowDays changes the boundary);
//   - findStaleClaims is re-exported on navigation.cjs; findStaleDecisions is
//     unchanged (back-compat).
//
// House rule: hyphens only, no em-dashes.

const { test } = require('node:test');
const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const { findStaleClaims } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'insights.cjs'));

const DAY_MS = 24 * 60 * 60 * 1000;
const REF_NOW = 1_750_000_000_000; // fixed reference now for determinism

function setupRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-160-stale-'));
  const db = openRoomDb(tmp);
  return { tmp, db };
}

function cleanup(tmp, db) {
  try { closeRoomDb(db); } catch (_) { /* ignore */ }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

// Insert a node of a given type with a last_modified_at N days before REF_NOW.
function insertNode(db, id, type, ageDays, opts) {
  const options = opts || {};
  const lastModified = REF_NOW - ageDays * DAY_MS;
  db.prepare(
    "INSERT INTO nodes " +
    "(id, type, properties, source_path, created_by, review_status, " +
    " created_at, last_seen_at, valid_from, last_modified_at) " +
    "VALUES (?, ?, '{}', ?, 'system', ?, ?, ?, ?, ?)"
  ).run(
    id, type, 'unknown/' + id,
    options.review_status || 'confirmed',
    lastModified, lastModified, lastModified, lastModified
  );
}

test('R10: a 31-day-old confirmed claim is flagged stale, a 29-day-old one is not', () => {
  const { tmp, db } = setupRoom();
  try {
    insertNode(db, 'claim:old', 'claim', 31);
    insertNode(db, 'claim:fresh', 'claim', 29);

    const stale = findStaleClaims(db, 'room', { now: () => REF_NOW });
    const ids = stale.map((s) => s.node.id);
    ok(ids.includes('claim:old'), '31-day-old confirmed claim is flagged: ' + JSON.stringify(ids));
    ok(!ids.includes('claim:fresh'), '29-day-old confirmed claim is NOT flagged');
  } finally { cleanup(tmp, db); }
});

test('R10: coverage across claim / assumption / opportunity / decision types', () => {
  const { tmp, db } = setupRoom();
  try {
    insertNode(db, 'claim:x', 'claim', 40);
    insertNode(db, 'assumption:x', 'assumption', 40);
    insertNode(db, 'opportunity:x', 'opportunity', 40);
    insertNode(db, 'decision:x', 'decision', 40);

    const stale = findStaleClaims(db, 'room', { now: () => REF_NOW });
    const ids = new Set(stale.map((s) => s.node.id));
    ok(ids.has('claim:x'), 'claim covered');
    ok(ids.has('assumption:x'), 'assumption covered');
    ok(ids.has('opportunity:x'), 'opportunity covered');
    ok(ids.has('decision:x'), 'decision covered');
  } finally { cleanup(tmp, db); }
});

test('R10: the window is configurable (default 30 days; a custom window changes the boundary)', () => {
  const { tmp, db } = setupRoom();
  try {
    // A 10-day-old claim is fresh under the default 30-day window but stale
    // under a 7-day window.
    insertNode(db, 'claim:10d', 'claim', 10);

    const defaultWindow = findStaleClaims(db, 'room', { now: () => REF_NOW });
    ok(!defaultWindow.map((s) => s.node.id).includes('claim:10d'),
      '10-day claim is fresh under the default 30-day window');

    const tightWindow = findStaleClaims(db, 'room', { now: () => REF_NOW, windowDays: 7 });
    ok(tightWindow.map((s) => s.node.id).includes('claim:10d'),
      '10-day claim is stale under a 7-day window');
  } finally { cleanup(tmp, db); }
});

test('R10: only confirmed/validated nodes are flagged (proposed/needs_evidence are not)', () => {
  const { tmp, db } = setupRoom();
  try {
    insertNode(db, 'claim:confirmed', 'claim', 40, { review_status: 'confirmed' });
    insertNode(db, 'claim:validated', 'claim', 40, { review_status: 'validated' });
    insertNode(db, 'claim:proposed', 'claim', 40, { review_status: 'proposed' });

    const stale = findStaleClaims(db, 'room', { now: () => REF_NOW });
    const ids = new Set(stale.map((s) => s.node.id));
    ok(ids.has('claim:confirmed'), 'confirmed flagged');
    ok(ids.has('claim:validated'), 'validated flagged');
    ok(!ids.has('claim:proposed'), 'proposed NOT flagged (not a settled claim)');
  } finally { cleanup(tmp, db); }
});

test('R10: findStaleClaims is re-exported on navigation.cjs; findStaleDecisions unchanged', () => {
  const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
  equal(typeof navigation.findStaleClaims, 'function', 'findStaleClaims re-exported on navigation.cjs');
  equal(typeof navigation.findStaleDecisions, 'function', 'findStaleDecisions still present (back-compat)');
});
