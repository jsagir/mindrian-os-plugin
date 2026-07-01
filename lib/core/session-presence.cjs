'use strict';
// PSB-11/12/13 -- per-room session presence ledger.
//
// Canon Part 8 (LOCAL only): each live session drops a small JSON under
// <roomDir>/.mindrian/sessions/<sessionId>.json. Liveness is a pid probe
// (process.kill(pid, 0)); the stale window is STALE_MS = 300000 (5m). This module
// carries ZERO Brain egress and zero network token. Every reader parses in
// try/catch and SKIPS corrupt entries (never throws into a hook); every writer is
// atomic (tmp + fsync + rename) and fire-and-forget. No em-dashes.
//
// Schema: { session_id, pid, bound_at: ISO, updated: ISO }. This is the PER-ROOM
// presence ("this room's live sessions") -- distinct from the GLOBAL binding in
// session-binding.cjs ("my rooms"). Do not conflate the two files.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// 5-minute stale window. It matches the shipped orphan-sweep / recent-write
// window (framework-chain-composer.cjs:94 RECENT_WRITE_WINDOW_MS = 5*60*1000),
// NOT the 5-second write-lock window (write-lock.cjs:13). Presence is a whole-
// session resource, so it gets the longer window. This is NOT a frozen-family
// scalar (MAX_K/DIAL_REACH_K/0.70/0.15 are untouched).
const STALE_MS = 300000;

function resolveHome(opts) {
  if (opts && typeof opts.home === 'string' && opts.home.length > 0) return opts.home;
  const env = process.env.MINDRIAN_ROOMS_HOME || process.env.MINDRIAN_ROOMS_ROOT;
  if (typeof env === 'string' && env.length > 0) return env;
  return path.join(os.homedir(), 'MindrianRooms');
}

// Path-traversal guard on the session-file slug before it is used as a filename.
function isSafeSlug(slug) {
  if (typeof slug !== 'string' || slug.length === 0) return false;
  if (slug.indexOf('..') !== -1) return false;
  return true;
}

// Resolve the per-room presence sessions dir. Accepts either an explicit
// `roomDir`, or {room, home} (roomDir = <home>/<room>). Pitfall 3: we target the
// `.mindrian/sessions/` SUBDIR only, never the `.mindrian/` root (which holds
// decision-traces/, write.lock, hats/).
function sessionsDir(opts) {
  let roomDir;
  if (opts && typeof opts.roomDir === 'string' && opts.roomDir.length > 0) {
    roomDir = opts.roomDir;
  } else {
    const home = resolveHome(opts);
    const room = (opts && typeof opts.room === 'string') ? opts.room : '';
    roomDir = path.join(home, room);
  }
  return path.join(roomDir, '.mindrian', 'sessions');
}

function presencePath(opts, sessionId) {
  return path.join(sessionsDir(opts), sessionId + '.json');
}

// pid liveness, cloned from write-lock.cjs:77. Signal 0 raises when the pid is
// dead (ESRCH) or otherwise not signalable; alive returns true.
function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (_) {
    return false;
  }
}

// Atomic tmp + fsync + rename, cloned from intent-classifier persistDecisionTrace.
function atomicWrite(filePath, data) {
  const dir = path.dirname(filePath);
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  const rnd = Math.random().toString(36).slice(2, 10);
  const tmpPath = filePath + '.tmp.' + process.pid + '.' + rnd + '.pres';
  let fd;
  try {
    fd = fs.openSync(tmpPath, 'wx');
  } catch (e) {
    if (e && e.code === 'EEXIST') {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      fd = fs.openSync(tmpPath, 'wx');
    } else {
      return;
    }
  }
  try {
    fs.writeSync(fd, JSON.stringify(data, null, 2));
    try { fs.fsyncSync(fd); } catch (_) {
      // ENOTSUP on tmpfs / overlayfs -- best-effort durability is acceptable.
    }
  } finally {
    try { fs.closeSync(fd); } catch (_) {}
  }
  try {
    fs.renameSync(tmpPath, filePath);
  } catch (_) {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
  }
}

function registerPresence(opts) {
  try {
    const sessionId = opts && opts.sessionId;
    if (!isSafeSlug(sessionId)) return;
    const pid = (opts && Number.isInteger(opts.pid)) ? opts.pid : process.pid;
    const now = new Date().toISOString();
    const data = {
      session_id: sessionId,
      pid: pid,
      bound_at: now,
      updated: now,
    };
    atomicWrite(presencePath(opts, sessionId), data);
  } catch (_) {
    // Fire-and-forget.
  }
}

// Refresh only `updated`, preserving bound_at. A heartbeat with no prior file
// degrades to a fresh register.
function heartbeat(opts) {
  try {
    const sessionId = opts && opts.sessionId;
    if (!isSafeSlug(sessionId)) return;
    const filePath = presencePath(opts, sessionId);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (_) {
      data = null;
    }
    if (!data || typeof data !== 'object') {
      registerPresence(opts);
      return;
    }
    data.updated = new Date().toISOString();
    atomicWrite(filePath, data);
  } catch (_) {
    // Fire-and-forget.
  }
}

// Read every parseable presence entry in the room. Corrupt entries are skipped
// (never throw). Each returned entry carries an internal `_mtimeMs` fallback for
// the age check when `updated` is unparseable.
function readPresence(opts) {
  const out = [];
  try {
    const dir = sessionsDir(opts);
    let names;
    try {
      names = fs.readdirSync(dir);
    } catch (_) {
      return out;
    }
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      const filePath = path.join(dir, name);
      try {
        const stat = fs.statSync(filePath);
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!parsed || typeof parsed !== 'object') continue;
        parsed._mtimeMs = stat.mtimeMs;
        out.push(parsed);
      } catch (_) {
        // Skip a corrupt entry; never let it break the scan.
      }
    }
  } catch (_) {
    // Never throw.
  }
  return out;
}

// The fast-path predicate substrate: which OTHER sessions are live in this room?
// Excludes the caller's own sid, dead pids, and entries older than STALE_MS.
function listLiveCoSessions(opts) {
  const mySid = opts && opts.sessionId;
  const now = Date.now();
  const live = [];
  for (const p of readPresence(opts)) {
    if (!p || p.session_id === mySid) continue;
    if (!isAlive(p.pid)) continue;
    const updatedMs = Date.parse(p.updated);
    const ageMs = Number.isFinite(updatedMs) ? (now - updatedMs) : (now - p._mtimeMs);
    if (ageMs >= STALE_MS) continue;
    live.push(p.session_id);
  }
  return live;
}

// Fast-path boolean: is ANOTHER live session bound here? When false, the caller
// takes the zero-cost single-session path (the reconcile guard stays skipped).
function hasCoSession(opts) {
  return listLiveCoSessions(opts).length > 0;
}

// Stale-reap: unlink any presence file whose pid is dead OR whose age exceeds
// STALE_MS. A live pid within the window is NEVER reaped (T-194-05: liveness is
// advisory, so a false-live only keeps a file, it never blocks). A corrupt entry
// can never be a live session, so it is reaped too. Returns the reaped sids.
function reapStalePresence(opts) {
  const reaped = [];
  const now = (opts && Number.isFinite(opts.now)) ? opts.now : Date.now();
  try {
    const dir = sessionsDir(opts);
    let names;
    try {
      names = fs.readdirSync(dir);
    } catch (_) {
      return reaped;
    }
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      const filePath = path.join(dir, name);
      let parsed = null;
      let mtimeMs = 0;
      try {
        const stat = fs.statSync(filePath);
        mtimeMs = stat.mtimeMs;
        parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (_) {
        parsed = null;
      }
      let sid = name.slice(0, -('.json'.length));
      let dead = true; // corrupt/unparseable -> reap
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.session_id === 'string') sid = parsed.session_id;
        const updatedMs = Date.parse(parsed.updated);
        const ageMs = Number.isFinite(updatedMs) ? (now - updatedMs) : (now - mtimeMs);
        dead = !isAlive(parsed.pid) || ageMs > STALE_MS;
      }
      if (dead) {
        try {
          fs.unlinkSync(filePath);
          reaped.push(sid);
        } catch (_) {}
      }
    }
  } catch (_) {
    // Never throw.
  }
  return reaped;
}

// Alias per the plan artifact export naming.
function reap(opts) {
  return reapStalePresence(opts);
}

// Idempotent: unlink the session's own presence file (no-op if absent).
function deregisterPresence(opts) {
  try {
    const sessionId = opts && opts.sessionId;
    if (!isSafeSlug(sessionId)) return;
    try {
      fs.unlinkSync(presencePath(opts, sessionId));
    } catch (_) {
      // Idempotent.
    }
  } catch (_) {
    // Fire-and-forget.
  }
}

module.exports = {
  STALE_MS,
  isAlive,
  registerPresence,
  heartbeat,
  readPresence,
  listLiveCoSessions,
  hasCoSession,
  reapStalePresence,
  reap,
  deregisterPresence,
};
