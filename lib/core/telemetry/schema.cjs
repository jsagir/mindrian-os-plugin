/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121-00 -- frozen v1 telemetry schema.
 *
 * Source of truth for the unified trajectory-telemetry stream at
 *   ~/.mindrian/telemetry/v1.13/events-YYYY-WNN.jsonl
 *
 * Per Canon D-10 (frozen v1 schema with per-row schema_version):
 *   - EVENT_TYPES is Object.frozen and locked at 15 entries for v1.
 *   - ALLOWED_FIELDS is a frozen, per-event whitelist of scalar field names.
 *   - SCHEMA_VERSION is a literal Number (not String) so consumers can
 *     dispatch on version with a strict-equal check.
 *   - Future structural changes ship as SCHEMA_VERSION 2 events that
 *     coexist in the same JSONL stream; v1 stays additive-only.
 *
 * Per Canon Part 8 (Graph Boundary):
 *   - String-length caps prevent raw artifact bytes from sneaking through
 *     allowed fields. emit() applies them; this module declares them.
 *   - The 9 net-new event types (D-04..D-09) only allow scalar fields:
 *     hashes (sha256), enum strings, counts, scores, timestamps.
 *     There is no field on any event that intentionally carries free-text.
 *
 * Inheritance: the 6 mva.* event types mirror lib/core/mva-telemetry.cjs
 * ALLOWED_FIELDS verbatim. Per D-08, mva-telemetry.cjs becomes a thin shim
 * delegating to the unified writer in a downstream plan; v1 keeps both
 * call paths byte-identical on the wire so the shim is a no-op cut-over.
 *
 * Pure CJS, node built-ins only. Zero runtime deps. Zero network surface.
 */
'use strict';

// ---------- Frozen v1 schema version ----------

const SCHEMA_VERSION = 1;

// ---------- Frozen invariants (15 event types) ----------

const EVENT_TYPES = Object.freeze([
  // 6 inherited from lib/core/mva-telemetry.cjs (Phase 118):
  'mva_pipeline_started',
  'mva_agent_returned',
  'mva_brief_rendered',
  'mva_option_selected',
  'mva_brief_deployed',
  'mva_pipeline_failed',
  // 9 net-new for the unified Phase 121 surface (D-04..D-09):
  'selector_pick',         // D-04: F-shape selector picks (88.2 + 125 ranker)
  'tension_engagement',    // D-05: tension hook user response (116)
  'auto_explore_decision', // D-06: auto-explore acceptance (117)
  'breakthrough_dismissed',// D-07: F.7 + ethics-tier dismissal (120)
  'hooked_axis_score',     // D-08: Hooked axis re-score (117 scripts)
  'empathy_observation',   // D-09: empathy audit harness observation
  'room_receipt_written',  // D-09: room-as-receipt write (119)
  'command_invocation',    // D-09: PostToolUse /mos:* sweep
  'nav_bypass',            // D-09: navigation.cjs bypass migration source
]);

// ---------- Per-event ALLOWED_FIELDS (frozen arrays) ----------
//
// Every entry is a closed whitelist. emit() rejects any payload key that is
// not in this list. Adding a field to v1 requires:
//   1. amending this list (additive only)
//   2. a Canon Part 8 review of the new field
//   3. matching frontmatter update in the consuming plan's CONTEXT.md
// Structural changes (renaming, removing, re-typing a field) require a
// SCHEMA_VERSION bump to 2 + a separate plan that introduces the v2 event.
//
// Field-naming convention:
//   *_sha256        -- 64-char hex hash, exempt from raw-hex detector
//   *_hash          -- shorter hash (8-32 chars), also hash-class
//   *_score         -- numeric, no length cap concern
//   ttr_seconds     -- numeric (time-to-response in seconds)
//   ranker_*        -- 125-ranker outputs (numeric)
//   *_response      -- enum string (kept / redid / ignored / resolve / defer / ignore)
//   *_count         -- non-negative integer

const ALLOWED_FIELDS = Object.freeze({
  // ----- 6 inherited mva.* (must mirror lib/core/mva-telemetry.cjs verbatim) -----
  mva_pipeline_started: Object.freeze(['sentence_sha256']),
  mva_agent_returned:   Object.freeze(['sentence_sha256', 'agent_id', 'duration_ms', 'status', 'error_short']),
  mva_brief_rendered:   Object.freeze(['sentence_sha256', 'total_duration_ms', 'agent_count_ok', 'agent_count_failed']),
  mva_option_selected:  Object.freeze(['sentence_sha256', 'option_id', 'time_to_click_ms']),
  mva_brief_deployed:   Object.freeze(['sentence_sha256', 'vercel_subdomain_hash', 'deploy_duration_ms', 'status', 'error_short']),
  mva_pipeline_failed:  Object.freeze(['sentence_sha256', 'total_duration_ms', 'error_short']),

  // ----- 9 net-new (D-04..D-09) -----
  selector_pick: Object.freeze([
    'sub_shape',             // enum: 'F.0' | 'F.1' | 'F.2' | 'F.3' | 'F.4' | 'F.5' | 'F.6' | 'F.7'
    'mode',                  // enum: 'A' (Brain reachable) | 'B' (Local Only) | 'Tier 0'
    'ranker_confidence',     // number 0..1 (125-ranker confidence for picked option)
    'recommended_rendered',  // boolean (RECOMMENDED marker was shown)
    'options_count',         // integer
    'room_slug_sha256',      // 64-char sha256
    'verb_chosen',           // enum (closed verb vocab, one of the 10 canonical verbs)
  ]),
  tension_engagement: Object.freeze([
    'tension_type',          // enum: 'contradicts' | 'converges' | 'invalidates'
    'user_response',         // enum: 'resolve' | 'defer' | 'ignore'
    'ttr_seconds',           // number (time-to-response)
    'room_slug_sha256',      // 64-char sha256
    'context_hash',          // shorter hash (16 chars) tying back to surfaced context
  ]),
  auto_explore_decision: Object.freeze([
    'finding_type',          // enum: 'whitespace' | 'reverse_salient' | 'cross_domain_match'
    'user_response',         // enum: 'kept' | 'redid' | 'ignored'
    'domain_match_score',    // number 0..1
    'room_slug_sha256',
  ]),
  breakthrough_dismissed: Object.freeze([
    'detector_type',         // enum (per Phase 120 D-19 detector taxonomy)
    'verb_chosen',           // enum (F.7 verb pick or Free-Text)
    'ethics_tier',           // enum: 'HARD_FLOOR' | 'SOFT_BAND' | 'NEUTRAL' | 'GREEN'
    'voice_audit_pass',      // boolean
    'room_slug_sha256',
  ]),
  hooked_axis_score: Object.freeze([
    'axis_name',             // enum: 'investment' | 'reward' | 'trigger' | 'action'
    'score_value',           // number
    'room_slug_sha256',
    'window_iso_week',       // string 'YYYY-WNN' (ISO week the score window covers)
  ]),
  empathy_observation: Object.freeze([
    'engaged_past_15m',      // boolean
    'handed_back_material',  // boolean
    'returned_within_48h',   // boolean
    'ttr_seconds',           // number
    'tester_id_hash',        // hash (NOT the tester's real ID; per Canon Part 8)
  ]),
  room_receipt_written: Object.freeze([
    'room_slug_sha256',
    'conversation_id_hash',  // hash
    'generated_at_ts',       // number (epoch ms) or ISO string
  ]),
  command_invocation: Object.freeze([
    'command',               // enum string (e.g. '/mos:whitespace', '/mos:think-hats')
    'outcome',               // enum: 'success' | 'error' | 'aborted'
    'duration_ms',           // number
    'context_hash',          // hash
  ]),
  nav_bypass: Object.freeze([
    'op',                    // enum: 'read' | 'write' | 'query'
    'reason',                // enum: 'legacy_path' | 'startup_bootstrap' | 'tooling_only'
    'caller_hash',           // hash (stack-frame-derived identifier; NOT a file path)
    'room_slug_sha256',
  ]),
});

// ---------- String-length caps ----------
//
// MAX_STRING_LEN is the default cap on any string payload value. The two
// other constants are special-cased: sha256 fields must be exactly 64 hex
// characters; error_short is a short error description with its own cap.

const MAX_STRING_LEN = 64;
const MAX_ERROR_SHORT_LEN = 60;
const SHA256_LEN = 64;
const MAX_CONTEXT_HASH_LEN = 16;

module.exports = {
  EVENT_TYPES,
  ALLOWED_FIELDS,
  SCHEMA_VERSION,
  MAX_STRING_LEN,
  MAX_ERROR_SHORT_LEN,
  SHA256_LEN,
  MAX_CONTEXT_HASH_LEN,
};
