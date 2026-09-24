#!/usr/bin/env node
/**
 * Phase 353 Plan 02 Task 2 (+ Task 3 shipped-file legs): the ledger build
 * script and the shipped vendor-scored ledger.
 *
 * Gates RULE-12 (build script), RULE-13 (shipped ledger).
 *
 * House rule: hyphens only, no em-dashes.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.join(__dirname, '..');
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'build-section-command-ledger.cjs');
const LEDGER_PATH = path.join(ROOT, 'data', 'section-command-ledger.json');
const CANON_PATH = path.join(ROOT, 'data', 'section-job-canon.json');
const FIXTURE_PATH = path.join(__dirname, 'fixtures', '353-jev-ledger-responses.json');

let PASS = 0;
let FAIL = 0;
function check(label, cond) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label); }
}

if (!fs.existsSync(SCRIPT_PATH)) {
  console.error('RED: missing scripts/build-section-command-ledger.cjs');
  process.exit(1);
}

const mod = require(SCRIPT_PATH);

// --- offline-seed deterministic (two runs byte-identical output) ---
const a = mod.serializeLedger(mod.buildOfflineSeedLedger());
const b = mod.serializeLedger(mod.buildOfflineSeedLedger());
// built_at differs between the two runs by design; strip it before compare.
const stripBuiltAt = (s) => s.replace(/"built_at": "[^"]*"/, '"built_at": "<ts>"');
check('offline-seed deterministic', stripBuiltAt(a) === stripBuiltAt(b));

// --- --check makes zero network calls ---
const originalFetch = global.fetch;
let fetchCalled = false;
global.fetch = function () { fetchCalled = true; throw new Error('network called during --check'); };
let checkThrew = false;
try {
  mod.runCheck();
} catch (_e) {
  checkThrew = true;
}
global.fetch = originalFetch;
check('--check made zero network calls', !fetchCalled && !checkThrew);

const brainClientLoaded = Object.keys(require.cache).some((k) => k.includes(path.join('lib', 'core', 'brain-client.cjs')));
check('--check never requires brain-client.cjs', !brainClientLoaded);

// --- union join yields a non-empty row for business-model (the
//     vocabulary-extension case) ---
const canon = require(CANON_PATH);
const jobMap = mod.buildJobCandidateMap();
const businessModelJob = canon.sections['business-model'].job_id;
check('business-model row non-empty', (jobMap.get(businessModelJob) || []).length > 0);

// --- six cost keys present, numeric, non-negative after a --jev-fixture build ---
const fixtureLedger = mod.buildWithJevFixture(FIXTURE_PATH);
const costKeys = ['wall_ms', 'jev_calls', 'input_tokens', 'output_tokens', 'estimated_cost_usd'];
let costKeysOk = true;
for (const k of costKeys) {
  if (typeof fixtureLedger[k] !== 'number' || fixtureLedger[k] < 0) costKeysOk = false;
}
check('six cost keys numeric and non-negative after --jev-fixture build', costKeysOk && typeof fixtureLedger.cost_basis === 'string');
check('estimated_cost_usd labeled vendor-claimed', fixtureLedger.cost_basis === 'vendor-claimed rate, unverified');
check('jev-fixture build is build_mode jev-scored', fixtureLedger.build_mode === 'jev-scored');
check('jev-fixture build carries the fixture model', fixtureLedger.jev_model === 'jev-1.13.0');

// --- a simulated unrecognized Theo shape aborts with a named reason ---
(async function testUnrecognizedShape() {
  const brainClientPath = path.join(ROOT, 'lib', 'core', 'brain-client.cjs');
  const realBrainClient = require(brainClientPath);
  const originalQuery = realBrainClient.query;
  realBrainClient.query = async function () {
    return { records: [], error: 'brain_query_unrecognized_shape', shape_type: 'weird', shape_keys: ['x'] };
  };
  let aborted = false;
  let reasonNamed = false;
  try {
    await mod.pullTheoFrameworks();
  } catch (e) {
    aborted = true;
    reasonNamed = /brain_query_unrecognized_shape/.test(String(e.message));
  }
  realBrainClient.query = originalQuery;
  check('unrecognized Theo shape aborts the build', aborted);
  check('the abort names the reason', reasonNamed);

  // ---- Task 3 shipped-file legs ----
  if (fs.existsSync(LEDGER_PATH)) {
    const shipped = require(LEDGER_PATH);
    check('shipped ledger build_mode is jev-scored', shipped.build_mode === 'jev-scored');
    check('shipped ledger jev_model is a non-empty string', typeof shipped.jev_model === 'string' && shipped.jev_model.length > 0);
    check('shipped ledger confidence_floor is a number in [0,1]', typeof shipped.confidence_floor === 'number' && shipped.confidence_floor >= 0 && shipped.confidence_floor <= 1);
    const keys = Object.keys(shipped.rows || {});
    check('shipped ledger has at least one row', keys.length > 0);
    let allKeysWellFormed = true;
    for (const k of keys) if (k.split('|').length !== 3) allKeysWellFormed = false;
    check('every shipped row key parses as job|problem_type|stage', allKeysWellFormed);
    const jobs = new Set(Object.values(canon.sections).map((s) => s.job_id));
    let everyJobHasRow = true;
    for (const j of jobs) {
      if (!keys.some((k) => k.split('|')[0] === j)) everyJobHasRow = false;
    }
    check('every canon job has a shipped ledger row', everyJobHasRow);
    const badConfidences = Object.values(shipped.rows).flat().filter((c) => typeof c.confidence !== 'number' || !(c.confidence >= 0 && c.confidence <= 1)).length;
    check('shipped ledger every candidate confidence is a number in [0,1] (invalid: ' + badConfidences + ')', badConfidences === 0);
    check('shipped ledger theo_frameworks is a positive integer', Number.isInteger(shipped.theo_frameworks) && shipped.theo_frameworks > 0);
    check('shipped ledger carries the usage header', costKeys.every((k) => typeof shipped[k] === 'number' && shipped[k] >= 0)
      && shipped.jev_calls > 0 && typeof shipped.cost_basis === 'string' && shipped.cost_basis.length > 0);
  } else {
    console.log('SKIP: shipped data/section-command-ledger.json not yet written (Task 3)');
  }

  console.log('');
  console.log('PASS=' + PASS + ' FAIL=' + FAIL);
  process.exit(FAIL === 0 ? 0 : 1);
}());
