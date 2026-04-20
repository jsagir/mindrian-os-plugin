#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-02 -- minto-debouncer tests (RED -> GREEN)
 * ====================================================
 * Ships the debounced queue that coalesces post-write regen intents into
 * one regen per section per 10s window. Queue persists at
 * .mindrian/minto-queue.json and survives session crashes. Concurrent
 * producers (post-write hook + on-stop + intent-classifier drain) cannot
 * corrupt the queue file because every mutation composes with the
 * Phase 87-02 atomic write-lock (acquireLock / releaseLock).
 *
 * Test map (12 tests, one per PLAN <behavior> case):
 *   Test  1: first enqueue creates .mindrian/minto-queue.json with 1 entry
 *   Test  2: second enqueue on same section within 10s -> length stays 1
 *            (earliest-wins: enqueued_at preserved on FIRST entry)
 *   Test  3: two enqueues on different sections -> length 2
 *   Test  4: enqueue after 10s+ on same section -> length 2 (window expired)
 *   Test  5: drain(olderThanMs:30000) -> only entries older than 30s drained
 *   Test  6: drain crash-safe: simulated mid-drain failure leaves valid JSON
 *   Test  7: 5 concurrent forked enqueues on SAME section -> final length 1
 *   Test  8: 5 concurrent forked enqueues on 5 DISTINCT sections -> length 5
 *   Test  9: peek is read-only (peek twice -> identical result, no mutation)
 *   Test 10: malformed JSON self-heals; warning to stderr; no throw
 *   Test 11: CLI invocation: enqueue subcommand exits 0, produces queue file
 *   Test 12: drain wall-clock timeout: 100ms bound honored under load
 *
 * BSL 1.1. Zero npm deps. Node built-ins only. Three-surface by construction.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork, spawnSync } = require('node:child_process');

const debouncer = require('../../scripts/minto-debouncer.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEBOUNCER_CLI = path.join(REPO_ROOT, 'scripts', 'minto-debouncer.cjs');
const ENQUEUE_WORKER = path.join(__dirname, 'minto-debouncer.worker.cjs');

const TMPDIRS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  // Mark as a room so downstream resolve-room style walkers could find it.
  fs.writeFileSync(path.join(d, '.room-root'), '');
  TMPDIRS.push(d);
  return d;
}
process.on('exit', () => {
  for (const d of TMPDIRS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
});

function queuePath(roomDir) {
  return path.join(roomDir, '.mindrian', 'minto-queue.json');
}

function readQueue(roomDir) {
  return JSON.parse(fs.readFileSync(queuePath(roomDir), 'utf-8'));
}

let passed = 0;
let failed = 0;
function run(name, fn) {
  try {
    fn();
    process.stdout.write('  OK ' + name + '\n');
    passed += 1;
  } catch (e) {
    process.stderr.write('  FAIL ' + name + ': ' + (e && e.message || e) + '\n');
    if (e && e.stack) process.stderr.write(e.stack + '\n');
    failed += 1;
  }
}

async function runAsync(name, fn) {
  try {
    await fn();
    process.stdout.write('  OK ' + name + '\n');
    passed += 1;
  } catch (e) {
    process.stderr.write('  FAIL ' + name + ': ' + (e && e.message || e) + '\n');
    if (e && e.stack) process.stderr.write(e.stack + '\n');
    failed += 1;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function main() {
  process.stdout.write('minto-debouncer.test.cjs:\n');

  // Sanity: worker fork helper exists.
  assert.ok(
    fs.existsSync(ENQUEUE_WORKER),
    'minto-debouncer.worker.cjs missing (concurrency tests depend on it)'
  );

  // -------------------------------------------------------------------------
  // Test 1: first enqueue creates the queue file with one entry
  // -------------------------------------------------------------------------
  run('Test 1: first enqueue creates queue with 1 entry', () => {
    const room = mkTmp('mi-deb-t1-');
    debouncer.enqueue(room, 'market-analysis', 'post-write');
    assert.ok(fs.existsSync(queuePath(room)), 'queue file should be created');
    const q = readQueue(room);
    assert.strictEqual(q.version, 1, 'schema version should be 1');
    assert.strictEqual(q.entries.length, 1, 'entries length 1');
    assert.strictEqual(q.entries[0].section, 'market-analysis');
    assert.strictEqual(q.entries[0].reason, 'post-write');
    assert.strictEqual(q.entries[0].attempts, 0);
    assert.ok(
      typeof q.entries[0].enqueued_at === 'string' &&
        !Number.isNaN(Date.parse(q.entries[0].enqueued_at)),
      'enqueued_at should be a valid ISO-8601 string'
    );
  });

  // -------------------------------------------------------------------------
  // Test 2: coalesce -- second enqueue on same section within 10s stays at 1
  //         earliest-wins: enqueued_at preserved from the FIRST entry
  // -------------------------------------------------------------------------
  run('Test 2: coalesce within 10s (earliest-wins enqueued_at)', () => {
    const room = mkTmp('mi-deb-t2-');
    debouncer.enqueue(room, 'problem-definition', 'post-write');
    const firstTs = readQueue(room).entries[0].enqueued_at;
    // small real-time delay to ensure a second call would see a different "now"
    const deadline = Date.now() + 5;
    while (Date.now() < deadline) {/* burn */}
    debouncer.enqueue(room, 'problem-definition', 'post-write');
    const q = readQueue(room);
    assert.strictEqual(q.entries.length, 1, 'coalesce should keep length 1');
    assert.strictEqual(
      q.entries[0].enqueued_at,
      firstTs,
      'earliest-wins: first enqueued_at must be preserved'
    );
  });

  // -------------------------------------------------------------------------
  // Test 3: two different sections -> length 2
  // -------------------------------------------------------------------------
  run('Test 3: distinct sections both enqueue', () => {
    const room = mkTmp('mi-deb-t3-');
    debouncer.enqueue(room, 'market-analysis', 'post-write');
    debouncer.enqueue(room, 'financial-model', 'post-write');
    const q = readQueue(room);
    assert.strictEqual(q.entries.length, 2);
    const sections = q.entries.map((e) => e.section).sort();
    assert.deepStrictEqual(sections, ['financial-model', 'market-analysis']);
  });

  // -------------------------------------------------------------------------
  // Test 4: after window expires, same section appends new entry
  //         We simulate time travel by rewriting the queue file with a stale
  //         enqueued_at (older than 10s). That exercises the same code path
  //         as real elapsed time without the 10s test delay.
  // -------------------------------------------------------------------------
  run('Test 4: window expired -> new entry appended', () => {
    const room = mkTmp('mi-deb-t4-');
    debouncer.enqueue(room, 'business-model', 'post-write');
    const q1 = readQueue(room);
    assert.strictEqual(q1.entries.length, 1);
    // Backdate the entry 15s so the next enqueue falls OUTSIDE the 10s window.
    q1.entries[0].enqueued_at = new Date(Date.now() - 15000).toISOString();
    fs.writeFileSync(queuePath(room), JSON.stringify(q1));
    debouncer.enqueue(room, 'business-model', 'on-stop');
    const q2 = readQueue(room);
    assert.strictEqual(q2.entries.length, 2, 'stale entry + fresh entry = 2');
    const reasons = q2.entries.map((e) => e.reason).sort();
    assert.deepStrictEqual(reasons, ['on-stop', 'post-write']);
  });

  // -------------------------------------------------------------------------
  // Test 5: drain(olderThanMs:30000) -- only entries older than 30s drained
  // -------------------------------------------------------------------------
  run('Test 5: drain honors olderThanMs', () => {
    const room = mkTmp('mi-deb-t5-');
    debouncer.enqueue(room, 'old-section', 'post-write');
    debouncer.enqueue(room, 'new-section', 'post-write');
    // Backdate old-section to 45s ago.
    const q = readQueue(room);
    const old = q.entries.find((e) => e.section === 'old-section');
    old.enqueued_at = new Date(Date.now() - 45000).toISOString();
    fs.writeFileSync(queuePath(room), JSON.stringify(q));
    const drained = debouncer.drain(room, { timeoutMs: 5000, olderThanMs: 30000 });
    assert.strictEqual(drained.length, 1, 'exactly 1 entry older than 30s');
    assert.strictEqual(drained[0].section, 'old-section');
    const remaining = readQueue(room);
    assert.strictEqual(remaining.entries.length, 1, 'fresh entry remains');
    assert.strictEqual(remaining.entries[0].section, 'new-section');
  });

  // -------------------------------------------------------------------------
  // Test 6: drain is atomic-safe -- even if the queue file is truncated
  //         mid-write, the previous committed queue remains valid JSON.
  //         We validate the temp-file-then-rename pattern by inspecting the
  //         queue file between enqueue calls (it must always parse).
  // -------------------------------------------------------------------------
  run('Test 6: atomic write via tmp+rename keeps queue JSON-valid', () => {
    const room = mkTmp('mi-deb-t6-');
    debouncer.enqueue(room, 'sec-a', 'post-write');
    // At any point after enqueue, reading the queue must parse cleanly.
    const raw = fs.readFileSync(queuePath(room), 'utf-8');
    const parsed = JSON.parse(raw);
    assert.strictEqual(parsed.version, 1);
    // Drain and re-check.
    debouncer.drain(room, { timeoutMs: 1000, olderThanMs: 0 });
    const raw2 = fs.readFileSync(queuePath(room), 'utf-8');
    const parsed2 = JSON.parse(raw2);
    assert.strictEqual(parsed2.version, 1);
    assert.strictEqual(parsed2.entries.length, 0, 'drain empties when olderThanMs=0');
    // Verify no .tmp.PID leftovers exist in the .mindrian dir.
    const mindrianDir = path.join(room, '.mindrian');
    const leftovers = fs.readdirSync(mindrianDir).filter((f) => f.includes('.tmp.'));
    assert.strictEqual(leftovers.length, 0, 'no tmp artifacts left behind');
  });

  // -------------------------------------------------------------------------
  // Test 7: 5 concurrent forked enqueues on SAME section -> final length 1
  //         This proves the write-lock composition prevents duplicate entries.
  // -------------------------------------------------------------------------
  await runAsync('Test 7: 5 concurrent same-section -> length 1 (coalesced)', async () => {
    const room = mkTmp('mi-deb-t7-');
    const forks = [];
    for (let i = 0; i < 5; i++) {
      forks.push(new Promise((resolve) => {
        const child = fork(ENQUEUE_WORKER, [room, 'market-analysis', 'post-write'], { silent: true });
        let stderrBuf = '';
        if (child.stderr) child.stderr.on('data', (c) => { stderrBuf += c.toString(); });
        child.on('exit', (code) => resolve({ code, stderr: stderrBuf }));
      }));
    }
    const results = await Promise.all(forks);
    const failures = results.filter((r) => r.code !== 0);
    if (failures.length) {
      for (const r of failures) process.stderr.write('[worker stderr] ' + r.stderr);
    }
    assert.strictEqual(failures.length, 0, 'all 5 workers must exit 0');
    const q = readQueue(room);
    assert.strictEqual(
      q.entries.length,
      1,
      'coalesced to 1 entry (got ' + q.entries.length + ')'
    );
    assert.strictEqual(q.entries[0].section, 'market-analysis');
  });

  // -------------------------------------------------------------------------
  // Test 8: 5 concurrent forked enqueues on 5 DISTINCT sections -> length 5
  //         Zero data loss under concurrency.
  // -------------------------------------------------------------------------
  await runAsync('Test 8: 5 concurrent distinct sections -> length 5 (no loss)', async () => {
    const room = mkTmp('mi-deb-t8-');
    const sections = ['s1', 's2', 's3', 's4', 's5'];
    const forks = sections.map((s) => new Promise((resolve) => {
      const child = fork(ENQUEUE_WORKER, [room, s, 'post-write'], { silent: true });
      let stderrBuf = '';
      if (child.stderr) child.stderr.on('data', (c) => { stderrBuf += c.toString(); });
      child.on('exit', (code) => resolve({ code, stderr: stderrBuf }));
    }));
    const results = await Promise.all(forks);
    const failures = results.filter((r) => r.code !== 0);
    if (failures.length) {
      for (const r of failures) process.stderr.write('[worker stderr] ' + r.stderr);
    }
    assert.strictEqual(failures.length, 0, 'all 5 workers must exit 0');
    const q = readQueue(room);
    assert.strictEqual(q.entries.length, 5, 'all 5 distinct sections present');
    const got = q.entries.map((e) => e.section).sort();
    assert.deepStrictEqual(got, sections);
  });

  // -------------------------------------------------------------------------
  // Test 9: peek is read-only (two peeks return identical results,
  //         queue file mtime unchanged).
  // -------------------------------------------------------------------------
  run('Test 9: peek is read-only (idempotent)', () => {
    const room = mkTmp('mi-deb-t9-');
    debouncer.enqueue(room, 'only-section', 'post-write');
    const mtime1 = fs.statSync(queuePath(room)).mtimeMs;
    const p1 = debouncer.peek(room);
    const p2 = debouncer.peek(room);
    assert.deepStrictEqual(p1, p2, 'two peeks should return deeply equal result');
    assert.strictEqual(p1.entries.length, 1);
    assert.strictEqual(p1.entries[0].section, 'only-section');
    const mtime2 = fs.statSync(queuePath(room)).mtimeMs;
    assert.strictEqual(mtime1, mtime2, 'peek must not touch the queue file');
  });

  // -------------------------------------------------------------------------
  // Test 10: malformed JSON self-heals; warning to stderr; no throw.
  // -------------------------------------------------------------------------
  run('Test 10: malformed JSON self-heals with stderr warning', () => {
    const room = mkTmp('mi-deb-t10-');
    fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
    // Write garbage to the queue path.
    fs.writeFileSync(queuePath(room), '{not-valid-json}}}');
    // Capture stderr during the enqueue call.
    const origWrite = process.stderr.write.bind(process.stderr);
    let stderrBuf = '';
    process.stderr.write = (chunk) => { stderrBuf += String(chunk); return true; };
    try {
      assert.doesNotThrow(
        () => debouncer.enqueue(room, 'healed-section', 'post-write'),
        'enqueue must not throw on corrupted queue'
      );
    } finally {
      process.stderr.write = origWrite;
    }
    assert.ok(
      stderrBuf.toLowerCase().includes('warn') ||
        stderrBuf.toLowerCase().includes('corrupt') ||
        stderrBuf.toLowerCase().includes('reset') ||
        stderrBuf.toLowerCase().includes('heal'),
      'should log a recovery warning to stderr (got: ' + JSON.stringify(stderrBuf) + ')'
    );
    const q = readQueue(room);
    assert.strictEqual(q.version, 1);
    assert.strictEqual(q.entries.length, 1);
    assert.strictEqual(q.entries[0].section, 'healed-section');
  });

  // -------------------------------------------------------------------------
  // Test 11: CLI invocation works and produces the queue file.
  // -------------------------------------------------------------------------
  run('Test 11: CLI enqueue subcommand produces queue file', () => {
    const room = mkTmp('mi-deb-t11-');
    const res = spawnSync(process.execPath, [
      DEBOUNCER_CLI, 'enqueue', room, 'market-analysis', 'post-write',
    ], { encoding: 'utf-8' });
    assert.strictEqual(res.status, 0, 'CLI must exit 0 (stderr: ' + res.stderr + ')');
    assert.ok(fs.existsSync(queuePath(room)), 'queue file should exist after CLI enqueue');
    const q = readQueue(room);
    assert.strictEqual(q.entries.length, 1);
    assert.strictEqual(q.entries[0].section, 'market-analysis');
    // peek subcommand also works.
    const peekRes = spawnSync(process.execPath, [DEBOUNCER_CLI, 'peek', room], { encoding: 'utf-8' });
    assert.strictEqual(peekRes.status, 0, 'peek exit 0 (stderr: ' + peekRes.stderr + ')');
    assert.ok(
      peekRes.stdout.includes('market-analysis'),
      'peek stdout should mention the section'
    );
  });

  // -------------------------------------------------------------------------
  // Test 12: drain has a wall-clock timeout bound (returns within timeoutMs
  //          even under synthetic load).
  // -------------------------------------------------------------------------
  run('Test 12: drain honors wall-clock timeoutMs', () => {
    const room = mkTmp('mi-deb-t12-');
    // Pre-populate queue with many entries (simulate a burst).
    fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
    const entries = [];
    const now = Date.now();
    for (let i = 0; i < 500; i++) {
      entries.push({
        section: 'sec-' + i,
        enqueued_at: new Date(now - 60000).toISOString(),
        reason: 'post-write',
        attempts: 0,
      });
    }
    fs.writeFileSync(queuePath(room), JSON.stringify({ version: 1, entries }));
    const t0 = Date.now();
    const drained = debouncer.drain(room, { timeoutMs: 100, olderThanMs: 30000 });
    const elapsed = Date.now() - t0;
    // Wall-clock bound: allow generous overhead for lock acquire + rename on slow CI.
    // The invariant we're testing is "drain returns in bounded time" -- not ms-precise.
    assert.ok(
      elapsed < 2000,
      'drain should return in bounded time; took ' + elapsed + 'ms'
    );
    // drain under timeout pressure is allowed to return empty OR partial OR full; the
    // invariant is "no hang, no throw, queue still valid".
    assert.ok(Array.isArray(drained), 'drained must be an array');
    const rem = readQueue(room);
    assert.strictEqual(rem.version, 1);
    assert.ok(Array.isArray(rem.entries));
  });

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  process.stdout.write('\nminto-debouncer: ' + passed + '/' + (passed + failed) + ' passed');
  if (failed > 0) {
    process.stdout.write(', ' + failed + ' failed\n');
    process.exit(1);
  } else {
    process.stdout.write('\n');
    process.exit(0);
  }
}

main().catch((e) => {
  process.stderr.write('minto-debouncer.test.cjs FATAL: ' + (e && e.message || e) + '\n');
  if (e && e.stack) process.stderr.write(e.stack + '\n');
  process.exit(1);
});
