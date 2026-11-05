'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 382 plan 01: self-test of tools/perf/perf-harness.cjs.
 * Checks H1 to H11: the statistics, the host gates, the interleave order, the run minimum, the
 * event wall with an async hook, the result schema, the Part 8 scan, the copy guard, the compare
 * line and verify-results. Node built-ins only. Exit 1 on any failed check.
 * Measurements are never taken here: the run checks use a synthetic room and a two-hook tree,
 * with --allow-short (a test-only flag that skips the run minimum and the host gates).
 * Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const HARNESS = path.join(REPO, 'tools', 'perf', 'perf-harness.cjs');
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

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-382-selftest-'));
function cleanup() { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }

function run(args, opts) {
  return spawnSync(process.execPath, [HARNESS].concat(args), Object.assign({ encoding: 'utf8', timeout: 120000 }, opts || {}));
}

function validResult(overrides) {
  const machine = {
    cores: 12, node: 'v22.0.0', platform: 'linux', arch: 'x64', kernel: 'k', cpu_cap: 4, fs_type: 'ext2/ext3',
    head_sha: 'abc', tree_label: 'a', base_sha: H.BASE_SHA_382, started_at: '2026-01-01T00:00:00.000Z',
    ended_at: '2026-01-01T00:01:00.000Z', load1_start: 0.5, load1_end: 0.6,
  };
  const stat = (m) => ({ median: m, p95: m + 1, min: m - 1, max: m + 2 });
  return Object.assign({
    schema: H.SCHEMA, machine, room: { kind: 'fixture-room', file_count: 3, byte_total: 10, fs_type: 'ext2/ext3' },
    set: 's1', tree_label: 'a', cpus: 4, runs: 7, load1_start: 0.5, load1_end: 0.6,
    started_at: machine.started_at, ended_at: machine.ended_at,
    targets: [{ id: 'x', n: 7, blocking: true, wall_ms: stat(100), cpu_ms: stat(10), rss_mb: stat(40), exits: [0], timed_out: 0, not_measured: [], async_hooks: [] }],
  }, overrides || {});
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
  const treeDir = path.join(TMP, 'tree');
  fs.mkdirSync(path.join(treeDir, 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(treeDir, 'hooks', 'hooks.json'), JSON.stringify({
    hooks: { SessionEnd: [{ hooks: [
      { type: 'command', command: 'sleep 0.2', timeout: 5 },
      { type: 'command', command: 'sleep 0.6', timeout: 5, async: true },
    ] }] },
  }));

  // H5
  const six = run(['run', '--tree', treeDir, '--room', 'synthetic', '--runs', '6', '--targets', 'event:SessionEnd', '--out', path.join(TMP, 'six.json')]);
  check('H5 --runs 6 exits 2', six.status === 2, 'status ' + six.status + ' ' + String(six.stderr).slice(0, 200));

  // H6 and H7
  const outFile = path.join(TMP, 'short.json');
  const short = run(['run', '--tree', treeDir, '--room', 'synthetic', '--runs', '3', '--allow-short', '--targets', 'event:SessionEnd', '--set', 'selftest', '--out', outFile]);
  check('H6 run with --allow-short exits 0', short.status === 0, 'status ' + short.status + ' ' + String(short.stderr).slice(0, 300));
  let res = null;
  try { res = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch (_e) { res = null; }
  check('H7 result file parses and has the schema', !!res && res.schema === 'mos.perf-382/1');
  if (res) {
    const t = (res.targets || []).find((x) => x.id === 'event:SessionEnd');
    check('H6 event wall median is below 450 ms', !!t && t.wall_ms.median < 450 && t.wall_ms.median >= 150, t ? String(t.wall_ms.median) : 'no target');
    check('H6 the async hook is a separate field', !!t && Array.isArray(t.async_hooks) && t.async_hooks.length === 1 && t.async_hooks[0].wall_ms >= 500, t ? JSON.stringify(t.async_hooks) : 'no target');
    const mfields = ['cores', 'node', 'platform', 'arch', 'kernel', 'cpu_cap', 'fs_type', 'head_sha', 'tree_label', 'base_sha', 'started_at', 'ended_at', 'load1_start', 'load1_end'];
    const missing = mfields.filter((k) => !res.machine || res.machine[k] === undefined || res.machine[k] === null);
    check('H7 every machine field is present', missing.length === 0, missing.join(','));
    check('H7 room kind is a label and the file holds no scratch path', !/mos-382-selftest/.test(JSON.stringify(res)) && res.room && res.room.kind === 'synthetic-room');
    check('H7 base sha is the planned one', res.machine.base_sha === '788d63b0e1b3a262ed5c9221dfd8cc7d49ecafa1');
    const text = fs.readFileSync(outFile, 'utf8');
    check('H7 the result passes the Part 8 scan', H.part8Violations(text, { home: os.homedir(), sourceRoom: null, scratch: TMP }).length === 0);
  }

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
  try { H.guardedCopy(treeDir, path.join(os.homedir(), '.mindrian', 'x382')); } catch (_e) { threw2 = true; }
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

  // H11
  const good = path.join(TMP, 'good');
  fs.mkdirSync(good);
  fs.writeFileSync(path.join(good, 'set1.json'), JSON.stringify(validResult()));
  fs.writeFileSync(path.join(good, 'spread.json'), JSON.stringify({ rooms: {} }));
  check('H11 valid set exits 0', run(['verify-results', good]).status === 0, run(['verify-results', good]).stderr);
  function badDir(name, mutate) {
    const d = path.join(TMP, name);
    fs.mkdirSync(d);
    const r = validResult();
    mutate(r);
    fs.writeFileSync(path.join(d, 'set1.json'), JSON.stringify(r));
    return d;
  }
  check('H11 n below 7 exits 1', run(['verify-results', badDir('bad-n', (r) => { r.targets[0].n = 6; })]).status === 1);
  check('H11 missing machine field exits 1', run(['verify-results', badDir('bad-m', (r) => { delete r.machine.kernel; })]).status === 1);
  check('H11 load1_start of 2 or more exits 1', run(['verify-results', badDir('bad-l', (r) => { r.machine.load1_start = 2.0; r.load1_start = 2.0; })]).status === 1);

  // the target list
  check('targets: at least 28 ids', H.TARGETS.length >= 28, String(H.TARGETS.length));
  const tl = run(['targets']);
  check('targets: the CLI prints one id per line', tl.status === 0 && tl.stdout.split('\n').filter(Boolean).length === H.TARGETS.length);
} catch (e) {
  failed += 1;
  process.stdout.write('  FAIL unexpected error :: ' + String(e && e.stack || e) + '\n');
} finally {
  cleanup();
}

if (failed > 0) {
  process.stdout.write('perf-harness: ' + failed + ' FAILED\n');
  process.exit(1);
}
process.stdout.write('perf-harness: ALL PASS\n');
