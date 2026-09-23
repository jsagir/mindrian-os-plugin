'use strict';

/**
 * MindrianOS Brain-Driven Router
 *
 * 3-tier fallback for framework recommendations:
 *   Tier 1: In-memory cache (instant, 10-min TTL)
 *   Tier 2: Local heuristic from problem-types.md (~100ms)
 *   Tier 3: Brain API via brain-client.cjs (bound: MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS, default 6000ms -- lib/mcp/brain-route-bound.cjs)
 *
 * RECOMMENDS only -- never executes frameworks.
 * Called by orchestration router for act*, suggest-next commands.
 */

const path = require('path');
const { safeReadFile } = require('../core/index.cjs');
// Quick 260911-ddd (DDD-02): the single source of the Tier 3 race bound.
// See brain-route-bound.cjs's header for the measured 6000 ms justification
// and brain-composition-census.cjs, whose bound_ms entry reads this SAME
// leaf. brain-composition-census provenance: this file's Tier 3 race is
// enumerated in lib/mcp/brain-composition-census.cjs.
const { BRAIN_ROUTE_TIMEOUT_MS, resolveBrainRouteTimeoutMs } = require('./brain-route-bound.cjs');

// ---------------------------------------------------------------------------
// Cache (Tier 1)
// ---------------------------------------------------------------------------

const CACHE_TTL = 600000; // 10 minutes
const CACHE_EVICT = CACHE_TTL * 2; // evict entries older than 20 min

/** @type {Map<string, { result: object, timestamp: number }>} */
const cache = new Map();

/** Counters for cache performance monitoring */
let cacheHits = 0;
let recommendCalls = 0;
const EVICT_INTERVAL = 100; // Sweep expired entries every 100 recommend() calls

// ---------------------------------------------------------------------------
// Phase 339 Plan 05 (D-03b), 2026-09-03: Tier-3 shape-miss disclosure carrier
// ---------------------------------------------------------------------------
// A closed-vocabulary note (never free prose, never interpolated from
// brainResult) naming the ONE new distinguishable cause of a Tier-3 miss:
// the Brain answered but its response carried no `next_gate` shape. `null`
// means either "no miss occurred" or "the miss was some other, already-
// disclosed cause" (e.g. no_key, handled separately by the Phase 252-01
// block below). brainRoute() resets this to null at its own entry and sets
// it only immediately before returning null for THIS specific cause;
// recommend() reads and clears it in the SAME synchronous continuation
// right after its own Promise.race settles, so a value can only ever be
// read back by the SAME recommend() call whose brainRoute() invocation set
// it. Best-effort, diagnostic only: never blocks a return, never replaces
// an existing key.
const BRAIN_ROUTE_NOTE_NO_NEXT_GATE = 'answered_no_next_gate';
let _lastBrainRouteMissNote = null;

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
 * _rungFromClassification(definition, complexity) -> one of Theo's four rung
 * ids, or null.
 *
 * 354-09 (THEO-01 classification round trip): the room's STATE.md is already
 * classified (extractProblemType above) BEFORE this module ever asks the
 * Brain anything. The bug this fixes: brainRoute used to fold that
 * classification into a generated English sentence
 * ("recommend a framework for a X definition Y problem") and hand only the
 * sentence to brainClient.ask(); brain-client's own
 * `_inferRungFromQuestion` then re-derived a rung from that sentence's
 * words, but the sentence never contains any of `_inferRungFromQuestion`'s
 * markers, so every case landed on its `IllDefined` default regardless of
 * the room's real classification. This helper computes the SAME rung
 * structurally, so it can be handed to `ask(question, { problem_type })`
 * and cross the module boundary as a typed enum instead of prose the far
 * side has to re-guess.
 *
 * Precedence mirrors `_rungFromClassification`'s Theo-side counterpart:
 * `complexity === 'wicked'` wins outright (the orthogonal stakeholder-
 * conflict axis), then `definition` maps directly onto its Theo rung.
 * Anything else (an unrecognized definition, e.g. still 'complicated'-only
 * complexity with no definition match) returns null -- the caller then
 * falls back to `_inferRungFromQuestion`'s inference, never a throw.
 *
 * @param {string} definition - 'undefined' | 'ill-defined' | 'well-defined' | anything else
 * @param {string} complexity - 'simple' | 'complicated' | 'complex' | 'wicked' | anything else
 * @returns {'Wicked'|'UnDefined'|'IllDefined'|'WellDefined'|null}
 */
function _rungFromClassification(definition, complexity) {
  if (complexity === 'wicked') return 'Wicked';
  if (definition === 'undefined') return 'UnDefined';
  if (definition === 'ill-defined') return 'IllDefined';
  if (definition === 'well-defined') return 'WellDefined';
  return null;
}

/**
 * Call Brain API for framework recommendation via brain_ask (ungated).
 * Replaced the former raw-Cypher brain_query path (admin-gated, BUG 2)
 * with brain.ask(question) -- valid for all API keys.
 * Reads next_gate.options[].framework for the ranked chain, then filters it
 * to EXACT KNOWN_METHODOLOGIES slugs only (354-09, THEO-01 executable-chain
 * validation) -- a framework LABEL like "Design Thinking" never enters the
 * chain, it travels in the separate `frameworks` array; a candidate that is
 * not an exact registry slug is recorded in `rejected_candidates`, never
 * fuzzy-mapped into an invalid command id (the prior bug: `designthinking`,
 * `build-mvp`).
 * Canon Part 8: the NL question carries only the generic problem-type enum,
 * never user content or artifact text.
 *
 * @param {string} roomDir
 * @param {string} stateContent
 * @param {string} [intent]
 * @returns {Promise<object|null>}
 */
// Phase 254 (COMP-01): this call is enumerated in
// lib/mcp/brain-composition-census.cjs as the 'orchestration (act,
// act-chain, act-dry-run, act-swarm)' reaching site -- reaches_brain: true,
// belt: 'callTool', bound_ms: BRAIN_ROUTE_TIMEOUT_MS (Quick 260911-ddd,
// DDD-02; the Promise.race wrap in recommend() below, default 6000ms,
// overridable via MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS). D-01 (254-CONTEXT.md)
// ratified this as SHIPPED, released behaviour, not a new decision. A new
// composed Brain call anywhere under lib/mcp/ requires an entry there or
// the build fails (tests/test-254-composition-census.cjs).
async function brainRoute(roomDir, stateContent, intent) {
  // Phase 339 Plan 05 (D-03b), 2026-09-03: reset at entry so a value read
  // by a caller can only ever reflect THIS invocation's own outcome.
  _lastBrainRouteMissNote = null;

  let brainClient;
  try {
    brainClient = require('../core/brain-client.cjs');
  } catch (_e) {
    // 354-09 (THEO-01 degradation visibility): the module itself failed to
    // load -- indistinguishable from unreachable to the caller.
    _lastBrainRouteMissNote = 'brain_unreachable';
    return null;
  }

  if (!brainClient.isAvailable()) return null;

  // Build a generic NL question carrying only the problem-type enum.
  // Canon Part 8: no user content, no artifact text, no proprietary numbers.
  const { definition, complexity } = extractProblemType(stateContent);
  const safeDefinition = definition.replace(/[^a-zA-Z-]/g, '') || 'undefined';
  const safeComplexity = complexity.replace(/[^a-zA-Z-]/g, '') || 'complex';
  const question = 'recommend a framework for a ' + safeDefinition + ' definition '
    + safeComplexity + ' problem';

  // 354-09 (THEO-01 classification round trip): the room's already-known
  // classification crosses to brain-client's composer STRUCTURALLY, via
  // ask()'s second parameter -- never re-derived from `question`'s prose on
  // the far side. The wire shape of brain_ask itself does not change: only
  // { question } is ever sent.
  const rung = _rungFromClassification(safeDefinition, safeComplexity);

  let brainResult;
  try {
    if (typeof brainClient.ask !== 'function') {
      _lastBrainRouteMissNote = 'brain_unreachable';
      return null;
    }
    brainResult = await brainClient.ask(question, { problem_type: rung });
  } catch (_e) {
    _lastBrainRouteMissNote = 'brain_unreachable';
    return null;
  }

  if (!brainResult) {
    _lastBrainRouteMissNote = 'brain_unreachable';
    return null;
  }

  // A sentinel object (egress_blocked / tier_denied / rate_limited /
  // invalid_key) is an ANSWERED-BUT-REFUSED call, not a transport miss or a
  // shape miss -- name it distinctly so a caller can tell the two apart.
  if (typeof brainResult === 'object' && brainResult.error) {
    _lastBrainRouteMissNote = 'brain_error_response';
    return null;
  }

  // Read next_gate.options[] for the ranked framework chain.
  // Gracefully handle both presence and absence of next_gate.
  const hasNextGateShape = !!(brainResult.next_gate && Array.isArray(brainResult.next_gate.options));
  const options = hasNextGateShape ? brainResult.next_gate.options : [];

  // Phase 339 Plan 05 (D-03b), 2026-09-03: `next_gate` is an INCUMBENT-ONLY
  // shape -- no Theo tool emits it, per the recorded grep in
  // docs/254-NOTE-theo-adaptation-list-additions.md section 2. The
  // incumbent ALWAYS carries next_gate, so this branch is unreachable
  // against the incumbent and safe to ship ahead of the flip. This is a
  // DISCLOSURE, not a shape adaptation: reading Theo's own chain shape is a
  // named follow-up (D-03 consumer 2, lib/brain/chain-recommender.cjs),
  // deliberately out of this plan's scope. The Phase 252-01 block below
  // does NOT cover this cause: it is gated on !isAvailable(), and
  // availability stays TRUE post-flip -- precisely why this degrade is
  // silent today and why a second, differently-gated disclosure is needed
  // rather than a widening of the first.
  if (!hasNextGateShape) {
    _lastBrainRouteMissNote = BRAIN_ROUTE_NOTE_NO_NEXT_GATE;
  }

  const anchorFramework = (brainResult.directive && brainResult.directive.guided)
    ? (brainResult.directive.guided.framework || null)
    : null;

  // 354-09 (THEO-01 degradation visibility): neither a next_gate options
  // array nor a directive anchor is an unusable response shape -- more
  // specific than (and it overrides) the generic no-next-gate disclosure
  // above, which merely notes next_gate's absence without asserting the
  // whole response is unusable.
  if (!hasNextGateShape && !anchorFramework) {
    _lastBrainRouteMissNote = 'brain_invalid_response';
  }

  // 354-09 (THEO-01 executable-chain validation): TWO separate candidate
  // pools, never merged. `commandCandidates` are the only things that can
  // ever become chain elements, and only after surviving an EXACT
  // KNOWN_METHODOLOGIES match -- the prior substring-based fuzzy match is
  // gone, which is what let a framework label normalize into an invalid
  // command id like `designthinking` or `build-mvp`.
  // `frameworks` (anchorFramework + options[].framework) are labels for
  // display only and can never enter `chain`.
  const commandCandidates = [];
  const frameworks = [];
  if (anchorFramework && typeof anchorFramework === 'string' && !frameworks.includes(anchorFramework)) {
    frameworks.push(anchorFramework);
  }
  for (const opt of options) {
    if (opt && Array.isArray(opt.commands)) {
      for (const slug of opt.commands) {
        if (typeof slug === 'string' && slug.length > 0 && !commandCandidates.includes(slug)) {
          commandCandidates.push(slug);
        }
      }
    }
    if (opt && typeof opt.framework === 'string' && opt.framework.length > 0 && !frameworks.includes(opt.framework)) {
      frameworks.push(opt.framework);
    }
  }

  const rejectedCandidates = [];
  const chain = [];
  for (const raw of commandCandidates) {
    const normalized = raw.replace(/^\/mos:/, '').toLowerCase();
    if (KNOWN_METHODOLOGIES.includes(normalized)) {
      if (!chain.includes(normalized)) chain.push(normalized);
    } else if (rejectedCandidates.length < 10) {
      rejectedCandidates.push(raw);
    }
  }
  const finalChain = chain.slice(0, 4);

  if (finalChain.length === 0) {
    _lastBrainRouteMissNote = 'brain_chain_not_executable';
    return null;
  }

  // Belt-and-suspenders: the consumer (tool-router.cjs) validates again
  // before initializing pipeline state (354-09 Task 3), but a chain this
  // function itself would not certify never leaves brainRoute() as 'brain'
  // source in the first place.
  const chainValidation = validateChain(roomDir, finalChain);
  if (!chainValidation.valid) {
    _lastBrainRouteMissNote = 'brain_chain_not_executable';
    return null;
  }

  // Derive top confidence from the options array (or default 0.8).
  const topConf = (options.length > 0 && typeof options[0].confidence === 'number')
    ? options[0].confidence
    : 0.8;

  // A usable, validated chain came back -- this was not actually a miss,
  // clear the note so recommend() never discloses a non-event.
  _lastBrainRouteMissNote = null;

  return {
    chain: finalChain,
    frameworks,
    rejected_candidates: rejectedCandidates,
    confidence: topConf,
    source: 'brain',
    // 354-09 (THEO-01 provenance): Theo's recommendation ranks candidates
    // through problem-type relationships; it computes no FEEDS_INTO
    // traversal. Preserve that honestly -- ranked-candidate provenance,
    // never a derivation claim the provider never made.
    chain_type: 'ranked_candidates',
    provenance: {
      provider: 'brain',
      method: 'brain_ask_ranked_options',
      rung: rung,
      rung_source: rung ? 'structured' : 'inferred',
      feeds_into_verified: false,
    },
    reasoning: 'Brain ranked framework candidates for a '
      + (rung || (safeDefinition + ' ' + safeComplexity)) + ' problem; '
      + 'commands follow candidate rank, not a verified dependency-graph derivation.',
    target_sections: [],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get a framework recommendation for a room.
 * 3-tier fallback: cache -> local heuristic -> Brain API (bound:
 * MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS, default 6000ms).
 *
 * @param {string} roomDir - Path to room directory
 * @param {{ intent?: string, mode?: string }} [options]
 * @returns {Promise<{ chain: string[], confidence: number, source: string, reasoning: string, target_sections: string[] }>}
 */
async function recommend(roomDir, options = {}) {
  const { intent } = options;

  // Periodic cache eviction (every 100 calls, sweep entries older than 2x TTL)
  recommendCalls++;
  if (recommendCalls % EVICT_INTERVAL === 0) {
    evictExpired();
  }

  // Read current room state
  let stateContent = '';
  try {
    const stateOps = require('../core/state-ops.cjs');
    stateContent = stateOps.getState(roomDir) || '';
  } catch (_e) {
    // No state available - continue with empty
  }

  // Tier 1: Cache check (BEFORE any heuristic or Brain API call)
  const cacheKey = buildCacheKey(roomDir, stateContent);
  const cached = getFromCache(cacheKey);
  if (cached) {
    cacheHits++;
    return { ...cached, source: 'cache' };
  }

  // Tier 2: Local heuristic (always computed as fallback)
  const localRec = localRoute(roomDir, stateContent, intent);

  // Tier 3: Brain API (bound: MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS, default
  // 6000ms; non-blocking -- localRec above is already computed, so the
  // Tier 2 answer is instant once this race loses). Quick 260911-ddd
  // (DDD-02): evaluated at CALL TIME so an env override is honored per
  // call and is testable, rather than a frozen 2000 literal.
  try {
    const brainRec = await Promise.race([
      brainRoute(roomDir, stateContent, intent),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), resolveBrainRouteTimeoutMs()))
    ]);
    if (brainRec) {
      setCache(cacheKey, brainRec);
      return brainRec;
    }
  } catch (e) {
    // Brain unavailable or timeout - use local. 354-09 (THEO-01 degradation
    // visibility): the ONLY way this specific race-losing timeout is
    // distinguishable from brainRoute()'s own resolved-null causes is here,
    // at the Promise.race boundary -- brainRoute() itself never sees a
    // timeout, it just keeps running unobserved.
    if (e && e.message === 'timeout') {
      _lastBrainRouteMissNote = 'brain_timeout';
    }
  }

  // Phase 252-01 (SWEEP-01): the Tier-3 miss above (brainRoute() returned
  // null on Brain-unavailable, or timed out) previously fell through to
  // localRec silently -- true recommend() behavior (the honest Tier-2
  // heuristic already carries source:'local-fallback'/'routing-table' etc.),
  // but WHY Brain was skipped was never disclosed. When the cause is
  // specifically no_key (not merely "no local edges"), attach the rail's
  // typed refusal as an ADDITIVE field -- never replaces localRec's shape,
  // never a new field any existing consumer reads today, so this cannot
  // regress anyone destructuring {chain, confidence, source, reasoning,
  // target_sections}. Best-effort; never blocks the return.
  //
  // Phase 254 (COMP-01): this require is the SWEEP-01 DISCLOSURE-only leg --
  // enumerated in lib/mcp/brain-composition-census.cjs with reaches_brain:
  // false, because it makes no tools/call of its own; it exists so a reader
  // does not count this as a third wire. The reaching leg is brainRoute()
  // above, which IS census-declared with reaches_brain: true.
  try {
    const brainClient = require('../core/brain-client.cjs');
    if (typeof brainClient.isAvailable === 'function' && !brainClient.isAvailable()) {
      const { refusalResponse } = require('../core/refusal-messaging.cjs');
      localRec.brain_refusal = refusalResponse('no_key', { tool: 'brain_route' });
    }
  } catch (_e) {
    // Disclosure is best-effort; never blocks the local recommendation.
  }

  // Phase 339 Plan 05 (D-03b), 2026-09-03: a SECOND, differently-gated
  // disclosure, additive alongside the Phase 252-01 block above (which it
  // does not touch or widen). Covers causes that block cannot see: the
  // Brain ANSWERED (isAvailable() stays true post-flip) but its response
  // carried no `next_gate` shape, or timed out, or answered with an error
  // sentinel, or returned an unusable shape, or returned a chain this
  // module itself could not certify -- brainRoute() (and, for the timeout
  // leg, the Promise.race catch above) returned null with no readable
  // reason otherwise. `_lastBrainRouteMissNote` was set (or left null) by
  // THIS call's own already-awaited brainRoute() invocation, or by the
  // race's own catch immediately above; reading it here is synchronous, not
  // a fresh async probe, so no extra await or network reach happens.
  // ADDITIVE field only: never replaces localRec's shape, never a field any
  // existing consumer reads today, so this cannot regress anyone
  // destructuring {chain, confidence, source, reasoning, target_sections}.
  // Best-effort; never blocks the return.
  //
  // 354-09 (THEO-01 degradation visibility): this block's own code is
  // UNCHANGED -- it was already generic over whatever value
  // `_lastBrainRouteMissNote` happens to hold. What widened is the SET of
  // causes brainRoute()/recommend() ever assign to it: brain_unreachable,
  // brain_timeout, brain_error_response, brain_invalid_response and
  // brain_chain_not_executable now join the pre-existing
  // answered_no_next_gate, so every one of them reaches
  // localRec.brain_router_note through this same, already-additive path.
  try {
    if (_lastBrainRouteMissNote && !localRec.brain_refusal) {
      localRec.brain_router_note = _lastBrainRouteMissNote;
    }
  } catch (_e) {
    // Disclosure is best-effort; never blocks the local recommendation.
  } finally {
    _lastBrainRouteMissNote = null;
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

// Quick 260911-ddd (DDD-02): re-exported so the Tier 3 bound pin is
// readable from either side (this file and brain-composition-census.cjs
// both read the same lib/mcp/brain-route-bound.cjs leaf).
//
// 354-09 (THEO-01): KNOWN_METHODOLOGIES is exported as a LIVE reference to
// the same array validateChain() and brainRoute() check against -- not a
// snapshot copy -- so a downstream consumer (354-17's Jev-scored recall
// layer) reads the one real registry, never a stale duplicate.
module.exports = { recommend, validateChain, KNOWN_METHODOLOGIES, BRAIN_ROUTE_TIMEOUT_MS, resolveBrainRouteTimeoutMs };
