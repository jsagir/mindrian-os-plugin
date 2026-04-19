/**
 * MindrianOS Plugin -- SQLite Write Lock
 * File-based write lock with PID tracking and stale cleanup.
 * Prevents concurrent SQLite writes from CLI hooks and MCP server.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const LOCK_FILE = 'write.lock';
const STALE_THRESHOLD_MS = 5000; // 5 seconds

/**
 * Acquire a file-based write lock for a room's .mindrian/ directory.
 * Cleans stale locks (>5s) and dead PIDs automatically.
 *
 * Atomicity (Phase 87-02): uses fs.openSync(lockPath, 'wx') as the
 * create-if-not-exists primitive. The 'wx' flag fails with EEXIST when
 * the file already exists, which is how we guarantee that only ONE of N
 * racing processes wins the lock. The pre-patch existsSync -> writeFileSync
 * pair had a TOCTOU race: two processes could both see "no lock", then
 * both write, corrupting lock state.
 *
 * @param {string} roomDir - Path to room directory
 * @throws {Error} If lock is held by a live process
 */
function acquireLock(roomDir) {
  const lockDir = path.join(roomDir, '.mindrian');
  const lockPath = path.join(lockDir, LOCK_FILE);

  // Ensure .mindrian/ directory exists
  fs.mkdirSync(lockDir, { recursive: true });

  const payload = JSON.stringify({ pid: process.pid, timestamp: Date.now() });

  // Attempt atomic create. Retry once if EEXIST resolves to a
  // stale/dead/corrupt lock that we can clean up.
  for (let attempt = 0; attempt < 2; attempt++) {
    let fd;
    try {
      fd = fs.openSync(lockPath, 'wx');
      fs.writeSync(fd, payload);
      fs.closeSync(fd);
      return;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      // File exists -- inspect for staleness / ownership / dead pid.
      let data;
      try {
        data = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
      } catch (_parseErr) {
        // Corrupt lock file -- remove and retry.
        try { fs.unlinkSync(lockPath); } catch (_) {}
        continue;
      }
      const age = Date.now() - data.timestamp;
      if (age > STALE_THRESHOLD_MS) {
        process.stderr.write(`[mindrian-os] Cleaned stale write lock (pid: ${data.pid})\n`);
        try { fs.unlinkSync(lockPath); } catch (_) {}
        continue;
      }
      if (data.pid === process.pid) {
        // Re-acquire for same PID: overwrite payload (pre-patch behavior).
        // Rationale (87-02 / m11): non-atomic writeFileSync is intentional on
        // this path. Same PID owns the lock by definition, so there is no race
        // possible between "us vs us" -- we are single-threaded per process.
        // Atomicity only matters when TWO DIFFERENT processes race on creation,
        // which is the openSync('wx') path above. Keeping writeFileSync here
        // is correct and preserves the pre-patch refresh semantics.
        fs.writeFileSync(lockPath, payload);
        return;
      }
      // Different PID, not stale -- check liveness.
      try {
        process.kill(data.pid, 0);
        // PID is alive and not ours -- lock is held.
        throw new Error(`SQLite write lock held by PID ${data.pid}`);
      } catch (killErr) {
        if (killErr.message && killErr.message.startsWith('SQLite write lock')) throw killErr;
        // Dead PID -- clean up and retry.
        try { fs.unlinkSync(lockPath); } catch (_) {}
        continue;
      }
    }
  }

  // Second attempt also failed to acquire. This should only happen under
  // pathological churn (e.g. another process keeps re-creating the lock
  // between our unlink and our retry). Surface as a distinct error message
  // so ops can tell it apart from a normal contention failure.
  throw new Error(`SQLite write lock could not be acquired after retry (roomDir=${roomDir})`);
}

/**
 * Release the write lock for a room's .mindrian/ directory.
 * Silent if lock file doesn't exist.
 * @param {string} roomDir - Path to room directory
 */
function releaseLock(roomDir) {
  const lockPath = path.join(roomDir, '.mindrian', LOCK_FILE);
  try {
    fs.unlinkSync(lockPath);
  } catch (_) {
    // ENOENT or other errors - silent
  }
}

/**
 * Check if an MCP server (or other process) holds the write lock.
 * CLI hooks use this to detect a running MCP server and delegate writes.
 * @param {string} roomDir - Path to room directory
 * @returns {{ running: boolean, pid: number|null }}
 */
function isServerRunning(roomDir) {
  const lockPath = path.join(roomDir, '.mindrian', LOCK_FILE);

  if (!fs.existsSync(lockPath)) {
    return { running: false, pid: null };
  }

  try {
    const data = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
    const age = Date.now() - data.timestamp;

    // Stale lock
    if (age > STALE_THRESHOLD_MS) {
      return { running: false, pid: null };
    }

    // Our own PID
    if (data.pid === process.pid) {
      return { running: false, pid: null };
    }

    // Check if PID is alive
    try {
      process.kill(data.pid, 0);
      return { running: true, pid: data.pid };
    } catch (_) {
      return { running: false, pid: null };
    }
  } catch (_) {
    return { running: false, pid: null };
  }
}

module.exports = { acquireLock, releaseLock, isServerRunning };
