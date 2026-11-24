#!/usr/bin/env node
'use strict';
// Phase 400 plan 12 (RL-01, RL-02, RL-03): the decision relay pipeline, proven without a socket and without the network.
//   C1 config defaults, invalid numbers, dropped operator hashes, no key value in the config
//   C2 install callers (no caller, bad id, user traffic off, hashed bucket)
//   C3 operator token by sha256 and timingSafeEqual, no fallback after a bad token
//   C4 cap order, refused calls never counted, operator meets only its own cap
//   C5 bounded bucket tables   C6 UTC day reset and Retry-After to the next UTC midnight
// Only 127.0.0.1 is used. No GEMINI_API_KEY is read from this machine; tests inject a fake value. Hyphens only.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const REL = path.join(REPO, 'services/decision-relay');
const realFetch = globalThis.fetch;
// Any path that skips the injected fetch lands on this thrower and is counted.
let strayFetch = 0;
globalThis.fetch = function stray() { strayFetch += 1; throw new Error('stray fetch in test-400-relay'); };

let pass = 0;
let fail = 0;
let finished = false;
// A pending promise with an empty event loop would end the process with code 0 and no summary. Fail instead.
process.on('exit', (code) => { if (!finished && code === 0) { console.log('FAIL: the test ended before the summary'); process.exitCode = 1; } });
async function leg(name, fn) {
  let ok;
  try { ok = await fn(); } catch (e) { ok = 'threw: ' + String(e && e.stack ? e.stack : e).slice(0, 400); }
  if (ok === true) { pass += 1; console.log('PASS: ' + name); } else { fail += 1; console.log('FAIL: ' + name + ' (' + String(ok) + ')'); }
}

function load(name) { return require(path.join(REL, name)); }
function sha(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }

const OP_TOKEN = 'operator-token-400-test-cccc3333';
const OP_HASH = sha(OP_TOKEN);
const INSTALL_ID = '0123456789abcdef0123456789abcdef';
const DAY0 = Date.UTC(2026, 10, 24, 10, 0, 0);

function clock(start) {
  const c = { t: start };
  c.now = () => c.t;
  return c;
}

function cfgWith(over) {
  const config = load('config.cjs');
  return Object.assign({}, config.loadConfig({}), over || {});
}

function install(bucketSeed) {
  return { ok: true, kind: 'install', bucket: sha('seed:' + bucketSeed).slice(0, 32) };
}
const OPERATOR = { ok: true, kind: 'operator', bucket: 'operator' };

// ---------- R legs: the request pipeline (plan 12 task 2) ----------
//   R1 caller check before any body read   R2 no key   R3 size cap and not_json   R4 catalog skew
//   R5 labels-only refusal, never strips   R6 question cap   R7 cap refusal with Retry-After
//   R8 one pinned POST, body is the server render   R9 answers and recorded usage
//   R10 upstream status, unreachable, timeout   R11 loopback redirect is not followed (real fetch)
//   R12 clean logs, bodies and headers   R13 pinned origin, no env name for the origin
const http = require('node:http');

const FAKE_KEY = 'fake-gemini-key-400-relay-eeee5555';
const SAMPLE = path.join(REPO, 'tests/fixtures/399/neutral-request-sample.json');
const LOG_KEYS = ['t', 'route', 'status', 'reason', 'kind', 'questions', 'ms', 'upstream_ms', 'input_tokens'];
const allLogs = [];
const allReplies = [];

function answerFor(q) {
  if (q.type === 'noul') return { type: 'noul', noul: 0.25 };
  if (q.type === 'choice') {
    const keys = Object.keys(q.criteria);
    const probabilities = {};
    keys.forEach((k) => { probabilities[k] = 1 / keys.length; });
    return { type: 'choice', choice: keys[0], probabilities, confidence: 0.5 };
  }
  return { type: 'score', score: 0.5, probabilities: { 0: 0.2, 1: 0.3, 2: 0.5 }, confidence: 0.5 };
}

function upstreamReply(bodyText, tokens) {
  const body = JSON.parse(bodyText);
  const answers = {};
  for (const id of Object.keys(body.questions)) answers[id] = answerFor(body.questions[id]);
  return JSON.stringify({ answers, usage: { total_input_tokens: tokens, total_output_tokens: 0 } });
}

// A fetch spy: records every call and answers from `respond(url, init)`.
function spy(respond) {
  const calls = [];
  const f = async (url, init) => {
    calls.push({ url, init });
    return respond(url, init, calls.length);
  };
  f.calls = calls;
  return f;
}
function okSpy(tokens) {
  return spy(async (_u, init) => new Response(upstreamReply(init.body, tokens === undefined ? 42 : tokens), { status: 200 }));
}

function makeRelay(o) {
  const relayMod = load('relay.cjs');
  const { loadConfig } = load('config.cjs');
  const { createLimits } = load('limits.cjs');
  const env = o.env || { GEMINI_API_KEY: FAKE_KEY, RELAY_OPERATOR_TOKEN_SHA256: OP_HASH };
  const cfg = Object.assign({}, loadConfig(env), o.cfg || {});
  const ck = clock(DAY0);
  const limits = createLimits(cfg, ck.now);
  const logs = [];
  const deps = { cfg, env, fetchImpl: o.fetchImpl, now: ck.now, limits, log: (r) => { logs.push(r); allLogs.push(r); } };
  if (o.origin !== null) deps.upstreamOrigin = o.origin || 'https://upstream.test.invalid';
  const relay = relayMod.createRelay(deps);
  const call = async (input) => {
    const res = await relay.handleDecide(input);
    allReplies.push(res);
    return res;
  };
  return { relay, call, logs, limits, cfg };
}

function fingerprint() { return require(path.join(REPO, 'lib/core/decision-advisor/labels-only.cjs')).catalogFingerprint(); }
function opHeaders(over) {
  return Object.assign({ authorization: 'Bearer ' + OP_TOKEN, 'x-mindrian-catalog': fingerprint(), 'content-type': 'application/json' }, over || {});
}
function installHeaders(over) {
  return Object.assign({ 'x-theo-install-id': INSTALL_ID, 'x-mindrian-catalog': fingerprint() }, over || {});
}
function sample() { return JSON.parse(fs.readFileSync(SAMPLE, 'utf8')); }
function input(headers, obj, extra) {
  const bodyText = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return Object.assign({ headers, bodyText, bytes: Buffer.byteLength(bodyText), address: '203.0.113.7' }, extra || {});
}
function hdr(res, name) {
  for (const k of Object.keys(res.headers || {})) if (k.toLowerCase() === name) return res.headers[k];
  return undefined;
}
function baseHeadersOk(res) {
  if (hdr(res, 'content-type') !== 'application/json') return 'content-type ' + hdr(res, 'content-type');
  if (hdr(res, 'cache-control') !== 'no-store') return 'cache-control';
  if (hdr(res, 'x-mindrian-catalog') !== fingerprint()) return 'catalog header';
  return true;
}
function manyQuestions(n) {
  const cmds = ['/mos:validate', '/mos:mullins', '/mos:map-unknowns'];
  const questions = {};
  for (let i = 1; i <= n; i += 1) questions['q' + String(i).padStart(4, '0')] = { type: 'yes_no', template: 'serves_job_v1', subject: cmds[i % 3] };
  return { context: sample().context, questions };
}

async function relayLegs() {
  const labels = require(path.join(REPO, 'lib/core/decision-advisor/labels-only.cjs'));
  const adapter = require(path.join(REPO, 'lib/core/decision-advisor/adapter.cjs'));
  const gemini = adapter.PROVIDERS.gemini;

  await leg('R1 no caller: 401 no_caller, the body is never read, 0 fetch calls', async () => {
    const f = okSpy();
    const { call } = makeRelay({ fetchImpl: f });
    let reads = 0;
    const inp = { headers: { 'x-mindrian-catalog': fingerprint() }, bytes: 9, address: '203.0.113.7' };
    Object.defineProperty(inp, 'bodyText', { enumerable: true, get() { reads += 1; return 'not json {'; } });
    const res = await call(inp);
    if (res.status !== 401 || res.body.reason !== 'no_caller' || res.body.ok !== false) return JSON.stringify(res);
    if (reads !== 0) return 'body read ' + reads + ' times';
    const h = baseHeadersOk(res);
    if (h !== true) return h;
    return f.calls.length === 0 ? true : 'fetch called';
  });

  await leg('R2 no key in deps.env: a valid operator call gives 503 no_upstream_key, 0 fetch calls', async () => {
    const f = okSpy();
    const { call } = makeRelay({ fetchImpl: f, env: { RELAY_OPERATOR_TOKEN_SHA256: OP_HASH } });
    const res = await call(input(opHeaders(), sample()));
    if (res.status !== 503 || res.body.reason !== 'no_upstream_key') return JSON.stringify(res);
    const { call: call2 } = makeRelay({ fetchImpl: f, env: { RELAY_OPERATOR_TOKEN_SHA256: OP_HASH, GEMINI_API_KEY: '' } });
    const res2 = await call2(input(opHeaders(), sample()));
    if (res2.status !== 503 || res2.body.reason !== 'no_upstream_key') return 'empty key ' + JSON.stringify(res2);
    return f.calls.length === 0 ? true : 'fetch called';
  });

  await leg('R3 over maxBodyBytes: 413 too_large; not JSON: 400 not_json; 0 fetch calls', async () => {
    const f = okSpy();
    const { call } = makeRelay({ fetchImpl: f, cfg: { maxBodyBytes: 64 } });
    const big = await call(input(opHeaders(), sample()));
    if (big.status !== 413 || big.body.reason !== 'too_large') return 'big ' + JSON.stringify(big);
    // A caller-sent small `bytes` does not hide a large body.
    const lie = await call(input(opHeaders(), sample(), { bytes: 10 }));
    if (lie.status !== 413 || lie.body.reason !== 'too_large') return 'lying bytes ' + JSON.stringify(lie);
    const { call: c2 } = makeRelay({ fetchImpl: f });
    for (const t of ['not json {', '', '[1,2', 'nul']) {
      const r = await c2(input(opHeaders(), t));
      if (r.status !== 400 || r.body.reason !== 'not_json') return 'text ' + JSON.stringify(t) + ' ' + JSON.stringify(r);
    }
    return f.calls.length === 0 ? true : 'fetch called';
  });

  await leg('R4 missing or different catalog header: 409 catalog_skew with the relay fingerprint, 0 fetch calls', async () => {
    const f = okSpy();
    const { call } = makeRelay({ fetchImpl: f });
    const fp = labels.catalogFingerprint();
    if (!/^[a-f0-9]{64}$/.test(fp)) return 'fingerprint shape';
    const h = opHeaders();
    delete h['x-mindrian-catalog'];
    for (const headers of [h, opHeaders({ 'x-mindrian-catalog': 'a'.repeat(64) }), opHeaders({ 'x-mindrian-catalog': fp.toUpperCase() })]) {
      const r = await call(input(headers, sample()));
      if (r.status !== 409 || r.body.reason !== 'catalog_skew' || r.body.relay_catalog !== fp) return JSON.stringify(r);
      if (hdr(r, 'x-mindrian-catalog') !== fp) return 'reply header';
    }
    const src = fs.readFileSync(path.join(REL, 'relay.cjs'), 'utf8');
    if (src.indexOf('catalogFingerprint()') === -1) return 'relay does not call catalogFingerprint()';
    if (/['"][a-f0-9]{64}['"]/.test(src)) return 'a literal fingerprint is pinned in relay.cjs';
    return f.calls.length === 0 ? true : 'fetch called';
  });

  await leg('R5 free text, unknown command, extra key, model key: 422 labels_only_refused, never stripped, 0 fetch calls', async () => {
    const f = okSpy();
    const { call } = makeRelay({ fetchImpl: f });
    const variants = [];
    const a = sample(); a.context.job_summary = 'My secret venture plan for a cancer assay.'; variants.push(a);
    const b = sample(); b.questions.q0001.subject = '/mos:not-a-command'; variants.push(b);
    const c = sample(); c.context.note = 'extra'; variants.push(c);
    const d = sample(); d.model = 'gemini-other'; variants.push(d);
    const realValidate = labels.validateNeutralRequest;
    const seen = [];
    labels.validateNeutralRequest = function wrapped(req, cat) { seen.push(req); return realValidate.apply(this, arguments); };
    try {
      for (const v of variants) {
        const text = JSON.stringify(v);
        const want = realValidate(JSON.parse(text)).reason;
        seen.length = 0;
        const r = await call(input(opHeaders(), text));
        if (r.status !== 422 || r.body.reason !== 'labels_only_refused' || r.body.detail !== want) return JSON.stringify(r) + ' want ' + want;
        if (seen.length === 0) return 'the shared validator was not called';
        if (JSON.stringify(seen[0]) !== text) return 'the request changed before or during validation';
      }
    } finally {
      labels.validateNeutralRequest = realValidate;
    }
    return f.calls.length === 0 ? true : 'fetch called';
  });

  await leg('R6 more than maxQuestions questions: 413 too_many_questions, 0 fetch calls', async () => {
    const f = okSpy();
    const { call } = makeRelay({ fetchImpl: f, cfg: { maxQuestions: 3 } });
    const r = await call(input(opHeaders(), manyQuestions(4)));
    if (r.status !== 413 || r.body.reason !== 'too_many_questions') return JSON.stringify(r);
    // The provider limit binds even when the config is higher: one POST, one chunk.
    const { call: c2 } = makeRelay({ fetchImpl: f, cfg: { maxQuestions: 5000, maxBodyBytes: 4000000 } });
    const r2 = await c2(input(opHeaders(), manyQuestions(gemini.MAX_QUESTIONS + 1)));
    if (r2.status !== 413 || r2.body.reason !== 'too_many_questions') return 'provider cap ' + JSON.stringify(r2);
    return f.calls.length === 0 ? true : 'fetch called';
  });

  await leg('R7 cap refusals: 429 with a Retry-After header and the limits reason', async () => {
    const f = okSpy();
    const { call } = makeRelay({ fetchImpl: f, cfg: { operatorDailyQuestions: 2 } });
    const r = await call(input(opHeaders(), sample()));
    if (r.status !== 429 || r.body.reason !== 'operator_daily_cap') return JSON.stringify(r);
    if (!/^[1-9][0-9]*$/.test(String(hdr(r, 'retry-after')))) return 'Retry-After ' + hdr(r, 'retry-after');
    if (f.calls.length !== 0) return 'fetch called on a cap refusal';
    const { call: c2 } = makeRelay({ fetchImpl: f, cfg: { userTraffic: true, installPerMinute: 1 } });
    const ok = await c2(input(installHeaders(), sample()));
    if (ok.status !== 200) return 'first install call ' + JSON.stringify(ok);
    const r2 = await c2(input(installHeaders(), sample()));
    if (r2.status !== 429 || r2.body.reason !== 'install_rate' || hdr(r2, 'retry-after') !== '60') return 'install_rate ' + JSON.stringify(r2);
    return f.calls.length === 1 ? true : 'fetch calls ' + f.calls.length;
  });

  await leg('R8 a valid 3-question request: exactly 1 POST to the pinned path; body is the server render', async () => {
    const f = okSpy();
    const { call } = makeRelay({ fetchImpl: f, origin: 'https://upstream.test.invalid' });
    const req = sample();
    const r = await call(input(opHeaders(), req));
    if (r.status !== 200) return JSON.stringify(r);
    if (f.calls.length !== 1) return 'fetch calls ' + f.calls.length;
    const { url, init } = f.calls[0];
    if (url !== 'https://upstream.test.invalid/v1beta/decisions') return 'url ' + url;
    if (init.method !== 'POST' || init.redirect !== 'error') return 'method or redirect';
    if (!(init.signal instanceof AbortSignal)) return 'no AbortSignal';
    const h = init.headers;
    if (h['x-goog-api-key'] !== FAKE_KEY || h['content-type'] !== 'application/json') return 'headers ' + JSON.stringify(Object.keys(h));
    if (Object.keys(h).sort().join(',') !== 'content-type,x-goog-api-key') return 'extra upstream headers ' + Object.keys(h).join(',');
    const sent = JSON.parse(init.body);
    const want = gemini.buildBody(adapter.renderRequest(req));
    if (JSON.stringify(sent) !== JSON.stringify(want)) return 'body is not the server render';
    if (sent.model !== gemini.MODEL) return 'model ' + sent.model;
    // The caller headers never reach the upstream.
    if (init.body.indexOf(OP_TOKEN) !== -1 || JSON.stringify(h).indexOf(OP_TOKEN) !== -1) return 'operator token forwarded';
    return true;
  });

  await leg('R9 a 200 upstream reply: 200 {ok, answers, usage, model, catalog}; input tokens recorded', async () => {
    const f = okSpy(42);
    const { call, limits } = makeRelay({ fetchImpl: f, cfg: { userTraffic: true } });
    const req = sample();
    const r = await call(input(installHeaders(), req));
    if (r.status !== 200) return JSON.stringify(r);
    if (Object.keys(r.body).sort().join(',') !== 'answers,catalog,model,ok,usage') return 'keys ' + Object.keys(r.body).join(',');
    if (r.body.ok !== true || r.body.model !== gemini.MODEL || r.body.catalog !== fingerprint()) return 'fields';
    if (r.body.usage.input_tokens !== 42 || r.body.usage.output_tokens !== 0) return 'usage ' + JSON.stringify(r.body.usage);
    const rendered = adapter.renderRequest(req);
    const want = gemini.parseResponse(JSON.parse(upstreamReply(JSON.stringify(gemini.buildBody(rendered)), 42)), rendered.questions).answers;
    if (JSON.stringify(r.body.answers) !== JSON.stringify(want)) return 'answers ' + JSON.stringify(r.body.answers);
    if (r.body.answers.q0001.p !== 0.25 || r.body.answers.q0002.type !== 'choice') return 'parsed values';
    const h = baseHeadersOk(r);
    if (h !== true) return h;
    return limits.snapshot().globalInputTokens === 42 ? true : 'tokens ' + JSON.stringify(limits.snapshot());
  });

  await leg('R10 upstream not 200: 502 upstream_error with the status only; rejection: 502 unreachable; timeout: 504', async () => {
    const bad = spy(async () => new Response('{"error":{"message":"quota for ' + FAKE_KEY + '"}}', { status: 500 }));
    const r1 = await makeRelay({ fetchImpl: bad }).call(input(opHeaders(), sample()));
    if (r1.status !== 502 || r1.body.reason !== 'upstream_error' || r1.body.upstream_status !== 500) return 'status ' + JSON.stringify(r1);
    if (Object.keys(r1.body).sort().join(',') !== 'ok,reason,upstream_status') return 'upstream text passed through';
    const notJson = spy(async () => new Response('<html>', { status: 200 }));
    const r1b = await makeRelay({ fetchImpl: notJson }).call(input(opHeaders(), sample()));
    if (r1b.status !== 502 || r1b.body.reason !== 'upstream_error' || r1b.body.upstream_status !== 200) return 'not json ' + JSON.stringify(r1b);
    const down = spy(async () => { throw new TypeError('fetch failed'); });
    const r2 = await makeRelay({ fetchImpl: down }).call(input(opHeaders(), sample()));
    if (r2.status !== 502 || r2.body.reason !== 'upstream_unreachable') return 'unreachable ' + JSON.stringify(r2);
    for (const name of ['TimeoutError', 'AbortError']) {
      const slow = spy(async () => { throw new DOMException('the operation timed out', name); });
      const r3 = await makeRelay({ fetchImpl: slow }).call(input(opHeaders(), sample()));
      if (r3.status !== 504 || r3.body.reason !== 'upstream_timeout') return name + ' ' + JSON.stringify(r3);
    }
    // The configured timeout reaches the signal.
    // AbortSignal.timeout does not hold the event loop open, so a ref'd timer keeps the process alive here.
    const keepAlive = setTimeout(() => {}, 5000);
    const hang = spy((_u, init) => new Promise((_res, rej) => { init.signal.addEventListener('abort', () => rej(init.signal.reason)); }));
    const r4 = await makeRelay({ fetchImpl: hang, cfg: { upstreamTimeoutMs: 30 } }).call(input(opHeaders(), sample()));
    clearTimeout(keepAlive);
    if (r4.status !== 504 || r4.body.reason !== 'upstream_timeout') return 'signal timeout ' + JSON.stringify(r4);
    // One attempt only: no retry on failure.
    return bad.calls.length === 1 && down.calls.length === 1 ? true : 'retry seen';
  });

  await leg('R11 loopback, real fetch: a 307 to a second server is not followed; 502; the second server sees 0 requests', async () => {
    let secondHits = 0;
    let firstHits = 0;
    const second = http.createServer((rq, rs) => { secondHits += 1; rq.resume(); rs.end('{}'); });
    const first = http.createServer((rq, rs) => {
      firstHits += 1;
      rq.resume();
      rq.on('end', () => { rs.writeHead(307, { Location: 'http://127.0.0.1:' + second.address().port + '/v1beta/decisions' }); rs.end(); });
    });
    try {
      await new Promise((r) => second.listen(0, '127.0.0.1', r));
      await new Promise((r) => first.listen(0, '127.0.0.1', r));
      const { call } = makeRelay({ fetchImpl: realFetch, origin: 'http://127.0.0.1:' + first.address().port, cfg: { upstreamTimeoutMs: 5000 } });
      const r = await call(input(opHeaders(), sample()));
      if (r.status !== 502) return JSON.stringify(r);
      if (firstHits !== 1) return 'first server hits ' + firstHits;
      return secondHits === 0 ? true : 'redirect followed';
    } finally {
      await new Promise((r) => first.close(r));
      await new Promise((r) => second.close(r));
    }
  });

  await leg('R12 logs hold only the fixed keys; no log, reply body or header holds the key, token, install id, job summary or a command name', () => {
    if (allLogs.length < 20) return 'too few logs ' + allLogs.length;
    for (const l of allLogs) {
      const keys = Object.keys(l).sort().join(',');
      if (keys !== LOG_KEYS.slice().sort().join(',')) return 'log keys ' + keys;
      if (l.route !== '/v1/decide' || typeof l.status !== 'number' || typeof l.ms !== 'number') return 'log shape ' + JSON.stringify(l);
      if (l.reason !== null && !load('relay.cjs').REASONS.includes(l.reason)) return 'log reason not in REASONS ' + l.reason;
    }
    const s = sample();
    const secrets = [FAKE_KEY, OP_TOKEN, INSTALL_ID, s.context.job_summary, 'My secret venture plan', '203.0.113.7'];
    const logText = JSON.stringify(allLogs);
    for (const x of secrets) if (logText.indexOf(x) !== -1) return 'log holds ' + x.slice(0, 12);
    if (logText.indexOf('/mos:') !== -1) return 'log holds a command name';
    for (const res of allReplies) {
      const headText = JSON.stringify(res.headers);
      for (const x of secrets) if (headText.indexOf(x) !== -1) return 'header holds ' + x.slice(0, 12);
      if (headText.indexOf('/mos:') !== -1) return 'header holds a command name';
      const b = Object.assign({}, res.body);
      // A command name may appear only inside a choice answer, as an option id the caller sent.
      const answers = b.answers || {};
      delete b.answers;
      const bodyText = JSON.stringify(b);
      for (const x of secrets) if (bodyText.indexOf(x) !== -1) return 'body holds ' + x.slice(0, 12);
      if (bodyText.indexOf('/mos:') !== -1) return 'body holds a command name';
      for (const id of Object.keys(answers)) {
        const a = Object.assign({}, answers[id]);
        if (a.type === 'choice') { delete a.choice; delete a.probabilities; }
        if (JSON.stringify(a).indexOf('/mos:') !== -1) return 'answer ' + id + ' holds a command name';
        if (JSON.stringify(answers[id]).indexOf(FAKE_KEY) !== -1) return 'answer holds the key';
      }
    }
    if (!Object.isFrozen(load('relay.cjs').REASONS)) return 'REASONS not frozen';
    return true;
  });

  await leg('R13 UPSTREAM_ORIGIN is pinned; relay.cjs reads no env name for the origin; the default origin is used', async () => {
    const relayMod = load('relay.cjs');
    if (relayMod.UPSTREAM_ORIGIN !== 'https://generativelanguage.googleapis.com') return 'origin ' + relayMod.UPSTREAM_ORIGIN;
    if (relayMod.CATALOG_HEADER !== 'x-mindrian-catalog') return 'CATALOG_HEADER';
    const want = ['no_caller', 'bad_install_id', 'bad_token', 'user_traffic_off', 'no_upstream_key', 'too_large', 'not_json', 'catalog_skew',
      'labels_only_refused', 'too_many_questions', 'install_rate', 'install_daily_cap', 'address_daily_cap', 'global_daily_requests',
      'global_daily_questions', 'global_token_cap', 'operator_daily_cap', 'bucket_table_full', 'body_check_failed', 'upstream_error',
      'upstream_unreachable', 'upstream_timeout'];
    if (JSON.stringify(relayMod.REASONS) !== JSON.stringify(want)) return 'REASONS ' + JSON.stringify(relayMod.REASONS);
    const src = fs.readFileSync(path.join(REL, 'relay.cjs'), 'utf8');
    if (/process\.env\.|env\.[A-Z_]+|env\[\s*['"]/.test(src)) return 'relay.cjs reads an env name directly';
    if (/RELAY_UPSTREAM|ORIGIN['"]\s*\]|BASE_URL/.test(src)) return 'an env name for the origin';
    for (const p of ['../../lib/core/decision-advisor/labels-only.cjs', '../../lib/core/decision-advisor/adapter.cjs']) {
      if (src.indexOf(p) === -1) return 'shared module not required by path: ' + p;
    }
    if (fs.readdirSync(REL).some((n) => /labels-only|adapter|gemini/.test(n))) return 'a vendored copy in the relay dir';
    const f = okSpy();
    const { call } = makeRelay({ fetchImpl: f, origin: null });
    const r = await call(input(opHeaders(), sample()));
    if (r.status !== 200) return JSON.stringify(r);
    return f.calls.length === 1 && f.calls[0].url === 'https://generativelanguage.googleapis.com/v1beta/decisions' ? true : 'url ' + (f.calls[0] && f.calls[0].url);
  });
}

async function main() {
  // ---------- C1 ----------
  await leg('C1 loadConfig({}) equals DEFAULTS; user traffic off; no operator hashes', () => {
    const { loadConfig, DEFAULTS } = load('config.cjs');
    const c = loadConfig({});
    if (JSON.stringify(c) !== JSON.stringify(DEFAULTS)) return 'not equal to DEFAULTS';
    if (c.userTraffic !== false) return 'userTraffic not false';
    if (!Array.isArray(c.operatorHashes) || c.operatorHashes.length !== 0) return 'operator hashes not empty';
    if (c.hasKey !== false) return 'hasKey not false';
    const want = { proxyHops: 0, maxBodyBytes: 524288, maxQuestions: 1000, installPerMinute: 10, installDailyQuestions: 2000,
      addressDailyQuestions: 20000, globalDailyRequests: 5000, globalDailyQuestions: 100000, globalDailyInputTokens: 20000000,
      operatorDailyQuestions: 200000, maxBuckets: 10000, upstreamTimeoutMs: 120000 };
    for (const k of Object.keys(want)) if (c[k] !== want[k]) return k + ' is ' + c[k];
    return Object.isFrozen(DEFAULTS) ? true : 'DEFAULTS not frozen';
  });
  await leg('C1 invalid numbers fall back; valid values apply; RELAY_USER_TRAFFIC=on only', () => {
    const { loadConfig, DEFAULTS } = load('config.cjs');
    const c = loadConfig({ RELAY_MAX_BODY_BYTES: 'abc', RELAY_MAX_QUESTIONS: '-5', RELAY_INSTALL_PER_MINUTE: '3.5', RELAY_MAX_BUCKETS: '0',
      RELAY_GLOBAL_DAILY_REQUESTS: '12', RELAY_PROXY_HOPS: '1', RELAY_UPSTREAM_TIMEOUT_MS: '1e3', RELAY_USER_TRAFFIC: 'on' });
    if (c.maxBodyBytes !== DEFAULTS.maxBodyBytes || c.maxQuestions !== DEFAULTS.maxQuestions) return 'invalid size or questions applied';
    if (c.installPerMinute !== DEFAULTS.installPerMinute || c.maxBuckets !== DEFAULTS.maxBuckets) return 'invalid rate or buckets applied';
    if (c.upstreamTimeoutMs !== DEFAULTS.upstreamTimeoutMs) return 'exponent form applied';
    if (c.globalDailyRequests !== 12 || c.proxyHops !== 1 || c.userTraffic !== true) return 'valid values not applied';
    for (const v of ['ON', 'true', '1', 'yes', ' on']) if (loadConfig({ RELAY_USER_TRAFFIC: v }).userTraffic !== false) return 'traffic on for ' + v;
    return true;
  });
  await leg('C1 operator hashes: 64 hex kept (lowercased), others dropped and counted; key value never copied', () => {
    const { loadConfig } = load('config.cjs');
    const key = 'fake-gemini-key-400-dddd4444';
    const c = loadConfig({ RELAY_OPERATOR_TOKEN_SHA256: OP_HASH.toUpperCase() + ', nothex,' + 'a'.repeat(63) + ',,' + sha('two'), GEMINI_API_KEY: key });
    if (c.operatorHashes.length !== 2 || c.operatorHashes[0] !== OP_HASH || c.operatorHashes[1] !== sha('two')) return 'hashes ' + JSON.stringify(c.operatorHashes);
    if (c.droppedHashes !== 2) return 'droppedHashes ' + c.droppedHashes;
    if (c.hasKey !== true) return 'hasKey not true';
    if (JSON.stringify(c).indexOf(key) !== -1) return 'key value in config';
    return true;
  });

  // ---------- C2 ----------
  await leg('C2 no caller, bad install id, user traffic off, install bucket', () => {
    const { verifyCaller } = load('verify-caller.cjs');
    const off = cfgWith({ userTraffic: false });
    const on = cfgWith({ userTraffic: true });
    const a = verifyCaller({}, off);
    if (a.ok !== false || a.status !== 401 || a.reason !== 'no_caller') return 'no caller ' + JSON.stringify(a);
    for (const bad of ['ABCDEF0123456789abcdef0123456789', 'abc', INSTALL_ID + '0', ' ' + INSTALL_ID, '']) {
      const b = verifyCaller({ 'x-theo-install-id': bad }, on);
      if (b.status !== 401 || b.reason !== 'bad_install_id') return 'bad id ' + JSON.stringify(bad) + ' ' + JSON.stringify(b);
    }
    const arr = verifyCaller({ 'x-theo-install-id': [INSTALL_ID, INSTALL_ID] }, on);
    if (arr.reason !== 'bad_install_id') return 'array header accepted';
    const c = verifyCaller({ 'X-Theo-Install-Id': INSTALL_ID }, off);
    if (c.ok !== false || c.status !== 403 || c.reason !== 'user_traffic_off') return 'traffic off ' + JSON.stringify(c);
    const d = verifyCaller({ 'X-THEO-INSTALL-ID': INSTALL_ID }, on);
    if (d.ok !== true || d.kind !== 'install' || !/^[a-f0-9]{32}$/.test(d.bucket)) return 'install ' + JSON.stringify(d);
    if (d.bucket === INSTALL_ID || d.bucket.indexOf(INSTALL_ID.slice(0, 12)) !== -1) return 'bucket carries the id';
    const e = verifyCaller({ 'x-theo-install-id': INSTALL_ID }, on);
    if (e.bucket !== d.bucket) return 'bucket not stable';
    const f = verifyCaller({ 'x-theo-install-id': 'fedcba9876543210fedcba9876543210' }, on);
    if (f.bucket === d.bucket) return 'two ids share a bucket';
    const src = fs.readFileSync(path.join(REL, 'verify-caller.cjs'), 'utf8');
    if (src.indexOf('installIdHeaderName') === -1) return 'header name not taken from install-id.cjs';
    return true;
  });

  // ---------- C3 ----------
  await leg('C3 operator token by sha256; wrong token is bad_token even with a valid install id; timingSafeEqual', () => {
    const { verifyCaller } = load('verify-caller.cjs');
    const cfg = cfgWith({ userTraffic: true, operatorHashes: [sha('other'), OP_HASH] });
    const a = verifyCaller({ authorization: 'Bearer ' + OP_TOKEN }, cfg);
    if (a.ok !== true || a.kind !== 'operator' || a.bucket !== 'operator') return 'operator ' + JSON.stringify(a);
    const a2 = verifyCaller({ Authorization: 'bearer ' + OP_TOKEN, 'x-theo-install-id': INSTALL_ID }, cfg);
    if (a2.kind !== 'operator') return 'scheme case or header case';
    const b = verifyCaller({ authorization: 'Bearer wrong-token', 'x-theo-install-id': INSTALL_ID }, cfg);
    if (b.ok !== false || b.status !== 401 || b.reason !== 'bad_token') return 'wrong token ' + JSON.stringify(b);
    for (const h of ['Basic ' + OP_TOKEN, 'Bearer', 'Bearer ', '', OP_TOKEN]) {
      const c = verifyCaller({ authorization: h, 'x-theo-install-id': INSTALL_ID }, cfg);
      if (c.reason !== 'bad_token') return 'header ' + JSON.stringify(h) + ' gave ' + JSON.stringify(c);
    }
    const none = verifyCaller({ authorization: 'Bearer ' + OP_TOKEN }, cfgWith({ operatorHashes: [] }));
    if (none.reason !== 'bad_token') return 'empty hash list accepted a token';
    const src = fs.readFileSync(path.join(REL, 'verify-caller.cjs'), 'utf8');
    if (src.indexOf('timingSafeEqual') === -1) return 'no timingSafeEqual';
    if (/[Hh]ashes\.(indexOf|includes|some|find)\(/.test(src)) return 'plain compare on hashes';
    return true;
  });

  // ---------- C4 ----------
  await leg('C4 install per-minute window: install_rate with retryAfterS to the window end', () => {
    const { createLimits } = load('limits.cjs');
    const ck = clock(DAY0);
    const L = createLimits(cfgWith({ installPerMinute: 2 }), ck.now);
    const me = install('a');
    if (!L.take(me, 1, '10.0.0.1').ok || !L.take(me, 1, '10.0.0.1').ok) return 'first two refused';
    ck.t += 20000;
    const r = L.take(me, 1, '10.0.0.1');
    if (r.ok !== false || r.status !== 429 || r.reason !== 'install_rate' || r.retryAfterS !== 40) return JSON.stringify(r);
    if (!L.take(install('b'), 1, '10.0.0.1').ok) return 'other install blocked';
    ck.t += 40000;
    return L.take(me, 1, '10.0.0.1').ok === true ? true : 'window did not reset';
  });
  await leg('C4 refusal order and refused calls never counted', () => {
    const { createLimits } = load('limits.cjs');
    const ck = clock(DAY0);
    // install daily questions
    let L = createLimits(cfgWith({ installDailyQuestions: 5 }), ck.now);
    if (!L.take(install('a'), 5, '1.1.1.1').ok) return 'install 5 refused';
    let r = L.take(install('a'), 1, '1.1.1.1');
    if (r.reason !== 'install_daily_cap') return 'want install_daily_cap got ' + JSON.stringify(r);
    if (L.snapshot().globalQuestions !== 5 || L.snapshot().globalRequests !== 1) return 'refused call counted ' + JSON.stringify(L.snapshot());
    // address daily questions
    L = createLimits(cfgWith({ addressDailyQuestions: 6 }), ck.now);
    if (!L.take(install('a'), 4, '1.1.1.1').ok) return 'addr first refused';
    r = L.take(install('b'), 3, '1.1.1.1');
    if (r.reason !== 'address_daily_cap') return 'want address_daily_cap got ' + JSON.stringify(r);
    if (!L.take(install('b'), 3, '2.2.2.2').ok) return 'other address blocked or refused call counted on install b';
    // global daily requests
    L = createLimits(cfgWith({ globalDailyRequests: 2 }), ck.now);
    L.take(install('a'), 1, 'x'); L.take(install('b'), 1, 'y');
    r = L.take(install('c'), 1, 'z');
    if (r.reason !== 'global_daily_requests') return 'want global_daily_requests got ' + JSON.stringify(r);
    // global daily questions
    L = createLimits(cfgWith({ globalDailyQuestions: 10 }), ck.now);
    L.take(install('a'), 6, 'x');
    r = L.take(install('b'), 5, 'y');
    if (r.reason !== 'global_daily_questions') return 'want global_daily_questions got ' + JSON.stringify(r);
    if (!L.take(install('b'), 4, 'y').ok) return 'exact fill refused';
    // global input tokens, recorded after a call
    L = createLimits(cfgWith({ globalDailyInputTokens: 100 }), ck.now);
    if (!L.take(install('a'), 1, 'x').ok) return 'token first refused';
    L.recordUsage(install('a'), 100);
    r = L.take(install('a'), 1, 'x');
    if (r.reason !== 'global_token_cap') return 'want global_token_cap got ' + JSON.stringify(r);
    // order: install_rate before the daily caps
    L = createLimits(cfgWith({ installPerMinute: 1, installDailyQuestions: 1, globalDailyRequests: 1 }), ck.now);
    L.take(install('a'), 1, 'x');
    r = L.take(install('a'), 1, 'x');
    if (r.reason !== 'install_rate') return 'order: want install_rate got ' + r.reason;
    // order: install daily before address daily before global
    L = createLimits(cfgWith({ installDailyQuestions: 1, addressDailyQuestions: 1, globalDailyQuestions: 1 }), ck.now);
    L.take(install('a'), 1, 'x');
    r = L.take(install('a'), 1, 'x');
    if (r.reason !== 'install_daily_cap') return 'order: want install_daily_cap got ' + r.reason;
    r = L.take(install('b'), 1, 'x');
    if (r.reason !== 'address_daily_cap') return 'order: want address_daily_cap got ' + r.reason;
    r = L.take(install('c'), 1, 'y');
    if (r.reason !== 'global_daily_questions') return 'order: want global_daily_questions got ' + r.reason;
    return true;
  });
  await leg('C4 the operator skips every user cap and meets only operator_daily_cap', () => {
    const { createLimits } = load('limits.cjs');
    const ck = clock(DAY0);
    const L = createLimits(cfgWith({ installPerMinute: 1, installDailyQuestions: 1, addressDailyQuestions: 1, globalDailyRequests: 1,
      globalDailyQuestions: 1, globalDailyInputTokens: 1, operatorDailyQuestions: 2500 }), ck.now);
    L.take(install('a'), 1, 'x');
    L.recordUsage(install('a'), 5);
    for (let i = 0; i < 2; i += 1) {
      const r = L.take(OPERATOR, 1000, 'x');
      if (!r.ok) return 'operator refused ' + JSON.stringify(r);
      L.recordUsage(OPERATOR, 99999);
    }
    const r = L.take(OPERATOR, 501, 'x');
    if (r.ok !== false || r.status !== 429 || r.reason !== 'operator_daily_cap') return JSON.stringify(r);
    if (!L.take(OPERATOR, 500, 'x').ok) return 'refused operator call counted';
    const s = L.snapshot();
    if (s.operatorQuestions !== 2500 || s.globalQuestions !== 1 || s.globalRequests !== 1) return 'snapshot ' + JSON.stringify(s);
    return true;
  });

  // ---------- C5 ----------
  await leg('C5 a new bucket on a full table refuses bucket_table_full; existing buckets still work; snapshot is counts only', () => {
    const { createLimits } = load('limits.cjs');
    const ck = clock(DAY0);
    const L = createLimits(cfgWith({ maxBuckets: 3 }), ck.now);
    for (const s of ['a', 'b', 'c']) if (!L.take(install(s), 1, '9.9.9.9').ok) return 'fill refused ' + s;
    const r = L.take(install('d'), 1, '9.9.9.9');
    if (r.ok !== false || r.status !== 429 || r.reason !== 'bucket_table_full') return JSON.stringify(r);
    if (!L.take(install('a'), 1, '9.9.9.9').ok) return 'existing bucket refused';
    // address table is bounded too
    const M = createLimits(cfgWith({ maxBuckets: 2 }), ck.now);
    M.take(install('a'), 1, '1.0.0.1'); M.take(install('b'), 1, '1.0.0.2');
    const r2 = M.take(install('a'), 1, '1.0.0.3');
    if (r2.reason !== 'bucket_table_full') return 'address table not bounded ' + JSON.stringify(r2);
    const s = L.snapshot();
    for (const k of Object.keys(s)) if (typeof s[k] !== 'number' && k !== 'day') return 'snapshot key ' + k + ' not a count';
    const text = JSON.stringify(s);
    if (text.indexOf('9.9.9.9') !== -1 || text.indexOf(install('a').bucket) !== -1) return 'snapshot holds an address or a bucket';
    if (s.installBuckets !== 3 || s.addressBuckets !== 1) return 'snapshot counts ' + text;
    const src = fs.readFileSync(path.join(REL, 'limits.cjs'), 'utf8');
    if (!/createHmac|createHash/.test(src)) return 'addresses are not hashed';
    return true;
  });

  // ---------- C6 ----------
  await leg('C6 the UTC day change resets every daily counter; daily Retry-After is the seconds to the next UTC midnight', () => {
    const { createLimits } = load('limits.cjs');
    const ck = clock(Date.UTC(2026, 10, 24, 23, 59, 0));
    const L = createLimits(cfgWith({ installDailyQuestions: 2, globalDailyRequests: 100, operatorDailyQuestions: 1, maxBuckets: 1 }), ck.now);
    if (!L.take(install('a'), 2, 'x').ok) return 'first refused';
    if (!L.take(OPERATOR, 1, 'x').ok) return 'operator first refused';
    ck.t += 30000; // 23:59:30
    const r = L.take(install('a'), 1, 'x');
    if (r.reason !== 'install_daily_cap' || r.retryAfterS !== 30) return 'daily ' + JSON.stringify(r);
    const o = L.take(OPERATOR, 1, 'x');
    if (o.reason !== 'operator_daily_cap' || o.retryAfterS !== 30) return 'operator ' + JSON.stringify(o);
    const f = L.take(install('z'), 1, 'x');
    if (f.reason !== 'bucket_table_full' || f.retryAfterS !== 30) return 'table full ' + JSON.stringify(f);
    ck.t = Date.UTC(2026, 10, 25, 0, 0, 1);
    const s0 = L.snapshot();
    if (s0.globalRequests !== 0 || s0.globalQuestions !== 0 || s0.operatorQuestions !== 0 || s0.installBuckets !== 0) return 'snapshot not reset ' + JSON.stringify(s0);
    if (!L.take(install('a'), 2, 'x').ok) return 'install not reset';
    if (!L.take(OPERATOR, 1, 'x').ok) return 'operator not reset';
    return true;
  });
  await leg('C1-C6 no npm require in the relay modules', () => {
    for (const f of fs.readdirSync(REL).filter((n) => n.endsWith('.cjs'))) {
      const src = fs.readFileSync(path.join(REL, f), 'utf8');
      const reqs = src.match(/require\((['"])([^'"]+)\1\)/g) || [];
      for (const r of reqs) {
        const m = /require\((['"])([^'"]+)\1\)/.exec(r)[2];
        if (!m.startsWith('node:') && !m.startsWith('.') && !m.startsWith('/')) return f + ' requires ' + m;
      }
    }
    return true;
  });

  // RELAY_LEGS_START
  await relayLegs();
  // RELAY_LEGS_END

  if (strayFetch !== 0) { fail += 1; console.log('FAIL: stray fetch calls: ' + strayFetch); }
  globalThis.fetch = realFetch;
  finished = true;
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.log('FAIL: main threw ' + String(e && e.stack ? e.stack : e)); process.exit(1); });
