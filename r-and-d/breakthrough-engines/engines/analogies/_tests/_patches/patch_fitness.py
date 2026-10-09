import sys
p='lib/core/semantic-index/analogy-fitness.cjs'
s=open(p,encoding='utf-8').read()
def rep(old,new,cnt=1):
    global s
    assert s.count(old)==cnt,(old[:60],s.count(old))
    s=s.replace(old,new)

# header doc
rep(""" * Env tunables (RS_SEMANTIC_FLOOR precedent, resolved at CALL time):
 *   MINDRIAN_ANALOGY_LAYER_THRESHOLD   (default 0.5) field-cosine correspond floor
 *   MINDRIAN_ANALOGY_TEXT_WEIGHT       (default 0.5) Leg 1 weight in the fusion
 *   MINDRIAN_ANALOGY_RESTATEMENT_FLOOR (default 0.8) text-cosine restatement trip
""",""" * Env tunables (RS_SEMANTIC_FLOOR precedent, resolved at CALL time):
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
""")

rep("""function resolveLayerThreshold() {
  return resolveFloat('MINDRIAN_ANALOGY_LAYER_THRESHOLD', 0.5);
}""","""function resolveLayerThreshold() {
  return clamp01(resolveFloat('MINDRIAN_ANALOGY_LAYER_THRESHOLD', 0.5));
}""")
rep("""function resolveRestatementFloor() {
  return resolveFloat('MINDRIAN_ANALOGY_RESTATEMENT_FLOOR', 0.8);
}""","""function resolveRestatementFloor() {
  return clamp01(resolveFloat('MINDRIAN_ANALOGY_RESTATEMENT_FLOOR', 0.8));
}

function resolveAbsFloor() {
  return clamp01(resolveFloat('MINDRIAN_ANALOGY_ABS_FLOOR', 0.3));
}""")

# textFitness NaN guard
rep("""  const score = spine.cosineSimilarity(v[0], v[1]);
  return { success: true, score: score, provenance: res.provenance };""","""  const raw = spine.cosineSimilarity(v[0], v[1]);
  // A zero vector (empty text) yields NaN from some cosine implementations: treat it as no similarity.
  const score = Number.isFinite(raw) ? raw : 0;
  return { success: true, score: score, provenance: res.provenance };""")

# structuralFitness refactor
rep("""      const cos = spine.cosineSimilarity(v[2 * i], v[2 * i + 1]);
      layers[active[i]] = cos;""","""      const cos = spine.cosineSimilarity(v[2 * i], v[2 * i + 1]);
      layers[active[i]] = Number.isFinite(cos) ? cos : 0;""")
old_start=s.index("  // A layer corresponds when its cosine clears the threshold.")
old_end=s.index("  return {\n    success: true,\n    score: score,\n    band: band,")
s=s[:old_start]+"""  // opts.layerThresholds (2026): optional per-layer map overriding the fixed threshold.
  const judged = bandFromLayers(layers, options.layerThresholds || threshold);
  const corresponding = judged.corresponding;
  const band = judged.band;
  const score = judged.score;

"""+s[old_end:]

rep("""// ---------- structuralFitness (Leg 2) ----------""","""// ---------- bandFromLayers (pure, 2026) ----------
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

// ---------- structuralFitness (Leg 2) ----------""")

# rankCandidates
old_start=s.index("function rankCandidates(results) {")
old_end=s.index("// ---------- toRefineProposal")
s=s[:old_start]+"""function rankCandidates(results, opts) {
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

"""+s[old_end:]

rep("""  structuralFitness: structuralFitness,
  scoreAnalogyFitness: scoreAnalogyFitness,
  rankCandidates: rankCandidates,""","""  structuralFitness: structuralFitness,
  scoreAnalogyFitness: scoreAnalogyFitness,
  scoreCandidates: scoreCandidates,
  bandFromLayers: bandFromLayers,
  empiricalPercentile: empiricalPercentile,
  quantile: quantile,
  zScore: zScore,
  rankCandidates: rankCandidates,""")
rep("""    resolveRestatementFloor: resolveRestatementFloor,""","""    resolveRestatementFloor: resolveRestatementFloor,
    resolveAbsFloor: resolveAbsFloor,""")
open(p,'w',encoding='utf-8').write(s)
print('ok')
