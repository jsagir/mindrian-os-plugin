/**
 * MindrianOS Plugin — Graph Operations
 * Wraps existing Bash scripts via execSync. Does NOT rewrite Bash logic.
 * Pure Node.js built-ins only.
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');

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

module.exports = { buildGraph };
