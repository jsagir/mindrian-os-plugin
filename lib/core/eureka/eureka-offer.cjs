'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 213-04 -- the LarryReacts leg: the eureka OFFER composer.
 *
 * WHAT THIS IS
 *   The PURE composer that turns a guard-cleared eureka side-channel payload
 *   (the plan-02 closed schema, <roomDir>/.mindrian/last-eureka.json) into
 *   Shape-F offer CONTENT: one hedged Larry line naming the two bridged node
 *   HANDLES + the transfer-direction enum, plus a recommended next-command chain
 *   drawn from the registry. It emits exactly ONE offer object or null; never a
 *   list, never an execution.
 *
 * SHAPE-F OPTION CONTENT ONLY (no new selector, no render fork)
 *   This module adds NO new selector and NO render fork. decide() is the ONE
 *   selection brain (SENS-13 already rides the frozen deep_research reach, which
 *   maps to the closed 'Spawn Sub-Agent' shape); this composer only produces the
 *   option-content object the shipped fired-reach render path reads. SEED-020
 *   single-door discipline is respected: no bespoke selector is built here.
 *
 * PART-8 FENCE (handles + enums only into the rendered line)
 *   The offer text is composed ONLY from the two opaque node-id HANDLES, the
 *   direction enum, and a FIXED hedged template. NOTHING from any bridge content
 *   field enters the line (the plan-02 side-channel carries no content fields by
 *   schema; the token-whitelist test arm is the fence). The optional Brain leg
 *   (recommendFrameworkChain) carries generic framework names + a problem-type
 *   enum only, behind its own Part-8 guard and its isAvailable() sync degrade, so
 *   the offer works fully OFFLINE.
 *
 * CONFIDENCE PASSTHROUGH (D-02)
 *   Confidence is threaded STRAIGHT THROUGH from payload.guard.confidence -- the
 *   side-channel guard confidence band. It is NEVER re-derived or re-weighted
 *   downstream; no local scoring code path exists.
 *
 * HEDGED VOICE (Canon Part 12)
 *   Larry voices it HEDGED: an opportunity plus a question, never a grade, never
 *   a directive. The template ends in a question mark and carries no grading
 *   vocabulary and no imperative command.
 *
 * SINGLE COMMAND-TRUTH SOURCE (LOCKED)
 *   The recommended next command comes from commands/*.md frontmatter via
 *   data/command-registry.json through composeWorkflow -- the SINGLE canonical
 *   command-truth source. No local graph read, no sub-room read, no enrichment
 *   input ever becomes a runtime path here.
 *
 * NEVER EXECUTES (recommend, never trigger)
 *   This module composes an offer and STOPS at content. It never requires the
 *   shipped chain runner and never invokes any command. runChain consumption of
 *   a CONFIRMED offer is the existing act-command path (autonomous_safe prefix,
 *   HALT at first material step, EXEC budgets); the navigator confirm is the ONLY
 *   bridge to execution. LarryReacts recommends; the navigator triggers.
 *
 * House rule: hyphens only, no em-dashes. CJS only. Synchronous (the injected
 * recommend seam is kept sync-shaped per chain-recommender's sync degrade).
 */

// The transfer-direction enum -- the two surprise types the plan-02 side-channel
// records. Rendered LITERALLY into the offer line so the token-whitelist fence
// recognises it as an enum member (not free prose).
const DIRECTION_ENUM = Object.freeze(['structural_transfer', 'semantic_implementation']);

// The FIXED hedged Larry line (Canon Part 12): an opportunity plus a question,
// never a grade, never an imperative. The three placeholders are the ONLY
// variable tokens -- {{A}} and {{B}} are the two opaque node HANDLES, {{DIR}} is
// a DIRECTION_ENUM member. Every other token is fixed template vocabulary. The
// token-whitelist test arm asserts nothing else survives into the rendered text.
const OFFER_TEMPLATE =
  '{{A}} and {{B}} look like the same underlying structure, a {{DIR}} bridge. ' +
  'Here is the opportunity. Want to pursue this bridge?';

// The degrade seed when the recommend leg yields nothing / throws / is offline.
// A true statement (reliability rule 5: degrade, do not fabricate); mirrors
// chain-recommender's own DEFAULT_SEED so the offline chain is a real framework.
const FALLBACK_SEED = 'Beautiful Question Framework';

/**
 * _isTransferablePayload(p) -> boolean
 *
 * The abstention gate. A payload composes an offer ONLY when it is the plan-02
 * closed schema with guard.verdict 'transferable', a string confidence band, two
 * non-empty string handles, and a surprise_type inside DIRECTION_ENUM. Any other
 * shape (absent, malformed, non-transferable verdict, unknown direction) is an
 * abstention -- a wrong offer trains the ignore reflex, so we stay silent.
 */
function _isTransferablePayload(p) {
  if (!p || typeof p !== 'object') return false;
  const g = p.guard;
  if (!g || typeof g !== 'object') return false;
  if (g.verdict !== 'transferable') return false;
  if (typeof g.confidence !== 'string' || g.confidence.length === 0) return false;
  const b = p.bridge;
  if (!b || typeof b !== 'object') return false;
  if (typeof b.a_handle !== 'string' || b.a_handle.length === 0) return false;
  if (typeof b.b_handle !== 'string' || b.b_handle.length === 0) return false;
  if (DIRECTION_ENUM.indexOf(b.surprise_type) === -1) return false;
  return true;
}

/**
 * _renderOfferText(aHandle, bHandle, direction) -> string
 *
 * Fill the FIXED template with the two handles + the direction enum member.
 * Function replacements avoid String.replace's `$` special-casing so an opaque
 * handle is inserted verbatim. Handles + enum + fixed template only -- the
 * Part-8 fence at the text layer.
 */
function _renderOfferText(aHandle, bHandle, direction) {
  return OFFER_TEMPLATE
    .replace('{{A}}', function () { return aHandle; })
    .replace('{{B}}', function () { return bHandle; })
    .replace('{{DIR}}', function () { return direction; });
}

// The default recommend seam: the shipped LOCAL/offline-degrading framework-chain
// recommender. Lazy-required so a load failure degrades gracefully rather than
// crashing the composer at require time.
function _defaultRecommend(opts) {
  const recommender = require('../../brain/chain-recommender.cjs');
  return recommender.recommendFrameworkChain(opts);
}

// The default workflow seam: the SINGLE deterministic door from framework name to
// command (registry-only, never the Brain). A framework with no registry command
// degrades to { command: null, optional: true } inside composeWorkflow -- that
// contract is honored here, never re-implemented.
function _defaultComposeWorkflow(chain) {
  const resolver = require('../../workflow/command-resolver.cjs');
  return resolver.composeWorkflow(chain);
}

/**
 * _buildNextSegue(problemType, recommendFn, composeWorkflowFn) -> { chain, workflow }
 *
 * The next-command segue. chain = recommendFrameworkChain({ problemType }) (or an
 * injected recommendFn), with try/catch degrade to [FALLBACK_SEED]; workflow =
 * composeWorkflow(chain) (or an injected composeWorkflowFn) attaching the
 * registry command to each framework. Fully offline-capable: a seed-only chain
 * (length 1) still yields a one-step workflow. Never throws.
 */
function _buildNextSegue(problemType, recommendFn, composeWorkflowFn) {
  const pt = (typeof problemType === 'string' && problemType.length > 0) ? problemType : null;

  let chain;
  try {
    const rf = (typeof recommendFn === 'function') ? recommendFn : _defaultRecommend;
    chain = rf({ problemType: pt });
  } catch (_e) {
    chain = null;
  }
  if (!Array.isArray(chain)) chain = [FALLBACK_SEED];
  const cleaned = chain.filter(function (x) { return typeof x === 'string' && x.length > 0; });
  if (cleaned.length === 0) cleaned.push(FALLBACK_SEED);

  let workflow;
  try {
    const wf = (typeof composeWorkflowFn === 'function') ? composeWorkflowFn : _defaultComposeWorkflow;
    workflow = wf(cleaned);
  } catch (_e) {
    workflow = [];
  }
  if (!Array.isArray(workflow)) workflow = [];

  return { chain: cleaned, workflow: workflow };
}

/**
 * composeEurekaOffer({ payload, recommendFn?, composeWorkflowFn?, problemType? })
 *   -> offer | null
 *
 * The single-offer contract (the navigation-engine-offer idiom). Returns EXACTLY
 * ONE hedged offer object:
 *   { text, a_handle, b_handle, direction, confidence, next: { chain, workflow } }
 * or null (abstention). Never throws, never a list, never an execution.
 *
 *   - direction is a DIRECTION_ENUM member (mapped from bridge.surprise_type).
 *   - confidence === payload.guard.confidence (D-02 passthrough, never recomputed).
 *   - text names both handles + the direction enum, hedged, ending in a question.
 *   - next.chain is the recommended framework chain (offline-full-function).
 *   - next.workflow attaches registry commands via composeWorkflow.
 *
 * @param {{ payload?: object, recommendFn?: function, composeWorkflowFn?: function,
 *           problemType?: string }} [args]
 * @returns {object|null}
 */
function composeEurekaOffer(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    const payload = a.payload;
    if (!_isTransferablePayload(payload)) return null;

    const bridge = payload.bridge;
    const guard = payload.guard;

    const direction = bridge.surprise_type;   // validated in DIRECTION_ENUM above
    const aHandle = bridge.a_handle;
    const bHandle = bridge.b_handle;
    const confidence = guard.confidence;       // straight-through, never re-derived

    const text = _renderOfferText(aHandle, bHandle, direction);
    const next = _buildNextSegue(a.problemType, a.recommendFn, a.composeWorkflowFn);

    return {
      text: text,
      a_handle: aHandle,
      b_handle: bHandle,
      direction: direction,
      confidence: confidence,
      next: next,
    };
  } catch (_e) {
    // Any internal failure -> abstain (never throw; a wrong offer is worse than
    // no offer).
    return null;
  }
}

module.exports = {
  composeEurekaOffer: composeEurekaOffer,
  DIRECTION_ENUM: DIRECTION_ENUM,
  // Exposed for the token-whitelist test arm (fixed-template vocabulary) + the
  // offline degrade seed. Not a second selector, not a render door.
  OFFER_TEMPLATE: OFFER_TEMPLATE,
  FALLBACK_SEED: FALLBACK_SEED,
};
