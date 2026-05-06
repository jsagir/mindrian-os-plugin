/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.2-06 Task 2 -- Shape F.6 Plan Review Round renderer test harness.
 *
 * Covers renderShapeF6PlanReview() + buildReviewedEdge() + emitRoundCompleted()
 * per CONTEXT.md F.6 spec body 2026-04-29 + D-AMEND-04 (personaContext) +
 * D-AMEND-05 (Tier 2 persona-aware decoys via decoy-tier dispatcher).
 *
 * R1 collision invariant: lib/hmi/shape-f6-renderer.cjs (Phase 101-01)
 * sha256 byte-equal pre/post -- spot checked inside the harness against
 * the recorded baseline 1792535860abc791222bf0ecf59599d66e49ad9cc1606b3d8679fca2922150cf.
 *
 * Implementing plan: .planning/phases/88.2-uiux-selector-block/88.2-06-PLAN.md (Task 2)
 */
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const {
  renderShapeF6PlanReview,
  buildReviewedEdge,
  emitRoundCompleted,
  F6_VERBS,
  VALID_RESPONSES,
} = require('../lib/hmi/shape-f6-plan-review-renderer.cjs');
const { EVENT_TYPES } = require('../lib/core/navigation/memory-events.cjs');

function mkTmpRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmp-room-f6pr-'));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  return dir;
}

function bootstrapDb(roomDir) {
  // Project standard: node:sqlite DatabaseSync per lib/core/lazygraph-ops.cjs.
  // better-sqlite3 documented as broken in lib/import/PRECONDITIONS.md.
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch (_e) {
    return null;
  }
  const dbPath = path.join(roomDir, '.mindrian', 'room.db');
  const db = new DatabaseSync(dbPath);
  db.exec(
    "CREATE TABLE IF NOT EXISTS nodes (" +
      "id TEXT PRIMARY KEY, " +
      "type TEXT NOT NULL, " +
      "properties TEXT DEFAULT '{}', " +
      "source_path TEXT NOT NULL, " +
      "created_by TEXT NOT NULL, " +
      "confidence REAL, " +
      "review_status TEXT NOT NULL DEFAULT 'proposed', " +
      "created_at INTEGER NOT NULL, " +
      "last_seen_at INTEGER NOT NULL" +
    ");"
  );
  db.close();
  return dbPath;
}

test('F.6 plan-review renders 3 verbs in fixed order (Confirm/Reject/Discuss)', () => {
  const out = renderShapeF6PlanReview({ tier: 2, position: 1, totalQuestions: 20 });
  assert.deepEqual(out.contract.verbs, ['Confirm', 'Reject', 'Discuss']);
  assert.equal(F6_VERBS.length, 3);
  assert.deepEqual(F6_VERBS, ['Confirm', 'Reject', 'Discuss']);
});

test('F.6 plan-review contract.shape is F.6 + keyboard askuserquestion', () => {
  const out = renderShapeF6PlanReview({ tier: 2, position: 1, totalQuestions: 20 });
  assert.equal(out.contract.shape, 'F.6');
  assert.equal(out.contract.keyboard, 'askuserquestion');
});

test('F.6 plan-review freeTextOffered === false (closed-vocab; reject reason captured downstream)', () => {
  const out = renderShapeF6PlanReview({ tier: 2, position: 1, totalQuestions: 20 });
  assert.equal(out.contract.freeTextOffered, false);
});

test('F.6 plan-review contract.border_style === double (parent shape, not sub-decision)', () => {
  const out = renderShapeF6PlanReview({ tier: 2, position: 1, totalQuestions: 20 });
  assert.equal(out.contract.border_style, 'double');
});

test('F.6 plan-review header carries ROUND N of M format', () => {
  const out = renderShapeF6PlanReview({ tier: 2, position: 7, totalQuestions: 20 });
  assert.ok(out.zones.header.indexOf('ROUND 7 of 20') !== -1, 'header must include "ROUND 7 of 20"; got: ' + out.zones.header);
});

test('F.6 plan-review cold-start (no personaContext) renders WITHOUT lens suffix', () => {
  const out = renderShapeF6PlanReview({ tier: 2, position: 1, totalQuestions: 20 });
  assert.equal(out.zones.header.indexOf('lens'), -1);
  assert.equal(out.zones.header.indexOf('('), -1, 'cold-start must not have parens for persona suffix');
  assert.equal(out.contract.personaContext, null);
});

test('F.6 plan-review warm (personaContext=founder) renders with " (founder lens)" suffix', () => {
  const out = renderShapeF6PlanReview({
    tier: 2, position: 1, totalQuestions: 20, personaContext: 'founder',
  });
  assert.ok(out.zones.header.indexOf('(founder lens)') !== -1,
    'header must include "(founder lens)"; got: ' + out.zones.header);
  assert.equal(out.contract.personaContext, 'founder');
});

test('F.6 plan-review mode mapping (tier >= 2 => A; else B)', () => {
  assert.equal(renderShapeF6PlanReview({ tier: 3, position: 1, totalQuestions: 20 }).contract.mode, 'A');
  assert.equal(renderShapeF6PlanReview({ tier: 2, position: 1, totalQuestions: 20 }).contract.mode, 'A');
  assert.equal(renderShapeF6PlanReview({ tier: 1, position: 1, totalQuestions: 20 }).contract.mode, 'B');
  assert.equal(renderShapeF6PlanReview({ tier: 0, position: 1, totalQuestions: 20 }).contract.mode, 'B');
});

test('F.6 plan-review body contains the user-story claim + 3 verb rows', () => {
  const out = renderShapeF6PlanReview({
    tier: 2, position: 1, totalQuestions: 20,
    claim: 'Phase 89 ships rs-external Pinecone with public OpenAlex metadata',
  });
  assert.ok(out.zones.body.indexOf('Phase 89 ships rs-external Pinecone') !== -1, 'body must include claim');
  assert.ok(out.zones.body.indexOf('Confirm') !== -1, 'body must include Confirm');
  assert.ok(out.zones.body.indexOf('Reject') !== -1, 'body must include Reject');
  assert.ok(out.zones.body.indexOf('Discuss') !== -1, 'body must include Discuss');
});

test('F.6 plan-review body contains progress percentage + count chips', () => {
  const out = renderShapeF6PlanReview({
    tier: 2, position: 7, totalQuestions: 20,
    counts: { confirm: 5, reject: 1, discuss: 0 },
  });
  // 7/20 = 35%
  assert.ok(out.zones.body.indexOf('35%') !== -1, 'body must include 35% progress; got: ' + out.zones.body);
  assert.ok(out.zones.body.indexOf('confirm 5') !== -1, 'body must include "confirm 5"');
  assert.ok(out.zones.body.indexOf('reject 1') !== -1, 'body must include "reject 1"');
  assert.ok(out.zones.body.indexOf('discuss 0') !== -1, 'body must include "discuss 0"');
});

test('F.6 plan-review 12-glyph audit (no forbidden box chars)', () => {
  const out = renderShapeF6PlanReview({
    tier: 2, position: 1, totalQuestions: 20,
    claim: 'always emit edges; never bypass auth',
    counts: { confirm: 3, reject: 1, discuss: 2 },
  });
  const forbidden = /[╭╮╰╯━┃✗❌❓❗]/;
  assert.equal(forbidden.test(out.zones.header), false, 'F.6 header must not contain forbidden glyphs');
  assert.equal(forbidden.test(out.zones.body), false, 'F.6 body must not contain forbidden glyphs');
});

test('F.6 plan-review contract.position + total_questions + round_id surfaced', () => {
  const out = renderShapeF6PlanReview({
    tier: 2, position: 7, totalQuestions: 20, round_id: 'round-uuid-abc',
  });
  assert.equal(out.contract.position, 7);
  assert.equal(out.contract.total_questions, 20);
  assert.equal(out.contract.round_id, 'round-uuid-abc');
});

test('F.6 plan-review recommended === null in both Mode A and Mode B (closed-vocab)', () => {
  assert.equal(renderShapeF6PlanReview({ tier: 2, position: 1, totalQuestions: 20 }).contract.recommended, null);
  assert.equal(renderShapeF6PlanReview({ tier: 0, position: 1, totalQuestions: 20 }).contract.recommended, null);
});

test('VALID_RESPONSES is the canonical 4-element closed set', () => {
  assert.deepEqual(VALID_RESPONSES, ['confirm', 'reject', 'discuss', 'free-text']);
});

test('selector_response event type registered (88.2-00 prerequisite)', () => {
  assert.ok(EVENT_TYPES.has('selector_response'),
    'EVENT_TYPES must include selector_response (landed by 88.2-00)');
});

test('f6_round_completed event type registered (88.2-00 prerequisite)', () => {
  assert.ok(EVENT_TYPES.has('f6_round_completed'),
    'EVENT_TYPES must include f6_round_completed (landed by 88.2-00)');
});

test('buildReviewedEdge rejects invalid round_id', () => {
  const room = mkTmpRoom();
  const r = buildReviewedEdge({
    roomDir: room, round_id: '', position: 1, latency_ms: 100,
    was_decoy: false, response: 'confirm',
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid_round_id');
});

test('buildReviewedEdge rejects invalid position', () => {
  const room = mkTmpRoom();
  const r = buildReviewedEdge({
    roomDir: room, round_id: 'rid', position: 0, latency_ms: 100,
    was_decoy: false, response: 'confirm',
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid_position');
});

test('buildReviewedEdge rejects invalid was_decoy (must be boolean)', () => {
  const room = mkTmpRoom();
  const r = buildReviewedEdge({
    roomDir: room, round_id: 'rid', position: 1, latency_ms: 100,
    was_decoy: 'yes', response: 'confirm',
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid_was_decoy');
});

test('buildReviewedEdge rejects invalid response (closed-vocab)', () => {
  const room = mkTmpRoom();
  const r = buildReviewedEdge({
    roomDir: room, round_id: 'rid', position: 1, latency_ms: 100,
    was_decoy: false, response: 'maybe',
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid_response');
});

test('buildReviewedEdge rejects out-of-range confidence_self_report', () => {
  const room = mkTmpRoom();
  const r = buildReviewedEdge({
    roomDir: room, round_id: 'rid', position: 1, latency_ms: 100,
    was_decoy: false, response: 'confirm', confidence_self_report: 99,
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid_confidence');
});

test('buildReviewedEdge writes REVIEWED edge (selector_response event) on success', () => {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch (e) {
    console.log('SKIP: node:sqlite not available (' + (e && e.code ? e.code : 'unknown') + ')');
    return;
  }
  const room = mkTmpRoom();
  const dbPath = bootstrapDb(room);
  if (!dbPath) {
    console.log('SKIP: bootstrap failed');
    return;
  }
  const r = buildReviewedEdge({
    roomDir: room,
    round_id: 'round-uuid-abc',
    position: 7,
    latency_ms: 4521,
    was_decoy: false,
    response: 'confirm',
    confidence_self_report: 4,
  });
  assert.equal(r.ok, true);
  const db = new DatabaseSync(dbPath);
  const row = db.prepare(
    "SELECT json_extract(properties, '$.event_type') AS et, " +
    "json_extract(properties, '$.round_id') AS rid, " +
    "json_extract(properties, '$.position') AS pos, " +
    "json_extract(properties, '$.was_decoy') AS wd, " +
    "json_extract(properties, '$.response') AS resp " +
    "FROM nodes WHERE type='memory_event'"
  ).get();
  db.close();
  assert.equal(row.et, 'selector_response');
  assert.equal(row.rid, 'round-uuid-abc');
  assert.equal(row.pos, 7);
  assert.equal(row.resp, 'confirm');
});

test('emitRoundCompleted writes f6_round_completed event on success', () => {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch (e) {
    console.log('SKIP: node:sqlite not available (' + (e && e.code ? e.code : 'unknown') + ')');
    return;
  }
  const room = mkTmpRoom();
  const dbPath = bootstrapDb(room);
  if (!dbPath) {
    console.log('SKIP: bootstrap failed');
    return;
  }
  const r = emitRoundCompleted({
    roomDir: room, round_id: 'round-uuid-xyz',
    real_count: 16, decoy_count: 4, tier: 'tier-0',
  });
  assert.equal(r.ok, true);
  const db = new DatabaseSync(dbPath);
  const row = db.prepare(
    "SELECT json_extract(properties, '$.event_type') AS et, " +
    "json_extract(properties, '$.round_id') AS rid, " +
    "json_extract(properties, '$.real_count') AS rc, " +
    "json_extract(properties, '$.decoy_count') AS dc, " +
    "json_extract(properties, '$.tier') AS t " +
    "FROM nodes WHERE type='memory_event'"
  ).get();
  db.close();
  assert.equal(row.et, 'f6_round_completed');
  assert.equal(row.rid, 'round-uuid-xyz');
  assert.equal(row.rc, 16);
  assert.equal(row.dc, 4);
  assert.equal(row.t, 'tier-0');
});

test('Canon Part 8 zero-network: shape-f6-plan-review-renderer.cjs has no http/https/fetch', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '..', 'lib', 'hmi', 'shape-f6-plan-review-renderer.cjs'),
    'utf8'
  );
  let code = src;
  code = code.replace(/\/\*[\s\S]*?\*\//g, '');
  code = code.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const forbidden = [
    /fetch\s*\(/,
    /\bhttps:\/\//,
    /\bhttp:\/\//,
    /\baxios\b/,
    /brain[-_]client/i,
    /brain\.mindrian\.ai/i,
  ];
  for (const re of forbidden) {
    assert.equal(re.test(code), false, 'forbidden pattern matched: ' + re);
  }
});

test('R1 invariant: Phase 101-01 lib/hmi/shape-f6-renderer.cjs sha256 baseline preserved', () => {
  const expected = '1792535860abc791222bf0ecf59599d66e49ad9cc1606b3d8679fca2922150cf';
  const actual = crypto.createHash('sha256').update(
    fs.readFileSync(path.resolve(__dirname, '..', 'lib', 'hmi', 'shape-f6-renderer.cjs'))
  ).digest('hex');
  assert.equal(actual, expected,
    'lib/hmi/shape-f6-renderer.cjs (Phase 101-01) MUST be byte-equal pre/post (R1 collision invariant)');
});
