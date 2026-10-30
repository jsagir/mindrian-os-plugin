'use strict';
// Quick 261030-fbl -- finding T6-08 for the wiki server.
//
// T6-08: a DNS rebinding page reaches a loopback server under its own host name.
// The wiki server (lib/wiki/wiki-server.cjs) must answer 403 when the Host header
// is not localhost, 127.0.0.1 or [::1], on every route, including the routes that
// write (POST /api/save) and the routes that call out (POST /api/chat, /api/briefing).
//
// Arms:
//   (a) GET  /wiki           with Host evil.example      -> 403
//   (b) POST /api/save/...   with Host evil.example      -> 403, target file unchanged
//   (c) POST /api/chat       with Host evil.example      -> 403
//   (d) POST /api/briefing   with Host evil.example      -> 403
//   (e) GET  /wiki           with Host localhost:PORT    -> 200
//   (f) POST /api/save/...   with Host 127.0.0.1:PORT    -> 2xx, file changes
//   (g) Host localhost.evil.com and 127.0.0.1.evil.com   -> 403
//
// No egress: HOME is a scratch folder and ANTHROPIC_API_KEY is removed before the
// server loads, so /api/briefing can never find a key and never calls out.
//
// A raw http.request is used because fetch does not let a caller set the Host header.
// Node built-ins only. No em-dash, no en-dash.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const REPO = path.resolve(__dirname, '..');
const FIXTURE_ROOM = path.join(REPO, 'tests', 'fixtures', 'wiki-room-232');

// No key can resolve: no env key, and HOME holds no .mindrian.env.
const scratchHome = fs.mkdtempSync(path.join(os.tmpdir(), 'fbl-home-'));
delete process.env.ANTHROPIC_API_KEY;
process.env.HOME = scratchHome;
process.env.USERPROFILE = scratchHome;

const { startWikiServer } = require(path.join(REPO, 'lib', 'wiki', 'wiki-server.cjs'));

let failures = 0;
async function check(label, fn) {
  try {
    await fn();
    console.log('  ok - ' + label);
  } catch (e) {
    failures += 1;
    console.log('  FAIL - ' + label + ': ' + (e && e.message ? e.message : e));
  }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
}
function ok(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function request(port, method, urlPath, host, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const headers = { Host: host };
    if (payload !== null) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request({ host: '127.0.0.1', port, method, path: urlPath, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.setTimeout(10000, () => req.destroy(new Error('request timeout')));
    req.on('error', reject);
    if (payload !== null) req.write(payload);
    req.end();
  });
}

const watchdog = setTimeout(() => {
  console.log('wiki-host-guard: TIMEOUT');
  process.exit(1);
}, 60000);
watchdog.unref();

async function main() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'fbl-room-'));
  const room = path.join(scratch, 'room');
  fs.cpSync(FIXTURE_ROOM, room, { recursive: true });
  const target = path.join(room, 'problem-definition', 'test-article.md');

  const handle = await startWikiServer(room, 0);
  const port = handle.port;
  const SAVE = '/api/save/problem-definition/test-article';

  try {
    await check('(a) GET /wiki with Host evil.example answers 403', async () => {
      const r = await request(port, 'GET', '/wiki', 'evil.example');
      eq(r.status, 403);
    });

    await check('(b) POST /api/save with Host evil.example answers 403 and the file is unchanged', async () => {
      const before = fs.readFileSync(target, 'utf8');
      const r = await request(port, 'POST', SAVE, 'evil.example', { markdown: 'rebinding write zx261fbl' });
      eq(r.status, 403);
      const after = fs.readFileSync(target, 'utf8');
      eq(after, before, 'file content');
      ok(!after.includes('zx261fbl'), 'foreign write must not reach the file');
    });

    await check('(c) POST /api/chat with Host evil.example answers 403', async () => {
      const r = await request(port, 'POST', '/api/chat', 'evil.example',
        { pageId: 'problem-definition/test-article', message: 'hello' });
      eq(r.status, 403);
    });

    await check('(d) POST /api/briefing with Host evil.example answers 403', async () => {
      const r = await request(port, 'POST', '/api/briefing', 'evil.example', {});
      eq(r.status, 403);
    });

    await check('(e) GET /wiki with Host localhost:PORT answers 200', async () => {
      const r = await request(port, 'GET', '/wiki', 'localhost:' + port);
      eq(r.status, 200);
      ok(r.body.includes('id="room-home"'), 'expected the Room Home page');
    });

    await check('(f) POST /api/save with Host 127.0.0.1:PORT answers 2xx and the file changes', async () => {
      const before = fs.readFileSync(target, 'utf8');
      const r = await request(port, 'POST', SAVE, '127.0.0.1:' + port, { markdown: 'normal edit zx261fbl' });
      ok(r.status >= 200 && r.status < 300, 'expected 2xx, got ' + r.status);
      const after = fs.readFileSync(target, 'utf8');
      ok(after !== before, 'file must change');
      ok(after.includes('zx261fbl'), 'new body must be written');
      ok(after.startsWith('---'), 'frontmatter must stay');
    });

    for (const host of ['localhost.evil.com', '127.0.0.1.evil.com', 'localhost.evil.com:' + port]) {
      await check('(g) Host ' + host + ' answers 403 on GET /wiki and POST /api/save', async () => {
        const before = fs.readFileSync(target, 'utf8');
        const g = await request(port, 'GET', '/wiki', host);
        eq(g.status, 403, 'GET /wiki');
        const p = await request(port, 'POST', SAVE, host, { markdown: 'lookalike zx261fbl-g' });
        eq(p.status, 403, 'POST /api/save');
        eq(fs.readFileSync(target, 'utf8'), before, 'file content');
      });
    }

    await check('(h) Host [::1]:PORT is served (loopback name, same as before)', async () => {
      const r = await request(port, 'GET', '/wiki', '[::1]:' + port);
      eq(r.status, 200);
    });
  } finally {
    try { if (handle.watcher && handle.watcher.close) await handle.watcher.close(); } catch (_e) { /* ignore */ }
    try { handle.server.close(); } catch (_e) { /* ignore */ }
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
    try { fs.rmSync(scratchHome, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  }

  console.log(failures === 0 ? 'wiki-host-guard: ALL PASS' : 'wiki-host-guard: ' + failures + ' FAILED');
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
