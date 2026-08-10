'use strict';
// Phase 125-02 -- Brain framework-chain slice (FEEDS_INTO 1-3 hops).
// CONTEXT.md Scope IN section B item 4.
//
// Repointed (BUG 2 fix) from the admin-gated brain_query / raw-Cypher path
// onto the curated brain.askOp('framework_chain_slice', { seeds, max_hops })
// surface so any valid API key can call it.
//
// Contract (from .planning/brain-curated-ops-contract.md):
//   brain.askOp('framework_chain_slice', { seeds: string[], max_hops?: 1|2|3 })
//   -> { op, source, count, rows: Array<{from, to, hop_distance}>, degraded? }
//
// INTEGRATOR NOTE -- partial substitute:
//   The old Cypher returned `confidence` and `transform_description` per edge.
//   The curated op returns ONLY `from`, `to`, `hop_distance` (no confidence,
//   no transform_description). Downstream consumers that used those fields will
//   receive `null` after this change. Flag logged in fetchFrameworkChainSlice
//   return envelope as `confidence_omitted: true` so callers can detect this.
//   A future curated-op extension could re-expose the fields if needed.
//
// Canon Part 8: seeds are generic framework-name strings (allow-listed by
// the server); max_hops is a clamped integer 1-3. No user content crosses the
// wire. The curated op enforces this server-side; no caller Cypher ever.
//
// Graceful degradation: any failure path (Brain unreachable, askOp throws,
// invalid max_hops, empty seeds, non-array result, degraded envelope) returns
// a degraded result envelope rather than throwing. Tier 0 stays functional.
//
// BACKWARD-COMPAT SURFACE: the module still exports FRAMEWORK_CHAIN_SLICE_CYPHER
// as an empty string so existing test-seam checks that assert on the exported
// constant do not break (tests/brain-cypher-chain-slice.test.cjs Test 2 checks
// that the CYPHER includes 'LIMIT 50' and 'FEEDS_INTO*1..$max_hops'; those
// tests will need updating now that the Cypher is server-side). The constant is
// deprecated; callers should NOT use it.

const crypto = require('node:crypto');
const defaultBrainClient = require('../core/brain-client.cjs');

// DEPRECATED: the Cypher is now frozen server-side inside the curated op.
// Retained as an empty string to avoid hard breaking any import that
// destructures this export. Tests that assert on its content should be
// updated to reflect the curated-op architecture.
const FRAMEWORK_CHAIN_SLICE_CYPHER = '';

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
 * Fetch a 1-3 hop FEEDS_INTO slice from the live Brain via the curated
 * askOp surface (D-MOAT-1-safe; no admin gate required).
 *
 * @param {object} opts
 * @param {string[]} opts.active_frameworks - Array of framework name strings
 *   used as seeds. Empty array short-circuits to a degraded envelope.
 * @param {1|2|3} opts.max_hops - Hop depth (must be exactly 1, 2, or 3).
 *   Any other value short-circuits to a degraded envelope.
 * @param {object} [opts.brainClient] - Test seam; defaults to live brain-client.
 * @param {string} [opts.roomDir] - Phase 249-01 (ENRICH-01): when set, each
 *   sanitized seed gets an orchestrationReadiness piggyback probe in this
 *   same async drain pass so a 0-2/4 miss is captured to the enrichment
 *   queue. Absent: zero probes fire (unchanged pre-249 behavior).
 * @returns {Promise<{
 *   edges: Array<{from:string|null, to:string|null, confidence:null,
 *                 transform_description:null, hop_distance:number|null}>,
 *   slice_scope: 1|2|3,
 *   slice_rationale: string,
 *   brain_snapshot_id: string|null,
 *   fetched_at: string,
 *   confidence_omitted: true
 * }>}
 *
 * INTEGRATOR NOTE: confidence + transform_description are always null after
 * this repoint. The curated op returns only { from, to, hop_distance }.
 * `confidence_omitted: true` is set in every returned envelope so callers
 * can detect the reduction and adapt accordingly.
 */
async function fetchFrameworkChainSlice(opts) {
  const o = opts || {};
  const active_frameworks = Array.isArray(o.active_frameworks) ? o.active_frameworks : [];
  const max_hops = (o.max_hops === 1 || o.max_hops === 2 || o.max_hops === 3) ? o.max_hops : null;
  const brainClient = o.brainClient || defaultBrainClient;

  // Gate 1: max_hops must be 1, 2, or 3.
  if (max_hops === null) {
    return Object.assign(_degraded({ max_hops: 3, rationale: 'invalid_max_hops; expected 1|2|3' }), { confidence_omitted: true });
  }

  // Gate 2: empty active_frameworks short-circuits before any Brain contact.
  if (active_frameworks.length === 0) {
    return Object.assign(_degraded({ max_hops: max_hops, rationale: 'empty active_frameworks; no slice fetched' }), { confidence_omitted: true });
  }

  // Gate 3: Brain reachability check.
  if (typeof brainClient.isAvailable === 'function' && !brainClient.isAvailable()) {
    // Phase 252-01 (SWEEP-01, CONFORM): align with the refusal-kind
    // vocabulary via an ADDITIVE `refusal` field. `slice_rationale`'s
    // literal value ('brain_unreachable') stays byte-locked -- it is
    // asserted verbatim by lib/memory/brain-cypher-chain-slice.test.cjs and
    // lib/memory/packet-chain-hint.test.cjs, both outside this task's file
    // scope. The gate actually checks isAvailable() (key resolution), which
    // maps to the rail's 'no_key' kind, not 'unreachable' (AVAIL-02's
    // post-retry transient-transport kind) -- the `refusal` field carries
    // the semantically correct kind even though the legacy rationale string
    // does not.
    let refusal;
    try {
      refusal = require('../core/refusal-messaging.cjs').refusalResponse('no_key', { tool: 'framework_chain_slice' });
    } catch (_e) { refusal = null; }
    return Object.assign(_degraded({ max_hops: max_hops, rationale: 'brain_unreachable' }), { confidence_omitted: true, refusal: refusal });
  }

  // Gate 4: askOp must be available on the client. The live brain-client
  // gains askOp in the parallel BUG 2 build; tests may stub it. If the
  // method is absent we fall back to the degraded path cleanly.
  if (typeof brainClient.askOp !== 'function') {
    return Object.assign(_degraded({ max_hops: max_hops, rationale: 'askOp_not_available_on_client' }), { confidence_omitted: true });
  }

  // Sanitize seed names before passing to askOp. The server also enforces
  // the allow-list but we sanitize client-side as defence-in-depth.
  // Canon Part 8 invariant preserved.
  const sanitizer = (brainClient._test && typeof brainClient._test.sanitizeCypherInput === 'function')
    ? brainClient._test.sanitizeCypherInput
    : function (s) { return s; };
  const sanitized = active_frameworks
    .filter(function (n) { return typeof n === 'string' && n.length > 0; })
    .map(function (n) { return sanitizer(n); })
    .filter(function (n) { return typeof n === 'string' && n.length > 0; });

  if (sanitized.length === 0) {
    return Object.assign(_degraded({
      max_hops: max_hops,
      rationale: 'all_active_frameworks_rejected_by_sanitizer',
    }), { confidence_omitted: true });
  }

  // Issue the curated op. `seeds` is the param name per the contract;
  // `max_hops` is passed through as-is (server clamps to [1,3]).
  let opResult;
  try {
    opResult = await brainClient.askOp('framework_chain_slice', {
      seeds: sanitized,
      max_hops: max_hops,
    });
  } catch (e) {
    const msg = (e && e.message) ? String(e.message) : 'unknown';
    return Object.assign(_degraded({
      max_hops: max_hops,
      rationale: 'brain_query_failed: ' + msg.slice(0, 60),
    }), { confidence_omitted: true });
  }

  // Degraded envelope from server.
  if (!opResult || opResult.degraded) {
    return Object.assign(_degraded({ max_hops: max_hops, rationale: 'brain_returned_degraded' }), { confidence_omitted: true });
  }

  const rows = Array.isArray(opResult.rows) ? opResult.rows : null;
  if (rows === null) {
    return Object.assign(_degraded({ max_hops: max_hops, rationale: 'brain_returned_non_array' }), { confidence_omitted: true });
  }

  // Map curated op rows { from, to, hop_distance } to the edge shape.
  // confidence and transform_description are NOT in the curated op response;
  // they are set to null explicitly and flagged via confidence_omitted.
  const edges = rows.slice(0, 50).map(function (r) {
    return {
      from: (r && typeof r.from === 'string') ? r.from : null,
      to: (r && typeof r.to === 'string') ? r.to : null,
      confidence: null,              // not provided by curated op
      transform_description: null,  // not provided by curated op
      hop_distance: (r && typeof r.hop_distance === 'number') ? r.hop_distance : null,
    };
  });

  // Phase 249-01 (ENRICH-01) -- derivation-drain piggyback. Past Gate 4 (a
  // successful askOp slice), when o.roomDir is a non-empty string AND the
  // client exposes orchestrationReadiness, probe each SANITIZED seed
  // sequentially so a live "framework seeds crossed the wire" reach also
  // captures any 0-2/4 miss in the SAME async drain pass -- already async by
  // construction (Phase 245 constraint honored for free). The whole block is
  // wrapped so no probe failure (throw, rejection, degraded sentinel) ever
  // alters the slice envelope this function returns.
  if (typeof o.roomDir === 'string' && o.roomDir.length > 0
      && typeof brainClient.orchestrationReadiness === 'function') {
    for (const seed of sanitized) {
      try {
        await brainClient.orchestrationReadiness(seed, {
          roomDir: o.roomDir,
          contextClass: { reach_id: 'brain_consult' },
        });
      } catch (_e) {
        // Never let a probe failure degrade the slice result.
      }
    }
  }

  // Deterministic content hash for cache invalidation (content-addressed
  // snapshot -- same rationale as the original implementation).
  const snapshotId = _sha256Hex(JSON.stringify(rows));

  return {
    edges: edges,
    slice_scope: max_hops,
    slice_rationale: 'brain_reachable; ' + edges.length + ' edges fetched; '
      + sanitized.length + ' seeds; max_hops=' + max_hops,
    brain_snapshot_id: snapshotId,
    fetched_at: _nowIso(),
    confidence_omitted: true,
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
