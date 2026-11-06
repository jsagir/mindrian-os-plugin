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

// Plan 386-45 (B18): room_db_unreadable was one fixed line for every failure, so a healthy room.db held by a
// Windows program (SQLITE_CANTOPEN) read as "damaged". The reason stays room_db_unreadable (readers and reason
// sets are unchanged); the field cause says why, and the requirement line names it in plain words.
const CAUSES = Object.freeze(['busy', 'io', 'cannot_open', 'not_a_database', 'other']);
const CAUSE_LINES = Object.freeze({
  busy: 'room.db is in use by another process, so it could not be read just now (try again)',
  io: 'room.db sits on a drive that cannot give the file locks or shared memory it needs (a Windows drive read from WSL)',
  cannot_open: 'room.db could not be opened: the path or the drive refused access, or another program holds the file (a Windows drive read from WSL)',
  not_a_database: REQUIREMENT_LINES.room_db_unreadable,
  other: 'room.db could not be opened for another reason',
});

function className(err) {
  const n = err && typeof err === 'object' && typeof err.name === 'string' ? err.name : 'Error';
  return n.replace(/[^A-Za-z0-9_]/g, '').slice(0, 40) || 'Error';
}

/**
 * causeOfError(err) -> { cause, cause_class, cause_stage }. Never throws. Reads the SQLite result code of a
 * node:sqlite error (primary code = errcode & 0xff), the typed room-db errors by name (no require, so the load
 * stays hook-safe), then the message. cause_stage is 'sqlite' when SQLite answered and 'script' when it did not.
 */
function causeOfError(err) {
  const cls = className(err);
  try {
    if (err && err.name === 'RoomDbBusyError') return { cause: 'busy', cause_class: cls, cause_stage: 'sqlite' };
    const meta = err && typeof err.meta === 'object' && err.meta ? err.meta : null;
    const code = (err && typeof err.errcode === 'number') ? err.errcode : (meta && typeof meta.errcode === 'number' ? meta.errcode : null);
    if (code !== null) {
      const primary = code & 0xff;
      let cause = 'other';
      if (primary === 5 || primary === 6) cause = 'busy';
      else if (primary === 10) cause = 'io';
      else if (primary === 14) cause = 'cannot_open';
      else if (primary === 26 || primary === 11) cause = 'not_a_database';
      return { cause: cause, cause_class: cause === 'other' ? 'SQLite code ' + primary : cls, cause_stage: 'sqlite' };
    }
    const sqliteShaped = !!err && typeof err.code === 'string' && err.code.indexOf('ERR_SQLITE') === 0;
    if (sqliteShaped || (err && err.name === 'RoomDbBrokenError')) {
      const msg = String((err && err.message) || '') + ' ' + String((meta && meta.causeMessage) || '');
      let cause = 'other';
      if (/database is locked|database table is locked|busy/i.test(msg)) cause = 'busy';
      else if (/disk I.O error|shared.?memory/i.test(msg)) cause = 'io';
      else if (/unable to open database/i.test(msg)) cause = 'cannot_open';
      else if (/not a database|malformed|corrupt/i.test(msg)) cause = 'not_a_database';
      return { cause: cause, cause_class: cls, cause_stage: 'sqlite' };
    }
  } catch (_e) { /* fall through to other */ }
  return { cause: 'other', cause_class: cls, cause_stage: 'script' };
}

/**
 * unreadableCause(roomDir, err, detail) -> { cause, cause_class, cause_stage }. With a thrown error, the error
 * decides. With none (room-identity returns a result and drops the SQLite error), look at the file itself, local
 * and read-only: the first 16 bytes, then one read-only open. A file that opens now was held a moment ago: busy.
 */
function unreadableCause(roomDir, err, detail) {
  if (err) return causeOfError(err);
  if (detail === 'no identity table') return { cause: 'not_a_database', cause_class: 'Error', cause_stage: 'sqlite' };
  const dbPath = path.join(String(roomDir || ''), '.mindrian', 'room.db');
  try {
    const fd = fs.openSync(dbPath, 'r');
    let size = 0;
    let head = Buffer.alloc(16);
    try {
      size = fs.fstatSync(fd).size;
      fs.readSync(fd, head, 0, 16, 0);
    } finally {
      fs.closeSync(fd);
    }
    if (size > 0 && (size < 16 || head.toString('latin1') !== 'SQLite format 3\u0000')) {
      return { cause: 'not_a_database', cause_class: 'Error', cause_stage: 'sqlite' };
    }
  } catch (e) {
    const c = e && e.code;
    if (c === 'EIO') return { cause: 'io', cause_class: className(e), cause_stage: 'script' };
    return { cause: 'cannot_open', cause_class: className(e), cause_stage: 'script' };
  }
  // One read-only open through the navigation door module (the only place that may touch node:sqlite).
  const probe = require('./navigation/room-identity.cjs').probeRoomDbReadOnly(dbPath);
  if (probe && probe.ok === false) return causeOfError(probe.error);
  return { cause: 'busy', cause_class: 'Error', cause_stage: 'sqlite' };
}

/** The requirement line for a reason and an optional cause. Without a cause it is REQUIREMENT_LINES[reason]. */
function requirementFor(reason, cause, causeClass, causeStage) {
  if (reason === 'room_db_unreadable' && CAUSES.indexOf(cause) !== -1) {
    if (cause === 'other') {
      const cls = typeof causeClass === 'string' && causeClass.length > 0 ? causeClass : 'Error';
      return causeStage === 'script'
        ? 'room.db could not be checked: a ' + cls + ' stopped the check before SQLite answered'
        : CAUSE_LINES.other + ' (' + cls + ')';
    }
    return CAUSE_LINES[cause];
  }
  return REQUIREMENT_LINES[reason] || reason;
}

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
    const res = { ok: false, state: 'not_ready', reason: 'room_db_unreadable', detail: String((e && e.message) || e).slice(0, 160) };
    // Plan 386-45: keep the thrown error for the cause, hidden from JSON and from copies of the result.
    Object.defineProperty(res, 'thrown', { value: e, enumerable: false });
    return res;
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

function answer(operation, reason, roomId, detail, isRoom, causeInfo) {
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
    requirement: causeInfo ? requirementFor(reason, causeInfo.cause, causeInfo.cause_class, causeInfo.cause_stage) : (REQUIREMENT_LINES[reason] || reason),
    blocking: blocked,
    room_id: roomId || null,
    remediation: reason === 'room_db_not_writable' ? REMEDIATION_RESTORE : REMEDIATION_RECOVER,
  };
  if (detail) out.detail = detail;
  if (causeInfo) {
    out.cause = causeInfo.cause;
    if (causeInfo.cause === 'other') { out.cause_class = causeInfo.cause_class; out.cause_stage = causeInfo.cause_stage; }
  }
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
  // Plan 386-45 (B18): say why room.db could not be read (busy, io, cannot_open, not_a_database, other).
  const causeInfo = reason === 'room_db_unreadable' ? unreadableCause(dir, id && id.thrown, id && id.detail) : null;
  const out = answer(operation, reason, storedId, id && id.detail, isRoom, causeInfo);
  if (reason === 'room_db_missing') out.is_room = isRoom;
  return out;
}

module.exports = { readinessFor, OPERATIONS, REQUIREMENT_LINES, BLOCKING, CAUSES, CAUSE_LINES, causeOfError, unreadableCause, requirementFor };
