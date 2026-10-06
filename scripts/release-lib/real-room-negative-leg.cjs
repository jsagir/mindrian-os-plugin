'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * 369.25 plan 23 (FCLOSE-07, RFT-01) -- the real-room run's NEGATIVE LEG.
 *
 * WHY. Field defect R3: both beta.61 receipts said every search "ran" with 0 rows and no complaint, because
 * nothing refused a room with no usable room.db (a room with no graph looks like a room with a graph until
 * something writes to it). The positive leg of scripts/real-room-run.cjs proves the four research jobs work on a
 * ready room; this leg proves the same four jobs REFUSE a room that is not ready, with a typed reason that names the
 * failed requirement, before they plan, send or write anything.
 *
 * WHAT. For each injection it builds the ONE never-ready fixture (tests/fixtures/never-ready-room, plan 01; never a
 * second fixture) and runs the first planner verb of each job exactly as scripts/real-room-run.cjs runs it:
 *   room_db_missing    the fixture as built: no .mindrian/room.db           expected not_ready_reason room_db_missing
 *   room_db_corrupted  the fixture plus 64 zero bytes as .mindrian/room.db  expected not_ready_reason room_db_unreadable
 *   room_db_reminted   (plan 27, Larry's leg B) a room born through the real birth path with work in its graph, room.db
 *                      deleted, then a silent minting open (openRoomDb): an empty identity-less database and the room id
 *                      still recorded in .room-root                          expected not_ready_reason room_graph_lost
 * quick and deep run `plan <question set> --room <dir> --mode quick|deep`; Eureka and analogies run
 * `perspective-recall --room <dir> --perspective <id> --offline`. A job counts as REFUSED only when ALL of these hold:
 * exit code 2, reason room_not_ready, not_ready_reason as expected, the requirement text lib/core/room-readiness.cjs
 * defines for that reason, room.db in the same state before and after (a refusal creates no room.db), and the room tree
 * byte-identical after (nothing was planned or written). The leg runs the planner CLI only. It never runs the session
 * start hook against a negative room: the whole hook creates an identity-less room.db (plan 13), which would turn the
 * next job's reason from room_db_missing into identity_missing.
 *
 * The reminted room is built by buildRemintedRoom in a CHILD process with its own HOME and rooms home under the same
 * scratch directory, so birth never writes the run's registry. Its room.db state is 'reminted_empty' (a database that holds
 * no room.* identity rows) before and after every job.
 *
 * WHERE. The negative rooms are built under the run's scratch directory (a mkdtemp under the OS temp dir), never in
 * the rooms home: the builder refuses a target under ~/.mindrian, which is the run's default rooms home, and a refused
 * room must not enter the registry or the receipt directory. They disappear with the scratch directory.
 *
 * Offline by construction (no network, no model); no receipt is written here. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE = 'tests/fixtures/never-ready-room/build-fixture.cjs';
const NEGATIVE_INJECTIONS = Object.freeze(['room_db_missing', 'room_db_corrupted', 'room_db_reminted']);
const EXPECTED_REASON = Object.freeze({ room_db_missing: 'room_db_missing', room_db_corrupted: 'room_db_unreadable', room_db_reminted: 'room_graph_lost' });
const EXPECTED_DB_STATE = Object.freeze({ room_db_missing: 'absent', room_db_corrupted: 'corrupt', room_db_reminted: 'reminted_empty' });
const JOBS = Object.freeze(['quick', 'deep', 'eureka', 'analogies']);
const SQLITE_MAGIC = 'SQLite format 3\u0000';

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function noDash(s) { return String(s).replace(/[\u2014\u2013]/g, '-'); }

// 'absent' | 'corrupt' (a file that is not a SQLite database) | 'reminted_empty' (a database with no room.* identity
// rows, read through a copy so nothing is written under roomDir) | 'database'
function roomDbState(roomDir) {
  const base = rawDbState(roomDir);
  if (base !== 'database') return base;
  try {
    const id = require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-identity.cjs')).readRoomIdentity(roomDir, { door: 'copy' });
    if (id && id.reason === 'identity_missing') return 'reminted_empty';
  } catch (_e) { /* an unreadable identity leaves the plain database state */ }
  return 'database';
}

function rawDbState(roomDir) {
  const f = path.join(roomDir, '.mindrian', 'room.db');
  let fd = null;
  try {
    if (!fs.statSync(f).isFile()) return 'absent';
    fd = fs.openSync(f, 'r');
    const buf = Buffer.alloc(16);
    const n = fs.readSync(fd, buf, 0, 16, 0);
    return n === 16 && buf.toString('latin1') === SQLITE_MAGIC ? 'database' : 'corrupt';
  } catch (_e) {
    return 'absent';
  } finally {
    if (fd !== null) { try { fs.closeSync(fd); } catch (_e) { /* ignore */ } }
  }
}

// sha256 over every relative path and file content under dir, sorted
function treeHash(dir) {
  const h = crypto.createHash('sha256');
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).sort(function (x, y) { return x.name < y.name ? -1 : 1; }).forEach(function (e) {
      const p = path.join(d, e.name);
      const rel = path.relative(dir, p);
      if (e.isDirectory()) { h.update('D ' + rel + '\n'); walk(p); }
      else if (e.isFile()) h.update('F ' + rel + ' ' + crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') + '\n');
    });
  })(dir);
  return h.digest('hex');
}

function requirementLines() {
  return require(path.join(ROOT, 'lib', 'core', 'room-readiness.cjs')).REQUIREMENT_LINES;
}

function jobArgs(job, dir, seedDir) {
  if (job === 'quick') return ['plan', path.join(seedDir, 'question-set-quick.json'), '--room', dir, '--mode', 'quick'];
  if (job === 'deep') return ['plan', path.join(seedDir, 'question-set-deep.json'), '--room', dir, '--mode', 'deep'];
  return ['perspective-recall', '--room', dir, '--perspective', job, '--offline'];
}

function plannerRun(plannerCli, args) {
  const r = cp.spawnSync(process.execPath, [plannerCli].concat(args), { encoding: 'utf8', env: process.env, timeout: 180000, maxBuffer: 32 * 1024 * 1024 });
  let json = null;
  const lines = String(r.stdout || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  for (let i = lines.length - 1; i >= 0 && json === null; i -= 1) {
    if (lines[i][0] === '{') { try { json = JSON.parse(lines[i]); } catch (_e) { json = null; } }
  }
  return { code: r.status, json: json };
}

function buildRoom(scratchParent, injection, sha) {
  const { buildNeverReadyRoom, buildRemintedRoom } = require(path.join(ROOT, 'tests', 'fixtures', 'never-ready-room', 'build-fixture.cjs'));
  const dirName = 'negative-' + injection + '-' + sha.slice(0, 8);
  const slug = 'negative-' + injection.replace(/_/g, '-') + '-' + sha.slice(0, 8);
  if (injection === 'room_db_reminted') {
    const rem = buildRemintedRoom(path.join(scratchParent, dirName), { slug: slug });
    return { dirName: dirName, roomDir: rem.roomDir };
  }
  const built = buildNeverReadyRoom(path.join(scratchParent, dirName), { slug: slug });
  if (injection === 'room_db_corrupted') {
    fs.mkdirSync(path.join(built.roomDir, '.mindrian'), { recursive: true });
    fs.writeFileSync(path.join(built.roomDir, '.mindrian', 'room.db'), Buffer.alloc(64, 0));
  }
  return { dirName: dirName, roomDir: built.roomDir };
}

/**
 * runNegativeLeg({ roomsHome, sha, plannerCli, seedDir, scratch }) -> {
 *   fixture, rooms: [{ injection, dir_name, jobs: { quick|deep|eureka|analogies: {
 *     refused, reason, not_ready_reason, requirement, exit_code, room_db_before, room_db_after, tree_unchanged } } }],
 *   all_refused, first_not_refused: null | { injection, job } }
 * roomsHome is accepted for the call shape of the run and is not written to (see WHERE above).
 */
function runNegativeLeg(opts) {
  const o = isObj(opts) ? opts : {};
  const sha = typeof o.sha === 'string' && /^[0-9a-f]{8,}/.test(o.sha) ? o.sha : '00000000';
  const plannerCli = o.plannerCli || path.join(ROOT, 'scripts', 'research-planner.cjs');
  const seedDir = o.seedDir || path.join(ROOT, 'tests', 'fixtures', 'release-room');
  const scratchParent = o.scratch || fs.mkdtempSync(path.join(os.tmpdir(), 'mos-negative-leg-'));
  const lines = requirementLines();
  const rooms = [];
  let firstNot = null;
  NEGATIVE_INJECTIONS.forEach(function (injection) {
    const built = buildRoom(scratchParent, injection, sha);
    const want = EXPECTED_REASON[injection];
    const jobs = {};
    JOBS.forEach(function (job) {
      const dbBefore = roomDbState(built.roomDir);
      const treeBefore = treeHash(built.roomDir);
      const res = plannerRun(plannerCli, jobArgs(job, built.roomDir, seedDir));
      const dbAfter = roomDbState(built.roomDir);
      const treeUnchanged = treeHash(built.roomDir) === treeBefore;
      const j = isObj(res.json) ? res.json : {};
      const refused = res.code === 2 && j.ok === false && j.reason === 'room_not_ready' && j.not_ready_reason === want
        && j.requirement === lines[want] && dbBefore === EXPECTED_DB_STATE[injection] && dbAfter === dbBefore && treeUnchanged;
      jobs[job] = {
        refused: refused,
        reason: typeof j.reason === 'string' ? j.reason : null,
        not_ready_reason: typeof j.not_ready_reason === 'string' ? j.not_ready_reason : null,
        requirement: typeof j.requirement === 'string' ? j.requirement : null,
        exit_code: res.code,
        room_db_before: dbBefore,
        room_db_after: dbAfter,
        tree_unchanged: treeUnchanged,
      };
      if (!refused && firstNot === null) firstNot = { injection: injection, job: job };
    });
    rooms.push({ injection: injection, dir_name: built.dirName, jobs: jobs });
  });
  return { fixture: FIXTURE, rooms: rooms, all_refused: firstNot === null, first_not_refused: firstNot };
}

function countRefused(leg) {
  let n = 0;
  let total = 0;
  leg.rooms.forEach(function (r) { Object.keys(r.jobs).forEach(function (k) { total += 1; if (r.jobs[k].refused) n += 1; }); });
  return { refused: n, total: total };
}

/** formatNegativeBlock(leg) -> the report section, in the run's "It tried / It got / It could not" voice. */
function formatNegativeBlock(leg) {
  const L = [];
  const c = countRefused(leg);
  const lines = requirementLines();
  L.push('== Negative leg: rooms that are not ready ==');
  L.push('  It tried:  quick, deep, Eureka and analogies on the never-ready fixture with room.db missing, with room.db corrupted, and on a born room whose room.db was deleted and silently recreated empty.');
  if (leg.all_refused) {
    L.push('  It got:    refused ' + c.refused + ' of ' + c.total + ' with a typed reason: ' + lines.room_db_missing + '; ' + lines.room_db_unreadable + '; ' + lines.room_graph_lost + '.');
  } else {
    const f = leg.first_not_refused || { injection: 'unknown', job: 'unknown' };
    L.push('  It got:    refused ' + c.refused + ' of ' + c.total + '; RAN on ' + f.job + ' for ' + f.injection + ': this is the R3 defect (a room with no usable record looks like a room with a record).');
  }
  L.push('  It could not: show anything about a room that has no usable record, which is the point.');
  return noDash(L.join('\n'));
}

module.exports = { runNegativeLeg, NEGATIVE_INJECTIONS, formatNegativeBlock };
