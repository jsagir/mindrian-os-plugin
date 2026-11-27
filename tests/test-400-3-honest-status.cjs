#!/usr/bin/env node
'use strict';
/*
 * Phase 400.3 plan 03: the cascade status and the artifact_file refusal say what really happened.
 *
 * Covered: OR-6 (the word partial; room_db_busy, not no_room_db; the words agree with plans 01 and 02), OA-2 (the 2
 * legacy faults show as partial until plan 400.3-03b), D-07 (honest advisory words), V4, V13, review M-8 (the typed
 * graph-index reason).
 *
 * Canon Part 8: fixture rooms only under mkdtemp roots; MINDRIAN_BRAIN_URL points at a closed loopback port.
 * Native Windows is UNMEASURED.
 *
 * Groups: hook (S1-S8), mcp (M1-M5).
 * Usage: node tests/test-400-3-honest-status.cjs [hook|mcp|all]   (default all)
 *
 * Node built-ins only. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const REAL_SCRIPTS = path.join(ROOT, 'scripts');
const WRITE_LOCK_HOLDER = path.join(__dirname, 'helpers', 'write-lock-holder-354.cjs');
const DB_LOCK_HOLDER = path.join(__dirname, 'helpers', 'room-db-lock-holder-236.cjs');

const GROUP = process.argv[2] || 'all';
if (['hook', 'mcp', 'all'].indexOf(GROUP) === -1) {
  console.error('usage: node tests/test-400-3-honest-status.cjs [hook|mcp|all]');
  process.exit(2);
}

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log('PASS: ' + label); }
  else { failed += 1; console.log('FAIL: ' + label + (detail !== undefined ? ' :: ' + detail : '')); }
}
let knownOpen = 0;
function known(label, detail) { knownOpen += 1; console.log('KNOWN-OPEN: ' + label + (detail !== undefined ? ' :: ' + detail : '')); }

const ROOTS = [];
process.on('exit', () => {
  for (const r of ROOTS) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
});
function mkW(label) {
  const w = fs.mkdtempSync(path.join(os.tmpdir(), '4003-03-' + label + '-'));
  if (/\/rooms?\//.test(w + '/')) { console.log('FAIL: TMPDIR holds a room segment: ' + w); process.exit(1); }
  ROOTS.push(w);
  return w;
}
function msNow() { return Number(process.hrtime.bigint()) / 1e6; }
function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

// The temp plugin tree idiom of tests/test-384-s2-post-write-skip.cjs: a copy of post-write, a mindrian-tools.cjs
// stub (fixed JSON, or a tee to the real script), and logger stubs for the background helpers.
// The room is a /rooms/ room with .room-root, STATE.md, sec/ROOM.md and sec/a.md.
function setup(label, tools) {
  const W = mkW(label);
  const data = path.join(W, 'data');
  const logs = path.join(data, 'logs');
  const home = path.join(data, 'home');
  const scripts = path.join(W, 'meta', 'plugin', 'scripts');
  for (const d of [logs, home, scripts]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(scripts, 'post-write'), fs.readFileSync(path.join(REAL_SCRIPTS, 'post-write'), 'utf8'), { mode: 0o755 });
  let body;
  if (tools.tee) {
    body = '#!/usr/bin/env node\n' +
      'const r = require("child_process").spawnSync(process.execPath, [' + JSON.stringify(path.join(REAL_SCRIPTS, 'mindrian-tools.cjs')) + '].concat(process.argv.slice(2)), { encoding: "utf8", maxBuffer: 1 << 26 });\n' +
      'require("fs").writeFileSync(' + JSON.stringify(path.join(logs, 'cascade-out.json')) + ', r.stdout || "");\n' +
      'process.stdout.write(r.stdout || "");\n';
  } else {
    body = '#!/usr/bin/env node\nprocess.stdout.write(' + JSON.stringify(JSON.stringify(tools.json)) + ');\n';
  }
  fs.writeFileSync(path.join(scripts, 'mindrian-tools.cjs'), body, { mode: 0o755 });
  const logger = (name) => '#!/usr/bin/env node\nrequire("fs").appendFileSync(' + JSON.stringify(path.join(logs, name + '.log')) + ', JSON.stringify(process.argv.slice(2)) + "\\n");\n';
  for (const n of ['stamp-artifact-write', 'minto-debouncer', 'recompile-room-references']) fs.writeFileSync(path.join(scripts, n + '.cjs'), logger(n), { mode: 0o755 });
  fs.writeFileSync(path.join(scripts, 'track-analytics'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(scripts, 'resolve-room'), '#!/usr/bin/env bash\nexit 1\n', { mode: 0o755 });
  const roomDir = path.join(data, 'rooms', 'r1');
  fs.mkdirSync(path.join(roomDir, 'sec'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'STATE.md'), '# state\n');
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.writeFileSync(path.join(roomDir, 'sec', 'ROOM.md'), '# section\n');
  fs.writeFileSync(path.join(roomDir, 'sec', 'a.md'), '---\ntitle: A note\n---\n\n# A note\n\nOne prose line.\n');
  fs.writeFileSync(path.join(roomDir, 'a.md'), '# root artifact\n');
  return { W, data, logs, home, scripts, roomDir };
}
function runPostWrite(fx, file) {
  const payload = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: file }, session_id: 'sess-4003-03' });
  const env = { PATH: process.env.PATH, HOME: fx.home, USERPROFILE: fx.home, MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9', LANG: 'C', MOS_NO_DETACHED_DERIVE: '1' };
  const r = spawnSync('bash', [path.join(fx.scripts, 'post-write')], { cwd: fx.home, env, input: payload, encoding: 'utf8', timeout: 120000 });
  sleep(1500);
  let advisory = null;
  try { advisory = JSON.parse(String(r.stdout).trim()).hookSpecificOutput.additionalContext; } catch (_e) { advisory = null; }
  let side = null;
  try { side = JSON.parse(fs.readFileSync(path.join(fx.roomDir, '.mindrian', 'last-cascade.json'), 'utf8')); } catch (_e) { side = null; }
  return { status: r.status, advisory, side, stdout: String(r.stdout || '') };
}
const SEC = (fx) => path.join(fx.roomDir, 'sec', 'a.md');
const QUEUED = 'queued MINTO regen for sec, recompiled references (a.md)';

// The step names of the partial advisory (the map of plan 400.3-03 Task 1 Step 4).
const STEP_NAMES = {
  graphIndex: 'graph-index', classification: 'classify', gitCommit: 'git-commit', artifactId: 'artifact-id',
  deriveEnqueue: 'derive-enqueue', hsiBridge: 'hsi-bridge', computeState: 'compute-state', buildGraph: 'build-graph',
  proactiveIntelligence: 'analyze-room', opportunityExtraction: 'opportunity-extraction', binaryAsset: 'file-asset',
};
function expectedSteps(out) {
  const failedKeys = Object.keys(out).filter((k) => out[k] && typeof out[k] === 'object' && !Array.isArray(out[k]) && out[k].status === 'error');
  const ordered = failedKeys.indexOf('graphIndex') !== -1 ? ['graphIndex'].concat(failedKeys.filter((k) => k !== 'graphIndex')) : failedKeys;
  const names = ordered.map((k) => (k === 'graphIndex' && typeof out.graphIndex.reason === 'string') ? 'graph-index (' + out.graphIndex.reason + ')' : (STEP_NAMES[k] || k));
  if (names.length <= 3) return { any: names.length > 0, text: names.join(', ') };
  return { any: true, text: names.slice(0, 3).join(', ') + ' and ' + (names.length - 3) + ' more' };
}

// ---------------------------------------------------------------------------
// Group hook (S1-S8)
// ---------------------------------------------------------------------------
async function groupHook() {
  console.log('\n-- group hook --');
  if (spawnSync('bash', ['-c', 'command -v jq'], { encoding: 'utf8' }).status !== 0) { check('hook group needs jq on PATH', false); return; }

  // S1
  {
    const fx = setup('s1', { json: { skipped: false, classification: { type: 'insight' }, graphIndex: { status: 'ok' }, gitCommit: { status: 'error', message: 'x' } } });
    const r = runPostWrite(fx, SEC(fx));
    check('S1 a failed git-commit: cascade_status partial and the section partial advisory',
      !!r.side && r.side.cascade_status === 'partial' && r.advisory === QUEUED + '; cascade partial: git-commit failed', JSON.stringify({ advisory: r.advisory, status: r.side && r.side.cascade_status }));
  }
  // S2
  {
    const fx = setup('s2', { json: { skipped: false, hsi: { status: 'error' }, graphIndex: { status: 'error', reason: 'room_db_busy', message: 'database is locked' } } });
    const r = runPostWrite(fx, SEC(fx));
    check('S2 graph-index first with its typed reason',
      r.advisory === QUEUED + '; cascade partial: graph-index (room_db_busy), hsi failed', JSON.stringify(r.advisory));
  }
  // S3
  {
    const fx = setup('s3', { json: { skipped: false, classification: { type: 'insight' }, graphIndex: { status: 'error' }, gitCommit: { status: 'error' }, artifactId: { status: 'error' }, hsi: { status: 'error' }, buildGraph: { status: 'error' } } });
    const r = runPostWrite(fx, SEC(fx));
    check('S3 at most 3 names, then "and <n> more"',
      r.advisory === QUEUED + '; cascade partial: graph-index, git-commit, artifact-id and 2 more failed', JSON.stringify(r.advisory));
  }
  // S4
  {
    const fx = setup('s4', { json: { skipped: false, gitCommit: { status: 'error' } } });
    const r = runPostWrite(fx, path.join(fx.roomDir, 'a.md'));
    check('S4 outside a section: the honest partial status line',
      r.advisory === 'post-write: cascade partial for a.md (git-commit failed)', JSON.stringify(r.advisory));
  }
  // S5
  {
    const STUB = { skipped: false, classification: { type: 'insight', confidence: 0.9 }, gitCommit: { committed: true, hash: 'abc1234' }, graphIndex: { nodes: 3 }, proactiveIntelligence: { items: [{ kind: 'gap', text: 'fixed' }] } };
    const fx = setup('s5', { json: STUB });
    const r = runPostWrite(fx, SEC(fx));
    check('S5 no failed step: cascade_status complete and the BASE advisory',
      !!r.side && r.side.cascade_status === 'complete' && r.advisory === QUEUED, JSON.stringify({ advisory: r.advisory, status: r.side && r.side.cascade_status }));
  }
  // S6
  {
    const fxa = setup('s6a2', { json: { skipped: true, skipReason: 'x', gitCommit: { status: 'error' } } });
    const ra = runPostWrite(fxa, SEC(fxa));
    const fxb = setup('s6b', { json: { error: 'boom' } });
    const rb = runPostWrite(fxb, SEC(fxb));
    const fxc = setup('s6c', { json: { mode: 'index-only', graphIndex: { status: 'error', reason: 'write_lock_held' } } });
    const rc = runPostWrite(fxc, SEC(fxc));
    check('S6 skipped wins, an error key is failed, and the index-only words are unchanged',
      !!ra.side && ra.side.cascade_status === 'skipped' && !!rb.side && rb.side.cascade_status === 'failed' && !!rc.side && rc.side.cascade_status === 'index_failed',
      JSON.stringify([ra.side && ra.side.cascade_status, rb.side && rb.side.cascade_status, rc.side && rc.side.cascade_status]));
  }
  // S7
  {
    const fx = setup('s7', { tee: true });
    const r = runPostWrite(fx, SEC(fx));
    let out = null;
    try { out = JSON.parse(fs.readFileSync(path.join(fx.logs, 'cascade-out.json'), 'utf8')); } catch (_e) { out = null; }
    const exp = out ? expectedSteps(out) : null;
    const word = exp && exp.any ? 'partial' : 'complete';
    const advOk = !exp ? false : (exp.any ? r.advisory === QUEUED + '; cascade partial: ' + exp.text + ' failed' : r.advisory === QUEUED);
    console.log('400.3-03 S7 real cascade: word ' + word + (exp && exp.any ? ', failed steps: ' + exp.text : ''));
    check('S7 the real cascade: last-cascade.json holds the word of its own output and the advisory names its failed steps',
      !!out && !!r.side && r.side.cascade_status === word && advOk, JSON.stringify({ word, advisory: r.advisory, status: r.side && r.side.cascade_status }));
  }
  // S8
  {
    const W = mkW('s8');
    const home = path.join(W, 'home');
    fs.mkdirSync(home, { recursive: true });
    const roomDir = path.join(W, 'rooms', 'r8');
    fs.mkdirSync(path.join(roomDir, 'sec'), { recursive: true });
    fs.writeFileSync(path.join(roomDir, 'STATE.md'), '# state\n');
    fs.writeFileSync(path.join(roomDir, '.room-root'), '');
    fs.writeFileSync(path.join(roomDir, 'sec', 'ROOM.md'), '# section\n');
    fs.writeFileSync(path.join(roomDir, 'sec', 'a.md'), '# A note\n\nOne prose line.\n');
    const KEYS = ['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_BRAIN_URL', 'MOS_NO_DETACHED_DERIVE', 'CLAUDE_ACTIVE_ROOM', 'CLAUDE_ROOM_DIR'];
    const SAVED = {};
    for (const k of KEYS) SAVED[k] = process.env[k];
    Object.assign(process.env, { HOME: home, USERPROFILE: home, MINDRIAN_ROOMS_HOME: path.join(home, 'MindrianRooms'), MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9', MOS_NO_DETACHED_DERIVE: '1' });
    delete process.env.CLAUDE_ACTIVE_ROOM; delete process.env.CLAUDE_ROOM_DIR;
    let h = null;
    try {
      h = await new Promise((resolve, reject) => {
        const child = fork(WRITE_LOCK_HOLDER, [roomDir, 'hold', '8000'], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
        child.on('error', () => {});
        let settled = false;
        child.on('message', (m) => { if (settled) return; if (m && m.acquired) { settled = true; resolve({ child }); } else if (m && m.error) { settled = true; reject(new Error(m.error)); } });
        child.on('exit', (c) => { if (!settled) { settled = true; reject(new Error('write-lock holder exited ' + c)); } });
      });
      const cascade = require(path.join(ROOT, 'lib', 'core', 'intelligence-cascade.cjs'));
      const res = await cascade.runCascade(roomDir, { trigger: 'cli-hook', filePath: path.join(roomDir, 'sec', 'a.md') });
      check('S8 legacy Step 2 under a held write.lock: graphIndex error with reason write_lock_held',
        !!res.graphIndex && res.graphIndex.status === 'error' && res.graphIndex.reason === 'write_lock_held', JSON.stringify(res.graphIndex));
    } catch (e) { check('S8 fixture', false, e.message); }
    finally { for (const k of KEYS) { if (SAVED[k] === undefined) delete process.env[k]; else process.env[k] = SAVED[k]; } }
    if (h && h.child.exitCode === null) await new Promise((r) => { h.child.once('exit', r); try { h.child.kill(); } catch (_e) { r(); } });
  }
}

async function main() {
  if (GROUP === 'hook' || GROUP === 'all') await groupHook();
  console.log('\n' + passed + ' passed, ' + failed + ' failed, ' + knownOpen + ' known-open');
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error('FAIL: harness error ' + (e && e.stack || e)); process.exit(1); });
