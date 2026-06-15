'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 158-02 -- reach-keyed reject + presentation readers (RJP-06 / RJP-07).
 * ============================================================================
 * Two PURE readers the Phase 158 bias fences consume, both keyed by reach_id:
 *
 *   presentationsCount(db, reach_id, roomState) -> number
 *     Counts reach_presented memory_event rows for this reach_id. Feeds the
 *     M-floor (min-presentations) and the periodic-parole counter (D-05).
 *
 *   rejectCountInWindow(db, reach_id, roomState, opts) -> number
 *     Counts REJECT-ONLY f_selector_decision rows for this reach_id WITHIN the
 *     trailing W presentation-units (D-04 / D-10 Q1). DEFER and PIVOT NEVER
 *     contribute (D-03). This is the suppression signal for the >= N gate (D-05).
 *
 * Both readers:
 *   - Prefer the roomState injection seam (roomState.<fn>[reach_id]) when present,
 *     so the Plan 03 fence tests run db-free and the dial orchestrator stays PURE
 *     (db is NEVER threaded into dial-reach-orchestrator; the reads happen upstream
 *     on the live engine arm -- SC-07). Mirrors the
 *     selector-decisions.cjs::_invocationsSinceDecision pre-computed-counter seam.
 *   - Read ONLY via the navigation.cjs chokepoint (Canon Part 9 / RJP-07). NO
 *     direct sqlite handle, NO better-sqlite3 require, NO fs read of room data.
 *   - Read enums/scalars ONLY (decision / edge_semantic / reach_id). NEVER
 *     properties.reason (Canon Part 8 / RJP-06). The reason-leak source grep is
 *     enforced in Plan 04's run-all-158.sh.
 *   - Return 0 when db is null and no injected counter is present (cold path).
 *
 * NO Brain call. NO em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only. CJS.
 *
 * License: BSL 1.1.
 */

const navigation = require('../core/navigation.cjs');

// The six frozen machine reaches (mirror cortex-reach-adapter.cjs:51-58 + the
// dial-reach-orchestrator REACH_DEFS). Kept as a flat local const here so this
// reader never imports the orchestrator and the two stay decoupled.
const REACH_IDS = Object.freeze([
  'context_block',
  'contradiction',
  'cross_room',
  'brain_consult',
  'deep_research',
  'hats',
]);

// W -- the recency-aging window, in PRESENTATION-units of THIS reach_id (D-04 /
// D-10 Q1). Only rejections inside the trailing W presentations of a reach count
// toward N, so suppression EXPIRES and the reach gets parole. The default here
// mirrors the D-09 starting value (W=8); Plan 03 reconciles this module-local
// default to the SHARED named constant REJECT_WINDOW (one source of truth for W)
// and may pass it explicitly via opts.window. The opts.window parameter is the
// reconciliation seam: when Plan 03's caller passes the named constant, it wins;
// otherwise this conservative default applies.
const REJECT_WINDOW_DEFAULT = 8;

// The reject outcome enum surfaces the count signal reads (D-03 + D-08a): a
// f_selector_decision row is a REJECT only when decision === 'reject' OR
// edge_semantic === 'REJECTED'. DEFER / PIVOT are excluded. Read enums ONLY.
function _isRejectRow(props) {
  if (!props || typeof props !== 'object') return false;
  return props.decision === 'reject' || props.edge_semantic === 'REJECTED';
}

// Defensive: a roomState injection seam returns the injected number when it is a
// finite number, else null (so the db path runs). Mirrors the
// _invocationsSinceDecision pre-computed-counter guard (selector-decisions:311).
function _injected(roomState, fnName, reachId) {
  if (roomState
      && roomState[fnName]
      && typeof roomState[fnName] === 'object'
      && typeof roomState[fnName][reachId] === 'number'
      && Number.isFinite(roomState[fnName][reachId])) {
    return roomState[fnName][reachId];
  }
  return null;
}

// ---------------------------------------------------------------------------
// presentationsCount(db, reach_id, roomState) -> number
//
// Counts reach_presented memory_event rows whose properties.reach_id === reach_id.
// Prefers roomState.presentationsCount[reach_id] (test seam) when present. Reads
// via navigation.findRecentChanges (Part 9). Returns 0 when db is null and no
// injected counter is present.
// ---------------------------------------------------------------------------
function presentationsCount(db, reach_id, roomState) {
  if (typeof reach_id !== 'string' || reach_id.length === 0) return 0;
  const injected = _injected(roomState, 'presentationsCount', reach_id);
  if (injected !== null) return injected;
  if (!db) return 0;
  let rows;
  try {
    rows = navigation.findRecentChanges(db, 0, {
      eventType: 'reach_presented',
      limit: 200,
    });
  } catch (_err) {
    return 0; // non-throwing on a bad db / read fault
  }
  if (!Array.isArray(rows)) return 0;
  let count = 0;
  for (const row of rows) {
    if (row && row.properties && row.properties.reach_id === reach_id) {
      count += 1;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// rejectCountInWindow(db, reach_id, roomState, opts) -> number
//
// Counts REJECT-ONLY f_selector_decision rows for this reach_id WITHIN the
// trailing W presentation-units (D-04). DEFER / PIVOT never contribute (D-03).
//
// Window derivation (presentation-units, D-10 Q1):
//   1. Read this reach_id's reach_presented timeline (DESC by createdAt).
//   2. The W-th-most-recent presentation's createdAt is the window FLOOR.
//      When fewer than W presentations exist, the window is open-ended (floor 0)
//      so every reject for this reach counts (small-sample: the M-floor in Plan 03
//      gates suppression-eligibility, not this count).
//   3. Read f_selector_decision rows newer than the floor; count the REJECT-only
//      rows whose properties.reach_id === reach_id.
//
// Prefers roomState.rejectCountInWindow[reach_id] (test seam) when present. Reads
// via navigation.findRecentChanges (Part 9). Returns 0 when db is null and no
// injected counter is present. Reads enums ONLY -- NEVER properties.reason (Part 8).
// ---------------------------------------------------------------------------
function rejectCountInWindow(db, reach_id, roomState, opts) {
  if (typeof reach_id !== 'string' || reach_id.length === 0) return 0;
  const injected = _injected(roomState, 'rejectCountInWindow', reach_id);
  if (injected !== null) return injected;
  if (!db) return 0;

  const options = (opts && typeof opts === 'object') ? opts : {};
  const W = (Number.isInteger(options.window) && options.window > 0)
    ? options.window
    : REJECT_WINDOW_DEFAULT;

  // Step 1: this reach_id's presentation timeline (DESC by createdAt). Used only
  // to locate the W-th-most-recent presentation's createdAt as the window floor.
  let presentations;
  try {
    presentations = navigation.findRecentChanges(db, 0, {
      eventType: 'reach_presented',
      limit: 200,
    });
  } catch (_err) {
    return 0;
  }
  if (!Array.isArray(presentations)) return 0;
  const reachPresentations = presentations.filter(
    (row) => row && row.properties && row.properties.reach_id === reach_id
  );

  // Step 2: the W-th-most-recent presentation's createdAt is the window floor.
  // findRecentChanges returns DESC, so index W-1 is the W-th newest. Fewer than
  // W presentations -> open-ended window (floor 0).
  let windowFloorTs = 0;
  if (reachPresentations.length >= W) {
    const wth = reachPresentations[W - 1];
    if (wth && typeof wth.createdAt === 'number') {
      windowFloorTs = wth.createdAt;
    }
  }

  // Step 3: REJECT-only f_selector_decision rows for this reach_id newer than the
  // floor. findRecentChanges uses strict '>' on created_at (Phase 109), so a
  // reject AT exactly the floor presentation's timestamp is excluded -- but that
  // boundary collision is vanishingly unlikely (human-paced decisions) and the
  // window stays honored, not ignored.
  let decisions;
  try {
    decisions = navigation.findRecentChanges(db, windowFloorTs, {
      eventType: 'f_selector_decision',
      limit: 200,
    });
  } catch (_err) {
    return 0;
  }
  if (!Array.isArray(decisions)) return 0;
  let count = 0;
  for (const row of decisions) {
    if (row
        && row.properties
        && row.properties.reach_id === reach_id
        && _isRejectRow(row.properties)) {
      count += 1;
    }
  }
  return count;
}

module.exports = {
  rejectCountInWindow,
  presentationsCount,
  REACH_IDS,
  REJECT_WINDOW_DEFAULT,
};
