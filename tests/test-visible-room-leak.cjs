'use strict';
// quick 260923-lu5 -- Visible Room export/live-wiki dot-directory privacy leak.
// SEED-006 Wave 0 (Q0.1, Q0.2, Q0.5 bind half), EXECUTION-PLAYBOOK T0.1.
//
// RED-then-GREEN regression test built on a runtime tmp fixture. Nothing here
// is checked in: the fixture (private dot-dirs, a real SQLite room.db, a
// sub-room, db sidecars) is built fresh in os.tmpdir() on every run, never in
// the repo tree (the pre-commit hook walks staged dirs for .room-root, so a
// checked-in sub-room fixture would trip it).
//
// Groups, in order: [scan] [view] [export] [source] [server]. Each check name
// starts with its group tag. Later tasks (and tests/run-all-visible-room.sh)
// grep those tags. No em-dashes (CLAUDE.md HARD RULE) -- hyphens only.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { DatabaseSync } = require('node:sqlite');

const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURE_ROOM = path.join(REPO_ROOT, 'tests', 'fixtures', 'wiki-room-232');

const pageRenderer = require(path.join(REPO_ROOT, 'lib', 'wiki', 'page-renderer.cjs'));
const wikiExport = require(path.join(REPO_ROOT, 'lib', 'wiki', 'wiki-export.cjs'));
const wikiServer = require(path.join(REPO_ROOT, 'lib', 'wiki', 'wiki-server.cjs'));
const viewsInternal = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'views.cjs'))._internal;

// Every private-file sentinel. A GREEN run must never leak any of these
// through a public surface.
const SENTINELS = [
  'zebracontextleak',
  'zebrasnapshotleak',
  'zebramindrianleak',
  'zebraintelleak',
  'zebrauserleak',
  'zebrabudleak',
  'zebradbleak',
  'zebrasectiondb',
  'zebrasectionwal',
];

let pass = 0;
let fail = 0;
let total = 0;

// checks run strictly in registration order (later checks depend on state
// earlier checks build -- the export output dirs, the live server handle),
// but a failure never aborts the run: every check is attempted and reported.
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

// Buffer containing any sentinel word (case-sensitive, raw-byte search).
function bufferHasSentinel(buf) {
  const str = buf.toString('utf8');
  return SENTINELS.some((s) => str.includes(s));
}

function stringHasSentinel(str) {
  return SENTINELS.some((s) => str.includes(s));
}

// Recursively collect every file under dir, relative paths, posix-separated.
function walkFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

const DB_SIDECAR_RE = /\.(db|sqlite|sqlite3|db3)(-wal|-shm|-journal)?$/i;

// ── Fixture construction ──────────────────────────────────────────────────

function buildFixture() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-leak-'));
  const room = path.join(scratch, 'room');
  fs.cpSync(FIXTURE_ROOM, room, { recursive: true });

  fs.mkdirSync(path.join(room, '.context'), { recursive: true });
  fs.writeFileSync(path.join(room, '.context', 'last-session.md'), '# last session\nzebracontextleak\n');

  fs.mkdirSync(path.join(room, '.snapshots'), { recursive: true });
  fs.writeFileSync(path.join(room, '.snapshots', 'STATE-2026-09-01.md'), '# snapshot\nzebrasnapshotleak\n');

  fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(room, '.mindrian', 'last-post-compact.md'), '# post compact\nzebramindrianleak\n');

  fs.mkdirSync(path.join(room, '.intelligence'), { recursive: true });
  fs.writeFileSync(path.join(room, '.intelligence', 'notes.md'), '# intelligence notes\nzebraintelleak\n');

  fs.writeFileSync(path.join(room, 'USER.md'), '# user\nzebrauserleak\n');

  fs.mkdirSync(path.join(room, 'bud-room'), { recursive: true });
  fs.writeFileSync(path.join(room, 'bud-room', '.room-root'), 'bud-room');
  fs.writeFileSync(path.join(room, 'bud-room', 'idea.md'), '# idea\nzebrabudleak\n');

  // A REAL SQLite db -- the wiki's graph readers open this file, so it must
  // be valid, not a placeholder blob. Reuses the canonical `facts` table name
  // (scripts/check-schema-aliases.cjs ALLOWED_EXISTING_TABLES, Phase 108 D-05)
  // rather than inventing a throwaway schema name: this is a disposable
  // test-only fixture db, never opened through lib/core/lazygraph-ops.cjs, so
  // no real schema compatibility is implied by the reused name.
  const dbPath = path.join(room, '.mindrian', 'room.db');
  const db = new DatabaseSync(dbPath);
  db.exec('CREATE TABLE facts (v TEXT)');
  db.prepare('INSERT INTO facts (v) VALUES (?)').run('zebradbleak');
  db.close();

  fs.mkdirSync(path.join(room, 'research'), { recursive: true });
  fs.writeFileSync(path.join(room, 'research', 'data.db'), Buffer.from('zebrasectiondb'));
  fs.writeFileSync(path.join(room, 'research', 'data.db-wal'), Buffer.from('zebrasectionwal'));

  // Minimal valid 8-byte PNG signature plus a few bytes -- enough to be a
  // real, distinct, byte-comparable file; not a real image.
  fs.writeFileSync(
    path.join(room, 'research', 'figure.png'),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03])
  );

  fs.writeFileSync(
    path.join(room, 'research', 'a.md'),
    [
      '---',
      'title: Research A',
      '---',
      '# Research A',
      '',
      'publicmarkerok',
      '',
      '![fig](/room-assets/research/figure.png)',
      '![db](/room-assets/.mindrian/room.db)',
      '![sectiondb](/room-assets/research/data.db)',
      '',
    ].join('\n')
  );

  return { scratch, room };
}

function cleanupDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_e) {
    /* best-effort cleanup */
  }
}

// ── HTTP helper for the [server] group ──────────────────────────────────

function httpGet(port, reqPath) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: reqPath }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') });
      });
    });
    req.on('error', reject);
  });
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const fx = buildFixture();
  const room = fx.room;

  // Safety guards for the [server] group so a RED run never hangs.
  let watchdogTimer = null;
  let handle = null;
  let secondScratch = null;
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-leak-out-'));

  process.on('uncaughtException', (err) => {
    console.log(`  FAIL - [server] uncaught exception: ${err && err.message ? err.message : err}`);
    process.exitCode = 1;
    process.exit(1);
  });

  watchdogTimer = setTimeout(() => {
    console.log('  FAIL - [server] watchdog: test exceeded 60s');
    process.exit(1);
  }, 60000);
  if (watchdogTimer.unref) watchdogTimer.unref();

  try {
    // ── [scan] group ───────────────────────────────────────────────────
    check('[scan] 1: scanRoom sections exclude private/sub-room names, include real sections', () => {
      const { sections } = pageRenderer.scanRoom(room);
      const keys = Array.from(sections.keys());
      for (const k of keys) {
        assert.ok(!k.startsWith('.'), `section key "${k}" must not start with a dot`);
      }
      assert.ok(!keys.includes('bud-room'), 'sections must not include bud-room (sub-room)');
      assert.ok(!keys.includes('export'), 'sections must not include export');
      assert.ok(!keys.includes('exports'), 'sections must not include exports');
      assert.ok(keys.includes('research'), 'sections must include research');
      assert.ok(keys.includes('problem-definition'), 'sections must include problem-definition');
      assert.ok(keys.includes('market-analysis'), 'sections must include market-analysis');
    });

    check('[scan] 2: scanRoom pages exclude dot-segments, USER, bud-room; include research/a', () => {
      const { pages } = pageRenderer.scanRoom(room);
      const ids = Array.from(pages.keys());
      for (const id of ids) {
        const segs = id.split('/');
        for (const seg of segs) {
          assert.ok(!seg.startsWith('.'), `page id "${id}" must not have a dot segment`);
        }
      }
      assert.ok(!ids.includes('USER'), 'pages must not include USER');
      assert.ok(!ids.some((id) => id.startsWith('bud-room/')), 'pages must not include bud-room/*');
      assert.ok(ids.includes('research/a'), 'pages must include research/a');
    });

    check('[scan] 3: isPrivateRoomPath classifies dot paths, db/sidecars, root identity files', () => {
      assert.ok(typeof pageRenderer.isPrivateRoomPath === 'function', 'page-renderer must export isPrivateRoomPath');
      const isP = pageRenderer.isPrivateRoomPath;
      const trueCases = [
        '.context/last-session.md',
        'research/.hidden.png',
        '.mindrian/room.db',
        'research/data.db',
        'research/data.db-wal',
        'x/room.db-shm',
        'notes.sqlite',
        'b.sqlite3-journal',
        'USER.md',
        'sub\\.context\\x.png',
      ];
      for (const c of trueCases) {
        assert.equal(isP(c), true, `isPrivateRoomPath("${c}") should be true`);
      }
      const falseCases = ['research/figure.png', 'research/a.md', 'research/USER.md'];
      for (const c of falseCases) {
        assert.equal(isP(c), false, `isPrivateRoomPath("${c}") should be false`);
      }
    });

    // ── [view] group ───────────────────────────────────────────────────
    check('[view] 4: compileView wiki summary excludes dot/bud-room/export sections', () => {
      const result = viewsInternal.compileView('wiki', room, {});
      assert.equal(result.ok, true, 'compileView should return ok:true');
      const sections = result.sections || [];
      for (const s of sections) {
        assert.ok(!s.startsWith('.'), `view section "${s}" must not start with a dot`);
      }
      assert.ok(!sections.includes('bud-room'), 'view sections must not include bud-room');
      assert.ok(!sections.includes('export'), 'view sections must not include export');
    });

    check('[view] 5: compileView refuses private pageIds, no sentinel leaks in JSON', () => {
      const r1 = viewsInternal.compileView('wiki', room, { pageId: '.context/last-session' });
      const r2 = viewsInternal.compileView('wiki', room, { pageId: 'USER' });
      assert.equal(r1.compiled_page, null, 'private pageId .context/last-session must not compile');
      assert.equal(r2.compiled_page, null, 'private pageId USER must not compile');
      assert.ok(!stringHasSentinel(JSON.stringify(r1)), 'r1 JSON must carry no sentinel');
      assert.ok(!stringHasSentinel(JSON.stringify(r2)), 'r2 JSON must carry no sentinel');
    });

    // ── [export] group ─────────────────────────────────────────────────
    check('[export] 6: exportStaticWiki leaks nothing into an outside outDir', async () => {
      const result = await wikiExport.exportStaticWiki(room, outsideDir);
      assert.ok(result, 'exportStaticWiki should resolve');
      const files = walkFiles(outsideDir);
      for (const f of files) {
        const rel = path.relative(outsideDir, f);
        const segs = rel.split(path.sep);
        for (const seg of segs) {
          assert.ok(!seg.startsWith('.'), `output path "${rel}" must not have a dot segment`);
        }
        assert.ok(!DB_SIDECAR_RE.test(path.basename(rel)), `output path "${rel}" must not be a db/sidecar file`);
        const buf = fs.readFileSync(f);
        assert.ok(!bufferHasSentinel(buf), `output file "${rel}" must not contain a sentinel`);
      }
      const articlePath = path.join(outsideDir, 'research', 'a.html');
      assert.ok(fs.existsSync(articlePath), 'research/a.html should exist');
      const articleHtml = fs.readFileSync(articlePath, 'utf8');
      assert.ok(articleHtml.includes('publicmarkerok'), 'research/a.html should contain publicmarkerok');
    });

    check('[export] 7: only the referenced allowlisted asset is copied, warnings recorded', async () => {
      const result = await wikiExport.exportStaticWiki(room, outsideDir);
      const assetsDir = path.join(outsideDir, 'assets');
      const assetFiles = walkFiles(assetsDir).map((f) => path.relative(outsideDir, f).split(path.sep).join('/'));
      assert.deepEqual(assetFiles.sort(), ['assets/research/figure.png'], 'only assets/research/figure.png should exist under assets/');
      const src = fs.readFileSync(path.join(room, 'research', 'figure.png'));
      const dst = fs.readFileSync(path.join(assetsDir, 'research', 'figure.png'));
      assert.ok(src.equals(dst), 'copied figure.png must be byte-equal to the source');

      const warnings = result.assetWarnings || [];
      const hasMindrianDbWarning = warnings.some((w) => w.reason === 'private_path' && /\.mindrian\/room\.db/.test(w.ref));
      const hasDataDbWarning = warnings.some((w) => w.reason === 'private_path' && /research\/data\.db/.test(w.ref));
      assert.ok(hasMindrianDbWarning, 'assetWarnings should hold a private_path entry for .mindrian/room.db');
      assert.ok(hasDataDbWarning, 'assetWarnings should hold a private_path entry for research/data.db');
    });

    check('[export] 8: exportStaticWiki succeeds with outDir inside the room, no cpSync crash', async () => {
      const insideOut = path.join(room, 'export', 'wiki');
      const result = await wikiExport.exportStaticWiki(room, insideOut);
      assert.ok(result, 'exportStaticWiki(room, room/export/wiki) should resolve, not throw ERR_FS_CP_EINVAL');

      const files = walkFiles(insideOut);
      for (const f of files) {
        const rel = path.relative(insideOut, f);
        const segs = rel.split(path.sep);
        for (const seg of segs) {
          assert.ok(!seg.startsWith('.'), `inside-room output path "${rel}" must not have a dot segment`);
        }
        assert.ok(!DB_SIDECAR_RE.test(path.basename(rel)), `inside-room output path "${rel}" must not be a db/sidecar file`);
        const buf = fs.readFileSync(f);
        assert.ok(!bufferHasSentinel(buf), `inside-room output file "${rel}" must not contain a sentinel`);
      }
      const assetsUnderExport = walkFiles(path.join(insideOut, 'assets'))
        .map((f) => path.relative(insideOut, f).split(path.sep).join('/'))
        .filter((rel) => rel.includes('export/'));
      assert.equal(assetsUnderExport.length, 0, 'no assets/export path should appear in the output');
    });

    check('[export] 9: exportStaticWiki(room, room) rejects and leaves the room untouched', async () => {
      secondScratch = fs.mkdtempSync(path.join(os.tmpdir(), 'vr-leak-selfexport-'));
      const copy = path.join(secondScratch, 'room');
      fs.cpSync(room, copy, { recursive: true });

      let threw = false;
      try {
        await wikiExport.exportStaticWiki(copy, copy);
      } catch (_e) {
        threw = true;
      }
      assert.ok(threw, 'exportStaticWiki(copy, copy) must reject');
      assert.ok(fs.existsSync(path.join(copy, 'research', 'a.md')), 'copy/research/a.md must still exist afterwards');
    });

    // ── [source] group ─────────────────────────────────────────────────
    check('[source] 10: wiki-export.cjs non-comment source has no cpSync( call', () => {
      const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'wiki', 'wiki-export.cjs'), 'utf8');
      const nonComment = src
        .split('\n')
        .filter((line) => !/^\s*\/\//.test(line) && !/^\s*\*/.test(line))
        .join('\n');
      assert.ok(!nonComment.includes('cpSync('), 'wiki-export.cjs non-comment source must not call cpSync(');
    });

    // ── [server] group ─────────────────────────────────────────────────
    check('[server] 11: startWikiServer binds 127.0.0.1, honors port 0, returns actual port', async () => {
      handle = await wikiServer.startWikiServer(room, 0);
      assert.equal(handle.server.address().address, '127.0.0.1', 'server must bind 127.0.0.1');
      const actual = handle.server.address().port;
      assert.ok(actual > 0, 'actual port must be greater than 0');
      assert.notEqual(actual, 8421, 'actual port must not be the 8421 default');
      assert.equal(handle.port, actual, 'handle.port must equal the actual bound port');
    });

    check('[server] 12: /api/pages and /api/search leak no private id or sentinel', async () => {
      const port = handle.port;
      const pagesRes = await httpGet(port, '/api/pages');
      const keys = Object.keys(JSON.parse(pagesRes.body));
      for (const k of keys) {
        const segs = k.split('/');
        for (const seg of segs) {
          assert.ok(!seg.startsWith('.'), `/api/pages key "${k}" must not have a dot segment`);
        }
      }
      assert.ok(!keys.includes('USER'), '/api/pages keys must not include USER');
      assert.ok(!keys.some((k) => k.startsWith('bud-room/')), '/api/pages keys must not include bud-room/*');
      assert.ok(!stringHasSentinel(pagesRes.body), '/api/pages body must carry no sentinel');

      const searchRes = await httpGet(port, '/api/search?q=zebracontextleak');
      assert.ok(!stringHasSentinel(searchRes.body), '/api/search body must carry no sentinel');
    });

    check('[server] 13: GET /wiki/.context/last-session returns 404, no sentinel', async () => {
      const port = handle.port;
      const res = await httpGet(port, '/wiki/.context/last-session');
      assert.equal(res.status, 404, '/wiki/.context/last-session must 404');
      assert.ok(!res.body.includes('zebracontextleak'), '404 body must not contain zebracontextleak');
    });

    check('[server] 14: /room-assets refuses dot/db/sidecar/encoded/root-identity paths, serves ordinary images', async () => {
      const port = handle.port;
      const okRes = await httpGet(port, '/room-assets/research/figure.png');
      assert.equal(okRes.status, 200, '/room-assets/research/figure.png must serve 200');

      const badPaths = [
        '/room-assets/research/data.db',
        '/room-assets/research/data.db-wal',
        '/room-assets/research/data%2Edb',
        '/room-assets/.mindrian/room.db',
        '/room-assets/%2Emindrian/room.db',
        '/room-assets/USER.md',
      ];
      for (const bp of badPaths) {
        const res = await httpGet(port, bp);
        assert.equal(res.status, 404, `${bp} must 404`);
      }
    });

    await runChecks();
  } finally {
    if (watchdogTimer) clearTimeout(watchdogTimer);
    if (handle) {
      try {
        await handle.watcher.close();
      } catch (_e) {
        /* best-effort */
      }
      try {
        handle.server.close();
      } catch (_e) {
        /* best-effort */
      }
    }
    cleanupDir(fx.scratch);
    if (secondScratch) cleanupDir(secondScratch);
    cleanupDir(outsideDir);
  }

  console.log(`\ntest-visible-room-leak: ${pass}/${total} passed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
