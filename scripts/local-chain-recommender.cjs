#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 130.7-02 Task 2 -- bin/local-chain-recommender.cjs
 * ========================================================
 * The Tier-LOCAL sibling of lib/brain/chain-recommender.cjs
 * recommendCanonicalTargets. It walks the room's recent memory_event references
 * and AGGREGATES them BY correlation_id (not by name), returning the SAME
 *   { correlation_id, canonical_name, primary_label }
 * tuple shape the Brain-side recommender returns -- ranked by local aggregate
 * weight (recency-weighted reference count). Because both sides compute the id
 * via the one lib/core/correlation.cjs chokepoint, the local aggregate key
 * equals the Brain node key, so the dual-graph join works BY CONSTRUCTION.
 *
 * Tier-LOCAL is the whole point: it NEVER requires the Brain. When the Brain is
 * available it MAY reconcile against the Brain canonical (a value-equality check
 * on correlation_id -- no fork because the id is canonical), but a Brain-down
 * room still returns canonical tuples from local aggregates alone.
 *
 * Canon Part 9 (the navigation chokepoint): bin/ is NOT on the substrate
 * allow-list, so this script reaches room.db ONLY through lib/core/navigation.cjs
 * (openRoomDbForCaller / findRecentChanges / closeRoomDbForCaller). It never
 * reaches the room-db module or the sqlite binding directly -- a direct import
 * of either would trip scripts/check-substrate.cjs.
 *
 * Canon Part 8: a memory_event reference carries a correlation_id hash scalar
 * (the Task 3 threading); the aggregate is over hashes + label enums + public
 * methodology handles, never user content. Zero network surface here.
 *
 * Graceful degradation: an absent room.db (Tier 0 cold start) yields [] -- never
 * a crash. Mirrors scripts/suggest-next-command.cjs Tier-0 degrade idiom.
 *
 * Usage:
 *   node bin/local-chain-recommender.cjs
 *   node bin/local-chain-recommender.cjs --room /path/to/room
 *   node bin/local-chain-recommender.cjs --since <epochMs>
 *   node bin/local-chain-recommender.cjs --json
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
// navigation.cjs is the ONLY door to room.db for this bin/ script.
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const correlation = require(path.join(REPO_ROOT, 'lib', 'core', 'correlation.cjs'));
const correlationLabelIndex = require(path.join(REPO_ROOT, 'lib', 'core', 'correlation-label-index.cjs'));

// The default primary label when only a name is known (a reference predating the
// Task 3 correlation_id threading). Framework is the methodology label,
// consistent with lib/brain/chain-recommender.cjs DEFAULT_PRIMARY_LABEL and
// lib/core/navigation/spine-events.cjs, so a fallback-derived id joins the same
// canonical the Brain side produces.
const DEFAULT_PRIMARY_LABEL = 'Framework';

// The memory_event event types whose reference payloads carry (or can derive) a
// correlation_id. suggestion_surfaced is the Task-3-threaded reference; the set
// is additive-safe (an event without a correlation_id and without a name is
// simply skipped).
const REFERENCE_EVENT_TYPES = Object.freeze(['suggestion_surfaced']);

// Resolve a primary_label for a name from the LOCAL correlation_labels index
// (when the caller supplies roomState.brainSections.correlation_labels) using
// the same methodology-label-preferred heuristic as the Brain side; else default
// to Framework. Pure; never throws.
const LABEL_PREFERENCE = Object.freeze([
  'Framework', 'Concept', 'Tool', 'Book', 'DictionaryTerm', 'Product', 'Person',
]);
function _labelRank(label) {
  const i = LABEL_PREFERENCE.indexOf(label);
  return i === -1 ? LABEL_PREFERENCE.length : i;
}
function _resolveLabelFromIndex(name, indexMap) {
  const entries = (indexMap && Object.prototype.hasOwnProperty.call(indexMap, name))
    ? indexMap[name] : null;
  if (!Array.isArray(entries) || entries.length === 0) return DEFAULT_PRIMARY_LABEL;
  let best = null;
  for (const e of entries) {
    if (!e || typeof e.primary_label !== 'string' || e.primary_label.length === 0) continue;
    const cand = {
      primary_label: e.primary_label,
      edge_degree: Number.isFinite(Number(e.edge_degree)) ? Number(e.edge_degree) : 0,
    };
    if (best === null) { best = cand; continue; }
    const rc = _labelRank(cand.primary_label);
    const rb = _labelRank(best.primary_label);
    if (rc < rb || (rc === rb && cand.edge_degree > best.edge_degree)) best = cand;
  }
  return best ? best.primary_label : DEFAULT_PRIMARY_LABEL;
}

function _readLabelIndex(roomState) {
  if (!roomState || typeof roomState !== 'object') return {};
  const sections = roomState.brainSections;
  if (!sections || typeof sections !== 'object') return {};
  const body = sections[correlationLabelIndex.LABEL_INDEX_SECTION_KEY];
  if (typeof body !== 'string' || body.length === 0) return {};
  try { return correlationLabelIndex.parseLabelIndex(body) || {}; }
  catch (_e) { return {}; }
}

// For one memory_event reference, resolve its canonical tuple. Precedence:
//   1. the reference already carries a correlation_id (Task 3 threading) -- use
//      it as the aggregate key; name/label come from the reference when present.
//   2. else derive from canonical_name (+ label resolved from the index or
//      defaulted) via the SHARED chokepoint, so old un-threaded events still join
//      consistently with the Brain side.
// Returns null when the reference has neither an id nor a name (cannot join).
function _referenceToCanonical(props, indexMap) {
  if (!props || typeof props !== 'object') return null;
  const name = (typeof props.canonical_name === 'string' && props.canonical_name.trim().length > 0)
    ? props.canonical_name.trim() : null;
  let label = (typeof props.primary_label === 'string' && props.primary_label.trim().length > 0)
    ? props.primary_label.trim() : null;
  if (name && !label) label = _resolveLabelFromIndex(name, indexMap);

  if (typeof props.correlation_id === 'string' && props.correlation_id.length > 0) {
    return {
      correlation_id: props.correlation_id,
      canonical_name: name,            // may be null for an id-only reference
      primary_label: label,            // may be null for an id-only reference
    };
  }
  if (name) {
    return {
      correlation_id: correlation.computeCorrelationId(name, label || DEFAULT_PRIMARY_LABEL),
      canonical_name: name,
      primary_label: label || DEFAULT_PRIMARY_LABEL,
    };
  }
  return null;
}

/**
 * recommendLocalCanonicalTargets({ roomDir, since?, roomState? } = {})
 *   -> [ { correlation_id, canonical_name, primary_label }, ... ]
 *
 * Reads recent memory_event references via the navigation chokepoint, aggregates
 * them BY correlation_id (recency-weighted reference count), and returns the
 * canonical tuples ranked by aggregate weight. Tier-LOCAL: never requires Brain.
 * Tier-0: returns [] when room.db is absent. Never throws, never returns null.
 *
 * @param {{ roomDir?: string, since?: number, roomState?: object }} [opts]
 * @returns {Array<{correlation_id: string, canonical_name: string, primary_label: string}>}
 */
function recommendLocalCanonicalTargets(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const roomDir = typeof o.roomDir === 'string' ? o.roomDir : null;
  if (!roomDir) return [];
  const since = Number.isFinite(o.since) ? o.since : 0;
  const indexMap = _readLabelIndex(o.roomState);

  const db = navigation.openRoomDbForCaller(roomDir);
  if (!db) return []; // Tier 0: no room.db.
  try {
    // Aggregate map: correlation_id -> { tuple, weight }.
    const agg = new Map();
    const nowMs = Date.now();
    for (const eventType of REFERENCE_EVENT_TYPES) {
      let rows;
      try {
        rows = navigation.findRecentChanges(db, since, { eventType: eventType, limit: 500 });
      } catch (_e) {
        rows = [];
      }
      if (!Array.isArray(rows)) continue;
      for (const r of rows) {
        const tuple = _referenceToCanonical(r && r.properties, indexMap);
        if (!tuple || typeof tuple.correlation_id !== 'string') continue;
        // Recency weight: newer references weigh more. A simple monotonic decay
        // over age in days keeps the rank stable and bounded; the exact curve is
        // not load-bearing for the contract (one target per id, no fork).
        const createdAt = Number.isFinite(r.createdAt) ? r.createdAt : nowMs;
        const ageDays = Math.max(0, (nowMs - createdAt) / 86400000);
        const weight = 1 / (1 + ageDays);
        const prior = agg.get(tuple.correlation_id);
        if (prior) {
          prior.weight += weight;
          // Backfill name/label if a later reference carries them and the prior
          // was id-only (so the returned tuple is never half-null when any
          // reference named the canonical).
          if (!prior.tuple.canonical_name && tuple.canonical_name) prior.tuple.canonical_name = tuple.canonical_name;
          if (!prior.tuple.primary_label && tuple.primary_label) prior.tuple.primary_label = tuple.primary_label;
        } else {
          agg.set(tuple.correlation_id, { tuple: Object.assign({}, tuple), weight: weight });
        }
      }
    }

    const ranked = Array.from(agg.values())
      .sort(function (a, b) { return b.weight - a.weight; })
      .map(function (e) {
        return {
          correlation_id: e.tuple.correlation_id,
          canonical_name: e.tuple.canonical_name || null,
          primary_label: e.tuple.primary_label || DEFAULT_PRIMARY_LABEL,
        };
      });
    return ranked;
  } catch (_e) {
    return [];
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
}

// ---------- CLI (process.argv switch; mirrors suggest-next-command.cjs) ----------

function _parseArgs(argv) {
  const out = { roomDir: process.cwd(), since: 0, json: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--room' && i + 1 < argv.length) { out.roomDir = argv[i + 1]; i += 1; continue; }
    if (a === '--since' && i + 1 < argv.length) { out.since = Number(argv[i + 1]) || 0; i += 1; continue; }
    if (a === '--json') { out.json = true; continue; }
  }
  return out;
}

function _main() {
  const args = _parseArgs(process.argv);
  let targets = [];
  try {
    targets = recommendLocalCanonicalTargets({ roomDir: args.roomDir, since: args.since });
  } catch (_e) {
    targets = [];
  }
  if (args.json) {
    process.stdout.write(JSON.stringify(targets, null, 2) + '\n');
  } else if (targets.length === 0) {
    process.stdout.write('No local canonical targets (Tier 0 / no recent references).\n');
  } else {
    process.stdout.write('Local canonical targets (ranked):\n');
    targets.forEach(function (t, i) {
      process.stdout.write(
        '  ' + (i + 1) + '. ' + (t.canonical_name || '(unnamed)') +
        ' [' + t.primary_label + '] ' + t.correlation_id + '\n'
      );
    });
  }
  process.exit(0);
}

module.exports = {
  recommendLocalCanonicalTargets: recommendLocalCanonicalTargets,
  DEFAULT_PRIMARY_LABEL: DEFAULT_PRIMARY_LABEL,
};

if (require.main === module) {
  _main();
}
