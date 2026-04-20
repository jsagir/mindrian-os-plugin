#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-05 -- debouncer drain at UserPromptSubmit tests
 * =========================================================
 * Wires the background regen runner. On every UserPromptSubmit (which
 * fires on every user turn inside Claude Code), the debouncer drains
 * queue items older than 30s. This is the "lazy commit" that ensures
 * MINTO regen actually happens even if the user never triggers on-stop.
 *
 * Test map (7 tests, one per PLAN <behavior> case):
 *   Test 1: Queue has 3 items older than 30s -> drain returns all 3;
 *           .mindrian/pending-tier1-regen.json created with 3 entries.
 *   Test 2: Queue has 3 items all newer than 30s -> drain returns 0;
 *           queue unchanged; pending-tier1 file NOT created.
 *   Test 3: Queue has 5 items (2 old + 3 new) -> only 2 drained;
 *           queue retains 3; pending-tier1 file contains 2 entries.
 *   Test 4: Empty queue -> hook exits 0 without error;
 *           no pending-tier1-regen.json created.
 *   Test 5: Hook wall-clock stays bounded (< 1500ms) with 20-entry queue.
 *   Test 6: pending-tier1-regen.json is APPENDED on second drain
 *           (doesn't overwrite history).
 *   Test 7: Session-crash simulation -- queue file on disk survives,
 *           drain picks up the items on fresh hook invocation.
 *
 * Test harness: spawnSync bash on scripts/intent-classifier with a minimal
 * hook JSON on stdin. Each test owns its tmpdir + MINDRIAN_ROOMS_HOME
 * pointing into the tmpdir so resolve-room finds the room.
 *
 * Behavior under soft-fail: the hook MUST always exit 0. Even if the
 * debouncer is unreachable, the drain block fails silently and the
 * classifier continues its normal work.
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
const INTENT_CLASSIFIER = path.join(REPO_ROOT, 'scripts', 'intent-classifier');
const DEBOUNCER_CLI = path.join(REPO_ROOT, 'scripts', 'minto-debouncer.cjs');

const TMPDIRS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMPDIRS.push(d);
  return d;
}

// Kill any orphan background regen spawns so they don't linger between
// tests. Runs on process exit AND afterEach.
function killOrphanRegens() {
  try {
    spawnSync('bash', ['-c', 'pgrep -f vault-section-minto-generator | xargs -r kill -9 2>/dev/null || true'], {
      stdio: 'ignore',
    });
  } catch (_) { /* best-effort */ }
}

process.on('exit', () => {
  killOrphanRegens();
  for (const d of TMPDIRS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
});

/**
 * Build a minimal "MindrianRooms" fixture with one active room:
 *   <tmp>/MindrianRooms/
 *     .rooms/registry.json    (active: default, pointing at room/)
 *     default/
 *       .room-root              (sentinel so detect_room_section works)
 *       .mindrian/
 *         minto-queue.json      (optional seed queue)
 *       <section>/
 *         ROOM.md
 */
function seedRoomsHome(roomName, sections) {
  const home = mkTmp('drain-test-');
  const roomsHome = path.join(home, 'MindrianRooms');
  const roomsMeta = path.join(roomsHome, '.rooms');
  const roomDir = path.join(roomsHome, roomName);
  const mindrianDir = path.join(roomDir, '.mindrian');
  fs.mkdirSync(roomsMeta, { recursive: true });
  fs.mkdirSync(mindrianDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  const now = new Date().toISOString();
  const registry = {
    version: 1,
    active: roomName,
    rooms: {
      [roomName]: {
        path: roomName,
        created: now,
        last_opened: now,
        status: 'active',
        venture_name: 'Test Venture',
        venture_stage: 'Pre-Opportunity',
      },
    },
  };
  fs.writeFileSync(
    path.join(roomsMeta, 'registry.json'),
    JSON.stringify(registry, null, 2)
  );
  for (const sec of sections) {
    const secDir = path.join(roomDir, sec);
    fs.mkdirSync(secDir, { recursive: true });
    fs.writeFileSync(path.join(secDir, 'ROOM.md'), `# ${sec}\n`);
  }
  return { home, roomsHome, roomDir, mindrianDir };
}

function seedQueue(mindrianDir, entries) {
  const queue = { version: 1, entries };
  fs.writeFileSync(
    path.join(mindrianDir, 'minto-queue.json'),
    JSON.stringify(queue, null, 2)
  );
}

function isoAgo(secondsAgo) {
  return new Date(Date.now() - secondsAgo * 1000).toISOString();
}

/**
 * Invoke the intent-classifier bash wrapper.
 *
 * stdin: empty JSON envelope (the classifier is tolerant of empty/missing
 *   prompt; it will short-circuit the advisory-warning main() path, leaving
 *   only the Phase 88-05 drain block under test).
 *
 * env: MINDRIAN_ROOMS_HOME points at the fixture so resolve-room picks up
 *   the active room without relying on $HOME state.
 */
function invokeClassifier(roomsHome) {
  const env = Object.assign({}, process.env, {
    MINDRIAN_ROOMS_HOME: roomsHome,
    // Silence proactive-intelligence injection so test output is clean.
    MINDRIAN_COPILOT_INJECT_FINDINGS: '0',
  });
  return spawnSync('bash', [INTENT_CLASSIFIER], {
    input: '{}',
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

// --- runner ----------------------------------------------------------------

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

async function waitFor(predicate, maxMs, stepMs) {
  if (typeof maxMs !== 'number') maxMs = 2000;
  if (typeof stepMs !== 'number') stepMs = 25;
  const until = Date.now() + maxMs;
  while (Date.now() < until) {
    try { if (predicate()) return true; } catch (_) {}
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return false;
}

// ---------- Test 1: All old -> drained + pending-tier1 file populated ----
test('Test 1: 3 old items (>30s) drain; pending-tier1-regen.json has 3', async () => {
  const fx = seedRoomsHome('default', ['market-analysis', 'problem-definition', 'business-model']);
  seedQueue(fx.mindrianDir, [
    { section: 'market-analysis', enqueued_at: isoAgo(60), reason: 'post-write:x.md', attempts: 0 },
    { section: 'problem-definition', enqueued_at: isoAgo(45), reason: 'post-write:y.md', attempts: 0 },
    { section: 'business-model', enqueued_at: isoAgo(90), reason: 'post-write:z.md', attempts: 0 },
  ]);

  const r = invokeClassifier(fx.roomsHome);
  assert.equal(r.status, 0, 'classifier exit 0 (stderr=' + (r.stderr || '').toString() + ')');

  // Wait for the background drain + pending file write to land. The drain
  // is synchronous inside the bash block so the file should be produced
  // before exec.
  const pendingPath = path.join(fx.mindrianDir, 'pending-tier1-regen.json');
  const ok = await waitFor(() => fs.existsSync(pendingPath), 2000);
  assert.ok(ok, 'pending-tier1-regen.json created within 2s');

  const pending = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
  assert.equal(pending.version, 1, 'pending file version=1');
  assert.ok(Array.isArray(pending.pending), 'pending.pending is an array');
  assert.equal(pending.pending.length, 3, 'all 3 old entries recorded as pending tier-1');
  const sections = pending.pending.map((e) => e.section).sort();
  assert.deepEqual(
    sections,
    ['business-model', 'market-analysis', 'problem-definition'],
    'all three section names present'
  );

  // Queue itself should have been emptied by the drain.
  const q = JSON.parse(fs.readFileSync(path.join(fx.mindrianDir, 'minto-queue.json'), 'utf8'));
  assert.equal(q.entries.length, 0, 'queue emptied after drain');
});

// ---------- Test 2: All new -> nothing drained, no pending file ---------
test('Test 2: 3 new items (<30s) -> no drain, no pending-tier1 file', async () => {
  const fx = seedRoomsHome('default', ['market-analysis']);
  seedQueue(fx.mindrianDir, [
    { section: 'market-analysis', enqueued_at: isoAgo(5), reason: 'post-write', attempts: 0 },
    { section: 'problem-definition', enqueued_at: isoAgo(10), reason: 'post-write', attempts: 0 },
    { section: 'business-model', enqueued_at: isoAgo(15), reason: 'post-write', attempts: 0 },
  ]);

  const r = invokeClassifier(fx.roomsHome);
  assert.equal(r.status, 0, 'classifier exit 0');

  // Give the bash drain a beat to run (still synchronous, but be gracious).
  await new Promise((r) => setTimeout(r, 300));

  const pendingPath = path.join(fx.mindrianDir, 'pending-tier1-regen.json');
  assert.ok(!fs.existsSync(pendingPath), 'no pending-tier1 file produced for fresh queue');

  // Queue unchanged -- 3 entries preserved.
  const q = JSON.parse(fs.readFileSync(path.join(fx.mindrianDir, 'minto-queue.json'), 'utf8'));
  assert.equal(q.entries.length, 3, 'queue unchanged (3 fresh entries remain)');
});

// ---------- Test 3: Mixed 2 old + 3 new ---------------------------------
test('Test 3: 2 old + 3 new -> only 2 drained, 3 remain', async () => {
  const fx = seedRoomsHome('default', ['a-section', 'b-section', 'c-section']);
  seedQueue(fx.mindrianDir, [
    { section: 'a-section', enqueued_at: isoAgo(60), reason: 'old-1', attempts: 0 },
    { section: 'b-section', enqueued_at: isoAgo(5),  reason: 'new-1', attempts: 0 },
    { section: 'c-section', enqueued_at: isoAgo(45), reason: 'old-2', attempts: 0 },
    { section: 'd-section', enqueued_at: isoAgo(10), reason: 'new-2', attempts: 0 },
    { section: 'e-section', enqueued_at: isoAgo(8),  reason: 'new-3', attempts: 0 },
  ]);

  const r = invokeClassifier(fx.roomsHome);
  assert.equal(r.status, 0, 'classifier exit 0');

  const pendingPath = path.join(fx.mindrianDir, 'pending-tier1-regen.json');
  const ok = await waitFor(() => fs.existsSync(pendingPath), 2000);
  assert.ok(ok, 'pending-tier1 file created');
  const pending = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
  assert.equal(pending.pending.length, 2, 'only 2 old items pended');
  const pendedSections = pending.pending.map((e) => e.section).sort();
  assert.deepEqual(pendedSections, ['a-section', 'c-section'], 'old section names pended');

  // Queue retains the 3 new entries.
  const q = JSON.parse(fs.readFileSync(path.join(fx.mindrianDir, 'minto-queue.json'), 'utf8'));
  assert.equal(q.entries.length, 3, 'queue retains 3 fresh entries');
  const remainingSections = q.entries.map((e) => e.section).sort();
  assert.deepEqual(remainingSections, ['b-section', 'd-section', 'e-section']);
});

// ---------- Test 4: Empty queue -> no-op ---------------------------------
test('Test 4: empty queue -> hook exits 0, no pending-tier1 file', async () => {
  const fx = seedRoomsHome('default', ['market-analysis']);
  // No queue file at all.

  const r = invokeClassifier(fx.roomsHome);
  assert.equal(r.status, 0, 'classifier exit 0');

  await new Promise((r) => setTimeout(r, 200));

  const pendingPath = path.join(fx.mindrianDir, 'pending-tier1-regen.json');
  assert.ok(!fs.existsSync(pendingPath), 'no pending file for empty queue');
});

// ---------- Test 5: Wall-clock bound under 20-entry queue ---------------
test('Test 5: 20-entry old queue -> hook wall-clock under 1500ms', async () => {
  const sections = [];
  for (let i = 0; i < 20; i++) sections.push('sec-' + i);
  const fx = seedRoomsHome('default', sections);
  const entries = sections.map((s, i) => ({
    section: s,
    enqueued_at: isoAgo(60 + i),
    reason: 'burst-' + i,
    attempts: 0,
  }));
  seedQueue(fx.mindrianDir, entries);

  const start = Date.now();
  const r = invokeClassifier(fx.roomsHome);
  const elapsed = Date.now() - start;

  assert.equal(r.status, 0, 'classifier exit 0');
  assert.ok(
    elapsed < 1500,
    'hook wall-clock < 1500ms (got: ' + elapsed + 'ms)'
  );

  // Regens spawn in background; pending file still gets all 20.
  const pendingPath = path.join(fx.mindrianDir, 'pending-tier1-regen.json');
  const ok = await waitFor(() => fs.existsSync(pendingPath), 2000);
  assert.ok(ok, 'pending-tier1 file created for 20-entry drain');
  const pending = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
  assert.equal(pending.pending.length, 20, 'all 20 entries pended');
});

// ---------- Test 6: Append (not overwrite) on second drain --------------
test('Test 6: second drain APPENDS to existing pending-tier1 file', async () => {
  const fx = seedRoomsHome('default', ['alpha', 'beta', 'gamma']);
  // Pre-seed pending-tier1 with one historical entry.
  const pendingPath = path.join(fx.mindrianDir, 'pending-tier1-regen.json');
  fs.writeFileSync(pendingPath, JSON.stringify({
    version: 1,
    pending: [
      { section: 'historical-section', enqueued_at: isoAgo(300), reason: 'prior-session', attempts: 0 },
    ],
  }, null, 2));

  // Seed queue with 2 old items.
  seedQueue(fx.mindrianDir, [
    { section: 'alpha', enqueued_at: isoAgo(60), reason: 'r1', attempts: 0 },
    { section: 'beta',  enqueued_at: isoAgo(90), reason: 'r2', attempts: 0 },
  ]);

  const r = invokeClassifier(fx.roomsHome);
  assert.equal(r.status, 0, 'classifier exit 0');
  await waitFor(() => {
    try {
      const p = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
      return p.pending.length === 3;
    } catch (_) { return false; }
  }, 2000);

  const pending = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
  assert.equal(pending.pending.length, 3, 'historical + 2 new = 3 entries');
  const sections = pending.pending.map((e) => e.section);
  assert.ok(sections.includes('historical-section'), 'historical entry preserved');
  assert.ok(sections.includes('alpha'), 'alpha drained in');
  assert.ok(sections.includes('beta'), 'beta drained in');
});

// ---------- Test 7: Crash recovery -- queue on disk survives ------------
test('Test 7: session crash simulation -- queue persists + drains on next hook', async () => {
  const fx = seedRoomsHome('default', ['market-analysis', 'solution-design', 'business-model']);
  // Simulate a crashed prior session that left 3 old items in the queue.
  const oldEntries = [
    { section: 'market-analysis', enqueued_at: isoAgo(120), reason: 'crashed-session', attempts: 0 },
    { section: 'solution-design', enqueued_at: isoAgo(150), reason: 'crashed-session', attempts: 0 },
    { section: 'business-model',  enqueued_at: isoAgo(180), reason: 'crashed-session', attempts: 0 },
  ];
  seedQueue(fx.mindrianDir, oldEntries);

  // Verify queue file is on disk BEFORE hook runs (i.e. persisted across
  // the "crash"). This simulates the next session starting fresh.
  const qPath = path.join(fx.mindrianDir, 'minto-queue.json');
  assert.ok(fs.existsSync(qPath), 'queue persisted to disk (crash-safe)');
  const prior = JSON.parse(fs.readFileSync(qPath, 'utf8'));
  assert.equal(prior.entries.length, 3, 'pre-hook: 3 crashed entries on disk');

  // Fresh hook invocation.
  const r = invokeClassifier(fx.roomsHome);
  assert.equal(r.status, 0, 'classifier exit 0 on crash-recovery path');

  const pendingPath = path.join(fx.mindrianDir, 'pending-tier1-regen.json');
  const ok = await waitFor(() => fs.existsSync(pendingPath), 2000);
  assert.ok(ok, 'pending-tier1 file created after crash recovery');
  const pending = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
  assert.equal(pending.pending.length, 3, 'all 3 crashed entries recovered');
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
    } finally {
      // afterEach: kill any orphan regen spawns so they do not leak between tests.
      killOrphanRegens();
    }
  }
  process.stdout.write(
    '\ndebouncer-drain-at-prompt.test.cjs: ' +
    (tests.length - failed) + '/' + tests.length + ' passed\n'
  );
  process.exit(failed === 0 ? 0 : 1);
})();
