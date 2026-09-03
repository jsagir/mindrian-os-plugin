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
 *
 * MOAT-01: the cleanup DELETE plus BOTH edge write loops ride ONE transaction,
 * so a crash or a concurrent reader can never observe a zeroed scoring layer.
 * MINDRIAN_HSI_CRASH_TEST_DELAY_MS is a test-only seam with no production
 * effect: unset or non-numeric parses to 0, and the guarded branch never runs.
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

  // Test-only seam for MOAT-01's crash-injection gate, consumed by
  // tests/test-242-hsi-to-graph-transaction.cjs. Inert in production: the env
  // var is unset there, so this parses to 0 and the guarded branch inside the
  // HSI_CONNECTION loop never runs. The trailing || 0 floors a non-numeric
  // value to 0 rather than letting NaN through.
  const crashTestDelayMs = Number.parseInt(process.env.MINDRIAN_HSI_CRASH_TEST_DELAY_MS || '0', 10) || 0;

  let db;
  try {
    const graph = await openGraph(resolvedRoom);
    db = graph.db;
    const conn = graph.conn;

    // --- MOAT-01: ONE transaction around the DELETE plus BOTH write loops ---
    // Wrapping only the DELETEs would leave the exact crash window this closes:
    // the prior scoring layer gone, the new one not yet written. node:sqlite's
    // DatabaseSync exposes no transaction(fn) higher-order helper (that is a
    // better-sqlite3 API), so explicit BEGIN/COMMIT/ROLLBACK is the only idiom
    // available -- the same one lazygraph-ops.cjs rebuildGraph already uses.
    conn.prepare('BEGIN').run();
    try {
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

        if (crashTestDelayMs > 0) {
          // One-shot marker on the FIRST written edge, so the crash-injection
          // test kills at a deterministic point INSIDE the open transaction
          // instead of racing a timer against an unknown loop position.
          if (connEdges === 1) {
            process.stderr.write('HSI-CRASH-SEAM: in-transaction\n');
          }
          // Synchronous park, deliberately: this write loop is synchronous, so
          // an await here would restructure production control flow, and
          // SIGKILL reaps a thread parked in Atomics.wait exactly the same.
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, crashTestDelayMs);
        }
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
        // insertNode issues no BEGIN of its own, so calling it inside this
        // transaction cannot nest one (SQLite rejects a nested BEGIN).
        // R17-02: 'observation' -- system-bookkeeping structural anchor, same
        // class as every other Section writer.
        insertNode(conn, srcSection, 'Section', JSON.stringify({ name: srcSection, label: srcLabel }), { epistemic_type: 'observation' });
        insertNode(conn, tgtSection, 'Section', JSON.stringify({ name: tgtSection, label: tgtLabel }), { epistemic_type: 'observation' });

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

      conn.prepare('COMMIT').run();

      // The summary prints only AFTER the COMMIT, so this script can never
      // report a confident success line about a rewrite that never landed.
      process.stderr.write(
        `HSI: wrote ${connEdges} connection edges, ${rsEdges} reverse salient edges\n`
      );
    } catch (err) {
      try { conn.prepare('ROLLBACK').run(); } catch (_rbErr) { /* ignore */ }
      throw err;
    }

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
