'use strict';
/*
 * tests/fixtures/369/fake-shell-server.cjs -- a stand-in for the shell server (plan 369-22).
 *
 * Reads the same environment the real server reads (MOS_DAEMON_URL, MOS_SHELL_PORT or PORT,
 * MOS_SHELL_BOOTSTRAP_SHA256, MOS_SHELL_CONTROL_TOKEN_FILE), binds 127.0.0.1 only, prints a
 * listening line, writes a control token file (mode 0600, directory 0700), serves
 * POST /control/bootstrap (token-checked, arms a sha256) and GET /auth/bootstrap (303 when
 * sha256(code) matches an armed hash, once; 403 otherwise). When FAKE_SHELL_ENV_DUMP names a file,
 * the process env KEYS (never values) are written there so a test can prove what the launcher
 * did or did not hand down. Hyphens only; no em-dashes.
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

if (process.env.FAKE_SHELL_ENV_DUMP) {
  fs.writeFileSync(process.env.FAKE_SHELL_ENV_DUMP, JSON.stringify({
    keys: Object.keys(process.env).sort(),
    daemonUrl: process.env.MOS_DAEMON_URL || null,
    hostname: process.env.HOSTNAME || null,
    argvHasCode: process.argv.join(' ').includes('code='),
  }));
}

const token = crypto.randomBytes(32).toString('base64url');
fs.mkdirSync(path.dirname(tokenFile), { recursive: true, mode: 0o700 });
fs.chmodSync(path.dirname(tokenFile), 0o700);
fs.writeFileSync(tokenFile, token + '\n', { mode: 0o600 });
fs.chmodSync(tokenFile, 0o600);

const armed = []; // { hash, expiresAt }
function arm(hex) {
  armed.push({ hash: hex.toLowerCase(), expiresAt: Date.now() + 60000 });
}
if (process.env.MOS_SHELL_BOOTSTRAP_SHA256) arm(process.env.MOS_SHELL_BOOTSTRAP_SHA256);

const server = http.createServer((req, res) => {
  const hostOk = req.headers.host === '127.0.0.1:' + port;
  const url = new URL(req.url, 'http://127.0.0.1:' + port);
  if (!hostOk) { res.writeHead(403); return res.end('bad host'); }

  if (req.method === 'POST' && url.pathname === '/control/bootstrap') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (req.headers['x-mos-control-token'] !== token) { res.writeHead(401); return res.end('token required'); }
      let sha;
      try { sha = JSON.parse(body).sha256; } catch (_e) { res.writeHead(400); return res.end('bad json'); }
      if (typeof sha !== 'string' || !/^[0-9a-f]{64}$/i.test(sha)) { res.writeHead(400); return res.end('bad sha'); }
      arm(sha);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/auth/bootstrap') {
    const code = url.searchParams.get('code') || '';
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    const i = armed.findIndex((e) => e.hash === hash);
    if (i < 0 || armed[i].expiresAt <= Date.now()) {
      if (i >= 0) armed.splice(i, 1);
      res.writeHead(403);
      return res.end('not signed in');
    }
    armed.splice(i, 1); // single use
    res.writeHead(303, { location: '/', 'set-cookie': 'mos_session=fake; HttpOnly; SameSite=Strict; Path=/' });
    return res.end();
  }

  res.writeHead(404);
  res.end('not found');
});

server.listen(port, '127.0.0.1', () => {
  console.log('fake-shell-server listening on 127.0.0.1:' + port);
});
process.on('SIGTERM', () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 500); });
