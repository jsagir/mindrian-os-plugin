'use strict';
// Phase 346-05 -- make the arbitration decision auditable: one logged row per
// turn, written through the navigation chokepoint, carrying enum tokens only,
// deduped, and recording whether the posture flipped (ARB-07/ARB-08).
//
// Three tasks land in this one file, in order:
//   Task 1: 'arbitration_decided' joins the frozen EVENT_TYPES Set.
//   Task 2: lib/core/navigation/arbitration-log.cjs -- the enum-only payload,
//     the dedupe key, the flip comparison.
//   Task 3: the one thin additive re-export on lib/core/navigation.cjs.
//
// Hermetic isolation (mirrors tests/test-209-incident-replay.cjs's own stated
// discipline): every test in this file opens its OWN fs.mkdtempSync temp
// room, via lib/core/room-db.cjs::openRoomDb, and closes + removes it in a
// finally block. This file NEVER touches a real room and NEVER touches
// ~/.mindrian/.
//
// House idiom: node:assert/strict, `let n = 0; function ok(desc, fn)`, final
// line '>>> test-346-arbitration-event.cjs: PASSED'.
//
// House rule: hyphens only, no em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const memoryEvents = require(path.join(REPO, 'lib', 'core', 'navigation', 'memory-events.cjs'));
const arbitrationLog = require(path.join(REPO, 'lib', 'core', 'navigation', 'arbitration-log.cjs'));
const arbitration = require(path.join(REPO, 'lib', 'core', 'arbitration.cjs'));

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

/**
 * Open a hermetic temp room.db, run fn(db), always clean up. Never touches a
 * real room and never touches ~/.mindrian/ (tests/test-209-incident-replay.cjs
 * discipline).
 * @param {(db: object) => void} fn
 */
function withHermeticRoom(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-346-arb-log-'));
  const handle = roomDb.openRoomDb(tmp);
  try {
    fn(handle.db || handle);
  } finally {
    roomDb.closeRoomDb(handle);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log('test-346-arbitration-event');

// ---------------------------------------------------------------------------
// Task 1: 'arbitration_decided' joins the frozen EVENT_TYPES Set.
// ---------------------------------------------------------------------------

ok('EVENT_TYPES is frozen and has arbitration_decided', function () {
  assert.ok(Object.isFrozen(memoryEvents.EVENT_TYPES));
  assert.ok(memoryEvents.EVENT_TYPES.has('arbitration_decided'));
});

ok('every event type that existed before this plan is still a member (named floor, not a count)', function () {
  const floor = [
    'node_created', 'edge_added', 'focus_changed', 'brain_suggestion_received',
    'tension_detected', 'auto_explore_fired', 'brain_cmdmap_divergence',
    'strategy_proposed', 'strategy_throttled',
  ];
  floor.forEach(function (t) {
    assert.ok(memoryEvents.EVENT_TYPES.has(t), 'missing pre-existing event type: ' + t);
  });
});

ok('logEvent(db, "arbitration_decided", {...}) returns ok:true against a real temp room.db', function () {
  withHermeticRoom(function (db) {
    const r = memoryEvents.logEvent(db, 'arbitration_decided', { foo: 'bar' });
    assert.equal(r.ok, true);
    assert.equal(typeof r.eventId, 'string');
  });
});

ok('logEvent rejects a near-miss typo ("arbitration_decide") -- the closed Set still rejects', function () {
  withHermeticRoom(function (db) {
    const r = memoryEvents.logEvent(db, 'arbitration_decide', { foo: 'bar' });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'invalid_event_type');
  });
});

// ---------------------------------------------------------------------------
// Task 2: lib/core/navigation/arbitration-log.cjs -- the enum-only payload,
// the dedupe key, the flip comparison.
// ---------------------------------------------------------------------------

ok('ARBITRATION_EVENT_TYPE is the string arbitration_decided', function () {
  assert.equal(arbitrationLog.ARBITRATION_EVENT_TYPE, 'arbitration_decided');
});

ok('buildArbitrationPayload returns a flat object of strings, numbers and booleans only', function () {
  const p = arbitrationLog.buildArbitrationPayload(arbitration.resolveArbitration({}), { sessionId: 's1', turnId: 't1' });
  Object.keys(p).forEach(function (k) {
    const v = p[k];
    assert.ok(typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean', 'key ' + k + ' is not a flat scalar: ' + typeof v);
  });
  assert.equal(p.dedupe_key, 'arb:s1:t1');
});

ok('every string value is a closed-vocabulary member, a dedupe_key, or session_id/turn_id', function () {
  const closed = []
    .concat(['ask_and_hedged', 'tell_and_hedged'])
    .concat(arbitration.DELIVERY_RATIONALES)
    .concat(['GUIDED', 'HYBRID', 'AUTONOMOUS'])
    .concat(arbitration.AUTONOMY_RATIONALES)
    .concat(arbitration.ENFORCEMENT_VALUES)
    .concat(arbitration.ENFORCEMENT_RATIONALES)
    .concat(arbitration.RANKED_ORDER)
    .concat(arbitration.ARBITRATION_INPUTS)
    .concat(arbitration.FLOOR_TOKENS)
    .concat([arbitration.ARBITRATION_VERSION])
    .concat(['no_prior_decision', 'prior_read_failed', 'axes_changed', 'hold'])
    .concat(arbitrationLog.SANITIZED_TOKENS)
    .concat(['system', 'system:arbitration']);
  const p = arbitrationLog.buildArbitrationPayload(arbitration.resolveArbitration({}), { sessionId: 's1', turnId: 't1' });
  const freePassKeys = ['ranked', 'inputs_read', 'inputs_missing', 'floors_applied', 'flipped_axes', 'dedupe_key', 'session_id', 'turn_id'];
  Object.keys(p).forEach(function (k) {
    if (typeof p[k] !== 'string') return;
    if (freePassKeys.indexOf(k) !== -1) {
      // comma-joined lists and identifiers: validated structurally, not by
      // direct closed-set membership of the whole string.
      return;
    }
    assert.ok(closed.indexOf(p[k]) !== -1, 'key ' + k + ' value "' + p[k] + '" is not in the closed vocabulary');
  });
});

ok('the payload carries no forbidden key name and does not leak a prose sentinel from an unexpected input key', function () {
  const CANARY = 'PROSE-LEAK-CANARY-4471';
  const p = arbitrationLog.buildArbitrationPayload(
    arbitration.resolveArbitration({ persona: CANARY, user_text: CANARY, evidence: CANARY, role_blend: { notes: CANARY } }),
    { sessionId: 's', turnId: 't' }
  );
  assert.equal(JSON.stringify(p).indexOf('CANARY'), -1);
  ['user_text', 'userText', 'transcript', 'prompt', 'jtbd', 'evidence', 'role_blend'].forEach(function (bad) {
    assert.equal(Object.prototype.hasOwnProperty.call(p, bad), false, 'forbidden key present: ' + bad);
  });
});

ok('logArbitrationDecision against a fresh temp room.db returns ok:true deduped:false flip:false and writes exactly one row', function () {
  withHermeticRoom(function (db) {
    const r = arbitrationLog.logArbitrationDecision(db, arbitration.resolveArbitration({}), { sessionId: 'sess-a', turnId: 'turn-1' });
    assert.equal(r.ok, true);
    assert.equal(r.deduped, false);
    assert.equal(r.flip, false);
    assert.deepEqual(r.flipped_axes, []);
    assert.equal(typeof r.eventId, 'string');
    const rows = memoryEvents.findRecentChanges(db, 0, { eventType: 'arbitration_decided' });
    assert.equal(rows.length, 1);
  });
});

ok('the first decision in a session reports flip:false with flip_reason no_prior_decision (a first turn is not a flip)', function () {
  withHermeticRoom(function (db) {
    const r = arbitrationLog.logArbitrationDecision(db, arbitration.resolveArbitration({}), { sessionId: 'sess-first', turnId: 'turn-1' });
    assert.equal(r.flip, false);
    assert.equal(r.flip_reason, 'no_prior_decision');
  });
});

ok('calling twice with the same sessionId and turnId inside the dedupe window writes one row (deduped:true on the second call)', function () {
  withHermeticRoom(function (db) {
    const r1 = arbitrationLog.logArbitrationDecision(db, arbitration.resolveArbitration({}), { sessionId: 'sess-b', turnId: 'turn-1' });
    const r2 = arbitrationLog.logArbitrationDecision(db, arbitration.resolveArbitration({}), { sessionId: 'sess-b', turnId: 'turn-1' });
    assert.equal(r1.ok, true);
    assert.equal(r2.ok, true);
    assert.equal(r2.deduped, true);
    const rows = memoryEvents.findRecentChanges(db, 0, { eventType: 'arbitration_decided' });
    assert.equal(rows.length, 1);
  });
});

ok('two different turnId values with identical axis values report flip:false flipped_axes:[] and write two rows', function () {
  withHermeticRoom(function (db) {
    const result = arbitration.resolveArbitration({});
    arbitrationLog.logArbitrationDecision(db, result, { sessionId: 'sess-c', turnId: 'turn-1' });
    const r2 = arbitrationLog.logArbitrationDecision(db, result, { sessionId: 'sess-c', turnId: 'turn-2' });
    assert.equal(r2.flip, false);
    assert.deepEqual(r2.flipped_axes, []);
    assert.equal(r2.flip_reason, 'hold');
    const rows = memoryEvents.findRecentChanges(db, 0, { eventType: 'arbitration_decided' });
    assert.equal(rows.length, 2);
  });
});

ok('a changed enforcement.value between two turns in the same session reports flip:true flipped_axes:["enforcement"]', function () {
  withHermeticRoom(function (db) {
    const resultA = { arbitration_version: arbitration.ARBITRATION_VERSION, delivery: { value: 'ask_and_hedged', rationale: 'cold_start_ask_first' }, autonomy: { value: 'GUIDED', rationale: 'cold_start_never_autonomous' }, enforcement: { value: 'judge', rationale: 'no_fork_reached' }, ranked: arbitration.RANKED_ORDER, inputs_read: [], inputs_missing: arbitration.ARBITRATION_INPUTS.slice(), floors_applied: ['part12_glyph', 'no_fabricated_numbers'] };
    const resultB = Object.assign({}, resultA, { enforcement: { value: 'enforce', rationale: 'floor_engaged_no_escape_hatch' } });
    arbitrationLog.logArbitrationDecision(db, resultA, { sessionId: 'sess-d', turnId: 'turn-1' });
    const r2 = arbitrationLog.logArbitrationDecision(db, resultB, { sessionId: 'sess-d', turnId: 'turn-2' });
    assert.equal(r2.flip, true);
    assert.deepEqual(r2.flipped_axes, ['enforcement']);
    assert.equal(r2.flip_reason, 'axes_changed');
  });
});

ok('changing two axes reports flipped_axes containing both, in RANKED_ORDER order', function () {
  withHermeticRoom(function (db) {
    const resultA = { arbitration_version: arbitration.ARBITRATION_VERSION, delivery: { value: 'ask_and_hedged', rationale: 'cold_start_ask_first' }, autonomy: { value: 'GUIDED', rationale: 'cold_start_never_autonomous' }, enforcement: { value: 'judge', rationale: 'no_fork_reached' }, ranked: arbitration.RANKED_ORDER, inputs_read: [], inputs_missing: arbitration.ARBITRATION_INPUTS.slice(), floors_applied: ['part12_glyph', 'no_fabricated_numbers'] };
    const resultB = Object.assign({}, resultA, {
      enforcement: { value: 'enforce', rationale: 'floor_engaged_no_escape_hatch' },
      autonomy: { value: 'HYBRID', rationale: 'mature_room_commit_gate' },
    });
    arbitrationLog.logArbitrationDecision(db, resultA, { sessionId: 'sess-e', turnId: 'turn-1' });
    const r2 = arbitrationLog.logArbitrationDecision(db, resultB, { sessionId: 'sess-e', turnId: 'turn-2' });
    assert.equal(r2.flip, true);
    assert.deepEqual(r2.flipped_axes, ['enforcement', 'autonomy']);
  });
});

ok('the flip comparison is scoped to session_id: a prior row from a different session is ignored', function () {
  withHermeticRoom(function (db) {
    const resultA = { arbitration_version: arbitration.ARBITRATION_VERSION, delivery: { value: 'ask_and_hedged', rationale: 'cold_start_ask_first' }, autonomy: { value: 'GUIDED', rationale: 'cold_start_never_autonomous' }, enforcement: { value: 'judge', rationale: 'no_fork_reached' }, ranked: arbitration.RANKED_ORDER, inputs_read: [], inputs_missing: arbitration.ARBITRATION_INPUTS.slice(), floors_applied: ['part12_glyph', 'no_fabricated_numbers'] };
    const resultB = Object.assign({}, resultA, { enforcement: { value: 'enforce', rationale: 'floor_engaged_no_escape_hatch' } });
    arbitrationLog.logArbitrationDecision(db, resultA, { sessionId: 'sess-f-1', turnId: 'turn-1' });
    const r2 = arbitrationLog.logArbitrationDecision(db, resultB, { sessionId: 'sess-f-2', turnId: 'turn-1' });
    assert.equal(r2.flip, false);
    assert.equal(r2.flip_reason, 'no_prior_decision');
  });
});

ok('logArbitrationDecision(null, result, opts) returns ok:false reason:no_db and does not throw', function () {
  const r = arbitrationLog.logArbitrationDecision(null, arbitration.resolveArbitration({}), { sessionId: 's', turnId: 't' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no_db');
});

ok('logArbitrationDecision(db, null, opts) returns ok:false reason:no_result and does not throw', function () {
  withHermeticRoom(function (db) {
    const r = arbitrationLog.logArbitrationDecision(db, null, { sessionId: 's', turnId: 't' });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'no_result');
  });
});

ok('a db whose prepare throws returns ok:false with a reason and does not throw', function () {
  const poisonedDb = { prepare() { throw new Error('poisoned'); } };
  const r = arbitrationLog.logArbitrationDecision(poisonedDb, arbitration.resolveArbitration({}), { sessionId: 's', turnId: 't' });
  assert.equal(r.ok, false);
  assert.equal(typeof r.reason, 'string');
});

ok('a result carrying a prose sentinel in an unexpected key never survives into JSON.stringify of the payload', function () {
  const CANARY = 'PROSE-LEAK-CANARY-9931';
  const hostileResult = { arbitration_version: arbitration.ARBITRATION_VERSION, delivery: { value: CANARY, rationale: CANARY }, autonomy: { value: CANARY, rationale: CANARY }, enforcement: { value: CANARY, rationale: CANARY }, ranked: [CANARY], inputs_read: [CANARY], inputs_missing: [CANARY], floors_applied: [CANARY], raw_transcript: CANARY };
  const p = arbitrationLog.buildArbitrationPayload(hostileResult, { sessionId: 's', turnId: 't' });
  assert.equal(JSON.stringify(p).indexOf('CANARY'), -1);
});

// ---------------------------------------------------------------------------
// Task 3: one thin additive re-export on the navigation chokepoint.
// ---------------------------------------------------------------------------

ok('lib/core/navigation.cjs re-exports logArbitrationDecision as the SAME reference', function () {
  const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
  assert.equal(typeof navigation.logArbitrationDecision, 'function');
  assert.equal(navigation.logArbitrationDecision, arbitrationLog.logArbitrationDecision);
});

ok('writing through navigation.logArbitrationDecision produces a row readable back through navigation.findRecentChanges', function () {
  const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
  withHermeticRoom(function (db) {
    const r = navigation.logArbitrationDecision(db, arbitration.resolveArbitration({}), { sessionId: 'sess-chokepoint', turnId: 'turn-1' });
    assert.equal(r.ok, true);
    const rows = navigation.findRecentChanges(db, 0, { eventType: 'arbitration_decided' });
    assert.equal(rows.length, 1);
  });
});

ok('a comment-stripped source scan of lib/core/arbitration.cjs finds no require of navigation in any form', function () {
  const src = fs.readFileSync(path.join(REPO, 'lib', 'core', 'arbitration.cjs'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.equal(/navigation/.test(src), false);
});

console.log(n + ' assertions passed');
console.log('>>> test-346-arbitration-event.cjs: PASSED');
process.exit(0);
