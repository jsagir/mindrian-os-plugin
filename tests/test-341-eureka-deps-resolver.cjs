#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 341 Plan 02 -- hermetic proof for lib/core/eureka-deps-resolver.cjs
 * (D-09): the single resolution authority for the eureka side directory.
 *
 * Six arms, all against a temp directory via the MINDRIAN_EUREKA_DEPS_ROOT
 * test seam -- no network, no real install, never touches the real
 * ~/.mindrian/eureka-deps.
 *
 * Idiom follows tests/test-213-part8-boundary.cjs: bare node assert, a
 * PASS/FAIL counter, exit 1 on any FAIL. No em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const resolver = require(path.join(REPO, 'lib', 'core', 'eureka-deps-resolver.cjs'));
const { eurekaDepsRoot, requireEurekaDep, eurekaDepInstalled } = resolver;

let PASS = 0;
let FAIL = 0;
function ok(label, fn) {
  try {
    fn();
    console.log('  PASS: ' + label);
    PASS += 1;
  } catch (e) {
    console.log('  FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e)));
    FAIL += 1;
  }
}

console.log('Phase 341 Plan 02 -- eureka-deps-resolver hermetic suite');

const ORIGINAL_ROOT = process.env.MINDRIAN_EUREKA_DEPS_ROOT;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-341-'));

try {
  // Arm 1: eurekaDepsRoot() honors MINDRIAN_EUREKA_DEPS_ROOT when set and
  // non-empty.
  ok('eurekaDepsRoot honors the env override', () => {
    process.env.MINDRIAN_EUREKA_DEPS_ROOT = tmpDir;
    assert.strictEqual(eurekaDepsRoot(), tmpDir);
  });

  // Arm 2: eurekaDepsRoot() falls back to a path ending .mindrian/eureka-deps
  // when the env var is unset.
  ok('eurekaDepsRoot falls back to .mindrian/eureka-deps', () => {
    delete process.env.MINDRIAN_EUREKA_DEPS_ROOT;
    const root = eurekaDepsRoot();
    assert.ok(typeof root === 'string' && root.length > 0, 'root should be a non-empty string');
    assert.ok(
      root.endsWith(path.join('.mindrian', 'eureka-deps')),
      'root should end in .mindrian/eureka-deps, got ' + root
    );
  });

  // Plant a minimal package under <tmp>/node_modules/<name>/ for arms 3 and 5.
  const plantedName = 'mos-341-sentinel-pkg';
  const plantedDir = path.join(tmpDir, 'node_modules', plantedName);
  fs.mkdirSync(plantedDir, { recursive: true });
  fs.writeFileSync(
    path.join(plantedDir, 'package.json'),
    JSON.stringify({ name: plantedName, version: '1.0.0', main: 'index.js' }),
    'utf8'
  );
  fs.writeFileSync(
    path.join(plantedDir, 'index.js'),
    "module.exports = { sentinel: 'mos-341-sentinel-value' };\n",
    'utf8'
  );

  // Arm 3: requireEurekaDep loads the planted package with
  // MINDRIAN_EUREKA_DEPS_ROOT pointed at the tmp dir, and the returned module
  // is the sentinel.
  ok('requireEurekaDep loads a package planted in the side dir', () => {
    process.env.MINDRIAN_EUREKA_DEPS_ROOT = tmpDir;
    const mod = requireEurekaDep(plantedName);
    assert.ok(mod, 'expected a loaded module, got ' + JSON.stringify(mod));
    assert.strictEqual(mod.sentinel, 'mos-341-sentinel-value');
  });

  // Arm 4: requireEurekaDep('this-package-does-not-exist-341') returns null
  // and does NOT throw.
  ok('requireEurekaDep returns null on a miss, never throws', () => {
    process.env.MINDRIAN_EUREKA_DEPS_ROOT = tmpDir;
    let result;
    assert.doesNotThrow(() => {
      result = requireEurekaDep('this-package-does-not-exist-341');
    });
    assert.strictEqual(result, null);
  });

  // Arm 5: requireEurekaDep('../../etc/passwd') and requireEurekaDep('/etc/passwd')
  // both return null (the package-name guard, T-341-08).
  ok('requireEurekaDep rejects path-shaped names (relative and absolute)', () => {
    process.env.MINDRIAN_EUREKA_DEPS_ROOT = tmpDir;
    assert.strictEqual(requireEurekaDep('../../etc/passwd'), null);
    assert.strictEqual(requireEurekaDep('/etc/passwd'), null);
  });

  // Arm 6: eurekaDepInstalled returns {installed:true, where:'side-dir'} on
  // the planted package and {installed:false, where:null} on a miss.
  ok('eurekaDepInstalled reports side-dir hit and a clean miss', () => {
    process.env.MINDRIAN_EUREKA_DEPS_ROOT = tmpDir;
    const hit = eurekaDepInstalled(plantedName);
    assert.strictEqual(hit.installed, true);
    assert.strictEqual(hit.where, 'side-dir');
    assert.ok(typeof hit.dir === 'string' && hit.dir.length > 0);

    const miss = eurekaDepInstalled('this-package-does-not-exist-341');
    assert.strictEqual(miss.installed, false);
    assert.strictEqual(miss.where, null);
  });
} finally {
  // Restore the original env var value so this test never leaks state into
  // the rest of the suite / the real machine.
  if (typeof ORIGINAL_ROOT === 'string') {
    process.env.MINDRIAN_EUREKA_DEPS_ROOT = ORIGINAL_ROOT;
  } else {
    delete process.env.MINDRIAN_EUREKA_DEPS_ROOT;
  }
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_e) {
    // Best-effort cleanup only.
  }
}

console.log('');
console.log('eureka-deps-resolver: PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL > 0 ? 1 : 0);
