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

module.exports = {
  validateNarrative,
  SCHEMA_BOUNDS,
  REQUIRED_PATHS,
};
