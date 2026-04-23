/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.1-16 -- query-efficiency token estimator + aggregation math.
 * =====================================================================
 * Pure utility module consumed by two callers:
 *
 *   1. scripts/query-efficiency-telemetry.cjs (PostToolUse hook) uses
 *      estimateTokens(payload) to measure tokens_used per Read|Grep|Glob
 *      return, and estimateRoomTokens(roomRoot) to compute the
 *      tokens_naive_estimate baseline that defines the 57x efficiency claim.
 *
 *   2. scripts/scout-telemetry-aggregator.cjs (aggregation helper spawned
 *      by /mos:scout) uses aggregateEvents(events) to render the median
 *      ratio + top-5 commands + threshold-status summary.
 *
 * Canon:
 *   Part 6 Product-as-Venture -- the 57x token-efficiency claim is a
 *     venture claim; without this measurement arm it is marketing copy.
 *     This module is the measurement arm: the ratio it produces is the
 *     release-gate signal (>= 40x PASS; < 40x RETUNE) per CONTEXT
 *     criterion #15.
 *   Part 8 Graph Boundary -- LOCAL-by-construction. Zero http/https
 *     imports, zero child_process, zero network egress. Only fs reads
 *     (for estimateRoomTokens walking .md files). The caller hooks
 *     persist ONLY scalar integer counts to the JSONL; no user-artifact
 *     bytes reach the telemetry file.
 *
 * Design notes:
 *   - estimateTokens uses the chars/4 approximation established by
 *     lib/memory/triple-context-formatter.cjs (Phase 88-07). Consistency
 *     across the codebase matters: if the Phase 88-07 formatter reports
 *     "this emission is 3825 tokens", the telemetry hook must estimate
 *     with the same yardstick so ratios compare apples-to-apples.
 *
 *   - estimateRoomTokens uses a module-level in-memory cache keyed by
 *     absolute room path. First call walks the tree summing .md file
 *     sizes; subsequent calls return the cached value. The cache is
 *     session-scoped (cleared when the Node process exits). A ledger
 *     cache is NOT persisted to disk because:
 *       (a) the estimator is fast enough (single walk of a room tree
 *           typically completes in < 50ms on commodity SSDs), and
 *       (b) on-disk caches introduce invalidation complexity that is
 *           unnecessary for a per-session approximation used as the
 *           denominator of a ratio. Staleness by up to one session is
 *           within the noise floor of the measurement itself.
 *
 *   - validateEventShape enforces the 8-field contract specified in
 *     88.1-16 PLAN <interfaces>. The hook uses this as a pre-write guard
 *     so a malformed event can never reach the JSONL.
 *
 *   - aggregateEvents reduces a raw event stream to { median, mean, top5,
 *     count }. Top-5 is computed per-command (taking the MAX ratio
 *     observed for each command) so a single command cannot occupy
 *     multiple slots. This matches the CONTEXT-specified "top 5 commands
 *     by ratio" rendering.
 *
 *   - classifyRatio maps a numeric ratio to { 'normal' | 'warn' } at the
 *     10x threshold per PLAN <action>. Below-10x arms the hook's warn
 *     systemMessage; at-or-above 10x stays silent (no verification fatigue
 *     per Plan 03 reviewer R5).
 *
 * API:
 *   estimateTokens(str)                -> integer >= 0
 *   estimateRoomTokens(roomRoot)       -> integer >= 0 | null
 *   clearCache()                       -> void  (test hygiene)
 *   validateEventShape(obj)            -> { valid, missing:string[] }
 *   classifyRatio(ratio)               -> 'normal' | 'warn'
 *   aggregateEvents(events)            -> { count, median, mean, top5 }
 *   EVENT_REQUIRED_FIELDS              -> readonly string[]
 *   BELOW_THRESHOLD_RATIO              -> 10
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ---------- Constants ----------

// Classification threshold for below-10x warn emission. Canon: anything
// <10x is a leakage signal (query is pulling more room context than it
// needs). This is the hook's advisory trigger, not the 57x release gate.
const BELOW_THRESHOLD_RATIO = 10;

// 8-field contract per 88.1-16 PLAN <interfaces>. validateEventShape
// enforces this on every event before it is appended to the JSONL.
const EVENT_REQUIRED_FIELDS = Object.freeze([
  'event',
  'ts',
  'command',
  'tool',
  'tokens_used',
  'tokens_naive_estimate',
  'ratio',
  'room_slug',
]);

// Max depth guard for the estimateRoomTokens walker. Rooms are expected
// to be shallow (<10 levels). A runaway symlink loop or surprise deep
// tree must not hang the hook.
const MAX_ROOM_DEPTH = 12;

// ---------- Module-level session cache ----------
//
// Key: absolute, resolved room path (realpath when possible).
// Value: cached token count (integer).
// Cleared via clearCache() for tests; otherwise persists for the life
// of the Node process (i.e. for the duration of a single hook fork or
// scout invocation).
const roomTokenCache = new Map();

// ---------- estimateTokens ----------

/**
 * estimateTokens(str) -> integer >= 0
 *
 * Chars-over-4 estimator, matching Phase 88-07 triple-context-formatter.
 * Graceful on null / undefined / non-string: returns 0. This matches the
 * behavior established by formatter.estimateTokens so the two producers
 * are interchangeable.
 */
function estimateTokens(str) {
  if (typeof str !== 'string') return 0;
  if (str.length === 0) return 0;
  return Math.ceil(str.length / 4);
}

// ---------- estimateRoomTokens ----------

/**
 * Walk the room tree summing the byte-length of every .md file, divide
 * by 4 to approximate tokens. Skips non-.md files (binaries, images,
 * generated JSON, etc.) so the denominator of the efficiency ratio
 * reflects ONLY the text payload a naive whole-room ingestion would
 * consume.
 *
 * Uses fs.readdirSync with withFileTypes so a single syscall per
 * directory yields both names and types; avoids the stat-per-entry
 * overhead that a readdir+stat loop would incur.
 *
 * Returns null on:
 *   - invalid input (non-string, empty string, null, undefined)
 *   - path does not exist
 *   - path is not a directory
 *   - any error during the walk (defensive; the hook must never throw)
 *
 * Caches the result in module-level roomTokenCache keyed by the resolved
 * path. Second call returns cached value without re-walking; this is the
 * property test 5 asserts.
 */
function estimateRoomTokens(roomRoot) {
  if (typeof roomRoot !== 'string' || roomRoot.length === 0) return null;

  // Cache hit?
  if (roomTokenCache.has(roomRoot)) {
    return roomTokenCache.get(roomRoot);
  }

  let stat;
  try {
    stat = fs.statSync(roomRoot);
  } catch (_e) {
    return null;
  }
  if (!stat || !stat.isDirectory()) return null;

  let totalChars = 0;

  function walk(dir, depth) {
    if (depth > MAX_ROOM_DEPTH) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_e) {
      return; // permission denied, vanished dir, etc.
    }
    for (const entry of entries) {
      if (!entry) continue;
      const name = entry.name;
      // Skip hidden directories / files starting with '.' (e.g. .git,
      // .mindrian, .obsidian). Counting them would over-estimate the
      // naive baseline and dilute the ratio.
      if (typeof name === 'string' && name.length > 0 && name[0] === '.') continue;
      const full = path.join(dir, name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue; // skip symlinks, sockets, devices
      // Only count .md files.
      if (!/\.md$/i.test(name)) continue;
      try {
        const s = fs.statSync(full);
        if (s && typeof s.size === 'number') {
          totalChars += s.size;
        }
      } catch (_e) { /* vanished file, skip */ }
    }
  }

  try {
    walk(roomRoot, 0);
  } catch (_e) {
    return null;
  }

  const tokens = Math.ceil(totalChars / 4);
  roomTokenCache.set(roomRoot, tokens);
  return tokens;
}

// ---------- clearCache ----------

/**
 * Reset the session cache. Used by tests for deterministic between-case
 * isolation; production callers typically do not need to invoke this
 * (process lifetime bounds the cache naturally).
 */
function clearCache() {
  roomTokenCache.clear();
}

// ---------- validateEventShape ----------

/**
 * Return { valid, missing } for a telemetry event object. An event is
 * valid iff every field in EVENT_REQUIRED_FIELDS is present AND
 * non-null / non-undefined. The hook uses this as a write guard: a
 * malformed event must never reach the JSONL (prevents aggregation
 * NaN poisoning later).
 */
function validateEventShape(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { valid: false, missing: EVENT_REQUIRED_FIELDS.slice() };
  }
  const missing = [];
  for (let i = 0; i < EVENT_REQUIRED_FIELDS.length; i += 1) {
    const k = EVENT_REQUIRED_FIELDS[i];
    const v = obj[k];
    if (v === undefined || v === null) missing.push(k);
  }
  return { valid: missing.length === 0, missing: missing };
}

// ---------- classifyRatio ----------

/**
 * Classify a ratio into 'normal' or 'warn' at the 10x threshold.
 * Defensive: any non-finite or non-numeric input -> 'warn' (the ratio
 * was never computed correctly, which is itself a signal the hook
 * should surface).
 */
function classifyRatio(ratio) {
  if (typeof ratio !== 'number' || !Number.isFinite(ratio)) return 'warn';
  if (ratio >= BELOW_THRESHOLD_RATIO) return 'normal';
  return 'warn';
}

// ---------- aggregateEvents ----------

/**
 * Reduce an event stream to { count, median, mean, top5 }.
 *
 * - count:  events.length.
 * - median: midpoint of the sorted ratios. Even-length: average of the
 *           two middle values. Odd-length: the middle value.
 * - mean:   arithmetic mean of ratios, rounded to 1 decimal for display
 *           friendliness in the scout render.
 * - top5:   up to 5 entries, sorted descending by ratio, deduped by
 *           command (each command appears at most once, with its MAX
 *           observed ratio).
 *
 * Empty input -> { count:0, median:null, mean:null, top5:[] }.
 *
 * Filters out malformed events (missing or non-numeric ratio) so a
 * corrupt JSONL line cannot poison the aggregate.
 */
function aggregateEvents(events) {
  const out = { count: 0, median: null, mean: null, top5: [] };
  if (!Array.isArray(events) || events.length === 0) return out;

  // Collect only well-formed ratio values. A malformed event counts
  // toward `count` (reported events) but NOT toward median/mean/top5.
  const ratios = [];
  const byCommand = new Map(); // command -> max ratio
  for (let i = 0; i < events.length; i += 1) {
    const e = events[i];
    if (!e || typeof e !== 'object') continue;
    const r = e.ratio;
    if (typeof r !== 'number' || !Number.isFinite(r)) continue;
    ratios.push(r);
    const cmd = typeof e.command === 'string' && e.command.length > 0
      ? e.command
      : '(unknown)';
    const prev = byCommand.get(cmd);
    if (prev === undefined || r > prev) byCommand.set(cmd, r);
  }

  out.count = events.length;

  if (ratios.length === 0) return out;

  // Median: sort asc, pick middle.
  const sorted = ratios.slice().sort(function (a, b) { return a - b; });
  const n = sorted.length;
  if (n % 2 === 1) {
    out.median = sorted[(n - 1) / 2];
  } else {
    const lo = sorted[(n / 2) - 1];
    const hi = sorted[n / 2];
    out.median = (lo + hi) / 2;
  }

  // Mean, 1-decimal rounded for display.
  let sum = 0;
  for (let i = 0; i < n; i += 1) sum += sorted[i];
  const rawMean = sum / n;
  out.mean = Math.round(rawMean * 10) / 10;

  // Top-5 per-command, sorted desc by ratio. Ties broken by command
  // name for determinism.
  const pairs = [];
  const keys = Array.from(byCommand.keys());
  for (let i = 0; i < keys.length; i += 1) {
    pairs.push({ command: keys[i], ratio: byCommand.get(keys[i]) });
  }
  pairs.sort(function (a, b) {
    if (b.ratio !== a.ratio) return b.ratio - a.ratio;
    return a.command < b.command ? -1 : a.command > b.command ? 1 : 0;
  });
  out.top5 = pairs.slice(0, 5);

  return out;
}

// ---------- Exports ----------

module.exports = {
  BELOW_THRESHOLD_RATIO: BELOW_THRESHOLD_RATIO,
  EVENT_REQUIRED_FIELDS: EVENT_REQUIRED_FIELDS,
  estimateTokens: estimateTokens,
  estimateRoomTokens: estimateRoomTokens,
  clearCache: clearCache,
  validateEventShape: validateEventShape,
  classifyRatio: classifyRatio,
  aggregateEvents: aggregateEvents,
};
