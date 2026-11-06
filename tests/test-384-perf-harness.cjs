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

    // B9: the explicit exception list for known planning-only commits (rule a only)
    const PG = require(GUARD);
    function gsynth(files, subject) {
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
      g(['commit', '-q', '-m', subject]);
      return { dir, baseSha, sha: g(['rev-parse', 'HEAD']).stdout.trim() };
    }
    const PLAN_MIX = ['.planning/phases/384-x/384-LEADS.md', '.planning/HANDOFF-x.md', '.planning/phases/390-y/390-PRD.md'];
    check('B9 the exception list is exported and holds full 40-character shas', Array.isArray(PG.KNOWN_PLANNING_ONLY_COMMITS) && PG.KNOWN_PLANNING_ONLY_COMMITS.length >= 1 && PG.KNOWN_PLANNING_ONLY_COMMITS.every((s) => /^[0-9a-f]{40}$/.test(s)));
    const b9a = gsynth(PLAN_MIX, 'docs: planning notes');
    const b9aOff = PG.checkHistory(b9a.dir, b9a.baseSha, 'HEAD', []);
    check('B9 a mixed planning commit that is not on the list fails rule a', b9aOff.violations.length === 1 && /rule a/.test(b9aOff.violations[0]), JSON.stringify(b9aOff.violations));
    const b9aOn = PG.checkHistory(b9a.dir, b9a.baseSha, 'HEAD', [b9a.sha]);
    check('B9 the same commit on the list passes rule a and prints the note', b9aOn.violations.length === 0 && b9aOn.notes.indexOf('known planning-only commit exempt from rule a: ' + b9a.sha.slice(0, 9)) !== -1, JSON.stringify(b9aOn));
    const b9b = gsynth(PLAN_MIX.concat(['hooks/x']), 'docs: planning notes and a hook');
    const b9bOn = PG.checkHistory(b9b.dir, b9b.baseSha, 'HEAD', [b9b.sha]);
    check('B9 a listed commit that touches a product path is still a violation', b9bOn.violations.some((v) => /rule a/.test(v)) && b9bOn.notes.length === 0, JSON.stringify(b9bOn));
    const b9c = gsynth(PLAN_MIX.concat(['.planning/other.json']), 'docs: planning notes and json');
    const b9cOn = PG.checkHistory(b9c.dir, b9c.baseSha, 'HEAD', [b9c.sha]);
    check('B9 a listed commit that touches a non-markdown .planning file is still a violation', b9cOn.violations.some((v) => /rule a/.test(v)) && b9cOn.notes.length === 0, JSON.stringify(b9cOn));
    const b9d = gsynth(['tools/perf/guard-probe.txt', 'hooks/x'], 'docs: mixed');
    const b9dOn = PG.checkHistory(b9d.dir, b9d.baseSha, 'HEAD', [b9a.sha]);
    check('B9 a normal mixed commit still fails with a list that holds another sha', b9dOn.violations.some((v) => /rule a/.test(v)), JSON.stringify(b9dOn));
    const b9e = gsynth(['tools/perf/guard-probe.txt', 'hooks/x'], 'fix(384-01): mixed');
    const b9eOn = PG.checkHistory(b9e.dir, b9e.baseSha, 'HEAD', [b9e.sha]);
    check('B9 a listed product commit with the phase tag still fails rule b', b9eOn.violations.some((v) => /rule b/.test(v)), JSON.stringify(b9eOn));
    // the real repository range (skipped when the history is not present, for example in a shallow clone)
    const REAL_BASE = 'db2ea3b05bb70b55741bdeb40b545801b0c37cbe';
    const REAL_COMMIT = '5d58018aa02cc432235fe892745a66b2ab566744';
    const haveReal = spawnSync('git', ['cat-file', '-e', REAL_BASE + '^{commit}'], { cwd: REPO }).status === 0 && spawnSync('git', ['cat-file', '-e', REAL_COMMIT + '^{commit}'], { cwd: REPO }).status === 0 && spawnSync('git', ['merge-base', '--is-ancestor', REAL_BASE, REAL_COMMIT], { cwd: REPO }).status === 0;
    if (haveReal) {
      const realRun = spawnSync(process.execPath, [GUARD, REAL_BASE, '--repo', REPO, '--head', REAL_COMMIT], { encoding: 'utf8' });
      const realOut = String(realRun.stdout) + String(realRun.stderr);
      check('B9 the real range up to the planning commit passes and prints the note', realRun.status === 0 && realOut.indexOf('known planning-only commit exempt from rule a: 5d58018aa') !== -1, realRun.status + ' ' + realOut.slice(0, 300));
    } else {
      process.stdout.write('  skip B9 real range (history not present)\n');
    }

    partA();

    // the target list
    check('targets: at least 28 ids', H.TARGETS.length >= 28, String(H.TARGETS.length));
    const tl = run(['targets']);
    check('targets: the CLI prints one id per line', tl.status === 0 && tl.stdout.split('\n').filter(Boolean).length === H.TARGETS.length);
  } catch (e) {
    failed += 1;
    process.stdout.write('  FAIL unexpected error :: ' + String(e && e.stack || e) + '\n');
  }
  partW().catch((e) => { failed += 1; process.stdout.write('  FAIL unexpected error in part W :: ' + String(e && e.stack || e) + '\n'); })
    .then(partQ).catch((e) => { failed += 1; process.stdout.write('  FAIL unexpected error in part Q :: ' + String(e && e.stack || e) + '\n'); })
    .then(finish);
}

// ---------------------------------------------------------------------------
// Plan 384-02 Task 2: checks W1 to W6 (transcript fixture, SessionStart compact, class counts, per-hook results, library surface)
// ---------------------------------------------------------------------------
async function partW() {
  const base = ['--room', 'synthetic', '--allow-short'];

  // W1: the synthetic transcript is accepted by the real parser
  check('W1 makeTranscript is exported', typeof H.makeTranscript === 'function');
  if (typeof H.makeTranscript === 'function') {
    const tf = path.join(TMP, 'w1-transcript.jsonl');
    H.makeTranscript(tf, 4194304);
    const size = fs.statSync(tf).size;
    check('W1 the transcript is 4194304 bytes or more', size >= 4194304, String(size));
    const lines = fs.readFileSync(tf, 'utf8').split('\n').filter(Boolean);
    let allParse = true;
    const roles = [];
    for (const l of lines) { try { const o = JSON.parse(l); roles.push((o.message && o.message.role) || o.type); } catch (_e) { allParse = false; break; } }
    check('W1 every line parses as JSON', allParse && lines.length > 100);
    check('W1 the records alternate user and assistant turns', allParse && roles.every((r, i) => r === (i % 2 === 0 ? 'user' : 'assistant')), roles.slice(0, 4).join(','));
    const turn = require(path.join(REPO, 'lib', 'hmi', 'turn-text.cjs')).readTurnText(tf);
    check('W1 the real parser readTurnText returns a non-empty output_text', typeof turn.output_text === 'string' && turn.output_text.length > 0, JSON.stringify(Object.keys(turn)));
    check('W1 the real parser sees a user turn before the last assistant turn', turn.preceding_user_text.length > 0);
    const small = path.join(TMP, 'w1-small.jsonl');
    H.makeTranscript(small, 1000);
    check('W1 a small transcript is 1000 bytes or more and ends on an assistant turn', fs.statSync(small).size >= 1000 && JSON.parse(fs.readFileSync(small, 'utf8').trim().split('\n').pop()).message.role === 'assistant');
  }

  // W2: targets
  const tl = run(['targets']).stdout.split('\n').filter(Boolean);
  check('W2 targets lists event:Stop:changed:tx4m, event:Stop:unchanged:tx4m and event:SessionStart:compact', ['event:Stop:changed:tx4m', 'event:Stop:unchanged:tx4m', 'event:SessionStart:compact'].every((t) => tl.includes(t)), tl.filter((t) => /Stop|compact/.test(t)).join(','));
  check('W2 the existing Stop and SessionStart targets keep their ids', ['event:Stop:changed', 'event:Stop:unchanged', 'event:SessionStart:changed', 'event:SessionStart:unchanged'].every((t) => tl.includes(t)));

  // W3: payloads
  check('W3 buildEventPayload is exported', typeof H.buildEventPayload === 'function');
  if (typeof H.buildEventPayload === 'function') {
    const fakeCtx = { roomDir: path.join(TMP, 'w3room'), touchTarget: null, sandbox: { transcript: '/plain/empty.jsonl' }, getTranscript: () => '/big/tx4m.jsonl' };
    const defOf = (id) => ({ id, kind: 'event', event: id.split(':')[1], shape: null, change: null });
    const comp = H.buildEventPayload(Object.assign(defOf('event:SessionStart:compact'), { source: 'compact' }), fakeCtx);
    check('W3 SessionStart compact sends source = compact', comp.source === 'compact', JSON.stringify(comp));
    const startup = H.buildEventPayload(defOf('event:SessionStart:changed'), fakeCtx);
    check('W3 the other SessionStart targets send source = startup', startup.source === 'startup', JSON.stringify(startup));
    const tx = H.buildEventPayload(Object.assign(defOf('event:Stop:changed:tx4m'), { transcript: 'tx4m' }), fakeCtx);
    check('W3 a tx4m target sends the generated transcript_path', tx.transcript_path === '/big/tx4m.jsonl', tx.transcript_path);
    const plain = H.buildEventPayload(defOf('event:Stop:changed'), fakeCtx);
    check('W3 the plain Stop target keeps the empty transcript', plain.transcript_path === '/plain/empty.jsonl', plain.transcript_path);
    check('W3 the payload carries the stable session id sess-384-measure', plain.session_id === 'sess-384-measure');
  }

  // W2/W3 end to end: the hooks see the source field and the transcript size
  const w2Log = path.join(TMP, 'w2.log');
  const logCmd = 'in=$(cat); src=$(printf %s "$in" | sed -n \'s/.*"source":"\\([^"]*\\)".*/\\1/p\'); tp=$(printf %s "$in" | sed -n \'s/.*"transcript_path":"\\([^"]*\\)".*/\\1/p\'); sz=0; [ -f "$tp" ] && sz=$(wc -c < "$tp"); echo "src=$src size=$((sz))" >> "$MOS_T_LOG"';
  const w2Tree = hookTree(path.join(TMP, 'w2tree'), {
    Stop: [{ hooks: [{ type: 'command', command: logCmd, timeout: 5 }] }],
    SessionStart: [{ hooks: [{ type: 'command', command: logCmd, timeout: 5 }] }],
  });
  // hook commands name no path: the result holds the command text as the hook id and the Part 8 scan blocks paths
  const w2run = (id, out) => run(['run', '--tree', w2Tree].concat(base, ['--runs', '1', '--targets', id, '--out', out]), { env: { MOS_T_LOG: w2Log } });
  const lastLog = () => (fs.existsSync(w2Log) ? fs.readFileSync(w2Log, 'utf8').split('\n').filter(Boolean) : []);
  fs.rmSync(w2Log, { force: true });
  const rc = w2run('event:SessionStart:compact', path.join(TMP, 'w2c.json'));
  check('W2 a run of event:SessionStart:compact sends source = compact to the hook', rc.status === 0 && lastLog().length >= 1 && lastLog().every((l) => /^src=compact /.test(l)), rc.status + ' ' + lastLog().join('|') + ' ' + String(rc.stderr).slice(0, 200));
  fs.rmSync(w2Log, { force: true });
  const rs = w2run('event:SessionStart:unchanged', path.join(TMP, 'w2s.json'));
  check('W3 a run of event:SessionStart:unchanged sends source = startup', rs.status === 0 && lastLog().length >= 1 && lastLog().every((l) => /^src=startup /.test(l)), rs.status + ' ' + lastLog().join('|'));
  fs.rmSync(w2Log, { force: true });
  const rt = w2run('event:Stop:unchanged:tx4m', path.join(TMP, 'w2t.json'));
  const bigSizes = lastLog().map((l) => Number((l.match(/size=(\d+)/) || [])[1]));
  check('W2 a run of event:Stop:unchanged:tx4m hands the hook a transcript of 4194304 bytes or more', rt.status === 0 && bigSizes.length >= 1 && bigSizes.every((n) => n >= 4194304), rt.status + ' ' + bigSizes.join(',') + ' ' + String(rt.stderr).slice(0, 200));
  fs.rmSync(w2Log, { force: true });
  const rp = w2run('event:Stop:unchanged', path.join(TMP, 'w2p.json'));
  const plainSizes = lastLog().map((l) => Number((l.match(/size=(\d+)/) || [])[1]));
  check('W2 a run of event:Stop:unchanged hands the hook an empty transcript', rp.status === 0 && plainSizes.length >= 1 && plainSizes.every((n) => n === 0), rp.status + ' ' + plainSizes.join(','));

  // W4: isolation counts by class (the exit rule stays strict)
  const w4Src = path.join(TMP, 'w4src');
  fs.mkdirSync(w4Src, { recursive: true });
  fs.writeFileSync(path.join(w4Src, 'STATE.md'), '# synthetic\n');
  const w4Tree = hookTree(path.join(TMP, 'w4tree'), {
    SessionEnd: [{ hooks: [{ type: 'command', command: 'echo x >> "$PWD/x.db-shm"; echo y >> "$MOS_T_SRC/x.db-shm"', timeout: 5 }] }],
  });
  const w4Out = path.join(TMP, 'w4.json');
  const w4Scratch = path.join(TMP, 'w4scratch');
  fs.mkdirSync(w4Scratch, { recursive: true });
  const w4 = run(['run', '--tree', w4Tree, '--room', 'copy', '--source', w4Src, '--allow-short', '--runs', '1', '--targets', 'event:SessionEnd', '--scratch', w4Scratch, '--out', w4Out], { env: { MOS_T_SRC: w4Src } });
  const w4r = readJson(w4Out);
  const iso = w4r && w4r.isolation;
  const classKeys = (o) => !!o && ['shm', 'wal', 'db', 'other'].every((k) => Number.isInteger(o[k]));
  check('W4 a shm file changed in both the copy and the source exits 3', w4.status === 3, w4.status + ' ' + String(w4.stderr).slice(0, 200));
  check('W4 intersect_by_class.shm is 1 and the other classes are 0', !!iso && classKeys(iso.intersect_by_class) && iso.intersect_by_class.shm === 1 && iso.intersect_by_class.wal === 0 && iso.intersect_by_class.db === 0 && iso.intersect_by_class.other === 0, JSON.stringify(iso));
  check('W4 source_changed_by_class and copy_changed_by_class hold the four integer keys', !!iso && classKeys(iso.source_changed_by_class) && classKeys(iso.copy_changed_by_class) && iso.source_changed_by_class.shm === 1 && iso.copy_changed_by_class.shm === 1, JSON.stringify(iso));
  check('W4 the old isolation fields and exit_code 3 are unchanged', !!iso && iso.intersect_paths === 1 && iso.exit_code === 3 && iso.source_changed_paths === 1 && iso.copy_changed_paths === 1, JSON.stringify(iso));
  check('W4 the isolation block holds no path and no file name, and the result holds no source or scratch path', !!w4r && !/x\.db-shm|db-shm|w4src|w4scratch|\//.test(JSON.stringify(iso)) && !/w4src|w4scratch/.test(fs.readFileSync(w4Out, 'utf8')));
  check('W4 the class comes from the file name only (wal, db, other, shm)', typeof H.classOfPath === 'function' && H.classOfPath('a/room.db-wal') === 'wal' && H.classOfPath('room.db') === 'db' && H.classOfPath('a/b/room.db-shm') === 'shm' && H.classOfPath('a/notes.md') === 'other');

  // W5: the library surface
  const names = ['prepareRoom', 'restoreCopy', 'makeCtx', 'runChild', 'wrapArgv', 'runEventOnce', 'runCommandOnce', 'measureTarget', 'selectHooks', 'buildEventPayload', 'makeTranscript', 'manifest', 'changedPaths', 'writeResult', 'readLoad1', 'fsType', 'benchDir', 'gateBeforeTarget', 'requireLock', 'statsSummary', 'machineRecord'];
  const missing = names.filter((n) => typeof H[n] !== 'function');
  check('W5 all 21 library functions are exported', missing.length === 0, missing.join(','));
  check('W5 SHAPES, EVENT_TARGETS and TARGETS are exported', !!H.SHAPES && typeof H.SHAPES === 'object' && Array.isArray(H.EVENT_TARGETS) && Array.isArray(H.TARGETS));
  if (typeof H.selectHooks === 'function') {
    const hooks = [
      { event: 'SessionStart', matcher: 'startup', command: 'a' },
      { event: 'SessionStart', matcher: 'compact', command: 'b' },
      { event: 'PreToolUse', matcher: 'Write|Edit', command: 'c' },
      { event: 'SessionStart', matcher: null, command: 'node ${CLAUDE_PLUGIN_ROOT}/scripts/sessionstart-npm-reconcile.cjs' },
    ];
    const sel = H.selectHooks({ hooks }, { id: 'event:SessionStart:compact', kind: 'event', event: 'SessionStart', shape: null, change: null, source: 'compact' });
    check('W5 selectHooks gives the matching entries for source compact', sel.entries.map((e) => e.command).join(',') === 'b', sel.entries.map((e) => e.command).join(','));
    check('W5 selectHooks lists the network-capable hook as skipped with a reason', sel.skipped.length === 1 && sel.skipped[0].reason === 'network_capable', JSON.stringify(sel.skipped));
    const pre = H.selectHooks({ hooks }, { id: 'event:PreToolUse:Write', kind: 'event', event: 'PreToolUse', shape: 'Write', change: null });
    check('W5 selectHooks matches the tool shape (Write matches Write|Edit)', pre.entries.map((e) => e.command).join(',') === 'c' && pre.skipped.length === 0);
  }
  if (typeof H.runEventOnce === 'function' && typeof H.prepareRoom === 'function' && typeof H.makeCtx === 'function') {
    const stdinFile = path.join(TMP, 'w5-stdin.json');
    const w5Tree = hookTree(path.join(TMP, 'w5tree'), { SessionEnd: [{ hooks: [{ type: 'command', command: 'cat > ' + stdinFile, timeout: 5 }] }] });
    const prep = H.prepareRoom('synthetic', { trees: [w5Tree], scratch: TMP, baseSha: 'unknown' });
    try {
      const ctx = H.makeCtx('A', w5Tree, prep, 4, false);
      let calls = 0;
      let seen = null;
      const sample = await H.runEventOnce({ id: 'event:SessionEnd', kind: 'event', event: 'SessionEnd', shape: null, change: null }, ctx, {
        beforeRun: (c) => { calls += 1; seen = c; c.sandbox.transcript = '/changed/by/beforeRun.jsonl'; },
      });
      let payload = null;
      try { payload = JSON.parse(fs.readFileSync(stdinFile, 'utf8')); } catch (_e) { payload = null; }
      check('W5 runEventOnce calls opts.beforeRun(ctx) once per run', calls === 1 && seen === ctx, String(calls));
      check('W5 beforeRun runs before the payload is built', !!payload && payload.transcript_path === '/changed/by/beforeRun.jsonl', payload ? payload.transcript_path : 'no payload');
      check('W5 runEventOnce returns a sample with a wall time', sample && typeof sample.wall_ms === 'number' && sample.run_class === 'ok');
    } finally { prep.sandbox.cleanup(); }
  }

  // W6: per-hook wall and CPU
  const w6Tree = hookTree(path.join(TMP, 'w6tree'), { SessionEnd: [{ hooks: [
    { type: 'command', command: 'sleep 0.2', timeout: 5 },
    { type: 'command', command: 'sleep 0.1', timeout: 5 },
  ] }] });
  const w6Out = path.join(TMP, 'w6.json');
  const w6 = run(['run', '--tree', w6Tree].concat(base, ['--runs', '3', '--targets', 'event:SessionEnd', '--out', w6Out]));
  const w6t = tgt(readJson(w6Out), 'event:SessionEnd');
  const ph = w6t && w6t.per_hook;
  check('W6 the event result holds one per_hook entry per hook', w6.status === 0 && Array.isArray(ph) && ph.length === 2, w6.status + ' ' + JSON.stringify(ph));
  if (Array.isArray(ph) && ph.length === 2) {
    check('W6 per_hook ids are the command texts', ph[0].id === 'sleep 0.2' && ph[1].id === 'sleep 0.1', ph.map((p) => p.id).join(','));
    check('W6 per_hook entries hold async, wall_ms and cpu_ms', ph.every((p) => p.async === false && typeof p.wall_ms === 'number' && (p.cpu_ms === null || typeof p.cpu_ms === 'number')), JSON.stringify(ph));
    check('W6 per_hook wall medians are near 200 and 100 ms', ph[0].wall_ms >= 180 && ph[0].wall_ms < 320 && ph[1].wall_ms >= 90 && ph[1].wall_ms < 220, ph.map((p) => p.wall_ms).join(','));
    check('W6 the event wall median is near the larger hook (the long pole)', Math.abs(w6t.wall_ms.median - Math.max(ph[0].wall_ms, ph[1].wall_ms)) < 60, w6t.wall_ms.median + ' vs ' + ph.map((p) => p.wall_ms).join(','));
  }
  const w6c = run(['run', '--tree', REPO, '--room', 'synthetic', '--allow-short', '--runs', '1', '--targets', 'floor:node', '--out', path.join(TMP, 'w6c.json')]);
  const w6ct = tgt(readJson(path.join(TMP, 'w6c.json')), 'floor:node');
  check('W6 a command target holds no per_hook list', w6c.status === 0 && !!w6ct && w6ct.per_hook === undefined, w6c.status + ' ' + String(w6c.stderr).slice(0, 200));
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
    SessionEnd: [{ hooks: [{ type: 'command', command: 'printf "%s\\n" "$MOS_PERF_RUN_ID" >> "$MOS_T_LOG"; setsid sleep 1.2 &', timeout: 5 }] }],
    PreCompact: [{ hooks: [{ type: 'command', command: 'sleep 0.1', timeout: 5 }] }],
  });
  const a1Out = path.join(TMP, 'a1.json');
  const a1 = run(['run', '--tree', a1Tree].concat(base, ['--runs', '3', '--targets', 'event:SessionEnd,event:PreCompact', '--out', a1Out]), { env: { MOS_T_LOG: idLog } });
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
  const a3cmd = 'n=$(wc -l < "$PWD/appended.txt"); echo $((n)) >> "$MOS_T_LOG"; echo more >> "$PWD/appended.txt"';
  const a3Tree = hookTree(path.join(TMP, 'a3tree'), {
    SessionEnd: [{ hooks: [{ type: 'command', command: a3cmd, timeout: 5 }] }],
    PreCompact: [{ hooks: [{ type: 'command', command: a3cmd, timeout: 5 }] }],
  });
  function a3run(mode) {
    const scratch = path.join(TMP, 'a3s-' + mode);
    fs.mkdirSync(scratch, { recursive: true });
    try { fs.rmSync(a3Log, { force: true }); } catch (_e) { /* none */ }
    const r = run(['run', '--tree', a3Tree, '--room', 'copy', '--source', a3Src, '--allow-short', '--runs', '1', '--restore', mode, '--targets', 'event:SessionEnd,event:PreCompact', '--scratch', scratch, '--out', path.join(TMP, 'a3-' + mode + '.json')], { env: { MOS_T_LOG: a3Log } });
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
  const stopSync = hookTree(path.join(TMP, 'a5sync'), { Stop: [{ hooks: [{ type: 'command', command: 'mkdir -p .mindrian; printf "%s on-stop-state mode=sync reason=%s\\n" "$(date +%s)" "$MOS_T_MARK" >> .mindrian/session-close.log', timeout: 5 }] }] });
  const stopSkip = hookTree(path.join(TMP, 'a5skip'), { Stop: [{ hooks: [{ type: 'command', command: 'mkdir -p .mindrian; printf "%s on-stop-state mode=skip reason=unchanged\\n" now >> .mindrian/session-close.log', timeout: 5 }] }] });
  const startCompute = hookTree(path.join(TMP, 'a5start'), { SessionStart: [{ hooks: [{ type: 'command', command: 'mkdir -p .mindrian; printf "%s state mode=compute reason=changed\\n" now >> .mindrian/session-start-state.log', timeout: 5 }] }] });
  const noLog = hookTree(path.join(TMP, 'a5none'), { Stop: [{ hooks: [{ type: 'command', command: 'true', timeout: 5 }] }] });
  const a5 = (tree, id, out) => { const r = run(['run', '--tree', tree].concat(base, ['--runs', '2', '--targets', id, '--out', out]), { env: { MOS_T_MARK: 'zz-token-9137' } }); return { r, t: tgt(readJson(out), id) }; };
  const a5sync = a5(stopSync, 'event:Stop:changed', path.join(TMP, 'a5sync.json'));
  check('A5 a Stop hook that logs mode=sync proves the changed path (changed_taken_runs = n)', a5sync.r.status === 0 && !!a5sync.t && a5sync.t.n === 2 && a5sync.t.changed_taken_runs === 2, a5sync.r.status + ' ' + JSON.stringify(a5sync.t && [a5sync.t.n, a5sync.t.changed_taken_runs]) + ' ' + String(a5sync.r.stderr).slice(0, 200));
  const a5skip = a5(stopSkip, 'event:Stop:unchanged', path.join(TMP, 'a5skip.json'));
  check('A5 a Stop hook that logs mode=skip gives changed_taken_runs 0', a5skip.r.status === 0 && !!a5skip.t && a5skip.t.n === 2 && a5skip.t.changed_taken_runs === 0 && a5skip.t.changed_unknown_runs === 0, a5skip.r.status + ' ' + JSON.stringify(a5skip.t && [a5skip.t.n, a5skip.t.changed_taken_runs, a5skip.t.changed_unknown_runs]));
  const a5start = a5(startCompute, 'event:SessionStart:changed', path.join(TMP, 'a5start.json'));
  check('A5 a SessionStart hook that logs state mode=compute proves the changed path', a5start.r.status === 0 && !!a5start.t && a5start.t.changed_taken_runs === 2, a5start.r.status + ' ' + JSON.stringify(a5start.t && a5start.t.changed_taken_runs));
  const a5none = a5(noLog, 'event:Stop:changed', path.join(TMP, 'a5none.json'));
  check('A5 a hook that writes no state line gives unknown runs (null), not false', a5none.r.status === 0 && !!a5none.t && a5none.t.changed_taken_runs === 0 && a5none.t.changed_unknown_runs === 2, a5none.r.status + ' ' + JSON.stringify(a5none.t && [a5none.t.changed_taken_runs, a5none.t.changed_unknown_runs]));
  const a5text = fs.readFileSync(path.join(TMP, 'a5sync.json'), 'utf8');
  check('A5 the result holds no state-log text (no run-time token, no timestamped line)', !/zz-token-9137/.test(a5text) && !/[0-9]{10} on-stop-state/.test(a5text));

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

// ---------------------------------------------------------------------------
// Plan 384-03 Task 1: checks QR1 to QR6 (quiet-room, room picker, resolveSource, merge). Synthetic folders only.
// ---------------------------------------------------------------------------
async function partQ() {
  const kids = [];
  const startKid = (code, cwd) => { const k = spawn(process.execPath, ['-e', code], { cwd: cwd || TMP, stdio: 'ignore' }); kids.push(k); return k; };
  const nap = (ms) => new Promise((r) => setTimeout(r, ms));
  const mk = (name, nfiles) => {
    const d = path.join(TMP, name);
    fs.mkdirSync(d, { recursive: true });
    for (let i = 0; i < (nfiles === undefined ? 2 : nfiles); i += 1) fs.writeFileSync(path.join(d, 'f' + i + '.md'), 'x\n');
    return d;
  };
  const writeReg = (name, rooms) => {
    const f = path.join(TMP, name);
    const map = {};
    Object.keys(rooms).forEach((k) => { map[k] = { path: rooms[k], status: 'active' }; });
    fs.writeFileSync(f, JSON.stringify({ version: 1, rooms: map }));
    return f;
  };
  const exported = ['quietRoom', 'pickRoom', 'resolveSource', 'mergeResults'];
  check('QR0 the library exports quietRoom, pickRoom, resolveSource and mergeResults', exported.every((n) => typeof H[n] === 'function'), exported.filter((n) => typeof H[n] !== 'function').join(','));
  if (!exported.every((n) => typeof H[n] === 'function')) return;
  try {
    // QR1: holders and changed paths
    const holdDir = mk('qr-hold', 2);
    startKid('setTimeout(() => {}, 30000)', holdDir);
    await nap(500);
    const q1a = await H.quietRoom(holdDir, { idleMs: 200 });
    check('QR1 a child with the folder as cwd gives holders of 1 or more and quiet false', q1a.quiet === false && q1a.holders >= 1, JSON.stringify(q1a));
    const quietDir = mk('qr-quiet', 3);
    const q1b = await H.quietRoom(quietDir, { idleMs: 300 });
    check('QR1 an untouched folder is quiet with holders 0 and changed_paths 0', q1b.quiet === true && q1b.holders === 0 && q1b.changed_paths === 0, JSON.stringify(q1b));
    const touchDir = mk('qr-touch', 2);
    const pTouch = H.quietRoom(touchDir, { idleMs: 1500 });
    startKid('setTimeout(() => require("fs").writeFileSync(process.argv[1], "late"), 300)'.replace('process.argv[1]', JSON.stringify(path.join(touchDir, 'new.md'))));
    const q1c = await pTouch;
    check('QR1 a file made inside the window gives changed_paths of 1 or more and quiet false', q1c.quiet === false && q1c.changed_paths >= 1, JSON.stringify(q1c));

    // QR2: the CLI prints counts only
    const c2a = run(['quiet-room', '--source', quietDir, '--idle-ms', '300']);
    check('QR2 quiet-room on a quiet folder prints holders=0 changed_paths=0 and exits 0', c2a.status === 0 && String(c2a.stdout).trim() === 'holders=0 changed_paths=0', c2a.status + ' ' + c2a.stdout);
    const c2b = run(['quiet-room', '--source', holdDir, '--idle-ms', '200']);
    check('QR2 quiet-room on a folder with a holder exits 75 and prints holders of 1 or more', c2b.status === 75 && /^holders=[1-9][0-9]* changed_paths=0$/.test(String(c2b.stdout).trim()), c2b.status + ' ' + c2b.stdout);
    check('QR2 quiet-room prints no path (stdout and stderr)', ![c2a, c2b].some((r) => String(r.stdout + r.stderr).indexOf('qr-quiet') !== -1 || String(r.stdout + r.stderr).indexOf('qr-hold') !== -1));
    check('QR2 quiet-room without --source or with a missing folder exits 2', run(['quiet-room']).status === 2 && run(['quiet-room', '--source', path.join(TMP, 'qr-nope')]).status === 2);

    // QR3 and QR4: the picker
    const rHold = mk('pk-room-holder', 2);
    startKid('setTimeout(() => {}, 30000)', rHold);
    const rChange = mk('pk-room-change', 2);
    startKid('setInterval(() => require("fs").writeFileSync(' + JSON.stringify(path.join(rChange, 'f0.md')) + ', String(Date.now())), 100)');
    const rQuiet = mk('pk-room-quiet', 3);
    await nap(500);
    const reg1 = writeReg('reg1.json', { 'a-holder': rHold, 'b-change': rChange, 'c-quiet': rQuiet, 'd-mount': '/mnt/c/nope-384-synthetic', 'e-gone': path.join(TMP, 'pk-nope') });
    const savePick = path.join(TMP, 'picked.txt');
    const p1 = run(['pick-room', '--class', 'local', '--idle-ms', '1200', '--save', savePick], { env: { MOS_PERF_REGISTRY: reg1 } });
    check('QR4 pick-room picks the quiet room and prints one line of class, file count and file system type', p1.status === 0 && /^picked class=local file_count=3 fs_type=\S+$/.test(String(p1.stdout).trim()), p1.status + ' ' + p1.stdout + ' ' + String(p1.stderr).slice(0, 200));
    check('QR4 --save writes the chosen path with mode 600', fs.existsSync(savePick) && fs.readFileSync(savePick, 'utf8').trim() === rQuiet && (fs.statSync(savePick).mode & 0o777) === 0o600, fs.existsSync(savePick) ? (fs.statSync(savePick).mode & 0o777).toString(8) : 'no file');
    const outAll = String(p1.stdout) + String(p1.stderr);
    check('QR4 stdout and stderr hold none of the room paths or folder names', ['pk-room-holder', 'pk-room-change', 'pk-room-quiet', TMP].every((s) => outAll.indexOf(s) === -1), outAll.slice(0, 200));
    const reg2 = writeReg('reg2.json', { 'a-holder': rHold });
    const p2 = run(['pick-room', '--class', 'local', '--idle-ms', '300'], { env: { MOS_PERF_REGISTRY: reg2 } });
    check('QR4 no quiet room prints the picked none line and exits 75', p2.status === 75 && String(p2.stdout).trim() === 'picked none class=local candidates=1 quiet=0', p2.status + ' ' + p2.stdout);
    const p3 = run(['pick-room', '--class', 'mount', '--idle-ms', '300'], { env: { MOS_PERF_REGISTRY: reg2 } });
    check('QR4 a class with no candidate prints candidates=0 and exits 75', p3.status === 75 && String(p3.stdout).trim() === 'picked none class=mount candidates=0 quiet=0', p3.status + ' ' + p3.stdout);
    check('QR4 a bad --class exits 2 and an unreadable registry exits 2', run(['pick-room', '--class', 'cloud'], { env: { MOS_PERF_REGISTRY: reg2 } }).status === 2 && run(['pick-room', '--class', 'local'], { env: { MOS_PERF_REGISTRY: path.join(TMP, 'no-registry.json') } }).status === 2);
    check('QR4 --save inside the repository is refused (exit 2)', run(['pick-room', '--class', 'local', '--idle-ms', '300', '--save', path.join(REPO, 'qr-should-not-exist.txt')], { env: { MOS_PERF_REGISTRY: reg1 } }).status === 2 && !fs.existsSync(path.join(REPO, 'qr-should-not-exist.txt')));
    // QR3: the median room, the file cap, the candidate cap, the mount class by path prefix
    const m1 = mk('pk-m1', 1);
    const m3 = mk('pk-m3', 3);
    const m5 = mk('pk-m5', 5);
    const reg3 = writeReg('reg3.json', { 'k1': m1, 'k2': m3, 'k3': m5 });
    const pm = await H.pickRoom({ registryFile: reg3, cls: 'local', idleMs: 200 });
    check('QR3 pickRoom returns the quiet room with the median file count (3 of 1, 3, 5)', pm && pm.path === m3 && pm.file_count === 3 && pm.quiet === 3 && pm.candidates === 3, JSON.stringify(pm));
    const pf = await H.pickRoom({ registryFile: reg3, cls: 'local', idleMs: 200, maxFiles: 4 });
    check('QR3 a room above the file cap is skipped (quiet 2, the 5-file room is not picked)', pf && pf.quiet === 2 && pf.path !== m5, JSON.stringify(pf));
    const pc = await H.pickRoom({ registryFile: reg3, cls: 'local', idleMs: 200, maxCandidates: 2 });
    check('QR3 maxCandidates limits the candidates per class (2)', pc && pc.candidates === 2, JSON.stringify(pc));
    const pmount = await H.pickRoom({ registryFile: reg1, cls: 'mount', idleMs: 200 });
    check('QR3 a /mnt/<letter>/ path is class mount (one candidate, none quiet because it does not exist)', pmount && pmount.path === null && pmount.candidates === 0, JSON.stringify(pmount));
    const t0 = Date.now();
    const bigReg = {};
    for (let i = 0; i < 12; i += 1) bigReg['r' + String(i).padStart(2, '0')] = mk('pk-big' + i, 2);
    await H.pickRoom({ registryFile: writeReg('reg4.json', bigReg), cls: 'local', idleMs: 1000 });
    check('QR3 twelve candidates share one idle window (under 6 s for a 1 s window)', Date.now() - t0 < 6000, String(Date.now() - t0));

    // QR5: resolveSource and the run flags
    const srcA = mk('rs-a', 2);
    const srcB = mk('rs-b', 4);
    const fileB = path.join(TMP, 'rs-b.txt');
    fs.writeFileSync(fileB, srcB + '\n');
    check('QR5 the variable MOS_REAL_ROOM_384 wins over --source', (await H.resolveSource({ source: srcA, env: { MOS_REAL_ROOM_384: srcB } })) === srcB);
    check('QR5 --source wins over --source-file', (await H.resolveSource({ source: srcA, sourceFile: fileB, env: {} })) === srcA);
    check('QR5 --source-file reads the path from the file', (await H.resolveSource({ sourceFile: fileB, env: {} })) === srcB);
    const regPick = writeReg('reg5.json', { only: srcB });
    check('QR5 --pick chooses a quiet registry room of the class', (await H.resolveSource({ pick: 'local', registryFile: regPick, idleMs: 200, env: {} })) === srcB);
    check('QR5 nothing named gives null', (await H.resolveSource({ env: {} })) === null);
    const rsScratch = path.join(TMP, 'rs-scratch');
    fs.mkdirSync(rsScratch, { recursive: true });
    const runCopy = (extra, env) => run(['run', '--tree', REPO, '--room', 'copy', '--allow-short', '--runs', '1', '--targets', 'floor:node', '--scratch', rsScratch, '--out', path.join(TMP, 'rs-out.json')].concat(extra), { env: env || {}, unset: ['MOS_REAL_ROOM_384'] });
    const rf = runCopy(['--source-file', fileB]);
    check('QR5 run --room copy --source-file uses the named room (4 files) and prints no path', rf.status === 0 && (readJson(path.join(TMP, 'rs-out.json')) || { room: {} }).room.file_count === 4 && String(rf.stdout + rf.stderr).indexOf('rs-b') === -1, rf.status + ' ' + String(rf.stderr).slice(0, 200));
    const rp = runCopy(['--pick', 'local', '--idle-ms', '300'], { MOS_PERF_REGISTRY: regPick });
    check('QR5 run --room copy --pick uses the picked room and prints no path', rp.status === 0 && (readJson(path.join(TMP, 'rs-out.json')) || { room: {} }).room.file_count === 4 && String(rp.stdout + rp.stderr).indexOf('rs-b') === -1, rp.status + ' ' + String(rp.stderr).slice(0, 200));
    const rn = runCopy(['--pick', 'local', '--idle-ms', '300'], { MOS_PERF_REGISTRY: reg2 });
    check('QR5 run --pick with no quiet room exits 75', rn.status === 75, rn.status + ' ' + String(rn.stderr).slice(0, 200));
    check('QR5 run --room copy with no source form exits 2', runCopy([]).status === 2);
    check('QR5 run --pick with a bad class exits 2', runCopy(['--pick', 'cloud']).status === 2);

    // QR6: merge
    const md = path.join(TMP, 'qr6');
    fs.mkdirSync(md, { recursive: true });
    const t = (id) => { const r = validResult(); r.targets[0].id = id; return r; };
    fs.writeFileSync(path.join(md, 't1.json'), JSON.stringify(t('x')));
    fs.writeFileSync(path.join(md, 't2.json'), JSON.stringify(t('y')));
    fs.writeFileSync(path.join(md, 't3.json'), JSON.stringify(t('x')));
    const outDir = path.join(TMP, 'qr6out');
    fs.mkdirSync(outDir, { recursive: true });
    const mg = run(['merge', path.join(md, 't1.json'), path.join(md, 't2.json'), '--out', path.join(outDir, 'merged.json')]);
    const merged = readJson(path.join(outDir, 'merged.json'));
    check('QR6 two timing files merge into one file with both targets and the machine of the first', mg.status === 0 && !!merged && merged.schema === H.SCHEMA && merged.targets.map((x) => x.id).join(',') === 'x,y' && merged.machine.tree_label === 'a', mg.status + ' ' + String(mg.stderr).slice(0, 200));
    check('QR6 verify-results accepts the merged timing file', run(['verify-results', outDir]).status === 0);
    check('QR6 a duplicate target id exits 2', run(['merge', path.join(md, 't1.json'), path.join(md, 't3.json'), '--out', path.join(outDir, 'dup.json')]).status === 2 && !fs.existsSync(path.join(outDir, 'dup.json')));
    fs.writeFileSync(path.join(md, 'c1.json'), JSON.stringify(validCounts(0)));
    fs.writeFileSync(path.join(md, 'c2.json'), JSON.stringify(validCounts(0)));
    check('QR6 a mixed pair (timing and counts) exits 2', run(['merge', path.join(md, 't1.json'), path.join(md, 'c1.json'), '--out', path.join(outDir, 'mix.json')]).status === 2 && !fs.existsSync(path.join(outDir, 'mix.json')));
    const rk = t('z');
    rk.room.kind = 'real-copy';
    fs.writeFileSync(path.join(md, 't4.json'), JSON.stringify(rk));
    check('QR6 two timing files of different room kinds exit 2', run(['merge', path.join(md, 't1.json'), path.join(md, 't4.json'), '--out', path.join(outDir, 'kind.json')]).status === 2);
    const outDir2 = path.join(TMP, 'qr6out2');
    fs.mkdirSync(outDir2, { recursive: true });
    const mc = run(['merge', path.join(md, 'c1.json'), path.join(md, 'c2.json'), '--out', path.join(outDir2, 'mergedc.json')]);
    const mcj = readJson(path.join(outDir2, 'mergedc.json'));
    check('QR6 two counts files merge into one section per input file (c1 and c2)', mc.status === 0 && !!mcj && mcj.schema === H.COUNTS_SCHEMA && Object.keys(mcj.sections || {}).join(',') === 'c1,c2', mc.status + ' ' + (mcj ? Object.keys(mcj.sections || {}).join(',') : 'no file'));
    check('QR6 verify-results accepts the merged counts file', run(['verify-results', outDir2]).status === 0);
    const hm = t('w');
    hm.targets[0].id = '/home/someone/room';
    fs.writeFileSync(path.join(md, 't5.json'), JSON.stringify(hm));
    check('QR6 the Part 8 scan stops a merge that holds a home path (exit 1, no output file)', run(['merge', path.join(md, 't1.json'), path.join(md, 't5.json'), '--out', path.join(outDir, 'p8.json')]).status === 1 && !fs.existsSync(path.join(outDir, 'p8.json')));
    check('QR6 merge with one input or no --out exits 2', run(['merge', path.join(md, 't1.json'), '--out', path.join(outDir, 'one.json')]).status === 2 && run(['merge', path.join(md, 't1.json'), path.join(md, 't2.json')]).status === 2);

    // WU: an :unchanged target warms up until a run takes the skip path (found in the fixture-room smoke sets of plan 384-03)
    const wuCmd = 'mkdir -p .mindrian; n=$(cat "$MOS_T_CNT" 2>/dev/null || echo 0); n=$((n+1)); echo $n > "$MOS_T_CNT"; if [ $n -le 3 ]; then m=detached; else m=skip; fi; printf "%s on-stop-state mode=%s reason=x\\n" now $m >> .mindrian/session-close.log';
    const wuTree = hookTree(path.join(TMP, 'wutree'), { Stop: [{ hooks: [{ type: 'command', command: wuCmd, timeout: 5 }] }] });
    const wuOut = path.join(TMP, 'wu.json');
    const wuRun = run(['run', '--tree', wuTree, '--room', 'synthetic', '--allow-short', '--runs', '2', '--targets', 'event:Stop:unchanged', '--out', wuOut], { env: { MOS_T_CNT: path.join(TMP, 'wu.count') } });
    const wuT = tgt(readJson(wuOut), 'event:Stop:unchanged');
    check('WU the warm-up repeats until a run takes the skip path (4 warm-ups, then 2 skip runs)', wuRun.status === 0 && !!wuT && wuT.warmup_runs === 4 && wuT.n === 2 && wuT.changed_taken_runs === 0, wuRun.status + ' ' + JSON.stringify(wuT && [wuT.warmup_runs, wuT.n, wuT.changed_taken_runs]) + ' ' + String(wuRun.stderr).slice(0, 200));
    const wuNever = hookTree(path.join(TMP, 'wunever'), { Stop: [{ hooks: [{ type: 'command', command: 'mkdir -p .mindrian; printf "%s on-stop-state mode=sync reason=x\\n" now >> .mindrian/session-close.log', timeout: 5 }] }] });
    const wuOut2 = path.join(TMP, 'wu2.json');
    run(['run', '--tree', wuNever, '--room', 'synthetic', '--allow-short', '--runs', '1', '--targets', 'event:Stop:unchanged', '--out', wuOut2]);
    const wuT2 = tgt(readJson(wuOut2), 'event:Stop:unchanged');
    check('WU a target that never reaches the skip path stops after 6 warm-ups and still shows the changed path in its runs', !!wuT2 && wuT2.warmup_runs === 6 && wuT2.changed_taken_runs === 1, JSON.stringify(wuT2 && [wuT2.warmup_runs, wuT2.changed_taken_runs]));
  } finally {
    kids.forEach((k) => { try { k.kill('SIGKILL'); } catch (_e) { /* gone */ } });
  }
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
