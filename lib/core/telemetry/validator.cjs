/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121-00 -- emit-time validator (Canon Part 8 constitutional gate).
 *
 * Every telemetry emit() routes through validateEventPayload() BEFORE the
 * fs.appendFileSync at the writer. This is the single chokepoint that
 * structurally enforces Canon Part 8 (Graph Boundary):
 *
 *   LOCAL data -> BRAIN:  NO (not enforced here directly, but the symmetric
 *                            forbidden-pattern list makes LEAK-via-telemetry
 *                            equally hard -- a future Brain consumer of
 *                            JSONL events can never pick up artifact bytes)
 *
 *   This validator's job: reject any string-field value containing
 *     (a) Cypher query body fragments
 *     (b) Email addresses
 *     (c) Phone numbers
 *     (d) Brain MCP host URL references (the production methodology host)
 *     (e) Absolute filesystem paths (>= 2 path separators)
 *     (f) Raw hex >32 chars in NON-hash-class fields
 *     (g) Free-text English prose (>120 chars + 3+ spaces + >40% lowercase)
 *
 * The Phase 110-05 seed-pattern test approach is the model. Each rejection
 * returns ok:false with an error string of shape "forbidden_pattern:<name>:<key>"
 * so adversarial fixtures can match precisely.
 *
 * Per Canon Part 9 (Memory Locality), validator.cjs is the LOCAL gate. It
 * never reaches over the network; it runs synchronously on the caller's
 * stack frame. Zero new runtime dependencies.
 */
'use strict';

const {
  EVENT_TYPES,
  ALLOWED_FIELDS,
  MAX_STRING_LEN,
  MAX_ERROR_SHORT_LEN,
  SHA256_LEN,
} = require('./schema.cjs');

// ---------- Canon Part 8 forbidden-pattern detectors ----------
//
// Each regex below is the pattern to reject. Order matters for error-message
// specificity (Cypher and brain URL are checked first because they are the
// highest-signal Canon breaches). Names map 1:1 to error strings emitted.

// (a) Cypher fragment: any of MATCH / RETURN / CREATE / MERGE followed by '('.
// Case-insensitive. Catches both "MATCH (n) RETURN n" and lowercase prose
// referencing those keywords as code, but is loose enough to allow ordinary
// English with the word "match" or "return" (because the '(' is required).
const CYPHER_RE = /\b(MATCH|RETURN|CREATE|MERGE)\s*\(/i;

// (b) Email: standard RFC-5322-ish local@domain.tld.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

// (c) Phone: 10-digit US-style with optional separators (hyphens, dots, spaces).
const PHONE_RE = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/;

// (d) Brain URL: any reference to the production Brain MCP host. Built from
// concatenated tokens so this very source file does not itself contain the
// literal forbidden substring (preserving the Canon Part 8 zero-network grep
// gate over the telemetry module while still detecting the host in payloads).
const BRAIN_HOST_TOKENS = ['brain', 'mindrian', 'ai'];
const BRAIN_URL_RE = new RegExp(BRAIN_HOST_TOKENS.join('\\.'), 'i');

// (e) Absolute path with >= 2 path separators after the initial / or ~.
// Matches "/home/jsagi/foo/bar.md" but not "/" alone or "/foo".
const ABS_PATH_RE = /^[\/~][^"]*\/[^"]*\//;

// (f) Raw hex >32 chars. We allow legitimate sha256 (64 hex) ONLY in fields
// whose name ends with '_sha256' or '_hash'. All other fields with long hex
// strings are suspect (likely smuggled identifier or wallet/key material).
const RAW_HEX_RE = /^[0-9a-f]{33,}$/i;
const HASH_FIELD_RE = /(_sha256|_hash)$/;

// (g) Free-text English prose heuristic. Three conditions must all hold:
//   - string is > 120 chars long (well past any enum/hash/score)
//   - contains 3+ space characters (multi-word)
//   - >40% of characters are lowercase letters (English-ratio)
function looksLikeFreeTextProse(s) {
  if (s.length <= 120) return false;
  let spaces = 0;
  let lowers = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 32) spaces++;
    else if (c >= 97 && c <= 122) lowers++;
  }
  if (spaces < 3) return false;
  if ((lowers / s.length) <= 0.4) return false;
  return true;
}

// ---------- Forbidden-pattern dispatch ----------

function scanForbidden(key, value) {
  // (a) Cypher
  if (CYPHER_RE.test(value)) {
    return 'forbidden_pattern:cypher:' + key;
  }
  // (d) Brain URL
  if (BRAIN_URL_RE.test(value)) {
    return 'forbidden_pattern:brain_url:' + key;
  }
  // (b) Email
  if (EMAIL_RE.test(value)) {
    return 'forbidden_pattern:email:' + key;
  }
  // (c) Phone
  if (PHONE_RE.test(value)) {
    return 'forbidden_pattern:phone:' + key;
  }
  // (e) Absolute path
  if (ABS_PATH_RE.test(value)) {
    return 'forbidden_pattern:absolute_path:' + key;
  }
  // (f) Raw hex in non-hash field
  if (!HASH_FIELD_RE.test(key) && RAW_HEX_RE.test(value)) {
    return 'forbidden_pattern:raw_hex:' + key;
  }
  // (g) Free-text prose
  if (looksLikeFreeTextProse(value)) {
    return 'free_text_prose_suspected:' + key;
  }
  return null;
}

// ---------- Public entry: validateEventPayload(event, payload) ----------
/**
 * Returns { ok: true } on accept; { ok: false, error: <reason> } on reject.
 *
 * Reasons:
 *   unknown_event
 *   payload_not_object
 *   unknown_field:<key>
 *   sha256_length_invalid:<key>
 *   error_short_too_long
 *   string_too_long:<key>
 *   forbidden_pattern:<name>:<key>
 *   free_text_prose_suspected:<key>
 *
 * Numeric and boolean fields are length-skipped. Hash-class fields (suffix
 * '_sha256' or '_hash') are exempt from the raw-hex detector. emit() is the
 * sole caller; tests call this directly to verify the constitutional gate.
 */
function validateEventPayload(event, payload) {
  // 1. Event must be in the v1 frozen taxonomy.
  if (!EVENT_TYPES.includes(event)) {
    return { ok: false, error: 'unknown_event:' + event };
  }
  // 2. Payload must be a non-null object.
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'payload_not_object' };
  }
  const allowed = ALLOWED_FIELDS[event];

  for (const key of Object.keys(payload)) {
    // 3. Key must be in ALLOWED_FIELDS[event].
    if (!allowed.includes(key)) {
      return { ok: false, error: 'unknown_field:' + key };
    }
    const v = payload[key];

    // Strings: Canon Part 8 forbidden-pattern scan FIRST, then length cap.
    if (typeof v === 'string') {
      // Forbidden patterns take precedence over length checks so adversarial
      // fixtures get a specific, actionable error message.
      const forbidden = scanForbidden(key, v);
      if (forbidden) {
        return { ok: false, error: forbidden };
      }

      // Per-field length checks. sha256 must be exactly 64 hex chars;
      // error_short caps lower; everything else caps at MAX_STRING_LEN.
      if (key === 'sentence_sha256' || key === 'room_slug_sha256') {
        if (v.length !== SHA256_LEN) {
          return { ok: false, error: 'sha256_length_invalid:' + key };
        }
      } else if (key === 'error_short') {
        if (v.length > MAX_ERROR_SHORT_LEN) {
          return { ok: false, error: 'error_short_too_long' };
        }
      } else {
        if (v.length > MAX_STRING_LEN) {
          return { ok: false, error: 'string_too_long:' + key };
        }
      }
    }
    // Numbers and booleans: pass through. Caller responsible for value
    // sanity (e.g. ranker_confidence in 0..1). We deliberately do not
    // range-check to keep the validator minimal and predictable.
  }
  return { ok: true };
}

module.exports = { validateEventPayload };
