#!/usr/bin/env node
'use strict';
/*
 * Phase 221 Plan 02 -- REQ-2 dispatcher suite (the 6-tier recovery ladder).
 *
 * Task 1 groups (D): the dispatcher core
 *   D0 exports: frozen TIERS + RECOVERY_BUDGETS consts (declared values)
 *   D1 Tier-0 pass-through: all-ok -> none; empty_valid -> ZERO recovery calls
 *   D2 Tier-1 bounded idempotent retry: backoff, cap, distinct exhaustion
 *      reason; filing (a write) is NEVER retried
 *   D3 Tier-2 governed substitution: exact provenance vocabulary
 *      ('web: absent (room-corpus degrade)' / 'research-cache'), never 'live'
 *   D4 Tier-3 trigger discipline: shouldOfferTier3 pure predicate -- four
 *      triggers, never-cases (empty_valid / policy_blocked /
 *      spend_limit_exceeded / cadence / background); malformed envelope =
 *      contract_violation
 *   D5 egress terminal: ExternalEgressViolation caught at the dispatch
 *      boundary ONLY -> policy_blocked TERMINAL (no retry / substitute /
 *      offer / rephrase)
 *   D6 budget exhaustion: terminated + partial_recovery + explicit
 *      unresolved[] -- never an empty-success shape
 *   D7 spend_limit_exceeded (D-11, self-validated 2026-07-13): structural
 *      early-return BEFORE the tier loop -> human_required with the
 *      claude.ai/settings/usage message; literally ZERO retry calls
 *
 * Task 2 groups (M): the REQ-2 acceptance matrix rows on runSourceLens
 *   (extended in the Task 2 RED step -- same file, never a fork)
 *
 * Hermetic: every engine stubbed, zero network, _sleep test seam so backoff
 * runs instantly. No em-dashes anywhere (CLAUDE.md). CJS only.
 */

const assert = require('node:assert');
const path = require('node:path');

let passed = 0;
let failed = 0;

function record(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('  ok  ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stdout.write('  FAIL  ' + name + '\n');
    process.stdout.write('        ' + (err && err.stack ? err.stack : String(err)) + '\n');
  }
}

async function recordAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    process.stdout.write('  ok  ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stdout.write('  FAIL  ' + name + '\n');
    process.stdout.write('        ' + (err && err.stack ? err.stack : String(err)) + '\n');
  }
}

const SE_PATH = path.resolve(__dirname, '..', 'lib', 'core', 'recovery', 'stage-envelope.cjs');
const DISPATCHER_PATH = path.resolve(__dirname, '..', 'lib', 'core', 'recovery', 'dispatcher.cjs');

const se = require(SE_PATH);
const d = require(DISPATCHER_PATH);

// ---------- envelope fixtures ----------

function envOk(engine) {
  return se.makeStageEnvelope({
    stage: 'retrieval', engine: engine, status: 'ok',
    payload: { results: [{ id: 'https://x/' + engine }] }, output: [{ id: 'x' }],
  });
}
function envEmpty(engine) {
  return se.makeStageEnvelope({
    stage: 'retrieval', engine: engine, status: 'empty_valid',
    payload: { results: [] }, output: [],
  });
}
function envTimeout(engine, stage) {
  return se.makeStageEnvelope({
    stage: stage || 'retrieval', engine: engine, status: 'failed',
    failure_class: 'network_timeout', retryable: true, error: 'timed out',
  });
}
function envCred(engine) {
  return se.makeStageEnvelope({
    stage: 'retrieval', engine: engine, status: 'blocked',
    failure_class: 'missing_credential', retryable: false, error: 'no key',
  });
}
function envPolicy(engine) {
  return se.makeStageEnvelope({
    stage: 'retrieval', engine: engine, status: 'blocked',
    failure_class: 'policy_blocked', retryable: false, error: 'egress audit rejection',
  });
}
function envSpend(engine, stage) {
  return se.makeStageEnvelope({
    stage: stage || 'retrieval', engine: engine || 'anthropic', status: 'blocked',
    failure_class: 'spend_limit_exceeded', error: 'monthly spend limit hit',
  });
}
function envContract(engine) {
  return se.makeStageEnvelope({
    stage: 'extraction', engine: engine || 'extractor', status: 'failed',
    failure_class: 'contract_violation', retryable: false, error: 'schema breach',
  });
}

// ctx factory: instant sleep + call-counting spies.
function makeCtx(over) {
  const calls = { retry: 0, substitute: 0, sleeps: [] };
  const ctx = Object.assign({
    origin: 'on_demand',
    roomDir: '',
    topicHandles: ['generic topic'],
    _sleep: async function (ms) { calls.sleeps.push(ms); },
    retryFn: async function (env, _attempt) { calls.retry += 1; return envTimeout(env.engine, env.stage); },
    substituteFn: async function (_env, _ctx) { calls.substitute += 1; return null; },
  }, over || {});
  return { ctx: ctx, calls: calls };
}

console.log('=== 221-02 dispatcher suite: starting ===');

(async function main() {

  // =========================================================================
  // D0 -- exports + declared consts
  // =========================================================================

  record('D0 exports: dispatchRecovery, shouldOfferTier3, frozen TIERS + RECOVERY_BUDGETS with declared values', function () {
    assert.equal(typeof d.dispatchRecovery, 'function');
    assert.equal(typeof d.shouldOfferTier3, 'function');
    assert.ok(Object.isFrozen(d.TIERS), 'TIERS frozen');
    assert.ok(Object.isFrozen(d.RECOVERY_BUDGETS), 'RECOVERY_BUDGETS frozen');
    assert.equal(d.RECOVERY_BUDGETS.MAX_RETRIES_PER_STAGE, 2);
    assert.deepEqual(d.RECOVERY_BUDGETS.RETRY_BACKOFF_MS, [250, 1000]);
    assert.equal(d.RECOVERY_BUDGETS.MAX_ALTERNATE_ENGINES, 3);
    assert.equal(d.RECOVERY_BUDGETS.REQUIRED_STAGE_TIMEOUT_MS, 30000);
    assert.equal(d.RECOVERY_BUDGETS.IMPLAUSIBLE_COVERAGE_RATIO, 0.25);
  });

  // =========================================================================
  // D1 -- Tier-0 pass-through (empty_valid NEVER recovers, D-04)
  // =========================================================================

  await recordAsync('D1a all-ok envelopes -> action none, zero attempts, zero recovery calls', async function () {
    const { ctx, calls } = makeCtx();
    const res = await d.dispatchRecovery({ envelopes: [envOk('tavily'), envOk('openalex')], ctx: ctx });
    assert.equal(res.action, 'none');
    assert.equal(res.outcome, null);
    assert.equal(res.attempts.length, 0);
    assert.equal(res.substitutions.length, 0);
    assert.equal(res.unresolved.length, 0);
    assert.equal(calls.retry, 0);
    assert.equal(calls.substitute, 0);
  });

  await recordAsync('D1b empty_valid stays a FINDING: action none, ZERO recovery calls (spied)', async function () {
    const { ctx, calls } = makeCtx();
    const res = await d.dispatchRecovery({ envelopes: [envEmpty('tavily'), envEmpty('openalex')], ctx: ctx });
    assert.equal(res.action, 'none', 'a legitimate empty is never recovered (D-04); got ' + res.action);
    assert.equal(calls.retry, 0, 'zero retryFn calls on empty_valid');
    assert.equal(calls.substitute, 0, 'zero substituteFn calls on empty_valid');
    assert.equal(res.unresolved.length, 0);
  });

  // =========================================================================
  // D2 -- Tier-1 bounded idempotent retry
  // =========================================================================

  await recordAsync('D2a retryable timeout on an idempotent stage: bounded retries + backoff + distinct exhaustion reason', async function () {
    const { ctx, calls } = makeCtx();
    const res = await d.dispatchRecovery({ envelopes: [envTimeout('tavily')], ctx: ctx });
    assert.equal(calls.retry, d.RECOVERY_BUDGETS.MAX_RETRIES_PER_STAGE, 'exactly MAX_RETRIES_PER_STAGE retries; got ' + calls.retry);
    assert.deepEqual(calls.sleeps, d.RECOVERY_BUDGETS.RETRY_BACKOFF_MS, 'backoff schedule honored via the _sleep seam');
    assert.ok(res.attempts.length >= 2, 'every attempt recorded');
    assert.ok(res.attempts.every(function (a) { return a.tier === 1; }), 'attempts are Tier-1');
    assert.ok(res.attempts.some(function (a) { return a.result === 'retry_exhausted'; }),
      'a DISTINCT exhaustion reason is recorded: ' + JSON.stringify(res.attempts));
    assert.equal(res.resume_stage, 'retrieval', 'resume at the failed stage boundary');
    assert.equal(res.budget.retries_used, d.RECOVERY_BUDGETS.MAX_RETRIES_PER_STAGE);
  });

  await recordAsync('D2b retry success on attempt 1 -> action retried, outcome recovered', async function () {
    const { ctx, calls } = makeCtx({
      retryFn: async function (env, _attempt) { return envOk(env.engine); },
    });
    const res = await d.dispatchRecovery({ envelopes: [envTimeout('tavily')], ctx: ctx });
    assert.equal(res.action, 'retried');
    assert.equal(res.outcome, 'recovered');
    assert.equal(res.attempts.length, 1, 'one attempt sufficed');
    assert.equal(res.attempts[0].attempt, 1);
    assert.equal(res.unresolved.length, 0);
    assert.equal(calls.substitute, 0, 'no substitute needed');
  });

  await recordAsync('D2c a failure on stage filing (a WRITE) is NEVER retried (D-03 structural)', async function () {
    const { ctx, calls } = makeCtx();
    const res = await d.dispatchRecovery({ envelopes: [envTimeout('writer', 'filing')], ctx: ctx });
    assert.equal(calls.retry, 0, 'retryFn is unreachable for non-idempotent stages; got ' + calls.retry + ' calls');
    assert.ok(res.unresolved.some(function (u) { return u.stage === 'filing'; }), 'the filing failure stays unresolved');
  });

  // =========================================================================
  // D3 -- Tier-2 governed substitution (exact provenance, D-03 / T-221-08)
  // =========================================================================

  await recordAsync('D3a retry-exhausted retrieval failure substitutes with EXACT room-corpus provenance', async function () {
    const { ctx } = makeCtx({
      substituteFn: async function (_env, _c) {
        return { results: [{ id: 'corpus-item-1' }], substitute: 'room-corpus' };
      },
    });
    const res = await d.dispatchRecovery({ envelopes: [envTimeout('tavily')], ctx: ctx });
    assert.equal(res.action, 'substituted');
    assert.equal(res.outcome, 'recovered');
    assert.equal(res.substitutions.length, 1);
    assert.equal(res.substitutions[0].substitute, 'room-corpus');
    assert.equal(res.substitutions[0].provenance, 'web: absent (room-corpus degrade)',
      'the EXACT 219 D-16 provenance vocabulary; got ' + res.substitutions[0].provenance);
  });

  await recordAsync('D3b a cache-sourced substitute is labeled research-cache, NEVER live', async function () {
    const { ctx } = makeCtx({
      substituteFn: async function (_env, _c) {
        return { results: [{ id: 'cached-item-1' }], substitute: 'research-cache' };
      },
    });
    const res = await d.dispatchRecovery({ envelopes: [envTimeout('tavily')], ctx: ctx });
    assert.equal(res.substitutions[0].provenance, 'research-cache');
    assert.ok(res.substitutions.every(function (s) { return !/live/i.test(s.provenance); }),
      'a substitute is never presented as live');
  });

  await recordAsync('D3c non-retryable retrieval failure (missing credential) goes straight to substitute: zero retries', async function () {
    const { ctx, calls } = makeCtx({
      substituteFn: async function (_env, _c) {
        calls.substitute += 1;
        return { results: [{ id: 'corpus-item-2' }], substitute: 'room-corpus' };
      },
    });
    const res = await d.dispatchRecovery({ envelopes: [envCred('tavily')], ctx: ctx });
    assert.equal(calls.retry, 0, 'non-retryable failures never reach retryFn');
    assert.equal(calls.substitute, 1, 'the substitute path fired');
    assert.equal(res.action, 'substituted');
  });

  // =========================================================================
  // D4 -- Tier-3 trigger discipline (shouldOfferTier3, pure)
  // =========================================================================

  record('D4a triggers: typed failure / contract_violation / implausible coverage / required-stage timeout', function () {
    const ctx = { origin: 'on_demand' };
    assert.equal(d.shouldOfferTier3([envTimeout('tavily')], ctx), true, 'typed failure triggers');
    assert.equal(d.shouldOfferTier3([envContract()], ctx), true, 'contract_violation triggers');
    // implausible coverage: 2+ failed providers, coverage ratio below the
    // declared threshold, no other trigger class present (blocked creds).
    assert.equal(d.shouldOfferTier3([envCred('a'), envCred('b')], ctx), true,
      'implausible coverage triggers (0 covered, 2 failed)');
    assert.equal(d.shouldOfferTier3([envCred('a'), envOk('b'), envOk('c'), envOk('d')], ctx), false,
      'plausible coverage with one blocked credential does NOT trigger');
    assert.equal(d.shouldOfferTier3([envTimeout('writer', 'filing')], ctx), true, 'required-stage timeout triggers');
  });

  record('D4b never-cases: empty_valid ALWAYS false; policy_blocked false; cadence/background false', function () {
    assert.equal(d.shouldOfferTier3([envEmpty('tavily')], { origin: 'on_demand' }), false, 'empty_valid NEVER triggers');
    assert.equal(d.shouldOfferTier3([envEmpty('a'), envEmpty('b')], { origin: 'on_demand' }), false);
    assert.equal(d.shouldOfferTier3([envPolicy('tavily')], { origin: 'on_demand' }), false, 'policy_blocked is un-reroutable');
    assert.equal(d.shouldOfferTier3([envTimeout('tavily')], { origin: 'cadence' }), false, 'cadence origin skips Tier-3 (Part 3)');
    assert.equal(d.shouldOfferTier3([envTimeout('tavily')], { origin: 'on_demand', background: true }), false, 'background skips Tier-3');
  });

  record('D4c purity: no ctx at all does not throw (pure predicate, no I/O)', function () {
    assert.equal(typeof d.shouldOfferTier3([envTimeout('x')]), 'boolean');
    assert.equal(typeof d.shouldOfferTier3([], {}), 'boolean');
    assert.equal(d.shouldOfferTier3([], {}), false, 'no envelopes -> no offer');
  });

  await recordAsync('D4d cadence dispatch with an unresolved typed failure terminates HONESTLY instead of offering Tier-3', async function () {
    const { ctx } = makeCtx({ origin: 'cadence' });
    const res = await d.dispatchRecovery({ envelopes: [envTimeout('tavily')], ctx: ctx });
    assert.equal(res.action, 'terminated', 'cadence never offers Tier-3');
    assert.ok(res.outcome === 'insufficient_evidence' || res.outcome === 'partial_recovery',
      'honest terminal outcome; got ' + res.outcome);
    assert.ok(res.unresolved.some(function (u) { return u.engine === 'tavily'; }), 'the gap is explicit');
  });

  await recordAsync('D4e a MALFORMED envelope is itself a contract_violation', async function () {
    const { ctx } = makeCtx();
    const res = await d.dispatchRecovery({ envelopes: [{ foo: 1 }], ctx: ctx });
    assert.ok(res.unresolved.some(function (u) { return u.failure_class === 'contract_violation'; }),
      'malformed input typed contract_violation: ' + JSON.stringify(res.unresolved));
    assert.equal(res.action, 'offer_tier3', 'contract violation is a Tier-3 trigger on demand');
  });

  await recordAsync('D4f on-demand unresolved typed failure (tiers 1-2 exhausted) -> action offer_tier3, controller NOT invoked', async function () {
    const { ctx, calls } = makeCtx(); // retry always fails, substitute unavailable
    const res = await d.dispatchRecovery({ envelopes: [envTimeout('tavily')], ctx: ctx });
    assert.equal(res.action, 'offer_tier3', 'Tier-3 is OFFERED only (the controller is Plan 03)');
    assert.equal(res.outcome, null, 'no outcome invented while the offer is pending');
    assert.equal(calls.retry, d.RECOVERY_BUDGETS.MAX_RETRIES_PER_STAGE, 'tiers 1-2 ran first');
  });

  // =========================================================================
  // D5 -- egress terminal (T-221-09)
  // =========================================================================

  await recordAsync('D5a ExternalEgressViolation thrown by the stage fn -> policy_blocked TERMINAL: no substitute, no offer', async function () {
    const { ctx, calls } = makeCtx({
      retryFn: async function () {
        calls.retry += 1;
        const e = new Error('room content in query');
        e.name = 'ExternalEgressViolation';
        throw e;
      },
    });
    const res = await d.dispatchRecovery({ envelopes: [envTimeout('tavily')], ctx: ctx });
    assert.equal(res.action, 'terminated');
    assert.equal(res.outcome, 'policy_blocked');
    assert.equal(calls.retry, 1, 'the throw stops everything: exactly one boundary catch, no more retries');
    assert.equal(calls.substitute, 0, 'never rerouted to a substitute');
    assert.ok(res.unresolved.some(function (u) { return u.failure_class === 'policy_blocked'; }),
      'typed blocked/policy_blocked at the boundary');
  });

  await recordAsync('D5b an input policy_blocked envelope is TERMINAL: no retry, no substitute, no rephrase', async function () {
    const { ctx, calls } = makeCtx();
    const res = await d.dispatchRecovery({ envelopes: [envPolicy('tavily')], ctx: ctx });
    assert.equal(res.action, 'terminated');
    assert.equal(res.outcome, 'policy_blocked');
    assert.equal(calls.retry, 0);
    assert.equal(calls.substitute, 0);
  });

  // =========================================================================
  // D6 -- budget exhaustion (T-221-11)
  // =========================================================================

  await recordAsync('D6 budgets exhausted with unresolved failures -> terminated + partial_recovery + explicit unresolved[]', async function () {
    const { ctx } = makeCtx({
      budgets: { MAX_RETRIES_PER_STAGE: 1, RETRY_BACKOFF_MS: [0], MAX_ALTERNATE_ENGINES: 1 },
      substituteFn: async function (_env, _c) { return { results: [], substitute: 'room-corpus' }; },
    });
    const res = await d.dispatchRecovery({
      envelopes: [envOk('brain-cypher'), envTimeout('tavily'), envTimeout('openalex')],
      ctx: ctx,
    });
    assert.equal(res.action, 'terminated');
    assert.equal(res.outcome, 'partial_recovery', 'budget exhaustion is partial_recovery, never a complete-looking report');
    assert.equal(res.budget.exhausted, true);
    assert.equal(res.unresolved.length, 2, 'every dead engine named');
    const engines = res.unresolved.map(function (u) { return u.engine; }).sort();
    assert.deepEqual(engines, ['openalex', 'tavily']);
  });

  // =========================================================================
  // D7 -- spend_limit_exceeded (D-11, T-221-12, self-validated 2026-07-13)
  // =========================================================================

  await recordAsync('D7a spend_limit_exceeded on an idempotent Tier-3-eligible stage: structural short-circuit to human_required', async function () {
    const { ctx, calls } = makeCtx();
    const res = await d.dispatchRecovery({ envelopes: [envSpend('anthropic', 'retrieval')], ctx: ctx });
    assert.equal(res.action, 'human_required');
    assert.equal(res.outcome, 'manual_intervention_required');
    assert.ok(typeof res.message === 'string' && res.message.indexOf('claude.ai/settings/usage') !== -1,
      'the message names the exact actionable step; got ' + res.message);
    assert.equal(calls.retry, 0, 'Tier-1 never fires (even though retrieval is idempotent)');
    assert.equal(calls.substitute, 0, 'Tier-2 never fires');
  });

  record('D7b shouldOfferTier3 returns false on spend_limit_exceeded (the FIFTH never-case) even on_demand with budget available', function () {
    assert.equal(d.shouldOfferTier3([envSpend()], { origin: 'on_demand' }), false,
      'the bootstrapping paradox: the recovery mechanism itself is exhausted');
    assert.equal(d.shouldOfferTier3([envSpend(), envTimeout('tavily')], { origin: 'on_demand' }), false,
      'a spend cap vetoes the whole offer, not just its own envelope');
  });

  await recordAsync('D7c TWO spend envelopes accumulate LITERALLY ZERO retry attempts (not just bounded)', async function () {
    const { ctx, calls } = makeCtx();
    const res = await d.dispatchRecovery({
      envelopes: [envSpend('anthropic', 'retrieval'), envSpend('anthropic-2', 'discovery')],
      ctx: ctx,
    });
    assert.equal(res.action, 'human_required');
    assert.equal(calls.retry, 0, 'zero, not bounded');
    assert.equal(calls.substitute, 0);
    assert.equal(res.attempts.length, 0);
  });

  await recordAsync('D7d mixed spend + timeout: the short-circuit runs BEFORE the tier partition (zero retries for the timeout too)', async function () {
    const { ctx, calls } = makeCtx();
    const res = await d.dispatchRecovery({ envelopes: [envSpend(), envTimeout('tavily')], ctx: ctx });
    assert.equal(res.action, 'human_required', 'structural early-return regardless of other failures');
    assert.equal(calls.retry, 0, 'the pre-tier-loop short-circuit skips the timeout retry as well');
  });

  // =========================================================================
  // Task 2 groups (M) -- the REQ-2 acceptance matrix rows: the dispatcher
  // wired into runSourceLens. Hermetic: stubbed per-provider envelope fns.
  // =========================================================================

  const driver = require(path.resolve(__dirname, '..', 'lib', 'lens-engine', 'source-lens-driver.cjs'));

  function mItem(id) {
    return {
      id: id, url: id, title: 'finding ' + id,
      abstract: 'premium pricing tier revenue', fetched_at: new Date().toISOString(),
    };
  }
  function mPreflight() {
    return {
      current_section: 'market-analysis',
      evidence_gaps: [{ summary: 'premium pricing tier revenue churn' }],
      prior_research: [],
    };
  }
  const M_LENSES = [{ lens: 'scholarly', weight: 1.0 }, { lens: 'industry', weight: 0.8 }];
  const instantSleep = async function () {};

  await recordAsync('M1 REQ-2 row 1: forced retrieval timeout routes to healthy provider + local corpus WITHOUT infinite retries; recovery provenance rides the result', async function () {
    const fetchCounts = { tavily: 0, openalex: 0 };
    const res = await driver.runSourceLens({
      roomDir: '',
      topic: 'premium pricing',
      lensSet: M_LENSES,
      preflight: mPreflight(),
      stage: 'explore',
      _sleep: instantSleep,
      _fetchCorpusEnvelope: async function (args) {
        fetchCounts[args.source] = (fetchCounts[args.source] || 0) + 1;
        if (args.source === 'tavily') {
          return se.makeStageEnvelope({
            stage: 'retrieval', engine: 'tavily', status: 'failed',
            failure_class: 'network_timeout', retryable: true, error: 'forced timeout',
          });
        }
        const it = mItem('https://oa/healthy');
        return se.makeStageEnvelope({
          stage: 'retrieval', engine: args.source, status: 'ok',
          payload: { results: [it] }, output: [it],
        });
      },
      _substituteFn: async function (_env, _c) {
        return { results: [mItem('https://corpus/sub-1')], substitute: 'room-corpus' };
      },
    });
    assert.equal(res.ok, true);
    // Bounded, never infinite: 1 first pass + MAX_RETRIES_PER_STAGE retries.
    assert.equal(fetchCounts.tavily, 1 + d.RECOVERY_BUDGETS.MAX_RETRIES_PER_STAGE,
      'attempt count bounded by MAX_RETRIES_PER_STAGE; got ' + fetchCounts.tavily);
    assert.ok(res.recovery, 'the dispatch result rides the run result');
    assert.equal(res.recovery.action, 'substituted');
    assert.equal(res.recovery.substitutions[0].provenance, 'web: absent (room-corpus degrade)');
    // The healthy provider still supplied its finding (reroute worked).
    assert.ok(res.findings.some(function (f) { return f.url === 'https://oa/healthy'; }),
      'healthy provider finding ranked');
    // The substitute rides with EXPLICIT provenance, never mislabeled live.
    const sub = res.findings.find(function (f) { return f.url === 'https://corpus/sub-1'; });
    assert.ok(sub, 'the substitute item is merged into the ranked set');
    assert.equal(sub.source, 'room-corpus');
    assert.equal(sub.provenance, 'web: absent (room-corpus degrade)');
  });

  await recordAsync('M2 REQ-2 row 2: a legitimate empty rotation stays empty_valid end to end, NO recovery invented', async function () {
    let substituteCalls = 0;
    const res = await driver.runSourceLens({
      roomDir: '',
      topic: 'premium pricing',
      lensSet: M_LENSES,
      preflight: mPreflight(),
      stage: 'explore',
      _sleep: instantSleep,
      _fetchCorpusEnvelope: async function (args) {
        return se.makeStageEnvelope({
          stage: 'retrieval', engine: args.source, status: 'empty_valid',
          payload: { results: [] }, output: [],
        });
      },
      _substituteFn: async function () {
        substituteCalls += 1;
        return { results: [mItem('https://corpus/never')], substitute: 'room-corpus' };
      },
    });
    assert.equal(res.ok, true);
    assert.equal(substituteCalls, 0, 'ZERO substitution on a legitimate empty (D-04)');
    assert.ok(!Object.prototype.hasOwnProperty.call(res, 'recovery'),
      'action none adds NOTHING to the result shape');
    assert.equal(res.findings.length, 0, 'the honest empty stays empty');
    assert.equal(res.research_mode, 'insufficient_evidence', 'the 219 typed mode is unchanged');
    assert.ok(res.stage_envelopes.every(function (e) { return e.status === 'empty_valid'; }));
  });

  await recordAsync('M3 REQ-2 row 3: multi-provider failure + exhausted budgets terminates partial_recovery naming each dead engine', async function () {
    const res = await driver.runSourceLens({
      roomDir: '',
      topic: 'premium pricing',
      lensSet: M_LENSES,
      preflight: mPreflight(),
      stage: 'explore',
      _sleep: instantSleep,
      _recoveryBudgets: { MAX_RETRIES_PER_STAGE: 1, RETRY_BACKOFF_MS: [0], MAX_ALTERNATE_ENGINES: 1 },
      _fetchCorpusEnvelope: async function (args) {
        return se.makeStageEnvelope({
          stage: 'retrieval', engine: args.source, status: 'failed',
          failure_class: 'network_timeout', retryable: true, error: 'forced outage',
        });
      },
      _substituteFn: async function () { return { results: [], substitute: 'room-corpus' }; },
    });
    assert.equal(res.ok, true);
    assert.ok(res.recovery, 'the terminal dispatch outcome rides the result additively');
    assert.equal(res.recovery.action, 'terminated');
    assert.equal(res.recovery.outcome, 'partial_recovery',
      'budget exhaustion is NEVER a complete-looking short report');
    assert.equal(res.recovery.budget.exhausted, true);
    const dead = res.recovery.unresolved.map(function (u) { return u.engine; }).sort();
    assert.deepEqual(dead, ['openalex', 'tavily'], 'every dead engine named');
    assert.equal(res.findings.length, 0, 'no invented findings');
  });

  await recordAsync('M4 no-failure byte-behavior: healthy run keeps the pre-221 result shape; dispatcher is a no-op pass-through', async function () {
    const res = await driver.runSourceLens({
      roomDir: '',
      topic: 'premium pricing',
      lensSet: M_LENSES,
      preflight: mPreflight(),
      stage: 'explore',
      _sleep: instantSleep,
      _fetchCorpusEnvelope: async function (args) {
        const it = mItem('https://ok/' + args.source);
        return se.makeStageEnvelope({
          stage: 'retrieval', engine: args.source, status: 'ok',
          payload: { results: [it] }, output: [it],
        });
      },
    });
    assert.equal(res.ok, true);
    assert.ok(!Object.prototype.hasOwnProperty.call(res, 'recovery'), 'no recovery key on action none');
    assert.deepEqual(Object.keys(res).sort(),
      ['findings', 'lens_set', 'ok', 'providers', 'research_mode', 'rotation_ok', 'stage_envelopes'],
      'the result shape is exactly the legacy fields + the 221 additive envelope collector');
    assert.equal(res.research_mode, 'normal');
    assert.ok(res.findings.every(function (f) { return !Object.prototype.hasOwnProperty.call(f, 'provenance'); }),
      'healthy findings carry no recovery provenance field (byte-behavior)');
  });

  await recordAsync('M5 origin threading: cadence terminates honestly; on_demand records offer_tier3 without invoking any controller', async function () {
    async function run(origin) {
      return driver.runSourceLens({
        roomDir: '',
        topic: 'premium pricing',
        lensSet: [{ lens: 'industry', weight: 1.0 }],
        preflight: mPreflight(),
        stage: 'explore',
        origin: origin,
        _sleep: instantSleep,
        _fetchCorpusEnvelope: async function (args) {
          return se.makeStageEnvelope({
            stage: 'retrieval', engine: args.source, status: 'failed',
            failure_class: 'network_timeout', retryable: true, error: 'down',
          });
        },
        _substituteFn: async function () { return null; },
      });
    }
    const cadence = await run('cadence');
    assert.ok(cadence.recovery, 'cadence failure carries the dispatch outcome');
    assert.equal(cadence.recovery.action, 'terminated', 'cadence NEVER offers Tier-3 (Part 3)');
    const onDemand = await run('on_demand');
    assert.equal(onDemand.recovery.action, 'offer_tier3',
      'the offer is RECORDED for the material-surface gate (D-07 lands in Plan 03); never invoked here');
    assert.equal(onDemand.recovery.outcome, null);
  });

  console.log('=== 221-02 dispatcher suite: ' + passed + ' passed, ' + failed + ' failed ===');
  if (failed > 0) process.exit(1);
})().catch(function (err) {
  console.error('suite crashed: ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
