#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-04-B -- vault-section-minto-generator atomic-write concurrency worker
 * =============================================================================
 * Forked by lib/memory/vault-section-minto-generator-atomic.test.cjs Test 2
 * (5 concurrent tier-0 writes against the same section) and Test 6 (reader
 * safety loop). Each worker shells out to the generator --write subcommand;
 * exactly one process wins the rename race per cycle. No torn reads, no
 * orphan tmp files after all workers finish.
 *
 * Standalone file (not inline template string in the test) to match the
 * Phase 87-02 write-lock-atomic.worker.cjs convention. Avoids path-escape
 * ambiguity on Windows.
 *
 * Usage:
 *   node vault-section-minto-generator-atomic.worker.cjs <roomDir> <section>
 *
 * Exit codes:
 *   0 -- generator --write succeeded (valid outcome for the winner; losers
 *        also exit 0 because the generator serializes via acquireLock and
 *        each attempt emits its own tmp before rename)
 *   1 -- unexpected error (fails the parent test)
 */

'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const GENERATOR = path.resolve(
  __dirname,
  '..',
  '..',
  'scripts',
  'vault-section-minto-generator.cjs'
);

const roomDir = process.argv[2];
const section = process.argv[3];

if (!roomDir || !section) {
  process.stderr.write(
    'vault-section-minto-generator-atomic.worker: missing argv (roomDir, section)\n'
  );
  process.exit(1);
}

const res = spawnSync(
  process.execPath,
  [GENERATOR, '--write', roomDir, '--section', section],
  {
    env: Object.assign({}, process.env, {
      MINTO_FROZEN_DATE: '2026-04-14',
      MINTO_FROZEN_TIMESTAMP: '2026-04-14T00:00:00Z',
    }),
    encoding: 'utf-8',
  }
);

if (res.status !== 0) {
  process.stderr.write(
    'worker generator --write exited ' +
      res.status +
      ': stderr=' +
      (res.stderr || '') +
      '\n'
  );
  process.exit(1);
}

process.exit(0);
