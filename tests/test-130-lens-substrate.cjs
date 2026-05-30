'use strict';
// Phase 130-01 -- lens substrate behavior suite (RED-first).
//
// Covers Task 1 (ALLOWED_EDGE_TYPES extension: INFORMS + REJECTED_BECAUSE,
// closing review finding H2) and Task 2 (lens-nodes.cjs node-write chokepoint:
// writeHatState / readHatState / readAllHatStates / writeLensFinding, plus the
// navigation.cjs re-exports). Hermetic via tmpdir per fixture; uses the
// canonical openRoomDb chokepoint so every node lands in the Phase-109
// provenance schema.
//
// Canon Part 4: every choice is graph data (INFORMS on accept, REJECTED_BECAUSE
//   on reject; rejection-as-data with an enum-only reason scalar per Canon Part 8).
// Canon Part 9 v1.5: a HatState node is a system-bookkeeping node (the audit-node
//   carve-out), so created_by='system' review_status='confirmed' is canon-legal
//   without a human byUser.
// Canon Part 8: all room.db access is through navigation surfaces.
// NO em-dashes in this file (CLAUDE.md HARD RULE).

const { ok, equal, deepEqual } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const edges = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'edges.cjs'));
const lensNodes = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'lens-nodes.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

// The 2 net-new lens edge-type strings (the H2 close).
const LENS_EDGE_TYPES = ['INFORMS', 'REJECTED_BECAUSE'];

// The 6 pre-existing edge types (a FLOOR -- not an exact size). These all
// existed before Phase 130; the floor assertion guards against regression.
const PRE_130_EDGE_FLOOR = [
  'DEFERRED', 'REJECTED', 'DERIVED_FROM', 'FILED_AS_DECISION',
  'FOLLOWS_FROM', 'OPERATOR_TRANSITION',
];

// The closed 6-color hat set.
const HAT_COLORS = ['white', 'red', 'black', 'yellow', 'green', 'blue'];

function makeRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-130-lens-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);
  return { tmp, db };
}

function cleanup(tmp) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

// Seed a node so edges (FK to nodes(id)) can reference it. The nodes table is
// the Phase-109 provenance schema: source_path NOT NULL, created_by in the
// closed CHECK set, review_status in the closed CHECK set.
function seedNode(db, id) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) " +
    "VALUES (?, 'lens_finding', '{}', 'fixture', 'system', NULL, 'proposed', ?, ?)"
  ).run(id, nowMs, nowMs);
}

// ---------------------------------------------------------------------------
// Task 1 -- INFORMS + REJECTED_BECAUSE added to ALLOWED_EDGE_TYPES (close H2)
// ---------------------------------------------------------------------------

function test1_lensEdgeTypesPresent() {
  for (const t of LENS_EDGE_TYPES) {
    ok(edges.ALLOWED_EDGE_TYPES.has(t), 'ALLOWED_EDGE_TYPES must contain ' + t);
  }
  // Floor membership preserved (no regression; the 6 pre-existing types stay).
  for (const t of PRE_130_EDGE_FLOOR) {
    ok(edges.ALLOWED_EDGE_TYPES.has(t), 'pre-130 floor edge type missing: ' + t);
  }
}

function test2_informsEdgeWrites() {
  const { tmp, db } = makeRoom();
  try {
    seedNode(db, 'lens_finding:a');
    seedNode(db, 'node:target');
    const r = edges.writeEdge(db, {
      source_id: 'lens_finding:a', target_id: 'node:target',
      edge_type: 'INFORMS', properties: {},
    });
    ok(r.ok, 'INFORMS writeEdge should return ok:true; got ' + JSON.stringify(r));
    equal(r.type, 'INFORMS', 'returned type should be INFORMS');
    const row = db.prepare(
      "SELECT type FROM edges WHERE source = ? AND target = ? AND type = 'INFORMS'"
    ).get('lens_finding:a', 'node:target');
    ok(row && row.type === 'INFORMS', 'an INFORMS edge row should exist');
  } finally {
    closeRoomDb(db); cleanup(tmp);
  }
}

function test3_rejectedBecauseEdgeWritesWithReasonScalar() {
  const { tmp, db } = makeRoom();
  try {
    seedNode(db, 'lens_finding:b');
    seedNode(db, 'node:topic');
    const r = edges.writeEdge(db, {
      source_id: 'lens_finding:b', target_id: 'node:topic',
      edge_type: 'REJECTED_BECAUSE', properties: { reason: 'low_evidence' },
    });
    ok(r.ok, 'REJECTED_BECAUSE writeEdge should return ok:true; got ' + JSON.stringify(r));
    // The reason scalar round-trips in properties (rejection-as-data, Canon Part 4).
    const row = db.prepare(
      "SELECT properties FROM edges WHERE source = ? AND target = ? AND type = 'REJECTED_BECAUSE'"
    ).get('lens_finding:b', 'node:topic');
    ok(row, 'a REJECTED_BECAUSE edge row should exist');
    const props = JSON.parse(row.properties);
    equal(props.reason, 'low_evidence', 'the enum-only reason scalar should round-trip');
  } finally {
    closeRoomDb(db); cleanup(tmp);
  }
}

function test4_rejectedLensTaxonomyStaysRejected() {
  const { tmp, db } = makeRoom();
  try {
    seedNode(db, 'node:s');
    seedNode(db, 'node:t');
    // ASSOCIATION_LENS stays rejected per the 2026-05-16 dual-graph verdict.
    const r = edges.writeEdge(db, {
      source_id: 'node:s', target_id: 'node:t',
      edge_type: 'ASSOCIATION_LENS', properties: {},
    });
    ok(!r.ok, 'ASSOCIATION_LENS should be rejected');
    equal(r.reason, 'invalid_edge_type', 'reason should be invalid_edge_type');
    ok(!edges.ALLOWED_EDGE_TYPES.has('ASSOCIATION_LENS'), 'ASSOCIATION_LENS must NOT be in the Set');
    ok(!edges.ALLOWED_EDGE_TYPES.has('TRANSITION_LENS'), 'TRANSITION_LENS must NOT be in the Set');
  } finally {
    closeRoomDb(db); cleanup(tmp);
  }
}

// ---------------------------------------------------------------------------
// Task 2 -- lens-nodes.cjs node-write chokepoint
// ---------------------------------------------------------------------------

function test5_writeHatStateRoundTrips() {
  const { tmp, db } = makeRoom();
  try {
    const state = {
      current_focus: 'CAR-T regulatory path',
      top_concerns: ['IND timing', 'manufacturing scale'],
      top_opportunities: ['orphan designation'],
      methodology_notes: ['black-hat surfaced FDA risk'],
      session_count: 3,
      last_analysis: '2026-05-31',
    };
    const w = lensNodes.writeHatState(db, 'black', state);
    ok(w.ok, 'writeHatState should return ok:true; got ' + JSON.stringify(w));
    equal(w.node_id, 'hatstate:black', 'node id should be hatstate:black');
    // The provenance shape is the system-bookkeeping carve-out.
    const row = db.prepare(
      "SELECT type, created_by, review_status FROM nodes WHERE id = 'hatstate:black'"
    ).get();
    ok(row, 'the HatState node should exist');
    equal(row.type, 'HatState', 'type should be HatState');
    equal(row.created_by, 'system', 'created_by should be system (carve-out)');
    equal(row.review_status, 'confirmed', 'review_status should be confirmed (carve-out)');
    // readHatState round-trips the structured object.
    const got = lensNodes.readHatState(db, 'black');
    equal(got.current_focus, 'CAR-T regulatory path', 'current_focus round-trips');
    deepEqual(got.top_concerns, ['IND timing', 'manufacturing scale'], 'top_concerns round-trips');
    deepEqual(got.top_opportunities, ['orphan designation'], 'top_opportunities round-trips');
    deepEqual(got.methodology_notes, ['black-hat surfaced FDA risk'], 'methodology_notes round-trips');
    equal(got.session_count, 3, 'session_count round-trips');
    equal(got.last_analysis, '2026-05-31', 'last_analysis round-trips');
  } finally {
    closeRoomDb(db); cleanup(tmp);
  }
}

function test6_writeHatStateRejectsNonCanonicalColor() {
  const { tmp, db } = makeRoom();
  try {
    const r = lensNodes.writeHatState(db, 'purple', { current_focus: 'x' });
    ok(!r.ok, 'a non-canonical color should be rejected');
    equal(r.reason, 'invalid_hat_color', 'reason should be invalid_hat_color');
  } finally {
    closeRoomDb(db); cleanup(tmp);
  }
}

function test7_readAllHatStatesDefaultsForUnwritten() {
  const { tmp, db } = makeRoom();
  try {
    lensNodes.writeHatState(db, 'white', { current_focus: 'facts gathered', session_count: 1 });
    const all = lensNodes.readAllHatStates(db);
    // Map of all 6 colors (defaults for the 5 unwritten ones).
    for (const c of HAT_COLORS) {
      ok(Object.prototype.hasOwnProperty.call(all, c), 'readAllHatStates must include color ' + c);
    }
    equal(all.white.current_focus, 'facts gathered', 'written color carries its state');
    equal(all.red.current_focus, 'General analysis', 'unwritten color carries the default focus');
    equal(all.red.last_analysis, 'never', 'unwritten color carries the default last_analysis');
    deepEqual(all.red.top_concerns, [], 'unwritten color carries an empty concerns array');
    equal(all.red.session_count, 0, 'unwritten color carries a zero session_count');
  } finally {
    closeRoomDb(db); cleanup(tmp);
  }
}

function test8_writeLensFinding() {
  const { tmp, db } = makeRoom();
  try {
    const r = lensNodes.writeLensFinding(db, {
      lensType: 'cognitive', lens: 'black-hat', topic: 'CAR-T',
      summary: 'FDA IND timing is the binding constraint', sessionId: 'sess-1',
    });
    ok(r.ok, 'writeLensFinding should return ok:true; got ' + JSON.stringify(r));
    const row = db.prepare(
      "SELECT type, created_by, review_status, properties FROM nodes WHERE id = ?"
    ).get(r.node_id);
    ok(row, 'the lens_finding node should exist');
    equal(row.type, 'lens_finding', 'type should be lens_finding');
    equal(row.created_by, 'system', 'created_by should be system');
    equal(row.review_status, 'proposed', 'review_status should be proposed');
    const props = JSON.parse(row.properties);
    equal(props.lens, 'black-hat', 'lens round-trips in properties');
    equal(props.topic, 'CAR-T', 'topic round-trips in properties');
    equal(props.summary, 'FDA IND timing is the binding constraint', 'summary round-trips');
    // It is the node the engine onAccept INFORMS edge points FROM: seed a target
    // and prove an INFORMS edge can originate from it.
    seedNode(db, 'node:financial-model');
    const e = edges.writeEdge(db, {
      source_id: r.node_id, target_id: 'node:financial-model',
      edge_type: 'INFORMS', properties: {},
    });
    ok(e.ok, 'an INFORMS edge should write FROM the lens_finding node');
  } finally {
    closeRoomDb(db); cleanup(tmp);
  }
}

function test9_lensNodesHasNoDirectSqliteRequire() {
  const src = fs.readFileSync(
    path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'lens-nodes.cjs'), 'utf8'
  );
  ok(!/require\(['"](?:node:sqlite|better-sqlite3)['"]\)/.test(src),
    'lens-nodes.cjs must NOT require node:sqlite or better-sqlite3 (caller owns the db handle)');
  // Zero em-dashes (CLAUDE.md HARD RULE; em-dash is U+2014).
  ok(!src.includes(String.fromCharCode(8212)), 'lens-nodes.cjs must contain zero em-dashes');
}

function test10_navigationReExportsLensNodeWriters() {
  for (const f of ['writeHatState', 'readHatState', 'readAllHatStates', 'writeLensFinding']) {
    equal(typeof navigation[f], 'function', 'navigation.cjs must re-export ' + f);
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const TESTS = [
  ['test1_lensEdgeTypesPresent', test1_lensEdgeTypesPresent],
  ['test2_informsEdgeWrites', test2_informsEdgeWrites],
  ['test3_rejectedBecauseEdgeWritesWithReasonScalar', test3_rejectedBecauseEdgeWritesWithReasonScalar],
  ['test4_rejectedLensTaxonomyStaysRejected', test4_rejectedLensTaxonomyStaysRejected],
  ['test5_writeHatStateRoundTrips', test5_writeHatStateRoundTrips],
  ['test6_writeHatStateRejectsNonCanonicalColor', test6_writeHatStateRejectsNonCanonicalColor],
  ['test7_readAllHatStatesDefaultsForUnwritten', test7_readAllHatStatesDefaultsForUnwritten],
  ['test8_writeLensFinding', test8_writeLensFinding],
  ['test9_lensNodesHasNoDirectSqliteRequire', test9_lensNodesHasNoDirectSqliteRequire],
  ['test10_navigationReExportsLensNodeWriters', test10_navigationReExportsLensNodeWriters],
];

let passed = 0;
let failed = 0;
for (const [name, fn] of TESTS) {
  try {
    fn();
    passed += 1;
    console.log('  PASS ' + name);
  } catch (err) {
    failed += 1;
    console.error('  FAIL ' + name + ': ' + (err && err.message ? err.message : err));
  }
}

console.log('');
console.log('Phase 130-01 lens substrate: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  process.exit(1);
}
