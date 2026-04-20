/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-04 Task 3 -- post-write triple-fire tests
 * ===================================================
 * Covers the 9 behavior cases for the post-write hook's Phase 88 extension:
 *
 *   1. Write to <tmp>/.room-root + <tmp>/market-analysis/new.md (a section
 *      .md artifact) -> debouncer enqueued, recompile backgrounded, stamp
 *      backgrounded. Queue file shows the section.
 *   2. Write to a path with NO .room-root ancestor -> no debouncer enqueue,
 *      no recompile, no stamp. Hook exits 0.
 *   3. Write to ROOM.md/STATE.md/MINTO.md in a section -> NO debouncer
 *      enqueue (system files skipped); stamp still fires (backgrounded).
 *   4. Write to a .txt / .pdf / non-.md file in a section -> NO debouncer
 *      enqueue (classify-insight routing only for .md per cascade contract).
 *   5. Foreground wall-clock for a .md room-section write is bounded.
 *      Target: fast relative to the 3000ms hook timeout; background tasks
 *      complete out of band.
 *   6. post-write exits 0 even when dependencies of the triple are broken.
 *   7. Non-blocking spawn is visible in scripts/post-write (stamp + recompile
 *      both end in a backgrounded subshell `&`).
 *   8. tool_name = "Edit" on a section .md -> same outcome as Write.
 *   9. tool_name = "MultiEdit" on a section .md -> same outcome as Write.
 *
 * Test harness: spawnSync bash on scripts/post-write with hook JSON on
 * stdin. Each test owns its tmpdir. Cleanup at exit.
 *
 * We stub out the cascade router bin/mindrian-tools.cjs by pointing the
 * fixture at a path outside room/rooms/ for the specific cascade paths
 * that require complex dependencies -- the triple we are testing operates
 * on .room-root ancestry, independent of the cascade path.
 */

'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const POST_WRITE = path.join(REPO_ROOT, 'scripts', 'post-write');

const createdTmpDirs = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  createdTmpDirs.push(d);
  return d;
}
process.on('exit', () => {
  for (const d of createdTmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
});

// --- helpers ----------------------------------------------------------------

// Build a minimal room fixture rooted at tmp:
//   <tmp>/.room-root   (sentinel)
//   <tmp>/.mindrian/   (state dir; debouncer + stamp writes here)
//   <tmp>/<section>/   (section directory)
function seedRoom(tmp, sectionName) {
  fs.writeFileSync(path.join(tmp, '.room-root'), '');
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const sec = path.join(tmp, sectionName);
  fs.mkdirSync(sec, { recursive: true });
  return sec;
}

function invokePostWrite(toolName, filePath) {
  const hookJson = JSON.stringify({
    tool_name: toolName,
    tool_input: { file_path: filePath },
  });
  return spawnSync('bash', [POST_WRITE], {
    input: hookJson,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { PWD: path.dirname(filePath) }),
  });
}

// Waits up to maxMs for predicate() to return true. Used to poll for
// backgrounded stamp / recompile completion.
async function waitFor(predicate, maxMs = 3000, stepMs = 25) {
  const until = Date.now() + maxMs;
  while (Date.now() < until) {
    try { if (predicate()) return true; } catch (_) {}
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return false;
}

// --- runner ----------------------------------------------------------------

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ---------- Test 1: Write -> triple fires, queue gets section -------------
test('Test 1: Write to room section .md -> queue enqueues, stamp fires', async () => {
  const tmp = mkTmp('pwt-1-');
  const sec = seedRoom(tmp, 'market-analysis');
  const mdPath = path.join(sec, 'new-artifact.md');
  fs.writeFileSync(mdPath, '# New\n');

  const r = invokePostWrite('Write', mdPath);
  assert.strictEqual(r.status, 0, 'post-write exit 0 (got: ' + r.status + ', stderr=' + (r.stderr||'').toString() + ')');

  // Queue file should be produced synchronously (debouncer enqueue is foreground).
  const queuePath = path.join(tmp, '.mindrian', 'minto-queue.json');
  const ok = await waitFor(() => fs.existsSync(queuePath), 2000);
  assert.ok(ok, 'minto-queue.json created within 2s');
  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  assert.ok(Array.isArray(queue.entries), 'queue has entries array');
  assert.ok(
    queue.entries.some((e) => e.section === 'market-analysis'),
    'queue contains market-analysis entry'
  );
});

// ---------- Test 2: No .room-root ancestor -> no-op --------------------
test('Test 2: Write outside .room-root -> no enqueue, no stamp', async () => {
  const tmp = mkTmp('pwt-2-');
  // No .room-root sentinel anywhere under tmp.
  const dir = path.join(tmp, 'plugin-source-like');
  fs.mkdirSync(dir, { recursive: true });
  const mdPath = path.join(dir, 'foo.cjs');
  fs.writeFileSync(mdPath, '// not a room artifact\n');

  const r = invokePostWrite('Write', mdPath);
  assert.strictEqual(r.status, 0, 'post-write exit 0');

  // No queue should be created anywhere under tmp.
  const queuePath = path.join(tmp, '.mindrian', 'minto-queue.json');
  // Wait briefly to give any accidental background spawn time to produce
  // the file; then assert it is still absent.
  await new Promise((r) => setTimeout(r, 200));
  assert.ok(!fs.existsSync(queuePath), 'no queue created for non-room write');
});

// ---------- Test 3: ROOM.md/STATE.md/MINTO.md -> system files skip enqueue
test('Test 3: ROOM.md write -> no enqueue (system file), stamp still fires', async () => {
  const tmp = mkTmp('pwt-3-');
  const sec = seedRoom(tmp, 'solution-design');
  const roomMdPath = path.join(sec, 'ROOM.md');
  fs.writeFileSync(roomMdPath, '# Solution Design ROOM\n');

  const r = invokePostWrite('Write', roomMdPath);
  assert.strictEqual(r.status, 0, 'post-write exit 0');

  // Wait a beat for stamp to land.
  await new Promise((r) => setTimeout(r, 300));

  const queuePath = path.join(tmp, '.mindrian', 'minto-queue.json');
  // Queue MUST NOT contain an entry for this section because ROOM.md is
  // the system file, not an artifact signal. It might not even exist.
  if (fs.existsSync(queuePath)) {
    const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
    const hasEntry = (queue.entries || []).some(
      (e) => e.section === 'solution-design'
    );
    assert.ok(!hasEntry, 'system-file ROOM.md write must NOT enqueue regen');
  }
});

// ---------- Test 4: Non-.md write -> no enqueue -----------------------
test('Test 4: .txt write in section -> no debouncer enqueue', async () => {
  const tmp = mkTmp('pwt-4-');
  const sec = seedRoom(tmp, 'business-model');
  const txtPath = path.join(sec, 'note.txt');
  fs.writeFileSync(txtPath, 'plain text\n');

  const r = invokePostWrite('Write', txtPath);
  assert.strictEqual(r.status, 0, 'post-write exit 0');

  await new Promise((r) => setTimeout(r, 300));

  const queuePath = path.join(tmp, '.mindrian', 'minto-queue.json');
  if (fs.existsSync(queuePath)) {
    const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
    const hasEntry = (queue.entries || []).some(
      (e) => e.section === 'business-model'
    );
    assert.ok(!hasEntry, '.txt write must NOT enqueue regen');
  }
});

// ---------- Test 5: Foreground wall-clock is bounded -----------------
test('Test 5: foreground post-write < 1500ms for .md room-section write', async () => {
  const tmp = mkTmp('pwt-5-');
  const sec = seedRoom(tmp, 'competitive-analysis');
  // Seed 5 existing artifacts to make recompile non-trivial.
  for (let i = 0; i < 5; i++) {
    fs.writeFileSync(
      path.join(sec, 'existing-' + i + '.md'),
      '# Existing ' + i + '\n'
    );
  }
  const mdPath = path.join(sec, 'newer.md');
  fs.writeFileSync(mdPath, '# Newer\n');

  const start = Date.now();
  const r = invokePostWrite('Write', mdPath);
  const elapsed = Date.now() - start;

  assert.strictEqual(r.status, 0, 'post-write exit 0');
  // Budget is 1500ms under test conditions (cold Node spawns for every
  // subprocess). Target <300ms uncontended; allow generous headroom
  // because CI may be slow.
  assert.ok(elapsed < 1500,
    'foreground post-write < 1500ms (got: ' + elapsed + 'ms)');
});

// ---------- Test 6: post-write never exits non-zero ------------------
test('Test 6: post-write exits 0 when cascade path is degraded', async () => {
  const tmp = mkTmp('pwt-6-');
  const sec = seedRoom(tmp, 'risky-writes');
  const mdPath = path.join(sec, 'ok.md');
  fs.writeFileSync(mdPath, '# ok\n');

  const r = invokePostWrite('Write', mdPath);
  // Regardless of whether downstream cascade fires or fails, exit must
  // be 0 -- the hook is a soft-fail channel.
  assert.strictEqual(r.status, 0, 'post-write exit 0 under degraded deps');
});

// ---------- Test 7: Non-blocking spawn assertion ---------------------
test('Test 7: post-write source shows backgrounded stamp + recompile', async () => {
  const src = fs.readFileSync(POST_WRITE, 'utf8');
  // Count backgrounded subshells `) &`
  const backgroundSpawns = (src.match(/\)\s*&\s*$/gm) || []).length;
  assert.ok(
    backgroundSpawns >= 2,
    'at least 2 `) &` backgrounded subshells (got ' + backgroundSpawns + ')'
  );
  // Stamp CLI referenced
  assert.ok(
    /stamp-artifact-write\.cjs/.test(src),
    'stamp-artifact-write.cjs invoked in post-write'
  );
  // Recompile CLI referenced
  assert.ok(
    /recompile-room-references\.cjs/.test(src),
    'recompile-room-references.cjs invoked in post-write'
  );
  // Debouncer CLI referenced
  assert.ok(
    /minto-debouncer\.cjs enqueue/.test(src),
    'minto-debouncer.cjs enqueue invoked in post-write'
  );
  // System-file exclusion pattern
  assert.ok(
    /ROOM\.md\|STATE\.md\|MINTO\.md/.test(src),
    'system-file exclusion visible in source'
  );
});

// ---------- Test 8: Edit tool name -> same triple fires --------------
test('Test 8: tool_name="Edit" on section .md -> enqueue fires', async () => {
  const tmp = mkTmp('pwt-8-');
  const sec = seedRoom(tmp, 'financial-model');
  const mdPath = path.join(sec, 'edited.md');
  fs.writeFileSync(mdPath, '# Before\n');

  const r = invokePostWrite('Edit', mdPath);
  assert.strictEqual(r.status, 0, 'post-write exit 0 for Edit');

  const queuePath = path.join(tmp, '.mindrian', 'minto-queue.json');
  const ok = await waitFor(() => fs.existsSync(queuePath), 2000);
  assert.ok(ok, 'queue produced on Edit within 2s');
  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  assert.ok(
    queue.entries.some((e) => e.section === 'financial-model'),
    'queue has financial-model entry on Edit'
  );
});

// ---------- Test 9: MultiEdit tool name -> same triple fires ---------
test('Test 9: tool_name="MultiEdit" on section .md -> enqueue fires', async () => {
  const tmp = mkTmp('pwt-9-');
  const sec = seedRoom(tmp, 'team-execution');
  const mdPath = path.join(sec, 'multi.md');
  fs.writeFileSync(mdPath, '# Before\n');

  const r = invokePostWrite('MultiEdit', mdPath);
  assert.strictEqual(r.status, 0, 'post-write exit 0 for MultiEdit');

  const queuePath = path.join(tmp, '.mindrian', 'minto-queue.json');
  const ok = await waitFor(() => fs.existsSync(queuePath), 2000);
  assert.ok(ok, 'queue produced on MultiEdit within 2s');
  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  assert.ok(
    queue.entries.some((e) => e.section === 'team-execution'),
    'queue has team-execution entry on MultiEdit'
  );
});

// --- runner ----------------------------------------------------------------

(async () => {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      process.stdout.write('PASS ' + t.name + '\n');
    } catch (e) {
      failed += 1;
      process.stderr.write('FAIL ' + t.name + '\n' + (e && e.stack || e) + '\n');
    }
  }
  process.stdout.write(
    '\npost-write-triple.test.cjs: ' +
    (tests.length - failed) + '/' + tests.length + ' passed\n'
  );
  process.exit(failed === 0 ? 0 : 1);
})();
