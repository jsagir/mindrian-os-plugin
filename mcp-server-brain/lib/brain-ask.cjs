'use strict';

const neo4j = require('neo4j-driver');
const { Pinecone } = require('@pinecone-database/pinecone');
const { z } = require('zod');

/**
 * brain_ask - The smart Brain tool.
 *
 * Accepts NATURAL LANGUAGE. Returns a typed DirectiveEnvelope payload.
 * Handles Pinecone vs Neo4j routing internally:
 *   1. Try Pinecone semantic search
 *   2. If quota exhausted (429/RESOURCE_EXHAUSTED) -> fall back to Neo4j Cypher
 *   3. If both fail -> return helpful error
 *
 * Phase 127 contract (docs/CAPABILITY-MAP.md DirectiveEnvelope section):
 * brain_ask is the methodology-reasoning surface, not a raw search wrapper. It
 * MUST return a payload carrying a populated `directive` (framework + reframing
 * questions + stage), `next_gate` (F-shape + options), and `mode_signals`, so
 * the plugin's directive-envelope wrapper (lib/core/directive-envelope.cjs) can
 * pass it through instead of falling through to an empty GUIDED scaffold.
 *
 * Canon Part 8: the question string carries only generic methodology language;
 * the graph holds only generic teaching methodology. No user data enters or
 * leaves on this path.
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

/**
 * Derive mode-selection signals from the question text alone.
 *
 * Canon Part 8: the question carries only generic methodology language, so
 * these signals are derived purely from generic phrasing - never from user
 * artifacts. selectMode in lib/core/directive-envelope.cjs consumes these;
 * the canonical default remains GUIDED (feedback_larry_pedagogical_guided_first).
 *
 * @param {string} question
 * @returns {object} mode_signals
 */
function deriveModeSignals(question) {
  const q = (question || '').toLowerCase();
  return {
    user_said_just_tell_me: /just tell me|bottom line|skip the question/.test(q),
    user_said_bottom_line: /bottom line/.test(q),
    user_explicitly_said_run: /^\s*(run|execute|apply)\b/.test(q),
    is_prep_work: /\b(prep|prepare|set ?up|scaffold)\b/.test(q),
    requires_judgment: true,
  };
}

/**
 * Build the typed `directive` + `next_gate` for a methodology question.
 *
 * The directive is synthesized from the teaching graph:
 *   - framework: the best-matching Framework node for the question keyword.
 *   - questions: reframing questions derived from the framework's outbound
 *     FEEDS_INTO / chaining edges (each chain target becomes a "consider X"
 *     reframing prompt) plus the framework's own beautiful-question seed.
 *   - stage: the framework's phase/stage hint when the graph carries one.
 *   - next_gate.options: the chained frameworks as F.1 Next Move verbs.
 *
 * Returns null when the graph yields no framework match (caller then leaves
 * the directive unset and the wrapper produces its empty GUIDED scaffold -
 * the honest "nothing to teach here" signal).
 *
 * Cypher uses bound parameters ($keyword / $frameworkName / $limit), the
 * idiomatic neo4j-driver pattern - no string interpolation into the query.
 *
 * @param {object} session  open Neo4j READ session
 * @param {string} keyword
 * @param {number} limit
 * @returns {Promise<{directive: object, next_gate: object}|null>}
 */
async function buildDirectiveFromGraph(session, keyword, limit) {
  // 1. Best-matching Framework for this question.
  const fwCypher = `MATCH (f:Framework)
WHERE toLower(f.name) CONTAINS toLower($keyword)
   OR toLower(coalesce(f.description, '')) CONTAINS toLower($keyword)
RETURN f.name AS name,
       coalesce(f.description, '') AS description,
       coalesce(f.phase, f.stage, '') AS stage,
       coalesce(f.beautiful_question, '') AS beautiful_question
ORDER BY
  CASE WHEN toLower(f.name) CONTAINS toLower($keyword) THEN 0 ELSE 1 END,
  size(f.name)
LIMIT 1`;
  const fwResult = await session.run(fwCypher, { keyword: String(keyword) });
  if (fwResult.records.length === 0) return null;

  const fw = fwResult.records[0].toObject();
  const frameworkName = fw.name;

  // 2. Chained frameworks (outbound chaining edges) - these become both the
  //    reframing questions and the next_gate options. neo4j-driver requires
  //    an integer for a parameterized LIMIT, so wrap with neo4j.int().
  const chainLimit = Math.max(1, Math.min(Number(limit) || 5, 5));
  const chainCypher = `MATCH (a:Framework)-[r]->(b:Framework)
WHERE a.name = $frameworkName
  AND type(r) IN ['FEEDS_INTO','CHAINS_TO','CO_OCCURS','PRECEDES','NEXT']
RETURN b.name AS to,
       type(r) AS rel,
       coalesce(r.confidence, 0.0) AS confidence,
       coalesce(r.transform_description, '') AS transform
ORDER BY r.confidence DESC
LIMIT $limit`;
  const chainResult = await session.run(chainCypher, {
    frameworkName: String(frameworkName),
    limit: neo4j.int(chainLimit),
  });
  const chains = chainResult.records.map(r => r.toObject());

  // 3. Build reframing questions.
  const questions = [];
  if (fw.beautiful_question) {
    questions.push({
      ask: fw.beautiful_question,
      why: 'Beautiful question seeded by ' + frameworkName + ' (Berger 2014 framing).',
    });
  }
  for (const c of chains) {
    questions.push({
      ask: 'Would chaining into ' + c.to + ' sharpen this analysis?',
      why: c.transform
        ? c.transform
        : (frameworkName + ' ' + c.rel + ' ' + c.to
           + ' (confidence ' + Number(c.confidence).toFixed(2) + ').'),
      options: ['yes, chain into ' + c.to, 'no, stay on ' + frameworkName],
    });
  }
  // Always give Larry at least one reframing prompt so the directive is never
  // structurally empty when a framework matched.
  if (questions.length === 0) {
    questions.push({
      ask: 'What decision does applying ' + frameworkName + ' need to inform?',
      why: 'Anchors the methodology to a concrete navigator decision before running it.',
    });
  }

  const directive = {
    guided: {
      questions: questions,
      framework: frameworkName,
      stage: fw.stage || null,
    },
  };

  const next_gate = {
    sub_shape: 'F.1',
    options: chains.map(c => ({
      verb: 'Run Methodology',
      label: 'Chain into ' + c.to,
      framework: c.to,
      confidence: Number(c.confidence) || null,
    })),
  };

  return { directive: directive, next_gate: next_gate };
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
    'Ask the Brain anything in natural language. Returns a DirectiveEnvelope payload (populated directive + next_gate + mode_signals) synthesized from the teaching graph, plus supporting search results. Searches 23K methodology nodes and 12K semantic embeddings; automatically handles Pinecone semantic search with Neo4j Cypher fallback. Use this instead of brain_query or brain_search - it handles routing internally.',
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
        // Pinecone quota exhausted or other error - fall through to Neo4j
        if (msg.includes('resource_exhausted') || msg.includes('429') || msg.includes('quota')) {
          source = 'pinecone_quota_exhausted';
        }
        // Any other Pinecone error - also fall through
      }

      // --- Step 2: If Pinecone failed, use Neo4j Cypher ---
      if (!results || results.length === 0) {
        try {
          const pattern = selectPattern(question);
          const session = getNeo4j().session({ defaultAccessMode: neo4j.session.READ });
          try {
            const result = await session.run(pattern.cypher, {
              keyword: String(keyword),
              limit: neo4j.int(limit),
            });
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
                  suggestion: 'Brain is temporarily unavailable. MindrianOS works fully without it - all 46 commands, Data Room, graph, personas. Try again later or wait for Pinecone billing cycle reset.',
                }, null, 2),
              }],
              isError: true,
            };
          }
        }
      }

      // --- Step 3: Synthesize the DirectiveEnvelope directive from the graph ---
      // This is the methodology-reasoning payload the plugin's
      // directive-envelope wrapper passes through. Built independently of the
      // search backend above: even when Pinecone served the search hits, the
      // directive is derived from the Neo4j teaching graph (framework chaining
      // rules). A graph failure here degrades gracefully - the directive is
      // simply omitted and the wrapper produces its empty GUIDED scaffold.
      let directiveBlock = null;
      try {
        const dirSession = getNeo4j().session({ defaultAccessMode: neo4j.session.READ });
        try {
          directiveBlock = await buildDirectiveFromGraph(dirSession, keyword, limit);
        } finally {
          await dirSession.close();
        }
      } catch (err) {
        // Graph unreachable for directive synthesis - degrade gracefully.
        directiveBlock = null;
      }

      // --- Step 4: Return DirectiveEnvelope payload ---
      // Carries `directive` + `next_gate` + `mode_signals` for the plugin's
      // wrapper (lib/core/directive-envelope.cjs buildDirective pass-through),
      // plus the legacy `results` array for backward-compatible callers.
      const payload = {
        question,
        keyword,
        source,
        count: results ? results.length : 0,
        results: results || [],
        mode_signals: deriveModeSignals(question),
        ...(source.includes('fallback') ? {
          note: 'Pinecone embedding quota exhausted for this billing cycle. Results are from Neo4j Cypher queries (keyword-based, not semantic). Semantic search will resume when the quota resets.',
        } : {}),
      };

      if (directiveBlock) {
        payload.directive = directiveBlock.directive;
        payload.next_gate = directiveBlock.next_gate;
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(payload, null, 2),
        }],
      };
    }
  );
}

module.exports = {
  registerBrainAsk,
  // Exported for unit testing the directive-synthesis contract.
  buildDirectiveFromGraph,
  deriveModeSignals,
  extractKeyword,
};
