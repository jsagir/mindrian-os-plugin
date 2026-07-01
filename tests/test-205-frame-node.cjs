'use strict';
// Phase 205-02 -- Frame node (FUSION substrate) + SHARES_JOB / ELEVATES_TO edges
// test suite (decision D-Q5 / 205-CONTEXT.md graph-readiness gap-1 + gap-2).
//
// WAVE 1 SUBSTRATE. typed-frame.cjs mints a first-class `frame` node in room.db
// that records WHICH section nodes / topics compose each live frame (D-Q5, a
// navigator OVERRIDE of the "derive, do not mint" lean), and edges.cjs grows the
// frozen writeEdge allow-list ADDITIVELY with the two cross-frame edges the
// horizontal-elevation move needs: SHARES_JOB (two frames share the same JTBD
// job) + ELEVATES_TO (a frame elevates to the containing system).
//
// Canon Part 9: the frame writer is surfaced ONLY through the single
//   navigation.cjs chokepoint (no second write path); a truth-claim frame lands
//   review_status 'proposed' and is never auto-confirmed, while a pure-bookkeeping
//   frame (taxonomy:true) may carry 'confirmed' via the Part 9 v1.5 audit-node
//   carve-out spirit (composition bookkeeping asserts no venture truth).
// Canon Part 8: zero network surface; pure LOCAL SQLite over a caller-owned
//   handle; membership carries GENERIC HANDLES ONLY (node ids / topic enums /
//   hashes), never prose, so a future projection cannot breach the Brain boundary.
//   typed-frame.cjs carries zero direct require of room-db.cjs / lazygraph-ops.cjs
//   / node:sqlite (chokepoint-only; behavior grep-scans for the bypass).
//
// The edge additions are proven ADDITIVE with a FLOOR (never .size): every pre-205
// edge type must still be present AND the two new members must be present, mirroring
// the test-edges-part4-cascade-floor.cjs floor idiom.
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE). node:sqlite builds an in-memory
// migrated-nodes-schema db plus an edges table so there is no SKIP path.

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const typedFramePath = path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'typed-frame.cjs');
const {
  writeFrameNode, FRAME_NODE_TYPES, FRAME_NODE_ID,
} = require(typedFramePath);
const {
  ALLOWED_EDGE_TYPES, writeEdge,
} = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'edges.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

let pass = 0;
let total = 0;
function check(label, fn) {
  total += 1;
  fn();
  pass += 1;
  console.log('  ok -', label);
}

// In-memory db with the Phase-109-migrated nodes schema (the wide NOT-NULL + CHECK
// shape) plus the edges table so writeEdge round-trips. No SKIP path.
function freshDb() {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(
    'CREATE TABLE nodes (' +
    '  id TEXT PRIMARY KEY, ' +
    '  type TEXT NOT NULL, ' +
    "  properties TEXT DEFAULT '{}', " +
    '  source_path TEXT NOT NULL, ' +
    "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
    '  confidence REAL, ' +
    "  review_status TEXT NOT NULL DEFAULT 'proposed' " +
    "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated')), " +
    '  created_at INTEGER NOT NULL, ' +
    '  last_seen_at INTEGER NOT NULL, ' +
    '  source_section TEXT, ' +
    '  confirmed_by TEXT, ' +
    '  confirmed_at INTEGER' +
    ')'
  );
  db.exec(
    "CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, " +
    "properties TEXT DEFAULT '{}', PRIMARY KEY(source, target, type));"
  );
  return db;
}

console.log('test-205-frame-node');

// ---------------------------------------------------------------------------
// Task 1: writeFrameNode (the D-Q5 Frame node)
// ---------------------------------------------------------------------------

// Test 1: the module surface is present (writeFrameNode function + FRAME_NODE_ID).
check('Test 1 -- typed-frame exports writeFrameNode + FRAME_NODE_ID', () => {
  assert.equal(typeof writeFrameNode, 'function', 'writeFrameNode is a function');
  assert.equal(typeof FRAME_NODE_ID, 'function', 'FRAME_NODE_ID is a function');
  assert.ok(FRAME_NODE_ID('s1', 'k1').length > 0, 'FRAME_NODE_ID mints a non-empty id');
});

// Test 2: a frame node mints with type 'frame', lands 'proposed', and its
//         membership set of GENERIC node-id handles reads back.
check('Test 2 -- writeFrameNode mints a proposed frame node with membership', () => {
  const db = freshDb();
  const members = ['section:financial-model', 'section:go-to-market', 'topic:pricing'];
  const r = writeFrameNode(db, { frameKey: 'open-frames-a', sessionId: 's1', members });
  assert.equal(r.ok, true, `expected ok:true, got ${JSON.stringify(r)}`);
  assert.ok(typeof r.node_id === 'string' && r.node_id.length > 0, 'node_id present');
  assert.deepEqual(r.members, members, 'members echo back on the result');
  const row = db.prepare('SELECT type, review_status, properties FROM nodes WHERE id = ?').get(r.node_id);
  assert.ok(row, 'the frame node must be queryable');
  assert.equal(row.type, 'frame', "type must be 'frame'");
  assert.equal(row.review_status, 'proposed', "a truth-claim frame lands 'proposed'");
  const props = JSON.parse(row.properties);
  assert.deepEqual(props.members, members, 'membership set of node ids round-trips');
  db.close();
});

// Test 3: re-writing the same (frameKey, sessionId) UPSERTs (idempotent id), no dup.
check('Test 3 -- writeFrameNode UPSERTs idempotently (no duplicate row)', () => {
  const db = freshDb();
  const r1 = writeFrameNode(db, { frameKey: 'f-1', sessionId: 's1', members: ['section:a'] });
  const r2 = writeFrameNode(db, { frameKey: 'f-1', sessionId: 's1', members: ['section:a', 'section:b'] });
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.equal(r1.node_id, r2.node_id, 'same (frameKey, sessionId) yields the same idempotent id');
  const cnt = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'frame'").get();
  assert.equal(cnt.n, 1, 're-write UPSERTs, never duplicates');
  db.close();
});

// Test 4: an invalid frameKey is rejected (defensive, never a throw); membership
//         input is deduped and prose-free coercion drops non-string handles.
check('Test 4 -- invalid frameKey rejected; membership deduped and coerced', () => {
  const db = freshDb();
  const bad = writeFrameNode(db, { sessionId: 's1' });
  assert.equal(bad.ok, false, 'a missing frameKey must be rejected');
  assert.equal(bad.reason, 'invalid_frame_key', 'reason names the frame-key gate');
  const r = writeFrameNode(db, {
    frameKey: 'f-dedup', sessionId: 's1',
    members: ['section:a', 'section:a', '', 42, 'topic:x'],
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.members, ['section:a', 'topic:x'], 'dupes / empty / non-string handles dropped');
  db.close();
});

// Test 5: a pure-bookkeeping frame (taxonomy:true) is system-confirmed via the
//         Part 9 v1.5 carve-out; a plain frame stays 'proposed'.
check('Test 5 -- taxonomy:true frame is confirmed; plain frame stays proposed', () => {
  const db = freshDb();
  const taxo = writeFrameNode(db, { frameKey: 'book', sessionId: 's1', members: ['section:a'], taxonomy: true });
  const plain = writeFrameNode(db, { frameKey: 'claimish', sessionId: 's1', members: ['section:b'] });
  assert.equal(taxo.ok, true);
  assert.equal(plain.ok, true);
  const taxoRow = db.prepare('SELECT review_status, created_by FROM nodes WHERE id = ?').get(taxo.node_id);
  const plainRow = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(plain.node_id);
  assert.equal(taxoRow.review_status, 'confirmed', 'pure-bookkeeping frame is system-confirmed');
  assert.equal(taxoRow.created_by, 'system', 'frame node created_by system');
  assert.equal(plainRow.review_status, 'proposed', 'a plain frame stays proposed (never auto-confirmed)');
  db.close();
});

// Test 6: the frame node type is a frozen additive Set anchoring 'frame'.
check("Test 6 -- FRAME_NODE_TYPES is a frozen Set {frame}", () => {
  assert.equal(FRAME_NODE_TYPES instanceof Set, true);
  assert.equal(Object.isFrozen(FRAME_NODE_TYPES), true);
  assert.equal(FRAME_NODE_TYPES.has('frame'), true);
});

// Test 7: navigation.cjs surfaces writeFrameNode through the single chokepoint;
//         a frame written via the chokepoint reads back with type 'frame'.
check('Test 7 -- navigation.cjs re-exports writeFrameNode (single chokepoint)', () => {
  assert.equal(typeof navigation.writeFrameNode, 'function', 'writeFrameNode re-exported');
  const db = freshDb();
  const r = navigation.writeFrameNode(db, { frameKey: 'via-chokepoint', sessionId: 's1', members: ['section:a'] });
  assert.equal(r.ok, true, `chokepoint write ok, got ${JSON.stringify(r)}`);
  const row = db.prepare('SELECT type FROM nodes WHERE id = ?').get(r.node_id);
  assert.equal(row.type, 'frame', "chokepoint-written node is type 'frame'");
  db.close();
});

// Test 8: typed-frame.cjs has zero direct require of room-db.cjs / lazygraph-ops.cjs
//         / node:sqlite (Part 8 chokepoint-only, no substrate bypass, no network).
check('Test 8 -- typed-frame.cjs carries no forbidden substrate or network require', () => {
  const src = fs.readFileSync(typedFramePath, 'utf8');
  assert.equal(/require\(['"][^'"]*room-db\.cjs['"]\)/.test(src), false, 'no room-db.cjs require');
  assert.equal(/require\(['"][^'"]*lazygraph-ops\.cjs['"]\)/.test(src), false, 'no lazygraph-ops.cjs require');
  assert.equal(/require\(['"]node:sqlite['"]\)/.test(src), false, 'no node:sqlite require');
  assert.equal(/require\(['"](node:)?https?['"]\)/.test(src), false, 'no http/https require');
  assert.equal(/\bfetch\s*\(/.test(src), false, 'no fetch call (Part 8 zero network)');
});

// ---------------------------------------------------------------------------
// Task 2: SHARES_JOB / ELEVATES_TO additive edges + drift floor
// ---------------------------------------------------------------------------

// Test 9: the two new cross-frame edges are present in the frozen allow-list.
check('Test 9 -- SHARES_JOB + ELEVATES_TO are in ALLOWED_EDGE_TYPES', () => {
  assert.equal(ALLOWED_EDGE_TYPES.has('SHARES_JOB'), true, 'missing SHARES_JOB');
  assert.equal(ALLOWED_EDGE_TYPES.has('ELEVATES_TO'), true, 'missing ELEVATES_TO');
});

// Test 10: additive-only FLOOR -- every pre-205 edge type is STILL present. This is
//          the additive-only proof (never asserts .size). If a future edit removes
//          any prior member this fails.
const PRE_205_FLOOR = [
  'DEFERRED', 'REJECTED', 'DERIVED_FROM', 'FILED_AS_DECISION', 'FOLLOWS_FROM',
  'OPERATOR_TRANSITION', 'INFORMS', 'REJECTED_BECAUSE', 'CONTRADICTS', 'SUPERSEDES',
  'AFFILIATED_WITH', 'PIVOTED', 'SELECTED_REACH', 'FEEDS_INTO', 'VALIDATES',
  'STATES', 'SUPPORTS', 'DESCRIBES', 'REFINES', 'ROOT_CAUSES', 'INSTANTIATES',
  'DECOMPOSED_INTO', 'PART_OF', 'TAGGED_WITH', 'RELATED_TO',
  'CONVERGES', 'INVALIDATES', 'ENABLES', 'NESTED_WITHIN',
];
check('Test 10 -- every pre-205 edge type preserved (additive-only)', () => {
  for (const t of PRE_205_FLOOR) {
    assert.equal(ALLOWED_EDGE_TYPES.has(t), true, `pre-205 member ${t} must survive additive growth`);
  }
  assert.equal(ALLOWED_EDGE_TYPES instanceof Set, true, 'still a Set instance');
  assert.equal(Object.isFrozen(ALLOWED_EDGE_TYPES), true, 'still frozen');
});

// Test 11: writeEdge accepts a SHARES_JOB cross-frame edge; enum/scalar props
//          round-trip (Part 8 enum/scalar-only, never prose).
check('Test 11 -- writeEdge accepts SHARES_JOB (frame -> frame) + props round-trip', () => {
  const db = freshDb();
  const sid = 's1';
  const fa = FRAME_NODE_ID(sid, 'frame-a');
  const fb = FRAME_NODE_ID(sid, 'frame-b');
  const r = writeEdge(db, {
    source_id: fa,
    target_id: fb,
    edge_type: 'SHARES_JOB',
    properties: { job: 'reduce-time-to-diagnosis', confidence: 0.82 },
  });
  assert.equal(r.ok, true, `expected ok:true, got ${JSON.stringify(r)}`);
  assert.equal(r.type, 'SHARES_JOB');
  const row = db.prepare(
    "SELECT properties FROM edges WHERE source = ? AND target = ? AND type = 'SHARES_JOB'"
  ).get(fa, fb);
  assert.ok(row, 'the SHARES_JOB edge must be queryable');
  const props = JSON.parse(row.properties);
  assert.equal(props.job, 'reduce-time-to-diagnosis', 'job enum handle round-trips');
  assert.equal(props.confidence, 0.82, 'confidence scalar round-trips');
  db.close();
});

// Test 12: writeEdge accepts an ELEVATES_TO frame-to-containing-system edge.
check('Test 12 -- writeEdge accepts ELEVATES_TO (frame -> containing system)', () => {
  const db = freshDb();
  const frame = FRAME_NODE_ID('s1', 'frame-a');
  const r = writeEdge(db, {
    source_id: frame,
    target_id: 'domain:containing-system',
    edge_type: 'ELEVATES_TO',
    properties: { relation: 'elevates' },
  });
  assert.equal(r.ok, true, `expected ELEVATES_TO ok:true, got ${JSON.stringify(r)}`);
  db.close();
});

// Test 13: the chokepoint guard holds -- a made-up edge type is still rejected.
check('Test 13 -- writeEdge rejects an unknown edge type (guard holds)', () => {
  const db = freshDb();
  const r = writeEdge(db, {
    source_id: 'frame:x', target_id: 'frame:y',
    edge_type: 'NOT_A_REAL_FRAME_EDGE', properties: {},
  });
  assert.equal(r.ok, false, 'a made-up edge type must be rejected');
  assert.equal(r.reason, 'invalid_edge_type', 'rejection reason names the allow-list gate');
  db.close();
});

console.log(`\nPASS (${pass}/${total})`);
