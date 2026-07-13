/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 221 Plan 03 Task 1 -- case-file.cjs
 *
 * Atomic case-file persistence for the bounded LLM recovery controller
 * (REQ-3, D-05): every recovery run leaves a crash-safe, schema-valid,
 * ordered paper trail under <roomDir>/.mindrian/recovery/<run_id>/ on
 * LOCAL disk ONLY (Canon Part 8: run-ledger telemetry never egresses,
 * D-09). Persistence is filesystem-only: this module never touches the
 * network, never touches room.db, never requires a navigation writer.
 *
 * The seven artifacts (annex section 4, 221-INPUT-MANUS-RECOVERY.md) are a
 * FROZEN allowlist (CASE_ARTIFACTS); an unknown artifact name is refused.
 * Each artifact validates against a plain deterministic key/type schema
 * (deterministic code owns machine-checkable invariants - SPEC constraint;
 * no new deps). validateCaseFile additionally enforces the two
 * write-ordering invariants:
 *   - plan-before-execute: recovery-plan.json exists BEFORE any execute
 *     attempt appears in attempt-ledger.jsonl
 *   - claims-before-synthesis: recovery-bundle.json never exists without
 *     claim-evidence-ledger.json
 *
 * Atomic write idiom COPIED from lib/core/mva-state.cjs _atomicWrite
 * (lines 69-77; _atomicWrite is private there, so the 9-line tmp+rename
 * idiom is copied here with this citation rather than reaching into
 * another module's privates). A crashed writer can never leave a torn
 * artifact: the tmp file is written first, then renamed into place.
 *
 * Doctor rule (D-09): NO doctor check is added by this plan; if one is
 * ever added for case-file health it MUST be a registry module
 * (data/doctor-modules.json + lib/core/doctor/*-module.cjs) per the 217
 * rule, never an inline branch.
 *
 * No em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// ---------- The frozen artifact allowlist (annex 4) ----------

const CASE_ARTIFACTS = Object.freeze([
  'failure-diagnosis.json',
  'recovery-plan.json',
  'attempt-ledger.jsonl',
  'validation-report.json',
  'claim-evidence-ledger.json',
  'recovery-bundle.json',
  'recovery-notice.md',
]);

const CLAIM_STATES = Object.freeze(['supported', 'conflicting', 'unsupported', 'missing']);

// The eight validation-report check names (annex 4).
const REPORT_CHECKS = Object.freeze([
  'schema', 'provenance', 'locator', 'freshness',
  'dedup', 'privacy', 'policy', 'readback',
]);

// ---------- Helpers ----------

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// run_id sanitizer: filesystem-safe [a-z0-9-] ONLY. A hostile run_id
// ('../../etc') collapses to its safe characters; containment is ALSO
// asserted mechanically below (defense in depth, T-221-14 adjacent).
function sanitizeRunId(raw) {
  const s = String(raw || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-').replace(/^-|-$/g, '');
  return s.length > 0 ? s : 'run';
}

function mintRunId() {
  const day = new Date().toISOString().slice(0, 10);
  const rand = crypto.randomBytes(4).toString('hex');
  return sanitizeRunId(day + '-' + rand);
}

// Mechanical path containment: resolved must sit inside base (path.resolve
// on both sides; prefix check on the separator boundary).
function assertContained(base, candidate, label) {
  const b = path.resolve(base);
  const c = path.resolve(candidate);
  if (c !== b && c.indexOf(b + path.sep) !== 0) {
    throw new Error('path_escape:' + label + ':' + c);
  }
  return c;
}

// The mva-state.cjs _atomicWrite idiom (lines 69-77), copied with citation:
// tmp write + rename so a crashed writer cannot leave a torn file. The
// _faultFn seam is TEST-ONLY fault injection between write and rename; on a
// fault the tmp is unlinked best-effort so no residue survives.
function atomicWrite(target, body, faultFn) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = target + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 10);
  fs.writeFileSync(tmp, body, 'utf8');
  if (typeof faultFn === 'function') {
    try {
      faultFn();
    } catch (err) {
      try { fs.unlinkSync(tmp); } catch (_e) { /* best-effort cleanup */ }
      throw err;
    }
  }
  fs.renameSync(tmp, target);
}

// ---------- Per-artifact schema validators (plain deterministic checks) ----------

function violationsFor(name, body, push) {
  switch (name) {
    case 'failure-diagnosis.json': {
      if (!isPlainObject(body)) { push('not_an_object'); break; }
      if (!Array.isArray(body.envelopes)) push('envelopes_not_array');
      if (!Array.isArray(body.classified)) push('classified_not_array');
      else {
        for (const c of body.classified) {
          if (!isPlainObject(c) || typeof c.stage !== 'string'
            || typeof c.failure_class !== 'string') {
            push('classified_entry_invalid');
            break;
          }
        }
      }
      break;
    }
    case 'recovery-plan.json': {
      if (!isPlainObject(body)) { push('not_an_object'); break; }
      if (!Array.isArray(body.alternate_tools)) push('alternate_tools_not_array');
      if (!isPlainObject(body.budgets)) push('budgets_not_object');
      if (!isPlainObject(body.permissions)) push('permissions_not_object');
      if (!Array.isArray(body.stop_conditions)) push('stop_conditions_not_array');
      break;
    }
    case 'validation-report.json': {
      if (!isPlainObject(body) || !isPlainObject(body.checks)) { push('checks_not_object'); break; }
      for (const check of REPORT_CHECKS) {
        const c = body.checks[check];
        if (!isPlainObject(c) || typeof c.ok !== 'boolean') push('check_invalid:' + check);
      }
      break;
    }
    case 'claim-evidence-ledger.json': {
      if (!isPlainObject(body) || !Array.isArray(body.claims)) { push('claims_not_array'); break; }
      for (const c of body.claims) {
        if (!isPlainObject(c) || typeof c.claim !== 'string'
          || CLAIM_STATES.indexOf(c.state) === -1) {
          push('claim_entry_invalid');
          break;
        }
      }
      break;
    }
    case 'recovery-bundle.json': {
      if (!isPlainObject(body)) { push('not_an_object'); break; }
      if (typeof body.resume_stage !== 'string' || body.resume_stage.length === 0) {
        push('resume_stage_missing');
      }
      if (!Array.isArray(body.recovered_payloads)) push('recovered_payloads_not_array');
      if (!Array.isArray(body.claims)) push('claims_not_array');
      break;
    }
    case 'recovery-notice.md': {
      if (typeof body !== 'string' || body.trim().length === 0) push('notice_not_a_string');
      break;
    }
    case 'attempt-ledger.jsonl': {
      // The ledger is append-only jsonl; each LINE is validated at append
      // time (plain object). Whole-file validation happens in
      // validateCaseFile by parsing every line.
      break;
    }
    default:
      push('unknown_artifact:' + name);
  }
}

function validateArtifact(name, body) {
  const violations = [];
  violationsFor(name, body, function (v) { violations.push(name + ':' + v); });
  return { ok: violations.length === 0, violations: violations };
}

// ---------- openCaseFile ----------
//
// openCaseFile(roomDir, opts) -> handle { dir, run_id, roomDir }
//   opts.run_id: caller-supplied id (sanitized; collision-suffixed)
//   opts.resume: true reuses an EXISTING dir for the given run_id verbatim
//     (the annex-7 "case file retained for resume" rule)

function openCaseFile(roomDir, opts) {
  if (typeof roomDir !== 'string' || roomDir.length === 0) {
    throw new TypeError('openCaseFile: roomDir required');
  }
  const o = isPlainObject(opts) ? opts : {};
  const base = path.resolve(roomDir, '.mindrian', 'recovery');
  let runId = (typeof o.run_id === 'string' && o.run_id.length > 0)
    ? sanitizeRunId(o.run_id)
    : mintRunId();

  if (o.resume === true) {
    const dir = assertContained(base, path.join(base, runId), 'case_dir');
    if (!fs.existsSync(dir)) throw new Error('resume_case_missing:' + runId);
    return { dir: dir, run_id: runId, roomDir: roomDir };
  }

  // Collision-suffix rule: never reuse a live dir on a fresh open.
  let dir = assertContained(base, path.join(base, runId), 'case_dir');
  let suffix = 1;
  while (fs.existsSync(dir)) {
    suffix += 1;
    const candidate = runId + '-' + suffix;
    dir = assertContained(base, path.join(base, candidate), 'case_dir');
    if (suffix > 1000) throw new Error('run_id_collision_exhausted:' + runId);
  }
  runId = path.basename(dir);
  fs.mkdirSync(dir, { recursive: true });
  return { dir: dir, run_id: runId, roomDir: roomDir };
}

// ---------- writeArtifact ----------
//
// writeArtifact(handle, name, body, opts) -> { ok:true, path }
// Refuses unknown names (frozen allowlist), schema-invalid bodies
// (deterministic validators), and any path escaping the case dir.
// opts._faultFn: TEST-ONLY fault injection inside the atomic write.

function writeArtifact(handle, name, body, opts) {
  if (!isPlainObject(handle) || typeof handle.dir !== 'string') {
    throw new TypeError('writeArtifact: invalid handle');
  }
  if (CASE_ARTIFACTS.indexOf(name) === -1) {
    throw new Error('unknown_artifact:' + String(name));
  }
  if (name === 'attempt-ledger.jsonl') {
    throw new Error('unknown_artifact:attempt-ledger.jsonl_is_append_only_use_appendLedger');
  }
  const check = validateArtifact(name, body);
  if (!check.ok) {
    throw new Error('schema_invalid:' + check.violations.join(','));
  }
  const target = assertContained(handle.dir, path.join(handle.dir, name), name);
  const serialized = (name === 'recovery-notice.md')
    ? String(body)
    : JSON.stringify(body, null, 2) + '\n';
  const o = isPlainObject(opts) ? opts : {};
  atomicWrite(target, serialized, o._faultFn);
  return { ok: true, path: target };
}

// ---------- appendLedger ----------
//
// appendLedger(handle, entry) -> { ok:true }
// Exactly one JSON line per call; ts stamped; model/version pass through
// when provided (capability-based model selection RECORDED, D-06).

function appendLedger(handle, entry) {
  if (!isPlainObject(handle) || typeof handle.dir !== 'string') {
    throw new TypeError('appendLedger: invalid handle');
  }
  if (!isPlainObject(entry)) {
    throw new TypeError('appendLedger: entry must be a plain object');
  }
  const target = assertContained(handle.dir, path.join(handle.dir, 'attempt-ledger.jsonl'), 'attempt-ledger.jsonl');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const line = Object.assign({ ts: new Date().toISOString() }, entry);
  fs.appendFileSync(target, JSON.stringify(line) + '\n', 'utf8');
  return { ok: true };
}

// ---------- validateCaseFile ----------
//
// validateCaseFile(handle) -> { ok, violations }
// Composes the per-artifact schema checks over every artifact present on
// disk PLUS the two write-ordering invariants:
//   plan_before_execute: an execute attempt in the ledger requires
//     recovery-plan.json to exist
//   claims_before_synthesis: recovery-bundle.json requires
//     claim-evidence-ledger.json to exist

function validateCaseFile(handle) {
  if (!isPlainObject(handle) || typeof handle.dir !== 'string') {
    return { ok: false, violations: ['invalid_handle'] };
  }
  const dir = handle.dir;
  const violations = [];

  const present = {};
  for (const name of CASE_ARTIFACTS) {
    present[name] = fs.existsSync(path.join(dir, name));
  }

  // Per-artifact schema checks on everything present.
  for (const name of CASE_ARTIFACTS) {
    if (!present[name] || name === 'attempt-ledger.jsonl') continue;
    let body;
    try {
      const raw = fs.readFileSync(path.join(dir, name), 'utf8');
      body = (name === 'recovery-notice.md') ? raw : JSON.parse(raw);
    } catch (err) {
      violations.push(name + ':unreadable:' + String(err.message).slice(0, 60));
      continue;
    }
    const check = validateArtifact(name, body);
    for (const v of check.violations) violations.push(v);
  }

  // Ledger lines: each must parse to a plain object.
  let ledger = [];
  if (present['attempt-ledger.jsonl']) {
    const raw = fs.readFileSync(path.join(dir, 'attempt-ledger.jsonl'), 'utf8');
    const lines = raw.split('\n').filter(function (l) { return l.length > 0; });
    for (const l of lines) {
      try {
        const parsed = JSON.parse(l);
        if (!isPlainObject(parsed)) throw new Error('not an object');
        ledger.push(parsed);
      } catch (_e) {
        violations.push('attempt-ledger.jsonl:malformed_line');
      }
    }
  }

  // Ordering invariant 1: plan-before-execute.
  const hasExecuteAttempt = ledger.some(function (l) { return l.step === 'execute'; });
  if (hasExecuteAttempt && !present['recovery-plan.json']) {
    violations.push('plan_before_execute:execute_attempt_without_recovery-plan.json');
  }

  // Ordering invariant 2: claims-before-synthesis.
  if (present['recovery-bundle.json'] && !present['claim-evidence-ledger.json']) {
    violations.push('claims_before_synthesis:recovery-bundle.json_without_claim-evidence-ledger.json');
  }

  return { ok: violations.length === 0, violations: violations };
}

// ---------- Exports ----------

module.exports = {
  openCaseFile,
  writeArtifact,
  appendLedger,
  validateCaseFile,
  CASE_ARTIFACTS,
  // Private surface for tests + the Plan 03 controller.
  _internal: {
    CLAIM_STATES,
    REPORT_CHECKS,
    validateArtifact,
    sanitizeRunId,
  },
};
