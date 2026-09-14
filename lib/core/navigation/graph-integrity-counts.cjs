'use strict';
/*
 * lib/core/navigation/graph-integrity-counts.cjs -- Phase 343 Plan 02, Task 1.
 *
 * THE SINGLE HOME of every room-graph integrity statement. Both this phase's
 * doctor organ (lib/core/doctor/room-graph-integrity-module.cjs) and the
 * sensor that ships in 343-06 require this file rather than carrying a second
 * copy of the same SQL, so the two never drift into disagreement about what
 * a defect count means.
 *
 * A pure module over a CALLER-SUPPLIED open handle, exactly the shape
 * lib/core/sensors/sensor-expert-skill.cjs::detectExpertSkillCandidates
 * already uses: it requires NOTHING from node:sqlite and opens NOTHING
 * itself. The caller (the doctor organ, or the sensor ctx-assembly step)
 * owns the handle and its lifecycle.
 *
 * The counts-only contract, nine rules (five copied verbatim from this
 * file's own sibling Phase 232.1 per-room row-count organ's own docblock,
 * four added by this organ's own shape; the test enforces all nine):
 *   1. status is decided by the CALLER (this file returns raw numbers, never
 *      a status field); the caller's status is NEVER 'warn', no matter how
 *      large a count is. Inflating the drift tally and printing a "run
 *      /mos:doctor --fix" block for an organ with no fix would be wrong.
 *   2. there is NO fix of any kind here or in the caller. A count is a
 *      measurement; there is nothing to repair about a measurement.
 *   3. one bad room is the caller's problem, not this file's: this file
 *      takes an already-open handle and never touches the registry.
 *   4. the payload this file returns carries integers, a schema-variant
 *      marker string, and (one field only) a capped, shape-filtered list of
 *      short uppercase type names read out of a room database -- never a
 *      node id (a node id in this codebase is a section path, which is room
 *      content), never a filesystem path, never claim text.
 *   5. a statement the schema cannot answer returns `null`, NEVER `0`. `0`
 *      would read as "measured and clean," which is a false claim about a
 *      column that was never read.
 *   6. there is no threshold anywhere in this file. The threshold, if any,
 *      belongs to the sensor in 343-06, and it is per room.
 *   7. two candidate statements ship as `NOT_MEASURABLE` records, never as
 *      statements: a measurement that structurally cannot be non-zero is
 *      worse than no measurement, because it reads as a clean result rather
 *      than an unmeasured gap.
 *   8. the one payload field that carries strings read out of a room
 *      database, `edge_types_outside_allowlist`, is shape-filtered to the
 *      uppercase identifier shape and capped at 20 names. A type name is
 *      vocabulary, not room content, but a row in a room database can hold
 *      any string, so only values matching the shape are named and the
 *      remainder is reported as a count.
 *   9. every table and column name below is a fixed literal; every window
 *      is a bound `?` parameter. Zero caller-supplied values are ever
 *      concatenated into a statement.
 *
 * Banned-adjective list (this is the ONLY place in this file these words may
 * appear -- never in an exported string, a returned key, or a comment
 * elsewhere in this file): orphan, orphaned, dangling, broken, corrupt,
 * stale, unhealthy, degraded, dense, sparse, density, risk, healthy, low,
 * high. This is why the count fields below are named
 * `edge_rows_missing_endpoint`, `proposed_nodes_past_window` and
 * `edge_rows_type_outside_allowlist` rather than the shorter words the
 * roadmap prose uses: a count that acquires an adjective becomes a health
 * claim SEED-074's guard forbids. Say "edge rows whose source or target id
 * has no node row: N" and stop. The number is a fact; the word for it is a
 * judgment.
 *
 * Canon Part 8: pure LOCAL SQLite reads over a caller-owned handle. Zero
 * network, zero Brain, zero telemetry.
 *
 * Canon Part 9: this file never opens a database. It only ever receives a
 * handle from a caller who opened it through the navigation chokepoint's
 * read-only door (openRoomDbReadOnlyForCaller); the caller owns close().
 *
 * Fleet measurement, Phase 347 research addendum, 2026-09-14 (see
 * docs/343-ROOM-GRAPH-CENSUS-DECISIONS.md Section 3 for the full baseline
 * and its drift warning): edge rows carrying a type outside the exported
 * ALLOWED_EDGE_TYPES: 'BELONGS_TO' 1,032, 'WHITESPACE_DETECTED' 215,
 * 'HSI_CONNECTION' 47, none of them a member of the 44-member allowlist,
 * written by raw `INSERT INTO edges` statements at lib/core/graph-ops.cjs:196,
 * :250, :262 and scripts/build-ecosystem-graph.cjs that bypass writeEdge and
 * therefore bypass its membership check. This is measured here (see
 * WRITER_NOTE below); the fix is Phase 273 territory.
 */

const { ALLOWED_EDGE_TYPES } = require('./edges.cjs');

// -- Named constants, declared once, never inlined into a statement --------

// A proposed node older than this many days is counted by statement 3.
const STALE_PROPOSED_DAYS = 30;

// A claim younger than this many days is reported as pending anchor, never
// as a defect (WD-10).
const ANCHOR_GRACE_DAYS = 7;

// The census date (WD-4): a claim written before this instant belongs to the
// legacy cohort for the unanchored-claim split. Date.UTC's month argument is
// 0-indexed, so 8 is September; this is 2026-09-14T00:00:00.000Z.
const LEGACY_COHORT_BEFORE_MS = Date.UTC(2026, 8, 14);

// The uppercase-identifier shape a named offending edge type must match
// (T-343-23): a row in a room database can hold any string, so only values
// shaped like the vocabulary this codebase actually mints are named.
const EDGE_TYPE_NAME_SHAPE = /^[A-Z][A-Z0-9_]*$/;

// The cap on how many distinct offending type names ride the payload.
const EDGE_TYPE_NAME_CAP = 20;

// NOT_MEASURABLE: two candidate defect statements this organ deliberately
// does not ship, per WD-1 and CENSUS-04. Frozen; carried in the module's own
// output rather than only in a document, so a reader sees the reason without
// leaving the report.
const NOT_MEASURABLE = Object.freeze([
  Object.freeze({
    term: 'stub_or_placeholder_node',
    reason: 'No working definition survives contact with the schema. The '
      + 'obvious test (properties IS NULL OR properties = \'\' OR '
      + 'properties = \'{}\') returns zero across all 30 live rooms, because '
      + 'insertNode requires epistemic_type and fills provenance columns on '
      + 'every write, making a structurally empty node close to unwritable '
      + 'through the chokepoint. A measurement that cannot be non-zero reads '
      + 'as a clean result rather than an unmeasured gap, so it does not '
      + 'ship as a defect statement.',
  }),
  Object.freeze({
    term: 'memory_event_provenance_edge',
    reason: 'lib/core/navigation/memory-events.cjs:764-777 logEvent writes '
      + 'zero edges. No edge type in the fleet links a claim to a '
      + 'memory_event node; of 23,736 memory_event nodes fleet-wide, only '
      + '953 are any edge\'s endpoint at all, and none of those edges are a '
      + 'provenance link. The phrase names a design, not a shipped '
      + 'mechanism, so it does not ship as a defect statement.',
  }),
]);

// WRITER_NOTE: the CENSUS-05 statement, in adjective-free language, naming
// both writer gaps this organ's statements measure the consequence of.
// Changing either writer is Phase 273 territory and out of scope here, which
// measures and does not fix.
const WRITER_NOTE = 'Claim nodes counted by the no-anchor statement carry no '
  + 'SOURCED_FROM or DERIVED_FROM out-edge. '
  + 'lib/core/navigation/typed-claim.cjs:121 writeClaimNode inserts a claim '
  + 'node and writes zero edges and is the dominant claim producer in the '
  + 'fleet. lib/core/navigation/reasoning-write.cjs:185, the only '
  + 'SOURCED_FROM writer, has produced zero rows in any room because both of '
  + 'its callers supply an empty evidence list. Separately, '
  + 'lib/core/graph-ops.cjs:196, :250 and :262, and scripts/'
  + 'build-ecosystem-graph.cjs, issue raw INSERT INTO edges statements that '
  + 'bypass writeEdge and therefore bypass its ALLOWED_EDGE_TYPES membership '
  + 'check, which is why edge rows carrying a type outside the allowlist '
  + 'exist at all and why CLAUDE.md:153\'s statement that typed edges are '
  + 'written only through navigation.cjs does not currently hold. Changing '
  + 'either writer is Phase 273 territory and is out of scope for this '
  + 'organ, which measures and does not fix.';

// schemaVariant(db) -- PRAGMA table_info(nodes) probe, mirroring
// node-insert.cjs::isMigratedSchema's SHAPE without duplicating its meaning:
// that helper probes for a single marker column and defaults to false on any
// failure; this probes for three possible marker columns across the three
// live schema generations (docs/343-ROOM-GRAPH-CENSUS-DECISIONS.md Section 3:
// 23 rooms migrated, 3 partial, 4 legacy) and returns a name, never a
// boolean. A `nodes` table entirely absent (no columns reported at all) and
// a thrown PRAGMA both fall through to 'unreadable': there is nothing this
// caller-supplied handle can answer either way.
function schemaVariant(db) {
  let cols;
  try {
    cols = db.prepare('PRAGMA table_info(nodes)').all();
  } catch (_e) {
    return 'unreadable';
  }
  if (!Array.isArray(cols) || cols.length === 0) return 'unreadable';
  const names = new Set(cols.map((c) => c && c.name));
  if (names.has('last_modified_at')) return 'migrated';
  if (names.has('review_status')) return 'partial';
  if (names.has('properties')) return 'legacy';
  return 'unreadable';
}

// safeCount(db, sql, params) -> the `c` column of one row, or 0 on any throw
// (a missing table, most commonly). Mirrors the Phase 232.1 sibling organ's
// countTable catch-returns-0 idiom for a TABLE-level failure. Every `sql`
// argument passed in from this file is a fixed literal; only `params` ever
// carries a caller-supplied value, and it is always bound, never
// concatenated.
function safeCount(db, sql, params) {
  try {
    const row = db.prepare(sql).get(...(params || []));
    return (row && typeof row.c === 'number') ? row.c : 0;
  } catch (_e) {
    return 0;
  }
}

// Statement 1 (WD-2): edge rows whose source or target id has no matching
// node row, counted as DISTINCT rows. The both-endpoints-missing case is the
// load-bearing shape this statement must get right: it must count once, not
// twice, so one edge row missing both endpoints does not read as two
// defects. Runs on every schema variant; every live schema generation
// carries `id` on nodes and `source`/`target` on edges.
const SQL_EDGE_ROWS_MISSING_ENDPOINT = 'SELECT count(*) AS c FROM edges e '
  + 'WHERE NOT EXISTS (SELECT 1 FROM nodes n WHERE n.id = e.source) '
  + 'OR NOT EXISTS (SELECT 1 FROM nodes n WHERE n.id = e.target)';

// Statement 2 (WD-1, WD-4): claim nodes with no provenance out-edge.
// DERIVED_FROM sits in the anchor set alongside SOURCED_FROM because Phase
// 120-00 made it the hard structural floor for Breakthrough provenance, so a
// claim reached that way IS anchored. Runs on every schema variant (`type`
// exists everywhere); the total is never null.
const SQL_CLAIM_NODES_NO_ANCHOR_TOTAL = 'SELECT count(*) AS c FROM nodes n '
  + "WHERE n.type = 'claim' AND NOT EXISTS ("
  + 'SELECT 1 FROM edges e WHERE e.source = n.id '
  + "AND e.type IN ('SOURCED_FROM','DERIVED_FROM'))";

// WD-4's three-way split, migrated/partial only (needs created_at). Legacy
// and unreadable report all three as null (see countGraphIntegrity below).
const SQL_CLAIM_NODES_NO_ANCHOR_LEGACY = 'SELECT count(*) AS c FROM nodes n '
  + "WHERE n.type = 'claim' AND NOT EXISTS ("
  + 'SELECT 1 FROM edges e WHERE e.source = n.id '
  + "AND e.type IN ('SOURCED_FROM','DERIVED_FROM')) "
  + 'AND n.created_at < ?';

const SQL_CLAIM_NODES_NO_ANCHOR_NEW = 'SELECT count(*) AS c FROM nodes n '
  + "WHERE n.type = 'claim' AND NOT EXISTS ("
  + 'SELECT 1 FROM edges e WHERE e.source = n.id '
  + "AND e.type IN ('SOURCED_FROM','DERIVED_FROM')) "
  + 'AND n.created_at >= ? AND n.created_at < ?';

const SQL_CLAIM_NODES_WITHIN_GRACE_WINDOW = 'SELECT count(*) AS c FROM nodes n '
  + "WHERE n.type = 'claim' AND NOT EXISTS ("
  + 'SELECT 1 FROM edges e WHERE e.source = n.id '
  + "AND e.type IN ('SOURCED_FROM','DERIVED_FROM')) "
  + 'AND n.created_at >= ?';

// Statement 3 (WD-10): proposed nodes older than STALE_PROPOSED_DAYS.
// Migrated and partial only (needs review_status + created_at); legacy and
// unreadable report null, never zero.
const SQL_PROPOSED_NODES_PAST_WINDOW = 'SELECT count(*) AS c FROM nodes '
  + "WHERE review_status = 'proposed' AND created_at IS NOT NULL "
  + 'AND created_at < ?';

// Statement 4: unresolved CONTRADICTS edges. Every variant.
const SQL_CONTRADICTS_EDGES = "SELECT count(*) AS c FROM edges WHERE type = 'CONTRADICTS'";

// Statement 5: self-referencing edges. Every variant.
const SQL_SELF_REFERENCING_EDGES = 'SELECT count(*) AS c FROM edges WHERE source = target';

// Statement 6 (WD-18, the Phase 347 research addendum): edge rows whose type
// falls outside the allowlist writeEdge enforces. The vocabulary is NEVER
// copied here -- ALLOWED_EDGE_TYPES is required from ./edges.cjs and the
// statement computes a set difference, so this file can never drift from the
// rule it measures. Runs on every schema variant; `type` exists in all
// three, so this is never null.
const SQL_EDGE_TYPE_GROUPS = 'SELECT type, count(*) AS c FROM edges GROUP BY type';

function countEdgeTypesOutsideAllowlist(db) {
  let rows;
  try {
    rows = db.prepare(SQL_EDGE_TYPE_GROUPS).all();
  } catch (_e) {
    return {
      edge_rows_type_outside_allowlist: 0,
      edge_types_outside_allowlist: [],
      edge_types_outside_allowlist_unnameable: 0,
    };
  }
  if (!Array.isArray(rows)) {
    return {
      edge_rows_type_outside_allowlist: 0,
      edge_types_outside_allowlist: [],
      edge_types_outside_allowlist_unnameable: 0,
    };
  }

  let totalRows = 0;
  const nameable = [];
  let unnameableDistinct = 0;

  for (const row of rows) {
    const type = row && row.type;
    const count = (row && typeof row.c === 'number') ? row.c : 0;
    if (typeof type !== 'string' || ALLOWED_EDGE_TYPES.has(type)) continue;
    totalRows += count;
    if (EDGE_TYPE_NAME_SHAPE.test(type)) {
      nameable.push(type);
    } else {
      unnameableDistinct += 1;
    }
  }

  nameable.sort();
  const capped = nameable.slice(0, EDGE_TYPE_NAME_CAP);
  unnameableDistinct += Math.max(0, nameable.length - EDGE_TYPE_NAME_CAP);

  return {
    edge_rows_type_outside_allowlist: totalRows,
    edge_types_outside_allowlist: capped,
    edge_types_outside_allowlist_unnameable: unnameableDistinct,
  };
}

/**
 * countGraphIntegrity(db, opts) -> the full statement bag for one open
 * caller-supplied handle. Never opens or closes `db`; never throws. `opts`
 * is reserved for a future per-call override and is currently unused --
 * there is no threshold in this file (rule 6 above).
 *
 * @param {{prepare: Function}} db - a caller-owned, already-open handle
 * @param {object} [_opts] - reserved, currently unused
 * @returns {object} the statement bag described in this file's header
 */
function countGraphIntegrity(db, _opts) {
  const variant = schemaVariant(db);
  const columnAware = variant === 'migrated' || variant === 'partial';

  const edgeRowsMissingEndpoint = safeCount(db, SQL_EDGE_ROWS_MISSING_ENDPOINT);
  const claimNodesNoAnchorTotal = safeCount(db, SQL_CLAIM_NODES_NO_ANCHOR_TOTAL);
  const contradictsEdges = safeCount(db, SQL_CONTRADICTS_EDGES);
  const selfReferencingEdges = safeCount(db, SQL_SELF_REFERENCING_EDGES);
  const edgeTypeCounts = countEdgeTypesOutsideAllowlist(db);

  let claimNodesNoAnchorLegacy = null;
  let claimNodesNoAnchorNew = null;
  let claimNodesWithinGraceWindow = null;
  let proposedNodesPastWindow = null;

  if (columnAware) {
    const now = Date.now();
    const graceCutoff = now - (ANCHOR_GRACE_DAYS * 86400000);
    claimNodesNoAnchorLegacy = safeCount(
      db, SQL_CLAIM_NODES_NO_ANCHOR_LEGACY, [LEGACY_COHORT_BEFORE_MS]
    );
    claimNodesNoAnchorNew = safeCount(
      db, SQL_CLAIM_NODES_NO_ANCHOR_NEW, [LEGACY_COHORT_BEFORE_MS, graceCutoff]
    );
    claimNodesWithinGraceWindow = safeCount(
      db, SQL_CLAIM_NODES_WITHIN_GRACE_WINDOW, [graceCutoff]
    );
    proposedNodesPastWindow = safeCount(
      db, SQL_PROPOSED_NODES_PAST_WINDOW, [now - (STALE_PROPOSED_DAYS * 86400000)]
    );
  }

  return {
    schema_variant: variant,
    edge_rows_missing_endpoint: edgeRowsMissingEndpoint,
    claim_nodes_no_anchor_total: claimNodesNoAnchorTotal,
    claim_nodes_no_anchor_legacy: claimNodesNoAnchorLegacy,
    claim_nodes_no_anchor_new: claimNodesNoAnchorNew,
    claim_nodes_within_grace_window: claimNodesWithinGraceWindow,
    proposed_nodes_past_window: proposedNodesPastWindow,
    contradicts_edges: contradictsEdges,
    self_referencing_edges: selfReferencingEdges,
    edge_rows_type_outside_allowlist: edgeTypeCounts.edge_rows_type_outside_allowlist,
    edge_types_outside_allowlist: edgeTypeCounts.edge_types_outside_allowlist,
    edge_types_outside_allowlist_unnameable: edgeTypeCounts.edge_types_outside_allowlist_unnameable,
  };
}

module.exports = {
  schemaVariant,
  countGraphIntegrity,
  NOT_MEASURABLE,
  STALE_PROPOSED_DAYS,
  ANCHOR_GRACE_DAYS,
  LEGACY_COHORT_BEFORE_MS,
  WRITER_NOTE,
};
