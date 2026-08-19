#!/usr/bin/env node
'use strict';
// Phase 238-06 (GATE-01 G-1) -- the SC1 proof: "mint id equals ratified id,
// asserted on a real chain run".
//
// This test crosses the module boundary for real. 238-RESEARCH.md's
// Pitfall 3 names exactly the trap this file must NOT fall into:
// tests/test-198-chain-run-halt.test.cjs passes today because it drives
// chainRun with a gate answer INTERNALLY and never crosses to gate_answer --
// a Phase 238 test written the same shape would pass even if the two
// ledgers were never joined. Case 1 below instead drives a REAL chain.cjs
// chainRun() to a real halt, captures the gate id chainRun returns, and
// hands that SAME id to gate_answer's REGISTERED tool handler -- the
// handler chain_run's own registered chain_run tool and the real MCP
// client both actually call, not gate.cjs's internal _consumeLiveGate
// helper directly.
//
// Handler seam used, and why: this plan's read_first pointed at
// tests/test-198-concurrency-mcp.test.cjs as the "harness seam that reaches
// a registered handler". Reading that file (see the require block below the
// header) shows it actually reaches lib/mcp/tool-router.cjs's internal
// _test.resolveWriteTargetDir export, not a genuine server.tool-registered
// MCP handler -- so that specific seam does not exist to copy. The seam
// that DOES genuinely drive a real, server.tool-registered handler in this
// repo is tests/test-198-contract-schema.test.cjs's makeFakeServer()
// (mirrors the real McpServer.tool(name, description, schemaShape, handler)
// 4-arg call shape), already reused by tests/test-238-chosen-validation.cjs
// (238-03) to drive gate.cjs's real gate_render/gate_answer handlers. This
// file reuses that same makeFakeServer() pattern rather than the
// test-198-concurrency-mcp.test.cjs one, per the plan's own fallback clause
// ("if that seam is impractical, fall back to gate.cjs's exported consume
// path against chain.cjs's minted id and say in a comment exactly which
// seam was used and why, so the SUMMARY does not overclaim").
//
// chain.cjs's own chainRun is driven directly via its module export
// (chain.chainRun), which is the EXACT function chain_run's registered tool
// handler calls internally (see lib/mcp/tools/chain.cjs's register()) --
// not a reimplementation of the halt/mint logic.
//
// Plain-Node harness (tests/test-209-backstop-tuning.cjs shape): assert,
// a local ok(desc, fn) counter, a leading log of the test name, a trailing
// PASS line. No framework.
//
// Node built-in assert/strict only. No em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const chain = require(path.join(REPO, 'lib', 'mcp', 'tools', 'chain.cjs'));
const gateModule = require(path.join(REPO, 'lib', 'mcp', 'tools', 'gate.cjs'));
const gateLedger = require(path.join(REPO, 'lib', 'mcp', 'gate-ledger.cjs'));

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-238-one-ledger');

// ---------------------------------------------------------------------------
// The fake-MCP-server handler-capture seam (test-198-contract-schema.test.cjs
// precedent, already reused by tests/test-238-chosen-validation.cjs).
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
// Hermetic scratch room (per plan: fs.mkdtempSync, torn down in finally).
// ---------------------------------------------------------------------------
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-238-one-ledger-'));
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
  return [{ step: 1, framework: 'fixture-material', command: null, optional: false }];
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

    // -------------------------------------------------------------------
    // Cases 1-3: drive a REAL chainRun to a real halt (chain.chainRun --
    // the same function chain_run's registered handler calls), capture the
    // minted gate id, then hand it to gate_answer's REGISTERED handler.
    // -------------------------------------------------------------------
    const stepCounter = { n: 0 };
    async function onStep(_step, _prev) {
      stepCounter.n += 1;
      return { chain_output: { ran: true } };
    }

    const haltResult = await chain.chainRun(buildSteps(), {
      roomDir: roomDir,
      onStep: onStep,
      postureFn: alwaysHaltPosture,
      gateRenderCtx: {},
      // sessionId deliberately omitted (undefined) -- resolves to the same
      // process-scoped NO_SESSION_PREFIX+pid ledger key gate_answer's own
      // resolveEffectiveSessionId(undefined, {}) resolves to below.
    });
    assert.equal(haltResult.halted, true, 'FIXTURE: chainRun halted at the material step');
    const mintedGateId = haltResult.gate.gate_id;
    assert.equal(typeof mintedGateId, 'string', 'FIXTURE: chainRun returned a string gate id');
    assert.ok(mintedGateId.length > 0, 'FIXTURE: the minted gate id is non-empty');

    // Case 2 (assert on ledger presence BEFORE the answer -- the shared
    // Map, not a return field).
    ok('the shared ledger holds the chain-minted id before gate_answer consumes it', function () {
      assert.equal(
        gateLedger._internal._ledger.has(mintedGateId), true,
        'gateLedger._internal._ledger.has(id) must be true before gate_answer runs'
      );
    });

    const answer = await answerGate(mintedGateId, ['approve'], 'approve');

    // Case 1: the identity assertion SC1 names. String equality on the two
    // ids, taken from two different modules' outputs (chain.cjs's chainRun
    // return value vs gate.cjs's gate_answer handler response), with both
    // ids printed in the assertion message.
    ok('the gate id chain.cjs minted equals the gate id gate.cjs\'s gate_answer echoes back', function () {
      assert.equal(
        answer.gate_id, mintedGateId,
        `mint id (chain.cjs) = "${mintedGateId}" must strictly equal ratified id (gate.cjs gate_answer) = "${answer.gate_id}"`
      );
    });

    // Case 3: the regression witness for the exact defect being fixed.
    // Before Phase 238 (238-RESEARCH.md Finding 1, live reproduction), this
    // exact call -- a chain-minted gate id handed to gate_answer -- returned
    // reason:'unknown_or_expired_gate', because gate.cjs's own private
    // _liveGates Map and chain.cjs's own private _resumeLedger Map were two
    // separate, never-joined ledgers.
    ok('gate_answer does NOT return unknown_or_expired_gate for a chain-minted id (238-RESEARCH.md Finding 1, now fixed)', function () {
      assert.notEqual(answer.reason, 'unknown_or_expired_gate', 'a chain-minted id must be consumable by gate_answer');
      assert.equal(answer.ok, true, 'the chain-minted id, correctly answered, must ratify');
    });

    // Quick task 260819-c55: the id-identity assertion above (Case 1) was
    // vacuous about whether the halted step actually ran -- it only proved
    // the two ids matched, which the OLD (broken) two-ledger world could
    // never have passed anyway, but says nothing about execution. Before
    // this quick task, gate_answer wrote a ratification memory_event and
    // returned; it never touched the entry's onStepFn, so stepCounter (the
    // injected onStep's own witness, declared above) was minted but never
    // asserted -- the exact strand this file was written to catch stayed
    // invisible to it. This is the half that was missing.
    ok('gate_answer executes the halted material step exactly once (the strand this file used to miss)', function () {
      assert.equal(stepCounter.n, 1, 'stepCounter.n must equal 1 -- the halted step must run exactly once through gate_answer');
      assert.equal(answer.resumed, true, 'a material_step gate_answer response must carry resumed:true');
      assert.equal(
        answer.chain_result && answer.chain_result.executed, true,
        'answer.chain_result.executed must be true -- the delegated resumeFn call actually ran the step'
      );
    });

    // Case 2 continued: after the answer, the ledger no longer holds the id
    // (single-use, proven on the shared Map itself, not on a response
    // field).
    ok('the shared ledger no longer holds the id after gate_answer consumes it (single-use, proven on the Map)', function () {
      assert.equal(
        gateLedger._internal._ledger.has(mintedGateId), false,
        'gateLedger._internal._ledger.has(id) must be false after gate_answer consumes it'
      );
    });

    // -------------------------------------------------------------------
    // Case 4: the reverse direction. A gate id minted by gate_render is
    // also consumable through the SAME shared ledger -- proving the join
    // did not simply move the break to the other side (gate_render mints,
    // gate_answer's own established path already covers gate.cjs-to-
    // gate.cjs; this leg additionally proves chain.cjs's OWN consume
    // wrapper, _consumeResumeLedger, can pull a gate_render-minted entry
    // out of the identical shared Map -- the low-level ledger identity,
    // not the higher-level resume payload shape, which is a separate
    // concern chain.cjs's own halt path already owns).
    // -------------------------------------------------------------------
    const fakeServer2 = makeFakeServer();
    gateModule.register(fakeServer2, ctx);
    const gateRenderEntry = fakeServer2._registered.find((r) => r.name === 'gate_render');
    assert.ok(gateRenderEntry, 'gate_render must be registered on the second fake server');
    const renderRes = await gateRenderEntry.handler(
      { options: [{ id: 'approve', label: 'Approve' }, { id: 'reject', label: 'Reject' }] },
      {}
    );
    const rendered = JSON.parse(renderRes.content[0].text);
    const renderedGateId = rendered.gate_id;
    ok('a gate id minted by gate_render is consumable through the SAME shared ledger via chain.cjs\'s own consume wrapper', function () {
      assert.equal(
        gateLedger._internal._ledger.has(renderedGateId), true,
        'FIXTURE: the gate_render-minted id must be present in the shared ledger before this assertion'
      );
      const consumed = chain._internal._consumeResumeLedger(renderedGateId, undefined);
      assert.ok(consumed, 'chain.cjs\'s _consumeResumeLedger must retrieve the gate_render-minted entry from the shared ledger');
      assert.equal(
        gateLedger._internal._ledger.has(renderedGateId), false,
        'after chain.cjs\'s own consume wrapper runs, the shared ledger no longer holds the id (one Map, not two)'
      );
    });

    // -------------------------------------------------------------------
    // Case 5: anti-vacuity control. An id that was never minted returns
    // unknown_or_expired_gate. Without this, a consume path that accepted
    // everything would pass every case above.
    // -------------------------------------------------------------------
    const neverMinted = await answerGate('gate-238-06-never-minted-' + Date.now(), ['approve'], 'approve');
    ok('an id that was never minted returns the exact slug unknown_or_expired_gate', function () {
      assert.equal(neverMinted.ok, false, 'a never-minted id must not ratify');
      assert.equal(neverMinted.reason, 'unknown_or_expired_gate', 'a never-minted id must report the exact unknown_or_expired_gate slug');
    });

    console.log(`PASS test-238-one-ledger (${n} assertions)`);
    process.exit(0);
  } catch (e) {
    console.error('FAIL: test-238-one-ledger -- ' + (e && e.stack ? e.stack : String(e)));
    process.exitCode = 1;
  } finally {
    if (previousActiveRoom === undefined) delete process.env.CLAUDE_ACTIVE_ROOM; else process.env.CLAUDE_ACTIVE_ROOM = previousActiveRoom;
    if (previousSessionEnv === undefined) delete process.env.CLAUDE_CODE_SESSION_ID; else process.env.CLAUDE_CODE_SESSION_ID = previousSessionEnv;
    try { fs.rmSync(home, { recursive: true, force: true }); } catch (_e) { /* best-effort cleanup */ }
  }
})();
