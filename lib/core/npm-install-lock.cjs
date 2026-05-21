#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * MindrianOS Plugin -- one-shot npm-install lock (Option D, hybrid self-heal).
 *
 * Purpose: when a fresh plugin cache lands with NO node_modules, BOTH bundled
 * MCP servers (mindrian-brain + mindrian-os) can spawn at the same instant and
 * each independently discover MODULE_NOT_FOUND. If both ran `npm install`
 * concurrently in the same directory they would corrupt node_modules. This lock
 * guarantees that exactly ONE process runs the install while the other WAITS
 * for it to finish, then proceeds.
 *
 * This is deliberately NOT lib/core/write-lock.cjs. write-lock is room-scoped,
 * SQLite-scoped, has a 5s stale threshold, and THROWS on contention. The
 * npm-install path needs the opposite contract: a longer stale window (a cold
 * `npm install` can take 30s+) and a BLOCKING wait, not a throw -- the loser of
 * the race must sit still until node_modules is populated.
 *
 * Canon Part 8: zero network surface in this file. Pure node built-ins. The
 * `npm install` itself is run by the caller (mcp-dep-heal.cjs), not here.
 *
 * HARD RULE: no em-dashes anywhere in this file (hyphens only).
 */

const fs = require('node:fs');
const path = require('node:path');

const LOCK_FILENAME = '.mindrian-npm-install.lock';
// A cold `npm install` of the plugin deps measured ~3s on a warm npm cache and
// can exceed 30s on a cold cache / slow disk. 90s gives generous headroom; any
// lock older than this is treated as abandoned (crashed installer).
const STALE_THRESHOLD_MS = 90 * 1000;
// How long the loser of the race waits for the winner before giving up and
// trying the install itself. Slightly above STALE so a genuine winner always
// gets a chance to finish first.
const WAIT_TIMEOUT_MS = 100 * 1000;
const POLL_INTERVAL_MS = 200;

function lockPath(dir) {
  return path.join(dir, LOCK_FILENAME);
}

function readLock(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return null;
  }
}

function pidAlive(pid) {
  if (!pid || typeof pid !== 'number') return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM means the process exists but is owned by another user -- still alive.
    return e && e.code === 'EPERM';
  }
}

/**
 * Try to acquire the install lock for `dir`.
 *
 * Atomic create via fs.openSync(p, 'wx'): the 'wx' flag fails with EEXIST when
 * the file already exists, so only ONE of N racing processes wins.
 *
 * @param {string} dir - directory the install will run in (CLAUDE_PLUGIN_ROOT)
 * @returns {boolean} true if THIS process now holds the lock (it should run the
 *                    install), false if another live process holds it (this
 *                    process should call waitForUnlock instead).
 */
function acquireInstallLock(dir) {
  const p = lockPath(dir);
  const payload = JSON.stringify({ pid: process.pid, timestamp: Date.now() });

  for (let attempt = 0; attempt < 3; attempt++) {
    let fd;
    try {
      fd = fs.openSync(p, 'wx');
      fs.writeSync(fd, payload);
      fs.closeSync(fd);
      return true;
    } catch (e) {
      if (e.code !== 'EEXIST') {
        // Cannot even create a lock file (read-only dir, etc). Caller falls
        // back to running the install unguarded -- better than not healing.
        return true;
      }
      const data = readLock(p);
      if (!data) {
        // Corrupt or unreadable lock -- clear and retry.
        try { fs.unlinkSync(p); } catch (_) {}
        continue;
      }
      const age = Date.now() - (data.timestamp || 0);
      if (age > STALE_THRESHOLD_MS || !pidAlive(data.pid)) {
        // Abandoned by a crashed / hung installer. Reclaim it.
        try { fs.unlinkSync(p); } catch (_) {}
        continue;
      }
      // A live process holds a fresh lock -- this process is the loser.
      return false;
    }
  }
  // Pathological churn -- give up the guard and let the caller install.
  return true;
}

/** Release the lock. Silent if it does not exist or is not ours. */
function releaseInstallLock(dir) {
  const p = lockPath(dir);
  try {
    const data = readLock(p);
    if (data && data.pid && data.pid !== process.pid) return; // not ours
    fs.unlinkSync(p);
  } catch (_) {
    // ENOENT or other -- silent.
  }
}

/**
 * Block until the lock for `dir` is released (winner finished its install),
 * the lock goes stale, or WAIT_TIMEOUT_MS elapses.
 *
 * Synchronous by design: this runs at MCP server startup, before the server
 * connects its transport, so a blocking spin is acceptable and correct.
 *
 * @param {string} dir
 * @returns {boolean} true if the lock cleared (install presumably done),
 *                    false on timeout.
 */
function waitForUnlock(dir) {
  const p = lockPath(dir);
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (!fs.existsSync(p)) return true;
    const data = readLock(p);
    if (!data) return true; // corrupt -- treat as cleared
    const age = Date.now() - (data.timestamp || 0);
    if (age > STALE_THRESHOLD_MS || !pidAlive(data.pid)) return true;
    // Busy-wait a short slice. Atomics.wait on a throwaway SAB is the portable
    // synchronous sleep primitive (no extra dependency, works on all surfaces).
    try {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, POLL_INTERVAL_MS);
    } catch (_) {
      // SharedArrayBuffer unavailable in some sandboxes -- fall back to a
      // cheap synchronous no-op spin so we still poll, just hotter.
      const spinUntil = Date.now() + POLL_INTERVAL_MS;
      while (Date.now() < spinUntil) { /* spin */ }
    }
  }
  return false;
}

module.exports = {
  acquireInstallLock,
  releaseInstallLock,
  waitForUnlock,
  LOCK_FILENAME,
  STALE_THRESHOLD_MS,
};
