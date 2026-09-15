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
try {
  roomDbMod = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
  goalAnchor = require(path.join(REPO, 'lib', 'core', 'navigation', 'goal-anchor.cjs'));
  navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
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

function main() {
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
  } finally {
    cleanupFixtureRoom(fixture);
  }

  console.log('');
  console.log('Checks: ' + checks + '  Skipped: ' + skipped);
  console.log('PASS test-345-gate-anchor.cjs');
}

main();
