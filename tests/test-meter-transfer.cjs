'use strict';
/*
 * Phase 183 METER-02 RED pin (turned GREEN by Plan 02): the Gauge-2 SOURCE transfer
 * reader. Asserts the three named-debt proxy readers exist, each cold-starts (null
 * or zero) on a null db, and the source carries an explicit named-debt label string
 * (Canon Part 5 honesty: none of the three is a real transfer DELTA -- they are the
 * INSTRUMENT a future reader / a future real measurement consumes).
 *
 * This pin stays RED across Plan 01 (lib/core/meter/transfer-reader.cjs does not
 * exist yet); Plan 02 builds it and turns this GREEN.
 *
 * Canon Part 8: zero Brain / network. House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const TRANSFER_PATH = path.join(REPO_ROOT, 'lib', 'core', 'meter', 'transfer-reader.cjs');
const m = require(TRANSFER_PATH);

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// the three named-debt transfer proxies exist (Gauge-2 SOURCE, NOT a transfer delta).
ok('rejectReasonCaptureRate exported', typeof m.rejectReasonCaptureRate === 'function');
ok('insightToDecisionLatency exported', typeof m.insightToDecisionLatency === 'function');
ok('independenceTrend exported', typeof m.independenceTrend === 'function');

// each cold-starts (null or zero, or a zeroed object) on a null db, never throws.
function coldOk(v) { return v === null || v === 0 || (!!v && typeof v === 'object'); }
ok('rejectReasonCaptureRate cold-starts', coldOk(m.rejectReasonCaptureRate(null, 0, {})));
ok('insightToDecisionLatency cold-starts', coldOk(m.insightToDecisionLatency(null, 0, {})));
ok('independenceTrend cold-starts', coldOk(m.independenceTrend(null, 0, {})));

// Canon Part 5 honesty: the source labels the proxies as named-debt, not transfer.
const src = fs.readFileSync(TRANSFER_PATH, 'utf8');
ok('source carries an explicit named-debt label', /named-debt/.test(src));

console.log('');
console.log('PASS ' + pass + ' assertions');
console.log('>>> test-meter-transfer.cjs: PASSED');
