/**
 * MindrianOS Plugin -- Exports Log Operations
 * Manages .exports-log.json in room directories for deployment tracking.
 * Pure Node.js built-ins only (fs + path).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const LOG_FILENAME = '.exports-log.json';

/**
 * Read the exports log from a room directory.
 * Returns { deployments: [] } if file is missing or malformed.
 * @param {string} roomDir - Path to room directory
 * @returns {{ deployments: Array<object> }}
 */
function readExportsLog(roomDir) {
  const logPath = path.join(roomDir, LOG_FILENAME);
  try {
    const raw = fs.readFileSync(logPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.deployments)) {
      return { deployments: [] };
    }
    return parsed;
  } catch {
    return { deployments: [] };
  }
}

/**
 * Append a deployment entry to the exports log.
 * Entry shape: { url, timestamp, host, sections, private, project_name }
 * @param {string} roomDir - Path to room directory
 * @param {object} entry - Deployment entry
 * @param {string} entry.url - Deployed URL
 * @param {string} [entry.timestamp] - ISO timestamp (defaults to now)
 * @param {string} [entry.host] - Hosting provider (default: "vercel")
 * @param {string[]} [entry.sections] - Sections deployed (default: ["all"])
 * @param {boolean} [entry.private] - Whether password-protected (default: false)
 * @param {string} [entry.project_name] - Vercel project name
 * @param {string} [entry.password] - Password if private deployment
 * @returns {object} The entry that was logged
 */
function logDeployment(roomDir, entry) {
  const log = readExportsLog(roomDir);
  const fullEntry = {
    url: entry.url || '',
    timestamp: entry.timestamp || new Date().toISOString(),
    host: entry.host || 'vercel',
    sections: entry.sections || ['all'],
    private: entry.private || false,
    project_name: entry.project_name || '',
  };
  // Include password only if private
  if (entry.private && entry.password) {
    fullEntry.password = entry.password;
  }
  log.deployments.push(fullEntry);
  const logPath = path.join(roomDir, LOG_FILENAME);
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + '\n', 'utf-8');
  return fullEntry;
}

/**
 * Get the most recent deployment entry, or null if none.
 * @param {string} roomDir - Path to room directory
 * @returns {object|null}
 */
function getLatestDeployment(roomDir) {
  const log = readExportsLog(roomDir);
  if (log.deployments.length === 0) return null;
  return log.deployments[log.deployments.length - 1];
}

module.exports = { readExportsLog, logDeployment, getLatestDeployment };
