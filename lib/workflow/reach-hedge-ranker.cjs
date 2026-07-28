'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 222-02 -- the ONE shared scored-selection layer (D-01, D-03, Req 3/7).
 * ============================================================================
 * This module is the single selection brain both call sites adopt in Plan 03:
 * rankFiredCandidates(sensorReaches, roomState) re-orders dispatchSensors'
 * already-fired subset (the SAME objects, resorted) so every downstream [0] read
 * transparently sees the scored winner. It layers a hand-rolled two-expert
 * Hedge/MWU adjustment (Arora-Hazan-Kale 2012) learned from the Phase 159 outcome
 * log, debounced per D-03 (env-tunable N, default 50), and degrades visibly per
 * Req 7 (a failed weight-state read falls back to the D4-alone blend AND emits
 * reach_weight_state_unavailable, while a cold zero-row state stays silent).
 *
 * THREE non-negotiable invariants (mirror reach-reject-reader.cjs):
 *   1. Chokepoint-only db access. The sole SQL surface is the navigation.cjs
 *      chokepoint (readHedgeWeightState / upsertHedgeWeightState /
 *      findRecentChanges / logMemoryEvent). This module never opens a db, never
 *      requires a raw sqlite driver, never reads room files (Canon Part 9).
 *   2. Enum/scalar-only reads and writes. Outcome rows contribute only their
 *      decision + reach_id enums; the degrade event payload is enum tokens only
 *      (fault_kind, source), never prose, never a field named reason (Part 8).
 *   3. Injection seam for db-free tests. roomState.hedgeWeights (and the Phase 158
 *      reject-history seam reach-reject-reader honors) let the ranker run without
 *      a db handle, mirroring the _injected discipline of the Phase 158 reader.
 *
 * NO Brain call. Room-local only. NO em-dashes anywhere (CLAUDE.md HARD RULE). CJS.
 */

const navigation = require('../core/navigation.cjs');
const cortexReachAdapter = require('../hmi/cortex-reach-adapter.cjs');
const reachRejectReader = require('./reach-reject-reader.cjs');

// ===========================================================================
// Constants (each ALL-CAPS tunable carries the low-data TUNABLE-LATER rationale
// discipline of reach-reject-reader.cjs:93-98).
// ===========================================================================

// The two experts this phase's Hedge blend weighs: the D4 blend score and the
// raw registry-order signal. Kept GENERAL over an expert-id-keyed object (never
// hardcoded two fields) so a future fourth expert class (SEED-057) needs a KEY,
// not a re-architecture.
const EXPERT_IDS = Object.freeze(['d4_blend', 'registry_order']);

// The six frozen machine reaches (mirror reach-reject-reader.cjs:41-48 and the
// cortex-reach-adapter REACH_DEFS). A flat local const so this module never
// imports the orchestrator and the two stay decoupled.
const REACH_IDS = Object.freeze([
  'context_block',
  'contradiction',
  'cross_room',
  'brain_consult',
  'deep_research',
  'hats',
]);

// N (HEDGE_UPDATE_N_DEFAULT = 50) -- the D-03 debounce bound: the Hedge weights
// refit at most once per N qualifying outcome rows, never per-event, to avoid a
// single noisy outcome thrashing the weights. 50 is SEED-009's own precedent
// number (not a freshly-invented one), matching Phase 158's debounce discipline.
// Env override MINDRIAN_HEDGE_UPDATE_N, read defensively with a numeric fallback.
// TUNABLE-LATER from telemetry once the outcome-edge corpus grows.
const HEDGE_UPDATE_N_DEFAULT = 50;

// eta (HEDGE_ETA_DEFAULT = 0.3) -- the Hedge learning rate. It bounds a single
// fold's multiplicative swing to exp(0.3) ~ 1.35, conservative for a 2-expert
// Hedge (Arora-Hazan-Kale 2012). The horizon-optimal eta is T-dependent and is
// deliberately NOT computed at this data scale (an overfit at < 100 edges).
// Env override MINDRIAN_HEDGE_ETA. TUNABLE-LATER.
const HEDGE_ETA_DEFAULT = 0.3;

// ---------------------------------------------------------------------------
// Small pure helpers.
// ---------------------------------------------------------------------------

function clamp01(x) {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function equalWeights(keys) {
  const list = (Array.isArray(keys) && keys.length > 0) ? keys : EXPERT_IDS;
  const share = 1 / list.length;
  const out = {};
  for (const k of list) out[k] = share;
  return out;
}

// canonicalRegistryRank(reachId) -- WR-01: the ONE definition of "registry
// order" both deriveExpertLosses (training, below) and rankFiredCandidates
// (the live blend) use, so the Hedge layer never learns a weight for a feature
// it is not actually applying. Returns the reach's FIXED position in the
// canonical REACH_IDS list (0-indexed) -- NOT its turn-relative position among
// whatever else happened to co-fire this turn. The turn-relative definition
// cannot be reconstructed at training time: historical f_selector_decision
// rows persist only reach_id + decision, never the full fired-subset context
// a past turn saw (a real, documented gap), so unifying on the canonical,
// always-computable definition is the fix that requires no new persisted data.
// An off-registry reach_id (should never happen for a live fired candidate;
// the training side already skips such rows via its own rank === -1 check
// below) falls to REACH_IDS.length, the worst possible rank, rather than
// Infinity/NaN.
function canonicalRegistryRank(reachId) {
  const idx = REACH_IDS.indexOf(reachId);
  return idx === -1 ? REACH_IDS.length : idx;
}

// d4For(reachId, reachScores) -- the reach's D4 score: the supplied finite prior
// clamped to 0..1, else the 0.5 registry floor (mirrors _resolveReachScore /
// Pattern 2; the flat floor is exactly the MCP-call condition where no cortex
// node was threaded in, so the outcome-learned layer is the sole differentiator).
function d4For(reachId, reachScores) {
  const supplied = (reachScores && typeof reachScores === 'object') ? reachScores[reachId] : undefined;
  if (typeof supplied === 'number' && Number.isFinite(supplied)) return clamp01(supplied);
  return 0.5;
}

function updateN(options) {
  const opt = (options && Number.isInteger(options.updateN) && options.updateN > 0) ? options.updateN : null;
  if (opt !== null) return opt;
  const env = Number(process.env.MINDRIAN_HEDGE_UPDATE_N);
  return (Number.isInteger(env) && env > 0) ? env : HEDGE_UPDATE_N_DEFAULT;
}

function updateEta(options) {
  const opt = (options && typeof options.eta === 'number' && Number.isFinite(options.eta) && options.eta > 0)
    ? options.eta : null;
  if (opt !== null) return opt;
  const env = Number(process.env.MINDRIAN_HEDGE_ETA);
  return (Number.isFinite(env) && env > 0) ? env : HEDGE_ETA_DEFAULT;
}

// ---------------------------------------------------------------------------
// hedgeUpdate(weights, losses, eta) -> renormalized weights
//
// The Arora-Hazan-Kale (2012) MWU step, GENERAL over expert-id-keyed objects
// (never hardcoded two fields). For each key: w = w * exp(-eta * loss); then
// renormalize to sum 1. A zero or non-finite sum returns equal weights over the
// keys (the guard against a degenerate fold). Pure.
// ---------------------------------------------------------------------------
function hedgeUpdate(weights, losses, eta) {
  const w = (weights && typeof weights === 'object') ? weights : {};
  const l = (losses && typeof losses === 'object') ? losses : {};
  const keys = Object.keys(w);
  if (keys.length === 0) return equalWeights(EXPERT_IDS);
  const rate = (typeof eta === 'number' && Number.isFinite(eta)) ? eta : HEDGE_ETA_DEFAULT;
  const updated = {};
  let sum = 0;
  for (const k of keys) {
    const prior = Number(w[k]);
    const lossRaw = Number(l[k]);
    const loss = Number.isFinite(lossRaw) ? lossRaw : 0;
    const next = (Number.isFinite(prior) ? prior : 0) * Math.exp(-rate * loss);
    updated[k] = next;
    sum += next;
  }
  if (!(sum > 0) || !Number.isFinite(sum)) return equalWeights(keys);
  const out = {};
  for (const k of keys) out[k] = updated[k] / sum;
  return out;
}

// ---------------------------------------------------------------------------
// deriveExpertLosses(row, opts) -> { d4_blend: loss, registry_order: loss } | null
//
// Maps one f_selector_decision row to a per-expert loss vector per SPEC Req 3's
// convention (accept = low loss, reject = high loss for the ENDORSING expert),
// made computable from stored row data:
//   endorsement_registry = 1 / (rank + 1)  (A2: the registry expert endorses
//     front-of-registry reaches most). rank is canonicalRegistryRank(reachId)
//     (WR-01: the IDENTICAL registry-order definition rankFiredCandidates'
//     live blend uses below -- both read the reach's fixed canonical REACH_IDS
//     position, never a turn-relative index over some other fired subset).
//   endorsement_d4       = d4For(reach_id, opts.reachScores) when supplied, else
//     0.5 (historical reachScores are not persisted -- documented limitation,
//     TUNABLE-LATER).
//   loss = (decision === 'reject') ? endorsement : (1 - endorsement).
// Rows with decision 'defer', a missing/off-set reach_id, or no decision are
// SKIPPED (return null) so the caller drops them. Reads the row's enums whether
// they sit at the top level (unit fixtures) or under .properties (real
// findRecentChanges rows).
// ---------------------------------------------------------------------------
function deriveExpertLosses(row, opts) {
  if (!row || typeof row !== 'object') return null;
  const props = (row.properties && typeof row.properties === 'object') ? row.properties : row;
  const decision = props.decision;
  if (decision !== 'accept' && decision !== 'reject') return null; // defer / none -> skip
  const reachId = props.reach_id;
  if (typeof reachId !== 'string' || reachId.length === 0) return null; // missing -> skip
  const rank = REACH_IDS.indexOf(reachId);
  if (rank === -1) return null; // off-set reach_id -> skip
  const options = (opts && typeof opts === 'object') ? opts : {};
  const reachScores = (options.reachScores && typeof options.reachScores === 'object')
    ? options.reachScores : null;
  const endorsementRegistry = 1 / (rank + 1);
  const endorsementD4 = reachScores ? d4For(reachId, reachScores) : 0.5;
  const isReject = decision === 'reject';
  return {
    d4_blend: isReject ? endorsementD4 : (1 - endorsementD4),
    registry_order: isReject ? endorsementRegistry : (1 - endorsementRegistry),
  };
}

// ---------------------------------------------------------------------------
// emitUnavailable(db, faultKind, roomState) -- the Req 7 disclosed-degrade signal.
//
// TWO destinations, one signal. The Req 7 contract is that a degraded weight-state
// read is DISCLOSED, never swallowed; it does not require that the disclosure be a
// room.db write. Under the opt-in read-only mode (quick 260728-7kc) the SAME closed
// enum token is handed to the caller through roomState.degradeSink instead, so a
// declared-read caller still learns it degraded without the ranker writing into the
// room it was only supposed to read.
//
// Both paths are wrapped so the degrade path itself can never throw. Payload is
// enum tokens ONLY (fault_kind, source); never prose, never a field named reason
// (Part 8 + the run-all-158 reason-sweep convention). A missing or non-array sink
// under readOnly is safe: the token is simply dropped, never written.
// ---------------------------------------------------------------------------
function emitUnavailable(db, faultKind, roomState) {
  const rs = (roomState && typeof roomState === 'object') ? roomState : {};
  if (rs.readOnly === true) {
    try {
      if (Array.isArray(rs.degradeSink)) rs.degradeSink.push(faultKind);
    } catch (_e) {
      // The degrade path itself must never throw.
    }
    return;
  }
  try {
    navigation.logMemoryEvent(db, 'reach_weight_state_unavailable', {
      fault_kind: faultKind,
      source: 'reach-hedge-ranker',
    });
  } catch (_e) {
    // The degrade path itself must never throw.
  }
}

// ---------------------------------------------------------------------------
// readHedgeWeights(db, roomState) -> { d4_blend, registry_order } (sum 1)
//
// Non-throwing degrade, never silent (PATTERNS.md worked example):
//   (a) injection seam first: roomState.hedgeWeights wins (db-free unit tests).
//   (b) no db -> equal weights over EXPERT_IDS, NO event (the MCP/no-room path).
//   (c) readHedgeWeightState inside try: a THROW is a real fault -> emit the
//       degrade event (read_fault) and return equal weights.
//   (d) null result = cold start: equal weights, NO event (Pitfall 5).
//   (e) validate every stored weight is finite, non-negative, positive-sum:
//       a corrupt scalar emits the degrade event (corrupt_scalar) + equal weights.
//   (f) healthy values renormalize to sum 1.
//
// roomState is threaded into every emitUnavailable call so the read-only mode can
// route the token to the caller's sink instead of a room.db write. The READ itself
// is identical in both modes: the mode removes writes only, never the read.
// ---------------------------------------------------------------------------
function readHedgeWeights(db, roomState) {
  const rs = (roomState && typeof roomState === 'object') ? roomState : {};
  if (rs.hedgeWeights && typeof rs.hedgeWeights === 'object') {
    return rs.hedgeWeights; // (a) injection seam
  }
  if (!db) return equalWeights(EXPERT_IDS); // (b) cold / no-room path, no event
  let state;
  try {
    state = navigation.readHedgeWeightState(db);
  } catch (_e) {
    emitUnavailable(db, 'read_fault', rs); // (c) real fault -> disclosed degrade
    return equalWeights(EXPERT_IDS);
  }
  if (!state || !state.weights || typeof state.weights !== 'object') {
    return equalWeights(EXPERT_IDS); // (d) cold start, NO event
  }
  const raw = {};
  let sum = 0;
  for (const id of EXPERT_IDS) {
    const v = Number(state.weights[id]);
    if (!Number.isFinite(v) || v < 0) {
      emitUnavailable(db, 'corrupt_scalar', rs); // (e) corrupt scalar -> disclosed degrade
      return equalWeights(EXPERT_IDS);
    }
    raw[id] = v;
    sum += v;
  }
  if (!(sum > 0)) {
    emitUnavailable(db, 'corrupt_scalar', rs);
    return equalWeights(EXPERT_IDS);
  }
  const out = {}; // (f) renormalize
  for (const id of EXPERT_IDS) out[id] = raw[id] / sum;
  return out;
}

// startWeights(state) -- the fold's seed: the current normalized weights when
// healthy, else equal weights. Never emits (that is readHedgeWeights' job).
function startWeights(state) {
  if (state && state.weights && typeof state.weights === 'object') {
    const raw = {};
    let sum = 0;
    let ok = true;
    for (const id of EXPERT_IDS) {
      const v = Number(state.weights[id]);
      if (!Number.isFinite(v) || v < 0) { ok = false; break; }
      raw[id] = v;
      sum += v;
    }
    if (ok && sum > 0) {
      const out = {};
      for (const id of EXPERT_IDS) out[id] = raw[id] / sum;
      return out;
    }
  }
  return equalWeights(EXPERT_IDS);
}

// ---------------------------------------------------------------------------
// maybeUpdateHedgeWeights(db, opts) -> { updated: boolean, weights? }
//
// The D-03 debounced fold. No db -> { updated: false }. Reads the current state
// (tolerating null), reads f_selector_decision rows newer than its updatedAt,
// keeps rows deriveExpertLosses accepts, and only when >= N does it fold them
// chronologically (oldest first) through hedgeUpdate and upsert the result with an
// advanced updateCount + the newest row timestamp. The entire body soft-fails to
// { updated: false } so the update trigger can never break a turn.
//
// Called by scripts/hedge-refit-pipeline.cjs::runHedgeRefit, the explicit
// navigator-triggered entry point (quick task 260728-8av). Never called from
// rankFiredCandidates below: that fire-and-forget trigger was removed as a
// proven no-op on every shipped surface (RCA hedge-fold-has-no-production-
// trigger). This function's own behavior is unchanged.
// ---------------------------------------------------------------------------
function maybeUpdateHedgeWeights(db, opts) {
  if (!db) return { updated: false };
  const options = (opts && typeof opts === 'object') ? opts : {};
  try {
    let state = null;
    try {
      state = navigation.readHedgeWeightState(db);
    } catch (_e) {
      state = null; // a fault here is disclosed by readHedgeWeights; the fold tolerates it
    }
    const since = (state && typeof state.updatedAt === 'number') ? state.updatedAt : 0;
    let rows;
    try {
      // WR-03 (documented accepted bound, not a fix): this call used to be
      // invoked on essentially every multi-candidate turn/pull where db was
      // present, back when rankFiredCandidates fire-and-forgot this function.
      // Quick task 260728-8av removed that call site: this function is now
      // invoked only by scripts/hedge-refit-pipeline.cjs, a deliberate
      // navigator-triggered action, never per-turn and never per-poll. The
      // "invoked on essentially every turn" premise below no longer holds,
      // which makes the 500-row cap even less reachable than the review
      // already found it to be, not more (the debounce below gates only the
      // WRITE, never this query -- `since` only
      // ever advances on a successful fold, so an under-N invocation re-queries
      // the SAME floor next time, losing nothing). The 500-row cap can only
      // strand rows if MORE than 500 new qualifying f_selector_decision rows
      // accumulate strictly BETWEEN two consecutive invocations of this
      // function. The debounce threshold N defaults to 50 (HEDGE_UPDATE_N_DEFAULT,
      // env-tunable) -- 500 is a full 10x that, and each qualifying row requires
      // a genuine user accept/reject/defer decision (selector-decisions.cjs),
      // not a per-turn firehose. Under normal operation this function is called
      // far more often than a user can produce 500 decisions, so the cap is not
      // reachable in practice. It IS reachable only in an already-degraded
      // scenario the review named explicitly (db persistently null across many
      // intervening qualifying-decision turns on a caller that threads
      // ctx.roomDb, or a bug elsewhere suppressing invocation for a long
      // stretch) -- at that point the fold is already unhealthy for reasons
      // beyond this cap, and pagination would only mask, not fix, the deeper
      // fault. If the corpus ever grows enough that this margin narrows
      // (TUNABLE-LATER, mirrors the reachScores limitation below), revisit with
      // pagination or a persisted high-water-mark cursor.
      rows = navigation.findRecentChanges(db, since, { eventType: 'f_selector_decision', limit: 500 });
    } catch (_e) {
      return { updated: false };
    }
    if (!Array.isArray(rows)) return { updated: false };
    const kept = [];
    for (const row of rows) {
      const losses = deriveExpertLosses(row, options);
      if (losses) kept.push({ row: row, losses: losses });
    }
    const N = updateN(options);
    if (kept.length < N) return { updated: false };
    kept.reverse(); // findRecentChanges returns DESC; fold oldest-first
    const eta = updateEta(options);
    let weights = startWeights(state);
    let newestTs = since;
    for (const item of kept) {
      weights = hedgeUpdate(weights, item.losses, eta);
      const ts = item.row && item.row.createdAt;
      if (typeof ts === 'number' && ts > newestTs) newestTs = ts;
    }
    navigation.upsertHedgeWeightState(db, weights, {
      updateCount: ((state && typeof state.updateCount === 'number') ? state.updateCount : 0) + 1,
      updatedAt: newestTs,
    });
    return { updated: true, weights: weights };
  } catch (_e) {
    return { updated: false }; // the update trigger may never break a turn
  }
}

// ---------------------------------------------------------------------------
// rankFiredCandidates(sensorReaches, roomState) -> re-ordered fired subset
//
// The D-01 shared selection. Returns the SAME reach objects, re-sorted by the
// combined score descending, so every downstream [0] read sees the scored winner:
//   (a) 0/1 candidates -> the INPUT untouched (same reference, zero reads/writes).
//   (b) reachScores = roomState.reachScores when an object, else
//       buildReachScoresFromCortex(cortexNodes || []) (the SAME reusable call the
//       CLI path makes; the adapter already returns {} on empty input).
//   (c) d4For(reach_id) -> supplied finite score clamped, else the 0.5 floor.
//   (d) compose Phase 158: d4Adjusted = d4For * (1 - countPenalty) so the shipped
//       reject discount is ONE coordinated adjustment folded INTO the D4 expert
//       BEFORE the blend (OQ-2), not a second uncoordinated pass.
//   (e) registrySignal = 1 / (canonicalRegistryRank(reach_id) + 1) -- the reach's
//       FIXED canonical REACH_IDS position (WR-01: the IDENTICAL definition
//       deriveExpertLosses uses at training time), NOT the fired array's own
//       turn-relative index. The two were previously different features
//       sharing one name: the live blend rewarded "first among whatever fired
//       this turn" while the training fold rewarded "front of the fixed
//       6-reach registry," so the Hedge layer was learning a weight for a
//       signal it never actually applied. `index` is still threaded through
//       for (h)'s stable tie-break, just no longer for the registry signal.
//   (f) weights = readHedgeWeights(db, roomState).
//   (g) combined = w.d4_blend * d4Adjusted + w.registry_order * registrySignal.
//   (h) STABLE sort descending: ties preserve original fired order (determinism).
//   (j) any unexpected throw returns the ORIGINAL input array (hot-path soft-fail).
//
// Former step (i), REMOVED (quick task 260728-8av, RCA hedge-fold-has-no-
// production-trigger). This function used to fire-and-forget
// maybeUpdateHedgeWeights here whenever db was present and the caller had not
// opted into read-only mode. That trigger never once fired in production:
// ctx.roomDb is threaded into decide() from exactly one place repo-wide (a
// test), so db was always null on every shipped surface. Deleting it is a
// proven no-op on every shipped surface (see the RCA's Evidence section), not
// a behavior change. The fold itself, maybeUpdateHedgeWeights, is unchanged and
// still exported; its only caller now is the explicit navigator-triggered
// scripts/hedge-refit-pipeline.cjs.
//
// OPT-IN READ-ONLY MODE (roomState.readOnly, quick 260728-7kc). Default OFF, so
// every existing caller is byte-unchanged; same shape as Phase 233-03's skipRebuild
// precedent on runDeriveBackfill. It exists because a caller that declares itself a
// pure read (the suggest_next / reach_candidates MCP pull tools) must not inherit a
// write through a shared dependency: handing out a write-capable db handle is the
// same act as writing. Since quick task 260728-8av removed step (i) entirely, the
// ranking call no longer folds in ANY mode, readOnly no longer suppresses a fold
// because there is no fold left here to suppress. readOnly now governs exactly one
// thing: it routes the Req 7 degrade token to roomState.degradeSink instead of a
// memory_event write (see emitUnavailable above). Steps (b) through (h) are
// IDENTICAL in both modes, so the pick never changes: the mode removes writes
// only. The caller is expected to supply a ?mode=ro handle as well, which makes
// the guarantee mechanical rather than a promise.
// ---------------------------------------------------------------------------
function rankFiredCandidates(sensorReaches, roomState) {
  if (!Array.isArray(sensorReaches) || sensorReaches.length <= 1) {
    return sensorReaches; // (a) byte-identical 0/1 passthrough
  }
  try {
    const rs = roomState || {};
    const reachScores = (rs.reachScores && typeof rs.reachScores === 'object')
      ? rs.reachScores
      : cortexReachAdapter.buildReachScoresFromCortex(rs.cortexNodes || []); // (b)
    const db = rs.db || null;
    const weights = readHedgeWeights(db, rs); // (f)
    const wD4 = Number.isFinite(Number(weights.d4_blend)) ? Number(weights.d4_blend) : 0;
    const wReg = Number.isFinite(Number(weights.registry_order)) ? Number(weights.registry_order) : 0;

    const decorated = sensorReaches.map(function (reach, index) {
      const reachId = reach && reach.reach_id;
      let cp = 0;
      try {
        cp = reachRejectReader.countPenalty(db, reachId, rs); // (d) composed 158 discount
      } catch (_e) {
        cp = 0;
      }
      if (!Number.isFinite(cp)) cp = 0;
      const d4Adjusted = d4For(reachId, reachScores) * (1 - cp);
      const registrySignal = 1 / (canonicalRegistryRank(reachId) + 1); // (e) WR-01
      const combined = wD4 * d4Adjusted + wReg * registrySignal; // (g)
      return { reach: reach, index: index, combined: combined };
    });

    decorated.sort(function (a, b) {
      if (b.combined !== a.combined) return b.combined - a.combined;
      return a.index - b.index; // (h) stable: ties keep original fired order
    });

    const ordered = decorated.map(function (d) { return d.reach; });

    return ordered;
  } catch (_e) {
    return sensorReaches; // (j) hot-path soft-fail to the original input
  }
}

module.exports = {
  rankFiredCandidates: rankFiredCandidates,
  readHedgeWeights: readHedgeWeights,
  maybeUpdateHedgeWeights: maybeUpdateHedgeWeights,
  hedgeUpdate: hedgeUpdate,
  deriveExpertLosses: deriveExpertLosses,
  canonicalRegistryRank: canonicalRegistryRank,
  EXPERT_IDS: EXPERT_IDS,
  REACH_IDS: REACH_IDS,
  HEDGE_UPDATE_N_DEFAULT: HEDGE_UPDATE_N_DEFAULT,
  HEDGE_ETA_DEFAULT: HEDGE_ETA_DEFAULT,
};
