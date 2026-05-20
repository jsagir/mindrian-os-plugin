'use strict';

const neo4j = require('neo4j-driver');
const { z } = require('zod');

let driver = null;

// D-MOAT-2 (Plan 127.1-05): Cypher execution safeguards, ported from the
// official Neo4j mcp-neo4j-cypher recipe. Bounds exfiltration on any read
// the brain_query admin gate still permits, and bounds brain_schema reads.
const CYPHER_LIMITS = {
  maxRows: Number(process.env.BRAIN_CYPHER_MAX_ROWS) || 1000,
  maxEstimatedRows: Number(process.env.BRAIN_CYPHER_MAX_ESTIMATED_ROWS) || 5000,
  maxBytes: Number(process.env.BRAIN_CYPHER_MAX_BYTES) || 524288,
  timeoutMs: Number(process.env.BRAIN_CYPHER_TIMEOUT_MS) || 5000,
};

function getDriver() {
  if (!driver) {
    driver = neo4j.driver(
      process.env.NEO4J_URI,
      neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD)
    );
  }
  return driver;
}

/**
 * D-MOAT-2 safeguard 1: EXPLAIN-plan estimated-row reject. Runs EXPLAIN before
 * the real query, walks the plan tree, takes the max EstimatedRows, and reports
 * whether the configured ceiling is exceeded. The query is rejected BEFORE any
 * data is read when this returns exceeded: true.
 */
async function estimatedRowCeilingExceeded(session, cypher, params) {
  let explainResult;
  try {
    explainResult = await session.run('EXPLAIN ' + cypher, params || {});
  } catch (err) {
    // If EXPLAIN itself fails, the query is malformed; let the real run surface the error.
    return { exceeded: false, estimated: null };
  }
  const plan = explainResult.summary && explainResult.summary.plan;
  let maxEstimated = 0;
  function walk(node) {
    if (!node) return;
    const est = node.arguments && node.arguments.EstimatedRows;
    if (typeof est === 'number' && est > maxEstimated) maxEstimated = est;
    if (typeof est === 'object' && est && typeof est.toNumber === 'function') {
      const n = est.toNumber();
      if (n > maxEstimated) maxEstimated = n;
    }
    (node.children || []).forEach(walk);
  }
  walk(plan);
  return { exceeded: maxEstimated > CYPHER_LIMITS.maxEstimatedRows, estimated: maxEstimated };
}

/**
 * D-MOAT-2 safeguards 2-4: shared bounded-read helper. Applies the read timeout,
 * the row cap, and the byte cap to caller Cypher, and returns an MCP-shaped
 * object so the tool handlers can return it directly.
 *
 * Read timeout: the installed neo4j-driver (5.28) supports the per-query
 * transaction-config { timeout } option on session.run, so it is used directly.
 */
async function runBoundedRead(session, cypher, params) {
  let result;
  try {
    result = await session.run(cypher, params || {}, { timeout: CYPHER_LIMITS.timeoutMs });
  } catch (err) {
    return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
  }

  // Row cap: truncate before mapping.
  const originalCount = result.records.length;
  let records = result.records;
  let truncated = false;
  if (originalCount > CYPHER_LIMITS.maxRows) {
    records = records.slice(0, CYPHER_LIMITS.maxRows);
    truncated = true;
  }
  const mapped = records.map(r => r.toObject());

  const payload = truncated
    ? { truncated: true, returned: mapped.length, originalCount, records: mapped }
    : mapped;
  const text = JSON.stringify(payload, null, 2);

  // Byte cap: reject an oversized payload instead of returning it.
  if (text.length > CYPHER_LIMITS.maxBytes) {
    return {
      content: [{
        type: 'text',
        text: 'Result exceeds the BRAIN_CYPHER_MAX_BYTES cap (' + CYPHER_LIMITS.maxBytes
          + ' bytes). Narrow the query (add a LIMIT, project fewer properties, or filter harder) and retry.',
      }],
      isError: true,
    };
  }

  return { content: [{ type: 'text', text }] };
}

/**
 * Register Neo4j Brain tools on an McpServer instance.
 * Tools: brain_schema, brain_query, brain_write
 *
 * Uses db.labels() + db.relationshipTypes() + db.propertyKeys() instead of
 * apoc.meta.schema() which may not be available on Aura free tier.
 */
function registerNeo4jTools(server, options = {}) {
  const { plan } = options;
  // 1. brain_schema -- returns labels, relationship types, property keys
  server.tool(
    'brain_schema',
    'Get the Brain knowledge graph schema (node labels, relationship types, property keys)',
    {},
    async () => {
      const session = getDriver().session({ defaultAccessMode: neo4j.session.READ });
      try {
        // D-MOAT-2: brain_schema runs three fixed CALL db.* procedures, not
        // caller Cypher, so the EXPLAIN reject and the row cap are not
        // meaningful here; only the read timeout and the byte cap apply.
        const timeout = CYPHER_LIMITS.timeoutMs;
        const labelsResult = await session.run('CALL db.labels()', {}, { timeout });
        const relTypesResult = await session.run('CALL db.relationshipTypes()', {}, { timeout });
        const propKeysResult = await session.run('CALL db.propertyKeys()', {}, { timeout });

        const schema = {
          labels: labelsResult.records.map(r => r.get('label')),
          relationshipTypes: relTypesResult.records.map(r => r.get('relationshipType')),
          propertyKeys: propKeysResult.records.map(r => r.get('propertyKey')),
        };

        const text = JSON.stringify(schema, null, 2);
        if (text.length > CYPHER_LIMITS.maxBytes) {
          return {
            content: [{
              type: 'text',
              text: 'Schema response exceeds the BRAIN_CYPHER_MAX_BYTES cap ('
                + CYPHER_LIMITS.maxBytes + ' bytes).',
            }],
            isError: true,
          };
        }
        return { content: [{ type: 'text', text }] };
      } catch (err) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      } finally {
        await session.close();
      }
    }
  );

  // 2. brain_query -- read-only Cypher (admin-gated, D-MOAT-1 Plan 127.1-05;
  //    bounded by D-MOAT-2 execution safeguards)
  server.tool(
    'brain_query',
    'Run a read-only Cypher query on the Brain knowledge graph (admin key required)',
    {
      cypher: z.string().describe('Read-only Cypher query'),
      params: z.record(z.any()).optional().describe('Query parameters'),
    },
    async ({ cypher, params }) => {
      if (plan !== 'admin') {
        return {
          content: [{ type: 'text', text: 'Raw Cypher query access requires admin key. Use brain_search or brain_ask for methodology lookups. Contact Jonathan for elevated access.' }],
          isError: true,
        };
      }
      const session = getDriver().session({ defaultAccessMode: neo4j.session.READ });
      try {
        // D-MOAT-2: reject before execution when the EXPLAIN plan estimates
        // more rows than the configured ceiling.
        const estimate = await estimatedRowCeilingExceeded(session, cypher, params);
        if (estimate.exceeded) {
          return {
            content: [{
              type: 'text',
              text: 'Query rejected before execution. The EXPLAIN plan estimates '
                + estimate.estimated + ' rows, over the BRAIN_CYPHER_MAX_ESTIMATED_ROWS ceiling of '
                + CYPHER_LIMITS.maxEstimatedRows + '. Narrow the query and retry.',
            }],
            isError: true,
          };
        }
        // D-MOAT-2: delegate execution to the bounded-read helper (timeout +
        // row cap + byte cap).
        return await runBoundedRead(session, cypher, params);
      } catch (err) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      } finally {
        await session.close();
      }
    }
  );

  // 3. brain_write -- write Cypher
  server.tool(
    'brain_write',
    'Write data to the Brain knowledge graph (creates/updates nodes and relationships)',
    {
      cypher: z.string().describe('Write Cypher query'),
      params: z.record(z.any()).optional().describe('Query parameters'),
    },
    async ({ cypher, params }) => {
      if (plan !== 'admin') {
        return {
          content: [{ type: 'text', text: 'Write access requires admin key. Contact Jonathan for elevated access.' }],
          isError: true,
        };
      }
      const session = getDriver().session({ defaultAccessMode: neo4j.session.WRITE });
      try {
        const result = await session.run(cypher, params || {});
        const counters = result.summary.counters.updates();
        return { content: [{ type: 'text', text: 'Written. Stats: ' + JSON.stringify(counters) }] };
      } catch (err) {
        return { content: [{ type: 'text', text: 'Error: ' + err.message }], isError: true };
      } finally {
        await session.close();
      }
    }
  );
}

module.exports = { registerNeo4jTools };
