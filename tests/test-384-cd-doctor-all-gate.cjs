#!/usr/bin/env node
'use strict';
/**
 * Phase 384 plan 19 (PERF384-F08, carry-over C-D, owner answer SPLIT of 2026-11-06).
 *
 * Gate for the doctor-all acceptance point of scripts/doctor.cjs.
 *
 *   parity    P1 clean fixture gives ok true and finding null.
 *             P2 a registered room with no .room-root is NOT counted as drift (the drift count is
 *                deferred by the owner): the point stays ok true. Passes before and after the port.
 *   mechanism M1 a timeout is named in the finding with the limit, not "exited null".
 *             M2 exit 0 with no JSON in the child output fails the point as unreadable.
 *             M3 doctorAllLimitMs: 60000 by default, the seam works only in test mode.
 *             M4 the two seams are ignored outside test mode.
 *             M5 a non-zero exit gives "doctor --all exited N".
 *
 * No argument runs both groups. Node built-ins and the tools/perf library only.
 * Part 8: fixture rooms only, sandbox HOME, sandbox rooms home, closed loopback Brain URL (the harness
 * context sets all three). The test prints check names and short findings, never a path.
 *
 * Run under the lock:
 *   flock -w 7200 "$HOME/.cache/mos-perf-384.lock" timeout 3600 node tests/test-384-cd-doctor-all-gate.cjs
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const REPO = path.resolve(__dirname, '..');
const H = require(path.join(REPO, 'tools', 'perf', 'perf-harness.cjs'));

const group = process.argv[2] || 'all';
if (!['all', 'parity', 'mechanism'].includes(group)) {
  process.stderr.write('usage: test-384-cd-doctor-all-gate.cjs [parity|mechanism]\n');
  process.exit(2);
}

let failed = 0;
function check(name, cond, extra) {
  if (cond) { process.stdout.write('ok   ' + name + '\n'); return; }
  failed += 1;
  process.stdout.write('FAIL ' + name + (extra ? ' - ' + extra : '') + '\n');
}

const tmpRoots = [];
const preps = [];

function cleanEnv(ctx, extra) {
  const env = ctx.env({});
  for (const k of Object.keys(env)) {
    if (/^DOCTOR_(TEST_|CLAIM_|ACCEPTANCE_)/.test(k) || k === 'MINDRIAN_ACCEPTANCE_PROGRESS') delete env[k];
  }
  env.MINDRIAN_ACCEPTANCE_PROGRESS = '0';
  return Object.assign(env, extra || {});
}

function makeFixture() {
  const prep = H.prepareRoom('fixture', { trees: [REPO], baseSha: 'unknown' });
  preps.push(prep);
  return { prep, ctx: H.makeCtx('G', REPO, prep, 4, false) };
}

function parseJson(text) {
  const s = String(text || '');
  const i = s.indexOf('{');
  if (i === -1) return null;
  try { return JSON.parse(s.slice(i)); } catch (_e) { return null; }
}

// The point result of `doctor --acceptance --pre-tag --only=doctor-all --json`, or null.
function runPoint(ctx, extraEnv) {
  const r = cp.spawnSync(process.execPath, [path.join(REPO, 'scripts', 'doctor.cjs'), '--acceptance', '--pre-tag', '--only=doctor-all', '--json'], {
    cwd: ctx.roomDir, env: cleanEnv(ctx, extraEnv), encoding: 'utf8', timeout: 300000,
  });
  const j = parseJson(r.stdout);
  const p = j && Array.isArray(j.points) ? j.points.find((x) => x && x.id === 'doctor-all') : null;
  return p || null;
}

function tmpScript(body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-384-cd-'));
  tmpRoots.push(dir);
  const f = path.join(dir, 'child.cjs');
  fs.writeFileSync(f, body);
  return f;
}

function show(p) { return p ? 'ok=' + p.ok + ' finding=' + String(p.finding).slice(0, 160) : 'no point in output'; }

function parityGroup() {
  // P1
  const a = makeFixture();
  const p1 = runPoint(a.ctx, {});
  check('P1 clean fixture: ok true and finding null', !!p1 && p1.ok === true && p1.finding === null, show(p1));

  // P2: one extra registered room whose folder has no .room-root
  const b = makeFixture();
  const regFile = path.join(b.prep.sandbox.roomsHome, '.rooms', 'registry.json');
  let premise = false;
  let premiseWhy = 'registry not readable';
  try {
    const reg = JSON.parse(fs.readFileSync(regFile, 'utf8'));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-384-cd-drift-'));
    tmpRoots.push(dir);
    reg.rooms = reg.rooms || {};
    reg.rooms['drift-room'] = { path: dir, abs_path: dir, status: 'active', venture_name: 'drift', git_enabled: false, git_remote: null, auto_push: false };
    fs.writeFileSync(regFile, JSON.stringify(reg));
    const r = cp.spawnSync(process.execPath, [path.join(REPO, 'scripts', 'doctor.cjs'), '--all', '--json'], { cwd: b.ctx.roomDir, env: cleanEnv(b.ctx, {}), encoding: 'utf8', timeout: 300000 });
    const j = parseJson(r.stdout);
    const st = j && j.checks && j.checks['cascade-rooms'] && j.checks['cascade-rooms'].status;
    premise = st === 'warn' || st === 'error';
    premiseWhy = 'cascade-rooms status ' + String(st);
  } catch (e) {
    premiseWhy = 'setup error ' + String(e && e.code);
  }
  check('P2 PREMISE the drift fixture makes the cascade-rooms check warn', premise, premiseWhy);
  const p2 = runPoint(b.ctx, {});
  check('P2 drift is not counted: ok true and finding null', !!p2 && p2.ok === true && p2.finding === null, show(p2));
}

function mechanismGroup() {
  const g = makeFixture();

  // M1
  const m1 = runPoint(g.ctx, { DOCTOR_TEST_MODE: '1', DOCTOR_TEST_DOCTOR_ALL_LIMIT_MS: '1' });
  const f1 = m1 && typeof m1.finding === 'string' ? m1.finding : '';
  check('M1 timeout named: ok false, "timed out after", the limit, not "exited null", detail.child.timed_out',
    !!m1 && m1.ok === false && f1.includes('timed out after') && f1.includes('1 ms') && !f1.includes('exited null') &&
    !!(m1.detail && m1.detail.child && m1.detail.child.timed_out === true), show(m1));

  // M2
  const unreadable = tmpScript("process.stdout.write('this is not json\\n'); process.exit(0);\n");
  const m2 = runPoint(g.ctx, { DOCTOR_TEST_MODE: '1', DOCTOR_TEST_DOCTOR_ALL_SCRIPT: unreadable });
  check('M2 unreadable result fails the point', !!m2 && m2.ok === false && /unreadable/.test(String(m2.finding)), show(m2));

  // M3
  let lim = null;
  try { lim = require(path.join(REPO, 'scripts', 'doctor.cjs')).doctorAllLimitMs; } catch (_e) { lim = null; }
  const okFn = typeof lim === 'function';
  check('M3 doctorAllLimitMs is exported', okFn);
  if (okFn) {
    check('M3 default is 60000', lim({}) === 60000, String(lim({})));
    check('M3 test-mode seam gives 300', lim({ DOCTOR_TEST_MODE: '1', DOCTOR_TEST_DOCTOR_ALL_LIMIT_MS: '300' }) === 300);
    check('M3 seam without test mode gives 60000', lim({ DOCTOR_TEST_DOCTOR_ALL_LIMIT_MS: '300' }) === 60000);
    const bad = ['abc', '0', '-5'].map((v) => lim({ DOCTOR_TEST_MODE: '1', DOCTOR_TEST_DOCTOR_ALL_LIMIT_MS: v }));
    check('M3 bad value in test mode gives 60000', bad.every((v) => v === 60000), bad.join(','));
  }

  // M4
  const m4 = runPoint(g.ctx, { DOCTOR_TEST_DOCTOR_ALL_LIMIT_MS: '1', DOCTOR_TEST_DOCTOR_ALL_SCRIPT: unreadable });
  check('M4 seams are ignored outside test mode: the real child runs, ok true', !!m4 && m4.ok === true, show(m4));

  // M5
  const exit3 = tmpScript("process.stdout.write(JSON.stringify({ checks: {} }) + '\\n'); process.exit(3);\n");
  const m5 = runPoint(g.ctx, { DOCTOR_TEST_MODE: '1', DOCTOR_TEST_DOCTOR_ALL_SCRIPT: exit3 });
  check('M5 exit code finding: "doctor --all exited 3"', !!m5 && m5.ok === false && m5.finding === 'doctor --all exited 3', show(m5));

  // M6: a report above 64 KiB, written with process.exit right after the write (as doctor --all does).
  // On a pipe the report is cut; the gate must read it whole.
  const big = tmpScript("const pad = 'x'.repeat(300000); process.stdout.write(JSON.stringify({ checks: {}, pad: pad }) + '\\n'); process.exit(0);\n");
  const m6 = runPoint(g.ctx, { DOCTOR_TEST_MODE: '1', DOCTOR_TEST_DOCTOR_ALL_SCRIPT: big });
  check('M6 a report above 64 KiB is read whole: ok true, finding null', !!m6 && m6.ok === true && m6.finding === null, show(m6));
}

try {
  if (group === 'all' || group === 'parity') parityGroup();
  if (group === 'all' || group === 'mechanism') mechanismGroup();
} finally {
  for (const p of preps) { try { p.sandbox.cleanup(); } catch (_e) { /* best-effort */ } }
  for (const d of tmpRoots) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best-effort */ } }
}

process.stdout.write(failed === 0 ? 'cd-doctor-gate: ALL PASS\n' : 'cd-doctor-gate: ' + failed + ' FAILED\n');
process.exit(failed === 0 ? 0 : 1);
