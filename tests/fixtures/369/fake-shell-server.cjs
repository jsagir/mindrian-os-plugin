'use strict';
/*
 * tests/fixtures/369/fake-shell-server.cjs -- a stand-in for the shell server (plans 369-22 and 369-40).
 *
 * Mirrors the contract of the real server after plan 369-37:
 *   - reads the same environment the real server reads (MOS_DAEMON_URL, MOS_SHELL_PORT or PORT,
 *     MOS_SHELL_CONTROL_TOKEN_FILE, MOS_PROPOSAL_SOURCE), binds 127.0.0.1 only;
 *   - writes a control token file exclusively (a planted regular file is replaced, a symlink or a
 *     directory stops the process; mode 0600, directory 0700);
 *   - POST /control/bootstrap (token-checked, no Origin, no Sec-Fetch-Site) takes exactly one of
 *     { sha256 } (arm a one-time code) or { start: true } (arm the single-use 60 s start slot);
 *     both, or a start that is not true, is 400;
 *   - GET /auth/bootstrap?code= and GET /auth/start answer only Sec-Fetch-Site none + Mode
 *     navigate + Dest document (403 otherwise, before the code or slot is touched); a redeemed
 *     code or slot is 303 with a cookie once, then 401.
 *
 * Two files are written NEXT TO the control token file so a test can prove what the launcher did or
 * did not hand down (they sit in the launcher's own state directory because the launcher passes the
 * token path in its allow-listed environment, whereas it passes no test variable):
 *   fake-env-dump.json  the process env KEYS (never values), the proposal source, hostname, daemon url
 *   fake-arms.json      every arm: { kind: 'sha256' | 'start', at, listeningAt } (listeningAt is the
 *                       time the port started answering, so a test can prove an arm came after it)
 * Hyphens only; no em-dashes.
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');

const port = Number(process.env.MOS_SHELL_PORT || process.env.PORT);
const tokenFile = process.env.MOS_SHELL_CONTROL_TOKEN_FILE;
if (!Number.isInteger(port) || !tokenFile) {
  console.error('fake-shell-server: MOS_SHELL_PORT and MOS_SHELL_CONTROL_TOKEN_FILE are required');
  process.exit(1);
}
const stateDir = path.dirname(tokenFile);
let listeningAt = null;

fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
fs.writeFileSync(path.join(stateDir, 'fake-env-dump.json'), JSON.stringify({
  keys: Object.keys(process.env).sort(),
  daemonUrl: process.env.MOS_DAEMON_URL || null,
  hostname: process.env.HOSTNAME || null,
  proposalSource: process.env.MOS_PROPOSAL_SOURCE || null,
  argvHasCode: process.argv.join(' ').includes('code='),
  pid: process.pid,
}));

// The control token file, written the way ui/shell/server/control.ts writes it.
const token = crypto.randomBytes(32).toString('base64url');
let existing = null;
try { existing = fs.lstatSync(tokenFile); } catch (_e) { existing = null; }
if (existing) {
  if (existing.isSymbolicLink() || existing.isDirectory()) {
    console.error('fake-shell-server: control token path is a symbolic link or a directory: ' + tokenFile);
    process.exit(1);
  }
  fs.unlinkSync(tokenFile);
}
const tokenFd = fs.openSync(tokenFile, 'wx', 0o600);
fs.writeSync(tokenFd, token + '\n');
fs.closeSync(tokenFd);

const armLog = [];
function logArm(kind) {
  armLog.push({ kind: kind, at: Date.now(), listeningAt: listeningAt });
  fs.writeFileSync(path.join(stateDir, 'fake-arms.json'), JSON.stringify(armLog));
}

const armed = []; // { hash, expiresAt }
let startSlot = null; // { expiresAt }
function arm(hex) {
  armed.push({ hash: hex.toLowerCase(), expiresAt: Date.now() + 60000 });
}

function isNavigation(req) {
  return req.headers['sec-fetch-site'] === 'none' && req.headers['sec-fetch-mode'] === 'navigate' && req.headers['sec-fetch-dest'] === 'document';
}

function signedIn(res) {
  res.writeHead(303, { location: '/', 'set-cookie': 'mos_session=fake; HttpOnly; SameSite=Strict; Path=/' });
  res.end();
}

const server = http.createServer((req, res) => {
  const hostOk = req.headers.host === '127.0.0.1:' + port;
  const url = new URL(req.url, 'http://127.0.0.1:' + port);
  if (!hostOk) { res.writeHead(403); return res.end('bad host'); }

  if (req.method === 'POST' && url.pathname === '/control/bootstrap') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (req.headers.origin !== undefined || req.headers['sec-fetch-site'] !== undefined) { res.writeHead(403); return res.end('browser request'); }
      if (req.headers['x-mos-control-token'] !== token) { res.writeHead(401); return res.end('token required'); }
      let parsed;
      try { parsed = JSON.parse(body); } catch (_e) { res.writeHead(400); return res.end('bad json'); }
      const rec = parsed && typeof parsed === 'object' ? parsed : {};
      const hasSha = 'sha256' in rec;
      const hasStart = 'start' in rec;
      if (hasSha && hasStart) { res.writeHead(400); return res.end('one of sha256 or start'); }
      if (hasStart) {
        if (rec.start !== true) { res.writeHead(400); return res.end('bad start'); }
        startSlot = { expiresAt: Date.now() + 60000 };
        logArm('start');
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ ok: true, expires_in_ms: 60000 }));
      }
      if (typeof rec.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(rec.sha256)) { res.writeHead(400); return res.end('bad sha'); }
      arm(rec.sha256);
      logArm('sha256');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, expires_in_ms: 60000 }));
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/auth/bootstrap') {
    if (!isNavigation(req)) { res.writeHead(403); return res.end('Forbidden'); }
    const code = url.searchParams.get('code') || '';
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    const i = armed.findIndex((e) => e.hash === hash);
    if (i < 0 || armed[i].expiresAt <= Date.now()) {
      if (i >= 0) armed.splice(i, 1);
      res.writeHead(401);
      return res.end('not signed in');
    }
    armed.splice(i, 1); // single use
    return signedIn(res);
  }

  if (req.method === 'GET' && url.pathname === '/auth/start') {
    if (!isNavigation(req)) { res.writeHead(403); return res.end('Forbidden'); }
    if (!startSlot || startSlot.expiresAt <= Date.now()) { startSlot = null; res.writeHead(401); return res.end('not signed in'); }
    startSlot = null; // single use
    return signedIn(res);
  }

  res.writeHead(404);
  res.end('not found');
});

server.listen(port, '127.0.0.1', () => {
  listeningAt = Date.now();
  console.log('fake-shell-server listening on 127.0.0.1:' + port);
});
process.on('SIGTERM', () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 500); });
