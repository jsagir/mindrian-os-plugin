'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 222-04 -- the Req 4 zero-dependency require-tripwire, landed in Wave 4.
 * =========================================================================
 * The Phase 222 ranking unification ships ZERO new npm dependencies. Every one
 * of the three new source files must require ONLY Node built-ins (node:*) or a
 * relative path that resolves inside this repo's lib/ or data/ trees. A bare
 * package name (zod, better-sqlite3, anything npm-shaped) is a Req 4 breach and
 * fails this suite with the offending file and target named.
 *
 * This is the Phase-90 5-tripwire pattern applied to Phase 222's own new tree:
 * a standing grep-over-source guard, not a one-time review. Paired with the
 * git-diff leg in run-all-222.sh (which fails if package.json / package-lock.json
 * ever drift), Req 4 is locked forever.
 *
 * Hygiene: comment lines are stripped BEFORE the require regex runs, so a header
 * comment mentioning a package name never trips OR masks the gate.
 *
 * Plain CJS node:assert/strict; PASS line + non-zero exit on failure.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const LIB_ROOT = path.join(REPO_ROOT, 'lib');
const DATA_ROOT = path.join(REPO_ROOT, 'data');

// The three new source files this phase introduced. Each is swept for its
// require() targets; every target must be node:* or resolve inside lib/ or data/.
const NEW_SOURCE_FILES = [
  'lib/workflow/reach-hedge-ranker.cjs',
  'lib/core/navigation/ranker-weights.cjs',
  'lib/core/migrations/phase-222-ranker-weights.cjs',
];

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

// Strip whole-line comments (// or block-comment body lines beginning with
// optional whitespace then // or * or /*) so a comment naming a package never
// trips or masks the gate. Mirrors run-all-158.sh:75's strip_comments idiom.
function stripComments(src) {
  return src
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');
}

// Extract every require('...') / require("...") target from executable source.
function extractRequireTargets(src) {
  const targets = [];
  const re = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    targets.push(m[1]);
  }
  return targets;
}

// A target is allowed iff it is a node: built-in OR a relative path that resolves
// (against the requiring file's dirname) to a location inside lib/ or data/.
function isAllowedTarget(target, fileAbsPath) {
  if (target.startsWith('node:')) {
    return true;
  }
  // Only relative targets can be repo-internal; a bare package name (no leading
  // '.' or '/') is by definition an npm dependency -> forbidden.
  if (!target.startsWith('.') && !target.startsWith('/')) {
    return false;
  }
  const resolved = path.resolve(path.dirname(fileAbsPath), target);
  const inLib = resolved === LIB_ROOT || resolved.startsWith(LIB_ROOT + path.sep);
  const inData = resolved === DATA_ROOT || resolved.startsWith(DATA_ROOT + path.sep);
  return inLib || inData;
}

console.log('test-222-zero-deps.cjs (Req 4): the three new source files require node:* + repo lib/ and data/ only');

for (const rel of NEW_SOURCE_FILES) {
  const abs = path.join(REPO_ROOT, rel);

  check(rel + ' exists on disk', () => {
    assert.ok(fs.existsSync(abs), 'missing new source file: ' + rel);
  });

  check(rel + ' requires only node:* or repo lib/ + data/ targets (Req 4 tripwire)', () => {
    const raw = fs.readFileSync(abs, 'utf8');
    const executable = stripComments(raw);
    const targets = extractRequireTargets(executable);
    for (const target of targets) {
      assert.ok(
        isAllowedTarget(target, abs),
        'FORBIDDEN dependency require("' + target + '") in ' + rel +
          ' -- Req 4 allows only node:* built-ins and relative paths inside lib/ or data/'
      );
    }
  });
}

// Self-guard: the sweep must actually have seen at least one require in the
// primary module, so an accidental empty-scan (regex drift, wrong path) cannot
// pass vacuously.
check('the sweep is non-vacuous: reach-hedge-ranker.cjs has >= 1 require target seen', () => {
  const raw = fs.readFileSync(path.join(REPO_ROOT, 'lib/workflow/reach-hedge-ranker.cjs'), 'utf8');
  const targets = extractRequireTargets(stripComments(raw));
  assert.ok(targets.length >= 1, 'expected >= 1 require in reach-hedge-ranker.cjs; the scan saw none (regex/path drift)');
});

console.log('');
console.log('test-222-zero-deps.cjs: PASS (' + passed + ' checks)');
