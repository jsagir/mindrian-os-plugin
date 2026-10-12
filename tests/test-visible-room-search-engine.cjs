'use strict';
// quick 261012-u58 -- the wiki search answers from the shared room search engine
// (sweep item 7a: one lexical door).
//
// RED-then-GREEN fixture test. The fixture room is built fresh in os.tmpdir() on
// every run and deleted at the end; nothing here is checked in (the pre-commit
// hook walks staged dirs for .room-root, so a checked-in sub-room fixture would
// trip it).
//
// Groups, in order: [core] [server] [client] [retire] [hygiene].
// Each check name starts with its group tag. No em-dashes, no en-dashes.
//
// A missing lib/core/room-search.cjs makes every [core] check FAIL. It never
// skips and never crashes the run.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const CORE_FILE = path.join(REPO_ROOT, 'lib', 'core', 'room-search.cjs');

let pass = 0;
let fail = 0;
let total = 0;
const checks = [];

function check(name, fn) {
  checks.push({ name, fn });
}

async function runChecks() {
  for (const { name, fn } of checks) {
    total += 1;
    try {
      await fn();
      pass += 1;
      console.log(`  PASS - ${name}`);
    } catch (err) {
      fail += 1;
      const msg = err && err.message ? err.message : String(err);
      console.log(`  FAIL - ${name}: ${msg}`);
    }
  }
}

// ── helpers ──────────────────────────────────────────────────────────────

function write(root, rel, text) {
  const abs = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text, 'utf8');
}

function cleanupDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_e) {
    /* best-effort cleanup */
  }
}

function httpGet(port, reqPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: reqPath, method: 'GET' }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function searchJson(port, query) {
  const res = await httpGet(port, '/api/search?' + query);
  let json = null;
  try { json = JSON.parse(res.body); } catch (_e) { json = null; }
  return { status: res.status, raw: res.body, json };
}

const enc = encodeURIComponent;

// Comment stripping for the checks that are about code (the test-270 style).
function stripComments(src) {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

function listCjs(dir, out) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return out; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) listCjs(full, out);
    else if (e.name.endsWith('.cjs')) out.push(full);
  }
  return out;
}

// Record each readFileSync call that touches the fixture (the walk-bound test
// style). Always restores the original.
function countReads(keys, fn) {
  const orig = fs.readFileSync;
  const seen = [];
  fs.readFileSync = function wrapped(p, ...rest) {
    if (typeof p === 'string' && keys.some((k) => p.includes(k))) seen.push(p);
    return orig.call(fs, p, ...rest);
  };
  try {
    fn();
  } finally {
    fs.readFileSync = orig;
  }
  return seen;
}

const toPosix = (p) => p.split(path.sep).join('/');

// ── fixture ──────────────────────────────────────────────────────────────

const M = {
  nested: 'zebranestedheron',
  htmlOnly: 'zebrahtmlonly',
  xss: 'zebraxss',
  longMark: 'zebralongmark',
  many: 'zebramany',
};

const PRIVATE_MARKERS = [
  'zebraprivateroom',
  'zebraprivateuser',
  'zebraprivatestate',
  'zebraprivateminto',
  'zebraprivatesectionstate',
  'zebraprivatehidden',
  'zebraprivatebud',
  'zebraprivatenodemodules',
  'zebraprivateexport',
  'zebraprivatelinkfile',
];

const PHRASE = 'pelican estuary ledger counts';
const BAKERY_Q = 'What is the quarterly revenue forecast for the bakery franchise?';

function buildFixture() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'u58-search-'));
  const room = path.join(scratch, 'room');
  const outside = path.join(scratch, 'outside');
  fs.mkdirSync(room, { recursive: true });
  fs.mkdirSync(outside, { recursive: true });

  // Root: identity files (never pages). USER.md holds the exact phrase.
  write(room, 'ROOM.md', '# room\nzebraprivateroom\n');
  write(room, 'USER.md', '# user\nzebraprivateuser\nThe ' + PHRASE + ' here.\n');
  write(room, 'STATE.md', '# state\nzebraprivatestate\n');
  write(room, 'MINTO.md', '# minto\nzebraprivateminto\n');
  write(room, 'README.md', '# Readme\nplain root page\n');

  // research: flat page, nested pages, html, xss, long line, many lines.
  write(room, 'research/flat.md', '# Flat\nflat body with otter\nquarterly note only\n');
  write(room, 'research/STATE.md', '# section state\nzebraprivatesectionstate\n');
  write(
    room,
    'research/heron/heron.md',
    [
      '# Heron',
      M.nested + ' marks this nested page',
      'The pelican nests near the water',
      'Every estuary is mapped here',
      'Ledger entries are kept',
      'Daily counts are written',
      '',
    ].join('\n')
  );
  write(room, 'research/heron/notes.md', '# Notes\nsibling page\n');
  write(room, 'research/deep/a/b.md', '# Deep B\ndeep nested body\n');
  write(room, 'research/brief/brief.html', '<html><body><p>' + M.htmlOnly + '</p></body></html>\n');
  write(room, 'research/xss/xss.md', '# Xss\n<script>alert("' + M.xss + '")</script> ' + M.xss + ' tail\n');
  const filler = 'alpha beta gamma '.repeat(15).slice(0, 245);
  const longLine = (filler + M.longMark + ' ' + 'delta '.repeat(10)).slice(0, 300);
  write(room, 'research/long/long.md', '# Long\n' + longLine + '\n');
  write(
    room,
    'research/many/many.md',
    '# Many\n' + [1, 2, 3, 4, 5, 6, 7, 8].map((n) => M.many + ' line number ' + 'x'.repeat(n)).join('\n') + '\n'
  );
  write(room, 'research/few/few.md', '# Few\n' + M.many + ' once in this page\n');
  write(room, 'solution-design/thing/thing.md', '# Thing\nthing body with otter\n');

  // Excluded copies of private markers.
  write(room, 'research/.hidden/secret.md', '# secret\nzebraprivatehidden\n');
  write(room, 'research/bud/.room-root', 'bud');
  write(room, 'research/bud/idea.md', '# idea\nzebraprivatebud\n');
  write(room, 'research/node_modules/pkg/README.md', '# pkg\nzebraprivatenodemodules\n');
  write(room, 'research/export/x.md', '# export\nzebraprivateexport\n');

  // Symlinks, created in a try/catch.
  let symlinks = true;
  try {
    write(outside, 'target.md', '# target\nzebraprivatelinkfile\n');
    write(outside, 'dir/inner.md', '# inner\nzebraoutsidedir\n');
    fs.symlinkSync(path.join(outside, 'target.md'), path.join(room, 'research', 'link-file.md'));
    fs.symlinkSync(path.join(outside, 'dir'), path.join(room, 'linksec'));
  } catch (_e) {
    symlinks = false;
  }

  return { scratch, room, symlinks };
}

// ── main ─────────────────────────────────────────────────────────────────

async function main() {
  const fx = buildFixture();
  const room = fx.room;
  const scratchKey = path.basename(fx.scratch);
  let handle = null;

  process.on('uncaughtException', (err) => {
    console.log(`  FAIL - uncaught exception: ${err && err.message ? err.message : err}`);
    process.exit(1);
  });

  const watchdog = setTimeout(() => {
    console.log('  FAIL - watchdog: test exceeded 60s');
    process.exit(1);
  }, 60000);
  if (watchdog.unref) watchdog.unref();

  try {
    // Modules load inside try/catch so a missing core file fails the checks.
    let core = null;
    let coreErr = null;
    try { core = require(CORE_FILE); } catch (e) { coreErr = e; }
    const needCore = () => {
      if (!core) throw new Error('lib/core/room-search.cjs failed to load: ' + (coreErr && coreErr.message));
      return core;
    };
    let roomTool = null;
    try { roomTool = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'room.cjs')); } catch (_e) { roomTool = null; }
    const pageRenderer = require(path.join(REPO_ROOT, 'lib', 'wiki', 'page-renderer.cjs'));
    const wikiServer = require(path.join(REPO_ROOT, 'lib', 'wiki', 'wiki-server.cjs'));

    const pageMap = () => pageRenderer.scanRoom(room).pages;
    const pageFilter = () => {
      const pages = pageMap();
      return (rel) => pages.has(toPosix(rel).replace(/\.md$/, ''));
    };

    if (!fx.symlinks) console.log('  SKIP - symlink checks (symlink not permitted)');

    // ── [core] ──────────────────────────────────────────────────────────
    check('[core] contract: exports and SECTION_RE equals the tool-router literal', () => {
      const c = needCore();
      assert.equal(typeof c.searchRoomDetailed, 'function');
      assert.equal(typeof c.searchRoom, 'function');
      assert.equal(typeof c.resolveSearchScope, 'function');
      assert.ok(c.SECTION_RE instanceof RegExp, 'SECTION_RE must be a RegExp');
      const router = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs'));
      assert.equal(String(c.SECTION_RE), String(router._test.SECTION_RE));
    });

    check('[core] reexport: room.cjs _internal holds the same function objects', () => {
      const c = needCore();
      assert.ok(roomTool && roomTool._internal, 'room.cjs must load');
      assert.strictEqual(roomTool._internal.searchRoomDetailed, c.searchRoomDetailed);
      assert.strictEqual(roomTool._internal.searchRoom, c.searchRoom);
    });

    check('[core] scope: resolveSearchScope accepts null and a section, rejects escapes', () => {
      const c = needCore();
      assert.equal(c.resolveSearchScope(room, null), path.resolve(room));
      assert.equal(c.resolveSearchScope(room, 'research'), path.join(path.resolve(room), 'research'));
      for (const bad of ['../x', 'a/b', 'Research']) {
        assert.throws(() => c.resolveSearchScope(room, bad), `section ${bad} must throw`);
      }
    });

    check('[core] scope: a section folder that links outside the room throws', () => {
      const c = needCore();
      if (!fx.symlinks) { console.log('  SKIP - scope symlink'); return; }
      assert.throws(() => c.resolveSearchScope(room, 'linksec'), 'symlinked section must throw');
    });

    check('[core] includeFile: an excluded file is never read and never counted', () => {
      const c = needCore();
      const raw = c.searchRoomDetailed(room, M.htmlOnly, null);
      assert.equal(raw.tier, 'phrase', 'a raw call must find the html-only marker');
      assert.ok(toPosix(raw.results[0].file).endsWith('research/brief/brief.html'));
      const mdOnly = (rel) => rel.toLowerCase().endsWith('.md');
      let filtered = null;
      const reads = countReads([scratchKey], () => {
        filtered = c.searchRoomDetailed(room, M.htmlOnly, null, { includeFile: mdOnly });
      });
      assert.equal(filtered.tier, 'none');
      assert.equal(filtered.walkable, raw.walkable - 1, 'walkable must not count the excluded file');
      const htmlReads = reads.filter((p) => p.endsWith('brief.html'));
      assert.equal(htmlReads.length, 0, 'brief.html must not be read');
    });

    check('[core] includeFile: applies before the phrase tier, so the word tier still runs', () => {
      const c = needCore();
      const raw = c.searchRoomDetailed(room, PHRASE, null);
      assert.equal(raw.tier, 'phrase');
      assert.equal(toPosix(raw.results[0].file), 'USER.md');
      const filtered = c.searchRoomDetailed(room, PHRASE, null, { includeFile: pageFilter() });
      assert.equal(filtered.tier, 'words');
      assert.equal(toPosix(filtered.results[0].file), 'research/heron/heron.md');
    });

    check('[core] maxPerFile: 5 rows by default for a busy file, 1 row with maxPerFile 1', () => {
      const c = needCore();
      const dflt = c.searchRoomDetailed(room, M.many, null);
      const one = c.searchRoomDetailed(room, M.many, null, { maxPerFile: 1 });
      const manyRel = 'research/many/many.md';
      assert.equal(dflt.results.filter((r) => toPosix(r.file) === manyRel).length, 5);
      assert.equal(one.results.filter((r) => toPosix(r.file) === manyRel).length, 1);
      const order = (res) => Array.from(new Set(res.results.map((r) => toPosix(r.file))));
      assert.deepEqual(order(one), order(dflt), 'the order of distinct files must not change');
    });

    check('[core] static floor: no Brain token, no MCP require, one walker under lib', () => {
      const src = fs.readFileSync(CORE_FILE, 'utf8');
      for (const token of ['mindrian-brain', 'onrender', 'brain-router.cjs', 'brain-client.cjs', 'axios']) {
        assert.ok(!src.includes(token), `core source must not contain ${token}`);
      }
      const requires = Array.from(stripComments(src).matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)).map((m) => m[1]);
      const allowed = ['node:fs', 'node:path', './room-path-containment.cjs'];
      for (const r of requires) {
        assert.ok(allowed.includes(r), `core requires only node:fs, node:path, room-path-containment; found ${r}`);
        assert.ok(!r.includes('zod') && !r.includes('/mcp/'), `core must not require ${r}`);
      }
      const roomSrc = stripComments(fs.readFileSync(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'room.cjs'), 'utf8'));
      assert.ok(!roomSrc.includes('readdirSync'), 'room.cjs must not contain readdirSync');
      assert.ok(!roomSrc.includes('function walkSearchFiles'), 'room.cjs must not define walkSearchFiles');
      const holders = listCjs(path.join(REPO_ROOT, 'lib'), [])
        .filter((f) => fs.readFileSync(f, 'utf8').includes('function walkSearchFiles'))
        .map((f) => toPosix(path.relative(REPO_ROOT, f)));
      assert.deepEqual(holders, ['lib/core/room-search.cjs']);
    });

    // ── [server] ────────────────────────────────────────────────────────
    handle = await wikiServer.startWikiServer(room, 0);
    const port = handle.port;

    check('[server] nested: the nested marker answers with the nested page id first', async () => {
      const r = await searchJson(port, 'q=' + enc(M.nested));
      assert.equal(r.status, 200, r.raw);
      assert.ok(r.json && !Array.isArray(r.json), 'the body must be an object; got ' + r.raw);
      const allowed = ['tier', 'results', 'scanned', 'walkable', 'truncated', 'reason_code', 'reason'];
      for (const k of Object.keys(r.json)) assert.ok(allowed.includes(k), `unexpected body key ${k}`);
      assert.ok(Array.isArray(r.json.results) && r.json.results.length >= 1, r.raw);
      const first = r.json.results[0];
      assert.equal(first.id, 'research/heron/heron');
      assert.deepEqual(Object.keys(first).sort(), ['excerpt', 'id', 'line', 'section', 'title']);
      assert.equal(first.section, 'research');
      assert.equal(first.title, pageMap().get('research/heron/heron').title);
      assert.ok(first.excerpt.includes('<mark>'), 'the excerpt must mark the match');
    });

    check('[server] privacy: private files, sub-rooms, links and html are never returned', async () => {
      const markers = PRIVATE_MARKERS.slice();
      markers.push(M.htmlOnly);
      for (const marker of markers) {
        if (!fx.symlinks && marker === 'zebraprivatelinkfile') continue;
        const r = await searchJson(port, 'q=' + enc(marker));
        assert.equal(r.status, 200, `${marker}: ${r.raw}`);
        assert.deepEqual(r.json.results, [], `${marker} must return no result; got ${r.raw}`);
        assert.ok(!r.raw.includes(marker), `${marker} must not appear in the body`);
      }
    });

    check('[server] words: a private phrase hit does not hide the word tier', async () => {
      const r = await searchJson(port, 'q=' + enc(PHRASE));
      assert.equal(r.status, 200, r.raw);
      assert.equal(r.json.tier, 'words');
      assert.equal(r.json.results[0].id, 'research/heron/heron');
      assert.ok(!r.json.results.some((x) => x.id === 'USER'), 'USER must not be a result');
      assert.ok(!r.raw.includes('zebraprivateuser'), 'the private marker must not appear');
    });

    check('[server] floor: a plain question below the floor says why', async () => {
      const r = await searchJson(port, 'q=' + enc(BAKERY_Q));
      assert.equal(r.status, 200, r.raw);
      assert.deepEqual(r.json.results, []);
      assert.equal(r.json.reason_code, 'below_relevance_floor');
      assert.ok(typeof r.json.reason === 'string' && r.json.reason.length > 0, 'reason must be a string');
    });

    check('[server] walk: no match reports the walk fields and the page count', async () => {
      const r = await searchJson(port, 'q=zzqqnomatch');
      assert.equal(r.status, 200, r.raw);
      assert.equal(r.json.reason_code, 'no_match');
      const pages = pageMap().size;
      assert.equal(r.json.walkable, pages);
      assert.equal(r.json.scanned, r.json.walkable);
      assert.equal(r.json.truncated, false);
    });

    check('[server] body: the query is never echoed', async () => {
      const r = await searchJson(port, 'q=zzqqnomatch');
      assert.ok(!r.raw.includes('zzqqnomatch'), 'the body must not carry the query');
      assert.ok(!('query' in r.json) && !('words' in r.json), 'no query or words key');
    });

    check('[server] escaping: script text in a page comes back escaped', async () => {
      const r = await searchJson(port, 'q=' + enc(M.xss));
      assert.equal(r.status, 200, r.raw);
      const hit = r.json.results.find((x) => x.id === 'research/xss/xss');
      assert.ok(hit, 'the xss page must be found; got ' + r.raw);
      assert.ok(hit.excerpt.includes('&lt;script&gt;'), hit.excerpt);
      assert.ok(hit.excerpt.includes('&quot;'), hit.excerpt);
      assert.ok(!/<script/i.test(hit.excerpt), 'no raw script tag');
      assert.ok(hit.excerpt.includes('<mark>'), 'the match is marked');
    });

    check('[server] window: a match past character 200 is shown', async () => {
      const r = await searchJson(port, 'q=' + enc(M.longMark));
      assert.equal(r.status, 200, r.raw);
      const hit = r.json.results.find((x) => x.id === 'research/long/long');
      assert.ok(hit, 'the long page must be found; got ' + r.raw);
      assert.ok(hit.excerpt.startsWith('...'), hit.excerpt);
      assert.ok(hit.excerpt.includes('<mark>' + M.longMark + '</mark>'), hit.excerpt);
    });

    check('[server] section: scopes the search and refuses a bad value', async () => {
      const scoped = await searchJson(port, 'q=otter&section=solution-design');
      assert.equal(scoped.status, 200, scoped.raw);
      assert.ok(scoped.json.results.length >= 1);
      for (const x of scoped.json.results) assert.ok(x.id.startsWith('solution-design/'), x.id);
      const all = await searchJson(port, 'q=otter');
      assert.ok(all.json.results.some((x) => x.id.startsWith('research/')), 'unscoped finds research');
      for (const bad of ['..%2Fx', 'Research', 'a%2Fb']) {
        const r = await searchJson(port, 'q=otter&section=' + bad);
        assert.equal(r.status, 400, `section=${bad}: ${r.raw}`);
      }
    });

    check('[server] limits: long query is 400, empty query is empty, limit is honored', async () => {
      const long = await searchJson(port, 'q=' + 'a'.repeat(501));
      assert.equal(long.status, 400, long.raw);
      const empty = await searchJson(port, 'q=');
      assert.equal(empty.status, 200, empty.raw);
      assert.deepEqual(empty.json.results, []);
      const one = await searchJson(port, 'q=otter&limit=1');
      assert.equal(one.status, 200, one.raw);
      assert.equal(one.json.results.length, 1);
    });

    check('[server] pages: one result per page, even when a page has many matching lines', async () => {
      const r = await searchJson(port, 'q=' + M.many);
      assert.equal(r.status, 200, r.raw);
      const ids = r.json.results.map((x) => x.id);
      assert.deepEqual(ids.slice().sort(), ['research/few/few', 'research/many/many']);
    });

    check('[server] page: /wiki/search shows the engine reason when nothing fits', async () => {
      const r = await httpGet(port, '/wiki/search?q=' + enc(BAKERY_Q));
      assert.equal(r.status, 200);
      assert.ok(r.body.includes('none matches enough of it to be an answer'), 'the reason text must show');
    });

    check('[server] page: /wiki/search escapes page text', async () => {
      const r = await httpGet(port, '/wiki/search?q=' + enc(M.xss));
      assert.equal(r.status, 200);
      assert.ok(r.body.includes('&lt;script&gt;'), 'escaped script text must show');
      assert.ok(!r.body.includes('<script>alert('), 'no raw page script');
    });

    // ── [client] ────────────────────────────────────────────────────────
    check('[client] script: inline scripts compile; the dropdown reads results and reason', async () => {
      const page = await httpGet(port, '/wiki/research/flat');
      assert.equal(page.status, 200);
      const blocks = Array.from(page.body.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi))
        .filter((m) => !/\bsrc\s*=/.test(m[1]) && !/type\s*=\s*["'](?!text\/javascript)/i.test(m[1]))
        .map((m) => m[2]);
      assert.ok(blocks.length >= 1, 'the page must carry inline scripts');
      blocks.forEach((code, i) => {
        assert.doesNotThrow(() => new vm.Script(code, { filename: 'inline-' + i + '.js' }), `inline script ${i} must compile`);
      });
      assert.ok(page.body.includes('data.results'), 'client must read data.results');
      assert.ok(page.body.includes('data.reason'), 'client must read data.reason');
      assert.ok(page.body.includes('&quot;'), 'escH must escape double quotes');
    });

    // ── [retire] ────────────────────────────────────────────────────────
    check('[retire] old index: wiki-search.cjs is gone and nothing requires flexsearch', () => {
      assert.ok(!fs.existsSync(path.join(REPO_ROOT, 'lib', 'wiki', 'wiki-search.cjs')), 'wiki-search.cjs must be deleted');
      const files = listCjs(path.join(REPO_ROOT, 'lib'), []).concat(listCjs(path.join(REPO_ROOT, 'scripts'), []));
      const users = files.filter((f) => /require\(\s*['"]flexsearch['"]\s*\)/.test(stripComments(fs.readFileSync(f, 'utf8'))));
      assert.deepEqual(users.map((f) => path.relative(REPO_ROOT, f)), []);
    });

    check('[retire] server: wiki-server requires the core engine and no old index', () => {
      const raw = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'wiki', 'wiki-server.cjs'), 'utf8');
      const src = stripComments(raw);
      assert.ok(raw.includes("require('../core/room-search.cjs')"), 'must require the core engine');
      for (const gone of ['wiki-search', 'flexsearch', 'tools/room.cjs', 'pagesSignature']) {
        assert.ok(!src.includes(gone), `wiki-server code must not contain ${gone}`);
      }
    });

    // ── [hygiene] ───────────────────────────────────────────────────────
    check('[hygiene] this file has no em-dash and no en-dash', () => {
      const own = fs.readFileSync(__filename, 'utf8');
      const banned = [String.fromCharCode(0x2014), String.fromCharCode(0x2013)];
      for (const ch of banned) assert.ok(!own.includes(ch), 'dash U+' + ch.charCodeAt(0).toString(16) + ' found');
    });

    await runChecks();
  } finally {
    if (handle) {
      try { if (handle.watcher && handle.watcher.close) await handle.watcher.close(); } catch (_e) { /* ignore */ }
      try { handle.server.close(); } catch (_e) { /* ignore */ }
    }
    cleanupDir(fx.scratch);
  }

  console.log(`\ntest-visible-room-search-engine: ${pass}/${total} passed`);
  process.exit(fail > 0 || pass !== total ? 1 : 0);
}

main().catch((err) => {
  console.log(`  FAIL - fatal: ${err && err.stack ? err.stack : err}`);
  process.exit(1);
});
