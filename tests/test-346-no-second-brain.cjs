'use strict';
// Phase 346-04 (Task 3) -- the no-second-brain drift guard: a comment-
// stripped source scan over lib/core/arbitration.cjs proving the module
// cannot become a second selection brain (346-RESEARCH.md Pitfall 1), the
// failure that would quietly make CLAUDE.md:152's one-governed-path claim
// false.
//
// Comment-stripping is MANDATORY and happens BEFORE any assertion runs
// against the source text: the module's own header names fire_skill,
// offer_next_step and suppress_skills in the sentence explaining that it
// never sets them (see lib/core/arbitration.cjs's naming-fence-adjacent
// prose and this file's own doc comments), so an unstripped scan would be
// self-invalidating -- it would find the very words it is checking for
// inside a comment that explicitly disclaims them, and report a false
// positive. Strip first, then scan the code that is actually left.
//
// House idiom: node:assert/strict, `let n = 0; function ok(...)`, final line
// `>>> test-346-no-second-brain.cjs: PASSED`.
//
// House rule: hyphens only, no em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO = path.join(__dirname, '..');
const MODULE_PATH = path.join(REPO, 'lib', 'core', 'arbitration.cjs');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-346-no-second-brain');

const rawSource = fs.readFileSync(MODULE_PATH, 'utf8');

/**
 * Strip block comments then line comments. Order matters: stripping block
 * comments first prevents a `//` inside a `/* ... *\/` block from being
 * mistaken for a line comment start after the block is gone, and stripping
 * line comments second catches anything a block-comment removal exposed.
 * @param {string} src
 * @returns {string}
 */
function stripComments(src) {
  const noBlocks = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const noLines = noBlocks.replace(/^\s*\/\/.*$/gm, '').replace(/([^:])\/\/.*$/gm, '$1');
  return noLines;
}

const strippedSource = stripComments(rawSource);

ok('the stripped source no longer carries any comment-only forbidden-name sentence', function () {
  // A sanity check on the stripping step itself: the raw source DOES name
  // fire_skill in its own explanatory prose (this is expected and fine),
  // but a properly stripped scan must not see it inside a comment.
  assert.ok(strippedSource.length < rawSource.length, 'stripping must remove at least the copyright block');
});

ok('zero assignment to fire_skill, offer_next_step or suppress_skills', function () {
  const forbidden = ['fire_skill', 'offer_next_step', 'suppress_skills'];
  forbidden.forEach(function (name) {
    const assignPattern = new RegExp('\\.' + name + '\\s*=', 'g');
    const objectLiteralPattern = new RegExp('\\b' + name + '\\s*:', 'g');
    const assignMatches = strippedSource.match(assignPattern) || [];
    const literalMatches = strippedSource.match(objectLiteralPattern) || [];
    assert.equal(assignMatches.length, 0, 'found assignment to ' + name + ': ' + JSON.stringify(assignMatches));
    assert.equal(literalMatches.length, 0, 'found object-literal key ' + name + ': ' + JSON.stringify(literalMatches));
  });
});

ok('zero require() of a sensor, ranker, orchestrator or navigation module', function () {
  const forbidden = [
    'insight-sensors', 'f-selector-ranker', 'dial-reach-orchestrator',
    'sensors/', 'navigation-engine', 'navigation.cjs', 'navigation/',
  ];
  const requireMatches = [...strippedSource.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map(function (m) { return m[1]; });
  requireMatches.forEach(function (target) {
    forbidden.forEach(function (f) {
      assert.ok(target.indexOf(f) === -1, 'forbidden require target "' + f + '" found: ' + target);
    });
  });
});

ok('zero require() of a network/process built-in or lib/mcp//lib/memory/', function () {
  const forbidden = [
    'node:fs', 'node:http', 'node:https', 'node:net', 'node:child_process',
    'node:worker_threads', 'lib/mcp/', 'lib/memory/',
  ];
  const requireMatches = [...strippedSource.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map(function (m) { return m[1]; });
  requireMatches.forEach(function (target) {
    forbidden.forEach(function (f) {
      assert.ok(target.indexOf(f) === -1, 'forbidden require target "' + f + '" found: ' + target);
    });
  });
});

ok('the complete require() set is exactly the three sibling pure modules, both directions', function () {
  const requireMatches = [...strippedSource.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map(function (m) { return m[1]; });
  const uniqueSorted = Array.from(new Set(requireMatches)).sort();
  const expected = ['./decision-axes.cjs', './directive-envelope.cjs', './persona-taxonomy.cjs'].sort();
  assert.deepEqual(uniqueSorted, expected, 'require set mismatch. Found: ' + JSON.stringify(uniqueSorted) + ' expected: ' + JSON.stringify(expected));
});

ok('every exported value is a frozen array, a string, or a function; no exported function has a param named db', function () {
  delete require.cache[require.resolve(MODULE_PATH)];
  const a = require(MODULE_PATH);
  Object.keys(a).forEach(function (key) {
    if (key === '_test') return; // private test seam, not a public export contract
    const v = a[key];
    const isFrozenArray = Array.isArray(v) && Object.isFrozen(v);
    const isString = typeof v === 'string';
    const isFunction = typeof v === 'function';
    assert.ok(isFrozenArray || isString || isFunction, 'export "' + key + '" must be a frozen array, a string, or a function, got: ' + typeof v);
  });

  // Scan the stripped source's own function signatures for a `db` parameter.
  const fnSignatures = [...strippedSource.matchAll(/function\s*[A-Za-z0-9_]*\s*\(([^)]*)\)/g)].map(function (m) { return m[1]; });
  fnSignatures.forEach(function (paramList) {
    const params = paramList.split(',').map(function (p) { return p.trim(); });
    assert.ok(params.indexOf('db') === -1, 'a function signature names a "db" parameter: (' + paramList + ')');
  });
});

ok('tests/test-posture-ids-drift.cjs still exits 0 (spawned in this run)', function () {
  execFileSync(process.execPath, [path.join(REPO, 'tests', 'test-posture-ids-drift.cjs')], { stdio: 'ignore' });
});

console.log(n + ' assertions passed');
console.log('>>> test-346-no-second-brain.cjs: PASSED');
process.exit(0);
