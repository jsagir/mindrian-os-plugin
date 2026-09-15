#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 345-06 -- test-345-gate-anchor: Task 1 pins mintGoalAnchor (the
 * payload-free, idempotent `goal:<room-slug>` anchor). Task 3 extends this
 * same file with the strategy-card-builder legs (mint-before-assembly
 * ordering, null-on-mint-failure, stale-candidate filtering, the four-option
 * shape, header hygiene, and the Brain-unreachable fallback), per the plan's
 * own instruction to reuse this file's fixture-room helper rather than mint
 * a second fixture harness.
 *
 * Fixture rooms are built fresh per leg with lib/core/room-db.cjs::openRoomDb
 * (the real production schema + migrations) under os.tmpdir(); the user's
 * real rooms directory is never touched. If node:sqlite is unavailable in
 * the execution environment, every leg in this file SKIPs with a printed
 * reason rather than passing (node:sqlite's own require throws at module
 * load in that case).
 *
 * Bare node script, no framework, exits non-zero on any assertion failure,
 * self-contained. House rule: hyphens only, no em-dashes.
 *
 * Run: node tests/test-345-gate-anchor.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

let roomDbMod;
let goalAnchor;
let navigation;
let jtbdState;
let nodeInsertMod;
let strategyCard;
let brainClient;
try {
  roomDbMod = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
  goalAnchor = require(path.join(REPO, 'lib', 'core', 'navigation', 'goal-anchor.cjs'));
  navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
  jtbdState = require(path.join(REPO, 'lib', 'hmi', 'jtbd-state.cjs'));
  nodeInsertMod = require(path.join(REPO, 'lib', 'core', 'node-insert.cjs'));
  strategyCard = require(path.join(REPO, 'lib', 'core', 'strategy', 'strategy-card.cjs'));
  brainClient = require(path.join(REPO, 'lib', 'core', 'brain-client.cjs'));
} catch (e) {
  console.log('SKIP: test-345-gate-anchor -- node:sqlite or a required module is unavailable. ' + (e.code || e.message));
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

function makeFixtureRoom() {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), '345-06-anchor-'));
  const handle = roomDbMod.openRoomDb(roomDir);
  return { roomDir: roomDir, db: handle };
}

function cleanupFixtureRoom(fixture) {
  try { roomDbMod.closeRoomDb(fixture.db); } catch (_e) { /* tolerant */ }
  try { fs.rmSync(fixture.roomDir, { recursive: true, force: true }); } catch (_e) { /* tolerant */ }
}

function nodeRow(db, id) {
  return db.prepare('SELECT id, type, properties, review_status, confidence FROM nodes WHERE id = ?').get(id);
}

function nodeCount(db, id) {
  const row = db.prepare('SELECT COUNT(*) AS c FROM nodes WHERE id = ?').get(id);
  return row ? row.c : 0;
}

function edgeCount(db, type) {
  const row = db.prepare('SELECT COUNT(*) AS c FROM edges WHERE type = ?').get(type);
  return row ? row.c : 0;
}

function insertRealNode(db, id) {
  nodeInsertMod.insertNode(db, id, 'Artifact', '{}', {
    source_path: 'test:345-06', created_by: 'system', epistemic_type: 'observation',
  });
}

async function main() {
  // ===========================================================================
  // Task 1: GOAL_ANCHOR_ID + mintGoalAnchor
  // ===========================================================================

  assert.equal(goalAnchor.GOAL_ANCHOR_ID('my-room'), 'goal:my-room');
  ok("GOAL_ANCHOR_ID('my-room') returns 'goal:my-room'");

  assert.equal(goalAnchor.GOAL_ANCHOR_ID(''), null);
  ok("GOAL_ANCHOR_ID('') returns null");

  assert.equal(goalAnchor.GOAL_ANCHOR_ID(null), null);
  ok('GOAL_ANCHOR_ID(null) returns null');

  assert.equal(navigation.mintGoalAnchor, goalAnchor.mintGoalAnchor);
  ok('navigation.mintGoalAnchor is the same function as goalAnchor.mintGoalAnchor');

  {
    const noDbResult = goalAnchor.mintGoalAnchor(null, 'my-room');
    assert.deepEqual(noDbResult, { ok: false, reason: 'no_db' });
    ok("mintGoalAnchor(null, 'my-room') returns { ok: false, reason: 'no_db' } and does not throw");
  }

  let fixture;
  try {
    fixture = makeFixtureRoom();
  } catch (e) {
    skip('fixture room build failed (node:sqlite unavailable at runtime): ' + (e && e.message));
    console.log('');
    console.log('Checks: ' + checks + '  Skipped: ' + skipped);
    console.log('PASS test-345-gate-anchor.cjs (degraded, all db legs skipped)');
    process.exit(0);
    return;
  }

  try {
    const db = fixture.db;

    {
      const invalidSlug = goalAnchor.mintGoalAnchor(db, '');
      assert.deepEqual(invalidSlug, { ok: false, reason: 'invalid_slug' });
      ok("mintGoalAnchor(db, '') returns { ok: false, reason: 'invalid_slug' }");
    }

    {
      const first = goalAnchor.mintGoalAnchor(db, 'my-room');
      assert.equal(first.ok, true);
      assert.equal(first.node_id, 'goal:my-room');
      assert.equal(first.created, true);
      ok("mintGoalAnchor(db, 'my-room') first call: { ok: true, node_id: 'goal:my-room', created: true }");

      const countAfterFirst = nodeCount(db, 'goal:my-room');
      assert.equal(countAfterFirst, 1);
      ok('exactly one row in nodes with id goal:my-room after the first mint');

      const rowAfterFirst = nodeRow(db, 'goal:my-room');

      const second = goalAnchor.mintGoalAnchor(db, 'my-room');
      assert.equal(second.ok, true);
      assert.equal(second.node_id, 'goal:my-room');
      assert.equal(second.created, false);
      ok("mintGoalAnchor(db, 'my-room') second call: created is false");

      const countAfterSecond = nodeCount(db, 'goal:my-room');
      assert.equal(countAfterSecond, 1);
      ok('exactly one row in nodes with id goal:my-room after the second mint (row count, not just the return value)');

      const rowAfterSecond = nodeRow(db, 'goal:my-room');
      assert.deepEqual(rowAfterSecond, rowAfterFirst);
      ok('the row is byte-identical after the second mint (on_conflict: nothing, no last_seen_at bump)');
    }

    {
      const row = nodeRow(db, 'goal:my-room');
      assert.ok(row, 'the minted row must exist');
      assert.equal(row.type, 'goal');
      ok("the minted row's type is exactly 'goal'");
      assert.notEqual(row.type, 'claim');
      ok("the minted row's type is NOT 'claim'");

      const props = JSON.parse(row.properties);
      assert.deepEqual(Object.keys(props), ['epistemic_type']);
      assert.equal(props.epistemic_type, 'assumption');
      ok("the minted row's properties parse to an object whose only key is epistemic_type='assumption'");

      assert.equal(row.review_status, 'proposed');
      ok("the minted row's review_status is exactly 'proposed'");
    }

    // =========================================================================
    // Task 3: lib/core/strategy/strategy-card.cjs -- buildStrategyCard legs
    // =========================================================================

    assert.equal(strategyCard.STRATEGY_CARD_KIND, 'strategy_goal');
    ok("STRATEGY_CARD_KIND === 'strategy_goal'");

    assert.deepEqual(strategyCard.STRATEGY_OPTION_IDS.slice(), ['keep', 'rewrite-jtbd', 'change-rung', 'defer']);
    ok('STRATEGY_OPTION_IDS is the frozen four-member array in order');

    {
      // No goal record at all -> null.
      const noGoalDir = fs.mkdtempSync(path.join(os.tmpdir(), '345-06-nogoal-'));
      const noGoalHandle = roomDbMod.openRoomDb(noGoalDir);
      const card = await strategyCard.buildStrategyCard({
        db: noGoalHandle, roomDir: noGoalDir, roomSlug: 'no-goal-room', candidates: [],
      });
      assert.equal(card, null);
      ok('buildStrategyCard returns null when the room has no ratified goal record');
      roomDbMod.closeRoomDb(noGoalHandle);
      fs.rmSync(noGoalDir, { recursive: true, force: true });
    }

    {
      // Mint-before-assembly + null-on-mint-failure: an invalid roomSlug
      // makes GOAL_ANCHOR_ID return null, so mintGoalAnchor fails with
      // invalid_slug, so the card builder must return null rather than a
      // card whose subject_node_id points at nothing. Zero SOURCED_FROM
      // edges must exist afterward (the builder never writes edges itself).
      const cardDir = fs.mkdtempSync(path.join(os.tmpdir(), '345-06-mintfail-'));
      const cardDb = roomDbMod.openRoomDb(cardDir);
      jtbdState.setGoal(cardDir, { jtbd: 'decide-pursue', rung: 'IllDefined', parent_question: 'should we pursue this' });
      const card = await strategyCard.buildStrategyCard({
        db: cardDb, roomDir: cardDir, roomSlug: '', candidates: [],
      });
      assert.equal(card, null);
      ok('buildStrategyCard returns null when mintGoalAnchor fails (invalid roomSlug)');
      assert.equal(edgeCount(cardDb, 'SOURCED_FROM'), 0);
      ok('zero SOURCED_FROM edges exist after a forced mint failure');
      roomDbMod.closeRoomDb(cardDb);
      fs.rmSync(cardDir, { recursive: true, force: true });
    }

    {
      // Full happy path: mint-before-assembly ordering (the anchor node
      // really exists on disk), the four-option shape, and header hygiene.
      const cardDir = fs.mkdtempSync(path.join(os.tmpdir(), '345-06-card-'));
      const cardDb = roomDbMod.openRoomDb(cardDir);
      jtbdState.setGoal(cardDir, {
        jtbd: 'decide-pursue', rung: 'IllDefined', parent_question: 'a secret venture-prose question that must never egress',
      });
      const reach = { evidence: { current_jtbd: 'find-problem', reaches_since: 22, unresolved_contradictions: 3 } };
      const card = await strategyCard.buildStrategyCard({
        db: cardDb, roomDir: cardDir, roomSlug: 'card-room', reach: reach, candidates: [],
      });
      assert.ok(card, 'a valid goal + a successful mint must produce a card');

      assert.equal(card.kind, 'strategy_goal');
      ok('card.kind is the literal strategy_goal value');

      assert.equal(card.subject_node_id, 'goal:card-room');
      ok('card.subject_node_id equals the minted anchor id');
      assert.equal(nodeCount(cardDb, 'goal:card-room'), 1);
      ok('the anchor node was actually minted on disk (mint-before-assembly ordering)');

      assert.equal(card.options.length, 4);
      const optionIds = card.options.map((o) => o.id);
      assert.deepEqual(optionIds, ['keep', 'rewrite-jtbd', 'change-rung', 'defer']);
      for (const o of card.options) {
        assert.equal(typeof o.label, 'string');
        assert.ok(o.label.length > 0, 'every option label must be non-empty');
      }
      ok('card.options has exactly 4 entries, ids in order, every label non-empty');

      assert.equal(typeof card.header, 'string');
      assert.ok(card.header.length < 300, 'header must be under 300 chars, got ' + card.header.length);
      assert.equal(card.header.indexOf('\n'), -1, 'header must be a single line');
      assert.equal(card.header.indexOf('\u2014'), -1, 'header must contain no em-dash');
      assert.equal(card.header.indexOf('secret venture-prose question'), -1, 'header must never contain goal.parent_question');
      ok('header is a single line, under 300 chars, no em-dash, no goal.parent_question content');

      assert.deepEqual(card.evidence_node_ids, []);
      ok('card.evidence_node_ids is empty when candidates is empty');

      roomDbMod.closeRoomDb(cardDb);
      fs.rmSync(cardDir, { recursive: true, force: true });
    }

    {
      // Stale-candidate filtering: one real node id, one id with no row.
      const cardDir = fs.mkdtempSync(path.join(os.tmpdir(), '345-06-stale-'));
      const cardDb = roomDbMod.openRoomDb(cardDir);
      jtbdState.setGoal(cardDir, { jtbd: 'decide-pursue', rung: 'IllDefined' });
      insertRealNode(cardDb, '345-06:real-node-1');
      const card = await strategyCard.buildStrategyCard({
        db: cardDb, roomDir: cardDir, roomSlug: 'stale-room',
        candidates: ['345-06:real-node-1', '345-06:stale-does-not-exist'],
      });
      assert.ok(card);
      assert.deepEqual(card.evidence_node_ids, ['345-06:real-node-1']);
      ok('a stale candidate id (no matching node row) is filtered out; the real id survives');
      roomDbMod.closeRoomDb(cardDb);
      fs.rmSync(cardDir, { recursive: true, force: true });
    }

    {
      // Truncation: 70 real candidate ids -> exactly 64 survive.
      const cardDir = fs.mkdtempSync(path.join(os.tmpdir(), '345-06-trunc-'));
      const cardDb = roomDbMod.openRoomDb(cardDir);
      jtbdState.setGoal(cardDir, { jtbd: 'decide-pursue', rung: 'IllDefined' });
      const seventy = [];
      for (let i = 0; i < 70; i += 1) {
        const id = '345-06:trunc-node-' + i;
        insertRealNode(cardDb, id);
        seventy.push(id);
      }
      const card = await strategyCard.buildStrategyCard({
        db: cardDb, roomDir: cardDir, roomSlug: 'trunc-room', candidates: seventy,
      });
      assert.ok(card);
      assert.equal(card.evidence_node_ids.length, 64);
      ok('70 real candidate ids truncate to exactly 64 in evidence_node_ids');
      roomDbMod.closeRoomDb(cardDb);
      fs.rmSync(cardDir, { recursive: true, force: true });
    }

    {
      // Brain-unreachable fallback: stub callTool to simulate no Brain
      // reachable; the card must still be complete and its change-rung
      // option description must come from localLadderLine.
      const taxonomyClimb = require(path.join(REPO, 'lib', 'core', 'strategy', 'taxonomy-climb.cjs'));
      const cardDir = fs.mkdtempSync(path.join(os.tmpdir(), '345-06-unreachable-'));
      const cardDb = roomDbMod.openRoomDb(cardDir);
      jtbdState.setGoal(cardDir, { jtbd: 'decide-pursue', rung: 'IllDefined' });

      const originalCallTool = brainClient.callTool;
      brainClient.callTool = async () => null;
      let card;
      try {
        card = await strategyCard.buildStrategyCard({
          db: cardDb, roomDir: cardDir, roomSlug: 'unreachable-room', candidates: [],
        });
      } finally {
        brainClient.callTool = originalCallTool;
      }
      assert.ok(card, 'the card must still be complete when the Brain is unreachable');
      const changeRungOption = card.options.find((o) => o.id === 'change-rung');
      assert.equal(changeRungOption.description, taxonomyClimb.localLadderLine('IllDefined'));
      ok('with the Brain unreachable, the card is complete and the change-rung description comes from localLadderLine');

      roomDbMod.closeRoomDb(cardDb);
      fs.rmSync(cardDir, { recursive: true, force: true });
    }
  } finally {
    cleanupFixtureRoom(fixture);
  }

  console.log('');
  console.log('Checks: ' + checks + '  Skipped: ' + skipped);
  console.log('PASS test-345-gate-anchor.cjs');
}

main().catch((e) => {
  console.error('FAIL: test-345-gate-anchor');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
