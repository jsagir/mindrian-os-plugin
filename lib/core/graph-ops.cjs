/**
 * MindrianOS Plugin — Graph Operations
 * Wraps existing Bash scripts via execSync AND lazygraph-ops.cjs for KuzuDB.
 * build-graph: Bash script wrapper (JSON export for dashboard).
 * index/rebuild/query/stats: KuzuDB via lazygraph-ops.cjs (per-project graph).
 *
 * All lazygraph functions use open-use-close pattern to avoid DB locking.
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');
const lazygraph = require('./lazygraph-ops.cjs');

const SCRIPTS_DIR = path.resolve(__dirname, '../../scripts');

/**
 * Run build-graph script against a room directory.
 * @param {string} roomDir - Path to room directory
 * @param {string} [outputPath] - Output path for graph JSON (defaults to ./dashboard/graph.json)
 * @returns {{ success: boolean, outputPath: string }} Result object
 */
function buildGraph(roomDir, outputPath) {
  const resolved = path.resolve(roomDir);
  const resolvedOutput = outputPath || './dashboard/graph.json';
  const scriptPath = path.join(SCRIPTS_DIR, 'build-graph');
  try {
    execSync(`bash "${scriptPath}" "${resolved}" "${resolvedOutput}"`, {
      timeout: 30000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, outputPath: resolvedOutput };
  } catch (e) {
    throw new Error(`build-graph failed: ${e.message}`);
  }
}

/**
 * Index a single artifact into the per-project KuzuDB graph.
 * Opens graph, indexes artifact, closes graph (open-use-close pattern).
 * @param {string} roomDir - Path to room directory
 * @param {string} filePath - Path to .md file to index
 * @returns {Promise<{ success: boolean, id: string, section: string, title: string }>}
 */
async function indexArtifact(roomDir, filePath) {
  const { db, conn } = await lazygraph.openGraph(roomDir);
  try {
    const result = await lazygraph.indexArtifact(conn, roomDir, filePath);
    return { success: true, id: result.id, section: result.section, title: result.title };
  } finally {
    await lazygraph.closeGraph(db);
  }
}

/**
 * Rebuild the entire per-project KuzuDB graph from all room artifacts.
 * Opens graph, clears and re-indexes everything, closes graph.
 * @param {string} roomDir - Path to room directory
 * @returns {Promise<{ success: boolean, artifacts: number, sections: number }>}
 */
async function rebuildGraph(roomDir) {
  const { db, conn } = await lazygraph.openGraph(roomDir);
  try {
    const result = await lazygraph.rebuildGraph(conn, roomDir);
    return { success: true, artifacts: result.artifacts, sections: result.sections };
  } finally {
    await lazygraph.closeGraph(db);
  }
}

/**
 * Execute a Cypher query against the per-project KuzuDB graph.
 * Opens graph, runs query, closes graph.
 * @param {string} roomDir - Path to room directory
 * @param {string} cypher - Cypher query string
 * @returns {Promise<{ success: boolean, rows: Array<object>, count: number }>}
 */
async function queryGraph(roomDir, cypher) {
  const { db, conn } = await lazygraph.openGraph(roomDir);
  try {
    const rows = await lazygraph.queryGraph(conn, cypher);
    return { success: true, rows, count: rows.length };
  } finally {
    await lazygraph.closeGraph(db);
  }
}

/**
 * Get graph statistics from the per-project KuzuDB graph.
 * Opens graph, gets stats, closes graph.
 * @param {string} roomDir - Path to room directory
 * @returns {Promise<{ nodes: object, edges: object, total: { nodes: number, edges: number } }>}
 */
async function graphStats(roomDir) {
  const { db, conn } = await lazygraph.openGraph(roomDir);
  try {
    return await lazygraph.graphStats(conn);
  } finally {
    await lazygraph.closeGraph(db);
  }
}

module.exports = { buildGraph, indexArtifact, rebuildGraph, queryGraph, graphStats };
