/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * 2026 REVISION NOTE (all additive; every pre-existing export and output key
 * is kept). runTier1 now defaults to the same hybrid scheme as
 * scripts/compute-hsi.py: lexical leg = mean(LSA, BM25), pairs ranked by
 * corpus percentile of hsi_score instead of a fixed 0.30 cut. The old
 * behaviour is one option away: runTier1(room, { lexical: 'lsa', ranking:
 * 'legacy' }). computeHsiMatrix(artifacts, lsa, sem, threshold) with no fifth
 * argument is exactly the original (legacy) function. A missing embedder is
 * no longer silent: the identity fallback is recorded in
 * metadata.provenance.semantic_leg and a warning, or refused outright with
 * opts.requireEmbedder. Output gains source_trail, second_signal,
 * novelty_check, hsi_percentile, hsi_z, lexical_sim, bm25_sim, rank per pair
 * and metadata.schema_version / ranking / provenance. Optional
 * opts.claimLevel adds problem-sentence vs method-sentence evidence.
 *
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
 *   - lib/core/direction-convention.cjs::classify -- Phase 355 D-03: the
 *     pair-label call site below now calls this module's classify(lsaSim,
 *     semSim) directly (the same one rs-math.cjs's classifyDirection and
 *     hsi-lsa.cjs's classifyDirectionB both delegate to), replacing the
 *     former direct classifyDirectionB(lsaSim, semSim) call. The output
 *     inverts relative to the old Convention B check (compute-hsi.py:748-751's
 *     inline lsa_sim > sem_sim rule) -- that inline check is retired, not
 *     ported here as a second copy.
 *   - lib/core/hsi-spectral.cjs -- THINKING_MODES_v1, classifySentenceMode,
 *     buildTransitionMatrix, computeSpectralGap, computeStationaryDistribution,
 *     detectAbsorbingTendency, computeOmhmmScore, computeOmhmmLegacy. This
 *     file's computeArtifactSpectralProfile below is a direct, field-for-field
 *     port of compute-hsi.py:650-705's compute_artifact_spectral_profile,
 *     composed entirely from these primitives -- no new eigen-analysis code
 *     here.
 *   - lib/core/semantic-index/embedding-spine.cjs::embedTexts -- Tier 1's OWN
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
const crypto = require('node:crypto');

const { discoverArtifacts } = require('./rs-engine.cjs');
const {
  computeLsaSimilarity,
  computeBm25Similarity,
  empiricalPercentile,
  zscores,
} = require('./hsi-lsa.cjs');
const hsiSpectral = require('./hsi-spectral.cjs');
const embeddingSpine = require('./semantic-index/embedding-spine.cjs');
const { cosineSimilarity } = require('./rs-pinecone-bridge.cjs');
const { classify } = require('./direction-convention.cjs');

// ---------------------------------------------------------------------------
// Constants (values pinned from scripts/compute-hsi.py, ported exactly)
// ---------------------------------------------------------------------------

const RESULTS_FILENAME = '.hsi-results.json';
const DEFAULT_TIER = 1;
const DEFAULT_THRESHOLD = 0.30;
const SPECTRAL_VERSION = '1.6.0';
const TOP_PAIR_LIMIT = 20;
const SCHEMA_VERSION = '2.0';
const DEFAULT_CONFIRM_PERCENTILE = 0.75;

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
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const tmpPath = `${outputPath}.${process.pid}.tmp`;
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
 * direction via lib/core/direction-convention.cjs::classify(lsaSim, semSim)
 * (Phase 355 D-03 -- replaces the former hsi-lsa.cjs::classifyDirectionB
 * inline-Convention-B call; the label output inverts relative to
 * compute-hsi.py:748-751's old inline check for the same numbers), sorts
 * descending by hsi_score, and returns the top 20 pairs plus the full
 * spectral-profile array (the caller needs both -- profiles feed the
 * per-artifact spectral block AND the room-level spectral_summary).
 */
function _bestSentence(text) {
  const sents = _splitSentences(text, 30, 300);
  if (sents.length === 0) return String(text == null ? '' : text).trim().slice(0, 200);
  return sents[0];
}

function _crossReferenced(a, b) {
  const text = String(a.text || '').toLowerCase();
  if (text.indexOf(String(b.id).toLowerCase()) !== -1) return true;
  const title = String(b.title || '').trim().toLowerCase();
  return title.length >= 4 && text.indexOf(title) !== -1;
}

function computeHsiMatrix(artifacts, lsaMatrix, semanticMatrix, threshold, opts) {
  const o = opts || {};
  const ranking = o.ranking === 'percentile' ? 'percentile' : 'legacy';
  const n = artifacts.length;
  const texts = artifacts.map((a) => a.text);
  const lexMatrix = o.lexicalMatrix || lsaMatrix;
  const bm25Matrix = o.bm25Matrix || null;
  const topK = Number.isFinite(o.topK) && o.topK > 0 ? o.topK : (o.topK === 0 ? Infinity : TOP_PAIR_LIMIT);
  const minPercentile = Number.isFinite(o.minPercentile) ? o.minPercentile : 0;
  const confirmPercentile = Number.isFinite(o.confirmPercentile) ? o.confirmPercentile : DEFAULT_CONFIRM_PERCENTILE;
  const computedAt = o.computedAt || new Date().toISOString();

  const spectralProfiles = texts.map((t) => computeArtifactSpectralProfile(t));
  const omhmmScores = spectralProfiles.map((p) => p.omhmm_score);

  // Pass 1: every pair's raw numbers (needed for corpus percentiles).
  const rows = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const lsaSimRaw = lsaMatrix[i][j];
      const semSimRaw = semanticMatrix[i][j];
      const lsaSim = Number(lsaSimRaw);
      const semSim = Number(semSimRaw);
      const lexSim = Number(lexMatrix[i][j]);

      const semanticSurprise = Math.abs(semSim - lexSim);
      const integrativeFactor = Math.sqrt(omhmmScores[i] * omhmmScores[j]) / 100.0;
      const innovationDiff = 0.6 * semanticSurprise + 0.4 * integrativeFactor;
      rows.push({ i, j, lsaSimRaw, semSimRaw, lsaSim, semSim, lexSim, innovationDiff });
    }
  }

  const percentiles = empiricalPercentile(rows.map((r) => r.innovationDiff));
  const z = zscores(rows.map((r) => r.innovationDiff));
  let secondPct = null;
  if (bm25Matrix) secondPct = empiricalPercentile(rows.map((r) => Math.abs(r.semSim - Number(bm25Matrix[r.i][r.j]))));

  const fixedCut = ranking === 'legacy'
    ? (Number.isFinite(threshold) ? threshold : DEFAULT_THRESHOLD)
    : (Number.isFinite(threshold) ? threshold : null);

  const pairs = [];
  rows.forEach((r, idx) => {
    if (fixedCut !== null && r.innovationDiff < fixedCut) return;
    if (ranking === 'percentile' && percentiles[idx] < minPercentile) return;

    const surpriseType = classify(r.lsaSimRaw, r.semSimRaw);
    const breakthrough = 0.7 * r.innovationDiff + 0.3 * Math.min(r.lexSim, r.semSim);
    const avgSpectralGap =
      (spectralProfiles[r.i].spectral_gap + spectralProfiles[r.j].spectral_gap) / 2.0;
    const left = artifacts[r.i];
    const right = artifacts[r.j];

    const pair = {
      left_id: left.id,
      right_id: right.id,
      lsa_sim: _round(r.lsaSim, 4),
      semantic_sim: _round(r.semSim, 4),
      hsi_score: _round(r.innovationDiff, 4),
      surprise_type: surpriseType,
      breakthrough_potential: _round(breakthrough, 4),
      spectral_gap_avg: _round(avgSpectralGap, 4),
      left_dominant_mode: spectralProfiles[r.i].dominant_mode,
      right_dominant_mode: spectralProfiles[r.j].dominant_mode,
      // additive 2026 keys
      lexical_sim: _round(r.lexSim, 4),
      hsi_percentile: _round(percentiles[idx], 4),
      hsi_z: _round(z[idx], 4),
      novelty_check: {
        status: 'in_room_check_only',
        known_in_room: _crossReferenced(left, right) || _crossReferenced(right, left),
        external_literature: 'not_run',
      },
      source_trail: [left, right].map((a) => ({
        artifact_id: a.id,
        path: a.path,
        content_hash: a.content_hash || '',
        retrieved_at: computedAt,
        extracted_sentence: _bestSentence(a.text),
      })),
    };
    if (bm25Matrix) {
      pair.bm25_sim = _round(Number(bm25Matrix[r.i][r.j]), 4);
      pair.second_signal = {
        method: 'bm25_vs_dense_surprise',
        surprise: _round(Math.abs(r.semSim - Number(bm25Matrix[r.i][r.j])), 4),
        percentile: _round(secondPct[idx], 4),
        confirmed: secondPct[idx] >= confirmPercentile,
      };
    }
    pairs.push(pair);
  });

  // descending by the rounded score (the original sort key); ties keep pair
  // order (Array.prototype.sort is stable), so output is deterministic.
  pairs.sort((a, b) => b.hsi_score - a.hsi_score);
  const limited = pairs.slice(0, topK === Infinity ? pairs.length : topK);
  limited.forEach((p, k) => { p.rank = k + 1; });
  return { pairs: limited, spectralProfiles };
}

// ---------------------------------------------------------------------------
// Claim-level evidence (problem sentence of one artifact vs method sentence
// of the other), mirrors scripts/compute-hsi.py::claim_level_scores.
// ---------------------------------------------------------------------------

const PROBLEM_CUES = /\b(problem|challeng|bottleneck|gap|limitation|fail|cannot|can't|unable|barrier|pain|unmet|obstacle|constraint|risk|issue|struggl|lack|insufficient|difficult|bleed|friction)\w*/gi;
const METHOD_CUES = /\b(approach|method|technique|algorithm|framework|solution|solv|design|architecture|propos|apply|applies|applied|implement|mechanism|protocol|process|pipeline|strateg|using|leverag)\w*/gi;

function _splitSentences(text, minChars, maxChars) {
  const lo = Number.isFinite(minChars) ? minChars : 25;
  const hi = Number.isFinite(maxChars) ? maxChars : 400;
  return String(text == null ? '' : text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((x) => x.replace(/^[\s>#*\-•]+/, '').trim())
    .filter((x) => x.length >= lo && x.length <= hi);
}

function _cueCount(sentence, re) {
  const m = sentence.match(re);
  return m ? m.length : 0;
}

function extractClaims(text, perKind) {
  const cap = Number.isFinite(perKind) ? perKind : 5;
  const problems = [];
  const methods = [];
  _splitSentences(text).forEach((s, pos) => {
    const p = _cueCount(s, PROBLEM_CUES);
    const m = _cueCount(s, METHOD_CUES);
    if (p === 0 && m === 0) return;
    if (p >= m) problems.push({ score: -p, pos, s });
    else methods.push({ score: -m, pos, s });
  });
  const order = (a, b) => (a.score - b.score) || (a.pos - b.pos);
  problems.sort(order);
  methods.sort(order);
  return { problems: problems.slice(0, cap).map((x) => x.s), methods: methods.slice(0, cap).map((x) => x.s) };
}

/*
 * claimLevelScores(artifacts, pairIndices, embedFn): embedFn(string[]) ->
 * Promise<number[][]> (embedding-spine's vectors). Returns a Map keyed
 * "i:j" -> { claim_sim, problem_sentence, method_sentence, problem_artifact,
 * method_artifact, direction }. Pairs with no usable claim on either side are
 * absent. One batched embed call covers every sentence involved.
 */
async function claimLevelScores(artifacts, pairIndices, embedFn) {
  const needed = Array.from(new Set(pairIndices.flat())).sort((a, b) => a - b);
  const claims = new Map(needed.map((k) => [k, extractClaims(artifacts[k].text)]));
  const all = [];
  claims.forEach((c) => { all.push(...c.problems, ...c.methods); });
  const uniq = Array.from(new Set(all)).sort();
  const result = new Map();
  if (uniq.length === 0) return result;
  const vecs = await embedFn(uniq);
  const unit = vecs.map((v) => {
    const norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1;
    return v.map((x) => x / norm);
  });
  const vecOf = new Map(uniq.map((s, i) => [s, unit[i]]));
  const dot = (a, b) => a.reduce((acc, x, i) => acc + x * b[i], 0);
  for (const [i, j] of pairIndices) {
    let best = null;
    const orientations = [[i, j, 'left_problem_right_method'], [j, i, 'right_problem_left_method']];
    for (const [a, b, label] of orientations) {
      for (const ps of claims.get(a).problems) {
        for (const ms of claims.get(b).methods) {
          const sim = dot(vecOf.get(ps), vecOf.get(ms));
          if (best === null || sim > best.claim_sim + 1e-12) {
            best = {
              claim_sim: sim, problem_sentence: ps, method_sentence: ms,
              problem_artifact: artifacts[a].id, method_artifact: artifacts[b].id, direction: label,
            };
          }
        }
      }
    }
    if (best !== null) {
      best.claim_sim = _round(Math.max(-1, Math.min(1, best.claim_sim)), 4);
      result.set(i + ':' + j, best);
    }
  }
  return result;
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

  const ranking = options.ranking === 'legacy' ? 'legacy' : 'percentile';
  const lexical = ['lsa', 'bm25', 'hybrid'].indexOf(options.lexical) !== -1 ? options.lexical : 'hybrid';
  // threshold: legacy defaults to 0.30 as before; percentile applies one only if given.
  const threshold = Number.isFinite(options.threshold)
    ? options.threshold
    : (ranking === 'legacy' ? DEFAULT_THRESHOLD : null);
  const topK = Number.isFinite(options.topK) ? options.topK : TOP_PAIR_LIMIT;
  const minPercentile = Number.isFinite(options.minPercentile) ? options.minPercentile : 0;
  const resolvedRoomDir = path.resolve(roomDir);
  const outputPath = options.output || path.join(resolvedRoomDir, RESULTS_FILENAME);
  const now = typeof options.now === 'function' ? options.now() : new Date();
  const nowIso = now.toISOString();
  const embedTexts = typeof options.embedTexts === 'function'
    ? options.embedTexts
    : (texts, o) => embeddingSpine.embedTexts(texts, o || {});

  const artifacts = discoverArtifacts(resolvedRoomDir);
  const warnings = [];

  if (artifacts.length < 2) {
    const result = {
      metadata: {
        timestamp: nowIso,
        room_dir: resolvedRoomDir,
        tier: requestedTier,
        artifact_count: artifacts.length,
        pair_count: 0,
        schema_version: SCHEMA_VERSION,
      },
      artifacts: [],
      hsi_pairs: [],
      reverse_salients: [],
    };
    _writeResultsAtomic(outputPath, result);
    return result;
  }

  const texts = artifacts.map((a) => a.text);
  artifacts.forEach((a) => {
    a.content_hash = crypto.createHash('md5').update(String(a.text || ''), 'utf8').digest('hex').slice(0, 12);
  });

  // Lexical legs. LSA always fills lsa_sim; BM25 is the second signal.
  const lsaMatrix = computeLsaSimilarity(texts);
  const bm25Matrix = computeBm25Similarity(texts);
  let lexicalMatrix = lsaMatrix;
  if (lexical === 'bm25') lexicalMatrix = bm25Matrix;
  else if (lexical === 'hybrid') {
    lexicalMatrix = lsaMatrix.map((row, i) => row.map((v, j) => 0.5 * (v + bm25Matrix[i][j])));
  }

  // Dense leg: Tier 1's OWN embedding call.
  const embedResult = await embedTexts(texts, {});
  let semanticMatrix;
  let semanticLeg;
  let embedVectors = null;
  if (!embedResult || embedResult.success !== true || !Array.isArray(embedResult.vectors)
      || embedResult.vectors.length !== artifacts.length) {
    if (options.requireEmbedder) {
      return {
        success: false,
        error: 'encoder_unavailable',
        detail: 'No embedder available (or it returned the wrong number of vectors) and opts.requireEmbedder is set',
      };
    }
    // Degrade rather than crash (PATTERNS.md convention 4), but say so: with an
    // identity semantic matrix every off-diagonal semantic_sim is 0, so
    // hsi_score then measures lexical similarity, not surprise.
    process.stderr.write('hsi-engine: no embedder available; semantic matrix set to identity\n');
    warnings.push('no_dense_leg: semantic_sim is 0 for every pair (identity fallback); scores are NOT semantic surprise');
    semanticMatrix = _identityMatrix(artifacts.length);
    semanticLeg = 'unavailable-identity';
  } else {
    semanticMatrix = _semanticSimilarityMatrix(embedResult.vectors);
    embedVectors = embedResult.vectors;
    semanticLeg = 'embedding-spine';
  }

  const { pairs, spectralProfiles } = computeHsiMatrix(artifacts, lsaMatrix, semanticMatrix, threshold, {
    lexicalMatrix,
    bm25Matrix: semanticLeg === 'embedding-spine' ? bm25Matrix : null,
    ranking,
    topK,
    minPercentile,
    confirmPercentile: options.confirmPercentile,
    computedAt: nowIso,
  });

  // Optional claim-level evidence on the reported pairs only.
  let claimStatus = 'not_requested';
  if (options.claimLevel) {
    if (semanticLeg !== 'embedding-spine') {
      claimStatus = 'skipped_no_encoder';
      warnings.push('claim_level skipped: no embedder available');
    } else {
      const idxOf = new Map(artifacts.map((a, i) => [a.id, i]));
      const wanted = pairs.map((p) => [idxOf.get(p.left_id), idxOf.get(p.right_id)]);
      const embedFn = async (sentences) => {
        const r = await embedTexts(sentences, {});
        if (!r || r.success !== true) throw new Error('embedder failed for claim sentences');
        return r.vectors;
      };
      let scored = new Map();
      try {
        scored = await claimLevelScores(artifacts, wanted, embedFn);
        claimStatus = 'ok';
      } catch (err) {
        claimStatus = 'failed';
        warnings.push('claim_level failed: ' + (err && err.message ? err.message : String(err)));
      }
      const allSem = [];
      for (let i = 0; i < artifacts.length; i += 1) {
        for (let j = i + 1; j < artifacts.length; j += 1) allSem.push(semanticMatrix[i][j]);
      }
      allSem.sort((a, b) => a - b);
      const cut = allSem.length ? allSem[Math.min(allSem.length - 1, Math.floor(0.75 * (allSem.length - 1)))] : 1;
      pairs.forEach((p, k) => {
        const hit = scored.get(wanted[k][0] + ':' + wanted[k][1]);
        if (!hit) { p.claim_level = { status: claimStatus === 'ok' ? 'no_problem_method_sentences' : claimStatus }; return; }
        p.claim_level = Object.assign({ status: 'ok' }, hit, {
          supported: hit.claim_sim >= cut,
          support_cut: _round(cut, 4),
          support_cut_basis: 'corpus 75th percentile of semantic_sim',
        });
        p.source_trail.forEach((t) => {
          if (t.artifact_id === hit.problem_artifact) { t.extracted_sentence = hit.problem_sentence; t.role = 'problem'; }
          else if (t.artifact_id === hit.method_artifact) { t.extracted_sentence = hit.method_sentence; t.role = 'method'; }
        });
      });
    }
  }
  void embedVectors;

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

  const n = artifacts.length;
  const result = {
    metadata: {
      timestamp: nowIso,
      room_dir: resolvedRoomDir,
      tier: 1,
      artifact_count: n,
      pair_count: pairs.length,
      spectral_version: SPECTRAL_VERSION,
      schema_version: SCHEMA_VERSION,
      spectral_summary: {
        mean_omhmm: meanOmhmm,
        mean_spectral_gap: meanSpectralGap,
        dominant_mode_distribution: modeCounts,
        spectral_artifacts: spectralGaps.length,
        legacy_artifacts: spectralScores.length - spectralGaps.length,
      },
      ranking: {
        method: ranking,
        fixed_threshold: threshold,
        min_percentile: minPercentile,
        top_k: topK,
        pairs_scored: (n * (n - 1)) / 2,
        basis: ranking === 'percentile'
          ? 'empirical percentile and z-score of hsi_score over all scored pairs'
          : 'fixed hsi_score threshold',
      },
      provenance: {
        computed_at: nowIso,
        script: 'hsi-engine.cjs',
        lexical_leg: lexical,
        lsa_params: { max_features: 500, max_components: 80, stop_words: 'english' },
        bm25_params: { k1: 1.5, b: 0.75 },
        semantic_leg: semanticLeg,
        dense_model: semanticLeg === 'embedding-spine' ? (embedResult.model || embedResult.modelId || 'embedding-spine default') : null,
        claim_level: claimStatus,
        warnings: warnings,
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
  extractClaims,
  claimLevelScores,
};
