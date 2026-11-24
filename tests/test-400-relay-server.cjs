#!/usr/bin/env node
'use strict';
// Phase 400 plan 13 (RL-04): the decision relay socket layer, proven on loopback only.
//   S1 GET /health is liveness only: 200, body exactly {"status":"ok"}, no catalog header
//   S2 routes: 404 not_found, 405 with Allow, 415 not_json; no 3xx on near-miss paths
//   S3 the body cap holds while reading (declared and chunked bodies); the socket closes
//   S4 a valid operator request through the socket reaches a loopback fake upstream; 200 with answers
//   S5 header and request timeouts
//   S6 clientAddressOf with a fixed hop count; the server passes the address to handleDecide
//   S7 the process entry prints one start line and answers /health; no key or hash in its output
//   S8 require opens no listener; a relay that throws gives 500 internal with no stack text
// Only 127.0.0.1 is used. No GEMINI_API_KEY is read from this machine; tests inject a fake value. Hyphens only.
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const REL = path.join(REPO, 'services/decision-relay');
const SERVER_PATH = path.join(REL, 'server.cjs');
const SAMPLE = path.join(REPO, 'tests/fixtures/399/neutral-request-sample.json');
const realFetch = globalThis.fetch;
// Any path that skips the injected fetch lands on this thrower and is counted.
let strayFetch = 0;
globalThis.fetch = function stray() { strayFetch += 1; throw new Error('stray fetch in test-400-relay-server'); };

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

function sha(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }
const FAKE_KEY = 'fake-gemini-key-400-server-ffff6666';
const OP_TOKEN = 'operator-token-400-server-dddd4444';
const OP_HASH = sha(OP_TOKEN);
const ENV = { GEMINI_API_KEY: FAKE_KEY, RELAY_OPERATOR_TOKEN_SHA256: OP_HASH };

function srv() { return require(SERVER_PATH); }
function fingerprint() { return require(path.join(REPO, 'lib/core/decision-advisor/labels-only.cjs')).catalogFingerprint(); }
function cfgWith(over) {
  const { loadConfig } = require(path.join(REL, 'config.cjs'));
  return Object.assign({}, loadConfig(ENV), over || {});
}
const quietLog = () => {};

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}
function close(server) {
  return new Promise((resolve) => {
    if (!server || !server.listening) { resolve(); return; }
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    server.close(() => resolve());
  });
}

// One loopback request. Resolves {status, headers, text}.
function request(port, opts) {
  return new Promise((resolve, reject) => {
    const o = opts || {};
    const req = http.request({ host: '127.0.0.1', port, method: o.method || 'GET', path: o.path || '/', headers: o.headers || {}, agent: false }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('client timeout')));
    if (o.body !== undefined) req.write(o.body);
    req.end();
  });
}
function jsonOf(r) { try { return JSON.parse(r.text); } catch (_e) { return null; } }

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

async function main() {
  await leg('S1 GET /health: 200, body exactly {"status":"ok"}, application/json, no x-mindrian-catalog header', async () => {
    const server = srv().createServer({ cfg: cfgWith(), env: ENV, log: quietLog });
    try {
      const port = await listen(server);
      const r = await request(port, { path: '/health' });
      if (r.status !== 200) return 'status ' + r.status;
      if (r.text !== '{"status":"ok"}') return 'body ' + r.text;
      if (!/^application\/json/.test(String(r.headers['content-type']))) return 'content-type ' + r.headers['content-type'];
      if (r.headers['x-mindrian-catalog'] !== undefined) return 'catalog header on /health';
      const src = fs.readFileSync(SERVER_PATH, 'utf8');
      return /writeHead\(30|statusCode = 30/.test(src) ? 'a 3xx write in server.cjs' : true;
    } finally { await close(server); }
  });

  await leg('S2 404 not_found, 405 with Allow, 415 not_json; near-miss paths never answer 3xx', async () => {
    const server = srv().createServer({ cfg: cfgWith(), env: ENV, log: quietLog });
    try {
      const port = await listen(server);
      const nf = await request(port, { path: '/nope' });
      const nfj = jsonOf(nf);
      if (nf.status !== 404 || !nfj || nfj.ok !== false || nfj.reason !== 'not_found') return '404 ' + nf.status + ' ' + nf.text;
      const g = await request(port, { path: '/v1/decide' });
      const gj = jsonOf(g);
      if (g.status !== 405 || String(g.headers.allow) !== 'POST' || !gj || gj.reason !== 'method_not_allowed') return 'GET decide ' + g.status + ' ' + g.headers.allow;
      const ph = await request(port, { method: 'POST', path: '/health', headers: { 'content-type': 'application/json' }, body: '{}' });
      if (ph.status !== 405 || !/GET/.test(String(ph.headers.allow))) return 'POST health ' + ph.status;
      const nj = await request(port, { method: 'POST', path: '/v1/decide', headers: { 'content-type': 'text/plain', authorization: 'Bearer ' + OP_TOKEN }, body: 'x' });
      const njj = jsonOf(nj);
      if (nj.status !== 415 || !njj || njj.reason !== 'not_json') return '415 ' + nj.status + ' ' + nj.text;
      for (const p of ['/', '/health/', '//health', '/v1/decide/', '/v1beta/decisions', '/health?x=1/../', '/HEALTH']) {
        for (const method of ['GET', 'POST']) {
          const r = await request(port, { method, path: p, headers: { 'content-type': 'application/json' }, body: method === 'POST' ? '{}' : undefined });
          if (r.status >= 300 && r.status <= 399) return method + ' ' + p + ' gave ' + r.status;
          if (r.headers.location !== undefined) return method + ' ' + p + ' has a Location header';
        }
      }
      return true;
    } finally { await close(server); }
  });

  await leg('S3 a body over maxBodyBytes gives 413 too_large before the whole body is read; the socket closes', async () => {
    const cap = 1024;
    const server = srv().createServer({ cfg: cfgWith({ maxBodyBytes: cap }), env: ENV, log: quietLog });
    try {
      const port = await listen(server);
      // (a) a declared length over the cap: refused at once, no body byte read.
      const declared = await rawExchange(port, {
        head: 'POST /v1/decide HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nAuthorization: Bearer ' + OP_TOKEN + '\r\nContent-Length: ' + (cap * 2) + '\r\n\r\n',
        first: Buffer.alloc(0),
        rest: Buffer.alloc(cap * 2, 0x61),
      });
      if (!/^HTTP\/1\.1 413 /.test(declared.text)) return 'declared ' + declared.text.slice(0, 60);
      if (!/"reason":"too_large"/.test(declared.text)) return 'declared reason ' + declared.text.slice(-80);
      if (!declared.closed) return 'declared socket did not close';
      if (declared.restSent) return 'declared: the server waited for the whole body';
      // (b) a chunked body with no declared length: the running count stops it.
      const firstPart = Buffer.alloc(cap + 512, 0x62);
      const chunk = (b) => Buffer.concat([Buffer.from(b.length.toString(16) + '\r\n'), b, Buffer.from('\r\n')]);
      const chunked = await rawExchange(port, {
        head: 'POST /v1/decide HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nAuthorization: Bearer ' + OP_TOKEN + '\r\nTransfer-Encoding: chunked\r\n\r\n',
        first: chunk(firstPart),
        rest: Buffer.concat([chunk(Buffer.alloc(cap, 0x63)), Buffer.from('0\r\n\r\n')]),
      });
      if (!/^HTTP\/1\.1 413 /.test(chunked.text)) return 'chunked ' + chunked.text.slice(0, 60);
      if (!/"reason":"too_large"/.test(chunked.text)) return 'chunked reason';
      if (!chunked.closed) return 'chunked socket did not close';
      if (chunked.restSent) return 'chunked: the server waited for the whole body';
      return true;
    } finally { await close(server); }
  });

  await leg('S4 a valid operator request through the socket reaches a loopback fake upstream and returns 200 with answers', async () => {
    let upstreamHits = 0;
    let sawKey = null;
    const upstream = http.createServer((rq, rs) => {
      upstreamHits += 1;
      sawKey = rq.headers['x-goog-api-key'];
      const chunks = [];
      rq.on('data', (c) => chunks.push(c));
      rq.on('end', () => {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const answers = {};
        for (const id of Object.keys(body.questions)) answers[id] = answerFor(body.questions[id]);
        rs.writeHead(200, { 'content-type': 'application/json' });
        rs.end(JSON.stringify({ answers, usage: { total_input_tokens: 17, total_output_tokens: 0 } }));
      });
    });
    let server;
    try {
      const upPort = await listen(upstream);
      server = srv().createServer({ cfg: cfgWith({ upstreamTimeoutMs: 5000 }), env: ENV, log: quietLog, fetchImpl: realFetch, upstreamOrigin: 'http://127.0.0.1:' + upPort });
      const port = await listen(server);
      const r = await request(port, {
        method: 'POST',
        path: '/v1/decide',
        headers: { 'content-type': 'application/json; charset=utf-8', authorization: 'Bearer ' + OP_TOKEN, 'x-mindrian-catalog': fingerprint() },
        body: fs.readFileSync(SAMPLE, 'utf8'),
      });
      const j = jsonOf(r);
      if (r.status !== 200 || !j || j.ok !== true) return 'status ' + r.status + ' ' + r.text.slice(0, 200);
      if (!j.answers || Object.keys(j.answers).length !== 3) return 'answers ' + JSON.stringify(j.answers);
      if (upstreamHits !== 1) return 'upstream hits ' + upstreamHits;
      if (sawKey !== FAKE_KEY) return 'upstream key header missing';
      if (r.headers['x-mindrian-catalog'] !== fingerprint()) return 'no catalog header on the decide reply';
      if (r.text.indexOf(FAKE_KEY) !== -1 || JSON.stringify(r.headers).indexOf(FAKE_KEY) !== -1) return 'key in reply';
      return true;
    } finally {
      await close(server);
      await close(upstream);
    }
  });

  await leg('S5 headersTimeout is 10000 or less; requestTimeout is at least the upstream timeout plus 5000', async () => {
    const cfg = cfgWith({ upstreamTimeoutMs: 120000 });
    const server = srv().createServer({ cfg, env: ENV, log: quietLog });
    if (!(server.headersTimeout > 0 && server.headersTimeout <= 10000)) return 'headersTimeout ' + server.headersTimeout;
    if (!(server.requestTimeout >= cfg.upstreamTimeoutMs + 5000)) return 'requestTimeout ' + server.requestTimeout;
    const small = srv().createServer({ cfg: cfgWith({ upstreamTimeoutMs: 30 }), env: ENV, log: quietLog });
    if (!(small.requestTimeout >= 30 + 5000)) return 'small requestTimeout ' + small.requestTimeout;
    if (server.listening || small.listening) return 'createServer listened';
    return true;
  });

  await leg('S6 clientAddressOf: hops 0 is the socket peer; hops 1 is the last x-forwarded-for entry; a forged left entry changes nothing; the server passes it on', async () => {
    const { clientAddressOf } = srv();
    const req = (xff) => ({ socket: { remoteAddress: '10.0.0.5' }, headers: xff === undefined ? {} : { 'x-forwarded-for': xff } });
    if (clientAddressOf(req('198.51.100.9'), 0) !== '10.0.0.5') return 'hops 0';
    if (clientAddressOf(req(undefined), 1) !== '10.0.0.5') return 'hops 1 with no header';
    if (clientAddressOf(req('198.51.100.9'), 1) !== '198.51.100.9') return 'hops 1';
    if (clientAddressOf(req('203.0.113.66, 198.51.100.9'), 1) !== '198.51.100.9') return 'forged left entry';
    if (clientAddressOf(req('203.0.113.66,198.51.100.9 , 192.0.2.4'), 2) !== '198.51.100.9') return 'hops 2';
    if (clientAddressOf(req('198.51.100.9'), 2) !== '10.0.0.5') return 'short header falls back to the peer';
    if (clientAddressOf({ headers: {} }, 0) !== 'unknown') return 'no socket';
    // IN-08: a candidate that is not an IP literal falls back to the peer.
    for (const bad of ['not-an-ip', '198.51.100.9:443', 'unknown', '999.1.1.1', '<script>']) {
      if (clientAddressOf(req('203.0.113.66, ' + bad), 1) !== '10.0.0.5') return 'non-IP candidate kept ' + bad;
    }
    if (clientAddressOf(req('2001:db8::7'), 1) !== '2001:db8::7') return 'IPv6 literal refused';
    // Through the socket: the address handleDecide receives.
    const seen = [];
    const spyRelay = { handleDecide: async (input) => { seen.push(input.address); return { status: 200, headers: { 'content-type': 'application/json' }, body: { ok: true } }; } };
    for (const hops of [0, 1]) {
      const server = srv().createServer({ cfg: cfgWith({ proxyHops: hops }), env: ENV, log: quietLog, relay: spyRelay });
      try {
        const port = await listen(server);
        await request(port, { method: 'POST', path: '/v1/decide', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + OP_TOKEN, 'x-forwarded-for': '203.0.113.66, 198.51.100.9' }, body: '{}' });
      } finally { await close(server); }
    }
    if (!/^(::ffff:)?127\.0\.0\.1$/.test(String(seen[0]))) return 'hops 0 socket address ' + seen[0];
    return seen[1] === '198.51.100.9' ? true : 'hops 1 socket address ' + seen[1];
  });

  await leg('S7 the process entry prints one start line, answers /health, and never prints the fake key or hash', async () => {
    const env = { PATH: process.env.PATH, PORT: '0', RELAY_HOST: '127.0.0.1', GEMINI_API_KEY: FAKE_KEY, RELAY_OPERATOR_TOKEN_SHA256: OP_HASH };
    const child = spawn(process.execPath, [SERVER_PATH], { cwd: REPO, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (c) => { out += c.toString('utf8'); });
    child.stderr.on('data', (c) => { err += c.toString('utf8'); });
    try {
      const line = await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('no start line; stderr ' + err.slice(0, 300))), 8000);
        const check = () => { const i = out.indexOf('\n'); if (i !== -1) { clearTimeout(t); resolve(out.slice(0, i)); } };
        child.stdout.on('data', check);
        child.once('exit', (code) => { clearTimeout(t); reject(new Error('child exited ' + code + ' ' + err.slice(0, 300))); });
        check();
      });
      const s = JSON.parse(line);
      const keys = Object.keys(s).sort().join(',');
      if (keys !== 'event,has_key,operator_hashes,port,t,user_traffic') return 'start keys ' + keys;
      if (s.event !== 'start' || s.has_key !== true || s.operator_hashes !== 1 || s.user_traffic !== false) return 'start values ' + line;
      if (!(Number.isInteger(s.port) && s.port > 0)) return 'port ' + s.port;
      const r = await request(s.port, { path: '/health' });
      if (r.status !== 200 || r.text !== '{"status":"ok"}') return 'health ' + r.status + ' ' + r.text;
      await new Promise((r2) => setTimeout(r2, 100));
      const all = out + err;
      if (all.indexOf(FAKE_KEY) !== -1) return 'output holds the fake key';
      if (all.indexOf(OP_HASH) !== -1) return 'output holds the fake hash';
      if (all.indexOf(OP_TOKEN) !== -1) return 'output holds the token';
      return true;
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        const gone = new Promise((r) => child.once('exit', r));
        child.kill('SIGKILL');
        await gone;
      }
    }
  });

  await leg('S8 require opens no listener; a relay that throws gives 500 internal with no stack text', async () => {
    // In a child, so a stray listener would keep the process alive past the deadline.
    const code = await new Promise((resolve) => {
      const c = spawn(process.execPath, ['-e', 'const m = require(process.argv[1]); if (typeof m.createServer !== "function" || typeof m.clientAddressOf !== "function" || !Array.isArray(m.SERVER_REASONS)) process.exit(3);', SERVER_PATH], { cwd: REPO, env: { PATH: process.env.PATH }, stdio: 'ignore' });
      const t = setTimeout(() => { c.kill('SIGKILL'); resolve('timeout'); }, 5000);
      c.on('exit', (x) => { clearTimeout(t); resolve(x); });
    });
    if (code !== 0) return 'require child ' + code;
    const reasons = srv().SERVER_REASONS;
    if (reasons.join(',') !== 'not_found,method_not_allowed,not_json,internal' || !Object.isFrozen(reasons)) return 'SERVER_REASONS ' + reasons;
    const boom = { handleDecide: async () => { throw new Error('boom-secret-stack-text'); } };
    const server = srv().createServer({ cfg: cfgWith(), env: ENV, log: quietLog, relay: boom });
    try {
      const port = await listen(server);
      const r = await request(port, { method: 'POST', path: '/v1/decide', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + OP_TOKEN }, body: '{}' });
      if (r.status !== 500) return 'status ' + r.status;
      if (r.text !== '{"ok":false,"reason":"internal"}') return 'body ' + r.text;
      if (/boom|at |\.cjs/.test(r.text)) return 'stack text in reply';
      return true;
    } finally { await close(server); }
  });

  await leg('S9 IN-08 the first POST /v1/decide logs one xff_shape line with the entry count only; later requests log none', async () => {
    const logs = [];
    const spyRelay = { handleDecide: async () => ({ status: 200, headers: { 'content-type': 'application/json' }, body: { ok: true } }) };
    const server = srv().createServer({ cfg: cfgWith({ proxyHops: 1 }), env: ENV, log: (r) => logs.push(r), relay: spyRelay });
    try {
      const port = await listen(server);
      const h = { 'content-type': 'application/json', authorization: 'Bearer ' + OP_TOKEN, 'x-forwarded-for': '203.0.113.66, 198.51.100.9, 192.0.2.4' };
      await request(port, { method: 'POST', path: '/v1/decide', headers: h, body: '{}' });
      await request(port, { method: 'POST', path: '/v1/decide', headers: h, body: '{}' });
    } finally { await close(server); }
    const shape = logs.filter((l) => l.event === 'xff_shape');
    if (shape.length !== 1) return 'xff_shape lines ' + shape.length;
    const keys = Object.keys(shape[0]).sort().join(',');
    if (keys !== 'event,proxy_hops,t,xff_entries') return 'keys ' + keys;
    if (shape[0].xff_entries !== 3 || shape[0].proxy_hops !== 1) return JSON.stringify(shape[0]);
    const text = JSON.stringify(logs);
    return /203\.0\.113|198\.51\.100|192\.0\.2/.test(text) ? 'an address in the log' : true;
  });

  if (strayFetch !== 0) { fail += 1; console.log('FAIL: stray fetch calls: ' + strayFetch); }
  globalThis.fetch = realFetch;
  finished = true;
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
}

// A raw socket exchange. Sends `head` and `first`, waits for the reply, and sends `rest` only if
// the server has not replied after 300 ms. Resolves {text, closed, restSent}.
function rawExchange(port, o) {
  return new Promise((resolve) => {
    const sock = net.connect(port, '127.0.0.1');
    let text = '';
    let restSent = false;
    let done = false;
    const finish = (closed) => { if (done) return; done = true; clearTimeout(restTimer); clearTimeout(deadline); resolve({ text, closed, restSent }); };
    sock.on('data', (c) => { text += c.toString('utf8'); });
    sock.on('error', () => { /* a reset after the reply is a close */ });
    sock.on('close', () => finish(true));
    const restTimer = setTimeout(() => { if (text.length === 0 && !sock.destroyed) { restSent = true; sock.write(o.rest); } }, 300);
    const deadline = setTimeout(() => { sock.destroy(); finish(false); }, 5000);
    sock.on('connect', () => { sock.write(o.head); if (o.first.length > 0) sock.write(o.first); });
  });
}

main().catch((e) => { console.log('FAIL: main threw ' + String(e && e.stack ? e.stack : e)); process.exit(1); });
