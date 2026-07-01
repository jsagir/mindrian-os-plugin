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

// PSB-14 -- the bind-check composes the global session binding (to read the
// bound SET / primary) so it can report whether the top room is on-scope. This
// is a LOCAL filesystem read only (no Brain call); session-binding carries the
// same zero-egress contract.
const sessionBinding = require('./session-binding.cjs');

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

// PSB-14 -- LOCAL structural room-health predicate. NO Brain call, NO network:
// room dir exists + `.room-root` sentinel present + `.mindrian/room.db` opens
// and carries `nodes` + `edges` tables. Returns { ok, findings }. Fail-OPEN by
// construction: any check error is surfaced as a FINDING (advisory), never a
// throw. A missing node:sqlite runtime degrades to ok (the check is advisory and
// binding is never hard-blocked - a can-not-inspect is not a block).
function roomDbHasTables(dbPath, required) {
  let conn = null;
  try {
    let DatabaseSync;
    try {
      ({ DatabaseSync } = require('node:sqlite'));
    } catch (_) {
      // node:sqlite absent on this runtime -> cannot inspect. Advisory-degrade
      // to ok (never-block). The default doctor run still reports overall health.
      return true;
    }
    conn = new DatabaseSync('file:' + dbPath + '?mode=ro');
    const rows = conn.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
    const names = new Set();
    for (const r of rows) {
      if (r && typeof r.name === 'string') names.add(r.name);
    }
    for (const t of required) {
      if (!names.has(t)) return false;
    }
    return true;
  } catch (_) {
    return false;
  } finally {
    if (conn) {
      try { conn.close(); } catch (_) {}
    }
  }
}

function checkRoomStructure(roomDir) {
  const findings = [];
  try {
    if (typeof roomDir !== 'string' || roomDir.length === 0 || !fs.existsSync(roomDir)) {
      return { ok: false, findings: ['room-dir-missing: ' + String(roomDir)] };
    }
    let ok = true;
    if (!fs.existsSync(path.join(roomDir, '.room-root'))) {
      ok = false;
      findings.push('missing .room-root sentinel');
    }
    const dbPath = path.join(path.resolve(roomDir), '.mindrian', 'room.db');
    if (!fs.existsSync(dbPath)) {
      ok = false;
      findings.push('missing .mindrian/room.db');
    } else if (!roomDbHasTables(dbPath, ['nodes', 'edges'])) {
      ok = false;
      findings.push('room.db missing nodes/edges tables');
    }
    return { ok: ok, findings: findings };
  } catch (e) {
    return { ok: false, findings: ['structural-check-error: ' + ((e && (e.code || e.message)) || 'unknown')] };
  }
}

// PSB-14 / D-10 -- the bind-check the doctor runs at BIND-TIME (never per-turn).
// It combines (a) binding health (is the top room a MEMBER of this session's
// bound SET) and (b) the LOCAL structural room-health predicate above, and on a
// green report REGISTERS this session in the room's presence ledger. It makes
// ZERO Brain/network call (Part 8): binding is a filesystem read, structure is a
// local read-only room.db open. Returns { healthy, bound, primary, onScope,
// findings }. NEVER throws (fail-OPEN); the caller (doctor) exits 0 regardless so
// an unhealthy bind degrades to an advisory - binding is never hard-blocked.
function runBindCheck(opts) {
  opts = (opts && typeof opts === 'object') ? opts : {};
  const findings = [];
  const sessionId = opts.sessionId;
  const home = opts.home;
  const roomDir = (typeof opts.roomDir === 'string' && opts.roomDir.length > 0) ? opts.roomDir : null;
  let topRoom = (typeof opts.topRoom === 'string' && opts.topRoom.length > 0) ? opts.topRoom : null;
  if (!topRoom && roomDir) topRoom = path.basename(path.resolve(roomDir));

  // (a) binding health -- LOCAL read of the global session binding file.
  let bound = [];
  let primary = null;
  try {
    const binding = sessionBinding.readSessionBinding(sessionId, { home: home });
    bound = Array.isArray(binding.bound) ? binding.bound : [];
    primary = (typeof binding.primary === 'string') ? binding.primary : null;
  } catch (_) {
    bound = [];
    primary = null;
  }
  const onScope = !!topRoom && bound.indexOf(topRoom) !== -1;
  if (!onScope) {
    findings.push('off-scope: session not bound to "' + (topRoom || '') + '"');
  }

  // (b) structural health -- only when a concrete roomDir is supplied (the
  // doctor CLI path). The binding-only caller (a bind-time scope probe) skips it.
  let structuralOk = true;
  if (roomDir) {
    const s = checkRoomStructure(roomDir);
    structuralOk = s.ok;
    for (const f of s.findings) findings.push(f);
  }

  const healthy = onScope && structuralOk;

  // On a green report the bind-check REGISTERS this session's presence (the
  // side-effect PSB-14 owns). registerPresence is fire-and-forget and never
  // throws. Skipped on an unhealthy report (nothing to attend to).
  if (healthy) {
    try {
      registerPresence({ sessionId: sessionId, room: topRoom, roomDir: roomDir, home: home, pid: opts.pid });
    } catch (_) {}
  }

  return { healthy: healthy, bound: bound, primary: primary, onScope: onScope, findings: findings };
}

module.exports = {
  STALE_MS,
  isAlive,
  registerPresence,
  checkRoomStructure,
  runBindCheck,
  heartbeat,
  readPresence,
  listLiveCoSessions,
  hasCoSession,
  reapStalePresence,
  reap,
  deregisterPresence,
};
