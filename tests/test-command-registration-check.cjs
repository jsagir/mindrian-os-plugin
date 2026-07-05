#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick task 260705-jeq Task 1 -- tests for lib/core/command-registration-check.cjs.
 *
 * The precondition sweep catches the STATIC causes of a command silently not
 * registering (broken frontmatter fence, a tab in the YAML block, an illegal
 * command name, a case-insensitive basename collision) BEFORE a release ships.
 * These are the fix-locally-first preconditions the doctor's bug report rules
 * out; a FAIL here blocks both scripts/verify-release and the pre-commit hook.
 *
 * Test map:
 *   1. FAIL: unbalanced frontmatter fence (no opening --- line).
 *   2. FAIL: unbalanced frontmatter fence (opening --- but no closing ---).
 *   3. FAIL: a tab character inside the frontmatter block.
 *   4. FAIL: an illegal command name (uppercase / underscore / space).
 *   5. FAIL: a case-insensitive basename collision across two files.
 *   6. WARN-only: missing description + over-long description still pass=true.
 *   7. A subdirectory under commands/ is a WARN, never a FAIL.
 *   8. LIVE TREE: the sweep against the real commands/ dir returns pass:true,
 *      zero failures (locks the live tree clean so the gate cannot brick a cut).
 *
 * All fixtures live in a hermetic os.tmpdir() tree -- never the real commands/.
 * Canon Part 8 (Graph Boundary): filesystem only, zero network, zero Brain.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const { sweepCommandRegistration } = require(
  path.join(REPO, 'lib', 'core', 'command-registration-check.cjs')
);

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + ((err && err.message) || err)); }

// Build a hermetic commands/ fixture dir. Returns its path; caller cleans up.
function mkFixtureDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cmd-reg-check-'));
}
function writeCmd(dir, name, body) {
  fs.writeFileSync(path.join(dir, name + '.md'), body);
}
function rmDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}
function hasFailure(result, rule) {
  return result.failures.some((f) => f.rule === rule);
}
function hasWarning(result, rule) {
  return result.warnings.some((w) => w.rule === rule);
}

const GOOD = '---\nname: good\ndescription: "A short valid description"\nhelp_jtbd: "Do the thing"\n---\n\n# body\n';

// -- Test 1: no opening --- line ---------------------------------------------
try {
  const dir = mkFixtureDir();
  writeCmd(dir, 'good', GOOD);
  writeCmd(dir, 'nofence', '# just a heading\n\nno frontmatter here\n');
  const r = sweepCommandRegistration(dir);
  assert.strictEqual(r.pass, false, 'a missing fence FAILs the sweep');
  assert.ok(hasFailure(r, 'unbalanced_fence'), 'reports unbalanced_fence');
  rmDir(dir);
  pass('Test 1 (missing opening fence is a FAIL)');
} catch (err) { failTest('Test 1 (missing opening fence is a FAIL)', err); }

// -- Test 2: opening --- but no closing --- ----------------------------------
try {
  const dir = mkFixtureDir();
  writeCmd(dir, 'good', GOOD);
  writeCmd(dir, 'openonly', '---\nname: openonly\ndescription: "x"\n\n# body with no closing fence\n');
  const r = sweepCommandRegistration(dir);
  assert.strictEqual(r.pass, false, 'an unclosed fence FAILs the sweep');
  assert.ok(hasFailure(r, 'unbalanced_fence'), 'reports unbalanced_fence');
  rmDir(dir);
  pass('Test 2 (opening fence with no closing fence is a FAIL)');
} catch (err) { failTest('Test 2 (opening fence with no closing fence is a FAIL)', err); }

// -- Test 3: a tab inside the frontmatter block ------------------------------
try {
  const dir = mkFixtureDir();
  writeCmd(dir, 'good', GOOD);
  writeCmd(dir, 'tabbed', '---\nname: tabbed\n\tdescription: "tab-indented"\n---\n\n# body\n');
  const r = sweepCommandRegistration(dir);
  assert.strictEqual(r.pass, false, 'a tab in the frontmatter FAILs the sweep');
  assert.ok(hasFailure(r, 'tab_in_frontmatter'), 'reports tab_in_frontmatter');
  rmDir(dir);
  pass('Test 3 (tab inside frontmatter is a FAIL)');
} catch (err) { failTest('Test 3 (tab inside frontmatter is a FAIL)', err); }

// -- Test 4: an illegal command name -----------------------------------------
try {
  const dir = mkFixtureDir();
  writeCmd(dir, 'good', GOOD);
  writeCmd(dir, 'Bad_Name', GOOD);
  const r = sweepCommandRegistration(dir);
  assert.strictEqual(r.pass, false, 'an illegal name FAILs the sweep');
  assert.ok(hasFailure(r, 'illegal_name'), 'reports illegal_name');
  rmDir(dir);
  pass('Test 4 (illegal command name is a FAIL)');
} catch (err) { failTest('Test 4 (illegal command name is a FAIL)', err); }

// -- Test 5: a case-insensitive basename collision ---------------------------
try {
  const dir = mkFixtureDir();
  // "doctor" and "Doctor" collide case-insensitively. Note: "Doctor" ALSO trips
  // illegal_name, but the collision rule must fire independently on both files.
  writeCmd(dir, 'setup', GOOD);
  writeCmd(dir, 'lower', '---\nname: lower\ndescription: "x"\n---\n\n# body\n');
  writeCmd(dir, 'LOWER', '---\nname: lower2\ndescription: "y"\n---\n\n# body\n');
  const r = sweepCommandRegistration(dir);
  assert.strictEqual(r.pass, false, 'a case-insensitive collision FAILs the sweep');
  assert.ok(hasFailure(r, 'name_collision'), 'reports name_collision');
  rmDir(dir);
  pass('Test 5 (case-insensitive basename collision is a FAIL)');
} catch (err) { failTest('Test 5 (case-insensitive basename collision is a FAIL)', err); }

// -- Test 6: WARN-only path (missing / long description) stays pass=true ------
try {
  const dir = mkFixtureDir();
  writeCmd(dir, 'nodesc', '---\nname: nodesc\nhelp_jtbd: "no description field"\n---\n\n# body\n');
  const longDesc = 'x'.repeat(80);
  writeCmd(dir, 'longdesc', '---\nname: longdesc\ndescription: "' + longDesc + '"\n---\n\n# body\n');
  const r = sweepCommandRegistration(dir);
  assert.strictEqual(r.pass, true, 'warnings-only keeps pass=true');
  assert.strictEqual(r.failures.length, 0, 'warnings-only has zero failures');
  assert.ok(hasWarning(r, 'missing_description'), 'reports missing_description WARN');
  assert.ok(hasWarning(r, 'long_description'), 'reports long_description WARN');
  rmDir(dir);
  pass('Test 6 (missing / long description are WARN-only; pass stays true)');
} catch (err) { failTest('Test 6 (WARN-only description path)', err); }

// -- Test 7: a subdirectory under commands/ is a WARN, never a FAIL ----------
try {
  const dir = mkFixtureDir();
  writeCmd(dir, 'good', GOOD);
  fs.mkdirSync(path.join(dir, 'sub'));
  writeCmd(path.join(dir, 'sub'), 'nested', GOOD);
  const r = sweepCommandRegistration(dir);
  assert.strictEqual(r.pass, true, 'a subdirectory does not FAIL the sweep');
  assert.ok(hasWarning(r, 'subdirectory'), 'reports a subdirectory WARN');
  rmDir(dir);
  pass('Test 7 (a subdirectory under commands/ is a WARN, never a FAIL)');
} catch (err) { failTest('Test 7 (subdirectory WARN)', err); }

// -- Test 8: LIVE TREE clean (locks the gate will not brick the next cut) -----
try {
  const liveDir = path.join(REPO, 'commands');
  const r = sweepCommandRegistration(liveDir);
  assert.strictEqual(r.pass, true,
    'the real commands/ dir passes; failures: ' + JSON.stringify(r.failures));
  assert.strictEqual(r.failures.length, 0, 'the real commands/ dir has zero FAILs');
  assert.ok(r.scanned >= 100, 'the sweep scanned the full command tree; scanned=' + r.scanned);
  pass('Test 8 (live commands/ tree is clean: pass=true, 0 failures, ' + r.scanned + ' scanned)');
} catch (err) { failTest('Test 8 (live tree clean)', err); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED (' + passed + ' passed)');
  process.exit(1);
}
console.log('\nAll ' + passed + ' tests PASS');
process.exit(0);
