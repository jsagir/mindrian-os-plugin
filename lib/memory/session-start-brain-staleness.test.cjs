#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 90-03 Task 2 -- session-start BRAIN staleness injection tests
 * ====================================================================
 * Integration tests that spawn real bash scripts/session-start with
 * BRAIN.md fixtures, verifying that:
 *   - Brain annotations surface in TRIPLE_CONTEXT per section
 *   - Stale sections enqueue for regen (brain-derivation-queue.json)
 *   - Brain-offline suppresses enqueue (hold for when back online)
 *   - BRAIN_STALENESS_SKIP=1 restores pre-90-03 byte-identical output
 *
 * Harness: mirrors lib/memory/session-start-triple-injection.test.cjs.
 * We seed a MindrianRooms fixture via MINDRIAN_ROOMS_HOME env + basename
 * match, spawn bash session-start, and parse additionalContext.
 *
 * Brain-client availability is controlled via MINDRIAN_BRAIN_KEY env:
 *   - unset -> brain-client.isAvailable() === false (offline)
 *   - set to any non-empty string -> isAvailable() === true
 * (See lib/core/brain-client.cjs lines 121-155 for the contract.)
 *
 * Pure Node built-ins. Three-surface: same hook fires on CLI, Desktop
 * MCP lifecycle emits equivalent.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SESSION_START = path.join(REPO_ROOT, 'scripts', 'session-start');

// ---------- Tmp workspace helpers ----------

const TMPDIRS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMPDIRS.push(d);
  return d;
}
process.on('exit', function () {
  for (const d of TMPDIRS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
});

function sha256Hex(s) {
  return 'sha256:' + crypto.createHash('sha256')
    .update(String(s == null ? '' : s).normalize('NFC'))
    .digest('hex');
}

/**
 * Seed a Strategy-0b compatible MindrianRooms fixture.
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
  }
  return { roomDir, roomsHome, workDir };
}

function writeMinto(sectionDir, governingThought) {
  const now = new Date().toISOString();
  const body = [
    '---',
    'schema_version: 88',
    'governing_thought: "' + governingThought + '"',
    'last_generated_at: "' + now + '"',
    'last_artifact_write_seen_at: "' + now + '"',
    'reasoning_health_score: 0.75',
    'flagged_weaknesses: []',
    'decision_log: []',
    '---',
    '',
    '# Governing Thought',
    '',
    governingThought,
    '',
    '# Claim 1',
    '',
    'Supporting claim.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(sectionDir, 'MINTO.md'), body);
}

function writeBrainMd(sectionDir, opts) {
  opts = opts || {};
  const gt = opts.governing_thought == null ? 'default governing thought' : opts.governing_thought;
  const gtHash = opts.governing_thought_hash != null ? opts.governing_thought_hash : sha256Hex(gt);
  const now = opts.brain_generated_at != null ? opts.brain_generated_at : new Date().toISOString();
  const bgv = opts.brain_graph_version != null ? opts.brain_graph_version : 1;
  const staleness = opts.staleness || 'fresh';
  const section = opts.section || path.basename(sectionDir);
  const body = [
    '---',
    'section: ' + section,
    'brain_generated_at: "' + now + '"',
    'brain_graph_version: ' + bgv,
    'governing_thought_hash: "' + gtHash + '"',
    'staleness: ' + staleness,
    'author: brain',
    '---',
    '',
    '## Pattern Matches',
    '',
    '(no signal)',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(sectionDir, 'BRAIN.md'), body);
}

function invokeSessionStart(fx, extraEnv) {
  // Override HOME to a harmless path so brain-client.getApiKey() does NOT
  // find a real ~/.mindrian.env file and leak availability into the test.
  // (getApiKey falls back to <HOME>/.mindrian.env; pointing HOME at a tmp
  // dir guarantees that fallback is empty.)
  const safeHome = path.join(fx.workDir, '_home');
  try { fs.mkdirSync(safeHome, { recursive: true }); } catch (_e) {}
  const env = Object.assign({}, process.env, {
    PWD: fx.workDir,
    HOME: safeHome,
    MINDRIAN_ROOMS_HOME: fx.roomsHome,
    MINDRIAN_ROOMS_ROOT: fx.roomsHome,
    CLAUDE_PLUGIN_ROOT: REPO_ROOT,
    SESSION_START_NODE_PREFLIGHT_SKIP: '1',
  }, extraEnv || {});
  // Explicit handling: if caller set empty string, remove from env so
  // process.env.MINDRIAN_BRAIN_KEY is undefined (not "") in the spawned
  // node subprocess. Node treats empty-string env vars as defined.
  if (env.MINDRIAN_BRAIN_KEY === '') delete env.MINDRIAN_BRAIN_KEY;
  return spawnSync('bash', [SESSION_START], {
    cwd: fx.workDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 15000,
  });
}

function extractAdditionalContext(stdout) {
  const raw = String(stdout || '');
  let m = /"additionalContext":\s*"([\s\S]*?)(?<!\\)"/m.exec(raw);
  if (m) return m[1];
  m = /"additional_context":\s*"([\s\S]*?)(?<!\\)"/m.exec(raw);
  if (m) return m[1];
  return '';
}

// ---------- Test runner ----------

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ---------------------------------------------------------------------------
// Test 1: Mixed fixture -- 1 fresh, 1 stale (hash mismatch), 1 absent.
//   With Brain online, session-start produces TRIPLE_CONTEXT containing
//   Brain annotation lines for fresh + stale (absent suppressed when no
//   BRAIN.md exists for that section; or explicit "absent" line).
// ---------------------------------------------------------------------------
test('Test 1: 3-section mix (fresh / stale / absent) -> Brain annotations in TRIPLE_CONTEXT', () => {
  const tmp = mkTmp('ss-90-03-t1-');
  const fx = seedRoom(tmp, ['market-analysis', 'problem-definition', 'business-model']);

  // market-analysis: fresh MINTO + fresh BRAIN (hash match, recent)
  writeMinto(path.join(fx.roomDir, 'market-analysis'), 'TAM analysis stable');
  writeBrainMd(path.join(fx.roomDir, 'market-analysis'), {
    governing_thought: 'TAM analysis stable',
    brain_graph_version: 1,
    brain_generated_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  });

  // problem-definition: stale BRAIN (hash mismatch -- MINTO changed)
  writeMinto(path.join(fx.roomDir, 'problem-definition'), 'NEW problem framing');
  writeBrainMd(path.join(fx.roomDir, 'problem-definition'), {
    governing_thought: 'OLD problem framing',
    brain_graph_version: 1,
    brain_generated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  });

  // business-model: MINTO exists, no BRAIN.md
  writeMinto(path.join(fx.roomDir, 'business-model'), 'subscription model');

  // Simulate Brain online (any non-empty API key).
  const res = invokeSessionStart(fx, { MINDRIAN_BRAIN_KEY: 'test-key-online' });
  assert.equal(res.status, 0, 'session-start exits 0: ' + (res.stderr || ''));

  const ctx = extractAdditionalContext(String(res.stdout));
  assert.ok(ctx.length > 0, 'additional_context non-empty');
  assert.ok(ctx.indexOf('ACTIVE ROOM MEMORY') !== -1, 'TRIPLE_CONTEXT header present');
  // Fresh annotation
  assert.ok(
    /Brain derivation: fresh/.test(ctx),
    'at least one "Brain derivation: fresh" line expected'
  );
  // Stale annotation with governing_thought changed reason
  assert.ok(
    /Brain derivation: stale.*governing_thought/.test(ctx),
    'stale (governing_thought changed) annotation present'
  );
});

// ---------------------------------------------------------------------------
// Test 2: Brain offline -- stale sections marked, NO enqueue fires.
// ---------------------------------------------------------------------------
test('Test 2: Brain offline -> stale annotations present, queue NOT populated', () => {
  const tmp = mkTmp('ss-90-03-t2-');
  const fx = seedRoom(tmp, ['market-analysis']);

  writeMinto(path.join(fx.roomDir, 'market-analysis'), 'NEW thought');
  writeBrainMd(path.join(fx.roomDir, 'market-analysis'), {
    governing_thought: 'OLD thought',
    brain_graph_version: 1,
    brain_generated_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  });

  // Brain offline: remove any API key env.
  const res = invokeSessionStart(fx, { MINDRIAN_BRAIN_KEY: '' });
  assert.equal(res.status, 0, 'session-start exits 0: ' + (res.stderr || ''));
  const ctx = extractAdditionalContext(String(res.stdout));

  // Stale annotation should surface even when offline.
  assert.ok(
    /Brain derivation: stale/.test(ctx),
    'stale annotation present even offline'
  );

  // Queue file should either not exist OR have zero entries (Brain offline
  // -> recommended_action=enqueue_when_brain_online -> enqueue skipped).
  const queuePath = path.join(fx.roomDir, '.mindrian', 'brain-derivation-queue.json');
  if (fs.existsSync(queuePath)) {
    const q = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
    assert.equal(q.entries.length, 0,
      'Brain offline -> queue must stay empty (got ' + q.entries.length + ' entries)');
  }
});

// ---------------------------------------------------------------------------
// Test 3: Brain online + stale -> enqueue fires; wall-clock < 5000ms.
// ---------------------------------------------------------------------------
test('Test 3: Brain online + stale -> enqueue lands, session-start < 5000ms', () => {
  const tmp = mkTmp('ss-90-03-t3-');
  const fx = seedRoom(tmp, ['market-analysis']);

  writeMinto(path.join(fx.roomDir, 'market-analysis'), 'NEW thought');
  writeBrainMd(path.join(fx.roomDir, 'market-analysis'), {
    governing_thought: 'OLD thought',
    brain_graph_version: 1,
    brain_generated_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  });

  // Warm up node cold start (WSL2 fs).
  invokeSessionStart(fx, { MINDRIAN_BRAIN_KEY: 'warmup' });

  // Clear any enqueue from warmup.
  const queuePath = path.join(fx.roomDir, '.mindrian', 'brain-derivation-queue.json');
  if (fs.existsSync(queuePath)) {
    fs.writeFileSync(queuePath, JSON.stringify({ version: 1, entries: [] }));
  }

  const t0 = Date.now();
  const res = invokeSessionStart(fx, { MINDRIAN_BRAIN_KEY: 'test-key-online' });
  const elapsed = Date.now() - t0;
  assert.equal(res.status, 0, 'exit 0');
  assert.ok(elapsed < 5000, 'session-start wall-clock ' + elapsed + 'ms (ceiling 5000)');

  // Queue should have the stale section enqueued.
  assert.ok(fs.existsSync(queuePath), 'queue file should exist after Brain-online run');
  const q = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  assert.ok(q.entries.length >= 1, 'queue should have at least one entry (got ' + q.entries.length + ')');
  const sections = q.entries.map(function (e) { return e.section; });
  assert.ok(sections.indexOf('market-analysis') !== -1, 'market-analysis section enqueued');
});

// ---------------------------------------------------------------------------
// Test 4: BRAIN_STALENESS_SKIP=1 feature flag -> Brain annotations suppressed.
// ---------------------------------------------------------------------------
test('Test 4: BRAIN_STALENESS_SKIP=1 -> no Brain lines in TRIPLE_CONTEXT', () => {
  const tmp = mkTmp('ss-90-03-t4-');
  const fx = seedRoom(tmp, ['market-analysis']);

  writeMinto(path.join(fx.roomDir, 'market-analysis'), 'Active thought');
  writeBrainMd(path.join(fx.roomDir, 'market-analysis'), {
    governing_thought: 'Active thought',
    brain_graph_version: 1,
    brain_generated_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  });

  const res = invokeSessionStart(fx, {
    MINDRIAN_BRAIN_KEY: 'test-key-online',
    BRAIN_STALENESS_SKIP: '1',
  });
  assert.equal(res.status, 0, 'exit 0');
  const ctx = extractAdditionalContext(String(res.stdout));
  assert.ok(ctx.indexOf('ACTIVE ROOM MEMORY') !== -1, 'TRIPLE_CONTEXT still emitted');
  assert.ok(
    ctx.indexOf('Brain derivation:') === -1,
    'Brain derivation lines SUPPRESSED when BRAIN_STALENESS_SKIP=1'
  );
});

// ---------------------------------------------------------------------------
// Test 5: Backward-compat -- room with NO BRAIN.md files anywhere does not
// emit "Brain derivation: absent" lines (keeps output byte-stable for
// rooms that have never run a derivation).
// ---------------------------------------------------------------------------
test('Test 5: No BRAIN.md anywhere -> no "Brain derivation" lines (backward-compat)', () => {
  const tmp = mkTmp('ss-90-03-t5-');
  const fx = seedRoom(tmp, ['market-analysis', 'problem-definition']);
  writeMinto(path.join(fx.roomDir, 'market-analysis'), 'Thought 1');
  writeMinto(path.join(fx.roomDir, 'problem-definition'), 'Thought 2');
  // NO BRAIN.md files.

  const res = invokeSessionStart(fx, { MINDRIAN_BRAIN_KEY: 'test-key-online' });
  assert.equal(res.status, 0, 'exit 0');
  const ctx = extractAdditionalContext(String(res.stdout));
  assert.ok(ctx.indexOf('ACTIVE ROOM MEMORY') !== -1, 'TRIPLE_CONTEXT emitted');
  assert.ok(
    ctx.indexOf('Brain derivation:') === -1,
    'no Brain lines when room has zero BRAIN.md (backward-compat)'
  );
});

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

for (const t of tests) {
  try {
    t.fn();
    passed++;
    process.stdout.write('  pass: ' + t.name + '\n');
  } catch (err) {
    failed++;
    process.stderr.write('  FAIL: ' + t.name + '\n');
    process.stderr.write('        ' + (err && err.stack ? err.stack : err) + '\n');
  }
}

process.stdout.write('\nsession-start-brain-staleness: ' + passed + '/' + (passed + failed) + ' passed\n');
if (failed > 0) process.exit(1);
