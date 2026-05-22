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

// ============================================================================
// Curated-op surface (BUG 2 fix -- D-MOAT-3 landing).
// ============================================================================
//
// `brain_ask` gains an optional `op` MODE. When set, the caller picks one of a
// closed set of named operations; the server resolves the op to a FROZEN
// server-side Cypher string and runs it READ-only, bounded by the D-MOAT-2
// caps. No new MCP tool is registered (the startup tool count stays at 6) and
// the tool stays ungated -- any valid key may call it (only brain_query /
// brain_write are admin-gated).
//
// Canon Part 8: every op returns only generic teaching methodology (framework
// names, descriptions, categories, typed edges, problem-type enums). Every
// input is a generic handle (framework name, closed enum, integer). NO caller
// Cypher is ever accepted -- the `MATCH (n) RETURN n` graph-copy attack stays
// blocked. The relationship type in `framework_edges` and the variable-length
// bound in `framework_chain_slice` are NEVER interpolated from caller input:
// each is a closed enum / a server-clamped integer that SELECTS one of a fixed
// set of pre-frozen Cypher strings. All other params are `$`-bound.
//
// FROZEN Cypher strings -- verbatim from .planning/brain-curated-ops-contract.md.
// Do not edit these without amending the contract.

// op 1 -- list_frameworks. Params: { limit? }. `limit` is `$`-bound.
const CURATED_LIST_FRAMEWORKS = `MATCH (f:Framework) WHERE f.name IS NOT NULL
RETURN f.name AS name,
       coalesce(f.description,'') AS description,
       coalesce(f.category,'') AS category
ORDER BY f.name LIMIT $limit`;

// op 2 -- framework_edges. The `edge_type` param is a CLOSED ENUM that selects
// one of these two frozen strings. The relationship type is never interpolated.
const CURATED_FRAMEWORK_EDGES = {
  FEEDS_INTO: `MATCH (a:Framework)-[r:FEEDS_INTO]->(b:Framework)
RETURN a.name AS from, b.name AS to,
       coalesce(r.confidence,0.0) AS confidence,
       coalesce(r.transform_description,'') AS transform
LIMIT $limit`,
  ADDRESSES_PROBLEM_TYPE: `MATCH (f:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType)
RETURN f.name AS framework, pt.name AS problem_type
LIMIT $limit`,
};

// op 3 -- framework_chain_slice. A variable-length relationship bound cannot be
// a bound param, so the server picks one of these three frozen variants by the
// server-CLAMPED integer max_hops (1..3). `seeds` IS `$`-bound.
const CURATED_FRAMEWORK_CHAIN_SLICE = {
  1: `MATCH path = (f:Framework)-[:FEEDS_INTO*1..1]->(g:Framework)
WHERE f.name IN $seeds
RETURN f.name AS from, g.name AS to, length(path) AS hop_distance
LIMIT $limit`,
  2: `MATCH path = (f:Framework)-[:FEEDS_INTO*1..2]->(g:Framework)
WHERE f.name IN $seeds
RETURN f.name AS from, g.name AS to, length(path) AS hop_distance
LIMIT $limit`,
  3: `MATCH path = (f:Framework)-[:FEEDS_INTO*1..3]->(g:Framework)
WHERE f.name IN $seeds
RETURN f.name AS from, g.name AS to, length(path) AS hop_distance
LIMIT $limit`,
};

// The closed op-name enum -- shared by the Zod schema and the resolver.
const CURATED_OP_NAMES = ['list_frameworks', 'framework_edges', 'framework_chain_slice'];

// D-MOAT-2 caps. Mirrors mcp-server-brain/lib/neo4j-tools.cjs CYPHER_LIMITS.
// neo4j-tools.cjs does not export its bounded-read helper, so the timeout +
// row cap + byte cap are replicated here inline (per the contract). Same env
// vars, same defaults, so the curated-op path is bounded identically.
const CURATED_CYPHER_LIMITS = {
  maxRows: Number(process.env.BRAIN_CYPHER_MAX_ROWS) || 1000,
  maxBytes: Number(process.env.BRAIN_CYPHER_MAX_BYTES) || 524288,
  timeoutMs: Number(process.env.BRAIN_CYPHER_TIMEOUT_MS) || 5000,
};

/**
 * Resolve a curated op + its caller params to a FROZEN Cypher string and a
 * `$`-bound parameter map. No caller string ever reaches the Cypher text.
 *
 * @param {string} op      one of CURATED_OP_NAMES
 * @param {object} params  caller params (passthrough object, validated here)
 * @returns {{ cypher: string, params: object }}
 * @throws {Error} on an unknown op or an invalid param value
 */
function resolveCuratedOp(op, params) {
  const p = (params && typeof params === 'object') ? params : {};
  // `limit` is server-clamped to [1, maxRows]; default maxRows.
  const rawLimit = Number(p.limit);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(Math.floor(rawLimit), CURATED_CYPHER_LIMITS.maxRows)
    : CURATED_CYPHER_LIMITS.maxRows;

  if (op === 'list_frameworks') {
    return {
      cypher: CURATED_LIST_FRAMEWORKS,
      params: { limit: neo4j.int(limit) },
    };
  }

  if (op === 'framework_edges') {
    const edgeType = String(p.edge_type || '');
    const cypher = CURATED_FRAMEWORK_EDGES[edgeType];
    if (!cypher) {
      throw new Error(
        'framework_edges: edge_type must be one of '
        + Object.keys(CURATED_FRAMEWORK_EDGES).join(' | '));
    }
    return { cypher: cypher, params: { limit: neo4j.int(limit) } };
  }

  if (op === 'framework_chain_slice') {
    const seeds = Array.isArray(p.seeds)
      ? p.seeds.filter(s => typeof s === 'string' && s.length > 0).map(String)
      : [];
    if (seeds.length === 0) {
      throw new Error('framework_chain_slice: seeds must be a non-empty string array');
    }
    // Server clamps max_hops to [1,3]; the clamped int (never caller text)
    // selects one of three frozen Cypher variants.
    const rawHops = Number(p.max_hops);
    const hops = Number.isFinite(rawHops)
      ? Math.max(1, Math.min(3, Math.floor(rawHops)))
      : 2;
    return {
      cypher: CURATED_FRAMEWORK_CHAIN_SLICE[hops],
      params: { seeds: seeds, limit: neo4j.int(limit) },
    };
  }

  throw new Error('unknown curated op "' + String(op) + '"');
}

/**
 * Run a curated op READ-only on a Neo4j session, bounded by the D-MOAT-2 caps
 * (read timeout + row cap + byte cap). Returns the curated-op payload shape.
 *
 * On any graph failure (driver error, timeout, oversized payload) returns the
 * degraded sentinel { op, source:'neo4j_curated', count:0, rows:[], degraded:true }
 * so the caller never crashes -- Tier 0 graceful degradation.
 *
 * @param {object} driver  Neo4j driver
 * @param {string} op      one of CURATED_OP_NAMES
 * @param {object} params  caller params
 * @returns {Promise<object>} the curated-op payload
 */
async function runCuratedOp(driver, op, params) {
  let resolved;
  try {
    resolved = resolveCuratedOp(op, params);
  } catch (err) {
    // A bad op / bad param value is a degraded result, not a thrown error --
    // the caller treats it the same as a graph failure (Tier 0 graceful).
    return { op: op, source: 'neo4j_curated', count: 0, rows: [], degraded: true };
  }

  const session = driver.session({ defaultAccessMode: neo4j.session.READ });
  try {
    // D-MOAT-2 read timeout: per-query transaction-config { timeout }.
    const result = await session.run(
      resolved.cypher,
      resolved.params,
      { timeout: CURATED_CYPHER_LIMITS.timeoutMs }
    );
    // D-MOAT-2 row cap: truncate before mapping.
    let records = result.records;
    if (records.length > CURATED_CYPHER_LIMITS.maxRows) {
      records = records.slice(0, CURATED_CYPHER_LIMITS.maxRows);
    }
    const rows = records.map(r => r.toObject());
    // D-MOAT-2 byte cap: an oversized payload degrades rather than returns.
    const probe = JSON.stringify(rows);
    if (probe.length > CURATED_CYPHER_LIMITS.maxBytes) {
      return { op: op, source: 'neo4j_curated', count: 0, rows: [], degraded: true };
    }
    return { op: op, source: 'neo4j_curated', count: rows.length, rows: rows };
  } catch (err) {
    // Graph unreachable / query error -- degrade gracefully.
    return { op: op, source: 'neo4j_curated', count: 0, rows: [], degraded: true };
  } finally {
    await session.close();
  }
}

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

// Generic question-phrasing words stripped before the token-fallback graph
// match. All generic English / methodology phrasing - never user content
// (Canon Part 8). Kept module-scope so it is built once.
const DIRECTIVE_STOPWORDS = new Set([
  'what', 'which', 'how', 'why', 'who', 'where', 'when', 'does', 'do', 'the',
  'for', 'from', 'with', 'that', 'this', 'should', 'would', 'could', 'use',
  'using', 'about', 'into', 'and', 'analysis', 'evaluate',
  'framework', 'frameworks', 'methodology', 'tool', 'tools', 'approach',
  'technique', 'techniques', 'chain', 'chains', 'chaining',
  // Imperative query-phrasing verbs - excluded so a short verb like "tell"
  // cannot substring-match an unrelated framework (e.g. "tell" in
  // "in[tell]igence"); the token match below is CONTAINS, not word-boundary.
  'tell', 'show', 'give', 'list', 'find', 'explain', 'describe',
  'suggest', 'recommend', 'best', 'help',
]);

/**
 * Build the typed `directive` + `next_gate` for a methodology question.
 *
 * Retrieval is two-pass against the LIVE teaching graph:
 *   1. Named-entity pass - find the methodology node whose own name appears
 *      verbatim as a substring of the question (inverse CONTAINS). Reliable
 *      because a navigator naming a methodology writes its name verbatim.
 *      Matches :Framework / :Technique / :Method / :Tool / :InnovationTool /
 *      :ValidationTool - the salient methodology noun is not always a
 *      :Framework node (e.g. "SWOT Analysis" is a :Technique).
 *   2. Token-fallback pass - when no name appears verbatim, match :Framework
 *      names against the question's generic content tokens, ranked by hits.
 *
 * The chain (directive.guided.questions + next_gate.options) is the anchor's
 * outbound FEEDS_INTO edges - the real framework-chaining edge in the graph
 * (176 of them; CO_OCCURS / CHAINS_TO / PRECEDES / NEXT do not exist between
 * frameworks, so matching them returned nothing - the pre-fix defect).
 *
 * Returns null only when BOTH passes find nothing - the honest
 * "nothing to teach here" signal; the wrapper then renders an empty scaffold.
 *
 * Cypher uses bound parameters only ($q / $tokens / $frameworkName / $limit) -
 * no string interpolation into the query.
 *
 * @param {object} session  open Neo4j READ session
 * @param {string} question full natural-language question
 * @param {number} limit
 * @returns {Promise<{directive: object, next_gate: object}|null>}
 */
async function buildDirectiveFromGraph(session, question, limit) {
  const q = String(question || '').toLowerCase();

  // 1. Named-entity pass - a methodology node whose name is IN the question.
  const namedCypher = `MATCH (f)
WHERE (f:Framework OR f:Technique OR f:Method OR f:Tool
       OR f:InnovationTool OR f:ValidationTool)
  AND f.name IS NOT NULL AND size(f.name) >= 4
  AND $q CONTAINS toLower(f.name)
RETURN f.name AS name,
       coalesce(f.description, '') AS description,
       coalesce(f.phase, f.stage, '') AS stage,
       coalesce(f.beautiful_question, '') AS beautiful_question
ORDER BY CASE WHEN 'Framework' IN labels(f) THEN 0 ELSE 1 END,
         size(f.name) DESC
LIMIT 1`;
  let fwResult = await session.run(namedCypher, { q: q });

  // 2. Token-fallback pass - rank :Framework names by content-token hits.
  if (fwResult.records.length === 0) {
    const tokens = Array.from(new Set(
      q.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
        .filter(t => t.length >= 4 && !DIRECTIVE_STOPWORDS.has(t))
    ));
    if (tokens.length === 0) return null;
    const tokenCypher = `MATCH (f:Framework)
WHERE f.name IS NOT NULL
  AND any(t IN $tokens WHERE toLower(f.name) CONTAINS t)
WITH f, size([t IN $tokens WHERE toLower(f.name) CONTAINS t]) AS hits
RETURN f.name AS name,
       coalesce(f.description, '') AS description,
       coalesce(f.phase, f.stage, '') AS stage,
       coalesce(f.beautiful_question, '') AS beautiful_question
ORDER BY hits DESC, size(f.name)
LIMIT 1`;
    fwResult = await session.run(tokenCypher, { tokens: tokens });
  }

  if (fwResult.records.length === 0) return null;

  const fw = fwResult.records[0].toObject();
  const frameworkName = fw.name;

  // 3. Chained methodologies - the anchor's outbound FEEDS_INTO edges. The
  //    anchor is matched by name (not label) so a :Technique anchor still
  //    chains. neo4j-driver requires an integer LIMIT, so wrap neo4j.int().
  const chainLimit = Math.max(1, Math.min(Number(limit) || 5, 5));
  const chainCypher = `MATCH (a)-[r:FEEDS_INTO]->(b)
WHERE a.name = $frameworkName AND b.name IS NOT NULL
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

  // 4. Build reframing questions.
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
    'Ask the Brain anything in natural language. Returns a DirectiveEnvelope payload (populated directive + next_gate + mode_signals) synthesized from the teaching graph, plus supporting search results. Searches 23K methodology nodes and 12K semantic embeddings; automatically handles Pinecone semantic search with Neo4j Cypher fallback. Use this instead of brain_query or brain_search - it handles routing internally. Also supports an optional curated-op MODE: pass `op` with one of "list_frameworks" (the framework catalogue: name + description + category), "framework_edges" (typed framework edges -- params.edge_type is "FEEDS_INTO" or "ADDRESSES_PROBLEM_TYPE"), or "framework_chain_slice" (FEEDS_INTO chains from params.seeds, params.max_hops 1-3); the curated path runs frozen parameterized Cypher (no caller Cypher) and returns { op, source, count, rows }.',
    {
      question: z.string().optional().describe('Natural language question about PWS methodology, frameworks, connections, grading, or any teaching content'),
      topK: z.number().optional().describe('Number of results (default 5)'),
      op: z.enum(['list_frameworks', 'framework_edges', 'framework_chain_slice']).optional()
        .describe('Curated-op mode. When set, runs a frozen parameterized Cypher op instead of the natural-language directive path.'),
      params: z.object({}).passthrough().optional()
        .describe('Curated-op params (generic handles only): { limit? } for list_frameworks; { edge_type, limit? } for framework_edges; { seeds, max_hops?, limit? } for framework_chain_slice.'),
    },
    async ({ question, topK, op, params }) => {
      // --- Curated-op MODE: when `op` is set, run the frozen Cypher and
      //     return the curated-op payload. The natural-language directive
      //     path below is NOT touched (op absent => behaves exactly as before).
      if (op) {
        const result = await runCuratedOp(getNeo4j(), op, params || {});
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        };
      }

      // Natural-language path requires `question`. With the curated-op MODE
      // added, `question` is schema-optional, so guard it here -- a call with
      // neither `op` nor `question` gets a clear error instead of a crash.
      if (typeof question !== 'string' || !question.trim()) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'brain_ask requires either a `question` (natural-language mode) or an `op` (curated-op mode)',
              ops: ['list_frameworks', 'framework_edges', 'framework_chain_slice'],
            }, null, 2),
          }],
          isError: true,
        };
      }

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
          directiveBlock = await buildDirectiveFromGraph(dirSession, question, limit);
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
  // Exported for unit testing the curated-op surface (BUG 2 fix). The frozen
  // Cypher maps are exported read-only so a test can assert no caller string
  // ever reaches the query text.
  resolveCuratedOp,
  runCuratedOp,
  CURATED_OP_NAMES,
  CURATED_LIST_FRAMEWORKS,
  CURATED_FRAMEWORK_EDGES,
  CURATED_FRAMEWORK_CHAIN_SLICE,
};
