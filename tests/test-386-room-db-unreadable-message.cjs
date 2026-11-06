#!/usr/bin/env node
/**
 * Plan 386-45 (finding B18): "room.db cannot be opened (it is damaged ...)" was one fixed
 * line for every failure. A healthy room.db on a Windows drive, held by a Windows program,
 * gave SQLITE_CANTOPEN and the same "damaged" line. The refusal now names the cause class.
 *
 * Canon Part 8 and 9: fixture rooms and error doubles only. No real room is read. HOME and
 * the rooms home point at a temporary folder. The open mode of room.db is not changed.
 *
 * Arms:
 *   RM1  busy double (SQLITE_BUSY)              says another process, no damage
 *   RM2  io double (SQLITE_IOERR)               says the drive cannot give locks or shared memory
 *   RM3  cannot-open double (SQLITE_CANTOPEN)   says path or drive, no damage
 *   RM4  garbage file named room.db             still says damaged, reason unchanged
 *   RM5  TypeError double                       names the class, says it stopped before SQLite
 *   RM6  every cause keeps reason room_db_unreadable, adds a cause field, plain line
 *   RM7  the open mode in lib/core/room-db.cjs is unchanged (WAL, timeout 5000)
 *   RM8  a result with no error and a db that opens now gives the busy cause (a transient hold)
 *   RM9  the session-start path (runDeriveBackfill, stop after readiness) carries the cause
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
function ok(label, cond, detail) {
  if (cond) {
    console.log('ok - ' + label);
  } else {
    failures += 1;
    console.log('FAIL - ' + label + (detail ? ' :: ' + detail : ''));
  }
}

const tmpRoots = [];
const FAKE_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 't386-45-home-'));
tmpRoots.push(FAKE_HOME);
process.env.HOME = FAKE_HOME;
process.env.USERPROFILE = FAKE_HOME;
process.env.MINDRIAN_ROOMS_HOME = path.join(FAKE_HOME, 'MindrianRooms');
delete process.env.CLAUDE_ACTIVE_ROOM;

function fixtureRoom(dbBytes) {
  const room = fs.mkdtempSync(path.join(os.tmpdir(), 't386-45-room-'));
  tmpRoots.push(room);
  fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(room, '.room-root'), '{}');
  if (dbBytes !== null) fs.writeFileSync(path.join(room, '.mindrian', 'room.db'), dbBytes);
  return room;
}

const readiness = require(path.join(ROOT, 'lib', 'core', 'room-readiness.cjs'));
const identityMod = require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-identity.cjs'));
const realRead = identityMod.readRoomIdentity;

// A node:sqlite error shape: code ERR_SQLITE_ERROR, a numeric errcode, a message.
function sqliteDouble(errcode, message) {
  return Object.assign(new Error(message), { code: 'ERR_SQLITE_ERROR', errcode: errcode, errstr: message });
}

function withThrow(err, room) {
  identityMod.readRoomIdentity = () => { throw err; };
  try {
    return readiness.readinessFor(room, 'research', { roomsHome: path.join(FAKE_HOME, 'MindrianRooms') });
  } finally {
    identityMod.readRoomIdentity = realRead;
  }
}

function withReturn(result, room) {
  identityMod.readRoomIdentity = () => result;
  try {
    return readiness.readinessFor(room, 'research', { roomsHome: path.join(FAKE_HOME, 'MindrianRooms') });
  } finally {
    identityMod.readRoomIdentity = realRead;
  }
}

const room = fixtureRoom('placeholder');
const busy = withThrow(sqliteDouble(5, 'database is locked'), room);
const io = withThrow(sqliteDouble(10 | (18 << 8), 'disk I/O error'), room);
const cantopen = withThrow(sqliteDouble(14, 'unable to open database file'), room);
const typeErr = withThrow(new TypeError('x is not a function'), room);

const req = (r) => String((r && r.requirement) || '');

ok('RM1 a busy error says another process holds the file and names no damage',
  /another process/.test(req(busy)) && !/damaged/.test(req(busy)), req(busy));
ok('RM2 an input or output error says the drive cannot give locks or shared memory',
  /locks or shared memory/.test(req(io)) && !/damaged/.test(req(io)), req(io));
ok('RM3 a cannot-open error says path or drive and names no damage',
  /path or the drive/.test(req(cantopen)) && !/damaged/.test(req(cantopen)), req(cantopen));

// RM4: a real garbage file named room.db (the real reader runs, no double)
const garbageRoom = fixtureRoom('this is plain text, not a SQLite file\n'.repeat(40));
const garbage = readiness.readinessFor(garbageRoom, 'research', { roomsHome: path.join(FAKE_HOME, 'MindrianRooms') });
ok('RM4 a text file named room.db still says damaged, reason unchanged',
  garbage.reason === 'room_db_unreadable' && /damaged/.test(req(garbage)), JSON.stringify({ reason: garbage.reason, req: req(garbage) }));

ok('RM5 a TypeError double names the class and says it stopped before SQLite',
  /TypeError/.test(req(typeErr)) && /before SQLite/.test(req(typeErr)) && !/damaged/.test(req(typeErr)), req(typeErr));

// RM6: reason kept, cause added, plain English
const CAUSES = ['busy', 'io', 'cannot_open', 'not_a_database', 'other'];
const cases = { busy, io, cantopen, garbage, typeErr };
const bad = [];
for (const k of Object.keys(cases)) {
  const r = cases[k];
  const line = req(r);
  const plain = line.length > 20 && !/[\u2013\u2014]/.test(line) && !line.includes(room) && !line.includes(garbageRoom) && !/[\\/]/.test(line);
  if (r.reason !== 'room_db_unreadable' || CAUSES.indexOf(r.cause) === -1 || !plain) {
    bad.push(k + ':' + r.reason + ':' + r.cause);
  }
}
const want = { busy: 'busy', io: 'io', cantopen: 'cannot_open', garbage: 'not_a_database', typeErr: 'other' };
for (const k of Object.keys(want)) if (cases[k].cause !== want[k]) bad.push(k + ' wanted ' + want[k] + ' got ' + cases[k].cause);
ok('RM6 every cause keeps reason room_db_unreadable and adds a typed plain cause', bad.length === 0, bad.join('; '));

// RM7: the open mode is unchanged
{
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'core', 'room-db.cjs'), 'utf8');
  ok('RM7 openRoomDb still runs journal_mode WAL with timeout 5000',
    src.includes("db.exec('PRAGMA journal_mode = WAL')") && src.includes('new DatabaseSync(dbPath, { timeout: 5000 })'));
}

// RM8: no error, a db that opens on the probe: a transient hold, cause busy
{
  const { DatabaseSync } = require('node:sqlite');
  const okRoom = fixtureRoom(null);
  const d = new DatabaseSync(path.join(okRoom, '.mindrian', 'room.db'));
  d.exec('CREATE TABLE identity (key TEXT, value TEXT)');
  d.close();
  const r = withReturn({ ok: false, state: 'not_ready', reason: 'room_db_unreadable', detail: 'read-only open returned no handle' }, okRoom);
  ok('RM8 a swallowed open error on a db that opens now gives the busy cause',
    r.reason === 'room_db_unreadable' && r.cause === 'busy' && /another process/.test(req(r)), JSON.stringify({ cause: r.cause, req: req(r) }));
}

// RM9: the session-start path
(async () => {
  try {
    const backfill = require(path.join(ROOT, 'lib', 'core', 'graph-backfill.cjs'));
    const res = await backfill.runDeriveBackfill({ roomDir: garbageRoom, stopAfterReadiness: true, roomsHome: path.join(FAKE_HOME, 'MindrianRooms') });
    const r = res && res.readiness;
    ok('RM9 the session-start readiness result carries the cause and the plain line',
      !!r && r.reason === 'room_db_unreadable' && r.cause === 'not_a_database'
        && readiness.requirementFor(r.reason, r.cause) === req(garbage),
      JSON.stringify(r));
  } catch (e) {
    ok('RM9 the session-start readiness result carries the cause and the plain line', false, String(e && e.message));
  }
  for (const d of tmpRoots) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
  if (failures > 0) {
    console.log(failures + ' arm(s) failed');
    process.exit(1);
  }
  console.log('all arms passed');
})();
