#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * reach-sensor-relevance-gap B1 -- the reach-dial structural relevance gate.
 * =============================================================================
 * Root cause B (proven in .planning/debug/resolved/reach-sensor-relevance-gap.md):
 * the reach-dial render seam had NO structural relevance check. cross_room is a
 * permanent registry_only reach (always offered in a cold room); its {room_name}
 * was filled with the CURRENT room (borrow-from-self) and its content was never
 * compared to the live turn, so it surfaced a topically-disconnected room+claim
 * during an unrelated conversation (the observed iris2026 + claim:derive case).
 *
 * The fix has two halves, both proven here:
 *   1. buildDialSlotContext no longer borrows the current room into {room_name};
 *      the current room fills a dedicated header_room slot, and {room_name} holds
 *      only a genuinely DIFFERENT cross-room target (or nothing).
 *   2. a pure relevance gate (lib/hmi/reach-relevance-gate.cjs) drops off-topic
 *      cross_room rows through the existing suppressedReachIds path, and the render
 *      seam (renderEngineDecisionWithDial) wires it in.
 *
 * Node built-in assert only. Pure, in-memory. No em-dashes.
 */

const assert = require('node:assert');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const gate = require(path.join(REPO, 'lib', 'hmi', 'reach-relevance-gate.cjs'));
const ic = require(path.join(REPO, 'scripts', 'intent-classifier.cjs'));
const presenter = require(path.join(REPO, 'lib', 'hmi', 'dial-presenter.cjs'));

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

function reachIdsOf(reachList) {
  const rl = (reachList && Array.isArray(reachList.reaches)) ? reachList.reaches : [];
  return rl.map(function (r) { return r && r.reach_id; });
}

console.log('test-227-reach-relevance-gate.cjs (reach-sensor-relevance-gap B1)');

// ---------------------------------------------------------------------------
// Leg 1 UNIT: computeOffTopicReachIds -- the pure relevance gate.
// ---------------------------------------------------------------------------
check('leg 1a: off-topic cross_room WITH NO resolved target is suppressed', () => {
  // Cold room: no cross-room target slot -> nowhere to reach -> suppress.
  const out = gate.computeOffTopicReachIds({
    slotContext: { header_room: 'iris2026', topic: 'claim:derive:5c15cde4' },
    liveTurnText: 'we are testing the windows update installer reboot behavior',
    currentRoomName: 'iris2026',
  });
  assert.deepStrictEqual(out, ['cross_room'], 'target-less cross_room is suppressed');
});

check('leg 1b: cross_room with a DIFFERENT target that OVERLAPS the live turn is KEPT', () => {
  const out = gate.computeOffTopicReachIds({
    slotContext: { header_room: 'iris2026', room_name: 'pricing-peers', topic: 'Pricing Tiers' },
    liveTurnText: 'let us revisit the pricing tiers and discount schedule',
    currentRoomName: 'iris2026',
  });
  assert.deepStrictEqual(out, [], 'a topically-relevant cross-room target is NOT suppressed');
});

check('leg 1c: cross_room with a different target that is OFF-TOPIC is suppressed', () => {
  const out = gate.computeOffTopicReachIds({
    slotContext: { header_room: 'iris2026', room_name: 'sourdough-bakery', topic: 'Oven Schedule' },
    liveTurnText: 'we are testing the windows update installer reboot behavior',
    currentRoomName: 'iris2026',
  });
  assert.deepStrictEqual(out, ['cross_room'], 'an off-topic cross-room target is suppressed');
});

check('leg 1d: a borrow-from-self target (== current room) is suppressed', () => {
  const out = gate.computeOffTopicReachIds({
    slotContext: { header_room: 'iris2026', room_name: 'iris2026', topic: 'iris2026' },
    liveTurnText: 'talk about iris2026 project planning today',
    currentRoomName: 'iris2026',
  });
  assert.deepStrictEqual(out, ['cross_room'], 'a target equal to the current room is not a cross-room reach');
});

check('leg 1e: NO live turn -> no-op (byte-identical to pre-B1 render)', () => {
  const out = gate.computeOffTopicReachIds({
    slotContext: { header_room: 'iris2026', topic: 'claim:derive' },
    liveTurnText: '',
    currentRoomName: 'iris2026',
  });
  assert.deepStrictEqual(out, [], 'empty live turn suppresses nothing');
});

// ---------------------------------------------------------------------------
// Leg 2 UNIT: buildDialSlotContext -- borrow-from-self is gone.
// ---------------------------------------------------------------------------
check('leg 2a: the current room fills header_room, never cross_room {room_name}', () => {
  const slots = ic.buildDialSlotContext(
    { relevantNodes: [{ id: 'claim:derive:5c15cde4' }] },
    '/home/user/rooms/iris2026'
  );
  assert.strictEqual(slots.header_room, 'iris2026', 'header_room is the current room');
  assert.ok(!('room_name' in slots), 'room_name is NOT the current room (no borrow-from-self)');
});

check('leg 2b: a cross-room graph node fills room_name with the DIFFERENT room', () => {
  const slots = ic.buildDialSlotContext(
    { relevantNodes: [{ id: 'Pricing Tiers' }, { id: 'cross_room:pricing-peers' }] },
    '/home/user/rooms/iris2026'
  );
  assert.strictEqual(slots.room_name, 'pricing-peers', 'room_name is the genuinely different target');
  assert.strictEqual(slots.header_room, 'iris2026', 'header_room stays the current room');
});

// ---------------------------------------------------------------------------
// Leg 3 INTEGRATION: the render seam drops off-topic cross_room; keeps a
// relevant one. We spy renderDial to capture the reachList handed to it.
// ---------------------------------------------------------------------------
function engineDecisionFixture() {
  return { fire_skill: 'discover', suppress_skills: [], decision_trace: { brain_md_tier_mode: 'tier_0' } };
}

function captureRenderedReachList(ctx) {
  const orig = presenter.renderDial;
  let captured = null;
  presenter.renderDial = function (reachList, opts) {
    captured = reachList;
    return orig(reachList, opts);
  };
  try {
    ic.renderEngineDecisionWithDial(engineDecisionFixture(), { source: 'engine' }, '', ctx);
  } finally {
    presenter.renderDial = orig;
  }
  return captured;
}

check('leg 3a: cold room + off-topic live turn -> cross_room is DROPPED from the dial', () => {
  const reachList = captureRenderedReachList({
    cortexNodes: [],
    roomContext: { relevantNodes: [] },
    roomDir: '/home/user/rooms/iris2026',
    liveTurnText: 'we are testing the windows update installer reboot behavior',
  });
  const ids = reachIdsOf(reachList);
  assert.ok(ids.indexOf('cross_room') === -1,
    'cross_room must NOT surface for an unrelated live conversation (got: ' + JSON.stringify(ids) + ')');
});

check('leg 3b: a genuinely different, relevant target -> cross_room is KEPT', () => {
  const reachList = captureRenderedReachList({
    cortexNodes: [],
    roomContext: { relevantNodes: [{ id: 'Pricing Tiers' }, { id: 'cross_room:pricing-peers' }] },
    roomDir: '/home/user/rooms/iris2026',
    liveTurnText: 'let us revisit the pricing tiers before the renewal',
  });
  const ids = reachIdsOf(reachList);
  assert.ok(ids.indexOf('cross_room') !== -1,
    'cross_room stays when it resolves a relevant different room (got: ' + JSON.stringify(ids) + ')');
});

check('leg 3c: NO live turn -> cross_room present (no-op, byte-identical to pre-B1)', () => {
  const reachList = captureRenderedReachList({
    cortexNodes: [],
    roomContext: { relevantNodes: [] },
    roomDir: '/home/user/rooms/iris2026',
    liveTurnText: '',
  });
  const ids = reachIdsOf(reachList);
  assert.ok(ids.indexOf('cross_room') !== -1,
    'with no live turn the gate is inert and cross_room renders as before');
});

console.log('');
console.log('PASS test-227-reach-relevance-gate.cjs (' + passed + ' checks)');
process.exit(0);
