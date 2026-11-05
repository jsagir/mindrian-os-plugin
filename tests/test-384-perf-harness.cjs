'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 384 plan 01: self-test of tools/perf/perf-harness.cjs and tools/perf/phase-guard.cjs.
 * Checks H1 to H11 (carried over from the 382 self-test and adapted to the 384 names) and B1 to B8
 * (names, per-target gate, per-target fields, failed-run rule, verify-results schemas, test-only
 * flags, lock check, phase-guard). Node built-ins only. Exit 1 on any failed check.
 * Measurements are never taken here: the run checks use a synthetic room and a small tree,
 * with MOS_PERF_SELFTEST=1 (the variable that unlocks the test-only flags --allow-short and --skip-gates).
 * Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const HARNESS = path.join(REPO, 'tools', 'perf', 'perf-harness.cjs');
const GUARD = path.join(REPO, 'tools', 'perf', 'phase-guard.cjs');
const H = require(HARNESS);

let failed = 0;
function check(name, ok, detail) {
  if (ok) {
    process.stdout.write('  ok   ' + name + '\n');
  } else {
    failed += 1;
    process.stdout.write('  FAIL ' + name + (detail ? ' :: ' + detail : '') + '\n');
  }
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-384-selftest-'));
function cleanup() { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }

// opts.env adds variables; opts.unset removes variables. MOS_PERF_SELFTEST=1 is set unless unset.
function run(args, opts) {
  const o = opts || {};
  const env = Object.assign({}, process.env, { MOS_PERF_SELFTEST: '1', MOS_PERF_LOCK_FILE: path.join(TMP, 'selftest.lock') }, o.env || {});
  (o.unset || []).forEach((k) => { delete env[k]; });
  return spawnSync(process.execPath, [HARNESS].concat(args), { encoding: 'utf8', timeout: 180000, env });
}

function validResult(overrides) {
  const machine = {
    cores: 12, node: 'v22.0.0', platform: 'linux', arch: 'x64', kernel: 'k', cpu_cap: 4, fs_type: 'ext2/ext3',
    head_sha: 'abc', tree_label: 'a', base_sha: 'b'.repeat(40), started_at: '2026-01-01T00:00:00.000Z',
    ended_at: '2026-01-01T00:01:00.000Z', load1_start: 0.5, load1_end: 0.6,
  };
  const stat = (m) => ({ median: m, p95: m + 1, min: m - 1, max: m + 2 });
  return Object.assign({
    schema: H.SCHEMA, machine, room: { kind: 'fixture-room', file_count: 3, byte_total: 10, fs_type: 'ext2/ext3' },
    set: 's1', tree_label: 'a', cpus: 4, runs: 7, load1_start: 0.5, load1_end: 0.6,
    started_at: machine.started_at, ended_at: machine.ended_at,
    targets: [{ id: 'x', n: 7, blocking: true, wall_ms: stat(100), cpu_ms: stat(10), rss_mb: stat(40), exits: [0], timed_out: 0, failed_runs: 0, noisy: false, load1_start: 0.5, load1_end: 0.6, gate_waited_ms: 0, not_measured: [], async_hooks: [] }],
  }, overrides || {});
}

function validCounts(n) {
  const r = validResult({ schema: H.COUNTS_SCHEMA });
  r.targets = [{ id: 'x', n: n, node_starts: 2, modules_total: 10, modules_max_per_process: 6 }];
  return r;
}

function writeDirFile(dir, name, obj) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), JSON.stringify(obj));
  return dir;
}

function hookTree(dir, hooks) {
  fs.mkdirSync(path.join(dir, 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'hooks', 'hooks.json'), JSON.stringify({ hooks }));
  return dir;
}

try {
  // H1
  const s = H.statsSummary([10, 20, 30, 40, 50, 60, 70]);
  check('H1 median 40 and p95 60 at n = 7', s.median === 40 && s.p95 === 60 && s.min === 10 && s.max === 70, JSON.stringify(s));

  // H2
  check('H2 load1 2.0 is not quiet', H.quietState(2.0) === 'not quiet');
  check('H2 load1 1.99 is quiet', H.quietState(1.99) === 'quiet');

  // H3
  check('H3 a run-all process makes the host busy', H.suiteGuard(['node x.js', 'bash tests/run-all-366.sh']) === 'busy');
  check('H3 no run-all process is ok', H.suiteGuard(['node x.js', 'bash scripts/other.sh']) === 'ok');

  // H4
  check('H4 interleaveOrder(4) is A,B,B,A,A,B,B,A', H.interleaveOrder(4).join(',') === 'A,B,B,A,A,B,B,A', H.interleaveOrder(4).join(','));

  // tree with two hooks for the event SessionEnd: one blocking (0.2 s), one async (0.6 s)
  const treeDir = hookTree(path.join(TMP, 'tree'), {
    SessionEnd: [{ hooks: [
      { type: 'command', command: 'sleep 0.2', timeout: 5 },
      { type: 'command', command: 'sleep 0.6', timeout: 5, async: true },
    ] }],
  });

  // H5
  const six = run(['run', '--tree', treeDir, '--room', 'synthetic', '--runs', '6', '--targets', 'event:SessionEnd', '--out', path.join(TMP, 'six.json')]);
  check('H5 --runs 6 exits 2', six.status === 2, 'status ' + six.status + ' ' + String(six.stderr).slice(0, 200));

  // H6, H7, B1, B3
  const outFile = path.join(TMP, 'short.json');
  const FLAG_SHA = 'c'.repeat(40);
  const short = run(['run', '--tree', treeDir, '--room', 'synthetic', '--runs', '3', '--allow-short', '--targets', 'event:SessionEnd', '--set', 'selftest', '--base-sha', FLAG_SHA, '--out', outFile]);
  check('H6 run with --allow-short exits 0', short.status === 0, 'status ' + short.status + ' ' + String(short.stderr).slice(0, 300));
  let res = null;
  try { res = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch (_e) { res = null; }
  check('H7 result file parses and has the schema', !!res && res.schema === 'mos.perf-384/1');
  check('B1 the schema constants are the 384 strings', H.SCHEMA === 'mos.perf-384/1' && H.COUNTS_SCHEMA === 'mos.perf-384-counts/1');
  if (res) {
    const t = (res.targets || []).find((x) => x.id === 'event:SessionEnd');
    check('H6 event wall median is below 450 ms', !!t && t.wall_ms.median < 450 && t.wall_ms.median >= 150, t ? String(t.wall_ms.median) : 'no target');
    check('H6 the async hook is a separate field', !!t && Array.isArray(t.async_hooks) && t.async_hooks.length === 1 && t.async_hooks[0].wall_ms >= 500, t ? JSON.stringify(t.async_hooks) : 'no target');
    const missing = H.MACHINE_FIELDS.filter((k) => !res.machine || res.machine[k] === undefined || res.machine[k] === null);
    check('H7 every machine field is present', missing.length === 0, missing.join(','));
    check('H7 room kind is a label and the file holds no scratch path', !/mos-384-selftest/.test(JSON.stringify(res)) && res.room && res.room.kind === 'synthetic-room');
    check('B1 --base-sha is recorded in machine.base_sha', res.machine.base_sha === FLAG_SHA, String(res.machine.base_sha));
    check('B1 the result holds no 382 name', !/382/.test(fs.readFileSync(outFile, 'utf8')));
    check('H7 the result passes the Part 8 scan', H.part8Violations(fs.readFileSync(outFile, 'utf8'), { home: os.homedir(), sourceRoom: null, scratch: TMP }).length === 0);
    check('B3 every target holds load1_start, load1_end, gate_waited_ms and noisy', !!t && typeof t.load1_start === 'number' && typeof t.load1_end === 'number' && typeof t.gate_waited_ms === 'number' && t.noisy === false, t ? JSON.stringify([t.load1_start, t.load1_end, t.gate_waited_ms, t.noisy]) : 'no target');
    check('B4 a good run has failed_runs 0', !!t && t.failed_runs === 0 && t.n === 3, t ? JSON.stringify([t.failed_runs, t.n]) : 'no target');
  }

  // B1: no flag on a tree that is not a git repository gives the text unknown; on a git tree it gives HEAD of the tree
  const noFlagOut = path.join(TMP, 'noflag.json');
  const noFlag = run(['run', '--tree', treeDir, '--room', 'synthetic', '--runs', '3', '--allow-short', '--targets', 'event:SessionEnd', '--out', noFlagOut]);
  let noFlagRes = null;
  try { noFlagRes = JSON.parse(fs.readFileSync(noFlagOut, 'utf8')); } catch (_e) { noFlagRes = null; }
  check('B1 no flag and no git tree gives base_sha unknown', noFlag.status === 0 && !!noFlagRes && noFlagRes.machine.base_sha === 'unknown', noFlag.status + ' ' + (noFlagRes ? noFlagRes.machine.base_sha : 'no file'));
  const gitTree = hookTree(path.join(TMP, 'gittree'), { SessionEnd: [{ hooks: [{ type: 'command', command: 'true', timeout: 5 }] }] });
  const gitEnv = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
  const gitRun = (args) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false'].concat(args), { cwd: gitTree, encoding: 'utf8', env: Object.assign({}, process.env, gitEnv) });
  gitRun(['init', '-q']);
  gitRun(['add', '.']);
  gitRun(['commit', '-q', '-m', 'init']);
  const gitHead = gitRun(['rev-parse', 'HEAD']).stdout.trim();
  const gitOut = path.join(TMP, 'gitflag.json');
  const gitRes = run(['run', '--tree', gitTree, '--room', 'synthetic', '--runs', '3', '--allow-short', '--targets', 'event:SessionEnd', '--out', gitOut]);
  let gitJson = null;
  try { gitJson = JSON.parse(fs.readFileSync(gitOut, 'utf8')); } catch (_e) { gitJson = null; }
  check('B1 no flag on a git tree gives HEAD of the tree', gitRes.status === 0 && !!gitJson && gitJson.machine.base_sha === gitHead, gitRes.status + ' ' + (gitJson ? gitJson.machine.base_sha : 'no file'));
  check('B1 a bad --base-sha exits 2', run(['run', '--tree', treeDir, '--room', 'synthetic', '--runs', '3', '--allow-short', '--base-sha', 'nothex', '--out', path.join(TMP, 'x.json')]).status === 2);
  const lockDefault = H.defaultLockFile({});
  check('B1 the default lock file is the 384 lock', /\.cache[\\/]mos-perf-384\.lock$/.test(lockDefault), lockDefault);
  check('B1 MOS_PERF_LOCK_FILE overrides the lock file', H.defaultLockFile({ MOS_PERF_LOCK_FILE: '/x/y.lock' }) === '/x/y.lock');
  check('B1 the bench folder base name is mos-384-bench', H.benchDir(null, '/s') === path.join('/s', 'mos-384-bench'), H.benchDir(null, '/s'));

  // H8
  const clean = JSON.stringify(validResult());
  check('H8 clean result passes', H.part8Violations(clean, { home: os.homedir(), sourceRoom: '/srv/secret-room', scratch: TMP }).length === 0);
  check('H8 home path fails', H.part8Violations(JSON.stringify({ a: os.homedir() + '/x' }), { home: os.homedir(), sourceRoom: null, scratch: TMP }).length > 0);
  check('H8 source room path fails', H.part8Violations(JSON.stringify({ a: '/srv/secret-room/x' }), { home: os.homedir(), sourceRoom: '/srv/secret-room', scratch: TMP }).length > 0);
  check('H8 MindrianRooms segment fails', H.part8Violations('{"a":"x/MindrianRooms/y"}', { home: os.homedir(), sourceRoom: null, scratch: TMP }).length > 0);
  check('H8 scratch path fails', H.part8Violations(JSON.stringify({ a: path.join(TMP, 'k') }), { home: os.homedir(), sourceRoom: null, scratch: TMP }).length > 0);

  // H9
  let threw = false;
  try { H.guardedCopy(treeDir, path.join(TMP, 'MindrianRooms', 'x')); } catch (_e) { threw = true; }
  check('H9 copy under a MindrianRooms segment is refused', threw);
  let threw2 = false;
  try { H.guardedCopy(treeDir, path.join(os.homedir(), '.mindrian', 'x384')); } catch (_e) { threw2 = true; }
  check('H9 copy under the home .mindrian is refused', threw2);

  // H10
  const a = path.join(TMP, 'a.json');
  const b = path.join(TMP, 'b.json');
  fs.writeFileSync(a, JSON.stringify(validResult({ set: 's1' })));
  const rb = validResult({ set: 's2' });
  rb.targets[0].wall_ms.median = 108;
  fs.writeFileSync(b, JSON.stringify(rb));
  const cmp = run(['compare', a, b]);
  check('H10 compare prints 7.7 for medians 100 and 108', cmp.status === 0 && /x\b.*7\.7/.test(cmp.stdout) && /overall.*7\.7/.test(cmp.stdout), cmp.stdout + cmp.stderr);
  check('H10 spreadPct helper', H.spreadPct(100, 108) === 7.7);

  // H11 (the valid timing set of the old test) and B5
  const good = path.join(TMP, 'good');
  fs.mkdirSync(good);
  fs.writeFileSync(path.join(good, 'set1.json'), JSON.stringify(validResult()));
  fs.writeFileSync(path.join(good, 'spread.json'), JSON.stringify({ rooms: {} }));
  check('H11 valid set exits 0', run(['verify-results', good]).status === 0, run(['verify-results', good]).stderr);
  function badDir(name, mutate, base) {
    const d = path.join(TMP, name);
    fs.mkdirSync(d);
    const r = base || validResult();
    mutate(r);
    fs.writeFileSync(path.join(d, 'set1.json'), JSON.stringify(r));
    return d;
  }
  const vr = (d) => run(['verify-results', d]).status;
  check('H11 n below 7 exits 1', vr(badDir('bad-n', (r) => { r.targets[0].n = 6; })) === 1);
  check('H11 missing machine field exits 1', vr(badDir('bad-m', (r) => { delete r.machine.kernel; })) === 1);
  check('H11 load1_start of 2 or more exits 1', vr(badDir('bad-l', (r) => { r.machine.load1_start = 2.0; r.load1_start = 2.0; })) === 1);
  check('B5 noisy target exits 1', vr(badDir('b5-noisy', (r) => { r.targets[0].noisy = true; })) === 1);
  check('B5 failed_runs above 0 exits 1', vr(badDir('b5-failed', (r) => { r.targets[0].failed_runs = 1; })) === 1);
  check('B5 timed_out above 0 on a blocking target exits 1', vr(badDir('b5-to', (r) => { r.targets[0].timed_out = 1; })) === 1);
  check('B5 timed_out above 0 on a non-blocking target exits 0', vr(badDir('b5-to-nb', (r) => { r.targets[0].timed_out = 1; r.targets[0].blocking = false; })) === 0);
  check('B5 a target load1_start of 2 or more exits 1', vr(badDir('b5-tl', (r) => { r.targets[0].load1_start = 2.4; })) === 1);
  check('B5 a counts file with n = 3 exits 0', vr(badDir('b5-counts3', () => {}, validCounts(3))) === 0, run(['verify-results', path.join(TMP, 'b5-counts3')]).stderr);
  check('B5 a timing file with n = 3 exits 1', vr(badDir('b5-timing3', (r) => { r.targets[0].n = 3; })) === 1);
  check('B5 a counts file with a missing machine field exits 1', vr(badDir('b5-counts-m', (r) => { delete r.machine.cores; }, validCounts(3))) === 1);
  check('B5 a counts file with a home path exits 1', vr(badDir('b5-counts-p', (r) => { r.set = os.homedir() + '/x'; }, validCounts(3))) === 1);
  check('B5 a file with an old 382 schema exits 1', vr(badDir('b5-old', (r) => { r.schema = 'mos.perf-382/1'; })) === 1);

  // B2: the per-target gate
  (async () => {
    const calls = { sleeps: 0 };
    const loads = [3, 3, 1];
    const stubSleep = async () => { calls.sleeps += 1; };
    const ok = await H.gateBeforeTarget({ readLoad: () => loads.shift(), listCmdlines: () => ['node x.js'], sleep: stubSleep, pollMs: 1000, maxMs: 60000 });
    check('B2 a load sequence 3, 3, 1 waits two polls and returns ok', ok.ok === true && ok.load1 === 1 && ok.waited_ms === 2000 && calls.sleeps === 2, JSON.stringify(ok) + ' sleeps ' + calls.sleeps);
    const quick = await H.gateBeforeTarget({ readLoad: () => 0.4, listCmdlines: () => [], sleep: stubSleep, pollMs: 1000, maxMs: 60000 });
    check('B2 a quiet host returns ok at once', quick.ok === true && quick.waited_ms === 0 && quick.load1 === 0.4, JSON.stringify(quick));
    const loadFail = await H.gateBeforeTarget({ readLoad: () => 3, listCmdlines: () => [], sleep: stubSleep, pollMs: 1000, maxMs: 3000 });
    check('B2 a load that stays high returns ok false with reason load', loadFail.ok === false && loadFail.reason === 'load' && loadFail.waited_ms >= 3000, JSON.stringify(loadFail));
    const suiteFail = await H.gateBeforeTarget({ readLoad: () => 0.5, listCmdlines: () => ['bash tests/run-all-366.sh'], sleep: stubSleep, pollMs: 1000, maxMs: 2000 });
    check('B2 a run-all process returns ok false with reason suite', suiteFail.ok === false && suiteFail.reason === 'suite', JSON.stringify(suiteFail));
  })().then(afterGate).catch((e) => { failed += 1; process.stdout.write('  FAIL unexpected error :: ' + String(e && e.stack || e) + '\n'); finish(); });
} catch (e) {
  failed += 1;
  process.stdout.write('  FAIL unexpected error :: ' + String(e && e.stack || e) + '\n');
  finish();
}

function afterGate() {
  try {
    // B4: classifyRun
    check('B4 exit 127 is failed', H.classifyRun({ status: 127, signal: null, timedOut: false }) === 'failed');
    check('B4 exit 126 is failed', H.classifyRun({ status: 126, signal: null, timedOut: false }) === 'failed');
    check('B4 a signal the harness did not send is failed', H.classifyRun({ status: null, signal: 'SIGSEGV', timedOut: false }) === 'failed');
    check('B4 a spawn failure (no status, no signal) is failed', H.classifyRun({ status: null, signal: null, timedOut: false }) === 'failed');
    check('B4 a timed-out run is timeout', H.classifyRun({ status: null, signal: 'SIGKILL', timedOut: true }) === 'timeout');
    check('B4 exits 0, 1 and 2 are ok', ['0', '1', '2'].every((c) => H.classifyRun({ status: Number(c), signal: null, timedOut: false }) === 'ok'));
    check('B4 a stop by the harness after the reply is ok', H.classifyRun({ status: null, signal: 'SIGKILL', timedOut: false, replied: true }) === 'ok');

    // B4: a synthetic hook that exits 127 never gets a sample; a hook that exits 2 is legitimate
    const failTree = hookTree(path.join(TMP, 'failtree'), {
      SessionEnd: [{ hooks: [{ type: 'command', command: 'exit 127', timeout: 5 }] }],
      PreCompact: [{ hooks: [{ type: 'command', command: 'exit 2', timeout: 5 }] }],
    });
    const failOut = path.join(TMP, 'fail.json');
    const fr = run(['run', '--tree', failTree, '--room', 'synthetic', '--runs', '3', '--allow-short', '--targets', 'event:SessionEnd,event:PreCompact', '--out', failOut]);
    let failRes = null;
    try { failRes = JSON.parse(fs.readFileSync(failOut, 'utf8')); } catch (_e) { failRes = null; }
    const t127 = failRes && failRes.targets.find((x) => x.id === 'event:SessionEnd');
    const t2 = failRes && failRes.targets.find((x) => x.id === 'event:PreCompact');
    check('B4 exit 127 three times gives failed_runs 3 and n 0', fr.status === 0 && !!t127 && t127.failed_runs === 3 && t127.n === 0 && t127.wall_ms.median === null, fr.status + ' ' + JSON.stringify(t127 && [t127.failed_runs, t127.n, t127.wall_ms]));
    check('B4 exit 2 is a legitimate run: n 3 and failed_runs 0', !!t2 && t2.failed_runs === 0 && t2.n === 3, JSON.stringify(t2 && [t2.failed_runs, t2.n, t2.exits]));
    const failDir = path.join(TMP, 'faildir');
    fs.mkdirSync(failDir);
    fs.copyFileSync(failOut, path.join(failDir, 'set1.json'));
    check('B4 verify-results exits 1 for the file with a failed target', run(['verify-results', failDir]).status === 1);

    // B6: the test-only flags
    const noSelf = (extra) => run(['run', '--tree', failTree, '--room', 'synthetic', '--runs', '3', '--targets', 'event:SessionEnd', '--out', path.join(TMP, 'nf.json')].concat(extra), { unset: ['MOS_PERF_SELFTEST'] });
    check('B6 --allow-short without MOS_PERF_SELFTEST exits 2', noSelf(['--allow-short']).status === 2);
    check('B6 --skip-gates without MOS_PERF_SELFTEST exits 2', noSelf(['--skip-gates']).status === 2);
    const sg6 = run(['run', '--tree', REPO, '--room', 'fixture', '--runs', '6', '--skip-gates', '--targets', 'floor:node', '--scratch', TMP, '--out', path.join(TMP, 'sg6.json')]);
    check('B6 --skip-gates keeps the run minimum (6 runs exits 2)', sg6.status === 2 && /at least 7 runs/.test(sg6.stderr), sg6.status + ' ' + String(sg6.stderr).slice(0, 200));
    const sg = run(['run', '--tree', REPO, '--room', 'fixture', '--runs', '7', '--skip-gates', '--targets', 'floor:node', '--scratch', TMP, '--out', path.join(TMP, 'sg7.json')]);
    check('B6 --skip-gates with 7 runs on the fixture room exits 0', sg.status === 0, sg.status + ' ' + String(sg.stderr).slice(0, 300));

    // B7: requireLock, units with synthetic /proc data
    const locks = '1: POSIX  ADVISORY  WRITE 1 00:2f:9 0 EOF\n2: FLOCK  ADVISORY  WRITE 4242 08:01:777 0 EOF\n';
    const ppids = { 5000: 4300, 4300: 4242, 4242: 1, 1: 0 };
    const base = { lockFile: '/x/l.lock', pid: 5000, readLocks: () => locks, readPpid: (p) => ppids[p] === undefined ? 0 : ppids[p], statIno: () => '777' };
    check('B7 requireLock is true when an ancestor holds the lock', H.requireLock(base) === true);
    check('B7 requireLock is true when the process itself holds the lock', H.requireLock(Object.assign({}, base, { readLocks: () => '2: FLOCK  ADVISORY  WRITE 5000 08:01:777 0 EOF\n' })) === true);
    check('B7 requireLock is false when the holder is not an ancestor', H.requireLock(Object.assign({}, base, { readLocks: () => '2: FLOCK  ADVISORY  WRITE 9999 08:01:777 0 EOF\n' })) === false);
    check('B7 requireLock is false for a different inode', H.requireLock(Object.assign({}, base, { statIno: () => '778' })) === false);
    check('B7 requireLock does not match an inode prefix (7777 is not 777)', H.requireLock(Object.assign({}, base, { readLocks: () => '2: FLOCK  ADVISORY  WRITE 4242 08:01:7777 0 EOF\n' })) === false);
    check('B7 requireLock is false when the lock file is missing', H.requireLock(Object.assign({}, base, { statIno: () => { throw new Error('ENOENT'); } })) === false);
    check('B7 requireLock is false for a lock of another kind (POSIX)', H.requireLock(Object.assign({}, base, { readLocks: () => '1: POSIX  ADVISORY  WRITE 4242 08:01:777 0 EOF\n' })) === false);

    // B7: requireLock, end to end
    const lockFile = path.join(TMP, 'b7.lock');
    const forceEnv = { MOS_PERF_LOCK_CHECK: 'force', MOS_PERF_LOCK_FILE: lockFile };
    const b7args = ['run', '--tree', treeDirForB6(), '--room', 'synthetic', '--runs', '3', '--allow-short', '--targets', 'event:SessionEnd', '--out', path.join(TMP, 'b7.json')];
    const noLock = spawnSync(process.execPath, [HARNESS].concat(b7args), { encoding: 'utf8', env: Object.assign({}, process.env, { MOS_PERF_SELFTEST: '1' }, forceEnv) });
    check('B7 a real run without the lock exits 1 with lock not held', noLock.status === 1 && /lock not held/.test(noLock.stderr), noLock.status + ' ' + String(noLock.stderr).slice(0, 200));
    const withLock = spawnSync('flock', ['-w', '60', lockFile, process.execPath, HARNESS].concat(b7args), { encoding: 'utf8', env: Object.assign({}, process.env, { MOS_PERF_SELFTEST: '1' }, forceEnv) });
    check('B7 the same run under flock on that file exits 0', withLock.status === 0, withLock.status + ' ' + String(withLock.stderr).slice(0, 200));

    // B8: phase-guard in temporary git repositories
    const TRAILER = '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\n';
    let seq = 0;
    function gcase(files, subject, trailer) {
      seq += 1;
      const dir = path.join(TMP, 'pg' + seq);
      fs.mkdirSync(dir);
      const env = Object.assign({}, process.env, { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' });
      const g = (args) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null'].concat(args), { cwd: dir, encoding: 'utf8', env });
      g(['init', '-q']);
      fs.writeFileSync(path.join(dir, 'README'), 'x\n');
      g(['add', 'README']);
      g(['commit', '-q', '-m', 'base']);
      const baseSha = g(['rev-parse', 'HEAD']).stdout.trim();
      for (const f of files) {
        fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
        fs.writeFileSync(path.join(dir, f), 'y\n');
        g(['add', '-f', '--', f]);
      }
      g(['commit', '-q', '-m', subject + (trailer ? TRAILER : '\n')]);
      const r = spawnSync(process.execPath, [GUARD, baseSha, '--repo', dir], { encoding: 'utf8' });
      return { status: r.status, out: String(r.stdout) + String(r.stderr) };
    }
    const PH = 'tools/perf/guard-probe.txt';
    check('B8 a phase-path commit alone passes', gcase([PH], 'fix(384-01): probe', true).status === 0);
    check('B8 a phase-path commit that also touches hooks/x fails', gcase([PH, 'hooks/x'], 'fix(384-01): probe', true).status === 1);
    check('B8 a phase-path commit that also touches .planning/STATE.md passes', gcase([PH, '.planning/STATE.md'], 'docs(384-01): probe', true).status === 0);
    check('B8 a phase-path commit that also touches .planning/other.md fails', gcase([PH, '.planning/other.md'], 'docs(384-01): probe', true).status === 1);
    check('B8 a fix(384-02) commit that touches lib/y fails', gcase(['lib/y'], 'fix(384-02): probe', true).status === 1);
    const p383 = gcase(['lib/y'], 'fix(383-01): probe', true);
    check('B8 a fix(383-01) commit with the trailer that touches lib/y passes with the note', p383.status === 0 && /peer commits touching product paths: 1/.test(p383.out), p383.status + ' ' + p383.out.slice(0, 200));
    check('B8 an untagged commit with the trailer that touches lib/y fails', gcase(['lib/y'], 'fix: probe', true).status === 1);
    const p261 = gcase(['lib/y'], 'fix(261030-eo7): probe', true);
    check('B8 a fix(261030-eo7) commit with the trailer that touches lib/y passes with the note', p261.status === 0 && /peer commits touching product paths: 1/.test(p261.out), p261.status + ' ' + p261.out.slice(0, 200));
    const pphase = gcase(['lib/y'], 'fix(phase-383): probe', true);
    check('B8 a fix(phase-383) commit with the trailer that touches lib/y passes with the note', pphase.status === 0 && /peer commits touching product paths: 1/.test(pphase.out), pphase.status + ' ' + pphase.out.slice(0, 200));
    const pquick = gcase(['lib/y'], 'fix(quick-261104-fva): probe', true);
    check('B8 a fix(quick-261104-fva) commit with the trailer that touches lib/y passes with the note', pquick.status === 0 && /peer commits touching product paths: 1/.test(pquick.out), pquick.status + ' ' + pquick.out.slice(0, 200));
    check('B8 a decimal phase tag (369.6-10) with the trailer that touches lib/y passes', gcase(['lib/y'], 'fix(369.6-10): probe', true).status === 0);
    check('B8 an untagged commit without the trailer that touches lib/y passes', gcase(['lib/y'], 'fix: probe', false).status === 0);
    check('B8 phase-guard without an argument exits 2', spawnSync(process.execPath, [GUARD], { encoding: 'utf8' }).status === 2);

    // the target list
    check('targets: at least 28 ids', H.TARGETS.length >= 28, String(H.TARGETS.length));
    const tl = run(['targets']);
    check('targets: the CLI prints one id per line', tl.status === 0 && tl.stdout.split('\n').filter(Boolean).length === H.TARGETS.length);
  } catch (e) {
    failed += 1;
    process.stdout.write('  FAIL unexpected error :: ' + String(e && e.stack || e) + '\n');
  }
  finish();
}

function treeDirForB6() { return path.join(TMP, 'tree'); }

function finish() {
  cleanup();
  if (failed > 0) {
    process.stdout.write('perf-harness: ' + failed + ' FAILED\n');
    process.exit(1);
  }
  process.stdout.write('perf-harness: ALL PASS\n');
  process.exit(0);
}
