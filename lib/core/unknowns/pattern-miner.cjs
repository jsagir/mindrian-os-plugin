'use strict';
// ========================================
// MINDRIAN UNKNOWN-UNKNOWNS PATTERN MINER (Phase 165 Wave 2 port)
// Support-bounded descriptive pattern mining over the confident-claim corpus.
//
// Ported from reference/unknown-unknowns-horvitz/README.md (PatternMiner contract,
// AAAI 2017 Lakkaraju/Kamar/Caruana/Horvitz). The MATH ports verbatim; the recast
// (Phase 165 port change #1) feeds the room's confident-claim instances over the
// shared INSTANCE_FEATURES schema (lib/core/unknowns/iface.cjs) instead of a
// trained classifier's predictions.
//
// minePatterns(instances, features) returns descriptive patterns each shaped
//   { conditions: [{ feature, operator, value }] }
// NUMERIC features yield quartile <=/>= conditions; CATEGORICAL features yield =
// conditions; conditions AND-combine up to maxPatternLength; only patterns with
// support >= minSupport are kept.
//
// Mirrors the lib/core/issue-tree.cjs purity doctrine: this is a PURE, single-call,
// deterministic builder. ZERO Math.random, ZERO Date.now, ZERO I/O, ZERO Brain
// require (Canon Part 8: claim features never egress; Part 10 / D-165-10). Stable
// iteration order so a re-run is byte-identical (D-165-09). NO em-dashes (CLAUDE.md
// HARD RULE); CJS; no new deps.
//
// Sources: 165-RESEARCH.md section 1.1 (PatternMiner contract), reference README
// lines 14-16, the INSTANCE_FEATURES + TIER_NUMERIC + DEFAULT_CONFIG shared iface.
// ========================================

const { INSTANCE_FEATURES, TIER_NUMERIC, DEFAULT_CONFIG } = require('./iface.cjs');

// The feature dimensions that participate in pattern mining (claimId and
// governingHash are identity handles, not distance/pattern dimensions). Frozen
// ordered so condition iteration is deterministic (D-165-09).
const NUMERIC_DIMS = Object.freeze(
  INSTANCE_FEATURES.filter((f) => f.kind === 'NUMERIC').map((f) => f.name)
);
const CATEGORICAL_DIMS = Object.freeze(
  INSTANCE_FEATURES.filter((f) => f.kind === 'CATEGORICAL').map((f) => f.name)
);

// Map an evidenceTier handle to its ordinal NUMERIC value (Academic=4..None=1) so
// the quartile bucketing operates on the ordinal rank (165-RESEARCH section 1.4).
// A plain numeric feature passes through unchanged.
function numericValueOf(featureName, raw) {
  if (featureName === 'evidenceTier') {
    const v = TIER_NUMERIC[raw];
    return typeof v === 'number' ? v : null;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// Quartile cut-points (q1, q3) over a sorted numeric column. Deterministic linear
// interpolation; identical inputs yield identical cuts. Returns null when the
// column has fewer than 2 distinct finite values (no quartile structure).
function quartileCuts(values) {
  const finite = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (finite.length < 2) return null;
  const sorted = finite.slice().sort((a, b) => a - b);
  const at = (frac) => {
    const idx = frac * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    const w = idx - lo;
    return sorted[lo] * (1 - w) + sorted[hi] * w;
  };
  const q1 = at(0.25);
  const q3 = at(0.75);
  if (q1 === q3) return null;
  return { q1, q3 };
}

// support(condition-set, instances) = fraction of instances satisfying ALL
// conditions. Deterministic; pure.
function supportOf(conditions, instances) {
  if (instances.length === 0) return 0;
  let hits = 0;
  for (const inst of instances) {
    if (conditionsMatch(conditions, inst)) hits++;
  }
  return hits / instances.length;
}

function conditionsMatch(conditions, inst) {
  for (const c of conditions) {
    if (!conditionMatch(c, inst)) return false;
  }
  return true;
}

function conditionMatch(cond, inst) {
  const raw = inst[cond.feature];
  if (cond.operator === '=') {
    return String(raw) === String(cond.value);
  }
  const n = numericValueOf(cond.feature, raw);
  if (n === null) return false;
  if (cond.operator === '<=') return n <= cond.value;
  if (cond.operator === '>=') return n >= cond.value;
  return false;
}

// Build the atomic (length-1) candidate conditions over the corpus. NUMERIC dims
// emit a <= q1 and a >= q3 condition (the over/under quartile tails where blind
// spots concentrate); CATEGORICAL dims emit one = condition per distinct value.
// Iterated in the frozen INSTANCE_FEATURES dimension order, values id-sorted, so
// the atom list order is deterministic (D-165-09).
function buildAtoms(instances) {
  const atoms = [];
  for (const feat of NUMERIC_DIMS) {
    const col = instances.map((i) => numericValueOf(feat, i[feat]));
    const cuts = quartileCuts(col);
    if (!cuts) continue;
    atoms.push({ feature: feat, operator: '<=', value: cuts.q1 });
    atoms.push({ feature: feat, operator: '>=', value: cuts.q3 });
  }
  for (const feat of CATEGORICAL_DIMS) {
    const seen = new Set();
    for (const inst of instances) {
      const v = inst[feat];
      if (v === undefined || v === null) continue;
      seen.add(String(v));
    }
    const vals = Array.from(seen).sort();
    for (const v of vals) {
      atoms.push({ feature: feat, operator: '=', value: v });
    }
  }
  return atoms;
}

// A stable string key for a condition set (feature+operator+value), used to
// de-duplicate AND-combinations regardless of generation order.
function conditionKey(conditions) {
  return conditions
    .map((c) => c.feature + c.operator + String(c.value))
    .slice()
    .sort()
    .join('&');
}

/**
 * minePatterns(instances, features?, opts?) -> [{ conditions: [{feature,operator,value}] }]
 *
 * Support-bounded descriptive pattern mining (reference PatternMiner). Generates
 * length-1 atoms (quartile numeric / equality categorical), AND-combines them up
 * to maxPatternLength, and keeps only the patterns whose support >= minSupport.
 * Pure + deterministic: identical instances yield an identical pattern array in a
 * stable order (D-165-09). `features` is accepted for contract parity with the
 * reference signature but the dimensions come from the frozen INSTANCE_FEATURES
 * schema (the recast single source of truth).
 */
function minePatterns(instances, features, opts) {
  const list = Array.isArray(instances) ? instances : [];
  const cfg = Object.assign({}, DEFAULT_CONFIG, opts || {});
  const minSupport = typeof cfg.minSupport === 'number' ? cfg.minSupport : DEFAULT_CONFIG.minSupport;
  const maxLen = typeof cfg.maxPatternLength === 'number' ? cfg.maxPatternLength : DEFAULT_CONFIG.maxPatternLength;
  if (list.length === 0) return [];

  const atoms = buildAtoms(list);

  // Level-1: surviving atoms (support-bounded). Stable order = buildAtoms order.
  let level = [];
  const kept = [];
  const seen = new Set();
  for (const atom of atoms) {
    const conditions = [atom];
    if (supportOf(conditions, list) >= minSupport) {
      const key = conditionKey(conditions);
      if (!seen.has(key)) {
        seen.add(key);
        kept.push({ conditions });
        level.push(conditions);
      }
    }
  }

  // Levels 2..maxLen: AND-combine a surviving (k-1)-pattern with each atom on a
  // DIFFERENT feature; keep if support-bounded. Deterministic apriori-style growth.
  for (let len = 2; len <= maxLen; len++) {
    const next = [];
    for (const base of level) {
      const usedFeatures = new Set(base.map((c) => c.feature));
      for (const atom of atoms) {
        if (usedFeatures.has(atom.feature)) continue;
        const conditions = base.concat([atom]);
        const key = conditionKey(conditions);
        if (seen.has(key)) continue;
        if (supportOf(conditions, list) >= minSupport) {
          seen.add(key);
          const ordered = conditions.slice().sort(
            (a, b) => (a.feature + a.operator + String(a.value)).localeCompare(b.feature + b.operator + String(b.value))
          );
          kept.push({ conditions: ordered });
          next.push(conditions);
        }
      }
    }
    level = next;
    if (level.length === 0) break;
  }

  return kept;
}

module.exports = {
  minePatterns,
  // Exposed for the DSP partitioner + tests (pure helpers, deterministic).
  supportOf,
  conditionsMatch,
  numericValueOf,
  NUMERIC_DIMS,
  CATEGORICAL_DIMS,
};
