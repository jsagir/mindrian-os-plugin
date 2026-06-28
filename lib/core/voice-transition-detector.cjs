// lib/core/voice-transition-detector.cjs -- Phase 187.1 (statusline-battery-memory-voice-switch)
//
// PURE detector for the Larry<->Claude VOICE SWITCH tripwire. Given the current
// turn text and the prior voice-mark checkpoint, it reports whether the speaking
// voice SWITCHED (in either direction) and whether the tripwire should ALERT
// (fire the F.7 recalibration dial) -- applying a debounce so a normal Larry-led
// session does not nag.
//
// Canon Part 12 (Voice Signature + Modality Remote): the switch is the moment the
// navigator might want to recalibrate WHO they are talking to. Canon Part 8: LOCAL
// only -- this module is pure, reads nothing, writes nothing, opens no Brain wire.
// Canon Part 11 R3: when a trigger_mode is recorded it draws from TRIGGER_TIERS
// {signal | context | keyword}; a voice glyph change is the `signal` tier.
//
// The WRITE side of ~/.mindrian/voice-mark.json (the checkpoint this reads) is the
// shared Phase-182.1 debt; this detector is pure and works the instant that lands.
//
// House rule: hyphens only, no em-dashes.

'use strict';

let voiceMark = null;
try {
  voiceMark = require('../hmi/voice-color-mark.cjs');
} catch (_e) { /* graceful: detector degrades to host-only, never throws */ }

// Debounce default: do not re-fire within this many turns of the last fire.
const DEFAULT_COOLDOWN_TURNS = 3;

const TRANSITIONS = Object.freeze({
  LARRY_TO_CLAUDE: 'larry-to-claude',
  CLAUDE_TO_LARRY: 'claude-to-larry',
});

/**
 * Derive WHO is speaking from a turn's text. A turn that carries a valid De Stijl
 * voice mark is Larry; a turn with no mark is the native host (the absence IS the
 * signal, Part 12). Empty / non-string / detector-absent -> 'claude' (host) by the
 * same rule (no mark = not Larry).
 * @param {string} turnText
 * @returns {'larry'|'claude'}
 */
function deriveWho(turnText) {
  if (!voiceMark || typeof turnText !== 'string' || turnText.length === 0) return 'claude';
  try {
    const v = voiceMark.detectVoiceMark(turnText);
    return (v && v.valid && v.color) ? 'larry' : 'claude';
  } catch (_e) {
    return 'claude';
  }
}

/**
 * Detect a voice transition and decide whether to alert.
 *
 * @param {string} currentTurn - the current turn's text (Larry's if marked).
 * @param {Object} [priorCheckpointData] - the prior voice-mark checkpoint:
 *   { current_who, session_has_switched, last_fire_turn, cooldown_turns, turn_index }
 *   - current_who: 'larry'|'claude' the PRIOR turn's speaker (null on cold start).
 *   - session_has_switched: boolean, has any switch happened this session.
 *   - last_fire_turn: integer turn index the tripwire last fired (or null).
 *   - cooldown_turns: integer debounce window (default 3).
 *   - turn_index: integer index of the CURRENT turn (for debounce math).
 * @returns {{
 *   transition_type: 'larry-to-claude'|'claude-to-larry'|null,
 *   current_who: 'larry'|'claude',
 *   prior_who: 'larry'|'claude'|null,
 *   is_first_switch_this_session: boolean,
 *   should_alert: boolean,
 *   trigger_mode: 'signal'|null
 * }}
 */
function detectedVoiceTransition(currentTurn, priorCheckpointData) {
  const prior = priorCheckpointData || {};
  const currentWho = deriveWho(currentTurn);
  const priorWho = (prior.current_who === 'larry' || prior.current_who === 'claude')
    ? prior.current_who
    : null;

  // No prior speaker (cold start) or same speaker -> no transition.
  if (priorWho === null || priorWho === currentWho) {
    return {
      transition_type: null,
      current_who: currentWho,
      prior_who: priorWho,
      is_first_switch_this_session: false,
      should_alert: false,
      trigger_mode: null,
    };
  }

  const transition_type = (priorWho === 'larry' && currentWho === 'claude')
    ? TRANSITIONS.LARRY_TO_CLAUDE
    : TRANSITIONS.CLAUDE_TO_LARRY;

  const is_first_switch_this_session = prior.session_has_switched !== true;

  // Debounce: suppress a re-fire within cooldown_turns of the last fire. A genuine
  // SWITCH always passes on the first occurrence; a rapid A->B->A still alerts on
  // each real switch because each crossing is a distinct transition, but two fires
  // inside the cooldown window collapse to one.
  const cooldown = Number.isInteger(prior.cooldown_turns) ? prior.cooldown_turns : DEFAULT_COOLDOWN_TURNS;
  const turnIndex = Number.isInteger(prior.turn_index) ? prior.turn_index : null;
  const lastFire = Number.isInteger(prior.last_fire_turn) ? prior.last_fire_turn : null;
  let should_alert = true;
  if (turnIndex !== null && lastFire !== null && (turnIndex - lastFire) < cooldown) {
    should_alert = false;
  }

  return {
    transition_type,
    current_who: currentWho,
    prior_who: priorWho,
    is_first_switch_this_session,
    should_alert,
    trigger_mode: 'signal', // Part 11 R3: a glyph change is the `signal` tier.
  };
}

module.exports = {
  detectedVoiceTransition,
  deriveWho,
  DEFAULT_COOLDOWN_TURNS,
  TRANSITIONS,
};
