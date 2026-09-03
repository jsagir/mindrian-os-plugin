/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 99-01 -- conversation operator state machine
 * ===================================================
 * Per-room conversation operator state primitive. Five operators
 * (JUST_TALK, EXPLORE_CAPTURE, BUILD_ROOM, METHODOLOGY, DECISION_GATE)
 * with 7 transition rules. State persists at
 * <roomDir>/.mindrian/conversation-operator.json with schema_version
 * "1.0.0". Atomic writes via mktemp + rename. Cold-start default
 * JUST_TALK (Phase 99 D-04). History bounded at 50 entries with
 * drop-oldest rotation (Phase 99 D-26).
 *
 * Every successful transition emits an operator_transitioned memory_event
 * AND writes a typed OPERATOR_TRANSITION edge to the local graph, BOTH routed
 * through lib/core/navigation.cjs (the Canon Part 9 chokepoint) per Canon
 * Part 4. transition() is the SINGLE emission site for operator_transitioned --
 * CLI callers (scripts/operator-command.cjs) and non-CLI callers (hooks, the
 * MVA option router) all flow through here, so there is exactly one event per
 * transition with no double-emit. If the graph database is absent, both the
 * event and the edge are silently skipped; the state file write still succeeds
 * (graceful degradation per Decision #8).
 *
 * Phase 129-03: the legacy direct-node-sqlite + raw INSERT bypass (a baselined
 * Phase 128 substrate violation that opened <roomDir>/.room-graph/room.db
 * directly) is RETIRED. The OPERATOR_TRANSITION edge now writes through
 * navigation.logOperatorTransition(roomDir, { ..., write_transition_edge: true })
 * which uses the canonical .mindrian/room.db opener inside the chokepoint. This
 * module never opens room.db itself.
 *
 * Public API:
 *   getCurrent(roomDir) -> state object (or JUST_TALK default if file absent)
 *   transition(roomDir, to, trigger, contextDelta) -> { success, current, previous, entered_at } | { success: false, violations }
 *   validate(from, to, trigger) -> { valid: true } | { valid: false, reason }
 *
 * Frame budget (Phase 99 D-23, D-24):
 *   getCurrent < 1ms target
 *   transition < 5ms target
 *
 * Canon Part 8 (LOCAL ONLY):
 *   This module never queries Brain. Never writes to Brain. The
 *   five-operator vocabulary is generic; even if a future phase
 *   ever ships cross-room operator pattern queries, only the generic
 *   names would egress -- never user content. Phase 99 ships zero
 *   Brain surface.
 *
 * Pure CJS, node built-ins only, zero npm dependencies (Phase 87 invariant).
 *
 * License: BSL 1.1.
 *
 * ---------------------------------------------------------------------
 * Quick task 260903-hod -- R18 revised (epistemic-level cap), navigator-
 * approved 2026-09-03
 * ---------------------------------------------------------------------
 *
 * (1) Ruling and provenance. R18 was first ruled to attach the epistemic-
 * level cap to conversation-mode's 3-lane system (chat/brainstorm/build).
 * That ruling is REVERSED here. Reason: conversation-mode's lane only
 * changes at a rare, gate-limited, navigator-confirmed re-pick -- "one
 * re-surface per turn-cluster", "never auto-switch lanes... always a
 * navigator pick at the Decision Gate" (skills/conversation-mode/
 * SKILL.md:84-85). A cap meant to bound what Larry may produce THIS TURN
 * cannot live on a state that changes once per turn-cluster at most; it
 * cannot respond to what is actually happening turn-by-turn. This state
 * machine can: transition() moves `current` within a session, governed by
 * 9 transition rules, so the cap below is queryable per turn against the
 * actual operator state.
 *
 * (2) The mapping table (unchanged from constitution v3.0.0, carried
 * forward, only its attachment point moved):
 *   JUST_TALK        -> Information
 *   EXPLORE_CAPTURE   -> Information
 *   BUILD_ROOM        -> Knowledge
 *   METHODOLOGY       -> Understanding
 *   DECISION_GATE      -> null (render-lock, off the ladder entirely)
 *
 * (3) SUPERSEDED: v3.0.0's sentence "DECISION_GATE alone may emit Wisdom"
 * no longer holds. DECISION_GATE is a render-lock state and appears on no
 * depth ladder at all under this mapping. Consequence stated plainly so a
 * future reader does not re-open it as an oversight: no operator state
 * reaches Wisdom. Nothing in OPERATOR_EPISTEMIC_CAP's non-null values is
 * 'Wisdom'.
 *
 * (4) DECLARED, NOT ENFORCED. `epistemicCapForOperator` and `isWithinCap`
 * are a pure in-memory lookup and comparison. No production code calls
 * either yet. The natural consumer is the T2 write-back path
 * (docs/2026-09-03-DESIGN-t2-write-back-minimal.md), which is a filed
 * design, not implemented -- there is nothing to enforce against today.
 * Do not read the presence of this function as evidence that anything is
 * capped in production; it is a declared mapping only.
 *
 * (5) Two-axis warning. lib/render/render-v2.cjs also reads operator
 * state (JUST_TALK suppresses Zone 4 output at line ~288; METHODOLOGY
 * suppresses unless an ending signal is present at line ~294; lines
 * ~174-176 gate a zone on operator !== 'JUST_TALK' && operator !==
 * 'METHODOLOGY' && (jtbd || operator === 'BUILD_ROOM')). That is UI
 * verbosity -- which of 4 render zones appear. It is NOT a depth model.
 * This epistemic cap is the only depth model in the codebase. Do not
 * merge the two axes; same input (operator state), different question.
 *
 * (6) Unresolved bridge, not invented here. lib/core/node-insert.cjs:113
 * exports ALLOWED_EPISTEMIC_TYPES, a frozen 10-member closed enum
 * (observation, extracted_fact, derived_fact, model_derived_assertion,
 * interpretation, hypothesis, assumption, conclusion, recommendation,
 * decision) shipped by R17-02. That is a DIFFERENT vocabulary from the
 * DIKW rungs below. Nothing maps the 10 epistemic_type values onto the 5
 * EPISTEMIC_LEVELS rungs. A future consumer that wants to compare a
 * written node's epistemic_type against a cap needs that mapping ruled
 * first; it is not defined by this quick task.
 * ---------------------------------------------------------------------
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// ---------- Constants ----------

const SCHEMA_VERSION = '1.0.0';
const OPERATORS = ['JUST_TALK', 'EXPLORE_CAPTURE', 'BUILD_ROOM', 'METHODOLOGY', 'DECISION_GATE'];
const TRIGGERS = ['session_start', 'user_message', 'mos_command', 'operator_change', 'hook_post_tool_use', 'hook_stop', 'manual_set', 'manual_reset'];
const HISTORY_MAX = 50;

// ---------- R18-revised: epistemic-level cap (quick task 260903-hod) ----------
//
// Ascending DIKW ladder, index 0 = shallowest rung. Source:
// skills/conversation-mode/SKILL.md's "Lanes as Ackoff DIKW position"
// section, which writes the top as one combined rung "Wisdom / Understanding".
// This ladder separates them, because the cap table below needs the
// separation: METHODOLOGY caps at Understanding and nothing caps at Wisdom.
const EPISTEMIC_LEVELS = Object.freeze(['Data', 'Information', 'Knowledge', 'Understanding', 'Wisdom']);

// Declared mapping, carried forward unchanged from constitution v3.0.0.
// null for DECISION_GATE is deliberate: it means "not on the ladder"
// (render-lock state), not "no limit".
const OPERATOR_EPISTEMIC_CAP = Object.freeze({
  JUST_TALK: 'Information',
  EXPLORE_CAPTURE: 'Information',
  BUILD_ROOM: 'Knowledge',
  METHODOLOGY: 'Understanding',
  DECISION_GATE: null,
});

// epistemicCapForOperator(operatorState) -> { operator, cap, render_lock, unknown_operator }
//
// Declared, not enforced (see top-of-file doc block point 4). Fails closed
// on any unrecognized input -- including non-strings, null, and undefined --
// to the same floor getCurrent() already falls back to: JUST_TALK's cap,
// Information. That precedent already degrades unknown/corrupt operator
// state to JUST_TALK (lines above, defaultState/getCurrent); this is the
// same fallback expressed on the depth axis, not a new policy. Never throws.
function epistemicCapForOperator(operatorState) {
  if (typeof operatorState === 'string' && Object.prototype.hasOwnProperty.call(OPERATOR_EPISTEMIC_CAP, operatorState)) {
    const cap = OPERATOR_EPISTEMIC_CAP[operatorState];
    return {
      operator: operatorState,
      cap,
      render_lock: operatorState === 'DECISION_GATE',
      unknown_operator: false,
    };
  }
  return { operator: null, cap: 'Information', render_lock: false, unknown_operator: true };
}

// isWithinCap(level, cap) -> boolean
//
// Pure comparison half of the declared mapping, not enforcement. True only
// when both level and cap are real EPISTEMIC_LEVELS rungs and level is at
// or below cap on the ladder (equal is within). A null cap (the
// DECISION_GATE render-lock case) always returns false, since a render-lock
// state emits nothing on the ladder to be within. Unknown level or unknown
// cap fails closed to false. Never throws.
function isWithinCap(level, cap) {
  if (typeof level !== 'string' || typeof cap !== 'string') return false;
  const levelIdx = EPISTEMIC_LEVELS.indexOf(level);
  const capIdx = EPISTEMIC_LEVELS.indexOf(cap);
  if (levelIdx === -1 || capIdx === -1) return false;
  return levelIdx <= capIdx;
}

// Transition rules (Phase 99 CONTEXT.md D-08).
// Format: { from: <operator>|'ANY', to: <operator>|'previous', triggers: [<allowed triggers>] }
//
// 9 rules total. The 2 ANY-source overrides (ANY -> BUILD_ROOM, ANY -> METHODOLOGY)
// were added during Phase 99 wave-1 integration (Canon Part 3 Decision-Gate verbs
// "Run Methodology" / "/mos:room <section>" are available at every gate; bypass the
// strict pedagogy progression). Plan 99-02 classifier T4 cross-check depends on
// these two rules existing.
const TRANSITION_RULES = [
  { from: 'ANY', to: 'JUST_TALK', triggers: ['user_message', 'manual_set', 'manual_reset'] },
  { from: 'JUST_TALK', to: 'EXPLORE_CAPTURE', triggers: ['user_message', 'manual_set'] },
  { from: 'EXPLORE_CAPTURE', to: 'BUILD_ROOM', triggers: ['user_message', 'mos_command', 'manual_set'] },
  { from: 'ANY', to: 'BUILD_ROOM', triggers: ['mos_command', 'user_message', 'manual_set'] },
  { from: 'BUILD_ROOM', to: 'METHODOLOGY', triggers: ['mos_command', 'hook_post_tool_use', 'manual_set'] },
  { from: 'ANY', to: 'METHODOLOGY', triggers: ['mos_command', 'manual_set'] },
  { from: 'METHODOLOGY', to: 'BUILD_ROOM', triggers: ['mos_command', 'hook_post_tool_use', 'manual_set'] },
  { from: 'ANY', to: 'DECISION_GATE', triggers: ['mos_command', 'hook_post_tool_use', 'manual_set'] },
  { from: 'DECISION_GATE', to: 'previous', triggers: ['user_message', 'hook_post_tool_use', 'manual_set'] },
];

// ---------- Validation ----------

function validate(from, to, trigger) {
  if (!OPERATORS.includes(from)) {
    return { valid: false, reason: `invalid 'from' operator: ${from}` };
  }
  if (to !== 'previous' && !OPERATORS.includes(to)) {
    return { valid: false, reason: `invalid 'to' operator: ${to}` };
  }
  if (!TRIGGERS.includes(trigger)) {
    return { valid: false, reason: `invalid trigger: ${trigger}` };
  }
  if (from === to) {
    return { valid: false, reason: `no-op transition: ${from} -> ${to}` };
  }
  for (const rule of TRANSITION_RULES) {
    const fromOk = rule.from === 'ANY' || rule.from === from;
    const toOk = rule.to === to;
    const trigOk = rule.triggers.includes(trigger);
    if (fromOk && toOk && trigOk) return { valid: true };
  }
  return { valid: false, reason: `no rule matches: ${from} -> ${to} via ${trigger}` };
}

// ---------- State path + default ----------

function statePath(roomDir) {
  return path.join(roomDir, '.mindrian', 'conversation-operator.json');
}

function defaultState(roomDir) {
  return {
    schema_version: SCHEMA_VERSION,
    current: 'JUST_TALK',
    previous: null,
    entered_at: new Date().toISOString(),
    context: {
      active_room: path.basename(roomDir),
      active_section: null,
      methodology_in_flight: null,
      decision_gate_pending: null,
    },
    history: [],
  };
}

// ---------- getCurrent ----------

function getCurrent(roomDir) {
  const p = statePath(roomDir);
  if (!fs.existsSync(p)) return defaultState(roomDir);
  let raw;
  try {
    raw = fs.readFileSync(p, 'utf8');
  } catch (e) {
    process.stderr.write(`[operator] read error at ${p}\n`);
    process.stderr.write(`[operator] ${e.message}\n`);
    process.stderr.write(`[operator] falling back to JUST_TALK default\n`);
    return defaultState(roomDir);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`[operator] corrupt JSON at ${p}\n`);
    process.stderr.write(`[operator] ${e.message}\n`);
    process.stderr.write(`[operator] falling back to JUST_TALK default\n`);
    return defaultState(roomDir);
  }
  if (parsed.schema_version !== SCHEMA_VERSION) {
    process.stderr.write(`[operator] schema_version differs: found ${parsed.schema_version}, wanted ${SCHEMA_VERSION}\n`);
    process.stderr.write(`[operator] file ${p}\n`);
    process.stderr.write(`[operator] falling back to JUST_TALK default\n`);
    return defaultState(roomDir);
  }
  if (!OPERATORS.includes(parsed.current)) {
    process.stderr.write(`[operator] invalid current operator: ${parsed.current}\n`);
    process.stderr.write(`[operator] file ${p}\n`);
    process.stderr.write(`[operator] falling back to JUST_TALK default\n`);
    return defaultState(roomDir);
  }
  return parsed;
}

// ---------- Atomic write ----------

function writeStateAtomic(roomDir, state) {
  const dir = path.join(roomDir, '.mindrian');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const finalPath = path.join(dir, 'conversation-operator.json');
  // mktemp inside SAME directory for POSIX-atomic rename
  const rand = crypto.randomBytes(6).toString('hex');
  const tmpPath = path.join(dir, `.conversation-operator.json.${rand}`);
  // Serialize with schema_version FIRST (D-06)
  const ordered = {
    schema_version: SCHEMA_VERSION,
    current: state.current,
    previous: state.previous,
    entered_at: state.entered_at,
    context: state.context,
    history: state.history,
  };
  fs.writeFileSync(tmpPath, JSON.stringify(ordered, null, 2), 'utf8');
  fs.renameSync(tmpPath, finalPath);
}

// ---------- OPERATOR_TRANSITION emission + edge (via navigation.cjs) ----------

// Phase 129-03: the door is navigation.cjs (the Canon Part 9 chokepoint). This
// module is NOT in the substrate-guard allow-list, so it must reach room.db
// ONLY through navigation. logOperatorTransition (Plan 129-01) opens
// .mindrian/room.db internally, logs the operator_transitioned memory_event,
// and -- with write_transition_edge:true -- writes the typed OPERATOR_TRANSITION
// cascade edge between the two operator nodes. The legacy node:sqlite +
// .room-graph/room.db raw INSERT bypass is GONE.
//
// Lazy require so this module loads even when navigation.cjs is mid-refactor in
// a parallel wave; wrapped by the caller in try/catch for graceful degradation.
let _navigation = null;
function loadNavigation() {
  if (_navigation) return _navigation;
  _navigation = require('../core/navigation.cjs');
  return _navigation;
}

// Emit the operator_transitioned event + OPERATOR_TRANSITION edge through the
// chokepoint. Best-effort: any failure (no navigation module, no room.db, write
// error) is swallowed so the transition never breaks. Returns nothing.
function emitOperatorTransition(roomDir, from, to, trigger, contextDelta) {
  try {
    const nav = loadNavigation();
    if (nav && typeof nav.logOperatorTransition === 'function') {
      nav.logOperatorTransition(roomDir, {
        from,
        to,
        trigger,
        // write the typed OPERATOR_TRANSITION edge (Canon Part 4) in the same
        // chokepoint call that logs the event.
        write_transition_edge: true,
      });
    }
  } catch (_e) {
    // graceful: no graph yet, navigation unavailable, or db locked. The state
    // file write already succeeded; the event/edge are best-effort.
  }
}

// ---------- transition ----------

function transition(roomDir, to, trigger, contextDelta = {}) {
  const state = getCurrent(roomDir);
  const from = state.current;

  // Validate against the ORIGINAL `to` (which may be the literal string
  // 'previous' for the DECISION_GATE -> previous rule per D-08). The rule
  // table records `to: 'previous'` literally; resolving before validate
  // would prevent the rule from matching.
  const v = validate(from, to, trigger);
  if (!v.valid) {
    return { success: false, violations: [{ category: 'transition', severity: 'error', message: v.reason }] };
  }

  // Resolve `to === 'previous'` to state.previous for the actual write.
  let resolvedTo = to;
  if (to === 'previous') {
    if (!state.previous) {
      return { success: false, violations: [{ category: 'transition', severity: 'error', message: `cannot transition to 'previous': no previous operator recorded` }] };
    }
    resolvedTo = state.previous;
  }

  const now = new Date().toISOString();
  const nextHistory = state.history.slice();
  nextHistory.push({ op: resolvedTo, from, to: resolvedTo, trigger, ts: now });
  if (nextHistory.length > HISTORY_MAX) {
    nextHistory.splice(0, nextHistory.length - HISTORY_MAX); // drop-oldest (D-26)
  }

  const nextContext = Object.assign({}, state.context, contextDelta || {});
  // Always reset active_room to current basename in case roomDir changed
  nextContext.active_room = path.basename(roomDir);

  const nextState = {
    schema_version: SCHEMA_VERSION,
    current: resolvedTo,
    previous: from,
    entered_at: now,
    context: nextContext,
    history: nextHistory,
  };

  try {
    writeStateAtomic(roomDir, nextState);
  } catch (e) {
    return { success: false, violations: [{ category: 'io', severity: 'error', message: `atomic write failed: ${e.message}` }] };
  }

  // Best-effort emission: operator_transitioned event + OPERATOR_TRANSITION edge
  // routed through navigation.cjs (the single emission site; silent on failure).
  emitOperatorTransition(roomDir, from, resolvedTo, trigger, contextDelta);

  return { success: true, current: resolvedTo, previous: from, entered_at: now };
}

// ---------- Phase 118-05 Plan 05 -- MVA option router helper ----------
//
// transitionViaMVAOption(roomDir, optionId)
// -----------------------------------------
// Thin additive wrapper used by lib/core/mva-option-router.cjs when the user
// selects 1, 2, or 3 from the 30-second MVA brief footer.
//
// Option 1 -> transition to JUST_TALK via the ANY -> JUST_TALK rule with
//             trigger 'manual_reset'. The brief stays in scrollback; Larry
//             keeps the conversation open for follow-ups.
// Option 2 -> NO-OP. Per binding decision B6 OPTION A, option 2 is a stub
//             for v1.13.0 (Phase 119 will wire the BUILD_ROOM path). The
//             operator state is preserved; the router surfaces STUB_MESSAGE_119.
// Option 3 -> transition to METHODOLOGY via the ANY -> METHODOLOGY rule with
//             trigger 'mos_command'. The router then invokes
//             /mos:challenge-assumptions --from-brief <sha8>.
//
// The 9 existing transition rules are UNTOUCHED. The OPERATORS array is
// UNTOUCHED. This helper is purely a routing convenience that wraps the
// existing transition() API.
//
// Returns { ok: true, new_state, from } on success, with optional
// no_transition:true + reason:'option_2_stub' on the option-2 path. Returns
// { ok: false, error: 'invalid_option', valid_options: [1,2,3] } when optionId
// is anything other than the strict integers 1, 2, or 3.
function transitionViaMVAOption(roomDir, optionId) {
  // Strict integer check -- reject strings, null, undefined, floats.
  if (!Number.isInteger(optionId) || ![1, 2, 3].includes(optionId)) {
    return { ok: false, error: 'invalid_option', valid_options: [1, 2, 3] };
  }
  const before = getCurrent(roomDir);
  const fromState = before.current;

  if (optionId === 1) {
    const result = transition(roomDir, 'JUST_TALK', 'manual_reset');
    if (!result.success) {
      // Already JUST_TALK (no-op): validate() rejects same-from-same-to.
      // Treat as already-in-target-state: ok with new_state=JUST_TALK.
      if (fromState === 'JUST_TALK') {
        return { ok: true, new_state: 'JUST_TALK', from: fromState };
      }
      return { ok: false, error: 'transition_failed', new_state: fromState, from: fromState };
    }
    return { ok: true, new_state: result.current, from: fromState };
  }

  if (optionId === 2) {
    // Stub: no transition. Phase 119 will wire BUILD_ROOM here.
    return { ok: true, new_state: fromState, no_transition: true, reason: 'option_2_stub' };
  }

  // optionId === 3
  const result = transition(roomDir, 'METHODOLOGY', 'mos_command');
  if (!result.success) {
    if (fromState === 'METHODOLOGY') {
      return { ok: true, new_state: 'METHODOLOGY', from: fromState };
    }
    return { ok: false, error: 'transition_failed', new_state: fromState, from: fromState };
  }
  return { ok: true, new_state: result.current, from: fromState };
}

// ---------- Exports ----------

module.exports = {
  // Public API
  getCurrent,
  transition,
  validate,
  // Phase 118-05 additive surface
  transitionViaMVAOption,
  // Quick task 260903-hod additive surface: R18-revised epistemic-level cap.
  // Declared, not enforced -- see top-of-file doc block point 4.
  EPISTEMIC_LEVELS,
  OPERATOR_EPISTEMIC_CAP,
  epistemicCapForOperator,
  isWithinCap,
  // Constants (consumed by 99-02 classifier, 99-04 hooks, 99-05 command)
  OPERATORS,
  TRIGGERS,
  TRANSITION_RULES,
  SCHEMA_VERSION,
  HISTORY_MAX,
  // Internal helpers exported for testability ONLY (do not consume from production code)
  _internal: { statePath, defaultState, writeStateAtomic, emitOperatorTransition },
};
