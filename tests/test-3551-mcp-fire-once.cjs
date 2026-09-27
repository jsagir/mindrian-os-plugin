#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 Plan 13 (RED then GREEN) -- test-3551-mcp-fire-once: pins
 * Navigator Ruling 2 (AMB-05) on the hookless surfaces (Desktop, Cowork).
 * SENS-13's stamped card is offered ONCE per delta on the MCP pull path
 * (suggest_next / reach_candidates -> dispatchCandidateReaches), even though
 * the pull tools themselves stay PURE READS: the winning reach is noted in
 * process memory only (lib/mcp/surfaced-offers.cjs), and the Stop-time
 * close-out (lib/mcp/stop-gate-handler.cjs closeOutRoom) persists that note
 * through the SAME 355-19/355-22 fire-once ledger the CLI path already uses.
 *
 * Legs covered (355.1-13-PLAN.md Task 1 <behavior>):
 *   1. winner noted: a pull whose reaches[0] is the SENS-13 reach notes the
 *      handle; a pull where another (higher-ranked) reach wins notes nothing.
 *   2. pure read: an fs write spy across two pulls records zero calls; no
 *      room.db write (row count unchanged).
 *   3. close-out: closeOutRoom marks the noted handle in the fire-once
 *      ledger and clears the note; the next pull returns no SENS-13 reach.
 *   4. one card per delta hash on the MCP path: pull (fires) -> close-out ->
 *      pull (silent) -> close-out -> pull (silent).
 *   5. not shown, not marked: a side channel written after the last pull
 *      (never noted) is NOT marked by a close-out that follows it, and IS
 *      returned by the next pull.
 *   6. stated limit pinned (the ruling's accepted cost): two pulls with no
 *      close-out between both return SENS-13, bounded by the 30-minute
 *      freshness window.
 *   7. bounded: MAX_HANDLES_PER_ROOM / MAX_ROOMS drop the oldest;
 *      takeSurfaced returns a copy and clears only that room.
 *   8. soft-fail: a read-only .mindrian and an unwritable ledger path never
 *      throw out of closeOutRoom; a thrown noteSurfaced never breaks a pull.
 *   9. CLI untouched: navigation-engine.cjs still calls markEurekaReachSurfaced
 *      exactly once.
 *
 * Test hygiene contract (every 355/355.1 test): scrub TYPESAFE_API_KEY and
 * install the net guard via tests/helpers/hygiene-355.cjs BEFORE requiring
 * any repo module; assert attempts() === 0 as the last check.
 *
 * No em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 */

const path = require('node:path');
const fs = require('node:fs');

const hygiene = require('./helpers/hygiene-355.cjs');

const wasKeyPresent = hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

try {
  require('node:sqlite');
} catch (_e) {
  process.stdout.write('SKIP test-3551-mcp-fire-once.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REPO = path.join(__dirname, '..');
const checker = hygiene.makeChecker('test-3551-mcp-fire-once');
const { check } = checker;

const { buildDeltaRoom } = require('./helpers/fixture-room-3551.cjs');
const ambientRun = require(path.join(REPO, 'lib', 'core', 'ambient-run.cjs'));
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
const sensorsTool = require(path.join(REPO, 'lib', 'mcp', 'tools', 'sensors.cjs'));
const stopGateHandler = require(path.join(REPO, 'lib', 'mcp', 'stop-gate-handler.cjs'));
// This is the RED leg: the module this plan creates does not exist yet.
const surfacedOffers = require(path.join(REPO, 'lib', 'mcp', 'surfaced-offers.cjs'));

// ---------------------------------------------------------------------------
// Shared fixtures + helpers (mirrors tests/test-3551-surfacing.cjs's idiom).
// ---------------------------------------------------------------------------

const INDIRECT_STAMP = Object.freeze({
  verification: 'indirect', backend: 'theo', direction: 'structural_transfer', judge: 'none',
  path: Object.freeze({
    nodes: ['Reverse Salient Analysis', 'Six Thinking Hats'],
    labels: ['Reverse Salient Analysis', 'Six Thinking Hats'],
    edges: ['EXTENDS'],
  }),
});

const rooms = [];
function trackedRoom(label) {
  const r = buildDeltaRoom(label);
  rooms.push(r);
  return r;
}
function cleanupAllRooms() {
  for (const r of rooms) {
    try { r.cleanup(); } catch (_e) { /* best-effort */ }
  }
}

function eurekaReachesOf(reaches) {
  return (Array.isArray(reaches) ? reaches : []).filter((r) => r && r.signal === 'eureka_bridge');
}

// seedIndirectComposition(room, stamp) -- runs the REAL runAmbientComposition
// (lib/core/ambient-run.cjs) with an injected adapter returning ONE finding
// carrying `stamp` and an injected measureAndGuard that always clears, so the
// resulting last-eureka.json side channel + opportunity node are the SAME
// shape production writes (never a hand-built JSON file). Returns the
// composition result ({ card, surfaced_via, ... }).
async function seedIndirectComposition(room, stamp) {
  const finding = {
    producer: 'eureka',
    a: { handle: 'nodeA', text: 'alpha finding text' },
    b: { handle: 'nodeB', text: 'omega finding text' },
    stamp: stamp,
    rank: 0,
  };
  const adapters = {
    eureka: async () => ({ outcome: 'no_candidate', findings: [finding] }),
    'find-connections': async () => ({ outcome: 'no_candidate', findings: [] }),
    'find-bottlenecks': async () => ({ outcome: 'no_candidate', findings: [] }),
    hsi: async () => ({ outcome: 'no_candidate', findings: [] }),
    whitespace: async () => ({ outcome: 'no_candidate', findings: [] }),
  };
  const measureAndGuard = async () => ({
    ok: true,
    score: { direction: 'structural_transfer', abs_diff: 0.5, band: 'opportunity', passes: true, semantic: 0.1, lexical: 0.1 },
    guard: { cleared: true, verdict: 'transferable', confidence: 'high', tags: [] },
  });
  const res = await ambientRun.runAmbientComposition(room.roomDir, { deps: { adapters: adapters, measureAndGuard: measureAndGuard } });
  if (!res || !res.card) throw new Error('seedIndirectComposition: expected a card, got: ' + JSON.stringify(res));
  return res;
}

// plantCompetingReach(roomDir) -- a fresh last-cascade.json (SENS-06,
// artifact-filed) with a non-empty newFindings array and NO session_id (the
// REACH-03 fail-open shape, so it fires regardless of the caller session).
// SENS-06 (Group B, priority index right after SENS-01) outranks SENS-13
// (Group B, right after SENS-06) both on the reach-hedge-ranker's registry
// signal (cross_room is earlier in REACH_IDS than deep_research) and on the
// sensorPriorityRank doctrine tie-break, so this reliably becomes reaches[0]
// ahead of the eureka_bridge candidate.
function plantCompetingReach(roomDir) {
  const sideDir = path.join(roomDir, '.mindrian');
  fs.mkdirSync(sideDir, { recursive: true });
  const payload = { proactive_intelligence: { newFindings: [{ type: 'ADD', id: 'fixture-competing-node' }] } };
  fs.writeFileSync(path.join(sideDir, 'last-cascade.json'), JSON.stringify(payload), 'utf8');
}

function readLedger(roomDir) {
  const ledgerPath = path.join(roomDir, '.mindrian', 'eureka-reach-ledger.json');
  if (!fs.existsSync(ledgerPath)) return null;
  return JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
}

function roomNodeCount(roomDir) {
  const db = navigation.openRoomDbForCaller(roomDir);
  if (!db) return -1;
  try {
    return db.prepare('SELECT COUNT(*) AS n FROM nodes').get().n;
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
}

function resetBetweenLegs() {
  try { surfacedOffers._resetForTest(); } catch (_e) { /* RED: module absent */ }
  try { stopGateHandler._resetForTest(); } catch (_e) { /* best-effort */ }
}

// ---------------------------------------------------------------------------
// 1. winner noted only when SENS-13 actually wins the pull's reaches[0].
// ---------------------------------------------------------------------------
async function caseWinnerNotedOnlyOnWin() {
  process.stdout.write('\n-- winner noted: reaches[0] === SENS-13 notes the handle; a losing pull notes nothing --\n');
  resetBetweenLegs();

  const winRoom = trackedRoom('winner-noted');
  const compRes = await seedIndirectComposition(winRoom, INDIRECT_STAMP);
  const handle = compRes.card.opportunity_handle;

  const pull = sensorsTool._internal.dispatchCandidateReaches('sess-winner', winRoom.roomDir, {});
  check('winner pull: at least one reach fires', Array.isArray(pull.reaches) && pull.reaches.length > 0, JSON.stringify(pull.reaches));
  check('winner pull: reaches[0] is the SENS-13 (eureka_bridge) reach', pull.reaches[0] && pull.reaches[0].signal === 'eureka_bridge', JSON.stringify(pull.reaches[0]));
  check('winner pull: reaches[0].evidence.opportunity_handle equals the card handle', pull.reaches[0].evidence.opportunity_handle === handle);

  const noted = surfacedOffers.peekSurfaced(winRoom.roomDir);
  check('winner pull: peekSurfaced(roomDir) contains the winning handle', Array.isArray(noted) && noted.indexOf(handle) !== -1, JSON.stringify(noted));

  const loseRoom = trackedRoom('loser-not-noted');
  const loseComp = await seedIndirectComposition(loseRoom, INDIRECT_STAMP);
  const loseHandle = loseComp.card.opportunity_handle;
  plantCompetingReach(loseRoom.roomDir);

  const losePull = sensorsTool._internal.dispatchCandidateReaches('sess-loser', loseRoom.roomDir, {});
  check('loser pull: the eureka_bridge candidate still fires (present in the set)', eurekaReachesOf(losePull.reaches).length === 1, JSON.stringify(losePull.reaches));
  check('loser pull: reaches[0] is NOT the eureka_bridge reach (the competing reach outranks it)', losePull.reaches[0] && losePull.reaches[0].signal !== 'eureka_bridge', JSON.stringify(losePull.reaches[0]));

  const notNoted = surfacedOffers.peekSurfaced(loseRoom.roomDir);
  check('loser pull: peekSurfaced(roomDir) is empty (the losing reach was never noted)', Array.isArray(notNoted) && notNoted.indexOf(loseHandle) === -1, JSON.stringify(notNoted));
}

// ---------------------------------------------------------------------------
// 2. pure read: an fs write spy across two pulls records zero calls; the
//    room.db row count is unchanged.
// ---------------------------------------------------------------------------
async function casePureReadNoWrites() {
  process.stdout.write('\n-- pure read: zero fs writes and zero room.db row-count change across two pulls --\n');
  resetBetweenLegs();

  const room = trackedRoom('pure-read');
  await seedIndirectComposition(room, INDIRECT_STAMP);

  const countBefore = roomNodeCount(room.roomDir);

  const originalWriteFileSync = fs.writeFileSync;
  const originalRenameSync = fs.renameSync;
  const originalOpenSync = fs.openSync;
  const originalMkdirSync = fs.mkdirSync;
  let writeCalls = 0;
  function looksLikeWriteFlag(flags) {
    if (typeof flags === 'string') return /w|a|\+/.test(flags);
    if (typeof flags === 'number') {
      const fsc = require('node:fs').constants;
      return (flags & (fsc.O_WRONLY | fsc.O_RDWR | fsc.O_CREAT | fsc.O_APPEND)) !== 0;
    }
    return false;
  }
  fs.writeFileSync = function spyWriteFileSync() { writeCalls += 1; return originalWriteFileSync.apply(fs, arguments); };
  fs.renameSync = function spyRenameSync() { writeCalls += 1; return originalRenameSync.apply(fs, arguments); };
  fs.mkdirSync = function spyMkdirSync() { writeCalls += 1; return originalMkdirSync.apply(fs, arguments); };
  fs.openSync = function spyOpenSync(p, flags) {
    if (looksLikeWriteFlag(flags)) writeCalls += 1;
    return originalOpenSync.apply(fs, arguments);
  };

  let pull1 = null;
  let pull2 = null;
  try {
    pull1 = sensorsTool._internal.dispatchCandidateReaches('sess-pure-read', room.roomDir, {});
    pull2 = sensorsTool._internal.dispatchCandidateReaches('sess-pure-read', room.roomDir, {});
  } finally {
    fs.writeFileSync = originalWriteFileSync;
    fs.renameSync = originalRenameSync;
    fs.openSync = originalOpenSync;
    fs.mkdirSync = originalMkdirSync;
  }

  check('pure read: pull 1 still fires the eureka_bridge reach', eurekaReachesOf(pull1.reaches).length === 1, JSON.stringify(pull1.reaches));
  check('pure read: pull 2 still fires the eureka_bridge reach (a pull is a pure read, no dedup at this seam)', eurekaReachesOf(pull2.reaches).length === 1, JSON.stringify(pull2.reaches));
  check('pure read: zero fs.writeFileSync/renameSync/mkdirSync/write-flag-openSync calls across two pulls', writeCalls === 0, String(writeCalls));

  const countAfter = roomNodeCount(room.roomDir);
  check('pure read: room.db row count unchanged across two pulls', countAfter === countBefore, JSON.stringify({ countBefore: countBefore, countAfter: countAfter }));
}

// ---------------------------------------------------------------------------
// 3 + 4 + 5. close-out marks + clears; one card per delta hash; a side
//    channel written after the last pull (never noted) is not marked and is
//    returned by the next pull.
// ---------------------------------------------------------------------------
async function caseCloseOutFireOnceSequence() {
  process.stdout.write('\n-- close-out: marks + clears the noted handle; one card per delta hash; unnoted side channels survive --\n');
  resetBetweenLegs();

  const room = trackedRoom('close-out-sequence');
  const compRes1 = await seedIndirectComposition(room, INDIRECT_STAMP);
  const handle1 = compRes1.card.opportunity_handle;

  const pull1 = sensorsTool._internal.dispatchCandidateReaches('sess-close-out', room.roomDir, {});
  check('sequence pull 1: fires the eureka_bridge reach', eurekaReachesOf(pull1.reaches).length === 1, JSON.stringify(pull1.reaches));
  check('sequence pull 1: the handle is noted before the close-out', surfacedOffers.peekSurfaced(room.roomDir).indexOf(handle1) !== -1);

  const closeout1 = stopGateHandler.closeOutRoom(room.roomDir, 'sess-close-out');
  check('close-out 1: returns the normal shape (room_dir set)', closeout1 && closeout1.room_dir === room.roomDir, JSON.stringify(closeout1));
  const ledgerAfter1 = readLedger(room.roomDir);
  check('close-out 1: the fire-once ledger now carries handle1', !!ledgerAfter1 && !!ledgerAfter1.entries && Object.prototype.hasOwnProperty.call(ledgerAfter1.entries, handle1), JSON.stringify(ledgerAfter1));
  check('close-out 1: the note is cleared after the close-out', surfacedOffers.peekSurfaced(room.roomDir).length === 0, JSON.stringify(surfacedOffers.peekSurfaced(room.roomDir)));

  const pull2 = sensorsTool._internal.dispatchCandidateReaches('sess-close-out', room.roomDir, {});
  check('sequence pull 2 (after close-out 1): no eureka_bridge reach fires (already surfaced)', eurekaReachesOf(pull2.reaches).length === 0, JSON.stringify(pull2.reaches));

  const closeout2 = stopGateHandler.closeOutRoom(room.roomDir, 'sess-close-out');
  check('close-out 2 (nothing noted): returns the normal shape and does not throw', closeout2 && closeout2.room_dir === room.roomDir, JSON.stringify(closeout2));

  const pull3 = sensorsTool._internal.dispatchCandidateReaches('sess-close-out', room.roomDir, {});
  check('sequence pull 3 (still after close-out 1, nothing new): no eureka_bridge reach fires', eurekaReachesOf(pull3.reaches).length === 0, JSON.stringify(pull3.reaches));

  // Not shown, not marked: a second, DIFFERENT composition is seeded directly
  // (never pulled), so its handle is never noted in process memory.
  const compRes2 = await seedIndirectComposition(room, INDIRECT_STAMP);
  const handle2 = compRes2.card.opportunity_handle;
  check('a fresh second composition mints a different handle', handle2 !== handle1);
  check('not shown, not marked: the second handle was never noted (no pull happened for it)', surfacedOffers.peekSurfaced(room.roomDir).indexOf(handle2) === -1);

  const closeout3 = stopGateHandler.closeOutRoom(room.roomDir, 'sess-close-out');
  check('close-out 3 (no note for handle2): returns the normal shape and does not throw', closeout3 && closeout3.room_dir === room.roomDir, JSON.stringify(closeout3));
  const ledgerAfter3 = readLedger(room.roomDir);
  check('not shown, not marked: the close-out that follows never marks handle2 (it was never noted)', !ledgerAfter3 || !ledgerAfter3.entries || !Object.prototype.hasOwnProperty.call(ledgerAfter3.entries, handle2), JSON.stringify(ledgerAfter3));

  const pull4 = sensorsTool._internal.dispatchCandidateReaches('sess-close-out', room.roomDir, {});
  const eureka4 = eurekaReachesOf(pull4.reaches);
  check('not shown, not marked: the next pull returns handle2 (an unmarked, still-fresh side channel)', eureka4.length === 1 && eureka4[0].evidence.opportunity_handle === handle2, JSON.stringify(eureka4));
}

// ---------------------------------------------------------------------------
// 6. stated limit pinned (the ruling's accepted cost): two pulls with no
//    close-out between both return SENS-13.
// ---------------------------------------------------------------------------
async function caseStatedLimitAcceptedCost() {
  process.stdout.write('\n-- stated limit (the ruling\'s accepted cost): two pulls with no close-out between both fire SENS-13 --\n');
  resetBetweenLegs();

  const room = trackedRoom('accepted-cost');
  const compRes = await seedIndirectComposition(room, INDIRECT_STAMP);
  const handle = compRes.card.opportunity_handle;

  const pull1 = sensorsTool._internal.dispatchCandidateReaches('sess-accepted-cost', room.roomDir, {});
  const pull2 = sensorsTool._internal.dispatchCandidateReaches('sess-accepted-cost', room.roomDir, {});
  const eureka1 = eurekaReachesOf(pull1.reaches);
  const eureka2 = eurekaReachesOf(pull2.reaches);
  check(
    "stated limit, the ruling's accepted cost: two pulls with no close-out between both fire SENS-13 for the same handle, bounded by the 30-minute freshness window",
    eureka1.length === 1 && eureka1[0].evidence.opportunity_handle === handle
      && eureka2.length === 1 && eureka2[0].evidence.opportunity_handle === handle,
    JSON.stringify({ eureka1: eureka1, eureka2: eureka2 })
  );
}

// ---------------------------------------------------------------------------
// 7. bounded: MAX_HANDLES_PER_ROOM / MAX_ROOMS drop the oldest; takeSurfaced
//    returns a copy and clears only that room.
// ---------------------------------------------------------------------------
function caseBoundedEviction() {
  process.stdout.write('\n-- bounded: MAX_HANDLES_PER_ROOM / MAX_ROOMS drop the oldest; takeSurfaced returns a copy --\n');
  resetBetweenLegs();

  check('MAX_HANDLES_PER_ROOM is exported and finite', Number.isInteger(surfacedOffers.MAX_HANDLES_PER_ROOM) && surfacedOffers.MAX_HANDLES_PER_ROOM > 0);
  check('MAX_ROOMS is exported and finite', Number.isInteger(surfacedOffers.MAX_ROOMS) && surfacedOffers.MAX_ROOMS > 0);

  const overflowRoom = '/tmp/mos-3551-fixture-overflow-room';
  const handleCap = surfacedOffers.MAX_HANDLES_PER_ROOM;
  for (let i = 0; i < handleCap + 5; i += 1) {
    surfacedOffers.noteSurfaced(overflowRoom, 'handle-' + i);
  }
  const handles = surfacedOffers.peekSurfaced(overflowRoom);
  check('bounded handles: peekSurfaced never exceeds MAX_HANDLES_PER_ROOM', handles.length <= handleCap, String(handles.length));
  check('bounded handles: the oldest handle (handle-0) was evicted', handles.indexOf('handle-0') === -1, JSON.stringify(handles));
  check('bounded handles: the newest handle was kept', handles.indexOf('handle-' + (handleCap + 4)) !== -1, JSON.stringify(handles));

  resetBetweenLegs();
  const roomCap = surfacedOffers.MAX_ROOMS;
  for (let i = 0; i < roomCap + 5; i += 1) {
    surfacedOffers.noteSurfaced('/tmp/mos-3551-fixture-room-' + i, 'h');
  }
  check('bounded rooms: the oldest room (room-0) was evicted', surfacedOffers.peekSurfaced('/tmp/mos-3551-fixture-room-0').length === 0);
  check('bounded rooms: the newest room was kept', surfacedOffers.peekSurfaced('/tmp/mos-3551-fixture-room-' + (roomCap + 4)).length > 0);

  resetBetweenLegs();
  surfacedOffers.noteSurfaced('/tmp/mos-3551-fixture-room-a', 'h1');
  surfacedOffers.noteSurfaced('/tmp/mos-3551-fixture-room-b', 'h2');
  const taken = surfacedOffers.takeSurfaced('/tmp/mos-3551-fixture-room-a');
  check('takeSurfaced returns the noted handle', Array.isArray(taken) && taken.indexOf('h1') !== -1, JSON.stringify(taken));
  check('takeSurfaced clears only that room', surfacedOffers.peekSurfaced('/tmp/mos-3551-fixture-room-a').length === 0
    && surfacedOffers.peekSurfaced('/tmp/mos-3551-fixture-room-b').length === 1);
  taken.push('mutated-after-the-fact');
  check('takeSurfaced returns a COPY: mutating it never resurrects internal state', surfacedOffers.peekSurfaced('/tmp/mos-3551-fixture-room-a').length === 0);
}

// ---------------------------------------------------------------------------
// 8. soft-fail: a read-only .mindrian and an unwritable ledger path never
//    throw out of closeOutRoom; a thrown noteSurfaced never breaks a pull.
// ---------------------------------------------------------------------------
async function caseSoftFailReadOnlyMindrian() {
  process.stdout.write('\n-- soft-fail: a read-only .mindrian never throws out of closeOutRoom --\n');
  resetBetweenLegs();

  const room = trackedRoom('soft-fail-readonly');
  await seedIndirectComposition(room, INDIRECT_STAMP);
  sensorsTool._internal.dispatchCandidateReaches('sess-soft-fail-ro', room.roomDir, {});

  const mindrianDir = path.join(room.roomDir, '.mindrian');
  let threw = null;
  let result = null;
  const originalMode = fs.statSync(mindrianDir).mode;
  try {
    fs.chmodSync(mindrianDir, 0o555);
    try {
      result = stopGateHandler.closeOutRoom(room.roomDir, 'sess-soft-fail-ro');
    } catch (e) {
      threw = e;
    }
  } finally {
    try { fs.chmodSync(mindrianDir, originalMode); } catch (_e) { /* best-effort restore */ }
  }
  check('soft-fail (read-only .mindrian): closeOutRoom never throws', threw === null, threw && (threw.message || String(threw)));
  check('soft-fail (read-only .mindrian): closeOutRoom returns its normal shape', result && result.room_dir === room.roomDir, JSON.stringify(result));
}

function caseSoftFailUnwritableLedger() {
  process.stdout.write('\n-- soft-fail: an unwritable ledger path never throws out of closeOutRoom --\n');
  resetBetweenLegs();

  const room = trackedRoom('soft-fail-ledger');
  surfacedOffers.noteSurfaced(room.roomDir, 'opportunity:fixture:soft-fail-ledger');

  const ledgerPath = path.join(room.roomDir, '.mindrian', 'eureka-reach-ledger.json');
  fs.mkdirSync(ledgerPath, { recursive: true }); // forces atomicWriteJson's rename to fail, uid-independent

  let threw = null;
  let result = null;
  try {
    result = stopGateHandler.closeOutRoom(room.roomDir, 'sess-soft-fail-ledger');
  } catch (e) {
    threw = e;
  }
  check('soft-fail (unwritable ledger path): closeOutRoom never throws', threw === null, threw && (threw.message || String(threw)));
  check('soft-fail (unwritable ledger path): closeOutRoom returns its normal shape', result && result.room_dir === room.roomDir, JSON.stringify(result));
  check('soft-fail (unwritable ledger path): the forced-failure path is still a directory (the write genuinely failed)', fs.statSync(ledgerPath).isDirectory());
}

async function caseSoftFailNoteSurfacedThrows() {
  process.stdout.write('\n-- soft-fail: a thrown noteSurfaced never breaks a pull --\n');
  resetBetweenLegs();

  const room = trackedRoom('soft-fail-throw');
  await seedIndirectComposition(room, INDIRECT_STAMP);

  const originalNoteSurfaced = surfacedOffers.noteSurfaced;
  surfacedOffers.noteSurfaced = function throwingNoteSurfaced() {
    throw new Error('fixture: noteSurfaced monkeypatched to throw');
  };
  let threw = null;
  let pull = null;
  try {
    pull = sensorsTool._internal.dispatchCandidateReaches('sess-soft-fail-throw', room.roomDir, {});
  } catch (e) {
    threw = e;
  } finally {
    surfacedOffers.noteSurfaced = originalNoteSurfaced;
  }
  check('soft-fail (thrown noteSurfaced): the pull never throws', threw === null, threw && (threw.message || String(threw)));
  check('soft-fail (thrown noteSurfaced): the pull still returns the fired reach', pull && eurekaReachesOf(pull.reaches).length === 1, JSON.stringify(pull));
}

// ---------------------------------------------------------------------------
// 9. CLI untouched: navigation-engine.cjs still calls markEurekaReachSurfaced
//    exactly once (this plan adds no second call site there).
// ---------------------------------------------------------------------------
function caseCliMarkUntouched() {
  process.stdout.write('\n-- CLI untouched: navigation-engine.cjs still calls markEurekaReachSurfaced exactly once --\n');
  const navEngineText = fs.readFileSync(path.join(REPO, 'lib', 'core', 'navigation-engine.cjs'), 'utf8');
  const lineHits = navEngineText.split('\n').filter((l) => l.indexOf('markEurekaReachSurfaced') !== -1).length;
  check('CLI untouched: markEurekaReachSurfaced appears on exactly one line of navigation-engine.cjs', lineHits === 1, String(lineHits));
}

// ---------------------------------------------------------------------------
// Run every case; a single async main so a rejection anywhere still exits
// non-zero (JS has no top-level await in a CJS file).
// ---------------------------------------------------------------------------
(async function main() {
  try {
    await caseWinnerNotedOnlyOnWin();
    await casePureReadNoWrites();
    await caseCloseOutFireOnceSequence();
    await caseStatedLimitAcceptedCost();
    caseBoundedEviction();
    await caseSoftFailReadOnlyMindrian();
    caseSoftFailUnwritableLedger();
    await caseSoftFailNoteSurfacedThrows();
    caseCliMarkUntouched();
  } catch (e) {
    console.error(e);
    checker.check('the suite ran to completion without an uncaught exception', false, e && (e.stack || e.message || String(e)));
  } finally {
    cleanupAllRooms();
  }

  check('net guard: zero fetch attempts across the whole suite', netGuard.attempts() === 0, String(netGuard.attempts()));
  netGuard.restore();

  const code = checker.summary();
  process.exit(code);
})();

void wasKeyPresent;
