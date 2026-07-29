'use strict';
// Phase 238-04 (GATE-01 G-2, chain side) -- proves the chain_run resume path
// actually reads `chosen` and rejects both an out-of-card value and a
// cross-session answer BEFORE the halted material step runs. Before this
// plan, `_resumeFromGateAnswer` read only the gate id and the verdict --
// `chosen` was accepted on the wire and never checked at all, so
// verdict:approve with ANY arbitrary `chosen` executed the halted step.
//
// The single most important assertion in every reject case here is a
// SIDE-EFFECT COUNT (the onStep invocation counter), not a return shape.
// Asserting only the returned `reason` would let a version that rejects
// AFTER executing pass every case -- the counter is the only thing that
// proves the halted material step never ran.
//
// Plain-Node harness (tests/test-209-backstop-tuning.cjs shape): assert,
// a local ok(desc, fn) counter, a leading log of the test name, a trailing
// PASS line. No framework.
//
// MUTATION GATE (SC1 named leg, chain path):
//   (a) Commenting out the `validateChosenAgainstCard` reject in
//       `_resumeFromGateAnswer` (lib/mcp/tools/chain.cjs) turns Case 2 red:
//       the fabricated `chosen` would then fall through to the verdict
//       branch and execute the halted material step.
//   (b) Removing the session-mismatch comparison (the
//       `entry.ok === false && entry.reason === 'session_mismatch'` guard,
//       which depends on `consumeGate`'s own session-key check) turns
//       Case 4 red: a foreign session's resume would then execute the
//       MINTING session's material step in the MINTING session's room,
//       using the MINTING session's onStepFn.
// The executor physically performed both mutations one at a time, ran this
// file after each, observed exactly the named case fail, restored
// lib/mcp/tools/chain.cjs byte-identically (confirmed by an empty
// `git diff --stat lib/mcp/tools/chain.cjs`), and re-ran to green. The full
// transcript (commands run and their observed output) is recorded in
// 238-04-SUMMARY.md -- this comment states the claim, the SUMMARY carries
// the proof.
//
// CJS only. No em-dashes.

const assert = require('node:assert/strict');

const chain = require('../lib/mcp/tools/chain.cjs');
const gateLedger = require('../lib/mcp/gate-ledger.cjs');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-238-chain-chosen-validation');

const ROOM_DIR = __dirname;

// A postureFn that always halts step 1 as a material step -- deterministic,
// independent of the real command registry (the halt-at-material CONTROL
// FLOW is what this file proves, not posture classification -- that is
// tests/test-198-chain-run-halt.test.cjs's own concern).
function alwaysHaltPosture() {
  return { autonomous_safe: false, posture: 'halt' };
}

function buildSteps() {
  return [{ step: 1, framework: 'fixture-material', command: null, optional: false }];
}

/**
 * startHalt(sessionId) -> mints a fresh halt for `sessionId` through the
 * REAL chainRun (not a hand-built ledger entry), so the mint side (Task 1)
 * and the resume side (Task 2) are both exercised end to end. Returns the
 * gate id, the minted card (peeked non-destructively off the shared
 * ledger -- `Map.get` does not consume), and a counter object whose `.n`
 * increments every time the halted material step actually runs.
 */
async function startHalt(sessionId) {
  const counter = { n: 0 };
  async function onStep(_step, _prev) {
    counter.n += 1;
    return { chain_output: { ran: true } };
  }
  const result = await chain.chainRun(buildSteps(), {
    roomDir: ROOM_DIR,
    sessionId: sessionId,
    onStep: onStep,
    postureFn: alwaysHaltPosture,
    gateRenderCtx: {},
  });
  assert.equal(result.halted, true, 'FIXTURE: chainRun halted at the material step');
  const gateId = result.gate.gate_id;
  // Non-destructive peek: chain._internal._resumeLedger is the SAME Map
  // gate-ledger.cjs owns (proven live in 238-04-SUMMARY.md's identity
  // probe); Map.get never deletes.
  const peeked = chain._internal._resumeLedger.get(gateId);
  assert.ok(peeked && peeked.card, 'FIXTURE: the minted ledger entry carries the rendered card');
  return { gateId: gateId, card: peeked.card, counter: counter };
}

(async () => {
  // -------------------------------------------------------------------
  // Case 1: anti-vacuity control. A VALID chosen (an option id off the
  // returned card) with verdict approve must be ACCEPTED and the step must
  // actually run. Without this control, a resume path that rejected
  // everything would pass every other case in this file for the wrong
  // reason.
  // -------------------------------------------------------------------
  const c1 = await startHalt('sess-case1');
  const before1 = c1.counter.n;
  const resume1 = await chain.chainRun(null, {
    gateAnswer: { gate_id: c1.gateId, chosen: ['approve'], verdict: 'approve' },
    sessionId: 'sess-case1',
  });
  ok('Case 1 (anti-vacuity control): a valid chosen + approve executes the step', function () {
    assert.equal(resume1.executed, true);
    assert.equal(resume1.completed, true);
    assert.equal(c1.counter.n, before1 + 1);
  });

  // -------------------------------------------------------------------
  // Case 2: fabricated chosen, verdict approve. Must reject with
  // chosen_not_in_card_options AND leave the onStep counter UNCHANGED.
  // -------------------------------------------------------------------
  const c2 = await startHalt('sess-case2');
  const before2 = c2.counter.n;
  const resume2 = await chain.chainRun(null, {
    gateAnswer: { gate_id: c2.gateId, chosen: ['not-a-real-option-id'], verdict: 'approve' },
    sessionId: 'sess-case2',
  });
  ok('Case 2: a fabricated chosen is rejected (chosen_not_in_card_options) and the step does NOT run', function () {
    assert.equal(resume2.ok, false);
    assert.equal(resume2.reason, 'chosen_not_in_card_options');
    assert.equal(c2.counter.n, before2);
  });

  // -------------------------------------------------------------------
  // Case 3: label resolution. Resuming with the option LABEL (not the id)
  // must be accepted -- the fix must not narrow validateChosenAgainstCard's
  // own id-or-label contract.
  // -------------------------------------------------------------------
  const c3 = await startHalt('sess-case3');
  const approveOption = c3.card.options.find((o) => o.id === 'approve');
  assert.ok(approveOption && approveOption.label, 'FIXTURE: the card carries an approve option with a label');
  const before3 = c3.counter.n;
  const resume3 = await chain.chainRun(null, {
    gateAnswer: { gate_id: c3.gateId, chosen: [approveOption.label], verdict: 'approve' },
    sessionId: 'sess-case3',
  });
  ok('Case 3: resuming with the option LABEL instead of the id is accepted', function () {
    assert.equal(resume3.executed, true);
    assert.equal(c3.counter.n, before3 + 1);
  });

  // -------------------------------------------------------------------
  // Case 4: cross-session resume. Session A halts; session B resumes with
  // an otherwise valid payload. Must reject session_mismatch AND leave the
  // counter unchanged. The concrete harm this prevents: the resume entry
  // binds `roomDir` and `onStepFn` to the MINTING session, so without this
  // check a cross-session resume would run session A's material step in
  // session A's room, using session A's callbacks -- session B has no
  // business triggering that.
  // -------------------------------------------------------------------
  const c4 = await startHalt('sess-case4-A');
  const before4 = c4.counter.n;
  const resume4 = await chain.chainRun(null, {
    gateAnswer: { gate_id: c4.gateId, chosen: ['approve'], verdict: 'approve' },
    sessionId: 'sess-case4-B',
  });
  ok('Case 4: a cross-session resume is rejected (session_mismatch) and the step does NOT run', function () {
    assert.equal(resume4.ok, false);
    assert.equal(resume4.reason, 'session_mismatch');
    assert.equal(c4.counter.n, before4);
  });

  // -------------------------------------------------------------------
  // Case 5: single use. Any of the rejects above already consumed (deleted)
  // the ledger entry on lookup -- a follow-up correct resume of the SAME
  // gate id must return unknown_or_expired_gate, proving the entry was
  // burned even though it was rejected, not approved. Reusing Case 2's
  // already-rejected gate id.
  // -------------------------------------------------------------------
  const resume5 = await chain.chainRun(null, {
    gateAnswer: { gate_id: c2.gateId, chosen: ['approve'], verdict: 'approve' },
    sessionId: 'sess-case2',
  });
  ok('Case 5: a follow-up resume of an already-rejected gate id is unknown_or_expired_gate (single-use)', function () {
    assert.equal(resume5.ok, false);
    assert.equal(resume5.reason, 'unknown_or_expired_gate');
  });

  // -------------------------------------------------------------------
  // Case 6: missing-card degrade. A ledger entry hand-inserted with no
  // `card` at all (the shape a pre-238-04 mint would have left behind, or
  // any future minter that forgets to carry the card) must fail closed
  // with chosen_not_in_card_options rather than skip the check -- the
  // conservative direction per the verdict-cannot-be-overridden doctrine.
  // -------------------------------------------------------------------
  const c6counter = { n: 0 };
  async function onStep6(_step, _prev) {
    c6counter.n += 1;
    return { chain_output: { ran: true } };
  }
  gateLedger.mintGate('gate-238-04-case6-no-card', {
    haltedStep: { step: 1, command: null },
    restSteps: [],
    previousOutput: null,
    roomDir: ROOM_DIR,
    sessionId: 'sess-case6',
    onStepFn: onStep6,
    postureFn: alwaysHaltPosture,
    maxSteps: undefined,
    gateRenderCtx: {},
    kind: 'material_step',
    // no `card` key -- the degenerate case Task 2 must fail closed on.
  });
  const before6 = c6counter.n;
  const resume6 = await chain.chainRun(null, {
    gateAnswer: { gate_id: 'gate-238-04-case6-no-card', chosen: ['approve'], verdict: 'approve' },
    sessionId: 'sess-case6',
  });
  ok('Case 6: a ledger entry with no card fails closed (chosen_not_in_card_options), step does NOT run', function () {
    assert.equal(resume6.ok, false);
    assert.equal(resume6.reason, 'chosen_not_in_card_options');
    assert.equal(c6counter.n, before6);
  });

  console.log('\nPASS test-238-chain-chosen-validation (' + n + ' assertions)');
})().catch((e) => {
  console.error('FAIL: test-238-chain-chosen-validation -- ' + (e && e.stack || e));
  process.exit(1);
});
