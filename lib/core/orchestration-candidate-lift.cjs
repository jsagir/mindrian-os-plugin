'use strict';

/*
 * Phase 191 Plan 02 -- liftFiringCandidate: the pure lift module that turns a
 * gate-cleared projection candidate into a canonical-verb fire_skill and a
 * command-recommendation for the F.7 dial. Built to 191-IFACE.md section 2.
 *
 * D-01: this module is the ONLY firing-decision surface downstream of the
 * projection cache; the Phase-184 reader
 * (lib/core/reader/decide-projection-reader.cjs) stays a pure read-only
 * surfacer and is never edited here.
 * D-02: the advisory -> firing threshold is the FROZEN Part-3 confidence
 * floor, imported below from navigation-engine.cjs -- never a re-typed
 * literal, never re-weighted.
 * D-03 / D-03a: no new LarryReach is minted here; the winning option already
 * rides an existing reach_id, and the command-recommendation reads the LOCAL
 * command subgraph indirectly through the injected rankFn seam.
 * R2/R7 (Part 8): pure, synchronous, LOCAL-only. This module opens no db,
 * forms no Brain packet, performs no network I/O.
 * R8: recommend-not-trigger. This module decides a candidate; it never
 * fires or executes anything.
 *
 * House rule: hyphens only, no em-dashes.
 */

const navigationEngine = require('./navigation-engine.cjs');
const RECOMMENDED_CONFIDENCE_FLOOR = navigationEngine.RECOMMENDED_CONFIDENCE_FLOOR;
const reachIdToSkillFamily = navigationEngine.reachIdToSkillFamily;

const rankForSelector = require('../workflow/f-selector-ranker.cjs').rankForSelector;

// ---------------------------------------------------------------------------
// hitl_shape closed enum (191-IFACE.md section 4, verbatim table). Enum-only
// so it stays Part-8 safe: never prose, never a room artifact.
// ---------------------------------------------------------------------------
function deriveHitlShape(posture) {
  if (posture === 'push_forward') return 'confirm';
  if (posture === 'hold') return 'hold';
  return 'ask';
}

// The winning option (surfaceAsOptionContent's trimmed shape) does not carry
// posture; posture lives on decide()'s sensorReaches[] entries. Find the
// entry matching the winner's reach_id and read its posture off that.
function findReachPosture(sensorReaches, reachId) {
  if (!Array.isArray(sensorReaches)) return null;
  for (const r of sensorReaches) {
    if (r && r.reach_id === reachId && typeof r.posture === 'string') return r.posture;
  }
  return null;
}

// ---------------------------------------------------------------------------
// The confidence-join (191-IFACE.md section 3): match the winning option's
// command slug to a rankFn scored entry's command field. No re-weighting --
// the matched score rides through as-is.
// ---------------------------------------------------------------------------
function confidenceJoin(rankFn, rankArgs, winnerCommand) {
  if (typeof winnerCommand !== 'string' || winnerCommand.length === 0) return null;
  const scored = rankFn(rankArgs);
  if (!Array.isArray(scored)) return null;
  for (const entry of scored) {
    if (entry && entry.command === winnerCommand) return entry;
  }
  return null;
}

// Map the lift's LOCAL-only context (roomState / packetOptional / problem_type)
// onto rankForSelector's args shape. Only forwards fields that are present;
// the ranker's own defaults handle the rest.
function buildRankArgs(context) {
  const ctx = (context && typeof context === 'object') ? context : {};
  const args = {};
  if (ctx.roomState && typeof ctx.roomState === 'object') args.roomState = ctx.roomState;
  if (ctx.packetOptional && typeof ctx.packetOptional === 'object') args.packetOptional = ctx.packetOptional;
  if (typeof ctx.problem_type === 'string') args.problemType = ctx.problem_type;
  return args;
}

function emptyResult(reason) {
  return {
    fire_skill_verb: null,
    lifted_option: null,
    command_recommendation: null,
    confidence: 0,
    reason: reason,
  };
}

/**
 * liftFiringCandidate(input) -> LiftResult
 *
 * Pure, synchronous, seam-injectable (191-IFACE.md section 2). Cases:
 *   - projectionOffer null/empty options -> 'no_offer'.
 *   - winning option's command has no rankFn match -> 'no_match'.
 *   - matched score below the gate -> 'below_gate' (command_recommendation
 *     MAY still surface as advisory per IFACE section 4).
 *   - matched score clears the gate but verbFn has no mapping ->
 *     'no_canonical_verb' (command_recommendation still populated).
 *   - matched score clears the gate AND verbFn maps -> 'lifted'.
 * Never throws: any internal fault degrades to reason:'error'.
 */
function liftFiringCandidate(input) {
  try {
    const o = (input && typeof input === 'object') ? input : {};
    const projectionOffer = o.projectionOffer;
    const sensorReaches = o.sensorReaches;
    const rankFn = (typeof o.rankFn === 'function') ? o.rankFn : rankForSelector;
    const verbFn = (typeof o.verbFn === 'function') ? o.verbFn : reachIdToSkillFamily;
    const gate = (typeof o.gate === 'number') ? o.gate : RECOMMENDED_CONFIDENCE_FLOOR;

    const options = (projectionOffer && Array.isArray(projectionOffer.options))
      ? projectionOffer.options : null;
    if (!options || options.length === 0) return emptyResult('no_offer');

    // The reader's already-ranked order fixes the tie-break (IFACE section 2):
    // options[0] is the reader's top candidate.
    const winner = options[0];
    if (!winner || typeof winner !== 'object') return emptyResult('no_offer');

    const matched = confidenceJoin(rankFn, buildRankArgs(o.context), winner.command);
    if (!matched) return emptyResult('no_match');

    const confidence = Math.max(0, Math.min(1, matched.score));
    const posture = findReachPosture(sensorReaches, winner.reach_id);
    const hitl_shape = deriveHitlShape(posture);

    const command_recommendation = {
      command_slug: matched.command,
      hitl_shape: hitl_shape,
      confidence: confidence,
    };

    if (confidence < gate) {
      return {
        fire_skill_verb: null,
        lifted_option: null,
        command_recommendation: command_recommendation,
        confidence: confidence,
        reason: 'below_gate',
      };
    }

    const verb = verbFn(winner.reach_id);
    if (!verb) {
      return {
        fire_skill_verb: null,
        lifted_option: null,
        command_recommendation: command_recommendation,
        confidence: confidence,
        reason: 'no_canonical_verb',
      };
    }

    const lifted_option = Object.assign({}, winner, {
      fires: true,
      confidence: confidence,
      hitl_shape: hitl_shape,
    });

    return {
      fire_skill_verb: verb,
      lifted_option: lifted_option,
      command_recommendation: command_recommendation,
      confidence: confidence,
      reason: 'lifted',
    };
  } catch (_err) {
    return {
      fire_skill_verb: null,
      lifted_option: null,
      command_recommendation: null,
      confidence: 0,
      reason: 'error',
    };
  }
}

module.exports = {
  liftFiringCandidate: liftFiringCandidate,
  // Internal helpers exposed for test introspection only; liftFiringCandidate
  // is the sole seam Waves 3a/4 import (191-IFACE.md section 2).
  _deriveHitlShape: deriveHitlShape,
  _confidenceJoin: confidenceJoin,
};
