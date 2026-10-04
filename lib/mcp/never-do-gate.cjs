'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 365 Plan 13 -- the "Reject and never do this" proposal gate (D-10, D-14, D-15).
 *
 * A helper module, NOT an invocable surface: it registers no tool and exports no
 * connectors (Canon Part 11), exactly like gate-ledger.cjs. The MCP tools that
 * already own a gate (chain_run, research_run) call it to turn a pre-filled
 * never-do proposal into a follow-up gate.
 *
 * Why a material_step gate with a resumeFn: that is the house approval-trail
 * pattern research_run already uses for grants. gate_answer consumes the single-use
 * gate, writes the decision node decision:gate:<gate_id> through navigation
 * (Canon Part 9), and only then calls the resumeFn. The resumeFn therefore only
 * READS that node (it never mints one) and then asks the one writer,
 * room-constraints.writeNeverDoEntry, to land the entry with that node id as its
 * approval trail. No schema or description on gate_render, gate_answer, chain_run,
 * graph_write or room_bind changes, and gate.cjs is untouched.
 *
 * Why elicitation is forced off: an inline elicitation answer is consumed inside
 * the render call and never reaches gate_answer, so it would skip the decision node
 * and the approval trail. The proposal card is always shown on the Claude Code
 * AskUserQuestion rung (b) or the structured text rung (c), and never answered
 * inline.
 *
 * Canon Part 8: nothing here reaches the network. The why stays on the local card,
 * in the local decision node and in .mindrian/never-do.json.
 *
 * CJS only. No em-dash or en-dash anywhere in this file.
 */

const gateRender = require('./gate-render.cjs');
const gateLedger = require('./gate-ledger.cjs');
const roomConstraints = require('../core/room-constraints.cjs');
const navigation = require('../core/navigation.cjs');

const MAX_NOTICE = 400;
const MAX_HEADER_VALUE = 80;
const CLAUDE_HOST_SURFACES = ['cli', 'desktop', 'cowork'];
const DASH_RE = new RegExp('[' + String.fromCharCode(0x2014) + String.fromCharCode(0x2013) + ']', 'g');

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function nonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }
function noDash(s) { return String(s == null ? '' : s).replace(DASH_RE, '-'); }
function oneLine(s) { return noDash(s).replace(/\s+/g, ' ').trim(); }
function ellipsize(s, max) {
  if (s.length <= max) return s;
  return max > 3 ? (s.slice(0, max - 3) + '...') : s.slice(0, Math.max(0, max));
}

// A proposal is {kind, value, why, alternatives}. Returns null when it is usable,
// else the refusal reason. Checked before anything is minted so a bad proposal
// never reaches a person (the writer would refuse it after the click).
function proposalProblem(p) {
  if (!isObj(p)) return 'invalid_proposal';
  if (typeof p.kind !== 'string' || !roomConstraints.KINDS.has(p.kind)) return 'invalid_kind';
  if (!nonEmpty(p.value)) return 'invalid_value';
  if (!nonEmpty(p.why)) return 'invalid_why';
  return null;
}

// The notice shows kind, value, why and the floor sentence. The card normalizer
// caps a notice at 400 characters, so the why is trimmed first and then the value,
// which keeps the floor sentence whole (D-15).
function proposalNotice(p) {
  const floor = roomConstraints.FLOOR_SENTENCE;
  const kind = oneLine(p.kind);
  let value = oneLine(p.value);
  let why = oneLine(p.why);
  function build() {
    return kind + ': ' + value + '. Why: ' + why + ' ' + floor;
  }
  let text = build();
  if (text.length > MAX_NOTICE) {
    why = ellipsize(why, Math.max(0, why.length - (text.length - MAX_NOTICE)));
    text = build();
  }
  if (text.length > MAX_NOTICE) {
    value = ellipsize(value, Math.max(0, value.length - (text.length - MAX_NOTICE)));
    text = build();
  }
  return text;
}

// buildProposalCard(proposal) -> the Shape F three option card. Option ids are the
// gate_answer verdict vocabulary (approve, reject, defer). The header carries the
// proposed entry because gate_answer records the header as the decision node text.
function buildProposalCard(proposal) {
  const p = isObj(proposal) ? proposal : {};
  return {
    header: 'Reject and never do this? ' + oneLine(p.kind) + ': ' + ellipsize(oneLine(p.value), MAX_HEADER_VALUE),
    kind: 'general',
    select_mode: 'single',
    options: [
      {
        id: 'approve',
        label: 'Reject and never do this',
        description: "Adds one entry to this room's never-do list. Unattended steps that match it will stop and ask.",
      },
      { id: 'reject', label: 'Just reject this time', description: 'Nothing is added to the list.' },
      { id: 'defer', label: 'Decide later', description: 'Nothing is added to the list.' },
    ],
    subject_node_id: null,
    evidence_node_ids: [],
    notice: proposalNotice(p),
  };
}

// The capability read with elicitation forced off. A Claude host (known from its
// surface, or already flagged claudeCode) gets rung (b); everything else rung (c).
function forcedCapabilities(opts) {
  const caps = (opts && isObj(opts.capabilities)) ? opts.capabilities : {};
  const surface = (opts && typeof opts.surface === 'string') ? opts.surface : null;
  const claudeCode = caps.claudeCode === true
    || (caps.elicitation === true && surface !== null && CLAUDE_HOST_SURFACES.indexOf(surface) !== -1);
  return { elicitation: false, claudeCode: claudeCode };
}

// Reads the decision node gate_answer wrote. True only when the row exists.
function decisionNodeExists(roomDir, nodeId) {
  let db = null;
  try {
    db = navigation.openRoomDbForCaller(roomDir);
    if (!db) return false;
    const row = db.prepare('SELECT id FROM nodes WHERE id = ?').get(nodeId);
    return !!row;
  } catch (_e) {
    return false;
  } finally {
    if (db) {
      try { navigation.closeRoomDbForCaller(db); } catch (_e) { /* best effort */ }
    }
  }
}

function sanitizedProposal(p) {
  return {
    kind: p.kind,
    value: oneLine(p.value),
    why: oneLine(p.why),
    alternatives: Array.isArray(p.alternatives)
      ? p.alternatives.filter(isObj).slice(0, 2).map(function (a) { return { kind: a.kind, value: a.value }; })
      : [],
  };
}

// The resumeFn for a proposal gate. Runs only after gate_answer consumed the gate
// and wrote the decision node.
function makeProposalResumeFn(roomDir, proposal) {
  return function proposalResume(answer) {
    const a = isObj(answer) ? answer : {};
    if (a.verdict !== 'approve') return { ok: true, executed: false, verdict: a.verdict || 'defer', note: 'Nothing was added to the never-do list.' };
    const chosen = Array.isArray(a.chosen) ? a.chosen : [];
    if (chosen.indexOf('approve') === -1) {
      return { ok: false, executed: false, reason: 'chosen_not_approving', note: 'An approve verdict must name the approve option. Nothing was added.' };
    }
    const nodeId = navigation.REASONING_NODE_ID('decision:gate', a.gate_id);
    if (!nodeId || !decisionNodeExists(roomDir, nodeId)) {
      return { ok: false, executed: false, reason: 'decision_node_missing', note: 'No decision is on record for this answer. Nothing was added.' };
    }
    const result = roomConstraints.writeNeverDoEntry(
      roomDir,
      { kind: proposal.kind, value: proposal.value, why: proposal.why },
      { approved_via: { surface: 'mcp', decision_node_id: nodeId } }
    );
    return { ok: result.ok === true, executed: result.ok === true, never_do_written: result };
  };
}

async function mintCard(card, roomDir, sessionId, opts, resumeFn, extra) {
  const ctx = {
    capabilities: forcedCapabilities(opts),
    sessionId: sessionId,
    verdictFor: function (ids) { return (Array.isArray(ids) && ids[0]) || 'defer'; },
  };
  let result;
  try {
    result = await gateRender.renderGate(card, ctx);
  } catch (_e) {
    return { ok: false, reason: 'render_failed' };
  }
  const gateId = result.card.gate_id;
  gateLedger.mintGate(gateId, Object.assign({}, extra || {}, {
    card: result.card,
    sessionId: sessionId,
    kind: 'material_step',
    resumeFn: resumeFn,
  }));
  // Any inline answer is deliberately ignored: nothing here is ever consumed
  // outside gate_answer, so the decision node is always written first.
  return { ok: true, gate_id: gateId, renderer: result.renderer, rendered: result.rendered };
}

// mintProposalGate(proposal, {roomDir, sessionId, capabilities, surface})
//   -> {ok, gate_id, renderer, rendered, proposal} | {ok:false, reason}
async function mintProposalGate(proposal, opts) {
  const o = isObj(opts) ? opts : {};
  const problem = proposalProblem(proposal);
  if (problem) return { ok: false, reason: problem };
  if (!nonEmpty(o.roomDir)) return { ok: false, reason: 'no_room_dir' };
  const clean = sanitizedProposal(proposal);
  const minted = await mintCard(buildProposalCard(clean), o.roomDir, o.sessionId, o, makeProposalResumeFn(o.roomDir, clean), { proposal: clean, approving: ['approve'] });
  if (!minted.ok) return minted;
  return Object.assign({}, minted, { proposal: clean });
}

// True when the room's list already covers the proposal (the halt it came from was
// caused by an entry, or an earlier approval already added it). A malformed list
// counts as "nothing sensible to propose" for the same reason.
function proposalAlreadyListed(roomDir, proposal) {
  const cur = roomConstraints.readNeverDo(roomDir);
  if (!cur.ok) return true;
  const fields = {};
  fields[proposal.kind] = proposal.value;
  return roomConstraints.matchFields(cur.entries, fields) !== null;
}

const NEVER_DO_NEXT_STEP = "The navigator rejected this. never_do_gate offers to add it to this room's never-do list: show its card and answer it with gate_answer. " + roomConstraints.FLOOR_SENTENCE;

// mintHaltedConstraintGate(card, {roomDir, sessionId, capabilities, surface})
// renders the halted_constraint card.json (365-10) as a Shape F gate in the ledger.
// approve -> the attended run_quick next step; reject -> the "Reject and never do
// this" follow-up from the card's own proposal (omitted when there is none, when the
// list is unreadable, or when the list already covers it); defer -> nothing.
async function mintHaltedConstraintGate(card, opts) {
  const o = isObj(opts) ? opts : {};
  const c = isObj(card) ? card : null;
  if (!c || !isObj(c.payload) || c.payload.halted_constraint !== true) return { ok: false, reason: 'not_a_halted_constraint_card' };
  if (!nonEmpty(o.roomDir)) return { ok: false, reason: 'no_room_dir' };
  const roomDir = o.roomDir;
  const runId = (typeof c.payload.run_id === 'string') ? c.payload.run_id : null;
  const proposal = isObj(c.payload.never_do_proposal) ? c.payload.never_do_proposal : null;

  const gateCard = {
    header: oneLine(c.header),
    kind: 'general',
    select_mode: 'single',
    options: [
      { id: 'approve', label: 'Run it now, attended' },
      { id: 'reject', label: 'Leave it stopped' },
      { id: 'defer', label: 'Decide later' },
    ],
    subject_node_id: null,
    evidence_node_ids: [],
    notice: nonEmpty(c.notice) ? oneLine(c.notice) : null,
  };

  async function resume(answer) {
    const a = isObj(answer) ? answer : {};
    const chosen = Array.isArray(a.chosen) ? a.chosen : [];
    if (a.verdict === 'approve') {
      if (chosen.indexOf('approve') === -1) {
        return { ok: false, executed: false, reason: 'chosen_not_approving', note: 'An approve verdict must name the approve option. Nothing ran.' };
      }
      return {
        ok: true,
        executed: false,
        next_step: 'The navigator chose to run this research attended: call research_run with op run_quick and run_id ' + runId
          + '. The never-do list governs unattended steps only; the grant check still applies.',
      };
    }
    if (a.verdict === 'reject' && proposal && proposalProblem(proposal) === null && !proposalAlreadyListed(roomDir, proposal)) {
      const follow = await mintProposalGate(proposal, o);
      if (follow.ok) {
        return {
          ok: true,
          executed: false,
          never_do_gate: {
            gate_id: follow.gate_id,
            renderer: follow.renderer,
            rendered: follow.rendered,
            proposal: follow.proposal,
            next_step: NEVER_DO_NEXT_STEP,
          },
        };
      }
    }
    return { ok: true, executed: false, verdict: a.verdict || 'defer', note: 'Nothing ran and nothing was added to the never-do list.' };
  }

  return mintCard(gateCard, roomDir, o.sessionId, o, resume, { run_id: runId, approving: ['approve'] });
}

module.exports = {
  buildProposalCard: buildProposalCard,
  mintProposalGate: mintProposalGate,
  mintHaltedConstraintGate: mintHaltedConstraintGate,
  NEVER_DO_NEXT_STEP: NEVER_DO_NEXT_STEP,
};
