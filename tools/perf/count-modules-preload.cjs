'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 382 plan 01: the preload of the untimed count pass.
 * Use: NODE_OPTIONS="--require tools/perf/count-modules-preload.cjs" MOS_PERF_COUNT_LOG=<file> <command>
 * At exit, every node process appends one JSON line to the log: pid, ppid, the basename of
 * process.argv[1] and the number of CommonJS modules in require.cache (this preload excluded).
 * The number of lines is the number of node starts. ES modules are not in require.cache and are not counted.
 * Only counts and a script basename are written. Hyphens only.
 */
const fs = require('node:fs');
const path = require('node:path');

const log = process.env.MOS_PERF_COUNT_LOG;
if (log) {
  process.on('exit', () => {
    try {
      const line = JSON.stringify({
        pid: process.pid,
        ppid: process.ppid,
        argv1: path.basename(String(process.argv[1] || '')),
        modules: Math.max(0, Object.keys(require.cache).length - 1),
      });
      fs.appendFileSync(log, line + '\n');
    } catch (_e) { /* a count line is best effort */ }
  });
}
