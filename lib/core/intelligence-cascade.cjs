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
 *   5. hsi-to-graph.cjs (write HSI results to SQLite graph)
 *   6. generate-presentation.cjs (regenerate views)
 *
 * Optimization layers (Phase 54):
 *   - HSI Debounce: skip recompute if same room written within 30s (HOOK-01)
 *   - Analyze-Room Cache: hash STATE.md, skip if unchanged within 5-min TTL (HOOK-02)
 *   - Write Batching: queue writes, single HSI per batch via 500ms window (HOOK-03)
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
const gitOps = require('./git-ops.cjs');
const { extractTitle } = require('./artifact-id.cjs');
const { extractOpportunities } = require('./opportunity-extractor.cjs');
const { bankOpportunity } = require('./opportunity-ops.cjs');

// ---------------------------------------------------------------------------
// HSI Debounce (HOOK-01)
// ---------------------------------------------------------------------------

/** @type {Map<string, number>} roomDir -> last HSI computation timestamp */
const lastHsiByRoom = new Map();
const HSI_DEBOUNCE_MS = 30000; // 30 seconds

// ---------------------------------------------------------------------------
// Write Batch Queue (HOOK-03)
// ---------------------------------------------------------------------------

const BATCH_WINDOW_MS = 500;

/**
 * @typedef {Object} BatchEntry
 * @property {string[]} files - File paths queued for this room
 * @property {NodeJS.Timeout|null} timeout - Debounce timer
 * @property {Array<{resolve: Function, reject: Function}>} waiters - Promise resolvers
 * @property {Object} options - Cascade options (trigger, section)
 */

/** @type {Map<string, BatchEntry>} roomDir -> batch state */
const batchQueues = new Map();

// ---------------------------------------------------------------------------
// Analyze-Room Cache (HOOK-02)
// ---------------------------------------------------------------------------

/** @type {Map<string, {hash: string, result: object, timestamp: number}>} */
const analyzeRoomCache = new Map();
const ANALYZE_CACHE_TTL = 300000; // 5 minutes

/**
 * Fast djb2 hash for cache keys. Non-crypto, sufficient for content comparison.
 * @param {string} str
 * @returns {string}
 */
function djb2Hash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

/**
 * Get cached analyze-room result if STATE.md content unchanged within TTL.
 *
 * @param {string} roomDir - Path to room directory
 * @returns {{ cached: boolean, result: object|null }} cached=true means cache hit
 */
function getCachedAnalysis(roomDir) {
  const statePath = path.join(roomDir, 'STATE.md');
  let stateContent = '';
  try {
    stateContent = fs.readFileSync(statePath, 'utf8');
  } catch (_e) {
    // No STATE.md -- nothing to cache
    return { cached: false, result: null };
  }

  const hash = djb2Hash(stateContent);
  const entry = analyzeRoomCache.get(roomDir);

  if (entry && entry.hash === hash && (Date.now() - entry.timestamp) < ANALYZE_CACHE_TTL) {
    return { cached: true, result: entry.result };
  }

  return { cached: false, result: null };
}

/**
 * Store an analyze-room result in the cache.
 *
 * @param {string} roomDir
 * @param {object} result - The analysis result to cache
 */
function setAnalysisCache(roomDir, result) {
  const statePath = path.join(roomDir, 'STATE.md');
  let stateContent = '';
  try {
    stateContent = fs.readFileSync(statePath, 'utf8');
  } catch (_e) {
    return;
  }
  analyzeRoomCache.set(roomDir, {
    hash: djb2Hash(stateContent),
    result,
    timestamp: Date.now()
  });
}

/**
 * Invalidate the analyze-room cache for a specific room.
 *
 * @param {string} roomDir
 */
function invalidateAnalysisCache(roomDir) {
  analyzeRoomCache.delete(roomDir);
}

// ---------------------------------------------------------------------------
// Classification frontmatter injection
// ---------------------------------------------------------------------------

/**
 * Inject a classification field into the YAML frontmatter of a markdown file.
 * Idempotent: skips if classification: already exists or no frontmatter found.
 *
 * @param {string} filePath - Absolute path to the .md file
 * @param {string} classification - Classification string (e.g. "CLASSIFIED:market-analysis:HIGH")
 * @returns {boolean} true if injected, false if skipped
 */
function injectClassification(filePath, classification) {
  if (!classification) return false;

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (_e) {
    return false;
  }

  // Must have frontmatter
  if (!content.startsWith('---\n')) return false;

  // Find closing ---
  const fmEnd = content.indexOf('\n---', 4);
  if (fmEnd === -1) return false;

  // Check if classification: already exists (idempotent)
  const frontmatter = content.slice(4, fmEnd);
  if (frontmatter.includes('classification:')) return false;

  // Insert classification line before the closing ---
  const before = content.slice(0, fmEnd);
  const after = content.slice(fmEnd);
  const updated = before + '\nclassification: ' + classification + after;

  fs.writeFileSync(filePath, updated, 'utf8');
  return true;
}

// ---------------------------------------------------------------------------
// Constants and helpers
// ---------------------------------------------------------------------------

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
    binaryAsset: null,
    gitCommit: null
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

  // Step 1: Classify insight (synchronous -- result injected into frontmatter)
  if (isMd) {
    try {
      const classifyScript = path.join(SCRIPTS_DIR, 'classify-insight');
      const classifyOutput = execSync(`bash "${classifyScript}" "${filePath}"`, {
        timeout: 5000,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      }).trim();
      results.classification = classifyOutput || 'UNCERTAIN';

      // Inject classification into artifact YAML frontmatter
      injectClassification(filePath, results.classification);
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
  // HSI Debounce (HOOK-01): skip if same room computed within 30s
  const lazygraphDir = path.join(resolvedRoomDir, '.lazygraph');
  if (isMd && fs.existsSync(lazygraphDir)) {
    const lastHsi = lastHsiByRoom.get(resolvedRoomDir) || 0;
    const now = Date.now();

    if (now - lastHsi < HSI_DEBOUNCE_MS) {
      // Debounced -- skip steps 3, 4, 5 entirely
      results.hsi = { status: 'debounced', lastRun: new Date(lastHsi).toISOString() };
    } else {
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
          // Record successful HSI computation timestamp
          lastHsiByRoom.set(resolvedRoomDir, Date.now());
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
          const hsiBridgeScript = path.join(SCRIPTS_DIR, 'hsi-to-graph.cjs');
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

  // Step 7: Inject artifact ID (deterministic hash from room+section+title+date)
  if (isMd) {
    try {
      const artifactId = require('./artifact-id.cjs');
      const injected = artifactId.injectArtifactId(resolvedRoomDir, filePath);
      results.artifactId = { status: injected ? 'injected' : 'skipped' };
    } catch (e) {
      results.artifactId = { status: 'error', message: e.message };
    }
  }

  // Step 7b: Git commit the filed artifact
  if (isMd) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const title = extractTitle(fileContent, filePath);
      const sectionName = path.basename(path.dirname(filePath));
      const commitMsg = `file(${sectionName}): ${title}`;
      const commitResult = gitOps.commitArtifact(resolvedRoomDir, filePath, commitMsg);
      results.gitCommit = { status: commitResult.committed ? 'ok' : 'skipped', message: commitMsg };
    } catch (e) {
      results.gitCommit = { status: 'error', message: e.message };
    }
  }

  // Step 8: Recompute STATE.md (room state may have changed)
  try {
    const computeStateScript = path.join(SCRIPTS_DIR, 'compute-state');
    execSync(`bash "${computeStateScript}" "${resolvedRoomDir}"`, {
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    results.computeState = { status: 'ok' };
  } catch (e) {
    results.computeState = { status: 'error', message: e.message };
  }

  // Step 9: Rebuild dashboard graph JSON (build-graph updates graph.json)
  try {
    const buildGraphScript = path.join(SCRIPTS_DIR, 'build-graph');
    execSync(`bash "${buildGraphScript}" "${resolvedRoomDir}"`, {
      timeout: 10000,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    results.buildGraph = { status: 'ok' };
  } catch (e) {
    results.buildGraph = { status: 'error', message: e.message };
  }

  // Step 10: Run analyze-room and persist proactive intelligence
  let analyzeOutput = '';
  try {
    const analyzeScript = path.join(SCRIPTS_DIR, 'analyze-room');
    analyzeOutput = execSync(`bash "${analyzeScript}" "${resolvedRoomDir}"`, {
      timeout: 10000,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const proactiveIntel = require('./proactive-intelligence.cjs');
    const intelResult = proactiveIntel.persistIntelligence(resolvedRoomDir, analyzeOutput);
    // Parse current insights and find new/changed findings for Larry to surface
    const parsed = proactiveIntel.parseAnalyzeOutput(analyzeOutput);
    const newFindings = proactiveIntel.getNewFindings(resolvedRoomDir, parsed);
    results.proactiveIntelligence = { status: 'ok', ...intelResult, newFindings };
  } catch (e) {
    results.proactiveIntelligence = { status: 'error', message: e.message };
  }

  // Step 11: Extract and bank opportunities from analyze-room insights
  if (results.proactiveIntelligence && results.proactiveIntelligence.status === 'ok') {
    try {
      const proactiveIntel = require('./proactive-intelligence.cjs');
      const parsed = proactiveIntel.parseAnalyzeOutput(analyzeOutput);
      // Extract framework name from classification (e.g. "CLASSIFIED:market-analysis:HIGH" -> "market-analysis")
      let frameworkName = 'cascade';
      if (typeof results.classification === 'string' && results.classification.startsWith('CLASSIFIED:')) {
        const parts = results.classification.split(':');
        if (parts[1]) frameworkName = parts[1];
      }
      const opportunities = extractOpportunities(parsed, frameworkName, resolvedRoomDir);
      const banked = [];
      for (const opp of opportunities) {
        const result = bankOpportunity(resolvedRoomDir, opp);
        if (result.banked || result.updated) banked.push(result);
      }
      results.opportunityExtraction = {
        status: 'ok',
        extracted: opportunities.length,
        banked: banked.filter(b => b.banked).length,
        updated: banked.filter(b => b.updated).length
      };
    } catch (e) {
      results.opportunityExtraction = { status: 'error', message: e.message };
    }
  }

  // Invalidate analyze-room cache after cascade (room state may have changed)
  invalidateAnalysisCache(resolvedRoomDir);

  return results;
}

/**
 * Queue a cascade request for batched execution.
 * Collects multiple writes within a 500ms window and runs HSI once per batch.
 *
 * Steps 1-2 (classify + graph-index) run for EACH file individually.
 * Steps 3-6 (HSI + reverse salients + bridge + presentation) run ONCE per batch.
 *
 * @param {string} roomDir - Absolute path to the room directory
 * @param {Object} options
 * @param {string} options.trigger - What triggered the cascade
 * @param {string} options.filePath - Absolute path to the filed artifact
 * @param {string} [options.section] - Section name (auto-detected if not provided)
 * @returns {Promise<Object>} Combined batch results
 */
function queueCascade(roomDir, { trigger, filePath, section } = {}) {
  if (!filePath) {
    return Promise.resolve({
      trigger,
      roomDir,
      skipped: true,
      skipReason: 'no filePath provided'
    });
  }

  return new Promise((resolve, reject) => {
    let batch = batchQueues.get(roomDir);

    if (!batch) {
      batch = {
        files: [],
        timeout: null,
        waiters: [],
        options: { trigger, section }
      };
      batchQueues.set(roomDir, batch);
    }

    batch.files.push(filePath);
    batch.waiters.push({ resolve, reject });

    // Reset the debounce timer
    if (batch.timeout) {
      clearTimeout(batch.timeout);
    }

    batch.timeout = setTimeout(async () => {
      const currentBatch = batchQueues.get(roomDir);
      batchQueues.delete(roomDir);

      if (!currentBatch) return;

      try {
        const batchResults = {
          trigger: currentBatch.options.trigger,
          roomDir,
          batchSize: currentBatch.files.length,
          files: currentBatch.files,
          perFile: [],
          hsi: null,
          reverseSalients: null,
          hsiBridge: null,
          presentation: null
        };

        // Run per-file steps (classify + graph-index) for each file
        for (const fp of currentBatch.files) {
          const perFileResult = { filePath: fp, classification: null, graphIndex: null };

          const ext = path.extname(fp).slice(1).toLowerCase();
          const isMd = ext === 'md';
          const resolvedRoomDir = roomDir || findRoomDir(fp);

          if (isMd && resolvedRoomDir) {
            // Step 1: Classify (synchronous -- result injected into frontmatter)
            try {
              const classifyScript = path.join(SCRIPTS_DIR, 'classify-insight');
              const classifyOutput = execSync(`bash "${classifyScript}" "${fp}"`, {
                timeout: 5000,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe']
              }).trim();
              perFileResult.classification = classifyOutput || 'UNCERTAIN';

              // Inject classification into artifact YAML frontmatter
              injectClassification(fp, perFileResult.classification);
            } catch (e) {
              perFileResult.classification = { status: 'error', message: e.message };
            }

            // Step 2: Graph index
            try {
              const graphOps = require('./graph-ops.cjs');
              const indexResult = await graphOps.indexArtifact(resolvedRoomDir, fp);
              perFileResult.graphIndex = { status: 'ok', ...indexResult };
            } catch (e) {
              perFileResult.graphIndex = { status: 'error', message: e.message };
            }
          }

          batchResults.perFile.push(perFileResult);
        }

        // Run shared steps (HSI + reverse salients + bridge + presentation) ONCE
        const resolvedRoomDir = roomDir || findRoomDir(currentBatch.files[0]);
        if (resolvedRoomDir && fs.existsSync(resolvedRoomDir)) {
          const lazygraphDir = path.join(resolvedRoomDir, '.lazygraph');
          if (fs.existsSync(lazygraphDir)) {
            const lastHsi = lastHsiByRoom.get(resolvedRoomDir) || 0;
            const now = Date.now();

            if (now - lastHsi < HSI_DEBOUNCE_MS) {
              batchResults.hsi = { status: 'debounced', lastRun: new Date(lastHsi).toISOString() };
            } else {
              let hsiSuccess = false;
              try {
                const checkDepsScript = path.join(SCRIPTS_DIR, 'check-hsi-deps');
                execSync(`bash "${checkDepsScript}"`, {
                  timeout: 5000,
                  stdio: ['ignore', 'pipe', 'pipe']
                });

                try {
                  const hsiScript = path.join(SCRIPTS_DIR, 'compute-hsi.py');
                  execSync(`python3 "${hsiScript}" "${resolvedRoomDir}"`, {
                    timeout: 5000,
                    stdio: ['ignore', 'pipe', 'pipe']
                  });
                  batchResults.hsi = { status: 'ok' };
                  hsiSuccess = true;
                  lastHsiByRoom.set(resolvedRoomDir, Date.now());
                } catch (e) {
                  batchResults.hsi = { status: 'error', message: e.message };
                }
              } catch (e) {
                batchResults.hsi = { status: 'skipped', reason: 'HSI deps not available' };
              }

              if (hsiSuccess) {
                try {
                  const rsScript = path.join(SCRIPTS_DIR, 'detect-reverse-salients.py');
                  execSync(`python3 "${rsScript}" "${resolvedRoomDir}"`, {
                    timeout: 5000,
                    stdio: ['ignore', 'pipe', 'pipe']
                  });
                  batchResults.reverseSalients = { status: 'ok' };
                } catch (e) {
                  batchResults.reverseSalients = { status: 'error', message: e.message };
                }
              }

              const hsiResultsPath = path.join(resolvedRoomDir, '.hsi-results.json');
              if (fs.existsSync(hsiResultsPath)) {
                try {
                  const hsiBridgeScript = path.join(SCRIPTS_DIR, 'hsi-to-graph.cjs');
                  execSync(`node "${hsiBridgeScript}" "${resolvedRoomDir}"`, {
                    timeout: 5000,
                    stdio: ['ignore', 'pipe', 'pipe']
                  });
                  batchResults.hsiBridge = { status: 'ok' };
                } catch (e) {
                  batchResults.hsiBridge = { status: 'error', message: e.message };
                }
              }
            }
          }

          // Presentation regeneration
          const presentationDir = path.join(resolvedRoomDir, 'exports', 'presentation');
          if (fs.existsSync(presentationDir)) {
            try {
              const presScript = path.join(SCRIPTS_DIR, 'generate-presentation.cjs');
              execSync(`node "${presScript}" "${resolvedRoomDir}" --output "${presentationDir}"`, {
                timeout: 15000,
                stdio: ['ignore', 'pipe', 'pipe']
              });
              batchResults.presentation = { status: 'ok' };
            } catch (e) {
              batchResults.presentation = { status: 'error', message: e.message };
            }
          }

          // Batch step: Inject artifact IDs for each markdown file
          for (const fp of currentBatch.files) {
            if (path.extname(fp).toLowerCase() === '.md') {
              try {
                const artifactId = require('./artifact-id.cjs');
                artifactId.injectArtifactId(resolvedRoomDir, fp);
              } catch (_e) { /* non-critical */ }
            }
          }

          // Batch step: Git commit each filed artifact
          for (const fp of currentBatch.files) {
            if (path.extname(fp).toLowerCase() === '.md') {
              try {
                const fileContent = fs.readFileSync(fp, 'utf8');
                const title = extractTitle(fileContent, fp);
                const sectionName = path.basename(path.dirname(fp));
                const commitMsg = `file(${sectionName}): ${title}`;
                gitOps.commitArtifact(resolvedRoomDir, fp, commitMsg);
              } catch (_e) { /* non-critical */ }
            }
          }

          // Batch step: Recompute STATE.md
          try {
            const computeStateScript = path.join(SCRIPTS_DIR, 'compute-state');
            execSync(`bash "${computeStateScript}" "${resolvedRoomDir}"`, {
              timeout: 5000,
              stdio: ['ignore', 'pipe', 'pipe']
            });
            batchResults.computeState = { status: 'ok' };
          } catch (e) {
            batchResults.computeState = { status: 'error', message: e.message };
          }

          // Batch step: Rebuild dashboard graph JSON
          try {
            const buildGraphScript = path.join(SCRIPTS_DIR, 'build-graph');
            execSync(`bash "${buildGraphScript}" "${resolvedRoomDir}"`, {
              timeout: 10000,
              stdio: ['ignore', 'pipe', 'pipe']
            });
            batchResults.buildGraph = { status: 'ok' };
          } catch (e) {
            batchResults.buildGraph = { status: 'error', message: e.message };
          }

          // Batch step: Persist proactive intelligence
          let analyzeOutput = '';
          try {
            const analyzeScript = path.join(SCRIPTS_DIR, 'analyze-room');
            analyzeOutput = execSync(`bash "${analyzeScript}" "${resolvedRoomDir}"`, {
              timeout: 10000,
              encoding: 'utf8',
              stdio: ['ignore', 'pipe', 'pipe']
            });
            const proactiveIntel = require('./proactive-intelligence.cjs');
            const intelResult = proactiveIntel.persistIntelligence(resolvedRoomDir, analyzeOutput);
            // Parse current insights and find new/changed findings for Larry to surface
            const parsed = proactiveIntel.parseAnalyzeOutput(analyzeOutput);
            const newFindings = proactiveIntel.getNewFindings(resolvedRoomDir, parsed);
            batchResults.proactiveIntelligence = { status: 'ok', ...intelResult, newFindings };
          } catch (e) {
            batchResults.proactiveIntelligence = { status: 'error', message: e.message };
          }

          // Batch step 11: Extract and bank opportunities from analyze-room insights
          if (batchResults.proactiveIntelligence && batchResults.proactiveIntelligence.status === 'ok') {
            try {
              const proactiveIntel = require('./proactive-intelligence.cjs');
              const parsed = proactiveIntel.parseAnalyzeOutput(analyzeOutput);
              const opportunities = extractOpportunities(parsed, 'cascade-batch', resolvedRoomDir);
              const banked = [];
              for (const opp of opportunities) {
                const result = bankOpportunity(resolvedRoomDir, opp);
                if (result.banked || result.updated) banked.push(result);
              }
              batchResults.opportunityExtraction = {
                status: 'ok',
                extracted: opportunities.length,
                banked: banked.filter(b => b.banked).length,
                updated: banked.filter(b => b.updated).length
              };
            } catch (e) {
              batchResults.opportunityExtraction = { status: 'error', message: e.message };
            }
          }

          // Invalidate analyze-room cache
          invalidateAnalysisCache(resolvedRoomDir);
        }

        // Resolve all waiters with the combined result
        for (const waiter of currentBatch.waiters) {
          waiter.resolve(batchResults);
        }
      } catch (err) {
        for (const waiter of currentBatch.waiters) {
          waiter.reject(err);
        }
      }
    }, BATCH_WINDOW_MS);
  });
}

module.exports = {
  runCascade,
  queueCascade,
  getCachedAnalysis,
  setAnalysisCache,
  invalidateAnalysisCache
};
