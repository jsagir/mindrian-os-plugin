#!/usr/bin/env node
/**
 * whitespace-to-brain.cjs -- Write validated whitespace zones to Neo4j Brain
 * ===========================================================================
 * Reads interpretation-results.json and writes WhitespaceZone nodes,
 * EXPLORED_BY edges, and TYPICAL_WHITESPACE aggregation edges to Brain.
 *
 * Step sequence:
 *   1. Read interpretation-results.json from room's .mindrian/ directory
 *   2. Filter to only validated zones (anchor + brain_consensus gates passed)
 *   3. MERGE WhitespaceZone nodes with deterministic hash (anonymized)
 *   4. MERGE EXPLORED_BY edges linking zones to Framework chains
 *   5. Run TYPICAL_WHITESPACE aggregation for cross-room learning
 *
 * Fire-and-forget: ALL brain.write() calls wrapped in try/catch.
 * Never throws. Always exits 0. Log errors to stderr but never block.
 *
 * Anonymization: NEVER stores room name, room path, or any room-identifying
 * data in the Brain. Only stores problem_type, framework_chain, density_score,
 * strategic_rank, hypothesis text.
 *
 * Usage:
 *   node scripts/whitespace-to-brain.cjs /path/to/room [--verbose] [--dry-run]
 *   node scripts/whitespace-to-brain.cjs --help
 *
 * Output:
 *   JSON summary to stdout: { zones_written, edges_created, aggregation_ran, errors }
 *
 * Exit codes:
 *   0 - Always (fire-and-forget)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Brain client (lazy-loaded, fire-and-forget pattern from sync-rooms-brain)
// ---------------------------------------------------------------------------

const PLUGIN_ROOT = path.resolve(__dirname, '..');

let brain;
try {
  brain = require(path.join(PLUGIN_ROOT, 'lib', 'core', 'brain-client.cjs'));
} catch (_) {
  brain = { isAvailable: () => false, write: async () => null };
}

/**
 * Execute a Cypher write query via Brain API.
 * Returns true on success, false on failure. Never throws.
 * @param {string} cypher
 * @returns {Promise<boolean>}
 */
async function brainWrite(cypher) {
  try {
    const result = await brain.write(cypher);
    return result !== null;
  } catch (_) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Deterministic hash (anonymized -- NO room name or path)
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic hash for a whitespace zone.
 * Based on problem_type + density_score + first framework in chain.
 * Room name/path is NEVER included (D-05 anonymization).
 *
 * @param {string} problemType
 * @param {number} densityScore
 * @param {string} firstFramework
 * @returns {string} SHA-256 hex hash (first 16 chars)
 */
function zoneHash(problemType, densityScore, firstFramework) {
  const input = `${problemType || 'Un-Defined'}|${(densityScore || 0).toFixed(4)}|${firstFramework || 'unknown'}`;
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// Cypher escaping
// ---------------------------------------------------------------------------

/**
 * Escape a string for safe inclusion in Cypher queries.
 * @param {string} str
 * @returns {string}
 */
function esc(str) {
  if (!str) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

// ---------------------------------------------------------------------------
// Zone filtering (D-04: only validated zones)
// ---------------------------------------------------------------------------

/**
 * Filter zones to only those that passed validation gates.
 * A zone is valid when its `validated` field is true (anchor + brain_consensus gates).
 *
 * @param {Array} gaps - Array of gap objects from interpretation-results.json
 * @returns {Array} Filtered array of validated gaps
 */
function filterValidatedZones(gaps) {
  if (!Array.isArray(gaps)) return [];
  return gaps.filter(gap => gap.validated === true);
}

// ---------------------------------------------------------------------------
// WhitespaceZone node creation (BRAIN-01)
// ---------------------------------------------------------------------------

/**
 * Build MERGE Cypher for a WhitespaceZone node.
 * Anonymized: no room name, no room path.
 *
 * @param {Object} zone - Validated zone object
 * @returns {string} Cypher MERGE query
 */
function buildZoneNodeCypher(zone) {
  const hash = zoneHash(
    zone.problem_type,
    zone.density_score,
    (zone.framework_chain || [])[0]
  );

  return `MERGE (wz:WhitespaceZone {hash: '${esc(hash)}'})
SET wz.problem_type = '${esc(zone.problem_type || 'Un-Defined')}',
    wz.density_score = ${parseFloat(zone.density_score || 0)},
    wz.strategic_rank = ${parseInt(zone.strategic_rank || 0, 10)},
    wz.hypothesis = '${esc((zone.hypothesis || '').slice(0, 500))}',
    wz.updated_at = datetime()
ON CREATE SET wz.created_at = datetime()`;
}

// ---------------------------------------------------------------------------
// EXPLORED_BY edges (BRAIN-01)
// ---------------------------------------------------------------------------

/**
 * Build MERGE Cypher for EXPLORED_BY edges linking zone to framework chain.
 *
 * @param {Object} zone - Validated zone object
 * @returns {string[]} Array of Cypher MERGE queries (one per framework in chain)
 */
function buildExploredByEdgeCyphers(zone) {
  const hash = zoneHash(
    zone.problem_type,
    zone.density_score,
    (zone.framework_chain || [])[0]
  );

  const chain = zone.framework_chain || [];
  return chain.map((fw, position) =>
    `MATCH (wz:WhitespaceZone {hash: '${esc(hash)}'})
MATCH (f:Framework {name: '${esc(fw)}'})
MERGE (wz)-[e:EXPLORED_BY]->(f)
SET e.position = ${position}`
  );
}

// ---------------------------------------------------------------------------
// TYPICAL_WHITESPACE aggregation (BRAIN-02, BRAIN-03)
// ---------------------------------------------------------------------------

/**
 * Build Cypher for TYPICAL_WHITESPACE aggregation edges.
 * Creates cross-room learning: "ventures at stage X typically have whitespace in Y area."
 *
 * @returns {string} Cypher aggregation query
 */
function buildAggregationCypher() {
  return `MATCH (wz:WhitespaceZone)-[:EXPLORED_BY]->(f:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType)
WITH pt, wz.problem_type AS ws_type, count(DISTINCT wz) AS occurrences
WHERE occurrences >= 2
MERGE (ws:WhitespacePattern {type: ws_type})
MERGE (pt)-[tw:TYPICAL_WHITESPACE]->(ws)
SET tw.occurrences = occurrences,
    tw.updated_at = datetime()`;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Read interpretation-results.json, write validated zones to Brain.
 *
 * @param {string} roomDir - Absolute path to room directory
 * @param {Object} opts - Options { verbose, dryRun }
 * @returns {Promise<Object>} Summary { zones_written, edges_created, aggregation_ran, errors }
 */
async function main(roomDir, opts = {}) {
  const summary = {
    zones_written: 0,
    edges_created: 0,
    aggregation_ran: false,
    errors: 0,
  };

  // 1. Read interpretation-results.json
  const resultsPath = path.join(roomDir, '.mindrian', 'interpretation-results.json');
  if (!fs.existsSync(resultsPath)) {
    if (opts.verbose) process.stderr.write('No interpretation-results.json found\n');
    console.log(JSON.stringify(summary));
    return summary;
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
  } catch (e) {
    if (opts.verbose) process.stderr.write(`Failed to parse interpretation-results.json: ${e.message}\n`);
    summary.errors++;
    console.log(JSON.stringify(summary));
    return summary;
  }

  // 2. Filter validated zones (D-04)
  const allGaps = data.gaps || [];
  const validZones = filterValidatedZones(allGaps);

  if (opts.verbose) {
    process.stderr.write(`Found ${allGaps.length} total zones, ${validZones.length} validated\n`);
  }

  if (validZones.length === 0) {
    if (opts.verbose) process.stderr.write('No validated zones to write\n');
    console.log(JSON.stringify(summary));
    return summary;
  }

  // 3. Check Brain availability
  if (!opts.dryRun && !brain.isAvailable()) {
    if (opts.verbose) process.stderr.write('Brain API not available (no key), skipping writes\n');
    console.log(JSON.stringify(summary));
    return summary;
  }

  // 4. Write WhitespaceZone nodes + EXPLORED_BY edges
  for (const zone of validZones) {
    // 4a. MERGE WhitespaceZone node
    const nodeCypher = buildZoneNodeCypher(zone);

    if (opts.dryRun) {
      process.stderr.write(`[dry-run] Zone node:\n${nodeCypher}\n\n`);
      summary.zones_written++;
    } else {
      const ok = await brainWrite(nodeCypher);
      if (ok) {
        summary.zones_written++;
        if (opts.verbose) process.stderr.write(`Wrote zone: ${zone.problem_type} (density=${zone.density_score})\n`);
      } else {
        summary.errors++;
        if (opts.verbose) process.stderr.write(`Failed to write zone: ${zone.problem_type}\n`);
      }
    }

    // 4b. MERGE EXPLORED_BY edges
    const edgeCyphers = buildExploredByEdgeCyphers(zone);
    for (const edgeCypher of edgeCyphers) {
      if (opts.dryRun) {
        process.stderr.write(`[dry-run] Edge:\n${edgeCypher}\n\n`);
        summary.edges_created++;
      } else {
        const ok = await brainWrite(edgeCypher);
        if (ok) {
          summary.edges_created++;
        } else {
          summary.errors++;
          if (opts.verbose) process.stderr.write(`Failed to write EXPLORED_BY edge\n`);
        }
      }
    }
  }

  // 5. Run TYPICAL_WHITESPACE aggregation (BRAIN-02, BRAIN-03)
  const aggCypher = buildAggregationCypher();
  if (opts.dryRun) {
    process.stderr.write(`[dry-run] Aggregation:\n${aggCypher}\n\n`);
    summary.aggregation_ran = true;
  } else {
    const ok = await brainWrite(aggCypher);
    summary.aggregation_ran = ok;
    if (!ok) {
      summary.errors++;
      if (opts.verbose) process.stderr.write('Aggregation query failed\n');
    }
  }

  // 6. Print summary
  console.log(JSON.stringify(summary));
  return summary;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`
Usage: node scripts/whitespace-to-brain.cjs <room-dir> [options]

Write validated whitespace zones to Neo4j Brain as WhitespaceZone nodes
with EXPLORED_BY and TYPICAL_WHITESPACE edges for cross-room learning.

Arguments:
  room-dir             Path to room directory

Options:
  --verbose            Enable verbose logging to stderr
  --dry-run            Print Cypher queries without executing
  --help               Show this help message

Reads:
  {room}/.mindrian/interpretation-results.json

Writes to Brain (Neo4j):
  WhitespaceZone nodes (MERGE by deterministic hash)
  EXPLORED_BY edges (WhitespaceZone -> Framework chain)
  TYPICAL_WHITESPACE edges (ProblemType -> WhitespacePattern aggregation)

Fire-and-forget: always exits 0, never blocks.
Anonymized: no room name or path stored in Brain.

Examples:
  node scripts/whitespace-to-brain.cjs ./room
  node scripts/whitespace-to-brain.cjs ./room --dry-run --verbose
`);
}

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const roomDir = args.find(a => !a.startsWith('-'));
  const isVerbose = args.includes('--verbose');
  const isDryRun = args.includes('--dry-run');

  if (!roomDir) {
    printHelp();
    process.exit(0);
  }

  const resolvedDir = path.resolve(roomDir);
  if (!fs.existsSync(resolvedDir)) {
    process.stderr.write(`Error: ${resolvedDir} does not exist\n`);
    // Fire-and-forget: exit 0 even on error
    process.exit(0);
  }

  main(resolvedDir, { verbose: isVerbose, dryRun: isDryRun })
    .then(() => process.exit(0))
    .catch(err => {
      process.stderr.write(`whitespace-to-brain: ${err.message}\n`);
      // Fire-and-forget: ALWAYS exit 0
      process.exit(0);
    });
}

// ---------------------------------------------------------------------------
// Exports (for testability + programmatic use)
// ---------------------------------------------------------------------------

module.exports = {
  main,
  zoneHash,
  filterValidatedZones,
  buildZoneNodeCypher,
  buildExploredByEdgeCyphers,
  buildAggregationCypher,
};
