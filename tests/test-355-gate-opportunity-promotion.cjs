#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 22 Task 1 (HIPS-06, D-39). Proof that gate_answer's
 * _promoteCardSubject door (lib/mcp/tools/gate.cjs) now also promotes an
 * 'opportunity' subject, not only a 'claim' -- and that one local
 * cross_connection_gate_outcome memory_event records the promote/reject
 * outcome for a stamped opportunity, never for a plain claim.
 *
 * Harness reused verbatim from tests/test-354-gate-subject-promotion.cjs
 * (SYS-08): captureToolServer + registerRouterTools + gateTool.register,
 * NEVER trusting the tool's own response.ok alone -- every case reopens
 * room.db through a FRESH openRoomDb handle after the handler returns.
 *
 * Test hygiene contract (every 355 test): scrub TYPESAFE_API_KEY and install
 * the net guard via tests/helpers/hygiene-355.cjs BEFORE requiring any repo
 * module; assert attempts() === 0 as the last check.
 *
 * No em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 */

process.env.MINDRIAN_MCP_FIRST = 'all';
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const path = require('node:path');

const hygiene = require('./helpers/hygiene-355.cjs');

const wasKeyPresent = hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

try {
  require('node:sqlite');
} catch (_e) {
  process.stdout.write('SKIP test-355-gate-opportunity-promotion.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REPO = path.join(__dirname, '..');
const checker = hygiene.makeChecker('test-355-gate-opportunity-promotion');
const { check } = checker;

const { registerRouterTools } = require(path.join(REPO, 'lib', 'mcp', 'tool-router.cjs'));
const gateTool = require(path.join(REPO, 'lib', 'mcp', 'tools', 'gate.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
const { makeScratchRoom, captureToolServer } = require(path.join(REPO, 'tests', 'helpers', 'fixture-room-354.cjs'));

function textOf(raw) {
  return (raw && raw.content && raw.content[0] && raw.content[0].text) || '';
}

function jsonOf(raw) {
  try { return JSON.parse(textOf(raw)); } catch (_e) { return null; }
}

function makeHarness(label) {
  const scratch = makeScratchRoom(label);
  const { server, handlers } = captureToolServer();
  registerRouterTools(server, scratch.room, REPO, { full: '' }, 'cli');
  gateTool.register(server, { fallbackRoomDir: scratch.room, pluginRoot: REPO, surface: 'cli' });
  return { scratch, handlers };
}

function readNode(roomDir, nodeId) {
  const db = openRoomDb(roomDir);
  try {
    return db.prepare('SELECT id, type, review_status, properties FROM nodes WHERE id = ?').get(nodeId);
  } finally {
    closeRoomDb(db);
  }
}

function readGateOutcomeEvents(roomDir) {
  const db = openRoomDb(roomDir);
  try {
    const rows = db.prepare(
      "SELECT properties FROM nodes WHERE type = 'memory_event' AND json_extract(properties, '$.event_type') = 'cross_connection_gate_outcome'"
    ).all();
    return rows.map((r) => JSON.parse(r.properties || '{}'));
  } finally {
    closeRoomDb(db);
  }
}

function mintOpportunity(roomDir, name, sessionId, extraProps) {
  const db = openRoomDb(roomDir);
  try {
    const res = navigation.writeOpportunityNode(db, { name: name, sessionId: sessionId, extraProps: extraProps });
    if (!res || res.ok !== true) throw new Error('mintOpportunity failed: ' + JSON.stringify(res));
    return res.node_id;
  } finally {
    closeRoomDb(db);
  }
}

function mintDecisionNode(roomDir, nodeId) {
  const db = openRoomDb(roomDir);
  try {
    const res = navigation.writeReasoningNode(db, {
      nodeId: nodeId, nodeType: 'decision', epistemicType: 'decision', text: 'a decision node, not a claim',
    });
    if (!res || res.ok !== true) throw new Error('mintDecisionNode failed: ' + JSON.stringify(res));
    return nodeId;
  } finally {
    closeRoomDb(db);
  }
}

async function renderCard(handlers, extra, subjectNodeId) {
  const raw = await handlers.get('gate_render')(
    {
      subject_node_id: subjectNodeId,
      kind: 'general',
      select_mode: 'single',
      options: [
        { id: 'approve', label: 'Approve' },
        { id: 'reject', label: 'Reject' },
      ],
    },
    extra
  );
  return jsonOf(raw);
}

async function answerGate(handlers, extra, gateId, verdict) {
  const raw = await handlers.get('gate_answer')({ gate_id: gateId, chosen: [verdict], verdict: verdict }, extra);
  return jsonOf(raw);
}

// -------------------------------------------------------------------
// Case A -- approve promotes a proposed opportunity subject to confirmed,
// and logs the gate-outcome telemetry event.
// -------------------------------------------------------------------
async function caseApproveOpportunity() {
  process.stdout.write('\n-- A: approve promotes a proposed opportunity subject to confirmed --\n');
  const { scratch, handlers } = makeHarness('gop-a');
  const extra = { sessionId: 'test-355-gop-a' };
  try {
    const oppId = mintOpportunity(scratch.room, 'Opportunity A', 'gop-a-session', {
      verification: 'strong', backend: 'theo', direction: 'structural_transfer', judge: 'none',
    });
    const before = readNode(scratch.room, oppId);
    check('opportunity A reads proposed before gate_answer', !!before && before.review_status === 'proposed', JSON.stringify(before));

    const rendered = await renderCard(handlers, extra, oppId);
    check('gate_render minted a gate_id', !!rendered && !!rendered.gate_id, JSON.stringify(rendered));
    if (!rendered || !rendered.gate_id) return;

    const answered = await answerGate(handlers, extra, rendered.gate_id, 'approve');
    check('gate_answer response is ok', !!answered && answered.ok === true, JSON.stringify(answered));

    const after = readNode(scratch.room, oppId);
    check('the exact opportunity node id reads confirmed after reopening room.db', !!after && after.review_status === 'confirmed', JSON.stringify(after));

    const rn = answered && answered.reasoning_node;
    check('reasoning_node.subject_node_id equals the opportunity id', !!rn && rn.subject_node_id === oppId, JSON.stringify(rn));
    check('reasoning_node.subject_confirmed is true', !!rn && rn.subject_confirmed === true, JSON.stringify(rn));

    const events = readGateOutcomeEvents(scratch.room);
    check('exactly 1 cross_connection_gate_outcome memory_event for the approved opportunity', events.length === 1, JSON.stringify(events));
    if (events.length === 1) {
      const ev = events[0];
      const wantKeys = ['finding_id', 'tier', 'direction', 'response'];
      const allowedKeys = wantKeys.concat(['event_type']);
      check('memory_event carries the exact key set', wantKeys.every((k) => Object.prototype.hasOwnProperty.call(ev, k)), JSON.stringify(ev));
      check('memory_event carries no unexpected keys', Object.keys(ev).every((k) => allowedKeys.indexOf(k) !== -1), JSON.stringify(ev));
      check('memory_event finding_id equals the opportunity id', ev.finding_id === oppId, JSON.stringify(ev));
      check('memory_event tier equals strong', ev.tier === 'strong', JSON.stringify(ev));
      check('memory_event direction equals structural_transfer', ev.direction === 'structural_transfer', JSON.stringify(ev));
      check('memory_event response equals approve', ev.response === 'approve', JSON.stringify(ev));
    }
  } finally {
    scratch.cleanup();
  }
}

// -------------------------------------------------------------------
// Case B -- reject leaves the opportunity proposed; the outcome event still
// fires (acceptance-rate telemetry needs both arms).
// -------------------------------------------------------------------
async function caseRejectOpportunity() {
  process.stdout.write('\n-- B: reject leaves the opportunity proposed, still logs the outcome --\n');
  const { scratch, handlers } = makeHarness('gop-b');
  const extra = { sessionId: 'test-355-gop-b' };
  try {
    const oppId = mintOpportunity(scratch.room, 'Opportunity B', 'gop-b-session', {
      verification: 'unverified', backend: 'not_called', direction: 'semantic_implementation', judge: 'none',
    });
    const rendered = await renderCard(handlers, extra, oppId);
    check('gate_render minted a gate_id', !!rendered && !!rendered.gate_id, JSON.stringify(rendered));
    if (!rendered || !rendered.gate_id) return;

    const answered = await answerGate(handlers, extra, rendered.gate_id, 'reject');
    check('gate_answer response is ok for reject', !!answered && answered.ok === true, JSON.stringify(answered));

    const after = readNode(scratch.room, oppId);
    check('the opportunity stays proposed after reject', !!after && after.review_status === 'proposed', JSON.stringify(after));

    const events = readGateOutcomeEvents(scratch.room);
    check('exactly 1 cross_connection_gate_outcome memory_event for the rejected opportunity', events.length === 1, JSON.stringify(events));
    if (events.length === 1) {
      check('memory_event response equals reject', events[0].response === 'reject', JSON.stringify(events[0]));
      check('memory_event tier equals unverified', events[0].tier === 'unverified', JSON.stringify(events[0]));
      check('memory_event direction equals semantic_implementation', events[0].direction === 'semantic_implementation', JSON.stringify(events[0]));
    }
  } finally {
    scratch.cleanup();
  }
}

// -------------------------------------------------------------------
// Case C -- a decision-type subject (neither claim nor opportunity) still
// reports subject_not_claim, unchanged.
// -------------------------------------------------------------------
async function caseDecisionSubjectSkipsUnchanged() {
  process.stdout.write('\n-- C: a decision-type subject still reports subject_not_claim --\n');
  const { scratch, handlers } = makeHarness('gop-c');
  const extra = { sessionId: 'test-355-gop-c' };
  try {
    const decId = mintDecisionNode(scratch.room, 'decision:synthetic:gop-c');
    const rendered = await renderCard(handlers, extra, decId);
    check('gate_render minted a gate_id', !!rendered && !!rendered.gate_id, JSON.stringify(rendered));
    if (!rendered || !rendered.gate_id) return;

    const answered = await answerGate(handlers, extra, rendered.gate_id, 'approve');
    check('gate_answer response is ok', !!answered && answered.ok === true, JSON.stringify(answered));

    const rn = answered && answered.reasoning_node;
    check("reasoning_node.subject_skip_reason equals 'subject_not_claim' for a decision-type subject", !!rn && rn.subject_skip_reason === 'subject_not_claim', JSON.stringify(rn));
    check('reasoning_node.subject_confirmed is false', !!rn && rn.subject_confirmed === false, JSON.stringify(rn));

    const events = readGateOutcomeEvents(scratch.room);
    check('no cross_connection_gate_outcome memory_event for a decision-type subject', events.length === 0, JSON.stringify(events));
  } finally {
    scratch.cleanup();
  }
}

// -------------------------------------------------------------------
// Case D -- navigation.promoteNodeStatus with an agent actor on the
// opportunity is refused (the Phase 348 human-attribution guard still
// applies via TRUTH_CLAIM_TYPES, unchanged by the D-39 widening).
// -------------------------------------------------------------------
async function caseAgentAttributionForbidden() {
  process.stdout.write('\n-- D: an agent-attributed promoteNodeStatus on the opportunity is refused --\n');
  const scratch = makeScratchRoom('gop-d');
  try {
    const oppId = mintOpportunity(scratch.room, 'Opportunity D', 'gop-d-session', {
      verification: 'strong', backend: 'theo', direction: 'structural_transfer', judge: 'none',
    });
    const db = openRoomDb(scratch.room);
    let promo;
    try {
      promo = navigation.promoteNodeStatus(db, oppId, 'proposed', 'confirmed', 'larry', 'agent attempt');
    } finally {
      closeRoomDb(db);
    }
    check('agent-attributed promote on an opportunity returns agent_attribution_forbidden', !!promo && promo.reason === 'agent_attribution_forbidden', JSON.stringify(promo));
    const after = readNode(scratch.room, oppId);
    check('the opportunity still reads proposed after the rejected agent promote', !!after && after.review_status === 'proposed', JSON.stringify(after));
  } finally {
    scratch.cleanup();
  }
}

// -------------------------------------------------------------------
// Case E -- a plain claim's approve outcome is unchanged (SYS-08 stays
// green, checked separately by run) AND writes NO gate-outcome event.
// -------------------------------------------------------------------
async function caseNoOutcomeEventForPlainClaim() {
  process.stdout.write('\n-- E: a plain claim outcome writes no cross_connection_gate_outcome event --\n');
  const { scratch, handlers } = makeHarness('gop-e');
  const extra = { sessionId: 'test-355-gop-e' };
  try {
    const raw = await handlers.get('meeting')(
      { command: 'file-meeting', knowledge_type: 'fact', claim_text: 'Synthetic plain claim.' },
      extra
    );
    const text = textOf(raw);
    const m = /Claim node (\S+) was written/.exec(text);
    const claimId = m ? m[1] : null;
    check('file-meeting returned a claim node id', !!claimId, text.slice(0, 300));
    if (!claimId) return;

    const rendered = await renderCard(handlers, extra, claimId);
    check('gate_render minted a gate_id for the claim card', !!rendered && !!rendered.gate_id, JSON.stringify(rendered));
    if (!rendered || !rendered.gate_id) return;

    const answered = await answerGate(handlers, extra, rendered.gate_id, 'approve');
    check('gate_answer response is ok', !!answered && answered.ok === true, JSON.stringify(answered));

    const after = readNode(scratch.room, claimId);
    check('the claim reads confirmed after approve (unchanged behavior)', !!after && after.review_status === 'confirmed', JSON.stringify(after));

    const events = readGateOutcomeEvents(scratch.room);
    check('NO cross_connection_gate_outcome memory_event for a plain claim', events.length === 0, JSON.stringify(events));
  } finally {
    scratch.cleanup();
  }
}

async function run() {
  process.stdout.write('Plan 355-22 Task 1 (D-39, HIPS-06): gate_answer promotes an opportunity subject; outcome recorded locally\n');

  await caseApproveOpportunity();
  await caseRejectOpportunity();
  await caseDecisionSubjectSkipsUnchanged();
  await caseAgentAttributionForbidden();
  await caseNoOutcomeEventForPlainClaim();

  check('installNetGuard: zero fetch attempts', netGuard.attempts() === 0);
  netGuard.restore();
  process.stdout.write('scrubVendorKey found a pre-set TYPESAFE_API_KEY: ' + wasKeyPresent + '\n');
  process.exit(checker.summary());
}

run().catch((e) => {
  process.stdout.write('\nUNCAUGHT ERROR: ' + String((e && e.stack) || e) + '\n');
  process.exit(1);
});
