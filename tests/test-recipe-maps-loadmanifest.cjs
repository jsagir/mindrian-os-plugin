'use strict';
/*
 * Phase 167-01 Task 2 - recipe-maps loadManifest() accessor (D-167-02).
 *
 * Proves recipe-maps WRAPS, not becomes:
 *   Test 1  loadManifest() returns the declared three-map binding (posture /
 *           wiring / ranked_next_reach by path + role); a missing / malformed
 *           manifest degrades to a documented empty binding (never throws).
 *   Test 2  the three shipped read-join functions are BYTE-UNCHANGED in behavior
 *           (postureForCommand / wiringForReach / rankedNextReach still answer
 *           from the live maps); recipe-maps is NOT retired (D-166-03).
 *   Test 3  loadManifest is the DECLARED descriptor reader; the doc-comment names
 *           the declared-vs-executable split so a reader does not collapse one
 *           into the other.
 *   Test 4  a forbidden-token scan over recipe-maps.cjs confirms the loadManifest
 *           addition introduces ZERO Brain calls (Part 8 clean surface).
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const RECIPE_MAPS_PATH = path.join(REPO_ROOT, 'lib', 'core', 'recipe-maps.cjs');

const recipeMaps = require(RECIPE_MAPS_PATH);

const EXPECTED_ROLES = ['posture', 'wiring', 'ranked_next_reach'];

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  PASS ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

// ---------------------------------------------------------------------------
// Test 1 - loadManifest() returns the declared three-map binding; degrades on a
// missing / malformed manifest.
// ---------------------------------------------------------------------------
(function test1_binding() {
  const label = 'Test 1 - loadManifest returns the declared three-map binding + degrades cleanly';
  try {
    recipeMaps.__reset();
    const binding = recipeMaps.loadManifest();
    assert.ok(binding && typeof binding === 'object', label + ': returns an object');
    assert.ok(Array.isArray(binding.maps), label + ': binding.maps is an array');
    assert.equal(binding.maps.length, 3, label + ': names exactly three maps');
    const roles = binding.maps.map((m) => m.role).sort();
    assert.deepEqual(roles, [...EXPECTED_ROLES].sort(),
      label + ': the three roles are posture / wiring / ranked_next_reach');
    for (const m of binding.maps) {
      assert.equal(typeof m.path, 'string', label + ': each entry names a map path');
      assert.equal(typeof m.role, 'string', label + ': each entry names a role');
    }
    assert.equal(binding.methodology_tier, 'mindrian-operation',
      label + ': the binding carries the machinery tier');

    // manifest() is an alias.
    const alias = recipeMaps.manifest();
    assert.deepEqual(alias, binding, label + ': manifest() aliases loadManifest()');

    // Degrade: point at a missing manifest via the env override.
    const prev = process.env.MINDRIAN_HARNESS_MANIFEST;
    process.env.MINDRIAN_HARNESS_MANIFEST = path.join(os.tmpdir(), 'does-not-exist-harness-manifest.json');
    recipeMaps.__reset();
    const empty = recipeMaps.loadManifest();
    assert.deepEqual(empty.maps, [], label + ': a missing manifest degrades to an empty binding, never throws');
    // Restore.
    if (typeof prev === 'string') process.env.MINDRIAN_HARNESS_MANIFEST = prev;
    else delete process.env.MINDRIAN_HARNESS_MANIFEST;
    recipeMaps.__reset();
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 2 - the three read-join functions are byte-unchanged in behavior;
// recipe-maps is NOT retired.
// ---------------------------------------------------------------------------
(function test2_threeFunctionsUnchanged() {
  const label = 'Test 2 - postureForCommand / wiringForReach / rankedNextReach unchanged (D-166-03)';
  try {
    recipeMaps.__reset();
    // postureForCommand still returns the posture authority answer shape.
    const posture = recipeMaps.postureForCommand('/mos:think-hats');
    assert.ok(posture && typeof posture === 'object', label + ': postureForCommand returns an object');
    assert.equal(posture.command, '/mos:think-hats', label + ': posture echoes the command');
    assert.equal(typeof posture.autonomous_safe, 'boolean', label + ': posture carries autonomous_safe');
    assert.ok(posture.posture === 'run' || posture.posture === 'halt',
      label + ': posture is a run/halt verb');

    // wiringForReach still returns an array of surfaces.
    const wiring = recipeMaps.wiringForReach('hats');
    assert.ok(Array.isArray(wiring), label + ': wiringForReach returns an array');

    // rankedNextReach still returns ranked candidates (array).
    const ranked = recipeMaps.rankedNextReach();
    assert.ok(Array.isArray(ranked), label + ': rankedNextReach returns an array');

    // recipe-maps still exports all three (NOT retired).
    assert.equal(typeof recipeMaps.postureForCommand, 'function', label + ': postureForCommand exported');
    assert.equal(typeof recipeMaps.wiringForReach, 'function', label + ': wiringForReach exported');
    assert.equal(typeof recipeMaps.rankedNextReach, 'function', label + ': rankedNextReach exported');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 3 - the doc-comment names the declared-vs-executable split.
// ---------------------------------------------------------------------------
(function test3_docComment() {
  const label = 'Test 3 - loadManifest doc-comment names the declared-vs-executable split';
  try {
    const src = fs.readFileSync(RECIPE_MAPS_PATH, 'utf8');
    assert.ok(/loadManifest/.test(src), label + ': source defines loadManifest');
    assert.ok(/DECLARED/.test(src) && /EXECUTABLE/.test(src),
      label + ': the doc-comment names the declared / executable split');
    assert.ok(/D-167-02/.test(src), label + ': the doc-comment cites D-167-02');
    assert.ok(/NOT retired/.test(src) || /not retired/i.test(src),
      label + ': the doc-comment states recipe-maps is not retired (D-166-03)');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Test 4 - forbidden-token scan: the loadManifest addition introduces ZERO Brain
// calls. Comment lines filtered (grep -v '^#' spirit; CJS comments lead with //
// or *) so a comment naming "Brain" cannot self-invalidate the count.
// ---------------------------------------------------------------------------
(function test4_zeroBrain() {
  const label = 'Test 4 - recipe-maps carries zero Brain calls (Part 8 clean surface)';
  try {
    const raw = fs.readFileSync(RECIPE_MAPS_PATH, 'utf8');
    const codeLines = raw.split('\n').filter((ln) => {
      const t = ln.trim();
      if (t.startsWith('//')) return false;
      if (t.startsWith('*')) return false;
      if (t.startsWith('/*')) return false;
      return true;
    });
    const code = codeLines.join('\n');

    // No mcp__brain_ token in live code.
    assert.equal(/mcp__brain_/.test(code), false, label + ': no mcp__brain_ token in code');
    // No brain-client require.
    assert.equal(/require\s*\(\s*[^)]*brain-client[^)]*\)/.test(code), false,
      label + ': no brain-client require');
    // No raw fetch( call.
    assert.equal(/[^a-zA-Z_.]fetch\s*\(/.test(code), false, label + ': no raw fetch( call');
    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write(
  'recipe-maps loadManifest: ' + passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
