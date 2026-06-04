'use strict';

/*
 * Phase 139-02 -- doctor accumulative-engine selector + watermark tests.
 *
 * Hermetic: every test uses an mkdtempSync HOME so nothing touches the real
 * ~/.mindrian. node:assert only. No network.
 *
 * Task 1 coverage (watermark helpers in lib/core/migration-snapshot.cjs):
 *   - absent ledger -> { applied_through: null, history: [] }
 *   - write then read round-trips
 *   - write with a LOWER appliedThrough does NOT regress the stored value
 *
 * Task 2 coverage (the selector in scripts/doctor.cjs::runAccumulativeEngine):
 *   - window selection: introduced in (applied_through, running] selected;
 *     introduced <= applied_through skipped; introduced > running DEFERRED
 *   - idempotency: first run advances watermark to running; immediate re-run
 *     selects ZERO (no-op)
 *   - pre-release compare: introduced 1.13.1-beta.4 with running 1.13.1-beta.4
 *     is IN the window; with running 1.13.1-beta.3 is DEFERRED
 *   - soft-fail: a runner that throws records an error finding and does NOT
 *     crash the loop
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const snap = require('../lib/core/migration-snapshot.cjs');
const doctor = require('../scripts/doctor.cjs');

let passed = 0;
function ok(label) { passed += 1; console.log('  ok - ' + label); }

function freshHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-applied-'));
}

// ---------------------------------------------------------------------------
// Task 1 -- watermark helpers
// ---------------------------------------------------------------------------

(function watermark_absent_is_empty() {
  const home = freshHome();
  const wm = snap.readDoctorApplied(home);
  assert.strictEqual(wm.applied_through, null, 'absent ledger -> applied_through null');
  assert.deepStrictEqual(wm.history, [], 'absent ledger -> empty history');
  ok('watermark: absent ledger reads as { applied_through: null, history: [] }');
})();

(function watermark_roundtrips() {
  const home = freshHome();
  const wrote = snap.writeDoctorApplied(home, { appliedThrough: '1.13.1-beta.4', ranModuleIds: ['umbilical'] });
  assert.strictEqual(wrote, true, 'write returns true');
  const wm = snap.readDoctorApplied(home);
  assert.strictEqual(wm.applied_through, '1.13.1-beta.4', 'round-trips applied_through');
  assert.strictEqual(wm.history.length, 1, 'one history record');
  assert.strictEqual(wm.history[0].applied_through, '1.13.1-beta.4', 'history record carries applied_through');
  assert.deepStrictEqual(wm.history[0].modules, ['umbilical'], 'history record carries module ids');
  assert.ok(typeof wm.history[0].at === 'string' && wm.history[0].at.length > 0, 'history record has ISO timestamp');
  ok('watermark: write then read round-trips (applied_through + history)');
})();

(function watermark_never_regresses() {
  const home = freshHome();
  snap.writeDoctorApplied(home, { appliedThrough: '1.13.1', ranModuleIds: [] });
  // Attempt to LOWER the watermark to a prerelease that sorts BEFORE 1.13.1.
  const wrote = snap.writeDoctorApplied(home, { appliedThrough: '1.13.1-beta.1', ranModuleIds: [] });
  assert.strictEqual(wrote, true, 'lower write still returns true (best-effort, appended history)');
  const wm = snap.readDoctorApplied(home);
  assert.strictEqual(wm.applied_through, '1.13.1', 'applied_through is NOT lowered');
  assert.strictEqual(wm.history.length, 2, 'history still appended on a no-regress write');
  assert.strictEqual(wm.history[1].applied_through, '1.13.1', 'appended record reflects the kept (higher) watermark');
  ok('watermark: a LOWER appliedThrough does NOT regress the stored value');
})();

(function watermark_advances_upward() {
  const home = freshHome();
  snap.writeDoctorApplied(home, { appliedThrough: '1.13.1-beta.3', ranModuleIds: [] });
  snap.writeDoctorApplied(home, { appliedThrough: '1.13.1-beta.4', ranModuleIds: ['umbilical'] });
  const wm = snap.readDoctorApplied(home);
  assert.strictEqual(wm.applied_through, '1.13.1-beta.4', 'higher prerelease advances the watermark');
  ok('watermark: a HIGHER appliedThrough advances the stored value');
})();

// ---------------------------------------------------------------------------
// Task 2 -- runAccumulativeEngine selector
// ---------------------------------------------------------------------------

assert.strictEqual(typeof doctor.runAccumulativeEngine, 'function', 'doctor exports runAccumulativeEngine');
ok('selector: runAccumulativeEngine is exported');

// Each module's runner is invoked with opts; we record invocations via a shared
// log injected through the registry so the test is fully hermetic (no runner
// files on disk).
function makeRegistry(modules) { return { schema_version: 1, modules }; }

(function selector_window_selection() {
  const home = freshHome();
  const ran = [];
  const registry = makeRegistry([
    { id: 'predates', introduced_version: '1.12.0', fix_supported: false, _check: () => ran.push('predates') },
    { id: 'in-window-a', introduced_version: '1.13.0', fix_supported: false, _check: () => ran.push('in-window-a') },
    { id: 'in-window-b', introduced_version: '1.13.1-beta.4', fix_supported: false, _check: () => ran.push('in-window-b') },
    { id: 'future', introduced_version: '1.14.0', fix_supported: false, _check: () => ran.push('future') },
  ]);
  // applied_through = 1.13.0 means (1.13.0, 1.13.1-beta.4] is the window.
  snap.writeDoctorApplied(home, { appliedThrough: '1.13.0', ranModuleIds: [] });
  const result = doctor.runAccumulativeEngine({ home, running: '1.13.1-beta.4', registry });

  assert.ok(!ran.includes('predates'), 'introduced <= applied_through is skipped');
  assert.ok(!ran.includes('in-window-a'), 'introduced == applied_through (lower bound exclusive) is skipped');
  assert.ok(ran.includes('in-window-b'), 'introduced in (applied_through, running] is selected');
  assert.ok(!ran.includes('future'), 'introduced > running is DEFERRED (never run)');

  const ids = result.selected.map((m) => m.id);
  assert.deepStrictEqual(ids, ['in-window-b'], 'result.selected lists only the in-window module');
  assert.ok(result.deferred.map((m) => m.id).includes('future'), 'result.deferred lists the future module');
  ok('selector: only modules in (applied_through, running] run; future DEFERRED');
})();

(function selector_first_run_window_is_everything() {
  const home = freshHome();
  const ran = [];
  const registry = makeRegistry([
    { id: 'a', introduced_version: '1.10.0', fix_supported: false, _check: () => ran.push('a') },
    { id: 'b', introduced_version: '1.13.1-beta.4', fix_supported: false, _check: () => ran.push('b') },
    { id: 'future', introduced_version: '2.0.0', fix_supported: false, _check: () => ran.push('future') },
  ]);
  // No watermark file -> applied_through null -> (null, running] = everything <= running.
  const result = doctor.runAccumulativeEngine({ home, running: '1.13.1-beta.4', registry });
  assert.deepStrictEqual(ran.sort(), ['a', 'b'], 'first run selects all modules <= running');
  assert.ok(!ran.includes('future'), 'future still DEFERRED on first run');
  assert.strictEqual(result.status, 'ok', 'first run status ok');
  ok('selector: first run (null watermark) selects everything <= running');
})();

(function selector_idempotent_no_op() {
  const home = freshHome();
  const ran = [];
  const registry = makeRegistry([
    { id: 'a', introduced_version: '1.13.0', fix_supported: false, _check: () => ran.push('a') },
    { id: 'b', introduced_version: '1.13.1-beta.4', fix_supported: false, _check: () => ran.push('b') },
  ]);
  const r1 = doctor.runAccumulativeEngine({ home, running: '1.13.1-beta.4', registry });
  assert.deepStrictEqual(ran.sort(), ['a', 'b'], 'first run runs both modules');
  assert.strictEqual(r1.advanced, true, 'first run advances the watermark');

  const wmAfter = snap.readDoctorApplied(home);
  assert.strictEqual(wmAfter.applied_through, '1.13.1-beta.4', 'watermark advanced to running');

  // Immediate re-run: window is (running, running] = empty -> ZERO modules.
  ran.length = 0;
  const r2 = doctor.runAccumulativeEngine({ home, running: '1.13.1-beta.4', registry });
  assert.deepStrictEqual(ran, [], 're-run selects ZERO modules (no-op)');
  assert.strictEqual(r2.selected.length, 0, 're-run result.selected is empty');
  ok('selector: re-run is a no-op (idempotent)');
})();

(function selector_prerelease_defer() {
  const home = freshHome();
  const ran = [];
  const registry = makeRegistry([
    { id: 'beta4', introduced_version: '1.13.1-beta.4', fix_supported: false, _check: () => ran.push('beta4') },
  ]);
  // running == beta.4 -> beta.4 <= beta.4 -> IN window.
  doctor.runAccumulativeEngine({ home, running: '1.13.1-beta.4', registry });
  assert.ok(ran.includes('beta4'), 'introduced beta.4 with running beta.4 is IN the window (lte)');

  // running == beta.3 -> beta.4 > beta.3 -> DEFERRED.
  const home2 = freshHome();
  const ran2 = [];
  const registry2 = makeRegistry([
    { id: 'beta4', introduced_version: '1.13.1-beta.4', fix_supported: false, _check: () => ran2.push('beta4') },
  ]);
  const result2 = doctor.runAccumulativeEngine({ home: home2, running: '1.13.1-beta.3', registry: registry2 });
  assert.ok(!ran2.includes('beta4'), 'introduced beta.4 with running beta.3 is DEFERRED');
  assert.ok(result2.deferred.map((m) => m.id).includes('beta4'), 'beta.4 listed as deferred against beta.3');
  ok('selector: prerelease labels compare correctly (beta.4 in-window vs deferred)');
})();

(function selector_soft_fail_on_bad_runner() {
  const home = freshHome();
  const ran = [];
  const registry = makeRegistry([
    { id: 'good-before', introduced_version: '1.13.0', fix_supported: false, _check: () => ran.push('good-before') },
    { id: 'bad', introduced_version: '1.13.1-beta.1', fix_supported: false, _check: () => { throw new Error('boom'); } },
    { id: 'good-after', introduced_version: '1.13.1-beta.4', fix_supported: false, _check: () => ran.push('good-after') },
  ]);
  const result = doctor.runAccumulativeEngine({ home, running: '1.13.1-beta.4', registry });
  // The bad runner must not crash the loop -- the good-after module still runs.
  assert.ok(ran.includes('good-before'), 'module before the bad one ran');
  assert.ok(ran.includes('good-after'), 'module after the bad one still ran (loop did not crash)');
  const errors = result.findings.filter((f) => f.status === 'error');
  assert.ok(errors.some((f) => f.id === 'bad'), 'an error finding was recorded for the bad runner');
  assert.strictEqual(result.status, 'ok', 'engine status stays ok despite a bad runner (soft-fail)');
  ok('selector: a runner that throws records an error finding and does NOT crash the loop');
})();

(function selector_dry_run_does_not_advance() {
  const home = freshHome();
  const ran = [];
  const registry = makeRegistry([
    { id: 'a', introduced_version: '1.13.1-beta.4', fix_supported: false, _check: () => ran.push('a') },
  ]);
  const result = doctor.runAccumulativeEngine({ home, running: '1.13.1-beta.4', registry, dryRun: true });
  assert.ok(result.selected.map((m) => m.id).includes('a'), 'dry-run still SELECTS the module');
  assert.strictEqual(result.advanced, false, 'dry-run does NOT advance the watermark');
  const wm = snap.readDoctorApplied(home);
  assert.strictEqual(wm.applied_through, null, 'dry-run leaves the watermark untouched');
  ok('selector: --dry-run selects + reports but does not advance the watermark');
})();

(function selector_unresolved_running_skips() {
  const home = freshHome();
  const registry = makeRegistry([
    { id: 'a', introduced_version: '1.13.0', fix_supported: false, _check: () => {} },
  ]);
  const result = doctor.runAccumulativeEngine({ home, running: null, registry });
  assert.strictEqual(result.status, 'skip', 'unresolved running version -> status skip (soft-fail)');
  ok('selector: unresolved running version soft-fails to status:skip');
})();

console.log('\nALL PASS (' + passed + ' assertions)');
