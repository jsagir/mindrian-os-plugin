'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 13 (369.2-R05, 369.2-R06) -- the research operation ledger.
 *
 * HARNESS-02 of the engineering brief ("Required execution-state contract", seven invariants),
 * RESEARCH Section 2 (shape, terminal states and their proofs), annex C17 (counterevidence counting).
 *
 * The job: every research operation a run promises is proven executed, explicitly refused, or
 * explicitly marked not executed. A missing operation can never read as an empty result, and "complete"
 * is computed here and nowhere else.
 *
 *   1  stable id          operationId(run_id, plan_dimension, kind, template_id, round, ordinal)
 *   2  one terminal state executed_with_results | executed_empty | refused_before_fetch | not_executed;
 *                         a terminal op refuses every further transition; sweep() closes the rest
 *   3  proof of empty     executed_empty needs a counted zero from a completed provider call; a failed or
 *                         blocked call is not_executed with attempted true and provider_failed:<class>
 *   4  travel             refused and not-executed ops appear in completion().incomplete with label and reason
 *   5  counterevidence    counterevidenceStatus counts falsifier ops across ALL rounds (annex C17)
 *   6  fallback           recordFallback refuses unless original, fallback, reason and authorization are present
 *   7  complete           completion() is the only source of "complete"
 *
 * Storage: a JSON file beside the run, <room>/.mindrian/research-runs/<run_id>/operations.json, written
 * atomically (temp file plus rename, the atomicWriteJson shape of deep.cjs). Never DDL in the room database
 * (navigation/CONTEXT.md: zero DDL beyond the two chokepoints; scaffolded rooms can lack a database).
 *
 * Pure: node:crypto, node:fs, node:path only. Mutating functions change the ledger object in place and
 * return {ok, ...}; a refused transition changes nothing. The caller persists with writeLedger.
 * Plan 14 wires this into quick and deep.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const OPS_SCHEMA = 'mos.research-operations/1';

const STATES = Object.freeze(['planned', 'composed', 'dispatched', 'executed_with_results', 'executed_empty', 'refused_before_fetch', 'not_executed']);
const TERMINAL_STATES = Object.freeze(['executed_with_results', 'executed_empty', 'refused_before_fetch', 'not_executed']);
const KINDS = Object.freeze(['direct', 'practice', 'mechanism', 'adjacent', 'falsifier', 'baseline', 'theo']);

// Exact strings, frozen. Prefix families follow below (the part after the colon is a free class or name).
const REASONS = Object.freeze([
  'quick_cap', 'search_cap', 'lane_cap', 'ce_reserve_exhausted', 'time', 'budget_usd', 'offline', 'theo_line_off',
  'run_aborted', 'stopped_by_navigator', 'no_query_composed', 'hash_not_approved', 'term_not_composed', 'grant_expired', 'unknown_lens',
]);
const REASON_PREFIXES = Object.freeze(['provider_failed:', 'provider_unavailable:', 'bad_slot:', 'unused_slot:']);

// families.cjs falsifier roles: ce.counter, cl.break, ci.retest by template; ws.synonym_cover and
// ws.prior_attempts carry roles falsifier_covered_elsewhere and falsifier_tried_before.
const FALSIFIER_TEMPLATES = Object.freeze(['ce.counter', 'cl.break', 'ci.retest', 'ws.synonym_cover', 'ws.prior_attempts']);

const FALLBACK_FIELDS = Object.freeze(['original_provider', 'fallback_provider', 'reason', 'authorized_by']);

function refuse(reason, extra) { return Object.assign({ ok: false, reason: reason }, extra || {}); }
function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
function nonEmptyString(x) { return typeof x === 'string' && x.length > 0; }
function isCount(x) { return typeof x === 'number' && Number.isInteger(x) && x >= 0; }
function nowIso() { return new Date().toISOString(); }
function stateRank(s) { return STATES.indexOf(s); }
function isTerminal(state) { return TERMINAL_STATES.indexOf(state) !== -1; }
function isExecuted(state) { return state === 'executed_with_results' || state === 'executed_empty'; }
function isMiss(state) { return state === 'refused_before_fetch' || state === 'not_executed'; }

function reasonOk(r) {
  if (typeof r !== 'string') return false;
  if (REASONS.indexOf(r) !== -1) return true;
  return REASON_PREFIXES.some(function (p) { return r.indexOf(p) === 0 && r.length > p.length; });
}
function isProviderFailure(r) { return typeof r === 'string' && r.indexOf('provider_failed:') === 0; }

// ---- ids ------------------------------------------------------------------------------

function operationId(runId, planDimension, kind, templateId, round, ordinal) {
  const parts = [runId, planDimension, kind, templateId, round, ordinal].map(function (x) { return x === null || x === undefined ? '' : String(x); });
  return 'op-' + crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
}

// ---- ledger ---------------------------------------------------------------------------

function createLedger(runId, planHash, nowStamp) {
  const t = nowStamp || nowIso();
  return { schema: OPS_SCHEMA, run_id: runId, plan_hash: planHash === undefined ? null : planHash, created_at: t, updated_at: t, operations: [] };
}

function find(ledger, id) {
  const list = ledger && Array.isArray(ledger.operations) ? ledger.operations : [];
  for (let i = 0; i < list.length; i += 1) if (list[i].operation_id === id) return list[i];
  return null;
}

function touch(ledger, stamp) { ledger.updated_at = stamp || nowIso(); }

// Mint a planned op; the same six inputs return the op already in the ledger, never a duplicate.
// Programmer errors (no dimension, unknown kind) throw: a ledger that quietly drops a promise defeats it.
function mint(ledger, fields) {
  const f = fields || {};
  if (!nonEmptyString(f.plan_dimension)) throw new TypeError('mint: plan_dimension is required');
  if (KINDS.indexOf(f.kind) === -1) throw new TypeError('mint: kind must be one of ' + KINDS.join(', ') + ' (got ' + String(f.kind) + ')');
  const round = f.round === undefined || f.round === null ? 1 : f.round;
  const ordinal = f.ordinal === undefined || f.ordinal === null ? 0 : f.ordinal;
  const templateId = f.template_id === undefined ? null : f.template_id;
  const id = operationId(ledger.run_id, f.plan_dimension, f.kind, templateId, round, ordinal);
  const existing = find(ledger, id);
  if (existing) return existing;
  const op = {
    operation_id: id,
    plan_dimension: f.plan_dimension,
    dimension_label: f.dimension_label === undefined ? null : f.dimension_label,
    mandatory: f.mandatory !== false,
    kind: f.kind,
    template_id: templateId,
    round: round,
    ordinal: ordinal,
    query_id: f.query_id === undefined ? null : f.query_id,
    q: f.q === undefined ? null : f.q,
    provider: f.provider === undefined ? null : f.provider,
    fallback: null,
    state: 'planned',
    reason: null,
    result_count: null,
    cache_hit: false,
    attempted: false,
    started_at: null,
    finished_at: null,
    audit_ref: null,
  };
  if (nonEmptyString(f.role)) op.role = f.role;
  ledger.operations.push(op);
  touch(ledger);
  return op;
}

// The count a terminal proof stands on: a proof object, an explicit count, or a result_count.
function countOf(f) {
  if (isObj(f.proof) && isCount(f.proof.count)) return f.proof.count;
  if (isCount(f.count)) return f.count;
  if (isCount(f.result_count)) return f.result_count;
  return null;
}

function transition(ledger, id, toState, fields) {
  const f = fields || {};
  const op = find(ledger, id);
  if (!op) return refuse('unknown_operation', { operation_id: id });
  const toRank = stateRank(toState);
  if (toRank === -1) return refuse('illegal_transition', { from: op.state, to: toState });
  if (isTerminal(op.state) || toRank <= stateRank(op.state)) return refuse('illegal_transition', { from: op.state, to: toState });

  let reason = null;
  let count = null;
  let attempted = op.attempted === true || f.attempted === true;

  if (toState === 'executed_with_results') {
    count = countOf(f);
    if (count === null || count < 1) return refuse('proof_missing', { to: toState, need: 'a numeric result count above 0' });
    if (f.reason !== undefined && f.reason !== null && f.reason !== '') return refuse('unknown_reason', { to: toState });
    attempted = true;
  } else if (toState === 'executed_empty') {
    count = countOf(f);
    if (count !== 0) return refuse('proof_missing', { to: toState, need: 'a completed provider call with a numeric count of 0' });
    if (isProviderFailure(f.reason) || f.failed === true) return refuse('proof_missing', { to: toState, need: 'a failed call is not_executed, never empty' });
    attempted = true;
  } else if (toState === 'refused_before_fetch') {
    if (!reasonOk(f.reason)) return refuse('unknown_reason', { to: toState, reason_given: f.reason === undefined ? null : f.reason });
    if (isProviderFailure(f.reason)) return refuse('proof_missing', { to: toState, need: 'a refusal before fetch carries no provider failure' });
    reason = f.reason;
    attempted = false;
  } else if (toState === 'not_executed') {
    if (!reasonOk(f.reason)) return refuse('unknown_reason', { to: toState, reason_given: f.reason === undefined ? null : f.reason });
    reason = f.reason;
    if (isProviderFailure(reason)) attempted = true;
  }

  // every check passed: now mutate
  const stamp = nowIso();
  op.state = toState;
  op.reason = reason;
  op.attempted = attempted;
  if (count !== null) op.result_count = count;
  if (nonEmptyString(f.q)) op.q = f.q;
  if (nonEmptyString(f.query_id)) op.query_id = f.query_id;
  if (nonEmptyString(f.provider)) op.provider = f.provider;
  if (typeof f.cache_hit === 'boolean') op.cache_hit = f.cache_hit;
  if (f.audit_ref !== undefined && f.audit_ref !== null) op.audit_ref = f.audit_ref;
  if (nonEmptyString(f.started_at)) op.started_at = f.started_at;
  else if (!op.started_at && (toState === 'dispatched' || isTerminal(toState))) op.started_at = stamp;
  if (isTerminal(toState)) op.finished_at = nonEmptyString(f.finished_at) ? f.finished_at : stamp;
  touch(ledger, stamp);
  return { ok: true, op: op };
}

function recordFallback(ledger, id, fb) {
  const op = find(ledger, id);
  if (!op) return refuse('unknown_operation', { operation_id: id });
  const f = fb || {};
  const missing = FALLBACK_FIELDS.filter(function (k) { return !nonEmptyString(f[k]); });
  if (missing.length) return refuse('fallback_incomplete', { missing: missing });
  op.fallback = {
    original_provider: f.original_provider, fallback_provider: f.fallback_provider, reason: f.reason, authorized_by: f.authorized_by,
  };
  touch(ledger);
  return { ok: true, op: op };
}

// End of run: every non-terminal op becomes not_executed with the stop reason. A dispatched op may have
// reached the provider, so it reads attempted true.
function sweep(ledger, reason) {
  if (!reasonOk(reason)) return refuse('unknown_reason', { reason_given: reason === undefined ? null : reason });
  const swept = [];
  const stamp = nowIso();
  ledger.operations.forEach(function (op) {
    if (isTerminal(op.state)) return;
    if (op.state === 'dispatched') op.attempted = true;
    op.state = 'not_executed';
    op.reason = reason;
    if (isProviderFailure(reason)) op.attempted = true;
    op.finished_at = stamp;
    swept.push(op.operation_id);
  });
  if (swept.length) touch(ledger, stamp);
  return { ok: true, swept: swept };
}

// ---- counterevidence and completion -----------------------------------------------------

function isFalsifier(op) {
  if (!isObj(op)) return false;
  // 369.2-24: a field-scan search (kind baseline) never counts as the falsification pass, whatever its template
  if (op.kind === 'baseline') return false;
  if (op.kind === 'falsifier') return true;
  if (FALSIFIER_TEMPLATES.indexOf(op.template_id) !== -1) return true;
  return typeof op.role === 'string' && op.role.indexOf('falsifier') === 0;
}

// Annex C17: count every executed falsifier op across ALL rounds. A falsifier that ran in round one is
// performed even when the extra pass added no searches. Status:
//   not_needed   needed is false
//   not_run      needed, and no falsifier op executed (none planned, or none got to run)
//   partial      some executed, some did not (failed, refused, or still open)
//   complete     every falsifier op executed (a counted empty result is still a search that ran)
function counterevidenceStatus(ledger, opts) {
  const needed = !(isObj(opts) && opts.needed === false);
  const list = (ledger && Array.isArray(ledger.operations) ? ledger.operations : []).filter(isFalsifier);
  const executed = list.filter(function (o) { return isExecuted(o.state); }).length;
  const failedOps = list.filter(function (o) { return isMiss(o.state); });
  const reasons = [];
  failedOps.forEach(function (o) { if (o.reason && reasons.indexOf(o.reason) === -1) reasons.push(o.reason); });
  let status;
  if (!needed) status = 'not_needed';
  else if (list.length === 0 || executed === 0) status = 'not_run';
  else if (executed === list.length) status = 'complete';
  else status = 'partial';
  return { status: status, planned: list.length, executed: executed, failed: failedOps.length, reasons: reasons };
}

// The only source of "complete". Fails closed: counterevidence is needed unless the caller says it is not,
// and a ledger with no mandatory operation is never complete (nothing was promised, nothing was proven).
function completion(ledger, opts) {
  const needed = !(isObj(opts) && opts.counterevidence_needed === false);
  const list = ledger && Array.isArray(ledger.operations) ? ledger.operations : [];
  const by_state = { executed_with_results: 0, executed_empty: 0, refused_before_fetch: 0, not_executed: 0 };
  const incomplete = [];
  const open = [];
  list.forEach(function (o) {
    if (isTerminal(o.state)) by_state[o.state] += 1;
    else open.push({ operation_id: o.operation_id, plan_dimension: o.plan_dimension, dimension_label: o.dimension_label, state: o.state });
    if (isMiss(o.state)) {
      incomplete.push({
        operation_id: o.operation_id, plan_dimension: o.plan_dimension, dimension_label: o.dimension_label,
        state: o.state, reason: o.reason, mandatory: o.mandatory === true,
      });
    }
  });
  const mandatory = list.filter(function (o) { return o.mandatory === true; });
  const mandatoryProven = mandatory.length > 0 && mandatory.every(function (o) { return isExecuted(o.state); });
  const counterevidence = counterevidenceStatus(ledger, { needed: needed });
  const ceOk = counterevidence.status === 'complete' || counterevidence.status === 'not_needed';
  return { complete: mandatoryProven && ceOk, by_state: by_state, incomplete: incomplete, open: open, counterevidence: counterevidence };
}

// ---- file -----------------------------------------------------------------------------

function safeSegment(s) { return String(s).replace(/[^A-Za-z0-9._-]/g, '-').replace(/^\.+/, '-'); }

function ledgerPath(roomDir, runId) {
  return path.join(roomDir, '.mindrian', 'research-runs', safeSegment(runId), 'operations.json');
}

// null when the file is absent; a torn or foreign file throws ledger_corrupt (a silent empty ledger
// would let a run restart as if nothing had been promised).
function readLedger(roomDir, runId) {
  const file = ledgerPath(roomDir, runId);
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (e) {
    if (e && e.code === 'ENOENT') return null;
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { throw new Error('ledger_corrupt: ' + file + ' is not valid JSON'); }
  if (!isObj(parsed) || parsed.schema !== OPS_SCHEMA || !Array.isArray(parsed.operations)) {
    throw new Error('ledger_corrupt: ' + file + ' is not a ' + OPS_SCHEMA + ' ledger');
  }
  return parsed;
}

function writeLedger(roomDir, ledger) {
  const file = ledgerPath(roomDir, ledger.run_id);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp-' + process.pid + '-' + crypto.randomBytes(3).toString('hex');
  fs.writeFileSync(tmp, JSON.stringify(ledger, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
  return file;
}

module.exports = {
  OPS_SCHEMA, STATES, TERMINAL_STATES, REASONS, FALSIFIER_TEMPLATES,
  operationId, createLedger, mint, transition, recordFallback, sweep, completion, counterevidenceStatus,
  ledgerPath, readLedger, writeLedger, isFalsifier,
};
