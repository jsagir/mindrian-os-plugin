'use strict';
/*
 * Phase 129-01 -- spine-events: the per-event spine helper API.
 *
 * The 6 spine scripts (mos-status / suggest-next / act / pipeline / jtbd /
 * operator / memory) are NOT in the substrate-guard allow-list, so they must
 * reach room.db ONLY through navigation.cjs. This module is the door: each
 * log* helper takes a roomDir (NEVER a db handle), opens room.db internally via
 * lib/core/room-db.cjs (legal here -- navigation/ is allow-listed by
 * scripts/check-substrate.cjs regex /^lib\/core\/navigation\//), writes the
 * right memory_event via logEvent, and ALWAYS closes the handle in finally.
 * Mirrors lib/core/navigation/dashboard-helpers.cjs structure exactly.
 *
 * Helpers:
 *   logSpineRead(roomDir, payload)          -> 'spine_read'
 *   logJtbdTransition(roomDir, payload)      -> 'jtbd_transitioned'
 *   logOperatorTransition(roomDir, payload)  -> 'operator_transitioned'
 *   logWorkflowStage(roomDir, payload)       -> 'workflow_stage'
 *   logSuggestionSurfaced(roomDir, payload)  -> 'suggestion_surfaced'
 *   getCurrentJTBD(roomDir)                  -> event-log-authoritative + cache fallback
 *   getCurrentOperator(roomDir)              -> event-log-authoritative + cache fallback
 *
 * Each log* helper:
 *   - returns { ok:false, reason:'no_room_db' } when <roomDir>/.mindrian/room.db
 *     is absent (graceful, mirrors dashboard-helpers; never throws).
 *   - sets a deterministic payload.dedupe_key when the caller does not supply one
 *     so repeated no-op emissions dedupe inside the 60s TTL (Phase 129-01).
 *   - when payload.follows_from is a non-empty string, also writes a FOLLOWS_FROM
 *     edge (source = new event id, target = prior event id) with enum-only
 *     properties per Canon Part 8. FOLLOWS_FROM is additive -- a writeEdge failure
 *     never changes the log result.
 *
 * getCurrentJTBD / getCurrentOperator: the memory_event log is AUTHORITATIVE
 *   (most-recent jtbd_transitioned / operator_transitioned wins); the cache file
 *   (lib/hmi/jtbd-state.cjs / lib/conversation/operator.cjs getCurrent) is the
 *   fallback. Per 129-CONTEXT decision: NO deprecation of the cache file this phase.
 *
 * Canon Part 9 (Memory Locality): this helper IS a navigation surface; the spine
 *   scripts that need room.db go through here, never around it.
 * Canon Part 8: zero network surface. Pure LOCAL filesystem + SQLite.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const path = require('node:path');
const roomDbMod = require('../room-db.cjs');
const memoryEvents = require('./memory-events.cjs');
const edges = require('./edges.cjs');
const jtbdState = require('../../hmi/jtbd-state.cjs');
const operator = require('../../conversation/operator.cjs');

function _roomDbPath(roomDir) {
  return path.join(roomDir, '.mindrian', 'room.db');
}

function _hasRoomDb(roomDir) {
  try {
    return typeof roomDir === 'string'
      && roomDir.length > 0
      && fs.statSync(_roomDbPath(roomDir)).isFile();
  } catch (_e) {
    return false;
  }
}

// Compose a deterministic dedupe_key from a set of scalar values. Only used when
// the caller does not supply payload.dedupe_key. Joins with a delimiter that
// cannot appear in a normal scalar so distinct tuples never collide.
function _deriveDedupeKey(parts) {
  return parts.map((p) => (p === undefined || p === null ? '' : String(p))).join('|');
}

// The shared write path: open room.db, logEvent, optional FOLLOWS_FROM edge,
// always close. Returns the logEvent result (with deduped marker preserved).
function _emit(roomDir, eventType, payload) {
  if (!_hasRoomDb(roomDir)) {
    return { ok: false, reason: 'no_room_db' };
  }
  let db;
  try {
    db = roomDbMod.openRoomDb(roomDir);
  } catch (_e) {
    return { ok: false, reason: 'no_room_db' };
  }
  try {
    const result = memoryEvents.logEvent(db, eventType, payload);
    // FOLLOWS_FROM emission: additive, never load-bearing for the log write.
    if (result && result.ok && !result.deduped
      && typeof payload.follows_from === 'string' && payload.follows_from.length > 0
      && typeof result.eventId === 'string') {
      try {
        edges.writeEdge(db, {
          source_id: result.eventId,
          target_id: payload.follows_from,
          edge_type: 'FOLLOWS_FROM',
          properties: { surface: payload.surface || null },
        });
      } catch (_e) {
        // Tolerate writeEdge failure (FK miss, locked db). The log result stands.
      }
    }
    return result;
  } finally {
    try { roomDbMod.closeRoomDb(db); } catch (_e) { /* tolerant */ }
  }
}

// ---------------------------------------------------------------------------
// log* helpers (roomDir-taking; room.db opened internally).
// ---------------------------------------------------------------------------

function logSpineRead(roomDir, payload) {
  const p = (payload && typeof payload === 'object') ? Object.assign({}, payload) : {};
  if (typeof p.dedupe_key !== 'string') {
    // spine_read natural key: surface + section + jtbd + operator scalars, so
    // 10x /mos:status with no state change dedupes per the 60s TTL.
    p.dedupe_key = _deriveDedupeKey([
      'spine_read', p.surface, p.section, p.jtbd, p.operator,
    ]);
  }
  return _emit(roomDir, 'spine_read', p);
}

function logJtbdTransition(roomDir, payload) {
  const p = (payload && typeof payload === 'object') ? Object.assign({}, payload) : {};
  if (typeof p.dedupe_key !== 'string') {
    // The natural key is the from->to pair (+ kind).
    p.dedupe_key = _deriveDedupeKey(['jtbd_transitioned', p.kind, p.from, p.to]);
  }
  return _emit(roomDir, 'jtbd_transitioned', p);
}

function logOperatorTransition(roomDir, payload) {
  const p = (payload && typeof payload === 'object') ? Object.assign({}, payload) : {};
  if (typeof p.dedupe_key !== 'string') {
    p.dedupe_key = _deriveDedupeKey(['operator_transitioned', p.from, p.to]);
  }
  return _emit(roomDir, 'operator_transitioned', p);
}

function logWorkflowStage(roomDir, payload) {
  const p = (payload && typeof payload === 'object') ? Object.assign({}, payload) : {};
  if (typeof p.dedupe_key !== 'string') {
    // surface enum 'act'|'pipeline', phase enum 'entered'|'completed', + stage.
    p.dedupe_key = _deriveDedupeKey(['workflow_stage', p.surface, p.phase, p.stage, p.command]);
  }
  return _emit(roomDir, 'workflow_stage', p);
}

function logSuggestionSurfaced(roomDir, payload) {
  const p = (payload && typeof payload === 'object') ? Object.assign({}, payload) : {};
  if (typeof p.dedupe_key !== 'string') {
    const commandsKey = Array.isArray(p.commands) ? p.commands.join(',') : (p.commands || '');
    p.dedupe_key = _deriveDedupeKey(['suggestion_surfaced', p.surface, commandsKey]);
  }
  return _emit(roomDir, 'suggestion_surfaced', p);
}

// ---------------------------------------------------------------------------
// getCurrentJTBD / getCurrentOperator -- event-log-authoritative, cache fallback.
// ---------------------------------------------------------------------------

function getCurrentJTBD(roomDir) {
  if (_hasRoomDb(roomDir)) {
    let db;
    try {
      db = roomDbMod.openRoomDb(roomDir);
      const recent = memoryEvents.findRecentChanges(db, 0, {
        eventType: 'jtbd_transitioned', limit: 1,
      });
      if (recent && recent.length > 0) {
        const props = recent[0].properties || {};
        return {
          jtbd: typeof props.jtbd === 'string' ? props.jtbd
            : (typeof props.to === 'string' ? props.to : null),
          kind: typeof props.kind === 'string' ? props.kind : null,
          entered_at: recent[0].createdAt,
          source: 'event_log',
        };
      }
    } catch (_e) {
      // fall through to cache fallback
    } finally {
      try { if (db) roomDbMod.closeRoomDb(db); } catch (_e) { /* tolerant */ }
    }
  }
  // Cache fallback: the jtbd-state.json fast-read cache.
  const cur = jtbdState.getCurrent(roomDir);
  if (cur && typeof cur === 'object') {
    return Object.assign({}, cur, { source: 'cache_fallback' });
  }
  return null;
}

function getCurrentOperator(roomDir) {
  if (_hasRoomDb(roomDir)) {
    let db;
    try {
      db = roomDbMod.openRoomDb(roomDir);
      const recent = memoryEvents.findRecentChanges(db, 0, {
        eventType: 'operator_transitioned', limit: 1,
      });
      if (recent && recent.length > 0) {
        const props = recent[0].properties || {};
        return {
          current: typeof props.operator === 'string' ? props.operator
            : (typeof props.to === 'string' ? props.to : null),
          previous: typeof props.from === 'string' ? props.from : null,
          entered_at: recent[0].createdAt,
          source: 'event_log',
        };
      }
    } catch (_e) {
      // fall through to cache fallback
    } finally {
      try { if (db) roomDbMod.closeRoomDb(db); } catch (_e) { /* tolerant */ }
    }
  }
  // Cache fallback: the conversation-operator.json fast-read cache.
  const cur = operator.getCurrent(roomDir);
  if (cur && typeof cur === 'object') {
    return Object.assign({}, cur, { source: 'cache_fallback' });
  }
  return null;
}

module.exports = {
  logSpineRead,
  logJtbdTransition,
  logOperatorTransition,
  logWorkflowStage,
  logSuggestionSurfaced,
  getCurrentJTBD,
  getCurrentOperator,
};
