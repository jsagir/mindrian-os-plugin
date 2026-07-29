#!/usr/bin/env node
/**
 * Worker process for tests/test-238-retry-counter-fence.cjs (Phase 238-01
 * Task 2, GATE-03 half B concurrency proof).
 *
 * Modelled byte-for-byte on lib/memory/write-lock-atomic.worker.cjs (Phase
 * 87-02), the in-repo precedent for driving real production accessors from a
 * forked child so the parent can prove true OS-level concurrency instead of
 * mocked parallel promises inside one event loop.
 *
 * Contract:
 *   argv[2] -- the isolated MINDRIAN_HOME directory
 *   argv[3] -- the counter key to bump
 *   argv[4] -- the number of bumps (an integer string)
 *
 * Exit codes (kept identical to the Phase 87-02 worker's code table so the
 * parent's expectations stay uniform across both workers):
 *   0 -- expected success (the loop ran to completion)
 *   1 -- expected contention (unused by this worker; reserved so the code
 *        table matches the precedent)
 *   3 -- unexpected argv or require failure, reason on stderr
 *
 * Written as a standalone file (not inline template string) to avoid
 * Windows/Linux path-escape ambiguity in the parent test source, same reason
 * the precedent's own header states.
 */

'use strict';

const path = require('node:path');

const mindrianHome = process.argv[2];
const counterKey = process.argv[3];
const bumpsArg = process.argv[4];

if (!mindrianHome) {
  process.stderr.write('test-238-retry-counter-fence.worker: missing MINDRIAN_HOME argv[2]\n');
  process.exit(3);
}
if (!counterKey) {
  process.stderr.write('test-238-retry-counter-fence.worker: missing counter key argv[3]\n');
  process.exit(3);
}
if (typeof bumpsArg !== 'string' || bumpsArg.length === 0 || !/^\d+$/.test(bumpsArg)) {
  process.stderr.write('test-238-retry-counter-fence.worker: argv[4] must be a non-negative integer string, got '
    + JSON.stringify(bumpsArg) + '\n');
  process.exit(3);
}
const bumps = parseInt(bumpsArg, 10);
if (!Number.isFinite(bumps)) {
  process.stderr.write('test-238-retry-counter-fence.worker: argv[4] did not parse to a finite integer\n');
  process.exit(3);
}

// Set MINDRIAN_HOME BEFORE requiring the module under test. retryFilePath()
// reads the env var at CALL time (not require time), but the require also
// transitively pulls in lib/core/gate-relevance.cjs and the registry path;
// setting the env var first keeps the child hermetic in all cases, matching
// the plan's explicit ordering requirement.
process.env.MINDRIAN_HOME = mindrianHome;

let bumpRetryCount;
try {
  // Never a relative literal: the child's cwd is not guaranteed to be the
  // repo root, so resolve off this worker file's own location.
  const checkCardFire = require(path.resolve(__dirname, '..', 'scripts', 'check-card-fire.cjs'));
  bumpRetryCount = checkCardFire.bumpRetryCount;
  if (typeof bumpRetryCount !== 'function') {
    throw new Error('scripts/check-card-fire.cjs did not export bumpRetryCount as a function');
  }
} catch (e) {
  process.stderr.write('test-238-retry-counter-fence.worker: require failure: '
    + (e && e.message || e) + '\n');
  process.exit(3);
}

try {
  for (let i = 0; i < bumps; i += 1) {
    bumpRetryCount(counterKey);
  }
  process.exit(0);
} catch (e) {
  // A swallowed lock failure inside bumpRetryCount must never masquerade as
  // a clean child: any throw during the bump loop is a hard exit 3, not 0.
  process.stderr.write('test-238-retry-counter-fence.worker: bump loop failure: '
    + (e && e.message || e) + '\n');
  process.exit(3);
}
