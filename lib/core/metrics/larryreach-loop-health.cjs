'use strict';
/*
 * LarryReach loop-health metrics aggregator (Hooked-model quick win 2).
 * Source: .planning/research/2026-06-09-hooked-model-larryreach-loop-audit.md
 *
 * WHAT THIS IS
 * ------------
 * A READ-ONLY instrumentation of the dial engagement loop. The dial
 * (lib/workflow/dial-close-reach.cjs) already writes three memory_event types
 * on every offered-and-resolved beat:
 *
 *   f_selector_sync_confirmed  -> navigator committed the RECOMMENDED reach
 *                                 (resting-detent in-sync commit; outcome 'sync').
 *   f_selector_pivot           -> navigator committed a DIFFERENT reach than the
 *                                 one recommended (rotate-to-pivot; outcome 'pivot').
 *   f_selector_miss            -> nothing fit; free-text / none-fit overflow
 *                                 (outcome 'free-text', via recordSelectorMiss).
 *
 * computeLoopHealth reads those counts back and projects the loop-health rates a
 * Hooked-model engagement audit needs: in-sync rate, pivot rate, acceptance
 * rate, miss rate, plus a per-reach breakdown. It writes NOTHING. It instruments
 * the loop by reading the receipts the loop already left.
 *
 * CANON BINDINGS (honored exactly)
 * --------------------------------
 * Part 8 (Graph Boundary): ZERO Brain egress. This module reads LOCAL
 *   memory_event counts only. No network, no fetch, no brain-client require.
 *   It is generic-handles-only -- it never inspects user prose, only event
 *   counts + the cmd:<command> targetNodeId handle.
 * Part 9 (Memory Locality): ALL room reads route through the
 *   lib/core/navigation.cjs chokepoint (navigation.findRecentChanges). This
 *   module NEVER opens room.db itself -- zero require('better-sqlite3'), zero
 *   require('node:sqlite'), zero openRoomDb. The db handle is caller-owned,
 *   mirroring lib/core/navigation/planning-artifacts.cjs.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE). Use hyphens.
 */

const navigation = require('../navigation.cjs');

// The three dial-loop event types this aggregator reads. Frozen so a caller
// cannot mutate the closed set. These are exactly the strings the dial writes
// (declared in lib/core/navigation/memory-events.cjs EVENT_TYPES).
const SYNC_EVENT = 'f_selector_sync_confirmed';
const PIVOT_EVENT = 'f_selector_pivot';
const MISS_EVENT = 'f_selector_miss';

// round4(n) -- round a rate to 4 decimal places, returning a finite Number.
// Guards against NaN/Infinity by mapping any non-finite input to 0.
function round4(n) {
  if (typeof n !== 'number' || !isFinite(n)) return 0;
  return Math.round(n * 10000) / 10000;
}

// safeRate(numerator, denominator) -- divide guarding ALL divide-by-zero. When
// the denominator is 0 (or non-positive, or non-finite) the rate is 0, never
// NaN and never Infinity. Result is rounded to 4 decimals.
function safeRate(numerator, denominator) {
  if (typeof denominator !== 'number' || !isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return round4(numerator / denominator);
}

// readEvents(db, eventType, opts) -- thin wrapper over the navigation
// chokepoint. Returns the raw array of change records for one event type, or []
// on any read failure (defensive: a metrics read must never throw into a
// caller's render path).
function readEvents(db, eventType, sinceEpochMs, limit) {
  try {
    const rows = navigation.findRecentChanges(db, sinceEpochMs, { eventType, limit });
    return Array.isArray(rows) ? rows : [];
  } catch (_err) {
    return [];
  }
}

/*
 * computeLoopHealth(db, opts) -- aggregate the dial loop-health metrics.
 *
 *   db    caller-owned better-sqlite3 room.db handle (NEVER opened here).
 *   opts  optional { sinceEpochMs = 0, limit = 10000 }.
 *
 * Returns a plain object:
 *   { committed, sync, pivot, miss, surfaced,
 *     in_sync_rate, pivot_rate, acceptance_rate, miss_rate, by_reach }
 *
 * All rates are Numbers in [0,1] rounded to 4 decimals, divide-by-zero-guarded.
 */
function computeLoopHealth(db, opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const sinceEpochMs = Number.isFinite(options.sinceEpochMs) ? options.sinceEpochMs : 0;
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 10000;

  const syncRows = readEvents(db, SYNC_EVENT, sinceEpochMs, limit);
  const pivotRows = readEvents(db, PIVOT_EVENT, sinceEpochMs, limit);
  const missRows = readEvents(db, MISS_EVENT, sinceEpochMs, limit);

  const sync = syncRows.length;
  const pivot = pivotRows.length;
  const miss = missRows.length;

  // Every committed reach (sync + pivot) writes a SELECTED_REACH edge. Surfaced
  // beats are every offered-and-resolved beat: committed plus the misses where
  // nothing fit but the selector still resolved.
  const committed = sync + pivot;
  const surfaced = committed + miss;

  // Per-reach breakdown from the sync + pivot events. targetNodeId on a
  // sync/pivot event is the reach target (e.g. cmd:<command>). A miss has no
  // committed reach target, so it does not contribute to by_reach.
  const by_reach = {};
  function tallyReach(rows, key) {
    for (const r of rows) {
      const target = r && typeof r.targetNodeId === 'string' && r.targetNodeId.length > 0
        ? r.targetNodeId
        : 'unknown';
      if (!by_reach[target]) {
        by_reach[target] = { sync: 0, pivot: 0, committed: 0 };
      }
      by_reach[target][key] += 1;
      by_reach[target].committed += 1;
    }
  }
  tallyReach(syncRows, 'sync');
  tallyReach(pivotRows, 'pivot');

  return {
    committed,
    sync,
    pivot,
    miss,
    surfaced,
    in_sync_rate: safeRate(sync, committed),
    pivot_rate: safeRate(pivot, committed),
    acceptance_rate: safeRate(committed, surfaced),
    miss_rate: safeRate(miss, surfaced),
    by_reach,
  };
}

module.exports = { computeLoopHealth };
