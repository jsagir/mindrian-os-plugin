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

  // Unit half: the pure helper resolves header_room + topic and degrades to {}.
  // reach-sensor-relevance-gap B1: the CURRENT room now fills `header_room` (the
  // decision-gate header context label), NOT `room_name` -- `room_name` is reserved
  // for the cross_room reach's genuinely DIFFERENT target, so cross_room can never
  // borrow the current room into its slot (the borrow-from-self defect).
  const slots = ic.buildDialSlotContext(
    { relevantNodes: [{ id: 'Pricing Model' }] },
    '/home/user/rooms/my-room'
  );
  ok(slots && slots.header_room === 'my-room', 'header_room resolves from roomDir basename (header context label)');
  ok(slots && !('room_name' in slots), 'room_name is NOT the current room (no cross_room borrow-from-self)');
  ok(slots && slots.topic === 'Pricing Model', 'topic resolves from relevantNodes top entry');
  const emptySlots = ic.buildDialSlotContext(null, null);
  ok(emptySlots && Object.keys(emptySlots).length === 0, 'null input degrades to {}');
  ok(!('framework' in slots), 'framework slot is never set (egress-audited, composer-owned)');

  // B1: a graph node that references a DIFFERENT room fills room_name with that
  // genuinely different target (never the current room).
  const xslots = ic.buildDialSlotContext(
    { relevantNodes: [{ id: 'cross_room:pricing-peers' }] },
    '/home/user/rooms/my-room'
  );
  ok(xslots && xslots.room_name === 'pricing-peers',
    'a cross_room:<slug> node resolves room_name to the DIFFERENT target room');
  ok(xslots && xslots.header_room === 'my-room', 'header_room stays the current room alongside a cross-room target');

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
  ok(block.indexOf('[FIRE-IF-FORK:') === -1, '251-01: imperative moved to SessionStart doctrine (was: block carries the FIRE-IF-FORK line, E1/210-05)');

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
  ok(block.indexOf('[FIRE-IF-FORK:') === -1, '251-01: imperative moved to SessionStart doctrine (was: tier_0 carries the binding)');
})();

// ---------------------------------------------------------------------------
// Test 5 (E4): emitBindingGate carries zones.footer, the AskUserQuestion marker,
// the BINDING line, and names AskUserQuestion in its guidance sentence.
//
// emitBindingGate writes its envelope to stdout as JSON; capture stdout for the
// duration of the call and parse the additionalContext back out.
// ---------------------------------------------------------------------------
function captureStdout(fn) {
  const chunks = [];
  const orig = process.stdout.write;
  process.stdout.write = function (chunk) { chunks.push(String(chunk)); return true; };
  let ret;
  try {
    ret = fn();
  } finally {
    process.stdout.write = orig;
  }
  return { ret: ret, out: chunks.join('') };
}

(function testE4BindingGateTrailer() {
  process.stdout.write('Test 5 (E4): emitBindingGate carries footer + trailer + AskUserQuestion guidance\n');
  const args = {
    best: { name: 'Pricing Room', nameMatch: true, entityMatches: 2 },
    scored: [
      { name: 'Pricing Room', score: 0.8 },
      { name: 'Strategy Room', score: 0.4 },
    ],
    sealedRooms: [],
    roomDir: null,
    sessionId: null,
  };
  const captured = captureStdout(function () { return ic.emitBindingGate(args); });
  ok(captured.ret === true, 'emitBindingGate returns true on a clean render');

  let additionalContext = '';
  try {
    const env = JSON.parse(captured.out.trim().split('\n').pop());
    additionalContext = (env.hookSpecificOutput && env.hookSpecificOutput.additionalContext) || '';
  } catch (_e) {
    additionalContext = captured.out;
  }
  ok(additionalContext.indexOf('[AskUserQuestion contract:') !== -1, 'additionalContext carries the marker');
  ok(additionalContext.indexOf('[FIRE-IF-FORK:') !== -1, 'additionalContext carries the FIRE-IF-FORK line');
  ok(additionalContext.indexOf('AskUserQuestion') !== -1, 'guidance names the AskUserQuestion tool');
  ok(additionalContext.indexOf('remember for this session') !== -1, 'guidance keeps the session-toggle sentence');
})();

// ---------------------------------------------------------------------------
// Test 6 (E4 degrade): a renderShapeF8 fault still returns false (legacy
// advisory degrade unchanged). Force the fault by stubbing the renderer.
// ---------------------------------------------------------------------------
(function testE4Degrade() {
  process.stdout.write('Test 6 (E4 degrade): a render fault returns false\n');
  const rendererPath = path.join(__dirname, '..', 'lib', 'hmi', 'shape-f8-renderer.cjs');
  const renderer = require(rendererPath);
  const orig = renderer.renderShapeF8;
  renderer.renderShapeF8 = function () { throw new Error('simulated F.8 fault'); };
  let ret = null;
  try {
    const captured = captureStdout(function () {
      return ic.emitBindingGate({
        best: { name: 'Pricing Room', nameMatch: true, entityMatches: 2 },
        scored: [{ name: 'Pricing Room', score: 0.8 }],
        sealedRooms: [],
        roomDir: null,
        sessionId: null,
      });
    });
    ret = captured.ret;
  } finally {
    renderer.renderShapeF8 = orig;
  }
  ok(ret === false, 'a renderShapeF8 fault degrades to false (legacy advisory)');
})();

// ---------------------------------------------------------------------------

if (failures > 0) {
  process.stdout.write('\n' + failures + ' assertion(s) FAILED\n');
  process.exit(1);
}
process.stdout.write('\nAll engine-arm contract assertions passed.\n');
process.exit(0);
