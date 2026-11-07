#!/usr/bin/env node
'use strict';
// Plan 384-16 (finding S4): SubagentStop starts every modified file at once.
// Groups: parity (P1..P5, must pass before and after the fix), mechanism (M1, M2).
// A copy of the real scripts/on-agent-complete runs in a temporary scripts folder
// next to stubs. Fixture rooms only (Canon Part 8). Node built-ins only, no network.
//
// RED reading on the unchanged script (plan 384-16): M1 max in flight 20; M2 max in flight 8
// for every value (8 files). The mechanism group is expected to fail until the fix lands.
//
// Usage: node tests/test-384-s4-agent-complete.cjs [parity|mechanism]
// SPEED384_WRITE_GOLDEN=1 writes tests/fixtures/384-s4-envelope-golden.json.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const REAL_SCRIPT = path.join(REPO, 'scripts', 'on-agent-complete');
const GOLDEN = path.join(__dirname, 'fixtures', '384-s4-envelope-golden.json');
const group = process.argv[2] || 'all';

let failed = 0;
function ok(name, cond, detail) {
  if (cond) {
    console.log('ok   ' + name);
  } else {
    failed++;
    console.log('FAIL ' + name + (detail ? ' : ' + detail : ''));
  }
}

// ---- host checks ----------------------------------------------------------
function gnuUserland() {
  const d = spawnSync('date', ['-d', '30 seconds ago', '+%s']);
  if (d.status !== 0) return false;
  const f = spawnSync('find', [os.tmpdir(), '-maxdepth', '0', '-printf', '%T@ %p\n']);
  return f.status === 0 && /^\d+(\.\d+)? /.test(String(f.stdout));
}
if (!gnuUserland()) {
  console.log('SKIP: GNU userland');
  process.exit(0);
}
if (spawnSync('jq', ['--version']).status !== 0) {
  console.log('FAIL jq is not on PATH (on-agent-complete needs jq)');
  console.log('s4-agent-complete: 1 FAILED');
  process.exit(1);
}

// ---- fixture builder ------------------------------------------------------
const tmpRoots = [];
function pad(i) { return String(i + 1).padStart(2, '0'); }

function relName(i) {
  const base = i === 4 ? 'f' + pad(i) + ' space.md' : 'f' + pad(i) + '.md';
  return i % 7 === 3 ? path.join('sec', 'research', base) : path.join('sec', base);
}

function build(nEligible, withNoise) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-384-s4-'));
  tmpRoots.push(tmp);
  const scripts = path.join(tmp, 'scripts');
  const logs = path.join(tmp, 'logs');
  const room = path.join(tmp, 'room');
  fs.mkdirSync(scripts); fs.mkdirSync(logs); fs.mkdirSync(path.join(room, 'sec', 'research'), { recursive: true });
  fs.copyFileSync(REAL_SCRIPT, path.join(scripts, 'on-agent-complete'));
  fs.chmodSync(path.join(scripts, 'on-agent-complete'), 0o755);
  const put = (name, body) => {
    fs.writeFileSync(path.join(scripts, name), body, { mode: 0o755 });
  };
  put('resolve-room', '#!/usr/bin/env bash\nprintf \'%s\\n\' ' + JSON.stringify(room) + '\n');
  put('post-write',
    '#!/usr/bin/env bash\n' +
    'L=' + JSON.stringify(path.join(logs, 'post-write.log')) + '\n' +
    'printf \'START\\t%s\\t%s\\n\' "$(date +%s%N)" "$1" >> "$L"\n' +
    'sleep "${MOS_TEST_PW_SLEEP:-0.4}"\n' +
    'printf \'END\\t%s\\t%s\\n\' "$(date +%s%N)" "$1" >> "$L"\n');
  put('fire-sensor-event.cjs',
    '#!/usr/bin/env node\n' +
    'require("fs").appendFileSync(' + JSON.stringify(path.join(logs, 'fire.log')) +
    ', JSON.stringify(process.argv.slice(2)) + "\\n");\n');
  put('compute-state',
    '#!/usr/bin/env bash\n' +
    'printf \'%s\\n\' "$(date +%s%N)" >> ' + JSON.stringify(path.join(logs, 'compute.log')) + '\n' +
    'echo "STATE fixture"\n');
  put('state-write.cjs',
    '#!/usr/bin/env node\n' +
    'const s = require("fs").readFileSync(0, "utf8");\n' +
    'require("fs").appendFileSync(' + JSON.stringify(path.join(logs, 'state.log')) +
    ', Date.now() + "\\t" + JSON.stringify(s) + "\\n");\n');
  put('track-analytics',
    '#!/usr/bin/env bash\n' +
    'printf \'%s\\n\' "$*" >> ' + JSON.stringify(path.join(logs, 'analytics.log')) + '\n');

  const now = Date.now() / 1000;
  const files = [];
  for (let i = 0; i < nEligible; i++) {
    const rel = relName(i);
    const abs = path.join(room, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, '# fixture ' + i + '\n');
    const t = now - 2 - i * 0.5;
    fs.utimesSync(abs, t, t);
    files.push({ rel, abs });
  }
  if (withNoise) {
    const t = now - 1;
    const noise = [
      path.join(room, 'sec', '.hidden.md'),
      path.join(room, 'ROOM.md'),
      path.join(room, 'STATE.md'),
      path.join(room, '.mindrian', 'x.md'),
      path.join(tmp, 'outside.md'),
    ];
    for (const n of noise) {
      fs.mkdirSync(path.dirname(n), { recursive: true });
      fs.writeFileSync(n, '# noise\n');
      fs.utimesSync(n, t, t);
    }
  }
  return { tmp, scripts, logs, room, files };
}

function readLines(p) {
  try { return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean); } catch (_) { return []; }
}

function runScript(fx, env) {
  return new Promise((resolve) => {
    const e = Object.assign({}, process.env);
    delete e.MOS_AGENT_COMPLETE_MAX_JOBS;
    Object.assign(e, env || {});
    const startedAt = Date.now();
    const child = spawn('bash', [path.join(fx.scripts, 'on-agent-complete')], {
      cwd: fx.tmp, env: e, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let exitMs = null;
    child.stdout.on('data', (d) => { out += d; });
    child.on('exit', () => { exitMs = Date.now() - startedAt; });
    child.on('close', (code) => resolve({ code, out, exitMs, startedAt }));
  });
}

async function settle(fx, expectEnd, expectFire, expectCompute) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const ends = readLines(path.join(fx.logs, 'post-write.log')).filter((l) => l.startsWith('END')).length;
    const fires = readLines(path.join(fx.logs, 'fire.log')).length;
    const comp = readLines(path.join(fx.logs, 'state.log')).length;
    const ana = readLines(path.join(fx.logs, 'analytics.log')).length;
    if (ends >= expectEnd && fires >= expectFire && comp >= expectCompute && (expectCompute === 0 || ana >= 1)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  await new Promise((r) => setTimeout(r, 300)); // let a surplus call show up
}

function maxInFlight(fx) {
  const ev = [];
  for (const l of readLines(path.join(fx.logs, 'post-write.log'))) {
    const [kind, ns] = l.split('\t');
    ev.push({ t: Number(BigInt(ns) / 1000n), kind });
  }
  ev.sort((a, b) => a.t - b.t || (a.kind === 'END' ? -1 : 1));
  let cur = 0; let max = 0;
  for (const e of ev) {
    cur += e.kind === 'START' ? 1 : -1;
    if (cur > max) max = cur;
  }
  return max;
}

function expectedSets(fx, n) {
  const take = fx.files.slice(0, Math.min(n, 20));
  return take;
}

// ---- parity ---------------------------------------------------------------
async function parity() {
  // P1 envelope
  const golden = {};
  for (const n of [0, 3, 20]) {
    const fx = build(n, false);
    const r = await runScript(fx);
    golden[String(n)] = r.out;
    ok('P1 exit 0 for ' + n + ' files', r.code === 0, 'code ' + r.code);
    if (n === 0) {
      ok('P1 stdout empty for 0 files', r.out === '', JSON.stringify(r.out));
    } else {
      let parsed = null;
      try { parsed = JSON.parse(r.out); } catch (_) { /* below */ }
      ok('P1 one compact JSON line for ' + n + ' files',
        parsed && r.out.endsWith('\n') && r.out.trim().split('\n').length === 1);
      ok('P1 envelope fields for ' + n + ' files',
        parsed && parsed.hookSpecificOutput.hookEventName === 'SubagentStop' &&
        parsed.hookSpecificOutput.additionalContext === 'agent cascade: ' + n + ' files processed');
    }
    await settle(fx, n, n + Math.floor(Math.min(n, 20) ? countResearch(Math.min(n, 20)) : 0), n ? 1 : 0);
  }
  if (process.env.SPEED384_WRITE_GOLDEN === '1') {
    fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
    fs.writeFileSync(GOLDEN, JSON.stringify(golden, null, 2) + '\n');
    console.log('note golden written');
  }
  let gold = null;
  try { gold = JSON.parse(fs.readFileSync(GOLDEN, 'utf8')); } catch (_) { /* below */ }
  ok('P1 golden file exists', !!gold);
  if (gold) {
    for (const n of ['0', '3', '20']) {
      ok('P1 stdout bytes equal golden for ' + n + ' files', golden[n] === gold[n],
        JSON.stringify(golden[n]) + ' vs ' + JSON.stringify(gold[n]));
    }
  }

  // P2 call sets: noise plus 5 eligible, then 23 eligible
  for (const n of [5, 23]) {
    // Noise only in the small case: the hidden file is found by find and uses one of the
    // 20 slots of head -20 before the guard skips it (old and new code alike).
    const fx = build(n, n === 5);
    const take = expectedSets(fx, n);
    const research = take.filter((f) => /research/.test(f.rel));
    const r = await runScript(fx);
    ok('P2 exit 0 (' + n + ' eligible)', r.code === 0);
    await settle(fx, take.length, take.length + research.length, 1);
    const pw = readLines(path.join(fx.logs, 'post-write.log')).filter((l) => l.startsWith('START')).map((l) => l.split('\t')[2]);
    const want = take.map((f) => f.abs).sort();
    ok('P2 post-write set equals newest ' + take.length + ' eligible files (' + n + ' eligible)',
      JSON.stringify(pw.slice().sort()) === JSON.stringify(want),
      'got ' + pw.length + ' want ' + want.length);
    const fires = readLines(path.join(fx.logs, 'fire.log')).map((l) => JSON.parse(l));
    const want06 = take.map((f) => JSON.stringify([fx.room, 'context_block', 'SENS-06', 'cross-relationship-scan', 'push_forward', f.rel])).sort();
    const got06 = fires.filter((a) => a[2] === 'SENS-06').map((a) => JSON.stringify(a)).sort();
    ok('P2 SENS-06 calls: one per file with exact arguments (' + n + ' eligible)',
      JSON.stringify(got06) === JSON.stringify(want06));
    const want04 = research.map((f) => JSON.stringify([fx.room, 'deep_research', 'SENS-04', 'research-agent-finding', 'push_forward', f.rel])).sort();
    const got04 = fires.filter((a) => a[2] === 'SENS-04').map((a) => JSON.stringify(a)).sort();
    ok('P2 SENS-04 calls: one per research file with exact arguments (' + n + ' eligible)',
      JSON.stringify(got04) === JSON.stringify(want04) && want04.length > 0);
    ok('P2 no other fire-sensor-event call (' + n + ' eligible)', fires.length === want06.length + want04.length);
    if (n === 5) {
      ok('P2 space in name passes as one argument',
        take.some((f) => / space/.test(f.rel)) && pw.some((p) => / space\.md$/.test(p)) &&
        got06.some((s) => / space\.md/.test(s)));
      ok('P2 hidden, ROOM.md, STATE.md, .mindrian and outside files are not processed',
        !pw.some((p) => /\.hidden|ROOM\.md|STATE\.md|\.mindrian|outside\.md/.test(p)));
      const m = JSON.parse(r.out);
      ok('P2 envelope counts only eligible files (5)', m.hookSpecificOutput.additionalContext === 'agent cascade: 5 files processed');
    } else {
      const oldest = fx.files.slice(20).map((f) => f.abs);
      ok('P2 the 3 oldest of 23 are not processed', oldest.length === 3 && oldest.every((o) => !pw.includes(o)));
    }
  }

  // P3 state step
  {
    const fx = build(3, false);
    const r = await runScript(fx);
    await settle(fx, 3, 3 + countResearch(3), 1);
    const comp = readLines(path.join(fx.logs, 'compute.log'));
    const st = readLines(path.join(fx.logs, 'state.log'));
    const ana = readLines(path.join(fx.logs, 'analytics.log'));
    ok('P3 compute-state called once', comp.length === 1, String(comp.length));
    ok('P3 state-write called once with the state text', st.length === 1 && /STATE fixture/.test(st[0]));
    ok('P3 track-analytics called once with agent-complete', ana.length === 1 && ana[0] === 'agent-complete');
    const t = comp.length ? Number(BigInt(comp[0]) / 1000000n) : 0;
    ok('P3 compute-state starts at least 0.9 s after the script start', t - r.startedAt >= 900, String(t - r.startedAt));
  }

  // P4 return time. The post-write stub sleeps 3 s here. The hook must exit before the
  // first cascade ends: it does not wait for the cascades. (An absolute bound of 800 ms
  // is not asserted: the foreground fork cost of the old code is 0.9 to 2.3 s for 20
  // files on this host and rises with load; the exit time is printed as a note.)
  {
    const fx = build(20, false);
    const r = await runScript(fx, { MOS_TEST_PW_SLEEP: '3' });
    const t0 = r.startedAt + r.exitMs;
    await settle(fx, 20, 20 + countResearch(20), 1);
    const ends = readLines(path.join(fx.logs, 'post-write.log')).filter((l) => l.startsWith('END'))
      .map((l) => Number(BigInt(l.split('\t')[1]) / 1000000n));
    const firstEnd = Math.min.apply(null, ends);
    console.log('note P4 exit after ' + r.exitMs + ' ms, first cascade end after ' + (firstEnd - r.startedAt) + ' ms');
    ok('P4 hook exits before the first cascade ends (20 files)', ends.length === 20 && t0 < firstEnd,
      'exit ' + r.exitMs + ' ms, first end ' + (firstEnd - r.startedAt) + ' ms');
  }

  // P5 bash 3.2 guard
  {
    const text = fs.readFileSync(REAL_SCRIPT, 'utf8').split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
    ok('P5 no bash 4 feature', !/wait -n|mapfile|readarray|declare -A/.test(text));
    ok('P5 bash -n passes', spawnSync('bash', ['-n', REAL_SCRIPT]).status === 0);
  }
}

function countResearch(n) {
  let c = 0;
  for (let i = 0; i < n; i++) if (i % 7 === 3) c++;
  return c;
}

// ---- mechanism ------------------------------------------------------------
async function mechanism() {
  // M1 default cap
  {
    const fx = build(20, false);
    await runScript(fx);
    await settle(fx, 20, 20 + countResearch(20), 1);
    const ends = readLines(path.join(fx.logs, 'post-write.log')).filter((l) => l.startsWith('END')).length;
    const m = maxInFlight(fx);
    ok('M1 all 20 files processed', ends === 20, String(ends));
    ok('M1 at most 4 post-write calls in flight with 20 files', m <= 4, 'max in flight ' + m);
  }
  // M2 override and bad values
  const cases = [
    { v: '2', min: 1, max: 2 },
    { v: '1', min: 1, max: 1 },
    { v: '0', min: 2, max: 4 },
    { v: '-3', min: 2, max: 4 },
    { v: 'abc', min: 2, max: 4 },
    { v: '', min: 2, max: 4 },
  ];
  for (const c of cases) {
    const fx = build(8, false);
    await runScript(fx, { MOS_AGENT_COMPLETE_MAX_JOBS: c.v });
    await settle(fx, 8, 8 + countResearch(8), 1);
    const ends = readLines(path.join(fx.logs, 'post-write.log')).filter((l) => l.startsWith('END')).length;
    const m = maxInFlight(fx);
    ok('M2 value ' + JSON.stringify(c.v) + ': max in flight ' + c.min + '..' + c.max + ' (8 files, all processed)',
      ends === 8 && m >= c.min && m <= c.max, 'ends ' + ends + ' max ' + m);
  }
}

(async () => {
  try {
    if (group === 'all' || group === 'parity') await parity();
    if (group === 'all' || group === 'mechanism') await mechanism();
  } finally {
    for (const t of tmpRoots) fs.rmSync(t, { recursive: true, force: true });
  }
  console.log(failed === 0 ? 's4-agent-complete: ALL PASS' : 's4-agent-complete: ' + failed + ' FAILED');
  process.exit(failed === 0 ? 0 : 1);
})();
