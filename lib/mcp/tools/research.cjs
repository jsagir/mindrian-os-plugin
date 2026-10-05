'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 363 Plan 17 -- research_run: the Desktop and Cowork door to the research
 * planner.
 *
 * One MCP tool, ten core ops plus the perspective ops (and their deprecated eureka_* aliases), one facade. Every op calls lib/core/research-planner/
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
 * are quick-run search queries the grant covers. A navigator-released canon
 * term ({raw: term}) leaves only through canon-release, on its own single-use
 * gate answered through gate_answer, and only with the theo egress line on and
 * the release transport enabled (MOS_366_THEO_REPLAY or MOS_366_LIVE=1, the same
 * rule as the CLI door). This tool opens no wire to any remote service of its
 * own and names no room data in its description.
 *
 * CJS only. No em-dash or en-dash anywhere in this file.
 */

const { z } = require('zod');

const gateRender = require('../gate-render.cjs');
const gateLedger = require('../gate-ledger.cjs');
const neverDoGate = require('../never-do-gate.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { resolveMcpWriteRoom, NO_BOUND_ROOM, NO_BOUND_ROOM_MESSAGE } = require('../session-room.cjs');
const planner = require('../../core/research-planner/planner.cjs');
const quick = require('../../core/research-planner/quick.cjs');
const grants = require('../../core/research-planner/grants.cjs');
const structure = require('../../core/research-planner/structure.cjs');
const canonRelease = require('../../core/research-planner/canon-release.cjs');

// SEED-103 / Phase 366 plan 12 (D-07): one perspective op set serves every
// MOS-CANVAS perspective. perspective_recall (stages 01-02: local graph + ICM
// structure, then a plan), perspective_candidates (a paginated read of the
// candidates and verdicts) and perspective_judge (stage 03, Stage A gates; judge
// 'none' on this surface, the host judges what comes back). The perspective is
// one id from the registry (perspectives/index.cjs); the module is looked up by
// that id only. eureka_recall, eureka_candidates and eureka_judge stay for one
// release as deprecated aliases: same body, legacy op name, deprecated true and
// use_instead (355 D-26: never a silent rename).
const OPS = Object.freeze(['planners', 'plan', 'grant_request', 'grant_status', 'grant_revoke', 'run_quick', 'deep_plan', 'basket', 'file', 'pending', 'perspective_recall', 'perspective_candidates', 'perspective_judge', 'eureka_recall', 'eureka_judge', 'eureka_candidates']);
const CANDIDATES_DEFAULT_LIMIT = 20;
const CANDIDATES_MAX_LIMIT = 100;
const perspectives = require('../../core/research-planner/perspectives/index.cjs');
const { PERSPECTIVE_IDS } = perspectives;
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

// The capability read is a one-line delegate to the one shared ruling,
// gateRender.detectGateCapabilities (lib/mcp/gate-render.cjs, navigator ruling
// 2026-10-02: a Claude host surface gets the card). gate-render.cjs is not a
// tools/*.cjs module, so the disjoint-file seam holds.
function detectClientCapabilities(server, ctx) {
  return gateRender.detectGateCapabilities(server, ctx);
}

// Who may write: the room comes from resolveMcpWriteRoom, the write-authority
// gate every room-writing MCP tool shares (RCA desktop-session-binding-fallback,
// quick 261002-e9v). The registry active room is not write authority for a
// session that has an id but never bound a room, so the call is refused up
// front instead of starting a research flow there and failing later at
// gate_answer.
// Carve-outs kept by that gate: a session-less caller, a CLAUDE_ACTIVE_ROOM
// operator pin, and a boot-fallback room that exists.
// The process cwd floor is still refused here: this tool has never accepted it.
// Reason change: the unbound refusal moved from no_room_bound to no_bound_room,
// the typed reason every room-writing tool returns. The old string had no
// consumer anywhere in the repo. room_not_bound is unchanged.
function resolveRoom(sessionId, ctx, wanted) {
  const hit = resolveMcpWriteRoom({ sessionId: sessionId, ctx: ctx });
  if (!hit.ok) return Object.assign({}, hit.refusal);
  if (hit.source === 'cwd') return refuse(NO_BOUND_ROOM, { message: NO_BOUND_ROOM_MESSAGE });
  if (typeof wanted === 'string' && wanted.length > 0) {
    const base = String(hit.dir).split(/[\\/]/).filter(Boolean).pop();
    if (wanted !== hit.slug && wanted !== base) {
      return refuse('room_not_bound', { message: 'That is not the room this session is bound to.' });
    }
  }
  return { ok: true, dir: hit.dir };
}

// The gate-ledger session key for this call. gate_answer resolves the same session id (resolveEffectiveSessionId) and
// consumeGate runs it through gateLedger.ledgerSessionKey, so every mint and every compare here goes through that one
// shared resolver and never a parallel derivation. A session-less stdio caller gets the ledger's own process-scoped key.
function ledgerKeyFor(env) {
  return gateLedger.ledgerSessionKey(env.sessionId);
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

function grantOptions(card, allowRun) {
  const out = [];
  list(card && card.options).forEach(function (o) {
    if (o.id === 'approve_run' && !allowRun) return;
    out.push({ id: o.id, label: o.label, description: o.recommended === true ? 'Recommended' : undefined, recommended: o.recommended === true });
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
  const res = await quick.runQuick(env.dir, loaded.plan, { offline: env.input.offline === true });
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
  if (res.status === 'plan_only') {
    // Typed plan-only answer (366-17): the egress line is off or offline was asked. Nothing was sent, no run state
    // or audit row was written, and the plan is intact. res.line comes from the closed policy vocabulary.
    const offline = res.offline === true;
    return {
      ok: true,
      op: 'run_quick',
      status: 'plan_only',
      run_id: runId,
      reason: res.reason,
      line: res.line,
      offline: offline,
      sent: false,
      outcome: res.outcome,
      answer_line: res.answer_line,
      card: cardView(res.card),
      ignored: list(res.ignored),
      next_step: offline
        ? 'Nothing was sent: offline was on. The plan is intact; call op run_quick without offline to search.'
        : 'Nothing was sent: the room egress policy (.mindrian/egress-policy.json) turns the ' + res.line + ' line off. The plan is intact. To search, turn that line back on in the room policy, then call op run_quick again.',
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
    options: list(c.card.options).map(function (o) { return { id: o.id, label: o.label, description: o.recommended === true ? 'Recommended' : undefined, recommended: o.recommended === true }; }),
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
  // The release transport is chosen by the environment, the same rule as the CLI door (quick 261002-cud DR-1).
  // The mint key comes from the shared ledger resolver (ledgerKeyFor), so gate_answer's consume agrees with it even for a
  // session-less stdio caller.
  const transport = canonRelease.transportFromEnv(process.env);
  const b = planner.basketFor(env.dir, runId, transport.ok ? { sessionId: ledgerKeyFor(env), deps: transport.deps } : {});
  if (!b.ok) return refuse(b.reason);
  // DR-2: the filing gate carries fileable items only. Release offers ride their own gates; confirms are listed.
  const fileItems = b.items.filter(function (it) { return !canonRelease.isCanonItemId(it.id); });
  const releaseItems = b.items.filter(function (it) { return it.kind === 'canon_release'; });
  const confirmItems = b.items.filter(function (it) { return it.kind === 'canon_confirm'; });
  const known = {};
  fileItems.forEach(function (it) { known[it.id] = true; });
  const options = fileItems.map(function (it) {
    return { id: it.id, label: noDash(it.label), description: it.default_on ? 'On by default' : 'Off by default', recommended: it.default_on === true };
  });
  options.push({ id: FILE_NOTHING, label: 'File nothing' });
  const gate = await mintApprovalGate(env.server, env.ctx, env.sessionId, {
    card: b.card,
    options: options,
    multi: true,
    approving: fileItems.map(function (it) { return it.id; }),
    rejecting: [FILE_NOTHING],
    resolve: async function (chosen, answer) {
      const items = chosen.filter(function (id) { return id !== FILE_NOTHING && known[id] === true; });
      if (items.length === 0) return { ok: true, executed: false, note: 'Nothing was selected, so nothing will be filed.' };
      pruneApprovals();
      _approvedBaskets.set(answer.gate_id, { roomDir: env.dir, runId: runId, items: items, sessionKey: ledgerKeyFor(env), at: Date.now() });
      return { ok: true, executed: false, approved_for_filing: true, items: items.length, next: 'Call research_run with op file and this gate_id to write the selection to the room.' };
    },
  });
  const releaseOffers = releaseItems.map(function (it) {
    const gateId = typeof it.gate_id === 'string' && it.gate_id.length > 0 ? it.gate_id : null;
    // The offer carries the off note exactly when the room's egress policy turns its line off.
    const lineOff = it.note === canonRelease.OFF_NOTE;
    let why = null;
    if (gateId === null) why = lineOff ? 'egress_line_off' : (!transport.ok ? transport.reason : 'gate_not_minted');
    return {
      item_id: it.id,
      term: it.term,
      gate_id: gateId,
      line_on: !lineOff,
      card: cardView(canonRelease.releaseCard(it)),
      unavailable_reason: why,
      note: it.note || (gateId === null && transport.hint) || null,
    };
  });
  const confirms = confirmItems.map(function (it) {
    return {
      item_id: it.id,
      term: it.term,
      canon_name: it.canon_name,
      next_step: 'This translation is proposed and not used yet. Confirming it runs from Claude Code with the canon-confirm command of scripts/research-planner.cjs; this surface does not confirm it yet.',
    };
  });
  let nextStep = 'Show the basket. The navigator answers with gate_answer, choosing the items to file (or file_nothing). Then call op file with this gate_id.';
  if (releaseOffers.some(function (o) { return o.gate_id !== null; })) {
    nextStep += ' Each release offer is its own decision: show its card, and when the navigator answers call gate_answer with that offer\'s gate_id, choosing release or not_now. A release sends the term only and files nothing.';
  }
  return {
    ok: true,
    op: 'basket',
    run_id: runId,
    items: fileItems.map(function (it) { return { id: it.id, label: noDash(it.label), default_on: it.default_on === true }; }),
    release_offers: releaseOffers,
    confirm_items: confirms,
    card: cardView(b.card),
    gate: gate,
    next_step: nextStep,
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
  if (rec.sessionKey !== ledgerKeyFor(env)) return refuse('session_mismatch');
  if (rec.roomDir !== env.dir) return refuse('room_mismatch');
  _approvedBaskets.delete(gateId); // single use, whatever filing answers
  const res = planner.fileFromState(env.dir, rec.runId, { approved: true, items: rec.items }, { approvedVia: APPROVED_VIA });
  return Object.assign({ op: 'file', run_id: rec.runId }, res, { ok: res && res.ok === true });
}

const GENERIC_NAMES = Object.freeze({ recall: 'perspective_recall', judge: 'perspective_judge' });
const EUREKA_NAMES = Object.freeze({ recall: 'eureka_recall', judge: 'eureka_judge' });

function nonEmptyStr(v) { return typeof v === 'string' && v.trim().length > 0; }

// deprecate(out, legacyOp, newOp): the alias answer is the new op's body under
// the legacy op name, marked deprecated with the op to use instead.
function deprecate(out, legacyOp, newOp) {
  if (!isObj(out)) return out;
  return Object.assign({}, out, { op: legacyOp, deprecated: true, use_instead: newOp });
}

// The perspective module for this call, or an honest refusal (a reason and a
// hint that names the next op). The id is looked up in the frozen registry map
// only; the zod enum already stops an unknown id at the edge.
function perspectiveFor(id) {
  if (!nonEmptyStr(id)) {
    return { refusal: refuse('perspective_required', { hint: 'Pass perspective, one of ' + PERSPECTIVE_IDS.join(', ') + ' (eureka is the first one to try).' }) };
  }
  const mod = perspectives.getPerspective(id);
  if (!mod) {
    return { refusal: refuse('perspective_unavailable', { hint: 'That perspective is not available in this install. Pass one of ' + PERSPECTIVE_IDS.join(', ') + '.' }) };
  }
  return { mod: mod };
}

async function opPerspectiveRecall(env, id, names) {
  const nm = names || GENERIC_NAMES;
  const i = env.input;
  const hit = perspectiveFor(id);
  if (hit.refusal) return hit.refusal;
  const mod = hit.mod;
  const budgets = {};
  if (typeof i.max_candidates === 'number') budgets.max_candidates = i.max_candidates;
  let rec;
  try {
    rec = mod.runRecall(env.dir, { budgets: budgets, tag: i.run_tag });
  } catch (_e) {
    return refuse('recall_failed', { hint: 'The room graph could not be read. Check that the room is bound (op planners) and that .mindrian/room.db exists.' });
  }
  const out = {
    ok: true,
    op: nm.recall,
    perspective: id,
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
  if (rec.statement_template !== undefined && rec.statement_template !== null) out.statement_template = rec.statement_template;
  if (rec.candidates.length === 0) {
    out.next_step = 'No candidate pairs were recalled for ' + id + '. Add content in a second section, or lower nothing: the room already connects what it holds.';
    return out;
  }
  const built = planner.buildPlan(env.dir, rec.question_set, i.mode ? { mode: i.mode } : {});
  if (!built || built.ok === false || !built.run_id) {
    out.plan = { ok: false, status: (built && built.status) || 'invalid', errors: list(built && built.errors).slice(0, 12).map(function (e) { return String(e).split(':')[0]; }) };
    out.next_step = 'Candidates are in ' + rec.run_dir + '. The plan did not validate; call op ' + nm.judge + ' with this run_tag, then op plan with an edited question set.';
    return out;
  }
  const loaded = planner.loadPlan(env.dir, built.run_id);
  const c = loaded.ok ? planner.cardFor(env.dir, loaded.plan, {}) : { next: null, card: null };
  out.plan = { ok: true, run_id: built.run_id, status: built.status, mode: built.mode, next: c.next, card: cardView(c.card), warnings: built.warnings };
  out.next_step = 'Candidates are in ' + rec.run_dir + '. Call op ' + nm.judge + ' with run_tag ' + rec.tag + ' for the Stage A gates, then '
    + (c.next === 'grant' ? 'op grant_request with run_id ' + built.run_id : c.next === 'run_quick' ? 'op run_quick with run_id ' + built.run_id : 'op plan again after editing the questions') + '.';
  return out;
}

async function opPerspectiveJudge(env, id, names) {
  const nm = names || GENERIC_NAMES;
  const i = env.input;
  const hit = perspectiveFor(id);
  if (hit.refusal) return hit.refusal;
  if (!nonEmptyStr(i.run_tag)) return refuse('run_tag_required', { hint: 'Pass the run_tag that op ' + nm.recall + ' returned.' });
  let res;
  try {
    res = await eurekaJudge.runJudge(env.dir, i.run_tag, { judge: 'none', module: hit.mod });
  } catch (_e) {
    return refuse('judge_failed');
  }
  if (!res.ok) return refuse(res.reason, { hint: 'No candidates file for that run_tag. Run op ' + nm.recall + ' first, or pass one of its run_tag values.' });
  return {
    ok: true,
    op: nm.judge,
    perspective: id,
    run_tag: i.run_tag,
    summary: res.summary,
    passed: res.rows.filter(function (r) { return r.stage_a && r.stage_a.pass; }).slice(0, 25).map(function (r) { return { a: r.a, b: r.b, section_a: r.section_a, section_b: r.section_b, lanes: r.lanes }; }),
    next_step: 'Stage A verdicts are in the run folder. The judge on this surface is none: read the passed pairs and judge them yourself, or run scripts/eureka-jev-judge.cjs in Claude Code for the Jev first pass (human-routed at band medium).',
  };
}

// perspective_candidates: page through a run's candidates (and verdicts when the
// judge stage has run) so a surface without file access can read and judge
// them. Pagination per MCP best practice: limit, offset, has_more, next_offset,
// total; limit is capped at CANDIDATES_MAX_LIMIT by the schema.
function opPerspectiveCandidates(env, id, names) {
  const nm = names || GENERIC_NAMES;
  const i = env.input;
  const hit = perspectiveFor(id);
  if (hit.refusal) return hit.refusal;
  const mod = hit.mod;
  if (!nonEmptyStr(i.run_tag)) return refuse('run_tag_required', { hint: 'Pass the run_tag that op ' + nm.recall + ' returned.' });
  const read = mod.readCandidates(env.dir, i.run_tag);
  if (!read) return refuse('candidates_missing', { hint: 'No candidates file for that run_tag. Run op ' + nm.recall + ' first.' });
  const verdicts = eurekaJudge.readVerdicts(env.dir, i.run_tag, { module: mod }) || [];
  const byPair = {};
  verdicts.forEach(function (v) { byPair[v.a + '|' + v.b] = v; });
  const limit = (typeof i.limit === 'number') ? Math.min(i.limit, CANDIDATES_MAX_LIMIT) : CANDIDATES_DEFAULT_LIMIT;
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
    op: 'perspective_candidates',
    perspective: id,
    run_tag: i.run_tag,
    total: total,
    count: items.length,
    offset: offset,
    has_more: offset + items.length < total,
    next_offset: offset + items.length < total ? offset + items.length : null,
    header: read.header,
    judged: verdicts.length > 0,
    items: items,
    next_step: verdicts.length > 0 ? 'Judge each pair yourself: does the mechanism transfer, or only the words; does the room already know it. Then op plan or op run_quick on the plan ' + nm.recall + ' built.' : 'Call op ' + nm.judge + ' with this run_tag for the Stage A gates, then read this page again.',
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
  perspective: z.enum(PERSPECTIVE_IDS).optional(),
  run_tag: z.string().regex(/^[0-9TZ]{1,20}$/).optional(),
  limit: z.number().int().min(1).max(CANDIDATES_MAX_LIMIT).optional(),
  offset: z.number().int().min(0).optional(),
  offline: z.boolean().optional().describe('run_quick only: true plans the run and sends nothing (every egress line off).'),
});

const DESCRIPTION = 'Research planner for the bound room: plan a quick or deep research run, ask for a grant that lets the room search a public scholarly index, run quick research here and get an evidence card, review a deep plan, and file findings only after the navigator approves. Approvals are gates answered through gate_answer. Quick runs execute in this server; the deep research run itself executes in Claude Code, where the approved plan is saved. Six perspectives live here too (eureka, rs, hsi, whitespace, analogies, connections): pass perspective with op perspective_recall, which reads the local graph and the ICM structure (no embeddings, no network) and proposes candidate pairs plus a plan; op perspective_candidates pages through them (limit, offset); op perspective_judge runs the local Stage A gates and leaves judgment to you. The ops eureka_recall, eureka_candidates and eureka_judge are deprecated aliases of the perspective ops for one release. op run_quick takes offline true to answer with the plan only and send nothing. op basket can also list release offers: a room word that names no canon framework is sent, as the term only, to the remote canon-name lookup after its own gate_answer yes. Nothing else leaves the room except grant-approved search strings.';

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
          case 'perspective_recall': out = await opPerspectiveRecall(env, i.perspective); break;
          case 'perspective_candidates': out = opPerspectiveCandidates(env, i.perspective); break;
          case 'perspective_judge': out = await opPerspectiveJudge(env, i.perspective); break;
          case 'eureka_recall': out = deprecate(await opPerspectiveRecall(env, 'eureka', EUREKA_NAMES), 'eureka_recall', 'perspective_recall'); break;
          case 'eureka_judge': out = deprecate(await opPerspectiveJudge(env, 'eureka', EUREKA_NAMES), 'eureka_judge', 'perspective_judge'); break;
          case 'eureka_candidates': out = deprecate(opPerspectiveCandidates(env, 'eureka', EUREKA_NAMES), 'eureka_candidates', 'perspective_candidates'); break;
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
    grantOptions: grantOptions,
    mintApprovalGate: mintApprovalGate,
    detectClientCapabilities: detectClientCapabilities,
    deepLine: deepLine,
  },
};
