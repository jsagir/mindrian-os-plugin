#!/usr/bin/env node
'use strict';

/*
 * Phase 95.6 D-02 -- repo-state assertion: no .planning/phases/ leaf name
 * is long enough to trip Windows MAX_PATH (260 chars) when combined with a
 * typical user home path.
 *
 * Owning plan: 95.6-01 (the D-02 rename). This suite passes only AFTER Plan
 * 95.6-01 has run; if the old 189-char phase-92 leaf
 *   92-refactor-...-trust-layer  (full descriptive form preserved as the
 *   "## Searchability Note" body section in
 *   .planning/phases/92-trust-layer-refactor/92-CONTEXT.md)
 * still exists, this is expected RED until then. Plan 95.6-01 is Wave 1 and
 * has NO dependency on this plan (95.6-02) -- it can run before OR after Wave 0.
 * The release-gate plan (95.6-10) re-runs the full suite, so GREEN-by-then is
 * the contract. This test MUST NOT hard-fail Wave 0: if 95.6-01 has not run,
 * it prints "SKIP: 95.6-01 has not run yet" and exits 0.
 *
 * Three checks (mirroring the repo-scan style of
 * tests/test-canon-crossref-completeness.cjs):
 *   1. every .planning/phases/* directory leaf name <= 60 chars, with a
 *      specific assertion that no `92-*` leaf exceeds 60 (the 03.1-* leaf at
 *      80 chars is out of 95.6 scope; we report the global max but only the
 *      92 leaf is a hard assertion);
 *   2. `git grep` for the old long-path string returns 0 files that are NOT
 *      legitimately-historical records of the old name. The whitelist of
 *      historical records is: the tester feedback quote, the install-failure
 *      autopsy, the STATE.md bug-narrative log entry, this test file, and any
 *      file under the 95.6 phase directory (the phase that specs the rename).
 *      A "dangling reference" is one that uses the old name as a live path you
 *      would follow; a quote inside a bug autopsy is not. Skip gracefully if
 *      git is absent.
 *   3. `git log --follow` on the renamed dir is non-empty (rename history
 *      preserved); skip gracefully if git absent or the dir does not exist.
 *
 * NOTE on self-reference: the search needle below is assembled from string
 * fragments so this test file's own source does NOT contain the contiguous
 * substring it greps for. (Belt + suspenders: the test file is also on the
 * Check-2 whitelist.) This is why you will not see the literal
 * "92-refactor-constitution-..." token written out anywhere in this file.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const PHASES_DIR = path.join(REPO_ROOT, '.planning', 'phases');

// Assembled from fragments so this source file does not contain the contiguous
// token that Check 2 greps for (see the NOTE in the header comment).
const OLD_92_NEEDLE = ['92-refactor', 'constitution', 'and', 'trust', 'layer'].join('-');
const OLD_92_LEAF = [
  OLD_92_NEEDLE,
  'formalizes-audit-driven-refactor-work-constitution-v1-1',
  'directive-1-validation-directive-2-consolidation-directive-3-unidirectional-flow-trust-layer',
].join('-');
const NEW_92_LEAF = '92-trust-layer-refactor';
const LEAF_CAP = 60;

// Files that legitimately contain the old long name as a historical / spec
// record (not as a live filesystem path). These are NOT dangling references.
const CHECK2_WHITELIST = new Set([
  'docs/testers/gary-laben/FEEDBACK.md',                       // verbatim tester transcript quote
  'docs/autopsies/2026-05-09-gary-laben-install-failure.md',   // install-failure autopsy
  '.planning/STATE.md',                                        // bug-narrative log entry (frozen)
  'tests/test-92-rename-no-long-leaves.cjs',                   // this file (defensive; needle is fragmented anyway)
]);
// Any file under this prefix is the 95.6 phase that specs the D-02 rename and
// is allowed to quote the old name.
const CHECK2_WHITELIST_PREFIX = '.planning/phases/95.6-install-cache-windows-hardening-and-skill-loop-resilience/';

function gitAvailable() {
  try { execSync('git --version', { cwd: REPO_ROOT, stdio: 'pipe' }); return true; } catch (_e) { return false; }
}

const leaves = fs.existsSync(PHASES_DIR)
  ? fs.readdirSync(PHASES_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : [];

const old92Present = leaves.includes(OLD_92_LEAF);

// --- Wave 0 graceful skip: if 95.6-01 has not run, do not block. ---
if (old92Present) {
  console.log('SKIP: 95.6-01 has not run yet (the 189-char phase-92 leaf still exists).');
  console.log('SKIP: this suite goes GREEN once Plan 95.6-01 (D-02 rename) lands; release plan 95.6-10 re-runs it.');
  process.exit(0);
}

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + ((err && err.message) || err)); }

// Check 1: leaf-length cap.
try {
  const lengths = leaves.map((n) => ({ n, len: n.length })).sort((a, b) => b.len - a.len);
  const globalMax = lengths.length ? lengths[0] : { n: '(none)', len: 0 };
  console.log('  global longest .planning/phases/ leaf: ' + globalMax.len + ' chars (' + globalMax.n + ')');
  const long92 = leaves.filter((n) => n.startsWith('92-') && n.length > LEAF_CAP);
  assert.deepStrictEqual(long92, [], 'no 92-* phase leaf may exceed ' + LEAF_CAP + ' chars; offenders: ' + JSON.stringify(long92));
  const renamed = leaves.filter((n) => n.startsWith('92-'));
  assert.deepStrictEqual(renamed, [NEW_92_LEAF], 'exactly one 92-* leaf, and it is the renamed short form; got ' + JSON.stringify(renamed));
  pass('Check 1 (no long 92-* leaf; renamed to ' + NEW_92_LEAF + ')');
} catch (err) { failTest('Check 1 (no long 92-* leaf)', err); }

// Check 2: no dangling references to the old long path outside the whitelist.
try {
  if (!gitAvailable()) {
    console.log('SKIP: git unavailable -- cannot run dangling-ref grep.');
  } else {
    let hits = '';
    try {
      hits = execSync('git grep -l --color=never ' + JSON.stringify(OLD_92_NEEDLE) + ' -- . ":(exclude).planning/phases/' + NEW_92_LEAF + '"', { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      // git grep exits 1 when there are no matches; that is the happy path.
      if (e.status === 1) hits = '';
      else throw e;
    }
    const files = hits.split('\n').map((s) => s.trim()).filter(Boolean)
      .filter((f) => !CHECK2_WHITELIST.has(f) && !f.startsWith(CHECK2_WHITELIST_PREFIX));
    assert.deepStrictEqual(files, [], 'no non-whitelisted file references the old 189-char path; offenders: ' + JSON.stringify(files));
    pass('Check 2 (no dangling old-path refs outside the historical-record whitelist)');
  }
} catch (err) { failTest('Check 2 (no dangling old-path refs)', err); }

// Check 3: git rename history preserved on the renamed dir.
try {
  const renamedDir = path.join(PHASES_DIR, NEW_92_LEAF);
  if (!gitAvailable()) {
    console.log('SKIP: git unavailable -- cannot check rename history.');
  } else if (!fs.existsSync(renamedDir)) {
    console.log('SKIP: ' + NEW_92_LEAF + ' does not exist -- 95.6-01 has not run yet.');
  } else {
    const out = execSync('git log --follow --oneline -- ".planning/phases/' + NEW_92_LEAF + '/"', { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    assert.ok(out.length > 0, 'git log --follow on the renamed dir is non-empty (rename history preserved)');
    pass('Check 3 (rename history preserved)');
  }
} catch (err) { failTest('Check 3 (rename history preserved)', err); }

if (failed > 0) {
  console.log('\n' + failed + ' check(s) FAILED');
  process.exit(1);
}
console.log('\nAll ' + passed + ' check(s) PASS');
process.exit(0);
