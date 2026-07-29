#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 236 Plan 02 Task 3 -- the WAL SNAPSHOT-VISIBILITY gate, ROADMAP success
 * criterion 2 for GRAPHDB-01.
 *
 * OBSERVED NUMBERS: Node v22.23.1, journal_mode=wal, 600 artifacts, a 197 ms
 * rebuild, 3987 samples of which 3678 landed inside the rebuild window, 0 failed
 * reads, and EXACTLY 2 distinct snapshots. Full record in the OBSERVATION RECORD
 * block at the bottom of this header.
 *
 * WHAT THIS PROVES. A second OS process, holding its own read-only connection to
 * the same room.db, polls the nodes table THROUGHOUT a live rebuildGraph call
 * and never observes an empty or partially-reindexed table. Every single sample
 * matches either the complete pre-rebuild population or the complete
 * post-rebuild population, with nothing in between.
 *
 * WHY IT IS OBSERVED RATHER THAN CITED. ROADMAP criterion 2 states the WAL claim
 * must be "proven by observation on this Node/SQLite combination, not asserted
 * from docs". The RCA already reasons the behavior out from WAL semantics
 * (`.planning/debug/graph-rebuild-truncates-memory-journal.md`, section "SQLite
 * Transaction and Concurrency Analysis", item 3). This file does not restate
 * that reasoning: it measures it, on this runtime, and writes the measurement
 * down.
 *
 * WHY THE READER IS A SEPARATE PROCESS. rebuildGraph's file walk is synchronous
 * and holds the event loop for the whole transaction, so an in-process
 * setInterval would not fire even once during the window it claims to sample. A
 * same-process poll would report zero samples, or samples taken only before and
 * after, and would satisfy the criterion in name only. The reader therefore runs
 * out of process (tests/helpers/wal-reader-probe-236.cjs, forked).
 *
 * THE CONFIGURATION UNDER TEST is the real one: lib/core/room-db.cjs opens every
 * handle with `timeout: 5000`, then `PRAGMA journal_mode = WAL` and
 * `PRAGMA synchronous = NORMAL` (room-db.cjs:259-265). The parent opens the room
 * through openRoomDb, so nothing here is a synthetic concurrency setup.
 *
 * WHY THE PARENT OPENS THE ROOM BEFORE FORKING. A read-only connection to a WAL
 * database cannot create the -shm shared-memory index. The fixture closes its
 * handle when seeding finishes, which checkpoints and removes the WAL sidecars,
 * so the probe would fail to open. The parent therefore opens its own handle
 * first and holds it across the whole run.
 *
 * THE PRE AND POST POPULATIONS ARE MADE DIFFERENT ON PURPOSE. One seeded
 * artifact file is deleted from disk before the rebuild, so the post-rebuild
 * Artifact count is one lower than the pre-rebuild count. If the two snapshots
 * were identical, scenario 2's "every sample matches one of the two" would be a
 * single-value check and would say much less than it appears to.
 *
 * MUTATION THAT TURNS THIS RED. Removing the BEGIN/COMMIT/ROLLBACK wrap from
 * rebuildGraph turns scenario 2 red: without it the scoped DELETE commits on its
 * own, immediately, and a concurrent reader sees the indexer-owned rows vanish
 * and then reappear one file at a time. That is a real torn-read window. If the
 * mutation does NOT turn scenario 2 red, the sample rate is too low to catch the
 * window and ARTIFACT_COUNT must be raised until it does; a concurrency test
 * that cannot observe the window it claims to guard is decorative. See the
 * OBSERVATION RECORD for the tuning that was actually needed.
 *
 * Scenarios:
 *   1. NON-VACUITY, and the load-bearing scenario in this file: the probe
 *      collected at least MIN_SAMPLES successful samples, and at least one
 *      sample timestamp falls STRICTLY INSIDE the parent's rebuild window
 *      (tStart < ts < tEnd). Without this, a probe that started after the
 *      rebuild finished, or sampled too slowly to hit the window, would pass
 *      scenarios 2 and 3 trivially while proving nothing (threat T-236-05).
 *   2. EVERY sample, not a spot check, matches the FULL pre-rebuild population
 *      or the FULL post-rebuild population. No sample shows an empty nodes
 *      table, and no sample shows a partial state such as memory_event present
 *      with Artifact below its pre-rebuild value.
 *   3. EVERY sample, without exception, shows memory_event, claim and
 *      opportunity at their seeded values. Under 236-01's scoped DELETE those
 *      rows are never touched at all, so no reader should ever see them absent
 *      in either snapshot.
 *
 * ORPHAN SAFETY (threat T-236-04): the forked probe is killed in a `finally`, so
 * a failing assertion cannot leave a process spinning on a temp dir. The probe
 * additionally self-limits by sample count and wall clock.
 *
 * tests/ is on the scripts/check-substrate.cjs ALLOWED_DIRECT_IMPORT list.
 * Harness: the plain ok/fail/scenario pass-counter from
 * tests/test-236-rebuild-preserves-journal.cjs, exiting nonzero when failed > 0.
 * No em-dashes (CLAUDE.md hard rule). CJS only, zero new deps, zero network.
 * No file under lib/ or scripts/ is modified by this test.
 *
 * ===========================================================================
 * OBSERVATION RECORD (this is what discharges "proven by observation")
 * ===========================================================================
 * Filled in from a real run. A future reader checks these when the Node version
 * moves; a large drift in the sample rate means MIN_SAMPLES needs revisiting.
 *
 *   Node version                  : v22.23.1
 *   journal_mode readback         : wal (read back off the real openRoomDb handle)
 *   ARTIFACT_COUNT                : 600
 *   rebuild wall-clock duration   : 197 ms
 *   total successful samples      : 3987
 *   samples inside the window     : 3678
 *   failed reads (SQLITE_BUSY etc): 0
 *   distinct snapshots seen       : 2
 *
 * The two distinct snapshots, and there were only ever two:
 *   {"Artifact":600,"Section":1,"claim":1,"memory_event":2,"opportunity":1}
 *   {"Artifact":599,"Section":1,"claim":1,"memory_event":2,"opportunity":1}
 *
 * Sample rate: 3678 in-window samples across a 197 ms rebuild, about 19 samples
 * per millisecond. MIN_SAMPLES is set to 40, roughly a hundredfold margin, so a
 * loaded machine cannot make this flaky while the floor still fails loudly if
 * the probe never really ran.
 *
 * TUNING NEEDED TO MAKE THE MUTATION BITE: none. ARTIFACT_COUNT 600 caught the
 * torn window on the first attempt, and by a wide margin.
 *
 * THE SAME RUN WITH THE TRANSACTION WRAP REMOVED, for contrast:
 *   rebuild 573 ms, 22450 samples, 22111 in window, 0 failed reads, and
 *   594 DISTINCT snapshots instead of 2. The first offending sample showed
 *   {"claim":1,"memory_event":2,"opportunity":1}: every Artifact and Section row
 *   gone, none rebuilt yet. The reader then watched the room refill one artifact
 *   at a time, Artifact:1, Artifact:2, and so on up to 599.
 *
 * A DETAIL WORTH KEEPING. Under that mutation scenario 3 stayed GREEN. That is
 * correct and it is informative: 236-01's scoped DELETE means memory_event, the
 * confirmed claim and the opportunity are never touched even when atomicity is
 * gone. Scenario 2 measures the transaction wrap; scenario 3 measures the DELETE
 * scope. Each is load-bearing for a different guard, and the mutation split
 * proves neither is incidentally covered by the other.
 * ===========================================================================
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const lazygraph = require(path.join(REPO, 'lib', 'core', 'lazygraph-ops.cjs'));

const {
  buildFixtureRoom236,
  countPopulations,
} = require(path.join(REPO, 'tests', 'helpers', 'fixture-room-236.cjs'));

const PROBE = path.join(REPO, 'tests', 'helpers', 'wal-reader-probe-236.cjs');

// TUNED BY MEASUREMENT, not guessed. See the OBSERVATION RECORD above.
const ARTIFACT_COUNT = 600;
// A concrete floor, derived from the measured sample rate with generous margin
// so an ordinarily loaded machine does not turn this flaky. See the record.
const MIN_SAMPLES = 40;
// How long the parent will wait for the probe's first sample before declaring
// the probe dead rather than slow.
const FIRST_SAMPLE_TIMEOUT_MS = 20000;

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}

async function scenario(name, fn) {
  try { await fn(); ok(name); } catch (e) { fail(name, e); }
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

function sleepSync(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch (_e) { /* fall through */ }
}

// The node-type-only projection of countPopulations, which is the shape the
// probe reports. The underscore-prefixed rollup keys are stripped so a sample
// can be compared against a snapshot with deepEqual.
function nodeCountsOnly(counts) {
  const out = {};
  for (const k of Object.keys(counts)) {
    if (k.charAt(0) === '_') continue;
    out[k] = counts[k];
  }
  return out;
}

// ---------- Shared observation, taken once during setup ----------

const observed = {
  scratch: null,
  samplesPath: null,
  stopPath: null,
  child: null,
  pre: null,
  post: null,
  tStart: 0,
  tEnd: 0,
  samples: [],
  good: [],
  errors: [],
  journalMode: null,
  rebuildResult: null,
};
let setupError = null;

function requireSetup() {
  assert.equal(setupError, null, 'setup must have succeeded: ' + (setupError && setupError.message));
}

function waitForChildExit(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve({ code: child.exitCode, signal: child.signalCode });
      return;
    }
    child.once('exit', (code, signal) => resolve({ code: code, signal: signal }));
  });
}

async function setup() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-236-wal-'));
  observed.scratch = scratch;

  const fx = await buildFixtureRoom236(scratch, { artifactCount: ARTIFACT_COUNT });

  // Make the post-rebuild population DIFFER from the pre-rebuild one, so
  // scenario 2 discriminates between two distinct snapshots rather than one.
  fs.rmSync(fx.artifactFiles[0]);

  observed.samplesPath = path.join(scratch, 'wal-samples.jsonl');
  observed.stopPath = path.join(scratch, 'STOP');
  fs.writeFileSync(observed.samplesPath, '', 'utf8');

  // Open the room FIRST (creates the -wal / -shm sidecars a read-only probe
  // needs) and hold the handle across the whole run.
  const db = roomDb.openRoomDb(fx.roomDir);
  try {
    observed.journalMode = db.prepare('PRAGMA journal_mode').get().journal_mode;
    observed.pre = nodeCountsOnly(countPopulations(db));

    const child = fork(PROBE, [fx.roomDir, observed.samplesPath, observed.stopPath], {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    observed.child = child;

    // Block until the probe has written its FIRST sample, so "the probe was
    // live before the rebuild started" is a measured fact rather than a hope.
    // A synchronous wait is correct here: the parent's own rebuild is
    // synchronous too, and the forked child runs independently of this
    // process's event loop.
    const deadline = Date.now() + FIRST_SAMPLE_TIMEOUT_MS;
    let firstSampleSeen = false;
    while (Date.now() < deadline) {
      if (fs.statSync(observed.samplesPath).size > 0) { firstSampleSeen = true; break; }
      if (child.exitCode !== null) break;
      sleepSync(10);
    }
    assert.equal(
      firstSampleSeen, true,
      'the probe must produce its first sample before the rebuild starts. '
        + 'child exitCode=' + child.exitCode + ' (2 = cannot open db, 3 = cannot '
        + 'write output)'
    );

    observed.tStart = Date.now();
    observed.rebuildResult = await lazygraph.rebuildGraph(db, fx.roomDir);
    observed.tEnd = Date.now();

    // Stop the probe and wait for it to flush and exit.
    fs.writeFileSync(observed.stopPath, 'stop\n', 'utf8');
    const exited = await waitForChildExit(child);
    assert.equal(
      exited.code, 0,
      'the probe must exit 0, got code=' + exited.code + ' signal=' + exited.signal
        + ' (2 = cannot open db, 3 = cannot write output, 4 = bad argv)'
    );

    observed.post = nodeCountsOnly(countPopulations(db));
  } finally {
    roomDb.closeRoomDb(db);
  }

  const raw = fs.readFileSync(observed.samplesPath, 'utf8').split('\n').filter((l) => l.length > 0);
  observed.samples = raw.map((l) => JSON.parse(l));
  observed.good = observed.samples.filter((s) => !s.error);
  observed.errors = observed.samples.filter((s) => s.error);
}

// ---------- Scenario 1: the probe really sampled DURING the rebuild ----------

async function scenario1() {
  requireSetup();
  assert.ok(
    observed.good.length >= MIN_SAMPLES,
    'NON-VACUITY: the probe must have collected at least ' + MIN_SAMPLES
      + ' successful samples, got ' + observed.good.length
      + '. Too few samples means the window was never really watched.'
  );
  const inWindow = observed.good.filter((s) => s.ts > observed.tStart && s.ts < observed.tEnd);
  assert.ok(
    inWindow.length > 0,
    'NON-VACUITY: at least one sample timestamp must fall STRICTLY INSIDE the '
      + 'rebuild window [' + observed.tStart + ', ' + observed.tEnd + ']. Without '
      + 'this, a probe that only sampled before and after the rebuild would pass '
      + 'every other scenario while proving nothing about concurrency.'
  );
  assert.ok(
    observed.tEnd > observed.tStart,
    'the rebuild must have taken measurable wall-clock time, got '
      + (observed.tEnd - observed.tStart) + 'ms'
  );
  assert.equal(
    observed.errors.length, 0,
    'the concurrent reader must never fail a read, got '
      + observed.errors.length + ' failed reads: '
      + JSON.stringify(observed.errors.slice(0, 3))
  );
}

// ---------- Scenario 2: no sample shows an empty or partial nodes table ----------

async function scenario2() {
  requireSetup();
  assert.notDeepEqual(
    observed.pre, observed.post,
    'the pre and post populations must DIFFER, otherwise the match below is a '
      + 'single-value check: pre ' + JSON.stringify(observed.pre)
      + ' post ' + JSON.stringify(observed.post)
  );

  const preJson = JSON.stringify(observed.pre);
  const postJson = JSON.stringify(observed.post);
  const offenders = [];
  for (let i = 0; i < observed.good.length; i += 1) {
    const s = observed.good[i];
    const j = JSON.stringify(nodeCountsOnly(s.counts));
    if (j !== preJson && j !== postJson) {
      offenders.push({ index: i, ts: s.ts, counts: s.counts });
      if (offenders.length >= 5) break;
    }
  }
  assert.deepEqual(
    offenders, [],
    'TORN READ OBSERVED: every one of the ' + observed.good.length + ' samples '
      + 'must match the FULL pre-rebuild population ' + preJson + ' or the FULL '
      + 'post-rebuild population ' + postJson + '. These did not (first 5): '
      + JSON.stringify(offenders)
  );

  const empties = observed.good.filter((s) => s.total === 0);
  assert.equal(
    empties.length, 0,
    'a concurrent reader must NEVER observe an empty nodes table, saw '
      + empties.length + ' empty samples'
  );
}

// ---------- Scenario 3: the irreplaceable rows are never absent ----------

async function scenario3() {
  requireSetup();
  const expected = {};
  for (const type of ['memory_event', 'claim', 'opportunity']) {
    assert.ok(
      observed.pre[type] > 0,
      'the fixture must have seeded at least one ' + type + ' row, got '
        + JSON.stringify(observed.pre)
    );
    assert.equal(
      observed.post[type], observed.pre[type],
      type + ' must be untouched by the rebuild on both sides of the window'
    );
    expected[type] = observed.pre[type];
  }

  const offenders = [];
  for (let i = 0; i < observed.good.length; i += 1) {
    const c = observed.good[i].counts;
    for (const type of Object.keys(expected)) {
      if (c[type] !== expected[type]) {
        offenders.push({ index: i, ts: observed.good[i].ts, type: type, saw: c[type], want: expected[type] });
        break;
      }
    }
    if (offenders.length >= 5) break;
  }
  assert.deepEqual(
    offenders, [],
    'EVERY sample must show memory_event, claim and opportunity at their seeded '
      + 'values ' + JSON.stringify(expected) + '. Under 236-01 scoped DELETE these '
      + 'rows are never touched at all, so no reader should ever see them absent '
      + 'in either snapshot. These did not (first 5): ' + JSON.stringify(offenders)
  );
}

// ---------- Runner ----------

(async () => {
  process.stdout.write(
    '\nPhase 236-02 Task 3: WAL concurrent-reader visibility gate (ROADMAP criterion 2)\n\n'
  );

  try {
    await setup();
  } catch (e) {
    setupError = e;
    fail('setup: fork the probe, run a live rebuild, collect the samples', e);
  }

  await scenario('1. the probe sampled DURING the live rebuild window (non-vacuity)', scenario1);
  await scenario('2. EVERY sample shows a full pre or full post population, never empty or partial', scenario2);
  await scenario('3. EVERY sample shows memory_event, claim and opportunity at their seeded values', scenario3);

  // Orphan safety (T-236-04): the probe is killed here whatever happened above.
  try {
    if (observed.child && observed.child.exitCode === null) observed.child.kill('SIGKILL');
  } catch (_e) { /* best-effort */ }

  const distinct = new Set(observed.good.map((s) => JSON.stringify(nodeCountsOnly(s.counts))));
  process.stdout.write(
    '\n  OBSERVED  node=' + process.version
      + '  journal_mode=' + observed.journalMode
      + '  artifacts=' + ARTIFACT_COUNT
      + '  rebuild=' + (observed.tEnd - observed.tStart) + 'ms'
      + '  samples=' + observed.good.length
      + '  inWindow=' + observed.good.filter((s) => s.ts > observed.tStart && s.ts < observed.tEnd).length
      + '  errors=' + observed.errors.length
      + '  distinctSnapshots=' + distinct.size + '\n'
  );
  process.stdout.write('  SNAPSHOTS ' + JSON.stringify(Array.from(distinct)) + '\n');

  if (observed.scratch) rmrf(observed.scratch);

  process.stdout.write('\n  passed: ' + passed + '  failed: ' + failed + '\n\n');
  if (failed > 0) process.exit(1);
})();
