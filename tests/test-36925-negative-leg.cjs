#!/usr/bin/env node
'use strict';
/*
 * 369.25 plan 23 (FCLOSE-07, RFT-01): the real-room run's NEGATIVE LEG and the research door that makes it pass.
 *
 * Field defect R3: both beta.61 receipts reported every search "ran" with 0 rows and no complaint, because nothing
 * refused a room with no usable room.db. Navigator input (2026-10-06 01:00): the run births a second fixture room,
 * removes or corrupts its .mindrian/room.db, and asserts that quick, deep, Eureka and analogies REFUSE it with a
 * typed reason naming the failed requirement. The fixture is the ONE never-ready fixture (plan 01) and the readiness
 * definition is lib/core/room-readiness.cjs (plan 13): research is blocked by room_db_missing and room_db_unreadable.
 *
 * Arms:
 *   NL1  scripts/research-planner.cjs refuses plan (quick and deep), perspective-recall eureka and analogies on the
 *        never-ready room (room.db missing: room_db_missing; room.db 64 zero bytes: room_db_unreadable), exit 2, the
 *        requirement text from REQUIREMENT_LINES, the room tree unchanged and no room.db created by the refusal;
 *        a born ready room still plans; a legacy room (identity rows deleted) still plans
 *   NL2  runNegativeLeg builds the three rooms (two from buildNeverReadyRoom, the third from buildRemintedRoom: plan 27,
 *        Larry's leg B) and records 3 rooms x 4 jobs, each refused with the expected reason, exit 2, room.db state
 *        unchanged; all_refused true; the reminted room is refused room_graph_lost by quick, deep, Eureka and analogies
 *   NL3  stub check: with the readiness check stubbed out the same leg reports all_refused false and names the
 *        first job that ran
 *   NL4  --negative-only prints the negative block, exits 0, writes no receipt (and creates no ~/.mindrian)
 *   NL5  a full offline run's JSON carries negative_leg all_refused true, and the receipt written for a hermetic
 *        tester (temp HOME, temp receipt dir) carries negative_leg (the feyminto key: test-36925-room-read RR4)
 *   dash guard over the two new modules and both edited scripts
 *
 * Isolation: every spawn gets HOME, USERPROFILE and MINDRIAN_ROOMS_HOME in a mkdtemp directory; the receipt dir is
 * a temp dir; --offline everywhere. Nothing here touches ~/MindrianRooms, ~/.mindrian or the network. The session
 * start hook is never run against a negative room (it would create an identity-less room.db, plan 13).
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');
const { buildNeverReadyRoom, buildRemintedRoom } = require('./fixtures/never-ready-room/build-fixture.cjs');
const PLANNER = path.join(ROOT, 'scripts', 'research-planner.cjs');
const RUN = path.join(ROOT, 'scripts', 'real-room-run.cjs');
const LEG_MOD = path.join(ROOT, 'scripts', 'release-lib', 'real-room-negative-leg.cjs');
const ROOM_READ_MOD = path.join(ROOT, 'lib', 'core', 'feyminto', 'room-read.cjs');
const SEED = path.join(ROOT, 'tests', 'fixtures', 'release-room');
const QS_QUICK = path.join(SEED, 'question-set-quick.json');
const QS_DEEP = path.join(SEED, 'question-set-deep.json');
const { REQUIREMENT_LINES } = require(path.join(ROOT, 'lib', 'core', 'room-readiness.cjs'));

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log('PASS: ' + label); }
  else { failed += 1; console.log('FAIL: ' + label + (detail !== undefined ? ' :: ' + String(detail).slice(0, 700) : '')); }
}
function safe(fn, fallback) { try { return fn(); } catch (_e) { return fallback; } }

const iso = H.mkIsolatedHome('nl');
const ENV = Object.assign({}, iso.env);
delete ENV.TAVILY_API_KEY;

function runNode(args, env) {
  const r = cp.spawnSync(process.execPath, args, { encoding: 'utf8', env: env || ENV, timeout: 240000, maxBuffer: 32 * 1024 * 1024 });
  return { code: r.status, out: String(r.stdout || ''), err: String(r.stderr || '') };
}
function lastJson(text) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i][0] === '{') { try { return JSON.parse(lines[i]); } catch (_e) { /* next */ } }
  }
  return null;
}
function planner(args) {
  const r = runNode([PLANNER].concat(args));
  return { code: r.code, json: lastJson(r.out), err: r.err };
}

function nrRoom(tag, injection) {
  const built = buildNeverReadyRoom(path.join(iso.home, 'nr-' + tag), { slug: 'nr-' + tag });
  const dbDir = path.join(built.roomDir, '.mindrian');
  fs.mkdirSync(dbDir, { recursive: true });
  if (injection === 'room_db_corrupted') fs.writeFileSync(path.join(dbDir, 'room.db'), Buffer.alloc(64, 0));
  return built.roomDir;
}
const dbPath = (dir) => path.join(dir, '.mindrian', 'room.db');

const MISSING = { injection: 'room_db_missing', reason: 'room_db_missing' };
const REMINTED = { injection: 'room_db_reminted', reason: 'room_graph_lost' };
const CORRUPT = { injection: 'room_db_corrupted', reason: 'room_db_unreadable' };

const VERBS = [
  { job: 'quick', args: (d) => ['plan', QS_QUICK, '--room', d, '--mode', 'quick'] },
  { job: 'deep', args: (d) => ['plan', QS_DEEP, '--room', d, '--mode', 'deep'] },
  { job: 'eureka', args: (d) => ['perspective-recall', '--room', d, '--perspective', 'eureka', '--offline'] },
  { job: 'analogies', args: (d) => ['perspective-recall', '--room', d, '--perspective', 'analogies', '--offline'] },
];

function stubbedPlannerCli() {
  // A wrapper CLI that replaces the readiness check with one that never blocks, then runs the real planner.
  const file = path.join(iso.home, 'planner-without-readiness.cjs');
  fs.writeFileSync(file, [
    "'use strict';",
    "const path = require('node:path');",
    "const rr = require.resolve(" + JSON.stringify(path.join(ROOT, 'lib', 'core', 'room-readiness.cjs')) + ");",
    "const real = require(rr);",
    "const open = (d, op) => ({ ok: true, operation: op, state: 'ready', reason: null, requirement: null, blocking: false, room_id: null, remediation: null });",
    "require.cache[rr].exports = Object.assign({}, real, { readinessFor: open });",
    "require(" + JSON.stringify(PLANNER) + ");",
    '',
  ].join('\n'), 'utf8');
  return file;
}

function main() {
  // ---- NL1 ---------------------------------------------------------------------------------------------------
  const rooms1 = { missing: nrRoom('a1', MISSING.injection), corrupt: nrRoom('a2', CORRUPT.injection) };
  check('NL1 setup: the missing room has no room.db and the corrupted room has 64 zero bytes',
    !fs.existsSync(dbPath(rooms1.missing)) && fs.statSync(dbPath(rooms1.corrupt)).size === 64);
  [['missing', MISSING], ['corrupt', CORRUPT]].forEach(([key, inj]) => {
    const dir = rooms1[key];
    VERBS.forEach((v) => {
      const before = H.treeHash(dir);
      const r = planner(v.args(dir));
      const j = r.json || {};
      check('NL1 ' + inj.injection + ' ' + v.job + ': exit 2, room_not_ready, ' + inj.reason + ', the requirement text',
        r.code === 2 && j.ok === false && j.reason === 'room_not_ready' && j.not_ready_reason === inj.reason && j.requirement === REQUIREMENT_LINES[inj.reason],
        'code ' + r.code + ' ' + JSON.stringify(j).slice(0, 300) + ' ' + r.err.slice(0, 200));
      check('NL1 ' + inj.injection + ' ' + v.job + ': the refusal wrote nothing (tree unchanged, no new room.db)',
        H.treeHash(dir) === before && (key === 'corrupt' ? fs.statSync(dbPath(dir)).size === 64 : !fs.existsSync(dbPath(dir))));
    });
  });

  // plan 27 (Larry's leg B): a born room with work in its graph, room.db deleted, then a silent minting open
  const rem = buildRemintedRoom(path.join(iso.home, 'nr-rem'), { slug: 'nr-rem' });
  check('NL1 setup: the reminted room had work in its graph (' + rem.nodes_before + ' nodes), was recreated empty (' + rem.nodes_after_mint + ' nodes) and still records its id in .room-root',
    rem.nodes_before > 0 && rem.nodes_after_mint === 0 && fs.existsSync(dbPath(rem.roomDir))
      && typeof JSON.parse(fs.readFileSync(path.join(rem.roomDir, '.room-root'), 'utf8')).room_id === 'string', JSON.stringify(rem).slice(0, 300));
  VERBS.forEach((v) => {
    const before = H.treeHash(rem.roomDir);
    const r = planner(v.args(rem.roomDir));
    const j = r.json || {};
    check('NL1 ' + REMINTED.injection + ' ' + v.job + ': exit 2, room_not_ready, ' + REMINTED.reason + ', the requirement text',
      r.code === 2 && j.ok === false && j.reason === 'room_not_ready' && j.not_ready_reason === REMINTED.reason && j.requirement === REQUIREMENT_LINES[REMINTED.reason],
      'code ' + r.code + ' ' + JSON.stringify(j).slice(0, 300) + ' ' + r.err.slice(0, 200));
    check('NL1 ' + REMINTED.injection + ' ' + v.job + ': the refusal wrote nothing (tree unchanged)', H.treeHash(rem.roomDir) === before);
  });

  const born = H.birthFixtureRoom({ iso, slug: 'nl-born' });
  check('NL1 setup: a born room is ok', born && born.ok === true, JSON.stringify(born).slice(0, 200));
  const rb = planner(['plan', QS_QUICK, '--room', born.roomDir, '--mode', 'quick']);
  check('NL1 a born ready room still plans (exit 0, ok, a run id)', rb.code === 0 && rb.json && rb.json.ok === true && typeof rb.json.run_id === 'string', 'code ' + rb.code + ' ' + JSON.stringify(rb.json).slice(0, 300));

  const legacy = H.birthFixtureRoom({ iso, slug: 'nl-legacy' });
  const nav = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
  const ldb = nav.openRoomDbForCaller(legacy.roomDir);
  try { ldb.prepare("DELETE FROM identity WHERE key LIKE 'room.%'").run(); } finally { nav.closeRoomDbForCaller(ldb); }
  // a TRUE legacy room records no id outside room.db (born before 369.25): plan 27 reads a recorded id as a lost graph
  {
    const rootFile = path.join(legacy.roomDir, '.room-root');
    const cur = JSON.parse(fs.readFileSync(rootFile, 'utf8'));
    delete cur.room_id;
    fs.writeFileSync(rootFile, JSON.stringify(cur));
    const regFile = path.join(iso.roomsHome, '.rooms', 'registry.json');
    const reg = JSON.parse(fs.readFileSync(regFile, 'utf8'));
    Object.keys(reg.rooms || {}).forEach((k) => { if (reg.rooms[k] && typeof reg.rooms[k] === 'object') delete reg.rooms[k].room_id; });
    fs.writeFileSync(regFile, JSON.stringify(reg, null, 2));
  }
  const idState = safe(() => require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-identity.cjs')).readRoomIdentity(legacy.roomDir).reason, null);
  const rl = planner(['plan', QS_QUICK, '--room', legacy.roomDir, '--mode', 'quick']);
  check('NL1 a legacy room (identity missing: ' + idState + ') still plans', idState === 'identity_missing' && rl.code === 0 && rl.json && rl.json.ok === true, 'code ' + rl.code + ' ' + JSON.stringify(rl.json).slice(0, 300));

  // ---- NL2 ---------------------------------------------------------------------------------------------------
  const legMod = safe(() => require(LEG_MOD), null);
  const SHA = 'a'.repeat(40);
  const scratch1 = fs.mkdtempSync(path.join(iso.home, 'scratch-'));
  let leg = null;
  if (!legMod) check('NL2 the negative-leg module loads', false, 'module absent: ' + LEG_MOD);
  else {
    check('NL2 NEGATIVE_INJECTIONS is room_db_missing, room_db_corrupted and room_db_reminted', JSON.stringify(legMod.NEGATIVE_INJECTIONS) === JSON.stringify(['room_db_missing', 'room_db_corrupted', 'room_db_reminted']), JSON.stringify(legMod.NEGATIVE_INJECTIONS));
    leg = legMod.runNegativeLeg({ roomsHome: path.join(iso.home, 'nl2-rooms'), sha: SHA, plannerCli: PLANNER, seedDir: SEED, scratch: scratch1 });
    check('NL2 the leg did not write to the rooms home it was given', !fs.existsSync(path.join(iso.home, 'nl2-rooms')));
    check('NL2 three rooms, four jobs each', leg && leg.rooms.length === 3 && leg.rooms.every((r) => Object.keys(r.jobs).sort().join(',') === 'analogies,deep,eureka,quick'), JSON.stringify(leg).slice(0, 300));
    check('NL2 every job refused room_not_ready with the expected reason, exit 2',
      leg.rooms.every((r) => Object.keys(r.jobs).every((k) => {
        const jb = r.jobs[k];
        const want = { room_db_missing: 'room_db_missing', room_db_corrupted: 'room_db_unreadable', room_db_reminted: 'room_graph_lost' }[r.injection];
        return jb.refused === true && jb.reason === 'room_not_ready' && jb.not_ready_reason === want && jb.exit_code === 2 && jb.requirement === REQUIREMENT_LINES[want];
      })), JSON.stringify(leg.rooms.map((r) => r.jobs)).slice(0, 500));
    check('NL2 all_refused true, no first_not_refused', leg.all_refused === true && !leg.first_not_refused, JSON.stringify([leg.all_refused, leg.first_not_refused]));
    check('NL2 the fixture is the one never-ready fixture', leg.fixture === 'tests/fixtures/never-ready-room/build-fixture.cjs', leg.fixture);
    check('NL2 the reminted room is refused room_graph_lost by quick, deep, Eureka and analogies (12 of 12 refused in all)',
      (() => { const rr = leg.rooms.find((r) => r.injection === 'room_db_reminted'); return !!rr && ['quick', 'deep', 'eureka', 'analogies'].every((k) => rr.jobs[k].refused === true && rr.jobs[k].not_ready_reason === 'room_graph_lost'); })()
        && leg.rooms.reduce((n, r) => n + Object.keys(r.jobs).filter((k) => r.jobs[k].refused === true).length, 0) === 12, JSON.stringify(leg.rooms.map((r) => [r.injection, Object.keys(r.jobs).map((k) => r.jobs[k].refused)])));
    check('NL2 room.db state recorded before and after each job and unchanged (missing stays absent, corrupted stays 64 bytes, reminted stays reminted_empty)',
      leg.rooms.every((r) => Object.keys(r.jobs).every((k) => r.jobs[k].room_db_before === r.jobs[k].room_db_after && r.jobs[k].room_db_before === ({ room_db_missing: 'absent', room_db_corrupted: 'corrupt', room_db_reminted: 'reminted_empty' })[r.injection])),
      JSON.stringify(leg.rooms.map((r) => [r.injection, Object.values(r.jobs).map((j) => [j.room_db_before, j.room_db_after])])).slice(0, 400));
    const roomNames = leg.rooms.map((r) => r.dir_name);
    check('NL2 the rooms are built under the run scratch (the builder refuses ~/.mindrian) and are named for the injection and the sha',
      roomNames.every((n) => /^negative-room_db_(missing|corrupted|reminted)-aaaaaaaa$/.test(n) && fs.existsSync(path.join(scratch1, n, 'rooms'))
        && fs.readdirSync(path.join(scratch1, n, 'rooms')).some((slug) => fs.existsSync(path.join(scratch1, n, 'rooms', slug, '.room-root')))), roomNames.join(','));
    const block = legMod.formatNegativeBlock(leg);
    check('NL2 formatNegativeBlock voice: header, It tried, It got refused 12 of 12, It could not; names only, no sha and no path',
      block.indexOf('== Negative leg: rooms that are not ready ==') !== -1 && /It tried:/.test(block) && /It got:\s+refused 12 of 12/.test(block) && /It could not:/.test(block)
        && block.indexOf(SHA) === -1 && block.indexOf(iso.home) === -1 && block.indexOf(REQUIREMENT_LINES.room_db_missing) !== -1 && block.indexOf(REQUIREMENT_LINES.room_db_unreadable) !== -1 && block.indexOf(REQUIREMENT_LINES.room_graph_lost) !== -1, block);
  }

  // ---- NL3: stub check ----------------------------------------------------------------------------------------
  if (!legMod) check('NL3 stub check: the leg reports all_refused false when the readiness check is stubbed out', false, 'module absent');
  else {
    const stubCli = stubbedPlannerCli();
    const scratch2 = fs.mkdtempSync(path.join(iso.home, 'scratch-'));
    const stubbed = legMod.runNegativeLeg({ roomsHome: path.join(iso.home, 'nl3-rooms'), sha: 'b'.repeat(40), plannerCli: stubCli, seedDir: SEED, scratch: scratch2 });
    check('NL3 stub check: all_refused false when the readiness check is stubbed out', stubbed && stubbed.all_refused === false, JSON.stringify(stubbed && stubbed.all_refused));
    check('NL3 the leg names the first job that ran (injection and job)', stubbed && stubbed.first_not_refused && stubbed.first_not_refused.injection === 'room_db_missing' && stubbed.first_not_refused.job === 'quick', JSON.stringify(stubbed && stubbed.first_not_refused));
    const remRoom = stubbed && stubbed.rooms.find((r) => r.injection === 'room_db_reminted');
    check('NL3 with readinessFor stubbed out the reminted room also ran (no job refused it)', !!remRoom && Object.keys(remRoom.jobs).every((k) => remRoom.jobs[k].refused === false), JSON.stringify(remRoom && Object.keys(remRoom.jobs).map((k) => remRoom.jobs[k].refused)));
    const text = legMod.formatNegativeBlock(stubbed);
    check('NL3 the text says RAN and names the R3 defect', /RAN on quick for room_db_missing/.test(text) && /R3/.test(text), text);
  }

  // ---- NL4: --negative-only -------------------------------------------------------------------------------------
  const rc4 = path.join(iso.home, 'nl4-receipts');
  const n4 = runNode([RUN, '--negative-only', '--rooms-home', path.join(iso.home, 'nl4-rooms'), '--receipt-dir', rc4]);
  check('NL4 --negative-only exits 0 and prints the negative block', n4.code === 0 && n4.out.indexOf('== Negative leg: rooms that are not ready ==') !== -1, 'code ' + n4.code + ' ' + n4.out.slice(0, 300) + n4.err.slice(0, 300));
  check('NL4 --negative-only prints no positive-leg section (the four jobs were not run)', n4.out.indexOf('== Quick research ==') === -1 && n4.out.indexOf('== FeyMinto ==') === -1);
  check('NL4 --negative-only wrote no receipt (no file in the receipt dir) and no ~/.mindrian under the isolated home',
    (!fs.existsSync(rc4) || fs.readdirSync(rc4).filter((f) => /\.json$/.test(f)).length === 0) && !fs.existsSync(path.join(iso.home, '.mindrian', 'release-real-room')));
  const n4j = runNode([RUN, '--negative-only', '--json', '--rooms-home', path.join(iso.home, 'nl4b-rooms'), '--receipt-dir', rc4]);
  const n4json = lastJson(n4j.out);
  check('NL4 --negative-only --json carries negative_leg with all_refused true', n4j.code === 0 && n4json && n4json.negative_leg && n4json.negative_leg.all_refused === true, n4j.out.slice(0, 300));

  // ---- NL5: the full offline run --------------------------------------------------------------------------------
  const rc5 = path.join(iso.home, 'nl5-receipts');
  const n5 = runNode([RUN, '--offline', '--json', '--read-by', 'Test Reader', '--rooms-home', path.join(iso.home, 'nl5-rooms'), '--receipt-dir', rc5]);
  const j5 = lastJson(n5.out);
  check('NL5 a full offline run exits 0 and its JSON carries negative_leg with all_refused true',
    n5.code === 0 && j5 && j5.negative_leg && j5.negative_leg.all_refused === true && j5.negative_leg.rooms.length === 3, 'code ' + n5.code + ' ' + n5.out.slice(-400) + n5.err.slice(-300));
  const files = safe(() => fs.readdirSync(rc5).filter((f) => /\.json$/.test(f)), []);
  const receipt = files.length === 1 ? safe(() => JSON.parse(fs.readFileSync(path.join(rc5, files[0]), 'utf8')), null) : null;
  check('NL5 the hermetic receipt carries negative_leg (all three rooms, twelve job outcomes, all_refused); the feyminto key is pinned by test-36925-room-read RR4',
    !!receipt && receipt.negative_leg && receipt.negative_leg.all_refused === true && receipt.negative_leg.rooms.length === 3 && receipt.negative_leg.rooms.some((r) => r.injection === 'room_db_reminted')
      && receipt.negative_leg.rooms.every((r) => Object.keys(r.jobs).length === 4 && Object.values(r.jobs).every((jb) => jb.refused === true && typeof jb.not_ready_reason === 'string')),
    JSON.stringify(receipt && receipt.negative_leg).slice(0, 400));
  check('NL5 the receipt keeps the positive jobs as today (perspectives quick, deep, eureka, analogies)',
    !!receipt && receipt.perspectives && ['quick', 'deep', 'eureka', 'analogies'].every((k) => receipt.perspectives[k]), JSON.stringify(receipt && receipt.perspectives).slice(0, 200));
  const homeEntries = safe(() => fs.readdirSync(path.join(iso.home, 'nl5-rooms')).filter((n) => !n.startsWith('.')), []);
  check('NL5 the rooms home holds the fixture room and no negative room: the negative rooms never enter it or its registry',
    homeEntries.some((n) => /^release-fixture-/.test(n)) && !homeEntries.some((n) => /negative-/.test(n)) && !/negative-/.test(safe(() => fs.readFileSync(path.join(iso.home, 'nl5-rooms', '.rooms', 'registry.json'), 'utf8'), '')), homeEntries.join(','));

  // ---- dash guard -----------------------------------------------------------------------------------------------
  const bad = H.dashGuard([__filename, LEG_MOD, ROOM_READ_MOD, PLANNER, RUN]);
  check('dash guard: no em dash or en dash in the test, the two new modules or the two edited scripts', bad.length === 0, bad.join(','));

  console.log('\nPASS=' + passed + ' FAIL=' + failed);
  process.exit(failed === 0 ? 0 : 1);
}

try { main(); } catch (e) {
  console.log('FAIL: uncaught :: ' + String((e && e.stack) || e).slice(0, 800));
  console.log('\nPASS=' + passed + ' FAIL=' + (failed + 1));
  process.exit(1);
}
