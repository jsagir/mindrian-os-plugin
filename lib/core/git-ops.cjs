/**
 * MindrianOS Plugin -- Git Operations
 * Wraps existing Bash scripts via execSync. Does NOT rewrite Bash logic.
 * Pure Node.js built-ins only.
 *
 * Every function returns a safe default on error. No function ever throws.
 * Git operations are ENHANCEMENTS, not gates.
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');

const SCRIPTS_DIR = path.resolve(__dirname, '../../scripts');

/**
 * Check if git is enabled for a room directory.
 * @param {string} roomDir - Path to room directory
 * @returns {boolean} true if git is initialized, false otherwise
 */
function isGitEnabled(roomDir) {
  try {
    const resolved = path.resolve(roomDir);
    const scriptPath = path.join(SCRIPTS_DIR, 'git-ops');
    const result = execSync(`bash "${scriptPath}" is-enabled "${resolved}"`, {
      timeout: 5000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim() === 'true';
  } catch (e) {
    return false;
  }
}

/**
 * Commit an artifact file in a room's git repository.
 * @param {string} roomDir - Path to room directory
 * @param {string} filePath - Path to the file to commit
 * @param {string} [message] - Optional commit message (auto-generated if omitted)
 * @returns {{ committed: boolean, message: string }}
 */
function commitArtifact(roomDir, filePath, message) {
  try {
    const resolved = path.resolve(roomDir);
    const resolvedFile = path.resolve(filePath);
    const scriptPath = path.join(SCRIPTS_DIR, 'git-ops');
    const msgArg = message ? ` "${message.replace(/"/g, '\\"')}"` : '';
    execSync(`bash "${scriptPath}" commit "${resolved}" "${resolvedFile}"${msgArg}`, {
      timeout: 10000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { committed: true, message: message || 'auto-generated' };
  } catch (e) {
    return { committed: false, message: 'git not enabled' };
  }
}

/**
 * Push room repo if configured for auto-push.
 * @param {string} roomDir - Path to room directory
 * @returns {boolean} true if push was attempted
 */
function pushIfConfigured(roomDir) {
  try {
    const resolved = path.resolve(roomDir);
    const scriptPath = path.join(SCRIPTS_DIR, 'git-ops');
    execSync(`bash "${scriptPath}" push "${resolved}"`, {
      timeout: 10000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Initialize a git repository in a room directory.
 * @param {string} roomDir - Path to room directory
 * @returns {boolean} true if initialization succeeded
 */
function initRepo(roomDir) {
  try {
    const resolved = path.resolve(roomDir);
    const scriptPath = path.join(SCRIPTS_DIR, 'git-ops');
    const result = execSync(`bash "${scriptPath}" init "${resolved}"`, {
      timeout: 10000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim() === 'initialized';
  } catch (e) {
    return false;
  }
}

/**
 * Set up Git LFS for a room repository.
 * @param {string} roomDir - Path to room directory
 * @returns {boolean} true if LFS setup succeeded or was already configured
 */
function setupLfs(roomDir) {
  try {
    const resolved = path.resolve(roomDir);
    const scriptPath = path.join(SCRIPTS_DIR, 'git-ops');
    execSync(`bash "${scriptPath}" lfs-setup "${resolved}"`, {
      timeout: 10000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Get git status for a room directory.
 * @param {string} roomDir - Path to room directory
 * @returns {{ enabled: boolean, remote?: string|null, auto_push?: string, lfs?: boolean, dirty_files?: number }}
 */
function getStatus(roomDir) {
  try {
    const resolved = path.resolve(roomDir);
    const scriptPath = path.join(SCRIPTS_DIR, 'git-ops');
    const result = execSync(`bash "${scriptPath}" status "${resolved}"`, {
      timeout: 5000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return JSON.parse(result.trim());
  } catch (e) {
    return { enabled: false };
  }
}

module.exports = { isGitEnabled, commitArtifact, pushIfConfigured, initRepo, setupLfs, getStatus };
