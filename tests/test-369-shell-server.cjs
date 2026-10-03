// SHELL369-03: the shell server's walled package and security layer (plan 369-19).
//
// Unit arms import the framework-free modules under ui/shell/server directly (Node runs the
// erasable .ts by stripping types). The build-output arm and the live arm need the chassis's build
// (`cd ui/shell && npm run build`): they exit 77 only when the build output is absent, reported by
// name. Plain counters, nonzero exit tail (house harness).
//
// Hermetic: temp HOME, USERPROFILE and MINDRIAN_ROOMS_HOME; no CLAUDE_ACTIVE_ROOM or
// CLAUDE_CODE_SESSION_ID; the shell binds 127.0.0.1 only; telemetry off.
'use strict';

const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { builtinModules } = require('node:module');

const REPO = path.resolve(__dirname, '..');
const SHELL = path.join(REPO, 'ui', 'shell');
const STANDALONE = path.join(SHELL, '.next', 'standalone');
const ROOT_PKG = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'test-369-shell-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = path.join(TMP_HOME, 'rooms');
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
process.env.NEXT_TELEMETRY_DISABLED = '1';
process.env.DO_NOT_TRACK = '1';

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + String(err.stack || err.message || err).split('\n').slice(0, 14).join('\n    ') + '\n');
}
function scenario(name, fn) {
  try { fn(); ok(name); } catch (e) { fail(name, e); }
}
async function ascenario(name, fn) {
  try { await fn(); ok(name); } catch (e) { fail(name, e); }
}

const bootstrapMod = require(path.join(SHELL, 'server', 'bootstrap.ts'));
const authMod = require(path.join(SHELL, 'server', 'auth.ts'));
const guardMod = require(path.join(SHELL, 'server', 'origin-guard.ts'));
const cspMod = require(path.join(SHELL, 'server', 'csp.ts'));
const controlMod = require(path.join(SHELL, 'server', 'control.ts'));
const configMod = require(path.join(SHELL, 'server', 'config.ts'));

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const code = () => crypto.randomBytes(32).toString('base64url');
function bag(obj) {
  const m = new Map(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (n) => (m.has(n.toLowerCase()) ? m.get(n.toLowerCase()) : null) };
}

// ---------- (1) the bootstrap store ----------

scenario('bootstrap: a code exchanges once, then is refused', () => {
  const s = bootstrapMod.createBootstrapStore();
  const c = code();
  s.arm(sha(c));
  assert.deepStrictEqual(s.exchange(c), { ok: true });
  assert.strictEqual(s.exchange(c).ok, false);
  assert.strictEqual(s.exchange(c).reason, 'unknown_or_used');
});

scenario('bootstrap: a wrong code is refused and the right code still works; the tried code is burned', () => {
  const s = bootstrapMod.createBootstrapStore();
  const right = code();
  const other = code();
  s.arm(sha(right));
  s.arm(sha(other));
  assert.strictEqual(s.exchange(code()).ok, false, 'a random code');
  assert.strictEqual(s.exchange(right).ok, true, 'the right code was not the one tried');
  assert.strictEqual(s.exchange(right).ok, false, 'the right code is burned by its own exchange');
  assert.strictEqual(s.exchange(other).ok, true, 'the other armed code is untouched');
});

scenario('bootstrap: an expired code is refused (injected clock), the default life is 60 seconds', () => {
  let t = 1000000;
  const s = bootstrapMod.createBootstrapStore({ now: () => t });
  const c = code();
  s.arm(sha(c));
  t += 59000;
  const c2 = code();
  s.arm(sha(c2), 60000);
  t += 2000; // c is now 61 s old
  assert.deepStrictEqual(s.exchange(c), { ok: false, reason: 'expired' }, 'a 61 s old code');
  assert.strictEqual(s.exchange(c).reason, 'unknown_or_used', 'and it is burned by the attempt');
  assert.strictEqual(s.exchange(c2).ok, true, 'a code inside its own 60 s window');
  assert.strictEqual(bootstrapMod.DEFAULT_BOOTSTRAP_TTL_MS, 60000);
  const c3 = code();
  s.arm(sha(c3), 1000);
  t += 1000;
  assert.strictEqual(s.exchange(c3).ok, false, 'a code at exactly its expiry');
});

scenario('bootstrap: a second process (a second store) does not accept the first store\'s code', () => {
  const a = bootstrapMod.createBootstrapStore();
  const b = bootstrapMod.createBootstrapStore();
  const c = code();
  a.arm(sha(c));
  assert.strictEqual(b.exchange(c).ok, false);
  assert.strictEqual(a.exchange(c).ok, true);
});

scenario('bootstrap: malformed input is refused without throwing; arm refuses a non-hash', () => {
  const s = bootstrapMod.createBootstrapStore();
  for (const bad of [undefined, null, 42, '', 'x'.repeat(257), {}]) assert.strictEqual(s.exchange(bad).ok, false);
  assert.throws(() => s.arm('not-a-hash'));
  assert.throws(() => s.arm(sha('x'), 0));
});

// ---------- (2) sessions, cookie, CSRF ----------

scenario('auth: the cookie carries exactly HttpOnly; SameSite=Strict; Path=/ and an opaque 32-byte id', () => {
  const store = authMod.createSessionStore();
  const { session, setCookie } = authMod.issueSession(store);
  assert.match(setCookie, /^mos_shell_sid=[A-Za-z0-9_-]{43}; HttpOnly; SameSite=Strict; Path=\/$/);
  assert.ok(!/Secure/.test(setCookie), 'no Secure on plain loopback HTTP');
  assert.ok(!/Max-Age|Expires/.test(setCookie), 'a browser-session cookie');
  assert.strictEqual(session.id.length, 43);
  assert.notStrictEqual(session.mcpKey, session.id, 'the MCP key is not the cookie value');
  assert.notStrictEqual(session.csrf, session.id);
});

scenario('auth: readSession finds a live session, refuses unknown ids, and expires after 30 idle minutes', () => {
  let t = 5000000;
  const store = authMod.createSessionStore({ now: () => t });
  const { session, setCookie } = authMod.issueSession(store);
  const header = 'a=b; ' + setCookie.split(';')[0] + '; c=d';
  assert.strictEqual(authMod.readSession(header, store).id, session.id);
  assert.strictEqual(authMod.readSession('mos_shell_sid=nope', store), null);
  assert.strictEqual(authMod.readSession(null, store), null);
  assert.strictEqual(authMod.readSession('', store), null);
  t += 29 * 60000;
  assert.ok(authMod.readSession(header, store), 'activity at 29 min refreshes the idle clock');
  t += 31 * 60000;
  assert.strictEqual(authMod.readSession(header, store), null, 'idle 31 min is expired');
  assert.strictEqual(store.size(), 0);
  assert.strictEqual(authMod.SESSION_IDLE_MS, 30 * 60 * 1000);
});

scenario('auth: requireCsrf refuses a missing or wrong token with 403 and accepts the session token', () => {
  const store = authMod.createSessionStore();
  const { session } = authMod.issueSession(store);
  const missing = authMod.requireCsrf({ headers: bag({}) }, session);
  assert.deepStrictEqual([missing.ok, missing.status], [false, 403]);
  const wrong = authMod.requireCsrf({ headers: bag({ 'x-mos-csrf': 'x'.repeat(43) }) }, session);
  assert.deepStrictEqual([wrong.ok, wrong.status], [false, 403]);
  const short = authMod.requireCsrf({ headers: bag({ 'x-mos-csrf': 'x' }) }, session);
  assert.deepStrictEqual([short.ok, short.status], [false, 403]);
  assert.strictEqual(authMod.requireCsrf({ headers: bag({ 'x-mos-csrf': session.csrf }) }, session).ok, true);
  const nobody = authMod.requireCsrf({ headers: bag({ 'x-mos-csrf': session.csrf }) }, null);
  assert.deepStrictEqual([nobody.ok, nobody.status], [false, 401]);
});

// ---------- (3) Host and Origin ----------

scenario('origin-guard: Host must be exactly 127.0.0.1:<port>; evil, localhost and a bare 127.0.0.1 are 403', () => {
  const port = 3369;
  assert.strictEqual(guardMod.checkHostOrigin(bag({ host: '127.0.0.1:3369' }), port).ok, true);
  for (const host of ['evil.example:3369', 'localhost:3369', '127.0.0.1', '127.0.0.1:3370', '[::1]:3369', '', null]) {
    const r = guardMod.checkHostOrigin(bag(host === null ? {} : { host }), port);
    assert.deepStrictEqual([r.ok, r.status, r.reason], [false, 403, 'bad_host'], 'host ' + host);
  }
});

scenario('origin-guard: an Origin other than http://127.0.0.1:<port> is 403, an absent Origin passes', () => {
  const port = 3369;
  const host = '127.0.0.1:3369';
  assert.strictEqual(guardMod.checkHostOrigin(bag({ host }), port).ok, true);
  assert.strictEqual(guardMod.checkHostOrigin(bag({ host, origin: 'http://127.0.0.1:3369' }), port).ok, true);
  for (const origin of ['http://localhost:3369', 'http://evil.example', 'null', 'https://127.0.0.1:3369', 'http://127.0.0.1:3370']) {
    const r = guardMod.checkHostOrigin(bag({ host, origin }), port);
    assert.deepStrictEqual([r.ok, r.status, r.reason], [false, 403, 'bad_origin'], 'origin ' + origin);
  }
});

scenario('origin-guard: Sec-Fetch-Site cross-site and same-site are refused, none and same-origin pass', () => {
  const host = '127.0.0.1:3369';
  for (const site of ['cross-site', 'same-site']) {
    const r = guardMod.checkRequest(bag({ host, 'sec-fetch-site': site }), 3369);
    assert.deepStrictEqual([r.ok, r.status, r.reason], [false, 403, 'cross_site'], site);
  }
  for (const site of ['none', 'same-origin']) assert.strictEqual(guardMod.checkRequest(bag({ host, 'sec-fetch-site': site }), 3369).ok, true, site);
});

// ---------- (4) the sign-in exchange (handler) ----------

function exchangeDeps() {
  return { bootstrap: bootstrapMod.createBootstrapStore(), sessions: authMod.createSessionStore() };
}
const PORT = 3369;
function bootReq(c, headers) {
  return { url: '/auth/bootstrap?code=' + encodeURIComponent(c), headers: bag(Object.assign({ host: '127.0.0.1:' + PORT, 'sec-fetch-site': 'none' }, headers || {})), port: PORT };
}

scenario('exchange: a good link answers 303 to a code-free URL with the cookie; reuse shows the Not signed in copy', () => {
  const deps = exchangeDeps();
  const c = code();
  deps.bootstrap.arm(sha(c));
  const r = authMod.handleBootstrapRequest(bootReq(c), deps);
  assert.strictEqual(r.status, 303);
  assert.strictEqual(r.headers.Location, '/');
  assert.ok(!/code/.test(r.headers.Location));
  assert.match(r.headers['Set-Cookie'], /HttpOnly; SameSite=Strict; Path=\//);
  assert.strictEqual(deps.sessions.size(), 1);
  const again = authMod.handleBootstrapRequest(bootReq(c), deps);
  assert.strictEqual(again.status, 401);
  assert.ok(again.body.includes('This browser is not signed in to the workspace.'));
  assert.ok(again.body.includes('Workspace links work once, for this computer only.'));
  assert.ok(!again.headers['Set-Cookie']);
  assert.strictEqual(deps.sessions.size(), 1, 'no second session');
});

scenario('exchange: a cross-site or foreign-Origin request is 403 BEFORE the code is touched; the code still signs in afterwards', () => {
  const deps = exchangeDeps();
  const c = code();
  deps.bootstrap.arm(sha(c));
  for (const headers of [
    { 'sec-fetch-site': 'cross-site' },
    { 'sec-fetch-site': 'same-site' },
    { origin: 'http://evil.example' },
    { origin: 'http://localhost:' + PORT },
    { host: 'evil.example:' + PORT },
  ]) {
    const r = authMod.handleBootstrapRequest(bootReq(c, headers), deps);
    assert.strictEqual(r.status, 403, JSON.stringify(headers));
    assert.ok(!r.headers['Set-Cookie']);
  }
  assert.strictEqual(deps.bootstrap.size(), 1, 'the armed code was never touched');
  assert.strictEqual(deps.sessions.size(), 0);
  assert.strictEqual(authMod.handleBootstrapRequest(bootReq(c), deps).status, 303, 'a link opened from the terminal (none) works');
});

scenario('exchange: a missing code and a wrong code both show the Not signed in copy', () => {
  const deps = exchangeDeps();
  deps.bootstrap.arm(sha(code()));
  const noCode = authMod.handleBootstrapRequest({ url: '/auth/bootstrap', headers: bag({ host: '127.0.0.1:' + PORT }), port: PORT }, deps);
  assert.strictEqual(noCode.status, 401);
  assert.strictEqual(authMod.handleBootstrapRequest(bootReq(code()), deps).status, 401);
  assert.strictEqual(deps.sessions.size(), 0);
});

// ---------- (5) the CSP ----------

scenario('csp: the policy is the UI-SPEC contract with a per-response nonce, no unsafe-inline, no outside host', () => {
  const n = cspMod.newNonce();
  const csp = cspMod.buildCsp(n);
  assert.strictEqual(
    csp,
    "default-src 'self'; script-src 'self' 'nonce-" + n + "'; connect-src 'self'; font-src 'self'; img-src 'self' data:; style-src 'self' 'nonce-" + n +
      "'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  );
  assert.ok(!/unsafe-inline|unsafe-eval|https?:|\*/.test(csp));
  assert.notStrictEqual(cspMod.newNonce(), cspMod.newNonce());
  assert.throws(() => cspMod.buildCsp("x'; script-src *"), 'a nonce cannot inject a directive');
  const h = cspMod.securityHeaders(n);
  assert.strictEqual(h['X-Content-Type-Options'], 'nosniff');
  assert.strictEqual(h['Referrer-Policy'], 'no-referrer');
  assert.strictEqual(h['Content-Security-Policy'], csp);
});

// ---------- (6) config and the control channel ----------

scenario('config: only an http://127.0.0.1 daemon is accepted; the default port is 3369', () => {
  const cfg = configMod.loadConfig({ MOS_DAEMON_URL: 'http://127.0.0.1:5555' });
  assert.strictEqual(cfg.port, 3369);
  assert.strictEqual(cfg.daemonUrl, 'http://127.0.0.1:5555');
  assert.strictEqual(cfg.proposalSource, 'fixed');
  assert.ok(cfg.controlTokenFile.endsWith(path.join('.mindrian', 'ui-shell', 'control.token')));
  assert.strictEqual(cfg.bootstrapSha256, null);
  for (const bad of [undefined, '', 'http://example.com:1', 'http://localhost:1', 'https://127.0.0.1:1', 'http://127.0.0.2:1', 'nonsense']) {
    assert.throws(() => configMod.loadConfig(bad === undefined ? {} : { MOS_DAEMON_URL: bad }), 'daemon ' + bad);
  }
  assert.throws(() => configMod.loadConfig({ MOS_DAEMON_URL: 'http://127.0.0.1:1', MOS_SHELL_PORT: '70000' }));
  assert.throws(() => configMod.loadConfig({ MOS_DAEMON_URL: 'http://127.0.0.1:1', MOS_SHELL_BOOTSTRAP_SHA256: 'zz' }));
  assert.throws(() => configMod.loadConfig({ MOS_DAEMON_URL: 'http://127.0.0.1:1', MOS_PROPOSAL_SOURCE: 'other' }));
  assert.strictEqual(configMod.loadConfig({ MOS_DAEMON_URL: 'http://127.0.0.1:1', MOS_SHELL_PORT: '4000', MOS_PROPOSAL_SOURCE: 'adapter' }).port, 4000);
});

scenario('control: the token file is mode 0600 in a 0700 directory, and a re-write never widens it', () => {
  if (process.platform === 'win32') return;
  const file = path.join(TMP_HOME, 'ctl', 'ui-shell', 'control.token');
  const token = controlMod.writeControlToken(file);
  assert.ok(token.length >= 43);
  assert.strictEqual(fs.statSync(file).mode & 0o777, 0o600);
  assert.strictEqual(fs.statSync(path.dirname(file)).mode & 0o777, 0o700);
  fs.chmodSync(file, 0o644);
  controlMod.writeControlToken(file);
  assert.strictEqual(fs.statSync(file).mode & 0o777, 0o600);
});

scenario('control: the token arms a hash; no token, a wrong token, a browser request and a foreign host are refused', () => {
  const store = bootstrapMod.createBootstrapStore();
  const token = crypto.randomBytes(32).toString('base64url');
  const c = code();
  const call = (headers, body) => controlMod.handleControlBootstrap(
    { headers: bag(Object.assign({ host: '127.0.0.1:' + PORT }, headers)), port: PORT, bodyText: body === undefined ? JSON.stringify({ sha256: sha(c) }) : body },
    { token, bootstrap: store },
  );
  assert.strictEqual(call({}).status, 401);
  assert.strictEqual(call({ 'x-mos-control-token': 'wrong' }).status, 401);
  assert.strictEqual(call({ 'x-mos-control-token': token, origin: 'http://127.0.0.1:' + PORT }).status, 403, 'a browser sends Origin');
  assert.strictEqual(call({ 'x-mos-control-token': token, 'sec-fetch-site': 'same-origin' }).status, 403);
  assert.strictEqual(call({ 'x-mos-control-token': token, host: 'evil.example:' + PORT }).status, 403);
  assert.strictEqual(call({ cookie: 'mos_shell_sid=anything' }).status, 401, 'a cookie is never a credential here');
  assert.strictEqual(store.size(), 0, 'nothing armed by any refusal');
  assert.strictEqual(call({ 'x-mos-control-token': token }, 'not json').status, 400);
  assert.strictEqual(call({ 'x-mos-control-token': token }, JSON.stringify({ sha256: 'short' })).status, 400);
  assert.strictEqual(call({ 'x-mos-control-token': token }, 'x'.repeat(2000)).status, 413);
  const good = call({ 'x-mos-control-token': token });
  assert.deepStrictEqual([good.status, good.body.ok, good.body.expires_in_ms], [200, true, 60000]);
  assert.strictEqual(store.exchange(c).ok, true, 'the armed hash signs in');
});

// ---------- (7) static: storage, lib, room.db, dashes, scripts ----------

function listFiles(dir, out, skip) {
  out = out || [];
  skip = skip || ['node_modules', '.next'];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listFiles(p, out, skip);
    else out.push(p);
  }
  return out;
}
const SOURCE_DIRS = ['server', 'client', 'app'].map((d) => path.join(SHELL, d));
const SOURCE_FILES = SOURCE_DIRS.flatMap((d) => listFiles(d)).concat(['proxy.ts', 'instrumentation.ts', 'next.config.ts'].map((f) => path.join(SHELL, f)));

scenario('static: the three folders exist and hold the files the plan names', () => {
  for (const d of ['server', 'client', 'app']) assert.ok(fs.statSync(path.join(SHELL, d)).isDirectory(), d);
  for (const f of ['server/config.ts', 'server/bootstrap.ts', 'server/auth.ts', 'server/origin-guard.ts', 'server/csp.ts', 'server/control.ts',
    'client/App.tsx', 'client/routes.ts', 'client/api.ts', 'client/copy.ts', 'app/page.tsx', 'app/auth/bootstrap/route.ts', 'app/control/bootstrap/route.ts']) {
    assert.ok(fs.existsSync(path.join(SHELL, f)), f);
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(SHELL, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.private, true);
  assert.strictEqual(pkg.name, 'mos-ui-shell');
  assert.strictEqual(pkg.dependencies['mos-ui-shared'], 'file:../shared');
  assert.ok(fs.existsSync(path.join(SHELL, 'package-lock.json')), 'the lockfile is committed');
  assert.match(fs.readFileSync(path.join(SHELL, '.gitignore'), 'utf8'), /node_modules/);
});

scenario('static: no browser storage, no lib/ require, no room.db, no sqlite in the shell source', () => {
  for (const f of SOURCE_FILES) {
    const src = fs.readFileSync(f, 'utf8');
    assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(src), f + ' touches browser storage or the cookie');
    assert.ok(!/from ['"](\.\.\/)+lib\/|require\(['"](\.\.\/)+lib\//.test(src), f + ' imports from lib/');
    assert.ok(!/node:sqlite|room\.db/.test(src), f + ' touches room.db');
  }
});

scenario('static: no em-dash or en-dash in the shell source, and no style attribute or inline script in the layout and page', () => {
  for (const f of SOURCE_FILES.concat([path.join(SHELL, 'package.json'), path.join(SHELL, 'README.md')])) {
    if (!fs.existsSync(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    assert.ok(!src.includes(EM) && !src.includes(EN), f + ' carries a dash character');
  }
  for (const f of ['app/layout.tsx', 'app/page.tsx', 'client/App.tsx']) {
    assert.ok(!/style=\{|style="|dangerouslySetInnerHTML/.test(fs.readFileSync(path.join(SHELL, f), 'utf8')), f + ' sets a style attribute or raw HTML (a nonce does not cover a style attribute)');
  }
});

scenario('static: the cookie, CSRF and fetch-metadata rules are in auth.ts; the contract policy is in csp.ts', () => {
  const auth = fs.readFileSync(path.join(SHELL, 'server', 'auth.ts'), 'utf8');
  assert.ok((auth.match(/SameSite=Strict/g) || []).length >= 1);
  const guard = fs.readFileSync(path.join(SHELL, 'server', 'origin-guard.ts'), 'utf8');
  assert.ok(/sec-fetch-site/.test(guard));
  const csp = fs.readFileSync(path.join(SHELL, 'server', 'csp.ts'), 'utf8');
  assert.strictEqual(csp.split('\n').filter((l) => l.includes("default-src 'self'")).length, 1);
});

// ---------- (8) the build output (RULE 8) ----------

const BUILT = fs.existsSync(path.join(STANDALONE, 'server.js'));

function rootDepNames() { return new Set(Object.keys(ROOT_PKG.dependencies || {})); }
function packageNameOf(spec) {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}
function isBuiltin(spec) {
  const bare = spec.startsWith('node:') ? spec.slice(5) : spec;
  return builtinModules.includes(bare) || builtinModules.includes(bare.split('/')[0]);
}
function findDirs(dir, name, out) {
  out = out || [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const p = path.join(dir, e.name);
    if (e.name === name) { out.push(p); continue; }
    findDirs(p, name, out);
  }
  return out;
}
function countFiles(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) n += e.isDirectory() ? countFiles(path.join(dir, e.name)) : 1;
  return n;
}

if (BUILT) {
  scenario('build output (RULE 8): no node_modules tree sits under the server output', () => {
    const dirs = findDirs(STANDALONE, 'node_modules');
    const detail = dirs.map((d) => path.relative(STANDALONE, d) + ' (' + countFiles(d) + ' files, ' + fs.readdirSync(d).join(', ') + ')');
    assert.strictEqual(dirs.length, 0, dirs.length + ' node_modules directories under .next/standalone: ' + detail.join('; '));
  });

  scenario('build output (RULE 8): every bare import in the server output is a root dependency or a Node built-in', () => {
    const roots = rootDepNames();
    const bad = new Map();
    const RE = /(?:require\(\s*|from\s+|import\s*\(\s*|import\s+)(["'])([^"'\n]+)\1/g;
    let scanned = 0;
    for (const f of listFiles(STANDALONE, [], ['node_modules']).filter((p) => /\.(js|mjs|cjs)$/.test(p) && !p.includes(path.sep + 'node_modules' + path.sep) && !p.includes(path.sep + 'static' + path.sep))) {
      scanned += 1;
      const src = fs.readFileSync(f, 'utf8');
      let m;
      RE.lastIndex = 0;
      while ((m = RE.exec(src))) {
        const spec = m[2];
        if (spec.startsWith('.') || spec.startsWith('/') || isBuiltin(spec)) continue;
        if (!/^[@a-z][\w.@-]*(\/[\w.@/-]*)?$/i.test(spec)) continue; // not a module specifier
        if (roots.has(packageNameOf(spec))) continue;
        if (!bad.has(spec)) bad.set(spec, path.relative(STANDALONE, f));
      }
    }
    assert.ok(scanned > 0, 'scanned the server output files');
    const names = [...bad.entries()].map(([s, f]) => s + ' (' + f + ')');
    assert.strictEqual(bad.size, 0, bad.size + ' bare imports outside the root dependencies and Node built-ins: ' + names.slice(0, 12).join('; ') + (names.length > 12 ? '; ...' : ''));
  });
}

// ---------- (9) the live arm ----------

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
    s.on('error', reject);
  });
}
function request(port, opts) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method: opts.method || 'GET', path: opts.path, headers: opts.headers || {} }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => req.destroy(new Error('request timeout ' + opts.path)));
    if (opts.body) req.write(opts.body);
    req.end();
  });
}
async function waitUntil(fn, ms, what) {
  const end = Date.now() + ms;
  for (;;) {
    try { if (await fn()) return; } catch (_e) { /* retry */ }
    if (Date.now() > end) throw new Error('timeout waiting for ' + what);
    await new Promise((r) => setTimeout(r, 100));
  }
}
function listeningLoopbackOnly(port) {
  // Linux: /proc/net/tcp lists a listener's local address as hex; 0100007F is 127.0.0.1 (little-endian).
  if (!fs.existsSync('/proc/net/tcp')) return null;
  const hexPort = port.toString(16).toUpperCase().padStart(4, '0');
  const rows = fs.readFileSync('/proc/net/tcp', 'utf8').split('\n').slice(1).map((l) => l.trim().split(/\s+/)).filter((c) => c[3] === '0A');
  const mine = rows.filter((c) => c[1].endsWith(':' + hexPort)).map((c) => c[1].split(':')[0]);
  return mine;
}

async function liveArm() {
  const dataHome = path.join(TMP_HOME, 'live');
  fs.mkdirSync(dataHome, { recursive: true });
  const daemon = http.createServer((_q, r) => r.end('{}'));
  await new Promise((r) => daemon.listen(0, '127.0.0.1', r));
  const port = await freePort();
  const tokenFile = path.join(dataHome, 'ctl', 'control.token');
  const c1 = code();
  const env = Object.assign({}, process.env, {
    HOME: TMP_HOME, USERPROFILE: TMP_HOME, MINDRIAN_ROOMS_HOME: path.join(TMP_HOME, 'rooms'),
    MOS_DAEMON_URL: 'http://127.0.0.1:' + daemon.address().port, MOS_SHELL_PORT: String(port),
    MOS_SHELL_BOOTSTRAP_SHA256: sha(c1), MOS_SHELL_CONTROL_TOKEN_FILE: tokenFile,
    HOSTNAME: '127.0.0.1', PORT: String(port), NEXT_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1',
  });
  delete env.CLAUDE_ACTIVE_ROOM;
  delete env.CLAUDE_CODE_SESSION_ID;
  const child = spawn(process.execPath, ['server.js'], { cwd: STANDALONE, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const stop = () => new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill('SIGTERM');
    setTimeout(() => { try { child.kill('SIGKILL'); } catch (_e) { /* gone */ } }, 3000).unref();
  });
  const H = { 'sec-fetch-site': 'none' };
  try {
    await waitUntil(async () => fs.existsSync(tokenFile) && (await request(port, { path: '/auth/bootstrap', headers: H })).status > 0, 20000, 'the shell to answer');

    await ascenario('live: the shell listens on 127.0.0.1 only', async () => {
      const addrs = listeningLoopbackOnly(port);
      if (addrs !== null) {
        assert.ok(addrs.length > 0, 'a listener was found for port ' + port);
        for (const a of addrs) assert.strictEqual(a, '0100007F', 'listener bound to ' + a);
      }
      const external = [].concat(...Object.values(os.networkInterfaces())).filter((i) => i && i.family === 'IPv4' && !i.internal);
      for (const i of external.slice(0, 1)) {
        const refused = await new Promise((resolve) => {
          const s = net.connect({ host: i.address, port, timeout: 1500 }, () => { s.destroy(); resolve(false); });
          s.on('error', () => resolve(true));
          s.on('timeout', () => { s.destroy(); resolve(true); });
        });
        assert.ok(refused, 'a connection to ' + i.address + ':' + port + ' must be refused');
      }
    });

    await ascenario('live: the control token file is 0600 in a 0700 directory', async () => {
      if (process.platform === 'win32') return;
      assert.strictEqual(fs.statSync(tokenFile).mode & 0o777, 0o600);
      assert.strictEqual(fs.statSync(path.dirname(tokenFile)).mode & 0o777, 0o700);
    });

    let cookie = null;
    await ascenario('live: the armed code answers 303 with Set-Cookie and a Location without the code', async () => {
      const r = await request(port, { path: '/auth/bootstrap?code=' + encodeURIComponent(c1), headers: H });
      assert.strictEqual(r.status, 303, r.body.slice(0, 200));
      assert.ok(!/code/.test(r.headers.location), 'Location: ' + r.headers.location);
      const sc = [].concat(r.headers['set-cookie'] || []);
      assert.strictEqual(sc.length, 1);
      assert.match(sc[0], /^mos_shell_sid=[A-Za-z0-9_-]{43}; HttpOnly; SameSite=Strict; Path=\/$/);
      cookie = sc[0].split(';')[0];
    });

    await ascenario('live: the same URL again shows the Not signed in copy', async () => {
      const r = await request(port, { path: '/auth/bootstrap?code=' + encodeURIComponent(c1), headers: H });
      assert.strictEqual(r.status, 401);
      assert.ok(r.body.includes('This browser is not signed in to the workspace.'));
      assert.ok(!r.headers['set-cookie']);
    });

    const token = fs.readFileSync(tokenFile, 'utf8').trim();
    const arm = (c, headers) => request(port, { method: 'POST', path: '/control/bootstrap', headers: Object.assign({ 'content-type': 'application/json' }, headers || {}), body: JSON.stringify({ sha256: sha(c) }) });

    await ascenario('live: POST /control/bootstrap needs the token; a browser-style request is refused', async () => {
      const c = code();
      assert.strictEqual((await arm(c)).status, 401);
      assert.strictEqual((await arm(c, { 'x-mos-control-token': 'wrong' })).status, 401);
      assert.strictEqual((await arm(c, { 'x-mos-control-token': token, origin: 'http://127.0.0.1:' + port })).status, 403);
      assert.strictEqual((await arm(c, { cookie })).status, 401, 'a signed-in cookie is not a control credential');
      const good = await arm(c, { 'x-mos-control-token': token });
      assert.strictEqual(good.status, 200, good.body);
      // the freshly armed code must not have been spent by the refusals above
      const r = await request(port, { path: '/auth/bootstrap?code=' + encodeURIComponent(c), headers: H });
      assert.strictEqual(r.status, 303);
    });

    await ascenario('live: a fresh code requested cross-site answers 403 and still signs in from a Sec-Fetch-Site none request', async () => {
      const c = code();
      assert.strictEqual((await arm(c, { 'x-mos-control-token': token })).status, 200);
      const cross = await request(port, { path: '/auth/bootstrap?code=' + encodeURIComponent(c), headers: { 'sec-fetch-site': 'cross-site' } });
      assert.strictEqual(cross.status, 403);
      assert.ok(!cross.headers['set-cookie']);
      const sameSite = await request(port, { path: '/auth/bootstrap?code=' + encodeURIComponent(c), headers: { 'sec-fetch-site': 'same-site' } });
      assert.strictEqual(sameSite.status, 403);
      const foreignOrigin = await request(port, { path: '/auth/bootstrap?code=' + encodeURIComponent(c), headers: { origin: 'http://evil.example' } });
      assert.strictEqual(foreignOrigin.status, 403);
      const evilHost = await request(port, { path: '/auth/bootstrap?code=' + encodeURIComponent(c), headers: Object.assign({ host: 'evil.example:' + port }, H) });
      assert.strictEqual(evilHost.status, 403);
      const ok303 = await request(port, { path: '/auth/bootstrap?code=' + encodeURIComponent(c), headers: H });
      assert.strictEqual(ok303.status, 303, 'the code survived every refusal');
    });

    await ascenario('live: every route refuses a foreign Host or Origin (the page, an asset path, the control route)', async () => {
      for (const p of ['/', '/auth/bootstrap', '/_next/static/none.js']) {
        assert.strictEqual((await request(port, { path: p, headers: { host: 'evil.example:' + port } })).status, 403, p + ' host');
        assert.strictEqual((await request(port, { path: p, headers: { origin: 'http://localhost:' + port } })).status, 403, p + ' origin');
      }
      assert.strictEqual((await request(port, { method: 'POST', path: '/control/bootstrap', headers: { host: 'localhost:' + port, 'x-mos-control-token': token }, body: '{}' })).status, 403);
    });

    await ascenario('live: GET / with the cookie returns HTML under the nonce CSP and the CSRF meta tag; without it, the Not signed in copy', async () => {
      const r = await request(port, { path: '/', headers: { cookie } });
      assert.strictEqual(r.status, 200);
      const csp = r.headers['content-security-policy'];
      assert.ok(csp, 'Content-Security-Policy header');
      const nonce = /'nonce-([^']+)'/.exec(csp)[1];
      assert.ok(csp.startsWith("default-src 'self'; script-src 'self' 'nonce-"), csp);
      assert.ok(!/unsafe-inline|unsafe-eval|https?:/.test(csp), csp);
      assert.strictEqual(r.headers['x-content-type-options'], 'nosniff');
      assert.strictEqual(r.headers['referrer-policy'], 'no-referrer');
      assert.match(r.headers['content-type'], /text\/html/);
      assert.match(r.body, /<meta name="mos-csrf" content="[A-Za-z0-9_-]{43}"/);
      const inlineScripts = r.body.match(/<script(?![^>]*\bsrc=)[^>]*>/g) || [];
      assert.ok(inlineScripts.length > 0, 'the page has inline hydration scripts');
      for (const tag of inlineScripts) assert.ok(tag.includes('nonce="' + nonce + '"'), 'inline script without the response nonce: ' + tag);
      assert.ok(!/ style="/.test(r.body), 'no style attribute in the signed-in page');
      assert.ok(!/(src|href)="https?:/.test(r.body), 'no outside host in the page');
      const anon = await request(port, { path: '/' });
      assert.strictEqual(anon.status, 200);
      assert.ok(anon.body.includes('This browser is not signed in to the workspace.'));
      assert.ok(!/mos-csrf/.test(anon.body));
      const second = await request(port, { path: '/', headers: { cookie } });
      assert.notStrictEqual(/'nonce-([^']+)'/.exec(second.headers['content-security-policy'])[1], nonce, 'a fresh nonce per response');
    });

    await ascenario('live: a forged cookie is not a session', async () => {
      const r = await request(port, { path: '/', headers: { cookie: 'mos_shell_sid=' + 'A'.repeat(43) } });
      assert.ok(r.body.includes('This browser is not signed in to the workspace.'));
    });
  } finally {
    await stop();
    await new Promise((r) => daemon.close(r));
  }
  if (failed) process.stdout.write('\n--- shell log (tail) ---\n' + log.split('\n').slice(-12).join('\n') + '\n');

  // A configuration with any other daemon host never starts listening for long: the process exits non-zero.
  await ascenario('live: the server refuses to start on a daemon host other than 127.0.0.1', async () => {
    const p2 = await freePort();
    const env2 = Object.assign({}, env, { MOS_DAEMON_URL: 'http://example.com:9', MOS_SHELL_PORT: String(p2), PORT: String(p2), MOS_SHELL_BOOTSTRAP_SHA256: '' });
    const bad = spawn(process.execPath, ['server.js'], { cwd: STANDALONE, env: env2, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    bad.stdout.on('data', (d) => { out += d; });
    bad.stderr.on('data', (d) => { out += d; });
    const code2 = await new Promise((resolve) => {
      const t = setTimeout(() => { bad.kill('SIGKILL'); resolve('timeout'); }, 15000);
      bad.on('exit', (c) => { clearTimeout(t); resolve(c); });
    });
    assert.strictEqual(code2, 1, 'exit code ' + code2 + '; ' + out.slice(-300));
    assert.ok(/refused to start/.test(out), out.slice(-300));
  });
}

async function main() {
  if (BUILT) await liveArm();
  fs.rmSync(TMP_HOME, { recursive: true, force: true });
  process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
  if (failed) process.exit(1);
  if (!BUILT) {
    process.stdout.write('ENV GAP: the shell is not built (cd ui/shell && npm run build); the build-output and live arms did not run (exit 77)\n');
    process.exit(77);
  }
  process.exit(0);
}

main().catch((e) => {
  process.stdout.write('FATAL ' + (e.stack || e.message || e) + '\n');
  try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  process.exit(1);
});
