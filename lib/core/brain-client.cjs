'use strict';

/**
 * Brain HTTP Client — calls mindrian-brain.onrender.com
 *
 * Replaces direct MCP tool calls (mcp__neo4j-brain__*, mcp__pinecone-brain__*)
 * with a single HTTP API that handles Neo4j + Pinecone behind one key.
 *
 * Falls back gracefully:
 *   1. If MINDRIAN_BRAIN_KEY is set → calls Brain API
 *   2. If Brain API returns Pinecone quota error → retries with Neo4j-only
 *   3. If no key → returns null (Tier 0, no Brain)
 *
 * Usage in commands/skills:
 *   const brain = require('./brain-client.cjs');
 *   const result = await brain.query('MATCH (f:Framework) RETURN f.name LIMIT 5');
 *   const result = await brain.search('innovation framework');
 *   const schema = await brain.schema();
 */

const BRAIN_URL = process.env.MINDRIAN_BRAIN_URL || 'https://mindrian-brain.onrender.com';

/**
 * Get the Brain API key from environment.
 * Checks: MINDRIAN_BRAIN_KEY, then falls back to reading .env in CWD.
 */
function getApiKey() {
  if (process.env.MINDRIAN_BRAIN_KEY) {
    return process.env.MINDRIAN_BRAIN_KEY;
  }
  // Try reading .env from CWD
  try {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/MINDRIAN_BRAIN_KEY=(.+)/);
      if (match) return match[1].trim();
    }
  } catch (e) {}
  return null;
}

/**
 * Check if Brain is available (key exists).
 */
function isAvailable() {
  return !!getApiKey();
}

/**
 * Call a Brain MCP tool via HTTP.
 * @param {string} toolName - e.g., 'brain_query', 'brain_search', 'brain_schema'
 * @param {object} args - tool arguments
 * @returns {object|null} - result or null if unavailable
 */
async function callTool(toolName, args) {
  const key = getApiKey();
  if (!key) return null;

  try {
    // Initialize session
    const initRes = await fetch(`${BRAIN_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'mindrian-cli', version: '1.0.0' },
        },
      }),
    });

    if (!initRes.ok) {
      if (initRes.status === 401) return { error: 'invalid_key', message: 'Brain API key is invalid.' };
      return null;
    }

    // Call the tool
    const toolRes = await fetch(`${BRAIN_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: toolName, arguments: args },
      }),
    });

    if (!toolRes.ok) return null;

    const text = await toolRes.text();
    // Parse SSE response
    const dataLine = text.split('\n').find(l => l.startsWith('data: '));
    if (!dataLine) return null;

    const parsed = JSON.parse(dataLine.slice(6));
    if (parsed.result && parsed.result.content) {
      const textContent = parsed.result.content.find(c => c.type === 'text');
      if (textContent) {
        try {
          return JSON.parse(textContent.text);
        } catch (e) {
          return { text: textContent.text };
        }
      }
    }
    return parsed.result || null;
  } catch (err) {
    // Network error, timeout, etc.
    return null;
  }
}

/**
 * Query Neo4j via Brain (Cypher query).
 * This does NOT use Pinecone — no embedding quota consumed.
 */
async function query(cypher) {
  return callTool('brain_query', { query: cypher });
}

/**
 * Search Pinecone via Brain (semantic search).
 * If quota exhausted, returns error with fallback suggestion.
 */
async function search(queryText, options = {}) {
  const result = await callTool('brain_search', {
    query: queryText,
    namespace: options.namespace || undefined,
    topK: options.topK || 5,
  });

  // Check for Pinecone quota exhaustion
  if (result && result.text && result.text.includes('RESOURCE_EXHAUSTED')) {
    return {
      error: 'pinecone_quota_exhausted',
      message: 'Pinecone embedding quota exhausted for this month. Using Neo4j Cypher fallback.',
      fallback: 'neo4j',
    };
  }

  return result;
}

/**
 * Search with automatic fallback: Pinecone first, Neo4j Cypher if quota exhausted.
 */
async function smartSearch(queryText, options = {}) {
  // Try Pinecone first
  const pineconeResult = await search(queryText, options);

  if (pineconeResult && pineconeResult.error === 'pinecone_quota_exhausted') {
    // Fallback to Neo4j full-text search
    const cypher = `
      CALL db.index.fulltext.queryNodes("framework_search", $query)
      YIELD node, score
      RETURN node.name AS name, node.description AS description, score
      LIMIT ${options.topK || 5}
    `;
    const neo4jResult = await query(cypher.replace('$query', `"${queryText.replace(/"/g, '\\"')}"`));
    if (neo4jResult) {
      neo4jResult._source = 'neo4j_fallback';
      neo4jResult._note = 'Pinecone quota exhausted. Results from Neo4j Cypher fulltext search.';
    }
    return neo4jResult;
  }

  return pineconeResult;
}

/**
 * Get Neo4j schema.
 */
async function schema() {
  return callTool('brain_schema', {});
}

/**
 * Get Pinecone stats.
 */
async function stats() {
  return callTool('brain_stats', {});
}

/**
 * Enrich local graph with causal edges from Brain's teaching graph.
 *
 * Queries the Brain Neo4j for causal framework chains relevant to the
 * given problem type or section keywords. Returns structured causal data
 * suitable for writing to local KuzuDB as CAUSES/ROOT_CAUSE_OF edges.
 *
 * @param {string} problemType - Room problem type (e.g., 'market-validation')
 * @param {string[]} sectionKeywords - Keywords from room sections for context
 * @param {object} [options] - Optional config
 * @param {number} [options.maxChainDepth=3] - Maximum causal chain depth
 * @param {number} [options.minConfidence=0.5] - Minimum confidence threshold
 * @returns {Promise<{ causes: Array, rootCauses: Array } | null>}
 *   causes: [{ from, to, mechanism, confidence, framework }]
 *   rootCauses: [{ from, to, chainLength, intermediateCauses, confidence }]
 */
async function enrichCausalEdges(problemType, sectionKeywords, options = {}) {
  if (!isAvailable()) return null;

  const maxDepth = options.maxChainDepth || 3;
  const minConf = options.minConfidence || 0.5;
  const keywordFilter = sectionKeywords && sectionKeywords.length > 0
    ? sectionKeywords.map(k => `"${k.replace(/"/g, '\\"')}"`).join(', ')
    : '';

  // Query 1: Direct causal relationships from framework chains
  const causesCypher = `
    MATCH (f1:Framework)-[r:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType)
    WHERE pt.name CONTAINS "${(problemType || '').replace(/"/g, '\\"')}"
    WITH f1
    MATCH (f1)-[co:CO_OCCURS]->(f2:Framework)
    WHERE co.weight >= ${minConf}
    RETURN f1.name AS cause_framework,
           f2.name AS effect_framework,
           co.weight AS confidence,
           f1.description AS mechanism
    LIMIT 20
  `;

  // Query 2: Root cause chains (multi-hop framework dependencies)
  const rootCauseCypher = `
    MATCH path = (root:Framework)-[:CO_OCCURS*1..${maxDepth}]->(leaf:Framework)
    WHERE root <> leaf
    ${keywordFilter ? `AND ANY(k IN [${keywordFilter}] WHERE root.name CONTAINS k OR root.description CONTAINS k)` : ''}
    WITH root, leaf, path, length(path) AS depth
    WHERE depth >= 2
    RETURN root.name AS root_cause,
           leaf.name AS symptom,
           depth AS chain_length,
           [n IN nodes(path) | n.name] AS chain_nodes
    LIMIT 10
  `;

  try {
    const [causesResult, rootCausesResult] = await Promise.all([
      query(causesCypher),
      query(rootCauseCypher),
    ]);

    const causes = [];
    const rootCauses = [];

    // Parse causes
    if (causesResult && Array.isArray(causesResult.records)) {
      for (const rec of causesResult.records) {
        causes.push({
          from: rec.cause_framework || rec[0],
          to: rec.effect_framework || rec[1],
          mechanism: rec.mechanism || rec[3] || '',
          confidence: parseFloat(rec.confidence || rec[2] || 0),
          framework: rec.cause_framework || rec[0] || '',
        });
      }
    }

    // Parse root causes
    if (rootCausesResult && Array.isArray(rootCausesResult.records)) {
      for (const rec of rootCausesResult.records) {
        rootCauses.push({
          from: rec.root_cause || rec[0],
          to: rec.symptom || rec[1],
          chainLength: parseInt(rec.chain_length || rec[2] || 1, 10),
          intermediateCauses: rec.chain_nodes || rec[3] || [],
          confidence: 1.0 / (parseInt(rec.chain_length || rec[2] || 1, 10) + 1),
        });
      }
    }

    return { causes, rootCauses };
  } catch (err) {
    // Brain query failed -- return null for graceful degradation
    return null;
  }
}

module.exports = {
  isAvailable,
  getApiKey,
  callTool,
  query,
  search,
  smartSearch,
  schema,
  stats,
  enrichCausalEdges,
};
