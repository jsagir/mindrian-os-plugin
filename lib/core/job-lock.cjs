/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 379.1 (graph derive drain and scout runaway CPU) Plan 02 Task 2.
 *
 * The background-job lock: a file lock with PID liveness, process identity,
 * a boot guard and a heartbeat, for the derive drain (Plan 04) and the scout
 * cadence runner (Plan 05). CPU379-05, D-379.1-18, T-379.1-03.
 *
 * The idioms are copied from lib/core/write-lock.cjs (Phase 354-04): the
 * 'wx' create-if-not-exists primitive, process.kill(pid, 0) as the only
 * truth about a live owner, and the '.recover' mutex so exactly one of any
 * number of racing contenders unlinks a dead lock. The write lock itself is
 * untouched: its token and in-process registry are SQLite-specific.
 *
 * Reclaim rules (the E5 rule from the debug session: the legacy drain lock
 * was reclaimed by age after 10 minutes while its owner lived, and two
 * workers then shared room.db):
 *   - A corrupt file, a dead PID (ESRCH), or a boot_ms that differs from the
 *     current boot by more than BOOT_TOLERANCE_MS is reclaimed.
 *   - A live PID whose heartbeat is inside HEARTBEAT_HARD_CEILING_MS (6 h)
 *     is NEVER reclaimed, whatever the file age. Age is documentation only.
 *   - A live PID whose heartbeat is older than the ceiling is reclaimed when
 *     its process identity (linux /proc/<pid>/stat starttime) differs from
 *     the one recorded in the lock, or when identity is unavailable on
 *     either side: a recycled PID on a long-lived boot, or an unidentifiable
 *     holder with a heartbeat 6 hours stale, cannot be a live drain or scout
 *     (their budgets are minutes). A live PID with matching identity and a
 *     stale heartbeat stays held with stale_heartbeat true; the doctor names
 *     it and a human stops it.
 *   - Release is owner-checked: pid and started_at must both match.
 * Accepted edge (T-379.1-03): a sleep or suspend of more than 6 h on a
 * platform without pid_start (Windows, macOS) can allow one duplicate worker
 * in the wake-up window before the first heartbeat tick; a duplicate run is
 * idempotent (atomic cache write), so this is accepted.
 *
 * Lock payload (schema 'job-lock-v1'):
 *   { pid, pid_start, started_at, heartbeat_at, boot_ms, job, schema }
 * A bare integer file (the legacy drain lock) reads as
 *   { pid: n, legacy_bare_pid: true } and its age is the file mtime.
 *
 * Every function catches and returns a typed object; no exception crosses
 * the boundary (the drain and the runner never raise one across a hook
 * boundary). Node built-ins only. No network. No em-dashes. Hyphens only.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCHEMA = 'job-lock-v1';
const RECOVER_SUFFIX = '.recover';
const BOOT_TOLERANCE_MS = 120000;
const DEFAULT_HEARTBEAT_MS = 30000;
const HEARTBEAT_HARD_CEILING_MS = 21600000; // 6 hours

// ---------------------------------------------------------------------------
// Process facts
// ---------------------------------------------------------------------------

// True when pid names a process that exists. EPERM means it exists and is
// owned by someone else (write-lock.cjs _isPidAlive, verbatim rule).
function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (killErr) {
    return Boolean(killErr) && killErr.code === 'EPERM';
  }
}

// The boot instant in epoch ms. Two readings on one boot agree within a few
// ms; a reboot moves it by the downtime, far beyond BOOT_TOLERANCE_MS.
function currentBootMs() {
  return Math.round(Date.now() - os.uptime() * 1000);
}

// pidStartTicks(pid): on linux the starttime field of /proc/<pid>/stat
// (clock ticks since boot, stable for the life of the process); null on any
// failure or on another platform. The comm field can hold spaces and
// parentheses, so the parse takes the text after the LAST ')' and splits it
// on whitespace: that array starts at stat field 3, so field 22 (starttime)
// is element 19.
function pidStartTicks(pid) {
  if (process.platform !== 'linux') return null;
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    const raw = fs.readFileSync('/proc/' + pid + '/stat', 'utf8');
    const close = raw.lastIndexOf(')');
    if (close === -1) return null;
    const rest = raw.slice(close + 1).trim().split(/\s+/);
    const v = Number(rest[19]);
    return Number.isFinite(v) ? Math.trunc(v) : null;
  } catch (_e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

// A bare integer reads as the legacy drain lock; JSON must carry an integer
// pid; anything else is corrupt (null).
function _parse(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (/^\d{1,10}$/.test(s)) {
    const n = Number(s);
    return Number.isInteger(n) && n > 0 ? { pid: n, legacy_bare_pid: true } : null;
  }
  try {
    const o = JSON.parse(s);
    if (o && typeof o === 'object' && !Array.isArray(o) && Number.isInteger(o.pid) && o.pid > 0) return o;
  } catch (_e) { /* corrupt */ }
  return null;
}

function _writeAtomic(file, text) {
  const tmp = file + '.hb-' + process.pid + '-' + Date.now().toString(36);
  try {
    fs.writeFileSync(tmp, text, 'utf8');
    fs.renameSync(tmp, file);
    return true;
  } catch (_e) {
    try { fs.unlinkSync(tmp); } catch (_e2) { /* nothing to remove */ }
    return false;
  }
}

// The age helper. A JSON payload ages from heartbeat_at; a legacy bare pid
// (no heartbeat field) ages from the file mtime, the only place the file
// age enters any decision.
function _heartbeatAgeMs(payload, st, now) {
  if (payload && payload.legacy_bare_pid !== true && Number.isFinite(payload.heartbeat_at)) {
    return Math.max(0, now - payload.heartbeat_at);
  }
  const fileAge = st && Number.isFinite(st.mtimeMs) ? now - st.mtimeMs : null;
  return fileAge === null ? null : Math.max(0, fileAge);
}

// One observation of the lock file, shared by acquire() and read().
function _observe(lockPath) {
  let st = null;
  try {
    st = fs.statSync(lockPath);
  } catch (_e) {
    return { present: false };
  }
  let raw = null;
  try {
    raw = fs.readFileSync(lockPath, 'utf8');
  } catch (_e) {
    raw = null;
  }
  const payload = raw === null ? null : _parse(raw);
  const now = Date.now();
  const obs = {
    present: true,
    raw: raw,
    payload: payload,
    corrupt: payload === null,
    pid: payload ? payload.pid : null,
    alive: false,
    heartbeat_age_ms: null,
    stale_heartbeat: false,
    pid_start_match: null,
    boot_mismatch: false,
    legacy_bare_pid: payload ? payload.legacy_bare_pid === true : false,
    started_at: payload && typeof payload.started_at === 'string' ? payload.started_at : null,
    job: payload && typeof payload.job === 'string' ? payload.job : null,
  };
  if (!payload) return obs;
  obs.alive = isPidAlive(payload.pid);
  obs.heartbeat_age_ms = _heartbeatAgeMs(payload, st, now);
  obs.stale_heartbeat = obs.heartbeat_age_ms !== null && obs.heartbeat_age_ms > HEARTBEAT_HARD_CEILING_MS;
  obs.boot_mismatch = Number.isFinite(payload.boot_ms)
    && Math.abs(payload.boot_ms - currentBootMs()) > BOOT_TOLERANCE_MS;
  if (obs.alive) {
    const recorded = Number.isFinite(payload.pid_start) ? payload.pid_start : null;
    const live = pidStartTicks(payload.pid);
    obs.pid_start_match = (recorded === null || live === null) ? null : (recorded === live);
  }
  return obs;
}

// Single-winner recovery (write-lock.cjs _recoverDeadLock): create the
// '.recover' mutex with 'wx'; a loser returns false and the caller reports
// 'recovering'; the winner re-reads the lock, unlinks it only when it still
// names the pid it observed (or the same corrupt bytes), and removes the
// mutex in finally. Returns true when the caller may retry 'wx'.
function _recover(lockPath, observed) {
  const recoverPath = lockPath + RECOVER_SUFFIX;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let fd = null;
    try {
      fd = fs.openSync(recoverPath, 'wx');
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, timestamp: Date.now() }));
      fs.closeSync(fd);
      fd = null;
    } catch (e) {
      if (fd !== null) { try { fs.closeSync(fd); } catch (_e) { /* already closed */ } }
      if (!e || e.code !== 'EEXIST') return false;
      let mutex = null;
      try {
        mutex = JSON.parse(fs.readFileSync(recoverPath, 'utf8'));
      } catch (_parseErr) {
        mutex = null;
      }
      if (mutex && isPidAlive(mutex.pid)) return false;
      try { fs.unlinkSync(recoverPath); } catch (_e) { /* already gone */ }
      continue;
    }
    try {
      let currentRaw = null;
      try {
        currentRaw = fs.readFileSync(lockPath, 'utf8');
      } catch (_readErr) {
        currentRaw = null;
      }
      let stillMatches = false;
      if (currentRaw !== null) {
        if (observed.corrupt) {
          stillMatches = currentRaw === observed.raw;
        } else {
          const current = _parse(currentRaw);
          stillMatches = current !== null && current.pid === observed.pid;
        }
      }
      if (stillMatches) {
        try { fs.unlinkSync(lockPath); } catch (_e) { /* already gone */ }
      }
      return true;
    } finally {
      try { fs.unlinkSync(recoverPath); } catch (_e) { /* already gone */ }
    }
  }
  return false;
}

function _stopTimer(handle) {
  if (handle && handle.timer) {
    try { clearInterval(handle.timer); } catch (_e) { /* already cleared */ }
    handle.timer = null;
  }
}

// Heartbeat refresh: re-read the file; when its pid or started_at is not
// ours, stop the timer and do nothing; else rewrite the payload with a fresh
// heartbeat_at through tmp plus rename.
function _heartbeat(handle) {
  try {
    let raw = null;
    try {
      raw = fs.readFileSync(handle.lockPath, 'utf8');
    } catch (_e) {
      raw = null;
    }
    const current = raw === null ? null : _parse(raw);
    if (!current || current.pid !== process.pid || current.started_at !== handle.started_at) {
      _stopTimer(handle);
      return;
    }
    const next = Object.assign({}, current, { heartbeat_at: Date.now() });
    _writeAtomic(handle.lockPath, JSON.stringify(next));
  } catch (_e) { /* advisory; the next tick retries */ }
}

function _positiveInt(v, dflt) {
  return Number.isInteger(v) && v > 0 ? v : dflt;
}

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

/*
 * acquire(lockPath, opts) -> { ok: true, handle, recovered }
 *   | { ok: false, reason: 'held' | 'recovering' | 'error', pid,
 *       heartbeat_age_ms, stale_heartbeat, pid_start_match, job }
 * opts = { job, heartbeatMs }. handle = { lockPath, pid, started_at, job, timer }.
 * Never throws.
 */
function acquire(lockPath, opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  if (typeof lockPath !== 'string' || lockPath.length === 0) {
    return { ok: false, reason: 'error', error: 'lock_path_required' };
  }
  const heartbeatMs = _positiveInt(o.heartbeatMs, DEFAULT_HEARTBEAT_MS);
  const job = typeof o.job === 'string' ? o.job : null;
  try { fs.mkdirSync(path.dirname(lockPath), { recursive: true }); } catch (_e) { /* best effort */ }
  let recovered = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const started_at = new Date().toISOString();
    const payload = {
      pid: process.pid,
      pid_start: pidStartTicks(process.pid),
      started_at: started_at,
      heartbeat_at: Date.now(),
      boot_ms: currentBootMs(),
      job: job,
      schema: SCHEMA,
    };
    let fd = null;
    try {
      fd = fs.openSync(lockPath, 'wx');
      fs.writeSync(fd, JSON.stringify(payload));
      fs.closeSync(fd);
      fd = null;
      const handle = { lockPath: lockPath, pid: process.pid, started_at: started_at, job: job, timer: null };
      handle.timer = setInterval(function tick() { _heartbeat(handle); }, heartbeatMs);
      if (handle.timer && typeof handle.timer.unref === 'function') handle.timer.unref();
      return { ok: true, handle: handle, recovered: recovered };
    } catch (e) {
      if (fd !== null) { try { fs.closeSync(fd); } catch (_e) { /* already closed */ } }
      if (!e || e.code !== 'EEXIST') {
        return { ok: false, reason: 'error', error: (e && e.code) || 'unknown' };
      }
    }
    // EEXIST: decide by liveness, identity and the boot guard. Never by age.
    let obs;
    try {
      obs = _observe(lockPath);
    } catch (_e) {
      obs = { present: true, corrupt: true, raw: null, pid: null, alive: false };
    }
    if (!obs.present) continue; // released between open and stat: retry
    let why = null;
    if (obs.corrupt) {
      why = 'corrupt';
    } else if (!obs.alive) {
      why = 'dead_pid';
    } else if (obs.boot_mismatch) {
      why = 'boot_mismatch';
    } else if (!obs.stale_heartbeat) {
      // A live owner with a heartbeat inside the ceiling: never displaced.
      return {
        ok: false, reason: 'held', pid: obs.pid, heartbeat_age_ms: obs.heartbeat_age_ms,
        stale_heartbeat: false, pid_start_match: obs.pid_start_match, job: obs.job,
      };
    } else if (obs.pid_start_match === true) {
      // The same process is alive and stuck: the doctor names it, a human stops it.
      return {
        ok: false, reason: 'held', pid: obs.pid, heartbeat_age_ms: obs.heartbeat_age_ms,
        stale_heartbeat: true, pid_start_match: true, job: obs.job,
      };
    } else {
      why = obs.pid_start_match === false ? 'stale_identity_mismatch' : 'stale_identity_unavailable';
    }
    const ok = _recover(lockPath, obs);
    if (!ok) {
      return {
        ok: false, reason: 'recovering', pid: obs.pid, heartbeat_age_ms: obs.heartbeat_age_ms,
        stale_heartbeat: obs.stale_heartbeat === true, pid_start_match: obs.pid_start_match, job: obs.job,
      };
    }
    recovered = { pid: obs.pid, reason: why };
  }
  return { ok: false, reason: 'error', error: 'retries_exhausted' };
}

/*
 * release(handle) -> { released: true } | { released: false, reason: 'not_owner' | 'missing' }
 * Clears the timer; unlinks only when the file's pid equals process.pid and
 * its started_at equals handle.started_at. Never throws.
 */
function release(handle) {
  if (!handle || typeof handle.lockPath !== 'string') return { released: false, reason: 'not_owner' };
  _stopTimer(handle);
  let raw = null;
  try {
    raw = fs.readFileSync(handle.lockPath, 'utf8');
  } catch (_e) {
    return { released: false, reason: 'missing' };
  }
  const current = _parse(raw);
  if (current && current.pid === process.pid && current.started_at === handle.started_at) {
    try {
      fs.unlinkSync(handle.lockPath);
    } catch (e) {
      if (e && e.code === 'ENOENT') return { released: false, reason: 'missing' };
      return { released: false, reason: 'not_owner' };
    }
    return { released: true };
  }
  return { released: false, reason: 'not_owner' };
}

/*
 * read(lockPath) -> { present, pid, alive, heartbeat_age_ms, stale_heartbeat,
 *   pid_start_match, started_at, job, legacy_bare_pid, boot_mismatch, corrupt }
 * Never acquires, never writes, never throws. The doctor's reader.
 */
function read(lockPath) {
  const base = {
    present: false, pid: null, alive: false, heartbeat_age_ms: null, stale_heartbeat: false,
    pid_start_match: null, started_at: null, job: null, legacy_bare_pid: false,
    boot_mismatch: false, corrupt: false,
  };
  if (typeof lockPath !== 'string' || lockPath.length === 0) return base;
  try {
    const obs = _observe(lockPath);
    if (!obs.present) return base;
    return {
      present: true,
      pid: obs.pid,
      alive: obs.alive,
      heartbeat_age_ms: obs.heartbeat_age_ms,
      stale_heartbeat: obs.stale_heartbeat,
      pid_start_match: obs.pid_start_match,
      started_at: obs.started_at,
      job: obs.job,
      legacy_bare_pid: obs.legacy_bare_pid,
      boot_mismatch: obs.boot_mismatch,
      corrupt: obs.corrupt,
    };
  } catch (_e) {
    return Object.assign({}, base, { present: true, corrupt: true });
  }
}

module.exports = {
  acquire,
  release,
  read,
  SCHEMA,
  _test: {
    isPidAlive,
    currentBootMs,
    pidStartTicks,
    BOOT_TOLERANCE_MS,
    DEFAULT_HEARTBEAT_MS,
    HEARTBEAT_HARD_CEILING_MS,
  },
};
