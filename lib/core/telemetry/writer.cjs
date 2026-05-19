/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121-00 -- unified trajectory-telemetry writer (THE chokepoint).
 *
 * Per Canon Part 9 (Memory Locality + single chokepoint pattern, mirroring
 * navigation.cjs), every downstream capture point in Phase 121-02 and 121-03
 * MUST emit through this module. The Phase 118 lib/core/mva-telemetry.cjs is
 * the architectural ancestor; this writer copies its shape verbatim and
 * extends with:
 *   - broader EVENT_TYPES dispatch (15 in v1, frozen)
 *   - ISO-week rotation: events-YYYY-WNN.jsonl with zero-padded week
 *   - per-row schema_version (Number 1) per D-10
 *   - Canon Part 8 emit-time validator (validator.cjs) as the constitutional
 *     gate; rejected payloads throw with code = 'TELEMETRY_VALIDATION'
 *
 * Atomic JSONL append via fs.appendFileSync. POSIX append semantics guarantee
 * atomicity for writes within PIPE_BUF (4096 bytes on Linux); our lines are
 * well below that limit. Disk errors are swallowed silently: the pipeline
 * must never crash because telemetry storage is unavailable (best-effort
 * observability per D-12).
 *
 * Zero network surface. Zero new runtime dependencies. Pure CJS, node
 * built-ins only.
 *
 * Public API (exported):
 *   emit(eventType, payload)      -- the chokepoint. Throws on validation breach.
 *   telemetryDir()                -- ~/.mindrian/telemetry/v1.13/
 *   telemetryFile(date?)          -- dir + isoWeekFilename(date or now)
 *   isoWeekFilename(date)         -- pure helper: events-YYYY-WNN.jsonl
 *   EVENT_TYPES                   -- re-export from schema.cjs
 *   ALLOWED_FIELDS                -- re-export from schema.cjs
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { validateEventPayload } = require('./validator.cjs');
const {
  EVENT_TYPES,
  ALLOWED_FIELDS,
  SCHEMA_VERSION,
  MAX_STRING_LEN,
} = require('./schema.cjs');

// ---------- Path resolvers (env-aware for hermetic testing) ----------

function homeDir() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

function telemetryDir() {
  return path.join(homeDir(), '.mindrian', 'telemetry', 'v1.13');
}

// ---------- ISO-8601 week computation ----------
//
// Monday-start. Week 1 of a year is the week containing the first Thursday.
// Algorithm: shift the date to the Thursday of its week, then count weeks
// from the year-start of that shifted date. The shift moves Jan 1 of a year
// whose Jan 1 is Mon/Tue/Wed/Thu into the same year, and Fri/Sat/Sun into
// the previous year (since W52/W53 of the previous year owns those days).
//
// Year is taken from the shifted Thursday, not the input date -- this is
// what makes 2025-12-30 (a Tuesday) correctly belong to 2026-W01.

function isoWeekFilename(date) {
  // Strip to UTC midnight to keep the math deterministic across TZs.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Shift to the Thursday of this ISO week.
  // getUTCDay(): Sunday=0..Saturday=6. ISO: Monday=1..Sunday=7.
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  // Year-start of the year that owns the shifted Thursday.
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Week number = ceil(daysFromYearStart / 7) (the +1 accounts for the
  // day-zero offset; the /86400000 converts ms to days).
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  const wnn = String(weekNum).padStart(2, '0');
  return `events-${d.getUTCFullYear()}-W${wnn}.jsonl`;
}

function telemetryFile(date) {
  return path.join(telemetryDir(), isoWeekFilename(date || new Date()));
}

// ---------- Public emit() chokepoint ----------
/**
 * emit(event, payload) -> void
 *
 * Validates first against the frozen v1 schema + Canon Part 8 forbidden
 * patterns (validator.cjs). On valid payload, builds the record and
 * atomically appends one JSONL line to the current ISO-week file.
 *
 * Record shape:
 *   {
 *     event:           <string> (one of EVENT_TYPES)
 *     schema_version:  1        (Number, D-10)
 *     timestamp:       <ISO-8601 string>
 *     session_id:      <string> (process.env.CLAUDE_SESSION_ID or 'default')
 *     ...payload (keys per ALLOWED_FIELDS[event])
 *   }
 *
 * Failure modes:
 *   - Invalid payload: throws Error with .code = 'TELEMETRY_VALIDATION'.
 *   - Disk write failure (mkdir / appendFileSync): swallowed silently.
 *     Per D-12 silent observability, telemetry must never crash the
 *     pipeline whose trajectory it is observing.
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
      schema_version: SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
      session_id: (typeof process.env.CLAUDE_SESSION_ID === 'string' && process.env.CLAUDE_SESSION_ID.length > 0)
        ? process.env.CLAUDE_SESSION_ID.slice(0, MAX_STRING_LEN)
        : 'default',
    },
    payload
  );

  try {
    fs.mkdirSync(telemetryDir(), { recursive: true });
    fs.appendFileSync(telemetryFile(), JSON.stringify(record) + '\n', 'utf8');
  } catch (_e) {
    // Best-effort. The pipeline must not crash because telemetry storage is
    // unavailable. Per D-12, telemetry is a lab-side concern observed via
    // post-hoc tail reads, not a runtime contract.
  }
}

module.exports = { emit, telemetryDir, telemetryFile, isoWeekFilename, EVENT_TYPES, ALLOWED_FIELDS };
