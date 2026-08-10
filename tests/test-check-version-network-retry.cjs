#!/usr/bin/env node
'use strict';

/*
 * F-I (windows-install-and-field-qa-sweep-2026-08-10, Test 2).
 *
 * scripts/check-version-and-sha.cjs's fetchLatestVersion() used to be a
 * single-shot fetch of each URL (catalog then plugin.json fallback); any
 * throw aborted immediately and main() printed STATUS=NETWORK_ERROR. Both
 * URLs share one host (raw.githubusercontent.com), so a single transient
 * host-level reset failed the whole check with no retry (T2: `/mos:update`
 * looped on "read ECONNRESET" on an enterprise/edu network).
 *
 * Contract under test (ZERO real network / ZERO real timers -- pure
 * injected fetchJson + sleep stubs):
 *   r.1  a transient error (ECONNRESET/ETIMEDOUT/EAI_AGAIN) on attempt 1
 *        followed by success on attempt 2 -> fetchLatestVersion() resolves
 *        with the version (retried, no STATUS=NETWORK_ERROR would fire).
 *   r.2  bounded attempts: transient errors on every attempt exhaust after
 *        2-3 tries (not unbounded) -- STATUS=NETWORK_ERROR fires only after
 *        exhaustion, never before.
 *   r.3  backoff delays passed to the injected sleep are increasing
 *        (250/500/1000ms shape), never a busy-loop / zero-delay retry.
 *   r.4  a NON-transient error (e.g. HTTP 503, generic Error) is NOT
 *        retried -- single attempt, immediate throw. Preserves the existing
 *        c.3/c.4 call-count contract in test-check-version-latest-resolution.cjs.
 *   r.5  retry applies independently to BOTH the catalog fetch and the
 *        plugin.json degraded-fallback fetch (they share one host, so a
 *        reset on either must be retried, not just the primary).
 *
 * Pass/failTest counter style mirrors tests/test-check-version-latest-resolution.cjs.
 * Canon Part 8: zero network; stubs only.
 */

const assert = require('node:assert');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CHECKER = path.join(REPO_ROOT, 'scripts', 'check-version-and-sha.cjs');

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + (err && err.message || err)); }

const CATALOG_URL_RE = /mindrian-marketplace\/[^/]+\/\.claude-plugin\/marketplace\.json/;
const PLUGIN_JSON_URL_RE = /mindrian-os-plugin\/main\/\.claude-plugin\/plugin\.json/;

function liveShapedCatalog() {
  return {
    plugins: [{ name: 'mos', version: '1.13.1-beta.16' }],
  };
}

// Instant, call-recording sleep stub -- hermetic, no real timers.
function makeInstantSleep() {
  const delays = [];
  const sleep = (ms) => { delays.push(ms); return Promise.resolve(); };
  return { sleep, delays };
}

function transientError(code) {
  const e = new Error('read ' + code);
  e.code = code;
  return e;
}

let mod = null;
try {
  mod = require(CHECKER);
} catch (e) {
  console.log('require(' + CHECKER + ') threw: ' + e.message);
}

(async function main() {
  // -- r.1: transient error then success -> resolves, retried ----------------
  try {
    assert.ok(mod && typeof mod.fetchLatestVersion === 'function', 'fetchLatestVersion exported');
    const { sleep, delays } = makeInstantSleep();
    let calls = 0;
    const stub = (url) => {
      calls += 1;
      assert.ok(CATALOG_URL_RE.test(url), 'call is against the catalog URL; got ' + url);
      if (calls === 1) return Promise.reject(transientError('ECONNRESET'));
      return Promise.resolve(liveShapedCatalog());
    };
    const result = await mod.fetchLatestVersion({ fetchJson: stub, sleep });
    assert.strictEqual(result.version, '1.13.1-beta.16', 'resolves with the version after one transient retry; got ' + JSON.stringify(result));
    assert.strictEqual(calls, 2, 'exactly 2 attempts (1 failure + 1 success); got ' + calls);
    assert.strictEqual(delays.length, 1, 'exactly 1 backoff sleep between the 2 attempts; got ' + JSON.stringify(delays));
    pass('Test r.1 (transient ECONNRESET on attempt 1, success on attempt 2 -> resolved)');
  } catch (err) { failTest('Test r.1 (transient ECONNRESET on attempt 1, success on attempt 2 -> resolved)', err); }

  // -- r.2: bounded exhaustion -- never unbounded ------------------------------
  try {
    const { sleep } = makeInstantSleep();
    let catalogCalls = 0;
    let pluginJsonCalls = 0;
    const stub = (url) => {
      if (CATALOG_URL_RE.test(url)) { catalogCalls += 1; return Promise.reject(transientError('ETIMEDOUT')); }
      if (PLUGIN_JSON_URL_RE.test(url)) { pluginJsonCalls += 1; return Promise.reject(transientError('ETIMEDOUT')); }
      return Promise.reject(new Error('unexpected URL: ' + url));
    };
    let rejected = null;
    try {
      await mod.fetchLatestVersion({ fetchJson: stub, sleep });
    } catch (e) { rejected = e; }
    assert.ok(rejected instanceof Error, 'rejects once BOTH URLs exhaust their retries (preserves STATUS=NETWORK_ERROR path)');
    assert.ok(catalogCalls >= 2 && catalogCalls <= 3, 'catalog attempts are bounded (2-3), never unbounded; got ' + catalogCalls);
    assert.ok(pluginJsonCalls >= 2 && pluginJsonCalls <= 3, 'plugin.json fallback attempts are also bounded (2-3); got ' + pluginJsonCalls);
    pass('Test r.2 (bounded retry exhaustion on persistent transient errors, never unbounded)');
  } catch (err) { failTest('Test r.2 (bounded retry exhaustion on persistent transient errors, never unbounded)', err); }

  // -- r.3: increasing backoff shape (250/500/1000ms) --------------------------
  // Isolated to the CATALOG leg only: the plugin.json fallback resolves
  // immediately (non-transient path, zero delays) so the recorded delays
  // reflect a single retry loop's backoff shape, not two loops concatenated
  // (fetchLatestVersion tries the catalog, then independently retries the
  // plugin.json fallback -- each loop resets its own backoff sequence).
  try {
    const { sleep, delays } = makeInstantSleep();
    const stub = (url) => {
      if (CATALOG_URL_RE.test(url)) return Promise.reject(transientError('EAI_AGAIN'));
      if (PLUGIN_JSON_URL_RE.test(url)) return Promise.resolve({ name: 'mos', version: '1.13.1-beta.17' });
      return Promise.reject(new Error('unexpected URL: ' + url));
    };
    await mod.fetchLatestVersion({ fetchJson: stub, sleep });
    assert.ok(delays.length >= 1, 'at least one backoff delay recorded; got ' + JSON.stringify(delays));
    for (let i = 1; i < delays.length; i++) {
      assert.ok(delays[i] >= delays[i - 1], 'backoff delays never decrease: ' + JSON.stringify(delays));
    }
    assert.ok(delays.every(d => d > 0), 'no zero-delay busy-loop retries; got ' + JSON.stringify(delays));
    pass('Test r.3 (backoff delays increase, never a zero-delay busy loop)');
  } catch (err) { failTest('Test r.3 (backoff delays increase, never a zero-delay busy loop)', err); }

  // -- r.4: non-transient error is NOT retried ---------------------------------
  try {
    const { sleep, delays } = makeInstantSleep();
    let catalogCalls = 0;
    let pluginJsonCalls = 0;
    const stub = (url) => {
      if (CATALOG_URL_RE.test(url)) { catalogCalls += 1; return Promise.reject(new Error('HTTP 503 fetching catalog')); }
      if (PLUGIN_JSON_URL_RE.test(url)) { pluginJsonCalls += 1; return Promise.reject(new Error('HTTP 503 fetching plugin.json')); }
      return Promise.reject(new Error('unexpected URL: ' + url));
    };
    let rejected = null;
    try { await mod.fetchLatestVersion({ fetchJson: stub, sleep }); } catch (e) { rejected = e; }
    assert.ok(rejected instanceof Error, 'non-transient failure still rejects');
    assert.strictEqual(catalogCalls, 1, 'non-transient error is NOT retried on the catalog fetch; got ' + catalogCalls);
    assert.strictEqual(pluginJsonCalls, 1, 'non-transient error is NOT retried on the plugin.json fallback either; got ' + pluginJsonCalls);
    assert.strictEqual(delays.length, 0, 'no backoff sleep for a non-transient error; got ' + JSON.stringify(delays));
    pass('Test r.4 (non-transient HTTP error is not retried; single attempt, immediate throw)');
  } catch (err) { failTest('Test r.4 (non-transient HTTP error is not retried; single attempt, immediate throw)', err); }

  // -- r.5: retry applies to BOTH catalog and plugin.json fallback ------------
  try {
    const { sleep } = makeInstantSleep();
    let catalogCalls = 0;
    const stub = (url) => {
      if (CATALOG_URL_RE.test(url)) { catalogCalls += 1; return Promise.reject(transientError('ECONNRESET')); }
      if (PLUGIN_JSON_URL_RE.test(url)) {
        // Catalog exhausts and falls through; plugin.json succeeds on its own first try.
        return Promise.resolve({ name: 'mos', version: '1.13.1-beta.17' });
      }
      return Promise.reject(new Error('unexpected URL: ' + url));
    };
    const result = await mod.fetchLatestVersion({ fetchJson: stub, sleep });
    assert.strictEqual(result.version, '1.13.1-beta.17', 'falls through to the degraded plugin.json source after catalog exhausts; got ' + JSON.stringify(result));
    assert.ok(/degraded/.test(String(result.source)), 'degraded source is disclosed; got ' + result.source);
    assert.ok(catalogCalls >= 2 && catalogCalls <= 3, 'catalog was retried (bounded) before falling through; got ' + catalogCalls);
    pass('Test r.5 (retry applies independently to catalog AND plugin.json fallback)');
  } catch (err) { failTest('Test r.5 (retry applies independently to catalog AND plugin.json fallback)', err); }

  if (failed > 0) {
    console.log('\n' + failed + ' test(s) FAILED (' + passed + ' passed)');
    process.exit(1);
  }
  console.log('\nAll ' + passed + ' tests PASS');
  process.exit(0);
}());
