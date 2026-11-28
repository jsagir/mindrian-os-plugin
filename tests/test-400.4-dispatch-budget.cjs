'use strict';
// Phase 400.5 plan 04 Task 1 (plan 13 Task 2 plus D8): the one UserPromptSubmit dispatcher stays inside its host
// budget while room.db is locked, and hooks.json starts it as the one UserPromptSubmit entry.
//
//   node tests/test-400.4-dispatch-budget.cjs
//
// D1  a lock holder keeps BEGIN IMMEDIATE on the fixture room.db for 10 s; the dispatcher CLI (case E5) exits 0
//     within 3,000 ms of its spawn; the navigation engine block of intent-classifier ran.
// D2  its stderr holds room_db_busy for brain-derivation-drain, jtbd-update and auto-explore-drain (each of the three
//     room.db checks reached its room.db open).
// D3  after the lock holder exits, the room tree hash and the row counts equal their values before the run (the
//     plan 10 K3 rule; the decision-traces folder of intent-classifier is not a room.db write and is left out, as K3
//     left out the classifier).
// D4  dispatch() with a fake check map (opts.checks, opts.processStartMs = Date.now()): check 2 runs a synchronous
//     loop of 2,600 ms; check 2 gets over_deadline, checks 3 to 6 each get skipped_deadline, and dispatch resolves
//     within 3,000 ms of its start.
// D5  dispatch() with a fake async check 2 that never resolves: over_deadline for it, no output from it, and check 3
//     runs and its context is in the envelope.
// D6  no lock: the dispatcher CLI exits 0 within 3,000 ms, and stderr holds no room_db_busy and no skipped_deadline.
// D7  hooks.json UserPromptSubmit has exactly 1 group with 1 hook: the command node
//     "${CLAUDE_PLUGIN_ROOT}/scripts/userprompt-dispatch.cjs", timeout 3, no async key.
// D8  in the D1 run the dispatcher stderr holds exactly one room_db_busy_trip line, it names an id of ROOM_DB_CHECKS,
//     and room_db_no_wait <id> is there for every ROOM_DB_CHECKS id after it in CHECKS order. In the D6 run neither
//     note is there.
//
// D4 and D5 pass opts.processStartMs because dispatch() otherwise takes its start from the process uptime: after the
// 10 s lock leg every check would be skipped and D4 would pass with no check run.
// Every run uses a fresh fixture copy with a temp HOME, MINDRIAN_HOME and MINDRIAN_ROOMS_HOME. Nothing touches the
// real rooms home. Hyphens only.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const parity = require(path.join(ROOT, 'tests', 'helpers', 'userprompt-parity-400-4.cjs'));
const { holdLock, stopChild } = require(path.join(ROOT, 'tests', 'helpers', 'room-db-lock-400-5.cjs'));

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('PASS ' + name);
  else { failures++; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

const LOCK_WINDOW_MS = 10000;
const HOOK_BUDGET_MS = 3000;
const DISPATCHER_COMMAND = 'node "${CLAUDE_PLUGIN_ROOT}/scripts/userprompt-dispatch.cjs"';
const DRAINS = ['brain-derivation-drain', 'jtbd-update', 'auto-explore-drain'];

// ---------- D7 first: the hooks.json entry (static) ----------
(function legD7() {
  const hooks = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks', 'hooks.json'), 'utf8')).hooks || {};
  const ups = hooks.UserPromptSubmit;
  const one = Array.isArray(ups) && ups.length === 1 && Array.isArray(ups[0].hooks) && ups[0].hooks.length === 1 ? ups[0].hooks[0] : null;
  check('D7 hooks.json UserPromptSubmit has exactly 1 group with 1 hook', !!one, 'groups=' + (Array.isArray(ups) ? ups.length : 'none'));
  check('D7 its command is the dispatcher node call', !!one && one.type === 'command' && one.command === DISPATCHER_COMMAND, one ? one.command : '');
  check('D7 its timeout is 3 and it has no async key', !!one && one.timeout === 3 && !('async' in one), one ? JSON.stringify(one) : '');
})();

let d = null;
try { d = require(path.join(ROOT, 'scripts', 'userprompt-dispatch.cjs')); } catch (e) { check('the dispatcher module loads', false, String(e && e.message || e)); }

// ---------- fixture helpers ----------

function e5Fixture() {
  const fx = parity.freshCopy('room');
  // One pending auto-explore finding so auto-explore-drain gets past its cheap exits and reaches its room.db open
  // (the plan 10 fixture rule).
  fs.writeFileSync(path.join(fx.roomDir, '.mindrian', 'auto-explore-f400504.json'), JSON.stringify({
    id: 'f400504', material_id: 'm400504', source_section: 'market-analysis', file_path_sha256: 'a'.repeat(64),
  }));
  const c = parity.CASES.find((x) => x.id === 'E5');
  return { fx, input: c.input(fx) };
}

// quiesce(roomDir, fx): one open and close in a child process with the fixture env, so pending WAL frames reach room.db.
function quiesce(fx) {
  const code = "const nav=require(process.argv[1]); const h=nav.openRoomDbForCaller(process.argv[2]); if (h) nav.closeRoomDbForCaller(h);";
  spawnSync(process.execPath, ['-e', code, path.join(ROOT, 'lib', 'core', 'navigation.cjs'), fx.roomDir], { env: parity.childEnv(fx), cwd: fx.cwd, encoding: 'utf8', timeout: 30000 });
}

function roomTreeHash(roomDir) {
  const h = crypto.createHash('sha256');
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).sort((x, y) => (x.name < y.name ? -1 : 1)).forEach((e) => {
      if (e.name === 'room.db-wal' || e.name === 'room.db-shm') return;
      const p = path.join(dir, e.name);
      const rel = path.relative(roomDir, p);
      if (rel === path.join('.mindrian', 'decision-traces')) return; // intent-classifier files, not room.db (K3)
      if (e.isDirectory()) { h.update('D ' + rel + '\n'); walk(p); }
      else if (e.isFile()) h.update('F ' + rel + ' ' + crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') + '\n');
    });
  })(roomDir);
  return h.digest('hex');
}

function rowCounts(roomDir) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'), { readOnly: true });
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
    const out = {};
    for (const t of tables) out[t] = db.prepare('SELECT COUNT(*) AS n FROM "' + t.replace(/"/g, '') + '"').get().n;
    return out;
  } finally { db.close(); }
}

// runDispatcherTimed(fx, input, killMs): the dispatcher CLI as an async child; ms counts from the spawn.
function runDispatcherTimed(fx, input, killMs) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'userprompt-dispatch.cjs')], { env: parity.childEnv(fx), cwd: fx.cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (b) => { stdout += b.toString(); });
    child.stderr.on('data', (b) => { stderr += b.toString(); });
    const killer = setTimeout(() => { try { child.kill('SIGKILL'); } catch (_e) { /* gone */ } }, killMs);
    child.on('exit', (code, sig) => {
      clearTimeout(killer);
      resolve({ code: code === null ? ('signal:' + sig) : code, ms: Date.now() - t0, stdout, stderr });
    });
    child.stdin.end(input);
  });
}

function dispatchNotes(stderr) {
  return String(stderr).split('\n').filter((l) => l.startsWith('[userprompt-dispatch] ')).map((l) => l.slice('[userprompt-dispatch] '.length));
}

// D8 rule: exactly one trip line, its id is a room.db check, and every later room.db check has room_db_no_wait.
function checkTripNotes(label, stderr) {
  const notes = dispatchNotes(stderr);
  const trips = notes.filter((n) => n.startsWith('room_db_busy_trip '));
  check(label + ' stderr holds exactly one room_db_busy_trip line', trips.length === 1, notes.join(' | '));
  if (trips.length !== 1) return;
  const tripId = trips[0].slice('room_db_busy_trip '.length).trim();
  check(label + ' the trip names an id of ROOM_DB_CHECKS (' + tripId + ')', d.ROOM_DB_CHECKS.includes(tripId), tripId);
  const order = d.CHECKS.map((c) => c.id);
  const after = order.slice(order.indexOf(tripId) + 1).filter((id) => d.ROOM_DB_CHECKS.includes(id));
  for (const id of after) check(label + ' room_db_no_wait ' + id + ' (after the trip)', notes.includes('room_db_no_wait ' + id), notes.join(' | '));
}

// ---------- fake checks for D4 and D5 ----------

function fakeCheck(id, run, budgetMs) {
  return { id, file: 'fake/' + id + '.cjs', argv: [], budgetMs, load: () => ({ run }) };
}
function ctxResult(text) {
  return { code: 0, stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: text } }), stderr: '' };
}

async function legD4() {
  const ran = [];
  const checks = [
    fakeCheck('fake-1', async () => { ran.push('fake-1'); return ctxResult('ctx-1'); }, 300),
    fakeCheck('fake-2', () => { ran.push('fake-2'); const end = Date.now() + 2600; while (Date.now() < end) { /* a synchronous loop */ } return ctxResult('ctx-2'); }, 2000),
    fakeCheck('fake-3', async () => { ran.push('fake-3'); return ctxResult('ctx-3'); }, 300),
    fakeCheck('fake-4', async () => { ran.push('fake-4'); return ctxResult('ctx-4'); }, 300),
    fakeCheck('fake-5', async () => { ran.push('fake-5'); return ctxResult('ctx-5'); }, 300),
    fakeCheck('fake-6', async () => { ran.push('fake-6'); return ctxResult('ctx-6'); }, 300),
  ];
  const t0 = Date.now();
  const r = await d.dispatch('{}', { checks, processStartMs: t0 });
  const ms = Date.now() - t0;
  console.log('INFO D4 dispatch resolved in ' + ms + ' ms');
  check('D4 check 2 ran (the leg is not a no-op)', ran.includes('fake-2'), ran.join(','));
  check('D4 over_deadline fake-2 on stderr', r.notes.includes('over_deadline fake-2'), r.notes.join(' | '));
  for (const id of ['fake-3', 'fake-4', 'fake-5', 'fake-6']) {
    check('D4 skipped_deadline ' + id + ' on stderr', r.notes.includes('skipped_deadline ' + id) && /skipped_deadline/.test(r.stderr), r.notes.join(' | '));
  }
  check('D4 checks 3 to 6 did not run', ['fake-3', 'fake-4', 'fake-5', 'fake-6'].every((id) => !ran.includes(id)), ran.join(','));
  check('D4 dispatch resolves within 3,000 ms of its start', ms <= HOOK_BUDGET_MS, 'ms=' + ms);
  const ctx = r.envelope && r.envelope.hookSpecificOutput ? r.envelope.hookSpecificOutput.additionalContext : '';
  check('D4 no output from the check over its deadline', !/ctx-2/.test(ctx || ''), String(ctx));
}

async function legD5() {
  const ran = [];
  const checks = [
    fakeCheck('fake-1', async () => { ran.push('fake-1'); return ctxResult('ctx-1'); }, 300),
    fakeCheck('fake-2', () => { ran.push('fake-2'); return new Promise(() => { /* never resolves */ }); }, 400),
    fakeCheck('fake-3', async () => { ran.push('fake-3'); return ctxResult('ctx-3'); }, 300),
  ];
  const t0 = Date.now();
  const r = await d.dispatch('{}', { checks, processStartMs: t0 });
  const ms = Date.now() - t0;
  console.log('INFO D5 dispatch resolved in ' + ms + ' ms');
  const ctx = r.envelope && r.envelope.hookSpecificOutput ? r.envelope.hookSpecificOutput.additionalContext : '';
  check('D5 over_deadline fake-2 on stderr', r.notes.includes('over_deadline fake-2') && /over_deadline fake-2/.test(r.stderr), r.notes.join(' | '));
  check('D5 no output from the never-resolving check', !/ctx-2/.test(ctx || ''), String(ctx));
  check('D5 check 3 runs and its context is in the envelope', ran.includes('fake-3') && /ctx-3/.test(ctx || ''), String(ctx));
  check('D5 dispatch resolves within 3,000 ms of its start', ms <= HOOK_BUDGET_MS, 'ms=' + ms);
}

async function main() {
  if (!d || typeof d.dispatch !== 'function') {
    console.log('FAILURES: ' + (failures + 1));
    process.exit(1);
  }

  // ---------- D4, D5 (in-process, fake checks) ----------
  await legD4();
  await legD5();

  // ---------- D6 (no lock) ----------
  const six = e5Fixture();
  const r6 = await runDispatcherTimed(six.fx, six.input, 20000);
  console.log('INFO D6 dispatcher measured ' + r6.ms + ' ms (code ' + r6.code + ')');
  check('D6 the dispatcher exits 0 within 3,000 ms with no lock', r6.code === 0 && r6.ms <= HOOK_BUDGET_MS, 'code=' + r6.code + ' ms=' + r6.ms + ' stderr=' + r6.stderr.slice(-300));
  check('D6 stderr holds no room_db_busy', !/room_db_busy/.test(r6.stderr), r6.stderr.slice(-300));
  check('D6 stderr holds no skipped_deadline', !/skipped_deadline/.test(r6.stderr), r6.stderr.slice(-300));
  const n6 = dispatchNotes(r6.stderr);
  check('D8 the D6 run holds no room_db_busy_trip and no room_db_no_wait', !n6.some((n) => /^room_db_(busy_trip|no_wait) /.test(n)), n6.join(' | '));
  six.fx.cleanup();

  // ---------- D1, D2, D3, D8 (10 s held lock) ----------
  const one = e5Fixture();
  quiesce(one.fx);
  const hashBefore = roomTreeHash(one.fx.roomDir);
  const countsBefore = JSON.stringify(rowCounts(one.fx.roomDir));
  const lock = await holdLock(one.fx.roomDir, LOCK_WINDOW_MS);
  let r1 = null;
  try {
    r1 = await runDispatcherTimed(one.fx, one.input, 9000);
  } finally {
    await stopChild(lock);
  }
  console.log('INFO D1 dispatcher measured ' + r1.ms + ' ms (code ' + r1.code + ')');
  check('D1 the dispatcher exits 0 within 3,000 ms of its spawn under a 10 s lock', r1.code === 0 && r1.ms <= HOOK_BUDGET_MS, 'code=' + r1.code + ' ms=' + r1.ms + ' stderr=' + r1.stderr.slice(-400));
  let ctx1 = '';
  try { const o = JSON.parse(r1.stdout); ctx1 = (o.hookSpecificOutput && o.hookSpecificOutput.additionalContext) || ''; } catch (_e) { ctx1 = ''; }
  check('D1 the navigation engine block of intent-classifier ran (case E5)', /NAVIGATION DECISION/.test(ctx1), ctx1.slice(0, 300));
  for (const id of DRAINS) {
    check('D2 room_db_busy for ' + id + ' (it reached its room.db open)', new RegExp('\\[' + id + '\\] room_db_busy').test(r1.stderr), r1.stderr.slice(-600));
  }
  checkTripNotes('D8 the D1 run', r1.stderr);
  quiesce(one.fx);
  const hashAfter = roomTreeHash(one.fx.roomDir);
  const countsAfter = JSON.stringify(rowCounts(one.fx.roomDir));
  check('D3 the room tree hash is unchanged after the lock holder exits', hashBefore === hashAfter);
  check('D3 the row counts are unchanged', countsBefore === countsAfter, countsBefore + ' vs ' + countsAfter);
  one.fx.cleanup();

  console.log(failures === 0 ? 'ALL PASS test-400.4-dispatch-budget' : 'FAILED ' + failures);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.log('FAIL test crashed: ' + (e && e.stack || e)); process.exit(1); });
