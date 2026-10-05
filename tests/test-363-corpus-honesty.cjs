#!/usr/bin/env node
'use strict';

// Phase 363 Plan 03 - corpus honesty and OpenAlex metering (D-16).
//
// L1-L5   a failed OpenAlex fetch is never empty_valid; typed failure_class
// L6-L7   live zero-hit stays empty_valid; meta carried on ok and empty_valid
// L8-L9   API key travels only as an Authorization Bearer header
// L10-L11 query fidelity, select list, per-page
// L12     normalized papers carry retraction and venue fields additively
// L13     legacy academic envelope shape unchanged
// L14     (moved 369.2-06, ruling 2026-10-05) L14b web line dispatches a room string once,
//         L14c a credential is refused per A4, L14d brain-cypher still throws with zero calls
//
// Hygiene: HOME points at a mkdtemp dir BEFORE any repo module loads (the
// telemetry ledger lives under os.homedir()), the vendor key is scrubbed, the
// net guard is installed, and each leg replaces globalThis.fetch with its own
// stub and restores it.
//
// exit 0 -> PASSED, exit 1 -> FAILED, exit 77 -> SKIPPED (ENV GAP)
//
// House rule: hyphens only; dash characters appear only as unicode escapes.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos363-honesty-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;

const { scrubVendorKey, installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');
scrubVendorKey();
delete process.env.OPENALEX_API_KEY;
delete process.env.OPENALEX_EMAIL;
const NET = installNetGuard();
const NET_FETCH = globalThis.fetch;

const { check, summary } = makeChecker('test-363-corpus-honesty');

const corpus = require('../lib/core/research-corpus.cjs');
const academic = require('../lib/core/rs-fetcher-academic.cjs');
const { ExternalEgressViolation } = require('../lib/core/rs-egress-violations.cjs');

const FAKE_KEY = 'fake-key-363';
const EM_DASH = '\u2014';
const EN_DASH = '\u2013';

// ---------------------------------------------------------------------------
// stub helpers
// ---------------------------------------------------------------------------

function makeHeaders(map) {
  const lower = {};
  Object.keys(map || {}).forEach(function (k) { lower[k.toLowerCase()] = String(map[k]); });
  return {
    get: function (name) {
      const v = lower[String(name).toLowerCase()];
      return v === undefined ? null : v;
    },
  };
}

function makeResponse(status, headers, bodyObj) {
  const text = bodyObj === undefined ? '' : JSON.stringify(bodyObj);
  return {
    ok: status >= 200 && status < 300,
    status: status,
    headers: makeHeaders(headers),
    json: async function () { return JSON.parse(text); },
    text: async function () { return text; },
  };
}

function work(i, extra) {
  return Object.assign({
    id: 'https://openalex.org/W36300' + i,
    title: 'Sonic biofilm removal study ' + i,
    abstract_inverted_index: { Ultrasound: [0], removes: [1], biofilm: [2] },
    publication_year: 2020 + (i % 5),
    authorships: [{ author: { display_name: 'A. Researcher' }, institutions: [{ display_name: 'Test Univ' }] }],
    doi: 'https://doi.org/10.1000/363.' + i,
    type: 'article',
    cited_by_count: 10 * i,
    is_retracted: false,
    primary_location: { source: { display_name: 'Journal of Tests', is_in_doaj: true } },
  }, extra || {});
}

const OK_HEADERS = {
  'x-ratelimit-limit-usd': '0.1',
  'x-ratelimit-cost-usd': '0.001',
  'x-ratelimit-remaining-usd': '0.099',
};

// Install a stub; returns { calls, restore }.
function stubFetch(handler) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async function stub(url, init) {
    const headers = (init && init.headers) || {};
    const rec = { url: String(url), headers: Object.assign({}, headers) };
    calls.push(rec);
    return handler(rec, init);
  };
  return { calls: calls, restore: function () { globalThis.fetch = original; } };
}

function resetLedger() {
  try { fs.rmSync(path.join(TMP_HOME, '.mindrian'), { recursive: true, force: true }); } catch (_e) { /* ok */ }
}

async function runLeg(handler, args) {
  resetLedger();
  const s = stubFetch(handler);
  try {
    const env = await corpus.fetchCorpusEnvelope(Object.assign({
      source: 'openalex',
      query: 'acoustic biofilm disruption',
      limit: 5,
    }, args || {}));
    return { env: env, calls: s.calls };
  } finally {
    s.restore();
  }
}

function abortError() {
  const e = new Error('The operation was aborted');
  e.name = 'AbortError';
  return e;
}

function cls(env) { return env && env.failure_class; }

async function main() {
  // ---- L1 - L4: failures are never empty_valid ----
  {
    const r = await runLeg(function () { return makeResponse(429, {}, { error: 'rate limited' }); });
    check('L1 HTTP 429 -> failed / http_error / retryable (never empty_valid)',
      r.env.status === 'failed' && cls(r.env) === 'http_error' && r.env.retryable === true,
      'status=' + r.env.status + ' class=' + cls(r.env) + ' retryable=' + r.env.retryable);
  }
  {
    const r = await runLeg(function () { return makeResponse(500, {}, { error: 'boom' }); });
    check('L2 HTTP 500 -> failed / http_error / retryable',
      r.env.status === 'failed' && cls(r.env) === 'http_error' && r.env.retryable === true,
      'status=' + r.env.status + ' class=' + cls(r.env));
  }
  {
    const r = await runLeg(function () { throw abortError(); });
    check('L3 timeout (AbortError) -> failed / network_timeout / retryable',
      r.env.status === 'failed' && cls(r.env) === 'network_timeout' && r.env.retryable === true,
      'status=' + r.env.status + ' class=' + cls(r.env));
  }
  {
    const r = await runLeg(function () { throw new TypeError('fetch failed'); });
    check('L4 network TypeError -> failed / network_timeout / retryable',
      r.env.status === 'failed' && cls(r.env) === 'network_timeout' && r.env.retryable === true,
      'status=' + r.env.status + ' class=' + cls(r.env));
  }

  // ---- L5: budget exhausted ----
  {
    const r = await runLeg(function () {
      return makeResponse(429, {
        'x-ratelimit-limit-usd': '0.1',
        'x-ratelimit-remaining-usd': '0',
      }, { error: 'budget' });
    });
    const blob = JSON.stringify(r.env);
    check('L5 429 with remaining-usd 0 -> failed and names budget_exhausted',
      r.env.status === 'failed' && /budget_exhausted/.test(blob),
      'status=' + r.env.status + ' error=' + r.env.error);
  }

  // ---- L6: live zero-hit ----
  {
    const r = await runLeg(function () {
      return makeResponse(200, OK_HEADERS, { meta: { count: 0, page: 1, per_page: 5 }, results: [] });
    });
    check('L6 200 with meta.count 0 and no results -> empty_valid with meta.count 0',
      r.env.status === 'empty_valid' && r.env.meta && r.env.meta.count === 0,
      'status=' + r.env.status + ' meta=' + JSON.stringify(r.env.meta));
  }

  // ---- L7: ok carries meta ----
  {
    const r = await runLeg(function () {
      return makeResponse(200, OK_HEADERS, {
        meta: { count: 240, page: 1, per_page: 5, x_query: 'stemmed:acoust biofilm disrupt' },
        results: [work(1), work(2), work(3), work(4), work(5)],
      });
    });
    const m = r.env.meta || {};
    check('L7 200 with meta.count 240 -> ok with count, cost_usd, remaining_usd, x_query',
      r.env.status === 'ok' && m.count === 240 && m.cost_usd === 0.001 && m.remaining_usd === 0.099
        && m.limit_usd === 0.1 && m.x_query === 'stemmed:acoust biofilm disrupt'
        && r.env.payload.results.length === 5,
      'status=' + r.env.status + ' meta=' + JSON.stringify(r.env.meta));
  }

  // ---- L8: key hygiene ----
  {
    process.env.OPENALEX_API_KEY = FAKE_KEY;
    let r;
    let ledgerText = '';
    try {
      // one ok call and one failing call, to inspect telemetry and errors
      r = await runLeg(function () { return makeResponse(200, OK_HEADERS, { meta: { count: 1 }, results: [work(1)] }); });
      const fail = await runLeg(function () { return makeResponse(500, {}, { error: 'boom' }); });
      const seen = r.calls[0];
      const auth = seen.headers.Authorization || seen.headers.authorization;
      const tel = path.join(TMP_HOME, '.mindrian', 'telemetry');
      try {
        for (const f of fs.readdirSync(tel)) ledgerText += fs.readFileSync(path.join(tel, f), 'utf8');
      } catch (_e) { /* ledger may be absent */ }
      const blob = JSON.stringify(r.env) + JSON.stringify(fail.env) + ledgerText;
      check('L8 key rides only as Authorization Bearer; absent from URL, telemetry, envelope, errors',
        auth === 'Bearer ' + FAKE_KEY
          && seen.url.indexOf(FAKE_KEY) === -1
          && !/api_key=/i.test(seen.url)
          && blob.indexOf(FAKE_KEY) === -1
          && !/api_key=/i.test(blob),
        'auth=' + (auth ? '[present]' : 'MISSING') + ' url=' + seen.url.replace(FAKE_KEY, '[KEY]'));
    } finally {
      delete process.env.OPENALEX_API_KEY;
    }
  }

  // ---- L9: keyless ----
  {
    const r = await runLeg(function () { return makeResponse(200, OK_HEADERS, { meta: { count: 1 }, results: [work(1)] }); });
    const seen = r.calls[0];
    const hasAuth = Object.keys(seen.headers).some(function (k) { return k.toLowerCase() === 'authorization'; });
    check('L9 keyless: no Authorization header, mailto present',
      !hasAuth && /[?&]mailto=/.test(seen.url), 'headers=' + Object.keys(seen.headers).join(','));
  }

  // ---- L10: query fidelity ----
  {
    const q = '"acoustic biofilm disruption" OR "sonic biofilm removal"';
    const r = await runLeg(function () { return makeResponse(200, OK_HEADERS, { meta: { count: 0 }, results: [] }); }, { query: q });
    const u = new URL(r.calls[0].url);
    check('L10 quoted phrases and uppercase OR reach the search parameter byte-identical',
      u.searchParams.get('search') === q, 'search=' + u.searchParams.get('search'));
  }

  // ---- L11: select and per-page ----
  {
    const r5 = await runLeg(function () { return makeResponse(200, OK_HEADERS, { meta: { count: 0 }, results: [] }); }, { limit: 5 });
    const u5 = new URL(r5.calls[0].url);
    const select = (u5.searchParams.get('select') || '').split(',');
    const wantSelect = ['id', 'title', 'abstract_inverted_index', 'publication_year', 'authorships', 'doi',
      'type', 'cited_by_count', 'is_retracted', 'primary_location'];
    const selectOk = wantSelect.every(function (f) { return select.indexOf(f) !== -1; });
    const b5 = academic.buildAcademicQuery('acoustic biofilm disruption', 'openalex', { perPage: 5 });
    const b500 = academic.buildAcademicQuery('acoustic biofilm disruption', 'openalex', { perPage: 500 });
    const bDef = academic.buildAcademicQuery('acoustic biofilm disruption', 'openalex', {});
    const pp = function (b) { return new URL(b.url).searchParams.get('per-page'); };
    check('L11 select gains type, cited_by_count, is_retracted, primary_location; per-page = min(limit, 200)',
      selectOk && u5.searchParams.get('per-page') === '5'
        && pp(b5) === '5' && pp(b500) === '200' && pp(bDef) === '200',
      'select=' + select.join(',') + ' via-limit5=' + u5.searchParams.get('per-page')
        + ' b5=' + pp(b5) + ' b500=' + pp(b500) + ' default=' + pp(bDef));
  }

  // ---- L12: normalized fields ----
  {
    const parsed = academic._test.parseOpenAlex({
      results: [work(3, { is_retracted: true, type: 'review', cited_by_count: 77 })],
    });
    const p = parsed[0] || {};
    const legacyOk = p.id === 'https://openalex.org/W363003'
      && p.title === 'Sonic biofilm removal study 3'
      && p.abstract === 'Ultrasound removes biofilm'
      && Array.isArray(p.authors) && p.authors[0] === 'A. Researcher'
      && p.institution === 'Test Univ'
      && p.doi === 'https://doi.org/10.1000/363.3'
      && p.source === 'openalex' && typeof p.fetched_at === 'string';
    check('L12 papers carry is_retracted, type, cited_by_count, venue, is_in_doaj; legacy fields intact',
      legacyOk && p.is_retracted === true && p.type === 'review' && p.cited_by_count === 77
        && p.venue === 'Journal of Tests' && p.is_in_doaj === true,
      JSON.stringify(p));
  }

  // ---- L13: legacy shapes ----
  {
    resetLedger();
    const s = stubFetch(function () {
      return makeResponse(200, OK_HEADERS, { meta: { count: 2 }, results: [work(1), work(2)] });
    });
    let okEnv;
    try { okEnv = await academic.fetchOpenAlex(['acoustic biofilm disruption'], { limit: 5 }); } finally { s.restore(); }
    resetLedger();
    const s2 = stubFetch(function () { return makeResponse(500, {}, { error: 'boom' }); });
    let failEnv;
    try { failEnv = await academic.fetchOpenAlex(['acoustic biofilm disruption'], { limit: 5 }); } finally { s2.restore(); }
    resetLedger();
    const s3 = stubFetch(function () { return makeResponse(500, {}, { error: 'boom' }); });
    let legacyFail;
    try { legacyFail = await corpus.fetchCorpus({ source: 'openalex', query: 'acoustic biofilm disruption' }); } finally { s3.restore(); }
    check('L13 fetchOpenAlex envelope shape and fetchCorpus [] degrade unchanged',
      okEnv && okEnv.tier === 'paid' && okEnv.source === 'openalex' && Array.isArray(okEnv.results)
        && okEnv.results.length === 2 && Array.isArray(okEnv.papers) && Array.isArray(okEnv.telemetry)
        && failEnv.results.length === 0 && Array.isArray(legacyFail) && legacyFail.length === 0,
      'ok=' + JSON.stringify(okEnv && Object.keys(okEnv)) + ' legacyFail=' + JSON.stringify(legacyFail));
  }

  // ---- L14 (moved 369.2-06, 2026-10-05) ----
  // 369.2-06: the CONTENT-SET fence binds the Theo/Brain line only (ruling 2026-10-05); see the web-line and credential legs (L14b, L14c, L14d).

  // ---- L14b - L14d (369.2 ruling 2026-10-05): web lines free, Brain line fenced, credentials per A4 ----
  const A4_3692 = process.env.MOS_369_2_A4 === 'drop' ? 'drop' : 'keep';
  const PLANTED_3692 = 'contact jane.roe@example.com about biofilm';
  {
    resetLedger();
    const s = stubFetch(function () { return makeResponse(200, OK_HEADERS, { meta: { count: 0 }, results: [] }); });
    let threw = null;
    try {
      await corpus.fetchCorpusEnvelope({ source: 'openalex', query: PLANTED_3692, limit: 5 });
    } catch (e) {
      threw = e;
    } finally {
      s.restore();
    }
    let sent = null;
    try { sent = new URL(s.calls[0] && s.calls[0].url).searchParams.get('search'); } catch (_e) { sent = null; }
    check('L14b web line: a room string on openalex dispatches once with q unchanged (369.2 ruling 2026-10-05)',
      threw === null && s.calls.length === 1 && sent === PLANTED_3692,
      'threw=' + (threw && threw.name) + ' calls=' + s.calls.length + ' q=' + JSON.stringify(sent));
  }
  {
    resetLedger();
    const secret = 'abc123secretvalue';
    const s = stubFetch(function () { return makeResponse(200, OK_HEADERS, { meta: { count: 0 }, results: [] }); });
    let threw = null;
    try {
      await corpus.fetchCorpusEnvelope({ source: 'openalex', query: 'biofilm api_key=' + secret, limit: 5 });
    } catch (e) {
      threw = e;
    } finally {
      s.restore();
    }
    const refused = threw instanceof ExternalEgressViolation && threw.meta.matched_pattern === 'credential'
      && threw.meta.sample === '' && String(threw.message).indexOf(secret) === -1 && s.calls.length === 0;
    check('L14c A4=' + A4_3692 + (A4_3692 === 'keep'
      ? ' credential-shaped query refused pre-dispatch: zero calls, no echo (369.2 ruling 2026-10-05)'
      : ' credential-shaped query dispatches once (369.2 ruling 2026-10-05)'),
      A4_3692 === 'keep' ? refused : (threw === null && s.calls.length === 1),
      'threw=' + (threw && threw.name) + ' calls=' + s.calls.length);
  }
  {
    resetLedger();
    const s = stubFetch(function () { return makeResponse(200, OK_HEADERS, { meta: { count: 0 }, results: [] }); });
    let threw = null;
    try {
      await corpus.fetchCorpusEnvelope({ source: 'brain-cypher', query: PLANTED_3692, limit: 5 });
    } catch (e) {
      threw = e;
    } finally {
      s.restore();
    }
    check('L14d brain-cypher (the Theo line) still throws ExternalEgressViolation on the room string with zero calls (369.2 ruling 2026-10-05)',
      threw instanceof ExternalEgressViolation && s.calls.length === 0,
      'threw=' + (threw && threw.name) + ' calls=' + s.calls.length);
  }

  // ---- L15: a spent local budget is a typed spend limit, never empty_valid ----
  {
    resetLedger();
    const telemetry = require('../lib/core/rs-egress-telemetry.cjs');
    for (let i = 0; i < telemetry.DEFAULT_BUDGETS.openalex; i += 1) {
      telemetry.recordTelemetry({ source: 'openalex', query_text: 'seed ' + i, status: 'ok', http_status: 200 });
    }
    const s = stubFetch(function () { return makeResponse(200, OK_HEADERS, { meta: { count: 0 }, results: [] }); });
    let env;
    try {
      env = await corpus.fetchCorpusEnvelope({ source: 'openalex', query: 'acoustic biofilm disruption', limit: 5 });
    } finally { s.restore(); }
    const v = require('../lib/core/recovery/stage-envelope.cjs').validateStageEnvelope(env);
    check('L15 spent local budget -> blocked / spend_limit_exceeded / not retryable, envelope valid, zero calls',
      env.status === 'blocked' && env.failure_class === 'spend_limit_exceeded' && env.retryable === false
        && /budget_exhausted/.test(JSON.stringify(env)) && v.ok === true && s.calls.length === 0,
      'status=' + env.status + ' class=' + env.failure_class + ' valid=' + JSON.stringify(v) + ' calls=' + s.calls.length);
  }

  // ---- L16: every typed envelope passes the stage-envelope validator ----
  {
    const validate = require('../lib/core/recovery/stage-envelope.cjs').validateStageEnvelope;
    const handlers = [
      function () { return makeResponse(429, {}, {}); },
      function () { return makeResponse(500, {}, {}); },
      function () { throw abortError(); },
      function () { throw new TypeError('fetch failed'); },
      function () { return makeResponse(200, OK_HEADERS, { meta: { count: 0 }, results: [] }); },
      function () { return makeResponse(200, OK_HEADERS, { meta: { count: 3 }, results: [work(1)] }); },
    ];
    const bad = [];
    for (let i = 0; i < handlers.length; i += 1) {
      const r = await runLeg(handlers[i]);
      const v = validate(r.env);
      if (!v.ok) bad.push(i + ':' + JSON.stringify(v.violations));
    }
    check('L16 all six failure and success shapes validate as stage envelopes', bad.length === 0, bad.join(' '));
  }

  // ---- hygiene ----
  check('H1 no em-dash or en-dash characters in this test file',
    (function () {
      const t = fs.readFileSync(__filename, 'utf8');
      return t.indexOf(EM_DASH) === -1 && t.indexOf(EN_DASH) === -1;
    })());
  check('H2 net guard: zero unstubbed network attempts', (function () {
    globalThis.fetch = NET_FETCH;
    return NET.attempts() === 0;
  })(), 'attempts=' + NET.attempts());

  NET.restore();
  try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch (_e) { /* ok */ }
  return summary();
}

main().then(function (code) { process.exit(code); }, function (err) {
  console.log('FAIL: unexpected error ' + (err && err.stack ? err.stack : String(err)));
  try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch (_e) { /* ok */ }
  process.exit(1);
});
