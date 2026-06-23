'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 172-05 Task 2 -- the 'hats' case in reachIdToSkillFamily.
 * ==============================================================
 * The Phase-148 D-09 amendment minted `hats` as a REAL 6th machine reach_id, but
 * the engine's reachIdToSkillFamily switch had no `hats` case (the default
 * returned null), so a fired `hats` reach could NOT flip routing_source
 * legacy->engine -- the 6th reach was connector-wired only, engine-unmapped.
 * This suite is the falsifiable contract for the engine MAPPING that closes the
 * gap.
 *
 * The four behaviors (172-05-PLAN.md Task 2 <behavior>):
 *   1. reachIdToSkillFamily('hats') returns a non-null canonical verb.
 *   2. the returned verb is a member of the existing CANONICAL_VERBS set
 *      (mints no new verb).
 *   3. a sensorReaches array whose top reach is {reach_id:'hats'} resolves to a
 *      non-null fireSkill in resolveFireSkill (so routing_source can flip).
 *   4. the five existing cases (context_block / contradiction / cross_room /
 *      brain_consult / deep_research) are unchanged in behavior.
 *
 * Plain CJS node:assert/strict; PASS line + non-zero exit on failure.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE). Hyphens only.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const engine = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine.cjs'));
const shared = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine-shared.cjs'));

const CANONICAL_VERBS = new Set(shared.CANONICAL_VERBS);

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

console.log('test-172-hats-reach-case.cjs (172-05 Task 2): the hats engine MAPPING');

// ---------------------------------------------------------------------------
// Behavior 1: reachIdToSkillFamily('hats') returns a non-null canonical verb.
// ---------------------------------------------------------------------------
check("reachIdToSkillFamily('hats') returns a non-null verb", () => {
  const verb = engine.reachIdToSkillFamily('hats');
  assert.ok(verb !== null && verb !== undefined,
    "reachIdToSkillFamily('hats') must NOT be the default null -- the 6th reach must map");
  assert.equal(typeof verb, 'string', 'the mapped verb must be a string');
});

// ---------------------------------------------------------------------------
// Behavior 2: the returned verb is a member of CANONICAL_VERBS (no new verb).
// ---------------------------------------------------------------------------
check("reachIdToSkillFamily('hats') is a member of CANONICAL_VERBS", () => {
  const verb = engine.reachIdToSkillFamily('hats');
  assert.ok(CANONICAL_VERBS.has(verb),
    "the hats verb must be an EXISTING CANONICAL_VERBS member (no new verb minted); got " + verb);
});

// ---------------------------------------------------------------------------
// Behavior 3: a top sensor reach of reach_id 'hats' resolves to a non-null
// fireSkill in resolveFireSkill (so routing_source can flip to engine).
// ---------------------------------------------------------------------------
check("resolveFireSkill resolves a non-null fireSkill for a fired hats reach", () => {
  assert.equal(typeof engine.resolveFireSkill, 'function',
    'resolveFireSkill must be exported for the engine-flip contract test');
  // No Brain, zero weight, tier_0 -- proves the sensor branch fires in ANY tier,
  // NOT gated on mode_a (resolveFireSkill step 2). The top reach is hats.
  const fireSkill = engine.resolveFireSkill(null, 0.0, 'tier_0', [{ reach_id: 'hats' }]);
  assert.ok(fireSkill !== null && fireSkill !== undefined,
    'a fired hats reach must resolve to a non-null fireSkill so routing_source flips legacy->engine');
});

// ---------------------------------------------------------------------------
// Behavior 4: the five pre-existing cases are unchanged.
// ---------------------------------------------------------------------------
check('the five pre-existing reach cases are behaviorally unchanged', () => {
  assert.equal(engine.reachIdToSkillFamily('context_block'), 'Run Methodology');
  assert.equal(engine.reachIdToSkillFamily('contradiction'), "Devil's Advocate");
  assert.equal(engine.reachIdToSkillFamily('cross_room'), 'Navigate Graph');
  assert.equal(engine.reachIdToSkillFamily('brain_consult'), 'Run Methodology');
  assert.equal(engine.reachIdToSkillFamily('deep_research'), 'Spawn Sub-Agent');
});

// A non-member key still returns null (the engine never invents a reach).
check('a non-member reach_id still returns the default null', () => {
  assert.equal(engine.reachIdToSkillFamily('not-a-real-reach'), null);
});

console.log('');
console.log('PASS test-172-hats-reach-case.cjs (' + passed + ' assertions)');
process.exit(0);
