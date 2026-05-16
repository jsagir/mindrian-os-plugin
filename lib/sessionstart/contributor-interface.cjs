/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121.5-00 -- SessionStart Coordinator: contributor-fragment validator.
 *
 * Every SessionStart injector (operator-update, memory-resume-nudge, etc.) returns
 * a ContributorFragment matching exactly this 7-field shape. Extras throw.
 *
 * interface ContributorFragment {
 *   id: string;                 // matches PRECEDENCE_LADDER entry
 *   priority: number;           // 1..11 from precedence ladder
 *   full_payload: string;       // rich additionalContext body
 *   one_line_pointer: string;   // compressed fallback
 *   bytes_full: number;         // Buffer.byteLength(full_payload, 'utf8')
 *   bytes_pointer: number;      // Buffer.byteLength(one_line_pointer, 'utf8')
 *   has_payload: boolean;       // false = coordinator skips
 * }
 *
 * Pure CJS, node built-ins only. Zero new runtime dependencies.
 */
'use strict';

const ALLOWED_FIELDS = Object.freeze([
  'id',
  'priority',
  'full_payload',
  'one_line_pointer',
  'bytes_full',
  'bytes_pointer',
  'has_payload',
]);

const ALLOWED_SET = new Set(ALLOWED_FIELDS);

/**
 * validateFragment(obj) -- throw if shape is wrong; return obj unchanged if OK.
 * Coordinator-isolator catches the throw and isolates the contributor.
 */
function validateFragment(obj) {
  if (obj === null || obj === undefined) {
    throw new Error('contributor_fragment_null');
  }
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error('contributor_fragment_not_object');
  }

  // Reject extras BEFORE the no-payload short-circuit so a bogus extra field
  // is always surfaced as a validation failure (matches Test 7 invariant).
  for (const k of Object.keys(obj)) {
    if (!ALLOWED_SET.has(k)) {
      throw new Error('contributor_fragment_extra_field: ' + k);
    }
  }

  // Allow the minimal "nothing to say" shape: {has_payload: false}. Coordinator
  // filters these out before composing. id/priority remain optional in this case.
  if (obj.has_payload === false) {
    return obj;
  }

  // Full-payload shape: every field required + typed.
  if (typeof obj.id !== 'string' || obj.id.length === 0) {
    throw new Error('contributor_fragment_invalid_id');
  }
  if (!Number.isInteger(obj.priority) || obj.priority < 1 || obj.priority > 11) {
    throw new Error('contributor_fragment_invalid_priority');
  }
  if (typeof obj.full_payload !== 'string') {
    throw new Error('contributor_fragment_invalid_full_payload');
  }
  if (typeof obj.one_line_pointer !== 'string') {
    throw new Error('contributor_fragment_invalid_one_line_pointer');
  }
  if (!Number.isInteger(obj.bytes_full) || obj.bytes_full < 0) {
    throw new Error('contributor_fragment_invalid_bytes_full');
  }
  if (!Number.isInteger(obj.bytes_pointer) || obj.bytes_pointer < 0) {
    throw new Error('contributor_fragment_invalid_bytes_pointer');
  }
  if (obj.has_payload !== true) {
    throw new Error('contributor_fragment_invalid_has_payload');
  }

  // Cross-field consistency: byte counts must match payloads (validator computes).
  const measuredFull = Buffer.byteLength(obj.full_payload, 'utf8');
  if (obj.bytes_full !== measuredFull) {
    throw new Error('contributor_fragment_bytes_full_mismatch: declared=' + obj.bytes_full + ' actual=' + measuredFull);
  }
  const measuredPointer = Buffer.byteLength(obj.one_line_pointer, 'utf8');
  if (obj.bytes_pointer !== measuredPointer) {
    throw new Error('contributor_fragment_bytes_pointer_mismatch: declared=' + obj.bytes_pointer + ' actual=' + measuredPointer);
  }

  // Test 7 invariant: has_payload=true AND bytes_full=0 is rejected.
  if (obj.has_payload === true && obj.bytes_full === 0) {
    throw new Error('contributor_fragment_empty_full_payload_with_payload_flag');
  }

  return obj;
}

/**
 * makeFragment({id, priority, full_payload, one_line_pointer}) -- convenience
 * builder that computes the byte counts and sets has_payload:true. Used by
 * the 9 refactored injectors so they don't recompute byte lengths inline.
 */
function makeFragment(opts) {
  const o = opts || {};
  const full = typeof o.full_payload === 'string' ? o.full_payload : '';
  const pointer = typeof o.one_line_pointer === 'string' ? o.one_line_pointer : '';
  return {
    id: o.id,
    priority: o.priority,
    full_payload: full,
    one_line_pointer: pointer,
    bytes_full: Buffer.byteLength(full, 'utf8'),
    bytes_pointer: Buffer.byteLength(pointer, 'utf8'),
    has_payload: true,
  };
}

/**
 * emptyFragment() -- the canonical "nothing to say" return. Coordinator filters.
 */
function emptyFragment() {
  return { has_payload: false };
}

module.exports = {
  ALLOWED_FIELDS,
  validateFragment,
  makeFragment,
  emptyFragment,
};
