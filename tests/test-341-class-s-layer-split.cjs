#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 341 Plan 03 (D-11) -- hermetic proof for the Class S blocker/advisory
 * layer split in lib/core/doctor/class-s-eureka-smoke.cjs.
 *
 * All arms are mocked layers or in-process monkeypatches of the ONE
 * resolution authority (lib/core/eureka-deps-resolver.cjs) and the ONE
 * embedding spine (lib/core/eureka/embedding-spine.cjs) -- no real model
 * load, no network, no download.
 *
 * Idiom follows tests/test-213-part8-boundary.cjs / test-341-eureka-deps-
 * resolver.cjs: bare node:assert, a PASS/FAIL counter, exit 1 on any FAIL.
 * No em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const smoke = require(path.join(REPO, 'lib', 'core', 'doctor', 'class-s-eureka-smoke.cjs'));
const resolver = require(path.join(REPO, 'lib', 'core', 'eureka-deps-resolver.cjs'));
const spine = require(path.join(REPO, 'lib', 'core', 'eureka', 'embedding-spine.cjs'));

let PASS = 0;
let FAIL = 0;
async function test(label, fn) {
  try {
    await fn();
    console.log('  PASS: ' + label);
    PASS += 1;
  } catch (e) {
    console.log('  FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e)));
    FAIL += 1;
  }
}

function okLayer(reason) { return function () { return { ok: true, reason: reason }; }; }

console.log('Phase 341 Plan 03 -- Class S layer-split hermetic suite');

async function main() {
  // Arm 1: LAYERS has exactly 5 entries, in the wire-locked order.
  await test('LAYERS has exactly 5 entries in the wire-locked order', function () {
    assert.deepStrictEqual(
      smoke.LAYERS.map(function (l) { return l.id; }),
      ['deps_present', 'vec_backend', 'model_probe', 'graceful_degrade', 'model_installed']
    );
  });

  // Arm 2: mockL5 returns an advisory ok:false; overall ok stays true, and the
  // failing advisory layer's reason still travels on the payload.
  await test('advisory L5 failure does not fail the run, but is reported in full', async function () {
    const r = await smoke.checkEurekaSmoke({
      mockL1: okLayer('deps ok'),
      mockL2: okLayer('vec ok'),
      mockL3: okLayer('cache hit'),
      mockL4: okLayer('degrades'),
      mockL5: function () {
        return { ok: false, advisory: true, reason: 'model not installed - run /mos:eureka enable (one-time, about 380 MB)' };
      },
    });
    assert.strictEqual(r.ok, true, 'an advisory failure must not fail the overall run (D-10)');
    assert.strictEqual(r.layers.length, 5);
    assert.strictEqual(r.layers[4].id, 'model_installed');
    assert.strictEqual(r.layers[4].ok, false, 'the advisory layer itself still reports its own ok:false');
    assert.strictEqual(r.layers[4].advisory, true, 'advisory flag travels onto the payload');
    assert.ok(/mos:eureka enable/.test(r.layers[4].reason), 'the reason is not swallowed');
  });

  // Arm 3: mockL1 fails; the blocker half still blocks.
  await test('blocker L1 failure still fails the run', async function () {
    const r = await smoke.checkEurekaSmoke({
      mockL1: function () { return { ok: false, reason: 'sqlite-vec not installed' }; },
      mockL2: okLayer('vec ok'),
      mockL3: okLayer('cache hit'),
      mockL4: okLayer('degrades'),
      mockL5: okLayer('model installed'),
    });
    assert.strictEqual(r.ok, false, 'a blocker (non-advisory) layer failure must still fail the run');
    assert.strictEqual(r.layers[0].ok, false);
  });

  // Arm 4: the real _layer5 (not mocked), with the ONE resolution authority
  // monkeypatched to report a miss, names the exact remedy. This proves
  // _layer5 goes through eurekaDepInstalled rather than a re-implemented
  // probe -- if it did not, this monkeypatch would have no effect on the
  // layer's output.
  await test('real L5 (resolver mocked to a miss) names the exact enable command', async function () {
    const original = resolver.eurekaDepInstalled;
    resolver.eurekaDepInstalled = function () { return { installed: false, where: null, dir: null }; };
    try {
      const r = await smoke.checkEurekaSmoke({
        mockL1: okLayer('deps ok'),
        mockL2: okLayer('vec ok'),
        mockL3: okLayer('cache hit'),
        mockL4: okLayer('degrades'),
      });
      assert.strictEqual(r.layers[4].ok, false, 'a resolver miss reports advisory ok:false');
      assert.strictEqual(r.layers[4].advisory, true);
      assert.ok(
        r.layers[4].reason.indexOf('/mos:eureka enable') !== -1,
        'the exact remedy substring must be present, got: ' + r.layers[4].reason
      );
      assert.strictEqual(r.ok, true, 'still an advisory-only miss, overall stays ok (D-10)');
    } finally {
      resolver.eurekaDepInstalled = original;
    }
  });

  // Arm 5: _layer1's spec list no longer names @huggingface/transformers.
  // Fixture form (behavior, not text): a pluginRoot fixture carrying ONLY
  // sqlite-vec (no huggingface anywhere under it) must still pass L1.
  await test('L1 passes on a fixture that has sqlite-vec but NOT huggingface', async function () {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-341-l1-'));
    try {
      const vecDir = path.join(fixtureRoot, 'node_modules', 'sqlite-vec');
      fs.mkdirSync(vecDir, { recursive: true });
      fs.writeFileSync(
        path.join(vecDir, 'package.json'),
        JSON.stringify({ name: 'sqlite-vec', version: '9.9.9-fixture' }),
        'utf8'
      );
      // Deliberately absent: node_modules/@huggingface anywhere under fixtureRoot.
      assert.strictEqual(
        fs.existsSync(path.join(fixtureRoot, 'node_modules', '@huggingface')),
        false,
        'fixture must not contain huggingface (sanity check on the fixture itself)'
      );
      const r = await smoke.checkEurekaSmoke({
        pluginRoot: fixtureRoot,
        mockL2: okLayer('vec ok'),
        mockL3: okLayer('cache hit'),
        mockL4: okLayer('degrades'),
        mockL5: okLayer('model installed'),
      });
      assert.strictEqual(r.layers[0].ok, true, 'L1 must pass on sqlite-vec alone: ' + r.layers[0].reason);
      assert.ok(r.layers[0].reason.indexOf('huggingface') === -1, 'L1 reason must not mention huggingface');
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  // Arm 6: cache-miss reachability. spine._test.isModelCached is replaced with
  // an ASYNC stub resolving false. If _layer3's call site is (still) awaited,
  // `cached` is the resolved boolean false -> the cache-miss branch fires and
  // getEncoder is NEVER called. If the `await` were removed (the regression
  // this test exists to catch), `cached` would be the Promise object itself
  // (always truthy) -> the cache-HIT branch would fire and getEncoder WOULD
  // be called -- this arm must fail in that case.
  await test('cache-miss branch is reachable; awaited isModelCached, getEncoder not called', async function () {
    const originalIsModelCached = spine._test.isModelCached;
    const originalGetEncoder = spine.getEncoder;
    let getEncoderCalled = false;
    spine._test.isModelCached = async function () { return false; };
    spine.getEncoder = async function () {
      getEncoderCalled = true;
      return originalGetEncoder.apply(spine, arguments);
    };
    try {
      const r = await smoke.checkEurekaSmoke({
        mockL1: okLayer('deps ok'),
        mockL2: okLayer('vec ok'),
        // L3 real (no mockL3) -- this is the layer under test.
        mockL4: okLayer('degrades'),
        mockL5: okLayer('model installed'),
      });
      assert.strictEqual(r.layers[2].id, 'model_probe');
      assert.strictEqual(r.layers[2].ok, true, 'cache miss is a graceful pass: ' + r.layers[2].reason);
      assert.ok(/cache miss/.test(r.layers[2].reason), 'reason must name the cache-miss branch, got: ' + r.layers[2].reason);
      assert.strictEqual(getEncoderCalled, false, 'a cache miss must NOT call getEncoder (no real embed, no download)');
    } finally {
      spine._test.isModelCached = originalIsModelCached;
      spine.getEncoder = originalGetEncoder;
    }
  });

  console.log('');
  console.log('class-s-layer-split: PASS=' + PASS + ' FAIL=' + FAIL);
  process.exit(FAIL > 0 ? 1 : 0);
}

main();
