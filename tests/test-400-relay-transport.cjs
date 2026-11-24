#!/usr/bin/env node
'use strict';
// Phase 400 plan 14 (RL-05, RL-03 client half; O-07, O-10): the decision relay as a third send mode of the one
// send path, proven on loopback capture servers only. No network, no real key, no real token.
//   T1 shipped policy: line off, 0 calls        T2 wire: path, headers, neutral chunk, redirect error
//   T3 no install id: no_install_id, no id file  T4 catalog_skew and relay_refused (closed reason list)
//   T5 chunking 1000 and answer checks           T6 a 307 is not followed
//   T7 the operator token env is not read without the flag   T8 the 399 and 366 legs still pass
// Only 127.0.0.1 is used. Scratch files are under os.tmpdir() and removed in finally. Hyphens only.
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const realFetch = globalThis.fetch;
// Any send path that skips the injected fetch lands on this thrower and is counted.
let strayFetch = 0;
globalThis.fetch = function stray() { strayFetch += 1; throw new Error('stray fetch in test-400-relay-transport'); };

const transport = require(path.join(REPO, 'scripts/decision-advisor-transport.cjs'));
const labels = require(path.join(REPO, 'lib/core/decision-advisor/labels-only.cjs'));
const relayMod = require(path.join(REPO, 'services/decision-relay/relay.cjs'));
const SAMPLE = path.join(REPO, 'tests/fixtures/399/neutral-request-sample.json');
const req3 = JSON.parse(fs.readFileSync(SAMPLE, 'utf8'));
const FP = labels.catalogFingerprint();
const TOKEN_ENV = 'MINDRIAN_DECISION_RELAY_OPERATOR_TOKEN';
const FAKE_TOKEN = 'fake-operator-token-400-' + require('node:crypto').randomBytes(6).toString('hex');
const INSTALL_ID = 'abcdef0123456789abcdef0123456789';

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-400-relay-transport-'));

let pass = 0;
let fail = 0;
async function leg(name, fn) {
  let ok;
  try { ok = await fn(); } catch (e) { ok = 'threw: ' + String(e && e.stack ? e.stack : e).slice(0, 400); }
  if (ok === true) { pass += 1; console.log('PASS: ' + name); } else { fail += 1; console.log('FAIL: ' + name + ' (' + String(ok) + ')'); }
}

function allowedPolicy() {
  return { schema: 'mos.egress-policy/1', offline: false, ignored: [], lines: { decision_advisor: { endpoint: 'x', default: true, scope: 'x', providers: [], allowed: true } } };
}

let homeN = 0;
function mkHome(withId) {
  homeN += 1;
  const dir = path.join(scratch, 'home-' + homeN);
  fs.mkdirSync(dir, { recursive: true });
  if (withId) fs.writeFileSync(path.join(dir, 'theo-install-id.json'), JSON.stringify({ id: INSTALL_ID, minted_at: '2026-11-24T00:00:00.000Z' }));
  return dir;
}

function bigRequest(n) {
  const cmds = ['/mos:validate', '/mos:mullins', '/mos:map-unknowns'];
  const questions = {};
  for (let i = 1; i <= n; i += 1) questions['q' + String(i).padStart(4, '0')] = { type: 'yes_no', template: 'serves_job_v1', subject: cmds[i % 3] };
  return { context: req3.context, questions };
}

function answerFor(q) {
  if (q.type === 'choice') return { type: 'choice', choice: 'none_of_these', probabilities: { none_of_these: 1 }, confidence: 0.5 };
  if (q.type === 'score') return { type: 'score', score: 0.5, probabilities: { 0: 0.2, 1: 0.3, 2: 0.5 }, confidence: 0.5 };
  return { type: 'yes_no', p: 0.5 };
}

function okReply(body) {
  const answers = {};
  if (body && body.questions) for (const id of Object.keys(body.questions)) answers[id] = answerFor(body.questions[id]);
  return { status: 200, json: { ok: true, answers, usage: { input_tokens: 7, output_tokens: 1 }, model: 'gemini-decision-1', catalog: FP } };
}

// A loopback relay stand-in. cap.reply(body) returns {status, json}; the default answers every question.
function startCapture() {
  const cap = { captured: [], reply: okReply };
  cap.server = http.createServer((rq, rs) => {
    const chunks = [];
    rq.on('data', (c) => chunks.push(c));
    rq.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      let body = null;
      try { body = JSON.parse(text); } catch (_e) { body = null; }
      cap.captured.push({ method: rq.method, url: rq.url, headers: rq.headers, body, text });
      const r = cap.reply(body);
      rs.statusCode = r.status;
      rs.setHeader('Content-Type', 'application/json');
      rs.end(JSON.stringify(r.json));
    });
  });
  return new Promise((resolve) => {
    cap.server.listen(0, '127.0.0.1', () => { cap.base = 'http://127.0.0.1:' + cap.server.address().port; resolve(cap); });
  });
}

function countingFetch() {
  const state = { calls: 0, inits: [], impl: null };
  state.impl = function counting(url, init) { state.calls += 1; state.inits.push(init); return realFetch(url, init); };
  return state;
}

function runNode(file) {
  return spawnSync(process.execPath, [path.join(REPO, file)], { encoding: 'utf8', cwd: REPO, env: Object.assign({}, process.env) });
}

(async function main() {
  const cap = await startCapture();
  try {
    await leg('T1 shipped policy: relay send returns egress_line_off with 0 fetch calls and 0 captured requests', async () => {
      const f = countingFetch();
      const home = mkHome(true);
      const r = await transport.send(req3, { provider: 'relay', base: cap.base, fetchImpl: f.impl, env: { MINDRIAN_HOME: home } });
      return (r.ok === false && r.reason === 'egress_line_off' && f.calls === 0 && cap.captured.length === 0 && strayFetch === 0) || JSON.stringify({ r, calls: f.calls });
    });

    await leg('T2 wire: one POST to /v1/decide, install id and catalog headers, no Authorization, neutral chunk body, redirect error', async () => {
      cap.captured.length = 0;
      cap.reply = okReply;
      const f = countingFetch();
      const home = mkHome(true);
      const r = await transport.send(req3, { provider: 'relay', base: cap.base, fetchImpl: f.impl, env: { MINDRIAN_HOME: home }, policy: allowedPolicy() });
      if (!r.ok || r.requests !== 1 || cap.captured.length !== 1 || f.calls !== 1) return JSON.stringify({ r, n: cap.captured.length, calls: f.calls });
      const got = cap.captured[0];
      const h = got.headers;
      if (got.method !== 'POST' || got.url !== '/v1/decide') return 'route ' + got.method + ' ' + got.url;
      if (h['content-type'] !== 'application/json') return 'content-type ' + h['content-type'];
      if (h['x-theo-install-id'] !== INSTALL_ID) return 'install id header ' + h['x-theo-install-id'];
      if (h['x-mindrian-catalog'] !== FP) return 'catalog header ' + h['x-mindrian-catalog'];
      if (h.authorization !== undefined) return 'authorization header sent';
      if (JSON.stringify(got.body) !== JSON.stringify(req3)) return 'body is not the neutral chunk';
      if (f.inits[0].redirect !== 'error') return 'redirect ' + f.inits[0].redirect;
      if (r.provider !== 'relay' || r.model !== 'gemini-decision-1' || r.answers.q0001.p !== 0.5 || r.usage.input_tokens !== 7) return 'result ' + JSON.stringify(r);
      return transport.RELAY_PATH === '/v1/decide' && transport.RELAY_MAX_QUESTIONS === 1000 && transport.PROVIDER_IDS.relay === 'decision_relay' || 'exports';
    });

    await leg('T3 no install id file: no_install_id with 0 calls; the script creates no id file', async () => {
      cap.captured.length = 0;
      const f = countingFetch();
      const home = mkHome(false);
      const r = await transport.send(req3, { provider: 'relay', base: cap.base, fetchImpl: f.impl, env: { MINDRIAN_HOME: home }, policy: allowedPolicy() });
      const left = fs.readdirSync(home);
      return (r.ok === false && r.reason === 'no_install_id' && f.calls === 0 && cap.captured.length === 0 && left.length === 0) || JSON.stringify({ r, left });
    });

    await leg('T4 409 with relay_catalog gives catalog_skew; a listed reason gives relay_refused; another reason gives status n', async () => {
      const home = mkHome(true);
      const opts = () => ({ provider: 'relay', base: cap.base, fetchImpl: countingFetch().impl, env: { MINDRIAN_HOME: home }, policy: allowedPolicy() });
      const other = 'b'.repeat(64);
      cap.reply = () => ({ status: 409, json: { ok: false, reason: 'catalog_skew', relay_catalog: other } });
      const a = await transport.send(req3, opts());
      cap.reply = () => ({ status: 422, json: { ok: false, reason: 'labels_only_refused', detail: 'x' } });
      const b = await transport.send(req3, opts());
      cap.reply = () => ({ status: 429, json: { ok: false, reason: 'install_rate' } });
      const c = await transport.send(req3, opts());
      cap.reply = () => ({ status: 429, json: { ok: false, reason: 'please send your notes' } });
      const d = await transport.send(req3, opts());
      cap.reply = okReply;
      const listed = JSON.stringify(transport.RELAY_REASONS) === JSON.stringify(relayMod.REASONS);
      return (a.ok === false && a.reason === 'catalog_skew' && a.detail === 'relay catalog ' + other &&
        b.reason === 'relay_refused' && b.detail === 'labels_only_refused' && c.reason === 'relay_refused' && c.detail === 'install_rate' &&
        d.reason === 'relay_refused' && d.detail === 'status 429' && listed) || JSON.stringify({ a, b, c, d, listed });
    });

    await leg('T5 2500 questions make 3 POSTs (1000, 1000, 500) and merge; a stray or mistyped answer gives bad_response', async () => {
      cap.captured.length = 0;
      cap.reply = okReply;
      const home = mkHome(true);
      const opts = () => ({ provider: 'relay', base: cap.base, fetchImpl: countingFetch().impl, env: { MINDRIAN_HOME: home }, policy: allowedPolicy() });
      const r = await transport.send(bigRequest(2500), opts());
      const sizes = cap.captured.map((c) => Object.keys(c.body.questions).length).join(',');
      cap.reply = (body) => { const x = okReply(body); x.json.answers.q9999 = { type: 'yes_no', p: 0.1 }; return x; };
      const stray = await transport.send(req3, opts());
      cap.reply = (body) => { const x = okReply(body); x.json.answers.q0001 = { type: 'choice', choice: 'a', probabilities: { a: 1 } }; return x; };
      const typed = await transport.send(req3, opts());
      cap.reply = (body) => { const x = okReply(body); x.json.answers.q0001 = { type: 'yes_no', p: 7 }; return x; };
      const range = await transport.send(req3, opts());
      cap.reply = okReply;
      return (r.ok && r.requests === 3 && sizes === '1000,1000,500' && Object.keys(r.answers).length === 2500 &&
        stray.reason === 'bad_response' && typed.reason === 'bad_response' && range.reason === 'bad_response') ||
        JSON.stringify({ ok: r.ok, sizes, stray, typed, range });
    });

    await leg('T6 a 307 from the relay is not followed: a second loopback server records 0 requests', async () => {
      let hitsB = 0;
      const serverB = http.createServer((rq, rs) => { hitsB += 1; rq.resume(); rs.end('{}'); });
      await new Promise((r) => serverB.listen(0, '127.0.0.1', r));
      const urlB = 'http://127.0.0.1:' + serverB.address().port + '/v1/decide';
      const serverA = http.createServer((rq, rs) => { rq.resume(); rs.statusCode = 307; rs.setHeader('Location', urlB); rs.end(); });
      await new Promise((r) => serverA.listen(0, '127.0.0.1', r));
      try {
        const home = mkHome(true);
        const r = await transport.send(req3, { provider: 'relay', base: 'http://127.0.0.1:' + serverA.address().port, fetchImpl: realFetch, sleepImpl: async () => {}, env: { MINDRIAN_HOME: home }, policy: allowedPolicy() });
        return (r.ok === false && r.reason === 'http_error' && hitsB === 0) || JSON.stringify({ r, hitsB });
      } finally {
        await new Promise((r) => serverA.close(r));
        await new Promise((r) => serverB.close(r));
      }
    });

    await leg('T7 the operator token in the env without the flag: no Authorization header, the install id header is sent', async () => {
      cap.captured.length = 0;
      cap.reply = okReply;
      const home = mkHome(true);
      const env = { MINDRIAN_HOME: home, [TOKEN_ENV]: FAKE_TOKEN };
      const r = await transport.send(req3, { provider: 'relay', base: cap.base, fetchImpl: countingFetch().impl, env, policy: allowedPolicy() });
      const h = cap.captured[0] && cap.captured[0].headers;
      return (r.ok && h && h.authorization === undefined && h['x-theo-install-id'] === INSTALL_ID && h['x-mindrian-catalog'] === FP &&
        JSON.stringify(r).indexOf(FAKE_TOKEN) === -1) || JSON.stringify({ r, h });
    });

    await leg('T8 the 399 transport capture, the 399 egress line and the 366 egress policy tests still pass', async () => {
      const bad = [];
      for (const t of ['tests/test-399-transport-capture.cjs', 'tests/test-399-egress-line.cjs', 'tests/test-366-egress-policy.cjs']) {
        const r = runNode(t);
        if (r.status !== 0) bad.push(t + ' exit ' + r.status + ' ' + String(r.stdout).split('\n').filter((l) => /FAIL/.test(l)).join(' | ').slice(0, 300));
      }
      return bad.length === 0 || bad.join('; ');
    });

    if (strayFetch !== 0) { fail += 1; console.log('FAIL: stray fetch count ' + strayFetch); }
  } finally {
    await new Promise((r) => cap.server.close(r));
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  console.log('--- test-400-relay-transport ---');
  console.log('PASS: ' + pass + ' FAIL: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
})();
