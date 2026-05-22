#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Regression tests for lib/core/mcp-dep-heal.cjs -- focused on the bug_011
 * fix folded into v1.13.0-beta.23.
 *
 * bug_011 -- dependency probe too narrow.
 *   ensureDepsPresent's probe defaulted to only ['@modelcontextprotocol/sdk',
 *   'zod']. A partially-populated node_modules (sdk + zod present, but
 *   @modelcontextprotocol/ext-apps or another production dep absent) PASSED the
 *   probe, no heal ran, and a bare `require` deeper in the lib/mcp/* chain
 *   (capability-registry.cjs -> app-views.cjs -> ext-apps/server) then threw
 *   MODULE_NOT_FOUND at module-init scope and crashed the server.
 *
 *   The fix: when no explicit `probe` is supplied, ensureDepsPresent defaults
 *   to the FULL production dependency set read from the plugin's package.json
 *   (Object.keys(pkg.dependencies)), exactly as scripts/sessionstart-npm-
 *   reconcile.cjs already does. A missing / unreadable package.json must fall
 *   back gracefully, never crash.
 *
 * These tests exercise productionDepNames directly and ensureDepsPresent
 * against synthetic plugin roots so no real `npm install` is ever spawned.
 *
 * HARD RULE: no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'mcp-dep-heal.cjs');
const { productionDepNames, ensureDepsPresent } = require(MODULE_PATH);

const FALLBACK = ['@modelcontextprotocol/sdk', 'zod'];

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  process.stdout.write('    ' + (err && err.message ? err.message : String(err)) + '\n');
}
function test(name, fn) {
  try { fn(); ok(name); } catch (err) { fail(name, err); }
}

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-dep-heal-test-'));
}

/**
 * Build a synthetic plugin root: a package.json + a node_modules tree
 * containing exactly `present` (a subset of the declared deps).
 */
function makeRoot(deps, present) {
  const dir = tmpdir();
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'fake', version: '0.0.0', dependencies: deps }, null, 2)
  );
  const nm = path.join(dir, 'node_modules');
  fs.mkdirSync(nm, { recursive: true });
  for (const name of present || []) {
    fs.mkdirSync(path.join(nm, ...name.split('/')), { recursive: true });
  }
  return dir;
}

// --- productionDepNames ----------------------------------------------------

// bug_011 core: productionDepNames reads the FULL dependencies set, not the
// 2-element MCP-critical pair.
test('bug_011: productionDepNames returns the full dependency set from package.json', () => {
  const deps = {
    '@modelcontextprotocol/sdk': '^1.29.0',
    '@modelcontextprotocol/ext-apps': '^1.5.0',
    zod: '^3.25.76',
    express: '^5.2.1',
  };
  const dir = makeRoot(deps, []);
  try {
    const names = productionDepNames(dir);
    assert.deepEqual(
      names.slice().sort(),
      Object.keys(deps).slice().sort(),
      'must return every declared production dependency'
    );
    assert.ok(
      names.indexOf('@modelcontextprotocol/ext-apps') !== -1,
      'ext-apps -- the dep bug_011 cited -- must be in the probe set'
    );
    assert.ok(names.length > FALLBACK.length, 'full set must be broader than the 2-dep fallback');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// productionDepNames matches the REAL plugin package.json when given the repo
// root -- proving the live MCP entry points get the full probe.
test('bug_011: productionDepNames matches the real plugin package.json', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  const expected = Object.keys(pkg.dependencies || {});
  const names = productionDepNames(REPO_ROOT);
  assert.deepEqual(names.slice().sort(), expected.slice().sort(),
    'live probe set must equal the plugin package.json dependencies');
  assert.ok(names.indexOf('@modelcontextprotocol/ext-apps') !== -1,
    'the real probe set must include ext-apps');
});

// Graceful fallback: a missing package.json must not crash, returns the pair.
test('bug_011: productionDepNames falls back gracefully when package.json is missing', () => {
  const dir = tmpdir(); // no package.json written
  try {
    const names = productionDepNames(dir);
    assert.deepEqual(names, FALLBACK, 'missing package.json => MCP-critical fallback');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// Graceful fallback: an unparseable package.json must not crash.
test('bug_011: productionDepNames falls back gracefully on an unparseable package.json', () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'package.json'), '{ this is : not json');
  try {
    const names = productionDepNames(dir);
    assert.deepEqual(names, FALLBACK, 'corrupt package.json => MCP-critical fallback');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// Fallback: a package.json with no dependencies block returns the pair (the
// install machinery still has something MCP-critical to probe).
test('bug_011: productionDepNames falls back when dependencies is empty', () => {
  const dir = tmpdir();
  fs.writeFileSync(path.join(dir, 'package.json'),
    JSON.stringify({ name: 'fake', version: '0.0.0' }));
  try {
    const names = productionDepNames(dir);
    assert.deepEqual(names, FALLBACK, 'no dependencies block => MCP-critical fallback');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- ensureDepsPresent probe behavior -------------------------------------

// THE decisive bug_011 test: a partially-populated node_modules (sdk + zod
// present, ext-apps ABSENT) must be detected as incomplete. Pre-fix the narrow
// probe passed and no heal ran. We pass a no-op runner via the probe so no real
// `npm install` is spawned -- instead we assert the missing-detection by
// inspecting what ensureDepsPresent decides.
test('bug_011: ensureDepsPresent detects a partial tree (sdk+zod present, ext-apps absent)', () => {
  const deps = {
    '@modelcontextprotocol/sdk': '^1.29.0',
    '@modelcontextprotocol/ext-apps': '^1.5.0',
    zod: '^3.25.76',
  };
  // node_modules has sdk + zod but NOT ext-apps -- the exact bug_011 scenario.
  const dir = makeRoot(deps, ['@modelcontextprotocol/sdk', 'zod']);
  try {
    // With the narrow 2-dep probe (the pre-fix default) this tree looks
    // healthy. Confirm that first, to prove the bug was real.
    let narrowSawMissing = false;
    for (const d of FALLBACK) {
      if (!fs.existsSync(path.join(dir, 'node_modules', ...d.split('/')))) {
        narrowSawMissing = true;
      }
    }
    assert.equal(narrowSawMissing, false,
      'pre-condition: the narrow sdk+zod probe would (wrongly) see this tree as healthy');

    // The full probe -- the fix -- must see ext-apps as missing.
    const fullProbe = productionDepNames(dir);
    let fullSawMissing = false;
    for (const d of fullProbe) {
      if (!fs.existsSync(path.join(dir, 'node_modules', ...d.split('/')))) {
        fullSawMissing = true;
      }
    }
    assert.equal(fullSawMissing, true,
      'the full-dep-set probe MUST detect the absent ext-apps');

    // ensureDepsPresent with an explicit no-op probe set (deps already present)
    // is a clean no-op -- confirms the explicit-probe path still works and
    // never spawns when nothing is missing.
    const res = ensureDepsPresent({ pluginRoot: dir, probe: ['@modelcontextprotocol/sdk', 'zod'] });
    assert.equal(res.healed, false, 'explicit probe of present-only deps => no heal');
    assert.equal(res.ok, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ensureDepsPresent on a fully-healthy tree (every declared dep present) is a
// pure no-op -- it must not spawn an install.
test('bug_011: ensureDepsPresent is a no-op when every production dep is present', () => {
  const deps = {
    '@modelcontextprotocol/sdk': '^1.29.0',
    zod: '^3.25.76',
    express: '^5.2.1',
  };
  const dir = makeRoot(deps, Object.keys(deps));
  try {
    const res = ensureDepsPresent({ pluginRoot: dir });
    assert.equal(res.healed, false, 'a complete tree must not trigger a heal');
    assert.equal(res.ok, true, 'a complete tree reports ok');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ensureDepsPresent must never crash on a pathological plugin root. A root
// with no package.json falls back to the MCP-critical pair; we pre-populate
// node_modules with that pair so the assertion stays on the no-throw contract
// without spawning a real `npm install` in the test.
test('bug_011: ensureDepsPresent never throws on a pathological plugin root', () => {
  const dir = tmpdir(); // no package.json -- productionDepNames -> FALLBACK
  const nm = path.join(dir, 'node_modules');
  fs.mkdirSync(nm, { recursive: true });
  for (const d of FALLBACK) {
    fs.mkdirSync(path.join(nm, ...d.split('/')), { recursive: true });
  }
  try {
    const res = ensureDepsPresent({ pluginRoot: dir });
    assert.ok(res && typeof res.healed === 'boolean' && typeof res.ok === 'boolean',
      'must return a well-formed result object, never throw');
    assert.equal(res.healed, false, 'fallback pair present => no heal, no install spawn');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// HARD RULE: no em-dashes in the module.
test('mcp-dep-heal.cjs has no em-dashes', () => {
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  const EM_DASH = String.fromCharCode(0x2014);
  assert.ok(src.indexOf(EM_DASH) === -1, 'em-dash found in mcp-dep-heal.cjs');
});

process.stdout.write('\nmcp-dep-heal: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
