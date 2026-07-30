#!/usr/bin/env node
'use strict';

/*
 * scripts/fts-index-drain.cjs -- Phase 244 Plan 02, the EXPENSIVE half of the
 * enqueue-then-drain debounce whose CHEAP half is
 * lib/core/eureka/fts-index-lifecycle.cjs. Structured exactly like the
 * shipped scripts/gsd-graph-derive-drain.cjs / scripts/brain-derivation-
 * drain.cjs pair: the lifecycle module enqueues a build request and spawns
 * this file detached; this file builds the index and reconciles the queue.
 *
 * DIVISION OF LABOR: lib/core/eureka/fts-index-lifecycle.cjs enqueues
 * (requestFtsBuild) and spawns (spawnFtsBuildDrain), both sync and cheap,
 * safe to call inside the 1200 ms NAV budget. THIS file does the expensive
 * work -- it opens room.db, calls the async tri-modal-index.indexNodes, and
 * reconciles the queue -- and only ever runs detached, off the foreground
 * turn.
 *
 * FAILURE DISCIPLINE: exit-0-never-block, but NEVER SILENT ROT. This process
 * ALWAYS exits 0 on every non-fatal path (it must never block a session-start
 * or post-write hook). A failed build KEEPS its queue entry with an
 * incremented `attempts` counter, so the next drain retries it -- it is NEVER
 * silently cleared on failure. Only after FTS_BUILD_MAX_ATTEMPTS failed
 * passes is the entry dropped, and even then a permanent-failure record is
 * appended to <roomDir>/.mindrian/fts-index-failures.json (Plan 06's doctor
 * module reads this file), so a doctor check can surface it. Only a
 * SUCCESSFUL build clears an entry.
 *
 * NON-GOAL, with the measurement behind it: this script does NOT index
 * `fragments`. `indexNodes` reads `SELECT id, type, properties FROM nodes`
 * and never touches `fragments`, so the correct behavior here is simply the
 * default -- no code change is needed to exclude it, and none should ever be
 * added. Measured live against the real `rethinking-mindrianos` room.db: with
 * `fragments` INCLUDED in the corpus, the turn "what is the weather in paris
 * today" produced 3 confident hits (fragments is raw conversation transcript
 * that contains every common English word many times, so it false-matches
 * anything). With `fragments` EXCLUDED, that same turn plus "my cat needs a
 * vet appointment tomorrow" and "order pizza for dinner tonight" all produced
 * 0 hits, while two genuinely relevant turns produced 5 hits each. The corpus
 * choice does almost all the work and needs no threshold tuning. A future
 * edit that "helpfully" widens the corpus to include `fragments` destroys
 * this phase's whole precision story.
 *
 * Canon Part 8: LOCAL only. Opens room.db through the navigation chokepoint's
 * WRITABLE door (openRoomDbForCaller) -- this process WRITES the index, so
 * the read-only door (openRoomDbReadOnlyForCaller) would be wrong here. Zero
 * network, zero Brain call.
 * Canon Part 9: room.db is reached ONLY through lib/core/navigation.cjs.
 *
 * CLI modes:
 *   node scripts/fts-index-drain.cjs --worker --room <dir>  -- drain one room's
 *                                                               queue. --worker
 *                                                               is informational:
 *                                                               this process IS
 *                                                               the detached
 *                                                               worker already,
 *                                                               so it must never
 *                                                               re-spawn a second
 *                                                               copy of itself.
 *   node scripts/fts-index-drain.cjs --worker                -- drain the
 *                                                               active/resolved
 *                                                               room's queue
 *                                                               (same resolver
 *                                                               gsd-graph-derive-
 *                                                               drain.cjs uses).
 *
 * Pure CJS, node built-ins plus the repo's own lib/core modules, zero npm
 * deps. No em-dashes (CLAUDE.md).
 */

const fs = require('node:fs');
const path = require('node:path');

const {
  readQueue,
  writeQueue,
  FTS_BUILD_MAX_ATTEMPTS,
} = require('../lib/core/eureka/fts-index-lifecycle.cjs');
const { indexNodes } = require('../lib/core/eureka/tri-modal-index.cjs');
const { openRoomDbForCaller, closeRoomDbForCaller } = require('../lib/core/navigation.cjs');
// Reuse the room resolver verbatim rather than hand-rolling a second one
// (Part 7): gsd-graph-derive-drain.cjs itself resolves its no-argument case
// the exact same way, through sweep.resolveRoomDir.
const sweep = require('./gsd-graph-derive-sweep.cjs');

// ---------------------------------------------------------------------------
// Permanent-failure log: <roomDir>/.mindrian/fts-index-failures.json
// ---------------------------------------------------------------------------

function failuresLogPath(roomDir) {
  return path.join(roomDir, '.mindrian', 'fts-index-failures.json');
}

// Truncate an error to a short SCALAR string (Part 8 belt-and-suspenders:
// this is a producer/sqlite error message, not artifact body, but the cap
// keeps the LOCAL-disk-only log bounded and honest).
function scalarError(err) {
  const msg = (err && typeof err.message === 'string') ? err.message : String(err || 'unknown_error');
  return msg.slice(0, 200);
}

// Append a permanent-failure record. Bounded to the most-recent MAX_LOG rows
// so a permanently-broken room never grows the log unbounded. Atomic
// tmp+rename write (the sweep idiom). Advisory: a failed log write NEVER
// blocks the drain.
function appendFailureRecord(roomDir, record) {
  const MAX_LOG = 200;
  try {
    const p = failuresLogPath(roomDir);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    let log = [];
    try {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (Array.isArray(parsed)) log = parsed;
      else if (parsed && Array.isArray(parsed.failures)) log = parsed.failures;
    } catch (_e) { log = []; }
    log.push(record);
    if (log.length > MAX_LOG) log = log.slice(log.length - MAX_LOG);
    const tmp = p + '.tmp-' + process.pid + '-' + Date.now().toString(36);
    fs.writeFileSync(tmp, JSON.stringify({ failures: log }, null, 2));
    fs.renameSync(tmp, p);
  } catch (_e) {
    /* advisory: a failed log write must never block the drain. */
  }
}

// ---------------------------------------------------------------------------
// Argv parsing: a process.argv loop matching the repo convention (no
// Commander, no yargs).
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { worker: false, roomDir: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--worker') {
      out.worker = true; // informational: this process IS the detached worker.
    } else if (argv[i] === '--room' && argv[i + 1]) {
      out.roomDir = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The drain: read the queue, build per entry, reconcile.
// ---------------------------------------------------------------------------

// drainRoom(resolved) -> void. Never throws (every per-entry fault is caught
// individually so one bad room/entry cannot abort the pass).
async function drainRoom(resolved) {
  const q = readQueue(resolved);
  const entries = Array.isArray(q.entries) ? q.entries : [];
  if (entries.length === 0) return; // empty queue: no db work, no queue mutation.

  const kept = [];
  for (const entry of entries) {
    const roomDir = (entry && typeof entry.roomDir === 'string' && entry.roomDir.length > 0)
      ? entry.roomDir
      : resolved;
    let db = null;
    try {
      db = openRoomDbForCaller(roomDir);
      if (!db) {
        throw new Error('fts-index-drain: room.db unavailable for ' + roomDir);
      }
      // roomDir threaded explicitly: without it the corpus collapses to claim
      // text plus artifact TITLES only, because the Artifact/memory_artifact
      // path-body fallback (tri-modal-index.cjs) is what makes the corpus
      // substantive.
      // eslint-disable-next-line no-await-in-loop
      await indexNodes(db, { roomDir: roomDir });
      // Success: entry is cleared (not pushed onto `kept`).
    } catch (e) {
      const priorAttempts = (entry && Number.isFinite(entry.attempts)) ? entry.attempts : 0;
      const attempts = priorAttempts + 1;
      if (attempts >= FTS_BUILD_MAX_ATTEMPTS) {
        // Capped: drop the entry, but NEVER silently -- a permanent-failure
        // record survives so a doctor check can surface it.
        appendFailureRecord(resolved, {
          roomDir: roomDir,
          failed_at: new Date().toISOString(),
          attempts: attempts,
          message: scalarError(e),
        });
      } else {
        // Keep-on-failure: the retry signal survives for the next drain.
        kept.push(Object.assign({}, entry, { attempts: attempts }));
      }
    } finally {
      closeRoomDbForCaller(db);
    }
  }
  writeQueue(resolved, { entries: kept });
}

// ---------------------------------------------------------------------------
// Entry point: drain one room's queue and exit 0 always.
// ---------------------------------------------------------------------------

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const roomDir = args.roomDir
      ? path.resolve(args.roomDir)
      : sweep.resolveRoomDir(null);
    if (roomDir) {
      await drainRoom(path.resolve(roomDir));
    }
    // No room resolves: exit 0 silently (nothing to drain).
  } catch (_e) {
    // Top-level guard: this process must ALWAYS exit 0 on any non-fatal path.
  }
  process.exit(0);
}

module.exports = { drainRoom, failuresLogPath };

if (require.main === module) {
  main();
}
