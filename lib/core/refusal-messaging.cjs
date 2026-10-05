'use strict';

/**
 * The refusal chokepoint -- one place that owns the typed refusal rail
 * (Phase 250-01 HONEST-01, extended by 257, 259, 364).
 *
 * Quick 261005-l8g (SEED-119, ruling 2026-10-05): the keyless refusal kind,
 * its sentinel, its upgrade hint and its Larry hint are GONE, because Theo is
 * called bare and there is no keyless state to refuse. Six kinds became five:
 * unreachable, tier_denied, not_ready, rate_limited, egress_blocked. An
 * outage is `unreachable`, nothing else.
 *
 * Single source-of-truth for the refusalResponse / renderRefusal /
 * larryRefusalLine / refuseNotReady family, used across the plugin:
 *   - scripts/mindrian-brain-mcp-client.cjs (the stdio shim)
 *   - Larry's prose surface (one-line hint via larryRefusalLine)
 *   - Future statusline + /mos:status surfaces
 *   - /mos: command CLI-path render adoption (documented contract for
 *     renderRefusal; per-command adoption rides Phase 252's sweep)
 *
 * The refusalResponse(kind, ctx) shape:
 *   {
 *     status:          KIND_STATUS[kind] (BRAIN_UNREACHABLE / BRAIN_TIER_DENIED /
 *                        GRAPH_NOT_READY / BRAIN_RATE_LIMITED /
 *                        BRAIN_EGRESS_BLOCKED),
 *     kind:            one of REFUSAL_KINDS,
 *     reason:          honest per-kind reason string (V5 rule: interpolates
 *                        ONLY closed-enum kind, coerced tool name, canonical
 *                        framework name, and the server message already
 *                        sliced to 300 chars upstream in brain-client),
 *     command_context: coerced tool name | "unknown",
 *     next_moves:      array of short option handles (F.1 next-move set)
 *   }
 *
 * Canon Part 7 (reuse): isAvailable() is a one-line delegation to
 *   brain-client.cjs's existing isAvailable(); refuseNotReady() lazily
 *   requires ./enrichment-queue.cjs (Phase 249-01's queue) rather than
 *   building a second queue.
 *
 * Canon Part 8 (graph boundary): zero network surface in this file. No
 *   fetch, no http, no endpoint domain strings. Refusal reasons never echo
 *   user turn text.
 *
 * HARD RULE: no em-dashes anywhere in this file (hyphens only).
 */

const brainClient = require('./brain-client.cjs');
// Phase 339 Plan 06 (FLIP-04, D-08): the two-command update path, required
// from its single source, never retyped here (drift is exactly what D-08
// exists to prevent -- tests/test-339-update-path-single-source.cjs polices
// both directions).
const { PLUGIN_UPDATE_COMMAND, UPDATE_PATH_SENTENCE } = require('./update-path.cjs');

/**
 * Is Theo reachable to ask from this process right now? Delegates to
 * brain-client.cjs's existing chokepoint (a configured origin; there is no
 * credential to resolve). One-line passthrough.
 *
 * @returns {boolean}
 */
function isAvailable() {
  return brainClient.isAvailable();
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
// Phase 257 Plan 01 (D-03, LOCUS-01): REFUSAL_KINDS grows from five to six
// members. Measured defect (257-RESEARCH.md "G1"): brain_ask renders a
// Canon Part 8 constitutional block (brain-client.cjs's
// {error:'egress_blocked', tool, egress_class} sentinel, minted at
// callTool()'s belt, brain-client.cjs:604-626) as a well-formed, EMPTY
// DirectiveEnvelope -- indistinguishable from "the Brain had nothing to
// offer." The words egress_blocked, error, content_set reached nowhere the
// model could read them. That is exactly the conflation Decision #8
// (honest refusal everywhere) forbids, and exactly the shape this module
// exists to close for every other refusal source. This amendment mints the
// typed shape; Plan 06 wires the shim to consume it (this plan changes no
// behavior on any wire).
// Like Phase 259's rate_limited before it, this amendment amends TWO
// previously-frozen downstream contracts in the same commit set so no
// suite is left red: tests/test-250-refusal-shapes.cjs's Test 1
// deepStrictEqual, and lib/core/doctor/class-m-brain-smoke.cjs's
// STRUCTURED_REFUSAL_STATUSES (both amended by this plan's Task 2).
// egress_blocked is APPENDED LAST -- the original five positions are
// unchanged.
//
// Quick 261005-l8g (SEED-119): the keyless kind is REMOVED from this set --
// Theo is called bare, so there is no keyless state to refuse. Five kinds remain.
//
// Frozen five-member closed set. Order is the data4sci four-class error
// taxonomy mapping (research Pattern 1) plus rate_limited and egress_blocked:
// tier_denied is validation-class, unreachable is transient-class
// (AVAIL-02's retry lives BEFORE this kind ever fires), not_ready is
// missing-information-class (never auto-retried; the right move is to queue
// enrichment), rate_limited is ALSO transient-class like unreachable but
// with a KNOWN wait -- that known wait is what makes it a distinct kind
// rather than a flavor of unreachable -- and egress_blocked is its own
// class: a CONSTITUTIONAL refusal, never a transport or availability
// failure, and never coerced from or into any of the other four.
const REFUSAL_KINDS = Object.freeze(['unreachable', 'tier_denied', 'not_ready', 'rate_limited', 'egress_blocked']);

// Phase 364 Plan 03 (NR-1): Theo's own refusal codes mapped onto the six kinds
// above. Theo 20.2 (find_bottlenecks) answers `{refusal:{code:'not_scored'}}`
// INSIDE a success when no betweenness recompute exists yet. That is "not
// ready yet", never "unreachable": Theo answered, it just has nothing scored.
// REFUSAL_KINDS is untouched (test-250 pins the six); this only names which
// existing kind a Theo code lands on.
const THEO_REFUSAL_TO_KIND = Object.freeze({ not_scored: 'not_ready' });

/**
 * kindForTheoRefusal(code) -> the REFUSAL_KINDS member for a Theo refusal
 * code, or null for anything unmapped (unknown, empty, non-string, inherited
 * keys). Pure.
 *
 * @param {*} code
 * @returns {string|null}
 */
function kindForTheoRefusal(code) {
  if (typeof code !== 'string') return null;
  return Object.prototype.hasOwnProperty.call(THEO_REFUSAL_TO_KIND, code) ? THEO_REFUSAL_TO_KIND[code] : null;
}

// The closed egress_class vocabulary classify() actually returns
// (lib/core/part8-egress-guard.cjs::classify, read in full for this plan).
// REASONS.egress_blocked coerces against this real set rather than an
// invented one; anything unrecognized defaults to 'unknown' (never echoes
// the raw caller-supplied value, which could itself be adversarial input).
const EGRESS_CLASS_SET = Object.freeze([
  'content_set', 'empty_payload', 'move_set', 'unproven_packet',
  'freeform_unmatched', 'unknown',
  // known_tool_shape (quick 260906-fda): an ALLOW-only class. classify() step
  // 3b can only ever return this on an allow verdict, so it can never reach
  // an egress_blocked refusal; listed here purely to keep this closed
  // vocabulary a true mirror of classify()'s real class set.
  'known_tool_shape',
  // 354-06 (D-354-EGR): typed_question is classify()'s new ALLOW-only class
  // (step 3's structural proof), the same shape of addition as
  // known_tool_shape above -- it can never reach an egress_blocked refusal,
  // listed here only to keep this vocabulary a true mirror.
  // freeform_unproven is classify()'s new ambiguous class (a methodology
  // word present, but the free-form string not structurally proven) AND
  // lib/core/brain-client.cjs::_typedFreeformGate's own egress_class value
  // for any non-block verdict on ask()/search()/smartSearch() -- unlike
  // freeform_unmatched (which was already registered), an unrecognized
  // freeform_unproven would silently coerce to 'unknown' here and lose the
  // honest reason on every refused ambiguous free-form question.
  // guard_unavailable is _typedFreeformGate's fail-closed sentinel for the
  // one path where the guard module itself failed to load.
  'typed_question', 'freeform_unproven', 'guard_unavailable',
]);

// Every kind gets its own honest sibling status -- never reuse one kind's
// status for a transport, tier, readiness, or constitutional failure (that
// reuse IS the conflation bug).
const KIND_STATUS = Object.freeze({
  unreachable: 'BRAIN_UNREACHABLE',
  tier_denied: 'BRAIN_TIER_DENIED',
  not_ready: 'GRAPH_NOT_READY',
  // Phase 259 (TRUST-01): its own sibling status, never a reuse of
  // BRAIN_UNREACHABLE -- that reuse IS the conflation bug this comment block
  // above already names.
  rate_limited: 'BRAIN_RATE_LIMITED',
  // Phase 257 (LOCUS-01, D-03): its own sibling status, never a reuse of
  // BRAIN_UNREACHABLE -- a constitutional block is not an outage, and
  // conflating the two IS the G1 defect this phase exists to close.
  egress_blocked: 'BRAIN_EGRESS_BLOCKED',
});

// V5 rule (threat model T-250-01/T-250-02): every REASONS function
// interpolates ONLY closed-enum kind, a coerced tool name, a canonical
// framework name, and the server message (already sliced to 300 chars
// upstream in brain-client's 403 branch). Never render an unbounded server
// body; never echo user turn text.

const REASONS = Object.freeze({
  unreachable: function (c) {
    return 'The methodology graph is unreachable right now for ' + c.tool + ' (after the bounded retry budget). Larry will not fake what it would say.';
  },
  tier_denied: function (c) {
    const msg = (typeof c.message === 'string' && c.message.length > 0)
      ? c.message
      : 'this install\'s tier does not allow ' + c.tool + '.';
    return 'The Brain declined ' + c.tool + ' for this install\'s tier: ' + msg;
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
  // Phase 257 (LOCUS-01, D-03): V5-compliant -- interpolates only the
  // coerced tool name and an egress_class coerced against the classifier's
  // own closed set (EGRESS_CLASS_SET above), defaulting to 'unknown' for
  // anything unrecognized. MUST NOT interpolate c.message, c.question,
  // c.cypher, or any caller payload -- that would re-leak the exact content
  // Part 8 just refused to send. States plainly that this is a refusal, not
  // an outage, and that rephrasing in generic methodology terms is the move.
  egress_blocked: function (c) {
    const eclass = (typeof c.egress_class === 'string' && EGRESS_CLASS_SET.indexOf(c.egress_class) !== -1)
      ? c.egress_class
      : 'unknown';
    return 'The Brain boundary refused ' + c.tool + ' (class: ' + eclass + '). ' +
      'This is a constitutional refusal, not an outage. Rephrase in generic ' +
      'methodology terms, or continue without the Brain for this turn.';
  },
});

// F.1 next-move option handles, per kind (SEED-021: fire the card, never
// draw the box -- this module supplies the handles, not the rendered UI).
const NEXT_MOVES = Object.freeze({
  // Phase 339 (FLIP-04, D-08, 2026-09-03): 'update' appended, not inserted or
  // substituted -- verified this session (git grep across lib, scripts, bin,
  // tests) that zero code consumes any next_moves handle by name, so a new
  // handle is safe to introduce, the same precedent Phases 252, 257 and 259
  // each set before it. A stale install after a suspended incumbent origin
  // cannot be retried into success; 'update' names the one move that
  // actually resolves it.
  unreachable: Object.freeze(['retry', 'update', 'continue_without']),
  tier_denied: Object.freeze(['check_tier', 'continue_without']),
  not_ready: Object.freeze(['use_partial', 'continue_without']),
  // Phase 259 (TRUST-01): retry_after_wait, not the existing 'retry' --
  // retrying immediately is the wrong move on a rate limit. Verified this
  // session: zero consumers of any next_moves handle anywhere in the repo,
  // so a new handle name is safe to introduce.
  rate_limited: Object.freeze(['retry_after_wait', 'continue_without']),
  // Phase 257 (LOCUS-01, D-03): verified this session (git grep across lib,
  // scripts, bin, tests) that zero code consumes any next_moves handle by
  // name, so a new handle is safe to introduce. rephrase_generically names
  // the one real move available on a constitutional block: retrying will not
  // help, only rewording without the flagged content will.
  egress_blocked: Object.freeze(['rephrase_generically', 'continue_without']),
});

/**
 * Construct a typed refusal response. Replaces "quieter Larry" doctrine at
 * the chokepoint: a failing methodology consult REFUSES visibly instead of
 * degrading silently. Every kind carries its own sibling status so a
 * caller can distinguish them without string-matching reason.
 *
 * @param {string} kind  one of REFUSAL_KINDS; unrecognized values coerce to
 *                        'unreachable' (the defensive default).
 * @param {object} [ctx]  { tool?, message?, framework?, readiness_score?,
 *                          missing_dimensions? }. Non-object/absent coerces
 *                          to {}.
 * @returns {{status: string, kind: string, reason: string,
 *            command_context: string, next_moves: string[]}}
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
  return out;
}

// Larry-voice full copy blocks (research Pattern 3), consumed by
// renderRefusal(). One honest sentence naming the kind, the queue
// disclosure for not_ready, then the next-move framing -- the F.1 card
// itself is fired by the instruction layer (SKILL.md), not built here.
const RENDER_COPY = Object.freeze({
  // Phase 339 (FLIP-04, D-08, 2026-09-03): unreachable names the two-command
  // update path (UPDATE_PATH_SENTENCE, required from update-path.cjs, never
  // retyped here). The observed situation this keys on: a suspended incumbent
  // origin cannot be retried into success, and a stale install needs the
  // update instruction. Deliberately NOT done: this
  // does not read release-process.md at runtime (update-path.cjs's own
  // header states why) and it does not interpolate anything caller-supplied
  // (UPDATE_PATH_SENTENCE is a frozen local constant, so Canon Part 8/V5's
  // interpolation rule is satisfied trivially).
  //
  // The honest limit, verbatim (Key Decision 8, Canon Part 12 -- copy must
  // not conceal a failure or promise what it cannot keep):
  //   This copy ships in bytes. An install that has not updated prints the
  //   OLD string, because a main commit is not live until released AND
  //   picked up. This change is the durable fix for the next origin move
  //   and for honesty; the levers that reach today's stale population are
  //   the soak window and the tester note.
  unreachable: function () {
    return [
      'I can\'t reach the methodology graph right now, so I will not fake what it would say.',
      // Phase 339 (FLIP-04, D-08): rewritten from a bare retry promise. A
      // suspended origin cannot be retried into success, and Key Decision 8
      // forbids copy that promises what it cannot keep; the update path is
      // the only unconditional promise this line makes now.
      'A retry may not help if the origin moved; we can keep going with your room context in the meantime.',
      UPDATE_PATH_SENTENCE,
    ];
  },
  tier_denied: function (c) {
    const msg = (typeof c.message === 'string' && c.message.length > 0)
      ? c.message
      : 'this tool is not on the current install\'s tier allowlist';
    return [
      'The Brain declined that tool for this install\'s tier: ' + msg,
      'I will not substitute a guess. Check the tier, or we continue without that tool.',
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
  // Phase 257 (LOCUS-01, D-03): egress_blocked's own copy block. Same no-echo
  // rule as REASONS.egress_blocked -- interpolates only the coerced tool
  // name and the closed-set egress_class. Must not use "unreachable" or
  // "down": a constitutional block is neither.
  egress_blocked: function (c) {
    const eclass = (typeof c.egress_class === 'string' && EGRESS_CLASS_SET.indexOf(c.egress_class) !== -1)
      ? c.egress_class
      : 'unknown';
    return [
      'The Brain boundary refused that ' + c.tool + ' call (class: ' + eclass + '). This is a constitutional refusal, not a failure.',
      'Try rephrasing in generic methodology terms, or we continue without the Brain for this turn.',
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
 * line) for every kind, across all the
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
    case 'tier_denied':
      return 'Brain declined that tool for this install\'s tier. Not substituting a guess.';
    case 'not_ready':
      return 'Graph not structured for ' + (d || 'this framework') + ' yet. Queued for enrichment.';
    case 'rate_limited':
      return 'Brain is rate limiting right now, not down. Waiting it out, not faking it.';
    case 'egress_blocked':
      return 'The Brain boundary refused that call. Rephrase generically, or continue without it.';
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
  isAvailable,
  REFUSAL_KINDS,
  THEO_REFUSAL_TO_KIND,
  kindForTheoRefusal,
  refusalResponse,
  renderRefusal,
  larryRefusalLine,
  refuseNotReady,
};
