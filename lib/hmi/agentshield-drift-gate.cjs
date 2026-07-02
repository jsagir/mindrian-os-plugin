'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 199-06 (AS-07) -- the AgentShield drift Decision Gate.
 * ==========================================================================
 * When the SessionStart drift scan (scripts/agentshield-sessionstart-scan.cjs)
 * finds a NEW finding since the last locally-cached scan, the informative move is
 * to surface it through a Shape F.1 Decision Gate {Investigate, Defer}, never a
 * silent swallow and never a hard block (a SessionStart hook INFORMS). This module
 * is that gate: a thin composition over the shipped open-vocab Shape F.1 renderer
 * (lib/hmi/shape-f1-renderer.cjs). It invents no new selector shape (Part 7
 * reuse) and mints no new frozen scalar -- it reuses the renderer's MAX_K / verb-
 * cap / mode machinery untouched, exactly as 196-05's part8-egress-gate.cjs does.
 *
 * Constitutional invariants:
 *   - The verb set is EXACTLY {Investigate, Defer} plus the auto-appended
 *     Free-Text. 'Defer' is already a CANONICAL_VERB (shape-f1-renderer.cjs:62);
 *     'Investigate' rides the open-vocabulary user-supplied verb path, mirroring
 *     how 196-05 mixed one canonical verb (Reformulate) with one custom verb
 *     (Cancel). Investigate is marked recommended in Mode A.
 *   - D-09 discipline (borrowed from 196-05 even though this is NOT a Part-8
 *     egress gate): the header names the SURFACE SLUG and the COUNT only, never a
 *     file path and never a matched byte of the offending target. No payload
 *     sample rides the render.
 *   - This module opens ZERO Brain wire and makes ZERO network call. There is no
 *     Brain-availability concept for this gate, so no degrade() function exists;
 *     instead a pure shouldRender(cacheEntry, finding) helper suppresses a finding
 *     the local dedup cache has already surfaced, so the SAME finding is never
 *     re-rendered every session.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only. Pure CJS, zero deps.
 *
 * License: BSL 1.1.
 */

const path = require('node:path');

const RENDERER_PATH = path.join(__dirname, 'shape-f1-renderer.cjs');

// The exact verb set the gate offers. Investigate + Defer ONLY; the renderer
// appends Free-Text last automatically. This constant is the gate contract.
const GATE_VERBS = ['Investigate', 'Defer'];
const RECOMMENDED_VERB = 'Investigate';

/**
 * _surfaceSlug(v) -> string
 *
 * Reduce the surface name to a bounded lowercase slug so the header can name the
 * surface CATEGORY without ever carrying an offending byte (D-09). Anything
 * non-slug collapses to 'unknown'.
 */
function _surfaceSlug(v) {
  if (typeof v !== 'string' || v.length === 0) return 'unknown';
  const s = v.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40);
  return s.length > 0 ? s : 'unknown';
}

/**
 * _count(v) -> number
 *
 * Coerce findingCount to a non-negative integer for the header. Anything
 * non-numeric collapses to 0.
 */
function _count(v) {
  const n = (typeof v === 'number' && isFinite(v)) ? Math.floor(v) : 0;
  return n >= 0 ? n : 0;
}

/**
 * renderGate({ surface, findingCount, ruleId }) -> { zones, contract }
 *
 * Compose the Shape F.1 renderer with the fixed {Investigate, Defer} verb set and
 * a surface-slug-plus-count-only header (never a file path, never matched bytes).
 * The gate is always a Mode-A decision gate (tier:2, Investigate recommended).
 * Returns the renderer's { zones, contract } straight through. Asserts by
 * construction that both gate verbs survived into the contract before returning.
 */
function renderGate(input) {
  const v = (input && typeof input === 'object') ? input : {};
  const surfaceSlug = _surfaceSlug(v.surface);
  const findingCount = _count(v.findingCount);
  const header = '-- agentshield -- ' + findingCount + ' new finding(s) on '
    + surfaceSlug + ' -- pick --';

  const renderShapeF1 = require(RENDERER_PATH).renderShapeF1;
  const out = renderShapeF1({
    tier: 2, // Mode A -- the drift gate always recommends Investigate.
    recommendedVerb: RECOMMENDED_VERB,
    verbs: GATE_VERBS.slice(),
    header: header,
  });

  // By-construction assertion: the composed contract MUST carry both gate verbs.
  // The verb set is fixed above so this can never trip; it is a self-check that
  // fails LOUD rather than silently surface a malformed gate.
  const verbs = (out && out.contract && Array.isArray(out.contract.verbs))
    ? out.contract.verbs
    : [];
  for (let i = 0; i < GATE_VERBS.length; i++) {
    if (verbs.indexOf(GATE_VERBS[i]) === -1) {
      throw new Error('agentshield-drift-gate: gate verb "' + GATE_VERBS[i]
        + '" missing from composed contract');
    }
  }
  return out;
}

/**
 * findingKey(finding) -> string
 *
 * The stable local dedup key for a scan finding: surface + ruleId + id. This is
 * the key the drift cache stores and shouldRender checks against, so the SAME
 * finding on the SAME surface with the SAME rule never re-renders across sessions.
 */
function findingKey(finding) {
  const f = (finding && typeof finding === 'object') ? finding : {};
  return String(f.surface) + '::' + String(f.ruleId) + '::' + String(f.id);
}

/**
 * shouldRender(cacheEntry, finding) -> boolean
 *
 * Returns false when the finding's surface+ruleId+id key was already present in
 * the local dedup cache (already surfaced in a prior session), true otherwise.
 * cacheEntry is the parsed local cache object; its `keys` array holds the seen
 * finding keys. A missing / malformed cache means nothing has been seen yet, so a
 * finding renders.
 */
function shouldRender(cacheEntry, finding) {
  if (!finding || typeof finding !== 'object') return false;
  const seen = (cacheEntry && Array.isArray(cacheEntry.keys)) ? cacheEntry.keys : [];
  return seen.indexOf(findingKey(finding)) === -1;
}

module.exports = {
  renderGate: renderGate,
  shouldRender: shouldRender,
  findingKey: findingKey,
  GATE_VERBS: GATE_VERBS.slice(),
  RECOMMENDED_VERB: RECOMMENDED_VERB,
};
