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
  return resolveFloat('MINDRIAN_ANALOGY_LAYER_THRESHOLD', 0.5);
}

function resolveTextWeight() {
  const w = resolveFloat('MINDRIAN_ANALOGY_TEXT_WEIGHT', 0.5);
  return clamp01(w);
}

function resolveRestatementFloor() {
  return resolveFloat('MINDRIAN_ANALOGY_RESTATEMENT_FLOOR', 0.8);
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
  const score = spine.cosineSimilarity(v[0], v[1]);
  return { success: true, score: score, provenance: res.provenance };
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
      layers[active[i]] = cos;
    }
  }

  // A layer corresponds when its cosine clears the threshold.
  const corresponding = [];
  for (let i = 0; i < SAPPHIRE_LAYERS.length; i += 1) {
    const layer = SAPPHIRE_LAYERS[i];
    const cos = layers[layer];
    if (typeof cos === 'number' && cos >= threshold) corresponding.push(layer);
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

function rankCandidates(results) {
  const list = Array.isArray(results) ? results.slice() : [];
  list.sort(function (a, b) {
    const ba = a && a.structural ? BAND_RANK[a.structural.band] : -1;
    const bb = b && b.structural ? BAND_RANK[b.structural.band] : -1;
    if (bb !== ba) return bb - ba;
    const fa = (a && typeof a.fused === 'number') ? a.fused : -1;
    const fb = (b && typeof b.fused === 'number') ? b.fused : -1;
    return fb - fa;
  });
  return list;
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
  rankCandidates: rankCandidates,
  toRefineProposal: toRefineProposal,
  _test: {
    BAND_RANK: BAND_RANK,
    STRUCTURAL_SET: STRUCTURAL_SET,
    BEHAVIORAL_SET: BEHAVIORAL_SET,
    resolveLayerThreshold: resolveLayerThreshold,
    resolveTextWeight: resolveTextWeight,
    resolveRestatementFloor: resolveRestatementFloor,
    clamp01: clamp01,
    mean: mean,
    isNonEmptyString: isNonEmptyString,
  },
};
