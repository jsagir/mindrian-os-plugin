'use strict';

/*
 * lib/core/session-binding.cjs -- the one canonical session-scoped active-room
 * binding module (Phase 128.1, the structural re-key core).
 *
 * This module is the keystone Plans 03a/03b repoint onto. It owns:
 *
 *   1. resolveSessionId(payload?)   -- the ONE canonical session-id resolver
 *                                      (D-05/D-06). Reconciles the three
 *                                      scout-found mechanisms into one chain.
 *   2. migrateRegistryIfNeeded(reg) -- the v2 -> v3 registry migration (D-04).
 *                                      Pure (no IO) so it is trivially testable.
 *   3. resolveActiveRoom(sessionId, opts?) -- the session-scoped room resolution
 *                                      (D-02) + lazy v2->v3 migration + tripwire
 *                                      detection (D-08).
 *   4. bindSessionRoom(sessionId, roomSlug) -- the session-scoped write (D-02)
 *                                      under a directory lockfile.
 *
 * Why this module exists (Canon Part 7 justification): D-05 mandates a SINGLE
 * canonical session-id resolver. The closest existing surface
 * (resolveSessionIdForDial inside scripts/context-monitor) is read-only,
 * dial-specific, and buried in the statusline renderer. There is no module
 * that owns the session-scoped binding role -- this is the one justified
 * net-new file.
 *
 * REUSED primitives (Canon Part 7 -- verified shipped shapes):
 *   - The v1->v2 migration template from lib/core/install-state.cjs:
 *     integer `version` sentinel, additive-only, future-version detection
 *     (sv > N -> warn on stderr + defer, never downgrade), atomic write via
 *     openSync(tmp,'w') -> writeSync -> fsyncSync -> closeSync -> renameSync.
 *   - The directory-lockfile idiom from lib/hmi/across-session-memory.cjs:
 *     a lock with a ~2s TTL stale-lock recovery + a 200ms retry budget.
 *     RESEARCH.md Pattern 2 prescribes the `mkdirSync` directory-lock variant
 *     (atomic on POSIX AND Windows Git-Bash; a failed mkdir EEXIST is the
 *     contended signal; no `flock` / npm dependency).
 *
 * Canon Part 8: this module touches ONLY local JSON + local side files. No
 * fetch, no Brain, no network. brain_impact NONE.
 *
 * CJS, zero new runtime deps, process.argv-free (it is a library), Node v22.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

// ---------------------------------------------------------------------------
// Constants.
// ---------------------------------------------------------------------------

const REGISTRY_VERSION = 3;          // the schema version this module targets
const LOCK_TTL_MS = 2000;            // stale-lock break threshold
const RETRY_BUDGET_MS = 200;         // total lock-acquire retry budget
const RETRY_SPIN_MS = 5;             // spin interval between retries

// ---------------------------------------------------------------------------
// Path resolution. Every call re-reads the env so hermetic tests can swap the
// roots between calls without a module reload.
// ---------------------------------------------------------------------------

function roomsHome() {
  return process.env.MINDRIAN_ROOMS_HOME || path.join(os.homedir(), 'MindrianRooms');
}

function registryPath() {
  return path.join(roomsHome(), '.rooms', 'registry.json');
}

function registryLockPath() {
  return registryPath() + '.lock';
}

// The per-process / per-session side-file root. MINDRIAN_HOME lets hermetic
// tests isolate it; the real root is ~/.mindrian.
function mindrianHome() {
  return process.env.MINDRIAN_HOME || path.join(os.homedir(), '.mindrian');
}

function processSessionFile() {
  return path.join(mindrianHome(), 'process-session', String(process.pid) + '.json');
}

function sessionSideFile(sessionId) {
  // The session id can contain characters unsafe for a filename; hash it.
  const safe = crypto.createHash('sha256').update(String(sessionId)).digest('hex').slice(0, 16);
  return path.join(mindrianHome(), 'session-binding', safe + '.json');
}

// ---------------------------------------------------------------------------
// Small helpers.
// ---------------------------------------------------------------------------

function logStderr(scope, err) {
  try {
    const msg = err && err.message ? String(err.message) : String(err);
    process.stderr.write('[session-binding] ' + scope + ': ' + msg.slice(0, 200) + '\n');
  } catch (_) { /* swallow logger error */ }
}

function spinSleep(ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) { /* busy-wait -- short, only under lock contention */ }
}

function nowIso() {
  return new Date().toISOString();
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

// Atomic write -- REUSED from the install-state.cjs idiom:
//   openSync(tmp,'w') -> writeSync -> fsyncSync -> closeSync -> renameSync.
// The tmp name carries pid + a random suffix so two writers never collide on
// the tmp file itself.
function atomicWriteJson(filePath, obj) {
  const tmp = filePath + '.tmp.' + process.pid + '.' + crypto.randomBytes(4).toString('hex');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, JSON.stringify(obj, null, 2) + '\n');
    try { fs.fsyncSync(fd); } catch (_) { /* fsync best-effort -- some FS lack support */ }
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, filePath);
}

// ---------------------------------------------------------------------------
// The directory lockfile (REUSED idiom -- across-session-memory.cjs, mkdirSync
// variant per RESEARCH.md Pattern 2).
//
// `fs.mkdirSync('<registry>.lock')` is atomic on POSIX AND Windows Git-Bash.
// A successful mkdir IS the lock; an EEXIST is the contended signal. 2s TTL
// stale-lock break (rmdir + retry if the lock dir's mtime is older than TTL),
// 200ms retry budget. The lock dir is removed in a finally.
//
// READS do NOT take this lock -- the atomic rename guarantees a torn-free read,
// and locking the read path would put the resolve-room 200ms budget at risk.
// ---------------------------------------------------------------------------

function withRegistryLock(fn) {
  const lockPath = registryLockPath();
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });

  const startedAt = Date.now();
  let acquired = false;

  while (Date.now() - startedAt < RETRY_BUDGET_MS) {
    try {
      fs.mkdirSync(lockPath);   // atomic create -- success == lock held
      acquired = true;
      break;
    } catch (err) {
      if (err && err.code !== 'EEXIST') {
        // A non-contention error (permissions, missing parent) -- give up the
        // lock and run unguarded rather than hard-fail. Correctness degrades
        // to the un-locked read-modify-write, but the call still completes.
        logStderr('lock mkdir', err);
        break;
      }
      // Stale-lock recovery: break a lock dir older than the TTL.
      try {
        const lockStat = fs.statSync(lockPath);
        if (Date.now() - lockStat.mtimeMs > LOCK_TTL_MS) {
          try { fs.rmdirSync(lockPath); } catch (_) { /* race; just continue */ }
          continue;
        }
      } catch (_) { /* stat race; continue */ }
      spinSleep(RETRY_SPIN_MS);
    }
  }

  try {
    return fn();
  } finally {
    if (acquired) {
      try { fs.rmdirSync(lockPath); } catch (_) { /* best-effort release */ }
    }
  }
}

// ===========================================================================
// 1. resolveSessionId -- the one canonical resolver (D-05, D-06).
// ===========================================================================

// In-module memoized cold-start id -- the last-resort fallback if the side
// file cannot be written (Pitfall 4: the id must be stable within a process).
let MEMOIZED_COLD_START_ID = null;

function generateColdStartId() {
  return 'sess-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
}

/**
 * resolveSessionId(payload?) -> string
 *
 * Priority chain (D-05):
 *   1. payload.session_id      -- a stdin-payload session id, if the caller
 *                                 passed the parsed hook payload.
 *   2. process.env.CLAUDE_SESSION_ID   -- the platform id (hooks).
 *   3. process.env.session_id          -- the statusline-context env name.
 *   4. cold-start fallback (D-06)       -- a stable per-process generated id,
 *                                         persisted so every call in the same
 *                                         process resolves the IDENTICAL id.
 *
 * Never returns null. Never throws.
 */
function resolveSessionId(payload) {
  // 1. stdin-payload.
  if (payload && typeof payload === 'object' && payload.session_id) {
    return String(payload.session_id);
  }
  // 2. CLAUDE_SESSION_ID env.
  if (process.env.CLAUDE_SESSION_ID) {
    return String(process.env.CLAUDE_SESSION_ID);
  }
  // 3. lowercase session_id env (statusline surface).
  if (process.env.session_id) {
    return String(process.env.session_id);
  }
  // 4. cold-start fallback -- generate ONCE, persist, read on every call.
  const sideFile = processSessionFile();
  try {
    const existing = readJsonSafe(sideFile);
    if (existing && existing.session_id) {
      MEMOIZED_COLD_START_ID = String(existing.session_id);
      return MEMOIZED_COLD_START_ID;
    }
  } catch (_) { /* fall through to generate */ }

  if (MEMOIZED_COLD_START_ID) {
    // The memoized value is the source of truth within this process even if
    // the side file is unreadable.
    return MEMOIZED_COLD_START_ID;
  }

  const generated = generateColdStartId();
  MEMOIZED_COLD_START_ID = generated;
  try {
    atomicWriteJson(sideFile, { session_id: generated, created_at: nowIso() });
  } catch (err) {
    // The side file could not be written -- the in-module memoized value still
    // keeps the id stable for this process lifetime.
    logStderr('cold-start persist', err);
  }
  return generated;
}

// ===========================================================================
// 2. migrateRegistryIfNeeded -- the v2 -> v3 migration (D-04). Pure, no IO.
// ===========================================================================

/**
 * migrateRegistryIfNeeded(reg) -> { migrated: boolean, reg: object }
 *
 * Mirrors install-state.cjs migrateIfNeeded:
 *   - reg.version === 3   -> no-op, { migrated: false }.
 *   - reg.version > 3     -> future-version guard: warn on stderr, return reg
 *                            untouched, { migrated: false } (never downgrade).
 *   - reg.version < 3 or absent -> additive migration:
 *       reg.sessions    = reg.sessions || {}
 *       reg.last_active = reg.last_active || reg.active || ''
 *       reg.active stays as-is (the legacy mirror -- D-04, never removed)
 *       reg.version = 3
 *       { migrated: true }.
 *
 * Pure: the CALLER does the atomic write under the lock. This makes the
 * migration trivially unit-testable (the test passes an in-memory object).
 */
function migrateRegistryIfNeeded(reg) {
  if (!reg || typeof reg !== 'object') {
    return { migrated: false, reg: reg };
  }
  const version = reg.version;

  if (version === REGISTRY_VERSION) {
    return { migrated: false, reg: reg };
  }

  if (typeof version === 'number' && version > REGISTRY_VERSION) {
    // Future-version guard -- warn + defer, never downgrade.
    process.stderr.write(
      '[session-binding] registry version ' + version + ' is newer than the plugin ' +
      'understands (' + REGISTRY_VERSION + '). Skipping migration; run /mos:doctor --fix.\n'
    );
    return { migrated: false, reg: reg };
  }

  // version < 3, or absent -- run the additive migration.
  reg.sessions = reg.sessions || {};
  reg.last_active = reg.last_active || reg.active || '';
  // reg.active is intentionally left as-is -- the legacy mirror (D-04).
  reg.version = REGISTRY_VERSION;
  return { migrated: true, reg: reg };
}

// ===========================================================================
// Side-file helpers for the tripwire (D-08).
//
// The per-session side file carries `last_resolved_room` (the room this
// session resolved at its last resolution point) and a `tripwire_warned`
// flag. The tripwire compares the freshly-read sessions[id].room against
// last_resolved_room: a mismatch the session did not itself cause is a drift
// signal. The warn-once flag stops a re-fire.
// ===========================================================================

function readSessionSide(sessionId) {
  const data = readJsonSafe(sessionSideFile(sessionId));
  if (data && typeof data === 'object') return data;
  return { last_resolved_room: null, tripwire_warned: false };
}

function writeSessionSide(sessionId, side) {
  try {
    atomicWriteJson(sessionSideFile(sessionId), side);
  } catch (err) {
    // A side file that cannot be written degrades the tripwire to "never
    // fires" rather than crashing the resolve path. The session's own binding
    // remains authoritative (D-11 -- the re-key is the primary fix).
    logStderr('session side write', err);
  }
}

// ===========================================================================
// 3. resolveActiveRoom -- session-scoped resolution + tripwire (D-02, D-08).
// ===========================================================================

/**
 * resolveActiveRoom(sessionId, opts?) -> { room, path, tripwire }
 *
 * opts.reg -- an in-memory registry object. When supplied, the resolution runs
 *   purely against that object (no disk IO, no migration write-back) -- the
 *   unit-test path. When absent, the on-disk registry is read, lazily migrated
 *   if below v3, and the first resolution for this session is written back.
 *
 * Resolution algorithm (RESEARCH.md Pattern 1):
 *   1. read + parse the registry.
 *   2. if version < 3 -> lazy-migrate under the lock (double-checked), re-read.
 *   3. bound = reg.sessions?.[sessionId]?.room
 *   4. if bound and reg.rooms[bound] and the dir exists -> resolved = bound.
 *   5. else resolved = reg.last_active then reg.active.
 *   6. on first resolution for this session, write sessions[sessionId].
 *   7. tripwire: compare the freshly-read sessions[id].room against the
 *      per-session side-file last_resolved_room.
 *
 * Returns { room, path, tripwire: { fired, expected, actual } }. Never throws.
 */
function resolveActiveRoom(sessionId, opts) {
  const inMemory = opts && opts.reg;
  let reg;

  if (inMemory) {
    // Pure in-memory path -- migrate the passed object, no disk write.
    reg = opts.reg;
    migrateRegistryIfNeeded(reg);
  } else {
    reg = readJsonSafe(registryPath());
    if (!reg || typeof reg !== 'object') {
      // No registry at all -- degrade gracefully to an empty resolution.
      return {
        room: '',
        path: '',
        tripwire: { fired: false, expected: null, actual: null },
      };
    }
    // Lazy migration under the lock with a double-checked version re-read
    // (Pitfall 6 -- two cold sessions must not both migrate-and-write).
    if (typeof reg.version !== 'number' || reg.version < REGISTRY_VERSION) {
      withRegistryLock(function () {
        const fresh = readJsonSafe(registryPath()) || reg;
        if (typeof fresh.version !== 'number' || fresh.version < REGISTRY_VERSION) {
          const out = migrateRegistryIfNeeded(fresh);
          if (out.migrated) atomicWriteJson(registryPath(), out.reg);
        }
      });
      reg = readJsonSafe(registryPath()) || reg;
    }
  }

  reg.sessions = reg.sessions || {};
  reg.rooms = reg.rooms || {};

  // Step 3-5: resolve the room.
  const bound = reg.sessions[sessionId] && reg.sessions[sessionId].room;
  let resolved = '';
  if (bound && reg.rooms[bound]) {
    resolved = bound;
  } else {
    resolved = reg.last_active || reg.active || '';
  }

  // Compute the absolute path for the resolved room.
  let absPath = '';
  if (resolved && reg.rooms[resolved] && reg.rooms[resolved].path) {
    const rawPath = reg.rooms[resolved].path;
    if (path.isAbsolute(rawPath)) {
      absPath = rawPath;
    } else {
      absPath = path.join(roomsHome(), rawPath);
    }
  }

  // Step 6: on first resolution for this session, persist sessions[id].
  if (!inMemory && resolved && !reg.sessions[sessionId]) {
    withRegistryLock(function () {
      const fresh = readJsonSafe(registryPath()) || reg;
      fresh.sessions = fresh.sessions || {};
      if (!fresh.sessions[sessionId]) {
        const ts = nowIso();
        fresh.sessions[sessionId] = { room: resolved, bound_at: ts, last_seen_at: ts };
        atomicWriteJson(registryPath(), fresh);
      }
    });
  }

  // Step 7: tripwire detection (D-08).
  let tripwire = { fired: false, expected: null, actual: null };
  if (!inMemory) {
    const side = readSessionSide(sessionId);
    const expected = side.last_resolved_room;       // what we resolved last time
    const actual = resolved;                        // what we resolve now
    if (
      expected != null &&
      expected !== actual &&
      !side.tripwire_warned
    ) {
      // The binding moved underneath this session and it was not warned yet.
      tripwire = { fired: true, expected: expected, actual: actual };
      side.tripwire_warned = true;
    } else {
      tripwire = { fired: false, expected: expected, actual: actual };
    }
    // Persist the freshly-resolved room for the next comparison.
    side.last_resolved_room = actual;
    writeSessionSide(sessionId, side);
  }

  return { room: resolved, path: absPath, tripwire: tripwire };
}

// ===========================================================================
// 4. bindSessionRoom -- the session-scoped write under the lock (D-02).
// ===========================================================================

/**
 * bindSessionRoom(sessionId, roomSlug) -> { room, path }
 *
 * Writes, under the directory lock + an atomic rename:
 *   sessions[sessionId] = { room: roomSlug, bound_at, last_seen_at }
 *   last_active = roomSlug
 *   active      = roomSlug   (the legacy mirror -- D-04)
 *
 * The migration runs INSIDE the lock with a re-checked version (double-checked
 * locking -- Pitfall 6). Updates the per-session side file's last_resolved_room
 * so a deliberate self-switch does NOT trip the tripwire (Pitfall 5).
 *
 * Never throws.
 */
function bindSessionRoom(sessionId, roomSlug) {
  let resultPath = '';
  try {
    withRegistryLock(function () {
      let reg = readJsonSafe(registryPath());
      if (!reg || typeof reg !== 'object') {
        // No registry -- create a minimal v3 shell so the bind still lands.
        reg = { version: REGISTRY_VERSION, root: '~/MindrianRooms', active: '', rooms: {} };
      }
      // Migrate under the lock (double-checked).
      if (typeof reg.version !== 'number' || reg.version < REGISTRY_VERSION) {
        migrateRegistryIfNeeded(reg);
      }
      reg.sessions = reg.sessions || {};
      reg.rooms = reg.rooms || {};

      const ts = nowIso();
      reg.sessions[sessionId] = { room: roomSlug, bound_at: ts, last_seen_at: ts };
      reg.last_active = roomSlug;
      reg.active = roomSlug;     // legacy mirror -- D-04, kept written-through.

      atomicWriteJson(registryPath(), reg);

      if (reg.rooms[roomSlug] && reg.rooms[roomSlug].path) {
        const rawPath = reg.rooms[roomSlug].path;
        resultPath = path.isAbsolute(rawPath) ? rawPath : path.join(roomsHome(), rawPath);
      }
    });

    // Pitfall 5: a deliberate switch updates the expected-binding record in
    // the same operation so the next resolve does NOT false-fire the tripwire.
    const side = readSessionSide(sessionId);
    side.last_resolved_room = roomSlug;
    side.tripwire_warned = false;   // a deliberate switch clears the warn-once flag.
    writeSessionSide(sessionId, side);
  } catch (err) {
    logStderr('bindSessionRoom', err);
  }
  return { room: roomSlug, path: resultPath };
}

// ---------------------------------------------------------------------------
// Exports -- exactly the 4 named functions the plan mandates.
// ---------------------------------------------------------------------------

module.exports = {
  resolveSessionId,
  resolveActiveRoom,
  migrateRegistryIfNeeded,
  bindSessionRoom,
};
