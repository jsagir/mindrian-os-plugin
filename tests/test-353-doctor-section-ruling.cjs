#!/usr/bin/env node
/**
 * Phase 353 Plan 02 Task 9: doctor module section-ruling plus its registry
 * row.
 *
 * Gates RULE-21. Drives check()/fix() against TEMP COPIES of
 * tests/fixtures/icm-rooms/alpha-room, mirroring
 * tests/test-353-doctor-room-map.cjs's own idiom.
 *
 * House rule: hyphens only, no em-dashes.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const MODULE_PATH = path.join(REPO, 'lib', 'core', 'doctor', 'section-ruling-module.cjs');
const ALPHA_ROOM = path.join(REPO, 'tests', 'fixtures', 'icm-rooms', 'alpha-room');

let PASS = 0;
let FAIL = 0;
function check(label, cond) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label); }
}

if (!fs.existsSync(MODULE_PATH)) {
  console.error('RED: missing lib/core/doctor/section-ruling-module.cjs');
  process.exit(1);
}

function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

const sectionRuling = require(MODULE_PATH);

// --- contract: check/fix are synchronous, non-empty detail on every path ---
check('check is a function', typeof sectionRuling.check === 'function');
check('fix is a function', typeof sectionRuling.fix === 'function');
check('check/fix are synchronous (return an object directly)', (function () {
  const r = sectionRuling.check({ roomPath: ALPHA_ROOM });
  return r && typeof r === 'object' && typeof r.then !== 'function';
})());

// --- warn on a fixture room with no ruling documents yet, all four
//     drift classes named ---
const tmp1 = fs.mkdtempSync(path.join(path.dirname(ALPHA_ROOM), '.tmp-test-353-09-check-'));
try {
  copyDir(ALPHA_ROOM, tmp1);
  const result = sectionRuling.check({ roomPath: tmp1 });
  check('warn on a room with undeclared ruling documents', result.status === 'warn');
  check('detail is non-empty', typeof result.detail === 'string' && result.detail.length > 0);
  check('output contains ruling_fingerprint_drift', /ruling_fingerprint_drift/.test(result.detail));
  check('output contains sections_without_job_id', /sections_without_job_id/.test(result.detail));
  check('output contains subrooms_without_job_id', /subrooms_without_job_id/.test(result.detail));
  check('output contains claims_without_anchor', /claims_without_anchor/.test(result.detail));
  check('drift.ruling_fingerprint_drift lists the fixture sections', result.drift.ruling_fingerprint_drift.length > 0);
  check('recoverable is true under tests/fixtures/icm-rooms/', result.recoverable === true);
} finally {
  fs.rmSync(tmp1, { recursive: true, force: true });
}

// --- fix regenerates ruling documents, then re-check shows 0
//     ruling_fingerprint_drift ---
const tmp2 = fs.mkdtempSync(path.join(path.dirname(ALPHA_ROOM), '.tmp-test-353-09-fix-'));
try {
  copyDir(ALPHA_ROOM, tmp2);
  const checkResult = sectionRuling.check({ roomPath: tmp2 });
  check('pre-fix: warn', checkResult.status === 'warn');
  const fixResult = sectionRuling.fix({ check_result: checkResult });
  check('fix returns ok or partial', fixResult.status === 'ok' || fixResult.status === 'partial');
  const recheck = sectionRuling.check({ roomPath: tmp2 });
  check('post-fix: zero ruling_fingerprint_drift remaining', recheck.drift.ruling_fingerprint_drift.length === 0);
  check('post-fix: landed CONTEXT.md carries a ruling_fingerprint', (function () {
    const p = path.join(tmp2, 'problem-definition', 'CONTEXT.md');
    if (!fs.existsSync(p)) return false;
    const grayMatter = require('gray-matter');
    const data = grayMatter(fs.readFileSync(p, 'utf8')).data;
    return typeof data.ruling_fingerprint === 'string';
  })());
} finally {
  fs.rmSync(tmp2, { recursive: true, force: true });
}

// --- ok path on an already-fixed room: fix() is a no-op the second time ---
const tmp3 = fs.mkdtempSync(path.join(path.dirname(ALPHA_ROOM), '.tmp-test-353-09-idempotent-'));
try {
  copyDir(ALPHA_ROOM, tmp3);
  sectionRuling.fix({ check_result: sectionRuling.check({ roomPath: tmp3 }) });
  const second = sectionRuling.check({ roomPath: tmp3 });
  check('a fully-ruled room reports ruling_fingerprint_drift:0', second.drift.ruling_fingerprint_drift.length === 0);
  check('ok/warn path always carries non-empty detail', typeof second.detail === 'string' && second.detail.length > 0);
} finally {
  fs.rmSync(tmp3, { recursive: true, force: true });
}

// --- recoverable:false outside the fixture prefix; fix refuses ---
const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), '353-09-outside-'));
try {
  copyDir(ALPHA_ROOM, outsideRoot);
  const checkResult = sectionRuling.check({ roomPath: outsideRoot });
  check('recoverable:false outside tests/fixtures/icm-rooms/', checkResult.recoverable === false);
  const fixResult = sectionRuling.fix({ check_result: checkResult });
  check('fix refuses (skip) outside the fixture prefix', fixResult.status === 'skip');
} finally {
  fs.rmSync(outsideRoot, { recursive: true, force: true });
}

// --- skip path carries non-empty detail too ---
const skipResult = sectionRuling.check({ roomPath: path.join(os.tmpdir(), 'does-not-exist-at-all-353-09') });
check('a room with no nodes still returns a status with non-empty detail', typeof skipResult.detail === 'string' && skipResult.detail.length > 0);

// --- registry row ---
const doctorModules = require(path.join(REPO, 'data', 'doctor-modules.json'));
const row = doctorModules.modules.find((m) => m.id === 'section-ruling');
check('registry row exists', !!row);
check('registry row carries exactly 7 keys, no auto_heal', !!row && Object.keys(row).length === 7 && !('auto_heal' in row));
check('registry has 26 modules total', doctorModules.modules.length === 26);
check('runner path exists on disk', !!row && fs.existsSync(path.join(REPO, row.runner)));

console.log('');
console.log('PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
