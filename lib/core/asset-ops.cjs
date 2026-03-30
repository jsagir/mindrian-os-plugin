/**
 * MindrianOS Plugin -- Asset Operations
 * Wraps scripts/file-asset via execSync. Pure Node.js built-ins only.
 * Provides manifest reading for dashboard/wiki consumption.
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = path.resolve(__dirname, '../../scripts');

/**
 * File a binary asset into a room with markdown wrapper + manifest update.
 * @param {string} roomDir - Path to room directory
 * @param {string} filePath - Path to the binary file to file
 * @param {string} section - Target section name
 * @param {object} [options] - Optional parameters
 * @param {string} [options.meetingId] - Meeting ID for meeting-mode filing
 * @returns {string} Output from file-asset script (e.g. "FILED:section:type:filename")
 */
function fileAsset(roomDir, filePath, section, options) {
  const resolved = path.resolve(roomDir);
  const resolvedFile = path.resolve(filePath);
  const scriptPath = path.join(SCRIPTS_DIR, 'file-asset');

  let cmd = `bash "${scriptPath}" "${resolved}" "${resolvedFile}" "${section}"`;
  if (options && options.meetingId) {
    cmd += ` --meeting "${options.meetingId}"`;
  }

  try {
    const result = execSync(cmd, {
      timeout: 10000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch (e) {
    throw new Error(`file-asset failed: ${e.message}`);
  }
}

/**
 * Read and parse ASSET_MANIFEST.md from room root.
 * Returns array of asset objects. Empty array if no manifest exists.
 * @param {string} roomDir - Path to room directory
 * @returns {Array<{file: string, type: string, section: string, size: string, date: string, path: string}>}
 */
function readManifest(roomDir) {
  const resolved = path.resolve(roomDir);
  const manifestPath = path.join(resolved, 'ASSET_MANIFEST.md');

  if (!fs.existsSync(manifestPath)) {
    return [];
  }

  const content = fs.readFileSync(manifestPath, 'utf-8');
  const lines = content.split('\n');
  const assets = [];

  // Skip header lines: title, empty, blockquote, empty, table header, separator
  // Find the table by looking for lines starting with |
  let inTable = false;
  let headerSkipped = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      inTable = false;
      headerSkipped = 0;
      continue;
    }

    if (!inTable) {
      inTable = true;
      headerSkipped = 0;
    }

    headerSkipped++;
    // Skip table header row and separator row
    if (headerSkipped <= 2) continue;

    // Parse pipe-delimited columns: | File | Type | Section | Size | Date |
    const cols = trimmed.split('|').map(c => c.trim()).filter(c => c.length > 0);
    if (cols.length < 5) continue;

    // Extract link target from [text](path) pattern in File column
    const fileCol = cols[0];
    const linkMatch = fileCol.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const fileName = linkMatch ? linkMatch[1] : fileCol;
    const filePath = linkMatch ? linkMatch[2] : '';

    assets.push({
      file: fileName,
      type: cols[1],
      section: cols[2],
      size: cols[3],
      date: cols[4],
      path: filePath,
    });
  }

  return assets;
}

/**
 * Regenerate ASSET_MANIFEST.md without filing a new asset.
 * Useful for dashboard refresh.
 * @param {string} roomDir - Path to room directory
 * @returns {string} Output from file-asset --manifest-only
 */
function updateManifest(roomDir) {
  const resolved = path.resolve(roomDir);
  const scriptPath = path.join(SCRIPTS_DIR, 'file-asset');

  try {
    const result = execSync(`bash "${scriptPath}" "${resolved}" --manifest-only`, {
      timeout: 10000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch (e) {
    throw new Error(`file-asset --manifest-only failed: ${e.message}`);
  }
}

/**
 * Get assets filtered by section.
 * @param {string} roomDir - Path to room directory
 * @param {string} section - Section name to filter by
 * @returns {Array<{file: string, type: string, section: string, size: string, date: string, path: string}>}
 */
function getAssetsBySection(roomDir, section) {
  return readManifest(roomDir).filter(a => a.section === section);
}

/**
 * Get assets filtered by type (pdf, image, video, audio, document, archive).
 * @param {string} roomDir - Path to room directory
 * @param {string} type - Asset type to filter by
 * @returns {Array<{file: string, type: string, section: string, size: string, date: string, path: string}>}
 */
function getAssetsByType(roomDir, type) {
  return readManifest(roomDir).filter(a => a.type === type);
}

module.exports = { fileAsset, readManifest, updateManifest, getAssetsBySection, getAssetsByType };
