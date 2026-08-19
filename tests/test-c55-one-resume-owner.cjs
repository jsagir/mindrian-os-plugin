#!/usr/bin/env node
'use strict';
// Quick task 260819-c55 -- one resume owner for a material_step gate.
//
// The defect this file closes: gate_answer and chain_run's own gateAnswer
// path both consumed the SAME single-use gate-ledger entry
// (lib/mcp/gate-ledger.cjs deletes on lookup), but only chain_run's own
// direct path (_resumeFromGateAnswer) ever ran entry.onStepFn -- gate_answer
// wrote a gate_answer memory_event and returned, never touching onStepFn,
// haltedStep, or restSteps. So the documented two-step flow (ratify via
// gate_answer, then thread {gate_id, chosen, verdict} back into chain_run)
// always died: gate_answer burned the entry, and chain_run's own resume
// answered unknown_or_expired_gate for the already-consumed id. The halted
// material step was stranded forever, and the two existing test suites
// (test-238-one-ledger.cjs, test-237-approve-executes.cjs) each pinned only
// their own half of the ledger, so neither noticed.
//
// Now gate_answer delegates to the SAME ledger entry's own resumeFn (a
// function reference minted by chain.cjs at halt time, invoked here without
// ever requiring chain.cjs -- see chain.cjs's own doctrine comment above
// resumeEntry.resumeFn's assignment). The single-use ledger stays untouched
// and becomes the double-execution guard this file pins: because the halted
// step may be irreversible, an honest refusal on replay is the required
// behavior, not a re-run. This file drives all four interleavings of the
// two resume verbs against ONE gate_id each, asserting the execution
// counter BY VALUE, not by response-field truthiness -- a response can claim
// executed:true while nothing ran, which is the precise defect class this
// repo already paid for (see test-237-approve-executes Leg 7).
//
// Harness idioms reused verbatim from tests/test-238-one-ledger.cjs (per
// this plan's own instruction not to reinvent them): the makeFakeServer()
// handler-capture seam (the real 4-arg server.tool shape), the
// fs.mkdtempSync scratch room with a room-db bootstrap via
// lib/core/room-db.cjs::openRoomDb, the CLAUDE_ACTIVE_ROOM /
// CLAUDE_CODE_SESSION_ID save-and-restore block, the alwaysHaltPosture
// fixture, and the plain-node ok(desc, fn) counter with a trailing PASS
// line. gate_answer is driven through its REGISTERED handler captured off
// the fake server; the direct path is driven through
// chain.chainRun(null, {gateAnswer}) -- the exact two seams a real caller
// uses (chain_run's own registered tool handler calls chain.chainRun
// internally; see lib/mcp/tools/chain.cjs's register()).
//
// Node built-in assert/strict only. No framework, no em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const chain = require(path.join(REPO, 'lib', 'mcp', 'tools', 'chain.cjs'));
const gateModule = require(path.join(REPO, 'lib', 'mcp', 'tools', 'gate.cjs'));
const gateRender = require(path.join(REPO, 'lib', 'mcp', 'gate-render.cjs'));

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-c55-one-resume-owner');

// ---------------------------------------------------------------------------
// The fake-MCP-server handler-capture seam (test-198-contract-schema.test.cjs
// precedent, already reused by tests/test-238-one-ledger.cjs).
// ---------------------------------------------------------------------------
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
      if (registered.some((r) => r.name === name)) {
        throw new Error('DUPLICATE_TOOL_NAME: ' + name);
      }
      registered.push({ name, description, schema, handler });
    },
    _registered: registered,
    server: {
      getClientCapabilities() { return {}; }, // no elicitation -> headless/askuserquestion rungs
    },
  };
}

// ---------------------------------------------------------------------------
// Hermetic scratch room (fs.mkdtempSync, torn down in finally).
// ---------------------------------------------------------------------------
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-c55-one-resume-owner-'));
const roomDir = path.join(home, 'room');
fs.mkdirSync(roomDir, { recursive: true });

const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const bootHandle = roomDb.openRoomDb(roomDir); // creates .mindrian/room.db + schema
roomDb.closeRoomDb(bootHandle);

const previousActiveRoom = process.env.CLAUDE_ACTIVE_ROOM;
const previousSessionEnv = process.env.CLAUDE_CODE_SESSION_ID;
process.env.CLAUDE_ACTIVE_ROOM = roomDir;
delete process.env.CLAUDE_CODE_SESSION_ID;

// A postureFn that always halts step 1 as a material step -- the halt
// CONTROL FLOW is what this file proves, not posture classification (that
// is tests/test-198-chain-run-halt.test.cjs's own concern, run separately).
function alwaysHaltPosture() {
  return { autonomous_safe: false, posture: 'halt' };
}

function buildSteps() {
  return [{ step: 1, framework: 'fixture-c55-material', command: null, optional: false }];
}

(async function main() {
  try {
    const fakeServer = makeFakeServer();
    const ctx = { fallbackRoomDir: roomDir, surface: 'cli' };
    gateModule.register(fakeServer, ctx);
    const gateAnswerEntry = fakeServer._registered.find((r) => r.name === 'gate_answer');
    assert.ok(gateAnswerEntry, 'gate_answer must be registered on the fake server');

    async function answerGate(gateId, chosen, verdict) {
      const res = await gateAnswerEntry.handler(
        { gate_id: gateId, chosen: chosen, verdict: verdict || 'approve' },
        {} // no extra.sessionId -> resolveEffectiveSessionId falls to null, same NO_SESSION_PREFIX+pid key chainRun's own default (sessionId undefined) resolves to
      );
      const parsed = JSON.parse(res.content[0].text);
      parsed._isError = !!res.isError;
      return parsed;
    }

    async function resumeViaChainRun(gateId, chosen, verdict) {
      const gateAnswer = gateRender.normalizeGateAnswer(gateId, chosen, verdict || 'approve');
      return chain.chainRun(null, { gateAnswer: gateAnswer });
    }

    // -------------------------------------------------------------------
    // mintHaltedGate() -- ONE fresh halted chain + its OWN execution-witness
    // counter, so one interleaving case cannot contaminate another.
    // -------------------------------------------------------------------
    async function mintHaltedGate() {
      const counter = { n: 0 };
      async function onStep(_step, _prev) {
        counter.n += 1;
        return { chain_output: { ran: true, at: counter.n } };
      }
      const haltResult = await chain.chainRun(buildSteps(), {
        roomDir: roomDir,
        onStep: onStep,
        postureFn: alwaysHaltPosture,
        gateRenderCtx: {},
        // sessionId deliberately omitted (undefined) -- resolves to the same
        // process-scoped NO_SESSION_PREFIX+pid ledger key gate_answer's own
        // resolveEffectiveSessionId(undefined, {}) resolves to above.
      });
      assert.equal(haltResult.halted, true, 'FIXTURE: chainRun halted at the material step');
      const gateId = haltResult.gate && haltResult.gate.gate_id;
      assert.equal(typeof gateId, 'string', 'FIXTURE: chainRun returned a string gate id');
      assert.ok(gateId.length > 0, 'FIXTURE: the minted gate id is non-empty');
      return { gateId: gateId, counter: counter };
    }

    // -------------------------------------------------------------------
    // Interleaving A: gate_answer then chain_run.
    // -------------------------------------------------------------------
    {
      const { gateId, counter } = await mintHaltedGate();
      const first = await answerGate(gateId, ['approve'], 'approve');
      const second = await resumeViaChainRun(gateId, ['approve'], 'approve');

      ok('Interleaving A (gate_answer then chain_run): the FIRST caller (gate_answer) reports success', function () {
        assert.equal(first.ok, true, 'gate_answer must report ok:true for the first (winning) consumer');
      });
      ok('Interleaving A: the SECOND caller (chain_run) is refused with unknown_or_expired_gate', function () {
        assert.equal(second.ok, false, 'chain_run must refuse the already-consumed gate_id');
        assert.equal(second.reason, 'unknown_or_expired_gate', 'the refusal reason must be exactly unknown_or_expired_gate');
      });
      ok('Interleaving A: the execution counter equals exactly 1 (no double execution)', function () {
        assert.equal(counter.n, 1, 'the halted step must execute exactly once across both callers');
      });
    }

    // -------------------------------------------------------------------
    // Interleaving B: chain_run then gate_answer.
    // -------------------------------------------------------------------
    {
      const { gateId, counter } = await mintHaltedGate();
      const first = await resumeViaChainRun(gateId, ['approve'], 'approve');
      const second = await answerGate(gateId, ['approve'], 'approve');

      ok('Interleaving B (chain_run then gate_answer): the FIRST caller (chain_run) reports success', function () {
        assert.equal(first.ok, true, 'chain_run must report ok:true for the first (winning) consumer');
      });
      ok('Interleaving B: the SECOND caller (gate_answer) is refused with unknown_or_expired_gate', function () {
        assert.equal(second.ok, false, 'gate_answer must refuse the already-consumed gate_id');
        assert.equal(second.reason, 'unknown_or_expired_gate', 'the refusal reason must be exactly unknown_or_expired_gate');
      });
      ok('Interleaving B: the execution counter equals exactly 1 (no double execution)', function () {
        assert.equal(counter.n, 1, 'the halted step must execute exactly once across both callers');
      });
    }

    // -------------------------------------------------------------------
    // Interleaving C: gate_answer twice.
    // -------------------------------------------------------------------
    {
      const { gateId, counter } = await mintHaltedGate();
      const first = await answerGate(gateId, ['approve'], 'approve');
      const second = await answerGate(gateId, ['approve'], 'approve');

      ok('Interleaving C (gate_answer twice): the FIRST call reports success', function () {
        assert.equal(first.ok, true, 'the first gate_answer call must report ok:true');
      });
      ok('Interleaving C: the SECOND call is refused with unknown_or_expired_gate', function () {
        assert.equal(second.ok, false, 'the second gate_answer call must refuse the consumed gate_id');
        assert.equal(second.reason, 'unknown_or_expired_gate', 'the refusal reason must be exactly unknown_or_expired_gate');
      });
      ok('Interleaving C: the execution counter equals exactly 1 (no double execution)', function () {
        assert.equal(counter.n, 1, 'the halted step must execute exactly once across both gate_answer calls');
      });
    }

    // -------------------------------------------------------------------
    // Interleaving D: chain_run twice.
    // -------------------------------------------------------------------
    {
      const { gateId, counter } = await mintHaltedGate();
      const first = await resumeViaChainRun(gateId, ['approve'], 'approve');
      const second = await resumeViaChainRun(gateId, ['approve'], 'approve');

      ok('Interleaving D (chain_run twice): the FIRST call reports success', function () {
        assert.equal(first.ok, true, 'the first chain_run resume call must report ok:true');
      });
      ok('Interleaving D: the SECOND call is refused with unknown_or_expired_gate', function () {
        assert.equal(second.ok, false, 'the second chain_run resume call must refuse the consumed gate_id');
        assert.equal(second.reason, 'unknown_or_expired_gate', 'the refusal reason must be exactly unknown_or_expired_gate');
      });
      ok('Interleaving D: the execution counter equals exactly 1 (no double execution)', function () {
        assert.equal(counter.n, 1, 'the halted step must execute exactly once across both chain_run calls');
      });
    }

    // -------------------------------------------------------------------
    // Reject through gate_answer: zero executions, and the gate is still
    // burned (a follow-up answer to the same gate_id is refused).
    // -------------------------------------------------------------------
    {
      const { gateId, counter } = await mintHaltedGate();
      const rejectAnswer = await answerGate(gateId, ['reject'], 'reject');
      const followUp = await answerGate(gateId, ['approve'], 'approve');

      ok('Reject through gate_answer: the material step does NOT execute (counter equals 0)', function () {
        assert.equal(counter.n, 0, 'a reject verdict must leave the halted step unexecuted');
      });
      ok('Reject through gate_answer: chain_result reports executed:false', function () {
        assert.equal(rejectAnswer.resumed, true, 'a material_step gate_answer must set resumed:true even on reject');
        assert.ok(rejectAnswer.chain_result, 'a material_step gate_answer must carry chain_result');
        assert.equal(rejectAnswer.chain_result.executed, false, 'chain_result.executed must be false for a reject verdict');
      });
      ok('Reject through gate_answer: the gate is still burned (a follow-up answer is unknown_or_expired_gate)', function () {
        assert.equal(followUp.ok, false, 'a follow-up answer to a rejected (but consumed) gate_id must fail');
        assert.equal(followUp.reason, 'unknown_or_expired_gate', 'the follow-up refusal reason must be exactly unknown_or_expired_gate');
      });
    }

    // -------------------------------------------------------------------
    // Anti-vacuity control: a never-minted gate_id is refused by BOTH
    // verbs. Without this, a consume path that accepted everything would
    // pass every case above.
    // -------------------------------------------------------------------
    {
      const neverMinted = 'gate-c55-never-minted-' + Date.now();
      const viaGateAnswer = await answerGate(neverMinted, ['approve'], 'approve');
      const viaChainRun = await resumeViaChainRun(neverMinted, ['approve'], 'approve');

      ok('Anti-vacuity control: gate_answer refuses a never-minted gate_id', function () {
        assert.equal(viaGateAnswer.ok, false, 'gate_answer must refuse a fabricated id');
        assert.equal(viaGateAnswer.reason, 'unknown_or_expired_gate', 'the refusal reason must be exactly unknown_or_expired_gate');
      });
      ok('Anti-vacuity control: chain_run refuses a never-minted gate_id', function () {
        assert.equal(viaChainRun.ok, false, 'chain_run must refuse a fabricated id');
        assert.equal(viaChainRun.reason, 'unknown_or_expired_gate', 'the refusal reason must be exactly unknown_or_expired_gate');
      });
    }

    console.log(`PASS test-c55-one-resume-owner (${n} assertions)`);
    process.exit(0);
  } catch (e) {
    console.error('FAIL: test-c55-one-resume-owner -- ' + (e && e.stack ? e.stack : String(e)));
    process.exitCode = 1;
  } finally {
    if (previousActiveRoom === undefined) delete process.env.CLAUDE_ACTIVE_ROOM; else process.env.CLAUDE_ACTIVE_ROOM = previousActiveRoom;
    if (previousSessionEnv === undefined) delete process.env.CLAUDE_CODE_SESSION_ID; else process.env.CLAUDE_CODE_SESSION_ID = previousSessionEnv;
    try { fs.rmSync(home, { recursive: true, force: true }); } catch (_e) { /* best-effort cleanup */ }
  }
})();
