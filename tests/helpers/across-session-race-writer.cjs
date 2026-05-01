#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 103-02 test helper -- multi-process race writer.
 *
 * Forked by tests/test-across-session-memory.cjs to verify O_EXCL lockfile
 * behavior under concurrent process writes. Reads MINDRIAN_ROOMS_HOME +
 * roomSlug + jtbd + turnCount from process.argv, calls promoteIfEligible,
 * exits 0.
 *
 * Usage (from parent test):
 *   const child = fork(
 *     'tests/helpers/across-session-race-writer.cjs',
 *     [roomSlug, jtbd, String(turnCount)],
 *     { env: { ...process.env, MINDRIAN_ROOMS_HOME: tmpRoot } }
 *   );
 */

const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MEM_MODULE = path.join(REPO_ROOT, 'lib', 'hmi', 'across-session-memory.cjs');

const [, , roomSlug, jtbd, turnCountStr] = process.argv;
const turnCount = Number(turnCountStr) || 5;

let mem;
try {
  mem = require(MEM_MODULE);
} catch (err) {
  process.stderr.write(
    'race-writer: cannot load module: ' + (err && err.message) + '\n'
  );
  process.exit(2);
}

const withinSessionState = {
  current: {
    jtbd: jtbd,
    confidence: 0.8,
    entered_at: new Date().toISOString(),
    evidence: ['tokens:race-test'],
    turn_count: turnCount,
    manual_set: false,
    trigger: 'auto',
  },
  history: [],
};

try {
  const result = mem.promoteIfEligible(roomSlug, withinSessionState);
  if (result && result.action === 'promoted') {
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exit(0);
  } else {
    process.stderr.write('race-writer: no promotion (result=' + JSON.stringify(result) + ')\n');
    process.exit(0); // not a hard failure for this test design
  }
} catch (err) {
  process.stderr.write('race-writer: error: ' + (err && err.message) + '\n');
  process.exit(3);
}
