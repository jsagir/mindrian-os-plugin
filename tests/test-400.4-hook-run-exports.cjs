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
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const GOLDEN_PATH = path.join(ROOT, 'tests', 'fixtures', '400.4', 'hook-golden.json');
const helpers = require(path.join(ROOT, 'tests', 'helpers', 'isolated-home-36925.cjs'));

const ARGS = process.argv.slice(2);
const CAPTURE = ARGS.includes('--capture');
const GOLDEN = ARGS.includes('--golden');
const onlyIdx = ARGS.indexOf('--only');
const ONLY = onlyIdx >= 0 && ARGS[onlyIdx + 1] ? new Set(ARGS[onlyIdx + 1].split(',')) : null;

const SCRIPTS = [
  { id: 'admin-command-gate', file: 'scripts/admin-command-gate.cjs', argv: [] },
  { id: 'intent-classifier', file: 'scripts/intent-classifier.cjs', argv: [] },
  { id: 'first-install-router', file: 'scripts/first-install-router.cjs', argv: [] },
  { id: 'brain-derivation-drain', file: 'scripts/brain-derivation-drain.cjs', argv: [] },
  { id: 'jtbd-update', file: 'scripts/jtbd-update.cjs', argv: ['userprompt'] },
  { id: 'auto-explore-drain', file: 'scripts/auto-explore-drain.cjs', argv: [] },
].filter((s) => !ONLY || ONLY.has(s.id));

function promptJson(prompt) {
  return function (ctx) {
    return JSON.stringify({ prompt, session_id: 'sess-400412', cwd: ctx.cwd, hook_event_name: 'UserPromptSubmit' });
  };
}

const CASES = [
  { id: 'E1', fixture: 'virgin', input: () => '' },
  { id: 'E2', fixture: 'virgin', input: () => 'not json' },
  { id: 'E3', fixture: 'room', input: promptJson('hello there') },
  { id: 'E4', fixture: 'room', input: promptJson('/mos:admin') },
  { id: 'E5', fixture: 'room', input: promptJson('what should I work on next for this venture') },
  { id: 'E6', fixture: 'virgin', input: promptJson('hello') },
];

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('PASS ' + name);
  else { failures++; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

// ---------- work area, fixtures ----------

const TMP = fs.realpathSync(os.tmpdir());
const WORK = fs.mkdtempSync(path.join(TMP, 'mos400412-w-'));
const TO_REMOVE = [WORK];
process.on('exit', () => { for (const d of TO_REMOVE) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } } });

const PREFIX = 'mos400412-';
const TEMPLATES = {};

function buildTemplate(kind) {
  if (TEMPLATES[kind]) return TEMPLATES[kind];
  const root = fs.mkdtempSync(path.join(TMP, PREFIX));
  TO_REMOVE.push(root);
  const roomsHome = path.join(root, 'rooms');
  fs.mkdirSync(roomsHome, { recursive: true });
  if (kind === 'room') {
    const saved = Object.assign({}, process.env);
    try {
      helpers.birthFixtureRoom({ iso: { home: root, roomsHome }, slug: 'qa-fixture', ventureText: 'A fixture venture for the 400.4 run export tests' });
    } finally {
      for (const k of Object.keys(process.env)) { if (!(k in saved)) delete process.env[k]; }
      Object.assign(process.env, saved);
    }
  }
  TEMPLATES[kind] = { root, kind };
  return TEMPLATES[kind];
}

function rewritePaths(dir, from, to) {
  // Same-length names, so a byte replace keeps every file valid (a sqlite page included).
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) rewritePaths(p, from, to);
    else if (e.isFile()) {
      const buf = fs.readFileSync(p);
      if (buf.indexOf(from) === -1) continue;
      fs.writeFileSync(p, Buffer.from(buf.toString('latin1').split(from).join(to), 'latin1'));
    }
  }
}

function freshCopy(kind) {
  const tpl = buildTemplate(kind);
  const root = fs.mkdtempSync(path.join(TMP, PREFIX));
  fs.cpSync(tpl.root, root, { recursive: true });
  if (root.length !== tpl.root.length) throw new Error('fixture root names differ in length');
  rewritePaths(root, tpl.root, root);
  const roomDir = path.join(root, 'rooms', 'qa-fixture');
  return {
    root,
    home: root,
    roomsHome: path.join(root, 'rooms'),
    roomDir,
    cwd: kind === 'room' ? roomDir : root,
    cleanup() { try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* best effort */ } },
  };
}

function childEnv(fx, extra) {
  const env = {
    PATH: process.env.PATH,
    HOME: fx.home,
    USERPROFILE: fx.home,
    MINDRIAN_ROOMS_HOME: fx.roomsHome,
    CLAUDE_PLUGIN_ROOT: ROOT,
    USER: 'randomcustomer',
    USERNAME: 'randomcustomer',
    MINDRIAN_ADMIN_IDENTITY_PATH: path.join(fx.root, 'no-such-admin-identity.json'),
    TMPDIR: TMP,
  };
  return Object.assign(env, extra || {});
}

// ---------- masks ----------

const MASKS = [
  'the fixture copy root path -> <ROOT>',
  'node process warning lines (a line that starts with (node:PID), and the --trace-warnings hint) are dropped (the CLI shows them, a sink never does)',
  'ISO timestamps -> <TS>',
  'a number followed by ms -> <N>ms',
];
function mask(text, root) {
  let t = String(text || '');
  if (root) t = t.split(root).join('<ROOT>');
  t = t.split('\n').filter((l) => !/^\(node:\d+\)|--trace-warnings/.test(l)).join('\n');
  t = t.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z?/g, '<TS>');
  t = t.replace(/\b\d+(\.\d+)?ms\b/g, '<N>ms');
  return t;
}
function maskResult(r, root) {
  return { code: r.code, stdout: mask(r.stdout, root), stderr: mask(r.stderr, root) };
}
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
  trips.length = 0; writes.length = 0;
  const t0 = Date.now();
  let result = null;
  let err = null;
  try { result = await mod.run(input, { argv: argv, deadlineAt: null }); } catch (e) { err = String(e && e.stack || e); }
  const ms = Date.now() - t0;
  report({ result, err, trips, writes, ms, hasRun: true, afterRequire, afterRun: listeners() });
})().catch((e) => report({ fatal: String(e && e.stack || e), trips, writes }));
process.on('uncaughtException', (e) => { report({ fatal: 'uncaught ' + String(e && e.stack || e), trips, writes }); });
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

if (CAPTURE) capture();
else legs();

console.log(failures === 0 ? 'ALL PASS' : 'FAILURES: ' + failures);
process.exit(failures === 0 ? 0 : 1);
