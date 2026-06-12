#!/usr/bin/env node
'use strict';

/*
 * RCA doctor-marketplace-cache-drift-deadlock P2 (2026-06-12).
 *
 * scripts/check-version-and-sha.cjs used to resolve LATEST from main
 * plugin.json -- which on this repo's release train always holds the NEXT
 * unreleased placeholder (live bug: LATEST=1.13.1-beta.17 reported while
 * 1.13.1-beta.16 was the real landing). The published source of truth is the
 * mindrian-marketplace catalog pin: the plugins[] entry named 'mos' carries
 * the version users actually receive from `claude plugin update`.
 *
 * Contract under test (ZERO network -- pure helpers + injected fetchJson stubs):
 *   c.1  resolveLatestFromCatalog(catalog) returns the 'mos' entry's version
 *        for a fixture shaped exactly like the live marketplace.json.
 *   c.2  returns null on: no 'mos' entry; plugins missing / not an array;
 *        'mos' entry missing version.
 *   c.3  fallback ordering -- catalog URL rejects + plugin.json URL resolves
 *        -> placeholder version with source marked degraded; catalog URL
 *        resolves -> catalog pin wins and plugin.json URL is NEVER fetched
 *        (stub call order/count asserted).
 *   c.4  both URLs reject -> fetchLatestVersion rejects (preserves the
 *        STATUS=NETWORK_ERROR exit-1 path in main()).
 *   c.5  require()ing the module does NOT execute main() (require.main guard;
 *        no STATUS= stdout side-effect, no process.exit, no network).
 *
 * Pass/failTest counter style mirrors tests/test-doctor-class-a-topology-drift.cjs;
 * picked up by tests/run-all.sh via the test-*.cjs glob.
 *
 * Canon Part 8: zero network surface; stubs only.
 */

const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const CHECKER = path.join(REPO_ROOT, 'scripts', 'check-version-and-sha.cjs');

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + (err && err.message || err)); }

const CATALOG_URL_RE = /mindrian-marketplace\/main\/\.claude-plugin\/marketplace\.json/;
const PLUGIN_JSON_URL_RE = /mindrian-os-plugin\/main\/\.claude-plugin\/plugin\.json/;

// Fixture shaped exactly like the live mindrian-marketplace marketplace.json.
function liveShapedCatalog() {
  return {
    name: 'mindrian-marketplace',
    owner: { name: 'Jonathan Sagir' },
    plugins: [
      {
        name: 'mos',
        source: {
          source: 'url',
          url: 'https://github.com/jsagir/mindrian-os-plugin.git',
          ref: 'v1.13.1-beta.16',
        },
        description: 'MindrianOS',
        version: '1.13.1-beta.16',
      },
    ],
  };
}

let mod = null;
try {
  mod = require(CHECKER);
} catch (e) {
  // leave null; c.1 will fail loudly with the require error context
  console.log('require(' + CHECKER + ') threw: ' + e.message);
}

// -- c.1: catalog pin parses ------------------------------------------------
try {
  assert.ok(mod && typeof mod.resolveLatestFromCatalog === 'function',
    'resolveLatestFromCatalog exported; got ' + (mod && typeof mod.resolveLatestFromCatalog));
  const v = mod.resolveLatestFromCatalog(liveShapedCatalog());
  assert.strictEqual(v, '1.13.1-beta.16', 'live-shaped catalog resolves to the mos pin; got ' + v);
  pass('Test c.1 (resolveLatestFromCatalog parses the live-shaped catalog pin)');
} catch (err) { failTest('Test c.1 (resolveLatestFromCatalog parses the live-shaped catalog pin)', err); }

// -- c.2: malformed catalogs return null -------------------------------------
try {
  assert.ok(mod && typeof mod.resolveLatestFromCatalog === 'function', 'helper exported');
  const f = mod.resolveLatestFromCatalog;
  assert.strictEqual(f({ plugins: [{ name: 'other-plugin', version: '9.9.9' }] }), null,
    'no mos entry -> null');
  assert.strictEqual(f({}), null, 'plugins missing -> null');
  assert.strictEqual(f({ plugins: 'not-an-array' }), null, 'plugins not an array -> null');
  assert.strictEqual(f(null), null, 'null catalog -> null');
  assert.strictEqual(f({ plugins: [{ name: 'mos' }] }), null, 'mos entry missing version -> null');
  assert.strictEqual(f({ plugins: [{ name: 'mos', version: '' }] }), null, 'mos entry empty version -> null');
  pass('Test c.2 (malformed catalogs return null, never throw)');
} catch (err) { failTest('Test c.2 (malformed catalogs return null, never throw)', err); }

// -- c.3: fallback ordering ---------------------------------------------------
(async function c3() {
  try {
    assert.ok(mod && typeof mod.fetchLatestVersion === 'function',
      'fetchLatestVersion exported; got ' + (mod && typeof mod.fetchLatestVersion));

    // (a) catalog rejects, plugin.json resolves -> degraded fallback.
    const callsA = [];
    const stubA = (url) => {
      callsA.push(url);
      if (CATALOG_URL_RE.test(url)) return Promise.reject(new Error('HTTP 503 fetching catalog'));
      if (PLUGIN_JSON_URL_RE.test(url)) return Promise.resolve({ name: 'mos', version: '1.13.1-beta.17' });
      return Promise.reject(new Error('unexpected URL: ' + url));
    };
    const degraded = await mod.fetchLatestVersion({ fetchJson: stubA });
    assert.strictEqual(degraded.version, '1.13.1-beta.17', 'degraded path returns the placeholder version');
    assert.ok(/degraded/.test(String(degraded.source)),
      'degraded result marks the source as degraded (so REASON can disclose it); got ' + JSON.stringify(degraded));
    assert.strictEqual(callsA.length, 2, 'degraded path fetched catalog then plugin.json; got ' + JSON.stringify(callsA));
    assert.ok(CATALOG_URL_RE.test(callsA[0]), 'catalog URL fetched FIRST; got ' + callsA[0]);
    assert.ok(PLUGIN_JSON_URL_RE.test(callsA[1]), 'plugin.json URL fetched second; got ' + callsA[1]);

    // (b) catalog resolves -> pin wins, plugin.json never fetched.
    const callsB = [];
    const stubB = (url) => {
      callsB.push(url);
      if (CATALOG_URL_RE.test(url)) return Promise.resolve(liveShapedCatalog());
      return Promise.reject(new Error('plugin.json must not be fetched when the catalog resolves: ' + url));
    };
    const primary = await mod.fetchLatestVersion({ fetchJson: stubB });
    assert.strictEqual(primary.version, '1.13.1-beta.16', 'catalog pin wins; got ' + JSON.stringify(primary));
    assert.ok(!/degraded/.test(String(primary.source)), 'primary source is not degraded; got ' + primary.source);
    assert.strictEqual(callsB.length, 1, 'exactly ONE fetch (the catalog); got ' + JSON.stringify(callsB));
    assert.ok(CATALOG_URL_RE.test(callsB[0]), 'the one fetch is the catalog URL; got ' + callsB[0]);
    pass('Test c.3 (fallback ordering: catalog primary, plugin.json degraded fallback)');
  } catch (err) { failTest('Test c.3 (fallback ordering: catalog primary, plugin.json degraded fallback)', err); }

  // -- c.4: both reject -> the promise rejects --------------------------------
  try {
    assert.ok(mod && typeof mod.fetchLatestVersion === 'function', 'fetchLatestVersion exported');
    const stub = () => Promise.reject(new Error('ECONNREFUSED (offline)'));
    let rejected = null;
    try {
      await mod.fetchLatestVersion({ fetchJson: stub });
    } catch (e) { rejected = e; }
    assert.ok(rejected instanceof Error,
      'fetchLatestVersion rejects when BOTH URLs fail (preserves STATUS=NETWORK_ERROR exit 1); got ' + rejected);
    pass('Test c.4 (both URLs fail -> rejection preserved for NETWORK_ERROR path)');
  } catch (err) { failTest('Test c.4 (both URLs fail -> rejection preserved for NETWORK_ERROR path)', err); }

  // -- c.5: require() has no side effects ------------------------------------
  try {
    const script = 'const m = require(' + JSON.stringify(CHECKER) + ');'
      + 'console.log("REQUIRED_OK " + typeof m.resolveLatestFromCatalog + " " + typeof m.fetchLatestVersion + " " + typeof m.compareSemver);';
    const r = spawnSync('node', ['-e', script], { encoding: 'utf8', timeout: 15000 });
    const out = (r.stdout || '') + (r.stderr || '');
    assert.strictEqual(r.status, 0, 'require-only child exits 0 (no main(), no process.exit); got ' + r.status + ' :: ' + out.slice(0, 200));
    assert.ok(/REQUIRED_OK function function function/.test(out),
      'exports surface present after require; got: ' + out.slice(0, 200));
    assert.ok(!/STATUS=/.test(out), 'no STATUS= protocol output on bare require (main() must not run); got: ' + out.slice(0, 200));
    pass('Test c.5 (require.main guard: bare require runs nothing)');
  } catch (err) { failTest('Test c.5 (require.main guard: bare require runs nothing)', err); }

  if (failed > 0) {
    console.log('\n' + failed + ' test(s) FAILED (' + passed + ' passed)');
    process.exit(1);
  }
  console.log('\nAll ' + passed + ' tests PASS');
  process.exit(0);
}());
