#!/usr/bin/env node
'use strict';
/*
 * tests/helpers/job-lock-holder-379.cjs -- Phase 379.1 Plan 02 (CPU379-05).
 *
 * Forked child used by tests/test-379.1-queue-lock.cjs to get real OS-level
 * process identity for the job-lock proof (a fake in-process "concurrent"
 * promise cannot prove PID liveness; the same rationale as
 * tests/helpers/write-lock-holder-354.cjs).
 *
 * argv: [lockPath, mode, holdMs]
 *   mode 'hold'  -- acquire with heartbeatMs 100, report, wait holdMs, release, report
 *   mode 'crash' -- acquire, report, exit(0) WITHOUT releasing
 *
 * Every message goes through process.send (this file is only ever forked,
 * never run directly). On any error it sends { error: message } and exits 1.
 * Never writes outside the lock path it is given.
 *
 * CJS, no third-party dependencies. Hyphens only, no em-dashes (CLAUDE.md).
 */

const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');

async function main() {
  const lockPath = process.argv[2];
  const mode = process.argv[3];
  const holdMs = Number(process.argv[4]) || 0;

  if (!lockPath || !mode) {
    process.send({ error: 'missing lockPath or mode argv' });
    process.exit(1);
    return;
  }

  const jobLock = require(path.join(REPO, 'lib', 'core', 'job-lock.cjs'));
  const res = jobLock.acquire(lockPath, { job: 'test-379-holder', heartbeatMs: 100 });
  if (!res.ok) {
    process.send({ acquired: false, pid: process.pid, reason: res.reason });
    process.exit(1);
    return;
  }
  process.send({ acquired: true, pid: process.pid, started_at: res.handle.started_at });

  if (mode === 'crash') {
    // Exit without releasing: a crashed or killed owner leaves the file.
    process.exit(0);
    return;
  }

  if (mode === 'hold') {
    await new Promise((resolve) => setTimeout(resolve, holdMs));
    const rel = jobLock.release(res.handle);
    process.send({ released: rel.released === true, reason: rel.reason || null });
    return;
  }

  process.send({ error: 'unknown mode: ' + mode });
  process.exit(1);
}

main().catch((e) => {
  try {
    process.send({ error: (e && e.message) || String(e) });
  } catch (_sendErr) {
    // channel already closed
  }
  process.exit(1);
});
