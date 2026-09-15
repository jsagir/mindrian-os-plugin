'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 346-02 -- the `enforcement` axis (enforce vs judge vs not-applicable)
 * and the LOCAL escape-hatch detector the Claude Code path has been missing.
 * =========================================================================
 * CRITICAL NAMING DISAMBIGUATION (read before touching this file):
 *
 * The word "posture" is already bound THREE times in this codebase, one of
 * them drift-tested to an exact count:
 *
 *   1. `sensor-types.POSTURE_IDS` = push_forward / hold / pull_back, the
 *      Hierarchical Navigator / Usher-cycle read, asserted EXACTLY 3 (no
 *      more, no fewer) by tests/test-posture-ids-drift.cjs.
 *   2. `recipe-maps.postureForCommand(command)`, "the ONE registry posture
 *      authority."
 *   3. `stance-state.STANCES` = ['research', 'tell-act', 'ask', 'redteam'],
 *      the SEED-042 4-pole MANUAL override dial (`lib/core/stance-state.cjs`,
 *      which already fought and settled this exact naming fight for its own
 *      axis).
 *
 * The ruling, mirroring stance-state.cjs's own resolution in spirit: the
 * CODE identifier for this module's output is "arbitration" everywhere
 * (module, function, JSON key, event type, trace field). User-facing prose
 * may still say "the posture decision", exactly as the roadmap's own
 * language reads; only the CODE identifier must avoid the collision. Prose
 * may still say "posture decision"; code may not use the word "posture" as
 * an identifier. This module mints NO fourth posture id and names no
 * literal posture token anywhere outside THIS comment.
 * =========================================================================
 *
 * Purity contract: pure-function module, zero I/O, zero network, never
 * throws. Canon Part 8: LOCAL only -- this module receives coerced scalars
 * and booleans and never a room body, never user prose beyond the single
 * detector entry point below (detectEscapeHatch). Mirrors the "Pure-function
 * module. Zero I/O." header claim in lib/core/nav-dial.cjs and the reason
 * lib/core does not import from lib/mcp or lib/memory (Pitfall 9:
 * capabilities arrive threaded on the input, never required from
 * lib/mcp/surface-detect.cjs).
 *
 * House rule: CJS, Node built-ins only, hyphens only, no em-dashes.
 */

// Requires, all inside lib/core/, no lib/mcp/ and no lib/memory/ (Pitfall 9:
// capabilities and every other caller-side fact arrive threaded on the
// input, never required from a sibling tier). This is the complete require
// set of the module; tests/test-346-no-second-brain.cjs asserts set equality
// both directions so an added import fails the build loudly.
const decisionAxes = require('./decision-axes.cjs');
const directiveEnvelope = require('./directive-envelope.cjs');
const { ROLE_LEVELS, PROBLEM_TYPES } = require('./persona-taxonomy.cjs');

// ---------------------------------------------------------------------------
// The escape-hatch detector -- the ONLY function in this module that accepts
// user text. It returns exactly two booleans and never echoes any input
// substring; resolveEnforcement below and the composed resolver landing in
// 346-04 never receive the text itself (Canon Part 8 fence, pinned
// behaviorally here and by a source-scan drift test in 346-04).
// ---------------------------------------------------------------------------

// ESCAPE_HATCH_PHRASES -- the doctrine source is skills/larry-personality/
// SKILL.md's Hierarchical Navigator / arbitration rule 7 ("An explicit 'just
// tell me / bottom line' is the captain overriding the instrument -- deliver
// immediately"). The wider regex in mcp-server-brain/lib/brain-ask.cjs:331
// (deriveModeSignals: /just tell me|bottom line|skip the question/) is a
// DIFFERENT server's producer and is deliberately not mirrored key-for-key
// here: this detector covers exactly the two phrases the navigator named.
const ESCAPE_HATCH_PHRASES = Object.freeze(['just tell me', 'bottom line']);

/**
 * Detect the two explicit user-override phrases on the Claude Code path.
 * Non-string input coerces to both-false immediately -- never throws.
 *
 * Part 8 fence: this is the ONLY function in the module that accepts user
 * text; it returns booleans. resolveEnforcement and the composed resolver in
 * 346-04 never receive the text.
 *
 * The two returned key names are byte-identical to the two flags selectMode
 * reads at directive-envelope.cjs:42 (rule 1, highest precedence).
 *
 * @param {*} userText
 * @returns {{user_said_just_tell_me: boolean, user_said_bottom_line: boolean}}
 */
function detectEscapeHatch(userText) {
  if (typeof userText !== 'string') {
    return { user_said_just_tell_me: false, user_said_bottom_line: false };
  }
  const lowered = userText.toLowerCase();
  return {
    user_said_just_tell_me: lowered.indexOf(ESCAPE_HATCH_PHRASES[0]) !== -1,
    user_said_bottom_line: lowered.indexOf(ESCAPE_HATCH_PHRASES[1]) !== -1,
  };
}

// ---------------------------------------------------------------------------
// The enforcement axis -- enforce vs judge vs not-applicable. The third fork
// nobody had modelled (docs/ARBITRATION-CONTRACT.md "The three axes"). Only
// this axis's resolver is new; delivery and autonomy reuse
// lib/core/decision-axes.cjs and lib/core/directive-envelope.cjs verbatim
// (Canon Part 7), unchanged by this plan.
// ---------------------------------------------------------------------------

const ENFORCEMENT_VALUES = Object.freeze(['enforce', 'judge', 'not-applicable']);
const ENFORCE = 'enforce';
const JUDGE = 'judge';
const NOT_APPLICABLE = 'not-applicable';

// The closed rationale vocabulary, one token per ladder rule below, exported
// so the Part 8 enum-only scan in 346-04 reads them from here rather than
// re-typing them.
const ENFORCEMENT_RATIONALES = Object.freeze([
  'constitutional_floor',
  'no_enforcement_loop_on_surface',
  'user_override_escape_hatch',
  'cold_start_reward_before_investment',
  'no_fork_reached',
  'gate_subject_unconnected',
  'question_already_answered',
  'card_already_fired',
  'live_unanswered_fork',
]);

/**
 * Resolve the enforcement axis for a turn: enforce, judge, or not-applicable.
 * A first-match-wins ladder in the selectMode (directive-envelope.cjs) house
 * style. Non-object input coerces to {} (the decision-axes.cjs typed-defaults
 * idiom) -- never throws, always returns a member of ENFORCEMENT_VALUES with
 * a rationale that is a member of ENFORCEMENT_RATIONALES.
 *
 * `capabilities` arrives threaded on the input, never required from
 * lib/mcp/surface-detect.cjs (Pitfall 9: lib/core stays self-contained).
 *
 * @param {object} input
 * @returns {{value: string, rationale: string}}
 */
function resolveEnforcement(input) {
  const inp = (input && typeof input === 'object' && !Array.isArray(input)) ? input : {};
  const capabilities = (inp.capabilities && typeof inp.capabilities === 'object') ? inp.capabilities : {};

  // Rule 1: the constitutional floor. Canon Part 8 egress and the write-scope
  // / room-binding check are never inputs, always floors. This rule is FIRST
  // so that `judge` has no return path on a floor turn -- the
  // decision-axes.cjs:138 structural-impossibility move rather than a
  // downstream conditional. The WATCH file's own bucket analysis puts Phase
  // 194 and Phase 196 in the 13 percent that must not be touched: data-
  // boundary, not persona.
  if (inp.floor_engaged === true) {
    return { value: ENFORCE, rationale: 'constitutional_floor' };
  }

  // Rule 2: no enforcement loop on this surface. CAPABILITY_MAP reports
  // hooks: false on desktop and cowork, so check-card-fire, check-voice-style
  // and intent-classifier never run there. The loop being arbitrated does not
  // exist, so the honest value is not-applicable, never a fabricated enforce
  // or judge (WD-4). A missing or malformed capabilities object takes this
  // branch too: unknown surface is not a licence to guess.
  if (capabilities.hooks !== true) {
    return { value: NOT_APPLICABLE, rationale: 'no_enforcement_loop_on_surface' };
  }

  // Rule 3: the explicit user escape hatch. Arbitration rule 7: the user is
  // the only helm; an explicit "just tell me" is the captain overriding the
  // instrument.
  if (inp.escape_hatch === true) {
    return { value: JUDGE, rationale: 'user_override_escape_hatch' };
  }

  // Rule 4: cold start / first material. The hooked-model first-step rule
  // (docs/reward-before-investment-rule.md); the arbiter's contribution to
  // turn 1 is to NOT fire a compliance card over the room's variable reward,
  // which is incident 1 exactly.
  if (inp.is_cold_start === true || inp.is_first_material === true) {
    return { value: JUDGE, rationale: 'cold_start_reward_before_investment' };
  }

  // Rule 5: no fork reached. Incident 6: a turn that launched a Workflow and
  // ended with a status report, no gate drawn, blocked anyway.
  if (inp.gate_reached !== true) {
    return { value: JUDGE, rationale: 'no_fork_reached' };
  }

  // Rule 6: the gate's subject is not connected to this turn. Incidents 1, 2,
  // 3, 4 and 4b: a stale 2026-05-07 artifact gate fired on six consecutive
  // turns of an unrelated command-inventory conversation.
  if (inp.gate_subject_connected === false) {
    return { value: JUDGE, rationale: 'gate_subject_unconnected' };
  }

  // Rule 7: the question was already answered. Incident 5: the backstop
  // blocked a plain prose follow-up the user had already answered with "yes".
  if (inp.question_already_answered === true) {
    return { value: JUDGE, rationale: 'question_already_answered' };
  }

  // Rule 8: the card already fired this turn. Incident 7: the real card WAS
  // fired and a parallel background task-notification confused the detector.
  if (inp.card_fired_this_turn === true) {
    return { value: JUDGE, rationale: 'card_already_fired' };
  }

  // Rule 9 (default): a live, subject-connected, unanswered fork on a
  // hooks-capable surface with no card fired is exactly what the enforcement
  // loop exists for. The arbiter suppresses misfires; it does not disarm the
  // gate.
  return { value: ENFORCE, rationale: 'live_unanswered_fork' };
}

// ---------------------------------------------------------------------------
// resolveArbitration -- the composed ranked result (346-04). Composes the
// enforcement axis above with the two already-shipped pure resolvers
// (decision-axes.cjs resolveDecisionMode for delivery, directive-envelope.cjs
// selectMode for autonomy) per Canon Part 7: reuse before build. This is
// where CLAUDE.md:152's one-governed-path claim gets tested against the
// arbiter itself: 346-RESEARCH.md Pitfall 1 names "the arbiter becomes the
// second selection brain" as the failure mode that would quietly make that
// claim false, and tests/test-346-no-second-brain.cjs is the mechanical
// proof this module never crosses that line.
// ---------------------------------------------------------------------------

const ARBITRATION_VERSION = '1.0';

// RANKED_ORDER (WD-12): enforcement first because a Stop hook can block the
// whole turn; how the answer is phrased cannot short-circuit anything. The
// order is frozen in v1.0; a future phase may make it context-dependent.
const RANKED_ORDER = Object.freeze(['enforcement', 'delivery', 'autonomy']);

// ARBITRATION_INPUTS -- the six inputs ROADMAP.md's Phase 346 deliverable-1
// sentence names: role_blend, JTBD, problem-type rung, escape-hatch phrases,
// stall count, surface capability.
const ARBITRATION_INPUTS = Object.freeze([
  'role_blend', 'jtbd', 'rung', 'escape_hatch', 'stall_count', 'surface',
]);

// FLOOR_TOKENS -- one comment line per token naming its Canon Part or
// doctrine source (docs/ARBITRATION-CONTRACT.md "The floors, and what they
// are not").
const FLOOR_TOKENS = Object.freeze([
  'part8_egress',          // Canon Part 8: LOCAL data never egresses to the Brain.
  'write_scope',           // data-boundary / room-binding check, never persona.
  'part12_glyph',          // Canon Part 12 doctrinal floor half of the WD-2 split.
  'no_fabricated_numbers', // Canon Part 5 evidence bar.
  'cold_start_guided',     // feedback_larry_pedagogical_guided_first.md HARD RULE
                            // + docs/reward-before-investment-rule.md.
]);

// DELIVERY_RATIONALES -- the five decision-axes.cjs tokens, with the
// persona-suffixed detent_act_and_report:<who> form expanded over
// ROLE_LEVELS read live from persona-taxonomy.cjs plus 'generic', so the
// level names are never re-typed here. resolver_fault is the fault-safety
// token added so the closed-enum scan still passes on the degraded path.
const DELIVERY_RATIONALES = Object.freeze(
  [
    'p0_6_requires_judgment',
    'p0_6_confidence_floor',
    'cold_start_ask_first',
    'below_detent_offer_as_question',
  ]
    .concat(ROLE_LEVELS.concat(['generic']).map(function (who) {
      return 'detent_act_and_report:' + who;
    }))
    .concat(['resolver_fault'])
);

// AUTONOMY_RATIONALES -- directive-envelope.cjs selectMode's six tokens plus
// the same fault-safety token.
const AUTONOMY_RATIONALES = Object.freeze([
  'explicit_user_invitation',
  'cold_start_never_autonomous',
  'mature_room_commit_gate',
  'non_judgment_prep_work',
  'explicit_execute_command',
  'default_guided_pedagogical_canon',
  'resolver_fault',
]);

/**
 * Guarded per-key read: returns undefined instead of throwing when `key`'s
 * getter on `obj` throws. A small local accessor rather than folding every
 * read into the outer per-resolver try/catch blocks below, because a
 * guarded accessor keeps a single hostile key's fault LOCAL to that one
 * census entry (it lands in inputs_missing, honestly) instead of collapsing
 * the entire result to the degraded resolver_fault path over one bad key
 * among six.
 *
 * @param {*} obj
 * @param {string} key
 * @returns {*}
 */
function safeGet(obj, key) {
  try {
    return obj[key];
  } catch (e) {
    return undefined;
  }
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isRoleBlendRead(v) {
  if (!isPlainObject(v)) return false;
  for (const k in v) {
    if (Object.prototype.hasOwnProperty.call(v, k) && typeof v[k] === 'number' && Number.isFinite(v[k])) {
      return true;
    }
  }
  return false;
}

function isJtbdRead(v) {
  return isPlainObject(v) && Object.prototype.hasOwnProperty.call(v, 'jtbd');
}

function isEscapeHatchRead(v) {
  return isPlainObject(v)
    && typeof v.user_said_just_tell_me === 'boolean'
    && typeof v.user_said_bottom_line === 'boolean';
}

/**
 * Census the six ARBITRATION_INPUTS by shape, never by presence alone
 * (T-346-03: a hand-edited or corrupt local state file is tampering, not
 * trusted input). Preserves ARBITRATION_INPUTS order in both returned
 * arrays. Every read goes through safeGet so a throwing getter on one key
 * lands that one key in inputs_missing instead of collapsing the census.
 *
 * @param {object} inp
 * @returns {{inputs_read: string[], inputs_missing: string[]}}
 */
function censusInputs(inp) {
  const checks = {
    role_blend: isRoleBlendRead(safeGet(inp, 'role_blend')),
    jtbd: isJtbdRead(safeGet(inp, 'jtbd')),
    rung: PROBLEM_TYPES.indexOf(safeGet(inp, 'rung')) !== -1,
    escape_hatch: isEscapeHatchRead(safeGet(inp, 'escape_hatch')),
    stall_count: (function () {
      const v = safeGet(inp, 'stall_count');
      return typeof v === 'number' && Number.isFinite(v);
    })(),
    surface: (function () {
      const v = safeGet(inp, 'surface');
      return typeof v === 'string' && v.length > 0;
    })(),
  };
  const inputs_read = [];
  const inputs_missing = [];
  ARBITRATION_INPUTS.forEach(function (key) {
    if (checks[key]) { inputs_read.push(key); } else { inputs_missing.push(key); }
  });
  return { inputs_read: inputs_read, inputs_missing: inputs_missing };
}

/**
 * The two unconditional floors are present for every input, including
 * hostile ones. cold_start_guided is added when is_cold_start or
 * is_first_material is true. A caller-declared floor_kind is added only
 * when floor_engaged is true AND floor_kind is a member of FLOOR_TOKENS; an
 * unrecognized floor_kind is dropped rather than echoed (T-346-03).
 *
 * @param {object} inp
 * @returns {string[]}
 */
function computeFloors(inp) {
  const floors = ['part12_glyph', 'no_fabricated_numbers'];
  const isColdStart = safeGet(inp, 'is_cold_start') === true || safeGet(inp, 'is_first_material') === true;
  if (isColdStart) {
    floors.push('cold_start_guided');
  }
  if (safeGet(inp, 'floor_engaged') === true) {
    const fk = safeGet(inp, 'floor_kind');
    if (typeof fk === 'string' && FLOOR_TOKENS.indexOf(fk) !== -1 && floors.indexOf(fk) === -1) {
      floors.push(fk);
    }
  }
  return floors;
}

/**
 * Build the plain mode_signals object both selectMode (autonomy) and
 * resolveDecisionMode (delivery, via resolveInitiative) read. Named-field
 * copies only, never a generic top-level spread: directive-envelope.cjs's
 * own wrapDirective() comment (lines 161-168) states the reason out loud --
 * "never a generic top-level-field copy, that would let arbitrary
 * Brain-returned keys reach the model." The same discipline applies here: an
 * arbiter that spread an untrusted ctx object into mode_signals would be
 * exactly the second-selection-brain risk tests/test-346-no-second-brain.cjs
 * exists to catch, just moved one hop upstream.
 *
 * @param {object} inp
 * @returns {object}
 */
function buildModeSignals(inp) {
  const eh = safeGet(inp, 'escape_hatch');
  const ehObj = isPlainObject(eh) ? eh : {};
  const signals = {
    user_said_just_tell_me: ehObj.user_said_just_tell_me === true,
    user_said_bottom_line: ehObj.user_said_bottom_line === true,
  };
  [
    'is_cold_start', 'is_first_material', 'room_mature', 'in_commit_phase',
    'is_prep_work', 'requires_judgment', 'user_explicitly_said_run',
  ].forEach(function (k) {
    signals[k] = safeGet(inp, k) === true;
  });
  const sc = safeGet(inp, 'session_count');
  if (typeof sc === 'number' && Number.isFinite(sc)) {
    signals.session_count = sc;
  }
  return signals;
}

/**
 * Clamp persona to a member of ROLE_LEVELS, or null. Part 8 reason:
 * decision-axes.cjs interpolates `persona` into the
 * `detent_act_and_report:<who>` rationale string, so an unclamped free
 * string would put user-derived prose into the trace and then into the
 * memory_event row (346-05). This clamp is what makes DELIVERY_RATIONALES a
 * closed set: only ROLE_LEVELS members and 'generic' can ever appear after
 * the colon.
 *
 * @param {*} value
 * @returns {string|null}
 */
function clampPersona(value) {
  return (typeof value === 'string' && ROLE_LEVELS.indexOf(value) !== -1) ? value : null;
}

/**
 * Named-field copy of the enforcement-relevant keys, with escape_hatch
 * flattened to the single boolean resolveEnforcement expects. Never a
 * generic spread, same Pitfall-9 discipline as buildModeSignals.
 *
 * @param {object} inp
 * @returns {object}
 */
function buildEnforcementInput(inp) {
  const eh = safeGet(inp, 'escape_hatch');
  const ehObj = isPlainObject(eh) ? eh : {};
  const ehFlat = ehObj.user_said_just_tell_me === true || ehObj.user_said_bottom_line === true;
  return {
    floor_engaged: safeGet(inp, 'floor_engaged'),
    capabilities: safeGet(inp, 'capabilities'),
    escape_hatch: ehFlat,
    is_cold_start: safeGet(inp, 'is_cold_start'),
    is_first_material: safeGet(inp, 'is_first_material'),
    gate_reached: safeGet(inp, 'gate_reached'),
    gate_subject_connected: safeGet(inp, 'gate_subject_connected'),
    question_already_answered: safeGet(inp, 'question_already_answered'),
    card_fired_this_turn: safeGet(inp, 'card_fired_this_turn'),
  };
}

// ---------------------------------------------------------------------------
// The hooked-model first-step constraint (design fact, not a hope). The
// arbiter is invisible on turn 1 because surfacing "I arbitrated your
// posture" is an investment ask placed before any reward, which inverts the
// Hooked loop (feedback_hooked_model_first_steps.md HARD RULE) and is also a
// Canon Part 12 violation (Larry is measured by how invisible he is). The
// variable reward on turn 1 belongs to the room, not to the arbiter; the
// arbiter's own contribution to turn 1 is to NOT fire a compliance card over
// that reward, which is incident 1 exactly (docs/reward-before-investment-
// rule.md). The arbiter gains no user-visible first-touch surface of its
// own and therefore needs no record in data/first-reward-surfaces.json.
// ---------------------------------------------------------------------------

/**
 * Resolve one ranked arbitration result per turn: enforcement, delivery and
 * autonomy, plus the honest input census and the floors applied. Never
 * throws (R7 fault-safety): the two reused-resolver calls (delivery,
 * autonomy) each sit behind their own try/catch degrading to the safest
 * value (ask_and_hedged / GUIDED) with rationale 'resolver_fault'; a
 * hostile key among the six census inputs degrades that one key to
 * inputs_missing via the safeGet guarded accessor rather than collapsing
 * the whole result.
 *
 * @param {*} input
 * @returns {{arbitration_version:string, delivery:object, autonomy:object,
 *   enforcement:object, ranked:string[], inputs_read:string[],
 *   inputs_missing:string[], floors_applied:string[]}}
 */
function resolveArbitration(input) {
  const inp = (input && typeof input === 'object' && !Array.isArray(input)) ? input : {};

  let inputs_read = [];
  let inputs_missing = ARBITRATION_INPUTS.slice();
  try {
    const census = censusInputs(inp);
    inputs_read = census.inputs_read;
    inputs_missing = census.inputs_missing;
  } catch (e) {
    // Degrade to nothing read, everything missing -- still an honest census.
  }

  let floors_applied = ['part12_glyph', 'no_fabricated_numbers'];
  try {
    floors_applied = computeFloors(inp);
  } catch (e) {
    // Degrade to the two unconditional floors.
  }

  let modeSignals = {};
  try {
    modeSignals = buildModeSignals(inp);
  } catch (e) {
    // Degrade to no signals: both reused resolvers already treat {} safely.
  }

  let delivery;
  try {
    const confidenceRaw = safeGet(inp, 'confidence');
    const confidence = (typeof confidenceRaw === 'number' && Number.isFinite(confidenceRaw)) ? confidenceRaw : 0;
    const persona = clampPersona(safeGet(inp, 'persona'));
    const requiresJudgment = safeGet(inp, 'requires_judgment') === true;
    const r = decisionAxes.resolveDecisionMode({
      confidence: confidence,
      mode_signals: modeSignals,
      persona: persona,
      requires_judgment: requiresJudgment,
    });
    delivery = { value: r.mode, rationale: r.rationale };
  } catch (e) {
    delivery = { value: 'ask_and_hedged', rationale: 'resolver_fault' };
  }

  let autonomy;
  try {
    const r = directiveEnvelope.selectMode(modeSignals);
    autonomy = { value: r.mode, rationale: r.rationale };
  } catch (e) {
    autonomy = { value: 'GUIDED', rationale: 'resolver_fault' };
  }

  let enforcement;
  try {
    const r = resolveEnforcement(buildEnforcementInput(inp));
    enforcement = { value: r.value, rationale: r.rationale };
  } catch (e) {
    enforcement = { value: 'judge', rationale: 'no_fork_reached' };
  }

  return {
    arbitration_version: ARBITRATION_VERSION,
    delivery: delivery,
    autonomy: autonomy,
    enforcement: enforcement,
    ranked: Object.freeze(RANKED_ORDER.slice()),
    inputs_read: inputs_read,
    inputs_missing: inputs_missing,
    floors_applied: floors_applied,
  };
}

module.exports = {
  ESCAPE_HATCH_PHRASES,
  detectEscapeHatch,
  ENFORCEMENT_VALUES,
  ENFORCEMENT_RATIONALES,
  resolveEnforcement,
  ARBITRATION_VERSION,
  RANKED_ORDER,
  ARBITRATION_INPUTS,
  FLOOR_TOKENS,
  DELIVERY_RATIONALES,
  AUTONOMY_RATIONALES,
  resolveArbitration,
  // Test seam (private), mirroring decision-axes.cjs's own _test block.
  _test: {
    ENFORCE,
    JUDGE,
    NOT_APPLICABLE,
    safeGet,
    censusInputs,
    computeFloors,
    buildModeSignals,
    clampPersona,
    buildEnforcementInput,
  },
};
