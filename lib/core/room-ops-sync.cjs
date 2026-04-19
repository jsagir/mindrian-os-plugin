/**
 * MindrianOS Plugin -- Room Ops (SYNC entry point)
 * =================================================
 * execSync-based variants of the public room-ops surface. Import this from
 * CLI scripts / hook scripts that expect synchronous return values.
 *
 * NEVER import from lib/mcp/* -- MCP handlers must use room-ops-async.cjs
 * so blocking subprocess I/O doesn't stall the MCP request loop.
 *
 * Phase 87-04 sync/async split (CASCADE-06).
 *
 * License: BSL 1.1 (Business Source License 1.1) -- see LICENSE.
 */

'use strict';

const path = require('path');
const { execSync } = require('child_process');
const { discoverSections } = require('./section-registry.cjs');
const { resolveRoom } = require('./room-ops-shared.cjs');

const SCRIPTS_DIR = path.resolve(__dirname, '../../scripts');

/**
 * List discovered sections with metadata (synchronous).
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
 * Run analyze-room script against a room directory (synchronous).
 * Returns raw stdout as string.
 * @param {string} roomDir - Path to room directory
 * @returns {string} Raw script output
 */
function analyzeRoom(roomDir) {
  const resolved = path.resolve(roomDir);
  const scriptPath = path.join(SCRIPTS_DIR, 'analyze-room');
  try {
    return execSync(`bash "${scriptPath}" "${resolved}"`, {
      timeout: 10000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (e) {
    throw new Error(`analyze-room failed: ${e.message}`);
  }
}

module.exports = { listSections, analyzeRoom, resolveRoom };
