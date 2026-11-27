'use strict';
// Phase 400.5 plan 01: room.db lock helpers for the G11 load leg (tests/test-400.5-load-20.cjs).
// holdLock and stopChild are copies of tests/test-400.4-hook-budget.cjs (lines 73-99): a child takes BEGIN IMMEDIATE with
// timeout 0, prints 'locked', waits with Atomics.wait, then ROLLBACK. startWriter loops BEGIN IMMEDIATE / ROLLBACK and
// writes no row. isBusyError is the test form of the SQLITE_BUSY rule (lib/hmi/selector-telemetry.cjs:190-194).
// Test-only module. It never touches ~/MindrianRooms: the caller passes a scratch room dir.

const path = require('node:path');
const { spawn } = require('node:child_process');

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
    if (!child || child.exitCode !== null || child.signalCode !== null) return resolve();
    child.on('exit', () => resolve());
    child.kill('SIGKILL');
  });
}

// True for a SQLITE_BUSY failure of node:sqlite (primary result code 5), else for the busy message forms.
function isBusyError(err) {
  if (!err) return false;
  if (typeof err.errcode === 'number' && (err.errcode & 0xff) === 5) return true;
  return /database is locked|SQLITE_BUSY/i.test(err && err.message ? String(err.message) : '');
}

// One child that takes the room.db write lock every everyMs ms for holdMs ms. It writes no row (ROLLBACK only).
// On SIGTERM it prints one JSON line {cycles, busy, other} and exits. stop() resolves that object.
function startWriter(roomDir, opts) {
  const everyMs = Math.max(1, Number((opts && opts.everyMs) || 200));
  const holdMs = Math.max(0, Number((opts && opts.holdMs) || 50));
  const dbPath = path.join(roomDir, '.mindrian', 'room.db');
  const code = [
    "const { DatabaseSync } = require('node:sqlite');",
    'const dbPath = process.argv[1]; const everyMs = Number(process.argv[2]); const holdMs = Number(process.argv[3]);',
    'let cycles = 0, busy = 0, other = 0;',
    'function isBusy(e) { if (!e) return false; if (typeof e.errcode === "number" && (e.errcode & 0xff) === 5) return true; return /database is locked|SQLITE_BUSY/i.test(String(e.message || "")); }',
    'let db = null;',
    'function tick() {',
    '  try {',
    '    if (!db) db = new DatabaseSync(dbPath, { timeout: 0 });',
    "    db.exec('BEGIN IMMEDIATE');",
    '    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, holdMs);',
    "    db.exec('ROLLBACK');",
    '    cycles++;',
    '  } catch (e) { if (isBusy(e)) busy++; else other++; try { if (db) db.exec("ROLLBACK"); } catch (_e) {} }',
    '}',
    'const iv = setInterval(tick, everyMs);',
    "process.on('SIGTERM', () => { clearInterval(iv); try { if (db) db.close(); } catch (_e) {} process.stdout.write(JSON.stringify({ cycles, busy, other }) + '\\n', () => process.exit(0)); });",
    "process.stdout.write('started\\n');",
  ].join('\n');
  const child = spawn(process.execPath, ['-e', code, dbPath, String(everyMs), String(holdMs)], { stdio: ['ignore', 'pipe', 'inherit'] });
  let buf = '';
  child.stdout.on('data', (d) => { buf += d.toString(); });
  const ready = new Promise((resolve, reject) => {
    child.stdout.on('data', () => { if (buf.includes('started')) resolve(); });
    child.on('error', reject);
  });
  function stop() {
    return new Promise((resolve) => {
      const done = () => {
        const line = buf.split('\n').find((l) => l.startsWith('{'));
        let counts = { cycles: 0, busy: 0, other: 0 };
        try { if (line) counts = JSON.parse(line); } catch (_e) { /* keep zeros */ }
        resolve(counts);
      };
      if (child.exitCode !== null || child.signalCode !== null) return done();
      const killer = setTimeout(() => { try { child.kill('SIGKILL'); } catch (_e) { /* gone */ } }, 5000);
      child.on('exit', () => { clearTimeout(killer); done(); });
      child.kill('SIGTERM');
    });
  }
  return { child, ready, stop };
}

module.exports = { holdLock, startWriter, stopChild, isBusyError };
