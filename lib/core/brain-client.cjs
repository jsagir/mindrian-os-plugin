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
  // Fallback: try reading ~/.mindrian.env (global backup)
  try {
    const fs = require('fs');
    const path = require('path');
    const globalEnvPath = path.join(require('os').homedir(), '.mindrian.env');
    if (fs.existsSync(globalEnvPath)) {
      const content = fs.readFileSync(globalEnvPath, 'utf8');
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

/**
 * Hat-aware framework recommendation.
 *
 * Reads persistent hat states and adjusts Brain framework queries:
 * - Black Hat concerns boost risk-related frameworks (Risk Matrix, SWOT threats)
 * - Yellow Hat opportunities boost HSI scoring and opportunity frameworks
 * - Blue Hat methodology notes avoid repeating ineffective frameworks
 *
 * @param {string} roomDir - Absolute path to room directory
 * @param {string} problemType - Room problem type
 * @param {object} [options] - Optional config
 * @param {number} [options.topK=5] - Number of frameworks to return
 * @returns {Promise<{ frameworks: Array, hat_influence: object } | null>}
 */
async function hatAwareRecommend(roomDir, problemType, options = {}) {
  if (!isAvailable()) return null;

  // Lazy-require to avoid circular dependency at module load time
  const { loadAllHatStates } = require('./hat-persistence.cjs');
  const hatStates = loadAllHatStates(roomDir);
  const topK = options.topK || 5;

  const hatInfluence = {
    risk_boost: false,
    opportunity_boost: false,
    avoid_frameworks: [],
  };

  // Black Hat: if concerns exist, boost risk-related frameworks
  const blackConcerns = hatStates.black.top_concerns || [];
  const riskBoost = blackConcerns.length > 0;
  hatInfluence.risk_boost = riskBoost;

  // Yellow Hat: if opportunities exist, boost HSI/opportunity frameworks
  const yellowOpps = hatStates.yellow.top_opportunities || [];
  const oppBoost = yellowOpps.length > 0;
  hatInfluence.opportunity_boost = oppBoost;

  // Blue Hat: methodology notes may flag ineffective frameworks to avoid
  const blueNotes = hatStates.blue.methodology_notes || [];
  const avoidPatterns = blueNotes
    .filter(n => /ineffective|didn't work|not useful|skip|avoid/i.test(n))
    .map(n => {
      // Extract framework name from notes like "SWOT was ineffective for this stage"
      const match = n.match(/^(\w[\w\s]+?)\s+(?:was|is|were|proved)\s/i);
      return match ? match[1].trim() : null;
    })
    .filter(Boolean);
  hatInfluence.avoid_frameworks = avoidPatterns;

  // Build Cypher query with hat-influenced scoring
  const safeProblemType = (problemType || '').replace(/"/g, '\\"');
  const avoidClause = avoidPatterns.length > 0
    ? `AND NOT ANY(avoid IN [${avoidPatterns.map(a => `"${a.replace(/"/g, '\\"')}"`).join(', ')}] WHERE f.name CONTAINS avoid)`
    : '';

  // Query: frameworks for problem type, with hat-influenced ordering
  const cypher = `
    MATCH (f:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType)
    WHERE pt.name CONTAINS "${safeProblemType}"
    ${avoidClause}
    WITH f
    OPTIONAL MATCH (f)-[co:CO_OCCURS]->(f2:Framework)
    WITH f, count(co) AS connections
    RETURN f.name AS name,
           f.description AS description,
           connections,
           CASE
             WHEN ${riskBoost ? 'true' : 'false'} AND (f.name CONTAINS 'Risk' OR f.name CONTAINS 'SWOT' OR f.name CONTAINS 'Failure') THEN connections + 10
             WHEN ${oppBoost ? 'true' : 'false'} AND (f.name CONTAINS 'HSI' OR f.name CONTAINS 'Opportunity' OR f.name CONTAINS 'Innovation') THEN connections + 10
             ELSE connections
           END AS hat_score
    ORDER BY hat_score DESC
    LIMIT ${topK}
  `;

  try {
    const result = await query(cypher);
    const frameworks = [];

    if (result && Array.isArray(result.records)) {
      for (const rec of result.records) {
        frameworks.push({
          name: rec.name || rec[0],
          description: rec.description || rec[1],
          connections: parseInt(rec.connections || rec[2] || 0, 10),
          hat_score: parseInt(rec.hat_score || rec[3] || 0, 10),
        });
      }
    }

    return {
      frameworks,
      hat_influence: hatInfluence,
      black_concerns: blackConcerns.slice(0, 3),
      yellow_opportunities: yellowOpps.slice(0, 3),
      blue_avoid: avoidPatterns,
    };
  } catch (err) {
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
  hatAwareRecommend,
};
