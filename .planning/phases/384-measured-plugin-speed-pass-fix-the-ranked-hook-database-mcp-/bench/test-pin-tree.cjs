#!/usr/bin/env node
'use strict';
/*
 * Phase 384 plan 12: checks for bench/pin-tree.cjs. Node built-ins only. Prints `pin-tree: ALL PASS` or
 * `pin-tree: <n> FAILED`. The checks build a temporary git repository with two commits and an untracked
 * node_modules folder. No real room, no network, no product code. PIN_TREE_MODULE overrides the module path
 * (used for the recorded RED run).
 * Checks: P1 export (contents, link, sha line, unknown ref, non-empty folder, no .git), P2 apply-commit
 * (applies the second commit, a diff for another base fails and keeps the folder). Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const BENCH = __dirname;
const TOOL = process.env.PIN_TREE_MODULE || path.join(BENCH, 'pin-tree.cjs');

let failed = 0;
function check(name, cond, detail) {
  if (cond) { process.stdout.write('  ok   ' + name + '\n'); return; }
  failed += 1;
  process.stdout.write('  FAIL ' + name + (detail !== undefined ? ' :: ' + String(detail).slice(0, 400) : '') + '\n');
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-384-pintest-'));
function tmp(name) { return path.join(scratch, name); }

const repo = tmp('repo');
const ENV = Object.assign({}, process.env, { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid' });
function git(args, cwd) { return cp.spawnSync('git', args, { cwd: cwd || repo, encoding: 'utf8', env: ENV }); }
function pin(args) { return cp.spawnSync(process.execPath, [TOOL].concat(args), { cwd: repo, encoding: 'utf8', timeout: 120000 }); }

function main() {
  fs.mkdirSync(path.join(repo, 'sub'), { recursive: true });
  git(['init', '-q', '-b', 'main']);
  fs.writeFileSync(path.join(repo, 'a.txt'), 'one\n');
  fs.writeFileSync(path.join(repo, 'sub', 'b.txt'), 'bee\n');
  git(['add', 'a.txt', 'sub/b.txt']); git(['commit', '-q', '-m', 'first']);
  const sha1 = git(['rev-parse', 'HEAD']).stdout.trim();
  fs.writeFileSync(path.join(repo, 'a.txt'), 'two\n');
  git(['commit', '-q', '-am', 'second']);
  const sha2 = git(['rev-parse', 'HEAD']).stdout.trim();
  fs.mkdirSync(path.join(repo, 'node_modules', 'dep'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'node_modules', 'dep', 'index.js'), 'module.exports = 1;\n');
  fs.writeFileSync(path.join(repo, '.gitignore'), 'node_modules\n');

  // P1
  const out1 = tmp('exp1');
  const r1 = pin(['export', '--sha', sha1, '--out', out1]);
  const lines = r1.stdout.split('\n').filter(Boolean);
  check('P1 export exits 0 and prints the sha line and the tree line', r1.status === 0 && lines.length === 2 && /^sha=[0-9a-f]{40}$/.test(lines[0]) && lines[1] === 'tree=' + out1, r1.stdout + r1.stderr);
  check('P1 the sha line holds the 40 hex digits of the commit', lines[0] === 'sha=' + sha1, lines[0]);
  check('P1 the exported folder holds the contents of the first commit', fs.readFileSync(path.join(out1, 'a.txt'), 'utf8') === 'one\n' && fs.readFileSync(path.join(out1, 'sub', 'b.txt'), 'utf8') === 'bee\n');
  let link = null;
  try { link = fs.readlinkSync(path.join(out1, 'node_modules')); } catch (e) { link = null; }
  check('P1 node_modules in the exported folder is a link to the node_modules of the repository', link !== null && fs.realpathSync(link) === fs.realpathSync(path.join(repo, 'node_modules')) && fs.existsSync(path.join(out1, 'node_modules', 'dep', 'index.js')), link);
  check('P1 the exported folder has no .git entry', !fs.existsSync(path.join(out1, '.git')));
  const rBadRef = pin(['export', '--sha', 'nosuchref', '--out', tmp('exp-bad')]);
  check('P1 an unknown ref exits 2 and creates nothing', rBadRef.status === 2 && !fs.existsSync(tmp('exp-bad')), rBadRef.status + ' ' + rBadRef.stderr);
  const rFull = pin(['export', '--sha', sha1, '--out', out1]);
  check('P1 a non-empty folder exits 2 and leaves its content', rFull.status === 2 && fs.readFileSync(path.join(out1, 'a.txt'), 'utf8') === 'one\n', rFull.status + ' ' + rFull.stderr);
  const emptyDir = tmp('exp-empty');
  fs.mkdirSync(emptyDir);
  const rEmpty = pin(['export', '--sha', 'HEAD', '--out', emptyDir]);
  check('P1 an existing empty folder is accepted and a ref name such as HEAD resolves to the 40 hex digits', rEmpty.status === 0 && rEmpty.stdout.indexOf('sha=' + sha2) === 0 && fs.readFileSync(path.join(emptyDir, 'a.txt'), 'utf8') === 'two\n', rEmpty.stdout + rEmpty.stderr);

  // P2
  const out2 = tmp('exp2');
  const r2 = pin(['export', '--sha', sha1, '--out', out2, '--apply-commit', sha2]);
  check('P2 --apply-commit applies the diff of the second commit and prints applied=<40 hex>', r2.status === 0 && r2.stdout.split('\n').indexOf('applied=' + sha2) >= 0 && fs.readFileSync(path.join(out2, 'a.txt'), 'utf8') === 'two\n', r2.stdout + r2.stderr);
  check('P2 the repository itself is untouched by the apply', git(['status', '--porcelain', '--untracked-files=no']).stdout.trim() === '');
  // a diff made against another base: a third commit changes a.txt from two to three; applying it on the first commit must fail
  fs.writeFileSync(path.join(repo, 'a.txt'), 'three\n');
  git(['commit', '-q', '-am', 'third']);
  const sha3 = git(['rev-parse', 'HEAD']).stdout.trim();
  const out3 = tmp('exp3');
  const r3 = pin(['export', '--sha', sha1, '--out', out3, '--apply-commit', sha3]);
  check('P2 a diff made against another base exits 1, names the rejected file, keeps the folder', r3.status === 1 && /a\.txt/.test(r3.stdout + r3.stderr) && fs.existsSync(path.join(out3, 'a.txt')) && fs.readFileSync(path.join(out3, 'a.txt'), 'utf8') === 'one\n', r3.status + ' ' + r3.stdout + r3.stderr);
  check('P2 the rejected lines and the error text hold no path', r3.stderr.indexOf(scratch) < 0 && r3.stdout.split('\n').filter((l) => /^rejected=/.test(l)).every((l) => l.indexOf('/') < 0 || l.indexOf(scratch) < 0), r3.stdout + r3.stderr);
}

try { main(); } catch (e) { failed += 1; process.stdout.write('  FAIL unexpected error :: ' + String(e && e.stack || e).slice(0, 600) + '\n'); }
try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
if (failed === 0) { process.stdout.write('pin-tree: ALL PASS\n'); process.exit(0); }
process.stdout.write('pin-tree: ' + failed + ' FAILED\n');
process.exit(1);
