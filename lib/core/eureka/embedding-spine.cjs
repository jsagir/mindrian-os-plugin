/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 211-01 -- the local embedding spine (D-200-1 encoder swap).
 * quick(260706-13z) -- D3 model swap + schema-driven dim + first-run notice.
 *
 * The ONE local encoder every Phase 211 consumer (tri-modal index, hybrid
 * retrieve, measured differential) calls. It embeds text LOCALLY with
 * transformers.js (ONNX runtime) -- NO Python, NO PyTorch, NO GPU, NO Brain.
 *
 * MODEL (D3, per the room's ratified diligence
 * ~/MindrianRooms/rethinking-mindrianos/research/2026-07-05-eureka-critic-brain-mcp-plan/2026-07-05-eureka-technical-diligence.md,
 * doc lines 78-103): the original 211-01 default Xenova/all-MiniLM-L6-v2 is a
 * 2019-2021-era model, among the LOWEST scorers in a 16-model open benchmark.
 * The diligence rules to default to MongoDB/mdbr-leaf-ir (23M params, Apache
 * 2.0, #1 on MTEB BEIR/RTEB <=100M params) "pending a one-day spike confirming
 * ONNX weights load in transformers.js v4", with Xenova/bge-small-en-v1.5 as
 * the named 384-dim fallback. The quick(260706-13z) spike RAN LIVE and
 * confirmed: MongoDB/mdbr-leaf-ir loads in transformers.js v4
 * feature-extraction (dtype q8), emits a MEASURED 384-dim vector (the diligence
 * doc guessed 768; the loaded ONNX model actually reports 384), and passes the
 * cosine sanity gate with margin 0.56 (cat/kitten 0.822 vs cat/audit 0.260).
 * So DEFAULT_MODEL is now MongoDB/mdbr-leaf-ir.
 *
 * DIM (D3, doc line 103: "stop hard-coding 384 dims"): there is no longer a
 * single EMBED_DIM constant. resolveDim() reads MINDRIAN_EMBED_DIM (validated)
 * > KNOWN_MODEL_DIMS[resolveModel()] > the default model's dim, and embedTexts
 * keeps stamping the TRUE dim from vectors[0].length. A future model swap is a
 * config change + re-embed, never schema surgery (the vec table reads the
 * resolved dim in vector-store.cjs). The tri-modal index stores embedding_model
 * + embedding_dim per room in eureka_meta.
 *
 * This closes the D-200-1 decision Phase 200 deferred
 * (200-01-SUMMARY.md line 121): rs-differential-scorer.cjs:107's semantic leg
 * becomes a MEASURED cosine instead of model-judgment.
 *
 * --------------------------------------------------------------------------
 * CANON PART 8 (Graph Boundary): fully local, zero user-byte egress.
 * --------------------------------------------------------------------------
 * Embedding computation runs entirely on the local CPU. The ONLY network
 * touch is the one-time model DOWNLOAD, which fetches generic public model
 * weights by MODEL ID only (e.g. "MongoDB/mdbr-leaf-ir") -- no user text,
 * no room content, no local bytes leave the machine. The text you embed never
 * crosses a wire. This module therefore adds NO audit/egress layer of its own;
 * the differential scorer keeps its own Part 8 defense-in-depth layers.
 *
 * --------------------------------------------------------------------------
 * CANON DECISION #8 (Tier-0 graceful degradation): the module MUST load on a
 * machine where the @huggingface/transformers install failed. The heavy dep is
 * therefore LAZY-required INSIDE getEncoder (never at module top). When it is
 * absent or the model cannot load, embedTexts degrades with
 * {success:false, error:'encoder_unavailable'} instead of throwing.
 *
 * CANON PART 7 (Reuse Before Build): cosineSimilarity is re-exported from
 * rs-pinecone-bridge.cjs -- the same function object, not a fork.
 * --------------------------------------------------------------------------
 *
 * Interface contract (consumed by 211-02 and 211-03):
 *
 *   getEncoder(opts)
 *     -> Promise<{success:true, encoder}
 *              | {success:false, error:'encoder_unavailable', detail}>
 *   embedTexts(texts: string[], opts)
 *     -> Promise<{success:true, vectors: number[][] (resolveDim()-dim, L2-normalized),
 *                 provenance:{model, dtype, dim}}
 *              | {success:false, error:'encoder_unavailable'|'embed_failed', detail}>
 *     // The real-model path batches the encoder call in resolveBatchSize()-sized
 *     //   slices (the large-N OOM guard for rooms with thousands of claim
 *     //   nodes); vectors concat back in order, provenance shape unchanged.
 *     // opts.encodeFn (texts -> number[][]) injection bypasses the model
 *     //   entirely -- the offline test seam. It receives the FULL list in one
 *     //   call (UNBATCHED passthrough); vectors pass through unchanged.
 *     // opts._forceUnavailable (test hook) simulates a failed dep import.
 *   encoderProvenance()
 *     -> {model, dtype, dim, method:'transformers.js-feature-extraction'}
 *   resolveDim() -> number   // MINDRIAN_EMBED_DIM > KNOWN_MODEL_DIMS > default
 *   cosineSimilarity(a, b) -> number   // re-export, Part 7 reuse
 *
 * Env tunables (RS_SEMANTIC_FLOOR precedent from Phase 200):
 *   MINDRIAN_EMBED_MODEL  (default 'MongoDB/mdbr-leaf-ir')
 *   MINDRIAN_EMBED_DIM    (optional positive int; overrides the resolved dim,
 *                          e.g. when running an env-selected model not in the
 *                          KNOWN_MODEL_DIMS map)
 *   MINDRIAN_EMBED_DTYPE  (default 'q8')
 *   MINDRIAN_EMBED_BATCH  (optional positive int; default 32; texts per encoder
 *                          forward pass - the large-N OOM guard)
 *   MINDRIAN_MODEL_CACHE  (optional; when set, assigned to transformers.js
 *                          env.cacheDir before the pipeline is created)
 *
 * Pure CJS, node built-ins + one lazy dep. Never throws across a boundary.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { cosineSimilarity } = require('../rs-pinecone-bridge.cjs');

// ---------- Constants ----------
//
// DEFAULT_MODEL is the quick(260706-13z) D3 spike winner: MongoDB/mdbr-leaf-ir
// (loads in transformers.js v4, measured 384-dim, Apache 2.0). The old
// Xenova/all-MiniLM-L6-v2 stays in KNOWN_MODEL_DIMS so an env rollback still
// resolves the right dim.

const DEFAULT_MODEL = 'MongoDB/mdbr-leaf-ir';
const DEFAULT_DTYPE = 'q8';
const METHOD = 'transformers.js-feature-extraction';

// DEFAULT_BATCH bounds the OOM root cause. On the real jhtv-oliver-kuntz room
// (2117 claim nodes) handing the WHOLE list to enc.encoder in one forward pass
// padded the tokenizer input to [2128, 512] and the ONNX runtime attempted a
// ~26.7GB allocation in a single Expand node -- an out-of-memory crash. Slicing
// the encoder loop into batches of at most this many texts bounds the padded
// activation size per pass, so large-N rooms embed in bounded memory. Tunable
// at call time via MINDRIAN_EMBED_BATCH (resolveBatchSize).
const DEFAULT_BATCH = 32;

// KNOWN_MODEL_DIMS: the native output dim of each shipped/rollback model, so a
// consumer can resolve the dim WITHOUT loading the heavy model. Dims are the
// MEASURED tolist()[0].length (mdbr-leaf-ir's is 384 per the live spike, not
// the 768 the diligence doc guessed). Extend this map to ship a new default.
const KNOWN_MODEL_DIMS = Object.freeze({
  'MongoDB/mdbr-leaf-ir': 384,
  'onnx-community/mdbr-leaf-ir-ONNX': 384,
  'Xenova/bge-small-en-v1.5': 384,
  'Xenova/all-MiniLM-L6-v2': 384,
});

const DEFAULT_DIM = KNOWN_MODEL_DIMS[DEFAULT_MODEL];

// ---------- Env resolution (read at CALL time, not frozen at load) ----------
//
// Resolved dynamically so a consumer can flip MINDRIAN_EMBED_MODEL between
// calls (and so the offline tests can assert both the default and an override
// without re-requiring the module). Mirrors the RS_SEMANTIC_FLOOR pattern in
// rs-differential-scorer.cjs (env-string -> validated -> default fallback).

function resolveModel() {
  const raw = process.env.MINDRIAN_EMBED_MODEL;
  if (typeof raw === 'string' && raw.trim() !== '') return raw.trim();
  return DEFAULT_MODEL;
}

function resolveDtype() {
  const raw = process.env.MINDRIAN_EMBED_DTYPE;
  if (typeof raw === 'string' && raw.trim() !== '') return raw.trim();
  return DEFAULT_DTYPE;
}

// resolveDim: MINDRIAN_EMBED_DIM (positive-int validated) > the known dim of the
// resolved model > the default model's dim. The single source of truth for the
// vec table width (vector-store.cjs reads it) so a model swap never needs a
// schema edit -- just a re-embed. embedTexts still stamps the TRUE dim from the
// vector length, so a mismatch between this hint and reality is always caught.
function resolveDim() {
  const raw = process.env.MINDRIAN_EMBED_DIM;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw.trim());
    if (Number.isInteger(n) && n > 0) return n;
  }
  const known = KNOWN_MODEL_DIMS[resolveModel()];
  if (Number.isInteger(known) && known > 0) return known;
  return DEFAULT_DIM;
}

// resolveBatchSize: the large-N OOM guard tunable. Reads MINDRIAN_EMBED_BATCH at
// CALL time; when it is a non-empty trimmed string that parses to a positive
// integer, that value is the number of texts per encoder forward pass. Any
// invalid value ('0', '-5', 'abc', '') falls back to DEFAULT_BATCH = 32, so a
// malformed operator env can never zero out or invert the batching loop.
// Mirrors resolveDim's positive-int validation shape exactly.
function resolveBatchSize() {
  const raw = process.env.MINDRIAN_EMBED_BATCH;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw.trim());
    if (Number.isInteger(n) && n > 0) return n;
  }
  return DEFAULT_BATCH;
}

// ---------- encoderProvenance ----------
//
// Every embedding result carries provenance so no downstream score is ever a
// bare unattributed number. dim is RESOLVED (not a frozen constant) via
// resolveDim(): env override > known-model map > default model dim. A consumer
// that swaps to a differently-sized model via MINDRIAN_EMBED_MODEL (with its
// dim in KNOWN_MODEL_DIMS, or MINDRIAN_EMBED_DIM set) gets the right dim here,
// and the true dim is still stamped on embedTexts results (dim = vectors[0].length).

function encoderProvenance() {
  return {
    model: resolveModel(),
    dtype: resolveDtype(),
    dim: resolveDim(),
    method: METHOD,
  };
}

// ---------- Pipeline singleton (one model load per process) ----------
//
// Keyed by model+dtype so a mid-process env swap creates a fresh pipeline
// rather than silently reusing the wrong model. The cached VALUE is the
// in-flight Promise, so concurrent callers share a single load.

let _pipelineCache = Object.create(null);

// ---------- First-run download notice (D14) ----------
//
// The tens-of-MB ONNX fetch happens lazily on the FIRST real embedding call and
// today looks like a silent hang. We emit ONE friendly stderr line per process
// when a real download is about to happen (cache MISS). Cache hits and injected
// encodeFn calls emit nothing. Module-level latch so it fires at most once.

let _downloadNoticeShown = false;

// resolveCacheDir (D-07): MINDRIAN_MODEL_CACHE override, else a STABLE default
// outside the versioned plugin install directory. The transformers.js
// package-relative default (env.cacheDir, e.g. node_modules/@huggingface/
// transformers/.cache/ in this checkout, or
// ~/.claude/plugins/cache/mindrian-marketplace/mos/<version>/ in a real
// marketplace install) sits inside a directory lib/core/cache-prune.cjs
// deletes on every version update (RESEARCH.md Finding F-10) -- without this
// fix the "one-time" model download recurs on every plugin update. The new
// default follows the SAME $HOME/.mindrian/ home-dir resolution idiom already
// established by lib/core/mva-state.cjs:43 / lib/core/install-state.cjs
// (process.env.HOME || process.env.USERPROFILE || os.homedir()), not a fresh
// reimplementation. `env` is the @huggingface/transformers env object (may be
// undefined if the dep failed to load) -- kept as a LAST-RESORT fallback only,
// preserving the "never return null on a real environment" contract.
function resolveCacheDir(env) {
  const override = process.env.MINDRIAN_MODEL_CACHE;
  if (typeof override === 'string' && override.trim() !== '') return override.trim();
  try {
    const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
    const dir = path.join(home, '.mindrian', 'model-cache');
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (_e) {
      // Filesystem setup only, not a Part 8 concern -- degrade gracefully,
      // never throw across this resolver's boundary.
    }
    return dir;
  } catch (_e) {
    // Extremely unlikely (home-dir resolution itself failed): fall through to
    // the transformers.js package-relative default rather than return null.
    if (env && typeof env.cacheDir === 'string' && env.cacheDir.trim() !== '') return env.cacheDir;
    return null;
  }
}

// isModelCached (D-06): delegates to @huggingface/transformers'
// ModelRegistry.is_pipeline_cached instead of the old fs.existsSync-on-a-
// guessed-path heuristic, which false-positives on a partially-downloaded
// model (a present directory missing config.json reads as a hit). Measured
// live (RESEARCH.md Finding F-11): returns false in ~17ms on a cold cache, no
// network call, no throw. Async now (was sync) -- the ONE call site
// (maybeEmitDownloadNotice, below) threads the await through.
//
// Lazy-requires @huggingface/transformers inside the function (Canon Decision
// #8, convention 3): this function did not previously touch the heavy
// dependency, but the fixed version must, so the lazy-require discipline now
// applies here too. Sets env.allowRemoteModels = false before the probe
// (belt-and-braces; transformers.js v4 ignores HF_HUB_OFFLINE, per
// tests/eureka-offline-preload.cjs:17-22). Defensive: any error, OR a missing
// @huggingface/transformers dependency, returns TRUE -- the same "uncertain
// state -> treat as hit, never over-notify" default the old function carried,
// so a machine where the encoder cannot run at all regardless of cache state
// never degrades into a spurious "downloading" notice.
async function isModelCached(model, cacheDir, dtype) {
  let transformers;
  try {
    // eslint-disable-next-line global-require
    transformers = require('@huggingface/transformers');
  } catch (_e) {
    return true; // dependency absent -> defensive default, unchanged
  }
  try {
    transformers.env.allowRemoteModels = false;
    const options = { dtype: dtype };
    if (cacheDir) options.cache_dir = cacheDir;
    return await transformers.ModelRegistry.is_pipeline_cached('feature-extraction', model, options);
  } catch (_e) {
    return true; // uncertain state -> treat as hit, never over-notify
  }
}

// maybeEmitDownloadNotice: async now (isModelCached is async). Takes the same
// dtype the caller already has in scope (getEncoder's resolveDtype()) so the
// probe checks the actual required file set for that dtype, not a guess.
// D-06 correction (RESEARCH.md Correction C-3, Pitfall 8): a fine-grained,
// progressively-updating fetch meter via progress_callback is NOT reachable
// for the .onnx weight file on Node -- IS_NODE_ENV && return_path skips the
// buffered read and emits one terminal progress:100 event (node_modules/
// @huggingface/transformers/src/utils/hub.js:352-356, :434-443). The notice
// text below makes no fine-grained fetch-progress promise; it states
// per-file, approximate-size language instead.
async function maybeEmitDownloadNotice(model, cacheDir, dtype) {
  const cached = await isModelCached(model, cacheDir, dtype);
  if (cached) return false; // hit -> no notice, not a first download
  if (!_downloadNoticeShown) {
    _downloadNoticeShown = true;
    try {
      process.stderr.write(
        'MindrianOS: fetching the local embedding model (' + model
        + ') - a one-time download (config + weights, a few files); '
        + 'later runs use the local cache.\n'
      );
    } catch (_e) { /* never let a logging failure break embedding */ }
  }
  return true; // a real (miss) download is starting
}

// ---------- getEncoder ----------
//
// Lazily imports @huggingface/transformers INSIDE this function (Canon Decision
// #8): the module must load even where the dep install failed. On any failure
// (dep absent, model unresolvable, load error) returns the structured
// encoder_unavailable envelope; NEVER throws.
//
// opts._forceUnavailable (test hook): short-circuits to encoder_unavailable
// without touching the dep, so the graceful-degradation path is testable
// offline (Test 3).

async function getEncoder(opts) {
  const options = opts || {};
  if (options._forceUnavailable) {
    return { success: false, error: 'encoder_unavailable', detail: 'forced_unavailable_test_hook' };
  }

  const model = resolveModel();
  const dtype = resolveDtype();
  const cacheKey = model + '::' + dtype;

  if (_pipelineCache[cacheKey]) {
    try {
      const encoder = await _pipelineCache[cacheKey];
      // Already loaded once this process -> never a first download.
      return { success: true, encoder: encoder, first_download: false };
    } catch (err) {
      // A prior load rejected; drop the poisoned cache entry and fall through
      // to a fresh attempt below.
      delete _pipelineCache[cacheKey];
    }
  }

  let transformers;
  try {
    // eslint-disable-next-line global-require
    transformers = require('@huggingface/transformers');
  } catch (err) {
    return {
      success: false,
      error: 'encoder_unavailable',
      detail: 'require_failed: ' + String(err && err.message),
    };
  }

  try {
    const { pipeline, env } = transformers;
    // Cache dir assignment (D-07). Assigned BEFORE pipeline creation so the
    // download/load honors it. resolveCacheDir(env) honors an explicit
    // MINDRIAN_MODEL_CACHE override when set, else resolves the new stable
    // $HOME/.mindrian/model-cache default -- so the actual transformers.js
    // pipeline creation honors the new default even when MINDRIAN_MODEL_CACHE
    // is unset (previously env.cacheDir was only assigned when the override
    // WAS set, leaving the fix cosmetic in resolveCacheDir's return value
    // alone).
    if (env) {
      env.cacheDir = resolveCacheDir(env);
    }
    // D14: on a cache MISS, emit ONE friendly stderr notice before the fetch.
    // first_download reports whether this call is triggering the real download.
    const firstDownload = await maybeEmitDownloadNotice(model, resolveCacheDir(env), dtype);
    const loadPromise = pipeline('feature-extraction', model, { dtype: dtype });
    _pipelineCache[cacheKey] = loadPromise;
    const encoder = await loadPromise;
    return { success: true, encoder: encoder, first_download: firstDownload };
  } catch (err) {
    delete _pipelineCache[cacheKey];
    return {
      success: false,
      error: 'encoder_unavailable',
      detail: 'load_failed: ' + String(err && err.message),
    };
  }
}

// ---------- Tensor -> plain number[][] ----------
//
// transformers.js feature-extraction with {pooling:'mean', normalize:true}
// returns a Tensor of shape [n, dim]. Prefer .tolist() (nested array); fall
// back to reshaping .data by .dims for older/newer tensor shapes.

function toVectors(output, n) {
  if (output && typeof output.tolist === 'function') {
    return output.tolist();
  }
  if (Array.isArray(output)) {
    return output;
  }
  if (output && output.data && Array.isArray(output.dims) && output.dims.length === 2) {
    const rows = output.dims[0];
    const cols = output.dims[1];
    const flat = Array.from(output.data);
    const out = [];
    for (let i = 0; i < rows; i += 1) {
      out.push(flat.slice(i * cols, (i + 1) * cols));
    }
    return out;
  }
  // Last resort: a single flat vector for a single input.
  if (output && output.data && n === 1) {
    return [Array.from(output.data)];
  }
  return null;
}

// ---------- batchSlices (pure, testable) ----------
//
// Splits a list into consecutive slices of at most `size` elements, advancing by
// `size` each step (order preserved; the last slice may be shorter). No env
// reads, no I/O -- the pure seam the real-model loop uses to bound per-pass
// memory, exported via _test only. An empty list returns []. Callers pass a
// positive int (resolveBatchSize guarantees that).
function batchSlices(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) {
    out.push(list.slice(i, i + size));
  }
  return out;
}

// ---------- embedTexts ----------
//
// Embeds an array of texts locally, returns L2-normalized 384-dim vectors with
// provenance. Two seams:
//   opts.encodeFn      -> bypass the model entirely; vectors pass through
//                          UNCHANGED (no re-normalization) with provenance.model
//                          'stub' (the offline test path).
//   opts._forceUnavailable -> forwarded to getEncoder (encoder_unavailable).
//
// Never throws: every failure is a structured envelope.

async function embedTexts(texts, opts) {
  const options = opts || {};
  const list = Array.isArray(texts) ? texts : [];

  // --- Injection seam (offline / test): use the caller's encodeFn directly. ---
  if (typeof options.encodeFn === 'function') {
    try {
      const vectors = options.encodeFn(list);
      if (!Array.isArray(vectors)) {
        return { success: false, error: 'embed_failed', detail: 'encodeFn did not return an array' };
      }
      const dim = (vectors[0] && vectors[0].length) || 0;
      return {
        success: true,
        vectors: vectors,
        provenance: { model: 'stub', dtype: resolveDtype(), dim: dim },
      };
    } catch (err) {
      return { success: false, error: 'embed_failed', detail: String(err && err.message) };
    }
  }

  // --- Real model path (lazy load, graceful degradation). ---
  const enc = await getEncoder(options);
  if (!enc.success) {
    return { success: false, error: 'encoder_unavailable', detail: enc.detail };
  }

  try {
    // OOM guard: never hand the WHOLE list to enc.encoder in one forward pass
    // (that padded 2117 texts to [2128, 512] and triggered a ~26.7GB Expand
    // allocation). Loop consecutive slices of at most resolveBatchSize() texts
    // and concat the per-batch vectors in order. An empty input list yields
    // zero encoder calls and {success:true, vectors:[]} -- it never reaches the
    // encoder. The whole loop stays INSIDE this try so the never-throws
    // whole-call envelope holds: any per-batch failure fails the WHOLE call.
    const slices = batchSlices(list, resolveBatchSize());
    const vectors = [];
    for (let s = 0; s < slices.length; s += 1) {
      const slice = slices[s];
      const output = await enc.encoder(slice, { pooling: 'mean', normalize: true });
      const batchVectors = toVectors(output, slice.length);
      if (!batchVectors) {
        return { success: false, error: 'embed_failed', detail: 'could not convert tensor output' };
      }
      for (let v = 0; v < batchVectors.length; v += 1) {
        vectors.push(batchVectors[v]);
      }
    }
    const dim = (vectors[0] && vectors[0].length) || resolveDim();
    return {
      success: true,
      vectors: vectors,
      provenance: { model: resolveModel(), dtype: resolveDtype(), dim: dim },
    };
  } catch (err) {
    return { success: false, error: 'embed_failed', detail: String(err && err.message) };
  }
}

// ---------- Exports ----------

module.exports = {
  getEncoder: getEncoder,
  embedTexts: embedTexts,
  encoderProvenance: encoderProvenance,
  resolveDim: resolveDim,
  cosineSimilarity: cosineSimilarity,
  _test: {
    DEFAULT_MODEL: DEFAULT_MODEL,
    DEFAULT_DTYPE: DEFAULT_DTYPE,
    DEFAULT_DIM: DEFAULT_DIM,
    DEFAULT_BATCH: DEFAULT_BATCH,
    KNOWN_MODEL_DIMS: KNOWN_MODEL_DIMS,
    METHOD: METHOD,
    resolveModel: resolveModel,
    resolveDtype: resolveDtype,
    resolveDim: resolveDim,
    resolveBatchSize: resolveBatchSize,
    resolveCacheDir: resolveCacheDir,
    isModelCached: isModelCached,
    maybeEmitDownloadNotice: maybeEmitDownloadNotice,
    toVectors: toVectors,
    batchSlices: batchSlices,
    resetPipelineCache: function reset() { _pipelineCache = Object.create(null); },
    resetDownloadNotice: function reset() { _downloadNoticeShown = false; },
  },
};
