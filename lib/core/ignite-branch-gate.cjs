'use strict';
/*
 * ignite-branch-gate.cjs -- local, deterministic classifier for the ignite
 * front-door branch routing.
 * =========================================================================
 * Phase 204-04. The runtime-safe half of the ignite branch-routing eval gate: it
 * reproduces the Plurai judge's correct/incorrect verdict OFFLINE, so the four
 * ROADMAP Phase 204 branches (room-chooser skip/fire, Just Talk, resume-with-register,
 * render-through-188) can be regression-checked WITHOUT calling Plurai at runtime
 * (Canon Part 8: Plurai is build/CI only, never a runtime dependency).
 *
 * A branch trace is CORRECT only when it honors all four ROADMAP invariants. The
 * five violations are HARD invariant checks (booleans + one enum), never data-swept
 * and never overridable by an options object -- a violating trace stays incorrect.
 * "A gate that cannot fail is not a gate" (calibration-gate.cjs precedent).
 *
 * Trace shape (six fields):
 *   has_resumable_rooms       -- bool: at least one non-archived prior room exists.
 *   gate_b0_fired             -- bool: the room-chooser Gate B0 card was rendered.
 *   pick                      -- 'room' | 'just_talk' | 'free_text' | null.
 *   birthed_new_room          -- bool: a new room was born this turn.
 *   resumed_without_register  -- bool: a room was resumed WITHOUT applying its stored
 *                                persona register.
 *   rendered_via_pickshape    -- bool: the branch rendered through the pickShape
 *                                SEED-020 / Phase 188 selector-dispatcher door.
 *
 * The five hard violations map 1:1 onto the ROADMAP Phase 204 branch bullets:
 *   gate_fired_with_no_rooms   -- branch 1: Gate B0 fired with no prior resumable
 *                                 rooms (should have skipped straight to birth/talk).
 *   resume_without_register    -- branch 3: a resumed room did not apply its own
 *                                 stored persona register.
 *   resume_births_new_room     -- branch 3: resuming an existing room re-ran the
 *                                 birth path (B1/B2/B3) instead of restoring it.
 *   just_talk_births_room      -- branch 2: the Just Talk pick forced a room birth
 *                                 (capture/build is offered later via an F-gate).
 *   not_rendered_via_pickshape -- branch 4: a fired Gate B0 rendered through a
 *                                 bespoke widget instead of the pickShape door.
 *
 * Pure + offline. Node built-ins only. No dependencies. No em-dashes.
 */

// The five hard invariants as predicates over a trace. gate_fired_with_no_rooms
// and not_rendered_via_pickshape are gated on gate_b0_fired; the resume family is
// gated on pick === 'room'; just_talk_births_room is gated on pick === 'just_talk'.
const HARD_VIOLATIONS = Object.freeze([
  { name: 'gate_fired_with_no_rooms', hit: function (t) { return t.has_resumable_rooms === false && t.gate_b0_fired === true; } },
  { name: 'resume_without_register', hit: function (t) { return t.pick === 'room' && t.resumed_without_register === true; } },
  { name: 'resume_births_new_room', hit: function (t) { return t.pick === 'room' && t.birthed_new_room === true; } },
  { name: 'just_talk_births_room', hit: function (t) { return t.pick === 'just_talk' && t.birthed_new_room === true; } },
  { name: 'not_rendered_via_pickshape', hit: function (t) { return t.gate_b0_fired === true && t.rendered_via_pickshape === false; } },
]);

// classifyIgniteBranch(trace) -> { label: 'correct' | 'incorrect', violations: [...] }.
// The second arg is accepted (callers may pass context) but DELIBERATELY IGNORED
// for the verdict -- the invariants are the law, not a knob. Pure and total: a
// non-object trace degrades to an all-fields-false shape before evaluation.
function classifyIgniteBranch(trace, _optsIgnored) {
  const t = (trace && typeof trace === 'object') ? trace : {};
  const violations = [];
  for (const v of HARD_VIOLATIONS) {
    if (v.hit(t)) violations.push(v.name);
  }
  return { label: violations.length === 0 ? 'correct' : 'incorrect', violations: violations };
}

module.exports = { classifyIgniteBranch, HARD_VIOLATIONS };
