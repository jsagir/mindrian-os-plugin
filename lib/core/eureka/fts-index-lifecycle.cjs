'use strict';

/*
 * lib/core/eureka/fts-index-lifecycle.cjs -- Phase 244 Plan 02 (closing
 * RESEARCH BLOCKER B-2: eureka_fts has no production build lifecycle).
 *
 * FOUR THINGS this header must state:
 *
 * (1) This is the CHEAP half of an enqueue-then-drain pair. The EXPENSIVE
 *     half is scripts/fts-index-drain.cjs. The pair is structured EXACTLY
 *     like the shipped scripts/gsd-graph-derive-sweep.cjs (cheap: enqueue) /
 *     scripts/gsd-graph-derive-drain.cjs (expensive: drain) pair -- the
 *     enqueue-then-detached-spawn analog also proven live at
 *     lib/core/intelligence-cascade.cjs:357-384 (enqueueDerive, then a
 *     detached+unref'd spawn gated on `enq.queued`). Copying that pattern,
 *     not inventing a fourth mechanism, is the Canon Part 7 call.
 *
 * (2) Canon Part 9: this module NEVER opens room.db. Every function here
 *     takes a caller-owned db handle (ftsIndexState(db)) or a roomDir string
 *     for the queue file (requestFtsBuild / spawnFtsBuildDrain), mirroring
 *     lib/core/sensors/sensor-expert-skill.cjs:146-148's caller-owned-handle
 *     contract verbatim: "a caller-owned room.db handle (opened upstream;
 *     this helper NEVER opens room.db itself)".
 *
 * (3) Canon Part 8: every value this module returns is a closed scalar or
 *     enum (a boolean, a count, a reason string drawn from a fixed set, a
 *     file path). Nothing here ever returns matched text, turn prose, or a
 *     node id.
 *
 * (4) This module is SYNC and ZERO-PROMISE by contract. Nothing here uses
 *     the ES2017 asynchronous-function keyword pair; every export returns
 *     its value directly, immediately. Its only foreground caller is the
 *     ctx-assembly producer that runs inside the 1200 ms NAV budget
 *     (navigation-engine.cjs:820); a lazy build-on-first-miss must cost one
 *     cold turn, never block one. The expensive `indexNodes` call lives only
 *     in scripts/fts-index-drain.cjs, spawned detached and never joined.
 *
 * NON-GOAL: this module does not build the index. `ftsIndexState` only
 * classifies; `requestFtsBuild` only enqueues; `spawnFtsBuildDrain` only
 * spawns. The actual `indexNodes` call lives entirely in the drain script.
 *
 * No em-dashes anywhere (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const path = require('node:path');

const { tableExists } = require('./tri-modal-index.cjs');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Relative queue-file path under a room's .mindrian/ directory.
const FTS_QUEUE_RELATIVE = path.join('.mindrian', 'fts-index-queue.json');

// Mirrors the drain analog's MAX_DERIVE_ATTEMPTS discipline
// (scripts/gsd-graph-derive-drain.cjs): a failing build gets this many
// attempts before the drain gives up and writes a permanent-failure record.
const FTS_BUILD_MAX_ATTEMPTS = 3;

// A single orphan row (an eureka_fts row whose node_id no longer exists in
// nodes) is enough to classify the index as stale -- this is the ghost-
// trigger condition Plan 03 fences.
const FTS_STALE_ORPHAN_FLOOR = 1;

// ---------------------------------------------------------------------------
// ftsIndexState(db) -- classify the eureka_fts index's state, never throws.
// ---------------------------------------------------------------------------

// The repo's own "a failed query means zero rows" idiom
// (room-graph-density-module.cjs::countTable). `table` is only ever one of
// the two fixed literals below, never any caller-derived value.
function countTable(db, table) {
  try {
    return db.prepare('SELECT count(*) AS c FROM ' + table).get().c;
  } catch (_e) {
    return 0;
  }
}

function countOrphans(db) {
  try {
    return db.prepare(
      'SELECT count(*) AS c FROM eureka_fts WHERE node_id NOT IN (SELECT id FROM nodes)'
    ).get().c;
  } catch (_e) {
    return 0;
  }
}

const UNAVAILABLE_SHAPE = Object.freeze({
  present: false,
  reason: 'unavailable',
  node_rows: 0,
  fts_rows: 0,
  orphan_rows: 0,
  healthy: false,
});

/**
 * ftsIndexState(db) -> { present, reason, node_rows, fts_rows, orphan_rows, healthy }
 *
 * Classification precedence: absent, then unavailable (invalid/closed handle),
 * then stale (orphan_rows >= FTS_STALE_ORPHAN_FLOOR), then empty
 * (fts_rows === 0 while node_rows > 0), then ok. Never throws: the whole body
 * is wrapped in one try/catch that soft-fails to the unavailable shape.
 */
function ftsIndexState(db) {
  if (!db || typeof db.prepare !== 'function') {
    return Object.assign({}, UNAVAILABLE_SHAPE);
  }
  try {
    // Liveness canary: tableExists/countTable/countOrphans each swallow their
    // OWN exceptions (the failed-query-means-zero idiom), so a closed handle
    // would otherwise look identical to a genuinely absent table. This bare
    // SELECT is the ONE call in this function allowed to throw uncaught, so a
    // closed/invalid handle falls through to the outer catch as 'unavailable'
    // rather than misclassifying as 'index_absent'.
    db.prepare('SELECT 1').get();
    const present = tableExists(db, 'eureka_fts');
    if (!present) {
      return {
        present: false,
        reason: 'index_absent',
        node_rows: countTable(db, 'nodes'),
        fts_rows: 0,
        orphan_rows: 0,
        healthy: false,
      };
    }
    const node_rows = countTable(db, 'nodes');
    const fts_rows = countTable(db, 'eureka_fts');
    const orphan_rows = countOrphans(db);

    if (orphan_rows >= FTS_STALE_ORPHAN_FLOOR) {
      return { present: true, reason: 'index_stale', node_rows: node_rows, fts_rows: fts_rows, orphan_rows: orphan_rows, healthy: false };
    }
    if (fts_rows === 0 && node_rows > 0) {
      return { present: true, reason: 'index_empty', node_rows: node_rows, fts_rows: fts_rows, orphan_rows: orphan_rows, healthy: false };
    }
    return { present: true, reason: 'ok', node_rows: node_rows, fts_rows: fts_rows, orphan_rows: orphan_rows, healthy: true };
  } catch (_e) {
    return Object.assign({}, UNAVAILABLE_SHAPE);
  }
}

// ---------------------------------------------------------------------------
// Queue file: queuePath / readQueue / writeQueue -- the same shape as
// scripts/gsd-graph-derive-sweep.cjs:93-118, against FTS_QUEUE_RELATIVE.
// ---------------------------------------------------------------------------

function queuePath(roomDir) {
  return path.join(roomDir, FTS_QUEUE_RELATIVE);
}

function readQueue(roomDir) {
  try {
    const raw = fs.readFileSync(queuePath(roomDir), 'utf8');
    const q = JSON.parse(raw);
    if (q && Array.isArray(q.entries)) return q;
  } catch (_e) { /* missing or corrupt -- start fresh */ }
  return { entries: [] };
}

// Atomic queue write (tmp file + rename), mirroring the sweep's writeQueue
// idiom: a plain writeFileSync can be observed half-written by a concurrent
// reader; rename is atomic on the same filesystem.
function writeQueue(roomDir, q) {
  const qp = queuePath(roomDir);
  fs.mkdirSync(path.dirname(qp), { recursive: true });
  const tmp = qp + '.tmp-' + process.pid + '-' + Date.now().toString(36);
  fs.writeFileSync(tmp, JSON.stringify(q, null, 2));
  fs.renameSync(tmp, qp);
}

// ---------------------------------------------------------------------------
// requestFtsBuild(roomDir, opts) -- the cheap enqueue. Never throws.
// ---------------------------------------------------------------------------

const FTS_BUILD_REASONS = ['index_absent', 'index_empty', 'index_stale'];

/**
 * requestFtsBuild(roomDir, opts) -> { ok, queued, queuePath } | { ok:false, reason }
 *
 * Dedupes by resolved roomDir exactly as enqueueDerive does (one pending
 * build per room, never a duplicate entry). opts.reason is the caller-
 * supplied enum from ftsIndexState (index_absent / index_empty / index_stale)
 * and defaults to index_absent.
 */
function requestFtsBuild(roomDir, opts) {
  if (typeof roomDir !== 'string' || roomDir.length === 0) {
    return { ok: false, reason: 'no_room' };
  }
  const options = (opts && typeof opts === 'object') ? opts : {};
  const reason = FTS_BUILD_REASONS.indexOf(options.reason) !== -1 ? options.reason : 'index_absent';
  try {
    const resolved = path.resolve(roomDir);
    const q = readQueue(resolved);
    const already = q.entries.some(function (e) {
      return e && path.resolve(e.roomDir || '') === resolved;
    });
    if (!already) {
      q.entries.push({ roomDir: resolved, enqueued_at: new Date().toISOString(), reason: reason, attempts: 0 });
    }
    writeQueue(resolved, q);
    return { ok: true, queued: !already, queuePath: queuePath(resolved) };
  } catch (_e) {
    return { ok: false, reason: 'write_failed' };
  }
}

// ---------------------------------------------------------------------------
// spawnFtsBuildDrain(roomDir, opts) -- the detached-and-unref'd spawn of the
// expensive half. Never throws.
// ---------------------------------------------------------------------------

/**
 * spawnFtsBuildDrain(roomDir, opts) -> { spawned:true } | { spawned:false, reason }
 *
 * No-op ('already_pending') when opts.queued !== true: a drain is already
 * owed for a build that was already enqueued by a prior call, so a second
 * spawn here would be redundant (the debounce IS the queue dedupe, exactly
 * as the intelligence-cascade.cjs:350-356 analog documents). No-op
 * ('suppressed') when MOS_NO_DETACHED_FTS_BUILD=1 (the offline test seam).
 * Otherwise spawns scripts/fts-index-drain.cjs --worker --room <roomDir>
 * detached and unref'd. The --worker flag mirrors the analog's semantics:
 * this spawn IS already the detached worker, so the drain must not re-detach
 * a second copy of itself.
 */
function spawnFtsBuildDrain(roomDir, opts) {
  const options = (opts && typeof opts === 'object') ? opts : {};
  if (options.queued !== true) {
    return { spawned: false, reason: 'already_pending' };
  }
  if (process.env.MOS_NO_DETACHED_FTS_BUILD === '1') {
    return { spawned: false, reason: 'suppressed' };
  }
  try {
    // eslint-disable-next-line global-require
    const { spawn } = require('node:child_process');
    const drainScript = path.join(__dirname, '..', '..', '..', 'scripts', 'fts-index-drain.cjs');
    const proc = spawn(
      process.execPath,
      [drainScript, '--worker', '--room', roomDir],
      { detached: true, stdio: 'ignore', env: process.env }
    );
    proc.unref();
    return { spawned: true };
  } catch (_e) {
    return { spawned: false, reason: 'spawn_failed' };
  }
}

module.exports = {
  ftsIndexState: ftsIndexState,
  requestFtsBuild: requestFtsBuild,
  spawnFtsBuildDrain: spawnFtsBuildDrain,
  readQueue: readQueue,
  writeQueue: writeQueue,
  queuePath: queuePath,
  FTS_BUILD_MAX_ATTEMPTS: FTS_BUILD_MAX_ATTEMPTS,
  FTS_QUEUE_RELATIVE: FTS_QUEUE_RELATIVE,
  FTS_STALE_ORPHAN_FLOOR: FTS_STALE_ORPHAN_FLOOR,
};
