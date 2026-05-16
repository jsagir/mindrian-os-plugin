#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121.5-07 Task 2 -- help-coverage CI guard tests.
 *
 * Test map (4 cases, PLAN Task 2 <behavior> Tests 10-13):
 *
 *   10. scripts/check-help-coverage.cjs exits 0 against live repo.
 *   11. Synthetic fixture: temp command without help_jtbd -> exit 1.
 *   12. Synthetic fixture: command file exists but NOT in help-groups.json
 *       (and not admin) -> exit 1.
 *   13. Infrastructure group contains "doctor" (closes Cluster 5 audit
 *       finding -- doctor was previously silently absent from help.md).
 *
 * Canon Part 3 (UI Ruling System), Part 7 (Reuse Before Build), Part 8
 * (Graph Boundary).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');
const CHECKER = path.join(REPO, 'scripts', 'check-help-coverage.cjs');
const GROUPS_PATH = path.join(REPO, 'data', 'help-groups.json');
const COMMANDS_DIR = path.join(REPO, 'commands');

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

// --- Test 10: live repo passes ---
run('Test 10: check-help-coverage.cjs exits 0 against live repo', () => {
  assert.ok(fs.existsSync(CHECKER), 'scripts/check-help-coverage.cjs must exist');
  const r = spawnSync('node', [CHECKER], { encoding: 'utf8' });
  assert.equal(r.status, 0, 'expected exit 0, got ' + r.status + '\nstdout:' + r.stdout + '\nstderr:' + r.stderr);
});

// --- Test 11: synthetic fixture without help_jtbd -> exit 1 ---
run('Test 11: command without help_jtbd causes exit 1', () => {
  // Create a temp commands/foo.md without help_jtbd; the checker exits 1.
  const tmpName = '___coverage_tmp_no_jtbd.md';
  const tmpPath = path.join(COMMANDS_DIR, tmpName);
  const content = '---\nname: tmp-no-jtbd\ndescription: temp fixture\n---\n# tmp\n';
  fs.writeFileSync(tmpPath, content);
  try {
    const r = spawnSync('node', [CHECKER], { encoding: 'utf8' });
    assert.notEqual(r.status, 0, 'expected non-zero exit (missing help_jtbd)');
    assert.ok(/help_jtbd/i.test(r.stdout + r.stderr), 'expected diagnostic mentioning help_jtbd');
  } finally {
    fs.unlinkSync(tmpPath);
  }
});

// --- Test 12: synthetic fixture file present but not in groups -> exit 1 ---
run('Test 12: command file not in help-groups.json causes exit 1', () => {
  const tmpName = '___coverage_tmp_no_group.md';
  const tmpPath = path.join(COMMANDS_DIR, tmpName);
  // Has help_jtbd but is NOT in data/help-groups.json AND not admin.
  const content =
    '---\nname: tmp-no-group\ndescription: temp fixture\nhelp_jtbd: "Test fixture command without a group."\n---\n# tmp\n';
  fs.writeFileSync(tmpPath, content);
  try {
    const r = spawnSync('node', [CHECKER], { encoding: 'utf8' });
    assert.notEqual(r.status, 0, 'expected non-zero exit (missing from groups)');
    assert.ok(
      /help-groups\.json|MISSING from help-groups/i.test(r.stdout + r.stderr),
      'expected diagnostic mentioning help-groups.json'
    );
  } finally {
    fs.unlinkSync(tmpPath);
  }
});

// --- Test 13: Infrastructure group contains doctor ---
run('Test 13: Infrastructure group contains doctor (Cluster 5 audit closed)', () => {
  const groups = JSON.parse(fs.readFileSync(GROUPS_PATH, 'utf8'));
  const infra = groups.groups.find((g) => g.id === 'infrastructure');
  assert.ok(infra, 'infrastructure group must exist');
  assert.ok(infra.commands.includes('doctor'), 'Infrastructure must contain doctor');
});

console.log('');
console.log('passed=' + passed + ' failed=' + failed);
if (failed > 0) {
  console.error('Failed tests:');
  for (const t of failures) console.error('  - ' + t);
  process.exit(1);
}
process.exit(0);
