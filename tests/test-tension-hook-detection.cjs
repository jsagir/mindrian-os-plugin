/*
 * Phase 116-01 Wave 1 -- findSurfaceableTensions detection tests.
 *
 * Real assertions (was Wave-0 stub) for AC-1: navigation reads CONTRADICTS /
 * CONVERGES edges via the Phase 109 chokepoint, joins JSONL state, returns
 * deterministic-id candidates filtered per CONTEXT D-03b.
 *
 * Each test builds a fresh in-memory schema (mirrors lazygraph-ops + Phase
 * 109 nodes-provenance migration columns) so the tests are hermetic. Each
 * test uses a per-test temp roomSlug and cleans up the JSONL in finally.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const navigation = require('../lib/core/navigation.cjs');
const insights = require('../lib/core/navigation/insights.cjs');
const store = require('../lib/memory/pending-tension-store.cjs');

// EVENT_TYPES regression checks (preserves the 116-00 substrate guarantees
// that Wave 0 set up; these need to keep passing as the detection module ships).
const { EVENT_TYPES } = require('../lib/core/navigation/memory-events.cjs');

// ---------- Test fixture helpers ----------

function makeDb() {
  const db = new DatabaseSync(':memory:');
  // Mirror lazygraph-ops + phase-109 schema (the columns insights.cjs reads).
  db.exec(`
    CREATE TABLE nodes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      properties TEXT DEFAULT '{}',
      source_path TEXT,
      created_by TEXT,
      confidence REAL,
      review_status TEXT DEFAULT 'proposed',
      created_at INTEGER,
      last_seen_at INTEGER
    );
    CREATE TABLE edges (
      source TEXT NOT NULL,
      target TEXT NOT NULL,
      type TEXT NOT NULL,
      properties TEXT DEFAULT '{}',
      PRIMARY KEY (source, target, type)
    );
  `);
  return db;
}

function insertNode(db, id, sourcePath) {
  const now = Date.now();
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
    "VALUES (?, 'claim', '{}', ?, 'system', 'confirmed', ?, ?)"
  ).run(id, sourcePath || ('section-' + id), now, now);
}

function insertEdge(db, source, target, type, createdAtMs) {
  const props = JSON.stringify({ created_at: createdAtMs });
  db.prepare("INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)")
    .run(source, target, type, props);
}

function freshSlug(label) {
  const rand = crypto.randomBytes(4).toString('hex');
  return 'phase-116-detect-' + label + '-' + Date.now() + '-' + rand;
}

function cleanupSlug(slug) {
  try {
    const p = store.jsonlPath(slug);
    if (fs.existsSync(p)) fs.rmSync(p, { force: true });
  } catch (_e) { /* swallow */ }
}

// ---------- Tests ----------

test('116-01 detection: empty graph returns []', () => {
  const slug = freshSlug('empty');
  const db = makeDb();
  try {
    const r = navigation.findSurfaceableTensions(db, 'room-id', { roomSlug: slug, limit: 10 });
    assert.deepEqual(r, []);
  } finally {
    cleanupSlug(slug);
    db.close();
  }
});

test('116-01 detection: missing roomSlug returns []', () => {
  const db = makeDb();
  try {
    const r = navigation.findSurfaceableTensions(db, 'room-id', { limit: 10 });
    assert.deepEqual(r, []);
  } finally {
    db.close();
  }
});

test('116-01 detection: one CONTRADICTS edge yields one candidate', () => {
  const slug = freshSlug('one');
  const db = makeDb();
  try {
    insertNode(db, 'node-a', 'problem-definition');
    insertNode(db, 'node-b', 'solution-design');
    insertEdge(db, 'node-a', 'node-b', 'CONTRADICTS', 1715000000000);
    const r = navigation.findSurfaceableTensions(db, 'room-id', { roomSlug: slug, limit: 10 });
    assert.equal(r.length, 1);
    assert.equal(r[0].tension_type, 'contradiction');
    assert.equal(r[0].source_node_id, 'node-a');
    assert.equal(r[0].target_node_id, 'node-b');
    // Deterministic tension_id matches store.computeTensionId.
    assert.equal(r[0].tension_id, store.computeTensionId('node-a', 'node-b', 'contradiction'));
    assert.match(r[0].tension_id, /^[0-9a-f]{32}$/);
  } finally {
    cleanupSlug(slug);
    db.close();
  }
});

test('116-01 detection: priority ordering (CONTRADICTS DESC by created_at; CONVERGES is fallback only)', () => {
  const slug = freshSlug('priority');
  const db = makeDb();
  try {
    insertNode(db, 'n1', 's1');
    insertNode(db, 'n2', 's2');
    insertNode(db, 'n3', 's3');
    insertNode(db, 'n4', 's4');
    insertNode(db, 'n5', 's5');
    insertNode(db, 'n6', 's6');
    insertEdge(db, 'n1', 'n2', 'CONTRADICTS', 1000); // older
    insertEdge(db, 'n3', 'n4', 'CONTRADICTS', 2000); // newer
    insertEdge(db, 'n5', 'n6', 'CONVERGES',   3000); // newest BUT lower priority
    const r = navigation.findSurfaceableTensions(db, 'room-id', { roomSlug: slug, limit: 10 });
    // D-03b: CONTRADICTS first (DESC by created_at). CONVERGES is the
    // FALLBACK; it only fires when CONTRADICTS yields nothing. So with two
    // CONTRADICTS rows present, CONVERGES is skipped this call.
    assert.equal(r.length, 2);
    assert.equal(r[0].tension_type, 'contradiction');
    assert.equal(r[1].tension_type, 'contradiction');
    // Newer CONTRADICTS first.
    assert.equal(r[0].source_node_id, 'n3');
    assert.equal(r[1].source_node_id, 'n1');
  } finally {
    cleanupSlug(slug);
    db.close();
  }
});

test('116-01 detection: surfacing_count >= 3 excluded (D-03b filter)', () => {
  const slug = freshSlug('three-strikes');
  const db = makeDb();
  try {
    insertNode(db, 'fa', 'sec-a');
    insertNode(db, 'fb', 'sec-b');
    insertEdge(db, 'fa', 'fb', 'CONTRADICTS', 5000);
    const tid = store.computeTensionId('fa', 'fb', 'contradiction');
    store.appendTension(slug, {
      tension_id: tid,
      type: 'contradiction',
      source_edge_ids: ['1'],
      source_node_ids: ['fa', 'fb'],
      created_at: 5000,
      state: 'queued',
      surfacing_count: 3,
      last_surfaced_at: 1000,
      last_response: null,
      context_signature: { source_section: 'sec-a', target_section: 'sec-b', tension_kind_label: 'contradiction' },
    });
    const r = navigation.findSurfaceableTensions(db, 'room-id', { roomSlug: slug, limit: 10 });
    assert.deepEqual(r, []);
  } finally {
    cleanupSlug(slug);
    db.close();
  }
});

test('116-01 detection: state=resolved excluded (D-03b filter)', () => {
  const slug = freshSlug('resolved-filter');
  const db = makeDb();
  try {
    insertNode(db, 'ra', 'sec-a');
    insertNode(db, 'rb', 'sec-b');
    insertEdge(db, 'ra', 'rb', 'CONTRADICTS', 5000);
    const tid = store.computeTensionId('ra', 'rb', 'contradiction');
    store.appendTension(slug, {
      tension_id: tid,
      type: 'contradiction',
      source_edge_ids: ['1'],
      source_node_ids: ['ra', 'rb'],
      created_at: 5000,
      state: 'resolved',
      surfacing_count: 1,
      last_surfaced_at: 1000,
      last_response: 'RESOLVE',
      context_signature: { source_section: 'sec-a', target_section: 'sec-b', tension_kind_label: 'contradiction' },
    });
    const r = navigation.findSurfaceableTensions(db, 'room-id', { roomSlug: slug, limit: 10 });
    assert.deepEqual(r, []);
  } finally {
    cleanupSlug(slug);
    db.close();
  }
});

test('116-01 detection: state=queued surfacing_count<3 still surfaceable', () => {
  const slug = freshSlug('still-surfaceable');
  const db = makeDb();
  try {
    insertNode(db, 'qa', 'sec-a');
    insertNode(db, 'qb', 'sec-b');
    insertEdge(db, 'qa', 'qb', 'CONTRADICTS', 5000);
    const tid = store.computeTensionId('qa', 'qb', 'contradiction');
    store.appendTension(slug, {
      tension_id: tid,
      type: 'contradiction',
      source_edge_ids: ['1'],
      source_node_ids: ['qa', 'qb'],
      created_at: 5000,
      state: 'queued',
      surfacing_count: 2,
      last_surfaced_at: 1000,
      last_response: null,
      context_signature: { source_section: 'sec-a', target_section: 'sec-b', tension_kind_label: 'contradiction' },
    });
    const r = navigation.findSurfaceableTensions(db, 'room-id', { roomSlug: slug, limit: 10 });
    assert.equal(r.length, 1);
    assert.equal(r[0].tension_id, tid);
  } finally {
    cleanupSlug(slug);
    db.close();
  }
});

test('116-01 detection: includeConvergence=false skips CONVERGES even when CONTRADICTS empty', () => {
  const slug = freshSlug('no-convergence');
  const db = makeDb();
  try {
    insertNode(db, 'cn1', 'sec-1');
    insertNode(db, 'cn2', 'sec-2');
    insertEdge(db, 'cn1', 'cn2', 'CONVERGES', 7000);
    const r = navigation.findSurfaceableTensions(db, 'room-id', {
      roomSlug: slug,
      limit: 10,
      includeConvergence: false,
    });
    assert.deepEqual(r, []);
  } finally {
    cleanupSlug(slug);
    db.close();
  }
});

test('116-01 detection: candidates carry source_section + target_section from nodes table', () => {
  const slug = freshSlug('sections');
  const db = makeDb();
  try {
    insertNode(db, 'sec-a-node', 'problem-definition/claim-1.md');
    insertNode(db, 'sec-b-node', 'solution-design/claim-2.md');
    insertEdge(db, 'sec-a-node', 'sec-b-node', 'CONTRADICTS', 8000);
    const r = navigation.findSurfaceableTensions(db, 'room-id', { roomSlug: slug, limit: 10 });
    assert.equal(r.length, 1);
    assert.equal(r[0].source_section, 'problem-definition/claim-1.md');
    assert.equal(r[0].target_section, 'solution-design/claim-2.md');
  } finally {
    cleanupSlug(slug);
    db.close();
  }
});

test('116-01 detection: navigation.cjs re-exports findSurfaceableTensions on the closed surface', () => {
  assert.equal(typeof navigation.findSurfaceableTensions, 'function');
  assert.equal(navigation.findSurfaceableTensions, insights.findSurfaceableTensions);
});

test('116-01 detection: existing 6 navigation functions still exported (no Phase 109 regression)', () => {
  const required = [
    'findContradictions', 'findStaleDecisions', 'findOpenQuestions',
    'findRecentChanges', 'getActiveFocus', 'getNeighborhood',
  ];
  for (const k of required) {
    assert.equal(typeof navigation[k], 'function', 'regression: navigation.' + k + ' missing');
  }
});

test('116-01 detection: function does not throw on a malformed db (defensive)', () => {
  // Pass a non-DB object; the SELECT inside should fall through and return [].
  const slug = freshSlug('malformed');
  try {
    const fakeDb = { prepare() { throw new Error('boom'); } };
    const r = navigation.findSurfaceableTensions(fakeDb, 'room-id', { roomSlug: slug, limit: 10 });
    assert.deepEqual(r, []);
  } finally {
    cleanupSlug(slug);
  }
});

test('116-00 substrate (regression): EVENT_TYPES.has tension_detected', () => {
  assert.equal(EVENT_TYPES.has('tension_detected'), true);
});

test('116-00 substrate (regression): EVENT_TYPES.size is 26', () => {
  assert.equal(EVENT_TYPES.size, 26);
});
