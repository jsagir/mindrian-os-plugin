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
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(s)) {
      throw new ExternalEgressViolation(
        'forbidden pattern in query string for surface ' + surfaceTag,
        {
          surface: surfaceTag,
          matched_pattern: re.source,
          sample: s.slice(0, SAMPLE_MAX),
        }
      );
    }
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
    json = JSON.stringify(obj);
  } catch (err) {
    throw new TypeError('auditQueryObject: input not JSON-serializable: ' + err.message);
  }
  for (const re of FORBIDDEN_PATTERNS) {
    if (re.test(json)) {
      throw new ExternalEgressViolation(
        'forbidden pattern in query object for surface ' + surfaceTag,
        {
          surface: surfaceTag,
          matched_pattern: re.source,
        }
      );
    }
  }
  return obj;
}

// ---------- Exports ----------

module.exports = {
  FORBIDDEN_PATTERNS,
  auditQueryString,
  auditQueryObject,
};
