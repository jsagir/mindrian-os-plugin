/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-03 Plan 03 -- mva-telemetry.
 *
 * JSONL writer for the 6 Phase 121 MVA event types. Atomic append to
 * ~/.mindrian/telemetry/v1.13/mva.jsonl. Schema-enforced (rejects events
 * with raw user content; per-event ALLOWED_FIELDS is the source of truth
 * for Plan 118-06's Dror harness grep test).
 *
 * Per Plan 118-03 OQ8 (resolved): the 6 event types are
 *   mva_pipeline_started, mva_agent_returned, mva_brief_rendered,
 *   mva_option_selected, mva_brief_deployed, mva_pipeline_failed.
 *
 * CRITICAL invariant (WARN-2 from iteration 2): the mva_brief_rendered
 * event uses `total_duration_ms` (NOT `duration_ms`). Plan 118-06's
 * Dror harness greps ALLOWED_FIELDS.mva_brief_rendered to assert this.
 *
 * Canon Part 8 (LOCAL telemetry):
 *   - Sentence-related identifier is sentence_sha256 ONLY (one-way hash).
 *   - Every string field is capped (sentence_sha256=64 exact, error_short<=60,
 *     other strings<=64) to prevent raw user content from sneaking through.
 *   - Fields not in ALLOWED_FIELDS for the event type are rejected.
 *
 * Atomic append: fs.appendFileSync writes a single short line. POSIX
 * append semantics guarantee atomicity for writes within PIPE_BUF (4096
 * bytes on Linux). Our lines are < 512 bytes, well below the limit.
 *
 * Pure CJS, node built-ins only.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// ---------- Frozen invariants ----------

const EVENT_TYPES = Object.freeze([
  'mva_pipeline_started',
  'mva_agent_returned',
  'mva_brief_rendered',
  'mva_option_selected',
  'mva_brief_deployed',
  'mva_pipeline_failed'
]);

// Per-event scalar field schema. Source-of-truth for Plan 118-06 Dror harness.
// CRITICAL: mva_brief_rendered uses 'total_duration_ms' (NOT 'duration_ms').
const ALLOWED_FIELDS = Object.freeze({
  mva_pipeline_started: Object.freeze(['sentence_sha256']),
  mva_agent_returned:   Object.freeze(['sentence_sha256', 'agent_id', 'duration_ms', 'status', 'error_short']),
  mva_brief_rendered:   Object.freeze(['sentence_sha256', 'total_duration_ms', 'agent_count_ok', 'agent_count_failed']),
  mva_option_selected:  Object.freeze(['sentence_sha256', 'option_id', 'time_to_click_ms']),
  mva_brief_deployed:   Object.freeze(['sentence_sha256', 'vercel_subdomain_hash', 'deploy_duration_ms', 'status', 'error_short']),
  mva_pipeline_failed:  Object.freeze(['sentence_sha256', 'total_duration_ms', 'error_short'])
});

// String-length caps. error_short is special-cased to <= 60.
// sentence_sha256 must be exactly 64 hex chars.
const MAX_STRING_LEN = 64;
const MAX_ERROR_SHORT_LEN = 60;
const SHA256_LEN = 64;

// ---------- Path resolvers (env-aware for hermetic testing) ----------

function homeDir() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

function telemetryDir() {
  return path.join(homeDir(), '.mindrian', 'telemetry', 'v1.13');
}

function telemetryFile() {
  return path.join(telemetryDir(), 'mva.jsonl');
}

// ---------- Validation ----------

/**
 * validateEventPayload(event, payload) -> { ok: boolean, error?: string }
 *
 * Returns ok:false if:
 *   - event is not in EVENT_TYPES
 *   - any key in payload is not in ALLOWED_FIELDS[event]
 *   - any string value violates the per-field length cap
 *
 * Numeric fields are not length-checked. The session_id field is added
 * by emit() (not the caller), so it is not validated against ALLOWED_FIELDS.
 */
function validateEventPayload(event, payload) {
  if (!EVENT_TYPES.includes(event)) {
    return { ok: false, error: 'unknown_event' };
  }
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'payload_not_object' };
  }
  const allowed = ALLOWED_FIELDS[event];
  for (const key of Object.keys(payload)) {
    if (!allowed.includes(key)) {
      return { ok: false, error: 'unknown_field:' + key };
    }
    const v = payload[key];
    if (typeof v === 'string') {
      if (key === 'sentence_sha256') {
        if (v.length !== SHA256_LEN) {
          return { ok: false, error: 'sha256_length_invalid' };
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
  }
  return { ok: true };
}

// ---------- Public emit() ----------

/**
 * emit(event, payload) -> appends one JSONL line to ~/.mindrian/telemetry/v1.13/mva.jsonl
 *
 * Validates first. On invalid payload throws a ValidationError (so callers
 * cannot silently leak). On disk error returns silently (best-effort: the
 * pipeline must not crash because telemetry is unavailable).
 */
function emit(event, payload) {
  const v = validateEventPayload(event, payload);
  if (!v.ok) {
    const e = new Error('telemetry validation failed: ' + v.error);
    e.code = 'TELEMETRY_VALIDATION';
    throw e;
  }

  const record = Object.assign(
    {
      event: event,
      timestamp: new Date().toISOString(),
      session_id: (typeof process.env.CLAUDE_SESSION_ID === 'string' && process.env.CLAUDE_SESSION_ID.length > 0)
        ? process.env.CLAUDE_SESSION_ID.slice(0, MAX_STRING_LEN)
        : 'default'
    },
    payload
  );

  try {
    fs.mkdirSync(telemetryDir(), { recursive: true });
    fs.appendFileSync(telemetryFile(), JSON.stringify(record) + '\n', 'utf8');
  } catch (_e) {
    // Best-effort. The MVA pipeline must not fail because telemetry disk
    // is unavailable. Plan 118-06's Dror harness checks for the file's
    // existence post-run as the success signal.
  }
}

module.exports = {
  emit,
  validateEventPayload,
  EVENT_TYPES,
  ALLOWED_FIELDS,
  // Exposed for tests + downstream plans that need the canonical path
  telemetryDir,
  telemetryFile,
};
