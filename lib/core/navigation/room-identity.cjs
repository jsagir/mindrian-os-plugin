'use strict';
/*
 * Phase 369.25 plan 03 -- room-identity: the ONE owner of a room's identity in room.db.
 *
 * CONTEXT ruling 2026-10-05: "the identity is committed in room.db by room-birth.cjs, for every room; ROOM.md and the
 * registry are projections". This module is the API for that ruling:
 *
 *   writeRoomIdentity(db, ident)            write the seven room.* keys and the Room node inside a caller-owned
 *                                           transaction; throws on any failure (never swallows)
 *   readRoomIdentity(roomDir, opts)         ready with the seven values, or not_ready with exactly one typed reason;
 *                                           writes nothing in the room (reads a copy, or a read-only handle)
 *   repairRoomIdentity(roomDir, opts)       the approved write for a legacy room: every value from a source, the
 *                                           literal 'unknown' where there is none, nothing invented
 *   projectRoomIdentity(roomDir, id, opts)  room_id into .room-root and the registry entry (the two projections)
 *   normalizeRoomPath(p, opts)              Windows path shapes of one folder compare equal
 *
 * The seven keys live in the key/value identity table (lib/core/memory-ops.cjs:25-29) under a room. prefix so they
 * stay apart from the migration and change-log rows.
 *
 * Substrate note: this is an allow-listed navigation submodule (scripts/check-substrate.cjs /^lib\/core\/navigation\//).
 * It requires lib/core/room-db.cjs (sanctioned) to open the write handle for repair; it never requires node:sqlite
 * itself. resolve-active-room.cjs must NOT require this module (rar.12).
 *
 * Canon Part 8: zero network. Canon Part 9: the identity rows and the Room node are system bookkeeping
 * (created_by system, epistemic_type observation; the same v1.5 carve-out room-birth.cjs uses), not a truth claim.
 * Owner rule: only this module writes room.* keys; birth calls writeRoomIdentity inside its STEP 2 transaction.
 *
 * Hyphens only in this file.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const childProcess = require('node:child_process');

const roomDbMod = require('../room-db.cjs');
const roomOpen = require('../room-open.cjs');
const { insertNode } = require('../node-insert.cjs');
const { isSafeSlug } = require('../session-binding.cjs');
const spine = require('./spine-events.cjs');
const { withRoomTx } = require('./room-change-log.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const IDENTITY_KEYS = Object.freeze([
  'room.room_id',
  'room.slug',
  'room.canonical_path',
  'room.parent',
  'room.depth',
  'room.created_at',
  'room.birth_version',
]);

const NOT_READY_REASONS = Object.freeze([
  'room_db_missing',
  'room_db_unreadable',
  'identity_missing',
  'identity_incomplete',
  'identity_path_mismatch',
  'registry_missing_room',
]);

const UNKNOWN = 'unknown';
const NO_PARENT = 'none';

// -- small helpers -----------------------------------------------------------------------------------------------

function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch (_e) { return false; }
}

function nonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}

// A slug that is safe as a registry key and a path segment: isSafeSlug (no '..') AND no separator.
function isRoomSlug(v) {
  return nonEmptyString(v) && isSafeSlug(v) && !/[\\/]/.test(v);
}

function realOrResolved(p) {
  try { return fs.realpathSync(p); } catch (_e) { return path.resolve(String(p)); }
}

function readJsonFile(p) {
  try {
    const v = JSON.parse(fs.readFileSync(p, 'utf8'));
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : null;
  } catch (_e) { return null; }
}

function readRegistry(roomsHome) {
  return readJsonFile(path.join(roomsHome, '.rooms', 'registry.json'));
}

// The registry stores rooms as an object keyed by slug (an array form is tolerated, as room-birth.cjs does).
function registryEntries(reg) {
  const out = [];
  if (!reg) return out;
  const rooms = reg.rooms;
  if (Array.isArray(rooms)) {
    rooms.forEach((r) => { if (r && typeof r === 'object') out.push({ key: r.slug || r.name, entry: r }); });
  } else if (rooms && typeof rooms === 'object') {
    Object.keys(rooms).forEach((k) => { if (rooms[k] && typeof rooms[k] === 'object') out.push({ key: k, entry: rooms[k] }); });
  }
  return out;
}

function registryEntryBySlug(reg, slug) {
  const hit = registryEntries(reg).find((e) => e.key === slug);
  return hit ? hit.entry : null;
}

function resolveRoomsHome(opts) {
  return (opts && nonEmptyString(opts.roomsHome)) ? opts.roomsHome : roomOpen.resolveRoomsHome();
}

function isAbsolutePathAnyPlatform(p) {
  return nonEmptyString(p) && (path.isAbsolute(p) || /^[A-Za-z]:[\\/]/.test(p) || /^\/[A-Za-z](\/|$)/.test(p));
}

// -- normalizeRoomPath (RID-08) ----------------------------------------------------------------------------------

/**
 * Normalize a room path so two spellings of one folder compare equal. Never touches the filesystem.
 * win32: a leading /x/ Git Bash drive form becomes X:\, / becomes \, the drive letter is upper-cased, duplicate
 * separators collapse, a trailing separator is stripped (not on the root). posix: normalize, strip a trailing /.
 *
 * @param {string} p
 * @param {{platform?: string}} [opts]
 * @returns {string}
 */
function normalizeRoomPath(p, opts) {
  const platform = (opts && opts.platform) || process.platform;
  let s = String(p == null ? '' : p);
  if (platform === 'win32') {
    const git = /^\/([A-Za-z])(\/.*|)$/.exec(s);
    if (git) s = git[1].toUpperCase() + ':' + (git[2] || '\\');
    s = s.replace(/\//g, '\\');
    const unc = s.startsWith('\\\\');
    s = s.replace(/\\{2,}/g, '\\');
    if (unc) s = '\\' + s;
    const drive = /^([A-Za-z]):(.*)$/.exec(s);
    if (drive) s = drive[1].toUpperCase() + ':' + drive[2];
    if (/^[A-Za-z]:$/.test(s)) s += '\\';
    if (s.length > 3 && s.endsWith('\\')) s = s.replace(/\\+$/, '');
    if (/^[A-Za-z]:$/.test(s)) s += '\\';
    return s;
  }
  s = path.posix.normalize(s);
  if (s.length > 1) s = s.replace(/\/+$/, '');
  return s === '' ? '/' : s;
}

// Windows file systems are case-insensitive: compare lower-cased there, exactly there.
function samePath(a, b, platform) {
  const x = normalizeRoomPath(a, { platform });
  const y = normalizeRoomPath(b, { platform });
  return platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y;
}

// -- writeRoomIdentity -------------------------------------------------------------------------------------------

function validateIdentity(ident) {
  const i = ident && typeof ident === 'object' ? ident : {};
  const bad = (f) => { throw new Error('identity_invalid:' + f); };
  if (!nonEmptyString(i.room_id)) bad('room_id');
  if (!isRoomSlug(i.slug)) bad('slug');
  if (!isAbsolutePathAnyPlatform(i.canonical_path)) bad('canonical_path');
  if (!(i.parent === NO_PARENT || i.parent === UNKNOWN || isRoomSlug(i.parent))) bad('parent');
  let depth = i.depth;
  if (typeof depth === 'number' && Number.isInteger(depth) && depth >= 0) depth = String(depth);
  if (!(depth === UNKNOWN || (typeof depth === 'string' && /^[0-9]+$/.test(depth)))) bad('depth');
  if (!nonEmptyString(i.created_at)) bad('created_at');
  if (!nonEmptyString(i.birth_version)) bad('birth_version');
  return {
    room_id: i.room_id,
    slug: i.slug,
    canonical_path: i.canonical_path,
    parent: i.parent,
    depth: depth,
    created_at: i.created_at,
    birth_version: i.birth_version,
  };
}

/**
 * Write the seven room.* keys and the Room node. The caller owns the transaction (BEGIN ... COMMIT/ROLLBACK):
 * this function validates first, never catches its own errors, and throws on any failure so the caller's
 * ROLLBACK leaves nothing behind. A different existing room_id throws identity_conflict.
 *
 * @param {import('node:sqlite').DatabaseSync} db write handle owned by the caller
 * @param {{room_id:string, slug:string, canonical_path:string, parent:string, depth:(string|number),
 *          created_at:string, birth_version:string}} ident
 */
function writeRoomIdentity(db, ident) {
  const v = validateIdentity(ident);
  const existing = db.prepare('SELECT value FROM identity WHERE key = ?').get('room.room_id');
  if (existing && existing.value !== v.room_id) throw new Error('identity_conflict');
  const now = new Date().toISOString();
  const up = db.prepare(
    'INSERT INTO identity (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
  );
  IDENTITY_KEYS.forEach((k) => { up.run(k, String(v[k.slice('room.'.length)]), now); });
  insertNode(
    db,
    'room:' + v.slug,
    'Room',
    JSON.stringify({ room: v.slug, room_id: v.room_id, parent: v.parent, depth: v.depth, created_by: 'system' }),
    { source_path: 'system:room-identity', created_by: 'system', epistemic_type: 'observation' }
  );
}

// -- readRoomIdentity --------------------------------------------------------------------------------------------

function notReady(reason, extra) {
  return Object.assign({ ok: false, state: 'not_ready', reason: reason }, extra || {});
}

/**
 * Read the identity. Two doors (live room.db files measure 15 to 28 MB here, too large to copy on every bind):
 *   door 'copy' (DEFAULT): copy room.db plus -wal and -shm to a mkdtemp directory and open the copy read-only; writes
 *                          nothing under roomDir. For the doctor walk, birth readback, repair readback, tests.
 *   door 'in_place':       open roomDir's room.db read-only in place. For hot adapter paths in a process that
 *                          already uses the room (binding, status, write readiness, the face writer, the guardian).
 *
 * @param {string} roomDir
 * @param {{door?:string, checkRegistry?:boolean, roomsHome?:string, platform?:string}} [opts]
 */
function readRoomIdentity(roomDir, opts) {
  const o = opts || {};
  const door = o.door === 'in_place' ? 'in_place' : 'copy';
  const platform = o.platform || process.platform;
  const real = realOrResolved(roomDir);
  const src = path.join(real, '.mindrian', 'room.db');
  if (!isFile(src)) return notReady('room_db_missing', { detail: 'no room.db at ' + src });

  let tmp = null;
  let db = null;
  let rows = null;
  let roomNode = false;
  try {
    let openDir = real;
    if (door === 'copy') {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'room-identity-'));
      fs.mkdirSync(path.join(tmp, '.mindrian'));
      ['', '-wal', '-shm'].forEach((suffix) => {
        if (isFile(src + suffix)) fs.copyFileSync(src + suffix, path.join(tmp, '.mindrian', 'room.db' + suffix));
      });
      openDir = tmp;
    }
    db = spine.openRoomDbReadOnlyForCaller(openDir);
    if (!db) return notReady('room_db_unreadable', { detail: 'read-only open returned no handle' });
    const idCols = db.prepare('PRAGMA table_info(identity)').all().map((c) => c.name);
    if (idCols.indexOf('key') === -1 || idCols.indexOf('value') === -1) {
      return notReady('room_db_unreadable', { detail: 'no identity table' });
    }
    rows = db.prepare('SELECT key, value FROM identity').all();
    const nodeCols = db.prepare('PRAGMA table_info(nodes)').all().map((c) => c.name);
    const slugRow = rows.find((r) => r.key === 'room.slug');
    if (slugRow && nodeCols.indexOf('id') !== -1) {
      roomNode = db.prepare('SELECT COUNT(*) AS n FROM nodes WHERE id = ?').get('room:' + slugRow.value).n > 0;
    }
  } catch (e) {
    return notReady('room_db_unreadable', { detail: String((e && e.message) || e).slice(0, 160) });
  } finally {
    try { spine.closeRoomDbForCaller(db); } catch (_e) { /* best effort */ }
    if (tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
  }

  const stored = {};
  rows.forEach((r) => { if (IDENTITY_KEYS.indexOf(r.key) !== -1) stored[r.key] = String(r.value); });
  const present = IDENTITY_KEYS.filter((k) => Object.prototype.hasOwnProperty.call(stored, k));
  if (present.length === 0) return notReady('identity_missing', { detail: 'no room.* identity rows' });
  if (present.length < IDENTITY_KEYS.length) {
    return notReady('identity_incomplete', { present_keys: present, stored: stored });
  }
  if (!samePath(stored['room.canonical_path'], real, platform)) {
    return notReady('identity_path_mismatch', {
      stored_path: stored['room.canonical_path'],
      actual_path: real,
      detail: 'room.db names ' + stored['room.canonical_path'] + ' but the room is at ' + real,
      stored: stored,
    });
  }
  if (o.checkRegistry !== false) {
    const reg = readRegistry(resolveRoomsHome(o));
    if (!registryEntryBySlug(reg, stored['room.slug'])) {
      return notReady('registry_missing_room', {
        detail: 'registry does not list ' + stored['room.slug'],
        stored: stored,
      });
    }
  }
  return {
    ok: true,
    state: 'ready',
    room_id: stored['room.room_id'],
    slug: stored['room.slug'],
    canonical_path: stored['room.canonical_path'],
    parent: stored['room.parent'],
    depth: stored['room.depth'],
    created_at: stored['room.created_at'],
    birth_version: stored['room.birth_version'],
    room_node: roomNode,
    unknown_keys: IDENTITY_KEYS.filter((k) => stored[k] === UNKNOWN),
  };
}

// -- repairRoomIdentity ------------------------------------------------------------------------------------------

function readIcmSelf(roomDir) {
  try {
    const p = path.join(roomDir, 'ROOM.md');
    if (!isFile(p)) return null;
    const matter = require('gray-matter');
    const data = matter(fs.readFileSync(p, 'utf8')).data;
    return (data && data.icm_self && typeof data.icm_self === 'object') ? data.icm_self : null;
  } catch (_e) { return null; }
}

// The registry entry for THIS folder: matched by path first. A key match is accepted only for an entry that carries
// no path at all, so a copied room never adopts the original's registry facts.
function findRegistryEntry(reg, real, slugCandidates, platform) {
  const all = registryEntries(reg);
  for (const e of all) {
    const p = e.entry.abs_path || e.entry.path;
    if (nonEmptyString(p) && samePath(realOrResolved(p), real, platform)) return e;
  }
  for (const e of all) {
    const p = e.entry.abs_path || e.entry.path;
    if (!nonEmptyString(p) && slugCandidates.indexOf(e.key) !== -1) return e;
  }
  return null;
}

function parseMs(s) {
  if (!nonEmptyString(s)) return NaN;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : NaN;
}

function stampForFile() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function moveAsideDb(roomDir) {
  const dir = path.join(roomDir, '.mindrian');
  const stamp = stampForFile();
  const moved = [];
  ['', '-wal', '-shm'].forEach((suffix) => {
    const from = path.join(dir, 'room.db' + suffix);
    if (isFile(from)) {
      const to = path.join(dir, 'room.db.unreadable-' + stamp + suffix);
      fs.renameSync(from, to);
      moved.push(path.basename(to));
    }
  });
  return moved;
}

/**
 * Repair a legacy room's identity from the sources that exist (registry, .room-root, ROOM.md), inventing nothing.
 * A key with no source is the literal 'unknown' (source 'none'); a minted room_id says minted_by_repair; a
 * different existing room_id is never overwritten (identity_conflict); nothing is written without approvedBy.
 *
 * @param {string} roomDir
 * @param {{approvedBy?:string, createDb?:boolean, moveAsideUnreadable?:boolean, roomsHome?:string,
 *          checkRegistry?:boolean, platform?:string}} [opts]
 */
function repairRoomIdentity(roomDir, opts) {
  const o = opts || {};
  if (!nonEmptyString(o.approvedBy) || o.approvedBy.trim().length === 0) return { ok: false, reason: 'no_approval' };
  const platform = o.platform || process.platform;
  if (!roomDir || !fs.existsSync(roomDir)) return { ok: false, reason: 'room_dir_missing' };
  const real = fs.realpathSync(roomDir);
  const dbPath = path.join(real, '.mindrian', 'room.db');
  const conflicts = [];

  // 1. gather sources, read-only
  const sentinel = readJsonFile(path.join(real, '.room-root'));
  const icm = readIcmSelf(real);
  const roomsHome = resolveRoomsHome(o);
  const reg = readRegistry(roomsHome);
  const slugCands = [sentinel && sentinel.room, icm && icm.room].filter(nonEmptyString);
  const regHit = findRegistryEntry(reg, real, slugCands, platform);
  const entry = regHit ? regHit.entry : null;

  // 2. the db door (nothing is created or moved before a source check could refuse)
  let created_db = false;
  let moved_aside = [];
  if (!isFile(dbPath)) {
    if (o.createDb !== true) return { ok: false, reason: 'room_db_missing' };
    created_db = true;
  }
  let db = null;
  try {
    try {
      db = roomDbMod.openRoomDb(real);
    } catch (e) {
      if (created_db || o.moveAsideUnreadable !== true) {
        return { ok: false, reason: 'room_db_unreadable', detail: String((e && e.message) || e).slice(0, 160) };
      }
      moved_aside = moveAsideDb(real);
      created_db = true;
      db = roomDbMod.openRoomDb(real);
    }

    // 3. resolve the seven values
    const keys = {};
    const set = (k, value, source, extra) => { keys[k] = Object.assign({ value: value, source: source }, extra || {}); };

    // slug: the agreeing value of sentinel.room, the registry key, icm_self.room
    const slugC = [];
    if (sentinel && sentinel.room !== undefined) slugC.push({ source: 'sentinel', value: sentinel.room });
    if (regHit && regHit.key !== undefined) slugC.push({ source: 'registry', value: regHit.key });
    if (icm && icm.room !== undefined) slugC.push({ source: 'room_md', value: icm.room });
    const slugGood = slugC.filter((c) => isRoomSlug(c.value));
    const slugDistinct = Array.from(new Set(slugGood.map((c) => c.value)));
    if (slugGood.length !== slugC.length || slugDistinct.length > 1) {
      conflicts.push({ key: 'room.slug', candidates: slugC });
      set('room.slug', UNKNOWN, 'none');
    } else if (slugDistinct.length === 1) {
      set('room.slug', slugDistinct[0], slugGood[0].source, { corroborated_by: slugGood.slice(1).map((c) => c.source) });
    } else {
      set('room.slug', UNKNOWN, 'none');
    }

    set('room.canonical_path', real, 'filesystem');

    // depth: registry only, an integer; else unknown (never defaulted)
    const regDepth = entry && entry.depth !== undefined && entry.depth !== null && /^[0-9]+$/.test(String(entry.depth))
      ? String(entry.depth) : null;
    if (regDepth !== null) set('room.depth', regDepth, 'registry');
    else set('room.depth', UNKNOWN, 'none');

    // parent: registry.parent, else sentinel.parent, else none when the depth source says 0, else unknown
    if (entry && isRoomSlug(entry.parent)) set('room.parent', entry.parent, 'registry');
    else if (sentinel && isRoomSlug(sentinel.parent)) set('room.parent', sentinel.parent, 'sentinel');
    else if (regDepth === '0') set('room.parent', NO_PARENT, 'registry', { derived_from: 'room.depth' });
    else set('room.parent', UNKNOWN, 'none');

    // created_at: sentinel.born and registry.created agree to the second -> the more precise, both recorded
    const born = sentinel && nonEmptyString(sentinel.born) ? sentinel.born : null;
    const created = entry && nonEmptyString(entry.created) ? entry.created : null;
    const bornMs = parseMs(born);
    const createdMs = parseMs(created);
    const cands = [];
    if (Number.isFinite(bornMs)) cands.push({ source: 'sentinel', value: born });
    if (Number.isFinite(createdMs)) cands.push({ source: 'registry', value: created });
    if (cands.length === 2) {
      if (Math.abs(bornMs - createdMs) <= 1000) {
        const pick = born.length >= created.length ? cands[0] : cands[1];
        set('room.created_at', pick.value, pick.source, { candidates: cands });
      } else {
        conflicts.push({ key: 'room.created_at', candidates: cands });
        set('room.created_at', UNKNOWN, 'none', { candidates: cands });
      }
    } else if (cands.length === 1) {
      set('room.created_at', cands[0].value, cands[0].source);
    } else {
      set('room.created_at', UNKNOWN, 'none');
    }

    set('room.birth_version', UNKNOWN, 'none');

    // room_id: the existing row, else a recorded one, else minted (and named so)
    const row = db.prepare('SELECT value FROM identity WHERE key = ?').get('room.room_id');
    const existingId = row && nonEmptyString(row.value) ? row.value : null;
    const recorded = [];
    if (sentinel && nonEmptyString(sentinel.room_id)) recorded.push({ source: 'sentinel', value: sentinel.room_id });
    if (icm && nonEmptyString(icm.room_id)) recorded.push({ source: 'room_md', value: icm.room_id });
    if (entry && nonEmptyString(entry.room_id)) recorded.push({ source: 'registry', value: entry.room_id });
    const recordedDistinct = Array.from(new Set(recorded.map((c) => c.value)));
    if (existingId && recordedDistinct.some((v) => v !== existingId)) {
      return { ok: false, reason: 'identity_conflict', existing_room_id: existingId, candidates: recorded };
    }
    if (!existingId && recordedDistinct.length > 1) {
      return { ok: false, reason: 'identity_conflict', existing_room_id: null, candidates: recorded };
    }
    if (existingId) set('room.room_id', existingId, 'room_db');
    else if (recorded.length > 0) set('room.room_id', recorded[0].value, recorded[0].source);
    else set('room.room_id', crypto.randomUUID(), 'minted_by_repair');

    // 4. one approved write, in one transaction
    const ident = {};
    IDENTITY_KEYS.forEach((k) => { ident[k.slice('room.'.length)] = keys[k].value; });
    try {
      withRoomTx(db, (d) => writeRoomIdentity(d, ident));
    } catch (e) {
      const msg = String((e && e.message) || e);
      if (msg === 'identity_conflict') return { ok: false, reason: 'identity_conflict', existing_room_id: existingId };
      return { ok: false, reason: 'write_failed', detail: msg.slice(0, 160) };
    }

    // 5. close the write handle, then read back through the copy door
    try { roomDbMod.closeRoomDb(db); } catch (_e) { /* best effort */ }
    db = null;
    const readback = readRoomIdentity(real, {
      door: 'copy', roomsHome: roomsHome, checkRegistry: o.checkRegistry, platform: platform,
    });
    return {
      ok: readback.ok === true,
      room_id: keys['room.room_id'].value,
      room_id_source: keys['room.room_id'].source,
      keys: keys,
      conflicts: conflicts,
      created_db: created_db,
      moved_aside: moved_aside,
      readback: readback,
    };
  } finally {
    try { if (db) roomDbMod.closeRoomDb(db); } catch (_e) { /* best effort */ }
  }
}

// -- projectRoomIdentity -----------------------------------------------------------------------------------------

/**
 * Project the room_id into the two derived places: .room-root (atomic rewrite, every other field kept) and the
 * registry entry (the existing `update <slug> room_id <id>` verb of scripts/room-registry, args passed without a
 * shell). ROOM.md icm_self is regenerated by lib/core/room-map.cjs in plan 07, not here.
 *
 * @param {string} roomDir
 * @param {{room_id:string, slug:string}} identity
 * @param {{roomsHome?:string}} [opts]
 * @returns {{sentinel:boolean, registry:(boolean|string), detail:object}}
 */
function projectRoomIdentity(roomDir, identity, opts) {
  const o = opts || {};
  const id = identity && typeof identity === 'object' ? identity : {};
  const detail = {};
  if (!nonEmptyString(id.room_id) || !isRoomSlug(id.slug)) {
    return { sentinel: false, registry: 'skipped:invalid_identity', detail: { error: 'room_id and a safe slug are required' } };
  }
  const real = realOrResolved(roomDir);

  let sentinelOk = false;
  const sPath = path.join(real, '.room-root');
  const cur = readJsonFile(sPath);
  if (!cur) {
    detail.sentinel = isFile(sPath) ? 'unparseable' : 'missing';
  } else {
    try {
      const next = Object.assign({}, cur, { room_id: id.room_id });
      const tmpPath = sPath + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 10);
      fs.writeFileSync(tmpPath, JSON.stringify(next), 'utf8');
      fs.renameSync(tmpPath, sPath);
      sentinelOk = true;
    } catch (e) {
      detail.sentinel = String((e && e.message) || e).slice(0, 160);
    }
  }

  let registry = false;
  const roomsHome = resolveRoomsHome(o);
  if (!registryEntryBySlug(readRegistry(roomsHome), id.slug)) {
    registry = 'skipped:no_entry';
  } else {
    try {
      childProcess.execFileSync(
        'bash',
        [path.join(REPO_ROOT, 'scripts', 'room-registry'), roomsHome, 'update', id.slug, 'room_id', id.room_id],
        { cwd: REPO_ROOT, stdio: 'pipe', timeout: 10000, env: Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: roomsHome }) }
      );
      registry = true;
    } catch (e) {
      detail.registry = String((e && e.stderr && e.stderr.toString()) || (e && e.message) || e).slice(0, 160);
    }
  }
  return { sentinel: sentinelOk, registry: registry, detail: detail };
}

module.exports = {
  IDENTITY_KEYS,
  NOT_READY_REASONS,
  UNKNOWN,
  NO_PARENT,
  writeRoomIdentity,
  readRoomIdentity,
  repairRoomIdentity,
  projectRoomIdentity,
  normalizeRoomPath,
};
