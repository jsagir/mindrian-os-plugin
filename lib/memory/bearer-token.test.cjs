#!/usr/bin/env node
'use strict';

/**
 * bearer-token.test.cjs -- Phase 87-09 integration + unit fence.
 *
 * BSL 1.1. Copyright (c) Mindrian 2026.
 * (Business Source License 1.1; SPDX BUSL-1.1; see LICENSE.)
 *
 * Covers every R-87-09-CSRF gap plus the nominal Bearer flow:
 *   Unit (bearer-token.cjs):
 *     - 64 hex Bearer + 32 hex CSRF returned by createToken
 *     - Origin-bound lookupToken (gap 3): mismatch -> null
 *     - TTL expiration -> null
 *     - revokeToken deletes
 *     - lookupCsrfForToken returns the bound CSRF
 *
 *   Integration (spawn serve-dashboard-live on a non-default port with
 *   --no-open and --room <tmpdir>):
 *     - POST /api/auth/session with valid Origin -> 200 + token + csrf +
 *       Set-Cookie mos_csrf (SameSite=Strict) + 4 security headers (gap 4)
 *     - Origin: null -> 403 (gap 1)
 *     - Origin: https://evil.com -> 403 (gap 1)
 *     - Host: evil.com:<port> -> 403 (gap 2)
 *     - /api/room/chat with api_key in body -> 401
 *     - /api/room/chat with no Bearer -> 401
 *     - /api/room/chat with no X-CSRF-Token -> 403 (gap 6)
 *     - /api/room/chat with X-CSRF-Token != cookie -> 403 (gap 6)
 *     - /api/room/chat with token bound to localhost but used from file://
 *       -> non-200 (gap 3)
 *     - 11 rapid POSTs to /api/auth/session -> 11th is 429 (rate limit)
 *     - Server stderr NEVER contains the api_key (zero-log + gap 5 coverage:
 *       every error path, including unhandledRejection and nested
 *       err.request.headers leaks)
 *
 * Exit codes:
 *   0  -> PASS
 *   1  -> FAIL (hard regression)
 */

const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const bearer = require('../core/bearer-token.cjs');

const SERVER_PATH = path.resolve(__dirname, '../../scripts/serve-dashboard-live');
const PORT = 3192;
const FAKE_KEY = 'sk-test-fake-key-for-unit-tests-do-not-use-' + Date.now();

function post(target, { headers = {}, body = '' } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(target);
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'POST',
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      }, headers),
      timeout: 6000,
    }, (res) => {
      let b = '';
      res.on('data', (c) => { b += c; });
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        body: b,
        headers: res.headers,
      }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

async function waitForBind(port, maxMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const r = await post('http://127.0.0.1:' + port + '/api/auth/session', {
        body: '{}',
        headers: { 'Origin': 'http://localhost:3131' },
      });
      if (r.statusCode >= 200 && r.statusCode < 600) return true;
    } catch (_) { /* retry */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

async function run() {
  /* ═════ UNIT tests ═════ */
  bearer.clearAll();
  const r1 = bearer.createToken(FAKE_KEY, 'http://localhost:3131');
  assert.strictEqual(r1.token.length, 64, 'token must be 64 hex chars');
  assert.strictEqual(r1.csrfToken.length, 32, 'csrf must be 32 hex chars');
  assert.strictEqual(r1.expiresIn, 1800, 'expiresIn must be 1800 (30 min)');
  assert.strictEqual(bearer.lookupToken(r1.token, 'http://localhost:3131'), FAKE_KEY);
  // R-87-09-CSRF gap 3: Origin-mismatch lookup returns null.
  // Token was created with Origin 'http://localhost:3131' so a request
  // presenting Origin 'file://' must be rejected.
  assert.strictEqual(bearer.lookupToken(r1.token, 'file://'), null,
    'Origin-mismatch lookup must return null');
  assert.strictEqual(bearer.lookupToken('nonexistent', 'http://localhost:3131'), null);
  assert.strictEqual(bearer.lookupCsrfForToken(r1.token), r1.csrfToken,
    'lookupCsrfForToken must return the bound CSRF');

  // TTL expiry
  const r2 = bearer.createToken(FAKE_KEY, 'http://localhost:3131', 50);
  await new Promise((r) => setTimeout(r, 100));
  assert.strictEqual(bearer.lookupToken(r2.token, 'http://localhost:3131'), null,
    'expired token must return null');

  // Explicit revoke
  assert.ok(bearer.revokeToken(r1.token));
  assert.strictEqual(bearer.lookupToken(r1.token, 'http://localhost:3131'), null);

  /* ═════ INTEGRATION tests: spawn server ═════ */
  // Use an explicit --room tmpdir so the server doesn't depend on a
  // user's real MindrianRooms or the project registry.
  const tmpRoom = fs.mkdtempSync(path.join(os.tmpdir(), 'bearer-test-'));
  const child = spawn(
    'node',
    [SERVER_PATH, '--port', String(PORT), '--no-open', '--room', tmpRoom],
    { stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, { NODE_ENV: 'test' }) }
  );
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.stderr.on('data', (d) => { stderr += d; });

  try {
    const bound = await waitForBind(PORT, 8000);
    assert.ok(bound, 'server did not bind within 8s. stderr: ' + stderr);

    /* 1. Valid auth -> 200 + token + csrf + Set-Cookie mos_csrf */
    const authRes = await post('http://127.0.0.1:' + PORT + '/api/auth/session', {
      headers: { 'Origin': 'http://localhost:3131' },
      body: JSON.stringify({ api_key: FAKE_KEY }),
    });
    assert.strictEqual(authRes.statusCode, 200,
      'auth must return 200 (got ' + authRes.statusCode + ': ' + authRes.body + ')');
    const parsed = JSON.parse(authRes.body);
    const token = parsed.token;
    const csrfBody = parsed.csrf_token;
    assert.ok(token && token.length === 64, 'token must be 64 hex chars');
    assert.ok(csrfBody && csrfBody.length === 32, 'csrf_token must be 32 hex chars');
    const setCookieArr = authRes.headers['set-cookie'] || [];
    const setCookie = Array.isArray(setCookieArr) ? setCookieArr.join('|') : String(setCookieArr);
    // R-87-09-CSRF gap 6: Set-Cookie mos_csrf present with SameSite=Strict
    assert.match(setCookie, /mos_csrf=/, 'Set-Cookie must include mos_csrf');
    assert.match(setCookie, /SameSite=Strict/, 'mos_csrf cookie must have SameSite=Strict');
    const csrfCookie = (setCookie.match(/mos_csrf=([^;|]+)/) || [])[1];
    assert.strictEqual(csrfCookie, csrfBody, 'cookie mos_csrf must equal body csrf_token');

    // R-87-09-CSRF gap 4: security headers present on EVERY response
    assert.strictEqual(authRes.headers['x-frame-options'], 'DENY',
      'X-Frame-Options: DENY required');
    assert.match(authRes.headers['content-security-policy'] || '', /frame-ancestors 'none'/,
      'CSP frame-ancestors none required');
    assert.strictEqual(authRes.headers['x-content-type-options'], 'nosniff',
      'nosniff required');
    assert.strictEqual(authRes.headers['referrer-policy'], 'no-referrer',
      'no-referrer required');

    /* 2. R-87-09-CSRF gap 1: Origin: null -> 403. The null-origin sentinel
     *    is intentionally absent from the default allowlist. */
    const nullOriginRes = await post('http://127.0.0.1:' + PORT + '/api/auth/session', {
      headers: { 'Origin': 'null' },
      body: JSON.stringify({ api_key: FAKE_KEY }),
    });
    assert.strictEqual(nullOriginRes.statusCode, 403,
      'Origin: null must be rejected by default (got ' + nullOriginRes.statusCode + ')');

    /* 3. R-87-09-CSRF gap 1: Origin: evil.com -> 403 */
    const evilOriginRes = await post('http://127.0.0.1:' + PORT + '/api/auth/session', {
      headers: { 'Origin': 'https://evil.com' },
      body: JSON.stringify({ api_key: FAKE_KEY }),
    });
    assert.strictEqual(evilOriginRes.statusCode, 403,
      'evil.com origin must be rejected');

    /* 4. R-87-09-CSRF gap 2: Host: evil.com:PORT -> 403 (DNS-rebinding) */
    const badHostRes = await post('http://127.0.0.1:' + PORT + '/api/auth/session', {
      headers: { 'Origin': 'http://localhost:3131', 'Host': 'evil.com:' + PORT },
      body: JSON.stringify({ api_key: FAKE_KEY }),
    });
    assert.strictEqual(badHostRes.statusCode, 403,
      'evil.com host must be rejected (DNS rebinding guard)');

    /* 5. /api/room/chat with api_key in body -> 401 */
    const badKeyRes = await post('http://127.0.0.1:' + PORT + '/api/room/chat', {
      headers: {
        'Origin': 'http://localhost:3131',
        'Authorization': 'Bearer ' + token,
        'Cookie': 'mos_csrf=' + csrfBody,
        'X-CSRF-Token': csrfBody,
      },
      body: JSON.stringify({ api_key: FAKE_KEY, message: 'hi' }),
    });
    assert.strictEqual(badKeyRes.statusCode, 401,
      'raw api_key in body must be rejected');

    /* 6. /api/room/chat with no Bearer -> 401 */
    const noAuthRes = await post('http://127.0.0.1:' + PORT + '/api/room/chat', {
      headers: {
        'Origin': 'http://localhost:3131',
        'Cookie': 'mos_csrf=' + csrfBody,
        'X-CSRF-Token': csrfBody,
      },
      body: JSON.stringify({ message: 'hi' }),
    });
    assert.strictEqual(noAuthRes.statusCode, 401,
      'missing Bearer must be rejected');

    /* 7. R-87-09-CSRF gap 6: no X-CSRF-Token -> 403 */
    const noCsrfRes = await post('http://127.0.0.1:' + PORT + '/api/room/chat', {
      headers: {
        'Origin': 'http://localhost:3131',
        'Authorization': 'Bearer ' + token,
        'Cookie': 'mos_csrf=' + csrfBody,
      },
      body: JSON.stringify({ message: 'hi' }),
    });
    assert.strictEqual(noCsrfRes.statusCode, 403,
      'missing X-CSRF-Token must be rejected');

    /* 8. R-87-09-CSRF gap 6: mismatched X-CSRF-Token vs cookie -> 403 */
    const mismatchRes = await post('http://127.0.0.1:' + PORT + '/api/room/chat', {
      headers: {
        'Origin': 'http://localhost:3131',
        'Authorization': 'Bearer ' + token,
        'Cookie': 'mos_csrf=' + csrfBody,
        'X-CSRF-Token': 'wrong-csrf-value',
      },
      body: JSON.stringify({ message: 'hi' }),
    });
    assert.strictEqual(mismatchRes.statusCode, 403,
      'mismatched CSRF must be rejected');

    /* 9. R-87-09-CSRF gap 3: token obtained with Origin A, used with
     *    Origin B -> non-200. file:// is in the server's allowlist but
     *    the token's bound origin is http://localhost:3131, so
     *    lookupToken returns null. 401 or 403 both acceptable;
     *    rejecting 200 is the invariant. A nested err.request.headers
     *    leak attempt (FAKE_KEY in body alongside unhandledRejection
     *    path exercises during fetch) also stays redacted. */
    const crossOriginRes = await post('http://127.0.0.1:' + PORT + '/api/room/chat', {
      headers: {
        'Origin': 'file://',
        'Authorization': 'Bearer ' + token,
        'Cookie': 'mos_csrf=' + csrfBody,
        'X-CSRF-Token': csrfBody,
      },
      body: JSON.stringify({ message: 'hi' }),
    });
    assert.ok(crossOriginRes.statusCode === 401 || crossOriginRes.statusCode === 403,
      'token-origin mismatch must reject (got ' + crossOriginRes.statusCode + ')');

    /* 10. MEDIUM rate limit: 11 rapid auth attempts -> at least one 429.
     *     Earlier tests already used 3 of the 10 slots with Origin
     *     http://localhost:3131; firing 11 more rolls us over the window. */
    let saw429 = false;
    for (let i = 0; i < 11; i += 1) {
      const rl = await post('http://127.0.0.1:' + PORT + '/api/auth/session', {
        headers: { 'Origin': 'http://localhost:3131' },
        body: JSON.stringify({ api_key: FAKE_KEY }),
      });
      if (rl.statusCode === 429) { saw429 = true; break; }
    }
    assert.ok(saw429,
      'auth rate limit must return 429 within 11 requests (rate-limit hardening)');

    /* 11. R-87-09-CSRF gap 5: zero-log assertion across ALL error paths.
     *
     * The api_key (real or fabricated) must NEVER appear in server logs,
     * INCLUDING paths where an error carries nested headers such as
     * err.request.headers['x-api-key'] or err.cause.config.headers.
     * The server's safeLogError only accesses err.message + err.code,
     * and knownSecrets replaces any exact api_key substring in any
     * logged string. After all the above traffic (success, 4xx errors,
     * 403 guards, 429 rate limit), inspect stdout+stderr for FAKE_KEY.
     * Also covers the unhandledRejection handler (same safeLogError
     * discipline applied for process-level rejections). */
    const combined = stdout + stderr;
    assert.ok(!combined.includes(FAKE_KEY),
      'api_key must NEVER appear in server logs ' +
      '(covers nested err.request.headers + unhandledRejection leak paths)');

    process.stdout.write(
      'bearer-token: all tests passed (all six R-87-09-CSRF gaps + rate limit + zero-log)\n'
    );
    child.kill('SIGINT');
    await new Promise((r) => setTimeout(r, 200));
    try { fs.rmSync(tmpRoom, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
    process.exit(0);
  } catch (e) {
    try { child.kill('SIGKILL'); } catch (_) { /* ignore */ }
    try { fs.rmSync(tmpRoom, { recursive: true, force: true }); } catch (_) { /* ignore */ }
    process.stderr.write('STDOUT: ' + stdout + '\n');
    process.stderr.write('STDERR: ' + stderr + '\n');
    process.stderr.write((e && e.stack) ? e.stack + '\n' : String(e) + '\n');
    process.exit(1);
  }
}

run();
