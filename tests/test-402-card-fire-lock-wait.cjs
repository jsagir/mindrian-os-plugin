'use strict';
// Quick 261127-k4f, Phase 402 K4-R5 (design 402-DESIGN.md r3.1 section 7.1;
// binding addendum 402-K4F-PLAN-ADDENDUM.md change 19; folds in 400.3-09).
//
// The card-fire Stop hook has a 5 s row (hooks/hooks.json). When another live
// process holds the retry-store lock for the whole run, each of the 2 fenced
// calls of a route waits RETRY_LOCK_MAX_ATTEMPTS x RETRY_LOCK_SLEEP_MS and then
// writes unfenced (D-12). The rule: T = U + 2 x attempts x sleep. The invariant
// is T: the hook must end inside its row, so T is at most 4,000 ms on every run.
// The sleep part is at most 2,000 ms (arithmetic) and U is at most 2,000 ms
// (4,000 minus the sleep part).
//
// Addendum 402-K4F-PLAN-ADDENDUM.md, last section (finding on the staging
// branch, 2026-11-28): under load from other work, 1 run at 75 attempts had
// T 4,613 ms. So the held-lock case runs 2 times: on a quiet machine, and under
// a made load (1 busy worker process for each CPU core, for the time of the arm).
//
// Legs: W0 arithmetic on the 2 exported constants. W1 to W4 (quiet arm) and L1
// to L4 (load arm): the 4 routes of main() (intercept, degrade, pass,
// stop_hook_active pass), 20 counted runs each, 4 hook processes in parallel,
// the lock held by a live holder process that rewrites the lock file every
// 500 ms through a temp file and a rename. A run counts only when its stderr
// holds exactly 2 "fence exhausted" lines. At most 3 extra runs for each route.
//
// Arms: "--arm quiet", "--arm load" or "--arm both" (the default).
//
// Load workers: each worker stops itself when its parent process ends or after
// 900 s. The test kills every worker at the end of the arm, on an exception,
// and on process exit.
//
// Rule: never run this against the live ~/.mindrian. Each run has its own
// mkdtemp MINDRIAN_HOME and CARD_FIRE_SIDECHANNEL_PATH. No network.
//
// Output: 1 line per leg, "PASS <ID>: <text>" or "FAIL <ID>: <text>", and 1
// measure line per route. Last line "test-402-card-fire-lock-wait: <p> passed,
// <f> failed". Exit 1 when f is above 0.
//
// No em dash and no en dash in this file (hyphens only).

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

delete process.env.TYPESAFE_API_KEY;
delete process.env.MINDRIAN_MCP_FIRST;

const REPO = path.join(__dirname, '..');
const HOOK = path.join(REPO, 'scripts', 'check-card-fire.cjs');

const OWN_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'k4f-lockwait-own-'));
process.env.MINDRIAN_HOME = OWN_HOME;
process.env.CARD_FIRE_SIDECHANNEL_PATH = path.join(OWN_HOME, 'card-fire-reached.json');

let m = {};
try { m = require(HOOK); } catch (_e) { m = {}; }

// For the measure only: when the constants are not exported (the tree before
// the fix), read their values from the source text so U can still be shown.
function constFromSource(name) {
  const src = fs.readFileSync(HOOK, 'utf8');
  const mm = new RegExp('const ' + name + ' = (\\d+);').exec(src);
  return mm ? Number(mm[1]) : NaN;
}
const ATTEMPTS = Number.isInteger(m.RETRY_LOCK_MAX_ATTEMPTS) ? m.RETRY_LOCK_MAX_ATTEMPTS : constFromSource('RETRY_LOCK_MAX_ATTEMPTS');
const SLEEP = Number.isInteger(m.RETRY_LOCK_SLEEP_MS) ? m.RETRY_LOCK_SLEEP_MS : constFromSource('RETRY_LOCK_SLEEP_MS');
const SLEEP_PART = 2 * ATTEMPTS * SLEEP;

const T_MAX = 4000;
const SLEEP_MAX = 2000;
const U_MAX = T_MAX - SLEEP_MAX;
const LOAD_WORKER_MAX_S = 900;

function parseArm(argv) {
  let arm = 'both';
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--arm':
        arm = argv[i + 1];
        i += 1;
        break;
      default:
        break;
    }
  }
  if (arm !== 'quiet' && arm !== 'load' && arm !== 'both') {
    console.log('FAIL ARG: --arm must be quiet, load or both, got ' + arm);
    process.exit(1);
  }
  return arm;
}
const ARM = parseArm(process.argv.slice(2));

// The made load: 1 busy worker for each CPU core. Each worker spins, and checks
// every 100 ms that its parent is alive and that it is inside its own limit.
const LOAD_SRC = [
  'const parent = Number(process.argv[1]);',
  'const end = Date.now() + Number(process.argv[2]) * 1000;',
  'let next = 0;',
  'for (;;) {',
  '  const now = Date.now();',
  '  if (now >= next) {',
  '    next = now + 100;',
  '    if (now >= end) process.exit(0);',
  '    try { process.kill(parent, 0); } catch (_e) { process.exit(0); }',
  '  }',
  '  Math.sqrt(now);',
  '}',
].join('\n');

const loadWorkers = new Set();
function stopLoad() {
  for (const w of loadWorkers) {
    try { w.kill('SIGKILL'); } catch (_e) { /* best-effort */ }
  }
  loadWorkers.clear();
}
process.on('exit', stopLoad);
process.on('SIGINT', function () { stopLoad(); process.exit(130); });
process.on('SIGTERM', function () { stopLoad(); process.exit(143); });

function startLoad() {
  const n = os.cpus().length || 1;
  for (let i = 0; i < n; i += 1) {
    const w = spawn(process.execPath, ['-e', LOAD_SRC, String(process.pid), String(LOAD_WORKER_MAX_S)], { stdio: 'ignore' });
    loadWorkers.add(w);
    w.on('exit', function () { loadWorkers.delete(w); });
  }
  return n;
}
const RUNS = 20;
const PARALLEL = 4;
const EXTRA = 3;

const PROMPT = 'help me decide on the release';
const DECL = 'Here are the paths I see.\nYour call: Ship it now | Hold one week | What if we open-source it';
const PROSE = 'The build ended and every suite is green.';
const PASS_STDOUT = '{"continue":true,"suppressOutput":true}';
const DEGRADE_ENV = { continue: true, suppressOutput: true, reason: 'continuing this turn' };

let passed = 0;
let failed = 0;
function report(id, ok, text) {
  if (ok) { passed += 1; console.log('PASS ' + id + ': ' + text); } else { failed += 1; console.log('FAIL ' + id + ': ' + text); }
}

const HOLDER_SRC = [
  "const fs = require('node:fs');",
  'const lock = process.argv[1];',
  'function write() {',
  "  const tmp = lock + '.holder-' + process.pid;",
  '  fs.writeFileSync(tmp, JSON.stringify({ pid: process.pid, timestamp: Date.now() }));',
  '  fs.renameSync(tmp, lock);',
  '}',
  'write();',
  "process.stdout.write('ready\\n');",
  'setInterval(write, 500);',
].join('\n');

function startHolder(lockPath) {
  return new Promise(function (resolve, reject) {
    const child = spawn(process.execPath, ['-e', HOLDER_SRC, lockPath], { stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = '';
    const t = setTimeout(function () { reject(new Error('holder did not start')); }, 10000);
    child.stdout.on('data', function (d) {
      buf += d;
      if (buf.indexOf('ready') !== -1) { clearTimeout(t); resolve(child); }
    });
    child.on('error', reject);
  });
}

function writeTranscript(fp, text) {
  const recs = [
    { type: 'user', message: { role: 'user', content: PROMPT }, origin: { kind: 'human' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: text }] } },
  ];
  fs.writeFileSync(fp, recs.map(function (r) { return JSON.stringify(r); }).join('\n') + '\n', 'utf8');
}

const ROUTES = [
  { id: 'W1', name: 'intercept', text: DECL, key: undefined, seedSession: false },
  { id: 'W2', name: 'degrade', text: DECL, key: undefined, seedSession: true },
  { id: 'W3', name: 'pass', text: PROSE, key: undefined, seedSession: false },
  { id: 'W4', name: 'stop_hook_active pass', text: DECL, key: true, seedSession: false },
];

function checkEnvelope(route, stdout) {
  let env = null;
  try { env = JSON.parse(stdout); } catch (_e) { return 'stdout is not JSON: ' + stdout; }
  if (route.name === 'intercept') {
    const keys = Object.keys(env).sort().join(',');
    if (keys !== 'decision,reason,systemMessage' || env.decision !== 'block') return 'intercept envelope ' + stdout;
    return null;
  }
  if (route.name === 'degrade') {
    return JSON.stringify(env) === JSON.stringify(DEGRADE_ENV) ? null : 'degrade envelope ' + stdout;
  }
  return stdout === PASS_STDOUT ? null : route.name + ' envelope ' + stdout;
}

async function oneRun(route, n) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'k4f-lockwait-run-'));
  const home = path.join(dir, 'mindrian');
  fs.mkdirSync(home, { recursive: true });
  const sid = 'k4f-lock-' + route.id + '-' + n + '-' + process.pid + '-' + Date.now();
  const tp = path.join(dir, 'transcript.jsonl');
  writeTranscript(tp, route.text);
  if (route.seedSession) {
    const store = {};
    store[(m.SESSION_KEY_PREFIX || '__session__:') + sid] = { count: 12, ts: Date.now() };
    fs.writeFileSync(path.join(home, 'card-fire-retries.json'), JSON.stringify(store), 'utf8');
  }
  const stdinObj = { hook_event_name: 'Stop', session_id: sid, transcript_path: tp };
  if (route.key === true) stdinObj.stop_hook_active = true;
  const holder = await startHolder(path.join(home, 'card-fire-retries.json.lock'));
  try {
    const env = Object.assign({}, process.env);
    delete env.TYPESAFE_API_KEY;
    delete env.MINDRIAN_MCP_FIRST;
    env.MINDRIAN_HOME = home;
    env.CARD_FIRE_SIDECHANNEL_PATH = path.join(dir, 'card-fire-reached.json');
    const t0 = process.hrtime.bigint();
    const res = await new Promise(function (resolve) {
      const child = spawn(process.execPath, [HOOK], { cwd: REPO, env: env, stdio: ['pipe', 'pipe', 'pipe'] });
      let out = '';
      let err = '';
      child.stdout.on('data', function (d) { out += d; });
      child.stderr.on('data', function (d) { err += d; });
      child.on('close', function (code) { resolve({ code: code, out: out, err: err }); });
      child.stdin.end(JSON.stringify(stdinObj));
    });
    const T = Number(process.hrtime.bigint() - t0) / 1e6;
    const exhausted = (res.err.match(/fence exhausted/g) || []).length;
    return { T: T, U: T - SLEEP_PART, code: res.code, out: res.out, exhausted: exhausted };
  } finally {
    holder.kill('SIGKILL');
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
}

async function runRoute(route, arm) {
  const id = arm === 'load' ? route.id.replace('W', 'L') : route.id;
  const counted = [];
  const errors = [];
  let started = 0;
  let notCounted = 0;
  async function worker() {
    while (counted.length < RUNS && started < RUNS + EXTRA) {
      started += 1;
      const r = await oneRun(route, started);
      if (r.exhausted !== 2) { notCounted += 1; continue; }
      if (counted.length >= RUNS) continue;
      counted.push(r);
      if (r.code !== 0) errors.push('exit ' + r.code);
      const bad = checkEnvelope(route, r.out);
      if (bad) errors.push(bad);
      if (r.T > T_MAX) errors.push('T ' + r.T.toFixed(0) + ' ms above ' + T_MAX);
      if (r.U > U_MAX) errors.push('U ' + r.U.toFixed(0) + ' ms above ' + U_MAX);
    }
  }
  const ws = [];
  for (let i = 0; i < PARALLEL; i += 1) ws.push(worker());
  await Promise.all(ws);
  const Ts = counted.map(function (r) { return r.T; }).sort(function (a, b) { return a - b; });
  const Us = counted.map(function (r) { return r.U; });
  const med = Ts.length ? Ts[Math.floor((Ts.length - 1) / 2)] : NaN;
  console.log('  ' + id + ' ' + route.name + ' (' + arm + '): runs ' + counted.length + ' (not counted ' + notCounted + '), T min ' +
    (Ts.length ? Ts[0].toFixed(0) : 'n/a') + ' ms, T median ' + (Ts.length ? med.toFixed(0) : 'n/a') + ' ms, T max ' +
    (Ts.length ? Ts[Ts.length - 1].toFixed(0) : 'n/a') + ' ms, U max ' + (Us.length ? Math.max.apply(null, Us).toFixed(0) : 'n/a') +
    ' ms (attempts ' + ATTEMPTS + ', sleep ' + SLEEP + ' ms)');
  const okCount = counted.length === RUNS;
  report(id, okCount && errors.length === 0,
    route.name + ' route (' + arm + ' arm): ' + RUNS + ' counted runs, each exit 0, route envelope, T at most ' + T_MAX + ' ms, U at most ' + U_MAX + ' ms' +
    (okCount ? '' : ' -- only ' + counted.length + ' counted runs') + (errors.length ? ' -- ' + errors.slice(0, 3).join('; ') + (errors.length > 3 ? ' (' + errors.length + ' faults)' : '') : ''));
}

(async function main() {
  const exported = Number.isInteger(m.RETRY_LOCK_MAX_ATTEMPTS) && Number.isInteger(m.RETRY_LOCK_SLEEP_MS);
  report('W0', exported && SLEEP_PART <= SLEEP_MAX,
    'the 2 lock constants are exported and 2 x attempts x sleep is at most ' + SLEEP_MAX + ' ms' +
    (exported ? '' : ' -- constants not exported') + ' (2 x ' + ATTEMPTS + ' x ' + SLEEP + ' = ' + SLEEP_PART + ')');
  const arms = ARM === 'both' ? ['quiet', 'load'] : [ARM];
  for (const arm of arms) {
    if (arm === 'load') console.log('  load arm: ' + startLoad() + ' busy worker processes');
    try {
      for (const route of ROUTES) {
        try {
          await runRoute(route, arm);
        } catch (e) {
          const id = arm === 'load' ? route.id.replace('W', 'L') : route.id;
          report(id, false, route.name + ' route (' + arm + ' arm) threw -- ' + (e && e.message ? e.message : String(e)));
        }
      }
    } finally {
      stopLoad();
    }
  }
  try { fs.rmSync(OWN_HOME, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  console.log('test-402-card-fire-lock-wait: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed > 0 ? 1 : 0);
})();
