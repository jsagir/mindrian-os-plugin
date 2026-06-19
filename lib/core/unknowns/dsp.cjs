'use strict';
// ========================================
// MINDRIAN DESCRIPTIVE-SPACE PARTITIONING (DSP, Algorithm 1) (Phase 165 Wave 2 port)
// Greedy set-cover partition of the confident-claim corpus by the goodness
// function -- PLUS the REAL inter-partition distance the reference stubs.
//
// Ported from reference/unknown-unknowns-horvitz/README.md (Algorithm 1, Eq.2,
// AAAI 2017 Lakkaraju/Kamar/Caruana/Horvitz). The MATH ports verbatim; the ONE
// load-bearing change (Phase 165 port change #4, 165-RESEARCH section 1.4, the
// discretion deliverable) is that interPartitionFeatureDistance and
// interPartitionConfidenceDistance compute the REAL distance against sibling
// centroids instead of the reference stub `return 1.0`. The stub made the goodness
// function blind to inter-partition separation (DSP degenerated to set-cover by
// size); the real metric makes well-separated high-confidence regions score
// higher, which is exactly where over-confidence (blind spots) concentrates.
//
// partition(instances, confidenceScores, patterns) -> [{pattern, instances,
//   centroid, meanConfidence}] via greedy set-cover maximizing
//   coveredUncovered.size / goodness until the instance space is covered.
//
// Mirrors the lib/core/issue-tree.cjs purity doctrine: PURE, single-call,
// deterministic. ZERO Math.random, ZERO Date.now, ZERO I/O, ZERO Brain require
// (Canon Part 8 / D-165-10; claim features never egress). Siblings iterate in
// stable id-sorted order so floating-point summation order is fixed and a re-run
// is byte-identical (D-165-09). NO em-dashes (CLAUDE.md HARD RULE); CJS; no deps.
//
// Sources: 165-RESEARCH.md section 1.1 (DSP contract), 1.2 (Eq.2 goodness), 1.4
// (the REAL interPartitionDistance spec), the shared iface (INSTANCE_FEATURES,
// TIER_NUMERIC, DEFAULT_CONFIG.dspWeights).
// ========================================

const crypto = require('crypto');
const { INSTANCE_FEATURES, TIER_NUMERIC, DEFAULT_CONFIG } = require('./iface.cjs');
const { conditionsMatch, numericValueOf } = require('./pattern-miner.cjs');

// The NUMERIC and CATEGORICAL feature dimensions that participate in the centroid
// + distance math (claimId / governingHash are identity handles, excluded).
const NUMERIC_DIMS = Object.freeze(
  INSTANCE_FEATURES.filter((f) => f.kind === 'NUMERIC').map((f) => f.name)
);
const CATEGORICAL_DIMS = Object.freeze(
  INSTANCE_FEATURES.filter((f) => f.kind === 'CATEGORICAL').map((f) => f.name)
);

// A stable partition id = sha256 over the pattern's sorted condition keys, so a
// re-run mints the same id and sibling iteration order is deterministic.
function partitionId(pattern) {
  const conds = (pattern && Array.isArray(pattern.conditions)) ? pattern.conditions : [];
  const key = conds
    .map((c) => c.feature + c.operator + String(c.value))
    .slice()
    .sort()
    .join('&');
  return crypto.createHash('sha256').update('dsp|' + key).digest('hex').slice(0, 16);
}

// corpusRanges: per-NUMERIC-feature (max - min) over the WHOLE corpus, computed
// ONCE so the inter-partition feature distance is scale-free and deterministic
// (165-RESEARCH section 1.4). A zero range yields a 0 distance for that dim.
function computeCorpusRanges(instances) {
  const ranges = {};
  for (const feat of NUMERIC_DIMS) {
    let min = Infinity;
    let max = -Infinity;
    for (const inst of instances) {
      const v = numericValueOf(feat, inst[feat]);
      if (v === null) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    ranges[feat] = (min === Infinity || max === -Infinity) ? 0 : (max - min);
  }
  return ranges;
}

// Centroid of a partition's instances: the per-NUMERIC-feature mean (over the
// ordinal numeric value) plus the per-CATEGORICAL-feature plurality (the modal
// enum handle, ties broken by ascending sort so it is deterministic).
function computeCentroid(instances) {
  const centroid = {};
  for (const feat of NUMERIC_DIMS) {
    let sum = 0;
    let n = 0;
    for (const inst of instances) {
      const v = numericValueOf(feat, inst[feat]);
      if (v === null) continue;
      sum += v;
      n++;
    }
    centroid[feat] = n > 0 ? (sum / n) : 0;
  }
  for (const feat of CATEGORICAL_DIMS) {
    const counts = new Map();
    for (const inst of instances) {
      const v = inst[feat];
      if (v === undefined || v === null) continue;
      const k = String(v);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    let best = null;
    let bestCount = -1;
    for (const k of Array.from(counts.keys()).sort()) {
      const c = counts.get(k);
      if (c > bestCount) {
        bestCount = c;
        best = k;
      }
    }
    centroid[feat] = best;
  }
  return centroid;
}

function meanConfidenceOf(instances, confByClaimId) {
  if (instances.length === 0) return 0;
  let sum = 0;
  let n = 0;
  for (const inst of instances) {
    let c = (confByClaimId && Object.prototype.hasOwnProperty.call(confByClaimId, inst.claimId))
      ? confByClaimId[inst.claimId]
      : inst.confidence;
    c = Number(c);
    if (!Number.isFinite(c)) continue;
    sum += c;
    n++;
  }
  return n > 0 ? (sum / n) : 0;
}

// ---------------------------------------------------------------------------
// THE REAL inter-partition distances (165-RESEARCH section 1.4) -- replaces the
// reference stub `return 1.0`. Both are PURE over the partition set.
// ---------------------------------------------------------------------------

// Per-feature centroid distance between two partitions:
//   NUMERIC    -> normalized |a-b| / corpusRange (range 0 yields 0)
//   CATEGORICAL-> Hamming mismatch (0 if equal, 1 if different)
// aggregated as the unweighted mean across the feature dimensions. Returns [0,1].
function centroidPairDistance(ci, cj, corpusRanges) {
  let sum = 0;
  let dims = 0;
  for (const feat of NUMERIC_DIMS) {
    const range = corpusRanges[feat];
    const a = Number(ci[feat]);
    const b = Number(cj[feat]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) { dims++; continue; }
    const d = (range && range > 0) ? Math.abs(a - b) / range : 0;
    sum += d > 1 ? 1 : d;
    dims++;
  }
  for (const feat of CATEGORICAL_DIMS) {
    const a = ci[feat];
    const b = cj[feat];
    sum += (String(a) === String(b)) ? 0 : 1;
    dims++;
  }
  return dims > 0 ? (sum / dims) : 0;
}

/**
 * interPartitionFeatureDistance(P_i, partitions, corpusRanges) -> [0,1]
 * The mean centroid distance from P_i to every sibling P_j (j != i). A LONE
 * partition (no siblings) returns 0.0 -- the correct edge value, NOT the stub 1.0
 * (the stub-leak regression guard, Pitfall 2). Siblings iterate in stable
 * id-sorted order so the FP summation order is fixed (D-165-09).
 */
function interPartitionFeatureDistance(P_i, partitions, corpusRanges) {
  const all = Array.isArray(partitions) ? partitions : [];
  const ranges = corpusRanges || computeCorpusRanges(
    all.reduce((acc, p) => acc.concat(p.instances || []), [])
  );
  const myId = P_i.id || partitionId(P_i.pattern);
  const siblings = all
    .filter((p) => (p.id || partitionId(p.pattern)) !== myId)
    .slice()
    .sort((a, b) => (a.id || partitionId(a.pattern)).localeCompare(b.id || partitionId(b.pattern)));
  if (siblings.length === 0) return 0.0;
  let sum = 0;
  for (const sib of siblings) {
    sum += centroidPairDistance(P_i.centroid, sib.centroid, ranges);
  }
  return sum / siblings.length;
}

/**
 * interPartitionConfidenceDistance(P_i, partitions) -> [0,1]
 * The mean |P_i.meanConfidence - P_j.meanConfidence| across siblings j != i.
 * Confidence already lives in [0,1] so no normalization is needed. A LONE
 * partition returns 0.0 (NOT the stub 1.0). Stable id-sorted sibling iteration.
 */
function interPartitionConfidenceDistance(P_i, partitions) {
  const all = Array.isArray(partitions) ? partitions : [];
  const myId = P_i.id || partitionId(P_i.pattern);
  const siblings = all
    .filter((p) => (p.id || partitionId(p.pattern)) !== myId)
    .slice()
    .sort((a, b) => (a.id || partitionId(a.pattern)).localeCompare(b.id || partitionId(b.pattern)));
  if (siblings.length === 0) return 0.0;
  const mc = Number(P_i.meanConfidence) || 0;
  let sum = 0;
  for (const sib of siblings) {
    sum += Math.abs(mc - (Number(sib.meanConfidence) || 0));
  }
  return sum / siblings.length;
}

// Intra-partition FEATURE distance (g1): mean centroid distance from each member
// to the partition centroid. Deterministic; pure.
function intraFeatureDistance(P, corpusRanges) {
  const insts = P.instances || [];
  if (insts.length === 0) return 0;
  const ranges = corpusRanges || computeCorpusRanges(insts);
  let sum = 0;
  for (const inst of insts) {
    const point = {};
    for (const feat of NUMERIC_DIMS) point[feat] = numericValueOf(feat, inst[feat]);
    for (const feat of CATEGORICAL_DIMS) point[feat] = inst[feat];
    sum += centroidPairDistance(point, P.centroid, ranges);
  }
  return sum / insts.length;
}

// Intra-partition CONFIDENCE distance (g3): mean |conf_member - meanConfidence|.
function intraConfidenceDistance(P, confByClaimId) {
  const insts = P.instances || [];
  if (insts.length === 0) return 0;
  const mc = Number(P.meanConfidence) || 0;
  let sum = 0;
  let n = 0;
  for (const inst of insts) {
    let c = (confByClaimId && Object.prototype.hasOwnProperty.call(confByClaimId, inst.claimId))
      ? confByClaimId[inst.claimId]
      : inst.confidence;
    c = Number(c);
    if (!Number.isFinite(c)) continue;
    sum += Math.abs(c - mc);
    n++;
  }
  return n > 0 ? (sum / n) : 0;
}

/**
 * goodness(P, partitions, corpusRanges, weights, confByClaimId) -> number (Eq.2)
 *   lambda1*g1 - lambda2*g2 + lambda3*g3 - lambda4*g4 + lambda5*g5
 * with the REAL g2 (interPartitionFeatureDistance) and g4
 * (interPartitionConfidenceDistance) wired in, so the same partition set scored
 * with the real distance differs from the stubbed score (Pitfall 2).
 */
function goodness(P, partitions, corpusRanges, weights, confByClaimId) {
  const w = weights || DEFAULT_CONFIG.dspWeights;
  const g1 = intraFeatureDistance(P, corpusRanges);
  const g2 = interPartitionFeatureDistance(P, partitions, corpusRanges);
  const g3 = intraConfidenceDistance(P, confByClaimId);
  const g4 = interPartitionConfidenceDistance(P, partitions);
  const g5 = (P.pattern && Array.isArray(P.pattern.conditions)) ? P.pattern.conditions.length : 0;
  return w.l1 * g1 - w.l2 * g2 + w.l3 * g3 - w.l4 * g4 + w.l5 * g5;
}

// Build a candidate partition object for a pattern over the instances it covers.
function makePartition(pattern, instances, confByClaimId) {
  const covered = instances.filter((inst) => conditionsMatch(pattern.conditions, inst));
  return {
    id: partitionId(pattern),
    pattern,
    instances: covered,
    centroid: computeCentroid(covered),
    meanConfidence: meanConfidenceOf(covered, confByClaimId),
  };
}

/**
 * partition(instances, confidenceScores, patterns, opts?) -> [{pattern, instances,
 *   centroid, meanConfidence}]
 *
 * DSP Algorithm 1 greedy set-cover: repeatedly pick the pattern that maximizes
 * coveredUncovered.size / goodness over the still-uncovered instances, attach the
 * instances it newly covers, until the instance space is covered (or no pattern
 * adds coverage). Deterministic: ties broken by ascending partition id; no
 * Math.random; no Date.now (D-165-09). confidenceScores is an optional map of
 * claimId -> confidence (falls back to inst.confidence).
 */
function partition(instances, confidenceScores, patterns, opts) {
  const list = Array.isArray(instances) ? instances : [];
  const pats = Array.isArray(patterns) ? patterns : [];
  const cfg = Object.assign({}, opts || {});
  const weights = cfg.dspWeights || DEFAULT_CONFIG.dspWeights;
  const confByClaimId = confidenceScores || {};
  if (list.length === 0 || pats.length === 0) return [];

  const corpusRanges = computeCorpusRanges(list);

  // Pre-build every candidate partition over the FULL corpus (centroid +
  // meanConfidence are computed over all the instances a pattern covers; the
  // inter-partition distances are evaluated against the candidate set).
  const candidates = pats.map((p) => makePartition(p, list, confByClaimId))
    .filter((c) => c.instances.length > 0);

  const uncovered = new Set(list.map((i) => i.claimId));
  const chosen = [];
  const usedIds = new Set();

  while (uncovered.size > 0) {
    let best = null;
    let bestScore = -Infinity;
    let bestId = null;
    for (const cand of candidates) {
      if (usedIds.has(cand.id)) continue;
      let newCover = 0;
      for (const inst of cand.instances) {
        if (uncovered.has(inst.claimId)) newCover++;
      }
      if (newCover === 0) continue;
      // goodness is scored against the candidate set (the real g2/g4 discriminate).
      const g = goodness(cand, candidates, corpusRanges, weights, confByClaimId);
      // Avoid divide-by-zero / sign flips: rank by coverage/goodness with a small
      // positive guard (deterministic). A non-positive goodness still ranks by
      // coverage so the cover terminates.
      const denom = (g > 1e-9) ? g : 1e-9;
      const score = newCover / denom;
      if (score > bestScore || (score === bestScore && (bestId === null || cand.id < bestId))) {
        bestScore = score;
        best = cand;
        bestId = cand.id;
      }
    }
    if (!best) break;
    usedIds.add(best.id);
    // Attach ONLY the newly-covered instances to the chosen partition (set-cover).
    const newlyCovered = best.instances.filter((inst) => uncovered.has(inst.claimId));
    for (const inst of newlyCovered) uncovered.delete(inst.claimId);
    chosen.push({
      id: best.id,
      pattern: best.pattern,
      instances: newlyCovered,
      centroid: computeCentroid(newlyCovered),
      meanConfidence: meanConfidenceOf(newlyCovered, confByClaimId),
    });
  }

  // Recompute the inter-partition-aware fields against the FINAL chosen set so the
  // returned centroid/meanConfidence reflect the partition's own members.
  return chosen;
}

module.exports = {
  partition,
  goodness,
  interPartitionFeatureDistance,
  interPartitionConfidenceDistance,
  intraFeatureDistance,
  intraConfidenceDistance,
  computeCorpusRanges,
  computeCentroid,
  meanConfidenceOf,
  partitionId,
};
