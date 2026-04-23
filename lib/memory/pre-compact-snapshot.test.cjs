#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-08 -- pre-compact triple snapshot tests
 * =================================================
 * Wires the PreCompact close-out triple snapshot. On every PreCompact
 * hook fire (before Claude compresses conversation context), the
 * extended pre-compact script must:
 *
 *   1. Preserve the Phase 83/84 pre-compact-state.json behavior
 *      byte-for-byte (the legacy $HOME/.mindrian/bridge/ path is
 *      untouched).
 *   2. Walk sections and call folder-memory.readTriple() to capture
 *      the per-section memory triple signal.
 *   3. Write .mindrian/pre-compact-snapshot.json atomically (tmp +
 *      rename) with kind:"pre-compact" marker (distinguishing it from
 *      88-06's kind-less session-snapshot.json; 88-09 post-compact
 *      reads kind to route to the correct consumer).
 *   4. Enforce a timing budget inside the 2000ms PreCompact hook
 *      timeout: MAX_SECTIONS=20 + MAX_MS=1800 wall-clock budget with
 *      truncation when exceeded.
 *   5. Truncation: weakest-first ordering (same algorithm as 88-07
 *      session-start formatter) so the most-informative sections
 *      survive budget pressure. truncated:true + truncated_count:N.
 *   6. Soft-fail on every error path (exit 0 always).
 *   7. Total wall-clock < 2000ms even for 25-section rooms.
 *
 * Test map (8 tests, one per PLAN <behavior> case):
 *
 *   Test 1: Pre-compact on a 3-section room -> .mindrian/
 *           pre-compact-snapshot.json written with all 3 sections.
 *   Test 2: snapshot.kind === "pre-compact" (distinguishes from
 *           session-snapshot.json which has no kind field).
 *   Test 3: 25-section room -> snapshot writes first 20 sections,
 *           sets truncated:true + truncated_count:5. Wall-clock <
 *           2000ms.
 *   Test 4: Truncation ordering: weakest reasoning_health_score first
 *           (null / very-low scores preserved; high scores elided
 *           first under budget pressure).
 *   Test 5: Atomic write semantics: no .tmp.* leftovers in .mindrian/
 *           after successful run (proves tmp+rename + final cleanup).
 *   Test 6: Empty room (no sections with ROOM.md) -> snapshot written
 *           with sections:{}, truncated:false, truncated_count:0. No
 *           error.
 *   Test 7: Hook exits 0 on degraded environment (no MINTO files, no
 *           folder-memory, etc) -- soft-fail contract.
 *   Test 8: 20-section room total wall-clock < 1800ms (inside the
 *           2000ms hook budget with slack for Claude's own PreCompact
 *           teardown).
 *
 * Test harness: spawnSync bash on scripts/pre-compact with a tmpdir
 * seeded as a room via MINDRIAN_ROOMS_HOME (Strategy 0b). Mirrors the
 * 88-06 on-stop-snapshot.test.cjs harness contract.
 *
 * BSL 1.1. Zero npm deps. Node built-ins only. Three-surface by
 * construction (CLI PreCompact hook fires; Desktop MCP emits
 * equivalent via server lifecycle; Cowork shares .mindrian/).
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PRE_COMPACT = path.join(REPO_ROOT, 'scripts', 'pre-compact');

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
 * Seed a room fixture that resolve-room finds via Strategy 0b (MINDRIAN_
 * ROOMS_HOME dir scan). Mirrors the 88-06 test harness.
 *
 * @param {string} tmp       parent tmpdir created by mkTmp
 * @param {string[]} sections section names to create ROOM.md + placeholder artifact in
 * @returns {{roomDir,roomsHome,workDir}}
 */
function seedRoom(tmp, sections) {
  const roomsHome = path.join(tmp, 'rooms-home');
  const roomBase = 'venture';
  const roomDir = path.join(roomsHome, roomBase);
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });

  const workDir = path.join(tmp, 'work', roomBase);
  fs.mkdirSync(workDir, { recursive: true });

  for (const s of sections) {
    const dir = path.join(roomDir, s);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'ROOM.md'),
      '# ' + s + '\n\nIdentity text for ' + s + '.\n'
    );
    fs.writeFileSync(
      path.join(dir, 'artifact-01.md'),
      '# ' + s + ' artifact 01\n\nBody.\n'
    );
  }
  return { roomDir, roomsHome, workDir };
}

/**
 * Write a MINTO.md with a specific reasoning_health_score so the
 * truncation ordering test (Test 4) can assert weakest-first behavior.
 * The health score is the sort key in 88-07 formatter and 88-08 pre-
 * compact truncation (shared contract).
 *
 * @param {string} sectionDir absolute path to section dir
 * @param {object} opts { score?: number|null, stale?: boolean, governing_thought?: string }
 */
function writeMinto(sectionDir, opts) {
  opts = opts || {};
  const stale = opts.stale === true;
  const last = stale ? '1970-01-01T00:00:00Z' : new Date().toISOString();
  const gt = opts.governing_thought || 'Governing thought placeholder.';
  const score = typeof opts.score === 'number' ? opts.score : 0.75;
  const frontmatter = [
    '---',
    'schema_version: 88',
    'governing_thought: "' + gt + '"',
    'last_generated_at: "' + last + '"',
    'last_artifact_write_seen_at: "' + last + '"',
    'reasoning_health_score: ' + score,
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
 * Invoke scripts/pre-compact in the fixture. Returns the spawnSync result.
 *
 * @param {object} fixture  shape from seedRoom: { roomDir, roomsHome, workDir }
 * @param {object} [extraEnv]
 */
function invokePreCompact(fixture, extraEnv) {
  const env = Object.assign({}, process.env, {
    PWD: fixture.workDir,
    MINDRIAN_ROOMS_HOME: fixture.roomsHome,
    CLAUDE_PLUGIN_ROOT: REPO_ROOT,
  }, extraEnv || {});
  return spawnSync('bash', [PRE_COMPACT], {
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
test('3-section room -> pre-compact-snapshot.json has 3 section entries', () => {
  const tmp = mkTmp('pre-compact-t1-');
  const fx = seedRoom(tmp, ['market-analysis', 'problem-definition', 'solution-design']);
  writeMinto(path.join(fx.roomDir, 'market-analysis'), { governing_thought: 'TAM bottom-up.' });
  writeMinto(path.join(fx.roomDir, 'problem-definition'), { governing_thought: 'Problem bounded.' });
  writeMinto(path.join(fx.roomDir, 'solution-design'), { governing_thought: 'Solution viable.' });

  const res = invokePreCompact(fx);
  assert.equal(res.status, 0, 'pre-compact should exit 0: stderr=' + (res.stderr || ''));

  const snapPath = path.join(fx.roomDir, '.mindrian', 'pre-compact-snapshot.json');
  assert.ok(fs.existsSync(snapPath), 'pre-compact-snapshot.json should exist at ' + snapPath);

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

  // Each entry carries the readTriple() shape (same as 88-06 contract).
  for (const k of keys) {
    const e = snap.sections[k];
    assert.ok(e.room && typeof e.room === 'object', k + '.room is object');
    assert.ok(e.state && typeof e.state === 'object', k + '.state is object');
    assert.ok(e.reasoning && typeof e.reasoning === 'object', k + '.reasoning is object');
  }
});

// ---------------------------------------------------------------------------
// Test 2: kind:"pre-compact" marker distinguishes from session-snapshot.json
// ---------------------------------------------------------------------------
test('snapshot.kind === "pre-compact" (distinguishes from session-snapshot.json)', () => {
  const tmp = mkTmp('pre-compact-t2-');
  const fx = seedRoom(tmp, ['market-analysis']);
  writeMinto(path.join(fx.roomDir, 'market-analysis'), { governing_thought: 'M.' });

  const res = invokePreCompact(fx);
  assert.equal(res.status, 0, 'pre-compact exits 0: ' + (res.stderr || ''));

  const snapPath = path.join(fx.roomDir, '.mindrian', 'pre-compact-snapshot.json');
  assert.ok(fs.existsSync(snapPath), 'pre-compact-snapshot.json exists');

  const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
  assert.equal(
    snap.kind,
    'pre-compact',
    'snapshot.kind === "pre-compact" (88-09 reader routes on this field)'
  );
  // truncated fields are present even when no truncation happened
  assert.equal(snap.truncated, false, 'truncated:false for small room');
  assert.equal(snap.truncated_count, 0, 'truncated_count:0 for small room');
});

// ---------------------------------------------------------------------------
// Test 3: 25-section room truncates to 20 sections with truncated:true
// ---------------------------------------------------------------------------
test('25-section room -> snapshot has 20 sections + truncated:true + truncated_count:5', () => {
  const tmp = mkTmp('pre-compact-t3-');
  const sections = [];
  for (let i = 0; i < 25; i += 1) {
    sections.push('section-' + String(i).padStart(2, '0'));
  }
  const fx = seedRoom(tmp, sections);
  // Seed MINTO for every section with varying health scores so truncation
  // has a deterministic sort order (see Test 4 for the ordering assertion).
  sections.forEach((s, i) => {
    writeMinto(path.join(fx.roomDir, s), {
      score: (i + 1) / 30, // 0.033 .. 0.833, all distinct, ascending with index
      governing_thought: 'GT for ' + s,
    });
  });

  const t0 = Date.now();
  const res = invokePreCompact(fx);
  const elapsed = Date.now() - t0;

  assert.equal(res.status, 0, 'pre-compact exits 0: ' + (res.stderr || ''));
  assert.ok(
    elapsed < 2000,
    '25-section room wall-clock under 2000ms hook budget; elapsed=' + elapsed + 'ms'
  );

  const snapPath = path.join(fx.roomDir, '.mindrian', 'pre-compact-snapshot.json');
  const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));

  assert.equal(
    Object.keys(snap.sections).length,
    20,
    'snapshot preserves exactly MAX_SECTIONS=20 entries'
  );
  assert.equal(snap.truncated, true, 'truncated:true when count > MAX_SECTIONS');
  assert.equal(
    snap.truncated_count,
    5,
    'truncated_count === sections - emitted (25 - 20 = 5)'
  );
});

// ---------------------------------------------------------------------------
// Test 4: Truncation ordering -- weakest (lowest health score) preserved
// ---------------------------------------------------------------------------
test('truncation ordering: weakest reasoning_health_score sections survive (same as 88-07 formatter)', () => {
  const tmp = mkTmp('pre-compact-t4-');
  // 22 sections so truncation drops exactly 2. The 2 HIGHEST scores (0.95, 0.99)
  // must be elided; the 20 with lower scores must survive. null-score
  // (if present) would sort first (weakest-most) per 88-07 contract.
  const sections = [];
  for (let i = 0; i < 22; i += 1) {
    sections.push('section-' + String(i).padStart(2, '0'));
  }
  const fx = seedRoom(tmp, sections);

  // Sections 0..19 get low/varying scores (0.01 .. 0.80). Sections 20, 21
  // get the HIGHEST scores so they should be the ones dropped.
  sections.forEach((s, i) => {
    let score;
    if (i === 20) score = 0.95;
    else if (i === 21) score = 0.99;
    else score = 0.01 + i * 0.04; // 0.01, 0.05, 0.09, ... 0.77
    writeMinto(path.join(fx.roomDir, s), { score, governing_thought: 'GT ' + s });
  });

  const res = invokePreCompact(fx);
  assert.equal(res.status, 0, 'pre-compact exits 0: ' + (res.stderr || ''));

  const snapPath = path.join(fx.roomDir, '.mindrian', 'pre-compact-snapshot.json');
  const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));

  assert.equal(Object.keys(snap.sections).length, 20, '20 sections preserved');
  assert.equal(snap.truncated, true, 'truncated:true');
  assert.equal(snap.truncated_count, 2, 'exactly 2 sections elided');

  // The two highest-score sections (section-20, section-21) MUST NOT be in snapshot.
  assert.ok(
    !Object.prototype.hasOwnProperty.call(snap.sections, 'section-20'),
    'section-20 (score=0.95) elided (highest survivors policy)'
  );
  assert.ok(
    !Object.prototype.hasOwnProperty.call(snap.sections, 'section-21'),
    'section-21 (score=0.99) elided (highest survivors policy)'
  );
  // At least one low-scored section (e.g. section-00, score=0.01) MUST survive.
  assert.ok(
    Object.prototype.hasOwnProperty.call(snap.sections, 'section-00'),
    'section-00 (score=0.01) survives (weakest-first preserves pedagogical priority)'
  );
});

// ---------------------------------------------------------------------------
// Test 5: Atomic writes -- no leftover .tmp.* files in .mindrian/
// ---------------------------------------------------------------------------
test('atomic tmp+rename: no .tmp. leftovers in .mindrian/ after successful pre-compact', () => {
  const tmp = mkTmp('pre-compact-t5-');
  const fx = seedRoom(tmp, ['a', 'b', 'c']);
  writeMinto(path.join(fx.roomDir, 'a'), { governing_thought: 'A.' });
  writeMinto(path.join(fx.roomDir, 'b'), { governing_thought: 'B.' });
  writeMinto(path.join(fx.roomDir, 'c'), { governing_thought: 'C.' });

  const res = invokePreCompact(fx);
  assert.equal(res.status, 0, 'pre-compact exits 0: ' + (res.stderr || ''));

  // After a successful run, every write should be via tmp+rename. No
  // residual .tmp. files should remain in .mindrian/.
  const mindrianDir = path.join(fx.roomDir, '.mindrian');
  const entries = fs.readdirSync(mindrianDir);
  const tmpLeaks = entries.filter((n) => n.indexOf('.tmp.') !== -1);
  assert.deepEqual(
    tmpLeaks,
    [],
    '.mindrian/ has no .tmp. leftovers: ' + JSON.stringify(tmpLeaks)
  );

  // Snapshot itself is present (proves the atomic path completed).
  assert.ok(
    entries.indexOf('pre-compact-snapshot.json') !== -1,
    'pre-compact-snapshot.json present after tmp+rename cycle'
  );
});

// ---------------------------------------------------------------------------
// Test 6: Empty room -> snapshot with sections:{} and no error
// ---------------------------------------------------------------------------
test('empty room (no sections with ROOM.md) -> snapshot with sections:{}, no error', () => {
  const tmp = mkTmp('pre-compact-t6-');
  // seedRoom with zero sections -- only ROOM-less .mindrian/ + .room-root
  const fx = seedRoom(tmp, []);
  // Add a .hidden directory and a non-section directory without ROOM.md
  // to prove the filter (only sections with ROOM.md are captured).
  fs.mkdirSync(path.join(fx.roomDir, '.git'), { recursive: true });
  fs.mkdirSync(path.join(fx.roomDir, 'random-no-room'), { recursive: true });
  fs.writeFileSync(path.join(fx.roomDir, 'random-no-room', 'notes.md'), 'body');

  const res = invokePreCompact(fx);
  assert.equal(res.status, 0, 'pre-compact exits 0 on empty room: ' + (res.stderr || ''));

  const snapPath = path.join(fx.roomDir, '.mindrian', 'pre-compact-snapshot.json');
  assert.ok(fs.existsSync(snapPath), 'pre-compact-snapshot.json exists even for empty room');

  const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
  assert.equal(snap.version, 1, 'snapshot.version === 1');
  assert.equal(snap.kind, 'pre-compact', 'snapshot.kind === "pre-compact"');
  assert.deepEqual(snap.sections, {}, 'sections is empty object');
  assert.equal(snap.truncated, false, 'truncated:false for empty room');
  assert.equal(snap.truncated_count, 0, 'truncated_count:0 for empty room');
});

// ---------------------------------------------------------------------------
// Test 7: Soft-fail -- pre-compact exits 0 even on degraded fixture
// ---------------------------------------------------------------------------
test('soft-fail: pre-compact exits 0 even when sections have no MINTO.md', () => {
  const tmp = mkTmp('pre-compact-t7-');
  const fx = seedRoom(tmp, ['x', 'y']);
  // No MINTO.md -- readTriple returns exists:false reasoning with
  // is_stale:true, stale_reason:'never_generated'. Must not throw.

  const res = invokePreCompact(fx);
  assert.equal(
    res.status,
    0,
    'pre-compact exits 0 under degraded conditions: ' + (res.stderr || '')
  );

  const snapPath = path.join(fx.roomDir, '.mindrian', 'pre-compact-snapshot.json');
  assert.ok(
    fs.existsSync(snapPath),
    'snapshot still written under degraded conditions'
  );

  const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
  // Both sections are captured; their reasoning is the empty shell.
  assert.equal(Object.keys(snap.sections).sort().join(','), 'x,y', 'both sections captured');
  for (const k of Object.keys(snap.sections)) {
    assert.ok(
      snap.sections[k].reasoning,
      k + '.reasoning present even when MINTO.md missing'
    );
  }
});

// ---------------------------------------------------------------------------
// Test 8: 20-section wall-clock under 1800ms inside 2000ms hook budget
// ---------------------------------------------------------------------------
test('20-section room wall-clock < 1800ms (inside 2000ms PreCompact budget)', () => {
  const tmp = mkTmp('pre-compact-t8-');
  const sections = [];
  for (let i = 0; i < 20; i += 1) {
    sections.push('section-' + String(i).padStart(2, '0'));
  }
  const fx = seedRoom(tmp, sections);
  sections.forEach((s, i) => {
    writeMinto(path.join(fx.roomDir, s), {
      score: 0.1 + i * 0.04,
      governing_thought: 'GT ' + s,
    });
  });

  const t0 = Date.now();
  const res = invokePreCompact(fx);
  const elapsed = Date.now() - t0;

  assert.equal(res.status, 0, 'pre-compact exits 0: ' + (res.stderr || ''));

  // The full 2000ms hook budget must NOT be exceeded; 1800ms target
  // leaves 200ms slack for Claude's own PreCompact teardown. Under WSL2
  // fs contention the bash+node cold-start can eat ~500ms so we keep
  // the ceiling at 1800ms -- the acceptance criterion in the PLAN.
  assert.ok(
    elapsed < 1800,
    '20-section pre-compact wall-clock under 1800ms; elapsed=' + elapsed + 'ms'
  );

  // All 20 sections preserved, not truncated.
  const snapPath = path.join(fx.roomDir, '.mindrian', 'pre-compact-snapshot.json');
  const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
  assert.equal(Object.keys(snap.sections).length, 20, 'all 20 sections present');
  assert.equal(snap.truncated, false, 'truncated:false at exactly MAX_SECTIONS=20');
  assert.equal(snap.truncated_count, 0, 'truncated_count:0 at the ceiling');
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
  process.stdout.write(
    '\npre-compact-snapshot.test.cjs: ' + passed + '/' + tests.length + ' passed\n'
  );
  process.exit(failed === 0 ? 0 : 1);
})();
