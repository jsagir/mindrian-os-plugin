#!/usr/bin/env node
/**
 * hsi-to-kuzu.cjs -- KuzuDB Edge Writer for HSI Results
 * ======================================================
 * Reads .hsi-results.json and creates HSI_CONNECTION and REVERSE_SALIENT
 * edges in KuzuDB with hsi_score, lsa_sim, semantic_sim metadata.
 *
 * Usage: node scripts/hsi-to-kuzu.cjs /path/to/room
 *
 * Follows the open-use-close pattern established in Phase 15.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { openGraph, closeGraph, queryGraph } = require('../lib/core/lazygraph-ops.cjs');

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
    process.stderr.write('Usage: node scripts/hsi-to-kuzu.cjs /path/to/room\n');
    process.exit(1);
  }

  const resolvedRoom = path.resolve(roomDir);
  const resultsPath = path.join(resolvedRoom, '.hsi-results.json');

  // Exit silently if no results file
  if (!fs.existsSync(resultsPath)) {
    process.exit(0);
  }

  // Read and parse results
  let data;
  try {
    const raw = fs.readFileSync(resultsPath, 'utf-8');
    data = JSON.parse(raw);
  } catch (e) {
    // Malformed or empty -- exit silently
    process.exit(0);
  }

  if (!data || (!data.hsi_pairs && !data.reverse_salients)) {
    process.exit(0);
  }

  const hsiPairs = data.hsi_pairs || [];
  const reverseSalients = data.reverse_salients || [];
  const tier = data.metadata?.tier ? `tier${data.metadata.tier}` : 'tier1';

  let db;
  try {
    const graph = await openGraph(resolvedRoom);
    db = graph.db;
    const conn = graph.conn;

    // --- Cleanup: delete existing HSI edges (fresh recomputation each run) ---
    try {
      await conn.query('MATCH (a:Artifact)-[r:HSI_CONNECTION]->(b:Artifact) DELETE r');
    } catch (e) {
      // Table may not have any edges yet -- ignore
    }
    try {
      await conn.query('MATCH (s1:Section)-[r:REVERSE_SALIENT]->(s2:Section) DELETE r');
    } catch (e) {
      // Table may not have any edges yet -- ignore
    }

    // --- Write HSI_CONNECTION edges ---
    let connEdges = 0;
    for (const pair of hsiPairs) {
      if (pair.hsi_score <= 0.3) continue;

      const leftId = esc(pair.left_id);
      const rightId = esc(pair.right_id);
      const surpriseType = esc(pair.surprise_type || '');

      try {
        await conn.query(
          `MATCH (a:Artifact {id: '${leftId}'}), (b:Artifact {id: '${rightId}'})
           MERGE (a)-[r:HSI_CONNECTION]->(b)
           ON CREATE SET r.hsi_score = ${pair.hsi_score},
                         r.lsa_sim = ${pair.lsa_sim},
                         r.semantic_sim = ${pair.semantic_sim},
                         r.surprise_type = '${surpriseType}',
                         r.breakthrough_potential = ${pair.breakthrough_potential || 0},
                         r.tier = '${esc(tier)}'
           ON MATCH SET  r.hsi_score = ${pair.hsi_score},
                         r.lsa_sim = ${pair.lsa_sim},
                         r.semantic_sim = ${pair.semantic_sim},
                         r.surprise_type = '${surpriseType}',
                         r.breakthrough_potential = ${pair.breakthrough_potential || 0},
                         r.tier = '${esc(tier)}'`
        );
        connEdges++;
      } catch (e) {
        // Artifact nodes may not exist -- skip pair
      }
    }

    // --- Write REVERSE_SALIENT edges ---
    let rsEdges = 0;
    for (const rs of reverseSalients) {
      const srcSection = esc(rs.source_section);
      const tgtSection = esc(rs.target_section);
      const innovType = esc(rs.innovation_type || '');
      const srcArt = esc(rs.source_artifact || '');
      const tgtArt = esc(rs.target_artifact || '');
      const thesis = esc(rs.innovation_thesis || '');

      try {
        // Ensure Section nodes exist
        await conn.query(
          `MERGE (s:Section {name: '${srcSection}'})`
        );
        await conn.query(
          `MERGE (s:Section {name: '${tgtSection}'})`
        );

        // Create REVERSE_SALIENT edge
        await conn.query(
          `MATCH (s1:Section {name: '${srcSection}'}), (s2:Section {name: '${tgtSection}'})
           MERGE (s1)-[r:REVERSE_SALIENT]->(s2)
           ON CREATE SET r.differential_score = ${rs.differential_score || 0},
                         r.innovation_type = '${innovType}',
                         r.source_artifact = '${srcArt}',
                         r.target_artifact = '${tgtArt}',
                         r.innovation_thesis = '${thesis}'
           ON MATCH SET  r.differential_score = ${rs.differential_score || 0},
                         r.innovation_type = '${innovType}',
                         r.source_artifact = '${srcArt}',
                         r.target_artifact = '${tgtArt}',
                         r.innovation_thesis = '${thesis}'`
        );
        rsEdges++;
      } catch (e) {
        // Skip on error
      }
    }

    process.stderr.write(
      `HSI: wrote ${connEdges} connection edges, ${rsEdges} reverse salient edges\n`
    );

  } catch (e) {
    process.stderr.write(`HSI-to-KuzuDB error: ${e.message}\n`);
    process.exit(1);
  } finally {
    if (db) {
      try {
        await closeGraph(db);
      } catch (e) {
        // Ignore close errors (KuzuDB segfault on exit is known)
      }
    }
  }
}

main();
