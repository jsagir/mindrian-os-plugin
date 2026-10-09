/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 214-01 -- analogy-fitness: the two-leg measured fitness fusion.
 *
 * find-analogies used to narrate its fitness as a decorative decimal an LLM
 * picked. This module MEASURES it instead, on the ONE substrate the whole 211
 * cluster already stands on (the shipped local embedding spine). It never loads
 * a second encoder, never opens a second vector path, never names a model.
 *
 * TWO LEGS:
 *   Leg 1 (textFitness): a cosine over the two candidate texts, embedded
 *     through the spine. The "how alike do they read" leg.
 *   Leg 2 (structuralFitness): the SAPPhIRE layer-match rubric
 *     (references/methodology/sapphire-encoding.md, the fitness table). Each of
 *     the 7 SAPPhIRE fields is embedded and cosine-compared field-to-field; a
 *     field "corresponds" when both sides are non-empty AND the cosine clears
 *     the layer threshold. The set of corresponding fields lands the pair in a
 *     band (none / surface / behavioral / structural / deep) and the score sits
 *     inside that band's range.
 *
 * THE RESTATEMENT GATE (214-B, the archimedes-darkmatter trap): a paraphrase
 * reads almost identically (high Leg 1) yet shares no structure (low Leg 2). If
 * fitness were text-only, a restatement would masquerade as a breakthrough.
 * rankCandidates orders BAND FIRST, so a surface/behavioral paraphrase can never
 * outrank a structural/deep transfer no matter how high its text cosine climbs.
 * The structural leg GATES the rank. restatementFlag surfaces the trap by name.
 *
 * --------------------------------------------------------------------------
 * CANON PART 8 (Graph Boundary): every embedding runs locally through the
 * shipped spine; nothing in this module egresses a byte. It composes NO strings
 * for a wire (that is online-pattern-query.cjs's job in 214-02). All compute is
 * local and deterministic.
 * CANON PART 9 (Memory Locality): this module NEVER touches a database. Scored
 * analogies become graph-refine-loop proposals (toRefineProposal); the write-back
 * rides that chokepoint, never a direct edge write here.
 * CANON DECISION #8 (graceful degradation): when the spine reports the encoder
 * unavailable, every entry point degrades to a qualitative-only envelope with
 * ZERO numeric fields. It NEVER fabricates a score.
 * --------------------------------------------------------------------------
 *
 * Env tunables (RS_SEMANTIC_FLOOR precedent, resolved at CALL time):
 *   MINDRIAN_ANALOGY_LAYER_THRESHOLD   (default 0.5) field-cosine correspond floor
 *   MINDRIAN_ANALOGY_TEXT_WEIGHT       (default 0.5) Leg 1 weight in the fusion
 *   MINDRIAN_ANALOGY_RESTATEMENT_FLOOR (default 0.8) text-cosine restatement trip
 *   MINDRIAN_ANALOGY_ABS_FLOOR         (default 0.3) 2026: lowest layer threshold the
 *                                      corpus-relative mode may derive
 *
 * 2026 ADDITION (corpus-relative scoring). The fixed 0.5 layer threshold and the fixed
 * 0.8 restatement floor are encoder-specific: a different embedding model shifts every
 * cosine. scoreCandidates() therefore derives, per SAPPhIRE layer, the correspondence
 * threshold from the candidate corpus itself (an empirical quantile of that layer's
 * cosines, clamped to [abs floor, 0.9]) and trips the restatement flag on the batch
 * percentile of the text cosine. With fewer than minCorpus candidates (default 5) a
 * percentile is meaningless, so it falls back to the fixed thresholds. The legacy
 * single-pair path (scoreAnalogyFitness) and the legacy ranking order are untouched
 * and reachable through opts.thresholdMode === 'fixed' / opts.legacy === true.
 *
 * Pure CJS. Never throws across a boundary.
 */
'use strict';

const spine = require('./embedding-spine.cjs');

// The 7 SAPPhIRE layers in frozen rubric order. Leg 2 compares field to field.
const SAPPHIRE_LAYERS = Object.freeze([
  'state_change', 'action', 'parts', 'phenomenon', 'input', 'real_effect', 'effect',
]);

// The fitness band ranges, transcribed from the sapphire-encoding rubric table.
// none is the "state_change does not correspond" floor (score 0.0).
const BANDS = Object.freeze({
  none: Object.freeze([0, 0]),
  surface: Object.freeze([0.1, 0.2]),
  behavioral: Object.freeze([0.3, 0.5]),
  structural: Object.freeze([0.6, 0.8]),
  deep: Object.freeze([0.8, 1.0]),
});

// Band ordering for the restatement gate: a higher-band candidate always ranks
// ahead of a lower-band one regardless of text cosine.
const BAND_RANK = Object.freeze({
  none: 0, surface: 1, behavioral: 2, structural: 3, deep: 4,
});

// The field sets that define each band (state_change is the anchor: if it does
// not correspond the pair is 'none').
const STRUCTURAL_SET = ['state_change', 'action', 'phenomenon', 'real_effect'];
const BEHAVIORAL_SET = ['state_change', 'action', 'phenomenon'];

// ---------- Env resolution (read at CALL time, not frozen at load) ----------

function resolveFloat(name, fallback) {
  const raw = process.env[name];
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw.trim());
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function resolveLayerThreshold() {
  return clamp01(resolveFloat('MINDRIAN_ANALOGY_LAYER_THRESHOLD', 0.5));
}

function resolveTextWeight() {
  const w = resolveFloat('MINDRIAN_ANALOGY_TEXT_WEIGHT', 0.5);
  return clamp01(w);
}

function resolveRestatementFloor() {
  return clamp01(resolveFloat('MINDRIAN_ANALOGY_RESTATEMENT_FLOOR', 0.8));
}

function resolveAbsFloor() {
  return clamp01(resolveFloat('MINDRIAN_ANALOGY_ABS_FLOOR', 0.3));
}

// ---------- helpers ----------

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function isNonEmptyString(s) {
  return typeof s === 'string' && s.trim() !== '';
}

function mean(nums) {
  if (!nums.length) return 0;
  let sum = 0;
  for (let i = 0; i < nums.length; i += 1) sum += nums[i];
  return sum / nums.length;
}

// ---------- textFitness (Leg 1) ----------
//
// Embeds the two texts through the spine in ONE batched call, returns the cosine.
// On encoder unavailability degrades to qualitative-only (never a number).

async function textFitness(sourceText, candText, opts) {
  const options = opts || {};
  const res = await spine.embedTexts([String(sourceText || ''), String(candText || '')], options);
  if (!res.success) {
    return { success: false, degrade: 'qualitative-only', reason: 'encoder_unavailable' };
  }
  const v = res.vectors;
  const raw = spine.cosineSimilarity(v[0], v[1]);
  // A zero vector (empty text) yields NaN from some cosine implementations: treat it as no similarity.
  const score = Number.isFinite(raw) ? raw : 0;
  return { success: true, score: score, provenance: res.provenance };
}

// ---------- bandFromLayers (pure, 2026) ----------
//
// The banding rule extracted from structuralFitness so the corpus-relative path can
// re-band the SAME layer cosines under derived thresholds without a second encoder call.
// thresholds: a number (one threshold for all layers) or {layer: number}.

function thresholdFor(thresholds, layer, fallback) {
  if (typeof thresholds === 'number') return thresholds;
  if (thresholds && typeof thresholds[layer] === 'number') return thresholds[layer];
  return fallback;
}

function bandFromLayers(layers, thresholds) {
  const fallback = resolveLayerThreshold();
  const corresponding = [];
  for (let i = 0; i < SAPPHIRE_LAYERS.length; i += 1) {
    const layer = SAPPHIRE_LAYERS[i];
    const cos = layers ? layers[layer] : null;
    if (typeof cos === 'number' && cos >= thresholdFor(thresholds, layer, fallback)) corresponding.push(layer);
  }
  const has = function has(l) { return corresponding.indexOf(l) !== -1; };
  const hasAll = function hasAll(set) { return set.every(has); };
  let band = 'none';
  if (has('state_change')) {
    if (SAPPHIRE_LAYERS.every(has)) band = 'deep';
    else if (hasAll(STRUCTURAL_SET)) band = 'structural';
    else if (hasAll(BEHAVIORAL_SET)) band = 'behavioral';
    else band = 'surface';
  }
  let score = 0;
  if (band !== 'none') {
    const corrCosines = corresponding.map(function (l) { return layers[l]; });
    const range = BANDS[band];
    score = range[0] + (range[1] - range[0]) * clamp01(mean(corrCosines));
  }
  return { band: band, score: score, corresponding: corresponding };
}

// ---------- corpus statistics (pure, deterministic, 2026) ----------

// Empirical percentile in [0,1] with mid-rank tie handling; empty corpus -> 0.
function empiricalPercentile(values, x) {
  const v = (Array.isArray(values) ? values : []).filter(Number.isFinite);
  if (!v.length || !Number.isFinite(x)) return 0;
  let less = 0; let equal = 0;
  for (let i = 0; i < v.length; i += 1) {
    if (v[i] < x) less += 1; else if (v[i] === x) equal += 1;
  }
  return (less + 0.5 * equal) / v.length;
}

// Linear-interpolated quantile q in [0,1]; empty corpus -> NaN (caller must guard).
function quantile(values, q) {
  const v = (Array.isArray(values) ? values : []).filter(Number.isFinite).sort(function (a, b) { return a - b; });
  if (!v.length) return NaN;
  const qq = Math.min(1, Math.max(0, q));
  const pos = (v.length - 1) * qq;
  const lo = Math.floor(pos); const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

// z-score against the corpus (population std); zero variance or empty corpus -> 0, never NaN.
function zScore(values, x) {
  const v = (Array.isArray(values) ? values : []).filter(Number.isFinite);
  if (v.length < 2 || !Number.isFinite(x)) return 0;
  const m = mean(v);
  let ss = 0;
  for (let i = 0; i < v.length; i += 1) ss += (v[i] - m) * (v[i] - m);
  const sd = Math.sqrt(ss / v.length);
  return sd > 0 ? (x - m) / sd : 0;
}

// ---------- structuralFitness (Leg 2) ----------
//
// Field-to-field cosine over the 7 SAPPhIRE layers, batched through ONE spine
// call per pair (14 field texts max). A layer corresponds when both fields are
// non-empty strings AND their cosine clears the layer threshold. The set of
// corresponding layers lands the band; the score sits inside the band range,
// scaled by the mean cosine of the corresponding layers.

async function structuralFitness(sourceEnc, candEnc, opts) {
  const options = opts || {};
  const src = sourceEnc || {};
  const cnd = candEnc || {};
  const threshold = resolveLayerThreshold();

  // Collect the layers where BOTH sides carry text; only these get embedded.
  const active = [];
  const texts = [];
  for (let i = 0; i < SAPPHIRE_LAYERS.length; i += 1) {
    const layer = SAPPHIRE_LAYERS[i];
    if (isNonEmptyString(src[layer]) && isNonEmptyString(cnd[layer])) {
      active.push(layer);
      texts.push(String(src[layer]).trim());
      texts.push(String(cnd[layer]).trim());
    }
  }

  const layers = {};
  for (let i = 0; i < SAPPHIRE_LAYERS.length; i += 1) layers[SAPPHIRE_LAYERS[i]] = null;

  // Nothing to embed (all fields empty on at least one side): no encoder call is
  // needed. The pair simply has no correspondence -> band none, score 0.
  if (active.length > 0) {
    const res = await spine.embedTexts(texts, options);
    if (!res.success) {
      return { success: false, degrade: 'qualitative-only', reason: 'encoder_unavailable' };
    }
    const v = res.vectors;
    for (let i = 0; i < active.length; i += 1) {
      const cos = spine.cosineSimilarity(v[2 * i], v[2 * i + 1]);
      layers[active[i]] = Number.isFinite(cos) ? cos : 0;
    }
  }

  // opts.layerThresholds (2026): optional per-layer map overriding the fixed threshold.
  const judged = bandFromLayers(layers, options.layerThresholds || threshold);
  const corresponding = judged.corresponding;
  const band = judged.band;
  const score = judged.score;

  return {
    success: true,
    score: score,
    band: band,
    layers: layers,
    corresponding: corresponding,
  };
}

// ---------- scoreAnalogyFitness (the fusion) ----------
//
// source / candidate = { text:string, sapphire:{state_change,...} }.
// Runs both legs; if either degrades the whole call degrades to qualitative-only
// with NO numeric fields (the never-fabricate rule). Otherwise fuses the two
// scores and flags a restatement when text reads alike but structure is thin.

async function scoreAnalogyFitness(source, candidate, opts) {
  const options = opts || {};
  const s = source || {};
  const c = candidate || {};

  const text = await textFitness(s.text, c.text, options);
  if (!text.success) {
    return { success: false, degrade: 'qualitative-only', reason: text.reason || 'encoder_unavailable' };
  }

  const structural = await structuralFitness(s.sapphire, c.sapphire, options);
  if (!structural.success) {
    return { success: false, degrade: 'qualitative-only', reason: structural.reason || 'encoder_unavailable' };
  }

  const textWeight = resolveTextWeight();
  const fused = textWeight * text.score + (1 - textWeight) * structural.score;

  const restatementFloor = resolveRestatementFloor();
  const thinBand = (structural.band === 'none' || structural.band === 'surface' || structural.band === 'behavioral');
  const restatementFlag = (text.score >= restatementFloor) && thinBand;

  const criticFeatures = {
    textCosine: text.score,
    structuralScore: structural.score,
    band: structural.band,
    restatementFlag: restatementFlag,
    layerCosines: structural.layers,
  };

  return {
    success: true,
    text: { score: text.score },
    structural: {
      score: structural.score,
      band: structural.band,
      layers: structural.layers,
      corresponding: structural.corresponding,
    },
    fused: fused,
    restatementFlag: restatementFlag,
    provenance: text.provenance,
    criticFeatures: criticFeatures,
  };
}

// ---------- rankCandidates (the restatement gate as an ordering) ----------
//
// Band rank DESC first, then fused DESC. Band-first IS the gate: a high-text
// paraphrase (surface band) can never outrank a structural/deep transfer.

function rankCandidates(results, opts) {
  const options = opts || {};
  const list = Array.isArray(results) ? results.slice() : [];
  const bandOf = function bandOf(r) {
    const b = r && r.structural ? BAND_RANK[r.structural.band] : -1;
    return typeof b === 'number' ? b : -1;
  };
  list.sort(function (a, b) {
    const ba = bandOf(a);
    const bb = bandOf(b);
    if (bb !== ba) return bb - ba;
    const fa = (a && typeof a.fused === 'number') ? a.fused : -1;
    const fb = (b && typeof b.fused === 'number') ? b.fused : -1;
    if (fb !== fa) return fb - fa;
    // 2026: deterministic final tie-break on candidate id (legacy relied on input order only).
    const ia = String(a && a._id != null ? a._id : '');
    const ib = String(b && b._id != null ? b._id : '');
    return ia < ib ? -1 : (ia > ib ? 1 : 0);
  });
  // 2026: the command documents "a restatement can never sit at Rank 1". Band-first ordering
  // alone does not guarantee that when every candidate is thin-banded, so lift the best
  // non-restatement above a flagged leader. opts.legacy === true keeps the 2025 order.
  if (options.legacy !== true && list.length > 1 && list[0] && list[0].restatementFlag === true) {
    const idx = list.findIndex(function (r) { return r && r.success !== false && r.restatementFlag !== true; });
    if (idx > 0) {
      const lifted = list.splice(idx, 1)[0];
      list.unshift(lifted);
    }
  }
  return list;
}

// ---------- scoreCandidates (2026: corpus-relative batch scoring) ----------
//
// Scores every candidate against the source with the unchanged two-leg engine, then
// re-bands the SAME layer cosines under thresholds derived from the candidate corpus
// (thresholdMode 'percentile', the default). thresholdMode 'fixed' returns exactly the
// legacy scoreAnalogyFitness results, annotated. No extra encoder calls are made.
//
// opts: thresholdMode ('percentile'|'fixed'), minCorpus (5), layerQuantile (0.75),
//       restatementPercentile (0.9), restatementMinText (0.5), plus encoder opts
//       (e.g. encodeFn) passed through to the spine.
// Returns { success, mode, n, results, scoring } or { success:false, degrade, reason }.
// Each result carries percentile {fused,text}, z {fused,text} and scoring provenance.

async function scoreCandidates(source, candidates, opts) {
  const options = opts || {};
  const list = Array.isArray(candidates) ? candidates : [];
  const requested = options.thresholdMode === 'fixed' ? 'fixed' : 'percentile';
  const minCorpus = Number.isFinite(options.minCorpus) ? options.minCorpus : 5;
  const q = Number.isFinite(options.layerQuantile) ? Math.min(1, Math.max(0, options.layerQuantile)) : 0.75;
  const restPct = Number.isFinite(options.restatementPercentile) ? options.restatementPercentile : 0.9;
  const restMinText = Number.isFinite(options.restatementMinText) ? options.restatementMinText : 0.5;
  const absFloor = resolveAbsFloor();

  const base = [];
  for (let i = 0; i < list.length; i += 1) {
    const cand = list[i] || {};
    let r;
    try {
      // eslint-disable-next-line no-await-in-loop
      r = await scoreAnalogyFitness(source, cand, options);
    } catch (err) {
      r = { success: false, _rowError: String(err && err.message ? err.message : err) };
    }
    r._id = cand.id;
    base.push(r);
  }
  const degraded = base.find(function (r) { return r && r.success === false && r.degrade === 'qualitative-only'; });
  if (degraded) return { success: false, degrade: 'qualitative-only', reason: degraded.reason || 'encoder_unavailable' };

  const ok = base.filter(function (r) { return r && r.success === true; });
  const mode = (requested === 'percentile' && ok.length >= minCorpus) ? 'percentile' : 'fixed';
  const fixedThreshold = resolveLayerThreshold();

  const layerThresholds = {};
  for (let i = 0; i < SAPPHIRE_LAYERS.length; i += 1) {
    const layer = SAPPHIRE_LAYERS[i];
    let th = fixedThreshold;
    if (mode === 'percentile') {
      const cosines = ok.map(function (r) { return r.structural.layers[layer]; }).filter(function (x) { return typeof x === 'number'; });
      const qv = quantile(cosines, q);
      // too few usable cosines for this layer: keep the fixed threshold
      th = (cosines.length >= minCorpus && Number.isFinite(qv)) ? Math.min(0.9, Math.max(absFloor, qv)) : fixedThreshold;
    }
    layerThresholds[layer] = th;
  }

  const textWeight = resolveTextWeight();
  const restatementFloor = resolveRestatementFloor();
  const out = base.map(function (r) {
    if (!r || r.success !== true) return r;
    const judged = bandFromLayers(r.structural.layers, layerThresholds);
    const fused = textWeight * r.text.score + (1 - textWeight) * judged.score;
    return Object.assign({}, r, {
      structural: Object.assign({}, r.structural, { score: judged.score, band: judged.band, corresponding: judged.corresponding }),
      fused: fused,
      legacy: { band: r.structural.band, fused: r.fused, restatementFlag: r.restatementFlag },
    });
  });

  const okOut = out.filter(function (r) { return r && r.success === true; });
  const fusedVals = okOut.map(function (r) { return r.fused; });
  const textVals = okOut.map(function (r) { return r.text.score; });
  const computedAt = new Date().toISOString();
  okOut.forEach(function (r) {
    const thin = (r.structural.band === 'none' || r.structural.band === 'surface' || r.structural.band === 'behavioral');
    const textPct = empiricalPercentile(textVals, r.text.score);
    r.percentile = { fused: empiricalPercentile(fusedVals, r.fused), text: textPct };
    r.z = { fused: zScore(fusedVals, r.fused), text: zScore(textVals, r.text.score) };
    r.restatementFlag = mode === 'percentile'
      ? (thin && textPct >= restPct && r.text.score >= restMinText)
      : (r.text.score >= restatementFloor && thin);
    r.criticFeatures = Object.assign({}, r.criticFeatures, {
      structuralScore: r.structural.score, band: r.structural.band, restatementFlag: r.restatementFlag,
    });
    r.scoring = { mode: mode, n: okOut.length, computed_at: computedAt };
  });

  return {
    success: true,
    mode: mode,
    requested_mode: requested,
    n: okOut.length,
    results: out,
    scoring: {
      mode: mode,
      layer_thresholds: layerThresholds,
      params: { minCorpus: minCorpus, layerQuantile: q, restatementPercentile: restPct, restatementMinText: restMinText,
        absFloor: absFloor, fixedLayerThreshold: fixedThreshold, restatementFloor: restatementFloor, textWeight: textWeight },
      computed_at: computedAt,
      note: mode === 'fixed' && requested === 'percentile' ? 'corpus smaller than minCorpus; fixed thresholds used' : null,
    },
  };
}

// ---------- toRefineProposal (214-E write-back forward-compat) ----------
//
// Turns a scored result into a plain proposal object graph-refine-loop's
// proposalKey() accepts. valid_at rides meta.sourceDate for the date-sync gate.

function toRefineProposal(result, meta) {
  const m = meta || {};
  const r = result || {};
  return {
    kind: 'analogy_transfer',
    statement: m.statement,
    valid_at: m.sourceDate || null,
    provenance: r.provenance || null,
    features: r.criticFeatures || null,
    refs: Array.isArray(m.refs) ? m.refs : [],
  };
}

// ---------- Exports ----------

module.exports = {
  SAPPHIRE_LAYERS: SAPPHIRE_LAYERS,
  BANDS: BANDS,
  textFitness: textFitness,
  structuralFitness: structuralFitness,
  scoreAnalogyFitness: scoreAnalogyFitness,
  scoreCandidates: scoreCandidates,
  bandFromLayers: bandFromLayers,
  empiricalPercentile: empiricalPercentile,
  quantile: quantile,
  zScore: zScore,
  rankCandidates: rankCandidates,
  toRefineProposal: toRefineProposal,
  _test: {
    BAND_RANK: BAND_RANK,
    STRUCTURAL_SET: STRUCTURAL_SET,
    BEHAVIORAL_SET: BEHAVIORAL_SET,
    resolveLayerThreshold: resolveLayerThreshold,
    resolveTextWeight: resolveTextWeight,
    resolveRestatementFloor: resolveRestatementFloor,
    resolveAbsFloor: resolveAbsFloor,
    clamp01: clamp01,
    mean: mean,
    isNonEmptyString: isNonEmptyString,
  },
};
