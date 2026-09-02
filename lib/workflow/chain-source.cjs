'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 254 Plan 01 Task 2 -- the ONE shared chain-source seam this phase's
 * wiring hangs off (D-03, blend-never-replace, locked from research and
 * reproduced live -- not a preference).
 *
 * WHAT: resolveChainSource(opts) asks the shipped governed seed producer
 * (lib/brain/chain-recommender.cjs::recommendFrameworkChain) for the seed and
 * the registry-floor answer in one call, tries the shipped multi-hop
 * projection recommender (lib/workflow/local-chain-recommender.cjs) from that
 * seed, and returns whichever won WITH its provenance. It mints nothing: not
 * a second recommender, not a second ranker, not a second resolver, not a
 * second posture authority (254-RESEARCH.md "Don't Hand-Roll" -- this phase's
 * named failure mode is building a second thing that already exists).
 *
 * (a) Part 7 / R4 / R6 fence: this module mints NO recommender, NO ranker, NO
 *     framework-to-command resolver and NO posture authority. `composeWorkflow`
 *     (R4, the one door) and `recipe-maps.postureForCommand` (the ONE posture
 *     authority -- Phase 237-02 measured 48/112 disagreements and 12 material
 *     auto-runs when a second authority existed) are untouched by this phase
 *     and are NOT called from here. Resolution to /mos: commands and posture
 *     stay at the two command surfaces (Plan 02's job).
 *
 * (b) The known stderr interaction: recommendFrameworkChain may emit its
 *     Phase 252-01 SWEEP-01 stderr line ("seed-only chain served, not
 *     graph-grounded") when the Brain is unavailable AND its own result is
 *     seed-only. When step 3 below then UPGRADES to a projection chain, that
 *     stderr line is stale. This module does NOT suppress it and does NOT
 *     modify recommendFrameworkChain -- 14+ callers key on its current
 *     contract and Phase 252-01 deliberately chose stderr over a return-shape
 *     change. describeSource()'s stdout line is AUTHORITATIVE about which
 *     source actually won; Plan 02 wires it into both renders. Do not later
 *     "fix" the stale stderr line by reaching into the shared recommender.
 *
 * (c) R7 / D-04: this module is NOT on decide()'s path and must never be
 *     required from navigation-engine.cjs or from either projection reader.
 *     Plan 06's structural fence asserts exactly that, and Wave 1's
 *     independence from the composition ruling depends on this module
 *     staying local-only.
 *
 * Canon Part 8: the projection and curated_chains carry only generic
 * machinery metadata (framework-name pairs and a scalar confidence). No user
 * content is read or emitted here, and reading a committed local JSON file
 * opens no wire.
 *
 * Local-Only (R7 / INV-12): this module requires ONLY
 * lib/brain/chain-recommender.cjs and lib/workflow/local-chain-recommender.cjs
 * (plus node:path). No brain-client, no fetch, no node:http/https, no
 * child_process, no composeWorkflow, no postureForCommand.
 *
 * Hyphens only, no em-dashes.
 */

const chainRecommender = require('../brain/chain-recommender.cjs');
const localChainRecommender = require('./local-chain-recommender.cjs');

// MAX_HOPS mirrors chain-recommender's own governed chain-length ceiling
// (MAX_CHAIN_LENGTH - 1: seed + up to 3 successors) -- derived from the
// imported constant rather than a bare literal, so the two cannot drift.
const MAX_HOPS = chainRecommender.MAX_CHAIN_LENGTH - 1;

// ---------------------------------------------------------------------------
// resolveChainSource(opts) -- the projection-first blend seam with a
// disclosed registry floor.
//
//   opts.problemType      optional -- forwarded to recommendFrameworkChain
//   opts.currentFramework optional -- forwarded to recommendFrameworkChain
//   opts.roomState        optional -- forwarded to recommendFrameworkChain
//   opts.projection        optional in-memory projection fixture (test seam);
//                          forwarded to recommendMultiHopChains ONLY when the
//                          caller supplied it.
//   opts.curatedChains     optional in-memory curated_chains fixture (test
//                          seam); forwarded ONLY when the caller supplied it.
//
// Algorithm (D-03, exact order):
//   1. floor = chainRecommender.recommendFrameworkChain(opts) -- yields the
//      GOVERNED seed (floor[0], never re-derived here -- _pickSeed is private
//      and problem-type-router is its one owner, R4) and the registry-floor
//      answer. Always a non-empty string[]; never throws.
//   2. seed = floor[0]. candidates = localChainRecommender.recommendMultiHopChains
//      ({ from: seed, maxHops: MAX_HOPS, projection, curatedChains }), passing
//      the fixture seam through only when supplied.
//   3. candidates.length > 0 -> take candidates[0] AS-IS (no re-sort, no
//      re-rank, no confidence filter -- R6: the shipped module already orders
//      hops ASC then composed-confidence DESC and the final surfaced ordering
//      is the Part-3 ranker's job, not this seam's). source: 'projection'.
//   4. else -> source: 'registry-floor', frameworks: floor, the four
//      projection-only fields null.
//   5. Never throws: any internal error degrades to a registry-floor answer.
//
// Returns { seed, frameworks, source, confidence, hops, transforms, kinds }.
// ---------------------------------------------------------------------------
function resolveChainSource(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};

  let floor;
  try {
    floor = chainRecommender.recommendFrameworkChain(o);
  } catch (_e) {
    floor = null;
  }
  if (!Array.isArray(floor) || floor.length === 0) {
    // recommendFrameworkChain contractually never returns empty, but this
    // seam must not become the first thing that throws at its two
    // user-facing CLI consumers, so degrade to the frozen DEFAULT_SEED.
    floor = [chainRecommender.DEFAULT_SEED];
  }
  const seed = floor[0];

  try {
    const multiHopArgs = { from: seed, maxHops: MAX_HOPS };
    if (Object.prototype.hasOwnProperty.call(o, 'projection')) multiHopArgs.projection = o.projection;
    if (Object.prototype.hasOwnProperty.call(o, 'curatedChains')) multiHopArgs.curatedChains = o.curatedChains;

    const candidates = localChainRecommender.recommendMultiHopChains(multiHopArgs);

    if (Array.isArray(candidates) && candidates.length > 0) {
      const top = candidates[0];
      return {
        seed: seed,
        frameworks: top.path,
        source: 'projection',
        confidence: top.confidence,
        hops: top.hops,
        transforms: top.transforms,
        kinds: top.kinds,
      };
    }

    return {
      seed: seed,
      frameworks: floor,
      source: 'registry-floor',
      confidence: null,
      hops: null,
      transforms: null,
      kinds: null,
    };
  } catch (_e) {
    // Step 5: never throw at the two user-facing CLI consumers -- degrade to
    // the registry floor. `floor` is already guaranteed non-empty by this
    // point in the function (either recommendFrameworkChain's contractual
    // non-empty return, or the explicit DEFAULT_SEED fallback above), so no
    // `: [seed]` fallback is reachable here -- see WR-01, 254-REVIEW.md.
    return {
      seed: seed,
      frameworks: floor,
      source: 'registry-floor',
      confidence: null,
      hops: null,
      transforms: null,
      kinds: null,
    };
  }
}

// ---------------------------------------------------------------------------
// describeSource(result) -- the ONE disclosure string both surfaces print
// (Decision 8, D-03 step 4). Both consumers print the SAME function's output,
// which is what makes WIRE-03's "cannot disagree" check in Plan 02 a real
// structural proof rather than two hand-matched strings.
// ---------------------------------------------------------------------------
function describeSource(result) {
  const r = (result && typeof result === 'object') ? result : {};
  if (r.source === 'projection') {
    const renderedConfidence = String(Number(Number(r.confidence).toFixed(4)));
    return 'Chain source: projection (' + r.hops + '-hop path, composed confidence ' + renderedConfidence + ')';
  }
  return 'Chain source: registry floor (the projection carries no chain edge for "' + r.seed + '")';
}

module.exports = {
  resolveChainSource: resolveChainSource,
  describeSource: describeSource,
  MAX_HOPS: MAX_HOPS,
};
