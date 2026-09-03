'use strict';
/*
 * Phase 130-01 -- lens-nodes: the typed HatState + lens-finding node-write
 * chokepoint for the lens-engine (Plan 02) and the hat-persistence rewrite
 * (Plan 03).
 *
 * This module is an allow-listed navigation submodule (scripts/check-substrate.cjs
 * regex /^lib\/core\/navigation\// covers it). It takes a db handle owned by the
 * caller (via lib/core/room-db.cjs openRoomDb) EXACTLY like
 * lib/core/navigation/edges.cjs writeEdge: it NEVER requires node:sqlite and
 * NEVER opens room.db itself, so it stays inside the navigation allow-list with
 * zero substrate bypass. (This is the deliberate contrast with the roomDir-taking
 * sibling lib/core/navigation/spine-events.cjs, which opens room.db internally;
 * the lens writers follow the db-handle convention so the engine can batch a node
 * write and its INFORMS / REJECTED_BECAUSE edge on a single handle.)
 *
 * Exports:
 *   writeHatState(db, color, state)  -> { ok, node_id } | { ok:false, reason }
 *   readHatState(db, color)          -> structured hat-state object (default shape if absent)
 *   readAllHatStates(db)             -> map of the 6 colors (defaults for unwritten)
 *   writeLensFinding(db, params)     -> { ok, node_id } | { ok:false, reason }
 *
 * Phase 130-03 -- roomDir-taking sibling wrappers (the door for the NON-allow-listed
 *   lib/core/hat-persistence.cjs rewrite). Each opens room.db internally via
 *   lib/core/room-db.cjs (legal here -- navigation/ is allow-listed by
 *   scripts/check-substrate.cjs regex /^lib\/core\/navigation\//), routes the
 *   write/read through the db-handle chokepoint above, and ALWAYS closes the
 *   handle in finally. Mirrors lib/core/navigation/spine-events.cjs exactly.
 *   hat-persistence.cjs is NOT allow-listed, so it must NOT require room-db.cjs;
 *   it requires navigation.cjs and calls these roomDir wrappers instead.
 *
 *   writeHatStateByRoomDir(roomDir, color, state) -> { ok, node_id } | { ok:false, reason }
 *   readHatStateByRoomDir(roomDir, color)         -> structured hat-state object (default if absent or no room.db)
 *   readAllHatStatesByRoomDir(roomDir)            -> map of the 6 colors (defaults if no room.db)
 *
 * Canon Part 9 v1.5 (audit-node carve-out): a HatState node is a SYSTEM-
 *   BOOKKEEPING node -- it records what the system DID about hat rotation, not a
 *   truth-claim about the venture. It is NOT in the truth-claim set {claim,
 *   CausalClaim, assumption, decision, opportunity}. So it MAY carry
 *   created_by='system' review_status='confirmed' WITHOUT a human byUser; the
 *   carve-out makes that confirmed-status write canon-legal, not a Part 9 role-5
 *   violation. Mirrors lib/core/navigation/focus.cjs writing a focus_changed
 *   audit node with created_by='system' review_status='confirmed'.
 *
 * Canon Part 8: zero network surface. Pure LOCAL SQLite over a caller-owned
 *   handle. No Brain calls; no user content ever leaves the room.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const path = require('node:path');
const roomDbMod = require('../room-db.cjs');
const { insertNode } = require('../node-insert.cjs');

// The closed 6-color hat set. Mirrors lib/core/hat-persistence.cjs HAT_COLORS.
const HAT_COLORS = Object.freeze(['white', 'red', 'black', 'yellow', 'green', 'blue']);
const HAT_COLOR_SET = Object.freeze(new Set(HAT_COLORS));

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// The default hat-state shape, matching lib/core/hat-persistence.cjs
// loadHatState's default (current_focus 'General analysis', last_analysis
// 'never', empty arrays, session_count 0). Returned by readHatState when the
// node is absent so callers always get a structured object.
function defaultHatState() {
  return {
    current_focus: 'General analysis',
    last_analysis: 'never',
    top_concerns: [],
    top_opportunities: [],
    methodology_notes: [],
    session_count: 0,
  };
}

// Normalize a caller-supplied state object into the canonical hat-state shape.
// Defensive: missing fields fall back to the default; never throws.
function normalizeHatState(state) {
  const s = isPlainObject(state) ? state : {};
  const def = defaultHatState();
  return {
    current_focus: typeof s.current_focus === 'string' ? s.current_focus : def.current_focus,
    last_analysis: typeof s.last_analysis === 'string' ? s.last_analysis : def.last_analysis,
    top_concerns: Array.isArray(s.top_concerns) ? s.top_concerns : def.top_concerns,
    top_opportunities: Array.isArray(s.top_opportunities) ? s.top_opportunities : def.top_opportunities,
    methodology_notes: Array.isArray(s.methodology_notes) ? s.methodology_notes : def.methodology_notes,
    session_count: typeof s.session_count === 'number' ? s.session_count : def.session_count,
  };
}

// writeHatState(db, color, state) -- UPSERT a typed HatState node.
//
// Node id 'hatstate:'+color, type 'HatState', created_by 'system', confidence
// 1.0, review_status 'confirmed' (the Canon Part 9 v1.5 system-bookkeeping
// carve-out), created_at / last_seen_at = Date.now(), properties = the
// JSON.stringify of the structured hat state. The INSERT shape mirrors
// lib/core/navigation/ingestion.cjs verbatim (full provenance columns).
// Defensive: never throws on caller input; returns { ok:false, reason } on
// failure.
function writeHatState(db, color, state) {
  if (typeof color !== 'string' || !HAT_COLOR_SET.has(color)) {
    return { ok: false, reason: 'invalid_hat_color' };
  }
  const normalized = normalizeHatState(state);
  let propsJson;
  try {
    propsJson = JSON.stringify(normalized);
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }
  const nodeId = 'hatstate:' + color;
  try {
    insertNode(db, nodeId, 'HatState', propsJson, {
      source_path: 'system:hat:' + color,
      created_by: 'system',
      confidence: 1.0,
      review_status: 'confirmed',
      // R17-02 (Task 4 Decision 4): 'observation' -- system bookkeeping.
      epistemic_type: 'observation',
    });
  } catch (e) {
    return { ok: false, reason: 'hatstate_write_failed', detail: String(e.message || '').slice(0, 80) };
  }
  return { ok: true, node_id: nodeId };
}

// readHatState(db, color) -- SELECT the HatState node by id and JSON.parse its
// properties. Returns the default-shaped object when the node is absent (or the
// color is non-canonical). Defensive: never throws.
function readHatState(db, color) {
  if (typeof color !== 'string' || !HAT_COLOR_SET.has(color)) {
    return defaultHatState();
  }
  const nodeId = 'hatstate:' + color;
  try {
    const row = db.prepare(
      "SELECT properties FROM nodes WHERE id = ? AND type = 'HatState'"
    ).get(nodeId);
    if (!row || typeof row.properties !== 'string') {
      return defaultHatState();
    }
    let parsed;
    try {
      parsed = JSON.parse(row.properties);
    } catch (_e) {
      return defaultHatState();
    }
    // Re-normalize so a partial / legacy row still returns the full shape.
    return normalizeHatState(parsed);
  } catch (_e) {
    return defaultHatState();
  }
}

// readAllHatStates(db) -- return a map of all 6 colors to their hat-state object
// (defaults for unwritten colors). Mirrors lib/core/hat-persistence.cjs
// loadAllHatStates' "always 6 keys" contract.
function readAllHatStates(db) {
  const out = {};
  for (const color of HAT_COLORS) {
    out[color] = readHatState(db, color);
  }
  return out;
}

// writeLensFinding(db, params) -- UPSERT a typed lens_finding node.
//
// params = { lensType, lens, topic, summary, sessionId }. Node id
// 'lens_finding:'+lensType+':'+sessionId+':'+lens, type 'lens_finding',
// created_by 'system', review_status 'proposed' (a lens finding is a PROPOSED
// surface awaiting the Decision Gate, never auto-confirmed), confidence NULL,
// created_at / last_seen_at = Date.now(), properties = { lensType, lens, topic,
// summary }. It is the node the engine onAccept INFORMS edge points FROM. The
// INSERT shape mirrors ingestion.cjs verbatim. Defensive: never throws.
function writeLensFinding(db, params) {
  if (!isPlainObject(params)) {
    return { ok: false, reason: 'invalid_params' };
  }
  const { lensType, lens, topic, summary, sessionId } = params;
  if (typeof lensType !== 'string' || lensType.length === 0) {
    return { ok: false, reason: 'invalid_lens_type' };
  }
  if (typeof lens !== 'string' || lens.length === 0) {
    return { ok: false, reason: 'invalid_lens' };
  }
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    return { ok: false, reason: 'invalid_session_id' };
  }
  const props = {
    lensType: lensType,
    lens: lens,
    topic: typeof topic === 'string' ? topic : '',
    summary: typeof summary === 'string' ? summary : '',
  };
  let propsJson;
  try {
    propsJson = JSON.stringify(props);
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }
  const nodeId = 'lens_finding:' + lensType + ':' + sessionId + ':' + lens;
  const sourcePath = 'lens:' + lensType + ':' + sessionId;
  try {
    // confidence omitted (byte-equivalent to the prior explicit NULL).
    insertNode(db, nodeId, 'lens_finding', propsJson, {
      source_path: sourcePath,
      created_by: 'system',
      review_status: 'proposed',
      // R17-02 (Task 4 Decision 4): 'interpretation'.
      epistemic_type: 'interpretation',
    });
  } catch (e) {
    return { ok: false, reason: 'lens_finding_write_failed', detail: String(e.message || '').slice(0, 80) };
  }
  return { ok: true, node_id: nodeId };
}

// ---------------------------------------------------------------------------
// Phase 130-03 -- roomDir-taking sibling wrappers (the door for the rewritten
// lib/core/hat-persistence.cjs, which is NOT allow-listed and so may never open
// room.db itself). Each opens room.db internally via room-db.cjs (legal because
// navigation/ is allow-listed), routes through the db-handle chokepoint above,
// and ALWAYS closes the handle in finally. Mirrors spine-events.cjs structure.
// ---------------------------------------------------------------------------

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

// writeHatStateByRoomDir(roomDir, color, state) -- open room.db, writeHatState,
// always close. Returns { ok:false, reason:'no_room_db' } when room.db is absent
// (graceful, mirrors spine-events; never throws).
function writeHatStateByRoomDir(roomDir, color, state) {
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
    return writeHatState(db, color, state);
  } finally {
    try { roomDbMod.closeRoomDb(db); } catch (_e) { /* tolerant */ }
  }
}

// readHatStateByRoomDir(roomDir, color) -- open room.db, readHatState, always
// close. Returns the default-shaped object when room.db is absent so callers
// always get a structured object (mirrors readHatState's absent-node contract).
function readHatStateByRoomDir(roomDir, color) {
  if (!_hasRoomDb(roomDir)) {
    return defaultHatState();
  }
  let db;
  try {
    db = roomDbMod.openRoomDb(roomDir);
  } catch (_e) {
    return defaultHatState();
  }
  try {
    return readHatState(db, color);
  } finally {
    try { roomDbMod.closeRoomDb(db); } catch (_e) { /* tolerant */ }
  }
}

// readAllHatStatesByRoomDir(roomDir) -- open room.db once, read all 6 colors,
// always close. Returns the all-defaults map when room.db is absent.
function readAllHatStatesByRoomDir(roomDir) {
  if (!_hasRoomDb(roomDir)) {
    const out = {};
    for (const color of HAT_COLORS) out[color] = defaultHatState();
    return out;
  }
  let db;
  try {
    db = roomDbMod.openRoomDb(roomDir);
  } catch (_e) {
    const out = {};
    for (const color of HAT_COLORS) out[color] = defaultHatState();
    return out;
  }
  try {
    return readAllHatStates(db);
  } finally {
    try { roomDbMod.closeRoomDb(db); } catch (_e) { /* tolerant */ }
  }
}

module.exports = {
  HAT_COLORS,
  writeHatState,
  readHatState,
  readAllHatStates,
  writeLensFinding,
  writeHatStateByRoomDir,
  readHatStateByRoomDir,
  readAllHatStatesByRoomDir,
};
