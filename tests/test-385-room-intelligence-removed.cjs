#!/usr/bin/env node
// Phase 385 plan 06: dead pair scripts/extract-room-intelligence.cjs and lib/core/room-type-detector.cjs is removed;
// scripts/generate-snapshot.cjs keeps its own local detectRoomType.
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

check('neither lib/core/room-type-detector.cjs nor scripts/extract-room-intelligence.cjs is tracked', () => {
  const still = ['lib/core/room-type-detector.cjs', 'scripts/extract-room-intelligence.cjs'].filter((f) => files.includes(f));
  assert.strictEqual(still.length, 0, 'still tracked: ' + still.join(', '));
});

check('no tracked file outside .planning and CHANGELOG.md names room-type-detector or extract-room-intelligence', () => {
  const needles = ['room-type' + '-detector', 'extract-room' + '-intelligence'];
  const hits = [];
  for (const f of files) {
    if (f.startsWith('.planning/') || f === 'CHANGELOG.md' || f === 'tests/test-385-room-intelligence-removed.cjs') continue;
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
  assert.strictEqual(hits.length, 0, 'named in: ' + hits.join(', '));
});

check('scripts/generate-snapshot.cjs stays tracked and keeps its own function detectRoomType', () => {
  assert.ok(files.includes('scripts/generate-snapshot.cjs'), 'scripts/generate-snapshot.cjs is not tracked');
  const text = fs.readFileSync(path.join(root, 'scripts/generate-snapshot.cjs'), 'utf8');
  assert.ok(text.includes('function detectRoomType'), 'scripts/generate-snapshot.cjs has no local detectRoomType');
});

process.exit(failed ? 1 : 0);
