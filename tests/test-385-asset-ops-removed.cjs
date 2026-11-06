#!/usr/bin/env node
// Phase 385 plan 03: dead module lib/core/asset-ops.cjs is removed; scripts/file-asset survives.
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

check('lib/core/asset-ops.cjs is not tracked', () => {
  assert.ok(!files.includes('lib/core/asset-ops.cjs'), 'lib/core/asset-ops.cjs is still tracked');
});

check('no tracked file outside .planning and CHANGELOG.md names asset-ops', () => {
  const needle = 'asset' + '-ops';
  const hits = [];
  for (const f of files) {
    if (f.startsWith('.planning/') || f === 'CHANGELOG.md' || f === 'tests/test-385-asset-ops-removed.cjs') continue;
    let buf;
    try {
      buf = fs.readFileSync(path.join(root, f));
    } catch (_) {
      continue;
    }
    if (buf.length > 5 * 1024 * 1024 || buf.includes(0)) continue;
    if (buf.toString('utf8').includes(needle)) hits.push(f);
  }
  assert.strictEqual(hits.length, 0, 'asset-ops named in: ' + hits.join(', '));
});

check('scripts/file-asset stays tracked', () => {
  assert.ok(files.includes('scripts/file-asset'), 'scripts/file-asset is not tracked');
});

process.exit(failed ? 1 : 0);
