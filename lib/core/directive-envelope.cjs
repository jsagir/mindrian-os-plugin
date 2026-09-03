'use strict';

/*
 * Phase 127-00 (Task 1) -- DirectiveEnvelope wrapper module.
 *
 * Builds the typed packet returned by `brain_ask` (via the stdio shim) and
 * consumed by Larry's surface. CANONICAL DEFAULT mode: GUIDED.
 *
 * Default: GUIDED per feedback_larry_pedagogical_guided_first.md (HARD RULE).
 * AUTONOMOUS only on explicit user invitation, non-judgment prep, or explicit
 * "run" command. Cold start ALWAYS forces GUIDED. Mature-room commit-phase
 * gates default to HYBRID.
 *
 * Canon parts: 2 (Larry pedagogy intrinsic, not Brain-dependent),
 *   3 (Decision Gate F-shape next_gate handoff), 7 (pure data shaping,
 *   zero network surface; envelope wrapper sits ABOVE brain-client).
 *
 * Constraints: CJS, Node built-ins only, zero new runtime deps, ZERO network
 * surface (no fetch/http/brain-client require). HARD RULE: no em-dashes.
 */

const DEFAULT_MODE = 'GUIDED';

/**
 * Mode classifier. Signal precedence (first match wins; explicit user signals
 * beat heuristic context):
 *   1. user_said_just_tell_me | user_said_bottom_line -> AUTONOMOUS
 *   2. is_first_material | is_cold_start              -> GUIDED (forced)
 *   3. session_count>=8 + room_mature + in_commit_phase -> HYBRID
 *   4. is_prep_work && !requires_judgment             -> AUTONOMOUS
 *   5. user_explicitly_said_run                       -> AUTONOMOUS
 *   6. default                                        -> GUIDED
 *
 * Non-object input is coerced to empty signals (default GUIDED applies).
 * @param {object} signals
 * @returns {{mode: string, rationale: string}}
 */
function selectMode(signals) {
  const s = (signals && typeof signals === 'object') ? signals : {};

  // 1. Explicit user invitation (highest precedence).
  if (s.user_said_just_tell_me || s.user_said_bottom_line) {
    return { mode: 'AUTONOMOUS', rationale: 'explicit_user_invitation' };
  }

  // 2. Cold start FORCES GUIDED (per feedback_larry_pedagogical_guided_first.md).
  if (s.is_first_material || s.is_cold_start) {
    return { mode: 'GUIDED', rationale: 'cold_start_never_autonomous' };
  }

  // 3. Mature-room commit-phase: HYBRID for non-trivial methodology run.
  if (typeof s.session_count === 'number' && s.session_count >= 8
      && s.room_mature && s.in_commit_phase) {
    return { mode: 'HYBRID', rationale: 'mature_room_commit_gate' };
  }

  // 4. Non-judgment prep work.
  if (s.is_prep_work && !s.requires_judgment) {
    return { mode: 'AUTONOMOUS', rationale: 'non_judgment_prep_work' };
  }

  // 5. Explicit execute command.
  if (s.user_explicitly_said_run) {
    return { mode: 'AUTONOMOUS', rationale: 'explicit_execute_command' };
  }

  // 6. Default: GUIDED (Larry pedagogical canon).
  return { mode: 'GUIDED', rationale: 'default_guided_pedagogical_canon' };
}

// The 3 documented user-override keys. Frozen template; envelope build
// shallow-copies so caller mutations do not leak across envelopes.
const USER_OVERRIDE_TEMPLATE = Object.freeze({
  'just tell me': 'switch to AUTONOMOUS, run framework end-to-end',
  'let me think': 'switch to GUIDED, ask the next reframing question',
  'stop': 'halt, return control',
});

/**
 * Build directive body. Pass through Brain-supplied `directive` when present;
 * otherwise produce a mode-appropriate empty scaffold.
 * @param {object|null} brainResponse
 * @param {string} mode
 * @returns {object}
 */
function buildDirective(brainResponse, mode) {
  // Pass-through if Brain already supplied a typed directive payload.
  if (brainResponse && typeof brainResponse === 'object'
      && brainResponse.directive && typeof brainResponse.directive === 'object') {
    return brainResponse.directive;
  }

  if (mode === 'AUTONOMOUS') {
    return { autonomous: { plan: [], framework: null } };
  }
  if (mode === 'HYBRID') {
    return {
      hybrid: {
        autonomous_prep: [],
        guided_commit: { questions: [] },
        framework: null,
      },
    };
  }
  // GUIDED default scaffold.
  return { guided: { questions: [], framework: null, stage: null } };
}

/**
 * Build next_gate handoff. Brain-supplied next_gate passes through when its
 * sub_shape matches F.[1-5]; otherwise defaults to F.1 Next Move (Canon Part 3).
 * @param {object|null} brainResponse
 * @returns {{sub_shape: string, options: Array}}
 */
function buildNextGate(brainResponse) {
  if (brainResponse && typeof brainResponse === 'object'
      && brainResponse.next_gate && typeof brainResponse.next_gate === 'object') {
    const ng = brainResponse.next_gate;
    if (typeof ng.sub_shape === 'string' && /^F\.[1-5]$/.test(ng.sub_shape)) {
      return {
        sub_shape: ng.sub_shape,
        options: Array.isArray(ng.options) ? ng.options : [],
      };
    }
  }
  return { sub_shape: 'F.1', options: [] };
}

/**
 * Return `value` shallow-copied (Object.assign copy-on-attach discipline,
 * Phase 254 WR-02) when it is a non-null, non-array object; otherwise null.
 * @param {*} value
 * @returns {object|null}
 */
function _copyIfPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return Object.assign({}, value);
}

/**
 * Wrap a Brain response (or null) in a typed DirectiveEnvelope.
 * brainResponse null/undefined => Tier-0 sentinel (mode GUIDED, rationale
 * "brain_unreachable", directive.guided.stage "tier_0_brain_unreachable").
 * Otherwise selectMode applies + directive/next_gate pass through when supplied.
 *
 * Phase 257 (D-04, G3): `wrapDirective()` was measured as a FIXED SEVEN-KEY
 * BUILDER that discarded any other top-level field on `brainResponse`. Two
 * consequences of that, both measured live this session: (1) Phase 254
 * COMP-02's `egress_disclosure` field never survived, making that disclosure
 * a no-op on `brain_ask`, the highest-traffic Brain tool; (2) the `refusal`
 * object the Phase 250-01 honest-refusal branch passes in
 * (`bin/mindrian-brain-mcp-client.cjs:119-123`) also never survived, so only
 * `directive.guided.stage` and `next_gate.options` reached the model, not the
 * typed refusal itself. Both are now carried through additively, by name
 * only (never a generic top-level-field copy -- that would let arbitrary
 * Brain-returned keys reach the model, the class of leakage
 * `lib/mcp/no-instructions.test.cjs` exists to prevent). When neither field
 * is present, the returned object keeps the exact same seven keys in the
 * exact same insertion order it had before this change.
 * @param {object|null} brainResponse
 * @param {object} signals
 * @returns {object} DirectiveEnvelope per CAPABILITY-MAP spec.
 */
function wrapDirective(brainResponse, signals) {
  if (brainResponse === null || brainResponse === undefined) {
    // Tier-0 sentinel. Unchanged (127-02 sentinel, byte-locked).
    return {
      packet_version: '1.0',
      packet_type: 'DirectiveEnvelope',
      mode: 'GUIDED',
      mode_rationale: 'brain_unreachable',
      directive: {
        guided: {
          questions: [],
          framework: null,
          stage: 'tier_0_brain_unreachable',
        },
      },
      user_override: Object.assign({}, USER_OVERRIDE_TEMPLATE),
      next_gate: { sub_shape: 'F.1', options: [] },
    };
  }

  const { mode, rationale } = selectMode(signals || {});

  const envelope = {
    packet_version: '1.0',
    packet_type: 'DirectiveEnvelope',
    mode: mode,
    mode_rationale: rationale,
    directive: buildDirective(brainResponse, mode),
    user_override: Object.assign({}, USER_OVERRIDE_TEMPLATE),
    next_gate: buildNextGate(brainResponse),
  };

  // Additive, named-field pass-through only (Phase 257, D-04). Attach ONLY
  // when present and object-shaped; absence leaves the seven keys above
  // untouched, in the same insertion order.
  const egressDisclosure = _copyIfPlainObject(brainResponse.egress_disclosure);
  if (egressDisclosure !== null) {
    envelope.egress_disclosure = egressDisclosure;
  }
  const refusal = _copyIfPlainObject(brainResponse.refusal);
  if (refusal !== null) {
    envelope.refusal = refusal;
  }

  return envelope;
}

module.exports = {
  DEFAULT_MODE,
  selectMode,
  wrapDirective,
};
