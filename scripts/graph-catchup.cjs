#!/usr/bin/env node
'use strict';

/*
 * scripts/graph-catchup.cjs -- Phase 367 design 5.2: the detached catch-up
 * runner (files leg; plan 367-08 adds the card leg).
 *
 * The graph is a generated index of the room files (design section 2, ICM
 * framing). One run, for every candidate room, diffs the room's content files
 * (lib/core/content-artifacts.cjs listContentArtifacts, the one shared set)
 * against room.db by content hash and indexes what is missing or changed, in
 * bounded batches, and writes an honest status file.
 *
 * Usage:
 *   node scripts/graph-catchup.cjs --cwd <dir> [--session <id>]
 *     --trigger stop|session_start|mcp_call [--room <dir>]...
 *     [--run-seam <n>] [--hold-ms <n>] [--trace-tx <file>]
 *
 * Canon Part 8: local files only. No network, no Brain call.
 * Canon Part 9: an Artifact node is system bookkeeping (epistemic_type
 * observation, written by lazygraph _indexArtifactBody); the runner confirms
 * no truth-claim.
 *
 * The runner is born on the Phase 400.3-01 primitives (openGraph mustExist
 * and busyMs, write-lock acquireLockWithBackoff, graph-ops
 * INDEX_LOCK_WAIT_MS and classifyIndexError). Plan 400.3-01 is on main, so
 * the temporary substitutes that design r7 section 4 describes are not built.
 *
 * The heavy modules are required as module objects (writeLock.x, never a
 * destructured copy), so a preload in a test can stub a function.
 *
 * No em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const writeLock = require('../lib/core/write-lock.cjs');
const graphOps = require('../lib/core/graph-ops.cjs');
const lazygraph = require('../lib/core/lazygraph-ops.cjs');
const navigation = require('../lib/core/navigation.cjs');
const jobLock = require('../lib/core/job-lock.cjs');
const contentArtifacts = require('../lib/core/content-artifacts.cjs');
const bgWorker = require('../lib/core/bg-worker.cjs');
const roomRoot = require('../lib/core/room-root.cjs');
const activeRoom = require('../lib/core/resolve-active-room.cjs');

const TRIGGERS = ['stop', 'session_start', 'mcp_call'];
const BACKSTOP_MS = 30000;
const RUN_BUDGET_MS = 15000;
const BATCH_MAX_FILES = 10;
const BATCH_MAX_MS = 250;
const HOLD_CAP_MS = 25000;
// The opener busy timeout: the 5000 ms default of openGraph, written
// explicitly. The runner is a detached child with no hook budget (design
// section 4); no measurement asks for another value.
const OPEN_BUSY_MS = 5000;

const STATE_RANK = { complete: 0, partial: 1, deferred: 2, failed: 3 };

// ---------------------------------------------------------------- arguments

/**
 * parseArgs(argv) -> {cwd, session, trigger, rooms, runSeam, holdMs, traceTx, error}
 * A switch-case router; no argument library.
 */
function parseArgs(argv) {
  const out = { cwd: null, session: null, trigger: null, rooms: [], runSeam: null, holdMs: null, traceTx: null, error: null };
  const a = Array.isArray(argv) ? argv : [];
  for (let i = 0; i < a.length; i += 1) {
    const k = a[i];
    switch (k) {
      case '--cwd':
        out.cwd = a[i + 1] || null; i += 1; break;
      case '--session': {
        const v = a[i + 1];
        out.session = typeof v === 'string' && v.length > 0 && !v.startsWith('--') ? v : null;
        if (typeof v === 'string' && !v.startsWith('--')) i += 1;
        break;
      }
      case '--trigger':
        out.trigger = a[i + 1] || null; i += 1; break;
      case '--room':
        if (a[i + 1]) out.rooms.push(a[i + 1]);
        i += 1; break;
      case '--run-seam': {
        const n = Number(a[i + 1]);
        out.runSeam = Number.isInteger(n) && n > 0 ? n : null; i += 1; break;
      }
      case '--hold-ms': {
        const n = Number(a[i + 1]);
        out.holdMs = Number.isFinite(n) && n > 0 ? n : null; i += 1; break;
      }
      case '--trace-tx':
        out.traceTx = a[i + 1] || null; i += 1; break;
      default:
        break; // unknown arguments are ignored
    }
  }
  if (!TRIGGERS.includes(out.trigger)) out.error = 'graph-catchup: --trigger must be one of ' + TRIGGERS.join(', ');
  return out;
}

// ---------------------------------------------------------------- small helpers

function _stderr(line) {
  try { process.stderr.write(line + '\n'); } catch (_e) { /* ignore */ }
}

function _iso(ms) {
  return new Date(ms).toISOString();
}

function _sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function _realpath(p) {
  try { return fs.realpathSync(p); } catch (_e) { return null; }
}

function _hasRoomRoot(dir) {
  try { return fs.statSync(path.join(dir, '.room-root')).isFile(); } catch (_e) { return false; }
}

function _roomDbPath(room) {
  return path.join(room, '.mindrian', 'room.db');
}

// Atomic JSON write: a temp file with mode 0600, then rename.
function _writeJsonAtomic(file, obj) {
  const tmp = file + '.' + process.pid + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj), { mode: 0o600 });
  try { fs.chmodSync(tmp, 0o600); } catch (_e) { /* best effort on win32 */ }
  fs.renameSync(tmp, file);
}

function _worse(a, b) {
  return (STATE_RANK[b] || 0) > (STATE_RANK[a] || 0) ? b : a;
}

// ---------------------------------------------------------------- room set (design 5.2 step 2)

function _roomsHome() {
  const os = require('node:os');
  return process.env.MINDRIAN_ROOMS_HOME
    || path.join(process.env.HOME || process.env.USERPROFILE || os.homedir(), 'MindrianRooms');
}

// The real paths of every registered room that exists.
function _registeredRoomPaths() {
  const out = new Set();
  try {
    const home = _roomsHome();
    // resolve-active-room.cjs does not export readRegistry; this is the same read.
    let reg = null;
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(home, '.rooms', 'registry.json'), 'utf8'));
      reg = parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_e) { reg = null; }
    let slugs = [];
    if (reg && Array.isArray(reg.rooms)) {
      slugs = reg.rooms.map((r) => r && (r.slug || r.name)).filter(Boolean);
    } else if (reg && reg.rooms && typeof reg.rooms === 'object') {
      slugs = Object.keys(reg.rooms);
    }
    for (const slug of slugs) {
      const p = activeRoom.registryRoomPath(home, slug, reg);
      const rp = p ? _realpath(p) : null;
      if (rp) out.add(rp);
    }
  } catch (_e) { /* no registry: no registered rooms */ }
  return out;
}

function _sessionRoom(sessionId) {
  if (!sessionId) return null;
  try {
    const sr = require('../lib/mcp/session-room.cjs');
    const hit = sr.resolveMcpSessionRoom({ sessionId: sessionId, noFloor: true, quiet: true });
    // The resolver falls back to the registry with source reg.active; only a
    // real session binding counts here.
    return hit && hit.source === 'session.primary' && hit.dir ? hit.dir : null;
  } catch (_e) {
    return null;
  }
}

/**
 * The candidate rooms, deduplicated by realpath, in order: the cwd room, the
 * session room, the --room values, the registry active room. A --room value
 * counts when it holds .room-root or is a registered room.
 */
function resolveRoomSet(opts) {
  const ordered = [];
  const cwdRoom = roomRoot.resolveRoomRoot(opts.cwd || process.cwd());
  if (cwdRoom) ordered.push(cwdRoom);
  const sess = _sessionRoom(opts.session);
  if (sess) ordered.push(sess);
  let registered = null;
  for (const r of (opts.rooms || [])) {
    const rp = _realpath(path.resolve(r));
    if (!rp) continue;
    if (_hasRoomRoot(rp)) { ordered.push(rp); continue; }
    if (registered === null) registered = _registeredRoomPaths();
    if (registered.has(rp)) ordered.push(rp);
  }
  let active = null;
  try { active = activeRoom.resolveActiveRoomDir(); } catch (_e) { active = null; }
  if (active) ordered.push(active);
  const seen = new Set();
  const out = [];
  for (const c of ordered) {
    const rp = _realpath(c);
    if (!rp || seen.has(rp)) continue;
    seen.add(rp);
    out.push(rp);
  }
  return out;
}

// ---------------------------------------------------------------- the lock step (design 5.2 step 8)

/**
 * classifyLockError(err) -> 'write_lock_held' | 'lock_io_error'.
 * The design 5.2 step 8 mapping is kept on purpose: 400.3-01 sets code
 * WRITE_LOCK_HELD on the "could not be acquired after retry" throw and
 * graph-ops classifyIndexError maps it to write_lock_held, which would turn a
 * failed room into a deferred one. That message is lock_io_error here.
 */
function classifyLockError(err) {
  const msg = err && typeof err.message === 'string' ? err.message : '';
  if (/could not be acquired after retry/.test(msg)) return 'lock_io_error';
  if (graphOps.classifyIndexError(err) === 'write_lock_held') return 'write_lock_held';
  return 'lock_io_error';
}

/**
 * takeWriteLock(room) -> {ok: true, handle} | {ok: false, reason}. Never throws.
 * The one bounded backoff of 400.3-01, total wait graphOps.INDEX_LOCK_WAIT_MS.
 */
function takeWriteLock(room) {
  try {
    const handle = writeLock.acquireLockWithBackoff(room, { totalMs: graphOps.INDEX_LOCK_WAIT_MS });
    return { ok: true, handle: handle };
  } catch (err) {
    return { ok: false, reason: classifyLockError(err) };
  }
}

function _releaseWriteLock(room, handle) {
  try { writeLock.releaseLock(room, handle); } catch (_e) { /* ignore */ }
}

// ---------------------------------------------------------------- cache

function _cachePath(room) {
  return path.join(room, '.mindrian', 'graph-catchup-cache.json');
}

function _loadCache(room) {
  try {
    const c = JSON.parse(fs.readFileSync(_cachePath(room), 'utf8'));
    if (c && c.schema === 1 && c.entries && typeof c.entries === 'object' && !Array.isArray(c.entries)) {
      return { schema: 1, cursor: typeof c.cursor === 'string' ? c.cursor : null, entries: c.entries };
    }
  } catch (_e) { /* missing or corrupt: an empty cache */ }
  return { schema: 1, cursor: null, entries: {} };
}

function _saveCache(room, cache) {
  try { _writeJsonAtomic(_cachePath(room), cache); } catch (e) { _stderr('graph-catchup: cache_write_failed ' + (e && e.code ? e.code : '')); }
}

// ---------------------------------------------------------------- the files leg (design 5.2 steps 7-9)

function _traceTx(file, items, txMs) {
  if (!file) return;
  try { fs.appendFileSync(file, JSON.stringify({ items: items, tx_ms: txMs }) + '\n'); } catch (_e) { /* ignore */ }
}

/**
 * The files leg of one room. Returns {state, reason, counters, stop}.
 * stop true means the run budget is spent and every later room is skipped.
 */
async function _filesLeg(room, ctx, counters) {
  let conn = null;
  try {
    try {
      ({ conn } = await lazygraph.openGraph(room, { mustExist: true, busyMs: OPEN_BUSY_MS }));
    } catch (err) {
      return { state: 'failed', reason: graphOps.classifyIndexError(err) };
    }
    let canonCtx;
    try { canonCtx = require('../lib/core/verification-stamp.cjs').resolverCtxFor(room); } catch (_e) { canonCtx = undefined; }

    const cache = _loadCache(room);
    const listing = contentArtifacts.listContentArtifacts(room);
    counters.id_collisions = listing.collisions.length;
    const files = listing.files;
    let startIdx = 0;
    if (cache.cursor !== null) {
      startIdx = files.findIndex((f) => f.rel > cache.cursor);
      if (startIdx < 0) startIdx = files.length;
    }
    const hashStmt = conn.prepare("SELECT json_extract(properties,'$.content_hash') AS h FROM nodes WHERE id = ?");

    let batch = [];
    let batchStart = 0;
    let lastExamined = cache.cursor;
    let batchNo = 0;

    const flush = () => {
      if (batch.length === 0) return { ok: true };
      const lock = takeWriteLock(room);
      if (!lock.ok) {
        if (lock.reason === 'write_lock_held') {
          // Deferred: persist the cursor (the last committed point) and the
          // entries refreshed so far; the next trigger resumes from there.
          _saveCache(room, cache);
          return { ok: false, state: 'deferred', reason: lock.reason };
        }
        return { ok: false, state: 'failed', reason: lock.reason };
      }
      let result;
      const t0 = Date.now();
      try {
        const items = batch.map((b) => ({ abs: b.abs, content: b.content }));
        result = navigation.withRoomTx(conn, () => lazygraph.indexArtifactsBatch(conn, room, items, canonCtx));
      } catch (_err) {
        _releaseWriteLock(room, lock.handle);
        return { ok: false, state: 'failed', reason: 'index_failed' };
      }
      _traceTx(ctx.traceTx, batch.length, Date.now() - t0);
      _releaseWriteLock(room, lock.handle);
      const indexed = new Set(result.indexed);
      for (const b of batch) {
        if (indexed.has(b.abs)) {
          cache.entries[b.rel] = [b.st.mtimeMs, b.st.size, b.st.ino, b.hash];
          counters.files_indexed += 1;
        } else {
          delete cache.entries[b.rel];
          counters.files_failed += 1;
        }
      }
      batch = [];
      cache.cursor = lastExamined;
      _saveCache(room, cache);
      batchNo += 1;
      if (ctx.runSeam !== null && batchNo === ctx.runSeam) process.exit(0); // test seam: a killed run
      return { ok: true };
    };

    for (let i = startIdx; i < files.length; i += 1) {
      if (Date.now() >= ctx.deadline) {
        const f = flush();
        if (!f.ok) return { state: f.state, reason: f.reason };
        cache.cursor = lastExamined;
        _saveCache(room, cache);
        counters.remaining = files.filter((x) => lastExamined === null || x.rel > lastExamined).length;
        return { state: 'partial', reason: 'budget_exhausted', stop: true };
      }
      const f = files[i];
      let st;
      try {
        st = fs.statSync(f.abs);
      } catch (_e) {
        counters.files_vanished += 1;
        lastExamined = f.rel;
        continue;
      }
      counters.files_seen += 1;
      lastExamined = f.rel;
      const ent = cache.entries[f.rel];
      if (!(Array.isArray(ent) && ent[0] === st.mtimeMs && ent[1] === st.size && ent[2] === st.ino)) {
        let content;
        try {
          content = lazygraph._readArtifactContent(f.abs);
        } catch (_e) {
          counters.files_failed += 1;
          delete cache.entries[f.rel];
          content = null;
        }
        if (content !== null) {
          const hash = lazygraph.computeHash(content);
          let row = null;
          try { row = hashStmt.get(f.id); } catch (_e) { row = null; }
          if (row && row.h === hash) {
            cache.entries[f.rel] = [st.mtimeMs, st.size, st.ino, hash];
          } else {
            if (batch.length === 0) batchStart = Date.now();
            batch.push({ abs: f.abs, rel: f.rel, content: content, st: st, hash: hash });
          }
        }
      }
      if (batch.length > 0 && (batch.length >= BATCH_MAX_FILES || Date.now() - batchStart >= BATCH_MAX_MS)) {
        const r = flush();
        if (!r.ok) return { state: r.state, reason: r.reason };
      }
    }
    const last = flush();
    if (!last.ok) return { state: last.state, reason: last.reason };

    // A full pass: reset the cursor and prune entries of files not listed.
    const listed = new Set(files.map((x) => x.rel));
    for (const rel of Object.keys(cache.entries)) if (!listed.has(rel)) delete cache.entries[rel];
    cache.cursor = null;
    _saveCache(room, cache);
    counters.remaining = 0;
    return { state: 'complete', reason: null };
  } finally {
    if (conn) { try { await lazygraph.closeGraph(conn); } catch (_e) { /* ignore */ } }
  }
}

// ---------------------------------------------------------------- one room

function _emptyCounters() {
  return {
    files_seen: 0, files_indexed: 0, files_vanished: 0, files_failed: 0, id_collisions: 0,
    cards_recorded: 0, cards_rejected: 0, cards_skipped: 0, cards_failed: 0, remaining: 0,
  };
}

function _statusPath(room) {
  return path.join(room, '.mindrian', 'graph-catchup.json');
}

function _finalStatus(room, base, state, reason, counters) {
  const status = Object.assign({
    schema: 1,
    state: state,
    reason: reason || null,
    run_id: base.run_id,
    trigger: base.trigger,
    started_at: base.started_at,
    last_run_at: _iso(Date.now()),
  }, counters);
  try { _writeJsonAtomic(_statusPath(room), status); } catch (e) { _stderr('graph-catchup: status_write_failed ' + (e && e.code ? e.code : '')); }
  return status;
}

async function _runRoom(room, ctx) {
  const lockFile = path.join(room, '.mindrian', 'graph-catchup.lock');
  const lock = jobLock.acquire(lockFile, { job: 'graph-catchup' });
  const base = { run_id: crypto.randomUUID(), trigger: ctx.trigger, started_at: _iso(Date.now()) };
  if (!lock.ok) {
    if (lock.reason === 'held' || lock.reason === 'recovering') {
      return { room: room, skipped: lock.reason }; // the next trigger catches up
    }
    const counters = _emptyCounters();
    const s = _finalStatus(room, base, 'failed', 'lock_io_error', counters);
    return { room: room, state: s.state, reason: s.reason, status: s };
  }
  let stop = false;
  let status = null;
  try {
    try {
      _writeJsonAtomic(_statusPath(room), { schema: 1, state: 'running', run_id: base.run_id, pid: process.pid, started_at: base.started_at });
    } catch (e) {
      _stderr('graph-catchup: status_write_failed ' + (e && e.code ? e.code : ''));
    }
    if (ctx.holdMs > 0) await _sleep(Math.min(ctx.holdMs, HOLD_CAP_MS)); // test seam

    const counters = _emptyCounters();
    let state = 'complete';
    let reason = null;

    // The card leg (design 5.2 step 6, section 6) is plan 367-08; its
    // counters stay 0 in this plan.

    const files = await _filesLeg(room, ctx, counters);
    if (_worse(state, files.state) !== state) { state = files.state; reason = files.reason; }
    stop = files.stop === true;

    // Step 10: the final status while the job lock is still held.
    status = _finalStatus(room, base, state, reason, counters);
  } finally {
    try { jobLock.release(lock.handle); } catch (_e) { /* ignore */ }
  }
  return { room: room, state: status.state, reason: status.reason, status: status, stop: stop };
}

// ---------------------------------------------------------------- run

/**
 * run(opts) -> Promise<Array<{room, state?, reason?, skipped?, status?}>>.
 * Require-safe: nothing runs at require time. The backstop timer is cleared
 * before the promise resolves, so an in-process caller is not ended later.
 */
async function run(opts) {
  if (process.env.MOS_NO_GRAPH_CATCHUP === '1') return [];
  const o = opts || {};
  if (o.error) { _stderr(o.error); return []; }
  let holdMs = o.holdMs;
  if (!(holdMs > 0)) {
    const envHold = Number(process.env.MOS_GRAPH_CATCHUP_HOLD_MS);
    holdMs = Number.isFinite(envHold) && envHold > 0 ? envHold : 0;
  }
  const candidates = resolveRoomSet(o);
  const rooms = [];
  for (const c of candidates) {
    if (!fs.existsSync(_roomDbPath(c))) { _stderr('room_db_missing ' + c); continue; } // no write of any kind
    rooms.push(c);
  }
  const results = [];
  if (rooms.length === 0) return results;

  bgWorker.lowerWorkerPriority();
  const backstop = bgWorker.armBackstop(BACKSTOP_MS);
  try {
    const ctx = {
      trigger: o.trigger,
      holdMs: holdMs,
      runSeam: o.runSeam || null,
      traceTx: o.traceTx || null,
      deadline: Date.now() + RUN_BUDGET_MS,
    };
    for (const room of rooms) {
      const r = await _runRoom(room, ctx);
      results.push(r);
      if (r.stop) break; // the run budget is spent: a room not reached keeps its old status
    }
  } finally {
    clearTimeout(backstop);
  }
  return results;
}

async function main() {
  try {
    if (process.env.MOS_NO_GRAPH_CATCHUP === '1') process.exit(0);
    const opts = parseArgs(process.argv.slice(2));
    if (opts.error) { _stderr(opts.error); process.exit(0); }
    await run(opts);
  } catch (e) {
    _stderr('graph-catchup: ' + (e && e.message ? String(e.message).slice(0, 200) : 'error'));
  }
  process.exit(0);
}

module.exports = {
  run,
  parseArgs,
  // Shared with the card leg of plan 367-08 and the tests.
  takeWriteLock,
  classifyLockError,
  resolveRoomSet,
};

if (require.main === module) {
  main();
}
