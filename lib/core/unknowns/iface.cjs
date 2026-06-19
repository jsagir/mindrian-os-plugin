'use strict';
/*
 * Phase 165-01 -- iface: THE single shared instance/partition/checkpoint/config
 * contract (the recast) for the unknown-unknowns blind-spot engine. This is the
 * ONE recast contract every downstream unknowns module imports (corpus-adapter,
 * pattern-miner, dsp, bandit, rumsfeld-matrix, orchestrator, proxy oracle). No
 * downstream executor invents its own instance shape; they all read it here.
 *
 * Harness-as-code property 5 (one shared IFACE) + property 3 (contracts-on-disk):
 * this module freezes the signatures Plans 02-06 cite. It is a PURE constants /
 * contract module -- zero I/O, zero require of navigation.cjs, zero require of
 * Brain, zero Math.random, zero Date.now. The live frozen-edge-set assertion is
 * DELEGATED to the engine modules that already require navigation/edges.cjs (the
 * orchestrator / the edge-writer); see FROZEN_ENGINE_EDGES below for why this
 * module re-exports the names without performing the runtime ALLOWED_EDGE_TYPES
 * membership check (a pure contract module must not require the navigation tree).
 *
 * Canon Part 8 (LOCAL-only / Part-8 boundary): every value here is an enum handle
 * or a numeric scalar. NO venture prose, NO user content, NO Brain require. A leak
 * of realistic venture text into this contract would breach Part 8; the Wave-0
 * part8-boundary stub sweeps lib/core/unknowns/* for forbidden substrings once the
 * engine modules land.
 *
 * Canon Part 9: findings the engine proposes land review_status 'proposed'; only a
 * human confirms (the humanConfirmBudget in DEFAULT_CONFIG.proxy is the scarce
 * per-session budget spent at the F.1 gate).
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE). CJS, no new deps.
 *
 * Sources: 165-RESEARCH.md section 1.1 (reference config), 1.4 (the instance
 * feature schema + the NUMERIC vs CATEGORICAL split + the two distinct tier maps),
 * 1.6 (the checkpoint shape), section 2 (the proxy block).
 */

// ---------------------------------------------------------------------------
// (1) INSTANCE_FEATURES -- the frozen ordered instance-feature schema (the recast)
//
//   instance := { claimId, section, domain, evidenceTier, confidence,
//                 governingHash, ageDays }   (165-RESEARCH section 1.4)
//
// Each feature is tagged NUMERIC or CATEGORICAL so the DSP inter-partition
// distance (section 1.4) knows how to compute the per-feature distance:
//   - NUMERIC features use normalized absolute difference |a-b| / corpusRange.
//   - CATEGORICAL features use Hamming / mismatch distance (0 equal, 1 different).
//
// claimId is the IDENTITY key (not a distance dimension); it carries kind
// 'identity'. evidenceTier is CATEGORICAL on the node but maps to a NUMERIC value
// via TIER_NUMERIC for the quartile-bucketed distance dimension, so it is tagged
// NUMERIC here with a `via: 'TIER_NUMERIC'` note. confidence and ageDays are plain
// NUMERIC scalars. section and domain are CATEGORICAL enum-like handles (Part 8:
// enum handles, never prose). governingHash is an identity/provenance handle used
// for the staleness seam, not a distance dimension.
//
// Frozen ORDERED array so downstream iteration order is stable (determinism,
// D-165-09). The array order IS the feature-vector order for centroid math.
// ---------------------------------------------------------------------------
const INSTANCE_FEATURES = Object.freeze([
  Object.freeze({ name: 'claimId', kind: 'identity' }),
  Object.freeze({ name: 'section', kind: 'CATEGORICAL' }),
  Object.freeze({ name: 'domain', kind: 'CATEGORICAL' }),
  Object.freeze({ name: 'evidenceTier', kind: 'NUMERIC', via: 'TIER_NUMERIC' }),
  Object.freeze({ name: 'confidence', kind: 'NUMERIC' }),
  Object.freeze({ name: 'governingHash', kind: 'identity' }),
  Object.freeze({ name: 'ageDays', kind: 'NUMERIC' }),
]);

// ---------------------------------------------------------------------------
// (2a) TIER_NUMERIC -- the quartile-bucketed evidence-tier map used by the DSP
// NUMERIC feature distance (165-RESEARCH section 1.4): Academic=4, Operational=3,
// Practitioner=2, None=1. This is the ORDINAL rank for the feature-distance
// dimension, NOT the proxy tier floor below. Naming them distinctly is deliberate
// so a downstream module never conflates the two (section 1.4 vs section 2.1b).
// ---------------------------------------------------------------------------
const TIER_NUMERIC = Object.freeze({
  Academic: 4,
  Operational: 3,
  Practitioner: 2,
  None: 1,
});

// ---------------------------------------------------------------------------
// (2b) TIER_FLOOR -- the proxy tier-mismatch scalar floor (165-RESEARCH section
// 2.1b): Academic=1.0, Operational=0.75, Practitioner=0.4, None=0.1. Used ONLY by
// the proxy oracle's tier-vs-confidence mismatch scalar
// (tierMismatch = max(0, confidence - TIER_FLOOR[evidenceTier])). This is a
// DIFFERENT map from TIER_NUMERIC above; they must not be conflated.
// ---------------------------------------------------------------------------
const TIER_FLOOR = Object.freeze({
  Academic: 1.0,
  Operational: 0.75,
  Practitioner: 0.4,
  None: 0.1,
});

// ---------------------------------------------------------------------------
// (3) DEFAULT_CONFIG -- the reference defaults (165-RESEARCH section 1.1)
// reconciled with the LOCKED Claude-discretion values (section 2.2 / 2.3):
//   confidenceThreshold 0.65, budget 0.2, gamma 0.2,
//   dspWeights { l1..4: 1, l5: 0.1 }, minSupport 0.1, maxPatternLength 3,
//   proxy { w_contra 0.5, w_mismatch 0.3, w_stale 0.2, proxyThreshold 0.5,
//           proxyCost 0.0, humanConfirmBudget 3, staleWindowDays 30 }.
//
// The proxy block is the D-165-01 hybrid-oracle config: the three LOCAL-scalar
// weights blend to proxyScore, thresholded at proxyThreshold; proxyCost is 0.0 so
// the bandit probes widely on the cheap proxy (the gamma cost-tradeoff bites only
// at the human tier); humanConfirmBudget 3 mirrors MAX_K=3 top-of-selector
// discipline (a nudge, not a dump). staleWindowDays 30 mirrors the findStaleClaims
// 30-day window (insights.cjs DEFAULT_STALE_WINDOW_DAYS).
// ---------------------------------------------------------------------------
const DEFAULT_CONFIG = Object.freeze({
  confidenceThreshold: 0.65,
  budget: 0.2,
  gamma: 0.2,
  dspWeights: Object.freeze({ l1: 1, l2: 1, l3: 1, l4: 1, l5: 0.1 }),
  minSupport: 0.1,
  maxPatternLength: 3,
  proxy: Object.freeze({
    w_contra: 0.5,
    w_mismatch: 0.3,
    w_stale: 0.2,
    proxyThreshold: 0.5,
    proxyCost: 0.0,
    humanConfirmBudget: 3,
    staleWindowDays: 30,
  }),
});

// ---------------------------------------------------------------------------
// (4) CHECKPOINT_SHAPE -- the documented per-pull resumable checkpoint shape
// (165-RESEARCH section 1.6). The bandit writes this LOCAL JSON sidecar after each
// pull so a scan killed mid-meeting-analysis resumes from the last arm. On resume:
// if corpusHash matches, continue from pull; if it differs (a new meeting filed
// claims so the corpus went dirty), START A FRESH scan. No Date.now in the
// checkpoint key (deterministic; scanId keys it so a Workflow re-run is a cache
// hit). This is a CONTRACT description (a documented field map), not a live
// instance -- the bandit module constructs and validates against it.
//
// @typedef {Object} UnknownsCheckpoint
// @property {string}  scanId           Stable id over (roomDir, corpusHash); keys the sidecar.
// @property {string}  corpusHash       sha256 over the sorted confident-claim node ids (dirty-corpus detect).
// @property {number}  pull             Monotone pull counter.
// @property {number}  budget           floor(N * config.budget) -- the bounded probe budget.
// @property {Array}   arms             Per-partition arm state (see CHECKPOINT_ARM_SHAPE).
// @property {number}  cumulativeUtility Running sum of per-pull utility (Eq.1).
// @property {boolean} done             True when the budget is spent or the space is covered.
//
// @typedef {Object} UnknownsCheckpointArm
// @property {string}   partitionId        Stable pattern-hash id of the partition (the arm).
// @property {number}   effectiveCount     Discounted pull count (UCB-with-discount, Eq.3).
// @property {number}   discountedMean     Running discounted mean reward for the arm.
// @property {number}   currentArmSize     Remaining unprobed instances in the arm now.
// @property {number}   sizeAtPull         Arm size captured at the pull (the Eq.3 discount ratio numerator base).
// @property {string[]} probedInstanceIds  Stable-sorted claimIds already probed (resume cursor).
// ---------------------------------------------------------------------------
const CHECKPOINT_SHAPE = Object.freeze({
  scanId: 'string',
  corpusHash: 'string',
  pull: 'number',
  budget: 'number',
  arms: 'array',
  cumulativeUtility: 'number',
  done: 'boolean',
});

const CHECKPOINT_ARM_SHAPE = Object.freeze({
  partitionId: 'string',
  effectiveCount: 'number',
  discountedMean: 'number',
  currentArmSize: 'number',
  sizeAtPull: 'number',
  probedInstanceIds: 'array',
});

// ---------------------------------------------------------------------------
// (5) FROZEN_ENGINE_EDGES -- the four frozen typed-edge types the engine emits
// (D-165-08, remap-only; mirrors issue-tree.cjs:49). 165 mints NO new edge type;
// all four are confirmed FROZEN members of ALLOWED_EDGE_TYPES in
// lib/core/navigation/edges.cjs:
//   INVALIDATES (a human-confirmed blind spot kills the claim),
//   ROOT_CAUSES (the confirmed root cause of why-it-is-wrong),
//   ENABLES     (a corrected belief unblocks an opportunity-bank seed),
//   FEEDS_INTO  (the up/down chain-topology declaration).
//
// DELEGATION (why iface does NOT assert ALLOWED_EDGE_TYPES membership here): this
// module is PURE -- it must not require the navigation tree (navigation/edges.cjs
// pulls in the SQLite-adjacent surface). So iface re-exports the four names as the
// single source of truth and DELEGATES the live frozen-set assertion to the engine
// modules that ALREADY require navigation/edges.cjs (the edge-writer / the
// orchestrator), which run the issue-tree.cjs:67 module-load self-check
//   for (const t of Object.values(FROZEN_ENGINE_EDGES))
//     if (!ALLOWED_EDGE_TYPES.has(t)) throw new Error('edge ' + t + ' not frozen');
// The Wave-0 frozen-edges test asserts BOTH: (a) iface exports exactly these four,
// and (b) the engine edge-writer performs the live membership check against the
// real ALLOWED_EDGE_TYPES. Documenting the delegation here is the contract the
// frozen-edges stub reads to know where the live assertion lives.
// ---------------------------------------------------------------------------
const FROZEN_ENGINE_EDGES = Object.freeze({
  INVALIDATES: 'INVALIDATES',
  ROOT_CAUSES: 'ROOT_CAUSES',
  ENABLES: 'ENABLES',
  FEEDS_INTO: 'FEEDS_INTO',
});

module.exports = {
  INSTANCE_FEATURES,
  TIER_NUMERIC,
  TIER_FLOOR,
  DEFAULT_CONFIG,
  CHECKPOINT_SHAPE,
  CHECKPOINT_ARM_SHAPE,
  FROZEN_ENGINE_EDGES,
};
