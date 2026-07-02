'use strict';
/*
 * statusline-liveness-gate.cjs -- local, deterministic statusline-liveness detector.
 * =========================================================================
 * Quick task 20260702-statusline-live-signals. The runtime-safe half of the
 * statusline-liveness eval: it reproduces the Plurai judge's live/stale verdict
 * OFFLINE, so the statusline contract can be regression-gated WITHOUT ever calling
 * Plurai at runtime (Canon Part 8: Plurai is build/CI only).
 *
 * The contract under test: the navigator cockpit line must reflect the LIVE state.
 * A line is STALE (the "feels dead" signature the two 192-04 NAMED DEBTS caused)
 * when it shows a PLACEHOLDER while the real state differs:
 *   - next-move axis: a real routed next step exists, but "Next:" shows a stale /
 *     placeholder cue ('continue') or a different step than the one routed.
 *   - health   axis: the real room-health is drift/broken, but the glyph shows the
 *     permanent-green default (sound), or otherwise disagrees with the real health.
 * A line is LIVE when it reflects the real state on BOTH axes -- INCLUDING the
 * byte-stable degrade case: when the real state is genuinely ABSENT (no routed step
 * / no health cache), showing 'continue' + 'sound' is the CORRECT default, not a
 * stale line.
 *
 * The verdict is HARDCODED, never data-swept and never overridable by an options
 * object -- "a gate that cannot fail is not a gate" (the rs-corpus-quality-gate.cjs
 * precedent). Pure + offline: zero network, zero Brain, node built-ins only.
 * No em-dashes.
 */

const VALID_HEALTH = Object.freeze(['sound', 'drift', 'broken']);

// A "Next:" cue that carries no routed information -- the placeholder / stale
// signature. An empty cue is equally uninformative. '--' is the Ruling 3c
// (2026-07-02) honest "no routed step" placeholder that REPLACED the lying
// 'continue' default; both are kept here so the gate stays in parity with the
// renderer during the transition (a '--' or 'continue' cue both mean "nothing
// routed", so neither is stale when no real routed step exists).
const PLACEHOLDER_NEXT = Object.freeze(['', 'continue', '--']);

function norm(v) {
  return typeof v === 'string' ? v.trim().toLowerCase() : '';
}

function validHealth(v) {
  const s = norm(v);
  return VALID_HEALTH.indexOf(s) !== -1 ? s : null;
}

/**
 * Is the next-move axis stale? True when a REAL routed next step exists but the
 * rendered cue does not reflect it (it shows a placeholder, or a different step).
 * When no real routed step exists, a placeholder cue is the correct default -> not
 * stale.
 */
function isNextMoveStale(rendered, state) {
  const realNext = norm(state && state.routed_next_move);
  if (realNext === '' || PLACEHOLDER_NEXT.indexOf(realNext) !== -1) {
    // No genuine routed step to reflect -> a placeholder line is correct.
    return false;
  }
  const shownNext = norm(rendered && rendered.next_move);
  return shownNext !== realNext;
}

/**
 * Is the health axis stale? True when the real room-health is known AND the
 * rendered glyph disagrees with it (classically: real drift/broken while the line
 * shows the permanent-green default). When the real health is absent, 'sound' is
 * the correct byte-stable default -> not stale.
 */
function isHealthStale(rendered, state) {
  const realHealth = validHealth(state && state.room_health);
  if (realHealth === null) return false; // genuinely absent -> default sound is correct.
  const shownHealth = validHealth(rendered && rendered.health) || 'sound';
  return shownHealth !== realHealth;
}

/**
 * judgeStatuslineLiveness(sample) -> 'live' | 'stale'.
 *
 * sample = {
 *   rendered: { next_move: string, health: 'sound'|'drift'|'broken' },
 *   state:    { routed_next_move: string|null, room_health: 'sound'|'drift'|'broken'|null }
 * }
 *
 * The second arg is ACCEPTED (callers may pass context) but DELIBERATELY IGNORED
 * for the verdict -- the liveness contract is the law, not a knob. A malformed
 * sample degrades to 'stale' (a line we cannot verify against real state is not
 * provably live).
 */
function judgeStatuslineLiveness(sample, _optsIgnored) {
  if (!sample || typeof sample !== 'object') return 'stale';
  const rendered = sample.rendered && typeof sample.rendered === 'object' ? sample.rendered : null;
  const state = sample.state && typeof sample.state === 'object' ? sample.state : null;
  if (!rendered || !state) return 'stale';
  if (isNextMoveStale(rendered, state)) return 'stale';
  if (isHealthStale(rendered, state)) return 'stale';
  return 'live';
}

module.exports = {
  judgeStatuslineLiveness,
  isNextMoveStale,
  isHealthStale,
  PLACEHOLDER_NEXT,
  VALID_HEALTH,
};
