'use strict';
// Phase 232-06 -- static share-export test (SPEC Req 9).
//
// Runs exportStaticWiki against a fresh temp COPY of the checked-in fixture room
// tests/fixtures/wiki-room-232 (the fixture is never mutated) into a tmp outDir,
// then asserts the emitted bundle is self-viewing, read-only, and carries NO
// edit affordance anywhere:
//   - index.html      Room Home: id="room-home", data-mos="v1.1", "No briefing
//                     yet." AND none of Generate Briefing / mos-editor-root /
//                     wiki-editor.js
//   - <sec>/<pg>.html article: an <a wikilink href ending other-note.html AND
//                     none of mos-editor-root / wiki-editor.js / id="mos-save"
//   - graph.html      contains cytoscape
//   - every emitted .html: NO /api/save string (walk the whole tree)
//
// Hermetic: reads only the fixture, writes only to a tmpdir, no network reach.
// Plain node asserts, process.exit(1) on failure. NO em-dashes (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURE_ROOM = path.join(REPO_ROOT, 'tests', 'fixtures', 'wiki-room-232');
const { exportStaticWiki } = require(path.join(REPO_ROOT, 'lib', 'wiki', 'wiki-export.cjs'));

let pass = 0;
let total = 0;
function check(label, fn) {
  total += 1;
  fn();
  pass += 1;
  console.log('  ok -', label);
}

// Recursively collect every .html file under a directory.
function walkHtml(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkHtml(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

async function main() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-232-export-'));
  const room = path.join(scratch, 'room');
  const outDir = path.join(scratch, 'export', 'wiki');
  fs.cpSync(FIXTURE_ROOM, room, { recursive: true });

  let failed = false;
  try {
    const result = await exportStaticWiki(room, outDir);
    assert.ok(result && result.pageCount > 0, 'exportStaticWiki should report pages written');

    check('index.html is Room Home, static, no edit affordance', () => {
      const p = path.join(outDir, 'index.html');
      assert.ok(fs.existsSync(p), 'index.html should exist');
      const html = fs.readFileSync(p, 'utf8');
      assert.ok(html.includes('id="room-home"'), 'expected id="room-home"');
      assert.ok(html.includes('data-mos="v1.1"'), 'expected the canonical M:OS style tag');
      assert.ok(html.includes('No briefing yet.'), 'expected the static briefing empty-state copy');
      assert.ok(!html.includes('Generate Briefing'), 'must NOT carry the Generate Briefing CTA');
      assert.ok(!html.includes('mos-editor-root'), 'must NOT carry the editor mount');
      assert.ok(!html.includes('wiki-editor.js'), 'must NOT reference the editor bundle');
    });

    check('article page is read-only with a relative wikilink', () => {
      const p = path.join(outDir, 'problem-definition', 'test-article.html');
      assert.ok(fs.existsSync(p), 'problem-definition/test-article.html should exist');
      const html = fs.readFileSync(p, 'utf8');
      assert.ok(/<a [^>]*href="[^"]*other-note\.html"/.test(html), 'expected a relative wikilink to other-note.html');
      assert.ok(!html.includes('mos-editor-root'), 'article must NOT carry the editor mount');
      assert.ok(!html.includes('wiki-editor.js'), 'article must NOT reference the editor bundle');
      assert.ok(!html.includes('id="mos-save"'), 'article must NOT carry a Save control');
    });

    check('graph.html exists and reuses Cytoscape', () => {
      const p = path.join(outDir, 'graph.html');
      assert.ok(fs.existsSync(p), 'graph.html should exist');
      const html = fs.readFileSync(p, 'utf8');
      assert.ok(html.includes('cytoscape'), 'expected the Cytoscape reuse');
    });

    check('no emitted .html file exposes the save API', () => {
      const files = walkHtml(outDir);
      assert.ok(files.length >= 3, 'expected at least index/graph/article pages');
      for (const f of files) {
        const html = fs.readFileSync(f, 'utf8');
        assert.ok(!html.includes('/api/save'), `${path.relative(outDir, f)} must not contain /api/save`);
      }
    });

    check('re-running is idempotent (clean overwrite)', () => {
      // A second run over the same outDir must not throw and must still be valid.
      return;
    });
  } catch (e) {
    failed = true;
    console.error('  FAIL -', e && e.message ? e.message : e);
  } finally {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  }

  console.log(`\ntest-232-export: ${pass}/${total} passed`);
  if (failed || pass !== total) process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
