/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 272 -- CJS port of scripts/compute-hsi.py's Tier 1 orchestration.
 *
 * Discovers room artifacts on disk, computes the structural leg
 * (hsi-lsa.cjs's cosine-on-SVD LSA, Convention B), the semantic leg
 * (embedding-spine.cjs's local ONNX encoder, Tier 1 -- compute-hsi.py's own
 * compute_semantic_similarity_tier1), the per-artifact spectral/OM-HMM leg
 * (hsi-spectral.cjs's Markov-chain surface), pairs the three via the
 * innovation-differential formula, and writes <room>/.hsi-results.json
 * (Python-schema field-for-field parity). Structurally the sibling of
 * rs-engine.cjs's Mode A orchestration (272-08) -- same "discover -> numeric
 * leg -> semantic leg -> write results" shape -- but meaningfully lighter:
 * no embedding cache (compute-hsi.py never had one; do not add one here that
 * the Python original does not have), no room.db edge writes, no cross-room
 * mode. No content-hash skip-cache (.hsi-cache.json's check_cache/write_cache
 * pair) is ported either -- not named in this plan's read_first orchestration
 * steps and not required by any acceptance criterion; every call recomputes.
 *
 * SCOPE (D-10): Tier 1 only. Tier 2 (compute_semantic_similarity_tier2,
 * Pinecone-fetched embeddings from an EXISTING index -- distinct from Mode
 * B/C's control-plane index-creation surface, but still external/Pinecone
 * and still out of this phase's stated scope) is explicitly NOT ported. A
 * caller requesting opts.tier === 2 gets a named, explicit refusal
 * (not_implemented_this_phase) -- never a silent fall-through to Tier 1
 * and never a crash. Same scope-fence discipline as rs-engine.cjs's Mode
 * B/C exclusion (rs-engine.cjs:15-17).
 *
 * COMPOSITION (Canon Part 7, reuse before build -- this file orchestrates,
 * it does not reimplement numeric primitives):
 *   - lib/core/rs-engine.cjs::discoverArtifacts -- confirmed via a direct
 *     read of both scripts/rs-engine.py:183-225's discover_artifacts and
 *     scripts/compute-hsi.py:168-211's discover_artifacts that the two
 *     Python functions are IDENTICAL (same SKIP_DIRS/SKIP_FILES import from
 *     lib/core/rs_corpus_exclude.py, same MIN_BODY_CHARS=50, same walk
 *     logic, same {id, section, title, path, text} artifact shape) -- not
 *     merely similar. Sharing rs-engine.cjs's existing export is therefore
 *     real reuse, not a false shared abstraction (this phase's own Pitfall-3
 *     lesson).
 *   - lib/core/hsi-lsa.cjs::computeLsaSimilarity -- the structural/LSA leg
 *     (Convention B, cosine-on-SVD). computeLsaSimilarity's own maxFeatures
 *     default (500) is used untouched -- no extra parameter passed
 *     (RESEARCH.md Finding F-6's parameter table).
 *   - lib/core/hsi-lsa.cjs::classifyDirectionB -- the SAME lsa_sim > sem_sim
 *     inline check compute-hsi.py:748-751 uses (compute_hsi_matrix), reused
 *     here rather than a second copy of the same three-line comparison.
 *   - lib/core/hsi-spectral.cjs -- THINKING_MODES_v1, classifySentenceMode,
 *     buildTransitionMatrix, computeSpectralGap, computeStationaryDistribution,
 *     detectAbsorbingTendency, computeOmhmmScore, computeOmhmmLegacy. This
 *     file's computeArtifactSpectralProfile below is a direct, field-for-field
 *     port of compute-hsi.py:650-705's compute_artifact_spectral_profile,
 *     composed entirely from these primitives -- no new eigen-analysis code
 *     here.
 *   - lib/core/eureka/embedding-spine.cjs::embedTexts -- Tier 1's OWN
 *     embedding call (compute_semantic_similarity_tier1's role). This is a
 *     SEPARATE call site from rs-engine.cjs's computeEmbeddings/cache logic;
 *     compute-hsi.py has no embedding cache of its own, so none is added
 *     here. The ONLY local encoder call site in this file -- never a second
 *     ONNX pipeline instantiation.
 *   - lib/core/rs-pinecone-bridge.cjs::cosineSimilarity -- the SAME function
 *     object hsi-lsa.cjs and rs-engine.cjs already use for their own cosine
 *     legs, reused here per-pair to build the semantic similarity matrix.
 *
 * D-01 / D-02 SEPARATE-EMBEDDING-SPACE INVARIANT: this file consumes
 * embedding-spine.cjs's existing MongoDB/mdbr-leaf-ir (384-dim) encoder
 * UNCHANGED, the same call this phase's rs-engine.cjs already makes. It does
 * NOT load Xenova/multilingual-e5-large locally (D-02), and it does NOT
 * introduce any cross-engine cosine comparison between a 384-dim local
 * vector and a 1024-dim external Pinecone vector -- there is none today and
 * none is created here.
 *
 * Error-envelope family: never throws across this module's boundary for the
 * Tier 1 success path -- runTier1 always returns a valid .hsi-results.json
 * shaped object (or degrades gracefully: identity-matrix semantic leg on
 * encoder_unavailable, matching rs-engine.cjs's own precedent). The ONE
 * deliberate exception to "return the raw result object" is the Tier 2
 * refusal path, which returns {success:false, error:'not_implemented_this_phase',
 * detail} -- an explicit, named, non-silent refusal, not a degrade.
 *
 * Pure CJS, node built-ins plus in-repo modules only, zero new runtime
 * dependencies.
 *
 * No em-dashes (CLAUDE.md HARD RULE).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { discoverArtifacts } = require('./rs-engine.cjs');
const { computeLsaSimilarity, classifyDirectionB } = require('./hsi-lsa.cjs');
const hsiSpectral = require('./hsi-spectral.cjs');
const embeddingSpine = require('./eureka/embedding-spine.cjs');
const { cosineSimilarity } = require('./rs-pinecone-bridge.cjs');

// ---------------------------------------------------------------------------
// Constants (values pinned from scripts/compute-hsi.py, ported exactly)
// ---------------------------------------------------------------------------

const RESULTS_FILENAME = '.hsi-results.json';
const DEFAULT_TIER = 1;
const DEFAULT_THRESHOLD = 0.30;
const SPECTRAL_VERSION = '1.6.0';
const TOP_PAIR_LIMIT = 20;

// ---------------------------------------------------------------------------
// Small local helpers (no second implementation of a shared primitive)
// ---------------------------------------------------------------------------

function _identityMatrix(n) {
  const m = [];
  for (let i = 0; i < n; i += 1) {
    m.push(new Array(n).fill(0));
    m[i][i] = 1;
  }
  return m;
}

function _clip01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

// Thin loop over rs-pinecone-bridge.cjs::cosineSimilarity, clipped [0,1] --
// matches compute_semantic_similarity_tier1's own
// np.clip(cosine_similarity(embeddings), 0.0, 1.0) exactly.
function _semanticSimilarityMatrix(vectors) {
  const n = vectors.length;
  const matrix = [];
  for (let i = 0; i < n; i += 1) matrix.push(new Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    matrix[i][i] = _clip01(cosineSimilarity(vectors[i], vectors[i]));
    for (let j = i + 1; j < n; j += 1) {
      const sim = _clip01(cosineSimilarity(vectors[i], vectors[j]));
      matrix[i][j] = sim;
      matrix[j][i] = sim;
    }
  }
  return matrix;
}

function _round(x, digits) {
  const factor = Math.pow(10, digits);
  return Math.round(Number(x) * factor) / factor;
}

function _argmax(arr) {
  let best = 0;
  for (let i = 1; i < arr.length; i += 1) {
    if (arr[i] > arr[best]) best = i;
  }
  return best;
}

// Atomic write (temp file then rename) -- PATTERNS.md convention 11, same
// pattern as rs-engine.cjs's _writeResultsAtomic / scripts/rs-engine.py's
// _save_embedding_cache.
function _writeResultsAtomic(outputPath, result) {
  const tmpPath = `${outputPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(result, null, 2), 'utf8');
  fs.renameSync(tmpPath, outputPath);
}

// ---------------------------------------------------------------------------
// computeArtifactSpectralProfile (ports compute-hsi.py:650-705
// compute_artifact_spectral_profile exactly, composed from hsi-spectral.cjs)
// ---------------------------------------------------------------------------

/*
 * computeArtifactSpectralProfile(text): field-for-field port. Splits on
 * sentence terminators, filters to length > 10 after trim (same threshold
 * as computeOmhmmScore's own internal split); fewer than 5 qualifying
 * sentences degrades to the legacy profile shape (dominant_mode: 'unknown',
 * spectral_gap/mode_entropy/absorbing_score: 0.0, spectral_method: 'legacy').
 *
 * NOTE (ported as-is, not "optimized"): compute-hsi.py calls
 * compute_omhmm_score(text) a SECOND time for the omhmm_score field even
 * though it already built the transition matrix above for spectral_gap --
 * computeOmhmmScore internally re-splits sentences and rebuilds its own
 * transition matrix. This is redundant computation in the Python original,
 * ported here exactly rather than "fixed" to share the intermediate state --
 * this phase's discipline is field-for-field parity, not restructuring.
 */
function computeArtifactSpectralProfile(text) {
  const original = String(text == null ? '' : text);
  const sentences = original
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  if (sentences.length < 5) {
    const score = hsiSpectral.computeOmhmmLegacy(original);
    return {
      omhmm_score: score,
      spectral_gap: 0.0,
      dominant_mode: 'unknown',
      mode_entropy: 0.0,
      absorbing_score: 0.0,
      mode_distribution: {},
      spectral_method: 'legacy',
    };
  }

  const modes = hsiSpectral.THINKING_MODES_v1;
  const modeSequence = sentences.map((s) => hsiSpectral.classifySentenceMode(s));
  const transitionMatrix = hsiSpectral.buildTransitionMatrix(modeSequence, modes);
  const spectralGap = hsiSpectral.computeSpectralGap(transitionMatrix);
  const stationary = hsiSpectral.computeStationaryDistribution(transitionMatrix);

  const dominantIdx = _argmax(stationary);
  const dominantMode = modes[dominantIdx];

  let entropy = 0.0;
  for (let i = 0; i < stationary.length; i += 1) {
    const p = stationary[i];
    if (p > 1e-10) entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(modes.length);
  const modeEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0.0;

  const absorbing = hsiSpectral.detectAbsorbingTendency(transitionMatrix, modes);

  const modeDist = {};
  for (let i = 0; i < modes.length; i += 1) {
    modeDist[modes[i]] = _round(stationary[i], 4);
  }

  return {
    omhmm_score: hsiSpectral.computeOmhmmScore(original),
    spectral_gap: _round(spectralGap, 4),
    dominant_mode: dominantMode,
    mode_entropy: _round(modeEntropy, 4),
    absorbing_score: _round(absorbing, 4),
    mode_distribution: modeDist,
    spectral_method: 'markov',
  };
}

// ---------------------------------------------------------------------------
// computeHsiMatrix (ports compute-hsi.py:708-777 compute_hsi_matrix exactly)
// ---------------------------------------------------------------------------

/*
 * computeHsiMatrix(artifacts, lsaMatrix, semanticMatrix, threshold): builds
 * every artifact's spectral profile, then every (i, j) pair's
 * innovation-differential score, filters below threshold, classifies
 * direction via hsi-lsa.cjs::classifyDirectionB (the SAME check
 * compute-hsi.py:748-751 does inline), sorts descending by hsi_score, and
 * returns the top 20 pairs plus the full spectral-profile array (the
 * caller needs both -- profiles feed the per-artifact spectral block AND
 * the room-level spectral_summary).
 */
function computeHsiMatrix(artifacts, lsaMatrix, semanticMatrix, threshold) {
  const n = artifacts.length;
  const texts = artifacts.map((a) => a.text);

  const spectralProfiles = texts.map((t) => computeArtifactSpectralProfile(t));
  const omhmmScores = spectralProfiles.map((p) => p.omhmm_score);

  const pairs = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const lsaSim = Number(lsaMatrix[i][j]);
      const semSim = Number(semanticMatrix[i][j]);

      const semanticSurprise = Math.abs(semSim - lsaSim);
      const integrativeFactor = Math.sqrt(omhmmScores[i] * omhmmScores[j]) / 100.0;
      const innovationDiff = 0.6 * semanticSurprise + 0.4 * integrativeFactor;

      if (innovationDiff < threshold) continue;

      const surpriseType = classifyDirectionB(lsaSim, semSim);
      const breakthrough = 0.7 * innovationDiff + 0.3 * Math.min(lsaSim, semSim);
      const avgSpectralGap =
        (spectralProfiles[i].spectral_gap + spectralProfiles[j].spectral_gap) / 2.0;

      pairs.push({
        left_id: artifacts[i].id,
        right_id: artifacts[j].id,
        lsa_sim: _round(lsaSim, 4),
        semantic_sim: _round(semSim, 4),
        hsi_score: _round(innovationDiff, 4),
        surprise_type: surpriseType,
        breakthrough_potential: _round(breakthrough, 4),
        spectral_gap_avg: _round(avgSpectralGap, 4),
        left_dominant_mode: spectralProfiles[i].dominant_mode,
        right_dominant_mode: spectralProfiles[j].dominant_mode,
      });
    }
  }

  pairs.sort((a, b) => b.hsi_score - a.hsi_score);
  return { pairs: pairs.slice(0, TOP_PAIR_LIMIT), spectralProfiles };
}

// ---------------------------------------------------------------------------
// runTier1 (ports scripts/compute-hsi.py:780-943 main()'s Tier 1 flow)
// ---------------------------------------------------------------------------

/*
 * runTier1(roomDir, opts): opts = { tier = 1, threshold = 0.30, output }.
 *
 * If opts.tier is explicitly 2, returns {success:false,
 * error:'not_implemented_this_phase', detail:...} immediately -- Tier 2
 * (Pinecone-fetched embeddings from an existing index) is descoped per
 * D-10, same scope-fence discipline as rs-engine.cjs's Mode B/C exclusion.
 * Never silently runs Tier 1 instead and never crashes.
 *
 * Otherwise orchestrates discoverArtifacts -> computeLsaSimilarity ->
 * embedTexts (Tier 1 semantic leg) -> computeHsiMatrix, writes
 * <roomDir>/.hsi-results.json atomically, and returns that same object
 * directly (matching Python's own JSON output shape, no {success,...}
 * wrapper on the happy path -- same asymmetric-envelope precedent
 * hsi-lsa.cjs's own header documents).
 */
async function runTier1(roomDir, opts) {
  const options = opts || {};
  const requestedTier = Number.isFinite(options.tier) ? options.tier : DEFAULT_TIER;

  if (requestedTier === 2) {
    return {
      success: false,
      error: 'not_implemented_this_phase',
      detail:
        'Tier 2 (Pinecone-fetched embeddings) is descoped per D-10; use Tier 1 or the ' +
        'Python fallback (MINDRIAN_RS_BACKEND=python)',
    };
  }

  const threshold = Number.isFinite(options.threshold) ? options.threshold : DEFAULT_THRESHOLD;
  const resolvedRoomDir = path.resolve(roomDir);
  const outputPath = options.output || path.join(resolvedRoomDir, RESULTS_FILENAME);

  const artifacts = discoverArtifacts(resolvedRoomDir);

  if (artifacts.length < 2) {
    const result = {
      metadata: {
        timestamp: new Date().toISOString(),
        room_dir: resolvedRoomDir,
        tier: requestedTier,
        artifact_count: artifacts.length,
        pair_count: 0,
      },
      artifacts: [],
      hsi_pairs: [],
      reverse_salients: [],
    };
    _writeResultsAtomic(outputPath, result);
    return result;
  }

  const texts = artifacts.map((a) => a.text);

  // Structural leg: Convention B cosine-on-SVD (hsi-lsa.cjs's own default
  // maxFeatures=500 used untouched).
  const lsaMatrix = computeLsaSimilarity(texts);

  // Semantic leg: Tier 1's OWN embedding call, embedding-spine.cjs directly
  // (no cache -- compute-hsi.py has none, and this file does not add one).
  const embedResult = await embeddingSpine.embedTexts(texts, {});

  let semanticMatrix;
  if (!embedResult || embedResult.success !== true) {
    // Degrade gracefully rather than crash (PATTERNS.md convention 4) --
    // same identity-matrix fallback precedent rs-engine.cjs already
    // established for its own encoder_unavailable case.
    process.stderr.write('hsi-engine: no embedder available; semantic matrix set to identity\n');
    semanticMatrix = _identityMatrix(artifacts.length);
  } else {
    semanticMatrix = _semanticSimilarityMatrix(embedResult.vectors);
  }

  const { pairs, spectralProfiles } = computeHsiMatrix(artifacts, lsaMatrix, semanticMatrix, threshold);

  const artifactList = artifacts.map((a, i) => ({
    id: a.id,
    section: a.section,
    title: a.title,
    path: a.path,
    spectral: {
      omhmm_score: _round(spectralProfiles[i].omhmm_score, 2),
      spectral_gap: spectralProfiles[i].spectral_gap,
      dominant_mode: spectralProfiles[i].dominant_mode,
      mode_entropy: spectralProfiles[i].mode_entropy,
      absorbing_score: spectralProfiles[i].absorbing_score,
      mode_distribution: spectralProfiles[i].mode_distribution,
      method: spectralProfiles[i].spectral_method,
    },
  }));

  const spectralScores = spectralProfiles.map((p) => p.omhmm_score);
  const spectralGaps = spectralProfiles
    .filter((p) => p.spectral_method === 'markov')
    .map((p) => p.spectral_gap);
  const modeCounts = {};
  for (const p of spectralProfiles) {
    modeCounts[p.dominant_mode] = (modeCounts[p.dominant_mode] || 0) + 1;
  }

  const meanOmhmm =
    spectralScores.length > 0
      ? _round(spectralScores.reduce((a, b) => a + b, 0) / spectralScores.length, 2)
      : 0;
  const meanSpectralGap =
    spectralGaps.length > 0
      ? _round(spectralGaps.reduce((a, b) => a + b, 0) / spectralGaps.length, 4)
      : 0;

  const result = {
    metadata: {
      timestamp: new Date().toISOString(),
      room_dir: resolvedRoomDir,
      tier: 1,
      artifact_count: artifacts.length,
      pair_count: pairs.length,
      spectral_version: SPECTRAL_VERSION,
      spectral_summary: {
        mean_omhmm: meanOmhmm,
        mean_spectral_gap: meanSpectralGap,
        dominant_mode_distribution: modeCounts,
        spectral_artifacts: spectralGaps.length,
        legacy_artifacts: spectralScores.length - spectralGaps.length,
      },
    },
    artifacts: artifactList,
    hsi_pairs: pairs,
    reverse_salients: [],
  };

  _writeResultsAtomic(outputPath, result);
  return result;
}

module.exports = {
  runTier1,
  computeArtifactSpectralProfile,
  computeHsiMatrix,
};
