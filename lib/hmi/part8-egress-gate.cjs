'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 196-05 (PB8-07/08) -- the Part-8 ambiguous-egress Decision Gate.
 * ==========================================================================
 * When classify() (lib/core/part8-egress-guard.cjs) cannot PROVE a MOVE-SET
 * packet yet finds no hard CONTENT-SET hit, the safe move is to gate to the
 * navigator (D-08), never a silent send-anyway (D-01). This module is that
 * gate: a thin composition over the shipped open-vocab Shape F.1 renderer
 * (lib/hmi/shape-f1-renderer.cjs). It invents no new selector shape (Part 7
 * reuse) and mints no new frozen scalar.
 *
 * Constitutional invariants:
 *   - D-01: the verb set is EXACTLY {Reformulate, Cancel} plus the auto-appended
 *     Free-Text. There is NO send-anyway / Approve / Override / Proceed verb.
 *     A flagged packet has no way through; the only options are reformulate to a
 *     generic methodology handle or cancel. Asserted by construction below.
 *   - D-09: the header names the leak CLASS slug ONLY, never the offending bytes.
 *     No payload sample rides the render.
 *   - D-08a: the Brain-less degrade helper does NOT render. With no wire nothing
 *     can leak, so it best-effort LOCAL-logs brain_egress_ambiguous and signals
 *     allow -- no navigator interruption.
 *   - This module opens ZERO Brain wire and makes ZERO network call.
 *
 * 'Reformulate' is already a CANONICAL_VERB (shape-f1-renderer.cjs:44); 'Cancel'
 * rides the user-supplied verb path (capped at 5, Free-Text appended last).
 * Reformulate is marked recommended in Mode A.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only. Pure CJS, zero deps.
 *
 * License: BSL 1.1.
 */

const path = require('node:path');

const RENDERER_PATH = path.join(__dirname, 'shape-f1-renderer.cjs');
const ONTOLOGY_PATH = path.join(__dirname, '..', 'core', 'part8-egress-ontology.cjs');

// The exact verb set the gate offers. Reformulate + Cancel ONLY; the renderer
// appends Free-Text last automatically. This constant is the D-01 contract.
const GATE_VERBS = ['Reformulate', 'Cancel'];
const RECOMMENDED_VERB = 'Reformulate';

// By-construction guard: no verb in this deny-list may ever appear in a rendered
// gate. A send-anyway verb would let a flagged packet egress, breaching D-01.
const FORBIDDEN_VERBS = [
  'Send', 'SendAnyway', 'Send-Anyway', 'Send Anyway',
  'Approve', 'Override', 'Proceed', 'Allow', 'Force',
];

/**
 * _classSlug(v) -> string
 *
 * Reduce the class to a bounded lowercase slug so the header can name the leak
 * CATEGORY without ever carrying an offending byte (D-09). Anything non-slug
 * collapses to 'unknown'.
 */
function _classSlug(v) {
  if (typeof v !== 'string' || v.length === 0) return 'unknown';
  const s = v.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40);
  return s.length > 0 ? s : 'unknown';
}

/**
 * _numericTier(tier) -> number
 *
 * The renderer keys Mode A off a NUMERIC tier >= 2 (shape-f1-renderer.cjs:133).
 * The gate is always a Mode-A decision gate (Reformulate recommended), so map
 * 'A' / undefined / any non-number to 2, and an explicit 'B' to 0. A caller that
 * passes a real number keeps it.
 */
function _numericTier(tier) {
  if (typeof tier === 'number') return tier;
  if (tier === 'B') return 0;
  return 2; // Mode A default -- the ambiguous gate always recommends Reformulate.
}

/**
 * renderGate(v) -> { zones, contract }
 *
 * v = { verdict?, class?, reason?, tier? }. Compose the Shape F.1 renderer with
 * the fixed {Reformulate, Cancel} verb set and a class-slug-only header. Returns
 * the renderer's { zones, contract } straight through. Asserts by construction
 * that no send-anyway verb leaked into the contract before returning.
 */
function renderGate(v) {
  const input = (v && typeof v === 'object') ? v : {};
  const classSlug = _classSlug(input.class);
  const tier = _numericTier(input.tier);
  const header = '-- part 8 -- this may leak ' + classSlug + ' -- pick --';

  const renderShapeF1 = require(RENDERER_PATH).renderShapeF1;
  const out = renderShapeF1({
    tier: tier,
    recommendedVerb: RECOMMENDED_VERB,
    verbs: GATE_VERBS.slice(),
    header: header,
  });

  // By-construction assertion (D-01): the composed contract must carry NO
  // send-anyway verb. The verb set is fixed above so this can never trip; it is
  // a self-check that fails LOUD rather than silently egress a flagged packet.
  const verbs = (out && out.contract && Array.isArray(out.contract.verbs))
    ? out.contract.verbs
    : [];
  for (let i = 0; i < FORBIDDEN_VERBS.length; i++) {
    if (verbs.indexOf(FORBIDDEN_VERBS[i]) !== -1) {
      throw new Error('part8-egress-gate: send-anyway verb "' + FORBIDDEN_VERBS[i]
        + '" is forbidden (D-01)');
    }
  }
  return out;
}

/**
 * degrade(info, db) -> { allow, rendered }
 *
 * The Brain-less path (D-08a): isAvailable() is false, so there is no wire and
 * nothing can leak. Do NOT render the gate. Best-effort LOCAL-log the ambiguous
 * decision via the ontology writer (scalars + slug only, D-09), then signal
 * allow. Never throws; a telemetry failure never changes the allow signal.
 *
 * info = { class?, reason?, count?, sessionId? }. db is the SQLite handle (or
 * undefined -- the ontology writer no-ops on a falsy db).
 */
function degrade(info, db) {
  const meta = (info && typeof info === 'object') ? info : {};
  try {
    require(ONTOLOGY_PATH).record(db, {
      verdict: 'ambiguous',
      class: meta.class,
      matched_pattern: meta.reason,
      count: meta.count,
      sessionId: meta.sessionId,
    });
  } catch (_e) {
    // best-effort: a telemetry failure never blocks the allow (D-08a).
  }
  return { allow: true, rendered: false };
}

module.exports = {
  renderGate: renderGate,
  degrade: degrade,
  GATE_VERBS: GATE_VERBS.slice(),
  RECOMMENDED_VERB: RECOMMENDED_VERB,
  FORBIDDEN_VERBS: FORBIDDEN_VERBS.slice(),
};
