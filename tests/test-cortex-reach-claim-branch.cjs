'use strict';
// Phase 150.8-04 Task 1 (DIKW-09) -- cortex-reach-adapter claim branch.
//
// Asserts the additive claim branch in lib/hmi/cortex-reach-adapter.cjs:
//   1. A fresh typed claim (knowledge_type enum present) lifts a reach score.
//   2. A single claim_present signal stays BELOW the 0.70 recommend floor solo
//      (the :70-73 doctrine -- a cold cortex never solo-crosses the gate).
//   3. The adapter reads ONLY the knowledge_type ENUM (presence + enum membership)
//      -- an off-enum value (or prose smuggled into the field) is IGNORED, so a
//      poisoned knowledge_type cannot influence reach scores (threat T-150.8-14,
//      Canon Part 8).
//   4. 'claim' is present in CORTEX_NODE_TYPES in BOTH the adapter and
//      room-context.cjs (the two lists mirror each other in lockstep).
//
// Frozen 148 constants are asserted UNCHANGED in test-post-filing-selector.cjs;
// this driver does not import the orchestrator (the adapter must never do so).
//
// NO em-dashes (CLAUDE.md HARD RULE). node:sqlite not required (the adapter is a
// pure synchronous function over plain node objects).

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const adapter = require(path.join(REPO_ROOT, 'lib', 'hmi', 'cortex-reach-adapter.cjs'));
const roomContext = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'room-context.cjs'));

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

console.log('test-cortex-reach-claim-branch');

// (1) A fresh typed claim lifts a reach score above 0 (the dial responds).
check('a fresh typed claim (knowledge_type enum) lifts a reach score', () => {
  const scores = adapter.buildReachScoresFromCortex([
    { type: 'claim', properties: { knowledge_type: 'fact' } },
  ]);
  const lifted = Object.keys(scores).filter((k) => scores[k] > 0);
  assert.ok(lifted.length >= 1, 'at least one reach must be lifted by a typed claim');
});

// (2) A single claim_present signal stays BELOW the 0.70 recommend floor solo.
check('a single claim signal stays BELOW the 0.70 recommend floor (doctrine)', () => {
  const scores = adapter.buildReachScoresFromCortex([
    { type: 'claim', properties: { knowledge_type: 'causal' } },
  ]);
  for (const k of Object.keys(scores)) {
    assert.ok(scores[k] < 0.70,
      'reach ' + k + ' = ' + scores[k] + ' must stay below the 0.70 recommend floor solo');
  }
  // The weight is the 0.10-class claim_present contribution.
  assert.equal(adapter.CONTRIBUTIONS.claim_present, 0.10,
    'claim_present must be the 0.10-class weight');
});

// (3) The adapter reads ONLY the knowledge_type ENUM -- off-enum / prose ignored.
check('an off-enum knowledge_type does NOT lift any reach (enum-only read, Part 8)', () => {
  const scores = adapter.buildReachScoresFromCortex([
    { type: 'claim', properties: { knowledge_type: 'totally not a member' } },
  ]);
  const lifted = Object.keys(scores).filter((k) => scores[k] > 0);
  assert.equal(lifted.length, 0, 'an off-enum knowledge_type must lift nothing');
});

check('a claim carrying PROSE (no enum) lifts nothing (the adapter never reads prose)', () => {
  // Smuggle prose into adjacent fields; the adapter reads knowledge_type only.
  const scores = adapter.buildReachScoresFromCortex([
    {
      type: 'claim',
      properties: {
        conditions: 'Lawrence said the TAM is 190M dollars in the Tuesday meeting',
        text: 'PROPRIETARY-SENTINEL-9931 competitor ACME',
      },
    },
  ]);
  const lifted = Object.keys(scores).filter((k) => scores[k] > 0);
  assert.equal(lifted.length, 0, 'a claim with no valid knowledge_type enum must lift nothing');
});

// (4) 'claim' is in CORTEX_NODE_TYPES in BOTH the adapter and room-context.cjs.
check("'claim' is in CORTEX_NODE_TYPES in BOTH the adapter and room-context.cjs (mirror)", () => {
  assert.ok(Array.isArray(adapter.CORTEX_NODE_TYPES), 'adapter exports CORTEX_NODE_TYPES');
  assert.ok(adapter.CORTEX_NODE_TYPES.indexOf('claim') !== -1,
    "adapter CORTEX_NODE_TYPES must include 'claim'");
  assert.ok(Array.isArray(roomContext.CORTEX_NODE_TYPES), 'room-context exports CORTEX_NODE_TYPES');
  assert.ok(roomContext.CORTEX_NODE_TYPES.indexOf('claim') !== -1,
    "room-context CORTEX_NODE_TYPES must include 'claim'");
  // The mirror is exact: both lists carry the same members.
  const a = adapter.CORTEX_NODE_TYPES.slice().sort();
  const b = roomContext.CORTEX_NODE_TYPES.slice().sort();
  assert.deepEqual(a, b, 'adapter and room-context CORTEX_NODE_TYPES must mirror each other');
});

// Sanity: the prior cortex signals (governing_thought / persona / etc.) still work
// -- the claim branch is purely additive.
check('prior cortex signals still lift their reaches (additive, no regression)', () => {
  const scores = adapter.buildReachScoresFromCortex([
    { type: 'governing_thought', properties: { freshness: 'fresh' } },
    { type: 'navigator_persona', properties: {} },
  ]);
  assert.ok(scores.context_block > 0, 'fresh governing_thought still lifts context_block');
  assert.ok(scores.hats > 0, 'persona still lifts hats');
});

console.log(`\nPASS (${pass}/6)`);
