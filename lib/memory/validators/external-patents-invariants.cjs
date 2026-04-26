/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 03 -- External patents fetcher invariants validator.
 *
 * Registry-compatible drop-in for the Phase 88-13 guardian. Auto-discovered
 * by scripts/feynman-minto-guardian.cjs's validator loader (walks
 * lib/memory/validators/*.cjs). Zero guardian.cjs edits needed.
 *
 * Mirrors external-academic-invariants.cjs structure byte-for-byte. The
 * scope is identical (telemetry lives at the GLOBAL per-user path
 * ~/.mindrian/telemetry/external-papers.json, NOT per-room) so this
 * validator declares scope='global'. The guardian still invokes it
 * once per pass; roomPath is ignored.
 *
 * Six checks (Checks A-F):
 *   A) Telemetry file absent -> {severity: null}    (healthy default)
 *   B) Per-source budget exceeded in rolling 24h    -> warning per source
 *      Scoped to patents sources: google_patents + uspto.
 *   C) status enum membership                       -> warning per entry
 *      Allowed statuses: ok | rate_limited | api_error | network_error |
 *      timeout | api_key_missing
 *   D) Canon Part 8 audit: query_text literal       -> CRITICAL canon_boundary
 *      The telemetry primitive guarantees query_text NEVER persists
 *      (only query_text_hash). If a literal query_text field ever
 *      appears, that is a Canon Part 8 breach by definition.
 *   E) query_text_hash format                        -> warning
 *      Must match /^[a-f0-9]{16}$/ (sha256 16-char hex prefix).
 *   F) fetched_at parseable as ISO-8601               -> warning
 *
 * Fail-open: unexpected throws are caught by the guardian's validator
 * runner. This validator does not swallow its own exceptions; the
 * guardian owns that contract. Individual I/O paths (readFileSync) are
 * wrapped defensively so a missing telemetry file never produces a
 * violation.
 *
 * Pure CJS, node built-ins only + the rs-egress-telemetry primitive
 * shipped in Plan 89.2-01 for TELEMETRY_FILE + DEFAULT_BUDGETS + WINDOW_MS.
 */
'use strict';

const fs = require('node:fs');

const {
  TELEMETRY_FILE,
  DEFAULT_BUDGETS,
  WINDOW_MS,
} = require('../../core/rs-egress-telemetry.cjs');

// ---------- Constants ----------

const SEVERITY_MAP = Object.freeze({ critical: 3, error: 2, warning: 1, info: 0 });

// Mirrors lib/core/rs-egress-telemetry.cjs ALLOWED_STATUSES set. Kept in
// sync by parity gate (any drift fails an invariant scenario downstream).
const ALLOWED_STATUSES = Object.freeze(new Set([
  'ok',
  'rate_limited',
  'api_error',
  'network_error',
  'timeout',
  'api_key_missing',
]));

// Patents-source allow-list for Check B. The validator scans the global
// ledger but only emits budget_exceeded warnings for sources owned by
// the patents fetcher. Other surfaces (academic, industry) carry their
// own validators; running every validator on every source would
// duplicate warnings.
const PATENTS_SOURCES = Object.freeze(new Set(['google_patents', 'uspto']));

// 16-char lowercase hex. sha256 prefix. Must match
// rs-egress-telemetry.cjs::hashQueryText output shape.
const CANON_PART_8_HASH_REGEX = /^[a-f0-9]{16}$/;

// Cap canon_boundary hits per validate() invocation so one poisoned
// ledger cannot spam the invariant report. Mirrors brain-substrate
// invariants and Plan 90-05 brain-md-invariants threshold.
const MAX_CANON_HITS_REPORTED = 5;

// Cap warning-class violations to bound report size on a fully-corrupt
// ledger. Critical hits are not capped (Check D never exceeds
// MAX_CANON_HITS_REPORTED on its own).
const MAX_WARNINGS_REPORTED = 25;

// ---------- Severity aggregator ----------

function aggregateSeverity(violations) {
  if (!violations || violations.length === 0) return null;
  let max = 0;
  const inv = { 0: 'info', 1: 'warning', 2: 'error', 3: 'critical' };
  for (const v of violations) {
    const s = SEVERITY_MAP[v.severity];
    if (typeof s === 'number' && s > max) max = s;
  }
  return inv[max];
}

// ---------- validate (Checks A-F) ----------
//
// scope='global'; roomPath is ignored (telemetry is per-user, not per-room).
// ctx is unused but accepted to match the validator contract.

function validate(_roomPath, _ctx) {
  const violations = [];

  // ---- Check A: telemetry file absent -> healthy default ----
  if (!fs.existsSync(TELEMETRY_FILE)) {
    return { severity: null, violations: [] };
  }

  // Read + parse defensively. A malformed ledger is a warning (not
  // critical) because the telemetry primitive treats malformed payloads
  // as cold-start; budgets just reset rather than crashing the fetcher.
  let payload = null;
  try {
    const raw = fs.readFileSync(TELEMETRY_FILE, 'utf8');
    payload = JSON.parse(raw);
  } catch (err) {
    violations.push({
      validator: 'external-patents-invariants',
      category: 'telemetry_unreadable',
      severity: 'warning',
      message: 'external-papers.json unreadable: ' + String(err && err.message),
      action_hint: 'invalidate_telemetry',
    });
    return { severity: aggregateSeverity(violations), violations };
  }

  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.entries)) {
    violations.push({
      validator: 'external-patents-invariants',
      category: 'telemetry_malformed_root',
      severity: 'warning',
      message: 'external-papers.json root is not a plain object with entries[]',
      action_hint: 'invalidate_telemetry',
    });
    return { severity: aggregateSeverity(violations), violations };
  }

  // ---- Check B: per-source budget exceeded in rolling 24h ----
  // Aggregate counts per source within the rolling window, then compare
  // against DEFAULT_BUDGETS. Only emit warnings for PATENTS_SOURCES so
  // the academic + industry fetchers' validators own their own surfaces.
  const now = Date.now();
  const sourceCounts = {};
  for (const entry of payload.entries) {
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.source !== 'string') continue;
    if (typeof entry.fetched_at !== 'string') continue;
    const t = Date.parse(entry.fetched_at);
    if (Number.isNaN(t)) continue;
    if ((now - t) > WINDOW_MS) continue;
    sourceCounts[entry.source] = (sourceCounts[entry.source] || 0) + 1;
  }
  for (const source of Object.keys(sourceCounts)) {
    if (!PATENTS_SOURCES.has(source)) continue;
    const cap = DEFAULT_BUDGETS[source];
    if (typeof cap === 'number' && sourceCounts[source] > cap) {
      violations.push({
        validator: 'external-patents-invariants',
        category: 'budget_exceeded',
        severity: 'warning',
        message: 'source ' + source + ' has ' + sourceCounts[source] +
                 ' calls in last 24h; budget cap ' + cap,
        field: 'entries[].source=' + source,
        action_hint: 'rotate_budget',
      });
    }
  }

  // ---- Checks C / D / E / F: per-entry scans ----
  let canonHitCount = 0;
  let warningCount = 0;
  for (let i = 0; i < payload.entries.length; i += 1) {
    const entry = payload.entries[i];
    if (!entry || typeof entry !== 'object') continue;

    // Per-entry checks scope to PATENTS_SOURCES so the academic +
    // industry validators own their own status / hash / fetched_at
    // entries on the shared ledger.
    if (typeof entry.source === 'string' && !PATENTS_SOURCES.has(entry.source)) {
      continue;
    }

    // ---- Check D: canon_boundary literal query_text presence ----
    // The telemetry primitive guarantees query_text NEVER persists. If
    // any entry carries the field at all, that is a Canon Part 8 breach.
    if (Object.prototype.hasOwnProperty.call(entry, 'query_text')
        && canonHitCount < MAX_CANON_HITS_REPORTED) {
      violations.push({
        validator: 'external-patents-invariants',
        category: 'canon_boundary',
        severity: 'critical',
        message: 'entries[' + i + '] carries literal query_text (Canon Part 8 breach)',
        field: 'entries[' + i + '].query_text',
        action_hint: 'purge_telemetry',
      });
      canonHitCount += 1;
    }

    // ---- Check C: status enum membership ----
    if (typeof entry.status === 'string' && !ALLOWED_STATUSES.has(entry.status)
        && warningCount < MAX_WARNINGS_REPORTED) {
      violations.push({
        validator: 'external-patents-invariants',
        category: 'status_enum_violation',
        severity: 'warning',
        message: 'entries[' + i + '].status is not in allowed set: ' +
                 String(entry.status).slice(0, 40),
        field: 'entries[' + i + '].status',
        action_hint: 'invalidate_telemetry',
      });
      warningCount += 1;
    }

    // ---- Check E: query_text_hash format ----
    if (typeof entry.query_text_hash === 'string'
        && !CANON_PART_8_HASH_REGEX.test(entry.query_text_hash)
        && warningCount < MAX_WARNINGS_REPORTED) {
      violations.push({
        validator: 'external-patents-invariants',
        category: 'hash_format_invalid',
        severity: 'warning',
        message: 'entries[' + i + '].query_text_hash fails /^[a-f0-9]{16}$/: ' +
                 String(entry.query_text_hash).slice(0, 40),
        field: 'entries[' + i + '].query_text_hash',
        action_hint: 'invalidate_telemetry',
      });
      warningCount += 1;
    }

    // ---- Check F: fetched_at parseable as ISO-8601 ----
    if (typeof entry.fetched_at === 'string'
        && Number.isNaN(Date.parse(entry.fetched_at))
        && warningCount < MAX_WARNINGS_REPORTED) {
      violations.push({
        validator: 'external-patents-invariants',
        category: 'fetched_at_malformed',
        severity: 'warning',
        message: 'entries[' + i + '].fetched_at not parseable as ISO-8601: ' +
                 String(entry.fetched_at).slice(0, 40),
        field: 'entries[' + i + '].fetched_at',
        action_hint: 'invalidate_telemetry',
      });
      warningCount += 1;
    }
  }

  return { severity: aggregateSeverity(violations), violations };
}

// ---------- Exports ----------

module.exports = {
  id: 'external-patents-invariants',
  severity_map: SEVERITY_MAP,
  scope: 'global',
  validate: validate,
  // Exported for downstream introspection + adversarial fixture suite.
  // Not required by the registry loader.
  ALLOWED_STATUSES: ALLOWED_STATUSES,
  PATENTS_SOURCES: PATENTS_SOURCES,
  CANON_PART_8_HASH_REGEX: CANON_PART_8_HASH_REGEX,
  MAX_CANON_HITS_REPORTED: MAX_CANON_HITS_REPORTED,
  MAX_WARNINGS_REPORTED: MAX_WARNINGS_REPORTED,
};
