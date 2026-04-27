/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.3 Plan 04 -- expert mapper Cypher resolver.
 *
 * mapAuthorsToAura(experts, opts) is the Cypher MATCH-then-MERGE-and-resolve
 * module that takes Plan 89.2-05 mapExperts output and resolves authors,
 * institutions, and citation edges in the user's own Aura.
 *
 * Tier 1 (Aura connected): full Cypher resolution. For each expert: MATCH
 * existing Author by composite name+orcid key; if not found, MERGE a new
 * Author + Institution + AFFILIATED_WITH edge. Then run a CO_AUTHORED
 * multi-hop query to populate citation_edges from any pair of authors
 * sharing a Paper in the user's Aura.
 *
 * Tier 0 (no Aura) graceful degradation: per CONTEXT.md "Claude's Discretion
 * path 3" decision, return partial data from rs-sqlite-mirror's Author +
 * Institution rows in room.db with resolution_quality='degraded' AND a
 * friendly note. This is more useful to the caller than an empty array.
 *
 * Output shape:
 *   {
 *     resolved_authors: [{name, orcid, institution, h_index_estimate,
 *                         paper_count, aura_node_id?}],
 *     resolved_institutions: [{name, author_count, aura_node_id?}],
 *     citation_edges: [{source_author, target_author, paper_id,
 *                       type: 'CO_AUTHORED' | 'CITED'}],
 *     missed_count: N,
 *     resolution_quality: 'full' | 'degraded',
 *     tier: 'aura' | 'sqlite',
 *     schema_version: '1.0',
 *     note?: string  // present when degraded; absent when full
 *   }
 *
 * Canon Part 7 (Reuse Before Build):
 *   - Reuses lazygraph.openGraph + closeGraph for Tier 0 reads (no new
 *     SQLite wrapper)
 *   - Reuses AuraUnreachableError from Plan 89.3-01 rs-neo4j-writer (re-throws
 *     on backend failure -- clean tier-dispatch signal for Plan 89.3-05)
 *   - Reuses ExternalEgressViolation + auditQueryObject from 89.2 chokepoints
 *   - Author MERGE pattern mirrors rs-neo4j-writer.cjs (composite
 *     name_orcid_key with __no_orcid__ sentinel)
 *
 * Canon Part 8 (Graph Boundary -- defense-in-depth) at TWO seams:
 *   - Layer 1 (pre-Cypher): auditQueryObject(cypher_params, 'rs-expert-mapper')
 *     runs BEFORE every session.run call. Catches forbidden patterns in
 *     expert.name, expert.orcid, expert.institution. Throws
 *     ExternalEgressViolation; session.run NEVER runs.
 *   - Layer 2 (pre-return): auditQueryObject(result, 'rs-expert-mapper-output')
 *     runs BEFORE returning to catch any forbidden patterns that smuggled
 *     through. Conservative because the resolved_authors array flows
 *     downstream into Plan 89.3-03 mind-map rendering AND any future
 *     expert-network UI.
 *
 * Tier dispatch is opt-in (caller passes opts.tier explicitly OR auto-detect
 * from opts.driver vs opts.roomDir). Throws TypeError if neither.
 *
 * Pure CJS, zero npm deps, node built-ins only.
 */
'use strict';

const { ExternalEgressViolation } = require('./rs-egress-violations.cjs');
const { auditQueryObject } = require('./rs-egress-prompts.cjs');
const { AuraUnreachableError } = require('./rs-neo4j-writer.cjs');
const lazygraph = require('./lazygraph-ops.cjs');

const SURFACE_PRE = 'rs-expert-mapper';
const SURFACE_POST = 'rs-expert-mapper-output';
const SCHEMA_VERSION = '1.0';
const DEGRADED_NOTE = 'Expert resolution from local SQLite mirror only. Connect LazyGraph Aura for full multi-hop citation graph.';

// ---------- buildAuthorKey ----------
//
// Composite key mirrors Plan 89.2-05 mapExperts AND Plan 89.3-01
// rs-neo4j-writer (name_orcid_key in Cypher MERGE). __no_orcid__ sentinel
// disambiguates authors who lack ORCID by name alone.

function buildAuthorKey(expert) {
  const name = (expert && typeof expert.name === 'string') ? expert.name : '';
  const orcid = (expert && typeof expert.orcid === 'string' && expert.orcid.length > 0) ? expert.orcid : '__no_orcid__';
  return name + '|' + orcid;
}

// ---------- buildCypherParamsForExpert ----------
//
// Per-expert params object passed to session.run for MATCH/MERGE. The audit
// surface (Layer 1) JSON.stringify-walks this object.

function buildCypherParamsForExpert(expert) {
  return {
    key: buildAuthorKey(expert),
    name: typeof expert.name === 'string' ? expert.name : '',
    orcid: typeof expert.orcid === 'string' ? expert.orcid : null,
    institution: typeof expert.institution === 'string' ? expert.institution : null,
    h_index_estimate: typeof expert.h_index_estimate === 'number' ? expert.h_index_estimate : 0,
  };
}

// ---------- detectTier ----------
//
// Tier dispatch surface: caller passes opts.tier explicitly OR auto-detect
// from opts.driver (aura) vs opts.roomDir (sqlite). Throws TypeError if
// neither, so the caller surfaces a precise error to the user.

async function detectTier(opts) {
  if (opts && (opts.tier === 'aura' || opts.tier === 'sqlite')) return opts.tier;
  if (opts && opts.driver && typeof opts.driver.session === 'function') return 'aura';
  if (opts && typeof opts.roomDir === 'string' && opts.roomDir.length > 0) return 'sqlite';
  throw new TypeError(SURFACE_PRE + ': opts.tier OR opts.driver OR opts.roomDir required');
}

// ---------- Cypher templates ----------

const MATCH_AUTHOR_CYPHER = [
  'MATCH (a:Author {name_orcid_key: $key})',
  'RETURN a.name AS name, a.orcid AS orcid, id(a) AS aura_node_id',
].join('\n');

const MERGE_AUTHOR_CYPHER = [
  'MERGE (a:Author {name_orcid_key: $key})',
  '  SET a.name = $name,',
  '      a.orcid = $orcid,',
  '      a.h_index_estimate = $h_index_estimate',
  'WITH a',
  'WHERE $institution IS NOT NULL',
  '  MERGE (inst:Institution {name: $institution})',
  '  MERGE (a)-[:AFFILIATED_WITH]->(inst)',
  'RETURN a.name AS name, id(a) AS aura_node_id',
].join('\n');

const CO_AUTHORED_CYPHER = [
  'MATCH (a1:Author)-[:AUTHORED_BY]-(p:Paper)-[:AUTHORED_BY]-(a2:Author)',
  'WHERE id(a1) < id(a2)',
  'RETURN a1.name AS source_author, a2.name AS target_author, p.id AS paper_id',
].join('\n');

// ---------- resolveAuraExpert ----------
//
// Per-expert Aura resolver: MATCH first; if 0 rows, MERGE. Returns the
// per-expert resolution record.
// {name, orcid, institution, h_index_estimate, paper_count, aura_node_id?,
//  matched, merged, missed}

async function resolveAuraExpert(expert, driver) {
  const params = buildCypherParamsForExpert(expert);
  const session = driver.session();
  let matched = false;
  let merged = false;
  let missed = false;
  let aura_node_id;
  try {
    const matchResult = await session.run(MATCH_AUTHOR_CYPHER, params);
    const records = (matchResult && Array.isArray(matchResult.records)) ? matchResult.records : [];
    if (records.length > 0) {
      matched = true;
      const r = records[0];
      const id = (typeof r.get === 'function') ? r.get('aura_node_id') : null;
      if (id !== undefined && id !== null) aura_node_id = id;
    } else {
      // Unmatched: try MERGE.
      try {
        const mergeResult = await session.run(MERGE_AUTHOR_CYPHER, params);
        const mRecords = (mergeResult && Array.isArray(mergeResult.records)) ? mergeResult.records : [];
        if (mRecords.length > 0) {
          merged = true;
          const r = mRecords[0];
          const id = (typeof r.get === 'function') ? r.get('aura_node_id') : null;
          if (id !== undefined && id !== null) aura_node_id = id;
        } else {
          missed = true;
        }
      } catch (mergeErr) {
        // MERGE failure (e.g. constraint violation) -> count as missed,
        // do NOT propagate (this is per-expert resilience). However, if
        // the error is a connection-level failure, surface it so the
        // outer try/catch can convert to AuraUnreachableError.
        if (/ECONNREFUSED|ETIMEDOUT|ECONNRESET|connect\s+E/i.test(mergeErr.message || '')) {
          throw mergeErr;
        }
        missed = true;
      }
    }
  } finally {
    if (session && typeof session.close === 'function') {
      try {
        await session.close();
      } catch (_e) { /* best effort */ }
    }
  }
  return {
    name: expert.name,
    orcid: expert.orcid || null,
    institution: expert.institution || null,
    h_index_estimate: typeof expert.h_index_estimate === 'number' ? expert.h_index_estimate : 0,
    paper_count: typeof expert.paper_count === 'number' ? expert.paper_count : 0,
    aura_node_id: aura_node_id,
    matched: matched,
    merged: merged,
    missed: missed,
  };
}

// ---------- fetchAuraCitationEdges ----------
//
// Multi-hop CO_AUTHORED query against the user's Aura. Returns an array of
// {source_author, target_author, paper_id, type: 'CO_AUTHORED'} records.
// Best-effort -- if the query returns zero rows (e.g. no Paper nodes carry
// AUTHORED_BY edges yet), the array is empty.

async function fetchAuraCitationEdges(driver) {
  const session = driver.session();
  try {
    const result = await session.run(CO_AUTHORED_CYPHER, {});
    const records = (result && Array.isArray(result.records)) ? result.records : [];
    const edges = [];
    for (const r of records) {
      if (typeof r.get !== 'function') continue;
      edges.push({
        source_author: r.get('source_author'),
        target_author: r.get('target_author'),
        paper_id: r.get('paper_id'),
        type: 'CO_AUTHORED',
      });
    }
    return edges;
  } finally {
    if (session && typeof session.close === 'function') {
      try {
        await session.close();
      } catch (_e) { /* best effort */ }
    }
  }
}

// ---------- resolveSqliteExperts ----------
//
// Tier 0 path: open the user's room.db via lazygraph.openGraph (Canon Part 7
// reuse), SELECT all Author + Institution rows, walk the experts[] input,
// match by composite key. Build citation_edges best-effort from
// AUTHORED_BY edges (any pair sharing a Paper).
//
// Returns {resolved, missed, citation_edges, resolved_institutions}.

async function resolveSqliteExperts(experts, roomDir) {
  const handle = await lazygraph.openGraph(roomDir);
  try {
    // SELECT all Author rows (id is the composite key).
    const authorRows = handle.conn.prepare("SELECT id, properties FROM nodes WHERE type = 'Author'").all();
    const authorIdSet = new Set(authorRows.map(function (r) { return r.id; }));

    // Walk experts[]; match by composite key.
    const resolved = [];
    let missed = 0;
    for (const e of experts) {
      const key = buildAuthorKey(e);
      if (authorIdSet.has(key)) {
        resolved.push({
          name: e.name,
          orcid: e.orcid || null,
          institution: e.institution || null,
          h_index_estimate: typeof e.h_index_estimate === 'number' ? e.h_index_estimate : 0,
          paper_count: typeof e.paper_count === 'number' ? e.paper_count : 0,
        });
      } else {
        missed += 1;
      }
    }

    // Aggregate institutions from resolved authors.
    const instCounts = new Map();
    for (const a of resolved) {
      if (a.institution) {
        instCounts.set(a.institution, (instCounts.get(a.institution) || 0) + 1);
      }
    }
    const resolved_institutions = [];
    instCounts.forEach(function (count, name) {
      resolved_institutions.push({ name: name, author_count: count });
    });

    // Best-effort citation_edges from AUTHORED_BY edges. SELECT pairs of
    // authors sharing a Paper (i.e. two AUTHORED_BY edges with the same
    // source paper).
    const coAuthorRows = handle.conn.prepare(
      "SELECT e1.source AS paper_id, e1.target AS author1, e2.target AS author2 " +
      "FROM edges e1, edges e2 " +
      "WHERE e1.type = 'AUTHORED_BY' AND e2.type = 'AUTHORED_BY' " +
      "AND e1.source = e2.source AND e1.target < e2.target"
    ).all();

    // Resolve author keys back to names via the authorRows we already loaded.
    const keyToName = new Map();
    for (const r of authorRows) {
      try {
        const props = JSON.parse(r.properties);
        keyToName.set(r.id, props.name || r.id);
      } catch (_e) {
        keyToName.set(r.id, r.id);
      }
    }
    const citation_edges = [];
    for (const row of coAuthorRows) {
      citation_edges.push({
        source_author: keyToName.get(row.author1) || row.author1,
        target_author: keyToName.get(row.author2) || row.author2,
        paper_id: row.paper_id,
        type: 'CO_AUTHORED',
      });
    }

    return {
      resolved: resolved,
      missed: missed,
      citation_edges: citation_edges,
      resolved_institutions: resolved_institutions,
    };
  } finally {
    await lazygraph.closeGraph(handle.db);
  }
}

// ---------- mapAuthorsToAura ----------
//
// The public entry point. Orchestration:
//   1. Validate experts is an array (throws TypeError)
//   2. Detect tier (throws TypeError if neither opts.tier/driver/roomDir)
//   3. Empty experts -> early return shape (Layer 2 audit always runs)
//   4. Layer 1 audit: scan every per-expert cypher params object pre-Cypher
//      (covers expert.name + expert.orcid + expert.institution leak vectors)
//   5. Tier 1 (aura): per-expert MATCH-then-MERGE; CO_AUTHORED query;
//      AuraUnreachableError on backend failure
//   6. Tier 0 (sqlite): SELECT from room.db; degraded result + DEGRADED_NOTE
//   7. Layer 2 audit: scan output object pre-return (defense-in-depth)
//   8. Return result

async function mapAuthorsToAura(experts, opts) {
  opts = opts || {};
  if (!Array.isArray(experts)) {
    throw new TypeError(SURFACE_PRE + ': experts must be an array');
  }

  const tier = await detectTier(opts);

  // Empty input early return.
  if (experts.length === 0) {
    const empty = {
      resolved_authors: [],
      resolved_institutions: [],
      citation_edges: [],
      missed_count: 0,
      resolution_quality: tier === 'aura' ? 'full' : 'degraded',
      tier: tier,
      schema_version: SCHEMA_VERSION,
    };
    if (tier === 'sqlite') empty.note = DEGRADED_NOTE;
    // Layer 2 audit: even empty -- defense-in-depth always runs.
    auditQueryObject(empty, SURFACE_POST);
    return empty;
  }

  // Layer 1 audit: per-expert pre-Cypher Canon Part 8 scan.
  for (const e of experts) {
    auditQueryObject(buildCypherParamsForExpert(e), SURFACE_PRE);
  }

  let resolved_authors;
  let resolved_institutions;
  let citation_edges;
  let missed_count;

  if (tier === 'aura') {
    if (!opts.driver || typeof opts.driver.session !== 'function') {
      throw new TypeError(SURFACE_PRE + ': opts.driver required for tier=aura');
    }
    try {
      const results = [];
      for (const e of experts) {
        const r = await resolveAuraExpert(e, opts.driver);
        results.push(r);
      }
      resolved_authors = results
        .filter(function (r) { return !r.missed; })
        .map(function (r) {
          return {
            name: r.name,
            orcid: r.orcid,
            institution: r.institution,
            h_index_estimate: r.h_index_estimate,
            paper_count: r.paper_count,
            aura_node_id: r.aura_node_id,
          };
        });
      missed_count = results.filter(function (r) { return r.missed; }).length;
      // Aggregate institutions from resolved authors.
      const instCounts = new Map();
      for (const a of resolved_authors) {
        if (a.institution) {
          instCounts.set(a.institution, (instCounts.get(a.institution) || 0) + 1);
        }
      }
      resolved_institutions = [];
      instCounts.forEach(function (count, name) {
        resolved_institutions.push({ name: name, author_count: count });
      });
      // Multi-hop CO_AUTHORED query (best-effort).
      try {
        citation_edges = await fetchAuraCitationEdges(opts.driver);
      } catch (cxErr) {
        if (cxErr instanceof ExternalEgressViolation) throw cxErr;
        if (cxErr instanceof AuraUnreachableError) throw cxErr;
        // Connection-level errors during CO_AUTHORED bubble up as Aura unreachable.
        throw new AuraUnreachableError(
          'Aura backend unreachable during CO_AUTHORED query: ' + cxErr.message,
          { original: cxErr.message }
        );
      }
    } catch (err) {
      if (err instanceof ExternalEgressViolation) throw err;
      if (err instanceof AuraUnreachableError) throw err;
      throw new AuraUnreachableError(
        'Aura backend unreachable in rs-expert-mapper: ' + (err && err.message ? err.message : String(err)),
        { original: err && err.message ? err.message : String(err) }
      );
    }
  } else {
    // tier === 'sqlite'
    const sql = await resolveSqliteExperts(experts, opts.roomDir);
    resolved_authors = sql.resolved;
    missed_count = sql.missed;
    citation_edges = sql.citation_edges;
    resolved_institutions = sql.resolved_institutions;
  }

  const result = {
    resolved_authors: resolved_authors,
    resolved_institutions: resolved_institutions,
    citation_edges: citation_edges,
    missed_count: missed_count,
    resolution_quality: tier === 'aura' ? 'full' : 'degraded',
    tier: tier,
    schema_version: SCHEMA_VERSION,
  };
  if (tier === 'sqlite') result.note = DEGRADED_NOTE;

  // Layer 2 audit: pre-return Canon Part 8 scan. Throws on hit.
  auditQueryObject(result, SURFACE_POST);

  return result;
}

// ---------- Exports ----------

module.exports = {
  mapAuthorsToAura,
  DEGRADED_NOTE,
  SCHEMA_VERSION,
  _test: {
    detectTier,
    buildAuthorKey,
    buildCypherParamsForExpert,
    resolveAuraExpert,
    fetchAuraCitationEdges,
    resolveSqliteExperts,
    MATCH_AUTHOR_CYPHER,
    MERGE_AUTHOR_CYPHER,
    CO_AUTHORED_CYPHER,
  },
};
