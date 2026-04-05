/**
 * MindrianOS Plugin -- Intelligence Cascade (Shared Module)
 * =========================================================
 * Extracts the intelligence cascade from bash hooks into a shared CJS module.
 * Called by BOTH PostToolUse hook (CLI via mindrian-tools.cjs cascade) and
 * MCP tool handlers (Desktop/Cowork) after write operations.
 *
 * Cascade steps (mirror scripts/post-write):
 *   1. classify-insight (keyword section classification)
 *   2. graph-index (KuzuDB artifact indexing via graph-ops)
 *   3. compute-hsi.py (HSI innovation scores)
 *   4. detect-reverse-salients.py (lagging component detection)
 *   5. hsi-to-kuzu.cjs (write HSI results to KuzuDB)
 *   6. generate-presentation.cjs (regenerate views)
 *
 * Binary files route to file-asset instead of the markdown cascade.
 * Every step is wrapped in try/catch -- failures never break the cascade.
 *
 * @module intelligence-cascade
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFile, execSync } = require('child_process');

const PLUGIN_ROOT = path.resolve(__dirname, '../..');
const SCRIPTS_DIR = path.join(PLUGIN_ROOT, 'scripts');

// Binary file extensions that route to file-asset instead of markdown cascade
const BINARY_EXTENSIONS = new Set([
  'pdf', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp',
  'mp4', 'mov', 'avi', 'mkv', 'webm',
  'mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac',
  'pptx', 'xlsx', 'docx', 'csv', 'zip', 'tar', 'gz'
]);

// Known room sections for binary asset filing
const KNOWN_SECTIONS = [
  'problem-definition', 'market-analysis', 'solution-design',
  'business-model', 'competitive-analysis', 'team-execution',
  'legal-ip', 'financial-model'
];

/**
 * Determine if a file path is inside a room directory.
 * Checks for /room/ or /rooms/ in the path.
 * @param {string} filePath
 * @returns {boolean}
 */
function isRoomFile(filePath) {
  return filePath.includes('/room/') || filePath.includes('/rooms/');
}

/**
 * Find the room root directory by walking up from filePath looking for STATE.md.
 * @param {string} filePath
 * @returns {string|null}
 */
function findRoomDir(filePath) {
  let checkDir = path.dirname(filePath);
  while (checkDir !== '/' && checkDir !== '.') {
    if (fs.existsSync(path.join(checkDir, 'STATE.md'))) {
      return checkDir;
    }
    checkDir = path.dirname(checkDir);
  }
  return null;
}

/**
 * Determine the section name for a binary asset.
 * Mirrors the logic from scripts/post-write lines 56-76.
 * @param {string} roomDir
 * @param {string} filePath
 * @returns {string}
 */
function detectBinarySection(roomDir, filePath) {
  const relPath = path.relative(roomDir, filePath);

  // Check known sections
  for (const section of KNOWN_SECTIONS) {
    if (relPath.startsWith(section + '/') || relPath.startsWith('assets/' + section + '/')) {
      return section;
    }
  }

  // Check meetings
  if (relPath.startsWith('meetings/')) {
    return 'meetings';
  }

  // Fallback: parent directory name
  return path.basename(path.dirname(filePath)) || 'unknown';
}

/**
 * Run the intelligence cascade for a filed artifact.
 *
 * @param {string} roomDir - Absolute path to the room directory
 * @param {Object} options
 * @param {string} options.trigger - What triggered the cascade ('cli-hook'|'mcp-tool'|'api')
 * @param {string} [options.filePath] - Absolute path to the filed artifact
 * @param {string} [options.section] - Section name (auto-detected if not provided)
 * @returns {Promise<Object>} Results object with status of each cascade step
 */
async function runCascade(roomDir, { trigger, filePath, section } = {}) {
  const results = {
    trigger,
    roomDir,
    filePath: filePath || null,
    skipped: false,
    classification: null,
    graphIndex: null,
    hsi: null,
    reverseSalients: null,
    hsiBridge: null,
    presentation: null,
    binaryAsset: null
  };

  // Guard: no file path means nothing to process
  if (!filePath) {
    results.skipped = true;
    results.skipReason = 'no filePath provided';
    return results;
  }

  // Guard: file must be inside a room
  if (!isRoomFile(filePath)) {
    results.skipped = true;
    results.skipReason = 'filePath not inside a room directory';
    return results;
  }

  // Resolve roomDir if not provided or verify it exists
  const resolvedRoomDir = roomDir || findRoomDir(filePath);
  if (!resolvedRoomDir || !fs.existsSync(resolvedRoomDir)) {
    results.skipped = true;
    results.skipReason = 'roomDir not found or does not exist';
    return results;
  }
  results.roomDir = resolvedRoomDir;

  // Skip STATE.md and ROOM.md (not artifacts)
  const basename = path.basename(filePath);
  if (basename === 'STATE.md' || basename === 'ROOM.md') {
    results.skipped = true;
    results.skipReason = `${basename} is not an artifact`;
    return results;
  }

  // Detect file extension
  const ext = path.extname(filePath).slice(1).toLowerCase();

  // -- Binary file handling --
  if (BINARY_EXTENSIONS.has(ext)) {
    try {
      const assetSection = section || detectBinarySection(resolvedRoomDir, filePath);
      const fileAssetScript = path.join(SCRIPTS_DIR, 'file-asset');
      execFile('bash', [fileAssetScript, resolvedRoomDir, filePath, assetSection], {
        timeout: 10000,
        stdio: ['ignore', 'pipe', 'pipe']
      }, () => {});  // fire-and-forget
      results.binaryAsset = { section: assetSection, status: 'dispatched' };
    } catch (e) {
      results.binaryAsset = { status: 'error', message: e.message };
    }
    return results;
  }

  // -- Markdown cascade (Steps 1-6) --
  const isMd = ext === 'md';

  // Step 1: Classify insight (fire-and-forget for .md files)
  if (isMd) {
    try {
      const classifyScript = path.join(SCRIPTS_DIR, 'classify-insight');
      execFile('bash', [classifyScript, filePath], {
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'pipe']
      }, (err, stdout) => {
        // Non-blocking -- result captured asynchronously
        if (!err && stdout) {
          results.classification = stdout.trim();
        }
      });
      results.classification = 'dispatched';
    } catch (e) {
      results.classification = { status: 'error', message: e.message };
    }
  }

  // Step 2: Graph index (KuzuDB artifact indexing -- direct call to graph-ops)
  if (isMd) {
    try {
      const graphOps = require('./graph-ops.cjs');
      const indexResult = await graphOps.indexArtifact(resolvedRoomDir, filePath);
      results.graphIndex = { status: 'ok', ...indexResult };
    } catch (e) {
      // Graph failures must not break the cascade
      results.graphIndex = { status: 'error', message: e.message };
    }
  }

  // Steps 3-5: HSI computation + reverse salients + KuzuDB bridge
  // Only runs when .lazygraph dir exists (room has been graph-indexed before)
  const lazygraphDir = path.join(resolvedRoomDir, '.lazygraph');
  if (isMd && fs.existsSync(lazygraphDir)) {
    // Step 3: Check HSI deps, then compute HSI
    let hsiSuccess = false;
    try {
      const checkDepsScript = path.join(SCRIPTS_DIR, 'check-hsi-deps');
      execSync(`bash "${checkDepsScript}"`, {
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // HSI deps available -- run computation
      try {
        const hsiScript = path.join(SCRIPTS_DIR, 'compute-hsi.py');
        execSync(`python3 "${hsiScript}" "${resolvedRoomDir}"`, {
          timeout: 5000,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        results.hsi = { status: 'ok' };
        hsiSuccess = true;
      } catch (e) {
        results.hsi = { status: 'error', message: e.message };
      }
    } catch (e) {
      results.hsi = { status: 'skipped', reason: 'HSI deps not available' };
    }

    // Step 4: Reverse salient detection (only after HSI succeeds)
    if (hsiSuccess) {
      try {
        const rsScript = path.join(SCRIPTS_DIR, 'detect-reverse-salients.py');
        execSync(`python3 "${rsScript}" "${resolvedRoomDir}"`, {
          timeout: 5000,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        results.reverseSalients = { status: 'ok' };
      } catch (e) {
        results.reverseSalients = { status: 'error', message: e.message };
      }
    }

    // Step 5: HSI to KuzuDB bridge (only if .hsi-results.json exists)
    const hsiResultsPath = path.join(resolvedRoomDir, '.hsi-results.json');
    if (fs.existsSync(hsiResultsPath)) {
      try {
        const hsiBridgeScript = path.join(SCRIPTS_DIR, 'hsi-to-kuzu.cjs');
        execSync(`node "${hsiBridgeScript}" "${resolvedRoomDir}"`, {
          timeout: 5000,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        results.hsiBridge = { status: 'ok' };
      } catch (e) {
        results.hsiBridge = { status: 'error', message: e.message };
      }
    }
  }

  // Step 6: Presentation regeneration (only if exports/presentation/ exists)
  const presentationDir = path.join(resolvedRoomDir, 'exports', 'presentation');
  if (fs.existsSync(presentationDir)) {
    try {
      const presScript = path.join(SCRIPTS_DIR, 'generate-presentation.cjs');
      execSync(`node "${presScript}" "${resolvedRoomDir}" --output "${presentationDir}"`, {
        timeout: 15000,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      results.presentation = { status: 'ok' };
    } catch (e) {
      results.presentation = { status: 'error', message: e.message };
    }
  }

  return results;
}

module.exports = { runCascade };
