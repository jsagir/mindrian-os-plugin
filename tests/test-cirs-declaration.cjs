#!/usr/bin/env node
'use strict';

/*
 * Phase 172-02 Task 3 -- the R12 gate-hook validator test (Canon Part 11 R12).
 *
 * Fences scripts/check-cirs-declaration.cjs checkCirsDeclaration(frontmatter):
 *   Test 1: a plan touching commands/foo.md WITH a conformant cirs_relationship
 *           block PASSES.
 *   Test 2: a plan touching skills/x/SKILL.md with NO cirs_relationship block
 *           FAILS with a named error.
 *   Test 3: a plan declaring a cirs_relationship field but MISSING 11 from
 *           canon_parts FAILS (the auto-derivation disagreement).
 *   Test 4: a plan touching no invocable surface AND consuming no spine, with no
 *           cirs_relationship block, PASSES (declaration only required when
 *           triggered).
 *   Plus: the two real shipping plans (172-01, 172-02) are conformant fixtures,
 *         and the validator makes zero Brain/network calls.
 *
 * In-memory frontmatter fixtures: zero subprocess, zero Brain, zero network.
 * House rule: hyphens only, no em-dashes, no emoji.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(REPO_ROOT, 'scripts', 'check-cirs-declaration.cjs');
const mod = require(HOOK);
const { checkCirsDeclaration, parsePlanFrontmatter } = mod;

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log('  ok  ' + label);
  } else {
    console.error('  FAIL  ' + label);
    failures += 1;
  }
}

// A conformant cirs_relationship block (all five structured fields + non-empty
// explanation prose).
const CONFORMANT_REL = {
  surfaces_added: ['commands/foo.md'],
  surfaces_modified: [],
  surfaces_removed: [],
  spine_consumed: [],
  gate_impact: 'wires foo under the born-wired gate',
  explanation: 'This phase adds commands/foo.md and wires it under CIRS R2.',
};

// ---------------------------------------------------------------------------
// Test 1: surface-touching plan WITH a conformant block -> PASS.
// ---------------------------------------------------------------------------
(function test1() {
  const fm = {
    files_modified: ['commands/foo.md'],
    canon_parts: [2, 3, 11],
    cirs_relationship: CONFORMANT_REL,
  };
  const res = checkCirsDeclaration(fm);
  assert(res && res.ok === true, 'Test 1: commands/foo.md + conformant block -> ok');
  assert(res && Array.isArray(res.errors) && res.errors.length === 0, 'Test 1: zero errors');
})();

// ---------------------------------------------------------------------------
// Test 2: skill-touching plan with NO cirs_relationship block -> FAIL + named.
// ---------------------------------------------------------------------------
(function test2() {
  const fm = {
    files_modified: ['skills/x/SKILL.md'],
    canon_parts: [2, 3],
    // no cirs_relationship
  };
  const res = checkCirsDeclaration(fm);
  assert(res && res.ok === false, 'Test 2: skill surface + no block -> not ok');
  const named = (res.errors || []).some((e) => /cirs_relationship/i.test(e));
  assert(named, 'Test 2: error names the missing cirs_relationship block');
})();

// ---------------------------------------------------------------------------
// Test 3: declares a cirs_relationship field but MISSING 11 from canon_parts.
// ---------------------------------------------------------------------------
(function test3() {
  const fm = {
    files_modified: ['commands/foo.md'],
    canon_parts: [2, 3], // 11 absent -> derivation disagreement
    cirs_relationship: CONFORMANT_REL,
  };
  const res = checkCirsDeclaration(fm);
  assert(res && res.ok === false, 'Test 3: cirs_relationship without canon_parts 11 -> not ok');
  const named = (res.errors || []).some((e) => /canon_parts/i.test(e) && /11/.test(e));
  assert(named, 'Test 3: error names the canon_parts-11 auto-derivation disagreement');
})();

// ---------------------------------------------------------------------------
// Test 4: no invocable surface, no spine -> no block required -> PASS.
// ---------------------------------------------------------------------------
(function test4() {
  const fm = {
    files_modified: ['docs/SOMETHING.md', 'tests/test-something.cjs'],
    canon_parts: [6],
    // no cirs_relationship and none required
  };
  const res = checkCirsDeclaration(fm);
  assert(res && res.ok === true, 'Test 4: no surface + no spine + no block -> ok');
  assert(res && res.errors.length === 0, 'Test 4: zero errors (untriggered)');
})();

// ---------------------------------------------------------------------------
// Test 5: spine-consuming plan with NO block -> FAIL (spine trigger).
// ---------------------------------------------------------------------------
(function test5() {
  const fm = {
    files_modified: ['lib/foo.cjs'],
    canon_parts: [7],
    cirs_relationship: {
      surfaces_added: [],
      surfaces_modified: [],
      surfaces_removed: [],
      spine_consumed: ['scripts/build-connector-registry.cjs'],
      gate_impact: 'none',
      // explanation MISSING -> non-conformant
    },
  };
  const res = checkCirsDeclaration(fm);
  assert(res && res.ok === false, 'Test 5: spine_consumed declared but explanation missing -> not ok');
  const named = (res.errors || []).some((e) => /explanation/i.test(e));
  assert(named, 'Test 5: error names the missing explanation prose');
})();

// ---------------------------------------------------------------------------
// Real-plan fixtures: 172-01 and 172-02 must both be conformant.
// ---------------------------------------------------------------------------
(function testRealPlans() {
  const planDir = path.join(
    REPO_ROOT, '.planning', 'phases', '172-contextual-invocation-coverage'
  );
  for (const f of ['172-01-PLAN.md', '172-02-PLAN.md']) {
    const p = path.join(planDir, f);
    if (!fs.existsSync(p)) {
      assert(false, 'real-plan fixture present: ' + f);
      continue;
    }
    const fm = parsePlanFrontmatter(fs.readFileSync(p, 'utf8'));
    const res = checkCirsDeclaration(fm);
    assert(res && res.ok === true, f + ' is CIRS-conformant (ok)');
    if (!res.ok) console.error('    ' + (res.errors || []).join('\n    '));
  }
})();

// ---------------------------------------------------------------------------
// Part 8 / locality: the hook source makes zero Brain/network calls.
// ---------------------------------------------------------------------------
(function testNoNetwork() {
  const src = fs.readFileSync(HOOK, 'utf8');
  const stripped = src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n');
  const forbidden = /\b(fetch|https?:\/\/|require\(['"]https?['"]\)|brain-client|brain\.query)\b/i;
  assert(!forbidden.test(stripped), 'hook source has no fetch/http/brain (Part 8 local-only)');
})();

console.log('');
if (failures > 0) {
  console.error(failures + ' assertion(s) FAILED');
  process.exit(1);
}
console.log('all cirs-declaration assertions PASSED');
process.exit(0);
