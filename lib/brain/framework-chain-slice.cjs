'use strict';
// Phase 125-02 -- Brain Cypher slice query (parameterized 1-3 hop FEEDS_INTO; LIMIT 50).
// CONTEXT.md Scope IN section B item 4 -- the LOCKED Cypher. Async wrapper over
// brain-client.query that produces the framework_chain_hint shape Plan 03 stitches
// into the packet's local_graph_summary.
//
// Canon Part 8: only $active_frameworks (array of generic framework name strings,
// each passed through sanitizeCypherInput) + $max_hops (1|2|3 int) cross the wire.
// No user content. No artifact text. No room identifiers in the query.
//
// Graceful degradation: any failure path (Brain unreachable, query throws, invalid
// max_hops, empty active_frameworks, all-rejected-by-sanitizer, non-array result)
// returns a degraded result envelope rather than throwing. Tier 0 stays functional.

const crypto = require('node:crypto');
const defaultBrainClient = require('../core/brain-client.cjs');

// LOCKED Cypher template per CONTEXT.md Scope IN section B item 4.
// READ-ONLY (MATCH/RETURN/LIMIT only -- no MERGE/CREATE/DELETE). The two $-bound
// params ($active_frameworks, $max_hops) are the ONLY values that cross the wire;
// every framework name in $active_frameworks is sanitized via the brain-client
// sanitizeCypherInput whitelist before binding (Canon Part 8 invariant).
const FRAMEWORK_CHAIN_SLICE_CYPHER =
  'MATCH (f:Framework)-[r:FEEDS_INTO*1..$max_hops]->(g:Framework) ' +
  'WHERE f.name IN $active_frameworks ' +
  'RETURN f.name AS from, g.name AS to, ' +
  '       r.confidence AS confidence, ' +
  '       r.transform_description AS transform_description, ' +
  '       length(r) AS hop_distance ' +
  'LIMIT 50';

function _nowIso() {
  return new Date().toISOString();
}

function _sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
}

function _degraded(opts) {
  const max_hops = (opts && (opts.max_hops === 1 || opts.max_hops === 2 || opts.max_hops === 3))
    ? opts.max_hops
    : 3;
  return {
    edges: [],
    slice_scope: max_hops,
    slice_rationale: (opts && opts.rationale) ? String(opts.rationale) : 'degraded',
    brain_snapshot_id: null,
    fetched_at: _nowIso(),
  };
}

// Normalize result rows from brain-client.query. The shipped brain-client.query
// returns { records: Array<row> } for the brain_query path; tests + the
// CONTEXT.md spec describe the inner array of rows. Accept BOTH shapes so we
// stay compatible whether the caller stubs query() with an Array directly OR
// the live brain-client wraps in { records }. Any other shape degrades cleanly.
function _unwrapRows(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.records)) return result.records;
  return null;
}

/**
 * Fetch a parameterized 1-3 hop FEEDS_INTO slice from the live Brain.
 *
 * @param {object} opts
 * @param {string[]} opts.active_frameworks - Array of framework name strings.
 *   Empty array short-circuits to a degraded envelope.
 * @param {1|2|3} opts.max_hops - Hop depth (must be exactly 1, 2, or 3).
 *   Any other value short-circuits to a degraded envelope.
 * @param {object} [opts.brainClient] - Test seam; defaults to live brain-client.
 * @returns {Promise<{
 *   edges: Array<{from:string|null, to:string|null, confidence:number|null,
 *                 transform_description:string|null, hop_distance:number|null}>,
 *   slice_scope: 1|2|3,
 *   slice_rationale: string,
 *   brain_snapshot_id: string|null,
 *   fetched_at: string
 * }>}
 */
async function fetchFrameworkChainSlice(opts) {
  const o = opts || {};
  const active_frameworks = Array.isArray(o.active_frameworks) ? o.active_frameworks : [];
  const max_hops = (o.max_hops === 1 || o.max_hops === 2 || o.max_hops === 3) ? o.max_hops : null;
  const brainClient = o.brainClient || defaultBrainClient;

  // Gate 1: max_hops must be 1, 2, or 3. Anything else (0, 4, undefined,
  // string, null) returns a degraded envelope with slice_scope defaulted to 3.
  if (max_hops === null) {
    return _degraded({ max_hops: 3, rationale: 'invalid_max_hops; expected 1|2|3' });
  }

  // Gate 2: empty active_frameworks short-circuits before any Brain contact.
  // The Cypher would match nothing anyway; the degraded envelope is honest.
  if (active_frameworks.length === 0) {
    return _degraded({ max_hops: max_hops, rationale: 'empty active_frameworks; no slice fetched' });
  }

  // Gate 3: Brain reachability check before issuing the Cypher query. The
  // live brain-client.isAvailable() is sync + cheap (an API-key resolve).
  if (typeof brainClient.isAvailable === 'function' && !brainClient.isAvailable()) {
    return _degraded({ max_hops: max_hops, rationale: 'brain_unreachable' });
  }

  // Canon Part 8 sanitization. brain-client._test.sanitizeCypherInput is the
  // shipped whitelist (Phase 110-05 D-04 invariant). Each framework name is
  // sanitized BEFORE binding; values that scrub down to empty are dropped.
  // Fallback no-op only when the seam is genuinely absent (the live
  // brain-client always exposes it; tests may stub a minimal client).
  const sanitizer = (brainClient._test && typeof brainClient._test.sanitizeCypherInput === 'function')
    ? brainClient._test.sanitizeCypherInput
    : function (s) { return s; };
  const sanitized = active_frameworks
    .filter(function (n) { return typeof n === 'string' && n.length > 0; })
    .map(function (n) { return sanitizer(n); })
    .filter(function (n) { return typeof n === 'string' && n.length > 0; });

  if (sanitized.length === 0) {
    return _degraded({
      max_hops: max_hops,
      rationale: 'all_active_frameworks_rejected_by_sanitizer',
    });
  }

  // Issue the parameterized Cypher. The ONLY $-bound values are the sanitized
  // framework name array + the max_hops integer. The Cypher string itself is
  // a frozen constant -- no template interpolation, no string concatenation
  // with caller-derived data (Canon Part 8 enforced by inspection).
  let result;
  try {
    result = await brainClient.query(FRAMEWORK_CHAIN_SLICE_CYPHER, {
      active_frameworks: sanitized,
      max_hops: max_hops,
    });
  } catch (e) {
    const msg = (e && e.message) ? String(e.message) : 'unknown';
    return _degraded({
      max_hops: max_hops,
      rationale: 'brain_query_failed: ' + msg.slice(0, 60),
    });
  }

  const rows = _unwrapRows(result);
  if (rows === null) {
    return _degraded({ max_hops: max_hops, rationale: 'brain_returned_non_array' });
  }

  // Map raw rows to the framework_chain_hint edge shape. Null-tolerant per
  // G-05: confidence and transform_description may be null on the live graph
  // and we preserve null explicitly (no defaults). hop_distance comes from
  // length(r) which is always a number when the row exists.
  // Defensive: hard-cap at 50 even though the Cypher already enforces LIMIT 50.
  const edges = rows.slice(0, 50).map(function (r) {
    return {
      from: (r && typeof r.from === 'string') ? r.from : null,
      to: (r && typeof r.to === 'string') ? r.to : null,
      confidence: (r && typeof r.confidence === 'number') ? r.confidence : null,
      transform_description: (r && typeof r.transform_description === 'string')
        ? r.transform_description
        : null,
      hop_distance: (r && typeof r.hop_distance === 'number') ? r.hop_distance : null,
    };
  });

  // brain_snapshot_id: per CONTEXT.md Open Question #4, "Brain commit_id if
  // exposed, else SHA of Cypher result." The shipped brain_query does NOT
  // expose a commit_id; we derive a deterministic content hash of the raw
  // rows so callers can detect slice changes without holding the rows
  // themselves (Plan 03 + downstream packet validator never sees them).
  const snapshotId = _sha256Hex(JSON.stringify(rows));

  return {
    edges: edges,
    slice_scope: max_hops,
    slice_rationale: 'brain_reachable; ' + edges.length + ' edges fetched; '
      + sanitized.length + ' active_frameworks; max_hops=' + max_hops,
    brain_snapshot_id: snapshotId,
    fetched_at: _nowIso(),
  };
}

module.exports = {
  fetchFrameworkChainSlice: fetchFrameworkChainSlice,
  FRAMEWORK_CHAIN_SLICE_CYPHER: FRAMEWORK_CHAIN_SLICE_CYPHER,
  // Test seam -- helpers exposed for invariant tests; not part of the
  // public API. Plan 03 (packet builder) consumes only the two above.
  _test: {
    _degraded: _degraded,
    _sha256Hex: _sha256Hex,
    _unwrapRows: _unwrapRows,
  },
};
