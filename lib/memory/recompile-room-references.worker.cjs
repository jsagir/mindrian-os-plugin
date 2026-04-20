#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-03 -- recompile-room-references concurrent-worker driver
 * =================================================================
 * Standalone worker spawned by test 7 via child_process.fork. Calls
 * recompile(sectionPath) exactly once then exits. Exit codes:
 *   0 -- recompile succeeded
 *   2 -- recompile skipped (mtime_conflict OR no_room_md, either is a
 *        valid outcome when multiple workers race on the same section)
 *   1 -- recompile threw, or lock could not be acquired
 *
 * Written as a real file (not an inline template string) for
 * cross-platform path-escape safety -- matches the pattern established
 * in Phase 87-02 write-lock-atomic.worker.cjs.
 */

'use strict';

const path = require('node:path');
const recompiler = require(path.join(__dirname, '..', '..', 'scripts', 'recompile-room-references.cjs'));

const sectionPath = process.argv[2];
if (!sectionPath) {
  process.stderr.write('usage: recompile-room-references.worker.cjs <sectionPath>\n');
  process.exit(1);
}

try {
  const result = recompiler.recompile(sectionPath);
  if (result && result.success === true) {
    process.exit(0);
  }
  if (result && (result.reason === 'mtime_conflict' || result.reason === 'no_room_md')) {
    process.exit(2);
  }
  process.exit(1);
} catch (e) {
  process.stderr.write('[worker] ' + (e && e.message || e) + '\n');
  process.exit(1);
}
