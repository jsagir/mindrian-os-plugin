#!/usr/bin/env node
'use strict';
// Phase 238-03 (GATE-01 G-2) -- proves gate_answer rejects an out-of-card
// chosen BEFORE any write, and that the reject writes zero rows.
//
// MUTATION GATE (SC1 named leg, per the plan's Task 3 action): commenting
// out the `gateRender.validateChosenAgainstCard(live.card, chosen)` reject
// block in lib/mcp/tools/gate.cjs turns Case 2 and Case 3 below RED --
// Case 2 because the response stops carrying reason:'chosen_not_in_card_
// options' (an arbitrary chosen ratifies instead), and Case 3 because the
// memory_event row count then INCREASES on the previously-rejected call
// instead of staying flat. See 238-03-SUMMARY.md for the physically
// performed transcript (disable -> observe red -> restore byte-identically
// -> observe green), per the Phase 241/242/243 demonstrated-RED precedent.
//
// Harness: the plain-Node ok()/PASS-tally shape from
// tests/test-209-backstop-tuning.cjs. No framework.
//
// Seam used to drive the tool: the fake-MCP-server handler-capture seam
// from tests/test-198-contract-schema.test.cjs's makeFakeServer() (mirrors
// the real McpServer.tool(name, description, schemaShape, handler) 4-arg
// shape, and reports NO elicitation capability so the ladder falls to the
// same askuserquestion/text rungs Claude Code actually gets today). This
// drives the REGISTERED gate_render/gate_answer handlers themselves, not
// gate.cjs's internal _mintLiveGate/_consumeLiveGate helpers directly --
// Pitfall 3 in 238-RESEARCH.md names exactly this trap (testing chainRun's
// internal resume instead of the real gate_answer tool passed silently).
//
// Node built-in assert/strict only. No em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const gateModule = require(path.join(REPO, 'lib', 'mcp', 'tools', 'gate.cjs'));
const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-238-chosen-validation');

// ---------------------------------------------------------------------------
// (1) The fake-MCP-server handler-capture seam (test-198-contract-schema.
// test.cjs precedent).
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
      getClientCapabilities() { return {}; }, // no elicitation -> falls to the askuserquestion/text rungs
    },
  };
}

// ---------------------------------------------------------------------------
// (2) Hermetic scratch room. CLAUDE_ACTIVE_ROOM is the explicit resolver
// override "operators and hermetic tests rely on this seam" per resolve-
// active-room.cjs -- deterministic regardless of the real machine's own
// registry.json.
// ---------------------------------------------------------------------------
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-238-chosen-'));
const roomDir = path.join(home, 'room');
fs.mkdirSync(roomDir, { recursive: true });

const bootHandle = roomDb.openRoomDb(roomDir); // creates .mindrian/room.db + schema
roomDb.closeRoomDb(bootHandle);

const previousActiveRoom = process.env.CLAUDE_ACTIVE_ROOM;
const previousSessionEnv = process.env.CLAUDE_CODE_SESSION_ID;
process.env.CLAUDE_ACTIVE_ROOM = roomDir;
delete process.env.CLAUDE_CODE_SESSION_ID;

function countMemoryEvents() {
  const db = navigation.openRoomDbForCaller(roomDir);
  assert.ok(db, 'the scratch room db must open for a row count -- test fixture sanity');
  try {
    const row = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'memory_event'").get();
    return row ? row.c : 0;
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
}

(async function main() {
  try {
    const fakeServer = makeFakeServer();
    const ctx = { fallbackRoomDir: roomDir, surface: 'cli' };
    gateModule.register(fakeServer, ctx);

    const gateRenderEntry = fakeServer._registered.find((r) => r.name === 'gate_render');
    const gateAnswerEntry = fakeServer._registered.find((r) => r.name === 'gate_answer');
    assert.ok(gateRenderEntry, 'gate_render must be registered on the fake server');
    assert.ok(gateAnswerEntry, 'gate_answer must be registered on the fake server');

    async function mintCard(options) {
      const res = await gateRenderEntry.handler({ options: options }, {});
      return JSON.parse(res.content[0].text);
    }

    async function answerGate(gateId, chosen, verdict) {
      const res = await gateAnswerEntry.handler(
        { gate_id: gateId, chosen: chosen, verdict: verdict || 'approve' },
        {}
      );
      const parsed = JSON.parse(res.content[0].text);
      parsed._isError = !!res.isError;
      return parsed;
    }

    const CARD_OPTIONS = [
      { id: 'approve', label: 'Approve' },
      { id: 'reject', label: 'Reject' },
    ];

    // -------------------------------------------------------------------
    // Case 1: happy-path anti-vacuity control. Without this, a handler that
    // rejected everything would pass every other case.
    // -------------------------------------------------------------------
    const beforeCase1 = countMemoryEvents();
    const rendered1 = await mintCard(CARD_OPTIONS);
    const gateId1 = rendered1.gate_id;
    const answer1 = await answerGate(gateId1, ['approve'], 'approve');
    const afterCase1 = countMemoryEvents();
    ok('case 1 (anti-vacuity control): a valid chosen ratifies and writes exactly one memory_event row', function () {
      assert.equal(answer1.ok, true, 'happy-path answer must be ok:true');
      assert.equal(answer1.ratified, true, 'happy-path answer must be ratified:true');
      assert.equal(
        afterCase1, beforeCase1 + 1,
        `expected memory_event count to increase by exactly 1 (before=${beforeCase1}, after=${afterCase1})`
      );
    });

    // -------------------------------------------------------------------
    // Case 2: the reject. A made-up chosen is rejected before ratification.
    // -------------------------------------------------------------------
    const rendered2 = await mintCard(CARD_OPTIONS);
    const gateId2 = rendered2.gate_id;
    const beforeCase2 = countMemoryEvents();
    const answer2 = await answerGate(gateId2, ['totally-made-up-option'], 'approve');
    ok('case 2 (the reject): an out-of-card chosen returns reason:chosen_not_in_card_options with isError set', function () {
      assert.equal(answer2.ok, false, 'reject response must be ok:false');
      assert.equal(answer2.reason, 'chosen_not_in_card_options', 'reject reason must be the exact snake_case slug');
      assert.equal(answer2._isError, true, 'reject response must set isError');
      assert.deepEqual(
        (answer2.valid_option_ids || []).slice().sort(),
        ['approve', 'reject'],
        'reject payload echoes the minted card\'s real option ids so a caller can self-correct'
      );
    });

    // -------------------------------------------------------------------
    // Case 3: the load-bearing half of case 2. Row count unchanged, not
    // merely "an error was returned".
    // -------------------------------------------------------------------
    const afterCase2 = countMemoryEvents();
    ok('case 3 (load-bearing): the rejected call writes ZERO new memory_event rows (row count unchanged)', function () {
      assert.equal(
        afterCase2, beforeCase2,
        `expected memory_event count unchanged by the rejected call (before=${beforeCase2}, after=${afterCase2})`
      );
    });

    // -------------------------------------------------------------------
    // Case 4: label resolution still works -- the fix must not narrow the
    // AskUserQuestion rung's existing id-or-label contract.
    // -------------------------------------------------------------------
    const rendered4 = await mintCard(CARD_OPTIONS);
    const gateId4 = rendered4.gate_id;
    const answer4 = await answerGate(gateId4, ['Approve'], 'approve'); // the LABEL, not the id
    ok('case 4: answering with the option LABEL (not the id) still ratifies, resolved to the option id', function () {
      assert.equal(answer4.ok, true, 'label-answered response must be ok:true');
      assert.equal(answer4.ratified, true, 'label-answered response must be ratified:true');
      assert.deepEqual(
        answer4.chosen, ['approve'],
        'the persisted chosen array carries the RESOLVED option id, not the raw submitted label'
      );
    });

    // -------------------------------------------------------------------
    // Case 5: the gate is burned either way. A follow-up correct answer to
    // the SAME gate_id used in the rejected case 2 call returns
    // unknown_or_expired_gate -- single-use is unaffected by the new reject.
    // -------------------------------------------------------------------
    const followUp = await answerGate(gateId2, ['approve'], 'approve');
    ok('case 5: the gate is burned either way -- a follow-up correct answer to the same gate_id returns unknown_or_expired_gate', function () {
      assert.equal(followUp.ok, false, 'follow-up answer on a burned gate must be ok:false');
      assert.equal(followUp.reason, 'unknown_or_expired_gate', 'follow-up answer must report the gate as unknown/expired, not re-validate chosen');
    });

    console.log(`PASS test-238-chosen-validation (${n} assertions)`);
    process.exit(0);
  } catch (e) {
    console.error('FAIL: test-238-chosen-validation -- ' + (e && e.stack ? e.stack : String(e)));
    process.exitCode = 1;
  } finally {
    if (previousActiveRoom === undefined) delete process.env.CLAUDE_ACTIVE_ROOM; else process.env.CLAUDE_ACTIVE_ROOM = previousActiveRoom;
    if (previousSessionEnv === undefined) delete process.env.CLAUDE_CODE_SESSION_ID; else process.env.CLAUDE_CODE_SESSION_ID = previousSessionEnv;
    try { fs.rmSync(home, { recursive: true, force: true }); } catch (_e) { /* best-effort cleanup */ }
  }
})();
