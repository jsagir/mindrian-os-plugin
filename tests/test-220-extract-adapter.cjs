/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 220 Plan 01 Task 1 -- Tavily Extract adapter contract test.
 *
 * Pins the ONE net-new adapter of Phase 220: adapterTavilyExtract behind the
 * fetchCorpus -> auditQueryString Part 8 chokepoint, source id 'tavily-extract'.
 *
 * Contract under test (220-01-PLAN interfaces section):
 *   { ok, provider: { id, status, reason, counts: { urls_requested, urls_succeeded } },
 *     results: [ { url, markdown, title } ] }
 *   provider.status enum: ok | provider_unavailable | rate_limited | timeout |
 *   size_exceeded | error. ok:false NEVER throws for key/network/HTTP conditions
 *   (D-01/D-19: typed envelope, never a crash, never a silent bare empty).
 *
 * Five behavior groups:
 *   1. typed degrade      missing TAVILY_API_KEY -> provider_unavailable/missing_key
 *   2. markdown pass-through  full-page markdown, never a snippet (Pitfall 1)
 *   3. HTTP degrade       429 -> rate_limited; 500 -> error/http_500; hang -> timeout
 *   4. size bound         body above MAX_EXTRACT_BYTES -> size_exceeded (D-02)
 *   5. scheme fence       file:// and ftp:// -> TypeError BEFORE any fetch (D-02)
 *
 * Standalone node script, exit 0/1, no framework (the test-218-* idiom).
 * globalThis.fetch is stubbed per leg (save/restore); TAVILY_API_KEY is managed
 * per leg (save/restore). Zero network ever.
 */
'use strict';

const assert = require('node:assert');
const path = require('node:path');

const corpus = require(path.join(__dirname, '..', 'lib', 'core', 'research-corpus.cjs'));
const { fetchCorpus } = corpus;

// ---------- tiny harness ----------

let PASS = 0;
let FAIL = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    PASS += 1;
    console.log('  PASS: ' + name);
  } catch (err) {
    FAIL += 1;
    failures.push({ name: name, err: err });
    console.log('  FAIL: ' + name + ' -- ' + (err && err.message ? err.message : String(err)));
  }
}

// ---------- fetch stub helpers (save/restore per leg) ----------

const REAL_FETCH = globalThis.fetch;
const REAL_KEY = process.env.TAVILY_API_KEY;

function restore() {
  globalThis.fetch = REAL_FETCH;
  if (REAL_KEY === undefined) {
    delete process.env.TAVILY_API_KEY;
  } else {
    process.env.TAVILY_API_KEY = REAL_KEY;
  }
}

function makeRes(status, body, headers) {
  const h = {};
  const src = headers || {};
  for (const k of Object.keys(src)) h[k.toLowerCase()] = String(src[k]);
  const text = (typeof body === 'string') ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status: status,
    headers: {
      get: function (name) {
        const key = String(name).toLowerCase();
        return Object.prototype.hasOwnProperty.call(h, key) ? h[key] : null;
      },
    },
    text: async function () { return text; },
    json: async function () { return JSON.parse(text); },
    arrayBuffer: async function () { return new ArrayBuffer(0); },
  };
}

function stubFetch(handler) {
  const state = { calls: 0, captured: [] };
  globalThis.fetch = async function (url, init) {
    state.calls += 1;
    state.captured.push({ url: url, init: init });
    return handler(url, init);
  };
  return state;
}

function abortError() {
  const e = new Error('This operation was aborted');
  e.name = 'AbortError';
  return e;
}

// ---------- the tests ----------

async function main() {
  console.log('test-220-extract-adapter: adapterTavilyExtract behind fetchCorpus');

  // --- Group 1: typed degrade on missing key ---
  await test('Test 1: missing TAVILY_API_KEY -> provider_unavailable/missing_key, no throw, zero fetch', async function () {
    delete process.env.TAVILY_API_KEY;
    const state = stubFetch(function () { return makeRes(200, { results: [] }); });
    try {
      const env = await fetchCorpus({ source: 'tavily-extract', query: 'https://example.com/a' });
      assert.strictEqual(env.ok, false, 'ok:false on missing key');
      assert.strictEqual(env.provider.id, 'tavily-extract', 'provider id');
      assert.strictEqual(env.provider.status, 'provider_unavailable', 'status provider_unavailable');
      assert.strictEqual(env.provider.reason, 'missing_key', 'reason missing_key');
      assert.ok(Array.isArray(env.results) && env.results.length === 0, 'results empty array');
      assert.strictEqual(state.calls, 0, 'zero fetch attempted');
    } finally { restore(); }
  });

  // --- Group 2: markdown pass-through (full page, never a snippet) ---
  const FULL_MD = '# Example Page\n\n' + 'A long full-page markdown body. '.repeat(200)
    + '\n\n## Section Two\n\nMore prose that a snippet API would truncate.';
  await test('Test 2: stubbed extract payload -> ok:true, FULL markdown echoed, urls_succeeded 1', async function () {
    process.env.TAVILY_API_KEY = 'test-key-not-real';
    const state = stubFetch(function () {
      return makeRes(200, {
        results: [{ url: 'https://example.com/a', raw_content: FULL_MD, title: 'Example' }],
        failed_results: [],
      });
    });
    try {
      const env = await fetchCorpus({ source: 'tavily-extract', query: 'https://example.com/a' });
      assert.strictEqual(env.ok, true, 'ok:true on success');
      assert.strictEqual(env.provider.status, 'ok', 'status ok');
      assert.strictEqual(env.results.length, 1, 'one result');
      assert.strictEqual(env.results[0].url, 'https://example.com/a', 'url echoed');
      assert.strictEqual(env.results[0].markdown, FULL_MD, 'markdown is the FULL stub body, byte-equal');
      assert.strictEqual(env.results[0].markdown.length, FULL_MD.length, 'not truncated to a snippet');
      assert.strictEqual(env.results[0].title, 'Example', 'title surfaced');
      assert.strictEqual(env.provider.counts.urls_requested, 1, 'urls_requested 1');
      assert.strictEqual(env.provider.counts.urls_succeeded, 1, 'urls_succeeded 1');
      assert.strictEqual(state.calls, 1, 'exactly one fetch');
    } finally { restore(); }
  });

  // --- Group 3: HTTP degrade rungs, all typed, none throw ---
  await test('Test 3a: HTTP 429 -> rate_limited/http_429, ok:false, no throw', async function () {
    process.env.TAVILY_API_KEY = 'test-key-not-real';
    stubFetch(function () { return makeRes(429, { detail: 'rate limit' }); });
    try {
      const env = await fetchCorpus({ source: 'tavily-extract', query: 'https://example.com/a' });
      assert.strictEqual(env.ok, false, 'ok:false');
      assert.strictEqual(env.provider.status, 'rate_limited', 'status rate_limited');
      assert.strictEqual(env.provider.reason, 'http_429', 'reason http_429');
      assert.strictEqual(env.results.length, 0, 'results empty');
    } finally { restore(); }
  });

  await test('Test 3b: HTTP 500 -> error/http_500, ok:false, no throw', async function () {
    process.env.TAVILY_API_KEY = 'test-key-not-real';
    stubFetch(function () { return makeRes(500, 'server error'); });
    try {
      const env = await fetchCorpus({ source: 'tavily-extract', query: 'https://example.com/a' });
      assert.strictEqual(env.ok, false, 'ok:false');
      assert.strictEqual(env.provider.status, 'error', 'status error');
      assert.strictEqual(env.provider.reason, 'http_500', 'reason http_500');
      assert.strictEqual(env.results.length, 0, 'results empty');
    } finally { restore(); }
  });

  await test('Test 3c: hang beyond the timeout -> timeout, ok:false, no throw', async function () {
    process.env.TAVILY_API_KEY = 'test-key-not-real';
    globalThis.fetch = function (url, init) {
      return new Promise(function (resolve, reject) {
        if (init && init.signal) {
          if (init.signal.aborted) return reject(abortError());
          init.signal.addEventListener('abort', function () { reject(abortError()); });
        }
        // never resolves otherwise -- simulated hang
      });
    };
    try {
      const env = await fetchCorpus({ source: 'tavily-extract', query: 'https://example.com/a', timeoutMs: 60 });
      assert.strictEqual(env.ok, false, 'ok:false');
      assert.strictEqual(env.provider.status, 'timeout', 'status timeout');
      assert.strictEqual(env.provider.reason, 'timeout', 'reason timeout');
      assert.strictEqual(env.results.length, 0, 'results empty');
    } finally { restore(); }
  });

  // --- Group 4: size bound (D-02) ---
  await test('Test 4: body above MAX_EXTRACT_BYTES -> size_exceeded/oversize, results empty', async function () {
    process.env.TAVILY_API_KEY = 'test-key-not-real';
    const MAX = corpus.__testables.MAX_EXTRACT_BYTES;
    assert.strictEqual(MAX, 5000000, 'MAX_EXTRACT_BYTES is the documented 5_000_000');
    const oversize = 'x'.repeat(MAX + 1);
    stubFetch(function () { return makeRes(200, oversize); });
    try {
      const env = await fetchCorpus({ source: 'tavily-extract', query: 'https://example.com/a' });
      assert.strictEqual(env.ok, false, 'ok:false');
      assert.strictEqual(env.provider.status, 'size_exceeded', 'status size_exceeded');
      assert.strictEqual(env.provider.reason, 'oversize', 'reason oversize');
      assert.strictEqual(env.results.length, 0, 'oversize content never materializes downstream');
    } finally { restore(); }
  });

  // --- Group 5: scheme fence (D-02: no local/off-scheme fetch ever) ---
  await test('Test 5a: file:///etc/passwd -> TypeError BEFORE any fetch', async function () {
    process.env.TAVILY_API_KEY = 'test-key-not-real';
    const state = stubFetch(function () { return makeRes(200, { results: [] }); });
    try {
      await assert.rejects(
        fetchCorpus({ source: 'tavily-extract', query: 'file:///etc/passwd' }),
        TypeError,
        'file: scheme rejected with TypeError'
      );
      assert.strictEqual(state.calls, 0, 'stub never called');
    } finally { restore(); }
  });

  await test('Test 5b: ftp://x -> TypeError BEFORE any fetch', async function () {
    process.env.TAVILY_API_KEY = 'test-key-not-real';
    const state = stubFetch(function () { return makeRes(200, { results: [] }); });
    try {
      await assert.rejects(
        fetchCorpus({ source: 'tavily-extract', query: 'ftp://x' }),
        TypeError,
        'ftp: scheme rejected with TypeError'
      );
      assert.strictEqual(state.calls, 0, 'stub never called');
    } finally { restore(); }
  });

  await test('Test 5c: __testables exposes adapterTavilyExtract beside adapterTavily', async function () {
    assert.ok(corpus.__testables, '__testables export present');
    assert.strictEqual(typeof corpus.__testables.adapterTavilyExtract, 'function', 'adapterTavilyExtract exported for tests');
  });

  console.log('');
  console.log('Extract adapter: PASS=' + PASS + ' FAIL=' + FAIL);
  for (const f of failures) {
    console.log('  - ' + f.name + ': ' + (f.err && f.err.stack ? f.err.stack.split('\n')[0] : String(f.err)));
  }
  process.exit(FAIL === 0 ? 0 : 1);
}

main().catch(function (err) {
  console.error('test-220-extract-adapter: fatal: ' + (err && err.stack ? err.stack : String(err)));
  restore();
  process.exit(1);
});
