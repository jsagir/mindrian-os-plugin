'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 384 plan 07: self-test of bench/db-open-bench.cjs.
 * D1 the timed child on a temporary room folder made by openRoomDb: open and bare both above 0; the interleave order
 *    is A B, B A, A B; a full `run` on the fixture room gives cold and warm targets with n of 7 or more, and the
 *    counting run shows constructed of 1 or more, exec calls above 0 and a bare open with 0 exec calls.
 * D2 `session-opens` prints usage and exits 2 without arguments; with 3 repeats it names the hook scripts and says
 *    whether the repeats agree.
 * D3 both result schemas pass verify-results (timing file with n of 7, counts file with 3 repeats).
 * D4 copy mode on a synthetic source folder for run and session-opens; no output holds a path.
 * Node built-ins only. Prints `db-open-bench: ALL PASS` or `db-open-bench: <n> FAILED`. Hyphens only.
 * Heavy checks must run under the 384 lock. Measurements are never taken here.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const BENCH = path.join(__dirname, 'db-open-bench.cjs');
const HARNESS = path.join(REPO, 'tools', 'perf', 'perf-harness.cjs');

let failed = 0;
function check(name, ok, detail) {
  if (ok) process.stdout.write('  ok   ' + name + '\n');
  else { failed += 1; process.stdout.write('  FAIL ' + name + (detail ? ' :: ' + detail : '') + '\n'); }
}

const SCRATCH = process.env.MOS_DBBENCH_TEST_SCRATCH || os.tmpdir();
const TMP = fs.mkdtempSync(path.join(SCRATCH, 'mos-384-dbbench-test-'));
function cleanup() { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_e) { return null; } }

if (!fs.existsSync(BENCH)) {
  check('D0 db-open-bench.cjs exists', false, 'missing file');
  cleanup();
  process.stdout.write('db-open-bench: ' + failed + ' FAILED\n');
  process.exit(1);
}

const bench = require(BENCH);
const runnerEnv = Object.assign({}, process.env, { MOS_PERF_SELFTEST: '1', MOS_PERF_LOCK_FILE: path.join(TMP, 'selftest.lock') });
const runB = (args, timeout) => spawnSync(process.execPath, [BENCH].concat(args), { encoding: 'utf8', timeout: timeout || 300000, env: runnerEnv });

// ---- D1a: interleave order ----
const orders = bench.pairOrders(7);
check('D1 interleave order is AB, BA, AB, BA, AB, BA, AB', JSON.stringify(orders) === JSON.stringify(['AB', 'BA', 'AB', 'BA', 'AB', 'BA', 'AB']), JSON.stringify(orders));
const seq = bench.roundOrder(0).concat(bench.roundOrder(1));
check('D1 round order puts open before bare in round 0 and bare before open in round 1', seq.indexOf('open') < seq.indexOf('bare') && seq.lastIndexOf('open') > seq.lastIndexOf('bare'), JSON.stringify(seq));

// ---- D1b: the timed child on a temporary room folder created by openRoomDb itself ----
const room = path.join(TMP, 'tmp-room');
fs.mkdirSync(room, { recursive: true });
const make = spawnSync(process.execPath, ['-e', 'const r = require(process.argv[1]); const d = r.openRoomDb(process.argv[2]); r.closeRoomDb(d);', path.join(REPO, 'lib', 'core', 'room-db.cjs'), room], { encoding: 'utf8', env: Object.assign({}, process.env, { HOME: TMP }) });
check('D1 openRoomDb creates room.db in a temporary folder', make.status === 0 && fs.existsSync(path.join(room, '.mindrian', 'room.db')), String(make.stderr).slice(0, 200));
const childEnv = Object.assign({}, process.env, { HOME: TMP });
const runChildCode = (mode, n) => {
  const r = spawnSync(process.execPath, ['-e', bench.CHILD_CODE, REPO, room, mode, String(n)], { encoding: 'utf8', env: childEnv });
  try { return JSON.parse(String(r.stdout).split('\n')[0]); } catch (_e) { return null; }
};
const mOpen = runChildCode('open', 3);
const mBare = runChildCode('bare', 3);
check('D1 timed child: open (A) and bare (B) give a time above 0', !!mOpen && !!mBare && mOpen.ok === 1 && mBare.ok === 1 && mOpen.per_open_ms > 0 && mBare.per_open_ms > 0, JSON.stringify([mOpen, mBare]));
check('D1 openRoomDb costs more than a bare open on the same file', !!mOpen && !!mBare && mOpen.per_open_ms > mBare.per_open_ms, JSON.stringify([mOpen, mBare]));

// ---- usage ----
for (const sub of ['run', 'session-opens']) {
  const r = runB([sub]);
  check('D2 ' + sub + ' with no arguments prints usage and exits 2', r.status === 2 && /usage/i.test(String(r.stderr) + String(r.stdout)), 'status ' + r.status);
}
check('D2 no subcommand exits 2', runB([]).status === 2);
check('D2 --skip-gates without MOS_PERF_SELFTEST exits 2', spawnSync(process.execPath, [BENCH, 'run', '--tree', REPO, '--out', path.join(TMP, 'x.json'), '--skip-gates'], { encoding: 'utf8', env: Object.assign({}, process.env, { MOS_PERF_SELFTEST: '' }) }).status === 2);

// ---- D1c: a full run on the fixture room ----
const verifyDir = path.join(TMP, 'verify');
fs.mkdirSync(verifyDir, { recursive: true });
const verify = (srcFile, name) => {
  const j = readJson(srcFile);
  if (j.machine) { j.machine.load1_start = 0.1; j.machine.load1_end = 0.1; }
  (j.targets || []).forEach((t) => { if (typeof t.load1_start === 'number') t.load1_start = 0.1; t.noisy = false; });
  fs.writeFileSync(path.join(verifyDir, name), JSON.stringify(j));
  const r = spawnSync(process.execPath, [HARNESS, 'verify-results', verifyDir], { encoding: 'utf8' });
  fs.rmSync(path.join(verifyDir, name), { force: true });
  return r;
};

const runOut = path.join(TMP, 'run.json');
const rr = runB(['run', '--tree', REPO, '--room', 'fixture', '--runs', '7', '--warm-opens', '10', '--out', runOut, '--scratch', TMP, '--skip-gates']);
check('D1 run on the fixture room exits 0', rr.status === 0, String(rr.stderr).slice(0, 300));
const rj = readJson(runOut);
const byId = (j, id) => (j && j.targets ? j.targets.find((t) => t.id === id) : null);
check('D3 timing file uses mos.perf-384/1 and every target id starts with db:', !!rj && rj.schema === 'mos.perf-384/1' && rj.targets.length >= 6 && rj.targets.every((t) => /^db:/.test(t.id)), rj ? JSON.stringify(rj.targets.map((t) => t.id)) : 'no file');
const need = ['db:cold:open', 'db:cold:bare', 'db:warm:open', 'db:warm:bare'];
check('D1 cold and warm targets of open and bare have n of 7 or more and a median above 0', !!rj && need.every((id) => { const t = byId(rj, id); return t && t.n >= 7 && t.wall_ms.median > 0; }), rj ? JSON.stringify(need.map((id) => { const t = byId(rj, id); return t ? [id, t.n, t.wall_ms.median] : [id, null]; })) : 'no file');
check('D1 the interleave order is on file as AB, BA, AB for cold and warm', !!rj && rj.interleave && JSON.stringify(rj.interleave.cold.slice(0, 3)) === JSON.stringify(['AB', 'BA', 'AB']) && JSON.stringify(rj.interleave.warm.slice(0, 3)) === JSON.stringify(['AB', 'BA', 'AB']), rj ? JSON.stringify(rj.interleave) : '');
const oc = rj && rj.open_counts;
check('D1 counting run: constructed of 1 or more, exec calls above 0 on an open of an existing database', !!oc && oc.existing_db && Math.min.apply(null, oc.existing_db.constructed) >= 1 && Math.min.apply(null, oc.existing_db.exec) > 0 && Math.min.apply(null, oc.existing_db.prepare) >= 0, oc ? JSON.stringify(oc.existing_db) : 'no counts');
check('D1 counting run: a bare open has constructed 1 and 0 exec calls', !!oc && oc.bare && oc.bare.constructed.every((x) => x === 1) && oc.bare.exec.every((x) => x === 0), oc ? JSON.stringify(oc.bare) : 'no counts');
check('D1 counting run: a new database costs at least as many exec calls as an existing one', !!oc && oc.new_db && Math.min.apply(null, oc.new_db.exec) >= Math.max.apply(null, oc.existing_db.exec), oc ? JSON.stringify([oc.new_db, oc.existing_db]) : '');
if (rj) {
  const v = verify(runOut, 'run.json');
  check('D3 verify-results accepts the timing file with n of 7', v.status === 0, String(v.stderr).slice(0, 300));
}

// ---- D2: session-opens on the fixture room ----
const sessOut = path.join(TMP, 'sess.json');
const rs = runB(['session-opens', '--tree', REPO, '--room', 'fixture', '--repeats', '3', '--out', sessOut, '--scratch', TMP, '--skip-gates'], 420000);
check('D2 session-opens with 3 repeats exits 0', rs.status === 0, String(rs.stderr).slice(0, 300));
const sj = readJson(sessOut);
check('D3 session-opens file uses mos.perf-384-counts/1 with 3 repeats', !!sj && sj.schema === 'mos.perf-384-counts/1' && sj.session && sj.session.repeats === 3, sj ? JSON.stringify(Object.keys(sj)) : 'no file');
check('D2 session-opens names the hook scripts, the opens and says whether the repeats agree', !!sj && Array.isArray(sj.session.by_script) && sj.session.by_script.length >= 1 && sj.session.by_script.every((s) => typeof s.sqlite_constructed === 'number') && typeof sj.session.repeats_agree === 'boolean' && typeof sj.session.opens_total === 'number', sj ? JSON.stringify(sj.session).slice(0, 300) : '');
if (sj) {
  const v = verify(sessOut, 'sess.json');
  check('D3 verify-results accepts the counts file with 3 repeats', v.status === 0, String(v.stderr).slice(0, 300));
}

// ---- D4: copy mode on a synthetic source folder ----
const src = path.join(TMP, 'synthetic-source-room');
fs.mkdirSync(path.join(src, '.mindrian'), { recursive: true });
fs.mkdirSync(path.join(src, 'problem-definition'), { recursive: true });
fs.writeFileSync(path.join(src, 'STATE.md'), '# synthetic\n');
fs.writeFileSync(path.join(src, 'ROOM.md'), '# synthetic room\n');
fs.writeFileSync(path.join(src, '.room-root'), '');
fs.writeFileSync(path.join(src, 'problem-definition', 'ROOM.md'), '# section\n');
const srcFile = path.join(TMP, 'source-file.txt');
fs.writeFileSync(srcFile, src + '\n');
const copyRun = path.join(TMP, 'copy-run.json');
const rcr = runB(['run', '--tree', REPO, '--room', 'copy', '--source-file', srcFile, '--runs', '7', '--warm-opens', '5', '--out', copyRun, '--scratch', TMP, '--skip-gates']);
check('D4 run in copy mode exits 0', rcr.status === 0, String(rcr.stderr).slice(0, 300));
const copySess = path.join(TMP, 'copy-sess.json');
const rcs = runB(['session-opens', '--tree', REPO, '--room', 'copy', '--source-file', srcFile, '--repeats', '3', '--out', copySess, '--scratch', TMP, '--skip-gates'], 420000);
check('D4 session-opens in copy mode exits 0', rcs.status === 0, String(rcs.stderr).slice(0, 300));
const leak = [];
for (const f of [copyRun, copySess]) {
  const t = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  if (!t) leak.push('missing ' + path.basename(f));
  if (t.indexOf(src) !== -1 || t.indexOf(TMP) !== -1 || t.indexOf('synthetic-source-room') !== -1 || /\/home\//.test(t) || /MindrianRooms/.test(t)) leak.push('path in ' + path.basename(f));
}
for (const s of [rcr, rcs]) {
  const t = String(s.stdout) + String(s.stderr);
  if (t.indexOf(src) !== -1 || t.indexOf('synthetic-source-room') !== -1) leak.push('path in output');
}
check('D4 no output file and no console line holds a path', leak.length === 0, leak.join(','));
const cj = readJson(copyRun);
check('D4 the copy room is reported as real-copy', !!cj && cj.room && cj.room.kind === 'real-copy', cj ? JSON.stringify(cj.room) : 'no file');

cleanup();
if (failed) { process.stdout.write('db-open-bench: ' + failed + ' FAILED\n'); process.exit(1); }
process.stdout.write('db-open-bench: ALL PASS\n');
