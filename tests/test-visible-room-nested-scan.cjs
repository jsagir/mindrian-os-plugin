'use strict';
// quick 261012-ri7 -- the wiki scanRoom walks nested decision-16 artifacts.
//
// RED-then-GREEN fixture test. The fixture room is built fresh in os.tmpdir()
// on every run and deleted at the end; nothing here is checked in (the
// pre-commit hook walks staged dirs for .room-root, so a checked-in sub-room
// fixture would trip it).
//
// Groups, in order: [scan] [index] [render] [view] [server] [export] [census].
// Each check name starts with its group tag. No em-dashes, no en-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const REPO_ROOT = path.resolve(__dirname, '..');

// The signature spy must be installed BEFORE wiki-server.cjs is required:
// wiki-server destructures rebuildIndex at require time.
const wikiSearch = require(path.join(REPO_ROOT, 'lib', 'wiki', 'wiki-search.cjs'));
let rebuildCalls = 0;
{
  const original = wikiSearch.rebuildIndex;
  wikiSearch.rebuildIndex = function countingRebuildIndex(...args) {
    rebuildCalls += 1;
    return original.apply(this, args);
  };
}

const pageRenderer = require(path.join(REPO_ROOT, 'lib', 'wiki', 'page-renderer.cjs'));
const wikiExport = require(path.join(REPO_ROOT, 'lib', 'wiki', 'wiki-export.cjs'));
const wikiServer = require(path.join(REPO_ROOT, 'lib', 'wiki', 'wiki-server.cjs'));
const viewsInternal = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'views.cjs'))._internal;

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

// Raw request: no URL normalization, so a percent-encoded dot path arrives as
// written.
function httpRequest(port, method, reqPath, jsonBody) {
  return new Promise((resolve, reject) => {
    const payload = jsonBody === undefined ? null : Buffer.from(JSON.stringify(jsonBody));
    const headers = payload
      ? { 'content-type': 'application/json', 'content-length': payload.length }
      : {};
    const req = http.request({ host: '127.0.0.1', port, path: reqPath, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const httpGet = (port, p) => httpRequest(port, 'GET', p);

// Local copies of the census helpers (the test-270 style: declared per file on
// purpose, never required from test-270).
function stripComments(src) {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

function extractFunctionBodies(src) {
  const results = [];
  const re = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1];
    let i = re.lastIndex;
    let parenDepth = 1;
    while (i < src.length && parenDepth > 0) {
      if (src[i] === '(') parenDepth += 1;
      else if (src[i] === ')') parenDepth -= 1;
      i += 1;
    }
    let j = i;
    while (j < src.length && src[j] !== '{') j += 1;
    if (j >= src.length) { re.lastIndex = i; continue; }
    let braceDepth = 1;
    let k = j + 1;
    while (k < src.length && braceDepth > 0) {
      if (src[k] === '{') braceDepth += 1;
      else if (src[k] === '}') braceDepth -= 1;
      k += 1;
    }
    results.push({ name, body: src.slice(j, k) });
    re.lastIndex = k;
  }
  return results;
}

// ── fixture ──────────────────────────────────────────────────────────────

const BAD_FM_TEXT = [
  '---',
  'title: ok',
  'broken: [unclosed',
  '---',
  'body zebrabadfm',
  '',
].join('\n');

function buildFixture() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'ri7-nested-'));
  const room = path.join(scratch, 'room');
  const outside = path.join(scratch, 'outside');
  fs.mkdirSync(room, { recursive: true });
  fs.mkdirSync(outside, { recursive: true });

  // Root: identity files (never pages) and one public file.
  write(room, 'ROOM.md', '# room\nzebraprivateroom\n');
  write(room, 'USER.md', '# user\nzebraprivateuser\n');
  write(room, 'STATE.md', '# state\nzebraprivatestate\n');
  write(room, 'MINTO.md', '# minto\nzebraprivateminto\n');
  write(room, 'README.md', '# Readme\nplain root page\n');

  // research: flat files and the nested decision-16 shapes.
  write(room, 'research/flat.md', '# Flat\nflat body\n');
  write(room, 'research/STATE.md', '# section state\nzebraprivatesectionstate\n');
  write(room, 'research/name.md', '---\ntitle: Flat Name\n---\n# Flat Name\nflat name body\n');
  write(
    room,
    'research/name/name.md',
    [
      '# Name',
      '',
      'Links: [[name]] and [[research/other/name|other]] and [[b]] and [[research/solo]].',
      '',
    ].join('\n')
  );
  write(room, 'research/name/other.md', '# Other\nsibling of the nested artifact\n');
  write(room, 'research/name/STATE.md', '# nested state\nzebraprivatenestedstate\n');
  write(room, 'research/name/.draft.md', '# draft\nzebraprivatedraft\n');
  write(room, 'research/other/name.md', '# Other Name\nsame basename, other folder\n');
  write(room, 'research/solo/solo.md', '# Solo\nsolo artifact\n');
  write(room, 'research/deep/a/b.md', '# Deep B\nzebranestedonly\n');
  write(room, 'research/bad-fm/bad-fm.md', BAD_FM_TEXT);

  // Excluded: hidden, sub-room, node_modules, export.
  write(room, 'research/.hidden/secret.md', '# secret\nzebraprivatehidden\n');
  write(room, 'research/bud/.room-root', 'bud');
  write(room, 'research/bud/idea.md', '# idea\nzebraprivatebud\n');
  write(room, 'research/node_modules/pkg/README.md', '# pkg\nzebraprivatenodemodules\n');
  write(room, 'research/export/x.md', '# export\nzebraprivateexport\n');

  // A section with no direct .md file.
  write(room, 'solution-design/thing/thing.md', '# Thing\nthing body\n');

  // A top-level sub-room.
  write(room, 'bud-top/.room-root', 'bud-top');
  write(room, 'bud-top/idea.md', '# idea\nzebraprivatebudtop\n');

  // Symlinks, created in a try/catch.
  let symlinks = true;
  try {
    write(outside, 'target.md', '# target\nzebraprivatelinkfile\n');
    write(outside, 'dir/inner.md', '# inner\nzebraprivatelinkdir\n');
    fs.symlinkSync(path.join(outside, 'target.md'), path.join(room, 'research', 'link-file.md'));
    fs.symlinkSync(path.join(outside, 'dir'), path.join(room, 'research', 'link-dir'));
  } catch (_e) {
    symlinks = false;
  }

  return { scratch, room, symlinks };
}

const EXPECTED_IDS = [
  'README',
  'research/bad-fm/bad-fm',
  'research/deep/a/b',
  'research/flat',
  'research/name',
  'research/name/name',
  'research/name/other',
  'research/other/name',
  'research/solo/solo',
  'solution-design/thing/thing',
];

const PRIVATE_MARKERS = [
  'zebraprivateroom',
  'zebraprivateuser',
  'zebraprivatestate',
  'zebraprivateminto',
  'zebraprivatesectionstate',
  'zebraprivatenestedstate',
  'zebraprivatedraft',
  'zebraprivatehidden',
  'zebraprivatebud',
  'zebraprivatenodemodules',
  'zebraprivateexport',
  'zebraprivatebudtop',
  'zebraprivatelinkfile',
  'zebraprivatelinkdir',
];

// ── main ─────────────────────────────────────────────────────────────────

async function main() {
  const fx = buildFixture();
  const room = fx.room;
  let handle = null;
  const exportOut = path.join(fx.scratch, 'export-out');

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
    // Sanity guard for the bad-frontmatter fixture: gray-matter must throw.
    const matter = require('gray-matter');
    let grayMatterThrows = false;
    try { matter(BAD_FM_TEXT); } catch (_e) { grayMatterThrows = true; }

    if (!fx.symlinks) console.log('  SKIP - symlink checks (symlink not permitted)');

    // ── [scan] ──────────────────────────────────────────────────────────
    check('[scan] ids: nested pages get room-relative ids (10 pages)', () => {
      const { pages } = pageRenderer.scanRoom(room);
      assert.deepEqual(Array.from(pages.keys()).sort(), EXPECTED_IDS);
    });

    check('[scan] distinct: name, name/name and other/name are 3 entries with 3 paths', () => {
      const { pages } = pageRenderer.scanRoom(room);
      const ids = ['research/name', 'research/name/name', 'research/other/name'];
      const paths = new Set();
      for (const id of ids) {
        assert.ok(pages.has(id), `missing page ${id}`);
        paths.add(pages.get(id).path);
      }
      assert.equal(paths.size, 3, 'the 3 pages must have 3 different file paths');
    });

    check('[scan] sections: only research and solution-design, pages in codepoint order', () => {
      const { pages, sections } = pageRenderer.scanRoom(room);
      assert.deepEqual(Array.from(sections.keys()).sort(), ['research', 'solution-design']);
      const research = sections.get('research').pages;
      const expected = EXPECTED_IDS.filter((id) => id.startsWith('research/'));
      assert.equal(expected.length, 8);
      assert.deepEqual(research, expected);
      for (const [id, page] of pages) {
        if (id === 'README') continue;
        assert.ok(
          page.section === 'research' || page.section === 'solution-design',
          `page ${id} has section ${page.section}`
        );
      }
    });

    check('[scan] shape: page keys and titles', () => {
      const { pages } = pageRenderer.scanRoom(room);
      const page = pages.get('research/name/name');
      assert.ok(page, 'research/name/name must be a page');
      assert.deepEqual(Object.keys(page).sort(), ['content', 'frontmatter', 'id', 'path', 'section', 'title']);
      assert.equal(page.title, 'Name');
      const flat = pages.get('research/name');
      assert.ok(flat, 'research/name must be a page');
      assert.equal(flat.title, 'Flat Name');
    });

    check('[scan] excluded: no private, hidden, sub-room, export or link page', () => {
      const { pages } = pageRenderer.scanRoom(room);
      const banned = ['STATE', 'bud', 'node_modules', 'export', 'link-file', 'link-dir', 'inner'];
      for (const [id, page] of pages) {
        const segs = id.split('/');
        for (const seg of segs) {
          assert.ok(!seg.startsWith('.'), `page id "${id}" has a dot segment`);
          for (const b of banned) {
            assert.ok(!seg.includes(b), `page id "${id}" contains "${b}"`);
          }
        }
        for (const marker of PRIVATE_MARKERS) {
          assert.ok(!page.content.includes(marker), `page ${id} carries private marker ${marker}`);
        }
      }
      for (const root of ['ROOM', 'USER', 'STATE', 'MINTO']) {
        assert.ok(!pages.has(root), `root ${root} must not be a page`);
      }
    });

    check('[scan] badfm: malformed frontmatter keeps the body and warns, never throws', () => {
      assert.ok(grayMatterThrows, 'fixture precondition: gray-matter must throw on the bad text');
      const result = pageRenderer.scanRoom(room);
      const page = result.pages.get('research/bad-fm/bad-fm');
      assert.ok(page, 'research/bad-fm/bad-fm must be a page');
      assert.deepEqual(page.frontmatter, {});
      assert.ok(page.content.includes('zebrabadfm'), 'body must be kept');
      assert.ok(!page.content.trimStart().startsWith('---'), 'the --- block must be removed');
      assert.ok(Array.isArray(result.scanWarnings), 'scanWarnings must be an array');
      assert.ok(
        result.scanWarnings.some(
          (w) => w.path === 'research/bad-fm/bad-fm.md' && w.reason === 'frontmatter_parse_failed'
        ),
        'scanWarnings must list the bad file'
      );
    });

    // ── [index] ─────────────────────────────────────────────────────────
    check('[index] precedence: the shortest id wins a shared basename; folder path resolves', () => {
      const { pages } = pageRenderer.scanRoom(room);
      const index = pageRenderer.buildPageIndex(pages);
      assert.equal(index.get('name'), '/wiki/research/name');
      assert.equal(index.get('b'), '/wiki/research/deep/a/b');
      assert.equal(index.get('research/other/name'), '/wiki/research/other/name');
      assert.equal(index.get('research/name'), '/wiki/research/name');
      assert.equal(index.get('research/solo'), '/wiki/research/solo/solo');
    });

    // ── [render] ────────────────────────────────────────────────────────
    check('[render] links: nested wikilinks render to real page URLs', () => {
      const { pages } = pageRenderer.scanRoom(room);
      const index = pageRenderer.buildPageIndex(pages);
      const html = pageRenderer.renderPage(pages.get('research/name/name'), index).html;
      for (const href of [
        'href="/wiki/research/name"',
        'href="/wiki/research/other/name"',
        'href="/wiki/research/deep/a/b"',
        'href="/wiki/research/solo/solo"',
      ]) {
        assert.ok(html.includes(href), `rendered html must contain ${href}; got: ${html}`);
      }
    });

    // ── [view] ──────────────────────────────────────────────────────────
    check('[view] nested: view_compile wiki compiles a nested page id', () => {
      const r = viewsInternal.compileView('wiki', room, { pageId: 'research/name/name' });
      assert.equal(r.ok, true);
      assert.equal(r.compiled_page, 'research/name/name');
      assert.equal(r.page_count, 10);
    });

    // ── [server] ────────────────────────────────────────────────────────
    handle = await wikiServer.startWikiServer(room, 0);
    const port = handle.port;

    check('[server] routes: nested page, raw, search and traversal refusal', async () => {
      const page = await httpGet(port, '/wiki/research/name/name');
      assert.equal(page.status, 200, 'nested page route');
      assert.ok(page.body.includes('data-page-id="research/name/name"'), 'editor mount carries the nested id');

      const deep = await httpGet(port, '/wiki/research/deep/a/b');
      assert.equal(deep.status, 200, 'deep nested page route');

      const rawEncoded = await httpGet(port, '/api/raw/research/name%2Fname');
      assert.equal(rawEncoded.status, 200, 'raw with the editor-encoded form');
      assert.equal(JSON.parse(rawEncoded.body).id, 'research/name/name');
      const rawPlain = await httpGet(port, '/api/raw/research/name/name');
      assert.equal(rawPlain.status, 200, 'raw with plain slashes');
      assert.equal(JSON.parse(rawPlain.body).id, 'research/name/name');

      const search = await httpGet(port, '/api/search?q=zebranestedonly');
      assert.equal(search.status, 200);
      const results = JSON.parse(search.body);
      assert.ok(
        Array.isArray(results) && results.some((r) => r.id === 'research/deep/a/b'),
        `search must return the nested page; got ${search.body}`
      );

      const trav = await httpGet(port, '/wiki/research/..%2F..%2Fetc');
      assert.equal(trav.status, 404, 'encoded traversal on the page route');
    });

    check('[server] signature: no file change means no FlexSearch rebuild; a change is searchable', async () => {
      const before = rebuildCalls;
      await httpGet(port, '/wiki/research/flat');
      await httpGet(port, '/wiki/research/flat');
      assert.equal(rebuildCalls - before, 0, 'two views with no file change must add 0 rebuildIndex calls');

      write(room, 'research/deep/a/fresh.md', '# Fresh\nzebrafreshmarker\n');
      const view = await httpGet(port, '/wiki/research/flat');
      assert.equal(view.status, 200);
      const search = await httpGet(port, '/api/search?q=zebrafreshmarker');
      const results = JSON.parse(search.body);
      assert.ok(
        Array.isArray(results) && results.some((r) => r.id === 'research/deep/a/fresh'),
        `search must find the new nested file; got ${search.body}`
      );
      fs.rmSync(path.join(room, 'research', 'deep', 'a', 'fresh.md'), { force: true });
    });

    check('[server] save: traversal id is 404; a nested save writes the nested file', async () => {
      const bad = await httpRequest(port, 'POST', '/api/save/research/..%2F..%2Fx', { markdown: 'zx-ri7-bad' });
      assert.equal(bad.status, 404, 'encoded traversal on the save route');

      const ok = await httpRequest(port, 'POST', '/api/save/research/name%2Fname', { markdown: 'zx-ri7-saved' });
      assert.equal(ok.status, 200, 'nested save');
      const onDisk = fs.readFileSync(path.join(room, 'research', 'name', 'name.md'), 'utf8');
      assert.ok(onDisk.includes('zx-ri7-saved'), 'the nested file must carry the new body');
    });

    // ── [export] ────────────────────────────────────────────────────────
    check('[export] paths: 3 pages with the same basename write 3 files with working links', async () => {
      await wikiExport.exportStaticWiki(room, exportOut);
      const a = path.join(exportOut, 'research', 'name.html');
      const b = path.join(exportOut, 'research', 'name', 'name.html');
      const c = path.join(exportOut, 'research', 'other', 'name.html');
      for (const f of [a, b, c]) assert.ok(fs.existsSync(f), `missing export file ${f}`);
      const nested = fs.readFileSync(b, 'utf8');
      assert.ok(
        nested.includes('href="../../research/other/name.html"'),
        'nested article must link with a 2-level prefix'
      );
      const flat = fs.readFileSync(path.join(exportOut, 'research', 'flat.html'), 'utf8');
      assert.ok(!/href="\.\.\/\.\.\//.test(flat), 'a 2-segment article must keep the 1-level prefix');
    });

    // ── [census] ────────────────────────────────────────────────────────
    check('[census] reuse: the walk uses discoverSections and isRealpathContained, no second descent', () => {
      const src = stripComments(
        fs.readFileSync(path.join(REPO_ROOT, 'lib', 'wiki', 'page-renderer.cjs'), 'utf8')
      );
      assert.ok(src.includes("require('../core/section-registry.cjs')"), 'must require section-registry');
      assert.ok(src.includes('discoverSections('), 'must call discoverSections(');
      assert.ok(src.includes("require('../core/room-path-containment.cjs')"), 'must require room-path-containment');
      assert.ok(src.includes('isRealpathContained('), 'must call isRealpathContained(');
      const offenders = extractFunctionBodies(src)
        .filter((fn) => fn.body.indexOf('readdirSync') !== -1 && fn.body.indexOf(fn.name + '(') !== -1)
        .map((fn) => fn.name);
      assert.deepEqual(offenders, [], 'no function may be both readdirSync-calling and self-recursive');
    });

    await runChecks();
  } finally {
    if (handle) {
      try { if (handle.watcher && handle.watcher.close) await handle.watcher.close(); } catch (_e) { /* ignore */ }
      try { handle.server.close(); } catch (_e) { /* ignore */ }
    }
    cleanupDir(fx.scratch);
  }

  console.log(`\ntest-visible-room-nested-scan: ${pass}/${total} passed`);
  process.exit(fail > 0 || pass !== total ? 1 : 0);
}

main().catch((err) => {
  console.log(`  FAIL - fatal: ${err && err.stack ? err.stack : err}`);
  process.exit(1);
});
