'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 143.1-05 -- dial-memory runner test (MEMDIAL-02 runner half).
 * ==================================================================
 * Proves the runner ACTUALLY writes the sentinel-bounded dial-memory section to a
 * target MD on disk in PRODUCTION (not test-only / not green-in-tests-but-inert),
 * and byte-preserves a human-authored body across regeneration:
 *
 *   (a) The runner writes the dial sentinels + the rendered section to the target
 *       FEYNMAN.md; the read-back from disk proves the write landed.
 *   (b) The human-authored body OUTSIDE the dial sentinels is byte-identical
 *       pre/post (SHA256 of the outside-sentinels region) -- the D-02 hard
 *       invariant.
 *   (c) Idempotent in production: two runner passes leave the human body AND the
 *       rendered section byte-identical (deterministic clock).
 *   (d) A dial_memory_refreshed memory_event is logged on success.
 *   (e) The runner is a THIN SHIM over the Phase 124 timeline-runner (Part 7
 *       reuse): a source grep asserts it requires ./timeline-runner.cjs and reuses
 *       atomicWrite / parseFrontmatter, never re-implementing the atomic write.
 *   (f) The dial sentinels coexist with the Phase 124 timeline sentinels on the
 *       SAME file without collision (both blocks survive a dial refresh).
 *
 * Real room.db schema via openRoomDb (mirrors the Phase 143.1-03 fixture) so
 * navigation.getNeighborhood runs against the production schema.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

try {
  require('node:sqlite');
} catch (_) {
  process.stdout.write('SKIP test-dial-memory-runner.cjs (node:sqlite unavailable; need Node 22+)\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const RUNNER_PATH = path.join(REPO_ROOT, 'lib', 'core', 'feynman', 'dial-memory-runner.cjs');
const runner = require(RUNNER_PATH);
const dialRenderer = require(path.join(REPO_ROOT, 'lib', 'core', 'feynman', 'dial-memory-renderer.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const memoryEvents = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs'));
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

const SECTION = 'problem-definition';
const FOCUS_ID = 'section:' + SECTION;

// ---------- Fixture helpers ----------

const TMP_ROOTS = [];
function makeTmpRoom() {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'p1431-05-dial-mem-runner-'));
  TMP_ROOTS.push(r);
  return r;
}
process.on('exit', () => {
  for (const r of TMP_ROOTS) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (_) {} }
});

function sha256(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }

function seedNode(db, id, type, createdAt) {
  db.prepare(
    'INSERT OR IGNORE INTO nodes (id, type, properties, source_path, source_section, created_by, confidence, review_status, created_at, last_seen_at) ' +
    "VALUES (?, ?, '{}', ?, ?, 'system', NULL, 'confirmed', ?, ?)"
  ).run(id, type, SECTION, SECTION, createdAt, createdAt);
}

function seedSelectedReach(db, command, createdAt) {
  seedNode(db, FOCUS_ID, 'section', createdAt);
  seedNode(db, 'cmd:' + command, 'command', createdAt);
  db.prepare(
    'INSERT OR REPLACE INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)'
  ).run(FOCUS_ID, 'cmd:' + command, 'SELECTED_REACH',
    JSON.stringify({ jtbd: 'find-problem', framework: 'SWOT', recommended: false, decision_id: 'dec:' + createdAt }));
}

function writeMemoryMd(roomDir, slug, content) {
  const dir = path.join(roomDir, slug);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, 'FEYNMAN.md');
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

function stripFrontmatter(s) {
  if (!s.startsWith('---\n')) return s;
  const lines = s.split('\n');
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') return lines.slice(i + 1).join('\n');
  }
  return s;
}

const REACH_LIST = {
  reaches: [{ reach_id: 'context_block', recommended: true, score: 0.82 }],
  tier_mode: 'mode_a',
};

// ---------- Test 1: production write + body byte-preservation ----------

function testProductionWriteAndBytePreserve() {
  const roomDir = makeTmpRoom();
  const NOW = 1714694400000;
  const human =
    '# problem-definition\n\nThis is the human-authored memory body.\n\n' +
    dialRenderer.HEADER + '\n\n' +
    dialRenderer.SENTINEL_START + '\nOLD DIAL CONTENT\n' + dialRenderer.SENTINEL_END + '\n\n' +
    '## Closing\n\nMore human content below the dial sentinels.\n';
  const feyPath = writeMemoryMd(roomDir, SECTION, human);

  const db = openRoomDb(roomDir);
  seedSelectedReach(db, 'mos:swot', NOW - 2000);

  const result = runner.refreshSection(roomDir, SECTION, {
    db: db, now_ms: NOW, focusNodeId: FOCUS_ID, reachList: REACH_LIST,
  });
  assert.equal(result.status, 'refreshed', 'expected refreshed; got ' + JSON.stringify(result));
  assert.equal(result.written_path, feyPath, 'written_path equals the target MD');
  assert.ok(typeof result.watermark === 'string' && result.watermark.length > 0, 'watermark ISO set');

  // Read the file back FROM DISK -- this is the proof the production write landed.
  const after = fs.readFileSync(feyPath, 'utf8');
  assert.ok(after.indexOf('OLD DIAL CONTENT') === -1, 'old dial content replaced');
  assert.ok(after.indexOf('This is the human-authored memory body.') !== -1, 'human body above sentinels preserved');
  assert.ok(after.indexOf('More human content below the dial sentinels.') !== -1, 'human body below sentinels preserved');
  assert.ok(after.indexOf(dialRenderer.SENTINEL_START) !== -1, 'dial sentinel start preserved');
  assert.ok(after.indexOf(dialRenderer.SENTINEL_END) !== -1, 'dial sentinel end preserved');
  // The rendered section landed inside the sentinels.
  assert.ok(after.indexOf('mos:swot') !== -1, 'rendered SELECTED_REACH content written inside the sentinels');
  assert.ok(/recent research conclusions/i.test(after), 'rendered research-conclusions block written');

  // Body byte-identical outside the dial sentinels (D-02). Strip the watermark
  // frontmatter the runner prepended before extracting the outside-sentinels region.
  const preOutside = dialRenderer.bodyOutsideSentinels(human);
  const afterStripped = stripFrontmatter(after);
  const postOutside = dialRenderer.bodyOutsideSentinels(afterStripped);
  assert.equal(sha256(preOutside), sha256(postOutside), 'body outside dial sentinels byte-identical (SHA256)');

  // Watermark frontmatter key present.
  assert.ok(after.indexOf(runner.WATERMARK_KEY + ': ') !== -1, 'dial_memory_last_rendered watermark in frontmatter');

  db.close();
}

// ---------- Test 2: idempotent in production (two passes byte-identical) ----------

function testIdempotentProduction() {
  const roomDir = makeTmpRoom();
  const NOW = 1714694400000;
  const human = '# problem-definition\n\nHuman body.\n';
  const feyPath = writeMemoryMd(roomDir, SECTION, human);

  const db = openRoomDb(roomDir);
  seedSelectedReach(db, 'mos:swot', NOW - 2000);

  runner.refreshSection(roomDir, SECTION, { db: db, now_ms: NOW, focusNodeId: FOCUS_ID, reachList: REACH_LIST });
  const afterFirst = fs.readFileSync(feyPath, 'utf8');
  runner.refreshSection(roomDir, SECTION, { db: db, now_ms: NOW, focusNodeId: FOCUS_ID, reachList: REACH_LIST });
  const afterSecond = fs.readFileSync(feyPath, 'utf8');
  assert.equal(sha256(afterFirst), sha256(afterSecond), 'two runner passes (same clock + graph) byte-identical');

  // The human body still survives the second pass.
  assert.ok(afterSecond.indexOf('Human body.') !== -1, 'human body survives the second runner pass');
  db.close();
}

// ---------- Test 3: dial_memory_refreshed memory_event logged ----------

function testMemoryEventLogged() {
  const roomDir = makeTmpRoom();
  const NOW = 1714694400000;
  writeMemoryMd(roomDir, SECTION, '# problem-definition\n\nBody.\n');
  const db = openRoomDb(roomDir);
  seedSelectedReach(db, 'mos:swot', NOW - 2000);

  const result = runner.refreshSection(roomDir, SECTION, { db: db, now_ms: NOW, focusNodeId: FOCUS_ID, reachList: REACH_LIST });
  assert.equal(result.status, 'refreshed');

  const recent = navigation.findRecentChanges(db, 0, { limit: 50 });
  const refreshedEvents = recent.filter((r) =>
    r.eventType === 'dial_memory_refreshed' && r.sourcePath === 'dial-memory:' + SECTION);
  assert.ok(refreshedEvents.length >= 1, 'dial_memory_refreshed memory_event logged');
  db.close();
}

// ---------- Test 4: refreshAll discovers the section + empty-state write ----------

function testRefreshAllAndEmptyState() {
  const roomDir = makeTmpRoom();
  const NOW = 1714694400000;
  writeMemoryMd(roomDir, SECTION, '# problem-definition\n\nHuman body.\n');
  const db = openRoomDb(roomDir);
  // No SELECTED_REACH -> empty state, but the runner STILL writes (the section is
  // never omitted; it carries a clean "no dial activity yet").
  seedNode(db, FOCUS_ID, 'section', NOW - 1000);

  const all = runner.refreshAll(roomDir, { db: db, now_ms: NOW, focusNodeId: FOCUS_ID, reachList: { reaches: [], tier_mode: 'tier_0' } });
  assert.ok(all.refreshed.length >= 1, 'refreshAll discovers + writes the section; got ' + JSON.stringify(all));
  const after = fs.readFileSync(path.join(roomDir, SECTION, 'FEYNMAN.md'), 'utf8');
  assert.ok(/no dial activity yet/i.test(after), 'empty-state dial section written (intentional, not omitted)');
  assert.ok(after.indexOf('Human body.') !== -1, 'human body preserved on empty-state write');
  db.close();
}

// ---------- Test 5: coexists with the Phase 124 timeline sentinels ----------

function testCoexistsWithTimelineSentinels() {
  const roomDir = makeTmpRoom();
  const NOW = 1714694400000;
  const timelineRunner = require(path.join(REPO_ROOT, 'lib', 'core', 'feynman', 'timeline-runner.cjs'));
  const human =
    '# problem-definition\n\nHuman body.\n\n' +
    '## Timeline (auto)\n\n' +
    timelineRunner.SENTINEL_START + '\nTIMELINE BLOCK\n' + timelineRunner.SENTINEL_END + '\n';
  const feyPath = writeMemoryMd(roomDir, SECTION, human);
  const db = openRoomDb(roomDir);
  seedSelectedReach(db, 'mos:swot', NOW - 2000);

  runner.refreshSection(roomDir, SECTION, { db: db, now_ms: NOW, focusNodeId: FOCUS_ID, reachList: REACH_LIST });
  const after = fs.readFileSync(feyPath, 'utf8');
  // Both the timeline sentinels AND the new dial sentinels are present.
  assert.ok(after.indexOf(timelineRunner.SENTINEL_START) !== -1, 'timeline sentinels survive a dial refresh');
  assert.ok(after.indexOf('TIMELINE BLOCK') !== -1, 'timeline block content survives (the dial refresh writes a SEPARATE sentinel pair)');
  assert.ok(after.indexOf(dialRenderer.SENTINEL_START) !== -1, 'dial sentinels appended');
  db.close();
}

// ---------- Test 6: thin-shim grep + EVENT_TYPES floor ----------

function testThinShimAndEventFloor() {
  const src = fs.readFileSync(RUNNER_PATH, 'utf8');
  // Part 7 reuse: requires the Phase 124 timeline-runner and reuses its atomic
  // write + frontmatter parse, never re-implementing the atomic write.
  assert.match(src, /require\s*\(\s*['"]\.\/timeline-runner\.cjs['"]/, 'runner must require the Phase 124 ./timeline-runner.cjs (Part 7 reuse)');
  assert.match(src, /timelineRunner\.atomicWrite|atomicWrite/, 'runner must reuse the timeline-runner atomicWrite idiom');
  assert.match(src, /parseFrontmatter|serializeFrontmatter/, 'runner must reuse the timeline-runner frontmatter helpers');
  // Reads the dial section body from the renderer (reads-only via navigation).
  assert.match(src, /require\s*\(\s*['"]\.\/dial-memory-renderer\.cjs['"]/, 'runner must require the dial renderer');
  // No bespoke .tmp+rename re-implementation in the runner itself.
  assert.ok(!/fs\.renameSync\b/.test(src), 'runner must NOT re-implement the .tmp+rename atomic write (reuse the shim)');

  // EVENT_TYPES floor + the two additive dial-memory types present + frozen.
  assert.ok(memoryEvents.EVENT_TYPES.has('dial_memory_refreshed'), 'dial_memory_refreshed in EVENT_TYPES');
  assert.ok(memoryEvents.EVENT_TYPES.has('dial_memory_refresh_failed'), 'dial_memory_refresh_failed in EVENT_TYPES');
  // Floor preserved (the Phase 124 + Plan 03 types still present).
  assert.ok(memoryEvents.EVENT_TYPES.has('feynman_timeline_refreshed'), 'feynman_timeline_refreshed floor preserved');
  assert.ok(memoryEvents.EVENT_TYPES.has('f_selector_sync_confirmed'), 'f_selector_sync_confirmed floor preserved');
  assert.ok(Object.isFrozen(memoryEvents.EVENT_TYPES), 'EVENT_TYPES still frozen');
}

// ---------- Run ----------

testProductionWriteAndBytePreserve();
testIdempotentProduction();
testMemoryEventLogged();
testRefreshAllAndEmptyState();
testCoexistsWithTimelineSentinels();
testThinShimAndEventFloor();
process.stdout.write('PASS test-dial-memory-runner.cjs (6 tests)\n');
process.exit(0);
