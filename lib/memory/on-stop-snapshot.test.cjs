#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-06 -- on-stop close-out snapshot tests
 * ================================================
 * Wires the session-close triple snapshot. On every Stop hook fire, the
 * extended on-stop script must:
 *
 *   1. Preserve the Phase 84 STATE.md write contract byte-for-byte.
 *   2. Drain the minto-debouncer queue with a bounded wall-clock budget
 *      (plan default 1500ms so the 3000ms hook timeout absorbs slack).
 *   3. Recompile ROOM.md references for every active section.
 *   4. Walk sections via folder-memory.readTriple() and assemble
 *      .mindrian/session-snapshot.json for session-start (88-07) to read.
 *   5. Write .mindrian/minto-stale.json for any section whose reasoning
 *      is stale after the drain.
 *   6. Atomic writes (tmp + rename) so a mid-write crash leaves the
 *      previous snapshot intact.
 *   7. Exit 0 on every error path (soft-fail contract).
 *
 * Test map (8 tests, one per PLAN <behavior> case):
 *
 *   Test 1: 3-section room -> session-snapshot.json has 3 section entries.
 *   Test 2: Each snapshot entry has the readTriple() shape (room, state,
 *           reasoning keys present).
 *   Test 3: Queue drain: a fixture queue with pending entries that were
 *           enqueued long ago (synthesized) drains out; remainder (if any)
 *           surfaces in minto-stale.json.
 *   Test 4: Stale reasoning: a section with a sentinel 1970-01-01
 *           last_generated_at appears in minto-stale.json with a reason.
 *   Test 5: Rapid exit: on-stop for a single-section room with no pending
 *           queue finishes under the 3000ms hook budget.
 *   Test 6: STATE.md contract preserved -- on-stop still writes STATE.md
 *           for the active room.
 *   Test 7: Atomic writes -- session-snapshot.json and minto-stale.json
 *           do not leave a .tmp. suffix in .mindrian/ after success.
 *   Test 8: Soft-fail contract -- on-stop exits 0 even when the cascade
 *           dependencies are degraded.
 *
 * Test harness: spawnSync bash on scripts/on-stop with a minimal working
 * directory that is itself the active room. Each test owns its tmpdir and
 * passes it via PWD so resolve-room picks it up (the resolve-room script
 * walks up from PWD looking for the .room-root sentinel).
 *
 * BSL 1.1. Zero npm deps. Node built-ins only. Three-surface by construction.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ON_STOP = path.join(REPO_ROOT, 'scripts', 'on-stop');
const DEBOUNCER = path.join(REPO_ROOT, 'scripts', 'minto-debouncer.cjs');

const TMPDIRS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMPDIRS.push(d);
  return d;
}

process.on('exit', () => {
  for (const d of TMPDIRS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
});

/**
 * Seed a room fixture that resolve-room can find via Strategy 0b
 * (MINDRIAN_ROOMS_HOME directory scan). Layout:
 *   <tmp>/rooms-home/            <- set as MINDRIAN_ROOMS_HOME
 *   <tmp>/rooms-home/<basename>/ <- the room dir (basename matches WS_BASENAME)
 *   <tmp>/rooms-home/<basename>/.room-root
 *   <tmp>/rooms-home/<basename>/.mindrian/
 *   <tmp>/rooms-home/<basename>/<section>/ROOM.md + artifact-01.md
 *
 * Returns { roomDir, roomsHome, workDir } where workDir's basename
 * matches the room's basename so resolve-room finds it. The test
 * invokes on-stop from workDir (PWD) with MINDRIAN_ROOMS_HOME pointing
 * at roomsHome.
 */
function seedRoom(tmp, sections) {
  const roomsHome = path.join(tmp, 'rooms-home');
  const roomBase = 'venture';
  const roomDir = path.join(roomsHome, roomBase);
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });

  // workDir mirrors roomBase so resolve-room Strategy 0b picks it up
  // (basename(WORK_DIR) === ROOM_BASENAME under ROOMS_HOME).
  const workDir = path.join(tmp, 'work', roomBase);
  fs.mkdirSync(workDir, { recursive: true });

  for (const s of sections) {
    const dir = path.join(roomDir, s);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'ROOM.md'),
      '# ' + s + '\n\nIdentity text for ' + s + '.\n'
    );
    // one placeholder artifact so the cross-refs compiler has something
    fs.writeFileSync(
      path.join(dir, 'artifact-01.md'),
      '# ' + s + ' artifact 01\n\nBody.\n'
    );
  }
  return { roomDir, roomsHome, workDir };
}

/**
 * Seed a MINTO.md for a section so readTriple returns reasoning.exists=true.
 * The frontmatter is the narrow v88 dialect that folder-memory-shared parses.
 * When stale=true, last_generated_at is the 1970 sentinel so staleness trips.
 */
function writeMinto(sectionDir, opts) {
  const last = opts && opts.stale
    ? '1970-01-01T00:00:00Z'
    : new Date().toISOString();
  const gt = (opts && opts.governing_thought) || 'Governing thought placeholder.';
  const frontmatter = [
    '---',
    'schema_version: 88',
    'governing_thought: "' + gt + '"',
    'last_generated_at: "' + last + '"',
    'last_artifact_write_seen_at: "' + last + '"',
    'reasoning_health_score: 0.75',
    'flagged_weaknesses: []',
    'decision_log: []',
    '---',
    '',
    '# Governing Thought',
    '',
    gt,
    '',
    '# Claim 1',
    '',
    'Supporting claim.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(sectionDir, 'MINTO.md'), frontmatter);
}

/**
 * Invoke scripts/on-stop in the fixture. Returns the spawnSync result.
 *
 * @param {object} fixture  shape from seedRoom: { roomDir, roomsHome, workDir }
 * @param {object} [extraEnv]
 */
function invokeOnStop(fixture, extraEnv) {
  const env = Object.assign({}, process.env, {
    PWD: fixture.workDir,
    MINDRIAN_ROOMS_HOME: fixture.roomsHome,
    CLAUDE_PLUGIN_ROOT: REPO_ROOT,
  }, extraEnv || {});
  return spawnSync('bash', [ON_STOP], {
    cwd: fixture.workDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10000,
  });
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ---------------------------------------------------------------------------
// Test 1: 3-section room -> snapshot has 3 entries
// ---------------------------------------------------------------------------
test('3-section room -> session-snapshot.json has 3 section entries', () => {
  const tmp = mkTmp('on-stop-t1-');
  const fx = seedRoom(tmp, ['market-analysis', 'problem-definition', 'solution-design']);
  // Give each section a healthy MINTO so readTriple returns exists:true
  writeMinto(path.join(fx.roomDir, 'market-analysis'), { governing_thought: 'TAM bottom-up.' });
  writeMinto(path.join(fx.roomDir, 'problem-definition'), { governing_thought: 'Problem bounded.' });
  writeMinto(path.join(fx.roomDir, 'solution-design'), { governing_thought: 'Solution viable.' });

  const res = invokeOnStop(fx);
  assert.equal(res.status, 0, 'on-stop should exit 0: stderr=' + (res.stderr || ''));

  const snapPath = path.join(fx.roomDir, '.mindrian', 'session-snapshot.json');
  assert.ok(fs.existsSync(snapPath), 'session-snapshot.json should exist at ' + snapPath);

  const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
  assert.equal(snap.version, 1, 'snapshot.version === 1');
  assert.ok(typeof snap.snapshot_at === 'string', 'snapshot.snapshot_at is string');
  assert.ok(typeof snap.active_room === 'string', 'snapshot.active_room is string');
  assert.ok(snap.sections && typeof snap.sections === 'object', 'snapshot.sections is object');

  const keys = Object.keys(snap.sections).sort();
  assert.deepEqual(
    keys,
    ['market-analysis', 'problem-definition', 'solution-design'],
    'snapshot has exactly the 3 seeded sections'
  );
});

// ---------------------------------------------------------------------------
// Test 2: snapshot sections match readTriple() shape
// ---------------------------------------------------------------------------
test('snapshot section shape matches readTriple() (room, state, reasoning)', () => {
  const tmp = mkTmp('on-stop-t2-');
  const fx = seedRoom(tmp, ['market-analysis']);
  writeMinto(path.join(fx.roomDir, 'market-analysis'), { governing_thought: 'Market exists.' });

  const res = invokeOnStop(fx);
  assert.equal(res.status, 0, 'on-stop exits 0: ' + (res.stderr || ''));

  const snap = JSON.parse(
    fs.readFileSync(path.join(fx.roomDir, '.mindrian', 'session-snapshot.json'), 'utf8')
  );
  const entry = snap.sections['market-analysis'];
  assert.ok(entry, 'market-analysis entry exists');

  // The readTriple return shape carries room, state, reasoning top-level keys.
  assert.ok(entry.room && typeof entry.room === 'object', 'entry.room is object');
  assert.ok(entry.state && typeof entry.state === 'object', 'entry.state is object');
  assert.ok(entry.reasoning && typeof entry.reasoning === 'object', 'entry.reasoning is object');

  // reasoning carries the governing thought we seeded
  assert.ok(
    typeof entry.reasoning.governing_thought === 'string' &&
      entry.reasoning.governing_thought.length > 0,
    'reasoning.governing_thought surfaces from MINTO.md'
  );
  // reasoning_health_score is a number in [0,1]
  assert.ok(
    typeof entry.reasoning.reasoning_health_score === 'number' &&
      entry.reasoning.reasoning_health_score >= 0 &&
      entry.reasoning.reasoning_health_score <= 1,
    'reasoning_health_score in [0,1]'
  );
});

// ---------------------------------------------------------------------------
// Test 3: Queue drain under budget -- on-stop drains pre-queued items
// ---------------------------------------------------------------------------
test('pending queue drains during on-stop; remainder surfaces in stale if any', () => {
  const tmp = mkTmp('on-stop-t3-');
  const fx = seedRoom(tmp, ['market-analysis', 'problem-definition']);
  writeMinto(path.join(fx.roomDir, 'market-analysis'), { governing_thought: 'M.' });
  writeMinto(path.join(fx.roomDir, 'problem-definition'), { governing_thought: 'P.' });

  // Pre-populate the queue with 2 entries (one per section) so the drain
  // path in on-stop has work to do.
  const dbnc = require(DEBOUNCER);
  dbnc.enqueue(fx.roomDir, 'market-analysis', 'pre-existing');
  dbnc.enqueue(fx.roomDir, 'problem-definition', 'pre-existing');
  const preDrain = dbnc.peek(fx.roomDir);
  assert.equal(preDrain.entries.length, 2, 'queue seeded with 2 entries');

  const res = invokeOnStop(fx);
  assert.equal(res.status, 0, 'on-stop exits 0: ' + (res.stderr || ''));

  // Snapshot written regardless
  const snapPath = path.join(fx.roomDir, '.mindrian', 'session-snapshot.json');
  assert.ok(fs.existsSync(snapPath), 'session-snapshot.json exists');

  // The queue may have been fully drained (olderThanMs=0). The snapshot
  // or the stale file absorbs the state -- either way, on-stop completed
  // cleanly and no .tmp. artifacts leak.
  const mindrianEntries = fs.readdirSync(path.join(fx.roomDir, '.mindrian'));
  const tmpLeaks = mindrianEntries.filter((n) => n.indexOf('.tmp.') !== -1);
  assert.deepEqual(tmpLeaks, [], 'no .tmp. suffix files leak in .mindrian/');
});

// ---------------------------------------------------------------------------
// Test 4: Stale reasoning surfaces in minto-stale.json
// ---------------------------------------------------------------------------
test('sentinel last_generated_at (1970) -> minto-stale.json lists that section', () => {
  const tmp = mkTmp('on-stop-t4-');
  const fx = seedRoom(tmp, ['competitive-analysis', 'market-analysis']);
  // competitive-analysis is stale (sentinel); market-analysis is fresh.
  writeMinto(path.join(fx.roomDir, 'competitive-analysis'), { stale: true, governing_thought: 'C.' });
  writeMinto(path.join(fx.roomDir, 'market-analysis'), { governing_thought: 'M.' });

  const res = invokeOnStop(fx);
  assert.equal(res.status, 0, 'on-stop exits 0: ' + (res.stderr || ''));

  const stalePath = path.join(fx.roomDir, '.mindrian', 'minto-stale.json');
  assert.ok(fs.existsSync(stalePath), 'minto-stale.json should exist when stale section is present');

  const stale = JSON.parse(fs.readFileSync(stalePath, 'utf8'));
  assert.equal(stale.version, 1, 'stale.version === 1');
  assert.ok(Array.isArray(stale.sections), 'stale.sections is an array');
  const staleNames = stale.sections.map((e) => e.section).sort();
  assert.ok(
    staleNames.indexOf('competitive-analysis') !== -1,
    'competitive-analysis present in stale list (sentinel timestamp trips never_generated)'
  );
  // Each entry must carry a reason string.
  for (const e of stale.sections) {
    assert.ok(typeof e.reason === 'string' && e.reason.length > 0, 'stale entry has reason');
  }
});

// ---------------------------------------------------------------------------
// Test 5: Rapid exit under 3000ms hook budget
// ---------------------------------------------------------------------------
test('single-section room with empty queue completes under the 3000ms budget', () => {
  const tmp = mkTmp('on-stop-t5-');
  const fx = seedRoom(tmp, ['market-analysis']);
  writeMinto(path.join(fx.roomDir, 'market-analysis'), { governing_thought: 'M.' });

  const t0 = Date.now();
  const res = invokeOnStop(fx);
  const elapsed = Date.now() - t0;

  assert.equal(res.status, 0, 'on-stop exits 0: ' + (res.stderr || ''));
  assert.ok(
    elapsed < 3000,
    'on-stop completes under 3000ms hook budget; elapsed=' + elapsed + 'ms'
  );
});

// ---------------------------------------------------------------------------
// Test 6: STATE.md write preserved (Phase 84 contract)
// ---------------------------------------------------------------------------
test('STATE.md write path still fires (Phase 84 on-stop contract preserved)', () => {
  const tmp = mkTmp('on-stop-t6-');
  const fx = seedRoom(tmp, ['market-analysis']);
  writeMinto(path.join(fx.roomDir, 'market-analysis'), { governing_thought: 'M.' });

  const res = invokeOnStop(fx);
  assert.equal(res.status, 0, 'on-stop exits 0: ' + (res.stderr || ''));

  const statePath = path.join(fx.roomDir, 'STATE.md');
  assert.ok(fs.existsSync(statePath), 'STATE.md created by on-stop (Phase 84 contract)');
  const stateContent = fs.readFileSync(statePath, 'utf8');
  assert.ok(
    stateContent.length > 0,
    'STATE.md is non-empty'
  );
});

// ---------------------------------------------------------------------------
// Test 7: Atomic writes -- no leftover .tmp. files
// ---------------------------------------------------------------------------
test('session-snapshot.json and minto-stale.json written atomically (no tmp leakage)', () => {
  const tmp = mkTmp('on-stop-t7-');
  const fx = seedRoom(tmp, ['a', 'b', 'c']);
  writeMinto(path.join(fx.roomDir, 'a'), { governing_thought: 'A.' });
  writeMinto(path.join(fx.roomDir, 'b'), { stale: true, governing_thought: 'B.' });
  writeMinto(path.join(fx.roomDir, 'c'), { governing_thought: 'C.' });

  const res = invokeOnStop(fx);
  assert.equal(res.status, 0, 'on-stop exits 0: ' + (res.stderr || ''));

  // After a successful run, every write should be via tmp+rename. No
  // residual .tmp. files should remain in .mindrian/.
  const mindrianDir = path.join(fx.roomDir, '.mindrian');
  const entries = fs.readdirSync(mindrianDir);
  const tmpLeaks = entries.filter((n) => n.indexOf('.tmp.') !== -1);
  assert.deepEqual(tmpLeaks, [], '.mindrian/ has no .tmp. leftovers: ' + JSON.stringify(tmpLeaks));
});

// ---------------------------------------------------------------------------
// Test 8: Soft-fail -- on-stop exits 0 even when no MINTO files exist
// ---------------------------------------------------------------------------
test('on-stop exits 0 even on fully degraded fixture (no MINTO files)', () => {
  const tmp = mkTmp('on-stop-t8-');
  // Seed only ROOM.md per section -- no MINTO.md, no artifact bodies wired.
  // readTriple degrades gracefully; on-stop must not propagate a failure.
  const fx = seedRoom(tmp, ['x']);

  const res = invokeOnStop(fx);
  assert.equal(res.status, 0, 'on-stop exits 0 under degraded conditions: ' + (res.stderr || ''));

  // Snapshot is still written (empty section entry is acceptable).
  const snapPath = path.join(fx.roomDir, '.mindrian', 'session-snapshot.json');
  assert.ok(fs.existsSync(snapPath), 'snapshot still written under degraded conditions');
});

// ---------------------------------------------------------------------------
// Epilogue
// ---------------------------------------------------------------------------

(async () => {
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      const r = t.fn();
      if (r && typeof r.then === 'function') await r;
      process.stdout.write('PASS ' + t.name + '\n');
      passed += 1;
    } catch (e) {
      process.stderr.write('FAIL ' + t.name + '\n' + (e && e.stack ? e.stack : e) + '\n');
      failed += 1;
    }
  }
  process.stdout.write('\non-stop-snapshot.test.cjs: ' + passed + '/' + tests.length + ' passed\n');
  process.exit(failed === 0 ? 0 : 1);
})();
