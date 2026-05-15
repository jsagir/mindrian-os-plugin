/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-04 Plan 04 Task 1 -- mva-vercel-deploy tests.
 *
 * Verifies the Vercel REST API direct-deploy path with fallback to local file.
 * Mocks global.fetch via monkey-patch; uses tmp HOME for fallback paths.
 *
 * Canon Part 8 invariants:
 *   - The deploy module only sees `html` (already sanitized) and `sha8` (a hash).
 *   - It NEVER receives or transmits the raw sentence.
 *   - The request body is base64-encoded HTML; no raw user content in URLs.
 *
 * Locked Decision 2 (LD2):
 *   - Direct REST API to https://api.vercel.com/v13/deployments.
 *   - 5-second AbortController timeout.
 *   - Subdomain shape: mos-brief-<sha8>.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function _mkTmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mva-vercel-deploy-test-'));
}

function _cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
}

function _freshRequire() {
  const p = require.resolve('./mva-vercel-deploy.cjs');
  delete require.cache[p];
  // Also bust resolve-vercel-key in case the test mutates env
  const rp = require.resolve('./resolve-vercel-key.cjs');
  delete require.cache[rp];
  return require('./mva-vercel-deploy.cjs');
}

test('Test 6: no VERCEL_TOKEN -> writes fallback file + returns error envelope', async () => {
  const home = _mkTmpHome();
  const prev = process.env.VERCEL_TOKEN;
  const prevHome = process.env.HOME;
  delete process.env.VERCEL_TOKEN;
  process.env.HOME = home;
  try {
    const { deployDeck } = _freshRequire();
    const result = await deployDeck('<!DOCTYPE html><html><body>test</body></html>', 'abcd1234');
    assert.equal(result.error, 'vercel_unavailable');
    assert.equal(typeof result.fallback_path, 'string');
    assert.ok(result.fallback_path.endsWith(path.join('.mindrian', 'mva', 'briefs', 'abcd1234.html')));
    assert.equal(typeof result.deploy_duration_ms, 'number');
    assert.ok(result.deploy_duration_ms >= 0);
    // Fallback HTML written to disk
    const written = fs.readFileSync(result.fallback_path, 'utf8');
    assert.ok(written.includes('<body>test</body>'));
  } finally {
    if (prev === undefined) { delete process.env.VERCEL_TOKEN; } else { process.env.VERCEL_TOKEN = prev; }
    if (prevHome === undefined) { delete process.env.HOME; } else { process.env.HOME = prevHome; }
    _cleanup(home);
  }
});

test('Test 7: mocked Vercel API returns 200 -> deployDeck returns https URL', async () => {
  const home = _mkTmpHome();
  const prev = process.env.VERCEL_TOKEN;
  const prevHome = process.env.HOME;
  const prevFetch = global.fetch;
  process.env.VERCEL_TOKEN = 'test-token';
  process.env.HOME = home;
  global.fetch = async (_url, _opts) => ({
    ok: true,
    status: 200,
    json: async () => ({ url: 'mos-brief-abcd-xyz.vercel.app', readyState: 'READY' })
  });
  try {
    const { deployDeck } = _freshRequire();
    const result = await deployDeck('<!DOCTYPE html><html></html>', 'abcd1234');
    assert.equal(result.url, 'https://mos-brief-abcd-xyz.vercel.app');
    assert.equal(typeof result.deploy_duration_ms, 'number');
    assert.ok(result.deploy_duration_ms >= 0);
    assert.equal(result.error, undefined);
    assert.equal(result.fallback_path, undefined);
  } finally {
    if (prev === undefined) { delete process.env.VERCEL_TOKEN; } else { process.env.VERCEL_TOKEN = prev; }
    if (prevHome === undefined) { delete process.env.HOME; } else { process.env.HOME = prevHome; }
    if (prevFetch === undefined) { delete global.fetch; } else { global.fetch = prevFetch; }
    _cleanup(home);
  }
});

test('Test 8: Vercel API 5xx -> falls back to local file with vercel_api_error', async () => {
  const home = _mkTmpHome();
  const prev = process.env.VERCEL_TOKEN;
  const prevHome = process.env.HOME;
  const prevFetch = global.fetch;
  process.env.VERCEL_TOKEN = 'test-token';
  process.env.HOME = home;
  global.fetch = async () => ({
    ok: false,
    status: 503,
    json: async () => ({ error: { message: 'server unavailable' } })
  });
  try {
    const { deployDeck } = _freshRequire();
    const result = await deployDeck('<html></html>', 'beef5678');
    assert.equal(result.error, 'vercel_api_error');
    assert.equal(result.status, 503);
    assert.ok(result.fallback_path.endsWith(path.join('.mindrian', 'mva', 'briefs', 'beef5678.html')));
    assert.equal(typeof result.deploy_duration_ms, 'number');
    assert.ok(fs.existsSync(result.fallback_path));
  } finally {
    if (prev === undefined) { delete process.env.VERCEL_TOKEN; } else { process.env.VERCEL_TOKEN = prev; }
    if (prevHome === undefined) { delete process.env.HOME; } else { process.env.HOME = prevHome; }
    if (prevFetch === undefined) { delete global.fetch; } else { global.fetch = prevFetch; }
    _cleanup(home);
  }
});

test('Test 9: AbortController times out after 5s on hang -> fallback under 5500ms', async () => {
  const home = _mkTmpHome();
  const prev = process.env.VERCEL_TOKEN;
  const prevHome = process.env.HOME;
  const prevFetch = global.fetch;
  process.env.VERCEL_TOKEN = 'test-token';
  process.env.HOME = home;
  // Hanging fetch: never resolves, but respects AbortSignal
  global.fetch = (_url, opts) => new Promise((_resolve, reject) => {
    if (opts && opts.signal) {
      opts.signal.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    }
  });
  try {
    const { deployDeck } = _freshRequire();
    const t0 = Date.now();
    const result = await deployDeck('<html></html>', 'cafe9012');
    const wall = Date.now() - t0;
    // Should fall back (any error envelope, fallback_path populated)
    assert.ok(result.fallback_path);
    assert.ok(['vercel_exception', 'vercel_api_error', 'vercel_unavailable'].includes(result.error));
    assert.ok(wall < 5500, 'wall-clock should be under 5.5s; got ' + wall);
  } finally {
    if (prev === undefined) { delete process.env.VERCEL_TOKEN; } else { process.env.VERCEL_TOKEN = prev; }
    if (prevHome === undefined) { delete process.env.HOME; } else { process.env.HOME = prevHome; }
    if (prevFetch === undefined) { delete global.fetch; } else { global.fetch = prevFetch; }
    _cleanup(home);
  }
});

test('Test 10: deploy request body.name === mos-brief-<sha8>', async () => {
  const home = _mkTmpHome();
  const prev = process.env.VERCEL_TOKEN;
  const prevHome = process.env.HOME;
  const prevFetch = global.fetch;
  process.env.VERCEL_TOKEN = 'test-token';
  process.env.HOME = home;
  let capturedBody = null;
  global.fetch = async (_url, opts) => {
    capturedBody = JSON.parse(opts.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ url: 'mos-brief-deadbeef-1.vercel.app', readyState: 'READY' })
    };
  };
  try {
    const { deployDeck } = _freshRequire();
    await deployDeck('<html></html>', 'deadbeef');
    assert.ok(capturedBody);
    assert.equal(capturedBody.name, 'mos-brief-deadbeef');
    assert.ok(Array.isArray(capturedBody.files));
    assert.equal(capturedBody.files.length, 1);
    assert.equal(capturedBody.files[0].file, 'index.html');
    assert.equal(capturedBody.files[0].encoding, 'base64');
  } finally {
    if (prev === undefined) { delete process.env.VERCEL_TOKEN; } else { process.env.VERCEL_TOKEN = prev; }
    if (prevHome === undefined) { delete process.env.HOME; } else { process.env.HOME = prevHome; }
    if (prevFetch === undefined) { delete global.fetch; } else { global.fetch = prevFetch; }
    _cleanup(home);
  }
});

test('Test 11: HTML body is base64-encoded in request body, NOT in URL', async () => {
  const home = _mkTmpHome();
  const prev = process.env.VERCEL_TOKEN;
  const prevHome = process.env.HOME;
  const prevFetch = global.fetch;
  process.env.VERCEL_TOKEN = 'test-token';
  process.env.HOME = home;
  let capturedUrl = null;
  let capturedBody = null;
  global.fetch = async (url, opts) => {
    capturedUrl = url;
    capturedBody = JSON.parse(opts.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ url: 'mos-brief-aaaa1111-1.vercel.app', readyState: 'READY' })
    };
  };
  try {
    const { deployDeck } = _freshRequire();
    const html = '<!DOCTYPE html><html><body>HELLO</body></html>';
    await deployDeck(html, 'aaaa1111');
    // URL is the bare endpoint, no encoded HTML in it
    assert.equal(capturedUrl, 'https://api.vercel.com/v13/deployments');
    // Body file content is base64 of the HTML
    const expectedBase64 = Buffer.from(html, 'utf8').toString('base64');
    assert.equal(capturedBody.files[0].data, expectedBase64);
    // And: the URL does NOT contain "HELLO" or any HTML literal
    assert.ok(!String(capturedUrl).includes('HELLO'));
    assert.ok(!String(capturedUrl).includes('<body>'));
  } finally {
    if (prev === undefined) { delete process.env.VERCEL_TOKEN; } else { process.env.VERCEL_TOKEN = prev; }
    if (prevHome === undefined) { delete process.env.HOME; } else { process.env.HOME = prevHome; }
    if (prevFetch === undefined) { delete global.fetch; } else { global.fetch = prevFetch; }
    _cleanup(home);
  }
});

test('Bonus: Canon Part 8 source grep -- no raw-sentence references in deploy module', () => {
  const code = fs.readFileSync(path.join(__dirname, 'mva-vercel-deploy.cjs'), 'utf8');
  // Strip comments before grepping (mirrors Plan 118-03 source-purity pattern)
  const stripped = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.equal(stripped.match(/MVA_SENTENCE/), null,
    'mva-vercel-deploy.cjs must not reference MVA_SENTENCE');
  assert.equal(stripped.match(/\.sentence\b/), null,
    'mva-vercel-deploy.cjs must not read .sentence');
  assert.equal(stripped.match(/raw_sentence/), null,
    'mva-vercel-deploy.cjs must not reference raw_sentence');
});
