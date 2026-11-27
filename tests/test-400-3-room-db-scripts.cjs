#!/usr/bin/env node
'use strict';
/*
 * Phase 400.3 plan 06c: the room.db scripts wait once per run, not once per write, and the write lock hold of a run
 * is measured and bounded.
 *
 * Covered: review B-b (one wait per run, atomic), M3 (blocks 1 and 2 keep the null-handle path), M4 (the lock hold
 * is measured on about 320 memory files, bound 750 ms), V8 (the memory hook had no busy timeout), D-10 (no script
 * fills a 0-byte room.db), D-11 (bounded busy wait in a hook).
 *
 * Canon Part 8: fixture rooms only under mkdtemp roots; HOME and MINDRIAN_ROOMS_HOME inside them; no network.
 * Do not put a table-creation SQL statement in this file (the Phase 108 schema-drift pre-commit guard).
 * Native Windows is UNMEASURED.
 *
 * Groups: memory (K1-K6), feynman (F1-F7).
 * Usage: node tests/test-400-3-room-db-scripts.cjs [memory|feynman|all]   (default all)
 *
 * Node built-ins only. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork, spawn, spawnSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const DB_LOCK_HOLDER = path.join(__dirname, 'helpers', 'room-db-lock-holder-236.cjs');
const HOLDER_MODE = 'BEGIN IMMEDIATE + write';
const HOOK = path.join(ROOT, 'scripts', 'memory-artifact-graph-hook.cjs');
const RECONCILE = path.join(ROOT, 'scripts', 'session-start-reconcile.cjs');
const TIMELINE_CMD = path.join(ROOT, 'scripts', 'feynman-timeline-refresh-command.cjs');
const DIAL_CMD = path.join(ROOT, 'scripts', 'dial-memory-refresh-command.cjs');

const GROUP = process.argv[2] || 'all';
if (['memory', 'feynman', 'all'].indexOf(GROUP) === -1) {
  console.error('usage: node tests/test-400-3-room-db-scripts.cjs [memory|feynman|all]');
  process.exit(2);
}

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log('PASS: ' + label); }
  else { failed += 1; console.log('FAIL: ' + label + (detail !== undefined ? ' :: ' + detail : '')); }
}

const ROOTS = [];
process.on('exit', () => {
  for (const r of ROOTS) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
});
function msNow() { return Number(process.hrtime.bigint()) / 1e6; }

const { openRoomDb, closeRoomDb } = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
const timelineRunner = require(path.join(ROOT, 'lib', 'core', 'feynman', 'timeline-runner.cjs'));
const dialMemory = require(path.join(ROOT, 'lib', 'core', 'feynman', 'dial-memory-renderer.cjs'));
const roomBirth = require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-birth.cjs'));

// The seeded FEYNMAN.md shape of tests/test-363.1-placeholder-gt.cjs (seededFeynman).
function seededFeynman(slug) {
  const seed = String(roomBirth.FEYNMAN_BIRTH_SEED_TEMPLATE).replace(/\{\{SECTION_SLUG\}\}/g, slug);
  return [
    '---', 'timeline_last_rendered: 2026-09-29T16:10:46Z', 'dial_memory_last_rendered: 2026-09-29T16:10:47Z', '---',
    '# ' + slug, '', seed.replace(/^# .*\n\n?/, ''), '',
    timelineRunner.HEADER, '', timelineRunner.SENTINEL_START, '*No timeline events yet.*', timelineRunner.SENTINEL_END, '',
    dialMemory.HEADER, '', dialMemory.SENTINEL_START, '*Last refreshed: 2026-09-29T16:10:47Z. No dial activity yet.*', '',
    '**Available reaches** (6):', '- context_block', '- contradiction', '- cross_room', '- brain_consult', '- deep_research', '- hats', '',
    '**Last selected:** none yet.', '',
    '**Current recommended:** none (Brain-gated marker is a mode_a concept; current tier tier_0).', '',
    '**Recent research conclusions:**', '- no recent research conclusions', dialMemory.SENTINEL_END, '',
  ].join('\n');
}

// Fixture K (13 memory files) or fixture L (100 sections, 20 FEYNMAN.md). db: 'real' | 'zero' | 'none'.
function mkFixture(label, opts) {
  const o = opts || {};
  const top = fs.mkdtempSync(path.join(os.tmpdir(), '4003-06c-' + label + '-'));
  ROOTS.push(top);
  const home = path.join(top, 'home');
  const roomsHome = path.join(home, 'MindrianRooms');
  const name = o.name || 'k1';
  const R = path.join(roomsHome, name);
  fs.mkdirSync(path.join(roomsHome, '.rooms'), { recursive: true });
  fs.writeFileSync(path.join(roomsHome, '.rooms', 'registry.json'), JSON.stringify({ active: name, rooms: { [name]: { path: name } } }));
  fs.mkdirSync(R, { recursive: true });
  fs.writeFileSync(path.join(R, '.room-root'), '');
  fs.writeFileSync(path.join(R, 'ROOM.md'), '---\ntitle: K1 Room\n---\n# K1 Room\n');
  fs.writeFileSync(path.join(R, 'STATE.md'), '# State\n');
  fs.writeFileSync(path.join(R, 'USER.md'), '---\nrole_blend: researcher\njourney_stage: explore\n---\n# User\n');
  const sections = o.large ? Array.from({ length: 100 }, (_, i) => 'b' + String(i).padStart(3, '0')) : ['s1', 's2', 's3'];
  sections.forEach((s, i) => {
    fs.mkdirSync(path.join(R, s), { recursive: true });
    fs.writeFileSync(path.join(R, s, 'ROOM.md'), '# ' + s + '\n');
    fs.writeFileSync(path.join(R, s, 'STATE.md'), '# State ' + s + '\n');
    fs.writeFileSync(path.join(R, s, 'MINTO.md'), '---\ngoverning_thought: ' + s + ' thought\n---\n# MINTO ' + s + '\n');
    if ((o.large && i < 20) || (!o.large && s === 's1')) fs.writeFileSync(path.join(R, s, 'FEYNMAN.md'), seededFeynman(s));
  });
  const aDir = path.join(R, '.planning', 'phases', '777-alpha');
  fs.mkdirSync(aDir, { recursive: true });
  fs.writeFileSync(path.join(aDir, '777-SPEC.md'), '# Alpha Spec\n\n## Requirements\n\n1. **ALP-01**: one\n2. **ALP-02**: two\n');
  fs.writeFileSync(path.join(aDir, '777-01-PLAN.md'), '---\nphase: 777-alpha\nplan: 01\nrequirements: [ALP-01]\n---\n\n# Alpha Plan\n');
  const db = o.db || 'real';
  if (db === 'real') closeRoomDb(openRoomDb(R));
  else if (db === 'zero') { fs.mkdirSync(path.join(R, '.mindrian'), { recursive: true }); fs.writeFileSync(path.join(R, '.mindrian', 'room.db'), ''); }
  return { top, home, roomsHome, R };
}
function dbPathOf(R) { return path.join(R, '.mindrian', 'room.db'); }
function sizeOf(p) { try { return fs.statSync(p).size; } catch (_e) { return -1; } }
function countBy(R, table) {
  const db = new DatabaseSync(dbPathOf(R), { readOnly: true });
  try { const o = {}; for (const r of db.prepare('SELECT type, COUNT(*) AS n FROM ' + table + ' GROUP BY type').all()) o[r.type] = r.n; return o; }
  finally { db.close(); }
}
function total(o) { return Object.keys(o).reduce((a, k) => a + o[k], 0); }
function memoryNodes(R) { return countBy(R, 'nodes').memory_artifact || 0; }
function envFor(fx, extra) {
  const env = Object.assign({}, process.env, { HOME: fx.home, USERPROFILE: fx.home, MINDRIAN_ROOMS_HOME: fx.roomsHome, MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9' }, extra || {});
  for (const k of ['CLAUDE_ROOM_DIR', 'ROOM_DIR', 'CLAUDE_PLUGIN_ROOT', 'MINDRIAN_ROOMS_ROOT']) delete env[k];
  return env;
}

function startHolder(room, holdMs, mode) {
  return new Promise((resolve, reject) => {
    const args = [room];
    if (holdMs) { args.push(String(holdMs)); args.push(mode || 'rollback'); }
    const child = fork(DB_LOCK_HOLDER, args, { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    child.on('error', () => { /* the holder is gone */ });
    let settled = false;
    child.on('message', (msg) => {
      if (settled || !msg || !msg.ready) return;
      settled = true;
      if (msg.mode !== HOLDER_MODE) { try { child.kill(); } catch (_e) { /* gone */ } reject(new Error('holder mode ' + JSON.stringify(msg.mode))); return; }
      resolve({ child });
    });
    child.on('exit', (code) => { if (!settled) { settled = true; reject(new Error('holder exited ' + code + ' before ready')); } });
  });
}
function stopHolder(h) {
  return new Promise((resolve) => {
    if (!h || !h.child || h.child.exitCode !== null || h.child.signalCode !== null) return resolve();
    h.child.once('exit', () => resolve());
    try { h.child.send('release', (err) => { if (err) { try { h.child.kill(); } catch (_e) { /* gone */ } } }); }
    catch (_e) { try { h.child.kill(); } catch (_e2) { resolve(); } }
  });
}

// The prober: a child with a raw handle of busy timeout 0 that runs BEGIN IMMEDIATE then ROLLBACK every 5 ms and
// reports the longest run of consecutive busy results in ms (the longest time another writer was shut out).
const PROBER_CODE = [
  "const { DatabaseSync } = require('node:sqlite');",
  'const db = new DatabaseSync(process.argv[1], { timeout: 0 });',
  'let busySince = null; let longest = 0; let probes = 0;',
  'const now = () => Number(process.hrtime.bigint()) / 1e6;',
  'const t = setInterval(() => {',
  '  probes += 1;',
  "  try { db.exec('BEGIN IMMEDIATE'); db.exec('ROLLBACK'); if (busySince !== null) { longest = Math.max(longest, now() - busySince); busySince = null; } }",
  '  catch (_e) { if (busySince === null) busySince = now(); }',
  '}, 5);',
  "process.on('message', () => { clearInterval(t); if (busySince !== null) longest = Math.max(longest, now() - busySince); process.send({ longest, probes }); db.close(); process.exit(0); });",
  "process.send({ ready: true });",
].join('\n');
function startProber(R) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', PROBER_CODE, dbPathOf(R)], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    child.once('message', (m) => { if (m && m.ready) resolve(child); else reject(new Error('prober not ready')); });
    child.on('exit', (c) => reject(new Error('prober exited ' + c)));
  });
}
function stopProber(child) {
  return new Promise((resolve) => { child.once('message', (m) => resolve(m)); child.send('stop'); });
}
function yieldMs(ms) { return new Promise((r) => setTimeout(r, ms)); }

function spawnHook(fx, file) {
  const t0 = msNow();
  const r = spawnSync(process.execPath, [HOOK], {
    cwd: fx.R, env: envFor(fx, { CLAUDE_ACTIVE_ROOM: fx.R }), encoding: 'utf8', timeout: 60000,
    input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: file || path.join(fx.R, 's1', 'MINTO.md') } }),
  });
  return { status: r.status, stderr: String(r.stderr || ''), stdout: String(r.stdout || ''), ms: msNow() - t0 };
}

// ---------------------------------------------------------------------------
// Group memory (K1-K6)
// ---------------------------------------------------------------------------
async function groupMemory() {
  console.log('\n-- group memory --');
  const hookMod = require(HOOK);
  const reconcileRoom = typeof hookMod.reconcileRoom === 'function' ? hookMod.reconcileRoom : null;

  // K1
  {
    const fx = mkFixture('k1');
    let h = null;
    try {
      h = await startHolder(fx.R);
      const r = spawnHook(fx);
      check('K1 the memory hook under a held write: exit 0 in less than 2500 ms with room_db_busy on stderr (measured ' + r.ms.toFixed(0) + ' ms)',
        r.status === 0 && r.ms < 2500 && r.stderr.indexOf('room_db_busy') !== -1, JSON.stringify({ status: r.status, stderr: r.stderr.slice(-300) }));
    } catch (e) { check('K1 fixture', false, e.message); }
    await stopHolder(h);
  }

  // K2
  {
    const fx = mkFixture('k2');
    let h = null;
    try {
      if (!reconcileRoom) throw new Error('reconcileRoom is not exported');
      h = await startHolder(fx.R, 300, 'commit');
      const t0 = msNow();
      const res = reconcileRoom(fx.R, { busyMs: 750 });
      const ms = msNow() - t0;
      await stopHolder(h); h = null;
      const n = memoryNodes(fx.R);
      check('K2 a 300 ms foreign write is waited out: reconcileRoom ok after 150 ms or more, 13 memory_artifact nodes (measured ' + ms.toFixed(0) + ' ms)',
        !!res && res.ok === true && ms >= 150 && n === 13, JSON.stringify({ res: res && { ok: res.ok, reason: res.reason }, n }));
    } catch (e) { check('K2 fixture', false, e.message); }
    await stopHolder(h);
  }

  // K3
  {
    const fx = mkFixture('k3', { db: 'zero' });
    const r = spawnHook(fx);
    check('K3 a 0-byte room.db: the hook exits 0 with an empty stderr and room.db stays 0 bytes',
      r.status === 0 && r.stderr.trim() === '' && sizeOf(dbPathOf(fx.R)) === 0, JSON.stringify({ status: r.status, stderr: r.stderr.slice(-200), size: sizeOf(dbPathOf(fx.R)) }));
  }

  // K4
  {
    const a = mkFixture('k4a');
    const b = mkFixture('k4b');
    let err = null;
    try {
      if (!reconcileRoom) throw new Error('reconcileRoom is not exported');
      const ra = reconcileRoom(a.R, {});
      if (!ra || ra.ok !== true) throw new Error('copy A reconcile: ' + JSON.stringify(ra && { ok: ra.ok, reason: ra.reason, detail: ra.detail }));
      const runner = require(path.join(ROOT, 'lib', 'core', 'memory', 'reconcile-memory-runner.cjs'));
      const raw = new DatabaseSync(dbPathOf(b.R), { timeout: 5000 });
      try { runner.reconcileMemoryArtifacts(b.R, { db: raw }); } finally { raw.close(); }
    } catch (e) { err = e; }
    const na = err ? {} : countBy(a.R, 'nodes'); const nb = err ? {} : countBy(b.R, 'nodes');
    const ea = err ? {} : countBy(a.R, 'edges'); const eb = err ? {} : countBy(b.R, 'edges');
    check('K4 equivalence: reconcileRoom in one transaction gives the node and edge counts of the BASE auto-commit run',
      !err && JSON.stringify(na) === JSON.stringify(nb) && JSON.stringify(ea) === JSON.stringify(eb) && total(na) > 0,
      (err ? err.message : '') + ' ' + JSON.stringify({ na, nb, ea, eb }));
  }

  // K5
  {
    const fx = mkFixture('k5');
    let h = null;
    try {
      if (!reconcileRoom) throw new Error('reconcileRoom is not exported');
      const before = total(countBy(fx.R, 'nodes'));
      h = await startHolder(fx.R);
      const t0 = msNow();
      const res = reconcileRoom(fx.R, { busyMs: 300 });
      const ms = msNow() - t0;
      await stopHolder(h); h = null;
      const after = total(countBy(fx.R, 'nodes'));
      check('K5 a held write: reconcileRoom gives room_db_busy after 250-1000 ms and writes nothing (measured ' + ms.toFixed(0) + ' ms)',
        !!res && res.ok === false && res.reason === 'room_db_busy' && ms >= 250 && ms < 1000 && after === before,
        JSON.stringify({ res: res && { ok: res.ok, reason: res.reason }, before, after }));
    } catch (e) { check('K5 fixture', false, e.message); }
    await stopHolder(h);
  }

  // K6
  {
    const fx = mkFixture('k6', { large: true });
    let p = null;
    try {
      if (!reconcileRoom) throw new Error('reconcileRoom is not exported');
      p = await startProber(fx.R);
      await yieldMs(50);
      const t0 = msNow();
      const resP = new Promise((resolve) => setImmediate(() => resolve(reconcileRoom(fx.R, { busyMs: 750 }))));
      const res = await resP;
      const wall = msNow() - t0;
      await yieldMs(50);
      const pr = await stopProber(p); p = null;
      console.log('400.3-06c memory reconcile hold ms (Linux, 320 files): hold=' + pr.longest.toFixed(0) + ' total=' + wall.toFixed(0));
      check('K6 the memory reconcile of fixture L holds the write lock less than 750 ms (hold ' + pr.longest.toFixed(0) + ' ms)',
        !!res && res.ok === true && pr.longest < 750 && pr.probes > 0, JSON.stringify({ res: res && { ok: res.ok, reason: res.reason }, pr }));
    } catch (e) { check('K6 fixture', false, e.message); }
    if (p) { try { p.kill(); } catch (_e) { /* gone */ } }
  }
}

async function main() {
  if (GROUP === 'memory' || GROUP === 'all') await groupMemory();
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error('FAIL: harness error ' + (e && e.stack || e)); process.exit(1); });
