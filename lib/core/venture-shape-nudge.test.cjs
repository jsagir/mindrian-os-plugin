'use strict';

/*
 * Phase 119-00 Wave 1 -- venture-shape-nudge module tests.
 *
 * Mirrors the lib/memory/selector-decisions.test.cjs fixture pattern
 * (fs.mkdtempSync + openRoomDb). Tests are allowed to require room-db.cjs
 * directly per the Phase 109-06 pre-commit chokepoint allow-list for tests/.
 *
 * Covers the 7 behavior axes from 119-00-PLAN.md Task 1:
 *   Test 1 -- cold-start floor (Test 5 in plan: no room.db -> surface false)
 *   Test 2 -- venture-shape accumulation to threshold (Test 6)
 *   Test 3 -- D-01 invariant: auto_explore_fired short-circuits (Test 7)
 *   Test 4 -- venture_classification_unavailable safe-default (Test 7b)
 *   Test 5 -- venture_classified present happy-path (Test 7c)
 *   Test 6 -- no Brain client require (Test 8; source-grep audit)
 *   Test 7 -- no-room-dir guard
 */

const { test } = require('node:test');
const { strict: assert } = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const ventureShapeNudge = require(path.join(REPO_ROOT, 'lib', 'core', 'venture-shape-nudge.cjs'));
const selectorDecisions = require(path.join(REPO_ROOT, 'lib', 'workflow', 'selector-decisions.cjs'));

// FK fixture: edges(source, target) -> nodes(id), so anchor the command +
// framework nodes before recordSelectorDecision's writeEdge step can succeed.
function seedAnchorsFor(db, command, framework) {
  const nowMs = Date.now();
  for (const id of ['cmd:' + command, 'framework:' + framework]) {
    db.prepare(
      "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) " +
      "VALUES (?, ?, '{}', 'p150.6-03-fixture', 'system', NULL, 'confirmed', ?, ?)"
    ).run(id, id.startsWith('cmd:') ? 'command' : 'framework', nowMs, nowMs);
  }
}

function freshRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p119-00-nudge-'));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  const db = openRoomDb(dir);
  return { dir, db };
}

function closeQuiet(db) {
  try { db.close(); } catch (_e) { /* graceful */ }
}

test('Test 1: cold-start floor -- no events in db returns surface:false with venture_classification_unavailable', () => {
  const { dir, db } = freshRoom();
  closeQuiet(db);
  const r = ventureShapeNudge.shouldSurfaceNudge(dir, {});
  assert.equal(r.surface, false);
  assert.equal(r.turn_count, 0);
  assert.equal(r.threshold, 3);
  assert.equal(r.skip_reason, 'venture_classification_unavailable');
});

test('Test 2: 3 venture_classified=true events reach threshold (surface=true)', () => {
  const { dir, db } = freshRoom();
  for (let i = 0; i < 3; i++) {
    const result = navigation.logMemoryEvent(db, 'f_selector_decision', {
      venture_classified: true,
      classification_source: 'haiku-4-5',
      source_path: 'test:venture-shape-nudge',
      created_by: 'system',
    });
    assert.equal(result.ok, true, 'logMemoryEvent should accept f_selector_decision; got reason=' + (result.reason || ''));
  }
  closeQuiet(db);
  const r = ventureShapeNudge.shouldSurfaceNudge(dir, {});
  assert.equal(r.surface, true);
  assert.equal(r.turn_count, 3);
  assert.equal(r.threshold, 3);
  assert.equal(r.skip_reason, undefined);
});

test('Test 3: D-01 invariant -- auto_explore_fired short-circuits regardless of turn count', () => {
  const { dir, db } = freshRoom();
  // Seed 5 venture-shaped turns AND one auto_explore_fired event.
  for (let i = 0; i < 5; i++) {
    navigation.logMemoryEvent(db, 'f_selector_decision', {
      venture_classified: true,
      classification_source: 'haiku-4-5',
      source_path: 'test:venture-shape-nudge',
    });
  }
  navigation.logMemoryEvent(db, 'auto_explore_fired', {
    material_id: 'abcd1234',
    relative_file_path: 'docs/sample.md',
    room_slug: 'test-room',
    tier: 1,
    surfacing_count: 0,
    brain_baseline_present: false,
    source_path: 'test:venture-shape-nudge',
  });
  closeQuiet(db);
  const r = ventureShapeNudge.shouldSurfaceNudge(dir, {});
  assert.equal(r.surface, false);
  assert.equal(r.skip_reason, 'upload_path_active');
});

test('Test 4: venture_classification_unavailable safe-default when field absent', () => {
  const { dir, db } = freshRoom();
  // Seed events without venture_classified field at all.
  for (let i = 0; i < 5; i++) {
    navigation.logMemoryEvent(db, 'f_selector_decision', {
      command: 'mos:test',
      framework: 'test-framework',
      source_path: 'test:venture-shape-nudge',
    });
  }
  closeQuiet(db);
  const r = ventureShapeNudge.shouldSurfaceNudge(dir, {});
  assert.equal(r.surface, false);
  assert.equal(r.skip_reason, 'venture_classification_unavailable');
  assert.equal(r.turn_count, 0);
});

test('Test 5: mixed venture_classified true/false -- only true counts toward threshold', () => {
  const { dir, db } = freshRoom();
  // 3 true + 1 false; threshold=3 met.
  for (let i = 0; i < 3; i++) {
    navigation.logMemoryEvent(db, 'f_selector_decision', {
      venture_classified: true,
      classification_source: 'haiku-4-5',
      source_path: 'test:venture-shape-nudge',
    });
  }
  navigation.logMemoryEvent(db, 'f_selector_decision', {
    venture_classified: false,
    classification_source: 'haiku-4-5',
    source_path: 'test:venture-shape-nudge',
  });
  closeQuiet(db);
  const r = ventureShapeNudge.shouldSurfaceNudge(dir, {});
  assert.equal(r.surface, true);
  assert.equal(r.turn_count, 3);
});

test('Test 6: no Brain client require -- source-grep audit', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'core', 'venture-shape-nudge.cjs'), 'utf8');
  // Canon Part 8: zero brain-client require, zero mcp-server-brain require,
  // zero fetch to brain.mindrian.
  assert.equal(/require\([^)]*brain-client/.test(src), false, 'brain-client require detected');
  assert.equal(/require\([^)]*mcp-server-brain/.test(src), false, 'mcp-server-brain require detected');
  assert.equal(/brain\.mindrian/.test(src), false, 'brain.mindrian fetch reference detected');
  // Canon Part 9: zero direct room-db.cjs require.
  assert.equal(/require\([^)]*room-db\.cjs/.test(src), false, 'direct room-db.cjs require detected');
});

test('Test 7: no-room-dir guard returns safe default', () => {
  const r = ventureShapeNudge.shouldSurfaceNudge('', {});
  assert.equal(r.surface, false);
  assert.equal(r.skip_reason, 'no_room_dir');

  const r2 = ventureShapeNudge.shouldSurfaceNudge(null, {});
  assert.equal(r2.surface, false);

  // Non-existent path -> no_room_db.
  const r3 = ventureShapeNudge.shouldSurfaceNudge('/tmp/p119-nonexistent-' + Date.now(), {});
  assert.equal(r3.surface, false);
  assert.equal(r3.skip_reason, 'no_room_db');
});

test('Test 8: VENTURE_NUDGE_THRESHOLD constant exported and equals 3', () => {
  assert.equal(ventureShapeNudge.VENTURE_NUDGE_THRESHOLD, 3);
});

// ---------------------------------------------------------------------------
// FIX-05 production-shaped acceptance leg (Phase 150.6-03).
//
// Per the 150.5 lesson (DRIFT-AUDIT FIX-11): drive the PRODUCTION path, not a
// hand-built fixture. These legs call the REAL recordSelectorDecision emission
// with a sentence in hand and assert the nudge reads a field-derived result --
// NOT skip_reason:'venture_classification_unavailable'.
// ---------------------------------------------------------------------------

test('Test 9 (FIX-05 production emission): real recordSelectorDecision with a venture sentence emits venture_classified=true; nudge un-deadens', () => {
  const { dir, db } = freshRoom();
  // Drive THREE real f_selector_decision emissions through the production path,
  // each with a venture-shaped sentence in hand. The emission classifies at the
  // write seam and stores ONLY the scalar boolean + source enum.
  for (let i = 0; i < 3; i++) {
    const cmd = 'mva-brief' + i;
    const fw = 'jtbd' + i;
    seedAnchorsFor(db, cmd, fw);
    const r = selectorDecisions.recordSelectorDecision({
      decision: 'defer',
      command: cmd,
      framework: fw,
      sentence: 'I want to build a startup that helps founders validate their venture idea before raising capital',
      roomState: { db: db },
    });
    assert.equal(r.ok, true, 'recordSelectorDecision should succeed; got ' + JSON.stringify(r));
  }
  closeQuiet(db);
  const result = ventureShapeNudge.shouldSurfaceNudge(dir, {});
  // Field-derived, NOT the permanent no-op skip_reason.
  assert.notEqual(result.skip_reason, 'venture_classification_unavailable',
    'nudge must read the field-derived path, not the dead no-op');
  assert.equal(result.turn_count > 0, true, 'turn_count must be field-derived (>0) on a venture-true emission');
  assert.equal(result.surface, true, 'three venture-true emissions reach the threshold');
});

test('Test 10 (FIX-05 Part 8 fence): the f_selector_decision payload contains NO substring of the input sentence -- only scalar boolean + source enum', () => {
  const { dir, db } = freshRoom();
  // Sentence words chosen so NO word collides with a legitimate payload KEY name
  // (e.g. the key "venture_classified" legitimately contains "venture"). The
  // fence is about user-text VALUES never landing in the payload, not about key
  // names. We assert no sentence word appears in any stored property VALUE.
  const SENTENCE = 'I want to build a marketplace that connects local artisans with overseas wholesale buyers quickly';
  seedAnchorsFor(db, 'mva-brief', 'jtbd');
  const r = selectorDecisions.recordSelectorDecision({
    decision: 'defer',
    command: 'mva-brief',
    framework: 'jtbd',
    sentence: SENTENCE,
    roomState: { db: db },
  });
  assert.equal(r.ok, true);
  // Pull the raw memory_event node back and inspect its stored properties JSON.
  const row = db.prepare("SELECT properties FROM nodes WHERE id = ?").get(r.decision_id);
  assert.ok(row, 'memory_event node must exist');
  const propsRaw = row.properties || '{}';
  const props = JSON.parse(propsRaw);
  // Scalar boolean + source enum present.
  assert.equal(typeof props.venture_classified, 'boolean', 'venture_classified must be a scalar boolean');
  assert.equal(typeof props.classification_source, 'string', 'classification_source must be an enum scalar');
  // Part 8 fence: NO substring of the user sentence in any stored property VALUE.
  // Scan VALUES (not key names) so the legitimate scalar keys never trip the
  // check. The classification_source enum is a fixed vocabulary, never user text.
  const valueBlob = Object.values(props).map((v) => String(v)).join(' ');
  const words = SENTENCE.split(/\s+/).filter((w) => w.length >= 5);
  for (const w of words) {
    assert.equal(valueBlob.includes(w), false, 'Part 8 breach: sentence word "' + w + '" leaked into a payload value');
  }
  assert.equal(propsRaw.includes(SENTENCE), false, 'Part 8 breach: full sentence leaked into payload');
  closeQuiet(db);
});

test('Test 11 (FIX-05 no-sentence path unchanged): absent sentence omits venture_classified entirely; nudge safe-default still applies', () => {
  const { dir, db } = freshRoom();
  seedAnchorsFor(db, 'mva-brief', 'jtbd');
  const r = selectorDecisions.recordSelectorDecision({
    decision: 'defer',
    command: 'mva-brief',
    framework: 'jtbd',
    // no sentence
    roomState: { db: db },
  });
  assert.equal(r.ok, true);
  const row = db.prepare("SELECT properties FROM nodes WHERE id = ?").get(r.decision_id);
  const props = JSON.parse(row.properties || '{}');
  assert.equal('venture_classified' in props, false, 'no-sentence path must omit venture_classified entirely');
  closeQuiet(db);
  const result = ventureShapeNudge.shouldSurfaceNudge(dir, {});
  assert.equal(result.skip_reason, 'venture_classification_unavailable',
    'no-sentence path leaves the nudge on its existing safe-default');
});
