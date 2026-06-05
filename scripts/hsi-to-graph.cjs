#!/usr/bin/env node
/**
 * hsi-to-graph.cjs -- SQLite Edge Writer for HSI Results
 * ======================================================
 * Reads .hsi-results.json and creates HSI_CONNECTION and REVERSE_SALIENT
 * edges in SQLite (via lazygraph-ops) with hsi_score, lsa_sim, semantic_sim metadata.
 *
 * Usage: node scripts/hsi-to-graph.cjs /path/to/room
 *
 * Migrated from hsi-to-kuzu.cjs (KuzuDB Cypher) to SQLite prepared statements.
 * Uses the open-use-close pattern from lazygraph-ops.cjs.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { openGraph, closeGraph } = require('../lib/core/lazygraph-ops.cjs');
const { insertNode } = require('../lib/core/node-insert.cjs');

async function main() {
  const roomDir = process.argv[2];
  if (!roomDir) {
    process.stderr.write('Usage: node scripts/hsi-to-graph.cjs /path/to/room\n');
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

    // --- Cleanup: delete existing HSI_CONNECTION and REVERSE_SALIENT edges ---
    conn.prepare("DELETE FROM edges WHERE type = 'HSI_CONNECTION'").run();
    conn.prepare("DELETE FROM edges WHERE type = 'REVERSE_SALIENT'").run();

    // --- Prepare reusable statements ---
    const upsertEdge = conn.prepare(
      'INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?) ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties'
    );

    const findArtifact = conn.prepare(
      "SELECT id FROM nodes WHERE id = ? AND type = 'Artifact'"
    );

    const findSection = conn.prepare(
      "SELECT id FROM nodes WHERE id = ? AND type = 'Section'"
    );

    // --- Write HSI_CONNECTION edges ---
    let connEdges = 0;
    for (const pair of hsiPairs) {
      if (pair.hsi_score <= 0.3) continue;

      const leftId = pair.left_id;
      const rightId = pair.right_id;

      // Verify both artifacts exist
      const leftExists = findArtifact.get(leftId);
      const rightExists = findArtifact.get(rightId);
      if (!leftExists || !rightExists) continue;

      const edgeProps = JSON.stringify({
        hsi_score: pair.hsi_score,
        lsa_sim: pair.lsa_sim,
        semantic_sim: pair.semantic_sim,
        surprise_type: pair.surprise_type || '',
        breakthrough_potential: pair.breakthrough_potential || 0,
        tier,
      });

      upsertEdge.run(leftId, rightId, 'HSI_CONNECTION', edgeProps);
      connEdges++;
    }

    // --- Write REVERSE_SALIENT edges ---
    let rsEdges = 0;
    for (const rs of reverseSalients) {
      const srcSection = rs.source_section;
      const tgtSection = rs.target_section;
      if (!srcSection || !tgtSection) continue;

      // Ensure Section nodes exist (upsert)
      const srcLabel = srcSection.replace(/-/g, ' ').toUpperCase();
      const tgtLabel = tgtSection.replace(/-/g, ' ').toUpperCase();
      // HARD-02: route through the shared NOT-NULL-safe helper so the Section
      // upsert supplies the Phase-109 provenance columns on a migrated room.db
      // (and stays a bare 3-col insert on an un-migrated db). D-02 + D-02a.
      insertNode(conn, srcSection, 'Section', JSON.stringify({ name: srcSection, label: srcLabel }));
      insertNode(conn, tgtSection, 'Section', JSON.stringify({ name: tgtSection, label: tgtLabel }));

      const edgeProps = JSON.stringify({
        differential_score: rs.differential_score || 0,
        innovation_type: rs.innovation_type || '',
        source_artifact: rs.source_artifact || '',
        target_artifact: rs.target_artifact || '',
        innovation_thesis: rs.innovation_thesis || '',
      });

      upsertEdge.run(srcSection, tgtSection, 'REVERSE_SALIENT', edgeProps);
      rsEdges++;
    }

    process.stderr.write(
      `HSI: wrote ${connEdges} connection edges, ${rsEdges} reverse salient edges\n`
    );

  } catch (e) {
    process.stderr.write(`HSI-to-graph error: ${e.message}\n`);
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
