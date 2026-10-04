#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * MindrianOS Plugin -- the dependency-install status record
 * (Phase 369.1 review fixes CR-01, WR-04, WR-05).
 *
 * WHAT: one tiny JSON file per plugin root that the detached installer
 * (lib/core/dep-install-detached.cjs) writes and the MCP servers read
 * (lib/core/mcp-dep-heal.cjs, lib/core/mcp-install-responder.cjs). It says
 * whether an install is running, finished, failed or could not find npm.
 *
 * WHY THIS MODULE EXISTS (369.1-REVIEW CR-01): the file used to live at a
 * predictable path under the shared os.tmpdir(), was written through symlinks
 * with default permissions, and its text reached the model through the
 * responder. Any local user could plant a symlink or a hostile file there. Now:
 *   - it lives in a PER-USER private directory (<home>/.mindrian/run, created
 *     0700, lstat-checked: a real directory, owned by this user, no group or
 *     world access), never under the shared tmpdir;
 *   - every write is a fresh O_EXCL | O_NOFOLLOW temp file at mode 0600 renamed
 *     into place, so a pre-planted symlink is replaced, never written through;
 *   - every read lstat-checks the file (a regular file, owned by this user, not
 *     writable by anyone else), opens it O_NOFOLLOW and caps its size;
 *   - what comes back is an allow-listed shape: a known state, a reason that
 *     matches a fixed pattern (never raw text), integers and ISO dates. No
 *     plugin path is stored (it would leak the user name) and none is returned.
 *
 * WR-05: the file name hashes a NORMALISED root (realpath, forward slashes, no
 * trailing slash, lower case on Windows) so the server and the detached child
 * can never disagree about which file belongs to a plugin root.
 *
 * WR-04: an "installing" record counts as running only while its pid is alive
 * AND it is younger than INSTALL_STATUS_STALE_MS, so a recycled pid after a
 * reboot cannot pin the self-install forever.
 *
 * Canon Part 8 / D-08: built-ins only, no network, no room content. The record
 * holds state, timestamps, a pid and a bounded reason.
 *
 * HARD RULE: no em-dashes anywhere in this file (hyphens only).
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const STATES = ['installing', 'done', 'failed', 'npm-not-found'];

// The detached installer's own ceiling is 600000 ms (lib/core/mcp-dep-heal.cjs
// DETACHED_INSTALL_TIMEOUT_MS); an "installing" record older than that plus a
// minute of slack is dead whatever its pid says.
const INSTALL_STATUS_STALE_MS = 660000;

// The only reason strings that ever leave this module: exit-<code>, timeout,
// npm-not-found, installer-error, spawn-failed, interrupted, or an
// "incomplete: missing <names>" note over package-name characters.
const REASON_RE = /^(exit-\d{1,3}|timeout|npm-not-found|installer-error|spawn-failed|interrupted|incomplete: [\w@/., -]{0,80})$/;

const O_NOFOLLOW = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
const MAX_STATUS_BYTES = 2048;

function myUid() {
  return typeof process.getuid === 'function' ? process.getuid() : null;
}

/**
 * A stable spelling of a plugin root: realpath when it exists, forward slashes,
 * no trailing slash, lower case on Windows.
 * @param {string} root
 * @param {string} [platform] - override for process.platform (tests)
 * @returns {string}
 */
function normalizeRoot(root, platform) {
  const plat = platform || process.platform;
  const P = plat === 'win32' ? path.win32 : path;
  let p = P.resolve(String(root));
  if (plat === process.platform) {
    try {
      p = typeof fs.realpathSync.native === 'function' ? fs.realpathSync.native(p) : fs.realpathSync(p);
    } catch (_) { /* a root that does not exist yet keeps its resolved spelling */ }
  }
  if (plat === 'win32') p = p.replace(/\\/g, '/').toLowerCase();
  while (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

/** The per-user state directory path (not created here). */
function statusDirPath() {
  return path.join(os.homedir(), '.mindrian', 'run');
}

/**
 * The private status directory, verified: a real directory (never a symlink),
 * owned by this user, mode 0700. Created 0700 when `create` is true. Returns
 * null when it cannot be made trustworthy (the caller then runs without a
 * status record rather than writing somewhere shared).
 * @param {boolean} [create]
 * @returns {string|null}
 */
function privateStatusDir(create) {
  let dir;
  try { dir = statusDirPath(); } catch (_) { return null; }
  try {
    if (create) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const st = fs.lstatSync(dir);
    if (st.isSymbolicLink() || !st.isDirectory()) return null;
    const uid = myUid();
    if (uid !== null && st.uid !== uid) return null;
    if (process.platform !== 'win32' && (st.mode & 0o077) !== 0) {
      try { fs.chmodSync(dir, 0o700); } catch (_) { return null; }
    }
    return dir;
  } catch (_) {
    return null;
  }
}

/**
 * Where the status record for a plugin root lives. Pure: no disk access beyond
 * resolving the root.
 * @param {string} pluginRoot
 * @returns {string}
 */
function statusFilePath(pluginRoot) {
  const h = crypto.createHash('sha256').update(normalizeRoot(pluginRoot)).digest('hex').slice(0, 12);
  return path.join(statusDirPath(), 'dep-install-' + h + '.json');
}

/** A reason that matches the fixed pattern, else 'unknown'. Never raw text. */
function sanitizeReason(reason) {
  return typeof reason === 'string' && REASON_RE.test(reason) ? reason : 'unknown';
}

function isoOrNull(v) {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const t = typeof v === 'number' ? v : Date.parse(v);
  if (!Number.isFinite(t) || t < 0 || t > 8.64e15) return null;
  try { return new Date(t).toISOString(); } catch (_) { return null; }
}

/**
 * Reduce any parsed object to the allow-listed record shape, or null when the
 * state is not one of the four known states.
 * @param {*} obj
 * @returns {{state:string, reason:(string|null), pid:(number|null), startedAt:(string|null), finishedAt:(string|null), attempts:number}|null}
 */
function sanitizeStatus(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  if (typeof obj.state !== 'string' || !STATES.includes(obj.state)) return null;
  const pid = Number.isInteger(obj.pid) && obj.pid > 0 && obj.pid < 4294967296 ? obj.pid : null;
  const attempts = Number.isInteger(obj.attempts) && obj.attempts >= 0 && obj.attempts <= 1000 ? obj.attempts : 0;
  const hasReason = obj.reason !== undefined && obj.reason !== null && obj.reason !== '';
  return {
    state: obj.state,
    reason: hasReason ? sanitizeReason(obj.reason) : null,
    pid,
    startedAt: isoOrNull(obj.startedAt),
    finishedAt: isoOrNull(obj.finishedAt),
    attempts,
  };
}

/**
 * Read the status record; null when absent, untrusted or unreadable. Never
 * throws. Refuses a symlink, a non-regular file, a file owned by someone else,
 * a file writable by group or others, and anything over MAX_STATUS_BYTES.
 * @param {string} pluginRoot
 * @returns {object|null} a sanitizeStatus() shape
 */
function readStatus(pluginRoot) {
  let fd = null;
  try {
    if (!privateStatusDir(false)) return null;
    const file = statusFilePath(pluginRoot);
    const st = fs.lstatSync(file);
    if (st.isSymbolicLink() || !st.isFile() || st.size > MAX_STATUS_BYTES) return null;
    const uid = myUid();
    if (uid !== null && st.uid !== uid) return null;
    if (process.platform !== 'win32' && (st.mode & 0o022) !== 0) return null;
    fd = fs.openSync(file, fs.constants.O_RDONLY | O_NOFOLLOW);
    const fst = fs.fstatSync(fd);
    if (!fst.isFile() || fst.ino !== st.ino || fst.size > MAX_STATUS_BYTES) return null;
    const buf = Buffer.alloc(Math.min(fst.size, MAX_STATUS_BYTES));
    fs.readSync(fd, buf, 0, buf.length, 0);
    return sanitizeStatus(JSON.parse(buf.toString('utf8')));
  } catch (_) {
    return null;
  } finally {
    if (fd !== null) { try { fs.closeSync(fd); } catch (_) { /* closed */ } }
  }
}

/** True when pid names a live process (EPERM counts as live: it exists). */
function pidLive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return !!(e && e.code === 'EPERM');
  }
}

/** Milliseconds since the record's startedAt; Infinity when it has none. */
function statusAgeMs(st, now) {
  const t = st && st.startedAt ? Date.parse(st.startedAt) : NaN;
  if (!Number.isFinite(t)) return Infinity;
  return Math.max(0, (now === undefined ? Date.now() : now) - t);
}

/**
 * Is the installer this record describes demonstrably running? An "installing"
 * record with no finishedAt, a live pid, a valid start time and an age under
 * INSTALL_STATUS_STALE_MS (WR-04: a recycled pid or a record from before a
 * reboot never qualifies).
 */
function installRunning(st, now) {
  return !!(st && st.state === 'installing' && !st.finishedAt && pidLive(st.pid) &&
    statusAgeMs(st, now) <= INSTALL_STATUS_STALE_MS);
}

/**
 * Did an install start and never finish? "installing", no finishedAt, and not
 * running (dead pid, stale or pid-less). The tree it was building cannot be
 * trusted (CR-02).
 */
function installInterrupted(st, now) {
  return !!(st && st.state === 'installing' && !st.finishedAt && !installRunning(st, now));
}

function tempNameFor(file, kind) {
  return file + '.' + process.pid + '.' + crypto.randomBytes(4).toString('hex') + '.' + kind;
}

// Write `text` to a brand new 0600 file; never follows a planted link, never reuses a path.
function writeNewPrivateFile(tmp, text) {
  const fd = fs.openSync(tmp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | O_NOFOLLOW, 0o600);
  try {
    fs.writeSync(fd, text);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Replace the status record atomically with the sanitized form of `status`.
 * @param {string} pluginRoot
 * @param {object} status
 * @returns {boolean} true when written
 */
function writeStatusFile(pluginRoot, status) {
  const clean = sanitizeStatus(status);
  if (!clean || !privateStatusDir(true)) return false;
  const file = statusFilePath(pluginRoot);
  const tmp = tempNameFor(file, 'tmp');
  try {
    writeNewPrivateFile(tmp, JSON.stringify(clean));
    fs.renameSync(tmp, file); // rename replaces a planted symlink instead of following it
    return true;
  } catch (_) {
    try { fs.unlinkSync(tmp); } catch (_e) { /* best effort */ }
    return false;
  }
}

/**
 * Claim the record for this installer: publish a fully written file with link
 * (atomic, EEXIST when present), so a reader never sees a half file. A running
 * installer that is not this process keeps the claim.
 * @param {string} pluginRoot
 * @param {object} status - the "installing" record to publish
 * @returns {{ owned: boolean, interrupted: boolean, noStatus?: boolean, priorAttempts: number }}
 */
function claimStatusFile(pluginRoot, status) {
  const clean = sanitizeStatus(status);
  if (!clean || !privateStatusDir(true)) return { owned: true, interrupted: false, noStatus: true, priorAttempts: 0 };
  const file = statusFilePath(pluginRoot);
  const tmp = tempNameFor(file, 'claim');
  try {
    writeNewPrivateFile(tmp, JSON.stringify(clean));
  } catch (_) {
    try { fs.unlinkSync(tmp); } catch (_e) { /* absent */ }
    // Cannot write the record at all: install anyway, the install lock still serializes npm.
    return { owned: true, interrupted: false, noStatus: true, priorAttempts: 0 };
  }
  let interrupted = false;
  let priorAttempts = 0;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        fs.linkSync(tmp, file);
        return { owned: true, interrupted, priorAttempts };
      } catch (e) {
        if (!e || e.code !== 'EEXIST') return { owned: true, interrupted, noStatus: true, priorAttempts };
        const existing = readStatus(pluginRoot);
        if (existing && existing.pid !== process.pid && installRunning(existing)) {
          return { owned: false, interrupted: false, priorAttempts: 0 };
        }
        if (existing && installInterrupted(existing)) interrupted = true;
        if (existing && existing.state === 'failed') priorAttempts = existing.attempts;
        try { fs.unlinkSync(file); } catch (_e) { /* raced with a peer */ }
      }
    }
    return { owned: false, interrupted, priorAttempts };
  } finally {
    try { fs.unlinkSync(tmp); } catch (_) { /* already gone */ }
  }
}

module.exports = {
  STATES,
  INSTALL_STATUS_STALE_MS,
  REASON_RE,
  normalizeRoot,
  statusDirPath,
  privateStatusDir,
  statusFilePath,
  sanitizeReason,
  sanitizeStatus,
  readStatus,
  writeStatusFile,
  claimStatusFile,
  pidLive,
  statusAgeMs,
  installRunning,
  installInterrupted,
};
