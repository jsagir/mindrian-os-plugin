#!/usr/bin/env node
// Phase 385 plan 01: no Python bytecode is tracked; the Python sources stay tracked.
'use strict';
const { spawnSync } = require('node:child_process');
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

check('no tracked path under __pycache__ or ending .pyc/.pyo', () => {
  const bad = files.filter((f) => f.includes('__pycache__/') || /\.(pyc|pyo)$/.test(f));
  assert.strictEqual(bad.length, 0, bad.length + ' tracked bytecode path(s): ' + bad.join(', '));
});

check('python sources stay tracked', () => {
  const set = new Set(files);
  for (const src of ['scripts/compute-hsi.py', 'scripts/detect-reverse-salients.py']) {
    assert.ok(set.has(src), src + ' is not tracked');
  }
});

process.exit(failed ? 1 : 0);
