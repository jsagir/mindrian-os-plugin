/**
 * MindrianOS Plugin — Meeting Operations
 * Wraps existing Bash scripts via execSync. Does NOT rewrite Bash logic.
 * Pure Node.js built-ins only.
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');

const SCRIPTS_DIR = path.resolve(__dirname, '../../scripts');

/**
 * Run compute-meetings-intelligence script against a room directory.
 * @param {string} roomDir - Path to room directory
 * @returns {string} Raw script output
 */
function computeMeetingsIntel(roomDir) {
  const resolved = path.resolve(roomDir);
  const scriptPath = path.join(SCRIPTS_DIR, 'compute-meetings-intelligence');
  try {
    const result = execSync(`bash "${scriptPath}" "${resolved}"`, {
      timeout: 30000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result;
  } catch (e) {
    throw new Error(`compute-meetings-intelligence failed: ${e.message}`);
  }
}

/**
 * Run compute-team script against a room directory.
 * @param {string} roomDir - Path to room directory
 * @returns {string} Raw script output
 */
function computeTeam(roomDir) {
  const resolved = path.resolve(roomDir);
  const scriptPath = path.join(SCRIPTS_DIR, 'compute-team');
  try {
    const result = execSync(`bash "${scriptPath}" "${resolved}"`, {
      timeout: 30000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result;
  } catch (e) {
    throw new Error(`compute-team failed: ${e.message}`);
  }
}

module.exports = { computeMeetingsIntel, computeTeam };
