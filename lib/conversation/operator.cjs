/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 99-01 -- conversation operator state primitive (MINIMAL STUB)
 * ====================================================================
 * NOTE: This is a Phase 99-02 PARALLEL-EXECUTOR DEVIATION (Rule 3 -- auto-fix
 * blocking issue). Phase 99-02's classifier requires the OPERATORS + TRIGGERS
 * constants and validate() function from 99-01's operator.cjs. The full
 * Phase 99-01 implementation (state file persistence, atomic writes, typed
 * graph edges, getCurrent / transition full bodies) is being authored by a
 * sibling parallel-executor agent. This stub exposes the constants + a
 * conformant validate() so 99-02 can land without blocking.
 *
 * When 99-01 ships its full implementation, the OPERATORS / TRIGGERS / valid
 * transition table here MUST stay byte-identical (single source of truth).
 * 99-01 will replace this file in a follow-up commit with the same exports
 * plus the full getCurrent / transition bodies.
 *
 * Public API (frozen for 99-02 consumption):
 *   OPERATORS  --  the 5 canonical operators (CONTEXT.md D-03)
 *   TRIGGERS   --  the 8 canonical triggers (CONTEXT.md D-08 + plan interfaces)
 *   validate(from, to, trigger) -> { valid: bool, reason?: string }
 *   getCurrent(roomDir) -> stub returning JUST_TALK default (overridden by 99-01)
 *   transition(roomDir, to, trigger, contextDelta) -> stub returning failure
 *     so consumers (eg test-operator-classifier) don't accidentally write state
 *     before 99-01 lands.
 *
 * Pure CJS, node built-ins only, zero npm dependencies (Phase 87 invariant).
 *
 * Canon Part 8 (LOCAL ONLY):
 *   This module never queries Brain. Pure local logic.
 *
 * License: BSL 1.1.
 */

'use strict';

// The 5 canonical operators (CONTEXT.md D-03; RESEARCH.md "The five operators").
const OPERATORS = Object.freeze([
  'JUST_TALK',
  'EXPLORE_CAPTURE',
  'BUILD_ROOM',
  'METHODOLOGY',
  'DECISION_GATE',
]);

// The 8 canonical triggers (CONTEXT.md D-08 + 99-02 plan interfaces).
const TRIGGERS = Object.freeze([
  'session_start',
  'user_message',
  'mos_command',
  'operator_change',
  'hook_post_tool_use',
  'hook_stop',
  'manual_set',
  'manual_reset',
]);

// The 7 canonical transition rules from CONTEXT.md D-08, plus 2 tool-marker
// override rules ("Run Methodology" and "/mos:room <section>" are Decision-Gate
// verbs per Canon Part 3 and act as manual overrides from ANY operator).
// Encoded as a list of { from, to, allowed_triggers } records. 'ANY' as `from`
// means any current operator is permitted as the source.
const TRANSITION_RULES = Object.freeze([
  // ANY -> JUST_TALK (no room intent + no methodology trigger)
  {
    from: 'ANY',
    to: 'JUST_TALK',
    allowed_triggers: ['user_message', 'manual_reset', 'manual_set', 'hook_post_tool_use', 'session_start'],
  },
  // JUST_TALK -> EXPLORE_CAPTURE (filable surfaced)
  {
    from: 'JUST_TALK',
    to: 'EXPLORE_CAPTURE',
    allowed_triggers: ['user_message', 'manual_set', 'hook_post_tool_use'],
  },
  // EXPLORE_CAPTURE -> BUILD_ROOM (Shape F.4 yes OR /mos:room <section>)
  {
    from: 'EXPLORE_CAPTURE',
    to: 'BUILD_ROOM',
    allowed_triggers: ['user_message', 'mos_command', 'manual_set', 'hook_post_tool_use'],
  },
  // ANY -> BUILD_ROOM (manual override: /mos:room <section> OR explicit "add to the
  // room" intent. Per Canon Part 3, "Run Methodology" / "/mos:room" are Decision-Gate
  // verbs that bypass the strict pedagogy progression.)
  {
    from: 'ANY',
    to: 'BUILD_ROOM',
    allowed_triggers: ['mos_command', 'user_message', 'manual_set'],
  },
  // BUILD_ROOM -> METHODOLOGY (any /mos: methodology command)
  {
    from: 'BUILD_ROOM',
    to: 'METHODOLOGY',
    allowed_triggers: ['mos_command', 'manual_set', 'hook_post_tool_use'],
  },
  // ANY -> METHODOLOGY (manual override: /mos: methodology command from any state.
  // Per Canon Part 3 "Run Methodology" verb is available at every Decision Gate.)
  {
    from: 'ANY',
    to: 'METHODOLOGY',
    allowed_triggers: ['mos_command', 'manual_set'],
  },
  // METHODOLOGY -> BUILD_ROOM (Shape E filed OR /exit)
  {
    from: 'METHODOLOGY',
    to: 'BUILD_ROOM',
    allowed_triggers: ['mos_command', 'hook_post_tool_use', 'manual_set'],
  },
  // ANY -> DECISION_GATE (Shape F selector emitted)
  {
    from: 'ANY',
    to: 'DECISION_GATE',
    allowed_triggers: ['hook_post_tool_use', 'manual_set'],
  },
  // DECISION_GATE -> previous (caller must pass to=previous)
  {
    from: 'DECISION_GATE',
    to: 'ANY',
    allowed_triggers: ['hook_post_tool_use', 'manual_set'],
  },
]);

function validate(from, to, trigger) {
  if (!from || !to || !trigger) {
    return { valid: false, reason: 'missing required argument: from|to|trigger' };
  }
  if (OPERATORS.indexOf(from) === -1) {
    return { valid: false, reason: 'unknown from operator: ' + from };
  }
  if (OPERATORS.indexOf(to) === -1) {
    return { valid: false, reason: 'unknown to operator: ' + to };
  }
  if (TRIGGERS.indexOf(trigger) === -1) {
    return { valid: false, reason: 'unknown trigger: ' + trigger };
  }
  // Same -> same is never valid (no-op transitions waste history slots; D-08).
  if (from === to) {
    return { valid: false, reason: 'same-operator transition not allowed: ' + from };
  }
  for (const rule of TRANSITION_RULES) {
    const fromMatches = rule.from === 'ANY' || rule.from === from;
    const toMatches = rule.to === 'ANY' || rule.to === to;
    if (!fromMatches || !toMatches) continue;
    if (rule.allowed_triggers.indexOf(trigger) === -1) continue;
    return { valid: true };
  }
  return {
    valid: false,
    reason:
      'no transition rule matches (from=' + from + ', to=' + to + ', trigger=' + trigger + ')',
  };
}

// Stub getCurrent: returns the JUST_TALK cold-start default. The full
// Phase 99-01 implementation will read <roomDir>/.mindrian/conversation-operator.json
// and merge with this default on cache miss.
function getCurrent(roomDir) {
  const path = require('node:path');
  const activeRoom = roomDir ? path.basename(roomDir) : null;
  return {
    schema_version: '1.0.0',
    current: 'JUST_TALK',
    previous: null,
    entered_at: new Date().toISOString(),
    context: {
      active_room: activeRoom,
      active_section: null,
      methodology_in_flight: null,
      decision_gate_pending: null,
    },
    history: [],
  };
}

// Stub transition: returns failure. The full Phase 99-01 implementation
// will atomically rewrite the state file + emit OPERATOR_TRANSITION graph
// edge. Returning failure here means 99-02 callers (the classifier tests)
// MUST NOT depend on transition() persisting state -- and they don't.
function transition(roomDir, to, trigger, contextDelta) {
  return {
    success: false,
    violations: [
      {
        category: 'phase-99-01-pending',
        severity: 'error',
        message:
          'transition() is a stub awaiting full Phase 99-01 implementation. ' +
          'Use validate(from, to, trigger) for static rule checking.',
      },
    ],
  };
}

module.exports = {
  OPERATORS,
  TRIGGERS,
  TRANSITION_RULES,
  validate,
  getCurrent,
  transition,
};
