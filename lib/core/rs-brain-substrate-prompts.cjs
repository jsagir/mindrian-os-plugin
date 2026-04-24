/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.1a Plan 01 -- substrate query prompt allow-list.
 *
 * Frozen vocabulary + validateCtx + FORBIDDEN_PATTERNS re-export.
 * This module is the SECOND layer of the Phase 89.1a Canon Part 8
 * chokepoint (first layer is buildBrainSubstrateQuery in
 * rs-brain-substrate.cjs). validateCtx is called at the top of
 * buildBrainSubstrateQuery and any consumer extension.
 *
 * Pure CJS, zero npm deps. Re-exports FORBIDDEN_PATTERNS from
 * lib/core/cross-room-aggregator.cjs byte-for-byte to avoid drift
 * (per Phase 90-08 A1 sweep design).
 */
'use strict';

const crossRoomAggregator = require('./cross-room-aggregator.cjs');

// ---------- Frozen vocabulary ----------

const ALLOWED_CTX_KEYS = Object.freeze([
  'framework_ids',   // string[] each matching SLUG_REGEX
  'phase_ids',       // string[] each matching SLUG_REGEX
  'problem_types',   // string[] each in PROBLEM_TYPE_ENUM
  'domains',         // string[] each matching SLUG_REGEX
  'namespace',       // string one of NAMESPACE_ENUM
  'limit',           // integer in [1, 10000]
]);

const PROBLEM_TYPE_ENUM = Object.freeze(['udp', 'idp', 'wdp', 'wicked']);

const NAMESPACE_ENUM = Object.freeze(['core', 'tools', 'reference', 'materials', 'graphrag']);

const SLUG_REGEX = /^[a-z0-9_-]{1,64}$/;

const LIMIT_MIN = 1;
const LIMIT_MAX = 10000;

const PROMPT_VERSION = 1;

// FORBIDDEN_PATTERNS is re-exported BYTE-FOR-BYTE from cross-room-aggregator.
// The aggregator is the Canon authoritative source (Phase 90-06 lines 87-94).
// Re-exporting (instead of redefining) eliminates drift risk: one update site,
// one truth. Defensive guard at require-time so refactors are loud, not silent.
const FORBIDDEN_PATTERNS = crossRoomAggregator.FORBIDDEN_PATTERNS;
if (!Array.isArray(FORBIDDEN_PATTERNS) || FORBIDDEN_PATTERNS.length < 6) {
  throw new Error(
    'rs-brain-substrate-prompts: FORBIDDEN_PATTERNS re-export failed; ' +
    'Canon Part 8 drift risk (expected >= 6 patterns from cross-room-aggregator)'
  );
}

// ---------- validateCtx (the Canon Part 8 chokepoint allow-list) ----------
//
// Throws TypeError on any violation. Never returns a boolean. Callers rely on
// the throw so a silent false-return cannot smuggle user-specific bytes past
// buildBrainSubstrateQuery.

function validateCtx(ctx) {
  if (!ctx || typeof ctx !== 'object' || Array.isArray(ctx)) {
    throw new TypeError('validateCtx: ctx must be a plain object');
  }
  for (const key of Object.keys(ctx)) {
    if (!ALLOWED_CTX_KEYS.includes(key)) {
      throw new TypeError('validateCtx: forbidden ctx key: ' + key);
    }
  }
  // framework_ids / phase_ids / domains: optional string[] of slug-safe values
  for (const listKey of ['framework_ids', 'phase_ids', 'domains']) {
    if (ctx[listKey] === undefined) continue;
    if (!Array.isArray(ctx[listKey])) {
      throw new TypeError('validateCtx: ' + listKey + ' must be array');
    }
    for (const v of ctx[listKey]) {
      if (typeof v !== 'string' || !SLUG_REGEX.test(v)) {
        throw new TypeError(
          'validateCtx: ' + listKey + ' value fails slug regex: ' +
          String(v).slice(0, 80)
        );
      }
    }
  }
  // problem_types: optional string[] of enum values
  if (ctx.problem_types !== undefined) {
    if (!Array.isArray(ctx.problem_types)) {
      throw new TypeError('validateCtx: problem_types must be array');
    }
    for (const v of ctx.problem_types) {
      if (!PROBLEM_TYPE_ENUM.includes(v)) {
        throw new TypeError(
          'validateCtx: problem_types value not in enum: ' +
          String(v).slice(0, 80)
        );
      }
    }
  }
  // namespace: optional enum scalar
  if (ctx.namespace !== undefined) {
    if (typeof ctx.namespace !== 'string' || !NAMESPACE_ENUM.includes(ctx.namespace)) {
      throw new TypeError(
        'validateCtx: namespace not in enum: ' +
        String(ctx.namespace).slice(0, 80)
      );
    }
  }
  // limit: optional integer in range
  if (ctx.limit !== undefined) {
    if (!Number.isInteger(ctx.limit) || ctx.limit < LIMIT_MIN || ctx.limit > LIMIT_MAX) {
      throw new TypeError(
        'validateCtx: limit out of range [' + LIMIT_MIN + ',' + LIMIT_MAX + ']: ' +
        String(ctx.limit)
      );
    }
  }
}

// ---------- Exports ----------

module.exports = {
  ALLOWED_CTX_KEYS,
  PROBLEM_TYPE_ENUM,
  NAMESPACE_ENUM,
  SLUG_REGEX,
  FORBIDDEN_PATTERNS,
  PROMPT_VERSION,
  LIMIT_MIN,
  LIMIT_MAX,
  validateCtx,
};
