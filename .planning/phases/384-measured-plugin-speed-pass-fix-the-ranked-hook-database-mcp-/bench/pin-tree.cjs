#!/usr/bin/env node
'use strict';
/*
 * Phase 384 plan 12: pinned export of one commit, so a before tree and an after tree are fixed commits and not the live
 * checkout that peers edit. Node built-ins only. Hyphens only.
 *
 * Use:
 *   node pin-tree.cjs export --sha REF --out DIR [--apply-commit SHA2] [--repo DIR]
 *
 * export resolves REF with `git rev-parse --verify REF^{commit}` (exit 2 when unknown), requires DIR to be absent or
 * empty (exit 2 otherwise), runs `git archive` into DIR, links DIR/node_modules to the node_modules folder of the
 * repository root when it exists, and prints `sha=<40 hex>` and `tree=<DIR>`. The folder has no .git entry.
 * --apply-commit SHA2 applies the text diff of that commit (SHA2^ to SHA2) on top of the export with `git apply` run
 * inside DIR (never in the repository), and prints `applied=<40 hex>`. A diff that does not apply exits 1, prints
 * `rejected=<file>` lines (relative names only) and leaves DIR in place.
 * The repository is DIR of --repo, or the repository of the current folder.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

function git(repo, args, opts) {
  return cp.spawnSync('git', args, Object.assign({ cwd: repo, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 }, opts || {}));
}

function die(code, text) { process.stderr.write(text + '\n'); return code; }

function resolveCommit(repo, ref) {
  const r = git(repo, ['rev-parse', '--verify', '--quiet', ref + '^{commit}']);
  if (r.status !== 0) return null;
  const sha = r.stdout.trim();
  return /^[0-9a-f]{40}$/.test(sha) ? sha : null;
}

function rejectedNames(stderr) {
  const names = [];
  String(stderr).split('\n').forEach((l) => {
    let m = /^error: patch failed: (.+?):\d+$/.exec(l);
    if (!m) m = /^error: (.+?): patch does not apply$/.exec(l);
    if (!m) m = /^error: (.+?): does not exist in index$/.exec(l);
    if (!m) m = /^error: (.+?): No such file or directory$/.exec(l);
    if (m && names.indexOf(m[1]) < 0 && !path.isAbsolute(m[1])) names.push(m[1]);
  });
  return names;
}

function exportTree(f) {
  if (!f.sha || !f.out) return die(2, 'usage: pin-tree.cjs export --sha REF --out DIR [--apply-commit SHA2] [--repo DIR]');
  const top = git(f.repo || process.cwd(), ['rev-parse', '--show-toplevel']);
  if (top.status !== 0) return die(2, 'not a git repository');
  const repo = top.stdout.trim();
  const sha = resolveCommit(repo, f.sha);
  if (!sha) return die(2, 'unknown ref');
  let sha2 = null;
  if (f['apply-commit']) {
    sha2 = resolveCommit(repo, f['apply-commit']);
    if (!sha2) return die(2, 'unknown apply-commit ref');
  }
  const out = path.resolve(f.out);
  if (fs.existsSync(out)) {
    let entries;
    try { entries = fs.readdirSync(out); } catch (e) { return die(2, 'out folder is not a folder'); }
    if (entries.length > 0) return die(2, 'out folder is not empty');
  }
  fs.mkdirSync(out, { recursive: true });
  const tar = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mos-384-pin-')), 'tree.tar');
  try {
    const a = git(repo, ['archive', '--format=tar', '-o', tar, sha]);
    if (a.status !== 0) return die(2, 'git archive failed');
    const x = cp.spawnSync('tar', ['-xf', tar, '-C', out], { encoding: 'utf8' });
    if (x.status !== 0) return die(2, 'tar extract failed');
  } finally {
    try { fs.rmSync(path.dirname(tar), { recursive: true, force: true }); } catch (e) { /* best effort */ }
  }
  const nm = path.join(repo, 'node_modules');
  if (fs.existsSync(nm) && !fs.existsSync(path.join(out, 'node_modules'))) fs.symlinkSync(nm, path.join(out, 'node_modules'), 'dir');
  process.stdout.write('sha=' + sha + '\n');
  process.stdout.write('tree=' + out + '\n');
  if (sha2) {
    const d = git(repo, ['diff', '--no-color', sha2 + '^', sha2]);
    if (d.status !== 0) return die(2, 'git diff of the apply commit failed');
    // the ceiling folder stops git from finding a repository above the export, so the patch cannot reach one
    const env = Object.assign({}, process.env, { GIT_CEILING_DIRECTORIES: path.dirname(out) });
    const ap = cp.spawnSync('git', ['apply', '--whitespace=nowarn', '-'], { cwd: out, input: d.stdout, encoding: 'utf8', env: env });
    if (ap.status !== 0) {
      const names = rejectedNames(ap.stderr);
      names.forEach((n) => process.stdout.write('rejected=' + n + '\n'));
      return die(1, 'apply-commit did not apply; the export stays in place' + (names.length ? '' : ' (no file name could be read)'));
    }
    process.stdout.write('applied=' + sha2 + '\n');
  }
  return 0;
}

function main(argv) {
  if (argv[0] !== 'export') return die(2, 'usage: pin-tree.cjs export --sha REF --out DIR [--apply-commit SHA2] [--repo DIR]');
  const f = {};
  for (let i = 1; i < argv.length; i += 2) {
    const k = argv[i];
    if (['--sha', '--out', '--apply-commit', '--repo'].indexOf(k) < 0 || i + 1 >= argv.length) return die(2, 'usage: unknown or incomplete argument ' + k);
    f[k.slice(2)] = argv[i + 1];
  }
  return exportTree(f);
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { exportTree, resolveCommit, rejectedNames, main };
