#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 236 Plan 02 Task 3 test helper -- the out-of-process WAL reader probe.
 *
 * Forked by tests/test-236-rebuild-wal-concurrent-read.cjs. Opens its OWN
 * read-only DatabaseSync handle against a room's .mindrian/room.db and polls the
 * nodes table in a tight loop, appending one JSON line per sample to an output
 * file, until the parent creates a stop-sentinel file. Then it flushes and
 * exits 0.
 *
 * WHY A SEPARATE OS PROCESS, AND NOT AN IN-PROCESS TIMER. ROADMAP success
 * criterion 2 requires the WAL snapshot-visibility behavior be "proven by
 * observation on this Node/SQLite combination, not asserted from docs". An
 * in-process poll cannot discharge that: rebuildGraph's file walk is
 * synchronous, so it holds the event loop for the entire transaction and a
 * setInterval callback would not fire even once during the window it claims to
 * sample. Only a second OS process actually runs concurrently with it.
 *
 * WHY A SENTINEL FILE AND NOT process.on('message'). For the same reason. This
 * probe's own sampling loop is synchronous, so an IPC message would sit
 * undelivered in the channel until the loop ended, which is exactly when the
 * signal is no longer needed. fs.existsSync on a sentinel path is checked
 * INSIDE the loop and therefore actually stops it.
 *
 * WHY NOT THE ROOM-DB OPEN HELPER. The standard room opener in
 * lib/core/room-db.cjs runs the whole migration chain, and a migration that
 * needs to write takes a WRITE LOCK. This probe is an untrusted concurrent
 * OBSERVER by design (threat T-236-04 / the trust-boundary table in
 * 236-02-PLAN.md): if it took a write lock it would perturb the very behavior it
 * is measuring. It therefore opens a plain DatabaseSync directly, read-only, and
 * deliberately does not require lib/core/room-db.cjs at all. tests/ is on the
 * scripts/check-substrate.cjs ALLOWED_DIRECT_IMPORT list, so a direct
 * node:sqlite require from a test helper is sanctioned.
 *
 * READ-ONLY OPENS AND THE -shm FILE. A read-only connection to a WAL database
 * cannot CREATE the shared-memory index file, so the parent must already hold an
 * open handle on the room when this probe starts. The parent does exactly that,
 * and this probe retries the open briefly before giving up so a slow parent is
 * not misread as a broken room.
 *
 * EXIT CODES, distinct on purpose so a probe that never actually sampled is
 * distinguishable from one that sampled and saw nothing:
 *   0  sampled and flushed cleanly
 *   2  could not open the room database
 *   3  could not write the output file
 *   4  wrong or missing argv
 *
 * Usage (from parent test):
 *   const child = fork(
 *     'tests/helpers/wal-reader-probe-236.cjs',
 *     [roomDir, samplesPath, stopPath],
 *     { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] }
 *   );
 *
 * Output format, one JSON object per line:
 *   {"ts":1785300000123,"counts":{"Artifact":8,"memory_event":2},"total":12}
 *   {"ts":1785300000124,"error":"SQLITE_BUSY"}
 *
 * No em-dashes (CLAUDE.md hard rule). CJS only, zero new deps, zero network.
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const [, , roomDir, samplesPath, stopPath] = process.argv;

if (!roomDir || !samplesPath || !stopPath) {
  process.stderr.write('wal-reader-probe-236: usage: <roomDir> <samplesPath> <stopPath>\n');
  process.exit(4);
}

const dbPath = path.join(roomDir, '.mindrian', 'room.db');

// Flush in batches so the appendFileSync itself does not dominate the loop and
// throttle the very sample rate the parent asserts a floor on.
const FLUSH_EVERY = 250;
// A hard ceiling so a parent that dies without touching the sentinel cannot
// leave this process spinning forever (threat T-236-04).
const MAX_SAMPLES = 400000;
// A wall-clock ceiling for the same reason, in case the ceiling above is not
// reached.
const MAX_RUN_MS = 120000;
// The parent opens the room before forking, but process startup is not
// instantaneous, so retry the open briefly rather than misreport a slow parent
// as a broken room.
const OPEN_RETRY_MS = 5000;

function sleepSync(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch (_e) {
    /* Atomics.wait unavailable: fall through, the retry loop still terminates */
  }
}

let db = null;
let lastOpenError = null;
const openDeadline = Date.now() + OPEN_RETRY_MS;
while (db === null && Date.now() < openDeadline) {
  try {
    db = new DatabaseSync(dbPath, { readOnly: true, timeout: 5000 });
  } catch (e) {
    lastOpenError = e;
    db = null;
    sleepSync(25);
  }
}

if (db === null) {
  process.stderr.write(
    'wal-reader-probe-236: cannot open ' + dbPath + ': '
      + (lastOpenError && lastOpenError.message) + '\n'
  );
  process.exit(2);
}

let buffer = [];
let flushed = 0;

function flush() {
  if (buffer.length === 0) return;
  const blob = buffer.join('\n') + '\n';
  buffer = [];
  try {
    fs.appendFileSync(samplesPath, blob, 'utf8');
  } catch (e) {
    process.stderr.write(
      'wal-reader-probe-236: cannot write ' + samplesPath + ': ' + (e && e.message) + '\n'
    );
    try { db.close(); } catch (_c) { /* ignore */ }
    process.exit(3);
  }
  flushed += 1;
}

// One sample: the node counts BY TYPE plus a timestamp. Grouping by type is what
// lets the parent tell a full snapshot from a partial one; a bare total could
// not distinguish "Artifact rows deleted" from "memory_event rows deleted".
const sampleStmt = db.prepare('SELECT type, COUNT(*) AS cnt FROM nodes GROUP BY type');

let samples = 0;
const runDeadline = Date.now() + MAX_RUN_MS;

while (!fs.existsSync(stopPath)) {
  const ts = Date.now();
  try {
    const counts = {};
    let total = 0;
    for (const row of sampleStmt.all()) {
      counts[row.type] = row.cnt;
      total += row.cnt;
    }
    buffer.push(JSON.stringify({ ts: ts, counts: counts, total: total }));
  } catch (e) {
    // Recorded rather than swallowed: a read that failed is not the same as a
    // read that observed an empty table, and the parent asserts on the
    // difference instead of guessing.
    buffer.push(JSON.stringify({ ts: ts, error: String((e && e.code) || (e && e.message) || e) }));
  }
  samples += 1;
  if (buffer.length >= FLUSH_EVERY) flush();
  if (samples >= MAX_SAMPLES) break;
  if (Date.now() > runDeadline) break;
}

flush();
try { db.close(); } catch (_e) { /* ignore */ }

try {
  process.stderr.write(
    'wal-reader-probe-236: ' + samples + ' samples, ' + flushed + ' flushes\n'
  );
} catch (_e) { /* ignore */ }

process.exit(0);
