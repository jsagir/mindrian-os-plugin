'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 119-00 Wave 1 -- Venture-Shaped-Turn Nudge (D-02 detector).
 *
 * shouldSurfaceNudge(roomDir, opts) -> {surface, turn_count, threshold, skip_reason?}
 *
 * D-02 invariant: after N=3 consecutive venture-shaped conversational turns
 * with no upload AND no active room, surface an F.1 selector offering
 * [upload material] / [/mos:ignite] / [keep talking]. This is the ONLY
 * auto-create-adjacent path for prompt-only sessions (D-01 prohibits
 * auto-creating from prompts alone).
 * // Repointed from /mos:new-project to /mos:ignite per Phase 155-04
 * // (the Ignite Flow is now the birth front door).
 *
 * D-01 invariant: the upload path takes precedence. If any
 * 'auto_explore_fired' event appears in the recent window, the nudge does
 * NOT surface -- the Phase 117 detector is already handling first-material.
 *
 * Canon Part 8 boundary -- user_text classification:
 *   The user-conversational "venture-shaped" classification CANNOT run on
 *   raw user text inside this module. The event-log schema (per Canon Part
 *   8 fence + Phase 90-06 cross-room aggregator) structurally excludes
 *   user_text -- the memory_event log is queried by cross-room aggregators
 *   and storing raw user content there would breach the boundary.
 *
 *   Alternative signal contract: the upstream telemetry surface (the
 *   PostToolUse / UserPromptSubmit hook OR the Phase 115 dual-path-detector
 *   seam) classifies sentences at WRITE TIME via
 *   lib/core/mva-classifier.cjs::classify and stores ONLY a scalar boolean
 *   `venture_classified` + classification_source enum in
 *   f_selector_decision.properties. The nudge module reads the scalar at
 *   decision time.
 *
 *   v1.13.0 safe-default: if `properties.venture_classified` is structurally
 *   absent at execution time, the nudge degrades to surface:false with
 *   skip_reason:'venture_classification_unavailable'. A v1.14.0 phase wires
 *   the upstream classification at the f_selector_decision emission site.
 *
 * Canon Part 9 chokepoint:
 *   - All reads route through lib/core/navigation.cjs::findRecentChanges.
 *   - room.db is opened via node:sqlite DatabaseSync directly (mirrors the
 *     Phase 117 scripts/auto-explore-fingerprint.cjs pattern; node:sqlite
 *     usage from a CLI-adjacent module is not a chokepoint violation per
 *     the Phase 109-06 pre-commit hook which gates only direct require of
 *     room-db.cjs).
 *
 * Pure CJS, node built-ins + lib/core/navigation. NO require of room-db.cjs.
 * NO require of dual-path-detector.cjs at read-time (the upstream
 * classification has already happened at write-time per the alternative
 * signal contract above). NO require of brain-client. Canon Part 8 preserved.
 */

const path = require('node:path');
const fs = require('node:fs');

const VENTURE_NUDGE_THRESHOLD = 3;

/**
 * shouldSurfaceNudge(roomDir, opts) -> { surface, turn_count, threshold, skip_reason? }
 *
 * @param {string} roomDir - absolute path to a room directory.
 * @param {object} [opts]  - reserved for future extension (D-02 threshold override).
 * @returns {object}
 */
function shouldSurfaceNudge(roomDir, opts) {
  const options = opts || {};
  const threshold = Number.isInteger(options.threshold) && options.threshold > 0
    ? options.threshold
    : VENTURE_NUDGE_THRESHOLD;

  // Guard 1: no roomDir -> safe default.
  if (!roomDir || typeof roomDir !== 'string') {
    return { surface: false, turn_count: 0, threshold: threshold, skip_reason: 'no_room_dir' };
  }

  // Guard 2: room.db missing -> cold-start safe default. No false positives.
  const dbPath = path.join(roomDir, '.mindrian', 'room.db');
  if (!fs.existsSync(dbPath)) {
    return { surface: false, turn_count: 0, threshold: threshold, skip_reason: 'no_room_db' };
  }

  // Open the db read-only via node:sqlite DatabaseSync. Mirrors the Phase 117
  // scripts/auto-explore-fingerprint.cjs::dailyCapHit() pattern. Lazy-require
  // so environments lacking node:sqlite degrade to surface:false.
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch (_e) {
    return { surface: false, turn_count: 0, threshold: threshold, skip_reason: 'no_sqlite' };
  }

  let db;
  try {
    // Phase 276 (C4) write-safety: fold the busy-timeout constructor option
    // into the DatabaseSync options object even though this site is
    // read-intent (it only ever SELECTs via findRecentChanges below). It is
    // opened read-write, not via the read-only door, so the option is added
    // for correctness even though WAL readers never block writers and this
    // specific read path will never measurably wait on it. Without the
    // option, node:sqlite fails a contended write in 0ms with SQLITE_BUSY;
    // the option turns that into a roughly 5s busy-wait window on any future
    // write added here. Strictly more forgiving - a longer wait, never a new
    // failure mode. Adapted from the one correct site,
    // lib/core/room-db.cjs:242-251. Whether this site should instead switch
    // to the read-only door is recorded as a follow-up consideration in
    // 276-09-SUMMARY.md, not decided here.
    db = new DatabaseSync(dbPath, { timeout: 5000 });
  } catch (_e) {
    return { surface: false, turn_count: 0, threshold: threshold, skip_reason: 'db_open_failed' };
  }

  let recent;
  try {
    const navigation = require('./navigation.cjs');
    // Window = last 24 hours; cap at 200 events for safety.
    const sinceMs = Date.now() - (24 * 60 * 60 * 1000);
    recent = navigation.findRecentChanges(db, sinceMs, { limit: 200 });
  } catch (_e) {
    try { db.close(); } catch (_ignore) { /* graceful */ }
    return { surface: false, turn_count: 0, threshold: threshold, skip_reason: 'navigation_query_failed' };
  } finally {
    try { db.close(); } catch (_ignore) { /* graceful */ }
  }

  if (!Array.isArray(recent)) {
    return { surface: false, turn_count: 0, threshold: threshold, skip_reason: 'empty_window' };
  }

  // D-01 invariant short-circuit: upload path takes precedence.
  for (const event of recent) {
    if (event && event.eventType === 'auto_explore_fired') {
      return { surface: false, turn_count: 0, threshold: threshold, skip_reason: 'upload_path_active' };
    }
  }

  // Filter to user-conversational-turn signal events. For v1.13.0-beta.18
  // scope, "conversational turn" is approximated by f_selector_decision
  // (the event that fires on every meaningful F-shape selection per Phase
  // 125-06). focus_changed is intentionally excluded -- it is a navigation
  // event, not a conversation turn. Precise per-turn detection is deferred
  // to Phase 121 trajectory telemetry.
  //
  // Per Canon Part 8 alternative signal contract: count only events where
  // properties.venture_classified === true. If the field is structurally
  // absent (NO event in the window carries it), degrade to safe-default
  // skip_reason:'venture_classification_unavailable' -- the v1.14.0
  // upstream-classification surface has not yet wired the scalar.
  let turnCount = 0;
  let sawClassifiedField = false;
  for (const event of recent) {
    if (!event || event.eventType !== 'f_selector_decision') continue;
    const props = event.properties || {};
    if (typeof props.venture_classified === 'boolean') {
      sawClassifiedField = true;
      if (props.venture_classified === true) turnCount += 1;
    }
  }

  if (!sawClassifiedField) {
    return {
      surface: false,
      turn_count: 0,
      threshold: threshold,
      skip_reason: 'venture_classification_unavailable',
    };
  }

  const surface = turnCount >= threshold;
  return { surface: surface, turn_count: turnCount, threshold: threshold };
}

module.exports = {
  shouldSurfaceNudge: shouldSurfaceNudge,
  VENTURE_NUDGE_THRESHOLD: VENTURE_NUDGE_THRESHOLD,
};
