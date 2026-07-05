'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * quick(260706-13z) offline contract tests for the Class S eureka smoke probe.
 *
 * (a) UNIT via mock seams (no deps, no model, no network):
 *     - all-pass: four mocked layers -> overall ok, 4 layers, overall_ms present.
 *     - NON-cascading: an L1 failure does NOT skip L4 (offline machines must
 *       still prove graceful degrade).
 *     - an L3 "timeout" (ok:false) leaves L4 still running.
 * (b) INTEGRATION: spawn `node scripts/doctor.cjs --eureka-smoke --json`, assert
 *     exit 0 (class-flag invariant) + parseable payload + exactly 4 layers. The
 *     deps are installed in this repo and L3 is cache-state-agnostic (a cache
 *     miss is a graceful PASS), so this is deterministic offline.
 */

const assert = require('node:assert');
const path = require('node:path');
const cp = require('node:child_process');

const smoke = require('../lib/core/doctor/class-s-eureka-smoke.cjs');

let PASS = 0;
let FAIL = 0;
const FAILURES = [];
async function test(name, fn) {
  try {
    await fn();
    PASS += 1;
    console.log('  PASS: ' + name);
  } catch (err) {
    FAIL += 1;
    FAILURES.push({ name: name, err: err });
    console.log('  FAIL: ' + name + ' -- ' + (err && err.message));
  }
}

function okLayer(reason) { return function () { return { ok: true, reason: reason }; }; }
function failLayer(reason) { return function () { return { ok: false, reason: reason }; }; }

async function main() {
  console.log('quick(260706-13z) class-S eureka smoke (offline, mock seams)');

  // ----- unit: all-pass shape -----
  await test('unit: all four mocked layers pass -> overall ok, 4 layers, overall_ms', async function () {
    const r = await smoke.checkEurekaSmoke({
      mockL1: okLayer('deps ok'),
      mockL2: okLayer('sqlite-vec ok'),
      mockL3: okLayer('cache hit'),
      mockL4: okLayer('degrades'),
    });
    assert.strictEqual(r.ok, true, 'overall ok');
    assert.strictEqual(r.layers.length, 4, 'exactly 4 layers');
    assert.deepStrictEqual(
      r.layers.map(function (l) { return l.id; }),
      ['deps_present', 'vec_backend', 'model_probe', 'graceful_degrade'],
      'layer ids in the wire-locked order'
    );
    assert.strictEqual(typeof r.overall_ms, 'number', 'overall_ms present');
    r.layers.forEach(function (l) { assert.strictEqual(l.ok, true, l.id + ' ok'); });
  });

  // ----- unit: non-cascading, L1 fail still runs L4 -----
  await test('unit: L1 failure does NOT skip L4 (non-cascading contract)', async function () {
    const r = await smoke.checkEurekaSmoke({
      mockL1: failLayer('deps missing'),
      mockL2: okLayer('vec ok'),
      mockL3: okLayer('cache miss ok'),
      mockL4: okLayer('degrades even with no deps'),
    });
    assert.strictEqual(r.ok, false, 'overall fails when L1 fails');
    assert.strictEqual(r.layers.length, 4, 'all 4 layers still ran (no skip)');
    assert.strictEqual(r.layers[0].ok, false, 'L1 failed');
    assert.strictEqual(r.layers[3].ok, true, 'L4 STILL ran and passed');
    assert.strictEqual(r.layers[3].reason, 'degrades even with no deps', 'L4 result is the real mock, not a skip stub');
  });

  // ----- unit: L3 timeout leaves L4 running -----
  await test('unit: L3 timeout (ok:false) leaves L4 still running', async function () {
    const r = await smoke.checkEurekaSmoke({
      mockL1: okLayer('deps ok'),
      mockL2: okLayer('vec ok'),
      mockL3: failLayer('getEncoder timed out after 20000ms'),
      mockL4: okLayer('degrades'),
    });
    assert.strictEqual(r.ok, false, 'overall fails on L3 hang');
    assert.strictEqual(r.layers[2].ok, false, 'L3 is the failing layer');
    assert.ok(/timed out/.test(r.layers[2].reason), 'L3 reason names the timeout');
    assert.strictEqual(r.layers[3].ok, true, 'L4 still ran after L3 failed');
  });

  // ----- integration: real doctor spawn, exit 0, 4 layers -----
  await test('integration: doctor --eureka-smoke --json exits 0 with 4 layers', function () {
    const doctorPath = path.join(__dirname, '..', 'scripts', 'doctor.cjs');
    const r = cp.spawnSync('node', [doctorPath, '--eureka-smoke', '--json'], {
      encoding: 'utf8', timeout: 40000,
    });
    assert.strictEqual(r.status, 0, 'exit 0 (class-flag invariant)');
    let payload = null;
    assert.doesNotThrow(function () { payload = JSON.parse(r.stdout); }, 'stdout is parseable JSON');
    assert.strictEqual(payload.class, 'S', 'class S');
    assert.ok(Array.isArray(payload.layers), 'layers array present');
    assert.strictEqual(payload.layers.length, 4, 'exactly 4 layers (cache-state-agnostic)');
    assert.strictEqual(typeof payload.ok, 'boolean', 'overall ok is a boolean');
  });

  console.log('\neureka-smoke: PASS=' + PASS + ' FAIL=' + FAIL);
  if (FAIL > 0) {
    FAILURES.forEach(function (f) { console.log('  - ' + f.name + ': ' + (f.err && f.err.stack)); });
    process.exit(1);
  }
  process.exit(0);
}

main();
