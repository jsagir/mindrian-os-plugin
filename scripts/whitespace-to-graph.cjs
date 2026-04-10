#!/usr/bin/env node
/**
 * whitespace-to-graph.cjs -- SQLite Writer for Whitespace Gap Detection Results
 * ==============================================================================
 * Reads .mindrian/whitespace-results.json and creates WhitespaceZone nodes,
 * WHITESPACE_DETECTED edges, WHITESPACE_NEAR edges, and updates artifact
 * novelty_score values in SQLite via lazygraph-ops.cjs.
 *
 * Usage: node scripts/whitespace-to-graph.cjs /path/to/room
 *
 * Migrated from whitespace-to-kuzu.cjs (KuzuDB Cypher) to SQLite prepared statements.
 * Uses the open-use-close pattern from lazygraph-ops.cjs.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  openGraph,
  closeGraph,
  addWhitespaceZone,
  linkWhitespaceToArtifact,
  linkWhitespaceToSection,
} = require('../lib/core/lazygraph-ops.cjs');

/**
 * Generate a deterministic slug from a framework name.
 * @param {string} name
 * @returns {string}
 */
function slugify(name) {
  return (name || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate a deterministic short hash from a string.
 * @param {string} input
 * @returns {string} 8-char hex hash
 */
function shortHash(input) {
  return crypto.createHash('md5').update(input).digest('hex').slice(0, 8);
}

async function main() {
  const roomDir = process.argv[2];
  if (!roomDir) {
    process.stderr.write('Usage: node scripts/whitespace-to-graph.cjs /path/to/room\n');
    process.exit(1);
  }

  const resolvedRoom = path.resolve(roomDir);
  const resultsPath = path.join(resolvedRoom, '.mindrian', 'whitespace-results.json');

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

  if (!data || (!data.gaps && !data.novelty_scores)) {
    process.exit(0);
  }

  const gaps = data.gaps || [];
  const noveltyScores = data.novelty_scores || [];

  // Check for interpretation-results.json (from Phase 62 interpret-whitespace.cjs)
  // If present, use enriched gaps with problem_type and framework_chain
  const interpPath = path.join(resolvedRoom, '.mindrian', 'interpretation-results.json');
  let interpData = null;
  if (fs.existsSync(interpPath)) {
    try {
      interpData = JSON.parse(fs.readFileSync(interpPath, 'utf-8'));
    } catch (e) {
      // Malformed interpretation -- continue with raw gaps
    }
  }

  // Build lookup from interpretation data keyed by brain_framework
  const interpGapMap = {};
  if (interpData && Array.isArray(interpData.gaps)) {
    for (const ig of interpData.gaps) {
      if (ig.brain_framework) {
        interpGapMap[ig.brain_framework] = ig;
      }
    }
  }

  let db;
  try {
    const graph = await openGraph(resolvedRoom);
    db = graph.db;
    const conn = graph.conn;

    // Prepare statement for finding sections via BELONGS_TO edges
    const findSections = conn.prepare(
      "SELECT e.target AS section_name FROM edges e JOIN nodes n ON e.target = n.id WHERE e.source = ? AND e.type = 'BELONGS_TO' AND n.type = 'Section'"
    );

    let zoneCount = 0;
    let edgeCount = 0;
    let nearCount = 0;

    // --- Write WhitespaceZone nodes and WHITESPACE_DETECTED edges ---
    for (const gap of gaps) {
      const framework = gap.brain_framework || 'unknown';
      const slug = slugify(framework);
      const zoneId = `ws-${slug}-${shortHash(framework)}`;

      // Enrich from interpretation-results.json if available
      const interp = interpGapMap[framework] || {};
      const problemType = interp.problem_type || gap.problem_type || '';
      const frameworkChain = interp.framework_chain
        ? JSON.stringify(interp.framework_chain)
        : '[]';

      // Create WhitespaceZone node
      await addWhitespaceZone(conn, {
        id: zoneId,
        brain_framework: framework,
        density_score: gap.density_score || 0.0,
        knn_density: gap.knn_density || 0.0,
        nearest_frameworks: frameworkChain,
        hypothesis: gap.hypothesis || '',
        strategic_rank: gap.strategic_rank || 0.0,
        problem_type: problemType,
        exploration_status: 'detected',
        created: new Date().toISOString(),
      });
      zoneCount++;

      // Create WHITESPACE_DETECTED edges to nearest artifacts
      const nearestArtifacts = gap.nearest_room_artifacts || [];
      for (const artifactId of nearestArtifacts) {
        try {
          await linkWhitespaceToArtifact(conn, zoneId, artifactId, gap.density_score || 0.0);
          edgeCount++;
        } catch (e) {
          // Artifact may not exist in graph -- skip
        }
      }

      // Find sections from nearest artifacts and create WHITESPACE_NEAR edges
      const seenSections = new Set();
      for (const artifactId of nearestArtifacts) {
        try {
          const rows = findSections.all(artifactId);
          for (const row of rows) {
            const sectionName = row.section_name;
            if (sectionName && !seenSections.has(sectionName)) {
              seenSections.add(sectionName);
              await linkWhitespaceToSection(conn, zoneId, sectionName, gap.strategic_rank || 0.0);
              nearCount++;
            }
          }
        } catch (e) {
          // Section lookup failed -- skip
        }
      }
    }

    // --- Update artifact novelty_score values ---
    let noveltyCount = 0;
    for (const entry of noveltyScores) {
      if (!entry.artifact_id || typeof entry.novelty_score !== 'number') continue;
      try {
        // Store novelty scores as lightweight WhitespaceZone nodes (score carriers)
        // since the Artifact properties JSON schema does not include novelty_score
        const scoreId = `ns-${slugify(entry.artifact_id)}`;
        await addWhitespaceZone(conn, {
          id: scoreId,
          brain_framework: `novelty:${entry.artifact_id}`,
          density_score: entry.novelty_score,
          knn_density: entry.novelty_score,
          hypothesis: `Novelty score carrier for artifact: ${entry.artifact_id}`,
          exploration_status: 'resolved',
          created: new Date().toISOString(),
        });
        // Link to the artifact
        await linkWhitespaceToArtifact(conn, scoreId, entry.artifact_id, entry.novelty_score);
        noveltyCount++;
      } catch (e) {
        // Artifact may not exist -- skip
      }
    }

    process.stderr.write(
      `Whitespace: wrote ${zoneCount} zone nodes, ${edgeCount} WHITESPACE_DETECTED edges, ` +
      `${nearCount} WHITESPACE_NEAR edges, ${noveltyCount} novelty scores\n`
    );

  } catch (e) {
    process.stderr.write(`whitespace-to-graph error: ${e.message}\n`);
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
