#!/usr/bin/env node
'use strict';

/*
 * Plan 354-02 (SYS-08) -- RED-first proof that gate_answer's approve branch
 * promotes the card's SUBJECT CLAIM, not the newly-minted decision node.
 *
 * SEAM: lib/mcp/tool-router.cjs's `meeting` tool public contract
 * (:1563, :1653 -- "approve ... promotes it to confirmed") disagrees with
 * lib/mcp/tools/gate.cjs:303-304, which today passes writeResult.node_id
 * (the decision:gate:* node it just minted) to navigation.confirmNode
 * instead of the card's subjectNodeId (the original claim). This file pins
 * the EXACT claim id the next layer consumes -- not "some node confirmed"
 * (that weaker pin already exists at tests/test-276-meeting-gate-wiring.cjs:214
 * and is left untouched).
 *
 * PROBE SEED: docs/reviews/phase-354-probes/persistence.cjs approval() --
 * registerRouterTools + gate.cjs register into a captured server, meeting
 * file-meeting, gate_answer approve, then an independent SELECT from nodes.
 * disposition ledger row: docs/reviews/phase-354-disposition-ledger.md line
 * 51 (SYS-08), reproduced exact claim id
 * `claim:synthetic-persistence-probe:96d906cc` staying `proposed` while the
 * unrelated `decision:gate:*` node gets confirmed.
 *
 * NEVER TRUST THE TOOL'S OWN response.ok. Every case below reopens room.db
 * through a FRESH openRoomDb handle after the handler returns and reads
 * review_status back with a prepared SELECT keyed on the exact claim id
 * parsed out of the meeting response text.
 *
 * Run: node tests/test-354-gate-subject-promotion.cjs
 * Exit: 1 against the unfixed gate.cjs (cases A and D fail -- the claim
 * stays proposed because confirmNode targets the decision node instead).
 * Exit: 0 once gate.cjs's _promoteCardSubject lands (354-02 Task 2).
 * No em-dashes.
 */

process.env.MINDRIAN_MCP_FIRST = 'all';
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const { registerRouterTools } = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs'));
const gateTool = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'gate.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const { makeScratchRoom, captureToolServer } = require(path.join(REPO_ROOT, 'tests', 'helpers', 'fixture-room-354.cjs'));

let passed = 0;
let failed = 0;
const failMessages = [];

function check(label, cond, detail) {
  try {
    assert.ok(cond, label);
    passed += 1;
    process.stdout.write('  ok - ' + label + '\n');
  } catch (e) {
    failed += 1;
    failMessages.push(label + (detail ? ' :: ' + detail : ''));
    process.stdout.write('  FAIL - ' + label + '\n');
    if (detail) process.stdout.write('    ' + String(detail) + '\n');
  }
}

function textOf(raw) {
  return (raw && raw.content && raw.content[0] && raw.content[0].text) || '';
}

function jsonOf(raw) {
  try { return JSON.parse(textOf(raw)); } catch (_e) { return null; }
}

// Fresh room + fresh captured server for every case, registered exactly as
// docs/reviews/phase-354-probes/persistence.cjs's approval() does.
function makeHarness(label) {
  const scratch = makeScratchRoom(label);
  const { server, handlers } = captureToolServer();
  registerRouterTools(server, scratch.room, REPO_ROOT, { full: '' }, 'cli');
  gateTool.register(server, { fallbackRoomDir: scratch.room, pluginRoot: REPO_ROOT, surface: 'cli' });
  return { scratch, handlers };
}

// Independent read: a NEW openRoomDb handle, never the handle a handler
// might still hold. Reads the row for one exact node id.
function readNode(roomDir, nodeId) {
  const db = openRoomDb(roomDir);
  try {
    return db.prepare('SELECT id, type, review_status FROM nodes WHERE id = ?').get(nodeId);
  } finally {
    closeRoomDb(db);
  }
}

function extractGateId(text) {
  const m = /gate_id[:*"\s]+\**\s*([A-Za-z0-9._-]+)/.exec(text);
  return m ? m[1] : null;
}

function extractClaimId(text) {
  const m = /Claim node (\S+) was written/.exec(text);
  return m ? m[1] : null;
}

async function fileMeeting(handlers, extra, claimText) {
  const raw = await handlers.get('meeting')(
    { command: 'file-meeting', knowledge_type: 'fact', claim_text: claimText },
    extra
  );
  const text = textOf(raw);
  return { text, gateId: extractGateId(text), claimId: extractClaimId(text) };
}

async function answerGate(handlers, extra, gateId, verdict) {
  const raw = await handlers.get('gate_answer')(
    { gate_id: gateId, chosen: [verdict], verdict },
    extra
  );
  return { raw, json: jsonOf(raw) };
}

// -------------------------------------------------------------------
// Case A -- approve promotes the EXACT claim id, not the decision node.
// -------------------------------------------------------------------
async function caseApprove() {
  process.stdout.write('\n-- A: approve promotes the exact subject claim id --\n');
  const { scratch, handlers } = makeHarness('gsp-a');
  const extra = { sessionId: 'test-354-gsp-a' };
  try {
    const filed = await fileMeeting(handlers, extra, 'Synthetic subject claim A.');
    check('file-meeting returned a gate_id', !!filed.gateId, filed.text.slice(0, 300));
    check('file-meeting returned a claim node id', !!filed.claimId, filed.text.slice(0, 300));
    if (!filed.gateId || !filed.claimId) return;

    const answered = await answerGate(handlers, extra, filed.gateId, 'approve');
    check('gate_answer response is ok', !!answered.json && answered.json.ok === true,
      JSON.stringify(answered.json));

    const claimRow = readNode(scratch.room, filed.claimId);
    check('the exact claim id reads review_status confirmed after reopening room.db',
      !!claimRow && claimRow.review_status === 'confirmed',
      'row=' + JSON.stringify(claimRow));

    const rn = answered.json && answered.json.reasoning_node;
    check('reasoning_node.subject_node_id equals the claim id', !!rn && rn.subject_node_id === filed.claimId,
      JSON.stringify(rn));
    check('reasoning_node.subject_confirmed is true', !!rn && rn.subject_confirmed === true,
      JSON.stringify(rn));

    const decisionRow = readNode(scratch.room, 'decision:gate:' + filed.gateId);
    check('the decision:gate:<id> node still exists', !!decisionRow && decisionRow.type === 'decision',
      'row=' + JSON.stringify(decisionRow));
  } finally {
    scratch.cleanup();
  }
}

// -------------------------------------------------------------------
// Cases B/C -- reject and defer leave the subject claim proposed.
// -------------------------------------------------------------------
async function caseRejectOrDefer(verdict) {
  const label = verdict === 'reject' ? 'B' : 'C';
  process.stdout.write('\n-- ' + label + ': ' + verdict + ' leaves the exact claim proposed --\n');
  const { scratch, handlers } = makeHarness('gsp-' + label.toLowerCase());
  const extra = { sessionId: 'test-354-gsp-' + label.toLowerCase() };
  try {
    const filed = await fileMeeting(handlers, extra, 'Synthetic subject claim ' + label + '.');
    check('file-meeting returned a gate_id', !!filed.gateId, filed.text.slice(0, 300));
    check('file-meeting returned a claim node id', !!filed.claimId, filed.text.slice(0, 300));
    if (!filed.gateId || !filed.claimId) return;

    const answered = await answerGate(handlers, extra, filed.gateId, verdict);
    check('gate_answer response is ok for ' + verdict, !!answered.json && answered.json.ok === true,
      JSON.stringify(answered.json));

    const claimRow = readNode(scratch.room, filed.claimId);
    check('the exact claim id stays review_status proposed after ' + verdict,
      !!claimRow && claimRow.review_status === 'proposed',
      'row=' + JSON.stringify(claimRow));

    const rn = answered.json && answered.json.reasoning_node;
    check('reasoning_node.subject_confirmed is false or absent for ' + verdict,
      !rn || rn.subject_confirmed !== true, JSON.stringify(rn));
  } finally {
    scratch.cleanup();
  }
}

// -------------------------------------------------------------------
// Case D -- evidence node ids carried on the card are NEVER promoted.
// -------------------------------------------------------------------
async function caseEvidenceNeverPromoted() {
  process.stdout.write('\n-- D: evidence never promoted --\n');
  const { scratch, handlers } = makeHarness('gsp-d');
  const extra = { sessionId: 'test-354-gsp-d' };
  try {
    const first = await fileMeeting(handlers, extra, 'Synthetic evidence claim D1.');
    const second = await fileMeeting(handlers, extra, 'Synthetic subject claim D2.');
    check('first file-meeting returned a claim node id', !!first.claimId, first.text.slice(0, 300));
    check('second file-meeting returned a claim node id', !!second.claimId, second.text.slice(0, 300));
    if (!first.claimId || !second.claimId) return;

    const renderRaw = await handlers.get('gate_render')(
      {
        subject_node_id: second.claimId,
        evidence_node_ids: [first.claimId],
        kind: 'general',
        select_mode: 'single',
        options: [
          { id: 'approve', label: 'Approve' },
          { id: 'reject', label: 'Reject' },
        ],
      },
      extra
    );
    const renderJson = jsonOf(renderRaw);
    check('gate_render minted a gate_id for the evidence card', !!renderJson && !!renderJson.gate_id,
      JSON.stringify(renderJson));
    if (!renderJson || !renderJson.gate_id) return;

    const answered = await answerGate(handlers, extra, renderJson.gate_id, 'approve');
    check('gate_answer response is ok', !!answered.json && answered.json.ok === true,
      JSON.stringify(answered.json));

    const secondRow = readNode(scratch.room, second.claimId);
    check('the subject claim (second) reads confirmed', !!secondRow && secondRow.review_status === 'confirmed',
      'row=' + JSON.stringify(secondRow));

    const firstRow = readNode(scratch.room, first.claimId);
    check('the evidence claim (first) stays proposed', !!firstRow && firstRow.review_status === 'proposed',
      'row=' + JSON.stringify(firstRow));
  } finally {
    scratch.cleanup();
  }
}

// -------------------------------------------------------------------
// Case E -- an ineligible subject (missing node) is not promoted and the
// response names why.
// -------------------------------------------------------------------
async function caseIneligibleSubject() {
  process.stdout.write('\n-- E: ineligible subject (missing node) names the skip reason --\n');
  const { scratch, handlers } = makeHarness('gsp-e');
  const extra = { sessionId: 'test-354-gsp-e' };
  try {
    const renderRaw = await handlers.get('gate_render')(
      {
        subject_node_id: 'claim:does-not-exist',
        kind: 'general',
        select_mode: 'single',
        options: [
          { id: 'approve', label: 'Approve' },
          { id: 'reject', label: 'Reject' },
        ],
      },
      extra
    );
    const renderJson = jsonOf(renderRaw);
    check('gate_render minted a gate_id for the ineligible-subject card', !!renderJson && !!renderJson.gate_id,
      JSON.stringify(renderJson));
    if (!renderJson || !renderJson.gate_id) return;

    const answered = await answerGate(handlers, extra, renderJson.gate_id, 'approve');
    check('gate_answer response is ok even though the subject cannot be promoted',
      !!answered.json && answered.json.ok === true, JSON.stringify(answered.json));

    const rn = answered.json && answered.json.reasoning_node;
    check('reasoning_node.subject_confirmed is false', !!rn && rn.subject_confirmed === false, JSON.stringify(rn));
    check("reasoning_node.subject_skip_reason equals 'subject_not_found'",
      !!rn && rn.subject_skip_reason === 'subject_not_found', JSON.stringify(rn));
  } finally {
    scratch.cleanup();
  }
}

async function run() {
  process.stdout.write('Plan 354-02 (SYS-08): RED-first proof that approve promotes the exact subject claim\n');
  process.stdout.write('Contract source: 354-CONTEXT.md CTX-GATE; disposition ledger row SYS-08.\n');

  await caseApprove();
  await caseRejectOrDefer('reject');
  await caseRejectOrDefer('defer');
  await caseEvidenceNeverPromoted();
  await caseIneligibleSubject();

  process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
  if (failed > 0) {
    process.stdout.write('\nFAILURES:\n');
    for (const m of failMessages) process.stdout.write('  - ' + m + '\n');
    process.exitCode = 1;
  }
}

run().catch((e) => {
  process.stdout.write('\nUNCAUGHT ERROR: ' + String((e && e.stack) || e) + '\n');
  process.exitCode = 1;
});
