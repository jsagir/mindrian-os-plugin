/**
 * MindrianOS Plugin -- Git Operations
 * Wraps existing Bash scripts via execSync. Does NOT rewrite Bash logic.
 * commitArtifact uses execFileSync with an argument array: the commit message, the file path and the room path are data, never shell text (quick 261030-eo7).
 * Pure Node.js built-ins only.
 *
 * Every function returns a safe default on error. No function ever throws.
 * Git operations are ENHANCEMENTS, not gates.
 */

'use strict';

const { execSync, execFileSync } = require('child_process');
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
 * The message, the file path and the room path go to bash as argv items, never as shell text (quick 261030-eo7).
 * Plan 400.3-03b (review B1, owner answer OA-4): the result says what happened. scripts/git-ops commit exits 0
 * after a commit, 3 with a 'skipped: <reason>' word on stderr (not_a_repo, not_own_repo, no_file,
 * nothing_to_commit) and 1 with a 'failed: <reason>' word (add_failed, commit_failed). Never throws.
 * @returns {{ committed: true, message: string }
 *   | { committed: false, skipped: true, reason: string, message: string }
 *   | { committed: false, failed: true, reason: string, message: string }}
 */
function commitArtifact(roomDir, filePath, message) {
  try {
    if (message && typeof message !== 'string') throw new TypeError('commit message must be a string');
    const resolved = path.resolve(roomDir);
    const resolvedFile = path.resolve(filePath);
    const scriptPath = path.join(SCRIPTS_DIR, 'git-ops');
    const args = message ? [scriptPath, 'commit', resolved, resolvedFile, message] : [scriptPath, 'commit', resolved, resolvedFile];
    execFileSync('bash', args, {
      timeout: 10000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { committed: true, message: message || 'auto-generated' };
  } catch (e) {
    if (e instanceof TypeError) {
      return { committed: false, failed: true, reason: 'invalid_message', message: 'failed: invalid_message' };
    }
    const stderr = e && e.stderr ? String(e.stderr) : '';
    const word = (prefix) => {
      const m = stderr.match(new RegExp(prefix + ': ([a-z_]+)'));
      return m ? m[1] : 'unknown';
    };
    if (e && e.status === 3) {
      const reason = word('skipped');
      return { committed: false, skipped: true, reason: reason, message: 'skipped: ' + reason };
    }
    if (e && e.status === 1) {
      const reason = word('failed');
      return { committed: false, failed: true, reason: reason, message: 'failed: ' + reason };
    }
    return { committed: false, failed: true, reason: 'spawn_failed', message: 'failed: spawn_failed' };
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
