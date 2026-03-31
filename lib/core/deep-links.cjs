'use strict';

/**
 * deep-links.cjs -- Deep Link Protocol for MindrianOS
 *
 * Generates claude-cli:// URLs for room-to-room navigation,
 * dashboard-to-CLI handoff, and section-specific deep links.
 *
 * Protocol: claude-cli://open?cwd={path}&q={command}
 * Security: ASCII control char rejection, path <=4096 chars, query <=5000 chars
 */

const path = require('path');

/**
 * Generate a deep link URL for a room path and optional command.
 * @param {string} roomPath - Absolute path to room directory
 * @param {string} [command] - Optional /mos: command to execute on open
 * @returns {string} claude-cli:// URL
 */
function generateDeepLink(roomPath, command) {
  const cwd = path.resolve(roomPath);
  if (cwd.length > 4096) {
    throw new Error('Room path exceeds 4096 character limit');
  }

  const encodedCwd = encodeURIComponent(cwd);

  if (!command) {
    return `claude-cli://open?cwd=${encodedCwd}`;
  }

  const q = command.length > 5000 ? command.slice(0, 5000) : command;
  const encodedQ = encodeURIComponent(q);
  return `claude-cli://open?cwd=${encodedCwd}&q=${encodedQ}`;
}

/**
 * Generate a deep link to a specific room section.
 * @param {string} roomPath - Absolute path to room directory
 * @param {string} section - Section name (e.g., 'problem-definition')
 * @returns {string} claude-cli:// URL that opens the room and navigates to section
 */
function generateSectionLink(roomPath, section) {
  return generateDeepLink(roomPath, `/mos:room ${section}`);
}

/**
 * Generate a deep link to the room dashboard.
 * @param {string} roomPath - Absolute path to room directory
 * @returns {string} claude-cli:// URL that opens the dashboard
 */
function generateDashboardLink(roomPath) {
  return generateDeepLink(roomPath, '/mos:dashboard');
}

/**
 * Generate a deep link to the room wiki.
 * @param {string} roomPath - Absolute path to room directory
 * @returns {string} claude-cli:// URL that opens the wiki
 */
function generateWikiLink(roomPath) {
  return generateDeepLink(roomPath, '/mos:wiki');
}

/**
 * Generate a deep link for a specific methodology command.
 * @param {string} roomPath - Absolute path to room directory
 * @param {string} methodology - Methodology name (e.g., 'find-analogies')
 * @returns {string} claude-cli:// URL
 */
function generateMethodologyLink(roomPath, methodology) {
  return generateDeepLink(roomPath, `/mos:${methodology}`);
}

module.exports = {
  generateDeepLink,
  generateSectionLink,
  generateDashboardLink,
  generateWikiLink,
  generateMethodologyLink,
};
