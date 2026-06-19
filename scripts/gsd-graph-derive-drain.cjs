#!/usr/bin/env node
'use strict';

/*
 * Phase 169-05 (GDH-02 trigger / D-169-01 / D-169-08) -- the SessionStart DRAIN.
 * =============================================================================
 * The EXPENSIVE half of the enqueue-then-drain debounce, and the NAMED drain
 * trigger the SPEC (MEDIUM-5 / T-169-19) demands -- NOT enqueue-and-never-drain.
 * Structured exactly like the SHIPPED scripts/brain-derivation-drain.cjs: on the
 * SessionStart event it READS the room-local derive queue (written by the Stop
 * sweep, scripts/gsd-graph-derive-sweep.cjs), runs runDerivation once per queued
 * room, and CLEARS the drained entry. The per-write structural index hook stays
 * untouched (Pattern 3 two-trigger split).
 *
 * Failure discipline: silent fail. A SessionStart hook must never block session
 * start. Exit code is ALWAYS 0 on any non-fatal path. A room whose derivation
 * throws is dropped from the queue anyway (the explicit /mos:graph --derive
 * backfill is the universal net for anything missed).
 *
 * Canon Part 8: LOCAL only. The drain runs the LOCAL runDerivation composer
 *   (lib/core/graph-derivation.cjs), which reads LOCAL artifact text and writes
 *   LOCAL proposed typed edges through the navigation chokepoint. It opens ZERO
 *   Brain wire (brain-derive is the one Brain-touching deriver, boundary-scanned
 *   in Plan 06).
 * Canon Part 3/9: the derivation lands edges PROPOSED; the drain NEVER
 *   auto-confirms. The human confirms via the existing confirmNode path.
 *
 * CLI modes:
 *   node scripts/gsd-graph-derive-drain.cjs            -- SessionStart hook: drain
 *                                                         the active/resolved room queue.
 *   node scripts/gsd-graph-derive-drain.cjs --room <d> -- drain a specific room's queue
 *                                                         (used by the round-trip test).
 *   node scripts/gsd-graph-derive-drain.cjs --dry-run  -- report the drain plan, do not run.
 *
 * Pure CJS, node built-ins only, zero npm deps. No em-dashes (CLAUDE.md).
 */

const fs = require('node:fs');
const path = require('node:path');

const sweep = require('./gsd-graph-derive-sweep.cjs');

// ---------------------------------------------------------------------------
// CLI parser
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { roomDir: null, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--room' && argv[i + 1]) { out.roomDir = argv[i + 1]; i += 1; }
    else if (argv[i] === '--dry-run') { out.dryRun = true; }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Drain (the expensive runDerivation pass)
// ---------------------------------------------------------------------------

/**
 * drainDerive(roomDir, opts) -> { ok, drained: [...], remaining: number }
 *
 * Read the room's derive queue, run runDerivation per queued room, and clear
 * the drained entries by rewriting the queue. An injectable opts.deriveRunner
 * (defaults to graph-derivation.runDerivation) lets the round-trip test spy on
 * the call (MEDIUM-5) without a real composer. Never throws.
 */
function drainDerive(roomDir, opts) {
  const options = opts || {};
  const result = { ok: true, drained: [], remaining: 0 };
  if (typeof roomDir !== 'string' || roomDir.length === 0) {
    result.ok = false;
    return result;
  }
  const resolved = path.resolve(roomDir);

  let runDerivation = options.deriveRunner;
  if (typeof runDerivation !== 'function') {
    try {
      runDerivation = require('../lib/core/graph-derivation.cjs').runDerivation;
    } catch (_e) {
      runDerivation = null;
    }
  }

  const q = sweep.readQueue(resolved);
  const entries = Array.isArray(q.entries) ? q.entries : [];
  if (entries.length === 0) { return result; }

  if (options.dryRun) {
    result.remaining = entries.length;
    result.plan = entries.map(e => e && e.roomDir).filter(Boolean);
    return result;
  }

  const kept = [];
  for (const entry of entries) {
    const target = entry && typeof entry.roomDir === 'string' ? entry.roomDir : '';
    if (!target) { continue; }
    try {
      if (typeof runDerivation === 'function') {
        runDerivation({ roomDir: target });
      }
      result.drained.push(target);
    } catch (_e) {
      // a faulting room is still dropped from the queue (the backfill is the net).
      result.drained.push(target);
    }
  }

  // Clear the drained entries by rewriting the queue (drained == all attempted).
  try {
    fs.writeFileSync(sweep.queuePath(resolved), JSON.stringify({ entries: kept }, null, 2));
  } catch (_e) {
    // best-effort: a failed clear means the next drain re-attempts (idempotent).
  }
  result.remaining = kept.length;
  return result;
}

// ---------------------------------------------------------------------------
// Entry point (SessionStart hook): drain and exit 0 always.
// ---------------------------------------------------------------------------

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const roomDir = sweep.resolveRoomDir(args.roomDir);
    if (roomDir) {
      const res = drainDerive(roomDir, { dryRun: args.dryRun });
      if (args.dryRun) {
        process.stderr.write('[gsd-graph-derive-drain] plan: ' + JSON.stringify(res.plan || []) + '\n');
      }
    }
  } catch (_e) {
    // Silent: a SessionStart hook must never block session start.
  }
  process.exit(0);
}

module.exports = { drainDerive };

if (require.main === module) {
  main();
}
