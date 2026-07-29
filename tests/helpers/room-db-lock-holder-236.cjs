#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 236-03 test helper -- room.db WRITE-LOCK holder.
 * =====================================================
 * Forked by tests/test-236-open-busy-detected.cjs to create a REAL contention
 * source against a scratch room's .mindrian/room.db.
 *
 * WHY a separate OS process: a second DatabaseSync handle inside the same
 * process shares nothing useful for this test, and node:sqlite offers no way to
 * simulate a foreign writer. The busy path is only exercised when a genuinely
 * separate connection holds the write lock.
 *
 * WHY a WRITE lock and not merely an open handle: room.db runs in WAL mode, and
 * under WAL readers never block. A plain open therefore makes a second open
 * succeed and the busy assertion would pass for the wrong reason (236-RESEARCH.md
 * Pitfall 1). This helper takes BEGIN IMMEDIATE and then performs an actual
 * write inside that transaction, so the reserved write lock is materially held,
 * not merely requested.
 *
 * WHY it opens a raw DatabaseSync instead of openRoomDb: openRoomDb runs the
 * migration chain, which would re-write the very sentinel the parent removed to
 * force the second opener to need write work. The holder must not repair the
 * fixture it exists to contend with.
 *
 * Exit codes (distinct on purpose, so a child that never actually locked is
 * distinguishable from one that did):
 *   0 - held the lock, released cleanly on request
 *   2 - could not OPEN the db at all
 *   3 - could not ACQUIRE the write lock (so the parent must not trust a busy
 *       result observed during this run)
 *
 * Parent protocol (node:child_process fork, IPC channel):
 *   child -> parent: { ready: true, mode: '<how the lock was taken>' }
 *   parent -> child: 'release'
 *
 * Usage:
 *   const child = fork('tests/helpers/room-db-lock-holder-236.cjs', [roomDir]);
 *
 * No em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const roomDir = process.argv[2];

if (!roomDir) {
  process.stderr.write('room-db-lock-holder-236: no roomDir argument\n');
  process.exit(2);
}

const dbPath = path.join(path.resolve(roomDir), '.mindrian', 'room.db');

let db = null;
try {
  // timeout 0: this holder must never wait on someone else. It is the writer.
  db = new DatabaseSync(dbPath, { timeout: 0 });
} catch (err) {
  process.stderr.write(
    'room-db-lock-holder-236: cannot open ' + dbPath + ': '
    + (err && err.message ? err.message : String(err)) + '\n'
  );
  process.exit(2);
}

// Take the write lock for real. BEGIN IMMEDIATE reserves it; the INSERT that
// follows forces an actual page write inside the open transaction so there is
// no ambiguity about whether the lock materialized.
let mode = null;
try {
  db.exec('BEGIN IMMEDIATE');
  db.prepare(
    'INSERT OR REPLACE INTO identity (key, value, updated_at) VALUES (?, ?, ?)'
  ).run('phase_236_lock_holder', String(process.pid), new Date().toISOString());
  mode = 'BEGIN IMMEDIATE + write';
} catch (_e) {
  // Escalation path, recorded rather than assumed: if a reserved write lock is
  // not enough contention on this runtime, take the file exclusively.
  try {
    try { db.exec('ROLLBACK'); } catch (_ignored) { /* no open txn */ }
    db.exec('PRAGMA locking_mode = EXCLUSIVE');
    db.exec('BEGIN IMMEDIATE');
    db.prepare(
      'INSERT OR REPLACE INTO identity (key, value, updated_at) VALUES (?, ?, ?)'
    ).run('phase_236_lock_holder', String(process.pid), new Date().toISOString());
    mode = 'PRAGMA locking_mode = EXCLUSIVE + BEGIN IMMEDIATE + write';
  } catch (err2) {
    process.stderr.write(
      'room-db-lock-holder-236: cannot acquire write lock: '
      + (err2 && err2.message ? err2.message : String(err2)) + '\n'
    );
    process.exit(3);
  }
}

function release(code) {
  try { db.exec('ROLLBACK'); } catch (_e) { /* already rolled back */ }
  try { db.close(); } catch (_e) { /* already closed */ }
  process.exit(code);
}

process.on('message', (msg) => {
  if (msg === 'release') release(0);
});

// Signal readiness only AFTER the lock is materially held.
if (typeof process.send === 'function') {
  process.send({ ready: true, mode: mode, pid: process.pid });
} else {
  process.stderr.write('room-db-lock-holder-236: no IPC channel (fork required)\n');
  release(3);
}

// Safety valve: never outlive a parent that died mid-test.
setTimeout(() => release(0), 60000).unref();
// Keep the event loop alive while holding the lock.
setInterval(() => {}, 1000);
