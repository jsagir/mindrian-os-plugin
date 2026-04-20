#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-02 -- minto-debouncer concurrency worker
 * ==================================================
 * Forked by lib/memory/minto-debouncer.test.cjs Tests 7 + 8 to get true
 * OS-level concurrency (not fake "parallel" promises in one event loop).
 *
 * Usage:
 *   node minto-debouncer.worker.cjs <roomDir> <section> <reason>
 *
 * Exit codes:
 *   0 -- enqueue succeeded (expected happy path for all 5 workers)
 *   1 -- unexpected error (fails the parent test)
 *
 * Standalone file (not inline template string in the test) to match the
 * Phase 87-02 write-lock-atomic.worker.cjs pattern: avoids Windows/Linux
 * path-escape ambiguity in parent test source.
 */

'use strict';

const path = require('node:path');

// Resolve debouncer relative to THIS worker's location.
// __dirname = lib/memory/, target = scripts/minto-debouncer.cjs
const debouncer = require(path.resolve(__dirname, '..', '..', 'scripts', 'minto-debouncer.cjs'));

const roomDir = process.argv[2];
const section = process.argv[3];
const reason = process.argv[4];

if (!roomDir || !section || !reason) {
  process.stderr.write('minto-debouncer.worker: missing argv (roomDir, section, reason)\n');
  process.exit(1);
}

try {
  debouncer.enqueue(roomDir, section, reason);
  process.exit(0);
} catch (e) {
  process.stderr.write('minto-debouncer.worker ERROR: ' + (e && e.message || e) + '\n');
  if (e && e.stack) process.stderr.write(e.stack + '\n');
  process.exit(1);
}
