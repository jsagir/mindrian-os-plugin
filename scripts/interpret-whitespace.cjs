#!/usr/bin/env node
/**
 * interpret-whitespace.cjs -- Whitespace Zone Interpretation Engine
 * ==================================================================
 * Classifies each whitespace zone by problem type using Brain's
 * ADDRESSES_PROBLEM_TYPE edges, then selects a framework chain
 * via FEEDS_INTO traversal for methodology-aware exploration.
 *
 * Usage:
 *   node scripts/interpret-whitespace.cjs /path/to/room
 *
 * Reads:  .mindrian/whitespace-results.json (from Phase 61)
 * Writes: .mindrian/interpretation-results.json (enriched zones)
 *
 * Brain is READ-ONLY -- all data fetched via brain-client.cjs query().
 * When Brain is unavailable, graceful fallback: all zones get
 * problem_type="Un-Defined" + generic exploration chain.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Brain client (lazy-loaded to allow testing without Brain)
// ---------------------------------------------------------------------------

let _brain = null;
function getBrain() {
  if (!_brain) {
    try {
      _brain = require('../lib/core/brain-client.cjs');
    } catch (e) {
      _brain = { isAvailable: () => false, query: async () => null };
    }
  }
  return _brain;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONFIDENCE_THRESHOLD = 0.6;
const MAX_CHAIN_DEPTH = 3;

const FALLBACK_CHAIN = ['Beautiful Questions', 'Hypothesis-Driven Problem Solving'];

// ---------------------------------------------------------------------------
// buildProblemTypeMap -- transforms Brain ADDRESSES_PROBLEM_TYPE results
// ---------------------------------------------------------------------------

/**
 * Build a lookup map from framework name to { problem_type, effectiveness }.
 *
 * @param {Array<{framework: string, problem_type: string, effectiveness: number}>} records
 * @returns {Object<string, {problem_type: string, effectiveness: number}>}
 */
function buildProblemTypeMap(records) {
  const map = {};
  if (!records || !Array.isArray(records)) return map;

  for (const rec of records) {
    const fw = rec.framework || rec.f_name || '';
    const pt = rec.problem_type || rec.pt_name || '';
    const eff = parseFloat(rec.effectiveness || 0);

    if (!fw) continue;

    // Keep highest effectiveness mapping per framework
    if (!map[fw] || eff > map[fw].effectiveness) {
      map[fw] = { problem_type: pt, effectiveness: eff };
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// buildFeedsIntoMap -- transforms Brain FEEDS_INTO results
// ---------------------------------------------------------------------------

/**
 * Build adjacency list from framework FEEDS_INTO edges.
 *
 * @param {Array<{source: string, target: string, confidence: number, transform: string}>} records
 * @returns {Object<string, Array<{target: string, confidence: number, transform: string}>>}
 */
function buildFeedsIntoMap(records) {
  const map = {};
  if (!records || !Array.isArray(records)) return map;

  for (const rec of records) {
    const src = rec.source || '';
    const tgt = rec.target || '';
    const conf = parseFloat(rec.confidence || 0);
    const transform = rec.transform || '';

    if (!src || !tgt) continue;

    if (!map[src]) map[src] = [];
    map[src].push({ target: tgt, confidence: conf, transform });
  }

  return map;
}

// ---------------------------------------------------------------------------
// classifyZone -- problem type classification per D-01, D-02, D-03
// ---------------------------------------------------------------------------

/**
 * Classify a whitespace zone by problem type using Brain framework mappings.
 *
 * Per D-01: Zone inherits problem type from closest framework(s).
 * Per D-02: When multiple frameworks are relevant, weighted vote by effectiveness.
 * Per D-03: Below 0.6 confidence -> "Un-Defined".
 *
 * @param {string} brainFramework - The zone's nearest Brain framework name
 * @param {Object} problemTypeMap - Map from buildProblemTypeMap()
 * @returns {{ problem_type: string, confidence: number, voting_frameworks: Array }}
 */
function classifyZone(brainFramework, problemTypeMap) {
  if (!brainFramework || !problemTypeMap) {
    return { problem_type: 'Un-Defined', confidence: 0, voting_frameworks: [] };
  }

  // Direct lookup
  const entry = problemTypeMap[brainFramework];

  if (!entry) {
    return { problem_type: 'Un-Defined', confidence: 0, voting_frameworks: [] };
  }

  // Check confidence threshold
  if (entry.effectiveness < CONFIDENCE_THRESHOLD) {
    return {
      problem_type: 'Un-Defined',
      confidence: entry.effectiveness,
      voting_frameworks: [{ framework: brainFramework, effectiveness: entry.effectiveness }],
    };
  }

  return {
    problem_type: entry.problem_type,
    confidence: entry.effectiveness,
    voting_frameworks: [{ framework: brainFramework, effectiveness: entry.effectiveness }],
  };
}

// ---------------------------------------------------------------------------
// selectFrameworkChain -- FEEDS_INTO traversal per D-05, D-06, D-07
// ---------------------------------------------------------------------------

/**
 * Select a framework chain for exploring a classified zone.
 *
 * Per D-05: Start with highest ADDRESSES_PROBLEM_TYPE effectiveness framework
 *           for the classified problem type.
 * Per D-06: Traverse FEEDS_INTO edges, max depth 3.
 * Per D-07: Use edges as-is for sequencing when effectiveness scores are absent.
 *
 * @param {string} problemType - Classified problem type
 * @param {string} startFramework - The zone's Brain framework
 * @param {Object} feedsIntoMap - Map from buildFeedsIntoMap()
 * @param {Object} problemTypeMap - Map from buildProblemTypeMap()
 * @returns {string[]} Array of framework names (max length 3)
 */
function selectFrameworkChain(problemType, startFramework, feedsIntoMap, problemTypeMap) {
  if (!startFramework) return FALLBACK_CHAIN.slice(0, MAX_CHAIN_DEPTH);

  // Per D-05: Find best starting framework for this problem type
  let bestStart = startFramework;
  let bestEffectiveness = 0;

  if (problemTypeMap) {
    for (const [fw, entry] of Object.entries(problemTypeMap)) {
      if (entry.problem_type === problemType && entry.effectiveness > bestEffectiveness) {
        bestEffectiveness = entry.effectiveness;
        bestStart = fw;
      }
    }
  }

  // Build chain by traversing FEEDS_INTO edges
  const chain = [bestStart];
  const visited = new Set([bestStart]);

  let current = bestStart;
  while (chain.length < MAX_CHAIN_DEPTH) {
    const edges = (feedsIntoMap || {})[current];
    if (!edges || edges.length === 0) break;

    // Pick highest confidence unvisited neighbor
    let bestNext = null;
    let bestConf = -1;
    for (const edge of edges) {
      if (!visited.has(edge.target) && edge.confidence > bestConf) {
        bestConf = edge.confidence;
        bestNext = edge.target;
      }
    }

    if (!bestNext) break;

    chain.push(bestNext);
    visited.add(bestNext);
    current = bestNext;
  }

  return chain;
}

// ---------------------------------------------------------------------------
// Brain queries (READ-ONLY per D-12)
// ---------------------------------------------------------------------------

/**
 * Fetch ADDRESSES_PROBLEM_TYPE edges from Brain.
 * @returns {Promise<Array|null>}
 */
async function fetchProblemTypeEdges() {
  const brain = getBrain();
  try {
    const result = await brain.query(
      'MATCH (f:Framework)-[a:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType) ' +
      'RETURN f.name AS framework, pt.name AS problem_type, a.effectiveness AS effectiveness'
    );
    if (result && Array.isArray(result.records)) return result.records;
    if (Array.isArray(result)) return result;
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Fetch FEEDS_INTO edges from Brain.
 * @returns {Promise<Array|null>}
 */
async function fetchFeedsIntoEdges() {
  const brain = getBrain();
  try {
    const result = await brain.query(
      'MATCH (f1:Framework)-[r:FEEDS_INTO]->(f2:Framework) ' +
      'RETURN f1.name AS source, f2.name AS target, r.confidence AS confidence, r.transform_description AS transform'
    );
    if (result && Array.isArray(result.records)) return result.records;
    if (Array.isArray(result)) return result;
    return null;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// interpretWhitespace -- main orchestrator
// ---------------------------------------------------------------------------

/**
 * Read whitespace-results.json, classify zones, select chains, write output.
 *
 * @param {string} roomDir - Path to the room directory
 * @returns {Promise<Object>} Enriched result object
 */
async function interpretWhitespace(roomDir) {
  const wsPath = path.join(roomDir, '.mindrian', 'whitespace-results.json');

  // Read whitespace results
  if (!fs.existsSync(wsPath)) {
    return { metadata: { error: 'No whitespace-results.json found' }, gaps: [] };
  }

  let wsData;
  try {
    wsData = JSON.parse(fs.readFileSync(wsPath, 'utf-8'));
  } catch (e) {
    return { metadata: { error: 'Failed to parse whitespace-results.json' }, gaps: [] };
  }

  const gaps = wsData.gaps || [];

  // Check Brain availability
  const brain = getBrain();
  const brainAvailable = brain.isAvailable();

  let problemTypeMap = {};
  let feedsIntoMap = {};

  if (brainAvailable) {
    // Fetch both edge types from Brain (READ-ONLY)
    const [ptRecords, fiRecords] = await Promise.all([
      fetchProblemTypeEdges(),
      fetchFeedsIntoEdges(),
    ]);

    if (ptRecords) {
      problemTypeMap = buildProblemTypeMap(ptRecords);
    }
    if (fiRecords) {
      feedsIntoMap = buildFeedsIntoMap(fiRecords);
    }
  }

  // Classify each zone and select framework chains
  const hasBrainData = Object.keys(problemTypeMap).length > 0;
  const counts = { 'Ill-Defined': 0, 'Well-Defined': 0, 'Wicked': 0, 'Un-Defined': 0 };

  for (const gap of gaps) {
    if (hasBrainData) {
      // Classify using Brain data
      const classification = classifyZone(gap.brain_framework, problemTypeMap);
      gap.problem_type = classification.problem_type;
      gap.confidence = classification.confidence;
      gap.voting_frameworks = classification.voting_frameworks;

      // Select framework chain
      gap.framework_chain = selectFrameworkChain(
        classification.problem_type,
        gap.brain_framework,
        feedsIntoMap,
        problemTypeMap
      );
    } else {
      // Fallback: Brain unavailable or returned no data
      gap.problem_type = 'Un-Defined';
      gap.confidence = 0;
      gap.voting_frameworks = [];
      gap.framework_chain = FALLBACK_CHAIN.slice();
    }

    counts[gap.problem_type] = (counts[gap.problem_type] || 0) + 1;
  }

  // Build enriched output
  const result = {
    metadata: {
      ...(wsData.metadata || {}),
      interpretation_timestamp: new Date().toISOString(),
      brain_available: brainAvailable,
      brain_data_loaded: hasBrainData,
      problem_type_counts: counts,
    },
    gaps,
    novelty_scores: wsData.novelty_scores || [],
    umap_2d: wsData.umap_2d || {},
  };

  // Write output
  const outDir = path.join(roomDir, '.mindrian');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, 'interpretation-results.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');

  // Print summary to stderr
  const total = gaps.length;
  process.stderr.write(
    `Interpreted ${total} zones: ` +
    `${counts['Ill-Defined']} Ill-Defined, ` +
    `${counts['Well-Defined']} Well-Defined, ` +
    `${counts['Wicked']} Wicked, ` +
    `${counts['Un-Defined']} Un-Defined\n`
  );

  return result;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (require.main === module) {
  const roomDir = process.argv[2];

  if (!roomDir) {
    console.error('Usage: node scripts/interpret-whitespace.cjs /path/to/room');
    console.error('');
    console.error('Reads:  .mindrian/whitespace-results.json');
    console.error('Writes: .mindrian/interpretation-results.json');
    process.exit(1);
  }

  const resolvedDir = path.resolve(roomDir);
  if (!fs.existsSync(resolvedDir)) {
    console.error(`Error: ${resolvedDir} does not exist`);
    process.exit(1);
  }

  interpretWhitespace(resolvedDir)
    .then(result => {
      const outPath = path.join(resolvedDir, '.mindrian', 'interpretation-results.json');
      console.log(`Output: ${outPath}`);
    })
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}

// ---------------------------------------------------------------------------
// Exports (for testability)
// ---------------------------------------------------------------------------

module.exports = {
  classifyZone,
  selectFrameworkChain,
  buildProblemTypeMap,
  buildFeedsIntoMap,
  interpretWhitespace,
};
