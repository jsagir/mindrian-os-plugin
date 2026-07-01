'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 205-03 -- SENS-10 circularity detector (the anti-circular within-frame
 * gear-shift). SENS-09 is TAKEN by Phase 170 (dual-use diffusion/adoption); this
 * is the NEXT sensor id, SENS-10.
 *
 * The Mordi + Eli tester failure -- "circular, back-and-forth, not answering
 * questions" -- is a conversation that CIRCLES. It circles for one of four
 * reasons, and each reason has a different exit gear:
 *
 *   1. answer-unheard          the navigator's answer was not registered, the
 *                              same ask keeps repeating           -> TELL
 *                              (deliver the synthesis; stop asking)
 *   2. assertion-unvalidated   a load-bearing claim was asserted but never
 *                              tested                              -> GRILL
 *                              (challenge it: challenge-assumptions)
 *   3. stuck-cannot-say-where  circling but the blockage is unlocated
 *                              -> GRILL via find-bottlenecks (REUSE the SENS-02
 *                              lagging-component signal, not a re-derivation)
 *   4. wrong-question / frame  the frame itself is wrong          -> REFRAME
 *                              (beautiful-question: Why / What-if / How)
 *
 * FROZEN-SIX INVARIANT (Canon Part 7, item-7): each exit maps to one of the six
 * frozen reach_ids (context_block, contradiction, cross_room, brain_consult,
 * deep_research, hats) via makeReach. This sensor mints NO new reach_id -- TELL /
 * GRILL / REFRAME are nav-dial GEARS, not reaches. The mapping:
 *   answer_unheard        -> context_block (deliver the assembled answer), push_forward
 *   assertion_unvalidated -> deep_research (GRILL red-team), push_forward
 *   stuck_unlocated       -> context_block (find-bottlenecks, a LOCAL analysis
 *                            surface -- the SENS-02 reach), pull_back
 *   wrong_frame           -> deep_research (beautiful-question reframe), pull_back
 *
 * CANON PART 8: the sensor reads ONLY LOCAL bytes (the turn text, an explicit
 * signal kind) to DECIDE firing; it makes NO Brain call and NO network call. The
 * reach carries ONLY generic handles: the dispatch gear handle + a flat scalar
 * evidence bag whose `cause` and `gear` are ENUM handles drawn from closed sets,
 * never the user's matched prose. The pattern banks below are OUR fixed generic
 * vocabulary (structural phrasings of circularity), never user content.
 *
 * GRAPH-READINESS gap-3: conversational turn-state is not yet modeled, so the
 * circularity signal is a lightweight LOCAL scan over the turn bag (explicit
 * signal, then a keyword/marker scan over LOCAL turn text) using the same
 * hasSignal / keyword-scan idiom the sibling sensors use -- no egress.
 *
 * Phase 144 fence: this file PRODUCES a candidate reach; it never assigns
 * routing_source and never requires/defines the routing consumer.
 *
 * Pure / sync / LOCAL-first. node built-ins + sibling sensors only. No new deps.
 * House rule: hyphens only, no em-dashes.
 */

const { makeReach } = require('./sensor-types.cjs');
// REUSE BEFORE BUILD (Canon Part 7): the stuck-cannot-say-where cause reuses the
// SENS-02 lagging-component SIGNAL rather than re-deriving reverse-salient
// phrasing. If sensorLaggingComponent fires on the turn, a lagging component is
// named -> the blockage is a located-but-unaddressed reverse salient.
const { sensorLaggingComponent } = require('./sensor-lagging-component.cjs');

// The closed CAUSE enum set (mirrors the Phase 205 anti-circular judge labels).
// Each is an enum handle recorded in evidence -- never user prose.
const CAUSES = Object.freeze({
  ANSWER_UNHEARD: 'answer_unheard',
  ASSERTION_UNVALIDATED: 'assertion_unvalidated',
  STUCK_UNLOCATED: 'stuck_unlocated',
  WRONG_FRAME: 'wrong_frame',
});

// The four exits. reach_id is one of the FROZEN SIX (mints none); gear is the
// nav-dial position (TELL / GRILL / REFRAME); dispatch is OUR generic handle.
const CAUSE_EXIT = Object.freeze({
  answer_unheard: Object.freeze({
    reach_id: 'context_block',
    posture: 'push_forward',
    gear: 'TELL',
    dispatch: 'tell-synthesis (deliver the answer; stop asking)',
  }),
  assertion_unvalidated: Object.freeze({
    reach_id: 'deep_research',
    posture: 'push_forward',
    gear: 'GRILL',
    dispatch: 'challenge-assumptions',
  }),
  stuck_unlocated: Object.freeze({
    reach_id: 'context_block',
    posture: 'pull_back',
    gear: 'GRILL',
    dispatch: 'find-bottlenecks (rs-engine reverse-salient)',
  }),
  wrong_frame: Object.freeze({
    reach_id: 'deep_research',
    posture: 'pull_back',
    gear: 'REFRAME',
    dispatch: 'beautiful-question (Why / What-if / How)',
  }),
});

// Explicit-signal -> cause map (the strongest, context-first tier). A turn may
// carry { signals: ['wrong_frame'] } or { signals: [{ kind: 'circular' }] }.
const SIGNAL_CAUSE_MAP = Object.freeze({
  answer_unheard: CAUSES.ANSWER_UNHEARD,
  assertion_unvalidated: CAUSES.ASSERTION_UNVALIDATED,
  stuck_unlocated: CAUSES.STUCK_UNLOCATED,
  wrong_frame: CAUSES.WRONG_FRAME,
  // Generic circling signals default to answer_unheard (the tester failure shape:
  // "not answering questions" -> stop asking, deliver -> TELL).
  circular: CAUSES.ANSWER_UNHEARD,
  circling: CAUSES.ANSWER_UNHEARD,
  back_and_forth: CAUSES.ANSWER_UNHEARD,
});

// STRUCTURAL phrasing banks (OUR generic circularity vocabulary, not user
// content). Each detector reports only THAT the shape is present, never WHICH
// words -- the matched text never rides the reach (Part 8).
const WRONG_FRAME_PATTERNS = [
  /\bwrong question\b/i,
  /\bwrong fram(?:e|ing)\b/i,
  /\breframe\b/i,
  /\bnot the (?:right )?question\b/i,
  /\basking the wrong\b/i,
  /\bmisframed\b/i,
];

const STUCK_UNLOCATED_PATTERNS = [
  /\bstuck\b/i,
  /\bcan'?t (?:say|tell|pin(?:point)?|figure out) where\b/i,
  /\bnot sure where\b/i,
  /\bsomething(?:'s| is) (?:off|wrong)\b/i,
  /\bcan'?t put my finger\b/i,
];

const ASSERTION_UNVALIDATED_PATTERNS = [
  /\bobviously\b/i,
  /\bclearly\b/i,
  /\beveryone knows\b/i,
  /\bof course\b/i,
  /\bit'?s obvious\b/i,
  /\bwithout (?:a )?doubt\b/i,
  /\btrust me\b/i,
  /\bgoes without saying\b/i,
  /\bself-evident\b/i,
];

const ANSWER_UNHEARD_PATTERNS = [
  /\bI (?:already|just) (?:said|told you|answered)\b/i,
  /\byou keep asking\b/i,
  /\basked (?:that|this|the same)\b/i,
  /\bsame question\b/i,
  /\bI answered that\b/i,
  /\bwe (?:keep|already) (?:covered|went over)\b/i,
];

// Generic circling cues -> default to answer_unheard when no specific cause hit.
const GENERIC_CIRCLING_PATTERNS = [
  /\bgoing (?:round|around) in circles\b/i,
  /\bback(?:-| )and(?:-| )forth\b/i,
  /\bcircular\b/i,
  /\bwe keep coming back\b/i,
  /\bround and round\b/i,
  /\bnot (?:getting|making) (?:any )?progress\b/i,
  /\bnot answering\b/i,
];

/**
 * Pull the turn text as a string. Tolerant of the two shapes the dispatch
 * chokepoint may carry ({ text } or { utterance }). Returns '' when absent or
 * non-string so the caller soft-fails to null rather than throwing.
 */
function turnText(turn) {
  if (!turn || typeof turn !== 'object') return '';
  if (typeof turn.text === 'string') return turn.text;
  if (typeof turn.utterance === 'string') return turn.utterance;
  return '';
}

/**
 * Return the cause forced by an explicit signal kind, or '' if none. Defensive;
 * a turn is { signals: [...] } where each signal is a string kind or { kind }.
 */
function causeFromSignal(turn) {
  if (!turn || typeof turn !== 'object') return '';
  const signals = Array.isArray(turn.signals) ? turn.signals : [];
  for (const s of signals) {
    const kind = (typeof s === 'string') ? s : (s && typeof s === 'object' ? s.kind : '');
    if (kind && Object.prototype.hasOwnProperty.call(SIGNAL_CAUSE_MAP, kind)) {
      return SIGNAL_CAUSE_MAP[kind];
    }
  }
  return '';
}

/** True if any pattern in the bank matches the text. */
function anyMatch(patterns, text) {
  for (const rx of patterns) {
    if (rx.test(text)) return true;
  }
  return false;
}

/**
 * Classify the circularity CAUSE from LOCAL turn-state, or '' when the
 * conversation is not circling. Precedence (first match wins):
 *   0. an explicit signal kind (strongest, context-first tier)
 *   1. wrong_frame        (the frame itself is named wrong)
 *   2. stuck_unlocated    (SENS-02 lagging-component REUSE, or stuck phrasing)
 *   3. assertion_unvalidated (an asserted-not-tested marker)
 *   4. answer_unheard     (a repeat / already-answered marker)
 *   5. generic circling   -> answer_unheard (the default circling exit)
 */
function classifyCause(turn, tuple, ctx) {
  const bySignal = causeFromSignal(turn);
  if (bySignal) return bySignal;

  const text = turnText(turn);
  if (!text) return '';

  if (anyMatch(WRONG_FRAME_PATTERNS, text)) return CAUSES.WRONG_FRAME;

  // REUSE the SENS-02 lagging-component signal: if it fires, a lagging component
  // was named -> the blockage is a located reverse salient (stuck-cannot-address).
  let lagging = null;
  try {
    lagging = sensorLaggingComponent(turn, tuple, ctx);
  } catch (_e) {
    lagging = null; // soft-fail: a sibling fault never blocks this classifier
  }
  if (lagging || anyMatch(STUCK_UNLOCATED_PATTERNS, text)) return CAUSES.STUCK_UNLOCATED;

  if (anyMatch(ASSERTION_UNVALIDATED_PATTERNS, text)) return CAUSES.ASSERTION_UNVALIDATED;
  if (anyMatch(ANSWER_UNHEARD_PATTERNS, text)) return CAUSES.ANSWER_UNHEARD;
  if (anyMatch(GENERIC_CIRCLING_PATTERNS, text)) return CAUSES.ANSWER_UNHEARD;

  return '';
}

/**
 * SENS-10 -- circularity -> the four-cause / four-exit gear-shift.
 *
 * @param {object} turn  -- normalized turn ({ text, signals })
 * @param {object} tuple -- /mos:diagnose tuple (passed through to SENS-02 reuse)
 * @param {object} ctx   -- LOCAL context ({ roomDir, lowFillSections })
 * @returns {Readonly<object>|null} a frozen candidate reach, or null (soft-fail)
 */
function sensorCircularity(turn, tuple, ctx) {
  let cause = '';
  try {
    cause = classifyCause(turn, tuple, ctx);
  } catch (_e) {
    return null; // soft-fail: a throwing classifier did not fire (DoS mitigation)
  }
  if (!cause) return null;

  const exit = CAUSE_EXIT[cause];
  if (!exit) return null; // defensive: an unknown cause never mints a reach

  const mode = causeFromSignal(turn) ? 'signal' : 'keyword';

  return makeReach({
    reach_id: exit.reach_id,
    posture: exit.posture,
    // Generic gear handle (a nav-dial position + command handle), never user text.
    dispatch: exit.dispatch,
    companions: [],
    signal: 'circularity_detected',
    // LOCAL scalars / ENUMS ONLY: the cause enum + the gear enum + the fire mode
    // enum. Never the user's matched prose (Part 8). All three are drawn from
    // closed sets so the Part-8 sweep + the sensor test can assert it.
    evidence: { cause: cause, gear: exit.gear, mode: mode },
  });
}

module.exports = {
  sensorCircularity: sensorCircularity,
  // Exported for the test + downstream registration.
  CAUSES: CAUSES,
  CAUSE_EXIT: CAUSE_EXIT,
};
