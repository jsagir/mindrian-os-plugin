'use strict';
// Phase 386 plan 01 -- finding B1 (Part 8 egress, latent).
//
// B1: lib/wiki/wiki-server.cjs held a second POST /api/chat handler (the BYOAPI
// proxy) that read apiKey and apiProvider from the request body and called
// api.anthropic.com or api.openai.com with page context. The first handler (the
// stub) answered first, so the second never ran. Only registration order blocked
// the egress. The GET /wiki/:section/pdf route was also unreachable, because the
// wildcard route /wiki/:section/*rest was registered before it.
//
// Arms:
//   (a) static: one app.post('/api/chat'), no third-party host string, no read of
//       apiKey or apiProvider, no fetch( call (comments stripped)
//   (b) dynamic: POST /api/chat with apiKey, apiProvider and a valid pageId makes
//       0 fetch calls and answers from the stub path
//   (c) GET /wiki/<section>/pdf answers 200 with the class pdf-page, and the pdf
//       route is registered before the wildcard route
//   (d) fall-through: a page with id <section>/pdf still opens as an artifact page
//
// Fixture room only (tests/fixtures/wiki-room-232). No network: fetch is replaced
// by a counter before the server loads. Node built-ins only. No em-dash, no en-dash.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const REPO = path.resolve(__dirname, '..');
const FIXTURE_ROOM = path.join(REPO, 'tests', 'fixtures', 'wiki-room-232');
const SERVER_FILE = path.join(REPO, 'lib', 'wiki', 'wiki-server.cjs');

// No key can resolve: no env key, and HOME holds no .mindrian.env.
const scratchHome = fs.mkdtempSync(path.join(os.tmpdir(), 't386-home-'));
delete process.env.ANTHROPIC_API_KEY;
process.env.HOME = scratchHome;
process.env.USERPROFILE = scratchHome;

// Any fetch call is counted and fails. Set before the server module loads.
let fetchCount = 0;
globalThis.fetch = async function countingFetch() {
  fetchCount += 1;
  return { ok: false, status: 599, json: async () => ({}) };
};

const { startWikiServer } = require(SERVER_FILE);

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

function request(port, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const headers = {};
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

// Strip block comments and line comments. A block comment must open at the start
// of a line: a route string such as '/wiki/:section/*rest' holds the characters /*
// and must not open a comment. A line comment starts at // that follows the line
// start or a space, so the // inside a URL string (https://) stays.
function stripComments(src) {
  return src
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '')
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, '$1'))
    .join('\n');
}

function routeOrder(app) {
  const router = app.router || app._router;
  return router.stack.filter((l) => l.route).map((l) => {
    const methods = Object.keys(l.route.methods || {}).join(',');
    return methods + ' ' + l.route.path;
  });
}

const watchdog = setTimeout(() => {
  console.log('wiki-no-byoapi-proxy: TIMEOUT');
  process.exit(1);
}, 60000);
watchdog.unref();

async function startOn(room) {
  return startWikiServer(room, 0);
}
async function stop(handle) {
  try { if (handle.watcher && handle.watcher.close) await handle.watcher.close(); } catch (_e) { /* ignore */ }
  try { handle.server.close(); } catch (_e) { /* ignore */ }
}

async function main() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 't386-room-'));
  const room = path.join(scratch, 'room');
  fs.cpSync(FIXTURE_ROOM, room, { recursive: true });
  const handle = await startOn(room);
  const port = handle.port;
  let handle2 = null;

  try {
    await check('(a) static: one /api/chat handler, no third-party host, no key read, no fetch call', async () => {
      const src = stripComments(fs.readFileSync(SERVER_FILE, 'utf8'));
      const posts = src.match(/app\.post\(\s*['"]\/api\/chat['"]/g) || [];
      eq(posts.length, 1, 'count of app.post /api/chat');
      ok(!/api\.anthropic\.com/.test(src), 'string api.anthropic.com present');
      ok(!/api\.openai\.com/.test(src), 'string api.openai.com present');
      ok(!/\bapiKey\b/.test(src), 'a read of apiKey is present');
      ok(!/\bapiProvider\b/.test(src), 'a read of apiProvider is present');
      ok(!/\bfetch\s*\(/.test(src), 'a fetch( call is present');
    });

    await check('(b) POST /api/chat with apiKey and apiProvider makes 0 fetch calls and answers from the stub', async () => {
      const before = fetchCount;
      const r = await request(port, 'POST', '/api/chat', {
        pageId: 'problem-definition/test-article',
        message: 'synthetic question',
        apiKey: 'synthetic-key-not-real',
        apiProvider: 'anthropic'
      });
      eq(r.status, 200, 'status');
      const j = JSON.parse(r.body);
      ok(typeof j.reply === 'string' && j.reply.length > 0, 'reply text');
      ok(Array.isArray(j.sources), 'stub shape has a sources array');
      ok(j.source !== 'anthropic' && j.source !== 'openai', 'reply must not come from a third party');
      eq(fetchCount - before, 0, 'fetch calls');
    });

    await check('(c) GET /wiki/<section>/pdf answers 200 with pdf-page, and the pdf route is before the wildcard', async () => {
      const r = await request(port, 'GET', '/wiki/problem-definition/pdf');
      eq(r.status, 200, 'status');
      ok(r.body.includes('pdf-page'), 'body must hold the class pdf-page');
      const order = routeOrder(handle.app);
      const iPdf = order.indexOf('get /wiki/:section/pdf');
      const iWild = order.indexOf('get /wiki/:section/*rest');
      ok(iPdf >= 0, 'pdf route is registered');
      ok(iWild >= 0, 'wildcard route is registered');
      ok(iPdf < iWild, 'pdf route must be registered before the wildcard route');
    });

    await check('(d) a page with id <section>/pdf still opens as an artifact page', async () => {
      const scratch2 = fs.mkdtempSync(path.join(os.tmpdir(), 't386-room2-'));
      const room2 = path.join(scratch2, 'room');
      fs.cpSync(FIXTURE_ROOM, room2, { recursive: true });
      fs.writeFileSync(
        path.join(room2, 'problem-definition', 'pdf.md'),
        '---\ntitle: Synthetic Pdf Page\n---\n# Synthetic Pdf Page\n\nSynthetic body for the fall-through arm.\n'
      );
      handle2 = await startOn(room2);
      const r = await request(handle2.port, 'GET', '/wiki/problem-definition/pdf');
      eq(r.status, 200, 'status');
      ok(r.body.includes('data-page-id="problem-definition/pdf"'), 'artifact page mount for the pdf page');
      ok(!r.body.includes('pdf-page'), 'must not be the printable section page');
      try { fs.rmSync(scratch2, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
    });
  } finally {
    await stop(handle);
    if (handle2) await stop(handle2);
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
    try { fs.rmSync(scratchHome, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  }

  console.log(failures === 0 ? 'wiki-no-byoapi-proxy: ALL PASS' : 'wiki-no-byoapi-proxy: ' + failures + ' FAILED');
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
