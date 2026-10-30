'use strict';
// Quick 261030-et9 -- findings T6-03 and T6-08.
//
// T6-03: the local previews listened on every network address, and 2 of them sent
//        Access-Control-Allow-Origin '*'. A device on the same network, or a web page
//        of another site, could read a room.
// T6-08: a DNS rebinding page reaches a loopback server under its own host name.
//        The fix refuses a request whose Host header is not localhost, 127.0.0.1 or [::1].
//
// What each arm proves:
//   [helper]       lib/core/loopback-guard.cjs: the Host parser, the CORS helper, the 403 writer.
//   [hub]          lib/quickview/hub-server.cjs (live hub preview), run for real on a fixture room.
//   [quickview]    lib/quickview/server.cjs (quick view preview), run for real.
//   [presentation] lib/presentation/presentation-server.cjs (/mos:present preview), run for real.
//                  Each runtime arm checks: bound address 127.0.0.1; no connect on a non-loopback
//                  IPv4 address; no wildcard CORS; only own-origin echo (hub, quick view);
//                  403 for a foreign Host; 200 for localhost, 127.0.0.1 and [::1]; the opened and
//                  printed URL stays http://localhost:PORT; a ::1-first client with fallback connects.
//   [static]       scripts/serve-dashboard binds 127.0.0.1; no script binds ''; every .listen( line
//                  under lib/, scripts/ and bin/ has a loopback host and a reviewed entry.
//
// The ::1 limit: the previews bind 127.0.0.1 only. A client that tries only ::1 for localhost and
// never falls back cannot connect. Node 22 (autoSelectFamily) and browsers fall back. The test
// prints an INFO line for the no-fallback case; the line does not count.
//
// The browser opener is stubbed: hub-server and quickview/server open a browser in their listen
// callback. The test puts a stub xdg-open and a stub open first on PATH, so no real browser opens.
//
// Plain asserts, node built-ins only, no em-dash, no en-dash.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const events = require('node:events');

const REPO = path.resolve(__dirname, '..');

let failures = 0;
function check(label, fn) {
  return Promise.resolve()
    .then(fn)
    .then(
      () => { console.log('  ok - ' + label); },
      (e) => { failures += 1; console.log('  FAIL - ' + label + ': ' + (e && e.message ? e.message : e)); }
    );
}
function skip(label, why) { console.log('  SKIP - ' + label + ': ' + why); }
function info(label, text) { console.log('  INFO - ' + label + ': ' + text); }
function ok(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function eq(a, b, msg) {
  if (a !== b) throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
}

const watchdog = setTimeout(() => {
  console.log('loopback-servers: TIMEOUT');
  process.exit(1);
}, 90000);
watchdog.unref();

// -- sandbox -----------------------------------------------------------------

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'et9-loopback-'));
const roomDir = path.join(tmp, 'room');
const stubDir = path.join(tmp, 'stubs');
const openerLog = path.join(tmp, 'opener.log');

function makeFixture() {
  fs.mkdirSync(path.join(roomDir, 'problem-definition'), { recursive: true });
  fs.mkdirSync(path.join(roomDir, 'exports', 'presentation'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '# Fixture room\n');
  fs.writeFileSync(
    path.join(roomDir, 'problem-definition', 'fixture.md'),
    '---\ntitle: Fixture entry\n---\n\n# Fixture entry\n'
  );
  fs.writeFileSync(
    path.join(roomDir, 'exports', 'presentation', 'index.html'),
    '<html><body><p>fixture</p></body></html>'
  );
  fs.mkdirSync(stubDir, { recursive: true });
  for (const name of ['xdg-open', 'open']) {
    fs.writeFileSync(
      path.join(stubDir, name),
      '#!/bin/sh\necho "$@" >> "$ET9_OPENER_LOG"\nexit 0\n',
      { mode: 0o755 }
    );
  }
  fs.writeFileSync(openerLog, '');
  process.env.ET9_OPENER_LOG = openerLog;
  process.env.PATH = stubDir + path.delimiter + process.env.PATH;
}

// -- helpers -----------------------------------------------------------------

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

function request(o) {
  return new Promise((resolve) => {
    const opts = {
      host: o.host || '127.0.0.1',
      port: o.port,
      method: o.method || 'GET',
      path: o.path || '/',
      headers: Object.assign({}, o.headers || {}),
      agent: false,
    };
    if (o.setHost === false) opts.setHost = false;
    if (o.lookup) opts.lookup = o.lookup;
    if (typeof o.autoSelectFamily === 'boolean') opts.autoSelectFamily = o.autoSelectFamily;
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const req = http.request(opts, (res) => {
      if (opts.path === '/__sse') {
        finish({ status: res.statusCode, headers: res.headers, body: '' });
        req.destroy();
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        finish({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8').slice(0, 4096),
        });
      });
      res.on('error', (e) => finish({ error: e.code || e.message }));
    });
    req.setTimeout(1500, () => req.destroy(new Error('timeout')));
    req.on('error', (e) => finish({ error: e.code || e.message }));
    if (o.body) req.write(o.body);
    req.end();
  });
}

function tcpReach(address, port) {
  return new Promise((resolve) => {
    const sock = net.connect({ host: address, port });
    let done = false;
    const finish = (v) => { if (!done) { done = true; sock.destroy(); resolve(v); } };
    sock.setTimeout(1500, () => finish('timeout'));
    sock.on('connect', () => finish('connected'));
    sock.on('error', (e) => finish(e.code === 'ECONNREFUSED' ? 'refused' : e.code || 'error'));
  });
}

function nonLoopbackIPv4() {
  const out = [];
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const a of ifs[name] || []) {
      if (a.family === 'IPv4' && a.internal === false) out.push(a.address);
    }
  }
  return out;
}

// -- [helper] arm ------------------------------------------------------------

async function helperArm() {
  let g = null;
  try {
    g = require(path.join(REPO, 'lib', 'core', 'loopback-guard.cjs'));
  } catch (e) {
    await check('[helper] lib/core/loopback-guard.cjs loads', () => { throw e; });
    return;
  }
  const PORT = 8450;
  const OTHER = 8451;
  await check('[helper] LOOPBACK_HOST is 127.0.0.1', () => eq(g.LOOPBACK_HOST, '127.0.0.1'));

  const allowed = [
    'localhost', 'localhost:8450', 'LOCALHOST:8450', 'Localhost',
    '127.0.0.1', '127.0.0.1:8450', '[::1]', '[::1]:8450',
  ];
  for (const h of allowed) {
    await check('[helper] hostHeaderAllowed accepts ' + JSON.stringify(h), () => eq(g.hostHeaderAllowed(h), true));
  }
  const refused = [
    undefined, null, 123, '', 'evil.example', 'localhost.evil.com', '127.0.0.1.evil.com',
    '127.0.0.1.nip.io', '[::1].evil.com', '::1', '0.0.0.0', '127.0.0.2', 'localhost.',
    'user@localhost', 'localhost:abc', 'localhost:', 'localhost:8450.evil.com',
  ];
  for (const h of refused) {
    await check('[helper] hostHeaderAllowed refuses ' + JSON.stringify(h), () => eq(g.hostHeaderAllowed(h), false));
  }

  const noCors = [
    undefined, 'http://evil.example', 'null', 'https://localhost:' + PORT,
    'http://localhost:' + OTHER, 'http://localhost:' + PORT + '/',
  ];
  for (const o of noCors) {
    await check('[helper] corsHeaders gives no origin header for ' + JSON.stringify(o), () => {
      const h = g.corsHeaders(o, PORT);
      eq(Object.keys(h).length, 0, 'header count');
    });
  }
  for (const o of ['http://localhost:' + PORT, 'http://127.0.0.1:' + PORT]) {
    await check('[helper] corsHeaders echoes ' + o, () => {
      const h = g.corsHeaders(o, PORT);
      eq(h['Access-Control-Allow-Origin'], o);
      eq(h['Vary'], 'Origin');
      ok(h['Access-Control-Allow-Origin'] !== '*', 'wildcard');
    });
  }

  function fakeRes() {
    const r = { status: null, body: null, headers: null };
    r.writeHead = (s, h) => { r.status = s; r.headers = h; };
    r.end = (b) => { r.body = b === undefined ? '' : String(b); };
    return r;
  }
  await check('[helper] refuseForeignHost writes 403 and returns true for evil.example', () => {
    const res = fakeRes();
    const r = g.refuseForeignHost({ headers: { host: 'evil.example' } }, res);
    eq(r, true);
    eq(res.status, 403);
    ok(!/evil/i.test(res.body), 'body echoes the host');
  });
  await check('[helper] refuseForeignHost returns false and writes nothing for localhost:8450', () => {
    const res = fakeRes();
    const r = g.refuseForeignHost({ headers: { host: 'localhost:8450' } }, res);
    eq(r, false);
    eq(res.status, null);
  });
}

// -- runtime arms ------------------------------------------------------------

function makeRows() {
  return [
    {
      tag: 'hub',
      ownOrigin: true,
      okPath: '/api/state',
      cors: [
        { method: 'GET', path: '/api/state' },
        { method: 'GET', path: '/api/hash' },
        { method: 'GET', path: '/api/actions' },
        { method: 'POST', path: '/api/command', body: '{"command":"/mos:status"}', headers: { 'Content-Type': 'application/json' } },
        { method: 'OPTIONS', path: '/api/state' },
        { method: 'OPTIONS', path: '/' },
        { method: 'GET', path: '/' },
      ],
      opens: true,
      start: async (port) => {
        const server = require(path.join(REPO, 'lib', 'quickview', 'hub-server.cjs')).startServer(roomDir, port);
        if (!server.listening) await events.once(server, 'listening');
        return { server };
      },
    },
    {
      tag: 'quickview',
      ownOrigin: true,
      okPath: '/api/state',
      cors: [
        { method: 'GET', path: '/api/state' },
        { method: 'GET', path: '/' },
      ],
      opens: true,
      start: async (port) => {
        const server = require(path.join(REPO, 'lib', 'quickview', 'server.cjs')).startServer(roomDir, port);
        if (!server.listening) await events.once(server, 'listening');
        return { server };
      },
    },
    {
      tag: 'presentation',
      ownOrigin: false,
      okPath: '/',
      cors: [
        { method: 'GET', path: '/' },
        { method: 'GET', path: '/__sse' },
      ],
      opens: false,
      start: async (port) => {
        const lines = [];
        const orig = console.log;
        let r;
        console.log = (...a) => { lines.push(a.join(' ')); };
        try {
          r = await require(path.join(REPO, 'lib', 'presentation', 'presentation-server.cjs')).startPresentationServer(roomDir, port);
        } finally {
          console.log = orig;
        }
        return { server: r.server, watcher: r.watcher, printed: lines };
      },
    },
  ];
}

async function runRow(row) {
  const t = '[' + row.tag + '] ';
  let port;
  let handle;
  try {
    port = await freePort();
    fs.writeFileSync(openerLog, '');
    handle = await row.start(port);
  } catch (e) {
    await check(t + 'server loads and starts', () => { throw e; });
    return;
  }
  const server = handle.server;
  try {
    await check(t + 'listens on 127.0.0.1 only (address)', () => eq(server.address().address, '127.0.0.1'));
    await check(t + 'answers 200 on 127.0.0.1', async () => {
      const r = await request({ port, path: row.okPath });
      eq(r.status, 200, JSON.stringify(r.error || ''));
    });
    await check(t + 'answers 200 through localhost', async () => {
      const r = await request({ host: 'localhost', port, path: row.okPath });
      eq(r.status, 200, JSON.stringify(r.error || ''));
    });
    if (row.opens) {
      await check(t + 'opened URL is unchanged (http://localhost:PORT)', () => {
        const lines = fs.readFileSync(openerLog, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
        ok(lines.includes('http://localhost:' + port), 'opener log: ' + JSON.stringify(lines));
      });
    } else {
      await check(t + 'printed URL is unchanged (http://localhost:PORT)', () => {
        ok(handle.printed.some((l) => l.includes('http://localhost:' + port)), 'printed: ' + JSON.stringify(handle.printed));
      });
    }

    const addrs = nonLoopbackIPv4();
    if (addrs.length === 0) {
      skip(t + 'no connect on a non-loopback IPv4 address', 'no non-loopback IPv4 address on this machine');
    } else {
      for (const a of addrs) {
        await check(t + 'no connect on network address ' + a, async () => {
          const res = await tcpReach(a, port);
          ok(res !== 'connected', 'connected to ' + a + ':' + port);
        });
      }
    }

    for (const c of row.cors) {
      await check(t + 'no CORS header for a foreign Origin on ' + c.method + ' ' + c.path, async () => {
        const headers = Object.assign({ Origin: 'http://evil.example' }, c.headers || {});
        const r = await request({ port, method: c.method, path: c.path, headers, body: c.body });
        ok(!r.error, 'request error ' + r.error);
        ok(r.headers['access-control-allow-origin'] === undefined,
          'access-control-allow-origin is ' + r.headers['access-control-allow-origin']);
      });
    }
    if (row.ownOrigin) {
      for (const o of ['http://localhost:' + port, 'http://127.0.0.1:' + port]) {
        await check(t + 'own origin ' + o + ' is echoed with Vary: Origin', async () => {
          const r = await request({ port, path: '/api/state', headers: { Origin: o } });
          eq(r.headers['access-control-allow-origin'], o);
          ok(/origin/i.test(r.headers['vary'] || ''), 'vary is ' + r.headers['vary']);
        });
      }
    }

    const foreign = ['evil.example', 'evil.example:' + port, 'localhost.evil.com:' + port, '127.0.0.1.evil.com'];
    const foreignPaths = row.tag === 'presentation' ? [row.okPath, '/__sse'] : [row.okPath];
    for (const h of foreign) {
      for (const p of foreignPaths) {
        await check(t + 'Host ' + h + ' gets 403 on ' + p, async () => {
          const r = await request({ port, path: p, headers: { Host: h } });
          eq(r.status, 403, JSON.stringify(r.error || ''));
          ok(!/evil/i.test(r.body), 'body echoes the host');
        });
      }
    }
    for (const h of ['localhost:' + port, '127.0.0.1:' + port, '[::1]:' + port]) {
      await check(t + 'Host ' + h + ' gets 200', async () => {
        const r = await request({ port, path: row.okPath, headers: { Host: h } });
        eq(r.status, 200, JSON.stringify(r.error || ''));
      });
    }
    await check(t + 'no Host header gets 400 or 403', async () => {
      const r = await request({ port, path: row.okPath, setHost: false });
      ok(r.status === 400 || r.status === 403, 'status ' + r.status + ' ' + (r.error || ''));
    });

    const lookup = (hostname, opts, cb) => {
      if (typeof opts === 'function') { cb = opts; opts = {}; }
      if (opts && opts.all) cb(null, [{ address: '::1', family: 6 }, { address: '127.0.0.1', family: 4 }]);
      else cb(null, '::1', 6);
    };
    await check(t + 'a ::1-first client with fallback gets 200', async () => {
      const r = await request({ host: 'localhost', port, path: row.okPath, lookup, autoSelectFamily: true });
      eq(r.status, 200, JSON.stringify(r.error || ''));
    });
    const nf = await request({ host: 'localhost', port, path: row.okPath, lookup, autoSelectFamily: false });
    info(t + 'a ::1-only client without fallback', nf.error ? nf.error + ' (documented limit)' : 'status ' + nf.status);
  } finally {
    try { server.closeAllConnections(); } catch (e) { /* ignore */ }
    await new Promise((r) => server.close(() => r()));
    if (handle.watcher && typeof handle.watcher.close === 'function') {
      try { await handle.watcher.close(); } catch (e) { /* ignore */ }
    }
  }
}

// -- [static] arms -----------------------------------------------------------

const KNOWN_LISTEN_SITES = {
  'lib/quickview/hub-server.cjs': 'live hub preview, LOOPBACK_HOST, 261030-et9',
  'lib/quickview/server.cjs': 'quick view preview, LOOPBACK_HOST, 261030-et9',
  'lib/presentation/presentation-server.cjs': '/mos:present preview, LOOPBACK_HOST, 261030-et9',
  'lib/wiki/wiki-server.cjs': '/mos:wiki, 127.0.0.1 since 260923-lu5',
  'lib/core/mcp-install-responder.cjs': 'install-status responder, 127.0.0.1 with Host and Origin guards',
  'lib/mcp/daemon-lifecycle.cjs': 'free-port probe in a child process, 127.0.0.1, closes at once',
  'scripts/serve-dashboard-live': '/mos:dashboard live, 127.0.0.1 with checkHost',
  'scripts/mindrian-mcp-server.cjs': 'MCP HTTP transport, 127.0.0.1 with SDK Host and Origin guards',
};

const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.git']);

function walk(dir, out) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of ents) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(path.join(dir, e.name), out);
    } else if (e.isFile()) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

function readText(file) {
  const st = fs.statSync(file);
  if (st.size > 2 * 1024 * 1024) return null;
  const buf = fs.readFileSync(file);
  if (buf.subarray(0, 8000).includes(0)) return null;
  return buf.toString('utf8');
}

function isComment(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('#');
}

async function staticArms() {
  const scriptFiles = walk(path.join(REPO, 'scripts'), []);

  await check('[static] every http.server line under scripts/ has --bind 127.0.0.1', () => {
    let seenDashboard = 0;
    const bad = [];
    for (const f of scriptFiles) {
      const txt = readText(f);
      if (txt === null) continue;
      const rel = path.relative(REPO, f).split(path.sep).join('/');
      for (const line of txt.split('\n')) {
        if (isComment(line)) continue;
        if (/-m\s+http\.server/.test(line)) {
          if (rel === 'scripts/serve-dashboard') seenDashboard += 1;
          if (!line.includes('--bind 127.0.0.1')) bad.push(rel + ': ' + line.trim());
        }
      }
    }
    ok(seenDashboard >= 1, 'scripts/serve-dashboard has no http.server line');
    ok(bad.length === 0, 'no --bind 127.0.0.1: ' + bad.join(' | '));
  });

  await check("[static] no script binds '' (every network address)", () => {
    const bad = [];
    for (const f of scriptFiles) {
      const txt = readText(f);
      if (txt === null) continue;
      if (/bind\(\(\s*(''|"")\s*,/.test(txt)) bad.push(path.relative(REPO, f).split(path.sep).join('/'));
    }
    ok(bad.length === 0, "binds '': " + bad.join(', '));
  });

  await check('[static] every .listen( line under lib/, scripts/, bin/ is loopback and reviewed', () => {
    const files = [];
    for (const d of ['lib', 'scripts', 'bin']) walk(path.join(REPO, d), files);
    const seen = new Set();
    const problems = [];
    for (const f of files) {
      const txt = readText(f);
      if (txt === null) continue;
      const rel = path.relative(REPO, f).split(path.sep).join('/');
      const lines = txt.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (isComment(lines[i])) continue;
        if (!/\.listen\s*\(/.test(lines[i])) continue;
        seen.add(rel);
        const win = lines[i] + '\n' + (lines[i + 1] || '');
        if (!(win.includes("'127.0.0.1'") || win.includes('"127.0.0.1"') || win.includes('LOOPBACK_HOST'))) {
          problems.push(rel + ':' + (i + 1) + ' has no loopback host');
        }
        if (!Object.prototype.hasOwnProperty.call(KNOWN_LISTEN_SITES, rel)) {
          problems.push(rel + ':' + (i + 1) + ' is not in KNOWN_LISTEN_SITES');
        }
      }
    }
    for (const k of Object.keys(KNOWN_LISTEN_SITES)) {
      if (!seen.has(k)) problems.push(k + ' is in KNOWN_LISTEN_SITES but has no .listen( line (stale)');
    }
    ok(problems.length === 0, problems.join(' | '));
  });
}

// -- main --------------------------------------------------------------------

async function main() {
  makeFixture();
  try {
    await helperArm();
    if (process.platform === 'win32') {
      for (const tag of ['hub', 'quickview', 'presentation']) {
        skip('[' + tag + '] runtime arm', 'the browser opener cannot be stubbed on win32');
      }
    } else {
      for (const row of makeRows()) await runRow(row);
    }
    await staticArms();
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  }
  if (failures === 0) {
    console.log('loopback-servers: ALL PASS');
    process.exit(0);
  }
  console.log('loopback-servers: ' + failures + ' FAILED');
  process.exit(1);
}

main().catch((e) => {
  console.log('  FAIL - unexpected error: ' + (e && e.stack ? e.stack : e));
  console.log('loopback-servers: 1 FAILED');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (x) { /* ignore */ }
  process.exit(1);
});
