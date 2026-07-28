/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Feynman-MINTO invariants validator -- single source of truth for
 * "properly managed" per Phase 88.
 *
 * Consumed by every Phase 88 consumer (88-01 readTriple, 88-04-B atomic
 * write contract, 88-06 on-stop snapshot, 88-07 session-start injection,
 * 88-13 guardian) so each one agrees on what a valid Feynman-MINTO file
 * looks like. Centralizing here prevents ad-hoc drift.
 *
 * Pure CJS, zero npm dependencies, node built-ins only (fs + path). No
 * js-yaml: the frontmatter is a narrow subset (scalars, ISO timestamps,
 * arrays of strings, arrays of flat objects) that a hand-written parser
 * handles deterministically and audit-friendly.
 *
 * API: validate(filePath) -> { valid, violations[], severity }
 *   violations[i] = { category, severity, message, field? }
 *   severity = max severity across violations (null if none)
 *
 * Also exports SEVERITY and CATEGORIES (frozen enums) so downstream
 * modules do not stringify values.
 */

'use strict';

const fs = require('node:fs');

// ---------- Enums ----------

const SEVERITY = Object.freeze({
  CRITICAL: 'critical',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
});

const CATEGORIES = Object.freeze({
  EXISTENCE: 'existence',
  SCHEMA: 'schema',
  FRESHNESS: 'freshness',
  COHERENCE: 'coherence',
  ATOMICITY: 'atomicity',
});

const SEVERITY_ORDER = [
  SEVERITY.INFO,
  SEVERITY.WARNING,
  SEVERITY.ERROR,
  SEVERITY.CRITICAL,
];

// ---------- Tunables (documented invariants) ----------

const MAX_BODY_TOKENS = 1500; // FEYNMINTO-01 narrative token budget
const BYTES_PER_TOKEN = 4; // conservative ratio for token estimate
const FRESHNESS_SLACK_MS = 60 * 60 * 1000; // 1 hour
const FUTURE_SLACK_MS = 60 * 1000; // 60 seconds (mtime clock skew)
const MAX_DECISION_LOG = 20;
const MAX_FILE_BYTES = 50 * 1024; // 50 KB atomicity guard
const VALID_USER_RESPONSES = ['approve', 'reject', 'defer'];
const TMP_MARKER_RE = /^# FEYNMINTO_TMP/m;
const EMDASH_RE = /[\u2013\u2014]/;
const WIKILINK_RE = /^\[\[.+\]\]$/;

// ---------- Helpers ----------

function addViolation(list, category, severity, message, field) {
  const v = { category: category, severity: severity, message: message };
  if (field) v.field = field;
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

function parseIso(s) {
  if (typeof s !== 'string' || s.length === 0) return null;
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}

// Strip surrounding quotes from a YAML scalar ("foo" or 'foo') and return the
// inner text. Returns null if the quote is unterminated.
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
  return s; // bare scalar
}

// ---------- Hand-written YAML parser (narrow dialect only) ----------
//
// Accepts:
//   key: scalar
//   key: "quoted scalar"
//   key:
//     - item
//     - "item"
//   key:
//     - nested_key: value
//       other_key: value
//
// Returns { ok: true, data } on success or { ok: false, error } on a parse
// fault. Caller maps parse faults to schema/error violations.

function parseYaml(src) {
  const lines = src.split(/\r?\n/);
  const root = {};
  let i = 0;

  // Minimal state: at the top level we read scalars or start arrays.
  while (i < lines.length) {
    const raw = lines[i];
    if (raw.length === 0 || /^\s*$/.test(raw) || /^\s*#/.test(raw)) {
      i += 1;
      continue;
    }
    // Top-level key line: starts at col 0, form `key:` or `key: value`.
    const m = raw.match(/^([A-Za-z_][A-Za-z0-9_-]*):(.*)$/);
    if (!m) {
      return {
        ok: false,
        error: 'unrecognized top-level line at frontmatter line ' + (i + 1),
      };
    }
    const key = m[1];
    const rest = m[2];

    if (rest.trim().length > 0) {
      // key: scalar
      const v = unquote(rest);
      if (v === null) {
        return {
          ok: false,
          error: 'unterminated quoted scalar for key "' + key + '"',
        };
      }
      root[key] = v;
      i += 1;
      continue;
    }

    // key: (block follows, might be array or empty)
    i += 1;
    const items = [];
    let isObjectArray = false;
    let isStringArray = false;

    while (i < lines.length) {
      const next = lines[i];
      if (next.length === 0 || /^\s*$/.test(next) || /^\s*#/.test(next)) {
        i += 1;
        continue;
      }
      // Object-array entry: `  - key: value` (first key of an object)
      const objHead = next.match(/^\s+-\s+([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
      if (objHead) {
        isObjectArray = true;
        const obj = {};
        const vraw = objHead[2];
        const v = unquote(vraw);
        if (v === null) {
          return {
            ok: false,
            error:
              'unterminated quoted scalar in array-of-objects for key "' +
              key +
              '"',
          };
        }
        obj[objHead[1]] = v;
        i += 1;
        // Read continuation keys indented deeper than the `-`.
        while (i < lines.length) {
          const cont = lines[i];
          if (cont.length === 0 || /^\s*$/.test(cont)) {
            i += 1;
            continue;
          }
          const contMatch = cont.match(
            /^\s+([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/
          );
          // Stop if this is another array entry or the block ended.
          if (/^\s+-\s/.test(cont) || !contMatch) break;
          const cvRaw = contMatch[2];
          const cv = unquote(cvRaw);
          if (cv === null) {
            return {
              ok: false,
              error:
                'unterminated quoted scalar in array-of-objects for key "' +
                key +
                '"',
            };
          }
          obj[contMatch[1]] = cv;
          i += 1;
        }
        items.push(obj);
        continue;
      }
      // String-array entry: `  - scalar` or `  - "scalar"`
      const strItem = next.match(/^\s+-\s+(.*)$/);
      if (strItem) {
        // An empty string-array item (`  - `) is a malformed decision_log
        // entry when the block otherwise looks like an object array; treat
        // it as a missing-first-key signal by recording a null.
        const raw = strItem[1];
        if (raw.trim().length === 0) {
          // Missing session_id or missing first key -- push a sentinel
          // object so downstream schema checks can flag it.
          isObjectArray = true;
          items.push({});
          i += 1;
          continue;
        }
        // String item.
        isStringArray = true;
        const v = unquote(raw);
        if (v === null) {
          return {
            ok: false,
            error: 'unterminated quoted scalar in array for key "' + key + '"',
          };
        }
        items.push(v);
        i += 1;
        continue;
      }
      // Non-array, non-blank, not deeper-indented -> end of block.
      if (/^[A-Za-z_]/.test(next)) break;
      i += 1; // skip whatever this is, defensively
    }

    if (isStringArray && isObjectArray) {
      return {
        ok: false,
        error: 'mixed scalar/object array for key "' + key + '"',
      };
    }
    root[key] = items;
  }

  return { ok: true, data: root };
}

// ---------- Main validator ----------

/**
 * validate(filePath) -> { valid, violations[], severity }
 */
function validate(filePath) {
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
      'File not found: ' + filePath
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
      'File is empty (zero bytes): ' + filePath
    );
    return {
      valid: false,
      violations: violations,
      severity: aggregateSeverity(violations),
    };
  }

  // --- File size bloat guard (atomicity / warning) ---
  if (stat.size > MAX_FILE_BYTES) {
    addViolation(
      violations,
      CATEGORIES.ATOMICITY,
      SEVERITY.WARNING,
      'File exceeds ' +
        MAX_FILE_BYTES +
        ' bytes (' +
        stat.size +
        '); narrative bloat guard tripped'
    );
  }

  const raw = fs.readFileSync(filePath, 'utf8');

  // --- Orphan tmp marker (atomicity / critical) ---
  if (TMP_MARKER_RE.test(raw)) {
    addViolation(
      violations,
      CATEGORIES.ATOMICITY,
      SEVERITY.CRITICAL,
      'Orphan # FEYNMINTO_TMP marker detected (mid-write crash)'
    );
    // Continue other checks so the full picture is reported.
  }

  // --- Frontmatter delimiter check ---
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
  if (typeof fm.schema_version !== 'string' || fm.schema_version.length === 0) {
    addViolation(
      violations,
      CATEGORIES.SCHEMA,
      SEVERITY.ERROR,
      'Missing or empty frontmatter field: schema_version',
      'schema_version'
    );
  }
  if (
    typeof fm.governing_thought !== 'string' ||
    fm.governing_thought.length === 0
  ) {
    // Phase 241 F-2: governing_thought is the Minto governing thought
    // itself, so its absence is a structural breach of the section's
    // reasoning contract, not a schema nit like schema_version above.
    // That is why this one is raised to CRITICAL and schema_version is not.
    addViolation(
      violations,
      CATEGORIES.SCHEMA,
      SEVERITY.CRITICAL,
      'Missing or empty frontmatter field: governing_thought',
      'governing_thought'
    );
  }

  // --- Body token budget (FEYNMINTO-01) ---
  const tokenEstimate = Math.ceil(body.length / BYTES_PER_TOKEN);
  if (tokenEstimate > MAX_BODY_TOKENS) {
    addViolation(
      violations,
      CATEGORIES.SCHEMA,
      SEVERITY.ERROR,
      'Narrative body token budget exceeded: estimated ' +
        tokenEstimate +
        ' > ' +
        MAX_BODY_TOKENS +
        ' (FEYNMINTO-01)',
      'body'
    );
  }

  // --- Freshness: last_generated_at ---
  const nowMs = Date.now();
  if (!('last_generated_at' in fm)) {
    addViolation(
      violations,
      CATEGORIES.FRESHNESS,
      SEVERITY.WARNING,
      'Missing last_generated_at (backfill case; rerun regen to populate)',
      'last_generated_at'
    );
  }
  const lgaMs = parseIso(fm.last_generated_at);
  const lawsMs = parseIso(fm.last_artifact_write_seen_at);

  if (lawsMs !== null && lawsMs > nowMs + FUTURE_SLACK_MS) {
    addViolation(
      violations,
      CATEGORIES.FRESHNESS,
      SEVERITY.WARNING,
      'last_artifact_write_seen_at is in the future; clock skew or corruption',
      'last_artifact_write_seen_at'
    );
  }

  if (
    lgaMs !== null &&
    lawsMs !== null &&
    lawsMs - lgaMs > FRESHNESS_SLACK_MS
  ) {
    addViolation(
      violations,
      CATEGORIES.FRESHNESS,
      SEVERITY.WARNING,
      'Feynman-MINTO is stale: last artifact write seen ' +
        Math.round((lawsMs - lgaMs) / 60000) +
        ' minutes after last regen',
      'last_generated_at'
    );
  }

  // --- reasoning_health_score range ---
  if ('reasoning_health_score' in fm) {
    const rhsRaw = fm.reasoning_health_score;
    const rhs =
      typeof rhsRaw === 'string'
        ? (rhsRaw === 'null' ? null : Number(rhsRaw))
        : rhsRaw;
    if (rhs !== null && rhs !== undefined) {
      if (!Number.isFinite(rhs) || rhs < 0 || rhs > 1) {
        addViolation(
          violations,
          CATEGORIES.SCHEMA,
          SEVERITY.ERROR,
          'reasoning_health_score out of [0,1] range: ' + rhsRaw,
          'reasoning_health_score'
        );
      }
    }
  }

  // --- decision_log checks ---
  if ('decision_log' in fm && Array.isArray(fm.decision_log)) {
    const dl = fm.decision_log;
    if (dl.length > MAX_DECISION_LOG) {
      addViolation(
        violations,
        CATEGORIES.SCHEMA,
        SEVERITY.WARNING,
        'decision_log length ' +
          dl.length +
          ' exceeds cap ' +
          MAX_DECISION_LOG +
          '; 88-10 archival expected',
        'decision_log'
      );
    }
    for (let i = 0; i < dl.length; i++) {
      const entry = dl[i];
      if (!entry || typeof entry !== 'object') {
        addViolation(
          violations,
          CATEGORIES.SCHEMA,
          SEVERITY.ERROR,
          'decision_log entry ' + i + ' is not an object',
          'decision_log[' + i + ']'
        );
        continue;
      }
      if (
        typeof entry.session_id !== 'string' ||
        entry.session_id.length === 0
      ) {
        addViolation(
          violations,
          CATEGORIES.SCHEMA,
          SEVERITY.ERROR,
          'decision_log entry ' + i + ' missing session_id',
          'decision_log[' + i + '].session_id'
        );
      }
      if (
        'user_response' in entry &&
        VALID_USER_RESPONSES.indexOf(entry.user_response) === -1
      ) {
        addViolation(
          violations,
          CATEGORIES.SCHEMA,
          SEVERITY.ERROR,
          'decision_log entry ' +
            i +
            ' user_response "' +
            entry.user_response +
            '" not in [approve, reject, defer]',
          'decision_log[' + i + '].user_response'
        );
      }
    }
  }

  // --- cross_refs wikilink syntax ---
  if ('cross_refs' in fm && Array.isArray(fm.cross_refs)) {
    for (let i = 0; i < fm.cross_refs.length; i++) {
      const xr = fm.cross_refs[i];
      if (typeof xr !== 'string' || !WIKILINK_RE.test(xr)) {
        addViolation(
          violations,
          CATEGORIES.COHERENCE,
          SEVERITY.WARNING,
          'cross_refs[' + i + '] is not [[wikilink]] syntax: ' + String(xr),
          'cross_refs[' + i + ']'
        );
      }
    }
  }

  // --- em-dash detection across narrative string fields + body ---
  const scanForDash = [];
  if (typeof fm.governing_thought === 'string') {
    scanForDash.push({ k: 'governing_thought', v: fm.governing_thought });
  }
  if (Array.isArray(fm.key_claims)) {
    fm.key_claims.forEach(function (c, i) {
      if (typeof c === 'string') {
        scanForDash.push({ k: 'key_claims[' + i + ']', v: c });
      }
    });
  }
  if (Array.isArray(fm.mece_arguments)) {
    fm.mece_arguments.forEach(function (c, i) {
      if (typeof c === 'string') {
        scanForDash.push({ k: 'mece_arguments[' + i + ']', v: c });
      }
    });
  }
  scanForDash.push({ k: 'body', v: body });

  let dashHit = false;
  for (const entry of scanForDash) {
    if (EMDASH_RE.test(entry.v)) {
      addViolation(
        violations,
        CATEGORIES.COHERENCE,
        SEVERITY.WARNING,
        'em-dash or en-dash found in ' +
          entry.k +
          ' (project hard rule: use hyphens instead)',
        entry.k
      );
      dashHit = true;
      // Keep scanning so consumers see every location; limit by bailing
      // after ten to avoid pathological noise.
      if (violations.filter((v) => v.category === CATEGORIES.COHERENCE).length > 10) break;
    }
  }
  // dashHit used only to silence lint if added later; keep reference alive.
  void dashHit;

  // --- Aggregate severity ---
  const severity = aggregateSeverity(violations);
  const valid = violations.length === 0;

  return {
    valid: valid,
    violations: violations,
    severity: severity,
  };
}

module.exports = { validate, SEVERITY, CATEGORIES };
