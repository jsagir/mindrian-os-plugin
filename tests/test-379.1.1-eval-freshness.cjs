#!/usr/bin/env node
/**
 * Phase 379.1.1 Plan 05: the ICM eval freshness rule counts a release as
 * two beta steps.
 *
 * Root cause (beta.73 incident): the doctor point icm-ruling-eval-fresh
 * allowed the record to lag the running version by at most 1 beta. A release
 * moves the repo version by 2 (release.sh Step 3 bump, Step 7.5 next-bump),
 * and Step 9.8 runs the full doctor after both. A record stamped beta.72 was
 * 2 behind at Step 9.8 of the beta.73 cut and the point failed after publish.
 *
 * Pure unit test. No network. No key.
 *
 * House rule: hyphens only, no em-dashes.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const MODULE_PATH = path.join(REPO, 'lib', 'core', 'icm-eval-freshness.cjs');
const DOCTOR_PATH = path.join(REPO, 'scripts', 'doctor.cjs');

let PASS = 0;
let FAIL = 0;
function check(label, cond) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label); }
}

let mod = null;
try {
  mod = require(MODULE_PATH);
} catch (e) {
  console.log('FAIL: module lib/core/icm-eval-freshness.cjs loads (' + e.message.split('\n')[0] + ')');
  FAIL += 1;
}

if (mod) {
  const f = mod.evalFreshness;
  const B = (n) => '2.0.0-beta.' + n;

  const rows = [
    ['same version is fresh with lag 0', f(B(72), B(72)), true, 0],
    ['beta.72 vs beta.73 (pre-tag check) is fresh with lag 1', f(B(72), B(73)), true, 1],
    ['beta.72 vs beta.74 (beta.73 Step 9.8 incident case) is fresh with lag 2', f(B(72), B(74)), true, 2],
    ['beta.72 vs beta.75 is not fresh with lag 3', f(B(72), B(75)), false, 3],
    ['beta.74 vs beta.76 is fresh with lag 2', f(B(74), B(76)), true, 2],
    ['beta.74 vs beta.77 is not fresh with lag 3', f(B(74), B(77)), false, 3],
    ['a record newer than the running version is fresh (negative lag)', f(B(75), B(73)), true, -2],
    ['a different base version is fresh with lag null', f('1.9.0-beta.3', B(74)), true, null],
    ['a stable record version is fresh with lag null', f('2.0.0', B(74)), true, null],
    ['a stable running version is fresh with lag null', f(B(72), '2.0.0'), true, null],
    ['a null record version is fresh with lag null', f(null, B(74)), true, null],
    ['a null running version is fresh with lag null', f(B(72), null), true, null],
  ];
  for (const [label, r, fresh, lag] of rows) {
    check(label, r && r.fresh === fresh && r.lag === lag && typeof r.detail === 'string' && r.detail.length > 0);
  }

  check('BETAS_PER_RELEASE equals 2', mod.BETAS_PER_RELEASE === 2);

  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  check('module comment cites Step 3', /Step 3\b/.test(src));
  check('module comment cites Step 7\\.5', /Step 7\.5/.test(src));
  check('module comment cites Step 9\\.8', /Step 9\.8/.test(src));
  check('module has no em-dash', !src.includes(String.fromCharCode(0x2014)));
}

// The doctor point must use the module, so a later edit cannot bring back a
// private copy of the rule.
const doctorSrc = fs.readFileSync(DOCTOR_PATH, 'utf8');
const idx = doctorSrc.indexOf("id: 'icm-ruling-eval-fresh'");
const end = idx >= 0 ? doctorSrc.indexOf("id: '", idx + 10) : -1;
const pointSrc = idx >= 0 ? doctorSrc.slice(idx, end > idx ? end : idx + 6000) : '';
check('doctor point icm-ruling-eval-fresh requires icm-eval-freshness', idx >= 0 && /icm-eval-freshness/.test(pointSrc));

console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL === 0 ? 0 : 1);
