'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * SENS-09 -- dual-use diffusion/adoption detector.
 *
 * Surfaces a brain_consult candidate reach for the Brain framework
 * "Adoption-Capacity Theory" (the Adoption-Capacity Engine, ACE v2;
 * mos_command /mos:analyze-timing) when the LOCAL turn shows a dual-use
 * technology diffusion/adoption shape. ACE forecasts whether a (dual-use)
 * innovation will diffuse, who adopts first, and the adoption path -- so this
 * sensor is the "is this a diffusion question?" gate.
 *
 * FIRES (BOTH modes -- navigator decision 2026-06-22) on ANY of:
 *   1. SIGNAL MODE  -- an explicit 'diffusion_detected' signal on the turn
 *      (a /mos command marker or the test hook), OR
 *   2. KEYWORD MODE -- the LOCAL turn text contains a dual-use lexicon term
 *      (defense, army, navy, dual-use, drone, autonomous, diffusion, ...), OR
 *   3. MARKER MODE  -- a fresh <roomDir>/.mindrian/diffusion-scan-*.json
 *      side-channel marker exists.
 *
 * CANON PART 8: the sensor reads ONLY LOCAL bytes (the turn text, a LOCAL
 * side-channel) to DECIDE firing; it makes NO Brain call and NO network call.
 * The reach carries ONLY generic handles: dispatch 'adoption-capacity' and the
 * brain_framework_chain companion. evidence is a flat scalar/enum bag (the fire
 * MODE enum + problem_type enum) -- never the user's matched text. The lexicon
 * terms are OUR fixed generic vocabulary, never user content.
 *
 * Phase 144 fence: this file PRODUCES a candidate reach; it never assigns
 * routing_source and never requires/defines decide().
 *
 * Pure / sync / LOCAL-first. node built-ins + sensor-types only. No new deps.
 * House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');
const { makeReach } = require('./sensor-types.cjs');

/**
 * The dual-use diffusion lexicon. OUR fixed generic vocabulary (mirrors the
 * Brain ACE node trigger_lexicon). Generic handles, NOT user content. A LOCAL
 * turn-text hit on any term means "this looks like a dual-use diffusion
 * question" and surfaces ACE.
 */
const DIFFUSION_LEXICON = [
  'dual-use', 'dual use', 'defense', 'defence', 'military', 'army', 'navy',
  'air force', 'idf', 'weapon', 'missile', 'drone', 'swarm', 'autonomous',
  'laws', 'deep-tech', 'deep tech', 'diffusion', 'adoption', 'first-mover',
  'first mover', 'proliferation', 'arms race', 'procurement',
];

const SIGNAL_FRESHNESS_MS = 30 * 60 * 1000;

/**
 * SIGNAL MODE -- true if the turn carries an explicit 'diffusion_detected'
 * signal (string or { kind }). Defensive; never throws.
 */
function hasDiffusionSignal(turn) {
  if (!turn || typeof turn !== 'object') return false;
  const signals = Array.isArray(turn.signals) ? turn.signals : [];
  for (const s of signals) {
    const kind = (typeof s === 'string') ? s : (s && typeof s === 'object' ? s.kind : '');
    if (kind === 'diffusion_detected') return true;
  }
  return false;
}

/**
 * KEYWORD MODE -- returns the matched lexicon term (OUR generic vocabulary) if
 * the LOCAL turn text contains one, else ''. Reads turn.text only; never
 * egresses it. The returned term is from our fixed list, not user bytes.
 */
function textMatchesLexicon(turn) {
  const text = (turn && typeof turn === 'object' && typeof turn.text === 'string') ? turn.text.toLowerCase() : '';
  if (!text) return '';
  for (const term of DIFFUSION_LEXICON) {
    if (text.indexOf(term) !== -1) return term;
  }
  return '';
}

/**
 * MARKER MODE -- true if a fresh <roomDir>/.mindrian/diffusion-scan-*.json
 * side-channel marker exists. Mirrors the insight-sensors auto-explore-*.json
 * freshness idiom; self-contained (no require of insight-sensors -- that would
 * be circular). Soft-fail to false; never throws. A future-dated mtime (clock
 * skew) is rejected: age must be non-negative AND within the window.
 */
function hasFreshMarker(ctx) {
  try {
    const roomDir = (ctx && typeof ctx === 'object' && typeof ctx.roomDir === 'string') ? ctx.roomDir : '';
    if (!roomDir) return false;
    const sideDir = path.join(roomDir, '.mindrian');
    let entries = [];
    try { entries = fs.readdirSync(sideDir); } catch (_e) { return false; }
    for (const name of entries) {
      if (name.indexOf('diffusion-scan-') === 0 && name.slice(-5) === '.json') {
        try {
          const st = fs.statSync(path.join(sideDir, name));
          const age = Date.now() - st.mtimeMs;
          if (age >= 0 && age <= SIGNAL_FRESHNESS_MS) return true;
        } catch (_e) { /* keep scanning */ }
      }
    }
    return false;
  } catch (_e) {
    return false;
  }
}

/**
 * Pull the problem_type enum off the diagnose tuple as a generic handle.
 * Returns 'undefined' (the enum value) when absent -- never user content.
 */
function problemTypeOf(tuple) {
  if (!tuple || typeof tuple !== 'object') return 'undefined';
  const pt = tuple.problem_type;
  return (typeof pt === 'string' && pt) ? pt : 'undefined';
}

/**
 * SENS-09 -- dual-use diffusion/adoption -> Adoption-Capacity Theory (ACE).
 *
 * @param {object} turn  -- normalized turn ({ text, signals })
 * @param {object} tuple -- /mos:diagnose tuple { problem_type }
 * @param {object} ctx   -- LOCAL context ({ roomDir })
 * @returns {Readonly<object>|null}
 */
function sensorDiffusionAdoption(turn, tuple, ctx) {
  let mode = '';
  if (hasDiffusionSignal(turn)) {
    mode = 'signal';
  } else if (textMatchesLexicon(turn)) {
    mode = 'keyword';
  } else if (hasFreshMarker(ctx)) {
    mode = 'marker';
  }
  if (!mode) return null;

  const pt = problemTypeOf(tuple);

  return makeReach({
    reach_id: 'brain_consult',
    posture: 'push_forward',
    // Generic handle: the ACE dispatch token. The WFL-01 layer
    // (data/dispatch-framework-map.json) maps 'adoption-capacity' ->
    // "Adoption-Capacity Theory" -> /mos:analyze-timing via commandsForFramework.
    dispatch: 'adoption-capacity',
    companions: ['brain_framework_chain:adoption-capacity'],
    signal: 'diffusion_detected',
    // LOCAL scalars / enums ONLY: the fire MODE enum + problem_type enum.
    // Never the user's matched text (Part 8).
    evidence: { framework: 'adoption-capacity', mode: mode, problem_type: pt },
  });
}

module.exports = {
  sensorDiffusionAdoption: sensorDiffusionAdoption,
  DIFFUSION_LEXICON: DIFFUSION_LEXICON,
};
