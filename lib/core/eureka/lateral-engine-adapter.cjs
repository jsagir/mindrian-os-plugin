'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 213-05 (205 touchpoint, post-210 semantics) -- the RS discriminator
 * adapter that occupies the Phase 205 pre-drilled ctx.lateralEngine socket
 * (lib/core/fusion-router.cjs:283, contract at :418-458).
 *
 * fusion-router.cjs is NOT edited: the socket already exists. This module is the
 * live OCCUPANT the caller injects on ctx.lateralEngine per call. Injection is the
 * CALLER's choice each pass (fresh resolution, never registration-frozen -- the
 * ui4/MCP-staleness lesson from the statusline-ratification-cue precedent). The
 * adapter's output feeds the quorum's SUGGEST path only (Phase 210-D: the quorum
 * suggests its cross-frame hypothesis; nothing downstream treats it as mandatory).
 *
 * The socket contract the router keys on is minimal: an object with a `score`
 * function. When present, runLateralPath routes to 'rs_sideways_engine' and leaves
 * differential_score null AT THE ROUTER (computed downstream, never fabricated).
 * When absent, the router ships its own blocked_until_phase_200_rs degrade
 * byte-unchanged. This adapter therefore only has to satisfy the { score } shape
 * and self-degrade to a null-never-fabricated result on any fault.
 *
 * The scoring itself reuses rs-differential-scorer.cjs::scoreMeasured, which self-
 * audits Canon Part 8 (dual-layer pre-input + pre-return scans) and self-degrades
 * on encoder-unavailability. We never re-implement that math and never bypass its
 * audit. On ANY degrade (throw, rejection, unavailable encoder, malformed result)
 * the adapter returns differential_score: null -- it is a TAMPERING guard
 * (T-213-15): a differential is measured or it is null, never invented.
 *
 * Node built-ins + one internal require, CJS, no runtime deps. No em-dashes.
 */

const { scoreMeasured } = require('../rs-differential-scorer.cjs');

// The null-never-fabricated result: what the adapter returns on any degrade.
function degraded() {
  return {
    differential_score: null,
    band: null,
    surprise_type: null,
    provenance: null,
  };
}

// Pull the comparable text off a caller-owned frame/pair object. The pair objects
// are opaque to this module; we read the first present text-bearing field and fall
// back to an empty string so scoreMeasured's Part-8 pre-input scan still runs.
function frameText(frame) {
  if (frame == null) return '';
  if (typeof frame === 'string') return frame;
  if (typeof frame !== 'object') return String(frame);
  if (typeof frame.text === 'string') return frame.text;
  if (typeof frame.surface === 'string') return frame.surface;
  if (typeof frame.structure === 'string') return frame.structure;
  if (typeof frame.frameKey === 'string') return frame.frameKey;
  return '';
}

/**
 * makeLateralEngine({ scoreFn, encodeFn } = {}) -> { score }
 *
 * @param {object}   [deps]
 * @param {function} [deps.scoreFn]  async (a, b, opts) => scoreMeasured-shaped result
 *                                   (injectable for hermetic tests; defaults to the
 *                                   shipped scoreMeasured).
 * @param {function} [deps.encodeFn] injectable semantic leg (texts -> number[][]),
 *                                   forwarded to scoreMeasured for offline tests.
 * @returns {{ score: (pair: object[], structure: string) => Promise<object> }}
 *
 * score(pair, structure): extracts the two frames' text from the caller-owned pair,
 * delegates to (scoreFn || scoreMeasured), and maps the result to the socket's
 * downstream shape { differential_score, band, surprise_type, provenance }. Returns
 * a degraded() result (all null) on any fault -- never throws, never fabricates.
 */
function makeLateralEngine(deps) {
  const d = deps && typeof deps === 'object' ? deps : {};
  const scoreFn = typeof d.scoreFn === 'function' ? d.scoreFn : scoreMeasured;
  const encodeFn = typeof d.encodeFn === 'function' ? d.encodeFn : null;

  async function score(pair, structure) {
    try {
      const p = Array.isArray(pair) ? pair : [];
      const a = frameText(p[0]);
      const b = frameText(p[1]);
      const opts = encodeFn ? { encodeFn: encodeFn } : {};
      const result = await scoreFn(a, b, opts);
      if (!result || typeof result !== 'object') return degraded();

      // signed_diff is the differential; null (not fabricated) when the scorer
      // could not measure it (encoder unavailable / degraded leg).
      const diff = (result.signed_diff === undefined || result.signed_diff === null)
        ? null
        : result.signed_diff;
      // surprise_type: scoreMeasured names it `direction`; an injected scoreFn may
      // already name it `surprise_type`. Accept either; null when neither is set.
      const surprise = result.surprise_type != null
        ? result.surprise_type
        : (result.direction != null ? result.direction : null);
      return {
        differential_score: diff,
        band: result.band != null ? result.band : null,
        surprise_type: surprise,
        provenance: result.provenance != null ? result.provenance : null,
      };
    } catch (_e) {
      return degraded();
    }
  }

  // `structure` is currently unused by score()'s mapping (the router owns routing
  // and the scorer owns the math); it stays in the signature to match the socket
  // contract and to keep the seam ready for a structure-conditioned scorer later.
  return { score: score };
}

module.exports = {
  makeLateralEngine: makeLateralEngine,
};
