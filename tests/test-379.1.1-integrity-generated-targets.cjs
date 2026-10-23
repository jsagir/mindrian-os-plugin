#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 379.1.1 Plan 01 (CLOSE379-02): the reference-integrity gate must skip a
 * missing require target that is generated and gitignored, and nothing else.
 *
 * Root cause: lib/core/shallow-doc-parser.test.cjs writes lib/core/__nav-stub.cjs
 * at run time and requires it; the root .gitignore hides that file. A fresh
 * clone has no such file when the gate scans, so the gate reported a dangling
 * require. The gate now reads the root .gitignore and lists every skip.
 *
 *   G1  a generated, gitignored target is skipped and listed in ignored_generated
 *   G2  without a .gitignore line the same tree still fails and names file and target
 *   G3  a negation rule keeps a real missing target a failure
 *   G4  an ignored and a plain missing target in one tree: only the plain one fails
 *   G5  plain output prints each skip; the OK line is unchanged with no skip
 *   G6  a directory-only rule (out/) does not cover a sibling name (outer/)
 *   G7  unit table on the exported isIgnored
 *   G8  the all-resolving tree reports an empty ignored_generated
 *
 * Hermetic: temp HOME, USERPROFILE and MINDRIAN_ROOMS_HOME; the planted trees
 * live under os.tmpdir() and are removed at exit. No network. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-379.1.1-gen-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-379.1.1-gen-roomshome-'));
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

function newTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-379.1.1-gen-tree-'));
  tmpRoots.push(root);
  return root;
}

function runGate(args) {
  return cp.spawnSync(process.execPath, [GATE].concat(args), { encoding: 'utf8', timeout: 120000 });
}

function runJson(root) {
  const r = runGate(['--root', root, '--json']);
  let j = null;
  try { j = JSON.parse(r.stdout); } catch (_e) { j = null; }
  return { status: r.status, json: j, raw: String(r.stdout) + String(r.stderr) };
}

function short(x) { return String(JSON.stringify(x)).slice(0, 300); }

// A file that writes a generated stub at run time and requires it back, the
// same shape as lib/core/shallow-doc-parser.test.cjs.
const GEN_WRITER = [
  "'use strict';",
  "const fs = require('node:fs');",
  "const path = require('node:path');",
  "const stubPath = path.resolve(__dirname, '__gen-stub.cjs');",
  "fs.writeFileSync(stubPath, 'module.exports = 1;');",
  'const stub = require(stubPath);',
  'module.exports = { stub };',
  '',
].join('\n');

function plantGoodTree() {
  const root = newTree();
  w(root, 'lib/core/b.cjs', "'use strict';\nmodule.exports = 1;\n");
  w(root, 'lib/core/a.cjs', "'use strict';\nconst b = require('./b.cjs');\nmodule.exports = { b };\n");
  return root;
}

// G1
const t1 = newTree();
w(t1, 'lib/core/a.cjs', GEN_WRITER);
w(t1, '.gitignore', 'lib/core/__gen-stub.cjs\n');
const g1 = runJson(t1);
const g1e = g1.json && Array.isArray(g1.json.ignored_generated) ? g1.json.ignored_generated : null;
check('G1 a generated gitignored target exits 0', g1.status === 0, 'status=' + g1.status + ' ' + g1.raw.replace(/\s+/g, ' ').slice(0, 200));
check('G1 failures is empty', !!g1.json && Array.isArray(g1.json.failures) && g1.json.failures.length === 0, short(g1.json && g1.json.failures));
check('G1 ignored_generated holds the one skip with file, target and pattern',
  !!g1e && g1e.length === 1 && g1e[0].file === 'lib/core/a.cjs' && g1e[0].target === '__gen-stub.cjs' && g1e[0].pattern === 'lib/core/__gen-stub.cjs',
  short(g1e));

// G2
const t2 = newTree();
w(t2, 'lib/core/a.cjs', GEN_WRITER);
const g2 = runGate(['--root', t2]);
const g2out = String(g2.stdout) + String(g2.stderr);
check('G2 with no .gitignore the missing target exits 1', g2.status === 1, 'status=' + g2.status);
check('G2 the report names the file and the target', g2out.indexOf('lib/core/a.cjs') !== -1 && g2out.indexOf('__gen-stub.cjs') !== -1, g2out.slice(0, 300));

// G3: gen/* then !gen/keep.cjs. Both rules hold a slash, so they anchor at the tree root.
const t3 = newTree();
w(t3, '.gitignore', 'gen/*\n!gen/keep.cjs\n');
w(t3, 'lib/core/b.cjs', "'use strict';\nrequire('../../gen/out.cjs');\n");
w(t3, 'lib/core/c.cjs', "'use strict';\nrequire('../../gen/keep.cjs');\n");
const g3 = runJson(t3);
const g3f = g3.json ? g3.json.failures : null;
const g3i = g3.json ? g3.json.ignored_generated : null;
check('G3 a negated target still fails the gate (exit 1)', g3.status === 1, 'status=' + g3.status);
check('G3 failures hold only the c.cjs entry', Array.isArray(g3f) && g3f.length === 1 && g3f[0].file === 'lib/core/c.cjs', short(g3f));
check('G3 ignored_generated holds only the b.cjs entry', Array.isArray(g3i) && g3i.length === 1 && g3i[0].file === 'lib/core/b.cjs', short(g3i));

// G4
const t4 = newTree();
w(t4, '.gitignore', 'gen/*\n');
w(t4, 'lib/core/b.cjs', "'use strict';\nrequire('../../gen/out.cjs');\n");
w(t4, 'lib/core/plain.cjs', "'use strict';\nrequire('./really-missing');\n");
const g4 = runJson(t4);
const g4f = g4.json ? g4.json.failures : null;
check('G4 one plain missing target keeps the gate at exit 1', g4.status === 1, 'status=' + g4.status);
check('G4 failures hold only the plain one', Array.isArray(g4f) && g4f.length === 1 && g4f[0].file === 'lib/core/plain.cjs' && g4f[0].target === './really-missing', short(g4f));
check('G4 the ignored one is listed, not dropped', !!g4.json && Array.isArray(g4.json.ignored_generated) && g4.json.ignored_generated.length === 1, short(g4.json && g4.json.ignored_generated));

// G5
const g5 = runGate(['--root', t1]);
const g5out = String(g5.stdout);
check('G5 plain output says skipped as gitignored generated', g5out.indexOf('skipped as gitignored generated') !== -1, g5out.slice(0, 300));
check('G5 plain output has one line per skipped reference', /^ {2}skipped: lib\/core\/a\.cjs -> __gen-stub\.cjs \(lib\/core\/__gen-stub\.cjs\)$/m.test(g5out), g5out.slice(0, 300));
const t5 = plantGoodTree();
const g5b = runGate(['--root', t5]);
check('G5 with no skip the OK line is unchanged', g5b.status === 0 && /^check-require-integrity: OK \(\d+ files, \d+ references resolve, \d+ unchecked dynamic\)$/.test(String(g5b.stdout).trim()), short(g5b.stdout));

// G6
const t6 = newTree();
w(t6, '.gitignore', 'out/\n');
w(t6, 'lib/core/p.cjs', "'use strict';\nrequire('./out/x.cjs');\n");
w(t6, 'lib/core/q.cjs', "'use strict';\nrequire('./outer/x.cjs');\n");
const g6 = runJson(t6);
const g6f = g6.json ? g6.json.failures : null;
const g6i = g6.json ? g6.json.ignored_generated : null;
check('G6 the out/ rule skips ./out/x.cjs', Array.isArray(g6i) && g6i.length === 1 && g6i[0].file === 'lib/core/p.cjs', short(g6i));
check('G6 the out/ rule does not skip ./outer/x.cjs', Array.isArray(g6f) && g6f.length === 1 && g6f[0].file === 'lib/core/q.cjs', short(g6f));

// G7: unit table on the exported isIgnored
let gate = null;
try { gate = require(GATE); } catch (_e) { gate = null; }
const t7 = newTree();
w(t7, '.gitignore', [
  '# a comment line that names lib/c.cjs',
  '',
  'lib/core/exact.cjs',
  '/top.cjs',
  '*.gen.cjs',
  'build/',
  'docs/*',
  '!docs/keep.md',
  'vendor/**',
  'lib/pre/dir',
  '#lib/c.cjs',
  '',
].join('\n'));
let ign = null;
try { ign = gate.isIgnored(gate.loadIgnoreRules(t7), 'x'); } catch (_e) { ign = undefined; }
const haveApi = !!gate && typeof gate.isIgnored === 'function' && typeof gate.loadIgnoreRules === 'function';
check('G7 isIgnored and loadIgnoreRules are exported', haveApi, 'isIgnored=' + typeof (gate && gate.isIgnored) + ' loadIgnoreRules=' + typeof (gate && gate.loadIgnoreRules));
function table(rel, expected, why) {
  let got;
  try { got = gate.isIgnored(gate.loadIgnoreRules(t7), rel); } catch (e) { got = 'threw ' + String(e && e.message).slice(0, 60); }
  check('G7 ' + why + ' (' + rel + ' -> ' + expected + ')', got === expected, 'got ' + got);
}
table('lib/core/exact.cjs', true, 'an exact path is ignored');
table('lib/core/other.cjs', false, 'a path with no rule is not ignored');
table('top.cjs', true, 'a leading-slash rule matches at the tree root');
table('lib/top.cjs', false, 'a leading-slash rule does not match deeper');
table('a/b/c/foo.gen.cjs', true, 'a basename glob matches at depth 3');
table('a/foo.gen.cjsx', false, 'a basename glob must match the whole component');
table('lib/build/x.cjs', true, 'a directory rule covers a file below it');
table('lib/build', false, 'a directory rule does not cover a file named like it');
table('docs/a.md', true, 'a broad rule ignores a sibling');
table('docs/keep.md', false, 'a negation after a broad rule wins');
table('lib/c.cjs', false, 'a comment line and a blank line are not rules');
table('vendor/a/b.cjs', true, 'a ** rule covers a deep path');
table('other/vendor/a.cjs', false, 'an anchored ** rule does not match deeper');
table('lib/pre/dir/x.cjs', true, 'an anchored rule covers a leading directory prefix');
void ign;

// G8
const t8 = plantGoodTree();
const g8 = runJson(t8);
check('G8 the all-resolving tree exits 0', g8.status === 0, 'status=' + g8.status);
check('G8 ignored_generated is an empty array', !!g8.json && Array.isArray(g8.json.ignored_generated) && g8.json.ignored_generated.length === 0, short(g8.json && g8.json.ignored_generated));

for (const d of tmpRoots) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}
console.log('--- test-379.1.1-integrity-generated-targets ---');
console.log('PASS: ' + pass + ' FAIL: ' + fail);
process.exitCode = fail === 0 ? 0 : 1;
