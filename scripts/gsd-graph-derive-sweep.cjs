#!/usr/bin/env node
'use strict';

/*
 * Phase 169-05 (GDH-02 trigger / D-169-01 / D-169-08) -- the Stop SWEEP hook.
 * ==========================================================================
 * The CHEAP half of the enqueue-then-drain debounce. On the Stop event this
 * hook ENQUEUES a derive request for the current room into a small queue file
 * and exits 0 immediately. It NEVER runs the expensive TYPED derivation inline
 * (T-169-11): that runs on the SessionStart DRAIN (scripts/gsd-graph-derive-
 * drain.cjs), mirroring the SHIPPED scripts/brain-derivation-drain.cjs
 * precedent (the per-write structural index hook stays untouched -- Pattern 3).
 *
 * Wall-clock contract: the Stop handler stays within the Stop timeout budget
 * because it ONLY writes a tiny JSON queue file (no Brain, no SQL derivation,
 * no LLM call). Exit code is ALWAYS 0 (never block session end). Failures are
 * silent (advisory; a missed enqueue is re-enqueued the next Stop, and the
 * explicit /mos:graph --derive backfill is the universal net).
 *
 * Canon Part 8: LOCAL only. The enqueue writes a room-local queue file under
 *   the room's `.mindrian/`; it opens ZERO Brain wire. The room is resolved by
 *   the GDH-01 `.room-root` walk-up resolver (lib/core/room-root.cjs), so a
 *   sub-room Stop enqueues the SUB-room, not the registry active room.
 *
 * Queue idiom: mirrors lib/core/brain-derivation-queue.cjs -- a JSON file at
 *   <roomDir>/.mindrian/graph-derive-queue.json carrying { entries: [ {roomDir,
 *   enqueued_at} ] }, deduped by resolved roomDir. The drain reads it, runs
 *   runDerivation per entry, and clears the drained entry.
 *
 * CLI modes:
 *   node scripts/gsd-graph-derive-sweep.cjs            -- Stop hook: enqueue the
 *                                                         active/resolved room.
 *   node scripts/gsd-graph-derive-sweep.cjs --room <d> -- enqueue a specific room
 *                                                         (used by the round-trip test).
 *
 * Pure CJS, node built-ins only, zero npm deps. No em-dashes (CLAUDE.md).
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const QUEUE_RELATIVE = path.join('.mindrian', 'graph-derive-queue.json');

// ---------------------------------------------------------------------------
// Room resolution: the GDH-01 `.room-root` walk-up resolver, falling back to
// the registry active room when no sentinel is found from cwd.
// ---------------------------------------------------------------------------

function resolveMindrianRoomsRoot() {
  const envRoot = process.env.MINDRIAN_ROOMS_ROOT;
  if (envRoot && fs.existsSync(envRoot)) return envRoot;
  const home = process.env.HOME || os.homedir();
  if (!home) return null;
  const defaultRoot = path.join(home, 'MindrianRooms');
  if (fs.existsSync(defaultRoot)) return defaultRoot;
  return null;
}

function resolveActiveRoomDir() {
  const root = resolveMindrianRoomsRoot();
  if (!root) return null;
  try {
    const regPath = path.join(root, '.rooms', 'registry.json');
    const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    if (reg && typeof reg.active === 'string' && reg.active.length > 0) {
      const cand = path.join(root, reg.active);
      if (fs.existsSync(cand)) return cand;
    }
  } catch (_e) { /* fall through */ }
  return null;
}

// Resolve the room to enqueue: prefer the `.room-root` walk-up from cwd (so a
// sub-room Stop enqueues the sub-room), then the registry active room.
function resolveRoomDir(explicit) {
  if (typeof explicit === 'string' && explicit.length > 0 && fs.existsSync(explicit)) {
    return path.resolve(explicit);
  }
  try {
    const { resolveRoomRoot } = require('../lib/core/room-root.cjs');
    const fromCwd = resolveRoomRoot(process.cwd());
    if (fromCwd) return path.resolve(fromCwd);
  } catch (_e) { /* fall through */ }
  const active = resolveActiveRoomDir();
  return active ? path.resolve(active) : null;
}

// ---------------------------------------------------------------------------
// Enqueue (the cheap write)
// ---------------------------------------------------------------------------

function queuePath(roomDir) {
  return path.join(roomDir, QUEUE_RELATIVE);
}

function readQueue(roomDir) {
  try {
    const raw = fs.readFileSync(queuePath(roomDir), 'utf8');
    const q = JSON.parse(raw);
    if (q && Array.isArray(q.entries)) return q;
  } catch (_e) { /* missing or corrupt -- start fresh */ }
  return { entries: [] };
}

// Atomic queue write (tmp file + rename), mirroring the brain-derivation-queue
// writeQueueAtomic idiom this file cites. A plain writeFileSync can be observed
// half-written by a concurrent reader, which then parses it as corrupt and
// silently starts fresh -- discarding the whole queue. rename is atomic on the
// same filesystem, so a reader only ever sees the old or the new queue.
function writeQueue(roomDir, q) {
  const qp = queuePath(roomDir);
  fs.mkdirSync(path.dirname(qp), { recursive: true });
  const tmp = qp + '.tmp-' + process.pid + '-' + Date.now().toString(36);
  fs.writeFileSync(tmp, JSON.stringify(q, null, 2));
  fs.renameSync(tmp, qp);
}

/**
 * enqueueDerive(roomDir, opts) -> { ok, queued, queuePath }
 * Append a derive request for roomDir, deduped by the (resolved roomDir,
 * resolved filePath) tuple. Cheap: one small JSON write. Never throws (returns
 * { ok:false } on failure).
 *
 * Phase 224-02 (Req 1) additive extension: opts.filePath is OPTIONAL. When
 * present the entry is a per-WRITE derive request ({roomDir, filePath,
 * enqueued_at}) that the drain scopes to O(n) new-artifact-vs-existing pairs;
 * when ABSENT the entry is the room-scoped Stop-sweep request it is today
 * ({roomDir, enqueued_at}), which the drain scopes to the full backfill pairing.
 * The zero-arg Stop-hook main() path is untouched (RESEARCH OQ2: the sweep and
 * drain stay registered as a harmless second net). Additive, back-compatible:
 * an absent filePath dedupes exactly as the pre-224 room-scoped entry did.
 */
function enqueueDerive(roomDir, opts) {
  if (typeof roomDir !== 'string' || roomDir.length === 0) {
    return { ok: false, reason: 'no_room' };
  }
  const options = (opts && typeof opts === 'object') ? opts : {};
  const resolved = path.resolve(roomDir);
  const hasFilePath = typeof options.filePath === 'string' && options.filePath.length > 0;
  const resolvedFile = hasFilePath ? path.resolve(options.filePath) : null;
  try {
    const q = readQueue(resolved);
    const already = q.entries.some((e) => {
      if (!e) return false;
      const eRoom = path.resolve(e.roomDir || '');
      const eFile = (typeof e.filePath === 'string' && e.filePath.length > 0)
        ? path.resolve(e.filePath)
        : null;
      return eRoom === resolved && eFile === resolvedFile;
    });
    if (!already) {
      const entry = { roomDir: resolved, enqueued_at: new Date().toISOString() };
      if (resolvedFile) entry.filePath = resolvedFile;
      q.entries.push(entry);
    }
    writeQueue(resolved, q);
    return { ok: true, queued: !already, queuePath: queuePath(resolved) };
  } catch (_e) {
    return { ok: false, reason: 'write_failed' };
  }
}

// ---------------------------------------------------------------------------
// CLI parser
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { roomDir: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--room' && argv[i + 1]) { out.roomDir = argv[i + 1]; i += 1; }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Entry point (Stop hook): enqueue and exit 0 always.
// ---------------------------------------------------------------------------

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const roomDir = resolveRoomDir(args.roomDir);
    if (roomDir) enqueueDerive(roomDir);
  } catch (_e) {
    // Silent: a Stop hook must never block session end.
  }
  process.exit(0);
}

module.exports = { enqueueDerive, readQueue, writeQueue, queuePath, resolveRoomDir };

if (require.main === module) {
  main();
}
