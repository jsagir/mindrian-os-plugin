/**
 * MindrianOS Plugin — Room Operations
 * Wraps existing Bash scripts via execSync. Does NOT rewrite Bash logic.
 * Pure Node.js built-ins only.
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
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

/**
 * Resolve the active room directory path.
 * Strategy 1: Read .rooms/registry.json
 * Strategy 2: Fall back to room/ directory
 * @param {string} workDir - Workspace root directory
 * @returns {string|null} Absolute room path, or null if no room found
 */
function resolveRoom(workDir) {
  const resolved = path.resolve(workDir);
  const registryPath = path.join(resolved, '.rooms', 'registry.json');

  // Strategy 1: Registry
  if (fs.existsSync(registryPath)) {
    try {
      const reg = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      if (reg.active && reg.rooms && reg.rooms[reg.active]) {
        const roomPath = path.resolve(resolved, reg.rooms[reg.active].path);
        if (fs.existsSync(roomPath)) return roomPath;
      }
    } catch (e) { /* fall through to legacy */ }
  }

  // Strategy 2: Legacy
  const legacy = path.join(resolved, 'room');
  if (fs.existsSync(legacy)) return legacy;

  return null;
}

module.exports = { listSections, analyzeRoom, resolveRoom };
