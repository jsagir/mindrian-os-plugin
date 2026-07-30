/**
 * MindrianOS Plugin  -  State Operations
 * Wraps existing Bash scripts via execSync. Does NOT rewrite Bash logic.
 * Pure Node.js built-ins only.
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');
const { safeReadFile } = require('./index.cjs');
const { persistState } = require('./state-version.cjs');

const SCRIPTS_DIR = path.resolve(__dirname, '../../scripts');

/**
 * Run compute-state script against a room directory and persist the result.
 *
 * intern-w1-state-not-recomputed: scripts/compute-state only prints the
 * STATE.md body to stdout by design - it never writes the file itself, so
 * every caller owns persistence. This wrapper used to return the stdout and
 * let the caller forget the write; the MCP room_state compute-state command
 * did exactly that while its own response text claimed "State updated".
 *
 * NOT the single Node chokepoint (correction, Phase 240.1 Plan 02 / CTXL-01,
 * 240.1-RESEARCH.md Finding 1C). CHANGELOG.md:806 previously claimed this
 * function persists "at the single Node chokepoint," but the Finding 1C
 * census measured five other sites that bypass it entirely:
 * lib/core/intelligence-cascade.cjs:492-498, scripts/on-stop:144-145,
 * scripts/on-task-complete:51-55, scripts/on-agent-complete:133, and
 * lib/core/navigation/room-birth.cjs:986-990. Leaving that false claim in
 * place is exactly what produces Pitfall 2 in the next reader: a test that
 * only exercises computeState() proves nothing about the other five sites.
 * Plan 240.1-03 is where the remaining sites are wired.
 *
 * The version-preservation AUTHORITY is lib/core/state-version.cjs, not this
 * function. This function's only responsibility is invoking the bash
 * renderer and handing the rendered string to persistState(), which decides
 * whether to preserve, stamp forward, or refuse the write (CTXL-01).
 *
 * @param {string} roomDir - Path to room directory
 * @param {{withVerdict?: boolean}} [opts] - when withVerdict is true, return
 *   { content, verdict } instead of the raw string. Default behavior
 *   (opts omitted) is UNCHANGED: return the raw string, so every existing
 *   caller stays byte-compatible.
 * @returns {string|{content: string, verdict: object}} Raw script output
 *   (also persisted via state-version.cjs), or the { content, verdict }
 *   envelope when opts.withVerdict is true.
 */
function computeState(roomDir, opts) {
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
  const verdict = persistState(resolved, result);
  if (opts && opts.withVerdict === true) {
    return { content: result, verdict };
  }
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
