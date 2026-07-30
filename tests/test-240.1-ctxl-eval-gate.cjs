'use strict';
// Phase 240.1 Plan 06 Task 3 -- the gate that proves the null-delta and
// discriminating-variable semantics of scripts/ctxl-eval.cjs actually bite.
//
// Imports the harness's exported functions directly for scenarios that only
// need the pure check functions; shells out via spawnSync(process.execPath,
// [...]) only where the CLI surface itself is under test (the selftest, the
// suite roll-ups, the run-record file-guarded checks, and the live-leg skip).
//
// Hermetic: every scenario allocates its OWN fs.mkdtempSync root, removed in
// a finally. No network, no LLM call, no write outside a temp root.
//
// SCENARIO 3 IS THE SC3 PROOF (the literal encoding of "if no accuracy delta
// is measurable at this scale, that is itself the finding to record, not a
// reason to skip the gate and not a reason to fail it"): a run record with
// delta: 0 and delta: -0.25, both carrying a populated finding, are both a
// PASS from --check delta-record. This test file contains NO assertion
// comparing with_context_score to without_context_score anywhere -- that
// comparison is exactly what Resolution 1 forbids inside the harness itself,
// and asserting it here would defeat the point of scenario 3.
//
// MUTATION PROOFS (M1/M2/M3) are executed by hand during plan execution and
// transcribed in 240.1-06-SUMMARY.md, not built into this file -- editing the
// harness source from inside its own gate test on every run would be fragile
// and is not what the plan's action text asks for. M3's non-coverage by this
// gate is stated honestly in the summary as a known limitation.
//
// NO em-dashes or en-dashes in this file (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const HARNESS_PATH = path.join(REPO_ROOT, 'scripts', 'ctxl-eval.cjs');
const ctxlEval = require(HARNESS_PATH);
const { buildFixtureRoom2401, readTaskCorpus } = require('./helpers/fixture-room-2401.cjs');

let passed = 0;
let failed = 0;

function pass(label) { passed += 1; process.stdout.write('  PASS  ' + label + '\n'); }
function fail(label, err) {
  failed += 1;
  process.stdout.write('  FAIL  ' + label + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}
function assertCheck(cond, label) {
  try {
    assert.ok(cond, label);
    pass(label);
  } catch (e) {
    fail(label, e);
  }
}

function withTmpRoot(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxl-eval-gate-test-'));
  try {
    return fn(tmp);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
}

function runCli(args, envOverrides) {
  const env = Object.assign({}, process.env, envOverrides || {});
  return spawnSync(process.execPath, [HARNESS_PATH].concat(args), {
    encoding: 'utf8',
    timeout: 60000,
    env: env,
  });
}

function writeRunRecord(dir, record) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, ctxlEval.RUN_RECORD_FILENAME), JSON.stringify(record, null, 2));
}

// A well-formed record. n_tasks is pinned to the REAL corpus length so
// checkDeltaRecord's cross-check against readTaskCorpus() succeeds.
function wellFormedRecord(overrides) {
  const base = {
    n_tasks: readTaskCorpus().length,
    with_context_score: 0.5,
    without_context_score: 0.375,
    delta: 0.125,
    finding: 'Accuracy was higher with room context by 12.5 percentage points across 8 tasks.',
    model_id: 'gate-test-model',
    run_at: '2026-07-30T00:00:00Z',
    total_cost_usd: 0,
    rows: [],
  };
  return Object.assign(base, overrides || {});
}

function summarize(res) {
  return 'status=' + res.status + ' stdout=' + JSON.stringify(String(res.stdout || '').slice(-400));
}

// --- Scenario 1: SELFTEST -------------------------------------------------
function scenario1Selftest() {
  const res = runCli(['--selftest']);
  assertCheck(res.status === 0, 'scenario 1: --selftest exits 0 (' + summarize(res) + ')');
  assertCheck(/twelve PASS\/FAIL directions/.test(String(res.stdout || '')), 'scenario 1: --selftest reports twelve directions');
}

// --- Scenario 2: SUITE CODE ------------------------------------------------
function scenario2SuiteCode() {
  withTmpRoot((tmp) => {
    const res = runCli(['--suite', 'code', '--out', tmp]);
    assertCheck(res.status === 0, 'scenario 2: --suite code exits 0 against the synthetic fixture (' + summarize(res) + ')');
    const out = String(res.stdout || '');
    assertCheck(/^SKIP\s+cost-ledger/m.test(out), 'scenario 2: cost-ledger is explicitly SKIPPED, never a silent PASS');
    assertCheck(/^SKIP\s+delta-record/m.test(out), 'scenario 2: delta-record is explicitly SKIPPED, never a silent PASS');
    assertCheck(!/^FAIL/m.test(out), 'scenario 2: no check FAILS against the real synthetic fixture');
  });
}

// --- Scenario 3: NULL DELTA IS A PASS (the SC3 proof) ----------------------
function scenario3NullDeltaIsPass() {
  withTmpRoot((tmp) => {
    writeRunRecord(tmp, wellFormedRecord({ delta: 0 }));
    let res = runCli(['--check', 'delta-record', '--out', tmp]);
    assertCheck(res.status === 0, 'scenario 3: a well-formed record with delta 0 is a PASS (' + summarize(res) + ')');

    writeRunRecord(tmp, wellFormedRecord({ delta: -0.25 }));
    res = runCli(['--check', 'delta-record', '--out', tmp]);
    assertCheck(res.status === 0, 'scenario 3: a well-formed record with delta -0.25 is a PASS (' + summarize(res) + ')');
  });
}

// --- Scenario 4: MALFORMED RECORD IS A FAIL --------------------------------
function scenario4MalformedIsFail() {
  withTmpRoot((tmp) => {
    const record = wellFormedRecord({});
    delete record.finding;
    writeRunRecord(tmp, record);
    const res = runCli(['--check', 'delta-record', '--out', tmp]);
    assertCheck(res.status !== 0, 'scenario 4: a record missing finding is a FAIL (nonzero exit)');
    const combined = String(res.stdout || '') + String(res.stderr || '');
    assertCheck(combined.indexOf('finding') !== -1, 'scenario 4: the failure names the missing finding field');
  });
}

// --- Scenario 5: NO RECORD IS A SKIP ---------------------------------------
function scenario5NoRecordIsSkip() {
  withTmpRoot((tmp) => {
    const res = runCli(['--check', 'delta-record', '--out', tmp]);
    assertCheck(res.status === 0, 'scenario 5: no run record on disk exits 0');
    assertCheck(/^SKIP/m.test(String(res.stdout || '')), 'scenario 5: no run record on disk prints an explicit SKIP line');
  });
}

// --- Scenario 6: PART 8 REFUSAL --------------------------------------------
function scenario6Part8Refusal() {
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxl-gate-fakehome-'));
  const prior = process.env.MINDRIAN_ROOMS_HOME;
  try {
    process.env.MINDRIAN_ROOMS_HOME = fakeHome;
    const insideFake = fs.mkdtempSync(path.join(fakeHome, 'room-'));
    const room = buildFixtureRoom2401(insideFake);
    const result = ctxlEval.checkPart8Hygiene({ room: room });
    assertCheck(result.ok === false, 'scenario 6: a room dir resolving under $MINDRIAN_ROOMS_HOME fails part8-hygiene');
    const named = (result.violations || []).some((v) => v.indexOf(fakeHome) !== -1);
    assertCheck(named, 'scenario 6: the failure names the offending path');
  } finally {
    if (prior === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = prior;
    fs.rmSync(fakeHome, { recursive: true, force: true });
  }
}

// --- Scenario 7: LIVE LEG SKIPS --------------------------------------------
function scenario7LiveLegSkips() {
  const env = Object.assign({}, process.env);
  delete env.CTXL_EVAL_LIVE;
  const res = spawnSync(process.execPath, [HARNESS_PATH, '--suite', 'ab'], {
    encoding: 'utf8',
    timeout: 30000,
    env: env,
  });
  assertCheck(res.status === 0, 'scenario 7: --suite ab exits 0 with CTXL_EVAL_LIVE unset (' + summarize(res) + ')');
  assertCheck(/^SKIP/m.test(String(res.stdout || '')), 'scenario 7: --suite ab prints an explicit SKIP line');
}

(function main() {
  process.stdout.write('[test-240.1-ctxl-eval-gate] running 7 scenarios\n');

  try { scenario1Selftest(); } catch (e) { fail('scenario 1: SELFTEST (unexpected throw)', e); }
  try { scenario2SuiteCode(); } catch (e) { fail('scenario 2: SUITE CODE (unexpected throw)', e); }
  try { scenario3NullDeltaIsPass(); } catch (e) { fail('scenario 3: NULL DELTA IS A PASS (unexpected throw)', e); }
  try { scenario4MalformedIsFail(); } catch (e) { fail('scenario 4: MALFORMED RECORD IS A FAIL (unexpected throw)', e); }
  try { scenario5NoRecordIsSkip(); } catch (e) { fail('scenario 5: NO RECORD IS A SKIP (unexpected throw)', e); }
  try { scenario6Part8Refusal(); } catch (e) { fail('scenario 6: PART 8 REFUSAL (unexpected throw)', e); }
  try { scenario7LiveLegSkips(); } catch (e) { fail('scenario 7: LIVE LEG SKIPS (unexpected throw)', e); }

  process.stdout.write('\n');
  if (failed === 0) {
    process.stdout.write('PASS test-240.1-ctxl-eval-gate.cjs (7 scenarios)\n');
    process.exit(0);
  } else {
    process.stdout.write('FAIL test-240.1-ctxl-eval-gate.cjs: ' + failed + ' assertion(s) failed, ' + passed + ' passed\n');
    process.exit(1);
  }
})();
