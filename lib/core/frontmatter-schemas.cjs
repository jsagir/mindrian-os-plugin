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
 *   ROOM.md          required: (none). optional: the writer vocabulary emitted
 *                    by the Phase 119 scaffold templates (section, purpose,
 *                    directory_type, stage_relevance, default_methodologies,
 *                    icm_layer, auto_scaffolded) plus room-identity keys.
 *   STATE.md         required: (none). optional: the compute-state computed
 *                    vocabulary (computed, venture_stage, total_entries) plus
 *                    the scaffold-transient keys.
 *   USER.md          required: (none). optional: the converged machine schema
 *                    written by lib/core/user-md-ops.cjs writeUserMdAtomic.
 *   every other .md  required: (none). optional: source, date, opportunity_ref
 *   (artifact-       (the new-project Step 6 / 6.1 entry vocabulary) plus the
 *    default)        legacy title/status/governing_thought keys.
 *
 * Phase 88.1-07 originally codified an aspirational vocabulary (ROOM.md
 * required name+type; STATE.md required artifact_count; artifacts required
 * title+source+status) that NO writer ever adopted. The real writers -- the
 * Phase 119 scaffold templates, commands/new-project.md Step 6 / 6.1, and
 * scripts/compute-state -- emit different keys. The mismatch made this
 * advisory hook a noisy false-positive generator and a Canon Part 6 dog-food
 * self-violation (the plugin's own documented output failed its own schema).
 * Per Decision 15 the filesystem writers are the source of truth, so the
 * VALIDATOR was reconciled to the WRITERS (the low-churn correct fix), not the
 * reverse. A stricter path-aware selectSchemaKey (so the three semantically
 * distinct ROOM.md roles get role-specific schemas) is a DEFERRED follow-up.
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
    // Reconciled to the writers: new-project Step 6 emits {source, date};
    // Step 6.1 emits {source, date, opportunity_ref}; meeting asset-wrapper
    // .md files emit {type, asset_path, meeting_id, transcript} with NO
    // source. title/status are emitted by ZERO writers. There is therefore no
    // universally-emitted key, so required is empty -- an artifact never
    // blocks on a missing structural key. Unknown keys still surface as
    // advisory warnings (drift signal), never as a block.
    required: Object.freeze([]),
    optional: Object.freeze([
      // new-project Step 6 / 6.1 entry vocabulary.
      'source',
      'date',
      'opportunity_ref',
      // Legacy / evidence-tier keys retained so artifacts that DO carry them
      // do not warn.
      'title',
      'status',
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
    // Reconciled to the Phase 119 scaffold templates. required relaxed to []
    // because the three semantically-distinct ROOM.md roles (section identity,
    // non-ICM directory identity, room root) emit disjoint key sets and
    // selectSchemaKey collapses them onto one schema. name/type are retained
    // as optional (legacy vocabulary) rather than required.
    required: Object.freeze([]),
    optional: Object.freeze([
      // Legacy keys.
      'name',
      'type',
      'references',
      'description',
      'parent',
      'slug',
      // Phase 119 ROOM.md.section.tmpl vocabulary.
      'section',
      // Phase 275 (ICM L1): the always-true, always-visible one-sentence
      // statement rendered in frontmatter and the body blockquote. NOT
      // required -- the three semantically-distinct ROOM.md roles (section
      // identity, non-ICM directory identity, room root) emit disjoint key
      // sets, and a directory-identity or room-root ROOM.md legitimately
      // has no statement. value_proposition is NOT added here (D-02): that
      // is a reserved PWS Triple-Validation term, already used unrelatedly
      // in rs-commercial-assessor.cjs and pitch-feedback-schemas.cjs as a
      // commercial-assessment output shape, not a section frontmatter key.
      'statement',
      'purpose',
      'stage_relevance',
      'default_methodologies',
      'icm_layer',
      'auto_scaffolded',
      // Phase 119 ROOM.md.identity.tmpl vocabulary.
      'directory_type',
      // Room-root identity vocabulary (new-project / room-birth).
      'room',
      'room_id',
      'room_kind',
      'blueprint_family',
      'venture_name',
      'venture_stage',
      'created',
      'navigator',
      'founder',
      'shared_with',
    ]),
  }),
  'STATE.md': Object.freeze({
    // Reconciled to scripts/compute-state (computed/venture_stage/
    // total_entries) and the STATE.md.tmpl scaffold-transient vocabulary.
    // artifact_count was the aspirational key no writer emits; kept as
    // optional for backward-compat with any legacy room.
    required: Object.freeze([]),
    optional: Object.freeze([
      // compute-state computed vocabulary.
      'computed',
      'venture_stage',
      'total_entries',
      // STATE.md.tmpl scaffold transients.
      'phase',
      'role_blend',
      'journey_stage',
      'venture_name',
      'auto_created',
      'auto_created_at',
      'placeholder_slug',
      'source_material_id',
      // Phase 240.1 Plan 02 (CTXL-01), Canon Part 6 dog-fooding fix: these
      // are keys this repo's OWN writers already emit that this repo's OWN
      // validator did not recognise (CHANGELOG.md:822 records the same
      // self-violation class happening once already).
      //   gsd_state_version  seeded by scripts/room-registry:130,
      //                      scripts/vault-import.cjs:149; now also
      //                      emitted by lib/core/state-version.cjs
      //   status             seeded by scripts/room-registry:131 ('active'),
      //                      scripts/vault-import.cjs:150 ('imported')
      //   created_by         emitted by scripts/vault-import.cjs:151
      //   current_room       emitted by scripts/compute-state:244 for the
      //                      registry-active room only
      'gsd_state_version',
      'status',
      'created_by',
      'current_room',
      // Legacy keys.
      'artifact_count',
      'completeness_score',
      'last_activity_at',
      'gap_status',
      'minto_health',
    ]),
  }),
  'USER.md': Object.freeze({
    // Reconciled to lib/core/user-md-ops.cjs buildFrontmatter (the converged
    // machine schema, Phase 155-03). Previously USER.md wrongly matched
    // artifact-default and false-flagged on every key. required is [] because
    // USER.md is a machine-managed identity file, not an evidence artifact.
    required: Object.freeze([]),
    optional: Object.freeze([
      'schema_version',
      'user_id',
      'canonical_role',
      'larry_persona',
      'brain_persona',
      'journey_stage',
      'role_blend',
      'problem_type',
      'venture_stage',
      'last_detected_at',
      'last_updated_at',
      'detection_confidence',
      'update_threshold',
      'consecutive_signal_count',
      'parse_failed',
      'override_active',
      'first_seen',
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
 * ROOM.md, STATE.md, MINTO.md, USER.md are explicit; everything else falls
 * back to artifact-default. Case-sensitive per the canonical file naming rule
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
  if (base === 'USER.md') return 'USER.md';
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
