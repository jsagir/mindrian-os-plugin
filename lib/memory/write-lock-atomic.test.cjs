#!/usr/bin/env node
/**
 * Phase 87-02 concurrency test: prove the atomic openSync('wx') acquire
 * allows exactly ONE of N racing processes to win the write lock.
 *
 * BSL 1.1. Copyright (c) Mindrian 2026.
 *
 * Tests (run sequentially within a single parent process):
 *   1. Spawn 20 forked children; exactly 1 exits 0, 19 exit 1 ("lock held")
 *   2. Release by the winner, re-acquire from parent -> succeeds
 *   3. Same-PID re-acquire (parent calls acquireLock twice) -> no throw
 *
 * The test uses child_process.fork to get true OS-level concurrency,
 * not mocked "parallel" promises inside one event loop.
 *
 * Exit 0 on all pass, 1 on any failure. Integrated into the Feynman
 * runner alongside other Phase 87-0x regression fences.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork } = require('node:child_process');

const { acquireLock, releaseLock } = require('../core/write-lock.cjs');

const WORKER_SCRIPT = path.join(__dirname, 'write-lock-atomic.worker.cjs');
const WORKERS = 20;

async function main() {
  // Sanity: the worker file we rely on must exist before we start forking.
  assert.ok(
    fs.existsSync(WORKER_SCRIPT),
    'worker script missing: ' + WORKER_SCRIPT
  );

  const tmpRoom = fs.mkdtempSync(path.join(os.tmpdir(), 'lockrace-'));

  try {
    // ---------------------------------------------------------------------
    // Test 1: 20 concurrent forked workers -- exactly 1 winner
    // ---------------------------------------------------------------------
    const forkPromises = [];
    for (let i = 0; i < WORKERS; i++) {
      forkPromises.push(
        new Promise((resolve) => {
          const child = fork(WORKER_SCRIPT, [tmpRoom], { silent: true });
          let stderrBuf = '';
          if (child.stderr) {
            child.stderr.on('data', (chunk) => {
              stderrBuf += chunk.toString();
            });
          }
          child.on('exit', (code) => {
            resolve({ code, stderr: stderrBuf });
          });
        })
      );
    }

    const results = await Promise.all(forkPromises);
    const codes = results.map((r) => r.code);
    const winners = codes.filter((c) => c === 0).length;
    const losers = codes.filter((c) => c === 1).length;
    const unexpected = codes.filter((c) => c !== 0 && c !== 1).length;

    if (unexpected !== 0) {
      // Dump stderr for diagnostics before failing the assert.
      for (const r of results) {
        if (r.code !== 0 && r.code !== 1 && r.stderr) {
          process.stderr.write('[worker stderr] ' + r.stderr);
        }
      }
    }

    assert.strictEqual(
      unexpected,
      0,
      'unexpected exit codes among workers: ' + codes.join(',')
    );
    assert.strictEqual(
      winners,
      1,
      'expected exactly 1 winner, got ' + winners + ' (codes: ' + codes.join(',') + ')'
    );
    assert.strictEqual(
      losers,
      WORKERS - 1,
      'expected ' + (WORKERS - 1) + ' losers, got ' + losers
    );

    // ---------------------------------------------------------------------
    // Test 2: release then re-acquire succeeds
    // ---------------------------------------------------------------------
    // The winning worker exited without releasing its lock file. We clean
    // it up via releaseLock and re-acquire from the parent.
    releaseLock(tmpRoom);
    assert.doesNotThrow(
      () => acquireLock(tmpRoom),
      'post-release acquire should succeed'
    );

    // ---------------------------------------------------------------------
    // Test 3: same-PID re-acquire does not throw
    // ---------------------------------------------------------------------
    // Same PID owns the lock -- the m11 rationale path. Must not throw.
    assert.doesNotThrow(
      () => acquireLock(tmpRoom),
      'same-PID re-acquire must not throw'
    );

    // Cleanup: release parent-held lock before tmp teardown.
    releaseLock(tmpRoom);

    process.stdout.write(
      'write-lock-atomic: all tests passed (winners=1, losers=' + (WORKERS - 1) + ', re-acquire green)\n'
    );
  } finally {
    try {
      fs.rmSync(tmpRoom, { recursive: true, force: true });
    } catch (_) {
      // ignore teardown errors
    }
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    process.stderr.write('write-lock-atomic FAIL: ' + (err && err.message || err) + '\n');
    if (err && err.stack) process.stderr.write(err.stack + '\n');
    process.exit(1);
  }
);
