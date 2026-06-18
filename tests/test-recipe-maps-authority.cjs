'use strict';
// Phase 166-01 Task 2 -- recipe-maps.cjs three-maps-three-jobs authority test (B4, D-166-03).
//
// B4 wires one read-only joiner over the three EXISTING recipe maps, each for exactly
// ONE job, LAYERED not merged:
//   - data/command-registry.json   -> posture / autonomy authority (via command-resolver)
//   - data/connector-registry.json -> reach -> surface wiring
//   - data/brain-orchestration-projection.json -> ranked next-reach (the chef's suggestion)
//
// Four behaviors:
//   Test 1: postureForCommand('/mos:think-hats') returns the posture authority answer
//           joined from command-registry (autonomous_safe + posture); an unknown command
//           degrades to a withhold-default, never a fabricated autonomous_safe.
//   Test 2: wiringForReach('context_block') returns the connector-registry surface(s);
//           an unknown reach returns [].
//   Test 3: rankedNextReach({...}) returns the ranked next-reach list from the projection;
//           a missing/malformed projection degrades to [] (never throws). CONTRACT-ONLY.
//   Test 4: forbidden-token scan over recipe-maps.cjs -- ZERO Brain calls (no mcp__brain_,
//           no brain-client require, no raw fetch). Part 8.
//
// Plain node assert harness. NO em-dashes. node built-ins only.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const RECIPE_MAPS_PATH = path.join(REPO_ROOT, 'lib', 'core', 'recipe-maps.cjs');
const rm = require(RECIPE_MAPS_PATH);

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

console.log('test-recipe-maps-authority');

// (1) posture from command-registry (one job: posture/autonomy authority).
check('postureForCommand: known command returns posture authority; unknown degrades to withhold-default', () => {
  const known = rm.postureForCommand('/mos:think-hats');
  assert.ok(known && typeof known === 'object', 'expected an object for a known command');
  // /mos:think-hats ships autonomous_safe:true in command-registry.json.
  assert.equal(known.autonomous_safe, true, "expected autonomous_safe true for /mos:think-hats");
  assert.equal(known.posture, 'run', "expected posture 'run' for an autonomous_safe command (push_forward -> auto-run)");

  const unknown = rm.postureForCommand('/mos:does-not-exist-xyz');
  assert.ok(unknown && typeof unknown === 'object', 'expected an object for an unknown command');
  assert.equal(unknown.autonomous_safe, false, 'unknown command must NOT be fabricated autonomous_safe');
  assert.equal(unknown.posture, 'halt', "unknown command degrades to a withhold-default ('halt')");
});

// (2) wiring from connector-registry (one job: reach -> surface).
check('wiringForReach: known reach returns surface(s); unknown reach returns []', () => {
  const surfaces = rm.wiringForReach('context_block');
  assert.ok(Array.isArray(surfaces), 'expected an array of surfaces');
  assert.ok(surfaces.length > 0, "expected at least one surface for reach 'context_block'");
  // The connector spine wires a reach to its dispatch-target surface(s); a
  // surface is a command (/mos:*), an agent (agent:*), or a skill (skill:*).
  // Every wired surface must be a non-empty string (the onStep dispatch target).
  assert.ok(
    surfaces.every((s) => typeof s === 'string' && s.length > 0),
    'expected every wired surface to be a non-empty dispatch-target string'
  );
  assert.ok(
    surfaces.some((s) => s.startsWith('/mos:')),
    "expected at least one /mos: command surface for reach 'context_block'"
  );

  const none = rm.wiringForReach('no_such_reach_xyz');
  assert.deepEqual(none, [], 'expected [] for an unknown reach');
});

// (3) ranked next-reach from the projection (one job: chef's suggestion). CONTRACT-ONLY.
check('rankedNextReach: returns ranked candidates from the projection; never throws', () => {
  const ranked = rm.rankedNextReach({});
  assert.ok(Array.isArray(ranked), 'expected an array from rankedNextReach');
  assert.ok(ranked.length > 0, 'expected ranked candidates from the 207-node projection');
  // Each candidate exposes a reach_id (the ranked next-reach identity).
  assert.ok(
    ranked.every((r) => r && typeof r.reach_id === 'string'),
    'expected every ranked candidate to carry a reach_id'
  );
});

// (4) Part 8: zero Brain egress in recipe-maps.cjs (forbidden-token scan).
check('recipe-maps.cjs makes ZERO Brain calls (Part 8 forbidden-token scan)', () => {
  const src = fs.readFileSync(RECIPE_MAPS_PATH, 'utf8');
  // Strip comment lines so a doc-comment naming a forbidden token cannot self-invalidate.
  const codeLines = src
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return t.length > 0 && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    });
  const code = codeLines.join('\n');

  assert.ok(!/mcp__brain_/.test(code), 'recipe-maps.cjs must not call mcp__brain_ tools');
  assert.ok(!/brain-client|brainClient|brain_client/.test(code), 'recipe-maps.cjs must not require a brain client');
  assert.ok(!/[^a-zA-Z_]fetch\s*\(/.test(code), 'recipe-maps.cjs must not open a raw fetch( egress');
  assert.ok(!/require\(['"]https?:?/.test(code), 'recipe-maps.cjs must not require an http(s) module path');
});

console.log(`\n${pass}/4 assertions passed`);
if (pass !== 4) {
  console.error('FAIL: not all assertions passed');
  process.exit(1);
}
