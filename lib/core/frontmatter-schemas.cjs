/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.1-07 -- per-section frontmatter schema validator (pure).
 * ==================================================================
 * Single source of truth for the NON-MINTO frontmatter contract. MINTO.md
 * validation is delegated to lib/core/feynman-minto-invariants.cjs (Phase
 * 88-00-B), which owns the Feynman-MINTO memory-triple invariants. This
 * module handles:
 *
 *   ROOM.md          required: name, type. optional: references.
 *   STATE.md         required: artifact_count. optional: completeness_score,
 *                    last_activity_at.
 *   every other .md  required: title, source, status. optional:
 *   (artifact-       governing_thought, confidence, evidence_tier.
 *    default)
 *
 * Contract:
 *
 *   validate(filePath, frontmatter) -> { valid, violations[], severity }
 *
 * where frontmatter is:
 *   - an object (parsed YAML frontmatter), OR
 *   - null, signaling a parser failure upstream (hook saw malformed YAML
 *     and wants the aggregator to record a critical malformed violation).
 *
 * Each violation has shape:
 *   { field, type: 'missing' | 'malformed' | 'unknown', severity }
 *
 * Aggregate severity is the max across violations; null-safe per-tier ordering
 * is (critical > error > warning > info). A result with zero violations is
 * valid:true with severity 'info' for artifact/ROOM/STATE schemas. MINTO.md
 * returns whatever the invariants validator returns (its shape already
 * matches: { valid, violations, severity }).
 *
 * Purity invariants (enforced by frontmatter-schema-validator.test.cjs):
 *   - No fs I/O. Accepts pre-loaded frontmatter object.
 *   - BSL 1.1 header in first 20 lines.
 *   - Zero em-dashes or en-dashes (project hard rule).
 *   - CJS only (no import / export default).
 *
 * Consumed by scripts/frontmatter-schema-validator.cjs (the PostToolUse hook
 * that handles fs I/O, stdin envelope parsing, .room-root scope walk, and
 * the violation JSONL offense log). The split keeps the validator core
 * testable without any filesystem fixture.
 *
 * Canon obligations:
 *   Part 5 -- schemas formalize claim-level evidence-tier properties so
 *             Part 5 enforcement has something to measure against.
 *   Part 6 -- dog-fooding: plugin validates its own artifact frontmatter
 *             through its own mechanism (the hook).
 *   Part 8 -- validator is LOCAL-only by construction (pure function, no
 *             fs, no network).
 */

'use strict';

// Path module only for basename detection. No fs. No network.
const path = require('node:path');

// MINTO delegation target. Required at module load (not at call time) so
// the static wiring can be grep-asserted by the test harness.
const mintoInvariants = require('./feynman-minto-invariants.cjs');

// ---------- Severity ordering ----------

const SEVERITY_ORDER = ['info', 'warning', 'error', 'critical'];

function compareSeverity(a, b) {
  // Returns positive if a > b in severity.
  return SEVERITY_ORDER.indexOf(a) - SEVERITY_ORDER.indexOf(b);
}

function aggregateSeverity(violations) {
  if (!Array.isArray(violations) || violations.length === 0) return 'info';
  let worst = 'info';
  for (const v of violations) {
    if (compareSeverity(v.severity, worst) > 0) worst = v.severity;
  }
  return worst;
}

// ---------- Schemas (per-section definitions) ----------

const SCHEMAS = Object.freeze({
  'artifact-default': Object.freeze({
    required: Object.freeze(['title', 'source', 'status']),
    optional: Object.freeze([
      'governing_thought',
      'confidence',
      'evidence_tier',
      // These common fields are allowed without triggering unknown warnings.
      // They are NOT required by artifact-default but surface in practice:
      'created_at',
      'last_updated_at',
      'tags',
      'cross_refs',
      'author',
      'domain',
      'section',
      'hsi_score',
      'decision_log',
    ]),
  }),
  'ROOM.md': Object.freeze({
    required: Object.freeze(['name', 'type']),
    optional: Object.freeze(['references', 'description', 'parent', 'slug']),
  }),
  'STATE.md': Object.freeze({
    required: Object.freeze(['artifact_count']),
    optional: Object.freeze([
      'completeness_score',
      'last_activity_at',
      'gap_status',
      'minto_health',
    ]),
  }),
  'MINTO.md': Object.freeze({
    required: Object.freeze(['schema_version']),
    optional: Object.freeze([
      'governing_thought',
      'last_generated_at',
      'last_artifact_write_seen_at',
      'reasoning_health_score',
      'flagged_weaknesses',
      'decision_log',
      'key_claims',
      'mece_arguments',
      'cross_refs',
    ]),
  }),
});

// ---------- Schema selection ----------

/**
 * Select the schema key based on filename basename.
 * ROOM.md, STATE.md, MINTO.md are explicit; everything else falls back to
 * artifact-default. Case-sensitive per the canonical file naming rule
 * (Decision 15: ROOM.md everywhere).
 */
function selectSchemaKey(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return 'artifact-default';
  }
  const base = path.basename(filePath);
  if (base === 'ROOM.md') return 'ROOM.md';
  if (base === 'STATE.md') return 'STATE.md';
  if (base === 'MINTO.md') return 'MINTO.md';
  return 'artifact-default';
}

// ---------- Validation core (non-MINTO) ----------

function validateAgainstSchema(schema, frontmatter) {
  const violations = [];

  // Required fields missing -> error severity each.
  for (const req of schema.required) {
    const v = frontmatter[req];
    const missing =
      v === undefined ||
      v === null ||
      (typeof v === 'string' && v.trim().length === 0);
    if (missing) {
      violations.push({
        field: req,
        type: 'missing',
        severity: 'error',
      });
    }
  }

  // Unknown fields -> warning severity each.
  const knownFields = new Set(schema.required.concat(schema.optional));
  for (const key of Object.keys(frontmatter)) {
    if (!knownFields.has(key)) {
      violations.push({
        field: key,
        type: 'unknown',
        severity: 'warning',
      });
    }
  }

  return violations;
}

// ---------- Critical escalation ----------

/**
 * If ALL required fields of a schema are missing, escalate the aggregate
 * severity to 'critical'. This mirrors Phase 88-00-B's posture: a completely
 * empty frontmatter is a more severe failure than a single-field lapse.
 */
function escalateIfAllRequiredMissing(schema, violations) {
  const missingFields = new Set(
    violations
      .filter(function (v) { return v.type === 'missing'; })
      .map(function (v) { return v.field; })
  );
  if (missingFields.size === 0) return violations;
  const allMissing = schema.required.every(function (r) {
    return missingFields.has(r);
  });
  if (!allMissing) return violations;
  // Escalate each missing-required violation to critical. Unknown field
  // warnings stay warnings; they are not load-bearing here.
  return violations.map(function (v) {
    if (v.type === 'missing') {
      return { field: v.field, type: v.type, severity: 'critical' };
    }
    return v;
  });
}

// ---------- Entry point ----------

/**
 * validate(filePath, frontmatter) -> { valid, violations, severity }
 *
 *   filePath     string   absolute or relative path; only the basename is
 *                         used for schema selection.
 *   frontmatter  object   pre-parsed YAML frontmatter. Pass null to signal
 *                         the upstream parser failed (malformed YAML); the
 *                         returned result is a critical malformed violation.
 *                         Pass {} for an empty frontmatter block.
 *
 * Returns:
 *   {
 *     valid:      boolean  true iff violations[] is empty after filtering
 *                          warnings that do not gate validity (none today;
 *                          aligned with Phase 88-00-B: any violation makes
 *                          valid:false except unknown-field warnings).
 *     violations: array    [{field, type, severity}, ...]
 *     severity:  string    aggregate severity (critical|error|warning|info).
 *   }
 *
 * MINTO.md is delegated to feynman-minto-invariants.cjs; its shape already
 * matches this contract by construction (Phase 88-00-B).
 */
function validate(filePath, frontmatter) {
  // --- Parser-failure signal ---
  if (frontmatter === null) {
    return {
      valid: false,
      violations: [{
        field: '__frontmatter__',
        type: 'malformed',
        severity: 'critical',
      }],
      severity: 'critical',
    };
  }

  // --- Non-object guard (defensive; upstream should pass an object or null) ---
  if (typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    return {
      valid: false,
      violations: [{
        field: '__frontmatter__',
        type: 'malformed',
        severity: 'critical',
      }],
      severity: 'critical',
    };
  }

  const schemaKey = selectSchemaKey(filePath);

  // --- MINTO.md delegation ---
  if (schemaKey === 'MINTO.md') {
    // The invariants validator reads from disk (Phase 88-00-B contract).
    // We call it with filePath; it returns { valid, violations, severity }.
    // If the caller did not supply a real path (pure unit test), the
    // invariants validator will surface an existence violation, which is
    // correct behavior for the MINTO delegation arm.
    try {
      const r = mintoInvariants.validate(filePath);
      // Normalize: invariants may return severity:null when zero
      // violations. We harmonize to 'info' to keep the schema-module
      // aggregate contract consistent.
      const sev = r && r.severity ? r.severity : 'info';
      return {
        valid: r && r.valid === true,
        violations: (r && Array.isArray(r.violations)) ? r.violations : [],
        severity: sev,
      };
    } catch (_e) {
      // Never crash the schema module on a delegated call.
      return {
        valid: false,
        violations: [{
          field: '__delegate__',
          type: 'malformed',
          severity: 'error',
        }],
        severity: 'error',
      };
    }
  }

  // --- Non-MINTO schemas (ROOM.md, STATE.md, artifact-default) ---
  const schema = SCHEMAS[schemaKey];
  let violations = validateAgainstSchema(schema, frontmatter);
  violations = escalateIfAllRequiredMissing(schema, violations);

  const severity = aggregateSeverity(violations);

  // Validity gate: any non-warning violation invalidates; warnings alone
  // do NOT invalidate (unknown fields are advisory drift signals).
  const blockingViolations = violations.filter(function (v) {
    return v.severity === 'critical' || v.severity === 'error';
  });
  const valid = blockingViolations.length === 0;

  return {
    valid: valid,
    violations: violations,
    severity: severity,
  };
}

module.exports = {
  SCHEMAS: SCHEMAS,
  validate: validate,
  // Exported for the hook script and observability tooling.
  selectSchemaKey: selectSchemaKey,
  aggregateSeverity: aggregateSeverity,
};
