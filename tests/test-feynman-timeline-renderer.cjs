'use strict';
// Phase 124-01: real renderer unit test (was a 124-00 RED stub).
// Fixture: in-memory sqlite db; hand-seeded memory_event rows across the 4 D-06 buckets.
// Asserts: D-05 template body + summary_stats + D-08 section scoping + env-override
// thresholds + stability + no em-dashes / en-dashes.

const assert = require('node:assert/strict');
const path = require('node:path');

// Require node:sqlite (Node 22+ has it built-in). Skip with exit 77 if unavailable.
let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_) {
  process.stdout.write('SKIP test-feynman-timeline-renderer.cjs (node:sqlite unavailable; need Node 22+)\n');
  process.exit(77);
}

const renderer = require(path.resolve(__dirname, '..', 'lib', 'core', 'feynman', 'timeline-renderer.cjs'));

// ---------- Fixture helpers ----------

function applySchema(db) {
  db.exec("CREATE TABLE IF NOT EXISTS nodes (id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT, source_path TEXT, created_by TEXT, confidence REAL, review_status TEXT, created_at INTEGER, last_seen_at INTEGER);");
  db.exec("CREATE TABLE IF NOT EXISTS edges (source TEXT, target TEXT, type TEXT, properties TEXT);");
}

function seedMemoryEvent(db, idSuffix, sectionPath, eventType, createdAt) {
  const props = JSON.stringify({ event_type: eventType, target_node_id: 'decision:' + idSuffix, source_path: sectionPath, created_by: 'system' });
  db.prepare("INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) VALUES (?, 'memory_event', ?, ?, 'system', NULL, 'confirmed', ?, ?)")
    .run('memory_event:' + idSuffix, props, sectionPath, createdAt, createdAt);
}

// ---------- Tests ----------

function testFourBucket() {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const NOW_MS = 1714694400000; // 2026-05-03T00:00:00Z (deterministic)
  const D = 24 * 60 * 60 * 1000;
  seedMemoryEvent(db, '01', 'market-analysis', 'node_created',     NOW_MS - 1   * D); // recent
  seedMemoryEvent(db, '02', 'market-analysis', 'status_promoted',  NOW_MS - 14  * D); // quiet (7..30)
  seedMemoryEvent(db, '03', 'market-analysis', 'focus_changed',    NOW_MS - 60  * D); // stale (30..90)
  seedMemoryEvent(db, '04', 'market-analysis', 'brain_query_sent', NOW_MS - 200 * D); // dormant (>90)

  const out = renderer.renderTimeline(db, 'market-analysis', { now_ms: NOW_MS });
  assert.equal(out.summary_stats.total_events, 4, 'total_events should be 4');
  assert.equal(out.summary_stats.n_recent,  1, 'n_recent should be 1');
  assert.equal(out.summary_stats.n_quiet,   1, 'n_quiet should be 1');
  assert.equal(out.summary_stats.n_stale,   1, 'n_stale should be 1');
  assert.equal(out.summary_stats.n_dormant, 1, 'n_dormant should be 1');
  assert.match(out.markdown_body, /\*Last refreshed:/, 'summary line missing');
  assert.match(out.markdown_body, /\*\*Recent events\*\*/, 'Recent header missing');
  assert.match(out.markdown_body, /\*\*Flagged stale\*\*/, 'Stale header missing');
  assert.match(out.markdown_body, /\*\*Health:\*\* recent=1 \/ quiet=1 \/ stale=1 \/ dormant=1\./, 'Health line wrong');
  db.close();
}

function testEnvOverride() {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const NOW_MS = 1714694400000;
  seedMemoryEvent(db, '01', 'market-analysis', 'node_created', NOW_MS - 500);   // < 1s recent
  seedMemoryEvent(db, '02', 'market-analysis', 'node_created', NOW_MS - 2000);  // 1..5s quiet
  seedMemoryEvent(db, '03', 'market-analysis', 'node_created', NOW_MS - 7000);  // 5..10s stale
  seedMemoryEvent(db, '04', 'market-analysis', 'node_created', NOW_MS - 20000); // >10s dormant
  const saved = process.env.MINDRIAN_TIMELINE_THRESHOLDS_JSON;
  process.env.MINDRIAN_TIMELINE_THRESHOLDS_JSON = JSON.stringify({ recent_ms: 1000, quiet_ms: 5000, stale_ms: 10000 });
  try {
    const out = renderer.renderTimeline(db, 'market-analysis', { now_ms: NOW_MS });
    assert.equal(out.summary_stats.n_recent,  1, 'env-override n_recent should be 1');
    assert.equal(out.summary_stats.n_quiet,   1, 'env-override n_quiet should be 1');
    assert.equal(out.summary_stats.n_stale,   1, 'env-override n_stale should be 1');
    assert.equal(out.summary_stats.n_dormant, 1, 'env-override n_dormant should be 1');
  } finally {
    if (saved === undefined) delete process.env.MINDRIAN_TIMELINE_THRESHOLDS_JSON;
    else process.env.MINDRIAN_TIMELINE_THRESHOLDS_JSON = saved;
  }
  db.close();
}

function testStableOutput() {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const NOW_MS = 1714694400000;
  seedMemoryEvent(db, '01', 'market-analysis', 'node_created', NOW_MS - 1000);
  const out1 = renderer.renderTimeline(db, 'market-analysis', { now_ms: NOW_MS });
  const out2 = renderer.renderTimeline(db, 'market-analysis', { now_ms: NOW_MS });
  assert.equal(out1.markdown_body, out2.markdown_body, 'renderer must be deterministic (idempotent for Plan 124-02)');
  db.close();
}

function testSubRoomScoping() {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const NOW_MS = 1714694400000;
  seedMemoryEvent(db, '01', 'market-analysis',       'node_created', NOW_MS - 1000);
  seedMemoryEvent(db, '02', 'market-analysis/sub-a', 'node_created', NOW_MS - 2000);
  seedMemoryEvent(db, '03', 'business-model',        'node_created', NOW_MS - 3000);
  const market = renderer.renderTimeline(db, 'market-analysis', { now_ms: NOW_MS });
  assert.equal(market.summary_stats.total_events, 2, 'sub-room rows must be included in parent section scope');
  const biz = renderer.renderTimeline(db, 'business-model', { now_ms: NOW_MS });
  assert.equal(biz.summary_stats.total_events, 1, 'business-model section must NOT pick up market-analysis rows');
  db.close();
}

function testNoEmDashes() {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const NOW_MS = 1714694400000;
  seedMemoryEvent(db, '01', 'market-analysis', 'node_created', NOW_MS - 1000);
  const out = renderer.renderTimeline(db, 'market-analysis', { now_ms: NOW_MS });
  const EM_DASH = String.fromCharCode(0x2014);
  const EN_DASH = String.fromCharCode(0x2013);
  assert.equal(out.markdown_body.indexOf(EM_DASH), -1, 'renderer output must contain no em-dashes (U+2014)');
  assert.equal(out.markdown_body.indexOf(EN_DASH), -1, 'renderer output must contain no en-dashes (U+2013)');
  db.close();
}

testFourBucket();
testEnvOverride();
testStableOutput();
testSubRoomScoping();
testNoEmDashes();
process.stdout.write('PASS test-feynman-timeline-renderer.cjs (5 tests)\n');
process.exit(0);
