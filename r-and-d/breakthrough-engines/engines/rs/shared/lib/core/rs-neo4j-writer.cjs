/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.3 Plan 01 -- Aura Cypher writer for canonical RS schema.
 *
 * writeDiscovery(pair, opts) is the Tier 1 (Aura-connected) writer in the
 * dual-tier output layer. Takes a scored+classified+thesis-bearing pair
 * (from Plan 89.2-07 generateThesis output) and persists it into the user's
 * own LazyGraph Aura via idempotent MERGE Cypher.
 *
 * Schema (per kickoff section 5):
 *   Nodes: RSDiscovery + ReverseSalient + Innovation + Paper + Author + Institution
 *   Edges: DISCOVERED + DERIVED_FROM + ENABLES + AUTHORED_BY + AFFILIATED_WITH
 *
 * REAL idempotency in Aura (not mock-state tracking): the 3 core node ids
 * (discovery_id, rs_id, innovation_id) are deterministically derived via
 * sha256 over {query_concept, doc_concept, classification}, so the same
 * pair always produces the same ids and Cypher MERGE matches existing
 * nodes by id PRIMARY KEY. The aura_op_id is random per-op telemetry,
 * NOT a node identifier.
 *
 * The buildDeterministicIds helper mirrors Plan 89.3-02 (rs-sqlite-mirror)
 * byte-for-byte so the dual-tier dedup contract is consistent across
 * writers. Both backends produce the same ids for the same pair.
 *
 * Canon Part 7 (Reuse Before Build): consumes EDGE_TYPES from
 * lazygraph-ops.cjs (extended in this plan, not forked); shares
 * ExternalEgressViolation + auditQueryObject with 89.2 fetchers.
 *
 * Canon Part 8 (Graph Boundary -- defense-in-depth): even though writes
 * go to the user's OWN graph (not Brain), auditQueryObject runs over the
 * full Cypher params object BEFORE every session.run call. Catches
 * forbidden patterns smuggled through node properties OR UNWIND input
 * collections (papers / experts / paper_author_pairs). Throws
 * ExternalEgressViolation on hit.
 *
 * Tier dispatch is NOT this module's responsibility. The writer assumes
 * Aura is reachable. If the backend returns a connection error, throws
 * AuraUnreachableError (a SEPARATE class, NOT ExternalEgressViolation).
 * Caller (Plan 89.3-05 dispatch) reads this error to fall back to
 * rs-sqlite-mirror.
 *
 * Mockable backend: opts.driver is the injection point. Tests pass a mock
 * driver; production callers (Plan 89.3-05) pass the live Aura driver.
 *
 * Pure CJS, zero npm deps, node built-ins only (crypto).
 */
'use strict';

const crypto = require('crypto');
const { ExternalEgressViolation } = require('./rs-egress-violations.cjs');
const { auditQueryObject } = require('./rs-egress-prompts.cjs');
const { EDGE_TYPES } = require('./lazygraph-ops.cjs');

const SURFACE = 'rs-neo4j-writer';
const SCHEMA_VERSION = '1.0';
const REQUIRED_FIELDS = Object.freeze(['query_concept', 'doc_concept', 'classification', 'thesis']);

// 2026: bounds on the UNWIND inputs so one oversized context cannot become an
// unbounded single transaction, and a whitelist of the only fields the Cypher
// reads (so unrelated paper/expert fields such as abstracts never ride along in
// the params that are sent to the database).
const MAX_CONTEXT_ITEMS = 500;
const ID_RE = /^[a-z]+-[0-9a-f]{16}$/;

function str(v) { return typeof v === 'string' ? v : ''; }
function orcidOrNull(v) { return (typeof v === 'string' && v.length > 0) ? v : null; }
function authorKeyOf(name, orcid) { return name + '|' + (orcidOrNull(orcid) || '__no_orcid__'); }

function sanitizePapers(papers) {
  const out = [];
  for (const p of papers) {
    if (!p || typeof p !== 'object' || typeof p.id !== 'string' || p.id.length === 0) continue;
    out.push({ id: p.id, title: str(p.title), doi: str(p.doi), source: str(p.source), authors: Array.isArray(p.authors) ? p.authors : [] });
    if (out.length >= MAX_CONTEXT_ITEMS) break;
  }
  return out;
}

function sanitizeExperts(experts) {
  const out = [];
  for (const e of experts) {
    if (!e || typeof e !== 'object' || typeof e.name !== 'string' || e.name.length === 0) continue;
    out.push({
      name: e.name,
      orcid: orcidOrNull(e.orcid),
      h_index_estimate: (typeof e.h_index_estimate === 'number' && Number.isFinite(e.h_index_estimate)) ? e.h_index_estimate : 0,
      institution: (typeof e.institution === 'string' && e.institution.length > 0) ? e.institution : null,
    });
    if (out.length >= MAX_CONTEXT_ITEMS) break;
  }
  return out;
}

// ---------- AuraUnreachableError ----------
//
// Tier-dispatch signal (NOT a security violation). Caller catches this and
// falls back to rs-sqlite-mirror (Tier 0). Distinct from ExternalEgressViolation
// so the two error classes never get conflated in stack traces or audit logs.

class AuraUnreachableError extends Error {
  constructor(message, meta) {
    super(message);
    this.name = 'AuraUnreachableError';
    this.meta = meta || {};
  }
}

// ---------- buildDeterministicIds ----------
//
// The dedup contract shared with Plan 89.3-02 (rs-sqlite-mirror). The
// implementation MUST be byte-identical across both writers so the same
// pair produces the same 3 core ids regardless of which tier is active.
//
// stableKey is JSON.stringify of {q, d, c} (in fixed key order so the
// resulting bytes are stable across Node versions). sha256 then hex-slice
// the first 16 chars gives a 64-bit collision space (sufficient for
// per-room discovery counts; collision probability negligible).

function buildDeterministicIds(pair) {
  const stableKey = JSON.stringify({
    q: pair.query_concept,
    d: pair.doc_concept,
    c: pair.classification,
  });
  const hash = crypto.createHash('sha256').update(stableKey).digest('hex').slice(0, 16);
  return {
    discovery_id: 'rsd-' + hash,
    rs_id: 'rs-' + hash,
    innovation_id: 'inn-' + hash,
  };
}

// ---------- generateOpId ----------
//
// Random per-op telemetry id (NOT a node id). Caller may journal this for
// rollback bookkeeping. The id is intentionally non-deterministic so two
// re-runs of the same pair produce DIFFERENT op ids (proving the call
// happened twice even though the underlying nodes were MERGE-matched).

function generateOpId() {
  return 'op-' + new Date().toISOString().slice(0, 10) + '-' + crypto.randomUUID();
}

// ---------- validateRequiredFields ----------
//
// Shape gate. Runs BEFORE audit + driver call. Throws TypeError naming the
// missing field so callers can surface a precise error to the user.

function validateRequiredFields(pair) {
  if (!pair || typeof pair !== 'object') {
    throw new TypeError(SURFACE + ': pair must be an object');
  }
  for (const f of REQUIRED_FIELDS) {
    if (typeof pair[f] !== 'string' || pair[f].length === 0) {
      throw new TypeError(SURFACE + ': missing required field: ' + f);
    }
  }
}

// ---------- buildCypherParams ----------
//
// Assemble the params object passed to session.run. Includes all node
// properties (RSDiscovery + ReverseSalient + Innovation core; Paper +
// Author + Institution conditional on opts.context).
//
// CRITICAL: paper_author_pairs is constructed from
//   ctx.papers.flatMap(p => (p.authors || []).map(a => ({
//     paper_id: p.id,
//     author_key: a.name + '|' + (a.orcid || '__no_orcid__')
//   })))
// so the AUTHORED_BY UNWIND has ready-to-MATCH tuples. The author_key
// shape mirrors the Author MERGE key (name + '|' + orcid-or-sentinel)
// so MATCH succeeds without a JOIN.
//
// paper_author_pairs is ALWAYS present (possibly []) so the Cypher does
// not need an IF guard around the UNWIND.

function buildCypherParams(pair, ctx, ids) {
  const breakthrough = pair.breakthrough || {};
  const breakdown = breakthrough.breakdown || {};
  const created_at = new Date().toISOString();

  const papersAll = sanitizePapers(Array.isArray(ctx.papers) ? ctx.papers : []);
  const experts = sanitizeExperts(Array.isArray(ctx.experts) ? ctx.experts : []);

  // 2026: an author key must use the same normalisation as the Author MERGE key
  // (empty-string orcid counts as missing). The previous '' orcid produced
  // 'Name|' for the pair but 'Name|' + coalesce('', ...) = 'Name|' in Cypher
  // versus 'Name|__no_orcid__' here, so the AUTHORED_BY MATCH silently found
  // nothing. Authors without a name are skipped.
  const paper_author_pairs = [];
  for (const p of papersAll) {
    for (const a of p.authors) {
      if (!a || typeof a.name !== 'string' || a.name.length === 0) continue;
      paper_author_pairs.push({ paper_id: p.id, author_key: authorKeyOf(a.name, a.orcid) });
      if (paper_author_pairs.length >= MAX_CONTEXT_ITEMS * 10) break;
    }
  }
  const papers = papersAll.map(function (p) { return { id: p.id, title: p.title, doi: p.doi, source: p.source }; });

  return {
    // Core RS node ids (deterministic).
    discovery_id: ids.discovery_id,
    rs_id: ids.rs_id,
    innovation_id: ids.innovation_id,
    // RSDiscovery properties.
    classification: pair.classification,
    breakthrough_score: typeof breakthrough.score === 'number' ? breakthrough.score : 0,
    dominant_dimension: typeof breakthrough.dominant_dimension === 'string' ? breakthrough.dominant_dimension : '',
    thesis: pair.thesis,
    bridge_concept: typeof pair.bridge_concept === 'string' ? pair.bridge_concept : '',
    diff: typeof pair.diff === 'number' ? pair.diff : 0,
    lsa: typeof pair.lsa === 'number' ? pair.lsa : 0,
    bert: typeof pair.bert === 'number' ? pair.bert : 0,
    feasibility: typeof breakdown.feasibility === 'number' ? breakdown.feasibility : 0,
    market: typeof breakdown.market === 'number' ? breakdown.market : 0,
    magnitude: typeof breakdown.magnitude === 'number' ? breakdown.magnitude : 0,
    advantage: typeof breakdown.advantage === 'number' ? breakdown.advantage : 0,
    impact: typeof breakdown.impact === 'number' ? breakdown.impact : 0,
    created_at: created_at,
    // ReverseSalient properties.
    query_concept: pair.query_concept,
    doc_concept: pair.doc_concept,
    // Context UNWIND inputs (always present; may be empty arrays).
    papers: papers,
    experts: experts,
    paper_author_pairs: paper_author_pairs,
    // Optional context metadata.
    room_id: typeof ctx.room_id === 'string' ? ctx.room_id : '',
    domain: typeof ctx.domain === 'string' ? ctx.domain : '',
  };
}

// ---------- buildMergeCypher ----------
//
// Returns one of two pre-built Cypher strings: core-only when no context,
// core+context when papers/experts present. Both use MERGE for
// idempotency. The core+context version includes the AUTHORED_BY UNWIND
// over $paper_author_pairs.
//
// Cypher style: MERGE primary keys explicitly per node so re-runs match
// existing nodes by PRIMARY KEY (discovery_id, rs_id, innovation_id are
// deterministic; paper.id is from external source; author name_orcid_key
// composite handles the missing-orcid case via __no_orcid__ sentinel;
// institution.name is the natural key).

const CORE_CYPHER = [
  'MERGE (d:RSDiscovery {id: $discovery_id})',
  '  SET d.classification = $classification,',
  '      d.breakthrough_score = $breakthrough_score,',
  '      d.dominant_dimension = $dominant_dimension,',
  '      d.thesis = $thesis,',
  '      d.bridge_concept = $bridge_concept,',
  '      d.diff = $diff,',
  '      d.lsa = $lsa,',
  '      d.bert = $bert,',
  '      d.feasibility = $feasibility,',
  '      d.market = $market,',
  '      d.magnitude = $magnitude,',
  '      d.advantage = $advantage,',
  '      d.impact = $impact,',
  '      d.room_id = $room_id,',
  '      d.domain = $domain,',
  '      d.created_at = $created_at',
  'MERGE (rs:ReverseSalient {id: $rs_id})',
  '  SET rs.query_concept = $query_concept,',
  '      rs.doc_concept = $doc_concept,',
  '      rs.classification = $classification',
  'MERGE (i:Innovation {id: $innovation_id})',
  '  SET i.thesis = $thesis,',
  '      i.breakthrough_score = $breakthrough_score',
  'MERGE (d)-[:DISCOVERED]->(rs)',
  'MERGE (rs)-[:DERIVED_FROM]->(i)',
  'MERGE (d)-[:ENABLES]->(i)',
].join('\n');

// 2026: the previous context statement chained  UNWIND $papers ... WITH d
// UNWIND $experts ... WITH 1 AS _step UNWIND $paper_author_pairs  at the top
// level. UNWIND of an empty list yields ZERO rows, so with no papers nothing
// after it ran (experts were never written), with no expert carrying an
// institution the AUTHORED_BY edges were never written, and every stage
// multiplied the row count of the next. Each stage is now an independent
// aggregating CALL subquery (always exactly one row back), so an empty or
// partial context can no longer suppress the other stages.
const CONTEXT_CYPHER = [
  CORE_CYPHER,
  '',
  '// Paper nodes (UNWIND $papers)',
  'WITH d',
  'CALL {',
  '  WITH d',
  '  UNWIND $papers AS p',
  '  MERGE (paper:Paper {id: p.id})',
  '    SET paper.title = p.title,',
  '        paper.doi = p.doi,',
  '        paper.source = p.source',
  '  MERGE (d)-[:DERIVED_FROM]->(paper)',
  '  RETURN count(*) AS _papers',
  '}',
  '',
  '// Author + Institution nodes (UNWIND $experts)',
  'CALL {',
  '  UNWIND $experts AS e',
  '  MERGE (a:Author {name_orcid_key: e.name + \'|\' + coalesce(e.orcid, \'__no_orcid__\')})',
  '    SET a.name = e.name,',
  '        a.orcid = e.orcid,',
  '        a.h_index_estimate = e.h_index_estimate',
  '  WITH a, e',
  '  WHERE e.institution IS NOT NULL',
  '  MERGE (inst:Institution {name: e.institution})',
  '  MERGE (a)-[:AFFILIATED_WITH]->(inst)',
  '  RETURN count(*) AS _experts',
  '}',
  '',
  '// AUTHORED_BY edges (UNWIND $paper_author_pairs)',
  'CALL {',
  '  UNWIND $paper_author_pairs AS pa',
  '  MATCH (paper:Paper {id: pa.paper_id})',
  '  MATCH (author:Author {name_orcid_key: pa.author_key})',
  '  MERGE (paper)-[:AUTHORED_BY]->(author)',
  '  RETURN count(*) AS _pairs',
  '}',
  'RETURN d.id AS discovery_id',
].join('\n');

function buildMergeCypher(hasContext) {
  return hasContext ? CONTEXT_CYPHER : CORE_CYPHER;
}

// ---------- buildRollbackCypher ----------
//
// Inverse DELETE for the 3 core nodes only. Shared Paper/Author/Institution
// nodes are NOT torn down by rollback because they may be referenced by
// other RSDiscoveries; only the RS-specific nodes are removed. DETACH
// ensures all incident edges are removed atomically with each node.
//
// Returned as a multi-statement string (caller can split on ';' or pass
// to driver.session().run as separate statements). Format mirrors the
// schema exactly so callers can journal verbatim for manual rollback.

function buildRollbackCypher(ids) {
  // 2026: the original emitted `DETACH DELETE (d:RSDiscovery {id: "..."});`,
  // which is not valid Cypher (DETACH DELETE needs a bound variable from a
  // MATCH), so the journalled rollback could never run. Statements are now
  // MATCH ... DETACH DELETE. ids are sha256-derived hex built by
  // buildDeterministicIds; anything else is refused rather than interpolated,
  // so no caller-supplied text can ever reach this string.
  for (const k of ['discovery_id', 'rs_id', 'innovation_id']) {
    if (typeof ids[k] !== 'string' || !ID_RE.test(ids[k])) {
      throw new TypeError(SURFACE + ': refusing to build rollback for non-derived id: ' + k);
    }
  }
  return [
    "MATCH (d:RSDiscovery {id: '" + ids.discovery_id + "'}) DETACH DELETE d;",
    "MATCH (rs:ReverseSalient {id: '" + ids.rs_id + "'}) DETACH DELETE rs;",
    "MATCH (i:Innovation {id: '" + ids.innovation_id + "'}) DETACH DELETE i;",
  ].join('\n');
}

// ---------- writeDiscovery ----------
//
// The public entry point. Orchestration:
//   1. Validate pair shape (throws TypeError on missing required field)
//   2. Validate opts.driver presence (throws TypeError if absent)
//   3. Build deterministic ids (sha256-derived)
//   4. Build Cypher params (includes paper_author_pairs always)
//   5. Run auditQueryObject pre-write (Canon Part 8 defense-in-depth;
//      throws ExternalEgressViolation on FORBIDDEN_PATTERNS hit; covers
//      UNWIND inputs via JSON.stringify walk)
//   6. Build Cypher (core OR core+context)
//   7. session.run(cypher, params); catch ConnectionError; throw
//      AuraUnreachableError on backend failure (clean tier-dispatch signal)
//   8. Return {wrote_node_count, wrote_edge_count, rollback_cypher,
//      aura_op_id, schema_version}

async function writeDiscovery(pair, opts) {
  opts = opts || {};
  validateRequiredFields(pair);

  if (!opts.driver || typeof opts.driver.session !== 'function') {
    throw new TypeError(SURFACE + ': opts.driver required (call rs-output-dispatch from Plan 89.3-05 if you need tier auto-resolution)');
  }

  const ids = buildDeterministicIds(pair);
  const ctx = (opts.context && typeof opts.context === 'object') ? opts.context : {};
  const params = buildCypherParams(pair, ctx, ids);

  // Canon Part 8 defense-in-depth: audit BEFORE Cypher execution. Covers
  // UNWIND inputs ($experts, $papers, $paper_author_pairs) via the
  // JSON.stringify walk in auditQueryObject.
  auditQueryObject(params, SURFACE);

  const hasContext = params.papers.length > 0 || params.experts.length > 0;
  const cypher = buildMergeCypher(hasContext);

  const session = opts.driver.session();
  let result;
  try {
    result = await session.run(cypher, params);
  } catch (err) {
    if (err instanceof ExternalEgressViolation) {
      // Bubble up unchanged.
      throw err;
    }
    // 2026: every driver error used to be reported as "unreachable", so a
    // Cypher syntax/constraint error made the dispatcher silently fall back to
    // the SQLite tier and hide the bug. The class is unchanged (callers keep
    // catching it); meta.kind / meta.code now say which it was.
    const code = err && typeof err.code === 'string' ? err.code : null;
    const isClientError = !!code && code.indexOf('Neo.ClientError') === 0;
    throw new AuraUnreachableError(
      (isClientError ? 'Aura rejected the query: ' : 'Aura backend unreachable: ')
        + (err && err.message ? err.message : String(err)),
      {
        original: err && err.message ? err.message : String(err),
        kind: isClientError ? 'query_error' : 'connection',
        code: code,
      }
    );
  } finally {
    if (session && typeof session.close === 'function') {
      try {
        await session.close();
      } catch (_e) { /* best effort */ }
    }
  }

  const counters = (result && result.summary && result.summary.counters) || {};
  return {
    wrote_node_count: typeof counters.nodesCreated === 'number' ? counters.nodesCreated : 0,
    wrote_edge_count: typeof counters.relationshipsCreated === 'number' ? counters.relationshipsCreated : 0,
    rollback_cypher: buildRollbackCypher(ids),
    aura_op_id: generateOpId(),
    schema_version: SCHEMA_VERSION,
  };
}

// ---------- Edge type registry consumption ----------
//
// Defensive guard: refuse to load if the EDGE_TYPES extension Plan 89.3-01
// Task 1 shipped is missing. This guarantees the writer cannot ship
// against a stale lazygraph-ops.cjs. Non-throwing in production (warn on
// stderr) so the writer remains usable while the upstream is fixed; in
// tests this can be tightened to throw if desired.

const REQUIRED_EDGE_TYPES = ['DISCOVERED', 'DERIVED_FROM', 'ENABLES', 'AUTHORED_BY', 'AFFILIATED_WITH'];
for (const t of REQUIRED_EDGE_TYPES) {
  if (!EDGE_TYPES.includes(t)) {
    process.stderr.write(SURFACE + ': WARNING -- EDGE_TYPES missing required type: ' + t + '\n');
  }
}

// ---------- Exports ----------

module.exports = {
  writeDiscovery,
  AuraUnreachableError,
  SCHEMA_VERSION,
  REQUIRED_FIELDS,
  _test: {
    buildDeterministicIds,
    generateOpId,
    buildCypherParams,
    buildMergeCypher,
    buildRollbackCypher,
    validateRequiredFields,
    sanitizePapers,
    sanitizeExperts,
    CORE_CYPHER,
    CONTEXT_CYPHER,
  },
};
