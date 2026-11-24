#!/usr/bin/env node
'use strict';
// Phase 400 plan 14 (RL-05, RL-03 client half; O-07, O-10): the decision relay as a third send mode of the one
// send path, proven on loopback capture servers only. No network, no real key, no real token.
//   T1 shipped policy: line off, 0 calls        T2 wire: path, headers, neutral chunk, redirect error
//   T3 no install id: no_install_id, no id file  T4 catalog_skew and relay_refused (closed reason list)
//   T5 chunking 1000 and answer checks           T6 a 307 is not followed
//   T7 the operator token env is not read without the flag   T8 the 399 and 366 legs still pass
//   O1 flag without token: exit 5, no call, no audit   O2 flag with gemini or jev: usage, exit 2
//   O3 flag plus token: Bearer only, in-memory policy, printed line and exact body before each POST
//   O4 one audit record, 0600 in 0700, no token, key or body; a refused run also writes one
//   O5 the token is never in stdout, stderr, the result or the audit file   O6 no env sets the flag
//   E1 the release request set: 20 files, 73 serves_job_v1 questions each   E2 --out pairs feed derive-decision-fixture
//   E3 end to end on loopback through the real relay server and a fake upstream   E4 no data/ file changes
// Only 127.0.0.1 is used. Scratch files are under os.tmpdir() and removed in finally. Hyphens only.
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');

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
const FAKE_TOKEN = 'fake-operator-token-400-' + crypto.randomBytes(6).toString('hex');
const CLI = path.join(REPO, 'scripts/decision-advisor-transport.cjs');
const POLICY_FILE = path.join(REPO, 'data/egress-policy.json');
const BUILDER = path.join(REPO, 'scripts/build-relay-release-requests.cjs');
const DERIVE = path.join(REPO, 'scripts/derive-decision-fixture.cjs');
const DATA_PINS = ['data/decision-advisor-table.json', 'data/egress-policy.json'];
const AUDIT_NAME_RE = /^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}\.json$/;
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

// Async child run, so the in-process capture server keeps answering while the child sends.
function runCli(args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI].concat(args), {
      cwd: scratch,
      env: Object.assign({ PATH: process.env.PATH, HOME: scratch, USERPROFILE: scratch }, env || {}),
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

function collector() {
  const c = { text: '', write(x) { c.text += String(x); return true; } };
  return c;
}

function auditFiles(home) {
  const dir = path.join(home, 'decision-relay-audit');
  if (!fs.existsSync(dir)) return { dir, names: [] };
  return { dir, names: fs.readdirSync(dir) };
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
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

    await leg('O1 --operator-release-run without the token: exit 5, operator_token_missing, 0 requests, no audit file', async () => {
      cap.captured.length = 0;
      const home = mkHome(true);
      const r = await runCli(['--provider', 'relay', '--operator-release-run', '--request', SAMPLE, '--base', cap.base], { MINDRIAN_HOME: home });
      const a = auditFiles(home);
      return (r.status === 5 && /operator_token_missing/.test(r.stdout + r.stderr) && cap.captured.length === 0 && a.names.length === 0 &&
        !fs.existsSync(a.dir)) || JSON.stringify({ status: r.status, err: r.stderr, n: cap.captured.length, a });
    });

    await leg('O2 --operator-release-run with --provider gemini or jev is a usage error, exit 2', async () => {
      const env = { [TOKEN_ENV]: FAKE_TOKEN, MINDRIAN_HOME: mkHome(true) };
      const g = await runCli(['--provider', 'gemini', '--operator-release-run', '--request', SAMPLE, '--base', cap.base], env);
      const j = await runCli(['--provider', 'jev', '--operator-release-run', '--request', SAMPLE, '--base', cap.base], env);
      return (g.status === 2 && /usage error/.test(g.stderr) && j.status === 2 && /usage error/.test(j.stderr)) || JSON.stringify({ g: g.status, j: j.status });
    });

    let o3 = null;
    await leg('O3 flag plus token: Bearer token, no install id header, in-memory policy, a printed line and the exact body before each POST', async () => {
      cap.captured.length = 0;
      cap.reply = okReply;
      const before = fs.readFileSync(POLICY_FILE);
      const home = mkHome(true);
      const out = collector();
      const req = bigRequest(1500);
      const r = await transport.send(req, { provider: 'relay', operatorReleaseRun: true, base: cap.base, fetchImpl: countingFetch().impl,
        env: { MINDRIAN_HOME: home, [TOKEN_ENV]: FAKE_TOKEN }, out });
      o3 = { r, home, out: out.text };
      const after = fs.readFileSync(POLICY_FILE);
      if (!r.ok || cap.captured.length !== 2) return JSON.stringify({ r, n: cap.captured.length });
      for (const c of cap.captured) {
        if (c.headers.authorization !== 'Bearer ' + FAKE_TOKEN) return 'authorization header wrong';
        if (c.headers['x-theo-install-id'] !== undefined) return 'install id header sent on an operator run';
        if (c.headers['x-mindrian-catalog'] !== FP) return 'catalog header';
      }
      if (!before.equals(after)) return 'shipped policy file changed';
      const lines = out.text.split('\n').filter((l) => l.length > 0);
      const want = [
        'decision relay release run: chunk 1 of 2, 1000 questions, to ' + cap.base + '/v1/decide',
        cap.captured[0].text,
        'decision relay release run: chunk 2 of 2, 500 questions, to ' + cap.base + '/v1/decide',
        cap.captured[1].text,
      ];
      return JSON.stringify(lines) === JSON.stringify(want) || 'printed lines differ: ' + JSON.stringify(lines.map((l) => l.slice(0, 90)));
    });

    await leg('O4 one audit record, mode 0600 in a 0700 dir, fixed keys, no token, no key, no body; a catalog_skew run also writes one', async () => {
      if (!o3) return 'O3 did not run';
      const a = auditFiles(o3.home);
      if (a.names.length !== 1 || !AUDIT_NAME_RE.test(a.names[0])) return 'audit names ' + JSON.stringify(a.names);
      const file = path.join(a.dir, a.names[0]);
      const posix = process.platform !== 'win32';
      if (posix && (fs.statSync(file).mode & 0o777) !== 0o600) return 'file mode ' + (fs.statSync(file).mode & 0o777).toString(8);
      if (posix && (fs.statSync(a.dir).mode & 0o777) !== 0o700) return 'dir mode ' + (fs.statSync(a.dir).mode & 0o777).toString(8);
      const text = fs.readFileSync(file, 'utf8');
      const rec = JSON.parse(text);
      const keys = Object.keys(rec).sort().join(',');
      if (keys !== 'at,base_origin,catalog,chunks,ok,operator_release_run,path,schema,totals') return 'keys ' + keys;
      if (rec.schema !== 'mos.decision-relay-audit/1' || rec.operator_release_run !== true || rec.ok !== true) return 'header ' + text.slice(0, 200);
      if (rec.base_origin !== cap.base || rec.path !== '/v1/decide' || rec.catalog !== FP || Number.isNaN(Date.parse(rec.at))) return 'fields ' + text.slice(0, 300);
      const shas = cap.captured.map((c) => sha256(c.text));
      const chunksOk = Array.isArray(rec.chunks) && rec.chunks.length === 2 &&
        rec.chunks.every((c, i) => Object.keys(c).sort().join(',') === 'body_sha256,questions,reason,status' && c.body_sha256 === shas[i] && c.status === 200 && c.reason === null) &&
        rec.chunks[0].questions === 1000 && rec.chunks[1].questions === 500;
      if (!chunksOk) return 'chunks ' + JSON.stringify(rec.chunks);
      if (rec.totals.questions !== 1500 || rec.totals.input_tokens !== 14 || rec.totals.output_tokens !== 2) return 'totals ' + JSON.stringify(rec.totals);
      if (text.indexOf(FAKE_TOKEN) !== -1 || text.indexOf('/mos:') !== -1 || text.indexOf(req3.context.job_summary) !== -1) return 'audit holds a token or body text';
      // a refused run after the flag check
      cap.captured.length = 0;
      cap.reply = () => ({ status: 409, json: { ok: false, reason: 'catalog_skew', relay_catalog: 'c'.repeat(64) } });
      const home2 = mkHome(false);
      const r2 = await transport.send(req3, { provider: 'relay', operatorReleaseRun: true, base: cap.base, fetchImpl: countingFetch().impl,
        env: { MINDRIAN_HOME: home2, [TOKEN_ENV]: FAKE_TOKEN }, out: collector() });
      cap.reply = okReply;
      const a2 = auditFiles(home2);
      if (r2.reason !== 'catalog_skew' || a2.names.length !== 1) return 'skew run ' + JSON.stringify({ r2, a2 });
      const rec2 = JSON.parse(fs.readFileSync(path.join(a2.dir, a2.names[0]), 'utf8'));
      return (rec2.ok === false && rec2.chunks.length === 1 && rec2.chunks[0].status === 409 && rec2.chunks[0].reason === 'catalog_skew' &&
        rec2.totals.questions === 3) || JSON.stringify(rec2);
    });

    await leg('O5 the token never appears in stdout, stderr, the returned object or the audit file (child process run)', async () => {
      cap.captured.length = 0;
      cap.reply = okReply;
      const home = mkHome(false);
      const r = await runCli(['--provider', 'relay', '--operator-release-run', '--request', SAMPLE, '--base', cap.base], { MINDRIAN_HOME: home, [TOKEN_ENV]: FAKE_TOKEN });
      const a = auditFiles(home);
      const auditText = a.names.map((n) => fs.readFileSync(path.join(a.dir, n), 'utf8')).join('\n');
      const blob = r.stdout + r.stderr + auditText + JSON.stringify(o3 && o3.r) + (o3 ? o3.out : '');
      return (r.status === 0 && cap.captured.length === 1 && a.names.length === 1 && blob.indexOf(FAKE_TOKEN) === -1 &&
        cap.captured[0].headers.authorization === 'Bearer ' + FAKE_TOKEN) || JSON.stringify({ status: r.status, err: r.stderr.slice(0, 200), n: cap.captured.length, leaked: blob.indexOf(FAKE_TOKEN) !== -1 });
    });

    await leg('O6 no env variable sets the flag: env names like the flag plus the token change nothing (exit 4, 0 requests, no audit)', async () => {
      cap.captured.length = 0;
      const home = mkHome(true);
      const env = {
        MINDRIAN_HOME: home, [TOKEN_ENV]: FAKE_TOKEN, OPERATOR_RELEASE_RUN: '1', MINDRIAN_OPERATOR_RELEASE_RUN: '1',
        MINDRIAN_DECISION_RELAY_OPERATOR_RELEASE_RUN: 'true', npm_config_operator_release_run: 'true', '--operator-release-run': '1',
      };
      const r = await runCli(['--provider', 'relay', '--request', SAMPLE, '--base', cap.base], env);
      const inproc = await transport.send(req3, { provider: 'relay', base: cap.base, fetchImpl: countingFetch().impl, env });
      return (r.status === 4 && /egress_line_off/.test(r.stdout + r.stderr) && inproc.reason === 'egress_line_off' && cap.captured.length === 0 &&
        auditFiles(home).names.length === 0) || JSON.stringify({ status: r.status, inproc, n: cap.captured.length });
    });

    const dataBefore = DATA_PINS.map((p) => fs.readFileSync(path.join(REPO, p)));
    const reqDir = path.join(scratch, 'release-requests');
    let reqFiles = [];
    await leg('E1 the release request set: one file per vocabulary job (20), 73 serves_job_v1 questions q0001..q0073 in registry order, all valid', async () => {
      const r = spawnSync(process.execPath, [BUILDER, '--out-dir', reqDir], { encoding: 'utf8', cwd: scratch, env: { PATH: process.env.PATH, HOME: scratch } });
      if (r.status !== 0) return 'builder exit ' + r.status + ' ' + String(r.stderr).slice(0, 200);
      const vocab = JSON.parse(fs.readFileSync(path.join(REPO, 'data/job-vocabulary.json'), 'utf8'));
      const scope = new Set(JSON.parse(fs.readFileSync(path.join(REPO, 'data/run-step-capabilities.json'), 'utf8')).commands);
      const registry = JSON.parse(fs.readFileSync(path.join(REPO, 'data/command-registry.json'), 'utf8'));
      const order = registry.commands.map((c) => c.command).filter((c) => scope.has(c));
      const names = fs.readdirSync(reqDir).sort();
      const want = vocab.ids.map((id) => id + '.json').sort();
      if (JSON.stringify(names) !== JSON.stringify(want) || names.length !== 20) return 'files ' + JSON.stringify(names);
      const cat = labels.buildLabelCatalog();
      for (const id of vocab.ids) {
        const req = JSON.parse(fs.readFileSync(path.join(reqDir, id + '.json'), 'utf8'));
        if (Object.keys(req).sort().join(',') !== 'context,questions') return id + ' keys';
        if (Object.keys(req.context).sort().join(',') !== 'job_id,job_summary' || req.context.job_id !== id || req.context.job_summary !== vocab.jobs[id].summary) return id + ' context';
        const ids = Object.keys(req.questions);
        if (ids.length !== 73 || order.length !== 73) return id + ' count ' + ids.length;
        for (let i = 0; i < ids.length; i += 1) {
          const q = req.questions[ids[i]];
          if (ids[i] !== 'q' + String(i + 1).padStart(4, '0') || q.type !== 'yes_no' || q.template !== 'serves_job_v1' || q.subject !== order[i]) return id + ' question ' + ids[i];
        }
        const v = labels.validateNeutralRequest(req, cat);
        if (!v.ok) return id + ' invalid ' + v.reason;
      }
      reqFiles = vocab.ids.slice(0, 2).map((id) => path.join(reqDir, id + '.json'));
      return true;
    });

    await leg('E2 transport --out (repeated --request) writes {pairs} of the serves_job_v1 answers; derive-decision-fixture accepts it', async () => {
      if (reqFiles.length !== 2) return 'E1 did not run';
      cap.captured.length = 0;
      cap.reply = okReply;
      const home = mkHome(false);
      const pairsFile = path.join(scratch, 'e2-pairs.json');
      const r = await runCli(['--provider', 'relay', '--operator-release-run', '--request', reqFiles[0], '--request', SAMPLE, '--base', cap.base, '--out', pairsFile],
        { MINDRIAN_HOME: home, [TOKEN_ENV]: FAKE_TOKEN });
      if (r.status !== 0) return 'transport exit ' + r.status + ' ' + r.stderr.slice(0, 200);
      const doc = JSON.parse(fs.readFileSync(pairsFile, 'utf8'));
      const job0 = path.basename(reqFiles[0], '.json');
      const pairsOk = Object.keys(doc).join(',') === 'pairs' && doc.pairs.length === 74 &&
        doc.pairs.every((p) => Object.keys(p).sort().join(',') === 'command,job,p' && p.p === 0.5) &&
        doc.pairs.filter((p) => p.job === job0).length === 73 && doc.pairs.filter((p) => p.job === req3.context.job_id && p.command === '/mos:validate').length === 1;
      if (!pairsOk) return 'pairs ' + JSON.stringify(doc).slice(0, 200);
      if (!/skipped 2 answers/.test(r.stderr)) return 'skip count not on stderr: ' + r.stderr.slice(0, 200);
      const fixture = path.join(scratch, 'e2-fixture.json');
      const d = spawnSync(process.execPath, [DERIVE, '--source', pairsFile, '--out', fixture], { encoding: 'utf8', cwd: scratch });
      return (d.status === 0 && /wrote 74 pairs/.test(d.stdout) && JSON.parse(fs.readFileSync(fixture, 'utf8')).pairs.length === 74) || 'derive exit ' + d.status + ' ' + d.stderr;
    });

    await leg('E3 end to end on loopback: operator run through the real relay server to a fake upstream; bodies equal the server render; fixture and audit', async () => {
      if (reqFiles.length !== 2) return 'E1 did not run';
      const { createServer } = require(path.join(REPO, 'services/decision-relay/server.cjs'));
      const adapter = require(path.join(REPO, 'lib/core/decision-advisor/adapter.cjs'));
      const upstreamSeen = [];
      const upstream = http.createServer((rq, rs) => {
        const chunks = [];
        rq.on('data', (c) => chunks.push(c));
        rq.on('end', () => {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          upstreamSeen.push({ url: rq.url, key: rq.headers['x-goog-api-key'], body });
          const answers = {};
          for (const id of Object.keys(body.questions)) answers[id] = { noul: 0.625 };
          rs.setHeader('Content-Type', 'application/json');
          rs.end(JSON.stringify({ answers, usage: { total_input_tokens: 50, total_output_tokens: 5 } }));
        });
      });
      await new Promise((r) => upstream.listen(0, '127.0.0.1', r));
      const relayServer = createServer({
        env: { GEMINI_API_KEY: 'fake-gemini-key-400-14', RELAY_OPERATOR_TOKEN_SHA256: sha256(FAKE_TOKEN) },
        upstreamOrigin: 'http://127.0.0.1:' + upstream.address().port,
        fetchImpl: realFetch,
        log: () => {},
      });
      await new Promise((r) => relayServer.listen(0, '127.0.0.1', r));
      try {
        const home = mkHome(false);
        const pairsFile = path.join(scratch, 'e3-pairs.json');
        const relayBase = 'http://127.0.0.1:' + relayServer.address().port;
        const r = await runCli(['--provider', 'relay', '--operator-release-run', '--request', reqFiles[0], '--request', reqFiles[1], '--base', relayBase, '--out', pairsFile],
          { MINDRIAN_HOME: home, [TOKEN_ENV]: FAKE_TOKEN });
        if (r.status !== 0) return 'transport exit ' + r.status + ' ' + r.stderr.slice(0, 300);
        if (upstreamSeen.length !== 2) return 'upstream saw ' + upstreamSeen.length;
        for (let i = 0; i < 2; i += 1) {
          const req = JSON.parse(fs.readFileSync(reqFiles[i], 'utf8'));
          const expected = adapter.PROVIDERS.gemini.buildBody(adapter.renderRequest(req));
          if (JSON.stringify(upstreamSeen[i].body) !== JSON.stringify(expected)) return 'upstream body ' + i + ' is not the server render';
          if (upstreamSeen[i].url !== '/v1beta/decisions' || upstreamSeen[i].key !== 'fake-gemini-key-400-14') return 'upstream route or key header';
        }
        const fixture = path.join(scratch, 'e3-fixture.json');
        const d = spawnSync(process.execPath, [DERIVE, '--source', pairsFile, '--out', fixture], { encoding: 'utf8', cwd: scratch });
        if (d.status !== 0) return 'derive exit ' + d.status;
        const fx = JSON.parse(fs.readFileSync(fixture, 'utf8'));
        if (fx.pairs.length !== 146 || !fx.pairs.every((p) => p.p === 0.625)) return 'fixture pairs ' + fx.pairs.length;
        const a = auditFiles(home);
        if (a.names.length !== 2) return 'audit files ' + a.names.length;
        const recs = a.names.map((n) => JSON.parse(fs.readFileSync(path.join(a.dir, n), 'utf8')));
        return recs.every((x) => x.ok === true && x.totals.questions === 73 && x.totals.input_tokens === 50 && x.chunks[0].status === 200) || JSON.stringify(recs[0]);
      } finally {
        await new Promise((r) => relayServer.close(r));
        await new Promise((r) => upstream.close(r));
      }
    });

    await leg('E4 no file under data/ changes during E1 to E3 (decision-advisor-table.json, egress-policy.json)', async () => {
      const after = DATA_PINS.map((p) => fs.readFileSync(path.join(REPO, p)));
      return after.every((b, i) => b.equals(dataBefore[i])) || 'a data file changed';
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
