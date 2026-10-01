'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 363 Plan 17 -- research_run: the Desktop and Cowork door to the research
 * planner.
 *
 * One MCP tool, ten ops, one facade. Every op calls lib/core/research-planner/
 * planner.cjs (or the quick and grants modules it fronts), so a plan is built,
 * a grant is approved and a run is filed exactly the way the CLI door does it
 * (D-02a, Canon Part 7). This file holds no engine logic: it resolves the bound
 * room, mints approval gates, and shapes answers.
 *
 * Approvals ride the ONE governed gate path (Canon Part 3, D-04, Part 11 R1):
 *   grant_request, deep_plan and basket mint a single-use material_step gate in
 *   lib/mcp/gate-ledger.cjs and render it through gate-render renderGate. The
 *   navigator answers through the existing gate_answer tool, which consumes the
 *   gate and calls the resumeFn minted here. There is no second gate path.
 *   - grant_request / deep_plan: the resumeFn writes the grant to the room
 *     (.mindrian/research-grants.json) and mints the decision node BEFORE it
 *     returns, because a gate id lives in this process only and evaporates on a
 *     restart (363-RESEARCH.md Pitfall 13).
 *   - basket: the resumeFn records the approved selection against the gate id in
 *     a process-local, single-use, session-scoped table. The file op reads that
 *     table; a gate id this tool never minted, never had answered, or that
 *     belongs to another session files nothing (T-198-10 spoof guard). A bare
 *     flag in the input is never authority.
 *
 * Deep runs: the deep research run itself executes in Claude Code. deep_plan
 * saves the plan under .mindrian/research-runs/<run_id>/, returns the F.6
 * Plan Review gate, and says so plainly (D-14 honest degrade). Quick runs need
 * no Agent tool, so run_quick executes here with native fetch after a grant
 * check on every search (Tri-Polar rule).
 *
 * Egress (Canon Part 8): inputs stay in this process; the only outbound strings
 * are quick-run search queries the grant covers. This tool opens no wire to any
 * remote service of its own and names no room data in its description.
 *
 * CJS only. No em-dash or en-dash anywhere in this file.
 */

const { z } = require('zod');

const gateRender = require('../gate-render.cjs');
const gateLedger = require('../gate-ledger.cjs');
const neverDoGate = require('../never-do-gate.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { resolveMcpSessionRoom } = require('../session-room.cjs');
const planner = require('../../core/research-planner/planner.cjs');
const quick = require('../../core/research-planner/quick.cjs');
const grants = require('../../core/research-planner/grants.cjs');
const structure = require('../../core/research-planner/structure.cjs');

// SEED-103: eureka_recall (stages 01-02 of the Eureka perspective, local graph +
// ICM structure, then a plan) and eureka_judge (stage 03, Stage A gates; judge
// 'none' on this surface, the host judges what comes back).
const OPS = Object.freeze(['planners', 'plan', 'grant_request', 'grant_status', 'grant_revoke', 'run_quick', 'deep_plan', 'basket', 'file', 'pending', 'eureka_recall', 'eureka_judge', 'eureka_candidates']);
const CANDIDATES_DEFAULT_LIMIT = 20;
const CANDIDATES_MAX_LIMIT = 100;
const eurekaRecall = require('../../core/research-planner/perspectives/eureka-recall.cjs');
const eurekaJudge = require('../../core/research-planner/perspectives/eureka-judge.cjs');
const APPROVED_VIA = 'mcp';
const FILE_NOTHING = 'file_nothing';
const APPROVAL_TTL_MS = gateLedger.LEDGER_TTL_MS;

// Approved basket selections, keyed by the consumed gate id. Process-local on
// purpose: filing is asked again after a restart, never carried across one.
const _approvedBaskets = new Map();

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------
function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function list(v) { return Array.isArray(v) ? v : []; }
function noDash(s) { return String(s == null ? '' : s).replace(/[\u2014\u2013]/g, '-'); }

function textResponse(payload) {
  const result = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  if (payload && payload.ok === false) result.isError = true;
  return result;
}

function refuse(reason, extra) {
  return Object.assign({ ok: false, reason: reason }, extra || {});
}

// An independent copy of the capability read the other gate tools carry (the
// disjoint-file seam: a tools/*.cjs module never requires another one).
const CLAUDE_HOST_SURFACES = ['cli', 'desktop', 'cowork'];

function detectClientCapabilities(server, ctx) {
  let elicitation = false;
  try {
    const caps = (server && server.server && typeof server.server.getClientCapabilities === 'function')
      ? server.server.getClientCapabilities()
      : null;
    elicitation = !!(caps && caps.elicitation);
  } catch (_e) {
    elicitation = false;
  }
  const surface = (ctx && typeof ctx.surface === 'string') ? ctx.surface : null;
  const claudeCode = !elicitation && surface !== null && CLAUDE_HOST_SURFACES.indexOf(surface) !== -1;
  return { elicitation: elicitation, claudeCode: claudeCode };
}

// The bound room, or an honest refusal. An unbound session floors to the
// process cwd, which is never a room this tool may write to.
function resolveRoom(sessionId, ctx, wanted) {
  const hit = resolveMcpSessionRoom({ sessionId: sessionId, ctx: ctx });
  if (!hit || !hit.dir || hit.source === 'cwd' || hit.source === 'none') {
    return refuse('no_room_bound', { message: 'Bind a room first (room_list, then room_bind), then ask again.' });
  }
  if (typeof wanted === 'string' && wanted.length > 0) {
    const base = String(hit.dir).split(/[\\/]/).filter(Boolean).pop();
    if (wanted !== hit.slug && wanted !== base) {
      return refuse('room_not_bound', { message: 'That is not the room this session is bound to.' });
    }
  }
  return { ok: true, dir: hit.dir };
}

function cardView(card) {
  if (!isObj(card)) return null;
  return {
    shape: card.shape,
    title: card.title,
    question: card.question,
    options: list(card.options).map(function (o) { return { id: o.id, label: o.label, recommended: o.recommended === true }; }),
    body_md: noDash(card.body_md || ''),
    payload: card.payload || {},
  };
}

// ---------------------------------------------------------------------------
// approval gates (Canon Part 3: the one governed gate path)
// ---------------------------------------------------------------------------
// spec: { card, options, approving: [ids], rejecting: [ids], multi, resolve(answer) }
//   options   the gate's option list (ids the navigator may choose)
//   approving option ids that count as a yes; anything else never executes
//   resolve   runs only on an approve verdict that names an approving option,
//             called with (chosen, answer); it returns the plain result the navigator sees under chain_result
async function mintApprovalGate(server, ctx, sessionId, spec) {
  const approving = spec.approving.slice();
  const rejecting = list(spec.rejecting);

  function verdictFor(ids) {
    const picked = list(ids);
    if (picked.some(function (id) { return approving.indexOf(id) !== -1; })) return 'approve';
    if (picked.some(function (id) { return rejecting.indexOf(id) !== -1; })) return 'reject';
    return 'defer';
  }

  async function resumeFn(answer) {
    const chosen = list(answer && answer.chosen);
    const verdict = answer && answer.verdict;
    if (verdict !== 'approve') {
      return { ok: true, executed: false, verdict: verdict || 'defer', note: 'Nothing was written.' };
    }
    if (!chosen.some(function (id) { return approving.indexOf(id) !== -1; })) {
      return refuse('chosen_not_approving', { executed: false, note: 'An approve verdict must name an option that approves. Nothing was written.' });
    }
    try {
      return await spec.resolve(chosen, answer);
    } catch (_e) {
      return refuse('approval_failed', { executed: false });
    }
  }

  const gateCard = {
    header: noDash((spec.card.title ? spec.card.title + ': ' : '') + (spec.card.question || '')),
    kind: 'general',
    select_mode: spec.multi === true ? 'multi' : 'single',
    selectMode: spec.multi === true ? 'multi' : 'single',
    options: spec.options,
  };
  const capabilities = detectClientCapabilities(server, ctx);
  const renderCtx = { capabilities: capabilities, sessionId: sessionId, verdictFor: verdictFor };
  if (capabilities.elicitation && server && server.server && typeof server.server.elicitInput === 'function') {
    renderCtx.elicitInput = function (params) { return server.server.elicitInput(params); };
  }

  const result = await gateRender.renderGate(gateCard, renderCtx);
  const gateId = result.card.gate_id;
  gateLedger.mintGate(gateId, {
    card: result.card,
    sessionId: sessionId,
    kind: 'material_step',
    resumeFn: resumeFn,
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

function grantOptions(card, allowRun) {
  const out = [];
  list(card && card.options).forEach(function (o) {
    if (o.id === 'approve_run' && !allowRun) return;
    out.push({ id: o.id, label: o.label, description: o.recommended === true ? 'Recommended' : undefined });
  });
  return out;
}

function grantSummary(g) {
  if (!isObj(g)) return null;
  return { grant_id: g.grant_id, lifetime: g.lifetime, version: g.version, expires_at: g.expires_at };
}

// ---------------------------------------------------------------------------
// ops
// ---------------------------------------------------------------------------
async function opPlan(env) {
  const i = env.input;
  if (!isObj(i.question_set)) return refuse('question_set_required');
  const built = planner.buildPlan(env.dir, i.question_set, i.mode ? { mode: i.mode } : {});
  if (!built || built.ok === false || !built.run_id) {
    return refuse('plan_invalid', { status: (built && built.status) || 'invalid', errors: list(built && built.errors).slice(0, 12).map(function (e) { return String(e).split(':')[0]; }) });
  }
  const loaded = planner.loadPlan(env.dir, built.run_id);
  if (!loaded.ok) return refuse(loaded.reason);
  const c = planner.cardFor(env.dir, loaded.plan, {});
  const out = {
    ok: true,
    op: 'plan',
    run_id: built.run_id,
    status: built.status,
    mode: built.mode,
    next: c.next,
    reason: c.reason || null,
    card: cardView(c.card),
    new_terms: list(c.new_terms),
    errors: built.errors,
    warnings: built.warnings,
    local_only_leaves: built.local_only_leaves,
  };
  if (c.next === 'grant') out.next_step = 'Ask for a grant: call research_run with op grant_request and this run_id.';
  else if (c.next === 'run_quick') out.next_step = 'A grant already covers every search: call research_run with op run_quick and this run_id.';
  else if (c.next === 'review') out.next_step = 'This is a deep plan: call research_run with op deep_plan and this run_id to review it.';
  else if (c.next === 'revise') out.next_step = 'The plan is not ready. Change the questions and call op plan again.';
  return out;
}

// SEED-104: the two typed refusals every grant path shares. Neither mints a gate.
function scopeStuckRefusal(runId, src) {
  return refuse('grant_scope_cannot_cover_plan', {
    run_id: runId,
    reask_reason: src.reask_reason || null,
    plan_families: list(src.plan_families),
    grant_families: list(src.grant_families),
    message: 'The standing grant already holds every search shape and term this plan needs, so approving again would leave the grant exactly as it is. Nothing was searched. Next steps: revise the plan, or revoke the grant with op grant_revoke and ask again.',
  });
}

function proseTermRefusal(runId) {
  return refuse('term_not_composed', {
    run_id: runId,
    message: 'A term in this plan is room text, not a short search term, so it cannot be sent. Nothing was searched. Rebuild the plan so each search term is a short plain phrase.',
  });
}

async function mintGrantGate(env, spec) {
  const card = spec.card;
  const options = grantOptions(card, spec.runId !== null);
  const approving = options.map(function (o) { return o.id; }).filter(function (id) { return id === 'approve_standing' || id === 'approve_run'; });
  const gate = await mintApprovalGate(env.server, env.ctx, env.sessionId, {
    card: card,
    options: options,
    approving: approving,
    rejecting: [],
    resolve: async function (chosen) {
      if (chosen.indexOf('approve_run') !== -1 && spec.runId) {
        const res = planner.approvePlanReview(env.dir, spec.runId, { approvedVia: APPROVED_VIA });
        if (!res.ok) return refuse(res.reason, { executed: false });
        return { ok: true, executed: true, lifetime: 'run', run_id: spec.runId, grant: grantSummary(res.grant), decision_node_id: res.decision_node_id || null, next: 'Call research_run with op run_quick and this run_id.' };
      }
      const res = planner.approveStandingGrant(env.dir, spec.proposal, { approvedVia: APPROVED_VIA, terms: spec.terms });
      if (!res.ok) return refuse(res.reason, { executed: false });
      return { ok: true, executed: true, lifetime: 'standing', grant: grantSummary(res.grant), decision_node_id: res.decision_node_id || null, next: spec.runId ? 'Call research_run with op run_quick and this run_id.' : 'The grant is saved in the room.' };
    },
  });
  return gate;
}

async function opGrantRequest(env) {
  const i = env.input;
  let proposal;
  let card;
  let newTerms = [];
  let runId = null;
  if (typeof i.run_id === 'string' && i.run_id.length > 0) {
    if (!planner.RUN_ID_RE.test(i.run_id)) return refuse('bad_run_id');
    const loaded = planner.loadPlan(env.dir, i.run_id);
    if (!loaded.ok) return refuse(loaded.reason);
    const c = planner.cardFor(env.dir, loaded.plan, {});
    if (c.next === 'run_quick') return { ok: true, op: 'grant_request', covered: true, run_id: i.run_id, next: 'run_quick', next_step: 'A grant already covers every search: call op run_quick.' };
    if (c.next === 'deep_run') return { ok: true, op: 'grant_request', covered: true, run_id: i.run_id, next: 'deep_run', deep_execution: deepLine(loaded.plan) };
    if (c.next === 'review') return refuse('use_deep_plan', { run_id: i.run_id, message: 'A deep plan is approved through op deep_plan.' });
    if (c.reason === 'grant_scope_cannot_cover_plan') return scopeStuckRefusal(i.run_id, c);
    if (c.reason === 'term_not_composed') return proseTermRefusal(i.run_id);
    if (c.next !== 'grant' || !c.card || !c.proposal) return refuse('plan_not_ready', { run_id: i.run_id, next: c.next, reason_detail: c.reason || null, card: cardView(c.card) });
    proposal = c.proposal;
    card = c.card;
    newTerms = list(c.new_terms);
    runId = i.run_id;
  } else {
    const prop = planner.proposeGrant(env.dir, { terms: i.terms });
    if (!prop.ok) return refuse(prop.reason);
    proposal = prop.proposal;
    card = prop.card;
    newTerms = list(i.terms).map(function (t) { return typeof t === 'string' ? t : (t && t.term); }).filter(Boolean);
  }
  const terms = list(i.terms).length > 0 ? i.terms : newTerms;
  const gate = await mintGrantGate(env, { card: card, proposal: proposal, terms: terms, runId: runId });
  return {
    ok: true,
    op: 'grant_request',
    run_id: runId,
    card: cardView(card),
    new_terms: newTerms,
    gate: gate,
    next_step: 'Show the card. When the navigator answers, call gate_answer with this gate_id. Nothing is saved until then.',
  };
}

function opGrantStatus(env) {
  const st = planner.grantStatus(env.dir);
  return { ok: true, op: 'grant_status', standing: st.standing || null, runs: list(st.runs), throttle: st.throttle };
}

function opGrantRevoke(env) {
  const id = env.input.grant_id;
  if (typeof id !== 'string' || !planner.GRANT_ID_RE.test(id)) return refuse('bad_grant_id');
  const res = grants.revokeGrant(env.dir, id, {});
  if (!res.ok) return refuse(res.reason);
  return { ok: true, op: 'grant_revoke', grant_id: id, revoked_at: res.grant.revoked_at, next_step: 'The next search under this grant stops. Ask for a new grant when you want to search again.' };
}

async function opRunQuick(env) {
  const runId = env.input.run_id;
  if (typeof runId !== 'string' || !planner.RUN_ID_RE.test(runId)) return refuse('bad_run_id');
  const loaded = planner.loadPlan(env.dir, runId);
  if (!loaded.ok) return refuse(loaded.reason);
  const res = await quick.runQuick(env.dir, loaded.plan, {});
  if (res.status === 'done') {
    return {
      ok: true,
      op: 'run_quick',
      status: 'done',
      run_id: res.run.run_id,
      verdict: res.run.verdict,
      answer_line: res.run.answer_line,
      escalation_offer: res.run.escalation_offer,
      card: cardView(res.card),
      state_dir: res.state_dir,
      next_step: 'Show the evidence card. To keep any of it, call op basket with this run_id: filing asks first.',
    };
  }
  if (res.status === 'reask') {
    const out = { ok: true, op: 'run_quick', status: 'reask', run_id: runId, reason: res.reason, card: cardView(res.card), new_terms: list(res.new_terms) };
    if (res.card && res.proposal) {
      out.gate = await mintGrantGate(env, { card: res.card, proposal: res.proposal, terms: list(res.new_terms), runId: runId });
      out.next_step = 'Nothing was searched. Show the grant card; when the navigator answers, call gate_answer, then op run_quick again.';
    }
    return out;
  }
  if (res.status === 'refused' && res.reason === 'grant_scope_cannot_cover_plan') return scopeStuckRefusal(runId, res);
  if (res.status === 'refused' && res.reason === 'term_not_composed') return proseTermRefusal(runId);
  return refuse('run_refused', { status: 'refused', detail: res.reason, errors: list(res.errors).slice(0, 8).map(function (e) { return String(e).split(':')[0]; }) });
}

function deepLine(plan) {
  const mins = Math.max(1, Math.round(((plan && plan.budget && plan.budget.time_budget_ms) || 1200000) / 60000));
  return 'The deep research run itself executes in Claude Code, not in this chat. The reviewed plan is saved at .mindrian/research-runs/'
    + (plan && plan.run_id ? plan.run_id : '<run_id>')
    + '/ so a Claude Code session can run it with the /mos:research command. An approval here lasts about '
    + mins + ' minutes; if it has lapsed by then, Claude Code asks again.';
}

async function opDeepPlan(env) {
  const i = env.input;
  let plan = null;
  let runId = null;
  if (typeof i.run_id === 'string' && i.run_id.length > 0) {
    if (!planner.RUN_ID_RE.test(i.run_id)) return refuse('bad_run_id');
    const loaded = planner.loadPlan(env.dir, i.run_id);
    if (!loaded.ok) return refuse(loaded.reason);
    plan = loaded.plan;
    runId = i.run_id;
  } else if (isObj(i.question_set)) {
    const built = planner.buildPlan(env.dir, i.question_set, { mode: 'deep' });
    if (!built || built.ok === false || !built.run_id) {
      return refuse('plan_invalid', { status: (built && built.status) || 'invalid', errors: list(built && built.errors).slice(0, 12).map(function (e) { return String(e).split(':')[0]; }) });
    }
    const loaded = planner.loadPlan(env.dir, built.run_id);
    if (!loaded.ok) return refuse(loaded.reason);
    plan = loaded.plan;
    runId = built.run_id;
  } else {
    return refuse('question_set_or_run_id_required');
  }
  if (plan.mode !== 'deep') return refuse('not_a_deep_plan', { run_id: runId, message: 'This plan is a quick run. Use op grant_request and op run_quick.' });
  const c = planner.cardFor(env.dir, plan, {});
  const base = { ok: true, op: 'deep_plan', run_id: runId, status: plan.status, mode: 'deep', next: c.next, reason: c.reason || null, card: cardView(c.card), deep_execution: deepLine(plan) };
  if (c.next === 'deep_run') {
    base.next_step = 'This plan is already approved. Run it from Claude Code.';
    return base;
  }
  if (c.next === 'needs_limiter') {
    base.next_step = 'Ask the navigator what actually blocks this gap, in their own words, then add it, word for word, as a limiter in the question set and call op plan again. Nothing runs until a limiter is named.';
    return base;
  }
  if (c.next !== 'review' || !c.card) {
    base.next_step = 'The plan is not ready to review. Change the questions and call op deep_plan again.';
    return base;
  }
  base.gate = await mintApprovalGate(env.server, env.ctx, env.sessionId, {
    card: c.card,
    options: list(c.card.options).map(function (o) { return { id: o.id, label: o.label, description: o.recommended === true ? 'Recommended' : undefined }; }),
    approving: ['run'],
    rejecting: ['stop'],
    resolve: async function () {
      const res = planner.approvePlanReview(env.dir, runId, { approvedVia: APPROVED_VIA });
      if (!res.ok) return refuse(res.reason, { executed: false });
      return { ok: true, executed: true, run_id: runId, grant: grantSummary(res.grant), decision_node_id: res.decision_node_id || null, fetched: false, deep_execution: deepLine(plan) };
    },
  });
  base.next_step = 'Show the plan card. When the navigator answers, call gate_answer with this gate_id. Approving saves the approval; nothing is fetched here.';
  return base;
}

async function opBasket(env) {
  const runId = env.input.run_id;
  if (typeof runId !== 'string' || !planner.RUN_ID_RE.test(runId)) return refuse('bad_run_id');
  const b = planner.basketFor(env.dir, runId);
  if (!b.ok) return refuse(b.reason);
  const known = {};
  b.items.forEach(function (it) { known[it.id] = true; });
  const options = b.items.map(function (it) {
    return { id: it.id, label: noDash(it.label), description: it.default_on ? 'On by default' : 'Off by default' };
  });
  options.push({ id: FILE_NOTHING, label: 'File nothing' });
  const gate = await mintApprovalGate(env.server, env.ctx, env.sessionId, {
    card: b.card,
    options: options,
    multi: true,
    approving: b.items.map(function (it) { return it.id; }),
    rejecting: [FILE_NOTHING],
    resolve: async function (chosen, answer) {
      const items = chosen.filter(function (id) { return id !== FILE_NOTHING && known[id] === true; });
      if (items.length === 0) return { ok: true, executed: false, note: 'Nothing was selected, so nothing will be filed.' };
      pruneApprovals();
      _approvedBaskets.set(answer.gate_id, { roomDir: env.dir, runId: runId, items: items, sessionKey: gateLedger.ledgerSessionKey(env.sessionId), at: Date.now() });
      return { ok: true, executed: false, approved_for_filing: true, items: items.length, next: 'Call research_run with op file and this gate_id to write the selection to the room.' };
    },
  });
  return {
    ok: true,
    op: 'basket',
    run_id: runId,
    items: b.items.map(function (it) { return { id: it.id, label: noDash(it.label), default_on: it.default_on === true }; }),
    card: cardView(b.card),
    gate: gate,
    next_step: 'Show the basket. The navigator answers with gate_answer, choosing the items to file (or file_nothing). Then call op file with this gate_id.',
  };
}

function pruneApprovals() {
  const now = Date.now();
  Array.from(_approvedBaskets.keys()).forEach(function (k) {
    const rec = _approvedBaskets.get(k);
    if (!rec || now - rec.at > APPROVAL_TTL_MS) _approvedBaskets.delete(k);
  });
}

function opFile(env) {
  const gateId = env.input.gate_id;
  if (typeof gateId !== 'string' || gateId.length === 0) return refuse('gate_id_required', { message: 'Filing needs the basket gate id, answered through gate_answer.' });
  pruneApprovals();
  const rec = _approvedBaskets.get(gateId);
  if (!rec) return refuse('no_approved_basket', { message: 'No approved basket for that gate id. Ask for a basket, answer it through gate_answer, then file.' });
  if (rec.sessionKey !== gateLedger.ledgerSessionKey(env.sessionId)) return refuse('session_mismatch');
  if (rec.roomDir !== env.dir) return refuse('room_mismatch');
  _approvedBaskets.delete(gateId); // single use, whatever filing answers
  const res = planner.fileFromState(env.dir, rec.runId, { approved: true, items: rec.items }, { approvedVia: APPROVED_VIA });
  return Object.assign({ op: 'file', run_id: rec.runId }, res, { ok: res && res.ok === true });
}

async function opEurekaRecall(env) {
  const i = env.input;
  const budgets = {};
  if (typeof i.max_candidates === 'number') budgets.max_candidates = i.max_candidates;
  let rec;
  try {
    rec = eurekaRecall.runRecall(env.dir, { budgets: budgets, tag: i.run_tag });
  } catch (_e) {
    return refuse('recall_failed', { hint: 'The room graph could not be read. Check that the room is bound (op planners) and that .mindrian/room.db exists.' });
  }
  const out = {
    ok: true,
    op: 'eureka_recall',
    run_tag: rec.tag,
    counts: rec.counts,
    pairs_truncated: rec.pairs_truncated,
    couplings: rec.couplings,
    top: rec.candidates.slice(0, 10).map(function (c) {
      return { a: c.a, b: c.b, section_a: c.section_a, section_b: c.section_b, title_a: c.title_a, title_b: c.title_b, lanes: c.lanes, shared_entities: c.shared_entities };
    }),
    plan: null,
    next_step: null,
  };
  if (rec.candidates.length === 0) {
    out.next_step = 'No unconnected cross-section pairs were recalled. Add content in a second section, or lower nothing: the room already connects what it holds.';
    return out;
  }
  const built = planner.buildPlan(env.dir, rec.question_set, i.mode ? { mode: i.mode } : {});
  if (!built || built.ok === false || !built.run_id) {
    out.plan = { ok: false, status: (built && built.status) || 'invalid', errors: list(built && built.errors).slice(0, 12).map(function (e) { return String(e).split(':')[0]; }) };
    out.next_step = 'Candidates are in ' + rec.run_dir + '. The plan did not validate; call op eureka_judge with this run_tag, then op plan with an edited question set.';
    return out;
  }
  const loaded = planner.loadPlan(env.dir, built.run_id);
  const c = loaded.ok ? planner.cardFor(env.dir, loaded.plan, {}) : { next: null, card: null };
  out.plan = { ok: true, run_id: built.run_id, status: built.status, mode: built.mode, next: c.next, card: cardView(c.card), warnings: built.warnings };
  out.next_step = 'Candidates are in ' + rec.run_dir + '. Call op eureka_judge with run_tag ' + rec.tag + ' for the Stage A gates, then '
    + (c.next === 'grant' ? 'op grant_request with run_id ' + built.run_id : c.next === 'run_quick' ? 'op run_quick with run_id ' + built.run_id : 'op plan again after editing the questions') + '.';
  return out;
}

async function opEurekaJudge(env) {
  const i = env.input;
  if (!nonEmptyStr(i.run_tag)) return refuse('run_tag_required', { hint: 'Pass the run_tag that op eureka_recall returned.' });
  let res;
  try {
    res = await eurekaJudge.runJudge(env.dir, i.run_tag, { judge: 'none' });
  } catch (_e) {
    return refuse('judge_failed');
  }
  if (!res.ok) return refuse(res.reason, { hint: 'No candidates file for that run_tag. Run op eureka_recall first, or pass one of its run_tag values.' });
  return {
    ok: true,
    op: 'eureka_judge',
    run_tag: i.run_tag,
    summary: res.summary,
    passed: res.rows.filter(function (r) { return r.stage_a && r.stage_a.pass; }).slice(0, 25).map(function (r) { return { a: r.a, b: r.b, section_a: r.section_a, section_b: r.section_b, lanes: r.lanes }; }),
    next_step: 'Stage A verdicts are in the run folder. The judge on this surface is none: read the passed pairs and judge them yourself, or run scripts/eureka-jev-judge.cjs in Claude Code for the Jev first pass (human-routed at band medium).',
  };
}

function nonEmptyStr(v) { return typeof v === 'string' && v.trim().length > 0; }

// eureka_candidates: page through a run's candidates (and verdicts when the
// judge stage has run) so a surface without file access can read and judge
// them. Pagination per MCP best practice: limit, offset, has_more, next_offset,
// total.
function opEurekaCandidates(env) {
  const i = env.input;
  if (!nonEmptyStr(i.run_tag)) return refuse('run_tag_required', { hint: 'Pass the run_tag that op eureka_recall returned.' });
  const read = eurekaRecall.readCandidates(env.dir, i.run_tag);
  if (!read) return refuse('candidates_missing', { hint: 'No candidates file for that run_tag. Run op eureka_recall first.' });
  const verdicts = eurekaJudge.readVerdicts(env.dir, i.run_tag) || [];
  const byPair = {};
  verdicts.forEach(function (v) { byPair[v.a + '|' + v.b] = v; });
  const limit = (typeof i.limit === 'number') ? i.limit : CANDIDATES_DEFAULT_LIMIT;
  const offset = (typeof i.offset === 'number') ? i.offset : 0;
  const total = read.candidates.length;
  const items = read.candidates.slice(offset, offset + limit).map(function (c, k) {
    const v = byPair[c.a + '|' + c.b] || null;
    return {
      rank: offset + k + 1,
      a: c.a, b: c.b, section_a: c.section_a, section_b: c.section_b, title_a: c.title_a, title_b: c.title_b,
      lanes: c.lanes, shared_entities: c.shared_entities,
      stage_a: v ? v.stage_a : null, judge: v ? v.judge : null, choice: v ? v.choice : null, band: v ? v.band : null,
    };
  });
  return {
    ok: true,
    op: 'eureka_candidates',
    run_tag: i.run_tag,
    total: total,
    count: items.length,
    offset: offset,
    has_more: offset + items.length < total,
    next_offset: offset + items.length < total ? offset + items.length : null,
    header: read.header,
    judged: verdicts.length > 0,
    items: items,
    next_step: verdicts.length > 0 ? 'Judge each pair yourself: does the mechanism transfer, or only the words; does the room already know it. Then op plan or op run_quick on the plan eureka_recall built.' : 'Call op eureka_judge with this run_tag for the Stage A gates, then read this page again.',
  };
}

// Phase 365-13 (D-14, D-26): the follow-up "Reject and never do this" gate for the
// room-started cards that carry a pre-filled proposal, and the halted_constraint card
// rendered as a Shape F gate through the one gate-render ladder and the gate ledger.
// Response data only; a failure to mint leaves the card exactly as it was.
async function attachNeverDoGates(env, cards) {
  const mintOpts = {
    roomDir: env.dir,
    sessionId: env.sessionId,
    capabilities: detectClientCapabilities(env.server, env.ctx),
    surface: (env.ctx && typeof env.ctx.surface === 'string') ? env.ctx.surface : null,
  };
  for (let n = 0; n < cards.length; n += 1) {
    const c = cards[n];
    if (!isObj(c) || !isObj(c.card)) continue;
    const payload = isObj(c.card.payload) ? c.card.payload : {};
    try {
      if (c.kind === 'plan_card_no_grant' && isObj(payload.never_do_proposal)) {
        const minted = await neverDoGate.mintProposalGate(payload.never_do_proposal, mintOpts);
        if (minted.ok) {
          c.never_do_gate = {
            gate_id: minted.gate_id,
            renderer: minted.renderer,
            rendered: minted.rendered,
            proposal: minted.proposal,
            next_step: neverDoGate.NEVER_DO_NEXT_STEP,
          };
        }
      } else if (c.kind === 'halted_constraint') {
        const minted = await neverDoGate.mintHaltedConstraintGate(c.card, mintOpts);
        if (minted.ok) c.gate = { gate_id: minted.gate_id, renderer: minted.renderer, rendered: minted.rendered };
      }
    } catch (_e) {
      /* the card stays as it was */
    }
  }
  return cards;
}

async function opPending(env) {
  const cards = planner.pendingCards(env.dir);
  const seen = {};
  cards.forEach(function (c) { if (!seen[c.run_id]) { seen[c.run_id] = true; planner.markSurfaced(env.dir, c.run_id); } });
  await attachNeverDoGates(env, cards);
  return { ok: true, op: 'pending', cards: cards, _pending_taken: true };
}

// ---------------------------------------------------------------------------
// the tool
// ---------------------------------------------------------------------------
const termSchema = z.union([
  z.string().min(1).max(80),
  z.object({ term: z.string().min(1).max(80), synonyms: z.array(z.string().min(1).max(80)).max(10).optional() }),
]);

const inputSchema = z.object({
  op: z.enum(OPS, { errorMap: function () { return { message: 'unknown op' }; } }),
  room: z.string().max(200).optional(),
  question_set: z.record(z.string(), z.unknown()).optional(),
  run_id: z.string().max(64).optional(),
  grant_id: z.string().max(32).optional(),
  gate_id: z.string().max(96).optional(),
  mode: z.enum(['quick', 'deep']).optional(),
  terms: z.array(termSchema).max(20).optional(),
  max_candidates: z.number().int().min(1).max(2000).optional(),
  run_tag: z.string().regex(/^[0-9TZ]{1,20}$/).optional(),
  limit: z.number().int().min(1).max(CANDIDATES_MAX_LIMIT).optional(),
  offset: z.number().int().min(0).optional(),
});

const DESCRIPTION = 'Research planner for the bound room: plan a quick or deep research run, ask for a grant that lets the room search a public scholarly index, run quick research here and get an evidence card, review a deep plan, and file findings only after the navigator approves. Approvals are gates answered through gate_answer. Quick runs execute in this server; the deep research run itself executes in Claude Code, where the approved plan is saved. The Eureka perspective lives here too: op eureka_recall reads the local graph and the ICM structure (no embeddings, no network) and proposes unconnected cross-section pairs plus a plan; op eureka_candidates pages through them (limit, offset); op eureka_judge runs the local Stage A gates and leaves judgment to you. Nothing leaves the room except grant-approved search strings.';

function register(server, ctx) {
  server.registerTool(
    'research_run',
    {
      title: 'Research Run',
      description: DESCRIPTION,
      inputSchema: inputSchema,
      // MCP tool annotations (hints, not guarantees). The tool is a router over
      // ops: some read, some write proposed-only rows, none deletes; quick runs
      // reach a public index, so the world is open.
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (input, extra) => {
      const i = isObj(input) ? input : {};
      if (OPS.indexOf(i.op) === -1) return textResponse(refuse('unknown_op'));
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const room = resolveRoom(sessionId, ctx, i.room);
      if (!room.ok) return textResponse(room);
      const env = { server: server, ctx: ctx, sessionId: sessionId, dir: room.dir, input: i };
      let out;
      try {
        switch (i.op) {
          case 'planners': {
            const res = structure.plannersForRoom({ roomDir: env.dir });
            out = Object.assign({ ok: true, op: 'planners' }, res);
            break;
          }
          case 'plan': out = await opPlan(env); break;
          case 'grant_request': out = await opGrantRequest(env); break;
          case 'grant_status': out = opGrantStatus(env); break;
          case 'grant_revoke': out = opGrantRevoke(env); break;
          case 'run_quick': out = await opRunQuick(env); break;
          case 'deep_plan': out = await opDeepPlan(env); break;
          case 'basket': out = await opBasket(env); break;
          case 'file': out = opFile(env); break;
          case 'pending': out = await opPending(env); break;
          case 'eureka_recall': out = await opEurekaRecall(env); break;
          case 'eureka_judge': out = await opEurekaJudge(env); break;
          case 'eureka_candidates': out = opEurekaCandidates(env); break;
          default: out = refuse('unknown_op');
        }
      } catch (_e) {
        out = refuse('internal_error');
      }
      // Room-started cards ride along exactly once (D-06): the pending op has
      // already taken and marked them.
      if (out && out._pending_taken) {
        delete out._pending_taken;
        out.pending_cards = [];
      } else if (out) {
        try {
          const cards = planner.pendingCards(env.dir);
          const seen = {};
          cards.forEach(function (c) { if (!seen[c.run_id]) { seen[c.run_id] = true; planner.markSurfaced(env.dir, c.run_id); } });
          await attachNeverDoGates(env, cards);
          out.pending_cards = cards;
        } catch (_e) {
          out.pending_cards = [];
        }
      }
      return textResponse(out);
    }
  );
}

// Born-wired SOURCE of truth (Part 11 R1/R16). scripts/build-connector-registry.cjs
// discovers this export and regenerates data/mcp-tool-connectors.json and
// data/connector-registry.json from it; never hand-edit either generated file.
// An MCP tool descriptor carries no hitl_stages, so the shape is declared
// directly as F.6 (D-14).
const connectors = [
  {
    tool: 'research_run',
    surface: 'research_run',
    connector: 'mcp-tool',
    hitl_shape: 'F.6',
    hitl_why: 'Deep research plans are reviewed on an F.6 Plan Review card before any fetch; quick runs ask on an F.0 grant card; filing asks on an F.8 basket.',
    layer: 'harness',
    layer_why: 'Mints gate_render payloads through gate-ledger material_step gates and persists grants on approval; a gate-ledger tool, the rubric\'s own step 3 signal.',
  },
];

module.exports = {
  register: register,
  connectors: connectors,
  _internal: {
    OPS: OPS,
    inputSchema: inputSchema,
    approvedBaskets: _approvedBaskets,
    detectClientCapabilities: detectClientCapabilities,
    deepLine: deepLine,
  },
};
