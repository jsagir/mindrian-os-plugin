#!/usr/bin/env node
/**
 * Plan 386-47 (finding B19): an approved recovery must not move a healthy room.db aside after a
 * false unreadable. repairRoomIdentity renamed room.db, -wal and -shm aside on ANY open failure
 * once a recovery card was approved. A transient lock (SQLITE_CANTOPEN on a Windows drive) could
 * therefore move a healthy file. Only a not-a-database failure on a file without the SQLite
 * header may move the file; busy, io, cannot_open and other give a person action and no card.
 *
 * Canon Part 8 and 9: synthetic fixture rooms and openRoomDb doubles only. No real room is read,
 * copied, opened or touched. HOME and the rooms home point at a temporary folder. The open path of
 * room.db (WAL, timeout 5000, migration chain) is not changed.
 *
 * Arms:
 *   MA1  cannot_open double on a healthy file   typed refusal, file, -wal and -shm stay
 *   MA2  busy double                            the same
 *   MA3  io double                              the same
 *   MA4  TypeError double (other)               the same
 *   MA5  real garbage file, real open           still moved aside, new room.db, damaged file kept
 *   MA6  not-a-database error, valid header     NOT moved (the header belt)
 *   MA7a readiness for busy, io, cannot_open, other: person action, no recovery card
 *   MA7b readiness for a real not-a-database file: recover_room_record and the card, as before
 *   MA8  runDeriveBackfill with approval on busy, io, cannot_open: not recovered, nothing moved
 *   MA9  the open path of room.db is unchanged
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');

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
const FAKE_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 't386-47-home-'));
tmpRoots.push(FAKE_HOME);
process.env.HOME = FAKE_HOME;
process.env.USERPROFILE = FAKE_HOME;
process.env.MINDRIAN_ROOMS_HOME = path.join(FAKE_HOME, 'MindrianRooms');
delete process.env.CLAUDE_ACTIVE_ROOM;
const ROOMS_HOME = path.join(FAKE_HOME, 'MindrianRooms');

const { buildRoom } = require(path.join(ROOT, 'tests', 'helpers', 'synthetic-room-db.cjs'));
const roomDbMod = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
const idMod = require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-identity.cjs'));
const readiness = require(path.join(ROOT, 'lib', 'core', 'room-readiness.cjs'));
const sessionRoom = require(path.join(ROOT, 'lib', 'mcp', 'session-room.cjs'));
const gateMod = require(path.join(ROOT, 'lib', 'mcp', 'room-readiness-gate.cjs'));
const backfill = require(path.join(ROOT, 'lib', 'core', 'graph-backfill.cjs'));
const realOpen = roomDbMod.openRoomDb;
const realRead = idMod.readRoomIdentity;

function sha(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }

// A synthetic room: .room-root, ROOM.md, a healthy room.db (kind healthy) or a text file named
// room.db (kind garbage), and a fake -wal and -shm beside it.
function fixtureRoom(kind) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't386-47-room-'));
  tmpRoots.push(dir);
  fs.writeFileSync(path.join(dir, '.room-root'), '{}');
  fs.writeFileSync(path.join(dir, 'ROOM.md'), '---\nicm_self:\n  room: synth-room\n---\n');
  if (kind === 'garbage') {
    fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.mindrian', 'room.db'), 'this is plain text, not a SQLite file\n'.repeat(40));
  } else {
    buildRoom(dir, 'gate-empty');
  }
  fs.writeFileSync(path.join(dir, '.mindrian', 'room.db-wal'), 'wal-bytes');
  fs.writeFileSync(path.join(dir, '.mindrian', 'room.db-shm'), 'shm-bytes');
  return dir;
}

const sq = (code, msg) => Object.assign(new Error(msg), { code: 'ERR_SQLITE_ERROR', errcode: code });
const ERR = {
  cannot_open: () => sq(14, 'unable to open database file'),
  busy: () => new roomDbMod.RoomDbBusyError('room.db is busy', { errcode: 5 }),
  io: () => sq(10 | (18 << 8), 'disk I/O error'),
  other: () => new TypeError('x is not a function'),
  notadb: () => new roomDbMod.RoomDbBrokenError('room.db is not readable as a database', { errcode: 26, causeMessage: 'file is not a database' }),
};

// Throw once on the first openRoomDb call, then use the real function.
function throwOnce(makeErr) {
  let first = true;
  roomDbMod.openRoomDb = function (d, o) {
    if (first) { first = false; throw makeErr(); }
    return realOpen(d, o);
  };
}
function throwAlways(makeErr) {
  roomDbMod.openRoomDb = function () { throw makeErr(); };
}
function restore() { roomDbMod.openRoomDb = realOpen; idMod.readRoomIdentity = realRead; }

function repair(dir) {
  try {
    return idMod.repairRoomIdentity(dir, {
      approvedBy: 'gate:t386-47', createDb: true, moveAsideUnreadable: true, roomsHome: ROOMS_HOME, checkRegistry: false,
    });
  } finally {
    restore();
  }
}

function movedNames(dir) {
  return fs.readdirSync(path.join(dir, '.mindrian')).filter((n) => n.indexOf('room.db.unreadable-') === 0);
}

function staysPut(dir, before) {
  const p = path.join(dir, '.mindrian', 'room.db');
  return fs.existsSync(p) && sha(p) === before
    && fs.existsSync(p + '-wal') && fs.readFileSync(p + '-wal', 'utf8') === 'wal-bytes'
    && fs.existsSync(p + '-shm') && fs.readFileSync(p + '-shm', 'utf8') === 'shm-bytes'
    && movedNames(dir).length === 0;
}

function falseUnreadableArm(label, causeWanted, makeErr) {
  const dir = fixtureRoom('healthy');
  const before = sha(path.join(dir, '.mindrian', 'room.db'));
  throwOnce(makeErr);
  const res = repair(dir);
  const typed = !!res && res.ok === false && res.reason === 'room_db_unreadable' && res.cause === causeWanted;
  ok(label + ' typed refusal room_db_unreadable with cause ' + causeWanted, typed, JSON.stringify(res && { ok: res.ok, reason: res.reason, cause: res.cause }));
  ok(label + ' room.db, -wal and -shm stay where they are, byte for byte, no unreadable-* file', staysPut(dir, before),
    'moved=' + JSON.stringify(movedNames(dir)));
}

async function main() {
  falseUnreadableArm('MA1', 'cannot_open', ERR.cannot_open);
  falseUnreadableArm('MA2', 'busy', ERR.busy);
  falseUnreadableArm('MA3', 'io', ERR.io);
  falseUnreadableArm('MA4', 'other', ERR.other);

  // MA5: the legitimate recovery, a real garbage file with the real open.
  {
    const dir = fixtureRoom('garbage');
    const dbp = path.join(dir, '.mindrian', 'room.db');
    const garbageBytes = fs.readFileSync(dbp);
    const res = repair(dir);
    const moved = movedNames(dir);
    const keptBeside = moved.some((n) => n.endsWith('Z') && fs.readFileSync(path.join(dir, '.mindrian', n)).equals(garbageBytes));
    const head = fs.existsSync(dbp) ? fs.readFileSync(dbp).subarray(0, 15).toString('latin1') : '';
    ok('MA5 a real garbage room.db is still moved aside, a new room.db is created and the damaged file is kept beside it',
      !!res && res.ok === true && Array.isArray(res.moved_aside) && res.moved_aside.length >= 1 && keptBeside && head === 'SQLite format 3',
      JSON.stringify(res && { ok: res.ok, reason: res.reason, moved_aside: res.moved_aside }) + ' head=' + head);
  }

  // MA6: the belt. A not-a-database error on a file that starts with the SQLite header is never moved.
  {
    const dir = fixtureRoom('healthy');
    const before = sha(path.join(dir, '.mindrian', 'room.db'));
    throwOnce(ERR.notadb);
    const res = repair(dir);
    ok('MA6 a not-a-database error on a file with a valid SQLite header is a typed refusal and the file is not moved',
      !!res && res.ok === false && res.reason === 'room_db_unreadable' && res.cause === 'not_a_database' && staysPut(dir, before),
      JSON.stringify(res && { ok: res.ok, reason: res.reason, cause: res.cause, moved: res.moved_aside }) + ' moved=' + JSON.stringify(movedNames(dir)));
  }

  // MA7a: readiness for the non-damage causes. The identity result carries the thrown error.
  {
    const cases = { busy: ERR.busy, io: ERR.io, cannot_open: ERR.cannot_open, other: ERR.other };
    const lineOk = {
      busy: (l) => /close the program/i.test(l) && /try again/i.test(l),
      io: (l) => /drive is connected and available/i.test(l) && /try again/i.test(l),
      cannot_open: (l) => /drive is connected and available/i.test(l) && /try again/i.test(l),
      other: (l) => /TypeError/.test(l) && /nothing was changed/i.test(l),
    };
    const bad = [];
    for (const k of Object.keys(cases)) {
      const dir = fixtureRoom('healthy');
      const id = { ok: false, state: 'not_ready', reason: 'room_db_unreadable' };
      Object.defineProperty(id, 'thrown', { value: cases[k](), enumerable: false });
      const r = readiness.readinessFor(dir, 'governed_write', { identity: id, roomsHome: ROOMS_HOME });
      if (r.cause !== k) bad.push(k + ' cause ' + r.cause);
      if (r.remediation === 'recover_room_record' || typeof r.remediation !== 'string' || r.remediation.length === 0) bad.push(k + ' remediation ' + r.remediation);
      if (!lineOk[k](String(r.requirement))) bad.push(k + ' line: ' + r.requirement);
      // the session path: no card is minted
      idMod.readRoomIdentity = () => id;
      let w;
      try {
        w = sessionRoom.resolveMcpWriteRoom({ sessionId: 'sess-t386-47-' + k, ctx: { fallbackRoomDir: dir } });
      } finally {
        restore();
      }
      const rf = (w && w.refusal) || {};
      if (rf.recovery_gate_id || rf.recovery_card) bad.push(k + ' card minted');
      if (!(w && w.ok === false && rf.not_ready_reason === 'room_db_unreadable')) bad.push(k + ' write not refused');
    }
    ok('MA7a busy, io, cannot_open and other give a person action in plain words and no recovery card', bad.length === 0, bad.join('; '));
  }

  // MA7b: a real not-a-database file keeps the remediation and the card.
  {
    const dir = fixtureRoom('garbage');
    const r = readiness.readinessFor(dir, 'governed_write', { roomsHome: ROOMS_HOME });
    const w = sessionRoom.resolveMcpWriteRoom({ sessionId: 'sess-t386-47-garbage', ctx: { fallbackRoomDir: dir } });
    const rf = (w && w.refusal) || {};
    const card = rf.recovery_card || {};
    const labels = Array.isArray(card.options) ? card.options.map((o) => o.label).join('|') : '';
    ok('MA7b a real not-a-database file keeps recover_room_record, the card and its two options',
      r.reason === 'room_db_unreadable' && r.cause === 'not_a_database' && r.remediation === 'recover_room_record'
        && typeof rf.recovery_gate_id === 'string' && rf.recovery_gate_id.length > 0
        && card.header === gateMod.RECOVERY_CARD_HEADER && labels === 'Recover the record|Not now',
      JSON.stringify({ reason: r.reason, cause: r.cause, remediation: r.remediation, gate: rf.recovery_gate_id, labels: labels }));
  }

  // MA8: the approved recovery through runDeriveBackfill. The identity read says unreadable; the open double throws.
  {
    const bad = [];
    for (const k of ['busy', 'io', 'cannot_open']) {
      const dir = fixtureRoom('healthy');
      const before = sha(path.join(dir, '.mindrian', 'room.db'));
      idMod.readRoomIdentity = () => ({ ok: false, state: 'not_ready', reason: 'room_db_unreadable', detail: 'double' });
      throwAlways(ERR[k]);
      let result;
      try {
        result = await backfill.runDeriveBackfill({
          roomDir: dir, approvedBy: 'gate:t386-47', deriveFn: () => [], approveFolders: [], roomsHome: ROOMS_HOME,
        });
      } catch (e) {
        bad.push(k + ' threw ' + String((e && e.message) || e).slice(0, 60));
      } finally {
        restore();
      }
      const r = (result && result.readiness) || {};
      if (r.recovered !== false) bad.push(k + ' recovered ' + r.recovered);
      if (!Array.isArray(r.moved_aside) || r.moved_aside.length !== 0) bad.push(k + ' moved_aside ' + JSON.stringify(r.moved_aside));
      if (r.repair_reason !== 'room_db_unreadable') bad.push(k + ' repair_reason ' + r.repair_reason);
      if (r.cause !== k) bad.push(k + ' cause ' + r.cause);
      const msg = typeof gateMod.notRecoveredMessage === 'function' ? String(gateMod.notRecoveredMessage(r)) : '(no notRecoveredMessage export)';
      if (!(/try again/i.test(msg) && /nothing was moved/i.test(msg))) bad.push(k + ' message ' + msg);
      // The backfill goes on after a failed recovery and may open the file again (a real open can rewrite a
      // fake -wal), so this arm checks the room.db bytes and the absence of any moved file.
      const dbNow = path.join(dir, '.mindrian', 'room.db');
      if (!(fs.existsSync(dbNow) && sha(dbNow) === before && movedNames(dir).length === 0)) bad.push(k + ' file moved');
    }
    ok('MA8 an approved recovery on busy, io and cannot_open does not recover, moves nothing and names the person action', bad.length === 0, bad.join('; '));
  }

  // MA9: the open path of room.db is unchanged.
  {
    const src = fs.readFileSync(path.join(ROOT, 'lib', 'core', 'room-db.cjs'), 'utf8');
    let gitClean = true;
    let why = '';
    try {
      const diff = cp.spawnSync('git', ['diff', 'HEAD', '--name-only', '--', 'lib/core/room-db.cjs'], { cwd: ROOT, encoding: 'utf8' });
      if (diff.status === 0 && diff.stdout.trim().length > 0) { gitClean = false; why = 'working tree edit'; }
      const log = cp.spawnSync('git', ['log', '--format=%s', '--', 'lib/core/room-db.cjs'], { cwd: ROOT, encoding: 'utf8' });
      if (log.status === 0 && /386-47/.test(log.stdout)) { gitClean = false; why = 'a 386-47 commit'; }
    } catch (_e) { /* no git: the source checks below still run */ }
    ok('MA9 openRoomDb still holds journal_mode = WAL and timeout 5000, and this plan did not edit room-db.cjs',
      /PRAGMA journal_mode = WAL/.test(src) && /timeout: 5000/.test(src) && gitClean, why);
  }
}

main().then(() => {
  restore();
  tmpRoots.forEach((p) => { try { fs.rmSync(p, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });
  if (failures > 0) {
    console.log('\ntest-386-no-move-aside-on-false-unreadable: ' + failures + ' FAILURE(S)');
    process.exit(1);
  }
  console.log('\ntest-386-no-move-aside-on-false-unreadable: all arms passed');
  process.exit(0);
}, (e) => {
  restore();
  console.log('FAIL - test crashed :: ' + String((e && e.stack) || e));
  process.exit(1);
});
