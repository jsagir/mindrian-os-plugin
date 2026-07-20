'use strict';
// Phase 232-04 -- wiki-server.cjs integration test (SPEC Req 2/4/5/6).
//
// Boots the real Express wiki server (startWikiServer) on a fresh temp COPY of
// the checked-in fixture room tests/fixtures/wiki-room-232 (the fixture itself is
// never mutated) and exercises every route Plan 04 wires:
//   - GET /wiki             -> Room Home dashboard (id="room-home", no Cytoscape)
//   - GET /wiki/graph       -> Cytoscape graph, canonical hex (#1E52E0)
//   - GET /wiki/<article>   -> BlockNote editor mount + info-rail Backlinks panel
//   - GET /api/raw/...      -> frontmatter-stripped body JSON
//   - POST /api/save/...    -> direct overwrite, frontmatter preserved (Req 2)
//   - GET /editor/...       -> the vendored bundle served via express.static
//   - POST /api/briefing    -> shape-only (200/502/503, never 404; key varies)
//
// To make the info-rail Backlinks panel render, the test seeds a real LazyGraph
// (an INFORMS edge other-note -> test-article) in the scratch copy via
// lazygraph-ops. getBacklinks/getSeeAlso read that SQLite graph unchanged (D-10);
// the fixture has no graph of its own, so backlinks are empty without this seed.
//
// The briefing leg is deliberately shape-only: whether an ANTHROPIC key resolves
// varies by machine, so the plan accepts 200/502/503 and only asserts the `ok`
// key and a non-404 status (the briefing logic is unit-tested hermetically in
// tests/test-232-briefing.cjs).
//
// Plain node asserts, process.exit(1) on failure. NO em-dashes (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURE_ROOM = path.join(REPO_ROOT, 'tests', 'fixtures', 'wiki-room-232');
const { startWikiServer } = require(path.join(REPO_ROOT, 'lib', 'wiki', 'wiki-server.cjs'));
const lazy = require(path.join(REPO_ROOT, 'lib', 'core', 'lazygraph-ops.cjs'));

const PORT = 8427;
const BASE = `http://localhost:${PORT}`;

let pass = 0;
let total = 0;
async function check(label, fn) {
  total += 1;
  await fn();
  pass += 1;
  console.log('  ok -', label);
}

// Seed a LazyGraph so getBacklinks(test-article) returns the other-note backlink.
async function seedGraph(roomDir) {
  const { conn } = await lazy.openGraph(roomDir);
  try {
    const other = path.join(roomDir, 'market-analysis', 'other-note.md');
    const article = path.join(roomDir, 'problem-definition', 'test-article.md');
    await lazy.indexArtifact(conn, roomDir, other);
    await lazy.indexArtifact(conn, roomDir, article);
    const r = lazy.upsertEdge(conn, {
      type: 'INFORMS',
      source: 'market-analysis/other-note',
      target: 'problem-definition/test-article',
    });
    assert.equal(r.ok, true, 'seed INFORMS edge should write');
  } finally {
    await lazy.closeGraph(conn);
  }
}

async function main() {
  // Fresh scratch copy of the fixture room (never mutate the fixture).
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-232-'));
  const room = path.join(scratch, 'room');
  fs.cpSync(FIXTURE_ROOM, room, { recursive: true });

  await seedGraph(room);

  const handle = await startWikiServer(room, PORT);
  let failed = false;
  try {
    await check('GET /wiki renders Room Home (id="room-home", no Cytoscape)', async () => {
      const res = await fetch(`${BASE}/wiki`);
      assert.equal(res.status, 200);
      const body = await res.text();
      assert.ok(body.includes('id="room-home"'), 'expected id="room-home"');
      assert.ok(!body.includes('id="cy"'), 'home must NOT contain the Cytoscape canvas');
    });

    await check('GET /wiki/graph renders Cytoscape with canonical hex', async () => {
      const res = await fetch(`${BASE}/wiki/graph`);
      assert.equal(res.status, 200);
      const body = await res.text();
      assert.ok(body.includes('id="cy"'), 'expected the Cytoscape canvas id="cy"');
      assert.ok(body.includes('#1E52E0'), 'expected canonical INFORMS hex #1E52E0');
    });

    await check('GET article renders editor mount + info-rail Backlinks panel', async () => {
      const res = await fetch(`${BASE}/wiki/problem-definition/test-article`);
      assert.equal(res.status, 200);
      const body = await res.text();
      assert.ok(body.includes('mos-editor-root'), 'expected the editor mount div');
      assert.ok(body.includes('/editor/wiki-editor.js'), 'expected the editor bundle script');
      assert.ok(body.includes('What Links Here'), 'expected the Backlinks panel heading');
    });

    await check('GET /api/raw returns frontmatter-stripped body', async () => {
      const res = await fetch(`${BASE}/api/raw/problem-definition/test-article`);
      assert.equal(res.status, 200);
      const j = await res.json();
      assert.equal(j.id, 'problem-definition/test-article');
      assert.ok(j.markdown.includes('[[other-note]]'), 'body should carry the wikilink');
      assert.ok(!j.markdown.includes('title:'), 'frontmatter must be stripped');
    });

    await check('POST /api/save overwrites body, preserves frontmatter', async () => {
      const res = await fetch(`${BASE}/api/save/problem-definition/test-article`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ markdown: 'edited body zx232saved' }),
      });
      assert.equal(res.status, 200);
      const j = await res.json();
      assert.equal(j.ok, true);
      const onDisk = fs.readFileSync(path.join(room, 'problem-definition', 'test-article.md'), 'utf8');
      assert.ok(onDisk.includes('zx232saved'), 'new body should be written');
      assert.ok(onDisk.startsWith('---'), 'file should still begin with frontmatter');
      assert.ok(onDisk.includes('title: Test Article'), 'frontmatter title should be preserved');
    });

    await check('POST /api/save 404 for unknown page, 400 for missing markdown', async () => {
      const r404 = await fetch(`${BASE}/api/save/problem-definition/nope`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ markdown: 'x' }),
      });
      assert.equal(r404.status, 404);
      const r400 = await fetch(`${BASE}/api/save/problem-definition/test-article`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.equal(r400.status, 400);
    });

    await check('GET /editor/wiki-editor.js is served (static mount live)', async () => {
      const res = await fetch(`${BASE}/editor/wiki-editor.js`);
      assert.equal(res.status, 200);
    });

    await check('POST /api/briefing returns an ok-keyed JSON, never 404', async () => {
      const res = await fetch(`${BASE}/api/briefing`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      assert.notEqual(res.status, 404, 'briefing route must be registered');
      assert.ok([200, 502, 503].includes(res.status), `unexpected status ${res.status}`);
      const j = await res.json();
      assert.ok(Object.prototype.hasOwnProperty.call(j, 'ok'), 'response must carry an ok key');
    });
  } catch (e) {
    failed = true;
    console.error('  FAIL -', e && e.message ? e.message : e);
  } finally {
    try { if (handle.watcher && handle.watcher.close) await handle.watcher.close(); } catch (_e) { /* ignore */ }
    try { handle.server.close(); } catch (_e) { /* ignore */ }
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  }

  console.log(`\ntest-232-wiki-server: ${pass}/${total} passed`);
  if (failed || pass !== total) process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
