/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 221 Plan 04 -- result-semantics.cjs
 *
 * REQ-4 / D-08: the result-semantics composer. Every recovery-touched run
 * derives ONE machine-honest verdict: which engines failed, what recovered
 * them, what the claims rest on, what remains unknown - visible, honest, and
 * SCOPED. No silent recovery, no invented certainty.
 *
 * ADDITIVE ENUM RULE (D-08): RESEARCH_MODES extends the 219-shipped four
 * (source-lens-driver.cjs RESEARCH_MODES - normal /
 * web_degraded_local_fallback / local_only / insufficient_evidence) with
 * exactly two new values: llm_engine_recovery + manual_intervention_required.
 * The shipped four are IMPORTED from where they live (lazy, cycle-safe,
 * research-filing driverSeam idiom), never redefined and never renamed.
 *
 * Composer rules (deterministic, the 221-04 interfaces contract):
 *   - outcome 'recovered' ONLY when every required stage contract passes
 *     (validateStageEnvelope ok on every envelope) AND any attempted filing
 *     is confirmed_by_readback (annex 6). An unconfirmed filing FORCES
 *     partial_recovery regardless of any hook's confidence.
 *   - research_mode 'llm_engine_recovery' iff a Tier-3 recovery contributed
 *     content (recovered_payloads non-empty).
 *   - research_mode 'manual_intervention_required' iff the dispatch action is
 *     human_required (or a refused/halted controller run surfaced the same
 *     outcome - the D-11 defense-in-depth path).
 *   - policy_blocked maps TERMINALLY: never softened, never recovery.
 *
 * THE VANTAGE RULE (annex 10, the Phase-218 correction made permanent;
 * T-221-21): when an AUTHORITATIVE source's envelope is blocked or failed
 * (the workspace is UNAVAILABLE, not empty) while an accessible corpus
 * returned empty_valid, the gap lands in unresolved_gaps with scope 'corpus',
 * tag 'authoritative_workspace_unavailable', PROVISIONAL wording. This rule
 * is STRUCTURAL, not just tested: GAP_SCOPE below is the ONLY scope this
 * module can ever emit - there is no branch, parameter, or input combination
 * that writes scope 'project'. Absence-of-evidence from one vantage is never
 * evidence-of-absence for the project; a project-level claim requires
 * confirmed evidence coverage, which is outside recovery's authority.
 *
 * DISCLOSURE PAYLOAD DISCIPLINE (T-221-24 + the D-06 fence-5 lesson): the
 * disclosure carries enums, handles, counts, and timestamps ONLY. Claim TEXT
 * stays in claim-evidence-ledger.json (quoted data); coverage references
 * claims by HANDLE ('claim-N'), so embedding the disclosure in any prose
 * surface (recovery-notice.md) can never splice recovered content into it.
 *
 * D-09 note: run-ledger telemetry stays LOCAL (.mindrian, Canon Part 8).
 * This module adds NO doctor check; if one is ever added it must be a
 * registry module (data/doctor-modules.json + lib/core/doctor/*-module.cjs),
 * never an inline branch (the 217 rule).
 *
 * Zero network reach, zero DB reach, zero deps beyond sibling recovery
 * modules. No em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */
'use strict';

const se = require('./stage-envelope.cjs');

// ---------- Enums (D-08 additive) ----------

// The two values THIS phase adds (never more, never renames).
const ADDED_MODES = Object.freeze(['llm_engine_recovery', 'manual_intervention_required']);

// The annex-6 outcome five (frozen).
const OUTCOMES = Object.freeze([
  'recovered',
  'partial_recovery',
  'insufficient_evidence',
  'manual_intervention_required',
  'policy_blocked',
]);

// The defensive mirror of the 219-shipped four (used ONLY if the driver
// cannot be required - it is a plugin-local CJS file, so this is belt and
// braces, the research-filing driverSeam idiom).
const BASE_MODES_MIRROR = Object.freeze([
  'normal',
  'web_degraded_local_fallback',
  'local_only',
  'insufficient_evidence',
]);

// Lazy + cached: the driver is required at FIRST ACCESS, never at module
// load, so the driver -> result-semantics -> driver require cycle is safe in
// either load order.
let _researchModes = null;
function researchModes() {
  if (_researchModes) return _researchModes;
  let base = BASE_MODES_MIRROR;
  try {
    // eslint-disable-next-line global-require
    const drv = require('../../lens-engine/source-lens-driver.cjs');
    if (drv && Array.isArray(drv.RESEARCH_MODES) && drv.RESEARCH_MODES.length > 0) {
      base = drv.RESEARCH_MODES; // the ONE landed enum, extended not redefined
    }
  } catch (_e) { /* defensive mirror above */ }
  _researchModes = Object.freeze(base.slice().concat(ADDED_MODES));
  return _researchModes;
}

// THE STRUCTURAL VANTAGE CONSTANT (T-221-21): the only scope this module can
// emit. There is deliberately NO 'project' branch anywhere below.
const GAP_SCOPE = 'corpus';

const VANTAGE_TAG = 'authoritative_workspace_unavailable';

// Provenance strings that mark NON-live content (the Plan 01/02 vocabulary):
// a cache hit, a room-corpus substitute. live_verified must never be claimed
// off these (annex 3 retrieval rule: never claim live verification without a
// live result).
const NON_LIVE_PROVENANCE = Object.freeze([
  'research-cache',
  'web: absent (room-corpus degrade)',
  'room-corpus',
]);

// ---------- Helpers ----------

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function cleanEnvelopes(envelopes) {
  return (Array.isArray(envelopes) ? envelopes : []).filter(isPlainObject);
}

function isFailureEnvelope(env) {
  return env.status === 'failed' || env.status === 'blocked';
}

function hasContent(env) {
  return env.status === 'ok' || env.status === 'degraded';
}

function isLiveOk(env) {
  if (env.status !== 'ok') return false;
  const prov = Array.isArray(env.provenance) ? env.provenance : [];
  for (const p of prov) {
    if (NON_LIVE_PROVENANCE.indexOf(p) !== -1) return false;
  }
  return true;
}

function failedEnginesOf(envs) {
  const out = [];
  for (const env of envs) {
    if (!isFailureEnvelope(env)) continue;
    out.push({
      stage: typeof env.stage === 'string' ? env.stage : 'orchestration',
      engine: typeof env.engine === 'string' ? env.engine : 'unknown',
      failure_class: typeof env.failure_class === 'string' ? env.failure_class : 'contract_violation',
    });
  }
  return out;
}

// Tier-3 contributed content iff the controller returned recovered payloads.
function tier3Contributed(recovery) {
  return !!(isPlainObject(recovery)
    && recovery.refused !== true
    && isPlainObject(recovery.bundle)
    && Array.isArray(recovery.bundle.recovered_payloads)
    && recovery.bundle.recovered_payloads.length > 0);
}

function filingOf(recovery) {
  if (isPlainObject(recovery) && isPlainObject(recovery.filing)) {
    return {
      attempted: recovery.filing.attempted === true,
      confirmed_by_readback: recovery.filing.confirmed_by_readback === true,
      reason: (typeof recovery.filing.reason === 'string') ? recovery.filing.reason : null,
    };
  }
  return { attempted: false, confirmed_by_readback: false, reason: null };
}

function modelOf(recovery, ctx) {
  if (isPlainObject(recovery) && isPlainObject(recovery.model)
    && typeof recovery.model.model === 'string') {
    return { model: recovery.model.model, version: String(recovery.model.version || 'unrecorded') };
  }
  const mi = (isPlainObject(ctx) && isPlainObject(ctx.modelInfo)) ? ctx.modelInfo : {};
  return {
    model: typeof mi.model === 'string' ? mi.model : null,
    version: typeof mi.version === 'string' ? mi.version : null,
  };
}

// ---------- deriveCoverage ----------
//
// deriveCoverage(envelopes, claims, requestedScope) ->
//   { requested, supported, conflicting, unsupported }
//
// HANDLES ONLY (T-221-24): when a claim ledger exists, coverage references
// claims by handle ('claim-N', ledger order preserved) - the claim TEXT
// stays in claim-evidence-ledger.json as quoted data. Without a ledger,
// coverage speaks in engine handles: which requested engines are supported
// by returned content and which are not. 'missing' claims (including the
// unknown-component pins) land in unsupported: an unknown is DISCLOSED as
// unsupported coverage, never upgraded and never zeroed (the D-18 rule).

function deriveCoverage(envelopes, claims, requestedScope) {
  const envs = cleanEnvelopes(envelopes);
  const cls = (Array.isArray(claims) ? claims : []).filter(isPlainObject);
  const requested = Array.isArray(requestedScope) && requestedScope.length > 0
    ? requestedScope.slice()
    : envs.map(function (e) { return String(e.engine || 'unknown'); })
      .filter(function (v, i, a) { return a.indexOf(v) === i; });

  const supported = [];
  const conflicting = [];
  const unsupported = [];

  if (cls.length > 0) {
    for (let i = 0; i < cls.length; i += 1) {
      const handle = 'claim-' + (i + 1);
      if (cls[i].state === 'supported') supported.push(handle);
      else if (cls[i].state === 'conflicting') conflicting.push(handle);
      else unsupported.push(handle); // 'unsupported' + 'missing' (unknowns disclosed)
    }
  } else {
    for (const env of envs) {
      const engine = String(env.engine || 'unknown');
      if (hasContent(env) && supported.indexOf(engine) === -1) supported.push(engine);
      else if (isFailureEnvelope(env) && unsupported.indexOf(engine) === -1) unsupported.push(engine);
    }
  }

  return {
    requested: requested,
    supported: supported,
    conflicting: conflicting,
    unsupported: unsupported,
  };
}

// ---------- envelopesFromProviders (the seam-alignment helper, D-02) ----------
//
// The 219 provider-status bag ({ provider, lens?, status, reason, counts,
// freshness }) mapped onto the full stage-envelope contract, so the
// exploreOpportunity / queryRoomCorpus seams carry typed envelopes WITHOUT
// re-plumbing their shipped fetch paths. ADDITIVE: the providers bag itself
// is untouched; this derives the second view of the same bag.
//   ok -> ok; empty -> empty_valid; error -> failed/engine_unavailable;
//   skipped -> omitted (nothing was attempted, so no stage ran - the
//   fetchSourceCached 'no envelope' rule).
// Freshness feeds provenance truthfully: cached_fresh -> 'research-cache',
// local -> 'room-corpus', live -> [] (live provenance is the absence of a
// non-live marker).

function envelopesFromProviders(providers) {
  const out = [];
  for (const p of (Array.isArray(providers) ? providers : [])) {
    if (!isPlainObject(p)) continue;
    if (p.status === 'skipped' || p.status === 'not_attempted') continue;
    const items = (isPlainObject(p.counts) && typeof p.counts.items === 'number') ? p.counts.items : 0;
    let status;
    let failureClass = null;
    if (p.status === 'ok') status = 'ok';
    else if (p.status === 'empty') status = 'empty_valid';
    else { status = 'failed'; failureClass = 'engine_unavailable'; }
    const provenance = [];
    if (p.freshness === 'cached_fresh') provenance.push('research-cache');
    else if (p.freshness === 'local') provenance.push('room-corpus');
    out.push(se.makeStageEnvelope({
      stage: 'retrieval',
      engine: typeof p.provider === 'string' ? p.provider : 'unknown',
      status: status,
      failure_class: failureClass,
      error: (status === 'failed') ? String(p.reason || 'provider_error') : null,
      provenance: provenance,
      payload: { items: items },
    }));
  }
  return out;
}

// ---------- composeRecoveryResult ----------
//
// composeRecoveryResult({ envelopes, dispatch, recovery, ctx }) ->
//   { research_mode, outcome, disclosure } (the annex-6 user-visible truth).
//
//   envelopes  the run's typed stage envelopes (Plan 01 contract)
//   dispatch   the dispatchRecovery result (Plan 02) or null
//   recovery   the runRecovery result (Plan 03) or null (Tier-3 not run)
//   ctx        { requestedScope[], authoritativeEngines[],
//                base_research_mode, localOnly, modelInfo }
//
// Deterministic; no I/O; never throws on malformed input (defensive
// normalization throughout).

function composeRecoveryResult(input) {
  const inp = isPlainObject(input) ? input : {};
  const envs = cleanEnvelopes(inp.envelopes);
  const dispatch = isPlainObject(inp.dispatch) ? inp.dispatch : null;
  const recovery = isPlainObject(inp.recovery) ? inp.recovery : null;
  const ctx = isPlainObject(inp.ctx) ? inp.ctx : {};

  const failedEngines = failedEnginesOf(envs);
  const anyContent = envs.some(hasContent);
  const substitutions = (dispatch && Array.isArray(dispatch.substitutions)) ? dispatch.substitutions : [];
  const substituteContent = substitutions.some(function (s) {
    return Array.isArray(s.results) && s.results.length > 0;
  });
  const recovered3 = tier3Contributed(recovery);
  const filing = filingOf(recovery);
  const claims = (recovery && isPlainObject(recovery.bundle) && Array.isArray(recovery.bundle.claims))
    ? recovery.bundle.claims : [];

  // ---- research_mode (D-08 rules, in precedence order) ----
  const modes = researchModes();
  let researchMode;
  if (dispatch && dispatch.action === 'human_required') {
    researchMode = 'manual_intervention_required';
  } else if (recovery && recovery.outcome === 'manual_intervention_required') {
    // The refused/halted controller path (D-11 defense in depth).
    researchMode = 'manual_intervention_required';
  } else if (recovered3) {
    researchMode = 'llm_engine_recovery';
  } else if (typeof ctx.base_research_mode === 'string'
    && modes.indexOf(ctx.base_research_mode) !== -1) {
    researchMode = ctx.base_research_mode; // the driver's landed composition
  } else if (!anyContent && !substituteContent) {
    researchMode = 'insufficient_evidence';
  } else if (ctx.localOnly === true) {
    researchMode = 'local_only';
  } else if (failedEngines.length > 0) {
    researchMode = 'web_degraded_local_fallback';
  } else {
    researchMode = 'normal';
  }

  // ---- outcome (annex 6, deterministic) ----
  const contractsPass = envs.every(function (e) { return se.validateStageEnvelope(e).ok; });
  const filingOk = !filing.attempted || filing.confirmed_by_readback === true;
  const anyCoverage = anyContent || substituteContent || recovered3;

  let outcome = null;
  if (dispatch && dispatch.outcome === 'policy_blocked') {
    outcome = 'policy_blocked'; // terminal, never softened
  } else if (recovery && recovery.outcome === 'policy_blocked') {
    outcome = 'policy_blocked';
  } else if (dispatch && dispatch.action === 'human_required') {
    outcome = 'manual_intervention_required';
  } else if (recovery && recovery.outcome === 'manual_intervention_required') {
    outcome = 'manual_intervention_required';
  } else if (failedEngines.length === 0 && !recovery
    && (!dispatch || dispatch.action === 'none' || !dispatch.action)) {
    outcome = null; // the byte-honest no-op: nothing failed, nothing claimed
  } else {
    // A recovery verdict exists (the controller's, or tiers 1-2 resolved it).
    const candidateRecovered = recovery
      ? (recovery.outcome === 'recovered')
      : !!(dispatch && dispatch.outcome === 'recovered');
    if (candidateRecovered && contractsPass && filingOk) {
      // 'recovered' ONLY here: every stage contract green AND any attempted
      // filing readback-confirmed (annex 6). No other branch can claim it.
      outcome = 'recovered';
    } else if (anyCoverage) {
      outcome = 'partial_recovery';
    } else {
      outcome = 'insufficient_evidence';
    }
  }

  // ---- recovery_paths (handles only) ----
  const recoveryPaths = [];
  if (dispatch && Array.isArray(dispatch.attempts)) {
    for (const a of dispatch.attempts) {
      if (!isPlainObject(a)) continue;
      const key = 'tier' + String(a.tier) + ':' + String(a.stage) + ':' + String(a.engine);
      if (recoveryPaths.indexOf(key) === -1) recoveryPaths.push(key);
    }
  }
  for (const s of substitutions) {
    if (!isPlainObject(s)) continue;
    const key = 'tier2:substitute:' + String(s.substitute);
    if (recoveryPaths.indexOf(key) === -1) recoveryPaths.push(key);
  }
  if (recovered3) {
    recoveryPaths.push('tier3:' + String(recovery.profile || 'diagnostic'));
  }

  // ---- freshness (annex 3: never claim live verification without a live
  // result; a substitute or cache hit is NEVER live) ----
  const liveVerified = envs.some(isLiveOk);
  let newest = null;
  for (const env of envs) {
    if (!hasContent(env) && env.status !== 'empty_valid') continue;
    if (typeof env.completed_at === 'string' && (newest === null || env.completed_at > newest)) {
      newest = env.completed_at;
    }
  }
  const freshness = {
    live_verified: liveVerified,
    newest_source_at: newest,
    warning: (!liveVerified && anyCoverage)
      ? 'no live verification this run: results are cached, local, or substituted'
      : null,
  };

  // ---- unresolved_gaps (THE VANTAGE RULE lives here) ----
  // Every gap this composer emits is GAP_SCOPE ('corpus') - structurally.
  const authoritativeEngines = Array.isArray(ctx.authoritativeEngines) ? ctx.authoritativeEngines : [];
  function isAuthoritative(env) {
    if (authoritativeEngines.indexOf(env.engine) !== -1) return true;
    return !!(isPlainObject(env.payload) && env.payload.authoritative === true);
  }
  const accessibleEmpty = envs.some(function (e) { return e.status === 'empty_valid'; });
  const unresolvedGaps = [];
  const unresolvedList = (dispatch && Array.isArray(dispatch.unresolved) && dispatch.unresolved.length > 0)
    ? dispatch.unresolved
    : failedEngines;
  const vantageTagged = new Set();
  for (const env of envs) {
    if (!isFailureEnvelope(env)) continue;
    if (!isAuthoritative(env)) continue;
    if (!accessibleEmpty) continue;
    // The Phase-218 correction, permanent: the workspace was UNAVAILABLE
    // (not empty), so absence from the accessible corpus is a PROVISIONAL,
    // corpus-scoped gap - never project-level nonexistence.
    vantageTagged.add(String(env.engine));
    unresolvedGaps.push({
      scope: GAP_SCOPE,
      tag: VANTAGE_TAG,
      detail: 'authoritative workspace \'' + String(env.engine) + '\' was unavailable this run; '
        + 'absence from the accessible corpus is PROVISIONAL for that corpus only '
        + '(evidence coverage insufficient to say more)',
    });
  }
  for (const u of unresolvedList) {
    if (!isPlainObject(u)) continue;
    if (vantageTagged.has(String(u.engine))) continue; // the vantage entry already speaks for it
    unresolvedGaps.push({
      scope: GAP_SCOPE,
      tag: typeof u.failure_class === 'string' ? u.failure_class : 'contract_violation',
      detail: String(u.stage || 'orchestration') + '/' + String(u.engine || 'unknown')
        + ' unresolved this run',
    });
  }

  // ---- assemble ----
  const disclosure = {
    failed_engines: failedEngines,
    recovery_profile: (recovery && typeof recovery.profile === 'string'
      && ['diagnostic', 'high_effort', 'forensic'].indexOf(recovery.profile) !== -1)
      ? recovery.profile : null,
    recovery_paths: recoveryPaths,
    coverage: deriveCoverage(envs, claims, ctx.requestedScope),
    freshness: freshness,
    filing: filing,
    unresolved_gaps: unresolvedGaps,
    model: modelOf(recovery, ctx),
    // The smallest-missing-thing message (dispatcher-authored, e.g. the D-11
    // claude.ai/settings/usage step) rides the disclosure verbatim.
    message: (dispatch && typeof dispatch.message === 'string') ? dispatch.message
      : ((recovery && typeof recovery.reason === 'string') ? recovery.reason : null),
  };

  return {
    research_mode: researchMode,
    outcome: outcome,
    disclosure: disclosure,
  };
}

// ---------- Exports ----------

module.exports = {
  composeRecoveryResult,
  deriveCoverage,
  OUTCOMES,
  envelopesFromProviders,
  // Private surface for tests (do NOT consume in production).
  _internal: {
    GAP_SCOPE,
    VANTAGE_TAG,
    ADDED_MODES,
    NON_LIVE_PROVENANCE,
    envelopesFromProviders,
  },
};

// RESEARCH_MODES is a lazy getter (cycle-safe with the driver, D-08: the
// landed four are imported from where they live, then extended).
Object.defineProperty(module.exports, 'RESEARCH_MODES', {
  enumerable: true,
  get: researchModes,
});
