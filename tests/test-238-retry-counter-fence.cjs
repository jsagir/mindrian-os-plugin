#!/usr/bin/env node
/**
 * Phase 238-05 Task 3 (GATE-03 half B) -- the 20-forked-process exact-count
 * proof plus the concurrent-reader torn-read proof.
 *
 * Shape-copy of lib/memory/write-lock-atomic.test.cjs (Phase 87-02): the test
 * uses child_process.fork to get true OS-level concurrency, not mocked
 * parallel promises inside one event loop, because same-loop promises cannot
 * reproduce a cross-process lost-update defect at all -- there is only ever
 * one JS thread touching the store in that shape, so there is nothing to
 * race.
 *
 * Four legs, all against tests/helpers/cardfire-hermetic-238.cjs isolation:
 *
 *   Leg A (lost-update proof): 20 forked children of
 *     tests/test-238-retry-counter-fence.worker.cjs, same isolated
 *     MINDRIAN_HOME, same key, 10 bumps each. Asserts the stored count is
 *     EXACTLY WORKERS * BUMPS_PER_WORKER (200), not "greater than before".
 *
 *   Leg B (torn-read proof): while leg A's 20 writers are running, a reader
 *     loop in the parent repeatedly reads and JSON.parses the retry file.
 *     Every successful read must parse cleanly. A file-not-found read at the
 *     very start is a pass (the file has not been created yet); a parse
 *     error is a failure. The iteration count must be > 0 so a reader loop
 *     that never ran cannot pass vacuously.
 *
 *   Leg C (session-counter sibling): the __session__: prefixed entries share
 *     the SAME file and the SAME write path as the per-gate entries
 *     (bumpRetryCount / bumpSessionCount both route through
 *     withRetryStoreLock in scripts/check-card-fire.cjs), so a fence applied
 *     to only one accessor family would pass leg A and still lose
 *     session-counter updates. This leg drives the worker's bumpRetryCount
 *     call with a key literally shaped as sessionKey(sessionId) --
 *     `__session__:<sessionId>`, the exact store slot bumpSessionCount
 *     writes to -- because the shipped worker (created by 238-01, out of
 *     this plan's file_modified scope) wraps bumpRetryCount, not
 *     bumpSessionCount, and this plan does not modify that worker. Reading
 *     back through the REAL readSessionCount(sessionId) accessor after the
 *     fan-out proves the session key space survives concurrency using the
 *     shipped read path, not just a hand-rolled key check.
 *
 *   Leg D (anti-vacuity control): a SINGLE child doing 10 bumps must land
 *     exactly 10. Without this, a fence that blocked all writers except one
 *     would still pass leg A only by accident.
 *
 * MUTATION GATE (SC2 named leg): removing the withRetryStoreLock wrapper
 * from bumpRetryCount in scripts/check-card-fire.cjs turns leg A red with a
 * count far below 200 (the pre-fix measurement, per 238-RESEARCH.md Finding
 * 4, was 3 of 200 under this exact 20x10 shape). The executor performs this
 * mutation by hand, runs this file, records the ACTUAL observed post-
 * mutation count in 238-05-SUMMARY.md, restores scripts/check-card-fire.cjs
 * byte-identically (confirmed by an empty `git diff --stat` on that path),
 * and re-runs to green. This file does not automate the mutation itself.
 *
 * Hermetic isolation is mandatory on every leg (tests/helpers/cardfire-
 * hermetic-238.cjs): MINDRIAN_HOME and CARD_FIRE_SIDECHANNEL_PATH both point
 * at a fresh temp dir, restored in a finally. Without it this test would
 * shred the navigator's live retry store.
 *
 * WSL2 timing note carried from the Phase 87-02 precedent (lib/memory/
 * write-lock-atomic.worker.cjs header): a roughly 40 percent flake was
 * observed at a 500ms lock hold under WSL2, resolved by using 3000ms
 * instead. This worker holds the fence only for the duration of one
 * read-modify-write (no artificial hold across processes), so it needs no
 * hold; the note is carried forward only because it is the documented
 * precedent for what to do if any future variant of this file DOES need one.
 *
 * No em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { fork } = require('node:child_process');

const REPO = path.join(__dirname, '..');
const { makeHermeticCardFireEnv } = require(path.join(__dirname, 'helpers', 'cardfire-hermetic-238.cjs'));
const checkCardFire = require(path.join(REPO, 'scripts', 'check-card-fire.cjs'));

const WORKER_SCRIPT = path.join(__dirname, 'test-238-retry-counter-fence.worker.cjs');

// Leg A constants.
const WORKERS = 20;
const BUMPS_PER_WORKER = 10;

// Leg C constants (smaller fan-out, per the plan).
const SESSION_WORKERS = 8;
const SESSION_BUMPS_PER_WORKER = 5;

// Leg D: the anti-vacuity control.
const SOLO_BUMPS = 10;

let n = 0;
function ok(desc) { n += 1; console.log('  ok   ' + desc); }

/**
 * runWorkers(home, key, count, workerCount) -> Promise<{code, stderr}[]>
 * Forks `workerCount` children of WORKER_SCRIPT, each bumping `key` `count`
 * times against `home`, and resolves with every child's exit code and
 * captured stderr once all have exited.
 */
function runWorkers(home, key, count, workerCount) {
  const childEnv = Object.assign({}, process.env, { MINDRIAN_HOME: home });
  const promises = [];
  for (let i = 0; i < workerCount; i += 1) {
    promises.push(new Promise((resolve) => {
      const child = fork(WORKER_SCRIPT, [home, key, String(count)], { silent: true, env: childEnv });
      let stderrBuf = '';
      if (child.stderr) {
        child.stderr.on('data', (chunk) => { stderrBuf += chunk.toString(); });
      }
      child.on('exit', (code) => resolve({ code: code, stderr: stderrBuf }));
    }));
  }
  return Promise.all(promises);
}

function assertAllExitedZero(results, label) {
  const unexpected = results.filter((r) => r.code !== 0);
  if (unexpected.length > 0) {
    for (const r of unexpected) {
      if (r.stderr) process.stderr.write('[worker stderr, ' + label + '] ' + r.stderr);
    }
  }
  assert.strictEqual(
    unexpected.length,
    0,
    label + ': expected all children to exit 0, got codes ' + results.map((r) => r.code).join(',')
  );
}

/**
 * makeReaderLoop(retryFile) -> { start, stop } -- Leg B's concurrent reader.
 * start() begins an async read-and-JSON.parse loop that runs until stop() is
 * called; stop() returns a Promise that resolves once the loop has actually
 * exited, with { reads, parseFailures }.
 */
function makeReaderLoop(retryFile) {
  let running = true;
  let reads = 0;
  let parseFailures = 0;
  const donePromise = (async () => {
    while (running) {
      reads += 1;
      try {
        const raw = fs.readFileSync(retryFile, 'utf8');
        try {
          const parsed = JSON.parse(raw);
          if (!(parsed && typeof parsed === 'object')) {
            parseFailures += 1;
          }
        } catch (_parseErr) {
          // A genuine parse error on non-empty content IS a torn-read failure.
          parseFailures += 1;
        }
      } catch (readErr) {
        // ENOENT (file not created yet) is an accepted pass, per the plan:
        // "a file-not-found read at the very start is acceptable and must be
        // treated as a pass, not a failure". Any other read error (e.g. an
        // EBUSY-class transient) is NOT swallowed as a pass; it counts as a
        // parse failure so a real torn/inaccessible read cannot hide.
        if (readErr && readErr.code !== 'ENOENT') {
          parseFailures += 1;
        }
      }
      // Yield the event loop so the reader does not starve the forking loop
      // above it; this is a tight poll, not a sleep, so it stays adversarial.
      await new Promise((resolve) => setImmediate(resolve));
    }
    return { reads: reads, parseFailures: parseFailures };
  })();
  return {
    stop: async () => {
      running = false;
      return donePromise;
    },
  };
}

async function main() {
  assert.ok(fs.existsSync(WORKER_SCRIPT), 'worker script missing: ' + WORKER_SCRIPT);

  console.log('test-238-retry-counter-fence');

  // -------------------------------------------------------------------
  // Leg A + Leg B run concurrently: leg A forks 20 real-concurrency writers
  // while leg B's reader loop hammers the same file with reads.
  // -------------------------------------------------------------------
  const legAB = makeHermeticCardFireEnv('legAB');
  try {
    const reader = makeReaderLoop(legAB.retryFile);

    const legAResultsPromise = runWorkers(legAB.dir, 'k1', BUMPS_PER_WORKER, WORKERS);
    const legAResults = await legAResultsPromise;
    const legBOutcome = await reader.stop();

    assertAllExitedZero(legAResults, 'leg A');
    ok('leg A: all ' + WORKERS + ' children exited 0');

    // Read the store the same way the production accessor does.
    process.env.MINDRIAN_HOME = legAB.dir;
    const finalCount = checkCardFire.readRetryCount('k1');
    const expected = WORKERS * BUMPS_PER_WORKER;
    assert.strictEqual(
      finalCount,
      expected,
      'leg A: expected EXACTLY ' + expected + ' (WORKERS=' + WORKERS + ' * BUMPS_PER_WORKER=' + BUMPS_PER_WORKER + '), got ' + finalCount
    );
    ok('leg A: exact count ' + finalCount + ' === ' + WORKERS + ' * ' + BUMPS_PER_WORKER + ' (no lost updates)');

    assert.ok(
      legBOutcome.reads > 0,
      'leg B: reader loop iteration count must be > 0 (got ' + legBOutcome.reads + '), a loop that never ran cannot pass vacuously'
    );
    assert.strictEqual(
      legBOutcome.parseFailures,
      0,
      'leg B: expected 0 parse failures over ' + legBOutcome.reads + ' reads, got ' + legBOutcome.parseFailures
    );
    ok('leg B: ' + legBOutcome.reads + ' concurrent reads, 0 parse failures (no torn read)');
  } finally {
    legAB.restore();
  }

  // -------------------------------------------------------------------
  // Leg C: the __session__: key-space sibling, smaller fan-out.
  // -------------------------------------------------------------------
  const legC = makeHermeticCardFireEnv('legC');
  try {
    const sessionId = 'sess-238-05-legC';
    const sessionStoreKey = checkCardFire.sessionKey(sessionId);

    const legCResults = await runWorkers(legC.dir, sessionStoreKey, SESSION_BUMPS_PER_WORKER, SESSION_WORKERS);
    assertAllExitedZero(legCResults, 'leg C');
    ok('leg C: all ' + SESSION_WORKERS + ' children exited 0');

    process.env.MINDRIAN_HOME = legC.dir;
    const sessionCount = checkCardFire.readSessionCount(sessionId);
    const expectedSession = SESSION_WORKERS * SESSION_BUMPS_PER_WORKER;
    assert.strictEqual(
      sessionCount,
      expectedSession,
      'leg C: expected EXACTLY ' + expectedSession + ' in the __session__: key space, got ' + sessionCount
    );
    ok('leg C: exact session-counter count ' + sessionCount + ' === ' + SESSION_WORKERS + ' * ' + SESSION_BUMPS_PER_WORKER);
  } finally {
    legC.restore();
  }

  // -------------------------------------------------------------------
  // Leg D: anti-vacuity control -- a single child, uncontended.
  // -------------------------------------------------------------------
  const legD = makeHermeticCardFireEnv('legD');
  try {
    const legDResults = await runWorkers(legD.dir, 'solo-key', SOLO_BUMPS, 1);
    assertAllExitedZero(legDResults, 'leg D');

    process.env.MINDRIAN_HOME = legD.dir;
    const soloCount = checkCardFire.readRetryCount('solo-key');
    assert.strictEqual(
      soloCount,
      SOLO_BUMPS,
      'leg D: expected exactly ' + SOLO_BUMPS + ' for a single uncontended child, got ' + soloCount
    );
    ok('leg D: single child, exact count ' + soloCount + ' (anti-vacuity control)');
  } finally {
    legD.restore();
  }

  console.log('PASS test-238-retry-counter-fence (' + n + ' assertions)');
}

main().then(
  () => process.exit(0),
  (err) => {
    process.stderr.write('test-238-retry-counter-fence FAIL: ' + (err && err.message || err) + '\n');
    if (err && err.stack) process.stderr.write(err.stack + '\n');
    process.exit(1);
  }
);
