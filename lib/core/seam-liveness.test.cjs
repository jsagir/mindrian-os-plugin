'use strict';
/*
 * seam-liveness.test.cjs -- the 10-case proof for lib/core/seam-liveness.cjs.
 *
 * Phase 235-02 Task 1. Three named dead-seam shapes, each paired with a live
 * control, plus the generic core and the malformed-input degrade case:
 *
 *   1  assertSeamLive: a partially-live seam reports the dead claims
 *   2  assertSeamLive: a fully-live seam reports ok
 *   3  DEAD  hook matcher naming a tool that no longer exists
 *   4  LIVE  control for 3
 *   5  DEAD  an enqueue with no registered consumer
 *   6  LIVE  control for 5
 *   7  DEAD  a minted gate type with no reachable ratifier
 *   8  LIVE  control for 7
 *   9  DEAD  a claimed module that loaded but exports nothing usable
 *   10 malformed input degrades safely (zero claims is vacuously live, no throw)
 *
 * Harness shape: the assert(cond, label) / failures counter / process.exit
 * pattern already used across tests/ (tests/test-connector-tripwire.cjs), not a
 * test-runner framework.
 *
 * House rule: hyphens only, no em-dashes. Pure-local, zero Brain/network.
 */

const path = require('node:path');

const MODULE_PATH = path.join(__dirname, 'seam-liveness.cjs');
const seam = require(MODULE_PATH);
const {
  assertSeamLive,
  checkHookMatcherLiveness,
  checkEnqueueConsumerLiveness,
  checkMintRatifierLiveness,
  checkClaimedModuleLiveness,
} = seam;

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log('  ok  ' + label);
  } else {
    console.error('  FAIL  ' + label);
    failures += 1;
  }
}

function sameList(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((v, i) => v === expected[i])
  );
}

// ---------------------------------------------------------------------------
// 1: the generic core reports the dead half of a partially-live seam.
// ---------------------------------------------------------------------------
{
  const r = assertSeamLive({
    name: 'test-partial',
    claims: ['a', 'b'],
    isLive: (c) => c === 'a',
  });
  assert(
    r.ok === false && sameList(r.dead, ['b']) && r.claimedCount === 2 && r.liveCount === 1,
    '1: assertSeamLive flags the one dead claim of two (ok:false, dead:[b], 2 claimed, 1 live)'
  );
}

// ---------------------------------------------------------------------------
// 2: a fully-live seam is ok.
// ---------------------------------------------------------------------------
{
  const r = assertSeamLive({
    name: 'test-live',
    claims: ['a'],
    isLive: (c) => c === 'a',
  });
  assert(
    r.ok === true && sameList(r.dead, []) && r.claimedCount === 1 && r.liveCount === 1,
    '2: assertSeamLive passes a fully-live seam (ok:true, dead:[], 1 claimed, 1 live)'
  );
}

// ---------------------------------------------------------------------------
// 3 + 4: dead-seam shape #1 -- a hook matcher naming a tool that is gone.
// ---------------------------------------------------------------------------
{
  const r = checkHookMatcherLiveness(
    ['Bash', 'mcp__ghost_server__ghost_tool'],
    new Set(['Bash', 'Read'])
  );
  assert(
    r.ok === false && r.dead.indexOf('mcp__ghost_server__ghost_tool') !== -1,
    '3: checkHookMatcherLiveness flags a matcher naming a tool that no longer exists'
  );
}
{
  const r = checkHookMatcherLiveness(['Bash'], new Set(['Bash', 'Read']));
  assert(r.ok === true, '4: checkHookMatcherLiveness passes a matcher naming a live tool');
}

// ---------------------------------------------------------------------------
// 5 + 6: dead-seam shape #2 -- an enqueue with no registered consumer.
// ---------------------------------------------------------------------------
{
  const r = checkEnqueueConsumerLiveness(['graph-edge-pending'], []);
  assert(
    r.ok === false && sameList(r.dead, ['graph-edge-pending']),
    '5: checkEnqueueConsumerLiveness flags an enqueue with no registered consumer'
  );
}
{
  const r = checkEnqueueConsumerLiveness(['graph-edge-pending'], ['graph-edge-pending']);
  assert(r.ok === true, '6: checkEnqueueConsumerLiveness passes an enqueue with a live consumer');
}

// ---------------------------------------------------------------------------
// 7 + 8: dead-seam shape #3 -- a minted gate with no reachable ratifier.
// ---------------------------------------------------------------------------
{
  const r = checkMintRatifierLiveness(['halt_gate'], []);
  assert(
    r.ok === false && sameList(r.dead, ['halt_gate']),
    '7: checkMintRatifierLiveness flags a minted gate type with no reachable ratifier'
  );
}
{
  const r = checkMintRatifierLiveness(['halt_gate'], ['halt_gate', 'material_gate']);
  assert(r.ok === true, '8: checkMintRatifierLiveness passes a minted gate with a live ratifier');
}

// ---------------------------------------------------------------------------
// 9: the fourth wrapper -- a claimed module the caller already probed.
// ---------------------------------------------------------------------------
{
  const r = checkClaimedModuleLiveness([
    { id: 'a.cjs', live: true },
    { id: 'b.cjs', live: false, reason: 'exports.connectors is empty' },
  ]);
  assert(
    r.ok === false && sameList(r.dead, ['b.cjs']),
    '9: checkClaimedModuleLiveness flags the module whose claimed export is missing or empty'
  );
}

// ---------------------------------------------------------------------------
// 10: malformed input degrades safely. Zero claims is vacuously live: a seam
// with nothing claimed cannot be dead. It must NOT throw.
// ---------------------------------------------------------------------------
{
  let threw = false;
  let r = null;
  try {
    r = assertSeamLive({});
  } catch (_e) {
    threw = true;
  }
  assert(
    !threw &&
      r &&
      r.ok === true &&
      sameList(r.dead, []) &&
      r.claimedCount === 0 &&
      r.liveCount === 0,
    '10: assertSeamLive({}) degrades safely to a vacuously-live verdict without throwing'
  );
}

console.log('');
if (failures > 0) {
  console.error('seam-liveness tests: ' + failures + ' FAILURE(S)');
} else {
  console.log('seam-liveness tests: 10 passed, 0 failed (of 10)');
}
process.exit(failures > 0 ? 1 : 0);
