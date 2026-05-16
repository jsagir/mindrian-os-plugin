#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121.5-07 Task 2 -- Bulletproof torture tests for /mos:help renderer.
 *
 * Three real-world stress scenarios named in CONTEXT.md Sub-plan I:
 *
 *   Torture A (piped): node scripts/help-renderer.cjs | tr -d $'\033' must
 *     produce human-readable output with all 11 group labels present.
 *   Torture B (non-TTY): node scripts/help-renderer.cjs > /tmp/out.txt; cat
 *     must produce ASCII output with zero \x1b codes.
 *   Torture C (Desktop simulator): CLAUDE_DESKTOP=1 node scripts/help-renderer.cjs
 *     must produce ASCII output with all 11 groups present.
 *
 * Canon Part 3 (UI Ruling System), Part 7 (Reuse Before Build), Part 8
 * (Graph Boundary -- filesystem only).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const RENDERER = path.join(REPO, 'scripts', 'help-renderer.cjs');
const GROUPS_PATH = path.join(REPO, 'data', 'help-groups.json');

let passed = 0;
let failed = 0;
const failures = [];

function run(name, fn) {
  try {
    fn();
    console.log('  PASS  ' + name);
    passed++;
  } catch (err) {
    console.error('  FAIL  ' + name);
    console.error('        ' + (err.message || err));
    failed++;
    failures.push(name);
  }
}

function loadGroupLabels() {
  const g = JSON.parse(fs.readFileSync(GROUPS_PATH, 'utf8'));
  return g.groups.map((x) => x.label);
}

// --- Torture A: piped through tr -d $'\033' ---
run('Torture A (piped): tr-d ESC produces human-readable output with all 11 labels', () => {
  assert.ok(fs.existsSync(RENDERER), 'scripts/help-renderer.cjs must exist');
  // Simulate a piped stdout: spawnSync without TTY allocation.
  const r = spawnSync('node', [RENDERER], { encoding: 'utf8' });
  assert.equal(r.status, 0, 'renderer exit ' + r.status);
  // Strip ESC sequences as `tr -d $'\033'` would.
  const stripped = r.stdout.replace(/\x1b\[[0-9;]*m/g, '');
  const labels = loadGroupLabels();
  for (const label of labels) {
    assert.ok(stripped.includes(label), 'piped output missing label "' + label + '"');
  }
  assert.ok(stripped.length > 200, 'piped output too short');
});

// --- Torture B: non-TTY file redirect ---
run('Torture B (non-TTY): file-redirect produces ASCII output with zero ESC', () => {
  const outFile = path.join(os.tmpdir(), 'help-bulletproof-out-' + process.pid + '.txt');
  try {
    const r = spawnSync('node', [RENDERER], {
      encoding: 'utf8',
      stdio: ['ignore', fs.openSync(outFile, 'w'), 'pipe'],
    });
    assert.equal(r.status, 0, 'renderer exit ' + r.status);
    const text = fs.readFileSync(outFile, 'utf8');
    assert.ok(!/\x1b/.test(text), 'non-TTY output contains ESC -- renderer must dispatch to ascii');
    const labels = loadGroupLabels();
    for (const label of labels) {
      assert.ok(text.includes(label), 'non-TTY output missing label "' + label + '"');
    }
  } finally {
    try { fs.unlinkSync(outFile); } catch (_) {}
  }
});

// --- Torture C: CLAUDE_DESKTOP=1 ---
run('Torture C (Desktop simulator): CLAUDE_DESKTOP=1 produces ASCII output, all 11 labels', () => {
  const env = Object.assign({}, process.env, {
    CLAUDE_DESKTOP: '1',
    // Even if a TTY is present, Desktop hard-override must win.
    COLORTERM: 'truecolor',
  });
  const r = spawnSync('node', [RENDERER], { encoding: 'utf8', env });
  assert.equal(r.status, 0, 'renderer exit ' + r.status);
  assert.ok(!/\x1b/.test(r.stdout), 'Desktop output contains ESC');
  const labels = loadGroupLabels();
  for (const label of labels) {
    assert.ok(r.stdout.includes(label), 'Desktop output missing label "' + label + '"');
  }
});

console.log('');
console.log('passed=' + passed + ' failed=' + failed);
if (failed > 0) {
  console.error('Failed tests:');
  for (const t of failures) console.error('  - ' + t);
  process.exit(1);
}
process.exit(0);
