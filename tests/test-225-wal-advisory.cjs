#!/usr/bin/env node
// Phase 225-02 (REQ-4, PD-2): the WAL-reset corruption doctor advisory.
//
// Proves _walResetAdvisory fires EXACTLY on (bundled SQLite < 3.51.3) AND (a live
// co-session), is advisory-only (never a block, never a crash), and that
// `doctor --bind-check` still exits 0 with a live co-session fixture present.
//
// Self-running node:assert (repo convention). SKIP-safe if _walResetAdvisory is
// not yet exported (mirrors tests/test-binding-gate-degrade.test.cjs's guard
// style). No em-dashes.
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');

let doctor;
try {
  doctor = require(path.join(ROOT, 'scripts', 'doctor.cjs'));
} catch (e) {
  console.log('SKIP: test-225-wal-advisory -- doctor.cjs not requirable. ' + (e.code || e.message));
  process.exit(0);
}
if (typeof doctor._walResetAdvisory !== 'function') {
  console.log('SKIP: test-225-wal-advisory -- _walResetAdvisory not exported yet.');
  process.exit(0);
}

const tmpDirs = [];
function mkTmpRoom() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'wal-advisory-'));
  tmpDirs.push(d);
  return d;
}
function cleanup() {
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
}

try {
  const roomDir = mkTmpRoom();

  // Leg 1 -- FIRE: old version + live co-session -> a WARN string naming 3.51.3.
  const fired = doctor._walResetAdvisory({
    sqliteVersion: '3.51.2',
    hasCoSession: () => true,
    roomDir: roomDir,
    sessionId: 's1',
  });
  assert.strictEqual(typeof fired, 'string', 'leg 1: advisory fires as a string');
  assert.ok(fired.indexOf('3.51.3') !== -1, 'leg 1: names the fixed version 3.51.3');
  assert.ok(fired.indexOf('WARN') !== -1, 'leg 1: uses the WARN idiom');

  // Leg 2 -- NO-FIRE on a fixed-or-newer version. This is the leg that catches a
  // lexicographic-compare bug: as strings '3.51.10' < '3.51.3', but by numeric
  // segments it is NEWER, so it must NOT fire.
  for (const v of ['3.51.3', '3.51.10', '3.52.0', '4.0.0']) {
    const r = doctor._walResetAdvisory({
      sqliteVersion: v,
      hasCoSession: () => true,
      roomDir: roomDir,
      sessionId: 's1',
    });
    assert.strictEqual(r, null, 'leg 2: version ' + v + ' (>= 3.51.3) does not fire');
  }

  // Leg 3 -- NO-FIRE: old version but no co-session (the 2nd precondition absent).
  const noCo = doctor._walResetAdvisory({
    sqliteVersion: '3.51.2',
    hasCoSession: () => false,
    roomDir: roomDir,
    sessionId: 's1',
  });
  assert.strictEqual(noCo, null, 'leg 3: no live co-session -> no finding');

  // Leg 4 -- NEVER-CRASH: a presence probe that throws degrades to null, and a
  // missing sqliteVersion (production probe path) never throws.
  const threw = doctor._walResetAdvisory({
    sqliteVersion: '3.51.2',
    hasCoSession: () => { throw new Error('injected: presence read fault'); },
    roomDir: roomDir,
    sessionId: 's1',
  });
  assert.strictEqual(threw, null, 'leg 4: a throwing co-session probe degrades to null');
  let probeResult;
  assert.doesNotThrow(() => {
    probeResult = doctor._walResetAdvisory({ hasCoSession: () => true, roomDir: roomDir, sessionId: 's1' });
  }, 'leg 4: the production version-probe path never throws');
  assert.ok(probeResult === null || typeof probeResult === 'string',
    'leg 4: the probe path returns null or a string, never anything else');

  // Leg 5 -- E2E never-block: a live co-session fixture (a DIFFERENT session id,
  // this process's live pid, a fresh timestamp) under the room, then spawn
  // `doctor --bind-check <room>` as the self session. The bundled SQLite version
  // is environment-dependent, so the WARN row may or may not appear; the
  // load-bearing assertion is exit code 0 (the never-block contract). If the WARN
  // row DOES appear, the first output line must still be the unmodified
  // OK/ADVISORY header (proving report.healthy was untouched by the advisory).
  const e2eRoom = mkTmpRoom();
  const sessionsDir = path.join(e2eRoom, '.mindrian', 'sessions');
  fs.mkdirSync(sessionsDir, { recursive: true });
  const now = new Date().toISOString();
  const coSid = 'co-session-live';
  fs.writeFileSync(
    path.join(sessionsDir, coSid + '.json'),
    JSON.stringify({ session_id: coSid, pid: process.pid, bound_at: now, updated: now }, null, 2)
  );

  const selfSid = 'self-binding-session';
  const proc = spawnSync('node', [path.join(ROOT, 'scripts', 'doctor.cjs'), '--bind-check', e2eRoom], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_SESSION_ID: selfSid }),
  });
  assert.strictEqual(proc.status, 0, 'leg 5: doctor --bind-check exits 0 with a live co-session (never-block)');
  const stdout = proc.stdout || '';
  if (stdout.indexOf('WARN: bundled SQLite') !== -1) {
    const firstLine = stdout.split('\n')[0] || '';
    assert.ok(
      firstLine.indexOf('OK') === 0 || firstLine.indexOf('ADVISORY') === 0,
      'leg 5: with the WARN present, the header line is still the unmodified OK/ADVISORY verdict'
    );
  }

  console.log('PASS: test-225-wal-advisory (5 legs: fire / no-fire version / no-fire co-session / never-crash / e2e never-block)');
  cleanup();
  process.exit(0);
} catch (e) {
  cleanup();
  console.error('FAIL: test-225-wal-advisory -- ' + (e && e.message ? e.message : e));
  process.exit(1);
}
