'use strict';

/**
 * MindrianOS Brain-Driven Router
 *
 * 3-tier fallback for framework recommendations:
 *   Tier 1: In-memory cache (instant, 10-min TTL)
 *   Tier 2: Local heuristic from problem-types.md (~100ms)
 *   Tier 3: Brain API via brain-client.cjs (2s hard timeout)
 *
 * RECOMMENDS only -- never executes frameworks.
 * Called by orchestration router for act*, suggest-next commands.
 */

const path = require('path');
const { safeReadFile } = require('../core/index.cjs');

// ---------------------------------------------------------------------------
// Cache (Tier 1)
// ---------------------------------------------------------------------------

const CACHE_TTL = 600000; // 10 minutes
const CACHE_EVICT = CACHE_TTL * 2; // evict entries older than 20 min

/** @type {Map<string, { result: object, timestamp: number }>} */
const cache = new Map();

/**
 * Simple string hash (djb2). Fast, non-crypto, sufficient for cache keys.
 * @param {string} str
 * @returns {string}
 */
function fastHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

/**
 * Build cache key from room path + STATE.md content hash.
 * @param {string} roomDir
 * @param {string} stateContent
 * @returns {string}
 */
function buildCacheKey(roomDir, stateContent) {
  return `${roomDir}:${fastHash(stateContent || '')}`;
}

/**
 * Get a non-expired entry from cache.
 * @param {string} key
 * @returns {object|null}
 */
function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp >= CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.result;
}

/**
 * Store a result in cache.
 * @param {string} key
 * @param {object} result
 */
function setCache(key, result) {
  cache.set(key, { result, timestamp: Date.now() });
}

/**
 * Evict expired entries (called on each recommend()).
 */
function evictExpired() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.timestamp >= CACHE_EVICT) {
      cache.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Local Heuristic (Tier 2)
// ---------------------------------------------------------------------------

/**
 * Known methodology names for validation.
 */
const KNOWN_METHODOLOGIES = [
  'lean-canvas', 'think-hats', 'structure-argument', 'beautiful-question',
  'build-knowledge', 'challenge-assumptions', 'validate', 'map-unknowns',
  'diagnose', 'score-innovation', 'explore-domains', 'analyze-needs',
  'user-needs', 'analyze-systems', 'analyze-timing', 'find-bottlenecks',
  'root-cause', 'systems-thinking', 'macro-trends', 'explore-trends',
  'explore-futures', 'dominant-designs', 'scenario-plan',
  'find-connections', 'build-thesis', 'compare-ventures', 'research',
  'deep-grade', 'grade', 'leadership'
];

/**
 * Parse the 2D classification matrix from problem-types.md.
 * Returns a map: `${definition}:${complexity}` -> [methodology1, methodology2]
 * @returns {Map<string, string[]>}
 */
function parseRoutingTable() {
  const problemTypesPath = path.resolve(__dirname, '../../references/methodology/problem-types.md');
  const content = safeReadFile(problemTypesPath);
  if (!content) return new Map();

  const table = new Map();

  // Parse the markdown table rows
  // Format: | **Definition** | simple | complicated | complex | wicked |
  const lines = content.split('\n');
  const definitions = ['undefined', 'ill-defined', 'well-defined'];
  const complexities = ['simple', 'complicated', 'complex', 'wicked'];

  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    // Check if this is a data row (contains ** for definition level)
    const defMatch = line.match(/\*\*(Undefined|Ill-defined|Well-defined)\*\*/i);
    if (!defMatch) continue;

    const defLevel = defMatch[1].toLowerCase();
    // Split cells by | and extract methodology lists
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    // cells[0] = definition label, cells[1..4] = simple, complicated, complex, wicked

    for (let i = 1; i < cells.length && i - 1 < complexities.length; i++) {
      const cell = cells[i];
      // Extract methodology names (comma-separated, possibly with backticks)
      const methodNames = cell
        .replace(/\*\*/g, '')
        .split(',')
        .map(m => m.trim().replace(/`/g, ''))
        .filter(m => m && KNOWN_METHODOLOGIES.includes(m));

      if (methodNames.length > 0) {
        table.set(`${defLevel}:${complexities[i - 1]}`, methodNames);
      }
    }
  }

  return table;
}

/** @type {Map<string, string[]>|null} */
let routingTableCache = null;

/**
 * Get the routing table (parsed once, cached in memory).
 * @returns {Map<string, string[]>}
 */
function getRoutingTable() {
  if (!routingTableCache) {
    routingTableCache = parseRoutingTable();
  }
  return routingTableCache;
}

/**
 * Extract definition level and complexity from STATE.md content.
 * @param {string} stateContent
 * @returns {{ definition: string, complexity: string }}
 */
function extractProblemType(stateContent) {
  let definition = 'undefined';
  let complexity = 'complex';

  if (stateContent) {
    // Look for frontmatter fields
    const defMatch = stateContent.match(/definition_level:\s*(.+)/i)
      || stateContent.match(/problem_definition:\s*(.+)/i);
    if (defMatch) {
      const val = defMatch[1].trim().toLowerCase();
      if (val.includes('well')) definition = 'well-defined';
      else if (val.includes('ill')) definition = 'ill-defined';
      else if (val.includes('undef')) definition = 'undefined';
    }

    const compMatch = stateContent.match(/complexity:\s*(.+)/i)
      || stateContent.match(/problem_type:\s*(.+)/i);
    if (compMatch) {
      const val = compMatch[1].trim().toLowerCase();
      if (val.includes('simple')) complexity = 'simple';
      else if (val.includes('complicated')) complexity = 'complicated';
      else if (val.includes('wicked')) complexity = 'wicked';
      else if (val.includes('complex')) complexity = 'complex';
    }

    // Infer from venture_stage if explicit fields not found
    if (!defMatch) {
      const stageMatch = stateContent.match(/venture_stage:\s*(.+)/i);
      if (stageMatch) {
        const stage = stageMatch[1].trim().toLowerCase();
        if (stage === 'discovery' || stage === 'ideation') definition = 'undefined';
        else if (stage === 'validation' || stage === 'problem-fit') definition = 'ill-defined';
        else if (stage === 'growth' || stage === 'scaling' || stage === 'execution') definition = 'well-defined';
      }
    }
  }

  return { definition, complexity };
}

/**
 * Local heuristic routing: match room state to problem-types.md matrix.
 * @param {string} roomDir
 * @param {string} stateContent
 * @param {string} [intent]
 * @returns {object} Recommendation result
 */
function localRoute(roomDir, stateContent, intent) {
  const table = getRoutingTable();
  const { definition, complexity } = extractProblemType(stateContent);
  const key = `${definition}:${complexity}`;

  const chain = table.get(key);

  if (chain && chain.length > 0) {
    return {
      chain,
      confidence: 0.6,
      source: 'local',
      reasoning: `Matched problem type: ${definition} definition, ${complexity} complexity. ` +
        `Routing via problem-types.md classification matrix.`,
      target_sections: []
    };
  }

  // Fallback: could not match matrix cell
  return {
    chain: ['diagnose', 'lean-canvas'],
    confidence: 0.3,
    source: 'local-fallback',
    reasoning: 'Default recommendation - could not parse room state or match to routing table. ' +
      'Diagnose first, then lean-canvas for structure.',
    target_sections: []
  };
}

// ---------------------------------------------------------------------------
// Brain API (Tier 3)
// ---------------------------------------------------------------------------

/**
 * Call Brain API for framework recommendation.
 * @param {string} roomDir
 * @param {string} stateContent
 * @param {string} [intent]
 * @returns {Promise<object|null>}
 */
async function brainRoute(roomDir, stateContent, intent) {
  let brainClient;
  try {
    brainClient = require('../core/brain-client.cjs');
  } catch (_e) {
    return null;
  }

  if (!brainClient.isAvailable()) return null;

  // Query Brain for framework recommendations based on room state
  const { definition, complexity } = extractProblemType(stateContent);

  const cypher = `
    MATCH (pt:ProblemType)<-[:ADDRESSES_PROBLEM_TYPE]-(f:Framework)
    WHERE pt.name CONTAINS "${complexity}"
    WITH f, pt
    OPTIONAL MATCH (f)-[co:CO_OCCURS]->(f2:Framework)
    RETURN f.name AS primary, collect(DISTINCT f2.name)[..3] AS chain,
           pt.name AS problem_type
    LIMIT 3
  `;

  const result = await brainClient.query(cypher);

  if (result && result.records && result.records.length > 0) {
    const rec = result.records[0];
    const primary = rec.primary || rec[0];
    const chainNames = rec.chain || rec[1] || [];
    const fullChain = [primary, ...chainNames].filter(Boolean);

    // Map Brain framework names to CLI command names
    const mappedChain = fullChain
      .map(name => {
        const normalized = name.toLowerCase().replace(/[^a-z-]/g, '');
        return KNOWN_METHODOLOGIES.find(m => m === normalized || normalized.includes(m))
          || normalized;
      })
      .filter(Boolean)
      .slice(0, 4);

    if (mappedChain.length > 0) {
      return {
        chain: mappedChain,
        confidence: 0.85,
        source: 'brain',
        reasoning: `Brain recommends ${mappedChain.join(' -> ')} for ${definition} ${complexity} problem. ` +
          `Based on teaching graph framework-to-problem-type relationships.`,
        target_sections: []
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get a framework recommendation for a room.
 * 3-tier fallback: cache -> local heuristic -> Brain API (2s timeout).
 *
 * @param {string} roomDir - Path to room directory
 * @param {{ intent?: string, mode?: string }} [options]
 * @returns {Promise<{ chain: string[], confidence: number, source: string, reasoning: string, target_sections: string[] }>}
 */
async function recommend(roomDir, options = {}) {
  const { intent } = options;

  // Evict expired cache entries
  evictExpired();

  // Read current room state
  let stateContent = '';
  try {
    const stateOps = require('../core/state-ops.cjs');
    stateContent = stateOps.getState(roomDir) || '';
  } catch (_e) {
    // No state available - continue with empty
  }

  // Tier 1: Cache check
  const cacheKey = buildCacheKey(roomDir, stateContent);
  const cached = getFromCache(cacheKey);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  // Tier 2: Local heuristic (always computed as fallback)
  const localRec = localRoute(roomDir, stateContent, intent);

  // Tier 3: Brain API (2s timeout, non-blocking)
  try {
    const brainRec = await Promise.race([
      brainRoute(roomDir, stateContent, intent),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
    ]);
    if (brainRec) {
      setCache(cacheKey, brainRec);
      return brainRec;
    }
  } catch (_e) {
    // Brain unavailable or timeout - use local
  }

  setCache(cacheKey, localRec);
  return localRec;
}

/**
 * Validate a framework chain.
 * Checks that each methodology name is known.
 *
 * @param {string} roomDir - Path to room directory (unused currently, reserved for future)
 * @param {string[]} chain - Array of methodology names
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateChain(roomDir, chain) {
  if (!Array.isArray(chain) || chain.length === 0) {
    return { valid: false, reason: 'Chain must be a non-empty array of methodology names.' };
  }

  const unknown = chain.filter(m => !KNOWN_METHODOLOGIES.includes(m));
  if (unknown.length > 0) {
    return {
      valid: false,
      reason: `Unknown methodologies: ${unknown.join(', ')}. ` +
        `Known: ${KNOWN_METHODOLOGIES.join(', ')}`
    };
  }

  return { valid: true };
}

module.exports = { recommend, validateChain };
