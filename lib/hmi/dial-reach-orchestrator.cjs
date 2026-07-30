'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 143.1-01 -- the dial-reach orchestrator (DIALTUI-01 + DIALTUI-02).
 * ======================================================================
 * The surface-agnostic core (D3 in the DIAL-TUI design brief). It returns
 * ONE structured ReachList (no ANSI, no host formatting) that every surface
 * (CLI master / Desktop / Cowork) consumes. The CLI presenter (Plan 04) does
 * the formatting; this module is pure resolve, never format -- the
 * nav-dial.cjs resolve/format split applied (UI-SPEC Section 10).
 *
 * The load-bearing architectural decision (UI-SPEC Section 1.3): TWO separate
 * Ks. The shipped ranker keeps MAX_K=3 (the AskUserQuestion chooser clamp,
 * NEVER raised, NEVER imported here as the dial cap). The dial preview ranks
 * DIAL_REACH_K=6 (Phase 148 D-09 raised it from 5 when 'hats' became the 6th
 * machine reach). "Rank N, preview 6, choose 3."
 *
 * Canon Part 3  (tier-aware option generation: mode_a / mode_b / tier_0).
 * Canon Part 7  (reuse: the D4 blend comes from lib/workflow/f-selector-ranker
 *                rankForSelector; this module NEVER re-implements the formula).
 * Canon Part 8  (Graph Boundary): pure, synchronous, LOCAL-only. ZERO live
 *                Brain calls at render time. brain_confidence is the pre-baked
 *                BRAIN.md-derived prior the caller passes in via roomState
 *                (per Part 9: this module reads no room.db; it consumes what
 *                callers hand it). A source-grep tripwire in the test asserts
 *                zero fetch / http / brain-client require / await tokens.
 * Canon Part 9  (Memory Locality): the orchestrator is a pure renderer over
 *                already-built signal. SQL navigates, Brain reasons over
 *                packets, this module just ranks what is on the table.
 *
 * The FROZEN Recommended gate (UI-SPEC Section 7; reused verbatim, never
 * re-tuned without an INTERFACE_VERSION bump):
 *   reach#1.recommended = (tier_mode == 'mode_a') AND (reach#1.score >= 0.70)
 *   reach#2.recommended = (tier_mode == 'mode_a') AND (reach#2.score >= 0.70)
 *                                                  AND ((s1 - s2) < 0.15)
 *   all other reaches   = false
 * 0.70 is the FROZEN floor. 0.15 is MARGIN_THRESHOLD. The floor is NEVER
 * lowered to force a second marker (anti-pattern AP3).
 *
 * No em-dashes anywhere (project hard rule). Hyphens only.
 *
 * Public API:
 *   buildReachList(roomState) -> ReachList
 *   DIAL_REACH_K, MARGIN_THRESHOLD, RECOMMEND_FLOOR, REACH_IDS
 *
 * License: BSL 1.1.
 */

const ranker = require('../workflow/f-selector-ranker.cjs');

// Phase 172-09 (INV-19): the LOCAL JTBD-blurb generator for the PINNED /mos:act
// standing suggestion. It is itself pure / synchronous / zero-Brain (it composes
// from enum/scalar + local-derived text only; a source-grep tripwire in its own
// test proves zero Brain tokens), so requiring it here keeps this orchestrator
// LOCAL-only. The require is lazy-guarded: a load failure degrades the pinned
// row to a hardcoded generic blurb rather than throwing.
let _actBlurbGen = null;
function _loadActBlurbGen() {
  if (_actBlurbGen !== null) return _actBlurbGen;
  try {
    _actBlurbGen = require('../core/act-jtbd-blurb.cjs');
  } catch (_e) {
    _actBlurbGen = false;
  }
  return _actBlurbGen;
}

// The hardcoded generic act blurb (Tier-0 floor) used when the blurb generator
// is unavailable. Mirrors lib/core/act-jtbd-blurb.cjs GENERIC_BLURB.
const _ACT_GENERIC_BLURB = Object.freeze({
  what: 'Run the next move Larry recommends, without typing the /mos: command yourself.',
  helps_with: 'Keeping momentum when you know roughly where to go but not which command gets you there.',
  how: 'Larry picks the framework that fits your current room state and runs it through the governed path.',
});

// Build the PINNED /mos:act standing suggestion. ALWAYS present (always-on, INV-19):
// when roomState.actBlurb is absent the blurb generator still degrades to a
// generic blurb (and a generator-load failure falls back to _ACT_GENERIC_BLURB).
// This is a SEPARATE field on the ReachList -- it is NOT a reach_id, mints no
// 7th reach, and never counts against offered_count / total_count. It carries
// position:'last' (rendered first OR last on the host; this module defaults to
// last so it never displaces the ranked reaches).
function _buildPinnedActSuggestion(roomState) {
  const inputs = (roomState && typeof roomState.actBlurb === 'object' && roomState.actBlurb)
    ? roomState.actBlurb : {};
  const gen = _loadActBlurbGen();
  let blurb = _ACT_GENERIC_BLURB;
  if (gen && typeof gen.buildActBlurb === 'function') {
    try {
      const b = gen.buildActBlurb(inputs);
      if (b && typeof b.what === 'string') blurb = b;
    } catch (_e) {
      blurb = _ACT_GENERIC_BLURB;
    }
  }
  return {
    pinned: true,
    command: '/mos:act',
    // act is a standing suggestion, NOT a reach. It carries no reach_id; the
    // explicit null documents that it is never a reach-bank member.
    reach_id: null,
    position: 'last',
    blurb: { what: blurb.what, helps_with: blurb.helps_with, how: blurb.how },
  };
}

// The dial preview cap. SEPARATE from the ranker MAX_K=3 chooser clamp.
// Rank N, preview 6, choose 3. (UI-SPEC Section 1.3 / V9; Phase 148 D-09
// raised 5 -> 6 when 'hats' was minted as the 6th machine reach. The
// DIAL_REACH_K-must-be-distinct-from-MAX_K invariant still holds: 6 != 3.)
const DIAL_REACH_K = 6;

// The frozen gate constants (UI-SPEC Section 7). Changing either requires an
// INTERFACE_VERSION bump per the canon.
const RECOMMEND_FLOOR = 0.70;
const MARGIN_THRESHOLD = 0.15;

// The chooser row budget. Mirrors the ranker MAX_K (read, never raised) so the
// offered_count footer math stays in lockstep with the AskUserQuestion clamp.
const OFFERED_CAP = (typeof ranker.MAX_K === 'number') ? ranker.MAX_K : 3;

// The 6 canonical reaches (frozen, UI-SPEC Section 0; Phase 148 D-09 added
// 'hats' as the 6th machine reach), in doctrine order. Each carries its
// canonical_verb (persisted to the graph edge; NEVER rendered as the row label
// -- the Feynman-JTBD label is a render-time alias, Plan 04) and the per-reach
// Brain-reachability class. Registry-only reaches (no Brain signal) default
// brain_confidence=0.5 so they can never solo-cross 0.70 -- a cold room yields
// zero markers by design (UI-SPEC Section 6.4).
const REACH_DEFS = [
  { reach_id: 'context_block', canonical_verb: 'Context Block', registry_only: false },
  { reach_id: 'contradiction', canonical_verb: 'contradiction surface', registry_only: false },
  { reach_id: 'cross_room', canonical_verb: 'cross-room reach', registry_only: true },
  { reach_id: 'brain_consult', canonical_verb: 'Brain consult', registry_only: false },
  { reach_id: 'deep_research', canonical_verb: 'framework-led deep research plan', registry_only: false },
  { reach_id: 'hats', canonical_verb: 'research personas hat-spin', registry_only: false },
];

const REACH_IDS = REACH_DEFS.map((d) => d.reach_id);

// Registry-only default prior. Below the 0.70 floor by construction.
const REGISTRY_DEFAULT_BRAIN_CONFIDENCE = 0.5;

function _clamp01(n) {
  if (typeof n !== 'number' || !isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

// Resolve the tier mode from roomState. Honors an explicit roomState.tierMode
// (mode_a / mode_b / tier_0); otherwise derives it from Brain reachability +
// BRAIN.md presence (Canon Part 3): Brain reachable -> mode_a; Brain
// unreachable but local graph present -> mode_b; neither -> tier_0.
function _resolveTierMode(roomState) {
  const explicit = roomState && typeof roomState.tierMode === 'string'
    ? roomState.tierMode : null;
  if (explicit === 'mode_a' || explicit === 'mode_b' || explicit === 'tier_0') {
    return explicit;
  }
  const brainReachable = !!(roomState && roomState.brainReachable);
  const brainMdPresent = !!(roomState && roomState.brainMdPresent);
  const localGraphPresent = !!(roomState && roomState.localGraphPresent);
  if (brainReachable && brainMdPresent) return 'mode_a';
  if (localGraphPresent) return 'mode_b';
  return 'tier_0';
}

// Reuse the shipped D4 blend (Canon Part 7). We call rankForSelector once to
// pull the investment-aware D4 signal off the shipped ranker rather than
// re-inventing a second formula. The returned commands are not what the dial
// renders (the dial renders the 6 canonical reaches), but the call exercises
// the D4 blend + investment math so the provenance decomposition below stays
// faithful to the one shipped scoring path. Pure / sync / no Brain (the ranker
// is itself zero-Brain, LOCAL-only).
function _d4SignalFloor(roomState) {
  let ranked = [];
  try {
    ranked = ranker.rankForSelector({
      roomState: (roomState && typeof roomState === 'object') ? roomState : {},
      k: DIAL_REACH_K,
    });
  } catch (_e) {
    ranked = [];
  }
  if (Array.isArray(ranked) && ranked.length > 0
      && typeof ranked[0].score === 'number') {
    return _clamp01(ranked[0].score);
  }
  return null;
}

// Per-reach score resolution. The caller supplies pre-baked LOCAL priors via
// roomState.reachScores (a map reach_id -> normalized 0..1 score). These priors
// are the BRAIN.md-derived brain_confidence-anchored result of the D4 blend,
// computed at session time through the Part-8 chokepoint -- never a live call.
// A registry-only reach with no supplied prior defaults to the
// REGISTRY_DEFAULT_BRAIN_CONFIDENCE D4 floor (0.5 -> below the 0.70 gate).
function _resolveReachScore(def, roomState) {
  const map = (roomState && roomState.reachScores && typeof roomState.reachScores === 'object')
    ? roomState.reachScores : {};
  const supplied = map[def.reach_id];
  if (typeof supplied === 'number' && isFinite(supplied)) {
    return _clamp01(supplied);
  }
  return def.registry_only ? REGISTRY_DEFAULT_BRAIN_CONFIDENCE : 0;
}

// Provenance decomposition (UI-SPEC Section 6). The D4 numerator's first term
// is brain_confidence * 0.40; the remaining terms (recency_decay +
// problem_type_bind, both investment-gated) are the LOCAL contribution. We
// surface the same split on the normalized reach score so the dial is
// explainable: brain_component is the 0.40-weighted Brain prior share, the
// local_component is the residual LOCAL share.
function _provenance(score, def) {
  const brain_component = _clamp01(score * 0.40);
  const local_component = _clamp01(score - brain_component);
  let source;
  if (def.registry_only) {
    source = 'registry';
  } else if (score > 0) {
    source = 'blend';
  } else {
    source = 'local';
  }
  return { brain_component, local_component, source };
}

// The FROZEN gate, applied per-reach AFTER the desc sort. reach#1 and reach#2
// are the only candidates; everything else is false unconditionally.
function _applyFrozenGate(reaches, tierMode) {
  // The 0.70 gate is a Brain-only concept. Mode B and Tier 0 carry zero
  // markers by design (UI-SPEC Section 6.4 "looks intentional").
  if (tierMode !== 'mode_a') {
    for (const r of reaches) r.recommended = false;
    return;
  }
  for (const r of reaches) r.recommended = false;
  if (reaches.length === 0) return;
  const s1 = reaches[0].score;
  // reach#1: mode_a AND score >= 0.70.
  reaches[0].recommended = (s1 >= RECOMMEND_FLOOR);
  if (reaches.length < 2) return;
  const s2 = reaches[1].score;
  // reach#2: mode_a AND score >= 0.70 AND (s1 - s2) < 0.15. The floor is
  // NEVER lowered to force a second marker (AP3): both the >=0.70 check and
  // the margin check must pass independently.
  reaches[1].recommended = (s2 >= RECOMMEND_FLOOR) && ((s1 - s2) < MARGIN_THRESHOLD);
}

/**
 * buildReachList(roomState) -> ReachList
 *
 * ReachList {
 *   reaches: Reach[<=DIAL_REACH_K(6)]  // ranked desc by score
 *   tier_mode: 'mode_a' | 'mode_b' | 'tier_0'
 *   offered_count: int                 // min(reaches, MAX_K=3) for the chooser
 *   total_count: int                   // N, for the "top-3 of N" footer
 *   pinned_suggestion: PinnedAct       // INV-19: the ALWAYS-ON /mos:act row.
 *                                      // Separate field, NOT a reach, does NOT
 *                                      // count against offered_count/total_count.
 * }
 * PinnedAct {
 *   pinned: true, command: '/mos:act', reach_id: null, position: 'last',
 *   blurb: { what, helps_with, how }   // LOCAL-derived (act-jtbd-blurb.cjs)
 * }
 * Reach {
 *   reach_id, canonical_verb, score, source, brain_component,
 *   local_component, recommended
 * }
 *
 * Pure / synchronous / LOCAL-only. No Brain call, no fs write, no db write.
 *
 * SCOPE BOUNDARY (documented 2026-07-31, quick-260731-35r): DIAL VISIBILITY, NOT DIAL RANKING.
 * Sensor-fired candidates from dispatchSensors NEVER reach this function's scoring. They control
 * only WHETHER the Shape F.7 dial renders at all: decide() does not assign routing_source
 * (lib/core/navigation-engine.cjs:1253, "routing_source is NOT assigned here; flipped at the
 * router"), a fired sensor reach flips it legacy -> engine downstream, and
 * renderEngineDecisionWithDial early-returns unless routing.source === 'engine'
 * (scripts/intent-classifier.cjs:1255-1260). WHICH reach_id ranks top, carries the recommended
 * marker, or appears in what order once the dial renders is 100 percent cortex-node scoring:
 * roomState.reachScores is built exclusively by cortex-reach-adapter.cjs::buildReachScoresFromCortex
 * (scripts/intent-classifier.cjs:1273-1274) and read only by _resolveReachScore (this file,
 * lines 199-201). Phase 244-04's tier-fusion seam (o.tierCandidates -> _applyTierFusion) lives in
 * lib/workflow/f-selector-ranker.cjs::rankForSelector, a DIFFERENT function on a DISJOINT path;
 * it does not touch buildReachList. This is a deliberate, named scope boundary, not an oversight.
 * Full finding, citations and flip conditions:
 * .planning/quick/260731-35r-phase-244-1-document-dial-render-sensor-/260731-35r-FINDING.md
 */
// Normalize roomState.suppressedReachIds (a Set or an array of reach_id strings;
// absent/empty -> empty Set) into a Set with a .has() membership test. Defensive:
// never throws on a malformed value. Phase 158-03 (SC-03 / SC-05): the upstream
// fold (computeReachPenalties on the live arm) hands buildReachList the set of
// hard-suppressed reach_ids; the orchestrator drops them by enum membership only,
// staying PURE (no db, no fs, no Brain). When absent or empty, the output is
// byte-identical to the pre-158 baseline (RJP-02).
function _normalizeSuppressed(state) {
  const raw = state && state.suppressedReachIds;
  if (raw instanceof Set) return raw;
  if (Array.isArray(raw)) {
    return new Set(raw.filter((r) => typeof r === 'string' && r.length > 0));
  }
  return new Set();
}

function buildReachList(roomState) {
  const state = (roomState && typeof roomState === 'object') ? roomState : {};
  const tierMode = _resolveTierMode(state);
  const suppressed = _normalizeSuppressed(state);

  // Exercise the shipped D4 blend (Canon Part 7 reuse). The returned floor is
  // advisory provenance grounding only; the dial score is the pre-baked prior.
  const d4Floor = _d4SignalFloor(state);

  const reaches = REACH_DEFS.map((def) => {
    let score = _resolveReachScore(def, state);
    // When a reach has no supplied prior but the shipped ranker surfaced a D4
    // signal floor, registry-only reaches inherit it as a not-above-floor
    // grounding (still < 0.70 because registry-only brain_confidence is 0.5).
    if (def.registry_only && typeof d4Floor === 'number'
        && (!state.reachScores || typeof state.reachScores[def.reach_id] !== 'number')) {
      score = Math.min(score, _clamp01(d4Floor));
    }
    const prov = _provenance(score, def);
    return {
      reach_id: def.reach_id,
      canonical_verb: def.canonical_verb,
      score,
      source: prov.source,
      brain_component: prov.brain_component,
      local_component: prov.local_component,
      recommended: false,
    };
  });

  // Phase 158-03 (SC-03 / SC-05): DROP the hard-suppressed reach_ids from the
  // runtime reaches array BEFORE the .sort and BEFORE _applyFrozenGate. The drop
  // is on the RUNTIME array only -- REACH_DEFS / REACH_IDS / DIAL_REACH_K stay
  // byte-unchanged (the bank is still 6; we filter what renders THIS turn). The
  // sort, the frozen gate, total_count, and offered_count all run on the
  // survivors so total_count honestly reflects the reduced bank for this turn
  // (the "top-3 of N" footer shows the smaller N). Empty suppressed set -> the
  // survivors are the full set -> byte-identical to today (RJP-02).
  const survivors = reaches.filter((r) => !suppressed.has(r.reach_id));

  // Rank desc by score. Stable on ties (preserves canonical doctrine order).
  survivors.sort((a, b) => b.score - a.score);

  // Apply the frozen 0.70 / 0.15 gate per-reach (on the post-drop survivors).
  _applyFrozenGate(survivors, tierMode);

  const total_count = survivors.length;
  const offered_count = Math.min(total_count, OFFERED_CAP);

  // Phase 172-09 (INV-19): the PINNED /mos:act standing suggestion. ALWAYS-ON,
  // a SEPARATE field, NOT a reach. It is built AFTER total_count/offered_count
  // are computed on the survivors, so it can NEVER affect either -- the ranked
  // MAX_K=3 reaches are byte-identical whether or not act is pinned. It mints no
  // 7th reach (REACH_DEFS / REACH_IDS / DIAL_REACH_K untouched).
  const pinned_suggestion = _buildPinnedActSuggestion(state);

  return {
    reaches: survivors,
    tier_mode: tierMode,
    offered_count,
    total_count,
    pinned_suggestion,
  };
}

module.exports = {
  buildReachList,
  DIAL_REACH_K,
  MARGIN_THRESHOLD,
  RECOMMEND_FLOOR,
  REACH_IDS,
};
