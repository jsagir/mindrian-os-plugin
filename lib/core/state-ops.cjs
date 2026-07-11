/**
 * MindrianOS Plugin — State Operations
 * Wraps existing Bash scripts via execSync. Does NOT rewrite Bash logic.
 * Pure Node.js built-ins only.
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { safeReadFile } = require('./index.cjs');

const SCRIPTS_DIR = path.resolve(__dirname, '../../scripts');

/**
 * Run compute-state script against a room directory and persist the result.
 *
 * intern-w1-state-not-recomputed: scripts/compute-state only prints the
 * STATE.md body to stdout by design - it never writes the file itself, so
 * every caller owns persistence. This wrapper used to return the stdout and
 * let the caller forget the write; the MCP room_state compute-state command
 * did exactly that while its own response text claimed "State updated".
 * Persisting here, at the single Node chokepoint, fixes every current and
 * future caller of computeState() at once instead of re-implementing the
 * redirect at each call site.
 *
 * @param {string} roomDir - Path to room directory
 * @returns {string} Raw script output (also written to STATE.md)
 */
function computeState(roomDir) {
  const resolved = path.resolve(roomDir);
  const scriptPath = path.join(SCRIPTS_DIR, 'compute-state');
  let result;
  try {
    result = execSync(`bash "${scriptPath}" "${resolved}"`, {
      timeout: 10000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (e) {
    throw new Error(`compute-state failed: ${e.message}`);
  }
  fs.writeFileSync(path.join(resolved, 'STATE.md'), result);
  return result;
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
