#!/usr/bin/env node
// Phase 385 plan 02: the unused flexsearch npm dependency is gone from package.json and both lock files.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert');

const root = path.resolve(__dirname, '..');
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log('ok   ' + name);
  } catch (e) {
    failed++;
    console.log('FAIL ' + name + ': ' + e.message);
  }
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

check('package.json dependencies has no flexsearch key', () => {
  const pkg = readJson('package.json');
  assert.ok(!('flexsearch' in (pkg.dependencies || {})), 'flexsearch is still in package.json dependencies');
});

for (const lock of ['npm-shrinkwrap.json', 'package-lock.json']) {
  check(lock + ' has no flexsearch package or root dependency', () => {
    const j = readJson(lock);
    const pk = j.packages || {};
    assert.ok(!('node_modules/flexsearch' in pk), lock + ' still has node_modules/flexsearch');
    const rootDeps = (pk[''] && pk[''].dependencies) || {};
    assert.ok(!('flexsearch' in rootDeps), lock + ' still lists flexsearch in the root dependencies');
  });
}

check('no tracked source requires or imports flexsearch', () => {
  const res = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.strictEqual(res.status, 0, 'git ls-files failed');
  const skip = new Set([
    'CHANGELOG.md',
    'tests/test-385-no-flexsearch-dependency.cjs',
    'tests/test-visible-room-search-engine.cjs',
  ]);
  const pattern = /require\(\s*['"]flexsearch|from\s+['"]flexsearch|import\(\s*['"]flexsearch/;
  const hits = [];
  for (const f of res.stdout.split('\n').filter(Boolean)) {
    if (f.startsWith('.planning/') || skip.has(f)) continue;
    let text;
    try {
      const buf = fs.readFileSync(path.join(root, f));
      if (buf.length > 5 * 1024 * 1024 || buf.includes(0)) continue;
      text = buf.toString('utf8');
    } catch (_) {
      continue;
    }
    if (pattern.test(text)) hits.push(f);
  }
  assert.strictEqual(hits.length, 0, 'flexsearch require/import in: ' + hits.join(', '));
});

process.exit(failed ? 1 : 0);
