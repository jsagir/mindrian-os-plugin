/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 221 Plan 03 Task 2 -- controller.cjs
 *
 * The bounded LLM recovery controller (REQ-3): the intelligence tier,
 * fenced. Built LAST among the engine waves (D-01) so it consumes the
 * typed stage envelopes Plan 01 landed and the dispatcher's offer_tier3
 * contract Plan 02 landed - never undefined behavior.
 *
 * THE ADAPTER RULE (SPEC boundary; the Manus rule): this module is an
 * adapter over shipped capabilities, never a parallel research stack.
 *   - journal/resume rides lib/mcp/pipeline-state.cjs recordStep /
 *     checkPosition / initChain (the SOLE chain-state truth, D-166-02;
 *     the chain-executor Wave-1 substrate) - NO new journal is built.
 *   - case-file writes ride lib/core/recovery/case-file.cjs (the
 *     mva-state tmp+rename atomic idiom).
 *   - filing truth rides lib/core/navigation/file-evidence-readback.cjs,
 *     the ONLY filing-truth authority, called at the module boundary so
 *     fence tests can spy it. 'filed' is reported ONLY on { ok:true }.
 *   - the privacy/egress vocabulary rides lib/core/rs-egress-prompts.cjs
 *     (Canon Part 8 chokepoint) - consumed, never forked.
 *
 * D-05: 7-step state machine diagnose -> plan -> execute -> validate ->
 * reconcile -> resume -> surface, persisted case file under the run's
 * .mindrian workspace, profiles diagnostic | high_effort | forensic
 * (forensic PRESERVES state, PROHIBITS mutation structurally, emits a
 * human review packet).
 *
 * D-06 hard fences (each a TEST in tests/test-221-controller-fences.cjs):
 *   1. egress un-weakenable: an ExternalEgressViolation is TERMINAL
 *      policy_blocked - never rerouted, never retried, never rephrased.
 *      Annex-3 query-planning rule: recovery may audit and pass GENERIC
 *      handles only; a Part 8 hit ends the run. Every catch below types
 *      the egress case FIRST and terminates.
 *   2. unknown-never-zero: missing ranking components surface as the
 *      typed string 'unknown' (the 219 D-18 discipline extended); the
 *      deterministic pin below forces unknown-component claims back to
 *      'missing' even if a hook upgrades them.
 *   3. writer-bypass impossible: zero raw SQL here; the ONLY filing
 *      channel is the readback module boundary; executeFn receives NO db
 *      handle and NO raw write capability.
 *   4. readback-truth: filing.confirmed_by_readback mirrors { ok:true }
 *      EXACTLY; a filing failure remains a failure regardless of any
 *      hook's confidence; review_status lands proposed, never
 *      auto-confirmed (no autonomous graph mutation - SPEC out-of-scope).
 *   5. injection-as-data: recovered content is stored byte-verbatim as
 *      quoted data in the case file and bundle; it is NEVER spliced into
 *      any prompt-shaped string (the notice references payloads by id and
 *      fingerprint only); zero eval / new Function / execSync.
 *
 * D-07: on MATERIAL surfaces entry requires the 219 D-20 gate acceptance
 * (the offer-verb pattern): the surface halts with the offer, and only an
 * accepted offer constructs ctx.accepted === true. The controller
 * RE-CHECKS the acceptance; it never re-implements the gate UI. Cadence /
 * background origins are refused outright (D-04, Canon Part 3: no
 * unattended LLM cost).
 *
 * D-11 defense in depth: the dispatcher's pre-tier-loop short-circuit is
 * the primary fence; this entry point ALSO refuses any context tagged
 * spend_limit_exceeded (offering LLM recovery for "the LLM is out of
 * budget" is a bootstrapping paradox).
 *
 * The LLM-adapter shape: ctx.diagnoseFn / ctx.executeFn / ctx.reconcileFn
 * are hook seams the invoking surface supplies - at run time that surface
 * IS the model (the 219 D-20 llm-manual pattern); in tests they are
 * stubs. Every hook result passes the deterministic validators before
 * acceptance; ctx.modelInfo { model, version } (capability-resolved at
 * runtime, never name-pinned) is recorded in the attempt ledger on every
 * hook call. Governance NEVER branches on the model identity (D-06).
 *
 * No em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const caseFile = require('./case-file.cjs');
// Phase 221-04 (D-08): the result-semantics composer - the surface step
// embeds the annex-6 disclosure in recovery-notice.md (handles / enums /
// counts ONLY, per the fence-5 rule: recovered content never reaches prose).
const resultSemantics = require('./result-semantics.cjs');
// The readback authority is called via the MODULE OBJECT (readbackMod.fn)
// at call time, never destructured, so fence tests can spy the boundary.
const readbackMod = require('../navigation/file-evidence-readback.cjs');
const se = require('./stage-envelope.cjs');
const ps = require('../../mcp/pipeline-state.cjs');

// ---------- Declared consts (annex 7: stop conditions and budgets) ----------

const CONTROLLER_BUDGETS = Object.freeze({
  MAX_ELAPSED_MS: 300000,
  MAX_MODEL_CALLS: 12,
  MAX_ALTERNATE_ENGINES: 3,
  MAX_RETRIES_PER_STAGE: 2,
  MAX_SOURCES: 25,
  MAX_ARTIFACT_BYTES: 1048576,
  MAX_RESUME_DEPTH: 3,
});

// The annex-7 early-termination list (declared, surfaced in stopped_on).
const STOP_CONDITIONS = Object.freeze([
  'policy_block',
  'missing_human_authorization',
  'authoritative_source_required',
  'unsafe_artifact',
  'repeated_failure_fingerprint',
  'no_independent_path',
  'max_elapsed_ms',
  'max_model_calls',
  'max_sources',
  'max_artifact_bytes',
  'max_resume_depth',
]);

// Profiles (annex 5). forensic.mutation false is the STRUCTURAL mutation
// prohibition: the filing channel refuses, ctx.filingRequest is skipped,
// and no write capability is ever constructed for the run.
const PROFILES = Object.freeze({
  diagnostic: Object.freeze({
    name: 'diagnostic', max_paths: 1, mutation: true, review_packet: false,
  }),
  high_effort: Object.freeze({
    name: 'high_effort', max_paths: CONTROLLER_BUDGETS.MAX_ALTERNATE_ENGINES,
    mutation: true, review_packet: false,
  }),
  forensic: Object.freeze({
    name: 'forensic', max_paths: CONTROLLER_BUDGETS.MAX_ALTERNATE_ENGINES,
    mutation: false, review_packet: true,
  }),
});

const STEPS = Object.freeze([
  'diagnose', 'plan', 'execute', 'validate', 'reconcile', 'resume', 'surface',
]);

// ---------- Helpers ----------

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isEgressViolation(err) {
  return !!(err && err.name === 'ExternalEgressViolation');
}

function sha256Hex(v) {
  const s = (typeof v === 'string') ? v : JSON.stringify(v);
  return crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
}

function resolveBudgets(ctx) {
  const over = (isPlainObject(ctx) && isPlainObject(ctx.budgets)) ? ctx.budgets : {};
  const out = {};
  for (const key of Object.keys(CONTROLLER_BUDGETS)) {
    out[key] = Number.isInteger(over[key]) ? over[key] : CONTROLLER_BUDGETS[key];
  }
  return out;
}

// Lazy egress vocabulary (the shipped Part 8 chokepoint). Fail-closed: if
// the vocabulary cannot load, the privacy check FAILS, it never silently
// passes.
let _egress = null;
function loadEgressVocab() {
  if (_egress !== null) return _egress;
  try {
    _egress = require('../rs-egress-prompts.cjs');
  } catch (err) {
    // A require failure is never an ExternalEgressViolation; fail CLOSED
    // (privacy check will report audit_vocabulary_unavailable, and the
    // plan step treats un-auditable queries as unusable).
    _egress = false;
  }
  return _egress;
}

// Unknown-never-zero normalizer (fence 2, the 219 D-18 discipline
// extended to recovery): a missing/null component becomes the typed
// string 'unknown', NEVER a numeric zero. An explicit measured 0 passes
// through untouched (a zero must mean measured-zero).
function normalizePayload(raw, idx) {
  const p = isPlainObject(raw) ? raw : { value: raw };
  const out = Object.assign({}, p);
  if (typeof out.id !== 'string' || out.id.length === 0) out.id = 'payload-' + idx;
  const comps = isPlainObject(p.components) ? Object.assign({}, p.components) : {};
  for (const key of Object.keys(comps)) {
    if (comps[key] === null || comps[key] === undefined) comps[key] = 'unknown';
  }
  if (Array.isArray(p.expected_components)) {
    for (const key of p.expected_components) {
      if (typeof key === 'string' && !(key in comps)) comps[key] = 'unknown';
    }
  }
  out.components = comps;
  out.fingerprint = sha256Hex({ id: out.id, content: out.content || null });
  return out;
}

function unknownComponentKeys(payload) {
  const keys = [];
  const comps = isPlainObject(payload.components) ? payload.components : {};
  for (const key of Object.keys(comps)) {
    if (comps[key] === 'unknown') keys.push(key);
  }
  return keys;
}

// ---------- Refusal + terminal result shapes ----------

function emptyFiling() {
  return { attempted: false, confirmed_by_readback: false, reason: null };
}

function modelOf(ctx) {
  const mi = isPlainObject(ctx.modelInfo) ? ctx.modelInfo : {};
  return {
    model: typeof mi.model === 'string' ? mi.model : 'unrecorded',
    version: typeof mi.version === 'string' ? mi.version : 'unrecorded',
  };
}

function refusal(ctx, reason) {
  return {
    refused: true,
    outcome: 'manual_intervention_required',
    reason: reason,
    profile: typeof ctx.profile === 'string' ? ctx.profile : null,
    case_dir: null,
    run_id: null,
    bundle: null,
    filing: emptyFiling(),
    model: modelOf(ctx),
    budget: { exhausted: false, stopped_on: null },
  };
}

// ---------- Entry discipline (D-07 / D-04 / D-11) ----------

function entryRefusal(ctx, opts) {
  // D-04 (Canon Part 3): cadence / background contexts NEVER reach the
  // LLM tier unattended - defense in depth behind the dispatcher predicate.
  if (ctx.origin === 'cadence' || ctx.background === true) {
    return 'refused: cadence/background origin - Tier-3 LLM recovery is '
      + 'skipped in unattended contexts (D-04, Canon Part 3)';
  }
  // D-11 defense in depth: the controller entry point itself refuses a
  // spend_limit_exceeded-tagged context (the dispatcher short-circuit is
  // the primary fence; this is the second lock on the same door).
  const envs = Array.isArray(ctx.envelopes) ? ctx.envelopes : [];
  for (const env of envs) {
    if (isPlainObject(env) && env.failure_class === 'spend_limit_exceeded') {
      return 'refused: spend_limit_exceeded context - offering LLM recovery '
        + 'for an exhausted LLM budget is a bootstrapping paradox (D-11); '
        + 'raise your limit at claude.ai/settings/usage or wait for the reset';
    }
  }
  // D-07: entered ONLY via the dispatcher's offer_tier3 action (or the
  // explicit opts.direct test seam).
  const direct = isPlainObject(opts) && opts.direct === true;
  const action = isPlainObject(ctx.dispatch) ? ctx.dispatch.action : null;
  if (!direct && action !== 'offer_tier3') {
    return 'refused: entry requires the dispatcher offer_tier3 action '
      + '(D-07) - the controller has one front door';
  }
  // D-07 / D-20: on MATERIAL surfaces the Tier-3 entry is gate-OFFERED;
  // only an ACCEPTED offer (the same D-20 gate machinery 219 shipped)
  // constructs ctx.accepted === true. Re-check, never re-implement.
  if (ctx.material === true && ctx.accepted !== true) {
    return 'refused: material surface without gate acceptance - Tier-3 must '
      + 'be OFFERED and accepted via the 219 D-20 offer-verb gate (D-07); '
      + 'never default, never silent';
  }
  return null;
}

// ---------- runRecovery ----------
//
// runRecovery(ctx, opts) -> the recovery result (Plan 04 consumes verbatim):
// { outcome, profile, case_dir, bundle, filing, model, budget } plus
// refused / halted_at extras on those paths. See the 221-03-PLAN
// interfaces block for the ctx shape.

async function runRecovery(ctx, opts) {
  const c = isPlainObject(ctx) ? ctx : {};
  const refuseReason = entryRefusal(c, opts);
  if (refuseReason) return refusal(c, refuseReason);

  if (typeof c.roomDir !== 'string' || c.roomDir.length === 0) {
    return refusal(c, 'refused: roomDir required for the case file');
  }

  const profileName = Object.prototype.hasOwnProperty.call(PROFILES, c.profile)
    ? c.profile : 'diagnostic';
  const profile = PROFILES[profileName];
  const budgets = resolveBudgets(c);
  const clock = (typeof c._clock === 'function') ? c._clock : Date.now;
  const startedAt = clock();
  const model = modelOf(c);

  // Case file: fresh mint, or resume the retained case (annex 7).
  const resuming = typeof c.resume_run_id === 'string' && c.resume_run_id.length > 0;
  const handle = resuming
    ? caseFile.openCaseFile(c.roomDir, { run_id: c.resume_run_id, resume: true })
    : caseFile.openCaseFile(c.roomDir);

  // Journal: pipeline-state is the SOLE chain-state truth (D-166-02),
  // seeded INSIDE the case dir so the recovery journal is retained with
  // the case file and never collides with the room's own pipeline chain.
  let chainState = ps.read(handle.dir);
  if (!chainState) {
    chainState = ps.initChain(handle.dir, STEPS.slice(), 'manual');
  } else if (resuming) {
    // MAX_RESUME_DEPTH (annex 7): resume depth is persisted with the case.
    chainState.resume_count = (chainState.resume_count || 0) + 1;
    ps.write(handle.dir, chainState);
    if (chainState.resume_count > budgets.MAX_RESUME_DEPTH) {
      return {
        outcome: 'manual_intervention_required',
        profile: profileName,
        case_dir: handle.dir,
        run_id: handle.run_id,
        bundle: null,
        filing: emptyFiling(),
        model: model,
        budget: { exhausted: true, stopped_on: 'max_resume_depth' },
      };
    }
  }

  // Shared run state, reloaded from the case file for completed steps.
  const S = {
    diagnosis: null,
    plan: null,
    payloads: [],
    validation: null,
    claims: [],
    bundle: null,
    filing: emptyFiling(),
    budget: { exhausted: false, stopped_on: null },
    modelCalls: 0,
    lastFingerprint: null,
    terminal: null, // 'policy_blocked' when the egress fence fires
  };

  // Budget continuity across resume: model calls already spent live in
  // the retained ledger (case file retained for resume, annex 7).
  const ledgerPath = path.join(handle.dir, 'attempt-ledger.jsonl');
  if (fs.existsSync(ledgerPath)) {
    const lines = fs.readFileSync(ledgerPath, 'utf8').split('\n')
      .filter(function (l) { return l.length > 0; });
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed && typeof parsed.hook === 'string' && parsed.hook !== 'filing') {
          S.modelCalls += 1;
        }
      } catch (err) {
        // Never an ExternalEgressViolation (JSON parse); a malformed
        // ledger line is skipped for counting; validateCaseFile reports it.
        if (isEgressViolation(err)) throw err;
      }
    }
  }

  // ---- Budget gate: called before every hook invocation. Returns the
  // stop-condition name when a budget is exhausted, else null.
  function budgetStop() {
    if (S.budget.stopped_on) return S.budget.stopped_on;
    if (clock() - startedAt > budgets.MAX_ELAPSED_MS) {
      S.budget.exhausted = true;
      S.budget.stopped_on = 'max_elapsed_ms';
      return S.budget.stopped_on;
    }
    if (S.modelCalls >= budgets.MAX_MODEL_CALLS) {
      S.budget.exhausted = true;
      S.budget.stopped_on = 'max_model_calls';
      return S.budget.stopped_on;
    }
    return null;
  }

  function ledgerHook(step, hook, extra) {
    caseFile.appendLedger(handle, Object.assign({
      step: step,
      hook: hook,
      model: model.model,
      version: model.version,
    }, extra || {}));
  }

  // ---- The ONLY filing channel (fences 3 + 4). Forensic refuses
  // STRUCTURALLY; every real attempt routes through the readback module
  // boundary; confirmed_by_readback mirrors { ok:true } EXACTLY.
  function filingChannel(params) {
    if (profile.mutation !== true) {
      ledgerHook('execute', 'filing', { result: 'refused_forensic_mutation_prohibited' });
      return {
        ok: false,
        refused: true,
        reason: 'forensic_mutation_prohibited: the forensic profile preserves '
          + 'state and prohibits mutation (annex 5, T-221-18)',
      };
    }
    S.filing.attempted = true;
    let res;
    // The Plan 01 injection seam threaded through (fence 4): a forced
    // readback mismatch is a filing that did not land, period.
    const forced = se.forcedFailure('readback', c);
    if (forced && forced.failure_class === 'readback_mismatch') {
      res = { ok: false, reason: 'filing_did_not_land', detail: 'forced_readback_mismatch' };
    } else {
      // Module-boundary call (never destructured): the ONLY filing-truth
      // authority. review_status lands 'proposed' inside it, never
      // auto-confirmed here.
      res = readbackMod.fileEvidenceWithReadback(c.db, params);
    }
    const confirmed = !!(res && res.ok === true);
    S.filing.confirmed_by_readback = confirmed;
    S.filing.reason = confirmed ? null : ((res && res.reason) || 'unknown');
    ledgerHook('resume', 'filing', {
      result: confirmed ? 'confirmed_by_readback' : String(S.filing.reason),
    });
    return res;
  }

  // ---- Step implementations ----

  function stepDiagnose() {
    const envs = (Array.isArray(c.envelopes) ? c.envelopes : []).filter(isPlainObject);
    const classified = [];
    for (const env of envs) {
      const v = se.validateStageEnvelope(env);
      const failing = env.status === 'failed' || env.status === 'blocked';
      if (!v.ok) {
        classified.push({
          stage: typeof env.stage === 'string' ? env.stage : 'orchestration',
          engine: typeof env.engine === 'string' ? env.engine : 'unknown',
          failure_class: 'contract_violation',
          tier_hint: 3,
        });
      } else if (failing) {
        classified.push({
          stage: env.stage,
          engine: env.engine,
          failure_class: env.failure_class,
          tier_hint: 3,
        });
      }
    }
    let enrichment = null;
    if (typeof c.diagnoseFn === 'function' && !budgetStop()) {
      S.modelCalls += 1;
      let raw;
      try {
        raw = c.diagnoseFn({ envelopes: envs, classified: classified });
      } catch (err) {
        if (isEgressViolation(err)) { S.terminal = 'policy_blocked'; raw = null; } else { raw = null; }
      }
      // Hook output is DATA, never authority: only a plain object is
      // accepted, and only as the enrichment field.
      enrichment = isPlainObject(raw) ? raw : null;
      ledgerHook('diagnose', 'diagnoseFn', { result: enrichment ? 'accepted' : 'rejected_or_null' });
    }
    S.diagnosis = { envelopes: envs, classified: classified, enrichment: enrichment };
    caseFile.writeArtifact(handle, 'failure-diagnosis.json', S.diagnosis);
  }

  function loadDiagnose() {
    S.diagnosis = JSON.parse(fs.readFileSync(path.join(handle.dir, 'failure-diagnosis.json'), 'utf8'));
  }

  function stepPlan() {
    // Alternate REGISTERED tools only (the adapter rule): the shipped
    // room-corpus provider and research cache are the recovery lanes; the
    // frozen deep_research reach lives at the surface, never here.
    const classified = S.diagnosis.classified;
    // Egress fence at query planning (annex 3): every query handle passes
    // the Part 8 vocabulary BEFORE any execution. Generic handles only; a
    // hit is TERMINAL policy_blocked, never rephrased.
    const queries = [];
    const vocab = loadEgressVocab();
    const handles = Array.isArray(c.topicHandles) ? c.topicHandles : [];
    for (const q of handles) {
      if (typeof q !== 'string' || q.length === 0) continue;
      if (!vocab) continue; // vocabulary unavailable: query unusable (fail closed)
      try {
        vocab.auditQueryString(q, 'recovery-controller');
        queries.push(q);
      } catch (err) {
        if (isEgressViolation(err)) {
          S.terminal = 'policy_blocked';
          break;
        }
        throw err;
      }
    }
    const paths = [];
    if (S.terminal === null) {
      const cap = Math.min(profile.max_paths, budgets.MAX_ALTERNATE_ENGINES);
      let i = 0;
      for (const cl of classified) {
        if (cl.failure_class === 'policy_blocked') { S.terminal = 'policy_blocked'; break; }
        if (paths.length >= cap) break;
        i += 1;
        paths.push({
          path_id: 'path-' + i,
          stage: cl.stage,
          engine: cl.engine,
          tool: 'room-corpus',
        });
      }
    }
    S.plan = {
      alternate_tools: ['room-corpus', 'research-cache'],
      budgets: budgets,
      permissions: { mutation: profile.mutation, egress: false },
      stop_conditions: STOP_CONDITIONS.slice(),
      paths: paths,
      queries: queries,
      profile: profileName,
    };
    caseFile.writeArtifact(handle, 'recovery-plan.json', S.plan);
  }

  function loadPlan() {
    S.plan = JSON.parse(fs.readFileSync(path.join(handle.dir, 'recovery-plan.json'), 'utf8'));
  }

  async function stepExecute() {
    if (S.terminal) return;
    const tools = {
      case_dir: handle.dir,
      profile: profileName,
      // The ONE write-shaped capability, and it is the governed filing
      // channel (fence 3): no db handle, no raw write ever reaches a hook.
      file: filingChannel,
    };
    for (const p of S.plan.paths) {
      if (S.terminal) break;
      if (budgetStop()) break;
      if (typeof c.executeFn !== 'function') break;
      if (c._faultAt === 'execute') throw new Error('injected_fault:execute');
      S.modelCalls += 1;
      let raw;
      let threw = null;
      try {
        raw = await c.executeFn(p, tools);
      } catch (err) {
        // FENCE 1 (D-06, T-221-12): an egress violation is TERMINAL
        // policy_blocked - zero further attempts, zero rerouting, zero
        // rephrasing. The catch types-and-terminates.
        if (isEgressViolation(err)) {
          ledgerHook('execute', 'executeFn', { path_id: p.path_id, result: 'egress_violation' });
          S.terminal = 'policy_blocked';
          break;
        }
        threw = err;
      }
      if (threw) {
        // The fingerprint deliberately EXCLUDES the engine: a byte-identical
        // failure on a DIFFERENT alternate path means the failure is not
        // engine-specific - no remaining independent path (annex 7).
        const fingerprint = sha256Hex({
          stage: p.stage, message: String(threw.message || threw),
        });
        ledgerHook('execute', 'executeFn', {
          path_id: p.path_id, result: 'threw', failure_fingerprint: fingerprint,
        });
        if (S.lastFingerprint === fingerprint) {
          // Annex-7 early termination: a repeated identical failure
          // fingerprint means no remaining independent path this way.
          S.budget.stopped_on = 'repeated_failure_fingerprint';
          break;
        }
        S.lastFingerprint = fingerprint;
        continue;
      }
      const rawPayloads = (isPlainObject(raw) && Array.isArray(raw.payloads)) ? raw.payloads : [];
      const normalized = rawPayloads.map(function (rp, idx) {
        return normalizePayload(rp, S.payloads.length + idx + 1);
      });
      ledgerHook('execute', 'executeFn', {
        path_id: p.path_id, result: 'ok', payloads: normalized,
      });
      for (const np of normalized) S.payloads.push(np);
      if (S.payloads.length > budgets.MAX_SOURCES) {
        S.budget.exhausted = true;
        S.budget.stopped_on = 'max_sources';
        break;
      }
      if (JSON.stringify(S.payloads).length > budgets.MAX_ARTIFACT_BYTES) {
        S.budget.exhausted = true;
        S.budget.stopped_on = 'max_artifact_bytes';
        break;
      }
    }
  }

  function loadExecute() {
    S.payloads = [];
    if (!fs.existsSync(ledgerPath)) return;
    const lines = fs.readFileSync(ledgerPath, 'utf8').split('\n')
      .filter(function (l) { return l.length > 0; });
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed && parsed.step === 'execute' && Array.isArray(parsed.payloads)) {
          for (const p of parsed.payloads) S.payloads.push(p);
        }
      } catch (err) {
        if (isEgressViolation(err)) throw err; // never here (JSON parse); typed anyway
      }
    }
  }

  function stepValidate() {
    if (c._faultAt === 'validate') throw new Error('injected_fault:validate');
    const checks = {};
    // schema: every recovered payload is a plain object with an id.
    const badSchema = S.payloads.filter(function (p) {
      return !isPlainObject(p) || typeof p.id !== 'string';
    });
    checks.schema = { ok: badSchema.length === 0, detail: badSchema.length + ' malformed' };
    // provenance: presence required on every payload.
    const noProv = S.payloads.filter(function (p) {
      return !Array.isArray(p.provenance) || p.provenance.length === 0;
    });
    checks.provenance = { ok: noProv.length === 0, detail: noProv.length + ' without provenance' };
    // locator: a claim without a locator cannot rise above unverified
    // (annex 3 segmentation rule).
    let claimsMissingLocator = 0;
    for (const p of S.payloads) {
      const cls = Array.isArray(p.claims) ? p.claims : [];
      for (const cl of cls) {
        if (!isPlainObject(cl) || typeof cl.locator !== 'string' || cl.locator.length === 0) {
          claimsMissingLocator += 1;
        }
      }
    }
    checks.locator = { ok: claimsMissingLocator === 0, detail: claimsMissingLocator + ' claims without locator' };
    // freshness: absence is DISCLOSED, never fabricated and never zero.
    const withFreshness = S.payloads.filter(function (p) {
      return typeof p.retrieved_at === 'string' && p.retrieved_at.length > 0;
    });
    checks.freshness = {
      ok: true,
      detail: withFreshness.length === S.payloads.length
        ? 'all payloads carry retrieved_at' : 'freshness_unknown on some payloads (disclosed)',
    };
    // dedup: fingerprint identity, never prose similarity (annex 3).
    const fingerprints = S.payloads.map(function (p) { return p.fingerprint; });
    const dup = fingerprints.length !== new Set(fingerprints).size;
    checks.dedup = { ok: !dup, detail: dup ? 'duplicate payload fingerprints' : 'unique' };
    // privacy: every plan query re-audited through the shipped Part 8
    // vocabulary (fail closed when unavailable).
    const vocab = loadEgressVocab();
    if (!vocab) {
      checks.privacy = { ok: false, detail: 'audit_vocabulary_unavailable (fail closed)' };
    } else {
      let privacyOk = true;
      for (const q of (Array.isArray(S.plan.queries) ? S.plan.queries : [])) {
        try {
          vocab.auditQueryString(q, 'recovery-controller');
        } catch (err) {
          if (isEgressViolation(err)) { privacyOk = false; S.terminal = 'policy_blocked'; break; }
          throw err;
        }
      }
      checks.privacy = { ok: privacyOk, detail: privacyOk ? 'queries generic' : 'forbidden pattern' };
    }
    // policy: no egress violation occurred anywhere in the run so far.
    checks.policy = {
      ok: S.terminal === null,
      detail: S.terminal === null ? 'no policy events' : String(S.terminal),
    };
    // readback: expectation declared; the truth is asserted at filing time
    // (fence 4) and mirrored into the result verbatim.
    checks.readback = {
      ok: true,
      detail: 'readback truth asserted at filing time via file-evidence-readback',
    };
    S.validation = { checks: checks };
    caseFile.writeArtifact(handle, 'validation-report.json', S.validation);
  }

  function loadValidate() {
    S.validation = JSON.parse(fs.readFileSync(path.join(handle.dir, 'validation-report.json'), 'utf8'));
  }

  async function stepReconcile() {
    if (c._faultAt === 'reconcile') throw new Error('injected_fault:reconcile');
    // Deterministic claim extraction FIRST; the ledger exists on disk
    // BEFORE any reconcile hook runs (claims-before-synthesis).
    const claims = [];
    for (const p of S.payloads) {
      const cls = Array.isArray(p.claims) ? p.claims : [];
      for (const cl of cls) {
        if (!isPlainObject(cl) || typeof cl.claim !== 'string') continue;
        claims.push({
          claim: cl.claim,
          state: 'missing',
          evidence: [p.id],
          locator: typeof cl.locator === 'string' ? cl.locator : null,
          origin: 'payload_claim',
        });
      }
      // FENCE 2: unknown components SURFACE in the claim ledger as
      // 'missing' claims - and are pinned there (deterministic authority).
      for (const key of unknownComponentKeys(p)) {
        claims.push({
          claim: 'component:' + key + ' of ' + p.id + ' is unknown',
          state: 'missing',
          evidence: [p.id],
          locator: null,
          origin: 'unknown_component',
        });
      }
    }
    caseFile.writeArtifact(handle, 'claim-evidence-ledger.json', { claims: claims });

    if (typeof c.reconcileFn === 'function' && claims.length > 0 && !budgetStop()) {
      S.modelCalls += 1;
      let mapped;
      try {
        mapped = await c.reconcileFn(claims.map(function (cl) { return Object.assign({}, cl); }));
      } catch (err) {
        if (isEgressViolation(err)) { S.terminal = 'policy_blocked'; mapped = null; } else { mapped = null; }
      }
      // Deterministic validation of the hook mapping: same length, states
      // in the enum, claims never dropped or invented. Contradictory
      // sources SURFACE as 'conflicting', never averaged.
      const states = caseFile._internal.CLAIM_STATES;
      const valid = Array.isArray(mapped)
        && mapped.length === claims.length
        && mapped.every(function (m, i) {
          return isPlainObject(m) && m.claim === claims[i].claim
            && states.indexOf(m.state) !== -1;
        });
      ledgerHook('reconcile', 'reconcileFn', { result: valid ? 'accepted' : 'rejected' });
      if (valid) {
        for (let i = 0; i < claims.length; i += 1) {
          // The D-18 pin: an unknown-component claim can NEVER be upgraded
          // by a hook - unknown stays unknown (fence 2).
          claims[i].state = (claims[i].origin === 'unknown_component')
            ? 'missing' : mapped[i].state;
        }
        caseFile.writeArtifact(handle, 'claim-evidence-ledger.json', { claims: claims });
      }
    }
    S.claims = claims;
  }

  function loadReconcile() {
    S.claims = JSON.parse(fs.readFileSync(path.join(handle.dir, 'claim-evidence-ledger.json'), 'utf8')).claims;
  }

  function stepResume() {
    if (c._faultAt === 'resume') throw new Error('injected_fault:resume');
    // Filing (optional, never under forensic, never after a stop): the
    // governed channel only.
    if (isPlainObject(c.filingRequest) && profile.mutation === true
      && S.terminal === null && S.budget.stopped_on === null) {
      filingChannel(c.filingRequest);
    }
    S.bundle = {
      resume_stage: (isPlainObject(c.dispatch) && typeof c.dispatch.resume_stage === 'string')
        ? c.dispatch.resume_stage
        : ((S.diagnosis.classified[0] && S.diagnosis.classified[0].stage) || 'orchestration'),
      recovered_payloads: S.payloads,
      claims: S.claims,
      filing: S.filing,
    };
    caseFile.writeArtifact(handle, 'recovery-bundle.json', S.bundle);
  }

  function loadResume() {
    S.bundle = JSON.parse(fs.readFileSync(path.join(handle.dir, 'recovery-bundle.json'), 'utf8'));
    if (isPlainObject(S.bundle.filing)) S.filing = S.bundle.filing;
  }

  function stepSurface() {
    if (c._faultAt === 'surface') throw new Error('injected_fault:surface');
    // FENCE 5: the notice references payloads by id + fingerprint ONLY.
    // Recovered content is quoted data in the JSON artifacts; it is never
    // spliced into this (or any) prose surface.
    const counts = { supported: 0, conflicting: 0, unsupported: 0, missing: 0 };
    for (const cl of S.claims) {
      if (counts[cl.state] !== undefined) counts[cl.state] += 1;
    }
    const failedLines = S.diagnosis.classified.map(function (cl) {
      return '- ' + cl.stage + ' / ' + cl.engine + ': ' + cl.failure_class;
    });
    const payloadLines = S.payloads.map(function (p) {
      return '- ' + p.id + ' (fingerprint ' + String(p.fingerprint).slice(0, 12) + ')';
    });
    const notice = [
      '# Recovery notice',
      '',
      'An engine broke mid-run. This is what happened, in plain language.',
      '',
      '## What failed',
      '',
    ].concat(failedLines.length ? failedLines : ['- nothing classified'])
      .concat([
        '',
        '## What recovery did',
        '',
        '- Profile: ' + profileName + (profile.mutation ? '' : ' (state preserved, mutation prohibited)'),
        '- Alternate paths planned: ' + S.plan.paths.length,
        '- Payloads recovered (by id, content quoted in recovery-bundle.json):',
      ])
      .concat(payloadLines.length ? payloadLines : ['- none'])
      .concat([
        '',
        '## Claim coverage',
        '',
        '- supported: ' + counts.supported,
        '- conflicting: ' + counts.conflicting,
        '- unsupported: ' + counts.unsupported,
        '- missing (includes unknown components): ' + counts.missing,
        '',
        '## Filing',
        '',
        '- attempted: ' + S.filing.attempted,
        '- confirmed by readback: ' + S.filing.confirmed_by_readback,
        '- reason: ' + String(S.filing.reason),
        '',
        '## Model (recorded, never governing)',
        '',
        '- model: ' + model.model,
        '- version: ' + model.version,
        '',
        '## Budget',
        '',
        '- exhausted: ' + S.budget.exhausted,
        '- stopped on: ' + String(S.budget.stopped_on),
        '',
        '## Disclosure (annex 6, machine-readable)',
        '',
        // Phase 221-04 (D-08): the composed disclosure, embedded. It carries
        // enums / handles / counts / timestamps ONLY (claim text stays quoted
        // in claim-evidence-ledger.json - fence 5 holds on this surface too).
        '```json',
        JSON.stringify(resultSemantics.composeRecoveryResult({
          envelopes: Array.isArray(c.envelopes) ? c.envelopes : [],
          dispatch: isPlainObject(c.dispatch) ? c.dispatch : null,
          recovery: {
            outcome: null, // outcome is assembled AFTER surface; disclosure fields only
            profile: profileName,
            bundle: { resume_stage: S.bundle ? S.bundle.resume_stage : null, recovered_payloads: S.payloads, claims: S.claims },
            filing: S.filing,
            model: model,
            budget: S.budget,
          },
          ctx: { requestedScope: Array.isArray(c.topicHandles) ? c.topicHandles : [], modelInfo: model },
        }).disclosure, null, 2),
        '```',
        '',
      ]).join('\n');
    caseFile.writeArtifact(handle, 'recovery-notice.md', notice);
  }

  // ---- The state machine runner: pipeline-state owns position truth.
  // Completed steps are LOADED from the case file, never re-run; the next
  // step is admitted only through the checkPosition hard gate.

  const loaders = {
    diagnose: loadDiagnose,
    plan: loadPlan,
    execute: loadExecute,
    validate: loadValidate,
    reconcile: loadReconcile,
    resume: loadResume,
    surface: function () { /* the notice needs no reload */ },
  };
  const runners = {
    diagnose: stepDiagnose,
    plan: stepPlan,
    execute: stepExecute,
    validate: stepValidate,
    reconcile: stepReconcile,
    resume: stepResume,
    surface: stepSurface,
  };

  for (let i = 0; i < STEPS.length; i += 1) {
    const step = STEPS[i];
    const state = ps.read(handle.dir);
    if (state && state.chain_position >= i) {
      // Already journaled complete: reload its persisted output, never
      // re-run (the isNext discipline: completed steps stay completed).
      loaders[step]();
      continue;
    }
    const pos = ps.checkPosition(handle.dir, step);
    if (pos.gate !== 'run') {
      return {
        outcome: 'manual_intervention_required',
        profile: profileName,
        case_dir: handle.dir,
        run_id: handle.run_id,
        halted_at: step,
        resumable: true,
        reason: 'journal_gate_withhold:' + String(pos.reason),
        bundle: S.bundle,
        filing: S.filing,
        model: model,
        budget: { exhausted: S.budget.exhausted, stopped_on: S.budget.stopped_on },
      };
    }
    try {
      await runners[step]();
    } catch (err) {
      // FENCE 1 first: an egress violation escaping a step is TERMINAL
      // policy_blocked (types-and-terminates, never rerouted).
      if (isEgressViolation(err)) {
        S.terminal = 'policy_blocked';
      } else {
        // A crash mid-step: the case file is retained; a resume re-enters
        // AT this step via the journal gate (annex 3 orchestration rule).
        return {
          outcome: 'manual_intervention_required',
          profile: profileName,
          case_dir: handle.dir,
          run_id: handle.run_id,
          halted_at: step,
          resumable: true,
          error: String(err && err.message ? err.message : err).slice(0, 120),
          bundle: S.bundle,
          filing: S.filing,
          model: model,
          budget: { exhausted: S.budget.exhausted, stopped_on: S.budget.stopped_on },
        };
      }
    }
    if (S.terminal === 'policy_blocked') {
      // Egress fence terminal: the run ENDS. Never rerouted, never
      // retried with a rephrased query, never offered onward.
      return {
        outcome: 'policy_blocked',
        profile: profileName,
        case_dir: handle.dir,
        run_id: handle.run_id,
        bundle: null,
        filing: S.filing,
        model: model,
        budget: { exhausted: S.budget.exhausted, stopped_on: 'policy_block' },
      };
    }
    ps.recordStep(handle.dir, step, 'recovery:' + step);
  }

  // ---- Outcome assembly (annex 6). 'recovered' ONLY when every required
  // stage contract passes AND persisted evidence is readback-confirmed
  // (the case file itself validates, and a filing - when attempted - is
  // confirmed by the readback authority; a filing failure remains a
  // failure regardless of any hook's confidence).
  const caseOk = caseFile.validateCaseFile(handle).ok;
  const checksOk = S.validation && Object.keys(S.validation.checks).every(function (k) {
    return S.validation.checks[k].ok === true;
  });
  const claimsOk = S.claims.every(function (cl) { return cl.state === 'supported'; });
  const filingOk = !S.filing.attempted || S.filing.confirmed_by_readback === true;
  const stopped = S.budget.stopped_on !== null;
  const anyRecovery = S.payloads.length > 0;

  let outcome;
  if (!stopped && caseOk && checksOk && claimsOk && filingOk && anyRecovery !== false) {
    // anyRecovery may be false with zero paths planned; an empty recovery
    // with nothing to recover is still honest below.
    outcome = anyRecovery ? 'recovered' : 'insufficient_evidence';
  } else {
    outcome = anyRecovery ? 'partial_recovery' : 'insufficient_evidence';
  }

  return {
    outcome: outcome,
    profile: profileName,
    case_dir: handle.dir,
    run_id: handle.run_id,
    bundle: {
      resume_stage: S.bundle.resume_stage,
      recovered_payloads: S.bundle.recovered_payloads,
      claims: S.bundle.claims,
    },
    filing: S.filing,
    model: model,
    budget: { exhausted: S.budget.exhausted, stopped_on: S.budget.stopped_on },
  };
}

// ---------- Exports ----------

module.exports = {
  runRecovery,
  PROFILES,
  CONTROLLER_BUDGETS,
  // Private surface for tests (do NOT consume in production).
  _internal: {
    STEPS,
    STOP_CONDITIONS,
    normalizePayload,
    entryRefusal,
    isEgressViolation,
  },
};
