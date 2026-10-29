#!/usr/bin/env node
'use strict';

/*
 * tests/test-341-install-sh-retired.cjs -- Phase 341 Plan 07 Task 2.
 *
 * Grep tripwire (tests/test-213-part8-boundary.cjs idiom) that keeps the shell
 * installer retired. Arms:
 *   1. the installer file does not exist at the repo root;
 *   2. scripts/check-first-touch-drift.cjs does not list it in DOC_SURFACES;
 *   3. that gate (node scripts/check-first-touch-drift.cjs) exits 0;
 *   4. no LIVE surface references it (scan list below);
 *   5. README.md carries the two documented update commands.
 *
 * The live scan covers: README.md, commands/, skills/, agents/, hooks/, lib/,
 * scripts/, bin/, docs/install/.
 *
 * DELIBERATE EXCLUSIONS (a future reader must not "fix" these):
 *   - CHANGELOG.md, docs/autopsies/, docs/testers/, docs/UI-UX-* and
 *     .planning/ are the paper trail. They are outside the scan list and are
 *     never rewritten.
 *   - Comment-only lines in code files (a line whose first token is //, *, /*,
 *     # or <!--) are skipped. History comments may name the retired file.
 *   - The text "claude.ai/install.sh" is Claude Code's OWN native installer
 *     URL, not this plugin's. It is allowed everywhere.
 *   - docs/install/PACKAGING-PATHS.md is the retirement record ("Where
 *     install.sh went"). It is the one allowed live mention.
 *
 * The scan needle is built from two pieces so this file is not its own hit.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const NAME = 'install' + '.sh';
const NEEDLE = new RegExp('(^|[^A-Za-z0-9_-])install\\.sh');

let PASS = 0;
let FAIL = 0;
function arm(name, fn) {
  try {
    fn();
    PASS += 1;
    console.log('PASS ' + name);
  } catch (err) {
    FAIL += 1;
    console.log('FAIL ' + name + ': ' + (err && err.message ? err.message : err));
  }
}

const SCAN_ROOTS = ['README.md', 'commands', 'skills', 'agents', 'hooks', 'lib', 'scripts', 'bin', 'docs/install'];
const ALLOWED_FILES = new Set(['docs/install/PACKAGING-PATHS.md']);
const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', 'dist', 'build']);
const BINARY_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.pyc', '.woff', '.woff2', '.ttf', '.zip', '.gz', '.tgz', '.db', '.sqlite', '.wasm', '.onnx', '.bin', '.svg']);

function listFiles(rel) {
  const abs = path.join(REPO, rel);
  let st;
  try { st = fs.statSync(abs); } catch (_) { return []; }
  if (st.isFile()) return [rel];
  const out = [];
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const child = rel + '/' + e.name;
    if (e.isDirectory()) out.push(...listFiles(child));
    else if (e.isFile()) out.push(child);
  }
  return out;
}

function isCommentOnly(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('#') || t.startsWith('<!--');
}

function liveHits() {
  const hits = [];
  for (const root of SCAN_ROOTS) {
    for (const rel of listFiles(root)) {
      if (ALLOWED_FILES.has(rel)) continue;
      if (BINARY_EXT.has(path.extname(rel).toLowerCase())) continue;
      const abs = path.join(REPO, rel);
      let buf;
      try {
        if (fs.statSync(abs).size > 3 * 1024 * 1024) continue;
        buf = fs.readFileSync(abs);
      } catch (_) { continue; }
      if (buf.includes(0)) continue; // binary
      const isDoc = rel.endsWith('.md');
      buf.toString('utf8').split('\n').forEach((line, i) => {
        const scrubbed = line.split('claude.ai/' + NAME).join('');
        if (!NEEDLE.test(scrubbed)) return;
        if (!isDoc && isCommentOnly(line)) return;
        hits.push(rel + ':' + (i + 1) + ': ' + line.trim().slice(0, 140));
      });
    }
  }
  return hits;
}

arm('the installer file does not exist at the repo root', () => {
  assert.ok(!fs.existsSync(path.join(REPO, NAME)), NAME + ' must be gone');
  const tracked = spawnSync('git', ['-C', REPO, 'ls-files', NAME], { encoding: 'utf8' });
  assert.strictEqual((tracked.stdout || '').trim(), '', NAME + ' must not be tracked');
});

arm('check-first-touch-drift.cjs does not list it in DOC_SURFACES', () => {
  const src = fs.readFileSync(path.join(REPO, 'scripts', 'check-first-touch-drift.cjs'), 'utf8');
  const m = src.match(/const DOC_SURFACES = \[([\s\S]*?)\];/);
  assert.ok(m, 'DOC_SURFACES array found in source');
  assert.ok(!m[1].includes(NAME), 'DOC_SURFACES must not name ' + NAME);
  assert.ok(m[1].includes('README.md'), 'sanity: the array parsed is the real one');
});

arm('node scripts/check-first-touch-drift.cjs exits 0', () => {
  const r = spawnSync(process.execPath, [path.join(REPO, 'scripts', 'check-first-touch-drift.cjs')], {
    cwd: REPO, encoding: 'utf8', input: '', timeout: 60000,
  });
  assert.strictEqual(r.status, 0, (r.stdout || '') + (r.stderr || ''));
});

arm('no live surface references the retired installer', () => {
  const hits = liveHits();
  assert.deepStrictEqual(hits, [], 'live references:\n' + hits.join('\n'));
});

arm('README.md carries the two documented update commands', () => {
  const readme = fs.readFileSync(path.join(REPO, 'README.md'), 'utf8');
  assert.ok(readme.includes('/plugin marketplace update'), 'missing /plugin marketplace update');
  assert.ok(readme.includes('claude plugin update mos@mindrian-marketplace'), 'missing claude plugin update mos@mindrian-marketplace');
  assert.ok(!NEEDLE.test(readme.split('claude.ai/' + NAME).join('')), 'README must not name the installer');
  assert.ok(!/curl -sL/.test(readme), 'README must not carry a curl -sL line');
});

arm('the scan is not vacuous: it sees a planted reference', () => {
  // Self-check of the scanner on a synthetic line, no file written.
  assert.ok(NEEDLE.test('bash ' + NAME), 'needle matches a real call');
  assert.ok(!NEEDLE.test('reinstall.sh'.replace('reinstall', 're-run')), 'needle ignores unrelated names');
  assert.ok(isCommentOnly('  // ' + NAME) && !isCommentOnly('run ' + NAME), 'comment filter works');
  assert.ok(SCAN_ROOTS.every((r) => listFiles(r).length > 0), 'every scan root has files');
});

arm('this test carries no em-dash or en-dash', () => {
  const t = fs.readFileSync(__filename, 'utf8');
  for (const ch of [String.fromCharCode(0x2014), String.fromCharCode(0x2013)]) {
    assert.ok(!t.includes(ch), 'dash character present');
  }
});

console.log('PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
