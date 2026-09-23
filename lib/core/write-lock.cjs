/**
 * MindrianOS Plugin -- SQLite Write Lock
 * File-based write lock with owner-token tracking and liveness-only
 * recovery. Prevents concurrent SQLite writes from CLI hooks and MCP
 * server.
 *
 * Ownership rules (Phase 354-04 / SYS-02, replacing the Phase 87-02
 * age-only staleness rule):
 *
 *   - A lock held by a live process is NEVER displaced by age, however old
 *     its timestamp is. Liveness (process.kill(pid, 0)) is the only truth
 *     that matters; age is documentation only, never a takeover reason.
 *   - A lock whose owning process has exited (a confirmed-dead pid) is
 *     recovered by exactly one of any number of racing contenders, guarded
 *     by a short-lived '.recover' mutex file so only one process performs
 *     the actual unlink-and-recreate.
 *   - Only the process holding the current on-disk token may release the
 *     lock. releaseLock() with no token (or a stale/foreign token) is a
 *     silent no-op -- it never touches the file.
 *   - Nested acquireLock() calls from the SAME process on the SAME room
 *     increment a depth counter in an in-process registry; the lock is
 *     only actually released when the outermost release runs.
 *   - breakLock() is the one explicit, operator-invoked escape hatch for a
 *     live-but-hung owner (compare-and-unlink against a known token). No
 *     code path calls it automatically.
 *
 * Atomicity (Phase 87-02, unchanged): uses fs.openSync(lockPath, 'wx') as
 * the create-if-not-exists primitive. The 'wx' flag fails with EEXIST when
 * the file already exists, which is how we guarantee that only ONE of N
 * racing processes wins the lock.
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const LOCK_FILE = 'write.lock';
const RECOVER_SUFFIX = '.recover';
// Documentation only as of Phase 354-04: age is never compared against
// this constant to decide a takeover. A live owner is never displaced by
// age; only a confirmed-dead pid (ESRCH) or a corrupt lock file recovers.
const STALE_THRESHOLD_MS = 5000; // 5 seconds

// In-process ownership registry: path.resolve(roomDir) -> { token, depth }.
// Lets nested acquireLock()/releaseLock() calls and legacy no-handle
// callers within the SAME process find their own token without threading
// a handle through every call site.
const _held = new Map();

/**
 * True when `pid` names a process that currently exists (alive), false
 * when it is confirmed dead (ESRCH). A permission error (EPERM) still
 * means the process exists -- just owned by someone else.
 * @param {number} pid
 * @returns {boolean}
 */
function _isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (killErr) {
    return Boolean(killErr) && killErr.code === 'EPERM';
  }
}

/**
 * Recover a lock file whose owner has been confirmed dead (or whose
 * content is corrupt/unreadable), guarded by a '.recover' mutex so that
 * exactly one of any number of racing contenders performs the actual
 * unlink. Never called for a live owner.
 *
 * @param {string} lockPath - Full path to the write.lock file.
 * @param {{ corrupt: boolean, raw?: string|null, token?: string, pid?: number|string }} observed
 *   What this caller originally read before deciding the owner was dead.
 * @returns {boolean} true when it is safe for the caller to retry
 *   acquiring (either this call recovered the lock, or another process
 *   already changed it and a fresh read will reflect current truth);
 *   false when a LIVE process already holds the recovery mutex and this
 *   attempt should be surfaced as held, not retried.
 */
function _recoverDeadLock(lockPath, observed) {
  const recoverPath = lockPath + RECOVER_SUFFIX;

  for (let attempt = 0; attempt < 3; attempt++) {
    let fd;
    try {
      fd = fs.openSync(recoverPath, 'wx');
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, timestamp: Date.now() }));
      fs.closeSync(fd);
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let mutexData = null;
      try {
        mutexData = JSON.parse(fs.readFileSync(recoverPath, 'utf-8'));
      } catch (_parseErr) {
        mutexData = null;
      }
      if (mutexData && _isPidAlive(mutexData.pid)) {
        // Someone else is already recovering this lock -- do not race
        // them; surface this attempt as held rather than spin.
        return false;
      }
      // Corrupt or dead-owner mutex file -- clean it up once and retry.
      try { fs.unlinkSync(recoverPath); } catch (_) {}
      continue;
    }

    // We hold the recovery mutex. Re-read the lock file and unlink it
    // ONLY if it still matches what we originally observed -- guards
    // against a legitimate new owner having already recovered and
    // re-acquired between our observation and now.
    try {
      let currentRaw = null;
      let current = null;
      try {
        currentRaw = fs.readFileSync(lockPath, 'utf-8');
        current = JSON.parse(currentRaw);
      } catch (_readErr) {
        current = null;
      }
      const stillMatches = observed.corrupt
        ? currentRaw === observed.raw
        : (current !== null && current.token === observed.token);
      if (stillMatches) {
        try { fs.unlinkSync(lockPath); } catch (_) {}
        process.stderr.write(
          `[mindrian-os] Recovered write lock from dead owner (pid: ${observed.pid === undefined ? 'unknown' : observed.pid})\n`
        );
      }
      // Whether we unlinked it ourselves or a different process already
      // changed it, the caller's next read reflects current truth.
      return true;
    } finally {
      try { fs.unlinkSync(recoverPath); } catch (_) {}
    }
  }

  // Could not obtain the recovery mutex after retries -- treat as held
  // rather than spin forever.
  return false;
}

/**
 * Acquire a file-based write lock for a room's .mindrian/ directory.
 *
 * @param {string} roomDir - Path to room directory
 * @returns {{ roomDir: string, token: string }} An owner-token handle.
 *   Legacy callers that ignore the return value keep working: the SAME
 *   token is also tracked in the in-process `_held` registry, so a later
 *   no-handle releaseLock(roomDir) call from the same process still finds
 *   it.
 * @throws {Error} If the lock is held by a live process (same host or
 *   another host), or could not be acquired after retries.
 */
function acquireLock(roomDir) {
  const key = path.resolve(roomDir);
  const lockDir = path.join(key, '.mindrian');
  const lockPath = path.join(lockDir, LOCK_FILE);

  fs.mkdirSync(lockDir, { recursive: true });

  // Nesting: this SAME process already holds this room's lock per our own
  // registry, and the on-disk lock still carries our token -- increment
  // depth and hand back an equivalent handle rather than re-creating.
  const existingHeld = _held.get(key);
  if (existingHeld) {
    let onDisk = null;
    try {
      onDisk = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
    } catch (_e) {
      onDisk = null;
    }
    if (onDisk && onDisk.token === existingHeld.token) {
      existingHeld.depth += 1;
      return { roomDir: key, token: existingHeld.token };
    }
    // Registry says we hold it but the file disagrees (removed out from
    // under us) -- drop the stale entry and fall through to a fresh
    // acquire attempt below.
    _held.delete(key);
  }

  const host = os.hostname();

  for (let attempt = 0; attempt < 3; attempt++) {
    let fd;
    try {
      const token = crypto.randomUUID();
      const payload = JSON.stringify({
        pid: process.pid,
        token,
        host,
        timestamp: Date.now(),
        schema: 'owner-token',
      });
      fd = fs.openSync(lockPath, 'wx');
      fs.writeSync(fd, payload);
      fs.closeSync(fd);
      _held.set(key, { token, depth: 1 });
      return { roomDir: key, token };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;

      let raw = null;
      let data = null;
      try {
        raw = fs.readFileSync(lockPath, 'utf-8');
        data = JSON.parse(raw);
      } catch (_parseErr) {
        data = null;
      }

      if (!data) {
        // Corrupt or unreadable lock file -- recover unconditionally.
        _recoverDeadLock(lockPath, { corrupt: true, raw, pid: 'unknown' });
        continue;
      }

      const sameHost = !data.host || data.host === host;

      if (data.pid === process.pid && sameHost) {
        // Same process already owns the on-disk lock (legacy same-PID
        // re-acquire, or our registry entry was cleared some other way
        // than a release) -- adopt it into the registry.
        const entry = _held.get(key);
        if (entry) {
          entry.depth += 1;
        } else {
          _held.set(key, { token: data.token, depth: 1 });
        }
        return { roomDir: key, token: data.token };
      }

      if (!sameHost) {
        // Cannot prove liveness across hosts -- fail closed regardless of
        // age. A forged or stale cross-host claim can only block writes,
        // never cause two concurrent writers (T-354-08b).
        throw new Error(`SQLite write lock held by PID ${data.pid} on host ${data.host}`);
      }

      // Same host, different pid -- liveness is the only truth. Age is
      // never a takeover reason (T-354-05).
      if (_isPidAlive(data.pid)) {
        throw new Error(`SQLite write lock held by PID ${data.pid}`);
      }

      // Confirmed-dead owner -- recover under the mutex, then retry.
      const recovered = _recoverDeadLock(lockPath, { corrupt: false, token: data.token, pid: data.pid });
      if (!recovered) {
        // A live process is already recovering this lock -- surface as
        // held rather than spin (case D: exactly one winner per dead
        // lock).
        throw new Error(`SQLite write lock held by PID ${data.pid}`);
      }
      continue;
    }
  }

  throw new Error(`SQLite write lock could not be acquired after retry (roomDir=${roomDir})`);
}

/**
 * Release the write lock for a room's .mindrian/ directory. Only the
 * current token owner (from `handle`, or from this process's own registry
 * when `handle` is omitted) may actually remove the file. Never throws.
 *
 * @param {string} roomDir - Path to room directory
 * @param {{ roomDir?: string, token: string }} [handle] - The handle
 *   returned by acquireLock(). Omit for legacy same-process callers that
 *   never touch a handle.
 * @returns {{ released: boolean, reason?: 'not_held'|'nested'|'not_owner' }}
 */
function releaseLock(roomDir, handle) {
  const key = path.resolve(roomDir);
  const lockPath = path.join(key, '.mindrian', LOCK_FILE);
  const entry = _held.get(key);
  const token = (handle && handle.token) || (entry && entry.token);

  if (!token) {
    return { released: false, reason: 'not_held' };
  }

  if (entry && entry.token === token && entry.depth > 1) {
    entry.depth -= 1;
    return { released: false, reason: 'nested' };
  }

  let onDisk = null;
  try {
    onDisk = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
  } catch (_e) {
    onDisk = null;
  }

  if (onDisk && onDisk.token === token) {
    try { fs.unlinkSync(lockPath); } catch (_) {}
    if (entry && entry.token === token) _held.delete(key);
    return { released: true };
  }

  // Different or missing token on disk -- not ours to remove. Still clear
  // our own stale registry entry if it matched the token we were asked to
  // release (the file was removed or replaced out from under us).
  if (entry && entry.token === token) _held.delete(key);
  return { released: false, reason: 'not_owner' };
}

/**
 * Check if another live process on this host holds the write lock. CLI
 * hooks use this to detect a running MCP server and delegate writes. Age
 * is ignored -- only current on-disk pid + liveness matter.
 * @param {string} roomDir - Path to room directory
 * @returns {{ running: boolean, pid: number|null }}
 */
function isServerRunning(roomDir) {
  const lockPath = path.join(path.resolve(roomDir), '.mindrian', LOCK_FILE);

  if (!fs.existsSync(lockPath)) {
    return { running: false, pid: null };
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
  } catch (_e) {
    return { running: false, pid: null };
  }

  const host = os.hostname();
  if (data.host && data.host !== host) {
    // Cannot prove liveness across hosts -- do not report as running.
    return { running: false, pid: null };
  }

  if (data.pid === process.pid) {
    return { running: false, pid: null };
  }

  if (_isPidAlive(data.pid)) {
    return { running: true, pid: data.pid };
  }
  return { running: false, pid: null };
}

/**
 * Explicit operator recovery for a live-but-hung owner. The ONLY code
 * path that may unlink a lock whose owner is still alive -- and only when
 * the caller supplies the exact current token (compare-and-unlink). No
 * code in this repo calls this automatically; it exists for a human
 * operator (or an operator-invoked script) to break a genuinely stuck
 * lock.
 *
 * @param {string} roomDir - Path to room directory
 * @param {{ expectedToken: string, reason: string }} options
 * @returns {{ broken: boolean }}
 */
function breakLock(roomDir, options) {
  const opts = options || {};
  const expectedToken = opts.expectedToken;
  const reason = opts.reason;
  const key = path.resolve(roomDir);
  const lockPath = path.join(key, '.mindrian', LOCK_FILE);

  let data = null;
  try {
    data = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
  } catch (_e) {
    data = null;
  }

  if (!data || !expectedToken || data.token !== expectedToken) {
    return { broken: false };
  }

  try {
    fs.unlinkSync(lockPath);
  } catch (_e) {
    return { broken: false };
  }

  const entry = _held.get(key);
  if (entry && entry.token === expectedToken) _held.delete(key);

  process.stderr.write(`[mindrian-os] write lock broken by operator (pid ${data.pid}, reason ${reason})\n`);
  return { broken: true };
}

module.exports = { acquireLock, releaseLock, isServerRunning, breakLock };
