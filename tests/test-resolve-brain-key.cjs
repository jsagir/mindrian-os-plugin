#!/usr/bin/env node
'use strict';

/*
 * Phase 123 Plan-07 Wave-0 -- lib/core/resolve-brain-key.cjs hermetic test.
 *
 * Nine scenarios cover the single-resolver contract per Plan-07 <objective>:
 *
 *   rbk.1  MINDRIAN_BRAIN_KEY env wins              (source='env')
 *   rbk.2  ~/.mindrian.env wins over CWD .env       (source='mindrian-env-file')
 *           -- depends on the env-aware `home` default (FLAG-3 fix)
 *   rbk.3  CWD .env fallback                        (source='cwd-env-file')
 *   rbk.4  not-found is explicit with a reason      (source='not-found')
 *   rbk.5  SEC-02 0o077 mask -> permissions too open + 0644 in reason
 *           (POSIX only; skipped on Windows)
 *   rbk.6  Canon Part 8 zero-network grep against the resolver source
 *   rbk.7  brain-client.cjs::getApiKey() delegates to resolveBrainKey
 *           (RED until Task 2 lands the require + delegation)
 *   rbk.8  brain-client.cjs preconditions intact (BRAIN_REQUEST_TIMEOUT_MS,
 *           AbortSignal.timeout, async function ask, AND the new require
 *           statement for resolve-brain-key) -- RED until Task 2.
 *   rbk.9  Structural assertion: the resolver source contains the env-aware
 *           home default pattern `process.env.HOME || process.env.USERPROFILE
 *           || os.homedir()` -- the FLAG-3 fix is in source.
 *
 * Hermetic envelope: scope-local override of process.env.MINDRIAN_BRAIN_KEY,
 * process.env.HOME (+ USERPROFILE for Windows-shape parity), and a per-test
 * mkdtempSync HOME + CWD pair. Mirrors tests/test-doctor-class-i.cjs's
 * makeTmpHome pattern.
 *
 * Registered in lib/memory/run-feynman-tests.cjs Phase-123 block.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const RESOLVER = path.join(REPO_ROOT, 'lib', 'core', 'resolve-brain-key.cjs');
const BRAIN_CLIENT = path.join(REPO_ROOT, 'lib', 'core', 'brain-client.cjs');

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + (err && err.message || err)); }

function makeTmpHome(suffix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), '123-07-rbk-' + suffix + '-'));
}

function rmTmp(t) {
  try { fs.rmSync(t, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

// Hermetic envelope: snapshot+override env, return a restore fn. Always
// restore the actual prior values (delete if absent before, restore if set).
function withEnv(overrides, fn) {
  const snapshot = {};
  const keys = Object.keys(overrides);
  for (const k of keys) {
    snapshot[k] = Object.prototype.hasOwnProperty.call(process.env, k) ? process.env[k] : undefined;
    if (overrides[k] === undefined) delete process.env[k];
    else process.env[k] = overrides[k];
  }
  try {
    return fn();
  } finally {
    for (const k of keys) {
      if (snapshot[k] === undefined) delete process.env[k];
      else process.env[k] = snapshot[k];
    }
  }
}

// Fresh-require the resolver (stateless, but idempotent test discipline).
function freshResolver() {
  delete require.cache[require.resolve(RESOLVER)];
  return require(RESOLVER);
}

// rbk.1 -- env wins.
(function rbk1() {
  const name = 'rbk.1 env wins (source=env, key trimmed)';
  const home = makeTmpHome('1');
  try {
    // Put a different value in ~/.mindrian.env so we'd see it if env did NOT win.
    fs.writeFileSync(path.join(home, '.mindrian.env'), 'MINDRIAN_BRAIN_KEY=home-key-not-this\n', { mode: 0o600 });
    withEnv({ MINDRIAN_BRAIN_KEY: '  test-env-key  ', HOME: home, USERPROFILE: home }, () => {
      const { resolveBrainKey } = freshResolver();
      const r = resolveBrainKey();
      assert.strictEqual(r.available, true, 'available');
      assert.strictEqual(r.source, 'env', 'source');
      assert.strictEqual(r.key, 'test-env-key', 'key trimmed');
      assert.strictEqual(r.reason, null, 'no reason');
    });
    pass(name);
  } catch (e) { failTest(name, e); } finally { rmTmp(home); }
})();

// rbk.2 -- ~/.mindrian.env wins over CWD .env (D-31 order; FLAG-3 fix).
(function rbk2() {
  const name = 'rbk.2 ~/.mindrian.env over CWD .env (FLAG-3 env-aware home)';
  const home = makeTmpHome('2');
  const cwd = makeTmpHome('2cwd');
  try {
    fs.writeFileSync(path.join(home, '.mindrian.env'), 'MINDRIAN_BRAIN_KEY=test-mindrian-env\n', { mode: 0o600 });
    fs.writeFileSync(path.join(cwd, '.env'), 'MINDRIAN_BRAIN_KEY=test-cwd-loser\n', { mode: 0o600 });
    withEnv({ MINDRIAN_BRAIN_KEY: undefined, HOME: home, USERPROFILE: home }, () => {
      const { resolveBrainKey } = freshResolver();
      const r = resolveBrainKey({ cwd: cwd });
      assert.strictEqual(r.available, true, 'available');
      assert.strictEqual(r.source, 'mindrian-env-file', 'source');
      assert.strictEqual(r.key, 'test-mindrian-env', 'key');
      assert.strictEqual(r.reason, null, 'no reason');
    });
    pass(name);
  } catch (e) { failTest(name, e); } finally { rmTmp(home); rmTmp(cwd); }
})();

// rbk.3 -- CWD .env fallback.
(function rbk3() {
  const name = 'rbk.3 CWD .env fallback (source=cwd-env-file)';
  const home = makeTmpHome('3');
  const cwd = makeTmpHome('3cwd');
  try {
    // home has NO .mindrian.env
    fs.writeFileSync(path.join(cwd, '.env'), 'MINDRIAN_BRAIN_KEY=test-cwd\n', { mode: 0o600 });
    withEnv({ MINDRIAN_BRAIN_KEY: undefined, HOME: home, USERPROFILE: home }, () => {
      const { resolveBrainKey } = freshResolver();
      const r = resolveBrainKey({ cwd: cwd });
      assert.strictEqual(r.available, true, 'available');
      assert.strictEqual(r.source, 'cwd-env-file', 'source');
      assert.strictEqual(r.key, 'test-cwd', 'key');
    });
    pass(name);
  } catch (e) { failTest(name, e); } finally { rmTmp(home); rmTmp(cwd); }
})();

// rbk.4 -- not-found.
(function rbk4() {
  const name = 'rbk.4 not-found is explicit (source=not-found + reason)';
  const home = makeTmpHome('4');
  const cwd = makeTmpHome('4cwd');
  try {
    withEnv({ MINDRIAN_BRAIN_KEY: undefined, HOME: home, USERPROFILE: home }, () => {
      const { resolveBrainKey } = freshResolver();
      const r = resolveBrainKey({ cwd: cwd });
      assert.strictEqual(r.available, false, 'available');
      assert.strictEqual(r.source, 'not-found', 'source');
      assert.strictEqual(r.key, null, 'key');
      assert.ok(r.reason && r.reason.length > 0, 'reason non-empty');
    });
    pass(name);
  } catch (e) { failTest(name, e); } finally { rmTmp(home); rmTmp(cwd); }
})();

// rbk.5 -- SEC-02 0o077 reject (POSIX only).
(function rbk5() {
  const name = 'rbk.5 SEC-02 0o644 reject with explicit reason';
  if (process.platform === 'win32') {
    console.log('SKIP rbk.5 -- POSIX-only (SEC-02 check is a no-op on Windows)');
    return;
  }
  const home = makeTmpHome('5');
  try {
    const p = path.join(home, '.mindrian.env');
    fs.writeFileSync(p, 'MINDRIAN_BRAIN_KEY=test-key-with-bad-perms\n');
    fs.chmodSync(p, 0o644);
    withEnv({ MINDRIAN_BRAIN_KEY: undefined, HOME: home, USERPROFILE: home }, () => {
      const { resolveBrainKey } = freshResolver();
      const r = resolveBrainKey();
      assert.strictEqual(r.available, false, 'available');
      assert.strictEqual(r.key, null, 'key');
      assert.ok(r.reason, 'reason present');
      assert.ok(/permissions too open/i.test(r.reason), 'reason mentions permissions too open');
      assert.ok(/0?644/.test(r.reason), 'reason includes mode 0644');
    });
    pass(name);
  } catch (e) { failTest(name, e); } finally { rmTmp(home); }
})();

// rbk.6 -- Canon Part 8: resolver source carries no network markers.
(function rbk6() {
  const name = 'rbk.6 Canon Part 8 -- zero network markers in resolver source';
  try {
    const res = spawnSync('grep', ['-E', 'fetch|http|curl|brain.mindrian|tavily', RESOLVER], {
      encoding: 'utf8',
    });
    // grep exits 1 when no match -- which is what we want.
    assert.strictEqual(res.status, 1, 'grep returns 1 (no match) -- got status ' + res.status + ' stdout:\n' + res.stdout);
    pass(name);
  } catch (e) { failTest(name, e); }
})();

// rbk.7 -- brain-client.cjs::getApiKey() delegates to resolveBrainKey.
// This is RED until Task 2 lands the require + delegation. After Task 2 it goes GREEN.
(function rbk7() {
  const name = 'rbk.7 brain-client.getApiKey() delegates to resolveBrainKey (Task 2)';
  const home = makeTmpHome('7');
  try {
    // Monkey-patch the resolver to count calls, then require brain-client fresh
    // and call its getApiKey(). After Task 2, getApiKey() requires the resolver
    // and calls it, so our spy fires at least once.
    delete require.cache[require.resolve(RESOLVER)];
    const rbk = require(RESOLVER);
    const orig = rbk.resolveBrainKey;
    let calls = 0;
    rbk.resolveBrainKey = function (...args) { calls += 1; return orig.apply(this, args); };
    try {
      withEnv({ MINDRIAN_BRAIN_KEY: 'spy-test-key', HOME: home, USERPROFILE: home }, () => {
        // Reset module memoization between tests so getApiKey() actually calls the resolver.
        delete require.cache[require.resolve(BRAIN_CLIENT)];
        const bc = require(BRAIN_CLIENT);
        bc.getApiKey();
      });
      assert.ok(calls >= 1, 'expected resolveBrainKey to be called at least once via brain-client.getApiKey(); calls=' + calls);
    } finally {
      rbk.resolveBrainKey = orig;
    }
    pass(name);
  } catch (e) { failTest(name, e); } finally { rmTmp(home); }
})();

// rbk.8 -- brain-client preconditions (already on main HEAD) + new require statement (Task 2).
(function rbk8() {
  const name = 'rbk.8 brain-client preconditions (BRAIN_REQUEST_TIMEOUT_MS, AbortSignal, ask) + new require (Task 2)';
  try {
    const bcSrc = fs.readFileSync(BRAIN_CLIENT, 'utf8');
    assert.ok(/BRAIN_REQUEST_TIMEOUT_MS/.test(bcSrc), 'precondition: BRAIN_REQUEST_TIMEOUT_MS const present');
    assert.ok(/AbortSignal\.timeout/.test(bcSrc), 'precondition: AbortSignal.timeout present');
    assert.ok(/async function ask\(/.test(bcSrc), 'precondition: async function ask( present');
    assert.ok(/Authorization.*Bearer/.test(bcSrc), 'precondition: Authorization Bearer auth unchanged');
    // Task 2 GREEN: the new require statement for resolve-brain-key.
    assert.ok(/require\(['"][^'"]*resolve-brain-key[^'"]*['"]\)/.test(bcSrc), 'Task 2: brain-client requires resolve-brain-key');
    pass(name);
  } catch (e) { failTest(name, e); }
})();

// rbk.9 -- Structural assertion for the FLAG-3 env-aware home default.
(function rbk9() {
  const name = 'rbk.9 FLAG-3: home default uses HOME || USERPROFILE || os.homedir()';
  try {
    const src = fs.readFileSync(RESOLVER, 'utf8');
    assert.ok(
      /process\.env\.HOME\s*\|\|\s*process\.env\.USERPROFILE\s*\|\|\s*os\.homedir\(\)/.test(src),
      'home default must be `process.env.HOME || process.env.USERPROFILE || os.homedir()` so hermetic tests work'
    );
    pass(name);
  } catch (e) { failTest(name, e); }
})();

// ---------------------------------------------------------------------------
// Quick task 260722-wom: pre-prefixed key normalization at the resolver
// chokepoint (per the 2026-07-22 Memgraph migration brief). A live env can
// store the whole wire auth header value inside MINDRIAN_BRAIN_KEY; the client
// re-wraps with its own Bearer prefix, so the resolver must hand back a bare
// token. rbk.10/11/12/14 are RED until _normalizeKey lands; rbk.13 is a pin.
// ---------------------------------------------------------------------------

// rbk.10 -- env value 'Bearer <token>' normalizes to the bare token.
(function rbk10() {
  const name = 'rbk.10 env "Bearer test-token-123" -> bare "test-token-123"';
  const home = makeTmpHome('10');
  try {
    withEnv({ MINDRIAN_BRAIN_KEY: 'Bearer test-token-123', HOME: home, USERPROFILE: home }, () => {
      const { resolveBrainKey } = freshResolver();
      const r = resolveBrainKey();
      assert.strictEqual(r.available, true, 'available');
      assert.strictEqual(r.source, 'env', 'source');
      assert.strictEqual(r.key, 'test-token-123', 'bare token');
      assert.strictEqual(r.reason, null, 'no reason');
    });
    pass(name);
  } catch (e) { failTest(name, e); } finally { rmTmp(home); }
})();

// rbk.11 -- env value 'Authorization: Bearer <token>' (any case) -> bare token.
(function rbk11() {
  const name = 'rbk.11 env "Authorization: Bearer <t>" -> bare token (case-insensitive)';
  const home = makeTmpHome('11');
  try {
    withEnv({ MINDRIAN_BRAIN_KEY: 'Authorization: Bearer test-token-456', HOME: home, USERPROFILE: home }, () => {
      const { resolveBrainKey } = freshResolver();
      const r = resolveBrainKey();
      assert.strictEqual(r.available, true, 'available (mixed case)');
      assert.strictEqual(r.source, 'env', 'source');
      assert.strictEqual(r.key, 'test-token-456', 'bare token (mixed case)');
    });
    // All-lowercase form strips just the same.
    withEnv({ MINDRIAN_BRAIN_KEY: 'authorization: bearer test-token-789', HOME: home, USERPROFILE: home }, () => {
      const { resolveBrainKey } = freshResolver();
      const r = resolveBrainKey();
      assert.strictEqual(r.available, true, 'available (lowercase)');
      assert.strictEqual(r.key, 'test-token-789', 'bare token (lowercase)');
    });
    pass(name);
  } catch (e) { failTest(name, e); } finally { rmTmp(home); }
})();

// rbk.12 -- a ~/.mindrian.env file value normalizes too (file path, not just env).
(function rbk12() {
  const name = 'rbk.12 ~/.mindrian.env "Bearer <t>" -> bare token (file path normalizes)';
  const home = makeTmpHome('12');
  const cwd = makeTmpHome('12cwd');
  try {
    fs.writeFileSync(path.join(home, '.mindrian.env'), 'MINDRIAN_BRAIN_KEY=Bearer test-file-token\n', { mode: 0o600 });
    withEnv({ MINDRIAN_BRAIN_KEY: undefined, HOME: home, USERPROFILE: home }, () => {
      const { resolveBrainKey } = freshResolver();
      const r = resolveBrainKey({ cwd: cwd });
      assert.strictEqual(r.available, true, 'available');
      assert.strictEqual(r.source, 'mindrian-env-file', 'source');
      assert.strictEqual(r.key, 'test-file-token', 'bare token from file');
    });
    pass(name);
  } catch (e) { failTest(name, e); } finally { rmTmp(home); rmTmp(cwd); }
})();

// rbk.13 -- regression pin: mid-string 'bearer' + plain bare token pass through.
(function rbk13() {
  const name = 'rbk.13 mid-string "xbearerx" and plain bare token pass through byte-unchanged';
  const home = makeTmpHome('13');
  try {
    // Anchored strip: 'xbearerx-mid-string' does NOT start with the scheme token.
    withEnv({ MINDRIAN_BRAIN_KEY: 'xbearerx-mid-string', HOME: home, USERPROFILE: home }, () => {
      const { resolveBrainKey } = freshResolver();
      const r = resolveBrainKey();
      assert.strictEqual(r.available, true, 'available');
      assert.strictEqual(r.key, 'xbearerx-mid-string', 'mid-string value byte-unchanged');
    });
    // A plain bare token is untouched (pins no-mangling beyond rbk.1's trim).
    withEnv({ MINDRIAN_BRAIN_KEY: 'plain-bare-token-000', HOME: home, USERPROFILE: home }, () => {
      const { resolveBrainKey } = freshResolver();
      const r = resolveBrainKey();
      assert.strictEqual(r.key, 'plain-bare-token-000', 'bare token byte-unchanged');
    });
    pass(name);
  } catch (e) { failTest(name, e); } finally { rmTmp(home); }
})();

// rbk.14 -- env value 'Bearer' alone never yields an empty key; falls through.
(function rbk14() {
  const name = 'rbk.14 env "Bearer" alone -> falls through to file chain, never empty key';
  const home = makeTmpHome('14');
  const cwd = makeTmpHome('14cwd');
  try {
    // A real key sits in the file so we can prove fall-through (not just not-found).
    fs.writeFileSync(path.join(home, '.mindrian.env'), 'MINDRIAN_BRAIN_KEY=fallback-token-014\n', { mode: 0o600 });
    withEnv({ MINDRIAN_BRAIN_KEY: 'Bearer', HOME: home, USERPROFILE: home }, () => {
      const { resolveBrainKey } = freshResolver();
      const r = resolveBrainKey({ cwd: cwd });
      // Nothing remains after stripping the bare scheme token -> env branch skipped.
      assert.strictEqual(r.available, true, 'available (from file, not the empty env)');
      assert.strictEqual(r.source, 'mindrian-env-file', 'fell through to file chain');
      assert.strictEqual(r.key, 'fallback-token-014', 'resolved the file token, not an empty string');
    });
    pass(name);
  } catch (e) { failTest(name, e); } finally { rmTmp(home); rmTmp(cwd); }
})();

console.log('');
console.log('---');
console.log('Plan 123-07 resolve-brain-key tests: ' + passed + ' passed, ' + failed + ' failed.');
process.exit(failed === 0 ? 0 : 1);
