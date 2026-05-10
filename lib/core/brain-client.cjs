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

// Phase 87-07 (CASCADE-06): Brain session cache with 5-minute TTL.
// Every callTool() previously re-ran the `initialize` handshake (~1 network
// round-trip). With a long-lived MCP server this is wasted work -- sessions
// live longer than the ~60s transport timeout. Cache the initialized
// sessionId (keyed by api-key-hash) for 5 minutes.
//
// R-87-07-RACE (audit): two concurrent callTool() invocations with the same
// api_key previously both saw a cache miss, both initialized, and the second
// overwrote the first -- one of the two initialize handshakes was wasted.
// Fix: cache the init *Promise*, not the resolved session. The first caller
// stores { promise: initSession(apiKey), expiresAt }; concurrent callers
// within the TTL `await entry.promise`. On rejection we remove the entry so
// the next caller re-initializes fresh.
//
// Hash: sha256 truncated to 16 hex chars (64 bits of key space, zero realistic
// collision). A cheaper non-crypto hash was considered but its narrower int
// space has non-zero collision probability once the design extends across
// users; sha256 is effectively free at these volumes and eliminates the
// concern entirely (R-87-07-RACE).
const crypto = require('node:crypto');
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes
/** @type {Map<string, {promise: Promise<string>, expiresAt: number}>} */
const sessionCache = new Map();

function _hashKey(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex').slice(0, 16);
}

/**
 * SEC-01: Sanitize any user-origin string before interpolation into a
 * Cypher query. Whitelist from 87-CONTEXT.md lines 121-127:
 *   [a-zA-Z0-9 ._-]
 * Every other char (including `"`, `'`, backtick, newline, `{`, `}`, `$`,
 * `\`, `;`, `/`, `*`) is stripped. Null/undefined return ''. Non-strings
 * are coerced via String() defensively so the caller never crashes.
 *
 * This replaces the legacy single-quote-escape pattern that only
 * escaped one metacharacter (double-quote) and was trivially bypassable
 * via backticks, newlines, `${...}` expansions, or Cypher comments.
 *
 * @param {*} value
 * @returns {string}
 */
function sanitizeCypherInput(value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') {
    try { value = String(value); } catch (_e) { return ''; }
  }
  return value.replace(/[^a-zA-Z0-9 ._-]/g, '');
}

/**
 * SEC-02: Refuse to load a Brain API key from a .env file whose permissions
 * expose it to group or world readers. Unix semantics only -- on Windows
 * POSIX mode bits are not meaningful for NTFS ACLs, so we return true and
 * warn once per process.
 *
 *   mode & 0o077 !== 0  =>  any group/world bit is set  =>  reject
 *   mode 0o600 (-rw-------) and 0o400 (-r--------) pass; 0o644, 0o664 fail.
 *
 * On stat failure we return false (no key beats a key we cannot verify).
 *
 * @param {string} envPath
 * @returns {boolean}
 */
function checkFilePermissions(envPath) {
  try {
    const fs = require('fs');
    if (process.platform === 'win32') {
      if (!checkFilePermissions._warned) {
        process.stderr.write(
          '[mindrian-os] Note: API key file permission check is Linux/macOS only; '
          + 'on Windows rely on NTFS ACLs.\n'
        );
        checkFilePermissions._warned = true;
      }
      return true;
    }
    const stat = fs.statSync(envPath);
    if ((stat.mode & 0o077) !== 0) {
      process.stderr.write(
        `[mindrian-os] Refusing to load API key from ${envPath}: `
        + `permissions too open (must be 0600). chmod 600 ${envPath}\n`
      );
      return false;
    }
    return true;
  } catch (_e) {
    return false;
  }
}
checkFilePermissions._warned = false;

/**
 * Get the Brain API key from environment.
 * Checks: MINDRIAN_BRAIN_KEY, then falls back to reading .env in CWD.
 * Every .env candidate path is gated by checkFilePermissions (SEC-02).
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
    if (fs.existsSync(envPath) && checkFilePermissions(envPath)) {
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
    if (fs.existsSync(globalEnvPath) && checkFilePermissions(globalEnvPath)) {
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
 * Phase 87-07: ensure we have a valid initialized Brain session for the given
 * api key, reusing the cached one if non-expired. Uses the pending-promise
 * pattern so concurrent callers share a single in-flight init (R-87-07-RACE).
 *
 * Returns the resolved session marker (an opaque string -- the Brain Streamable
 * HTTP transport does not require us to echo a sessionId on subsequent requests
 * inside the same cache window, but awaiting this promise proves the key is
 * valid against the Brain endpoint exactly once per TTL window).
 *
 * On any init rejection (network error, 401, etc.) the cache entry is removed
 * in the .catch() tail so the next caller retries fresh rather than inheriting
 * a poisoned promise.
 *
 * Sentinel `{ error: 'invalid_key' }` is returned *through* the promise (not
 * thrown) so callers treat 401 identically to the pre-cache flow.
 *
 * @param {string} apiKey
 * @returns {Promise<string|{error:string,message:string}|null>}
 */
async function _ensureSession(apiKey) {
  const keyHash = _hashKey(apiKey);
  const cached = sessionCache.get(keyHash);
  if (cached && cached.expiresAt > Date.now()) {
    // Cache hit. Works whether the promise is still pending (concurrent init
    // in flight) or already resolved (TTL reuse). Awaiting a resolved promise
    // is a microtask no-op, so the fast path stays fast.
    return cached.promise;
  }
  // Cache miss. Build the promise FIRST, install it in the cache BEFORE the
  // first real await, so concurrent callers within the same event-loop tick
  // see the same in-flight promise (R-87-07-RACE pending-promise pattern).
  const promise = (async () => {
    const initRes = await fetch(`${BRAIN_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${apiKey}`,
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
      if (initRes.status === 401) {
        return { error: 'invalid_key', message: 'Brain API key is invalid.' };
      }
      // Any other non-OK status becomes a throw so the cache entry is purged
      // by the .catch() below and the next caller retries.
      throw new Error(`Brain init HTTP ${initRes.status}`);
    }
    // Opaque session marker. Subsequent tools/call requests don't need to
    // echo this back -- the transport is stateless at the HTTP level. What
    // matters is that we validated the key is live within this TTL window.
    return 'validated-' + Date.now();
  })();
  sessionCache.set(keyHash, { promise, expiresAt: Date.now() + SESSION_TTL_MS });
  // On reject, purge the entry so the next caller initializes fresh. Swallow
  // here (we re-throw in the awaiter below) so Node doesn't see an
  // unhandledRejection on the cache handle itself.
  promise.catch(() => { sessionCache.delete(keyHash); });
  return promise;
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
    // Phase 87-07: reuse cached Brain session (5-min TTL) instead of
    // re-running initialize on every callTool. Concurrent callers share
    // the in-flight promise via the pending-promise pattern.
    const session = await _ensureSession(key);
    if (session && typeof session === 'object' && session.error === 'invalid_key') {
      return session;
    }
    if (!session) return null;

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
 * This does NOT use Pinecone, no embedding quota consumed.
 *
 * NOTE (Finding I, v1.10.9 hotfix 2026-04-15): the Brain MCP brain_query
 * tool expects the parameter name `cypher`, not `query`. Previously this
 * function sent { query: cypher } which tripped an MCP input validation
 * error (code -32602, path ["cypher"], "Required"). Downstream scripts
 * like fetch-brain-baseline.cjs and compute-whitespace-gaps.py then
 * silently fell through to empty-baseline mode even though Brain was
 * fully reachable and the key was valid. Witnessed against the live
 * iia-deeptech-centers room on 2026-04-15. brain_search uses `query`
 * which is why Pinecone semantic search kept working and masked this.
 *
 * NOTE (2026-05-11, graph-on-graph P0): `query` now accepts an optional
 * second argument `params` and forwards it to the `brain_query` MCP tool
 * as { cypher, params }. The Brain tool declares `params:
 * z.record(z.any()).optional()`, so a parameterized Cypher gets its
 * bindings through cleanly. `params` MUST be a generic-handles-only object
 * — framework names, phase identifiers, problem types per Canon Part 8 —
 * NEVER user content (artifact bodies, meeting text, personal identifiers,
 * proprietary numbers). Previously the second arg was silently dropped, so
 * callers (rs-explain-command.cjs, rs-thesis-command.cjs, rs-nl-to-query)
 * that generated parameterized Cypher had their bindings disappear or were
 * pushed toward unsafe string interpolation. A param-less call still sends
 * only { cypher } and behaves exactly as before.
 */
async function query(cypher, params) {
  const args = { cypher: cypher };
  if (params && typeof params === 'object' && Object.keys(params).length > 0) {
    args.params = params;
  }
  return callTool('brain_query', args);
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
    const neo4jResult = await query(cypher.replace('$query', `"${sanitizeCypherInput(queryText)}"`));
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
 * suitable for writing to local SQLite graph as CAUSES/ROOT_CAUSE_OF edges.
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

  // SEC-01 defence-in-depth: coerce + bound numeric interpolants so a hostile
  // non-number (e.g. an object with .toString() side-effects) cannot reach
  // the Cypher string.
  const maxDepth = Math.max(1, Math.min(10, Number(options.maxChainDepth) || 3));
  const minConf = Math.max(0, Math.min(1, Number(options.minConfidence) || 0.5));
  const keywordFilter = sectionKeywords && sectionKeywords.length > 0
    ? sectionKeywords.map(k => `"${sanitizeCypherInput(k)}"`).join(', ')
    : '';

  // Query 1: Direct causal relationships from framework chains
  const causesCypher = `
    MATCH (f1:Framework)-[r:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType)
    WHERE pt.name CONTAINS "${sanitizeCypherInput(problemType || '')}"
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
  // SEC-01 defence-in-depth: bound topK numeric interpolation.
  const topK = Math.max(1, Math.min(100, Number(options.topK) || 5));

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
  const safeProblemType = sanitizeCypherInput(problemType || '');
  const avoidClause = avoidPatterns.length > 0
    ? `AND NOT ANY(avoid IN [${avoidPatterns.map(a => `"${sanitizeCypherInput(a)}"`).join(', ')}] WHERE f.name CONTAINS avoid)`
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

/**
 * Suggest validation steps for a banked opportunity using Brain framework chains.
 *
 * Queries Brain Neo4j for frameworks that ADDRESSES_PROBLEM_TYPE matching the
 * opportunity's domain/problem, then follows FEEDS_INTO chains to build a
 * suggested validation sequence.
 *
 * @param {Object} opportunity - Opportunity object with at minimum: problem, domain, knight_position
 * @param {Object} [options] - Optional config
 * @param {number} [options.maxSteps=5] - Maximum validation steps to return
 * @param {number} [options.chainDepth=3] - Maximum FEEDS_INTO chain depth
 * @returns {Promise<{ steps: Array<{framework: string, reason: string, order: number}>, chain_source: string } | null>}
 *   Returns null if Brain unavailable (Tier 0 graceful degradation)
 */
async function suggestValidationSteps(opportunity, options = {}) {
  if (!isAvailable()) return null;
  if (!opportunity || !opportunity.problem) return null;

  const maxSteps = options.maxSteps || 5;
  const chainDepth = options.chainDepth || 3;
  const safeProblem = sanitizeCypherInput(opportunity.problem || '').substring(0, 200);
  const safeDomain = sanitizeCypherInput(opportunity.domain || '').substring(0, 100);
  const safeKnight = opportunity.knight_position || 'uncertainty';

  // Query 1: Find frameworks that address this problem type / domain
  const matchCypher = `
    MATCH (f:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType)
    WHERE pt.name CONTAINS "${safeDomain}"
       OR pt.description CONTAINS "${safeDomain}"
    RETURN f.name AS name, f.description AS description
    LIMIT 10
  `;

  // Query 2: Follow FEEDS_INTO chains from matched frameworks
  const chainCypher = `
    MATCH (f:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType)
    WHERE pt.name CONTAINS "${safeDomain}"
       OR pt.description CONTAINS "${safeDomain}"
    WITH f LIMIT 3
    MATCH path = (f)-[:FEEDS_INTO*1..${chainDepth}]->(next:Framework)
    RETURN f.name AS start_framework,
           next.name AS next_framework,
           next.description AS next_description,
           length(path) AS depth
    ORDER BY depth ASC
    LIMIT ${maxSteps * 2}
  `;

  try {
    const [matchResult, chainResult] = await Promise.all([
      query(matchCypher),
      query(chainCypher),
    ]);

    const steps = [];
    const seen = new Set();

    // First: add the entry-point frameworks
    if (matchResult && Array.isArray(matchResult.records)) {
      for (const rec of matchResult.records) {
        const name = rec.name || rec[0];
        if (name && !seen.has(name) && steps.length < maxSteps) {
          seen.add(name);
          steps.push({
            framework: name,
            reason: safeKnight === 'uncertainty'
              ? `Explore this ${safeDomain} uncertainty with ${name}`
              : `Validate this ${safeDomain} risk using ${name}`,
            order: steps.length + 1,
          });
        }
      }
    }

    // Then: add FEEDS_INTO chain steps
    if (chainResult && Array.isArray(chainResult.records)) {
      for (const rec of chainResult.records) {
        const name = rec.next_framework || rec[1];
        const desc = rec.next_description || rec[2] || '';
        if (name && !seen.has(name) && steps.length < maxSteps) {
          seen.add(name);
          steps.push({
            framework: name,
            reason: desc ? `Then apply ${name}: ${desc.substring(0, 120)}` : `Then apply ${name} (follows from chain)`,
            order: steps.length + 1,
          });
        }
      }
    }

    if (steps.length === 0) return null;

    return {
      steps,
      chain_source: 'brain_feeds_into',
    };
  } catch (err) {
    // Brain query failed -- graceful degradation
    return null;
  }
}

/**
 * Write Cypher to Neo4j via Brain (write operations).
 * Used by sync-rooms-brain for creating Room/RoomGroup nodes and edges.
 * Returns null if Brain is unavailable -- never throws.
 *
 * NOTE (Finding I sibling, v1.10.9 hotfix 2026-04-15): same param-name
 * mismatch as brain_query had. Brain MCP brain_write expects `cypher`,
 * not `query`. This function had the mirror bug since inception but
 * never fired in production because sync-rooms-brain is rarely invoked
 * against the live Brain. Caught by the plan-checker audit for Phase 85.
 *
 * @param {string} cypher - Cypher write query
 * @returns {Promise<object|null>}
 */
async function write(cypher) {
  return callTool('brain_write', { cypher: cypher });
}

/**
 * Tier 0 fallback: hardcoded persona framework chains.
 * Used when Brain is unavailable or query returns no results.
 *
 * @param {string} persona - 'tto', 'researcher', or 'business'
 * @returns {{ persona: string, chain: Array<{framework: string, description: string, order: number}>, source: 'tier0' }}
 */
function getTier0Chain(persona) {
  const chains = {
    tto: [
      { framework: 'Domain Exploration', description: 'What domains could this technology touch?', order: 1 },
      { framework: 'Problem Definition', description: 'What specific problems does it solve?', order: 2 },
      { framework: 'JTBD Analysis', description: 'Who needs this solved and what progress do they want?', order: 3 },
      { framework: 'Value Proposition', description: 'What is the value and how to deliver it?', order: 4 },
    ],
    researcher: [
      { framework: 'Problem Exploration', description: 'What problem does the research address?', order: 1 },
      { framework: 'JTBD Analysis', description: 'Who cares about this problem?', order: 2 },
      { framework: 'Value Proposition', description: 'What would a solution look like?', order: 3 },
      { framework: 'Lean Canvas', description: 'How to deliver and sustain this?', order: 4 },
    ],
    business: [
      { framework: 'Opportunity Recognition', description: 'What opportunity exists in the market?', order: 1 },
      { framework: 'Market Analysis', description: 'How big is this market?', order: 2 },
      { framework: 'Problem Definition', description: 'What specific problem for whom?', order: 3 },
      { framework: 'Competitive Analysis', description: 'Who else is trying and what is your edge?', order: 4 },
    ],
  };

  return {
    persona: persona,
    chain: chains[persona] || chains.researcher,
    source: 'tier0',
  };
}

/**
 * Get ordered framework chain for a persona.
 *
 * Brain-connected: queries FEEDS_INTO edges for dynamic chains.
 * Brain-unavailable: returns Tier 0 hardcoded chains from getTier0Chain().
 *
 * Per CONV-02: Persona-aware chain routing.
 * Per CONV-03: Brain framework chain selection with Tier 0 fallback.
 *
 * @param {string} persona - 'tto', 'researcher', or 'business' (case-insensitive)
 * @returns {Promise<{ persona: string, chain: Array<{framework: string, description: string, order: number}>, source: 'brain'|'tier0' }>}
 */
async function getFrameworkChain(persona) {
  const personaLower = (persona || '').toLowerCase();

  // Persona-to-entry-framework mapping
  const entryMap = {
    tto: 'Domain Exploration',
    researcher: 'Problem Exploration',
    business: 'Opportunity Recognition',
  };

  const entryFramework = entryMap[personaLower];
  if (!entryFramework) {
    // Unknown persona - fall back to Tier 0 default (researcher chain)
    return getTier0Chain('researcher');
  }

  // Try Brain first
  if (isAvailable()) {
    try {
      const safeEntry = sanitizeCypherInput(entryFramework);
      const cypher = `
        MATCH path = (start:Framework)-[:FEEDS_INTO*1..4]->(next:Framework)
        WHERE start.name CONTAINS "${safeEntry}"
        RETURN start.name AS start_name,
               [n IN nodes(path) | n.name] AS chain,
               [n IN nodes(path) | n.description] AS descriptions,
               length(path) AS depth
        ORDER BY depth ASC
        LIMIT 5
      `;
      const result = await query(cypher);

      if (result && Array.isArray(result.records) && result.records.length > 0) {
        // Build ordered chain from longest path
        const longestPath = result.records[result.records.length - 1];
        const chain = longestPath.chain || longestPath[1] || [];
        const descriptions = longestPath.descriptions || longestPath[2] || [];

        if (chain.length > 0) {
          return {
            persona: personaLower,
            chain: chain.map((name, i) => ({
              framework: name,
              description: descriptions[i] || '',
              order: i + 1,
            })),
            source: 'brain',
          };
        }
      }
    } catch (err) {
      // Brain query failed - fall through to Tier 0
    }
  }

  // Tier 0 fallback
  return getTier0Chain(personaLower);
}

module.exports = {
  isAvailable,
  getApiKey,
  callTool,
  query,
  write,
  search,
  smartSearch,
  schema,
  stats,
  enrichCausalEdges,
  hatAwareRecommend,
  suggestValidationSteps,
  getFrameworkChain,
  // SEC-01/SEC-02 + CASCADE-06 test surface: not part of the public API.
  // See lib/memory/security-trifecta.test.cjs + brain-cache-lru.test.cjs.
  // Helpers are small and pure. sessionCache + _ensureSession + _hashKey +
  // SESSION_TTL_MS are exposed for Phase 87-07 cache-behavior tests.
  _test: {
    sanitizeCypherInput,
    checkFilePermissions,
    sessionCache,
    SESSION_TTL_MS,
    _hashKey,
    _ensureSession,
  },
};
