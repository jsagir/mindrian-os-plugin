'use strict';

// Phase 209-01 regression proof for the engine-emission seam (RC-3).
//
// Covers three defects at two seams in scripts/intent-classifier.cjs:
//   E3 - renderDial was called with empty opts, so every dial row degraded to
//        the ELEVATION_DEFAULTS fallback instead of resolving {topic}/{room_name}
//        from the live room context.
//   E2 - the engine-arm concat returned base + text + marker only, dropping E1's
//        askuserquestion_binding line and never serializing the machine-readable
//        contract.
//   E4 - emitBindingGate excluded zones.footer, never carried the trailer, and
//        never named AskUserQuestion in its guidance.
//
// Pure: an in-memory reachList/decision fixture. No room.db, no network.

const path = require('path');
const ic = require(path.join(__dirname, '..', 'scripts', 'intent-classifier.cjs'));
const presenter = require(path.join(__dirname, '..', 'lib', 'hmi', 'dial-presenter.cjs'));

let failures = 0;
function ok(cond, label) {
  if (cond) {
    process.stdout.write('  PASS: ' + label + '\n');
  } else {
    failures += 1;
    process.stdout.write('  FAIL: ' + label + '\n');
  }
}

function engineDecisionFixture() {
  return {
    fire_skill: 'discover',
    suppress_skills: [],
    decision_trace: { brain_md_tier_mode: 'tier_0' },
  };
}

// ---------------------------------------------------------------------------
// Test 1 (E3): renderDial receives a non-empty opts.slotContext derived from
// the live room context (asserted via a stubbed presenter that captures opts).
// ---------------------------------------------------------------------------
(function testE3SlotContextThreaded() {
  process.stdout.write('Test 1 (E3): slotContext threaded into renderDial\n');

  // Unit half: the pure helper resolves room_name + topic and degrades to {}.
  const slots = ic.buildDialSlotContext(
    { relevantNodes: [{ id: 'Pricing Model' }] },
    '/home/user/rooms/my-room'
  );
  ok(slots && slots.room_name === 'my-room', 'room_name resolves from roomDir basename');
  ok(slots && slots.topic === 'Pricing Model', 'topic resolves from relevantNodes top entry');
  const emptySlots = ic.buildDialSlotContext(null, null);
  ok(emptySlots && Object.keys(emptySlots).length === 0, 'null input degrades to {}');
  ok(!('framework' in slots), 'framework slot is never set (egress-audited, composer-owned)');

  // Integration half: the engine arm passes that slotContext into renderDial.
  const orig = presenter.renderDial;
  let capturedOpts = null;
  presenter.renderDial = function (reachList, opts) {
    capturedOpts = opts;
    return orig(reachList, opts);
  };
  try {
    ic.renderEngineDecisionWithDial(
      engineDecisionFixture(),
      { source: 'engine' },
      '',
      { cortexNodes: [], roomContext: { relevantNodes: [{ id: 'Pricing Model' }] }, roomDir: '/home/user/rooms/my-room' }
    );
  } finally {
    presenter.renderDial = orig;
  }
  ok(
    capturedOpts && capturedOpts.slotContext && typeof capturedOpts.slotContext === 'object'
      && Object.keys(capturedOpts.slotContext).length > 0,
    'renderDial received a non-empty slotContext'
  );
  ok(
    capturedOpts && capturedOpts.slotContext && capturedOpts.slotContext.topic === 'Pricing Model',
    'the threaded slotContext carries the resolved topic'
  );
})();

// ---------------------------------------------------------------------------
// Test 2 (E2): the returned block carries the BINDING line AND a parseable
// machine-readable contract line.
// ---------------------------------------------------------------------------
(function testE2ContractSerialized() {
  process.stdout.write('Test 2 (E2): binding + serialized contract on the engine arm\n');
  const block = ic.renderEngineDecisionWithDial(
    engineDecisionFixture(),
    { source: 'engine' },
    '',
    { cortexNodes: [] }
  );
  ok(typeof block === 'string' && block.length > 0, 'block renders');
  ok(block.indexOf('[BINDING:') !== -1, 'block carries the BINDING line (E1, was dropped)');

  const m = block.match(/\[AskUserQuestion payload: (\{.*\})\]/);
  ok(!!m, 'block carries an [AskUserQuestion payload: {...}] contract line');
  if (m) {
    let parsed = null;
    let threw = false;
    try { parsed = JSON.parse(m[1]); } catch (_e) { threw = true; }
    ok(!threw && parsed && typeof parsed === 'object', 'contract JSON body parses');
    ok(parsed && Array.isArray(parsed.verbs), 'contract carries a verbs array');
  }
})();

// ---------------------------------------------------------------------------
// Test 3 (degrade): null roomContext still renders; a presenter fault returns
// the base block unchanged (existing try/catch preserved).
// ---------------------------------------------------------------------------
(function testDegrade() {
  process.stdout.write('Test 3 (degrade): faults never block the turn\n');
  const decision = engineDecisionFixture();
  const base = ic.formatEngineDecisionBlock(decision, { source: 'engine' }, '');

  const blockNoRoom = ic.renderEngineDecisionWithDial(decision, { source: 'engine' }, '', { cortexNodes: [], roomContext: null });
  ok(typeof blockNoRoom === 'string' && blockNoRoom.length > 0, 'null roomContext still returns a block, no throw');

  const orig = presenter.renderDial;
  presenter.renderDial = function () { throw new Error('simulated render fault'); };
  let faultBlock = null;
  try {
    faultBlock = ic.renderEngineDecisionWithDial(decision, { source: 'engine' }, '', { cortexNodes: [] });
  } finally {
    presenter.renderDial = orig;
  }
  ok(faultBlock === base, 'a presenter fault returns the base block unchanged');
})();

// ---------------------------------------------------------------------------
// Test 4 (DIAL-ATOM-01): a tier_0 arm still carries marker + binding (the
// trailer is never gated off).
// ---------------------------------------------------------------------------
(function testTier0TrailerNeverGated() {
  process.stdout.write('Test 4 (DIAL-ATOM-01): tier_0 still carries the trailer\n');
  const block = ic.renderEngineDecisionWithDial(
    engineDecisionFixture(),
    { source: 'engine' },
    '',
    { cortexNodes: [] }
  );
  ok(block.indexOf('[AskUserQuestion contract:') !== -1, 'tier_0 carries the marker');
  ok(block.indexOf('[BINDING:') !== -1, 'tier_0 carries the binding');
})();

// ---------------------------------------------------------------------------

if (failures > 0) {
  process.stdout.write('\n' + failures + ' assertion(s) FAILED\n');
  process.exit(1);
}
process.stdout.write('\nAll engine-arm contract assertions passed.\n');
process.exit(0);
