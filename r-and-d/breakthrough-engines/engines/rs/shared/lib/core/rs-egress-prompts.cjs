/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 01 -- egress prompts allow-list + audit helpers.
 *
 * The Canon Part 8 chokepoint shared by every Wave-2 fetcher
 * (academic, patents, industry). Two helpers:
 *
 *   auditQueryString(s, surface)
 *     -- scans a single outbound string against FORBIDDEN_PATTERNS;
 *        throws ExternalEgressViolation on hit; returns input on pass.
 *
 *   auditQueryObject(obj, surface)
 *     -- JSON.stringify scans a structured outbound payload (query
 *        params, request body) against FORBIDDEN_PATTERNS; throws on hit;
 *        returns input on pass. Defense-in-depth so adversarial payloads
 *        nested inside objects (meta.contact, headers.authorization, etc.)
 *        cannot smuggle past per-field scrub.
 *
 * Re-exports FORBIDDEN_PATTERNS from lib/core/cross-room-aggregator.cjs
 * BYTE-FOR-BYTE so any Canon amendment to the authoritative source is
 * felt here with zero code change. Defensive guard at require-time so
 * refactors are loud, not silent (mirrors 89.1a rs-brain-substrate-prompts
 * pattern).
 *
 * Pure CJS, zero npm deps, no Node built-ins beyond core require.
 */
'use strict';

const crypto = require('node:crypto');
const crossRoomAggregator = require('./cross-room-aggregator.cjs');
const { ExternalEgressViolation } = require('./rs-egress-violations.cjs');

// FORBIDDEN_PATTERNS is re-exported BYTE-FOR-BYTE from cross-room-aggregator.
// The aggregator is the Canon authoritative source (lines 87-94). Re-exporting
// (instead of redefining) eliminates drift risk: one update site, one truth.
// Defensive guard at require-time so refactors are loud, not silent.
const FORBIDDEN_PATTERNS = crossRoomAggregator.FORBIDDEN_PATTERNS;
if (!Array.isArray(FORBIDDEN_PATTERNS) || FORBIDDEN_PATTERNS.length < 6) {
  throw new Error(
    'rs-egress-prompts: FORBIDDEN_PATTERNS re-export failed; ' +
    'Canon Part 8 drift risk (expected >= 6 patterns from cross-room-aggregator)'
  );
}

const SAMPLE_MAX = 40;

// ---------- 2026 hardening helpers ----------
//
// 1. STATEFUL REGEX. If any FORBIDDEN_PATTERNS entry carries the g or y flag,
//    RegExp.prototype.test() keeps lastIndex between calls, so the same regex
//    can MISS a match on the next string (a silent egress-check bypass). Every
//    scan below resets lastIndex before and after the test.
// 2. EVASION VARIANTS. A pattern written for plain text is bypassed by zero-width
//    or soft-hyphen characters inside the token, by full-width / compatibility
//    forms, and by percent-encoding. The audit therefore scans the original
//    string AND an NFKC-normalised, invisible-character-stripped form AND a
//    percent-decoded form. Extra variants can only add detections.
// 3. Map / Set values serialise to {} under JSON.stringify and would have been
//    invisible to auditQueryObject; the replacer below expands them. BigInt no
//    longer throws.
// 4. The violation's meta.sample echoed up to 40 characters of the forbidden
//    text into logs and stack traces. Set MINDRIAN_EGRESS_REDACT_SAMPLE=1 to
//    replace the sample with a short hash (meta.sample_sha256 is always added).

const INVISIBLES = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

function _variants(s) {
  const out = [s];
  let n = s;
  try { n = s.normalize('NFKC'); } catch (_e) { n = s; }
  n = n.replace(INVISIBLES, '');
  if (n !== s) out.push(n);
  if (s.indexOf('%') !== -1) {
    try {
      const d = decodeURIComponent(s);
      if (d !== s) out.push(d.normalize('NFKC').replace(INVISIBLES, ''));
    } catch (_e) { /* malformed escape: the raw scan above still applies */ }
  }
  return out;
}

// Returns the first matching RegExp or null. Never throws.
function findForbidden(s) {
  if (typeof s !== 'string' || s.length === 0) return null;
  const variants = _variants(s);
  for (let v = 0; v < variants.length; v += 1) {
    for (const re of FORBIDDEN_PATTERNS) {
      re.lastIndex = 0;
      const hit = re.test(variants[v]);
      re.lastIndex = 0;
      if (hit) return re;
    }
  }
  return null;
}

function _sampleMeta(s) {
  const redact = process.env.MINDRIAN_EGRESS_REDACT_SAMPLE === '1';
  const sha = crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
  return redact
    ? { sample: '[redacted]', sample_sha256: sha }
    : { sample: s.slice(0, SAMPLE_MAX), sample_sha256: sha };
}

function _replacer(_key, value) {
  if (value instanceof Map) return Array.from(value.entries());
  if (value instanceof Set) return Array.from(value.values());
  if (typeof value === 'bigint') return value.toString();
  return value;
}

// ---------- auditQueryString ----------
//
// Pre-egress audit on a single outbound string. The chokepoint every
// fetcher MUST call before any fetch() invocation. Throws on any
// FORBIDDEN_PATTERNS hit; returns input on pass for callsite chaining.

function auditQueryString(s, surface) {
  if (typeof s !== 'string') {
    throw new TypeError('auditQueryString: input must be a string; got ' + typeof s);
  }
  const surfaceTag = (typeof surface === 'string' && surface.length > 0) ? surface : 'unknown';
  const hitRe = findForbidden(s);
  if (hitRe) {
    throw new ExternalEgressViolation(
      'forbidden pattern in query string for surface ' + surfaceTag,
      Object.assign({
        surface: surfaceTag,
        matched_pattern: hitRe.source,
      }, _sampleMeta(s))
    );
  }
  return s;
}

// ---------- auditQueryObject ----------
//
// Pre-egress audit on a structured outbound payload. JSON.stringify
// flattens nested fields so adversarial content tucked inside meta /
// headers / params surfaces gets caught. Throws on hit; returns input
// on pass.

function auditQueryObject(obj, surface) {
  if (obj === null || obj === undefined) {
    throw new TypeError('auditQueryObject: input must be a non-null object');
  }
  if (typeof obj !== 'object') {
    throw new TypeError('auditQueryObject: input must be an object; got ' + typeof obj);
  }
  const surfaceTag = (typeof surface === 'string' && surface.length > 0) ? surface : 'unknown';
  let json;
  try {
    json = JSON.stringify(obj, _replacer);
  } catch (err) {
    throw new TypeError('auditQueryObject: input not JSON-serializable: ' + err.message);
  }
  const hitRe = findForbidden(json);
  if (hitRe) {
    throw new ExternalEgressViolation(
      'forbidden pattern in query object for surface ' + surfaceTag,
      {
        surface: surfaceTag,
        matched_pattern: hitRe.source,
      }
    );
  }
  return obj;
}

// ---------- Exports ----------

module.exports = {
  FORBIDDEN_PATTERNS,
  auditQueryString,
  auditQueryObject,
  // 2026 addition: stateless-regex scan shared by the other rs-* modules.
  findForbidden,
};
