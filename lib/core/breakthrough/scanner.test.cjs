'use strict';

/*
 * Phase 120-02 Wave 2 Task 3 -- scanner unit tests (Tests 1-9).
 *
 * Coverage:
 *   1. scanForBreakthroughs cold-room (D-16 silence)
 *   2. happy-path (one convergence hit)
 *   3. D-13 resurfacing filter applied
 *   4. D-14 confirmed filter applied
 *   5. D-15 filed-as-decision filter applied
 *   6. D-19 throttle filter applied
 *   7. D-20 writeBreakthrough contract enforced
 *   8. surfaceBreakthrough emits breakthrough_surfaced + flips properties.surfaced
 *   9. surfaceBreakthrough D-20 enforcement at surface time (provenance check)
 */

const test = require('node:test');
const { strict: assert } = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const scanner = require(path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'scanner.cjs'));
const schema = require(path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'schema.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

function makeTmpRoom(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  return dir;
}

function seedArtifact(db, id) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
    "VALUES (?, 'artifact', '{}', 'test', 'system', 'confirmed', ?, ?)"
  ).run(id, nowMs, nowMs);
}

function writeWhitespaceGap(roomDir, artifacts, theme, differential) {
  const target = path.join(roomDir, '.mindrian', 'whitespace-results.json');
  let payload = { gaps: [] };
  if (fs.existsSync(target)) {
    try { payload = JSON.parse(fs.readFileSync(target, 'utf8')); } catch (_e) {}
    if (!Array.isArray(payload.gaps)) payload.gaps = [];
  }
  payload.gaps.push({
    theme: theme,
    artifacts: artifacts,
    differential: differential,
    sections: ['s1', 's2'],
    detected_at: Date.now(),
  });
  fs.writeFileSync(target, JSON.stringify(payload));
}

test('120-02 Task 3 Test 1: scanForBreakthroughs cold-room (D-16 silence)', () => {
  const roomDir = makeTmpRoom('p120-02-t3-t1-');
  // No math files seeded; no events.
  const result = scanner.scanForBreakthroughs(roomDir);
  assert.equal(result.top, null);
  assert.equal(result.more_count, 0);
  assert.ok(Array.isArray(result.throttled_kinds));
});

test('120-02 Task 3 Test 2: scanForBreakthroughs happy-path single convergence hit', () => {
  const roomDir = makeTmpRoom('p120-02-t3-t2-');
  // Open db to seed artifacts (so DERIVED_FROM FK passes).
  const db = openRoomDb(roomDir);
  seedArtifact(db, 'a1'); seedArtifact(db, 'a2'); seedArtifact(db, 'a3'); seedArtifact(db, 'a4');
  // Write a whitespace gap with 4 artifacts (hard-fire eligible per D-03).
  writeWhitespaceGap(roomDir, ['a1', 'a2', 'a3', 'a4'], 'convergent-theme', 0.7);
  db.close();

  const result = scanner.scanForBreakthroughs(roomDir);
  assert.ok(result.top, 'expected a top candidate');
  assert.equal(result.top.kind, 'convergence');
  assert.ok(Array.isArray(result.top.artifact_ids));
  assert.ok(result.top.artifact_ids.length >= 3);
});

test('120-02 Task 3 Test 3: D-13 resurfacing filter -- dismissed-in-cooldown breakthrough filtered out', () => {
  const roomDir = makeTmpRoom('p120-02-t3-t3-');
  const db = openRoomDb(roomDir);
  seedArtifact(db, 'a1'); seedArtifact(db, 'a2'); seedArtifact(db, 'a3'); seedArtifact(db, 'a4');
  writeWhitespaceGap(roomDir, ['a1', 'a2', 'a3', 'a4'], 'cooldown-theme', 0.7);
  // First scan: capture the deterministic breakthrough_id by running once.
  const first = scanner.scanForBreakthroughs(roomDir);
  // Re-open db for our seeding.
  const db2 = openRoomDb(roomDir);
  // Simulate a dismiss event for the breakthrough we just found, 3 days ago.
  const targetId = first.top ? first.top.id : null;
  if (targetId) {
    const r = navigation.logMemoryEvent(db2, 'breakthrough_dismissed', {
      breakthrough_id: targetId,
      kind: 'convergence',
      artifact_ids_at_dismiss: ['a1', 'a2', 'a3', 'a4'],
      source_path: 'system:test',
      created_by: 'system',
    });
    // Backdate to 3 days ago (still in cooldown).
    db2.prepare("UPDATE nodes SET created_at = ? WHERE id = ?")
      .run(Date.now() - 3 * 24 * 3600 * 1000, r.eventId);
  }
  db2.close();
  // Second scan: the cooldown-active candidate must NOT come back as top.
  const second = scanner.scanForBreakthroughs(roomDir);
  if (second.top && targetId) {
    assert.notEqual(second.top.id, targetId, 'cooldown-active breakthrough must not resurface');
  } else {
    assert.equal(second.top, null);
  }
});

test('120-02 Task 3 Test 4: D-14 confirmed filter -- confirmed breakthrough filtered out', () => {
  const roomDir = makeTmpRoom('p120-02-t3-t4-');
  const db = openRoomDb(roomDir);
  seedArtifact(db, 'a1'); seedArtifact(db, 'a2'); seedArtifact(db, 'a3'); seedArtifact(db, 'a4');
  writeWhitespaceGap(roomDir, ['a1', 'a2', 'a3', 'a4'], 'confirm-theme', 0.7);
  const first = scanner.scanForBreakthroughs(roomDir);
  const targetId = first.top ? first.top.id : null;
  const db2 = openRoomDb(roomDir);
  if (targetId) {
    navigation.logMemoryEvent(db2, 'breakthrough_confirmed', {
      breakthrough_id: targetId,
      kind: 'convergence',
      source_path: 'system:test',
      created_by: 'system',
    });
  }
  db2.close();
  const second = scanner.scanForBreakthroughs(roomDir);
  if (second.top && targetId) {
    assert.notEqual(second.top.id, targetId, 'confirmed once-only breakthrough must not resurface');
  } else {
    assert.equal(second.top, null);
  }
});

test('120-02 Task 3 Test 5: D-15 filed-as-decision filter -- filed breakthrough filtered out', () => {
  const roomDir = makeTmpRoom('p120-02-t3-t5-');
  const db = openRoomDb(roomDir);
  seedArtifact(db, 'a1'); seedArtifact(db, 'a2'); seedArtifact(db, 'a3'); seedArtifact(db, 'a4');
  writeWhitespaceGap(roomDir, ['a1', 'a2', 'a3', 'a4'], 'filed-theme', 0.7);
  const first = scanner.scanForBreakthroughs(roomDir);
  const targetId = first.top ? first.top.id : null;
  const db2 = openRoomDb(roomDir);
  if (targetId) {
    navigation.logMemoryEvent(db2, 'breakthrough_filed_as_decision', {
      breakthrough_id: targetId,
      kind: 'convergence',
      source_path: 'system:test',
      created_by: 'system',
    });
  }
  db2.close();
  const second = scanner.scanForBreakthroughs(roomDir);
  if (second.top && targetId) {
    assert.notEqual(second.top.id, targetId, 'filed-as-decision breakthrough must not resurface');
  } else {
    assert.equal(second.top, null);
  }
});

test('120-02 Task 3 Test 6: D-19 throttle filter -- throttled kind excluded + throttled_kinds reported', () => {
  const roomDir = makeTmpRoom('p120-02-t3-t6-');
  const db = openRoomDb(roomDir);
  // Seed 12 surfaced + 5 dismissed convergence events to trip D-19 (>30% dismiss rate
  // on sample 12 > min sample 10).
  for (let i = 0; i < 12; i++) {
    navigation.logMemoryEvent(db, 'breakthrough_surfaced', {
      breakthrough_id: 'bk:s' + i, kind: 'convergence',
      source_path: 'system:test', created_by: 'system',
    });
  }
  for (let i = 0; i < 5; i++) {
    navigation.logMemoryEvent(db, 'breakthrough_dismissed', {
      breakthrough_id: 'bk:s' + i, kind: 'convergence',
      source_path: 'system:test', created_by: 'system',
    });
  }
  seedArtifact(db, 'a1'); seedArtifact(db, 'a2'); seedArtifact(db, 'a3'); seedArtifact(db, 'a4');
  writeWhitespaceGap(roomDir, ['a1', 'a2', 'a3', 'a4'], 'throttle-theme', 0.7);
  db.close();

  const result = scanner.scanForBreakthroughs(roomDir);
  // The convergence-kind candidate is now throttled.
  assert.ok(result.throttled_kinds.indexOf('convergence') >= 0,
    'convergence should be in throttled_kinds');
  // And the convergence candidate must NOT come back as top (only convergence
  // was detected; with it filtered out, top should be null).
  assert.equal(result.top, null);
});

test('120-02 Task 3 Test 7: D-20 writeBreakthrough contract enforced -- top has Breakthrough node + DERIVED_FROM edges', () => {
  const roomDir = makeTmpRoom('p120-02-t3-t7-');
  const db = openRoomDb(roomDir);
  seedArtifact(db, 'a1'); seedArtifact(db, 'a2'); seedArtifact(db, 'a3'); seedArtifact(db, 'a4');
  writeWhitespaceGap(roomDir, ['a1', 'a2', 'a3', 'a4'], 'd20-contract', 0.7);
  db.close();

  const result = scanner.scanForBreakthroughs(roomDir);
  assert.ok(result.top);
  const targetId = result.top.id;

  // Reopen db to verify the Breakthrough node + DERIVED_FROM edges landed.
  const db2 = openRoomDb(roomDir);
  const bkRow = db2.prepare("SELECT id, type FROM nodes WHERE id = ? AND type = 'breakthrough'").get(targetId);
  assert.ok(bkRow, 'Breakthrough node must exist after scanForBreakthroughs');
  const edgeRows = db2.prepare(
    "SELECT COUNT(*) AS c FROM edges WHERE source = ? AND type = 'DERIVED_FROM'"
  ).get(targetId);
  assert.ok(edgeRows.c >= 1, 'D-20 invariant: at least one DERIVED_FROM edge required');
  db2.close();
});

test('120-02 Task 3 Test 8: surfaceBreakthrough emits breakthrough_surfaced + flips properties.surfaced', () => {
  const roomDir = makeTmpRoom('p120-02-t3-t8-');
  const db = openRoomDb(roomDir);
  seedArtifact(db, 'a1'); seedArtifact(db, 'a2'); seedArtifact(db, 'a3'); seedArtifact(db, 'a4');
  // First scan persists the breakthrough.
  writeWhitespaceGap(roomDir, ['a1', 'a2', 'a3', 'a4'], 'surface-test', 0.7);
  db.close();
  const result = scanner.scanForBreakthroughs(roomDir);
  assert.ok(result.top);
  const db2 = openRoomDb(roomDir);
  const surface = scanner.surfaceBreakthrough(result.top, {
    db: db2, roomDir: roomDir, tier: 1, more_count: 0,
  });
  assert.equal(surface.ok, true);
  // breakthrough_surfaced event emitted.
  const events = navigation.findRecentChanges(db2, 0, { eventType: 'breakthrough_surfaced', limit: 10 });
  assert.ok(events.length >= 1);
  assert.equal(events[0].properties.breakthrough_id, result.top.id);
  // properties.surfaced flipped to true.
  const bkRow = db2.prepare("SELECT properties FROM nodes WHERE id = ?").get(result.top.id);
  const props = JSON.parse(bkRow.properties);
  assert.equal(props.surfaced, true);
  db2.close();
});

test('120-02 Task 3 Test 9: surfaceBreakthrough D-20 enforcement -- refuses provenance-less surfacing', () => {
  const roomDir = makeTmpRoom('p120-02-t3-t9-');
  const db = openRoomDb(roomDir);
  // Insert a "fake" breakthrough node WITHOUT any DERIVED_FROM edges (simulating
  // a constitutional bypass attempt).
  const nowMs = Date.now();
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
    "VALUES (?, 'breakthrough', ?, 'test', 'system', 'proposed', ?, ?)"
  ).run('bk:no-prov', JSON.stringify({ kind: 'convergence', surfaced: false }), nowMs, nowMs);
  const fakeBreakthrough = { id: 'bk:no-prov', kind: 'convergence', artifact_ids: [], confidence: 0.6 };
  const surface = scanner.surfaceBreakthrough(fakeBreakthrough, {
    db: db, roomDir: roomDir, tier: 1, more_count: 0,
  });
  assert.equal(surface.ok, false);
  assert.equal(surface.reason, 'provenance_required');
  // breakthrough_surface_blocked event should be emitted per the surface gate
  // contract (key invariant from the prompt: D-20 enforcement point #4 emits this).
  const blocked = navigation.findRecentChanges(db, 0, { eventType: 'breakthrough_surface_blocked', limit: 10 });
  assert.equal(blocked.length, 1, 'breakthrough_surface_blocked event should land on provenance-less refusal');
  db.close();
});
