#!/usr/bin/env node
'use strict';
/*
 * tests/test-347-reviewer-honesty.cjs -- Phase 347 Plan 10 Task 3 (SHARED-10).
 *
 * THE ONE QUESTION THIS TEST ANSWERS: on the live MCP path, does a step
 * requesting an independent reviewer get an HONEST directive (verdict null,
 * requires_host_dispatch true) rather than a fabricated verdict -- and does
 * the module say so plainly in its own header rather than leaving the
 * three-surface gap for a reader to discover by testing?
 *
 * Behaviors 1-6 per 347-10-PLAN.md's own <behavior> block:
 *   1. reviewer.kind:'subagent' returns a review object naming
 *      requires_host_dispatch:true, a dispatch block naming agent
 *      chain-step-reviewer, and the run id and step index; verdict is null.
 *   2. the step's OWN quality is unaffected by the review request (tier 1
 *      stays high on success, tier 2 stays null).
 *   3. review.verdict is NEVER high and NEVER low on this path (red-proof
 *      discipline mirroring tests/test-237-dispatcher-tiers.cjs's own
 *      mutation-proof leg for the worker half).
 *   4. reviewer.kind:'navigator' returns NO review object at all (the
 *      navigator reviews at the gate; this module never duplicates it).
 *   5. no reviewer declared: chain_output is byte-identical to the
 *      pre-347-10 shape, both tiers.
 *   6. source scan: the module header carries the three-surface table with
 *      an explicit not-dispatchable entry for Claude Desktop and Cowork.
 *
 * Fixture: tests/helpers/fixture-room-347.cjs (wide variant) -- a real
 * room.db is required for dispatchStep to proceed past its Tier-0 cold-start
 * degrade; no chain_state records need seeding for this suite (no
 * predecessor-record assertions here -- that is 347-05's own test file).
 *
 * Plain node:assert CJS script. Hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const DISPATCHER_PATH = path.join(REPO_ROOT, 'lib', 'core', 'chain-step-dispatcher.cjs');
const dispatcher = require(DISPATCHER_PATH);
const { buildChainFixtureRoom, closeChainFixtureRoom } =
  require(path.join(REPO_ROOT, 'tests', 'helpers', 'fixture-room-347.cjs'));

let pass = 0;
const CHECKS = [];
function check(label, fn) {
  CHECKS.push({ label: label, fn: fn });
}

console.log('test-347-reviewer-honesty');

function mkRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 't34710-honesty-'));
  const fixture = buildChainFixtureRoom(tmp, 'wide');
  fixture.db.close(); // dispatchStep opens its own fresh handle
  return { roomDir: fixture.roomDir, tmp: tmp };
}

function cleanup(room) {
  closeChainFixtureRoom({ roomDir: room.roomDir });
}

// ---------------------------------------------------------------------------
// Test 1 + 3: reviewer.kind:'subagent' on a TIER-1 (executable) step returns
// the honest review directive; verdict is null, never high/low.
// ---------------------------------------------------------------------------
check('Test 1+3: reviewer.kind subagent (tier 1) returns the honest directive, verdict always null', async () => {
  const room = mkRoom();
  try {
    const step = {
      step: 1,
      command: '/mos:snapshot',
      framework: null,
      reviewer: { kind: 'subagent', agent: 'chain-step-reviewer' },
    };
    const outcome = await dispatcher.dispatchStep(step, null, { roomDir: room.roomDir, runId: 'run-honesty-1' });

    assert.ok(outcome.chain_output, 'chain_output is returned');
    assert.equal(outcome.chain_output.tier, dispatcher.TIER_EXECUTABLE, 'tier 1 dispatch still runs');
    assert.ok(outcome.chain_output.review, 'a review object is attached');
    assert.equal(outcome.chain_output.review.requires_host_dispatch, true, 'requires_host_dispatch is true');
    assert.equal(outcome.chain_output.review.dispatch.agent, 'chain-step-reviewer', 'dispatch names chain-step-reviewer');
    assert.equal(outcome.chain_output.review.dispatch.run_id, 'run-honesty-1', 'dispatch carries the run id');
    assert.equal(outcome.chain_output.review.dispatch.step_index, 0, 'dispatch carries the 0-indexed step_index');
    assert.equal(outcome.chain_output.review.dispatch.room_path, room.roomDir, 'dispatch carries the room path');
    assert.equal(outcome.chain_output.review.verdict, null, 'verdict is explicitly null -- never fabricated');
    // Test 3's own red-proof assertion: strictly null, not merely falsy.
    assert.notEqual(outcome.chain_output.review.verdict, 'high', 'verdict is never high');
    assert.notEqual(outcome.chain_output.review.verdict, 'low', 'verdict is never low');
  } finally {
    cleanup(room);
  }
});

// ---------------------------------------------------------------------------
// Test 2: the step's OWN quality is unaffected by the review request.
// ---------------------------------------------------------------------------
check('Test 2: the step own quality (tier 1 high, tier 2 null) is unaffected by a review request', async () => {
  const room = mkRoom();
  try {
    const tier1Step = {
      step: 1,
      command: '/mos:snapshot',
      framework: null,
      reviewer: { kind: 'subagent', agent: 'chain-step-reviewer' },
    };
    const tier1Outcome = await dispatcher.dispatchStep(tier1Step, null, { roomDir: room.roomDir, runId: 'run-honesty-2a' });
    assert.equal(tier1Outcome.quality, 'high', 'tier 1 quality stays high with a review request present');

    const tier2Step = {
      step: 1,
      command: '/mos:analyze-needs',
      framework: 'Jobs to Be Done (JTBD)',
      reviewer: { kind: 'subagent', agent: 'chain-step-reviewer' },
    };
    const tier2Outcome = await dispatcher.dispatchStep(tier2Step, null, { roomDir: room.roomDir, runId: 'run-honesty-2b' });
    assert.equal(tier2Outcome.quality, null, 'tier 2 quality stays null with a review request present');
    assert.ok(tier2Outcome.chain_output.review, 'tier 2 also carries the review directive');
    assert.equal(tier2Outcome.chain_output.review.verdict, null, 'tier 2 review verdict is also null');
  } finally {
    cleanup(room);
  }
});

// ---------------------------------------------------------------------------
// Test 4: reviewer.kind:'navigator' attaches nothing -- the gate already
// reviews it; this module never duplicates that ladder.
// ---------------------------------------------------------------------------
check('Test 4: reviewer.kind navigator returns no review object -- the navigator reviews at the gate', async () => {
  const room = mkRoom();
  try {
    const step = {
      step: 1,
      command: '/mos:snapshot',
      framework: null,
      reviewer: { kind: 'navigator' },
    };
    const outcome = await dispatcher.dispatchStep(step, null, { roomDir: room.roomDir, runId: 'run-honesty-4' });
    assert.equal(outcome.chain_output.review, undefined, 'no review key at all is attached for a navigator-kind reviewer');
  } finally {
    cleanup(room);
  }
});

// ---------------------------------------------------------------------------
// Test 5: no reviewer declared -- chain_output is byte-identical to the
// pre-347-10 shape, both tiers.
// ---------------------------------------------------------------------------
check('Test 5: no reviewer declared -- chain_output stays byte-identical on both tiers', async () => {
  const room = mkRoom();
  try {
    const tier1Step = { step: 1, command: '/mos:snapshot', framework: null };
    const tier1Outcome = await dispatcher.dispatchStep(tier1Step, null, { roomDir: room.roomDir, runId: 'run-honesty-5a' });
    assert.equal(tier1Outcome.chain_output.review, undefined, 'tier 1: no review key when no reviewer declared');
    const tier1Keys = Object.keys(tier1Outcome.chain_output).sort();
    assert.deepEqual(
      tier1Keys,
      ['artifact', 'command', 'executed', 'exit_code', 'shared_state', 'shared_state_reason', 'tier', 'timed_out'].sort(),
      'tier 1: exactly the pre-347-10 (+347-05 shared_state) key set, no review key: ' + JSON.stringify(tier1Keys)
    );

    const tier2Step = { step: 1, command: '/mos:analyze-needs', framework: 'Jobs to Be Done (JTBD)' };
    const tier2Outcome = await dispatcher.dispatchStep(tier2Step, null, {
      roomDir: room.roomDir, runId: 'run-honesty-5b', targetSection: 'market-analysis',
    });
    assert.equal(tier2Outcome.chain_output.review, undefined, 'tier 2: no review key when no reviewer declared');
    const tier2Keys = Object.keys(tier2Outcome.chain_output).sort();
    assert.deepEqual(
      tier2Keys,
      ['command', 'dispatch', 'executed', 'requires_host_dispatch', 'shared_state', 'shared_state_reason', 'tier'].sort(),
      'tier 2: exactly the pre-347-10 (+347-05 shared_state) key set, no review key: ' + JSON.stringify(tier2Keys)
    );
  } finally {
    cleanup(room);
  }
});

// ---------------------------------------------------------------------------
// Test 6: source scan -- the module header carries the three-surface table
// with an explicit not-dispatchable entry for Claude Desktop and Cowork.
// ---------------------------------------------------------------------------
check('Test 6: the module header states the three-surface table (source scan, not runtime behavior)', () => {
  const src = fs.readFileSync(DISPATCHER_PATH, 'utf8');
  assert.match(src, /THE REVIEWER RULE/, 'header names THE REVIEWER RULE section');
  assert.match(src, /Claude Code CLI/, 'header names Claude Code CLI');
  assert.match(src, /Claude Desktop/, 'header names Claude Desktop');
  assert.match(src, /Cowork/, 'header names Cowork');
  assert.match(src, /NOT dispatchable/i, 'header states the not-dispatchable fact explicitly, not implicitly');
  // The stated fact must appear ASSOCIATED with Desktop/Cowork's reviewer
  // row, not just anywhere in the file -- a loose grep would pass even if
  // the table were deleted and the phrase moved elsewhere by accident.
  const headerBlockMatch = src.match(/THE REVIEWER RULE[\s\S]*?Consequence:[\s\S]*?\n \*\//);
  assert.ok(headerBlockMatch, 'the reviewer-rule header block is contiguous and locatable');
  const block = headerBlockMatch[0];
  assert.match(block, /Claude Desktop[\s\S]*NOT dispatchable/, 'Desktop row states not-dispatchable within the same block');
  assert.match(block, /Cowork[\s\S]*NOT dispatchable/, 'Cowork row states not-dispatchable within the same block');
});

// Run every registered check, awaiting async ones so failures fail the
// suite deterministically (no swallowed rejection).
(async function main() {
  for (const c of CHECKS) {
    try {
      await c.fn();
      pass += 1;
      console.log('  ok -', c.label);
    } catch (err) {
      console.error('  FAIL -', c.label);
      console.error('       ', err && err.message ? err.message : err);
      process.exit(1);
    }
  }
  console.log('\n  ' + pass + '/' + CHECKS.length + ' checks passed');
  if (pass !== CHECKS.length) process.exit(1);
})();
