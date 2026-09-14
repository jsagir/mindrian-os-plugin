'use strict';
/*
 * lib/core/navigation/claim-counter-metric.cjs -- Phase 343 Plan 05, Task 1.
 *
 * THE STATEMENT HOME of the first declared counter-metric pair (WD-9,
 * SENS-06's own `watched_by` record in lib/core/sensors/sensor-priority.cjs):
 * claims filed, versus claims carrying a `CONTRADICTS` edge, versus claims
 * old enough to have been cited that are no edge's target. The interpretation
 * of these numbers lives in docs/COUNTER-METRIC-DOCTRINE.md, not here -- this
 * file computes, that document reads.
 *
 * A pure module over a CALLER-SUPPLIED open handle, the same shape as its
 * sibling lib/core/navigation/graph-integrity-counts.cjs: it requires NOTHING
 * from node:sqlite and opens NOTHING itself. The caller (the doctor organ in
 * lib/core/doctor/room-graph-integrity-module.cjs, or a future sensor) owns
 * the handle and its lifecycle. `schemaVariant` is REQUIRED from the sibling
 * file rather than re-implemented, so there is one home for the PRAGMA
 * table_info(nodes) gate the whole 343 phase depends on.
 *
 * The counts-only contract (the same nine rules graph-integrity-counts.cjs
 * states in full, restated here for the one rule this file adds):
 *   - status is decided by the CALLER; this file never returns a status.
 *   - there is no fix of any kind here. A count is a measurement.
 *   - a statement the schema cannot answer returns `null`, NEVER `0`.
 *   - every table/column name below is a fixed literal; every window is a
 *     bound `?` parameter. Zero caller-supplied values are ever concatenated.
 *   - THIS FILE'S OWN RULE: `divergence` is a BOOLEAN or `null`, never a
 *     float, never a percentage, and never a ratio rendered as a verdict.
 *     Two counts and a boolean is the whole output shape. Dividing one count
 *     by another (a "percent unanchored" style figure), or calling
 *     `toFixed` on any quotient, would turn the divergence into a score --
 *     and a score is exactly the quantity a future optimizing node would
 *     then start pushing on, which is the one thing this pair exists to
 *     catch, not become.
 *
 * The counting rule, inherited verbatim from
 * data/harness-policies/_schema.json's `promotion_rule_doc.counting_rule`:
 * an unread log and a clean log are indistinguishable from the count alone,
 * so a `claims_with_contradicts_edge: 0` reading means "nobody has
 * contradicted anything," never "the graph's claims are clean." See
 * docs/COUNTER-METRIC-DOCTRINE.md Section 3 for the rule's own source text.
 *
 * Canon Part 8: pure LOCAL SQLite reads over a caller-owned handle. Zero
 * network, zero Brain, zero telemetry. Canon Part 9: this file never opens a
 * database; it only ever receives a handle from a caller who opened it
 * through the navigation chokepoint's read-only door.
 *
 * Interpretation home: docs/COUNTER-METRIC-DOCTRINE.md. This file computes
 * four integers and one tri-state boolean; it carries no second copy of the
 * doctrine's reasoning about what those numbers mean.
 *
 * Banned-adjective list (this is the ONLY place in this file these words may
 * appear -- never in an exported string, a returned key, or a comment
 * elsewhere in this file): orphan, orphaned, dangling, broken, corrupt,
 * stale, unhealthy, degraded, dense, sparse, density, risk, healthy, low,
 * high, ratio, score, percent.
 */

const { schemaVariant } = require('./graph-integrity-counts.cjs');

// A claim younger than this many days has not had time to be cited, so
// counting it as uncited would manufacture the divergence this metric
// exists to detect rather than measure it. Named once, never inlined into a
// statement.
const CITATION_LAG_DAYS = 30;

// safeCount(db, sql, params) -> the `c` column of one row, or 0 on any throw
// (a missing table, most commonly). Every `sql` argument passed in from this
// file is a fixed literal; only `params` ever carries a caller-supplied
// value, and it is always bound, never concatenated.
function safeCount(db, sql, params) {
  try {
    const row = db.prepare(sql).get(...(params || []));
    return (row && typeof row.c === 'number') ? row.c : 0;
  } catch (_e) {
    return 0;
  }
}

// Statement 1: claims filed, every schema variant (`type` exists everywhere).
const SQL_CLAIMS_FILED = "SELECT count(*) AS c FROM nodes WHERE type = 'claim'";

// Statement 2: claims filed past the citation lag, migrated/partial only
// (needs `created_at`).
const SQL_CLAIMS_FILED_PAST_LAG = "SELECT count(*) AS c FROM nodes "
  + "WHERE type = 'claim' AND created_at IS NOT NULL AND created_at < ?";

// Statement 3: claims carrying a CONTRADICTS edge in EITHER direction, every
// variant. Either direction is deliberate: a claim that contradicts
// something and a claim something contradicts are both claims the graph has
// an opinion about, which is what this pair watches for.
const SQL_CLAIMS_WITH_CONTRADICTS_EDGE = "SELECT count(*) AS c FROM nodes n "
  + "WHERE n.type = 'claim' AND EXISTS (SELECT 1 FROM edges e "
  + "WHERE (e.source = n.id OR e.target = n.id) AND e.type = 'CONTRADICTS')";

// Statement 4: claims past the lag that are no edge's target, migrated/
// partial only (needs `created_at`).
const SQL_CLAIMS_NO_INCOMING_EDGE_PAST_LAG = "SELECT count(*) AS c FROM nodes n "
  + "WHERE n.type = 'claim' AND n.created_at IS NOT NULL AND n.created_at < ? "
  + "AND NOT EXISTS (SELECT 1 FROM edges e WHERE e.target = n.id)";

// computeDivergence(pastLag, contradicts, noIncoming) -> true | false | null.
//
// Defined once, here, and NEVER re-derived by a caller. `divergence` is
// `true` when `pastLag` is a number greater than zero AND `contradicts` is
// `0` AND `noIncoming` equals `pastLag`. It is `false` when any of those
// fails on a schema that can answer (including the empty-graph case, where
// `pastLag` is `0`: an empty graph has not diverged, it is empty). It is
// `null` when `pastLag` is itself `null` (the schema cannot answer the
// window questions at all, e.g. a legacy three-column room), because `false`
// would assert that the room has not diverged, which is a claim the data
// does not support.
function computeDivergence(pastLag, contradicts, noIncoming) {
  if (typeof pastLag !== 'number') return null;
  return pastLag > 0 && contradicts === 0 && noIncoming === pastLag;
}

/**
 * countClaimCounterMetric(db, opts) -> the four counts and the divergence
 * boolean, over one open caller-supplied handle. Never opens or closes
 * `db`; never throws. `opts` is reserved for a future per-call override and
 * is currently unused -- there is no threshold in this file.
 *
 * @param {{prepare: Function}} db - a caller-owned, already-open handle
 * @param {object} [_opts] - reserved, currently unused
 * @returns {{
 *   claims_filed: number,
 *   claims_filed_past_citation_lag: number|null,
 *   claims_with_contradicts_edge: number,
 *   claims_no_incoming_edge_past_citation_lag: number|null,
 *   divergence: boolean|null
 * }}
 */
function countClaimCounterMetric(db, _opts) {
  const variant = schemaVariant(db);
  const columnAware = variant === 'migrated' || variant === 'partial';

  const claimsFiled = safeCount(db, SQL_CLAIMS_FILED);
  const claimsWithContradictsEdge = safeCount(db, SQL_CLAIMS_WITH_CONTRADICTS_EDGE);

  let claimsFiledPastCitationLag;
  let claimsNoIncomingEdgePastCitationLag;

  if (columnAware) {
    const cutoff = Date.now() - (CITATION_LAG_DAYS * 86400000);
    claimsFiledPastCitationLag = safeCount(db, SQL_CLAIMS_FILED_PAST_LAG, [cutoff]);
    claimsNoIncomingEdgePastCitationLag = safeCount(
      db, SQL_CLAIMS_NO_INCOMING_EDGE_PAST_LAG, [cutoff]
    );
  } else if (claimsFiled === 0) {
    // No claim rows exist at all -- `claimsFiled` is measured via the `type`
    // column alone, present on every schema generation, so this is not a
    // schema limitation, it is a vacuous truth: zero claims means zero
    // claims past the lag and zero claims with no incoming edge, whether the
    // variant is 'legacy' or 'unreadable'. This is the ONLY path that may
    // report 0 for these two fields on a non-column-aware schema.
    claimsFiledPastCitationLag = 0;
    claimsNoIncomingEdgePastCitationLag = 0;
  } else {
    // 'legacy' or 'unreadable', WITH real claim rows present: the schema
    // cannot answer a created_at window question, whether that is because
    // the columns are absent (legacy) or because schemaVariant()'s PRAGMA
    // probe itself failed, returned zero columns, or matched no known marker
    // (unreadable -- which is NOT synonymous with "empty": a thrown PRAGMA
    // or an unmapped column set can occur on a real, populated room.db).
    // Strict null in both cases, matching graph-integrity-counts.cjs's own
    // rule and this file's own documented contract (line 24): a statement
    // the schema cannot answer returns null, NEVER 0, because 0 here would
    // assert "measured, not diverged" for a window that was never read.
    claimsFiledPastCitationLag = null;
    claimsNoIncomingEdgePastCitationLag = null;
  }

  const divergence = computeDivergence(
    claimsFiledPastCitationLag, claimsWithContradictsEdge, claimsNoIncomingEdgePastCitationLag
  );

  return {
    claims_filed: claimsFiled,
    claims_filed_past_citation_lag: claimsFiledPastCitationLag,
    claims_with_contradicts_edge: claimsWithContradictsEdge,
    claims_no_incoming_edge_past_citation_lag: claimsNoIncomingEdgePastCitationLag,
    divergence,
  };
}

module.exports = {
  countClaimCounterMetric,
  CITATION_LAG_DAYS,
};
