'use strict';
// Phase 400.4 plan 12 (QA-F11 part B base): run(input, opts) exports of the six UserPromptSubmit scripts.
//
//   node tests/test-400.4-hook-run-exports.cjs                  live mode: X1 to X4, X6, X7 (no golden)
//   node tests/test-400.4-hook-run-exports.cjs --golden         live mode plus X5 (CLI and run() equal the golden)
//   node tests/test-400.4-hook-run-exports.cjs --capture        write tests/fixtures/400.4/hook-golden.json from the CLIs
//   ... --only id,id                                             limit every leg to the named scripts
//
// X1  require() of each script has no side effect (no output, no exit, no listener, stdin untouched).
// X2  each module exports run as a function.
// X3  run() equals the CLI (masked) for every script and case, on fresh copies of the same fixture.
// X4  run() never calls process.exit, never reads fd 0, never writes to the process streams, adds no listener.
// X5  the CLI and run() equal the golden captured before the refactor.
// X6  jtbd-update run() honors argv; brain-derivation-drain --dry-run keeps its CLI path.
// X7  intent-classifier run() drains the MINTO room first (the drain runs before the first output).
//
// Every run uses a fresh copy of a fixture under the OS temp dir. HOME, MINDRIAN_ROOMS_HOME and the cwd point at the
// copy. Nothing touches the real home or ~/MindrianRooms.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const GOLDEN_PATH = path.join(ROOT, 'tests', 'fixtures', '400.4', 'hook-golden.json');
// Phase 400.5 plan 02: the case list, the fixtures and the masks live in one helper, shared with the dispatcher parity test.
const parity = require(path.join(ROOT, 'tests', 'helpers', 'userprompt-parity-400-4.cjs'));
const { CASES, MASKS, freshCopy, childEnv, maskResult } = parity;

const ARGS = process.argv.slice(2);
const CAPTURE = ARGS.includes('--capture');
const GOLDEN = ARGS.includes('--golden');
const onlyIdx = ARGS.indexOf('--only');
const ONLY = onlyIdx >= 0 && ARGS[onlyIdx + 1] ? new Set(ARGS[onlyIdx + 1].split(',')) : null;

const SCRIPTS = parity.SCRIPTS.filter((s) => !ONLY || ONLY.has(s.id));

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('PASS ' + name);
  else { failures++; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

// ---------- work area ----------

const WORK = fs.mkdtempSync(path.join(parity.TMP, 'mos400412-w-'));
process.on('exit', () => { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });

function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function brief(o) { return JSON.stringify(o).slice(0, 400); }

// ---------- the child driver (written to the work dir, never into the repo) ----------

const DRIVER = `'use strict';
// mode "run": require the script, call run(input, {argv}) with guards on, print one JSON line on fd 1.
// mode "probe": require the script only, then report side effects.
const fs = require('node:fs');
const mode = process.argv[2];
const scriptPath = process.argv[3];
const input = process.argv[4] || '';
const argv = JSON.parse(process.argv[5] || '[]');
const origExit = process.exit;
const origRead = fs.readFileSync;
const trips = [];
const writes = [];
const sniffed = [];
process.exit = function (c) { trips.push('exit:' + c); throw new Error('guard: process.exit(' + c + ')'); };
fs.readFileSync = function (p) {
  if (p === 0 || p === '/dev/stdin') { trips.push('fd0'); throw new Error('guard: fd 0 read'); }
  return origRead.apply(this, arguments);
};
function sniff(stream) {
  stream.write = function (s) {
    const t = String(s);
    if (!/^\\(node:\\d+\\)|--trace-warnings|Warning/.test(t)) writes.push(stream === process.stdout ? 'stdout' : 'stderr');
    return true;
  };
}
sniff(process.stdout);
sniff(process.stderr);
function listeners() {
  const o = {};
  for (const n of ['uncaughtException', 'unhandledRejection', 'SIGINT', 'SIGTERM', 'SIGHUP', 'beforeExit', 'exit', 'warning']) o[n] = process.listenerCount(n);
  return o;
}
function report(o) {
  fs.writeSync(1, JSON.stringify(o) + '\\n');
  origExit.call(process, 0);
}
process.on('uncaughtException', (e) => { report({ fatal: 'uncaught ' + String(e && e.stack || e), trips, writes }); });
// X7 spies: record the order of the MINTO drain call and of the first sink write.
const events = [];
if (process.env.X7_SPY === '1') {
  const rootDir = require('node:path').resolve(require('node:path').dirname(scriptPath), '..');
  const hookIo = require(rootDir + '/lib/core/hook-io.cjs');
  const origMake = hookIo.makeSink;
  hookIo.makeSink = function () {
    const sk = origMake.apply(this, arguments);
    const o = sk.out;
    sk.out = function (t) { if (events[events.length - 1] !== 'out') events.push('out'); return o.apply(this, arguments); };
    return sk;
  };
  const minto = require(rootDir + '/scripts/minto-drain-on-prompt.cjs');
  const origDrain = minto.drainOnPrompt;
  minto.drainOnPrompt = function (room) { events.push('drain:' + room); return origDrain.apply(this, arguments); };
}
(async () => {
  const before = listeners();
  let mod = null;
  let reqErr = null;
  try { mod = require(scriptPath); } catch (e) { reqErr = String(e && e.message || e); }
  const afterRequire = listeners();
  const reqTrips = trips.slice();
  const reqWrites = writes.slice();
  if (mode === 'probe') {
    fs.readFileSync = origRead;
    let stdin = null;
    try { stdin = origRead(0, 'utf8'); } catch (e) { stdin = 'ERR ' + e.message; }
    return report({ reqErr, hasRun: !!(mod && typeof mod.run === 'function'), trips: reqTrips, writes: reqWrites, before, afterRequire, stdin });
  }
  if (reqErr || !mod || typeof mod.run !== 'function') return report({ reqErr, hasRun: false, trips: reqTrips, writes: reqWrites });
  if (mode === 'run2') {
    const first = await mod.run(input, { argv: argv });
    const empty = await mod.run('', { argv: argv });
    return report({ first, empty, trips, writes });
  }
  trips.length = 0; writes.length = 0;
  const t0 = Date.now();
  let result = null;
  let err = null;
  try { result = await mod.run(input, { argv: argv, deadlineAt: null }); } catch (e) { err = String(e && e.stack || e); }
  const ms = Date.now() - t0;
  report({ result, err, trips, writes, ms, hasRun: true, afterRequire, afterRun: listeners(), events, drainEnvAfter: process.env.MOS_MINTO_DRAIN_ROOM === undefined ? null : process.env.MOS_MINTO_DRAIN_ROOM });
})().catch((e) => report({ fatal: String(e && e.stack || e), trips, writes }));
`;
const DRIVER_PATH = path.join(WORK, 'driver.cjs');
fs.writeFileSync(DRIVER_PATH, DRIVER);

function runCli(script, c, fx, extraEnv) {
  const res = spawnSync('node', [path.join(ROOT, script.file)].concat(script.argv), {
    input: c.input(fx),
    env: childEnv(fx, extraEnv),
    cwd: fx.cwd,
    encoding: 'utf8',
    timeout: 60000,
  });
  return { code: res.status === null ? -1 : res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

function runDriver(mode, script, input, argv, fx, extraEnv, stdin) {
  const res = spawnSync('node', [DRIVER_PATH, mode, path.join(ROOT, script.file), input, JSON.stringify(argv)], {
    input: stdin === undefined ? '' : stdin,
    env: childEnv(fx, extraEnv),
    cwd: fx.cwd,
    encoding: 'utf8',
    timeout: 60000,
  });
  const line = (res.stdout || '').trim().split('\n').filter(Boolean).pop() || '';
  let parsed = null;
  try { parsed = JSON.parse(line); } catch (_e) { parsed = { fatal: 'no driver output; status=' + res.status + ' stderr=' + (res.stderr || '').slice(0, 300) }; }
  return parsed;
}

// ---------- capture mode ----------

function capture() {
  const golden = { version: 1, captured_at_base: 'before the plan 400.4-12 edits', masks: MASKS, results: {} };
  for (const s of SCRIPTS) {
    golden.results[s.id] = {};
    for (const c of CASES) {
      const runs = [];
      for (let i = 0; i < 2; i++) {
        const fx = freshCopy(c.fixture);
        try { runs.push(maskResult(runCli(s, c, fx), fx.root)); } finally { fx.cleanup(); }
      }
      if (!same(runs[0], runs[1])) {
        console.log('CAPTURE UNSTABLE ' + s.id + ' ' + c.id + '\n  A ' + brief(runs[0]) + '\n  B ' + brief(runs[1]));
        failures++;
      }
      golden.results[s.id][c.id] = runs[0];
      console.log('captured ' + s.id + ' ' + c.id + ' code=' + runs[0].code + ' out=' + runs[0].stdout.length + ' err=' + runs[0].stderr.length);
    }
  }
  if (failures === 0) {
    let prev = {};
    try { prev = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8')); } catch (_e) { prev = null; }
    if (prev && prev.results && ONLY) golden.results = Object.assign({}, prev.results, golden.results);
    fs.mkdirSync(path.dirname(GOLDEN_PATH), { recursive: true });
    fs.writeFileSync(GOLDEN_PATH, JSON.stringify(golden, null, 2) + '\n');
    console.log('wrote ' + path.relative(ROOT, GOLDEN_PATH));
  }
}

// ---------- the legs ----------

function legs() {
  let golden = null;
  if (GOLDEN) {
    try { golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8')); } catch (e) { check('X5 golden file is readable', false, e.message); }
  }

  // X1 and X2: require() has no side effect, run is exported.
  for (const s of SCRIPTS) {
    const fx = freshCopy('room');
    try {
      const p = runDriver('probe', s, '', [], fx, undefined, 'XYZ');
      const listenerGrew = ['uncaughtException', 'unhandledRejection', 'SIGINT', 'SIGTERM', 'SIGHUP']
        .filter((n) => p.afterRequire && p.before && p.afterRequire[n] > p.before[n]);
      check('X1 ' + s.id + ': require has no output, no exit, no listener', !p.fatal && !p.reqErr && (p.writes || []).length === 0
        && (p.trips || []).filter((t) => t.startsWith('exit')).length === 0 && listenerGrew.length === 0,
      brief({ fatal: p.fatal, reqErr: p.reqErr, writes: p.writes, trips: p.trips, listenerGrew }));
      check('X1 ' + s.id + ': require does not read stdin', p.stdin === 'XYZ', 'stdin after require = ' + JSON.stringify(p.stdin));
      check('X2 ' + s.id + ': exports run as a function', p.hasRun === true);
    } finally { fx.cleanup(); }
  }

  // X3, X4, X5: per script and case.
  for (const s of SCRIPTS) {
    for (const c of CASES) {
      const fxCli = freshCopy(c.fixture);
      const fxRun = freshCopy(c.fixture);
      try {
        const cli = maskResult(runCli(s, c, fxCli), fxCli.root);
        const d = runDriver('run', s, c.input(fxRun), s.argv, fxRun);
        const run = d && d.result ? maskResult(d.result, fxRun.root) : null;
        check('X3 ' + s.id + ' ' + c.id + ': run() equals the CLI', run !== null && same(cli, run),
          'cli=' + brief(cli) + ' run=' + brief(run || d));
        check('X4 ' + s.id + ' ' + c.id + ': run() resolves with no exit, no fd 0 read, no stream write, no new listener',
          !!d && d.hasRun === true && !d.err && !d.fatal && d.trips.length === 0 && d.writes.length === 0
          && same(d.afterRequire, d.afterRun),
          brief({ err: d.err, fatal: d.fatal, trips: d.trips, writes: d.writes, hasRun: d.hasRun, a: d.afterRequire, b: d.afterRun }));
        if (c.id === 'E5' && d && typeof d.ms === 'number') console.log('TIME ' + s.id + ' E5 run() ' + d.ms + ' ms');
        if (golden) {
          const g = golden.results && golden.results[s.id] && golden.results[s.id][c.id];
          check('X5 ' + s.id + ' ' + c.id + ': CLI equals the golden', !!g && same(cli, g), 'cli=' + brief(cli) + ' golden=' + brief(g));
          check('X5 ' + s.id + ' ' + c.id + ': run() equals the golden', !!g && run !== null && same(run, g), 'run=' + brief(run) + ' golden=' + brief(g));
        }
      } finally { fxCli.cleanup(); fxRun.cleanup(); }
    }
  }

  // X6: argv is honored; the derivation drain keeps its CLI-only modes.
  if (SCRIPTS.some((s) => s.id === 'jtbd-update')) {
    const s = SCRIPTS.find((x) => x.id === 'jtbd-update');
    const c = CASES.find((x) => x.id === 'E5');
    const fxA = freshCopy('room');
    const fxB = freshCopy('room');
    try {
      const cli = maskResult(runCli(s, c, fxA), fxA.root);
      const d = runDriver('run', s, c.input(fxB), ['userprompt'], fxB);
      check('X6 jtbd-update: run() with argv userprompt equals the CLI with userprompt',
        !!d && !!d.result && same(maskResult(d.result, fxB.root), cli), brief({ cli, d }));
      const d2 = runDriver('run', s, c.input(fxB), [], fxB);
      check('X6 jtbd-update: run() with no event resolves code 0 and no output',
        !!d2 && !!d2.result && d2.result.code === 0 && d2.result.stdout === '', brief(d2));
    } finally { fxA.cleanup(); fxB.cleanup(); }
  }
  if (SCRIPTS.some((s) => s.id === 'brain-derivation-drain')) {
    const fx = freshCopy('room');
    try {
      const res = spawnSync('node', [path.join(ROOT, 'scripts/brain-derivation-drain.cjs'), '--dry-run'], {
        input: '', env: childEnv(fx), cwd: fx.cwd, encoding: 'utf8', timeout: 60000,
      });
      check('X6 brain-derivation-drain: --dry-run on an empty queue exits 0 through the CLI path', res.status === 0, 'status=' + res.status + ' ' + (res.stderr || '').slice(0, 200));
    } finally { fx.cleanup(); }
  }
}

// X7: intent-classifier run() drains the MINTO room first, then classifies.
function legX7() {
  const s = SCRIPTS.find((x) => x.id === 'intent-classifier');
  if (!s) return;
  const c = CASES.find((x) => x.id === 'E3');
  // (a) MOS_MINTO_DRAIN_ROOM unset: run() finds the room itself (plan 10).
  const fxA = freshCopy('room');
  try {
    const d = runDriver('run', s, c.input(fxA), [], fxA, { X7_SPY: '1' });
    const ev = (d && d.events) || [];
    const drainIdx = ev.findIndex((e) => e.startsWith('drain:'));
    const outIdx = ev.indexOf('out');
    check('X7 intent-classifier: run() with no MOS_MINTO_DRAIN_ROOM drains the room it finds, before the first output',
      !!d && !d.err && drainIdx === 0 && ev[0] === 'drain:' + fxA.roomDir && outIdx > drainIdx, brief({ ev, roomDir: fxA.roomDir, err: d && d.err, fatal: d && d.fatal }));
  } finally { fxA.cleanup(); }
  // (b) MOS_MINTO_DRAIN_ROOM set: it wins, and the value is deleted after the read.
  const fxB = freshCopy('room');
  try {
    const d = runDriver('run', s, c.input(fxB), [], fxB, { X7_SPY: '1', MOS_MINTO_DRAIN_ROOM: fxB.roomDir });
    const ev = (d && d.events) || [];
    check('X7 intent-classifier: MOS_MINTO_DRAIN_ROOM wins, drains first, and is deleted after the read',
      !!d && !d.err && ev[0] === 'drain:' + fxB.roomDir && ev.indexOf('out') > 0 && d.drainEnvAfter === null, brief({ ev, env: d && d.drainEnvAfter }));
  } finally { fxB.cleanup(); }
  // (c) two runs in one process keep their own turn state (no stale input from the first run).
  const fxC = freshCopy('room');
  try {
    const d = runDriver('run2', s, c.input(fxC), [], fxC, {});
    check('X7 intent-classifier: an empty run after a full run in the same process prints nothing (no stale input)',
      !!d && !d.fatal && d.first && d.first.stdout.length > 0 && d.empty && d.empty.stdout === '' && d.empty.code === 0, brief(d));
  } finally { fxC.cleanup(); }
}

if (CAPTURE) capture();
else { legs(); legX7(); }

console.log(failures === 0 ? 'ALL PASS' : 'FAILURES: ' + failures);
process.exit(failures === 0 ? 0 : 1);
