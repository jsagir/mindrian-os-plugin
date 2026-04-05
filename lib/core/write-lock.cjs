/**
 * MindrianOS Plugin -- KuzuDB Write Lock
 * File-based write lock with PID tracking and stale cleanup.
 * Prevents concurrent KuzuDB writes from CLI hooks and MCP server.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const LOCK_FILE = 'write.lock';
const STALE_THRESHOLD_MS = 5000; // 5 seconds

/**
 * Acquire a file-based write lock for a room's .graph/ directory.
 * Cleans stale locks (>5s) and dead PIDs automatically.
 * @param {string} roomDir - Path to room directory
 * @throws {Error} If lock is held by a live process
 */
function acquireLock(roomDir) {
  const graphDir = path.join(roomDir, '.graph');
  const lockPath = path.join(graphDir, LOCK_FILE);

  // Ensure .graph/ directory exists
  fs.mkdirSync(graphDir, { recursive: true });

  // Check existing lock
  if (fs.existsSync(lockPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
      const age = Date.now() - data.timestamp;

      // Stale lock (older than 5 seconds)
      if (age > STALE_THRESHOLD_MS) {
        process.stderr.write(`[mindrian-os] Cleaned stale write lock (pid: ${data.pid})\n`);
        fs.unlinkSync(lockPath);
      } else if (data.pid !== process.pid) {
        // Check if PID is still alive
        try {
          process.kill(data.pid, 0);
          // PID is alive and not ours - lock is held
          throw new Error(`KuzuDB write lock held by PID ${data.pid}`);
        } catch (e) {
          if (e.message && e.message.startsWith('KuzuDB write lock')) throw e;
          // PID is dead - clean up
          fs.unlinkSync(lockPath);
        }
      }
      // If it's our own PID, we can re-acquire
    } catch (e) {
      if (e.message && e.message.startsWith('KuzuDB write lock')) throw e;
      // Corrupt lock file - remove it
      try { fs.unlinkSync(lockPath); } catch (_) {}
    }
  }

  // Write new lock
  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, timestamp: Date.now() }));
}

/**
 * Release the write lock for a room's .graph/ directory.
 * Silent if lock file doesn't exist.
 * @param {string} roomDir - Path to room directory
 */
function releaseLock(roomDir) {
  const lockPath = path.join(roomDir, '.graph', LOCK_FILE);
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
  const lockPath = path.join(roomDir, '.graph', LOCK_FILE);

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
