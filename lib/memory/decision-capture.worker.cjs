#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-10 -- decision-capture concurrency worker
 * ===================================================
 * Forked by lib/memory/decision-capture.test.cjs Test 9 (3 concurrent
 * recordDecision calls against the same section) so the test exercises
 * OS-level concurrency rather than fake "parallel" promises in one event
 * loop. Matches the Phase 87-02 write-lock-atomic.worker.cjs and Phase
 * 88-04-B vault-section-minto-generator-atomic.worker.cjs conventions
 * (standalone file, not inline template string).
 *
 * Usage:
 *   node decision-capture.worker.cjs <roomPath> <section> <session_id> <action>
 *
 * The worker fabricates a valid decision log entry inline and calls
 * recordDecision() through lib/core/decision-capture.cjs. Each worker
 * gets a unique session_id + action so the final MINTO decision_log
 * carries exactly one entry per worker after the race.
 *
 * Exit codes:
 *   0 -- recordDecision returned success:true
 *   1 -- unexpected error or success:false (fails the parent test)
 */

'use strict';

const path = require('node:path');

const dc = require(path.resolve(__dirname, '..', 'core', 'decision-capture.cjs'));

const roomPath = process.argv[2];
const section = process.argv[3];
const sessionId = process.argv[4];
const action = process.argv[5];

if (!roomPath || !section || !sessionId || !action) {
  process.stderr.write(
    'decision-capture.worker: missing argv (roomPath, section, session_id, action)\n'
  );
  process.exit(1);
}

const entry = {
  session_id: sessionId,
  timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  action: action,
  user_response: 'approve',
  reason: 'concurrent worker ' + sessionId,
};

try {
  const r = dc.recordDecision(roomPath, section, entry);
  if (!r || r.success !== true) {
    process.stderr.write(
      'decision-capture.worker: success=false, violations=' +
        JSON.stringify((r && r.violations) || []) +
        '\n'
    );
    process.exit(1);
  }
  process.exit(0);
} catch (e) {
  process.stderr.write(
    'decision-capture.worker ERROR: ' + (e && e.message || e) + '\n'
  );
  if (e && e.stack) process.stderr.write(e.stack + '\n');
  process.exit(1);
}
