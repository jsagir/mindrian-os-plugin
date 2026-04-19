/**
 * MindrianOS Plugin -- Room Ops (ASYNC entry point)
 * ==================================================
 * execFile (promisified via util.promisify) variants of the public room-ops
 * surface. Import this from MCP tool-router and any caller that returns a
 * Promise to the MCP runtime.
 *
 * NEVER call from CLI scripts that expect synchronous semantics -- use
 * room-ops-sync.cjs. Key-set parity between sync and async is enforced by
 * lib/memory/sync-async-entry-points.test.cjs.
 *
 * Phase 87-04 sync/async split (CASCADE-06). Eliminates the MCP blocking
 * I/O footgun: env branching inside a single module made it too easy to
 * ship synchronous subprocess I/O into the MCP handler path on accident.
 *
 * License: BSL 1.1 (Business Source License 1.1) -- see LICENSE.
 */

'use strict';

const path = require('path');
const util = require('util');
const { execFile } = require('child_process');
const execFileAsync = util.promisify(execFile);
const { discoverSections } = require('./section-registry.cjs');
const { resolveRoom: resolveRoomShared } = require('./room-ops-shared.cjs');

const SCRIPTS_DIR = path.resolve(__dirname, '../../scripts');

/**
 * List discovered sections with metadata (async).
 * Wraps the pure synchronous discoverSections() call in an async shape for
 * API symmetry with room-ops-sync.cjs.
 * @param {string} roomDir - Path to room directory
 * @returns {Promise<{ sections: Array, core_count: number, extended_count: number }>}
 */
async function listSections(roomDir) {
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
 * Run analyze-room script against a room directory (async).
 * Uses execFile (promisified via util.promisify) rather than the blocking
 * subprocess API, so the MCP handler loop stays non-blocking.
 * @param {string} roomDir - Path to room directory
 * @returns {Promise<string>} Raw script output
 */
async function analyzeRoom(roomDir) {
  const resolved = path.resolve(roomDir);
  const scriptPath = path.join(SCRIPTS_DIR, 'analyze-room');
  try {
    const { stdout } = await execFileAsync('bash', [scriptPath, resolved], {
      timeout: 10000,
      maxBuffer: 10 * 1024 * 1024,
      encoding: 'utf-8',
    });
    return stdout;
  } catch (e) {
    throw new Error(`analyze-room failed: ${e.message}`);
  }
}

/**
 * Resolve the active room directory path (async wrapper around the pure
 * shared implementation). Wrapped in an async function for signature parity
 * with the other async exports and to keep the test's AsyncFunction assertion
 * uniform across every exported function name.
 * @param {string} workDir - Workspace root directory
 * @returns {Promise<string|null>}
 */
async function resolveRoom(workDir) {
  return resolveRoomShared(workDir);
}

module.exports = { listSections, analyzeRoom, resolveRoom };
