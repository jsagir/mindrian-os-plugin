/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 202-01 -- lab-side telemetry consumer (closes the Phase 121 open loop).
 *
 * The trajectory-telemetry stream (lib/core/telemetry/writer.cjs) has been
 * write-only since v1.13: SEED-002 always named a consumer that was never
 * built. This module is that consumer. It implements the frozen ingestion
 * contract in docs/TELEMETRY-SCHEMA.md Section 9:
 *
 *   1. Read shards in lexicographic (== ISO-week chronological) order, using
 *      the ANCHORED regex /^events-\d{4}-W\d{2}\.jsonl$/ so legacy siblings
 *      (mva.jsonl, selector.jsonl) and quarantine shards are excluded.
 *   2. Dispatch by event field (the 15-way v1 enum is the integration contract).
 *   3. Dispatch by schema_version: a future v2 row we do not understand is
 *      SKIPPED, not aborted (additive evolution).
 *   4. Filter command_invocation OUT of the high-signal set (drowning
 *      protection). eventCount still counts ALL events including it.
 *   5. Group the high-signal set by session_id (within-session trajectory).
 *   6. Group the high-signal set by room_slug_sha256 (cross-session per-room
 *      trajectory). room_slug_sha256 is a PAYLOAD field absent on some event
 *      types (command_invocation, empathy_observation, the 6 mva.* types), so
 *      room-less events bucket under the literal __no_room__ key rather than
 *      crashing or dropping silently.
 *   7. Enforce the activation gate: corpus size >= ACTIVATION_MIN (100). Below
 *      threshold the result flags activated:false and surfaces a visible note.
 *      It never silently produces a thin reward table.
 *
 * Canon Part 8: LAB-side only. LOCAL read. Zero network, zero Brain, zero
 * egress. Append-only respected -- this module NEVER writes back to the stream.
 *
 * Pure CJS, node built-ins only. Zero runtime dependencies.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Reuse the writer's dir resolver + frozen schema version rather than
// re-deriving the ~/.mindrian/telemetry/v1.13 path string (Part 7 reuse).
const { telemetryDir } = require('../../lib/core/telemetry/writer.cjs');
const { SCHEMA_VERSION } = require('../../lib/core/telemetry/schema.cjs');

// ---------- Constants ----------

// The lab-loop activation gate (docs/TELEMETRY-SCHEMA.md Section 9).
const ACTIVATION_MIN = 100;

// Section 9 #1: the ANCHORED shard name regex. This deliberately excludes
// legacy siblings and quarantine shards; only zero-padded ISO-week shards match.
const SHARD_RE = /^events-\d{4}-W\d{2}\.jsonl$/;

// Section 9 #4: high-signal analyses drop command_invocation (drowning
// protection). eventCount still counts it; only the grouped high-signal set omits it.
const HIGH_SIGNAL_EXCLUDE = new Set(['command_invocation']);

// D4: bucket key for events whose payload lacks room_slug_sha256.
const NO_ROOM = '__no_room__';

// ---------- Helpers ----------

function listShards(dir) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch (_e) {
    return []; // missing dir -> empty corpus (not an error; corpus may not exist yet)
  }
  // .sort() on zero-padded ISO-week names is chronological (Section 9 #1).
  return names.filter((n) => SHARD_RE.test(n)).sort();
}

function parseShard(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (_e) {
    return [];
  }
  const out = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue; // tolerate blank lines / trailing newline
    let row;
    try {
      row = JSON.parse(trimmed);
    } catch (_e) {
      // Section 9: tolerate a trailing partial line from an interrupted append.
      continue;
    }
    out.push(row);
  }
  return out;
}

function groupBy(arr, keyFn) {
  const out = {};
  for (const item of arr) {
    const k = keyFn(item);
    if (!Object.prototype.hasOwnProperty.call(out, k)) out[k] = [];
    out[k].push(item);
  }
  return out;
}

// ---------- Public API ----------

/**
 * readTelemetry(dir, opts) -> {
 *   activated,       // boolean: eventCount >= ACTIVATION_MIN
 *   eventCount,      // number: ALL parsed v1 events (INCLUDING command_invocation)
 *   events,          // array: all parsed v1 events in chronological shard order
 *   highSignal,      // array: events with command_invocation filtered out
 *   sessions,        // { [session_id]: events[] } over the high-signal set
 *   byRoom,          // { [room_slug_sha256 | __no_room__]: events[] } over high-signal
 *   shards,          // string[]: shard filenames read, in order
 *   activationNote   // string (only when !activated): the visible below-threshold note
 * }
 *
 * @param dir   directory to read; defaults to telemetryDir() (~/.mindrian/telemetry/v1.13).
 * @param opts  { silent?: boolean, logger?: (msg) => void }
 */
function readTelemetry(dir, opts) {
  const options = opts || {};
  const targetDir = dir || telemetryDir();
  const shards = listShards(targetDir);

  const events = [];
  for (const name of shards) {
    for (const row of parseShard(path.join(targetDir, name))) {
      // Section 9 #3: dispatch by schema_version. Skip rows from a future
      // schema we do not understand rather than aborting the whole read.
      if (typeof row.schema_version === 'number' && row.schema_version > SCHEMA_VERSION) {
        continue;
      }
      events.push(row);
    }
  }

  // eventCount is ALL events (including command_invocation) per HARD_CONSTRAINTS.
  const eventCount = events.length;

  // The high-signal set drops command_invocation (Section 9 #4).
  const highSignal = events.filter((e) => !HIGH_SIGNAL_EXCLUDE.has(e.event));

  const sessions = groupBy(highSignal, (e) =>
    typeof e.session_id === 'string' ? e.session_id : 'default'
  );

  // D4: room_slug_sha256 is a payload field absent on some event types; bucket
  // those under __no_room__ rather than crashing or silently dropping.
  const byRoom = groupBy(highSignal, (e) =>
    typeof e.room_slug_sha256 === 'string' ? e.room_slug_sha256 : NO_ROOM
  );

  const activated = eventCount >= ACTIVATION_MIN;

  const result = { activated, eventCount, events, highSignal, sessions, byRoom, shards };

  if (!activated) {
    // Below-threshold state is SURFACED, never a silent thin table.
    const note = `telemetry below activation threshold (${eventCount}/${ACTIVATION_MIN})`;
    result.activationNote = note;
    if (!options.silent) {
      const log = typeof options.logger === 'function' ? options.logger : (m) => console.error(m);
      log('[apo] ' + note);
    }
  }

  return result;
}

module.exports = {
  readTelemetry,
  ACTIVATION_MIN,
  SHARD_RE,
  NO_ROOM,
};
