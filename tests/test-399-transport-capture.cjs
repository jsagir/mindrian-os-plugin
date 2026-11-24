#!/usr/bin/env node
'use strict';
// Phase 399 plan 05 task 2 (I-04, I-11, D-03): the dev-time decision transport proven on a loopback capture server.
//   T1 shipped policy: line off, zero fetch calls          T2 invalid request refused before the policy check
//   T3 wire equals the provider render, headers per provider   T4 chunking on the wire (1000 gemini, 20 jev)
//   T5 key never in a body, result, stdout or stderr       T6 no key: no_key, except keyless loopback jev
//   T7 gemini with PATH null off loopback: endpoint_unconfirmed   T8 CLI dry-run and refused send
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
globalThis.fetch = function stray() { strayFetch += 1; throw new Error('stray fetch in test-399-transport-capture'); };

const transport = require(path.join(REPO, 'scripts/decision-advisor-transport.cjs'));
const adapter = require(path.join(REPO, 'lib/core/decision-advisor/adapter.cjs'));
const labels = require(path.join(REPO, 'lib/core/decision-advisor/labels-only.cjs'));
const SAMPLE = path.join(REPO, 'tests/fixtures/399/neutral-request-sample.json');
const CLI = path.join(REPO, 'scripts/decision-advisor-transport.cjs');
const req3 = JSON.parse(fs.readFileSync(SAMPLE, 'utf8'));

const GKEY = 'test-gemini-key-399-aaaa1111';
const JKEY = 'test-jev-key-399-bbbb2222';
const ENV = { GEMINI_API_KEY: GKEY, TYPESAFE_API_KEY: JKEY };
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-399-transport-'));

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

function bigRequest(n) {
  const cmds = ['/mos:validate', '/mos:mullins', '/mos:map-unknowns'];
  const questions = {};
  for (let i = 1; i <= n; i += 1) questions['q' + String(i).padStart(4, '0')] = { type: 'yes_no', template: 'serves_job_v1', subject: cmds[i % 3] };
  return { context: req3.context, questions };
}

function answerFor(q) {
  if (q.type === 'noul') return { type: 'noul', noul: 0.5 };
  if (q.type === 'choice') {
    const keys = Object.keys(q.criteria);
    const probabilities = {};
    keys.forEach((k) => { probabilities[k] = 1 / keys.length; });
    return { type: 'choice', choice: keys[0], probabilities, confidence: 0.5 };
  }
  return { type: 'score', score: 0.5, probabilities: { 0: 0.2, 1: 0.3, 2: 0.5 }, confidence: 0.5 };
}

function startCapture() {
  const captured = [];
  const server = http.createServer((rq, rs) => {
    const chunks = [];
    rq.on('data', (c) => chunks.push(c));
    rq.on('end', () => {
      let body = null;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (_e) { body = null; }
      captured.push({ url: rq.url, headers: rq.headers, body });
      const answers = {};
      if (body && body.questions) for (const id of Object.keys(body.questions)) answers[id] = answerFor(body.questions[id]);
      rs.setHeader('Content-Type', 'application/json');
      rs.end(JSON.stringify({ answers, usage: { input_tokens: 7, total_input_tokens: 7 } }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, captured, base: 'http://127.0.0.1:' + server.address().port }));
  });
}

function countingFetch() {
  const state = { calls: 0, impl: null };
  state.impl = function counting(url, init) { state.calls += 1; return realFetch(url, init); };
  return state;
}

function leaves(v, out) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => leaves(x, out));
  else if (v && typeof v === 'object') Object.keys(v).forEach((k) => leaves(v[k], out));
  return out;
}

function runCli(args, env) {
  return spawnSync(process.execPath, [CLI].concat(args), {
    encoding: 'utf8',
    cwd: scratch,
    env: Object.assign({ PATH: process.env.PATH, HOME: scratch, USERPROFILE: scratch }, env || {}),
  });
}

(async function main() {
  const cap = await startCapture();
  try {
    await leg('T1 shipped policy: line off, 0 fetch calls (gemini and jev)', async () => {
      const f = countingFetch();
      const a = await transport.send(req3, { provider: 'gemini', fetchImpl: f.impl, env: ENV, base: cap.base });
      const b = await transport.send(req3, { provider: 'jev', fetchImpl: f.impl, env: ENV, base: cap.base });
      return (a.ok === false && a.reason === 'egress_line_off' && b.ok === false && b.reason === 'egress_line_off' && f.calls === 0 && strayFetch === 0 && cap.captured.length === 0) ||
        JSON.stringify({ a, b, calls: f.calls });
    });

    await leg('T2 invalid request: labels_only_refused before the policy check, 0 fetch calls', async () => {
      const f = countingFetch();
      const bad = JSON.parse(JSON.stringify(req3));
      bad.context.job_summary = 'Please read my private notes about the lab.';
      const a = await transport.send(bad, { provider: 'jev', fetchImpl: f.impl, env: ENV, base: cap.base });
      const b = await transport.send(bad, { provider: 'gemini', fetchImpl: f.impl, env: ENV, base: cap.base, policy: allowedPolicy() });
      return (a.ok === false && a.reason === 'labels_only_refused' && typeof a.detail === 'string' && a.detail.length > 0 &&
        b.reason === 'labels_only_refused' && f.calls === 0 && cap.captured.length === 0) || JSON.stringify({ a, b });
    });

    await leg('T3 wire equals the provider render; headers per provider; only label strings', async () => {
      const cat = labels.buildLabelCatalog();
      const out = {};
      for (const p of ['gemini', 'jev']) {
        cap.captured.length = 0;
        const f = countingFetch();
        const r = await transport.send(req3, { provider: p, fetchImpl: f.impl, env: ENV, base: cap.base, policy: allowedPolicy() });
        if (!r.ok || r.requests !== 1 || cap.captured.length !== 1 || f.calls !== 1) return p + ' send: ' + JSON.stringify({ r, n: cap.captured.length, calls: f.calls });
        const got = cap.captured[0];
        const expected = adapter.PROVIDERS[p].buildBody(adapter.renderRequest(req3));
        if (JSON.stringify(got.body) !== JSON.stringify(expected)) return p + ': wire body differs from the provider render';
        if (p === 'jev' && got.headers.authorization !== 'Bearer ' + JKEY) return 'jev authorization header wrong';
        if (p === 'gemini' && got.headers['x-goog-api-key'] !== GKEY) return 'gemini key header wrong';
        if (p === 'gemini' && got.headers.authorization) return 'gemini sent an authorization header';
        if (p === 'jev' && got.url !== '/v1/systemone') return 'jev path ' + got.url;
        if (!r.answers || Object.keys(r.answers).length !== 3 || r.answers.q0001.p !== 0.5) return p + ': answers not parsed ' + JSON.stringify(r.answers);
        const allowed = new Set([adapter.PROVIDERS[p].MODEL, 'jev-latest', 'noul', 'choice', 'score', adapter.NONE_OPTION_ID]);
        for (const id of Object.keys(req3.questions)) allowed.add(id);
        for (const [id, text] of cat.commands) { allowed.add(id); allowed.add(text); }
        for (const l of adapter.QUESTION_TEMPLATES.fit_score_v1.levels) allowed.add(l);
        allowed.add(adapter.NONE_OPTION_GLOSS);
        const ctxLeaf = got.body[adapter.PROVIDERS[p].REQUEST_FIELD];
        if (ctxLeaf !== adapter.renderContext(req3.context, cat)) return 'context leaf is not the rendered context';
        const prefixes = [adapter.QUESTION_TEMPLATES.serves_job_v1.prefix, adapter.QUESTION_TEMPLATES.fit_score_v1.prefix];
        const stray = leaves(got.body.questions, []).filter((s) => !allowed.has(s) && s !== adapter.QUESTION_TEMPLATES.next_command_v1.instructions &&
          !prefixes.some((pre) => s.startsWith(pre) && cat.commands.has(s.slice(pre.length).split(': ')[0])));
        if (stray.length) return p + ' stray string leaves: ' + JSON.stringify(stray);
        out[p] = true;
      }
      return (out.gemini && out.jev) || JSON.stringify(out);
    });

    await leg('T4 chunking on the wire: 1500 to gemini make 2 POSTs (1000, 500); 45 to jev make 3 POSTs (20, 20, 5)', async () => {
      cap.captured.length = 0;
      const g = await transport.send(bigRequest(1500), { provider: 'gemini', fetchImpl: countingFetch().impl, env: ENV, base: cap.base, policy: allowedPolicy() });
      const gs = cap.captured.map((c) => Object.keys(c.body.questions).length);
      cap.captured.length = 0;
      const j = await transport.send(bigRequest(45), { provider: 'jev', fetchImpl: countingFetch().impl, env: ENV, base: cap.base, policy: allowedPolicy() });
      const js = cap.captured.map((c) => Object.keys(c.body.questions).length);
      return (g.ok && g.requests === 2 && gs.join(',') === '1000,500' && Object.keys(g.answers).length === 1500 &&
        j.ok && j.requests === 3 && js.join(',') === '20,20,5' && Object.keys(j.answers).length === 45) || JSON.stringify({ gs, js, g: g.ok, j: j.ok });
    });

    await leg('T5 the key never appears in a body, a result, stdout or stderr', async () => {
      cap.captured.length = 0;
      const results = [];
      for (const p of ['gemini', 'jev']) results.push(await transport.send(req3, { provider: p, fetchImpl: countingFetch().impl, env: ENV, base: cap.base, policy: allowedPolicy() }));
      const noKey = await transport.send(req3, { provider: 'gemini', fetchImpl: countingFetch().impl, env: {}, base: cap.base, policy: allowedPolicy() });
      const blob = JSON.stringify(results) + JSON.stringify(noKey) + JSON.stringify(cap.captured.map((c) => c.body));
      const dry = runCli(['--provider', 'jev', '--request', SAMPLE, '--dry-run'], ENV);
      const refused = runCli(['--provider', 'jev', '--request', SAMPLE], ENV);
      const refusedG = runCli(['--provider', 'gemini', '--request', SAMPLE], ENV);
      const streams = [dry, refused, refusedG].map((r) => String(r.stdout) + String(r.stderr)).join('\n');
      const leaked = [GKEY, JKEY].some((k) => blob.indexOf(k) !== -1 || streams.indexOf(k) !== -1);
      return !leaked || 'key value found in output';
    });

    await leg('T6 no key: no_key with 0 fetch calls; keyless loopback jev sends without a key', async () => {
      const f = countingFetch();
      const a = await transport.send(req3, { provider: 'gemini', fetchImpl: f.impl, env: {}, base: cap.base, policy: allowedPolicy() });
      const b = await transport.send(req3, { provider: 'jev', fetchImpl: f.impl, env: {}, base: 'https://example.invalid', policy: allowedPolicy() });
      const callsAfterRefusals = f.calls;
      cap.captured.length = 0;
      const c = await transport.send(req3, { provider: 'jev', fetchImpl: f.impl, env: {}, base: cap.base, policy: allowedPolicy() });
      const sent = cap.captured[0];
      return (a.reason === 'no_key' && b.reason === 'no_key' && callsAfterRefusals === 0 && c.ok === true && cap.captured.length === 1 &&
        !sent.headers.authorization && sent.url === '/v1/systemone' && f.calls === 1) || JSON.stringify({ a, b, c, callsAfterRefusals });
    });

    await leg('T7 gemini with PATH null off loopback: endpoint_unconfirmed, 0 fetch calls', async () => {
      const f = countingFetch();
      const a = await transport.send(req3, { provider: 'gemini', fetchImpl: f.impl, env: ENV, base: 'https://example.invalid', policy: allowedPolicy() });
      const b = await transport.send(req3, { provider: 'gemini', fetchImpl: f.impl, env: ENV, policy: allowedPolicy() });
      const c = await transport.send(req3, { provider: 'jev', fetchImpl: f.impl, env: ENV, policy: allowedPolicy() });
      return (adapter.PROVIDERS.gemini.PATH === null ? (a.reason === 'endpoint_unconfirmed' && b.reason === 'endpoint_unconfirmed') : true) &&
        c.reason === 'endpoint_unconfirmed' && f.calls === 0 || JSON.stringify({ a, b, c });
    });

    await leg('T8 CLI: dry-run prints the validated body, exit 0; a send with the shipped policy exits 4 with egress_line_off', async () => {
      const dry = runCli(['--provider', 'jev', '--request', SAMPLE, '--dry-run'], {});
      let body = null;
      try { body = JSON.parse(dry.stdout); } catch (_e) { body = null; }
      const expected = adapter.PROVIDERS.jev.buildBody(adapter.renderRequest(req3));
      const send = runCli(['--provider', 'jev', '--request', SAMPLE], ENV);
      const badReq = path.join(scratch, 'bad.json');
      const bad = JSON.parse(JSON.stringify(req3));
      bad.context.job_summary = 'free text';
      fs.writeFileSync(badReq, JSON.stringify(bad));
      const refused = runCli(['--provider', 'jev', '--request', badReq], ENV);
      const usage = runCli(['--provider', 'nope', '--request', SAMPLE], ENV);
      return (dry.status === 0 && body && JSON.stringify(body) === JSON.stringify(expected) &&
        send.status === 4 && /egress_line_off/.test(send.stdout + send.stderr) &&
        refused.status === 2 && /labels_only_refused/.test(refused.stdout + refused.stderr) && usage.status === 2) ||
        JSON.stringify({ dry: dry.status, send: send.status, refused: refused.status, usage: usage.status });
    });

    await leg('T9 no stray fetch ever reached the global', async () => strayFetch === 0 || 'stray fetch count ' + strayFetch);
  } finally {
    await new Promise((r) => cap.server.close(r));
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  console.log('--- test-399-transport-capture ---');
  console.log('PASS: ' + pass + ' FAIL: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
})();
