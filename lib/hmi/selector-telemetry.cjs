/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.2-03 -- selector telemetry emitter (UISEL-88.2-06 part 1).
 *
 * Substrate that every Phase 88.2 sub-shape (F.1-F.5) calls into when a
 * selector is presented and when the navigator responds.
 *
 * Three event surfaces (all LOCAL):
 *
 *   recordPresentation(roomDir, record) -- called when a Shape F selector
 *     is rendered. Emits one JSONL line with {ts, event:'presentation',
 *     room_slug_sha256, sub_shape, mode, options_count, recommended_present,
 *     operator?}.
 *
 *   recordResponse(roomDir, record) -- called when the navigator picks an
 *     option. Emits one JSONL line with {ts, event:'response',
 *     room_slug_sha256, sub_shape, mode, response_index,
 *     response_was_free_text, latency_ms}.
 *
 *   recordSelectorMirror(roomDir, eventType, payload)  -- Phase 88.2-03
 *     D-AMEND-02 Option B dual-surface mirror. Writes a memory_event row
 *     in <roomDir>/.mindrian/room.db via the Phase 109 navigation chokepoint
 *     (lib/core/navigation/memory-events.cjs logEvent). Mirror failure is
 *     graceful (returns {ok:false, reason}); never throws; never blocks
 *     the JSONL primary surface. Both surfaces are LOCAL per Canon Part 8.
 *
 * Canon Part 8 contract (LOCAL only -- zero Brain or network IO):
 *   - Primary JSONL target: ~/.mindrian/telemetry/selector.jsonl (per-user
 *     LOCAL ledger; never crosses any network boundary).
 *   - Mirror target: <roomDir>/.mindrian/room.db (LOCAL SQLite, Phase 109
 *     SQL spine). Filesystem-local. Zero LOCAL -> BRAIN egress.
 *   - room_slug_sha256 = first 16 hex chars of sha256(path.basename(roomDir)).
 *     The literal room slug NEVER touches disk.
 *   - All scalar fields are integers, ISO timestamps, booleans, or
 *     fixed-vocabulary enum strings (sub_shape in {F.1..F.5}, mode in
 *     {A, B}, operator in the 5 frozen Phase 105 operators).
 *   - Zero references to Brain MCP, network calls, or remote endpoints.
 *
 * FIFO bound: at most MAX_LINES (10000) lines retained; on overflow, the
 * oldest are dropped. Atomic write via mktemp + rename in same directory.
 *
 * Graceful failure: every public entry point is wrapped in try/catch.
 * Telemetry NEVER fails Larry's turn -- a write error returns silently.
 *
 * Three-surface compatibility: identical behavior on CLI, Desktop MCP, and
 * Cowork. The home directory ($HOME/.mindrian/telemetry) is per-user, so
 * Cowork actors each get their own ledger.
 *
 * Pure CJS, node built-ins only, zero new runtime deps.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

// Env override exists so tests can redirect to a tmp file without touching
// the real ~/.mindrian ledger. Production callers never set this var.
const TELEMETRY_PATH = process.env.MINDRIAN_SELECTOR_TELEMETRY_PATH ||
  path.join(os.homedir(), '.mindrian', 'telemetry', 'selector.jsonl');

// Env override for MAX_LINES exists so the FIFO truncation test can use
// a tiny bound (e.g. 50) without rewriting a 10000-entry file repeatedly.
// Production callers never set this var; the constant remains 10000.
const _envMax = parseInt(process.env.MINDRIAN_SELECTOR_TELEMETRY_MAX_LINES, 10);
const MAX_LINES = (Number.isFinite(_envMax) && _envMax > 0) ? _envMax : 10000;
const SLUG_HASH_LEN = 16;

function hashRoomSlug(roomDir) {
  // Hash the basename only -- never the full path. This means the ledger
  // contains a stable per-room handle (so aggregation can group events)
  // without ever persisting the literal user-chosen room name.
  const slug = path.basename(roomDir || 'unknown');
  return crypto.createHash('sha256').update(String(slug)).digest('hex').slice(0, SLUG_HASH_LEN);
}

function ensureDir() {
  const dir = path.dirname(TELEMETRY_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function appendLineAtomic(line) {
  // Read existing -> push -> FIFO-truncate -> atomic write via mktemp +
  // rename in the same directory. Same-directory tmp is required so the
  // rename is atomic on any POSIX filesystem.
  ensureDir();
  let lines = [];
  if (fs.existsSync(TELEMETRY_PATH)) {
    try {
      const raw = fs.readFileSync(TELEMETRY_PATH, 'utf8');
      lines = raw.split('\n').filter(Boolean);
    } catch (_e) {
      // Unreadable -- start fresh rather than crash.
      lines = [];
    }
  }
  lines.push(line);
  if (lines.length > MAX_LINES) {
    lines = lines.slice(lines.length - MAX_LINES);
  }
  const dir = path.dirname(TELEMETRY_PATH);
  const rand = crypto.randomBytes(6).toString('hex');
  const tmp = path.join(dir, '.selector.jsonl.' + rand);
  fs.writeFileSync(tmp, lines.join('\n') + '\n', 'utf8');
  fs.renameSync(tmp, TELEMETRY_PATH);
}

function recordPresentation(roomDir, record) {
  try {
    const r = (record && typeof record === 'object') ? record : {};
    const obj = {
      ts: new Date().toISOString(),
      event: 'presentation',
      room_slug_sha256: hashRoomSlug(roomDir),
      sub_shape: typeof r.sub_shape === 'string' ? r.sub_shape : null,
      mode: typeof r.mode === 'string' ? r.mode : null,
      options_count: typeof r.options_count === 'number' ? r.options_count : null,
      recommended_present: r.recommended_present === true,
    };
    if (typeof r.operator === 'string') {
      obj.operator = r.operator;
    }
    appendLineAtomic(JSON.stringify(obj));
  } catch (_e) {
    // Graceful -- never fail Larry's turn on a telemetry I/O hiccup.
  }
}

function recordResponse(roomDir, record) {
  try {
    const r = (record && typeof record === 'object') ? record : {};
    const obj = {
      ts: new Date().toISOString(),
      event: 'response',
      room_slug_sha256: hashRoomSlug(roomDir),
      sub_shape: typeof r.sub_shape === 'string' ? r.sub_shape : null,
      mode: typeof r.mode === 'string' ? r.mode : null,
      response_index: typeof r.response_index === 'number' ? r.response_index : null,
      response_was_free_text: r.response_was_free_text === true,
      latency_ms: typeof r.latency_ms === 'number' ? r.latency_ms : null,
    };
    appendLineAtomic(JSON.stringify(obj));
  } catch (_e) {
    // Graceful.
  }
}

/**
 * Phase 88.2-03 D-AMEND-02 Option B -- dual-surface mirror.
 *
 * Mirrors selector telemetry events to the Phase 109 SQL spine
 * (room.db memory_event row) IN ADDITION TO the JSONL primary surface.
 *
 * Both surfaces are LOCAL per Canon Part 8:
 *   - Primary JSONL: ~/.mindrian/telemetry/selector.jsonl (filesystem-local).
 *   - Mirror memory_event: <roomDir>/.mindrian/<roomName>.db (LOCAL SQLite).
 *
 * The mirror writes scalar enum strings + sha256 hashes + numeric scalars.
 * NO user content. NO meeting transcripts. NO artifact bodies. Zero
 * LOCAL -> BRAIN data flow introduced.
 *
 * Resilience contract (D-AMEND-02):
 *   - JSONL primary surface NEVER depends on the mirror succeeding.
 *   - Mirror failure modes are returned as a structured envelope; never throws.
 *   - When MINDRIAN_DISABLE_MEMORY_EVENT=1 is set, mirror returns
 *     {ok:false, reason:'mirror_disabled_env'} without touching the DB.
 *   - When the room has no .db (pre-Phase-109 user), mirror returns
 *     {ok:false, reason:'db_not_initialized'} and the JSONL primary
 *     emit -- typically called separately by the caller -- still succeeds.
 *
 * @param {string} roomDir   Absolute path to the room directory.
 * @param {string} eventType One of EVENT_TYPES (validated against the
 *                           memory-events Set; must be one of the 4 new
 *                           strings landed by 88.2-00:
 *                           selector_presentation, selector_response,
 *                           selector_rejection_captured, f6_round_completed).
 * @param {object} payload   Event payload merged into the memory_event
 *                           row's properties JSON. event_type is merged in
 *                           by logEvent (overrides any caller value).
 * @returns {{ok: boolean, reason?: string, eventId?: string}}
 */
function recordSelectorMirror(roomDir, eventType, payload) {
  try {
    if (process.env.MINDRIAN_DISABLE_MEMORY_EVENT === '1') {
      return { ok: false, reason: 'mirror_disabled_env' };
    }

    // Lazy-require navigation/memory-events.cjs so a missing Phase 109
    // substrate (or a stripped-down install) cannot crash callers at load.
    let EVENT_TYPES;
    let logEvent;
    try {
      const memMod = require('../core/navigation/memory-events.cjs');
      EVENT_TYPES = memMod.EVENT_TYPES;
      logEvent = memMod.logEvent;
    } catch (_e) {
      return { ok: false, reason: 'memory_events_module_unavailable' };
    }

    if (!EVENT_TYPES || typeof EVENT_TYPES.has !== 'function' || !EVENT_TYPES.has(eventType)) {
      return { ok: false, reason: 'invalid_event_type' };
    }
    if (typeof logEvent !== 'function') {
      return { ok: false, reason: 'memory_events_module_unavailable' };
    }

    if (typeof roomDir !== 'string' || roomDir.length === 0) {
      return { ok: false, reason: 'invalid_room_dir' };
    }

    // Project sqlite binding: node:sqlite DatabaseSync (per
    // lib/core/lazygraph-ops.cjs). NOT better-sqlite3.
    let DatabaseSync;
    try {
      DatabaseSync = require('node:sqlite').DatabaseSync;
    } catch (_e) {
      return { ok: false, reason: 'sqlite_unavailable' };
    }
    if (typeof DatabaseSync !== 'function') {
      return { ok: false, reason: 'sqlite_unavailable' };
    }

    const dbPath = path.join(roomDir, '.mindrian', 'room.db');
    if (!fs.existsSync(dbPath)) {
      return { ok: false, reason: 'db_not_initialized' };
    }

    let db;
    try {
      // Phase 276 (C4) write-safety: fold the busy-timeout constructor option
      // into the DatabaseSync options object. Without it, node:sqlite fails
      // a contended write in 0ms with SQLITE_BUSY; the option turns that
      // into a roughly 5s busy-wait window. Strictly more forgiving - a
      // longer wait, never a new failure mode - because WAL readers never block writers.
      // Adapted from the one correct site, lib/core/room-db.cjs:242-251.
      db = new DatabaseSync(dbPath, { timeout: 5000 });
    } catch (_e) {
      return { ok: false, reason: 'db_open_failed' };
    }
    try {
      const safePayload = (payload && typeof payload === 'object' && !Array.isArray(payload))
        ? payload
        : {};
      const result = logEvent(db, eventType, safePayload);
      // logEvent returns { ok, eventId } | { ok:false, reason }; pass through.
      return result;
    } catch (_e) {
      return { ok: false, reason: 'mirror_threw_caught' };
    } finally {
      try { db.close(); } catch (_e) { /* best-effort */ }
    }
  } catch (_e) {
    return { ok: false, reason: 'mirror_threw_caught' };
  }
}

module.exports = {
  recordPresentation: recordPresentation,
  recordResponse: recordResponse,
  recordSelectorMirror: recordSelectorMirror,
  TELEMETRY_PATH: TELEMETRY_PATH,
  MAX_LINES: MAX_LINES,
  _internal: { hashRoomSlug: hashRoomSlug },
};
