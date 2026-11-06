#!/usr/bin/env node
// Phase 385 plan 12: read-only scan for modules with no production caller.
// Writes nothing. Node built-ins only.
//
// Method: a module has a reference when a string literal or a path-like token that
// ends in .cjs, .ts, .js or .sh, in a tracked file, has the module's file name
// without extension as its last path segment. The module's own file never counts.
// Production files: all tracked files except tests/, evals/, *.test.cjs, test-*,
// .planning/, docs/, CHANGELOG.md and the lock files.
// Scopes: A = lib/core (cjs and ts). B = scripts (cjs and sh) plus lib/hmi plus lib/workflow.
// Classes: no-reference (0 production, 0 test), test-only (0 production, >= 1 test),
// plus the transitive closure: a module whose production references all come from
// modules that are already in the dead set (no-reference or test-only).
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = (() => {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : process.cwd();
})();

const ls = spawnSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
if (ls.status !== 0) {
  console.error('git ls-files failed');
  process.exit(2);
}
const files = ls.stdout.split('\n').filter(Boolean);

const LOCKS = new Set(['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock']);

function isTest(f) {
  const base = path.basename(f);
  return f.startsWith('tests/') || f.startsWith('evals/') || /\.test\.cjs$/.test(f) || base.startsWith('test-');
}
function isExcluded(f) {
  return f.startsWith('.planning/') || f.startsWith('docs/') || f === 'CHANGELOG.md' || LOCKS.has(path.basename(f));
}

// Token: path-like text that ends in a code extension.
const TOKEN = /[A-Za-z0-9_.@$%{}()\-/\\]*[A-Za-z0-9_\-]\.(?:cjs|ts|js|sh|mjs)\b/g;

const refs = new Map(); // name -> { prod: Set(file), test: Set(file) }
function add(name, file, kind) {
  let e = refs.get(name);
  if (!e) {
    e = { prod: new Set(), test: new Set() };
    refs.set(name, e);
  }
  e[kind].add(file);
}

for (const f of files) {
  if (isExcluded(f)) continue;
  let buf;
  try {
    buf = fs.readFileSync(path.join(ROOT, f));
  } catch (_) {
    continue;
  }
  if (buf.length > 8 * 1024 * 1024 || buf.includes(0)) continue;
  const text = buf.toString('utf8');
  const kind = isTest(f) ? 'test' : 'prod';
  const seen = new Set();
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(text)) !== null) {
    const tok = m[0].replace(/\\/g, '/');
    const seg = tok.split('/').pop();
    const name = seg.replace(/\.(?:cjs|ts|js|sh|mjs)$/, '');
    if (!name || seen.has(name)) continue;
    seen.add(name);
    add(name, f, kind);
  }
}

function lineCount(f) {
  try {
    const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
    return t === '' ? 0 : t.split('\n').length - (t.endsWith('\n') ? 1 : 0);
  } catch (_) {
    return 0;
  }
}

function modulesOf(scope) {
  return files.filter((f) => {
    if (isTest(f) || isExcluded(f)) return false;
    if (scope === 'A') return f.startsWith('lib/core/') && /\.(cjs|ts)$/.test(f) && !/\.d\.ts$/.test(f);
    return (
      (f.startsWith('scripts/') && /\.(cjs|sh)$/.test(f)) ||
      (f.startsWith('lib/hmi/') && /\.(cjs|ts)$/.test(f)) ||
      (f.startsWith('lib/workflow/') && /\.(cjs|ts)$/.test(f))
    );
  });
}

function nameOf(f) {
  return path.basename(f).replace(/\.(?:cjs|ts|js|sh|mjs)$/, '');
}

function scan(scope, label) {
  const mods = modulesOf(scope);
  const info = new Map();
  for (const f of mods) {
    const e = refs.get(nameOf(f)) || { prod: new Set(), test: new Set() };
    const prod = [...e.prod].filter((x) => x !== f);
    const test = [...e.test].filter((x) => x !== f);
    info.set(f, { prod, test });
  }
  const noRef = mods.filter((f) => info.get(f).prod.length === 0 && info.get(f).test.length === 0);
  const testOnly = mods.filter((f) => info.get(f).prod.length === 0 && info.get(f).test.length > 0);
  const dead = new Set([...noRef, ...testOnly]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of mods) {
      if (dead.has(f)) continue;
      const prod = info.get(f).prod;
      if (prod.length > 0 && prod.every((p) => dead.has(p))) {
        dead.add(f);
        grew = true;
      }
    }
  }
  const closureExtra = [...dead].filter((f) => !noRef.includes(f) && !testOnly.includes(f)).sort();
  const sum = (arr) => arr.reduce((a, f) => a + lineCount(f), 0);
  console.log('== ' + label);
  console.log('scanned: ' + mods.length);
  console.log('no-reference: ' + noRef.length + ' (' + sum(noRef) + ' lines)');
  for (const f of noRef.sort()) console.log('  no-reference ' + f + ' ' + lineCount(f));
  console.log('test-only: ' + testOnly.length + ' (' + sum(testOnly) + ' lines)');
  for (const f of testOnly.sort()) console.log('  test-only ' + f + ' ' + lineCount(f));
  console.log('closure (only loaded by no-reference or test-only modules): ' + closureExtra.length + ' extra (' + sum(closureExtra) + ' lines)');
  for (const f of closureExtra) console.log('  closure ' + f + ' ' + lineCount(f));
  console.log('closure total (no-reference + test-only + extra): ' + dead.size + ' modules, ' + sum([...dead]) + ' lines');
  return { noRef, testOnly, closureExtra, scanned: mods.length };
}

scan('A', 'lib/core');
scan('B', 'scripts plus lib/hmi plus lib/workflow');
