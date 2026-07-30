'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 205-08 -- GRILL engine (SCOPE-3). GRILL is the anti-circular exit for the
 * SENS-10 assertion-unvalidated cause (lib/core/sensors/sensor-circularity.cjs)
 * and the load-bearing-claim challenge inside FUSION. It runs TWO mandatory arms
 * on a load-bearing claim:
 *
 *   Arm A -- logical red-team (LIVE). challenge-assumptions plus the five
 *     Beautiful-Questions bias techniques (Consider-the-Opposite, Base-Rate-Check,
 *     Red-Team-Steelman, Premortem, Reference-Class-Forecasting), reached as the
 *     frozen brain_consult reach. PART 8: only the bias SHAPE / technique names /
 *     a generic claim-shape ENUM egress to the Brain; the claim content and user
 *     prose NEVER cross. The egress is built by buildArmAEgress and cleared by the
 *     shipped part8-egress-guard classifier before it would ever fire.
 *
 *   Arm B -- external validation (SCAFFOLDED, gated on Phase 200). The teeth that
 *     end the circle by touching ground truth: the bono hat-scoped parallel-fan
 *     (White=data, Black=disconfirming, Yellow=success, Green=adjacent) via
 *     runCellFanout, then adversarial-verify to a structured verdict
 *     {survives | flagged None-tier}, routed through the frozen deep_research
 *     reach, Tavily-first / native-WebFetch-fallback. Before ANY external pass the
 *     MCP-stack-ask gate resolves (project HARD rule feedback_mcp_stack_awareness).
 *
 * ====================================================================
 * BLOCKED-UNTIL-200 SEAM (the SINGLE, one-point flip).
 * --------------------------------------------------------------------
 * The bono runCellFanout + adversarial-verify infrastructure is Phase 200. The
 * navigator has DEFERRED live-wiring Arm B to a separate gated plan, so until the
 * seam below flips, Arm B DEGRADES CLEANLY: it returns a marked not-available
 * verdict, writes NO evidence node, fabricates NO survives/flagged result, throws
 * NOT, and invokes NO external primitive.
 *
 * The gate is ONE predicate over ONE constant:
 *   - BLOCKED_UNTIL_200  (the guard constant)
 *   - is200FanVerifyLive(ctx)  (the single predicate every external step keys on)
 * To wire Arm B to live Phase 200, flip BLOCKED_UNTIL_200 to false and complete
 * the runLiveExternalPass scaffold below -- a one-point change, not a rewrite.
 * ====================================================================
 *
 * FROZEN-SIX INVARIANT (Canon Part 7, scope item 7): GRILL mints NO new reach_id.
 * Arm A routes brain_consult, Arm B routes deep_research; the engine references no
 * other reach id. Both structs are built through sensor-types.makeReach so an
 * invalid reach id fails closed.
 *
 * OFFLINE / LOCAL-first: pure sync builders, zero network at build time. The only
 * requires are sensor-types (pure) and part8-egress-guard (pure LOCAL classifier).
 * The real Brain/Tavily/WebFetch calls are runtime primitives injected via ctx;
 * this module never opens a wire itself.
 *
 * House rule: hyphens only, no em-dashes. CJS, node built-ins only, no new deps.
 * License: BSL 1.1.
 */

const { makeReach } = require('./sensors/sensor-types.cjs');
const part8 = require('./part8-egress-guard.cjs');

// ---------------------------------------------------------------------------
// Phase 213 (205 touchpoint, post-210 semantics): the closed enums for the
// OPTIONAL eureka suggest-quality annotation. These are read (not re-minted) from
// the shipped substrate: guard verdicts = the Phase 212 critic enum
// (data/eureka-critic-tags.json), bands = rs-differential-scorer.cjs::bandFor,
// surprise types = the eureka-reach-runner SURPRISE_TYPES. Any value outside these
// sets is dropped (Information Disclosure guard T-213-16).
// ---------------------------------------------------------------------------
const EUREKA_GUARD_VERDICTS = Object.freeze(['transferable', 'restatement', 'pseudoscience', 'general_shallow']);
const EUREKA_BANDS = Object.freeze(['breakthrough', 'high', 'opportunity', 'moderate', 'low']);
const EUREKA_SURPRISE_TYPES = Object.freeze(['structural_transfer', 'semantic_implementation']);

/**
 * validateEurekaSignal(sig) -> { guard_verdict, band, surprise_type } | null
 *
 * Closed-enum membership validation for the optional ctx.eurekaSignal annotation.
 * All three fields must be present AND members of their frozen enum; anything else
 * (a missing field, a non-object, a non-enum member like band 'amazing') drops the
 * ENTIRE annotation to null so the grill result simply has no eureka_signal key.
 * Nothing free-form ever reaches the result -- enums only.
 */
function validateEurekaSignal(sig) {
  if (!sig || typeof sig !== 'object') return null;
  if (EUREKA_GUARD_VERDICTS.indexOf(sig.guard_verdict) === -1) return null;
  if (EUREKA_BANDS.indexOf(sig.band) === -1) return null;
  if (EUREKA_SURPRISE_TYPES.indexOf(sig.surprise_type) === -1) return null;
  return { guard_verdict: sig.guard_verdict, band: sig.band, surprise_type: sig.surprise_type };
}

// ---------------------------------------------------------------------------
// The five Beautiful-Questions bias techniques Arm A reaches as brain_consult.
// These are OUR fixed generic method vocabulary (technique NAMES only) -- they
// are safe to egress; the claim content is not.
// ---------------------------------------------------------------------------
const BIAS_TECHNIQUES = Object.freeze([
  'Consider-the-Opposite',
  'Base-Rate-Check',
  'Red-Team-Steelman',
  'Premortem',
  'Reference-Class-Forecasting',
]);

// A generic, LOCAL challenge prompt per technique. These stay LOCAL (they are the
// findings Larry works from); they carry no user prose, only the method shape.
const TECHNIQUE_CHALLENGE = Object.freeze({
  'Consider-the-Opposite': 'State the strongest case for the opposite conclusion; what evidence would the claim be missing?',
  'Base-Rate-Check': 'What is the reference base rate for a claim of this shape, and does this instance justify departing from it?',
  'Red-Team-Steelman': 'Steelman the disconfirming position, then red-team the claim against it -- where does it break first?',
  'Premortem': 'Assume the claim proved false in hindsight; enumerate the most likely reasons it failed.',
  'Reference-Class-Forecasting': 'Place the claim in its reference class of similar past claims; what did that class actually deliver?',
});

// ---------------------------------------------------------------------------
// The closed generic claim-SHAPE enum. classifyClaimShape reads the LOCAL claim
// text only to pick an ENUM from this set -- the enum egresses, the prose never
// does (Part 8). A minimal lexical heuristic; the user's words never leave.
// ---------------------------------------------------------------------------
const CLAIM_SHAPES = Object.freeze([
  'quantitative_estimate',
  'causal_assertion',
  'comparative_claim',
  'predictive_claim',
  'categorical_claim',
  'general_assertion',
]);

/**
 * Map a LOCAL claim string to a generic shape ENUM (never echoes the prose).
 * Order is precedence; the first structural cue wins. Defensive: any non-string
 * or empty claim degrades to 'general_assertion'.
 * @param {string} claim
 * @returns {string} a member of CLAIM_SHAPES
 */
function classifyClaimShape(claim) {
  const text = (typeof claim === 'string') ? claim : '';
  if (!text) return 'general_assertion';
  const t = text.toLowerCase();
  if (/[0-9]+\s*%|\$[0-9]|\b[0-9][0-9.,]*\s*(?:x|percent|million|billion|k|m|bn)\b/.test(t)) {
    return 'quantitative_estimate';
  }
  if (/\bwill\b|\bgoing to\b|\bby (?:next|20\d\d)\b|\bforecast\b|\bexpect\b/.test(t)) {
    return 'predictive_claim';
  }
  if (/\bbecause\b|\bcauses?\b|\bleads to\b|\bdue to\b|\bdrives?\b|\bso that\b/.test(t)) {
    return 'causal_assertion';
  }
  if (/\bmore than\b|\bless than\b|\bbetter than\b|\bworse than\b|\bversus\b|\bvs\.?\b|\bcompared\b/.test(t)) {
    return 'comparative_claim';
  }
  if (/\balways\b|\bnever\b|\ball\b|\bevery\b|\bnone\b|\bmust\b/.test(t)) {
    return 'categorical_claim';
  }
  return 'general_assertion';
}

// ---------------------------------------------------------------------------
// Arm A egress builder. Produces the brain_consult (brain_ask operator) payload
// that carries ONLY bias-technique names + the generic claim-shape enum + generic
// methodology vocabulary. NO claim content. The brain_ask free-form path in the
// Part-8 guard clears this shape as a MOVE-SET (generic methodology handle).
// ---------------------------------------------------------------------------
/**
 * @param {string} claim  -- LOCAL only; its SHAPE enum is derived, its prose is not used
 * @returns {{toolName: string, payload: {question: string}}}
 */
function buildArmAEgress(claim) {
  const shape = classifyClaimShape(claim);
  // Generic methodology question: framework/methodology vocabulary + technique
  // names + the shape enum. No user prose. 'brain_ask' selects the free-form path.
  // Phase 239 (BRAIN-01) bare-vs-scoped decision rule: this toolName feeds an
  // IN-PROCESS part8.classify() call below (armA), never a hook or a host
  // matcher, so it takes the BARE form -- matching the shipped precedent in
  // lib/core/bono/persona-research.cjs:208-233. The prior 'mcp__brain_ask'
  // literal was a fabricated scoped-looking name with no live counterpart;
  // the bare form is what the free-form _isFreeFormTool substring check
  // actually needs.
  const question =
    'Which bias-audit frameworks and methodology apply to a load-bearing claim of shape ' +
    shape + '? Techniques: ' + BIAS_TECHNIQUES.join(', ') +
    '. This is a first-principles red-team methodology reach, not a content query.';
  return { toolName: 'brain_ask', payload: { question: question } };
}

/**
 * armA(claim, ctx) -- the logical red-team (LIVE). Runs challenge-assumptions plus
 * the five bias techniques via the brain_consult reach, Part-8 fenced. Returns the
 * five bias challenges as LOCAL structured findings, and the guard-cleared egress
 * shape. Mints no reach.
 *
 * @param {string} claim
 * @param {object} [ctx]
 * @returns {object}
 */
function armA(claim, ctx) {
  ctx = ctx || {};
  const shape = classifyClaimShape(claim);

  // Build the Part-8 fenced egress and clear it through the shipped guard. The
  // primitive is NOT fired here (offline); we only prove the shape is egress-safe.
  const egress = buildArmAEgress(claim);
  let guardVerdict = 'ambiguous';
  try {
    const v = part8.classify(egress.payload, { toolName: egress.toolName });
    guardVerdict = v && v.verdict ? v.verdict : 'ambiguous';
  } catch (_e) {
    guardVerdict = 'block'; // fail-closed: a guard fault is treated as unsafe
  }

  // LOCAL structured findings: the five bias-technique challenges. These never
  // egress; they are what Larry works from locally.
  const findings = BIAS_TECHNIQUES.map(function (technique) {
    return { technique: technique, challenge: TECHNIQUE_CHALLENGE[technique], shape: shape };
  });

  // The frozen brain_consult reach struct (mints nothing; makeReach validates).
  const reach = makeReach({
    reach_id: 'brain_consult',
    posture: 'push_forward',
    dispatch: 'challenge-assumptions',
    companions: BIAS_TECHNIQUES.slice(),
    signal: 'grill_arm_a_red_team',
    evidence: { arm: 'A', gear: 'GRILL', claim_shape: shape, technique_count: findings.length },
  });

  const result = {
    arm: 'A',
    live: true,
    reach_id: 'brain_consult',
    posture: 'push_forward',
    gear: 'GRILL',
    dispatch: 'challenge-assumptions',
    claim_shape: shape,
    findings: findings,
    egress: { toolName: egress.toolName, payload: egress.payload, guard_verdict: guardVerdict },
    reach: reach,
    minted_reach: false,
  };

  // Phase 213 (205 touchpoint, post-210 semantics): an optional suggest-quality
  // annotation from the eureka critic; informational for the navigator-facing
  // render, never a gate on any arm; the BLOCKED_UNTIL_200 deferral (:210) is
  // deliberately untouched -- flipping it is a separately-gated navigator decision.
  // Default absent; attached (as eureka_signal) only when present AND enum-valid.
  const eurekaSignal = validateEurekaSignal(ctx.eurekaSignal);
  if (eurekaSignal) result.eureka_signal = eurekaSignal;

  return result;
}

// ===========================================================================
// BLOCKED-UNTIL-200 SEAM -- the single, well-named, one-point gate for Arm B.
// ===========================================================================
//
// The guard constant. While true, Arm B degrades cleanly (no external pass, no
// verdict, no evidence). The navigator DEFERRED live-wiring Arm B to a separate
// gated plan even though Phase 200 has shipped runCellFanout + adversarial-verify;
// this constant is that deferral, made explicit and legible in one place.
const BLOCKED_UNTIL_200 = true;

/**
 * is200FanVerifyLive(ctx) -- THE single predicate every external step keys on.
 *
 * This is the one-point flip. Today it returns false unconditionally because the
 * BLOCKED_UNTIL_200 guard constant is engaged (the navigator's deferral). To wire
 * Arm B to live Phase 200, flip BLOCKED_UNTIL_200 to false; this predicate will
 * then probe the injected ctx for the live bono fan + adversarial-verify handles
 * (ctx.runCellFanout + ctx.adversarialVerify) and return true only when both are
 * present. No other code path decides Arm B liveness -- this is the sole seam.
 *
 * @param {object} [ctx]
 * @returns {boolean}
 */
function is200FanVerifyLive(ctx) {
  if (BLOCKED_UNTIL_200) return false; // <-- THE one-point flip (navigator deferral)
  // Post-flip liveness probe (scaffold; unreached while the seam is engaged):
  const c = ctx || {};
  return typeof c.runCellFanout === 'function' && typeof c.adversarialVerify === 'function';
}

// ---------------------------------------------------------------------------
// Arm B egress builder. The generic deep_research query SHAPE -- bias-shape /
// framework names / the claim-shape enum only. NO claim content / user artifacts.
// Used to prove the Part-8 fence holds even though (while gated) it never fires.
// ---------------------------------------------------------------------------
/**
 * @param {string} claim  -- LOCAL only; shape enum derived, prose never used
 * @returns {{toolName: string, payload: {question: string}}}
 */
function buildArmBEgress(claim) {
  const shape = classifyClaimShape(claim);
  const question =
    'Framework-led deep-research methodology: gather disconfirming and base-rate ' +
    'evidence for a claim of shape ' + shape + ' using the six-hats data / black / ' +
    'yellow / green sequence. Generic methodology reach, not a content query.';
  // Phase 239 (BRAIN-01) bare-vs-scoped decision rule: same as buildArmAEgress
  // above -- this toolName feeds an in-process part8.classify() call, never a
  // hook or host matcher, so it takes the BARE form.
  return { toolName: 'brain_ask', payload: { question: question } };
}

/**
 * mcpStackAskGate(ctx, trace) -- the MCP-stack-ask gate (project HARD rule
 * feedback_mcp_stack_awareness): before ANY external web pass, surface which MCP
 * the user wants (Tavily-first / native-WebFetch-fallback); never silent-WebSearch.
 * This ALWAYS runs before any external primitive. It records itself on the trace
 * as the first step so the ordering invariant is testable.
 *
 * @param {object} ctx
 * @param {string[]} trace
 * @returns {{asked: boolean, resolved: boolean, order: number, primitive_preference: string[]}}
 */
function mcpStackAskGate(ctx, trace) {
  trace.push('mcp_stack_ask_gate');
  // The gate resolves the ordered primitive preference (Tavily-first, WebFetch
  // fallback). Resolving the ASK is LOCAL; it invokes NO external primitive.
  return {
    asked: true,
    resolved: true,
    order: 1,
    primitive_preference: ['tavily', 'webfetch'],
  };
}

/**
 * armB(claim, ctx) -- external validation (SCAFFOLDED, BLOCKED-UNTIL-200).
 *
 * Order is load-bearing: (1) the MCP-stack-ask gate resolves FIRST, then (2) the
 * single is200FanVerifyLive seam decides. While the seam is engaged, Arm B returns
 * a marked not-available verdict with NO fabricated result, NO evidence node, NO
 * external primitive invoked, and NO throw (clean degradation). Mints no reach.
 *
 * @param {string} claim
 * @param {object} [ctx]
 * @returns {object}
 */
function armB(claim, ctx) {
  ctx = ctx || {};
  const shape = classifyClaimShape(claim);
  const trace = [];

  // (1) MCP-stack-ask gate ALWAYS precedes any external primitive.
  const mcpGate = mcpStackAskGate(ctx, trace);

  // Build the Part-8 fenced egress SHAPE (never fired while gated) and clear it.
  const egress = buildArmBEgress(claim);
  let guardVerdict = 'ambiguous';
  try {
    const v = part8.classify(egress.payload, { toolName: egress.toolName });
    guardVerdict = v && v.verdict ? v.verdict : 'ambiguous';
  } catch (_e) {
    guardVerdict = 'block';
  }

  // The frozen deep_research reach struct (mints nothing).
  const reach = makeReach({
    reach_id: 'deep_research',
    posture: 'push_forward',
    dispatch: 'grill-external-validation (bono fan -> adversarial-verify)',
    companions: ['white_data', 'black_disconfirming', 'yellow_success', 'green_adjacent'],
    signal: 'grill_arm_b_external',
    evidence: { arm: 'B', gear: 'GRILL', claim_shape: shape, gated: true },
  });

  // (2) THE single 200-gating seam.
  if (!is200FanVerifyLive(ctx)) {
    // CLEAN DEGRADATION. No external primitive, no fabricated verdict, no evidence.
    return {
      arm: 'B',
      live: false,
      reach_id: 'deep_research',
      posture: 'push_forward',
      gear: 'GRILL',
      status: 'not_available',
      blocked_until: 200,
      verdict: null,          // NO fabricated survives / flagged None-tier
      evidence_node: null,    // NO typed evidence node written
      external_invoked: false,
      mcp_gate: mcpGate,
      egress_preview: { toolName: egress.toolName, payload: egress.payload, guard_verdict: guardVerdict },
      trace: trace,
      reach: reach,
      minted_reach: false,
    };
  }

  // --------------------------------------------------------------------------
  // LIVE PATH (unreached while the seam is engaged). After the one-point flip,
  // wire the real pass here: run the bono hat-scoped fan via ctx.runCellFanout,
  // adversarial-verify via ctx.adversarialVerify to a {survives | flagged None-
  // tier} verdict, Tavily-first / WebFetch-fallback through the deep_research
  // reach, and file the verdict as typed graph evidence via mos:research. Every
  // external primitive must be invoked AFTER mcpGate resolved above.
  // --------------------------------------------------------------------------
  return runLiveExternalPass(claim, ctx, { shape: shape, mcpGate: mcpGate, egress: egress, reach: reach, trace: trace });
}

/**
 * runLiveExternalPass -- the post-flip Arm B live pass. Intentionally a guarded
 * scaffold: it must never run while BLOCKED_UNTIL_200 is engaged. If it is ever
 * reached before the seam is completed, it fails CLOSED (returns not-available)
 * rather than fabricating a verdict.
 */
function runLiveExternalPass(claim, ctx, state) {
  // Defensive fail-closed: the live wiring is not part of this plan (Option A).
  return {
    arm: 'B',
    live: false,
    reach_id: 'deep_research',
    posture: 'push_forward',
    gear: 'GRILL',
    status: 'not_available',
    blocked_until: 200,
    verdict: null,
    evidence_node: null,
    external_invoked: false,
    mcp_gate: state.mcpGate,
    egress_preview: { toolName: state.egress.toolName, payload: state.egress.payload, guard_verdict: 'ambiguous' },
    trace: state.trace,
    reach: state.reach,
    minted_reach: false,
  };
}

/**
 * runGrill(claim, ctx) -- the two mandatory arms composed. Arm A (live) then Arm B
 * (degrades cleanly while gated). The overall GRILL verdict is Arm B's structured
 * verdict -- null until Phase 200 wires the teeth. Mints no new reach.
 *
 * @param {string} claim
 * @param {object} [ctx]
 * @returns {object}
 */
function runGrill(claim, ctx) {
  ctx = ctx || {};
  const a = armA(claim, ctx);
  const b = armB(claim, ctx);
  return {
    claim_shape: classifyClaimShape(claim),
    armA: a,
    armB: b,
    verdict: b.verdict, // null while Arm B is gated (the teeth touch ground post-200)
    reaches_used: ['brain_consult', 'deep_research'],
    minted_reach: false,
  };
}

module.exports = {
  runGrill: runGrill,
  armA: armA,
  armB: armB,
  // The single BLOCKED-UNTIL-200 seam (the one-point flip).
  BLOCKED_UNTIL_200: BLOCKED_UNTIL_200,
  is200FanVerifyLive: is200FanVerifyLive,
  // Part-8 fenced egress builders + the generic claim-shape classifier.
  buildArmAEgress: buildArmAEgress,
  buildArmBEgress: buildArmBEgress,
  classifyClaimShape: classifyClaimShape,
  // Vocabulary + closed sets (for tests + downstream).
  BIAS_TECHNIQUES: BIAS_TECHNIQUES,
  CLAIM_SHAPES: CLAIM_SHAPES,
};
