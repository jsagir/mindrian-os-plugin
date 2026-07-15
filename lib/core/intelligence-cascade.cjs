/**
 * MindrianOS Plugin -- Intelligence Cascade (Shared Module)
 * Shared cascade body (steps 1-11) called by both the CLI PostToolUse hook
 * (via mindrian-tools.cjs cascade) and MCP tool handlers after write ops.
 *
 * Steps: (1) classify-insight, (2) graph-index, (3) compute-hsi.py,
 * (4) detect-reverse-salients.py, (5) hsi-to-graph.cjs, (6) generate-presentation,
 * (7) inject artifact ID + (7b) git commit, (8) compute-state, (9) build-graph,
 * (10) analyze-room + persistIntelligence, (11) extractOpportunities + bank.
 *
 * Optimization layers (Phase 54): HSI Debounce 30s (HOOK-01), Analyze-Room
 * Cache 5min TTL (HOOK-02), Write Batching 500ms window (HOOK-03). Binary
 * files route to file-asset. Every step wrapped in try/catch; failures never
 * break the cascade.
 *
 * Phase 87-03: cascade body lives once in private `_runCascadeSteps`; both
 * `runCascade` (single artifact, flat return) and `queueCascade` (batch,
 * batch return) delegate to it after their own guards + debounce checks.
 *
 * @module intelligence-cascade
 */

'use strict';

const fs = require('fs');
const path = require('path');
// CR-02 (Phase 224 review): NO shell-string execSync anywhere in this module.
// Every child process runs via argv-array execFileSync/spawn so a file path or
// room path containing $(...), backticks, or quotes is data, never shell code
// (the PostToolUse cascade fires automatically on writes, so an untrusted
// filename was an arbitrary-code-execution vector).
const { execFile, execFileSync, spawn } = require('child_process');

const PLUGIN_ROOT = path.resolve(__dirname, '../..');
const SCRIPTS_DIR = path.join(PLUGIN_ROOT, 'scripts');
const gitOps = require('./git-ops.cjs');
const { extractTitle } = require('./artifact-id.cjs');
const { extractOpportunities } = require('./opportunity-extractor.cjs');
const { bankOpportunity } = require('./opportunity-ops.cjs');
// Phase 87-07 (CASCADE-06): bounded LRU drop-in for the three long-running
// in-memory caches below. Map had no eviction -- distinct-room growth in a
// long-lived MCP server leaked unbounded. LRU exposes Map-parity iteration
// (entries/keys/values/forEach/clear/[Symbol.iterator]) so existing call
// sites (e.g. .get/.set/.has/.delete/.entries/.forEach) keep working with
// zero refactoring. Cap 100 -- generous for single-user sessions, bounded
// for team MCP servers.
const { LRU } = require('./lru-cache.cjs');

// HSI Debounce (HOOK-01): roomDir -> last HSI computation timestamp.
/** @type {LRU} */
const lastHsiByRoom = new LRU(100);
const HSI_DEBOUNCE_MS = 30000; // 30 seconds

// SEC-03 (Phase 87-01): HSI compute timeouts bumped from 5000ms to 30000ms.
// Real rooms with 50+ artifacts exceed 5s on compute-hsi.py and abort mid-run.
// HSI_TIMEOUT_MS is the single source of truth for HSI-path spawn ceilings.
// After Phase 87-03 cascade deduplication, HSI_TIMEOUT_MS is applied at 6
// unique spawn sites inside `_runCascadeSteps` (classify, check-deps,
// compute-hsi, reverse-salients, hsi-bridge, compute-state) rather than 12
// duplicated sites across runCascade + queueCascade. Every HSI-path spawn
// reads HSI_TIMEOUT_MS; future bumps remain a one-line change.
// The 1 intentional 15000ms site (generate-presentation.cjs) stays untouched.
const HSI_TIMEOUT_MS = 30000;

// Write Batch Queue (HOOK-03): roomDir -> { files, timeout, waiters, options }.
const BATCH_WINDOW_MS = 500;
/** @type {LRU} */
const batchQueues = new LRU(100);

// Analyze-Room Cache (HOOK-02): STATE.md hash -> cached analyze-room result.
/** @type {LRU} */
const analyzeRoomCache = new LRU(100);
const ANALYZE_CACHE_TTL = 300000; // 5 minutes

/** djb2 hash for cache keys (non-crypto, sufficient for content comparison). */
function djb2Hash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

/** Get cached analyze-room result if STATE.md unchanged within TTL. */
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

/** Store an analyze-room result in the cache. */
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

/** Invalidate the analyze-room cache for a specific room. */
function invalidateAnalysisCache(roomDir) {
  analyzeRoomCache.delete(roomDir);
}

/**
 * Inject a classification field into the YAML frontmatter of a markdown file.
 * Idempotent: skips if classification: already exists or no frontmatter found.
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

// Binary file extensions that route to file-asset instead of markdown cascade.
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

/** True if filePath is inside a room directory (contains /room/ or /rooms/). */
function isRoomFile(filePath) {
  return filePath.includes('/room/') || filePath.includes('/rooms/');
}

/** Walk up from filePath looking for STATE.md; returns roomDir or null. */
function findRoomDir(filePath) {
  let checkDir = path.dirname(filePath);
  while (checkDir !== '/' && checkDir !== '.') {
    if (fs.existsSync(path.join(checkDir, 'STATE.md'))) return checkDir;
    checkDir = path.dirname(checkDir);
  }
  return null;
}

/** Determine the section name for a binary asset. Mirrors scripts/post-write. */
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

// Phase 150.8-01 (DIKW-02) -- the segmentation-authority seam.
//
// GATE-0 VERDICT (150.6-GATE-0-CASCADE-VERDICT.md line 100): the intelligence
// cascade is FILE-LEVEL ONLY. runCascade fires ONCE per filed file (the
// per-artifact loop `for (const art of artifacts)` has NO inner segment loop);
// the `meetings/` branch in detectBinarySection above is section-LABEL routing,
// not segmentation. A meeting transcript filed as a single .md produces ONE
// file-level cascade pass, never one pass per discourse segment.
//
// Per RESEARCH Pitfall 1 option (a) -- the RECOMMENDED resolution -- we do NOT
// add a per-segment cascade fan-out here (that would fight the LLM-driven design
// and duplicate the extraction layer's job). Instead this guard FORMALIZES and
// EXPOSES the contract so it is testable: for meeting transcripts, the SEGMENT
// level claim minting is the EXTRACTION layer's responsibility (the Claimify
// 4-pass in file-meeting.md Step 3, Plan 03, which calls navigation.writeClaimNode
// per ATOMIC claim). The file-level cascade stays the authority ONLY for
// cross-relationship edges between filed files; it never mints per-segment claims.
//
// The warning sign the GATE-0 verdict names (RESEARCH Pitfall 1): a claim count
// that equals the FILE count instead of the SEGMENT count. assertSegmentAuthority
// gives a downstream test a single boundary to prove that the file-level cascade
// is NOT the claim-minting path for meeting segments -- claim count must track
// segment count, never collapse to one-per-file.
//
// This is purely a documented contract object plus a pure predicate. It is
// additive and behavior-preserving: runCascade, queueCascade, and every
// non-meeting artifact path are untouched (the run-all-150.sh regression proves
// the file-level cascade behavior is unchanged).
const SEGMENT_AUTHORITY = Object.freeze({
  // Who mints claims for meeting transcripts at the SEGMENT grain.
  meetingSegmentMinter: 'extraction',     // file-meeting.md Step 3 (Plan 03)
  meetingSegmentWriter: 'navigation.writeClaimNode',
  // The cascade's role for meetings: file-level cross-relationship edges only.
  cascadeGrain: 'file',
  cascadeMintsPerSegment: false,
  // The GATE-0 warning sign (claim count == file count) is the FAILING condition.
  warningSign: 'claim_count_equals_file_count',
});

// assertSegmentAuthority(observed) -- the testable boundary. Given an observation
// { claimCount, segmentCount, fileCount } produced by filing a meeting transcript,
// returns { ok, reason } proving the file-level cascade is NOT the claim-minting
// path: claim count must track SEGMENT count, not FILE count. A multi-segment
// transcript that minted only fileCount claims (claimCount === fileCount with
// segmentCount > fileCount) is the GATE-0 warning sign and returns ok:false.
function assertSegmentAuthority(observed) {
  if (typeof observed !== 'object' || observed === null) {
    return { ok: false, reason: 'invalid_observation' };
  }
  const claimCount = Number(observed.claimCount);
  const segmentCount = Number(observed.segmentCount);
  const fileCount = Number(observed.fileCount);
  if (!Number.isFinite(claimCount) || !Number.isFinite(segmentCount) || !Number.isFinite(fileCount)) {
    return { ok: false, reason: 'invalid_observation' };
  }
  // The warning sign: a multi-segment transcript whose claim count collapsed to
  // the file count (the file-level-only swallow the GATE-0 verdict warns about).
  if (segmentCount > fileCount && claimCount === fileCount) {
    return { ok: false, reason: 'claim_count_equals_file_count', claimCount: claimCount, segmentCount: segmentCount };
  }
  // The contract holds when claim count tracks segment count.
  if (claimCount !== segmentCount) {
    return { ok: false, reason: 'claim_count_segment_count_mismatch', claimCount: claimCount, segmentCount: segmentCount };
  }
  return { ok: true, claimCount: claimCount, segmentCount: segmentCount };
}

/**
 * Phase 87-03: shared cascade body (steps 1-11). Private helper; runCascade
 * and queueCascade both delegate. Caller pre-resolves roomDir, filters
 * binary files, computes options.debounced. See 87-03 CONTEXT.md.
 *
 * Return shape: { perFile[], hsi, reverseSalients, hsiBridge, presentation,
 * computeState, buildGraph, proactiveIntelligence, opportunityExtraction,
 * hsiRanAt }. Caller updates lastHsiByRoom using hsiRanAt; helper never
 * mutates the module-level debounce Map.
 *
 * @param {string} roomDir
 * @param {Array<{filePath: string, section?: string}>} artifacts
 * @param {{trigger: string, debounced: boolean, frameworkHint?: string}} options
 */
async function _runCascadeSteps(roomDir, artifacts, options) {
  const { debounced = false, frameworkHint } = options || {};

  const stepsResult = {
    perFile: [],
    hsi: null,
    reverseSalients: null,
    hsiBridge: null,
    presentation: null,
    computeState: null,
    buildGraph: null,
    proactiveIntelligence: null,
    opportunityExtraction: null,
    hsiRanAt: null
  };

  // Per-artifact steps (1, 2, 7, 7b) -- classify, graph-index, artifact-id, git commit.
  for (const art of artifacts) {
    const fp = art.filePath;
    const isMd = path.extname(fp).slice(1).toLowerCase() === 'md';

    const entry = {
      filePath: fp,
      classification: null,
      graphIndex: null,
      artifactId: null,
      gitCommit: null
    };

    if (isMd) {
      // Step 1: classify-insight + inject into frontmatter.
      try {
        const classifyScript = path.join(SCRIPTS_DIR, 'classify-insight');
        const classifyOutput = execFileSync('bash', [classifyScript, fp], {
          timeout: HSI_TIMEOUT_MS,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe']
        }).trim();
        entry.classification = classifyOutput || 'UNCERTAIN';
        injectClassification(fp, entry.classification);
      } catch (e) {
        entry.classification = { status: 'error', message: e.message };
      }

      // Step 2: graph-index (SQLite artifact indexing).
      try {
        const graphOps = require('./graph-ops.cjs');
        const indexResult = await graphOps.indexArtifact(roomDir, fp);
        entry.graphIndex = { status: 'ok', ...indexResult };
      } catch (e) {
        entry.graphIndex = { status: 'error', message: e.message };
      }

      // Step 2b (Phase 224 Req 1, D-02 tri-polar): ENQUEUE a per-write derive
      // request + spawn the drain DETACHED. This ONE insertion covers CLI
      // post-write, Desktop/MCP tool-router, and Cowork, because all three run
      // this shared cascade body. It NEVER scores inline (no scoreMeasured on the
      // write-lock, T-224-05): the foreground cost is one small JSON write plus one
      // unref'd spawn (SPEC latency contract: <300ms foreground target). The
      // debounce IS the queue dedupe -- rapid repeat writes to the same file
      // collapse to one entry, the spawn is SKIPPED when the entry was already
      // pending (queued:false -- a drain is already owed for it), and the drain's
      // single-flight lock makes concurrent spawns from a multi-file batch
      // no-op instead of stampeding the encoder. The Phase-169 Stop sweep +
      // SessionStart drain stay registered as a harmless second net (RESEARCH
      // OQ2/OQ3).
      try {
        const { enqueueDerive } = require(path.join(SCRIPTS_DIR, 'gsd-graph-derive-sweep.cjs'));
        const enq = enqueueDerive(roomDir, { filePath: fp });
        // Detached spawn: the async-artifact-auto-commit spawnDetachedWorker pattern
        // (detached true, stdio ignore, env inherited, unref). NEVER awaited (D-02
        // refined: the write must not serialize on the score pass). A test seam
        // (MOS_NO_DETACHED_DERIVE) suppresses the spawn so an in-process drain owns
        // the timing deterministically; production always spawns.
        if (process.env.MOS_NO_DETACHED_DERIVE !== '1' && enq && enq.queued) {
          try {
            const proc = spawn(
              process.execPath,
              // --worker: this spawn IS already the detached worker, so the drain
              // entry point must not re-spawn a second detached copy of itself
              // (the hook-path self-detach added for the 5s SessionStart budget).
              [path.join(SCRIPTS_DIR, 'gsd-graph-derive-drain.cjs'), '--worker', '--room', roomDir],
              { detached: true, stdio: 'ignore', env: process.env }
            );
            proc.unref();
          } catch (_spawnErr) {
            // Soft-fail: the Stop sweep + explicit /mos:graph --derive backfill are
            // the universal net (Phase 210 caution: never block the write).
          }
        }
        entry.deriveEnqueue = { status: 'ok', queued: !!(enq && enq.queued) };
      } catch (e) {
        entry.deriveEnqueue = { status: 'error', message: e.message };
      }

      // Step 7: inject deterministic artifact ID.
      try {
        const artifactId = require('./artifact-id.cjs');
        const injected = artifactId.injectArtifactId(roomDir, fp);
        entry.artifactId = { status: injected ? 'injected' : 'skipped' };
      } catch (e) {
        entry.artifactId = { status: 'error', message: e.message };
      }

      // Step 7b: git commit the filed artifact.
      try {
        const fileContent = fs.readFileSync(fp, 'utf8');
        const title = extractTitle(fileContent, fp);
        const sectionName = path.basename(path.dirname(fp));
        const commitMsg = `file(${sectionName}): ${title}`;
        const commitResult = gitOps.commitArtifact(roomDir, fp, commitMsg);
        entry.gitCommit = { status: commitResult.committed ? 'ok' : 'skipped', message: commitMsg };
      } catch (e) {
        entry.gitCommit = { status: 'error', message: e.message };
      }
    }

    stepsResult.perFile.push(entry);
  }

  // Shared steps (3-6, 8-11) -- run once per roomDir for the whole batch.

  // Steps 3-5: HSI compute + reverse salients + bridge. Skip when debounced
  // or when room.db has not been created yet.
  const anyMd = artifacts.some(a => path.extname(a.filePath).slice(1).toLowerCase() === 'md');
  const roomDbPath = path.join(roomDir, '.mindrian', 'room.db');
  if (anyMd && fs.existsSync(roomDbPath)) {
    if (debounced) {
      const lastHsi = lastHsiByRoom.get(roomDir) || 0;
      stepsResult.hsi = { status: 'debounced', lastRun: new Date(lastHsi).toISOString() };
    } else {
      let hsiSuccess = false;
      try {
        execFileSync('bash', [path.join(SCRIPTS_DIR, 'check-hsi-deps')], {
          timeout: HSI_TIMEOUT_MS,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        try {
          execFileSync('python3', [path.join(SCRIPTS_DIR, 'compute-hsi.py'), roomDir], {
            timeout: HSI_TIMEOUT_MS,
            stdio: ['ignore', 'pipe', 'pipe']
          });
          stepsResult.hsi = { status: 'ok' };
          hsiSuccess = true;
          stepsResult.hsiRanAt = Date.now();  // caller updates lastHsiByRoom
        } catch (e) {
          stepsResult.hsi = { status: 'error', message: e.message };
        }
      } catch (e) {
        stepsResult.hsi = { status: 'skipped', reason: 'HSI deps not available' };
      }

      if (hsiSuccess) {
        try {
          execFileSync('python3', [path.join(SCRIPTS_DIR, 'detect-reverse-salients.py'), roomDir], {
            timeout: HSI_TIMEOUT_MS,
            stdio: ['ignore', 'pipe', 'pipe']
          });
          stepsResult.reverseSalients = { status: 'ok' };
        } catch (e) {
          stepsResult.reverseSalients = { status: 'error', message: e.message };
        }
      }

      if (fs.existsSync(path.join(roomDir, '.hsi-results.json'))) {
        try {
          execFileSync(process.execPath, [path.join(SCRIPTS_DIR, 'hsi-to-graph.cjs'), roomDir], {
            timeout: HSI_TIMEOUT_MS,
            stdio: ['ignore', 'pipe', 'pipe']
          });
          stepsResult.hsiBridge = { status: 'ok' };
        } catch (e) {
          stepsResult.hsiBridge = { status: 'error', message: e.message };
        }
      }
    }
  }

  // Step 6: presentation regeneration.
  const presentationDir = path.join(roomDir, 'exports', 'presentation');
  if (fs.existsSync(presentationDir)) {
    try {
      execFileSync(process.execPath,
        [path.join(SCRIPTS_DIR, 'generate-presentation.cjs'), roomDir, '--output', presentationDir], {
          timeout: 15000,
          stdio: ['ignore', 'pipe', 'pipe']
        });
      stepsResult.presentation = { status: 'ok' };
    } catch (e) {
      stepsResult.presentation = { status: 'error', message: e.message };
    }
  }

  // Step 8: compute-state (recompute STATE.md).
  // intern-w1-state-not-recomputed: this step used to run compute-state with
  // stdout routed to an ignored pipe and never capture it, then report
  // status: 'ok' regardless - so STATE.md never actually got recomputed on
  // the automatic post-write path. compute-state only prints the STATE.md
  // body to stdout by design (it never writes the file itself); capture it
  // and persist it here, mirroring the pattern already correct in
  // scripts/on-stop / on-task-complete / on-agent-complete.
  try {
    const computedState = execFileSync('bash', [path.join(SCRIPTS_DIR, 'compute-state'), roomDir], {
      timeout: HSI_TIMEOUT_MS,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    fs.writeFileSync(path.join(roomDir, 'STATE.md'), computedState);
    stepsResult.computeState = { status: 'ok' };
  } catch (e) {
    stepsResult.computeState = { status: 'error', message: e.message };
  }

  // Step 9: build-graph (rebuild dashboard graph.json).
  try {
    execFileSync('bash', [path.join(SCRIPTS_DIR, 'build-graph'), roomDir], {
      timeout: 10000,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    stepsResult.buildGraph = { status: 'ok' };
  } catch (e) {
    stepsResult.buildGraph = { status: 'error', message: e.message };
  }

  // Step 10: analyze-room + persistIntelligence. Phase 84-05 also reads
  // graph findings via readGraphFindings().
  let analyzeOutput = '';
  try {
    analyzeOutput = execFileSync('bash', [path.join(SCRIPTS_DIR, 'analyze-room'), roomDir], {
      timeout: 10000,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const proactiveIntel = require('./proactive-intelligence.cjs');
    const intelResult = proactiveIntel.persistIntelligence(roomDir, analyzeOutput);
    const parsed = proactiveIntel.parseAnalyzeOutput(analyzeOutput);
    const newFindings = proactiveIntel.getNewFindings(roomDir, parsed);
    stepsResult.proactiveIntelligence = { status: 'ok', ...intelResult, newFindings };
  } catch (e) {
    stepsResult.proactiveIntelligence = { status: 'error', message: e.message };
  }

  // Step 11: extractOpportunities + bankOpportunity. Framework-name precedence:
  // frameworkHint from caller > parsed "CLASSIFIED:<fw>:<conf>" > 'cascade'.
  if (stepsResult.proactiveIntelligence && stepsResult.proactiveIntelligence.status === 'ok') {
    try {
      const proactiveIntel = require('./proactive-intelligence.cjs');
      const parsed = proactiveIntel.parseAnalyzeOutput(analyzeOutput);
      let frameworkName = frameworkHint || 'cascade';
      if (!frameworkHint && stepsResult.perFile.length > 0) {
        const firstCls = stepsResult.perFile[0].classification;
        if (typeof firstCls === 'string' && firstCls.startsWith('CLASSIFIED:')) {
          const parts = firstCls.split(':');
          if (parts[1]) frameworkName = parts[1];
        }
      }
      const opportunities = extractOpportunities(parsed, frameworkName, roomDir);
      const banked = [];
      for (const opp of opportunities) {
        const result = bankOpportunity(roomDir, opp);
        if (result.banked || result.updated) banked.push(result);
      }
      stepsResult.opportunityExtraction = {
        status: 'ok',
        extracted: opportunities.length,
        banked: banked.filter(b => b.banked).length,
        updated: banked.filter(b => b.updated).length
      };
    } catch (e) {
      stepsResult.opportunityExtraction = { status: 'error', message: e.message };
    }
  }

  invalidateAnalysisCache(roomDir);
  return stepsResult;
}

/**
 * Run the cascade for a single filed artifact. Thin wrapper around
 * `_runCascadeSteps`: validates inputs, handles binary early-return, computes
 * HSI debounce, delegates, then flattens the internal shape to the flat
 * public shape (classification/graphIndex/artifactId/gitCommit at top level).
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

  // -- Binary file handling (NOT part of _runCascadeSteps) --
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

  // HSI Debounce (HOOK-01): compute flag BEFORE helper entry so the
  // lastHsiByRoom Map stays owned by public entry points.
  const lastHsi = lastHsiByRoom.get(resolvedRoomDir) || 0;
  const debounced = (Date.now() - lastHsi) < HSI_DEBOUNCE_MS;

  const stepsResult = await _runCascadeSteps(
    resolvedRoomDir,
    [{ filePath, section }],
    { trigger, debounced }
  );

  if (stepsResult.hsiRanAt !== null) {
    lastHsiByRoom.set(resolvedRoomDir, stepsResult.hsiRanAt);
  }

  // Adapt internal shape -> flat public shape. Spread perFile[0] onto results.
  const first = stepsResult.perFile[0] || {};
  results.classification = first.classification !== undefined ? first.classification : null;
  results.graphIndex = first.graphIndex !== undefined ? first.graphIndex : null;
  if (first.artifactId !== undefined) results.artifactId = first.artifactId;
  if (first.gitCommit !== undefined) results.gitCommit = first.gitCommit;
  // Phase 224 Req 1: surface the Step 2b derive-enqueue envelope on the flat
  // public shape so post-write's CASCADE_OUTPUT side-channel + the MCP router see it.
  if (first.deriveEnqueue !== undefined) results.deriveEnqueue = first.deriveEnqueue;

  results.hsi = stepsResult.hsi;
  results.reverseSalients = stepsResult.reverseSalients;
  results.hsiBridge = stepsResult.hsiBridge;
  results.presentation = stepsResult.presentation;
  if (stepsResult.computeState !== null) results.computeState = stepsResult.computeState;
  if (stepsResult.buildGraph !== null) results.buildGraph = stepsResult.buildGraph;
  if (stepsResult.proactiveIntelligence !== null) results.proactiveIntelligence = stepsResult.proactiveIntelligence;
  if (stepsResult.opportunityExtraction !== null) results.opportunityExtraction = stepsResult.opportunityExtraction;

  return results;
}

/**
 * Queue a cascade request for batched execution. Collects multiple writes
 * within a 500ms window; steps 1-2 run per-file, steps 3-11 run once per
 * batch (inside the shared `_runCascadeSteps` helper).
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

        const resolvedRoomDir = roomDir || findRoomDir(currentBatch.files[0]);
        if (!resolvedRoomDir || !fs.existsSync(resolvedRoomDir)) {
          batchResults.skipped = true;
          batchResults.skipReason = 'roomDir not found or does not exist';
          for (const w of currentBatch.waiters) w.resolve(batchResults);
          return;
        }

        const artifacts = currentBatch.files.map(fp => ({
          filePath: fp,
          section: currentBatch.options.section
        }));

        const lastHsi = lastHsiByRoom.get(resolvedRoomDir) || 0;
        const debounced = (Date.now() - lastHsi) < HSI_DEBOUNCE_MS;

        // frameworkHint 'cascade-batch' preserves legacy queueCascade step 11
        // provenance (existing opportunity-bank consumers expect this string).
        const stepsResult = await _runCascadeSteps(resolvedRoomDir, artifacts, {
          trigger: currentBatch.options.trigger,
          debounced,
          frameworkHint: 'cascade-batch'
        });

        if (stepsResult.hsiRanAt !== null) {
          lastHsiByRoom.set(resolvedRoomDir, stepsResult.hsiRanAt);
        }

        batchResults.perFile = stepsResult.perFile;
        batchResults.hsi = stepsResult.hsi;
        batchResults.reverseSalients = stepsResult.reverseSalients;
        batchResults.hsiBridge = stepsResult.hsiBridge;
        batchResults.presentation = stepsResult.presentation;
        if (stepsResult.computeState !== null) batchResults.computeState = stepsResult.computeState;
        if (stepsResult.buildGraph !== null) batchResults.buildGraph = stepsResult.buildGraph;
        if (stepsResult.proactiveIntelligence !== null) batchResults.proactiveIntelligence = stepsResult.proactiveIntelligence;
        if (stepsResult.opportunityExtraction !== null) batchResults.opportunityExtraction = stepsResult.opportunityExtraction;

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
  invalidateAnalysisCache,
  // Phase 150.8-01 (DIKW-02) -- the segmentation-authority seam. Additive,
  // behavior-preserving: documents + enforces that meeting-segment claim minting
  // is the EXTRACTION layer's job (writeClaimNode per atomic claim), not the
  // file-level cascade's. assertSegmentAuthority is the testable boundary proving
  // claim count tracks segment count (not file count) per the GATE-0 verdict.
  SEGMENT_AUTHORITY,
  assertSegmentAuthority
};
