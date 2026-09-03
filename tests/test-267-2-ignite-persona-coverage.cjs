'use strict';
// Phase 267.2 Plan 04 -- drift pin for the ignite Gate B1 Door 1 persona-pick coverage fix
// (the folded todo 2026-06-28-ignite-persona-card-under-shows-frozen-role-blend-vocabulary).
//
// Guards, at run time, against the exact drift the folded todo found: the Door 1 card and its
// Tri-Polar card-incapable fallback silently drifting away from the frozen ROLE_BLEND_KEYS
// vocabulary (lib/core/persona-override.cjs), and Door 1's two AskUserQuestion steps silently
// growing back past the render cap. This test NEVER restates the seven role names inline -- it
// requires ROLE_BLEND_KEYS and drives every assertion off that live array, so a future edit to
// the frozen vocabulary itself surfaces here rather than silently re-diverging.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { ROLE_BLEND_KEYS } = require('../lib/core/persona-override.cjs');

const REPO = path.join(__dirname, '..');
const IGNITE = path.join(REPO, 'commands', 'ignite.md');

// The AskUserQuestion render cap: at most 4 options per question. Cited so the number is
// traceable to its source rather than a magic literal.
// [CITED: anthropics/claude-code issues #12420, #26183]
const ASK_USER_QUESTION_MAX_OPTIONS = 4;

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-267-2-ignite-persona-coverage');

const src = fs.readFileSync(IGNITE, 'utf8');

// ---------- Assertion 1 + 2 + 3: every ROLE_BLEND_KEYS key resolves role_blend + blueprintFamily ----------

const DECLARED_FAMILIES = ['exploration', 'venture'];

const roleBlendByKey = {};
for (const key of ROLE_BLEND_KEYS) {
  ok('Door 1 resolves role_blend={' + key + ':1.0} in commands/ignite.md', function () {
    const marker = 'role_blend={' + key + ':1.0}';
    const idx = src.indexOf(marker);
    assert.notEqual(idx, -1, 'missing frozen key from Door 1: ' + key
      + ' -- the card under-shows ROLE_BLEND_KEYS again, re-run the 267.2-04 fix');
    // Same line must carry an adjacent blueprintFamily= value.
    const lineStart = src.lastIndexOf('\n', idx) + 1;
    const lineEnd = src.indexOf('\n', idx);
    const line = src.slice(lineStart, lineEnd === -1 ? src.length : lineEnd);
    const famMatch = line.match(/blueprintFamily=([a-z_]+)/);
    assert.ok(famMatch, 'role_blend={' + key + ':1.0} has no adjacent blueprintFamily= on its line: ' + line);
    assert.ok(DECLARED_FAMILIES.includes(famMatch[1]),
      'role_blend={' + key + ':1.0} resolves an undefined blueprintFamily: ' + famMatch[1]
      + ' -- not one of ' + JSON.stringify(DECLARED_FAMILIES));
    roleBlendByKey[key] = famMatch[1];
  });
}

ok('every one of the 7 frozen ROLE_BLEND_KEYS was captured with a defined blueprintFamily', function () {
  assert.equal(Object.keys(roleBlendByKey).length, ROLE_BLEND_KEYS.length,
    'expected ' + ROLE_BLEND_KEYS.length + ' captured keys, found ' + Object.keys(roleBlendByKey).length);
});

ok('mentor specifically resolves blueprintFamily=exploration (decision D-H)', function () {
  assert.equal(roleBlendByKey.mentor, 'exploration',
    'mentor resolved blueprintFamily=' + roleBlendByKey.mentor + ', expected exploration per D-H'
    + ' -- a silent reversal of D-H, re-check commands/ignite.md');
});

// ---------- Assertion 4: Tri-Polar fallback lists every ROLE_BLEND_KEYS key ----------

ok('Tri-Polar card-incapable fallback line mentions every ROLE_BLEND_KEYS key', function () {
  const triPolarIdx = src.indexOf('Tri-Polar (card-incapable surfaces ONLY):');
  assert.notEqual(triPolarIdx, -1, 'Tri-Polar fallback line not found in commands/ignite.md');
  const lineEnd = src.indexOf('\n', triPolarIdx);
  const triPolarLine = src.slice(triPolarIdx, lineEnd === -1 ? src.length : lineEnd);
  for (const key of ROLE_BLEND_KEYS) {
    // domain_expert renders as "domain expert" (space, not underscore) in the prose list.
    const label = key.replace(/_/g, ' ');
    assert.ok(triPolarLine.toLowerCase().indexOf(label) !== -1,
      'Tri-Polar fallback missing persona: ' + label
      + ' -- the card path and the card-incapable path have drifted apart (PATTERNS.md A9)');
  }
});

// ---------- Assertion 5: option-cap guard on both Door 1 steps ----------

ok('step 1 has at most ' + ASK_USER_QUESTION_MAX_OPTIONS + ' options (AskUserQuestion render cap)', function () {
  const marker = 'exactly four options:';
  const startIdx = src.indexOf(marker);
  assert.notEqual(startIdx, -1, 'step-1 options marker not found');
  const endIdx = src.indexOf('Step 2 fires', startIdx);
  assert.notEqual(endIdx, -1, 'step-2 marker not found after step-1 options');
  const block = src.slice(startIdx + marker.length, endIdx);
  const step1Options = block.split('\n').filter(function (l) { return /^\s*-\s+\S/.test(l); });
  assert.ok(step1Options.length > 0, 'no step-1 options parsed');
  assert.ok(step1Options.length <= ASK_USER_QUESTION_MAX_OPTIONS,
    'step 1 has ' + step1Options.length + ' options, exceeds the ' + ASK_USER_QUESTION_MAX_OPTIONS
    + '-option AskUserQuestion render cap');
});

ok('every step 2 branch has at most ' + ASK_USER_QUESTION_MAX_OPTIONS + ' options', function () {
  const startMarker = 'deriving blueprintFamily:';
  const startIdx = src.indexOf(startMarker);
  assert.notEqual(startIdx, -1, 'step-2 branch-list marker not found');
  const endIdx = src.indexOf('Do NOT mint a new frozen key', startIdx);
  assert.notEqual(endIdx, -1, 'end-of-step-2 marker not found');
  const block = src.slice(startIdx + startMarker.length, endIdx);

  // Each branch is a top-level bullet ("  - `Label` narrows to:") followed by nested bullets
  // ("    - Option -- role_blend=... blueprintFamily=...").
  const branchRe = /^ {2}- `([^`]+)` narrows to:\n((?: {4}-.*\n?)+)/gm;
  const branches = [];
  let m;
  while ((m = branchRe.exec(block)) !== null) {
    branches.push({ label: m[1], options: m[2].split('\n').filter(function (l) { return /^\s*-\s+\S/.test(l); }) });
  }
  assert.ok(branches.length >= 3,
    'expected at least 3 step-2 branches (Building / Studying / Backing-or-guiding), found '
    + branches.length);
  for (const branch of branches) {
    assert.ok(branch.options.length > 0, 'branch "' + branch.label + '" has zero parsed options');
    assert.ok(branch.options.length <= ASK_USER_QUESTION_MAX_OPTIONS,
      'branch "' + branch.label + '" has ' + branch.options.length + ' options, exceeds the '
      + ASK_USER_QUESTION_MAX_OPTIONS + '-option AskUserQuestion render cap');
  }
});

// ---------- Assertion 6: negative guard, no portfolio_manager mint (decision D-J) ----------

ok('commands/ignite.md contains no portfolio_manager string (decision D-J, not minted)', function () {
  assert.equal(src.indexOf('portfolio_manager'), -1,
    'portfolio_manager found in commands/ignite.md -- D-J says this key is NOT minted; '
    + 'a Canon ratification is required before this string may appear as a role_blend key');
});

console.log('\nPASS test-267-2-ignite-persona-coverage (' + n + ' assertions)');
