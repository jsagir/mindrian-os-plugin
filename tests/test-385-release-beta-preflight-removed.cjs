#!/usr/bin/env node
// Phase 385 plan 07: unused scripts/release-beta-preflight.sh is removed; the release scripts survive.
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

check('scripts/release-beta-preflight.sh is not tracked', () => {
  assert.ok(!files.includes('scripts/release-beta-preflight.sh'), 'scripts/release-beta-preflight.sh is still tracked');
});

check('no tracked file outside .planning and CHANGELOG.md names release-beta-preflight', () => {
  const needle = 'release-beta' + '-preflight';
  const hits = [];
  for (const f of files) {
    if (f.startsWith('.planning/') || f === 'CHANGELOG.md' || f === 'tests/test-385-release-beta-preflight-removed.cjs') continue;
    let buf;
    try {
      buf = fs.readFileSync(path.join(root, f));
    } catch (_) {
      continue;
    }
    if (buf.length > 5 * 1024 * 1024 || buf.includes(0)) continue;
    if (buf.toString('utf8').includes(needle)) hits.push(f);
  }
  assert.strictEqual(hits.length, 0, 'release-beta-preflight named in: ' + hits.join(', '));
});

check('scripts/release.sh and scripts/verify-release stay tracked', () => {
  for (const f of ['scripts/release.sh', 'scripts/verify-release']) {
    assert.ok(files.includes(f), f + ' is not tracked');
  }
});

process.exit(failed ? 1 : 0);
