'use strict';

/*
 * Phase 120-02 Wave 2 Task 1 -- D-13..D-15 resurfacing rules unit tests.
 *
 * Tests 1-14 cover:
 *   - SEVEN_DAY_COOLDOWN_MS verbatim lock (D-13)
 *   - hasBeenConfirmed (D-14 once-only marker)
 *   - hasBeenFiledAsDecision (D-15 never-resurface marker)
 *   - dismissalCooldownExpired (D-13 first half)
 *   - newArtifactsAccumulated (D-13 second half; user verbatim:
 *     "Time passing alone doesn't license resurfacing -- that's manipulation")
 *   - isEligibleForSurfacing composite gate enforcing D-13 BOTH-condition rule
 *
 * Canon Part 8 source-grep + em-dash HARD RULE asserted in Tests 22 + 23
 * (covered jointly with canary.test.cjs counterpart -- see canary.test.cjs).
 */

const test = require('node:test');
const { strict: assert } = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const resurfacing = require(path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'resurfacing.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

function makeTmpDb(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const db = openRoomDb(dir);
  return { dir, db };
}

function seedNodeAsArtifact(db, id) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
    "VALUES (?, 'artifact', '{}', 'test', 'system', 'confirmed', ?, ?)"
  ).run(id, nowMs, nowMs);
}

// Helper: write a memory_event with a controlled created_at (for cooldown tests).
function backdateLastEvent(db, eventId, backdatedMs) {
  db.prepare("UPDATE nodes SET created_at = ? WHERE id = ?").run(backdatedMs, eventId);
}

test('120-02 Task 1 Test 1: SEVEN_DAY_COOLDOWN_MS verbatim = 604800000', () => {
  assert.equal(resurfacing.SEVEN_DAY_COOLDOWN_MS, 7 * 24 * 3600 * 1000);
  assert.equal(resurfacing.SEVEN_DAY_COOLDOWN_MS, 604800000);
});

test('120-02 Task 1 Test 2: hasBeenConfirmed returns true given a breakthrough_confirmed event', () => {
  const { dir, db } = makeTmpDb('p120-02-t1-t2-');
  const r = navigation.logMemoryEvent(db, 'breakthrough_confirmed', {
    breakthrough_id: 'bk:1',
    kind: 'convergence',
    source_path: 'system:test',
    created_by: 'system',
  });
  assert.equal(r.ok, true);
  assert.equal(resurfacing.hasBeenConfirmed('bk:1', db), true);
});

test('120-02 Task 1 Test 3: hasBeenConfirmed returns false on empty event log', () => {
  const { dir, db } = makeTmpDb('p120-02-t1-t3-');
  assert.equal(resurfacing.hasBeenConfirmed('bk:never', db), false);
});

test('120-02 Task 1 Test 4: hasBeenFiledAsDecision returns true given a breakthrough_filed_as_decision event', () => {
  const { dir, db } = makeTmpDb('p120-02-t1-t4-');
  const r = navigation.logMemoryEvent(db, 'breakthrough_filed_as_decision', {
    breakthrough_id: 'bk:2',
    kind: 'convergence',
    source_path: 'system:test',
    created_by: 'system',
  });
  assert.equal(r.ok, true);
  assert.equal(resurfacing.hasBeenFiledAsDecision('bk:2', db), true);
});

test('120-02 Task 1 Test 5: dismissalCooldownExpired returns false when dismissed 3 days ago', () => {
  const { dir, db } = makeTmpDb('p120-02-t1-t5-');
  const r = navigation.logMemoryEvent(db, 'breakthrough_dismissed', {
    breakthrough_id: 'bk:3',
    kind: 'convergence',
    artifact_ids_at_dismiss: ['a1', 'a2', 'a3'],
    source_path: 'system:test',
    created_by: 'system',
  });
  assert.equal(r.ok, true);
  // Backdate the event to 3 days ago.
  backdateLastEvent(db, r.eventId, Date.now() - 3 * 24 * 3600 * 1000);
  assert.equal(resurfacing.dismissalCooldownExpired('bk:3', db), false);
});

test('120-02 Task 1 Test 6: dismissalCooldownExpired returns true when dismissed 8 days ago', () => {
  const { dir, db } = makeTmpDb('p120-02-t1-t6-');
  const r = navigation.logMemoryEvent(db, 'breakthrough_dismissed', {
    breakthrough_id: 'bk:4',
    kind: 'convergence',
    artifact_ids_at_dismiss: ['a1'],
    source_path: 'system:test',
    created_by: 'system',
  });
  assert.equal(r.ok, true);
  backdateLastEvent(db, r.eventId, Date.now() - 8 * 24 * 3600 * 1000);
  assert.equal(resurfacing.dismissalCooldownExpired('bk:4', db), true);
});

test('120-02 Task 1 Test 7: dismissalCooldownExpired returns true on never-dismissed breakthrough', () => {
  const { dir, db } = makeTmpDb('p120-02-t1-t7-');
  // Vacuously eligible: cooldown rule applies only IF the breakthrough was dismissed.
  assert.equal(resurfacing.dismissalCooldownExpired('bk:fresh', db), true);
});

test('120-02 Task 1 Test 8: newArtifactsAccumulated returns true when current_artifact_count exceeds baseline', () => {
  const { dir, db } = makeTmpDb('p120-02-t1-t8-');
  const r = navigation.logMemoryEvent(db, 'breakthrough_dismissed', {
    breakthrough_id: 'bk:5',
    kind: 'convergence',
    artifact_ids_at_dismiss: ['a1', 'a2', 'a3'],
    source_path: 'system:test',
    created_by: 'system',
  });
  assert.equal(r.ok, true);
  backdateLastEvent(db, r.eventId, Date.now() - 8 * 24 * 3600 * 1000);
  // Baseline = 3 at dismiss; current count = 4 -> accumulated.
  const elig4 = resurfacing.isEligibleForSurfacing('bk:5', db, { current_artifact_count: 4 });
  assert.equal(elig4.eligible, true);
  // Baseline = 3 at dismiss; current count = 3 -> NOT accumulated.
  const elig3 = resurfacing.isEligibleForSurfacing('bk:5', db, { current_artifact_count: 3 });
  assert.equal(elig3.eligible, false);
  assert.equal(elig3.reason, 'dismiss_no_new_artifacts');
});

test('120-02 Task 1 Test 9: isEligibleForSurfacing returns eligible:true on never-seen breakthrough', () => {
  const { dir, db } = makeTmpDb('p120-02-t1-t9-');
  const elig = resurfacing.isEligibleForSurfacing('bk:fresh', db, { current_artifact_count: 4 });
  assert.equal(elig.eligible, true);
});

test('120-02 Task 1 Test 10: isEligibleForSurfacing D-14 confirmed once-only blocked', () => {
  const { dir, db } = makeTmpDb('p120-02-t1-t10-');
  navigation.logMemoryEvent(db, 'breakthrough_confirmed', {
    breakthrough_id: 'bk:c',
    source_path: 'system:test',
    created_by: 'system',
  });
  const elig = resurfacing.isEligibleForSurfacing('bk:c', db, { current_artifact_count: 99 });
  assert.equal(elig.eligible, false);
  assert.equal(elig.reason, 'confirmed_once_only');
});

test('120-02 Task 1 Test 11: isEligibleForSurfacing D-15 filed-as-decision blocked', () => {
  const { dir, db } = makeTmpDb('p120-02-t1-t11-');
  navigation.logMemoryEvent(db, 'breakthrough_filed_as_decision', {
    breakthrough_id: 'bk:f',
    source_path: 'system:test',
    created_by: 'system',
  });
  const elig = resurfacing.isEligibleForSurfacing('bk:f', db, { current_artifact_count: 99 });
  assert.equal(elig.eligible, false);
  assert.equal(elig.reason, 'filed_as_decision_never_resurfaces');
});

test('120-02 Task 1 Test 12: isEligibleForSurfacing D-13 dismissed in cooldown blocked', () => {
  const { dir, db } = makeTmpDb('p120-02-t1-t12-');
  const r = navigation.logMemoryEvent(db, 'breakthrough_dismissed', {
    breakthrough_id: 'bk:d',
    artifact_ids_at_dismiss: ['a1'],
    source_path: 'system:test',
    created_by: 'system',
  });
  backdateLastEvent(db, r.eventId, Date.now() - 3 * 24 * 3600 * 1000);
  const elig = resurfacing.isEligibleForSurfacing('bk:d', db, { current_artifact_count: 99 });
  assert.equal(elig.eligible, false);
  assert.equal(elig.reason, 'dismiss_cooldown_active');
});

test('120-02 Task 1 Test 13: isEligibleForSurfacing D-13 cooldown expired BUT no new artifacts blocked (BOTH-condition lock)', () => {
  // Per CONTEXT.md D-13 + user verbatim 2026-05-16: "Time passing alone doesn't
  // license resurfacing -- that's manipulation". This test prevents OR drift
  // (the BOTH-condition rule MUST stay AND, not OR).
  const { dir, db } = makeTmpDb('p120-02-t1-t13-');
  const r = navigation.logMemoryEvent(db, 'breakthrough_dismissed', {
    breakthrough_id: 'bk:13',
    artifact_ids_at_dismiss: ['a1', 'a2', 'a3'],
    source_path: 'system:test',
    created_by: 'system',
  });
  backdateLastEvent(db, r.eventId, Date.now() - 8 * 24 * 3600 * 1000);
  // Cooldown expired (8 > 7) but artifact count unchanged (3 == 3 baseline).
  const elig = resurfacing.isEligibleForSurfacing('bk:13', db, { current_artifact_count: 3 });
  assert.equal(elig.eligible, false);
  assert.equal(elig.reason, 'dismiss_no_new_artifacts');
});

test('120-02 Task 1 Test 14: isEligibleForSurfacing D-13 BOTH conditions met -> eligible', () => {
  const { dir, db } = makeTmpDb('p120-02-t1-t14-');
  const r = navigation.logMemoryEvent(db, 'breakthrough_dismissed', {
    breakthrough_id: 'bk:14',
    artifact_ids_at_dismiss: ['a1', 'a2'],
    source_path: 'system:test',
    created_by: 'system',
  });
  backdateLastEvent(db, r.eventId, Date.now() - 8 * 24 * 3600 * 1000);
  // Cooldown expired AND new artifacts accumulated (5 > 2).
  const elig = resurfacing.isEligibleForSurfacing('bk:14', db, { current_artifact_count: 5 });
  assert.equal(elig.eligible, true);
});

test('120-02 Task 1 Test 22: Canon Part 8 source-grep -- zero Brain coupling in resurfacing.cjs', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'resurfacing.cjs'), 'utf8');
  // Real API call patterns only -- not documentation prose (cf. 120-00 Deviation 2).
  assert.equal(/require\s*\(\s*['"][^'"]*brain-client[^'"]*['"]\s*\)/.test(src), false,
    'resurfacing.cjs must not require brain-client');
  assert.equal(/fetch\s*\(\s*['"][^'"]*brain\.mindrian/.test(src), false,
    'resurfacing.cjs must not fetch brain.mindrian.*');
});

test('120-02 Task 1 Test 23: em-dash HARD RULE -- zero U+2014 in resurfacing.cjs', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'resurfacing.cjs'), 'utf8');
  // The U+2014 byte sequence in UTF-8 is 0xE2 0x80 0x94. Use codepoint check
  // instead of including the literal character in the test source (which would
  // make this test self-trip).
  let count = 0;
  for (const ch of src) {
    if (ch.charCodeAt(0) === 0x2014) count++;
  }
  assert.equal(count, 0, 'resurfacing.cjs must contain zero U+2014 em-dash characters');
});
