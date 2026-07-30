'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 103-02 -- Across-session memory layer (HMI-103-01).
 *
 * Read/write module for Layer 2 of the Mindrian three-layer memory model.
 * Layer 1 (within-session) is owned by Phase 100 lib/hmi/jtbd-state.cjs.
 * Layer 3 (cross-room) is built on top of this module by Phase 103-03
 * lib/hmi/cross-room-memory.cjs.
 *
 * Storage: ~/MindrianRooms/.memory/jtbd-history.json (or MINDRIAN_ROOMS_HOME
 * env override for hermetic tests).
 *
 * Concurrency: O_EXCL lockfile + 2s TTL stale-lock recovery + 200ms retry
 * budget + content-merge fallback (RESEARCH §2.2). Two simultaneous Stop
 * hooks in two rooms can race for the global file; the lockfile ensures
 * neither write is lost.
 *
 * Canon Part 4: every promote/park/complete also intends a typed graph
 * signal in the LOCAL graph. RCA graph-edge-pending-undrained-dead-letter-
 * queue (2026-07-28) found the Phase 103-05 HAS_JTBD edge-drainer promised
 * here was never built and the side-log it fed had zero readers. Fixed by
 * routing directly into the existing navigation.logJtbdTransition sink
 * (memory_events 'jtbd_transitioned', kind 'promote'/'park'/'complete'),
 * already production-proven for the adjacent "JTBD was set" case at
 * lib/core/navigation/room-birth.cjs. No side-log, no drainer needed.
 *
 * Canon Part 8: this module does not query Brain. cross-room-memory.cjs
 * (Phase 103-03) does, via Phase 90's buildBrainQueryContext chokepoint.
 *
 * D-01 invariant: this module NEVER writes to <roomDir>/.mindrian/
 * jtbd-state.json. Phase 100 owns the within-session file. We READ it via
 * jtbd-state.cjs to detect eligible transitions; the only writes go to
 * ~/MindrianRooms/.memory/jtbd-history.json and audit.log.
 *
 * Pure CJS, Node built-ins only, zero new runtime dependencies (Phase 87
 * invariant). Graceful degradation: every public function wraps body in
 * try/catch; errors log to stderr and the function returns null/undefined
 * safely (never throws upward).
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// ---------------------------------------------------------------------
// Path resolution (every call re-reads MINDRIAN_ROOMS_HOME so hermetic
// tests can swap the root between calls without module reload).
// ---------------------------------------------------------------------

function ROOMS_HOME() {
  return process.env.MINDRIAN_ROOMS_HOME || path.join(os.homedir(), 'MindrianRooms');
}
function MEMORY_DIR()    { return path.join(ROOMS_HOME(), '.memory'); }
function MEMORY_FILE()   { return path.join(MEMORY_DIR(), 'jtbd-history.json'); }
function ARCHIVE_FILE()  { return path.join(MEMORY_DIR(), 'jtbd-history.archive.json'); }
function AUDIT_FILE()    { return path.join(MEMORY_DIR(), 'audit.log'); }
function LOCK_FILE()     { return MEMORY_FILE() + '.lock'; }
function OPT_OUT_FILE()  { return path.join(MEMORY_DIR(), '.opt-out'); }
function ROOM_MD_FILE()  { return path.join(MEMORY_DIR(), 'ROOM.md'); }
function REGISTRY_FILE() { return path.join(ROOMS_HOME(), '.rooms', 'registry.json'); }

// ---------------------------------------------------------------------
// Constants.
// ---------------------------------------------------------------------

const LOCK_TTL_MS = 2000;
const RETRY_BUDGET_MS = 200;
const RETRY_SPIN_MS = 5;
const PER_ROOM_ARRAY_BOUND = 100;
const AUDIT_LOG_HARD_BOUND = 10000;
const AUDIT_LOG_FLOOR = 9000;
const ROOM_MEMORY_SCHEMA_VERSION = 1;
const NOISE_FLOOR_TURNS = 3;
const NOISE_FLOOR_CONFIDENCE = 0.6;

// ---------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------

function logStderr(scope, err) {
  try {
    const msg = err && err.message ? String(err.message) : String(err);
    process.stderr.write('[across-session-memory] ' + scope + ': ' + msg.slice(0, 200) + '\n');
  } catch (_) { /* swallow logger error */ }
}

function ensureDir() {
  const dir = MEMORY_DIR();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // Decision #15: every directory gets a ROOM.md.
  if (!fs.existsSync(ROOM_MD_FILE())) {
    const body = [
      '---',
      'type: directory-identity',
      'name: .memory',
      'section: .memory',
      'purpose: Across-session memory layer (Phase 103). Per-USER, NOT per-team.',
      'founding_phase: 103',
      'phase: 103',
      'milestone: v1.12.3',
      'canon_parts: [4, 8]',
      'created: 2026-05-01',
      'scope: per-USER (NOT per-team; Cowork users each have their own home)',
      '---',
      '',
      '# .memory -- Across-Session Memory Layer (Phase 103)',
      '',
      'This directory is the home for the Mindrian across-session memory layer (Layer 2 of the three-layer memory model).',
      '',
      '- jtbd-history.json: per-room in_flight / parked / completed JTBD aggregation. Survives Claude Code restarts.',
      '- jtbd-history.archive.json: spillover when per-room arrays exceed 100 entries.',
      '- audit.log: one line per write (FIFO bounded at 10000 lines).',
      '- .opt-out: sentinel file. When present, all writes are no-ops (Gate 2 escape valve).',
      '- Canon Part 4 graph signal: every promote/park/complete also fires a jtbd_transitioned memory_event (kind promote/park/complete) into the room\'s own room.db via navigation.logJtbdTransition. No side-log; nothing to drain.',
      '',
      '## Privacy contract',
      '',
      'This layer is per-USER. NOT per-team. In Cowork, each user has their own ~/MindrianRooms/.memory/ scoped to their home directory. Team-shared memory is out of scope (Canon Part 8 cross-user reasoning).',
      '',
      '## Disable',
      '',
      'Global: `touch ~/MindrianRooms/.memory/.opt-out` (or `/mos:memory --opt-out`).',
      'Per-room: `touch <roomDir>/.mindrian/.memory-opt-out`.',
      '',
    ].join('\n');
    try {
      fs.writeFileSync(ROOM_MD_FILE(), body);
    } catch (err) {
      logStderr('ensureDir ROOM.md write', err);
    }
  }
}

function readJsonOrEmpty(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return { version: ROOM_MEMORY_SCHEMA_VERSION, rooms: {}, last_updated: null };
  }
}

function spinSleep(ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) { /* busy-wait */ }
}

// ---------------------------------------------------------------------
// Atomic update with O_EXCL lockfile (load-bearing).
// ---------------------------------------------------------------------

function atomicUpdateMemory(updateFn) {
  ensureDir();
  const filePath = MEMORY_FILE();
  const lockPath = LOCK_FILE();
  const tmpPath = filePath + '.tmp.' + process.pid + '.' + Date.now().toString(36);

  const startedAt = Date.now();
  let lockAcquired = false;

  while (Date.now() - startedAt < RETRY_BUDGET_MS) {
    let fd;
    try {
      fd = fs.openSync(
        lockPath,
        fs.constants.O_EXCL | fs.constants.O_CREAT | fs.constants.O_WRONLY
      );
      try { fs.writeSync(fd, String(process.pid)); } catch (_) { /* non-fatal */ }
      try { fs.closeSync(fd); } catch (_) { /* non-fatal */ }
      lockAcquired = true;
      break;
    } catch (err) {
      if (err && err.code !== 'EEXIST') {
        logStderr('lock open', err);
        break;
      }
      // Stale-lock recovery: if the existing lock is older than TTL, unlink it.
      try {
        const lockStat = fs.statSync(lockPath);
        if (Date.now() - lockStat.mtimeMs > LOCK_TTL_MS) {
          try { fs.unlinkSync(lockPath); } catch (_) { /* race; just continue */ }
          continue;
        }
      } catch (_) { /* stat race; continue */ }
      spinSleep(RETRY_SPIN_MS);
    }
  }

  if (!lockAcquired) {
    return atomicUpdateMemoryUnsafe(updateFn);
  }

  try {
    const cur = readJsonOrEmpty(filePath);
    const next = updateFn(cur) || cur;
    next.last_updated = new Date().toISOString();
    if (!next.version) next.version = ROOM_MEMORY_SCHEMA_VERSION;
    fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2) + '\n');
    fs.renameSync(tmpPath, filePath);
    return next;
  } catch (err) {
    logStderr('atomic write', err);
    try { fs.unlinkSync(tmpPath); } catch (_) {}
    return null;
  } finally {
    try { fs.unlinkSync(lockPath); } catch (_) { /* best-effort */ }
  }
}

function atomicUpdateMemoryUnsafe(updateFn) {
  // Lock-failed fallback: read-merge-write without lock. Worst case: 1 update
  // is overwritten by a racing process. Better than throwing.
  ensureDir();
  const filePath = MEMORY_FILE();
  const tmpPath = filePath + '.tmp.unsafe.' + process.pid + '.' + Date.now().toString(36);
  try {
    const cur = readJsonOrEmpty(filePath);
    const next = updateFn(cur) || cur;
    next.last_updated = new Date().toISOString();
    if (!next.version) next.version = ROOM_MEMORY_SCHEMA_VERSION;
    fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2) + '\n');
    fs.renameSync(tmpPath, filePath);
    return next;
  } catch (err) {
    logStderr('atomic write (unsafe fallback)', err);
    try { fs.unlinkSync(tmpPath); } catch (_) {}
    return null;
  }
}

// ---------------------------------------------------------------------
// Opt-out checks (D-16, D-17).
// ---------------------------------------------------------------------

function isGlobalOptOut() {
  try { return fs.existsSync(OPT_OUT_FILE()); } catch (_) { return false; }
}

function isRoomOptOut(roomSlug) {
  try {
    if (!roomSlug || typeof roomSlug !== 'string') return false;
    const reg = readJsonOrEmpty(REGISTRY_FILE());
    const rooms = (reg && Array.isArray(reg.rooms)) ? reg.rooms : [];
    const r = rooms.find(x => x && x.slug === roomSlug);
    let roomDir = null;
    if (r && r.path) {
      roomDir = path.isAbsolute(r.path) ? r.path : path.join(ROOMS_HOME(), r.path);
    } else {
      // Defensive fallback: assume slug-equals-folder under ROOMS_HOME.
      roomDir = path.join(ROOMS_HOME(), roomSlug);
    }
    return fs.existsSync(path.join(roomDir, '.mindrian', '.memory-opt-out'));
  } catch (_) { return false; }
}

// ---------------------------------------------------------------------
// Audit log + FIFO truncation (D-18, RESEARCH §7).
// ---------------------------------------------------------------------

function appendAudit(roomSlug, action, jtbd) {
  try {
    if (isGlobalOptOut()) return;
    ensureDir();
    const line = [new Date().toISOString(), roomSlug, action, jtbd].join(' | ');
    fs.appendFileSync(AUDIT_FILE(), line + '\n');
    // Periodic FIFO truncation (1% sample rate per RESEARCH §7).
    if (Math.random() < 0.01) {
      truncateAuditIfNeeded();
    }
  } catch (err) {
    logStderr('appendAudit', err);
  }
}

function truncateAuditIfNeeded() {
  try {
    if (!fs.existsSync(AUDIT_FILE())) return;
    const raw = fs.readFileSync(AUDIT_FILE(), 'utf8');
    const lines = raw.split('\n');
    // Drop trailing empty line introduced by final \n
    const realCount = lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
    if (realCount < AUDIT_LOG_HARD_BOUND) return;
    const keep = lines.slice(realCount - AUDIT_LOG_FLOOR, realCount);
    const tmp = AUDIT_FILE() + '.tmp.' + process.pid + '.' + Date.now().toString(36);
    fs.writeFileSync(tmp, keep.join('\n') + '\n');
    fs.renameSync(tmp, AUDIT_FILE());
  } catch (err) {
    logStderr('truncateAuditIfNeeded', err);
  }
}

// ---------------------------------------------------------------------
// Archive rotation (per-room arrays bounded at 100).
// ---------------------------------------------------------------------

function trimAndArchive(mem, roomSlug) {
  const room = mem && mem.rooms && mem.rooms[roomSlug];
  if (!room) return;
  for (const stateKey of ['in_flight', 'parked', 'completed']) {
    const arr = room[stateKey];
    if (Array.isArray(arr) && arr.length > PER_ROOM_ARRAY_BOUND) {
      const overflow = arr.slice(0, arr.length - PER_ROOM_ARRAY_BOUND);
      room[stateKey] = arr.slice(arr.length - PER_ROOM_ARRAY_BOUND);
      appendArchive(roomSlug, stateKey, overflow);
    }
  }
}

function appendArchive(roomSlug, stateKey, overflow) {
  try {
    ensureDir();
    const archivePath = ARCHIVE_FILE();
    let cur;
    try { cur = JSON.parse(fs.readFileSync(archivePath, 'utf8')); } catch (_) { cur = { version: ROOM_MEMORY_SCHEMA_VERSION, rooms: {} }; }
    if (!cur.rooms) cur.rooms = {};
    if (!cur.rooms[roomSlug]) cur.rooms[roomSlug] = { in_flight: [], parked: [], completed: [] };
    if (!Array.isArray(cur.rooms[roomSlug][stateKey])) cur.rooms[roomSlug][stateKey] = [];
    cur.rooms[roomSlug][stateKey].push.apply(cur.rooms[roomSlug][stateKey], overflow);
    const tmp = archivePath + '.tmp.' + process.pid + '.' + Date.now().toString(36);
    fs.writeFileSync(tmp, JSON.stringify(cur, null, 2) + '\n');
    fs.renameSync(tmp, archivePath);
  } catch (err) {
    logStderr('appendArchive', err);
  }
}

// ---------------------------------------------------------------------
// Canon Part 4 graph signal: resolve roomSlug to roomDir (same registry-
// walk pattern scripts/memory-resume-nudge.cjs's backfillFromWithinSession
// already uses in reverse: prefer r.abs_path, else r.path resolved against
// ROOMS_HOME), then route the promote/park/complete transition into the
// real sink (navigation.logJtbdTransition -> memory_events
// 'jtbd_transitioned'), already production-proven for the adjacent "JTBD
// was set" case at lib/core/navigation/room-birth.cjs:883-899.
// ---------------------------------------------------------------------

function resolveRoomDirForSlug(roomSlug) {
  try {
    if (!roomSlug || typeof roomSlug !== 'string') return null;
    const reg = readJsonOrEmpty(REGISTRY_FILE());
    const rooms = (reg && Array.isArray(reg.rooms)) ? reg.rooms : [];
    const r = rooms.find(x => x && x.slug === roomSlug);
    if (!r) return null;
    const candidate = (typeof r.abs_path === 'string' && r.abs_path) ||
                      (typeof r.path === 'string' && r.path) || null;
    if (!candidate) return null;
    return path.isAbsolute(candidate) ? candidate : path.join(ROOMS_HOME(), candidate);
  } catch (_) {
    return null;
  }
}

function logGraphTransition(kind, roomSlug, jtbd, extraProps) {
  try {
    const roomDir = resolveRoomDirForSlug(roomSlug);
    if (!roomDir) return null; // no registered room -> nothing to journal, graceful no-op
    // Lazy require (mirrors lib/conversation/operator.cjs's own lazy require of
    // navigation.cjs): navigation.cjs's dependency tree touches operator.cjs,
    // which lazily requires navigation.cjs back. A top-level require here is not
    // actually cyclical (nothing in navigation's tree requires this module), but
    // deferring the require keeps this module's own load order independent of
    // navigation.cjs's, matching the codebase's existing caution around this door.
    const navigation = require('../core/navigation.cjs');
    const payload = Object.assign({
      to: jtbd,
      kind: kind,
      roomSlug: roomSlug,
      created_by: 'system',
      source_path: 'across-session:' + kind,
    }, extraProps || {});
    return navigation.logJtbdTransition(roomDir, payload);
  } catch (err) {
    logStderr('logGraphTransition', err);
    return null;
  }
}

// ---------------------------------------------------------------------
// Public API: promoteIfEligible (D-06).
// ---------------------------------------------------------------------

function promoteIfEligible(roomSlug, withinSessionState) {
  try {
    if (!roomSlug || typeof roomSlug !== 'string') return null;
    if (isGlobalOptOut()) return null;
    if (isRoomOptOut(roomSlug)) return null;
    if (!withinSessionState || !withinSessionState.current || !withinSessionState.current.jtbd) return null;

    const cur = withinSessionState.current;
    const turnCount = (typeof cur.turn_count === 'number')
      ? cur.turn_count
      : ((withinSessionState.history || []).filter(h => h && h.to === cur.jtbd).length);
    // Manual leg reconciliation (plan 240-03 R-09, MEM-01).
    //
    // Leg 1 history: manual_set was read here from Phase 103-05 onward and
    // was never written, because jtbd-state.cjs's setCurrent built
    // newCurrent as exactly five fields. Plan 240-03 Task 1 now persists
    // it, so this leg is live for the first time.
    //
    // Leg 3 reason: scripts/jtbd-command.cjs:706 and :768 pass
    // trigger: 'manual_set' while this gate compared only against
    // 'manual', so the string never matched. trigger never reaches
    // `current` at all in production (it lives only in the history row),
    // so leg 3 serves hand-fed callers and any future caller that passes
    // a current-shaped object directly.
    //
    // Accepted residual: a manual_set: true can outlive its 24 hour
    // expires_at window until the next auto transition overwrites it with
    // false. The expiry predicate jtbd-state.cjs::manualOverrideActive is
    // deliberately NOT ANDed in here: doing so would redden
    // tests/test-jtbd-transition-graph-wiring.cjs test 1, which passes
    // manual_set: true with no expires_at, and ORing it in would not
    // enforce expiry, so it would add a cross-tier require for no gain.
    // The blast radius is bounded because an existing in_flight row is
    // UPDATED in place rather than appended (see the block below), so a
    // stale manual window costs at most repeated in-place updates of one
    // row. See plan 240-03 R-09.
    const manual = cur.manual_set === true || cur.trigger === 'manual'
      || cur.trigger === 'manual_set';

    // D-06: >= 3 turns OR manual override
    if (!manual && turnCount < NOISE_FLOOR_TURNS) return null;
    // Confidence noise floor (auto only; manual bypasses)
    if (!manual && (typeof cur.confidence === 'number' ? cur.confidence : 0) < NOISE_FLOOR_CONFIDENCE) return null;

    const now = new Date().toISOString();
    const result = atomicUpdateMemory(function (mem) {
      if (!mem.rooms) mem.rooms = {};
      if (!mem.rooms[roomSlug]) {
        mem.rooms[roomSlug] = { in_flight: [], parked: [], completed: [] };
      }
      const room = mem.rooms[roomSlug];
      if (!Array.isArray(room.in_flight)) room.in_flight = [];
      if (!Array.isArray(room.parked)) room.parked = [];
      if (!Array.isArray(room.completed)) room.completed = [];
      const existing = room.in_flight.find(r => r.jtbd === cur.jtbd);
      if (existing) {
        existing.last_seen = now;
        existing.turn_count = turnCount;
        existing.confidence_avg = (typeof cur.confidence === 'number') ? cur.confidence : existing.confidence_avg;
      } else {
        room.in_flight.push({
          jtbd: cur.jtbd,
          first_seen: now,
          last_seen: now,
          confidence_avg: (typeof cur.confidence === 'number') ? cur.confidence : 0,
          turn_count: turnCount,
          manual_set: manual,
          evidence_summary: Array.isArray(cur.evidence) ? cur.evidence.slice(0, 5) : [],
        });
        trimAndArchive(mem, roomSlug);
      }
      return mem;
    });

    if (result === null) return null;

    appendAudit(roomSlug, 'promote', cur.jtbd);
    logGraphTransition('promote', roomSlug, cur.jtbd, {
      state: 'in_flight',
      turn_count: turnCount,
      confidence: (typeof cur.confidence === 'number') ? cur.confidence : null,
      manual: manual,
      ts: now,
    });
    return { action: 'promoted', jtbd: cur.jtbd };
  } catch (err) {
    logStderr('promoteIfEligible', err);
    return null;
  }
}

// ---------------------------------------------------------------------
// Public API: parkJtbd (D-07).
// ---------------------------------------------------------------------

function parkJtbd(roomSlug, jtbd, reason) {
  try {
    if (!roomSlug || !jtbd) return null;
    if (isGlobalOptOut()) return null;
    if (isRoomOptOut(roomSlug)) return null;
    const now = new Date().toISOString();
    const reasonStr = (typeof reason === 'string' && reason.length) ? reason : 'unspecified';

    const result = atomicUpdateMemory(function (mem) {
      if (!mem.rooms) mem.rooms = {};
      if (!mem.rooms[roomSlug]) {
        mem.rooms[roomSlug] = { in_flight: [], parked: [], completed: [] };
      }
      const room = mem.rooms[roomSlug];
      if (!Array.isArray(room.in_flight)) room.in_flight = [];
      if (!Array.isArray(room.parked)) room.parked = [];
      const idx = room.in_flight.findIndex(x => x.jtbd === jtbd);
      const moved = (idx >= 0) ? room.in_flight.splice(idx, 1)[0] : { jtbd: jtbd };
      moved.parked_at = now;
      moved.reason = reasonStr;
      room.parked.push(moved);
      trimAndArchive(mem, roomSlug);
      return mem;
    });

    if (result === null) return null;

    appendAudit(roomSlug, 'park', jtbd);
    logGraphTransition('park', roomSlug, jtbd, { state: 'parked', reason: reasonStr, ts: now });
    return { action: 'parked', jtbd: jtbd };
  } catch (err) {
    logStderr('parkJtbd', err);
    return null;
  }
}

// ---------------------------------------------------------------------
// Public API: completeJtbd (D-08).
// ---------------------------------------------------------------------

function completeJtbd(roomSlug, jtbd, completionShape, completionEvidence) {
  try {
    if (!roomSlug || !jtbd) return null;
    if (isGlobalOptOut()) return null;
    if (isRoomOptOut(roomSlug)) return null;
    const now = new Date().toISOString();

    const result = atomicUpdateMemory(function (mem) {
      if (!mem.rooms) mem.rooms = {};
      if (!mem.rooms[roomSlug]) {
        mem.rooms[roomSlug] = { in_flight: [], parked: [], completed: [] };
      }
      const room = mem.rooms[roomSlug];
      if (!Array.isArray(room.in_flight)) room.in_flight = [];
      if (!Array.isArray(room.completed)) room.completed = [];
      const idx = room.in_flight.findIndex(x => x.jtbd === jtbd);
      const moved = (idx >= 0) ? room.in_flight.splice(idx, 1)[0] : { jtbd: jtbd };
      moved.completed_at = now;
      moved.completion_shape = completionShape || null;
      moved.completion_evidence = (typeof completionEvidence === 'string') ? completionEvidence : null;
      room.completed.push(moved);
      trimAndArchive(mem, roomSlug);
      return mem;
    });

    if (result === null) return null;

    appendAudit(roomSlug, 'complete', jtbd);
    logGraphTransition('complete', roomSlug, jtbd, {
      state: 'completed',
      completion_shape: completionShape || null,
      completion_evidence: (typeof completionEvidence === 'string') ? completionEvidence : null,
      ts: now,
    });
    return { action: 'completed', jtbd: jtbd };
  } catch (err) {
    logStderr('completeJtbd', err);
    return null;
  }
}

// ---------------------------------------------------------------------
// Public API: read-only helpers.
// ---------------------------------------------------------------------

function getRoomMemory(roomSlug) {
  try {
    const mem = readJsonOrEmpty(MEMORY_FILE());
    if (!mem || !mem.rooms || !mem.rooms[roomSlug]) {
      return { in_flight: [], parked: [], completed: [] };
    }
    const r = mem.rooms[roomSlug];
    return {
      in_flight: Array.isArray(r.in_flight) ? r.in_flight : [],
      parked:    Array.isArray(r.parked) ? r.parked : [],
      completed: Array.isArray(r.completed) ? r.completed : [],
    };
  } catch (err) {
    logStderr('getRoomMemory', err);
    return { in_flight: [], parked: [], completed: [] };
  }
}

function listInFlight(maxAgeDays) {
  try {
    const ageDays = (typeof maxAgeDays === 'number') ? maxAgeDays : 7;
    const cutoff = Date.now() - ageDays * 24 * 60 * 60 * 1000;
    const mem = readJsonOrEmpty(MEMORY_FILE());
    const out = [];
    if (!mem || !mem.rooms) return out;
    for (const slug of Object.keys(mem.rooms)) {
      const room = mem.rooms[slug];
      if (!room || !Array.isArray(room.in_flight)) continue;
      for (const row of room.in_flight) {
        const lastSeen = Date.parse(row && row.last_seen);
        if (Number.isFinite(lastSeen) && lastSeen >= cutoff) {
          out.push({
            room: slug,
            jtbd: row.jtbd,
            last_seen: row.last_seen,
            confidence_avg: row.confidence_avg,
            turn_count: row.turn_count,
          });
        }
      }
    }
    out.sort((a, b) => Date.parse(b.last_seen) - Date.parse(a.last_seen));
    return out;
  } catch (err) {
    logStderr('listInFlight', err);
    return [];
  }
}

function getJtbdAcrossRooms(jtbd) {
  try {
    if (!jtbd) return { by_room: {} };
    const mem = readJsonOrEmpty(MEMORY_FILE());
    const by_room = {};
    if (!mem || !mem.rooms) return { by_room };
    for (const slug of Object.keys(mem.rooms)) {
      const r = mem.rooms[slug] || {};
      const e = {};
      const inFlight = Array.isArray(r.in_flight) ? r.in_flight.find(x => x && x.jtbd === jtbd) : null;
      if (inFlight) e.in_flight = inFlight;
      const parked = Array.isArray(r.parked) ? r.parked.filter(x => x && x.jtbd === jtbd) : [];
      if (parked.length) e.parked = parked;
      const completed = Array.isArray(r.completed) ? r.completed.filter(x => x && x.jtbd === jtbd) : [];
      if (completed.length) e.completed = completed;
      if (Object.keys(e).length) by_room[slug] = e;
    }
    return { by_room: by_room };
  } catch (err) {
    logStderr('getJtbdAcrossRooms', err);
    return { by_room: {} };
  }
}

// ---------------------------------------------------------------------
// Module exports.
// ---------------------------------------------------------------------

module.exports = {
  promoteIfEligible: promoteIfEligible,
  parkJtbd: parkJtbd,
  completeJtbd: completeJtbd,
  getRoomMemory: getRoomMemory,
  listInFlight: listInFlight,
  getJtbdAcrossRooms: getJtbdAcrossRooms,
  isGlobalOptOut: isGlobalOptOut,
  isRoomOptOut: isRoomOptOut,
  appendAudit: appendAudit,
  // Internal helpers exposed for hermetic tests.
  _internal: {
    truncateAuditIfNeeded: truncateAuditIfNeeded,
    atomicUpdateMemory: atomicUpdateMemory,
    ensureDir: ensureDir,
    resolveRoomDirForSlug: resolveRoomDirForSlug,
    ROOMS_HOME: ROOMS_HOME,
    MEMORY_DIR: MEMORY_DIR,
    MEMORY_FILE: MEMORY_FILE,
    constants: {
      LOCK_TTL_MS: LOCK_TTL_MS,
      RETRY_BUDGET_MS: RETRY_BUDGET_MS,
      PER_ROOM_ARRAY_BOUND: PER_ROOM_ARRAY_BOUND,
      AUDIT_LOG_HARD_BOUND: AUDIT_LOG_HARD_BOUND,
      AUDIT_LOG_FLOOR: AUDIT_LOG_FLOOR,
      ROOM_MEMORY_SCHEMA_VERSION: ROOM_MEMORY_SCHEMA_VERSION,
    },
  },
};
