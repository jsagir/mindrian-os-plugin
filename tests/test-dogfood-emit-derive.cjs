'use strict';
// Phase 260517-dcw Task 2: integration test for dogfood-emit.cjs + dogfood-derive.cjs.
//
// 12 assertions per <behavior>:
//   1-3. Seed queue with 3 JSONL rows -> spawn dogfood-emit.cjs -> assert 3 file_changed
//        memory_event rows land in nodes table
//   4.   Queue file truncated to 0 bytes after successful drain
//   5.   Seed minimal STATE.md (no sentinel pair) -> spawn dogfood-derive.cjs ->
//        sentinel pair appears exactly once
//   6.   SHA256 of bodyOutsideSentinels(newBody) === SHA256 of original body
//   7.   feynman_timeline_refreshed memory_event logged
//   8.   Re-run derive: sentinel pair still appears exactly once (Case A replacement)
//   9.   Adversarial Canon Part 8 sweep: emit + derive scripts contain ZERO forbidden
//        Brain/network substrings
//   10.  EVENT_TYPES Set contains all 6 new strings
//   11.  Dry-run for emit returns parse summary, queue UNTRUCATED
//   12.  Dry-run for derive prints proposed block, STATE.md unchanged
//
// Mirrors tests/test-feynman-timeline-runner.cjs (tmpdir + DatabaseSync + applySchema).
//
// Canon Part 9 D-03: derive reads memory_event ONLY via navigation.cjs::findRecentChanges.
// Canon Part 9 D-05: emit writes memory_event ONLY via navigation.cjs::logMemoryEvent.
// Canon Part 8: zero Brain egress in either script.
// Canon Part 7: derive REUSES feynman_timeline_refreshed memory_event type (no parallel type).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_) {
  process.stdout.write('SKIP test-dogfood-emit-derive.cjs (node:sqlite unavailable; need Node 22+)\n');
  process.exit(77);
}

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const EMIT_SCRIPT = path.join(PLUGIN_ROOT, 'scripts', 'dogfood-emit.cjs');
const DERIVE_SCRIPT = path.join(PLUGIN_ROOT, 'scripts', 'dogfood-derive.cjs');
const memoryEvents = require(path.join(PLUGIN_ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs'));

// ---------- Fixture helpers (mirror tests/test-feynman-timeline-runner.cjs) ----------

const TMP_ROOTS = [];
function makeTmpDir(prefix) {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
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

function sha256(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }

function countFileChangedEvents(roomDbPath) {
  const db = new DatabaseSync(roomDbPath);
  try {
    const row = db.prepare(
      "SELECT COUNT(*) AS n FROM nodes WHERE type='memory_event' AND json_extract(properties, '$.event_type')=?"
    ).get('file_changed');
    return row.n;
  } finally {
    try { db.close(); } catch (_) {}
  }
}

function countEventsOfType(roomDbPath, eventType) {
  const db = new DatabaseSync(roomDbPath);
  try {
    const row = db.prepare(
      "SELECT COUNT(*) AS n FROM nodes WHERE type='memory_event' AND json_extract(properties, '$.event_type')=?"
    ).get(eventType);
    return row.n;
  } finally {
    try { db.close(); } catch (_) {}
  }
}

function bodyOutsideSentinels(body) {
  const SENTINEL_START = '<!-- LIVE_AUTO_START -->';
  const SENTINEL_END = '<!-- LIVE_AUTO_END -->';
  const startIdx = body.indexOf(SENTINEL_START);
  const endIdx = body.indexOf(SENTINEL_END);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return body;
  let lineStart = body.lastIndexOf('\n', startIdx);
  if (lineStart === -1) lineStart = 0;
  let lineEnd = body.indexOf('\n', endIdx + SENTINEL_END.length);
  if (lineEnd === -1) lineEnd = body.length;
  return body.slice(0, lineStart) + body.slice(lineEnd);
}

function countSentinelPairs(body) {
  const SENTINEL_START = '<!-- LIVE_AUTO_START -->';
  let count = 0;
  let from = 0;
  while (true) {
    const idx = body.indexOf(SENTINEL_START, from);
    if (idx === -1) break;
    count += 1;
    from = idx + SENTINEL_START.length;
  }
  return count;
}

function setupTmpRoom() {
  const tmpHome = makeTmpDir('dogfood-it-home-');
  const tmpRoomDir = makeTmpDir('dogfood-it-room-');
  // queue dir + queue file
  fs.mkdirSync(path.join(tmpHome, '.mindrian'), { recursive: true });
  // room.db with schema
  const roomDbPath = path.join(tmpRoomDir, 'room.db');
  const db = new DatabaseSync(roomDbPath);
  applySchema(db);
  db.close();
  return { tmpHome, tmpRoomDir, roomDbPath };
}

function seedQueue(tmpHome, rows) {
  const queueFile = path.join(tmpHome, '.mindrian', 'dogfood-queue.jsonl');
  const lines = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
  fs.writeFileSync(queueFile, lines, 'utf8');
  return queueFile;
}

function runScript(scriptPath, args, tmpHome, tmpRoomDir) {
  return cp.spawnSync('node', [scriptPath].concat(args || []), {
    encoding: 'utf8',
    env: Object.assign({}, process.env, {
      HOME: tmpHome,
      MINDRIAN_DOGFOOD_ROOM_DIR: tmpRoomDir,
    }),
  });
}

// ---------- EVENT_TYPES additive extension (assertion 10) ----------

function testEventTypesExtended() {
  const six = ['file_changed', 'commit_landed', 'phase_completed', 'release_shipped', 'tester_signal', 'decision_captured'];
  for (const s of six) {
    assert.ok(memoryEvents.EVENT_TYPES.has(s), 'EVENT_TYPES missing: ' + s);
  }
  // Existing Phase 124-02 + 110-02 strings must still be present (no regression).
  assert.ok(memoryEvents.EVENT_TYPES.has('feynman_timeline_refreshed'), 'feynman_timeline_refreshed regression');
  assert.ok(memoryEvents.EVENT_TYPES.has('brain_packet_rejected'), 'brain_packet_rejected regression');
  // Set size floor: 48 baseline (after Phase 120-00) + 6 new = at least 54.
  assert.ok(memoryEvents.EVENT_TYPES.size >= 54,
    'EVENT_TYPES.size = ' + memoryEvents.EVENT_TYPES.size + ' (expected >= 54)');
}

// ---------- Emit + derive integration test (assertions 1-8) ----------

function testFullEmitDerivePipeline() {
  const { tmpHome, tmpRoomDir, roomDbPath } = setupTmpRoom();
  const queueFile = path.join(tmpHome, '.mindrian', 'dogfood-queue.jsonl');

  // Seed 3 synthetic queue rows.
  seedQueue(tmpHome, [
    { ts: '2026-05-17T10:00:00Z', tool: 'Edit', path: '/home/jsagi/MindrianOS-Plugin/lib/foo.cjs' },
    { ts: '2026-05-17T10:01:00Z', tool: 'Write', path: '/home/jsagi/MindrianOS-Plugin/scripts/bar.sh' },
    { ts: '2026-05-17T10:02:00Z', tool: 'MultiEdit', path: '/home/jsagi/MindrianOS-Plugin/commands/baz.md' },
  ]);

  // Assertion 1-3: spawn dogfood-emit.cjs -> 3 file_changed events in nodes table.
  const emitResult = runScript(EMIT_SCRIPT, [], tmpHome, tmpRoomDir);
  assert.equal(emitResult.status, 0, 'emit must exit 0; stderr=' + (emitResult.stderr || ''));
  const fcCount = countFileChangedEvents(roomDbPath);
  assert.equal(fcCount, 3, 'expected 3 file_changed memory_event rows; got ' + fcCount);

  // Assertion 4: queue truncated to 0 bytes.
  const queueSize = fs.statSync(queueFile).size;
  assert.equal(queueSize, 0, 'queue must be truncated to 0 bytes after drain; got ' + queueSize);

  // Seed a minimal STATE.md (no sentinel pair). Save the body for assertion 6.
  const statePath = path.join(tmpRoomDir, 'STATE.md');
  const origBody = '---\nroom: mindrian\n---\n\n# Mindrian (Plugin Venture Room)\n\nHuman-authored prose.\n';
  fs.writeFileSync(statePath, origBody, 'utf8');

  // Assertion 5: spawn dogfood-derive.cjs (FIRST run, Case B: appends HEADER + sentinel pair) ->
  // sentinel pair appears exactly once.
  const deriveResult = runScript(DERIVE_SCRIPT, [], tmpHome, tmpRoomDir);
  assert.equal(deriveResult.status, 0, 'derive must exit 0; stderr=' + (deriveResult.stderr || ''));
  const firstBody = fs.readFileSync(statePath, 'utf8');
  assert.equal(countSentinelPairs(firstBody), 1,
    'sentinel pair must appear exactly once after first derive; got ' + countSentinelPairs(firstBody));

  // Assertion 5b: the verbatim human prose prefix MUST be preserved byte-identical at the
  // start of the file. Case B appends `## Live (auto)\n\n<sentinel>...</sentinel>\n` AFTER
  // the original body, so the original body bytes are the strict prefix of the new body.
  assert.ok(firstBody.startsWith(origBody),
    'first-encounter Case B must append at EOF; human prose prefix must be byte-identical');

  // Assertion 7: one feynman_timeline_refreshed event logged.
  const ftrCount = countEventsOfType(roomDbPath, 'feynman_timeline_refreshed');
  assert.ok(ftrCount >= 1,
    'feynman_timeline_refreshed memory_event must be logged; got ' + ftrCount);

  // Assertion 6 + 8: re-run derive (SECOND run, Case A: replace between sentinels). The
  // sentinel pair must still appear exactly once AND the SHA256 of bodyOutsideSentinels
  // must be byte-identical to the SHA256 of bodyOutsideSentinels(firstBody) -- the Case A
  // byte-preservation invariant.
  const firstOutsideHash = sha256(bodyOutsideSentinels(firstBody));
  const deriveResult2 = runScript(DERIVE_SCRIPT, [], tmpHome, tmpRoomDir);
  assert.equal(deriveResult2.status, 0, 'second derive must exit 0; stderr=' + (deriveResult2.stderr || ''));
  const body2 = fs.readFileSync(statePath, 'utf8');
  assert.equal(countSentinelPairs(body2), 1,
    'sentinel pair must still appear exactly once after second derive; got ' + countSentinelPairs(body2));
  const secondOutsideHash = sha256(bodyOutsideSentinels(body2));
  assert.equal(secondOutsideHash, firstOutsideHash,
    'Case A: body outside sentinels must be byte-identical (SHA256) across regeneration');
}

// ---------- Adversarial Canon Part 8 sweep (assertion 9) ----------

function testCanonPart8Tripwire() {
  const FORBIDDEN = /brain\.mindrian|fetch.*brain|tavily|node:http|node:https|require.*brain-client/;
  for (const p of [EMIT_SCRIPT, DERIVE_SCRIPT]) {
    const src = fs.readFileSync(p, 'utf8');
    // Strip line-comments (// ...) and block comments (/* ... */) before scanning so that
    // legitimate prose like "ZERO Brain calls" does not trip the heuristic. We sweep the
    // executable code only, mirroring the Phase 90/110 tripwire strategy.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((l) => l.replace(/\/\/.*$/, ''))
      .join('\n');
    assert.ok(!FORBIDDEN.test(codeOnly),
      'Canon Part 8 tripwire matched in ' + path.basename(p) + ' (executable code only)');
  }
}

// ---------- Dry-run paths (assertions 11-12) ----------

function testDryRunPaths() {
  const { tmpHome, tmpRoomDir } = setupTmpRoom();
  // Seed 2-row queue.
  seedQueue(tmpHome, [
    { ts: '2026-05-17T10:00:00Z', tool: 'Edit', path: '/home/jsagi/MindrianOS-Plugin/lib/foo.cjs' },
    { ts: '2026-05-17T10:01:00Z', tool: 'Write', path: '/home/jsagi/MindrianOS-Plugin/scripts/bar.sh' },
  ]);
  const queueFile = path.join(tmpHome, '.mindrian', 'dogfood-queue.jsonl');
  const queueSizeBefore = fs.statSync(queueFile).size;

  // Assertion 11: emit --dry-run leaves queue untouched.
  const emitDry = runScript(EMIT_SCRIPT, ['--dry-run'], tmpHome, tmpRoomDir);
  assert.equal(emitDry.status, 0, 'emit --dry-run must exit 0; stderr=' + (emitDry.stderr || ''));
  assert.ok(emitDry.stdout.indexOf('would_emit') !== -1, 'emit --dry-run must print would_emit');
  const queueSizeAfter = fs.statSync(queueFile).size;
  assert.equal(queueSizeAfter, queueSizeBefore, 'emit --dry-run must NOT truncate the queue');

  // Seed STATE.md, capture hash, run derive --dry-run, assert STATE.md unchanged.
  const statePath = path.join(tmpRoomDir, 'STATE.md');
  const origBody = '# Mindrian\n\nPlain body.\n';
  fs.writeFileSync(statePath, origBody, 'utf8');
  const origHash = sha256(origBody);
  const deriveDry = runScript(DERIVE_SCRIPT, ['--dry-run'], tmpHome, tmpRoomDir);
  assert.equal(deriveDry.status, 0, 'derive --dry-run must exit 0; stderr=' + (deriveDry.stderr || ''));
  const newHash = sha256(fs.readFileSync(statePath, 'utf8'));
  assert.equal(newHash, origHash, 'derive --dry-run must NOT touch STATE.md');
}

// ---------- Soft-fail (no queue file) ----------

function testEmitNoQueueFile() {
  const { tmpHome, tmpRoomDir } = setupTmpRoom();
  // Do NOT seed queue file.
  const queueFile = path.join(tmpHome, '.mindrian', 'dogfood-queue.jsonl');
  if (fs.existsSync(queueFile)) fs.rmSync(queueFile);
  const r = runScript(EMIT_SCRIPT, [], tmpHome, tmpRoomDir);
  assert.equal(r.status, 0, 'emit with no queue must exit 0; stderr=' + (r.stderr || ''));
  assert.ok(r.stdout.indexOf('no_queue_file') !== -1, 'emit no-queue must print no_queue_file reason');
}

// ---------- Run ----------

const tests = [
  ['EVENT_TYPES additive extension (+6 strings)', testEventTypesExtended],
  ['Full emit+derive pipeline (3 events -> sentinel block -> SHA256 invariant)', testFullEmitDerivePipeline],
  ['Canon Part 8 tripwire (zero Brain/network code)', testCanonPart8Tripwire],
  ['Dry-run paths (emit + derive)', testDryRunPaths],
  ['Emit soft-fail when no queue file', testEmitNoQueueFile],
];

let pass = 0;
let fail = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    process.stdout.write('PASS ' + name + '\n');
    pass += 1;
  } catch (e) {
    process.stdout.write('FAIL ' + name + ': ' + (e && e.message ? e.message : e) + '\n');
    if (e && e.stack) process.stdout.write(e.stack.split('\n').slice(0, 3).join('\n') + '\n');
    fail += 1;
  }
}
process.stdout.write('\nTotal: ' + (pass + fail) + ' PASS=' + pass + ' FAIL=' + fail + '\n');
process.exit(fail > 0 ? 1 : 0);
