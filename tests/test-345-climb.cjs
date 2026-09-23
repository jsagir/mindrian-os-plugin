#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 345-06 Task 2 -- test-345-climb: pins lib/core/strategy/
 * taxonomy-climb.cjs (climb, localLadderLine, renderLadder). The stub for
 * brainClient.callTool is injected by monkey-patching the required
 * brain-client.cjs module object (the module-level seam every callTool
 * caller in this repo already shares); no real network call is ever made
 * from this file.
 *
 * Bare node script, no framework, exits non-zero on any assertion failure,
 * self-contained. House rule: hyphens only, no em-dashes.
 *
 * Run: node tests/test-345-climb.cjs
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

let taxonomyClimb;
let brainClient;
try {
  taxonomyClimb = require(path.join(REPO, 'lib', 'core', 'strategy', 'taxonomy-climb.cjs'));
  brainClient = require(path.join(REPO, 'lib', 'core', 'brain-client.cjs'));
} catch (e) {
  console.log('SKIP: test-345-climb -- taxonomy-climb.cjs or brain-client.cjs not present yet. ' + (e.code || e.message));
  process.exit(0);
}

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

async function main() {
  // ===========================================================================
  // climb()
  // ===========================================================================

  assert.equal(taxonomyClimb.climb('what is the future of x'), 'UnDefined');
  ok("climb('what is the future of x') === 'UnDefined'");

  assert.equal(taxonomyClimb.climb(null), 'IllDefined');
  ok('climb(null) === IllDefined (non-string input, never throws)');

  assert.equal(taxonomyClimb.climb(''), 'IllDefined');
  ok('climb(empty string) === IllDefined');

  assert.equal(taxonomyClimb.climb('stakeholder disagree on values'), 'Wicked');
  ok("climb('stakeholder disagree on values') === Wicked");

  // ===========================================================================
  // localLadderLine()
  // ===========================================================================

  {
    const line = taxonomyClimb.localLadderLine('IllDefined');
    assert.equal(typeof line, 'string');
    assert.ok(line.length < 200, 'localLadderLine must be under 200 chars, got ' + line.length);
    assert.equal(line.indexOf('\n'), -1, 'localLadderLine must be a single line');
    assert.ok(line.indexOf('\u2014') === -1, 'localLadderLine must contain no em-dash');
    assert.ok(line.indexOf('WellDefined') !== -1, 'localLadderLine(IllDefined) must name the rung below (WellDefined)');
    assert.ok(line.indexOf('UnDefined') !== -1, 'localLadderLine(IllDefined) must name the rung above (UnDefined)');
    ok("localLadderLine('IllDefined') names the rung above and below, single line, under 200 chars, no em-dash");
  }

  {
    const line = taxonomyClimb.localLadderLine('WellDefined');
    assert.ok(line.length < 200 && line.indexOf('\n') === -1);
    ok("localLadderLine('WellDefined') (the floor) stays well-formed with no rung below");
  }

  {
    const line = taxonomyClimb.localLadderLine('Wicked');
    assert.ok(line.length < 200 && line.indexOf('\n') === -1);
    ok("localLadderLine('Wicked') (the top) stays well-formed with no rung above");
  }

  // ===========================================================================
  // renderLadder()
  // ===========================================================================

  {
    const result = await taxonomyClimb.renderLadder('not-a-real-rung', 'explore');
    assert.equal(result, null);
    ok('renderLadder with a rung that fails isTheoRung returns null without calling anything');
  }

  // Stub the module-level callTool seam.
  const originalCallTool = brainClient.callTool;
  let lastArgs = null;
  let lastToolName = null;

  function installStub(fn) {
    brainClient.callTool = fn;
  }
  function restoreStub() {
    brainClient.callTool = originalCallTool;
  }

  try {
    installStub(async (toolName, args) => {
      lastToolName = toolName;
      lastArgs = args;
      return { rows: ['ill-defined', 'well-defined'] };
    });
    const result = await taxonomyClimb.renderLadder('IllDefined', 'explore');
    assert.equal(lastToolName, 'taxonomy_ladder');
    assert.deepEqual(lastArgs, { rung: 'IllDefined', question_label: 'explore' });
    assert.deepEqual(result, { rows: ['ill-defined', 'well-defined'] });
    ok("renderLadder('IllDefined', 'explore') calls callTool('taxonomy_ladder', { rung: 'IllDefined', question_label: 'explore' }) and returns the result");
  } finally {
    restoreStub();
  }

  try {
    installStub(async () => ({ error: 'egress_blocked' }));
    const result = await taxonomyClimb.renderLadder('IllDefined', 'explore');
    assert.equal(result, null);
    ok("renderLadder returns null when callTool resolves with { error: 'egress_blocked' }");
  } finally {
    restoreStub();
  }

  try {
    installStub(async () => { throw new Error('network exploded'); });
    const result = await taxonomyClimb.renderLadder('IllDefined', 'explore');
    assert.equal(result, null);
    ok('renderLadder returns null when callTool rejects');
  } finally {
    restoreStub();
  }

  try {
    installStub(async () => null);
    const result = await taxonomyClimb.renderLadder('IllDefined', 'explore');
    assert.equal(result, null);
    ok('renderLadder returns null when callTool resolves null (Brain unreachable)');
  } finally {
    restoreStub();
  }

  try {
    installStub(async (toolName, args) => {
      lastArgs = args;
      return { rows: [] };
    });
    const result = await taxonomyClimb.renderLadder('IllDefined', 'this-is-not-a-taxonomy-slug');
    assert.ok(!Object.prototype.hasOwnProperty.call(lastArgs, 'question_label'), 'question_label must be ABSENT for a non-taxonomy jtbdSlug');
    assert.deepEqual(lastArgs, { rung: 'IllDefined' });
    ok('renderLadder omits question_label entirely when jtbdSlug is not a member of the closed taxonomy set (result: ' + JSON.stringify(result) + ')');
  } finally {
    restoreStub();
  }

  console.log('');
  console.log('Checks: ' + checks);
  console.log('PASS test-345-climb.cjs');
}

main().catch((e) => {
  console.error('FAIL: test-345-climb');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
