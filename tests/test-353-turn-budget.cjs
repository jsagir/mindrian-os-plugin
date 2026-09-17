#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 353 Plan 01 Task 7 -- test-353-turn-budget: the additive legE
 * self-location read on getRoomContext, measured under 400 chars-over-4
 * approximate tokens (criterion 2), purely additive against every
 * pre-existing _meta key.
 *
 * Fixture rooms are built fresh per fixture room-slug with
 * lib/core/room-db.cjs::openRoomDb (the real production schema) under
 * os.tmpdir(), following tests/test-345-gate-anchor.cjs's makeFixtureRoom/
 * cleanupFixtureRoom idiom (including its module-load SKIP guard). The
 * user's real rooms are never touched.
 *
 * Run: node tests/test-353-turn-budget.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

let roomDbMod;
let navigation;
let roomMap;
let tokenEstimator;
try {
  roomDbMod = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
  navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
  roomMap = require(path.join(REPO, 'lib', 'core', 'room-map.cjs'));
  tokenEstimator = require(path.join(REPO, 'lib', 'core', 'token-estimator.cjs'));
} catch (e) {
  console.log('SKIP: test-353-turn-budget -- node:sqlite or a required module is unavailable. ' + (e.code || e.message));
  process.exit(0);
}

const FIXTURE_ROOMS_DIR = path.join(REPO, 'tests', 'fixtures', 'icm-rooms');
const FIXTURE_ROOM_NAMES = ['alpha-room', 'gamma-room'];

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

// Fixture idiom from tests/test-345-gate-anchor.cjs::makeFixtureRoom, plus
// a copy of one of this phase's own fixture rooms and a persisted map.
function makeFixtureRoom(fixtureName) {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), '353-turn-budget-' + fixtureName + '-'));
  copyDirSync(path.join(FIXTURE_ROOMS_DIR, fixtureName), roomDir);
  const map = roomMap.buildRoomMap(roomDir);
  roomMap.writeRoomMap(roomDir, map);
  roomMap.writeSelfBlocks(roomDir, map);
  const handle = roomDbMod.openRoomDb(roomDir);
  return { roomDir: roomDir, db: handle };
}

function cleanupFixtureRoom(fixture) {
  try { roomDbMod.closeRoomDb(fixture.db); } catch (_e) { /* tolerant */ }
  try { fs.rmSync(fixture.roomDir, { recursive: true, force: true }); } catch (_e) { /* tolerant */ }
}

async function main() {
  for (const fixtureName of FIXTURE_ROOM_NAMES) {
    const fixture = makeFixtureRoom(fixtureName);
    try {
      const roomId = path.basename(fixture.roomDir);
      const result = await navigation.getRoomContext(fixture.db, roomId, {
        roomDir: fixture.roomDir,
        estimateOnly: true,
      });

      // Every pre-existing _meta key present and shaped as before.
      const meta = result._meta;
      assert.ok(meta, 'meta present');
      for (const key of ['legA', 'legB', 'legC', 'legD']) {
        assert.ok(typeof meta.legTimingsMs[key] === 'number', 'legTimingsMs.' + key + ' still a number');
        assert.ok(typeof meta.legCostChars[key] === 'number', 'legCostChars.' + key + ' still a number');
        assert.ok(typeof meta.legCostTokensApprox[key] === 'number', 'legCostTokensApprox.' + key + ' still a number');
      }
      assert.ok(typeof meta.legCostTokensApprox.total === 'number', 'total still present');
      assert.equal(result.summary, null, 'estimateOnly nulls the summary body as before');
      ok(fixtureName + ': every pre-existing _meta key stays present and correctly shaped');

      // The new legE fields exist and are numbers.
      assert.ok(typeof meta.legTimingsMs.legE === 'number', 'legTimingsMs.legE is a number');
      assert.ok(typeof meta.legCostChars.legE === 'number', 'legCostChars.legE is a number');
      const legETokens = meta.legCostTokensApprox.legE;
      assert.ok(typeof legETokens === 'number', 'legCostTokensApprox.legE is a number');
      ok(fixtureName + ': legE keys present in legTimingsMs, legCostChars, legCostTokensApprox');

      // Criterion 2: legE is under 400 chars-over-4 approximate tokens.
      assert.ok(legETokens < 400, fixtureName + ': legE tokens approx ' + legETokens + ' is under 400');
      console.log('legE tokens approx: ' + legETokens);
      ok(fixtureName + ': legE is measured under the 400 chars-over-4 approximate-token budget (criterion 2)');
    } finally {
      cleanupFixtureRoom(fixture);
    }
  }

  // Per-block ceiling: estimateTokens(selfBlockText) <= 120 (D-353-2's
  // 60-120 band), read directly from the alpha-room fixture's own nodes.
  const alphaCopy = fs.mkdtempSync(path.join(os.tmpdir(), '353-turn-budget-block-'));
  try {
    copyDirSync(path.join(FIXTURE_ROOMS_DIR, 'alpha-room'), alphaCopy);
    const map = roomMap.buildRoomMap(alphaCopy);
    for (const node of map.nodes) {
      if (!roomMap.SELF_BLOCK_KINDS.has(node.kind)) continue;
      const block = roomMap.renderSelfBlock(node);
      const tokens = tokenEstimator.estimateTokens(block);
      assert.ok(tokens <= 120, 'node ' + node.path + ' block is <= 120 tokens (got ' + tokens + ')');
    }
    ok('every blocked-kind node\'s rendered self-block is <= 120 tokens, the per-block half of criterion 2');
  } finally {
    fs.rmSync(alphaCopy, { recursive: true, force: true });
  }

  // A room with no map or no roomDir degrades to an empty legE, zero cost,
  // no throw.
  const noMapRoom = makeFixtureRoom('alpha-room');
  try {
    fs.rmSync(path.join(noMapRoom.roomDir, '.mindrian'), { recursive: true, force: true });
    const roomId = path.basename(noMapRoom.roomDir);
    const resultNoMap = await navigation.getRoomContext(noMapRoom.db, roomId, {
      roomDir: noMapRoom.roomDir,
      estimateOnly: true,
    });
    assert.equal(resultNoMap._meta.legCostChars.legE, 0, 'no map: legE cost is zero');
    assert.equal(resultNoMap._meta.legCostTokensApprox.legE, 0, 'no map: legE tokens are zero');
    ok('a room with no .mindrian/room-map.json degrades to an empty legE with zero cost and no throw');

    const resultNoRoomDir = await navigation.getRoomContext(noMapRoom.db, roomId, { estimateOnly: true });
    assert.equal(resultNoRoomDir._meta.legCostChars.legE, 0, 'no roomDir option: legE cost is zero');
    ok('a call with no opts.roomDir degrades to an empty legE with zero cost and no throw (byte-stable for every existing caller)');
  } finally {
    cleanupFixtureRoom(noMapRoom);
  }

  console.log('');
  console.log('Checks: ' + checks);
  console.log('PASS test-353-turn-budget.cjs');
}

main().catch((e) => {
  console.error('FAIL: test-353-turn-budget');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
