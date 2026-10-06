'use strict';
/*
 * Phase 369.25 plan 13 -- room-readiness: ONE module answers "may this operation run on this room?".
 *
 * Why it exists (HEAL-02, brief failure test 1, FCLOSE-07). The brief says "Database missing, corrupt, or not
 * writable: no ready-to-write result. A typed reason names the failed requirement", and that "required checks should
 * correspond to the operation being authorized". So readiness is answered PER OPERATION, here, and nowhere else:
 *
 *   governed_write  refused when room.db is missing, unreadable or not writable (a governed write must be recorded)
 *   research        refused when room.db is missing or unreadable (quick, deep, Eureka, analogies; read-mostly)
 *   feyminto_face   refused for every not-ready reason (the face speaks a room's identity, so it needs one)
 *   status          never refused: status always answers and shows the state
 *
 * A legacy room (every room born before this phase has no identity keys in room.db) therefore keeps working for
 * governed writes and research: its missing identity is shown on every result and a recovery card is offered, but
 * nothing is blocked at upgrade. This is also the readiness definition the real-room negative leg (FCLOSE-07)
 * asserts, so every research verb refuses the same rooms for the same reasons.
 *
 * A legacy room is told from a re-minted empty graph by what the room records OUTSIDE room.db (plan 27, Larry's leg
 * B): when the identity is missing but .room-root (or the registry entry for this folder) carries a room_id, the room
 * did have an identity and its graph was recreated empty, so the reason is room_graph_lost and it blocks governed
 * writes and research. A room that records no id anywhere (born before 369.25) keeps reading identity_missing.
 *
 * A folder that is not a room at all (no .room-root) is not "a room whose record is missing": a plain folder with no
 * room.db keeps the legacy path where the first governed write creates the database (many fixtures and the chain tools
 * rely on it), so room_db_missing blocks governed_write and research only for a folder that carries .room-root. This is
 * the same line the heal net draws (lib/core/graph-backfill.cjs step 0a, plan 09). The face and status are unchanged.
 *
 * The plugin never changes permissions: a room.db that cannot be written is a host decision, reported with the
 * remediation restore_write_permission (a person's action) and no recovery card. Every other not-ready reason has
 * the remediation recover_room_record (the heal net, runDeriveBackfill, behind its existing approval).
 *
 * Hook-safe: node built-ins only at load; room-identity is required lazily, only when the caller did not pass an
 * identity result it already read (opts.identity). Never throws for a room problem; throws TypeError for a
 * programmer error (an unknown operation). Canon Part 9 (room.db is the local mind), Part 3 (the recovery is a gate).
 *
 * Hyphens only in this file.
 */
const fs = require('node:fs');
const path = require('node:path');

const OPERATIONS = Object.freeze(['governed_write', 'research', 'feyminto_face', 'status']);

// room-identity NOT_READY_REASONS plus room_db_not_writable (a test pins this list against the owner module).
const ALL_REASONS = Object.freeze([
  'room_db_missing',
  'room_db_unreadable',
  'room_db_not_writable',
  'identity_missing',
  'identity_incomplete',
  'identity_path_mismatch',
  'registry_missing_room',
  // plan 27: identity_missing in a room that records its id outside room.db (not an identity-owner reason; a
  // legacy room records none, so it never gets this one)
  'room_graph_lost',
]);

const BLOCKING = Object.freeze({
  governed_write: Object.freeze(['room_db_missing', 'room_db_unreadable', 'room_db_not_writable', 'room_graph_lost']),
  research: Object.freeze(['room_db_missing', 'room_db_unreadable', 'room_graph_lost']),
  feyminto_face: ALL_REASONS,
  status: Object.freeze([]),
});

// The failed requirement in plain words, one line per reason. Shown verbatim on every refusal.
const REQUIREMENT_LINES = Object.freeze({
  room_db_missing: 'room.db is missing (the room record was never created, or it was removed)',
  room_db_unreadable: 'room.db cannot be opened (it is damaged or is not a database)',
  room_db_not_writable: 'room.db cannot be written (file or folder permissions)',
  identity_missing: 'the room identity is not in room.db',
  identity_incomplete: 'the room identity in room.db is incomplete',
  identity_path_mismatch: 'room.db names a different folder (a moved or copied room)',
  registry_missing_room: 'the rooms registry does not list this room',
  room_graph_lost: "the room's graph was lost and recreated empty (the room record names an id that room.db no longer holds)",
});

const REMEDIATION_RESTORE = 'restore_write_permission';
const REMEDIATION_RECOVER = 'recover_room_record';

function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch (_e) { return false; }
}

function canWrite(p) {
  try { fs.accessSync(p, fs.constants.W_OK); return true; } catch (_e) { return false; }
}

function readIdentity(roomDir, opts) {
  try {
    const mod = require('./navigation/room-identity.cjs');
    return mod.readRoomIdentity(roomDir, { door: 'in_place', roomsHome: opts && opts.roomsHome });
  } catch (e) {
    return { ok: false, state: 'not_ready', reason: 'room_db_unreadable', detail: String((e && e.message) || e).slice(0, 160) };
  }
}

// The id this room records OUTSIDE room.db: .room-root room_id (the plan 07 projection), else the registry entry whose
// path is this folder. A room born before 369.25 records none. Local file reads only; never throws.
function recordedRoomId(dir, o) {
  const nonEmpty = (v) => (typeof v === 'string' && v.length > 0 ? v : null);
  try {
    const root = JSON.parse(fs.readFileSync(path.join(dir, '.room-root'), 'utf8'));
    const fromRoot = root && typeof root === 'object' ? nonEmpty(root.room_id) : null;
    if (fromRoot) return fromRoot;
  } catch (_e) { /* no sentinel, or not parseable: try the registry */ }
  try {
    const roomsHome = (o && typeof o.roomsHome === 'string' && o.roomsHome.length > 0) ? o.roomsHome : require('./room-open.cjs').resolveRoomsHome();
    const reg = JSON.parse(fs.readFileSync(path.join(roomsHome, '.rooms', 'registry.json'), 'utf8'));
    const rooms = reg && reg.rooms;
    const entries = Array.isArray(rooms) ? rooms : (rooms && typeof rooms === 'object' ? Object.keys(rooms).map((k) => rooms[k]) : []);
    const real = (p) => { try { return fs.realpathSync(p); } catch (_e) { return path.resolve(String(p)); } };
    const here = real(dir);
    for (const e of entries) {
      if (e && typeof e === 'object' && typeof e.path === 'string' && real(e.path) === here && nonEmpty(e.room_id)) return e.room_id;
    }
  } catch (_e) { /* no registry */ }
  return null;
}

function answer(operation, reason, roomId, detail, isRoom) {
  if (reason === null) {
    return { ok: true, operation, state: 'ready', reason: null, requirement: null, blocking: false, room_id: roomId || null, remediation: null };
  }
  let blocked = BLOCKING[operation].indexOf(reason) !== -1;
  // a folder that is not a room (no .room-root) is not a room with a missing record: write and research stay open
  if (blocked && reason === 'room_db_missing' && isRoom === false && (operation === 'governed_write' || operation === 'research')) blocked = false;
  const out = {
    ok: !blocked,
    operation,
    state: 'not_ready',
    reason,
    requirement: REQUIREMENT_LINES[reason] || reason,
    blocking: blocked,
    room_id: roomId || null,
    remediation: reason === 'room_db_not_writable' ? REMEDIATION_RESTORE : REMEDIATION_RECOVER,
  };
  if (detail) out.detail = detail;
  return out;
}

/**
 * readinessFor(roomDir, operation, opts) -> { ok, operation, state, reason, requirement, blocking, room_id, remediation }
 *
 *   ok           true when the operation may run (ready, or not ready for a reason this operation does not need)
 *   state        'ready' | 'not_ready' (the room's own state, whatever the operation)
 *   reason       null when ready, else one of ALL_REASONS
 *   requirement  null when ready, else the REQUIREMENT_LINES text
 *   blocking     true when this operation is refused for this reason
 *   remediation  null when ready; 'restore_write_permission' (a person's action) or 'recover_room_record' (the net)
 *
 * opts.identity: a readRoomIdentity result the caller already holds (saves a second read on a hot path).
 * opts.roomsHome: passed to readRoomIdentity for the registry check.
 */
function readinessFor(roomDir, operation, opts) {
  if (OPERATIONS.indexOf(operation) === -1) throw new TypeError('readinessFor: unknown operation ' + String(operation));
  const o = (opts && typeof opts === 'object') ? opts : {};
  const dir = String(roomDir || '');

  if (operation === 'governed_write') {
    const dbPath = path.join(dir, '.mindrian', 'room.db');
    if (isFile(dbPath) && !(canWrite(dbPath) && canWrite(path.dirname(dbPath)))) {
      return answer(operation, 'room_db_not_writable', null, 'no write permission on ' + dbPath + ' or its folder');
    }
  }

  const id = (o.identity && typeof o.identity === 'object') ? o.identity : readIdentity(dir, o);
  if (id && id.ok === true && id.state === 'ready') return answer(operation, null, id.room_id);
  const reason = (id && typeof id.reason === 'string' && ALL_REASONS.indexOf(id.reason) !== -1) ? id.reason : 'room_db_unreadable';
  const stored = (id && id.stored && typeof id.stored === 'object') ? id.stored : null;
  const storedId = stored && typeof stored['room.room_id'] === 'string' && stored['room.room_id'].length > 0 ? stored['room.room_id'] : null;
  const isRoom = isFile(path.join(dir, '.room-root'));
  if (reason === 'identity_missing') {
    // an empty identity in a room that records its id elsewhere is a lost graph, not a legacy room (plan 27)
    const recorded = recordedRoomId(dir, o);
    if (recorded) return answer(operation, 'room_graph_lost', recorded, id && id.detail, isRoom);
  }
  const out = answer(operation, reason, storedId, id && id.detail, isRoom);
  if (reason === 'room_db_missing') out.is_room = isRoom;
  return out;
}

module.exports = { readinessFor, OPERATIONS, REQUIREMENT_LINES, BLOCKING };
