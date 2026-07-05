/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 211-01 -- the local embedding spine (D-200-1 encoder swap).
 *
 * The ONE local encoder every Phase 211 consumer (tri-modal index, hybrid
 * retrieve, measured differential) calls. It embeds text LOCALLY with
 * transformers.js (ONNX runtime) -- NO Python, NO PyTorch, NO GPU, NO Brain.
 * Model per SEED-049 WebSearch validation (2026-07-04): Xenova/all-MiniLM-L6-v2,
 * 384-dim, dtype q8, with Xenova/bge-small-en-v1.5 as the documented stronger
 * alternative (SEED-049 D3). This closes the D-200-1 decision Phase 200 deferred
 * (200-01-SUMMARY.md line 121): rs-differential-scorer.cjs:107's semantic leg
 * becomes a MEASURED cosine instead of model-judgment.
 *
 * --------------------------------------------------------------------------
 * CANON PART 8 (Graph Boundary): fully local, zero user-byte egress.
 * --------------------------------------------------------------------------
 * Embedding computation runs entirely on the local CPU. The ONLY network
 * touch is the one-time model DOWNLOAD, which fetches generic public model
 * weights by MODEL ID only (e.g. "Xenova/all-MiniLM-L6-v2") -- no user text,
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
 *     -> Promise<{success:true, vectors: number[][] (384-dim, L2-normalized),
 *                 provenance:{model, dtype, dim}}
 *              | {success:false, error:'encoder_unavailable'|'embed_failed', detail}>
 *     // opts.encodeFn (texts -> number[][]) injection bypasses the model
 *     //   entirely -- the offline test seam (vectors pass through unchanged).
 *     // opts._forceUnavailable (test hook) simulates a failed dep import.
 *   encoderProvenance()
 *     -> {model, dtype, dim, method:'transformers.js-feature-extraction'}
 *   cosineSimilarity(a, b) -> number   // re-export, Part 7 reuse
 *
 * Env tunables (RS_SEMANTIC_FLOOR precedent from Phase 200):
 *   MINDRIAN_EMBED_MODEL  (default 'Xenova/all-MiniLM-L6-v2')
 *   MINDRIAN_EMBED_DTYPE  (default 'q8')
 *   MINDRIAN_MODEL_CACHE  (optional; when set, assigned to transformers.js
 *                          env.cacheDir before the pipeline is created)
 *
 * Pure CJS, node built-ins + one lazy dep. Never throws across a boundary.
 */
'use strict';

const { cosineSimilarity } = require('../rs-pinecone-bridge.cjs');

// ---------- Constants ----------

const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2';
const DEFAULT_DTYPE = 'q8';
const EMBED_DIM = 384;
const METHOD = 'transformers.js-feature-extraction';

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

// ---------- encoderProvenance ----------
//
// Every embedding result carries provenance so no downstream score is ever a
// bare unattributed number. dim is fixed at 384 for the MiniLM/BGE-small class
// (both defaults are 384-dim); a consumer that swaps to a 768-dim model via env
// still gets the true dim stamped on embedTexts results (dim = vectors[0].length
// there), while this pure-metadata call reports the class default.

function encoderProvenance() {
  return {
    model: resolveModel(),
    dtype: resolveDtype(),
    dim: EMBED_DIM,
    method: METHOD,
  };
}

// ---------- Pipeline singleton (one model load per process) ----------
//
// Keyed by model+dtype so a mid-process env swap creates a fresh pipeline
// rather than silently reusing the wrong model. The cached VALUE is the
// in-flight Promise, so concurrent callers share a single load.

let _pipelineCache = Object.create(null);

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
      return { success: true, encoder: encoder };
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
    // Local cache dir override (optional). Assigned BEFORE pipeline creation so
    // the download/load honors it. Keeps model weights on a caller-chosen path.
    if (typeof process.env.MINDRIAN_MODEL_CACHE === 'string'
        && process.env.MINDRIAN_MODEL_CACHE.trim() !== ''
        && env) {
      env.cacheDir = process.env.MINDRIAN_MODEL_CACHE.trim();
    }
    const loadPromise = pipeline('feature-extraction', model, { dtype: dtype });
    _pipelineCache[cacheKey] = loadPromise;
    const encoder = await loadPromise;
    return { success: true, encoder: encoder };
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
    const output = await enc.encoder(list, { pooling: 'mean', normalize: true });
    const vectors = toVectors(output, list.length);
    if (!vectors) {
      return { success: false, error: 'embed_failed', detail: 'could not convert tensor output' };
    }
    const dim = (vectors[0] && vectors[0].length) || EMBED_DIM;
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
  cosineSimilarity: cosineSimilarity,
  _test: {
    DEFAULT_MODEL: DEFAULT_MODEL,
    DEFAULT_DTYPE: DEFAULT_DTYPE,
    EMBED_DIM: EMBED_DIM,
    METHOD: METHOD,
    resolveModel: resolveModel,
    resolveDtype: resolveDtype,
    toVectors: toVectors,
    resetPipelineCache: function reset() { _pipelineCache = Object.create(null); },
  },
};
