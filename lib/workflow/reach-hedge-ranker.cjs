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
// Phase 245-07 (D-20, Requirement 4): the doctrine tie-break key. Invariant 1
// above (chokepoint-only db access) is respected by construction -- this module
// is a frozen in-repo literal plus an array index lookup, with zero I/O, zero
// network and zero user bytes. See its file header for the three placement
// rules that decide the ordering.
const sensorPriority = require('../core/sensors/sensor-priority.cjs');

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

// ===========================================================================
// Phase 245-07 Task 2 -- the buildSignalNudges fusion constants (Requirement 1,
// D-01 as corrected by F-1, D-05, D-24, D-25, and the navigator-resolved Open
// Question A3). Each carries the same TUNABLE-LATER rationale discipline as the
// Hedge tunables above.
// ===========================================================================

// FUSION_CEILING (0.69) -- the asymptote every fused score approaches and never
// reaches. This constant IS D-05's demanded explicit bound, and it is the
// navigator-resolved Open Question A3 made STRUCTURAL rather than advisory:
// A3 was resolved in favor of bounding the nudge below the frozen RECOMMENDED
// floor rather than accepting a crossing, so the fusion changes WHICH reach
// ranks first and never promotes a reach to RECOMMENDED on its own. 0.69 is
// deliberately STRICTLY below dial-reach-orchestrator.cjs's frozen
// RECOMMEND_FLOOR of 0.70 (that module is NOT imported here; this module's
// decoupling from the orchestrator, file header line 47, holds). Because the
// fusion is an interpolation TOWARD this ceiling rather than an addition, the
// cortex-reach-adapter CONTRIBUTIONS table's house invariant -- "a single signal
// escalates the one-move but never solo-crosses the marker floor" -- survives
// unchanged. Exported so tests and 245-08 can assert against it rather than
// against a hand-typed 0.69. TUNABLE-LATER only in lockstep with the frozen
// gate: raising it to or above RECOMMEND_FLOOR is a Canon Part 3 change, not a
// tuning decision.
const FUSION_CEILING = 0.69;

// DEFAULT_FUSION_BASE (0.5) -- the base used for a reach_id ABSENT from the
// supplied score map. It is the SAME flat 0.5 registry floor d4For already uses
// in this module, so no orchestrator import is needed.
// WHY THIS MATTERS, concretely: dial-reach-orchestrator's _resolveReachScore
// gives an ABSENT non-registry-only reach a base of 0 and gives the
// registry_only cross_room reach 0.5. Nudging up from 0 could not out-rank
// cross_room's 0.5 default (0 + 0.60 * 0.69 = 0.414 < 0.5), so the dial would
// never reorder and Requirement 1 would ship a fusion that moves nothing.
// Starting from the same 0.5 floor puts an absent-but-fired reach at 0.614,
// which does out-rank it.
const DEFAULT_FUSION_BASE = 0.5;

// SENSOR_TOP_FRACTION (0.60) -- the HEADROOM fraction granted to the reach_id of
// the TOP-ranked fired reach, i.e. index 0 of the array rankFiredCandidates
// returned, so Task 1's SENS_PRIORITY tie-break feeds this term directly. It is
// a fraction of the remaining distance to FUSION_CEILING, never an additive
// score, which is what makes the bound structural. Env override
// MINDRIAN_SENSOR_TOP_FRACTION. TUNABLE-LATER from dial-outcome telemetry.
const SENSOR_TOP_FRACTION = 0.60;

// SENSOR_OTHER_FRACTION (0.25) -- the headroom fraction granted to every OTHER
// DISTINCT fired reach_id. Under half the top fraction on purpose: a co-fired
// reach is evidence, but the ranked winner is the one the shared selection layer
// actually chose. Deliberately NOT env-overridable: the two tunables the plan
// exposes are the ones that set the CLASS of the sensor and Brain terms, and a
// third knob whose only job is to sit between them invites an inverted
// configuration (other > top) with no legitimate use.
const SENSOR_OTHER_FRACTION = 0.25;

// BRAIN_VERB_FRACTION (0.35) -- the headroom fraction granted to the reach_ids
// that verbReachAffinity(brainVerb) names, MULTIPLIED by that entry's per-reach
// weight. The multiply is load-bearing, not decoration: 'Run Methodology' (the
// most common verb in the vocabulary) returns a TWO-entry 0.5/0.5 split across
// context_block and brain_consult, so an ambiguous verb splits its fraction
// instead of double-counting it onto both reaches at full strength (245-04
// carry-forward 2). Sits below SENSOR_TOP_FRACTION because a fired sensor is a
// this-turn observation while the Brain verb is a session-derived suggestion.
// Env override MINDRIAN_BRAIN_VERB_FRACTION. TUNABLE-LATER.
const BRAIN_VERB_FRACTION = 0.35;

// NUDGE_FRACTION_CAP (0.95) -- the cap on the SUMMED fraction for any single
// reach, so the maximum-stacked case (top sensor 0.60 plus a full-weight Brain
// verb 0.35 on the same reach = 0.95) still leaves headroom below the ceiling.
// Because the cap is strictly < 1, base + fraction * (CEILING - base) is
// STRICTLY below CEILING for every finite base, which is what makes the A3 bound
// a structural property of the formula rather than a clamp that would let a
// large enough input land exactly ON the ceiling and tie there.
const NUDGE_FRACTION_CAP = 0.95;

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

// fractionFromEnv(name, fallback) -- the Phase 245-07 fusion tunables' reader,
// the same defensive numeric-fallback shape as updateN / updateEta above, and
// read at CALL time rather than at module load so an operator setting the var
// does not have to restart a long-lived process (and so the env-safety arm of
// tests/test-245-nudge-bound.cjs can actually exercise it). Anything unset,
// empty, non-numeric, non-finite, non-positive, or greater than 1 silently falls
// back: a fraction outside (0, 1] is meaningless here, because the fusion
// interpolates a FRACTION of the headroom to FUSION_CEILING, and a value above 1
// would overshoot the ceiling the bound exists to protect.
function fractionFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
  const n = Number(String(raw).trim());
  if (Number.isFinite(n) && n > 0 && n <= 1) return n;
  return fallback;
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
//   (h) THREE-LEVEL sort (Phase 245-07, D-20, Requirement 4):
//         primary   -- combined descending (unchanged),
//         secondary -- sensorPriorityRank(evidence.sensor_id) ascending,
//         tertiary  -- a.index - b.index, the original stable-order fallback.
//   (h2) SENS_PRIORITY is the DOCTRINE tie-break (lib/core/sensors/
//        sensor-priority.cjs; its header carries the three placement rules that
//        decide the ordering: Canon Part 11 R3 tier precedence, then evidence
//        durability within a tier, then canonical registry order). It REPLACES
//        file-registration order as the deciding rule on a same-reach_id
//        collision, which is Requirement 4's whole substance. Every scoring
//        term this function has (d4For, canonicalRegistryRank, countPenalty) is
//        keyed on reach_id, never on the individual sensor, so two sensors that
//        fire the SAME reach_id produce the IDENTICAL combined score and the
//        comparator used to fall all the way through to `a.index - b.index`,
//        i.e. SENSOR_REGISTRY file order. "Which sensor's payload wins" was
//        therefore decided by whoever edited the registry array last.
//        sensorPriorityRank returns the WORST FINITE rank for a null or unknown
//        id, so an unstamped reach sorts last among its tied set rather than
//        throwing or poisoning the comparator with NaN. The tertiary fallback is
//        deliberately RETAINED, not deleted: two reaches carrying the SAME
//        priority rank (the same sensor firing twice, or two unstamped reaches)
//        still resolve deterministically.
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
      // (h2) the doctrine tie-break key. dispatchSensors stamps evidence.sensor_id
      // centrally from the frozen SENSOR_REGISTRY_IDS array (245-01), so a sensor
      // can never write its own priority key (threat T-245-30). An absent or
      // non-string stamp becomes null and sensorPriorityRank hands back the worst
      // finite rank.
      const sensorId = (reach && reach.evidence && typeof reach.evidence.sensor_id === 'string')
        ? reach.evidence.sensor_id
        : null;
      return {
        reach: reach,
        index: index,
        combined: combined,
        priorityRank: sensorPriority.sensorPriorityRank(sensorId),
      };
    });

    decorated.sort(function (a, b) {
      if (b.combined !== a.combined) return b.combined - a.combined; // (h) primary
      if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank; // (h2) doctrine
      return a.index - b.index; // (h) stable: same-rank ties keep original fired order
    });

    const ordered = decorated.map(function (d) { return d.reach; });

    return ordered;
  } catch (_e) {
    return sensorReaches; // (j) hot-path soft-fail to the original input
  }
}

// ---------------------------------------------------------------------------
// buildSignalNudges({ baseScores, sensorReaches, brainVerb, tierMode })
//   -> { reach_id: fusedAbsoluteScore }   (ONLY the reaches that got a nudge)
//
// Phase 245-07 Task 2. Requirement 1's fusion math, living in the ONE shared
// scored-selection layer (D-01's Canon Part 7 intent: one selection brain, no
// second one minted at the callsite) while being a SEPARATE export from
// rankFiredCandidates so it has a consumer that can actually reach the dial.
//
// WHY IT IS A SEPARATE EXPORT AND NOT FOLDED INTO rankFiredCandidates' local
// `combined`. 245-RESEARCH.md F-1 enumerated every call site of both functions
// and found rankFiredCandidates and buildReachList are SIBLING consumers of the
// same buildReachScoresFromCortex output: the ranker reads reachScores
// read-only, returns a reordered ARRAY, never writes back to the map, and
// nothing downstream of it reaches buildReachList. A fusion confined to the
// ranker's internals passes every unit test and moves the dial by exactly
// nothing (Pitfall 1, "the single most likely way this phase ships a false
// success"). So the MATH lives here and 245-08 merges its output at the render
// callsite. rankFiredCandidates' return contract is UNCHANGED.
//
// THE FUSION, per reach_id:
//   1. fraction = SENSOR_TOP_FRACTION if this is the top fired reach's id,
//      + SENSOR_OTHER_FRACTION if it is any OTHER distinct fired reach's id,
//      + BRAIN_VERB_FRACTION * affinityWeight when the Brain-verb affinity names
//      it. Summed, then clamped to NUDGE_FRACTION_CAP.
//   2. base = baseScores[reachId] when finite (clamped 0..1), else
//      DEFAULT_FUSION_BASE.
//   3. base >= FUSION_CEILING -> emit base UNCHANGED. The fusion must never lift
//      a reach already at or above the ceiling, so it can neither create a
//      RECOMMENDED marker nor inflate an existing one.
//   4. otherwise emit base + fraction * (FUSION_CEILING - base). Since
//      fraction <= 0.95 < 1, the result is STRICTLY below FUSION_CEILING for
//      every finite base (the A3 bound, structural rather than a clamp), and it
//      is strictly monotone in BOTH base and fraction, so two reaches with
//      different bases or different fractions never collide at one fused value.
//
// A same-reach_id collision counts ONCE, at the higher of the two sensor
// fractions. Twelve sensors can fire context_block on one turn (D-19); letting
// each co-firing sensor stack another SENSOR_OTHER_FRACTION would inflate that
// one reach purely by how many sensors happen to be registered against it,
// which is the same "registration order decides" accident Requirement 4 exists
// to kill, wearing different clothes.
//
// TIER POLICY (stated here because it is a Canon Part 3 consequence, not a
// preference): the Brain-verb term applies ONLY when tierMode === 'mode_a'.
// mode_b is local-only and tier_0 is the Brain-absent fallback, so a
// Brain-derived nudge has no standing in either. The SENSOR terms apply in EVERY
// tier, matching resolveFireSkill step 2's "any tier" behavior.
//
// HARD INVARIANTS:
//   - Absent signal is a byte-identical no-op. An empty or non-array
//     sensorReaches AND a null brainVerb returns {}, so an unfused render stays
//     byte-identical (the shipped Phase 158-03 reject-discount precedent, and
//     what keeps tests/test-158-reach-byte-stable.cjs green).
//   - reach_id membership. Only ids in this module's frozen local REACH_IDS list
//     may appear as keys; an off-enum id on a reach or in an affinity entry is
//     IGNORED, never emitted. Same discipline cortex-reach-adapter uses against
//     threat T-150.8-14: key on enum membership, never on prose (T-245-28).
//   - Purity. No db, no fs, no network, no Brain call, no mutation of any
//     argument. Safe to call from a db-free render seam.
//   - Soft-fail. Any unexpected throw returns {}, so an UNFUSED render (today's
//     behavior) is the degraded state (T-245-31).
//
// The Brain verb reaches this function ONLY as 245-05's
// trace.brain_pattern_verb, always a frozen CANONICAL_VERBS member, and it is
// routed through verbReachAffinity to obtain reach_ids. It is never compared
// against fire_skill: on the sensor-fired path fire_skill is a SKILL FAMILY slug
// while brain_pattern_verb is a canonical verb (245-05 carry-forward 3), so an
// equality test between them is meaningless. A null affinity return means
// "contribute NO verb term this turn", never "contribute zero to every reach"
// (245-04 carry-forward 1); 5 of the 10 canonical verbs return null by design.
// ---------------------------------------------------------------------------
function buildSignalNudges(input) {
  try {
    const inp = (input && typeof input === 'object') ? input : {};
    const baseScores = (inp.baseScores && typeof inp.baseScores === 'object') ? inp.baseScores : {};
    const sensorReaches = Array.isArray(inp.sensorReaches) ? inp.sensorReaches : [];
    const brainVerb = (typeof inp.brainVerb === 'string' && inp.brainVerb.trim() !== '')
      ? inp.brainVerb : null;
    const tierMode = inp.tierMode;

    const fractions = {};
    function addFraction(reachId, amount) {
      if (typeof reachId !== 'string') return;
      if (REACH_IDS.indexOf(reachId) === -1) return; // enum membership only (T-245-28)
      if (!(typeof amount === 'number' && Number.isFinite(amount) && amount > 0)) return;
      fractions[reachId] = (fractions[reachId] || 0) + amount;
    }

    // ---- the SENSOR terms (every tier) ----
    const topFraction = fractionFromEnv('MINDRIAN_SENSOR_TOP_FRACTION', SENSOR_TOP_FRACTION);
    let topReachId = null;
    const countedSensorIds = [];
    for (let i = 0; i < sensorReaches.length; i += 1) {
      const r = sensorReaches[i];
      const reachId = (r && typeof r.reach_id === 'string') ? r.reach_id : null;
      if (reachId === null) continue;
      if (topReachId === null) {
        // Index 0 of the array rankFiredCandidates returned: the scored winner,
        // with Task 1's SENS_PRIORITY tie-break already applied.
        topReachId = reachId;
        addFraction(reachId, topFraction);
        countedSensorIds.push(reachId);
        continue;
      }
      if (reachId === topReachId) continue;                 // already counted at TOP
      if (countedSensorIds.indexOf(reachId) !== -1) continue; // counted once, not per collider
      addFraction(reachId, SENSOR_OTHER_FRACTION);
      countedSensorIds.push(reachId);
    }

    // ---- the BRAIN-VERB term (mode_a only, Canon Part 3) ----
    if (tierMode === 'mode_a' && brainVerb !== null) {
      let affinity = null;
      try {
        // Lazily required so a missing or broken affinity module degrades the
        // Brain term to nothing instead of breaking the sensor term (and instead
        // of breaking this whole module at load time). node caches the module, so
        // repeat calls cost a cache lookup.
        affinity = require('../core/verb-reach-affinity.cjs').verbReachAffinity(brainVerb);
      } catch (_e) {
        affinity = null;
      }
      if (affinity && typeof affinity === 'object') {
        const verbFraction = fractionFromEnv('MINDRIAN_BRAIN_VERB_FRACTION', BRAIN_VERB_FRACTION);
        for (const reachId of Object.keys(affinity)) {
          const w = Number(affinity[reachId]);
          if (!Number.isFinite(w) || !(w > 0)) continue;
          addFraction(reachId, verbFraction * w);
        }
      }
    }

    // ---- the bounded fusion ----
    const out = {};
    for (const reachId of Object.keys(fractions)) {
      let fraction = fractions[reachId];
      if (!Number.isFinite(fraction) || !(fraction > 0)) continue;
      if (fraction > NUDGE_FRACTION_CAP) fraction = NUDGE_FRACTION_CAP;
      const supplied = baseScores[reachId];
      const base = (typeof supplied === 'number' && Number.isFinite(supplied))
        ? clamp01(supplied)
        : DEFAULT_FUSION_BASE;
      if (base >= FUSION_CEILING) {
        out[reachId] = base; // never lift an already-at-or-above-ceiling reach
        continue;
      }
      out[reachId] = base + fraction * (FUSION_CEILING - base);
    }
    return out;
  } catch (_e) {
    return {}; // soft-fail: an UNFUSED render is the degraded state
  }
}

module.exports = {
  rankFiredCandidates: rankFiredCandidates,
  // Phase 245-07 Task 2 (Requirement 1): the bounded three-input fusion and the
  // A3 bound it is built on. Exported for 245-08's render-callsite merge.
  buildSignalNudges: buildSignalNudges,
  FUSION_CEILING: FUSION_CEILING,
  readHedgeWeights: readHedgeWeights,
  maybeUpdateHedgeWeights: maybeUpdateHedgeWeights,
  hedgeUpdate: hedgeUpdate,
  deriveExpertLosses: deriveExpertLosses,
  canonicalRegistryRank: canonicalRegistryRank,
  EXPERT_IDS: EXPERT_IDS,
  REACH_IDS: REACH_IDS,
  HEDGE_UPDATE_N_DEFAULT: HEDGE_UPDATE_N_DEFAULT,
  HEDGE_ETA_DEFAULT: HEDGE_ETA_DEFAULT,
  // The remaining fusion constants, exported so the bound sweep in
  // tests/test-245-nudge-bound.cjs reads the SHIPPED numbers rather than
  // hand-typing a second copy of them (the Phase 185 no-parallel-
  // reimplementation rule).
  DEFAULT_FUSION_BASE: DEFAULT_FUSION_BASE,
  SENSOR_TOP_FRACTION: SENSOR_TOP_FRACTION,
  SENSOR_OTHER_FRACTION: SENSOR_OTHER_FRACTION,
  BRAIN_VERB_FRACTION: BRAIN_VERB_FRACTION,
  NUDGE_FRACTION_CAP: NUDGE_FRACTION_CAP,
};
