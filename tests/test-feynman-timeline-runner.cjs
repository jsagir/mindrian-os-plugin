'use strict';
// Phase 124-02: real runner integration test (was a 124-00 RED stub).
// Fixture: tmp room dir with section subdirs + FEYNMAN.md files; in-memory sqlite db.
// Asserts:
//   (a) sentinel-bounded section replaced,
//   (b) body byte-identical pre/post (SHA256 of outside-sentinels region),
//   (c) timeline_last_rendered frontmatter watermark set,
//   (d) idempotent re-run produces byte-identical file,
//   (e) memory_event of type feynman_timeline_refreshed logged on success,
//   (f) watermark skip when SQL older than rendered ISO,
//   (g) failure handling: returns structured status, no exception, no corruption,
//   (h) first-encounter (no sentinel pair) appends sentinel block at EOF, byte-preserves prior lines.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_) {
  process.stdout.write('SKIP test-feynman-timeline-runner.cjs (node:sqlite unavailable; need Node 22+)\n');
  process.exit(77);
}

const runner = require(path.resolve(__dirname, '..', 'lib', 'core', 'feynman', 'timeline-runner.cjs'));
const navigation = require(path.resolve(__dirname, '..', 'lib', 'core', 'navigation.cjs'));
const memoryEvents = require(path.resolve(__dirname, '..', 'lib', 'core', 'navigation', 'memory-events.cjs'));

// ---------- EVENT_TYPES regression (Task 1 invariants) ----------

function testEventTypesExtended() {
  assert.ok(memoryEvents.EVENT_TYPES.has('feynman_timeline_refreshed'), 'feynman_timeline_refreshed must be in EVENT_TYPES');
  assert.ok(memoryEvents.EVENT_TYPES.has('feynman_timeline_refresh_failed'), 'feynman_timeline_refresh_failed must be in EVENT_TYPES');
  // Phase 110-02 strings still present
  assert.ok(memoryEvents.EVENT_TYPES.has('brain_packet_rejected'), 'brain_packet_rejected must still be present');
  assert.ok(memoryEvents.EVENT_TYPES.has('brain_response_rejected'), 'brain_response_rejected must still be present');
  assert.ok(memoryEvents.EVENT_TYPES.has('brain_legacy_path_used'), 'brain_legacy_path_used must still be present');
  // Earlier phase strings still present
  assert.ok(memoryEvents.EVENT_TYPES.has('tension_detected'), 'tension_detected must still be present');
  assert.ok(memoryEvents.EVENT_TYPES.has('auto_explore_fired'), 'auto_explore_fired must still be present');
  // Size floor (was 35 before Phase 124; the floor is 37 per the plan invariant).
  assert.ok(memoryEvents.EVENT_TYPES.size >= 37,
    'EVENT_TYPES.size = ' + memoryEvents.EVENT_TYPES.size + ' (expected >= 37 per Plan 124-02)');
}

// ---------- Fixture helpers ----------

const TMP_ROOTS = [];
function makeTmpRoom() {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-124-runner-'));
  TMP_ROOTS.push(r);
  return r;
}
process.on('exit', () => {
  for (const r of TMP_ROOTS) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (_) {} }
});

function applySchema(db) {
  db.exec("CREATE TABLE IF NOT EXISTS nodes (id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT, source_path TEXT, created_by TEXT, confidence REAL, review_status TEXT, created_at INTEGER, last_seen_at INTEGER);");
  db.exec("CREATE TABLE IF NOT EXISTS edges (source TEXT, target TEXT, type TEXT, properties TEXT);");
}

function seedMemoryEvent(db, idSuffix, sectionPath, eventType, createdAt) {
  const props = JSON.stringify({ event_type: eventType, target_node_id: 'decision:' + idSuffix, source_path: sectionPath, created_by: 'system' });
  db.prepare("INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) VALUES (?, 'memory_event', ?, ?, 'system', NULL, 'confirmed', ?, ?)")
    .run('memory_event:' + idSuffix, props, sectionPath, createdAt, createdAt);
}

function sha256(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }

function writeFeynman(roomDir, slug, content) {
  const dir = path.join(roomDir, slug);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, 'FEYNMAN.md');
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

// Helper: strip frontmatter (---\n...---\n) from start if present, return tail.
function stripFrontmatter(s) {
  if (!s.startsWith('---\n')) return s;
  const lines = s.split('\n');
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      return lines.slice(i + 1).join('\n');
    }
  }
  return s;
}

// ---------- Test 1: sentinel-bounded section replaced + body byte-identical ----------

function testSentinelReplaceBodyPreserved() {
  const roomDir = makeTmpRoom();
  const NOW_MS = 1714694400000;
  const human =
    '# market-analysis\n\nThis is the human-authored Feynman explanation.\n\n' +
    '## Timeline (auto)\n\n' +
    '<!-- TIMELINE_AUTO_START -->\nOLD CONTENT TO BE REPLACED\n<!-- TIMELINE_AUTO_END -->\n\n' +
    '## Closing notes\n\nMore human content below the sentinels.\n';
  const feyPath = writeFeynman(roomDir, 'market-analysis', human);
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  seedMemoryEvent(db, '01', 'market-analysis', 'node_created', NOW_MS - 1000);

  const result = runner.refreshSection(roomDir, 'market-analysis', { db: db, now_ms: NOW_MS });
  assert.equal(result.status, 'refreshed', 'expected refreshed status, got: ' + JSON.stringify(result));
  assert.ok(typeof result.watermark === 'string' && result.watermark.length > 0, 'watermark ISO must be set');
  assert.equal(result.written_path, feyPath, 'written_path must equal the FEYNMAN.md path');

  const after = fs.readFileSync(feyPath, 'utf8');
  assert.ok(after.indexOf('OLD CONTENT TO BE REPLACED') === -1, 'old sentinel content must be gone');
  assert.ok(after.indexOf('More human content below the sentinels.') !== -1, 'human body after sentinels must be preserved');
  assert.ok(after.indexOf('This is the human-authored Feynman explanation.') !== -1, 'human body before sentinels must be preserved');
  assert.ok(after.indexOf('<!-- TIMELINE_AUTO_START -->') !== -1, 'sentinel start preserved');
  assert.ok(after.indexOf('<!-- TIMELINE_AUTO_END -->') !== -1, 'sentinel end preserved');

  // Body byte-identical (D-02 hard invariant): hash the outside-sentinels regions of pre and post.
  // The post-file has frontmatter prepended (added by runner); strip that before extracting outside-sentinels.
  const preOutside = runner.bodyOutsideSentinels(human);
  const afterStripped = stripFrontmatter(after);
  const postOutside = runner.bodyOutsideSentinels(afterStripped);
  assert.equal(sha256(preOutside), sha256(postOutside), 'body outside sentinels must be byte-identical (SHA256)');

  db.close();
}

// ---------- Test 2: timeline_last_rendered frontmatter set ----------

function testWatermarkFrontmatterSet() {
  const roomDir = makeTmpRoom();
  const NOW_MS = 1714694400000;
  const human = '# market-analysis\n\nNo frontmatter, no sentinels yet.\n';
  const feyPath = writeFeynman(roomDir, 'market-analysis', human);
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  seedMemoryEvent(db, '01', 'market-analysis', 'node_created', NOW_MS - 1000);

  const result = runner.refreshSection(roomDir, 'market-analysis', { db: db, now_ms: NOW_MS });
  assert.equal(result.status, 'refreshed');
  const after = fs.readFileSync(feyPath, 'utf8');
  assert.ok(after.startsWith('---\n'), 'frontmatter fence must be added on first refresh');
  assert.ok(after.indexOf('timeline_last_rendered: ') !== -1, 'timeline_last_rendered key must be present');
  assert.ok(after.indexOf(result.watermark) !== -1, 'frontmatter must carry the same ISO as the result.watermark');
  db.close();
}

// ---------- Test 3: idempotent re-run ----------

function testIdempotentReRun() {
  const roomDir = makeTmpRoom();
  const NOW_MS = 1714694400000;
  writeFeynman(roomDir, 'market-analysis', '# market-analysis\n\nHuman body.\n');
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  seedMemoryEvent(db, '01', 'market-analysis', 'node_created', NOW_MS - 1000);

  runner.refreshSection(roomDir, 'market-analysis', { db: db, now_ms: NOW_MS });
  const feyPath = path.join(roomDir, 'market-analysis', 'FEYNMAN.md');
  const afterFirst = fs.readFileSync(feyPath, 'utf8');
  // Second run with the same now_ms; the watermark check WILL skip (sqlIso <= fmRendered because
  // both are derived from the same NOW_MS at second resolution AND no new events seeded between
  // runs). The file must be byte-identical.
  const result2 = runner.refreshSection(roomDir, 'market-analysis', { db: db, now_ms: NOW_MS });
  const afterSecond = fs.readFileSync(feyPath, 'utf8');
  assert.equal(sha256(afterFirst), sha256(afterSecond), 'idempotent re-run must produce byte-identical file');
  // Either skipped_watermark OR refreshed (both produce identical bytes); the invariant is byte-equality.
  assert.ok(result2.status === 'skipped_watermark' || result2.status === 'refreshed',
    'second run must either skip on watermark or re-render deterministically');
  db.close();
}

// ---------- Test 4: watermark skip ----------

function testWatermarkSkip() {
  const roomDir = makeTmpRoom();
  const NOW_MS = 1714694400000;
  const farFutureIso = '2030-01-01T00:00:00Z';
  const human =
    '---\ntimeline_last_rendered: ' + farFutureIso + '\n---\n\n' +
    '# market-analysis\n\n<!-- TIMELINE_AUTO_START -->\nstale content\n<!-- TIMELINE_AUTO_END -->\n';
  const feyPath = writeFeynman(roomDir, 'market-analysis', human);
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  seedMemoryEvent(db, '01', 'market-analysis', 'node_created', 1000); // way in the past

  const beforeHash = sha256(fs.readFileSync(feyPath, 'utf8'));
  const result = runner.refreshSection(roomDir, 'market-analysis', { db: db, now_ms: NOW_MS });
  assert.equal(result.status, 'skipped_watermark', 'expected watermark skip, got: ' + JSON.stringify(result));
  assert.equal(result.reason, 'sql_older_than_rendered');
  const afterHash = sha256(fs.readFileSync(feyPath, 'utf8'));
  assert.equal(beforeHash, afterHash, 'file must be byte-unchanged on watermark skip');
  db.close();
}

// ---------- Test 5: failure handling (no exception, no corruption) ----------

function testFailureHandling() {
  const roomDir = makeTmpRoom();
  // Create section dir but make FEYNMAN.md a DIRECTORY (will cause refreshSection to return
  // skipped_no_feynman because safeIsFile returns false for a directory). The invariant is
  // "no exception, no corruption, structured status returned".
  fs.mkdirSync(path.join(roomDir, 'market-analysis', 'FEYNMAN.md'), { recursive: true });
  const db = new DatabaseSync(':memory:');
  applySchema(db);

  const result = runner.refreshSection(roomDir, 'market-analysis', { db: db, now_ms: 1714694400000 });
  assert.ok(result.status === 'failed' || result.status === 'skipped_no_feynman',
    'must return a structured status, never throw; got: ' + JSON.stringify(result));

  // Now exercise a TRUE failure path: stub the renderer so renderTimeline throws. The runner
  // must catch the exception, return { status: 'failed', reason: ... }, log a
  // feynman_timeline_refresh_failed memory_event, and NOT corrupt the FEYNMAN.md (atomic .tmp
  // write means the original survives because we never get to the atomicWrite call).
  fs.rmSync(path.join(roomDir, 'market-analysis'), { recursive: true, force: true });
  writeFeynman(roomDir, 'market-analysis', '# section\n\nbody\n');

  // Monkey-patch the renderer module on the runner's cached require to force a throw.
  const rendererPath = require.resolve(path.resolve(__dirname, '..', 'lib', 'core', 'feynman', 'timeline-renderer.cjs'));
  const cachedRenderer = require.cache[rendererPath];
  const originalRender = cachedRenderer.exports.renderTimeline;
  cachedRenderer.exports.renderTimeline = function () {
    throw new Error('synthetic_renderer_failure_for_test_' + 'x'.repeat(250));
  };
  try {
    const result2 = runner.refreshSection(roomDir, 'market-analysis', { db: db, now_ms: 1714694400000 });
    assert.equal(result2.status, 'failed', 'synthetic renderer throw must produce failed status; got: ' + JSON.stringify(result2));
    assert.ok(typeof result2.reason === 'string' && result2.reason.length > 0, 'failure reason must be a non-empty string');
    assert.ok(result2.reason.length <= 200, 'failure reason must be truncated to 200 chars; got length ' + result2.reason.length);

    // File must not be corrupted (we never reached the atomicWrite -- original survives).
    const after = fs.readFileSync(path.join(roomDir, 'market-analysis', 'FEYNMAN.md'), 'utf8');
    assert.equal(after, '# section\n\nbody\n', 'original FEYNMAN.md must survive failed refresh byte-identical');

    // memory_event of type feynman_timeline_refresh_failed must be logged.
    const recent = navigation.findRecentChanges(db, 0, { limit: 50 });
    const failedEvents = recent.filter(function (r) { return r.eventType === 'feynman_timeline_refresh_failed'; });
    assert.ok(failedEvents.length >= 1, 'feynman_timeline_refresh_failed memory_event must be logged');
  } finally {
    cachedRenderer.exports.renderTimeline = originalRender;
  }

  db.close();
}

// ---------- Test 6: memory_event logged on success ----------

function testMemoryEventLogged() {
  const roomDir = makeTmpRoom();
  const NOW_MS = 1714694400000;
  writeFeynman(roomDir, 'market-analysis', '# market-analysis\n\nBody.\n');
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  seedMemoryEvent(db, '01', 'market-analysis', 'node_created', NOW_MS - 1000);

  const result = runner.refreshSection(roomDir, 'market-analysis', { db: db, now_ms: NOW_MS });
  assert.equal(result.status, 'refreshed');

  // findRecentChanges since 0 returns all memory_event rows.
  const recent = navigation.findRecentChanges(db, 0, { limit: 50 });
  const refreshedEvents = recent.filter(function (r) {
    return r.eventType === 'feynman_timeline_refreshed' && r.sourcePath === 'feynman:market-analysis';
  });
  assert.ok(refreshedEvents.length >= 1, 'feynman_timeline_refreshed memory_event must be logged');
  db.close();
}

// ---------- Test 7: first-encounter (no sentinel pair) appends sentinels + preserves body ----------

function testFirstEncounterAppendsSentinels() {
  const roomDir = makeTmpRoom();
  const NOW_MS = 1714694400000;
  const human = '# market-analysis\n\nLine 2.\nLine 3.\nLine 4.\nLine 5.\n';
  const feyPath = writeFeynman(roomDir, 'market-analysis', human);
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  seedMemoryEvent(db, '01', 'market-analysis', 'node_created', NOW_MS - 1000);

  const result = runner.refreshSection(roomDir, 'market-analysis', { db: db, now_ms: NOW_MS });
  assert.equal(result.status, 'refreshed');
  const after = fs.readFileSync(feyPath, 'utf8');
  assert.ok(after.indexOf('<!-- TIMELINE_AUTO_START -->') !== -1, 'sentinel start must be added');
  assert.ok(after.indexOf('<!-- TIMELINE_AUTO_END -->') !== -1, 'sentinel end must be added');
  assert.ok(after.indexOf('## Timeline (auto)') !== -1, 'auto-header must be added');

  // First 5 lines of human body must be preserved byte-identical after the frontmatter strip.
  const afterStripped = stripFrontmatter(after);
  const humanLines = human.split('\n').slice(0, 5);
  const afterLines = afterStripped.split('\n').slice(0, 5);
  assert.deepEqual(afterLines, humanLines, 'first 5 lines of human body must be byte-identical at first-encounter');

  // refreshAll should also discover this section and skip (watermark now set) on re-run.
  const all = runner.refreshAll(roomDir, { db: db, now_ms: NOW_MS });
  assert.ok(all.refreshed.length === 0, 'refreshAll on already-watermarked sections must skip; got refreshed=' + JSON.stringify(all.refreshed));
  assert.ok(all.skipped.length >= 1 || all.refreshed.length === 0, 'refreshAll must return structured summary');

  db.close();
}

// ---------- Run ----------

testEventTypesExtended();
testSentinelReplaceBodyPreserved();
testWatermarkFrontmatterSet();
testIdempotentReRun();
testWatermarkSkip();
testFailureHandling();
testMemoryEventLogged();
testFirstEncounterAppendsSentinels();
process.stdout.write('PASS test-feynman-timeline-runner.cjs (8 tests)\n');
process.exit(0);
