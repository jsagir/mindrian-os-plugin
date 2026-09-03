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
 *   - returns { ok:false, reason:<reason> } when the write path cannot log the
 *     event, never throws. Four reasons, in the order each can fire (Phase
 *     276-10, TOOLHON-10):
 *       'no_room_db'          -- <roomDir>/.mindrian/room.db is genuinely
 *                                 absent (the _hasRoomDb guard below fires
 *                                 before any open is attempted; graceful,
 *                                 mirrors dashboard-helpers).
 *       'room_db_busy'        -- the file exists but another connection holds
 *                                 the write lock right now (room-db.cjs's
 *                                 typed busy error).
 *       'room_db_broken'      -- the file exists but is not usable: corrupt
 *                                 pages, garbage bytes, or a failed migration
 *                                 (room-db.cjs's typed broken error).
 *       'room_db_open_failed' -- the open failed for a reason this module
 *                                 cannot classify (an unclassified stranger
 *                                 re-thrown as itself by openRoomDb).
 *     A `detail` string (the underlying error message, truncated) rides along
 *     on the three open-failure reasons so a debug session can read it.
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
const correlation = require('../correlation.cjs');

// Phase 130.7-02 -- the default primary label when only a name is known at
// reference-write time (Tier 0 / pre-backfill). Framework is the methodology
// label, consistent with lib/brain/chain-recommender.cjs DEFAULT_PRIMARY_LABEL,
// so a reference correlation_id derived here joins to the same canonical the
// chain-recommender + local recommender produce.
const DEFAULT_PRIMARY_LABEL = 'Framework';

// Phase 130.7-02 -- thread a correlation_id onto a memory_event reference
// payload ADDITIVELY. Precedence:
//   1. a caller-supplied payload.correlation_id is honored verbatim (the caller
//      already resolved the canonical id; we never re-derive over it).
//   2. else, when payload.canonical_name is a non-empty string, derive
//      correlation.computeCorrelationId(canonical_name, primary_label || Framework)
//      via the SHARED Plan 01 chokepoint so the reference joins the same
//      Brain/local canonical by construction.
//   3. else leave the payload untouched (no name -> no correlation_id; never
//      invent one).
// This NEVER replaces target_node_id and NEVER adds a new EVENT_TYPE -- it only
// adds a scalar hash field to the reference. Canon Part 8: correlation_id is a
// hash scalar, never user content.
function _withCorrelationId(p) {
  if (typeof p.correlation_id === 'string' && p.correlation_id.length > 0) return p;
  if (typeof p.canonical_name === 'string' && p.canonical_name.trim().length > 0) {
    const label = (typeof p.primary_label === 'string' && p.primary_label.trim().length > 0)
      ? p.primary_label : DEFAULT_PRIMARY_LABEL;
    try {
      p.correlation_id = correlation.computeCorrelationId(p.canonical_name, label);
    } catch (_e) {
      // Never let id derivation throw the write path; degrade to no id.
    }
  }
  return p;
}

function _roomDbPath(roomDir) {
  return path.join(roomDir, '.mindrian', 'room.db');
}

// Percent-encode the URI-significant bytes of a filesystem path for a SQLite
// file: URI. Reused verbatim from lib/core/graph-derivation.cjs:335-337 per
// Canon Part 7 (reuse before build) -- that file cannot be required from here
// without a cycle, so the 1-line escaper is re-declared rather than forked in
// spirit. SQLite's URI parser treats ? as the query separator, # as the
// fragment start, and % as the escape byte, so a room path containing any of
// them silently mis-resolves (or fails to open) without this. Everything else
// (spaces, quotes, unicode) passes through untouched: SQLite decodes %XX and
// takes the rest literally. Only needed by the file:-URI read-only door below;
// openRoomDbForCaller hands a plain path to room-db.cjs and never builds a URI.
// KNOWN LIMITATION (232.1-REVIEW.md WR-02, not fixed here): does not escape
// Windows backslash path separators (SQLite's URI parser wants forward
// slashes; `pathToFileURL` is not used anywhere in this codebase). Inherited
// identically from the 3 pre-existing call sites this was copied from
// (graph-derivation.cjs, coverage-rollup.cjs, session-presence.cjs) -- fixing
// it here alone would create a 4th, now-divergent copy instead of resolving
// the shared gap once. Degrades gracefully today (a failed open returns null,
// read as "no room.db yet", per D-05), not a crash.
function _fileUriPath(p) {
  return String(p).replace(/%/g, '%25').replace(/\?/g, '%3F').replace(/#/g, '%23');
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

// Classify a thrown openRoomDb() error into a JSON-safe { reason, detail }
// shape. Phase 276-10 (TOOLHON-10): this is the SHARED helper both _emit and
// _emitWithOperatorEdge call instead of each repeating the same four-line
// catch -- the duplication was the bug in miniature (276-10-PLAN.md), so
// fixing it once here rather than twice is the point, not a stylistic choice.
//
// Classification lives in room-db.cjs, NOT here: this helper adds no
// classification logic of its own, it only stops MISREPORTING the two typed
// error classes as an absent database. `no_room_db` keeps its original
// meaning at the _hasRoomDb guard above (a genuine cold start is still
// reported as a cold start); this is strictly narrower than the previous
// behavior, never wider -- the same justification lib/core/graph-refine-loop
// .cjs:125-131 already states for the identical narrow-the-swallow move,
// adapted here to a RETURN SHAPE rather than a re-throw, because this
// module's whole contract (see the header above) is a { ok, reason } return:
// spine-events cannot re-throw without breaking every existing caller.
//
// err.name is checked BEFORE instanceof, per room-db.cjs's own stated reason
// for setting `this.name` explicitly: so the discrimination still works
// across a module-instance boundary, where instanceof can fail on a
// duplicated require. spine-events reaches room-db.cjs through roomDbMod,
// exactly that duplicated-require shape.
function _classifyOpenError(err) {
  const name = err && err.name;
  const rawMessage = err && err.message ? String(err.message) : String(err);
  const detail = rawMessage.length > 200 ? rawMessage.slice(0, 200) : rawMessage;
  if (name === 'RoomDbBusyError' || err instanceof roomDbMod.RoomDbBusyError) {
    return { reason: 'room_db_busy', detail: detail };
  }
  if (name === 'RoomDbBrokenError' || err instanceof roomDbMod.RoomDbBrokenError) {
    return { reason: 'room_db_broken', detail: detail };
  }
  return { reason: 'room_db_open_failed', detail: detail };
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
  } catch (err) {
    const classified = _classifyOpenError(err);
    return { ok: false, reason: classified.reason, detail: classified.detail };
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
  // Phase 129-03: when payload.write_transition_edge is true, ALSO write the
  // typed OPERATOR_TRANSITION cascade edge between the from/to operator nodes
  // (Canon Part 4). This is the chokepoint home for the edge that
  // lib/conversation/operator.cjs used to write via a direct node:sqlite INSERT
  // bypass. We seed the two operator nodes first (the edges table carries a
  // FOREIGN KEY to nodes(id)) then writeEdge. Best-effort: a writeEdge / seed
  // failure never changes the log result.
  if (p.write_transition_edge === true
    && typeof p.from === 'string' && p.from.length > 0
    && typeof p.to === 'string' && p.to.length > 0) {
    return _emitWithOperatorEdge(roomDir, p);
  }
  return _emit(roomDir, 'operator_transitioned', p);
}

// Like _emit, but also seeds the two operator nodes and writes the typed
// OPERATOR_TRANSITION edge between them. Single open/close of room.db so the
// event + the edge land on one handle.
function _emitWithOperatorEdge(roomDir, payload) {
  if (!_hasRoomDb(roomDir)) {
    return { ok: false, reason: 'no_room_db' };
  }
  let db;
  try {
    db = roomDbMod.openRoomDb(roomDir);
  } catch (err) {
    const classified = _classifyOpenError(err);
    return { ok: false, reason: classified.reason, detail: classified.detail };
  }
  try {
    const result = memoryEvents.logEvent(db, 'operator_transitioned', payload);
    // Seed operator nodes (idempotent) then write the OPERATOR_TRANSITION edge.
    // Operator node ids are namespaced so they never collide with other node
    // types; the edge references these ids (FK to nodes(id)).
    try {
      const fromId = 'operator:' + payload.from;
      const toId = 'operator:' + payload.to;
      const nowMs = Date.now();
      const insNode = db.prepare(
        "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) " +
        "VALUES (?, 'operator', '{}', 'system:operator', 'system', NULL, 'confirmed', ?, ?)"
      );
      insNode.run(fromId, nowMs, nowMs);
      insNode.run(toId, nowMs, nowMs);
      edges.writeEdge(db, {
        source_id: fromId,
        target_id: toId,
        edge_type: 'OPERATOR_TRANSITION',
        properties: {
          trigger: typeof payload.trigger === 'string' ? payload.trigger : null,
        },
      });
    } catch (_e) {
      // Tolerate seed / writeEdge failure (older schema, locked db). The
      // operator_transitioned event still stands.
    }
    return result;
  } finally {
    try { roomDbMod.closeRoomDb(db); } catch (_e) { /* tolerant */ }
  }
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
  // Phase 130.7-02: thread correlation_id onto the reference ADDITIVELY. Done
  // AFTER the dedupe_key derivation so the natural key (surface + commands)
  // stays byte-stable -- the correlation_id never participates in dedup.
  _withCorrelationId(p);
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

// ---------- Caller-owned room.db handle (Phase 135-01) ----------
//
// openRoomDbForCaller(roomDir) -> db handle | null
//   The F-selector design contract (Phase 125 / F-SELECTOR-CONSUMER-GUIDE)
//   requires the CALLER to populate roomState.db with a LIVE handle before
//   rankForSelector / shouldExclude / recordSelectorDecision run. The hot-path
//   caller is scripts/intent-classifier.cjs, which is NOT on the room-db.cjs
//   substrate allow-list and so may NEVER require room-db.cjs directly. This
//   thin wrapper opens room.db through the allow-listed chokepoint (spine-events
//   is inside lib/core/navigation/) and hands the caller a handle it owns and
//   MUST close via closeRoomDbForCaller in a finally. Same caller-owns-the-handle
//   pattern as the Phase 130-03 *ByRoomDir helpers and the writeEdge db contract.
//   Returns null when <roomDir>/.mindrian/room.db is absent (Tier 0 cold start);
//   the resolver and shouldExclude both treat a null db as empty-state and abstain
//   gracefully, never crash. Never throws.
function openRoomDbForCaller(roomDir) {
  try {
    if (!roomDir || typeof roomDir !== 'string') return null;
    if (!fs.existsSync(_roomDbPath(roomDir))) return null;
    return roomDbMod.openRoomDb(roomDir);
  } catch (_e) {
    return null;
  }
}

// closeRoomDbForCaller(db) -> void. Tolerant: a null / already-closed handle is a
//   no-op. The caller invokes this in a finally so a thrown decide() never leaks.
function closeRoomDbForCaller(db) {
  try {
    if (db) roomDbMod.closeRoomDb(db);
  } catch (_e) {
    /* tolerant: already closed */
  }
}

// ---------- Caller-owned READ-ONLY room.db handle (Phase 232.1, D-04) ----------
//
// openRoomDbReadOnlyForCaller(roomDir) -> read-only db handle | null
//   WHY THIS DOOR EXISTS. This is a NEW sibling MODE of entry through the SAME
//   lib/core/navigation/ chokepoint -- never a second chokepoint. It exists
//   because openRoomDbForCaller (above) is NOT read-only: it delegates to
//   room-db.cjs::openRoomDb, which mkdirSync's <roomDir>/.mindrian/, runs 13
//   CREATE TABLE IF NOT EXISTS statements (initSchema + initMemorySchema), and
//   runs 5 idempotent migrations on EVERY open. That was reproduced empirically
//   on a copy of a real room (232.1-RESEARCH.md Pitfall 1: a before/after schema
//   diff added the ranker_weights table and the edges.review_status column). It
//   is the right behavior for a caller about to USE the room, and the wrong
//   behavior for a DIAGNOSTIC caller that must never mutate what it measures --
//   a system-wide census through that door would silently migrate every
//   registered room the first time it ran.
//
//   WHO MAY NOT REQUIRE room-db.cjs. Same rule as openRoomDbForCaller: callers
//   outside the substrate allow-list (lib/core/doctor/*, lib/mcp/*, scripts/*)
//   may NEVER require room-db.cjs or node:sqlite directly. spine-events.cjs is
//   inside lib/core/navigation/, which check-substrate.cjs allow-lists by path
//   regex, so this door needs zero allow-list edit.
//
//   CALLER OWNS THE HANDLE. The caller MUST close it in a finally -- via the
//   EXISTING closeRoomDbForCaller above, which is the correct close path for
//   this handle too: room-db.cjs::closeRoomDb accepts a bare DatabaseSync and
//   just calls .close() in a try/catch. Do NOT add a duplicate close helper.
//
//   NEVER THROWS. Returns null when roomDir is falsy/non-string, when
//   <roomDir>/.mindrian/room.db is absent (Tier 0 cold start), or on any thrown
//   open error. The existsSync guard is deliberate: node:sqlite has NO
//   fileMustExist option (that is better-sqlite3's API, and this repo does not
//   use better-sqlite3) -- an explicit probe before the open is the repo-wide
//   substitute, exactly as openRoomDbForCaller itself does. Do not reintroduce
//   the wrong library's option name here.
//
//   The open uses the file: URI ?mode=ro form (the idiom already live in
//   session-presence.cjs::roomDbHasTables, coverage-rollup.cjs and
//   graph-derivation.cjs) so the OS/SQLite layer mechanically rejects any write
//   and no migration code path is reachable at all.
//
//   NO busy-timeout option (232.1-REVIEW.md WR-03, considered and not added):
//   room-db.cjs's mutating door sets `timeout: 5000` to tolerate a contended
//   WRITE; this door is read-only and matches all 3 existing read-only
//   precedents above, none of which set one either. Under a rare concurrent
//   lock, a query here fails fast and countTable's catch-all reads that as 0
//   rows for that one table on that one census run -- self-corrects on the
//   next run, unlike a permanent miscount. Adding a timeout only here would
//   diverge from every existing read-only precedent for a narrow, transient,
//   self-healing edge case; not worth the inconsistency.
function openRoomDbReadOnlyForCaller(roomDir) {
  try {
    if (!roomDir || typeof roomDir !== 'string') return null;
    const dbPath = _roomDbPath(roomDir);
    if (!fs.existsSync(dbPath)) return null;
    // Lazy require, matching session-presence.cjs's own idiom: node:sqlite is an
    // experimental built-in and must never be pulled in at module load time.
    const { DatabaseSync } = require('node:sqlite');
    return new DatabaseSync('file:' + _fileUriPath(dbPath) + '?mode=ro');
  } catch (_e) {
    return null;
  }
}

module.exports = {
  logSpineRead,
  logJtbdTransition,
  logOperatorTransition,
  logWorkflowStage,
  logSuggestionSurfaced,
  getCurrentJTBD,
  getCurrentOperator,
  openRoomDbForCaller,
  closeRoomDbForCaller,
  openRoomDbReadOnlyForCaller,
};
