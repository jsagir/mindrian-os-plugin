'use strict';
// ========================================
// MINDRIAN UNKNOWN-UNKNOWNS ORCHESTRATOR (Phase 165 Wave 5)
// The pipeline that sequences the deterministic engine and HALTS at the F.1
// Decision Gate (orchestrator-in-loop; harness-as-code property 9).
//
// discoverUnknownUnknowns({roomDir, db, config, now, priorityFn}) runs the full
// stage set over the LOCAL graded-confirmed corpus, cloning the issue-tree.cjs
// single-build discipline (PURE single-call sequencing; NOT the 56KB futures
// async shell):
//
//   findConfidentClaims (corpus-adapter, the D-165-03 graded-confirmed UNION)
//     -> minePatterns (pattern-miner, support-bounded descriptive patterns)
//     -> partition (dsp, Algorithm 1 + REAL interPartition distance)
//     -> initialize + selectNextInstance (bandit, UCB-with-discount, proxy-driven,
//          budget = floor(N * config.budget), per-pull checkpoint to the LOCAL
//          sidecar <roomDir>/.mindrian/uu-scan.json, corpusHash-guarded resume)
//     -> categorizeAndRoute (rumsfeld-matrix, KK/KU/UK/UU + frozen FEEDS_INTO route)
//     -> writeFindings (edge-writer, clone candidateToFinding -> PROPOSED node +
//          frozen cascade edge via the navigation chokepoint)
//     -> rankIntoSelector (f-selector-ranker rank-in; top-N humanConfirmBudget)
//
// THE HALT (D-165-06 / Part 9 role 5 / harness property 9): the engine writes
// PROPOSED only. It NEVER calls navigation.confirmNode and NEVER invokes a
// downstream command. APPROVE at the F.1 gate (a human byUser) is what promotes a
// proposed blind spot to confirmed; the human-confirm budget (default 3) is spent
// at the gate, NOT here. The orchestrator surfaces the top-N ranked candidates and
// STOPS. corpusSize is surfaced so a thin corpus is visible at the gate.
//
// THE ARM PRIORITY (open-question 1 / port-change #5): the bandit uses the LOCAL
// proxy-score arm priority as the v1 default (the partition meanConfidence proxy
// the bandit already defaults to, or a caller-supplied LOCAL priorityFn). HSI
// enrichment is an OPTIONAL cached read OUTSIDE the bandit tight loop (Part-8
// clean); we do NOT add a Brain/Pinecone call inside the loop.
//
// THE CHECKPOINT (D-165-09): per-pull the bandit checkpoint is persisted to the
// LOCAL room sidecar <roomDir>/.mindrian/uu-scan.json (the last-cascade.json
// side-channel idiom). On resume a matching corpusHash continues byte-identically;
// a mismatch starts fresh. No Date.now in the scan key (deterministic via the
// corpusHash + the injected now seam).
//
// Canon Part 8 / D-165-10: zero Brain require; all node/edge writes via the
// navigation chokepoint (writeClaimNode / writeEdge through edge-writer); zero
// raw INSERT INTO; the corpus + proxy reads are LOCAL room.db only. Mirrors the
// issue-tree.cjs purity model. NO Math.random (the bandit is index-deterministic).
// NO em-dashes (CLAUDE.md HARD RULE); CJS; no new deps.
//
// Sources: reference/unknown-unknowns-horvitz/README.md (discoverUnknownUnknowns
// stage order), 165-RESEARCH.md sections 1.6 (checkpoint sidecar), 4.1 + 7.4 (the
// gate sequence + the rank-in), the engine modules (corpus-adapter, pattern-miner,
// dsp, bandit, rumsfeld-matrix, edge-writer), lib/core/issue-tree.cjs (the
// single-build discipline), lib/workflow/f-selector-ranker.cjs (rankForSelector,
// MAX_K=3), lib/core/sensors/sensor-types.cjs (makeReach).
// ========================================

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { DEFAULT_CONFIG, FROZEN_ENGINE_EDGES } = require('./iface.cjs');
const corpusAdapter = require('./corpus-adapter.cjs');
const patternMiner = require('./pattern-miner.cjs');
const dsp = require('./dsp.cjs');
const bandit = require('./bandit.cjs');
const rumsfeld = require('./rumsfeld-matrix.cjs');
const edgeWriter = require('./edge-writer.cjs');
const { rankForSelector } = require('../../workflow/f-selector-ranker.cjs');
const { makeReach } = require('../sensors/sensor-types.cjs');

// The LOCAL checkpoint sidecar path (165-RESEARCH 1.6; the last-cascade.json idiom).
function checkpointPath(roomDir) {
  return path.join(path.resolve(String(roomDir || '.')), '.mindrian', 'uu-scan.json');
}

// corpusHash = sha256 over the id-sorted confident-claim node ids (the dirty-corpus
// detect from CHECKPOINT_SHAPE). Deterministic; no Date.now.
function computeCorpusHash(instances) {
  const ids = (Array.isArray(instances) ? instances : [])
    .map((i) => String(i.claimId))
    .slice()
    .sort();
  return crypto.createHash('sha256').update('uu-corpus|' + ids.join('|')).digest('hex');
}

// Persist the per-pull checkpoint to the LOCAL sidecar. Best-effort: a read-only or
// absent .mindrian dir degrades quietly (the scan still completes in-memory). LOCAL
// JSON only; no Brain, no network.
function persistCheckpoint(roomDir, checkpoint) {
  if (!roomDir) return;
  const file = checkpointPath(roomDir);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(checkpoint));
  } catch (_e) {
    // degrade quietly: the in-memory scan is authoritative; the sidecar is a resume aid.
  }
}

// Read the persisted checkpoint from the LOCAL sidecar (for a resume). Returns null
// when absent/unreadable so the caller starts a fresh scan.
function readCheckpoint(roomDir) {
  if (!roomDir) return null;
  const file = checkpointPath(roomDir);
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (_e) {
    return null;
  }
}

// The proxy-driven oracle the bandit pulls: a closure over (db, cfg, nowFn) that
// LABELS a probed claimId via the corpus-adapter proxyOracle (3 LOCAL scalars
// blended). LOCAL only; deterministic via the nowFn seam; zero Brain.
function makeProxyOracleFn(db, proxyCfg, nowFn) {
  return function oracleFn(claimId) {
    return corpusAdapter.proxyOracle(db, claimId, proxyCfg, nowFn);
  };
}

// Map a bandit pull record on a labeled UU instance to a producer candidate the
// edge-writer turns into a PROPOSED finding. The candidate is an INVALIDATES edge
// from a generic blind-spot observation handle to the over-confident corpus claim
// (the frozen INVALIDATES cascade: a confirmed blind spot would kill the claim).
// Enum/scalar handles only (Part 8); the reason is a short scalar, never prose.
function recordToCandidate(record) {
  const claimId = String(record.instance);
  return {
    source: 'uu:blindspot:' + claimId,
    target: claimId,
    edge_type: FROZEN_ENGINE_EDGES.INVALIDATES,
    reason: 'proxy_uu:partition=' + String(record.arm),
  };
}

// Build the FEEDS_INTO routing candidates from the rumsfeld route of a UU finding:
// the UU quadrant routes to its frozen FEEDS_INTO chain targets (challenge /
// diagnose / validate). Enum handles only. KK carries no route (the hunting ground).
function routeToCandidates(claimId, route) {
  if (!route || !Array.isArray(route.targets)) return [];
  return route.targets.map((target) => ({
    source: claimId,
    target: 'cmd:' + String(target),
    edge_type: FROZEN_ENGINE_EDGES.FEEDS_INTO,
    reason: 'route:' + String(route.quadrant),
  }));
}

// analyzeDiscoveries / generateRecommendations (the reference enum): produce the
// HIGH_RISK_PATTERN / MODEL_CONFIDENCE / EXPLORATION_NEEDED recommendation handles
// from the discovery tally. Generic enum handles + scalar counts only (Part 8).
function generateRecommendations(uuCount, corpusSize, partitionCount) {
  const recs = [];
  if (uuCount > 0) {
    recs.push({ kind: 'HIGH_RISK_PATTERN', count: uuCount });
  }
  recs.push({ kind: 'MODEL_CONFIDENCE', corpusSize: corpusSize, partitions: partitionCount });
  if (corpusSize > 0 && corpusSize < 5) {
    recs.push({ kind: 'EXPLORATION_NEEDED', corpusSize: corpusSize });
  }
  return recs;
}

/**
 * discoverUnknownUnknowns(args) -> { findings, recommendations, checkpoint, ranked,
 *   corpusSize, partitions, uuInstances, routed }
 *
 * The full pipeline. Single-call, deterministic (clone the issue-tree.cjs build
 * discipline). HALTS at the F.1 gate -- no confirmNode, no downstream command.
 *
 * @param {object} args
 * @param {string} args.roomDir   the LOCAL room dir (checkpoint sidecar home).
 * @param {object} args.db        a caller-owned room.db handle (navigation chokepoint).
 * @param {object} [args.config]  overrides DEFAULT_CONFIG (budget, gamma, proxy, ...).
 * @param {number|function} [args.now]  the deterministic now seam (staleness scalar).
 * @param {function} [args.priorityFn]  the LOCAL arm-priority fn (default proxy mean).
 */
function discoverUnknownUnknowns(args) {
  const a = (args && typeof args === 'object') ? args : {};
  const roomDir = (typeof a.roomDir === 'string') ? a.roomDir : '';
  const db = a.db || null;
  const config = Object.assign({}, DEFAULT_CONFIG, (a.config && typeof a.config === 'object') ? a.config : {});
  const proxyCfg = Object.assign({}, DEFAULT_CONFIG.proxy, (config.proxy && typeof config.proxy === 'object') ? config.proxy : {});
  const nowFn = a.now;
  const priorityFn = (typeof a.priorityFn === 'function') ? a.priorityFn : null;

  // ---- STAGE 1: corpus (the D-165-03 graded-confirmed UNION; LOCAL room.db) ----
  const instances = corpusAdapter.findConfidentClaims(db, { now: nowFn });
  const corpusSize = instances.length;
  const corpusHash = computeCorpusHash(instances);

  // Empty corpus: surface the thin-corpus recommendation and HALT (no findings).
  if (corpusSize === 0) {
    return {
      findings: { nodes: [], edges: [], written: 0, rejected: 0 },
      recommendations: generateRecommendations(0, 0, 0),
      checkpoint: null,
      ranked: [],
      corpusSize: 0,
      partitions: [],
      uuInstances: [],
      routed: {},
    };
  }

  // ---- STAGE 2: pattern-mine (support-bounded descriptive patterns) ----
  const patterns = patternMiner.minePatterns(instances, undefined, config);

  // ---- STAGE 3: DSP partition (Algorithm 1 + REAL interPartition distance) ----
  const partitions = dsp.partition(instances, undefined, patterns, config);

  // ---- STAGE 4: bandit (UCB-with-discount; proxy-driven; budget; checkpoint) ----
  // Arm priority = the LOCAL proxy-score arm priority (v1 default, open-question 1):
  // the caller-supplied LOCAL priorityFn, else the bandit's default partition
  // meanConfidence proxy. HSI enrichment is OUTSIDE this tight loop (Part-8 clean);
  // we do NOT wire a Brain/Pinecone call into the bandit.
  const oracleFn = makeProxyOracleFn(db, proxyCfg, nowFn);
  const N = instances.length;
  const budget = Math.floor(N * (typeof config.budget === 'number' ? config.budget : DEFAULT_CONFIG.budget));

  let scanResult;
  const banditCfg = {
    budget: config.budget,
    gamma: config.gamma,
    roomDir: roomDir,
    corpusHash: corpusHash,
    priorityFn: priorityFn,
  };

  // Resume from the LOCAL sidecar when a checkpoint exists and the corpusHash
  // matches (byte-identical continue); otherwise a fresh scan. Per-pull the
  // checkpoint is persisted to the LOCAL sidecar (D-165-09).
  const persisted = readCheckpoint(roomDir);
  const onCheckpoint = (cp) => persistCheckpoint(roomDir, cp);
  if (persisted && String(persisted.corpusHash) === String(corpusHash)) {
    const resumed = bandit.resumeFrom(persisted, partitions, oracleFn, corpusHash, {
      roomDir: roomDir, gamma: config.gamma, priorityFn: priorityFn, onCheckpoint: onCheckpoint,
    });
    scanResult = resumed.freshScanRequired
      ? bandit.selectNextInstance(partitions, oracleFn, banditCfg, { onCheckpoint: onCheckpoint })
      : resumed;
  } else {
    scanResult = bandit.selectNextInstance(partitions, oracleFn, banditCfg, { onCheckpoint: onCheckpoint });
  }

  const records = Array.isArray(scanResult.records) ? scanResult.records : [];
  const uuRecords = records.filter((r) => r.isUnknownUnknown);

  // ---- STAGE 5: rumsfeld categorize + FEEDS_INTO route ----
  // A proxy-labeled UU instance is categorized UU (unaware + not-well-known: the
  // blind spot) and routed to its frozen FEEDS_INTO chain (challenge/diagnose/
  // validate). The route is INTENT only (the orchestrator writes the edges).
  const routed = {};
  const uuClaimIds = [];
  for (const r of uuRecords) {
    const claimId = String(r.instance);
    if (uuClaimIds.indexOf(claimId) === -1) uuClaimIds.push(claimId);
    const route = rumsfeld.categorizeAndRoute(claimId, false, false); // UU quadrant
    routed[claimId] = route;
  }

  // ---- STAGE 6: finding-writer (clone candidateToFinding -> PROPOSED node + edge) ----
  // For each UU instance: the INVALIDATES finding (the blind spot kills the claim)
  // PLUS its FEEDS_INTO route candidates. All written PROPOSED via the chokepoint.
  const findingCandidates = [];
  for (const claimId of uuClaimIds) {
    findingCandidates.push(recordToCandidate({ instance: claimId, arm: (routed[claimId] && routed[claimId].quadrant) || 'UU' }));
    const routeCands = routeToCandidates(claimId, routed[claimId]);
    for (const rc of routeCands) findingCandidates.push(rc);
  }
  const findings = edgeWriter.writeFindings(db, findingCandidates, { sessionId: 'uu-scan' });

  // ---- STAGE 7: rank into the F.1 selector (the gate) ----
  const ranked = rankIntoSelector({
    uuClaimIds: uuClaimIds,
    records: uuRecords,
    corpusSize: corpusSize,
    partitionCount: partitions.length,
    humanConfirmBudget: proxyCfg.humanConfirmBudget,
  });

  const recommendations = generateRecommendations(uuClaimIds.length, corpusSize, partitions.length);

  // The engine HALTS here. It does NOT call navigation.confirmNode and does NOT
  // invoke a downstream command. APPROVE at the F.1 gate (human byUser) promotes.
  return {
    findings: findings,
    recommendations: recommendations,
    checkpoint: scanResult.checkpoint || null,
    ranked: ranked,
    corpusSize: corpusSize,
    partitions: partitions,
    uuInstances: uuClaimIds,
    routed: routed,
  };
}

/**
 * rankIntoSelector(args) -> { reach, items, corpusSize, topN }
 * The D-165-06 rank-in: build a candidate-reach (makeReach; reach_id context_block
 * riding the map-unknowns front door, posture hold) carrying LOCAL scalars ONLY
 * (top-N proxy ids + partition ids + corpus size -- never venture prose) and score
 * the F.1 Next-Move set via the f-selector-ranker rankForSelector (clamped at
 * MAX_K). Returns the ranked set; it does NOT call confirmNode and does NOT invoke
 * any downstream command (the human decides at the gate). corpusSize is surfaced so
 * a thin corpus is visible at the gate.
 */
function rankIntoSelector(args) {
  const a = (args && typeof args === 'object') ? args : {};
  const uuClaimIds = Array.isArray(a.uuClaimIds) ? a.uuClaimIds : [];
  const records = Array.isArray(a.records) ? a.records : [];
  const corpusSize = (typeof a.corpusSize === 'number') ? a.corpusSize : 0;
  const partitionCount = (typeof a.partitionCount === 'number') ? a.partitionCount : 0;
  const budget = (typeof a.humanConfirmBudget === 'number' && a.humanConfirmBudget > 0)
    ? a.humanConfirmBudget : DEFAULT_CONFIG.proxy.humanConfirmBudget;

  // The top-N (humanConfirmBudget) UU candidates, as GENERIC handles + LOCAL scalars.
  const topIds = uuClaimIds.slice(0, budget);
  const partitionIds = [];
  for (const r of records.slice(0, budget)) {
    const arm = String(r.arm);
    if (partitionIds.indexOf(arm) === -1) partitionIds.push(arm);
  }

  // The candidate-reach: LOCAL scalars ONLY on the evidence (no prose, Part 8).
  // reach_id context_block rides the map-unknowns front door; posture hold (the
  // engine proposes, it does not push -- the human decides at the gate).
  const reach = makeReach({
    reach_id: 'context_block',
    posture: 'hold',
    dispatch: 'map-unknowns',
    companions: topIds.map((id) => 'uu_candidate:' + id),
    signal: 'unknown_unknowns_scan',
    evidence: {
      uu_count: uuClaimIds.length,
      surfaced_top_n: topIds.length,
      partition_count: partitionCount,
      corpus_size: corpusSize,
    },
  });

  // Score the F.1 Next-Move set via the f-selector-ranker (clamped at MAX_K). The
  // ranker reads the LOCAL command registry; we surface its top-k as the F.1 set
  // the navigator chooses from. We pass humanConfirmBudget as k (clamped at MAX_K).
  const items = rankForSelector({
    jtbd: 'navigate-uncertainty',
    problemType: 'WDP',
    roomState: {},
    k: budget,
  });

  return {
    reach: reach,
    items: items,
    corpusSize: corpusSize,
    topN: topIds.length,
  };
}

module.exports = {
  discoverUnknownUnknowns,
  rankIntoSelector,
  // Exposed for tests + downstream introspection (pure helpers, deterministic):
  computeCorpusHash,
  checkpointPath,
  recordToCandidate,
  routeToCandidates,
  generateRecommendations,
};
