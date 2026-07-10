/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 215-02 -- tail-quadrant: the weak-signal gem classifier (215-R3).
 *
 * A pure deterministic CLASSIFIER, NOT an engine (215-RESEARCH.md "Net-new"
 * table). It flags the low-attention / high-growth quadrant as a DISTINCT
 * category, mirroring SEED-049's differential logic but over attention/growth
 * axes (SEED-048 line 30). A plain top-N sort actively BURIES the gem (the whole
 * point is the under-watched item), so the tail is a separate flagged list, not
 * a sort tweak. Node built-ins only. No cross-module import (the caller owns all
 * data access). No em-dashes.
 *
 * --------------------------------------------------------------------------
 * SCALE-FREE BY QUANTILE (not absolute cut-offs):
 * --------------------------------------------------------------------------
 * The attention/growth cut-offs are QUANTILES computed over the supplied cohort
 * every run, so the same code is comparable across the 481-subset and the
 * full-2117 cohort (this is what keeps Decision Gate DG-2's two run modes
 * comparable). A stale absolute cut-off would silently misclassify a different
 * cohort; a per-cohort quantile cannot.
 *
 * --------------------------------------------------------------------------
 * HONEST DEGENERACY (215-RESEARCH.md Pitfall 3, the SEED-018 class):
 * --------------------------------------------------------------------------
 * A sparse substrate has no whitespace yet, so a cohort below MIN_COHORT returns
 * insufficient_structure and does NOT classify (never a fabricated list). A
 * cohort where the quadrant swallows more than MAX_TAIL_FRACTION is stamped
 * suspect_noise and the list is STILL returned (report honestly, flag loudly) -
 * a tail that flags hundreds is a noise fountain, never hundreds of gems.
 *
 * --------------------------------------------------------------------------
 * DECISION GATE DG-1 (215-RESEARCH.md Open Q1): the Burt brokerage seam.
 * --------------------------------------------------------------------------
 * The researched recommendation is to COMPOSE the tail flag with Burt
 * structural-hole brokerage: the strongest gem signature is a tech that is
 * under-watched AND a broker across structural holes. The Burt producer is Phase
 * 212.5's whitespace method; this seam CONSUMES it WITHOUT a build dependency -
 * opts.brokerage is an optional Map id -> [0,1]. When present the composition
 * becomes attention-growth-brokerage and the within-tail gem ordering adds the
 * brokerage term; when absent it runs attention/growth-only and SAYS so in the
 * provenance. Nothing here imports 212.5 (it does not exist yet). The navigator
 * reviews the composition at the Plan 05 checkpoint; this forecloses no fork.
 *
 * Interface contract (consumed by Plan 04's runner):
 *   classifyTail(items, opts?) -> { tail, insufficient_structure, suspect_noise,
 *     composition, growth_proxy, thresholds }
 *   items = [{ id, attention, growth }], both axes already in [0,1].
 *   opts  = { attnQ?, growthQ?, minCohort?, maxTailFraction?, brokerage? }.
 */
'use strict';

// Frozen defaults (exposed via the _test seam, house pattern). The low-attention
// quadrant is the bottom quartile of attention; the high-growth quadrant is the
// top quartile of growth. MIN_COHORT and MAX_TAIL_FRACTION are the degeneracy
// guards (Pitfall 3).
const ATTN_Q = 0.25;
const GROWTH_Q = 0.75;
const MIN_COHORT = 30;
const MAX_TAIL_FRACTION = 0.25;

// The growth axis has no measured time series in the JHU catalog, so growth is a
// PROXY (case-number recency). This label is stamped into every result so the
// provenance can never be blank and the proxy is never presented as a measured rate.
const GROWTH_PROXY = 'cnumber-recency';

// ---------- axis validation (fail loud on caller bugs) ----------

// Axes are computed upstream by portfolio-dimensions.percentileRank, so garbage
// in is a CALLER bug, not a degenerate cohort - throw, do not silently coerce.
function assertAxis(item) {
  const bad = function (field, v) {
    throw new Error('TAIL_AXIS_RANGE: item "' + (item && item.id) + '" ' + field +
      ' must be a number in [0,1], got ' + String(v));
  };
  if (!item || typeof item !== 'object') {
    throw new Error('TAIL_AXIS_RANGE: every item must be an object with id/attention/growth');
  }
  if (typeof item.attention !== 'number' || !Number.isFinite(item.attention) ||
      item.attention < 0 || item.attention > 1) bad('attention', item.attention);
  if (typeof item.growth !== 'number' || !Number.isFinite(item.growth) ||
      item.growth < 0 || item.growth > 1) bad('growth', item.growth);
}

// ---------- quantile (linear-interpolated over a sorted axis) ----------

function quantile(sorted, q) {
  const n = sorted.length;
  if (n === 0) return null;
  if (n === 1) return sorted[0];
  const idx = q * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
}

// ---------- the classifier ----------

function classifyTail(items, opts) {
  const o = opts || {};
  const attnQ = typeof o.attnQ === 'number' ? o.attnQ : ATTN_Q;
  const growthQ = typeof o.growthQ === 'number' ? o.growthQ : GROWTH_Q;
  const minCohort = typeof o.minCohort === 'number' ? o.minCohort : MIN_COHORT;
  const maxTailFraction = typeof o.maxTailFraction === 'number' ? o.maxTailFraction : MAX_TAIL_FRACTION;
  const brokerage = (o.brokerage instanceof Map && o.brokerage.size > 0) ? o.brokerage : null;
  const composition = brokerage ? 'attention-growth-brokerage' : 'attention-growth-only';

  const list = Array.isArray(items) ? items : [];

  // Structural precondition: every axis must be a valid [0,1] number (fail loud).
  for (let i = 0; i < list.length; i += 1) assertAxis(list[i]);

  // Guard 1 (Pitfall 3): a sparse substrate has no whitespace yet. Do NOT classify.
  if (list.length < minCohort) {
    return {
      tail: [],
      insufficient_structure: true,
      suspect_noise: false,
      composition: composition,
      growth_proxy: GROWTH_PROXY,
      thresholds: { attnCut: null, growthCut: null },
    };
  }

  // Quantile cut-offs over THIS cohort (scale-free, recomputed every run).
  const attnSorted = list.map(function (x) { return x.attention; }).sort(function (a, b) { return a - b; });
  const growthSorted = list.map(function (x) { return x.growth; }).sort(function (a, b) { return a - b; });
  const attnCut = quantile(attnSorted, attnQ);
  const growthCut = quantile(growthSorted, growthQ);

  // The distinct flagged category: under-watched AND fast-growing.
  const tail = [];
  for (let i = 0; i < list.length; i += 1) {
    const it = list[i];
    if (it.attention <= attnCut && it.growth >= growthCut) {
      const entry = { id: it.id, attention: it.attention, growth: it.growth };
      if (brokerage) entry.brokerage = Number.isFinite(brokerage.get(it.id)) ? brokerage.get(it.id) : 0;
      tail.push(entry);
    }
  }

  // Best-gem-first ordering. Base signal is (growth - attention); the brokerage
  // term is added only when the seam is composed (DG-1), so an under-watched
  // broker outranks an otherwise-identical non-broker.
  tail.sort(function (a, b) {
    const sa = (a.growth - a.attention) + (brokerage ? a.brokerage : 0);
    const sb = (b.growth - b.attention) + (brokerage ? b.brokerage : 0);
    return sb - sa;
  });

  // Guard 2 (Pitfall 3): a quadrant that swallows too much of the cohort is a
  // noise fountain. Keep the list but stamp the warning (honest reporting).
  const suspect_noise = (tail.length / list.length) > maxTailFraction;

  return {
    tail: tail,
    insufficient_structure: false,
    suspect_noise: suspect_noise,
    composition: composition,
    growth_proxy: GROWTH_PROXY,
    thresholds: { attnCut: attnCut, growthCut: growthCut },
  };
}

// ---------- exports ----------

module.exports = {
  classifyTail: classifyTail,
  _test: {
    ATTN_Q: ATTN_Q,
    GROWTH_Q: GROWTH_Q,
    MIN_COHORT: MIN_COHORT,
    MAX_TAIL_FRACTION: MAX_TAIL_FRACTION,
    GROWTH_PROXY: GROWTH_PROXY,
    quantile: quantile,
  },
};
