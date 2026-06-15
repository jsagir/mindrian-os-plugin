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

// ===========================================================================
// Phase 158-03 -- the named penalty + fence constants (RJP-05).
// ===========================================================================
// LOW-DATA TUNING RATIONALE (REQUIRED by RJP-05; mirror the
// selector-decisions.cjs:61 DECAY_WINDOW named-constant idiom + the
// dial-close-reach.cjs:79-94 PIVOT_PENALTY_FLOOR bounded-clamp idiom).
//
// These six are tuned CONSERVATIVELY for the current install base: ~4 active
// users and < 100 outcome edges (158-RESEARCH "Constant Values"). At that scale
// a learned refit (the FULL dormant SEED-009) would overfit the Wave-1 cohort,
// so this phase ships ONLY a bounded heuristic justified at any edge count. Each
// value is grounded against a shipped reference point and is flagged
// TUNABLE-LATER from telemetry once the outcome-edge corpus grows:
//
//   N (REJECT_SUPPRESS_THRESHOLD = 3) -- rejects-within-W to HARD-suppress. Small
//     enough that a chronically-rejected reach leaves the rendered set within a
//     working session, large enough that 1-2 noisy off-turn rejects never
//     suppress (the noise attack is further fenced by M). N counts rejects of ONE
//     reach_id, so the 6-bank size / MAX_K=3 are irrelevant to N (Priority 7).
//   M (MIN_PRESENTATIONS = 2) -- a reach is suppression-eligible only after it has
//     been PRESENTED >= M times. Defuses the small-sample noise attack
//     (1-2 rejects nuke a useful reach). Grounded a touch below DECAY_WINDOW=5.
//   W (REJECT_WINDOW = 8) -- the trailing PRESENTATION-units a reject must fall
//     within to count toward N (D-04 / D-10 Q1). Wider than DECAY_WINDOW=5 so a
//     streak is visible across a couple of turns, short enough that a stale streak
//     EXPIRES (the confirmation-bias loop's primary fence). This is the SINGLE
//     source of truth for W: passed to rejectCountInWindow via opts.window so the
//     module-local REJECT_WINDOW_DEFAULT below never diverges from it.
//   P (PAROLE_PERIOD = 5) -- every Pth presentation a suppressed reach is forced
//     back into the rendered set to re-test the navigator (deterministic parole,
//     D-06; counter-modular, NEVER an RNG draw). Grounded at the shipped
//     DECAY_WINDOW=5 cadence.
//   CAP (COUNT_PENALTY_CAP = 0.6) -- below N the score discount tops at 60%: a
//     strong nudge that stays rankable, leaving headroom above the registry-only
//     0.5 default so a discounted blend reach can fall below a fresh registry
//     reach. Mirrors the bounded-clamp discipline of PIVOT_PENALTY_FLOOR=0.2.
//   FLOOR (COMBINED_SUPPRESS_FLOOR = 0.05) -- below N the discounted score is
//     clamped to >= 5% of base so a heavily-rejected-but-recovering reach never
//     lands at EXACTLY 0 by accident (D-02a). 0 is reserved for the hard-suppress
//     DROP path, never produced by the discount.
//
// All six are NAMED constants (RJP-05): no magic literal gates the suppression
// check below.
const REJECT_SUPPRESS_THRESHOLD = 3; // N
const MIN_PRESENTATIONS = 2;         // M
const REJECT_WINDOW = 8;             // W (the single source of truth)
const PAROLE_PERIOD = 5;             // P
const COUNT_PENALTY_CAP = 0.6;       // CAP
const COMBINED_SUPPRESS_FLOOR = 0.05; // FLOOR (D-02a)

// W -- the recency-aging window, in PRESENTATION-units of THIS reach_id (D-04 /
// D-10 Q1). Only rejections inside the trailing W presentations of a reach count
// toward N, so suppression EXPIRES and the reach gets parole. The default here
// mirrors the D-09 starting value (W=8); Plan 03 reconciles this module-local
// default to the SHARED named constant REJECT_WINDOW (one source of truth for W)
// and may pass it explicitly via opts.window. The opts.window parameter is the
// reconciliation seam: when Plan 03's caller passes the named constant, it wins;
// otherwise this conservative default applies. As of Plan 03 the two are
// reconciled to the SAME literal via REJECT_WINDOW above; computeReachPenalties
// passes { window: REJECT_WINDOW } so there is one source of truth for W.
const REJECT_WINDOW_DEFAULT = REJECT_WINDOW;

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

// ---------------------------------------------------------------------------
// countPenalty(db, reach_id, roomState) -> number in [0, CAP]
//
// The SOLE multiplier on the reach surface (SC-03): the discounted score is
// baseScore * (1 - countPenalty). There is NO recency factor on the reach
// surface (unlike the command rail), so the D-02 recencyFactor term DROPS OUT;
// the count penalty is the only discount.
//
//   - Returns EXACTLY 0 when rejectCountInWindow === 0 (byte-stable-at-zero,
//     RJP-02/03: a zero-reject reach yields score * (1 - 0) = score, so
//     buildReachList output is byte-identical to the no-penalty baseline).
//   - Returns 0 when presentationsCount < MIN_PRESENTATIONS (the M fence: a reach
//     the navigator has barely seen is never discounted on 1-2 noisy rejects).
//   - Else min(COUNT_PENALTY_CAP, n / (REJECT_SUPPRESS_THRESHOLD + 1)): a bounded
//     discount (RJP-03) that rises with the reject count, capped at CAP=0.6.
//
// W is the named REJECT_WINDOW (one source of truth) passed to
// rejectCountInWindow via opts.window. Reads enums/scalars ONLY via the chokepoint.
// ---------------------------------------------------------------------------
function countPenalty(db, reach_id, roomState) {
  const n = rejectCountInWindow(db, reach_id, roomState, { window: REJECT_WINDOW });
  if (n === 0) return 0; // byte-stable-at-zero (RJP-02): no reject -> no discount
  const pres = presentationsCount(db, reach_id, roomState);
  if (pres < MIN_PRESENTATIONS) return 0; // M fence (small-sample noise attack)
  const penalty = n / (REJECT_SUPPRESS_THRESHOLD + 1);
  return penalty < COUNT_PENALTY_CAP ? penalty : COUNT_PENALTY_CAP; // bounded (RJP-03)
}

// ---------------------------------------------------------------------------
// isHardSuppressed(db, reach_id, roomState) -> boolean
//
// True when this reach_id should be DROPPED from buildReachList's rendered set
// (D-05), gated by ALL FOUR bias-control fences:
//   (M) min-presentations floor -- false when presentationsCount < MIN_PRESENTATIONS
//       (a reach the navigator barely saw is never suppressed on noise).
//   (P) periodic deterministic parole -- false when presentationsCount > 0 AND
//       presentationsCount % PAROLE_PERIOD === 0 (every Pth presentation forces a
//       suppressed reach back to re-test the navigator; deterministic, NEVER
//       an RNG draw -- D-06).
//   (N within W) -- else rejectCountInWindow >= REJECT_SUPPRESS_THRESHOLD, where
//       the count is REJECT-only within the trailing W presentation-units (the
//       W-aging fence lives inside rejectCountInWindow: a stale streak expires).
//   (per-room scope) -- the readers read ONLY the passed db (the active room's
//       room.db); suppression state is never aggregated across rooms (Part 8).
//
// Parole only fires for a reach that would otherwise be suppressed (which
// requires >= N rejects, which requires presentations), so a zero-reject room
// never triggers parole and byte-stable-at-zero (RJP-02) holds.
// ---------------------------------------------------------------------------
function isHardSuppressed(db, reach_id, roomState) {
  const pres = presentationsCount(db, reach_id, roomState);
  if (pres < MIN_PRESENTATIONS) return false; // M fence
  if (pres > 0 && pres % PAROLE_PERIOD === 0) return false; // P parole (deterministic, D-06)
  const n = rejectCountInWindow(db, reach_id, roomState, { window: REJECT_WINDOW });
  return n >= REJECT_SUPPRESS_THRESHOLD; // N within W (D-05)
}

// ---------------------------------------------------------------------------
// computeReachPenalties(db, roomState) -> { discountedScores, suppressedReachIds }
//
// The upstream fold (SC-07): run on the LIVE engine arm where db is open, compute
// the per-reach_id discount + the hard-suppression set, and hand BOTH back as
// plain scalars/sets so the PURE buildReachList can apply them without ever
// seeing db. db is NEVER threaded into dial-reach-orchestrator.
//
//   - For each of the 6 frozen reach_ids that has a base prior in
//     roomState.reachScores (a finite number): discounted = base * (1 - countPenalty).
//     When NOT hard-suppressed, floor the discounted score at base * FLOOR (D-02a)
//     so a discounted-but-present reach never lands at exactly 0 (0 is reserved for
//     the hard-suppress DROP). discountedScores carries ONLY reach_ids that had a
//     base prior AND a non-identity discount is irrelevant -- we always emit the
//     recomputed value for reaches with a prior, so the caller's Object.assign is a
//     no-op at zero penalty (base * (1 - 0) === base, floored by >= base*FLOOR <= base).
//   - suppressedReachIds collects every reach_id where isHardSuppressed is true.
//   - When roomState provides no reachScores and no reject signal, discountedScores
//     is empty and suppressedReachIds is empty -> byte-stable foundation (RJP-02):
//     buildReachList sees an unchanged reachScores map and an empty drop set.
//
// Reads ONLY via the navigation chokepoint (through the two readers). No reason,
// no Brain, per-room scope (Part 8 / Part 9).
// ---------------------------------------------------------------------------
function computeReachPenalties(db, roomState) {
  const out = { discountedScores: {}, suppressedReachIds: [] };
  const state = (roomState && typeof roomState === 'object') ? roomState : {};
  const scores = (state.reachScores && typeof state.reachScores === 'object')
    ? state.reachScores : {};
  for (const reach_id of REACH_IDS) {
    // Hard-suppression is independent of whether a base prior exists.
    if (isHardSuppressed(db, reach_id, state)) {
      out.suppressedReachIds.push(reach_id);
    }
    // The discount only applies where a base prior exists; reaches with no
    // supplied prior are left to the orchestrator's existing default path so
    // byte-stability holds (we never invent a score the caller did not supply).
    const base = scores[reach_id];
    if (typeof base === 'number' && Number.isFinite(base)) {
      const cp = countPenalty(db, reach_id, state);
      let discounted = base * (1 - cp);
      if (!isHardSuppressed(db, reach_id, state)) {
        const floorVal = base * COMBINED_SUPPRESS_FLOOR;
        if (discounted < floorVal) discounted = floorVal; // D-02a, never accidental 0
      }
      out.discountedScores[reach_id] = discounted;
    }
  }
  return out;
}

module.exports = {
  rejectCountInWindow,
  presentationsCount,
  countPenalty,
  isHardSuppressed,
  computeReachPenalties,
  REACH_IDS,
  REJECT_WINDOW_DEFAULT,
  REJECT_SUPPRESS_THRESHOLD,
  MIN_PRESENTATIONS,
  REJECT_WINDOW,
  PAROLE_PERIOD,
  COUNT_PENALTY_CAP,
  COMBINED_SUPPRESS_FLOOR,
};
