/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 221 Plan 02 -- dispatcher.cjs
 *
 * The recovery dispatcher: REQ-2's codified 6-tier ladder. Consumes the typed
 * stage envelopes Plan 01 landed (stage-envelope.cjs) and routes every
 * failure through tiers 0-5 with CODE-ENFORCED trigger discipline, so a
 * failure stops dead-ending: every failure has a governed next move or an
 * honest end.
 *
 * Tier table (annex 1, 221-INPUT-MANUS-RECOVERY.md):
 *   0 normal - stage contracts pass
 *   1 deterministic IDEMPOTENT retry - bounded backoff (the chain-executor
 *     min(cap, budget) idiom; fetches yes, writes NEVER) [D-03]
 *   2 local governed substitute - room corpus / research cache, EXPLICIT
 *     provenance, never mislabeled as live [D-03, T-221-08]
 *   3 high-effort LLM recovery - OFFERED ONLY (the controller is Plan 03);
 *     the trigger predicate shouldOfferTier3 ships here so the controller is
 *     born with a disciplined front door [D-04]
 *   4 human intervention - the smallest missing permission/credential/source
 *   5 honest termination - partial_recovery / insufficient_evidence /
 *     manual_intervention_required / policy_blocked; never invented success
 *
 * D-04 (trigger discipline is code, not judgment): Tier-3 fires ONLY on a
 * typed failure / contract violation / implausible coverage (declared const
 * threshold) / required-stage timeout. empty_valid NEVER triggers (a
 * legitimate empty is a FINDING). ctx.origin 'cadence' or ctx.background
 * SKIPS Tier-3 and terminates honestly (Canon Part 3: no unattended LLM
 * cost).
 *
 * D-11 (spend_limit_exceeded, self-validated 2026-07-13, T-221-12): an
 * account-level LLM spend cap skips tiers 1-3 UNCONDITIONALLY - a structural
 * early-return BEFORE the tier partition, regardless of stage, ctx.origin,
 * or remaining budget. Tier-1 never fires (Plan 01 forces retryable:false at
 * construction); Tier-3 never fires (the FIFTH never-case: offering LLM
 * recovery for "the LLM is out of budget" is a bootstrapping paradox).
 * Routes straight to human_required naming the exact actionable step.
 *
 * Egress fence (annex 3: "Query planning: ... never weaken the egress
 * audit"; T-221-09): an ExternalEgressViolation thrown by a stage fn is
 * caught HERE at the dispatch boundary EXCLUSIVELY, typed
 * blocked/policy_blocked, and is TERMINAL - never retried, never rerouted,
 * never rephrased, never substituted, never offered to Tier-3.
 *
 * Resume-at-boundary (annex 3 orchestration rule): resume_stage always
 * carries the FAILED stage name; only IDEMPOTENT_STAGES ever reach
 * ctx.retryFn (structural - a non-idempotent action is never blindly
 * replayed) [T-221-07].
 *
 * Zero network reach, zero DB reach, zero raw SQL: the only I/O this module
 * can cause is through caller-supplied ctx.retryFn / ctx.substituteFn (the
 * default substitute consumes 219-05's queryRoomCorpus - consume, never
 * re-implement). shouldOfferTier3 is PURE (no I/O at all).
 * No em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */
'use strict';

const se = require('./stage-envelope.cjs');

// ---------- Declared consts (the interfaces contract, test-overridable) ----------

const RECOVERY_BUDGETS = Object.freeze({
  MAX_RETRIES_PER_STAGE: 2,
  RETRY_BACKOFF_MS: Object.freeze([250, 1000]),
  MAX_ALTERNATE_ENGINES: 3,
  REQUIRED_STAGE_TIMEOUT_MS: 30000,
  // Coverage below a quarter of the requested scope with 2+ providers failed
  // is implausible (a Tier-3 trigger, D-04).
  IMPLAUSIBLE_COVERAGE_RATIO: 0.25,
});

const TIERS = Object.freeze([
  Object.freeze({ tier: 0, name: 'normal', exit: 'stage contracts pass' }),
  Object.freeze({ tier: 1, name: 'deterministic_idempotent_retry', exit: 'contract passes or retry budget exhausted' }),
  Object.freeze({ tier: 2, name: 'local_governed_substitute', exit: 'coverage restored or gaps explicit' }),
  Object.freeze({ tier: 3, name: 'high_effort_llm_recovery', exit: 'validated recovery bundle or trustworthy-recovery-impossible' }),
  Object.freeze({ tier: 4, name: 'human_intervention', exit: 'human resolves or defers' }),
  Object.freeze({ tier: 5, name: 'honest_termination', exit: 'run ends without invented success' }),
]);

// Tier-1 retries IDEMPOTENT ops ONLY (D-03): fetches yes, writes never.
// filing / gate / readback (writes and human gates) are structurally
// unreachable by ctx.retryFn - the ONE call site below sits inside this
// allowlist branch (T-221-07, grep + behavioral).
const IDEMPOTENT_STAGES = Object.freeze(['retrieval', 'discovery']);

// The default required-stage set for the D-04 timeout trigger (a caller may
// narrow/widen via ctx.requiredStages).
const DEFAULT_REQUIRED_STAGES = Object.freeze(['retrieval', 'filing', 'readback']);

// Failure classes that NEVER trigger Tier-3 (D-04 + D-11). empty_valid never
// triggers structurally (it carries no failure_class and is not a failure).
const NEVER_TIER3_CLASSES = Object.freeze(['policy_blocked', 'spend_limit_exceeded']);

// The D-11 actionable message (T-221-12): the smallest missing thing for an
// account-level spend cap is the human raising it or waiting for the reset.
const SPEND_LIMIT_MESSAGE =
  'Account-level LLM spend limit exhausted: raise your limit at '
  + 'claude.ai/settings/usage, or wait for the monthly reset.';

// Tier-2 provenance vocabulary: the 219 D-16 string for a room-corpus
// substitute (one doctrine, shared vocabulary) and 'research-cache' for a
// cache-sourced substitute. A substitute is NEVER presented as live (D-03).
const PROVENANCE_ROOM_CORPUS = 'web: absent (room-corpus degrade)';
const PROVENANCE_RESEARCH_CACHE = 'research-cache';

// ---------- Helpers ----------

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function resolveBudgets(ctx) {
  const over = (isPlainObject(ctx) && isPlainObject(ctx.budgets)) ? ctx.budgets : {};
  return {
    MAX_RETRIES_PER_STAGE: Number.isInteger(over.MAX_RETRIES_PER_STAGE)
      ? over.MAX_RETRIES_PER_STAGE : RECOVERY_BUDGETS.MAX_RETRIES_PER_STAGE,
    RETRY_BACKOFF_MS: Array.isArray(over.RETRY_BACKOFF_MS)
      ? over.RETRY_BACKOFF_MS : RECOVERY_BUDGETS.RETRY_BACKOFF_MS,
    MAX_ALTERNATE_ENGINES: Number.isInteger(over.MAX_ALTERNATE_ENGINES)
      ? over.MAX_ALTERNATE_ENGINES : RECOVERY_BUDGETS.MAX_ALTERNATE_ENGINES,
    REQUIRED_STAGE_TIMEOUT_MS: Number.isInteger(over.REQUIRED_STAGE_TIMEOUT_MS)
      ? over.REQUIRED_STAGE_TIMEOUT_MS : RECOVERY_BUDGETS.REQUIRED_STAGE_TIMEOUT_MS,
    IMPLAUSIBLE_COVERAGE_RATIO: (typeof over.IMPLAUSIBLE_COVERAGE_RATIO === 'number')
      ? over.IMPLAUSIBLE_COVERAGE_RATIO : RECOVERY_BUDGETS.IMPLAUSIBLE_COVERAGE_RATIO,
  };
}

function isFailureEnvelope(env) {
  return isPlainObject(env) && (env.status === 'failed' || env.status === 'blocked');
}

function isEgressViolation(err) {
  return !!(err && err.name === 'ExternalEgressViolation');
}

function toUnresolved(env) {
  return {
    stage: (isPlainObject(env) && typeof env.stage === 'string') ? env.stage : 'orchestration',
    engine: (isPlainObject(env) && typeof env.engine === 'string') ? env.engine : 'unknown',
    failure_class: (isPlainObject(env) && typeof env.failure_class === 'string')
      ? env.failure_class : 'contract_violation',
  };
}

function defaultSleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// The default Tier-2 substitute: 219-05's room-corpus provider, consumed
// NEVER re-implemented (the 219 D-16 leg). Lazy require so this module stays
// dependency-free for callers that stub ctx.substituteFn.
function defaultSubstitute(env, ctx) {
  // eslint-disable-next-line global-require
  const researchFiling = require('../eureka/research-filing.cjs');
  if (typeof researchFiling.queryRoomCorpus !== 'function') {
    // The HARD verify-landed gate (the 220-02 Task 1 idiom).
    throw new Error('219-05 seam not landed: queryRoomCorpus absent - 221-02 blocked');
  }
  const roomDir = (isPlainObject(ctx) && typeof ctx.roomDir === 'string') ? ctx.roomDir : '';
  if (roomDir.length === 0) return null;
  const handles = (isPlainObject(ctx) && Array.isArray(ctx.topicHandles)) ? ctx.topicHandles : [];
  const out = researchFiling.queryRoomCorpus(roomDir, handles);
  if (!isPlainObject(out) || !Array.isArray(out.results)) return null;
  return { results: out.results, substitute: 'room-corpus' };
}

// ---------- shouldOfferTier3 (PURE, D-04) ----------
//
// The code-enforced Tier-3 front door. Four triggers:
//   (a) a typed engine failure (status 'failed' with a failure_class)
//   (b) a contract_violation (any status)
//   (c) implausible coverage: covered/total retrieval ratio below
//       IMPLAUSIBLE_COVERAGE_RATIO with 2+ failed providers
//   (d) a network_timeout on a required stage
// FIVE never-cases:
//   empty_valid (structural: a finding, not a failure - D-04)
//   policy_blocked (egress is un-reroutable - T-221-09)
//   spend_limit_exceeded (the D-11 bootstrapping paradox - GLOBAL veto)
//   ctx.origin 'cadence' (Part 3: no unattended LLM cost)
//   ctx.background true (same Part 3 rule)
// Pure: no I/O, no requires beyond module consts, deterministic.

function shouldOfferTier3(envelopes, ctx) {
  const c = isPlainObject(ctx) ? ctx : {};
  if (c.origin === 'cadence' || c.background === true) return false;

  const envs = (Array.isArray(envelopes) ? envelopes : []).filter(isPlainObject);
  // D-11 GLOBAL veto: the recovery mechanism itself is what is exhausted.
  for (const env of envs) {
    if (env.failure_class === 'spend_limit_exceeded') return false;
  }

  const budgets = resolveBudgets(c);
  const requiredStages = Array.isArray(c.requiredStages) ? c.requiredStages : DEFAULT_REQUIRED_STAGES;

  let covered = 0;
  let retrievalTotal = 0;
  let failedForCoverage = 0;

  for (const env of envs) {
    // (a) typed engine failure (never-classes excluded).
    if (env.status === 'failed'
      && typeof env.failure_class === 'string'
      && NEVER_TIER3_CLASSES.indexOf(env.failure_class) === -1) {
      return true;
    }
    // (b) contract violation.
    if (env.failure_class === 'contract_violation') return true;
    // (d) required-stage timeout.
    if (env.failure_class === 'network_timeout' && requiredStages.indexOf(env.stage) !== -1) {
      return true;
    }
    // (c) coverage bookkeeping over the retrieval stage.
    if (env.stage === 'retrieval') {
      retrievalTotal += 1;
      if (env.status === 'ok' || env.status === 'empty_valid' || env.status === 'degraded') {
        covered += 1;
      } else if (isFailureEnvelope(env)
        && NEVER_TIER3_CLASSES.indexOf(env.failure_class) === -1) {
        failedForCoverage += 1;
      }
    }
  }

  if (retrievalTotal > 0 && failedForCoverage >= 2) {
    const ratio = covered / retrievalTotal;
    if (ratio < budgets.IMPLAUSIBLE_COVERAGE_RATIO) return true;
  }
  return false;
}

// ---------- dispatchRecovery ----------
//
// input: { envelopes: [stage envelopes], ctx } where ctx carries
//   origin 'on_demand'|'cadence', background, material, requestedScope,
//   topicHandles, roomDir, budgets (test override), retryFn(envelope,
//   attempt) -> envelope, substituteFn(envelope, ctx) -> { results,
//   substitute }, _sleep/_clock test seams.
// Returns the dispatch result Plans 03/04 consume verbatim (the interfaces
// block): { action, outcome, resume_stage, attempts, substitutions,
// unresolved, budget, message? }. substitutions entries additionally carry
// their results[] so the driver can merge recovered items truthfully.

async function dispatchRecovery(input) {
  const inp = isPlainObject(input) ? input : {};
  const rawEnvs = Array.isArray(inp.envelopes) ? inp.envelopes : [];
  const ctx = isPlainObject(inp.ctx) ? inp.ctx : {};
  const budgets = resolveBudgets(ctx);
  const sleep = (typeof ctx._sleep === 'function') ? ctx._sleep : defaultSleep;

  const attempts = [];
  const substitutions = [];
  const budget = { retries_used: 0, engines_tried: 0, exhausted: false };

  // Classification: a malformed envelope is itself a contract_violation
  // (validated via Plan 01's validateStageEnvelope, never trusted raw).
  const valid = [];
  const malformedSynth = [];
  for (const env of rawEnvs) {
    const v = se.validateStageEnvelope(env);
    if (v.ok) {
      valid.push(env);
    } else {
      malformedSynth.push(se.makeStageEnvelope({
        stage: (isPlainObject(env) && typeof env.stage === 'string'
          && se.STAGES.indexOf(env.stage) !== -1) ? env.stage : 'orchestration',
        engine: (isPlainObject(env) && typeof env.engine === 'string') ? env.engine : 'unknown',
        status: 'failed',
        failure_class: 'contract_violation',
        error: 'malformed stage envelope: ' + v.violations.join(','),
      }));
    }
  }

  // ---- D-11 STRUCTURAL SHORT-CIRCUIT (before the tier partition, T-221-12).
  // Any spend_limit_exceeded envelope routes the WHOLE dispatch straight to
  // Tier-4 human_required: no Tier-1 retry (even on idempotent stages), no
  // Tier-2 substitute, no Tier-3 offer, regardless of stage / origin /
  // remaining budget. This is an early RETURN, not a policy check inside the
  // tier loop.
  const spendEnvs = valid.filter(function (e) { return e.failure_class === 'spend_limit_exceeded'; });
  if (spendEnvs.length > 0) {
    const unresolvedSpend = valid.filter(isFailureEnvelope).concat(malformedSynth).map(toUnresolved);
    return {
      action: 'human_required',
      outcome: 'manual_intervention_required',
      message: SPEND_LIMIT_MESSAGE,
      resume_stage: spendEnvs[0].stage,
      attempts: attempts,
      substitutions: substitutions,
      unresolved: unresolvedSpend,
      budget: budget,
    };
  }

  const failures = valid.filter(isFailureEnvelope).concat(malformedSynth);
  const okEnvs = valid.filter(function (e) { return !isFailureEnvelope(e); });

  // ---- Tier-0: nothing failed. empty_valid stays a FINDING (D-04): zero
  // recovery calls, action 'none', the wiring adds nothing downstream.
  if (failures.length === 0) {
    return {
      action: 'none',
      outcome: null,
      resume_stage: null,
      attempts: attempts,
      substitutions: substitutions,
      unresolved: [],
      budget: budget,
    };
  }

  const resumeStage = failures[0].stage || 'orchestration';

  // ---- Egress terminal on INPUT (T-221-09): a Part 8 policy_blocked
  // envelope is TERMINAL for the whole dispatch - never retried, never
  // rerouted, never rephrased (annex 3).
  const hasPolicyBlock = failures.some(function (e) { return e.failure_class === 'policy_blocked'; });
  if (hasPolicyBlock) {
    return {
      action: 'terminated',
      outcome: 'policy_blocked',
      resume_stage: resumeStage,
      attempts: attempts,
      substitutions: substitutions,
      unresolved: failures.map(toUnresolved),
      budget: budget,
    };
  }

  function egressTerminal(env, tier, attemptN) {
    attempts.push({
      tier: tier, engine: env.engine, stage: env.stage,
      attempt: attemptN, result: 'egress_violation',
    });
    const unresolvedNow = failures.map(function (f) {
      const u = toUnresolved(f);
      if (f === env) u.failure_class = 'policy_blocked';
      return u;
    });
    return {
      action: 'terminated',
      outcome: 'policy_blocked',
      resume_stage: resumeStage,
      attempts: attempts,
      substitutions: substitutions,
      unresolved: unresolvedNow,
      budget: budget,
    };
  }

  // ---- Tier-1: bounded deterministic retry, IDEMPOTENT stages ONLY (D-03).
  // The chain-executor bounded-retry idiom (min(cap, budget), distinct
  // exhaustion reason) - no second retry brain. This branch is the ONE AND
  // ONLY ctx.retryFn call site (T-221-07 structural guarantee).
  const resolved = new Set();
  for (const env of failures) {
    if (env.retryable !== true) continue;
    if (IDEMPOTENT_STAGES.indexOf(env.stage) === -1) continue; // writes never (D-03)
    if (typeof ctx.retryFn !== 'function') continue;
    const cap = budgets.MAX_RETRIES_PER_STAGE;
    let attemptN = 0;
    let recovered = false;
    while (attemptN < cap) {
      attemptN += 1;
      const backoffIdx = Math.min(attemptN - 1, budgets.RETRY_BACKOFF_MS.length - 1);
      const backoff = budgets.RETRY_BACKOFF_MS.length > 0 ? budgets.RETRY_BACKOFF_MS[backoffIdx] : 0;
      await sleep(backoff);
      let r;
      try {
        r = await ctx.retryFn(env, attemptN);
      } catch (err) {
        budget.retries_used += 1;
        if (isEgressViolation(err)) return egressTerminal(env, 1, attemptN);
        attempts.push({ tier: 1, engine: env.engine, stage: env.stage, attempt: attemptN, result: 'threw' });
        continue;
      }
      budget.retries_used += 1;
      const status = isPlainObject(r) ? r.status : null;
      attempts.push({
        tier: 1, engine: env.engine, stage: env.stage,
        attempt: attemptN, result: String(status || 'failed'),
      });
      if (status === 'ok' || status === 'empty_valid' || status === 'degraded') {
        recovered = true;
        resolved.add(env);
        break;
      }
    }
    if (!recovered) {
      // The DISTINCT exhaustion reason (never a silent stop).
      attempts.push({ tier: 1, engine: env.engine, stage: env.stage, attempt: attemptN, result: 'retry_exhausted' });
    }
  }

  // ---- Tier-2: local governed substitute for retry-exhausted or
  // non-retryable RETRIEVAL failures. Rides 219's room-corpus provider +
  // research cache with EXPLICIT provenance - never mislabeled as live
  // (D-03, T-221-08).
  const substituteFn = (typeof ctx.substituteFn === 'function') ? ctx.substituteFn : defaultSubstitute;
  for (const env of failures) {
    if (resolved.has(env)) continue;
    if (env.stage !== 'retrieval') continue;
    if (budget.engines_tried >= budgets.MAX_ALTERNATE_ENGINES) {
      budget.exhausted = true;
      continue;
    }
    budget.engines_tried += 1;
    let s;
    try {
      s = await substituteFn(env, ctx);
    } catch (err) {
      if (isEgressViolation(err)) return egressTerminal(env, 2, 1);
      s = null;
    }
    if (isPlainObject(s) && Array.isArray(s.results)) {
      const kind = (s.substitute === 'research-cache') ? 'research-cache' : 'room-corpus';
      substitutions.push({
        engine: env.engine,
        stage: env.stage,
        substitute: kind,
        provenance: (kind === 'research-cache') ? PROVENANCE_RESEARCH_CACHE : PROVENANCE_ROOM_CORPUS,
        results: s.results,
      });
      if (s.results.length > 0) resolved.add(env);
    }
  }
  if (budget.engines_tried >= budgets.MAX_ALTERNATE_ENGINES
    && failures.some(function (e) { return !resolved.has(e); })) {
    budget.exhausted = true;
  }

  const unresolvedEnvs = failures.filter(function (e) { return !resolved.has(e); });
  const unresolved = unresolvedEnvs.map(toUnresolved);

  // ---- Outcome assembly (tiers 3-5).
  if (unresolved.length === 0) {
    const substituted = substitutions.some(function (s) { return s.results.length > 0; });
    return {
      action: substituted ? 'substituted' : 'retried',
      outcome: 'recovered',
      resume_stage: resumeStage,
      attempts: attempts,
      substitutions: substitutions,
      unresolved: [],
      budget: budget,
    };
  }

  if (budget.exhausted) {
    // Budget exhaustion is HONEST partial recovery with explicit gaps,
    // never a complete-looking short report (REQ-2 acceptance, T-221-11).
    return {
      action: 'terminated',
      outcome: 'partial_recovery',
      resume_stage: resumeStage,
      attempts: attempts,
      substitutions: substitutions,
      unresolved: unresolved,
      budget: budget,
    };
  }

  // Tier-3: OFFER only (the controller is Plan 03). The predicate sees the
  // still-unresolved failures plus the healthy envelopes (coverage context) -
  // a failure tiers 1-2 already resolved never re-triggers.
  if (shouldOfferTier3(okEnvs.concat(unresolvedEnvs), ctx)) {
    return {
      action: 'offer_tier3',
      outcome: null,
      resume_stage: resumeStage,
      attempts: attempts,
      substitutions: substitutions,
      unresolved: unresolved,
      budget: budget,
    };
  }

  // Tier-4: when every unresolved gap is a human-fixable smallest-missing
  // thing (credential / engine install), ask the human for exactly that.
  const HUMAN_FIXABLE = { missing_credential: true, engine_unavailable: true };
  const allHumanFixable = unresolved.every(function (u) { return HUMAN_FIXABLE[u.failure_class] === true; });
  if (allHumanFixable) {
    const named = unresolved.map(function (u) { return u.failure_class + ' on ' + u.engine; }).join('; ');
    return {
      action: 'human_required',
      outcome: 'manual_intervention_required',
      message: 'Smallest missing thing: ' + named
        + '. Supply the missing credential or engine and resume at stage \'' + resumeStage + '\'.',
      resume_stage: resumeStage,
      attempts: attempts,
      substitutions: substitutions,
      unresolved: unresolved,
      budget: budget,
    };
  }

  // Tier-5: honest termination. partial_recovery when substitutes / healthy
  // engines covered part of the scope; insufficient_evidence when nothing
  // did. Never an empty-success shape.
  const anyCoverage = okEnvs.some(function (e) { return e.status === 'ok' || e.status === 'degraded'; })
    || substitutions.some(function (s) { return s.results.length > 0; });
  return {
    action: 'terminated',
    outcome: anyCoverage ? 'partial_recovery' : 'insufficient_evidence',
    resume_stage: resumeStage,
    attempts: attempts,
    substitutions: substitutions,
    unresolved: unresolved,
    budget: budget,
  };
}

// ---------- Exports ----------

module.exports = {
  dispatchRecovery,
  shouldOfferTier3,
  TIERS,
  RECOVERY_BUDGETS,
  // Private surface for tests + Plan 03 (do NOT consume in production).
  _internal: {
    IDEMPOTENT_STAGES,
    DEFAULT_REQUIRED_STAGES,
    NEVER_TIER3_CLASSES,
    SPEND_LIMIT_MESSAGE,
    PROVENANCE_ROOM_CORPUS,
    PROVENANCE_RESEARCH_CACHE,
    resolveBudgets,
    defaultSubstitute,
  },
};
