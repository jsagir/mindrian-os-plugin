#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 341 Plan 03 (D-10) -- the slim-install honest-degrade proof.
 *
 * This is the D-10 proof: on a fixture with sqlite-vec present and the
 * embedding model package ABSENT, every engine stays reachable, the
 * encoder_unavailable envelope carries the exact /mos:eureka enable remedy
 * from the one shared constant, the HTML report renders it, and Class S
 * passes the release gate honestly (capability blocker green, model
 * advisory ok:false but never fails the tier).
 *
 * WHY THE FIXTURE NEEDS TWO MECHANISMS, NOT ONE (a live discovery made while
 * writing this test, recorded here so a future reader is not surprised):
 *
 *   1. MINDRIAN_EUREKA_DEPS_ROOT pointed at an empty tmp dir defeats the
 *      SIDE-DIRECTORY arm of both requireEurekaDep and eurekaDepInstalled --
 *      Node's upward node_modules walk from a tmp dir never reaches this
 *      repo's own node_modules.
 *   2. That alone is NOT enough on THIS tree (pre-341-04: the heavy
 *      @huggingface/transformers package is still physically present in the
 *      plugin's own node_modules, by design -- this plan changes nothing
 *      about packaging). Two of the resolver's fallback arms would still find
 *      it:
 *        (a) requireEurekaDep's plain `require(name)` fallback resolves from
 *            lib/core/eureka-deps-resolver.cjs's OWN directory upward and
 *            hits the real plugin node_modules -- defeated here by a scoped,
 *            restored-in-finally `Module._load` interception that throws
 *            MODULE_NOT_FOUND for the exact request string
 *            '@huggingface/transformers' and delegates every other request
 *            to the real loader unchanged.
 *        (b) eurekaDepInstalled's plugin-fallback arm is a PURE
 *            fs.existsSync probe of the real plugin root (not require-based,
 *            so the Module._load hook above cannot touch it, and it is not
 *            configurable via any env var) -- defeated here by monkeypatching
 *            the exported `eurekaDepInstalled` function on the already-loaded
 *            resolver module object, which lib/core/doctor/class-s-eureka-
 *            smoke.cjs's L5 picks up because it re-requires the resolver
 *            module FRESH inside the function body on every call (a fresh
 *            require of an already-cached module returns the SAME exports
 *            object, so mutating a property on it is visible everywhere).
 *      Both are restored in a `finally` before this process exits.
 *
 * No network, no real model, no transformers package touched. Restores every
 * env var and every monkeypatch in a finally.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

const REPO = path.resolve(__dirname, '..');
const spine = require(path.join(REPO, 'lib', 'core', 'eureka', 'embedding-spine.cjs'));
const reportHtml = require(path.join(REPO, 'lib', 'core', 'eureka', 'report-html.cjs'));
const smoke = require(path.join(REPO, 'lib', 'core', 'doctor', 'class-s-eureka-smoke.cjs'));
const resolver = require(path.join(REPO, 'lib', 'core', 'eureka-deps-resolver.cjs'));

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

console.log('Phase 341 Plan 03 -- slim-install honest-degrade hermetic suite (D-10)');

async function main() {
  const ORIGINAL_ROOT = process.env.MINDRIAN_EUREKA_DEPS_ROOT;
  const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-341-slim-'));
  const originalModuleLoad = Module._load;
  const originalEurekaDepInstalled = resolver.eurekaDepInstalled;
  const originalGetEncoderRealForRestore = spine.getEncoder; // untouched here, sanity anchor

  // Mechanism 1: side-dir arm miss (an empty tmp dir, never a subtree of this repo).
  process.env.MINDRIAN_EUREKA_DEPS_ROOT = emptyRoot;

  // Mechanism 2a: the plain-require fallback inside requireEurekaDep resolves
  // from THIS repo's own node_modules today (pre-341-04 cut); intercept the
  // exact request string only, delegate every other request unchanged.
  Module._load = function (request, parentModule, isMain) {
    if (request === '@huggingface/transformers') {
      const err = new Error("Cannot find module '@huggingface/transformers' (mos-341-slim-install fixture)");
      err.code = 'MODULE_NOT_FOUND';
      throw err;
    }
    return originalModuleLoad.apply(this, arguments);
  };

  // Mechanism 2b: eurekaDepInstalled's plugin-fallback arm is a pure
  // fs.existsSync probe of the REAL plugin root, unreachable by the
  // Module._load hook above. Class S's L5 re-requires the resolver module
  // fresh inside its function body, so mutating this property is visible to
  // it without touching the filesystem.
  resolver.eurekaDepInstalled = function (name) {
    return { installed: false, where: null, dir: null };
  };

  spine._test.resetPipelineCache();

  try {
    // --- Arm 1: getEncoder({}) under the fixture. ---
    await test('getEncoder returns encoder_unavailable with the exact remedy in detail', async function () {
      const r = await spine.getEncoder({});
      assert.strictEqual(r.success, false);
      assert.strictEqual(r.error, 'encoder_unavailable');
      assert.ok(typeof r.detail === 'string' && r.detail.indexOf('/mos:eureka enable') !== -1,
        'detail must contain the remedy, got: ' + r.detail);
    });

    // --- Arm 2: embedTexts(...) under the fixture, no throw. ---
    await test('embedTexts returns the same encoder_unavailable envelope, never throws', async function () {
      let r;
      await assert.doesNotReject(async function () { r = await spine.embedTexts(['probe'], {}); });
      assert.strictEqual(r.success, false);
      assert.strictEqual(r.error, 'encoder_unavailable');
      assert.ok(typeof r.detail === 'string' && r.detail.indexOf('/mos:eureka enable') !== -1);
    });

    // --- Arm 3: Class S under the same fixture: overall ok, L5 advisory ok:false. ---
    await test('Class S passes overall (capability reachable), L5 advisory reports the remedy', async function () {
      const r = await smoke.checkEurekaSmoke({});
      // L1 (sqlite-vec) is untouched by this fixture -- capability stays reachable.
      assert.strictEqual(r.layers[0].id, 'deps_present');
      assert.strictEqual(r.layers[0].ok, true, 'L1 (sqlite-vec) must still pass: ' + r.layers[0].reason);
      const l5 = r.layers.find(function (l) { return l.id === 'model_installed'; });
      assert.ok(l5, 'model_installed layer must be present');
      assert.strictEqual(l5.advisory, true);
      assert.strictEqual(l5.ok, false, 'the model is absent under this fixture');
      assert.ok(l5.reason.indexOf('/mos:eureka enable') !== -1, 'L5 reason must name the remedy, got: ' + l5.reason);
      assert.strictEqual(r.ok, true, 'a slim install must pass the release gate honestly (D-10/D-11)');
    });

    // --- Arm 4: the registry is untouched by this fixture / this test. ---
    await test('data/command-registry.json still declares /mos:eureka, unchanged', function () {
      const registryPath = path.join(REPO, 'data', 'command-registry.json');
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      const entries = Array.isArray(registry) ? registry : (registry.commands || registry.entries || []);
      const found = (Array.isArray(entries) ? entries : Object.values(entries)).find(function (e) {
        return e && (e.name === 'eureka' || e.id === 'eureka' || e.command === '/mos:eureka' || e.name === '/mos:eureka');
      });
      assert.ok(found, 'the /mos:eureka entry must exist in data/command-registry.json');
      assert.ok('visibility' in found, 'the entry must declare a visibility field');
      assert.ok('executable' in found, 'the entry must declare an executable field');

      const { execFileSync } = require('node:child_process');
      const headContent = execFileSync('git', ['show', 'HEAD:data/command-registry.json'], { cwd: REPO, encoding: 'utf8' });
      const liveContent = fs.readFileSync(registryPath, 'utf8');
      assert.strictEqual(liveContent, headContent, 'data/command-registry.json must have zero diff from HEAD (this test never writes it)');
    });

    // --- Arm 5: report-html.cjs renders the remedy for a degrade_cause of encoder_unavailable. ---
    await test('report-html.cjs renders the remedy for degrade_cause encoder_unavailable', function () {
      const html = reportHtml.renderReportHtml({
        provenance: { run_mode: 'reasoning', degrade_cause: 'encoder_unavailable' },
        ranked: [],
        statements: [],
      });
      assert.ok(html.indexOf('/mos:eureka enable') !== -1, 'rendered HTML must contain the remedy command');
      assert.ok(html.indexOf('380 MB') !== -1, 'rendered HTML must contain the size hint');
    });
  } finally {
    // Restore every env var and monkeypatch, in reverse order of application.
    resolver.eurekaDepInstalled = originalEurekaDepInstalled;
    Module._load = originalModuleLoad;
    if (typeof ORIGINAL_ROOT === 'string') {
      process.env.MINDRIAN_EUREKA_DEPS_ROOT = ORIGINAL_ROOT;
    } else {
      delete process.env.MINDRIAN_EUREKA_DEPS_ROOT;
    }
    try { fs.rmSync(emptyRoot, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
    spine._test.resetPipelineCache();
    // Sanity anchor: prove we never permanently replaced spine.getEncoder itself.
    assert.strictEqual(spine.getEncoder, originalGetEncoderRealForRestore);
  }

  console.log('');
  console.log('slim-install-honest-degrade: PASS=' + PASS + ' FAIL=' + FAIL);
  process.exit(FAIL > 0 ? 1 : 0);
}

main();
