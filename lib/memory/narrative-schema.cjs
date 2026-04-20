/**
 * MindrianOS Plugin -- Narrative JSON Schema Validator (Phase 81 Revision 2)
 *
 * Enforces the R-3 schema from .planning/phases/81-feynman-minto-hybrid/81-CONTEXT.md.
 * Used by scripts/vault-section-minto-generator.cjs --write to reject malformed
 * narratives before they reach the renderer. Pure function, no I/O, node built-in
 * only. Zero npm dependencies.
 *
 * The shape is:
 *   {
 *     section:          string, non-empty
 *     essence:          string, max 200
 *     plain_language:   string, max 400
 *     governing_thought:string, max 250
 *     mental_model: {
 *       analogy:        string, max 150
 *       mapping:        string, max 500
 *       limits:         string, max 150
 *     }
 *     sweet_spot:       string, max 600
 *     key_claims:       array of strings, length in [3, 5], each string max 200
 *   }
 *
 * No em-dashes (U+2014) or en-dashes (U+2013) allowed anywhere in any string
 * field. The validator walks every string recursively.
 */

'use strict';

const SCHEMA_BOUNDS = {
  section: { type: 'string', minLen: 1, maxLen: 200 },
  essence: { type: 'string', minLen: 1, maxLen: 200 },
  plain_language: { type: 'string', minLen: 1, maxLen: 400 },
  governing_thought: { type: 'string', minLen: 1, maxLen: 250 },
  'mental_model.analogy': { type: 'string', minLen: 1, maxLen: 150 },
  'mental_model.mapping': { type: 'string', minLen: 1, maxLen: 500 },
  'mental_model.limits': { type: 'string', minLen: 1, maxLen: 150 },
  sweet_spot: { type: 'string', minLen: 1, maxLen: 600 },
  key_claims: { type: 'array', minLen: 3, maxLen: 5, itemMaxLen: 200 },
};

const REQUIRED_PATHS = [
  'section',
  'essence',
  'plain_language',
  'governing_thought',
  'mental_model',
  'mental_model.analogy',
  'mental_model.mapping',
  'mental_model.limits',
  'sweet_spot',
  'key_claims',
];

function getPath(obj, dotted) {
  const parts = dotted.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function hasForbiddenDash(str) {
  for (let i = 0; i < str.length; i++) {
    const cp = str.codePointAt(i);
    if (cp === 8212 || cp === 8211) return true;
  }
  return false;
}

function walkStringsForDashes(value, pathPrefix, errors) {
  if (typeof value === 'string') {
    if (hasForbiddenDash(value)) {
      errors.push(
        'forbidden-dash at ' + pathPrefix + ': em-dash or en-dash not allowed'
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(function (item, i) {
      walkStringsForDashes(item, pathPrefix + '[' + i + ']', errors);
    });
    return;
  }
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) {
      walkStringsForDashes(value[k], pathPrefix + '.' + k, errors);
    }
  }
}

/**
 * validateNarrative(obj) -> { valid: bool, errors: string[] }
 *
 * Pure, deterministic, side-effect-free. Returns on first-pass collection
 * of every error so authors can fix all issues in a single edit.
 */
function validateNarrative(obj) {
  const errors = [];

  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return {
      valid: false,
      errors: ['root: narrative must be a plain object'],
    };
  }

  // Required-field presence.
  for (const p of REQUIRED_PATHS) {
    const v = getPath(obj, p);
    if (v === undefined || v === null) {
      errors.push('missing-required-field: ' + p);
    }
  }

  // Per-path type + bounds.
  for (const dotted of Object.keys(SCHEMA_BOUNDS)) {
    const spec = SCHEMA_BOUNDS[dotted];
    const v = getPath(obj, dotted);
    if (v === undefined || v === null) continue; // already reported above
    if (spec.type === 'string') {
      if (typeof v !== 'string') {
        errors.push('type-error: ' + dotted + ' must be string');
        continue;
      }
      if (v.length < spec.minLen) {
        errors.push(
          'too-short: ' + dotted + ' length=' + v.length + ' min=' + spec.minLen
        );
      }
      if (v.length > spec.maxLen) {
        errors.push(
          'too-long: ' + dotted + ' length=' + v.length + ' max=' + spec.maxLen
        );
      }
    } else if (spec.type === 'array') {
      if (!Array.isArray(v)) {
        errors.push('type-error: ' + dotted + ' must be array');
        continue;
      }
      if (v.length < spec.minLen) {
        errors.push(
          'too-few-items: ' +
            dotted +
            ' length=' +
            v.length +
            ' min=' +
            spec.minLen
        );
      }
      if (v.length > spec.maxLen) {
        errors.push(
          'too-many-items: ' +
            dotted +
            ' length=' +
            v.length +
            ' max=' +
            spec.maxLen
        );
      }
      v.forEach(function (item, i) {
        if (typeof item !== 'string') {
          errors.push(
            'type-error: ' + dotted + '[' + i + '] must be string'
          );
          return;
        }
        if (item.length < 1) {
          errors.push(
            'too-short: ' + dotted + '[' + i + '] length=0 min=1'
          );
        }
        if (item.length > spec.itemMaxLen) {
          errors.push(
            'too-long: ' +
              dotted +
              '[' +
              i +
              '] length=' +
              item.length +
              ' max=' +
              spec.itemMaxLen
          );
        }
      });
    }
  }

  // Em-dash / en-dash ban, recursive.
  walkStringsForDashes(obj, 'root', errors);

  return { valid: errors.length === 0, errors: errors };
}

// ---------- Phase 88-00: structural payload validator ----------
//
// The structural shell is the frontmatter-level half of a Feynman-MINTO
// file. It carries five v88 fields (all optional for back-compat):
//   - last_generated_at:          ISO-8601 or null
//   - last_artifact_write_seen_at: ISO-8601 or null
//   - reasoning_health_score:      number in [0,1] or null
//   - flagged_weaknesses:          array of strings
//   - decision_log:                array of entries (see below)
//
// Plus existing pre-v88 fields (schema_version, governing_thought, ...).
// The validator accepts the pre-v88 shape (no new fields) so migrations in
// progress do not flap. When a v88 field is present it is type + range
// checked. This is the shell validator consumed by 88-00 generator + 88-01
// readTriple + 88-04-B atomic write.

const VALID_USER_RESPONSES = ['approve', 'reject', 'defer'];
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/**
 * validateDecisionLogEntry(entry) -> { valid, errors }
 *
 * Required keys: session_id (non-empty string), timestamp (ISO-8601
 * string), action (non-empty string), user_response (approve|reject|defer),
 * reason (non-empty string). Optional: outcome (string).
 *
 * Exported for Phase 88-10 decision-capture to validate entries before
 * writing them to Feynman-MINTO.frontmatter.decision_log. Pure function.
 */
function validateDecisionLogEntry(entry) {
  const errors = [];
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
    return { valid: false, errors: ['root: entry must be an object'] };
  }
  if (typeof entry.session_id !== 'string' || entry.session_id.length === 0) {
    errors.push('missing-or-empty: session_id');
  }
  if (typeof entry.timestamp !== 'string' || !ISO_RE.test(entry.timestamp)) {
    errors.push('bad-iso: timestamp');
  }
  if (typeof entry.action !== 'string' || entry.action.length === 0) {
    errors.push('missing-or-empty: action');
  }
  if (VALID_USER_RESPONSES.indexOf(entry.user_response) === -1) {
    errors.push(
      'bad-enum: user_response must be one of [approve, reject, defer] (got ' +
        JSON.stringify(entry.user_response) +
        ')'
    );
  }
  if (typeof entry.reason !== 'string' || entry.reason.length === 0) {
    errors.push('missing-or-empty: reason');
  }
  if (
    'outcome' in entry &&
    entry.outcome !== null &&
    entry.outcome !== undefined &&
    typeof entry.outcome !== 'string'
  ) {
    errors.push('type-error: outcome must be string');
  }
  return { valid: errors.length === 0, errors: errors };
}

/**
 * validateStructural(payload) -> { valid, errors }
 *
 * Accepts pre-v88 structural payloads (no new fields) for migration
 * back-compat. When any v88 field is present, validates type and range.
 * Pure function, no I/O.
 *
 * Contract is kept narrow so 88-04-B atomic write contract can call it on
 * every --write without regressing Phase 81 shapes.
 */
function validateStructural(payload) {
  const errors = [];
  if (
    payload === null ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    return {
      valid: false,
      errors: ['root: structural payload must be an object'],
    };
  }

  // last_generated_at: optional, ISO-8601 string or null
  if (
    'last_generated_at' in payload &&
    payload.last_generated_at !== null &&
    payload.last_generated_at !== undefined
  ) {
    if (
      typeof payload.last_generated_at !== 'string' ||
      !ISO_RE.test(payload.last_generated_at)
    ) {
      errors.push('bad-iso: last_generated_at');
    }
  }

  // last_artifact_write_seen_at: optional, ISO-8601 string or null
  if (
    'last_artifact_write_seen_at' in payload &&
    payload.last_artifact_write_seen_at !== null &&
    payload.last_artifact_write_seen_at !== undefined
  ) {
    if (
      typeof payload.last_artifact_write_seen_at !== 'string' ||
      !ISO_RE.test(payload.last_artifact_write_seen_at)
    ) {
      errors.push('bad-iso: last_artifact_write_seen_at');
    }
  }

  // reasoning_health_score: number in [0,1] or null
  if (
    'reasoning_health_score' in payload &&
    payload.reasoning_health_score !== null &&
    payload.reasoning_health_score !== undefined
  ) {
    const rhs = payload.reasoning_health_score;
    if (typeof rhs !== 'number' || !Number.isFinite(rhs) || rhs < 0 || rhs > 1) {
      errors.push(
        'range-error: reasoning_health_score must be number in [0,1] or null'
      );
    }
  }

  // flagged_weaknesses: array of non-empty strings
  if (
    'flagged_weaknesses' in payload &&
    payload.flagged_weaknesses !== null &&
    payload.flagged_weaknesses !== undefined
  ) {
    if (!Array.isArray(payload.flagged_weaknesses)) {
      errors.push('type-error: flagged_weaknesses must be array');
    } else {
      payload.flagged_weaknesses.forEach(function (item, i) {
        if (typeof item !== 'string') {
          errors.push(
            'type-error: flagged_weaknesses[' + i + '] must be string'
          );
        }
      });
    }
  }

  // decision_log: array of entry objects, each validated via helper
  if (
    'decision_log' in payload &&
    payload.decision_log !== null &&
    payload.decision_log !== undefined
  ) {
    if (!Array.isArray(payload.decision_log)) {
      errors.push('type-error: decision_log must be array');
    } else {
      payload.decision_log.forEach(function (entry, i) {
        const r = validateDecisionLogEntry(entry);
        if (!r.valid) {
          errors.push(
            'decision_log[' + i + ']: ' + r.errors.join('; ')
          );
        }
      });
    }
  }

  return { valid: errors.length === 0, errors: errors };
}

module.exports = {
  validateNarrative,
  SCHEMA_BOUNDS,
  REQUIRED_PATHS,
  // Phase 88-00 exports
  validateStructural,
  validateDecisionLogEntry,
};
