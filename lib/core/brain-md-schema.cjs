#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * BRAIN.md schema validator -- Phase 90-00.
 *
 * Single source of truth for the shape of the Brain-authored derivation
 * layer (fourth memory file in the per-folder quadruple: ROOM.md +
 * STATE.md + Feynman-MINTO.md + BRAIN.md). Consumed by every downstream
 * Phase 90-* plan:
 *   90-01 derivation core writes BRAIN.md that passes validateSchema
 *   90-04 readQuadruple extends the read contract
 *   90-05 registry-discoverable invariants validator wraps this entry point
 *   90-09 Phase 91 Navigation Engine interface spec cites this schema
 *
 * Pure CJS, zero npm dependencies, node built-ins only (fs + path). No
 * js-yaml: the frontmatter is a narrow subset (scalars, ISO timestamps,
 * small integers, null) that a hand-written parser handles deterministically
 * and audit-friendly. The parser is scoped to BRAIN.md fields only (zero
 * cross-import from feynman-minto-invariants.cjs; keeps lib/core
 * dependency graph flat per 88-01 pattern).
 *
 * API: validateSchema(filePath) -> { valid, violations[], severity }
 *   violations[i] = { category, severity, message, field?, action_hint? }
 *   severity = max severity across violations (null if none)
 *
 * Also exports frozen enums so downstream modules do not stringify
 * values:
 *   SCHEMA_VERSION, SEVERITY, CATEGORIES, STALENESS, STALE_REASON,
 *   REQUIRED_FRONTMATTER_FIELDS, OPTIONAL_SECTION_HEADINGS.
 *
 * Canon Part 8 boundary is baked in at the schema layer. The validator
 * scans every frontmatter scalar value against a conservative regex set
 * (email-like, currency magnitudes, quoted persons, meeting fragments,
 * SSN-like patterns). Matches emit canon_boundary/warning with
 * action_hint "canon_part8_review". Heuristics are deliberately
 * over-inclusive: this is a manual review flag, never a hard block.
 */

const fs = require('node:fs');

// ---------- Enums (frozen exports) ----------

const SCHEMA_VERSION = 1;

const SEVERITY = Object.freeze({
  CRITICAL: 'critical',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
});

const CATEGORIES = Object.freeze({
  EXISTENCE: 'existence',
  SCHEMA: 'schema',
  STALENESS: 'staleness',
  ATTRIBUTION: 'attribution',
  CANON_BOUNDARY: 'canon_boundary',
});

const STALENESS = Object.freeze({
  FRESH: 'fresh',
  STALE: 'stale',
  UNAVAILABLE: 'unavailable',
});

const STALE_REASON = Object.freeze({
  NONE: null,
  GOVERNING_THOUGHT_CHANGED: 'governing_thought_changed',
  BRAIN_OFFLINE: 'brain_offline',
  DERIVATION_TIMEOUT: 'derivation_timeout',
  BRAIN_GRAPH_VERSION_MISMATCH: 'brain_graph_version_mismatch',
});

const REQUIRED_FRONTMATTER_FIELDS = Object.freeze([
  'section',
  'brain_generated_at',
  'brain_graph_version',
  'governing_thought_hash',
  'staleness',
  'author',
]);

const OPTIONAL_SECTION_HEADINGS = Object.freeze([
  '## Pattern Matches',
  '## Cross-Domain Analogies',
  '## Wicked Indicators',
  '## Unfilled Opportunity Matches',
  '## Framework Chain Predictions',
  '## Assessment Thinking Chain Position',
  '## ProblemType Classification',
  '## Flagged Contradictions (cross-room)',
  '## HSI Signals',
]);

// Severity ordering (lowest -> highest) for aggregate max calculation.
const SEVERITY_ORDER = [
  SEVERITY.INFO,
  SEVERITY.WARNING,
  SEVERITY.ERROR,
  SEVERITY.CRITICAL,
];

// Attribution invariant: author frozen to "brain" (BRAIN.md is
// self-attributed; writing any other value is a constitutional breach).
const AUTHOR_FROZEN_VALUE = 'brain';

// Valid enum sets for frontmatter values.
const STALENESS_VALUES = Object.freeze([
  STALENESS.FRESH,
  STALENESS.STALE,
  STALENESS.UNAVAILABLE,
]);

const STALE_REASON_VALUES = Object.freeze([
  null,
  STALE_REASON.GOVERNING_THOUGHT_CHANGED,
  STALE_REASON.BRAIN_OFFLINE,
  STALE_REASON.DERIVATION_TIMEOUT,
  STALE_REASON.BRAIN_GRAPH_VERSION_MISMATCH,
]);

// ---------- Canon Part 8 leak heuristics (frozen regex set) ----------
//
// These patterns are conservative and deliberately over-flag. Any match
// in a frontmatter scalar value emits canon_boundary/warning with
// action_hint "canon_part8_review". The schema layer is the first line
// of defense against user-content seepage into Brain-queryable handles.
// Hard blocks live at the runtime layer (Plan 90-01 derivation writer
// enforces emission-time sanitization; this validator is the read-time
// and ship-time audit).

const CANON_LEAK_PATTERNS = Object.freeze([
  { re: /@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}/, hint: 'email-like pattern' },
  { re: /\$[0-9][\d,.]*[KMB]?\b/, hint: 'currency magnitude' },
  {
    re: /\b(Lawrence|Jonathan|Nimrod|Oren|Dror)\s+said\b/i,
    hint: 'quoted-person attribution',
  },
  { re: /\bmeeting with\b/i, hint: 'meeting fragment' },
  { re: /\b\d{3}-\d{2}-\d{4}\b/, hint: 'SSN-like pattern' },
]);

// ---------- Helpers ----------

function addViolation(list, category, severity, message, field, actionHint) {
  const v = { category: category, severity: severity, message: message };
  if (field) v.field = field;
  if (actionHint) v.action_hint = actionHint;
  list.push(v);
}

function aggregateSeverity(violations) {
  let max = -1;
  for (const v of violations) {
    const idx = SEVERITY_ORDER.indexOf(v.severity);
    if (idx > max) max = idx;
  }
  return max === -1 ? null : SEVERITY_ORDER[max];
}

function unquote(raw) {
  const s = raw.trim();
  if (s.length === 0) return '';
  if (s[0] === '"') {
    if (s.length < 2 || s[s.length - 1] !== '"') return null;
    return s.slice(1, -1);
  }
  if (s[0] === "'") {
    if (s.length < 2 || s[s.length - 1] !== "'") return null;
    return s.slice(1, -1);
  }
  return s;
}

// ---------- Hand-written YAML parser (narrow dialect only) ----------
//
// Accepts only:
//   key: scalar
//   key: "quoted scalar"
//   key: 'quoted scalar'
//   key: 123      (integer)
//   key: 0.75     (float)
//   key: null
//   key: true | false
//
// Arrays and nested objects are explicitly NOT supported: BRAIN.md
// frontmatter by contract is flat scalars only. If a user tries an
// array-value, the parser returns { ok: false } and the caller emits
// a schema/error violation.
//
// Returns { ok: true, data } or { ok: false, error }.

function parseYaml(src) {
  const lines = src.split(/\r?\n/);
  const root = {};
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.length === 0 || /^\s*$/.test(raw) || /^\s*#/.test(raw)) continue;
    // BRAIN.md frontmatter lines MUST be top-level key: value. Indented
    // lines, array entries, or nested blocks are not part of the
    // contract.
    const m = raw.match(/^([A-Za-z_][A-Za-z0-9_-]*):(.*)$/);
    if (!m) {
      return {
        ok: false,
        error: 'unrecognized line at frontmatter line ' + (i + 1),
      };
    }
    const key = m[1];
    const rest = m[2];
    if (rest.trim().length === 0) {
      // key: with empty value is allowed (treated as empty string).
      // But BRAIN.md contract is flat scalars only; if next line is
      // indented, reject (array or block marker).
      if (i + 1 < lines.length && /^\s+[^\s]/.test(lines[i + 1])) {
        return {
          ok: false,
          error:
            'unexpected indented block for key "' +
            key +
            '" (BRAIN.md frontmatter is flat scalars only)',
        };
      }
      root[key] = '';
      continue;
    }
    const vStr = unquote(rest);
    if (vStr === null) {
      return {
        ok: false,
        error: 'unterminated quoted scalar for key "' + key + '"',
      };
    }
    // Cast known scalar shapes: null / boolean / integer / float stay
    // as native JS values; everything else is a string.
    root[key] = castScalar(vStr);
  }
  return { ok: true, data: root };
}

function castScalar(s) {
  if (s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  // Integer (no decimal point)
  if (/^-?\d+$/.test(s)) {
    const n = parseInt(s, 10);
    if (Number.isSafeInteger(n)) return n;
  }
  // Float (has decimal point)
  if (/^-?\d+\.\d+$/.test(s)) {
    const f = parseFloat(s);
    if (Number.isFinite(f)) return f;
  }
  return s;
}

// ---------- Canon Part 8 leak scanner ----------
//
// Walks every string-valued frontmatter field and tests against the
// frozen regex set. Non-string values are skipped (booleans, ints, null
// cannot carry user content). Matches produce canon_boundary/warning.
// One violation per (field, pattern) to avoid pathological noise.

function scanCanonLeaks(fm, violations) {
  for (const key of Object.keys(fm)) {
    const value = fm[key];
    if (typeof value !== 'string' || value.length === 0) continue;
    for (const p of CANON_LEAK_PATTERNS) {
      if (p.re.test(value)) {
        addViolation(
          violations,
          CATEGORIES.CANON_BOUNDARY,
          SEVERITY.WARNING,
          'Possible Canon Part 8 leak in "' +
            key +
            '": ' +
            p.hint +
            ' matched. Review for user-content seepage into Brain-queryable handle.',
          key,
          'canon_part8_review'
        );
      }
    }
  }
}

// ---------- Main validator ----------

/**
 * validateSchema(filePath) -> { valid, violations[], severity }
 *
 * Does not throw. Every failure mode is expressed as a violation so the
 * caller can decide policy (warn vs block vs repair).
 */
function validateSchema(filePath) {
  const violations = [];

  // --- Existence check ---
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (_err) {
    addViolation(
      violations,
      CATEGORIES.EXISTENCE,
      SEVERITY.CRITICAL,
      'BRAIN.md not found: ' + filePath
    );
    return {
      valid: false,
      violations: violations,
      severity: aggregateSeverity(violations),
    };
  }

  if (!stat.isFile()) {
    addViolation(
      violations,
      CATEGORIES.EXISTENCE,
      SEVERITY.CRITICAL,
      'Path is not a regular file: ' + filePath
    );
    return {
      valid: false,
      violations: violations,
      severity: aggregateSeverity(violations),
    };
  }

  if (stat.size === 0) {
    addViolation(
      violations,
      CATEGORIES.EXISTENCE,
      SEVERITY.CRITICAL,
      'BRAIN.md is empty (zero bytes): ' + filePath
    );
    return {
      valid: false,
      violations: violations,
      severity: aggregateSeverity(violations),
    };
  }

  const raw = fs.readFileSync(filePath, 'utf8');

  // --- Frontmatter delimiter check ---
  //
  // Parse-error fast return: if delimiters are missing or YAML is
  // unparseable, emit ONE schema/error and stop. Do not run
  // required-field checks against an undefined frontmatter object.
  const fmRe = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const fmMatch = raw.match(fmRe);
  if (!fmMatch) {
    addViolation(
      violations,
      CATEGORIES.SCHEMA,
      SEVERITY.ERROR,
      'Missing or malformed frontmatter delimiters (--- ... ---)'
    );
    return {
      valid: false,
      violations: violations,
      severity: aggregateSeverity(violations),
    };
  }

  const fmText = fmMatch[1];
  const body = fmMatch[2];

  // --- YAML parse ---
  const parsed = parseYaml(fmText);
  if (!parsed.ok) {
    addViolation(
      violations,
      CATEGORIES.SCHEMA,
      SEVERITY.ERROR,
      'Frontmatter parse failure: ' + parsed.error
    );
    return {
      valid: false,
      violations: violations,
      severity: aggregateSeverity(violations),
    };
  }
  const fm = parsed.data;

  // --- Required fields ---
  //
  // Each missing required field is a schema/error -- except "author",
  // whose absence or mismatch is an ATTRIBUTION error (BRAIN.md MUST be
  // self-attributed to the Brain; a wrong author is a constitutional
  // breach, not a shape miss).
  for (const field of REQUIRED_FRONTMATTER_FIELDS) {
    if (!(field in fm) || fm[field] === '' || fm[field] === undefined) {
      if (field === 'author') {
        addViolation(
          violations,
          CATEGORIES.ATTRIBUTION,
          SEVERITY.ERROR,
          'Missing required frontmatter field: author (must be "brain")',
          field
        );
      } else {
        addViolation(
          violations,
          CATEGORIES.SCHEMA,
          SEVERITY.ERROR,
          'Missing required frontmatter field: ' + field,
          field
        );
      }
    }
  }

  // --- Author must equal "brain" ---
  if ('author' in fm && fm.author !== '' && fm.author !== AUTHOR_FROZEN_VALUE) {
    addViolation(
      violations,
      CATEGORIES.ATTRIBUTION,
      SEVERITY.ERROR,
      'author field is "' +
        String(fm.author) +
        '", must be "' +
        AUTHOR_FROZEN_VALUE +
        '" (BRAIN.md is self-attributed; other values are a Canon Part 2 breach)',
      'author'
    );
  }

  // --- Staleness enum ---
  if (
    'staleness' in fm &&
    fm.staleness !== '' &&
    STALENESS_VALUES.indexOf(fm.staleness) === -1
  ) {
    addViolation(
      violations,
      CATEGORIES.STALENESS,
      SEVERITY.WARNING,
      'staleness value "' +
        String(fm.staleness) +
        '" not in enum [fresh, stale, unavailable]',
      'staleness'
    );
  }

  // --- stale_reason enum + cross-field rule ---
  //
  // If staleness=stale, stale_reason MUST be set to one of the non-null
  // values (otherwise we cannot explain why the derivation is stale).
  // If stale_reason is present, it must match the frozen enum.
  if ('stale_reason' in fm) {
    // Accept both null (parsed from "null" scalar) and undefined.
    const sr = fm.stale_reason;
    if (sr !== null && STALE_REASON_VALUES.indexOf(sr) === -1) {
      addViolation(
        violations,
        CATEGORIES.STALENESS,
        SEVERITY.WARNING,
        'stale_reason value "' +
          String(sr) +
          '" not in enum [null, governing_thought_changed, brain_offline, derivation_timeout, brain_graph_version_mismatch]',
        'stale_reason'
      );
    }
  }

  if (fm.staleness === STALENESS.STALE) {
    const sr = 'stale_reason' in fm ? fm.stale_reason : undefined;
    if (sr === null || sr === undefined || sr === '') {
      addViolation(
        violations,
        CATEGORIES.STALENESS,
        SEVERITY.WARNING,
        'staleness=stale requires a non-null stale_reason (why is the derivation stale?)',
        'stale_reason'
      );
    }
  }

  // --- Section headings scan (body) ---
  //
  // Walk the body for any "## " lines. Headings not in
  // OPTIONAL_SECTION_HEADINGS are downgraded to schema/info (users may
  // extend the schema locally; we note but do not fail).
  const headingRe = /^##\s+.+$/gm;
  const matches = body.match(headingRe) || [];
  const knownSet = new Set(OPTIONAL_SECTION_HEADINGS);
  for (const h of matches) {
    if (!knownSet.has(h)) {
      addViolation(
        violations,
        CATEGORIES.SCHEMA,
        SEVERITY.INFO,
        'Unknown section heading "' +
          h +
          '" (not in OPTIONAL_SECTION_HEADINGS; user-extended sections are permitted but noted)',
        'body'
      );
    }
  }

  // --- Canon Part 8 leak scan ---
  scanCanonLeaks(fm, violations);

  // --- Aggregate ---
  const severity = aggregateSeverity(violations);
  const valid = violations.length === 0;
  return {
    valid: valid,
    violations: violations,
    severity: severity,
  };
}

module.exports = {
  validateSchema: validateSchema,
  SCHEMA_VERSION: SCHEMA_VERSION,
  SEVERITY: SEVERITY,
  CATEGORIES: CATEGORIES,
  STALENESS: STALENESS,
  STALE_REASON: STALE_REASON,
  REQUIRED_FRONTMATTER_FIELDS: REQUIRED_FRONTMATTER_FIELDS,
  OPTIONAL_SECTION_HEADINGS: OPTIONAL_SECTION_HEADINGS,
};
