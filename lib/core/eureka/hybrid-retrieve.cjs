'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 211-02 -- hybrid retrieval: RRF fusion + FlashRank-model rerank.
 *
 * Stage 1 (fusion): run the LEXICAL leg (bm25) and the SEMANTIC leg (vector)
 * from tri-modal-index.cjs, then fuse their RANKINGS (not their raw scores)
 * with Reciprocal Rank Fusion at ROOM-SCALE k. The 2026-07-04 WebSearch
 * validation prescribed k in 20-30 for small corpora, NOT the textbook k=60:
 * small corpora want LESS top-rank dampening. Default 25, env-tunable via
 * EUREKA_RRF_K (same env-string -> validated -> default shape as
 * RS_SEMANTIC_FLOOR in rs-differential-scorer.cjs). RRF earns its keep exactly
 * when the two legs are genuinely diverse signals (SEED-049), which lexical and
 * semantic are.
 *
 * Stage 2 (optional rerank): reorder the fused top-K with the smallest CPU-only
 * cross-encoder. The ROADMAP locks "FlashRank local rerank"; FlashRank itself is
 * a Python pip package (forbidden on the user machine, SEED-013). Its DEFAULT
 * model -- ms-marco-TinyBERT-L-2-v2, ~4MB, no Torch -- exists as an ONNX port
 * (Xenova/ms-marco-TinyBERT-L-2-v2) runnable by the ALREADY-INSTALLED
 * @huggingface/transformers runtime. So the rerank ships FlashRank's model
 * through transformers.js: same model, same size class, zero new dependency,
 * zero Python. Runtime fallback id: Xenova/ms-marco-MiniLM-L-6-v2.
 *
 * --------------------------------------------------------------------------
 * CANON PART 9 (Memory Locality) BOUNDARY STATEMENT:
 * --------------------------------------------------------------------------
 * This module READS the derived index tables (via tri-modal-index.cjs) and
 * fuses/reranks in memory. It writes ZERO typed edges, ZERO memory_event rows,
 * ZERO node mutations, and ZERO tables of its own. The navigation.cjs
 * chokepoint is not bypassed because nothing here is graph memory; graph
 * write-back is Phase 212 / 201-03 territory.
 *
 * CANON DECISION #8 (Tier-0 graceful degradation): EVERY degradation path is a
 * WARNING field on the returned envelope, NEVER a throw. Vector leg missing ->
 * lexical-only + warning. Rerank model missing -> input order + warning.
 * --------------------------------------------------------------------------
 *
 * Exports:
 *   rrfFuse(rankedLists, k)        -> [{ node_id, rrf_score, sources[] }]
 *   hybridRetrieve(db, query, opts)-> Promise<{ results[], warning? }>
 *   rerank(query, candidates, opts)-> Promise<{ results[], warning? }>
 *   RRF_K                          -> resolved default k (snapshot at load)
 *   _test                          -> internal helpers for offline assertions
 *
 * Env:
 *   EUREKA_RRF_K           (default 25; room-scale, clamps invalid back to 25)
 *   MINDRIAN_RERANK_MODEL  (default Xenova/ms-marco-TinyBERT-L-2-v2)
 *
 * Pure CJS + tri-modal-index + embedding-spine + one OPTIONAL lazy dep
 * (@huggingface/transformers, only on the real rerank path).
 */

const tri = require('./tri-modal-index.cjs');
const { embedTexts } = require('./embedding-spine.cjs');

// FlashRank's default model, delivered as its ONNX port through transformers.js
// (see the header note). Runtime fallback if the id fails to resolve.
const DEFAULT_RERANK_MODEL = 'Xenova/ms-marco-TinyBERT-L-2-v2';
const FALLBACK_RERANK_MODEL = 'Xenova/ms-marco-MiniLM-L-6-v2';

// ---------- RRF_K env resolution (read at CALL time) ----------
//
// Room-scale default 25 (2026-07-04 validation). Resolved dynamically so a
// consumer can flip EUREKA_RRF_K between calls; invalid values clamp to 25.

function resolveRrfK() {
  const raw = process.env.EUREKA_RRF_K;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const v = Number(raw);
    if (Number.isFinite(v) && v > 0) return v;
  }
  return 25;
}

// Snapshot of the default at load, for consumers that want the constant.
const RRF_K = resolveRrfK();

// Positional source names when a caller passes bare arrays instead of tagged
// { source, items } lists.
const DEFAULT_SOURCE_NAMES = ['lexical', 'vector', 'structural'];

// ---------- rrfFuse ----------
//
// Pure, rank-only fusion. score(d) = sum over the lists it appears in of
// 1/(k + rank), with 1-BASED ranks. Accepts either a bare ranked array or a
// tagged { source, items } list; records the contributing source names.
// Returns descending by rrf_score.

function rrfFuse(rankedLists, k) {
  const kk = (Number.isFinite(k) && k > 0) ? k : resolveRrfK();
  const lists = Array.isArray(rankedLists) ? rankedLists : [];
  const acc = new Map();

  for (let li = 0; li < lists.length; li += 1) {
    const entry = lists[li];
    const arr = Array.isArray(entry) ? entry : ((entry && entry.items) || []);
    const sourceName = (entry && !Array.isArray(entry) && entry.source)
      ? entry.source
      : (DEFAULT_SOURCE_NAMES[li] || ('list' + li));
    for (let idx = 0; idx < arr.length; idx += 1) {
      const item = arr[idx] || {};
      const id = (item.node_id != null) ? item.node_id : item.id;
      if (id == null) continue;
      const rank = idx + 1; // 1-based
      const contribution = 1 / (kk + rank);
      let cur = acc.get(id);
      if (!cur) {
        cur = { node_id: id, rrf_score: 0, sources: [] };
        acc.set(id, cur);
      }
      cur.rrf_score += contribution;
      if (cur.sources.indexOf(sourceName) === -1) cur.sources.push(sourceName);
    }
  }

  return Array.from(acc.values()).sort(function (a, b) { return b.rrf_score - a.rrf_score; });
}

// ---------- hybridRetrieve ----------
//
// Runs the lexical leg and (when the encoder is available) the vector leg over a
// caller-owned db handle, fuses them with RRF, and slices to opts.k. When the
// vector leg cannot be built (encoder unavailable) it degrades to lexical-only
// with warning:'vector_leg_unavailable' and NEVER throws. opts.encodeFn /
// opts._forceUnavailable are forwarded to embedTexts (the offline test seam).

async function hybridRetrieve(db, query, opts) {
  const options = opts || {};
  const k = Number.isFinite(options.k) && options.k > 0 ? options.k : 10;
  const pool = k * 2; // fetch a wider pool per leg, then fuse and slice to k

  const lexical = tri.lexicalSearch(db, query, pool);

  let warning = null;
  let vectorList = [];
  const emb = await embedTexts([query], {
    encodeFn: options.encodeFn,
    _forceUnavailable: options._forceUnavailable,
  });
  if (emb.success && Array.isArray(emb.vectors) && emb.vectors[0]) {
    vectorList = tri.vectorSearch(db, emb.vectors[0], pool);
  } else {
    warning = 'vector_leg_unavailable';
  }

  const lists = [{ source: 'lexical', items: lexical }];
  if (!warning) lists.push({ source: 'vector', items: vectorList });

  const fused = rrfFuse(lists, options.rrfK).slice(0, k);
  const out = { results: fused };
  if (warning) out.warning = warning;
  return out;
}

// ---------- rerank ----------
//
// Optional stage-2 cross-encoder rerank. opts.rerankFn (query, candidates) ->
// number[] is the offline injection seam. Otherwise lazy-loads a transformers.js
// text-classification pipeline (FlashRank's ms-marco-TinyBERT model, MiniLM
// fallback) and scores each (query, candidate_text) pair. Candidate text is read
// from candidate.text || candidate.content || String(node_id). ANY failure
// (dep absent, model unresolvable, scoring error) returns the INPUT order with
// warning:'rerank_unavailable'; never throws.

function candidateText(c) {
  if (!c) return '';
  if (typeof c.text === 'string' && c.text !== '') return c.text;
  if (typeof c.content === 'string' && c.content !== '') return c.content;
  return String(c.node_id != null ? c.node_id : (c.id != null ? c.id : ''));
}

async function loadReranker(model) {
  // eslint-disable-next-line global-require
  const transformers = require('@huggingface/transformers'); // throws if absent
  const { pipeline } = transformers;
  try {
    return await pipeline('text-classification', model);
  } catch (_e) {
    return await pipeline('text-classification', FALLBACK_RERANK_MODEL);
  }
}

async function rerank(query, candidates, opts) {
  const options = opts || {};
  const cands = Array.isArray(candidates) ? candidates : [];

  // Injection seam (offline / test): scores from the caller's rerankFn.
  if (typeof options.rerankFn === 'function') {
    try {
      const scores = options.rerankFn(query, cands);
      if (!Array.isArray(scores) || scores.length !== cands.length) {
        return { results: cands.slice(), warning: 'rerank_unavailable' };
      }
      const scored = cands.map(function (c, i) {
        const merged = Object.assign({}, c);
        merged.rerank_score = scores[i];
        return merged;
      });
      scored.sort(function (a, b) { return b.rerank_score - a.rerank_score; });
      return { results: scored };
    } catch (_e) {
      return { results: cands.slice(), warning: 'rerank_unavailable' };
    }
  }

  // Real model path (lazy load, graceful degradation).
  try {
    const model = (typeof process.env.MINDRIAN_RERANK_MODEL === 'string'
      && process.env.MINDRIAN_RERANK_MODEL.trim() !== '')
      ? process.env.MINDRIAN_RERANK_MODEL.trim()
      : DEFAULT_RERANK_MODEL;
    const reranker = await loadReranker(model);
    const scored = [];
    for (let i = 0; i < cands.length; i += 1) {
      const text = candidateText(cands[i]);
      // transformers.js text-classification cross-encoder: {text, text_pair}.
      const out = await reranker({ text: String(query), text_pair: text });
      const score = Array.isArray(out) && out[0] && typeof out[0].score === 'number'
        ? out[0].score
        : 0;
      const merged = Object.assign({}, cands[i]);
      merged.rerank_score = score;
      scored.push(merged);
    }
    scored.sort(function (a, b) { return b.rerank_score - a.rerank_score; });
    return { results: scored };
  } catch (_e) {
    return { results: cands.slice(), warning: 'rerank_unavailable' };
  }
}

// ---------- Exports ----------

module.exports = {
  rrfFuse: rrfFuse,
  hybridRetrieve: hybridRetrieve,
  rerank: rerank,
  RRF_K: RRF_K,
  _test: {
    resolveRrfK: resolveRrfK,
    candidateText: candidateText,
    DEFAULT_RERANK_MODEL: DEFAULT_RERANK_MODEL,
    FALLBACK_RERANK_MODEL: FALLBACK_RERANK_MODEL,
  },
};
