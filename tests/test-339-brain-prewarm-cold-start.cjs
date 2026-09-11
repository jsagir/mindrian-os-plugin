#!/usr/bin/env node
'use strict';

/**
 * Quick 260911-ddd (DDD-03) -- RED-first coverage for lib/core/brain-
 * prewarm.cjs's marker shape, its non-blocking contract, and lib/mcp/brain-
 * route-bound.cjs's constant + env override. node:test + node built-ins
 * only, zero network, zero server spawn -- every arm drives the injectable
 * deps seam ({ probe, originHost, now, homeDir, timeoutMs }), never a real
 * Brain.
 *
 * Arms:
 *   1. Marker shape and Canon Part 8 body tripwire: a probe response
 *      carrying a canary, a build_stamp and a secret must never survive
 *      into the marker file text; the marker parses to exactly
 *      { at, ok, origin_host }.
 *   2. Failure and timeout: a rejecting probe, and a probe that never
 *      settles against a short timeoutMs, both write ok:false, both
 *      RESOLVE rather than throw, and both still write only three keys.
 *   3. Non-blocking contract: prove ordering, not wall clock. prewarm()
 *      must return control to the caller before an externally-released
 *      deferred probe settles.
 *   4. Bound constant and env override: resolveBrainRouteTimeoutMs()
 *      defaults to 6000; a valid override is honored; malformed values
 *      ('abc', '0', '-1', '') all fall back to 6000.
 *   5. Shim seam, source-shape scan only (no spawn): bin/mindrian-brain-
 *      mcp-client.cjs requires brain-prewarm.cjs and calls prewarm(), and
 *      that call is never preceded by `await` on the same line -- the gate
 *      that stops a future edit from making shim startup block on the
 *      probe.
 *
 * No em-dashes (hyphens only).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');
const { prewarm, markerPath } = require(path.join(REPO_ROOT, 'lib', 'core', 'brain-prewarm.cjs'));
const { resolveBrainRouteTimeoutMs } = require(path.join(REPO_ROOT, 'lib', 'mcp', 'brain-route-bound.cjs'));

/**
 * A fresh tmp homeDir per arm so no arm's marker write can bleed into
 * another's assertions.
 */
function freshHomeDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'brain-prewarm-test-'));
}

// codeOf: comment-stripping helper, the same idiom
// tests/test-254-composition-census.cjs reuses from
// tests/test-reader-r4-structural-184.cjs -- full-line-comment strip only,
// adequate here because Arm 5 looks for a full require( ... ) expression
// and a full `prewarm(` call token, never a mid-line pattern a partial
// strip could misfire on.
function codeOf(file) {
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); })
    .join('\n');
}

// ---------------------------------------------------------------------------
// Arm 1: marker shape and Canon Part 8 body tripwire
// ---------------------------------------------------------------------------
test('Arm 1: the marker holds exactly {at, ok, origin_host}; a probe body canary never survives to the marker file text', async () => {
  const homeDir = freshHomeDir();
  const CANARY = 'CANARY-260911-ddd-body-tripwire';
  const probe = async () => ({
    ok: true,
    mode: 'x',
    build_stamp: { sha: 'deadbeef' },
    secret: CANARY,
  });

  const result = await prewarm({
    probe,
    originHost: 'theo-mcp.onrender.com',
    now: () => new Date('2026-09-11T00:00:00.000Z'),
    homeDir,
  });

  assert.equal(typeof result, 'object');
  assert.equal(result.ok, true);

  const filePath = markerPath(homeDir);
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  assert.deepEqual(Object.keys(parsed).sort(), ['at', 'ok', 'origin_host']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.origin_host, 'theo-mcp.onrender.com');
  assert.equal(typeof parsed.at, 'string');

  // The Part 8 body tripwire: none of the probe's own fields, nor the
  // canary planted inside them, may reach the RAW FILE TEXT.
  assert.equal(raw.includes(CANARY), false, 'canary must not survive into the marker file text');
  assert.equal(raw.includes('build_stamp'), false, 'build_stamp must not survive into the marker file text');
  assert.equal(raw.includes('sha'), false, 'sha must not survive into the marker file text');
  assert.equal(raw.includes('secret'), false, 'secret key must not survive into the marker file text');
});

// ---------------------------------------------------------------------------
// Arm 2: failure and timeout both degrade to ok:false without throwing
// ---------------------------------------------------------------------------
test('Arm 2a: a rejecting probe writes ok:false, resolves rather than throws, still writes only three keys', async () => {
  const homeDir = freshHomeDir();
  await assert.doesNotReject(async () => {
    await prewarm({
      probe: async () => { throw new Error('simulated probe failure'); },
      originHost: 'theo-mcp.onrender.com',
      homeDir,
    });
  });
  const parsed = JSON.parse(fs.readFileSync(markerPath(homeDir), 'utf8'));
  assert.deepEqual(Object.keys(parsed).sort(), ['at', 'ok', 'origin_host']);
  assert.equal(parsed.ok, false);
});

test('Arm 2b: a probe that never settles writes ok:false once timeoutMs elapses, resolves rather than throws, still writes only three keys', async () => {
  const homeDir = freshHomeDir();
  await assert.doesNotReject(async () => {
    await prewarm({
      probe: () => new Promise(() => {}), // never settles
      timeoutMs: 20,
      originHost: 'theo-mcp.onrender.com',
      homeDir,
    });
  });
  const parsed = JSON.parse(fs.readFileSync(markerPath(homeDir), 'utf8'));
  assert.deepEqual(Object.keys(parsed).sort(), ['at', 'ok', 'origin_host']);
  assert.equal(parsed.ok, false);
});

// ---------------------------------------------------------------------------
// Arm 3: non-blocking contract -- ordering, not wall clock
// ---------------------------------------------------------------------------
test('Arm 3: prewarm() returns control to the caller before an externally-released deferred probe settles', async () => {
  const homeDir = freshHomeDir();
  const ordering = [];
  let releaseProbe;
  const deferred = new Promise((resolve) => { releaseProbe = resolve; });

  const pending = prewarm({
    probe: () => deferred.then(() => {
      ordering.push('probe');
      return { ok: true };
    }),
    originHost: 'theo-mcp.onrender.com',
    homeDir,
  });
  // This push happens IMMEDIATELY after the call returns, in the same
  // synchronous continuation -- prewarm() must not have blocked waiting
  // for the probe before yielding control back here.
  ordering.push('sentinel');

  releaseProbe();
  await pending;

  assert.deepEqual(ordering, ['sentinel', 'probe'], 'the sentinel must sit before the probe\'s own ordering push');
});

// ---------------------------------------------------------------------------
// Arm 4: bound constant and env override
// ---------------------------------------------------------------------------
test('Arm 4: resolveBrainRouteTimeoutMs defaults to 6000 and honors a valid override; malformed values fall back', () => {
  assert.equal(resolveBrainRouteTimeoutMs({}), 6000);
  assert.equal(resolveBrainRouteTimeoutMs({ MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS: '9000' }), 9000);
  assert.equal(resolveBrainRouteTimeoutMs({ MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS: 'abc' }), 6000);
  assert.equal(resolveBrainRouteTimeoutMs({ MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS: '0' }), 6000);
  assert.equal(resolveBrainRouteTimeoutMs({ MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS: '-1' }), 6000);
  assert.equal(resolveBrainRouteTimeoutMs({ MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS: '' }), 6000);
});

// ---------------------------------------------------------------------------
// Arm 5: shim seam, source-shape scan only (no spawn)
// ---------------------------------------------------------------------------
test('Arm 5: the shim requires brain-prewarm and calls prewarm() without an await on the same line', () => {
  const shimPath = path.join(REPO_ROOT, 'bin', 'mindrian-brain-mcp-client.cjs');
  const code = codeOf(shimPath);

  assert.ok(
    /require\(\s*['"][^'"]*brain-prewarm\.cjs['"]\s*\)/.test(code),
    'the shim must require lib/core/brain-prewarm.cjs'
  );

  const lines = code.split('\n');
  const prewarmCallLines = lines.filter((l) => /\bprewarm\(/.test(l));
  assert.ok(prewarmCallLines.length > 0, 'the shim must call prewarm(...)');
  for (const line of prewarmCallLines) {
    assert.equal(
      /\bawait\s+[\w.]*prewarm\(/.test(line),
      false,
      'prewarm() must never be preceded by await on the same line -- shim startup must never block on it: ' + line
    );
  }
});
