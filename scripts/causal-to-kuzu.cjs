#!/usr/bin/env node
/**
 * causal-to-kuzu.cjs -- KuzuDB Edge Writer for Causal Results
 * ============================================================
 * Reads .causal-results.json and creates CausalClaim nodes,
 * CAUSES edges, CASCADES_TO edges, and EXTRACTED_FROM edges in KuzuDB.
 *
 * Follows the same open-use-close pattern as hsi-to-kuzu.cjs.
 * Brain is READ-ONLY from causal layer. All writes go to local KuzuDB.
 *
 * Usage: node scripts/causal-to-kuzu.cjs /path/to/room
 *
 * v1.7.0: Initial causal reasoning layer.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  openGraph,
  closeGraph,
  createCausalClaim,
  createCausesEdge,
  createCascadeEdge,
  queryGraph,
} = require('../lib/core/lazygraph-ops.cjs');

/**
 * Escape single quotes for Cypher string literals.
 * @param {string} str
 * @returns {string}
 */
function esc(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'");
}

async function main() {
  const roomDir = process.argv[2];
  if (!roomDir) {
    process.stderr.write('Usage: node scripts/causal-to-kuzu.cjs /path/to/room\n');
    process.exit(1);
  }

  const resolvedRoom = path.resolve(roomDir);
  const resultsPath = path.join(resolvedRoom, '.causal-results.json');

  // Exit silently if no results file
  if (!fs.existsSync(resultsPath)) {
    process.exit(0);
  }

  let data;
  try {
    const raw = fs.readFileSync(resultsPath, 'utf-8');
    data = JSON.parse(raw);
  } catch (e) {
    process.exit(0);
  }

  if (!data || !data.claims) {
    process.exit(0);
  }

  const claims = data.claims || [];
  const cascades = data.cascades || [];
  const chains = data.chains || [];

  let db;
  try {
    const graph = await openGraph(resolvedRoom);
    db = graph.db;
    const conn = graph.conn;

    // --- Cleanup: delete existing causal data (fresh recomputation each run) ---
    try {
      await conn.query('MATCH (c:CausalClaim)-[r:CAUSES]->(d:CausalClaim) DELETE r');
    } catch (e) { /* no edges yet */ }
    try {
      await conn.query('MATCH (c:CausalClaim)-[r:CASCADES_TO]->(d:CausalClaim) DELETE r');
    } catch (e) { /* no edges yet */ }
    try {
      await conn.query('MATCH (c:CausalClaim)-[r:EXTRACTED_FROM]->(a:Artifact) DELETE r');
    } catch (e) { /* no edges yet */ }
    try {
      await conn.query('MATCH (c:CausalClaim) DELETE c');
    } catch (e) { /* no nodes yet */ }

    // --- Write CausalClaim nodes ---
    let claimNodes = 0;
    for (const claim of claims) {
      try {
        await createCausalClaim(conn, {
          id: claim.id,
          cause: claim.cause,
          effect: claim.effect,
          mechanism: claim.mechanism || '',
          confidence: claim.confidence || 0.5,
          evidence: claim.evidence || [],
          source_artifact: claim.source_artifact || '',
          domain: claim.domain || '',
          falsifiable_prediction: claim.falsifiable_prediction || '',
          novelty_score: claim.novelty_score || 0.0,
          created: claim.created || '',
        });
        claimNodes++;
      } catch (e) {
        process.stderr.write(`Causal: failed to create claim ${claim.id}: ${e.message}\n`);
      }
    }

    // --- Write CAUSES edges from chains ---
    // Each chain is an ordered list of claim IDs.
    // Create CAUSES edge between consecutive claims in each chain.
    let causesEdges = 0;
    for (const chain of chains) {
      for (let i = 0; i < chain.length - 1; i++) {
        try {
          await createCausesEdge(conn, chain[i], chain[i + 1], {
            strength: 0.6,
            mechanism: '',
            direction: 'forward',
            discovery_method: 'heuristic',
          });
          causesEdges++;
        } catch (e) {
          // Claims may not exist -- skip
        }
      }
    }

    // --- Write CASCADES_TO edges ---
    let cascadeEdges = 0;
    for (const cascade of cascades) {
      try {
        await createCascadeEdge(conn, cascade.source_claim, cascade.target_claim, {
          cascade_type: cascade.cascade_type || 'invalidation',
          severity: cascade.severity || 'medium',
          path_length: cascade.path_length || 1,
        });
        cascadeEdges++;
      } catch (e) {
        // Skip on error
      }
    }

    process.stderr.write(
      `Causal: wrote ${claimNodes} claim nodes, ${causesEdges} CAUSES edges, ${cascadeEdges} CASCADES_TO edges\n`
    );

  } catch (e) {
    process.stderr.write(`Causal-to-KuzuDB error: ${e.message}\n`);
    process.exit(1);
  } finally {
    if (db) {
      try {
        await closeGraph(db);
      } catch (e) {
        // Ignore close errors
      }
    }
  }
}

main();
