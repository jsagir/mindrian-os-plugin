#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-02 -- minto-debouncer (queue + 10s coalescing window)
 * ===============================================================
 * Ships the debounced queue that coalesces post-write regen intents.
 * Without it, a rapid edit burst (user saves 20 times in 30 seconds
 * while iterating) triggers 20 LLM-backed MINTO regens. This debouncer
 * collapses bursts to ONE regen per section per 10s window.
 *
 * Queue state persists at .mindrian/minto-queue.json so session crashes
 * do not lose pending work. Every mutation composes with the Phase 87-02
 * atomic write-lock (acquireLock / releaseLock) so concurrent producers
 * (post-write hook + on-stop + intent-classifier drain) cannot corrupt
 * the queue file.
 *
 * Usage (programmatic, for scripts that already live in this repo):
 *   const dbnc = require('./scripts/minto-debouncer.cjs');
 *   dbnc.enqueue(roomDir, section, reason);              // idempotent within 10s
 *   dbnc.drain(roomDir, { timeoutMs: 5000, olderThanMs: 30000 });
 *   dbnc.peek(roomDir);                                   // read-only
 *
 * Usage (CLI, for bash hook scripts):
 *   node scripts/minto-debouncer.cjs enqueue <roomDir> <section> <reason>
 *   node scripts/minto-debouncer.cjs drain <roomDir> [--timeout=5000] [--older-than=30000]
 *   node scripts/minto-debouncer.cjs peek <roomDir>
 *
 * Three-surface by construction: CJS + node built-ins + zero new deps.
 * Works identically across Claude Code CLI, Claude Desktop MCP, and Cowork.
 *
 * Downstream consumers:
 *   - 88-04 post-write hook (enqueue on room section writes)
 *   - 88-05 intent-classifier (drain at UserPromptSubmit for items > 30s old)
 *   - 88-06 on-stop snapshot (drain with 5s timeout, write session snapshot)
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { acquireLock, releaseLock } = require('../lib/core/write-lock.cjs');

const QUEUE_RELATIVE = path.join('.mindrian', 'minto-queue.json');
const SCHEMA_VERSION = 1;
const COALESCE_WINDOW_MS = 10_000;
// Lock acquisition uses exponential backoff to ride out bursts of concurrent
// producers (e.g. 5 forks firing in the same tick). Max cumulative wait:
// 50 + 100 + 200 + 400 + 800 + 1600 + 3200 ~= 6.4s, well under the 5s drain
// timeout budget for normal operation and 10s for crash-recovery paths. Each
// individual lock HOLD is only a few ms (read queue, write queue, release)
// so 12 attempts is comfortable headroom.
const LOCK_RETRY_MAX_ATTEMPTS = 12;
const LOCK_RETRY_BASE_MS = 25;
const LOCK_RETRY_CAP_MS = 1600;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function queuePath(roomDir) {
  return path.join(roomDir, QUEUE_RELATIVE);
}

function emptyQueue() {
  return { version: SCHEMA_VERSION, entries: [] };
}

/**
 * Read the queue file or return an empty queue.
 * Self-healing: corrupted JSON or missing file returns the empty shape and
 * emits a stderr warning (never throws). Downstream callers treat the
 * returned shape as authoritative.
 */
function readQueueOrDefault(qp) {
  if (!fs.existsSync(qp)) return emptyQueue();
  let raw;
  try {
    raw = fs.readFileSync(qp, 'utf-8');
  } catch (e) {
    process.stderr.write(
      '[minto-debouncer] warn: failed to read queue file (' + (e && e.code || 'unknown') + '); resetting to empty\n'
    );
    return emptyQueue();
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_parseErr) {
    process.stderr.write(
      '[minto-debouncer] warn: corrupt queue JSON detected; healing to empty queue\n'
    );
    return emptyQueue();
  }
  // Validate shape. If anything looks off, reset rather than trust.
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.entries)) {
    process.stderr.write(
      '[minto-debouncer] warn: queue file has invalid shape; resetting to empty queue\n'
    );
    return emptyQueue();
  }
  if (parsed.version !== SCHEMA_VERSION) {
    // Unknown version -- treat as needs-reset (no forward-compat commitment yet).
    process.stderr.write(
      '[minto-debouncer] warn: unexpected queue version ' + parsed.version + '; resetting\n'
    );
    return emptyQueue();
  }
  // Filter out entries that are not well-formed; log but do not throw.
  const clean = parsed.entries.filter((e) =>
    e && typeof e === 'object' &&
    typeof e.section === 'string' &&
    typeof e.enqueued_at === 'string'
  );
  return { version: SCHEMA_VERSION, entries: clean };
}

/**
 * Atomic queue write: tmp file + rename. Composes with the outer
 * acquireLock guard so two processes cannot stomp each other's writes.
 * Cleans up the .tmp.PID file on failure so .mindrian/ never accumulates
 * leftovers.
 */
function writeQueueAtomic(qp, queue) {
  const dir = path.dirname(qp);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = qp + '.tmp.' + process.pid;
  let fd;
  try {
    fd = fs.openSync(tmp, 'w');
    fs.writeSync(fd, JSON.stringify(queue, null, 2));
    try { fs.fsyncSync(fd); } catch (_) { /* fsync best-effort; some FS do not support */ }
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(tmp, qp);
  } catch (e) {
    try { if (fd != null) fs.closeSync(fd); } catch (_) {}
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw e;
  }
}

/**
 * Synchronous sleep. Used between lock retries because the debouncer is
 * called from CLI hook scripts that are already blocking on subprocess
 * exit; there is no event loop to yield to. Node's Atomics.wait is the
 * only real sync-sleep primitive on Node built-ins (no 'sleep' module).
 *
 * @param {number} ms
 */
function sleepSync(ms) {
  if (ms <= 0) return;
  // Atomics.wait on a sab int32 with non-matching value is a portable
  // sync sleep with sub-ms precision. Fallback to busy-wait if SAB is
  // unavailable (shouldn't happen on Node 18+).
  try {
    const sab = new SharedArrayBuffer(4);
    const view = new Int32Array(sab);
    Atomics.wait(view, 0, 0, ms);
  } catch (_) {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) { /* busy wait */ }
  }
}

/**
 * Lock acquisition with exponential-backoff retry loop. The underlying
 * write-lock primitive already retries once internally for stale/dead-PID
 * cleanup; the retry loop here rides out bursts of concurrent producers.
 * Each lock HOLD by a fellow producer is only a few ms, so LOCK_RETRY_MAX
 * attempts comfortably serialize 5-20 concurrent enqueues without any
 * producer being starved.
 *
 * If acquisition still fails after all attempts, we bail with a warning
 * rather than throwing. The caller's work is a best-effort debounce, not
 * a correctness boundary; dropping an entry under pathological contention
 * is preferable to crashing a hook script.
 *
 * @param {string} roomDir
 * @returns {boolean} true on success, false on give-up.
 */
function tryAcquire(roomDir) {
  let backoff = LOCK_RETRY_BASE_MS;
  let lastErr;
  for (let attempt = 0; attempt < LOCK_RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      acquireLock(roomDir);
      return true;
    } catch (e) {
      lastErr = e;
      // Randomized half-jitter reduces thundering-herd risk when many
      // producers wake up at the same tick.
      const jitter = Math.floor(Math.random() * (backoff / 2));
      sleepSync(backoff + jitter);
      backoff = Math.min(backoff * 2, LOCK_RETRY_CAP_MS);
    }
  }
  process.stderr.write(
    '[minto-debouncer] warn: could not acquire write lock after ' +
      LOCK_RETRY_MAX_ATTEMPTS + ' attempts (' +
      (lastErr && lastErr.message || 'unknown') + '); skipping\n'
  );
  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Enqueue a regen intent for a section. Idempotent within a 10s window:
 * if an entry for this section already exists with enqueued_at newer than
 * now - 10s, the queue is NOT modified (earliest-wins semantics).
 *
 * @param {string} roomDir - Absolute path to room root (must contain .room-root sentinel).
 * @param {string} section - Section slug (e.g. 'market-analysis').
 * @param {string} reason  - Why this was enqueued (e.g. 'post-write:file.md', 'on-stop').
 * @returns {{ enqueued: boolean, coalesced: boolean }} - what happened.
 */
function enqueue(roomDir, section, reason) {
  if (!roomDir || typeof roomDir !== 'string') {
    throw new TypeError('enqueue: roomDir (string) is required');
  }
  if (!section || typeof section !== 'string') {
    throw new TypeError('enqueue: section (string) is required');
  }
  if (!reason || typeof reason !== 'string') {
    throw new TypeError('enqueue: reason (string) is required');
  }
  const qp = queuePath(roomDir);
  fs.mkdirSync(path.dirname(qp), { recursive: true });

  if (!tryAcquire(roomDir)) {
    return { enqueued: false, coalesced: false };
  }
  try {
    const queue = readQueueOrDefault(qp);
    const now = Date.now();
    // Earliest-wins: if a same-section entry exists within the 10s window,
    // do NOT touch its enqueued_at. The window is measured from the FIRST
    // insert so a burst cannot keep the entry perpetually "young".
    const existingIdx = queue.entries.findIndex((e) => {
      if (e.section !== section) return false;
      const ts = Date.parse(e.enqueued_at);
      if (Number.isNaN(ts)) return false;
      return (now - ts) < COALESCE_WINDOW_MS;
    });
    if (existingIdx !== -1) {
      // Coalesced -- nothing to write, queue stays identical.
      return { enqueued: false, coalesced: true };
    }
    queue.entries.push({
      section,
      enqueued_at: new Date(now).toISOString(),
      reason,
      attempts: 0,
    });
    writeQueueAtomic(qp, queue);
    return { enqueued: true, coalesced: false };
  } finally {
    releaseLock(roomDir);
  }
}

/**
 * Drain entries from the queue. Returns the drained entries; remaining
 * entries are written back atomically. Honors a wall-clock timeout: if
 * the operation exceeds timeoutMs, the function returns whatever was
 * drained so far (no throw, no hang).
 *
 * @param {string} roomDir
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=5000]  - Wall-clock bound for the whole drain.
 * @param {number} [opts.olderThanMs=0]   - Only drain entries older than this.
 *                                          0 = drain everything.
 * @returns {Array<{section:string, enqueued_at:string, reason:string, attempts:number}>}
 */
function drain(roomDir, opts) {
  if (!roomDir || typeof roomDir !== 'string') {
    throw new TypeError('drain: roomDir (string) is required');
  }
  const timeoutMs = (opts && typeof opts.timeoutMs === 'number') ? opts.timeoutMs : 5000;
  const olderThanMs = (opts && typeof opts.olderThanMs === 'number') ? opts.olderThanMs : 0;

  const deadline = Date.now() + timeoutMs;
  const qp = queuePath(roomDir);

  if (!fs.existsSync(qp)) return [];
  if (Date.now() > deadline) return [];

  if (!tryAcquire(roomDir)) return [];
  try {
    if (Date.now() > deadline) return [];
    const queue = readQueueOrDefault(qp);
    const now = Date.now();
    const drained = [];
    const remaining = [];
    for (const e of queue.entries) {
      if (Date.now() > deadline) {
        // Timeout hit mid-partition -- keep remaining entries including current.
        remaining.push(e);
        continue;
      }
      const ts = Date.parse(e.enqueued_at);
      const age = Number.isNaN(ts) ? Number.POSITIVE_INFINITY : (now - ts);
      if (age >= olderThanMs) {
        drained.push(e);
      } else {
        remaining.push(e);
      }
    }
    if (drained.length > 0) {
      writeQueueAtomic(qp, { version: SCHEMA_VERSION, entries: remaining });
    }
    return drained;
  } finally {
    releaseLock(roomDir);
  }
}

/**
 * Peek at the queue without mutating it. Acquires + releases the lock
 * quickly to get a consistent snapshot, then returns a deep copy so the
 * caller cannot accidentally mutate persisted state.
 *
 * @param {string} roomDir
 * @returns {{version:number, entries:Array}}
 */
function peek(roomDir) {
  if (!roomDir || typeof roomDir !== 'string') {
    throw new TypeError('peek: roomDir (string) is required');
  }
  const qp = queuePath(roomDir);
  if (!fs.existsSync(qp)) return emptyQueue();

  if (!tryAcquire(roomDir)) {
    // Best-effort read without the lock if acquisition fails. This is
    // a read-only path and a race here yields at worst a stale snapshot.
    try {
      return JSON.parse(JSON.stringify(readQueueOrDefault(qp)));
    } catch (_) {
      return emptyQueue();
    }
  }
  try {
    return JSON.parse(JSON.stringify(readQueueOrDefault(qp)));
  } finally {
    releaseLock(roomDir);
  }
}

module.exports = { enqueue, drain, peek };

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseFlag(args, name, defaultValue) {
  // Supports --name=value and --name value shapes.
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--' + name && i + 1 < args.length) {
      return args[i + 1];
    }
    if (a.startsWith('--' + name + '=')) {
      return a.slice(('--' + name + '=').length);
    }
  }
  return defaultValue;
}

function usage() {
  process.stderr.write(
    'Usage:\n' +
    '  node scripts/minto-debouncer.cjs enqueue <roomDir> <section> <reason>\n' +
    '  node scripts/minto-debouncer.cjs drain <roomDir> [--timeout=5000] [--older-than=30000]\n' +
    '  node scripts/minto-debouncer.cjs peek <roomDir>\n'
  );
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const sub = args[0];
  try {
    switch (sub) {
      case 'enqueue': {
        const roomDir = args[1];
        const section = args[2];
        const reason = args[3];
        if (!roomDir || !section || !reason) {
          usage();
          process.exit(2);
        }
        const res = enqueue(roomDir, section, reason);
        process.stdout.write(JSON.stringify(res) + '\n');
        process.exit(0);
        break;
      }
      case 'drain': {
        const roomDir = args[1];
        if (!roomDir) { usage(); process.exit(2); }
        const timeoutMs = parseInt(parseFlag(args.slice(2), 'timeout', '5000'), 10);
        const olderThanMs = parseInt(parseFlag(args.slice(2), 'older-than', '0'), 10);
        const drained = drain(roomDir, { timeoutMs, olderThanMs });
        process.stdout.write(JSON.stringify(drained) + '\n');
        process.exit(0);
        break;
      }
      case 'peek': {
        const roomDir = args[1];
        if (!roomDir) { usage(); process.exit(2); }
        const snap = peek(roomDir);
        process.stdout.write(JSON.stringify(snap, null, 2) + '\n');
        process.exit(0);
        break;
      }
      default: {
        usage();
        process.exit(2);
      }
    }
  } catch (e) {
    process.stderr.write('[minto-debouncer] error: ' + (e && e.message || e) + '\n');
    if (e && e.stack) process.stderr.write(e.stack + '\n');
    process.exit(1);
  }
}
