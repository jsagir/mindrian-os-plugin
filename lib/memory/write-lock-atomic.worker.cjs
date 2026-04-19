#!/usr/bin/env node
/**
 * Worker process for write-lock-atomic.test.cjs (Phase 87-02).
 *
 * BSL 1.1. Copyright (c) Mindrian 2026.
 *
 * Forked by the parent test. Attempts acquireLock on the roomDir passed
 * via argv[2]. Exit codes:
 *   0 -- acquired successfully
 *   1 -- saw expected "SQLite write lock held by PID" (valid contention loss)
 *   3 -- unexpected error (propagate for parent diagnostics)
 *
 * Written as a standalone file (not inline template string) to avoid
 * Windows/Linux path-escape ambiguity in the parent test source.
 */

'use strict';

const path = require('node:path');

// Resolve the write-lock module relative to THIS worker file's location.
// __dirname is lib/memory/, target is lib/core/write-lock.cjs.
const { acquireLock } = require(path.resolve(__dirname, '..', 'core', 'write-lock.cjs'));

const roomDir = process.argv[2];

if (!roomDir) {
  process.stderr.write('write-lock-atomic.worker: missing roomDir argv[2]\n');
  process.exit(3);
}

try {
  acquireLock(roomDir);
  // Held lock -- winner. Must stay alive long enough for losers to finish
  // their EEXIST + process.kill(winnerPid, 0) liveness check, otherwise
  // the lock's dead-PID cleanup path lets multiple workers "win" in
  // sequence (staggered), which is valid lock-system behavior but does
  // NOT prove the atomic-create primitive.
  //
  // 500ms is chosen to be longer than the worst-case fork+spawn latency
  // across 20 children on CI.
  setTimeout(() => process.exit(0), 500);
} catch (e) {
  if (e && e.message && e.message.startsWith('SQLite write lock')) {
    process.exit(1);
  }
  process.stderr.write('write-lock-atomic.worker unexpected: ' + (e && e.message || e) + '\n');
  process.exit(3);
}
