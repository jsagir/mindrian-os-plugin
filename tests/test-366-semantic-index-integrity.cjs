#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 Plan 23 (EPV366-29, ADR-E12): the reference-integrity gate that
 * keeps the semantic-index split honest.
 *
 *   I1  over a planted tree where every static reference resolves (a relative
 *       require, an index.cjs directory require, require.resolve, a
 *       path.join(__dirname, ...) spawn target, a repo-root path.join, a quoted
 *       spawn literal), scripts/check-require-integrity.cjs exits 0 and a
 *       dynamic require counts as unchecked, never as a failure
 *   I2  one broken require makes it exit 1 naming the file and the missing
 *       target, and it prints no file contents
 *   I3  on the current repo it exits 0
 *   I4  the split (after Task 3): lib/core/semantic-index/ exists, every module
 *       in it loads, no module name sits in both folders, and nothing under
 *       lib/, scripts/, hooks/, bin/ or tests/ still requires a moved module
 *       through lib/core/eureka/
 *
 * Hermetic: temp HOME, USERPROFILE and MINDRIAN_ROOMS_HOME; the planted trees
 * live under os.tmpdir() and are removed at exit. No network.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-integrity-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-integrity-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const REPO = path.resolve(__dirname, '..');
const GATE = path.join(REPO, 'scripts', 'check-require-integrity.cjs');
const tmpRoots = [TMP_HOME, process.env.MINDRIAN_ROOMS_HOME];

let pass = 0;
let fail = 0;
function check(label, ok, detail) {
  if (ok) { pass += 1; console.log('PASS: ' + label); }
  else { fail += 1; console.log('FAIL: ' + label + (detail ? ' -- ' + detail : '')); }
}

function w(root, rel, body) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
}

function runGate(args) {
  return cp.spawnSync(process.execPath, [GATE].concat(args), { encoding: 'utf8', timeout: 120000 });
}

const SENTINEL = 'PLANTED_CONTENT_SENTINEL_366_23';

function plantGoodTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-integrity-tree-'));
  tmpRoots.push(root);
  w(root, 'lib/core/b.cjs', "'use strict';\nmodule.exports = 1;\n");
  w(root, 'lib/core/dir/index.cjs', "'use strict';\nmodule.exports = 2;\n");
  w(root, 'lib/core/data.json', '{}\n');
  w(root, 'scripts/s.cjs', "'use strict';\n");
  w(root, 'lib/core/a.cjs', [
    "'use strict';",
    '// ' + SENTINEL,
    "const path = require('node:path');",
    "const b = require('./b');",
    "const b2 = require('./b.cjs');",
    "const d = require('./dir');",
    "const j = require('./data.json');",
    "const r = require.resolve('../../scripts/s.cjs');",
    "const REPO_ROOT = path.resolve(__dirname, '..', '..');",
    "const s = path.join(__dirname, '..', '..', 'scripts', 's.cjs');",
    "const s2 = require(path.join(REPO_ROOT, 'lib', 'core', 'b.cjs'));",
    "require('node:child_process').spawnSync(process.execPath, ['scripts/s.cjs']);",
    "const name = 'b';",
    "const dyn = require('./' + name);",
    "// require('./a-comment-only-reference-that-does-not-exist')",
    'module.exports = { b, b2, d, j, r, s, s2, dyn };',
    '',
  ].join('\n'));
  return root;
}

// I1
const good = plantGoodTree();
const r1 = runGate(['--root', good, '--json']);
let j1 = null;
try { j1 = JSON.parse(r1.stdout); } catch (_e) { j1 = null; }
check('I1 a tree where every static reference resolves exits 0', r1.status === 0, 'status=' + r1.status + ' ' + String(r1.stdout).slice(0, 300) + String(r1.stderr).slice(0, 300));
check('I1 --json reports checked references and zero failures', !!j1 && j1.failures && j1.failures.length === 0 && j1.checked >= 7, JSON.stringify(j1 && { checked: j1.checked, failures: j1.failures }));
check('I1 the dynamic require counts as unchecked, not as a failure', !!j1 && j1.unchecked >= 1, JSON.stringify(j1 && { unchecked: j1.unchecked }));

// I2
w(good, 'tests/broken.cjs', "'use strict';\n// " + SENTINEL + "\nrequire('../lib/core/missing-thing');\n");
const r2 = runGate(['--root', good]);
const out2 = String(r2.stdout) + String(r2.stderr);
check('I2 one broken require makes the gate exit 1', r2.status === 1, 'status=' + r2.status);
check('I2 the report names the file and the missing target', out2.indexOf('tests/broken.cjs') !== -1 && out2.indexOf('missing-thing') !== -1, out2.slice(0, 300));
check('I2 the report prints no file contents', out2.indexOf(SENTINEL) === -1);
check('I2 the good file is not reported', out2.indexOf('lib/core/a.cjs') === -1, out2.slice(0, 300));

// I3
const r3 = runGate([]);
check('I3 the gate exits 0 on the current repo', r3.status === 0, String(r3.stdout).split('\n').slice(0, 12).join(' | '));

// I4: the split. Skipped (not failed) until Task 3 creates the folder, so the
// gate legs above can land first; once the folder exists the leg is binding.
const SI = path.join(REPO, 'lib', 'core', 'semantic-index');
const EU = path.join(REPO, 'lib', 'core', 'eureka');
if (!fs.existsSync(SI)) {
  console.log('SKIP: I4 lib/core/semantic-index/ does not exist yet (plan 366-23 Task 3 creates it)');
} else {
  const moved = fs.readdirSync(SI).filter(function (f) { return /\.cjs$/.test(f); }).sort();
  const stayed = fs.readdirSync(EU).filter(function (f) { return /\.cjs$/.test(f); });
  check('I4 lib/core/semantic-index/ holds modules', moved.length > 0, 'count=' + moved.length);
  const both = moved.filter(function (f) { return stayed.indexOf(f) !== -1; });
  check('I4 no module name exists in both folders', both.length === 0, both.join(', '));
  const unloadable = [];
  moved.forEach(function (f) {
    try { require(path.join(SI, f)); } catch (e) { unloadable.push(f + ' (' + String(e && e.message).slice(0, 80) + ')'); }
  });
  check('I4 every moved module loads', unloadable.length === 0, unloadable.join('; '));
  const stale = [];
  const names = moved.map(function (f) { return f.replace(/\.cjs$/, ''); });
  const re = new RegExp('(?:eureka[\'"/,\\s]+)(?:' + names.map(function (n) { return n.replace(/[-.]/g, '\\$&'); }).join('|') + ')(?:\\.cjs)?[\'"]');
  ['lib', 'scripts', 'hooks', 'bin', 'tests'].forEach(function (d) {
    (function walk(dir) {
      let ents = [];
      try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
      ents.forEach(function (e) {
        if (e.name === 'node_modules' || e.name === '.git' || e.name === 'fixtures') return;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return walk(p);
        if (!/\.(cjs|js|mjs)$/.test(e.name)) return;
        if (p === __filename) return;
        const lines = fs.readFileSync(p, 'utf8').split('\n').filter(function (l) {
          const t = l.trim();
          return t.indexOf('//') !== 0 && t.indexOf('*') !== 0 && t.indexOf('/*') !== 0;
        });
        if (lines.some(function (l) { return /require|path\.join|path\.resolve/.test(l) && re.test(l); })) {
          stale.push(path.relative(REPO, p).split(path.sep).join('/'));
        }
      });
    })(path.join(REPO, d));
  });
  check('I4 nothing requires a moved module through lib/core/eureka/', stale.length === 0, stale.join(', '));
}

for (const d of tmpRoots) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}
console.log('--- test-366-semantic-index-integrity ---');
console.log('PASS: ' + pass + ' FAIL: ' + fail);
process.exitCode = fail === 0 ? 0 : 1;
