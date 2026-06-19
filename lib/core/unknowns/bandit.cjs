'use strict';
// ========================================
// MINDRIAN UNKNOWN-UNKNOWNS BANDIT (UCB-with-discount, Algorithm 2) (Phase 165 W3)
// Index-deterministic arm + instance selection over the DSP partitions, with a
// per-pull resumable checkpoint.
//
// Ported from reference/unknown-unknowns-horvitz/README.md (Algorithm 2, Eq.1
// utility, Eq.3 discount, the UCB bound, AAAI 2017 Lakkaraju/Kamar/Caruana/
// Horvitz). The MATH ports verbatim; the THREE load-bearing changes (Phase 165
// port changes #2/#3/#5, 165-RESEARCH sections 1.5 + 1.6):
//   #2 NO Math.random -- the reference samples Math.floor(Math.random()*len) for
//      both the first-K arm order and the within-arm instance pick. BANNED
//      (CLAUDE.md + D-165-09). Replaced with index-deterministic selection:
//      arm order = priority desc, tie-break ascending partition id; within-arm
//      pick = a cursor into the ascending-claimId-sorted unprobed list.
//   #3 Resumable -- a per-pull checkpoint (the shared CHECKPOINT_SHAPE) the caller
//      persists; resumeFrom validates corpusHash and either continues from pull or
//      signals a fresh-scan-required. An interrupt-then-resume run is byte-identical.
//   #5 Arm priority is INJECTED (a per-partition scalar from a caller-supplied
//      priorityFn). The orchestrator (plan 165-04) supplies the real HSI-or-LOCAL
//      priority; absent it, the default is descending mean intra-partition
//      proxy-readiness (the partition meanConfidence proxy). NOT hardcoded here.
//
// Mirrors the lib/core/issue-tree.cjs purity doctrine: PURE, deterministic. ZERO
// Math.random, ZERO Date.now in the math path (scanId derives from roomDir +
// corpusHash; the "time" field is the monotone pull counter, not a wall clock).
// ZERO Brain require, ZERO I/O (the caller persists the checkpoint object).
// Canon Part 8 / D-165-10. NO em-dashes (CLAUDE.md HARD RULE); CJS; no new deps.
//
// Sources: 165-RESEARCH.md section 1.1 (UUB contract), 1.2 (Eq.1/3 + UCB bound),
// 1.5 (index-deterministic order), 1.6 (the checkpoint shape + resume rule), the
// shared iface (CHECKPOINT_SHAPE, CHECKPOINT_ARM_SHAPE, DEFAULT_CONFIG gamma/budget).
// ========================================

const crypto = require('crypto');
const { DEFAULT_CONFIG } = require('./iface.cjs');

// scanId = a deterministic id over (roomDir, corpusHash). NO Date.now (D-165-09):
// a Workflow re-run of the same corpus is a cache hit on the same scanId.
function deriveScanId(roomDir, corpusHash) {
  return crypto.createHash('sha256')
    .update('uu-scan|' + String(roomDir || '') + '|' + String(corpusHash || ''))
    .digest('hex')
    .slice(0, 16);
}

// The default arm priority (port change #5): descending mean intra-partition
// proxy-readiness == the partition's meanConfidence (the most-confident region is
// probed first, since over-confidence is where blind spots concentrate). The
// orchestrator overrides this with the real HSI scalar via priorityFn.
function defaultPriority(partition) {
  return Number(partition.meanConfidence) || 0;
}

// Stable arm order (165-RESEARCH section 1.5): priority DESC, tie-break partition
// id ASC. Deterministic total order; no Math.random.
function orderArms(partitions, priorityFn) {
  const pf = (typeof priorityFn === 'function') ? priorityFn : defaultPriority;
  return partitions
    .map((p, idx) => ({ p, idx, id: p.id, priority: pf(p) }))
    .slice()
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return String(a.id).localeCompare(String(b.id));
    });
}

// The ascending-claimId-sorted instance list for an arm (the within-arm cursor
// order, section 1.5). Deterministic; no shuffle, no reservoir sampling.
function sortedInstanceIds(partition) {
  return (partition.instances || [])
    .map((i) => i.claimId)
    .slice()
    .sort((a, b) => String(a).localeCompare(String(b)));
}

/**
 * initialize(partitions, opts?) -> banditState
 * Seeds one arm per partition with effectiveCount/discountedMean/currentArmSize/
 * sizeAtPull and a sorted unprobed-instance list (ascending claimId). Pure; the
 * returned state is a plain object the caller may serialize.
 */
function initialize(partitions, opts) {
  const parts = Array.isArray(partitions) ? partitions : [];
  const cfg = Object.assign({}, DEFAULT_CONFIG, opts || {});
  const ordered = orderArms(parts, cfg.priorityFn);
  const arms = ordered.map((o) => {
    const ids = sortedInstanceIds(o.p);
    return {
      partitionId: o.id,
      priority: o.priority,
      effectiveCount: 0,
      discountedMean: 0,
      currentArmSize: ids.length,
      sizeAtPull: ids.length,
      unprobedInstanceIds: ids.slice(),
      probedInstanceIds: [],
    };
  });
  return {
    scanId: deriveScanId(cfg.roomDir, cfg.corpusHash),
    corpusHash: String(cfg.corpusHash || ''),
    roomDir: String(cfg.roomDir || ''),
    gamma: typeof cfg.gamma === 'number' ? cfg.gamma : DEFAULT_CONFIG.gamma,
    arms,
    pull: 0,
    cumulativeUtility: 0,
    records: [],
    done: false,
  };
}

// Eq.1 utility = (isUnknownUnknown ? 1 : 0) - gamma*cost.
function utilityOf(isUU, gamma, cost) {
  return (isUU ? 1 : 0) - gamma * (Number(cost) || 0);
}

// Eq.3 custom discount = currentArmSize / sizeAtPull (guard divide-by-zero).
function discountOf(arm) {
  return arm.sizeAtPull > 0 ? (arm.currentArmSize / arm.sizeAtPull) : 0;
}

// UCB bound = sqrt(2*ln(sum effective counts) / N_t). N_t = arm.effectiveCount.
function ucbBound(arm, sumEffCounts) {
  if (arm.effectiveCount <= 0) return Infinity; // unplayed arm wins (try-each-once)
  const total = sumEffCounts > 1 ? sumEffCounts : Math.E; // ln >= 1 guard
  return Math.sqrt((2 * Math.log(total)) / arm.effectiveCount);
}

// Pick the next arm: any arm with a remaining unprobed instance. First K pulls try
// each unplayed arm once in the stable order; thereafter UCB-with-discount. Ties
// broken by ascending partitionId so the choice is a deterministic total order.
function pickArm(state) {
  const eligible = state.arms.filter((a) => a.unprobedInstanceIds.length > 0);
  if (eligible.length === 0) return null;
  // First-K: an unplayed eligible arm (effectiveCount 0) wins, in stable order.
  const unplayed = eligible.filter((a) => a.effectiveCount === 0);
  if (unplayed.length > 0) return unplayed[0]; // arms already in stable order
  // UCB-with-discount selection.
  const sumEff = state.arms.reduce((s, a) => s + a.effectiveCount, 0);
  let best = null;
  let bestVal = -Infinity;
  for (const a of eligible) {
    const val = a.discountedMean + ucbBound(a, sumEff);
    if (val > bestVal || (val === bestVal && (best === null || String(a.partitionId).localeCompare(String(best.partitionId)) < 0))) {
      bestVal = val;
      best = a;
    }
  }
  return best;
}

// Apply one pull to the state in place: probe the arm's next unprobed instance
// (ascending-claimId cursor), call the oracle, update the arm with the Eq.3
// discount, append the pull record. Returns the record.
function applyPull(state, arm, oracleFn) {
  const instanceId = arm.unprobedInstanceIds[0];
  const res = oracleFn(instanceId, { partitionId: arm.partitionId, pull: state.pull }) || {};
  const isUU = res.trueLabel ? 1 : 0;
  const cost = Number(res.cost) || 0;
  const u = utilityOf(isUU, state.gamma, cost);

  // Move the instance from unprobed -> probed (cursor advances).
  arm.unprobedInstanceIds = arm.unprobedInstanceIds.slice(1);
  arm.probedInstanceIds = arm.probedInstanceIds.concat([instanceId]);
  arm.currentArmSize = arm.unprobedInstanceIds.length;

  // Eq.3 discount applied to the running mean update (discounted UCB).
  const discount = discountOf(arm);
  const prevEff = arm.effectiveCount;
  const newEff = prevEff * discount + 1;
  arm.discountedMean = newEff > 0 ? ((arm.discountedMean * prevEff * discount) + u) / newEff : u;
  arm.effectiveCount = newEff;

  state.cumulativeUtility += u;
  const record = {
    time: state.pull,
    arm: arm.partitionId,
    instance: instanceId,
    utility: u,
    isUnknownUnknown: !!isUU,
    cumulativeUtility: state.cumulativeUtility,
  };
  state.records.push(record);
  state.pull += 1;
  return record;
}

/**
 * runScan(state, oracleFn, budget, opts?) -> { records, cumulativeUtility, done,
 *   checkpoint }
 * Runs pulls until the budget is spent or every arm is exhausted. Per-pull a
 * checkpoint is offered to opts.onCheckpoint(checkpoint) so the caller can persist
 * it (and, in tests, interrupt). If opts.maxPulls is set, the scan stops after
 * that many pulls THIS invocation (the interrupt seam) and returns the resumable
 * checkpoint. Deterministic; no Math.random; no Date.now.
 */
function runScan(state, oracleFn, budget, opts) {
  const o = opts || {};
  const maxPulls = (typeof o.maxPulls === 'number') ? o.maxPulls : Infinity;
  const startPull = state.pull;
  while (state.pull < budget && (state.pull - startPull) < maxPulls) {
    const arm = pickArm(state);
    if (!arm) { state.done = true; break; }
    applyPull(state, arm, oracleFn);
    const cp = toCheckpoint(state, budget);
    if (typeof o.onCheckpoint === 'function') o.onCheckpoint(cp);
  }
  if (state.pull >= budget) state.done = true;
  if (!pickArm(state)) state.done = true;
  return {
    records: state.records.slice(),
    cumulativeUtility: state.cumulativeUtility,
    done: state.done,
    checkpoint: toCheckpoint(state, budget),
  };
}

// Serialize the state into the documented CHECKPOINT_SHAPE (the LOCAL sidecar the
// caller persists). Deterministic; carries no Date.now.
function toCheckpoint(state, budget) {
  return {
    scanId: state.scanId,
    corpusHash: state.corpusHash,
    pull: state.pull,
    budget: budget,
    arms: state.arms.map((a) => ({
      partitionId: a.partitionId,
      effectiveCount: a.effectiveCount,
      discountedMean: a.discountedMean,
      currentArmSize: a.currentArmSize,
      sizeAtPull: a.sizeAtPull,
      probedInstanceIds: a.probedInstanceIds.slice(),
    })),
    cumulativeUtility: state.cumulativeUtility,
    done: state.done,
  };
}

/**
 * selectNextInstance(partitions, oracleFn, budgetOrConfig, opts?) -> result
 * The Algorithm-2 entry point. budget = floor(N * config.budget) where N is the
 * total instance count (matches the reference orchestrator). Accepts either a
 * numeric budget or a config object carrying { budget, gamma, priorityFn, roomDir,
 * corpusHash }. Returns { records, cumulativeUtility, done, checkpoint, state }.
 */
function selectNextInstance(partitions, oracleFn, budgetOrConfig, opts) {
  const parts = Array.isArray(partitions) ? partitions : [];
  const N = parts.reduce((s, p) => s + ((p.instances || []).length), 0);
  let cfg;
  let budget;
  if (typeof budgetOrConfig === 'number') {
    budget = budgetOrConfig;
    cfg = {};
  } else {
    cfg = budgetOrConfig || {};
    const frac = typeof cfg.budget === 'number' ? cfg.budget : DEFAULT_CONFIG.budget;
    budget = Math.floor(N * frac);
  }
  const state = initialize(parts, cfg);
  const result = runScan(state, oracleFn, budget, opts);
  result.state = state;
  result.budget = budget;
  return result;
}

/**
 * resumeFrom(checkpoint, partitions, oracleFn, currentCorpusHash, opts?) -> result
 * Validates the checkpoint corpusHash against the current corpus. On match,
 * continues the scan so the FULL record sequence is byte-identical to an
 * uninterrupted run; on mismatch, signals a fresh-scan-required (the caller starts
 * over). The freshness gate (165-RESEARCH section 4) prevents thrash so a mismatch
 * is rare-and-correct.
 *
 * Mechanism (D-165-09, Pitfall 4): the scan is FULLY deterministic given the
 * partitions + the (pure, deterministic) oracle, and a matching corpusHash proves
 * the corpus is byte-identical to when the checkpoint was cut. So resume rebuilds
 * the live state from scratch and DETERMINISTICALLY REPLAYS pulls 0..checkpoint.pull
 * (reconstructing the pre-interrupt record sequence the checkpoint does not carry),
 * then continues to the budget. Replaying a deterministic scan reproduces the exact
 * pre-interrupt records, and the checkpoint's persisted arm cursors are asserted to
 * match the replayed cursors so a divergence (a non-deterministic oracle) is caught.
 */
function resumeFrom(checkpoint, partitions, oracleFn, currentCorpusHash, opts) {
  if (!checkpoint || typeof checkpoint !== 'object') {
    return { freshScanRequired: true, reason: 'no_checkpoint' };
  }
  if (String(checkpoint.corpusHash) !== String(currentCorpusHash)) {
    return { freshScanRequired: true, reason: 'corpus_dirty' };
  }
  const parts = Array.isArray(partitions) ? partitions : [];
  const cfg = Object.assign({}, opts || {}, { corpusHash: currentCorpusHash, roomDir: (opts && opts.roomDir) || '' });
  const budget = checkpoint.budget;

  // Rebuild the live state and deterministically replay up to checkpoint.pull so
  // the reconstructed record sequence matches the interrupted run exactly.
  const state = initialize(parts, cfg);
  runScan(state, oracleFn, budget, { maxPulls: checkpoint.pull });

  // Tripwire: the replayed arm cursors MUST match the persisted checkpoint cursors.
  // A mismatch means the oracle was non-deterministic (Pitfall 4); fail closed to a
  // fresh scan rather than emit a silently-divergent sequence.
  const cpById = {};
  for (const a of (checkpoint.arms || [])) cpById[a.partitionId] = a;
  for (const arm of state.arms) {
    const saved = cpById[arm.partitionId];
    if (!saved) continue;
    if (JSON.stringify(arm.probedInstanceIds) !== JSON.stringify(saved.probedInstanceIds || [])) {
      return { freshScanRequired: true, reason: 'replay_divergence' };
    }
  }

  // Continue from the replayed point to the full budget.
  const result = runScan(state, oracleFn, budget, opts);
  result.state = state;
  result.budget = budget;
  result.resumed = true;
  return result;
}

module.exports = {
  initialize,
  selectNextInstance,
  resumeFrom,
  runScan,
  toCheckpoint,
  deriveScanId,
  utilityOf,
  discountOf,
  orderArms,
  defaultPriority,
};
