'use strict';

const neo4j = require('neo4j-driver');
const { Pinecone } = require('@pinecone-database/pinecone');
const { z } = require('zod');

/**
 * brain_ask — The smart Brain tool.
 *
 * Accepts NATURAL LANGUAGE. Returns structured results.
 * Handles Pinecone vs Neo4j routing internally:
 *   1. Try Pinecone semantic search
 *   2. If quota exhausted (429/RESOURCE_EXHAUSTED) → fall back to Neo4j Cypher
 *   3. If both fail → return helpful error
 *
 * The caller never needs to write Cypher or know which backend is active.
 */

// Cypher patterns for common natural language intents
const CYPHER_PATTERNS = {
  framework: {
    match: /framework|methodology|tool|approach|technique/i,
    cypher: `MATCH (f:Framework)
WHERE toLower(f.name) CONTAINS toLower($keyword)
   OR toLower(f.description) CONTAINS toLower($keyword)
RETURN f.name AS name, f.description AS description, labels(f) AS labels
ORDER BY f.name LIMIT $limit`,
  },
  connection: {
    match: /connect|relate|chain|link|feeds|follows|after|before|next/i,
    cypher: `MATCH (a:Framework)-[r]->(b:Framework)
WHERE toLower(a.name) CONTAINS toLower($keyword)
   OR toLower(b.name) CONTAINS toLower($keyword)
RETURN a.name AS from, type(r) AS relationship, b.name AS to,
       r.confidence AS confidence, r.transform_description AS transform
ORDER BY r.confidence DESC LIMIT $limit`,
  },
  grade: {
    match: /grade|score|rubric|assess|evaluat|calibrat/i,
    cypher: `MATCH (f:Framework)-[a:APPLIED_IN]->(e:Example)
WHERE toLower(f.name) CONTAINS toLower($keyword)
   OR toLower(e.project_name) CONTAINS toLower($keyword)
RETURN e.project_name AS project, e.grade AS grade,
       f.name AS framework, e.rubric_scores AS rubric
ORDER BY e.grade_numeric DESC LIMIT $limit`,
  },
  problem: {
    match: /problem|wicked|tame|crisis|type|classif/i,
    cypher: `MATCH (pt:ProblemType)<-[:ADDRESSES_PROBLEM_TYPE]-(f:Framework)
WHERE toLower(pt.name) CONTAINS toLower($keyword)
   OR toLower(f.name) CONTAINS toLower($keyword)
RETURN pt.name AS problem_type, collect(f.name) AS frameworks,
       count(f) AS framework_count
ORDER BY framework_count DESC LIMIT $limit`,
  },
  book: {
    match: /book|author|read|reference|paper|publication/i,
    cypher: `MATCH (b:Book)
WHERE toLower(b.title) CONTAINS toLower($keyword)
   OR toLower(b.author) CONTAINS toLower($keyword)
RETURN b.title AS title, b.author AS author, b.key_insight AS insight
ORDER BY b.title LIMIT $limit`,
  },
  general: {
    match: /./,
    cypher: `MATCH (n)
WHERE any(prop IN keys(n) WHERE toLower(toString(n[prop])) CONTAINS toLower($keyword))
RETURN labels(n) AS type, n.name AS name,
       CASE WHEN n.description IS NOT NULL THEN n.description ELSE '' END AS description
LIMIT $limit`,
  },
};

/**
 * Extract a keyword from natural language query for Cypher use.
 */
function extractKeyword(question) {
  // Remove common question words
  const cleaned = question
    .replace(/^(what|which|how|why|who|where|when|tell me|show me|find|list|get)\s+(is|are|do|does|about|for|the|a|an|all|me)?\s*/i, '')
    .replace(/[?!.]+$/, '')
    .trim();
  // Take the most meaningful 2-3 words
  const words = cleaned.split(/\s+/).filter(w => w.length > 2);
  return words.slice(0, 3).join(' ') || cleaned;
}

/**
 * Select the best Cypher pattern for a question.
 */
function selectPattern(question) {
  for (const [name, pattern] of Object.entries(CYPHER_PATTERNS)) {
    if (name === 'general') continue; // fallback
    if (pattern.match.test(question)) return pattern;
  }
  return CYPHER_PATTERNS.general;
}

function registerBrainAsk(server) {
  let neo4jDriver = null;
  let pineconeClient = null;

  function getNeo4j() {
    if (!neo4jDriver) {
      neo4jDriver = neo4j.driver(
        process.env.NEO4J_URI,
        neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD)
      );
    }
    return neo4jDriver;
  }

  function getPinecone() {
    if (!pineconeClient) {
      pineconeClient = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    }
    return pineconeClient;
  }

  server.tool(
    'brain_ask',
    'Ask the Brain anything in natural language. Searches 23K methodology nodes and 12K semantic embeddings. Automatically handles Pinecone semantic search with Neo4j Cypher fallback. Use this instead of brain_query or brain_search — it handles routing internally.',
    {
      question: z.string().describe('Natural language question about PWS methodology, frameworks, connections, grading, or any teaching content'),
      topK: z.number().optional().describe('Number of results (default 5)'),
    },
    async ({ question, topK }) => {
      const limit = topK || 5;
      const keyword = extractKeyword(question);
      let source = 'unknown';
      let results = null;

      // --- Step 1: Try Pinecone semantic search ---
      try {
        const indexName = process.env.PINECONE_INDEX || 'pws-brain';
        const index = getPinecone().index(indexName).namespace('core');
        const searchResult = await index.searchRecords({
          query: { topK: limit, inputs: { text: question } },
        });

        if (searchResult && searchResult.result && searchResult.result.hits) {
          source = 'pinecone';
          results = searchResult.result.hits.map(h => ({
            score: h._score,
            id: h._id,
            text: h.fields?.text || h.fields?.chunk_text || '',
            metadata: h.fields || {},
          }));
        }
      } catch (err) {
        const msg = (err.message || '').toLowerCase();
        // Pinecone quota exhausted or other error — fall through to Neo4j
        if (msg.includes('resource_exhausted') || msg.includes('429') || msg.includes('quota')) {
          source = 'pinecone_quota_exhausted';
        }
        // Any other Pinecone error — also fall through
      }

      // --- Step 2: If Pinecone failed, use Neo4j Cypher ---
      if (!results || results.length === 0) {
        try {
          const pattern = selectPattern(question);
          const cypher = pattern.cypher
            .replace(/\$keyword/g, `'${keyword.replace(/'/g, "\\'")}'`)
            .replace(/\$limit/g, String(limit));

          const session = getNeo4j().session({ defaultAccessMode: neo4j.session.READ });
          try {
            const result = await session.run(cypher);
            const records = result.records.map(r => r.toObject());
            if (records.length > 0) {
              source = source === 'pinecone_quota_exhausted'
                ? 'neo4j_fallback (pinecone quota exhausted)'
                : 'neo4j';
              results = records;
            }
          } finally {
            await session.close();
          }
        } catch (err) {
          // Neo4j also failed
          if (!results) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  error: 'Both Pinecone and Neo4j unavailable',
                  pinecone: source === 'pinecone_quota_exhausted' ? 'Monthly embedding quota exhausted' : 'Connection error',
                  neo4j: 'Query error: ' + (err.message || 'unknown'),
                  suggestion: 'Brain is temporarily unavailable. MindrianOS works fully without it — all 46 commands, Data Room, graph, personas. Try again later or wait for Pinecone billing cycle reset.',
                }, null, 2),
              }],
              isError: true,
            };
          }
        }
      }

      // --- Step 3: Return results ---
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            question,
            keyword,
            source,
            count: results ? results.length : 0,
            results: results || [],
            ...(source.includes('fallback') ? {
              note: 'Pinecone embedding quota exhausted for this billing cycle. Results are from Neo4j Cypher queries (keyword-based, not semantic). Semantic search will resume when the quota resets.',
            } : {}),
          }, null, 2),
        }],
      };
    }
  );
}

module.exports = { registerBrainAsk };
