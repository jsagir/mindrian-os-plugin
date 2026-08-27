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
 * CORRECTNESS FIXES (remote code review, 2026-05-21 -- folded into beta.23):
 *   - bug_004: lock creation is now ATOMIC via fs.linkSync (write a fully
 *     populated temp file, then atomically link it into place). The pre-fix
 *     openSync('wx') created a zero-byte file that a separate writeSync later
 *     populated -- a racing peer could read the empty file mid-write, treat it
 *     as corrupt, unlink the winner's live lock, and run a second concurrent
 *     install. readLock + waitForUnlock additionally distinguish a transient
 *     empty mid-write file from genuinely corrupt JSON.
 *   - bug_001: STALE_THRESHOLD_MS is raised strictly above the 120s install
 *     timeout, and the staleness checks use AND not OR -- a lock is reclaimed
 *     only when it is BOTH old AND its owning pid is dead. A healthy install
 *     legitimately running 90-120s is no longer declared abandoned.
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
// can exceed 30s on a cold cache / slow disk. runGuardedInstall's spawnSync
// gives the install a 120000 ms (120s) timeout, so STALE_THRESHOLD_MS MUST sit
// strictly ABOVE 120s -- otherwise a healthy install still legitimately running
// at the 90-120s mark would be declared abandoned and a peer would start a
// SECOND concurrent install (bug_001). 180s gives 60s of headroom over the
// install timeout. Belt-and-suspenders: the staleness checks below also require
// pidAlive to be false (AND, not OR), so an old-but-live lock is never reclaimed.
const STALE_THRESHOLD_MS = 180 * 1000;
// How long the loser of the race waits for the winner before giving up and
// trying the install itself. Strictly above STALE so a genuine winner whose
// lock has just gone stale still gets reclaimed-and-retried, not double-run.
const WAIT_TIMEOUT_MS = 200 * 1000;
const POLL_INTERVAL_MS = 200;
// A mid-write lock file (created by openSync('wx') but not yet written by the
// follow-up writeSync) is briefly empty. readLock distinguishes that transient
// state from a genuinely corrupt file by polling a few short intervals before
// declaring corruption (bug_004 defence-in-depth alongside the atomic linkSync
// create path).
const EMPTY_FILE_RETRY_ATTEMPTS = 5;
const EMPTY_FILE_RETRY_INTERVAL_MS = 20;

function lockPath(dir) {
  return path.join(dir, LOCK_FILENAME);
}

/** Portable synchronous short sleep (no extra dependency, works everywhere). */
function sleepSync(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch (_) {
    // SharedArrayBuffer unavailable in some sandboxes -- busy-wait instead.
    const until = Date.now() + ms;
    while (Date.now() < until) { /* spin */ }
  }
}

/**
 * Read and parse a lock file.
 *
 * Returns one of three things so callers can distinguish a transient empty
 * mid-write file from a genuinely corrupt one (bug_004):
 *   - the parsed lock object        -> a valid, fully-written lock
 *   - the string 'EMPTY'            -> the file exists but is empty / whitespace
 *                                      only after a few short retries; this is
 *                                      a mid-write race window OR a 0-byte
 *                                      leftover. Caller should retry, not
 *                                      assume the lock is dead.
 *   - null                          -> the file is missing, unreadable, or
 *                                      contains genuinely non-empty invalid
 *                                      JSON (truly corrupt -- safe to clear).
 *
 * The atomic linkSync create path in acquireInstallLock means a winner's lock
 * is never observed mid-write in practice; this empty/corrupt distinction is
 * defence-in-depth for any lock that arrived via a non-atomic path.
 *
 * @param {string} p - lock file path
 * @returns {object|'EMPTY'|null}
 */
function readLock(p) {
  for (let attempt = 0; attempt < EMPTY_FILE_RETRY_ATTEMPTS; attempt++) {
    let raw;
    try {
      raw = fs.readFileSync(p, 'utf8');
    } catch (_) {
      return null; // missing or unreadable
    }
    if (raw.trim() === '') {
      // Empty / whitespace-only: possibly a mid-write window. Retry a few
      // short intervals before giving up.
      if (attempt < EMPTY_FILE_RETRY_ATTEMPTS - 1) {
        sleepSync(EMPTY_FILE_RETRY_INTERVAL_MS);
        continue;
      }
      return 'EMPTY';
    }
    try {
      return JSON.parse(raw);
    } catch (_) {
      // Non-empty but not valid JSON -- genuinely corrupt.
      return null;
    }
  }
  return 'EMPTY';
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
 * Whether a lock described by `data` is reclaimable as abandoned.
 *
 * bug_001 fix: this uses AND, not OR. A lock is reclaimed ONLY when it is BOTH
 * stale (older than STALE_THRESHOLD_MS) AND its owning pid is genuinely dead.
 * The pre-fix OR form let a peer unlink a LIVE lock the instant `age` crossed
 * the (too-short) threshold, even though the install was still running -- two
 * concurrent `npm install`s, corrupted node_modules. With AND, a long-but-live
 * install keeps its lock no matter how old it gets; a dead-owner lock that has
 * not yet aged out keeps its lock too (the owner may have only just died and a
 * sibling could still be mid-handoff). Reclaim needs both signals.
 *
 * @param {object} data - parsed lock contents (must be a valid lock object)
 * @returns {boolean}
 */
function isReclaimable(data) {
  const age = Date.now() - (data.timestamp || 0);
  return age > STALE_THRESHOLD_MS && !pidAlive(data.pid);
}

/**
 * Try to acquire the install lock for `dir`.
 *
 * bug_004 fix: lock creation is ATOMIC. The payload is written to a uniquely
 * named temp file FIRST (fully populated, then closed), and only then is
 * fs.linkSync(tmp, p) used to publish it at the canonical lock path. linkSync
 * is atomic and fails with EEXIST if the target already exists, so a winner's
 * lock is ALWAYS observed fully-written -- there is no zero-byte mid-write
 * window for a racing peer to misread as corrupt. The pre-fix openSync('wx')
 * created a 0-byte file that the follow-up writeSync populated in a SEPARATE
 * syscall; a peer racing in between read an empty file, treated it as corrupt,
 * unlinked the winner's live lock, and both processes ran `npm install`.
 *
 * @param {string} dir - directory the install will run in (CLAUDE_PLUGIN_ROOT)
 * @returns {boolean} true if THIS process now holds the lock (it should run the
 *                    install), false if another live process holds it (this
 *                    process should call waitForUnlock instead).
 */
function acquireInstallLock(dir) {
  const p = lockPath(dir);
  const tmp = p + '.' + process.pid + '.tmp';
  const payload = JSON.stringify({ pid: process.pid, timestamp: Date.now() });

  for (let attempt = 0; attempt < 3; attempt++) {
    // Write the payload to a private temp file, fully, before publishing it.
    try {
      fs.writeFileSync(tmp, payload);
    } catch (e) {
      // Cannot even write a temp file (read-only dir, etc). Caller falls back
      // to running the install unguarded -- better than not healing.
      return true;
    }

    try {
      // Atomic publish: link is atomic and fails EEXIST if `p` already exists.
      fs.linkSync(tmp, p);
      // We won. The temp file has served its purpose; remove it.
      try { fs.unlinkSync(tmp); } catch (_) {}
      return true;
    } catch (e) {
      // Always drop our temp file before deciding what to do next.
      try { fs.unlinkSync(tmp); } catch (_) {}
      if (e.code !== 'EEXIST') {
        // linkSync failed for a non-contention reason (filesystem without
        // hardlink support, cross-device, permissions). Fall back to running
        // the install unguarded -- better than not healing.
        return true;
      }
      // The lock path is already held. Inspect it.
      const data = readLock(p);
      if (data === 'EMPTY') {
        // Transient mid-write window (or a 0-byte leftover from a non-atomic
        // path). Do NOT unlink -- a peer may be about to populate it. Wait a
        // short interval and retry the acquire.
        sleepSync(EMPTY_FILE_RETRY_INTERVAL_MS * EMPTY_FILE_RETRY_ATTEMPTS);
        continue;
      }
      if (!data) {
        // Genuinely corrupt (non-empty invalid JSON) or unreadable -- clear
        // and retry.
        try { fs.unlinkSync(p); } catch (_) {}
        continue;
      }
      if (isReclaimable(data)) {
        // Abandoned: BOTH stale AND its owner is dead. Reclaim it.
        try { fs.unlinkSync(p); } catch (_) {}
        continue;
      }
      // A live (or not-yet-reclaimable) process holds the lock -- this process
      // is the loser and must wait for the winner.
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
    // Only skip the unlink when we can positively confirm the lock belongs to
    // a DIFFERENT live process. 'EMPTY' (transient) or null (corrupt) -- there
    // is no owner pid to compare, so fall through and clear it.
    if (data && data !== 'EMPTY' && data.pid && data.pid !== process.pid) {
      return; // not ours
    }
    fs.unlinkSync(p);
  } catch (_) {
    // ENOENT or other -- silent.
  }
}

/**
 * Block until the lock for `dir` is released (winner finished its install),
 * the lock goes stale, or the effective timeout elapses.
 *
 * Synchronous by design: this runs at MCP server startup, before the server
 * connects its transport, so a blocking spin is acceptable and correct.
 *
 * A caller on the MCP connect path (Phase 266 MCPFIX-03) passes a much
 * shorter `opts.timeoutMs` here, because the HOST is already counting down
 * its own ~30-second connect timeout while this process waits -- sitting for
 * the full default WAIT_TIMEOUT_MS (200s) would guarantee the host gives up
 * first. Returning `false` early in that case is the CORRECT outcome: the
 * caller reports a bounded failure instead of being killed as unresponsive.
 * A caller with no host clock (the SessionStart reconcile hook, via
 * runGuardedInstall with no opts) keeps the original 200-second default.
 *
 * @param {string} dir
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs] - per-call override. Used only when it is
 *   a finite number greater than zero; otherwise falls back to
 *   WAIT_TIMEOUT_MS. Does NOT change WAIT_TIMEOUT_MS, STALE_THRESHOLD_MS or
 *   POLL_INTERVAL_MS -- the bug_001 invariant chain (install timeout < STALE
 *   < WAIT) depends on those defaults staying fixed.
 * @returns {boolean} true if the lock cleared (install presumably done),
 *                    false on timeout.
 */
function waitForUnlock(dir, opts) {
  opts = opts || {};
  const effectiveTimeoutMs = (typeof opts.timeoutMs === 'number' && isFinite(opts.timeoutMs) && opts.timeoutMs > 0)
    ? opts.timeoutMs
    : WAIT_TIMEOUT_MS;
  const p = lockPath(dir);
  const deadline = Date.now() + effectiveTimeoutMs;
  while (Date.now() < deadline) {
    if (!fs.existsSync(p)) return true;
    const data = readLock(p);
    if (data === 'EMPTY') {
      // bug_004 symmetric defect fix: an empty file is a transient mid-write
      // window, NOT a cleared lock. The pre-fix `if (!data) return true` form
      // declared the winner done the instant it saw an empty file -- the loser
      // then ran its OWN install concurrently. Keep polling instead.
      sleepSync(POLL_INTERVAL_MS);
      continue;
    }
    if (!data) return true; // genuinely corrupt -- treat as cleared
    // bug_001 fix: AND, not OR. Stop waiting only when the lock is BOTH stale
    // AND its owner is dead. A long-but-live install keeps us waiting; we never
    // race ahead with our own install while a healthy winner is still running.
    if (isReclaimable(data)) return true;
    // Poll a short slice via the portable synchronous sleep.
    sleepSync(POLL_INTERVAL_MS);
  }
  return false;
}

module.exports = {
  acquireInstallLock,
  releaseInstallLock,
  waitForUnlock,
  readLock,
  isReclaimable,
  pidAlive,
  LOCK_FILENAME,
  STALE_THRESHOLD_MS,
  WAIT_TIMEOUT_MS,
};
