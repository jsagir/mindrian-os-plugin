'use strict';

/**
 * Phase 127-02 BRAIN-MCP-127-09 -- Tier-0 messaging chokepoint.
 * Phase 252-01 (SWEEP-01) -- renamed from tier0-messaging.cjs to
 * refusal-messaging.cjs (git mv, history follows). FILE RENAME ONLY: zero
 * export renames, zero value edits. The wire contract stays byte-locked --
 * DIRECTOR_NOT_AVAILABLE, the five sentinel keys, tier0Response()'s exact
 * shape (including reason 'MINDRIAN_BRAIN_KEY not set'), and the 250-04
 * reframed no_key copy are all byte-identical before and after the rename.
 * "tier0" is dying doctrine; "refusal" is the honesty-rail doctrine this
 * module now enforces -- the name now matches what it does.
 * Phase 250-01 (HONEST-01, AVAIL-02) -- the honesty rail amendment: this
 * module's own header names it a phase-amendment boundary ("values are
 * human-facing and may evolve, but only via explicit phase amendment") --
 * this IS that amendment. The silent-fallback / graceful-degradation framing
 * is replaced with a typed, visible refusal rail: four refusal kinds
 * (no_key, unreachable, tier_denied, not_ready), honest per-kind reasons,
 * and the shim's transport-null/no-key conflation bug (site #9 of the
 * doctrine kill list) is fixed at its source (bin/mindrian-brain-mcp-client.cjs).
 *
 * Single source-of-truth for the DIRECTOR_NOT_AVAILABLE sentinel shape AND
 * the refusalResponse/renderRefusal/larryRefusalLine/refuseNotReady family,
 * used across the plugin:
 *   - bin/mindrian-brain-mcp-client.cjs (the stdio shim from Phase 127-00)
 *   - Larry's prose surface (one-line hint via larryTier0Hint / larryRefusalLine)
 *   - Future statusline + /mos:status surfaces (CONTEXT acceptance gate #4)
 *   - /mos: command CLI-path render adoption (documented contract for
 *     renderRefusal; per-command adoption rides Phase 252's sweep)
 *
 * Before this chokepoint, the shim shipped its own inline copy of the
 * sentinel shape. Future surfaces (statusline, /mos:status, persona output)
 * would each duplicate the same shape, drifting on the upgrade_hint URL or
 * the fallback_advice phrasing. This module locks the wire shape and the
 * Larry-prose phrasing so every consumer reads the same canonical bytes.
 *
 * Wire shape locked here (BRAIN-MCP-127-09 invariant, byte-locked, unchanged
 * by 250-01):
 *   {
 *     status:           "DIRECTOR_NOT_AVAILABLE",
 *     reason:           "MINDRIAN_BRAIN_KEY not set",
 *     command_context:  <toolName string | "unknown" for non-string input>,
 *     upgrade_hint:     "Request a Brain key at https://mindrian-os.com/brain-access",
 *     fallback_advice:  refusal-framed value (250-01; VALUE amended, keys unchanged)
 *   }
 *
 * The refusalResponse(kind, ctx) shape (250-01, new):
 *   {
 *     status:          KIND_STATUS[kind] (DIRECTOR_NOT_AVAILABLE for no_key,
 *                        sibling statuses BRAIN_UNREACHABLE / BRAIN_TIER_DENIED
 *                        / GRAPH_NOT_READY for the other three),
 *     kind:            one of REFUSAL_KINDS,
 *     reason:          honest per-kind reason string (V5 rule: interpolates
 *                        ONLY closed-enum kind, coerced tool name, canonical
 *                        framework name, and the server message already
 *                        sliced to 300 chars upstream in brain-client),
 *     command_context: coerced tool name | "unknown",
 *     next_moves:      array of short option handles (F.1 next-move set),
 *     upgrade_hint?:   present only for kind === 'no_key'
 *   }
 *
 * Canon Part 7 (reuse): isAvailable() is a one-line delegation to
 *   brain-client.cjs's existing isAvailable(); no parallel key-resolver code
 *   path lives here. The shim's local tier0Response becomes a one-line
 *   passthrough after the Phase 127-02 refactor; no duplicate shape exists.
 *   refuseNotReady() lazily requires ./enrichment-queue.cjs (Phase 249-01's
 *   queue) rather than building a second queue.
 *
 * Canon Part 8 (graph boundary): zero network surface in this file.
 *   isAvailable() delegates to brain-client.cjs (the existing chokepoint that
 *   reads ONLY the LOCAL key via resolve-brain-key.cjs). No fetch, no http,
 *   no Brain endpoint domain strings. Refusal reasons never print a key
 *   value or key-file CONTENTS (path NAMES like ~/.mindrian.env are fine and
 *   already shipped in the hint); never echo user turn text.
 *
 * HARD RULE: no em-dashes anywhere in this file (hyphens only).
 */

const brainClient = require('./brain-client.cjs');

// Locked wire string. Renaming this constant breaks every downstream consumer
// (the shim, Larry's prose surface, the doctor's Class-M smoke L5 check).
// Treat as a phase-amendment boundary.
const DIRECTOR_NOT_AVAILABLE = 'DIRECTOR_NOT_AVAILABLE';

// Locked sentinel strings. Tests assert the keys; the values are
// human-facing and may evolve, but only via explicit phase amendment.
const REASON_NO_KEY = 'MINDRIAN_BRAIN_KEY not set';
// Phase 250-04 (HONEST-03, SEED-011 Option A): reframed for the failure-edge
// default. Silent registration (a fresh install auto-mints a READ-tier
// token at the first consult) is the DEFAULT path now, so a no_key refusal
// no longer means "nobody set up a key" -- it means registration failed or
// the Brain was offline (or the operator explicitly opted out). The manual
// key remains the OVERRIDE path, not the ceremony. Still matches the loose
// /brain-access/ regex both existing tests assert (refusal-messaging.test.cjs,
// test-127-00-shim-handshake.sh) -- only the framing changed, not the URL.
const UPGRADE_HINT = 'Silent registration should have handled this automatically; if it keeps failing or you need an explicit key, request one as an override at https://mindrian-os.com/brain-access';
// Phase 250-01 (HONEST-01, Doctrine Site #8): rewritten from graceful-
// degradation framing to refusal framing. Still matches the existing loose
// /Larry/ test regex; the old phrase "Larry can still talk with you" is gone.
const FALLBACK_ADVICE = 'Larry does not improvise methodology. Methodology comes from the Brain or it is refused, visibly. Conversation and room context remain available.';

/**
 * Construct the Tier-0 sentinel response. Returned by every Brain-tool entry
 * point when no key is resolvable. The shape is byte-locked.
 *
 * Defensive: non-string / empty / non-truthy commandContext arguments coerce
 * to "unknown" so the wire shape is invariant under bad-caller inputs (the
 * shim's tool-handler closure passes the literal tool name; future callers
 * may pass null in error paths).
 *
 * @param {string} commandContext  the tool name (e.g. "brain_ask"); falls back
 *                                 to "unknown" for non-string / empty inputs.
 * @returns {{status: string, reason: string, command_context: string,
 *            upgrade_hint: string, fallback_advice: string}}
 */
function tier0Response(commandContext) {
  const ctx = (typeof commandContext === 'string' && commandContext.length > 0)
    ? commandContext
    : 'unknown';
  return {
    status: DIRECTOR_NOT_AVAILABLE,
    reason: REASON_NO_KEY,
    command_context: ctx,
    upgrade_hint: UPGRADE_HINT,
    fallback_advice: FALLBACK_ADVICE,
  };
}

/**
 * Is the Brain reachable from this process right now? Delegates to
 * brain-client.cjs's existing chokepoint (which reads only the LOCAL key via
 * resolve-brain-key.cjs). One-line passthrough -- never duplicate the key
 * resolution logic.
 *
 * @returns {boolean}
 */
function isAvailable() {
  return brainClient.isAvailable();
}

/**
 * One-line Larry-prose hint for the Tier-0 path. Used by Larry's surface
 * (and future statusline / /mos:status) when isAvailable() returns false to
 * tell the user how to unlock Brain. Locked under 120 chars so it fits in
 * statusline + chat-prefix surfaces without truncation.
 *
 * @returns {string}
 */
function larryTier0Hint() {
  return 'Methodology orchestration needs a Brain key. Drop one in ~/.mindrian.env or set MINDRIAN_BRAIN_KEY.';
}

// -----------------------------------------------------------------------
// Phase 250-01 (HONEST-01, AVAIL-02) -- the visible refusal rail.
// -----------------------------------------------------------------------

// Phase 259 (TRUST-01, F-09 Option B): REFUSAL_KINDS grows from four to
// five members. Plan 259-01 added a distinct `rate_limited` sentinel to
// brain-client.cjs::callTool() (a Brain 429, honored via Retry-After with
// bounded backoff, D-01/D-02/D-03) -- but every function below coerced any
// unrecognized kind to the transient-class default (refusalResponse :246,
// renderRefusal :316, larryRefusalLine :334). Without this amendment, the moment anything
// rendered the new sentinel through this chokepoint the operator would see
// BRAIN_UNREACHABLE again: TRUST-01's own bug, relocated one layer up. This
// amends two contracts prior phases deliberately froze:
// tests/test-250-refusal-shapes.cjs Test 1 (the four-member deepStrictEqual)
// and lib/core/doctor/class-m-brain-smoke.cjs's STRUCTURED_REFUSAL_STATUSES
// (both amended in the same Phase 259 Plan 02 commit set). rate_limited is
// APPENDED LAST -- the original four positions are unchanged.
//
// Frozen five-member closed set. Order is the data4sci four-class error
// taxonomy mapping (research Pattern 1) plus rate_limited: no_key/tier_denied
// are validation-class, unreachable is transient-class (AVAIL-02's retry
// lives BEFORE this kind ever fires), not_ready is missing-information-class
// (never auto-retried; the right move is to queue enrichment), and
// rate_limited is ALSO transient-class like unreachable but with a KNOWN
// wait -- that known wait is what makes it a distinct kind rather than a
// flavor of unreachable.
const REFUSAL_KINDS = Object.freeze(['no_key', 'unreachable', 'tier_denied', 'not_ready', 'rate_limited']);

// no_key keeps the byte-locked DIRECTOR_NOT_AVAILABLE wire string for
// downstream compat (shim, statusline, doctor smoke). The other three kinds
// get honest sibling statuses -- never reuse DIRECTOR_NOT_AVAILABLE for a
// transport, tier, or readiness failure (that reuse IS the conflation bug).
const KIND_STATUS = Object.freeze({
  no_key: DIRECTOR_NOT_AVAILABLE,
  unreachable: 'BRAIN_UNREACHABLE',
  tier_denied: 'BRAIN_TIER_DENIED',
  not_ready: 'GRAPH_NOT_READY',
  // Phase 259 (TRUST-01): its own sibling status, never a reuse of
  // BRAIN_UNREACHABLE or DIRECTOR_NOT_AVAILABLE -- that reuse IS the
  // conflation bug this comment block above already names.
  rate_limited: 'BRAIN_RATE_LIMITED',
});

// V5 rule (threat model T-250-01/T-250-02): every REASONS function
// interpolates ONLY closed-enum kind, a coerced tool name, a canonical
// framework name, and the server message (already sliced to 300 chars
// upstream in brain-client's 403 branch). Never render an unbounded server
// body; never echo user turn text; never print a key value or key-file
// contents (path NAMES like ~/.mindrian.env are fine).
// Phase 250-04 (HONEST-03): the no_key reason/copy is reframed for the
// FAILURE-EDGE default. Silent registration is the normal path now (a fresh
// install mints a token with zero ceremony); no_key means that attempt
// failed or the Brain was offline (or MINDRIAN_DISABLE_AUTO_REGISTER was
// set), never "the user forgot to get a key". An optional c.registration_
// reason (sourced from brain-client's getAutoRegisterFailureReason()) lets
// the caller surface the honest specific cause; a generic phrase covers the
// common case where no specific reason was captured.
function _noKeyDetail(c) {
  return (typeof c.registration_reason === 'string' && c.registration_reason.length > 0)
    ? c.registration_reason
    : 'registration has not completed (offline, or the attempt failed)';
}

const REASONS = Object.freeze({
  no_key: function (c) {
    return 'Methodology needs the Brain for ' + c.tool + ', and ' + _noKeyDetail(c) + '. Larry will not improvise it from memory.';
  },
  unreachable: function (c) {
    return 'The methodology graph is unreachable right now for ' + c.tool + ' (after the bounded retry budget). Larry will not fake what it would say.';
  },
  tier_denied: function (c) {
    const msg = (typeof c.message === 'string' && c.message.length > 0)
      ? c.message
      : 'this key\'s tier does not allow ' + c.tool + '.';
    return 'The Brain declined ' + c.tool + ' for this key\'s tier: ' + msg;
  },
  not_ready: function (c) {
    const fw = (typeof c.framework === 'string' && c.framework.length > 0) ? c.framework : 'this framework';
    const score = Number.isInteger(c.readiness_score) ? c.readiness_score : 0;
    const missing = Array.isArray(c.missing_dimensions) && c.missing_dimensions.length > 0
      ? c.missing_dimensions.join(', ')
      : 'structure';
    return 'The graph doesn\'t have ' + fw + ' structured yet (readiness ' + score + '/4; missing: ' + missing + '). Queued for enrichment.';
  },
  // Phase 259 (TRUST-01): V5-compliant -- interpolates only the closed-enum
  // kind, the coerced tool name, and an integer retry_after_s (guarded by
  // Number.isInteger, the not_ready/readiness_score precedent just above).
  // Never renders an unbounded server body, never echoes user turn text.
  rate_limited: function (c) {
    const waitClause = Number.isInteger(c.retry_after_s)
      ? ' The Brain asked for ' + c.retry_after_s + 's before the next try.'
      : '';
    return 'The methodology graph is rate limiting ' + c.tool + ' right now, not down.' + waitClause + ' Larry will not fake what it would say.';
  },
});

// F.1 next-move option handles, per kind (SEED-021: fire the card, never
// draw the box -- this module supplies the handles, not the rendered UI).
const NEXT_MOVES = Object.freeze({
  no_key: Object.freeze(['connect_key', 'continue_without']),
  unreachable: Object.freeze(['retry', 'continue_without']),
  tier_denied: Object.freeze(['check_key_tier', 'continue_without']),
  not_ready: Object.freeze(['use_partial', 'continue_without']),
  // Phase 259 (TRUST-01): retry_after_wait, not the existing 'retry' --
  // retrying immediately is the wrong move on a rate limit. Verified this
  // session: zero consumers of any next_moves handle anywhere in the repo,
  // so a new handle name is safe to introduce.
  rate_limited: Object.freeze(['retry_after_wait', 'continue_without']),
});

/**
 * Construct a typed refusal response. Replaces "quieter Larry" doctrine at
 * the chokepoint: a failing methodology consult REFUSES visibly instead of
 * degrading silently. Byte-locked-compatible for kind === 'no_key' (status
 * stays DIRECTOR_NOT_AVAILABLE); the other three kinds carry sibling
 * statuses so a caller can distinguish them without string-matching reason.
 *
 * @param {string} kind  one of REFUSAL_KINDS; unrecognized values coerce to
 *                        'unreachable' (the existing tier0Response defensive
 *                        pattern, extended).
 * @param {object} [ctx]  { tool?, message?, framework?, readiness_score?,
 *                          missing_dimensions? }. Non-object/absent coerces
 *                          to {}.
 * @returns {{status: string, kind: string, reason: string,
 *            command_context: string, next_moves: string[],
 *            upgrade_hint?: string}}
 */
function refusalResponse(kind, ctx) {
  const k = REFUSAL_KINDS.indexOf(kind) !== -1 ? kind : 'unreachable';
  const c = (ctx && typeof ctx === 'object' && !Array.isArray(ctx)) ? ctx : {};
  const tool = (typeof c.tool === 'string' && c.tool.length > 0) ? c.tool : 'unknown';
  const cc = Object.assign({}, c, { tool: tool });

  const out = {
    status: KIND_STATUS[k],
    kind: k,
    reason: REASONS[k](cc),
    command_context: tool,
    next_moves: NEXT_MOVES[k].slice(),
  };
  if (k === 'no_key') {
    out.upgrade_hint = UPGRADE_HINT;
  }
  return out;
}

// Larry-voice full copy blocks (research Pattern 3), consumed by
// renderRefusal(). One honest sentence naming the kind, the queue
// disclosure for not_ready, then the next-move framing -- the F.1 card
// itself is fired by the instruction layer (SKILL.md), not built here.
const RENDER_COPY = Object.freeze({
  no_key: function (c) {
    return [
      'Methodology needs the Brain, and ' + _noKeyDetail(c) + '. I will not improvise it from memory.',
      'We can keep working with your room context, or you can set a key at ~/.mindrian.env (chmod 600) or MINDRIAN_BRAIN_KEY as an override, then restart.',
    ];
  },
  unreachable: function () {
    return [
      'I can\'t reach the methodology graph right now, so I will not fake what it would say.',
      'We can retry in a moment, or keep going with your room context.',
    ];
  },
  tier_denied: function (c) {
    const msg = (typeof c.message === 'string' && c.message.length > 0)
      ? c.message
      : 'this tool is not on the current key\'s tier allowlist';
    return [
      'The Brain declined that tool for this key\'s tier: ' + msg,
      'I will not substitute a guess. Check the key tier, or we continue without that tool.',
    ];
  },
  not_ready: function (c) {
    const fw = (typeof c.framework === 'string' && c.framework.length > 0) ? c.framework : 'this framework';
    const score = Number.isInteger(c.readiness_score) ? c.readiness_score : 0;
    const missing = Array.isArray(c.missing_dimensions) && c.missing_dimensions.length > 0
      ? c.missing_dimensions.join(', ')
      : 'structure';
    return [
      'The graph doesn\'t have ' + fw + ' structured yet (readiness ' + score + '/4; missing: ' + missing + ').',
      'I\'ve queued it for enrichment. I can share what the graph does hold on this, marked as partial, or we work without it.',
    ];
  },
  // Phase 259 (TRUST-01): rate_limited gets its own copy block -- distinct
  // from unreachable's, and it must never use the word "unreachable" (the
  // whole point is that "temporarily overloaded" reads differently than
  // "actually down").
  rate_limited: function (c) {
    const waitLine = Number.isInteger(c.retry_after_s)
      ? 'The Brain asked for ' + c.retry_after_s + 's before the next try.'
      : 'I do not have an exact wait time from the Brain this time.';
    return [
      'The methodology graph is rate limiting requests right now, not down. ' + waitLine,
      'We can wait it out and retry, or keep going with your room context in the meantime.',
    ];
  },
});

/**
 * The documented CLI-path render contract: renderRefusal(kind, ctx) returns
 * the full Larry-voice refusal copy block for the given kind. /mos: commands
 * on the CLI path adopt this in Phase 252's sweep (research Open Question 1);
 * the Larry-direct MCP path renders the same copy via the SKILL.md
 * instruction layer instead (Tri-Polar: same shape, different render seam).
 *
 * @param {string} kind  one of REFUSAL_KINDS; unrecognized coerces to
 *                        'unreachable'.
 * @param {object} [ctx]  same shape as refusalResponse's ctx.
 * @returns {string}  non-empty multi-line copy block.
 */
function renderRefusal(kind, ctx) {
  const k = REFUSAL_KINDS.indexOf(kind) !== -1 ? kind : 'unreachable';
  const c = (ctx && typeof ctx === 'object' && !Array.isArray(ctx)) ? ctx : {};
  return RENDER_COPY[k](c).join('\n');
}

/**
 * One-liner Larry-prose refusal line, statusline-safe (<120 chars, single
 * line) for every kind -- the larryTier0Hint precedent, extended to all four
 * refusal kinds (the anti-nagging "repeats compress to one line" rule,
 * research Pattern 3).
 *
 * @param {string} kind  one of REFUSAL_KINDS; unrecognized coerces to
 *                        'unreachable'.
 * @param {string} [detail]  short context (e.g. a framework name); omitted
 *                        when not applicable.
 * @returns {string}
 */
function larryRefusalLine(kind, detail) {
  const k = REFUSAL_KINDS.indexOf(kind) !== -1 ? kind : 'unreachable';
  const d = (typeof detail === 'string' && detail.length > 0) ? detail : '';
  switch (k) {
    case 'no_key':
      return 'Brain registration incomplete (offline or failed). I will not improvise methodology.';
    case 'tier_denied':
      return 'Brain declined that tool for this key\'s tier. Not substituting a guess.';
    case 'not_ready':
      return 'Graph not structured for ' + (d || 'this framework') + ' yet. Queued for enrichment.';
    case 'rate_limited':
      return 'Brain is rate limiting right now, not down. Waiting it out, not faking it.';
    case 'unreachable':
    default:
      return 'Brain unreachable right now. I will not fake it.';
  }
}

/**
 * The not_ready refusal auto-queues an enrichment entry (source: 'refusal',
 * NEVER captureReadinessMiss which pins source: 'live_reach') then returns
 * the typed refusal response. NEVER throws into the caller -- the
 * enrichment-queue module's own never-throw discipline, extended here around
 * the lazy require too. Binding scope (research Open Question 2): callers
 * bind this to the two readiness-shaped wrappers only (orchestrationReadiness
 * / discoverStructure and their MCP twins) -- NEVER a sensor, NEVER decide(),
 * NEVER a per-turn hook path (the 249 Pitfall-6 hot-path fence extends here).
 *
 * @param {string} roomDir
 * @param {object} miss  { framework, normalized?, readiness_score?,
 *                         missing_dimensions?, context_class?,
 *                         probe_provenance?, tool? }
 * @returns {object}  refusalResponse('not_ready', ...)
 */
function refuseNotReady(roomDir, miss) {
  const m = (miss && typeof miss === 'object' && !Array.isArray(miss)) ? miss : {};
  try {
    const enrichmentQueue = require('./enrichment-queue.cjs');
    enrichmentQueue.enqueue(roomDir, {
      framework: m.framework,
      normalized: m.normalized,
      readiness_score: m.readiness_score,
      missing_dimensions: m.missing_dimensions,
      context_class: m.context_class,
      source: 'refusal',
      probe_provenance: m.probe_provenance,
    });
  } catch (_e) {
    // refuseNotReady NEVER throws into the caller (behavior spec, mirrors
    // enrichment-queue.cjs's own never-throw discipline).
  }
  return refusalResponse('not_ready', {
    tool: m.tool,
    framework: m.framework,
    readiness_score: m.readiness_score,
    missing_dimensions: m.missing_dimensions,
  });
}

module.exports = {
  DIRECTOR_NOT_AVAILABLE,
  tier0Response,
  isAvailable,
  larryTier0Hint,
  REFUSAL_KINDS,
  refusalResponse,
  renderRefusal,
  larryRefusalLine,
  refuseNotReady,
};
