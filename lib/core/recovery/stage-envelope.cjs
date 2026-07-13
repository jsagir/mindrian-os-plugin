/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 221 Plan 01 Task 1 -- stage-envelope.cjs
 *
 * The common typed stage-envelope contract (221-INPUT-MANUS-RECOVERY.md annex
 * section 2, the REQ-1 contract) + validator + the deterministic
 * failure-injection harness seam. First resident of lib/core/recovery/ (the
 * D-05 home; the Plan 02 dispatcher and Plan 03 controller join it later).
 *
 * WHY: several provider failures (missing key, timeout, parse, Brain) used to
 * collapse into identical empty arrays, so the orchestrator could not tell a
 * dead engine from a legitimate empty finding. Every stage result now carries
 * this envelope; empty_valid is a FINDING, never an error.
 *
 * D-11 (spend_limit_exceeded, self-validated 2026-07-13): an account-level
 * LLM spend cap is ARCHITECTURALLY DISTINCT from every other failure class.
 * The recovery mechanism itself (the LLM) is what is out of budget, so
 * retrying wastes an exhausted cap and offering Tier-3 LLM recovery is a
 * bootstrapping paradox. status is ALWAYS 'blocked'; retryable is ALWAYS
 * false STRUCTURALLY: makeStageEnvelope itself overrides the caller's input
 * for this one class (the validator ALSO enforces the pairing). Plan 02 owns
 * the routing rule (straight to Tier-4 human_required); this module owns the
 * class definition and the structural invariant.
 *
 * Injection harness (the vector-store.cjs MINDRIAN_FORCE_NO_VEC0 idiom,
 * verbatim): an opts._forceFailure seam PLUS a non-empty env var, latched
 * once per process, SILENT on the forced path (zero stderr). Deterministic
 * code owns machine-checkable invariants (SPEC constraint).
 *
 * Zero network reach, zero DB reach, zero deps: node:crypto only.
 * No em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */
'use strict';

const crypto = require('node:crypto');

// ---------- Frozen enums (annex 2 + the interfaces block of 221-01-PLAN) ----------

// The 13 annex-2 stage names.
const STAGES = Object.freeze([
  'retrieval',
  'discovery',
  'normalization',
  'segmentation',
  'extraction',
  'dedup',
  'ranking',
  'synthesis',
  'gate',
  'filing',
  'readback',
  'orchestration',
  'presentation',
]);

const STATUSES = Object.freeze([
  'ok',
  'empty_valid',
  'degraded',
  'failed',
  'blocked',
]);

// The 13 failure classes locked by Plan 221-01 (Claude's-discretion values,
// now frozen). spend_limit_exceeded is the D-11 addition.
const FAILURE_CLASSES = Object.freeze([
  'missing_credential',
  'network_timeout',
  'http_error',
  'parse_error',
  'engine_unavailable',
  'query_error',
  'policy_blocked',
  'contract_violation',
  'schema_invalid',
  'readback_mismatch',
  'size_exceeded',
  'unknown_error',
  'spend_limit_exceeded',
]);

// Per-class default descriptor bits, used by the injection harness's opts
// seam and available to adapters as the canonical status/retryable pairing.
// blocked = policy / credential / human-gate / authoritative-source /
// spend-limit (annex 2). Adapters may override status where a stage knows
// better (e.g. an academic delegate throw is failed/engine_unavailable);
// spend_limit_exceeded can never be overridden to retryable.
const CLASS_DEFAULTS = Object.freeze({
  missing_credential: Object.freeze({ status: 'blocked', retryable: false }),
  network_timeout: Object.freeze({ status: 'failed', retryable: true }),
  http_error: Object.freeze({ status: 'failed', retryable: true }),
  parse_error: Object.freeze({ status: 'failed', retryable: false }),
  engine_unavailable: Object.freeze({ status: 'blocked', retryable: false }),
  query_error: Object.freeze({ status: 'failed', retryable: false }),
  policy_blocked: Object.freeze({ status: 'blocked', retryable: false }),
  contract_violation: Object.freeze({ status: 'failed', retryable: false }),
  schema_invalid: Object.freeze({ status: 'failed', retryable: false }),
  readback_mismatch: Object.freeze({ status: 'failed', retryable: false }),
  size_exceeded: Object.freeze({ status: 'failed', retryable: false }),
  unknown_error: Object.freeze({ status: 'failed', retryable: false }),
  spend_limit_exceeded: Object.freeze({ status: 'blocked', retryable: false }),
});

// ---------- The injection env-var table (canonical names, Plan 04 matrix) ----------
//
// MINDRIAN_FORCE_<STAGE>_<CLASS-SHORTNAME>, mirroring the shipped
// MINDRIAN_FORCE_NO_VEC0 / MINDRIAN_FORCE_FTS_ABSENT / MINDRIAN_FORCE_ENGINE_ABSENT
// precedents. MINDRIAN_FORCE_ENGINE_ABSENT reuses the 219-05 name where the
// stage matches (never a second name for the same seam).
// PARSE_CORRUPT also fires on 'retrieval': a corrupt provider response body is
// the same corruption class as a corrupt normalization input, and the rule is
// one name per seam class, never two.
const FORCE_TABLE = Object.freeze({
  MINDRIAN_FORCE_RETRIEVAL_TIMEOUT: Object.freeze({
    stages: Object.freeze(['retrieval']),
    failure_class: 'network_timeout',
  }),
  MINDRIAN_FORCE_RETRIEVAL_HTTP: Object.freeze({
    stages: Object.freeze(['retrieval']),
    failure_class: 'http_error',
  }),
  MINDRIAN_FORCE_PARSE_CORRUPT: Object.freeze({
    stages: Object.freeze(['normalization', 'retrieval']),
    failure_class: 'parse_error',
  }),
  MINDRIAN_FORCE_READBACK_MISMATCH: Object.freeze({
    stages: Object.freeze(['readback']),
    failure_class: 'readback_mismatch',
  }),
  MINDRIAN_FORCE_EGRESS_BLOCK: Object.freeze({
    stages: Object.freeze(['gate']),
    failure_class: 'policy_blocked',
  }),
  MINDRIAN_FORCE_ENGINE_ABSENT: Object.freeze({
    stages: Object.freeze(['retrieval']),
    failure_class: 'engine_unavailable',
  }),
});

// ---------- Helpers ----------

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function sha256Hex(value) {
  const s = (typeof value === 'string') ? value : JSON.stringify(value);
  return crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
}

// ---------- makeStageEnvelope ----------
//
// Fills every annex-2 key with defaults, stamps ISO-8601 timestamps, computes
// sha256-hex fingerprints when fields.input / fields.output are provided
// (null otherwise), and STRUCTURALLY forces retryable:false whenever
// failure_class is 'spend_limit_exceeded' regardless of the caller's input
// (D-11: the one class where the constructor itself, not just the validator,
// enforces the never-retry invariant).

function makeStageEnvelope(fields) {
  const f = isPlainObject(fields) ? fields : {};
  const now = new Date().toISOString();

  const failureClass = (typeof f.failure_class === 'string' && f.failure_class.length > 0)
    ? f.failure_class
    : null;

  let retryable = f.retryable === true;
  if (failureClass === 'spend_limit_exceeded') {
    // D-11 structural invariant: never retryable, not situationally.
    retryable = false;
  }

  return {
    run_id: (typeof f.run_id === 'string' && f.run_id.length > 0) ? f.run_id : null,
    stage: (typeof f.stage === 'string') ? f.stage : null,
    engine: (typeof f.engine === 'string') ? f.engine : null,
    status: (typeof f.status === 'string') ? f.status : null,
    failure_class: failureClass,
    retryable: retryable,
    attempt: (Number.isInteger(f.attempt) && f.attempt >= 1) ? f.attempt : 1,
    input_fingerprint: (f.input !== undefined)
      ? sha256Hex(f.input)
      : ((typeof f.input_fingerprint === 'string') ? f.input_fingerprint : null),
    output_fingerprint: (f.output !== undefined)
      ? sha256Hex(f.output)
      : ((typeof f.output_fingerprint === 'string') ? f.output_fingerprint : null),
    started_at: (typeof f.started_at === 'string' && f.started_at.length > 0) ? f.started_at : now,
    completed_at: (typeof f.completed_at === 'string' && f.completed_at.length > 0) ? f.completed_at : now,
    provenance: Array.isArray(f.provenance) ? f.provenance.slice() : [],
    warnings: Array.isArray(f.warnings) ? f.warnings.slice() : [],
    payload: isPlainObject(f.payload) ? f.payload : {},
    error: (typeof f.error === 'string' && f.error.length > 0) ? f.error : null,
  };
}

// ---------- validateStageEnvelope ----------
//
// Deterministic machine-checkable invariants (SPEC constraint). Returns
// { ok, violations[] } naming every violation; never throws.
// Rules (the interfaces block):
//   - stage in STAGES; status in STATUSES; failure_class null or in enum
//   - status failed|blocked REQUIRES a non-null failure_class from the enum
//   - status ok|empty_valid REQUIRES failure_class null AND error null
//   - failure_class spend_limit_exceeded REQUIRES status 'blocked' AND
//     retryable false (the D-11 structural pairing)

function validateStageEnvelope(env) {
  const violations = [];
  if (!isPlainObject(env)) {
    return { ok: false, violations: ['envelope_not_an_object'] };
  }

  if (typeof env.stage !== 'string' || STAGES.indexOf(env.stage) === -1) {
    violations.push('unknown_stage:' + String(env.stage));
  }
  if (typeof env.status !== 'string' || STATUSES.indexOf(env.status) === -1) {
    violations.push('unknown_status:' + String(env.status));
  }
  if (env.failure_class !== null
    && (typeof env.failure_class !== 'string' || FAILURE_CLASSES.indexOf(env.failure_class) === -1)) {
    violations.push('unknown_failure_class:' + String(env.failure_class));
  }
  if (typeof env.retryable !== 'boolean') {
    violations.push('retryable_not_boolean');
  }
  if (!(Number.isInteger(env.attempt) && env.attempt >= 1)) {
    violations.push('attempt_not_positive_integer');
  }
  if (!Array.isArray(env.provenance)) violations.push('provenance_not_array');
  if (!Array.isArray(env.warnings)) violations.push('warnings_not_array');
  if (!isPlainObject(env.payload)) violations.push('payload_not_object');
  if (typeof env.started_at !== 'string' || env.started_at.length === 0) {
    violations.push('started_at_missing');
  }
  if (typeof env.completed_at !== 'string' || env.completed_at.length === 0) {
    violations.push('completed_at_missing');
  }

  const status = env.status;
  const fc = env.failure_class;

  if ((status === 'failed' || status === 'blocked')
    && !(typeof fc === 'string' && FAILURE_CLASSES.indexOf(fc) !== -1)) {
    violations.push('failure_class_required_for_' + status);
  }
  if ((status === 'ok' || status === 'empty_valid') && fc !== null) {
    violations.push('failure_class_must_be_null_for_' + status);
  }
  if ((status === 'ok' || status === 'empty_valid') && env.error !== null) {
    violations.push('error_must_be_null_for_' + status);
  }
  if (fc === 'spend_limit_exceeded') {
    // D-11: structurally blocked + never retryable (not situational).
    if (status !== 'blocked') violations.push('spend_limit_requires_status_blocked');
    if (env.retryable !== false) violations.push('spend_limit_requires_retryable_false');
  }

  return { ok: violations.length === 0, violations: violations };
}

// ---------- forcedFailure (the injection harness) ----------
//
// forcedFailure(stage, opts) -> descriptor | null
//   descriptor = { status, failure_class, retryable, error }
//
// The vector-store idiom verbatim: opts seam checked first, then a non-empty
// env var (typeof check + non-empty string); the verdict latches ONCE per
// process per stage in a module map, so it is deterministic on every later
// call even if the env changes afterwards. The forced path is SILENT: zero
// stderr (the real failure emits its one line at the adapter; the seam never
// does).

let _forcedLatch = Object.create(null); // stage -> descriptor

function descriptorFor(failureClass) {
  const d = CLASS_DEFAULTS[failureClass];
  return {
    status: d.status,
    failure_class: failureClass,
    retryable: d.retryable,
    error: 'forced_' + failureClass,
  };
}

function forcedFailure(stage, opts) {
  if (typeof stage !== 'string' || STAGES.indexOf(stage) === -1) return null;
  if (_forcedLatch[stage]) return _forcedLatch[stage];

  const o = isPlainObject(opts) ? opts : {};
  let hit = null;

  // (a) opts seam first (behaves identically without the env var).
  if (typeof o._forceFailure === 'string' && FAILURE_CLASSES.indexOf(o._forceFailure) !== -1) {
    hit = descriptorFor(o._forceFailure);
  } else {
    // (b) the env-var table, in declaration order, first non-empty wins.
    for (const name of Object.keys(FORCE_TABLE)) {
      const row = FORCE_TABLE[name];
      if (row.stages.indexOf(stage) === -1) continue;
      const v = process.env[name];
      if (typeof v === 'string' && v !== '') {
        hit = descriptorFor(row.failure_class);
        break;
      }
    }
  }

  if (hit) {
    _forcedLatch[stage] = hit; // latched once, silent.
  }
  return hit;
}

// Test-only latch reset (the _pipelineCache reset idiom). Never call from
// production code.
function resetForcedFailureLatch() {
  _forcedLatch = Object.create(null);
}

// ---------- Exports ----------

module.exports = {
  makeStageEnvelope,
  validateStageEnvelope,
  forcedFailure,
  STAGES,
  STATUSES,
  FAILURE_CLASSES,
  // Private helpers exposed for tests + adapter reuse (do NOT consume the
  // latch reset in production).
  _internal: {
    CLASS_DEFAULTS,
    FORCE_TABLE,
    sha256Hex,
    resetForcedFailureLatch,
  },
};
