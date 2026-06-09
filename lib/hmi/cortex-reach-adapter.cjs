'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 150-06 (MEM-06, D-02) -- the cortex -> reachScores adapter.
 * =================================================================
 * The NEW caller that folds the projected cortex (the Wave-2 legD cortexNodes
 * from lib/core/navigation/room-context.cjs getRoomContext) into the
 * roomState.reachScores prior map that the FROZEN dial ranker
 * (lib/hmi/dial-reach-orchestrator.cjs buildReachList) already consumes.
 *
 * THIS IS A CALLER, NOT AN ORCHESTRATOR EDIT (Canon Part 7 + the UI-SPEC
 * resolve/format split). The orchestrator stays a PURE renderer: it reads
 * roomState.reachScores and ranks; it never opens room.db, never reaches the
 * cortex. This module reads the already-surfaced cortexNodes (legD already did
 * the single caller-owned-db SELECT) and produces the 0..1 prior map. It does
 * NOT raise or lower DIAL_REACH_K, MAX_K, or the 0.70/0.15 gate -- it only
 * supplies the priors the frozen ranker consumes.
 *
 * THE FLAT-FILE SIDE-CHANNEL IS DEMOTED TO FALLBACK (D-02). When cortexNodes are
 * present the adapter's scores win (the caller threads them into
 * roomState.reachScores). When cortexNodes are ABSENT the adapter returns an
 * empty map, so the orchestrator's existing flat-file path (the registry-only
 * defaults + the D4 floor) is the fallback. The adapter never fabricates a prior
 * out of an empty cortex.
 *
 * Canon Part 8 (Graph Boundary): the adapter reads ONLY projected node-type
 * presence + enum/scalar signals from cortexNodes (type, review_status, a small
 * fixed set of property enums). It NEVER reads cortex PROSE into the dial and
 * NEVER egresses -- pure, synchronous, LOCAL-only, zero Brain calls, zero fs,
 * zero db (the legD SELECT already happened upstream). The output is a normalized
 * 0..1 score map; no user-content string ever flows through it (threat
 * T-150-06-03: the adapter reads presence + enums, never prose).
 *
 * Canon Part 9 (Memory Locality): SQL navigated (legD), this module reasons over
 * the structured node fields, the dial ranks. No prose, no truth promotion.
 *
 * No em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 *
 * Public API:
 *   buildReachScoresFromCortex(cortexNodes) -> { reach_id: score(0..1) }
 *   hasContradiction(cortexNodes) -> boolean   (the archetype-escalation signal)
 *   CONTRIBUTIONS                              (the per-signal weight table)
 *
 * License: BSL 1.1.
 */

// The six frozen machine reaches (mirror dial-reach-orchestrator REACH_DEFS;
// kept as a flat list here so the adapter never imports the orchestrator and the
// two stay decoupled -- the orchestrator consumes whatever keys we hand it).
const REACH_IDS = Object.freeze([
  'context_block',
  'contradiction',
  'cross_room',
  'brain_consult',
  'deep_research',
  'hats',
]);

// The cortex node types legD surfaces (mirror room-context.cjs CORTEX_NODE_TYPES).
// presence-only reads -- never a prose field.
const CORTEX_NODE_TYPES = Object.freeze([
  'memory_artifact',
  'governing_thought',
  'navigator_persona',
  'decision',
]);

// Per-signal contribution weights. Each is a bounded additive nudge onto a
// reach's prior; the sum is clamped to 0..1. The weights keep every cortex-built
// prior BELOW the 0.70 recommend floor unless multiple signals stack -- a cold
// cortex never solo-crosses the gate (mirrors the orchestrator's registry-only
// 0.5 default discipline).
const CONTRIBUTIONS = Object.freeze({
  // A contradiction-flagged decision node present -> push the contradiction reach
  // above the orchestrator's registry-only 0.5 floor (a contradiction in the
  // cortex IS the one move most worth attention) while staying below the 0.70
  // recommend gate, so a single signal escalates the one-move but never solo-
  // crosses the marker floor.
  contradiction_present: 0.55,
  // A fresh governing_thought present -> the context_block reach is grounded.
  governing_thought_fresh: 0.30,
  // A governing_thought present at all (any freshness) -> modest context grounding.
  governing_thought_present: 0.15,
  // A navigator_persona projection present -> hats (persona hat-spin) is warmer.
  persona_present: 0.20,
  // A memory_artifact present -> brain_consult has local material to enrich.
  memory_artifact_present: 0.10,
});

function _clamp01(n) {
  if (typeof n !== 'number' || !isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

// Read a small fixed set of property enums WITHOUT touching prose. The 150-01
// writer contract stores handles/enums only, but we still treat property values
// defensively: we read only the named enum keys and compare to fixed tokens.
function _propEnum(node, key) {
  if (!node || typeof node !== 'object') return null;
  const props = node.properties;
  if (!props || typeof props !== 'object') return null;
  const v = props[key];
  return (typeof v === 'string') ? v : null;
}

/**
 * hasContradiction(cortexNodes) -> boolean
 *
 * The archetype-escalation signal (D-02): a decision node flagged as a
 * contradiction is present in the projected cortex. Presence-only; reads the
 * 'kind' enum, never prose. resolveArchetype(reach, cortexState) consumes this
 * to escalate a 'select' reach to 'confirm'.
 */
function hasContradiction(cortexNodes) {
  if (!Array.isArray(cortexNodes)) return false;
  for (const node of cortexNodes) {
    if (!node || typeof node !== 'object') continue;
    if (node.type !== 'decision') continue;
    if (_propEnum(node, 'kind') === 'contradiction') return true;
  }
  return false;
}

/**
 * deriveCortexCtxSignals(cortexNodes) -> { staleGoverningThought, freshContradictions }
 *
 * The MED-01 PRODUCER: derive the two LOCAL ctx scalars sensorMemoryCortex reads
 * (ctx.staleGoverningThought : boolean, ctx.freshContradictions : number) from
 * the projected cortex (the legD cortexNodes). Presence + enum reads only -- a
 * governing_thought whose freshness enum is 'stale' sets staleGoverningThought;
 * each decision whose kind enum is 'contradiction' increments freshContradictions.
 * Never reads prose (Canon Part 8). The navigation-engine decide() body threads
 * the result onto sensorCtx so dispatchSensors can fire the memory-cortex bridge.
 *
 * Defensive: a non-array / empty input returns the neutral
 * { staleGoverningThought: false, freshContradictions: 0 }; never throws.
 */
function deriveCortexCtxSignals(cortexNodes) {
  const out = { staleGoverningThought: false, freshContradictions: 0 };
  if (!Array.isArray(cortexNodes) || cortexNodes.length === 0) return out;
  for (const node of cortexNodes) {
    if (!node || typeof node !== 'object') continue;
    if (CORTEX_NODE_TYPES.indexOf(node.type) === -1) continue;
    if (node.type === 'governing_thought') {
      if (_propEnum(node, 'freshness') === 'stale') out.staleGoverningThought = true;
    } else if (node.type === 'decision') {
      if (_propEnum(node, 'kind') === 'contradiction') out.freshContradictions += 1;
    }
  }
  return out;
}

/**
 * buildReachScoresFromCortex(cortexNodes) -> { reach_id: score(0..1) }
 *
 * Fold the projected cortex node-type presence + enum signals into a normalized
 * prior map keyed by reach_id. Returns an EMPTY object when cortexNodes is empty
 * or not an array -- so the orchestrator's flat-file path is the fallback (D-02).
 *
 * Pure / synchronous / LOCAL-only. Reads presence + enums, never prose. No Brain,
 * no fs, no db.
 */
function buildReachScoresFromCortex(cortexNodes) {
  if (!Array.isArray(cortexNodes) || cortexNodes.length === 0) {
    // Empty cortex -> no priors -> flat-file fallback wins (D-02).
    return {};
  }

  // Accumulate per-reach additive nudges from the observed cortex signals.
  const acc = {};
  function bump(reachId, weight) {
    if (REACH_IDS.indexOf(reachId) === -1) return;
    acc[reachId] = (typeof acc[reachId] === 'number' ? acc[reachId] : 0) + weight;
  }

  let sawGoverningThought = false;
  let sawFreshGoverningThought = false;
  let sawPersona = false;
  let sawMemoryArtifact = false;
  let sawContradiction = false;

  for (const node of cortexNodes) {
    if (!node || typeof node !== 'object') continue;
    const type = node.type;
    if (CORTEX_NODE_TYPES.indexOf(type) === -1) continue;

    if (type === 'governing_thought') {
      sawGoverningThought = true;
      if (_propEnum(node, 'freshness') === 'fresh') sawFreshGoverningThought = true;
    } else if (type === 'navigator_persona') {
      sawPersona = true;
    } else if (type === 'memory_artifact') {
      sawMemoryArtifact = true;
    } else if (type === 'decision') {
      if (_propEnum(node, 'kind') === 'contradiction') sawContradiction = true;
    }
  }

  if (sawContradiction) bump('contradiction', CONTRIBUTIONS.contradiction_present);
  if (sawFreshGoverningThought) {
    bump('context_block', CONTRIBUTIONS.governing_thought_fresh);
  } else if (sawGoverningThought) {
    bump('context_block', CONTRIBUTIONS.governing_thought_present);
  }
  if (sawPersona) bump('hats', CONTRIBUTIONS.persona_present);
  if (sawMemoryArtifact) bump('brain_consult', CONTRIBUTIONS.memory_artifact_present);

  // Normalize: clamp each accumulated prior to 0..1. Only reaches that received
  // a signal appear in the map; reaches with no cortex signal are left to the
  // orchestrator's existing path (the flat-file fallback for those keys).
  const out = {};
  for (const reachId of Object.keys(acc)) {
    out[reachId] = _clamp01(acc[reachId]);
  }
  return out;
}

module.exports = {
  buildReachScoresFromCortex: buildReachScoresFromCortex,
  hasContradiction: hasContradiction,
  deriveCortexCtxSignals: deriveCortexCtxSignals,
  CONTRIBUTIONS: CONTRIBUTIONS,
  REACH_IDS: REACH_IDS,
};
