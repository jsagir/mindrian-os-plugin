'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 384 plan 01: self-test of tools/perf/perf-harness.cjs and tools/perf/phase-guard.cjs.
 * Checks H1 to H11 (carried over from the 382 self-test and adapted to the 384 names) and B1 to B8
 * (names, per-target gate, per-target fields, failed-run rule, verify-results schemas, test-only
 * flags, lock check, phase-guard). Plan 384-02 adds A1 to A5 and X11 (run mechanics: the run marker and kill
 * hygiene, the count pass, restore per target, the source-keyed bench folder, the changed-path proof, sandbox
 * cleanup on error). Node built-ins only. Exit 1 on any failed check.
 * Measurements are never taken here: the run checks use a synthetic room and a small tree,
 * with MOS_PERF_SELFTEST=1 (the variable that unlocks the test-only flags --allow-short and --skip-gates).
 * Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, spawn } = require('node:child_process');

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

    partA();

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

// ---------------------------------------------------------------------------
// Plan 384-02 Task 1: checks A1 to A5 (run mechanics) and X11 (sandbox cleanup on error)
// ---------------------------------------------------------------------------
function procIds() { try { return fs.readdirSync('/proc').filter((d) => /^[0-9]+$/.test(d)); } catch (_e) { return []; } }
function markerProcCount() {
  let n = 0;
  for (const p of procIds()) {
    try { if (fs.readFileSync('/proc/' + p + '/environ', 'latin1').indexOf('MOS_PERF_RUN_ID=') !== -1) n += 1; } catch (_e) { /* gone or not ours */ }
  }
  return n;
}
function cmdlineAlive(text) {
  for (const p of procIds()) {
    if (p === String(process.pid)) continue;
    try { if (fs.readFileSync('/proc/' + p + '/cmdline', 'latin1').split('\0').join(' ').indexOf(text) !== -1) return true; } catch (_e) { /* gone */ }
  }
  return false;
}
function pidRunning(pid) {
  try {
    const stat = fs.readFileSync('/proc/' + pid + '/stat', 'utf8');
    return stat.slice(stat.lastIndexOf(')') + 2, stat.lastIndexOf(')') + 3) !== 'Z';
  } catch (_e) { return false; }
}
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_e) { return null; } }
function tgt(r, id) { return r && Array.isArray(r.targets) ? r.targets.find((x) => x.id === id) : undefined; }

function partA() {
  const base = ['--room', 'synthetic', '--allow-short'];

  // A1: marker, escaped background work
  const idLog = path.join(TMP, 'runids.log');
  const a1Tree = hookTree(path.join(TMP, 'a1tree'), {
    SessionEnd: [{ hooks: [{ type: 'command', command: 'printf "%s\\n" "$MOS_PERF_RUN_ID" >> ' + idLog + '; setsid sleep 1.2 &', timeout: 5 }] }],
    PreCompact: [{ hooks: [{ type: 'command', command: 'sleep 0.1', timeout: 5 }] }],
  });
  const a1Out = path.join(TMP, 'a1.json');
  const a1 = run(['run', '--tree', a1Tree].concat(base, ['--runs', '3', '--targets', 'event:SessionEnd,event:PreCompact', '--out', a1Out]));
  const a1r = readJson(a1Out);
  const ids = fs.existsSync(idLog) ? fs.readFileSync(idLog, 'utf8').split('\n').filter(Boolean) : [];
  check('A1 every run gives the hook a non-empty MOS_PERF_RUN_ID and the values differ', a1.status === 0 && ids.length === 3 && new Set(ids).size === 3, a1.status + ' ' + JSON.stringify(ids) + ' ' + String(a1.stderr).slice(0, 200));
  const a1e = tgt(a1r, 'event:SessionEnd');
  const a1n = tgt(a1r, 'event:PreCompact');
  check('A1 a setsid background sleep gives background_ms of 1000 or more', !!a1e && a1e.background_ms >= 1000, a1e ? String(a1e.background_ms) : 'no target');
  check('A1 a setsid background sleep gives escaped_max of 1 or more', !!a1e && a1e.escaped_max >= 1, a1e ? String(a1e.escaped_max) : 'no target');
  check('A1 a hook without background work gives escaped_max 0', !!a1n && a1n.escaped_max === 0, a1n ? String(a1n.escaped_max) : 'no target');

  // A1: kill hygiene (T-384-06)
  const bystander = spawn('sleep', ['30.7'], { stdio: 'ignore' });
  const a1kTree = hookTree(path.join(TMP, 'a1ktree'), { SessionEnd: [{ hooks: [{ type: 'command', command: 'setsid sleep 30.5 &', timeout: 5 }] }] });
  const a1kOut = path.join(TMP, 'a1k.json');
  const a1k = run(['run', '--tree', a1kTree].concat(base, ['--runs', '1', '--settle-ms', '1000', '--targets', 'event:SessionEnd', '--out', a1kOut]));
  const a1kr = readJson(a1kOut);
  const a1kt = tgt(a1kr, 'event:SessionEnd');
  check('A1 a survivor after the settle limit gives a failed run with survivors_left 1', a1k.status === 0 && !!a1kt && a1kt.failed_runs === 1 && a1kt.n === 0 && a1kt.survivors_left === 1, a1k.status + ' ' + JSON.stringify(a1kt && [a1kt.failed_runs, a1kt.n, a1kt.survivors_left]) + ' ' + String(a1k.stderr).slice(0, 200));
  check('A1 no process with the run marker is left after the run', markerProcCount() === 0, String(markerProcCount()));
  check('A1 the marked survivor (sleep 30.5) is dead', !cmdlineAlive('sleep 30.5'));
  check('A1 a bystander sleep without the marker is still alive', pidRunning(bystander.pid) && cmdlineAlive('sleep 30.7'));
  try { bystander.kill('SIGKILL'); } catch (_e) { /* gone */ }

  // A2: the count pass stops an MCP server with SIGTERM first
  const a2Tree = path.join(TMP, 'a2tree');
  fs.mkdirSync(path.join(a2Tree, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(a2Tree, 'scripts', 'mindrian-mcp-server.cjs'),
    "process.stdin.on('data', (d) => { if (String(d).indexOf('initialize') !== -1) process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }) + '\\n'); });\n" +
    "process.stdin.on('end', () => {});\nsetTimeout(() => {}, 60000);\n");
  const a2Out = path.join(TMP, 'a2.json');
  const a2 = run(['run', '--tree', a2Tree].concat(base, ['--runs', '1', '--count-pass', '--targets', 'mcp:mindrian-os', '--out', a2Out]));
  const a2t = tgt(readJson(a2Out), 'mcp:mindrian-os');
  check('A2 a count pass of a stopped MCP server reports node_starts of 1 or more', a2.status === 0 && !!a2t && a2t.node_starts >= 1, a2.status + ' ' + JSON.stringify(a2t) + ' ' + String(a2.stderr).slice(0, 200));
  check('A2 the fake server is not left running', !cmdlineAlive(path.join(a2Tree, 'scripts', 'mindrian-mcp-server.cjs')));

  // A3: restore per target
  const a3Src = path.join(TMP, 'a3src');
  fs.mkdirSync(a3Src, { recursive: true });
  fs.writeFileSync(path.join(a3Src, 'appended.txt'), 'a\nb\n');
  fs.writeFileSync(path.join(a3Src, 'STATE.md'), '# synthetic\n');
  const a3Log = path.join(TMP, 'a3.log');
  const a3cmd = 'n=$(wc -l < "$PWD/appended.txt"); echo $((n)) >> ' + a3Log + '; echo more >> "$PWD/appended.txt"';
  const a3Tree = hookTree(path.join(TMP, 'a3tree'), {
    SessionEnd: [{ hooks: [{ type: 'command', command: a3cmd, timeout: 5 }] }],
    PreCompact: [{ hooks: [{ type: 'command', command: a3cmd, timeout: 5 }] }],
  });
  function a3run(mode) {
    const scratch = path.join(TMP, 'a3s-' + mode);
    fs.mkdirSync(scratch, { recursive: true });
    try { fs.rmSync(a3Log, { force: true }); } catch (_e) { /* none */ }
    const r = run(['run', '--tree', a3Tree, '--room', 'copy', '--source', a3Src, '--allow-short', '--runs', '1', '--restore', mode, '--targets', 'event:SessionEnd,event:PreCompact', '--scratch', scratch, '--out', path.join(TMP, 'a3-' + mode + '.json')]);
    const counts = fs.existsSync(a3Log) ? fs.readFileSync(a3Log, 'utf8').split('\n').filter(Boolean) : [];
    return { r, counts };
  }
  const a3t = a3run('per-target');
  check('A3 with per-target every hook sees the snapshot line count (2, 2)', a3t.r.status === 0 && a3t.counts.join(',') === '2,2', a3t.r.status + ' ' + a3t.counts.join(',') + ' ' + String(a3t.r.stderr).slice(0, 200));
  check('A3 the restore time per target is printed to stderr as a number', /restore [0-9]+(\.[0-9]+)? ms/.test(String(a3t.r.stderr)), String(a3t.r.stderr).slice(0, 300));
  const a3s = a3run('per-set');
  check('A3 with per-set the counts grow (2, 3)', a3s.r.status === 0 && a3s.counts.join(',') === '2,3', a3s.r.status + ' ' + a3s.counts.join(',') + ' ' + String(a3s.r.stderr).slice(0, 200));
  check('A3 a bad --restore value exits 2', run(['run', '--tree', a3Tree, '--room', 'copy', '--source', a3Src, '--allow-short', '--runs', '1', '--restore', 'often', '--out', path.join(TMP, 'a3x.json')]).status === 2);

  // A4: the bench folder is keyed by the source
  const a4s = path.join(TMP, 'a4scratch');
  fs.mkdirSync(a4s, { recursive: true });
  const srcA = path.join(TMP, 'a4srcA');
  const srcB = path.join(TMP, 'a4srcB');
  fs.mkdirSync(srcA, { recursive: true });
  fs.mkdirSync(srcB, { recursive: true });
  ['one.md', 'two.md'].forEach((n) => fs.writeFileSync(path.join(srcA, n), 'a\n'));
  ['one.md', 'two.md', 'three.md', 'four.md'].forEach((n) => fs.writeFileSync(path.join(srcB, n), 'b\n'));
  const a4run = (src, out) => run(['run', '--tree', REPO, '--room', 'copy', '--source', src, '--allow-short', '--runs', '1', '--targets', 'floor:node', '--scratch', a4s, '--out', out]);
  const a4a = a4run(srcA, path.join(TMP, 'a4a.json'));
  const a4b = a4run(srcB, path.join(TMP, 'a4b.json'));
  const a4ra = readJson(path.join(TMP, 'a4a.json'));
  const a4rb = readJson(path.join(TMP, 'a4b.json'));
  check('A4 the first run holds the file count of source A (2)', a4a.status === 0 && !!a4ra && a4ra.room.file_count === 2, a4a.status + ' ' + (a4ra ? a4ra.room.file_count : 'no file') + ' ' + String(a4a.stderr).slice(0, 200));
  check('A4 the second run holds the file count of source B (4), not a reused snapshot', a4b.status === 0 && !!a4rb && a4rb.room.file_count === 4, a4b.status + ' ' + (a4rb ? a4rb.room.file_count : 'no file') + ' ' + String(a4b.stderr).slice(0, 200));
  const benchBase = path.join(a4s, 'mos-384-bench');
  const keysBefore = fs.existsSync(benchBase) ? fs.readdirSync(benchBase) : [];
  check('A4 the bench folder holds one key folder per source (2)', keysBefore.length === 2 && keysBefore.every((k) => /^[0-9a-f]{8}$/.test(k)), keysBefore.join(','));
  const cleanA = run(['clean-bench', '--source', srcA, '--scratch', a4s]);
  const keysAfter = fs.existsSync(benchBase) ? fs.readdirSync(benchBase) : [];
  check('A4 clean-bench --source removes only that source folder', cleanA.status === 0 && keysAfter.length === 1 && keysBefore.includes(keysAfter[0]), cleanA.status + ' ' + keysAfter.join(','));
  check('A4 clean-bench without --source and without --all exits 2', run(['clean-bench', '--scratch', a4s]).status === 2);
  const cleanAll = run(['clean-bench', '--all', '--scratch', a4s]);
  check('A4 clean-bench --all removes the whole mos-384-bench folder', cleanAll.status === 0 && !fs.existsSync(benchBase));

  // A5: the changed path is proved from the state log of the room
  const stopSync = hookTree(path.join(TMP, 'a5sync'), { Stop: [{ hooks: [{ type: 'command', command: 'mkdir -p .mindrian; printf "%s on-stop-state mode=sync reason=changed\\n" now >> .mindrian/session-close.log', timeout: 5 }] }] });
  const stopSkip = hookTree(path.join(TMP, 'a5skip'), { Stop: [{ hooks: [{ type: 'command', command: 'mkdir -p .mindrian; printf "%s on-stop-state mode=skip reason=unchanged\\n" now >> .mindrian/session-close.log', timeout: 5 }] }] });
  const startCompute = hookTree(path.join(TMP, 'a5start'), { SessionStart: [{ hooks: [{ type: 'command', command: 'mkdir -p .mindrian; printf "%s state mode=compute reason=changed\\n" now >> .mindrian/session-start-state.log', timeout: 5 }] }] });
  const noLog = hookTree(path.join(TMP, 'a5none'), { Stop: [{ hooks: [{ type: 'command', command: 'true', timeout: 5 }] }] });
  const a5 = (tree, id, out) => { const r = run(['run', '--tree', tree].concat(base, ['--runs', '2', '--targets', id, '--out', out])); return { r, t: tgt(readJson(out), id) }; };
  const a5sync = a5(stopSync, 'event:Stop:changed', path.join(TMP, 'a5sync.json'));
  check('A5 a Stop hook that logs mode=sync proves the changed path (changed_taken_runs = n)', a5sync.r.status === 0 && !!a5sync.t && a5sync.t.n === 2 && a5sync.t.changed_taken_runs === 2, a5sync.r.status + ' ' + JSON.stringify(a5sync.t && [a5sync.t.n, a5sync.t.changed_taken_runs]) + ' ' + String(a5sync.r.stderr).slice(0, 200));
  const a5skip = a5(stopSkip, 'event:Stop:unchanged', path.join(TMP, 'a5skip.json'));
  check('A5 a Stop hook that logs mode=skip gives changed_taken_runs 0', a5skip.r.status === 0 && !!a5skip.t && a5skip.t.n === 2 && a5skip.t.changed_taken_runs === 0 && a5skip.t.changed_unknown_runs === 0, a5skip.r.status + ' ' + JSON.stringify(a5skip.t && [a5skip.t.n, a5skip.t.changed_taken_runs, a5skip.t.changed_unknown_runs]));
  const a5start = a5(startCompute, 'event:SessionStart:changed', path.join(TMP, 'a5start.json'));
  check('A5 a SessionStart hook that logs state mode=compute proves the changed path', a5start.r.status === 0 && !!a5start.t && a5start.t.changed_taken_runs === 2, a5start.r.status + ' ' + JSON.stringify(a5start.t && a5start.t.changed_taken_runs));
  const a5none = a5(noLog, 'event:Stop:changed', path.join(TMP, 'a5none.json'));
  check('A5 a hook that writes no state line gives unknown runs (null), not false', a5none.r.status === 0 && !!a5none.t && a5none.t.changed_taken_runs === 0 && a5none.t.changed_unknown_runs === 2, a5none.r.status + ' ' + JSON.stringify(a5none.t && [a5none.t.changed_taken_runs, a5none.t.changed_unknown_runs]));
  const a5text = fs.readFileSync(path.join(TMP, 'a5sync.json'), 'utf8');
  check('A5 the result holds no state-log text', !/on-stop-state|reason=changed/.test(a5text));

  // A5: verify-results rules
  const changedT = (mut) => badDir5('a5v-' + (a5seq += 1), (r) => { r.targets[0].id = 'event:Stop:changed'; r.targets[0].changed_taken_runs = 7; r.targets[0].changed_unknown_runs = 0; mut(r.targets[0]); });
  const vr5 = (d) => run(['verify-results', d]);
  check('A5 verify-results: a :changed target with changed_taken_runs = n exits 0', vr5(changedT(() => {})).status === 0);
  check('A5 verify-results: a :changed target with changed_taken_runs below n exits 1', vr5(changedT((t) => { t.changed_taken_runs = 6; })).status === 1);
  check('A5 verify-results: an :unchanged target with changed_taken_runs above 0 exits 1', vr5(changedT((t) => { t.id = 'event:SessionStart:unchanged'; t.changed_taken_runs = 1; })).status === 1);
  check('A5 verify-results: an :unchanged target with changed_taken_runs 0 exits 0', vr5(changedT((t) => { t.id = 'event:Stop:unchanged:tx4m'; t.changed_taken_runs = 0; })).status === 0);
  const unk = vr5(changedT((t) => { t.changed_taken_runs = 0; t.changed_unknown_runs = 7; }));
  check('A5 verify-results: all runs unknown (null) is a warning, exit 0', unk.status === 0 && /warning/.test(String(unk.stderr)), unk.status + ' ' + String(unk.stderr).slice(0, 200));
  check('A5 verify-results: a :changed target without the field exits 1', vr5(changedT((t) => { delete t.changed_taken_runs; delete t.changed_unknown_runs; })).status === 1);

  // X11: no sandbox is left when the run throws
  const x11s = path.join(TMP, 'x11scratch');
  fs.mkdirSync(x11s, { recursive: true });
  const x11 = run(['run', '--tree', REPO, '--room', 'copy', '--source', path.join(TMP, 'does-not-exist'), '--allow-short', '--runs', '1', '--targets', 'floor:node', '--scratch', x11s, '--out', path.join(TMP, 'x11.json')]);
  const left = fs.readdirSync(x11s).filter((n) => /^mos-384-run-/.test(n));
  check('X11 a run that throws leaves no mos-384-run- sandbox in the scratch folder', x11.status !== 0 && left.length === 0, x11.status + ' left ' + left.length);
}

let a5seq = 0;
function badDir5(name, mutate) {
  const d = path.join(TMP, name);
  fs.mkdirSync(d);
  const machine = {
    cores: 12, node: 'v22.0.0', platform: 'linux', arch: 'x64', kernel: 'k', cpu_cap: 4, fs_type: 'ext2/ext3',
    head_sha: 'abc', tree_label: 'a', base_sha: 'b'.repeat(40), started_at: '2026-01-01T00:00:00.000Z',
    ended_at: '2026-01-01T00:01:00.000Z', load1_start: 0.5, load1_end: 0.6,
  };
  const r = validResult();
  r.machine = machine;
  mutate(r);
  fs.writeFileSync(path.join(d, 'set1.json'), JSON.stringify(r));
  return d;
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
