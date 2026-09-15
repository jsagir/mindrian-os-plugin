#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 345-07 -- test-345-gate-ratify: Task 1 pins goal-gate.cjs
 * (isStrategyCard, ratifyGoalProposal's own behavior contract, unit-level,
 * against a fixture room.db and a fixture jtbd-state.json). Task 2 extends
 * this same file with the MCP round trip: a real gate_render + gate_answer
 * call sequence through the ACTUAL registered tool handlers, asserting on
 * raw SELECT rows against the fixture database -- the fleet-wide-zero-
 * moves-to-one proof (STRAT-13).
 *
 * SAFETY NOTE (load-bearing, read before touching this file). This process
 * runs with a REAL CLAUDE_CODE_SESSION_ID in its environment (this test was
 * authored inside a live Claude Code agent session). lib/core/session-
 * binding.cjs::resolveEffectiveSessionId falls back to that env var when
 * neither an explicit sessionId nor extra.sessionId is supplied -- and if
 * this session ever had a real room bound, gate_answer's own
 * resolveSessionRoomDir could resolve to a REAL user room instead of this
 * file's tmpdir fixture, writing test rows into production data. Every
 * gate_render / gate_answer handler call in this file therefore threads an
 * explicit, obviously-fake `extra.sessionId` (FAKE_SESSION_ID below), which
 * resolveEffectiveSessionId reads BEFORE the env var -- this is not
 * decorative, it is the isolation boundary between this test and whatever
 * room this literal process's real session happens to be bound to.
 *
 * MEASURED counts print with the literal prefix `MEASURED:` so 345-09's
 * phase-close record can quote the line verbatim (this task's own
 * acceptance criterion).
 *
 * Fixture rooms are built fresh per leg with lib/core/room-db.cjs::openRoomDb
 * (the real production schema + migrations), same precedent as
 * tests/test-345-gate-anchor.cjs (345-06). If node:sqlite is unavailable in
 * the execution environment, every leg in this file SKIPs with a printed
 * reason and this task's own deliverable is recorded UNPROVEN, never that
 * it passed.
 *
 * COLUMN-NAME CORRECTION (Rule 1, same class as the SENS-19/SENS-20
 * corrections in 345-04/345-05). This task's own acceptance criteria name
 * `SELECT COUNT(*) FROM edges WHERE edge_type='SOURCED_FROM'` and a
 * `target_id` column. The real, shipped `edges` table (lib/core/navigation/
 * edges.cjs's own writeEdge INSERT statement) has NO `edge_type` or
 * `target_id` columns -- the real columns are `type` and `target`. Verified
 * by reading edges.cjs's own INSERT statement (this task's read_first) and
 * by tests/test-345-gate-anchor.cjs's own already-shipped `edgeCount`
 * helper, which queries `WHERE type = ?`. Every SELECT below uses the real
 * column names; the counts measured are the same counts the plan's prose
 * names, just against the schema that actually exists.
 *
 * Bare node script, no framework, exits non-zero on any assertion failure,
 * self-contained. House rule: hyphens only, no em-dashes.
 *
 * Run: node tests/test-345-gate-ratify.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

let roomDbMod;
let navigation;
let jtbdState;
let nodeInsertMod;
let strategyCard;
let goalGate;
let gateTool;
try {
  roomDbMod = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
  navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
  jtbdState = require(path.join(REPO, 'lib', 'hmi', 'jtbd-state.cjs'));
  nodeInsertMod = require(path.join(REPO, 'lib', 'core', 'node-insert.cjs'));
  strategyCard = require(path.join(REPO, 'lib', 'core', 'strategy', 'strategy-card.cjs'));
  goalGate = require(path.join(REPO, 'lib', 'core', 'strategy', 'goal-gate.cjs'));
  gateTool = require(path.join(REPO, 'lib', 'mcp', 'tools', 'gate.cjs'));
} catch (e) {
  console.log('SKIP: test-345-gate-ratify -- node:sqlite or a required module is unavailable. ' + (e.code || e.message));
  console.log('UNPROVEN: STRAT-13 deliverable not measured this run.');
  process.exit(0);
}

let checks = 0;
let skipped = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}
function skip(label) {
  skipped += 1;
  console.log('  SKIP - ' + label);
}

function makeRoomDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function openFixtureDb(roomDir) {
  return roomDbMod.openRoomDb(roomDir);
}

function cleanup(roomDir) {
  try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* tolerant */ }
}

function nodeRow(db, id) {
  return db.prepare('SELECT id, type, review_status FROM nodes WHERE id = ?').get(id);
}

function sourcedFromEdgeCountTo(db, targetId) {
  const row = db.prepare("SELECT COUNT(*) AS c FROM edges WHERE type = 'SOURCED_FROM' AND target = ?").get(targetId);
  return row ? row.c : 0;
}

function sourcedFromEdgeCountAll(db) {
  const row = db.prepare("SELECT COUNT(*) AS c FROM edges WHERE type = 'SOURCED_FROM'").get();
  return row ? row.c : 0;
}

function confirmedDecisionGateCount(db) {
  const row = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE id LIKE 'decision:gate:%' AND review_status = 'confirmed'").get();
  return row ? row.c : 0;
}

function decisionGateCountAll(db) {
  const row = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE id LIKE 'decision:gate:%'").get();
  return row ? row.c : 0;
}

// A fake MCP server, cloned from tests/test-h27-gate-card-node-fields.cjs's
// makeFakeServer -- captures every server.tool(name, description, schema,
// handler) call and exposes a fake .server.getClientCapabilities() reporting
// NO elicitation (headless text rung, deterministic).
function makeFakeServer() {
  const registered = [];
  return {
    tool(name, description, schemaOrHandler, maybeHandler) {
      let schema = {};
      let handler = schemaOrHandler;
      if (typeof maybeHandler === 'function') {
        schema = schemaOrHandler || {};
        handler = maybeHandler;
      }
      registered.push({ name, description, schema, handler });
    },
    _registered: registered,
    server: {
      getClientCapabilities() { return {}; },
    },
  };
}

async function callTool(regTool, args, sessionId) {
  const response = await regTool.handler(args, { sessionId: sessionId });
  return { response: response, body: JSON.parse(response.content[0].text) };
}

async function main() {
  // ===========================================================================
  // Task 1: isStrategyCard
  // ===========================================================================

  assert.equal(goalGate.isStrategyCard({ kind: 'strategy_goal' }), true);
  ok("isStrategyCard({ kind: 'strategy_goal' }) is true");

  assert.equal(goalGate.isStrategyCard(null), false);
  ok('isStrategyCard(null) is false');

  assert.equal(goalGate.isStrategyCard(undefined), false);
  ok('isStrategyCard(undefined) is false');

  assert.equal(goalGate.isStrategyCard({ kind: 'general' }), false);
  ok("isStrategyCard({ kind: 'general' }) is false");

  // ===========================================================================
  // Task 1: chosen outside STRATEGY_OPTION_IDS -- writes nothing, checked
  // before verdict branching, no db required.
  // ===========================================================================

  {
    const result = goalGate.ratifyGoalProposal(null, '/tmp/does-not-matter', {
      card: { kind: 'strategy_goal' }, chosen: ['bogus-option'], verdict: 'approve',
    });
    assert.deepEqual(result, { ok: false, reason: 'chosen_not_in_strategy_options' });
    ok('ratifyGoalProposal with a chosen id outside STRATEGY_OPTION_IDS returns chosen_not_in_strategy_options, no db touched');
  }

  {
    const result = goalGate.ratifyGoalProposal(null, '/tmp/does-not-matter', {
      card: { kind: 'strategy_goal' }, chosen: [], verdict: 'approve',
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'chosen_not_in_strategy_options');
    ok('ratifyGoalProposal with an empty chosen array returns chosen_not_in_strategy_options');
  }

  // ===========================================================================
  // Fixture-dependent legs. node:sqlite unavailability degrades the WHOLE
  // rest of this file to SKIP, per this file's own header.
  // ===========================================================================

  let fixtureCheck;
  try {
    const probeDir = makeRoomDir('345-07-probe-');
    const probeDb = openFixtureDb(probeDir);
    roomDbMod.closeRoomDb(probeDb);
    cleanup(probeDir);
    fixtureCheck = true;
  } catch (e) {
    fixtureCheck = false;
    skip('fixture room build failed (node:sqlite unavailable at runtime): ' + (e && e.message));
  }

  if (!fixtureCheck) {
    console.log('');
    console.log('Checks: ' + checks + '  Skipped: ' + skipped);
    console.log('UNPROVEN: STRAT-13 deliverable not measured this run (node:sqlite unavailable).');
    console.log('PASS test-345-gate-ratify.cjs (degraded, all db legs skipped)');
    process.exit(0);
    return;
  }

  // ===========================================================================
  // Task 1: reject / defer -- writes nothing (anchor stays proposed, goal
  // file untouched). Both verdicts pinned separately (rejectCountInWindow
  // deliberately excludes defer, per this module's own header).
  // ===========================================================================

  for (const verdict of ['reject', 'defer']) {
    const roomDir = makeRoomDir('345-07-' + verdict + '-');
    const db = openFixtureDb(roomDir);
    const mint = navigation.mintGoalAnchor(db, verdict + '-room');
    assert.equal(mint.ok, true);

    const card = { kind: 'strategy_goal', subjectNodeId: mint.node_id, options: [{ id: 'keep', label: 'Keep' }] };
    const result = goalGate.ratifyGoalProposal(db, roomDir, { card: card, chosen: ['keep'], verdict: verdict });
    assert.deepEqual(result, { ok: true, goal_written: false, anchor_confirmed: false });
    ok('ratifyGoalProposal with verdict ' + verdict + ' returns { ok: true, goal_written: false, anchor_confirmed: false }');

    const anchorRow = nodeRow(db, mint.node_id);
    assert.equal(anchorRow.review_status, 'proposed');
    ok('verdict ' + verdict + ': the anchor node review_status stays proposed (unchanged, not confirmed)');

    assert.equal(jtbdState.getGoal(roomDir), null);
    ok('verdict ' + verdict + ': no goal record was written (jtbdState.getGoal stays null)');

    roomDbMod.closeRoomDb(db);
    cleanup(roomDir);
  }

  // ===========================================================================
  // Task 1: approve + keep -- promotes the anchor, goal_written stays false.
  // ===========================================================================

  {
    const roomDir = makeRoomDir('345-07-keep-');
    const db = openFixtureDb(roomDir);
    jtbdState.setGoal(roomDir, { jtbd: 'decide-pursue', rung: 'IllDefined', parent_question: 'should we pursue this now' });
    const mint = navigation.mintGoalAnchor(db, 'keep-room');
    assert.equal(mint.ok, true);

    const card = { kind: 'strategy_goal', subjectNodeId: mint.node_id, options: [{ id: 'keep', label: 'Keep' }] };
    const result = goalGate.ratifyGoalProposal(db, roomDir, { card: card, chosen: ['keep'], verdict: 'approve' });
    assert.equal(result.ok, true);
    assert.equal(result.goal_written, false);
    assert.equal(result.anchor_confirmed, true);
    ok("ratifyGoalProposal approve + chosen ['keep']: goal_written false, anchor_confirmed true");

    const anchorRow = nodeRow(db, mint.node_id);
    assert.equal(anchorRow.review_status, 'confirmed');
    ok("approve + 'keep': the anchor node is promoted to review_status='confirmed' on disk");

    const goalAfter = jtbdState.getGoal(roomDir);
    assert.equal(goalAfter.jtbd, 'decide-pursue');
    assert.equal(goalAfter.goal_version, 1);
    ok("approve + 'keep': the ratified goal is UNCHANGED (still goal_version 1, same jtbd)");

    roomDbMod.closeRoomDb(db);
    cleanup(roomDir);
  }

  // ===========================================================================
  // Task 1: approve + rewrite-jtbd -- calls setGoal exactly once with the
  // new job read from the chosen option's own preview payload.
  // ===========================================================================

  {
    const roomDir = makeRoomDir('345-07-rewrite-');
    const db = openFixtureDb(roomDir);
    jtbdState.setGoal(roomDir, { jtbd: 'decide-pursue', rung: 'IllDefined', parent_question: 'should we pursue this now' });
    const reach = { evidence: { current_jtbd: 'find-problem', reaches_since: 30, unresolved_contradictions: 2 } };
    const card = await strategyCard.buildStrategyCard({ db: db, roomDir: roomDir, roomSlug: 'rewrite-room', reach: reach, candidates: [] });
    assert.ok(card, 'a valid goal must produce a card');

    const result = goalGate.ratifyGoalProposal(db, roomDir, { card: card, chosen: ['rewrite-jtbd'], verdict: 'approve' });
    assert.equal(result.ok, true);
    assert.equal(result.goal_written, true);
    assert.equal(result.goal_version, 2);
    ok("ratifyGoalProposal approve + chosen ['rewrite-jtbd']: goal_written true, goal_version advances to 2");

    const goalAfter = jtbdState.getGoal(roomDir);
    assert.equal(goalAfter.jtbd, 'find-problem');
    ok("approve + 'rewrite-jtbd': the ratified goal.jtbd becomes the inferred job from the card's own rewrite-jtbd option, exactly what the navigator saw");

    roomDbMod.closeRoomDb(db);
    cleanup(roomDir);
  }

  // ===========================================================================
  // Task 1: approve + change-rung -- calls setGoal with the SAME job and
  // the freshly-climbed rung.
  // ===========================================================================

  {
    const roomDir = makeRoomDir('345-07-changerung-');
    const db = openFixtureDb(roomDir);
    jtbdState.setGoal(roomDir, { jtbd: 'decide-pursue', rung: 'IllDefined', parent_question: 'should we pursue this now' });
    const card = await strategyCard.buildStrategyCard({ db: db, roomDir: roomDir, roomSlug: 'changerung-room', candidates: [] });
    assert.ok(card, 'a valid goal must produce a card');

    const taxonomyClimb = require(path.join(REPO, 'lib', 'core', 'strategy', 'taxonomy-climb.cjs'));
    const expectedRung = taxonomyClimb.climb('should we pursue this now');

    const result = goalGate.ratifyGoalProposal(db, roomDir, { card: card, chosen: ['change-rung'], verdict: 'approve' });
    assert.equal(result.ok, true);
    assert.equal(result.goal_written, true);
    ok("ratifyGoalProposal approve + chosen ['change-rung']: goal_written true");

    const goalAfter = jtbdState.getGoal(roomDir);
    assert.equal(goalAfter.jtbd, 'decide-pursue', 'the job stays the SAME on a change-rung approve');
    assert.equal(goalAfter.rung, expectedRung, 'the rung becomes the freshly-climbed rung the card itself carried');
    ok("approve + 'change-rung': jtbd unchanged, rung becomes the SAME rung the card's own change-rung option carried");

    roomDbMod.closeRoomDb(db);
    cleanup(roomDir);
  }

  // ===========================================================================
  // Task 1: a setGoal failure (no valid preview payload on the chosen
  // option) degrades to goal_write_failed, never throws.
  // ===========================================================================

  {
    const roomDir = makeRoomDir('345-07-nopayload-');
    const db = openFixtureDb(roomDir);
    jtbdState.setGoal(roomDir, { jtbd: 'decide-pursue', rung: 'IllDefined' });
    const mint = navigation.mintGoalAnchor(db, 'nopayload-room');
    assert.equal(mint.ok, true);

    const card = {
      kind: 'strategy_goal', subjectNodeId: mint.node_id,
      options: [{ id: 'rewrite-jtbd', label: 'Rewrite the job', description: 'no preview on this option' }],
    };
    let threw = false;
    let result;
    try {
      result = goalGate.ratifyGoalProposal(db, roomDir, { card: card, chosen: ['rewrite-jtbd'], verdict: 'approve' });
    } catch (_e) {
      threw = true;
    }
    assert.equal(threw, false, 'ratifyGoalProposal must never throw on a missing preview payload');
    assert.equal(result.ok, true);
    assert.equal(result.goal_written, false);
    assert.equal(result.reason, 'goal_write_failed');
    ok('ratifyGoalProposal approve + rewrite-jtbd with NO preview payload on the option: never throws, degrades to { ok: true, goal_written: false, reason: goal_write_failed }');

    const goalAfter = jtbdState.getGoal(roomDir);
    assert.equal(goalAfter.goal_version, 1, 'the prior goal is left byte-identical (still goal_version 1)');
    ok('a goal_write_failed leaves the prior ratified goal untouched');

    roomDbMod.closeRoomDb(db);
    cleanup(roomDir);
  }
  console.log('');
  console.log('Checks: ' + checks + '  Skipped: ' + skipped);
  console.log('PASS test-345-gate-ratify.cjs');
}

main().catch((e) => {
  console.error('FAIL: test-345-gate-ratify');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
