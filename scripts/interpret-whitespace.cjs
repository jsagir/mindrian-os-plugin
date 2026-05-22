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
// Three-Gate Validation (Pitfall 2 from PITFALLS-whitespace.md)
// ---------------------------------------------------------------------------

/**
 * Anchor Gate: gap must lie BETWEEN populated clusters, not in void.
 * Checks that nearest artifacts come from at least 2 distinct clusters
 * by measuring UMAP coordinate spread among nearest artifacts.
 *
 * @param {Object} gap - whitespace gap with nearest_room_artifacts
 * @param {number} gapIndex - index of gap in gaps array
 * @param {Object} umap2d - UMAP 2D projection data { room_artifacts: [{id, x, y, cluster}] }
 * @returns {{ passed: boolean, reason: string }}
 */
function anchorGate(gap, gapIndex, umap2d) {
  const nearestIds = (gap.nearest_room_artifacts || []).map(a =>
    typeof a === 'string' ? a : (a.artifact_id || a.id || a)
  );

  if (nearestIds.length < 2) {
    return { passed: false, reason: 'Fewer than 2 nearest artifacts -- cannot determine cluster spread' };
  }

  const artCoords = (umap2d && umap2d.room_artifacts) || [];
  const coordMap = {};
  for (const art of artCoords) {
    coordMap[art.id] = art;
  }

  // Collect coordinates of nearest artifacts that exist in UMAP data
  const points = [];
  for (const id of nearestIds) {
    if (coordMap[id]) {
      points.push(coordMap[id]);
    }
  }

  if (points.length < 2) {
    return { passed: false, reason: 'Insufficient UMAP data for nearest artifacts' };
  }

  // Check cluster diversity: if artifacts have cluster labels, use them
  const clusters = new Set(points.map(p => p.cluster).filter(Boolean));
  if (clusters.size >= 2) {
    return { passed: true, reason: `Artifacts span ${clusters.size} clusters` };
  }

  // Fallback: measure coordinate spread (max pairwise distance)
  let maxDist = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      maxDist = Math.max(maxDist, Math.sqrt(dx * dx + dy * dy));
    }
  }

  // Threshold: artifacts must be spread > 1.0 UMAP units apart to suggest multiple clusters
  const SPREAD_THRESHOLD = 1.0;
  if (maxDist >= SPREAD_THRESHOLD) {
    return { passed: true, reason: `Artifact spread ${maxDist.toFixed(2)} exceeds threshold ${SPREAD_THRESHOLD}` };
  }

  return { passed: false, reason: `Artifacts tightly clustered (spread ${maxDist.toFixed(2)} < ${SPREAD_THRESHOLD}) -- likely periphery, not interpolation gap` };
}

/**
 * Brain Consensus Gate: gap's framework must exist in Brain's known frameworks.
 * If Brain also has no framework for this region, the gap is noise.
 *
 * @param {Object} gap - whitespace gap with brain_framework field
 * @param {string[]} brainFrameworkNames - list of known Brain framework names
 * @returns {{ passed: boolean, reason: string }}
 */
function brainConsensusGate(gap, brainFrameworkNames) {
  const fw = gap.brain_framework || '';
  if (!fw) {
    return { passed: false, reason: 'No brain_framework assigned to gap' };
  }

  const known = Array.isArray(brainFrameworkNames) ? brainFrameworkNames : [];
  if (known.includes(fw)) {
    return { passed: true, reason: `Framework "${fw}" exists in Brain` };
  }

  return { passed: false, reason: `Framework "${fw}" not found in Brain -- gap may be noise` };
}

/**
 * Semantic Coherence Gate: placeholder that always passes.
 * Full implementation requires embedding round-trip (generate description,
 * embed, check distance) which happens during hypothesis generation.
 *
 * @param {Object} gap - whitespace gap
 * @returns {{ passed: boolean, reason: string }}
 */
function semanticCoherenceGate(gap) {
  return { passed: true, reason: 'Semantic coherence check deferred to hypothesis generation' };
}

/**
 * Orchestrate all three gates for a whitespace zone.
 * A zone must pass Anchor Gate AND Brain Consensus Gate to be valid.
 * Semantic Coherence Gate is advisory (does not block).
 *
 * @param {Object} gap - whitespace gap
 * @param {number} gapIndex - index in gaps array
 * @param {Object} umap2d - UMAP 2D data
 * @param {string[]} brainFrameworkNames - known framework names
 * @returns {{ valid: boolean, gates_passed: string[], gates_failed: string[] }}
 */
function validateZone(gap, gapIndex, umap2d, brainFrameworkNames) {
  const gates_passed = [];
  const gates_failed = [];

  const anchor = anchorGate(gap, gapIndex, umap2d);
  if (anchor.passed) gates_passed.push('anchor');
  else gates_failed.push('anchor');

  const brain = brainConsensusGate(gap, brainFrameworkNames);
  if (brain.passed) gates_passed.push('brain_consensus');
  else gates_failed.push('brain_consensus');

  const semantic = semanticCoherenceGate(gap);
  if (semantic.passed) gates_passed.push('semantic_coherence');
  else gates_failed.push('semantic_coherence');

  // Must pass both Anchor AND Brain Consensus to be valid
  const valid = anchor.passed && brain.passed;

  return { valid, gates_passed, gates_failed };
}

// ---------------------------------------------------------------------------
// Hypothesis Prompt Builder (D-10, D-11)
// ---------------------------------------------------------------------------

/**
 * Build a structured prompt for Claude to generate a methodology-aware hypothesis.
 * The script outputs this prompt -- it does NOT call Claude itself. Larry uses the
 * prompt at runtime for lazy hypothesis generation (D-09).
 *
 * @param {Object} gap - enriched whitespace gap with problem_type, framework_chain, etc.
 * @param {Array} roomArtifacts - nearest room artifact summaries [{title, id, section}]
 * @param {Object} brainDescriptions - map of framework name to description string
 * @returns {string} Structured prompt for Claude
 */
function buildHypothesisPrompt(gap, roomArtifacts, brainDescriptions) {
  const fw = gap.brain_framework || 'unknown methodology';
  const pt = gap.problem_type || 'Un-Defined';
  const chain = gap.framework_chain || [];
  const density = gap.density_score || 0;

  // Build framework chain description
  const chainDescriptions = chain.map((fwName, i) => {
    const desc = (brainDescriptions && brainDescriptions[fwName]) || 'No description available';
    return `  ${i + 1}. **${fwName}:** ${desc}`;
  }).join('\n');

  // Build nearest artifact context
  const artifactContext = (roomArtifacts || []).map(a => {
    const title = a.title || a.id || 'untitled';
    const section = a.section || 'unknown';
    return `  - "${title}" (in ${section}/)`;
  }).join('\n') || '  - No nearby artifacts found';

  // Framework-specific question templates
  const questionTemplates = {
    'Ill-Defined': `Through ${chain[0] || fw} lens: what job is the user hiring this solution for, and what progress are they trying to make?`,
    'Well-Defined': `Through ${chain[0] || fw} lens: what categories of analysis are missing, and how do they decompose the problem?`,
    'Wicked': `Through ${chain[0] || fw} lens: what feedback loops and unintended consequences are unexamined in this territory?`,
    'Un-Defined': `Through ${chain[0] || fw} lens: what beautiful question would open this unexplored territory for structured investigation?`,
  };
  const frameworkQuestion = questionTemplates[pt] || questionTemplates['Un-Defined'];

  const prompt = `You are analyzing a whitespace gap in a venture's Data Room.

## Zone Context
- **Problem Type:** ${pt}
- **Primary Framework:** ${fw}
- **Density Score:** ${density} (lower = more sparse, indicating larger gap)
- **Validation Status:** ${gap.validated ? 'Validated' : 'Unvalidated'}

## Framework Chain for Exploration
${chainDescriptions || '  (No framework chain available)'}

## Nearest Room Artifacts
${artifactContext}

## Your Task

Generate a 3-part hypothesis for this whitespace gap:

1. **What's missing and why it matters:** Describe what knowledge, analysis, or perspective is absent from this region of the venture's understanding. Explain why this gap creates risk or missed opportunity.

2. **Framework-driven question:** ${frameworkQuestion}

3. **Suggested next action:** Recommend a specific action -- either a /mos: command (e.g., \`/mos:methodology jtbd\`, \`/mos:pipeline bono\`) or an artifact to create (e.g., "create market-analysis/customer-jobs.md"). Be specific to the venture's context.

Output ONLY the 3-part hypothesis. No preamble.`;

  return prompt;
}

// ---------------------------------------------------------------------------
// Brain queries (READ-ONLY per D-12) -- now via curated askOp surface
// ---------------------------------------------------------------------------

/**
 * Fetch ADDRESSES_PROBLEM_TYPE edges from Brain via askOp.
 *
 * Replaces the former raw brain.query() Cypher call with the curated
 * brain.askOp('framework_edges', { edge_type:'ADDRESSES_PROBLEM_TYPE' })
 * surface. Row shape: { framework, problem_type }.
 *
 * NOTE: the curated op does NOT expose an `effectiveness` field for
 * ADDRESSES_PROBLEM_TYPE edges (the server returns only framework +
 * problem_type). Downstream consumers in buildProblemTypeMap() and
 * classifyZone() use effectiveness for confidence gating. When the field
 * is absent we default it to 1.0 (treat every Brain-returned mapping as
 * above-threshold). This is flagged for the integrator: if effectiveness
 * scoring needs to be reintroduced a new curated op field is required.
 *
 * @returns {Promise<Array|null>}
 */
async function fetchProblemTypeEdges() {
  const brain = getBrain();
  if (!brain.askOp) return null; // askOp not yet available -- degrade gracefully
  try {
    const result = await brain.askOp('framework_edges', { edge_type: 'ADDRESSES_PROBLEM_TYPE' });
    if (!result || result.degraded) return null;
    const rows = Array.isArray(result.rows) ? result.rows : [];
    // Inject synthetic effectiveness=1.0 since the curated op omits it.
    // This keeps buildProblemTypeMap() compatible without a schema change.
    return rows.map(function (r) {
      return { framework: r.framework, problem_type: r.problem_type, effectiveness: 1.0 };
    });
  } catch (e) {
    return null;
  }
}

/**
 * Fetch FEEDS_INTO edges from Brain via askOp.
 *
 * Replaces the former raw brain.query() Cypher call with the curated
 * brain.askOp('framework_edges', { edge_type:'FEEDS_INTO' }) surface.
 * Row shape: { from, to, confidence, transform }.
 *
 * The old query returned f1.name AS source / f2.name AS target; the
 * curated op returns `from` / `to`. The adapter below maps them to the
 * { source, target, confidence, transform } shape that buildFeedsIntoMap()
 * expects. confidence and transform are preserved when present.
 *
 * @returns {Promise<Array|null>}
 */
async function fetchFeedsIntoEdges() {
  const brain = getBrain();
  if (!brain.askOp) return null; // askOp not yet available -- degrade gracefully
  try {
    const result = await brain.askOp('framework_edges', { edge_type: 'FEEDS_INTO' });
    if (!result || result.degraded) return null;
    const rows = Array.isArray(result.rows) ? result.rows : [];
    // Adapt curated op row shape { from, to, confidence, transform }
    // to the legacy { source, target, confidence, transform } shape that
    // buildFeedsIntoMap() consumes.
    return rows.map(function (r) {
      return {
        source: r.from,
        target: r.to,
        confidence: typeof r.confidence === 'number' ? r.confidence : 0,
        transform: r.transform || '',
      };
    });
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

    // Three-gate validation
    const brainFrameworkNames = Object.keys(problemTypeMap);
    const validation = validateZone(gap, gaps.indexOf(gap), wsData.umap_2d || {}, brainFrameworkNames);
    gap.validated = validation.valid;
    gap.validation = { gates_passed: validation.gates_passed, gates_failed: validation.gates_failed };
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
  const args = process.argv.slice(2);
  const hypothesize = args.includes('--hypothesize');
  const hypothesizeCountArg = args.find((a, i) => args[i - 1] === '--top');
  const hypothesizeCount = hypothesizeCountArg ? parseInt(hypothesizeCountArg, 10) : 3;
  const roomDir = args.find(a => !a.startsWith('-') && a !== hypothesizeCountArg);

  if (!roomDir) {
    console.error('Usage: node scripts/interpret-whitespace.cjs /path/to/room [--hypothesize] [--top N]');
    console.error('');
    console.error('Options:');
    console.error('  --hypothesize   Generate hypothesis prompts for top validated gaps');
    console.error('  --top N         Number of gaps to generate hypotheses for (default: 3)');
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
      // If --hypothesize, generate hypothesis prompts for top validated gaps
      if (hypothesize) {
        const validatedGaps = result.gaps
          .filter(g => g.validated)
          .sort((a, b) => (a.density_score || 0) - (b.density_score || 0)) // lower density = bigger gap
          .slice(0, hypothesizeCount);

        for (const gap of validatedGaps) {
          const artifacts = (gap.nearest_room_artifacts || []).map(a => {
            if (typeof a === 'string') return { id: a, title: a };
            return { id: a.artifact_id || a.id, title: a.title || a.artifact_id, section: a.section };
          });
          gap.hypothesis_prompt = buildHypothesisPrompt(gap, artifacts, {});
        }

        // Re-write with hypothesis prompts
        const outPath = path.join(resolvedDir, '.mindrian', 'interpretation-results.json');
        fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
        process.stderr.write(`Generated hypothesis prompts for ${validatedGaps.length} validated gaps\n`);
      }

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
  anchorGate,
  brainConsensusGate,
  semanticCoherenceGate,
  validateZone,
  buildHypothesisPrompt,
  interpretWhitespace,
};
