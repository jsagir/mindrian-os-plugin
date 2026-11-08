'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 374 Plan 03 (decision D-04, Canon Part 3 and Part 7) -- the one shared
 * approval gate minter.
 *
 * mintApprovalGate was moved here from lib/mcp/tools/research.cjs, body
 * unchanged, so the research ops (grant_request, deep_plan, basket) and the
 * Eureka pair-screen flow mint their approval through ONE tested function and
 * there is no fourth copy of a gate minter in the tree.
 *
 * Approvals ride the ONE governed gate path (Canon Part 3, Part 11 R1): the
 * minter renders the card through gate-render renderGate, mints a single-use
 * material_step gate in gate-ledger, and the navigator answers through the
 * existing gate_answer tool, which consumes the gate and calls the resumeFn
 * minted here. There is no second gate path.
 *
 * One new behaviour against the research.cjs original: spec.resolve receives a
 * third argument { gate_id }, the id of its own gate. It comes from the answer
 * when the answer carries one, and from the id renderGate minted otherwise, on
 * the gate_answer path and on the inline elicitation path. research.cjs ignores
 * the argument; the pair-screen flow stores it as approval_ref.
 *
 * Egress (Canon Part 8): this module holds no Brain, Theo or network reach. It
 * does not require research.cjs or any module under lib/mcp/tools/.
 *
 * CJS only. No em-dash or en-dash anywhere in this file.
 */

const gateRender = require('./gate-render.cjs');
const gateLedger = require('./gate-ledger.cjs');

function list(v) { return Array.isArray(v) ? v : []; }
function noDash(s) { return String(s == null ? '' : s).replace(/[\u2014\u2013]/g, '-'); }
function refuse(reason, extra) {
  return Object.assign({ ok: false, reason: reason }, extra || {});
}

// spec: { card, options, approving: [ids], rejecting: [ids], multi, resolve(chosen, answer, { gate_id }) }
//   options   the gate's option list (ids the navigator may choose)
//   approving option ids that count as a yes; anything else never executes
//   resolve   runs only on an approve verdict that names an approving option,
//             called with (chosen, answer, { gate_id }); it returns the plain result the navigator sees under chain_result
async function mintApprovalGate(server, ctx, sessionId, spec) {
  const approving = spec.approving.slice();
  const rejecting = list(spec.rejecting);
  // Set when renderGate returns. resumeFn reads it at call time, so the id of
  // this gate is known whenever resolve runs.
  let gateIdRef = null;

  function verdictFor(ids) {
    const picked = list(ids);
    if (picked.some(function (id) { return approving.indexOf(id) !== -1; })) return 'approve';
    if (picked.some(function (id) { return rejecting.indexOf(id) !== -1; })) return 'reject';
    return 'defer';
  }

  // Phase 289 review WR-02: the approving-id check below is a second line of
  // defense. gate_answer and chain_run refuse a verdict that disagrees with
  // chosen BEFORE the consume (the entry carries `approving`), so this refusal
  // is reachable only on the inline elicitation path, which calls resumeFn
  // directly with an answer verdictFor just derived. The refusals that remain
  // here and cannot be known earlier: approval_failed, when spec.resolve throws.
  // That one runs after the gate is spent (see the residual note at the consume
  // in gate.cjs gate_answer).
  async function resumeFn(answer) {
    const chosen = list(answer && answer.chosen);
    const verdict = answer && answer.verdict;
    if (verdict !== 'approve') {
      return { ok: true, executed: false, verdict: verdict || 'defer', note: spec.refusedNote || 'Nothing was written.' };
    }
    if (!chosen.some(function (id) { return approving.indexOf(id) !== -1; })) {
      return refuse('chosen_not_approving', { executed: false, note: 'An approve verdict must name an option that approves. Nothing was written.' });
    }
    try {
      return await spec.resolve(chosen, answer, { gate_id: (answer && answer.gate_id) || gateIdRef });
    } catch (_e) {
      return refuse('approval_failed', { executed: false });
    }
  }

  const gateCard = {
    // a title that is already a sentence (ends in . ? !) leads the question without a colon
    header: noDash((spec.card.title ? spec.card.title + (/[.?!]$/.test(spec.card.title) ? ' ' : ': ') : '') + (spec.card.question || '')),
    kind: 'general',
    select_mode: spec.multi === true ? 'multi' : 'single',
    selectMode: spec.multi === true ? 'multi' : 'single',
    options: spec.options,
  };
  const capabilities = gateRender.detectGateCapabilities(server, ctx);
  const renderCtx = { capabilities: capabilities, sessionId: sessionId, verdictFor: verdictFor };
  if (capabilities.elicitation && server && server.server && typeof server.server.elicitInput === 'function') {
    renderCtx.elicitInput = function (params) { return server.server.elicitInput(params); };
  }

  const result = await gateRender.renderGate(gateCard, renderCtx);
  const gateId = result.card.gate_id;
  gateIdRef = gateId;
  gateLedger.mintGate(gateId, {
    card: result.card,
    sessionId: sessionId,
    kind: 'material_step',
    resumeFn: resumeFn,
    // Phase 289 review CR-01: persisted so the consumers refuse a verdict that
    // disagrees with the chosen option before the consume.
    approving: approving,
    // Quick 261005-mux: the rung that showed the card. A dialog the navigator dismissed leaves the entry open
    // with renderer 'elicitation', and gate_answer then refuses a relayed answer for it (card_pending).
    renderer: gateRender.ledgerRenderer(result, renderCtx),
  });

  const out = { gate_id: gateId, renderer: result.renderer, rendered: result.rendered };
  // An inline answer (an elicitation round trip) is already the human's yes or
  // no: consume the gate so it cannot be replayed, then run the same resumeFn.
  if (result.answer) {
    const entry = gateLedger.consumeGate(gateId, sessionId);
    if (entry && entry.ok !== false && typeof entry.resumeFn === 'function') {
      out.answer = result.answer;
      out.resumed = await entry.resumeFn(result.answer);
    }
  }
  return out;
}

module.exports = { mintApprovalGate };
