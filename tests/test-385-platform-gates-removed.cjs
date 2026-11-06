#!/usr/bin/env node
// Phase 385 plan 05: dead module lib/core/platform-gates.cjs is removed; the context-engine skill keeps its tengu_kairos instruction.
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

check('lib/core/platform-gates.cjs is not tracked', () => {
  assert.ok(!files.includes('lib/core/platform-gates.cjs'), 'lib/core/platform-gates.cjs is still tracked');
});

check('no tracked file outside .planning and CHANGELOG.md names platform-gates, isGateActive or getGateSummary', () => {
  const needles = ['platform' + '-gates', 'isGate' + 'Active', 'getGate' + 'Summary'];
  const hits = [];
  for (const f of files) {
    if (f.startsWith('.planning/') || f === 'CHANGELOG.md' || f === 'tests/test-385-platform-gates-removed.cjs') continue;
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
  assert.strictEqual(hits.length, 0, 'platform-gates named in: ' + hits.join(', '));
});

check('skills/context-engine/SKILL.md stays tracked and keeps tengu_kairos', () => {
  assert.ok(files.includes('skills/context-engine/SKILL.md'), 'skills/context-engine/SKILL.md is not tracked');
  const text = fs.readFileSync(path.join(root, 'skills/context-engine/SKILL.md'), 'utf8');
  assert.ok(text.includes('tengu_kairos'), 'skills/context-engine/SKILL.md has no tengu_kairos text');
});

process.exit(failed ? 1 : 0);
