'use strict';
/*
 * Phase 145-03 Task 1 -- Scout cadence-fires + throttle acceptance suite
 * (SCHED-01 + SCHED-02).
 *
 * Proves Success Criterion 1 and 2 of Phase 145 by INSTRUMENTATION, not promise:
 * the scout suite fires on a cadence WITHOUT anyone typing /mos:scout, the four
 * SCHED-02 sensors fire on that same run, the throttle blocks a re-fire inside
 * the interval (no every-session runaway), and a no-room invocation soft-fails
 * (exit 0) so the cadence can never crash its host hook.
 *
 * Units under test (Plan 01, REAL -- no stubs, the runner is driven directly):
 *   scripts/scout-cadence-runner.cjs   the throttled 10-sensor composer
 *   scripts/scout-cadence-guard.cjs    the LOCAL throttle + safe-auto-fire guard
 *
 * The SCHED-02 four map onto the runner's emitted step names like so:
 *   whitespace recompute  -> compute-whitespace-gaps / whitespace-to-graph
 *   reverse-salient       -> detect-reverse-salients
 *   opportunity-bank scan -> opportunity-bank-scan
 *   competitor watch      -> competitor-watch (emitted as a public-SIGNAL query plan)
 *
 * sklearn-tolerance: a CI box without scikit-learn degrades the three Python
 * steps (compute-hsi / detect-reverse-salients / compute-whitespace-gaps) to
 * status "skipped". This suite asserts each SCHED-02 step is PRESENT in steps[]
 * (the suite ATTEMPTED it), not that sklearn is installed. When sklearn is
 * absent the runner emits a single "hsi-recompute"/"detect-reverse-salients"/
 * "whitespace-recompute" skipped triple; this suite accepts either the live
 * Python step names or the skipped-degraded names for the reverse-salient and
 * whitespace presence assertions.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const RUNNER = path.join(REPO_ROOT, 'scripts', 'scout-cadence-runner.cjs');
const GUARD = path.join(REPO_ROOT, 'scripts', 'scout-cadence-guard.cjs');
const guard = require(GUARD);

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

const TMP_ROOMS = [];

/**
 * Build a minimal fixture room: STATE.md + ROOM.md + a couple of sections each
 * with their own ROOM.md (ICM Layer 0). os.tmpdir() based; cleaned up in finally.
 * @returns {string} absolute room path
 */
function makeFixtureRoom() {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-145-fires-'));
  TMP_ROOMS.push(roomDir);
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '# Room\n');
  fs.writeFileSync(
    path.join(roomDir, 'STATE.md'),
    '---\nventure_stage: exploration\nstage: exploration\n---\n# State\n'
  );
  const sections = [
    ['problem-definition', 'We build quantum brain imaging for early cancer detection in clinical trials.'],
    ['market-analysis', 'The diagnostics market is fragmented across imaging modalities and reimbursement paths.'],
  ];
  for (const [name, body] of sections) {
    const dir = path.join(roomDir, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'ROOM.md'), `# ${name}\n\n${body}\n`);
  }
  return roomDir;
}

/**
 * Run the real runner against a room and return its parsed --json summary.
 * Never throws on a non-zero child status (the runner is contracted to exit 0);
 * surfaces stderr in the thrown assertion message if JSON cannot be parsed.
 * @param {string} roomDir
 * @param {string[]} extraArgs
 * @returns {{ exit: number, summary: object, raw: string }}
 */
function runRunner(roomDir, extraArgs) {
  const argv = [RUNNER, roomDir, '--json', ...(extraArgs || [])];
  let raw = '';
  let exit = 0;
  try {
    raw = execFileSync('node', argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    exit = typeof e.status === 'number' ? e.status : 1;
    raw = e.stdout ? String(e.stdout) : '';
  }
  let summary;
  try {
    summary = JSON.parse(raw);
  } catch (e) {
    throw new Error('runner did not emit parseable JSON (exit ' + exit + '): ' + raw.slice(0, 400));
  }
  return { exit, summary, raw };
}

/** Clear the LOCAL throttle file for a room so a fresh run is unthrottled. */
function clearThrottle(roomDir) {
  try { fs.rmSync(guard.lastRunFile(roomDir), { force: true }); } catch (_e) { /* ignore */ }
}

/** Backdate the LOCAL throttle file past the interval so the next run fires. */
function backdateThrottle(roomDir, hoursAgo) {
  const file = guard.lastRunFile(roomDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const past = new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();
  fs.writeFileSync(file, past + '\n');
}

function stepNames(summary) {
  return (summary.steps || []).map(s => s.name);
}

// ---------------------------------------------------------------------------
// Test 1 + Test 2: SCHED-01 fires the full scout suite, SCHED-02 four present
// ---------------------------------------------------------------------------

(function test_schedCadenceFires() {
  const label = 'Test 1+2 (SCHED-01 + SCHED-02): a single fired run runs the full scout suite plus the SCHED-02 four without manual invocation';
  let roomDir;
  try {
    roomDir = makeFixtureRoom();
    clearThrottle(roomDir);

    // --force is NOT used here: a fresh room has no throttle file, so shouldFire
    // returns true and the suite fires on its own cadence -- nobody typed /mos:scout.
    const { exit, summary } = runRunner(roomDir, []);

    assert.equal(exit, 0, label + ': runner must exit 0');
    assert.equal(summary.fired, true, label + ': a fresh room must fire (SCHED-01)');
    assert.equal(summary.throttled, false, label + ': a fresh room is not throttled');

    const names = stepNames(summary);

    // SCHED-01: the six scout sub-sensors are present in the single fired run.
    // (snapshot, health-check, deadline-monitor, competitor query plan, hsi, opportunity-scan)
    assert.ok(names.includes('sentinel-snapshot'), label + ': scout snapshot present');
    assert.ok(names.includes('sentinel-health-check'), label + ': scout health-check present');
    assert.ok(names.includes('sentinel-deadline-monitor'), label + ': scout deadline-monitor present');
    assert.ok(names.includes('competitor-watch'), label + ': competitor query-plan present');
    assert.ok(
      names.includes('compute-hsi') || names.includes('hsi-recompute'),
      label + ': HSI recompute present (live or sklearn-absent skipped)'
    );
    assert.ok(
      names.includes('opportunity-bank-scan'),
      label + ': opportunity scan present'
    );

    // SCHED-02: the four scheduled sensors appear in the SAME fired run.
    // 1. whitespace recompute
    assert.ok(
      names.includes('compute-whitespace-gaps') || names.includes('whitespace-to-graph') || names.includes('whitespace-recompute'),
      label + ': SCHED-02 whitespace recompute present'
    );
    // 2. reverse-salient
    assert.ok(
      names.includes('detect-reverse-salients'),
      label + ': SCHED-02 reverse-salient present (emitted even when sklearn-absent as a skipped step)'
    );
    // 3. opportunity-bank scan (also a SCHED-02 sensor)
    assert.ok(
      names.includes('opportunity-bank-scan'),
      label + ': SCHED-02 opportunity-bank scan present'
    );
    // 4. competitor watch (also a SCHED-02 sensor)
    assert.ok(
      names.includes('competitor-watch'),
      label + ': SCHED-02 competitor watch present'
    );

    // Every step carries a numeric exit field (the D-03 capture-not-swallow contract).
    for (const s of summary.steps) {
      assert.equal(typeof s.exit, 'number', label + ': step ' + s.name + ' must carry a numeric exit');
      assert.equal(typeof s.status, 'string', label + ': step ' + s.name + ' must carry a status string');
    }

    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

// ---------------------------------------------------------------------------
// Test 3: throttle blocks a re-fire inside the interval; fires again after backdating
// ---------------------------------------------------------------------------

(function test_throttleBlocksReFire() {
  const label = 'Test 3 (throttle): a re-fire inside the interval is blocked (zero sensors), and fires again after backdating past the interval';
  let roomDir;
  try {
    roomDir = makeFixtureRoom();
    clearThrottle(roomDir);

    // First run fires and arms the throttle.
    const first = runRunner(roomDir, []);
    assert.equal(first.summary.fired, true, label + ': first run fires');

    // Immediate re-run WITHOUT --force: the throttle must block it.
    const second = runRunner(roomDir, []);
    assert.equal(second.exit, 0, label + ': throttled run still exits 0');
    assert.equal(second.summary.fired, false, label + ': throttled run does not fire');
    assert.equal(second.summary.throttled, true, label + ': second run reports throttled');
    assert.equal(
      (second.summary.steps || []).length, 0,
      label + ': a throttled run runs zero sensors (no every-session runaway)'
    );
    assert.ok(second.summary.next_eligible, label + ': throttled run reports next_eligible');

    // Backdate the last-run timestamp past the interval -> it must fire again.
    backdateThrottle(roomDir, 48);
    const third = runRunner(roomDir, []);
    assert.equal(third.summary.fired, true, label + ': fires again after backdating past the interval');
    assert.ok((third.summary.steps || []).length > 0, label + ': the re-fired run runs sensors again');

    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

// ---------------------------------------------------------------------------
// Test 4: no-room soft-fail (exit 0, fired:false) -- the hook contract
// ---------------------------------------------------------------------------

(function test_noRoomSoftFail() {
  const label = 'Test 4 (no-room soft-fail): a nonexistent room path exits 0 and fired:false (never crashes the host hook)';
  try {
    const ghost = path.join(os.tmpdir(), 'mos-145-no-such-room-' + Date.now());
    assert.equal(fs.existsSync(ghost), false, label + ': fixture precondition -- path must not exist');
    const { exit, summary } = runRunner(ghost, []);
    assert.equal(exit, 0, label + ': exit 0 on a missing room');
    assert.equal(summary.fired, false, label + ': fired:false on a missing room');
    assert.ok(summary.notice, label + ': a missing room surfaces a non-fatal notice');
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

// ---------------------------------------------------------------------------
// cleanup + report
// ---------------------------------------------------------------------------

for (const roomDir of TMP_ROOMS) {
  try { clearThrottle(roomDir); } catch (_e) { /* ignore */ }
  try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
}

process.stdout.write('\n');
process.stdout.write('Scout cadence-fires + throttle (SCHED-01 + SCHED-02): ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
