'use strict';

// mcp-server-brain/lib/brain-vector-search.cjs
//
// Phase 127.1 Plan 02 -- Server-side semantic-search library backed by the
// Neo4j HNSW vector index `mindrian_methodology_vec`. This is the file that
// Plan 127.1-03 (the cutover) will wire into mcp-server-brain/server.cjs to
// replace lib/pinecone-tools.cjs's brain_search call path.
//
// This library queries the NEW 1024-dim `mindrian_methodology_vec` index
// ONLY. It never queries the 7 pre-existing 384-dim entity-embedding indexes
// (concept / creativework / entity / framework / person / product / Chunk-
// vector) and never touches the reserved command-routing node family. The
// query is scoped by the index name passed to db.index.vector.queryNodes(),
// so it can only return hits from the migrated MethodologyChunk node family.
// (Re-scope-corrective 2026-05-20; see DI-127.1-02.)
//
// The response shape mirrors mcp-server-brain/lib/pinecone-tools.cjs's
// searchRecords return shape ({score, id, text, metadata}) so the cutover
// is a mechanical call-site swap; downstream consumers (brain-ask routing
// at brain-ask.cjs lines 141-149) do not change.
//
// Locked by the CONTEXT.md four-lock protocol:
//   Lock 2: EMBEDDING_DIMS = 1024 (grep-able, runtime-validated)
//   Lock 3: SIMILARITY_METRIC = 'cosine' (informational constant; the index
//           DDL is the load-bearing enforcement -- see
//           mcp-server-brain/sql/127.1-vector-index.cypher)
//
// SEARCH-vs-queryNodes branching (per RESEARCH A127.1.1):
//   - Neo4j 2026.04+ deprecates db.index.vector.queryNodes() in favor of
//     the Cypher SEARCH clause.
//   - This module memoizes a version detect on first call (CALL
//     dbms.components()) and routes to the SEARCH path when major >= 2026,
//     queryNodes() otherwise.
//   - Both branches return the same {score, id, text, metadata} hits shape
//     so the rest of the cutover is unchanged regardless of Neo4j version.
//
// Phase 127.1 Plan 03 -- text-query entry point added.
//   searchSemantic({embedding, ...}) is the original vector-in path; it is
//   unchanged. searchSemanticByText({query, ...}) is the NEW text-in path:
//   it embeds the query string with e5-large server-side (via
//   lib/query-embedder.cjs) and then calls searchSemantic. Pinecone's
//   brain_search embedded query text for free via integrated inference;
//   Neo4j has none, so the embedding step is now an explicit internal step.
//   The brain_search MCP tool schema below takes a `query` string again --
//   restoring the Pinecone-era API boundary (GRAPHRAG-COLLAPSE-127.1-16:
//   brain_search keeps its text-query contract, the embedding is internal).
//
// Hard rules honored:
//   - No em-dashes (U+2014); hyphens only.
//   - No live Pinecone calls (Plan 127.1-05 will remove Pinecone from server.cjs).
//   - searchSemantic stays a pre-computed-embedding path; searchSemanticByText
//     is the text path that bridges string -> vector via query-embedder.cjs.
//   - CommonJS; Node 18+; reuses neo4j-driver + zod under
//     mcp-server-brain/node_modules.

const neo4j = require('neo4j-driver');
const { z } = require('zod');

// Locked constants -- match the loader (scripts/load-embeddings-into-neo4j.cjs)
// byte-for-byte where they overlap.
const INDEX_NAME = 'mindrian_methodology_vec';
const EMBEDDING_DIMS = 1024;
const SIMILARITY_METRIC = 'cosine';
const NODE_LABEL = 'MethodologyChunk';
const DEFAULT_TOP_K = 5;

let driver = null;
// Memoized at first call to pick SEARCH vs queryNodes(). Module-scoped cache
// is correct: Neo4j Aura instance version cannot change mid-process without
// a server restart. Re-init on driver re-creation (e.g. test reset) covered
// by resetCache() below.
let neo4jVersionCache = null;

// ----------------------------------------------------------------------------
// Driver lifecycle (lazy)
// ----------------------------------------------------------------------------

function getDriver() {
  if (!driver) {
    driver = neo4j.driver(
      process.env.NEO4J_URI,
      neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD)
    );
  }
  return driver;
}

async function closeDriver() {
  if (driver) {
    await driver.close();
    driver = null;
    neo4jVersionCache = null;
  }
}

function resetCache() {
  neo4jVersionCache = null;
}

// ----------------------------------------------------------------------------
// Version detection (memoized)
// ----------------------------------------------------------------------------

async function detectNeo4jVersion(session) {
  if (neo4jVersionCache !== null) return neo4jVersionCache;
  const result = await session.run('CALL dbms.components() YIELD versions RETURN versions[0] AS version');
  const v = result.records[0].get('version');
  neo4jVersionCache = v;
  return v;
}

// Returns true if SEARCH clause is preferred (Neo4j >= 2026.04 per RESEARCH A127.1.1).
// Neo4j adopted calendar versioning at 2025.10; major>=2026 implies SEARCH-capable.
function supportsSearchClause(version) {
  const m = /^(\d+)\.(\d+)/.exec(version);
  if (!m) return false;
  const major = parseInt(m[1], 10);
  return major >= 2026;
}

// ----------------------------------------------------------------------------
// Core semantic-search entry point
// ----------------------------------------------------------------------------

/**
 * Run a semantic search against the Neo4j HNSW vector index.
 *
 * @param {object} args
 * @param {number[]} args.embedding - Pre-computed 1024-dim multilingual-e5-large
 *                                     vector. Plan 127.1-03 decides how to bridge
 *                                     string queries to this vector path.
 * @param {number} [args.topK=5]    - Number of hits to return.
 * @param {string|null} [args.namespace=null] - Optional namespace filter.
 * @param {object} [args.session]   - Optional pre-opened READ session; if
 *                                     omitted, a fresh session is opened +
 *                                     closed inside this call.
 * @returns {Promise<{hits: Array<{score:number, id:string, text:string, metadata:object}>,
 *                    engine: 'neo4j-hnsw', version: string, used_search_clause: boolean}>}
 */
async function searchSemantic({ embedding, topK, namespace, session } = {}) {
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMS) {
    throw new Error(
      'embedding must be a 1024-dim Float64 array; observed length=' +
        (embedding && embedding.length !== undefined ? embedding.length : 'null')
    );
  }
  const effectiveTopK = typeof topK === 'number' && topK > 0 ? topK : DEFAULT_TOP_K;
  const effectiveNamespace = namespace || null;
  const ownSession = !session;
  const sess = session || getDriver().session({ defaultAccessMode: neo4j.session.READ });

  try {
    const version = await detectNeo4jVersion(sess);
    const useSearch = supportsSearchClause(version);

    // SEARCH-clause branch (Neo4j 2026.04+ per RESEARCH A127.1.1):
    //   CALL () { CALL db.index.vector.queryNodes(...) YIELD node, score
    //             [WITH node, score WHERE node.namespace = $namespace]
    //             RETURN node, score }
    //   RETURN node.id, node.metadata, score ORDER BY score DESC LIMIT $topK
    //
    // The 2026.04 Cypher Manual prefers the inner-CALL form so the
    // post-projection ORDER BY + LIMIT can be reasoned about by the
    // planner; the namespace filter sits inside the inner CALL so the
    // top-K is computed AFTER filtering (cheaper to plan than
    // post-filtering the same set).
    //
    // queryNodes() branch (Neo4j 5.13 through 2026.03): the procedure
    // call is the only path; namespace filter sits in a post-procedure
    // WHERE that runs AFTER the top-K is computed (the older planner
    // cannot push the filter into the index scan -- documented limit
    // per the 5.x Cypher Manual).
    //
    // Both branches share the same projection (id + metadata_json + score)
    // so the response shape is version-invariant.
    let cypher;
    if (useSearch) {
      cypher =
        'CALL () {\n' +
        '  CALL db.index.vector.queryNodes($indexName, $topK, $queryVec)\n' +
        '  YIELD node, score\n' +
        (effectiveNamespace ? '  WITH node, score WHERE node.namespace = $namespace\n' : '') +
        '  RETURN node, score\n' +
        '}\n' +
        'RETURN node.id AS id,\n' +
        '       node.metadata AS metadata_json,\n' +
        '       score\n' +
        'ORDER BY score DESC\n' +
        'LIMIT $topK';
    } else {
      cypher =
        'CALL db.index.vector.queryNodes($indexName, $topK, $queryVec)\n' +
        'YIELD node, score\n' +
        (effectiveNamespace ? 'WHERE node.namespace = $namespace\n' : '') +
        'RETURN node.id AS id,\n' +
        '       node.metadata AS metadata_json,\n' +
        '       score\n' +
        'ORDER BY score DESC\n' +
        'LIMIT $topK';
    }

    const params = {
      indexName: INDEX_NAME,
      topK: neo4j.int(effectiveTopK),
      queryVec: embedding,
    };
    if (effectiveNamespace) params.namespace = effectiveNamespace;

    const result = await sess.run(cypher, params);
    const hits = result.records.map(r => {
      const metadataJson = r.get('metadata_json');
      let metadata = {};
      try {
        metadata = metadataJson ? JSON.parse(metadataJson) : {};
      } catch (_) {
        metadata = {};
      }
      const rawScore = r.get('score');
      const score = typeof rawScore === 'object' && rawScore && rawScore.toNumber
        ? rawScore.toNumber()
        : Number(rawScore);
      return {
        score: score,
        id: r.get('id'),
        text: metadata.text || metadata.chunk_text || '',
        metadata: metadata,
      };
    });

    return {
      hits: hits,
      engine: 'neo4j-hnsw',
      version: version,
      used_search_clause: useSearch,
    };
  } finally {
    if (ownSession) await sess.close();
  }
}

// ----------------------------------------------------------------------------
// Text-query entry point (Phase 127.1 Plan 03)
// ----------------------------------------------------------------------------

/**
 * Run a semantic search from a query STRING.
 *
 * This is the text-in path. Pinecone embedded the query string for free via
 * integrated inference; Neo4j has none, so this function embeds the query
 * with e5-large server-side (lib/query-embedder.cjs applies the mandatory
 * `query: ` prefix so the query vector lands in the same e5 space as the
 * migrated `passage: `-prefixed corpus) and then delegates to searchSemantic.
 *
 * The query-embedder is required lazily inside the function so the module
 * load order stays clean and brain-vector-search.cjs can still be required
 * for its vector-in path without pulling the embedder in.
 *
 * @param {object} args
 * @param {string} args.query              - The query text (NOT pre-prefixed).
 * @param {number} [args.topK=5]           - Number of hits to return.
 * @param {string|null} [args.namespace=null] - Optional namespace filter.
 * @param {object} [args.session]          - Optional pre-opened READ session.
 * @returns {Promise<{hits: Array, engine: string, version: string,
 *                    used_search_clause: boolean}>}
 * @throws {Error} whose message contains `embedding backend unavailable` when
 *                 the embedding backend is unreachable -- the cutover (Plan
 *                 127.1-04) decides fallback behavior from that signal.
 */
async function searchSemanticByText({ query, topK, namespace, session } = {}) {
  const { embedQuery } = require('./query-embedder.cjs');
  const embedding = await embedQuery(query);
  return searchSemantic({ embedding: embedding, topK: topK, namespace: namespace, session: session });
}

// ----------------------------------------------------------------------------
// MCP tool registration
// ----------------------------------------------------------------------------

/**
 * Register the brain_search tool on an McpServer instance.
 *
 * The MCP tool input schema is a `query` STRING -- this restores the API
 * boundary the Pinecone-era brain_search had (a string, not a vector). The
 * handler embeds the string server-side via searchSemanticByText, so the
 * embedding step is internal and invisible to clients
 * (GRAPHRAG-COLLAPSE-127.1-16). Plan 127.1-04's cutover wires this
 * registration into mcp-server-brain/server.cjs in place of the
 * pinecone-tools.cjs brain_search registration.
 */
function registerVectorSearchTool(server) {
  server.tool(
    'brain_search',
    'Semantic search across Brain knowledge (12,401 PWS methodology vectors across 6 namespaces). ' +
      'Backed by Neo4j HNSW (Phase 127.1 cutover). ' +
      'Namespaces: core, materials, reference, tools, graphrag, books (omit for all). ' +
      'Returns top-K hits ranked by cosine similarity.',
    {
      query: z.string().describe('The query text. Embedded server-side with multilingual-e5-large before the Neo4j vector search.'),
      namespace: z.string().optional().describe('Namespace filter (default: all)'),
      topK: z.number().optional().describe('Number of results (default 5)'),
    },
    async ({ query, namespace, topK }) => {
      try {
        const out = await searchSemanticByText({
          query: query,
          topK: topK || DEFAULT_TOP_K,
          namespace: namespace || null,
        });
        return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] };
      } catch (err) {
        // An `embedding backend unavailable` error reaches here unswallowed
        // so Plan 127.1-04's cutover can decide fallback behavior. Surface
        // it as a clear isError content block, never a silent empty result.
        const message = err && err.message ? err.message : String(err);
        const isEmbeddingOutage = /embedding backend unavailable/.test(message);
        return {
          content: [{
            type: 'text',
            text: isEmbeddingOutage
              ? 'Error: the embedding backend is unavailable -- brain_search cannot embed the query text. ' + message
              : 'Error: ' + message,
          }],
          isError: true,
        };
      }
    }
  );
}

module.exports = {
  registerVectorSearchTool: registerVectorSearchTool,
  searchSemantic: searchSemantic,
  searchSemanticByText: searchSemanticByText,
  detectNeo4jVersion: detectNeo4jVersion,
  supportsSearchClause: supportsSearchClause,
  closeDriver: closeDriver,
  resetCache: resetCache,
  INDEX_NAME: INDEX_NAME,
  EMBEDDING_DIMS: EMBEDDING_DIMS,
  SIMILARITY_METRIC: SIMILARITY_METRIC,
  NODE_LABEL: NODE_LABEL,
  DEFAULT_TOP_K: DEFAULT_TOP_K,
};
