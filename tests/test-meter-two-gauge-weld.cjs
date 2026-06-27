'use strict';
/*
 * Phase 183 METER-01+02 RED pin (turned GREEN by Plan 02): the WELDED two-gauge read.
 * Mirrors the canon-side weld contract (tests/test-canon-entry-31-two-gauge-floor.cjs):
 * readTwoGauge returns BOTH gauge1 and gauge2 keys (or throws); there is NO exported
 * bare-density function returning a number (the lone-density egress is structurally
 * impossible); and BOTH single-direction readings -- volume-up-quality-flat AND
 * quality-up-by-starving-volume -- are labeled regression (the D-180-02 two-directional
 * guard). Win == volume up AND quality holds-or-climbs.
 *
 * This pin stays RED across Plan 01 (lib/core/meter/two-gauge.cjs does not exist yet);
 * Plan 02 builds it and turns this GREEN.
 *
 * Canon Part 8: zero Brain / network. House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const TWO_GAUGE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'meter', 'two-gauge.cjs');
const m = require(TWO_GAUGE_PATH);

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// the welded read returns the PAIR (or throws); a lone density is unobtainable.
ok('readTwoGauge exported', typeof m.readTwoGauge === 'function');
const r = m.readTwoGauge(null, 0);
ok('readTwoGauge carries gauge1', !!r && Object.prototype.hasOwnProperty.call(r, 'gauge1'));
ok('readTwoGauge carries gauge2', !!r && Object.prototype.hasOwnProperty.call(r, 'gauge2'));

// NO exported bare-density function returning a number (Pitfall 1).
ok('no bare-density export (readDensity)', typeof m.readDensity !== 'function');
ok('no bare-density export (density)', typeof m.density !== 'function');

// the two-directional regression guard names BOTH single-direction failures.
const src = fs.readFileSync(TWO_GAUGE_PATH, 'utf8');
ok('volume-up-quality-flat is labeled regression',
  /volume-up-quality-flat/.test(src) && /regression/.test(src));
ok('quality-up-by-starving-volume is labeled regression',
  /quality-up-by-starving-volume/.test(src));

// CORRECTION A -- subject_class is stamped on every reading and is one of the allowed
// enum values { maintainer, navigator, unknown }. Only navigator clears the entry-31
// self-binding clause; a maintainer reading proves the instrument fires, not the bind.
ok('subject_class is present', !!r && Object.prototype.hasOwnProperty.call(r, 'subject_class'));
ok('subject_class is an allowed enum value',
  !!r && ['maintainer', 'navigator', 'unknown'].includes(r.subject_class));
ok('source carries the entry-31 self-binding guard comment',
  /Only subject_class==navigator/.test(src)
  && /does NOT clear the self-bind|does not clear the self-bind|not clear the self-bind/.test(src));

// CORRECTION B -- the uninstrumented THIRD state. On a null db the transfer substrate is
// EMPTY, so the read reports transfer=null + transfer_state='uninstrumented' (NEVER a
// fabricated transfer=0), distinct from a flat reading.
ok('transfer_state is present', !!r && Object.prototype.hasOwnProperty.call(r, 'transfer_state'));
ok('cold-start transfer is null (not a zero)', !!r && r.transfer === null);
ok('cold-start transfer_state is uninstrumented', !!r && r.transfer_state === 'uninstrumented');
ok('cold-start verdict is transfer_uninstrumented (no regression verdict licensed)',
  !!r && r.verdict === 'transfer_uninstrumented');
ok('source treats uninstrumented as DISTINCT from flat',
  /DISTINCT state from flat/.test(src) && /blindfolded/.test(src));

console.log('');
console.log('PASS ' + pass + ' assertions');
console.log('>>> test-meter-two-gauge-weld.cjs: PASSED');
