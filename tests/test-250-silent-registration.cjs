#!/usr/bin/env node
'use strict';

/**
 * Phase 250-04 Task 2 (HONEST-03, SEED-011 Option A) -- plugin-side silent
 * registration, born RED before the fourth ladder leg (resolve-brain-key.cjs)
 * and the brain-client.cjs mint mechanism exist.
 * ==========================================================================
 *
 *   1. Ladder precedence FROZEN: env / ~/.mindrian.env / CWD .env all win
 *      over a cached install token. Existing keyed users are untouched.
 *   2. Mint + cache: the first consult mints a UUID, POSTs it to the mock
 *      /register, caches the token at mode 0600, and the resolver then
 *      returns it (source 'install-token'). Subsequent consults make ZERO
 *      further POSTs (the mock's request counter proves it).
 *   3. Failure edge: a 500 from /register -> available:false, an honest
 *      reason naming registration/offline, the reframed no_key copy renders
 *      the failure-edge framing (not the old "no key is set" ceremony
 *      framing), the attempt is capped once per process, and it never
 *      throws or blocks.
 *   4. Opt-out: MINDRIAN_DISABLE_AUTO_REGISTER suppresses the leg entirely
 *      -- zero POSTs, keyless resolves exactly as before this phase.
 *   5. Identity hygiene (Part 8): the registration POST body carries
 *      install_id ONLY -- never a room path, user prose, or env contents.
 *
 * Loopback mock-server pattern (node:http, no fetch mocking) mirrors
 * tests/test-247-brain-client-403.cjs and tests/test-249-capture-seam.cjs.
 * Fresh-require-per-test pattern (delete require.cache, re-require) resets
 * ALL module-level state (the once-per-process auto-register cap included)
 * -- test-247-brain-client-403.cjs's freshBrainClient precedent, extended.
 *
 * node --test, CJS, node:assert/strict + node:http + node:fs only. No new
 * deps. No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { test, before, after, beforeEach } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');
const BRAIN_CLIENT_PATH = path.join(REPO_ROOT, 'lib', 'core', 'brain-client.cjs');
const RESOLVER_PATH = path.join(REPO_ROOT, 'lib', 'core', 'resolve-brain-key.cjs');
const TIER0_PATH = path.join(REPO_ROOT, 'lib', 'core', 'tier0-messaging.cjs');

function makeTmpHome(suffix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'test-250-silent-reg-' + suffix + '-'));
}

function rmTmp(t) {
  try { fs.rmSync(t, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

// ---------------------------------------------------------------------------
// Mock /register loopback server. state.mode controls the response shape;
// state.requests records every request (path, method, parsed body) so tests
// can assert the exact POST count and payload contents.
// ---------------------------------------------------------------------------
const state = { mode: 'ok', requests: [] };

function startMockServer() {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      let parsed = null;
      try { parsed = JSON.parse(body || '{}'); } catch (_e) { parsed = null; }
      state.requests.push({ path: req.url, method: req.method, body: parsed });

      if (req.url !== '/register') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not_found' }));
        return;
      }
      if (state.mode === '500') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'internal' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ token: 'mbr_test_' + state.requests.length, tier: 'read' }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: 'http://127.0.0.1:' + port });
    });
  });
}

function freshBrainClient(url, home) {
  process.env.MINDRIAN_BRAIN_URL = url;
  delete process.env.MINDRIAN_BRAIN_KEY;
  if (home) process.env.HOME = home;
  delete require.cache[BRAIN_CLIENT_PATH];
  delete require.cache[RESOLVER_PATH];
  return require(BRAIN_CLIENT_PATH);
}

function freshResolver() {
  delete require.cache[RESOLVER_PATH];
  return require(RESOLVER_PATH);
}

function freshTier0() {
  delete require.cache[TIER0_PATH];
  return require(TIER0_PATH);
}

let mockServer;
let mockUrl;
let _origHome;
let _origBrainUrl;
let _origBrainKey;
let _origDisable;

before(async () => {
  const started = await startMockServer();
  mockServer = started.server;
  mockUrl = started.url;
});

after(async () => {
  await new Promise((resolve) => mockServer.close(resolve));
});

beforeEach(() => {
  state.mode = 'ok';
  state.requests = [];
  _origHome = process.env.HOME;
  _origBrainUrl = process.env.MINDRIAN_BRAIN_URL;
  _origBrainKey = process.env.MINDRIAN_BRAIN_KEY;
  _origDisable = process.env.MINDRIAN_DISABLE_AUTO_REGISTER;
});

function restoreEnv() {
  if (_origHome === undefined) delete process.env.HOME; else process.env.HOME = _origHome;
  if (_origBrainUrl === undefined) delete process.env.MINDRIAN_BRAIN_URL; else process.env.MINDRIAN_BRAIN_URL = _origBrainUrl;
  if (_origBrainKey === undefined) delete process.env.MINDRIAN_BRAIN_KEY; else process.env.MINDRIAN_BRAIN_KEY = _origBrainKey;
  if (_origDisable === undefined) delete process.env.MINDRIAN_DISABLE_AUTO_REGISTER; else process.env.MINDRIAN_DISABLE_AUTO_REGISTER = _origDisable;
}

// ---------------------------------------------------------------------------
// Test 1: ladder precedence FROZEN.
// ---------------------------------------------------------------------------
test('Test 1 (ladder precedence FROZEN): env / mindrian-env-file / cwd-env-file all win over a cached install token', async (t) => {
  const home = makeTmpHome('t1');
  t.after(() => { rmTmp(home); restoreEnv(); });

  // Seed a cached install token that WOULD resolve at leg 4 if reached.
  fs.writeFileSync(
    path.join(home, '.mindrian-install.json'),
    JSON.stringify({ install_id: 'x', token: 'cached-install-token', minted_at: new Date().toISOString() }) + '\n',
    { mode: 0o600 }
  );

  // Leg 1: MINDRIAN_BRAIN_KEY env wins.
  process.env.MINDRIAN_BRAIN_KEY = 'env-key';
  const r1 = freshResolver().resolveBrainKey({ home, cwd: home });
  assert.equal(r1.source, 'env');
  assert.equal(r1.key, 'env-key');
  delete process.env.MINDRIAN_BRAIN_KEY;

  // Leg 2: ~/.mindrian.env wins over the cache.
  fs.writeFileSync(path.join(home, '.mindrian.env'), 'MINDRIAN_BRAIN_KEY=mindrian-env-key\n', { mode: 0o600 });
  const r2 = freshResolver().resolveBrainKey({ home, cwd: home });
  assert.equal(r2.source, 'mindrian-env-file');
  assert.equal(r2.key, 'mindrian-env-key');
  fs.rmSync(path.join(home, '.mindrian.env'));

  // Leg 3: CWD .env wins over the cache.
  const cwdTmp = makeTmpHome('t1-cwd');
  try {
    fs.writeFileSync(path.join(cwdTmp, '.env'), 'MINDRIAN_BRAIN_KEY=cwd-env-key\n', { mode: 0o600 });
    const r3 = freshResolver().resolveBrainKey({ home, cwd: cwdTmp });
    assert.equal(r3.source, 'cwd-env-file');
    assert.equal(r3.key, 'cwd-env-key');
  } finally {
    rmTmp(cwdTmp);
  }

  // With nothing at legs 1-3, the cache resolves at leg 4.
  const r4 = freshResolver().resolveBrainKey({ home, cwd: home });
  assert.equal(r4.source, 'install-token');
  assert.equal(r4.key, 'cached-install-token');
  assert.equal(r4.available, true);
});

// ---------------------------------------------------------------------------
// Test 2: mint + cache, single POST, resolver picks it up.
// ---------------------------------------------------------------------------
test('Test 2 (mint + cache): no key, no cache -> first consult mints + caches; subsequent resolves make ZERO further POSTs', async (t) => {
  const home = makeTmpHome('t2');
  t.after(() => { rmTmp(home); restoreEnv(); });

  const brain = freshBrainClient(mockUrl, home);
  assert.equal(state.requests.length, 0);

  const avail1 = await brain.ensureAvailable();
  assert.equal(avail1, true, 'ensureAvailable() must mint and become true');
  assert.equal(state.requests.length, 1, 'exactly one /register POST');
  assert.equal(state.requests[0].path, '/register');
  assert.deepEqual(Object.keys(state.requests[0].body), ['install_id'], 'the mock received install_id ONLY');
  assert.match(state.requests[0].body.install_id, /^[0-9a-f-]{36}$/i, 'install_id must be a UUID string');

  const cachePath = path.join(home, '.mindrian-install.json');
  assert.ok(fs.existsSync(cachePath), 'cache file must be written');
  const stat = fs.statSync(cachePath);
  assert.equal(stat.mode & 0o777, 0o600, 'cache file must be mode 0600 (SEC-02 posture)');
  const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  assert.equal(typeof cached.token, 'string');
  assert.equal(typeof cached.install_id, 'string');
  assert.equal(typeof cached.minted_at, 'string');

  const resolved = freshResolver().resolveBrainKey({ home, cwd: home });
  assert.equal(resolved.source, 'install-token');
  assert.equal(resolved.available, true);
  assert.equal(resolved.key, cached.token);

  // Subsequent consults: zero further POSTs (once-per-process cap AND the
  // ladder already resolves, so ensureAvailable() short-circuits).
  const avail2 = await brain.ensureAvailable();
  assert.equal(avail2, true);
  assert.equal(state.requests.length, 1, 'a second ensureAvailable() call must not POST again');
});

// ---------------------------------------------------------------------------
// Test 3: the failure edge.
// ---------------------------------------------------------------------------
test('Test 3 (failure edge): a registration failure renders the reframed no_key copy, caps at once per process, never throws or blocks', async (t) => {
  const home = makeTmpHome('t3');
  t.after(() => { rmTmp(home); restoreEnv(); });

  state.mode = '500';
  const brain = freshBrainClient(mockUrl, home);

  const avail1 = await brain.ensureAvailable();
  assert.equal(avail1, false);
  assert.equal(state.requests.length, 1);

  const reason = brain.getAutoRegisterFailureReason();
  assert.equal(typeof reason, 'string');
  assert.match(reason, /registration|offline/i, 'the honest reason must name registration/offline');

  // Once-per-process cap: a second consult NEVER POSTs again.
  const avail2 = await brain.ensureAvailable();
  assert.equal(avail2, false);
  assert.equal(state.requests.length, 1, 'the attempt is capped at once per process');

  // No cache file on failure.
  assert.equal(fs.existsSync(path.join(home, '.mindrian-install.json')), false);

  // The reframed no_key refusal copy renders the FAILURE-EDGE framing.
  const tier0 = freshTier0();
  const rendered = tier0.renderRefusal('no_key', { tool: 'brain_ask', registration_reason: reason });
  assert.match(rendered, /registration|offline/i, 'no_key copy must render the failure-edge framing');
  assert.ok(
    !/no key is set/i.test(rendered),
    'must NOT lead with the old ceremony-first "no key is set" framing'
  );

  const line = tier0.larryRefusalLine('no_key');
  assert.match(line, /registration|offline/i, 'the one-liner must also render the failure-edge framing');

  // Never throws, never blocks -- a downstream consult still completes.
  await assert.doesNotReject(async () => {
    const r = await brain.callTool('brain_ask', { question: 'x' });
    assert.equal(r, null, 'still-unregistered callTool must return null cleanly, not throw');
  });
});

// ---------------------------------------------------------------------------
// Test 4: the opt-out var.
// ---------------------------------------------------------------------------
test('Test 4 (opt-out): MINDRIAN_DISABLE_AUTO_REGISTER suppresses the leg entirely -- deterministic for harnesses', async (t) => {
  const home = makeTmpHome('t4');
  t.after(() => { rmTmp(home); restoreEnv(); });

  process.env.MINDRIAN_DISABLE_AUTO_REGISTER = '1';
  const brain = freshBrainClient(mockUrl, home);

  const avail = await brain.ensureAvailable();
  assert.equal(avail, false);
  assert.equal(state.requests.length, 0, 'zero POSTs when opted out -- no UUID minted, no network call');
  assert.equal(fs.existsSync(path.join(home, '.mindrian-install.json')), false);

  const resolved = freshResolver().resolveBrainKey({ home, cwd: home });
  assert.equal(resolved.source, 'not-found', 'keyless resolves exactly as before this phase when opted out');
});

// ---------------------------------------------------------------------------
// Test 5: identity hygiene (Part 8) -- install_id ONLY ever crosses the wire.
// ---------------------------------------------------------------------------
test('Test 5 (identity hygiene, Part 8): the registration POST body carries install_id ONLY', async (t) => {
  const home = makeTmpHome('t5');
  t.after(() => { rmTmp(home); restoreEnv(); });

  const brain = freshBrainClient(mockUrl, home);
  await brain.ensureAvailable();

  assert.equal(state.requests.length, 1);
  const body = state.requests[0].body;
  assert.deepEqual(Object.keys(body), ['install_id'], 'closed schema: install_id ONLY');
  assert.equal(typeof body.install_id, 'string');

  const serialized = JSON.stringify(body);
  assert.ok(!/\/home\//.test(serialized), 'must never carry a filesystem/room path');
  assert.ok(!/mindrianrooms/i.test(serialized), 'must never carry a room name');
  assert.ok(!/HOME=|MINDRIAN_BRAIN/i.test(serialized), 'must never carry env contents');
});
