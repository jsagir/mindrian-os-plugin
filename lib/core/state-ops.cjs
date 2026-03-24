/**
 * MindrianOS Plugin — State Operations
 * Wraps existing Bash scripts via execSync. Does NOT rewrite Bash logic.
 * Pure Node.js built-ins only.
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');
const { safeReadFile } = require('./index.cjs');

const SCRIPTS_DIR = path.resolve(__dirname, '../../scripts');

/**
 * Run compute-state script against a room directory.
 * Returns raw stdout as string.
 * @param {string} roomDir - Path to room directory
 * @returns {string} Raw script output
 */
function computeState(roomDir) {
  const resolved = path.resolve(roomDir);
  const scriptPath = path.join(SCRIPTS_DIR, 'compute-state');
  try {
    const result = execSync(`bash "${scriptPath}" "${resolved}"`, {
      timeout: 10000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result;
  } catch (e) {
    throw new Error(`compute-state failed: ${e.message}`);
  }
}

/**
 * Read the room's STATE.md file directly.
 * @param {string} roomDir - Path to room directory
 * @returns {string|null} STATE.md contents or null if not found
 */
function getState(roomDir) {
  const resolved = path.resolve(roomDir);
  return safeReadFile(path.join(resolved, 'STATE.md'));
}

module.exports = { computeState, getState };
