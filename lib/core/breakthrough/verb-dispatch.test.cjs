'use strict';

/*
 * Phase 120-02 Wave 2 Task 2 -- verb-dispatch unit tests (D-08 + D-09 + D-10).
 *
 * Tests 1-10:
 *   1. VERB_TO_EVENT lock verbatim (5 entries; 3 emit events; 2 navigational)
 *   2. dispatchVerb 'Confirm' emits breakthrough_confirmed
 *   3. dispatchVerb 'Dismiss' captures artifact_ids_at_dismiss (D-13 baseline)
 *   4. dispatchVerb 'File as decision' emits event AND writes FILED_AS_DECISION edge
 *   5. dispatchVerb 'Explore deeper' navigational; no event
 *   6. dispatchVerb 'Back' escape; no event
 *   7. dispatchVerb unknown verb -> {ok:false, reason:'unknown_verb'}
 *   8. dispatchVerb flips Breakthrough node properties handled_at + handled_verb
 *   9. Canon Part 8 source-grep
 *   10. em-dash HARD RULE
 */

const test = require('node:test');
const { strict: assert } = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const verbDispatch = require(path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'verb-dispatch.cjs'));
const schema = require(path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'schema.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

function makeTmpDb(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const db = openRoomDb(dir);
  return { dir, db };
}

function seedArtifact(db, id) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
    "VALUES (?, 'artifact', '{}', 'test', 'system', 'confirmed', ?, ?)"
  ).run(id, nowMs, nowMs);
}

function seedBreakthrough(db, id, kind, artifactIds, theme) {
  for (const aid of artifactIds) seedArtifact(db, aid);
  const r = schema.writeBreakthrough(db, {
    id: id,
    kind: kind || 'convergence',
    confidence: 0.55,
    artifact_ids: artifactIds,
    theme: theme || 'test-theme',
    differential: 0.5,
    cross_section_linked: false,
  });
  assert.equal(r.ok, true, 'seedBreakthrough writeBreakthrough should succeed');
  return r;
}

test('120-02 Task 2 Test 1: VERB_TO_EVENT lock verbatim', () => {
  const m = verbDispatch.VERB_TO_EVENT;
  assert.equal(m['Explore deeper'], null);
  assert.equal(m['Confirm'], 'breakthrough_confirmed');
  assert.equal(m['File as decision'], 'breakthrough_filed_as_decision');
  assert.equal(m['Dismiss'], 'breakthrough_dismissed');
  assert.equal(m['Back'], null);
  // Object.freeze invariant: cannot mutate keys.
  assert.throws(function () {
    'use strict';
    m['Confirm'] = 'breakthrough_other';
  });
});

test('120-02 Task 2 Test 2: dispatchVerb Confirm emits breakthrough_confirmed', () => {
  const { dir, db } = makeTmpDb('p120-02-t2-t2-');
  seedBreakthrough(db, 'bk:1', 'convergence', ['a1', 'a2']);
  const r = verbDispatch.dispatchVerb('Confirm', 'bk:1', { db: db });
  assert.equal(r.ok, true);
  assert.equal(r.navigational, false);
  // Verify event landed with breakthrough_id 'bk:1'.
  const events = navigation.findRecentChanges(db, 0, { eventType: 'breakthrough_confirmed', limit: 10 });
  assert.equal(events.length, 1);
  assert.equal(events[0].properties.breakthrough_id, 'bk:1');
});

test('120-02 Task 2 Test 3: dispatchVerb Dismiss captures artifact_ids_at_dismiss (D-13 baseline)', () => {
  const { dir, db } = makeTmpDb('p120-02-t2-t3-');
  seedBreakthrough(db, 'bk:dis', 'convergence', ['a1', 'a2', 'a3']);
  const r = verbDispatch.dispatchVerb('Dismiss', 'bk:dis', { db: db });
  assert.equal(r.ok, true);
  const events = navigation.findRecentChanges(db, 0, { eventType: 'breakthrough_dismissed', limit: 10 });
  assert.equal(events.length, 1);
  // The artifact_ids_at_dismiss MUST carry the DERIVED_FROM edge targets at dismiss time.
  assert.ok(Array.isArray(events[0].properties.artifact_ids_at_dismiss));
  assert.equal(events[0].properties.artifact_ids_at_dismiss.length, 3);
  // Set equality on the ids (order may vary depending on edge query).
  const got = new Set(events[0].properties.artifact_ids_at_dismiss);
  assert.ok(got.has('a1'));
  assert.ok(got.has('a2'));
  assert.ok(got.has('a3'));
});

test('120-02 Task 2 Test 4: dispatchVerb File as decision emits event AND writes FILED_AS_DECISION edge', () => {
  const { dir, db } = makeTmpDb('p120-02-t2-t4-');
  seedBreakthrough(db, 'bk:file', 'convergence', ['a1', 'a2']);
  // Seed the target Decision node so the FK in the FILED_AS_DECISION edge passes.
  const nowMs = Date.now();
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
    "VALUES (?, 'decision', '{}', 'test', 'system', 'proposed', ?, ?)"
  ).run('decision:bk:file', nowMs, nowMs);
  const r = verbDispatch.dispatchVerb('File as decision', 'bk:file', { db: db });
  assert.equal(r.ok, true);
  // (a) Event landed.
  const events = navigation.findRecentChanges(db, 0, { eventType: 'breakthrough_filed_as_decision', limit: 10 });
  assert.equal(events.length, 1);
  assert.equal(events[0].properties.breakthrough_id, 'bk:file');
  // (b) FILED_AS_DECISION edge landed.
  const edges = db.prepare("SELECT source, target, type FROM edges WHERE source = ? AND type = 'FILED_AS_DECISION'").all('bk:file');
  assert.equal(edges.length, 1);
  assert.equal(edges[0].target, 'decision:bk:file');
});

test('120-02 Task 2 Test 5: dispatchVerb Explore deeper navigational; no event', () => {
  const { dir, db } = makeTmpDb('p120-02-t2-t5-');
  seedBreakthrough(db, 'bk:ex', 'convergence', ['a1', 'a2']);
  const r = verbDispatch.dispatchVerb('Explore deeper', 'bk:ex', { db: db });
  assert.equal(r.ok, true);
  assert.equal(r.navigational, true);
  assert.equal(r.drill_target, 'bk:ex');
  // No memory_event for navigational verbs.
  const conf = navigation.findRecentChanges(db, 0, { eventType: 'breakthrough_confirmed', limit: 10 });
  const dism = navigation.findRecentChanges(db, 0, { eventType: 'breakthrough_dismissed', limit: 10 });
  const file = navigation.findRecentChanges(db, 0, { eventType: 'breakthrough_filed_as_decision', limit: 10 });
  assert.equal(conf.length, 0);
  assert.equal(dism.length, 0);
  assert.equal(file.length, 0);
});

test('120-02 Task 2 Test 6: dispatchVerb Back escape; no event', () => {
  const { dir, db } = makeTmpDb('p120-02-t2-t6-');
  seedBreakthrough(db, 'bk:bk', 'convergence', ['a1', 'a2']);
  const r = verbDispatch.dispatchVerb('Back', 'bk:bk', { db: db });
  assert.equal(r.ok, true);
  assert.equal(r.navigational, true);
  assert.equal(r.escape, true);
  const conf = navigation.findRecentChanges(db, 0, { eventType: 'breakthrough_confirmed', limit: 10 });
  assert.equal(conf.length, 0);
});

test('120-02 Task 2 Test 7: dispatchVerb unknown verb -> {ok:false, reason:"unknown_verb"}', () => {
  const { dir, db } = makeTmpDb('p120-02-t2-t7-');
  const r = verbDispatch.dispatchVerb('foo', 'bk:x', { db: db });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unknown_verb');
});

test('120-02 Task 2 Test 8: dispatchVerb Confirm flips Breakthrough node handled_at + handled_verb', () => {
  const { dir, db } = makeTmpDb('p120-02-t2-t8-');
  seedBreakthrough(db, 'bk:h', 'convergence', ['a1', 'a2']);
  verbDispatch.dispatchVerb('Confirm', 'bk:h', { db: db });
  const row = db.prepare("SELECT properties FROM nodes WHERE id = ? AND type = 'breakthrough'").get('bk:h');
  assert.ok(row, 'breakthrough node should exist after dispatch');
  const props = JSON.parse(row.properties);
  assert.equal(props.handled_verb, 'Confirm');
  assert.ok(typeof props.handled_at === 'number');
  assert.ok(props.handled_at > 0);
});

test('120-02 Task 2 Test 9: Canon Part 8 source-grep -- zero Brain coupling in verb-dispatch.cjs', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'verb-dispatch.cjs'), 'utf8');
  assert.equal(/require\s*\(\s*['"][^'"]*brain-client[^'"]*['"]\s*\)/.test(src), false,
    'verb-dispatch.cjs must not require brain-client');
  assert.equal(/fetch\s*\(\s*['"][^'"]*brain\.mindrian/.test(src), false,
    'verb-dispatch.cjs must not fetch brain.mindrian.*');
});

test('120-02 Task 2 Test 10: em-dash HARD RULE -- zero U+2014 in verb-dispatch.cjs', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'verb-dispatch.cjs'), 'utf8');
  let count = 0;
  for (const ch of src) {
    if (ch.charCodeAt(0) === 0x2014) count++;
  }
  assert.equal(count, 0, 'verb-dispatch.cjs must contain zero U+2014 em-dash characters');
});
