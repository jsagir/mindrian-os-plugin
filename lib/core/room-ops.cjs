/**
 * MindrianOS Plugin — Room Operations
 * Wraps existing Bash scripts via execSync. Does NOT rewrite Bash logic.
 * Pure Node.js built-ins only.
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');
const { discoverSections } = require('./section-registry.cjs');

const SCRIPTS_DIR = path.resolve(__dirname, '../../scripts');

/**
 * List discovered sections with metadata.
 * @param {string} roomDir - Path to room directory
 * @returns {{ sections: Array, core_count: number, extended_count: number }}
 */
function listSections(roomDir) {
  const resolved = path.resolve(roomDir);
  const discovery = discoverSections(resolved);

  const sections = discovery.all.map(name => {
    const meta = discovery.getMeta(name);
    return {
      name,
      type: meta.type,
      label: meta.label,
      color: meta.color,
    };
  });

  return {
    sections,
    core_count: discovery.core.length,
    extended_count: discovery.extended.length,
  };
}

/**
 * Run analyze-room script against a room directory.
 * Returns raw stdout as string (structured parsing deferred to later phases).
 * @param {string} roomDir - Path to room directory
 * @returns {string} Raw script output
 */
function analyzeRoom(roomDir) {
  const resolved = path.resolve(roomDir);
  const scriptPath = path.join(SCRIPTS_DIR, 'analyze-room');
  try {
    const result = execSync(`bash "${scriptPath}" "${resolved}"`, {
      timeout: 10000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result;
  } catch (e) {
    throw new Error(`analyze-room failed: ${e.message}`);
  }
}

module.exports = { listSections, analyzeRoom };
