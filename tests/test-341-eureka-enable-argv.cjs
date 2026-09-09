#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 341 Plan 02 -- hermetic argv proof for
 * lib/core/eureka/eureka-enable.cjs's buildEurekaInstallArgv (D-09).
 *
 * NO INSTALL SPAWNED ANYWHERE IN THIS FILE. buildEurekaInstallArgv is PURE
 * (it calls resolveNpmCli() and buildInstallArgs() -- both read-only
 * resolution, no subprocess); this file asserts by construction that the
 * sibling function that actually spawns the install (named by string
 * concatenation below, never spelled out literally in this file) is never
 * referenced here, so no test run can trigger a real 380 MB download.
 *
 * Idiom follows tests/test-213-part8-boundary.cjs: bare node assert, a
 * PASS/FAIL counter, exit 1 on any FAIL. No em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const enableMod = require(path.join(REPO, 'lib', 'core', 'eureka', 'eureka-enable.cjs'));
const { EUREKA_DEP_SPEC, buildEurekaInstallArgv } = enableMod;
const { eurekaDepsRoot } = require(path.join(REPO, 'lib', 'core', 'eureka-deps-resolver.cjs'));

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

console.log('Phase 341 Plan 02 -- eureka-enable argv hermetic suite');

// Construction-level assertion (not a runtime check): this test file's own
// source text never spells out the spawning function's name literally, so
// no test run in this file can reach it.
ok('this test file never spells out the spawning function name (construction guard)', () => {
  const src = fs.readFileSync(__filename, 'utf8');
  // Built by concatenation so this very check does not count itself as a
  // reference to the name it is forbidding.
  const forbidden = 'enable' + 'Eureka';
  const occurrences = src.split(forbidden).length - 1;
  assert.strictEqual(occurrences, 0, 'found ' + occurrences + ' literal reference(s) to the spawning function name');
});

ok('EUREKA_DEP_SPEC is exactly the pinned range', () => {
  assert.strictEqual(EUREKA_DEP_SPEC, '@huggingface/transformers@^4.2.0');
});

ok('buildEurekaInstallArgv yields darwin/arm64 flags in order', () => {
  const built = buildEurekaInstallArgv({ prefix: '/tmp/x', platform: 'darwin', arch: 'arm64' });
  const argv = built.argv;
  assert.ok(Array.isArray(argv), 'argv must be an array');
  const idxInstall = argv.indexOf('install');
  const idxSpec = argv.indexOf(EUREKA_DEP_SPEC);
  const idxPrefixFlag = argv.indexOf('--prefix');
  const idxOsFlag = argv.indexOf('--os');
  const idxCpuFlag = argv.indexOf('--cpu');
  assert.ok(idxInstall !== -1, 'install verb missing');
  assert.ok(idxSpec > idxInstall, 'dep spec should follow install');
  assert.ok(idxPrefixFlag > idxSpec, '--prefix should follow the dep spec');
  assert.strictEqual(argv[idxPrefixFlag + 1], '/tmp/x');
  assert.ok(idxOsFlag > idxPrefixFlag, '--os should follow --prefix');
  assert.strictEqual(argv[idxOsFlag + 1], 'darwin');
  assert.ok(idxCpuFlag > idxOsFlag, '--cpu should follow --os');
  assert.strictEqual(argv[idxCpuFlag + 1], 'arm64');
});

ok('buildEurekaInstallArgv yields win32/x64 flags', () => {
  const built = buildEurekaInstallArgv({ prefix: '/tmp/y', platform: 'win32', arch: 'x64' });
  const j = built.argv.join(' ');
  assert.ok(/--os win32/.test(j), 'expected --os win32 in: ' + j);
  assert.ok(/--cpu x64/.test(j), 'expected --cpu x64 in: ' + j);
});

ok('the argv is an array of strings, never a shell string, and carries no shell metacharacters', () => {
  const built = buildEurekaInstallArgv({ prefix: '/tmp/z', platform: 'linux', arch: 'x64' });
  assert.ok(Array.isArray(built.argv));
  for (const el of built.argv) {
    assert.strictEqual(typeof el, 'string', 'every argv element must be a string');
    assert.ok(!/&&|;|\||`/.test(el), 'argv element contains a shell metacharacter: ' + el);
  }
});

ok('buildEurekaInstallArgv() with no arguments resolves --prefix to eurekaDepsRoot()', () => {
  const built = buildEurekaInstallArgv();
  assert.strictEqual(built.prefix, eurekaDepsRoot());
  const idxPrefixFlag = built.argv.indexOf('--prefix');
  assert.ok(idxPrefixFlag !== -1);
  assert.strictEqual(built.argv[idxPrefixFlag + 1], eurekaDepsRoot());
});

console.log('');
console.log('eureka-enable-argv: PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL > 0 ? 1 : 0);
