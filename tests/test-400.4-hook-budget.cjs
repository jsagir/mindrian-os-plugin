'use strict';
// Phase 400.4 plan 10 (QA-F11 part A): UserPromptSubmit hooks stay inside their host budget while room.db is locked.
// K1: auto-explore-drain, brain-derivation-drain, jtbd-update each exit 0 within 3,000 ms under a 10 s write lock.
// K2: each hook says room_db_busy on stderr.
// K3: the room tree and the row counts are unchanged after the hooks ran (nothing written).
// K4: with no lock each hook exits 0 and does not say room_db_busy.
// K5: intent-classifier.cjs exits 0 within 5,000 ms under the same lock and prints its normal output (plain text).
// Everything runs in an isolated HOME under the OS temp dir. Nothing touches ~/MindrianRooms.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const helpers = require(path.join(ROOT, 'tests/helpers/isolated-home-36925.cjs'));

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('PASS ' + name);
  else { failures++; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}

const LOCK_WINDOW_MS = 10000;
const HOOK_BUDGET_MS = 3000;
const CLASSIFIER_BUDGET_MS = 5000;

const HOOKS = [
  { name: 'auto-explore-drain', script: 'scripts/auto-explore-drain.cjs', args: [] },
  { name: 'brain-derivation-drain', script: 'scripts/brain-derivation-drain.cjs', args: [] },
  { name: 'jtbd-update', script: 'scripts/jtbd-update.cjs', args: ['userprompt'] },
];

const PROMPT = 'Who are my customers and what job do they hire this venture to do?';

// Tree hash of the room, skipping the WAL side files and the lock-holder's own scratch.
function roomTreeHash(roomDir) {
  const h = crypto.createHash('sha256');
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).sort((x, y) => (x.name < y.name ? -1 : 1)).forEach((e) => {
      if (e.name === 'room.db-wal' || e.name === 'room.db-shm') return;
      const p = path.join(d, e.name);
      const rel = path.relative(roomDir, p);
      if (e.isDirectory()) { h.update('D ' + rel + '\n'); walk(p); }
      else if (e.isFile()) h.update('F ' + rel + ' ' + crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') + '\n');
    });
  })(roomDir);
  return h.digest('hex');
}

function rowCounts(roomDir) {
  const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'), { readOnly: true });
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
    const out = {};
    for (const t of tables) {
      if (t === 'nodes' || t === 'edges' || /event/i.test(t)) {
        out[t] = db.prepare('SELECT COUNT(*) AS n FROM "' + t.replace(/"/g, '') + '"').get().n;
      }
    }
    return out;
  } finally { db.close(); }
}

function quiesce(roomDir) {
  // One open and close so any pending WAL frames reach room.db before the first hash.
  const nav = require(path.join(ROOT, 'lib/core/navigation.cjs'));
  const h = nav.openRoomDbForCaller(roomDir);
  if (h) nav.closeRoomDbForCaller(h);
}

function holdLock(roomDir, holdMs) {
  const dbPath = path.join(roomDir, '.mindrian', 'room.db');
  const code = [
    "const { DatabaseSync } = require('node:sqlite');",
    'const db = new DatabaseSync(process.argv[1], { timeout: 0 });',
    "db.exec('BEGIN IMMEDIATE');",
    "process.stdout.write('locked\\n');",
    'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Number(process.argv[2]));',
    "db.exec('ROLLBACK');",
    'db.close();',
  ].join('\n');
  const child = spawn(process.execPath, ['-e', code, dbPath, String(holdMs)], { stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise((resolve, reject) => {
    let buf = '';
    child.stdout.on('data', (d) => { buf += d.toString(); if (buf.includes('locked')) resolve(child); });
    child.on('error', reject);
    child.on('exit', () => { if (!buf.includes('locked')) reject(new Error('lock holder exited early')); });
  });
}

function stopChild(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.on('exit', () => resolve());
    child.kill('SIGKILL');
  });
}

// Run one hook as a child process; resolve {code, ms, stdout, stderr}. Kill it at killMs.
function runHook(scriptRel, args, env, cwd, stdinText, killMs) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const child = spawn(process.execPath, [path.join(ROOT, scriptRel)].concat(args), { env, cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    const killer = setTimeout(() => { try { child.kill('SIGKILL'); } catch (_e) { /* gone */ } }, killMs);
    child.on('exit', (code, sig) => {
      clearTimeout(killer);
      resolve({ code: code === null ? ('signal:' + sig) : code, ms: Date.now() - t0, stdout, stderr });
    });
    child.stdin.end(stdinText);
  });
}

function buildFixture() {
  const iso = helpers.mkIsolatedHome('hook-budget');
  const born = helpers.birthFixtureRoom({ iso, slug: 'hook-budget-room' });
  const roomDir = born.roomDir;
  // One pending auto-explore finding so auto-explore-drain gets past its cheap exits and reaches the lock gate.
  fs.writeFileSync(path.join(roomDir, '.mindrian', 'auto-explore-f400410.json'), JSON.stringify({
    id: 'f400410', material_id: 'm400410', source_section: 'market-analysis', file_path_sha256: 'a'.repeat(64),
  }));
  quiesce(roomDir);
  const env = Object.assign({}, iso.env, { MINDRIAN_ROOM_DIR: roomDir, CLAUDE_USER_MESSAGE: PROMPT });
  delete env.MINDRIAN_DISABLE_MEMORY_EVENT;
  return { iso, roomDir, env };
}

async function main() {
  const fx = buildFixture();
  const stdin = JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: PROMPT, session_id: 'test-400410' });

  // ---- K4 (no lock): the normal path still runs ----
  for (const hk of HOOKS) {
    const r = await runHook(hk.script, hk.args, fx.env, fx.roomDir, stdin, 20000);
    check('K4 ' + hk.name + ' exits 0 with no lock', r.code === 0, 'code=' + r.code + ' stderr=' + r.stderr.slice(-300));
    check('K4 ' + hk.name + ' does not say room_db_busy with no lock', !/room_db_busy/.test(r.stderr), r.stderr.slice(-300));
  }

  // Reset the pending finding (the K4 run may have marked it surfaced), then quiesce for the K3 baseline.
  const ledgerDir = path.join(fx.iso.home);
  void ledgerDir;
  fs.writeFileSync(path.join(fx.roomDir, '.mindrian', 'auto-explore-f400410.json'), JSON.stringify({
    id: 'f400410', material_id: 'm400410b', source_section: 'market-analysis', file_path_sha256: 'b'.repeat(64),
  }));
  quiesce(fx.roomDir);
  const hashBefore = roomTreeHash(fx.roomDir);
  const countsBefore = JSON.stringify(rowCounts(fx.roomDir));

  // ---- K1, K2 (10 s lock): three hooks in parallel ----
  const lock = await holdLock(fx.roomDir, LOCK_WINDOW_MS);
  let results = [];
  try {
    results = await Promise.all(HOOKS.map((hk) => runHook(hk.script, hk.args, fx.env, fx.roomDir, stdin, 9000)));
    for (let i = 0; i < HOOKS.length; i++) {
      const hk = HOOKS[i]; const r = results[i];
      console.log('INFO ' + hk.name + ' measured ' + r.ms + ' ms (code ' + r.code + ')');
      check('K1 ' + hk.name + ' exits 0 within ' + HOOK_BUDGET_MS + ' ms under a ' + (LOCK_WINDOW_MS / 1000) + ' s lock',
        r.code === 0 && r.ms <= HOOK_BUDGET_MS, 'code=' + r.code + ' ms=' + r.ms + ' stderr=' + r.stderr.slice(-300));
      check('K2 ' + hk.name + ' says room_db_busy on stderr', /room_db_busy/.test(r.stderr), r.stderr.slice(-300));
    }

    // K3 snapshot: taken after the three writing hooks gave up and BEFORE intent-classifier runs (the classifier
    // writes its own decision trace files into the room, which is not a room.db write and not part of K3).
    var hashMid = roomTreeHash(fx.roomDir);
    var countsMid = JSON.stringify(rowCounts(fx.roomDir));

    // ---- K5: intent-classifier.cjs under the same lock ----
    const ic = await runHook('scripts/intent-classifier.cjs', [], fx.env, fx.roomDir, stdin, 9000);
    console.log('INFO intent-classifier measured ' + ic.ms + ' ms (code ' + ic.code + ')');
    check('K5 intent-classifier exits 0 within ' + CLASSIFIER_BUDGET_MS + ' ms under the lock',
      ic.code === 0 && ic.ms <= CLASSIFIER_BUDGET_MS, 'code=' + ic.code + ' ms=' + ic.ms + ' stderr=' + ic.stderr.slice(-300));
    // The classifier prints plain additionalContext text (the voice reminder first), not a JSON envelope.
    check('K5 intent-classifier prints its normal output on stdout (the voice reminder)', /^Voice reminder:/.test(ic.stdout), 'stdout=' + ic.stdout.slice(0, 200));
  } finally {
    await stopChild(lock);
  }

  // ---- K3: nothing written ----
  check('K3 room tree hash is unchanged after the hooks gave up', hashBefore === hashMid);
  check('K3 row counts of nodes, edges and event tables are unchanged', countsBefore === countsMid, countsBefore + ' vs ' + countsMid);

  fx.iso.cleanup();
  console.log(failures === 0 ? 'ALL PASS test-400.4-hook-budget' : 'FAILED ' + failures);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.log('FAIL test crashed: ' + (e && e.stack || e)); process.exit(1); });
