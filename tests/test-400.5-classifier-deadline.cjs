'use strict';
// Phase 400.5 plan 03 (CONTEXT 5e (b)): the deadline check before the two late writes of the classifier engine.
//
//   node tests/test-400.5-classifier-deadline.cjs
//
// L1  control: run(input, {deadlineAt: now + 10 s}) writes the engine trace entry and the NAV block hash.
// L2  cut: run(input, {deadlineAt: now}) resolves at once; after 2,500 ms the engine has written no trace entry
//     with elapsed_ms and no NAV block hash (a cut turn leaves no late write, as a host-killed process did).
// L3  CLI path: node scripts/intent-classifier.cjs (no deadline) writes both, as before.
// L4  unit: deadlinePassed(null), (NaN), (past), (future).
//
// Every leg uses its own fresh room under a temp HOME and a temp MINDRIAN_ROOMS_HOME. Nothing touches the real
// home or the real rooms folder. L2 runs last among the in-process legs, so its late engine cannot touch another leg.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const helpers = require(path.join(ROOT, 'tests', 'helpers', 'isolated-home-36925.cjs'));

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('PASS ' + name);
  else { failures++; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

// The temp homes are set before the in-process require of the classifier.
const iso = helpers.mkIsolatedHome('400503');
const ADMIN_PATH = path.join(iso.home, 'no-such-admin-identity.json');
process.env.HOME = iso.home;
process.env.USERPROFILE = iso.home;
process.env.MINDRIAN_ROOMS_HOME = iso.roomsHome;
process.env.MINDRIAN_HOME = path.join(iso.home, '.mindrian');
process.env.MINDRIAN_ADMIN_IDENTITY_PATH = ADMIN_PATH;
process.env.CLAUDE_PLUGIN_ROOT = ROOT;
for (const k of ['CLAUDECODE', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_ACTIVE_ROOM', 'MINDRIAN_ACTIVE_SESSION_ID']) {
  delete process.env[k];
}

const PROMPT = 'what should I work on next for this venture';

function bornRoom(slug) {
  const saved = Object.assign({}, process.env);
  try {
    return helpers.birthFixtureRoom({ iso, slug, ventureText: 'A fixture venture for the 400.5 deadline tests' }).roomDir;
  } finally {
    for (const k of Object.keys(process.env)) { if (!(k in saved)) delete process.env[k]; }
    Object.assign(process.env, saved);
  }
}

function inputFor(sessionId, roomDir) {
  return JSON.stringify({ prompt: PROMPT, session_id: sessionId, cwd: roomDir, hook_event_name: 'UserPromptSubmit' });
}

function tracePath(roomDir, sessionId) {
  return path.join(roomDir, '.mindrian', 'decision-traces', sessionId + '.json');
}
function navHashPath(roomDir, sessionId) {
  return path.join(roomDir, '.mindrian', 'decision-traces', sessionId + '.nav-block-hash.json');
}
function engineTraceCount(roomDir, sessionId) {
  try {
    const data = JSON.parse(fs.readFileSync(tracePath(roomDir, sessionId), 'utf8'));
    const traces = Array.isArray(data && data.traces) ? data.traces : [];
    return traces.filter((t) => t && Object.prototype.hasOwnProperty.call(t, 'elapsed_ms')).length;
  } catch (_e) {
    return 0;
  }
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
  // The rooms are born before the classifier module loads.
  const room1 = bornRoom('dl-room-l1');
  const room2 = bornRoom('dl-room-l2');
  const room3 = bornRoom('dl-room-l3');

  const prevCwd = process.cwd();
  const mod = require(path.join(ROOT, 'scripts', 'intent-classifier.cjs'));

  // ---------- L4 (unit) ----------
  const dp = mod.deadlinePassed;
  check('L4 deadlinePassed is exported', typeof dp === 'function', typeof dp);
  if (typeof dp === 'function') {
    check('L4 deadlinePassed(null) is false', dp(null) === false);
    check('L4 deadlinePassed(NaN) is false', dp(NaN) === false);
    check('L4 deadlinePassed(past) is true', dp(Date.now() - 1) === true);
    check('L4 deadlinePassed(future) is false', dp(Date.now() + 60000) === false);
  }

  // ---------- L1 (control) ----------
  try {
    process.chdir(room1);
    await mod.run(inputFor('dl-l1', room1), { argv: [], deadlineAt: Date.now() + 10000 });
  } finally {
    process.chdir(prevCwd);
  }
  const l1Hash = fs.existsSync(navHashPath(room1, 'dl-l1'));
  if (!l1Hash) {
    check('L1 precondition: E5 renders a NAV block', false, 'no NAV hash file at ' + path.relative(iso.home, navHashPath(room1, 'dl-l1')));
  } else {
    check('L1 trace entry with elapsed_ms exists', engineTraceCount(room1, 'dl-l1') >= 1);
    check('L1 NAV hash file exists', l1Hash);
  }

  // ---------- L3 (CLI path, no deadline) ----------
  const env = Object.assign({}, process.env);
  const res = spawnSync('node', [path.join(ROOT, 'scripts', 'intent-classifier.cjs')], {
    input: inputFor('dl-l3', room3),
    env,
    cwd: room3,
    encoding: 'utf8',
    timeout: 60000,
  });
  check('L3 CLI exits 0', res.status === 0, 'status=' + res.status);
  check('L3 trace entry with elapsed_ms exists', engineTraceCount(room3, 'dl-l3') >= 1);
  check('L3 NAV hash file exists', fs.existsSync(navHashPath(room3, 'dl-l3')));

  // ---------- L2 (cut), last ----------
  try {
    process.chdir(room2);
    await mod.run(inputFor('dl-l2', room2), { argv: [], deadlineAt: Date.now() });
  } finally {
    process.chdir(prevCwd);
  }
  // The engine is bounded by NAV_HARD_TIMEOUT_MS (1,200 ms); wait past it.
  await sleep(2500);
  check('L2 no trace entry with elapsed_ms after the cut', engineTraceCount(room2, 'dl-l2') === 0,
    'count=' + engineTraceCount(room2, 'dl-l2'));
  check('L2 no NAV hash file after the cut', !fs.existsSync(navHashPath(room2, 'dl-l2')));

  // ---------- dash guard ----------
  check('dash guard on this test file', helpers.dashGuard([__filename]).length === 0);

  console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILED');
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.log('FAIL fatal :: ' + String(e && e.stack || e));
  process.exit(1);
});
