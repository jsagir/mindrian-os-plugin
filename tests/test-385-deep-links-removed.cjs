#!/usr/bin/env node
// Phase 385 plan 04: dead module lib/core/deep-links.cjs is removed; the constellation template keeps its own links.
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const root = path.resolve(__dirname, '..');
const res = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
if (res.status !== 0) {
  console.log('FAIL git ls-files could not run: ' + (res.stderr || '').trim());
  process.exit(1);
}
const files = res.stdout.split('\n').filter(Boolean);
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

check('lib/core/deep-links.cjs is not tracked', () => {
  assert.ok(!files.includes('lib/core/deep-links.cjs'), 'lib/core/deep-links.cjs is still tracked');
});

check('no tracked file outside .planning and CHANGELOG.md names deep-links or generateDeepLink', () => {
  const needles = ['deep' + '-links', 'generate' + 'DeepLink'];
  const hits = [];
  for (const f of files) {
    if (f.startsWith('.planning/') || f === 'CHANGELOG.md' || f === 'tests/test-385-deep-links-removed.cjs') continue;
    let buf;
    try {
      buf = fs.readFileSync(path.join(root, f));
    } catch (_) {
      continue;
    }
    if (buf.length > 5 * 1024 * 1024 || buf.includes(0)) continue;
    const text = buf.toString('utf8');
    if (needles.some((n) => text.includes(n))) hits.push(f);
  }
  assert.strictEqual(hits.length, 0, 'deep-links named in: ' + hits.join(', '));
});

check('templates/constellation.html stays tracked and keeps its own claude-cli:// links', () => {
  assert.ok(files.includes('templates/constellation.html'), 'templates/constellation.html is not tracked');
  const text = fs.readFileSync(path.join(root, 'templates/constellation.html'), 'utf8');
  assert.ok(text.includes('claude-cli://'), 'templates/constellation.html has no claude-cli:// link');
});

process.exit(failed ? 1 : 0);
