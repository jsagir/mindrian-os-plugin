/*
 * Phase 88.2-05 -- F.0 Mini Decision Gate test harness.
 * Covers renderer contract + REJECTED_BECAUSE schema.
 */
'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { renderShapeF0, buildRejectedBecauseEdge, F0_VERBS } = require('../lib/hmi/shape-f0-renderer.cjs');
const { EVENT_TYPES } = require('../lib/core/navigation/memory-events.cjs');

function mkTmpRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmp-room-f0-'));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  return dir;
}

test('F.0 renders 3 verbs in fixed order', () => {
  const out = renderShapeF0({ tier: 2 });
  assert.deepEqual(out.contract.verbs, ['Approve', 'Reject', 'Defer']);
  assert.equal(F0_VERBS.length, 3);
});

test('F.0 contract.shape is F.0', () => {
  const out = renderShapeF0({ tier: 2 });
  assert.equal(out.contract.shape, 'F.0');
  assert.equal(out.contract.keyboard, 'askuserquestion');
});

test('F.0 freeTextOffered === false (closed-vocab carve-out)', () => {
  const out = renderShapeF0({ tier: 2 });
  assert.equal(out.contract.freeTextOffered, false);
});

test('F.0 recommended === null in both Mode A and Mode B', () => {
  assert.equal(renderShapeF0({ tier: 2 }).contract.recommended, null);
  assert.equal(renderShapeF0({ tier: 0 }).contract.recommended, null);
});

test('F.0 mode mapping (tier >= 2 => A; else B)', () => {
  assert.equal(renderShapeF0({ tier: 3 }).contract.mode, 'A');
  assert.equal(renderShapeF0({ tier: 2 }).contract.mode, 'A');
  assert.equal(renderShapeF0({ tier: 1 }).contract.mode, 'B');
  assert.equal(renderShapeF0({ tier: 0 }).contract.mode, 'B');
});

test('F.0 ignores caller-supplied personaContext (persona-AGNOSTIC)', () => {
  const out = renderShapeF0({ tier: 2, personaContext: 'founder' });
  assert.equal(out.zones.header.indexOf('founder'), -1);
  assert.equal(out.zones.header.indexOf('lens'), -1);
});

test('F.0 ignores caller-supplied verbs override (closed-vocab)', () => {
  const out = renderShapeF0({ tier: 2, verbs: ['X', 'Y'] });
  assert.deepEqual(out.contract.verbs, ['Approve', 'Reject', 'Defer']);
});

test('F.0 contract.border_style === single (visual cue)', () => {
  const out = renderShapeF0({ tier: 2 });
  assert.equal(out.contract.border_style, 'single');
});

test('F.0 contract.parent_decision_id surfaces caller-supplied value', () => {
  assert.equal(renderShapeF0({ tier: 2 }).contract.parent_decision_id, null);
  assert.equal(renderShapeF0({ tier: 2, parent_decision_id: 'node:abc' }).contract.parent_decision_id, 'node:abc');
});

test('F.0 12-glyph audit (no forbidden box chars in body output)', () => {
  const out = renderShapeF0({ tier: 2, body: 'Apply the cascade?' });
  const forbidden = /[╭╮╰╯━┃✗❌❓❗]/;
  assert.equal(forbidden.test(out.zones.body), false, 'F.0 body must not contain forbidden glyphs');
  assert.equal(forbidden.test(out.zones.header), false, 'F.0 header must not contain forbidden glyphs');
});

test('F.0 body composition includes claim text + 3 verb rows', () => {
  const out = renderShapeF0({ tier: 2, body: 'Apply the cascade?' });
  assert.ok(out.zones.body.indexOf('Apply the cascade?') !== -1, 'body must include caller claim text');
  assert.ok(out.zones.body.indexOf('Approve') !== -1);
  assert.ok(out.zones.body.indexOf('Reject') !== -1);
  assert.ok(out.zones.body.indexOf('Defer') !== -1);
});

test('selector_rejection_captured event type is registered (88.2-00 prerequisite)', () => {
  assert.ok(EVENT_TYPES.has('selector_rejection_captured'),
    'EVENT_TYPES must include selector_rejection_captured (landed by 88.2-00)');
});

test('buildRejectedBecauseEdge rejects invalid reason', () => {
  const room = mkTmpRoom();
  const r = buildRejectedBecauseEdge({ roomDir: room, reason: '', parent_decision_id: 'p1' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid_reason');
});

test('buildRejectedBecauseEdge rejects missing parent_decision_id', () => {
  const room = mkTmpRoom();
  const r = buildRejectedBecauseEdge({ roomDir: room, reason: 'because X' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid_parent_decision_id');
});

test('buildRejectedBecauseEdge rejects out-of-range confidence_self_report', () => {
  const room = mkTmpRoom();
  const r = buildRejectedBecauseEdge({ roomDir: room, reason: 'r', parent_decision_id: 'p', confidence_self_report: 99 });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid_confidence');
});

test('buildRejectedBecauseEdge writes typed edge to room.db on success', () => {
  let Database;
  let db;
  try {
    Database = require('better-sqlite3');
    const probeRoom = mkTmpRoom();
    const probePath = path.join(probeRoom, '.mindrian', 'probe.db');
    db = new Database(probePath);
    db.close();
    fs.rmSync(probeRoom, { recursive: true, force: true });
  } catch (e) {
    console.log('SKIP: better-sqlite3 not loadable (' + (e && e.code ? e.code : 'unknown') + ')');
    return;
  }
  const room = mkTmpRoom();
  const dbPath = path.join(room, '.mindrian', path.basename(room) + '.db');
  db = new Database(dbPath);
  db.exec("CREATE TABLE IF NOT EXISTS nodes (id TEXT PRIMARY KEY, type TEXT, properties TEXT, source_path TEXT, created_by TEXT, confidence REAL, review_status TEXT, created_at INTEGER, last_seen_at INTEGER);");
  db.close();
  const r = buildRejectedBecauseEdge({
    roomDir: room,
    reason: 'this changes the assumption',
    parent_decision_id: 'node:f4-insight-42',
    actor_id: 'jonathan',
    confidence_self_report: 4,
  });
  assert.equal(r.ok, true);
  const db2 = new Database(dbPath);
  const row = db2.prepare("SELECT json_extract(properties,'$.event_type') AS et, json_extract(properties,'$.reason') AS reason, json_extract(properties,'$.parent_decision_id') AS pid, json_extract(properties,'$.actor_id') AS aid, json_extract(properties,'$.confidence_self_report') AS conf, json_extract(properties,'$.rejected_at') AS at FROM nodes WHERE type='memory_event'").get();
  assert.equal(row.et, 'selector_rejection_captured');
  assert.equal(row.reason, 'this changes the assumption');
  assert.equal(row.pid, 'node:f4-insight-42');
  assert.equal(row.aid, 'jonathan');
  assert.equal(row.conf, 4);
  assert.ok(typeof row.at === 'string' && row.at.length > 0, 'rejected_at must be non-empty ISO string');
  db2.close();
});
