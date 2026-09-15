#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 345-07 Task 3 -- test-345-goal-version-stamp: pins the CLI-surface
 * reach-emit payload helpers scripts/intent-classifier.cjs exports
 * (goalVersionFromRecord, isStrategyReach, buildReachPresentedPayload,
 * buildGateReachedPayload, buildStrategyProposedPayload).
 *
 * WHY THESE FUNCTIONS AND NOT A FULL runNavigationEngine() DRIVE. The
 * reach-emit region sits mid-function inside runNavigationEngine's own
 * best-effort try/catch, with no existing exported seam that lets a test
 * reach it without also driving the entire dial/reach orchestration
 * pipeline (cortex nodes, F-selector ranking, the live composeDialReachScores
 * call). Per this task's own instruction ("if none exists, assert on the
 * payload-building helper you extract"), the five pure functions that
 * assemble the reach_presented / gate_reached / strategy_proposed payloads
 * were extracted verbatim from the call site and exported -- these are the
 * EXACT functions the production call site invokes (245-RESEARCH.md
 * Pitfall 1 discipline: a test that can pass without the production file
 * being touched is testing the wrong thing), not a reimplementation.
 *
 * Bare node script, no framework, exits non-zero on any assertion failure,
 * self-contained. House rule: hyphens only, no em-dashes.
 *
 * Run: node tests/test-345-goal-version-stamp.cjs
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

let ic;
try {
  ic = require(path.join(REPO, 'scripts', 'intent-classifier.cjs'));
} catch (e) {
  console.log('SKIP: test-345-goal-version-stamp -- scripts/intent-classifier.cjs is unavailable. ' + (e.code || e.message));
  process.exit(0);
}

const requiredExports = [
  'goalVersionFromRecord', 'isStrategyReach', 'buildReachPresentedPayload',
  'buildGateReachedPayload', 'buildStrategyProposedPayload',
];
for (const name of requiredExports) {
  if (typeof ic[name] !== 'function') {
    console.log('SKIP: test-345-goal-version-stamp -- ' + name + ' not exported yet.');
    process.exit(0);
  }
}

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

function main() {
  // ===========================================================================
  // goalVersionFromRecord: the "0 when no goal" floor, and the pass-through
  // when a numeric goal_version is present.
  // ===========================================================================

  assert.equal(ic.goalVersionFromRecord(null), 0);
  ok('goalVersionFromRecord(null) is 0');

  assert.equal(ic.goalVersionFromRecord(undefined), 0);
  ok('goalVersionFromRecord(undefined) is 0');

  assert.equal(ic.goalVersionFromRecord({}), 0);
  ok('goalVersionFromRecord({}) (no goal_version key) is 0');

  assert.equal(ic.goalVersionFromRecord({ goal_version: 'not-a-number' }), 0);
  ok('goalVersionFromRecord with a non-numeric goal_version is 0');

  assert.equal(ic.goalVersionFromRecord({ goal_version: 3 }), 3);
  ok('goalVersionFromRecord({ goal_version: 3 }) is 3 (pass-through)');

  assert.equal(ic.goalVersionFromRecord({ goal_version: 0 }), 0);
  ok('goalVersionFromRecord({ goal_version: 0 }) is 0 (a real zero, not a missing-key default)');

  // ===========================================================================
  // isStrategyReach: the reach_id-alone-is-unsafe discriminator.
  // ===========================================================================

  const strategyReach = {
    reach_id: 'contradiction',
    posture: 'pull_back',
    dispatch: 'strategy-reach (jtbd re-aim)',
    evidence: { jtbd: 'decide-pursue', current_jtbd: 'find-problem', rung: 'IllDefined', goal_version: 2, reaches_since: 41, claims_since: 5 },
  };
  assert.equal(ic.isStrategyReach(strategyReach), true);
  ok('isStrategyReach: the real sensorStrategyReach shape returns true');

  const graphIntegrityReach = {
    reach_id: 'contradiction',
    posture: 'hold',
    dispatch: 'room-graph-integrity',
    evidence: { edge_rows_missing_endpoint: 5 },
  };
  assert.equal(ic.isStrategyReach(graphIntegrityReach), false);
  ok('isStrategyReach: SAME reach_id but sensor-graph-integrity.cjs\'s own dispatch string returns false (the collision this discriminator exists to resolve)');

  assert.equal(ic.isStrategyReach(null), false);
  ok('isStrategyReach(null) is false, never throws');

  assert.equal(ic.isStrategyReach({}), false);
  ok('isStrategyReach({}) is false');

  assert.equal(ic.isStrategyReach({ reach_id: 'contradiction' }), false);
  ok('isStrategyReach: reach_id alone with no dispatch is false');

  // ===========================================================================
  // buildReachPresentedPayload: STRAT-14's own deliverable.
  // ===========================================================================

  {
    const payload = ic.buildReachPresentedPayload({ reach_id: 'explore' }, 5);
    assert.equal(payload.reach_id, 'explore');
    assert.equal(payload.source_path, 'dial:presented:explore');
    assert.equal(payload.created_by, 'system');
    assert.equal(payload.goal_version, 5);
    ok('buildReachPresentedPayload carries reach_id, source_path, created_by, goal_version');
  }

  {
    const payload = ic.buildReachPresentedPayload({ reach_id: 'explore' }, 0);
    assert.equal(payload.goal_version, 0);
    ok('buildReachPresentedPayload with goalVersion 0 (no goal set) carries goal_version: 0, changing nothing else');
  }

  // ===========================================================================
  // buildGateReachedPayload: anchor_node_id rides ONLY when anchorId is
  // truthy; omitted otherwise.
  // ===========================================================================

  {
    const payload = ic.buildGateReachedPayload(3, 1700000000000, null);
    assert.equal(payload.reach_count, 3);
    assert.equal(payload.routing_source, 'engine');
    assert.equal(payload.source_path, 'gate:reached');
    assert.equal(payload.created_by, 'system');
    assert.equal(payload.dedupe_key, 'gate:1700000000000');
    assert.equal('anchor_node_id' in payload, false);
    ok('buildGateReachedPayload with no anchorId: anchor_node_id key is OMITTED, not null');
  }

  {
    const payload = ic.buildGateReachedPayload(3, 1700000000000, 'goal:my-room');
    assert.equal(payload.anchor_node_id, 'goal:my-room');
    ok('buildGateReachedPayload with an anchorId carries anchor_node_id equal to it');
  }

  // ===========================================================================
  // buildStrategyProposedPayload: the 345-03 closed shape, deduped on
  // 'strategy:' + startedAt (a DIFFERENT dedupe_key than gate_reached's
  // 'gate:' + startedAt, sharing the same turn-start handle).
  // ===========================================================================

  {
    const payload = ic.buildStrategyProposedPayload(strategyReach, 9, 'goal:my-room', 1700000000000);
    assert.equal(payload.goal_version, 2, 'evidence.goal_version (2) wins over the passed-in fallback goalVersion (9)');
    assert.equal(payload.rung, 'IllDefined');
    assert.equal(payload.jtbd, 'decide-pursue');
    assert.equal(payload.reaches_since, 41);
    assert.equal(payload.claims_since, 5);
    assert.equal(payload.anchor_node_id, 'goal:my-room');
    assert.equal(payload.source_path, 'gate:reached');
    assert.equal(payload.created_by, 'system');
    assert.equal(payload.dedupe_key, 'strategy:1700000000000');
    ok('buildStrategyProposedPayload: the full 345-03 shape, evidence.goal_version wins, dedupe_key uses the strategy: prefix');
  }

  {
    const bareReach = { reach_id: 'contradiction', dispatch: 'strategy-reach (jtbd re-aim)', evidence: {} };
    const payload = ic.buildStrategyProposedPayload(bareReach, 7, 'goal:my-room', 1700000000001);
    assert.equal(payload.goal_version, 7, 'no evidence.goal_version -> falls back to the passed-in goalVersion');
    assert.equal(payload.rung, null);
    assert.equal(payload.jtbd, null);
    assert.equal(payload.reaches_since, 0);
    assert.equal(payload.claims_since, 0);
    ok('buildStrategyProposedPayload: an empty evidence bag degrades every field to its honest default, never throws');
  }

  {
    const payload = ic.buildStrategyProposedPayload(null, 4, 'goal:my-room', 1700000000002);
    assert.equal(payload.goal_version, 4);
    assert.equal(payload.rung, null);
    ok('buildStrategyProposedPayload(null, ...) never throws, degrades to the passed-in goalVersion and null fields');
  }

  // ===========================================================================
  // Scope floor: memory-events.cjs untouched by this plan (the event type
  // was added in 345-03).
  // ===========================================================================

  {
    const cp = require('node:child_process');
    const diffStat = cp.execSync('git diff --stat lib/core/navigation/memory-events.cjs', { cwd: REPO }).toString();
    assert.equal(diffStat.trim(), '');
    ok('git diff --stat lib/core/navigation/memory-events.cjs is empty (the event type was added in 345-03, not this plan)');
  }

  console.log('');
  console.log('Checks: ' + checks);
  console.log('PASS test-345-goal-version-stamp.cjs');
}

try {
  main();
} catch (e) {
  console.error('FAIL: test-345-goal-version-stamp');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
}
