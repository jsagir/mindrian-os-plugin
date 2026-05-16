#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121.5-02 Task 2 -- skill-vs-code-drift checker test suite
 * =================================================================
 * Tests scripts/check-skill-vs-code-drift.cjs. The checker scans
 * skills/ui-system/SKILL.md against the shipped renderer / glyph / shape
 * code in lib/render/render-v2.cjs and asserts:
 *   - Every F.N shape implemented in code is documented in SKILL.md
 *   - SKILL.md cross-references Canon Part 3 + Canon Part 10 + the dual
 *     palette source (JTBD-PALETTES) + the ODD 4 resolution paragraph
 *   - The three required sidecar rules files exist
 *
 * Tests 1, 4, 5, 6, 8 run against the LIVE repo (Task 1 output).
 * Tests 2, 3, 7 use synthetic fixtures via fs.mkdtempSync to exercise the
 * drift-detection paths without touching the real repo.
 *
 * Canon Part 7 invariant: this test asserts the reconciliation lands as
 * data, not as promise. A future drift will fail the checker at PR time,
 * not at audit time.
 *
 * No em-dashes, no emoji (per skills/ui-system/SKILL.md §3).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CHECKER_PATH = path.join(__dirname, '..', '..', 'scripts', 'check-skill-vs-code-drift.cjs');
const REPO_ROOT = path.join(__dirname, '..', '..');
const REAL_SKILL = path.join(REPO_ROOT, 'skills', 'ui-system', 'SKILL.md');
const REAL_CODE = path.join(REPO_ROOT, 'lib', 'render', 'render-v2.cjs');
const REAL_RULES_DIR = path.join(REPO_ROOT, 'skills', 'ui-system', 'rules');

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(msg);
    console.error('  FAIL: ' + msg);
  }
}

function test(label, fn) {
  console.log('--- ' + label + ' ---');
  try {
    fn();
    console.log('  passed');
  } catch (e) {
    failed++;
    failures.push(label + ': ' + e.message);
    console.error('  THREW: ' + e.message);
  }
}

function loadChecker() {
  // Bust require-cache so changes to the checker module surface immediately.
  delete require.cache[require.resolve(CHECKER_PATH)];
  return require(CHECKER_PATH);
}

function stageFixture(opts) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-drift-fixture-'));
  const skillPath = path.join(tmp, 'SKILL.md');
  const codePath = path.join(tmp, 'render-v2.cjs');
  const rulesDir = path.join(tmp, 'rules');
  fs.mkdirSync(rulesDir, { recursive: true });
  fs.writeFileSync(skillPath, opts.skill || '');
  if (typeof opts.code === 'string') fs.writeFileSync(codePath, opts.code);
  if (Array.isArray(opts.rulesFiles)) {
    for (const f of opts.rulesFiles) {
      fs.writeFileSync(path.join(rulesDir, f), 'stub\n');
    }
  }
  return { tmp, skillPath, codePath, rulesDir };
}

// ===========================================================================
// Test 1: clean repo (live files) -> valid:true
// ===========================================================================
test('Test 1: clean repo lives at green (Task 1 output)', () => {
  const { check } = loadChecker();
  const result = check();
  assert(result && typeof result === 'object', 'check() returned object');
  assert(result.valid === true,
    'live repo valid=true (got ' + result.valid + '); missing_in_skill=' +
    JSON.stringify(result.missing_in_skill) + ' missing_crossrefs=' +
    JSON.stringify(result.missing_crossrefs) + ' missing_rules=' +
    JSON.stringify(result.missing_rules_files));
  assert(Array.isArray(result.missing_in_skill), 'missing_in_skill is array');
  assert(Array.isArray(result.missing_in_code), 'missing_in_code is array');
  assert(Array.isArray(result.missing_crossrefs), 'missing_crossrefs is array');
  assert(Array.isArray(result.missing_rules_files), 'missing_rules_files is array');
});

// ===========================================================================
// Test 2: SKILL.md lists F.7 (bogus); code has no F.7 -> code-missing flagged
// in missing_in_code (NOT fatal); valid stays true UNLESS other failures.
// To make the test exercise a FATAL drift, we also strip code F.0 so it
// appears in SKILL but missing from code -- producing the asymmetric severity
// behavior: missing_in_code on its own does NOT flip valid. We then verify
// the inverse (Test 3) where SKILL is missing code shapes -> valid:false.
// ===========================================================================
test('Test 2: SKILL with extra F.7 but code lacks it -> missing_in_code flag (non-fatal)', () => {
  const { check } = loadChecker();
  const fixture = stageFixture({
    skill: '# stub\n\nShape F.0 here.\nShape F.1 here.\nShape F.7 bogus.\n\nCanon Part 3\nCanon Part 10\nJTBD-PALETTES\nODD 4 resolution\n',
    code: 'F.0 F.1\n',
    rulesFiles: ['shape-f-zero-and-six.md', 'dual-palette.md', 'glyph-disambiguation.md'],
  });
  const result = check({
    skillPath: fixture.skillPath,
    codePath: fixture.codePath,
    rulesDir: fixture.rulesDir,
  });
  // SKILL has F.0, F.1, F.7 -- code has F.0, F.1. F.7 is in skill but not in code.
  assert(result.missing_in_code.indexOf('F.7') !== -1,
    'F.7 present in SKILL but missing in code (got missing_in_code=' +
    JSON.stringify(result.missing_in_code) + ')');
  // missing_in_code alone does NOT flip valid (asymmetric severity per plan).
  assert(result.valid === true,
    'missing_in_code alone is non-fatal -> valid stays true (got ' + result.valid + ')');
});

// ===========================================================================
// Test 3: code implements F.6 but SKILL.md does NOT document it -> valid:false
// ===========================================================================
test('Test 3: code has F.6 but SKILL lacks it -> valid:false', () => {
  const { check } = loadChecker();
  const fixture = stageFixture({
    skill: '# stub\n\nShape F.0\nShape F.1\nShape F.2\nShape F.3\nShape F.4\nShape F.5\n\nCanon Part 3\nCanon Part 10\nJTBD-PALETTES\nODD 4 resolution\n',
    code: 'F.0 F.1 F.2 F.3 F.4 F.5 F.6\n',
    rulesFiles: ['shape-f-zero-and-six.md', 'dual-palette.md', 'glyph-disambiguation.md'],
  });
  const result = check({
    skillPath: fixture.skillPath,
    codePath: fixture.codePath,
    rulesDir: fixture.rulesDir,
  });
  assert(result.missing_in_skill.indexOf('F.6') !== -1,
    'F.6 implemented in code but missing from SKILL (got missing_in_skill=' +
    JSON.stringify(result.missing_in_skill) + ')');
  assert(result.valid === false,
    'SKILL missing code-shipped F.6 is FATAL -> valid:false (got ' + result.valid + ')');
});

// ===========================================================================
// Test 4: live SKILL.md cross-references lib/render/JTBD-PALETTES.md (grep)
// ===========================================================================
test('Test 4: live SKILL.md cross-references JTBD-PALETTES', () => {
  const txt = fs.readFileSync(REAL_SKILL, 'utf8');
  assert(txt.indexOf('JTBD-PALETTES') !== -1,
    'SKILL.md mentions JTBD-PALETTES (the Phase 102 source-of-truth file)');
});

// ===========================================================================
// Test 5: live SKILL.md contains ODD 4 resolution paragraph
// ===========================================================================
test('Test 5: live SKILL.md contains ODD 4 resolution', () => {
  const txt = fs.readFileSync(REAL_SKILL, 'utf8');
  assert(txt.indexOf('ODD 4 resolution') !== -1,
    'SKILL.md contains ODD 4 resolution paragraph (the glyph + word disambiguation carve-out)');
});

// ===========================================================================
// Test 6: live SKILL.md contains Canon Part 3 AND Canon Part 10 cross-refs
// ===========================================================================
test('Test 6: live SKILL.md cross-references Canon Part 3 + Part 10', () => {
  const txt = fs.readFileSync(REAL_SKILL, 'utf8');
  assert(txt.indexOf('Canon Part 3') !== -1, 'SKILL.md cross-references Canon Part 3');
  assert(txt.indexOf('Canon Part 10') !== -1, 'SKILL.md cross-references Canon Part 10');
});

// ===========================================================================
// Test 7: three sidecar rules files exist (synthetic fixture w/ NONE missing)
// vs synthetic fixture missing one -> valid:false
// ===========================================================================
test('Test 7: missing sidecar rules file -> valid:false', () => {
  const { check } = loadChecker();
  // Fixture with ALL three rules files -> valid (assuming other checks pass).
  const all = stageFixture({
    skill: '# stub\n\nShape F.0\n\nCanon Part 3\nCanon Part 10\nJTBD-PALETTES\nODD 4 resolution\n',
    code: 'F.0\n',
    rulesFiles: ['shape-f-zero-and-six.md', 'dual-palette.md', 'glyph-disambiguation.md'],
  });
  const ok = check({
    skillPath: all.skillPath,
    codePath: all.codePath,
    rulesDir: all.rulesDir,
  });
  assert(ok.valid === true,
    'all 3 rules files + cross-refs + matched shapes -> valid:true (got ' + ok.valid +
    '; missing_rules_files=' + JSON.stringify(ok.missing_rules_files) + ')');
  // Fixture missing dual-palette.md -> valid:false.
  const missing = stageFixture({
    skill: '# stub\n\nShape F.0\n\nCanon Part 3\nCanon Part 10\nJTBD-PALETTES\nODD 4 resolution\n',
    code: 'F.0\n',
    rulesFiles: ['shape-f-zero-and-six.md', 'glyph-disambiguation.md'],
  });
  const bad = check({
    skillPath: missing.skillPath,
    codePath: missing.codePath,
    rulesDir: missing.rulesDir,
  });
  assert(bad.missing_rules_files.indexOf('dual-palette.md') !== -1,
    'missing dual-palette.md detected (got missing_rules_files=' +
    JSON.stringify(bad.missing_rules_files) + ')');
  assert(bad.valid === false,
    'missing rules file is FATAL -> valid:false (got ' + bad.valid + ')');
});

// ===========================================================================
// Test 8: --json mode emits structured drift report
// ===========================================================================
test('Test 8: --json mode emits structured report', () => {
  const { execFileSync } = require('child_process');
  const out = execFileSync('node', [CHECKER_PATH, '--json'], { encoding: 'utf8' });
  let parsed;
  try {
    parsed = JSON.parse(out);
  } catch (e) {
    assert(false, '--json output is parseable JSON; got: ' + out.slice(0, 200));
    return;
  }
  assert(typeof parsed.valid === 'boolean', '--json emits valid:boolean');
  assert(Array.isArray(parsed.missing_in_skill), '--json emits missing_in_skill[]');
  assert(Array.isArray(parsed.missing_in_code), '--json emits missing_in_code[]');
  assert(Array.isArray(parsed.missing_crossrefs), '--json emits missing_crossrefs[]');
  assert(Array.isArray(parsed.missing_rules_files), '--json emits missing_rules_files[]');
});

// ===========================================================================
// Summary
// ===========================================================================
console.log('');
console.log('========================================');
console.log('  skill-vs-code-drift test suite');
console.log('========================================');
console.log('  Passed: ' + passed);
console.log('  Failed: ' + failed);
if (failed > 0) {
  console.log('');
  console.log('  Failures:');
  for (const f of failures) {
    console.log('    - ' + f);
  }
  process.exit(1);
}
process.exit(0);
