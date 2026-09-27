'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 Ruling 2: which stamped SENS-13 card won a pull on this MCP
 * server process. Process memory ONLY; a pull never persists anything
 * (suggest_next and reach_candidates stay declared reads); the Stop-time
 * close-out persists through the 355-19 fire-once ledger.
 *
 * Plan 355.1-13 closes the gap 355.1-11's own SUMMARY documented as a
 * PINNED FACT: dispatchCandidateReaches (lib/mcp/tools/sensors.cjs) fires
 * the SAME framed SENS-13 reach on every consecutive pull today, because
 * the MCP loop never calls decide() and so 355-22's fire-once mark never
 * runs on Desktop or Cowork. Navigator Ruling 2 (the checkpoint, approved
 * 2026-09-27) puts the WRITE at the one place the MCP loop is allowed to
 * write: the Stop-time close-out (lib/mcp/stop-gate-handler.cjs
 * closeOutRoom). This module is the process-memory note in between --
 * a pull that sees the winning reach records ONLY the handle, in a plain
 * Map, never to disk; the close-out reads it back and persists it through
 * eureka-reach-runner.cjs's markEurekaReachSurfaced, the SAME writer
 * 355-22's decide() mark already calls (extended, never duplicated).
 *
 * SHAPE: an insertion-ordered Map<roomDir, Set<handle>>, bounded by
 * MAX_ROOMS rooms and MAX_HANDLES_PER_ROOM handles per room. Past either
 * bound the OLDEST entry is dropped first (a Map/Set's own insertion order
 * is exactly the eviction order a bounded, long-lived server process
 * needs: least-recently-noted first). Every accessor returns a fresh
 * array COPY, never a live reference into the internal Set, so a caller
 * mutating the returned array can never corrupt this module's own state
 * (T-3551-57: unbounded memory in a long-lived server; T-3551-55: a
 * declared-read tool gaining a write -- this module never touches fs or
 * room.db, so there is nothing here for a write to leak into).
 *
 * Never throws. Every exported function soft-fails to its own safe default
 * (noteSurfaced: no-op; peekSurfaced/takeSurfaced: []) on a malformed
 * input, mirroring every other 355/355.1 side-channel helper's discipline.
 *
 * No em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 */

// MAX_ROOMS (64) -- the bounded room count a single long-lived MCP server
// process tracks noted handles for. TUNABLE-LATER: no measured multi-room
// concurrency figure exists yet for this seam; 64 is a generous, cheap
// ceiling (a bare string key plus a small Set per room) that a real desktop
// or cowork session is very unlikely to approach.
const MAX_ROOMS = 64;

// MAX_HANDLES_PER_ROOM (16) -- the bounded per-room handle count. A room
// normally carries at most ONE noted handle at a time (one winning pull per
// delta), so this bound exists purely as a defensive ceiling against a
// pathological caller noting many handles for the same room directory
// between close-outs, never as an expected steady-state count.
const MAX_HANDLES_PER_ROOM = 16;

// The single process-memory store: roomDir (string) -> Set<handle (string)>.
// A plain Map (never a WeakMap: the key is a string room directory path, not
// an object) so insertion order is preserved for oldest-first eviction.
let _surfaced = new Map();

function _isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}

/**
 * noteSurfaced(roomDir, handle) -- records that `handle` won a pull for
 * `roomDir`, in process memory only. Never writes to disk or room.db.
 *
 * Bounded: if `roomDir` is not already tracked and tracking it would push
 * past MAX_ROOMS, the OLDEST tracked room (first inserted, per Map
 * iteration order) is dropped first. Within a room, if adding `handle`
 * would push its Set past MAX_HANDLES_PER_ROOM, the OLDEST handle in that
 * room's Set (first inserted, per Set iteration order) is dropped first.
 *
 * Malformed input (a non-string or empty roomDir/handle) is a silent no-op.
 * Never throws.
 *
 * @param {string} roomDir
 * @param {string} handle
 */
function noteSurfaced(roomDir, handle) {
  try {
    if (!_isNonEmptyString(roomDir) || !_isNonEmptyString(handle)) return;

    if (!_surfaced.has(roomDir)) {
      while (_surfaced.size >= MAX_ROOMS) {
        const oldestRoom = _surfaced.keys().next().value;
        if (oldestRoom === undefined) break;
        _surfaced.delete(oldestRoom);
      }
      _surfaced.set(roomDir, new Set());
    }

    const handles = _surfaced.get(roomDir);
    if (!handles.has(handle)) {
      while (handles.size >= MAX_HANDLES_PER_ROOM) {
        const oldestHandle = handles.values().next().value;
        if (oldestHandle === undefined) break;
        handles.delete(oldestHandle);
      }
      handles.add(handle);
    }
  } catch (_e) {
    // soft-fail: a note failure must never break the caller's pull
  }
}

/**
 * peekSurfaced(roomDir) -- returns a fresh array copy of the handles
 * currently noted for `roomDir`, WITHOUT clearing them. `[]` for an
 * untracked room or a malformed input. Never throws.
 *
 * @param {string} roomDir
 * @returns {string[]}
 */
function peekSurfaced(roomDir) {
  try {
    if (!_isNonEmptyString(roomDir)) return [];
    const handles = _surfaced.get(roomDir);
    return handles ? Array.from(handles) : [];
  } catch (_e) {
    return [];
  }
}

/**
 * takeSurfaced(roomDir) -- returns a fresh array copy of the handles
 * currently noted for `roomDir`, then DELETES that room's entry entirely
 * (clearing only that room; every other room's notes are untouched). `[]`
 * for an untracked room or a malformed input. Never throws.
 *
 * @param {string} roomDir
 * @returns {string[]}
 */
function takeSurfaced(roomDir) {
  try {
    if (!_isNonEmptyString(roomDir)) return [];
    const handles = _surfaced.get(roomDir);
    const out = handles ? Array.from(handles) : [];
    _surfaced.delete(roomDir);
    return out;
  } catch (_e) {
    return [];
  }
}

/**
 * _resetForTest() -- clears the entire in-process store. Test-only (mirrors
 * lib/mcp/stop-gate-handler.cjs's own _resetForTest and gate-render.cjs's
 * _firedBindingSessions reset idiom).
 */
function _resetForTest() {
  _surfaced = new Map();
}

module.exports = {
  MAX_ROOMS: MAX_ROOMS,
  MAX_HANDLES_PER_ROOM: MAX_HANDLES_PER_ROOM,
  noteSurfaced: noteSurfaced,
  peekSurfaced: peekSurfaced,
  takeSurfaced: takeSurfaced,
  _resetForTest: _resetForTest,
};
