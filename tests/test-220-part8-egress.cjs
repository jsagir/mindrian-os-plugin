/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 220 Plan 01 Task 2 -- REQ-5 Part 8 egress fence for the NEW
 * 'tavily-extract' source (the constitutional heart of Plan 01).
 *
 * Three gates:
 *   1. FAIL-CLOSED: a room-content-bearing query string attempts ZERO fetch.
 *      The planted string is DERIVED at run time FROM FORBIDDEN_PATTERNS
 *      (rs-egress-prompts.cjs re-export) so this test never rots against the
 *      Canon-authoritative pattern list. fetchCorpus must reject with
 *      ExternalEgressViolation BEFORE the network stub is ever touched.
 *   2. OUTBOUND PAYLOAD AUDIT: the captured request body carries ONLY the
 *      allowlisted keys {api_key, urls, extract_depth, format} -- the URL plus
 *      generic extract config handles. A mechanical key walk fails on ANY
 *      unexpected key; a negative self-check proves the gate bites. No string
 *      field other than urls/api_key exceeds a short-handle length.
 *   3. CHOKEPOINT UNIQUENESS: comment-filtered grep gates prove the NEW egress
 *      surface has exactly ONE door -- 'api.tavily.com/extract' appears only in
 *      lib/core/research-corpus.cjs, and 'adapterTavilyExtract' is never
 *      referenced by lib/ or scripts/ code outside that file (nobody bypasses
 *      fetchCorpus). NOTE (deviation from the plan's literal grep): the bare
 *      'api.tavily.com' string has PRE-EXISTING legitimate /search callers
 *      (lib/core/rs-fetcher-industry.cjs, lib/agents/mva/tavily-funding-scan.cjs,
 *      legacy lib/core/rs_corpus.py) that predate Phase 220; the uniqueness
 *      gate is therefore pinned on the /extract endpoint this plan ADDS.
 *
 * Standalone node script, exit 0/1, per-assertion output. Zero network ever.
 */
'use strict';

const assert = require('node:assert');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const corpus = require(path.join(ROOT, 'lib', 'core', 'research-corpus.cjs'));
const { fetchCorpus } = corpus;
const { FORBIDDEN_PATTERNS } = require(path.join(ROOT, 'lib', 'core', 'rs-egress-prompts.cjs'));
const { ExternalEgressViolation } = require(path.join(ROOT, 'lib', 'core', 'rs-egress-violations.cjs'));

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

// ---------- fetch stub + env save/restore ----------

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

function stubFetch() {
  const state = { calls: 0, captured: [] };
  globalThis.fetch = async function (url, init) {
    state.calls += 1;
    state.captured.push({ url: url, init: init });
    return {
      ok: true,
      status: 200,
      headers: { get: function () { return null; } },
      text: async function () {
        return JSON.stringify({
          results: [{ url: 'https://example.com/clean', raw_content: '# ok\n\nbody', title: 't' }],
          failed_results: [],
        });
      },
      arrayBuffer: async function () { return new ArrayBuffer(0); },
    };
  };
  return state;
}

// ---------- gate 1: planted forbidden query -> zero fetch + throw ----------

// Candidate room-content markers, each targeting a distinct Canon pattern
// family. The planted string is whichever candidate ACTUALLY matches the live
// FORBIDDEN_PATTERNS at run time, so a Canon amendment cannot rot this test.
const CANDIDATE_MARKERS = [
  'contact jonathan@rooms-internal.example.com now',   // email pattern
  'Lawrence said the margin is fragile',               // quoted-person pattern
  'the raise totals $2.5M this round',                 // currency-magnitude pattern
  'churn hit 80 percent last quarter',                 // percent-metric pattern
];

function derivePlantedQuery() {
  for (const marker of CANDIDATE_MARKERS) {
    const url = 'https://example.com/page?note=' + marker;
    for (const re of FORBIDDEN_PATTERNS) {
      if (re.test(url)) return { url: url, pattern: re.source };
    }
  }
  return null;
}

// ---------- gate 2: outbound body key-allowlist walk ----------

const ALLOWED_BODY_KEYS = ['api_key', 'urls', 'extract_depth', 'format'];
const SHORT_HANDLE_MAX = 64;

// The mechanical five-tripwire outbound-shape discipline: walk EVERY key of the
// captured body and return violations for anything off the allowlist, plus any
// generic-config string field longer than a short handle.
function auditOutboundBody(body, expectedUrl) {
  const violations = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return ['body is not a plain object'];
  }
  for (const key of Object.keys(body)) {
    if (ALLOWED_BODY_KEYS.indexOf(key) === -1) {
      violations.push('unexpected outbound key: ' + key);
      continue;
    }
    const val = body[key];
    if (typeof val !== 'string') {
      violations.push('non-string outbound value for key: ' + key);
      continue;
    }
    if (key === 'urls') {
      if (val !== expectedUrl) violations.push('urls does not echo the input verbatim');
    } else if (key === 'api_key') {
      // auth credential, not room content; presence checked, content not judged
    } else if (val.length > SHORT_HANDLE_MAX) {
      violations.push('outbound field ' + key + ' exceeds short-handle length (' + val.length + ')');
    }
  }
  return violations;
}

// ---------- gate 3: comment-filtered grep helpers ----------

function grepHits(pattern, dirs) {
  let out = '';
  try {
    out = execSync('grep -rn ' + JSON.stringify(pattern) + ' ' + dirs.join(' '), {
      cwd: ROOT, encoding: 'utf8',
    });
  } catch (err) {
    if (err && err.status === 1) return []; // grep: no matches
    throw err;
  }
  return out.split('\n').filter(Boolean).map(function (line) {
    const first = line.indexOf(':');
    const second = line.indexOf(':', first + 1);
    return { file: line.slice(0, first), content: line.slice(second + 1) };
  }).filter(function (hit) {
    // Comment-filter per the grep-hygiene rule: drop pure comment lines.
    const t = hit.content.trim();
    return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('#'));
  });
}

// ---------- the tests ----------

async function main() {
  console.log('test-220-part8-egress: REQ-5 fence on the tavily-extract source');

  await test('Gate 1a: a candidate marker actually matches the live FORBIDDEN_PATTERNS (derivation holds)', async function () {
    const planted = derivePlantedQuery();
    assert.ok(planted, 'at least one candidate marker matches a live forbidden pattern');
    console.log('        planted against pattern: ' + planted.pattern.slice(0, 60));
  });

  await test('Gate 1b: planted room-content query -> ExternalEgressViolation + ZERO fetch attempted', async function () {
    process.env.TAVILY_API_KEY = 'test-key-not-real';
    const state = stubFetch();
    try {
      const planted = derivePlantedQuery();
      let thrown = null;
      try {
        await fetchCorpus({ source: 'tavily-extract', query: planted.url });
      } catch (err) {
        thrown = err;
      }
      assert.ok(thrown, 'fetchCorpus rejected the planted query');
      assert.ok(thrown instanceof ExternalEgressViolation,
        'rejection is ExternalEgressViolation, got: ' + (thrown && thrown.name));
      assert.strictEqual(state.calls, 0, 'fetch stub call count is 0 -- zero bytes attempted the wire');
    } finally { restore(); }
  });

  await test('Gate 2a: clean URL -> captured body carries ONLY {api_key, urls, extract_depth, format}', async function () {
    process.env.TAVILY_API_KEY = 'test-key-not-real';
    const state = stubFetch();
    try {
      const cleanUrl = 'https://example.com/clean';
      const env = await fetchCorpus({ source: 'tavily-extract', query: cleanUrl });
      assert.strictEqual(env.ok, true, 'clean leg succeeds');
      assert.strictEqual(state.calls, 1, 'exactly one outbound request');
      const captured = state.captured[0];
      assert.ok(String(captured.url).indexOf('api.tavily.com/extract') !== -1, 'request targets the extract endpoint');
      const body = JSON.parse(captured.init.body);
      const violations = auditOutboundBody(body, cleanUrl);
      assert.deepStrictEqual(violations, [], 'key-allowlist walk clean: ' + violations.join('; '));
      assert.strictEqual(body.urls, cleanUrl, 'URL echoes verbatim');
      assert.strictEqual(body.format, 'markdown', 'format is the generic markdown handle');
      assert.ok(body.extract_depth === 'advanced' || body.extract_depth === 'basic', 'extract_depth is a generic enum');
    } finally { restore(); }
  });

  await test('Gate 2b: negative self-check -- an injected extra field IS caught by the walk', async function () {
    const cleanUrl = 'https://example.com/clean';
    const poisoned = {
      api_key: 'k', urls: cleanUrl, extract_depth: 'advanced', format: 'markdown',
      room_context: 'smuggled room prose that must never reach the wire',
    };
    const violations = auditOutboundBody(poisoned, cleanUrl);
    assert.ok(violations.length > 0, 'the gate bites: injected field produced a violation');
    assert.ok(violations.some(function (v) { return v.indexOf('room_context') !== -1; }),
      'the violation names the injected key');
  });

  await test('Gate 2c: negative self-check -- an oversize generic field IS caught by the walk', async function () {
    const cleanUrl = 'https://example.com/clean';
    const poisoned = {
      api_key: 'k', urls: cleanUrl, format: 'markdown',
      extract_depth: 'x'.repeat(SHORT_HANDLE_MAX + 1),
    };
    const violations = auditOutboundBody(poisoned, cleanUrl);
    assert.ok(violations.length > 0, 'the gate bites on an over-long generic field');
  });

  await test('Gate 3a: chokepoint uniqueness -- api.tavily.com/extract lives ONLY in lib/core/research-corpus.cjs', async function () {
    const hits = grepHits('api.tavily.com/extract', ['lib/', 'scripts/']);
    const offenders = hits.filter(function (h) {
      return path.normalize(h.file) !== path.normalize('lib/core/research-corpus.cjs');
    });
    assert.ok(hits.length >= 1, 'the endpoint const exists in research-corpus.cjs');
    assert.deepStrictEqual(offenders.map(function (h) { return h.file; }), [],
      'no second extract-endpoint caller anywhere in lib/ or scripts/');
  });

  await test('Gate 3b: chokepoint uniqueness -- adapterTavilyExtract never referenced outside research-corpus.cjs', async function () {
    const hits = grepHits('adapterTavilyExtract', ['lib/', 'scripts/']);
    const offenders = hits.filter(function (h) {
      return path.normalize(h.file) !== path.normalize('lib/core/research-corpus.cjs');
    });
    assert.deepStrictEqual(offenders.map(function (h) { return h.file; }), [],
      'nobody bypasses fetchCorpus for the extract adapter');
  });

  console.log('');
  console.log('Part 8 egress fence: PASS=' + PASS + ' FAIL=' + FAIL);
  for (const f of failures) {
    console.log('  - ' + f.name + ': ' + (f.err && f.err.stack ? f.err.stack.split('\n')[0] : String(f.err)));
  }
  process.exit(FAIL === 0 ? 0 : 1);
}

main().catch(function (err) {
  console.error('test-220-part8-egress: fatal: ' + (err && err.stack ? err.stack : String(err)));
  restore();
  process.exit(1);
});
