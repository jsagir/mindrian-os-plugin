'use strict';
// Phase 124-01: real empty-state test (was a 124-00 RED stub).
// Asserts: section with zero memory_event rows -> '*No timeline events yet.*' exact-equal;
//          section scoping enforced (other-section rows do NOT leak into target section).

const assert = require('node:assert/strict');
const path = require('node:path');

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_) {
  process.stdout.write('SKIP test-feynman-timeline-empty-state.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const renderer = require(path.resolve(__dirname, '..', 'lib', 'core', 'feynman', 'timeline-renderer.cjs'));

function applySchema(db) {
  db.exec("CREATE TABLE IF NOT EXISTS nodes (id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT, source_path TEXT, created_by TEXT, confidence REAL, review_status TEXT, created_at INTEGER, last_seen_at INTEGER);");
  db.exec("CREATE TABLE IF NOT EXISTS edges (source TEXT, target TEXT, type TEXT, properties TEXT);");
}

function seedMemoryEvent(db, idSuffix, sectionPath, eventType, createdAt) {
  const props = JSON.stringify({ event_type: eventType, target_node_id: 'decision:' + idSuffix, source_path: sectionPath, created_by: 'system' });
  db.prepare("INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) VALUES (?, 'memory_event', ?, ?, 'system', NULL, 'confirmed', ?, ?)")
    .run('memory_event:' + idSuffix, props, sectionPath, createdAt, createdAt);
}

function testEmptyDb() {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const out = renderer.renderTimeline(db, 'market-analysis', { now_ms: 1714694400000 });
  assert.equal(out.markdown_body, '*No timeline events yet.*', 'empty-state placeholder must be exact');
  assert.equal(out.summary_stats.total_events, 0);
  assert.equal(out.summary_stats.n_recent, 0);
  assert.equal(out.summary_stats.n_quiet, 0);
  assert.equal(out.summary_stats.n_stale, 0);
  assert.equal(out.summary_stats.n_dormant, 0);
  db.close();
}

function testOtherSectionsDoNotLeak() {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const NOW_MS = 1714694400000;
  seedMemoryEvent(db, '01', 'business-model', 'node_created', NOW_MS - 1000);
  seedMemoryEvent(db, '02', 'team',           'node_created', NOW_MS - 2000);
  seedMemoryEvent(db, '03', 'legal-ip',       'node_created', NOW_MS - 3000);
  const out = renderer.renderTimeline(db, 'market-analysis', { now_ms: NOW_MS });
  assert.equal(out.markdown_body, '*No timeline events yet.*', 'D-08 scoping: other-section rows must not leak');
  assert.equal(out.summary_stats.total_events, 0);
  db.close();
}

testEmptyDb();
testOtherSectionsDoNotLeak();
process.stdout.write('PASS test-feynman-timeline-empty-state.cjs (2 tests)\n');
process.exit(0);
